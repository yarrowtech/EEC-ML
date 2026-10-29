const mongoose = require('mongoose');

const teacherFeedbackSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    campusId: { type: String, default: null },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
    studentName: { type: String, default: '' },
    isAnonymous: { type: Boolean, default: false },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
    className: { type: String, default: '' },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', default: null },
    sectionName: { type: String, default: '' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', required: true },
    teacherName: { type: String, default: '' },
    teacherProfilePic: { type: String, default: '' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    subjectName: { type: String, required: true },
    ratings: {
      teaching_quality: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },
      engagement: { type: Number, min: 1, max: 5 },
      preparation: { type: Number, min: 1, max: 5 },
      availability: { type: Number, min: 1, max: 5 },
      fairness: { type: Number, min: 1, max: 5 }
    },
    overallRating: { type: Number, min: 1, max: 5 },
    // Who gave it: the student, or a parent on behalf of that child (studentId).
    respondentType: { type: String, enum: ['student', 'parent'], default: 'student', index: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ParentUser', default: null },
    comments: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('TeacherFeedback', teacherFeedbackSchema);
