const mongoose = require('mongoose');

// Stores SM-2 spaced repetition state per student per flashcard.
// cardHash is a deterministic fingerprint of the question text so the same
// card generated across different sessions is treated as the same item.
const spacedRepetitionSchema = new mongoose.Schema({
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  subject:     { type: String, default: '' },
  topic:       { type: String, default: '' },
  cardHash:    { type: String, required: true },
  cardFront:   { type: String, required: true },
  cardBack:    { type: String, required: true },
  // SM-2 fields
  interval:    { type: Number, default: 1 },     // days until next review
  easeFactor:  { type: Number, default: 2.5 },   // difficulty multiplier
  repetitions: { type: Number, default: 0 },     // consecutive correct reviews
  nextReview:  { type: Date, default: Date.now },
  lastReview:  { type: Date },
}, { timestamps: true });

spacedRepetitionSchema.index({ studentId: 1, cardHash: 1 }, { unique: true });
spacedRepetitionSchema.index({ studentId: 1, nextReview: 1 });

module.exports = mongoose.model('SpacedRepetition', spacedRepetitionSchema);
