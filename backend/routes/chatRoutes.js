const express = require('express');
const mongoose = require('mongoose');
const authAnyUser = require('../middleware/authAnyUser');
const ChatThread = require('../models/ChatThread');
const ChatMessage = require('../models/ChatMessage');
const StudentUser = require('../models/StudentUser');
const TeacherUser = require('../models/TeacherUser');
const ParentUser = require('../models/ParentUser');
const Principal = require('../models/Principal');
const Timetable = require('../models/Timetable');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const AcademicYear = require('../models/AcademicYear');
const TeacherAllocation = require('../models/TeacherAllocation');
const ChatKey = require('../models/ChatKey');
const { getPresenceSnapshot } = require('../utils/chatPresence');
const { syncAllocationGroupThreads, syncTimetableGroupThreads } = require('../utils/chatGroupProvisioning');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

const router = express.Router();
router.use(authAnyUser);
const GROUP_SYNC_MIN_INTERVAL_MS = 2 * 60 * 1000;
const CHAT_EDIT_WINDOW_MS = Math.max(1000, Number(process.env.CHAT_EDIT_WINDOW_MS || 15 * 60 * 1000));
const groupSyncState = new Map();

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeValue = (value = '') => String(value || '').trim();
const normalizeAcademicYearKey = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
const extractYearTokens = (value = '') =>
  String(value || '').match(/\d{2,4}/g) || [];
const isAcademicYearMatch = (studentAcademicYear, comboAcademicYear) => {
  const comboKey = normalizeAcademicYearKey(comboAcademicYear);
  if (!comboKey) return true;

  const studentKey = normalizeAcademicYearKey(studentAcademicYear);
  // If student profile doesn't carry an academic year, don't block allocation-based access.
  if (!studentKey) return true;
  if (studentKey === comboKey) return true;
  if (studentKey.includes(comboKey) || comboKey.includes(studentKey)) return true;

  const studentTokens = extractYearTokens(studentAcademicYear);
  const comboTokens = extractYearTokens(comboAcademicYear);
  if (studentTokens.length && comboTokens.length) {
    const studentFirst = studentTokens[0];
    const comboFirst = comboTokens[0];
    const studentLast = studentTokens[studentTokens.length - 1];
    const comboLast = comboTokens[comboTokens.length - 1];
    if (studentFirst === comboFirst && studentLast === comboLast) return true;
    // Treat abbreviated academic years such as 2025-26 and 2025-2026 as the
    // same cohort when their starting year and ending-year suffix agree.
    if (
      studentFirst === comboFirst
      && ((studentLast.length === 2 && comboLast.endsWith(studentLast))
        || (comboLast.length === 2 && studentLast.endsWith(comboLast)))
    ) return true;
  }

  return false;
};
const isTeacherRequest = (req) => (req.user?.userType || '').toLowerCase() === 'teacher';
const buildCampusCondition = (campusId) => (
  campusId
    ? {
        $or: [
          { campusId },
          { campusId: { $exists: false } },
          { campusId: null },
        ],
      }
    : null
);

const findTeacherAllocations = async ({ teacherId, schoolId, campusId }) => {
  if (!teacherId || !schoolId) return [];
  let teacherObjectId;
  try {
    teacherObjectId = new mongoose.Types.ObjectId(teacherId);
  } catch {
    return [];
  }

  const allocationFilter = { schoolId, teacherId: teacherObjectId };
  if (campusId) {
    allocationFilter.$or = [
      { campusId },
      { campusId: { $exists: false } },
      { campusId: null },
    ];
  }

  const allocations = await TeacherAllocation.find(allocationFilter)
    .populate('classId', 'name academicYearId')
    .populate('sectionId', 'name')
    .lean();

  const allocationYearIds = Array.from(
    new Set(
      allocations
        .map((alloc) => String(alloc?.classId?.academicYearId || '').trim())
        .filter(Boolean)
    )
  );
  let yearNameById = new Map();
  if (allocationYearIds.length > 0) {
    const yearDocs = await AcademicYear.find({ _id: { $in: allocationYearIds }, schoolId })
      .select('_id name')
      .lean();
    yearNameById = new Map(yearDocs.map((doc) => [String(doc._id), normalizeValue(doc.name)]));
  }

  const combosMap = new Map();
  allocations.forEach((alloc) => {
    const className = normalizeValue(alloc.classId?.name);
    if (!className) return;
    const sectionName = normalizeValue(alloc.sectionId?.name);
    const academicYear = normalizeValue(yearNameById.get(String(alloc?.classId?.academicYearId || '')) || '');
    const key = `${className.toLowerCase()}|${sectionName.toLowerCase()}|${academicYear.toLowerCase()}`;
    combosMap.set(
      key,
      combosMap.get(key) || {
        grade: className,
        section: sectionName || '',
        academicYear,
      }
    );
  });

  const timetableFilter = {
    schoolId,
    'entries.teacherId': teacherObjectId,
  };
  if (campusId) {
    timetableFilter.$or = [
      { campusId },
      { campusId: { $exists: false } },
      { campusId: null },
    ];
  }

  const timetables = await Timetable.find(timetableFilter)
    .select('classId sectionId academicYearId')
    .populate('classId', 'name academicYearId')
    .populate('sectionId', 'name')
    .lean();

  const timetableYearIds = Array.from(
    new Set(
      timetables
        .map((tt) => String(tt?.academicYearId || tt?.classId?.academicYearId || '').trim())
        .filter(Boolean)
    )
  );
  if (timetableYearIds.length > 0) {
    const yearDocs = await AcademicYear.find({ _id: { $in: timetableYearIds }, schoolId })
      .select('_id name')
      .lean();
    yearDocs.forEach((doc) => {
      const id = String(doc._id);
      if (!yearNameById.has(id)) yearNameById.set(id, normalizeValue(doc.name));
    });
  }

  timetables.forEach((tt) => {
    const className = normalizeValue(tt.classId?.name);
    if (!className) return;
    const sectionName = normalizeValue(tt.sectionId?.name);
    const yearId = String(tt?.academicYearId || tt?.classId?.academicYearId || '').trim();
    const academicYear = normalizeValue(yearNameById.get(yearId) || '');
    const key = `${className.toLowerCase()}|${sectionName.toLowerCase()}|${academicYear.toLowerCase()}`;
    if (!combosMap.has(key)) {
      combosMap.set(key, {
        grade: className,
        section: sectionName || '',
        academicYear,
      });
    }
  });

  return Array.from(combosMap.values());
};

const getTeacherCombos = async (req) => {
  if (!isTeacherRequest(req)) return null;
  if (!req._teacherClassCombos) {
    req._teacherClassCombos = await findTeacherAllocations({
      teacherId: req.user?.id || req.user?._id,
      schoolId: req.schoolId || req.user?.schoolId,
      campusId: (req.campusId ?? req.user?.campusId) ?? null,
    });
  }
  return req._teacherClassCombos || [];
};

const fetchParentStudents = async ({ parent, schoolId, campusId }) => {
  if (!parent || !schoolId) return [];
  const filter = { schoolId };
  const campusCondition = buildCampusCondition(campusId);
  if (campusCondition) {
    filter.$or = campusCondition.$or;
  }

  let students = [];
  if (Array.isArray(parent.childrenIds) && parent.childrenIds.length > 0) {
    students = await StudentUser.find({
      ...filter,
      _id: { $in: parent.childrenIds },
    })
      .select('name grade section roll studentCode campusId')
      .lean();
  }

  if ((!students || students.length === 0) && Array.isArray(parent.children) && parent.children.length > 0) {
    const names = parent.children.map((name) => String(name || '').trim()).filter(Boolean);
    if (names.length > 0) {
      students = await StudentUser.find({
        ...filter,
        name: { $in: names },
      })
        .select('name grade section roll studentCode campusId')
        .lean();
    }
  }

  return students || [];
};

