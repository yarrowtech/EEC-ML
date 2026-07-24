const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  submissionText: {
    type: String,
    default: ''
  },
  attachmentUrl: {
    type: String,
    default: ''
  },
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  feedback: String,
  status: {
    type: String,
    enum: ['submitted', 'graded', 'late', 'missing'],
    default: 'submitted'
  }
});

const progressMetricSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true
  },
  averageScore: {
    type: Number,
    default: 0
  },
  totalAssignments: {
    type: Number,
    default: 0
  },
  completedAssignments: {
    type: Number,
    default: 0
  },
  attendanceRate: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

const weaknessAnalysisSchema = new mongoose.Schema({
  subject: String,
  consistencyScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  weakAreas: [String],
  recommendedTopics: [String],
  difficultyLevel: {
    type: String,
    enum: ['basic', 'intermediate', 'advanced'],
    default: 'intermediate'
  },
  lastAnalyzed: {
    type: Date,
    default: Date.now
  }
});

const aiLearningPathSchema = new mongoose.Schema({
  subject: String,
  currentTopic: String,
  focus: String,
  pace: String,
  notes: String,
  cls: String,
  publishedByTeacher: { type: Boolean, default: false },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser' },
  teacherName: String,
  publishedAt: Date,
  nodes: [{
    idx: Number,
    title: String,
    bloom: String,
    tier: String,
    hasLesson: Boolean,
    status: { type: String, enum: ['active', 'locked', 'done'], default: 'locked' },
  }],
  completedTopics: [String],
  recommendedResources: [{
    title: String,
    type: {
      type: String,
      enum: ['video', 'article', 'practice', 'quiz', 'interactive']
    },
    url: String,
    difficulty: String,
    estimatedTime: Number
  }],
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastAccessed: Date
});

const studentProgressSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentUser',
    required: true,
    unique: true
  },
  submissions: [submissionSchema],
  progressMetrics: [progressMetricSchema],
  overallGrade: {
    type: String,
    enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
    default: 'C'
  },
  rank: {
    type: Number,
    default: 0
  },
  improvementTrend: {
    type: String,
    enum: ['improving', 'declining', 'stable'],
    default: 'stable'
  },
  isWeakStudent: {
    type: Boolean,
    default: false
  },
  weaknessAnalysis: [weaknessAnalysisSchema],
  aiLearningPaths: [aiLearningPathSchema],
  needsIntervention: {
    type: Boolean,
    default: false
  },
  interventionLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
studentProgressSchema.index({ 'progressMetrics.subject': 1 });

module.exports = mongoose.model('StudentProgress', studentProgressSchema);
