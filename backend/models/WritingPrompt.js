const mongoose = require('mongoose');

const writingPromptSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    promptType: {
      type: String,
      enum: ['essay', 'paragraph', 'question', 'letter', 'creative'],
      required: true,
    },
    question: { type: String, required: true },
    instructions: { type: String, default: '' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    wordLimit: { type: Number, default: 0 },
    subject: { type: String, trim: true },
    chapter: { type: String, trim: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    campusId: { type: mongoose.Schema.Types.ObjectId },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser' },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

writingPromptSchema.index({ schoolId: 1, campusId: 1, isPublished: 1 });
writingPromptSchema.index({ classId: 1, sectionId: 1 });

module.exports = mongoose.model('WritingPrompt', writingPromptSchema);
