const mongoose = require('mongoose');

const studentBadgeSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
    schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'School',      required: true, index: true },
    badgeType: {
      type: String,
      enum: ['mastery', 'streak', 'completion', 'challenge', 'engagement'],
      default: 'mastery',
    },
    title:       { type: String, required: true },
    description: { type: String, default: '' },
    subject:     { type: String, default: '' },
    topicTitle:  { type: String, default: '' },
    iconEmoji:   { type: String, default: '🏅' },
    awardedAt:   { type: Date,   default: Date.now },
  },
  { timestamps: true }
);

studentBadgeSchema.index({ studentId: 1, title: 1, badgeType: 1 }, { unique: true });

module.exports = mongoose.model('StudentBadge', studentBadgeSchema);
