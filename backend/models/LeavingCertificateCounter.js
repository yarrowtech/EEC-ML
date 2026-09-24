const mongoose = require('mongoose');

// Per-school, per-year running sequence for School Leaving Certificate numbers
// (SLC/<year>/<seq>). Keyed by schoolId (already tenant-unique) and opted out
// of tenant scoping, same as FeeReceiptCounter.
const leavingCertificateCounterSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    year: { type: Number, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true, skipTenantScope: true }
);

leavingCertificateCounterSchema.index({ schoolId: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('LeavingCertificateCounter', leavingCertificateCounterSchema);
