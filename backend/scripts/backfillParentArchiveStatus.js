/**
 * One-time backfill: derives ParentUser.isArchived from the current status of
 * each parent's linked children (childrenIds -> StudentUser). Needed because
 * students archived/exited before this cascade shipped never propagated to
 * their parent accounts, which is why Super Admin parent counts exceeded
 * student counts.
 *
 *   node scripts/backfillParentArchiveStatus.js            # dry run (counts only)
 *   node scripts/backfillParentArchiveStatus.js --apply    # write
 */
const mongoose = require('../utils/registerTenantPlugin');
const ParentUser = require('../models/ParentUser');
const StudentUser = require('../models/StudentUser');
const { ACTIVE_STUDENT_FILTER } = require('../utils/studentStatus');

const resolveMongoUri = () =>
  process.env.MONGODB_URL ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.DATABASE_URL ||
  '';

const apply = process.argv.includes('--apply');

const main = async () => {
  const uri = resolveMongoUri();
  if (!uri) {
    console.error('Missing MongoDB connection string (MONGODB_URL/MONGODB_URI/MONGO_URI/DATABASE_URL)');
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: process.env.DB_NAME });
  console.log(`backfillParentArchiveStatus: ${apply ? 'APPLY' : 'DRY RUN'}\n`);

  const parents = await ParentUser.find({}).select('childrenIds isArchived').lean();
  const allChildIds = [...new Set(parents.flatMap((p) => (p.childrenIds || []).map(String)))];
  const activeChildIds = new Set(
    (await StudentUser.find({ _id: { $in: allChildIds }, ...ACTIVE_STUDENT_FILTER }).select('_id').lean())
      .map((s) => String(s._id))
  );

  const toArchive = [];
  const toRestore = [];
  parents.forEach((parent) => {
    const hasActiveChild = (parent.childrenIds || []).some((childId) => activeChildIds.has(String(childId)));
    const shouldBeArchived = !hasActiveChild;
    if (shouldBeArchived && !parent.isArchived) toArchive.push(parent._id);
    else if (!shouldBeArchived && parent.isArchived) toRestore.push(parent._id);
  });

  console.log(`Parents to archive (no active children): ${toArchive.length}`);
  console.log(`Parents to restore (has an active child): ${toRestore.length}`);

  if (apply) {
    const now = new Date();
    if (toArchive.length) {
      await ParentUser.updateMany({ _id: { $in: toArchive } }, { $set: { isArchived: true, archivedAt: now } });
    }
    if (toRestore.length) {
      await ParentUser.updateMany({ _id: { $in: toRestore } }, { $set: { isArchived: false, archivedAt: null } });
    }
    console.log('Applied.');
  }

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
