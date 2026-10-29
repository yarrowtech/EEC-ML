const mongoose = require('mongoose');

const seenBySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  seenAt: { type: Date, default: Date.now },
}, { _id: false });

const encryptedKeySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    wrappedKey: { type: String, required: true },
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema({
  threadId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatThread', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  senderType: { type: String, enum: ['student', 'teacher', 'parent', 'principal', 'system'], required: true },
  senderName: { type: String, default: '' },
  text: { type: String, default: '', trim: true },
  encrypted: {
    algorithm: { type: String, default: '' },
    iv: { type: String, default: '' },
    ciphertext: { type: String, default: '' },
    keys: { type: [encryptedKeySchema], default: [] },
    version: { type: String, default: 'v1' },
  },
  seenBy: [seenBySchema],
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  campusId: { type: String, required: true },
}, { timestamps: true });

chatMessageSchema.index({ threadId: 1, createdAt: 1 });


// Any chat write (HTTP or Socket.IO) drops cached chat reads.
const clearChatCache = () => require('../utils/responseCache').chatCache.clear();
chatMessageSchema.post(['save', 'insertMany', 'updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'], clearChatCache);

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
