const mongoose = require('mongoose');

const aiEvalSchema = new mongoose.Schema({
  score:            { type: Number, default: null },   // 0..1
  marks:            { type: Number, default: null },   // score * question.maxMarks
  feedback:         { type: String, default: '' },
  errorType:        { type: String, default: '' },
  bloomLevel:       { type: String, default: '' },
  missingConcepts:  [{ type: String }],
  confidenceScore:  { type: Number, default: null },
  evaluationMethod: { type: String, default: '' },
  evaluatorVersion: { type: String, default: '' },
  needsReview:      { type: Boolean, default: false },
  latencyMs:        { type: Number, default: null },
}, { _id: false });

const teacherReviewSchema = new mongoose.Schema({
  marks:      { type: Number, default: null },
  feedback:   { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', default: null },
  reviewerName: { type: String, default: '' },
  reviewedAt: { type: Date, default: null },
}, { _id: false });

// One student's answer to a LongAnswerQuestion, plus its AI evaluation and any
// teacher review.
const longAnswerSubmissionSchema = new mongoose.Schema({
  schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'School',            required: true, index: true },
  questionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'LongAnswerQuestion', required: true, index: true },
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser',        required: true, index: true },
  studentName: { type: String, default: '' },

  answerText:  { type: String, required: true },
  wordCount:   { type: Number, default: 0 },
  submittedAt: { type: Date, default: Date.now },
  attemptCount: { type: Number, default: 1 },

  ai:            { type: aiEvalSchema, default: () => ({}) },
  teacherReview: { type: teacherReviewSchema, default: () => ({}) },
  finalMarks:    { type: Number, default: null },
  status:        { type: String, enum: ['evaluating', 'evaluated', 'reviewed', 'failed'], default: 'evaluating' },
  masteryApplied: { type: Boolean, default: false },
}, { timestamps: true });

longAnswerSubmissionSchema.index({ questionId: 1, studentId: 1 }, { unique: true });
longAnswerSubmissionSchema.index({ schoolId: 1, studentId: 1, createdAt: -1 });

module.exports = mongoose.model('LongAnswerSubmission', longAnswerSubmissionSchema);