const resolveStudentClassContext = async ({ student, schoolId, campusId }) => {
  if (!student || !schoolId) return { classDoc: null, sectionDoc: null, preferredAcademicYearId: null };

  const grade = normalizeValue(student.grade);
  if (!grade) return { classDoc: null, sectionDoc: null, preferredAcademicYearId: null };

  const resolvedCampusId = normalizeValue(campusId || student.campusId);
  const classFilter = {
    schoolId,
    name: { $regex: `^${escapeRegex(grade)}$`, $options: 'i' },
  };
  if (resolvedCampusId) classFilter.campusId = resolvedCampusId;

  const classCandidates = await ClassModel.find(classFilter)
    .sort({ createdAt: -1 })
    .lean();
  if (!classCandidates.length) {
    return { classDoc: null, sectionDoc: null, preferredAcademicYearId: null };
  }

  const candidateYearIds = classCandidates.map((doc) => doc.academicYearId).filter(Boolean);
  const studentYearKey = normalizeValue(student.academicYear).toLowerCase();

  let yearNameById = new Map();
  let activeYearId = null;
  if (candidateYearIds.length) {
    const yearDocs = await AcademicYear.find({
      _id: { $in: candidateYearIds },
      schoolId,
    })
      .select('_id name isActive')
      .lean();
    yearNameById = new Map(
      yearDocs.map((doc) => [String(doc._id), normalizeValue(doc.name).toLowerCase()])
    );
    const activeYearDoc = yearDocs.find((doc) => doc.isActive);
    activeYearId = activeYearDoc?._id ? String(activeYearDoc._id) : null;
  }

  let classDoc = null;
  if (studentYearKey) {
    classDoc = classCandidates.find((doc) =>
      yearNameById.get(String(doc.academicYearId || '')) === studentYearKey
    ) || null;
  }

  if (!classDoc && activeYearId) {
    classDoc = classCandidates.find((doc) => String(doc.academicYearId || '') === activeYearId) || null;
  }

  if (!classDoc) classDoc = classCandidates[0];

  let sectionDoc = null;
  const section = normalizeValue(student.section);
  if (section) {
    const sectionFilter = {
      schoolId,
      classId: classDoc._id,
      name: { $regex: `^${escapeRegex(section)}$`, $options: 'i' },
    };
    if (resolvedCampusId) sectionFilter.campusId = resolvedCampusId;
    sectionDoc = await Section.findOne(sectionFilter).lean();
  }

  const preferredAcademicYearId = classDoc?.academicYearId ? String(classDoc.academicYearId) : activeYearId;

  return { classDoc, sectionDoc, preferredAcademicYearId };
};

const findClassTeacherForStudent = async ({ student, schoolId }) => {
  if (!student || !schoolId) return null;
  const { classDoc, sectionDoc, preferredAcademicYearId } = await resolveStudentClassContext({
    student,
    schoolId,
    campusId: student?.campusId,
  });
  if (!classDoc) return null;

  const baseFilter = {
    schoolId,
    classId: classDoc._id,
    isClassTeacher: true,
  };
  if (sectionDoc) baseFilter.sectionId = sectionDoc._id;

  let allocation = await TeacherAllocation.findOne(baseFilter)
    .populate('teacherId', 'name subject employeeCode profilePic email')
    .lean();

  if (!allocation) {
    allocation = await TeacherAllocation.findOne({
      schoolId,
      classId: classDoc._id,
      ...(sectionDoc ? { sectionId: sectionDoc._id } : {}),
    })
      .populate('teacherId', 'name subject employeeCode profilePic email')
      .lean();
  }

  if (allocation?.teacherId) {
    return allocation.teacherId;
  }

  const timetable = await Timetable.findOne({
    schoolId,
    classId: classDoc._id,
    ...(sectionDoc ? { sectionId: sectionDoc._id } : {}),
    ...(preferredAcademicYearId ? { academicYearId: preferredAcademicYearId } : {}),
  })
    .populate('entries.teacherId', 'name subject employeeCode profilePic email')
    .lean();

  if (timetable?.entries?.length) {
    const entryWithTeacher = timetable.entries.find((entry) => entry.teacherId);
    if (entryWithTeacher?.teacherId) {
      return entryWithTeacher.teacherId;
    }
  }

  return null;
};

const getStudentTeachers = async ({ student, schoolId }) => {
  if (!student || !schoolId) return [];
  const { classDoc, sectionDoc, preferredAcademicYearId } = await resolveStudentClassContext({
    student,
    schoolId,
    campusId: student?.campusId,
  });
  if (!classDoc) return [];

  const timetableFilter = {
    schoolId,
    classId: classDoc._id,
    ...(preferredAcademicYearId ? { academicYearId: preferredAcademicYearId } : {}),
  };
  if (sectionDoc) {
    timetableFilter.sectionId = sectionDoc._id;
  }

  const timetables = await Timetable.find(timetableFilter)
    .populate('entries.teacherId', 'name subject employeeCode profilePic email')
    .populate('entries.subjectId', 'name code')
    .lean();

  const teacherSubjectMap = new Map();
  timetables.forEach((tt) => {
    (tt.entries || []).forEach((entry) => {
      const teacher = entry.teacherId;
      if (!teacher) return;
      const teacherId = String(teacher._id);
      if (!teacherSubjectMap.has(teacherId)) {
        teacherSubjectMap.set(teacherId, {
          teacher,
          subjects: new Set(),
        });
      }
      const subjectName = entry.subjectId?.name || entry.subjectId?.code || '';
      if (subjectName) {
        teacherSubjectMap.get(teacherId).subjects.add(subjectName);
      }
    });
  });

  // Allocations are also an authoritative source of assignment. This keeps
  // chat permissions aligned with the admin/teacher allocation screens even
  // when a timetable row has not been created yet.
  const allocationFilter = {
    schoolId,
    classId: classDoc._id,
    ...(sectionDoc ? { sectionId: sectionDoc._id } : {}),
  };
  const allocationCampus = buildCampusCondition(student?.campusId);
  if (allocationCampus) allocationFilter.$or = allocationCampus.$or;
  const allocations = await TeacherAllocation.find(allocationFilter)
    .populate('teacherId', 'name subject employeeCode profilePic email')
    .populate('subjectId', 'name code')
    .lean();

  allocations.forEach((allocation) => {
    const teacher = allocation.teacherId;
    if (!teacher?._id) return;
    const teacherId = String(teacher._id);
    if (!teacherSubjectMap.has(teacherId)) {
      teacherSubjectMap.set(teacherId, { teacher, subjects: new Set() });
    }
    const subjectName = allocation.subjectId?.name || allocation.subjectId?.code || '';
    if (subjectName) teacherSubjectMap.get(teacherId).subjects.add(subjectName);
  });

  // A class teacher may be configured without a timetable/allocation row.
  const classTeacher = await findClassTeacherForStudent({ student, schoolId });
  if (classTeacher?._id && !teacherSubjectMap.has(String(classTeacher._id))) {
    teacherSubjectMap.set(String(classTeacher._id), {
      teacher: classTeacher,
      subjects: new Set(),
    });
  }

  return Array.from(teacherSubjectMap.values());
};

