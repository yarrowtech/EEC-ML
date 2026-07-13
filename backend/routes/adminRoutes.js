const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const School = require('../models/School');
const Organization = require('../models/Organization');
const adminAuth = require('../middleware/adminAuth');
const rateLimit = require('../middleware/rateLimit');
const { isStrongPassword, passwordPolicyMessage } = require('../utils/passwordPolicy');
const { generatePassword } = require('../utils/generator');
const { sendSchoolApprovalEmail } = require('../utils/mailer');
const { logAuthEvent } = require('../utils/authEventLogger');
const { logSecurityEvent } = require('../utils/securityEventLogger');
const { logBusinessEvent } = require('../utils/businessEventLogger');

const ensureSuperAdmin = (req, res, next) => {
  if (!req.isSuperAdmin) {
    logSecurityEvent(req, {
      action: 'security.rbac_violation',
      outcome: 'blocked',
      severity: 'high',
      attack_type: 'rbac_violation',
      riskScore: 82,
      reason: 'Super admin role required for admin-auth route',
      statusCode: 403,
      requiredRole: 'super_admin',
    });
    return res.status(403).json({ error: 'Super admin access required' });
  }
  return next();
};

const resolveSchoolIdOrError = async (schoolId, res) => {
  if (!schoolId || !mongoose.isValidObjectId(schoolId)) {
    res.status(400).json({ error: 'Valid schoolId is required' });
    return null;
  }
  const exists = await School.exists({ _id: schoolId });
  if (!exists) {
    res.status(404).json({ error: 'School not found' });
    return null;
  }
  return schoolId;
};

