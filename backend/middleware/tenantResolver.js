const Organization = require('../models/Organization');
const { runWithTenant } = require('../utils/tenantContext');
const { readAuthenticatedTenantScope } = require('../utils/authTenantScope');
const { ensureOrganizationForSchool } = require('../services/organizationProvisioningService');

// tenantResolver runs on every single API request, so an uncached organization
// lookup here is a full extra Mongo round trip paid by every request in the
// app (a page firing 10 parallel fetches pays it 10 times). Organization
// status/slug/domain changes are rare admin actions, so a short TTL cache
// (same pattern as the students/teachers directory caches in
// adminUserManagement.js) cuts that round trip to ~once per 30s per key,
// with a bounded staleness window that's an accepted tradeoff elsewhere in
// this codebase too.
const ORG_CACHE_TTL_MS = 30 * 1000;
const orgCache = new Map(); // cacheKey -> { data, expires }
const getCachedOrg = (key) => {
  const entry = orgCache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data;
  if (entry) orgCache.delete(key);
  return undefined;
};
const setCachedOrg = (key, data) => orgCache.set(key, { data, expires: Date.now() + ORG_CACHE_TTL_MS });

const normalizeHostname = (hostname = '') => String(hostname)
  .trim()
  .toLowerCase()
  .replace(/^\[|\]$/g, '')
  .replace(/\.$/, '');

const getRootDomain = () => normalizeHostname(
  process.env.ROOT_DOMAIN || process.env.MAIN_DOMAIN || 'electroniceducare.com'
);

const isMainHostname = (hostname, rootDomain = getRootDomain()) => (
  hostname === rootDomain
  || hostname === `www.${rootDomain}`
  || hostname === 'localhost'
  || hostname === '127.0.0.1'
  || hostname === '::1'
  || hostname === `api.${rootDomain}`
);

const resolveSlug = (hostname, rootDomain = getRootDomain()) => {
  if (isMainHostname(hostname, rootDomain)) return null;
  const suffix = `.${rootDomain}`;
  if (!hostname.endsWith(suffix)) return null;
  const subdomain = hostname.slice(0, -suffix.length);
  return subdomain && !subdomain.includes('.') ? subdomain : null;
};

const tenantResolver = async (req, res, next) => {
  const hostname = normalizeHostname(req.hostname);
  const rootDomain = getRootDomain();

  if (isMainHostname(hostname, rootDomain)) {
    try {
      const scope = readAuthenticatedTenantScope(req);
      let organization = null;
      if (scope?.organizationId) {
        const cacheKey = `id:${scope.organizationId}`;
        organization = getCachedOrg(cacheKey);
        if (organization === undefined) {
          organization = await Organization.findOne({
            _id: scope.organizationId,
            status: 'active',
          }).lean();
          setCachedOrg(cacheKey, organization || null);
        }
      }
      if (!organization && scope?.schoolId) {
        const cacheKey = `school:${scope.schoolId}`;
        organization = getCachedOrg(cacheKey);
        if (organization === undefined) {
          organization = await Organization.findOne({
            schoolId: scope.schoolId,
            status: 'active',
          }).lean();
          setCachedOrg(cacheKey, organization || null);
        }
      }
      if (!organization && scope?.schoolId) {
        organization = await ensureOrganizationForSchool({
          schoolId: scope.schoolId,
          preferredOrganizationId: scope.organizationId,
        });
      }

      if (organization) {
        req.organization = organization;
        req.organizationId = organization._id;
        req.isMainDomain = false;
        return runWithTenant(organization, next);
      }

      req.isMainDomain = true;
      return runWithTenant(null, next);
    } catch (error) {
      return next(error);
    }
  }

  const slug = resolveSlug(hostname, rootDomain);
  const lookup = slug
    ? { slug, status: 'active' }
    : { customDomains: hostname, status: 'active' };

  try {
    const cacheKey = `host:${hostname}`;
    let organization = getCachedOrg(cacheKey);
    if (organization === undefined) {
      organization = await Organization.findOne(lookup).lean();
      setCachedOrg(cacheKey, organization || null);
    }
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    req.organization = organization;
    req.organizationId = organization._id;
    req.isMainDomain = false;
    return runWithTenant(organization, next);
  } catch (error) {
    return next(error);
  }
};

module.exports = tenantResolver;
module.exports.getRootDomain = getRootDomain;
module.exports.isMainHostname = isMainHostname;
module.exports.normalizeHostname = normalizeHostname;
module.exports.resolveSlug = resolveSlug;
