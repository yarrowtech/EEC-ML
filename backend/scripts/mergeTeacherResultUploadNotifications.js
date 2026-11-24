/**
 * One-time cleanup: merge duplicate "Teacher Uploaded Results" admin
 * notifications (one per student saved) into a single notification per
 * teacher + exam, with the summed entry count.
 *
 * Dry run (default):  node scripts/mergeTeacherResultUploadNotifications.js
 * Apply:              node scripts/mergeTeacherResultUploadNotifications.js --apply
 *
 * Keeps the newest notification of each group (rewrites its message with the
 * total and marks it unread) and deletes the rest. Safe to re-run.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const TITLE = 'Teacher Uploaded Results';

const countOf = (message) => Number((/uploaded (\d+) result/.exec(message || '') || [])[1] || 1);
const withCount = (message, total) =>
  String(message || '')
    .replace(/uploaded \d+ result entr(?:y|ies)/, `uploaded ${total} result entr${total === 1 ? 'y' : 'ies'}`);

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  const col = mongoose.connection.collection('notifications');

  const groups = await col.aggregate([
    { $match: { title: TITLE, 'relatedEntity.entityId': { $ne: null } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { schoolId: '$schoolId', teacher: '$createdByTeacherId', exam: '$relatedEntity.entityId' },
        ids: { $push: '$_id' },
        messages: { $push: '$message' },
        n: { $sum: 1 },
      },
    },
    { $match: { n: { $gt: 1 } } },
  ]).toArray();

  let removed = 0;
  for (const g of groups) {
    const total = g.messages.reduce((sum, m) => sum + countOf(m), 0);
    const [keepId, ...dropIds] = g.ids;
    removed += dropIds.length;
    console.log(`${APPLY ? 'merge' : '[dry]'} exam=${g._id.exam} teacher=${g._id.teacher}: ${g.n} → 1 (total ${total})`);
    if (APPLY) {
      await col.updateOne({ _id: keepId }, { $set: { message: withCount(g.messages[0], total), readBy: [] } });
      await col.deleteMany({ _id: { $in: dropIds } });
    }
  }

  console.log(`${groups.length} group(s), ${removed} duplicate notification(s) ${APPLY ? 'removed' : 'would be removed'}.`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
