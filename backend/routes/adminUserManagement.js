const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth'); // Protect the route
const StudentUser = require('../models/StudentUser');
const TeacherUser = require('../models/TeacherUser');
const ParentUser = require('../models/ParentUser');
const StaffUser = require('../models/StaffUser');
const Principal = require('../models/Principal');
const Admin = require('../models/Admin');
const School = require('../models/School');
const TeacherLeave = require('../models/TeacherLeave');
const TeacherExpense = require('../models/TeacherExpense');
const TeacherAttendance = require('../models/TeacherAttendance');
const FeeStructure = require('../models/FeeStructure');
const FeeInvoice = require('../models/FeeInvoice');
const AcademicYear = require('../models/AcademicYear');
const ClassModel = require('../models/Class');
const { syncAllocationGroupThreads, syncTimetableGroupThreads } = require('../utils/chatGroupProvisioning');
const { generatePassword } = require('../utils/generator');
const { buildInvoiceSnapshotsForStudent } = require('../utils/feeHeadPolicy');
const { deriveGuardianMeta } = require('../utils/guardianMeta');
const {
  getNextStudentSequence,
  getNextEmployeeSequence,
  getNextTeacherSequence,
  getNextTeacherSequenceByPrefix,
  buildStudentCode,
  buildEmployeeCode,
  buildTeacherCode,
  generateTeacherCode,
  generateTeacherCodeForAdmin,
  getTeacherPrefix,
} = require('../utils/codeGenerator');

const EXITED_STUDENT_STATUSES = ['Leaving', 'Left', 'Expelled', 'leaving', 'left', 'expelled'];
const isExitedStudentStatus = (status) =>
  EXITED_STUDENT_STATUSES.includes(String(status || '').trim());

const parseCsvLine = (line = '') => {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((val) => val.trim());
};

const parseCsv = (csvText = '') => {
  const lines = String(csvText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    return row;
  });
  return { headers, rows };
};

const resolveAdmissionYear = (value) => {
  if (!value) return new Date().getFullYear();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().getFullYear();
  }
  return parsed.getFullYear();
};

const normalizeGender = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'male' || normalized === 'm') return 'male';
  if (normalized === 'female' || normalized === 'f') return 'female';
  if (normalized === 'other' || normalized === 'o') return 'other';
  return normalized;
};

const resolveCampusValue = (req, payloadCampusId) => {
  if (req.campusId) {
    return {
      campusId: req.campusId,
      campusName: req.admin?.campusName || null,
      campusType: req.admin?.campusType || null,
    };
  }
  if (req.isSuperAdmin) {
    return {
      campusId: payloadCampusId || null,
      campusName: req.body?.campusName || null,
      campusType: req.body?.campusType || null,
    };
  }
  return { campusId: null, campusName: null, campusType: null };
};

const resolveAdminUsername = async (req) => {
  if (req.admin?.username) return req.admin.username;
  if (req.admin?.id) {
    const adminUser = await Admin.findById(req.admin.id).select('username').lean();
    return adminUser?.username || '';
  }
  return '';
};

const buildScopedFilter = (req) => {
  const filter = {};
  if (req.schoolId) {
    filter.schoolId = req.schoolId;
  }
  if (req.campusId) {
    filter.$or = [
      { campusId: req.campusId },
      { campusId: { $exists: false } },
      { campusId: null },
    ];
  }
  if (req.isSuperAdmin) {
    if (req.query?.schoolId) {
      filter.schoolId = req.query.schoolId;
    }
    if (req.query?.campusId) {
      filter.campusId = req.query.campusId;
      delete filter.$or;
    }
  }
  return filter;
};

const buildScopedIdFilter = (req, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }
  const filter = buildScopedFilter(req);
  filter._id = id;
  return filter;
};

const TIME_24H_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const isValidTimeLabel = (value) => TIME_24H_RE.test(String(value || '').trim());
const toMinutesOfDay = (value) => {
  const [hours, minutes] = String(value).split(':').map(Number);
  return (hours * 60) + minutes;
};

// Utility to get the right model based on role
const getModelByRole = (role) => {
  switch (role) {
    case 'student': return StudentUser;
    case 'teacher': return TeacherUser;
    case 'parent': return ParentUser;
    case 'staff': return StaffUser;
    case 'principal': return Principal;
    default: return null;
  }
};

const PASSWORD_RESET_ALLOWED_ROLES = new Set(['teacher', 'student', 'parent', 'principal']);

const getPasswordResetModelByRole = (role) => {
  switch (String(role || '').toLowerCase()) {
    case 'teacher':
      return TeacherUser;
    case 'student':
      return StudentUser;
    case 'parent':
      return ParentUser;
    case 'principal':
      return Principal;
    default:
      return null;
  }
};

const getUserIdentifier = (role, user) => {
  if (!user) return '';
  const resolvedRole = String(role || '').toLowerCase();
  if (resolvedRole === 'teacher') return user.employeeCode || user.username || '';
  if (resolvedRole === 'student') return user.studentCode || user.username || '';
  return user.username || '';
};

