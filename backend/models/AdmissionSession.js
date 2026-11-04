const mongoose = require('mongoose');

// An admission notification published by a school: applications are accepted on the
// school's public admission page while it is active and today is within its dates.
const admissionSessionSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    academicYear: { type: String, default: '', trim: true, maxlength: 20 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    // Class names applicants can choose from; empty means any class (free text).
    classes: [{ type: String, trim: true }],
    // Seats per class. A class with no entry (or 0) has no limit. Seats are taken
    // by admitted applications; a full class stops accepting applications.
    seats: [{
      _id: false,
      className: { type: String, trim: true },
      capacity: { type: Number, min: 0, default: 0 },
    }],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

admissionSessionSchema.index({ schoolId: 1, isActive: 1, startDate: -1 });

module.exports = mongoose.model('AdmissionSession', admissionSessionSchema);
