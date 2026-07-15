const mongoose = require('mongoose');

const tutorMessageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    text: { type: String, default: '' },
    error: { type: Boolean, default: false },
  },
  { _id: false }
);

const tutorConversationSchema = new mongoose.Schema(
  {
    // Frontend-generated id — lets the client upsert idempotently without a
    // round-trip to learn the server-assigned _id first.
    clientId: { type: String, required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    campusId: { type: String, index: true },
    title: { type: String, default: 'New chat' },
    subjectTitle: { type: String, default: '' },
    topicTitle: { type: String, default: '' },
    messages: [tutorMessageSchema],
  },
  { timestamps: true }
);

tutorConversationSchema.index({ studentId: 1, clientId: 1 }, { unique: true });
tutorConversationSchema.index({ studentId: 1, updatedAt: -1 });

module.exports = mongoose.model('TutorConversation', tutorConversationSchema);
