const express = require('express');
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const adminAuth = require('../middleware/adminAuth');
const Payment = require('../models/Payment');
const School = require('../models/School');
const { readAuthenticatedTenantScope } = require('../utils/authTenantScope');

const router = express.Router();

const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'admin',
  'mail',
  'dashboard',
  'support',
  'app',
  'docs',
]);

const IGNORED_NAME_WORDS = new Set([
  'st',
  'saint',
  'school',
  'college',
  'academy',
  'institute',
]);

const createSlug = (name = '') => {
  const words = String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const meaningfulWords = words.filter((word) => !IGNORED_NAME_WORDS.has(word));
  return (meaningfulWords.length ? meaningfulWords : words).join('-').slice(0, 63);
};

const normalizeCustomDomain = (value = '') => String(value).trim().toLowerCase().replace(/\.$/, '');
const isValidHostname = (value) => (
  value.length <= 253
  && value.includes('.')
  && value.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
);

const ensureSuperAdmin = (req, res, next) => {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  if (!req.isMainDomain) {
    return res.status(403).json({ error: 'Organization management is only available on the main domain' });
  }
  return next();
};

const resolveSchoolLogo = (school) => {
  if (!school?.logo) return '';
  if (typeof school.logo === 'string') return school.logo;
  return school.logo.secure_url || school.logo.url || school.logo.path || '';
};

const publicOrganization = (organization, school = null) => {
  const schoolLogo = resolveSchoolLogo(school);
  return ({
    id: organization._id,
    name: school?.name || organization.name,
    slug: organization.slug,
    domain: organization.domain,
    logo: schoolLogo || organization.logo,
    favicon: organization.favicon || schoolLogo || organization.logo,
    primaryColor: organization.primaryColor,
    secondaryColor: organization.secondaryColor,
    theme: organization.theme,
    settings: organization.settings || {},
  });
};

const publicSchoolBranding = (school) => {
  const logo = resolveSchoolLogo(school);
  return {
    id: null,
    name: school.name,
    slug: '',
    domain: '',
    logo,
    favicon: logo,
    primaryColor: '#2563eb',
    secondaryColor: '#0f172a',
    theme: 'light',
    settings: {},
  };
};

router.get('/tenant', async (req, res, next) => {
  try {
    let organization = req.organization || null;
    let schoolId = organization?.schoolId || null;

    // A user can sign in through the shared EEC domain (or localhost). Once
    // authenticated, resolve branding from the signed tenant claims instead of
    // continuing to show the platform branding.
    if (!organization) {
      const scope = readAuthenticatedTenantScope(req);
      if (scope?.organizationId) {
        organization = await Organization.findOne({
          _id: scope.organizationId,
          status: 'active',
        }).lean();
      }
      if (!organization && scope?.schoolId) {
        organization = await Organization.findOne({
          schoolId: scope.schoolId,
          status: 'active',
        }).lean();
      }
      schoolId = organization?.schoolId || scope?.schoolId || null;
    }

    if (!organization && !schoolId) {
      return res.json({ organization: null, isMainDomain: true });
    }

    const school = schoolId
      ? await School.findById(schoolId).select('name logo status').lean()
      : null;
    if (!organization && !school) {
      return res.json({ organization: null, isMainDomain: true });
    }
    if (school && school.status === 'inactive') {
      return res.json({ organization: null, isMainDomain: true });
    }
    return res.json({
      organization: organization
        ? publicOrganization(organization, school)
        : publicSchoolBranding(school),
      isMainDomain: false,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/super-admin/organizations', adminAuth, ensureSuperAdmin, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (name.length < 2 || name.length > 160) {
      return res.status(400).json({ error: 'name must contain between 2 and 160 characters' });
    }

    const slug = createSlug(req.body?.slug || name);
    if (!slug || RESERVED_SLUGS.has(slug)) {
      return res.status(400).json({ error: 'The generated organization slug is reserved or invalid' });
    }

    const rootDomain = String(process.env.ROOT_DOMAIN || process.env.MAIN_DOMAIN || 'electroniceducare.com')
      .trim()
      .toLowerCase();
    const domain = `${slug}.${rootDomain}`;
    const duplicate = await Organization.findOne({ $or: [{ slug }, { domain }] }).select('_id').lean();
    if (duplicate) {
      return res.status(409).json({ error: 'An organization with this slug or domain already exists' });
    }

    const organization = await Organization.create({
      name,
      slug,
      domain,
      logo: req.body?.logo || '',
      favicon: req.body?.favicon || '',
      primaryColor: req.body?.primaryColor || undefined,
      secondaryColor: req.body?.secondaryColor || undefined,
      settings: req.body?.settings || {},
    });

    return res.status(201).json({
      organizationId: organization._id,
      slug: organization.slug,
      domain: organization.domain,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Organization slug or domain already exists' });
    }
    return next(error);
  }
});

router.get('/super-admin/organizations', adminAuth, ensureSuperAdmin, async (req, res, next) => {
  try {
    const organizations = await Organization.find({})
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ organizations });
  } catch (error) {
    return next(error);
  }
});

