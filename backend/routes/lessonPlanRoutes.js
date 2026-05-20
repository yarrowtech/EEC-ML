const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const authTeacher = require('../middleware/authTeacher');
const authStudent = require('../middleware/authStudent');
const LessonPlan = require('../models/LessonPlan');
const LessonPlanCompletion = require('../models/LessonPlanCompletion');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const Timetable = require('../models/Timetable');
const StudentUser = require('../models/StudentUser');
const TeachingMaterial = require('../models/TeachingMaterial');
const PracticePaper = require('../models/PracticePaper');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

const normalizeString = (value) => String(value || '').trim();
const normalizeLower = (value) => String(value || '').trim().toLowerCase();
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeStringList = (value) =>
  Array.isArray(value) ? value.map((item) => normalizeString(item)).filter(Boolean) : [];

const sanitizePlannerContent = (value) => {
  if (!value || typeof value !== 'object') return { chapters: [] };
  const chapters = Array.isArray(value.chapters) ? value.chapters : [];

  return {
    chapters: chapters.map((chapter, chapterIndex) => {
      const topics = Array.isArray(chapter?.topics) ? chapter.topics : [];
      return {
        id: normalizeString(chapter?.id) || `chapter-${chapterIndex + 1}`,
        title: normalizeString(chapter?.title),
        topics: topics.map((topic, topicIndex) => {
          const subTopics = Array.isArray(topic?.subTopics) ? topic.subTopics : [];
          return {
            id: normalizeString(topic?.id) || `topic-${chapterIndex + 1}-${topicIndex + 1}`,
            title: normalizeString(topic?.title),
            subTopics: subTopics.map((subTopic, subTopicIndex) => ({
              id: normalizeString(subTopic?.id) || `subtopic-${chapterIndex + 1}-${topicIndex + 1}-${subTopicIndex + 1}`,
              title: normalizeString(subTopic?.title),
              learningPaths: normalizeStringList(subTopic?.learningPaths),
              studyMaterials: normalizeStringList(subTopic?.studyMaterials),
              mindMaps: normalizeStringList(subTopic?.mindMaps),
              worksheets: normalizeStringList(subTopic?.worksheets),
              referenceMaterials: normalizeStringList(subTopic?.referenceMaterials),
              tryoutSections: normalizeStringList(subTopic?.tryoutSections),
              selfAssessments: normalizeStringList(subTopic?.selfAssessments),
              questionPapers: {
                basic: normalizeString(subTopic?.questionPapers?.basic),
                intermediate: normalizeString(subTopic?.questionPapers?.intermediate),
                advanced: normalizeString(subTopic?.questionPapers?.advanced),
              },
            })),
          };
        }),
      };
    }),
  };
};

const resolveSchoolId = (req) => req.schoolId || req.admin?.schoolId || req.user?.schoolId || null;

const resolveCampusId = (req) => req.campusId || req.admin?.campusId || req.user?.campusId || null;

const buildClassFilter = (schoolId, campusId) => {
  const filter = { schoolId };
  if (campusId) filter.campusId = campusId;
  return filter;
};

const buildSectionFilter = (schoolId, campusId, classId) => {
  const filter = { schoolId, classId };
  if (campusId) filter.campusId = campusId;
  return filter;
};

const buildTimetableFilter = (schoolId, campusId, classId, sectionId) => {
  const filter = { schoolId, classId, sectionId };
  if (campusId) filter.campusId = campusId;
  return filter;
};

