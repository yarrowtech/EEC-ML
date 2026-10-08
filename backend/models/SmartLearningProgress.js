const mongoose = require('mongoose');

const smartLearningProgressSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true },
  subjectKey: { type: String, required: true, trim: true },
  topicKey: { type: String, required: true, trim: true },
  completedSteps: { type: [String], default: [] },
  topicCompleted: { type: Boolean, default: false },
  activeStepId: { type: String, default: '' },
  scrollTop: { type: Number, default: 0, min: 0 },
  lastAccessedAt: { type: Date, default: Date.now },
}, { timestamps: true });

smartLearningProgressSchema.index(
  { schoolId: 1, studentId: 1, subjectKey: 1, topicKey: 1 },
  { unique: true }
);

module.exports = mongoose.model('SmartLearningProgress', smartLearningProgressSchema);