router.get('/super-admin/organizations/payment-status', adminAuth, ensureSuperAdmin, async (_req, res, next) => {
  try {
    const [organizations, transactionCounts] = await Promise.all([
      Organization.find({}).sort({ name: 1 }).lean(),
      Payment.aggregate([
        { $group: { _id: '$organizationId', totalTransactions: { $sum: 1 }, capturedTransactions: {
          $sum: { $cond: [{ $eq: ['$status', 'captured'] }, 1, 0] },
        } } },
      ]),
    ]);
    const schoolIds = organizations.map((item) => item.schoolId).filter(Boolean);
    const schools = await School.find({ _id: { $in: schoolIds } })
      .select('subscriptionStatus subscriptionPlan')
      .lean();
    const schoolMap = new Map(schools.map((school) => [String(school._id), school]));
    const countMap = new Map(transactionCounts.map((item) => [String(item._id), item]));
    return res.json({
      organizations: organizations.map((organization) => {
        const gateway = organization.paymentGateway || {};
        const counts = countMap.get(String(organization._id)) || {};
        const school = schoolMap.get(String(organization.schoolId)) || {};
        return {
          organizationId: organization._id,
          name: organization.name,
          domain: organization.domain,
          paymentEnabled: Boolean(gateway.enabled),
          provider: gateway.provider || 'razorpay',
          mode: gateway.mode || 'test',
          lastVerifiedAt: gateway.razorpay?.lastVerifiedAt || null,
          totalTransactions: Number(counts.totalTransactions || 0),
          capturedTransactions: Number(counts.capturedTransactions || 0),
          subscriptionStatus: school.subscriptionStatus || organization.subscription?.status || 'unknown',
          subscriptionPlan: school.subscriptionPlan || organization.subscription?.plan || 'unassigned',
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/super-admin/organizations/stats', adminAuth, ensureSuperAdmin, async (_req, res, next) => {
  try {
    const [total, active, suspended] = await Promise.all([
      Organization.countDocuments({}),
      Organization.countDocuments({ status: 'active' }),
      Organization.countDocuments({ status: 'suspended' }),
    ]);
    return res.json({ total, active, suspended });
  } catch (error) {
    return next(error);
  }
});

router.patch('/super-admin/organizations/:id', adminAuth, ensureSuperAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid organization id' });
    }
    const allowed = [
      'name',
      'logo',
      'favicon',
      'primaryColor',
      'secondaryColor',
      'theme',
      'status',
      'settings',
      'subscription',
      'customDomains',
    ];
    const update = Object.fromEntries(
      allowed
        .filter((key) => Object.prototype.hasOwnProperty.call(req.body || {}, key))
        .map((key) => [key, req.body[key]])
    );
    if (Object.prototype.hasOwnProperty.call(update, 'customDomains')) {
      if (!Array.isArray(update.customDomains)) {
        return res.status(400).json({ error: 'customDomains must be an array' });
      }
      update.customDomains = [...new Set(update.customDomains.map(normalizeCustomDomain).filter(Boolean))];
      const rootDomain = String(process.env.ROOT_DOMAIN || process.env.MAIN_DOMAIN || 'electroniceducare.com')
        .trim()
        .toLowerCase();
      if (update.customDomains.some((domain) => !isValidHostname(domain) || domain === rootDomain || domain === `www.${rootDomain}`)) {
        return res.status(400).json({ error: 'One or more custom domains are invalid or reserved' });
      }
      if (update.customDomains.length) {
        const collision = await Organization.findOne({
          _id: { $ne: req.params.id },
          $or: [
            { domain: { $in: update.customDomains } },
            { customDomains: { $in: update.customDomains } },
          ],
        }).select('_id').lean();
        if (collision) return res.status(409).json({ error: 'A custom domain is already in use' });
      }
    }
    const organization = await Organization.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!organization) return res.status(404).json({ error: 'Organization not found' });
    return res.json({ organization });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'A custom domain is already in use' });
    }
    return next(error);
  }
});

module.exports = router;
module.exports.RESERVED_SLUGS = RESERVED_SLUGS;
module.exports.createSlug = createSlug;
module.exports.readAuthenticatedTenantScope = readAuthenticatedTenantScope;
