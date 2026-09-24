const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const adminAuth = require('../middleware/adminAuth');
const rateLimit = require('../middleware/rateLimit');

// LLM-backed endpoint: cap per-admin request volume so it can't be used to
// drive up AI-service load / token cost.
const aiInsightsLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 20 });
const MasteryScore = require('../models/MasteryScore');
const TeacherUser = require('../models/TeacherUser');
const StudentUser = require('../models/StudentUser');
const ExamAttempt = require('../models/ExamAttempt');
const ExamResult = require('../models/ExamResult');
const TeachingMaterial = require('../models/TeachingMaterial');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const toObjId = (id) => {
  try { return new mongoose.Types.ObjectId(id); } catch { return null; }
};

const scopedFilter = (req, extra = {}) => ({
  schoolId: req.schoolId,
  ...(req.campusId ? { campusId: req.campusId } : {}),
  ...extra,
});

const parseLimit = (value, fallback = 20, maximum = 50) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, maximum);
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const scopedStudentIds = async (req, extra = {}) => (
  StudentUser.distinct('_id', scopedFilter(req, extra))
);

// ── Class / section / session scope from the Analytics page filters ─────────
// ?grade=&section=&academicYearId= → the matching students plus the Class and
// Section docs (for teacher allocations). With no grade given, returns null so
// endpoints keep their school-wide behaviour for other callers.
const AcademicYear = require('../models/AcademicYear');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const TeacherAllocation = require('../models/TeacherAllocation');
const Subject = require('../models/Subject');

const gradeVariants = (value = '') => {
  const raw = String(value || '').trim();
  const bare = raw.replace(/^(class|grade|std\.?)\s*/i, '').trim();
  return [...new Set([raw, bare, bare && `Class ${bare}`, bare && `Grade ${bare}`].filter(Boolean))];
};

const resolveClassScope = async (req) => {
  const grade = String(req.query.grade || '').trim();
  if (!grade) return null;
  const section = String(req.query.section || '').trim();
  const academicYearId = mongoose.isValidObjectId(req.query.academicYearId) ? req.query.academicYearId : null;
  const year = academicYearId
    ? await AcademicYear.findOne({ _id: academicYearId, schoolId: req.schoolId }).select('name').lean()
    : null;

  const studentFilter = scopedFilter(req, {
    status: 'Active',
    isArchived: { $ne: true },
    grade: { $in: gradeVariants(grade).map((g) => new RegExp(`^${escapeRegex(g)}$`, 'i')) },
    ...(section ? { section: new RegExp(`^${escapeRegex(section)}$`, 'i') } : {}),
    ...(year?.name ? { academicYear: new RegExp(`^\\s*${escapeRegex(year.name.trim())}\\s*$`, 'i') } : {}),
  });
  const studentIds = await StudentUser.distinct('_id', studentFilter);

  const classDoc = await ClassModel.findOne({
    schoolId: req.schoolId,
    name: { $in: gradeVariants(grade) },
    ...(academicYearId ? { academicYearId } : {}),
  }).select('_id name').lean();
  const sectionDoc = classDoc && section
    ? await Section.findOne({ schoolId: req.schoolId, classId: classDoc._id, name: section }).select('_id name').lean()
    : null;

  return { grade, section, studentIds, studentFilter, classDoc, sectionDoc };
};

// Teachers allocated to the scoped class/section, with their subject names.
const loadClassAllocations = async (req, scope) => {
  if (!scope?.classDoc) return [];
  const allocations = await TeacherAllocation.find({
    schoolId: req.schoolId,
    classId: scope.classDoc._id,
    ...(scope.sectionDoc ? { sectionId: scope.sectionDoc._id } : {}),
  }).select('teacherId subjectId isClassTeacher').lean();
  const [teachers, subjects] = await Promise.all([
    TeacherUser.find({ _id: { $in: allocations.map((a) => a.teacherId) } }).select('name').lean(),
    Subject.find({ _id: { $in: allocations.map((a) => a.subjectId).filter(Boolean) } }).select('name').lean(),
  ]);
  const teacherName = new Map(teachers.map((t) => [String(t._id), t.name]));
  const subjectName = new Map(subjects.map((s) => [String(s._id), s.name]));
  return allocations
    .map((a) => ({
      teacherId: a.teacherId,
      teacherName: teacherName.get(String(a.teacherId)) || 'Teacher',
      subject: a.subjectId ? subjectName.get(String(a.subjectId)) || '' : '',
      isClassTeacher: Boolean(a.isClassTeacher),
    }))
    .filter((a) => a.subject || a.isClassTeacher);
};

