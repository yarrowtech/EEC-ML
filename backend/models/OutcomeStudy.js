const mongoose = require('mongoose');

const windowSchema = new mongoose.Schema({
  start: { type: Date, required: true },
  end:   { type: Date, required: true },
}, { _id: false });

const measurementSchema = new mongoose.Schema({
  perStudent: [{ studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser' }, value: Number, sampleCount: Number }],
  mean:  { type: Number, default: null },
  sd:    { type: Number, default: null },
  n:     { type: Number, default: 0 },
  capturedAt: { type: Date, default: null },
}, { _id: false });

// A pre/post outcome study — did a cohort's learning metric improve over a
// defined window of platform use? Baseline and post measurements are captured
// from the append-only MasteryEvent stream.
const outcomeStudySchema = new mongoose.Schema({
  schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  name:      { type: String, required: true },

  grade:      { type: String, default: '' },
  section:    { type: String, default: '' },
  subject:    { type: String, default: '' },
  studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser' }],

  metric: { type: String, enum: ['mastery_avg', 'assessment_avg'], default: 'assessment_avg' },
  baselineWindow: { type: windowSchema, required: true },
  postWindow:     { type: windowSchema, required: true },

  status:   { type: String, enum: ['draft', 'baseline_captured', 'complete'], default: 'draft' },
  baseline: { type: measurementSchema, default: () => ({}) },
  post:     { type: measurementSchema, default: () => ({}) },
  result:   { type: mongoose.Schema.Types.Mixed, default: null }, // { meanDelta, pctImproved, effectSize, interpretation }
}, { timestamps: true });

outcomeStudySchema.index({ schoolId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('OutcomeStudy', outcomeStudySchema);
