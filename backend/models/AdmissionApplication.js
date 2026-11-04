const mongoose = require('mongoose');

const str = (maxlength = 160) => ({ type: String, default: '', trim: true, maxlength });

const admissionDocumentSchema = new mongoose.Schema({
  type: { type: String, trim: true }, // birth_certificate | transfer_certificate | aadhar_card | report_card | photo_id
  label: { type: String, trim: true },
  url: { type: String },
  fileName: { type: String },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

// Mirrors the student enrolment fields so an admitted application can become a
// StudentUser without re-entering anything.
const admissionApplicationSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdmissionSession', required: true, index: true },
    admissionNumber: { type: String, required: true, trim: true },

    // Student
    studentName: { type: String, required: true, trim: true, maxlength: 120 },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    applyingForClass: { type: String, required: true, trim: true, maxlength: 40 },
    profilePic: str(500),
    birthPlace: str(120),
    bloodGroup: str(10),
    nationality: str(60),
    religion: str(60),
    category: str(30),
    caste: str(60),
    aadharNumber: str(20),
    birthCertificateNo: str(60),

    // Contact
    guardianPhone: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true, lowercase: true, maxlength: 160 },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    permanentAddress: str(500),
    pinCode: str(10),

    // Family
    fatherName: str(120),
    fatherPhone: str(15),
    fatherOccupation: str(120),
    motherName: str(120),
    motherPhone: str(15),
    motherOccupation: str(120),
    guardianName: str(120),
    guardianRelation: str(40),
    guardianEmail: str(160),

    // Health
    knownHealthIssues: str(500),
    allergies: str(300),
    immunizationStatus: str(60),
    learningDisabilities: str(300),

    // Previous schooling
    hasPreviousSchool: { type: String, enum: ['yes', 'no', ''], default: '' },
    previousSchool: str(160),
    previousClass: str(40),
    previousPercentage: str(20),
    transferCertificateNo: str(60),
    transferCertificateDate: str(20),

    documents: [admissionDocumentSchema],

    // Review
    status: {
      type: String,
      enum: ['submitted', 'shortlisted', 'approved', 'admitted', 'rejected'],
      default: 'submitted',
      index: true,
    },
    reviewNote: str(500),
    reviewedAt: { type: Date, default: null },
    admittedAt: { type: Date, default: null },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', default: null },
    studentUsername: str(60),
    parentUsername: str(60),
    admittedSection: str(20),
  },
  { timestamps: true }
);

admissionApplicationSchema.index({ schoolId: 1, admissionNumber: 1 }, { unique: true });
admissionApplicationSchema.index({ schoolId: 1, sessionId: 1, createdAt: -1 });
admissionApplicationSchema.index({ sessionId: 1, applyingForClass: 1, status: 1 });

module.exports = mongoose.model('AdmissionApplication', admissionApplicationSchema);
