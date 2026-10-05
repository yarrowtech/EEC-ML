const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const authTeacher = require('../middleware/authTeacher');
const authParent = require('../middleware/authParent');
const StudentObservation = require('../models/StudentObservation');
const StudentUser = require('../models/StudentUser');
const ParentUser = require('../models/ParentUser');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const TeacherAllocation = require('../models/TeacherAllocation');
const AcademicYear = require('../models/AcademicYear');
const ParentObservationDraft = require('../models/ParentObservationDraft');

// Session label for a date: the school's academic year whose range contains
// it, else an April → March fallback ("2026-2027"). Lets the parent history
// group entries by session, so a promoted child's older entries stay apart.
const sessionLabelFor = (date, years = []) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const match = years.find((y) => y.startDate && y.endDate && d >= new Date(y.startDate) && d <= new Date(y.endDate));
  if (match?.name) return match.name;
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${start + 1}`;
};

const scoreObservationMap = (entries = {}) => {
  const scores = Object.values(entries).map((value) => {
    if (!value || typeof value !== 'string') return 3;
    const normalized = value.toLowerCase();
    if (normalized.includes('excellent') || normalized.includes('very high')) return 5;
    if (normalized.includes('good') || normalized.includes('high') || normalized.includes('normal')) return 4;
    if (normalized.includes('moderate') || normalized.includes('average') || normalized.includes('acceptable')) return 3;
    if (normalized.includes('low') || normalized.includes('poor') || normalized.includes('challenging')) return 2;
    if (normalized.includes('very low') || normalized.includes('very poor') || normalized.includes('concerning')) return 1;
    return 3;
  });
  if (!scores.length) return null;
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
};

const findClassTeacherForStudent = async ({ student, schoolId }) => {
  if (!student || !schoolId) return null;

  const classDoc = student.grade
    ? await ClassModel.findOne({ schoolId, name: student.grade }).lean()
    : null;
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
    isClassTeacher: true,
  };
  if (sectionDoc) baseFilter.sectionId = sectionDoc._id;

  let allocation = await TeacherAllocation.findOne(baseFilter)
    .populate('teacherId', 'name email phone')
    .lean();

  if (!allocation) {
    allocation = await TeacherAllocation.findOne({
      schoolId,
      classId: classDoc._id,
      ...(sectionDoc ? { sectionId: sectionDoc._id } : {}),
    })
      .populate('teacherId', 'name email phone')
      .lean();
  }

  return allocation?.teacherId || null;
};

const formatObservation = (observation) => ({
  id: observation._id,
  studentId: observation.studentId,
  studentName: observation.studentName,
  studentCode: observation.studentCode || '',
  username: observation.username || '',
  className: observation.className,
  section: observation.section,
  recordedAt: observation.recordedAt,
  source: observation.source || 'teacher',
  category: observation.category || '',
  observationText: observation.observationText || '',
  urgencyLevel: observation.urgencyLevel,
  followUpRequired: observation.followUpRequired,
  parentNotification: observation.parentNotification,
  additionalNotes: observation.additionalNotes || '',
  behaviorNotes: observation.behaviorNotes || '',
  moodRating: observation.moodRating,
  concernLevel: observation.concernLevel,
  healthObservations: observation.healthObservations || {},
  emotionObservations: observation.emotionObservations || {},
  healthScore: scoreObservationMap(observation.healthObservations || {}),
  emotionScore: scoreObservationMap(observation.emotionObservations || {}),
  teacher: observation.teacherId
    ? {
        id: observation.teacherId._id,
        name: observation.teacherId.name || 'Teacher',
        email: observation.teacherId.email || '',
      }
    : null,
  parent: observation.parentId
    ? {
        id: observation.parentId,
        name: observation.parentName || '',
      }
    : null,
});

router.post('/teacher', authTeacher, async (req, res) => {
  try {
    const {
      studentId,
      date,
      time,
      healthObservations,
      emotionObservations,
      additionalNotes,
      urgencyLevel,
      followUpRequired,
      parentNotification,
    } = req.body || {};

    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const student = await StudentUser.findOne({ _id: studentId, schoolId }).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const recordedAt = date
      ? new Date(`${date}T${time || '00:00'}:00`)
      : new Date();

    const observation = await StudentObservation.create({
      schoolId,
      campusId: req.campusId || null,
      teacherId: req.user?.id,
      studentId: student._id,
      studentName: student.name || '',
      studentCode: student.studentCode || '',
      username: student.username || '',
      className: student.grade || '',
      section: student.section || '',
      recordedAt,
      source: 'teacher',
      healthObservations: healthObservations || {},
      emotionObservations: emotionObservations || {},
      additionalNotes: additionalNotes || '',
      urgencyLevel: urgencyLevel || 'normal',
      followUpRequired: Boolean(followUpRequired),
      parentNotification: Boolean(parentNotification),
    });

    const populated = await observation.populate('teacherId', 'name email');
    res.status(201).json(formatObservation(populated));
  } catch (err) {
    console.error('Create observation error:', err);
    res.status(500).json({ error: err.message || 'Unable to save observation' });
  }
});

router.get('/teacher', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const { studentId, className, limit = 10 } = req.query || {};
    const filter = {
      schoolId,
      teacherId: req.user?.id,
    };
    if (studentId) filter.studentId = studentId;
    if (className) filter.className = className;

    const docs = await StudentObservation.find(filter)
      .sort({ recordedAt: -1 })
      .limit(Math.max(1, Math.min(Number(limit) || 10, 50)))
      .populate('teacherId', 'name email')
      .lean();

    res.json({
      observations: docs.map(formatObservation),
    });
  } catch (err) {
    console.error('Teacher observations fetch error:', err);
    res.status(500).json({ error: err.message || 'Unable to load observations' });
  }
});

/* ── Parent observation drafts (auto-saved, one per parent + child) ───────── */

// Draft payloads are small keyed maps; cap them so a client can't store junk.
const MAX_DRAFT_KEYS = 80;
const MAX_DRAFT_VALUE = 1000;
const cleanMap = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  Object.entries(value).slice(0, MAX_DRAFT_KEYS).forEach(([k, v]) => {
    if (typeof v === 'string') out[String(k).slice(0, 120)] = v.slice(0, MAX_DRAFT_VALUE);
  });
  return out;
};

const resolveParentChild = async (req, studentId) => {
  if (!mongoose.isValidObjectId(studentId)) return { error: [400, 'Valid studentId is required'] };
  const parent = await ParentUser.findById(req.user.id).select('childrenIds schoolId').lean();
  if (!parent) return { error: [404, 'Parent not found'] };
  const owns = (parent.childrenIds || []).some((id) => String(id) === String(studentId));
  if (!owns) return { error: [403, 'Student is not linked to this parent account'] };
  return { parent, schoolId: parent.schoolId || req.schoolId };
};

const formatDraft = (doc) => (doc ? {
  studentId: String(doc.studentId),
  ratings: doc.ratings || {},
  remarks: doc.remarks || {},
  openSection: doc.openSection || 0,
  updatedAt: doc.updatedAt,
} : null);

// GET /parent/drafts — every saved draft for this parent's children.
router.get('/parent/drafts', authParent, async (req, res) => {
  try {
    const drafts = await ParentObservationDraft.find({ parentId: req.user.id }).sort({ updatedAt: -1 }).lean();
    return res.json({ drafts: drafts.map(formatDraft) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unable to load drafts' });
  }
});

// PUT /parent/drafts/:studentId — create or replace the draft for a child.
router.put('/parent/drafts/:studentId', authParent, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { parent, schoolId, error } = await resolveParentChild(req, studentId);
    if (error) return res.status(error[0]).json({ error: error[1] });

    const openSection = Math.max(0, Math.min(20, Number(req.body?.openSection) || 0));
    const doc = await ParentObservationDraft.findOneAndUpdate(
      { parentId: parent._id, studentId },
      {
        $set: { ratings: cleanMap(req.body?.ratings), remarks: cleanMap(req.body?.remarks), openSection },
        $setOnInsert: { schoolId, parentId: parent._id, studentId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ draft: formatDraft(doc) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unable to save draft' });
  }
});

// DELETE /parent/drafts/:studentId — discard (also called after submitting).
router.delete('/parent/drafts/:studentId', authParent, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { parent, error } = await resolveParentChild(req, studentId);
    if (error) return res.status(error[0]).json({ error: error[1] });
    await ParentObservationDraft.deleteOne({ parentId: parent._id, studentId });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unable to delete draft' });
  }
});

router.post('/parent', authParent, async (req, res) => {
  try {
    const {
      studentId,
      category,
      observationText,
      observation,
      moodRating,
      behaviorNotes,
      concernLevel,
      date,
    } = req.body || {};

    const parent = await ParentUser.findById(req.user.id)
      .select('name childrenIds children schoolId campusId')
      .lean();
    if (!parent) return res.status(404).json({ error: 'Parent not found' });

    const schoolId = parent.schoolId || req.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const student = await StudentUser.findOne({ _id: studentId, schoolId }).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const ownsChild =
      (Array.isArray(parent.childrenIds) &&
        parent.childrenIds.some((id) => String(id) === String(studentId))) ||
      (Array.isArray(parent.children) &&
        parent.children.map((name) => String(name || '').trim()).includes(String(student.name || '').trim()));
    if (!ownsChild) {
      return res.status(403).json({ error: 'Student is not linked to this parent account' });
    }

    const recordedAt = date ? new Date(date) : new Date();
    const classTeacher = await findClassTeacherForStudent({ student, schoolId });

    const doc = await StudentObservation.create({
      schoolId,
      campusId: parent.campusId || req.campusId || null,
      teacherId: classTeacher?._id || null,
      parentId: parent._id,
      parentName: parent.name || '',
      studentId: student._id,
      studentName: student.name || '',
      studentCode: student.studentCode || '',
      username: student.username || '',
      className: student.grade || '',
      section: student.section || '',
      recordedAt,
      source: 'parent',
      category: category || '',
      observationText: observationText || observation || '',
      additionalNotes: observation || '',
      behaviorNotes: behaviorNotes || '',
      moodRating: Number(moodRating) || null,
      concernLevel: concernLevel || 'low',
      healthObservations: {},
      emotionObservations: {},
      urgencyLevel:
        concernLevel === 'high' || concernLevel === 'urgent'
          ? 'urgent'
          : concernLevel === 'medium'
          ? 'high'
          : 'normal',
      followUpRequired: concernLevel === 'high' || concernLevel === 'urgent',
      parentNotification: false,
    });

    res.status(201).json(formatObservation(await doc.populate('teacherId', 'name email')));
  } catch (err) {
    console.error('Parent observation submit error:', err);
    res.status(500).json({ error: err.message || 'Unable to save observation' });
  }
});

router.get('/parent', authParent, async (req, res) => {
  try {
    const parent = await ParentUser.findById(req.user.id)
      .select('childrenIds children schoolId')
      .lean();
    if (!parent) return res.status(404).json({ error: 'Parent not found' });

    const schoolId = parent.schoolId || req.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const childFilter = { schoolId };
    if (Array.isArray(parent.childrenIds) && parent.childrenIds.length > 0) {
      childFilter._id = { $in: parent.childrenIds };
    } else if (Array.isArray(parent.children) && parent.children.length > 0) {
      const names = parent.children.map((name) => String(name || '').trim()).filter(Boolean);
      if (names.length > 0) {
        childFilter.name = { $in: names };
      }
    }

    const childDocs = await StudentUser.find(childFilter).select('name grade section studentCode username').lean();
    const childIds = childDocs.map((child) => child._id);
    if (!childIds.length) {
      return res.json({
        stats: { total: 0, urgent: 0, followUps: 0, lastUpdated: null },
        observations: [],
        children: [],
      });
    }

    const teacherObservations = await StudentObservation.find({
      schoolId,
      studentId: { $in: childIds },
      source: 'teacher',
    })
      .sort({ recordedAt: -1 })
      .limit(50)
      .populate('teacherId', 'name email')
      .lean();

    const formatted = teacherObservations.map(formatObservation);
    const parentEntriesDocs = await StudentObservation.find({
      schoolId,
      studentId: { $in: childIds },
      parentId: parent._id,
      source: 'parent',
    })
      .sort({ recordedAt: -1 })
      .limit(200)
      .lean();

    const academicYears = await AcademicYear.find({ schoolId })
      .select('name startDate endDate isActive')
      .lean();

    const urgent = formatted.filter((item) => item.urgencyLevel === 'urgent').length;
    const followUps = formatted.filter((item) => item.followUpRequired).length;
    const lastUpdated = formatted.length > 0 ? formatted[0].recordedAt : null;

    const childMap = new Map(childDocs.map((child) => [String(child._id), child]));
    const childSummaries = Array.from(childMap.entries()).map(([id, child]) => {
      const childObservations = formatted.filter((item) => String(item.studentId) === id);
      return {
        studentId: id,
        studentName: child.name || 'Student',
        studentCode: child.studentCode || '',
        username: child.username || '',
        grade: child.grade || '',
        section: child.section || '',
        totalEntries: childObservations.length,
        lastObservation: childObservations[0] || null,
      };
    });

    res.json({
      stats: {
        total: formatted.length,
        urgent,
        followUps,
        lastUpdated,
      },
      observations: formatted,
      children: childSummaries,
      parentEntries: parentEntriesDocs.map((doc) => ({
        ...formatObservation(doc),
        sessionName: sessionLabelFor(doc.recordedAt || doc.createdAt, academicYears),
      })),
      activeSession: academicYears.find((y) => y.isActive)?.name || '',
    });
  } catch (err) {
    console.error('Parent observations fetch error:', err);
    res.status(500).json({ error: err.message || 'Unable to load observations' });
  }
});

router.get('/teacher/parent-insights', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const teacherId = req.user?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const allocations = await TeacherAllocation.find({ schoolId, teacherId, isClassTeacher: true })
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .lean();
    const classCombos = allocations
      .map((alloc) => ({
        className: alloc.classId?.name || '',
        section: alloc.sectionId?.name || '',
      }))
      .filter((combo) => combo.className);

    const orConditions = [{ teacherId }];
    classCombos.forEach((combo) => {
      const condition = { teacherId: null, className: combo.className };
      if (combo.section) condition.section = combo.section;
      orConditions.push(condition);
    });

    const docs = await StudentObservation.find({
      schoolId,
      source: 'parent',
      $or: orConditions,
    })
      .sort({ recordedAt: -1 })
      .limit(50)
      .lean();

    const stats = docs.reduce(
      (acc, doc) => {
        acc.total += 1;
        if (doc.concernLevel === 'high' || doc.concernLevel === 'urgent') acc.high += 1;
        if (doc.followUpRequired) acc.followUps += 1;
        if (doc.moodRating) {
          acc.moodSum += doc.moodRating;
          acc.moodCount += 1;
        }
        return acc;
      },
      { total: 0, high: 0, followUps: 0, moodSum: 0, moodCount: 0 }
    );

    res.json({
      stats: {
        total: stats.total,
        high: stats.high,
        followUps: stats.followUps,
        averageMood:
          stats.moodCount > 0 ? Number((stats.moodSum / stats.moodCount).toFixed(1)) : null,
        lastUpdated: docs.length > 0 ? docs[0].recordedAt : null,
      },
      recent: docs.slice(0, 5).map(formatObservation),
    });
  } catch (err) {
    console.error('Teacher parent observation insight error:', err);
    res.status(500).json({ error: err.message || 'Unable to load parent observations' });
  }
});

module.exports = router;
