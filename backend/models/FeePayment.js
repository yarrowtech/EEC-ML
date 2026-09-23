const mongoose = require('mongoose');
require('./FeeReceiptCounter');

const feePaymentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeInvoice', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true },
    transactionId: { type: String, default: null, trim: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR', trim: true },
    method: { type: String, default: 'cash' },
    // Receipt no. (cash), UPI transaction ID, bank UTR/reference no., or card
    // transaction reference — required for manually-recorded methods so
    // there's always a traceable reference on the receipt.
    referenceNumber: { type: String, trim: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
    // System-generated receipt number (RCPT-<year>-<seq>), assigned on first
    // save for every payment method — see the pre('validate') hook below.
    receiptNumber: { type: String, trim: true, default: undefined },
    paidOn: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
    initiatedByType: { type: String, default: null, trim: true },
    initiatedById: { type: mongoose.Schema.Types.ObjectId, default: null },
    gateway: { type: String, default: null },
    gatewayOrderId: { type: String, default: null },
    gatewayPaymentId: { type: String, default: null },
    gatewaySignature: { type: String, default: null },
    gatewayStatus: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

feePaymentSchema.index({ transactionId: 1 }, { unique: true, sparse: true });
feePaymentSchema.index({ gatewayPaymentId: 1 }, { unique: true, sparse: true });
feePaymentSchema.index({ gatewayOrderId: 1 }, { unique: true, sparse: true });
// invoiceId — hit by the admin/summary $group-by-invoice aggregate (every
// invoice's paid total) on every cache-miss request.
feePaymentSchema.index({ invoiceId: 1 });
// schoolId + paidOn — supports the recent-payments query (schoolId/studentId
// filter, sorted by paidOn) without an in-memory sort of the whole collection.
feePaymentSchema.index({ schoolId: 1, paidOn: -1 });
feePaymentSchema.index({ schoolId: 1, studentId: 1 });
feePaymentSchema.index(
  { schoolId: 1, receiptNumber: 1 },
  { unique: true, partialFilterExpression: { receiptNumber: { $type: 'string' } } }
);

const formatReceiptNumber = (year, seq) => `RCPT-${year}-${String(seq).padStart(6, '0')}`;

// Atomically allocates the next receipt number for a school/year.
feePaymentSchema.statics.allocateReceiptNumber = async function allocateReceiptNumber(schoolId, date = new Date()) {
  const FeeReceiptCounter = mongoose.model('FeeReceiptCounter');
  const parsed = new Date(date);
  const year = Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
  const counter = await FeeReceiptCounter.findOneAndUpdate(
    { schoolId, year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return formatReceiptNumber(year, counter.seq);
};

// Assigns a receipt number to any payment that doesn't have one yet, however it
// was created (manual cash/UPI/bank/card, Razorpay checkout, QR, webhook).
feePaymentSchema.pre('validate', async function assignReceiptNumber() {
  if (this.receiptNumber || !this.schoolId) return;
  this.receiptNumber = await this.constructor.allocateReceiptNumber(this.schoolId, this.paidOn || new Date());
});

module.exports = mongoose.model('FeePayment', feePaymentSchema);
