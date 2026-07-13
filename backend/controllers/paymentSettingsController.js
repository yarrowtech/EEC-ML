const Organization = require('../models/Organization');
const PaymentAudit = require('../models/PaymentAudit');
const School = require('../models/School');
const { encrypt, decrypt } = require('../utils/encryption');
const { testRazorpayConnection } = require('../utils/paymentGatewayService');

const gatewaySelect = '+paymentGateway.razorpay.keySecret +paymentGateway.razorpay.webhookSecret';

const resolveOrganization = async (req) => {
  if (req.isSuperAdmin) return null;
  const organizationId = req.organization?._id || req.organizationId || req.admin?.organizationId;
  const filter = organizationId ? { _id: organizationId } : (req.schoolId ? { schoolId: req.schoolId } : null);
  if (!filter) return null;
  return Organization.findOne(filter).select(gatewaySelect);
};

const publicSettings = (organization) => {
  const gateway = organization?.paymentGateway || {};
  const razorpay = gateway.razorpay || {};
  const connected = Boolean(gateway.enabled && razorpay.keyId && razorpay.keySecret);
  return {
    enabled: Boolean(gateway.enabled),
    provider: gateway.provider || 'razorpay',
    mode: gateway.mode || 'test',
    keyId: razorpay.keyId || '',
    connected,
    accountName: connected ? (razorpay.accountName || '') : '',
    accountEmail: connected ? (razorpay.accountEmail || '') : '',
    connectedAt: connected ? (razorpay.connectedAt || null) : null,
    lastVerifiedAt: connected ? (razorpay.lastVerifiedAt || null) : null,
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

const validatePayload = (body, current) => {
  const mode = String(body?.mode || '').trim().toLowerCase();
  const keyId = String(body?.keyId || '').trim();
  const incomingKeySecret = String(body?.keySecret || '').trim();
  const incomingWebhookSecret = String(body?.webhookSecret || '').trim();
  if (!['test', 'live'].includes(mode)) throw new Error('Mode must be test or live');
  if (!new RegExp(`^rzp_${mode}_[A-Za-z0-9]+$`).test(keyId)) {
    throw new Error(`Key ID must be a valid Razorpay ${mode} key`);
  }
  const keySecret = incomingKeySecret || (current?.keySecret ? decrypt(current.keySecret) : '');
  const webhookSecret = incomingWebhookSecret || (current?.webhookSecret ? decrypt(current.webhookSecret) : '');
  if (keySecret.length < 8 || keySecret.length > 200) throw new Error('A valid Key Secret is required');
  if (webhookSecret.length < 8 || webhookSecret.length > 200) throw new Error('A valid Webhook Secret is required');
  return { mode, keyId, keySecret, webhookSecret };
};

const saveSettings = async (req, res, next) => {
  try {
    const organization = await ensureOrganization(req, res);
    if (!organization) return;
    let values;
    try {
      values = validatePayload(req.body, organization.paymentGateway?.razorpay);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    await testRazorpayConnection(values);
    const school = organization.schoolId
      ? await School.findById(organization.schoolId).select('name officialEmail contactEmail').lean()
      : null;
    const now = new Date();
    organization.paymentGateway = {
      provider: 'razorpay',
      enabled: true,
      mode: values.mode,
      razorpay: {
        keyId: values.keyId,
        keySecret: encrypt(values.keySecret),
        webhookSecret: encrypt(values.webhookSecret),
        accountName: school?.name || organization.name,
        accountEmail: school?.officialEmail || school?.contactEmail || '',
        connectedAt: organization.paymentGateway?.razorpay?.connectedAt || now,
        lastVerifiedAt: now,
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

const testConnection = async (req, res, next) => {
  try {
    const organization = await ensureOrganization(req, res);
    if (!organization) return;
    const razorpay = organization.paymentGateway?.razorpay;
    if (!organization.paymentGateway?.enabled || !razorpay?.keyId || !razorpay?.keySecret) {
      return res.status(400).json({ success: false, error: 'Payment gateway is not configured' });
    }
    await testRazorpayConnection({ keyId: razorpay.keyId, keySecret: decrypt(razorpay.keySecret) });
    razorpay.lastVerifiedAt = new Date();
    await organization.save();
    await PaymentAudit.create({
      organizationId: organization._id,
      action: 'gateway.connection_tested',
      userId: req.admin?.id || null,
      metadata: { provider: 'razorpay', success: true },
    });
    return res.json({
      success: true,
      accountName: razorpay.accountName || organization.name,
      accountEmail: razorpay.accountEmail || '',
      lastVerifiedAt: razorpay.lastVerifiedAt,
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
    organization.set('paymentGateway.enabled', false);
    organization.set('paymentGateway.razorpay', {
      keyId: '', keySecret: '', webhookSecret: '', accountEmail: '', accountName: '',
      connectedAt: null, lastVerifiedAt: null,
    });
    await organization.save();
    await PaymentAudit.create({
      organizationId: organization._id,
      action: 'gateway.disconnected',
      userId: req.admin?.id || null,
      metadata: { provider: 'razorpay' },
    });
    return res.json({ success: true, ...publicSettings(organization) });
  } catch (error) {
    return next(error);
  }
};

module.exports = { disconnect, getSettings, publicSettings, saveSettings, testConnection };
module.exports.validatePayload = validatePayload;
