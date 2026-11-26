const mongoose = require('mongoose');

// One student run of a Virtual Lab experiment (teacher-made, stored on a lesson
// plan chapter as labExperiments[]). Students may repeat experiments; every run
// is kept so teachers can see progress and the student's best XP.
const labResultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  experimentId: { type: String, required: true, trim: true },
  title: { type: String, default: '', trim: true },
  subjectName: { type: String, default: '', trim: true },
  chapterTitle: { type: String, default: '', trim: true },
  topicTitle: { type: String, default: '', trim: true },
  completed: { type: Boolean, default: false },
  observations: [{ _id: false, day: Number, text: { type: String, trim: true } }],
  quizCorrect: { type: Number, default: 0 },
  quizTotal: { type: Number, default: 0 },
  xp: { type: Number, default: 0 },
}, { timestamps: true });

labResultSchema.index({ studentId: 1, experimentId: 1, createdAt: -1 });

module.exports = mongoose.model('LabResult', labResultSchema);
