const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
let warnedDerivedEncryptionKey = false;
let warnedFallbackFromInvalidKey = false;

const FALLBACK_ENV_VARS = [
  'JWT_SECRET',
  'SUPER_ADMIN_INCOMING_SECRET',
  'SESSION_SECRET',
  'APP_SECRET',
  'AUTH_SECRET',
  'ADMIN_JWT_SECRET',
  'MONGODB_URL',
  'MONGODB_URI',
  'MONGO_URL',
  'DATABASE_URL',
];

const getFallbackSecret = () => {
  for (const envKey of FALLBACK_ENV_VARS) {
    const value = String(process.env[envKey] || '').trim();
    if (value) return value;
  }
  return '';
};

const parseConfiguredKey = (value) => {
  let key;

  if (value.startsWith('hex:')) {
    const keyHex = value.slice(4);
    if (keyHex.length === 64) {
      key = Buffer.from(keyHex, 'hex');
    }
  } else if (value.startsWith('base64:')) {
    const keyB64 = value.slice(7);
    const buf = Buffer.from(keyB64, 'base64');
    if (buf.length === 32) {
      key = buf;
    }
  } else if (/^[a-f\d]{64}$/i.test(value)) {
    key = Buffer.from(value, 'hex');
  } else {
    try {
      key = Buffer.from(value, 'base64');
    } catch {
      key = Buffer.alloc(0);
    }
  }

  return key && key.length === 32 ? key : null;
};

const getEncryptionKey = () => {
  const value = String(process.env.PAYMENT_ENCRYPTION_KEY || '').trim();
  const fallbackSecret = getFallbackSecret();

  if (!value) {
    if (!fallbackSecret) {
      const error = new Error('PAYMENT_ENCRYPTION_KEY must be set to a 32-byte base64 value or 64-character hex value');
      error.code = 'PAYMENT_ENCRYPTION_KEY_INVALID';
      throw error;
    }
    if (!warnedDerivedEncryptionKey) {
      warnedDerivedEncryptionKey = true;
      console.warn('[payment encryption] PAYMENT_ENCRYPTION_KEY not set. Using a derived fallback key from existing env secret. Set PAYMENT_ENCRYPTION_KEY explicitly for production key management.');
    }
    return crypto.createHash('sha256').update(fallbackSecret).digest();
  }

  const key = parseConfiguredKey(value);
  if (key) {
    return key;
  }

  if (fallbackSecret) {
    if (!warnedFallbackFromInvalidKey) {
      warnedFallbackFromInvalidKey = true;
      console.warn('[payment encryption] PAYMENT_ENCRYPTION_KEY is invalid. Falling back to a derived key from an existing env secret.');
    }
    return crypto.createHash('sha256').update(fallbackSecret).digest();
  }

  const error = new Error('PAYMENT_ENCRYPTION_KEY must be a 32-byte base64 value or 64-character hex value');
  error.code = 'PAYMENT_ENCRYPTION_KEY_INVALID';
  throw error;
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
