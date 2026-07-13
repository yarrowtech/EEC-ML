const crypto = require('crypto');
const { decrypt, encrypt } = require('../utils/encryption');

describe('payment credential encryption', () => {
  const originalKey = process.env.PAYMENT_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.PAYMENT_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.PAYMENT_ENCRYPTION_KEY;
    else process.env.PAYMENT_ENCRYPTION_KEY = originalKey;
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
});
