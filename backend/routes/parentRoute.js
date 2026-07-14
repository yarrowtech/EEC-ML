const express = require('express');
const router = express.Router();
const ParentUser = require('../models/ParentUser');
const StudentUser = require('../models/StudentUser');
const ClassModel = require('../models/Class');
const Timetable = require('../models/Timetable');
const ExamResult = require('../models/ExamResult');
const StudentProgress = require('../models/StudentProgress');
const Assignment = require('../models/Assignment');
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
      .select('name grade section')
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
        .select('name grade section')
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

const buildStudentSchedule = async ({ student, schoolId, campusId }) => {
  const resolvedGrade = String(student?.grade || '').trim();
  const resolvedSection = String(student?.section || '').trim();

  if (!resolvedGrade) {
    return {
      className: '',
      sectionName: resolvedSection,
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

  let classDoc = await ClassModel.findOne(classFilter).lean();
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

  const timetables = await Timetable.find(timetableFilter)
    .populate('sectionId', 'name')
    .populate('entries.subjectId', 'name')
    .populate('entries.teacherId', 'name')
    .lean();

  if (!Array.isArray(timetables) || timetables.length === 0) {
    return {
      className: classDoc.name,
      sectionName: resolvedSection,
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
      subject: entry.subjectId?.name || 'Unknown',
      instructor: entry.teacherId?.name || 'TBA',
      room: entry.room || '',
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
router.post('/login', rateLimit({ windowMs: 60 * 1000, max: 10, keyGenerator: rateLimit.loginKeyGenerator, skipSuccessfulRequests: true }), async (req, res) => {
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
        .select('name grade section studentCode roll admissionNumber')
        .lean();
    }

    if (students.length === 0 && Array.isArray(parent.children) && parent.children.length > 0) {
      const validNames = parent.children.map((name) => String(name || '').trim()).filter(Boolean);
      if (validNames.length > 0) {
        students = await StudentUser.find({
          ...studentFilter,
          name: { $in: validNames },
        })
          .select('name grade section studentCode roll admissionNumber')
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
      });

      childRoutines.push({
        studentId: student._id,
        studentName: student.name || 'Student',
        studentCode: student.studentCode || '',
        username: student.username || '',
        roll: student.roll || null,
        admissionNumber: student.admissionNumber || '',
        grade: student.grade || '',
        section: student.section || '',
        className: routine.className || '',
        sectionName: routine.sectionName || '',
        schedule: routine.schedule || {},
        hasRoutine: Boolean(routine.hasRoutine),
      });
    }

    const withRoutine = childRoutines.filter((child) =>
      Object.values(child.schedule || {}).some((entries) => Array.isArray(entries) && entries.length > 0)
    ).length;

    res.json({
      children: childRoutines,
      meta: {
        childCount: childRoutines.length,
        withRoutine,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load parent routine' });
  }
});

router.get('/academics', authParent, async (req, res) => {
  try {
    if (req.userType !== 'parent') {
      return res.status(403).json({ error: 'Forbidden - not a parent' });
    }

    const parent = await ParentUser.findById(req.user.id)
      .select('schoolId campusId childrenIds children')
      .lean();

    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const schoolId = parent.schoolId || req.schoolId || null;
    const campusId = parent.campusId || req.campusId || null;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }

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
        .select('name grade section studentCode roll admissionNumber username schoolId campusId')
        .lean();
    }

    if (students.length === 0 && Array.isArray(parent.children) && parent.children.length > 0) {
      const validNames = parent.children.map((name) => String(name || '').trim()).filter(Boolean);
      if (validNames.length > 0) {
        students = await StudentUser.find({
          ...studentFilter,
          name: { $in: validNames },
        })
          .select('name grade section studentCode roll admissionNumber username schoolId campusId')
          .lean();
      }
    }

    if (students.length === 0) {
      return res.json({ children: [], meta: { childCount: 0 } });
    }

    const childrenReports = [];

    for (const student of students) {
      const examResults = await ExamResult.find({
        studentId: student._id,
        schoolId,
        published: true,
        ...(campusId ? { campusId } : {}),
      })
        .populate('examId', 'title subject date term marks')
        .sort({ createdAt: -1 })
        .lean();

      const formattedExams = examResults.map((result) => ({
        id: result._id,
        examName: result.examId?.title || 'Exam',
        subject: result.examId?.subject || '',
        date: result.examId?.date || result.createdAt || null,
        category: 'exam',
        term: result.examId?.term || 'general',
        obtainedMarks: result.marks || 0,
        totalMarks: result.examId?.marks || 100,
        percentage: result.examId?.marks ? Math.round((result.marks / result.examId.marks) * 100) : 0,
        grade: result.grade || '',
        status: result.status || 'pending',
        remarks: result.remarks || '',
      }));

      const progress = await StudentProgress.findOne({
        studentId: student._id,
        schoolId,
      }).lean();

      const gradedSubmissions = (progress?.submissions || []).filter(
        (sub) => sub.status === 'graded' && sub.score !== undefined && sub.score !== null
      );

      let assignmentRecords = [];
      if (gradedSubmissions.length > 0) {
        const assignmentIds = gradedSubmissions.map((sub) => sub.assignmentId);
        const assignments = await Assignment.find({ _id: { $in: assignmentIds } })
          .select('title subject marks dueDate')
          .lean();
        const assignmentMap = assignments.reduce((acc, assignment) => {
          acc[String(assignment._id)] = assignment;
          return acc;
        }, {});

        assignmentRecords = gradedSubmissions.map((submission) => {
          const assignment = assignmentMap[String(submission.assignmentId)] || {};
          const totalMarks = assignment.marks || 100;
          const obtained = submission.score || 0;
          const percentage = totalMarks ? Math.round((obtained / totalMarks) * 100) : 0;

          return {
            id: submission._id,
            examName: assignment.title || 'Assignment',
            subject: assignment.subject || '',
            date: submission.submittedAt || assignment.dueDate || null,
            category: 'assignment',
            term: 'assignment',
            obtainedMarks: obtained,
            totalMarks,
            percentage,
            grade:
              obtained >= totalMarks * 0.9
                ? 'A+'
                : obtained >= totalMarks * 0.8
                ? 'A'
                : obtained >= totalMarks * 0.7
                ? 'B'
                : obtained >= totalMarks * 0.6
                ? 'C'
                : obtained >= totalMarks * 0.5
                ? 'D'
                : 'F',
            status: obtained >= totalMarks * 0.4 ? 'pass' : 'fail',
            remarks: submission.feedback || '',
          };
        });
      }

      const records = [...formattedExams, ...assignmentRecords].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      const averagePercentage =
        records.length > 0 ? Math.round(records.reduce((sum, entry) => sum + (entry.percentage || 0), 0) / records.length) : null;

      const subjectTotals = records.reduce((acc, entry) => {
        if (!entry.subject) return acc;
        if (!acc[entry.subject]) {
          acc[entry.subject] = { total: 0, count: 0 };
        }
        acc[entry.subject].total += entry.percentage || 0;
        acc[entry.subject].count += 1;
        return acc;
      }, {});

      let bestSubject = '';
      let bestSubjectScore = 0;
      Object.entries(subjectTotals).forEach(([subject, { total, count }]) => {
        const avg = count ? total / count : 0;
        if (avg > bestSubjectScore) {
          bestSubject = subject;
          bestSubjectScore = avg;
        }
      });

      childrenReports.push({
        studentId: student._id,
        studentName: student.name || 'Student',
        studentCode: student.studentCode || '',
        username: student.username || '',
        roll: student.roll || null,
        admissionNumber: student.admissionNumber || '',
        grade: student.grade || '',
        section: student.section || '',
        summary: {
          averagePercentage,
          examCount: formattedExams.length,
          assignmentCount: assignmentRecords.length,
          bestSubject,
          lastUpdated: records[0]?.date || null,
        },
        records,
      });
    }

    res.json({
      children: childrenReports,
      meta: {
        childCount: childrenReports.length,
      },
    });
  } catch (err) {
    console.error('Parent academics error:', err);
    res.status(500).json({ error: err.message || 'Unable to load academic report' });
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

    res.status(201).json(formatComplaintResponse(ticket));
  } catch (err) {
    console.error('Parent complaint creation error:', err);
    res.status(500).json({ error: err.message || 'Unable to submit complaint' });
  }
});

router.post('/reset-first-password', rateLimit({ windowMs: 60 * 1000, max: 10, keyGenerator: rateLimit.loginKeyGenerator, skipSuccessfulRequests: true }), async (req, res) => {
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

router.get('/achievements', authParent, async (req, res) => {
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
        .select('name grade section studentCode roll admissionNumber username achievements')
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
          .select('name grade section studentCode roll admissionNumber username achievements')
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
        .select('name grade section studentCode roll admissionNumber username achievements')
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
        studentCode: student.studentCode || '',
        username: student.username || '',
        roll: student.roll || null,
        grade: student.grade || '',
        section: student.section || '',
        achievements,
      };
    }));

    res.json({
      children: childrenAchievements,
      meta: { childCount: childrenAchievements.length }
    });
  } catch (err) {
    console.error('Fetch parent achievements error:', err);
    res.status(500).json({ error: err.message || 'Unable to load achievements' });
  }
});

module.exports = router;
