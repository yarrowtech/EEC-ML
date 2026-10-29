const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const authTeacher = require('../middleware/authTeacher');
const StudentUser = require('../models/StudentUser');
const StudentHealthLog = require('../models/StudentHealthLog');
const StudentHealthIntervention = require('../models/StudentHealthIntervention');
const { buildTeacherAllocationScope, studentIsWithinTeacherScope } = require('../utils/teacherAllocationScope');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['good', 'moderate', 'at_risk'];
const ISSUE_TODAY = ['no', 'yes', 'maybe'];
const ISSUE_TAGS = ['none', 'headache', 'fatigue', 'fever', 'stomach_ache', 'other'];
const INTERVENTION_TYPES = ['Talked to student', 'Informed parent', 'Sent to counselor'];
const MAX_BULK = 300;

const httpError = (status, message) => Object.assign(new Error(message), { status });
const todayKey = () => new Date().toISOString().slice(0, 10);
const clampScore = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
};

// Returns the subset of requested student ids the teacher is allocated to;
// throws 403 if any requested id falls outside the teacher's scope.
async function assertStudentsInScope(req, rawIds) {
  const schoolId = req.schoolId;
  const teacherId = req.user?.id;
  if (!schoolId || !teacherId) throw httpError(401, 'Unauthorized');
  const ids = [...new Set(rawIds.map(String))];
  if (!ids.length) throw httpError(400, 'No students supplied');
  if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) throw httpError(400, 'Invalid student id');

  const scope = await buildTeacherAllocationScope({ schoolId, teacherId, campusId: req.campusId || null });
  if (!scope.length) throw httpError(403, 'Class allocation required');
  const students = await StudentUser.find({ _id: { $in: ids }, schoolId }).select('_id grade section').lean();
  const allowed = new Set(students.filter((s) => studentIsWithinTeacherScope(s, scope)).map((s) => String(s._id)));
  if (ids.some((id) => !allowed.has(id))) throw httpError(403, 'One or more students are outside your class allocation');
  return ids;
}

const sendError = (res, err) => res.status(err.status || 500).json({ success: false, error: err.message });

// GET /api/health-records/logs?studentIds=a,b&days=30
router.get('/logs', authTeacher, async (req, res) => {
  try {
    const ids = await assertStudentsInScope(req, String(req.query.studentIds || '').split(',').filter(Boolean));
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
    const [logs, interventions] = await Promise.all([
      StudentHealthLog.find({ schoolId: req.schoolId, studentId: { $in: ids }, date: { $gte: from } }).sort({ date: -1 }).lean(),
      StudentHealthIntervention.find({ schoolId: req.schoolId, studentId: { $in: ids } }).sort({ createdAt: -1 }).limit(1000).lean(),
    ]);
    return res.json({ success: true, data: { logs, interventions } });
  } catch (err) {
    return sendError(res, err);
  }
});

// POST /api/health-records/logs/bulk  { date, entries: [{ studentId, overallStatus, issueToday, issueTag, mood, behavior, notes }] }
// Upserts one log per student per day, so re-saving a day overwrites it.
router.post('/logs/bulk', authTeacher, async (req, res) => {
  try {
    const date = req.body?.date || todayKey();
    if (!DATE_RE.test(date)) throw httpError(400, 'date must be YYYY-MM-DD');
    if (date > todayKey()) throw httpError(400, 'Cannot record health entries for a future date');
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    if (!entries.length) throw httpError(400, 'No entries supplied');
    if (entries.length > MAX_BULK) throw httpError(400, `At most ${MAX_BULK} entries per request`);

    const clean = entries.map((e) => {
      const overallStatus = STATUSES.includes(e?.overallStatus) ? e.overallStatus : null;
      if (!overallStatus) throw httpError(400, 'Each entry needs a valid overallStatus');
      const issueToday = ISSUE_TODAY.includes(e?.issueToday) ? e.issueToday : 'no';
      const issueTag = issueToday === 'no' ? 'none' : (ISSUE_TAGS.includes(e?.issueTag) ? e.issueTag : 'none');
      return {
        studentId: String(e?.studentId || ''),
        overallStatus,
        issueToday,
        issueTag,
        mood: clampScore(e?.mood),
        behavior: clampScore(e?.behavior),
        notes: String(e?.notes || '').trim().slice(0, 200),
      };
    });
    await assertStudentsInScope(req, clean.map((e) => e.studentId));

    const result = await StudentHealthLog.bulkWrite(clean.map((e) => ({
      updateOne: {
        filter: { schoolId: req.schoolId, studentId: e.studentId, date },
        update: { $set: { ...e, teacherId: req.user.id }, $setOnInsert: { schoolId: req.schoolId, date } },
        upsert: true,
      },
    })), { ordered: false });

    return res.json({
      success: true,
      data: { saved: clean.length, created: result.upsertedCount || 0, updated: result.modifiedCount || 0, date },
      message: `Saved health entries for ${clean.length} student${clean.length === 1 ? '' : 's'}`,
    });
  } catch (err) {
    return sendError(res, err);
  }
});

// POST /api/health-records/interventions  { studentId, type, followUpDate, notes, confidential }
router.post('/interventions', authTeacher, async (req, res) => {
  try {
    const [studentId] = await assertStudentsInScope(req, [req.body?.studentId].filter(Boolean));
    const followUpDate = req.body?.followUpDate || '';
    if (followUpDate && !DATE_RE.test(followUpDate)) throw httpError(400, 'followUpDate must be YYYY-MM-DD');
    const doc = await StudentHealthIntervention.create({
      schoolId: req.schoolId,
      studentId,
      teacherId: req.user.id,
      type: INTERVENTION_TYPES.includes(req.body?.type) ? req.body.type : INTERVENTION_TYPES[0],
      date: todayKey(),
      followUpDate,
      notes: String(req.body?.notes || '').trim().slice(0, 1000),
      confidential: Boolean(req.body?.confidential),
    });
    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;
