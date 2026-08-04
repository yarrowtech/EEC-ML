const mongoose = require('mongoose');

const readingAssessmentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true },
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReadingMaterial', required: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    campusId: { type: mongoose.Schema.Types.ObjectId },
    transcript: { type: String, default: '' },
    audioDurationSeconds: { type: Number, default: 0 },
    scores: {
      overall: { type: Number, default: 0 },
      pronunciation: { type: Number, default: 0 },
      grammar: { type: Number, default: 0 },
      fluency: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
      accent: { type: Number, default: 0 },
      reading_speed: { type: Number, default: 0 }, // words per minute
    },
    mispronounced_words: [String],
    missed_words: [String],
    extra_words: [String],
    suggestions: [String],
    strengths: [String],
    weaknesses: [String],
    rawEvaluation: { type: mongoose.Schema.Types.Mixed, default: {} },
    embeddingStored: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

readingAssessmentSchema.index({ studentId: 1, createdAt: -1 });
readingAssessmentSchema.index({ schoolId: 1, materialId: 1 });

module.exports = mongoose.model('ReadingAssessment', readingAssessmentSchema);
