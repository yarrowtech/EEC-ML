const express = require('express');
const router = express.Router();
const StudentUser = require('../models/StudentUser');
const ParentUser = require('../models/ParentUser');
const Class = require('../models/Class');
const AcademicYear = require('../models/AcademicYear');
const Timetable = require('../models/Timetable');
const ExamResult = require('../models/ExamResult');
const Exam = require('../models/Exam');
const StudentJournalEntry = require('../models/StudentJournalEntry');
const TeacherAllocation = require('../models/TeacherAllocation');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const StudentProgress = require('../models/StudentProgress');
const Assignment = require('../models/Assignment');
const TeacherUser = require('../models/TeacherUser');
const TeacherFeedback = require('../models/TeacherFeedback');
const School = require('../models/School');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const adminAuth = require('../middleware/adminAuth');
const { generatePassword } = require('../utils/generator');
const { logger } = require('../utils/logger');
const extractPopulatedDoc = (doc) => {
  if (doc && typeof doc.toJSON === 'function') {
    return doc.toJSON();
  }
  if (doc && typeof doc.toObject === 'function') {
    return doc.toObject();
  }
  return doc || null;
};

const extractSchoolInfo = (school = null) => {
  const payload = extractPopulatedDoc(school);
  if (!payload || typeof payload !== 'object') return null;
  return {
    id: payload._id || payload.id || null,
    name: payload.name || '',
    code: payload.code || '',
    address: payload.address || '',
    logo: payload.logo?.secure_url || payload.logo?.url || null,
  };
};

const resolvePhotoValue = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value.secure_url || value.url || value.path || null;
  }
  return null;
};

const resolveProfilePhoto = (studentDoc) => {
  const direct = resolvePhotoValue(studentDoc?.profilePic);
  if (direct) return direct;
  return null;
};

const resolveAdmissionYear = (value) => {
  if (!value) return new Date().getFullYear();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().getFullYear();
  }
  return parsed.getFullYear();
};

const resolveAdmissionDate = (value) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
};

const normalizeTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => String(tag || '').trim())
      .filter(Boolean);
  }
  return String(tags)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeString = (value = '') => String(value || '').trim().toLowerCase();
const padNumber = (value, size = 3) => String(value).padStart(size, '0');
const normalizeOrgPrefix = (adminUsername) => {
  const normalized = String(adminUsername || '')
    .trim()
    .toUpperCase()
    .replace(/^EEC[-_]?/, '')
    .replace(/[^A-Z0-9-]/g, '');
  return normalized || 'SCH';
};
const resolveStudentPrefix = ({ adminUsername, admissionYear }) =>
  `${normalizeOrgPrefix(adminUsername)}-STD-${String(admissionYear).slice(-2)}-`;
const resolveParentPrefix = ({ adminUsername, admissionYear }) =>
  `${normalizeOrgPrefix(adminUsername)}-PTA-${String(admissionYear).slice(-2)}-`;
const getNextStudentUsername = async ({ schoolId, campusId, prefix }) => {
  const regex = new RegExp(`^${escapeRegex(prefix)}\\d+$`);
  const filter = {
    schoolId,
    username: { $regex: regex },
  };
  if (campusId) filter.campusId = campusId;
  const users = await StudentUser.find(filter).select('username').lean();
  let maxSequence = 0;
  users.forEach((user) => {
    const value = String(user?.username || '');
    const match = value.match(/(\d+)$/);
    const seq = match ? Number(match[1]) : 0;
    if (Number.isFinite(seq) && seq > maxSequence) maxSequence = seq;
  });
  return `${prefix}${padNumber(maxSequence + 1)}`;
};
const getNextParentUsername = async ({ schoolId, campusId, prefix }) => {
  const regex = new RegExp(`^${escapeRegex(prefix)}\\d+$`);
  const filter = {
    schoolId,
    username: { $regex: regex },
  };
  if (campusId) filter.campusId = campusId;
  const users = await ParentUser.find(filter).select('username').lean();
  let maxSequence = 0;
  users.forEach((user) => {
    const value = String(user?.username || '');
    const match = value.match(/(\d+)$/);
    const seq = match ? Number(match[1]) : 0;
    if (Number.isFinite(seq) && seq > maxSequence) maxSequence = seq;
  });
  return `${prefix}${padNumber(maxSequence + 1)}`;
};
const buildTeacherFeedbackContext = async (studentDoc = null) => {
  const fallback = { classDoc: null, contexts: [] };
  if (!studentDoc || !studentDoc.schoolId) return fallback;

  const resolvedGrade = String(studentDoc.grade || '').trim();
  if (!resolvedGrade) return fallback;

  const classFilter = {
    schoolId: studentDoc.schoolId,
    name: resolvedGrade
  };
  if (studentDoc.campusId) {
    classFilter.campusId = studentDoc.campusId;
  }

  let classDoc = await Class.findOne(classFilter).lean();
  if (!classDoc) {
    classDoc = await Class.findOne({
      ...classFilter,
      name: { $regex: `^${escapeRegex(resolvedGrade)}$`, $options: 'i' }
    }).lean();
  }

  if (!classDoc) {
    return fallback;
  }

  const timetableFilter = {
    schoolId: studentDoc.schoolId,
    classId: classDoc._id
  };
  if (studentDoc.campusId) {
    timetableFilter.campusId = studentDoc.campusId;
  }

  const timetables = await Timetable.find(timetableFilter)
    .populate('sectionId', 'name')
    .populate('entries.subjectId', 'name')
    .populate('entries.teacherId', 'name profilePic subject')
    .lean();

  if (!Array.isArray(timetables) || timetables.length === 0) {
    return { classDoc, contexts: [] };
  }

  const normalizedSection = normalizeString(studentDoc.section);
  const scopedTimetables = normalizedSection
    ? timetables.filter(tt => normalizeString(tt?.sectionId?.name) === normalizedSection)
    : timetables;

  const effectiveTimetables = scopedTimetables.length > 0 ? scopedTimetables : timetables;

  const comboMap = new Map();

  effectiveTimetables.forEach(tt => {
    const sectionName = tt.sectionId?.name || studentDoc.section || '';
    const sectionId = tt.sectionId?._id || null;

    (tt.entries || []).forEach(entry => {
      if (!entry?.teacherId) return;
      const teacherId = entry.teacherId?._id || entry.teacherId;
      if (!teacherId) return;

      const subjectName = entry.subjectId?.name || entry.subjectName || entry.subject || 'Subject';
      const subjectId = entry.subjectId?._id || null;
      const key = `${teacherId}-${subjectId || subjectName}`;

      const scheduleEntry = entry.dayOfWeek
        ? {
            dayOfWeek: entry.dayOfWeek,
            period: entry.period,
            time: entry.startTime && entry.endTime ? `${entry.startTime} - ${entry.endTime}` : entry.startTime || ''
          }
        : null;

      if (!comboMap.has(key)) {
        comboMap.set(key, {
          contextId: key,
          teacherId: teacherId.toString(),
          teacherName: entry.teacherId?.name || 'Teacher',
          teacherProfilePic: entry.teacherId?.profilePic || '',
          teacherSubject: entry.teacherId?.subject || '',
          subjectId: subjectId ? subjectId.toString() : null,
          subjectName,
          classId: classDoc._id,
          className: classDoc.name,
          sectionId,
          sectionName,
          scheduleTimes: scheduleEntry ? [scheduleEntry] : []
        });
      } else if (scheduleEntry) {
        comboMap.get(key).scheduleTimes.push(scheduleEntry);
      }
    });
  });

  return {
    classDoc,
    contexts: Array.from(comboMap.values())
  };
};

