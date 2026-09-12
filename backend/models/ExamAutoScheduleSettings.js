const mongoose = require('mongoose');

// Per-school (optionally per-campus) settings for the Create Exam wizard's
// Auto-Schedule feature — currently just how many days must separate two
// exams of the same subject for the same class, so Auto-Schedule can space a
// heavy subject like Mathematics out instead of stacking it on consecutive days.
const examAutoScheduleSettingsSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    campusId: { type: String, default: null, index: true },
    subjectGaps: [
      {
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
        gapDays: { type: Number, default: 0, min: 0 },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

examAutoScheduleSettingsSchema.index({ schoolId: 1, campusId: 1 }, { unique: true });

module.exports = mongoose.model('ExamAutoScheduleSettings', examAutoScheduleSettingsSchema);
