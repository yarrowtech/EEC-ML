const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
  questionText:  { type: String, default: '' },
  studentAnswer: { type: String, default: '' },
  correctAnswer: { type: String, default: '' },
  source:        { type: String, default: '' },
  at:            { type: Date, default: Date.now },
}, { _id: false });

// An explicit, per-student model of a recurring misconception on one topic —
// built from repeated wrong answers of the same error type, and auto-resolved
// once the student masters the topic.
const studentMisconceptionSchema = new mongoose.Schema({
  schoolId:   { type: mongoose.Schema.Types.ObjectId, ref: 'School',      required: true, index: true },
  studentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  subject:    { type: String, default: '' },
  topicId:    { type: String, default: '' },
  topicTitle: { type: String, default: '' },
  errorType:  { type: String, enum: ['Concept', 'Calculation', 'Reading', 'Logic', 'Unknown'], default: 'Concept' },

  label:       { type: String, default: '' },   // short human description, e.g. "Concept error on Fractions"
  occurrences: { type: Number, default: 1 },
  evidence:    { type: [evidenceSchema], default: [] },

  status:      { type: String, enum: ['active', 'resolved'], default: 'active', index: true },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt:  { type: Date, default: Date.now },
  resolvedAt:  { type: Date, default: null },
  resolvedByScore: { type: Number, default: null },
}, { timestamps: true });

// One misconception row per (student, subject, topic, errorType).
studentMisconceptionSchema.index(
  { studentId: 1, subject: 1, topicTitle: 1, errorType: 1 },
  { unique: true },
);
studentMisconceptionSchema.index({ schoolId: 1, studentId: 1, status: 1, lastSeenAt: -1 });

module.exports = mongoose.model('StudentMisconception', studentMisconceptionSchema);
