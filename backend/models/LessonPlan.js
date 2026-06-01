const mongoose = require('mongoose');

const lessonPlanSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    campusId: { type: String, default: null, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    className: { type: String, default: '' },
    sectionName: { type: String, default: '' },
    teacherName: { type: String, default: '' },
    subject: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    learningObjectives: [{ type: String, trim: true }],
    materialsNeeded: [{ type: String, trim: true }],
    additionalNotes: { type: String, default: '' },
    plannerContent: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ chapters: [] })
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true
    },
    publishedAt: { type: Date, default: null, index: true },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', default: null },
    publishedVersion: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('LessonPlan', lessonPlanSchema);