// Admin creates a user (student/teacher/parent)
router.post('/create-user', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  const { role, username, password, name, mobile, email, city, address, state, pinCode, schoolId } = req.body;

  const Model = getModelByRole(role);
  if (!Model) return res.status(400).json({ error: 'Invalid user role' });

  try {
    const { isStrongPassword, passwordPolicyMessage } = require('../utils/passwordPolicy');
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: passwordPolicyMessage });
    }
    const resolvedSchoolId = req.schoolId || (req.isSuperAdmin ? schoolId : null);
    if (!resolvedSchoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    if (role === 'principal' && !email) {
      return res.status(400).json({ error: 'email is required for principal' });
    }
    const campusContext = resolveCampusValue(req, req.body?.campusId);
    const payload = {
      username,
      password,
      name,
      mobile,
      email,
      city,
      address,
      state,
      pinCode,
      schoolId: resolvedSchoolId,
      campusId: campusContext.campusId,
      campusName: campusContext.campusName,
      campusType: campusContext.campusType,
    };
    if (role === 'student') {
      const admissionYear = resolveAdmissionYear(req.body?.admissionDate);
      const { schoolCode, nextSequence } = await getNextStudentSequence(resolvedSchoolId, admissionYear);
      payload.studentCode = buildStudentCode(schoolCode, admissionYear, nextSequence);
    }
    if (role === 'teacher') {
      const adminUsername =
        req.body?.teacherAdminUsername ||
        req.body?.adminUsername ||
        (await resolveAdminUsername(req));
      payload.employeeCode = await generateTeacherCodeForAdmin(resolvedSchoolId, adminUsername);
      payload.username = payload.employeeCode;
    }
    if (role === 'staff') {
      const { schoolCode, nextSequence } = await getNextEmployeeSequence(resolvedSchoolId);
      payload.employeeCode = buildEmployeeCode(schoolCode, nextSequence);
    }
    const newUser = new Model(payload);
    await newUser.save();
    res.status(201).json({ message: `${role} user created successfully` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk create users for a role (admin only)
router.post('/bulk-create-users', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  const { role, users, schoolId } = req.body || {};
  const Model = getModelByRole(role);
  if (!Model) return res.status(400).json({ error: 'Invalid user role' });
  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: 'users array is required' });
  }

  const resolvedSchoolId = req.schoolId || (req.isSuperAdmin ? schoolId : null);
  if (!resolvedSchoolId) {
    return res.status(400).json({ error: 'schoolId is required' });
  }
  const campusContext = resolveCampusValue(req, req.body?.campusId);

  const results = {
    created: 0,
    failed: 0,
    errors: [],
  };

  const studentSequenceByYear = new Map();
  let employeeSequenceState = null;
  let teacherSequenceState = null;
  if (role === 'staff') {
    employeeSequenceState = await getNextEmployeeSequence(resolvedSchoolId);
  }
  if (role === 'teacher') {
    const adminUsername =
      req.body?.teacherAdminUsername ||
      req.body?.adminUsername ||
      (await resolveAdminUsername(req));
    const teacherPrefix = await getTeacherPrefix({ adminUsername, schoolId: resolvedSchoolId });
    const seqState = await getNextTeacherSequenceByPrefix(resolvedSchoolId, teacherPrefix);
    teacherSequenceState = {
      schoolCode: teacherPrefix,
      nextSequence: seqState.nextSequence,
    };
  }

  for (let i = 0; i < users.length; i += 1) {
    const user = users[i] || {};
    const providedPassword =
      typeof user.password === 'string' ? user.password.trim() : '';
    const resolvedPassword =
      role === 'teacher' && !providedPassword ? generatePassword() : providedPassword;

    if (!resolvedPassword || (!user.username && role !== 'teacher')) {
      results.failed += 1;
      results.errors.push({ index: i, error: 'username and password are required' });
      continue;
    }
    if (role === 'principal' && !user.email) {
      results.failed += 1;
      results.errors.push({ index: i, error: 'email is required for principal' });
      continue;
    }

    try {
      const { isStrongPassword, passwordPolicyMessage } = require('../utils/passwordPolicy');
      if (!isStrongPassword(resolvedPassword)) {
        results.failed += 1;
        results.errors.push({ index: i, error: passwordPolicyMessage });
        continue;
      }
      const payload = {
        ...user,
        password: resolvedPassword,
        gender: normalizeGender(user.gender),
        schoolId: resolvedSchoolId,
        campusId: campusContext.campusId,
        campusName: campusContext.campusName,
        campusType: campusContext.campusType,
      };
      delete payload._id;
      delete payload.id;
      if (role === 'student') {
        const admissionYear = resolveAdmissionYear(user.admissionDate);
        if (!studentSequenceByYear.has(admissionYear)) {
          const sequenceState = await getNextStudentSequence(resolvedSchoolId, admissionYear);
          studentSequenceByYear.set(admissionYear, sequenceState);
        }
        const sequenceState = studentSequenceByYear.get(admissionYear);
        payload.studentCode = buildStudentCode(
          sequenceState.schoolCode,
          admissionYear,
          sequenceState.nextSequence
        );
        sequenceState.nextSequence += 1;
      }
      if (role === 'teacher' && teacherSequenceState) {
        payload.employeeCode = buildTeacherCode(
          teacherSequenceState.schoolCode,
          teacherSequenceState.nextSequence
        );
        teacherSequenceState.nextSequence += 1;
        payload.username = payload.employeeCode;
        payload.initialPassword = resolvedPassword;
      }
      if (role === 'staff' && employeeSequenceState) {
        payload.employeeCode = buildEmployeeCode(
          employeeSequenceState.schoolCode,
          employeeSequenceState.nextSequence
        );
        employeeSequenceState.nextSequence += 1;
      }

      const newUser = new Model(payload);
      await newUser.save();
      results.created += 1;
    } catch (err) {
      results.failed += 1;
      results.errors.push({ index: i, error: err.message });
    }
  }

  res.status(200).json(results);
});

// Bulk import users from CSV (admin only)
router.post('/bulk-import-csv', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  const { role, csv, schoolId } = req.body || {};
  const Model = getModelByRole(role);
  if (!Model) return res.status(400).json({ error: 'Invalid user role' });
  if (!csv || !String(csv).trim()) {
    return res.status(400).json({ error: 'csv is required' });
  }

  const resolvedSchoolId = req.schoolId || (req.isSuperAdmin ? schoolId : null);
  if (!resolvedSchoolId) {
    return res.status(400).json({ error: 'schoolId is required' });
  }
  const campusContext = resolveCampusValue(req, req.body?.campusId);

  const { rows } = parseCsv(csv);
  if (!rows.length) {
    return res.status(400).json({ error: 'No rows found in csv' });
  }

  const results = {
    created: 0,
    failed: 0,
    errors: [],
  };

  const studentSequenceByYear = new Map();
  let employeeSequenceState = null;
  let teacherSequenceState = null;
  if (role === 'staff') {
    employeeSequenceState = await getNextEmployeeSequence(resolvedSchoolId);
  }
  if (role === 'teacher') {
    const adminUsername =
      req.body?.teacherAdminUsername ||
      req.body?.adminUsername ||
      (await resolveAdminUsername(req));
    const teacherPrefix = await getTeacherPrefix({ adminUsername, schoolId: resolvedSchoolId });
    const seqState = await getNextTeacherSequenceByPrefix(resolvedSchoolId, teacherPrefix);
    teacherSequenceState = {
      schoolCode: teacherPrefix,
      nextSequence: seqState.nextSequence,
    };
  }

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || {};
    const providedPassword =
      typeof row.password === 'string' ? row.password.trim() : '';
    const resolvedPassword =
      role === 'teacher' && !providedPassword ? generatePassword() : providedPassword;

    if (!resolvedPassword || (!row.username && role !== 'teacher')) {
      results.failed += 1;
      results.errors.push({ index: i, error: 'username and password are required' });
      continue;
    }
    if (role === 'principal' && !row.email) {
      results.failed += 1;
      results.errors.push({ index: i, error: 'email is required for principal' });
      continue;
    }
    try {
      const { isStrongPassword, passwordPolicyMessage } = require('../utils/passwordPolicy');
      if (!isStrongPassword(resolvedPassword)) {
        results.failed += 1;
        results.errors.push({ index: i, error: passwordPolicyMessage });
        continue;
      }
      const payload = {
        ...row,
        password: resolvedPassword,
        gender: normalizeGender(row.gender),
        schoolId: resolvedSchoolId,
        campusId: campusContext.campusId,
        campusName: campusContext.campusName,
        campusType: campusContext.campusType,
      };
      delete payload._id;
      delete payload.id;
      if (role === 'student') {
        const admissionYear = resolveAdmissionYear(row.admissionDate);
        if (!studentSequenceByYear.has(admissionYear)) {
          const sequenceState = await getNextStudentSequence(resolvedSchoolId, admissionYear);
          studentSequenceByYear.set(admissionYear, sequenceState);
        }
        const sequenceState = studentSequenceByYear.get(admissionYear);
        payload.studentCode = buildStudentCode(
          sequenceState.schoolCode,
          admissionYear,
          sequenceState.nextSequence
        );
        sequenceState.nextSequence += 1;
      }
      if (role === 'teacher' && teacherSequenceState) {
        payload.employeeCode = buildTeacherCode(
          teacherSequenceState.schoolCode,
          teacherSequenceState.nextSequence
        );
        teacherSequenceState.nextSequence += 1;
        payload.username = payload.employeeCode;
        payload.initialPassword = resolvedPassword;
      }
      if (role === 'staff' && employeeSequenceState) {
        payload.employeeCode = buildEmployeeCode(
          employeeSequenceState.schoolCode,
          employeeSequenceState.nextSequence
        );
        employeeSequenceState.nextSequence += 1;
      }
      const newUser = new Model(payload);
      await newUser.save();
      results.created += 1;
    } catch (err) {
      results.failed += 1;
      results.errors.push({ index: i, error: err.message });
    }
  }

  return res.status(200).json(results);
});

// Short-lived in-memory caches for the student / parent directory listings so
// repeat page loads are instant. TTL is deliberately tiny and every student /
// parent mutation in this file clears both maps, so a stale read can only ever
// be a few seconds behind a change made from elsewhere (enrol, bulk import).
const DIRECTORY_LIST_TTL_MS = 15 * 1000;
const studentsListCache = new Map(); // key -> { data, expires }
const parentsListCache = new Map();
const directoryCacheKey = (req) =>
  `${req.schoolId || 'x'}:${req.campusId || 'x'}:${req.isSuperAdmin ? 'super' : 'admin'}`;
