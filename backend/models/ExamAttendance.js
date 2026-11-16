const mongoose = require('mongoose');

// One row = one student marked present for one subject exam, recorded when an
// invigilator scans the QR code printed on the student's admit card.
const examAttendanceSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    campusId: { type: String, default: null, index: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamGroup', default: null },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true },
    studentName: { type: String, default: '' },
    username: { type: String, default: '' },
    roll: { type: Number, default: null },
    grade: { type: String, default: '' },
    section: { type: String, default: '' },
    subject: { type: String, default: '' },
    examTitle: { type: String, default: '' },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD (exam date)
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', default: null },
    markedByName: { type: String, default: '' },
    method: { type: String, enum: ['qr', 'manual'], default: 'qr' },
  },
  { timestamps: true }
);

examAttendanceSchema.index({ examId: 1, studentId: 1 }, { unique: true });
examAttendanceSchema.index({ schoolId: 1, date: 1 });

module.exports = mongoose.models.ExamAttendance || mongoose.model('ExamAttendance', examAttendanceSchema);
