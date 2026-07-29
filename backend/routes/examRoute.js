const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const ExamGroup = require('../models/ExamGroup');
const ExamResult = require('../models/ExamResult');
const StudentUser = require('../models/StudentUser');
const TeacherUser = require('../models/TeacherUser');
const ParentUser = require('../models/ParentUser');
const Notification = require('../models/Notification');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const TeacherAllocation = require('../models/TeacherAllocation');
const Timetable = require('../models/Timetable');
const Room = require('../models/Room');
const adminAuth = require('../middleware/adminAuth');
const teacherAuth = require('../middleware/authTeacher');
const NotificationService = require('../utils/notificationService');
const authStudent = require('../middleware/authStudent');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

// Configure multer for CSV upload
const upload = multer({ dest: 'uploads/' });
const EXAM_GROUP_STATUS_OPTIONS = new Set(['Scheduled', 'Completed']);

const resolveSchoolId = (req, res) => {
    const schoolId = req.schoolId || req.admin?.schoolId || null;
    if (!schoolId) {
        res.status(400).json({ error: 'schoolId is required' });
        return null;
    }
    return schoolId;
};

const resolveCampusId = (req) => req.campusId || null;

const resolveAcademicContext = async ({ schoolId, campusId, classId, sectionId, subjectId }) => {
  if (!classId || !mongoose.isValidObjectId(classId)) {
    return { error: 'Valid classId is required' };
  }
  if (!sectionId || !mongoose.isValidObjectId(sectionId)) {
    return { error: 'Valid sectionId is required' };
  }
  if (!subjectId || !mongoose.isValidObjectId(subjectId)) {
    return { error: 'Valid subjectId is required' };
  }

  const baseFilter = { schoolId, ...(campusId ? { campusId } : {}) };
  const [classDoc, sectionDoc, subjectDoc] = await Promise.all([
    ClassModel.findOne({ _id: classId, ...baseFilter }).lean(),
    Section.findOne({ _id: sectionId, ...baseFilter }).lean(),
    Subject.findOne({ _id: subjectId, ...baseFilter }).lean(),
  ]);

  if (!classDoc) return { error: 'Class not found' };
  if (!sectionDoc) return { error: 'Section not found' };
  if (!subjectDoc) return { error: 'Subject not found' };
  if (String(sectionDoc.classId) !== String(classDoc._id)) {
    return { error: 'Section does not belong to the selected class' };
  }
  if (subjectDoc.classId && String(subjectDoc.classId) !== String(classDoc._id)) {
    return { error: 'Subject does not belong to the selected class' };
  }

  return {
    classDoc,
    sectionDoc,
    subjectDoc,
  };
};

const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

const buildScopeKey = (classId, sectionId, subjectId) =>
  `${toIdString(classId)}_${toIdString(sectionId)}_${toIdString(subjectId || '*')}`;

const getTeacherScopeKeys = async ({ schoolId, campusId, teacherId }) => {
  const keys = new Set();
  if (!schoolId || !teacherId) return keys;

  const allocations = await TeacherAllocation.find({
    schoolId,
    teacherId,
    ...(campusId
      ? { $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] }
      : {}),
  })
    .select('classId sectionId subjectId')
    .lean();

  if (allocations.length) {
    allocations.forEach((item) => {
      if (!item?.classId || !item?.sectionId) return;
      const classId = toIdString(item.classId);
      const sectionId = toIdString(item.sectionId);
      const subjectId = item.subjectId ? toIdString(item.subjectId) : '*';
      keys.add(buildScopeKey(classId, sectionId, subjectId));
    });
    return keys;
  }

  const timetables = await Timetable.find({
    schoolId,
    ...(campusId ? { campusId } : {}),
    'entries.teacherId': teacherId,
  })
    .select('classId sectionId entries.teacherId entries.subjectId')
    .lean();

  timetables.forEach((tt) => {
    const classId = toIdString(tt.classId);
    const sectionId = toIdString(tt.sectionId);
    if (!classId || !sectionId) return;
    (tt.entries || []).forEach((entry) => {
      if (toIdString(entry.teacherId) !== toIdString(teacherId)) return;
      const subjectId = toIdString(entry.subjectId);
      if (!subjectId) return;
      keys.add(buildScopeKey(classId, sectionId, subjectId));
    });
  });

  return keys;
};

const canTeacherManageExam = (scopeKeys, examDoc) => {
  if (!examDoc) return false;
  const classId = toIdString(examDoc.classId);
  const sectionId = toIdString(examDoc.sectionId);
  const subjectId = toIdString(examDoc.subjectId);
  if (!classId || !sectionId) return false;

  // Legacy compatibility: some historical exams may not have subjectId populated.
  // In that case, fall back to class+section allocation scope.
  if (!subjectId) {
    if (scopeKeys.has(buildScopeKey(classId, sectionId, '*'))) return true;
    for (const key of scopeKeys) {
      if (String(key).startsWith(`${classId}_${sectionId}_`)) return true;
    }
    return false;
  }

  return (
    scopeKeys.has(buildScopeKey(classId, sectionId, subjectId)) ||
    scopeKeys.has(buildScopeKey(classId, sectionId, '*'))
  );
};

const isExamCompleted = (examDoc) =>
  String(examDoc?.status || '').trim().toLowerCase() === 'completed';

const getTeacherDisplayName = async (teacherId) => {
  if (!teacherId) return 'Teacher';
  const teacher = await TeacherUser.findById(teacherId).select('name employeeCode').lean();
  return teacher?.name || teacher?.employeeCode || 'Teacher';
};

const notifyAdminTeacherResultUpload = async ({
  schoolId,
  campusId,
  teacherId,
  teacherName,
  exam,
  uploadedCount = 1,
  multipleExams = false,
}) => {
  if (!schoolId || !teacherId) return;

  const subjectName = String(exam?.subject || exam?.subjectId?.name || '').trim();
  const className = String(getExamClassName(exam) || '').trim();
  const sectionName = String(getExamSectionName(exam) || '').trim();
  const examTitle = String(exam?.title || '').trim();
  const actor = teacherName || 'Teacher';

  let message = '';
  if (multipleExams) {
    message = `${actor} uploaded ${uploadedCount} result entries across multiple exams. Review and publish results.`;
  } else {
    const examBits = [examTitle, subjectName].filter(Boolean).join(' - ');
    const classBits = [className, sectionName].filter(Boolean).join(' / ');
    message = `${actor} uploaded ${uploadedCount} result entr${uploadedCount === 1 ? 'y' : 'ies'} for ${examBits || 'an exam'}${classBits ? ` (${classBits})` : ''}. Review and publish results.`;
  }

  await Notification.create({
    schoolId,
    campusId: campusId || null,
    title: 'Teacher Uploaded Results',
    message,
    audience: 'Admin',
    type: 'result',
    priority: 'high',
    category: 'academic',
    classId: exam?.classId || undefined,
    sectionId: exam?.sectionId || undefined,
    className,
    sectionName,
    subjectId: exam?.subjectId || undefined,
    subjectName,
    relatedEntity: exam?._id ? { entityType: 'result', entityId: exam._id } : undefined,
    createdByType: 'teacher',
    createdByTeacherId: teacherId,
    createdByName: actor,
  });
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const getExamClassName = (exam) => exam?.classId?.name || exam?.grade || '';
const getExamSectionName = (exam) => exam?.sectionId?.name || exam?.section || '';

const parseInstructorNames = (value) =>
  String(value || '')
    .split(',')
    .map((item) => normalizeText(item))
    .filter(Boolean);

const buildTeacherIdentitySet = (teacherDoc = {}) => {
  const identities = new Set();
  const pushIdentity = (value) => {
    const normalized = normalizeText(value);
    if (normalized) identities.add(normalized);
  };

  pushIdentity(teacherDoc?.name);
  pushIdentity(teacherDoc?.username);
  pushIdentity(teacherDoc?.employeeCode);
  pushIdentity(teacherDoc?.email);
  pushIdentity(String(teacherDoc?.email || '').split('@')[0]);

  return identities;
};

const isTeacherAssignedInvigilator = (examDoc = {}, teacherIdentitySet = new Set()) => {
  const instructors = parseInstructorNames(examDoc?.instructor);
  if (!instructors.length || teacherIdentitySet.size === 0) return false;
  return instructors.some((instructor) => teacherIdentitySet.has(instructor));
};

const studentMatchesExamScope = (student, exam) => {
  const examClass = normalizeText(getExamClassName(exam));
  const examSection = normalizeText(getExamSectionName(exam));
  const studentClass = normalizeText(student?.grade || student?.className);
  const studentSection = normalizeText(student?.section || student?.sectionName);

  const classMatches = examClass ? studentClass === examClass : true;
  const sectionMatches = examSection ? studentSection === examSection : true;
  return classMatches && sectionMatches;
};

const getScopedStudentsForExam = async ({ schoolId, campusId, exam }) => {
  const examClassName = String(getExamClassName(exam) || '').trim();
  const examSectionName = String(getExamSectionName(exam) || '').trim();

  const studentFilter = { schoolId, ...(campusId ? { campusId } : {}) };
  if (examClassName) studentFilter.grade = examClassName;
  if (examSectionName) studentFilter.section = examSectionName;

  const students = await StudentUser.find(studentFilter)
    .select('name grade section roll studentCode')
    .lean();

  return students.filter((student) => studentMatchesExamScope(student, exam));
};

const resolveExamStudentCount = async ({ schoolId, campusId, exam }) => {
  const students = await getScopedStudentsForExam({ schoolId, campusId, exam });
  return students.length;
};

const parseResultStatus = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return 'pass';
  if (['pass', 'fail', 'absent'].includes(normalized)) return normalized;
  return null;
};

