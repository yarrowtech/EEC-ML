const mongoose = require('mongoose');

const teacherTaskAcknowledgementSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', required: true },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

teacherTaskAcknowledgementSchema.index(
  { schoolId: 1, teacherId: 1, assignmentId: 1 },
  { unique: true, name: 'unique_teacher_assignment_acknowledgement' }
);

module.exports = mongoose.model('TeacherTaskAcknowledgement', teacherTaskAcknowledgementSchema);
