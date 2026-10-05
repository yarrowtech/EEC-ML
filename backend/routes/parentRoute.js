const express = require('express');
const router = express.Router();
const ParentUser = require('../models/ParentUser');
const { isParentLoginBlocked, PARENT_BLOCKED_MESSAGE } = require('../utils/parentArchiveSync');
const StudentUser = require('../models/StudentUser');
const ClassModel = require('../models/Class');
const AcademicYear = require('../models/AcademicYear');
const Timetable = require('../models/Timetable');
const Room = require('../models/Room');
const Building = require('../models/Building');
const Floor = require('../models/Floor');
const SupportRequest = require('../models/SupportRequest');
const Admin = require('../models/Admin');
const Section = require('../models/Section');
const TeacherAllocation = require('../models/TeacherAllocation');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const adminAuth = require('../middleware/adminAuth');
const authParent = require('../middleware/authParent');
const { generateUsername, generatePassword } = require('../utils/generator');
const rateLimit = require('../middleware/rateLimit');
const { isStrongPassword, passwordPolicyMessage } = require('../utils/passwordPolicy');
const { logAuthEvent } = require('../utils/authEventLogger');
const { resolveParentChildren } = require('../utils/parentChildren');
const { notifyComplaintCreated } = require('../utils/complaintNotifications');
const Wellbeing = require('../models/Wellbeing');
const { createResponseCache } = require('../utils/responseCache');

// Child profiles change rarely (admin edits happen in other routers), so a
// short TTL bounds staleness while making repeat visits instant.
const childrenProfileCache = createResponseCache({ ttlMs: 60 * 1000 });

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const padNumber = (value, size = 3) => String(value).padStart(size, '0');
const normalizeOrgPrefix = (adminUsername) => {
  const normalized = String(adminUsername || '')
    .trim()
    .toUpperCase()
    .replace(/^EEC[-_]?/, '')
    .replace(/[^A-Z0-9-]/g, '');
  return normalized || 'SCH';
};
const resolveParentPrefix = ({ adminUsername, year }) =>
  `${normalizeOrgPrefix(adminUsername)}-PTA-${String(year).slice(-2)}-`;
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