const invalidateDirectoryCaches = () => {
  studentsListCache.clear();
  parentsListCache.clear();
};
// Back-compat alias — existing call sites use this name.
const invalidateParentsListCache = invalidateDirectoryCaches;
const PARENTS_LIST_TTL_MS = DIRECTORY_LIST_TTL_MS;

router.get("/get-students", adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const cacheKey = directoryCacheKey(req);
    const cached = studentsListCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return res.status(200).json(cached.data);
    }
    const filter = buildScopedFilter(req);
    filter.isArchived = { $ne: true };
    filter.status = { $nin: EXITED_STUDENT_STATUSES };
    const students = await StudentUser.find(filter).select('-password').lean();
    studentsListCache.set(cacheKey, { data: students, expires: Date.now() + DIRECTORY_LIST_TTL_MS });
    res.status(200).json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/get-teachers", adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const filter = buildScopedFilter(req);
    const teachers = await TeacherUser.find(filter);
    res.status(200).json(teachers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/get-parents", adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const cacheKey = directoryCacheKey(req);
    const cachedEntry = parentsListCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expires > Date.now()) {
      return res.status(200).json(cachedEntry.data);
    }

    const filter = buildScopedFilter(req);
    const schoolId = filter.schoolId || req.schoolId;
    const activeYear = schoolId
      ? await AcademicYear.findOne({ schoolId, isActive: true }).select('name').lean()
      : null;
    const activeYearName = String(activeYear?.name || '').trim().toLowerCase();
    // Class 11/12 stream sections (and any class already tied to an academic
    // year) are the authoritative signal for "is this student in the active
    // year" — the student's own academicYear string field can go stale after
    // a manual grade edit or a promotion that didn't touch it.
    let activeYearClassNames = null;
    let otherYearClassNames = null;
    if (activeYear) {
      const allClasses = await ClassModel.find({ schoolId }).select('name academicYearId').lean();
      activeYearClassNames = new Set();
      otherYearClassNames = new Set();
      allClasses.forEach((c) => {
        const name = String(c.name || '').trim().toLowerCase();
        if (!name) return;
        if (String(c.academicYearId || '') === String(activeYear._id)) {
          activeYearClassNames.add(name);
        } else {
          otherYearClassNames.add(name);
        }
      });
    }
    const parents = await ParentUser.find(filter)
      .select('-password')
      .populate({
        path: 'childrenIds',
        select: 'name grade section performance address pinCode status isArchived academicYear'
          + ' guardianName guardianRelation fatherName fatherOccupation motherName motherOccupation',
      })
      .lean();

    // Backfill relationship / occupation for parents that still carry the old
    // defaults, using whichever linked student names them as guardian. Persist
    // the fix once so it doesn't recompute on every load.
    const guardianBackfills = [];
    const withResolvedAddress = parents
      .map((parent) => {
      const populatedChildren = Array.isArray(parent.childrenIds) ? parent.childrenIds : [];
      const activeChildren = populatedChildren.filter((child) => {
        if (!child || child.isArchived === true || isExitedStudentStatus(child.status)) return false;
        if (!activeYearName) return true;
        const childGrade = String(child.grade || '').trim().toLowerCase();
        if (childGrade && activeYearClassNames.has(childGrade)) return true;
        if (childGrade && otherYearClassNames.has(childGrade)) {
          // Grade maps to a known class from a different year — genuinely stale.
          return false;
        }
        // Grade doesn't match any known class (legacy/free-text value) —
        // fall back to the student's own academicYear string.
        return String(child.academicYear || '').trim().toLowerCase() === activeYearName;
      });
      if (populatedChildren.length > 0 && activeChildren.length === 0) {
        return null;
      }

      const children = activeChildren.length > 0 ? activeChildren : populatedChildren;
      const studentAddress =
        children.find((child) => String(child?.address || '').trim())?.address ||
        (Array.isArray(parent.childrenDetails)
          ? parent.childrenDetails.find((child) => String(child?.address || '').trim())?.address
          : '');

      const childNames = children
        .map((child) => String(child?.name || '').trim())
        .filter(Boolean);
      const childGrades = children
        .map((child) => String(child?.grade || '').trim())
        .filter(Boolean);

      // Relationship / occupation: keep an admin-set value, otherwise derive it
      // from the linked student that names this parent as guardian.
      let relationship = String(parent.relationship || '').trim();
      let occupation = String(parent.occupation || '').trim();
      const needsRelationship = !relationship || relationship === 'Parent';
      if (needsRelationship || !occupation) {
        const source =
          (populatedChildren.length ? populatedChildren : children).find((c) => {
            const gn = String(c?.guardianName || '').trim().toLowerCase();
            const pn = String(parent.name || '').trim().toLowerCase();
            return gn && pn && gn === pn;
          }) || populatedChildren[0] || children[0] || null;
        if (source) {
          const meta = deriveGuardianMeta(source);
          if (needsRelationship && meta.relationship) relationship = meta.relationship;
          if (!occupation && meta.occupation) occupation = meta.occupation;
        }
      }
      if (
        (relationship && relationship !== String(parent.relationship || '').trim()) ||
        (occupation && occupation !== String(parent.occupation || '').trim())
      ) {
        guardianBackfills.push({
          updateOne: {
            filter: { _id: parent._id },
            update: { $set: { relationship: relationship || 'Guardian', occupation } },
          },
        });
      }

      return {
        ...parent,
        relationship: relationship || 'Parent',
        occupation,
        childrenIds: children,
        children: childNames.length > 0 ? childNames : parent.children,
        grade: childGrades.length > 0 ? childGrades : parent.grade,
        address: String(parent.address || '').trim() || String(studentAddress || '').trim() || '',
      };
    })
      .filter(Boolean);

    if (guardianBackfills.length) {
      ParentUser.bulkWrite(guardianBackfills, { ordered: false }).catch((e) =>
        console.error('Parent relationship/occupation backfill failed:', e?.message || e)
      );
    }

    parentsListCache.set(cacheKey, {
      data: withResolvedAddress,
      // If we just wrote backfills, expire fast so the next read reflects them.
      expires: Date.now() + (guardianBackfills.length ? 2000 : PARENTS_LIST_TTL_MS),
    });
    res.status(200).json(withResolvedAddress);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/get-staff", adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const filter = buildScopedFilter(req);
    const staff = await StaffUser.find(filter);
    res.status(200).json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/get-principals", adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const filter = buildScopedFilter(req);
    const principals = await Principal.find(filter);
    res.status(200).json(principals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/password-reset/users', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const role = String(req.query?.role || '').trim().toLowerCase();
    if (!PASSWORD_RESET_ALLOWED_ROLES.has(role)) {
      return res.status(400).json({ error: 'role must be one of teacher, student, parent, principal' });
    }

    const Model = getPasswordResetModelByRole(role);
    const filter = buildScopedFilter(req);
    if (role === 'student') {
      filter.isArchived = { $ne: true };
    }

    const q = String(req.query?.q || '').trim();
    if (q) {
      const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const or = [{ name: pattern }, { username: pattern }];
      if (role === 'teacher') or.push({ employeeCode: pattern });
      if (role === 'student') or.push({ studentCode: pattern });
      filter.$and = [...(filter.$and || []), { $or: or }];
    }

    const users = await Model.find(filter)
      .select('name username employeeCode studentCode')
      .sort({ name: 1, username: 1 })
      .limit(200)
      .lean();

    return res.json({
      users: users.map((user) => ({
        id: user._id,
        name: user.name || 'Unnamed User',
        userId: getUserIdentifier(role, user),
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unable to load users for password reset' });
  }
});

router.post('/password-reset/reset', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const role = String(req.body?.role || '').trim().toLowerCase();
    const userId = String(req.body?.userId || '').trim();

    if (!PASSWORD_RESET_ALLOWED_ROLES.has(role)) {
      return res.status(400).json({ error: 'role must be one of teacher, student, parent, principal' });
    }
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Valid userId is required' });
    }

    const Model = getPasswordResetModelByRole(role);
    const filter = buildScopedIdFilter(req, userId);
    if (!filter) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    if (role === 'student') {
      filter.isArchived = { $ne: true };
    }

    const user = await Model.findOne(filter);
    if (!user) {
      return res.status(404).json({ error: 'User not found for this institution/campus' });
    }

    const temporaryPassword = generatePassword(16);
    user.password = temporaryPassword;
    if (Object.prototype.hasOwnProperty.call(user, 'initialPassword')) {
      // Do not persist the temporary secret in plaintext. It is returned once
      // to the authorized admin and must be changed during first login.
      user.initialPassword = '';
    }
    if (Object.prototype.hasOwnProperty.call(user, 'lastLoginAt')) {
      user.lastLoginAt = null;
    }
    await user.save();
    if (role === 'parent') invalidateParentsListCache();

    return res.json({
      message: 'Password reset successful',
      role,
      userId: user._id,
      name: user.name || 'Unnamed User',
      loginId: getUserIdentifier(role, user),
      password: temporaryPassword,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unable to reset password' });
  }
});

const sanitizeUpdatePayload = (req) => {
  const payload = { ...req.body };
  delete payload._id;
  delete payload.id;
  if (!req.isSuperAdmin) {
    if (req.schoolId) {
      payload.schoolId = req.schoolId;
    }
    if (req.campusId) {
      payload.campusId = req.campusId;
      payload.campusName = req.admin?.campusName || payload.campusName;
      payload.campusType = req.admin?.campusType || payload.campusType;
    }
  }
  return payload;
};

const updateByScope = async (Model, req, res) => {
  const filter = buildScopedIdFilter(req, req.params.id);
  if (!filter) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const payload = sanitizeUpdatePayload(req);
  const updated = await Model.findOneAndUpdate(filter, payload, {
    new: true,
    runValidators: true,
  });
  if (!updated) {
    return res.status(404).json({ error: 'Record not found' });
  }
  return res.json(updated);
};

const deleteByScope = async (Model, req, res) => {
  const filter = buildScopedIdFilter(req, req.params.id);
  if (!filter) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const removed = await Model.findOneAndDelete(filter);
  if (!removed) {
    return res.status(404).json({ error: 'Record not found' });
  }
  return res.json({ message: 'Deleted successfully' });
};

const resolveActiveAcademicYear = async (schoolId) => {
  return AcademicYear.findOne({ schoolId, isActive: true })
    .sort({ createdAt: -1 })
    .lean();
};

const resolveClassForGrade = async ({ schoolId, campusId, grade }) => {
  if (!grade) return null;
  return ClassModel.findOne({
    schoolId,
    ...(campusId ? { campusId } : {}),
    name: { $regex: `^${String(grade).trim()}$`, $options: 'i' },
  })
    .select('_id name')
    .lean();
};

const autoGeneratePromotionInvoice = async ({ student, oldGrade, schoolId }) => {
  const newGrade = String(student?.grade || '').trim();
  if (!newGrade || String(oldGrade || '').trim() === newGrade) {
    return;
  }
  const campusId = student?.campusId || null;
  if (!campusId) {
    return;
  }
  const classDoc = await resolveClassForGrade({ schoolId, campusId, grade: newGrade });
  if (!classDoc) return;
  const activeYear = await resolveActiveAcademicYear(schoolId);
  if (!activeYear) return;

  const structure = await FeeStructure.findOne({
    schoolId,
    classId: classDoc._id,
    academicYearId: activeYear._id,
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .lean();
  if (!structure) return;

  const existing = await FeeInvoice.findOne({
    schoolId,
    studentId: student._id,
    feeStructureId: structure._id,
  })
    .select('_id')
    .lean();
  if (existing) return;

  const hasPriorInvoice = await FeeInvoice.exists({
    schoolId,
    studentId: student._id,
  });
  const snapshots = buildInvoiceSnapshotsForStudent({
    structure,
    hasPriorInvoice: Boolean(hasPriorInvoice),
  });

  await FeeInvoice.create({
    schoolId,
    academicYearId: structure.academicYearId || activeYear._id,
    classId: structure.classId,
    className: student.grade || classDoc.name || structure.className || '',
    section: student.section || '',
    studentId: student._id,
    feeStructureId: structure._id,
    title: structure.name || 'Fee Invoice',
    totalAmount: snapshots.totalAmount,
    paidAmount: 0,
    balanceAmount: snapshots.totalAmount,
    discountAmount: 0,
    discountNote: '',
    feeHeadsSnapshot: snapshots.feeHeadsSnapshot,
    installmentsSnapshot: snapshots.installmentsSnapshot,
    status: 'due',
  });
};

router.put('/teachers/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    await updateByScope(TeacherUser, req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teachers/:id/credentials', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const filter = buildScopedIdFilter(req, req.params.id);
    if (!filter) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const teacher = await TeacherUser.findOne(filter)
      .select('name username employeeCode initialPassword lastLoginAt')
      .lean();
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    return res.json({
      teacherId: teacher._id,
      name: teacher.name || 'Teacher',
      username: teacher.username,
      employeeCode: teacher.employeeCode,
      initialPassword: teacher.initialPassword || '',
      lastLoginAt: teacher.lastLoginAt || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/teachers/:id/credentials', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const filter = buildScopedIdFilter(req, req.params.id);
    if (!filter) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const teacher = await TeacherUser.findOne(filter);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    const password = generatePassword();
    teacher.password = password;
    teacher.initialPassword = password;
    teacher.lastLoginAt = null;
    await teacher.save();
    res.json({
      teacherId: teacher._id,
      name: teacher.name || 'Teacher',
      username: teacher.username,
      employeeCode: teacher.employeeCode,
      password
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teachers/:id/make-principal', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const filter = buildScopedIdFilter(req, req.params.id);
    if (!filter) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const teacher = await TeacherUser.findOne(filter);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    // Check if principal already exists for this teacher's email
    const existingPrincipal = await Principal.findOne({
      $or: [
        { email: teacher.email },
        { username: teacher.email }
      ]
    });

    if (existingPrincipal) {
      return res.status(400).json({ error: 'Principal account already exists for this teacher' });
    }

    // Generate credentials for principal
    const password = generatePassword();
    const principalUsername = teacher.email || `principal_${teacher.employeeCode}`;

    // Create principal account
    const principal = new Principal({
      username: principalUsername.toLowerCase().trim(),
      email: teacher.email || principalUsername.toLowerCase().trim(),
      password,
      initialPassword: password,
      lastLoginAt: null,
      name: teacher.name || 'Principal',
      schoolId: teacher.schoolId,
      campusId: teacher.campusId,
      campusName: teacher.campusName,
      campusType: teacher.campusType,
    });

    await principal.save();

    res.json({
      principalId: principal._id,
      username: principal.username,
      email: principal.email,
      password,
      teacherName: teacher.name
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/teachers/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    await deleteByScope(TeacherUser, req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/students/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const filter = buildScopedIdFilter(req, req.params.id);
    if (!filter) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const existing = await StudentUser.findOne(filter);
    if (!existing) {
      return res.status(404).json({ error: 'Record not found' });
    }
    const oldGrade = existing.grade;
    const oldSection = existing.section;
    const payload = sanitizeUpdatePayload(req);
    const updated = await StudentUser.findOneAndUpdate(filter, payload, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Record not found' });
    }
    const guardianNameChanged =
      Object.prototype.hasOwnProperty.call(payload, 'guardianName') &&
      String(existing.guardianName || '').trim() !== String(updated.guardianName || '').trim();
    const fatherNameChanged =
      Object.prototype.hasOwnProperty.call(payload, 'fatherName') &&
      String(existing.fatherName || '').trim() !== String(updated.fatherName || '').trim();
    const motherNameChanged =
      Object.prototype.hasOwnProperty.call(payload, 'motherName') &&
      String(existing.motherName || '').trim() !== String(updated.motherName || '').trim();
    const guardianPhoneChanged =
      Object.prototype.hasOwnProperty.call(payload, 'guardianPhone') &&
      String(existing.guardianPhone || '').trim() !== String(updated.guardianPhone || '').trim();
    const guardianEmailChanged =
      Object.prototype.hasOwnProperty.call(payload, 'guardianEmail') &&
      String(existing.guardianEmail || '').trim().toLowerCase() !== String(updated.guardianEmail || '').trim().toLowerCase();
    const guardianMetaChanged =
      ['guardianRelation', 'fatherOccupation', 'motherOccupation'].some((k) =>
        Object.prototype.hasOwnProperty.call(payload, k) &&
        String(existing[k] || '').trim() !== String(updated[k] || '').trim());
    if (guardianNameChanged || fatherNameChanged || motherNameChanged || guardianPhoneChanged || guardianEmailChanged || guardianMetaChanged) {
      try {
        // Prefer whichever name field the admin actually just edited (in
        // guardian > father > mother order) rather than a static fallback
        // chain — bulk-imported students often already have guardianName
        // populated from the father's info, so a static fallback would keep
        // showing the stale guardianName even after fatherName is corrected.
        const nextParentName = String(
          (guardianNameChanged && updated.guardianName) ||
            (fatherNameChanged && updated.fatherName) ||
            (motherNameChanged && updated.motherName) ||
            updated.guardianName ||
            updated.fatherName ||
            updated.motherName ||
            ''
        ).trim();
        const parentSet = {};
        if (nextParentName) parentSet.name = nextParentName;
        if (guardianPhoneChanged && String(updated.guardianPhone || '').trim()) {
          parentSet.mobile = String(updated.guardianPhone).trim();
        }
        if (guardianEmailChanged && String(updated.guardianEmail || '').trim()) {
          parentSet.email = String(updated.guardianEmail).trim().toLowerCase();
        }
        // Guardian relationship + matching occupation (Father → father's) —
        // only when the admin actually edited those fields, so a phone-only
        // edit doesn't reset a hand-picked relationship.
        if (guardianMetaChanged) {
          const guardianMeta = deriveGuardianMeta(updated);
          if (guardianMeta.relationship) parentSet.relationship = guardianMeta.relationship;
          if (guardianMeta.occupation) parentSet.occupation = guardianMeta.occupation;
        }
        if (Object.keys(parentSet).length) {
          await ParentUser.updateMany(
            { childrenIds: updated._id },
            { $set: parentSet }
          );
        }
      } catch (syncErr) {
        console.error('Parent sync failed after student update:', syncErr?.message || syncErr);
      }
    }
    try {
      await autoGeneratePromotionInvoice({
        student: updated,
        oldGrade,
        schoolId: updated.schoolId || req.schoolId,
      });
    } catch (err) {
      console.error('Auto invoice failed after promotion:', err.message);
    }
    if (
      String(oldGrade || '').trim() !== String(updated.grade || '').trim() ||
      String(oldSection || '').trim() !== String(updated.section || '').trim()
    ) {
      try {
        await syncTimetableGroupThreads({
          schoolId: updated.schoolId || req.schoolId,
          campusId: (updated.campusId ?? req.campusId) ?? null,
        });
        await syncAllocationGroupThreads({
          schoolId: updated.schoolId || req.schoolId,
          campusId: (updated.campusId ?? req.campusId) ?? null,
        });
      } catch (syncErr) {
        console.error('Student update chat-group sync failed:', syncErr?.message || syncErr);
      }
    }
    invalidateParentsListCache();
    return res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk student delete runs as a background job so a 500-row delete doesn't
//    hold one HTTP request open past the proxy timeout; the client polls
//    /students/bulk/status/:jobId for real per-batch progress. ──
const bulkDeleteJobs = new Map();
const BULK_DELETE_JOB_TTL_MS = 15 * 60 * 1000;
const BULK_DELETE_BATCH = 100;

const runBulkDeleteJob = async (jobId, { studentDocs, campusId }) => {
  const job = bulkDeleteJobs.get(jobId);
  if (!job) return;
  try {
    job.phase = 'students';
    const allIds = studentDocs.map((s) => s._id);

    // 1. Delete the students in batches so progress advances.
    for (let i = 0; i < allIds.length; i += BULK_DELETE_BATCH) {
      const chunk = allIds.slice(i, i + BULK_DELETE_BATCH);
      const r = await StudentUser.deleteMany({ _id: { $in: chunk } });
      job.results.deleted += r?.deletedCount || 0;
      job.processed = Math.min(allIds.length, i + chunk.length);
    }

    // 2. Clean up linked parents in a single pass (was O(n) round trips before).
    job.phase = 'parents';
    const removedIdStrs = new Set(allIds.map(String));
    const removedNames = [...new Set(studentDocs.map((s) => String(s.name || '').trim()).filter(Boolean))];
    const removedGrades = new Set(studentDocs.map((s) => String(s.grade || '').trim()).filter(Boolean));
    const schoolId = studentDocs[0]?.schoolId;

    const parentScope = { schoolId };
    if (campusId) {
      parentScope.$or = [{ campusId }, { campusId: { $exists: false } }, { campusId: null }];
    }
    const linkedParents = await ParentUser.find({
      ...parentScope,
      $or: [
        { childrenIds: { $in: allIds } },
        ...(removedNames.length ? [{ children: { $in: removedNames } }] : []),
      ],
    }).lean();

    const parentOps = [];
    const parentDeleteIds = [];
    for (const parent of linkedParents) {
      const childIds = (parent.childrenIds || []).filter((id) => !removedIdStrs.has(String(id)));
      const children = (parent.children || []).filter((n) => !removedNames.includes(String(n || '').trim()));
      const grade = (parent.grade || []).filter((g) => !removedGrades.has(String(g || '').trim()));
      if (childIds.length === 0 && children.length === 0) {
        parentDeleteIds.push(parent._id);
      } else {
        parentOps.push({ updateOne: { filter: { _id: parent._id }, update: { $set: { childrenIds: childIds, children, grade } } } });
      }
    }
    if (parentOps.length) {
      await ParentUser.bulkWrite(parentOps);
      job.results.updatedParents = parentOps.length;
    }
    if (parentDeleteIds.length) {
      await ParentUser.deleteMany({ _id: { $in: parentDeleteIds } });
      job.results.deletedParents = parentDeleteIds.length;
    }

    job.status = 'completed';
  } catch (err) {
    job.status = 'failed';
    job.error = err.message || 'Bulk delete failed';
  } finally {
    invalidateParentsListCache();
    job.finishedAt = Date.now();
    setTimeout(() => bulkDeleteJobs.delete(jobId), BULK_DELETE_JOB_TTL_MS).unref?.();
  }
};

router.delete('/students/bulk', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
    if (!validIds.length) {
      return res.status(400).json({ error: 'No valid student ids provided' });
    }

    const filter = buildScopedFilter(req);
    filter._id = { $in: validIds };

    const studentDocs = await StudentUser.find(filter).select('name grade schoolId').lean();
    if (!studentDocs.length) {
      return res.status(404).json({ error: 'No matching students found' });
    }

    const jobId = require('crypto').randomUUID();
    bulkDeleteJobs.set(jobId, {
      status: 'processing',
      phase: 'students',
      total: studentDocs.length,
      processed: 0,
      results: { deleted: 0, deletedParents: 0, updatedParents: 0 },
      createdAt: Date.now(),
    });

    runBulkDeleteJob(jobId, { studentDocs, campusId: req.campusId }).catch((err) => {
      const job = bulkDeleteJobs.get(jobId);
      if (job) { job.status = 'failed'; job.error = err.message; job.finishedAt = Date.now(); }
    });

    return res.status(202).json({ jobId, total: studentDocs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/students/bulk/status/:jobId', adminAuth, (req, res) => {
  // #swagger.tags = ['Admin Users']
  const job = bulkDeleteJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found or expired' });
  return res.json({
    status: job.status,
    phase: job.phase,
    total: job.total,
    processed: job.processed,
    deletedCount: job.results.deleted,
    deletedParents: job.results.deletedParents,
    updatedParents: job.results.updatedParents,
    error: job.error || null,
  });
});

router.delete('/students/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const filter = buildScopedIdFilter(req, req.params.id);
    if (!filter) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const removedStudent = await StudentUser.findOneAndDelete(filter).lean();
    if (!removedStudent) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const studentId = String(removedStudent._id);
    const studentName = String(removedStudent.name || '').trim();
    const studentGrade = String(removedStudent.grade || '').trim();

    const parentScope = { schoolId: removedStudent.schoolId };
    if (req.campusId) {
      parentScope.$or = [
        { campusId: req.campusId },
        { campusId: { $exists: false } },
        { campusId: null },
      ];
    }

    const linkedParents = await ParentUser.find({
      ...parentScope,
      $or: [
        { childrenIds: removedStudent._id },
        ...(studentName ? [{ children: studentName }] : []),
      ],
    });

    let deletedParents = 0;
    let updatedParents = 0;

    for (const parent of linkedParents) {
      parent.childrenIds = Array.isArray(parent.childrenIds)
        ? parent.childrenIds.filter((id) => String(id) !== studentId)
        : [];

      if (studentName) {
        parent.children = Array.isArray(parent.children)
          ? parent.children.filter((name) => String(name || '').trim() !== studentName)
          : [];
      }

      if (studentGrade) {
        parent.grade = Array.isArray(parent.grade)
          ? parent.grade.filter((grade) => String(grade || '').trim() !== studentGrade)
          : [];
      }

      const remainingChildIds = Array.isArray(parent.childrenIds) ? parent.childrenIds.length : 0;
      const remainingChildNames = Array.isArray(parent.children) ? parent.children.length : 0;
      if (remainingChildIds === 0 && remainingChildNames === 0) {
        await ParentUser.deleteOne({ _id: parent._id });
        deletedParents += 1;
      } else {
        await parent.save();
        updatedParents += 1;
      }
    }

    invalidateParentsListCache();
    return res.json({
      message: 'Deleted successfully',
      deletedStudentId: removedStudent._id,
      deletedParents,
      updatedParents,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/parents/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const filter = buildScopedIdFilter(req, req.params.id);
    if (!filter) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const existing = await ParentUser.findOne(filter);
    if (!existing) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const payload = sanitizeUpdatePayload(req);
    const updated = await ParentUser.findOneAndUpdate(filter, payload, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Record not found' });
    }

    // Keep every linked student's guardian info in step with the parent record
    // so the same edit shows up on /admin/students too.
    try {
      const childIds = Array.isArray(existing.childrenIds) ? existing.childrenIds : [];
      if (childIds.length) {
        const has = (k) => Object.prototype.hasOwnProperty.call(payload, k);
        const guardianSet = {};
        if (has('name') && String(payload.name || '').trim() !== String(existing.name || '').trim()) {
          guardianSet.guardianName = String(payload.name || '').trim();
        }
        if (has('mobile') && String(payload.mobile || '').trim() !== String(existing.mobile || '').trim()) {
          guardianSet.guardianPhone = String(payload.mobile || '').trim();
        }
        if (has('email') &&
          String(payload.email || '').trim().toLowerCase() !== String(existing.email || '').trim().toLowerCase()) {
          guardianSet.guardianEmail = String(payload.email || '').trim().toLowerCase();
        }
        if (has('relationship') && String(payload.relationship || '').trim() !== String(existing.relationship || '').trim()) {
          guardianSet.guardianRelation = String(payload.relationship || '').trim();
        }
        if (Object.keys(guardianSet).length) {
          await StudentUser.updateMany({ _id: { $in: childIds } }, { $set: guardianSet });
        }
      }
    } catch (syncErr) {
      console.error('Student guardian sync failed after parent update:', syncErr?.message || syncErr);
    }

    invalidateParentsListCache();
    return res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/parents/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    invalidateParentsListCache();
    await deleteByScope(ParentUser, req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/staff/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    await updateByScope(StaffUser, req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/staff/:id/credentials', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const filter = buildScopedIdFilter(req, req.params.id);
    if (!filter) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const staff = await StaffUser.findOne(filter);
    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    const password = generatePassword();
    staff.password = password;
    await staff.save();
    res.json({
      staffId: staff._id,
      username: staff.username,
      employeeCode: staff.employeeCode,
      password,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/staff/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    await deleteByScope(StaffUser, req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/principals/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    await updateByScope(Principal, req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/principals/:id/credentials', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const filter = buildScopedIdFilter(req, req.params.id);
    if (!filter) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const principal = await Principal.findOne(filter);
    if (!principal) {
      return res.status(404).json({ error: 'Principal not found' });
    }

    return res.json({
      principalId: principal._id,
      name: principal.name || 'Principal',
      username: principal.username,
      email: principal.email,
      initialPassword: principal.initialPassword || '',
      lastLoginAt: principal.lastLoginAt || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/principals/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    await deleteByScope(Principal, req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Live dashboard statistics endpoint
router.get("/dashboard-stats", adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const filter = buildScopedFilter(req);

    // Get recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Only count active students — same rule as /admin/users/get-students —
    // so a student who has left/been expelled/been archived doesn't inflate
    // the dashboard total.
    const activeStudentFilter = {
      ...filter,
      isArchived: { $ne: true },
      status: { $nin: EXITED_STUDENT_STATUSES },
    };

    // Parents whose linked children have ALL exited/been archived are excluded
    // here too, so this total matches what /admin/users/get-parents actually
    // lists (a parent with zero children is still counted).
    const parentDocsPromise = ParentUser.find(filter)
      .select('childrenIds createdAt')
      .populate({ path: 'childrenIds', select: 'status isArchived' })
      .lean();

    // Fetch counts from all user types
    const [studentCount, teacherCount, parentDocs, staffCount, principalCount] = await Promise.all([
      StudentUser.countDocuments(activeStudentFilter),
      TeacherUser.countDocuments(filter),
      parentDocsPromise,
      StaffUser.countDocuments(filter),
      Principal.countDocuments(filter)
    ]);

    const activeParentDocs = parentDocs.filter((parent) => {
      const populatedChildren = Array.isArray(parent.childrenIds) ? parent.childrenIds : [];
      const activeChildren = populatedChildren.filter(
        (child) => child && child.isArchived !== true && !isExitedStudentStatus(child.status)
      );
      return !(populatedChildren.length > 0 && activeChildren.length === 0);
    });
    const parentCount = activeParentDocs.length;

    // Calculate additional stats
    const totalUsers = studentCount + teacherCount + parentCount + staffCount + principalCount;

    const [recentStudents, recentTeachers, recentStaff, recentPrincipals] = await Promise.all([
      StudentUser.countDocuments({ ...activeStudentFilter, createdAt: { $gte: thirtyDaysAgo } }),
      TeacherUser.countDocuments({ ...filter, createdAt: { $gte: thirtyDaysAgo } }),
      StaffUser.countDocuments({ ...filter, createdAt: { $gte: thirtyDaysAgo } }),
      Principal.countDocuments({ ...filter, createdAt: { $gte: thirtyDaysAgo } })
    ]);
    const recentParents = activeParentDocs.filter(
      (parent) => parent.createdAt && new Date(parent.createdAt) >= thirtyDaysAgo
    ).length;

    res.status(200).json({
      students: {
        total: studentCount,
        recent: recentStudents
      },
      teachers: {
        total: teacherCount,
        recent: recentTeachers
      },
      parents: {
        total: parentCount,
        recent: recentParents
      },
      staff: {
        total: staffCount,
        recent: recentStaff
      },
      principals: {
        total: principalCount,
        recent: recentPrincipals
      },
      totalUsers,
      recentTotal: recentStudents + recentTeachers + recentParents + recentStaff + recentPrincipals,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teacher-leaves', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const filter = buildScopedFilter(req);
    const query = {};
    if (filter.schoolId) query.schoolId = filter.schoolId;
    if (req.campusId) {
      query.$or = [
        { campusId: req.campusId },
        { campusId: { $exists: false } },
        { campusId: null },
      ];
    }
    if (req.query?.status) query.status = String(req.query.status).trim();
    if (req.query?.teacherId && mongoose.isValidObjectId(req.query.teacherId)) {
      query.teacherId = req.query.teacherId;
    }

    const leaves = await TeacherLeave.find(query).sort({ createdAt: -1 }).lean();
    const teacherIds = [...new Set(
      leaves
        .map((leave) => String(leave.teacherId || '').trim())
        .filter((teacherId) => mongoose.isValidObjectId(teacherId))
    )];
    const teachers = teacherIds.length
      ? await TeacherUser.find({ _id: { $in: teacherIds } }).select('_id email mobile').lean()
      : [];
    const teacherById = new Map(
      teachers.map((teacher) => [String(teacher._id), teacher])
    );
    res.json({
      leaves: leaves.map((leave) => ({
        id: leave._id,
        schoolId: leave.schoolId,
        campusId: leave.campusId || null,
        teacherId: leave.teacherId,
        teacherName: leave.teacherName || '',
        teacherEmail: teacherById.get(String(leave.teacherId))?.email || '',
        teacherPhone: teacherById.get(String(leave.teacherId))?.mobile || '',
        type: leave.type,
        startDate: leave.startDate,
        endDate: leave.endDate,
        reason: leave.reason || '',
        status: leave.status,
        reviewedAt: leave.reviewedAt || null,
        adminNote: leave.adminNote || '',
        createdAt: leave.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load teacher leaves' });
  }
});

router.patch('/teacher-leaves/:id/status', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const { status, adminNote } = req.body || {};
    if (!['Approved', 'Rejected', 'Pending'].includes(String(status || ''))) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid leave request id' });
    }

    const scope = buildScopedFilter(req);
    const query = { _id: req.params.id };
    if (scope.schoolId) query.schoolId = scope.schoolId;
    if (req.campusId) {
      query.$or = [
        { campusId: req.campusId },
        { campusId: { $exists: false } },
        { campusId: null },
      ];
    }

    const updated = await TeacherLeave.findOneAndUpdate(
      query,
      {
        $set: {
          status,
          adminNote: String(adminNote || '').trim(),
          reviewedBy: req.admin?.id || null,
          reviewedAt: new Date(),
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: 'Leave request not found for this school/campus' });
    }

    res.json({
      message: 'Leave status updated',
      leave: {
        id: updated._id,
        teacherId: updated.teacherId,
        teacherName: updated.teacherName || '',
        type: updated.type,
        startDate: updated.startDate,
        endDate: updated.endDate,
        status: updated.status,
        adminNote: updated.adminNote || '',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to update leave status' });
  }
});

router.get('/teacher-expenses', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const filter = buildScopedFilter(req);
    const query = {};
    if (filter.schoolId) query.schoolId = filter.schoolId;
    if (filter.campusId) query.campusId = filter.campusId;
    if (req.query?.status) query.status = String(req.query.status).trim();
    if (req.query?.teacherId && mongoose.isValidObjectId(req.query.teacherId)) {
      query.teacherId = req.query.teacherId;
    }

    const expenses = await TeacherExpense.find(query).sort({ expenseDate: -1, createdAt: -1 }).lean();
    res.json({
      expenses: expenses.map((expense) => ({
        id: expense._id,
        schoolId: expense.schoolId,
        campusId: expense.campusId || null,
        teacherId: expense.teacherId,
        teacherName: expense.teacherName || '',
        category: expense.category,
        amount: expense.amount,
        description: expense.description || '',
        date: expense.expenseDate,
        status: expense.status,
        receiptUrl: expense.receiptUrl || '',
        receiptName: expense.receiptName || '',
        reviewedAt: expense.reviewedAt || null,
        adminNote: expense.adminNote || '',
        createdAt: expense.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load teacher expenses' });
  }
});

router.patch('/teacher-expenses/:id/status', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const { status, adminNote } = req.body || {};
    if (!['Approved', 'Rejected', 'Pending'].includes(String(status || ''))) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid expense id' });
    }

    const scope = buildScopedFilter(req);
    const query = { _id: req.params.id };
    if (scope.schoolId) query.schoolId = scope.schoolId;
    if (req.campusId) {
      query.$or = [
        { campusId: req.campusId },
        { campusId: { $exists: false } },
        { campusId: null },
      ];
    }

    const updated = await TeacherExpense.findOneAndUpdate(
      query,
      {
        $set: {
          status,
          adminNote: String(adminNote || '').trim(),
          reviewedBy: req.admin?.id || null,
          reviewedAt: new Date(),
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: 'Expense not found for this school/campus' });
    }

    res.json({
      message: 'Expense status updated',
      expense: {
        id: updated._id,
        teacherId: updated.teacherId,
        teacherName: updated.teacherName || '',
        category: updated.category,
        amount: updated.amount,
        status: updated.status,
        adminNote: updated.adminNote || '',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to update expense status' });
  }
});

router.get('/teacher-attendance-settings', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const schoolId = req.schoolId || req.query?.schoolId || null;
    if (!schoolId || !mongoose.isValidObjectId(schoolId)) {
      return res.status(400).json({ error: 'Valid schoolId is required' });
    }

    const school = await School.findById(schoolId).select('teacherAttendanceSettings').lean();
    if (!school) return res.status(404).json({ error: 'School not found' });

    const entryTime = school.teacherAttendanceSettings?.entryTime || '09:00';
    const exitTime = school.teacherAttendanceSettings?.exitTime || '17:00';
    const graceMinutes = Number.isFinite(school.teacherAttendanceSettings?.graceMinutes)
      ? school.teacherAttendanceSettings.graceMinutes
      : 0;

    res.json({
      settings: { entryTime, exitTime, graceMinutes },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load teacher attendance settings' });
  }
});

router.get('/teacher-leave-policy', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const schoolId = req.schoolId || req.query?.schoolId || null;
    if (!schoolId || !mongoose.isValidObjectId(schoolId)) {
      return res.status(400).json({ error: 'Valid schoolId is required' });
    }

    const school = await School.findById(schoolId).select('teacherLeaveSettings').lean();
    if (!school) return res.status(404).json({ error: 'School not found' });

    const casualLeaveDays = Number.isFinite(Number(school?.teacherLeaveSettings?.casualLeaveDays))
      ? Number(school.teacherLeaveSettings.casualLeaveDays)
      : 12;

    res.json({
      policy: {
        casualLeaveDays: Math.max(0, Math.min(365, Math.round(casualLeaveDays))),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load teacher leave policy' });
  }
});

router.put('/teacher-leave-policy', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const schoolId = req.schoolId || req.body?.schoolId || null;
    if (!schoolId || !mongoose.isValidObjectId(schoolId)) {
      return res.status(400).json({ error: 'Valid schoolId is required' });
    }

    const casualLeaveDaysRaw = req.body?.casualLeaveDays;
    const casualLeaveDays = Math.max(0, Math.min(365, Math.round(Number(casualLeaveDaysRaw) || 0)));

    const updated = await School.findByIdAndUpdate(
      schoolId,
      { $set: { teacherLeaveSettings: { casualLeaveDays } } },
      { new: true, runValidators: true }
    ).select('teacherLeaveSettings').lean();

    if (!updated) return res.status(404).json({ error: 'School not found' });

    res.json({
      message: 'Teacher leave policy updated',
      policy: {
        casualLeaveDays: Number.isFinite(Number(updated?.teacherLeaveSettings?.casualLeaveDays))
          ? Number(updated.teacherLeaveSettings.casualLeaveDays)
          : casualLeaveDays,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to update teacher leave policy' });
  }
});

router.put('/teacher-attendance-settings', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const schoolId = req.schoolId || req.body?.schoolId || null;
    if (!schoolId || !mongoose.isValidObjectId(schoolId)) {
      return res.status(400).json({ error: 'Valid schoolId is required' });
    }

    const entryTime = String(req.body?.entryTime || '').trim();
    const exitTime = String(req.body?.exitTime || '').trim();
    const graceMinutesRaw = req.body?.graceMinutes;
    if (!isValidTimeLabel(entryTime)) {
      return res.status(400).json({ error: 'entryTime must be in HH:mm format' });
    }
    if (!isValidTimeLabel(exitTime)) {
      return res.status(400).json({ error: 'exitTime must be in HH:mm format' });
    }
    if (toMinutesOfDay(exitTime) <= toMinutesOfDay(entryTime)) {
      return res.status(400).json({ error: 'exitTime must be later than entryTime' });
    }
    const graceMinutes = Math.max(0, Math.min(720, Number(graceMinutesRaw) || 0));

    const updated = await School.findByIdAndUpdate(
      schoolId,
      { $set: { teacherAttendanceSettings: { entryTime, exitTime, graceMinutes } } },
      { new: true, runValidators: true }
    ).select('teacherAttendanceSettings').lean();

    if (!updated) return res.status(404).json({ error: 'School not found' });

    res.json({
      message: 'Teacher attendance settings updated',
      settings: {
        entryTime: updated.teacherAttendanceSettings?.entryTime || entryTime,
        exitTime: updated.teacherAttendanceSettings?.exitTime || exitTime,
        graceMinutes: Number.isFinite(updated.teacherAttendanceSettings?.graceMinutes)
          ? updated.teacherAttendanceSettings.graceMinutes
          : graceMinutes,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to update teacher attendance settings' });
  }
});

router.get('/teacher-attendance', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Users']
  try {
    const scope = buildScopedFilter(req);
    const query = {};
    if (scope.schoolId) query.schoolId = scope.schoolId;
    if (req.campusId) {
      query.$or = [
        { campusId: req.campusId },
        { campusId: { $exists: false } },
        { campusId: null },
      ];
    }
    if (req.query?.teacherId && mongoose.isValidObjectId(req.query.teacherId)) {
      query.teacherId = req.query.teacherId;
    }

    const month = String(req.query?.month || '').trim();
    if (month) {
      const [yearStr, monthStr] = month.split('-');
      const year = Number(yearStr);
      const monthIdx = Number(monthStr) - 1;
      if (Number.isInteger(year) && Number.isInteger(monthIdx) && monthIdx >= 0 && monthIdx <= 11) {
        const from = new Date(year, monthIdx, 1);
        const to = new Date(year, monthIdx + 1, 0);
        const fromKey = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
        const toKey = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
        query.dateKey = { $gte: fromKey, $lte: toKey };
      }
    }

    const records = await TeacherAttendance.find(query).sort({ dateKey: -1, createdAt: -1 }).lean();

    const teacherIds = [...new Set(records.map((r) => String(r.teacherId)).filter(Boolean))];
    const teachers = teacherIds.length > 0
      ? await TeacherUser.find({ _id: { $in: teacherIds } }).select('name').lean()
      : [];
    const teacherNameById = new Map(teachers.map((t) => [String(t._id), t.name || 'Teacher']));

    res.json({
      records: records.map((record) => ({
        id: record._id,
        schoolId: record.schoolId,
        campusId: record.campusId || null,
        teacherId: record.teacherId,
        teacherName: teacherNameById.get(String(record.teacherId)) || 'Teacher',
        date: record.dateKey,
        checkInAt: record.checkInAt || null,
        checkOutAt: record.checkOutAt || null,
        status: record.status || 'Present',
        workingMinutes: record.workingMinutes || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load teacher attendance' });
  }
});

// DPDP Act 2023 — Right to erasure: delete ALL data for a specific student
// Cascades across StudentProgress, MasteryScore, and AI-generated records.
// Admin-only. Logs to AuditLog for compliance trail.
router.delete('/students/:id/all-data', adminAuth, async (req, res) => {
    try {
        const schoolId = req.admin?.schoolId || req.schoolId;
        if (!schoolId) return res.status(400).json({ error: 'schoolId required' });

        const { id: studentId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({ error: 'Invalid studentId' });
        }

        const student = await StudentUser.findOne({ _id: studentId, schoolId }).lean();
        if (!student) return res.status(404).json({ error: 'Student not found in this school' });

        const StudentProgress = require('../models/StudentProgress');
        const MasteryScore = require('../models/MasteryScore');
        const TutorConversation = require('../models/TutorConversation');
        const ReadingAssessment = require('../models/ReadingAssessment');
        const WritingAssessment = require('../models/WritingAssessment');

        const [progress, mastery, convos, reading, writing] = await Promise.all([
            StudentProgress.deleteMany({ studentId }),
            MasteryScore.deleteMany({ studentId }),
            TutorConversation.deleteMany({ studentId }).catch(() => ({ deletedCount: 0 })),
            ReadingAssessment.deleteMany({ studentId }).catch(() => ({ deletedCount: 0 })),
            WritingAssessment.deleteMany({ studentId }).catch(() => ({ deletedCount: 0 })),
        ]);

        // Anonymize PII on StudentUser rather than hard-delete to preserve referential integrity
        await StudentUser.findByIdAndUpdate(studentId, {
            $set: {
                name: '[Deleted]',
                email: null,
                mobile: null,
                address: null,
                aadharNumber: null,
                guardianPhone: null,
                guardianEmail: null,
                fatherPhone: null,
                motherPhone: null,
                profilePic: '',
                isArchived: true,
                archivedAt: new Date(),
                dataRetentionExpiresAt: new Date(),
            },
        });

        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({
            schoolId,
            action: 'student.data_erasure',
            performedBy: req.admin?._id || req.adminId,
            targetId: studentId,
            details: {
                progressDeleted: progress.deletedCount,
                masteryDeleted: mastery.deletedCount,
                conversationsDeleted: convos.deletedCount,
                readingDeleted: reading.deletedCount,
                writingDeleted: writing.deletedCount,
                reason: req.body?.reason || 'Right to erasure request (DPDP Act 2023)',
            },
        }).catch(() => {});

        res.json({
            success: true,
            message: 'Student data erased and PII anonymized',
            deleted: {
                progress: progress.deletedCount,
                mastery: mastery.deletedCount,
                conversations: convos.deletedCount,
                reading: reading.deletedCount,
                writing: writing.deletedCount,
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