const formatDateLabel = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const resolveTeacherFeedbackAvailability = async (schoolId) => {
  if (!schoolId) {
    return {
      isOpen: false,
      reason: 'feedback_not_configured',
      message: 'Teacher feedback is not available right now.',
      settings: { enabled: false, startDate: null, endDate: null },
    };
  }

  const school = await School.findById(schoolId).select('teacherFeedbackSettings').lean();
  const settings = school?.teacherFeedbackSettings || {};
  const enabled = Boolean(settings.enabled);
  const startDate = settings.startDate ? new Date(settings.startDate) : null;
  const endDate = settings.endDate ? new Date(settings.endDate) : null;
  const now = new Date();

  if (!enabled) {
    return {
      isOpen: false,
      reason: 'feedback_disabled',
      message: 'Teacher feedback has not been started by school admin.',
      settings: { enabled, startDate, endDate },
    };
  }

  if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return {
      isOpen: false,
      reason: 'feedback_not_configured',
      message: 'Teacher feedback timeframe is not configured by school admin.',
      settings: { enabled, startDate: startDate || null, endDate: endDate || null },
    };
  }

  if (now < startDate) {
    return {
      isOpen: false,
      reason: 'feedback_not_started',
      message: `Teacher feedback will start on ${formatDateLabel(startDate)}.`,
      settings: { enabled, startDate, endDate },
    };
  }

  if (now > endDate) {
    return {
      isOpen: false,
      reason: 'feedback_closed',
      message: `Teacher feedback closed on ${formatDateLabel(endDate)}.`,
      settings: { enabled, startDate, endDate },
    };
  }

  return {
    isOpen: true,
    reason: 'feedback_open',
    message: '',
    settings: { enabled, startDate, endDate },
  };
};
const rateLimit = require('../middleware/rateLimit');
const { isStrongPassword, passwordPolicyMessage } = require('../utils/passwordPolicy');
const authStudent = require('../middleware/authStudent');
const { logAuthEvent } = require('../utils/authEventLogger');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

// Register Student
router.post('/register', adminAuth, async (req, res) => {
  // #swagger.tags = ['Students']
  const {
    name,
    schoolId,
    grade,
    section,
    roll,
    gender,
    dob,
    admissionDate,
    admissionNumber,
    academicYear,
    serialNo,
    status,
    mobile,
    email,
    address,
    permanentAddress,
    pinCode,
    profilePic,
    birthPlace,
    bloodGroup,
    caste,
    fatherName,
    fatherPhone,
    fatherOccupation,
    motherName,
    motherPhone,
    motherOccupation,
    guardianName,
    guardianPhone,
    guardianEmail,
    nationality,
    religion,
    category,
    knownHealthIssues,
    allergies,
    immunizationStatus,
    learningDisabilities,
    aadharNumber,
    birthCertificateNo,
    previousSchoolName,
    previousClass,
    previousPercentage,
    transferCertificateNo,
    transferCertificateDate,
    reasonForLeaving,
    applicationId,
    applicationDate,
    approvalStatus,
    remarks,
    password: requestedPassword
  } = req.body;

  try {
    const resolvedSchoolId = req.admin?.schoolId || schoolId || null;
    const resolvedCampusId = req.campusId || req.admin?.campusId || req.body?.campusId || null;

    if (!resolvedSchoolId) {
      return res.status(400).json({ error: 'schoolId is required to generate student ID' });
    }

    const resolvedAdmissionDate = resolveAdmissionDate(admissionDate) || undefined;
    const admissionYear = resolveAdmissionYear(resolvedAdmissionDate || admissionDate);

    let password = requestedPassword;
    if (password) {
      if (!isStrongPassword(password)) {
        return res.status(400).json({ error: passwordPolicyMessage });
      }
    } else {
      password = generatePassword();
    }

    const resolvedName = name || 'Student';
    const resolvedGrade = grade || '';
    const resolvedSection = section || '';
    const resolvedGender = (gender || 'male').toLowerCase();
    const resolvedRoll = roll || undefined;
    const resolvedMobile = mobile || '';
    const resolvedEmail = email || '';

    const prefix = resolveStudentPrefix({
      adminUsername: req.admin?.username,
      admissionYear,
    });
    const studentCode = await getNextStudentUsername({
      schoolId: resolvedSchoolId,
      campusId: resolvedCampusId,
      prefix,
    });

    const payload = {
      username: studentCode,
      password,
      initialPassword: password,
      schoolId: resolvedSchoolId,
      campusId: resolvedCampusId,
      campusName: req.isSuperAdmin ? req.body?.campusName : req.admin?.campusName,
      campusType: req.isSuperAdmin ? req.body?.campusType : req.admin?.campusType,
      name: resolvedName,
      grade: resolvedGrade,
      section: resolvedSection,
      roll: resolvedRoll,
      gender: resolvedGender,
      dob,
      admissionDate: resolvedAdmissionDate,
      admissionNumber: admissionNumber || '',
      academicYear: academicYear || '',
      serialNo: serialNo || '',
      status: status || 'Active',
      mobile: resolvedMobile,
      email: resolvedEmail,
      address: address || '',
      permanentAddress: permanentAddress || '',
      pinCode: pinCode || '',
      profilePic: profilePic || '',
      birthPlace: birthPlace || '',
      bloodGroup: bloodGroup || '',
      caste: caste || '',
      fatherName: fatherName || '',
      fatherPhone: fatherPhone || '',
      fatherOccupation: fatherOccupation || '',
      motherName: motherName || '',
      motherPhone: motherPhone || '',
      motherOccupation: motherOccupation || '',
      guardianName: guardianName || '',
      guardianPhone: guardianPhone || '',
      guardianEmail: guardianEmail || '',
      nationality: nationality || '',
      religion: religion || '',
      category: category || '',
      knownHealthIssues: knownHealthIssues || '',
      allergies: allergies || '',
      immunizationStatus: immunizationStatus || '',
      learningDisabilities: learningDisabilities || '',
      aadharNumber: aadharNumber || '',
      birthCertificateNo: birthCertificateNo || '',
      previousSchoolName: previousSchoolName || '',
      previousClass: previousClass || '',
      previousPercentage: previousPercentage || '',
      transferCertificateNo: transferCertificateNo || '',
      transferCertificateDate: transferCertificateDate || '',
      reasonForLeaving: reasonForLeaving || '',
      applicationId: applicationId || '',
      applicationDate: applicationDate || '',
      approvalStatus: approvalStatus || '',
      remarks: remarks || '',
      studentCode,
    };

    const studentUser = await StudentUser.create(payload);

    let parentCredentials = null;
    const parentName =
      guardianName ||
      fatherName ||
      motherName ||
      (resolvedName ? `Parent of ${resolvedName}` : '');
    const parentMobile = guardianPhone || fatherPhone || motherPhone || '';
    const parentEmail = guardianEmail || '';
    if (parentName && (parentMobile || parentEmail)) {
      let parentUser = null;
      const parentLookupFilter = ParentUser.buildContactLookupFilter({
        email: parentEmail,
        mobile: parentMobile,
      });
      if (parentLookupFilter) {
        parentUser = await ParentUser.findOne({
          schoolId: resolvedSchoolId,
          ...parentLookupFilter,
        });
      }
      if (!parentUser) {
        const legacyPlainFilter = {
          schoolId: resolvedSchoolId,
          $or: [
            parentEmail ? { email: parentEmail } : null,
            parentMobile ? { mobile: parentMobile } : null,
          ].filter(Boolean),
        };
        if (legacyPlainFilter.$or.length) {
          parentUser = await ParentUser.findOne(legacyPlainFilter);
        }
      }
      if (!parentUser) {
        const parentPrefix = resolveParentPrefix({
          adminUsername: req.admin?.username,
          admissionYear,
        });
        const parentUsername = await getNextParentUsername({
          schoolId: resolvedSchoolId,
          campusId: resolvedCampusId,
          prefix: parentPrefix,
        });
        const parentPassword = generatePassword();
        parentUser = await ParentUser.create({
          username: parentUsername,
          password: parentPassword,
          initialPassword: parentPassword,
          schoolId: resolvedSchoolId,
          campusId: resolvedCampusId,
          name: parentName,
          mobile: parentMobile,
          email: parentEmail,
          childrenIds: [studentUser._id],
          children: [resolvedName],
          grade: [resolvedGrade],
        });
        parentCredentials = {
          userId: parentUser.username,
          password: parentPassword,
        };
      } else {
        const existingIds = new Set(
          (parentUser.childrenIds || []).map((id) => String(id))
        );
        if (!existingIds.has(String(studentUser._id))) {
          parentUser.childrenIds = [...(parentUser.childrenIds || []), studentUser._id];
        }
        const existingChildren = new Set(parentUser.children || []);
        if (resolvedName && !existingChildren.has(resolvedName)) {
          parentUser.children = [...(parentUser.children || []), resolvedName];
        }
        const existingGrades = new Set(parentUser.grade || []);
        if (resolvedGrade && !existingGrades.has(resolvedGrade)) {
          parentUser.grade = [...(parentUser.grade || []), resolvedGrade];
        }
        await parentUser.save();
      }
    }

    res.status(201).json({
      message: 'Student registered successfully',
      username: payload.username,
      studentCode,
      password,
      userId: studentUser._id,
      parentCredentials,
    });
    logAuthEvent(req, {
      action: 'register',
      outcome: 'success',
      userType: 'student',
      identifier: payload.username || studentCode,
      userId: studentUser._id,
      schoolId: resolvedSchoolId,
      campusId: resolvedCampusId,
    });
  } catch (err) {
    logAuthEvent(req, {
      action: 'register',
      outcome: 'failure',
      userType: 'student',
      identifier: req.body?.studentCode || req.body?.username || req.body?.name,
      schoolId: req.schoolId || req.body?.schoolId,
      campusId: req.campusId || req.body?.campusId,
      reason: err.message,
      statusCode: 400,
    });
    (req.log || logger).error({ err }, 'Student register error');
    res.status(400).json({ error: err.message });
  }
});

