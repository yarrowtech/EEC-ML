const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    campusId: { type: String, default: null, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// Same hot-path reasoning as Class.js — /api/student/allocated-subjects
// does Section.find({ schoolId }) on every Smart Learning page load, and
// {classId} covers the other common "sections for this class" lookups.
sectionSchema.index({ schoolId: 1, classId: 1 });

module.exports = mongoose.model('Section', sectionSchema);
