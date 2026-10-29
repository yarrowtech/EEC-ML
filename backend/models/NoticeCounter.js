const mongoose = require('mongoose');

// Per-school running sequence for system-generated notice numbers
// (e.g. KSHS/2026-27/FB/001). `key` = "<series>:<session>". Keyed by schoolId
// and opted out of tenant scoping, same as the other counters.
const noticeCounterSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    key: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true, skipTenantScope: true }
);

noticeCounterSchema.index({ schoolId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('NoticeCounter', noticeCounterSchema);
