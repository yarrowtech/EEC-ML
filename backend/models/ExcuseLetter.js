const mongoose = require('mongoose');

const excuseLetterSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    campusId: { type: String, default: null, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
    studentName: { type: String, required: true },
    rollNumber: { type: String, default: '' },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    className: { type: String, default: '' },
    sectionName: { type: String, default: '' },
    parentName: { type: String, default: '' },
    parentEmail: { type: String, default: '' },
    parentPhone: { type: String, default: '' },
    dateFrom: { type: Date, required: true },
    dateTo: { type: Date, required: true },
    reason: { type: String, required: true },
    reasonType: { type: String, default: 'other' },
    // Free-text reason the parent typed when they picked "Other".
    customReasonType: { type: String, default: '', trim: true, maxlength: 60 },
    additionalNotes: { type: String, default: '' },
    emergencyContact: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

excuseLetterSchema.index({ schoolId: 1, campusId: 1, classId: 1, sectionId: 1, status: 1 });

module.exports = mongoose.model('ExcuseLetter', excuseLetterSchema);
