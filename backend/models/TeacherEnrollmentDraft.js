const mongoose = require('mongoose');

/**
 * A partially-filled "Add Teacher" form that an admin saved to resume later.
 * This is NOT a TeacherUser — no login, no employee code, nothing in the
 * teachers list. The whole form state is kept in `data` as an opaque blob
 * so the front-end can rehydrate the form exactly as it was left.
 * Mirrors models/StudentEnrollmentDraft.js.
 */
const teacherEnrollmentDraftSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    campusId: { type: String, default: null, index: true },
    createdBy: { type: String, default: '' }, // admin id / username, for display only
    label: { type: String, default: '', trim: true }, // teacher name, or "Untitled draft"
    step: { type: Number, default: 0, min: 0 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

teacherEnrollmentDraftSchema.index({ schoolId: 1, campusId: 1, updatedAt: -1 });

module.exports = mongoose.model('TeacherEnrollmentDraft', teacherEnrollmentDraftSchema);
