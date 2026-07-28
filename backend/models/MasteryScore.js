const mongoose = require('mongoose');

const masteryScoreSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  subject: { type: String, required: true },
  topicId: { type: String, required: true },
  topicTitle: { type: String, default: '' },
  chapterTitle: { type: String, default: '' },
  score: { type: Number, min: 0, max: 100, default: 0 },
  attemptCount: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
}, { timestamps: true });

masteryScoreSchema.index({ studentId: 1, subject: 1, topicId: 1 }, { unique: true });

module.exports = mongoose.model('MasteryScore', masteryScoreSchema);
