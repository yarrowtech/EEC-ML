  const mongoose = require('mongoose'); 
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const ENCRYPTED_PREFIX = 'enc:v1';
const STUDENT_SENSITIVE_FIELDS = ['mobile', 'email', 'address', 'aadharNumber', 'guardianPhone', 'guardianEmail'];
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
      console.warn('[StudentUser] STUDENT_DATA_ENCRYPTION_KEY not set. Using derived fallback key from existing env secret. Set STUDENT_DATA_ENCRYPTION_KEY explicitly for production key management.');
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
  if (fromBase64.length === 32) {
    return fromBase64;
  }

  return crypto.createHash('sha256').update(raw).digest();
};

const getEncryptionKey = () => resolveEncryptionKey();

const isEncryptedValue = (value) => (
  typeof value === 'string' && value.startsWith(`${ENCRYPTED_PREFIX}:`)
);

const hasSensitiveValues = (target = {}) => {
  if (!target || typeof target !== 'object') return false;
  return STUDENT_SENSITIVE_FIELDS.some((field) => {
    if (!Object.prototype.hasOwnProperty.call(target, field)) return false;
    const value = target[field];
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  });
};

const assertEncryptionConfigured = (target = {}) => {
  if (!hasSensitiveValues(target)) return;
  const key = getEncryptionKey();
  if (key) return;
  if (!warnedDerivedEncryptionKey) {
    warnedDerivedEncryptionKey = true;
    console.error('[StudentUser] Missing/invalid STUDENT_DATA_ENCRYPTION_KEY. Refusing to store sensitive student fields in plaintext.');
  }
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
  if (!key || typeof value !== 'string' || !isEncryptedValue(value)) {
    return value;
  }

  const parts = value.split(':');
  if (parts.length !== 5) return value;
  const iv = Buffer.from(parts[2], 'base64');
  const tag = Buffer.from(parts[3], 'base64');
  const encrypted = Buffer.from(parts[4], 'base64');

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    return value;
  }
};

const encryptPayloadFields = (target = {}) => {
  if (!target || typeof target !== 'object') return;
  assertEncryptionConfigured(target);
  const key = getEncryptionKey();
  STUDENT_SENSITIVE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(target, field)) {
      target[field] = encryptFieldValue(target[field], key);
    }
  });
};

const decryptDocFields = (doc = null) => {
  if (!doc) return;
  STUDENT_SENSITIVE_FIELDS.forEach((field) => {
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

const attendanceSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['present', 'absent'], required: true },
  subject: { type: String }, // Optional, for subject-specific attendance
});

const studentUserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
  campusId: { type: String, default: null },
  campusName: { type: String, default: null },
  campusType: { type: String, default: null },
  studentCode: { type: String },
  initialPassword: { type: String, default: "" },
  name: String,
  grade: String,
  section: String,
  roll: Number,
  gender: { type: String, enum: ["male", "female", "other"], default: "male" },
  dob: String,
  admissionDate: Date,
  admissionNumber: String,
  academicYear: String,
  batchCode: String,
  course: String,
  courseId: String,
  duration: String,
  formNo: String,
  enrollmentNo: String,
  serialNo: String,
  status: { type: String, default: "Active" },
  mobile:  String,
  email: String,
  address: String,
  permanentAddress: String,
  pinCode: String,
  profilePic: { type: String, default: "" },
  birthPlace: String,
  bloodGroup: String,
  caste: String,
  category: String,
  nationality: String,
  religion: String,
  fatherName: String,
  fatherPhone: String,
  fatherOccupation: String,
  motherName: String,
  motherPhone: String,
  motherOccupation: String,
  guardianName: String,
  guardianPhone: String,
  guardianEmail: String,
  knownHealthIssues: String,
  allergies: String,
  immunizationStatus: String,
  learningDisabilities: String,
  aadharNumber: String,
  birthCertificateNo: String,
  previousSchoolName: String,
  previousClass: String,
  previousPercentage: String,
  transferCertificateNo: String,
  transferCertificateDate: String,
  reasonForLeaving: String,
  applicationId: String,
  applicationDate: String,
  approvalStatus: String,
  remarks: String,
  lastLoginAt: { type: Date, default: null },
  isArchived: { type: Boolean, default: false },
  archivedAt: { type: Date, default: null },
  archivedPlacement: {
    grade: { type: String, default: '' },
    section: { type: String, default: '' },
    roll: { type: Number, default: null },
    previousStatus: { type: String, default: '' },
  },


  // Embedded attendance array
  attendance: [attendanceSchema],

  achievements: [{
    title: { type: String, required: true },
    category: { type: String, enum: ['Academic', 'Extra-Curricular', 'Sports', 'Other'], default: 'Academic' },
    date: { type: Date, default: Date.now },
    description: { type: String },
    awardType: { type: String }, // e.g., Certificate, Medal, Trophy
    issuer: { type: String }, // e.g., School Name, Association
    certificateUrl: { type: String }
  }],
}, { timestamps: true });

studentUserSchema.index({ organizationId: 1, username: 1 }, { unique: true });
studentUserSchema.index(
  { organizationId: 1, studentCode: 1 },
  { unique: true, partialFilterExpression: { studentCode: { $type: 'string' } } }
);

studentUserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  const payload = {};
  STUDENT_SENSITIVE_FIELDS.forEach((field) => {
    if (this.isModified(field)) {
      payload[field] = this[field];
    }
  });
  assertEncryptionConfigured(payload);
  const key = getEncryptionKey();
  STUDENT_SENSITIVE_FIELDS.forEach((field) => {
    if (this.isModified(field)) {
      this[field] = encryptFieldValue(this[field], key);
    }
  });
  return next();
});

studentUserSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() || {};
  const nextPassword = update.password || (update.$set && update.$set.password);
  if (nextPassword) {
    const hashed = await hashPasswordIfNeeded(nextPassword);
    if (update.password) update.password = hashed;
    if (update.$set && update.$set.password) update.$set.password = hashed;
  }

  encryptPayloadFields(update);
  if (update.$set) encryptPayloadFields(update.$set);
  if (update.$setOnInsert) encryptPayloadFields(update.$setOnInsert);

  this.setUpdate(update);
  return next();
});

studentUserSchema.pre('updateOne', function (next) {
  const update = this.getUpdate() || {};
  encryptPayloadFields(update);
  if (update.$set) encryptPayloadFields(update.$set);
  if (update.$setOnInsert) encryptPayloadFields(update.$setOnInsert);
  this.setUpdate(update);
  return next();
});

studentUserSchema.pre('updateMany', function (next) {
  const update = this.getUpdate() || {};
  encryptPayloadFields(update);
  if (update.$set) encryptPayloadFields(update.$set);
  if (update.$setOnInsert) encryptPayloadFields(update.$setOnInsert);
  this.setUpdate(update);
  return next();
});

studentUserSchema.pre('insertMany', function (next, docs = []) {
  docs.forEach((doc) => encryptPayloadFields(doc));
  return next();
});

studentUserSchema.post('init', function (doc) {
  decryptDocFields(doc);
});

studentUserSchema.post('save', function (doc) {
  decryptDocFields(doc);
});

studentUserSchema.post('find', function (docs) {
  if (!Array.isArray(docs)) return;
  docs.forEach((doc) => decryptDocFields(doc));
});

studentUserSchema.post('findOne', function (doc) {
  decryptDocFields(doc);
});

studentUserSchema.post('findOneAndUpdate', function (doc) {
  decryptDocFields(doc);
});

module.exports = mongoose.model('StudentUser', studentUserSchema);  
