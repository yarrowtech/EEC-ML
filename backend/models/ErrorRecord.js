const mongoose = require('mongoose');

// Stores every wrong answer a student gives, classified by error type.
// Powers the Error Classification Engine and teacher error history view.
const errorRecordSchema = new mongoose.Schema({
  schoolId:      { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  questionId:    { type: String, default: '' },
  questionText:  { type: String, required: true },
  correctAnswer: { type: String, default: '' },
  studentAnswer: { type: String, default: '' },
  // Concept: wrong knowledge | Calculation: arithmetic slip | Reading: misread question | Logic: flawed reasoning
  errorType:     { type: String, enum: ['Concept', 'Calculation', 'Reading', 'Logic'], required: true },
  subject:       { type: String, default: '' },
  subjectId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
  topicTitle:    { type: String, default: '' },
  chapterTitle:  { type: String, default: '' },
  source:        { type: String, enum: ['practice', 'practice_paper', 'exam', 'quiz'], default: 'practice' },
  attemptedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

errorRecordSchema.index({ studentId: 1, subject: 1, errorType: 1 });
errorRecordSchema.index({ schoolId: 1, errorType: 1, subject: 1 });

module.exports = mongoose.model('ErrorRecord', errorRecordSchema);
