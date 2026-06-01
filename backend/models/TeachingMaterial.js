const mongoose = require('mongoose');

// Quiz question subdocument
const quizQuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  questionType: {
    type: String,
    enum: ['multiple_choice', 'true_false', 'short_answer'],
    default: 'multiple_choice'
  },
  options: [{
    text: { type: String, required: true },
    isCorrect: { type: Boolean, default: false }
  }],
  correctAnswer: { type: String, default: '' }, // For true/false or short answer
  points: { type: Number, default: 1 },
  explanation: { type: String, default: '' },
  order: { type: Number, default: 0 }
}, { _id: true });

// Poll subdocument
const pollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{
    text: { type: String, required: true },
    votes: { type: Number, default: 0 }
  }],
  allowMultiple: { type: Boolean, default: false },
  expiresAt: { type: Date, default: null },
  responses: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser' },
    selectedOptions: [Number], // Array of option indexes
    respondedAt: { type: Date, default: Date.now }
  }]
}, { _id: true });

// Version history subdocument
const versionSchema = new mongoose.Schema({
  versionNumber: { type: Number, required: true },
  content: { type: String, default: '' }, // HTML content
  title: { type: String, required: true },
  attachments: [{
    name: String,
    url: String,
    size: Number,
    type: String
  }],
  editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser' },
  editedAt: { type: Date, default: Date.now },
  changeDescription: { type: String, default: '' }
}, { _id: true });

// Main TeachingMaterial schema
const teachingMaterialSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  campusId: { type: String, default: null, index: true },

  // Content
  title: {
    type: String,
    required: true,
    trim: true,
    index: 'text',
    minlength: 1,
    maxlength: 500
  },
  content: {
    type: String,
    default: ''
  }, // Rich HTML content from Quill
  plainTextContent: {
    type: String,
    default: ''
  }, // For search indexing

  // Classification
  materialType: {
    type: String,
    enum: ['note', 'handout', 'worksheet', 'assignment', 'reading', 'video', 'interactive', 'folder'],
    default: 'note',
    index: true
  },
  learningType: {
    type: String,
    enum: ['note', 'pdf', 'ppt', 'video', 'assignment', 'worksheet', 'practice', 'assessment', 'reference', 'mind_map', 'interactive'],
    default: 'note',
    index: true
  },
  typeLabel: {
    type: String,
    default: 'Study Material',
    maxlength: 100
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

  // Organization
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeachingMaterial',
    default: null,
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    index: true,
    maxlength: 50
  }],
  category: {
    type: String,
    enum: ['theory', 'practice', 'revision', 'assessment', 'reference', 'general'],
    default: 'general',
    index: true
  },

  // Ownership
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeacherUser',
    required: true,
    index: true
  },
  teacherName: { type: String, default: '' },

  // Publishing control
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  publishedForStudentPortal: { type: Boolean, default: false, index: true },
  publishedAt: { type: Date, index: true },
  scheduledFor: { type: Date, index: true },
  expiresAt: { type: Date, index: true },

  // Versioning
  currentVersion: { type: Number, default: 1 },
  versions: [versionSchema],
  allowUpdates: { type: Boolean, default: true }, // Lock editing if needed

  // Attachments
  attachments: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number, required: true },
    type: { type: String, required: true },
    cloudinaryPublicId: String, // For deletion if needed
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Interactive content
  hasQuiz: { type: Boolean, default: false },
  quiz: {
    title: String,
    description: String,
    timeLimit: { type: Number, default: null }, // Minutes
    passingScore: { type: Number, default: 70 }, // Percentage
    showCorrectAnswers: { type: Boolean, default: true },
    allowRetakes: { type: Boolean, default: true },
    questions: [quizQuestionSchema]
  },

  hasPoll: { type: Boolean, default: false },
  poll: pollSchema,

  // Student engagement tracking
  views: { type: Number, default: 0 },
  viewedBy: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser' },
    viewCount: { type: Number, default: 1 },
    firstViewedAt: { type: Date, default: Date.now },
    lastViewedAt: { type: Date, default: Date.now },
    timeSpent: { type: Number, default: 0 } // Seconds
  }],

  downloads: { type: Number, default: 0 },
  downloadedBy: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser' },
    downloadCount: { type: Number, default: 1 },
    lastDownloadedAt: { type: Date, default: Date.now },
    attachmentName: String
  }],

  completedBy: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser' },
    completedAt: { type: Date, default: Date.now },
    quizScore: Number, // If quiz exists
    quizAttempts: { type: Number, default: 0 }
  }],

  // Quiz attempts tracking
  quizAttempts: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser' },
    attemptNumber: { type: Number, default: 1 },
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    answers: [{
      questionIndex: { type: Number, required: true },
      selectedAnswer: mongoose.Schema.Types.Mixed, // String or array
      isCorrect: { type: Boolean, default: false },
      pointsEarned: { type: Number, default: 0 }
    }],
    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
    timeSpent: { type: Number, default: 0 } // Seconds
  }],

  // Priority & visibility
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  isPinned: { type: Boolean, default: false }, // Show at top for students

  // Metadata
  estimatedReadTime: { type: Number, default: 0 }, // Minutes
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'intermediate'
  },
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeachingMaterial'
  }],

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
teachingMaterialSchema.index({ schoolId: 1, classId: 1, sectionId: 1, status: 1 });
teachingMaterialSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
teachingMaterialSchema.index({ folderId: 1, createdAt: -1 });
teachingMaterialSchema.index({ tags: 1 });
teachingMaterialSchema.index({ scheduledFor: 1, status: 1 });
teachingMaterialSchema.index({ title: 'text', plainTextContent: 'text' });

// Virtuals
teachingMaterialSchema.virtual('isFolder').get(function() {
  return this.materialType === 'folder';
});

teachingMaterialSchema.virtual('completionRate').get(function() {
  if (!this.completedBy || this.completedBy.length === 0) return 0;
  // To be calculated in application logic based on class size
  return (this.completedBy.length / 100) * 100; // Placeholder
});

// Pre-save middleware
teachingMaterialSchema.pre('save', function(next) {
  // Extract plain text from HTML content for search
  if (this.content) {
    // Remove HTML tags
    this.plainTextContent = this.content
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Estimate read time (average 200 words per minute)
  if (this.plainTextContent) {
    const wordCount = this.plainTextContent.split(/\s+/).length;
    this.estimatedReadTime = Math.ceil(wordCount / 200) || 1;
  }

  next();
});

module.exports = mongoose.model('TeachingMaterial', teachingMaterialSchema);
