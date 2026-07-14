const express = require('express');
const router = express.Router();
const StaffUser = require('../models/StaffUser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateUsername, generatePassword } = require('../utils/generator');
const { generateEmployeeCode } = require('../utils/codeGenerator');
const adminAuth = require('../middleware/adminAuth');
const rateLimit = require('../middleware/rateLimit');
const authStaff = require('../middleware/authStaff');
const { logAuthEvent } = require('../utils/authEventLogger');

// Register Staff (admin only)
router.post('/register', adminAuth, async (req, res) => {
  // #swagger.tags = ['Staff']
  const {
    name,
    schoolId,
    gender,
    email,
    position,
    department,
    qualification,
    experience,
    address,
    pinCode,
    joiningDate,
    joinDate,
    salary,
  } = req.body;
  const mobile = req.body.mobile || req.body.phone;
  const normalizedSalary =
    salary === '' || salary === null || salary === undefined ? undefined : Number(salary);

  try {
    if (normalizedSalary !== undefined && Number.isNaN(normalizedSalary)) {
      return res.status(400).json({ error: 'salary must be a valid number' });
    }
    const username = await generateUsername(name || 'staff', 'staff');
    const password = generatePassword();
    const empId = await generateEmpId();
    const resolvedSchoolId = req.schoolId || (req.isSuperAdmin ? schoolId : null);
    if (!resolvedSchoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    const resolvedCampusId = req.campusId || (req.isSuperAdmin ? req.body?.campusId : null);
    const employeeCode = await generateEmployeeCode(resolvedSchoolId);

    const user = new StaffUser({
      username,
      password,
      empId,
      schoolId: resolvedSchoolId,
      campusId: resolvedCampusId,
      campusName: req.isSuperAdmin ? req.body?.campusName : req.admin?.campusName,
      campusType: req.isSuperAdmin ? req.body?.campusType : req.admin?.campusType,
      employeeCode,
      name,
      gender,
      mobile,
      email,
      position,
      department,
      qualification,
      experience,
      address,
      pinCode,
      joiningDate: joiningDate || joinDate,
      salary: normalizedSalary,
    });

    await user.save();
    logAuthEvent(req, {
      action: 'register',
      outcome: 'success',
      userType: 'staff',
      identifier: username,
      userId: user._id,
      schoolId: resolvedSchoolId,
      campusId: resolvedCampusId,
    });
    res.status(201).json({ message: 'Staff registered successfully', username, password, empId, employeeCode });
  } catch (err) {
    logAuthEvent(req, {
      action: 'register',
      outcome: 'failure',
      userType: 'staff',
      identifier: req.body?.email || req.body?.name,
      schoolId: req.schoolId || req.body?.schoolId,
      campusId: req.campusId || req.body?.campusId,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

// Login Staff
router.post('/login', rateLimit({ windowMs: 60 * 1000, max: 10, keyGenerator: rateLimit.loginKeyGenerator, skipSuccessfulRequests: true }), async (req, res) => {
  // #swagger.tags = ['Staff']
  const rawUsername = req.body?.username;
  const rawPassword = req.body?.password;
  if (typeof rawUsername !== 'string' || typeof rawPassword !== 'string') {
    return res.status(400).json({ error: 'Username and password must be valid text values' });
  }
  const username = rawUsername;
  const password = rawPassword;

  try {
    const loginId = String(username || '').trim();
    if (!loginId) {
      return res.status(400).json({ error: 'username is required' });
    }
    const user = await StaffUser.findOne({
      $or: [{ username: loginId }, { employeeCode: loginId }],
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      logAuthEvent(req, {
        action: 'login',
        outcome: 'failure',
        userType: 'staff',
        identifier: loginId,
        reason: 'Invalid credentials',
        statusCode: 401,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.employeeCode && user.schoolId) {
      user.employeeCode = await generateEmployeeCode(user.schoolId);
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, type: 'staff', userType: 'staff', organizationId: user.organizationId || req.organizationId || null, schoolId: user.schoolId || null, campusId: user.campusId || null },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    logAuthEvent(req, {
      action: 'login',
      outcome: 'success',
      userType: 'staff',
      identifier: loginId,
      userId: user._id,
      schoolId: user.schoolId,
      campusId: user.campusId,
    });
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name || '',
        username: user.username,
        employeeCode: user.employeeCode || '',
        userType: 'staff',
      },
    });
  } catch (err) {
    logAuthEvent(req, {
      action: 'login',
      outcome: 'failure',
      userType: 'staff',
      identifier: username,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

router.get('/profile', authStaff, async (req, res) => {
  // #swagger.tags = ['Staff']
  try {
    if ((req.user?.userType || req.user?.type) !== 'staff') {
      return res.status(403).json({ error: 'Forbidden - not a staff user' });
    }
    const staff = await StaffUser.findById(req.user.id).select('-password').lean();
    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    res.json({
      ...staff,
      employeeId: staff.employeeCode || staff.username || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load staff profile' });
  }
});

router.put('/profile', authStaff, async (req, res) => {
  // #swagger.tags = ['Staff']
  try {
    if ((req.user?.userType || req.user?.type) !== 'staff') {
      return res.status(403).json({ error: 'Forbidden - not a staff user' });
    }
    const payload = {
      name: req.body?.name,
      email: req.body?.email,
      mobile: req.body?.mobile || req.body?.phone,
      position: req.body?.position,
      department: req.body?.department,
      qualification: req.body?.qualification,
      experience: req.body?.experience,
      address: req.body?.address,
      pinCode: req.body?.pinCode,
      joiningDate: req.body?.joiningDate || req.body?.joinDate,
      profilePic: req.body?.profilePic,
      gender: req.body?.gender,
    };
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    const staff = await StaffUser.findByIdAndUpdate(req.user.id, payload, {
      new: true,
      runValidators: true,
    }).select('-password').lean();
    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    res.json({
      message: 'Profile updated successfully',
      staff: {
        ...staff,
        employeeId: staff.employeeCode || staff.username || '',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to update staff profile' });
  }
});

/**
 * Generate a random empid
 * @returns {number} - Random 3-digit employee ID
 */
async function generateEmpId() {
  const num = Math.floor(Math.random() * 1000);
  const user = await StaffUser.findOne({ empId: num });
  if (user) {
    return generateEmpId();
  }
  return num;
}

module.exports = router;
