const mongoose = require('mongoose');

// Teacher follow-up actions on a student's wellbeing (talked to student,
// informed parent, …). `confidential` notes are only shown to teachers.
const studentHealthInterventionSchema = new mongoose.Schema({
  schoolId:     { type: mongoose.Schema.Types.ObjectId, ref: 'School',      required: true, index: true },
  studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  teacherId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  type:         { type: String, enum: ['Talked to student', 'Informed parent', 'Sent to counselor'], default: 'Talked to student' },
  date:         { type: String, required: true }, // YYYY-MM-DD
  followUpDate: { type: String, default: '' },
  notes:        { type: String, default: '', maxlength: 1000 },
  confidential: { type: Boolean, default: false },
}, { timestamps: true });

studentHealthInterventionSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('StudentHealthIntervention', studentHealthInterventionSchema);
