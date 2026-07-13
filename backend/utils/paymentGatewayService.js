const axios = require('axios');
const crypto = require('crypto');

const normalizeCredential = (value) => String(value || '').trim();

const assertCredentials = ({ keyId, keySecret } = {}) => {
  const normalized = {
    keyId: normalizeCredential(keyId),
    keySecret: normalizeCredential(keySecret),
  };
  if (!normalized.keyId || !normalized.keySecret) {
    const error = new Error('Razorpay credentials are not configured for this organization');
    error.statusCode = 503;
    error.code = 'PAYMENT_GATEWAY_NOT_CONFIGURED';
    throw error;
  }
  return normalized;
};

const razorpayRequest = async ({ credentials, method = 'get', path, data, params }) => {
  const { keyId, keySecret } = assertCredentials(credentials);
  try {
    const response = await axios({
      method,
      url: `https://api.razorpay.com/v1${path}`,
      auth: { username: keyId, password: keySecret },
      data,
      params,
      timeout: Number(process.env.RAZORPAY_TIMEOUT_MS || 10000),
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  } catch (error) {
    const description = error?.response?.data?.error?.description
      || error?.response?.data?.error?.reason
      || error?.response?.data?.error?.code
      || (error?.code === 'ECONNABORTED' ? 'Razorpay request timed out' : error?.message)
      || 'Razorpay request failed';
    const gatewayError = new Error(description);
    gatewayError.statusCode = error?.response?.status === 401 ? 400 : 502;
    gatewayError.code = 'RAZORPAY_REQUEST_FAILED';
    throw gatewayError;
  }
};

const testRazorpayConnection = async (credentials) => {
  await razorpayRequest({ credentials, path: '/orders', params: { count: 1 } });
  return true;
};

const buildRazorpayReceipt = (prefix, invoiceId) => {
  const safePrefix = String(prefix || 'fee').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 10) || 'fee';
  const invoicePart = String(invoiceId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-12) || 'invoice';
  return `${safePrefix}_${invoicePart}_${Date.now().toString(36).slice(-8)}`.slice(0, 40);
};

const createRazorpayOrder = async ({ credentials, amountPaise, receipt, notes }) => {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
    throw new Error('Payment amount must be at least INR 1');
  }
  const order = await razorpayRequest({
    credentials,
    method: 'post',
    path: '/orders',
    data: { amount: amountPaise, currency: 'INR', receipt, notes },
  });
  return { order, keyId: credentials.keyId };
};

const safeEqualHex = (expected, supplied) => {
  try {
    const expectedBuffer = Buffer.from(expected, 'hex');
    const suppliedBuffer = Buffer.from(String(supplied || ''), 'hex');
    return expectedBuffer.length === suppliedBuffer.length
      && expectedBuffer.length > 0
      && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
  } catch {
    return false;
  }
};

const verifyRazorpaySignature = ({ keySecret, orderId, paymentId, signature }) => {
  const expected = crypto
    .createHmac('sha256', normalizeCredential(keySecret))
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqualHex(expected, signature);
};

const verifyRazorpayWebhookSignature = ({ webhookSecret, rawBody, signature }) => {
  if (!Buffer.isBuffer(rawBody) || !normalizeCredential(webhookSecret)) return false;
  const expected = crypto
    .createHmac('sha256', normalizeCredential(webhookSecret))
    .update(rawBody)
    .digest('hex');
  return safeEqualHex(expected, signature);
};

const buildTransactionId = (prefix = 'PAY') => {
  const safePrefix = String(prefix || 'PAY').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'PAY';
  return `${safePrefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

module.exports = {
  buildRazorpayReceipt,
  buildTransactionId,
  createRazorpayOrder,
  testRazorpayConnection,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
};
