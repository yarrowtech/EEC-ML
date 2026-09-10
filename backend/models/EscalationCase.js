const mongoose = require('mongoose');

const actionSchema = new mongoose.Schema({
  note:   { type: String, default: '' },
  by:     { type: mongoose.Schema.Types.ObjectId, default: null },
  byRole: { type: String, default: '' },
  byName: { type: String, default: '' },
  at:     { type: Date, default: Date.now },
}, { _id: false });

const assigneeSchema = new mongoose.Schema({
  role:   { type: String, default: '' },   // principal | counsellor | class_teacher
  userId: { type: mongoose.Schema.Types.ObjectId, default: null },
  name:   { type: String, default: '' },
}, { _id: false });

// A serious student concern routed to school leadership / counselling for human
// follow-up. Raised automatically from wellbeing + at-risk signals, or manually
// by a teacher.
const escalationCaseSchema = new mongoose.Schema({
  schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'School',      required: true, index: true },
  campusId:    { type: String, default: null },
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  studentName: { type: String, default: '' },

  category: { type: String, enum: ['wellbeing', 'at_risk_academic', 'safeguarding', 'behaviour'], required: true },
  severity: { type: String, enum: ['high', 'critical'], default: 'high' },
  summary:  { type: String, default: '' },
  trigger:  { type: mongoose.Schema.Types.Mixed, default: {} }, // { source, signal, detail }

  status: { type: String, enum: ['open', 'acknowledged', 'in_progress', 'resolved', 'dismissed'], default: 'open', index: true },
  raisedBy:   { type: mongoose.Schema.Types.Mixed, default: { type: 'system' } }, // { type: 'system'|'teacher', id, name }
  assignedTo: [assigneeSchema],

  acknowledgedBy:   { type: mongoose.Schema.Types.ObjectId, default: null },
  acknowledgedByRole: { type: String, default: '' },
  acknowledgedAt:   { type: Date, default: null },
  actions:          [actionSchema],
  resolution:       { type: mongoose.Schema.Types.Mixed, default: null }, // { outcome, note, by, byRole, at }

  dedupeKey: { type: String },
}, { timestamps: true });

// One open auto-raised case per student/category per ISO week.
escalationCaseSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });
escalationCaseSchema.index({ schoolId: 1, status: 1, severity: 1, createdAt: -1 });
escalationCaseSchema.index({ schoolId: 1, studentId: 1, createdAt: -1 });

module.exports = mongoose.model('EscalationCase', escalationCaseSchema);
