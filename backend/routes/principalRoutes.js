const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Principal = require('../models/Principal');
const School = require('../models/School');
const rateLimit = require('../middleware/rateLimit');
const { isStrongPassword, passwordPolicyMessage } = require('../utils/passwordPolicy');
const adminAuth = require('../middleware/adminAuth');
const principalAuth = require('../middleware/principalAuth');
const { logAuthEvent } = require('../utils/authEventLogger');

const normalize = (value = '') => String(value).trim().toLowerCase();

router.post('/register', adminAuth, async (req, res) => {
  // #swagger.tags = ['Principals']
  const { username, email, password, name, schoolId, campusId, campusName, campusType } = req.body || {};
  try {
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: passwordPolicyMessage });
    }
    const resolvedSchoolId = req.schoolId || (req.isSuperAdmin ? schoolId : null);
    if (!resolvedSchoolId || !mongoose.isValidObjectId(resolvedSchoolId)) {
      return res.status(400).json({ error: 'Valid schoolId is required' });
    }
    const principalEmail = normalize(email || username);
    if (!principalEmail) {
      return res.status(400).json({ error: 'email or username is required' });
    }

    const principal = new Principal({
      username: normalize(username || principalEmail),
      email: principalEmail,
      password,
      initialPassword: password,
      lastLoginAt: null,
      name: name || 'Principal',
      schoolId: resolvedSchoolId,
      campusId: req.campusId || (req.isSuperAdmin ? campusId : null),
      campusName: req.isSuperAdmin ? campusName : req.campusId ? req.admin?.campusName : campusName,
      campusType: req.isSuperAdmin ? campusType : req.campusId ? req.admin?.campusType : campusType,
    });

    await principal.save();
    logAuthEvent(req, {
      action: 'register',
      outcome: 'success',
      userType: 'principal',
      identifier: principal.email || principal.username,
      userId: principal._id,
      schoolId: principal.schoolId,
      campusId: principal.campusId,
    });
    res.status(201).json({ message: 'Principal registered' });
  } catch (err) {
    logAuthEvent(req, {
      action: 'register',
      outcome: 'failure',
      userType: 'principal',
      identifier: req.body?.email || req.body?.username,
      schoolId: req.schoolId || req.body?.schoolId,
      campusId: req.campusId || req.body?.campusId,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', rateLimit({ windowMs: 60 * 1000, max: 10, keyGenerator: rateLimit.loginKeyGenerator, skipSuccessfulRequests: true }), async (req, res) => {
  // #swagger.tags = ['Principals']
  const rawUsername = req.body?.username;
  const rawEmail = req.body?.email;
  const rawPassword = req.body?.password;
  if (
    (rawUsername !== undefined && typeof rawUsername !== 'string')
    || (rawEmail !== undefined && typeof rawEmail !== 'string')
    || typeof rawPassword !== 'string'
  ) {
    return res.status(400).json({ error: 'Username and password must be valid text values' });
  }
  const username = rawUsername;
  const email = rawEmail;
  const password = rawPassword;
  try {
    const identifier = normalize(username || email);
    if (!identifier || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    const principal = await Principal.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });
    if (!principal || !(await bcrypt.compare(password, principal.password))) {
      logAuthEvent(req, {
        action: 'login',
        outcome: 'failure',
        userType: 'principal',
        identifier,
        reason: 'Invalid credentials',
        statusCode: 401,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!principal.lastLoginAt) {
      logAuthEvent(req, {
        action: 'login.first_login_required',
        outcome: 'success',
        userType: 'principal',
        identifier,
        userId: principal._id,
        schoolId: principal.schoolId,
        campusId: principal.campusId,
      });
      return res.json({ requiresPasswordReset: true, username: principal.username });
    }
    principal.lastLoginAt = new Date();
    await principal.save();

    const token = jwt.sign(
      {
        id: principal._id,
        type: 'principal',
        userType: 'principal',
        organizationId: principal.organizationId || req.organizationId || null,
        schoolId: principal.schoolId || null,
        campusId: principal.campusId || null,
        campusName: principal.campusName || null,
        campusType: principal.campusType || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    logAuthEvent(req, {
      action: 'login',
      outcome: 'success',
      userType: 'principal',
      identifier,
      userId: principal._id,
      schoolId: principal.schoolId,
      campusId: principal.campusId,
    });
    res.json({ token });
  } catch (err) {
    logAuthEvent(req, {
      action: 'login',
      outcome: 'failure',
      userType: 'principal',
      identifier: username || email,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

router.post('/reset-first-password', rateLimit({ windowMs: 60 * 1000, max: 10, keyGenerator: rateLimit.loginKeyGenerator, skipSuccessfulRequests: true }), async (req, res) => {
  // #swagger.tags = ['Principals']
  const { username, newPassword } = req.body || {};
  try {
    const identifier = normalize(username);
    if (!identifier) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (!newPassword || !String(newPassword).trim()) {
      return res.status(400).json({ error: 'New password is required' });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ error: passwordPolicyMessage });
    }

    const principal = await Principal.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });
    if (!principal) {
      return res.status(404).json({ error: 'Principal not found' });
    }
    if (principal.lastLoginAt) {
      return res.status(400).json({ error: 'Password reset already completed' });
    }

    principal.password = String(newPassword);
    principal.lastLoginAt = new Date();
    await principal.save();
    logAuthEvent(req, {
      action: 'reset_first_password',
      outcome: 'success',
      userType: 'principal',
      identifier: principal.email || principal.username,
      userId: principal._id,
      schoolId: principal.schoolId,
      campusId: principal.campusId,
    });
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    logAuthEvent(req, {
      action: 'reset_first_password',
      outcome: 'failure',
      userType: 'principal',
      identifier: username,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

router.get('/profile', principalAuth, async (req, res) => {
  try {
    const principalId = req.principal?.id || req.principal?._id;
    if (!principalId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const principal = await Principal.findById(principalId).select('-password').lean();
    if (!principal) {
      return res.status(404).json({ error: 'Principal not found' });
    }

    let schoolName = '';
    let schoolLogo = '';
    if (principal.schoolId) {
      const school = await School.findById(principal.schoolId).select('name logo').lean();
      schoolName = school?.name || '';
      schoolLogo = school?.logo?.secure_url || '';
    }

    res.json({
      ...principal,
      schoolName,
      schoolLogo,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
