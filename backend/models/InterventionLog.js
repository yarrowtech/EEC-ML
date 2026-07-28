const mongoose = require('mongoose');

const interventionLogSchema = new mongoose.Schema({
  schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  campusId:    { type: String, default: null },
  teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', required: true, index: true },
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  studentName: { type: String, default: '' },
  riskLevel:   { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  reason:      { type: String, required: true },
  action:      { type: String, required: true },
  notes:       { type: String, default: '' },
  scheduledDate: { type: Date, default: null },
  status:      { type: String, enum: ['planned', 'in_progress', 'completed', 'cancelled'], default: 'planned' },
  outcome:     { type: String, default: '' },
  resolvedAt:  { type: Date, default: null },
  improvement: { type: Number, default: null }, // % score change after intervention
}, { timestamps: true });

interventionLogSchema.index({ schoolId: 1, teacherId: 1, createdAt: -1 });
interventionLogSchema.index({ schoolId: 1, studentId: 1 });
module.exports = mongoose.model('InterventionLog', interventionLogSchema);
