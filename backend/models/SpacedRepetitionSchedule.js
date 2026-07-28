const mongoose = require('mongoose');

const spacedRepetitionScheduleSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  subject: { type: String, required: true },
  topicTitle: { type: String, required: true },
  chapterTitle: { type: String, default: '' },
  stage: { type: Number, default: 0, min: 0, max: 4 },
  intervalDays: { type: Number, default: 1 },
  lastScore: { type: Number, default: null },
  lastReviewedAt: { type: Date, default: null },
  nextReviewDate: { type: Date, required: true, index: true },
}, { timestamps: true });

spacedRepetitionScheduleSchema.index({ studentId: 1, subject: 1, topicTitle: 1 }, { unique: true });

module.exports = mongoose.model('SpacedRepetitionSchedule', spacedRepetitionScheduleSchema);
