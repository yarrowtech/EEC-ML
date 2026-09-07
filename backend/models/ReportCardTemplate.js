const mongoose = require('mongoose');

const reportCardTemplateSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    campusId: { type: String, default: null, index: true },
    title: { type: String, trim: true, default: 'Report Card' },
    subtitle: { type: String, trim: true, default: 'Academic Performance Report' },
    schoolNameOverride: { type: String, trim: true, default: '' },
    logoUrlOverride: { type: String, trim: true, default: '' },
    // Full-width school letterhead banner, printed across the top of report
    // cards (and certificates). Empty = fall back to the coloured header band.
    letterheadUrl: { type: String, trim: true, default: '' },
    schoolAddressLine: { type: String, trim: true, default: '' },
    schoolContactLine: { type: String, trim: true, default: '' },
    accentColor: { type: String, trim: true, default: '#1f2937' },
    showPageBorder: { type: Boolean, default: true },
    watermarkText: { type: String, trim: true, default: '' },
    footerNote: {
      type: String,
      trim: true,
      default: 'This is a computer-generated report card.',
    },
    signatureLabel: { type: String, trim: true, default: 'Class Teacher' },
    principalLabel: { type: String, trim: true, default: 'Principal' },
  },
  { timestamps: true }
);

reportCardTemplateSchema.index({ schoolId: 1, campusId: 1 }, { unique: true });

module.exports = mongoose.model('ReportCardTemplate', reportCardTemplateSchema);
