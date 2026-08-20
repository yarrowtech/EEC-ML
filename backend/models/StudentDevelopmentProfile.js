const mongoose = require('mongoose');

const categoryScoreSchema = new mongoose.Schema({
  score: { type: Number, min: 0, max: 100, default: null }, // null = no data yet
  trend: { type: String, enum: ['improving', 'stable', 'declining', 'unknown'], default: 'unknown' },
  lastUpdated: { type: Date, default: null },
  dataPoints: { type: Number, default: 0 }, // how many signals fed this score
}, { _id: false });

const studentDevelopmentProfileSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true },
  schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },

  // 6 Development Categories
  cognitive:    { ...categoryScoreSchema.obj }, // reasoning, analytics, intelligence
  memory:       { ...categoryScoreSchema.obj }, // recall, attention span, concentration
  creative:     { ...categoryScoreSchema.obj }, // divergent thinking, imagination, visual
  language:     { ...categoryScoreSchema.obj }, // speaking, listening, reading, writing, vocabulary
  socialEmotional: { ...categoryScoreSchema.obj }, // motivation, confidence, collaboration
  physical:     { ...categoryScoreSchema.obj }, // fine motor skills, hand-eye coordination

}, { timestamps: true });

studentDevelopmentProfileSchema.index({ studentId: 1, schoolId: 1 }, { unique: true });

module.exports = mongoose.model('StudentDevelopmentProfile', studentDevelopmentProfileSchema);