// Register
router.post('/register', async (req, res) => {
  // #swagger.tags = ['Admin Auth']
  const { username, password, name, schoolId } = req.body;
  try {
    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      return adminAuth(req, res, async () => {
        if (!req.isSuperAdmin) {
          return res.status(403).json({ error: 'Super admin access required' });
        }
        if (!isStrongPassword(password)) {
          return res.status(400).json({ error: passwordPolicyMessage });
        }
        if (!schoolId) {
          return res.status(400).json({ error: 'schoolId is required for school admin' });
        }
        const resolved = await resolveSchoolIdOrError(schoolId, res);
        if (!resolved) return;
        const admin = new Admin({
          username,
          password,
          name,
          role: 'admin',
          schoolId: resolved,
        });
        await admin.save();
        logAuthEvent(req, {
          action: 'register',
          outcome: 'success',
          userType: 'admin',
          identifier: username,
          userId: admin._id,
          schoolId: resolved,
        });
        return res.status(201).json({ message: 'Admin registered' });
      });
    }
    if (schoolId) {
      return res.status(400).json({ error: 'schoolId is not allowed for initial super admin' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: passwordPolicyMessage });
    }
    const admin = new Admin({ username, password, name, role: 'super_admin', schoolId: null });
    await admin.save();
    logAuthEvent(req, {
      action: 'register',
      outcome: 'success',
      userType: 'super_admin',
      identifier: username,
      userId: admin._id,
    });
    res.status(201).json({ message: 'Admin registered' });
  } catch (err) {
    logAuthEvent(req, {
      action: 'register',
      outcome: 'failure',
      userType: 'admin',
      identifier: username,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post('/login', rateLimit({ windowMs: 60 * 1000, max: 10 }), async (req, res) => {
  // #swagger.tags = ['Admin Auth']
  const rawUsername = req.body?.username;
  const rawPassword = req.body?.password;
  if (typeof rawUsername !== 'string' || typeof rawPassword !== 'string') {
    return res.status(400).json({ error: 'Username and password must be valid text values' });
  }
  const username = rawUsername.trim();
  const password = rawPassword;
  try {
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const admin = await Admin.findOne({
      username,
      ...(req.organizationId ? {} : { organizationId: null }),
    });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      logAuthEvent(req, {
        action: 'login',
        outcome: 'failure',
        userType: 'admin',
        identifier: username,
        reason: 'Invalid credentials',
        statusCode: 401,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (admin.status === 'inactive') {
      logAuthEvent(req, {
        action: 'login',
        outcome: 'failure',
        userType: admin.role || 'admin',
        identifier: username,
        userId: admin._id,
        schoolId: admin.schoolId,
        campusId: admin.campusId,
        reason: 'Account inactive',
        statusCode: 403,
      });
      return res.status(403).json({ error: 'Account inactive. Contact EEC admin.' });
    }
    if (admin.role === 'admin') {
      const school = await School.findById(admin.schoolId).select('status').lean();
      if (!school || school.status === 'inactive') {
        logAuthEvent(req, {
          action: 'login',
          outcome: 'failure',
          userType: 'admin',
          identifier: username,
          userId: admin._id,
          schoolId: admin.schoolId,
          campusId: admin.campusId,
          reason: 'School inactive',
          statusCode: 403,
        });
        return res.status(403).json({ error: 'School inactive. Contact EEC admin.' });
      }
    }
    if (admin.role === 'admin' && !admin.lastLoginAt) {
      logAuthEvent(req, {
        action: 'login.first_login_required',
        outcome: 'success',
        userType: 'admin',
        identifier: username,
        userId: admin._id,
        schoolId: admin.schoolId,
        campusId: admin.campusId,
      });
      return res.json({ requiresPasswordReset: true, username: admin.username });
    }
    admin.lastLoginAt = new Date();
    await admin.save();
    const token = jwt.sign(
      {
        id: admin._id,
        type: 'admin',
        role: admin.role || 'admin',
        username: admin.username,
        organizationId: admin.organizationId || req.organizationId || null,
        schoolId: admin.schoolId || null,
        campusId: admin.campusId || null,
        campusName: admin.campusName || null,
        campusType: admin.campusType || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    logAuthEvent(req, {
      action: 'login',
      outcome: 'success',
      userType: admin.role || 'admin',
      identifier: username,
      userId: admin._id,
      schoolId: admin.schoolId,
      campusId: admin.campusId,
    });
    res.json({ token });
  } catch (err) {
    logAuthEvent(req, {
      action: 'login',
      outcome: 'failure',
      userType: 'admin',
      identifier: username,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

router.post('/reset-first-password', rateLimit({ windowMs: 60 * 1000, max: 10 }), async (req, res) => {
  // #swagger.tags = ['Admin Auth']
  const { username, newPassword } = req.body || {};
  try {
    if (!username || !String(username).trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (!newPassword || !String(newPassword).trim()) {
      return res.status(400).json({ error: 'New password is required' });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ error: passwordPolicyMessage });
    }
    const admin = await Admin.findOne({
      username: String(username).trim(),
      ...(req.organizationId ? {} : { organizationId: null }),
    });
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ error: 'Admin not found' });
    }
    if (admin.status === 'inactive') {
      return res.status(403).json({ error: 'Account inactive. Contact EEC admin.' });
    }
    const school = await School.findById(admin.schoolId).select('status').lean();
    if (!school || school.status === 'inactive') {
      return res.status(403).json({ error: 'School inactive. Contact EEC admin.' });
    }
    if (admin.lastLoginAt) {
      return res.status(400).json({ error: 'Password reset already completed' });
    }
    admin.password = String(newPassword);
    admin.lastLoginAt = new Date();
    await admin.save();
    logAuthEvent(req, {
      action: 'reset_first_password',
      outcome: 'success',
      userType: 'admin',
      identifier: admin.username,
      userId: admin._id,
      schoolId: admin.schoolId,
      campusId: admin.campusId,
    });
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    logAuthEvent(req, {
      action: 'reset_first_password',
      outcome: 'failure',
      userType: 'admin',
      identifier: username,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

router.post('/school-admins/notify-credentials', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Admin Auth']
  const { schoolId, schoolName, contactEmail, campuses } = req.body || {};
  try {
    if (!schoolId || !mongoose.isValidObjectId(schoolId)) {
      return res.status(400).json({ error: 'Valid schoolId is required' });
    }
    if (!Array.isArray(campuses) || campuses.length === 0) {
      return res.status(400).json({ error: 'Campus credentials are required' });
    }
    const school = await School.findById(schoolId).select('name contactEmail').lean();
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    const recipient = contactEmail || school.contactEmail;
    if (!recipient) {
      return res.status(400).json({ error: 'School contact email is required' });
    }

    const sanitizedCampuses = campuses.map((campus) => ({
      campusName: campus.campusName || campus.name || 'Campus',
      campusType: campus.campusType || 'Campus',
      username: campus.username || campus.code || '',
      password: campus.password || ''
    }));

    const loginUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    await sendSchoolApprovalEmail({
      to: recipient,
      schoolName: schoolName || school.name,
      campuses: sanitizedCampuses,
      loginUrl
    });

    res.json({ message: 'Approval email sent' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to send email' });
  }
});

router.post("/profile", adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Auth']
  try {
      const student = await Admin.findById(req.admin.id).select('-password');
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }
      logBusinessEvent(req, {
        action: 'admin_profile.fetch',
        outcome: 'success',
        entity: 'admin',
        entityId: student._id,
        statusCode: 200,
        adminId: req.admin?.id || req.admin?._id,
        role: student.role,
      });
      res.json(student);
    } catch (err) {
      logBusinessEvent(req, {
        action: 'admin_profile.fetch',
        outcome: 'failure',
        entity: 'admin',
        entityId: req.admin?.id || req.admin?._id,
        statusCode: 500,
        reason: err.message,
      });
      res.status(500).json({ error: 'Server error' });
    }
})

router.get('/settings', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Auth']
  try {
    const admin = await Admin.findById(req.admin.id).select('-password').lean();
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    let school = null;
    if (admin.role === 'admin' && admin.schoolId) {
      school = await School.findById(admin.schoolId).lean();
    }

    return res.json({ admin, school });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

router.put('/settings', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Auth']
  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const adminPayload = req.body?.admin || {};
    const schoolPayload = req.body?.school || {};

    const nextUsername = typeof adminPayload.username === 'string' ? adminPayload.username.trim() : undefined;
    const nextName = typeof adminPayload.name === 'string' ? adminPayload.name.trim() : undefined;
    const nextEmail = typeof adminPayload.email === 'string' ? adminPayload.email.trim() : undefined;
    const nextAvatar = typeof adminPayload.avatar === 'string' ? adminPayload.avatar.trim() : undefined;
    const nextCampusName = typeof adminPayload.campusName === 'string' ? adminPayload.campusName.trim() : undefined;
    const nextCampusType = typeof adminPayload.campusType === 'string' ? adminPayload.campusType.trim() : undefined;
    const newPassword = typeof adminPayload.newPassword === 'string'
      ? adminPayload.newPassword
      : (typeof req.body?.newPassword === 'string' ? req.body.newPassword : '');

    if (nextUsername !== undefined && nextUsername !== admin.username) {
      if (!nextUsername) {
        return res.status(400).json({ error: 'Username cannot be empty' });
      }
      const usernameTaken = await Admin.exists({ username: nextUsername, _id: { $ne: admin._id } });
      if (usernameTaken) {
        return res.status(409).json({ error: 'Username already in use' });
      }
      admin.username = nextUsername;
    }

    if (nextName !== undefined) admin.name = nextName;
    if (nextEmail !== undefined) admin.email = nextEmail;
    if (nextAvatar !== undefined) admin.avatar = nextAvatar;
    if (nextCampusName !== undefined) admin.campusName = nextCampusName || null;
    if (nextCampusType !== undefined) admin.campusType = nextCampusType || null;

    if (newPassword) {
      if (!isStrongPassword(newPassword)) {
        return res.status(400).json({ error: passwordPolicyMessage });
      }
      admin.password = newPassword;
    }

    await admin.save();

    let updatedSchool = null;
    if (admin.role === 'admin' && admin.schoolId) {
      const school = await School.findById(admin.schoolId);
      if (school) {
        const assignIfString = (key) => {
          if (typeof schoolPayload[key] === 'string') {
            school[key] = schoolPayload[key].trim();
          }
        };

        assignIfString('name');
        assignIfString('address');
        assignIfString('contactEmail');
        assignIfString('contactPhone');
        assignIfString('officialEmail');
        assignIfString('contactPersonName');
        assignIfString('schoolType');
        assignIfString('board');
        assignIfString('boardOther');
        assignIfString('academicYearStructure');
        assignIfString('estimatedUsers');
        assignIfString('websiteURL');
        assignIfString('campusName');

        if (schoolPayload.logo !== undefined) {
          if (typeof schoolPayload.logo === 'string') {
            school.logo = {
              ...(school.logo || {}),
              secure_url: schoolPayload.logo.trim(),
            };
          } else if (schoolPayload.logo && typeof schoolPayload.logo === 'object') {
            school.logo = {
              ...(school.logo || {}),
              ...schoolPayload.logo,
            };
          }
        }

        await school.save();
        updatedSchool = school.toObject();

        const schoolLogo = school.logo?.secure_url || school.logo?.url || '';
        await Organization.findOneAndUpdate(
          { schoolId: school._id },
          {
            $set: {
              name: school.name,
              logo: schoolLogo,
              favicon: schoolLogo,
            },
          },
          { runValidators: true }
        );
      }
    }

    const updatedAdmin = await Admin.findById(admin._id).select('-password').lean();
    return res.json({ admin: updatedAdmin, school: updatedSchool });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unable to update settings' });
  }
});

// Create a school admin (super admin only)
const resolveAvatarValue = (avatar) => {
  if (!avatar) return undefined;
  if (typeof avatar === 'string') return avatar;
  if (typeof avatar === 'object') {
    return avatar.secure_url || avatar.url || avatar.path || undefined;
  }
  return undefined;
};

router.post('/school-admins', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Admin Auth']
  const { username, password, name, schoolId, email, avatar, status, campusId, campusName, campusType } = req.body;
  try {
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: passwordPolicyMessage });
    }
    const resolved = await resolveSchoolIdOrError(schoolId, res);
    if (!resolved) return;

    const normalizedAvatar = resolveAvatarValue(avatar);
    const existing = await Admin.findOne({ username });
    if (existing) {
      existing.password = password;
      existing.name = name;
      existing.email = email || existing.email;
      if (normalizedAvatar) {
        existing.avatar = normalizedAvatar;
      }
      existing.schoolId = resolved;
      existing.status = status || existing.status;
      existing.role = 'admin';
      // Regenerated credentials should trigger first-login password reset flow.
      existing.lastLoginAt = null;
      if (campusId !== undefined) {
        existing.campusId = campusId;
      }
      if (campusName !== undefined) {
        existing.campusName = campusName;
      }
      if (campusType !== undefined) {
        existing.campusType = campusType;
      }
      await existing.save();
      const updated = await Admin.findById(existing._id)
        .select('-password')
        .populate('schoolId', 'name code')
        .lean();
      return res.status(200).json(updated);
    }

    const admin = new Admin({
      username,
      password,
      name,
      email,
      avatar: normalizedAvatar,
      role: 'admin',
      status: status || 'active',
      schoolId: resolved,
      campusId,
      campusName,
      campusType
    });
    await admin.save();
    const created = await Admin.findById(admin._id)
      .select('-password')
      .populate('schoolId', 'name code')
      .lean();
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List school admins (super admin only)
router.get('/school-admins', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Admin Auth']
  try {
    const filter = { schoolId: { $ne: null } };
    if (req.query?.schoolId && mongoose.isValidObjectId(req.query.schoolId)) {
      filter.schoolId = req.query.schoolId;
    }
    const admins = await Admin.find(filter).select('-password').populate('schoolId', 'name code').lean();
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset school admin password (super admin only)
router.post('/school-admins/:id/reset-password', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Admin Auth']
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Valid admin id is required' });
    }

    const admin = await Admin.findOne({ _id: id, role: 'admin', schoolId: { $ne: null } });
    if (!admin) {
      return res.status(404).json({ error: 'School admin not found' });
    }

    const password = generatePassword();
    admin.password = password;
    // Allow direct login with the reset password (do not trigger first-login reset flow).
    admin.lastLoginAt = new Date();
    await admin.save();

    return res.json({
      message: 'School admin password reset successfully',
      adminId: admin._id,
      username: admin.username,
      name: admin.name || '',
      schoolId: admin.schoolId || null,
      password,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unable to reset school admin password' });
  }
});

module.exports = router;
