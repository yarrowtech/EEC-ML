const express = require('express');
const mongoose = require('mongoose');
const authStudent = require('../middleware/authStudent');
const authTeacher = require('../middleware/authTeacher');
const authParent = require('../middleware/authParent');

const ExcuseLetter = require('../models/ExcuseLetter');
const StudentUser = require('../models/StudentUser');
const Notification = require('../models/Notification');
const TeacherUser = require('../models/TeacherUser');

// Saving a Notification pushes it to devices and pings open tabs over Socket.IO
// (see models/Notification.js), so these alerts arrive instantly.
const letterDates = (letter) => {
  const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const from = fmt(letter.dateFrom);
  const to = fmt(letter.dateTo);
  return from === to ? from : `${from} – ${to}`;
};
const letterClass = (letter) => `Class ${letter.className || ''}${letter.sectionName ? `-${letter.sectionName}` : ''}`;

// New letter → its class teacher(s).
const notifyClassTeachersOfLetter = async (letter, submittedBy) => {
  try {
    const teachers = await TeacherAllocation.find({
      schoolId: letter.schoolId,
      classId: letter.classId,
      sectionId: letter.sectionId,
      isClassTeacher: true,
    }).select('teacherId').lean();
    const teacherIds = [...new Set(teachers.map((t) => String(t.teacherId)).filter(Boolean))];
    if (!teacherIds.length) return;
    await Notification.create({
      schoolId: letter.schoolId,
      campusId: null,
      title: 'New excuse letter',
      message: `${letter.studentName} (${letterClass(letter)}) requested leave for ${letterDates(letter)}. Sent by ${submittedBy}.`,
      audience: 'Teacher',
      targetUserIds: teacherIds,
      createdByType: submittedBy === 'Parent' ? 'parent' : 'student',
      type: 'alert',
      typeLabel: 'excuse_letter',
      category: 'general',
      priority: 'high',
      className: letter.className || '',
      sectionName: letter.sectionName || '',
      relatedEntity: { entityType: 'leave', entityId: letter._id },
    });
  } catch (err) {
    console.error('Excuse letter teacher notification failed:', err.message);
  }
};

// Student wrote a letter → their parent(s) must approve it first.
const notifyParentsOfStudentLetter = async (letter) => {
  try {
    const parents = await ParentUser.find({ schoolId: letter.schoolId, childrenIds: letter.studentId }).select('_id').lean();
    if (!parents.length) return;
    await Notification.create({
      schoolId: letter.schoolId,
      campusId: null,
      title: 'Excuse letter needs your approval',
      message: `${letter.studentName} wrote a leave request for ${letterDates(letter)}. Approve it to send it to the class teacher.`,
      audience: 'Parent',
      targetUserIds: parents.map((p) => p._id),
      createdByType: 'student',
      type: 'alert',
      typeLabel: 'excuse_letter',
      category: 'general',
      priority: 'high',
      className: letter.className || '',
      sectionName: letter.sectionName || '',
      relatedEntity: { entityType: 'leave', entityId: letter._id },
    });
  } catch (err) {
    console.error('Excuse letter parent notification failed:', err.message);
  }
};

// Parent turned down their child's letter → tell the student.
const notifyStudentOfParentRejection = async (letter) => {
  try {
    await Notification.create({
      schoolId: letter.schoolId,
      campusId: null,
      title: 'Excuse letter not approved',
      message: `Your parent did not approve your leave request for ${letterDates(letter)}${letter.parentReview?.note ? `: "${letter.parentReview.note}"` : '.'}`,
      audience: 'Student',
      targetUserIds: [letter.studentId],
      createdByType: 'parent',
      type: 'alert',
      typeLabel: 'excuse_letter_reviewed',
      category: 'general',
      priority: 'high',
      relatedEntity: { entityType: 'leave', entityId: letter._id },
    });
  } catch (err) {
    console.error('Excuse letter student notification failed:', err.message);
  }
};

