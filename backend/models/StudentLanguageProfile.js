const mongoose = require('mongoose');

const studentLanguageProfileSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentUser',
      required: true,
      unique: true,
    },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    campusId: { type: mongoose.Schema.Types.ObjectId },
    reading: {
      averageOverall: { type: Number, default: 0 },
      averagePronunciation: { type: Number, default: 0 },
      averageFluency: { type: Number, default: 0 },
      averageConfidence: { type: Number, default: 0 },
      averageSpeed: { type: Number, default: 0 }, // wpm
      totalAttempts: { type: Number, default: 0 },
      commonMispronunciations: [String],
      persistentWeakAreas: [String],
      strongAreas: [String],
    },
    writing: {
      averageOverall: { type: Number, default: 0 },
      averageGrammar: { type: Number, default: 0 },
      averageVocabulary: { type: Number, default: 0 },
      averageCoherence: { type: Number, default: 0 },
      totalAttempts: { type: Number, default: 0 },
      commonGrammarErrors: [String],
      persistentWeakAreas: [String],
      strongAreas: [String],
      cefrLevel: { type: String, default: 'A1' },
    },
    adaptiveSuggestions: [String],
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

studentLanguageProfileSchema.index({ schoolId: 1 });

module.exports = mongoose.model('StudentLanguageProfile', studentLanguageProfileSchema);
