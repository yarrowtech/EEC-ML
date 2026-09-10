const mongoose = require('mongoose');

// Lifecycle record for a study recommendation surfaced to a student:
// issued → (accepted | dismissed) → completed, plus the mastery impact of
// acting on it (baseline frozen at acceptance, post measured on completion).
const recommendationEventSchema = new mongoose.Schema({
  schoolId:      { type: mongoose.Schema.Types.ObjectId, ref: 'School',      required: true, index: true },
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  source:        { type: String, enum: ['next', 'all_subjects', 'student_feed'], default: 'next' },
  type:          { type: String, default: '' },
  subject:       { type: String, default: '' },
  topicId:       { type: String, default: '' },
  topicTitle:    { type: String, default: '' },
  chapterTitle:  { type: String, default: '' },
  action:        { type: String, default: '' },
  reason:        { type: String, default: '' },
  explainability:{ type: String, default: '' },
  dedupeKey:     { type: String },

  status:        { type: String, enum: ['issued', 'accepted', 'dismissed', 'completed', 'expired'], default: 'issued' },
  issuedAt:      { type: Date, default: Date.now },
  respondedAt:   { type: Date, default: null },
  completedAt:   { type: Date, default: null },
  dismissReason: { type: String, default: '' },

  baselineMastery: { type: Number, min: 0, max: 100, default: null },
  postMastery:     { type: Number, min: 0, max: 100, default: null },
  masteryDelta:    { type: Number, default: null },
}, { timestamps: true });

recommendationEventSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });
recommendationEventSchema.index({ schoolId: 1, studentId: 1, status: 1, issuedAt: -1 });
recommendationEventSchema.index({ schoolId: 1, status: 1, respondedAt: 1 });

module.exports = mongoose.model('RecommendationEvent', recommendationEventSchema);
