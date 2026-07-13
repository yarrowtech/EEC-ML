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
    customDomains: [{ type: String, lowercase: true, trim: true }],
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null, index: true },
  },
  { timestamps: true, skipTenantScope: true }
);

organizationSchema.index({ customDomains: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Organization', organizationSchema);
