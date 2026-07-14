const express = require('express');
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const adminAuth = require('../middleware/adminAuth');
const Payment = require('../models/Payment');
const School = require('../models/School');
const StudentUser = require('../models/StudentUser');
const BillingSetting = require('../models/BillingSetting');
const { readAuthenticatedTenantScope } = require('../utils/authTenantScope');
const {
  TIER_KEYS,
  getOrCreateBillingSetting,
  sanitizeBillingSetting,
  computeMonthlyBill,
} = require('../utils/billing');
const { recordPlatformAudit } = require('../utils/platformAudit');

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

// Note: organizations are provisioned automatically when a school registration
// is approved (see routes/schoolRoutes.js -> ensureOrganizationForSchool), so
// there is intentionally no manual "create organization" endpoint. This keeps
// School the single source of truth and prevents orphan tenants.

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
    const [organizations, transactionCounts, billingSetting] = await Promise.all([
      Organization.find({}).sort({ name: 1 }).lean(),
      Payment.aggregate([
        { $group: { _id: '$organizationId', totalTransactions: { $sum: 1 }, capturedTransactions: {
          $sum: { $cond: [{ $eq: ['$status', 'captured'] }, 1, 0] },
        } } },
      ]),
      getOrCreateBillingSetting(),
    ]);
    const schoolIds = organizations.map((item) => item.schoolId).filter(Boolean);
    const [schools, studentCounts] = await Promise.all([
      School.find({ _id: { $in: schoolIds } })
        .select('subscriptionStatus subscriptionPlan')
        .lean(),
      // Active students grouped per school for per-student billing.
      StudentUser.aggregate([
        { $match: { schoolId: { $in: schoolIds }, status: { $ne: 'Inactive' } } },
        { $group: { _id: '$schoolId', count: { $sum: 1 } } },
      ]),
    ]);
    const schoolMap = new Map(schools.map((school) => [String(school._id), school]));
    const countMap = new Map(transactionCounts.map((item) => [String(item._id), item]));
    const studentMap = new Map(studentCounts.map((item) => [String(item._id), item.count]));

    const pricing = sanitizeBillingSetting(billingSetting);
    let totalMonthlyRevenue = 0;
    let totalStudents = 0;

    const rows = organizations.map((organization) => {
      const gateway = organization.paymentGateway || {};
      const counts = countMap.get(String(organization._id)) || {};
      const school = schoolMap.get(String(organization.schoolId)) || {};
      const studentCount = Number(studentMap.get(String(organization.schoolId)) || 0);
      const bill = computeMonthlyBill(studentCount, billingSetting);
      totalMonthlyRevenue += bill.monthlyBill;
      totalStudents += studentCount;
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
        studentCount,
        tierKey: bill.tierKey,
        tierLabel: bill.tierLabel,
        pricePerStudent: bill.pricePerStudent,
        monthlyBill: bill.monthlyBill,
      };
    });

    return res.json({
      organizations: rows,
      pricing,
      totals: {
        students: totalStudents,
        monthlyRevenue: Math.round(totalMonthlyRevenue * 100) / 100,
        currency: pricing.currency,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Per-student pricing tiers (super admin only)
router.get('/super-admin/billing/pricing', adminAuth, ensureSuperAdmin, async (_req, res, next) => {
  try {
    const setting = await getOrCreateBillingSetting();
    return res.json({ pricing: sanitizeBillingSetting(setting) });
  } catch (error) {
    return next(error);
  }
});

router.put('/super-admin/billing/pricing', adminAuth, ensureSuperAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const update = {};

    if (body.currency !== undefined) {
      if (typeof body.currency !== 'string' || !body.currency.trim()) {
        return res.status(400).json({ error: 'currency must be a non-empty string' });
      }
      update.currency = body.currency.trim().toUpperCase().slice(0, 8);
    }

    const tiers = body.tiers || {};
    for (const key of TIER_KEYS) {
      const tier = tiers[key];
      if (tier === undefined) continue;
      if (tier.pricePerStudent !== undefined) {
        const price = Number(tier.pricePerStudent);
        if (!Number.isFinite(price) || price < 0) {
          return res.status(400).json({ error: `Invalid price for ${key}` });
        }
        update[`tiers.${key}.pricePerStudent`] = Math.round(price * 100) / 100;
      }
      if (tier.label !== undefined) {
        if (typeof tier.label !== 'string' || tier.label.length > 80) {
          return res.status(400).json({ error: `Invalid label for ${key}` });
        }
        update[`tiers.${key}.label`] = tier.label.trim();
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No valid pricing fields provided' });
    }

    const setting = await BillingSetting.findOneAndUpdate(
      { key: 'global' },
      { $set: update, $setOnInsert: { key: 'global' } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    await recordPlatformAudit(req, {
      action: 'billing.pricing_update',
      entity: 'billing_setting',
      meta: { fields: Object.keys(update) },
    });

    return res.json({ pricing: sanitizeBillingSetting(setting) });
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
