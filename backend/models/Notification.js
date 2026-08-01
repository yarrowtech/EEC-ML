const mongoose = require('mongoose');
const { sendPushForNotification } = require('../utils/webPushService');

const notificationSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    campusId: { type: String, default: null, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    audience: { type: String, enum: ['Admin', 'Teacher', 'Student', 'Parent', 'All'], default: 'All' },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    createdByType: { type: String, enum: ['admin', 'super_admin', 'teacher'], default: 'admin' },
    createdByTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', default: null },
    createdByName: { type: String, default: '' },
    className: { type: String, default: '' },
    sectionName: { type: String, default: '' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    subjectName: { type: String, default: '' },

    // Notification metadata
    type: {
      type: String,
      enum: ['notice', 'class_note', 'assignment', 'exam', 'result', 'fee', 'meeting', 'general', 'announcement', 'other'],
      default: 'general',
      index: true
    },
    typeLabel: { type: String, default: '' },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true
    },
    category: {
      type: String,
      enum: ['academic', 'events', 'transport', 'general'],
      default: 'general'
    },

    // Related entity reference
    relatedEntity: {
      entityType: { type: String, enum: ['assignment', 'exam', 'fee', 'result', 'meeting', null] },
      entityId: { type: mongoose.Schema.Types.ObjectId }
    },
    attachments: [
      {
        name: { type: String, default: '' },
        url: { type: String, default: '' },
        size: { type: Number, default: 0 },
        type: { type: String, default: '' },
      },
    ],

    // Structured subject-wise schedule, populated when this notice is a
    // published exam routine (see NotificationService.notifyExamRoutinePublished).
    examRoutine: [
      {
        subject: { type: String, default: '' },
        date: { type: String, default: '' },
        time: { type: String, default: '' },
        duration: { type: Number, default: null },
        venue: { type: String, default: '' },
      },
    ],
    targetUserIds: [{ type: mongoose.Schema.Types.ObjectId, index: true }],

    // Read tracking
    readBy: [{
      userId: { type: mongoose.Schema.Types.ObjectId, required: true },
      readAt: { type: Date, default: Date.now }
    }],

    // View tracking
    views: { type: Number, default: 0 },
    viewedBy: [{
      userId: { type: mongoose.Schema.Types.ObjectId, required: true },
      viewedAt: { type: Date, default: Date.now }
    }],

    // Dismiss tracking
    dismissedBy: [{
      userId: { type: mongoose.Schema.Types.ObjectId, required: true },
      dismissedAt: { type: Date, default: Date.now }
    }],

    // Expiration
    expiresAt: { type: Date, index: true }
  },
  { timestamps: true }
);

// Add compound indexes for efficient queries
notificationSchema.index({ schoolId: 1, audience: 1, createdAt: -1 });
notificationSchema.index({ schoolId: 1, campusId: 1, audience: 1 });

notificationSchema.pre('save', function (next) {
  this.$locals = this.$locals || {};
  this.$locals.wasNew = this.isNew;
  next();
});

notificationSchema.post('save', function (doc) {
  if (!this?.$locals?.wasNew) return;
  setImmediate(() => {
    sendPushForNotification(doc).catch(() => {});
  });
});

notificationSchema.post('insertMany', function (docs = []) {
  if (!Array.isArray(docs) || docs.length === 0) return;
  docs.forEach((doc) => {
    setImmediate(() => {
      sendPushForNotification(doc).catch(() => {});
    });
  });
});

module.exports = mongoose.model('Notification', notificationSchema);
