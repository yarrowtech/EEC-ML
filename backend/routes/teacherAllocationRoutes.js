const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');

const TeacherAllocation = require('../models/TeacherAllocation');
const TeacherUser = require('../models/TeacherUser');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const { ensureAllocationGroupThread, removeAllocationGroupThread, syncAllocationGroupThreads } = require('../utils/chatGroupProvisioning');
const { invalidateStudentSubjectsCache } = require('../utils/studentSubjectsCache');

const router = express.Router();

const resolveSchoolId = (req, res) => {
  const schoolId = req.schoolId || req.admin?.schoolId || null;
  if (!schoolId) {
    res.status(400).json({ error: 'schoolId is required' });
    return null;
  }
  if (!mongoose.isValidObjectId(schoolId)) {
    res.status(400).json({ error: 'Invalid schoolId' });
    return null;
  }
  return schoolId;
};

const resolveCampusId = (req) => req.campusId || null;

const buildScopeFilter = (schoolId, campusId) => {
  const filter = { schoolId };
  if (campusId) {
    filter.$or = [{ campusId }, { campusId: null }, { campusId: { $exists: false } }];
  }
  return filter;
};

const isValidId = (value) => mongoose.isValidObjectId(value);

const validateAllocationPayload = async ({
  schoolId,
  campusId,
  teacherId,
  subjectId,
  classId,
  sectionId,
  isClassTeacher,
}) => {
  if (!isValidId(teacherId) || !isValidId(classId) || !isValidId(sectionId)) {
    return { ok: false, error: 'teacherId, classId and sectionId must be valid IDs' };
  }
  if (!isClassTeacher && !isValidId(subjectId)) {
    return { ok: false, error: 'subjectId must be a valid ID' };
  }

  const scopedFilter = buildScopeFilter(schoolId, campusId);
  const queries = [
    TeacherUser.findOne({ _id: teacherId, ...scopedFilter }).lean(),
    ClassModel.findOne({ _id: classId, ...scopedFilter }).lean(),
    Section.findOne({ _id: sectionId, ...scopedFilter }).lean(),
  ];
  if (!isClassTeacher && isValidId(subjectId)) {
    queries.push(Subject.findOne({ _id: subjectId, ...scopedFilter }).lean());
  }
  const [teacher, cls, section, subject = null] = await Promise.all(queries);

  if (!teacher) return { ok: false, error: 'Teacher not found for this school/campus' };
  if (!cls) return { ok: false, error: 'Class not found for this school/campus' };
  if (!section) return { ok: false, error: 'Section not found for this school/campus' };
  if (!isClassTeacher && !subject) return { ok: false, error: 'Subject not found for this school/campus' };

  if (String(section.classId) !== String(classId)) {
    return { ok: false, error: 'Selected section does not belong to selected class' };
  }

  if (subject?.classId && String(subject.classId) !== String(classId)) {
    return { ok: false, error: 'Selected subject does not belong to selected class' };
  }

  return { ok: true };
};

