const mongoose = require('mongoose');

// Per-school, per-year sequence used to hand out admission numbers (ADM20260001, …).
const admissionCounterSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  year: { type: Number, required: true },
  seq: { type: Number, default: 0 },
});

admissionCounterSchema.index({ schoolId: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('AdmissionCounter', admissionCounterSchema);
