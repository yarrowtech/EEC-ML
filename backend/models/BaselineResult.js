const mongoose = require('mongoose');

const baselineResultSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
    schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'School',      required: true, index: true },
    quizId:    { type: mongoose.Schema.Types.ObjectId, ref: 'BaselineQuiz', required: true },
    subject:   { type: String, required: true },
    score:     { type: Number, default: 0 },        // percentage 0-100
    answers:   [{ questionIdx: Number, chosen: Number, correct: Boolean }],
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One result per student per quiz
baselineResultSchema.index({ studentId: 1, quizId: 1 }, { unique: true });

module.exports = mongoose.model('BaselineResult', baselineResultSchema);
