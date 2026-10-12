const mongoose = require('mongoose');

// One daily health / wellbeing check-in per student, recorded by a teacher from
// the Student Health Records page (single quick entry or bulk entry).
const studentHealthLogSchema = new mongoose.Schema({
  schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'School',      required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  date:      { type: String, required: true }, // YYYY-MM-DD (school-local day)

  overallStatus: { type: String, enum: ['good', 'moderate', 'at_risk'], default: 'good' },
  issueToday:    { type: String, enum: ['no', 'yes', 'maybe'], default: 'no' },
  issueTag:      { type: String, enum: ['none', 'headache', 'fatigue', 'fever', 'stomach_ache', 'other'], default: 'none' },
  mood:          { type: Number, min: 0, max: 100, default: null },
  behavior:      { type: Number, min: 0, max: 100, default: null },
  notes:         { type: String, default: '', maxlength: 200 },
}, { timestamps: true });

studentHealthLogSchema.index({ studentId: 1, date: 1 }, { unique: true });
studentHealthLogSchema.index({ schoolId: 1, date: -1 });

module.exports = mongoose.model('StudentHealthLog', studentHealthLogSchema);
