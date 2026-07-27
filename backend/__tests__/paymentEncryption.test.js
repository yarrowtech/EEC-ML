const crypto = require('crypto');
const { decrypt, encrypt } = require('../utils/encryption');

describe('payment credential encryption', () => {
  const originalKey = process.env.PAYMENT_ENCRYPTION_KEY;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.PAYMENT_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    process.env.JWT_SECRET = originalJwtSecret || 'test-jwt-secret-for-payment-encryption';
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.PAYMENT_ENCRYPTION_KEY;
    else process.env.PAYMENT_ENCRYPTION_KEY = originalKey;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  test('round-trips credentials using randomized authenticated envelopes', () => {
    const first = encrypt('razorpay-secret');
    const second = encrypt('razorpay-secret');
    expect(first).not.toBe(second);
    expect(first).toMatch(/^v1:/);
    expect(decrypt(first)).toBe('razorpay-secret');
  });

  test('rejects a tampered ciphertext', () => {
    const parts = encrypt('razorpay-secret').split(':');
    parts[3] = Buffer.from('tampered').toString('base64');
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  test('requires exactly 256 bits of key material', () => {
    process.env.PAYMENT_ENCRYPTION_KEY = Buffer.from('too-short').toString('base64');
    expect(() => encrypt('secret')).toThrow('PAYMENT_ENCRYPTION_KEY');
  });

  test('supports hex and base64 prefixed payment keys', () => {
    const hexKey = crypto.randomBytes(32).toString('hex');
    process.env.PAYMENT_ENCRYPTION_KEY = `hex:${hexKey}`;
    const encryptedHex = encrypt('hex-secret');
    expect(decrypt(encryptedHex)).toBe('hex-secret');

    const base64Key = crypto.randomBytes(32).toString('base64');
    process.env.PAYMENT_ENCRYPTION_KEY = `base64:${base64Key}`;
    const encryptedBase64 = encrypt('base64-secret');
    expect(decrypt(encryptedBase64)).toBe('base64-secret');
  });

  test('falls back to a derived key when the payment key is missing', () => {
    delete process.env.PAYMENT_ENCRYPTION_KEY;
    process.env.JWT_SECRET = 'derived-fallback-secret';

    const encrypted = encrypt('fallback-secret');
    expect(decrypt(encrypted)).toBe('fallback-secret');
  });
});
