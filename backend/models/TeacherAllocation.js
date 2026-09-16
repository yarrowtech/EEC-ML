const mongoose = require('mongoose');

const teacherAllocationSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', default: null },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', required: true },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required() {
        return !this.isClassTeacher;
      },
      default: null,
    },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    isClassTeacher: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

teacherAllocationSchema.index(
  { schoolId: 1, campusId: 1, teacherId: 1, subjectId: 1, classId: 1, sectionId: 1 },
  { unique: true, name: 'unique_teacher_allocation' }
);

// /api/student/allocated-subjects reads "all allocations for this class +
// section" without filtering by teacherId — the uniqueness index above
// can't seek on classId/sectionId efficiently since teacherId sits between
// them and campusId in its key order. This index matches that read shape.
teacherAllocationSchema.index({ schoolId: 1, campusId: 1, classId: 1, sectionId: 1 });

module.exports = mongoose.model('TeacherAllocation', teacherAllocationSchema);
