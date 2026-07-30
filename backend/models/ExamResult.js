const mongoose = require('mongoose');

const examResultSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    campusId: { type: String, default: null, index: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true },
    marks: { type: Number, min: 0, required: true },
    grade: { type: String, trim: true },
    remarks: { type: String, trim: true },
    status: { type: String, enum: ['pass', 'fail', 'absent'], default: 'pass' },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId },
    aiFeedback: { type: String, default: '' },
  },
  { timestamps: true }
);

examResultSchema.index({ examId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('ExamResult', examResultSchema);
