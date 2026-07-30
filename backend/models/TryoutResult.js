const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: { type: String, default: '' },
  questionType: { type: String, default: '' },
  questionText: { type: String, default: '' },
  answer: { type: mongoose.Schema.Types.Mixed, default: null },
  isCorrect: { type: Boolean, default: null },
  autoScore: { type: Number, default: null },
}, { _id: false });

const tryoutResultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  subjectName: { type: String, default: '' },
  chapterTitle: { type: String, default: '' },
  topicTitle: { type: String, default: '' },
  answers: [answerSchema],
  totalQuestions: { type: Number, default: 0 },
  autoGradedCount: { type: Number, default: 0 },
  autoScore: { type: Number, default: null },
  teacherScore: { type: Number, default: null },
  teacherFeedback: { type: String, default: '' },
  status: { type: String, enum: ['submitted', 'graded'], default: 'submitted' },
}, { timestamps: true });

tryoutResultSchema.index({ schoolId: 1, topicTitle: 1 });
tryoutResultSchema.index({ studentId: 1, topicTitle: 1 });

module.exports = mongoose.model('TryoutResult', tryoutResultSchema);
