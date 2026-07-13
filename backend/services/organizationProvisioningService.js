const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const School = require('../models/School');
const { logger } = require('../utils/logger');

const ROOT_DOMAIN = () => String(
  process.env.ROOT_DOMAIN || process.env.MAIN_DOMAIN || 'electroniceducare.com'
).trim().toLowerCase();

const RESERVED_SLUGS = new Set(['www', 'api', 'admin', 'mail', 'dashboard', 'support', 'app', 'docs']);

const slugify = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 50) || 'school';

const schoolLogoUrl = (school) => {
  if (!school?.logo) return '';
  if (typeof school.logo === 'string') return school.logo;
  return school.logo.secure_url || school.logo.url || school.logo.path || '';
};

const backfillSchoolOrganizationId = async (schoolId, organizationId) => {
  const db = mongoose.connection?.db;
  if (!db) return;
  const collections = (await db.listCollections({}, { nameOnly: false }).toArray())
    .filter(({ name, type }) => (
      name !== 'organizations'
      && !name.startsWith('system.')
      && (!type || type === 'collection')
    ))
    .map(({ name }) => name);

  await Promise.all(collections.map(async (collectionName) => {
    try {
      const collection = db.collection(collectionName);
      const identityFilter = collectionName === 'schools'
        ? { _id: schoolId }
        : { schoolId };
      await collection.updateMany(
        {
          ...identityFilter,
          $or: [
            { organizationId: { $exists: false } },
            { organizationId: null },
          ],
        },
        { $set: { organizationId } }
      );
    } catch (error) {
      logger.warn({ err: error, collectionName, schoolId }, 'Legacy organization backfill skipped collection');
    }
  }));
};

const ensureOrganizationForSchool = async ({ schoolId, preferredOrganizationId = null }) => {
  if (!mongoose.isValidObjectId(schoolId)) return null;

  const existing = await Organization.findOne({ schoolId }).lean();
  if (existing) return existing.status === 'active' ? existing : null;

  const school = await School.findById(schoolId).select('name code logo status').lean();
  if (!school || school.status === 'inactive') return null;

  const preferredId = mongoose.isValidObjectId(preferredOrganizationId)
    ? preferredOrganizationId
    : school._id;
  let baseSlug = slugify(school.code || school.name);
  if (RESERVED_SLUGS.has(baseSlug)) baseSlug = `school-${baseSlug}`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    try {
      const organization = await Organization.create({
        _id: preferredId,
        name: school.name || `School ${school._id}`,
        slug,
        domain: `${slug}.${ROOT_DOMAIN()}`,
        logo: schoolLogoUrl(school),
        favicon: schoolLogoUrl(school),
        status: 'active',
        schoolId: school._id,
        settings: { automaticallyProvisioned: true },
      });
      await backfillSchoolOrganizationId(school._id, organization._id);
      return organization.toObject();
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const concurrentlyCreated = await Organization.findOne({ schoolId }).lean();
      if (concurrentlyCreated) {
        return concurrentlyCreated.status === 'active' ? concurrentlyCreated : null;
      }
    }
  }

  throw new Error('Unable to allocate a unique organization domain');
};

module.exports = {
  backfillSchoolOrganizationId,
  ensureOrganizationForSchool,
};
