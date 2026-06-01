const mongoose = require('mongoose');

// Practice paper question subdocument
const practiceQuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  questionType: {
    type: String,
    enum: ['mcq', 'blank', 'true_false', 'short_answer', 'essay'],
    default: 'mcq'
  },
  options: [{
    text: { type: String, required: true },
    isCorrect: { type: Boolean, default: false }
  }],
  correctAnswer: { type: String, default: '' },
  explanation: { type: String, default: '' },
  marks: { type: Number, default: 1 },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  order: { type: Number, default: 0 }
}, { _id: true });

// Main PracticePaper schema
const practicePaperSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  campusId: { type: String, default: null, index: true },

  // Linking to Teaching Material
  teachingMaterialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeachingMaterial',
    index: true
  },

  // Linking to Practice Section (for organization)
  practiceSectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PracticeSection',
    index: true
  },

  // Basic Info
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  description: {
    type: String,
    default: ''
  },

  // Classification
  paperType: {
    type: String,
    enum: ['worksheet', 'quiz', 'mock_test', 'practice_set', 'chapter_test', 'unit_test'],
    default: 'practice_set'
  },

  // Targeting
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    index: true
  },
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true,
    index: true
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    index: true
  },
  className: { type: String, default: '' },
  sectionName: { type: String, default: '' },
  subjectName: { type: String, default: '' },
  chapterId: { type: String, default: '', index: true },
  chapterTitle: { type: String, default: '', index: true },
  topicTitle: { type: String, default: '', index: true },
  subTopicTitle: { type: String, default: '', index: true },
  sourceLessonPlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LessonPlan',
    default: null,
    index: true
  },
  sourceSubTopicId: { type: String, default: '', index: true },

  // Ownership
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeacherUser',
    required: true,
    index: true
  },
  teacherName: { type: String, default: '' },

  // Questions
  questions: [practiceQuestionSchema],
  totalQuestions: { type: Number, default: 0 },
  totalMarks: { type: Number, default: 0 },

  // Timing & Settings
  duration: { type: Number, default: 0 }, // in minutes (0 = unlimited)
  timeLimit: { type: Number, default: null }, // Soft limit reminder
  showCorrectAnswers: { type: Boolean, default: true },
  showResultsImmediately: { type: Boolean, default: true },
  allowRetakes: { type: Boolean, default: true },
  shuffleQuestions: { type: Boolean, default: false },
  shuffleOptions: { type: Boolean, default: false },
  passingPercentage: { type: Number, default: 40 }, // Percentage needed to pass

  // Publishing
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  publishedForStudentPortal: { type: Boolean, default: false, index: true },
  publishedAt: { type: Date, index: true },
  expiresAt: { type: Date, index: true },

  // Tags & Metadata
  tags: [{
    type: String,
    trim: true,
    index: true
  }],
  chapter: { type: String, default: '' },
  unit: { type: String, default: '' },
  topics: [String],
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'mixed'],
    default: 'medium'
  },

  // Student Engagement
  attempts: { type: Number, default: 0 },
  attemptedBy: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser' },
    attemptCount: { type: Number, default: 0 },
    lastAttemptedAt: Date,
    bestScore: Number
  }],

  // Attempt Records
  studentAttempts: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser' },
    attemptNumber: { type: Number, default: 1 },
    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    marksObtained: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    isPassed: Boolean,
    answers: [{
      questionIndex: { type: Number, required: true },
      selectedAnswer: mongoose.Schema.Types.Mixed,
      isCorrect: Boolean,
      marksObtained: { type: Number, default: 0 }
    }],
    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
    timeSpent: { type: Number, default: 0 } // in seconds
  }],

  // Statistics
  averageScore: { type: Number, default: 0 },
  highestScore: { type: Number, default: 0 },
  lowestScore: { type: Number, default: 0 },
  passRate: { type: Number, default: 0 }, // percentage
  totalAttempts: { type: Number, default: 0 },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
practicePaperSchema.index({ schoolId: 1, classId: 1, sectionId: 1, status: 1 });
practicePaperSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
practicePaperSchema.index({ subjectId: 1, status: 1 });
practicePaperSchema.index({ tags: 1 });
practicePaperSchema.index({ paperType: 1, status: 1 });

// Virtuals
practicePaperSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

practicePaperSchema.virtual('completionRate').get(function() {
  if (this.totalQuestions === 0) return 0;
  const totalAttempts = this.studentAttempts.length;
  const uniqueStudents = new Set(this.studentAttempts.map(a => a.studentId.toString())).size;
  return uniqueStudents > 0 ? Math.round((uniqueStudents / 100) * 100) : 0;
});

// Pre-save middleware
practicePaperSchema.pre('save', function(next) {
  // Calculate total questions and marks
  if (this.questions && this.questions.length > 0) {
    this.totalQuestions = this.questions.length;
    this.totalMarks = this.questions.reduce((sum, q) => sum + (q.marks || 1), 0);
  }

  // Recalculate statistics
  if (this.studentAttempts && this.studentAttempts.length > 0) {
    const scores = this.studentAttempts.map(a => a.percentage || 0);
    this.totalAttempts = this.studentAttempts.length;
    this.averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    this.highestScore = Math.max(...scores);
    this.lowestScore = Math.min(...scores);

    const passedAttempts = this.studentAttempts.filter(a =>
      (a.percentage || 0) >= (this.passingPercentage || 40)
    ).length;
    this.passRate = Math.round((passedAttempts / this.studentAttempts.length) * 100);
  }

  next();
});

module.exports = mongoose.model('PracticePaper', practicePaperSchema);
