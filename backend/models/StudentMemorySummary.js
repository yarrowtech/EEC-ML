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
    // Legacy subject-agnostic rolling summary (kept for old rows / fallback).
    summary: { type: String, default: '' },
    keyInsights: [{ type: String }],
    // Per-subject rolling memory, keyed by subject name. Nested in this one doc per student
    // so the existing {studentId, schoolId} unique index needs no migration.
    subjectSummaries: {
      type: Map,
      of: new mongoose.Schema(
        {
          summary: { type: String, default: '' },
          keyInsights: [{ type: String }],
          sessionCount: { type: Number, default: 0 },
          lastSummarizedAt: { type: Date },
        },
        { _id: false },
      ),
      default: undefined,
    },
    // How many tutor sessions have been summarised so far.
    sessionCount: { type: Number, default: 0 },
    lastSummarizedAt: { type: Date },
  },
  { timestamps: true }
);

studentMemorySummarySchema.index({ studentId: 1, schoolId: 1 }, { unique: true });

module.exports = mongoose.model('StudentMemorySummary', studentMemorySummarySchema);
