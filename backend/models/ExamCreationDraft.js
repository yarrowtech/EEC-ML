const mongoose = require('mongoose');

/**
 * A partially-completed "Create Exam" wizard that an admin saved to resume later.
 * Nothing here creates real ExamGroup/Exam documents — the whole wizard state
 * (exam details, selected classes/sections, chosen subjects, schedule) is kept
 * as an opaque blob in `data` so the front-end can rehydrate the wizard exactly
 * as it was left.
 */
const examCreationDraftSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    campusId: { type: String, default: null, index: true },
    createdBy: { type: String, default: '' }, // admin id / username, for display only
    label: { type: String, default: '', trim: true }, // exam title, or "Untitled draft"
    step: { type: Number, default: 1, min: 1 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

examCreationDraftSchema.index({ schoolId: 1, campusId: 1, updatedAt: -1 });

module.exports = mongoose.model('ExamCreationDraft', examCreationDraftSchema);
