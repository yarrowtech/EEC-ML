const mongoose = require('mongoose');

const examQuestionSchema = new mongoose.Schema({
  schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  campusId:  { type: String, default: null },
  examId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
  type:      { type: String, enum: ['mcq', 'subjective', 'true_false'], default: 'mcq' },
  question:  { type: String, required: true },
  options:   [{ type: String }],
  answer:    { type: String, default: '' },
  marks:     { type: Number, default: 1 },
  topicTitle:   { type: String, default: '' },
  chapterTitle: { type: String, default: '' },
  subject:      { type: String, default: '' },
  bloomLevel:   { type: String, enum: ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create', ''], default: '' },
  order:        { type: Number, default: 0 },
}, { timestamps: true });

examQuestionSchema.index({ examId: 1, order: 1 });
module.exports = mongoose.model('ExamQuestion', examQuestionSchema);
