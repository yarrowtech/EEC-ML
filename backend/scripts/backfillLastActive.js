/**
 * Seeds `lastActiveAt` from the legacy `lastLoginAt` so the Super Admin usage
 * dashboard is not blank on the day the activity tracker ships. After this runs,
 * middleware/activityTracker.js keeps `lastActiveAt` fresh going forward.
 *
 *   node scripts/backfillLastActive.js            # dry run (counts only)
 *   node scripts/backfillLastActive.js --apply    # write
 */
const mongoose = require('../utils/registerTenantPlugin');

const resolveMongoUri = () =>
  process.env.MONGODB_URL ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.DATABASE_URL ||
  '';

const apply = process.argv.includes('--apply');

const MODELS = [
  ['StudentUser', require('../models/StudentUser')],
  ['TeacherUser', require('../models/TeacherUser')],
  ['ParentUser', require('../models/ParentUser')],
  ['StaffUser', require('../models/StaffUser')],
  ['Principal', require('../models/Principal')],
  ['Admin', require('../models/Admin')],
];

const FILTER = {
  lastLoginAt: { $ne: null },
  $or: [{ lastActiveAt: null }, { lastActiveAt: { $exists: false } }],
};

const main = async () => {
  const uri = resolveMongoUri();
  if (!uri) {
    console.error('Missing MongoDB connection string (MONGODB_URL/MONGODB_URI/MONGO_URI/DATABASE_URL)');
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: process.env.DB_NAME });
  console.log(`backfillLastActive: ${apply ? 'APPLY' : 'DRY RUN'}\n`);

  let grandTotal = 0;
  for (const [name, Model] of MODELS) {
    // eslint-disable-next-line no-await-in-loop
    const count = await Model.countDocuments(FILTER);
    grandTotal += count;
    if (!apply) {
      console.log(`${name}: ${count} document(s) would get lastActiveAt = lastLoginAt`);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const result = await Model.updateMany(FILTER, [
      { $set: { lastActiveAt: '$lastLoginAt' } },
    ]);
    console.log(`${name}: modified ${result.modifiedCount}`);
  }

  console.log(`\nTotal: ${grandTotal} document(s)${apply ? ' processed' : ' would be updated'}`);
  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
