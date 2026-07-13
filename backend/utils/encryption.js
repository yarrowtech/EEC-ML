const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

const getEncryptionKey = () => {
  const value = String(process.env.PAYMENT_ENCRYPTION_KEY || '').trim();
  let key;

  if (/^[a-f\d]{64}$/i.test(value)) {
    key = Buffer.from(value, 'hex');
  } else {
    try {
      key = Buffer.from(value, 'base64');
    } catch {
      key = Buffer.alloc(0);
    }
  }

  if (key.length !== 32) {
    const error = new Error('PAYMENT_ENCRYPTION_KEY must be a 32-byte base64 value or 64-character hex value');
    error.code = 'PAYMENT_ENCRYPTION_KEY_INVALID';
    throw error;
  }
  return key;
};

const encrypt = (plaintext) => {
  if (typeof plaintext !== 'string' || !plaintext) {
    throw new TypeError('A non-empty string is required for encryption');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
};

const decrypt = (envelope) => {
  if (typeof envelope !== 'string' || !envelope) {
    throw new TypeError('An encrypted value is required');
  }
  const [version, ivValue, tagValue, ciphertextValue, ...extra] = envelope.split(':');
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue || extra.length) {
    throw new Error('Invalid encrypted value');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivValue, 'base64'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

module.exports = { encrypt, decrypt, getEncryptionKey };
