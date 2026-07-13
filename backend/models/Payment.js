const mongoose = require('../utils/registerTenantPlugin');

const paymentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
    feeId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeInvoice', required: true, index: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'INR', enum: ['INR'] },
    status: {
      type: String,
      enum: ['created', 'captured', 'failed'],
      default: 'created',
      index: true,
    },
    provider: { type: String, enum: ['razorpay'], default: 'razorpay' },
    providerOrderId: { type: String, required: true, trim: true },
    providerPaymentId: { type: String, default: null, trim: true },
    providerSignature: { type: String, default: null, trim: true, select: false },
    failureReason: { type: String, default: '', trim: true },
    initiatedByType: { type: String, enum: ['student', 'parent', 'admin'], required: true },
    initiatedById: { type: mongoose.Schema.Types.ObjectId, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ organizationId: 1, providerOrderId: 1 }, { unique: true });
paymentSchema.index(
  { organizationId: 1, providerPaymentId: 1 },
  { unique: true, partialFilterExpression: { providerPaymentId: { $type: 'string' } } }
);

module.exports = mongoose.model('Payment', paymentSchema);
