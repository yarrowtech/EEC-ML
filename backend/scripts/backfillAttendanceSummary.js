/**
 * Stores each active student's academic-year attendance on
 * StudentUser.attendanceSummary (present days ÷ school days of the active
 * session, holidays and Sundays excluded). After this runs, the summary is kept
 * current by the StudentUser save hook (on every attendance change) and the
 * daily schedulers/attendanceSummaryCron.js refresh.
 *
 *   node scripts/backfillAttendanceSummary.js            # dry run (counts only)
 *   node scripts/backfillAttendanceSummary.js --apply    # write
 */
const mongoose = require('../utils/registerTenantPlugin');

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
  console.log(`backfillAttendanceSummary: ${apply ? 'APPLY' : 'DRY RUN'}\n`);

  const StudentUser = require('../models/StudentUser');
  if (!apply) {
    const count = await StudentUser.countDocuments({ status: 'Active', schoolId: { $ne: null } });
    console.log(`${count} active student(s) would get attendanceSummary`);
  } else {
    const { refreshAllAttendanceSummaries } = require('../schedulers/attendanceSummaryCron');
    const refreshed = await refreshAllAttendanceSummaries();
    console.log(`Stored attendanceSummary for ${refreshed} student(s)`);
  }

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
