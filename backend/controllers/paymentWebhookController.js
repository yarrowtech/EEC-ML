const Organization = require('../models/Organization');
const Payment = require('../models/Payment');
const PaymentAudit = require('../models/PaymentAudit');
const { capturePayment, failPayment } = require('../services/paymentLifecycleService');
const { decrypt } = require('../utils/encryption');
const { verifyRazorpayWebhookSignature } = require('../utils/paymentGatewayService');

const supportedEvents = new Set(['payment.captured', 'payment.failed', 'order.paid']);

const getEventDetails = (payload) => {
  const paymentEntity = payload?.payload?.payment?.entity || {};
  const orderEntity = payload?.payload?.order?.entity || {};
  return {
    orderId: paymentEntity.order_id || orderEntity.id || '',
    paymentId: paymentEntity.id || '',
    reason: paymentEntity.error_description || paymentEntity.error_reason || paymentEntity.error_code || '',
  };
};

module.exports = async function paymentWebhookController(req, res, next) {
  try {
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: 'Raw webhook body required' });
    }
    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    if (!supportedEvents.has(payload?.event)) {
      return res.status(200).json({ received: true, ignored: true });
    }
    const details = getEventDetails(payload);
    if (!details.orderId) return res.status(400).json({ error: 'Webhook order id is missing' });

    // Tenant identity comes from the server-created order, never from request input.
    const payment = await Payment.findOne({ provider: 'razorpay', providerOrderId: details.orderId });
    if (!payment) return res.status(404).json({ error: 'Payment order not found' });
    const organization = await Organization.findById(payment.organizationId)
      .select('+paymentGateway.razorpay.webhookSecret');
    const encryptedSecret = organization?.paymentGateway?.razorpay?.webhookSecret;
    if (!organization || !encryptedSecret) return res.status(503).json({ error: 'Webhook is not configured' });

    const valid = verifyRazorpayWebhookSignature({
      webhookSecret: decrypt(encryptedSecret),
      rawBody: req.body,
      signature: req.get('x-razorpay-signature'),
    });
    if (!valid) {
      await PaymentAudit.create({
        organizationId: payment.organizationId,
        action: 'webhook.signature_rejected',
        metadata: { providerOrderId: details.orderId, event: payload.event },
      });
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    if (payload.event === 'payment.failed') {
      await failPayment({ payment, providerPaymentId: details.paymentId, reason: details.reason });
    } else {
      await capturePayment({
        payment,
        providerPaymentId: details.paymentId || payment.providerPaymentId,
        source: `webhook:${payload.event}`,
      });
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    return next(error);
  }
};
