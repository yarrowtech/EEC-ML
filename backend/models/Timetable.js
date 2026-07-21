const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema(
  {
    dayOfWeek: { type: String, required: true, trim: true },
    period: { type: Number, required: true, min: 1 },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser' },
    startTime: { type: String, trim: true },
    endTime: { type: String, trim: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    room: { type: String, trim: true },
    isBreak: { type: Boolean, default: false },
  },
  { _id: false }
);

const timetableSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    campusId: { type: String, default: null, index: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    entries: [entrySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Timetable', timetableSchema);