const resolveExamRoom = async ({ schoolId, campusId, roomId }) => {
  if (!roomId) return { roomDoc: null };
  if (!mongoose.isValidObjectId(roomId)) {
    return { error: 'Invalid roomId' };
  }
  const roomDoc = await Room.findOne({
    _id: roomId,
    schoolId,
    ...(campusId ? { campusId } : {}),
  })
    .populate({
      path: 'floorId',
      select: 'name floorCode buildingId',
      populate: { path: 'buildingId', select: 'name code' },
    })
    .lean();
  if (!roomDoc) {
    return { error: 'Room not found' };
  }
  return { roomDoc };
};

const resolveResultScore = ({ marks, status, examMaxMarks, requireMarks = true }) => {
  const normalizedStatus = parseResultStatus(status);
  if (!normalizedStatus) {
    return { error: 'Invalid result status' };
  }

  if (normalizedStatus === 'absent') {
    return { status: normalizedStatus, score: 0 };
  }

  const marksMissing = marks === undefined || marks === null || String(marks).trim() === '';
  if (marksMissing) {
    if (!requireMarks) return { status: normalizedStatus, score: undefined };
    return { error: 'Valid marks are required' };
  }

  const score = Number(marks);
  if (!Number.isFinite(score) || score < 0) {
    return { error: 'Valid marks are required' };
  }

  const maxMarks = Number(examMaxMarks);
  if (Number.isFinite(maxMarks) && maxMarks >= 0 && score > maxMarks) {
    return { error: `Marks cannot be greater than exam max marks (${maxMarks})` };
  }

  return { status: normalizedStatus, score };
};



const router = express.Router();

/* ══════════════════════════════════════════════════════════
   EXAM GROUPS  (parent level)
══════════════════════════════════════════════════════════ */

// GET /groups — all groups with their subject exams embedded
router.get('/groups', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const filter = { schoolId, ...(campusId ? { campusId } : {}) };

    const [groups, exams] = await Promise.all([
      ExamGroup.find(filter)
        .populate('classId', 'name')
        .populate('sectionId', 'name')
        .sort({ createdAt: -1 })
        .lean(),
      Exam.find({ ...filter, groupId: { $exists: true, $ne: null } })
        .populate('subjectId', 'name code')
        .populate('classId', 'name')
        .populate('sectionId', 'name')
        .populate({
          path: 'roomId',
          select: 'roomNumber floorId',
          populate: { path: 'floorId', select: 'name floorCode buildingId', populate: { path: 'buildingId', select: 'name code' } },
        })
        .sort({ date: 1 })
        .lean(),
    ]);

    const examsByGroup = new Map();
    exams.forEach(e => {
      const gid = String(e.groupId);
      if (!examsByGroup.has(gid)) examsByGroup.set(gid, []);
      examsByGroup.get(gid).push(e);
    });

    res.json(groups.map(g => ({ ...g, subjects: examsByGroup.get(String(g._id)) || [] })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /groups/student-schedule — exam schedule visible for the logged-in student
router.get('/groups/student-schedule', authStudent, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const campusId = req.campusId || null;
    const studentId = req.user?.id || null;
    if (!studentId || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ error: 'Valid studentId is required' });
    }

    const student = await StudentUser.findOne({
      _id: studentId,
      schoolId,
      ...(campusId ? { campusId } : {}),
    })
      .select('name grade section')
      .lean();
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const filter = { schoolId, ...(campusId ? { campusId } : {}) };
    const [groups, exams] = await Promise.all([
      ExamGroup.find(filter)
        .populate('classId', 'name')
        .populate('sectionId', 'name classId')
        .sort({ startDate: 1, createdAt: -1 })
        .lean(),
      Exam.find({ ...filter, groupId: { $exists: true, $ne: null } })
        .populate('subjectId', 'name code')
        .populate('classId', 'name')
        .populate('sectionId', 'name classId')
        .populate({
          path: 'roomId',
          select: 'roomNumber floorId',
          populate: {
            path: 'floorId',
            select: 'name floorCode buildingId',
            populate: { path: 'buildingId', select: 'name code' },
          },
        })
        .sort({ date: 1, createdAt: 1 })
        .lean(),
    ]);

    const studentGroups = groups.filter((group) => studentMatchesExamScope(student, group));
    const allowedGroupIds = new Set(studentGroups.map((group) => String(group._id)));
    const examsByGroup = new Map();

    exams.forEach((exam) => {
      const gid = String(exam.groupId || '');
      if (!gid || !allowedGroupIds.has(gid)) return;
      if (!examsByGroup.has(gid)) examsByGroup.set(gid, []);
      examsByGroup.get(gid).push(exam);
    });

    const payload = studentGroups.map((group) => {
      const subjects = examsByGroup.get(String(group._id)) || [];
      return {
        ...group,
        subjects,
      };
    });

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch exam schedule' });
  }
});

