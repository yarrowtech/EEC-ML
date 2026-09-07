const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const TeacherUser = require('../models/TeacherUser');
const TeacherEnrollmentDraft = require('../models/TeacherEnrollmentDraft');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generatePassword } = require('../utils/generator');
const { generateTeacherCode, generateTeacherCodeForAdmin } = require('../utils/codeGenerator');
const adminAuth = require('../middleware/adminAuth');
const rateLimit = require('../middleware/rateLimit');
const { isStrongPassword, passwordPolicyMessage } = require('../utils/passwordPolicy');
const School = require('../models/School');
const Admin = require('../models/Admin');
const { sendTeacherCredentialsEmail } = require('../utils/mailer');
const authTeacher = require('../middleware/authTeacher');
const { logAuthEvent } = require('../utils/authEventLogger');
const { invalidateTeacherDirectoryCaches } = require('../utils/teacherDirectoryCache');

const normalizeGender = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'male' || normalized === 'm') return 'male';
  if (normalized === 'female' || normalized === 'f') return 'female';
  if (normalized === 'other' || normalized === 'o') return 'other';
  return normalized;
};

// Register Teacher
router.post('/register', adminAuth, async (req, res) => {
  // #swagger.tags = ['Teachers']
  const {
    name,
    schoolId,
    gender,
    mobile,
    email,
    subject,
    department,
    qualification,
    experience,
    address,
    pinCode,
    joiningDate,
    joinDate,
    // Basic Information
    dob,
    // Contact Details
    alternatePhone,
    city,
    district,
    state,
    // Professional Information
    specialization,
    designation,
    employeeType,
    // Academic Assignment
    classesAssigned,
    sectionsAssigned,
    subjectsAssigned,
    classTeacherOf,
    // Login & Access
    accountStatus,
    // Documents
    documents,
    // Additional
    emergencyContactName,
    emergencyContact,
    bloodGroup,
    notes,
  } = req.body;

  try {

    const password = generatePassword();
    const resolvedSchoolId = req.schoolId || (req.isSuperAdmin ? schoolId : null);
    if (!resolvedSchoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }

    // Resolve campusId — fall back to school's Main (or first) campus when admin has none
    let resolvedCampusId = req.campusId || (req.isSuperAdmin ? req.body?.campusId : null);
    let resolvedCampusName = req.isSuperAdmin ? req.body?.campusName : req.admin?.campusName;
    let resolvedCampusType = req.isSuperAdmin ? req.body?.campusType : req.admin?.campusType;
    if (!resolvedCampusId) {
      const schoolDoc = await School.findById(resolvedSchoolId).select('campuses').lean();
      const campuses = schoolDoc?.campuses || [];
      const defaultCampus =
        campuses.find((c) => c.campusType === 'Main') || campuses[0] || null;
      if (defaultCampus) {
        resolvedCampusId = String(defaultCampus._id);
        resolvedCampusName = resolvedCampusName || defaultCampus.name;
        resolvedCampusType = resolvedCampusType || defaultCampus.campusType;
      }
    }

    let adminUsername = req.admin?.username || '';
    if (!adminUsername && req.admin?.id) {
      const adminUser = await Admin.findById(req.admin.id).select('username').lean();
      adminUsername = adminUser?.username || '';
    }
    const employeeCode = await generateTeacherCodeForAdmin(resolvedSchoolId, adminUsername);
    const username = employeeCode;
    const user = new TeacherUser({
      username,
      password,
      initialPassword: password,
      schoolId: resolvedSchoolId,
      campusId: resolvedCampusId,
      campusName: resolvedCampusName,
      campusType: resolvedCampusType,
      employeeCode,
      name,
      gender: normalizeGender(gender),
      mobile,
      email,
      subject,
      department,
      qualification,
      experience,
      address,
      pinCode,
      joiningDate: joiningDate || joinDate,
      dob: dob || '',
      alternatePhone: alternatePhone || '',
      city: city || '',
      district: district || '',
      state: state || '',
      specialization: specialization || '',
      designation: designation || '',
      employeeType: employeeType || '',
      classesAssigned: Array.isArray(classesAssigned) ? classesAssigned : [],
      sectionsAssigned: Array.isArray(sectionsAssigned) ? sectionsAssigned : [],
      subjectsAssigned: Array.isArray(subjectsAssigned) ? subjectsAssigned : [],
      classTeacherOf: classTeacherOf || '',
      accountStatus: accountStatus === 'Inactive' ? 'Inactive' : 'Active',
      documents: {
        aadhaarUrl: documents?.aadhaarUrl || '',
        qualificationCertUrl: documents?.qualificationCertUrl || '',
        experienceCertUrl: documents?.experienceCertUrl || '',
        appointmentLetterUrl: documents?.appointmentLetterUrl || '',
      },
      emergencyContactName: emergencyContactName || '',
      emergencyContact: emergencyContact || '',
      bloodGroup: bloodGroup || '',
      notes: notes || '',
    });

    await user.save();
    logAuthEvent(req, {
      action: 'register',
      outcome: 'success',
      userType: 'teacher',
      identifier: username,
      userId: user._id,
      schoolId: resolvedSchoolId,
      campusId: resolvedCampusId,
    });

    let emailSent = false;
    if (email) {
      try {
        const school = await School.findById(resolvedSchoolId).select('name').lean();
        const loginUrl = process.env.TEACHER_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL || '';
        await sendTeacherCredentialsEmail({
          to: email,
          schoolName: school?.name,
          teacherName: name,
          username,
          password,
          employeeCode,
          loginUrl
        });
        emailSent = true;
      } catch (mailErr) {
        console.error('Failed to send teacher credentials email:', mailErr.message);
      }
    }

    invalidateTeacherDirectoryCaches();
    res.status(201).json({
      message: 'Teacher registered successfully',
      username,
      password,
      employeeCode,
      emailSent
    });
  } catch (err) {
    logAuthEvent(req, {
      action: 'register',
      outcome: 'failure',
      userType: 'teacher',
      identifier: req.body?.email || req.body?.name,
      schoolId: req.schoolId || req.body?.schoolId,
      campusId: req.campusId || req.body?.campusId,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

// Login Teacher
router.post('/login', rateLimit({ windowMs: 60 * 1000, max: 20, keyGenerator: rateLimit.loginKeyGenerator, skipSuccessfulRequests: true }), async (req, res) => {
  // #swagger.tags = ['Teachers']
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
    const user = await TeacherUser.findOne({
      $or: [{ username }, { employeeCode: username }],
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      logAuthEvent(req, {
        action: 'login',
        outcome: 'failure',
        userType: 'teacher',
        identifier: username,
        reason: 'Invalid credentials',
        statusCode: 401,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.campusId && user.schoolId) {
      const schoolDoc = await School.findById(user.schoolId).select('campuses').lean();
      const campuses = schoolDoc?.campuses || [];
      const defaultCampus = campuses.find((c) => c.campusType === 'Main') || campuses[0] || null;
      if (defaultCampus) {
        user.campusId = String(defaultCampus._id);
        user.campusName = user.campusName || defaultCampus.name;
        user.campusType = user.campusType || defaultCampus.campusType;
        await TeacherUser.updateOne(
          { _id: user._id },
          { $set: { campusId: user.campusId, campusName: user.campusName, campusType: user.campusType } }
        );
      }
    }
    if (!user.employeeCode && user.schoolId) {
      user.employeeCode = await generateTeacherCode(user.schoolId);
      await user.save();
    }
    if (!user.lastLoginAt) {
      logAuthEvent(req, {
        action: 'login.first_login_required',
        outcome: 'success',
        userType: 'teacher',
        identifier: username,
        userId: user._id,
        schoolId: user.schoolId,
        campusId: user.campusId,
      });
      return res.json({ requiresPasswordReset: true, username: user.username });
    }

    user.lastLoginAt = new Date();
    await user.save();
    const token = jwt.sign(
      {
        id: user._id,
        userType: 'teacher',
        organizationId: user.organizationId || req.organizationId || null,
        schoolId: user.schoolId || null,
        campusId: user.campusId || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    logAuthEvent(req, {
      action: 'login',
      outcome: 'success',
      userType: 'teacher',
      identifier: username,
      userId: user._id,
      schoolId: user.schoolId,
      campusId: user.campusId,
    });
    res.json({ token });
  } catch (err) {
    logAuthEvent(req, {
      action: 'login',
      outcome: 'failure',
      userType: 'teacher',
      identifier: username,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

router.post('/reset-first-password', rateLimit({ windowMs: 60 * 1000, max: 20, keyGenerator: rateLimit.loginKeyGenerator, skipSuccessfulRequests: true }), async (req, res) => {
  // #swagger.tags = ['Teachers']
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

    const user = await TeacherUser.findOne({
      $or: [{ username: String(username).trim() }, { employeeCode: String(username).trim() }],
    });
    if (!user) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    if (user.lastLoginAt) {
      return res.status(400).json({ error: 'Password reset already completed' });
    }

    user.password = String(newPassword);
    user.initialPassword = "";
    user.lastLoginAt = new Date();
    await user.save();
    logAuthEvent(req, {
      action: 'reset_first_password',
      outcome: 'success',
      userType: 'teacher',
      identifier: user.username || username,
      userId: user._id,
      schoolId: user.schoolId,
      campusId: user.campusId,
    });
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    logAuthEvent(req, {
      action: 'reset_first_password',
      outcome: 'failure',
      userType: 'teacher',
      identifier: username,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

router.get('/profile', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teachers']
  try {
    if (req.user?.userType !== 'teacher') {
      return res.status(403).json({ error: 'Forbidden - not a teacher' });
    }

    const teacher = await TeacherUser.findById(req.user.id).select('-password').lean();
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    res.json({
      ...teacher,
      employeeId: teacher.username || teacher.employeeCode || '',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/profile', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teachers']
  try {
    if (req.user?.userType !== 'teacher') {
      return res.status(403).json({ error: 'Forbidden - not a teacher' });
    }

    const allowedUpdates = [
      'name',
      'email',
      'mobile',
      'subject',
      'department',
      'qualification',
      'experience',
      'joiningDate',
      'address',
      'emergencyContact',
      'gender',
      'pinCode',
      'profilePic',
    ];

    const payload = {};
    allowedUpdates.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        payload[key] = req.body[key];
      }
    });

    const teacher = await TeacherUser.findByIdAndUpdate(
      req.user.id,
      { $set: payload },
      { new: true, runValidators: true, context: 'query' }
    )
      .select('-password')
      .lean();

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      teacher: {
        ...teacher,
        employeeId: teacher.username || teacher.employeeCode || '',
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ───────────────────────── Teacher enrollment drafts (admin) ─────────────────────────
   Mirrors the "Student enrollment drafts" section of routes/studentRoute.js exactly —
   an opaque save-as-you-go draft of the Add Teacher form, scoped to school/campus. */

const resolveTeacherDraftScope = (req) => ({
  schoolId: req.admin?.schoolId || req.schoolId || req.body?.schoolId || null,
  campusId: req.campusId || req.admin?.campusId || req.body?.campusId || null,
});

const teacherDraftScopeFilter = ({ schoolId, campusId }) => {
  const filter = { schoolId };
  if (campusId) filter.campusId = campusId;
  return filter;
};

const MAX_TEACHER_DRAFTS_PER_SCOPE = 30;

router.get('/enrollment-drafts', adminAuth, async (req, res) => {
  // #swagger.tags = ['Teachers']
  try {
    const scope = resolveTeacherDraftScope(req);
    if (!scope.schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const drafts = await TeacherEnrollmentDraft.find(teacherDraftScopeFilter(scope))
      .sort({ updatedAt: -1 })
      .limit(MAX_TEACHER_DRAFTS_PER_SCOPE)
      .lean();
    return res.json({ success: true, data: drafts });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/enrollment-drafts', adminAuth, async (req, res) => {
  // #swagger.tags = ['Teachers']
  try {
    const scope = resolveTeacherDraftScope(req);
    if (!scope.schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const { id, label, step, data } = req.body || {};
    const doc = {
      label: String(label || '').trim().slice(0, 120) || 'Untitled draft',
      step: Number.isFinite(Number(step)) ? Math.max(0, Math.floor(Number(step))) : 0,
      data: data && typeof data === 'object' ? data : {},
    };

    if (id && mongoose.isValidObjectId(id)) {
      const updated = await TeacherEnrollmentDraft.findOneAndUpdate(
        { _id: id, ...teacherDraftScopeFilter(scope) },
        { $set: doc },
        { new: true }
      ).lean();
      if (!updated) return res.status(404).json({ error: 'Draft not found' });
      return res.json({ success: true, data: updated });
    }

    const count = await TeacherEnrollmentDraft.countDocuments(teacherDraftScopeFilter(scope));
    if (count >= MAX_TEACHER_DRAFTS_PER_SCOPE) {
      return res.status(400).json({ error: `Draft limit reached (${MAX_TEACHER_DRAFTS_PER_SCOPE}). Delete an old draft first.` });
    }

    const created = await TeacherEnrollmentDraft.create({
      ...scope,
      ...doc,
      createdBy: req.admin?.username || req.admin?.id || '',
    });
    return res.status(201).json({ success: true, data: created.toObject() });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/enrollment-drafts/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Teachers']
  try {
    const scope = resolveTeacherDraftScope(req);
    if (!scope.schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid draft id' });
    const removed = await TeacherEnrollmentDraft.findOneAndDelete({ _id: id, ...teacherDraftScopeFilter(scope) }).lean();
    if (!removed) return res.status(404).json({ error: 'Draft not found' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
