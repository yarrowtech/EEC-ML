const mongoose = require('mongoose');

// Per-user "already seen" markers for notification items that are not stored
// as Notification documents (e.g. the teacher's ungraded-submission alerts) and
// per-module "visited" lists. Kept on the server so marking things read on one
// device is reflected on every other device the user logs in from.
const notificationSeenStateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userType: { type: String, default: '' },
    scope: { type: String, required: true }, // 'teacher' | 'student' | 'parent' | ...
    // { notifications: [ids], assignments: [ids], ... }
    seen: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);

notificationSeenStateSchema.index({ userId: 1, scope: 1 }, { unique: true });

module.exports = mongoose.model('NotificationSeenState', notificationSeenStateSchema);
