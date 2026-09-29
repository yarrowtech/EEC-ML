const mongoose = require('mongoose');

const teacherAttendanceSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    campusId: { type: String, default: null, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', required: true, index: true },
    dateKey: { type: String, required: true, index: true }, // YYYY-MM-DD
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['Present', 'Late', 'Absent', 'Half Day'],
      default: 'Present',
    },
    workingMinutes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

teacherAttendanceSchema.index({ schoolId: 1, campusId: 1, teacherId: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model('TeacherAttendance', teacherAttendanceSchema);
