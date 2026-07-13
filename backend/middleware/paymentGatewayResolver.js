const Organization = require('../models/Organization');
const { decrypt } = require('../utils/encryption');

const findRequestOrganization = async (req) => {
  const organizationId = req.organization?._id || req.organizationId || req.admin?.organizationId || req.user?.organizationId;
  const filter = organizationId
    ? { _id: organizationId }
    : (req.schoolId ? { schoolId: req.schoolId } : null);
  if (!filter) return null;
  return Organization.findOne(filter)
    .select('+paymentGateway.razorpay.keySecret +paymentGateway.razorpay.webhookSecret');
};

const paymentGatewayResolver = async (req, res, next) => {
  try {
    const organization = await findRequestOrganization(req);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    if (req.organizationId && String(organization._id) !== String(req.organizationId)) {
      return res.status(403).json({ error: 'Organization mismatch' });
    }

    const gateway = organization.paymentGateway;
    const razorpay = gateway?.razorpay;
    if (!gateway?.enabled || !razorpay?.keyId || !razorpay?.keySecret || !razorpay?.webhookSecret) {
      return res.status(503).json({
        error: 'Online payments are not configured for this school',
        code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
      });
    }

    req.paymentGateway = {
      organizationId: organization._id,
      schoolId: organization.schoolId,
      provider: gateway.provider,
      mode: gateway.mode,
      keyId: razorpay.keyId,
      keySecret: decrypt(razorpay.keySecret),
      webhookSecret: razorpay.webhookSecret ? decrypt(razorpay.webhookSecret) : '',
    };
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = paymentGatewayResolver;
module.exports.findRequestOrganization = findRequestOrganization;
