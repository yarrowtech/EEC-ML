const mongoose = require('mongoose');

const lessonPlanSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    campusId: { type: String, default: null, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: false, default: null },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: false, default: null },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: false, default: null },
    className: { type: String, default: '' },
    sectionName: { type: String, default: '' },
    teacherName: { type: String, default: '' },
    subject: { type: String, required: false, default: '', trim: true },
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: false, default: null },
    duration: { type: String, default: '' },
    learningObjectives: [{ type: String, trim: true }],
    instructionalFlow: { type: mongoose.Schema.Types.Mixed, default: () => [] },
    explanation: { type: String, default: '' },
    recap: { type: String, default: '' },
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
    isDraft: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date, default: null, index: true },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', default: null },
    publishedVersion: { type: Number, default: 0 },
    rawChapters: {
      type: mongoose.Schema.Types.Mixed,
      default: () => []
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

// Pre-save validation: published plans must have required fields
lessonPlanSchema.pre('save', function(next) {
  if (this.status === 'published' || this.isDraft === false) {
    if (!this.classId) {
      return next(new Error('classId is required for published lesson plans'));
    }
    if (!this.sectionId) {
      return next(new Error('sectionId is required for published lesson plans'));
    }
    if (!this.subjectId) {
      return next(new Error('subjectId is required for published lesson plans'));
    }
    if (!this.date) {
      return next(new Error('date is required for published lesson plans'));
    }
  }
  next();
});

module.exports = mongoose.model('LessonPlan', lessonPlanSchema);
