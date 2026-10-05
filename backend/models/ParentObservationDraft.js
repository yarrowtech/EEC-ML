const mongoose = require('mongoose');

// In-progress parent observation (ratings + remarks) — one per parent per
// child, auto-saved from the parent portal and removed once submitted.
const parentObservationDraftSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ParentUser', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true },
    ratings: { type: mongoose.Schema.Types.Mixed, default: {} },
    remarks: { type: mongoose.Schema.Types.Mixed, default: {} },
    openSection: { type: Number, default: 0 },
  },
  { timestamps: true }
);

parentObservationDraftSchema.index({ parentId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('ParentObservationDraft', parentObservationDraftSchema);
