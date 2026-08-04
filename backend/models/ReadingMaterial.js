const mongoose = require('mongoose');

const readingMaterialSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    contentType: {
      type: String,
      enum: ['story', 'paragraph', 'poem', 'article', 'dialogue'],
      required: true,
    },
    content: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    estimatedReadingTime: { type: Number, default: 0 }, // minutes
    wordCount: { type: Number, default: 0 },
    subject: { type: String, trim: true },
    chapter: { type: String, trim: true },
    tags: [String],
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    campusId: { type: mongoose.Schema.Types.ObjectId },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser' },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

readingMaterialSchema.index({ schoolId: 1, campusId: 1, isPublished: 1 });
readingMaterialSchema.index({ classId: 1, sectionId: 1 });

module.exports = mongoose.model('ReadingMaterial', readingMaterialSchema);