const generateTicketNumber = () => {
  const randomSegment = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SR-${Date.now().toString(36).toUpperCase()}-${randomSegment}`;
};

const fetchParentStudents = async ({ parent, schoolId }) => {
  if (!parent || !schoolId) return [];
  const baseFilter = { schoolId };
  let students = [];
  const childIds = Array.isArray(parent.childrenIds) ? parent.childrenIds.filter(Boolean) : [];

  if (childIds.length > 0) {
    students = await StudentUser.find({
      ...baseFilter,
      _id: { $in: childIds },
    })
      .select('name grade section studentCode username roll admissionNumber profilePic')
      .lean();
  }

  if (
    students.length === 0 &&
    Array.isArray(parent.children) &&
    parent.children.length > 0
  ) {
    const validNames = parent.children.map((name) => String(name || '').trim()).filter(Boolean);
    if (validNames.length > 0) {
      students = await StudentUser.find({
        ...baseFilter,
        name: { $in: validNames },
      })
        .select('name grade section studentCode username roll admissionNumber')
        .lean();
    }
  }

  return students;
};

const findClassTeacherForStudent = async ({ student, schoolId }) => {
  if (!student || !student.grade) return null;

  const classDoc = await ClassModel.findOne({ schoolId, name: student.grade }).lean();
  if (!classDoc) return null;

  let sectionDoc = null;
  if (student.section) {
    sectionDoc = await Section.findOne({
      schoolId,
      classId: classDoc._id,
      name: student.section,
    }).lean();
  }

  const baseFilter = {
    schoolId,
    classId: classDoc._id,
  };
  if (sectionDoc) {
    baseFilter.sectionId = sectionDoc._id;
  }

  let allocation = await TeacherAllocation.findOne({
    ...baseFilter,
    isClassTeacher: true,
  })
    .populate('teacherId', 'name email phone')
    .lean();

  if (!allocation) {
    allocation = await TeacherAllocation.findOne(baseFilter)
      .populate('teacherId', 'name email phone')
      .lean();
  }

  return allocation?.teacherId || null;
};

const withTeacherIssuer = ({ achievement, teacherName }) => {
  const rawIssuer = String(achievement?.issuer || '').trim();
  if (!rawIssuer || !teacherName) return achievement;

  // Legacy records may only store "Class Teacher"; append the actual teacher name.
  if (/^class\s*teacher$/i.test(rawIssuer)) {
    return {
      ...achievement,
      issuer: `${teacherName} (Class Teacher)`,
    };
  }

  return achievement;
};

const formatComplaintResponse = (complaint) => {
  if (!complaint) return null;
  const assignedTo =
    complaint.requestDetails?.assignedTo ||
    (complaint.targetRole === 'teacher' ? 'Class Teacher' : 'School Admin');
  return {
    id: complaint._id,
    ticketNumber: complaint.ticketNumber,
    title: complaint.subject || 'Complaint',
    description: complaint.message || '',
    category: complaint.category || 'General',
    priority: complaint.priority || 'low',
    status: complaint.status || 'open',
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
    resolutionNotes: complaint.resolutionNotes || '',
    owner: complaint.owner || assignedTo || 'Support Desk',
    assignedTo,
    targetRole: complaint.targetRole || (assignedTo === 'Class Teacher' ? 'teacher' : 'admin'),
    studentId: complaint.requestDetails?.studentId,
    studentName: complaint.requestDetails?.studentName || '',
    studentGrade: complaint.requestDetails?.studentGrade || '',
    studentSection: complaint.requestDetails?.studentSection || '',
    teacherId: complaint.requestDetails?.teacherId,
    teacherName: complaint.requestDetails?.teacherName || '',
    teacherEmail: complaint.requestDetails?.teacherEmail || '',
    parentName: complaint.requestDetails?.parentName || '',
    lastActivity: complaint.auditTrail && complaint.auditTrail.length > 0 ? complaint.auditTrail[complaint.auditTrail.length - 1].note : '',
  };
};

const getActiveAcademicYear = async (schoolId) => {
  if (!schoolId) return null;
  return AcademicYear.findOne({ schoolId, isActive: true })
    .select('_id name startDate endDate')
    .lean();
};

const buildStudentSchedule = async ({ student, schoolId, campusId, activeYear = null }) => {
  const resolvedGrade = String(student?.grade || '').trim();
  const resolvedSection = String(student?.section || '').trim();

  if (!resolvedGrade) {
    return {
      className: '',
      sectionName: resolvedSection,
      academicYearId: activeYear?._id || null,
      academicYearName: activeYear?.name || '',
      schedule: {},
      hasRoutine: false,
    };
  }

  const classFilter = {
    schoolId,
    name: resolvedGrade,
  };
  if (campusId) {
    classFilter.campusId = campusId;
  }

  let classDoc = null;
  if (activeYear?._id) {
    classDoc = await ClassModel.findOne({
      ...classFilter,
      academicYearId: activeYear._id,
    }).lean();
  }

  if (!classDoc) {
    classDoc = await ClassModel.findOne(classFilter).lean();
  }

  if (!classDoc) {
    classDoc = await ClassModel.findOne({
      ...classFilter,
      name: { $regex: `^${escapeRegex(resolvedGrade)}$`, $options: 'i' },
    }).lean();
  }

  if (!classDoc) {
    return {
      className: resolvedGrade,
      sectionName: resolvedSection,
      academicYearId: activeYear?._id || null,
      academicYearName: activeYear?.name || '',
      schedule: {},
      hasRoutine: false,
    };
  }

  const timetableFilter = {
    schoolId,
    classId: classDoc._id,
  };
  if (campusId) {
    timetableFilter.campusId = campusId;
  }

  // Prefer the active academic year's timetable; fall back to any for older data.
  const loadTimetables = (filter) => Timetable.find(filter)
    .populate('sectionId', 'name')
    .populate('entries.subjectId', 'name')
    .populate('entries.teacherId', 'name')
    .populate({
      path: 'entries.roomId',
      model: Room,
      select: 'roomNumber label buildingId floorId',
      populate: [
        { path: 'buildingId', model: Building, select: 'name code' },
        { path: 'floorId', model: Floor, select: 'name floorCode' },
      ],
    })
    .sort({ updatedAt: -1 })
    .lean();
  let timetables = activeYear?._id
    ? await loadTimetables({ ...timetableFilter, academicYearId: activeYear._id })
    : [];
  if (!timetables.length) timetables = await loadTimetables(timetableFilter);

  if (!Array.isArray(timetables) || timetables.length === 0) {
    return {
      className: classDoc.name,
      sectionName: resolvedSection,
      academicYearId: classDoc.academicYearId || activeYear?._id || null,
      academicYearName: activeYear?.name || '',
      schedule: {},
      hasRoutine: false,
    };
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
    return {
      className: classDoc.name,
      sectionName: timetable?.sectionId?.name || resolvedSection,
      academicYearId: classDoc.academicYearId || activeYear?._id || null,
      academicYearName: activeYear?.name || '',
      schedule: {},
      hasRoutine: false,
    };
  }

  const resolvedSectionName = timetable?.sectionId?.name || resolvedSection || '';
  const scheduleByDay = {};
  timetable.entries.forEach((entry) => {
    if (!entry?.dayOfWeek) return;
    if (!scheduleByDay[entry.dayOfWeek]) {
      scheduleByDay[entry.dayOfWeek] = [];
    }
    scheduleByDay[entry.dayOfWeek].push({
      time: `${entry.startTime || ''}${entry.endTime ? ` - ${entry.endTime}` : ''}`.trim(),
      startTime: entry.startTime || '',
      endTime: entry.endTime || '',
      isBreak: Boolean(entry.isBreak),
      subject: entry.isBreak ? (entry.subjectId?.name || 'Break') : (entry.subjectId?.name || 'Unknown'),
      instructor: entry.teacherId?.name || 'TBA',
      room: entry.room || '',
      // Structured parts for the routine chip (building / floor / room no.).
      ...(() => {
        const r = entry.roomId && typeof entry.roomId === 'object' ? entry.roomId : null;
        return {
          roomBuilding: r?.buildingId?.name || r?.buildingId?.code || '',
          roomFloor: r?.floorId?.name || r?.floorId?.floorCode || '',
          roomNumber: r?.roomNumber || r?.label || entry.room || '',
        };
      })(),
      // "Main Block · 1st Floor · Room 101" from the linked room, if any.
      roomLocation: (() => {
        const r = entry.roomId && typeof entry.roomId === 'object' ? entry.roomId : null;
        if (!r) return entry.room || '';
        const building = r.buildingId?.name || r.buildingId?.code || '';
        const floor = r.floorId?.name || r.floorId?.floorCode || '';
        const number = r.roomNumber || r.label || entry.room || '';
        return [building, floor, number ? `Room ${number}` : ''].filter(Boolean).join(' · ');
      })(),
      period: entry.period,
      className: classDoc.name,
      sectionName: resolvedSectionName,
    });
  });

  Object.keys(scheduleByDay).forEach((day) => {
    scheduleByDay[day].sort((a, b) => (a.period || 0) - (b.period || 0));
  });

  return {
    className: classDoc.name,
    sectionName: resolvedSectionName,
    academicYearId: classDoc.academicYearId || activeYear?._id || null,
    academicYearName: activeYear?.name || '',
    schedule: scheduleByDay,
    hasRoutine: true,
  };
};

// Parent Registration
router.post('/register', adminAuth, async (req, res) => {
  // #swagger.tags = ['Parents']
  const {
    name,
    schoolId,
    mobile,
    email,
    children,
    grade,
  } = req.body;

  try {
    const fallbackUsername = await generateUsername(name, 'parent');
    const password = generatePassword();
    const resolvedSchoolId = req.schoolId || (req.isSuperAdmin ? schoolId : null);
    const resolvedCampusId = req.campusId || (req.isSuperAdmin ? req.body?.campusId : null);
    if (!resolvedSchoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    if (!resolvedCampusId) {
      return res.status(400).json({ error: 'campusId is required' });
    }
    const parentPrefix = resolveParentPrefix({
      adminUsername: req.admin?.username,
      year: new Date().getFullYear(),
    });
    const username = await getNextParentUsername({
      schoolId: resolvedSchoolId,
      campusId: resolvedCampusId,
      prefix: parentPrefix,
    }).catch(() => fallbackUsername);
    const allChild = children.split(',').map(child => child.trim());
    const allGrade = grade.split(',').map(g => g.trim());
    const user = new ParentUser({
      username,
      password,
      schoolId: resolvedSchoolId,
      campusId: resolvedCampusId,
      name,
      mobile,
      email,
      children: allChild,
      grade: allGrade,
    });

    await user.save();
    logAuthEvent(req, {
      action: 'register',
      outcome: 'success',
      userType: 'parent',
      identifier: username,
      userId: user._id,
      schoolId: resolvedSchoolId,
      campusId: resolvedCampusId,
    });
    res.status(201).json({ message: 'Parent registered successfully' });
  } catch (err) {
    logAuthEvent(req, {
      action: 'register',
      outcome: 'failure',
      userType: 'parent',
      identifier: req.body?.email || req.body?.mobile || req.body?.name,
      schoolId: req.schoolId || req.body?.schoolId,
      campusId: req.campusId || req.body?.campusId,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

// Parent Login
router.post('/login', rateLimit({ windowMs: 60 * 1000, max: 20, keyGenerator: rateLimit.loginKeyGenerator, skipSuccessfulRequests: true }), async (req, res) => {
  // #swagger.tags = ['Parents']
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
    const user = await ParentUser.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      logAuthEvent(req, {
        action: 'login',
        outcome: 'failure',
        userType: 'parent',
        identifier: username,
        reason: 'Invalid credentials',
        statusCode: 401,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Every linked child has left the school → the parent ID is blocked.
    if (await isParentLoginBlocked(user.childrenIds)) {
      logAuthEvent(req, {
        action: 'login',
        outcome: 'failure',
        userType: 'parent',
        identifier: username,
        userId: user._id,
        schoolId: user.schoolId,
        reason: 'All linked students have left',
        statusCode: 403,
      });
      return res.status(403).json({ error: PARENT_BLOCKED_MESSAGE, code: 'ACCOUNT_BLOCKED' });
    }
    if (!user.campusId) {
      logAuthEvent(req, {
        action: 'login',
        outcome: 'failure',
        userType: 'parent',
        identifier: username,
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
        userType: 'parent',
        identifier: username,
        userId: user._id,
        schoolId: user.schoolId,
        campusId: user.campusId,
      });
      return res.json({ requiresPasswordReset: true, username: user.username });
    }

    const token = jwt.sign(
      { id: user._id, userType: 'parent', organizationId: user.organizationId || req.organizationId || null, schoolId: user.schoolId || null, campusId: user.campusId || null },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    logAuthEvent(req, {
      action: 'login',
      outcome: 'success',
      userType: 'parent',
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
      userType: 'parent',
      identifier: username,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

router.get('/profile', authParent, async (req, res) => {
  // #swagger.tags = ['Parents']
  try {
    if (req.userType !== 'parent') {
      return res.status(403).json({ error: 'Forbidden - not a parent' });
    }
    const user = await ParentUser.findById(req.user.id).select('-password').lean();
    if (!user) {
      return res.status(404).json({ error: 'Parent not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Read-only child profiles for the parent portal. Only non-sensitive fields —
// no Aadhaar, caste/religion, enrolment documents or credentials.
router.get('/children-profile', authParent, childrenProfileCache.cache, async (req, res) => {
  // #swagger.tags = ['Parents']
  try {
    if (req.userType !== 'parent') {
      return res.status(403).json({ error: 'Forbidden - not a parent' });
    }
    const parent = await ParentUser.findById(req.user.id)
      .select('name email mobile phone username childrenIds schoolId')
      .lean();
    if (!parent) return res.status(404).json({ error: 'Parent not found' });
    const ids = Array.isArray(parent.childrenIds) ? parent.childrenIds : [];
    const students = ids.length
      ? await StudentUser.find({ _id: { $in: ids } })
        .select('schoolId name username profilePic studentCodeadmissionNumber admissionDate grade section roll dob gender bloodGroup academicYear campusName fatherName fatherPhone motherName motherPhone guardianName guardianPhone guardianRelation address status isArchived')
        .lean()
      : [];
    // School cover photo (set by the school admin in Settings) for the
    // parent dashboard banner.
    let coverImage = '';
    const schoolId = parent.schoolId || req.schoolId || students[0]?.schoolId || null;
    if (schoolId) {
      const Admin = require('../models/Admin');
      const admin = await Admin.findOne({ schoolId, role: 'admin', coverImage: { $nin: [null, ''] } })
        .select('coverImage').lean();
      coverImage = admin?.coverImage || '';
    }

    res.json({
      school: { coverImage },
      parent: {
        name: parent.name || '',
        email: parent.email || '',
        phone: parent.mobile || parent.phone || '',
        username: parent.username || '',
      },
      children: students.map((s) => ({
        id: String(s._id),
        name: s.name || '',
        photo: s.profilePic || '',
        studentCode: s.studentCode || s.username || '',
        admissionNumber: s.admissionNumber || '',
        admissionDate: s.admissionDate || null,
        grade: s.grade || '',
        section: s.section || '',
        roll: s.roll ?? '',
        dob: s.dob || null,
        gender: s.gender || '',
        bloodGroup: s.bloodGroup || '',
        academicYear: s.academicYear || '',
        campusName: s.campusName || '',
        address: s.address || '',
        father: { name: s.fatherName || '', phone: s.fatherPhone || '' },
        mother: { name: s.motherName || '', phone: s.motherPhone || '' },
        guardian: { name: s.guardianName || '', phone: s.guardianPhone || '', relation: s.guardianRelation || '' },
        status: s.isArchived ? 'Archived' : (s.status || 'Active'),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load child profile' });
  }
});

// Documents the school uploaded for the parent's own children (enrolment
// documents, student photo, achievement certificates). Every file here was
// uploaded by the school, so the portal shows it as verified.
router.get('/children-documents', authParent, childrenProfileCache.cache, async (req, res) => {
  // #swagger.tags = ['Parents']
  try {
    if (req.userType !== 'parent') {
      return res.status(403).json({ error: 'Forbidden - not a parent' });
    }
    const parent = await ParentUser.findById(req.user.id).select('childrenIds').lean();
    if (!parent) return res.status(404).json({ error: 'Parent not found' });
    const ids = Array.isArray(parent.childrenIds) ? parent.childrenIds : [];
    const students = ids.length
      ? await StudentUser.find({ _id: { $in: ids } })
        .select('profilePic documents achievements createdAt')
        .lean()
      : [];

    const DOC_LABELS = {
      birth_certificate: 'Birth Certificate',
      transfer_certificate: 'Transfer Certificate',
      aadhar_card: 'Aadhaar Card',
    };
    const CATEGORY = {
      birth_certificate: 'identity',
      aadhar_card: 'identity',
      transfer_certificate: 'academic',
    };

    res.json({
      children: students.map((s) => {
        const docs = [];
        if (s.profilePic) {
          docs.push({ name: 'Student Photo', category: 'identity', url: s.profilePic, uploadedAt: s.createdAt || null });
        }
        (Array.isArray(s.documents) ? s.documents : []).forEach((d) => {
          if (!d?.url) return;
          docs.push({
            name: d.label || DOC_LABELS[d.type] || d.fileName || 'Document',
            category: CATEGORY[d.type] || 'other',
            url: d.url,
            fileName: d.fileName || '',
            uploadedAt: d.uploadedAt || null,
          });
        });
        (Array.isArray(s.achievements) ? s.achievements : []).forEach((a) => {
          if (!a?.certificateUrl) return;
          docs.push({ name: `${a.title} Certificate`, category: 'academic', url: a.certificateUrl, uploadedAt: a.date || null });
        });
        return { studentId: String(s._id), documents: docs.map((d) => ({ ...d, verified: true })) };
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load documents' });
  }
});

router.get('/routine', authParent, async (req, res) => {
  // #swagger.tags = ['Parents']
  try {
    if (req.userType !== 'parent') {
      return res.status(403).json({ error: 'Forbidden - not a parent' });
    }

    const parent = await ParentUser.findById(req.user.id)
      .select('schoolId campusId childrenIds children grade')
      .lean();

    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const schoolId = parent.schoolId || req.schoolId || null;
    const campusId = parent.campusId || req.campusId || null;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }

    const activeYear = await getActiveAcademicYear(schoolId);

    const studentFilter = { schoolId };
    if (campusId) {
      studentFilter.campusId = campusId;
    }

    let students = [];
    if (Array.isArray(parent.childrenIds) && parent.childrenIds.length > 0) {
      students = await StudentUser.find({
        ...studentFilter,
        _id: { $in: parent.childrenIds },
      })
        .select('name grade section studentCode roll admissionNumber profilePic')
        .lean();
    }

    if (students.length === 0 && Array.isArray(parent.children) && parent.children.length > 0) {
      const validNames = parent.children.map((name) => String(name || '').trim()).filter(Boolean);
      if (validNames.length > 0) {
        students = await StudentUser.find({
          ...studentFilter,
          name: { $in: validNames },
        })
          .select('name grade section studentCode roll admissionNumber profilePic')
          .lean();
      }
    }

    if (students.length === 0) {
      return res.json({
        children: [],
        meta: { childCount: 0, withRoutine: 0 },
      });
    }

    const childRoutines = [];
    for (const student of students) {
      const routine = await buildStudentSchedule({
        student,
        schoolId,
        campusId,
        activeYear,
      });

      childRoutines.push({
        studentId: student._id,
        studentName: student.name || 'Student',
        photo: student.profilePic || '',
        studentCode: student.studentCode || '',
        username: student.username || '',
        roll: student.roll || null,
        admissionNumber: student.admissionNumber || '',
        grade: student.grade || '',
        section: student.section || '',
        className: routine.className || '',
        sectionName: routine.sectionName || '',
        academicYearId: routine.academicYearId || null,
        academicYearName: routine.academicYearName || '',
        schedule: routine.schedule || {},
        hasRoutine: Boolean(routine.hasRoutine),
      });
    }

    const withRoutine = childRoutines.filter((child) =>
      Object.values(child.schedule || {}).some((entries) => Array.isArray(entries) && entries.length > 0)
    ).length;

    // Letterhead details for the routine PDF.
    const School = require('../models/School');
    const Principal = require('../models/Principal');
    const principalFilter = campusId
      ? { schoolId, $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] }
      : { schoolId };
    const [schoolDoc, principal] = await Promise.all([
      School.findById(schoolId).select('name address logo contactEmail contactPhone officialEmail websiteURL').lean(),
      Principal.findOne(principalFilter).sort({ updatedAt: -1, createdAt: -1 }).select('name').lean(),
    ]);

    res.json({
      children: childRoutines,
      school: {
        name: schoolDoc?.name || '',
        address: schoolDoc?.address || '',
        logo: schoolDoc?.logo?.secure_url || schoolDoc?.logo?.url || (typeof schoolDoc?.logo === 'string' ? schoolDoc.logo : ''),
        email: schoolDoc?.contactEmail || schoolDoc?.officialEmail || '',
        phone: schoolDoc?.contactPhone || '',
        website: schoolDoc?.websiteURL || '',
      },
      principalName: principal?.name || '',
      meta: {
        childCount: childRoutines.length,
        withRoutine,
        activeAcademicYearId: activeYear?._id || null,
        activeAcademicYearName: activeYear?.name || '',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load parent routine' });
  }
});

router.get('/complaints', authParent, async (req, res) => {
  try {
    if (req.userType !== 'parent') {
      return res.status(403).json({ error: 'Forbidden - not a parent' });
    }

    const parent = await ParentUser.findById(req.user.id)
      .select('email schoolId childrenIds children')
      .lean();
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const schoolId = parent.schoolId || req.schoolId || null;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }

    const parentStudents = await fetchParentStudents({ parent, schoolId });
    const parentIdString = String(parent._id);
    const filterOr = [{ 'requestDetails.parentId': parentIdString }];
    if (parent.email) {
      filterOr.push({ contactEmail: parent.email });
    }

    const complaintFilter =
      filterOr.length > 1
        ? { supportType: 'complaint', $or: filterOr }
        : { supportType: 'complaint', ...filterOr[0] };

    const complaints = await SupportRequest.find(complaintFilter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      complaints: complaints.map(formatComplaintResponse),
      children: parentStudents.map((student) => ({
        studentId: student._id,
        name: student.name || 'Student',
        grade: student.grade || '',
        section: student.section || '',
        studentCode: student.studentCode || '',
        username: student.username || '',
        roll: student.roll || '',
        admissionNumber: student.admissionNumber || '',
        profilePic: student.profilePic || '',
      })),
    });
  } catch (err) {
    console.error('Parent complaints fetch error:', err);
    res.status(500).json({ error: err.message || 'Unable to load complaints' });
  }
});

router.post('/complaints', authParent, async (req, res) => {
  try {
    if (req.userType !== 'parent') {
      return res.status(403).json({ error: 'Forbidden - not a parent' });
    }

    const { title, description, category, priority, studentId } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const parent = await ParentUser.findById(req.user.id)
      .select('name email mobile schoolId campusId children childrenIds')
      .lean();

    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const schoolId = parent.schoolId || req.schoolId || null;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }

    const priorityValue = String(priority || '').toLowerCase();
    const normalizedPriority = ['low', 'medium', 'high', 'critical'].includes(priorityValue) ? priorityValue : 'medium';
    const categoryValue = String(category || '').trim().toLowerCase();
    const isTechnical = categoryValue.includes('technical');
    const isAcademic = categoryValue.includes('academic');

    const parentStudents = await fetchParentStudents({ parent, schoolId });
    const studentsMap = new Map(parentStudents.map((student) => [String(student._id), student]));

    let selectedStudent = null;
    if (isAcademic && parentStudents.length > 0) {
      if (studentId && studentsMap.has(String(studentId))) {
        selectedStudent = studentsMap.get(String(studentId));
      } else {
        selectedStudent = parentStudents[0];
      }
    }

    let ownerName = 'School Admin';
    let targetRole = 'admin';
    let targetEmail;
    let targetPhone;
    let requestDetailsExtra = {};

    const ensureAdminContact = async () => {
      if (ensureAdminContact.cached) return ensureAdminContact.cached;
      ensureAdminContact.cached = await Admin.findOne({ schoolId }).select('name email phone').lean();
      return ensureAdminContact.cached;
    };

    if (isAcademic && selectedStudent) {
      const teacher = await findClassTeacherForStudent({ student: selectedStudent, schoolId });
      if (teacher) {
        ownerName = teacher.name || 'Class Teacher';
        targetRole = 'teacher';
        targetEmail = teacher.email || undefined;
        targetPhone = teacher.phone || undefined;
        requestDetailsExtra = {
          assignedTo: 'Class Teacher',
          teacherId: teacher._id,
          teacherName: teacher.name || '',
          teacherEmail: teacher.email || '',
        };
      } else {
        const adminContact = await ensureAdminContact();
        ownerName = adminContact?.name || 'School Admin';
        targetEmail = adminContact?.email || undefined;
        targetPhone = adminContact?.phone || undefined;
        requestDetailsExtra = { assignedTo: 'School Admin' };
      }
    } else if (isTechnical) {
      // App/technical problems go to the platform support team (super admin).
      ownerName = 'Super Admin';
      targetRole = 'superadmin';
      requestDetailsExtra = { assignedTo: 'Super Admin' };
    } else {
      const adminContact = await ensureAdminContact();
      ownerName = adminContact?.name || 'School Admin';
      targetEmail = adminContact?.email || undefined;
      targetPhone = adminContact?.phone || undefined;
      requestDetailsExtra = { assignedTo: 'School Admin' };
    }

    const ticket = await SupportRequest.create({
      ticketNumber: generateTicketNumber(),
      supportType: 'complaint',
      category: category || 'General',
      subject: title.trim(),
      message: description.trim(),
      priority: normalizedPriority,
      status: 'open',
      owner: ownerName,
      schoolId,
      campusType: null,
      targetRole,
      targetEmail,
      contactEmail: parent.email || targetEmail || undefined,
      contactPhone: parent.mobile || targetPhone || undefined,
      createdByName: parent.name || 'Parent User',
      createdByRole: 'parent',
      requestDetails: {
        parentId: String(parent._id),
        parentName: parent.name || '',
        category: category || 'General',
        priority: normalizedPriority,
        studentId: selectedStudent?._id ? String(selectedStudent._id) : undefined,
        studentName: selectedStudent?.name || undefined,
        studentGrade: selectedStudent?.grade || undefined,
        studentSection: selectedStudent?.section || undefined,
        ...requestDetailsExtra,
      },
      auditTrail: [
        {
          status: 'open',
          note: 'Complaint submitted by parent',
          changedByName: parent.name || 'Parent User',
        },
      ],
    });

    notifyComplaintCreated(ticket);
    res.status(201).json(formatComplaintResponse(ticket));
  } catch (err) {
    console.error('Parent complaint creation error:', err);
    res.status(500).json({ error: err.message || 'Unable to submit complaint' });
  }
});

router.post('/reset-first-password', rateLimit({ windowMs: 60 * 1000, max: 20, keyGenerator: rateLimit.loginKeyGenerator, skipSuccessfulRequests: true }), async (req, res) => {
  // #swagger.tags = ['Parents']
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

    const user = await ParentUser.findOne({ username: String(username).trim() });
    if (!user) {
      return res.status(404).json({ error: 'Parent not found' });
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
      userType: 'parent',
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
      userType: 'parent',
      identifier: username,
      reason: err.message,
      statusCode: 400,
    });
    res.status(400).json({ error: err.message });
  }
});

router.get('/achievements', authParent, childrenProfileCache.cache, async (req, res) => {
  try {
    const parent = await ParentUser.findById(req.user.id)
      .select('name schoolId campusId childrenIds children')
      .lean();

    if (!parent) return res.status(404).json({ error: 'Parent not found' });

    const schoolId = parent.schoolId || null;
    const campusId = parent.campusId || null;

    if (!schoolId) {
      console.warn(`[parent-achievements] No schoolId found for parent ${parent._id}`);
      return res.status(400).json({ error: 'School ID not linked to parent profile' });
    }

    const studentFilter = { schoolId };
    if (campusId) studentFilter.campusId = campusId;

    let students = [];
    
    // Strategy 1: Explicit childrenIds
    if (Array.isArray(parent.childrenIds) && parent.childrenIds.length > 0) {
      students = await StudentUser.find({
        ...studentFilter,
        _id: { $in: parent.childrenIds },
      })
        .select('name grade section studentCode roll admissionNumber username profilePic achievements')
        .lean();
    }

    // Strategy 2: Match by name array (if Strategy 1 yielded nothing)
    if (students.length === 0 && Array.isArray(parent.children) && parent.children.length > 0) {
      const validNames = parent.children.map((name) => String(name || '').trim()).filter(Boolean);
      if (validNames.length > 0) {
        students = await StudentUser.find({
          ...studentFilter,
          name: { $in: validNames },
        })
          .select('name grade section studentCode roll admissionNumber username profilePic achievements')
          .lean();
      }
    }

    // Strategy 3: Match by parent name (Fallback)
    if (students.length === 0 && parent.name) {
      students = await StudentUser.find({
        ...studentFilter,
        $or: [
          { fatherName: parent.name },
          { motherName: parent.name },
          { guardianName: parent.name }
        ]
      })
        .select('name grade section studentCode roll admissionNumber username profilePic achievements')
        .lean();
    }

    if (students.length === 0) {
      console.log(`[parent-achievements] No children found for parent ${parent._id} (${parent.name})`);
    }

    const childrenAchievements = await Promise.all(students.map(async (student) => {
      const teacher = await findClassTeacherForStudent({ student, schoolId });
      const teacherName = String(teacher?.name || '').trim();
      const achievements = (Array.isArray(student.achievements) ? student.achievements : [])
        .map((achievement) => withTeacherIssuer({ achievement, teacherName }));

      return {
        studentId: student._id,
        studentName: student.name || 'Student',
        photo: student.profilePic || '',
        studentCode: student.studentCode || '',
        username: student.username || '',
        roll: student.roll || null,
        grade: student.grade || '',
        section: student.section || '',
        classTeacher: teacherName,
        achievements,
      };
    }));

    // School name/logo for the auto-generated certificate (when no file was uploaded).
    const School = require('../models/School');
    const schoolDoc = await School.findById(schoolId).select('name logo').lean();
    const logo = schoolDoc?.logo;
    res.json({
      school: {
        name: schoolDoc?.name || '',
        logo: logo?.secure_url || logo?.url || (typeof logo === 'string' ? logo : ''),
      },
      children: childrenAchievements,
      meta: { childCount: childrenAchievements.length }
    });
  } catch (err) {
    console.error('Fetch parent achievements error:', err);
    res.status(500).json({ error: err.message || 'Unable to load achievements' });
  }
});

// Health & medical record for each linked child (from the enrolment record + wellbeing).
const parseAge = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const diff = Date.now() - birth.getTime();
  const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return age >= 0 && age < 120 ? age : null;
};

router.get('/health', authParent, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const { students } = await resolveParentChildren({
      parentId: req.user.id,
      schoolId,
      campusId: req.campusId,
      select:
        'name grade section roll studentCode username profilePic dob bloodGroup knownHealthIssues allergies '
        + 'immunizationStatus learningDisabilities fatherName fatherPhone motherName motherPhone '
        + 'guardianName guardianPhone guardianRelation',
    });

    // School cover photo (set by the school admin in Settings) for the child card.
    const coverAdmin = schoolId
      ? await Admin.findOne({ schoolId, role: 'admin', coverImage: { $nin: [null, ''] } }).select('coverImage').lean()
      : null;
    const school = { coverImage: coverAdmin?.coverImage || '' };

    if (!students.length) {
      return res.json({ children: [], school });
    }

    const wellbeingByStudent = new Map();
    const wb = await Wellbeing.find({
      schoolId,
      student: { $in: students.map((s) => s._id) },
    }).lean();
    wb.forEach((entry) => wellbeingByStudent.set(String(entry.student), entry));

    const listValue = (value) =>
      String(value || '')
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean);

    const children = students.map((student) => {
      const wellbeing = wellbeingByStudent.get(String(student._id)) || null;
      return {
        studentId: student._id,
        name: student.name || 'Student',
        className: [student.grade, student.section].filter(Boolean).join('-'),
        grade: student.grade || '',
        section: student.section || '',
        profilePic: student.profilePic || '',
        roll: student.roll || null,
        age: parseAge(student.dob),
        bloodGroup: student.bloodGroup || '',
        knownHealthIssues: listValue(student.knownHealthIssues),
        allergies: listValue(student.allergies),
        immunizationStatus: student.immunizationStatus || '',
        learningDisabilities: listValue(student.learningDisabilities),
        emergencyContacts: [
          student.fatherName && { key: 'father', name: student.fatherName, relation: 'Father', phone: student.fatherPhone || '', editable: true },
          student.motherName && { key: 'mother', name: student.motherName, relation: 'Mother', phone: student.motherPhone || '', editable: true },
          student.guardianName && {
            key: 'guardian',
            name: student.guardianName,
            relation: student.guardianRelation || 'Guardian',
            phone: student.guardianPhone || '',
            // The guardian number is the parent's login mobile — school office only.
            editable: false,
          },
        ].filter(Boolean),
        wellbeing: wellbeing
          ? {
              mood: wellbeing.mood,
              academicStress: wellbeing.academicStress,
              socialEngagement: wellbeing.socialEngagement,
              counselingSessions: wellbeing.counselingSessions,
              lastAssessment: wellbeing.lastAssessment,
              notes: wellbeing.notes || '',
            }
          : null,
      };
    });

    res.json({ children, school });
  } catch (err) {
    console.error('Fetch parent health report error:', err);
    res.status(500).json({ error: err.message || 'Unable to load health report' });
  }
});

// PUT /health/:studentId — a parent updates their own child's medical details
// and father/mother emergency contacts. The guardian contact is not editable
// here: guardianPhone doubles as the parent's login mobile and is kept in sync
// with the parent record by the school admin flows.
const HEALTH_LIST_FIELDS = ['allergies', 'knownHealthIssues', 'learningDisabilities'];
const PHONE_RE = /^\+?[0-9\s-]{7,15}$/;
const cleanText = (value, max = 500) => String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max);

router.put('/health/:studentId', authParent, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const { studentId } = req.params;
    const { students } = await resolveParentChildren({
      parentId: req.user.id,
      schoolId,
      campusId: req.campusId,
      select: '_id',
    });
    if (!students.some((st) => String(st._id) === String(studentId))) {
      return res.status(403).json({ error: 'Student is not linked to this parent account' });
    }

    const body = req.body || {};
    const $set = {};
    HEALTH_LIST_FIELDS.forEach((field) => {
      if (body[field] === undefined) return;
      const list = Array.isArray(body[field]) ? body[field] : String(body[field]).split(/[,;\n]/);
      $set[field] = list.map((item) => cleanText(item, 120)).filter(Boolean).slice(0, 30).join(', ');
    });
    if (body.immunizationStatus !== undefined) $set.immunizationStatus = cleanText(body.immunizationStatus, 200);

    const contacts = body.emergencyContacts && typeof body.emergencyContacts === 'object' ? body.emergencyContacts : {};
    for (const key of ['father', 'mother']) {
      const contact = contacts[key];
      if (!contact || typeof contact !== 'object') continue;
      if (contact.name !== undefined) $set[`${key}Name`] = cleanText(contact.name, 100);
      if (contact.phone !== undefined) {
        const phone = cleanText(contact.phone, 20);
        if (phone && !PHONE_RE.test(phone)) {
          return res.status(400).json({ error: `Enter a valid phone number for the ${key}.` });
        }
        $set[`${key}Phone`] = phone;
      }
    }

    if (!Object.keys($set).length) return res.status(400).json({ error: 'Nothing to update' });
    await StudentUser.updateOne({ _id: studentId }, { $set });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Update parent health report error:', err);
    return res.status(500).json({ error: err.message || 'Unable to update health record' });
  }
});

module.exports = router;
