const mongoose = require('mongoose');

const practiceQuestionSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    campusId: { type: String, default: null, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    type: { type: String, enum: ['mcq', 'blank', 'true_false', 'matching'], required: true, index: true },
    question: { type: String, required: true },
    options: [{ type: String }],
    matchingLeft: [{ type: String }],
    correctAnswer: { type: String, required: true },
    explanation: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

practiceQuestionSchema.index({ schoolId: 1, campusId: 1, classId: 1, sectionId: 1, subjectId: 1, type: 1 });

module.exports = mongoose.model('PracticeQuestion', practiceQuestionSchema);
