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
    authorType: { type: String, enum: ['student', 'teacher', 'parent', 'admin', 'unknown'], default: 'teacher' },
    authorName: { type: String, trim: true, default: 'Teacher' },
    authorGrade: { type: String, default: '' },
    authorSection: { type: String, default: '' },
    // Who can see the post: the whole school, or only students of the listed class-sections.
    audience: { type: String, enum: ['school', 'classes'], default: 'school' },
    audienceClasses: [
      {
        _id: false,
        classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
        sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
        grade: { type: String, default: '' },
        section: { type: String, default: '' },
      },
    ],
    // Lowercased `grade|section` pairs, matched against StudentUser.grade/section.
    audienceKeys: { type: [String], default: [], index: true },
    // Set when a school admin removes someone else's post. The post's content is wiped and only
    // its author still sees it, as a "removed by the school admin" notice with the remarks.
    removal: {
      at: { type: Date, default: null },
      byUserId: { type: String, default: '' },
      byName: { type: String, default: '' },
      remarks: { type: String, default: '' },
    },
    likedBy: [{ type: String, default: [] }],
    savedBy: [{ type: String, default: [] }],
    // Users who dismissed the post's "new post" alert without opening it (bell "mark all read").
    // A post is unread for a user until they view it or it lands here.
    seenBy: [{ type: String, default: [] }],
    viewedBy: [{ type: String, default: [] }],
    viewCount: { type: Number, default: 0 },
    isStudentPosted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AlcovePost', AlcovePostSchema);