// POST /groups — create group
router.post('/groups', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { title, term, classId, sectionId, status, startDate, endDate, startTime } = req.body || {};
    const normalizedGroupStatus = status ? String(status).trim() : 'Scheduled';

    if (!title?.trim()) return res.status(400).json({ error: 'Exam group title is required' });
    if (!EXAM_GROUP_STATUS_OPTIONS.has(normalizedGroupStatus)) {
      return res.status(400).json({ error: 'Group status must be Scheduled or Completed' });
    }

    let classDoc = null, sectionDoc = null;
    if (classId && mongoose.isValidObjectId(classId)) {
      classDoc = await ClassModel.findOne({ _id: classId, schoolId }).lean();
      if (!classDoc) return res.status(400).json({ error: 'Class not found' });
    }
    if (sectionId && mongoose.isValidObjectId(sectionId)) {
      sectionDoc = await Section.findOne({ _id: sectionId, schoolId }).lean();
      if (!sectionDoc) return res.status(400).json({ error: 'Section not found' });
    }

    const group = await ExamGroup.create({
      schoolId,
      campusId: campusId || null,
      title: title.trim(),
      term: term || 'Term 1',
      classId:  classDoc?._id  || null,
      sectionId: sectionDoc?._id || null,
      grade:   classDoc?.name  || '',
      section: sectionDoc?.name || '',
      status: normalizedGroupStatus,
      startDate: startDate || '',
      endDate:   endDate   || '',
      startTime: startTime || '',
    });

    const populated = await ExamGroup.findById(group._id)
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .lean();

    res.status(201).json({ message: 'Exam group created', group: { ...populated, subjects: [] } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /groups/:groupId — update group
router.put('/groups/:groupId', adminAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!mongoose.isValidObjectId(groupId)) return res.status(400).json({ error: 'Invalid group ID' });
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { title, term, classId, sectionId, status, startDate, endDate, startTime } = req.body || {};

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (term !== undefined) updates.term = term;
    if (status !== undefined) {
      const normalizedGroupStatus = String(status).trim();
      if (!EXAM_GROUP_STATUS_OPTIONS.has(normalizedGroupStatus)) {
        return res.status(400).json({ error: 'Group status must be Scheduled or Completed' });
      }
      updates.status = normalizedGroupStatus;
    }
    if (startDate !== undefined) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate;
    if (startTime !== undefined) updates.startTime = startTime;

    if (classId !== undefined) {
      const classDoc = classId && mongoose.isValidObjectId(classId)
        ? await ClassModel.findOne({ _id: classId, schoolId }).lean() : null;
      updates.classId = classDoc?._id || null;
      updates.grade   = classDoc?.name || '';
    }
    if (sectionId !== undefined) {
      const sectionDoc = sectionId && mongoose.isValidObjectId(sectionId)
        ? await Section.findOne({ _id: sectionId, schoolId }).lean() : null;
      updates.sectionId = sectionDoc?._id || null;
      updates.section   = sectionDoc?.name || '';
    }

    const group = await ExamGroup.findOneAndUpdate(
      { _id: groupId, schoolId, ...(campusId ? { campusId } : {}) },
      updates,
      { new: true, runValidators: true }
    ).populate('classId', 'name').populate('sectionId', 'name').lean();

    if (!group) return res.status(404).json({ error: 'Exam group not found' });

    // Keep child subject exams in sync: marking a main exam group as Completed
    // should complete every subject exam under that group.
    if (String(updates.status || '').trim() === 'Completed') {
      await Exam.updateMany(
        { groupId, schoolId, ...(campusId ? { campusId } : {}) },
        { $set: { status: 'Completed' } }
      );
    }

    res.json({ message: 'Exam group updated', group });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /groups/:groupId — delete group + all its subject exams
router.delete('/groups/:groupId', adminAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!mongoose.isValidObjectId(groupId)) return res.status(400).json({ error: 'Invalid group ID' });
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const group = await ExamGroup.findOneAndDelete({ _id: groupId, schoolId, ...(campusId ? { campusId } : {}) });
    if (!group) return res.status(404).json({ error: 'Exam group not found' });

    await Exam.deleteMany({ groupId, schoolId });
    res.json({ message: 'Exam group and all its subject exams deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════ */

router.get("/fetch", adminAuth, async (req, res) => {
  // #swagger.tags = ['Exams']
    try {
        const schoolId = resolveSchoolId(req, res);
        if (!schoolId) return;
        const campusId = resolveCampusId(req);
        const filter = { schoolId, ...(campusId ? { campusId } : {}) };
        const exams = await Exam.find(filter)
          .populate('classId', 'name')
          .populate('sectionId', 'name classId')
          .populate('subjectId', 'name code classId')
          .populate({
            path: 'roomId',
            select: 'roomNumber floorId',
            populate: { path: 'floorId', select: 'name floorCode buildingId', populate: { path: 'buildingId', select: 'name code' } },
          })
          .sort({ date: -1, createdAt: -1 })
          .lean();
        res.status(200).json(exams);
    } catch(err) {
        res.status(400).json({error: err.message});
    }
})

router.post("/add", adminAuth, async (req, res) => {
  // #swagger.tags = ['Exams']
    try {
        const {
            title,
            term,
            instructor,
            venue,
            date,
            time,
            duration,
            marks,
            noOfStudents,
            status,
            classId,
            sectionId,
            subjectId,
            roomId,
            published,
            groupId,
        } = req.body || {};
        const schoolId = resolveSchoolId(req, res);
        if (!schoolId) return;
        const campusId = resolveCampusId(req);
        const academicContext = await resolveAcademicContext({ schoolId, campusId, classId, sectionId, subjectId });
        if (academicContext.error) {
          return res.status(400).json({ error: academicContext.error });
        }
        const roomResult = await resolveExamRoom({ schoolId, campusId, roomId });
        if (roomResult.error) {
          return res.status(400).json({ error: roomResult.error });
        }
        const roomVenue = roomResult.roomDoc
          ? `${roomResult.roomDoc.floorId?.buildingId?.name || 'Building'} / ${roomResult.roomDoc.floorId?.name || 'Floor'} / ${roomResult.roomDoc.roomNumber}`
          : '';
        const { classDoc, sectionDoc, subjectDoc } = academicContext;
        const computedStudentCount = await resolveExamStudentCount({
          schoolId,
          campusId,
          exam: { classId: classDoc, sectionId: sectionDoc, grade: classDoc.name, section: sectionDoc.name },
        });
        const exam = await Exam.create({
            schoolId,
            campusId: campusId || null,
            title,
            subject: subjectDoc.name,
            term: term || 'Term 1',
            instructor,
            venue: roomVenue || venue,
            date,
            time,
            duration,
            marks,
            noOfStudents:
              noOfStudents === undefined || noOfStudents === null || String(noOfStudents).trim() === ''
                ? computedStudentCount
                : Number(noOfStudents),
            status,
            classId: classDoc._id,
            sectionId: sectionDoc._id,
            subjectId: subjectDoc._id,
            roomId: roomResult.roomDoc?._id || undefined,
            grade: classDoc.name || '',
            section: sectionDoc.name || '',
            groupId: groupId && mongoose.isValidObjectId(groupId) ? groupId : null,
            published: Boolean(published),
            publishedAt: published ? new Date() : null,
        });

        // Create notification for students
        try {
            await NotificationService.notifyExamScheduled({
                schoolId,
                campusId: campusId || null,
                exam,
                createdBy: req.admin?.id || null
            });
        } catch (notifErr) {
            console.error('Failed to create exam notification:', notifErr);
            // Don't fail the entire request if notification fails
        }

        res.status(201).json({message: "Exam added successfully", exam});
    } catch(err) {
        res.status(400).json({error: err.message});
    }
})

// Update exam (admin)
router.put("/:id", adminAuth, async (req, res) => {
  // #swagger.tags = ['Exams']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid exam id' });
    }

    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const {
      title,
      term,
      instructor,
      venue,
      date,
      time,
      duration,
      marks,
      noOfStudents,
      status,
      classId,
      sectionId,
      subjectId,
      roomId,
      published
    } = req.body || {};

    const existingExam = await Exam.findOne({ _id: id, schoolId, ...(campusId ? { campusId } : {}) }).lean();
    if (!existingExam) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    const roomResult = await resolveExamRoom({ schoolId, campusId, roomId });
    if (roomResult.error) {
      return res.status(400).json({ error: roomResult.error });
    }
    const roomVenue = roomResult.roomDoc
      ? `${roomResult.roomDoc.floorId?.buildingId?.name || 'Building'} / ${roomResult.roomDoc.floorId?.name || 'Floor'} / ${roomResult.roomDoc.roomNumber}`
      : '';

    let academicUpdates = {};
    let nextClassDoc = null;
    let nextSectionDoc = null;
    if (classId !== undefined || sectionId !== undefined || subjectId !== undefined) {
      const academicContext = await resolveAcademicContext({
        schoolId,
        campusId,
        classId: classId || existingExam.classId,
        sectionId: sectionId || existingExam.sectionId,
        subjectId: subjectId || existingExam.subjectId,
      });
      if (academicContext.error) {
        return res.status(400).json({ error: academicContext.error });
      }
      const { classDoc, sectionDoc, subjectDoc } = academicContext;
      nextClassDoc = classDoc;
      nextSectionDoc = sectionDoc;
      academicUpdates = {
        classId: classDoc._id,
        sectionId: sectionDoc._id,
        subjectId: subjectDoc._id,
        grade: classDoc.name || '',
        section: sectionDoc.name || '',
        subject: subjectDoc.name || '',
      };
    }

    let resolvedNoOfStudents = noOfStudents;
    if (resolvedNoOfStudents === undefined && (academicUpdates.classId || academicUpdates.sectionId)) {
      const className = nextClassDoc?.name || existingExam.grade || '';
      const sectionName = nextSectionDoc?.name || existingExam.section || '';
      resolvedNoOfStudents = await resolveExamStudentCount({
        schoolId,
        campusId,
        exam: {
          classId: nextClassDoc?._id || existingExam.classId,
          sectionId: nextSectionDoc?._id || existingExam.sectionId,
          grade: className,
          section: sectionName,
        },
      });
    }

    const updates = {
      ...(title !== undefined ? { title } : {}),
      ...(term !== undefined ? { term } : {}),
      ...(instructor !== undefined ? { instructor } : {}),
      ...((venue !== undefined || roomId !== undefined) ? { venue: roomVenue || venue || '' } : {}),
      ...(date !== undefined ? { date } : {}),
      ...(time !== undefined ? { time } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(marks !== undefined ? { marks } : {}),
      ...(resolvedNoOfStudents !== undefined ? { noOfStudents: Number(resolvedNoOfStudents) } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(roomId !== undefined ? { roomId: roomResult.roomDoc?._id || null } : {}),
      ...(published !== undefined ? { published: Boolean(published), publishedAt: published ? new Date() : null } : {}),
      ...academicUpdates,
    };

    const exam = await Exam.findOneAndUpdate(
      { _id: id, schoolId, ...(campusId ? { campusId } : {}) },
      updates,
      { new: true, runValidators: true }
    );

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    res.status(200).json({ message: 'Exam updated successfully', exam });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete exam and linked results (admin)
router.delete("/:id", adminAuth, async (req, res) => {
  // #swagger.tags = ['Exams']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid exam id' });
    }

    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const filter = { _id: id, schoolId, ...(campusId ? { campusId } : {}) };
    const exam = await Exam.findOne(filter).lean();
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    await Promise.all([
      Exam.deleteOne(filter),
      ExamResult.deleteMany({ examId: id, schoolId, ...(campusId ? { campusId } : {}) }),
    ]);

    res.status(200).json({ message: 'Exam and linked results deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create or update exam results (admin/teacher)
// Combined middleware to accept both admin and teacher
const adminOrTeacherAuth = async (req, res, next) => {
    // Try admin auth first
    const adminToken = req.headers.authorization?.split(' ')[1];
    if (adminToken) {
        try {
            const decoded = require('jsonwebtoken').verify(adminToken, process.env.JWT_SECRET);
            if (decoded.type === 'admin') {
                req.admin = decoded;
                req.schoolId = decoded.schoolId;
                req.campusId = decoded.campusId || null;
                req.userType = 'Admin';
                if (!req.campusId) {
                  return res.status(400).json({ error: 'campusId is required' });
                }
                return next();
            }
        } catch (err) {
            // Token invalid or not admin, try teacher auth
        }
    }
    // Fall back to teacher auth
    return teacherAuth(req, res, next);
};

router.post("/results", adminOrTeacherAuth, async (req, res) => {
  // #swagger.tags = ['Exams']
    try {
        const schoolId = req.schoolId || req.user?.schoolId || req.admin?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
        const campusId = req.campusId || null;
        const { examId, studentId, marks, grade, remarks, status } = req.body || {};
        if (!examId || !studentId) {
            return res.status(400).json({ error: 'examId and studentId are required' });
        }
        const exam = await Exam.findOne({ _id: examId, schoolId, ...(campusId ? { campusId } : {}) }).lean();
        if (!exam) {
            return res.status(404).json({ error: 'Exam not found' });
        }
        if (req.userType === 'teacher') {
            const scopeKeys = await getTeacherScopeKeys({
                schoolId,
                campusId,
                teacherId: req.user?.id || null,
            });
            if (!canTeacherManageExam(scopeKeys, exam)) {
                return res.status(403).json({ error: 'You are not allocated for this exam' });
            }
            if (!isExamCompleted(exam)) {
                return res.status(400).json({ error: 'Teachers can upload marks only for completed exams' });
            }
        }
        const student = await StudentUser.findOne({ _id: studentId, schoolId, ...(campusId ? { campusId } : {}) }).lean();
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        if (campusId && student.campusId && String(student.campusId) !== String(campusId)) {
            return res.status(400).json({ error: 'Student does not belong to this campus' });
        }
        if (!studentMatchesExamScope(student, exam)) {
            return res.status(400).json({ error: 'Student does not belong to exam class' });
        }
        const scoreResult = resolveResultScore({
          marks,
          status: status || 'pass',
          examMaxMarks: exam?.marks,
          requireMarks: true,
        });
        if (scoreResult.error) {
          return res.status(400).json({ error: scoreResult.error });
        }

        const result = await ExamResult.findOneAndUpdate(
            { examId, studentId, schoolId, ...(campusId ? { campusId } : {}) },
            {
                schoolId,
                campusId: campusId || null,
                examId,
                studentId,
                marks: scoreResult.score,
                grade,
                remarks,
                status: scoreResult.status,
                createdBy: req.user?.id || req.admin?.id || null,
            },
            { new: true, upsert: true, runValidators: true }
        );

        if (req.userType === 'teacher') {
            const teacherId = req.user?.id || null;
            const teacherName = await getTeacherDisplayName(teacherId);
            await notifyAdminTeacherResultUpload({
                schoolId,
                campusId,
                teacherId,
                teacherName,
                exam,
                uploadedCount: 1,
                multipleExams: false,
            });
        }

        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// List results for an exam (admin/teacher)
router.get("/results", adminOrTeacherAuth, async (req, res) => {
  // #swagger.tags = ['Exams']
    try {
        const schoolId = req.schoolId || req.user?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
        const campusId = req.campusId || null;
        const { examId, studentId, grade, section, subject, enrich } = req.query || {};
        const filter = { schoolId, ...(campusId ? { campusId } : {}) };
        if (examId) filter.examId = examId;
        if (studentId) filter.studentId = studentId;
        const results = await ExamResult.find(filter)
            .populate('studentId', 'name grade section roll academicYear')
            .populate('examId', 'title subject date term grade section classId sectionId subjectId marks')
            .lean();

        let scopedResults = results;
        if (req.userType === 'teacher') {
          const scopeKeys = await getTeacherScopeKeys({
            schoolId,
            campusId,
            teacherId: req.user?.id || null,
          });
          scopedResults = results.filter((result) => canTeacherManageExam(scopeKeys, result.examId));
        }

        const filtered = scopedResults.filter((result) => {
          const studentGrade = result.studentId?.grade || '';
          const studentSection = result.studentId?.section || '';
          const examSubject = result.examId?.subject || '';
          const matchesGrade = grade ? String(studentGrade) === String(grade) : true;
          const matchesSection = section ? String(studentSection) === String(section) : true;
          const matchesSubject = subject
            ? String(examSubject).toLowerCase() === String(subject).toLowerCase()
            : true;
          return matchesGrade && matchesSection && matchesSubject;
        });

        // Optionally enrich with rank, percentile, and pre/post delta when examId is known
        if (enrich === 'true' && examId) {
          const allForExam = await ExamResult.find({ examId, published: true, schoolId }).select('marks studentId').lean();
          const total = allForExam.length;
          const sortedDesc = [...allForExam].sort((a, b) => (b.marks || 0) - (a.marks || 0));

          // Collect previous results per student+subject in one query
          const studentIds = filtered.map((r) => r.studentId?._id).filter(Boolean);
          const examSubject = filtered[0]?.examId?.subject || '';
          const prevResults = await ExamResult.find({
            schoolId, studentId: { $in: studentIds }, published: true,
            examId: { $ne: examId },
          }).populate('examId', 'subject date marks').sort({ 'examId.date': -1 }).lean();

          const prevByStudent = {};
          prevResults.forEach((r) => {
            const sid = String(r.studentId);
            if (!prevByStudent[sid] && r.examId?.subject === examSubject) {
              prevByStudent[sid] = r;
            }
          });

          const enriched = filtered.map((result) => {
            const sid = String(result.studentId?._id);
            const rankPos = sortedDesc.findIndex((r) => String(r.studentId) === sid) + 1;
            const rank = rankPos > 0 ? rankPos : null;
            const percentile = rank && total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : null;
            const prev = prevByStudent[sid];
            let delta = null;
            if (prev && result.marks != null && prev.marks != null) {
              const maxCurr = result.examId?.marks || 100;
              const maxPrev = prev.examId?.marks || 100;
              delta = Math.round((result.marks / maxCurr) * 100) - Math.round((prev.marks / maxPrev) * 100);
            }
            return { ...result, rank, percentile, total, delta };
          });
          return res.json(enriched);
        }

        res.json(filtered);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/exam/results/export-csv — CSV export of results for a teacher ───
router.get("/results/export-csv", adminOrTeacherAuth, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const campusId = req.campusId || null;
    const { examId, grade, section, subject } = req.query || {};

    const filter = { schoolId, ...(campusId ? { campusId } : {}) };
    if (examId) filter.examId = examId;

    const results = await ExamResult.find(filter)
      .populate('studentId', 'name grade section roll')
      .populate('examId', 'title subject date term marks classId sectionId subjectId')
      .lean();

    let scopedResults = results;
    if (req.userType === 'teacher') {
      const scopeKeys = await getTeacherScopeKeys({ schoolId, campusId, teacherId: req.user?.id || null });
      scopedResults = results.filter((r) => canTeacherManageExam(scopeKeys, r.examId));
    }

    const filtered = scopedResults.filter((r) => {
      const g = r.studentId?.grade || '';
      const s = r.studentId?.section || '';
      const sub = r.examId?.subject || '';
      return (grade ? String(g) === String(grade) : true)
        && (section ? String(s) === String(section) : true)
        && (subject ? sub.toLowerCase() === String(subject).toLowerCase() : true);
    });

    // Compute rank within exam if filtered by examId
    let rankMap = {};
    if (examId) {
      const allForExam = await ExamResult.find({ examId, published: true, schoolId }).select('marks studentId').lean();
      const sorted = [...allForExam].sort((a, b) => (b.marks || 0) - (a.marks || 0));
      const total = sorted.length;
      sorted.forEach((r, i) => {
        const sid = String(r.studentId);
        rankMap[sid] = { rank: i + 1, percentile: total > 1 ? Math.round(((total - i - 1) / (total - 1)) * 100) : 100 };
      });
    }

    const header = 'Roll,Student Name,Class,Section,Exam,Subject,Term,Marks,Max Marks,Percentage,Grade,Status,Rank,Percentile,Published\n';
    const rows = filtered.map((r) => {
      const sid = String(r.studentId?._id || '');
      const maxM = r.examId?.marks || 100;
      const pct = r.marks != null ? Math.round((r.marks / maxM) * 100) : '';
      const rank = rankMap[sid]?.rank ?? '';
      const percentile = rankMap[sid]?.percentile ?? '';
      return [
        r.studentId?.roll || '',
        `"${(r.studentId?.name || '').replace(/"/g, '""')}"`,
        r.studentId?.grade || '',
        r.studentId?.section || '',
        `"${(r.examId?.title || '').replace(/"/g, '""')}"`,
        r.examId?.subject || '',
        r.examId?.term || '',
        r.marks ?? '',
        maxM,
        pct,
        r.grade || '',
        r.status || '',
        rank,
        percentile,
        r.published ? 'Yes' : 'No',
      ].join(',');
    });

    const csv = header + rows.join('\n');
    const filename = `results_${examId || 'all'}_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// List exams for exam management (admin only)
router.get("/fetch/manage", adminAuth, async (req, res) => {
  // #swagger.tags = ['Exams']
  try {
    const schoolId = req.schoolId || req.admin?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const campusId = req.campusId || null;
    const exams = await Exam.find({ schoolId, ...(campusId ? { campusId } : {}) })
      .populate('classId', 'name')
      .populate('sectionId', 'name classId')
      .populate('subjectId', 'name code classId')
      .populate({
        path: 'roomId',
        select: 'roomNumber floorId',
        populate: { path: 'floorId', select: 'name floorCode buildingId', populate: { path: 'buildingId', select: 'name code' } },
      })
      .sort({ date: -1, createdAt: -1 })
      .lean();
    res.status(200).json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read-only exam options for result management (admin/teacher)
router.get("/results/exam-options", adminOrTeacherAuth, async (req, res) => {
  // #swagger.tags = ['Exams']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || req.admin?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const campusId = req.campusId || null;

    let exams = await Exam.find({ schoolId, ...(campusId ? { campusId } : {}) })
      .select('title subject term date time marks grade section status classId sectionId subjectId roomId venue')
      .populate('classId', 'name academicYearId')
      .populate('sectionId', 'name classId')
      .populate('subjectId', 'name code classId')
      .populate({
        path: 'roomId',
        select: 'roomNumber floorId',
        populate: { path: 'floorId', select: 'name floorCode buildingId', populate: { path: 'buildingId', select: 'name code' } },
      })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    if (req.userType === 'teacher') {
      const scopeKeys = await getTeacherScopeKeys({
        schoolId,
        campusId,
        teacherId: req.user?.id || null,
      });
      exams = exams.filter((exam) => canTeacherManageExam(scopeKeys, exam) && isExamCompleted(exam));
    }

    res.status(200).json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Students eligible for a specific exam scope (admin/teacher)
router.get("/results/exam-students", adminOrTeacherAuth, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId || req.admin?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const campusId = req.campusId || null;
    const examId = req.query?.examId ? String(req.query.examId) : '';
    if (!mongoose.isValidObjectId(examId)) {
      return res.status(400).json({ error: 'Valid examId is required' });
    }

    const exam = await Exam.findOne({ _id: examId, schoolId, ...(campusId ? { campusId } : {}) })
      .populate('classId', 'name academicYearId')
      .populate('sectionId', 'name classId')
      .populate('subjectId', 'name code classId')
      .lean();
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    if (req.userType === 'teacher') {
      const scopeKeys = await getTeacherScopeKeys({
        schoolId,
        campusId,
        teacherId: req.user?.id || null,
      });
      if (!canTeacherManageExam(scopeKeys, exam)) {
        return res.status(403).json({ error: 'You are not allocated for this exam' });
      }
      if (!isExamCompleted(exam)) {
        return res.status(400).json({ error: 'Teachers can upload marks only for completed exams' });
      }
    }

    const [students, existingResults] = await Promise.all([
      getScopedStudentsForExam({ schoolId, campusId, exam }),
      ExamResult.find({ schoolId, examId, ...(campusId ? { campusId } : {}) })
        .select('studentId marks grade remarks status published')
        .lean(),
    ]);

    const resultByStudentId = new Map(existingResults.map((result) => [String(result.studentId), result]));

    const payload = students
      .map((student) => {
        const existing = resultByStudentId.get(String(student._id)) || null;
        return {
          _id: student._id,
          name: student.name || '',
          grade: student.grade || '',
          section: student.section || '',
          roll: student.roll || null,
          studentCode: student.studentCode || '',
          hasResult: Boolean(existing),
          resultId: existing?._id || null,
          marks: existing?.marks ?? null,
          gradeValue: existing?.grade || '',
          status: existing?.status || null,
          published: Boolean(existing?.published),
        };
      })
      .sort((a, b) => {
        const rollA = Number(a.roll);
        const rollB = Number(b.roll);
        if (Number.isFinite(rollA) && Number.isFinite(rollB) && rollA !== rollB) return rollA - rollB;
        return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
      });

    res.status(200).json({
      exam: {
        _id: exam._id,
        title: exam.title || '',
        subject: exam.subject || exam.subjectId?.name || '',
        className: getExamClassName(exam),
        sectionName: getExamSectionName(exam),
        maxMarks: exam.marks ?? null,
      },
      students: payload,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin view of results with enriched student/exam info
router.get("/results/admin", adminAuth, async (req, res) => {
  // #swagger.tags = ['Exams']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;

    const { studentId, examId, grade, section, subject } = req.query || {};
    const filter = { schoolId };
    if (studentId) filter.studentId = studentId;
    if (examId) filter.examId = examId;

    const results = await ExamResult.find(filter)
      .populate({
        path: 'studentId',
        select: 'name grade section roll studentCode schoolId academicYear',
        populate: { path: 'schoolId', select: 'name code' },
      })
      .populate('examId', 'title subject date term grade section classId sectionId subjectId status')
      .sort({ createdAt: -1 })
      .lean();

    const filtered = results.filter((result) => {
      const matchesClass = grade ? result.studentId?.grade === grade : true;
      const matchesSection = section ? result.studentId?.section === section : true;
      const resultSubject = result.examId?.subject || result.examId?.title || null;
      const matchesSubject = subject
        ? resultSubject && resultSubject.toLowerCase() === subject.toLowerCase()
        : true;
      return matchesClass && matchesSection && matchesSubject;
    });

    res.json(filtered);
  } catch (err) {
    console.error('Admin results fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Student fetch their results
router.get("/results/me", authStudent, async (req, res) => {
  // #swagger.tags = ['Exams']
    try {
        const schoolId = req.schoolId || req.user?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
        const campusId = req.campusId || null;
        const studentId = req.user.id;

        const results = await ExamResult.find({
          schoolId,
          studentId,
          published: true,
          ...(campusId ? { campusId } : {}),
        })
            .populate('examId', 'title subject date term grade section classId sectionId subjectId groupId marks')
            .populate('studentId', 'name roll grade section academicYear studentCode admissionNumber username')
            .lean();

        // Enrich each result with rank, percentile, and pre/post delta in parallel
        const enriched = await Promise.all(results.map(async (result) => {
          const examId = result.examId?._id || result.examId;
          if (!examId) return result;

          // All published results for the same exam (for rank/percentile)
          const allForExam = await ExamResult.find({ examId, published: true, schoolId }).select('marks studentId').lean();
          const total = allForExam.length;
          const sortedDesc = [...allForExam].sort((a, b) => (b.marks || 0) - (a.marks || 0));
          const rankPos = sortedDesc.findIndex((r) => String(r.studentId) === String(studentId)) + 1;
          const rank = rankPos > 0 ? rankPos : null;
          const percentile = rank && total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : null;

          // Pre/post delta: previous result for same subject
          const subject = result.examId?.subject || '';
          const examDate = result.examId?.date ? new Date(result.examId.date) : null;
          let delta = null;
          if (subject && examDate) {
            const prevResult = await ExamResult.findOne({
              schoolId,
              studentId,
              published: true,
              _id: { $ne: result._id },
            })
              .populate('examId', 'subject date marks')
              .sort({ 'examId.date': -1 })
              .lean();

            if (prevResult?.examId?.subject === subject && prevResult.marks != null && result.marks != null) {
              const prevPct = result.examId?.marks ? Math.round((prevResult.marks / prevResult.examId.marks) * 100) : null;
              const currPct = result.examId?.marks ? Math.round((result.marks / result.examId.marks) * 100) : null;
              if (prevPct !== null && currPct !== null) delta = currPct - prevPct;
            }
          }

          return { ...result, rank, percentile, total, delta };
        }));

        res.json({ success: true, data: enriched });
        logStudentPortalEvent(req, {
            feature: 'results',
            action: 'exam_results.fetch',
            outcome: 'success',
            statusCode: 200,
            targetType: 'student',
            targetId: req.user?.id,
            resultCount: enriched.length,
        });
    } catch (err) {
        logStudentPortalError(req, {
            feature: 'results',
            action: 'exam_results.fetch',
            statusCode: 500,
            err,
            targetType: 'student',
            targetId: req.user?.id,
        });
        res.status(500).json({ error: err.message });
    }
});

// Bulk upload results via Excel (admin/teacher)
router.post("/results/bulk-upload", adminOrTeacherAuth, upload.single('file'), async (req, res) => {
    const filePath = req.file?.path;

    try {
        const schoolId = req.schoolId || req.user?.schoolId || req.admin?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
        const campusId = req.campusId || null;
        const isTeacherUser = req.userType === 'teacher';
        const teacherScopeKeys = isTeacherUser
          ? await getTeacherScopeKeys({
              schoolId,
              campusId,
              teacherId: req.user?.id || null,
            })
          : new Set();
        
        if (!filePath) {
            return res.status(400).json({ error: 'Excel file is required' });
        }

        const workbook = xlsx.readFile(filePath);
        const errors = [];
        let successCount = 0;
        let errorCount = 0;
        const uploadedExamMeta = new Map();

        for (const sheetName of workbook.SheetNames) {
            if (sheetName === 'ExamsData') continue; // Skip the data sheet

            const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

            for (let i = 0; i < sheetData.length; i++) {
                const row = sheetData[i];
                try {
                    const { studentId, examId, marks, remarks, status } = row;

                    if (!examId || !studentId) {
                        errors.push(`Sheet "${sheetName}", Row ${i + 2}: Missing examId or studentId`);
                        errorCount++;
                        continue;
                    }

                    const exam = await Exam.findById(examId).lean();
                    if (!exam || String(exam.schoolId) !== String(schoolId)) {
                        errors.push(`Sheet "${sheetName}", Row ${i + 2}: Exam not found`);
                        errorCount++;
                        continue;
                    }
                    if (campusId && exam.campusId && String(exam.campusId) !== String(campusId)) {
                        errors.push(`Sheet "${sheetName}", Row ${i + 2}: Exam does not belong to this campus`);
                        errorCount++;
                        continue;
                    }
                    if (isTeacherUser && !canTeacherManageExam(teacherScopeKeys, exam)) {
                        errors.push(`Sheet "${sheetName}", Row ${i + 2}: You are not allocated for this exam`);
                        errorCount++;
                        continue;
                    }
                    if (isTeacherUser && !isExamCompleted(exam)) {
                        errors.push(`Sheet "${sheetName}", Row ${i + 2}: Teachers can upload marks only for completed exams`);
                        errorCount++;
                        continue;
                    }

                    const student = await StudentUser.findById(studentId).lean();
                    if (!student || String(student.schoolId) !== String(schoolId)) {
                        errors.push(`Sheet "${sheetName}", Row ${i + 2}: Student not found`);
                        errorCount++;
                        continue;
                    }
                    if (campusId && student.campusId && String(student.campusId) !== String(campusId)) {
                        errors.push(`Sheet "${sheetName}", Row ${i + 2}: Student does not belong to this campus`);
                        errorCount++;
                        continue;
                    }

                    if (!studentMatchesExamScope(student, exam)) {
                        errors.push(`Sheet "${sheetName}", Row ${i + 2}: Student ${student.name} not in exam's class/section.`);
                        errorCount++;
                        continue;
                    }

                    const normalizedStatus = parseResultStatus(status);
                    if (!normalizedStatus) {
                        errors.push(`Sheet "${sheetName}", Row ${i + 2}: Invalid status value.`);
                        errorCount++;
                        continue;
                    }

                    const scoreResult = resolveResultScore({
                        marks,
                        status: normalizedStatus,
                        examMaxMarks: exam.marks,
                        requireMarks: normalizedStatus !== 'absent',
                    });

                    if (scoreResult.error) {
                        errors.push(`Sheet "${sheetName}", Row ${i + 2}: ${scoreResult.error}`);
                        errorCount++;
                        continue;
                    }

                    // Auto-calculate grade on backend
                    let calculatedGrade = row.grade || '';
                    if (exam.marks && scoreResult.score !== undefined) {
                        const percentage = (Number(scoreResult.score) / Number(exam.marks)) * 100;
                        if (percentage >= 90) calculatedGrade = 'A+';
                        else if (percentage >= 80) calculatedGrade = 'A';
                        else if (percentage >= 70) calculatedGrade = 'B';
                        else if (percentage >= 60) calculatedGrade = 'C';
                        else if (percentage >= 50) calculatedGrade = 'D';
                        else calculatedGrade = 'F';
                    }

                    // Auto-calculate pass/fail status based on marks (50% passing threshold)
                    if (exam.marks && scoreResult.score !== undefined && scoreResult.status !== 'absent') {
                        const percentage = (Number(scoreResult.score) / Number(exam.marks)) * 100;
                        scoreResult.status = percentage >= 50 ? 'pass' : 'fail';
                    }

                    // Auto-generate remarks based on final status
                    const finalRemarks = scoreResult.status === 'pass' ? 'Promoted'
                        : scoreResult.status === 'fail' ? 'Not Promoted'
                        : '';

                    await ExamResult.findOneAndUpdate(
                        { examId, studentId, schoolId, ...(campusId ? { campusId } : {}) },
                        {
                        schoolId,
                        campusId: campusId || null,
                        examId,
                        studentId,
                        marks: scoreResult.score,
                        grade: calculatedGrade,
                        remarks: finalRemarks,
                        status: scoreResult.status,
                        createdBy: req.user?.id || req.admin?.id || null,
                        },
                        { new: true, upsert: true, runValidators: true }
                    );

                    successCount++;
                    uploadedExamMeta.set(String(exam._id), exam);
                } catch (err) {
                    errors.push(`Sheet "${sheetName}", Row ${i + 2}: ${err.message}`);
                    errorCount++;
                }
            }
        }

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        if (isTeacherUser && successCount > 0) {
            const teacherId = req.user?.id || null;
            const teacherName = await getTeacherDisplayName(teacherId);
            const uploadedExams = Array.from(uploadedExamMeta.values());
            const representativeExam = uploadedExams[0] || null;
            await notifyAdminTeacherResultUpload({
                schoolId,
                campusId,
                teacherId,
                teacherName,
                exam: representativeExam,
                uploadedCount: successCount,
                multipleExams: uploadedExams.length > 1,
            });
        }

        res.status(200).json({
            success: true,
            count: successCount,
            errors: errorCount > 0 ? errors : undefined,
            message: `Successfully uploaded ${successCount} results${errorCount > 0 ? `, ${errorCount} failed` : ''}`
        });
    } catch (err) {
        // Clean up file on error
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        console.error('Bulk result upload error:', err);
        res.status(500).json({ error: 'An unexpected error occurred during file processing.' });
    }
});

// Bulk publish/unpublish results by IDs (must be before /:id to avoid route conflict)
router.put("/results/bulk-publish", adminAuth, async (req, res) => {
  // #swagger.tags = ['Exams']
    try {
        const { resultIds } = req.body;
        const published = Boolean(req.body?.published);

        if (!Array.isArray(resultIds) || resultIds.length === 0) {
            return res.status(400).json({ error: 'resultIds array is required' });
        }

        const schoolId = resolveSchoolId(req, res);
        if (!schoolId) return;
        const campusId = resolveCampusId(req);

        const filter = {
            _id: { $in: resultIds },
            schoolId,
            ...(campusId ? { campusId } : {})
        };

        const scopedResults = await ExamResult.find(filter)
          .select('_id examId')
          .populate('examId', 'status')
          .lean();

        if (!scopedResults.length) {
          return res.status(404).json({ error: 'No matching results found' });
        }

        let scopedIds = scopedResults.map((result) => result._id);
        let skippedCount = 0;
        if (published) {
          scopedIds = scopedResults
            .filter((result) => String(result?.examId?.status || '').toLowerCase() === 'completed')
            .map((result) => result._id);
          skippedCount = scopedResults.length - scopedIds.length;
          if (!scopedIds.length) {
            return res.status(400).json({ error: 'Only completed exam results can be published' });
          }
        }

        const updateData = {
            published,
            publishedAt: published ? new Date() : null
        };

        const updateResult = await ExamResult.updateMany(
          {
            _id: { $in: scopedIds },
            schoolId,
            ...(campusId ? { campusId } : {})
          },
          updateData
        );

        res.status(200).json({
            success: true,
            message: `${updateResult.modifiedCount} result(s) ${published ? 'published' : 'unpublished'} successfully${published && skippedCount ? ` (${skippedCount} skipped: exam not completed)` : ''}`,
            modifiedCount: updateResult.modifiedCount,
            skippedCount
        });
    } catch (err) {
        console.error('Bulk publish/unpublish results error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update individual result (admin/teacher)
router.put("/results/:id", adminOrTeacherAuth, async (req, res) => {
  // #swagger.tags = ['Exams']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid result id' });
    }

    const schoolId = req.schoolId || req.user?.schoolId || req.admin?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const campusId = req.campusId || null;

    const current = await ExamResult.findOne({
      _id: id,
      schoolId,
      ...(campusId ? { campusId } : {}),
    });

    if (!current) {
      return res.status(404).json({ error: 'Result not found' });
    }

    const { examId, studentId, marks, grade, remarks, status, published } = req.body || {};
    const targetExamId = examId || current.examId;
    const targetStudentId = studentId || current.studentId;

    if (!mongoose.isValidObjectId(targetExamId) || !mongoose.isValidObjectId(targetStudentId)) {
      return res.status(400).json({ error: 'Valid examId and studentId are required' });
    }

    const [exam, student] = await Promise.all([
      Exam.findOne({ _id: targetExamId, schoolId, ...(campusId ? { campusId } : {}) }).lean(),
      StudentUser.findOne({ _id: targetStudentId, schoolId, ...(campusId ? { campusId } : {}) }).lean(),
    ]);

    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (req.userType === 'teacher') {
      const scopeKeys = await getTeacherScopeKeys({
        schoolId,
        campusId,
        teacherId: req.user?.id || null,
      });
      if (!canTeacherManageExam(scopeKeys, exam)) {
        return res.status(403).json({ error: 'You are not allocated for this exam' });
      }
      if (!isExamCompleted(exam)) {
        return res.status(400).json({ error: 'Teachers can upload marks only for completed exams' });
      }
      if (published !== undefined) {
        return res.status(403).json({ error: 'Teachers cannot publish/unpublish results' });
      }
    }
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (!studentMatchesExamScope(student, exam)) {
      return res.status(400).json({ error: 'Student does not belong to exam class' });
    }

    const nextStatus = status !== undefined ? status : current.status;
    const scoreResult = resolveResultScore({
      marks: marks !== undefined ? marks : current.marks,
      status: nextStatus,
      examMaxMarks: exam?.marks,
      requireMarks: true,
    });
    if (scoreResult.error) {
      return res.status(400).json({ error: scoreResult.error });
    }

    const updates = {
      ...(examId ? { examId } : {}),
      ...(studentId ? { studentId } : {}),
      ...(grade !== undefined ? { grade } : {}),
      ...(remarks !== undefined ? { remarks } : {}),
      status: scoreResult.status,
      marks: scoreResult.score,
      ...(published !== undefined ? { published: Boolean(published), publishedAt: published ? new Date() : null } : {}),
      createdBy: req.user?.id || req.admin?.id || current.createdBy || null,
    };

    if (published === true && String(exam?.status || '').toLowerCase() !== 'completed') {
      return res.status(400).json({ error: 'Only completed exam results can be published' });
    }

    const duplicate = await ExamResult.findOne({
      _id: { $ne: id },
      schoolId,
      examId: updates.examId || current.examId,
      studentId: updates.studentId || current.studentId,
      ...(campusId ? { campusId } : {}),
    }).lean();

    if (duplicate) {
      return res.status(409).json({ error: 'A result already exists for this exam and student' });
    }

    const updated = await ExamResult.findOneAndUpdate(
      { _id: id, schoolId, ...(campusId ? { campusId } : {}) },
      updates,
      { new: true, runValidators: true }
    )
      .populate('studentId', 'name grade section roll academicYear')
      .populate('examId', 'title subject date term grade section classId sectionId subjectId')
      .lean();

    if (req.userType === 'teacher') {
      const teacherId = req.user?.id || null;
      const teacherName = await getTeacherDisplayName(teacherId);
      await notifyAdminTeacherResultUpload({
        schoolId,
        campusId,
        teacherId,
        teacherName,
        exam,
        uploadedCount: 1,
        multipleExams: false,
      });
    }

    // Recalculate mastery whenever a grade is entered/updated
    if (scoreResult.score != null && updated?.studentId && exam?.subject) {
      try {
        const { runWorkflowTriggers } = require('../services/masteryEngine');
        const MasteryScore = require('../models/MasteryScore');
        const pct = exam.marks ? Math.round((scoreResult.score / exam.marks) * 100) : scoreResult.score;
        const topicId = (exam.subject || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const sId = String(updated.studentId?._id || updated.studentId);
        const doc = await MasteryScore.findOneAndUpdate(
          { studentId: sId, subject: exam.subject, topicId },
          {
            $set:  { schoolId, topicTitle: exam.subject, lastUpdated: new Date() },
            $inc:  { attemptCount: 1 },
            $max:  { score: pct },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        runWorkflowTriggers({
          studentId: sId,
          schoolId,
          subject: exam.subject,
          topicId,
          topicTitle: exam.subject,
          chapterTitle: exam.title || '',
          score: Math.max(doc.score, pct),
          attemptCount: doc.attemptCount,
        });
      } catch (_) { /* non-critical */ }
    }

    res.status(200).json({ message: 'Result updated successfully', result: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete individual result (admin/teacher)
router.delete("/results/:id", adminOrTeacherAuth, async (req, res) => {
  // #swagger.tags = ['Exams']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid result id' });
    }

    const schoolId = req.schoolId || req.user?.schoolId || req.admin?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const campusId = req.campusId || null;

    const existing = await ExamResult.findOne({
      _id: id,
      schoolId,
      ...(campusId ? { campusId } : {}),
    }).populate('examId', 'classId sectionId subjectId').lean();

    if (!existing) {
      return res.status(404).json({ error: 'Result not found' });
    }

    if (req.userType === 'teacher') {
      const scopeKeys = await getTeacherScopeKeys({
        schoolId,
        campusId,
        teacherId: req.user?.id || null,
      });
      if (!canTeacherManageExam(scopeKeys, existing.examId)) {
        return res.status(403).json({ error: 'You are not allocated for this exam' });
      }
    }

    const deleted = await ExamResult.findOneAndDelete({
      _id: id,
      schoolId,
      ...(campusId ? { campusId } : {}),
    }).lean();

    res.status(200).json({ message: 'Result deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Publish results for a specific class/section
router.post("/results/publish", adminAuth, async (req, res) => {
  // #swagger.tags = ['Exams']
    try {
        const schoolId = resolveSchoolId(req, res);
        if (!schoolId) return;
        const campusId = resolveCampusId(req);

        const { grade, section } = req.body || {};
        if (!grade) {
            return res.status(400).json({ error: 'grade (class) is required' });
        }

        // Find all students in this class/section
        const studentFilter = { schoolId, grade, ...(campusId ? { campusId } : {}) };
        if (section) studentFilter.section = section;

        const students = await StudentUser.find(studentFilter).select('_id grade section').lean();

        if (students.length === 0) {
            return res.status(404).json({ error: 'No students found for this class/section' });
        }

        const studentIds = students.map(s => s._id);

        // Find all teachers who teach this class (teachers with same grade in subject or department field)
        // Note: This is a simplified approach. You might need to adjust based on your teacher-class assignment logic
        const teachers = await TeacherUser.find({ schoolId, ...(campusId ? { campusId } : {}) })
          .select('_id name email')
          .lean();

        // Find all parents of these students
        const parents = await ParentUser.find({
            schoolId,
            ...(campusId ? { campusId } : {}),
            childrenIds: { $in: studentIds }
        }).select('_id name email').lean();

        // Create notification using NotificationService
        const sectionText = section ? ` Section ${section}` : '';

        try {
            // Create notification for students
            await NotificationService.notifyResultPublished({
                schoolId,
                campusId: campusId || null,
                grade,
                section,
                createdBy: req.admin?.id || null
            });

            // Create notifications for teachers
            await Notification.create({
                schoolId,
                campusId: campusId || null,
                title: `Results Published - ${grade}${sectionText}`,
                message: `The examination results for ${grade}${sectionText} have been published.`,
                audience: 'Teacher',
                type: 'result',
                priority: 'high',
                category: 'academic',
                createdBy: req.admin?.id || null,
            });

            // Create notifications for parents
            await Notification.create({
                schoolId,
                campusId: campusId || null,
                title: `Results Published - ${grade}${sectionText}`,
                message: `The examination results for ${grade}${sectionText} have been published. Please check your child's results.`,
                audience: 'Parent',
                type: 'result',
                priority: 'high',
                category: 'academic',
                createdBy: req.admin?.id || null,
            });
        } catch (notifErr) {
            console.error('Failed to create result notifications:', notifErr);
            // Don't fail the entire request if notification fails
        }

        res.status(200).json({
            success: true,
            message: `Results published successfully for ${grade}${sectionText}`,
            studentsNotified: students.length,
            teachersNotified: teachers.length,
            parentsNotified: parents.length
        });
    } catch (err) {
        console.error('Publish results error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Publish/Unpublish individual result
router.put("/results/:id/publish", adminAuth, async (req, res) => {
  // #swagger.tags = ['Exams']
    try {
        const { id } = req.params;
        const published = Boolean(req.body?.published);

        const schoolId = resolveSchoolId(req, res);
        if (!schoolId) return;
        const campusId = resolveCampusId(req);

        const filter = {
            _id: id,
            schoolId,
            ...(campusId ? { campusId } : {})
        };

        const result = await ExamResult.findOne(filter).populate('examId', 'status');

        if (!result) {
            return res.status(404).json({ error: 'Result not found' });
        }
        if (published && String(result?.examId?.status || '').toLowerCase() !== 'completed') {
            return res.status(400).json({ error: 'Only completed exam results can be published' });
        }

        result.published = published;
        result.publishedAt = published ? new Date() : null;
        await result.save();

        // Non-blocking post-exam mastery re-assessment
        if (published) {
          const fullResult = await ExamResult.findById(result._id).populate('examId', 'subject marks').lean();
          if (fullResult?.examId?.subject && fullResult?.examId?.marks) {
            const axios = require('axios');
            const BACKEND_URL = `http://localhost:${process.env.PORT || 5000}`;
            axios.post(`${BACKEND_URL}/api/mastery/post-exam`, {
              studentId: String(fullResult.studentId),
              schoolId: String(fullResult.schoolId),
              subject: fullResult.examId.subject,
              marksScored: fullResult.marks,
              totalMarks: fullResult.examId.marks,
            }).catch(() => {});
          }
        }

        res.status(200).json({
            success: true,
            message: `Result ${published ? 'published' : 'unpublished'} successfully`,
            result
        });
    } catch (err) {
        console.error('Publish/unpublish result error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Teacher exam management (scoped by allocations)
router.get('/teacher/manage', teacherAuth, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }

    const scopeKeys = await getTeacherScopeKeys({ schoolId, campusId, teacherId });
    let exams = await Exam.find({ schoolId, ...(campusId ? { campusId } : {}) })
      .populate('classId', 'name academicYearId')
      .populate('sectionId', 'name classId')
      .populate('subjectId', 'name code classId')
      .sort({ date: -1, createdAt: -1 })
      .lean();
    exams = exams.filter((exam) => canTeacherManageExam(scopeKeys, exam));

    res.status(200).json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher invigilation routine (assigned by admin in exam subject modal)
router.get('/teacher/routine', teacherAuth, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }

    const teacher = await TeacherUser.findOne({
      _id: teacherId,
      schoolId,
      ...(campusId ? { campusId } : {}),
    })
      .select('name username employeeCode email')
      .lean();
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherIdentitySet = buildTeacherIdentitySet(teacher);
    let exams = await Exam.find({ schoolId, ...(campusId ? { campusId } : {}) })
      .populate('classId', 'name')
      .populate('sectionId', 'name classId')
      .populate('subjectId', 'name code classId')
      .populate({
        path: 'roomId',
        select: 'roomNumber floorId',
        populate: {
          path: 'floorId',
          select: 'name floorCode buildingId',
          populate: { path: 'buildingId', select: 'name code' },
        },
      })
      .sort({ date: 1, time: 1, createdAt: 1 })
      .lean();

    exams = exams.filter((exam) => isTeacherAssignedInvigilator(exam, teacherIdentitySet));
    res.status(200).json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load teacher routine' });
  }
});

router.post('/teacher/add', teacherAuth, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }

    const {
      title,
      term,
      instructor,
      venue,
      date,
      time,
      duration,
      marks,
      noOfStudents,
      status,
      classId,
      sectionId,
      subjectId,
      published,
    } = req.body || {};

    const academicContext = await resolveAcademicContext({ schoolId, campusId, classId, sectionId, subjectId });
    if (academicContext.error) {
      return res.status(400).json({ error: academicContext.error });
    }
    const { classDoc, sectionDoc, subjectDoc } = academicContext;

    const scopeKeys = await getTeacherScopeKeys({ schoolId, campusId, teacherId });
    if (!canTeacherManageExam(scopeKeys, { classId: classDoc._id, sectionId: sectionDoc._id, subjectId: subjectDoc._id })) {
      return res.status(403).json({ error: 'You are not allocated for this class/section/subject' });
    }
    const computedStudentCount = await resolveExamStudentCount({
      schoolId,
      campusId,
      exam: { classId: classDoc, sectionId: sectionDoc, grade: classDoc.name, section: sectionDoc.name },
    });

    const exam = await Exam.create({
      schoolId,
      campusId: campusId || null,
      title,
      subject: subjectDoc.name,
      term: term || 'Term 1',
      instructor,
      venue,
      date,
      time,
      duration,
      marks,
      noOfStudents:
        noOfStudents === undefined || noOfStudents === null || String(noOfStudents).trim() === ''
          ? computedStudentCount
          : Number(noOfStudents),
      status,
      classId: classDoc._id,
      sectionId: sectionDoc._id,
      subjectId: subjectDoc._id,
      grade: classDoc.name || '',
      section: sectionDoc.name || '',
      published: Boolean(published),
      publishedAt: published ? new Date() : null,
    });

    res.status(201).json({ message: 'Exam added successfully', exam });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/teacher/:id', teacherAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid exam id' });
    }

    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }

    const existingExam = await Exam.findOne({ _id: id, schoolId, ...(campusId ? { campusId } : {}) }).lean();
    if (!existingExam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const scopeKeys = await getTeacherScopeKeys({ schoolId, campusId, teacherId });
    if (!canTeacherManageExam(scopeKeys, existingExam)) {
      return res.status(403).json({ error: 'You are not allocated for this exam' });
    }

    const {
      title,
      term,
      instructor,
      venue,
      date,
      time,
      duration,
      marks,
      noOfStudents,
      status,
      classId,
      sectionId,
      subjectId,
      published,
    } = req.body || {};

    let academicUpdates = {};
    let nextClassDoc = null;
    let nextSectionDoc = null;
    if (classId !== undefined || sectionId !== undefined || subjectId !== undefined) {
      const academicContext = await resolveAcademicContext({
        schoolId,
        campusId,
        classId: classId || existingExam.classId,
        sectionId: sectionId || existingExam.sectionId,
        subjectId: subjectId || existingExam.subjectId,
      });
      if (academicContext.error) {
        return res.status(400).json({ error: academicContext.error });
      }

      const { classDoc, sectionDoc, subjectDoc } = academicContext;
      if (!canTeacherManageExam(scopeKeys, { classId: classDoc._id, sectionId: sectionDoc._id, subjectId: subjectDoc._id })) {
        return res.status(403).json({ error: 'You are not allocated for the updated class/section/subject' });
      }
      nextClassDoc = classDoc;
      nextSectionDoc = sectionDoc;

      academicUpdates = {
        classId: classDoc._id,
        sectionId: sectionDoc._id,
        subjectId: subjectDoc._id,
        grade: classDoc.name || '',
        section: sectionDoc.name || '',
        subject: subjectDoc.name || '',
      };
    }

    let resolvedNoOfStudents = noOfStudents;
    if (resolvedNoOfStudents === undefined && (academicUpdates.classId || academicUpdates.sectionId)) {
      const className = nextClassDoc?.name || existingExam.grade || '';
      const sectionName = nextSectionDoc?.name || existingExam.section || '';
      resolvedNoOfStudents = await resolveExamStudentCount({
        schoolId,
        campusId,
        exam: {
          classId: nextClassDoc?._id || existingExam.classId,
          sectionId: nextSectionDoc?._id || existingExam.sectionId,
          grade: className,
          section: sectionName,
        },
      });
    }

    const updates = {
      ...(title !== undefined ? { title } : {}),
      ...(term !== undefined ? { term } : {}),
      ...(instructor !== undefined ? { instructor } : {}),
      ...(venue !== undefined ? { venue } : {}),
      ...(date !== undefined ? { date } : {}),
      ...(time !== undefined ? { time } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(marks !== undefined ? { marks } : {}),
      ...(resolvedNoOfStudents !== undefined ? { noOfStudents: Number(resolvedNoOfStudents) } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(published !== undefined ? { published: Boolean(published), publishedAt: published ? new Date() : null } : {}),
      ...academicUpdates,
    };

    const exam = await Exam.findOneAndUpdate(
      { _id: id, schoolId, ...(campusId ? { campusId } : {}) },
      updates,
      { new: true, runValidators: true }
    )
      .populate('classId', 'name')
      .populate('sectionId', 'name classId')
      .populate('subjectId', 'name code classId')
      .lean();

    res.status(200).json({ message: 'Exam updated successfully', exam });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/teacher/:id', teacherAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid exam id' });
    }

    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }

    const scopeKeys = await getTeacherScopeKeys({ schoolId, campusId, teacherId });
    const exam = await Exam.findOne({
      _id: id,
      schoolId,
      ...(campusId ? { campusId } : {}),
    }).lean();

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    if (!canTeacherManageExam(scopeKeys, exam)) {
      return res.status(403).json({ error: 'You are not allocated for this exam' });
    }

    await Promise.all([
      Exam.deleteOne({ _id: id, schoolId, ...(campusId ? { campusId } : {}) }),
      ExamResult.deleteMany({ examId: id, schoolId, ...(campusId ? { campusId } : {}) }),
    ]);

    res.status(200).json({ message: 'Exam and linked results deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/exam/teacher/:examId/auto-grade ─────────────────────────────────
// Submit student MCQ answer sheet and auto-grade against exam's stored correct answers
router.post('/teacher/:examId/auto-grade', teacherAuth, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    const { examId } = req.params;
    if (!mongoose.isValidObjectId(examId)) return res.status(400).json({ error: 'Invalid examId' });

    const exam = await Exam.findOne({ _id: examId, schoolId, ...(campusId ? { campusId } : {}) }).lean();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.examType !== 'mcq') return res.status(400).json({ error: 'This exam is not MCQ type' });
    if (!exam.questions?.length) return res.status(400).json({ error: 'Exam has no questions stored' });

    const scopeKeys = await getTeacherScopeKeys({ schoolId, campusId, teacherId });
    if (!canTeacherManageExam(scopeKeys, exam)) return res.status(403).json({ error: 'Not allocated for this exam' });

    // answers: [{ studentId, responses: [{ questionIndex, selectedOptionIndex }] }]
    const { answers } = req.body || {};
    if (!Array.isArray(answers) || !answers.length) return res.status(400).json({ error: 'answers array is required' });

    const maxMarksPerQ = exam.questions.map((q) => q.marks || 1);
    const totalMax = maxMarksPerQ.reduce((a, b) => a + b, 0);

    const results = await Promise.all(answers.map(async ({ studentId, responses }) => {
      if (!mongoose.isValidObjectId(studentId)) return { studentId, error: 'Invalid studentId' };
      let scored = 0;
      (responses || []).forEach(({ questionIndex, selectedOptionIndex }) => {
        const q = exam.questions[questionIndex];
        if (!q) return;
        const chosen = q.options[selectedOptionIndex];
        if (chosen?.isCorrect) scored += (q.marks || 1);
      });
      const pct = Math.round((scored / totalMax) * 100);
      const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';
      const status = pct >= 35 ? 'pass' : 'fail';

      const existing = await ExamResult.findOne({ examId, studentId, schoolId });
      if (existing) {
        existing.marks = scored;
        existing.grade = grade;
        existing.status = status;
        existing.remarks = `Auto-graded MCQ (${scored}/${totalMax})`;
        await existing.save();
        return { studentId, marks: scored, grade, status, updated: true };
      }
      await ExamResult.create({ examId, studentId, schoolId, campusId: campusId || null, marks: scored, grade, status, remarks: `Auto-graded MCQ (${scored}/${totalMax})`, published: false });
      return { studentId, marks: scored, grade, status, created: true };
    }));

    return res.json({ success: true, data: results, totalMax });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/exam/ai-grade-essay — AI scores an essay against a rubric ────────
// Body: { essayText, rubric: [{ criterion, maxMarks }], subject, context }
// Returns: { scores: [{criterion, marks, feedback}], total, suggestion }
router.post('/ai-grade-essay', adminOrTeacherAuth, async (req, res) => {
  try {
    const { essayText, rubric = [], subject = '', context = '' } = req.body || {};
    if (!essayText) return res.status(400).json({ error: 'essayText is required' });
    if (!rubric.length) return res.status(400).json({ error: 'rubric with at least one criterion is required' });

    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const rubricText = rubric.map((r, i) => `${i + 1}. ${r.criterion} (max ${r.maxMarks} marks)`).join('\n');
    const totalMax = rubric.reduce((s, r) => s + (r.maxMarks || 0), 0);

    const prompt = `You are grading a student essay for ${subject || 'a subject'}.

RUBRIC:
${rubricText}
Total: ${totalMax} marks

STUDENT ESSAY:
${essayText.slice(0, 2000)}

For each rubric criterion, provide:
- marks awarded (as a number)
- brief feedback (1 sentence)

Format your response strictly as JSON:
{
  "scores": [
    { "criterion": "...", "marks": 0, "feedback": "..." }
  ],
  "overallFeedback": "..."
}`;

    const axios = require('axios');
    const aiResp = await axios.post(`${AI_SERVICE_URL}/generate/teacher`, {
      prompt,
      mode: 'exit_ticket_grade',
      subject,
      context,
    }, { timeout: 60000 });

    const raw = aiResp.data?.response || aiResp.data?.content || '';

    // Parse JSON from AI response
    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] || '{}');
    } catch (_) {
      // Fallback: return raw text if JSON parse fails
      return res.json({ success: true, data: { raw, scores: [], totalMax } });
    }

    const scores = (parsed.scores || []).map((s, i) => ({
      criterion: s.criterion || rubric[i]?.criterion || `Criterion ${i + 1}`,
      marks: Math.min(Math.max(0, Number(s.marks) || 0), rubric[i]?.maxMarks || 0),
      feedback: s.feedback || '',
      maxMarks: rubric[i]?.maxMarks || 0,
    }));

    const total = scores.reduce((s, r) => s + r.marks, 0);

    return res.json({
      success: true,
      data: { scores, total, totalMax, overallFeedback: parsed.overallFeedback || '', suggestion: `AI suggestion: ${total}/${totalMax}. Teacher can override.` },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
