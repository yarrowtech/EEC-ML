const mongoose = require('../utils/registerTenantPlugin');

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    },
    domain: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logo: { type: String, default: '' },
    favicon: { type: String, default: '' },
    primaryColor: { type: String, default: '#2563eb', match: /^#[0-9a-f]{6}$/i },
    secondaryColor: { type: String, default: '#0f172a', match: /^#[0-9a-f]{6}$/i },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    subscription: { type: mongoose.Schema.Types.Mixed, default: {} },
    paymentGateway: {
      provider: { type: String, enum: ['razorpay'], default: 'razorpay' },
      enabled: { type: Boolean, default: false },
      // Which mode's credentials are actually used to process real payments.
      mode: { type: String, enum: ['test', 'live'], default: 'test' },
      razorpay: {
        accountEmail: { type: String, trim: true, lowercase: true, default: '' },
        accountName: { type: String, trim: true, default: '' },
        // Test and live keys are stored independently so switching modes
        // never mixes one mode's credentials into the other's fields.
        test: {
          keyId: { type: String, trim: true, default: '' },
          // Encrypted AES-256-GCM envelopes. Explicit selection prevents accidental leaks.
          keySecret: { type: String, default: '', select: false },
          webhookSecret: { type: String, default: '', select: false },
          // Last-4-chars preview, safe to return to the browser at rest —
          // lets the settings UI show "a secret is saved" without decrypting.
          keySecretPreview: { type: String, default: '' },
          webhookSecretPreview: { type: String, default: '' },
          connectedAt: { type: Date, default: null },
          lastVerifiedAt: { type: Date, default: null },
        },
        live: {
          keyId: { type: String, trim: true, default: '' },
          keySecret: { type: String, default: '', select: false },
          webhookSecret: { type: String, default: '', select: false },
          keySecretPreview: { type: String, default: '' },
          webhookSecretPreview: { type: String, default: '' },
          connectedAt: { type: Date, default: null },
          lastVerifiedAt: { type: Date, default: null },
        },
      },
    },
    customDomains: [{ type: String, lowercase: true, trim: true }],
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null, index: true },
  },
  { timestamps: true, skipTenantScope: true }
);

organizationSchema.index({ customDomains: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Organization', organizationSchema);