// Case-insensitive subject match ("Computer" vs "computer").
const subjKey = (value) => String(value || '').trim().toLowerCase();

// GET /api/admin-analytics/mastery-matrix
router.get('/mastery-matrix', adminAuth, async (req, res) => {
  try {
    const schoolObjId = toObjId(req.schoolId);
    if (!schoolObjId) return res.status(400).json({ error: 'Invalid schoolId' });

    const scope = await resolveClassScope(req);
    const rows = await MasteryScore.aggregate([
      { $match: { schoolId: schoolObjId, ...(scope ? { studentId: { $in: scope.studentIds } } : {}) } },
      {
        $lookup: {
          from: 'studentusers',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: false } },
      ...(req.campusId ? [{ $match: { 'student.campusId': req.campusId } }] : []),
      {
        $group: {
          _id: { subject: '$subject', grade: '$student.grade' },
          avgScore: { $avg: '$score' },
          studentCount: { $addToSet: '$studentId' },
        },
      },
      {
        $project: {
          subject: '$_id.subject',
          grade: '$_id.grade',
          avgScore: { $round: ['$avgScore', 1] },
          studentCount: { $size: '$studentCount' },
        },
      },
      { $sort: { grade: 1, subject: 1 } },
    ]);

    // For a selected class, list every subject taught there (not only the
    // ones that happen to have AI-tutor activity), so empty ones show as "—".
    const classSubjects = scope
      ? (await loadClassAllocations(req, scope)).map((a) => a.subject).filter(Boolean)
      : [];
    // One column per subject regardless of casing ("computer" ≡ "Computer");
    // the allocated (official) subject name wins as the display label.
    const displayName = new Map();
    [...classSubjects, ...rows.map((r) => r.subject)].forEach((s) => {
      if (s && !displayName.has(subjKey(s))) displayName.set(subjKey(s), s);
    });
    const subjects = [...displayName.values()].sort();
    const grades = [...new Set(rows.map((r) => r.grade))].sort();
    if (scope && !grades.length) grades.push(scope.grade);
    const matrix = {};
    for (const r of rows) {
      if (!matrix[r.grade]) matrix[r.grade] = {};
      matrix[r.grade][displayName.get(subjKey(r.subject)) || r.subject] = r.avgScore;
    }

    return res.json({ success: true, data: { subjects, grades, matrix } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/admin-analytics/teacher-effectiveness
router.get('/teacher-effectiveness', adminAuth, async (req, res) => {
  try {
    const schoolObjId = toObjId(req.schoolId);
    if (!schoolObjId) return res.status(400).json({ error: 'Invalid schoolId' });

    const scope = await resolveClassScope(req);
    const [teachers, subjectMastery] = await Promise.all([
      // With a class selected: the teachers allocated to that class/section,
      // one row per (teacher, subject). Otherwise every teacher.
      scope
        ? loadClassAllocations(req, scope).then((rows) => rows
          .filter((a) => a.subject)
          .map((a) => ({ _id: a.teacherId, name: a.teacherName, subject: a.subject })))
        : TeacherUser.find(scopedFilter(req)).select('name subject email phone').lean(),
      (scope ? Promise.resolve(scope.studentIds) : scopedStudentIds(req)).then((studentIds) => MasteryScore.aggregate([
        { $match: { schoolId: schoolObjId, ...((scope || req.campusId) ? { studentId: { $in: studentIds } } : {}) } },
        {
          $group: {
            _id: '$subject',
            avgScore: { $avg: '$score' },
            studentCount: { $addToSet: '$studentId' },
            topicCount: { $addToSet: '$topicTitle' },
          },
        },
        {
          $project: {
            subject: '$_id',
            avgScore: { $round: ['$avgScore', 1] },
            studentCount: { $size: '$studentCount' },
            topicCount: { $size: '$topicCount' },
          },
        },
      ])),
    ]);

    const masteryBySubject = {};
    for (const s of subjectMastery) {
      masteryBySubject[subjKey(s.subject)] = s;
    }

    const result = teachers.map((t) => {
      const subjectStats = masteryBySubject[subjKey(t.subject)] || {};
      return {
        teacherId: t._id,
        name: t.name,
        subject: t.subject || '—',
        avgClassMastery: subjectStats.avgScore ?? null,
        studentCount: subjectStats.studentCount ?? 0,
        topicsCovered: subjectStats.topicCount ?? 0,
        effectiveness:
          subjectStats.avgScore != null
            ? subjectStats.avgScore >= 75
              ? 'High'
              : subjectStats.avgScore >= 55
              ? 'Moderate'
              : 'Needs Support'
            : 'No data',
      };
    });

    result.sort((a, b) => (b.avgClassMastery ?? -1) - (a.avgClassMastery ?? -1));
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/admin-analytics/ai-path-effectiveness
// AI tutor usage aggregated by subject: students engaged, avg mastery, topics covered
router.get('/ai-path-effectiveness', adminAuth, async (req, res) => {
  try {
    const schoolObjId = toObjId(req.schoolId);
    if (!schoolObjId) return res.status(400).json({ error: 'Invalid schoolId' });

    const scope = await resolveClassScope(req);
    const studentIds = scope ? scope.studentIds : (req.campusId ? await scopedStudentIds(req) : null);
    const rows = await MasteryScore.aggregate([
      { $match: { schoolId: schoolObjId, ...(studentIds ? { studentId: { $in: studentIds } } : {}) } },
      {
        $group: {
          _id: { $toLower: { $trim: { input: { $ifNull: ['$subject', ''] } } } },
          name: { $first: '$subject' },
          avgScore: { $avg: '$score' },
          strongTopics: {
            $sum: { $cond: [{ $gte: ['$score', 75] }, 1, 0] },
          },
          weakTopics: {
            $sum: { $cond: [{ $lt: ['$score', 55] }, 1, 0] },
          },
          totalTopics: { $sum: 1 },
          students: { $addToSet: '$studentId' },
          totalAttempts: { $sum: '$attemptCount' },
        },
      },
      {
        $project: {
          subject: '$name',
          avgScore: { $round: ['$avgScore', 1] },
          strongTopics: 1,
          weakTopics: 1,
          totalTopics: 1,
          studentCount: { $size: '$students' },
          totalAttempts: 1,
        },
      },
      { $sort: { avgScore: -1 } },
    ]);

    // With a class selected, show every subject taught there — subjects with no
    // AI-tutor activity yet appear with zeros instead of being hidden.
    if (scope) {
      const allocated = (await loadClassAllocations(req, scope)).map((a) => a.subject).filter(Boolean);
      const bySubject = new Map(rows.map((r) => [subjKey(r.subject), r]));
      const merged = [];
      const seen = new Set();
      allocated.forEach((name) => {
        const key = subjKey(name);
        if (seen.has(key)) return;
        seen.add(key);
        const hit = bySubject.get(key);
        merged.push(hit ? { ...hit, subject: name } : {
          subject: name, avgScore: null, strongTopics: 0, weakTopics: 0, totalTopics: 0, studentCount: 0, totalAttempts: 0,
        });
      });
      rows.forEach((r) => { if (!seen.has(subjKey(r.subject))) merged.push(r); });
      merged.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
      return res.json({ success: true, data: merged });
    }

    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/admin-analytics/dropout-risk
// Students flagged as at-risk: attendance < 75% OR last exam result failed
router.get('/dropout-risk', adminAuth, async (req, res) => {
  try {
    const schoolObjId = toObjId(req.schoolId);
    if (!schoolObjId) return res.status(400).json({ error: 'Invalid schoolId' });

    const scope = await resolveClassScope(req);
    const students = await StudentUser.find(scope ? scope.studentFilter : scopedFilter(req, { status: 'Active' }))
      .select('name grade section attendance')
      .lean();

    const failedResults = await ExamResult.aggregate([
      {
        $match: {
          schoolId: schoolObjId,
          ...(req.campusId ? { campusId: req.campusId } : {}),
          ...(scope ? { studentId: { $in: scope.studentIds } } : {}),
          status: 'fail',
        },
      },
      {
        $group: {
          _id: '$studentId',
          failCount: { $sum: 1 },
        },
      },
    ]);

    const failMap = new Map(failedResults.map((r) => [String(r._id), r.failCount]));

    const atRisk = [];
    for (const student of students) {
      // Count distinct days (period-wise records can log several per day) and
      // only judge attendance once there's a meaningful sample — a single
      // absent period used to show up as "0% attendance".
      const byDay = new Map();
      (student.attendance || []).forEach((a) => {
        const day = a?.date ? new Date(a.date).toISOString().slice(0, 10) : null;
        if (!day) return;
        const present = ['present', 'late'].includes(String(a.status || '').toLowerCase());
        byDay.set(day, (byDay.get(day) || false) || present);
      });
      const total = byDay.size;
      const present = [...byDay.values()].filter(Boolean).length;
      const MIN_DAYS = 5;
      const attendanceRate = total >= MIN_DAYS ? Math.round((present / total) * 100) : null;
      const failCount = failMap.get(String(student._id)) || 0;

      const lowAttendance = attendanceRate !== null && attendanceRate < 75;
      const academicRisk = failCount >= 2;

      if (lowAttendance || academicRisk) {
        const riskLevel =
          (lowAttendance && academicRisk) ? 'High' :
          lowAttendance ? 'Medium' :
          'Low';

        atRisk.push({
          studentId: student._id,
          name: student.name,
          grade: student.grade || '—',
          section: student.section || '—',
          attendanceRate: attendanceRate ?? '—',
          attendanceDays: total,
          failedExams: failCount,
          riskLevel,
          reasons: [
            ...(lowAttendance ? [`Attendance ${attendanceRate}% over ${total} days`] : []),
            ...(academicRisk ? [`${failCount} failed exams`] : []),
          ],
        });
      }
    }

    atRisk.sort((a, b) => {
      const order = { High: 0, Medium: 1, Low: 2 };
      return order[a.riskLevel] - order[b.riskLevel];
    });

    return res.json({ success: true, data: atRisk, total: atRisk.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/admin-analytics/cohort-trend
// Monthly average exam marks over last 6 months for cohort comparison
router.get('/cohort-trend', adminAuth, async (req, res) => {
  try {
    const schoolObjId = toObjId(req.schoolId);
    if (!schoolObjId) return res.status(400).json({ error: 'Invalid schoolId' });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const scope = await resolveClassScope(req);
    const rows = await ExamResult.aggregate([
      {
        $match: {
          schoolId: schoolObjId,
          ...(req.campusId ? { campusId: req.campusId } : {}),
          ...(scope ? { studentId: { $in: scope.studentIds } } : {}),
          createdAt: { $gte: sixMonthsAgo },
          status: { $ne: 'absent' },
        },
      },
      // Normalise to % of each exam's maximum marks (raw marks differ per exam).
      { $lookup: { from: 'exams', localField: 'examId', foreignField: '_id', as: 'exam' } },
      { $unwind: { path: '$exam', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          marks: {
            $cond: [
              { $gt: [{ $ifNull: ['$exam.marks', 0] }, 0] },
              { $multiply: [{ $divide: ['$marks', '$exam.marks'] }, 100] },
              '$marks',
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'studentusers',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            grade: '$student.grade',
          },
          avgMarks: { $avg: '$marks' },
          studentCount: { $addToSet: '$studentId' },
          passCount: { $sum: { $cond: [{ $eq: ['$status', 'pass'] }, 1, 0] } },
          totalCount: { $sum: 1 },
        },
      },
      {
        $project: {
          year: '$_id.year',
          month: '$_id.month',
          grade: '$_id.grade',
          avgMarks: { $round: ['$avgMarks', 1] },
          studentCount: { $size: '$studentCount' },
          passRate: {
            $round: [
              { $multiply: [{ $divide: ['$passCount', '$totalCount'] }, 100] },
              1,
            ],
          },
        },
      },
      { $sort: { year: 1, month: 1, grade: 1 } },
    ]);

    // Build a month-keyed summary (all grades combined)
    const monthMap = new Map();
    for (const r of rows) {
      const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
      if (!monthMap.has(key)) {
        const d = new Date(r.year, r.month - 1, 1);
        monthMap.set(key, {
          month: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
          avgMarks: [],
          passRates: [],
          studentCount: 0,
          byGrade: {},
        });
      }
      const entry = monthMap.get(key);
      entry.avgMarks.push(r.avgMarks);
      entry.passRates.push(r.passRate);
      entry.studentCount += r.studentCount;
      entry.byGrade[r.grade] = { avgMarks: r.avgMarks, passRate: r.passRate };
    }

    const trend = [...monthMap.entries()].map(([, v]) => ({
      month: v.month,
      avgMarks: v.avgMarks.length
        ? Math.round(v.avgMarks.reduce((a, b) => a + b, 0) / v.avgMarks.length * 10) / 10
        : null,
      passRate: v.passRates.length
        ? Math.round(v.passRates.reduce((a, b) => a + b, 0) / v.passRates.length * 10) / 10
        : null,
      studentCount: v.studentCount,
    }));

    const grades = [...new Set(rows.map((r) => r.grade))].sort();

    return res.json({ success: true, data: { trend, grades, raw: rows } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/admin-analytics/content-usage
// Top teaching materials by total views + downloads
router.get('/content-usage', adminAuth, async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    if (!limit) return res.status(400).json({ error: 'limit must be a positive integer' });

    const materials = await TeachingMaterial.find(scopedFilter(req))
      .select('title subjectName grade views downloads viewedBy downloadedBy completedBy createdAt')
      .lean();

    const formatted = materials.map((m) => {
      const uniqueViewers = m.viewedBy?.length || 0;
      const uniqueDownloaders = m.downloadedBy?.length || 0;
      const completions = m.completedBy?.length || 0;
      const totalTimeSpent = m.viewedBy?.reduce((sum, v) => sum + (v.timeSpent || 0), 0) || 0;
      const avgTimeSpent = uniqueViewers > 0 ? Math.round(totalTimeSpent / uniqueViewers) : 0;

      return {
        id: m._id,
        title: m.title,
        subject: m.subjectName || '—',
        grade: m.grade || '—',
        totalViews: m.views || 0,
        uniqueViewers,
        downloads: m.downloads || 0,
        uniqueDownloaders,
        completions,
        avgTimeSpentSeconds: avgTimeSpent,
        engagementScore: (m.views || 0) + (m.downloads || 0) * 2 + completions * 3,
        uploadedAt: m.createdAt,
      };
    });

    formatted.sort((a, b) => b.engagementScore - a.engagementScore);

    const summary = {
      totalMaterials: formatted.length,
      totalViews: formatted.reduce((sum, m) => sum + m.totalViews, 0),
      totalDownloads: formatted.reduce((sum, m) => sum + m.downloads, 0),
      totalCompletions: formatted.reduce((sum, m) => sum + m.completions, 0),
    };

    return res.json({ success: true, data: formatted.slice(0, limit), summary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/admin-analytics/system-health
// AI service health + DB stats
router.get('/system-health', adminAuth, async (req, res) => {
  const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbStatus = dbState[mongoose.connection.readyState] || 'unknown';

  let aiHealth = { status: 'unreachable', models: null, latencyMs: null };
  try {
    const start = Date.now();
    const aiRes = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
    aiHealth = {
      status: aiRes.data?.status || 'ok',
      models: aiRes.data?.models || null,
      latencyMs: Date.now() - start,
      details: aiRes.data,
    };
  } catch {
    aiHealth.status = 'unreachable';
  }

  return res.json({
    success: true,
    data: {
      database: { status: dbStatus, healthy: dbStatus === 'connected' },
      aiService: aiHealth,
      checkedAt: new Date().toISOString(),
    },
  });
});

// GET /api/admin-analytics/exam-integrity
// Detects suspicious exam attempt patterns: very fast submissions, timed-out attempts
router.get('/exam-integrity', adminAuth, async (req, res) => {
  try {
    const schoolObjId = toObjId(req.schoolId);
    if (!schoolObjId) return res.status(400).json({ error: 'Invalid schoolId' });

    const scope = await resolveClassScope(req);
    const attempts = await ExamAttempt.find({
      schoolId: schoolObjId,
      ...(req.campusId ? { campusId: req.campusId } : {}),
      ...(scope ? { studentId: { $in: scope.studentIds } } : {}),
      status: { $in: ['submitted', 'timed_out'] },
      submittedAt: { $exists: true },
    })
      .populate('examId', 'title duration')
      .populate('studentId', 'name grade section')
      .lean();

    const flags = [];
    for (const attempt of attempts) {
      const durationMs = attempt.submittedAt
        ? new Date(attempt.submittedAt) - new Date(attempt.startedAt)
        : null;
      const durationMin = durationMs != null ? Math.round(durationMs / 60000) : null;
      const examDurationMin = attempt.examId?.duration || null;

      const issues = [];

      if (attempt.status === 'timed_out') {
        issues.push('Timed out');
      }

      // Flag if submitted in under 20% of allotted time (and faster than 2 min)
      if (
        durationMin !== null &&
        durationMin < 2
      ) {
        issues.push(`Submitted in ${durationMin}m (very fast)`);
      } else if (
        durationMin !== null &&
        examDurationMin &&
        durationMin < examDurationMin * 0.2
      ) {
        issues.push(`Submitted in ${durationMin}m of ${examDurationMin}m exam`);
      }

      if (issues.length) {
        flags.push({
          attemptId: attempt._id,
          studentName: attempt.studentId?.name || 'Unknown',
          grade: attempt.studentId?.grade || '—',
          section: attempt.studentId?.section || '—',
          examTitle: attempt.examId?.title || 'Unknown Exam',
          durationMin,
          examDurationMin,
          score: attempt.percentage,
          status: attempt.status,
          issues,
          submittedAt: attempt.submittedAt,
        });
      }
    }

    flags.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    const summary = {
      totalAttempts: attempts.length,
      flaggedCount: flags.length,
      timedOutCount: flags.filter((f) => f.issues.includes('Timed out')).length,
      fastSubmissions: flags.filter((f) => f.issues.some((i) => i.includes('fast') || i.includes('min of'))).length,
    };

    return res.json({ success: true, data: flags, summary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/admin-analytics/weak-areas?subject=&classId=
// School-level subject weak area report — aggregates mastery by subject/topic for admin view.
router.get('/weak-areas', adminAuth, async (req, res) => {
  try {
    const schoolObjId = toObjId(req.schoolId);
    if (!schoolObjId) return res.status(400).json({ error: 'Invalid schoolId' });
    const { subject, classId } = req.query;
    const limit = parseLimit(req.query.limit);
    if (!limit) return res.status(400).json({ error: 'limit must be a positive integer' });
    if (classId && !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ error: 'Invalid classId' });
    }
    const ErrorRecord = require('../models/ErrorRecord');

    const matchFilter = { schoolId: schoolObjId };
    if (subject) {
      const normalizedSubject = String(subject).trim();
      if (normalizedSubject.length > 100) {
        return res.status(400).json({ error: 'subject must be 100 characters or fewer' });
      }
      matchFilter.subject = { $regex: escapeRegex(normalizedSubject), $options: 'i' };
    }
    const studentIds = (req.campusId || classId)
      ? await scopedStudentIds(req, classId ? { classId } : {})
      : null;
    if (studentIds) {
      matchFilter.studentId = { $in: studentIds };
    }

    const [masteryWeak, errorAgg] = await Promise.all([
      MasteryScore.aggregate([
        { $match: { schoolId: schoolObjId, ...(studentIds ? { studentId: { $in: studentIds } } : {}), score: { $lt: 60 } } },
        { $group: {
          _id: { subject: '$subject', topicTitle: '$topicTitle' },
          avgScore: { $avg: '$score' },
          studentCount: { $sum: 1 },
        }},
        { $sort: { avgScore: 1 } },
        { $limit: limit },
        { $project: { subject: '$_id.subject', topicTitle: '$_id.topicTitle', avgScore: { $round: ['$avgScore', 1] }, studentCount: 1, _id: 0 } },
      ]),
      ErrorRecord.aggregate([
        { $match: matchFilter },
        { $group: { _id: { subject: '$subject', topicTitle: '$topicTitle', errorType: '$errorType' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]),
    ]);

    return res.json({ success: true, data: { masteryWeak, errorBreakdown: errorAgg } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/admin-analytics/ai-insights
// Proxies analytics payload to the Python AI service for LLM-generated insights.
// report_type: "overview" | "dropout" | "teacher" | "integrity"
router.post('/ai-insights', aiInsightsLimiter, adminAuth, async (req, res) => {
  const { report_type, ...rest } = req.body;
  if (!report_type) {
    return res.status(400).json({ error: 'report_type is required' });
  }
  try {
    const aiRes = await axios.post(
      `${AI_SERVICE_URL}/generate/admin-insights`,
      { report_type, ...rest },
      { timeout: 120_000 }  // Ollama can be slow on first run; allow 2 min
    );
    return res.json({ success: true, content: aiRes.data.content, report_type });
  } catch (err) {
    const status = err.response?.status || 503;
    const message = err.response?.data?.detail || err.message || 'AI service unavailable';
    return res.status(status).json({ error: message });
  }
});

// ── GET /api/admin-analytics/equity-monitoring ────────────────────────────────
// Checks whether the AI answer evaluator's average score and needs-review rate
// are consistent across gender cohorts. A flagged gap is a prompt for a human
// to look closer, not a verdict — see equityMonitoringService.js for the
// deliberate scope decision (gender only; caste/religion/category excluded).
router.get('/equity-monitoring', adminAuth, async (req, res) => {
  try {
    const { computeGenderModelParity } = require('../services/equityMonitoringService');
    const sinceDays = Number(req.query.sinceDays) || 90;
    const data = await computeGenderModelParity({ schoolId: req.schoolId, sinceDays });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
