const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const hashPasswordIfNeeded = async (password) => {
  if (!password || typeof password !== 'string') return password;
  if (password.startsWith('$2a$') || password.startsWith('$2b$') || password.startsWith('$2y$')) {
    return password;
  }
  return bcrypt.hash(password, 10);
};

const teacherUserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  initialPassword: { type: String, default: '' },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
  campusId: { type: String, default: null },
  campusName: { type: String, default: null },
  campusType: { type: String, default: null },
  employeeCode: { type: String },
  empId: Number,
  name: String,
  email: String,
  mobile: String,
  subject: String,
  department: String,
  experience: String,
  qualification: String,
  joiningDate: String,
  address: String,
  emergencyContact: { type: String, default: '' },
  gender: { type: String, enum: ["male", "female", "other"], default: "male" },
  pinCode: String,
  profilePic: { type: String, default: "" },
  lastLoginAt: { type: Date, default: null },
  isArchived: { type: Boolean, default: false, index: true },
  archivedAt: { type: Date, default: null },

  // Basic Information
  dob: { type: String, default: '' },

  // Contact Details
  alternatePhone: { type: String, default: '' },
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  state: { type: String, default: '' },

  // Professional Information
  specialization: { type: String, default: '' },
  designation: { type: String, default: '' },
  employeeType: { type: String, default: '' }, // Full-time / Part-time / Contract / Visiting

  // Academic Assignment
  classesAssigned: { type: [String], default: [] },
  sectionsAssigned: { type: [String], default: [] },
  subjectsAssigned: { type: [String], default: [] },
  classTeacherOf: { type: String, default: '' },

  // Login & Access — distinct from the computed attendance `status`
  // (Present/Absent/On Leave) already used elsewhere on this model.
  accountStatus: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },

  // Documents (Cloudinary URLs)
  documents: {
    aadhaarUrl: { type: String, default: '' },
    qualificationCertUrl: { type: String, default: '' },
    experienceCertUrl: { type: String, default: '' },
    appointmentLetterUrl: { type: String, default: '' },
  },

  // Additional
  emergencyContactName: { type: String, default: '' },
  bloodGroup: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true });

teacherUserSchema.index({ organizationId: 1, username: 1 }, { unique: true });
teacherUserSchema.index(
  { organizationId: 1, employeeCode: 1 },
  { unique: true, partialFilterExpression: { employeeCode: { $type: 'string' } } }
);

teacherUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

teacherUserSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() || {};
  const nextPassword = update.password || (update.$set && update.$set.password);
  if (!nextPassword) return next();
  const hashed = await hashPasswordIfNeeded(nextPassword);
  if (update.password) update.password = hashed;
  if (update.$set && update.$set.password) update.$set.password = hashed;
  this.setUpdate(update);
  next();
});

module.exports = mongoose.model('TeacherUser', teacherUserSchema);
