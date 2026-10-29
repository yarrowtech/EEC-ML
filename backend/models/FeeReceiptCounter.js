const mongoose = require('mongoose');

// Per-school, per-year running sequence for fee receipt numbers
// (RCPT-<year>-<seq>). Keyed by schoolId, which is already tenant-unique, and
// opted out of tenant scoping so payment hooks that run outside a request
// context (webhooks, QR polling) can still allocate numbers.
const feeReceiptCounterSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    year: { type: Number, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true, skipTenantScope: true }
);

feeReceiptCounterSchema.index({ schoolId: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('FeeReceiptCounter', feeReceiptCounterSchema);
