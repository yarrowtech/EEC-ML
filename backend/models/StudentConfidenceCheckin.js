const mongoose = require('mongoose');

// One row per student self-confidence rating on a topic, snapshotting the
// actual mastery score at that moment so over/under-confidence can be
// measured directly instead of guessed at.
const studentConfidenceCheckinSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  subject: { type: String, default: '' },
  topicId: { type: String, required: true },
  topicTitle: { type: String, default: '' },

  confidenceRating: { type: Number, min: 1, max: 5, required: true },      // raw 1-5 self-report
  confidencePercent: { type: Number, min: 0, max: 100, required: true },   // rating rescaled to 0-100
  masteryScoreAtCheckin: { type: Number, min: 0, max: 100, default: null }, // null when no mastery record exists yet
  calibrationGap: { type: Number, default: null },   // confidencePercent - masteryScoreAtCheckin
  calibrationLabel: {
    type: String,
    enum: ['overconfident', 'underconfident', 'calibrated', 'insufficient_data'],
    default: 'insufficient_data',
  },

  source: { type: String, enum: ['post_quiz', 'post_practice', 'tutor_prompt', 'manual'], default: 'manual' },
}, { timestamps: true });

studentConfidenceCheckinSchema.index({ studentId: 1, subject: 1, topicId: 1, createdAt: -1 });
studentConfidenceCheckinSchema.index({ schoolId: 1, studentId: 1, createdAt: -1 });

module.exports = mongoose.model('StudentConfidenceCheckin', studentConfidenceCheckinSchema);