const getParentTeacherContacts = async ({ parent, schoolId, campusId }) => {
  if (!parent || !schoolId) return new Map();
  const students = await fetchParentStudents({ parent, schoolId, campusId });
  if (!students.length) return new Map();

  const teacherMap = new Map();

  for (const student of students) {
    const classLabel = student.grade
      ? `${student.grade}${student.section ? ` - ${student.section}` : ''}`
      : 'Class Teacher';

    const teachers = await getStudentTeachers({ student, schoolId });
    if (!teachers.length) {
      const classTeacher = await findClassTeacherForStudent({ student, schoolId });
      if (classTeacher) {
        teachers.push({ teacher: classTeacher, subjects: new Set() });
      }
    }

    teachers.forEach(({ teacher, subjects }) => {
      if (!teacher) return;
      const teacherId = String(teacher._id);
      if (!teacherMap.has(teacherId)) {
        teacherMap.set(teacherId, {
          teacher,
          classes: new Set(),
          subjects: new Set(),
        });
      }
      const entry = teacherMap.get(teacherId);
      entry.classes.add(classLabel);
      (subjects ? Array.from(subjects) : []).forEach((subjectName) => entry.subjects.add(subjectName));
    });
  }

  return teacherMap;
};

const buildStudentGradeConditions = (combos = []) =>
  combos
    .map(({ grade, section }) => {
      const gradeValue = normalizeValue(grade);
      if (!gradeValue) return null;
      const condition = {
        grade: new RegExp(`^${escapeRegex(gradeValue)}$`, 'i'),
      };
      const sectionValue = normalizeValue(section);
      if (sectionValue) {
        condition.section = new RegExp(`^${escapeRegex(sectionValue)}$`, 'i');
      }
      return condition;
    })
    .filter(Boolean);

const studentMatchesCombos = (student, combos = []) => {
  const studentGrade = normalizeValue(student?.grade);
  if (!studentGrade) return false;
  const studentSection = normalizeValue(student?.section);
  const studentAcademicYear = normalizeValue(student?.academicYear);
  const studentGradeLower = studentGrade.toLowerCase();

  return combos.some(({ grade, section, academicYear }) => {
    const comboGrade = normalizeValue(grade);
    if (!comboGrade) return false;
    if (studentGradeLower !== comboGrade.toLowerCase()) return false;
    const comboSection = normalizeValue(section);
    const sectionMatches = !comboSection || (studentSection && studentSection.toLowerCase() === comboSection.toLowerCase());
    if (!sectionMatches) return false;
    return isAcademicYearMatch(studentAcademicYear, academicYear);
  });
};

const studentsShareChatCohort = (left, right) => {
  const leftGrade = normalizeValue(left?.grade).toLowerCase();
  const rightGrade = normalizeValue(right?.grade).toLowerCase();
  const leftSection = normalizeValue(left?.section).toLowerCase();
  const rightSection = normalizeValue(right?.section).toLowerCase();
  if (!leftGrade || !rightGrade || leftGrade !== rightGrade) return false;
  // Section is part of the boundary; do not fall back to grade-only access.
  if (!leftSection || !rightSection || leftSection !== rightSection) return false;
  const leftYear = normalizeValue(left?.academicYear);
  const rightYear = normalizeValue(right?.academicYear);
  return !leftYear || !rightYear || isAcademicYearMatch(leftYear, rightYear);
};

const getChatStudent = async ({ userId, schoolId, campusId }) => {
  if (!userId || !schoolId) return null;
  return StudentUser.findOne({
    _id: userId,
    schoolId,
    ...(campusId ? { campusId } : {}),
  })
    .select('_id grade section campusId academicYear name username studentCode profilePic')
    .lean();
};

const ensureStudentCanAccessStudent = async ({ student, targetStudent, campusId }) => {
  if (!studentsShareChatCohort(student, targetStudent)) return false;
  const requestedCampusId = campusId ? String(campusId) : '';
  const targetCampusId = targetStudent?.campusId ? String(targetStudent.campusId) : '';
  return !requestedCampusId || !targetCampusId || requestedCampusId === targetCampusId;
};

const ensureStudentCanAccessTeacher = async ({ student, teacherId, schoolId }) => {
  if (!student || !teacherId || !schoolId) return false;
  const teachers = await getStudentTeachers({ student, schoolId });
  return teachers.some(({ teacher }) => String(teacher?._id || '') === String(teacherId));
};

const ensureStudentAccessToThread = async (context, thread) => {
  const user = context?.user || context;
  if (String(user?.userType || '').toLowerCase() !== 'student') return true;
  if (!thread) return false;
  if (String(thread.threadType || '').toLowerCase() === 'group') return true;

  const schoolId = context?.schoolId || user?.schoolId;
  const campusId = context?.campusId ?? user?.campusId ?? null;
  const student = await getChatStudent({ userId: user?.id || user?._id, schoolId, campusId });
  const myId = String(user?.id || user?._id || '');
  const other = thread.participants?.find((participant) => String(participant?.userId || '') !== myId);
  if (!student || !other) return false;

  if (String(other.userType || '').toLowerCase() === 'student') {
    const target = await getChatStudent({ userId: other.userId, schoolId, campusId: null });
    return ensureStudentCanAccessStudent({ student, targetStudent: target, campusId });
  }
  if (String(other.userType || '').toLowerCase() === 'teacher') {
    return ensureStudentCanAccessTeacher({ student, teacherId: other.userId, schoolId });
  }
  return false;
};

const ensureChatAccessToThread = async (context, thread) => {
  const user = context?.user || context;
  const userType = String(user?.userType || '').toLowerCase();
  if (userType === 'student') return ensureStudentAccessToThread(context, thread);
  if (userType === 'teacher') return ensureTeacherAccessToThread(context, thread);
  return true;
};

const ensureTeacherCanAccessStudent = async (req, studentOrId) => {
  if (!isTeacherRequest(req)) return true;
  const combos = await getTeacherCombos(req);
  if (!combos?.length) return false;

  let studentDoc = studentOrId;
  if (!studentDoc || !studentDoc.grade) {
    const studentId = studentOrId?._id || studentOrId;
    if (!studentId) return false;
    studentDoc = await StudentUser.findById(studentId)
      .select('_id grade section campusId academicYear')
      .lean();
  }
  if (!studentDoc) return false;

  const campusId = (req.campusId ?? req.user?.campusId) ?? null;
  const requestedCampusId = campusId ? String(campusId) : '';
  const studentCampusId = studentDoc?.campusId ? String(studentDoc.campusId) : '';
  if (requestedCampusId && studentCampusId && studentCampusId !== requestedCampusId) {
    return false;
  }

  return studentMatchesCombos(studentDoc, combos);
};

const ensureTeacherAccessToThread = async (req, thread) => {
  if (!isTeacherRequest(req)) return true;
  if (!thread) return false;
  const myId = String(req.user?.id || req.user?._id || '');
  const other = thread.participants?.find(
    (p) => p.userId?.toString() !== myId
  );
  if (!other || other.userType !== 'student') return true;
  return ensureTeacherCanAccessStudent(req, other.userId);
};

const ensureTeacherCanAccessParent = async (req, parent) => {
  if (!isTeacherRequest(req)) return true;
  if (!parent) return false;
  const schoolId = req.schoolId || req.user?.schoolId;
  const campusId = (req.campusId ?? req.user?.campusId) ?? null;
  const combos = await getTeacherCombos(req);
  if (!combos?.length) return false;
  const students = await fetchParentStudents({ parent, schoolId, campusId });
  if (!students.length) return false;
  return students.some((student) => studentMatchesCombos(student, combos));
};

const emitChatMessageEvents = (io, { threadId, thread, message, senderId }) => {
  if (!io || !threadId || !thread || !message) return;
  const payload = typeof message.toObject === 'function' ? message.toObject() : message;

  io.to(`thread:${threadId}`).emit('new-message', payload);
  io.to(`user:${String(senderId)}`).emit('message-sent', payload);

  for (const participant of thread.participants || []) {
    const participantId = String(participant?.userId || '');
    if (!participantId || participantId === String(senderId || '')) continue;
    io.to(`user:${participantId}`).emit('thread-updated', {
      threadId,
      lastMessage: payload?.text || '[Encrypted message]',
      lastMessageAt: payload?.createdAt || new Date().toISOString(),
      message: payload,
    });
  }
};

