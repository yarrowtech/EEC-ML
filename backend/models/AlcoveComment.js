const mongoose = require('mongoose');

const AlcoveCommentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'AlcovePost', required: true, index: true },
    authorId: { type: String },
    authorType: { type: String, enum: ['student', 'teacher', 'parent', 'admin', 'unknown'], default: 'unknown' },
    // Replies point at a top-level comment (one level deep, like Facebook).
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'AlcoveComment', default: null, index: true },
    authorName: { type: String, default: 'Anonymous' },
    authorGrade: { type: String, default: '' },
    authorSection: { type: String, default: '' },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AlcoveComment', AlcoveCommentSchema);
