const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    campusId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' },
    order: { type: Number, default: 0 },
    standard: { type: Number, min: 1, max: 12 },
    stream: {
      type: String,
      enum: ['science', 'commerce', 'arts', 'mixed'],
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Hot path: /api/student/allocated-subjects does Class.find({ schoolId })
// on every Smart Learning page load. Without this, the tenant plugin's
// organizationId-only index leaves Mongo scanning every class in the
// organization (all schools/campuses) to filter by schoolId in memory.
classSchema.index({ schoolId: 1 });

module.exports = mongoose.model('Class', classSchema);
