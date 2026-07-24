const mongoose = require('mongoose');

const nodeSchema = new mongoose.Schema(
  {
    idx: { type: Number, required: true },
    title: { type: String, required: true },
    bloom: { type: String, default: '' },
    tier: { type: String, enum: ['blue', 'orange', 'purple', 'green'], default: 'blue' },
    hasLesson: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'locked', 'done'], default: 'locked' },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const teacherLearningPathSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeacherUser',
      required: true,
      index: true,
    },
    teacherName: { type: String, default: '' },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentUser',
      required: true,
      index: true,
    },
    studentName: { type: String, default: '' },
    cls: { type: String, default: '' },
    subject: { type: String, required: true },
    focus: { type: String, default: '' },
    pace: { type: String, default: '1 week' },
    notes: { type: String, default: '' },
    nodes: { type: [nodeSchema], default: [] },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    status: {
      type: String,
      enum: ['published', 'archived'],
      default: 'published',
      index: true,
    },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One live path per student-subject per teacher (unique on published paths)
teacherLearningPathSchema.index(
  { schoolId: 1, teacherId: 1, studentId: 1, subject: 1, status: 1 },
  { unique: false }
);

// Fast lookup for the student portal
teacherLearningPathSchema.index({ studentId: 1, status: 1 });

module.exports = mongoose.model('TeacherLearningPath', teacherLearningPathSchema);
