const mongoose = require('mongoose');

// A teacher's correction/override of a specific AI tutor answer inside a
// student's conversation. Stored separately from TutorConversation because the
// student client rewrites the whole `messages` array on every sync — a
// correction embedded in a message would be wiped. Joined back in on read.
const tutorAnswerCorrectionSchema = new mongoose.Schema({
  schoolId:       { type: mongoose.Schema.Types.ObjectId, ref: 'School',           required: true, index: true },
  studentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser',      required: true, index: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorConversation', required: true, index: true },
  clientId:       { type: String, default: '' },
  messageId:      { type: String, required: true },
  messageIndex:   { type: Number, default: null },

  originalText:   { type: String, default: '' },   // snapshot of the AI answer at correction time
  correctedText:  { type: String, required: true },
  reason:         { type: String, default: '' },
  status:         { type: String, enum: ['active', 'withdrawn'], default: 'active' },

  teacherId:      { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', required: true, index: true },
  teacherName:    { type: String, default: '' },
  withdrawnAt:    { type: Date, default: null },
}, { timestamps: true });

// One correction row per (conversation, message); editing upserts it.
tutorAnswerCorrectionSchema.index({ conversationId: 1, messageId: 1 }, { unique: true });
tutorAnswerCorrectionSchema.index({ schoolId: 1, studentId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('TutorAnswerCorrection', tutorAnswerCorrectionSchema);
