const mongoose = require('mongoose');

const AlcovePostSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    title: { type: String, required: true, trim: true },
    subject: { type: String, default: 'General', index: true, trim: true },
    chapter: { type: String, default: 'General', index: true, trim: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium', index: true },
    problemText: { type: String, default: '' },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: '' },
      },
    ],
    // Single-choice poll; votes hold actor keys (`<userType>:<userId>`),
    // voteLog records when each current vote was cast.
    poll: {
      question: { type: String, trim: true, default: '' },
      options: [
        {
          text: { type: String, trim: true, required: true },
          votes: [{ type: String }],
          voteLog: [
            {
              _id: false,
              key: { type: String, required: true },
              at: { type: Date, default: Date.now },
            },
          ],
        },
      ],
      closed: { type: Boolean, default: false },
      closesAt: { type: Date, default: null },
    },
    solutionText: { type: String, default: '' },
    highlighted: { type: Boolean, default: false },
    tags: [{ type: String, trim: true }],
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser' },
    authorUserId: { type: String, default: '' },
    authorType: { type: String, enum: ['student', 'teacher', 'parent', 'unknown'], default: 'teacher' },
    authorName: { type: String, trim: true, default: 'Teacher' },
    authorGrade: { type: String, default: '' },
    authorSection: { type: String, default: '' },
    likedBy: [{ type: String, default: [] }],
    savedBy: [{ type: String, default: [] }],
    viewedBy: [{ type: String, default: [] }],
    viewCount: { type: Number, default: 0 },
    isStudentPosted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AlcovePost', AlcovePostSchema);
