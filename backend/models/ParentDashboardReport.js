const mongoose = require('mongoose');

const parentDashboardReportSchema = new mongoose.Schema({
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ParentUser', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  type: { type: String, enum: ['weekly_digest', 'monthly_report'], required: true },
  content: { type: String, default: '' },
  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

parentDashboardReportSchema.index({ parentId: 1, studentId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('ParentDashboardReport', parentDashboardReportSchema);