// Decision → the student and their parent(s).
const notifyLetterDecision = async (letter, teacherId) => {
  try {
    const [teacher, parents] = await Promise.all([
      TeacherUser.findById(teacherId).select('name').lean(),
      ParentUser.find({ schoolId: letter.schoolId, childrenIds: letter.studentId }).select('_id').lean(),
    ]);
    const decision = letter.status === 'approved' ? 'approved' : 'rejected';
    const by = teacher?.name ? ` by ${teacher.name}` : '';
    const common = {
      schoolId: letter.schoolId,
      campusId: null,
      title: `Excuse letter ${decision}`,
      createdByType: 'teacher',
      createdByTeacherId: teacherId,
      createdByName: teacher?.name || '',
      type: 'alert',
      typeLabel: 'excuse_letter_reviewed',
      category: 'general',
      priority: 'high',
      className: letter.className || '',
      sectionName: letter.sectionName || '',
      relatedEntity: { entityType: 'leave', entityId: letter._id },
    };
    const docs = [{
      ...common,
      audience: 'Student',
      targetUserIds: [letter.studentId],
      message: `Your leave request for ${letterDates(letter)} was ${decision}${by}.`,
    }];
    if (parents.length) {
      docs.push({
        ...common,
        audience: 'Parent',
        targetUserIds: parents.map((p) => p._id),
        message: `The leave request for ${letter.studentName} (${letterDates(letter)}) was ${decision}${by}.`,
      });
    }
    await Notification.insertMany(docs);
  } catch (err) {
    console.error('Excuse letter decision notification failed:', err.message);
  }
};
const ParentUser = require('../models/ParentUser');
const TeacherAllocation = require('../models/TeacherAllocation');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const School = require('../models/School');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

const router = express.Router();
const { parentAttendanceCache } = require('../utils/responseCache');
// Any write here clears the parent attendance screen's response cache.
router.use(parentAttendanceCache.invalidateOnWrite);

const resolveClassCandidates = (raw) => {
  const value = String(raw || '').trim();
  const set = new Set();
  if (!value) return [];
  set.add(value);
  if (/^\d+$/i.test(value)) set.add(`Class ${value}`);
  if (/^class\s+/i.test(value)) set.add(value.replace(/^class\s+/i, '').trim());
  return Array.from(set);
};

const buildSchoolMeta = async (schoolId) => {
  if (!schoolId) return { schoolName: '', schoolAddress: '' };
  const school = await School.findById(schoolId).select('name address').lean();
  return {
    schoolName: school?.name || '',
    schoolAddress: school?.address || '',
  };
};

