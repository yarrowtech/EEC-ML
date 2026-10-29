const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userType: { type: String, enum: ['student', 'teacher', 'parent', 'principal'], required: true },
  name: { type: String, default: '' },
}, { _id: false });

const unreadCountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  count: { type: Number, default: 0 },
}, { _id: false });

const chatThreadSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  campusId: { type: String, required: true },
  threadType: { type: String, enum: ['direct', 'group'], default: 'direct' },
  groupName: { type: String, default: '' },
  groupKey: { type: String },
  groupMeta: {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', default: null },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', default: null },
    year: { type: String, default: '' },
  },
  participants: [participantSchema],
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: null },
  lastSenderId: { type: mongoose.Schema.Types.ObjectId, default: null },
  unreadCounts: [unreadCountSchema],
}, { timestamps: true });

// Unique thread per pair of participants in same campus
chatThreadSchema.index({ schoolId: 1, campusId: 1, 'participants.userId': 1 });
chatThreadSchema.index(
  { schoolId: 1, campusId: 1, groupKey: 1 },
  {
    unique: true,
    name: 'unique_group_thread_key',
    partialFilterExpression: {
      threadType: 'group',
      groupKey: { $exists: true, $type: 'string', $ne: '' },
    },
  }
);


// Any chat write (HTTP or Socket.IO) drops cached chat reads.
const clearChatCache = () => require('../utils/responseCache').chatCache.clear();
chatThreadSchema.post(['save', 'insertMany', 'updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'], clearChatCache);

module.exports = mongoose.model('ChatThread', chatThreadSchema);
