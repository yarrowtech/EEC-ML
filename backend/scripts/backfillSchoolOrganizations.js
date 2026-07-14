/* eslint-disable no-console */
/**
 * Backfills tenant Organizations for active schools that don't have one yet.
 *
 * Organizations are now provisioned automatically when a school registration
 * is approved, but schools approved BEFORE that change only get an org lazily
 * (on first portal login). This script provisions them all up front.
 *
 * Idempotent — skips schools that already have an org. Dry-run by default.
 *   node scripts/backfillSchoolOrganizations.js          # preview
 *   node scripts/backfillSchoolOrganizations.js --apply  # provision
 */
require('dotenv').config();
const mongoose = require('mongoose');
const School = require('../models/School');
const Organization = require('../models/Organization');
const { ensureOrganizationForSchool } = require('../services/organizationProvisioningService');

const APPLY = process.argv.includes('--apply');

(async () => {
  if (!process.env.MONGODB_URL) {
    console.error('MONGODB_URL is not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URL);
  try {
    const activeSchools = await School.find({ status: 'active' }).select('name').lean();
    const orgs = await Organization.find({}).select('schoolId').lean();
    const withOrg = new Set(orgs.map((o) => String(o.schoolId)));
    const missing = activeSchools.filter((s) => !withOrg.has(String(s._id)));

    console.log(`Active schools: ${activeSchools.length} | with org: ${withOrg.size} | missing: ${missing.length}`);
    if (missing.length === 0) {
      console.log('Every active school already has an organization. Nothing to do.');
      return;
    }

    console.log('\nActive schools without an organization:');
    missing.forEach((s) => console.log(`  - ${s.name} (${s._id})`));

    if (!APPLY) {
      console.log('\nDry run — no changes made. Re-run with --apply to provision these organizations.');
      return;
    }

    console.log('\nProvisioning...');
    let created = 0;
    let failed = 0;
    for (const school of missing) {
      try {
        const org = await ensureOrganizationForSchool({ schoolId: school._id });
        if (org) {
          created += 1;
          console.log(`  ✓ ${school.name} -> ${org.slug}.${org.domain?.split('.').slice(1).join('.') || ''} (${org.slug})`);
        } else {
          failed += 1;
          console.log(`  ✗ ${school.name} — provisioning returned null (school inactive?)`);
        }
      } catch (err) {
        failed += 1;
        console.log(`  ✗ ${school.name} — ${err.message}`);
      }
    }
    console.log(`\nDone. Provisioned ${created}, failed ${failed}.`);
  } finally {
    await mongoose.disconnect();
  }
})().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exitCode = 1;
});
