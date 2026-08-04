const mongoose = require('mongoose');

const studentMemorySummarySchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentUser',
      required: true,
      index: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    // Rolling LLM-generated summary of past learning sessions.
    // Updated after each session that crosses the turn threshold.
    summary: { type: String, default: '' },
    // Extracted bullet-point key facts about this student's learning patterns.
    keyInsights: [{ type: String }],
    // How many tutor sessions have been summarised so far.
    sessionCount: { type: Number, default: 0 },
    lastSummarizedAt: { type: Date },
  },
  { timestamps: true }
);

studentMemorySummarySchema.index({ studentId: 1, schoolId: 1 }, { unique: true });

module.exports = mongoose.model('StudentMemorySummary', studentMemorySummarySchema);
