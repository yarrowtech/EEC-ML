/**
 * One-time cleanup: lesson-plan publishing used to create a new
 * "New Smart Teaching content published" student notification every time a
 * chapter was published / re-published / edited, so students saw the same
 * notice 2–3+ times. New publishes now create only one (see
 * createPublishedStudentNotification in routes/lessonPlanRoutes.js).
 *
 * This keeps the OLDEST copy of each identical notice (same school, class,
 * section and text) — so its read/viewed state is preserved — and deletes the
 * rest. Safe to re-run.
 *
 * Dry run (default):  node scripts/dedupeSmartTeachingNotifications.js
 * Apply:              node scripts/dedupeSmartTeachingNotifications.js --apply
 */
require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const TITLE = 'New Smart Teaching content published';

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  const col = mongoose.connection.collection('notifications');

  const groups = await col.aggregate([
    { $match: { title: TITLE } },
    { $sort: { createdAt: 1 } }, // oldest first → kept
    {
      $group: {
        _id: { schoolId: '$schoolId', classId: '$classId', sectionId: '$sectionId', message: '$message' },
        ids: { $push: '$_id' },
        n: { $sum: 1 },
      },
    },
    { $match: { n: { $gt: 1 } } },
  ]).toArray();

  const toDelete = groups.flatMap((g) => g.ids.slice(1));
  console.log(`${groups.length} duplicated notice(s); ${toDelete.length} extra cop${toDelete.length === 1 ? 'y' : 'ies'} to remove.`);
  groups.slice(0, 10).forEach((g) => console.log(`  ×${g.n}  ${String(g._id.message).slice(0, 90)}`));

  if (!APPLY) {
    console.log('\nDry run — nothing changed. Re-run with --apply to delete the extra copies.');
  } else if (toDelete.length) {
    const { deletedCount } = await col.deleteMany({ _id: { $in: toDelete } });
    console.log(`Deleted ${deletedCount} duplicate notification(s).`);
  }
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
