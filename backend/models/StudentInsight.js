const mongoose = require('mongoose');

// Stores AI-generated insights about a student: gap detection results,
// mastery milestones, and other learning signals for teacher dashboards.
const studentInsightSchema = new mongoose.Schema({
  schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'School',       required: true, index: true },
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser',  required: true, index: true },
  insightType: {
    type: String,
    enum: ['gap_detection', 'mastery_milestone', 'at_risk', 'improvement'],
    required: true,
  },
  subject:     { type: String, default: '' },
  title:       { type: String, default: '' },
  summary:     { type: String, default: '' },
  payload:     { type: mongoose.Schema.Types.Mixed, default: {} },
  seenByTeacher: { type: Boolean, default: false },
  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

studentInsightSchema.index({ studentId: 1, insightType: 1, generatedAt: -1 });
studentInsightSchema.index({ schoolId: 1, subject: 1, generatedAt: -1 });

module.exports = mongoose.model('StudentInsight', studentInsightSchema);
