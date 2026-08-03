const mongoose = require('mongoose');

const academicYearSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: false },
    // Lifecycle label shown in the UI. isActive is the real "default academic
    // year" flag (drives invoice generation etc.); status is purely
    // descriptive, except that only one year can be marked "active".
    status: { type: String, enum: ['upcoming', 'active', 'archived'], default: 'upcoming' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AcademicYear', academicYearSchema);
