const mongoose = require('mongoose');

// Immutable audit record for every assessment-driven mastery change.
const masteryEventSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  subject: { type: String, required: true },
  topicId: { type: String, required: true },
  topicTitle: { type: String, default: '' },
  chapterTitle: { type: String, default: '' },
  eventKey: { type: String },
  source: { type: String, enum: ['baseline', 'tutor', 'practice', 'practice-paper', 'exam', 'assignment', 'decay', 'self-report'], required: true },
  scoreBefore: { type: Number, min: 0, max: 100, default: null },
  assessmentScore: { type: Number, min: 0, max: 100, required: true },
  scoreAfter: { type: Number, min: 0, max: 100, required: true },
  attemptCount: { type: Number, min: 1, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

masteryEventSchema.index({ eventKey: 1 }, { unique: true, sparse: true });
masteryEventSchema.pre('save', function () {
  if (!this.isNew) throw new Error('Mastery events are append-only');
});
for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
  masteryEventSchema.pre(operation, function () { throw new Error('Mastery events are append-only'); });
}

masteryEventSchema.index({ studentId: 1, subject: 1, topicId: 1, createdAt: -1 });
masteryEventSchema.index({ schoolId: 1, source: 1, createdAt: -1 });

module.exports = mongoose.model('MasteryEvent', masteryEventSchema);
