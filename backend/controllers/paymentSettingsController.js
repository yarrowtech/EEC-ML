const Organization = require('../models/Organization');
const PaymentAudit = require('../models/PaymentAudit');
const School = require('../models/School');
const { encrypt, decrypt } = require('../utils/encryption');
const { testRazorpayConnection } = require('../utils/paymentGatewayService');

const MODES = ['test', 'live'];

const gatewaySelect = MODES
  .map((mode) => `+paymentGateway.razorpay.${mode}.keySecret +paymentGateway.razorpay.${mode}.webhookSecret`)
  .join(' ');

const resolveOrganization = async (req) => {
  if (req.isSuperAdmin) return null;
  const organizationId = req.organization?._id || req.organizationId || req.admin?.organizationId;
  const filter = organizationId ? { _id: organizationId } : (req.schoolId ? { schoolId: req.schoolId } : null);
  if (!filter) return null;
  return Organization.findOne(filter).select(gatewaySelect);
};

// Last-4-chars preview only — safe to store and return unencrypted, matches
// how Stripe/Razorpay's own dashboards show already-saved secrets.
const buildPreview = (secret) => (secret ? `••••${secret.slice(-4)}` : '');

const publicModeSettings = (slot = {}) => ({
  keyId: slot.keyId || '',
  hasKeySecret: Boolean(slot.keySecret),
  keySecretPreview: slot.keySecretPreview || '',
  hasWebhookSecret: Boolean(slot.webhookSecret),
  webhookSecretPreview: slot.webhookSecretPreview || '',
  connected: Boolean(slot.keyId && slot.keySecret && slot.webhookSecret),
  connectedAt: slot.connectedAt || null,
  lastVerifiedAt: slot.lastVerifiedAt || null,
});

const publicSettings = (organization) => {
  const gateway = organization?.paymentGateway || {};
  const razorpay = gateway.razorpay || {};
  const mode = gateway.mode || 'test';
  const activeSlot = razorpay[mode] || {};
  const connected = Boolean(gateway.enabled && activeSlot.keyId && activeSlot.keySecret);
  return {
    enabled: Boolean(gateway.enabled),
    provider: gateway.provider || 'razorpay',
    mode,
    connected,
    accountName: razorpay.accountName || '',
    accountEmail: razorpay.accountEmail || '',
    test: publicModeSettings(razorpay.test),
    live: publicModeSettings(razorpay.live),
  };
};

const ensureOrganization = async (req, res) => {
  const organization = await resolveOrganization(req);
  if (!organization) {
    res.status(req.isSuperAdmin ? 403 : 404).json({
      error: req.isSuperAdmin ? 'School administrators configure payment gateways' : 'Organization not found',
    });
    return null;
  }
  if (req.organizationId && String(organization._id) !== String(req.organizationId)) {
    res.status(403).json({ error: 'Organization mismatch' });
    return null;
  }
  return organization;
};

const getSettings = async (req, res, next) => {
  try {
    const organization = await ensureOrganization(req, res);
    if (!organization) return;
    res.json(publicSettings(organization));
  } catch (error) {
    next(error);
  }
};

const validatePayload = (body, currentSlot) => {
  const mode = String(body?.mode || '').trim().toLowerCase();
  const keyId = String(body?.keyId || '').trim();
  const incomingKeySecret = String(body?.keySecret || '').trim();
  const incomingWebhookSecret = String(body?.webhookSecret || '').trim();
  if (!MODES.includes(mode)) throw new Error('Mode must be test or live');
  if (!new RegExp(`^rzp_${mode}_[A-Za-z0-9]+$`).test(keyId)) {
    throw new Error(`Key ID must be a valid Razorpay ${mode} key`);
  }
  const keySecret = incomingKeySecret || (currentSlot?.keySecret ? decrypt(currentSlot.keySecret) : '');
  const webhookSecret = incomingWebhookSecret || (currentSlot?.webhookSecret ? decrypt(currentSlot.webhookSecret) : '');
  if (keySecret.length < 8 || keySecret.length > 200) throw new Error('A valid Key Secret is required');
  if (webhookSecret.length < 8 || webhookSecret.length > 200) throw new Error('A valid Webhook Secret is required');
  return { mode, keyId, keySecret, webhookSecret };
};