const markThreadMessagesSeen = async ({ threadId, schoolId, campusId, userId }) => {
  if (!threadId || !schoolId || !userId) return;
  const seenEntry = { userId, seenAt: new Date() };
  await ChatMessage.updateMany(
    {
      threadId,
      schoolId,
      ...(campusId !== null && campusId !== undefined ? { campusId } : {}),
      senderId: { $ne: userId },
      'seenBy.userId': { $ne: userId },
    },
    {
      $push: { seenBy: seenEntry },
    }
  );
};

const getGroupSyncScopeKey = ({ schoolId, campusId }) => `${String(schoolId || '')}:${String(campusId || 'default')}`;

const ensureUserSubjectGroups = async (req, options = {}) => {
  const { wait = true, force = false } = options;
  const userType = String(req.user?.userType || '').toLowerCase();
  if (userType !== 'teacher' && userType !== 'student') return;

  const schoolId = req.schoolId || req.user?.schoolId;
  const campusId = (req.campusId ?? req.user?.campusId) ?? null;
  if (!schoolId) return;
  const scopeKey = getGroupSyncScopeKey({ schoolId, campusId });
  const now = Date.now();
  const state = groupSyncState.get(scopeKey) || { lastRunAt: 0, inFlight: null };
  const shouldRun = force || !state.lastRunAt || now - state.lastRunAt >= GROUP_SYNC_MIN_INTERVAL_MS;

  if (shouldRun && !state.inFlight) {
    const inFlight = (async () => {
      await syncTimetableGroupThreads({ schoolId, campusId });
      await syncAllocationGroupThreads({ schoolId, campusId });
    })()
      .catch(() => {})
      .finally(() => {
        const current = groupSyncState.get(scopeKey) || {};
        groupSyncState.set(scopeKey, { ...current, inFlight: null, lastRunAt: Date.now() });
      });
    groupSyncState.set(scopeKey, { ...state, inFlight });
  }

  if (wait) {
    const current = groupSyncState.get(scopeKey);
    if (current?.inFlight) await current.inFlight;
  }
};

