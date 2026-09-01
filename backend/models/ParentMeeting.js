const mongoose = require('mongoose');

const parentMeetingSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  campusId: {
    type: String,
    default: null
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeacherUser',
    required: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParentUser',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentUser',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  topic: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  meetingDate: {
    type: Date,
    required: true
  },
  meetingTime: {
    type: String,
    required: true
  },
  meetingType: {
    type: String,
    enum: ['Video Call', 'Phone Call', 'In Person'],
    default: 'In Person'
  },
  location: {
    type: String,
    default: ''
  },
  meetingLink: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['scheduled', 'pending', 'confirmed', 'reschedule_requested', 'declined', 'cancelled', 'completed'],
    default: 'scheduled'
  },
  notes: {
    type: String,
    default: ''
  },
  // Parent-initiated reschedule request (teacher acts on it via /teacher/update)
  rescheduleRequest: {
    requestedDate: { type: Date, default: null },
    requestedTime: { type: String, default: '' },
    reason: { type: String, default: '' },
    requestedAt: { type: Date, default: null },
  },
  // Parent feedback after a completed meeting
  parentFeedback: {
    rating: { type: Number, min: 0, max: 5, default: null },
    comment: { type: String, default: '' },
    submittedAt: { type: Date, default: null },
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for efficient queries
parentMeetingSchema.index({ schoolId: 1, teacherId: 1 });
parentMeetingSchema.index({ schoolId: 1, parentId: 1 });
parentMeetingSchema.index({ schoolId: 1, studentId: 1 });
parentMeetingSchema.index({ meetingDate: 1, status: 1 });

module.exports = mongoose.model('ParentMeeting', parentMeetingSchema);
