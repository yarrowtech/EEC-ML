const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const School = require('../models/School');
const Admin = require('../models/Admin');
const adminAuth = require('../middleware/adminAuth');
const { logSecurityEvent } = require('../utils/securityEventLogger');
const { logBusinessEvent } = require('../utils/businessEventLogger');
const { generatePassword } = require('../utils/generator');
const { sendSchoolApprovalEmail } = require('../utils/mailer');
const { recordPlatformAudit } = require('../utils/platformAudit');
const { ensureOrganizationForSchool } = require('../services/organizationProvisioningService');

const router = express.Router();

const USERNAME_PATTERN = /^[A-Za-z0-9@._-]{3,40}$/;

const schoolInitials = (name = '') =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .join('') || 'SCH';

const generateUniqueAdminUsername = async (schoolName, taken) => {
  const initials = schoolInitials(schoolName);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `EEC-${initials}-${crypto.randomInt(1000, 10000)}`;
    if (taken.has(candidate)) continue;
    const exists = await Admin.exists({ username: candidate });
    if (!exists) return candidate;
  }
  return `EEC-${initials}-${Date.now().toString().slice(-6)}`;
};

const resolveSchoolCampuses = (school) => {
  if (Array.isArray(school.campuses) && school.campuses.length > 0) {
    return school.campuses;
  }
  if (school.campusName) {
    return [{ name: school.campusName, campusType: 'Main' }];
  }
  return [{ name: school.name || 'Main Campus', campusType: 'Main' }];
};

const matchRequestedCredential = (requested, campus, index) => {
  if (!Array.isArray(requested) || requested.length === 0) return null;
  const campusId = String(campus?._id || campus?.id || '');
  const campusName = String(campus?.name || '').trim().toLowerCase();
  return (
    requested.find((entry) => entry?.campusId && String(entry.campusId) === campusId) ||
    requested.find((entry) => String(entry?.campusName || '').trim().toLowerCase() === campusName) ||
    requested[index] ||
    null
  );
};

const ensureSuperAdmin = (req, res, next) => {
  if (!req.isSuperAdmin) {
    logSecurityEvent(req, {
      action: 'security.rbac_violation',
      outcome: 'blocked',
      severity: 'high',
      attack_type: 'rbac_violation',
      riskScore: 82,
      reason: 'Super admin role required for school route',
      statusCode: 403,
      requiredRole: 'super_admin',
    });
    return res.status(403).json({ error: 'Super admin access required' });
  }
   return next();
};

// Create school (super admin only)
router.post('/', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Schools']
  try {
    const { name, code, address, contactEmail, contactPhone, status } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'School name is required' });
    }
    if (!code || !String(code).trim()) {
      return res.status(400).json({ error: 'School code is required' });
    }

    const created = await School.create({
      name: name.trim(),
      code: String(code).trim().toUpperCase(),
      address: address ? String(address).trim() : undefined,
      contactEmail: contactEmail ? String(contactEmail).trim() : undefined,
      contactPhone: contactPhone ? String(contactPhone).trim() : undefined,
      status: status === 'inactive' ? 'inactive' : 'active',
    });

    res.status(201).json(created);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'School code already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