router.get('/', adminAuth, async (req, res) => {
  // #swagger.tags = ['Teachers']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const filter = {
      schoolId,
      ...(campusId ? { campusId } : {}),
    };

    if (isValidId(req.query.teacherId)) filter.teacherId = req.query.teacherId;
    if (isValidId(req.query.subjectId)) filter.subjectId = req.query.subjectId;
    if (isValidId(req.query.classId)) filter.classId = req.query.classId;
    if (isValidId(req.query.sectionId)) filter.sectionId = req.query.sectionId;

    const items = await TeacherAllocation.find(filter)
      .populate('teacherId', 'name email employeeCode subject')
      .populate('subjectId', 'name code classId')
      .populate('classId', 'name')
      .populate('sectionId', 'name classId')
      .sort({ createdAt: -1 })
      .lean();

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', adminAuth, async (req, res) => {
  // #swagger.tags = ['Teachers']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const { teacherId, subjectId, classId, sectionId, isClassTeacher, notes } = req.body || {};
    const normalizedSubjectId = isClassTeacher ? null : subjectId;

    const validation = await validateAllocationPayload({
      schoolId,
      campusId,
      teacherId,
      subjectId: normalizedSubjectId,
      classId,
      sectionId,
      isClassTeacher: Boolean(isClassTeacher),
    });
    if (!validation.ok) return res.status(400).json({ error: validation.error });

    const existing = await TeacherAllocation.findOne({
      schoolId,
      campusId: campusId || null,
      teacherId,
      subjectId: normalizedSubjectId,
      classId,
      sectionId,
    }).lean();

    if (existing) {
      return res.status(409).json({ error: 'Allocation already exists for this teacher/subject/class/section' });
    }

    const created = await TeacherAllocation.create({
      schoolId,
      campusId: campusId || null,
      teacherId,
      subjectId: normalizedSubjectId,
      classId,
      sectionId,
      isClassTeacher: Boolean(isClassTeacher),
      notes: notes ? String(notes).trim() : '',
    });

    const populated = await TeacherAllocation.findById(created._id)
      .populate('teacherId', 'name email employeeCode subject')
      .populate('subjectId', 'name code classId')
      .populate('classId', 'name')
      .populate('sectionId', 'name classId')
      .lean();

    if (isClassTeacher) {
      await ensureAllocationGroupThread({
        schoolId,
        campusId: campusId || null,
        teacherId,
        subjectId: normalizedSubjectId,
        classId,
        sectionId,
        isClassTeacher: true,
      });
    }

    await invalidateStudentSubjectsCache({
      organizationId: req.organizationId,
      schoolId,
      campusId,
      classId,
      sectionId,
    });

    res.status(201).json(populated);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Allocation already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Teachers']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid allocation id' });
    }
    const existingAllocation = await TeacherAllocation.findOne({
      _id: id,
      schoolId,
      ...(campusId ? { campusId } : {}),
    })
      .select('teacherId subjectId classId sectionId isClassTeacher')
      .lean();
    if (!existingAllocation) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    const { teacherId, subjectId, classId, sectionId, isClassTeacher, notes } = req.body || {};
    const normalizedSubjectId = isClassTeacher ? null : subjectId;
    const validation = await validateAllocationPayload({
      schoolId,
      campusId,
      teacherId,
      subjectId: normalizedSubjectId,
      classId,
      sectionId,
      isClassTeacher: Boolean(isClassTeacher),
    });
    if (!validation.ok) return res.status(400).json({ error: validation.error });

    const existing = await TeacherAllocation.findOne({
      _id: { $ne: id },
      schoolId,
      campusId: campusId || null,
      teacherId,
      subjectId: normalizedSubjectId,
      classId,
      sectionId,
    }).lean();
    if (existing) {
      return res.status(409).json({ error: 'Another allocation already exists with same mapping' });
    }

    const updated = await TeacherAllocation.findOneAndUpdate(
      { _id: id, schoolId, ...(campusId ? { campusId } : {}) },
      {
        $set: {
          teacherId,
          subjectId: normalizedSubjectId,
          classId,
          sectionId,
          isClassTeacher: Boolean(isClassTeacher),
          notes: notes ? String(notes).trim() : '',
        },
      },
      { new: true, runValidators: true }
    )
      .populate('teacherId', 'name email employeeCode subject')
      .populate('subjectId', 'name code classId')
      .populate('classId', 'name')
      .populate('sectionId', 'name classId')
      .lean();

    if (!updated) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    if (isClassTeacher) {
      await ensureAllocationGroupThread({
        schoolId,
        campusId: campusId || null,
        teacherId,
        subjectId: normalizedSubjectId,
        classId,
        sectionId,
        isClassTeacher: true,
      });
    }

    const classTeacherKeyChanged =
      Boolean(existingAllocation.isClassTeacher) &&
      (
        !Boolean(isClassTeacher) ||
        String(existingAllocation.classId || '') !== String(classId || '') ||
        String(existingAllocation.sectionId || '') !== String(sectionId || '')
      );
    if (classTeacherKeyChanged) {
      await removeAllocationGroupThread({
        schoolId,
        campusId: campusId || null,
        subjectId: existingAllocation.subjectId || null,
        classId: existingAllocation.classId,
        sectionId: existingAllocation.sectionId,
        isClassTeacher: Boolean(existingAllocation.isClassTeacher),
      });
    }

    await invalidateStudentSubjectsCache({
      organizationId: req.organizationId,
      schoolId,
      campusId,
      classId: existingAllocation.classId,
      sectionId: existingAllocation.sectionId,
    });
    await invalidateStudentSubjectsCache({
      organizationId: req.organizationId,
      schoolId,
      campusId,
      classId,
      sectionId,
    });

    res.json(updated);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Allocation already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Teachers']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid allocation id' });
    }

    const removed = await TeacherAllocation.findOneAndDelete({
      _id: id,
      schoolId,
      ...(campusId ? { campusId } : {}),
    }).lean();

    if (!removed) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    if (removed.isClassTeacher) {
      await removeAllocationGroupThread({
        schoolId,
        campusId: campusId || null,
        subjectId: removed.subjectId || null,
        classId: removed.classId,
        sectionId: removed.sectionId,
        isClassTeacher: true,
      });
    }

    await invalidateStudentSubjectsCache({
      organizationId: req.organizationId,
      schoolId,
      campusId,
      classId: removed.classId,
      sectionId: removed.sectionId,
    });

    res.json({ ok: true, message: 'Allocation deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/sync-chat-groups', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const stats = await syncAllocationGroupThreads({ schoolId, campusId: campusId || null });
    res.json({ ok: true, ...stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
