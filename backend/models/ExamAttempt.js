const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId:   { type: mongoose.Schema.Types.ObjectId, ref: 'ExamQuestion', required: true },
  studentAnswer: { type: String, default: '' },
  isCorrect:    { type: Boolean, default: null },
  marksAwarded: { type: Number, default: 0 },
  topicTitle:   { type: String, default: '' },
  subject:      { type: String, default: '' },
}, { _id: false });

const examAttemptSchema = new mongoose.Schema({
  schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  campusId:    { type: String, default: null },
  examId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  answers:     [answerSchema],
  totalMarks:  { type: Number, default: 0 },
  marksScored: { type: Number, default: 0 },
  percentage:  { type: Number, default: 0 },
  startedAt:   { type: Date, default: Date.now },
  submittedAt: { type: Date },
  status:      { type: String, enum: ['in_progress', 'submitted', 'timed_out'], default: 'in_progress' },
  isMock:      { type: Boolean, default: false },
}, { timestamps: true });

examAttemptSchema.index({ examId: 1, studentId: 1 }, { unique: true });
module.exports = mongoose.model('ExamAttempt', examAttemptSchema);
