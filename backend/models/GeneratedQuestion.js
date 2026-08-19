const mongoose = require('mongoose');

const generatedQuestionSchema = new mongoose.Schema(
  {
    schoolId:   { type: mongoose.Schema.Types.ObjectId, ref: 'School',       required: true, index: true },
    teacherId:  { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser',  required: true, index: true },
    subjectName:  { type: String, default: '' },
    chapterTitle: { type: String, default: '' },
    topicTitle:   { type: String, default: '' },
    questionType: {
      type:    String,
      enum:    ['mcq', 'short_answer', 'long_answer'],
      default: 'mcq',
    },
    questionText: { type: String, required: true },
    options: [
      {
        text:      { type: String },
        isCorrect: { type: Boolean, default: false },
      },
    ],
    modelAnswer:     { type: String, default: '' },
    explanation:     { type: String, default: '' },
    keywords:        [{ type: String }],
    markingCriteria: [{ type: String }],
    bloomLevel:  { type: String, default: '' },
    difficulty:  { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    marks:       { type: Number, default: 1 },
    isApproved:  { type: Boolean, default: false },
    teacherEdited: { type: Boolean, default: false },
    source:      { type: String, default: 'ai_generated' },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

generatedQuestionSchema.index({ schoolId: 1, teacherId: 1, subjectName: 1 });

module.exports = mongoose.model('GeneratedQuestion', generatedQuestionSchema);
