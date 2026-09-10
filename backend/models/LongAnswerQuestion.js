const mongoose = require('mongoose');

// A long-answer (written) question a teacher assigns to a class. Students submit
// a free-text response which the AI evaluator scores against the model answer /
// rubric; the teacher can review and override.
const longAnswerQuestionSchema = new mongoose.Schema({
  schoolId:     { type: mongoose.Schema.Types.ObjectId, ref: 'School',      required: true, index: true },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', required: true, index: true },
  teacherName:  { type: String, default: '' },

  subject:      { type: String, default: '' },
  grade:        { type: String, default: '' },   // class name — targeting
  section:      { type: String, default: '' },   // blank = whole grade
  topicId:      { type: String, default: '' },
  topicTitle:   { type: String, default: '' },
  chapterTitle: { type: String, default: '' },
  gradeLevel:   { type: String, default: '' },

  questionText:    { type: String, required: true },
  modelAnswer:     { type: String, default: '' },
  rubric:          { type: String, default: '' },
  markingCriteria: [{ type: String }],
  maxMarks:        { type: Number, default: 10, min: 1, max: 100 },
  bloomTarget:     { type: String, default: '' },

  sourceQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedQuestion', default: null },

  status:      { type: String, enum: ['draft', 'published', 'closed'], default: 'draft' },
  publishedAt: { type: Date, default: null },
  dueDate:     { type: Date, default: null },
  closedAt:    { type: Date, default: null },
}, { timestamps: true });

longAnswerQuestionSchema.index({ schoolId: 1, status: 1, grade: 1, section: 1 });
longAnswerQuestionSchema.index({ schoolId: 1, createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('LongAnswerQuestion', longAnswerQuestionSchema);
