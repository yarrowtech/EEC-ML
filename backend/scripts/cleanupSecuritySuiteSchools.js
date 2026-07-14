/* eslint-disable no-console */
/**
 * Removes school registrations created by the security test suite
 * (productionSecurityAttackSuite.js / finalSchoolRegistrationSecuritySuite.js).
 *
 * Matches ONLY the suite's naming so real schools are never touched:
 *   - name starts with "Security Suite School"
 *   - officialEmail / contactEmail on the @example.org test domain
 *
 * Dry-run by default. Pass --apply to actually delete.
 *   node scripts/cleanupSecuritySuiteSchools.js          # preview
 *   node scripts/cleanupSecuritySuiteSchools.js --apply  # delete
 */
require('dotenv').config();
const mongoose = require('mongoose');
const School = require('../models/School');

const APPLY = process.argv.includes('--apply');

const FILTER = {
  $or: [
    { name: /^Security Suite School/i },
    { officialEmail: /@example\.org$/i },
    { contactEmail: /@example\.org$/i },
  ],
};

(async () => {
  if (!process.env.MONGODB_URL) {
    console.error('MONGODB_URL is not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URL);
  try {
    const matches = await School.find(FILTER).select('name officialEmail registrationStatus').lean();

    if (matches.length === 0) {
      console.log('No security-suite test schools found. Nothing to do.');
      return;
    }

    console.log(`Found ${matches.length} security-suite test school(s):`);
    matches.forEach((s) => {
      console.log(`  - [${s.registrationStatus}] ${s.name} <${s.officialEmail || 'no-email'}>`);
    });

    if (!APPLY) {
      console.log('\nDry run — no changes made. Re-run with --apply to delete these.');
      return;
    }

    const result = await School.deleteMany(FILTER);
    console.log(`\nDeleted ${result.deletedCount} test school(s).`);
  } finally {
    await mongoose.disconnect();
  }
})().catch((err) => {
  console.error('Cleanup failed:', err.message);
  process.exitCode = 1;
});
