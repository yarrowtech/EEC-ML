const express = require('express');
const mongoose = require('mongoose');
const authStudent = require('../middleware/authStudent');
const authTeacher = require('../middleware/authTeacher');
const authParent = require('../middleware/authParent');

const ExcuseLetter = require('../models/ExcuseLetter');
const StudentUser = require('../models/StudentUser');
const ParentUser = require('../models/ParentUser');
const TeacherAllocation = require('../models/TeacherAllocation');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const School = require('../models/School');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

const router = express.Router();

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

    const { dateFrom, dateTo, reason, reasonType, additionalNotes, emergencyContact } = req.body || {};
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
      additionalNotes: String(additionalNotes || ''),
      emergencyContact: String(emergencyContact || ''),
      status: 'pending',
    });

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

// Parent: list letters submitted by the authenticated parent's linked children.
router.get('/parent', authParent, async (req, res) => {
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
    })
      .sort({ createdAt: -1 })
      .lean();
    const schoolMeta = await buildSchoolMeta(schoolId);
    const enriched = items.map((item) => ({
      ...item,
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

    const updated = await ExcuseLetter.findByIdAndUpdate(
      id,
      { $set: { status, reviewedBy: teacherId, reviewedAt: new Date() } },
      { new: true }
    ).lean();

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
