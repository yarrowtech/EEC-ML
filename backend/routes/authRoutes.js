const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const TeacherUser = require('../models/TeacherUser');
const StudentUser = require('../models/StudentUser');
const ParentUser = require('../models/ParentUser');
const Principal = require('../models/Principal');
const StaffUser = require('../models/StaffUser');
const School = require('../models/School');
const rateLimit = require('../middleware/rateLimit');
const { generateTeacherCode } = require('../utils/codeGenerator');
const { logAuthEvent } = require('../utils/authEventLogger');
const { resolveLoginPlatformScope } = require('../utils/authLoginScope');

const router = express.Router();

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const normalize = (value = '') => String(value).trim().toLowerCase();

const signToken = (payload, expiresIn = JWT_EXPIRES_IN) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

const signFirstLoginTenantToken = (account) => signToken({
  purpose: 'first_login_reset',
  organizationId: account.organizationId || null,
  schoolId: account.schoolId || null,
  campusId: account.campusId || null,
}, '10m');

const parseRememberMe = (value) => value === true || value === 'true' || value === 1 || value === '1';

const runInBackground = (task) => {
  Promise.resolve()
    .then(task)
    .catch((err) => {
      console.error('[auth] background task failed:', err?.message || err);
    });
};

const tryAdmin = async ({ admin, password, rememberMe }) => {
  if (!admin) return null;
  if (!(await bcrypt.compare(password, admin.password))) return null;
  if (admin.status === 'inactive') {
    return { errorStatus: 403, error: 'Account inactive. Contact EEC admin.', userType: 'Admin' };
  }
  if (admin.role === 'admin') {
    const school = await School.findById(admin.schoolId).select('status').lean();
    if (!school || school.status === 'inactive') {
      return { errorStatus: 403, error: 'School inactive. Contact EEC admin.', userType: 'Admin' };
    }
  }
  if (admin.role === 'admin' && !admin.lastLoginAt) {
    return {
      requiresPasswordReset: true,
      username: admin.username,
      userType: 'Admin',
      resetTenantToken: signFirstLoginTenantToken(admin),
    };
  }

  runInBackground(() =>
    Admin.updateOne({ _id: admin._id }, { $set: { lastLoginAt: new Date() } })
  );

  const token = signToken({
    id: admin._id,
    type: 'admin',
    username: admin.username,
    organizationId: admin.organizationId || null,
    schoolId: admin.schoolId || null,
    campusId: admin.campusId || null,
    campusName: admin.campusName || null,
    campusType: admin.campusType || null,
  }, rememberMe ? '30d' : JWT_EXPIRES_IN);

  return {
    token,
    userType: admin.role === 'super_admin' ? 'SuperAdmin' : 'Admin',
  };
};

const tryTeacher = async ({ user, password, rememberMe }) => {
  if (!user) return null;
  if (!(await bcrypt.compare(password, user.password))) return null;
  if (!user.campusId) return { errorStatus: 400, error: 'campusId is required for this account', userType: 'Teacher' };
  if (!user.employeeCode && user.schoolId) {
    runInBackground(async () => {
      const employeeCode = await generateTeacherCode(user.schoolId);
      await TeacherUser.updateOne({ _id: user._id }, { $set: { employeeCode } });
    });
  }
  if (!user.lastLoginAt) {
    return {
      requiresPasswordReset: true,
      username: user.username,
      userType: 'Teacher',
      resetTenantToken: signFirstLoginTenantToken(user),
    };
  }

  runInBackground(() =>
    TeacherUser.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } })
  );

  const token = signToken({
    id: user._id,
    userType: 'teacher',
    organizationId: user.organizationId || null,
    schoolId: user.schoolId || null,
    campusId: user.campusId || null,
  }, rememberMe ? '30d' : JWT_EXPIRES_IN);

  return { token, userType: 'Teacher' };
};

const tryStudent = async ({ user, password, rememberMe }) => {
  if (!user) return null;
  if (!(await bcrypt.compare(password, user.password))) return null;
  if (user.isArchived) {
    return { errorStatus: 403, error: 'You have been blocked by your organization.', userType: 'Student' };
  }
  if (!user.campusId) return { errorStatus: 400, error: 'campusId is required for this account', userType: 'Student' };
  if (!user.lastLoginAt) {
    return {
      requiresPasswordReset: true,
      username: user.username || user.studentCode,
      userType: 'Student',
      resetTenantToken: signFirstLoginTenantToken(user),
    };
  }
  if (!user.studentCode) {
    runInBackground(() =>
      StudentUser.updateOne({ _id: user._id }, { $set: { studentCode: user.username } })
    );
  }

  const token = signToken({
    id: user._id,
    userType: 'student',
    organizationId: user.organizationId || null,
    schoolId: user.schoolId || null,
    campusId: user.campusId || null,
  }, rememberMe ? '30d' : JWT_EXPIRES_IN);

  return { token, userType: 'Student' };
};