// List schools (admin only; scoped for school admins)
router.get('/', adminAuth, async (req, res) => {
  // #swagger.tags = ['Schools']
  try {
    const filter = {};
    if (!req.isSuperAdmin) {
      filter._id = req.schoolId;
    }
    const schools = await School.find(filter).sort({ createdAt: -1 }).lean();
    res.json(schools);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get pending registrations (super admin only) - must be before /:id
router.get('/registrations/pending', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['School Registration']
  try {
    const schools = await School.find({
      registrationStatus: 'pending'
    })
    .sort({ submittedAt: -1 })
    .lean();

    logBusinessEvent(req, {
      action: 'school_registration.pending_fetch',
      outcome: 'success',
      entity: 'school_registration',
      statusCode: 200,
      resultCount: schools.length,
      adminId: req.admin?.id || req.admin?._id,
    });
    res.json(schools);
  } catch (err) {
    logBusinessEvent(req, {
      action: 'school_registration.pending_fetch',
      outcome: 'failure',
      entity: 'school_registration',
      statusCode: 500,
      reason: err.message,
      adminId: req.admin?.id || req.admin?._id,
    });
    res.status(500).json({ error: err.message });
  }
});

// Get unapproved registrations (super admin only) - must be before /:id
router.get('/registrations/unapproved', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['School Registration']
  try {
    const schools = await School.find({
      registrationStatus: { $ne: 'approved' }
    })
      .sort({ submittedAt: -1 })
      .lean();

    res.json(schools);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve all pending registrations (super admin only) - must be before /:id
router.put('/registrations/approve-all', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['School Registration']
  try {
    const note =
      typeof req.body?.adminNotes === 'string' && req.body.adminNotes.trim()
        ? req.body.adminNotes.trim()
        : null;

    const pendingCount = await School.countDocuments({
      registrationStatus: 'pending',
    });
    if (pendingCount === 0) {
      return res.json({ message: 'No pending registrations to approve', updated: 0 });
    }

    const update = {
      registrationStatus: 'approved',
      status: 'active',
      reviewedAt: new Date(),
      reviewedBy: req.admin.id || req.admin._id,
    };
    if (note) {
      update.adminNotes = note;
    }

    const result = await School.updateMany(
      { registrationStatus: 'pending' },
      { $set: update }
    );

    await recordPlatformAudit(req, {
      action: 'school_registration.approve_all',
      entity: 'school_registration',
      meta: { updated: result.modifiedCount ?? result.nModified ?? 0 },
    });

    res.json({
      message: 'Approved all pending registrations',
      matched: result.matchedCount ?? result.n ?? 0,
      updated: result.modifiedCount ?? result.nModified ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all pending registrations (super admin only) - destructive operation
router.delete('/registrations/pending', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['School Registration']
  try {
    const confirmation = String(req.query?.confirm || '').trim().toUpperCase();
    if (confirmation !== 'DELETE') {
      return res.status(400).json({
        error: 'Confirmation required. Pass query param confirm=DELETE to proceed.'
      });
    }

    const pendingCount = await School.countDocuments({ registrationStatus: 'pending' });
    if (pendingCount === 0) {
      return res.json({ message: 'No pending registrations to delete', deleted: 0 });
    }

    const result = await School.deleteMany({ registrationStatus: 'pending' });
    const deleted = result.deletedCount ?? result.n ?? 0;

    await recordPlatformAudit(req, {
      action: 'school_registration.pending_bulk_delete',
      entity: 'school_registration',
      meta: { deleted },
    });

    logBusinessEvent(req, {
      action: 'school_registration.pending_bulk_delete',
      outcome: 'success',
      entity: 'school_registration',
      statusCode: 200,
      deletedCount: deleted,
      adminId: req.admin?.id || req.admin?._id,
    });

    res.json({
      message: 'Deleted pending registrations',
      deleted,
    });
  } catch (err) {
    logBusinessEvent(req, {
      action: 'school_registration.pending_bulk_delete',
      outcome: 'failure',
      entity: 'school_registration',
      statusCode: 500,
      reason: err.message,
      adminId: req.admin?.id || req.admin?._id,
    });
    res.status(500).json({ error: err.message });
  }
});

// Get single registration details (super admin only) - must be before /:id
router.get('/registrations/:id', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['School Registration']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid school id' });
    }

    const school = await School.findById(id).lean();
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    res.json(school);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve registration (super admin only) - must be before /:id
// Atomically transitions pending -> approved, provisions one school-admin
// account per campus with a server-generated password, emails the school,
// and returns the credentials exactly once in the response.
router.put('/registrations/:id/approve', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['School Registration']
  const createdAdminIds = [];
  let approvedSchool = null;
  try {
    const { id } = req.params;
    const { adminNotes, contactEmail, credentials } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid school id' });
    }

    if (credentials !== undefined) {
      if (!Array.isArray(credentials)) {
        return res.status(400).json({ error: 'credentials must be an array' });
      }
      for (const entry of credentials) {
        const username = String(entry?.username || '').trim();
        if (username && !USERNAME_PATTERN.test(username)) {
          return res.status(400).json({
            error: `Invalid username "${username}". Use 3-40 letters, numbers, @ . _ or -`,
          });
        }
      }
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contactEmail))) {
      return res.status(400).json({ error: 'Invalid contact email' });
    }

    // Atomic guard: only one approval can win, and re-approval is rejected.
    const school = await School.findOneAndUpdate(
      { _id: id, registrationStatus: 'pending' },
      {
        $set: {
          registrationStatus: 'approved',
          status: 'active',
          activatedAt: new Date(),
          activatedBy: req.admin.id || req.admin._id,
          reviewedAt: new Date(),
          reviewedBy: req.admin.id || req.admin._id,
          ...(adminNotes ? { adminNotes: String(adminNotes).trim() } : {}),
        },
      },
      { new: true }
    );

    if (!school) {
      const existing = await School.findById(id).select('registrationStatus').lean();
      if (!existing) {
        return res.status(404).json({ error: 'School not found' });
      }
      return res.status(409).json({
        error: `School registration has already been ${existing.registrationStatus}`,
      });
    }
    approvedSchool = school;

    // Provision one admin account per campus. Passwords are CSPRNG-generated
    // server-side and never persisted anywhere in plaintext.
    const campuses = resolveSchoolCampuses(school);
    const requested = Array.isArray(credentials) ? credentials : [];
    const takenUsernames = new Set();
    const issuedCredentials = [];

    for (let i = 0; i < campuses.length; i += 1) {
      const campus = campuses[i];
      const requestedEntry = matchRequestedCredential(requested, campus, i);
      let username = String(requestedEntry?.username || '').trim();

      if (username) {
        if (takenUsernames.has(username) || (await Admin.exists({ username }))) {
          throw Object.assign(new Error(`Username "${username}" is already in use`), { statusCode: 409 });
        }
      } else {
        username = await generateUniqueAdminUsername(school.name, takenUsernames);
      }
      takenUsernames.add(username);

      const password = generatePassword(12);
      const admin = await Admin.create({
        username,
        password,
        name: school.name,
        email: school.officialEmail || school.contactEmail || undefined,
        role: 'admin',
        status: 'active',
        schoolId: school._id,
        campusId: campus?._id ? String(campus._id) : null,
        campusName: campus?.name || null,
        campusType: campus?.campusType || null,
        // Force the password-change flow on first login.
        lastLoginAt: null,
      });
      createdAdminIds.push(admin._id);
      issuedCredentials.push({
        campusName: campus?.name || `Campus ${i + 1}`,
        campusType: campus?.campusType || 'Campus',
        username,
        password,
      });
    }

    // Provision the tenant Organization now that the school is active, so its
    // branded portal + payment gateway exist immediately instead of being
    // created lazily on first login. Idempotent and best-effort.
    let organizationProvisioned = false;
    try {
      const organization = await ensureOrganizationForSchool({ schoolId: school._id });
      organizationProvisioned = Boolean(organization);
    } catch (orgErr) {
      logBusinessEvent(req, {
        action: 'school_registration.org_provision',
        outcome: 'failure',
        entity: 'organization',
        entityId: school._id,
        reason: orgErr.message,
        adminId: req.admin?.id || req.admin?._id,
      });
    }

    // Email the credentials to the school; failure is reported, not fatal.
    const notifiedEmail = String(contactEmail || school.officialEmail || school.contactEmail || '').trim();
    let emailSent = false;
    if (notifiedEmail) {
      try {
        await sendSchoolApprovalEmail({
          to: notifiedEmail,
          schoolName: school.name,
          campuses: issuedCredentials,
          loginUrl: process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
        });
        emailSent = true;
      } catch (emailErr) {
        logBusinessEvent(req, {
          action: 'school_registration.approval_email',
          outcome: 'failure',
          entity: 'school',
          entityId: school._id,
          reason: emailErr.message,
          adminId: req.admin?.id || req.admin?._id,
        });
      }
    }

    await recordPlatformAudit(req, {
      action: 'school_registration.approve',
      entity: 'school',
      entityId: school._id,
      schoolId: school._id,
      meta: {
        transition: 'pending_to_approved_active',
        adminsProvisioned: issuedCredentials.map((entry) => entry.username),
        organizationProvisioned,
        emailSent,
        notifiedEmail: emailSent ? notifiedEmail : undefined,
      },
    });
    logBusinessEvent(req, {
      action: 'school_registration.approve',
      outcome: 'success',
      entity: 'school',
      entityId: school._id,
      statusCode: 200,
      schoolId: school._id,
      adminId: req.admin?.id || req.admin?._id,
      transition: 'pending_to_approved_active',
      adminsProvisioned: issuedCredentials.length,
    });

    res.json({
      message: 'School registration approved successfully',
      school,
      credentials: issuedCredentials,
      organizationProvisioned,
      emailSent,
      notifiedEmail: notifiedEmail || null,
    });
  } catch (err) {
    // Roll back partial provisioning so a failed approval leaves no residue.
    if (createdAdminIds.length) {
      await Admin.deleteMany({ _id: { $in: createdAdminIds } }).catch(() => {});
    }
    if (approvedSchool) {
      await School.updateOne(
        { _id: approvedSchool._id },
        {
          $set: { registrationStatus: 'pending', status: 'inactive' },
          $unset: { activatedAt: 1, activatedBy: 1, reviewedAt: 1, reviewedBy: 1 },
        }
      ).catch(() => {});
    }
    logBusinessEvent(req, {
      action: 'school_registration.approve',
      outcome: 'failure',
      entity: 'school',
      entityId: req.params?.id,
      statusCode: err.statusCode || 500,
      reason: err.message,
      adminId: req.admin?.id || req.admin?._id,
    });
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// Reject registration (super admin only) - must be before /:id
router.put('/registrations/:id/reject', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['School Registration']
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid school id' });
    }

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const school = await School.findById(id);
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    if (school.registrationStatus !== 'pending') {
      return res.status(400).json({
        error: `School registration has already been ${school.registrationStatus}`
      });
    }

    school.registrationStatus = 'rejected';
    school.status = 'inactive';
    school.reviewedAt = new Date();
    school.reviewedBy = req.admin.id || req.admin._id;
    school.rejectionReason = rejectionReason.trim();

    await school.save();
    await recordPlatformAudit(req, {
      action: 'school_registration.reject',
      entity: 'school',
      entityId: school._id,
      schoolId: school._id,
      meta: { transition: 'pending_to_rejected_inactive', rejectionReason: school.rejectionReason },
    });
    logBusinessEvent(req, {
      action: 'school_registration.reject',
      outcome: 'success',
      entity: 'school',
      entityId: school._id,
      statusCode: 200,
      schoolId: school._id,
      adminId: req.admin?.id || req.admin?._id,
      transition: 'pending_to_rejected_inactive',
    });

    res.json({
      message: 'School registration rejected',
      school
    });
  } catch (err) {
    logBusinessEvent(req, {
      action: 'school_registration.reject',
      outcome: 'failure',
      entity: 'school',
      entityId: req.params?.id,
      statusCode: 500,
      reason: err.message,
      adminId: req.admin?.id || req.admin?._id,
    });
    res.status(500).json({ error: err.message });
  }
});

// Get a single school (admin only) - generic route, must be after specific routes
router.get('/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Schools']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid school id' });
    }
    if (!req.isSuperAdmin && req.schoolId && String(req.schoolId) !== String(id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const school = await School.findById(id).lean();
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    res.json(school);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
