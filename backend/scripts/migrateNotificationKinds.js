/**
 * One-time migration: classify every existing Notification as
 *   kind 'notice'       → official, persistent communication (Notices pages)
 *   kind 'notification' → event alert (bell)
 *
 * Dry run (default):  node scripts/migrateNotificationKinds.js
 * Apply:              node scripts/migrateNotificationKinds.js --apply
 *
 * Only the `kind` field is written (idempotent — records that already have a
 * kind are left alone), so it's safe to re-run and reversible with
 *   db.notifications.updateMany({}, { $unset: { kind: '' } }).
 */
require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

// Formal exam communications and teacher-posted persistent content.
const NOTICE_TYPE_LABELS = [
  'exam_scheduled_class',
  'exam_routine_published_class',
  'exam_scheduled_teacher',
  'exam_routine_published_teacher',
  'Super Admin Broadcast',
  'Achievement',
];

// A record is a NOTICE if it was authored as official communication.
const NOTICE_FILTER = {
  $or: [
    { type: 'notice' },
    { type: 'class_note' },
    { typeLabel: { $in: NOTICE_TYPE_LABELS } },
    // Admin / super-admin manual posts carry no system typeLabel.
    {
      createdByType: { $in: ['admin', 'super_admin'] },
      type: { $in: ['announcement', 'general', 'fee', 'exam', 'other'] },
      $or: [{ typeLabel: '' }, { typeLabel: null }, { typeLabel: { $exists: false } }],
    },
  ],
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  const col = mongoose.connection.db.collection('notifications');
  const unclassified = { kind: { $exists: false } };

  const notices = await col.countDocuments({ ...unclassified, ...NOTICE_FILTER });
  const total = await col.countDocuments(unclassified);
  console.log(`Unclassified records: ${total}`);
  console.log(`  → notice:       ${notices}`);
  console.log(`  → notification: ${total - notices}`);

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write.');
  } else {
    const a = await col.updateMany({ ...unclassified, ...NOTICE_FILTER }, { $set: { kind: 'notice' } });
    const b = await col.updateMany(unclassified, { $set: { kind: 'notification' } });
    console.log(`\nApplied: ${a.modifiedCount} notice, ${b.modifiedCount} notification.`);
  }
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
