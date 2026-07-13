const express = require('express');
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const adminAuth = require('../middleware/adminAuth');

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

const ensureSuperAdmin = (req, res, next) => {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  if (!req.isMainDomain) {
    return res.status(403).json({ error: 'Organization management is only available on the main domain' });
  }
  return next();
};

const publicOrganization = (organization) => ({
  id: organization._id,
  name: organization.name,
  slug: organization.slug,
  domain: organization.domain,
  logo: organization.logo,
  favicon: organization.favicon,
  primaryColor: organization.primaryColor,
  secondaryColor: organization.secondaryColor,
  theme: organization.theme,
  settings: organization.settings || {},
});

router.get('/tenant', (req, res) => {
  if (!req.organization) {
    return res.json({ organization: null, isMainDomain: true });
  }
  return res.json({ organization: publicOrganization(req.organization), isMainDomain: false });
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
    if (update.customDomains) {
      update.customDomains = [...new Set(update.customDomains.map((value) => String(value).trim().toLowerCase()))];
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