const parsePlanDate = (value) => {
  const normalized = normalizeString(value);
  const pureDateMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (pureDateMatch) {
    const year = Number(pureDateMatch[1]);
    const month = Number(pureDateMatch[2]);
    const day = Number(pureDateMatch[3]);
    const localDate = new Date(year, month - 1, day);
    if (!Number.isNaN(localDate.getTime())) return localDate;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toDayStart = (value) => {
  const parsed = parsePlanDate(value);
  if (!parsed) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const normalizeCompletionPayload = ({ status, isCompleted, completionPercent }) => {
  const explicitStatus = normalizeLower(status);
  const normalizedPercent = Number.isFinite(Number(completionPercent))
    ? Math.max(0, Math.min(100, Number(completionPercent)))
    : null;
  const normalizedCompleted = typeof isCompleted === 'boolean' ? isCompleted : null;

  if (explicitStatus === 'completed') {
    return { status: 'completed', isCompleted: true, completionPercent: 100 };
  }
  if (explicitStatus === 'in_progress') {
    return {
      status: 'in_progress',
      isCompleted: false,
      completionPercent: normalizedPercent === null ? 50 : normalizedPercent,
    };
  }
  if (explicitStatus === 'pending') {
    return { status: 'pending', isCompleted: false, completionPercent: 0 };
  }

  if (normalizedCompleted === true) {
    return { status: 'completed', isCompleted: true, completionPercent: 100 };
  }
  if (normalizedPercent !== null) {
    if (normalizedPercent >= 100) return { status: 'completed', isCompleted: true, completionPercent: 100 };
    if (normalizedPercent > 0) return { status: 'in_progress', isCompleted: false, completionPercent: normalizedPercent };
  }

  return { status: 'pending', isCompleted: false, completionPercent: 0 };
};

const getAllocationCombos = async ({ schoolId, campusId, classId, sectionId, teacherId = null }) => {
  const timetables = await Timetable.find(buildTimetableFilter(schoolId, campusId, classId, sectionId))
    .populate('entries.teacherId', 'name')
    .populate('entries.subjectId', 'name')
    .lean();

  const comboMap = new Map();
  timetables.forEach((tt) => {
    (tt.entries || []).forEach((entry) => {
      const tid = entry.teacherId?._id;
      const sid = entry.subjectId?._id;
      const tname = entry.teacherId?.name;
      const sname = entry.subjectId?.name;
      if (!tid || !sid || !tname || !sname) return;
      if (teacherId && String(tid) !== String(teacherId)) return;
      const key = `${tid}::${sid}`;
      if (!comboMap.has(key)) {
        comboMap.set(key, {
          teacherId: String(tid),
          teacherName: String(tname),
          subjectId: String(sid),
          subjectName: String(sname),
          label: `${tname} (${sname})`
        });
      }
    });
  });

  return Array.from(comboMap.values()).sort((a, b) => a.label.localeCompare(b.label));
};

const resolvePlanPayload = async ({ schoolId, campusId, payload, forcedTeacherId = null }) => {
  const {
    classId,
    sectionId,
    teacherId: incomingTeacherId,
    subjectId,
    title,
    subject,
    date,
    learningObjectives,
    materialsNeeded,
    additionalNotes,
    plannerContent,
  } = payload || {};

  const teacherId = forcedTeacherId || incomingTeacherId;

  if (!classId || !sectionId || !teacherId || !subjectId || !title || !date) {
    return { error: 'classId, sectionId, teacherId, subjectId, title and date are required' };
  }

  const classFilter = { schoolId, _id: classId };
  if (campusId) classFilter.campusId = campusId;
  const classDoc = await ClassModel.findOne(classFilter).lean();
  if (!classDoc) return { error: 'Class not found', status: 404 };

  const sectionFilter = { schoolId, classId, _id: sectionId };
  if (campusId) sectionFilter.campusId = campusId;
  const sectionDoc = await Section.findOne(sectionFilter).lean();
  if (!sectionDoc) return { error: 'Section not found', status: 404 };

  const combos = await getAllocationCombos({ schoolId, campusId, classId, sectionId, teacherId: forcedTeacherId || null });
  const selectedCombo = combos.find((item) => String(item.teacherId) === String(teacherId) && String(item.subjectId) === String(subjectId));

  if (!selectedCombo) {
    return {
      error: forcedTeacherId
        ? 'You are not allocated to this class/section with this subject in timetable'
        : 'Selected teacher is not allocated for this class/section with this subject in timetable',
      status: 403,
    };
  }

  const parsedDate = parsePlanDate(date);
  if (!parsedDate) return { error: 'Invalid date' };

  return {
    data: {
      classId,
      sectionId,
      teacherId,
      subjectId,
      className: classDoc.name || '',
      sectionName: sectionDoc.name || '',
      teacherName: selectedCombo.teacherName || 'Teacher',
      subject: normalizeString(subject) || selectedCombo.subjectName,
      title: normalizeString(title),
      date: parsedDate,
      learningObjectives: Array.isArray(learningObjectives)
        ? learningObjectives.map((item) => normalizeString(item)).filter(Boolean)
        : [],
      materialsNeeded: Array.isArray(materialsNeeded)
        ? materialsNeeded.map((item) => normalizeString(item)).filter(Boolean)
        : [],
      additionalNotes: normalizeString(additionalNotes),
      plannerContent: sanitizePlannerContent(plannerContent),
    },
  };
};

router.get('/admin/options', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const requestedClassId = normalizeString(req.query?.classId);
    const requestedSectionId = normalizeString(req.query?.sectionId);

    const classes = await ClassModel.find(buildClassFilter(schoolId, campusId))
      .select('name')
      .sort({ name: 1 })
      .lean();

    let sections = [];
    if (requestedClassId) {
      sections = await Section.find(buildSectionFilter(schoolId, campusId, requestedClassId))
        .select('name classId')
        .sort({ name: 1 })
        .lean();
    }

    const allocations = requestedClassId && requestedSectionId
      ? await getAllocationCombos({ schoolId, campusId, classId: requestedClassId, sectionId: requestedSectionId })
      : [];

    res.json({
      classes: classes.map((item) => ({ id: String(item._id), name: item.name })),
      sections: sections.map((item) => ({ id: String(item._id), name: item.name, classId: String(item.classId) })),
      allocations,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teacher/options', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const requestedClassId = normalizeString(req.query?.classId);
    const requestedSectionId = normalizeString(req.query?.sectionId);

    const ttFilter = { schoolId, 'entries.teacherId': teacherId };
    if (campusId) ttFilter.campusId = campusId;

    const teacherTables = await Timetable.find(ttFilter)
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .populate('entries.subjectId', 'name')
      .lean();

    const classMap = new Map();
    const sectionMap = new Map();

    teacherTables.forEach((tt) => {
      const cid = String(tt.classId?._id || '');
      const sid = String(tt.sectionId?._id || '');
      if (!cid || !sid) return;
      if (!classMap.has(cid)) classMap.set(cid, { id: cid, name: tt.classId?.name || '' });
      const skey = `${cid}::${sid}`;
      if (!sectionMap.has(skey)) sectionMap.set(skey, { id: sid, classId: cid, name: tt.sectionId?.name || '' });
    });

    const classes = Array.from(classMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const sections = Array.from(sectionMap.values())
      .filter((sec) => !requestedClassId || sec.classId === requestedClassId)
      .sort((a, b) => a.name.localeCompare(b.name));

    let subjects = [];
    if (requestedClassId && requestedSectionId) {
      const combos = await getAllocationCombos({
        schoolId,
        campusId,
        classId: requestedClassId,
        sectionId: requestedSectionId,
        teacherId,
      });
      subjects = combos.map((combo) => ({
        subjectId: combo.subjectId,
        subjectName: combo.subjectName,
      }));
    }

    res.json({ classes, sections, subjects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const filter = { schoolId };
    if (campusId) filter.campusId = campusId;

    const plans = await LessonPlan.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const resolved = await resolvePlanPayload({ schoolId, campusId, payload: req.body });
    if (resolved.error) return res.status(resolved.status || 400).json({ error: resolved.error });

    const plan = await LessonPlan.create({
      schoolId,
      campusId: campusId || null,
      ...resolved.data,
      createdBy: req.admin?.id || null,
      updatedBy: req.admin?.id || null,
    });

    res.status(201).json({ message: 'Lesson plan created', plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/admin/:id', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const id = req.params?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const filter = { _id: id, schoolId };
    if (campusId) filter.campusId = campusId;

    const existing = await LessonPlan.findOne(filter);
    if (!existing) return res.status(404).json({ error: 'Lesson plan not found' });

    const resolved = await resolvePlanPayload({ schoolId, campusId, payload: req.body });
    if (resolved.error) return res.status(resolved.status || 400).json({ error: resolved.error });

    Object.assign(existing, resolved.data, { updatedBy: req.admin?.id || null });
    await existing.save();

    res.json({ message: 'Lesson plan updated', plan: existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/:id', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const id = req.params?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const filter = { _id: id, schoolId };
    if (campusId) filter.campusId = campusId;

    const deleted = await LessonPlan.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ error: 'Lesson plan not found' });

    res.json({ message: 'Lesson plan deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teacher/my', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { schoolId, teacherId };
    if (campusId) filter.campusId = campusId;

    const plans = await LessonPlan.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teacher/:lessonPlanId/status', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const lessonPlanId = req.params?.lessonPlanId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const planFilter = { _id: lessonPlanId, schoolId, teacherId };
    if (campusId) planFilter.campusId = campusId;
    const plan = await LessonPlan.findOne(planFilter).lean();
    if (!plan) return res.status(404).json({ error: 'Lesson plan not found' });

    const statusFilter = { schoolId, lessonPlanId, teacherId };
    if (campusId) statusFilter.campusId = campusId;
    const statuses = await LessonPlanCompletion.find(statusFilter).sort({ date: -1, createdAt: -1 }).lean();

    res.json(statuses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teacher/:lessonPlanId/status', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const lessonPlanId = req.params?.lessonPlanId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const planFilter = { _id: lessonPlanId, schoolId, teacherId };
    if (campusId) planFilter.campusId = campusId;
    const plan = await LessonPlan.findOne(planFilter).lean();
    if (!plan) return res.status(404).json({ error: 'Lesson plan not found' });

    const dayDate = toDayStart(req.body?.date);
    if (!dayDate) return res.status(400).json({ error: 'Valid date is required' });
    const normalized = normalizeCompletionPayload({
      status: req.body?.status,
      isCompleted: req.body?.isCompleted,
      completionPercent: req.body?.completionPercent,
    });

    const update = {
      schoolId,
      campusId: campusId || null,
      lessonPlanId: plan._id,
      classId: plan.classId,
      sectionId: plan.sectionId,
      teacherId: plan.teacherId,
      subjectId: plan.subjectId,
      className: plan.className || '',
      sectionName: plan.sectionName || '',
      teacherName: plan.teacherName || 'Teacher',
      subject: plan.subject || '',
      title: plan.title || '',
      date: dayDate,
      status: normalized.status,
      isCompleted: normalized.isCompleted,
      completionPercent: normalized.completionPercent,
      remarks: String(req.body?.remarks || '').trim(),
    };

    const completion = await LessonPlanCompletion.findOneAndUpdate(
      { schoolId, campusId: campusId || null, lessonPlanId: plan._id, date: dayDate },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: 'Status saved', completion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/teacher/:lessonPlanId/status/:statusId', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const lessonPlanId = req.params?.lessonPlanId;
    const statusId = req.params?.statusId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { _id: statusId, schoolId, lessonPlanId, teacherId };
    if (campusId) filter.campusId = campusId;
    const existing = await LessonPlanCompletion.findOne(filter);
    if (!existing) return res.status(404).json({ error: 'Status not found' });

    if (req.body?.date) {
      const nextDate = toDayStart(req.body.date);
      if (!nextDate) return res.status(400).json({ error: 'Invalid date' });
      existing.date = nextDate;
    }
    const normalized = normalizeCompletionPayload({
      status: req.body?.status,
      isCompleted: req.body?.isCompleted,
      completionPercent: req.body?.completionPercent,
    });
    existing.status = normalized.status;
    existing.isCompleted = normalized.isCompleted;
    existing.completionPercent = normalized.completionPercent;
    existing.remarks = String(req.body?.remarks || '').trim();
    await existing.save();

    res.json({ message: 'Status updated', completion: existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/teacher/:lessonPlanId/status/:statusId', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const lessonPlanId = req.params?.lessonPlanId;
    const statusId = req.params?.statusId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { _id: statusId, schoolId, lessonPlanId, teacherId };
    if (campusId) filter.campusId = campusId;
    const deleted = await LessonPlanCompletion.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ error: 'Status not found' });

    res.json({ message: 'Status deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/student/status', authStudent, async (req, res) => {
  try {
    logStudentPortalEvent(req, {
      feature: 'lesson_plan_status',
      action: 'lesson_plan_status.fetch',
      targetType: 'student',
      targetId: req.user?.id,
      fromDate: req.query?.fromDate || undefined,
      toDate: req.query?.toDate || undefined,
    });
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const studentId = req.user?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const studentFilter = { _id: studentId, schoolId };
    if (campusId) studentFilter.campusId = campusId;
    const student = await StudentUser.findOne(studentFilter).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const className = normalizeLower(student.grade);
    const sectionName = normalizeLower(student.section);
    if (!className || !sectionName) {
      logStudentPortalEvent(req, {
        feature: 'lesson_plan_status',
        action: 'lesson_plan_status.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'student',
        targetId: studentId,
        resultCount: 0,
      });
      return res.json([]);
    }

    const planFilter = {
      schoolId,
      className: { $regex: `^${escapeRegex(className)}$`, $options: 'i' },
      sectionName: { $regex: `^${escapeRegex(sectionName)}$`, $options: 'i' },
    };
    if (campusId) planFilter.campusId = campusId;
    if (req.query?.fromDate || req.query?.toDate) {
      planFilter.date = {};
      if (req.query?.fromDate) {
        const from = toDayStart(req.query.fromDate);
        if (from) planFilter.date.$gte = from;
      }
      if (req.query?.toDate) {
        const to = toDayStart(req.query.toDate);
        if (to) {
          to.setHours(23, 59, 59, 999);
          planFilter.date.$lte = to;
        }
      }
      if (!Object.keys(planFilter.date).length) delete planFilter.date;
    }

    const plans = await LessonPlan.find(planFilter).sort({ date: -1, createdAt: -1 }).lean();
    if (!plans.length) {
      logStudentPortalEvent(req, {
        feature: 'lesson_plan_status',
        action: 'lesson_plan_status.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'student',
        targetId: studentId,
        resultCount: 0,
      });
      return res.json([]);
    }

    const planIds = plans.map((plan) => plan._id);
    const statusFilter = { schoolId, lessonPlanId: { $in: planIds } };
    if (campusId) statusFilter.campusId = campusId;
    if (req.query?.fromDate || req.query?.toDate) {
      statusFilter.date = {};
      if (req.query?.fromDate) {
        const from = toDayStart(req.query.fromDate);
        if (from) statusFilter.date.$gte = from;
      }
      if (req.query?.toDate) {
        const to = toDayStart(req.query.toDate);
        if (to) {
          to.setHours(23, 59, 59, 999);
          statusFilter.date.$lte = to;
        }
      }
      if (!Object.keys(statusFilter.date).length) {
        delete statusFilter.date;
      }
    }

    const statuses = await LessonPlanCompletion.find(statusFilter).sort({ date: -1, createdAt: -1 }).lean();
    const planById = new Map(plans.map((plan) => [String(plan._id), plan]));
    const statusKeySet = new Set(
      statuses.map((row) => `${String(row.lessonPlanId)}::${toDayStart(row.date)?.toISOString() || ''}`)
    );

    const defaultPending = plans
      .map((plan) => {
        const date = toDayStart(plan.date);
        const key = `${String(plan._id)}::${date?.toISOString() || ''}`;
        if (!date || statusKeySet.has(key)) return null;
        return {
          _id: `pending-${plan._id}-${date.toISOString()}`,
          lessonPlanId: plan._id,
          title: plan.title,
          subject: plan.subject,
          className: plan.className,
          sectionName: plan.sectionName,
          teacherName: plan.teacherName,
          date,
          status: 'pending',
          isCompleted: false,
          completionPercent: 0,
          remarks: '',
        };
      })
      .filter(Boolean);

    const normalizedStatuses = statuses.map((row) => {
      const plan = planById.get(String(row.lessonPlanId));
      return {
        ...row,
        title: row.title || plan?.title || '',
        subject: row.subject || plan?.subject || '',
        className: row.className || plan?.className || '',
        sectionName: row.sectionName || plan?.sectionName || '',
        teacherName: row.teacherName || plan?.teacherName || 'Teacher',
      };
    });

    const data = [...normalizedStatuses, ...defaultPending].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    res.json(data);
    logStudentPortalEvent(req, {
      feature: 'lesson_plan_status',
      action: 'lesson_plan_status.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: studentId,
      resultCount: data.length,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'lesson_plan_status',
      action: 'lesson_plan_status.fetch',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(500).json({ error: err.message });
  }
});

router.post('/teacher', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const resolved = await resolvePlanPayload({ schoolId, campusId, payload: req.body, forcedTeacherId: teacherId });
    if (resolved.error) return res.status(resolved.status || 400).json({ error: resolved.error });

    const plan = await LessonPlan.create({
      schoolId,
      campusId: campusId || null,
      ...resolved.data,
    });

    res.status(201).json({ message: 'Lesson plan created', plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/teacher/:id', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const id = req.params?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { _id: id, schoolId, teacherId };
    if (campusId) filter.campusId = campusId;

    const existing = await LessonPlan.findOne(filter);
    if (!existing) return res.status(404).json({ error: 'Lesson plan not found' });

    const resolved = await resolvePlanPayload({ schoolId, campusId, payload: req.body, forcedTeacherId: teacherId });
    if (resolved.error) return res.status(resolved.status || 400).json({ error: resolved.error });

    Object.assign(existing, resolved.data);
    await existing.save();

    res.json({ message: 'Lesson plan updated', plan: existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teacher/:id/publish-subtopic', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const id = req.params?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const { chapterIndex, topicIndex, subTopicIndex, publishPracticePaper = true } = req.body || {};
    if (![chapterIndex, topicIndex, subTopicIndex].every((v) => Number.isInteger(v) && v >= 0)) {
      return res.status(400).json({ error: 'chapterIndex, topicIndex and subTopicIndex must be non-negative integers' });
    }

    const filter = { _id: id, schoolId, teacherId };
    if (campusId) filter.campusId = campusId;

    const plan = await LessonPlan.findOne(filter).lean();
    if (!plan) return res.status(404).json({ error: 'Lesson plan not found' });

    const planner = sanitizePlannerContent(plan.plannerContent);
    const chapter = planner?.chapters?.[chapterIndex];
    const topic = chapter?.topics?.[topicIndex];
    const subTopic = topic?.subTopics?.[subTopicIndex];

    if (!chapter || !topic || !subTopic) {
      return res.status(404).json({ error: 'Subtopic not found in planner content' });
    }

    const normalizeLinks = (arr) => (Array.isArray(arr) ? arr.map((x) => String(x || '').trim()).filter(Boolean) : []);
    const allLinks = [
      ...normalizeLinks(subTopic.studyMaterials),
      ...normalizeLinks(subTopic.mindMaps),
      ...normalizeLinks(subTopic.worksheets),
      ...normalizeLinks(subTopic.referenceMaterials),
      ...normalizeLinks(subTopic.tryoutSections),
      ...normalizeLinks(subTopic.selfAssessments),
    ];

    const attachments = allLinks
      .filter((item, idx, arr) => arr.indexOf(item) === idx)
      .filter((item) => /^https?:\/\//i.test(item))
      .map((url, idx) => ({
        name: 'Resource ' + (idx + 1),
        url,
        size: 0,
        type: 'link'
      }));

    const esc = (value) => String(value || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const sectionHtml = (label, values) => {
      const list = normalizeLinks(values);
      if (!list.length) return '';
      const safeItems = list.map((v) => '<li>' + esc(v) + '</li>').join('');
      return '<h3>' + esc(label) + '</h3><ul>' + safeItems + '</ul>';
    };

    const materialTitle = [
      plan.subject || 'Subject',
      chapter.title || ('Chapter ' + (chapterIndex + 1)),
      topic.title || ('Topic ' + (topicIndex + 1)),
      subTopic.title || ('Sub Topic ' + (subTopicIndex + 1)),
    ].join(' • ');

    const materialContent = [
      '<h2>' + esc(materialTitle) + '</h2>',
      sectionHtml('Learning Paths', subTopic.learningPaths),
      sectionHtml('Study Materials', subTopic.studyMaterials),
      sectionHtml('Mind Maps', subTopic.mindMaps),
      sectionHtml('Worksheets', subTopic.worksheets),
      sectionHtml('Reference Materials', subTopic.referenceMaterials),
      sectionHtml('Tryout Sections', subTopic.tryoutSections),
      sectionHtml('Self Assessments', subTopic.selfAssessments),
    ].filter(Boolean).join('');

    const material = await TeachingMaterial.create({
      schoolId,
      campusId: campusId || null,
      title: materialTitle,
      content: materialContent,
      materialType: 'note',
      typeLabel: 'Lesson Planner Material',
      classId: plan.classId,
      sectionId: plan.sectionId,
      subjectId: plan.subjectId,
      className: plan.className || '',
      sectionName: plan.sectionName || '',
      subjectName: plan.subject || '',
      teacherId: plan.teacherId,
      teacherName: plan.teacherName || 'Teacher',
      status: 'published',
      publishedAt: new Date(),
      priority: 'medium',
      difficulty: 'intermediate',
      category: 'reference',
      tags: ['lesson-plan', 'smart-learning', 'auto-published'],
      attachments,
    });

    let paper = null;
    if (publishPracticePaper) {
      const outline = subTopic?.questionPapers || {};
      const mkQuestion = (label, difficulty, marks) => ({
        questionText: String(outline?.[label] || '').trim() || ((subTopic.title || 'Sub Topic') + ' (' + label + ')'),
        questionType: 'short_answer',
        options: [],
        correctAnswer: '',
        explanation: '',
        marks,
        difficulty,
      });

      const questions = [
        mkQuestion('basic', 'easy', 2),
        mkQuestion('intermediate', 'medium', 3),
        mkQuestion('advanced', 'hard', 5),
      ];

      paper = await PracticePaper.create({
        schoolId,
        campusId: campusId || null,
        teachingMaterialId: material._id,
        title: materialTitle + ' • Practice Paper',
        description: 'Auto-generated from lesson planner subtopic: ' + (subTopic.title || 'Sub Topic'),
        paperType: 'practice_set',
        classId: plan.classId,
        sectionId: plan.sectionId,
        subjectId: plan.subjectId,
        className: plan.className || '',
        sectionName: plan.sectionName || '',
        subjectName: plan.subject || '',
        teacherId: plan.teacherId,
        teacherName: plan.teacherName || 'Teacher',
        questions,
        duration: 20,
        difficulty: 'mixed',
        chapter: chapter.title || '',
        topics: [topic.title || '', subTopic.title || ''].filter(Boolean),
        passingPercentage: 40,
        status: 'published',
        publishedAt: new Date(),
        tags: ['lesson-plan', 'smart-learning', 'auto-published'],
      });
    }

    return res.status(201).json({
      message: 'Published to student portal',
      material,
      paper,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/teacher/:id', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const id = req.params?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { _id: id, schoolId, teacherId };
    if (campusId) filter.campusId = campusId;

    const deleted = await LessonPlan.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ error: 'Lesson plan not found' });

    res.json({ message: 'Lesson plan deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/student/smart-learning-map', authStudent, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const studentId = req.user?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const studentFilter = { _id: studentId, schoolId };
    if (campusId) studentFilter.campusId = campusId;
    const student = await StudentUser.findOne(studentFilter).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const classId = student.classId || null;
    const sectionId = student.sectionId || null;

    const planFilter = { schoolId };
    if (campusId) planFilter.campusId = campusId;

    if (classId && sectionId) {
      planFilter.classId = classId;
      planFilter.sectionId = sectionId;
    } else {
      const className = normalizeLower(student.grade);
      const sectionName = normalizeLower(student.section);
      if (!className || !sectionName) return res.json({ subjects: [] });
      planFilter.className = { $regex: '^' + escapeRegex(className) + '$', $options: 'i' };
      planFilter.sectionName = { $regex: '^' + escapeRegex(sectionName) + '$', $options: 'i' };
    }

    const plans = await LessonPlan.find(planFilter).sort({ date: -1, createdAt: -1 }).lean();
    if (!plans.length) return res.json({ subjects: [] });

    const subjectMap = new Map();

    plans.forEach((plan) => {
      const subjectKey = normalizeLower(plan.subject) || normalizeLower(plan.subjectName) || normalizeLower(plan.title);
      const subjectTitle = normalizeString(plan.subject) || normalizeString(plan.subjectName) || 'Subject';
      if (!subjectKey) return;

      if (!subjectMap.has(subjectKey)) {
        subjectMap.set(subjectKey, {
          key: subjectKey,
          title: subjectTitle,
          topics: new Map(),
        });
      }

      const subjectEntry = subjectMap.get(subjectKey);
      const planner = sanitizePlannerContent(plan.plannerContent);
      (planner.chapters || []).forEach((chapter) => {
        (chapter.topics || []).forEach((topic) => {
          const topicTitle = normalizeString(topic.title);
          if (!topicTitle) return;
          const topicKey = normalizeLower(topicTitle);
          if (!subjectEntry.topics.has(topicKey)) {
            subjectEntry.topics.set(topicKey, {
              title: topicTitle,
              subtopics: new Set(),
            });
          }
          const topicEntry = subjectEntry.topics.get(topicKey);
          (topic.subTopics || []).forEach((sub) => {
            const subTitle = normalizeString(sub.title);
            if (subTitle) topicEntry.subtopics.add(subTitle);
          });
        });
      });
    });

    const subjects = Array.from(subjectMap.values()).map((subject) => ({
      key: subject.key,
      title: subject.title,
      topics: Array.from(subject.topics.values()).map((topic) => ({
        title: topic.title,
        subtopics: Array.from(topic.subtopics),
      })),
    }));

    return res.json({ subjects });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


module.exports = router;
