const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, unique: true, sparse: true, trim: true },
    address: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },

    // Registration fields
    campusName: { type: String, trim: true }, // Kept for backward compatibility
    campuses: [{
      name: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
      campusType: { type: String, enum: ['Main', 'Branch'], default: 'Branch' },
      contactPerson: { type: String, trim: true },
      contactPhone: { type: String, trim: true }
    }],
    officialEmail: { type: String, trim: true, lowercase: true },
    contactPersonName: { type: String, trim: true },
    schoolType: {
      type: String,
      enum: ['Public', 'Private', 'Charter', 'International'],
      required: false
    },
    board: {
      type: String,
      enum: ['CBSE', 'ICSE', 'IB', 'IGCSE', 'State Board', 'NIOS', 'Other'],
      required: false
    },
    boardOther: { type: String, trim: true }, // If board is 'Other'
    academicYearStructure: {
      type: String,
      enum: ['Year', 'Semester', 'Trimester', 'Quarter'],
      required: false
    },
    estimatedUsers: {
      type: String,
      enum: [
        'Less than 100',
        '100 \u2013 500',
        '500 \u2013 1,000',
        'More than 1,000',
        '<100',
        '100-500',
        '500-1000',
        '1000+'
      ],
      required: false
    },
    websiteURL: { type: String, trim: true },

    // File storage (Cloudinary URLs)
    logo: {
      public_id: String,
      secure_url: String,
      originalName: String
    },
    verificationDocs: [{
      public_id: String,
      secure_url: String,
      originalName: String,
      uploadedAt: { type: Date, default: Date.now }
    }],

    // Registration status tracking
    registrationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    rejectionReason: { type: String },
    adminNotes: { type: String },

    // Subscription Management
    subscriptionPlan: {
      type: String,
      enum: ['trial', 'basic', 'premium', 'enterprise'],
      default: 'trial'
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'suspended', 'expired', 'cancelled'],
      default: 'active'
    },
    subscriptionStartDate: { type: Date },
    subscriptionEndDate: { type: Date },

    // Commercial tracking
    commercialStatus: {
      type: String,
      enum: ['pending_review', 'verified', 'contacted', 'negotiating',
             'payment_pending', 'paid', 'active', 'suspended'],
      default: 'pending_review'
    },
    salesAssignedTo: { type: String },

    // Payment tracking
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'completed', 'failed'],
      default: 'pending'
    },
    paymentAmount: { type: Number },
    invoiceNumber: { type: String },

    // Activation tracking
    activatedAt: { type: Date },
    activatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },

    // Suspension tracking
    suspendedAt: { type: Date },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    suspensionReason: { type: String },

    // Super Admin notes
    superAdminNotes: { type: String },

    // Feature flags
    features: {
      attendance: { type: Boolean, default: true },
      examinations: { type: Boolean, default: true },
      fees: { type: Boolean, default: true },
      wellbeing: { type: Boolean, default: true },
      alcove: { type: Boolean, default: true },
      aiLearning: { type: Boolean, default: false },
      analytics: { type: Boolean, default: false }
    },

    teacherAttendanceSettings: {
      entryTime: { type: String, default: '09:00' }, // HH:mm
      exitTime: { type: String, default: '17:00' }, // HH:mm
      graceMinutes: { type: Number, default: 0 }, // Minutes allowed after entryTime
    },
    teacherLeaveSettings: {
      casualLeaveDays: { type: Number, default: 12 },
    },
    teacherFeedbackWindows: [{
      sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
      enabled: { type: Boolean, default: false },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
    }],
  },
  { timestamps: true }
);

// Indexes for performance
schoolSchema.index({ registrationStatus: 1, createdAt: -1 });
schoolSchema.index({ officialEmail: 1 });

const deriveInitialCode = (value = '') => {
  const normalized = String(value || '')
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean);
  if (!normalized.length) return '';
  return normalized.map((word) => word[0].toUpperCase()).join('');
};

// Auto-generate school code if not provided
schoolSchema.pre('save', async function autoGenerateSchoolCode(next) {
  if (this.code) return next();

  const baseCode = deriveInitialCode(this.name) || 'SCH';
  let candidate = baseCode;
  let suffix = 1;
  const MAX_ATTEMPTS = 50;

  while (suffix <= MAX_ATTEMPTS) {
    const exists = await this.constructor.findOne({ code: candidate });
    if (!exists) {
      this.code = candidate;
      break;
    }
    candidate = `${baseCode}${suffix}`;
    suffix += 1;
  }

  if (!this.code) {
    this.code = `SCH${Date.now().toString().slice(-6)}`;
  }

  next();
});

module.exports = mongoose.model('School', schoolSchema);
