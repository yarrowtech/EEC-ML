const mongoose = require('mongoose');

// Remembers where a student's adaptive practice difficulty settled for a topic,
// so the next session resumes at the right rung instead of restarting from the
// mastery-band default.
const adaptivePracticeStateSchema = new mongoose.Schema({
  schoolId:   { type: mongoose.Schema.Types.ObjectId, ref: 'School',      required: true, index: true },
  studentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  subject:    { type: String, default: '' },
  topicId:    { type: String, default: '' },
  topicTitle: { type: String, default: '' },

  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  bloomLevel: { type: String, default: 'understand' },
  questionsAnswered: { type: Number, default: 0 },
  correctCount:      { type: Number, default: 0 },
  lastSessionAt:     { type: Date, default: Date.now },
}, { timestamps: true });

adaptivePracticeStateSchema.index({ studentId: 1, subject: 1, topicId: 1 }, { unique: true });

module.exports = mongoose.model('AdaptivePracticeState', adaptivePracticeStateSchema);
