const mongoose = require('mongoose');

const studyTaskSchema = new mongoose.Schema({
  day: { type: Number, min: 1, max: 7, required: true },
  subject: { type: String, required: true },
  topicTitle: { type: String, required: true },
  action: { type: String, enum: ['learn', 'practice', 'review'], required: true },
  reason: { type: String, default: '' },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
}, { _id: true });

const weeklyStudyPlanSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },
  tasks: { type: [studyTaskSchema], default: [] },
  generatedFrom: { type: [String], default: ['mastery', 'gaps', 'recommendations'] },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
}, { timestamps: true });

weeklyStudyPlanSchema.index({ studentId: 1, schoolId: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyStudyPlan', weeklyStudyPlanSchema);
