const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const ENCRYPTED_PREFIX = 'enc:v1';
const PARENT_SENSITIVE_FIELDS = ['mobile', 'email', 'address'];
let warnedDerivedEncryptionKey = false;

const resolveEncryptionKey = () => {
  const raw = String(process.env.STUDENT_DATA_ENCRYPTION_KEY || '').trim();
  if (!raw) {
    const fallbackSecret = String(
      process.env.JWT_SECRET
      || process.env.SUPER_ADMIN_INCOMING_SECRET
      || process.env.MONGODB_URL
      || process.env.MONGODB_URI
      || ''
    ).trim();
    if (!fallbackSecret) return null;
    if (!warnedDerivedEncryptionKey) {
      warnedDerivedEncryptionKey = true;
      console.warn('[ParentUser] STUDENT_DATA_ENCRYPTION_KEY not set. Using derived fallback key from existing env secret.');
    }
    return crypto.createHash('sha256').update(fallbackSecret).digest();
  }

  if (raw.startsWith('hex:')) {
    const keyHex = raw.slice(4);
    if (keyHex.length === 64) return Buffer.from(keyHex, 'hex');
    return null;
  }

  if (raw.startsWith('base64:')) {
    const keyB64 = raw.slice(7);
    const buf = Buffer.from(keyB64, 'base64');
    if (buf.length === 32) return buf;
    return null;
  }

  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  const fromBase64 = Buffer.from(raw, 'base64');
  if (fromBase64.length === 32) return fromBase64;
  return crypto.createHash('sha256').update(raw).digest();
};

const getEncryptionKey = () => resolveEncryptionKey();

const isEncryptedValue = (value) => (
  typeof value === 'string' && value.startsWith(`${ENCRYPTED_PREFIX}:`)
);

const normalizeEmailForLookup = (value) => String(value || '').trim().toLowerCase();
const normalizeMobileForLookup = (value) => String(value || '').replace(/\D/g, '');
const hashLookupValue = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

const assertEncryptionConfigured = (target = {}) => {
  const hasSensitive = PARENT_SENSITIVE_FIELDS.some((field) => {
    if (!Object.prototype.hasOwnProperty.call(target, field)) return false;
    const value = target[field];
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  });
  if (!hasSensitive) return;
  if (getEncryptionKey()) return;
  throw new Error('Encryption key is not available. Configure STUDENT_DATA_ENCRYPTION_KEY or JWT_SECRET.');
};

const encryptFieldValue = (value, key) => {
  if (!key || typeof value !== 'string' || !value || isEncryptedValue(value)) {
    return value;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptFieldValue = (value) => {
  const key = getEncryptionKey();
  if (!key || typeof value !== 'string' || !isEncryptedValue(value)) return value;
  const parts = value.split(':');
  if (parts.length !== 5) return value;
  try {
    const iv = Buffer.from(parts[2], 'base64');
    const tag = Buffer.from(parts[3], 'base64');
    const encrypted = Buffer.from(parts[4], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (_err) {
    return value;
  }
};

const applyContactLookupHashes = (target = {}) => {
  if (!target || typeof target !== 'object') return;

  if (Object.prototype.hasOwnProperty.call(target, 'email')) {
    const emailHash = hashLookupValue(normalizeEmailForLookup(target.email));
    target.emailLookupHash = emailHash || undefined;
  }
  if (Object.prototype.hasOwnProperty.call(target, 'mobile')) {
    const mobileHash = hashLookupValue(normalizeMobileForLookup(target.mobile));
    target.mobileLookupHash = mobileHash || undefined;
  }
};

const encryptPayloadFields = (target = {}) => {
  if (!target || typeof target !== 'object') return;
  assertEncryptionConfigured(target);
  const key = getEncryptionKey();
  PARENT_SENSITIVE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(target, field)) {
      target[field] = encryptFieldValue(target[field], key);
    }
  });
};

const decryptDocFields = (doc = null) => {
  if (!doc) return;
  PARENT_SENSITIVE_FIELDS.forEach((field) => {
    const currentValue = doc[field];
    if (typeof currentValue === 'string' && isEncryptedValue(currentValue)) {
      doc[field] = decryptFieldValue(currentValue);
    }
  });
};

const hashPasswordIfNeeded = async (password) => {
  if (!password || typeof password !== 'string') return password;
  if (password.startsWith('$2a$') || password.startsWith('$2b$') || password.startsWith('$2y$')) {
    return password;
  }
  return bcrypt.hash(password, 10);
};

const parentUserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  initialPassword: { type: String, default: "" },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
  campusId: { type: String, default: null, index: true },
  name: String,
  mobile: String,
  email: String,
  relationship: { type: String, default: 'Parent' },
  occupation: { type: String, default: '' },
  address: { type: String, default: '' },
  mobileLookupHash: { type: String, index: true, sparse: true, select: false },
  emailLookupHash: { type: String, index: true, sparse: true, select: false },
  emergencyContact: { type: String, default: '' },
  contactPreference: { type: String, default: '' },
  communicationStatus: { type: String, default: '' },
  engagementLevel: { type: String, default: '' },
  engagementMetrics: {
    communicationRate: { type: Number, default: 0 },
    eventAttendance: { type: Number, default: 0 },
    meetingParticipation: { type: Number, default: 0 },
    responsiveness: { type: Number, default: 0 },
    totalInteractions: { type: Number, default: 0 },
    lastContactDays: { type: Number, default: null },
  },
  recentActivities: [{ type: String }],
  lastLoginAt: { type: Date, default: null },
  childrenIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser' }],
  children: [String],
  grade: [String],
}, { timestamps: true });