// Login Student
router.post('/login', rateLimit({ windowMs: 60 * 1000, max: 10 }), async (req, res) => {
  // #swagger.tags = ['Students']
  const rawUsername = req.body?.username;
  const rawStudentId = req.body?.studentId;
  const rawId = req.body?.id;
  const rawPassword = req.body?.password;
  if (
    (rawUsername !== undefined && typeof rawUsername !== 'string')
    || (rawStudentId !== undefined && typeof rawStudentId !== 'string')
    || (rawId !== undefined && typeof rawId !== 'string')
    || typeof rawPassword !== 'string'
  ) {
    return res.status(400).json({ error: 'Student ID and password must be valid text values' });
  }
  const identifier = (rawUsername || rawStudentId || rawId || '').trim();
  const password = rawPassword;

  try {
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Student ID and password are required' });
    }
    const user = await StudentUser.findOne({
      $or: [{ username: identifier }, { studentCode: identifier }],
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      logAuthEvent(req, {
        action: 'login',
        outcome: 'failure',
        userType: 'student',
        organizationId: user.organizationId || req.organizationId || null,
        identifier,
        reason: 'Invalid credentials',
        statusCode: 401,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.isArchived) {
      logAuthEvent(req, {
        action: 'login',
        outcome: 'failure',
        userType: 'student',
        identifier,
        userId: user._id,
        schoolId: user.schoolId,
        campusId: user.campusId,
        reason: 'Account archived',
        statusCode: 403,
      });
      return res.status(403).json({ error: 'You have been blocked by your organization.' });
    }
    if (!user.campusId) {
      logAuthEvent(req, {
        action: 'login',
        outcome: 'failure',
        userType: 'student',
        identifier,
        userId: user._id,
        schoolId: user.schoolId,
        reason: 'campusId missing',
        statusCode: 400,
      });
      return res.status(400).json({ error: 'campusId is required for this account' });
    }
    if (!user.lastLoginAt) {
      logAuthEvent(req, {
        action: 'login.first_login_required',
        outcome: 'success',
        userType: 'student',
        identifier,
        userId: user._id,
        schoolId: user.schoolId,
        campusId: user.campusId,
      });
      return res.json({ requiresPasswordReset: true, username: user.username || user.studentCode });
    }
    if (!user.studentCode) {
      user.studentCode = user.username;
      await user.save();
    }

    const token = jwt.sign(
      {
        id: user._id,
        userType: 'student',
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
      userType: 'student',
      identifier,
      userId: user._id,
      schoolId: user.schoolId,
      campusId: user.campusId,
    });
    res.json({ token });
  } catch (err) {
    logAuthEvent(req, {
      action: 'login',
      outcome: 'failure',
      userType: 'student',
      identifier,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

router.post('/reset-first-password', rateLimit({ windowMs: 60 * 1000, max: 10 }), async (req, res) => {
  // #swagger.tags = ['Students']
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

    const user = await StudentUser.findOne({
      $or: [
        { username: String(username).trim() },
        { studentCode: String(username).trim() },
      ],
    });
    if (!user) {
      return res.status(404).json({ error: 'Student not found' });
    }
    if (user.lastLoginAt) {
      return res.status(400).json({ error: 'Password reset already completed' });
    }

    user.password = String(newPassword);
    user.initialPassword = "";
    user.lastLoginAt = new Date();
    if (!user.studentCode) {
      user.studentCode = user.username;
    }
    await user.save();
    logAuthEvent(req, {
      action: 'reset_first_password',
      outcome: 'success',
      userType: 'student',
      identifier: user.username || user.studentCode || username,
      userId: user._id,
      schoolId: user.schoolId,
      campusId: user.campusId,
    });
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    logAuthEvent(req, {
      action: 'reset_first_password',
      outcome: 'failure',
      userType: 'student',
      identifier: username,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

// Test endpoint to check if any students exist
router.get('/test/list', adminAuth, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    const filter = req.schoolId ? { schoolId: req.schoolId } : {};
    if (req.campusId) {
      filter.campusId = req.campusId;
    }
    const students = await StudentUser.find(filter).select('username name grade section').limit(5).lean();
    res.json({
      total: await StudentUser.countDocuments(filter),
      sample: students
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Student Profile
router.get('/profile', authStudent, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    (req.log || logger).info({ userId: req.user?.id, userType: req.userType }, 'Student profile request received');
    const student = await StudentUser.findById(req.user.id)
      .select('-password')
      .populate('schoolId', 'name code address logo')
      .lean();
    (req.log || logger).info({ found: Boolean(student) }, 'Student profile lookup completed');

    if (!student) {
      (req.log || logger).warn({ userId: req.user?.id }, 'Student profile not found in database');
      return res.status(404).json({ error: 'Student not found' });
    }

    const schoolInfo = extractSchoolInfo(student.schoolId);
    const response = {
      ...student,
      schoolId: schoolInfo?.id || student.schoolId || null,
      schoolInfo,
      schoolName: schoolInfo?.name || '',
      schoolAddress: schoolInfo?.address || '',
      schoolLogo: schoolInfo?.logo || null,
      profilePic: resolveProfilePhoto(student),
      avatar: resolveProfilePhoto(student),
    };
    (req.log || logger).info({ userId: req.user?.id }, 'Student profile response sent');
    res.json(response);
  } catch (err) {
    (req.log || logger).error({ err, userId: req.user?.id }, 'Get profile error');
    res.status(400).json({ error: err.message });
  }
});

// Get achievements for logged-in student
router.get('/achievements', authStudent, async (req, res) => {
  try {
    const student = await StudentUser.findById(req.user.id)
      .select('name grade section achievements')
      .lean();

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const achievements = Array.isArray(student.achievements) ? student.achievements : [];
    achievements.sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0));

    res.json({
      student: {
        id: student._id,
        name: student.name || '',
        grade: student.grade || '',
        section: student.section || '',
      },
      achievements,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load achievements' });
  }
});

// Get class teacher for logged-in student
router.get('/class-teacher', authStudent, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const schoolId = req.schoolId || null;
    const campusId = req.campusId || null;
    const studentId = req.user?.id;
    if (!schoolId || !studentId) {
      return res.status(400).json({ error: 'schoolId and studentId are required' });
    }
    logStudentPortalEvent(req, {
      feature: 'dashboard',
      action: 'class_teacher.fetch',
      targetType: 'student',
      targetId: studentId,
    });

    const student = await StudentUser.findById(studentId)
      .select('grade class className section sectionName')
      .lean();
    if (!student) {
      logStudentPortalEvent(req, {
        feature: 'dashboard',
        action: 'class_teacher.fetch',
        outcome: 'not_found',
        statusCode: 404,
        targetType: 'student',
        targetId: studentId,
      });
      return res.status(404).json({ error: 'Student not found' });
    }

    const rawClassName = String(
      student.class ||
      student.className ||
      student.grade ||
      ''
    ).trim();
    const classNameCandidates = new Set();
    if (rawClassName) {
      classNameCandidates.add(rawClassName);
      if (/^\d+$/i.test(rawClassName)) classNameCandidates.add(`Class ${rawClassName}`);
      if (/^class\s+/i.test(rawClassName)) classNameCandidates.add(rawClassName.replace(/^class\s+/i, '').trim());
    }

    let classDocs = [];
    if (classNameCandidates.size) {
      const classRegex = Array.from(classNameCandidates)
        .map((name) => String(name || '').trim())
        .filter(Boolean)
        .map((name) => new RegExp(`^${escapeRegex(name)}$`, 'i'));
      const classBaseFilter = {
        schoolId,
        ...(classRegex.length ? { name: { $in: classRegex } } : {}),
      };
      classDocs = await ClassModel.find({
        ...classBaseFilter,
        ...(campusId ? { campusId } : {}),
      }).select('_id name').sort({ updatedAt: -1 }).lean();
      // Fallback for legacy records that may not carry campusId.
      if (!classDocs.length && campusId) {
        classDocs = await ClassModel.find(classBaseFilter).select('_id name').sort({ updatedAt: -1 }).lean();
      }
    }

    if (!classDocs.length) {
      logStudentPortalEvent(req, {
        feature: 'dashboard',
        action: 'class_teacher.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'teacher',
        targetId: null,
        hasTeacher: false,
      });
      return res.json({ teacher: null });
    }

    const sectionName = String(student.section || student.sectionName || '').trim();
    let sectionDocs = [];
    if (sectionName) {
      const classIds = classDocs.map((item) => item._id);
      const sectionBaseFilter = {
        schoolId,
        classId: { $in: classIds },
        name: new RegExp(`^${escapeRegex(sectionName)}$`, 'i'),
      };
      sectionDocs = await Section.find({
        ...sectionBaseFilter,
        ...(campusId ? { campusId } : {}),
      }).select('_id name classId').sort({ updatedAt: -1 }).lean();
      // Fallback for legacy records that may not carry campusId.
      if (!sectionDocs.length && campusId) {
        sectionDocs = await Section.find(sectionBaseFilter).select('_id name classId').sort({ updatedAt: -1 }).lean();
      }
    }

    if (!sectionDocs.length) {
      logStudentPortalEvent(req, {
        feature: 'dashboard',
        action: 'class_teacher.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'teacher',
        targetId: null,
        hasTeacher: false,
      });
      return res.json({ teacher: null });
    }

    const allocationBaseFilter = {
      schoolId,
      classId: { $in: classDocs.map((item) => item._id) },
      sectionId: { $in: sectionDocs.map((item) => item._id) },
      isClassTeacher: true,
    };
    let allocation = await TeacherAllocation.findOne({
      ...allocationBaseFilter,
      ...(campusId ? { campusId } : {}),
    })
      .populate('teacherId', 'name email mobile profilePic')
      .populate('subjectId', 'name')
      .sort({ updatedAt: -1 })
      .lean();
    // Fallback for legacy records that may not carry campusId.
    if (!allocation && campusId) {
      allocation = await TeacherAllocation.findOne(allocationBaseFilter)
        .populate('teacherId', 'name email mobile profilePic')
        .populate('subjectId', 'name')
        .sort({ updatedAt: -1 })
        .lean();
    }

    if (!allocation?.teacherId) {
      logStudentPortalEvent(req, {
        feature: 'dashboard',
        action: 'class_teacher.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'teacher',
        targetId: null,
        hasTeacher: false,
      });
      return res.json({ teacher: null });
    }

    const classDoc = classDocs.find((item) => String(item._id) === String(allocation.classId)) || classDocs[0] || null;
    const sectionDoc = sectionDocs.find((item) => String(item._id) === String(allocation.sectionId)) || sectionDocs[0] || null;

    res.json({
      teacher: {
        id: allocation.teacherId._id,
        name: allocation.teacherId.name || '',
        email: allocation.teacherId.email || '',
        mobile: allocation.teacherId.mobile || '',
        profilePic: allocation.teacherId.profilePic || '',
        subject: allocation.subjectId?.name || '',
        className: classDoc.name || '',
        sectionName: sectionDoc.name || '',
      },
    });
    logStudentPortalEvent(req, {
      feature: 'dashboard',
      action: 'class_teacher.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'teacher',
      targetId: allocation.teacherId._id,
      hasTeacher: true,
      subjectName: allocation.subjectId?.name || '',
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'dashboard',
      action: 'class_teacher.fetch',
      statusCode: 400,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(400).json({ error: err.message });
  }
});

// Get Student Dashboard Data (stats, courses, etc.)
router.get('/dashboard', authStudent, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    logStudentPortalEvent(req, {
      feature: 'dashboard',
      action: 'dashboard.fetch',
      targetType: 'student',
      targetId: req.user?.id,
    });
    const student = await StudentUser.findById(req.user.id)
      .populate('schoolId', 'name code address logo')
      .lean();

    if (!student) {
      logStudentPortalEvent(req, {
        feature: 'dashboard',
        action: 'dashboard.fetch',
        outcome: 'not_found',
        statusCode: 404,
        targetType: 'student',
        targetId: req.user?.id,
      });
      return res.status(404).json({ error: 'Student not found' });
    }

    // Calculate stats
    const totalAttendance = student.attendance?.length || 0;
    const presentDays = student.attendance?.filter(a => a.status === 'present').length || 0;
    const attendancePercentage = totalAttendance > 0 ? Math.round((presentDays / totalAttendance) * 100) : 0;
    const totalAchievements = Array.isArray(student.achievements) ? student.achievements.length : 0;

    const resolvedGrade = student.grade || '';
    const resolvedSection = student.section || '';
    const resolvedRoll = student.roll || '';

    const courseInfo = null;

    const schoolInfo = extractSchoolInfo(student.schoolId);

    const dashboardData = {
      profile: {
        name: student.name,
        username: student.username,
        email: student.email,
        mobile: student.mobile,
        grade: resolvedGrade,
        section: resolvedSection,
        roll: resolvedRoll,
        className: resolvedGrade,
        sectionName: resolvedSection,
        rollNumber: resolvedRoll,
        profilePic: resolveProfilePhoto(student),
        avatar: resolveProfilePhoto(student),
        campusName: student.campusName || '',
        campusType: student.campusType || '',
        school: schoolInfo,
        schoolName: schoolInfo?.name || '',
        schoolAddress: schoolInfo?.address || '',
        schoolLogo: schoolInfo?.logo || null,
      },
      stats: {
        attendancePercentage,
        totalClasses: totalAttendance,
        presentDays,
        absentDays: totalAttendance - presentDays,
        activeCourses: courseInfo ? 1 : 0,
        achievements: totalAchievements,
        studyHours: 0, // Can be enhanced later
        overallProgress: attendancePercentage, // Use attendance as proxy for now
      },
      course: courseInfo,
      recentAttendance: student.attendance?.slice(-10) || [],
      school: schoolInfo,
    };

    res.json(dashboardData);
    logStudentPortalEvent(req, {
      feature: 'dashboard',
      action: 'dashboard.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      attendancePercentage,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'dashboard',
      action: 'dashboard.fetch',
      statusCode: 400,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    (req.log || logger).error({ err }, 'Dashboard data error');
    res.status(400).json({ error: err.message });
  }
});

// Student Journal - List entries
router.get('/journal', authStudent, async (req, res) => {
  // #swagger.tags = ['Student Journal']
  try {
    if (!req.schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    const entries = await StudentJournalEntry.find({
      studentId: req.user.id,
      schoolId: req.schoolId,
      campusId: req.campusId,
    })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ entries });
    logStudentPortalEvent(req, {
      feature: 'assignments_journal',
      action: 'journal.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      resultCount: entries.length,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'assignments_journal',
      action: 'journal.fetch',
      statusCode: 400,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(400).json({ error: err.message });
  }
});

// Student Journal - Create entry
router.post('/journal', authStudent, async (req, res) => {
  // #swagger.tags = ['Student Journal']
  try {
    if (!req.schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    const { title, content, tags, mood } = req.body || {};
    if (!String(title || '').trim() && !String(content || '').trim()) {
      return res.status(400).json({ error: 'Title or content is required' });
    }
    const entry = await StudentJournalEntry.create({
      studentId: req.user.id,
      schoolId: req.schoolId,
      campusId: req.campusId,
      title: String(title || '').trim() || 'Untitled',
      content: content || '',
      tags: normalizeTags(tags),
      mood: String(mood || 'Neutral'),
    });
    res.status(201).json({ entry });
    logStudentPortalEvent(req, {
      feature: 'assignments_journal',
      action: 'journal.create',
      outcome: 'success',
      statusCode: 201,
      targetType: 'journal_entry',
      targetId: entry._id,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'assignments_journal',
      action: 'journal.create',
      statusCode: 400,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(400).json({ error: err.message });
  }
});

// Student Journal - Update entry
router.put('/journal/:id', authStudent, async (req, res) => {
  // #swagger.tags = ['Student Journal']
  try {
    if (!req.schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    const { title, content, tags, mood } = req.body || {};
    const entry = await StudentJournalEntry.findOneAndUpdate(
      {
        _id: req.params.id,
        studentId: req.user.id,
        schoolId: req.schoolId,
        campusId: req.campusId,
      },
      {
        $set: {
          title: String(title || '').trim() || 'Untitled',
          content: content || '',
          tags: normalizeTags(tags),
          mood: String(mood || 'Neutral'),
          updatedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json({ entry });
    logStudentPortalEvent(req, {
      feature: 'assignments_journal',
      action: 'journal.update',
      outcome: 'success',
      statusCode: 200,
      targetType: 'journal_entry',
      targetId: req.params.id,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'assignments_journal',
      action: 'journal.update',
      statusCode: 400,
      err,
      targetType: 'journal_entry',
      targetId: req.params.id,
    });
    res.status(400).json({ error: err.message });
  }
});

// Student Journal - Delete entry
router.delete('/journal/:id', authStudent, async (req, res) => {
  // #swagger.tags = ['Student Journal']
  try {
    if (!req.schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    const entry = await StudentJournalEntry.findOneAndDelete({
      _id: req.params.id,
      studentId: req.user.id,
      schoolId: req.schoolId,
      campusId: req.campusId,
    });
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json({ message: 'Entry deleted' });
    logStudentPortalEvent(req, {
      feature: 'assignments_journal',
      action: 'journal.delete',
      outcome: 'success',
      statusCode: 200,
      targetType: 'journal_entry',
      targetId: req.params.id,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'assignments_journal',
      action: 'journal.delete',
      statusCode: 400,
      err,
      targetType: 'journal_entry',
      targetId: req.params.id,
    });
    res.status(400).json({ error: err.message });
  }
});

// Get Student Attendance
router.get('/attendance', authStudent, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    logStudentPortalEvent(req, {
      feature: 'attendance',
      action: 'attendance.fetch',
      targetType: 'student',
      targetId: req.user?.id,
    });
    const student = await StudentUser.findById(req.user.id)
      .select('attendance name grade section')
      .lean();

    if (!student) {
      logStudentPortalEvent(req, {
        feature: 'attendance',
        action: 'attendance.fetch',
        outcome: 'not_found',
        statusCode: 404,
        targetType: 'student',
        targetId: req.user?.id,
      });
      return res.status(404).json({ error: 'Student not found' });
    }

    const attendance = student.attendance || [];
    const totalClasses = attendance.length;
    const presentDays = attendance.filter(a => a.status === 'present').length;
    const absentDays = attendance.filter(a => a.status === 'absent').length;
    const leaveDays = attendance.filter(a => a.status === 'leave').length;
    const attendancePercentage = totalClasses > 0 ? Math.round((presentDays / totalClasses) * 100) : 0;

    res.json({
      attendance: attendance.sort((a, b) => new Date(b.date) - new Date(a.date)),
      summary: {
        totalClasses,
        presentDays,
        absentDays,
        leaveDays,
        attendancePercentage
      }
    });
    logStudentPortalEvent(req, {
      feature: 'attendance',
      action: 'attendance.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      resultCount: attendance.length,
      attendancePercentage,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'attendance',
      action: 'attendance.fetch',
      statusCode: 400,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    (req.log || logger).error({ err }, 'Attendance error');
    res.status(400).json({ error: err.message });
  }
});

// Get Student Assignments
router.get('/assignments', authStudent, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    logStudentPortalEvent(req, {
      feature: 'assignments',
      action: 'assignments.fetch',
      targetType: 'student',
      targetId: req.user?.id,
    });
    const student = await StudentUser.findById(req.user.id)
      .select('assignments name grade section')
      .lean();

    if (!student) {
      logStudentPortalEvent(req, {
        feature: 'assignments',
        action: 'assignments.fetch',
        outcome: 'not_found',
        statusCode: 404,
        targetType: 'student',
        targetId: req.user?.id,
      });
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({
      assignments: student.assignments || []
    });
    logStudentPortalEvent(req, {
      feature: 'assignments',
      action: 'assignments.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      resultCount: Array.isArray(student.assignments) ? student.assignments.length : 0,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'assignments',
      action: 'assignments.fetch',
      statusCode: 400,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    (req.log || logger).error({ err }, 'Assignments error');
    res.status(400).json({ error: err.message });
  }
});

// Get Student Results
router.get('/results', authStudent, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    logStudentPortalEvent(req, {
      feature: 'results',
      action: 'results.fetch',
      targetType: 'student',
      targetId: req.user?.id,
    });
    const student = await StudentUser.findById(req.user.id)
      .select('name grade section schoolId campusId')
      .lean();

    if (!student) {
      logStudentPortalEvent(req, {
        feature: 'results',
        action: 'results.fetch',
        outcome: 'not_found',
        statusCode: 404,
        targetType: 'student',
        targetId: req.user?.id,
      });
      return res.status(404).json({ error: 'Student not found' });
    }

    // Fetch exam results from ExamResult collection (only published results)
    const examResults = await ExamResult.find({
      studentId: req.user.id,
      schoolId: student.schoolId,
      published: true, // Only show published results to students
      ...(student.campusId ? { campusId: student.campusId } : {}),
    })
      .populate('examId', 'title subject date term marks')
      .sort({ createdAt: -1 })
      .lean();

    // Transform exam results
    const formattedResults = examResults.map(result => ({
      _id: result._id,
      examName: result.examId?.title || 'Exam',
      subject: result.examId?.subject || '',
      date: result.examId?.date || null,
      type: result.examId?.term || 'general',
      resultType: 'exam',
      obtainedMarks: result.marks || 0,
      totalMarks: result.examId?.marks || 100,
      percentage: result.examId?.marks ? Math.round((result.marks / result.examId.marks) * 100) : 0,
      grade: result.grade || '',
      status: result.status || 'pass',
      remarks: result.remarks || '',
      subjects: []
    }));

    // Fetch graded assignment results from StudentProgress
    const progress = await StudentProgress.findOne({
      studentId: req.user.id,
      schoolId: student.schoolId
    }).lean();

    const gradedSubmissions = (progress?.submissions || []).filter(
      sub => sub.status === 'graded' && sub.score !== undefined && sub.score !== null
    );

    let assignmentResults = [];
    if (gradedSubmissions.length > 0) {
      const assignmentIds = gradedSubmissions.map(s => s.assignmentId);
      const assignments = await Assignment.find({ _id: { $in: assignmentIds } })
        .select('title subject marks dueDate')
        .lean();
      const aMap = {};
      assignments.forEach(a => { aMap[String(a._id)] = a; });

      assignmentResults = gradedSubmissions.map(sub => {
        const a = aMap[String(sub.assignmentId)] || {};
        const total = a.marks || 100;
        const obtained = sub.score;
        return {
          _id: sub._id,
          examName: a.title || 'Assignment',
          subject: a.subject || '',
          date: sub.submittedAt || null,
          type: 'assignment',
          resultType: 'assignment',
          obtainedMarks: obtained,
          totalMarks: total,
          percentage: Math.round((obtained / total) * 100),
          grade: obtained >= total * 0.9 ? 'A+' : obtained >= total * 0.8 ? 'A' : obtained >= total * 0.7 ? 'B' : obtained >= total * 0.6 ? 'C' : obtained >= total * 0.5 ? 'D' : 'F',
          status: obtained >= total * 0.4 ? 'pass' : 'fail',
          remarks: sub.feedback || '',
          subjects: []
        };
      });
    }

    res.json({
      results: [...formattedResults, ...assignmentResults]
    });
    logStudentPortalEvent(req, {
      feature: 'results',
      action: 'results.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      resultCount: formattedResults.length + assignmentResults.length,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'results',
      action: 'results.fetch',
      statusCode: 400,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    (req.log || logger).error({ err }, 'Results error');
    res.status(400).json({ error: err.message });
  }
});

// Get Student Schedule/Routine
router.get('/schedule', authStudent, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    logStudentPortalEvent(req, {
      feature: 'schedule',
      action: 'schedule.fetch',
      targetType: 'student',
      targetId: req.user?.id,
    });
    const student = await StudentUser.findById(req.user.id)
      .select('grade section schoolId campusId academicYear')
      .lean();

    if (!student) {
      logStudentPortalEvent(req, {
        feature: 'schedule',
        action: 'schedule.fetch',
        outcome: 'not_found',
        statusCode: 404,
        targetType: 'student',
        targetId: req.user?.id,
      });
      return res.status(404).json({ error: 'Student not found' });
    }

    const normalizeKey = (value) =>
      String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');
    const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const resolvedGrade = String(student.grade || '').trim();
    const resolvedSection = String(student.section || '').trim();

    if (!resolvedGrade) {
      logStudentPortalEvent(req, {
        feature: 'schedule',
        action: 'schedule.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'student',
        targetId: req.user?.id,
        resultCount: 0,
      });
      return res.json({ schedule: [] });
    }

    const [activeYear] = await Promise.all([
      AcademicYear.findOne({ schoolId: student.schoolId, isActive: true })
        .select('_id name')
        .lean(),
    ]);

    // Find class candidates by grade/class name (handle duplicate class names across years).
    const classFilter = { schoolId: student.schoolId };
    if (student.campusId) classFilter.campusId = student.campusId;
    const classCandidates = await Class.find({
      ...classFilter,
      name: { $regex: `^${escapeRegex(resolvedGrade)}$`, $options: 'i' },
    })
      .sort({ createdAt: -1 })
      .lean();

    let classDoc = null;
    if (Array.isArray(classCandidates) && classCandidates.length > 0) {
      // Prefer active academic year class first so promoted students don't get previous-year routine.
      if (activeYear?._id) {
        classDoc =
          classCandidates.find((doc) => String(doc.academicYearId || '') === String(activeYear._id)) ||
          null;
      }

      // Fallback to student's tagged academic year name when available.
      if (!classDoc && student.academicYear) {
        const yearDocs = await AcademicYear.find({
          _id: { $in: classCandidates.map((doc) => doc.academicYearId).filter(Boolean) },
        })
          .select('_id name')
          .lean();
        const yearNameById = new Map(
          yearDocs.map((doc) => [String(doc._id), String(doc.name || '').trim().toLowerCase()])
        );
        const studentYearKey = String(student.academicYear || '').trim().toLowerCase();
        classDoc =
          classCandidates.find(
            (doc) => yearNameById.get(String(doc.academicYearId || '')) === studentYearKey
          ) || null;
      }

      if (!classDoc) {
        classDoc = classCandidates[0];
      }
    }

    if (!classDoc) {
      logStudentPortalEvent(req, {
        feature: 'schedule',
        action: 'schedule.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'student',
        targetId: req.user?.id,
        resultCount: 0,
      });
      return res.json({ schedule: [] });
    }

    // Load timetables for class and resolve section by student credential
    const timetableBaseFilter = {
      schoolId: student.schoolId,
      classId: classDoc._id,
    };
    if (student.campusId) {
      timetableBaseFilter.campusId = student.campusId;
    }
    const preferredAcademicYearId = classDoc.academicYearId || activeYear?._id || null;
    const filters = preferredAcademicYearId
      ? [
          { ...timetableBaseFilter, academicYearId: preferredAcademicYearId },
          timetableBaseFilter,
        ]
      : [timetableBaseFilter];

    let timetables = [];
    for (const filter of filters) {
      const found = await Timetable.find(filter)
        .populate('sectionId', 'name')
        .populate('entries.subjectId', 'name')
        .populate('entries.teacherId', 'name')
        .lean();
      if (Array.isArray(found) && found.length > 0) {
        timetables = found;
        break;
      }
    }

    if (!Array.isArray(timetables) || timetables.length === 0) {
      logStudentPortalEvent(req, {
        feature: 'schedule',
        action: 'schedule.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'student',
        targetId: req.user?.id,
        resultCount: 0,
      });
      return res.json({ schedule: [] });
    }

    let timetable = null;
    if (resolvedSection) {
      const normalizedSection = normalizeKey(resolvedSection);
      timetable = timetables.find((tt) => {
        const sectionName = tt?.sectionId?.name || '';
        return normalizeKey(sectionName) === normalizedSection;
      }) || null;
    }

    if (!timetable) {
      timetable = timetables.find((tt) => !tt.sectionId) || timetables[0];
    }

    if (!timetable || !Array.isArray(timetable.entries) || timetable.entries.length === 0) {
      logStudentPortalEvent(req, {
        feature: 'schedule',
        action: 'schedule.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'student',
        targetId: req.user?.id,
        resultCount: 0,
      });
      return res.json({ schedule: [] });
    }

    const resolvedSectionName = timetable?.sectionId?.name || resolvedSection || '';

    // Transform timetable entries to schedule format grouped by day
    const scheduleByDay = {};
    timetable.entries.forEach(entry => {
      if (!scheduleByDay[entry.dayOfWeek]) {
        scheduleByDay[entry.dayOfWeek] = [];
      }
      scheduleByDay[entry.dayOfWeek].push({
        time: `${entry.startTime} - ${entry.endTime}`,
        subject: entry.subjectId?.name || entry.subjectName || entry.subject || 'Subject',
        instructor: entry.teacherId?.name || 'TBA',
        room: entry.room || '',
        period: entry.period,
        className: classDoc.name,
        sectionName: resolvedSectionName,
      });
    });

    // Sort periods within each day
    Object.keys(scheduleByDay).forEach(day => {
      scheduleByDay[day].sort((a, b) => a.period - b.period);
    });

    res.json({
      schedule: scheduleByDay
    });
    logStudentPortalEvent(req, {
      feature: 'schedule',
      action: 'schedule.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      resultCount: Object.keys(scheduleByDay).length,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'schedule',
      action: 'schedule.fetch',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    (req.log || logger).error({ err }, 'Schedule error');
    res.status(500).json({ error: err.message });
  }
});

// Teacher feedback context (subjects/teachers)
router.get('/teacher-feedback/context', authStudent, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    logStudentPortalEvent(req, {
      feature: 'teacher_feedback',
      action: 'feedback_context.fetch',
      targetType: 'student',
      targetId: req.user?.id,
    });
    const student = await StudentUser.findById(req.user.id)
      .select('name grade section schoolId campusId')
      .lean();

    if (!student) {
      logStudentPortalEvent(req, {
        feature: 'teacher_feedback',
        action: 'feedback_context.fetch',
        outcome: 'not_found',
        statusCode: 404,
        targetType: 'student',
        targetId: req.user?.id,
      });
      return res.status(404).json({ error: 'Student not found' });
    }

    const availability = await resolveTeacherFeedbackAvailability(student.schoolId);
    const { contexts } = await buildTeacherFeedbackContext(student);
    res.json({
      teachers: contexts,
      feedbackWindow: {
        isOpen: availability.isOpen,
        reason: availability.reason,
        message: availability.message,
        startDate: availability.settings.startDate,
        endDate: availability.settings.endDate,
        enabled: availability.settings.enabled,
      },
    });
    logStudentPortalEvent(req, {
      feature: 'teacher_feedback',
      action: 'feedback_context.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      resultCount: contexts.length,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'teacher_feedback',
      action: 'feedback_context.fetch',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    (req.log || logger).error({ err }, 'Teacher feedback context error');
    res.status(500).json({ error: err.message });
  }
});

// Get student's previous teacher feedback
router.get('/teacher-feedback', authStudent, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    logStudentPortalEvent(req, {
      feature: 'teacher_feedback',
      action: 'feedback_list.fetch',
      targetType: 'student',
      targetId: req.user?.id,
    });
    const feedbackDocs = await TeacherFeedback.find({ studentId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = feedbackDocs.map(doc => ({
      id: doc._id,
      teacherId: doc.teacherId,
      teacherName: doc.teacherName,
      teacherProfilePic: doc.teacherProfilePic,
      subjectName: doc.subjectName,
      className: doc.className,
      sectionName: doc.sectionName,
      ratings: doc.ratings || {},
      overallRating: doc.overallRating || 0,
      comments: doc.comments || '',
      createdAt: doc.createdAt,
      isAnonymous: Boolean(doc.isAnonymous)
    }));

    res.json(formatted);
    logStudentPortalEvent(req, {
      feature: 'teacher_feedback',
      action: 'feedback_list.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      resultCount: formatted.length,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'teacher_feedback',
      action: 'feedback_list.fetch',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    (req.log || logger).error({ err }, 'Teacher feedback list error');
    res.status(500).json({ error: err.message });
  }
});

// Submit teacher feedback
router.post('/teacher-feedback', authStudent, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    logStudentPortalEvent(req, {
      feature: 'teacher_feedback',
      action: 'feedback_submit.create',
      targetType: 'student',
      targetId: req.user?.id,
      teacherId: req.body?.teacherId || undefined,
      subjectName: req.body?.subjectName || undefined,
    });
    const student = await StudentUser.findById(req.user.id)
      .select('name grade section schoolId campusId')
      .lean();

    if (!student) {
      logStudentPortalEvent(req, {
        feature: 'teacher_feedback',
        action: 'feedback_submit.create',
        outcome: 'not_found',
        statusCode: 404,
        targetType: 'student',
        targetId: req.user?.id,
      });
      return res.status(404).json({ error: 'Student not found' });
    }

    const availability = await resolveTeacherFeedbackAvailability(student.schoolId);
    if (!availability.isOpen) {
      return res.status(403).json({
        error: availability.message || 'Teacher feedback is not open right now',
        reason: availability.reason,
        feedbackWindow: {
          enabled: availability.settings.enabled,
          startDate: availability.settings.startDate,
          endDate: availability.settings.endDate,
        },
      });
    }

    const { teacherId, subjectId, subjectName, ratings = {}, comments = '' } = req.body || {};
    if (!teacherId || !subjectName) {
      return res.status(400).json({ error: 'Teacher and subject are required' });
    }
    const normalizedSubjectName = normalizeString(subjectName);
    const isAnonymous = true;

    const normalizedRatings = {};
    Object.entries(ratings || {}).forEach(([key, value]) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) return;
      const bounded = Math.max(1, Math.min(5, parsed));
      normalizedRatings[key] = bounded;
    });
    const ratingValues = Object.values(normalizedRatings);
    if (ratingValues.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one rating' });
    }

    const { classDoc, contexts } = await buildTeacherFeedbackContext(student);
    const selectedContext = contexts.find(ctx => {
      if (ctx.teacherId !== String(teacherId)) return false;
      if (ctx.subjectId && subjectId) {
        return ctx.subjectId === String(subjectId);
      }
      if (!ctx.subjectId && !subjectId) {
        return normalizeString(ctx.subjectName) === normalizedSubjectName;
      }
      return !ctx.subjectId && !subjectId;
    });

    if (!selectedContext) {
      return res.status(400).json({ error: 'Selected teacher or subject is not associated with your class' });
    }

    const teacher = await TeacherUser.findOne({
      _id: teacherId,
      schoolId: student.schoolId
    })
      .select('name profilePic')
      .lean();

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const overallRating = ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length;

    const feedbackDoc = await TeacherFeedback.create({
      schoolId: student.schoolId,
      campusId: student.campusId || req.campusId || null,
      studentId: req.user.id,
      studentName: '',
      isAnonymous,
      classId: selectedContext.classId || classDoc?._id || null,
      className: selectedContext.className || student.grade || '',
      sectionId: selectedContext.sectionId || null,
      sectionName: selectedContext.sectionName || student.section || '',
      teacherId,
      teacherName: teacher.name || selectedContext.teacherName,
      teacherProfilePic: teacher.profilePic || selectedContext.teacherProfilePic || '',
      subjectId: subjectId || selectedContext.subjectId || null,
      subjectName: subjectName || selectedContext.subjectName,
      ratings: normalizedRatings,
      overallRating,
      comments: comments || ''
    });

    res.status(201).json({
      message: 'Feedback submitted',
      feedback: {
        id: feedbackDoc._id,
        teacherId: feedbackDoc.teacherId,
        teacherName: feedbackDoc.teacherName,
        teacherProfilePic: feedbackDoc.teacherProfilePic,
        subjectName: feedbackDoc.subjectName,
        className: feedbackDoc.className,
        sectionName: feedbackDoc.sectionName,
        ratings: feedbackDoc.ratings,
        overallRating: feedbackDoc.overallRating,
        comments: feedbackDoc.comments,
        createdAt: feedbackDoc.createdAt,
        isAnonymous: Boolean(feedbackDoc.isAnonymous)
      }
    });
    logStudentPortalEvent(req, {
      feature: 'teacher_feedback',
      action: 'feedback_submit.create',
      outcome: 'success',
      statusCode: 201,
      targetType: 'teacher_feedback',
      targetId: feedbackDoc._id,
      teacherId: feedbackDoc.teacherId,
      subjectName: feedbackDoc.subjectName,
      overallRating,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'teacher_feedback',
      action: 'feedback_submit.create',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
      teacherId: req.body?.teacherId || undefined,
      subjectName: req.body?.subjectName || undefined,
    });
    (req.log || logger).error({ err }, 'Teacher feedback submit error');
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
