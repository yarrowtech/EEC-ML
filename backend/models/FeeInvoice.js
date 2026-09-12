const mongoose = require('mongoose');

const feeInvoiceSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    className: { type: String, trim: true },
    section: { type: String, trim: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true },
    feeStructureId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeStructure' },
    title: { type: String, required: true, trim: true },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    balanceAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    discountNote: { type: String, trim: true },
    lateFeeRuleSnapshot: {
      amount: { type: Number, default: 0, min: 0 },
    },
    lateFeeAmountApplied: { type: Number, default: 0, min: 0 },
    lateFeeAppliedAt: { type: Date },
    feeHeadsSnapshot: [
      {
        label: { type: String, required: true, trim: true },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    installmentsSnapshot: [
      {
        label: { type: String, required: true, trim: true },
        amount: { type: Number, required: true, min: 0 },
        dueDate: { type: Date },
      },
    ],
    status: { type: String, enum: ['due', 'partial', 'paid'], default: 'due' },
    dueDate: { type: Date },
  },
  { timestamps: true }
);

// GET /api/fees/invoices filters by schoolId (+ optional studentId) and sorts
// by createdAt — this collection had no index covering that at all (only
// organizationId and two nested snapshot fields), forcing a full collection
// scan + in-memory sort on every call.
feeInvoiceSchema.index({ schoolId: 1, createdAt: -1 });
feeInvoiceSchema.index({ schoolId: 1, studentId: 1 });

module.exports = mongoose.model('FeeInvoice', feeInvoiceSchema);
