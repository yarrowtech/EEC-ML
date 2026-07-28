const mongoose = require('mongoose');

const rubricLevelSchema = new mongoose.Schema({
  label:      { type: String, required: true }, // e.g. "Excellent", "Good", "Needs Work"
  score:      { type: Number, required: true },
  descriptor: { type: String, default: '' },
}, { _id: false });

const rubricCriterionSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  maxScore:    { type: Number, required: true },
  weight:      { type: Number, default: 1 },
  levels:      [rubricLevelSchema],
}, { _id: true });

const rubricSchema = new mongoose.Schema({
  schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  campusId:    { type: String, default: null },
  teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', required: true, index: true },
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  subject:     { type: String, default: '' },
  totalScore:  { type: Number, default: 0 },
  criteria:    [rubricCriterionSchema],
  isTemplate:  { type: Boolean, default: false },
}, { timestamps: true });

rubricSchema.index({ schoolId: 1, teacherId: 1 });
module.exports = mongoose.model('Rubric', rubricSchema);
