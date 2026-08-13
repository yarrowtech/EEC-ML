const axios = require('axios');
const crypto = require('crypto');
const { logger } = require('./logger');

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
    const upstreamStatus = error?.response?.status;
    // Razorpay's error body isn't always the standard {error:{description}}
    // shape (e.g. plain-text/HTML for some gateway-level rejections) — log
    // the raw response so a confusing surfaced message can be traced back
    // to exactly what Razorpay actually sent.
    logger.error({
      event: 'razorpay_request_failed',
      method,
      path,
      upstreamStatus,
      responseData: error?.response?.data,
      axiosMessage: error?.message,
      axiosCode: error?.code,
    }, 'Razorpay API request failed');
    const description = error?.response?.data?.error?.description
      || error?.response?.data?.error?.reason
      || error?.response?.data?.error?.code
      || (error?.code === 'ECONNABORTED' ? 'Razorpay request timed out' : error?.message)
      || 'Razorpay request failed';
    const gatewayError = new Error(description);
    gatewayError.statusCode = upstreamStatus === 401 ? 400 : 502;
    gatewayError.upstreamStatus = upstreamStatus;
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

// Razorpay's QR Codes API is a separate, on-demand product that has to be
// activated per-merchant by Razorpay support — it's not enabled by default,
// even in test mode. A merchant without it turned on gets a bare 404 instead
// of a normal business error, which reads as "the code is broken" rather
// than "this account needs a feature flip". Rewrap that specific case.
const wrapQrNotEnabled = async (fn) => {
  try {
    return await fn();
  } catch (error) {
    if (error?.upstreamStatus === 404) {
      const activationError = new Error(
        'Razorpay QR Codes isn’t enabled for this account yet. Ask Razorpay support to activate "QR Codes" for this merchant (Dashboard → Account & Settings → Payment Methods, or via support) — until then, use "Pay Online via Razorpay" instead.'
      );
      activationError.statusCode = 400;
      activationError.code = 'RAZORPAY_QR_NOT_ENABLED';
      throw activationError;
    }
    throw error;
  }
};

// A single-use, fixed-amount UPI QR code — closes itself automatically once
// paid (or once closeBy passes), so it behaves like a one-shot till/kiosk
// display rather than a reusable payment link.
const createRazorpayQrCode = async ({ credentials, amountPaise, notes, closeBy, name }) => {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
    throw new Error('Payment amount must be at least INR 1');
  }
  return wrapQrNotEnabled(() => razorpayRequest({
    credentials,
    method: 'post',
    path: '/payments/qr_codes',
    data: {
      type: 'upi_qr',
      name: name || 'Fee Payment',
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: amountPaise,
      close_by: closeBy,
      notes,
    },
  }));
};

const fetchRazorpayQrCode = async ({ credentials, qrCodeId }) =>
  wrapQrNotEnabled(() => razorpayRequest({ credentials, path: `/payments/qr_codes/${qrCodeId}` }));

const fetchRazorpayQrPayments = async ({ credentials, qrCodeId }) =>
  wrapQrNotEnabled(() => razorpayRequest({ credentials, path: `/payments/qr_codes/${qrCodeId}/payments` }));

const closeRazorpayQrCode = async ({ credentials, qrCodeId }) =>
  wrapQrNotEnabled(() => razorpayRequest({ credentials, method: 'post', path: `/payments/qr_codes/${qrCodeId}/close` }));

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
  closeRazorpayQrCode,
  createRazorpayOrder,
  createRazorpayQrCode,
  fetchRazorpayQrCode,
  fetchRazorpayQrPayments,
  testRazorpayConnection,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
};
