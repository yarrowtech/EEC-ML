const mongoose = require('mongoose');

const externalResourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    url: { type: String, required: true, trim: true },
    // video | article | pdf | website | tool
    resourceType: {
      type: String,
      enum: ['video', 'article', 'pdf', 'website', 'tool'],
      default: 'website',
    },
    subject: { type: String, trim: true, default: '' },
    // Optional thumbnail — auto-generated YouTube thumb if URL is YT
    thumbnailUrl: { type: String, trim: true, default: '' },
    // Source label shown on the card e.g. "Khan Academy", "NCERT", "YouTube"
    source: { type: String, trim: true, default: '' },
    // Display category in the student Add Ons portal. Existing records remain
    // school resources; EEC resources are still tenant-scoped to the school.
    origin: { type: String, enum: ['school', 'eec'], default: 'school', index: true },
    tags: [{ type: String, trim: true }],
    // Scoping — leave class/section empty to show to all students in the school
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', default: null },
    isPublished: { type: Boolean, default: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'addedByRole' },
    addedByRole: { type: String, enum: ['Admin', 'Teacher', 'Principal'], default: 'Admin' },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

externalResourceSchema.index({ schoolId: 1, isPublished: 1, origin: 1, subject: 1 });

module.exports = mongoose.model('ExternalResource', externalResourceSchema);