// Student: list own letters
router.get('/student', authStudent, async (req, res) => {
  try {
    logStudentPortalEvent(req, {
      feature: 'excuse_letter',
      action: 'excuse_letters.fetch',
      targetType: 'student',
      targetId: req.user?.id,
    });
    const schoolId = req.schoolId;
    const campusId = req.campusId || null;
    const studentId = req.user?.id;
    if (!schoolId || !studentId) return res.status(400).json({ error: 'schoolId and studentId are required' });

    const items = await ExcuseLetter.find({
      schoolId,
      ...(campusId ? { campusId } : {}),
      studentId,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(items);
    logStudentPortalEvent(req, {
      feature: 'excuse_letter',
      action: 'excuse_letters.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: studentId,
      resultCount: items.length,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'excuse_letter',
      action: 'excuse_letters.fetch',
      statusCode: 400,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(400).json({ error: err.message });
  }
});

// Student: create letter
router.post('/student', authStudent, async (req, res) => {
  try {
    logStudentPortalEvent(req, {
      feature: 'excuse_letter',
      action: 'excuse_letter.create',
      targetType: 'student',
      targetId: req.user?.id,
      reasonType: req.body?.reasonType || undefined,
    });
    const schoolId = req.schoolId;
    const campusId = req.campusId || null;
    const studentId = req.user?.id;
    if (!schoolId || !studentId) return res.status(400).json({ error: 'schoolId and studentId are required' });

    const { dateFrom, dateTo, reason, reasonType, customReasonType, additionalNotes, emergencyContact } = req.body || {};
    if (!dateFrom || !dateTo || !reason) {
      return res.status(400).json({ error: 'dateFrom, dateTo and reason are required' });
    }

    const student = await StudentUser.findById(studentId).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const classCandidates = resolveClassCandidates(student.grade);
    const classDoc = classCandidates.length
      ? await ClassModel.findOne({
          schoolId,
          ...(campusId ? { campusId } : {}),
          name: { $in: classCandidates },
        }).select('_id name').lean()
      : null;
    if (!classDoc) return res.status(400).json({ error: 'Class not found for student' });

    const sectionName = String(student.section || '').trim();
    const sectionDoc = sectionName
      ? await Section.findOne({
          schoolId,
          ...(campusId ? { campusId } : {}),
          classId: classDoc._id,
          name: sectionName,
        }).select('_id name').lean()
      : null;
    if (!sectionDoc) return res.status(400).json({ error: 'Section not found for student' });

    const parentName = student.guardianName || student.fatherName || student.motherName || '';
    const parentPhone = student.guardianPhone || student.fatherPhone || student.motherPhone || '';
    const parentEmail = student.guardianEmail || student.email || '';

    const created = await ExcuseLetter.create({
      schoolId,
      campusId,
      studentId,
      studentName: student.name || 'Student',
      rollNumber: student.roll ? String(student.roll) : '',
      classId: classDoc._id,
      sectionId: sectionDoc._id,
      className: classDoc.name || '',
      sectionName: sectionDoc.name || '',
      parentName,
      parentEmail,
      parentPhone,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      reason: String(reason).trim(),
      reasonType: String(reasonType || 'other'),
      customReasonType: String(reasonType || 'other') === 'other' ? String(customReasonType || '').trim().slice(0, 60) : '',
      additionalNotes: String(additionalNotes || ''),
      emergencyContact: String(emergencyContact || ''),
      // Students can't reach the class teacher directly: a parent approves first.
      status: 'awaiting_parent',
      submittedBy: 'student',
      parentReview: { status: 'pending' },
    });

    notifyParentsOfStudentLetter(created);
    res.status(201).json(created);
    logStudentPortalEvent(req, {
      feature: 'excuse_letter',
      action: 'excuse_letter.create',
      outcome: 'success',
      statusCode: 201,
      targetType: 'excuse_letter',
      targetId: created._id,
      reasonType: created.reasonType,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'excuse_letter',
      action: 'excuse_letter.create',
      statusCode: 400,
      err,
      targetType: 'student',
      targetId: req.user?.id,
      reasonType: req.body?.reasonType || undefined,
    });
    res.status(400).json({ error: err.message });
  }
});

// Student: edit / delete their own letter — only while it still waits for the parent.
const findEditableStudentLetter = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) { res.status(400).json({ error: 'Invalid id' }); return null; }
  const letter = await ExcuseLetter.findOne({ _id: id, studentId: req.user?.id }).lean();
  if (!letter) { res.status(404).json({ error: 'Not found' }); return null; }
  if (letter.status !== 'awaiting_parent') {
    res.status(409).json({ error: 'This letter has already been reviewed and can no longer be changed' });
    return null;
  }
  return letter;
};

router.put('/student/:id', authStudent, async (req, res) => {
  try {
    const letter = await findEditableStudentLetter(req, res);
    if (!letter) return undefined;
    const { dateFrom, dateTo, reason, reasonType, customReasonType, additionalNotes } = req.body || {};
    if (!dateFrom || !dateTo || !String(reason || '').trim()) {
      return res.status(400).json({ error: 'dateFrom, dateTo and reason are required' });
    }
    if (new Date(dateTo) < new Date(dateFrom)) return res.status(400).json({ error: 'The end date cannot be before the start date' });
    const updated = await ExcuseLetter.findOneAndUpdate(
      { _id: letter._id, status: 'awaiting_parent' },
      { $set: {
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
        reason: String(reason).trim(),
        reasonType: String(reasonType || 'other'),
        customReasonType: String(reasonType || 'other') === 'other' ? String(customReasonType || '').trim().slice(0, 60) : '',
        additionalNotes: String(additionalNotes || ''),
      } },
      { new: true }
    ).lean();
    if (!updated) return res.status(409).json({ error: 'This letter has already been reviewed and can no longer be changed' });
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/student/:id', authStudent, async (req, res) => {
  try {
    const letter = await findEditableStudentLetter(req, res);
    if (!letter) return undefined;
    await ExcuseLetter.deleteOne({ _id: letter._id, status: 'awaiting_parent' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Parent: list letters submitted by the authenticated parent's linked children.
router.get('/parent', authParent, parentAttendanceCache.cache, async (req, res) => {
  try {
    const parent = await ParentUser.findById(req.user.id)
      .select('schoolId campusId childrenIds children')
      .lean();
    if (!parent) return res.status(404).json({ error: 'Parent not found' });

    const schoolId = parent.schoolId || req.schoolId || null;
    const campusId = parent.campusId || req.campusId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const studentFilter = {
      schoolId,
      ...(campusId ? { campusId } : {}),
    };

    let students = [];
    if (Array.isArray(parent.childrenIds) && parent.childrenIds.length > 0) {
      students = await StudentUser.find({
        ...studentFilter,
        _id: { $in: parent.childrenIds },
      })
        .select('_id')
        .lean();
    }

    // Preserve support for older parent records that only stored child names.
    if (students.length === 0 && Array.isArray(parent.children) && parent.children.length > 0) {
      const childNames = parent.children
        .map((name) => String(name || '').trim())
        .filter(Boolean);
      if (childNames.length > 0) {
        students = await StudentUser.find({
          ...studentFilter,
          name: { $in: childNames },
        })
          .select('_id')
          .lean();
      }
    }

    const studentIds = students.map((student) => student._id).filter(Boolean);
    if (studentIds.length === 0) return res.json([]);

    const items = await ExcuseLetter.find({
      schoolId,
      ...(campusId ? { campusId } : {}),
      studentId: { $in: studentIds },
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(items);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Parent: submit an excuse letter to the student's class teacher.
router.post('/parent', authParent, async (req, res) => {
  try {
    const parent = await ParentUser.findById(req.user.id).select('schoolId campusId childrenIds children name username email mobile').lean();
    if (!parent) return res.status(404).json({ error: 'Parent not found' });
    const schoolId = parent.schoolId || req.schoolId || null;
    const campusId = parent.campusId || req.campusId || null;
    const { studentId, dateFrom, dateTo, reason, reasonType, customReasonType, additionalNotes, emergencyContact } = req.body || {};
    if (!schoolId || !studentId || !dateFrom || !dateTo || !String(reason || '').trim()) {
      return res.status(400).json({ error: 'studentId, dateFrom, dateTo and reason are required' });
    }
    const childIdList = Array.isArray(parent.childrenIds) ? parent.childrenIds.map(String) : [];
    let student = await StudentUser.findOne({
      _id: studentId,
      schoolId,
      ...(campusId ? { campusId } : {}),
      ...(childIdList.length ? { _id: { $in: childIdList } } : {}),
    }).lean();
    if (!student && Array.isArray(parent.children) && parent.children.length) {
      const names = parent.children.map((name) => String(name || '').trim()).filter(Boolean);
      if (names.length) {
        const namedChild = await StudentUser.findOne({ _id: studentId, schoolId, ...(campusId ? { campusId } : {}), name: { $in: names } }).lean();
        if (namedChild) student = namedChild;
      }
    }
    if (!student) return res.status(403).json({ error: 'Student is not linked to this parent account' });
    const classCandidates = resolveClassCandidates(student.grade);
    const classDoc = await ClassModel.findOne({ schoolId, ...(campusId ? { campusId } : {}), name: { $in: classCandidates } }).select('_id name').lean();
    const sectionDoc = classDoc && student.section
      ? await Section.findOne({ schoolId, ...(campusId ? { campusId } : {}), classId: classDoc._id, name: String(student.section).trim() }).select('_id name').lean()
      : null;
    if (!classDoc || !sectionDoc) return res.status(400).json({ error: 'Class or section not found for student' });
    const created = await ExcuseLetter.create({
      schoolId, campusId, studentId: student._id, studentName: student.name || 'Student',
      rollNumber: student.roll ? String(student.roll) : '', classId: classDoc._id, sectionId: sectionDoc._id,
      className: classDoc.name || '', sectionName: sectionDoc.name || '',
      parentName: parent.name || parent.username || '', parentEmail: parent.email || '', parentPhone: parent.mobile || '',
      dateFrom: new Date(dateFrom), dateTo: new Date(dateTo), reason: String(reason).trim(),
      reasonType: String(reasonType || 'other'),
      customReasonType: String(reasonType || 'other') === 'other' ? String(customReasonType || '').trim().slice(0, 60) : '',
      additionalNotes: String(additionalNotes || ''), emergencyContact: String(emergencyContact || ''), status: 'pending',
      submittedBy: 'parent',
    });
    notifyClassTeachersOfLetter(created, 'Parent');
    return res.status(201).json(created);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Parent: approve (→ class teacher) or reject a letter their child wrote.
router.patch('/parent/:id/review', authParent, async (req, res) => {
  try {
    const { id } = req.params;
    const decision = String(req.body?.decision || '');
    const note = String(req.body?.note || '').trim().slice(0, 300);
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
    if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'decision must be approve or reject' });

    const parent = await ParentUser.findById(req.user.id).select('schoolId childrenIds name username').lean();
    if (!parent) return res.status(404).json({ error: 'Parent not found' });
    const letter = await ExcuseLetter.findById(id).lean();
    if (!letter) return res.status(404).json({ error: 'Not found' });
    const childIds = (parent.childrenIds || []).map(String);
    if (!childIds.includes(String(letter.studentId))) return res.status(403).json({ error: 'This letter is not from your child' });
    if (letter.status !== 'awaiting_parent') return res.status(409).json({ error: 'This letter has already been reviewed' });

    const approved = decision === 'approve';
    const updated = await ExcuseLetter.findOneAndUpdate(
      { _id: id, status: 'awaiting_parent' },
      {
        $set: {
          status: approved ? 'pending' : 'rejected',
          parentReview: {
            status: approved ? 'approved' : 'rejected',
            parentId: parent._id,
            parentName: parent.name || parent.username || '',
            note,
            reviewedAt: new Date(),
          },
        },
      },
      { new: true }
    ).lean();
    if (!updated) return res.status(409).json({ error: 'This letter has already been reviewed' });

    if (approved) notifyClassTeachersOfLetter(updated, 'Student (approved by parent)');
    else notifyStudentOfParentRejection(updated);
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Teacher: list letters for their class sections (class teacher only)
router.get('/teacher', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const campusId = req.campusId || null;
    const teacherId = req.user?.id;
    if (!schoolId || !teacherId) return res.status(400).json({ error: 'schoolId and teacherId are required' });

    const allocations = await TeacherAllocation.find({
      schoolId,
      ...(campusId ? { campusId } : {}),
      teacherId,
      isClassTeacher: true,
    }).select('classId sectionId').lean();

    if (!allocations.length) return res.json([]);

    const pairs = allocations.map((a) => ({
      classId: a.classId,
      sectionId: a.sectionId,
    }));

    const items = await ExcuseLetter.find({
      schoolId,
      ...(campusId ? { campusId } : {}),
      $or: pairs,
      // Letters still waiting on (or turned down by) the parent never reach the teacher.
      status: { $ne: 'awaiting_parent' },
      'parentReview.status': { $ne: 'rejected' },
    })
      .sort({ createdAt: -1 })
      .lean();
    const studentIds = [...new Set(items.map((item) => String(item.studentId || '')).filter(Boolean))];
    const [schoolMeta, students] = await Promise.all([
      buildSchoolMeta(schoolId),
      studentIds.length ? StudentUser.find({ _id: { $in: studentIds } }).select('_id profilePic').lean() : [],
    ]);
    const photoByStudent = new Map(students.map((student) => [String(student._id), student.profilePic || '']));
    const enriched = items.map((item) => ({
      ...item,
      studentPhoto: photoByStudent.get(String(item.studentId)) || '',
      schoolName: item.schoolName || schoolMeta.schoolName || '',
      schoolAddress: item.schoolAddress || schoolMeta.schoolAddress || '',
    }));
    res.json(enriched);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Teacher: approve/reject
router.patch('/teacher/:id', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const campusId = req.campusId || null;
    const teacherId = req.user?.id;
    const { id } = req.params;
    const { status } = req.body || {};
    if (!schoolId || !teacherId) return res.status(400).json({ error: 'schoolId and teacherId are required' });
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or rejected' });
    }

    const allocations = await TeacherAllocation.find({
      schoolId,
      ...(campusId ? { campusId } : {}),
      teacherId,
      isClassTeacher: true,
    }).select('classId sectionId').lean();
    if (!allocations.length) return res.status(403).json({ error: 'Not a class teacher' });

    const letter = await ExcuseLetter.findOne({
      _id: id,
      schoolId,
      ...(campusId ? { campusId } : {}),
    }).lean();
    if (!letter) return res.status(404).json({ error: 'Not found' });

    const allowed = allocations.some(
      (a) => String(a.classId) === String(letter.classId) && String(a.sectionId) === String(letter.sectionId)
    );
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    if (letter.status === 'awaiting_parent' || letter.parentReview?.status === 'rejected') {
      return res.status(409).json({ error: 'This letter has not been approved by the parent' });
    }

    const updated = await ExcuseLetter.findByIdAndUpdate(
      id,
      { $set: { status, reviewedBy: teacherId, reviewedAt: new Date() } },
      { new: true }
    ).lean();
    if (updated) notifyLetterDecision(updated, teacherId);

    const schoolMeta = await buildSchoolMeta(schoolId);
    res.json({
      ...updated,
      schoolName: updated?.schoolName || schoolMeta.schoolName || '',
      schoolAddress: updated?.schoolAddress || schoolMeta.schoolAddress || '',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
