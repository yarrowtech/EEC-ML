/**
 * Run `fn` inside the tenant (Organization) context of a school.
 *
 * Code outside an HTTP request — cron jobs, maintenance scripts, debounced
 * timers — has no AsyncLocalStorage tenant, so the tenant plugin would neither
 * scope reads nor stamp `organizationId` on new documents (and documents
 * without it are invisible to every portal). Wrap such work in this.
 * If a tenant context is already active it is reused.
 */
const Organization = require('../models/Organization');
const { runWithTenant, getTenantContext } = require('./tenantContext');

const orgCache = new Map(); // schoolId -> Organization (lean)

const findOrganizationForSchool = async (schoolId) => {
  const key = String(schoolId || '');
  if (!key) return null;
  if (orgCache.has(key)) return orgCache.get(key);
  const org = await Organization.findOne({ $or: [{ schoolId: key }, { _id: key }] }).lean();
  if (org) orgCache.set(key, org);
  return org;
};

const withSchoolTenant = async (schoolId, fn) => {
  if (getTenantContext()?.organizationId) return fn();
  const org = await findOrganizationForSchool(schoolId);
  if (!org) return fn();
  return runWithTenant(org, fn);
};

module.exports = { withSchoolTenant, findOrganizationForSchool };