const saveSettings = async (req, res, next) => {
  try {
    const organization = await ensureOrganization(req, res);
    if (!organization) return;
    const razorpay = organization.paymentGateway?.razorpay || {};
    let values;
    try {
      const requestedMode = String(req.body?.mode || '').trim().toLowerCase();
      values = validatePayload(req.body, razorpay[requestedMode]);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    await testRazorpayConnection(values);
    const school = organization.schoolId
      ? await School.findById(organization.schoolId).select('name officialEmail contactEmail').lean()
      : null;
    const now = new Date();
    const existingSlot = razorpay[values.mode] || {};
    const updatedSlot = {
      keyId: values.keyId,
      keySecret: encrypt(values.keySecret),
      keySecretPreview: buildPreview(values.keySecret),
      webhookSecret: encrypt(values.webhookSecret),
      webhookSecretPreview: buildPreview(values.webhookSecret),
      connectedAt: existingSlot.connectedAt || now,
      lastVerifiedAt: now,
    };

    // Saving a mode's credentials doesn't switch which mode is live — except
    // the very first connection ever, where auto-activating avoids a
    // redundant extra click for the common case.
    const hadAnyModeConnected = Boolean(razorpay.test?.keyId || razorpay.live?.keyId);
    const nextActiveMode = hadAnyModeConnected ? (organization.paymentGateway.mode || 'test') : values.mode;

    organization.paymentGateway = {
      provider: 'razorpay',
      enabled: true,
      mode: nextActiveMode,
      razorpay: {
        accountName: school?.name || organization.name,
        accountEmail: school?.officialEmail || school?.contactEmail || '',
        test: values.mode === 'test' ? updatedSlot : (razorpay.test || {}),
        live: values.mode === 'live' ? updatedSlot : (razorpay.live || {}),
      },
    };
    await organization.save();
    await PaymentAudit.create({
      organizationId: organization._id,
      action: 'gateway.configuration_saved',
      userId: req.admin?.id || null,
      metadata: { provider: 'razorpay', mode: values.mode, keyIdSuffix: values.keyId.slice(-4) },
    });
    return res.json(publicSettings(organization));
  } catch (error) {
    if (error.code === 'RAZORPAY_REQUEST_FAILED') {
      return res.status(error.statusCode || 400).json({ error: `Razorpay connection failed: ${error.message}` });
    }
    return next(error);
  }
};

// Deliberately separate from getSettings/publicSettings, which never include
// decrypted secrets. Only reachable via an explicit admin action (not part
// of the normal page load), and every reveal is audit-logged.
const revealSecrets = async (req, res, next) => {
  try {
    const organization = await ensureOrganization(req, res);
    if (!organization) return;
    const mode = String(req.body?.mode || '').trim().toLowerCase();
    if (!MODES.includes(mode)) return res.status(400).json({ error: 'Mode must be test or live' });
    const slot = organization.paymentGateway?.razorpay?.[mode];
    if (!slot?.keySecret && !slot?.webhookSecret) {
      return res.status(404).json({ error: `No ${mode} credentials saved yet` });
    }
    await PaymentAudit.create({
      organizationId: organization._id,
      action: 'gateway.secret_revealed',
      userId: req.admin?.id || null,
      metadata: { provider: 'razorpay', mode },
    });
    return res.json({
      keySecret: slot.keySecret ? decrypt(slot.keySecret) : '',
      webhookSecret: slot.webhookSecret ? decrypt(slot.webhookSecret) : '',
    });
  } catch (error) {
    return next(error);
  }
};

const activateMode = async (req, res, next) => {
  try {
    const organization = await ensureOrganization(req, res);
    if (!organization) return;
    const mode = String(req.body?.mode || '').trim().toLowerCase();
    if (!MODES.includes(mode)) return res.status(400).json({ error: 'Mode must be test or live' });
    const slot = organization.paymentGateway?.razorpay?.[mode];
    if (!slot?.keyId || !slot?.keySecret || !slot?.webhookSecret) {
      return res.status(400).json({ error: `Save ${mode} credentials before activating ${mode} mode` });
    }
    organization.set('paymentGateway.mode', mode);
    organization.set('paymentGateway.enabled', true);
    await organization.save();
    await PaymentAudit.create({
      organizationId: organization._id,
      action: 'gateway.mode_activated',
      userId: req.admin?.id || null,
      metadata: { provider: 'razorpay', mode },
    });
    return res.json(publicSettings(organization));
  } catch (error) {
    return next(error);
  }
};

const testConnection = async (req, res, next) => {
  try {
    const organization = await ensureOrganization(req, res);
    if (!organization) return;
    const requestedMode = String(req.body?.mode || '').trim().toLowerCase();
    const mode = MODES.includes(requestedMode) ? requestedMode : (organization.paymentGateway?.mode || 'test');
    const slot = organization.paymentGateway?.razorpay?.[mode];
    if (!slot?.keyId || !slot?.keySecret) {
      return res.status(400).json({ success: false, error: `${mode === 'live' ? 'Live' : 'Test'} mode is not configured` });
    }
    await testRazorpayConnection({ keyId: slot.keyId, keySecret: decrypt(slot.keySecret) });
    slot.lastVerifiedAt = new Date();
    await organization.save();
    await PaymentAudit.create({
      organizationId: organization._id,
      action: 'gateway.connection_tested',
      userId: req.admin?.id || null,
      metadata: { provider: 'razorpay', mode, success: true },
    });
    return res.json({
      success: true,
      mode,
      accountName: organization.paymentGateway.razorpay.accountName || organization.name,
      accountEmail: organization.paymentGateway.razorpay.accountEmail || '',
      lastVerifiedAt: slot.lastVerifiedAt,
    });
  } catch (error) {
    if (error.code === 'RAZORPAY_REQUEST_FAILED') {
      return res.status(error.statusCode || 400).json({ success: false, error: error.message });
    }
    return next(error);
  }
};

const disconnect = async (req, res, next) => {
  try {
    const organization = await ensureOrganization(req, res);
    if (!organization) return;
    const requestedMode = String(req.body?.mode || '').trim().toLowerCase();
    const mode = MODES.includes(requestedMode) ? requestedMode : (organization.paymentGateway?.mode || 'test');
    const emptySlot = {
      keyId: '', keySecret: '', keySecretPreview: '', webhookSecret: '', webhookSecretPreview: '',
      connectedAt: null, lastVerifiedAt: null,
    };
    organization.set(`paymentGateway.razorpay.${mode}`, emptySlot);
    const otherMode = mode === 'live' ? 'test' : 'live';
    const otherSlot = organization.paymentGateway?.razorpay?.[otherMode];
    // Only fully disable online payments if the mode being disconnected was
    // the active one and there's nothing usable left in the other mode.
    if (organization.paymentGateway.mode === mode && !otherSlot?.keyId) {
      organization.set('paymentGateway.enabled', false);
    }
    await organization.save();
    await PaymentAudit.create({
      organizationId: organization._id,
      action: 'gateway.disconnected',
      userId: req.admin?.id || null,
      metadata: { provider: 'razorpay', mode },
    });
    return res.json({ success: true, ...publicSettings(organization) });
  } catch (error) {
    return next(error);
  }
};

module.exports = { activateMode, disconnect, getSettings, publicSettings, revealSecrets, saveSettings, testConnection };
module.exports.validatePayload = validatePayload;