// GET /api/chat/me — current user's display info
router.get('/me', async (req, res) => {
  try {
    const { id, userType, schoolId, campusId } = req.user;
    let name = '';
    let avatar = null;
    if (userType === 'student') {
      const u = await StudentUser.findById(id).select('name username studentCode profilePic').lean();
      name = u?.name || u?.username || u?.studentCode || 'Student';
      avatar = u?.profilePic || null;
    } else if (userType === 'teacher') {
      const u = await TeacherUser.findById(id).select('name employeeCode profilePic').lean();
      name = u?.name || u?.employeeCode || 'Teacher';
      avatar = u?.profilePic || null;
    } else if (userType === 'parent') {
      const u = await ParentUser.findById(id).select('name username profilePic').lean();
      name = u?.name || u?.username || 'Parent';
      avatar = u?.profilePic || null;
    } else if (userType === 'principal') {
      const u = await Principal.findById(id).select('name').lean();
      name = u?.name || 'Principal';
      avatar = null;
    }
    res.json({ id, userType, name, avatar, schoolId, campusId });
    logStudentPortalEvent(req, {
      feature: 'chat',
      action: 'me.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: id,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'chat',
      action: 'me.fetch',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/keys/me — current user's registered public key
router.get('/keys/me', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const userType = String(req.user.userType || '').toLowerCase();
    const keyDoc = await ChatKey.findOne({ userId, userType }).select('publicKey privateKey updatedAt').lean();
    res.json({
      publicKey: keyDoc?.publicKey || '',
      privateKey: keyDoc?.privateKey || '',
      updatedAt: keyDoc?.updatedAt || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/chat/keys/me — register/update current user's public key
router.put('/keys/me', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const userType = String(req.user.userType || '').toLowerCase();
    const publicKey = String(req.body?.publicKey || '').trim();
    const privateKey = String(req.body?.privateKey || '').trim();
    if (!publicKey) {
      return res.status(400).json({ error: 'publicKey is required' });
    }
    const updateDoc = { publicKey };
    if (privateKey) updateDoc.privateKey = privateKey;
    const saved = await ChatKey.findOneAndUpdate(
      { userId, userType },
      { $set: updateDoc },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).select('publicKey privateKey updatedAt');
    res.json({
      publicKey: saved.publicKey,
      privateKey: saved.privateKey || '',
      updatedAt: saved.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/threads/:threadId/keys — fetch participant public keys for E2EE
router.get('/threads/:threadId/keys', async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const schoolId = req.schoolId || req.user?.schoolId;
    const campusId = (req.campusId ?? req.user?.campusId) ?? null;
    const thread = await ChatThread.findOne({
      _id: threadId,
      schoolId,
      ...(campusId !== null ? { campusId } : {}),
      'participants.userId': userId,
    }).lean();
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const allowed = await ensureChatAccessToThread(req, thread);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    const participantIds = (thread.participants || []).map((p) => p.userId).filter(Boolean);
    const participantTypes = (thread.participants || []).map((p) => String(p.userType || '').toLowerCase());
    const keys = await ChatKey.find({ userId: { $in: participantIds } })
      .select('userId userType publicKey')
      .lean();
    const keyMap = {};
    keys.forEach((entry) => {
      keyMap[String(entry.userId)] = {
        userType: entry.userType,
        publicKey: entry.publicKey,
      };
    });
    // include participants without key to let client decide fallback
    thread.participants.forEach((p, idx) => {
      const id = String(p.userId);
      if (!keyMap[id]) {
        keyMap[id] = { userType: participantTypes[idx] || String(p.userType || '').toLowerCase(), publicKey: '' };
      }
    });
    res.json({ threadId: String(thread._id), keys: keyMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/students/:studentId/profile — student profile for teacher chat modal
router.get('/students/:studentId/profile', async (req, res) => {
  try {
    const requesterType = String(req.user?.userType || '').toLowerCase();
    if (requesterType !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can view student profile here' });
    }

    const { studentId } = req.params;
    if (!mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const schoolId = req.schoolId || req.user?.schoolId;
    const campusId = (req.campusId ?? req.user?.campusId) ?? null;
    const student = await StudentUser.findOne({
      _id: studentId,
      schoolId,
      ...(campusId ? { campusId } : {}),
    })
      .select('name grade section roll studentCode fatherName motherName guardianName')
      .lean();

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const allowed = await ensureTeacherCanAccessStudent(req, student);
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let parentName = student.fatherName || student.motherName || student.guardianName || '';
    if (!parentName) {
      const parentFilter = {
        schoolId,
        $or: [{ childrenIds: student._id }, { children: student.name }],
      };
      const campusCondition = buildCampusCondition(campusId);
      if (campusCondition) {
        parentFilter.$and = [campusCondition];
      }
      const parent = await ParentUser.findOne(parentFilter).select('name').lean();
      parentName = parent?.name || '';
    }

    res.json({
      id: String(student._id),
      studentName: student.name || 'Student',
      parentName: parentName || 'N/A',
      className: student.grade || 'N/A',
      section: student.section || 'N/A',
      rollNumber:
        student.roll !== undefined && student.roll !== null
          ? String(student.roll)
          : (student.studentCode || 'N/A'),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/parents/:parentId/profile — parent + linked student data for teacher chat modal
router.get('/parents/:parentId/profile', async (req, res) => {
  try {
    const requesterType = String(req.user?.userType || '').toLowerCase();
    if (requesterType !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can view parent profile here' });
    }

    const { parentId } = req.params;
    if (!mongoose.isValidObjectId(parentId)) {
      return res.status(400).json({ error: 'Invalid parent id' });
    }

    const schoolId = req.schoolId || req.user?.schoolId;
    const campusId = (req.campusId ?? req.user?.campusId) ?? null;
    const parent = await ParentUser.findOne({
      _id: parentId,
      schoolId,
      ...(campusId ? { campusId } : {}),
    })
      .select('name childrenIds children schoolId campusId')
      .lean();

    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const allowed = await ensureTeacherCanAccessParent(req, parent);
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const linkedStudents = await fetchParentStudents({ parent, schoolId, campusId });
    const normalizedStudents = (linkedStudents || []).map((student) => ({
      id: String(student._id),
      studentName: student.name || 'Student',
      className: student.grade || 'N/A',
      section: student.section || 'N/A',
      rollNumber:
        student.roll !== undefined && student.roll !== null
          ? String(student.roll)
          : (student.studentCode || 'N/A'),
    }));

    res.json({
      id: String(parent._id),
      parentName: parent.name || 'Parent',
      students: normalizedStudents,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/contacts — list people you can message
// Students see same-section classmates and assigned teachers; teachers see assigned students.
router.get('/contacts', async (req, res) => {
  try {
    const { userType } = req.user;
    const schoolId = req.schoolId || req.user?.schoolId;
    const campusId = (req.campusId ?? req.user?.campusId) ?? null;

    if (userType === 'student') {
      const student = await StudentUser.findOne({
        _id: req.user.id,
        schoolId,
        ...(campusId ? { campusId } : {}),
      })
        .select('_id grade section campusId academicYear')
        .lean();

      if (!student) return res.json([]);

      const teacherMap = new Map();
      const allocatedTeachers = await getStudentTeachers({ student, schoolId });

      (allocatedTeachers || []).forEach(({ teacher, subjects }) => {
        if (!teacher?._id) return;
        const teacherId = String(teacher._id);
        if (!teacherMap.has(teacherId)) {
          teacherMap.set(teacherId, {
            teacher,
            subjects: new Set(),
          });
        }
        const entry = teacherMap.get(teacherId);
        (subjects ? Array.from(subjects) : []).forEach((subjectName) => {
          if (subjectName) entry.subjects.add(subjectName);
        });
      });

      if (teacherMap.size === 0) {
        const classTeacher = await findClassTeacherForStudent({ student, schoolId });
        if (classTeacher?._id) {
          teacherMap.set(String(classTeacher._id), {
            teacher: classTeacher,
            subjects: new Set(),
          });
        }
      }

      const classLabel = student.grade
        ? `Class ${student.grade}${student.section ? ` - ${student.section}` : ''}`
        : 'Allocated teacher';

      const teacherContacts = Array.from(teacherMap.values()).map(({ teacher, subjects }) => ({
        _id: teacher._id,
        name: teacher.name || teacher.employeeCode || 'Teacher',
        subtitle: subjects.size ? Array.from(subjects).join(', ') : classLabel,
        userType: 'teacher',
        avatar: teacher.profilePic || null,
      }));

      const classmateFilter = {
        schoolId,
        _id: { $ne: student._id },
        grade: { $regex: `^${escapeRegex(student.grade || '')}$`, $options: 'i' },
      };
      if (student.section) {
        classmateFilter.section = { $regex: `^${escapeRegex(student.section)}$`, $options: 'i' };
      }
      const classmateCampus = buildCampusCondition(campusId);
      if (classmateCampus) classmateFilter.$or = classmateCampus.$or;
      const classmates = await StudentUser.find(classmateFilter)
        .select('_id name username studentCode profilePic grade section campusId academicYear')
        .lean();
      const classmateContacts = classmates
        .filter((classmate) => studentsShareChatCohort(student, classmate))
        .map((classmate) => ({
          _id: classmate._id,
          name: classmate.name || classmate.username || classmate.studentCode || 'Student',
          subtitle: classLabel,
          userType: 'student',
          avatar: classmate.profilePic || null,
        }));

      return res.json([...teacherContacts, ...classmateContacts]);
    }

    if (userType === 'parent') {
      const parent = await ParentUser.findById(req.user.id)
        .select('childrenIds children schoolId campusId')
        .lean();
      if (!parent) return res.status(404).json({ error: 'Parent account not found' });
      const resolvedSchoolId = parent.schoolId || schoolId;
      if (!resolvedSchoolId) {
        return res.status(400).json({ error: 'schoolId is required' });
      }
      const teacherMap = await getParentTeacherContacts({
        parent,
        schoolId: resolvedSchoolId,
        campusId: campusId || parent.campusId || null,
      });
      const contacts = Array.from(teacherMap.values()).map(({ teacher, classes, subjects }) => ({
        _id: teacher._id,
        name: teacher.name || teacher.employeeCode || 'Teacher',
        subtitle: classes.size
          ? `Class ${Array.from(classes).join(', ')}`
          : teacher.subject || 'Teacher',
        detail: subjects && subjects.size ? `Subjects: ${Array.from(subjects).join(', ')}` : '',
        userType: 'teacher',
        avatar: teacher.profilePic || null,
      }));
      return res.json(contacts);
    }

    if (userType === 'principal') {
      if (!schoolId) {
        return res.status(400).json({ error: 'schoolId is required' });
      }
      const teacherFilter = { schoolId };
      if (campusId) {
        teacherFilter.$or = [
          { campusId },
          { campusId: { $exists: false } },
          { campusId: null },
        ];
      }
      const teachers = await TeacherUser.find(teacherFilter)
        .select('_id name subject employeeCode profilePic department email mobile')
        .lean();
      return res.json(teachers.map((t) => ({
        _id: t._id,
        name: t.name || t.employeeCode || 'Teacher',
        subtitle: t.subject || t.department || 'Teacher',
        detail: t.department ? `Department: ${t.department}` : '',
        userType: 'teacher',
        avatar: t.profilePic || null,
        email: t.email || '',
        phone: t.mobile || '',
      })));
    }

    if (userType === 'teacher') {
      const combos = await getTeacherCombos(req);
      if (!combos?.length) {
        return res.json([]);
      }
      const gradeConditions = buildStudentGradeConditions(combos);
      if (!gradeConditions.length) {
        return res.json([]);
      }

      const andConditions = [{ $or: gradeConditions }];
      if (campusId) {
        andConditions.push({
          $or: [
            { campusId },
            { campusId: { $exists: false } },
            { campusId: null },
          ],
        });
      }

      const filter = { schoolId };
      if (andConditions.length === 1) Object.assign(filter, andConditions[0]);
      else filter.$and = andConditions;

      const students = await StudentUser.find(filter)
        .select('_id name username studentCode profilePic grade section campusId academicYear')
        .lean();

      const filteredStudents = students.filter((student) => studentMatchesCombos(student, combos));
      const items = filteredStudents.map(s => ({
        _id: s._id,
        name: s.name || s.username || s.studentCode || 'Student',
        subtitle: s.grade ? `Grade ${s.grade}${s.section ? ' - ' + s.section : ''}` : 'Student',
        userType: 'student',
        avatar: s.profilePic || null,
      }));
      logStudentPortalEvent(req, {
        feature: 'chat',
        action: 'contacts.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'student',
        targetId: req.user?.id,
        resultCount: items.length,
      });
      return res.json(items);
    }

    logStudentPortalEvent(req, {
      feature: 'chat',
      action: 'contacts.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      resultCount: 0,
    });
    res.json([]);
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'chat',
      action: 'contacts.fetch',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/threads — list all threads for current user
router.get('/threads', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const schoolId = req.schoolId || req.user?.schoolId;
    const campusId = (req.campusId ?? req.user?.campusId) ?? null;
    const userType = String(req.user?.userType || '').toLowerCase();

    try {
      await ensureUserSubjectGroups(req, { wait: false });
    } catch {
      // best effort self-heal if groups were deleted manually/out of sync
      if ((userType === 'teacher' || userType === 'student') && schoolId) {
        try {
          await ensureUserSubjectGroups(req, { wait: true, force: true });
        } catch {
          // ignore; read path should still return whatever exists
        }
      }
    }

    let threads = await ChatThread.find({
      schoolId,
      campusId,
      'participants.userId': userId,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    if (threads.length === 0 && (userType === 'teacher' || userType === 'student') && schoolId) {
      try {
        await ensureUserSubjectGroups(req, { wait: true, force: true });
        threads = await ChatThread.find({
          schoolId,
          campusId,
          'participants.userId': userId,
        })
          .sort({ lastMessageAt: -1, updatedAt: -1 })
          .lean();
      } catch {
        // ignore sync failures and continue with empty list
      }
    }

    if (userType === 'student') {
      const accessResults = await Promise.all(
        threads.map(async (thread) => ({
          thread,
          allowed: await ensureChatAccessToThread(req, thread),
        }))
      );
      threads = accessResults.filter(({ allowed }) => allowed).map(({ thread }) => thread);
    }

    const result = threads.map(t => {
      const unreadEntry = t.unreadCounts?.find(u => u.userId?.toString() === userId.toString());
      const isGroup = String(t.threadType || 'direct') === 'group';
      const other = isGroup
        ? {
            userId: null,
            userType: 'group',
            name: t.groupName || 'Group',
          }
        : t.participants?.find(p => p.userId?.toString() !== userId.toString());
      return {
        _id: t._id,
        threadType: isGroup ? 'group' : 'direct',
        groupName: t.groupName || '',
        participants: t.participants,
        otherParticipant: other || null,
        lastMessage: t.lastMessage || '',
        lastMessageAt: t.lastMessageAt,
        lastMessagePayload: null,
        unreadCount: unreadEntry?.count || 0,
        updatedAt: t.updatedAt,
      };
    });

    const threadIds = result.map((item) => item._id).filter(Boolean);
    if (threadIds.length > 0) {
      const latestMessages = await ChatMessage.aggregate([
        {
          $match: {
            threadId: { $in: threadIds },
            schoolId,
            ...(campusId !== null ? { campusId } : {}),
          },
        },
        { $sort: { threadId: 1, createdAt: -1 } },
        {
          $group: {
            _id: '$threadId',
            text: { $first: '$text' },
            encrypted: { $first: '$encrypted' },
            createdAt: { $first: '$createdAt' },
          },
        },
      ]);

      const latestByThread = new Map();
      latestMessages.forEach((msg) => {
        const key = String(msg._id);
        if (!latestByThread.has(key)) latestByThread.set(key, msg);
      });

      result.forEach((thread) => {
        const latest = latestByThread.get(String(thread._id));
        if (!latest) return;
        thread.lastMessagePayload = {
          text: latest.text || '',
          encrypted: latest.encrypted || null,
          createdAt: latest.createdAt || null,
        };
      });
    }

    // Enrich teacher participants with profilePic and profile details
    const teacherParticipantIds = Array.from(
      new Set(
        result
          .filter(t => t.otherParticipant?.userType === 'teacher')
          .map(t => String(t.otherParticipant.userId))
      )
    );
    if (teacherParticipantIds.length) {
      const teacherDocs = await TeacherUser.find({ _id: { $in: teacherParticipantIds } })
        .select('_id profilePic subject department qualification experience email mobile')
        .lean();
      const teacherDataMap = new Map(teacherDocs.map(t => [String(t._id), t]));
      result.forEach(t => {
        if (t.otherParticipant?.userType === 'teacher') {
          const td = teacherDataMap.get(String(t.otherParticipant.userId));
          if (td) {
            t.otherParticipant = {
              ...t.otherParticipant,
              avatar: td.profilePic || null,
              subject: td.subject || null,
              department: td.department || null,
              qualification: td.qualification || null,
              experience: td.experience || null,
              email: td.email || null,
              mobile: td.mobile || null,
            };
          }
        }
      });
    }

    // Enrich student participants with profilePic for teacher chat UI avatar rendering
    const studentParticipantIds = Array.from(
      new Set(
        result
          .filter((t) => t.otherParticipant?.userType === 'student')
          .map((t) => String(t.otherParticipant.userId))
      )
    );
    if (studentParticipantIds.length) {
      const studentDocs = await StudentUser.find({ _id: { $in: studentParticipantIds } })
        .select('_id profilePic')
        .lean();
      const studentDataMap = new Map(studentDocs.map((s) => [String(s._id), s]));
      result.forEach((t) => {
        if (t.otherParticipant?.userType !== 'student') return;
        const sd = studentDataMap.get(String(t.otherParticipant.userId));
        if (!sd) return;
        t.otherParticipant = {
          ...t.otherParticipant,
          avatar: sd.profilePic || t.otherParticipant.avatar || null,
        };
      });
    }

    if (!isTeacherRequest(req)) {
      logStudentPortalEvent(req, {
        feature: 'chat',
        action: 'threads.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'student',
        targetId: req.user?.id,
        resultCount: result.length,
      });
      return res.json(result);
    }

    const combos = await getTeacherCombos(req);
    if (!combos?.length) {
      logStudentPortalEvent(req, {
        feature: 'chat',
        action: 'threads.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'student',
        targetId: req.user?.id,
        resultCount: 0,
      });
      return res.json([]);
    }

    const studentThreads = result.filter(t => t.otherParticipant?.userType === 'student');
    const studentIds = Array.from(
      new Set(
        studentThreads
          .map(t => (t.otherParticipant?.userId ? String(t.otherParticipant.userId) : null))
          .filter(Boolean)
      )
    );
    let studentMap = new Map();
    if (studentIds.length) {
      const students = await StudentUser.find({ _id: { $in: studentIds } })
        .select('_id grade section academicYear')
        .lean();
      studentMap = new Map(students.map(s => [String(s._id), s]));
    }

    const filtered = result.filter(t => {
      if (t.otherParticipant?.userType !== 'student') return true;
      const student = studentMap.get(String(t.otherParticipant.userId));
      if (!student) return false;
      return studentMatchesCombos(student, combos);
    });

    logStudentPortalEvent(req, {
      feature: 'chat',
      action: 'threads.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      resultCount: filtered.length,
    });
    res.json(filtered);
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'chat',
      action: 'threads.fetch',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/threads/direct — get or create a 1:1 thread
router.post('/threads/direct', async (req, res) => {
  try {
    const { targetId, targetType } = req.body;
    if (!targetId || !targetType) {
      return res.status(400).json({ error: 'targetId and targetType required' });
    }

    const myId = new mongoose.Types.ObjectId(req.user.id);
    const otherId = new mongoose.Types.ObjectId(targetId);
    const { userType, schoolId } = req.user;
    const campusId = (req.campusId ?? req.user?.campusId) ?? null;
    const normalizedUserType = String(userType || '').toLowerCase();
    const normalizedTargetType = String(targetType || '').toLowerCase();
    const { id: _myId, ..._ } = req.user;
    const targetLookup = { _id: otherId, schoolId };
    const targetCampusCondition = buildCampusCondition(campusId);
    if (targetCampusCondition) Object.assign(targetLookup, targetCampusCondition);

    // Verify the other user exists
    let otherUser = null;
    let myName = '';
    if (normalizedTargetType === 'teacher') {
      otherUser = await TeacherUser.findOne(targetLookup).select('name subject employeeCode profilePic campusId').lean();
    } else if (normalizedTargetType === 'student') {
      otherUser = await StudentUser.findOne(targetLookup).select('name username studentCode grade section academicYear profilePic campusId').lean();
    } else if (normalizedTargetType === 'parent') {
      otherUser = await ParentUser.findOne(targetLookup).select('name username campusId').lean();
    }
    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (normalizedUserType === 'student') {
      const student = await getChatStudent({ userId: myId, schoolId, campusId });
      let allowed = false;
      if (normalizedTargetType === 'student') {
        allowed = await ensureStudentCanAccessStudent({
          student,
          targetStudent: otherUser,
          campusId,
        });
      } else if (normalizedTargetType === 'teacher') {
        allowed = await ensureStudentCanAccessTeacher({
          student,
          teacherId: otherId,
          schoolId,
        });
      }
      if (!allowed) {
        return res.status(403).json({ error: 'You can message only classmates in your section or assigned teachers' });
      }
    }

    if (normalizedUserType === 'teacher' && normalizedTargetType === 'student') {
      const allowed = await ensureTeacherCanAccessStudent(req, otherUser);
      if (!allowed) {
        return res.status(403).json({ error: 'Student is not assigned to you' });
      }
    }

    if (normalizedUserType === 'parent' && normalizedTargetType === 'teacher') {
      const parent = await ParentUser.findById(req.user.id)
        .select('childrenIds children schoolId campusId')
        .lean();
      if (!parent) return res.status(404).json({ error: 'Parent account not found' });
      const resolvedSchoolId = parent.schoolId || schoolId;
      if (!resolvedSchoolId) {
        return res.status(400).json({ error: 'schoolId is required' });
      }
      const teacherMap = await getParentTeacherContacts({
        parent,
        schoolId: resolvedSchoolId,
        campusId: campusId || parent.campusId || null,
      });
      if (!teacherMap.has(String(otherId))) {
        return res.status(403).json({ error: 'Teacher is not assigned to your child' });
      }
    }

    // Get my name
    if (normalizedUserType === 'student') {
      const me = await StudentUser.findById(myId).select('name username studentCode').lean();
      myName = me?.name || me?.username || me?.studentCode || 'Student';
    } else if (normalizedUserType === 'teacher') {
      const me = await TeacherUser.findById(myId).select('name employeeCode').lean();
      myName = me?.name || me?.employeeCode || 'Teacher';
    } else if (normalizedUserType === 'parent') {
      const me = await ParentUser.findById(myId).select('name username').lean();
      myName = me?.name || me?.username || 'Parent';
    } else if (normalizedUserType === 'principal') {
      const me = await Principal.findById(myId).select('name').lean();
      myName = me?.name || 'Principal';
    }

    const otherName = otherUser.name || otherUser.username || otherUser.employeeCode || otherUser.studentCode || 'User';

    let threadCampusId = String(campusId || '').trim();
    if (!threadCampusId) {
      threadCampusId = String(otherUser?.campusId || '').trim();
    }
    if (!threadCampusId && normalizedTargetType === 'teacher') {
      const teacherDoc = await TeacherUser.findById(otherId).select('campusId').lean();
      threadCampusId = String(teacherDoc?.campusId || '').trim() || threadCampusId;
    }
    if (!threadCampusId && normalizedTargetType === 'student') {
      const studentDoc = await StudentUser.findById(otherId).select('campusId').lean();
      threadCampusId = String(studentDoc?.campusId || '').trim() || threadCampusId;
    }
    if (!threadCampusId) {
      threadCampusId = 'default';
    }

    // Check if thread already exists with these 2 participants
    let thread = await ChatThread.findOne({
      schoolId,
      campusId: threadCampusId,
      'participants.userId': { $all: [myId, otherId] },
      $expr: { $eq: [{ $size: '$participants' }, 2] },
    }).lean();

    if (!thread) {
      thread = await ChatThread.create({
        schoolId,
        campusId: threadCampusId,
        participants: [
          { userId: myId, userType: normalizedUserType, name: myName },
          { userId: otherId, userType: normalizedTargetType, name: otherName },
        ],
        unreadCounts: [
          { userId: myId, count: 0 },
          { userId: otherId, count: 0 },
        ],
      });
      thread = thread.toObject();
    }

    const other = thread.participants?.find(p => p.userId?.toString() !== myId.toString());
    const otherWithAvatar = other
      ? {
          ...other,
          avatar: otherUser?.profilePic || other?.avatar || null,
        }
      : null;
    res.json({
      _id: thread._id,
      participants: thread.participants,
      otherParticipant: otherWithAvatar,
      lastMessage: thread.lastMessage || '',
      lastMessageAt: thread.lastMessageAt,
      unreadCount: 0,
    });
    logStudentPortalEvent(req, {
      feature: 'chat',
      action: 'thread_direct.open',
      outcome: 'success',
      statusCode: 200,
      targetType: 'chat_thread',
      targetId: thread._id,
      otherUserType: normalizedTargetType,
      otherUserId: targetId,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'chat',
      action: 'thread_direct.open',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
      otherUserId: req.body?.targetId,
      otherUserType: req.body?.targetType,
    });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/threads/:threadId/messages
router.get('/threads/:threadId/messages', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const { schoolId } = req.user;
    const campusId = (req.campusId ?? req.user?.campusId) ?? null;
    const { threadId } = req.params;

    const thread = await ChatThread.findOne({
      _id: threadId,
      schoolId,
      ...(campusId !== null ? { campusId } : {}),
      'participants.userId': userId,
    }).lean();

    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    const allowed = await ensureChatAccessToThread(req, thread);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    const messages = await ChatMessage.find({
      threadId,
      schoolId,
      ...(campusId !== null ? { campusId } : {}),
    })
      .sort({ createdAt: 1 })
      .lean();

    // Auto-mark as read
    await ChatThread.updateOne(
      { _id: threadId, 'unreadCounts.userId': userId },
      { $set: { 'unreadCounts.$.count': 0 } }
    );
    await markThreadMessagesSeen({ threadId, schoolId, campusId, userId });

    logStudentPortalEvent(req, {
      feature: 'chat',
      action: 'messages.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'chat_thread',
      targetId: threadId,
      resultCount: messages.length,
    });
    res.json(messages);
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'chat',
      action: 'messages.fetch',
      statusCode: 500,
      err,
      targetType: 'chat_thread',
      targetId: req.params.threadId,
    });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/threads/:threadId/presence — participant online/last seen snapshot
router.get('/threads/:threadId/presence', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const schoolId = req.schoolId || req.user?.schoolId;
    const campusId = (req.campusId ?? req.user?.campusId) ?? null;
    const { threadId } = req.params;

    const thread = await ChatThread.findOne({
      _id: threadId,
      schoolId,
      ...(campusId !== null ? { campusId } : {}),
      'participants.userId': userId,
    }).lean();

    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    const allowed = await ensureChatAccessToThread(req, thread);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    const presence = {};
    (thread.participants || []).forEach((participant) => {
      const pid = String(participant.userId || '');
      if (!pid) return;
      presence[pid] = getPresenceSnapshot(pid);
    });

    logStudentPortalEvent(req, {
      feature: 'chat',
      action: 'presence.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'chat_thread',
      targetId: threadId,
    });
    res.json({ threadId, presence });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'chat',
      action: 'presence.fetch',
      statusCode: 500,
      err,
      targetType: 'chat_thread',
      targetId: req.params.threadId,
    });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/threads/:threadId/messages — send a message
router.post('/threads/:threadId/messages', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const { userType, schoolId } = req.user;
    const campusId = (req.campusId ?? req.user?.campusId) ?? null;
    const { threadId } = req.params;
    const { text, encrypted } = req.body || {};
    const plainText = String(text || '').trim();
    const hasEncrypted =
      encrypted &&
      typeof encrypted === 'object' &&
      String(encrypted.ciphertext || '').trim() &&
      String(encrypted.iv || '').trim() &&
      Array.isArray(encrypted.keys) &&
      encrypted.keys.length > 0;

    if (!plainText && !hasEncrypted) {
      return res.status(400).json({ error: 'Encrypted payload or text is required' });
    }

    const thread = await ChatThread.findOne({
      _id: threadId,
      schoolId,
      ...(campusId !== null ? { campusId } : {}),
      'participants.userId': userId,
    }).lean();

    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    const allowed = await ensureChatAccessToThread(req, thread);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    const normalizedSenderType = String(userType || '').toLowerCase();
    const myParticipant = thread.participants?.find(p => p.userId?.toString() === userId.toString());
    const senderName = myParticipant?.name
      || (normalizedSenderType === 'teacher'
        ? 'Teacher'
        : normalizedSenderType === 'parent'
          ? 'Parent'
          : normalizedSenderType === 'principal'
            ? 'Principal'
            : 'Student');

    const msg = await ChatMessage.create({
      threadId,
      senderId: userId,
      senderType: userType,
      senderName,
      text: plainText,
      encrypted: hasEncrypted
        ? {
            algorithm: String(encrypted.algorithm || 'AES-GCM'),
            iv: String(encrypted.iv || ''),
            ciphertext: String(encrypted.ciphertext || ''),
            keys: encrypted.keys
              .filter((k) => k && k.userId && k.wrappedKey)
              .map((k) => ({ userId: k.userId, wrappedKey: String(k.wrappedKey) })),
            version: String(encrypted.version || 'v1'),
          }
        : undefined,
      schoolId,
      campusId: thread.campusId,
      seenBy: [{ userId, seenAt: new Date() }],
    });

    // Update thread last message and increment unread for others
    const bulkOps = [];
    for (const p of thread.participants) {
      if (p.userId?.toString() === userId.toString()) continue;
      bulkOps.push({
        updateOne: {
          filter: { _id: threadId, 'unreadCounts.userId': p.userId },
          update: { $inc: { 'unreadCounts.$.count': 1 } },
        },
      });
    }

    await Promise.all([
      ChatThread.updateOne(
        { _id: threadId },
        {
          $set: {
            lastMessage: msg.text || '[Encrypted message]',
            lastMessageAt: msg.createdAt,
            lastSenderId: userId,
          },
        }
      ),
      bulkOps.length ? ChatThread.bulkWrite(bulkOps) : Promise.resolve(),
    ]);

    logStudentPortalEvent(req, {
      feature: 'chat',
      action: 'message.send',
      outcome: 'success',
      statusCode: 201,
      targetType: 'chat_thread',
      targetId: threadId,
      messageId: msg._id,
      hasEncrypted,
      hasPlainText: Boolean(plainText),
    });

    const io = req.app.get('io');
    emitChatMessageEvents(io, {
      threadId,
      thread,
      message: msg,
      senderId: userId,
    });

    res.status(201).json(msg);
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'chat',
      action: 'message.send',
      statusCode: 500,
      err,
      targetType: 'chat_thread',
      targetId: req.params.threadId,
    });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/chat/threads/:threadId/messages/:messageId — edit own message within fixed time window
router.patch('/threads/:threadId/messages/:messageId', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const { schoolId } = req.user;
    const campusId = (req.campusId ?? req.user?.campusId) ?? null;
    const { threadId, messageId } = req.params;
    const { text, encrypted } = req.body || {};
    const plainText = String(text || '').trim();
    const hasEncrypted =
      encrypted &&
      typeof encrypted === 'object' &&
      String(encrypted.ciphertext || '').trim() &&
      String(encrypted.iv || '').trim() &&
      Array.isArray(encrypted.keys) &&
      encrypted.keys.length > 0;

    if (!plainText && !hasEncrypted) {
      return res.status(400).json({ error: 'Encrypted payload or text is required' });
    }

    const thread = await ChatThread.findOne({
      _id: threadId,
      schoolId,
      ...(campusId !== null ? { campusId } : {}),
      'participants.userId': userId,
    }).lean();
    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    const allowed = await ensureChatAccessToThread(req, thread);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    const message = await ChatMessage.findOne({
      _id: messageId,
      threadId,
      schoolId,
      ...(campusId !== null ? { campusId } : {}),
    });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    if (String(message.senderId || '') !== String(userId)) {
      return res.status(403).json({ error: 'You can edit only your own messages' });
    }

    const ageMs = Date.now() - new Date(message.createdAt).getTime();
    if (ageMs > CHAT_EDIT_WINDOW_MS) {
      return res.status(403).json({ error: 'Edit window expired' });
    }

    message.text = plainText;
    message.encrypted = hasEncrypted
      ? {
          algorithm: String(encrypted.algorithm || 'AES-GCM'),
          iv: String(encrypted.iv || ''),
          ciphertext: String(encrypted.ciphertext || ''),
          keys: encrypted.keys
            .filter((k) => k && k.userId && k.wrappedKey)
            .map((k) => ({ userId: k.userId, wrappedKey: String(k.wrappedKey) })),
          version: String(encrypted.version || 'v1'),
        }
      : {
          algorithm: '',
          iv: '',
          ciphertext: '',
          keys: [],
          version: 'v1',
        };
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const latestMsg = await ChatMessage.findOne({
      threadId,
      schoolId,
      ...(campusId !== null ? { campusId } : {}),
    })
      .sort({ createdAt: -1, _id: -1 })
      .select('_id')
      .lean();
    const isLatestThreadMessage = String(latestMsg?._id || '') === String(message._id);

    if (isLatestThreadMessage) {
      await ChatThread.updateOne(
        { _id: threadId },
        {
          $set: {
            lastMessage: message.text || '[Encrypted message]',
            lastMessageAt: message.createdAt,
            lastSenderId: message.senderId,
          },
        }
      );
    }

    const io = req.app.get('io');
    const payload = message.toObject();
    if (io) {
      io.to(`thread:${threadId}`).emit('message-edited', { threadId, message: payload });
      if (isLatestThreadMessage) {
        for (const participant of thread.participants || []) {
          const participantId = String(participant?.userId || '');
          if (!participantId) continue;
          io.to(`user:${participantId}`).emit('thread-updated', {
            threadId,
            lastMessage: message.text || '[Encrypted message]',
            lastMessageAt: message.createdAt,
            message: payload,
          });
        }
      }
    }

    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/chat/threads/:threadId/seen — mark thread as read
router.put('/threads/:threadId/seen', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const schoolId = req.schoolId || req.user?.schoolId;
    const campusId = req.campusId || req.user?.campusId;
    const { threadId } = req.params;

    const thread = await ChatThread.findOne({
      _id: threadId,
      schoolId,
      campusId,
      'participants.userId': userId,
    }).lean();

    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    const allowed = await ensureChatAccessToThread(req, thread);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    await ChatThread.updateOne(
      { _id: threadId, 'unreadCounts.userId': userId },
      { $set: { 'unreadCounts.$.count': 0 } }
    );
    await markThreadMessagesSeen({ threadId, schoolId, campusId, userId });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Socket.IO is initialized beside the Express router. Expose the exact same
// authorization guard so REST and live events cannot drift apart.
router.ensureChatAccessToThread = ensureChatAccessToThread;
router.studentsShareChatCohort = studentsShareChatCohort;

module.exports = router;
