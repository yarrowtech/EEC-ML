const Organization = require('../models/Organization');
const { runWithTenant } = require('../utils/tenantContext');

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
    req.isMainDomain = true;
    return runWithTenant(null, next);
  }

  const slug = resolveSlug(hostname, rootDomain);
  const lookup = slug
    ? { slug, status: 'active' }
    : { customDomains: hostname, status: 'active' };

  try {
    const organization = await Organization.findOne(lookup).lean();
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
