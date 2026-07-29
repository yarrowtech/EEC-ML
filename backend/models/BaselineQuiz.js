const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true },
    options: [
      {
        text:      { type: String, required: true },
        isCorrect: { type: Boolean, default: false },
      },
    ],
    marks: { type: Number, default: 1 },
    bloomLevel: { type: String, default: 'knowledge' },
  },
  { _id: false }
);

const baselineQuizSchema = new mongoose.Schema(
  {
    schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'School',      required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', required: true },
    subject:   { type: String, required: true },
    className: { type: String, required: true },  // e.g. "Grade 7"
    section:   { type: String, default: '' },
    questions: [questionSchema],
    status:    { type: String, enum: ['draft', 'published'], default: 'draft' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One baseline quiz per subject+class+section per school
baselineQuizSchema.index({ schoolId: 1, subject: 1, className: 1, section: 1 }, { unique: true });

module.exports = mongoose.model('BaselineQuiz', baselineQuizSchema);
