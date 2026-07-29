const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  order:           { type: Number, required: true },
  title:           { type: String, required: true },
  description:     { type: String, default: '' },
  estimatedWeeks:  { type: Number, default: 1 },
}, { _id: true });

const curriculumMapSchema = new mongoose.Schema({
  schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  subject:   { type: String, required: true },
  className: { type: String, required: true },
  section:   { type: String, default: '' },
  topics:    [topicSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser' },
}, { timestamps: true });

curriculumMapSchema.index({ schoolId: 1, subject: 1, className: 1, section: 1 }, { unique: true });

module.exports = mongoose.model('CurriculumMap', curriculumMapSchema);
