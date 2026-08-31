const mongoose = require('mongoose');

/**
 * A partially-filled "Enroll New Student" form that an admin saved to resume later.
 * This is NOT a StudentUser — no login, no student code, nothing in the students list.
 * The whole wizard state is kept in `data` as an opaque blob so the front-end can
 * rehydrate the form exactly as it was left.
 */
const studentEnrollmentDraftSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    campusId: { type: String, default: null, index: true },
    createdBy: { type: String, default: '' }, // admin id / username, for display only
    label: { type: String, default: '', trim: true }, // student name, or "Untitled draft"
    className: { type: String, default: '', trim: true },
    step: { type: Number, default: 0, min: 0 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

studentEnrollmentDraftSchema.index({ schoolId: 1, campusId: 1, updatedAt: -1 });

module.exports = mongoose.model('StudentEnrollmentDraft', studentEnrollmentDraftSchema);
