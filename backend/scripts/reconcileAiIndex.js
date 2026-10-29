// Index-freshness reconciliation: diffs the set of published teaching materials
// in Mongo against what is actually indexed in the AI service's Qdrant collection.
//
// Reports three things (read-only — this script never writes to Mongo or Qdrant):
//   1. Not indexed   — published/enabled materials with zero chunks in Qdrant.
//   2. Orphaned      — material IDs present in Qdrant that are not currently
//                       published/enabled (stale vectors from an unpublish/disable
//                       that should have triggered deletion but may not have).
//   3. Incomplete    — indexed materials missing a required payload field
//                       (school_id/class_id/material_id/subject_name/chapter_title),
//                       which would silently narrow or break retrieval scoping.
//
// Usage: node scripts/reconcileAiIndex.js [--schoolId=<id>]
const mongoose = require('mongoose');
require('../utils/aiServiceAuth');
const axios = require('axios');

const { MONGODB_URI, MONGO_URI, DATABASE_URL } = process.env;
const resolveMongoUri = () => MONGODB_URI || MONGO_URI || DATABASE_URL || '';
const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');

const parseArg = (key) => {
  const prefix = `--${key}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
};

const main = async () => {
  const uri = resolveMongoUri();
  if (!uri) {
    console.error('Missing MongoDB connection string in env (MONGODB_URI/MONGO_URI/DATABASE_URL)');
    process.exit(1);
  }
  const schoolId = parseArg('schoolId');

  await mongoose.connect(uri, { dbName: process.env.DB_NAME });
  const TeachingMaterial = require('../models/TeachingMaterial');

  const filter = { status: 'published', publishedForStudentPortal: true, isEnabled: true };
  if (schoolId && mongoose.isValidObjectId(schoolId)) filter.schoolId = schoolId;

  const publishedMaterials = await TeachingMaterial.find(filter).select('_id title').lean();
  const publishedIds = new Set(publishedMaterials.map((m) => String(m._id)));

  const { data } = await axios.get(`${AI_SERVICE_URL}/ingest/index-audit`, { timeout: 120000 });
  const indexed = data?.materials || {};
  const indexedIds = new Set(Object.keys(indexed));

  const notIndexed = publishedMaterials.filter((m) => !indexedIds.has(String(m._id)));
  const orphaned = [...indexedIds].filter((id) => !publishedIds.has(id));
  const incomplete = Object.entries(indexed).filter(
    ([id, info]) => publishedIds.has(id) && Array.isArray(info.missingFields) && info.missingFields.length
  );

  console.log(`Published materials in scope: ${publishedMaterials.length}`);
  console.log(`Materials indexed in Qdrant:  ${indexedIds.size}`);
  console.log('');

  console.log(`Not indexed (${notIndexed.length}):`);
  notIndexed.forEach((m) => console.log(`  - ${m._id}  ${m.title || ''}`));

  console.log('');
  console.log(`Orphaned in Qdrant (${orphaned.length}):`);
  orphaned.forEach((id) => console.log(`  - ${id}  (chunks: ${indexed[id].chunkCount})`));

  console.log('');
  console.log(`Incomplete metadata (${incomplete.length}):`);
  incomplete.forEach(([id, info]) => console.log(`  - ${id}  missing: ${info.missingFields.join(', ')}`));

  await mongoose.disconnect();
  process.exit(0);
};

main().catch((err) => {
  console.error('Reconciliation failed:', err.message);
  process.exit(1);
});
