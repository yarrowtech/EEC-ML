require('dotenv').config();
const mongoose = require('../utils/registerTenantPlugin');
const Organization = require('../models/Organization');

const APPLY = process.argv.includes('--apply');
const ROOT_DOMAIN = String(
  process.env.ROOT_DOMAIN || process.env.MAIN_DOMAIN || 'electroniceducare.com'
).trim().toLowerCase();

const slugify = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 55) || 'school';

const nextAvailableSlug = async (base) => {
  let slug = base;
  let suffix = 2;
  while (await Organization.exists({ slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
};

const replaceIdentityIndexes = async (db) => {
  const specifications = {
    admins: [{ field: 'username' }],
    teacherusers: [{ field: 'username' }, { field: 'employeeCode', partial: true }],
    studentusers: [{ field: 'username' }, { field: 'studentCode', partial: true }],
    parentusers: [{ field: 'username' }],
    principals: [{ field: 'username' }, { field: 'email' }],
    staffusers: [{ field: 'username' }, { field: 'employeeCode', partial: true }],
  };

  for (const [collectionName, fields] of Object.entries(specifications)) {
    const exists = await db.listCollections({ name: collectionName }, { nameOnly: true }).hasNext();
    if (!exists) continue;
    const collection = db.collection(collectionName);
    const indexes = await collection.indexes();
    for (const { field, partial } of fields) {
      const legacy = indexes.find((index) => index.unique && Object.keys(index.key).length === 1 && index.key[field] === 1);
      if (legacy) await collection.dropIndex(legacy.name);
      await collection.createIndex(
        { organizationId: 1, [field]: 1 },
        {
          unique: true,
          name: `unique_organization_${field}`,
          ...(partial ? { partialFilterExpression: { [field]: { $type: 'string' } } } : {}),
        }
      );
    }
  }
};

const migrate = async () => {
  const mongoUri = process.env.MONGODB_URL || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URL or MONGODB_URI is required');
  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;
  const schools = await db.collection('schools').find({}).toArray();
  const organizationBySchool = new Map();

  for (const school of schools) {
    let organization = await Organization.findOne({ schoolId: school._id }).lean();
    if (!organization) {
      const baseSlug = slugify(school.code || school.name);
      const slug = await nextAvailableSlug(baseSlug);
      const payload = {
        name: school.name || school.schoolName || `School ${school._id}`,
        slug,
        domain: `${slug}.${ROOT_DOMAIN}`,
        logo: school.logo || '',
        status: school.status === 'inactive' ? 'suspended' : 'active',
        schoolId: school._id,
        settings: { migratedFromSchoolId: String(school._id) },
      };
      if (APPLY) organization = (await Organization.create(payload)).toObject();
      else organization = { ...payload, _id: new mongoose.Types.ObjectId() };
    }
    organizationBySchool.set(String(school._id), organization);
  }

  const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map(({ name }) => name)
    .filter((name) => name !== 'organizations' && !name.startsWith('system.'));
  const totals = { matched: 0, modified: 0, unresolved: 0 };
  const schoolObjectIds = [...organizationBySchool.keys()].map((id) => new mongoose.Types.ObjectId(id));

  for (const collectionName of collections) {
    const collection = db.collection(collectionName);
    let matched = 0;
    let modified = 0;

    for (const [schoolId, organization] of organizationBySchool.entries()) {
      const schoolObjectId = new mongoose.Types.ObjectId(schoolId);
      const filter = collectionName === 'schools'
        ? { _id: schoolObjectId, organizationId: { $exists: false } }
        : { schoolId: schoolObjectId, organizationId: { $exists: false } };
      const count = await collection.countDocuments(filter);
      matched += count;
      if (APPLY && count) {
        const result = await collection.updateMany(filter, {
          $set: { organizationId: organization._id },
        });
        modified += result.modifiedCount;
      }
    }

    const unresolvedFilter = collectionName === 'schools'
      ? { organizationId: { $exists: false }, _id: { $nin: schoolObjectIds } }
      : { organizationId: { $exists: false }, schoolId: { $nin: schoolObjectIds } };
    const unresolved = await collection.countDocuments(unresolvedFilter);
    if (organizationBySchool.size === 1 && unresolved > 0) {
      const [organization] = organizationBySchool.values();
      matched += unresolved;
      if (APPLY) {
        const result = await collection.updateMany(unresolvedFilter, {
          $set: { organizationId: organization._id },
        });
        modified += result.modifiedCount;
      }
    } else {
      totals.unresolved += unresolved;
    }

    if (APPLY) await collection.createIndex({ organizationId: 1 });
    totals.matched += matched;
    totals.modified += modified;
    console.log(`${collectionName}: matched=${matched} modified=${modified} unresolved=${unresolved}`);
  }

  if (APPLY) await replaceIdentityIndexes(db);

  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', organizations: organizationBySchool.size, ...totals }, null, 2));
  if (!APPLY) console.log('No data was changed. Re-run with --apply after reviewing this output.');
  await mongoose.disconnect();
};

migrate().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
