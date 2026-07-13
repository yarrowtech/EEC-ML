const crypto = require('crypto');
const {
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
} = require('../utils/paymentGatewayService');
const { publicSettings } = require('../controllers/paymentSettingsController');

describe('tenant Razorpay signatures', () => {
  test('checkout signatures only validate with the tenant key secret', () => {
    const orderId = 'order_tenant_a';
    const paymentId = 'pay_123';
    const signature = crypto.createHmac('sha256', 'tenant-a-secret')
      .update(`${orderId}|${paymentId}`).digest('hex');
    expect(verifyRazorpaySignature({ keySecret: 'tenant-a-secret', orderId, paymentId, signature })).toBe(true);
    expect(verifyRazorpaySignature({ keySecret: 'tenant-b-secret', orderId, paymentId, signature })).toBe(false);
  });

  test('webhook signatures cover the exact raw request body', () => {
    const rawBody = Buffer.from('{"event":"payment.captured"}');
    const signature = crypto.createHmac('sha256', 'webhook-secret').update(rawBody).digest('hex');
    expect(verifyRazorpayWebhookSignature({ webhookSecret: 'webhook-secret', rawBody, signature })).toBe(true);
    expect(verifyRazorpayWebhookSignature({ webhookSecret: 'webhook-secret', rawBody: Buffer.from('{}'), signature })).toBe(false);
  });
});

describe('payment settings serialization', () => {
  test('never exposes stored key or webhook secrets', () => {
    const payload = publicSettings({
      paymentGateway: {
        enabled: true,
        provider: 'razorpay',
        mode: 'live',
        razorpay: { keyId: 'rzp_live_public', keySecret: 'encrypted-a', webhookSecret: 'encrypted-b' },
      },
    });
    expect(payload).toMatchObject({ connected: true, keyId: 'rzp_live_public' });
    expect(payload).not.toHaveProperty('keySecret');
    expect(payload).not.toHaveProperty('webhookSecret');
  });
});
