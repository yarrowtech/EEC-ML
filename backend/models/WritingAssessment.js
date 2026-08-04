const mongoose = require('mongoose');

const correctionSchema = new mongoose.Schema(
  {
    original: String,
    corrected: String,
    type: String, // 'grammar', 'spelling', 'verb_tense', 'punctuation', etc.
    explanation: String,
  },
  { _id: false }
);

const writingAssessmentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true },
    promptId: { type: mongoose.Schema.Types.ObjectId, ref: 'WritingPrompt', required: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    campusId: { type: mongoose.Schema.Types.ObjectId },
    submission: { type: String, required: true },
    wordCount: { type: Number, default: 0 },
    characterCount: { type: Number, default: 0 },
    scores: {
      overall: { type: Number, default: 0 },
      grammar: { type: Number, default: 0 },
      vocabulary: { type: Number, default: 0 },
      tone: { type: Number, default: 0 },
      coherence: { type: Number, default: 0 },
      verb_tense: { type: Number, default: 0 },
      sentence_structure: { type: Number, default: 0 },
      creativity: { type: Number, default: 0 },
    },
    suggestions: [String],
    corrections: [correctionSchema],
    improvedVersion: { type: String, default: '' },
    cefrLevel: { type: String, default: '' },
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

writingAssessmentSchema.index({ studentId: 1, createdAt: -1 });
writingAssessmentSchema.index({ schoolId: 1, promptId: 1 });

module.exports = mongoose.model('WritingAssessment', writingAssessmentSchema);