parentUserSchema.index({ organizationId: 1, username: 1 }, { unique: true });

parentUserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  const payload = {};
  if (this.isModified('mobile')) payload.mobile = this.mobile;
  if (this.isModified('email')) payload.email = this.email;
  if (this.isModified('address')) payload.address = this.address;

  assertEncryptionConfigured(payload);
  const key = getEncryptionKey();
  if (this.isModified('mobile')) this.mobile = encryptFieldValue(this.mobile, key);
  if (this.isModified('email')) this.email = encryptFieldValue(this.email, key);
  if (this.isModified('address')) this.address = encryptFieldValue(this.address, key);

  if (this.isModified('mobile')) {
    this.mobileLookupHash = hashLookupValue(normalizeMobileForLookup(payload.mobile));
  }
  if (this.isModified('email')) {
    this.emailLookupHash = hashLookupValue(normalizeEmailForLookup(payload.email));
  }

  return next();
});


parentUserSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() || {};
  const nextPassword = update.password || (update.$set && update.$set.password);
  if (nextPassword) {
    const hashed = await hashPasswordIfNeeded(nextPassword);
    if (update.password) update.password = hashed;
    if (update.$set && update.$set.password) update.$set.password = hashed;
  }

  applyContactLookupHashes(update);
  if (update.$set) applyContactLookupHashes(update.$set);
  if (update.$setOnInsert) applyContactLookupHashes(update.$setOnInsert);

  encryptPayloadFields(update);
  if (update.$set) encryptPayloadFields(update.$set);
  if (update.$setOnInsert) encryptPayloadFields(update.$setOnInsert);

  this.setUpdate(update);
  return next();
});

parentUserSchema.pre('updateOne', function (next) {
  const update = this.getUpdate() || {};
  applyContactLookupHashes(update);
  if (update.$set) applyContactLookupHashes(update.$set);
  if (update.$setOnInsert) applyContactLookupHashes(update.$setOnInsert);

  encryptPayloadFields(update);
  if (update.$set) encryptPayloadFields(update.$set);
  if (update.$setOnInsert) encryptPayloadFields(update.$setOnInsert);
  this.setUpdate(update);
  return next();
});

parentUserSchema.pre('updateMany', function (next) {
  const update = this.getUpdate() || {};
  applyContactLookupHashes(update);
  if (update.$set) applyContactLookupHashes(update.$set);
  if (update.$setOnInsert) applyContactLookupHashes(update.$setOnInsert);

  encryptPayloadFields(update);
  if (update.$set) encryptPayloadFields(update.$set);
  if (update.$setOnInsert) encryptPayloadFields(update.$setOnInsert);
  this.setUpdate(update);
  return next();
});

parentUserSchema.pre('insertMany', function (next, docs = []) {
  docs.forEach((doc) => {
    applyContactLookupHashes(doc);
    encryptPayloadFields(doc);
  });
  return next();
});

parentUserSchema.post('init', function (doc) {
  decryptDocFields(doc);
});

parentUserSchema.post('save', function (doc) {
  decryptDocFields(doc);
});

parentUserSchema.post('find', function (docs) {
  if (!Array.isArray(docs)) return;
  docs.forEach((doc) => decryptDocFields(doc));
});

parentUserSchema.post('findOne', function (doc) {
  decryptDocFields(doc);
});

parentUserSchema.post('findOneAndUpdate', function (doc) {
  decryptDocFields(doc);
});

parentUserSchema.statics.buildContactLookupFilter = function ({ email, mobile }) {
  const or = [];
  const normalizedEmail = normalizeEmailForLookup(email);
  if (normalizedEmail) {
    or.push({ emailLookupHash: hashLookupValue(normalizedEmail) });
  }
  const normalizedMobile = normalizeMobileForLookup(mobile);
  if (normalizedMobile) {
    or.push({ mobileLookupHash: hashLookupValue(normalizedMobile) });
  }
  if (!or.length) return null;
  return { $or: or };
};

module.exports = mongoose.model('ParentUser', parentUserSchema);