const tryParent = async ({ user, password, rememberMe }) => {
  if (!user) return null;
  if (!(await bcrypt.compare(password, user.password))) return null;
  if (!user.campusId) return { errorStatus: 400, error: 'campusId is required for this account', userType: 'Parent' };
  if (!user.lastLoginAt) {
    return {
      requiresPasswordReset: true,
      username: user.username,
      userType: 'Parent',
      resetTenantToken: signFirstLoginTenantToken(user),
    };
  }

  const token = signToken({
    id: user._id,
    userType: 'parent',
    organizationId: user.organizationId || null,
    schoolId: user.schoolId || null,
    campusId: user.campusId || null,
  }, rememberMe ? '30d' : JWT_EXPIRES_IN);

  return { token, userType: 'Parent' };
};

const tryPrincipal = async ({ principal, password, rememberMe }) => {
  if (!principal) return null;
  if (!(await bcrypt.compare(password, principal.password))) return null;
  runInBackground(() =>
    Principal.updateOne({ _id: principal._id }, { $set: { lastLoginAt: new Date() } })
  );

  const token = signToken({
    id: principal._id,
    type: 'principal',
    userType: 'principal',
    organizationId: principal.organizationId || null,
    schoolId: principal.schoolId || null,
    campusId: principal.campusId || null,
    campusName: principal.campusName || null,
    campusType: principal.campusType || null,
  }, rememberMe ? '30d' : JWT_EXPIRES_IN);

  return { token, userType: 'Principal' };
};

const tryStaff = async ({ user, password, rememberMe }) => {
  if (!user) return null;
  if (!(await bcrypt.compare(password, user.password))) return null;

  const token = signToken({
    id: user._id,
    type: 'staff',
    organizationId: user.organizationId || null,
    schoolId: user.schoolId || null,
    campusId: user.campusId || null,
  }, rememberMe ? '30d' : JWT_EXPIRES_IN);

  return { token, userType: 'Staff' };
};

router.post('/login', rateLimit({ windowMs: 60 * 1000, max: 10 }), async (req, res) => {
  const rawUsername = req.body?.username;
  const rawPassword = req.body?.password;
  if (typeof rawUsername !== 'string' || typeof rawPassword !== 'string') {
    return res.status(400).json({ error: 'Username and password must be valid text values' });
  }
  const username = rawUsername.trim();
  const password = rawPassword;
  const rememberMe = parseRememberMe(req.body?.rememberMe);
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const normalizedUsername = normalize(username);
    const platformScope = resolveLoginPlatformScope(req);
    const [admin, teacher, principal, student, parent, staff] = await Promise.all([
      Admin.findOne({ username, ...platformScope })
        .select('_id username password role status organizationId schoolId campusId campusName campusType lastLoginAt')
        .lean(),
      TeacherUser.findOne({ $or: [{ username }, { employeeCode: username }], ...platformScope })
        .select('_id username employeeCode password organizationId schoolId campusId lastLoginAt')
        .lean(),
      Principal.findOne({ $or: [{ username: normalizedUsername }, { email: normalizedUsername }], ...platformScope })
        .select('_id username email password organizationId schoolId campusId campusName campusType lastLoginAt')
        .lean(),
      StudentUser.findOne({ $or: [{ username }, { studentCode: username }], ...platformScope })
        .select('_id username studentCode password organizationId schoolId campusId lastLoginAt isArchived')
        .lean(),
      ParentUser.findOne({ username, ...platformScope })
        .select('_id username password organizationId schoolId campusId lastLoginAt')
        .lean(),
      StaffUser.findOne({ username, ...platformScope })
        .select('_id username password organizationId schoolId campusId')
        .lean(),
    ]);

    const checks = [
      () => tryAdmin({ admin, password, rememberMe }),
      () => tryTeacher({ user: teacher, password, rememberMe }),
      () => tryPrincipal({ principal, password, rememberMe }),
      () => tryStudent({ user: student, password, rememberMe }),
      () => tryParent({ user: parent, password, rememberMe }),
      () => tryStaff({ user: staff, password, rememberMe }),
    ];

    for (const check of checks) {
      const result = await check();
      if (!result) continue;
      if (result.errorStatus) {
        logAuthEvent(req, {
          action: 'login',
          outcome: 'failure',
          userType: String(result.userType || 'unknown').toLowerCase(),
          identifier: username,
          reason: result.error,
          statusCode: result.errorStatus,
          source: 'unified_auth',
        });
        return res.status(result.errorStatus).json({ error: result.error });
      }
      logAuthEvent(req, {
        action: result.requiresPasswordReset ? 'login.first_login_required' : 'login',
        outcome: 'success',
        userType: String(result.userType || 'unknown').toLowerCase(),
        identifier: username,
        source: 'unified_auth',
      });
      return res.json(result);
    }

    logAuthEvent(req, {
      action: 'login',
      outcome: 'failure',
      userType: 'unknown',
      identifier: username,
      reason: 'Invalid credentials',
      statusCode: 401,
      source: 'unified_auth',
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    logAuthEvent(req, {
      action: 'login',
      outcome: 'failure',
      userType: 'unknown',
      identifier: username,
      reason: err.message,
      statusCode: 400,
      source: 'unified_auth',
    });
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
