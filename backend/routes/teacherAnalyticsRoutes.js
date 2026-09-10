const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authTeacher = require('../middleware/authTeacher');
const StudentUser = require('../models/StudentUser');
const ExamResult = require('../models/ExamResult');
const TeacherAllocation = require('../models/TeacherAllocation');
const InterventionLog = require('../models/InterventionLog');
const MasteryScore = require('../models/MasteryScore');
const PracticeAttempt = require('../models/PracticeAttempt');
const PracticeQuestion = require('../models/PracticeQuestion');
const {
  buildTeacherAllocationScope,
  scopeAllowsRequest,
  studentIsWithinTeacherScope,
  teacherHasClassAllocation,
} = require('../utils/teacherAllocationScope');

// Id-based guard for endpoints keyed by classId rather than class/section names.
const requireClassIdAllocation = async (req, res, { classId, sectionId, subjectId } = {}) => {
  const schoolId = req.schoolId;
  const teacherId = req.user?.id || req.teacher?.id;
  if (!schoolId || !teacherId) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (!classId) {
    // No class specified — caller must instead scope by teacherId directly.
    return true;
  }
  const allowed = await teacherHasClassAllocation({
    schoolId, campusId: req.campusId || null, teacherId, classId, sectionId, subjectId,
  });
  if (!allowed) {
    res.status(403).json({ error: 'You are not allocated to this class' });
    return false;
  }
  return true;
};

// ── Scope guard ───────────────────────────────────────────────────────────────
// Every analytics endpoint reads a subset of students by class/section. This
// resolves the requesting teacher's allocations and, when the request names a
// specific className/section, confirms the teacher is actually allocated to
// it. When no className/section is given, callers must instead intersect
// their student query against the returned scope (see buildScopedStudentFilter).
const requireTeacherScope = async (req, res, { className, section, subject } = {}) => {
  const schoolId = req.schoolId;
  const teacherId = req.user?.id || req.teacher?.id;
  if (!schoolId || !teacherId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const scope = await buildTeacherAllocationScope({ schoolId, campusId: req.campusId || null, teacherId });
  if (!scope.length) {
    res.status(403).json({ error: 'No class allocations found for this teacher' });
    return null;
  }
  if (className || section) {
    if (!scopeAllowsRequest(scope, { grade: className, section, subject })) {
      res.status(403).json({ error: 'You are not allocated to this class/section' });
      return null;
    }
  }
  return scope;
};

// Builds a student-query filter restricted to the teacher's allocated
// class/section pairs, honoring an optional explicit className/section
// (already validated against scope by requireTeacherScope).
const buildScopedStudentFilter = (schoolId, scope, { className, section } = {}) => {
  const or = [];
  scope.forEach((item) => {
    if (className && String(className).replace(/^class\s+/i, '').toLowerCase() !== item.normalizedClass) return;
    if (section && item.normalizedSection && section.toLowerCase() !== item.normalizedSection) return;
    const classClause = { $or: [{ grade: item.className }, { grade: `Class ${item.className}` }] };
    const clause = item.sectionName
      ? { $and: [classClause, { section: item.sectionName }] }
      : classClause;
    or.push(clause);
  });
  return { schoolId, ...(or.length ? { $or: or } : { _id: { $in: [] } }) };
};

// ── Compute composite at-risk score for a student ────────────────────────────
// Factors: attendance %, exam score avg, score trend (declining?), submission rate
const computeRiskScore = (student, examResults = []) => {
  const attendance = Array.isArray(student.attendance) ? student.attendance : [];
  const totalDays = attendance.length;
  const presentDays = attendance.filter((a) => a.status === 'present').length;
  const attPct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

  // Avg exam score (last 6)
  const recent = examResults.slice(-6);
  const avgScore = recent.length
    ? Math.round(recent.reduce((s, r) => s + (Number(r.marks) || 0), 0) / recent.length)
    : null;

  // Score trend: compare first half vs second half (declining = risk)
  let scoreTrend = 0; // positive = improving, negative = declining
  if (recent.length >= 4) {
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const avgFirst = firstHalf.reduce((s, r) => s + (Number(r.marks) || 0), 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, r) => s + (Number(r.marks) || 0), 0) / secondHalf.length;
    scoreTrend = avgSecond - avgFirst;
  }

  // Composite risk score (0-100, higher = more at risk)
  let risk = 0;
  if (attPct < 60)       risk += 35;
  else if (attPct < 75)  risk += 20;
  else if (attPct < 85)  risk += 8;

  if (avgScore !== null) {
    if (avgScore < 35)     risk += 40;
    else if (avgScore < 50) risk += 25;
    else if (avgScore < 65) risk += 12;
  }

  if (scoreTrend < -10)  risk += 15;
  else if (scoreTrend < -5) risk += 8;

  const level = risk >= 60 ? 'critical' : risk >= 40 ? 'high' : risk >= 20 ? 'medium' : 'low';

  return { risk, level, attPct, avgScore, scoreTrend: Math.round(scoreTrend) };
};

// ── GET /api/teacher-analytics/at-risk ───────────────────────────────────────
router.get('/at-risk', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { className, section } = req.query;

    const scope = await requireTeacherScope(req, res, { className, section });
    if (!scope) return;

    const filter = buildScopedStudentFilter(schoolId, scope, { className, section });

    const students = await StudentUser.find(filter)
      .select('name roll grade section attendance')
      .lean();

    // Get exam results for all these students in one query
    const studentIds = students.map((s) => s._id);
    const allResults = await ExamResult.find({
      schoolId,
      studentId: { $in: studentIds },
      published: true,
    })
      .populate('examId', 'subject marks date')
      .sort({ createdAt: 1 })
      .lean();

    // Group by student
    const resultsByStudent = {};
    allResults.forEach((r) => {
      const sid = String(r.studentId);
      if (!resultsByStudent[sid]) resultsByStudent[sid] = [];
      resultsByStudent[sid].push(r);
    });

    const atRiskStudents = students
      .map((student) => {
        const results = resultsByStudent[String(student._id)] || [];
        const metrics = computeRiskScore(student, results);
        return {
          studentId: student._id,
          name: student.name,
          roll: student.roll,
          grade: student.grade,
          section: student.section,
          ...metrics,
          recentScores: results.slice(-3).map((r) => ({
            subject: r.examId?.subject || '',
            marks: r.marks,
            maxMarks: r.examId?.marks,
            date: r.examId?.date,
          })),
        };
      })
      .filter((s) => s.level !== 'low')
      .sort((a, b) => b.risk - a.risk);

    return res.json({ success: true, data: atRiskStudents });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/class-trends ───────────────────────────────────
router.get('/class-trends', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { className, section } = req.query;

    const scope = await requireTeacherScope(req, res, { className, section });
    if (!scope) return;

    const filter = buildScopedStudentFilter(schoolId, scope, { className, section });

    const students = await StudentUser.find(filter).select('_id grade section attendance').lean();
    const studentIds = students.map((s) => s._id);

    // Exam results grouped by subject over time
    const results = await ExamResult.find({
      schoolId, studentId: { $in: studentIds }, published: true,
    })
      .populate('examId', 'subject marks date term')
      .sort({ createdAt: 1 })
      .lean();

    // Group by subject → array of {date, avgPct}
    const subjectMap = {};
    results.forEach((r) => {
      const subject = r.examId?.subject || 'Unknown';
      const maxM = r.examId?.marks || 100;
      const pct = Math.round((r.marks / maxM) * 100);
      const date = r.examId?.date || r.createdAt;
      if (!subjectMap[subject]) subjectMap[subject] = [];
      subjectMap[subject].push({ date, pct });
    });

    const subjectTrends = Object.entries(subjectMap).map(([subject, pts]) => {
      const sorted = [...pts].sort((a, b) => new Date(a.date) - new Date(b.date));
      // Average by date bucket
      return { subject, points: sorted };
    });

    // Attendance trend: daily avg across class (last 30 records per student)
    const attByDate = {};
    students.forEach((s) => {
      (s.attendance || []).slice(-30).forEach((a) => {
        const d = String(a.date || '').slice(0, 10);
        if (!d) return;
        if (!attByDate[d]) attByDate[d] = { present: 0, total: 0 };
        attByDate[d].total++;
        if (a.status === 'present') attByDate[d].present++;
      });
    });
    const attendanceTrend = Object.entries(attByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-20)
      .map(([date, { present, total }]) => ({
        date,
        attPct: Math.round((present / total) * 100),
      }));

    // Class stats
    const totalStudents = students.length;
    const allAttPct = students.map((s) => {
      const att = s.attendance || [];
      const p = att.filter((a) => a.status === 'present').length;
      return att.length > 0 ? Math.round((p / att.length) * 100) : 100;
    });
    const avgAttPct = allAttPct.length
      ? Math.round(allAttPct.reduce((s, v) => s + v, 0) / allAttPct.length) : 0;

    return res.json({
      success: true,
      data: { subjectTrends, attendanceTrend, totalStudents, avgAttPct },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/teacher-analytics/interventions ─────────────────────────────────
router.post('/interventions', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id || req.teacher?.id;
    if (!schoolId || !teacherId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      studentId, studentName, riskLevel, reason, action, notes, scheduledDate,
      planTemplate = 'targeted_reteach', subject = '', topicId = '', baselineScore,
    } = req.body || {};
    if (!studentId || !reason || !action) {
      return res.status(400).json({ error: 'studentId, reason, and action are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }
    const student = await StudentUser.findOne({ _id: studentId, schoolId })
      .select('name grade section').lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });
    const scope = await requireTeacherScope(req, res);
    if (!scope) return;
    if (!studentIsWithinTeacherScope(student, scope)) {
      return res.status(403).json({ error: 'You are not allocated to this student\'s class' });
    }

    // Freeze a pre-intervention baseline now so follow-up improvement can be
    // measured automatically. Use the caller's value when given, otherwise the
    // student's most recent credible assessment for this subject/topic.
    let baseline = (baselineScore !== '' && baselineScore != null && Number.isFinite(Number(baselineScore)))
      ? Number(baselineScore) : null;
    if (baseline == null) {
      const { computeBaseline } = require('../services/interventionFollowUpService');
      const events = await require('../models/MasteryEvent')
        .find({ schoolId, studentId, ...(subject ? { subject } : {}) })
        .sort({ createdAt: 1 }).lean();
      baseline = computeBaseline(events, Date.now(), { subject, topicId });
    }

    const log = await InterventionLog.create({
      schoolId, campusId: req.campusId || null, teacherId,
      studentId, studentName: studentName || student.name || '',
      riskLevel: riskLevel || 'medium',
      subject, topicId, baselineScore: baseline,
      reason, action, notes: notes || '',
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      planTemplate,
      followUpAssessments: [7, 14, 30].map((daysAfter) => ({
        daysAfter,
        scheduledDate: new Date(Date.now() + daysAfter * 24 * 60 * 60 * 1000),
      })),
      status: 'planned',
    });
    return res.status(201).json({ success: true, data: log });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/interventions ──────────────────────────────────
router.get('/interventions', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id || req.teacher?.id;
    const { studentId, status } = req.query;
    const filter = { schoolId, teacherId };
    if (studentId) filter.studentId = studentId;
    if (status) filter.status = status;
    const logs = await InterventionLog.find(filter).sort({ createdAt: -1 }).lean();
    const now = Date.now();
    const summary = {
      open: logs.filter((item) => ['planned', 'in_progress'].includes(item.status)).length,
      completed: logs.filter((item) => item.status === 'completed').length,
      overdue: logs.filter((item) => item.scheduledDate && new Date(item.scheduledDate).getTime() < now
        && ['planned', 'in_progress'].includes(item.status)).length,
    };
    return res.json({ success: true, data: logs, summary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/teacher-analytics/interventions/:id/outcome ─────────────────────
router.put('/interventions/:id/outcome', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id || req.teacher?.id;
    const { outcome, status, improvement } = req.body || {};
    const log = await InterventionLog.findOneAndUpdate(
      { _id: req.params.id, schoolId, teacherId },
      {
        $set: {
          outcome: outcome || '',
          status: status || 'completed',
          improvement: improvement != null ? Number(improvement) : null,
          resolvedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!log) return res.status(404).json({ error: 'Intervention not found' });
    return res.json({ success: true, data: log });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/at-risk-7day ───────────────────────────────────
// 7-day sliding window — flags students whose last-7-day trend is deteriorating
router.get('/at-risk-7day', authTeacher, async (req, res) => {
  try {
    const students = await require('../utils/analyticsScope').scopedStudents(req);
    const data = await require('../services/classLearningAnalytics').forecastClass(students, req.schoolId);
    return res.json({ success: true, data, windowDays: 7 });
  } catch (err) { return res.status(err.status || 500).json({ error: err.message }); }
});

// ── GET /api/teacher-analytics/misconceptions ─────────────────────────────────
// Aggregate wrong practice-attempt answers to detect class-wide misconceptions
router.get('/misconceptions', authTeacher, async (req, res) => {
  try {
    const students = await require('../utils/analyticsScope').scopedStudents(req);
    const data = await require('../services/classLearningAnalytics').classMisconceptions(students, req.schoolId, req.query.subject);
    return res.json({ success: true, data, totalStudents: students.length });
  } catch (err) { return res.status(err.status || 500).json({ error: err.message }); }
});

// ── GET /api/teacher-analytics/class-gaps ─────────────────────────────────────
// Aggregate mastery scores across a class to identify shared learning gaps
router.get('/class-gaps', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { className, section, subject } = req.query;

    const scope = await requireTeacherScope(req, res, { className, section, subject });
    if (!scope) return;

    const filter = buildScopedStudentFilter(schoolId, scope, { className, section });

    const students = await StudentUser.find(filter).select('_id name').lean();
    const studentIds = students.map((s) => s._id);
    const totalStudents = studentIds.length;
    if (!totalStudents) return res.json({ success: true, data: [], totalStudents: 0 });

    const masteryFilter = { schoolId, studentId: { $in: studentIds } };
    if (subject) masteryFilter.subject = { $regex: subject, $options: 'i' };

    const scores = await MasteryScore.find(masteryFilter).lean();

    // Group by topic
    const topicMap = {};
    scores.forEach((s) => {
      const key = s.subject + '::' + (s.topicTitle || s.topicId);
      if (!topicMap[key]) {
        topicMap[key] = {
          topicId: s.topicId,
          topicTitle: s.topicTitle || s.topicId,
          chapterTitle: s.chapterTitle,
          subject: s.subject,
          scores: [],
        };
      }
      topicMap[key].scores.push(s.score);
    });

    const gaps = Object.values(topicMap)
      .map((t) => {
        const avg = Math.round(t.scores.reduce((a, b) => a + b, 0) / t.scores.length);
        const below50 = t.scores.filter((s) => s < 50).length;
        const coverage = Math.round((t.scores.length / totalStudents) * 100);
        return {
          ...t,
          scores: undefined,
          avgMastery: avg,
          studentsBelow50: below50,
          studentCount: t.scores.length,
          coverage,
          gapSeverity: avg < 40 ? 'critical' : avg < 60 ? 'high' : avg < 75 ? 'medium' : 'low',
        };
      })
      .filter((t) => t.gapSeverity !== 'low')
      .sort((a, b) => a.avgMastery - b.avgMastery);

    return res.json({ success: true, data: gaps, totalStudents });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/student-mastery-all ───────────────────────────
// All students in a class with avg mastery + strong/weak topic breakdown
router.get('/student-mastery-all', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { className, section, subject } = req.query;

    const scope = await requireTeacherScope(req, res, { className, section, subject });
    if (!scope) return;

    const studentFilter = buildScopedStudentFilter(schoolId, scope, { className, section });

    const students = await StudentUser.find(studentFilter)
      .select('name roll grade section')
      .lean();

    if (!students.length) return res.json({ success: true, data: [] });

    const studentIds = students.map((s) => s._id);
    const masteryFilter = { schoolId, studentId: { $in: studentIds } };
    if (subject) masteryFilter.subject = { $regex: subject, $options: 'i' };

    const allScores = await MasteryScore.find(masteryFilter).lean();

    const byStudent = {};
    allScores.forEach((s) => {
      const sid = String(s.studentId);
      if (!byStudent[sid]) byStudent[sid] = [];
      byStudent[sid].push(s);
    });

    const result = students
      .map((student) => {
        const scores = byStudent[String(student._id)] || [];
        if (!scores.length) return null;
        const avgMastery = Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length);
        const tier = avgMastery >= 80 ? 'high' : avgMastery >= 60 ? 'mid' : 'low';
        return {
          studentId: student._id,
          name: student.name,
          roll: student.roll,
          grade: student.grade,
          section: student.section,
          avgMastery,
          tier,
          topicCount: scores.length,
          strongTopics: scores
            .filter((s) => s.score >= 75)
            .map((s) => ({ topicTitle: s.topicTitle, subject: s.subject, score: s.score }))
            .sort((a, b) => b.score - a.score),
          weakTopics: scores
            .filter((s) => s.score < 60)
            .map((s) => ({ topicTitle: s.topicTitle, subject: s.subject, score: s.score }))
            .sort((a, b) => a.score - b.score),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.avgMastery - a.avgMastery);

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/mastery-growth/:studentId ──────────────────────
// Time-series mastery scores for a student — used for the mastery growth report
router.get('/mastery-growth/:studentId', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { studentId } = req.params;
    const { subject } = req.query;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }

    const student = await StudentUser.findOne({ _id: studentId, schoolId }).select('name grade section').lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const scope = await requireTeacherScope(req, res);
    if (!scope) return;
    if (!studentIsWithinTeacherScope(student, scope)) {
      return res.status(403).json({ error: 'You are not allocated to this student\'s class' });
    }

    const filter = { schoolId, studentId: new mongoose.Types.ObjectId(studentId) };
    if (subject) filter.subject = { $regex: subject, $options: 'i' };

    const events = await require('../models/MasteryEvent').find(filter).sort({ createdAt: 1 }).lean();
    const scores = await MasteryScore.find(filter).lean();
    const bySubject = new Map();
    for (const e of events) {
      if (!bySubject.has(e.subject)) bySubject.set(e.subject, []);
      bySubject.get(e.subject).push({ topicTitle: e.topicTitle, chapterTitle: e.chapterTitle, score: e.scoreAfter,
        attemptCount: e.attemptCount, date: e.createdAt, source: e.source, topicId: e.topicId });
    }
    const subjectSummary = [...bySubject].map(([subject, points]) => {
      const latest = scores.filter((s) => s.subject === subject);
      // Compare each topic with its own starting point, never a different topic.
      const changes = new Map();
      for (const p of points) {
        const v = changes.get(p.topicId) || { first: p.score, last: p.score };
        v.last = p.score;
        changes.set(p.topicId, v);
      }
      return { subject, points, topicCount: latest.length,
        avgMastery: latest.length ? Math.round(latest.reduce((n, s) => n + s.score, 0) / latest.length) : null,
        trend: changes.size ? Math.round([...changes.values()].reduce((n, v) => n + v.last - v.first, 0) / changes.size) : null };
    });
    const topicsNearMastery = [];

    return res.json({
      success: true,
      data: {
        student: { name: student.name, grade: student.grade, section: student.section },
        subjectSummary,
        topicsNearMastery,
        totalTopics: scores.length,
        masteredTopics: scores.filter((s) => s.score >= 90).length,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/term-comparison ────────────────────────────────
// Group exam results by term for a class and return per-subject, per-term averages
router.get('/term-comparison', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { className, section, subject } = req.query;

    const scope = await requireTeacherScope(req, res, { className, section, subject });
    if (!scope) return;

    const filter = buildScopedStudentFilter(schoolId, scope, { className, section });

    const students = await StudentUser.find(filter).select('_id').lean();
    const studentIds = students.map((s) => s._id);

    const resultFilter = { schoolId, studentId: { $in: studentIds }, published: true };
    if (subject) resultFilter['examId.subject'] = { $regex: subject, $options: 'i' };

    const results = await ExamResult.find(resultFilter)
      .populate('examId', 'subject marks date term')
      .lean();

    // Build: { subject → { term → [pct, ...] } }
    const matrix = {};
    const terms = new Set();
    results.forEach((r) => {
      const sub = r.examId?.subject;
      const term = r.examId?.term;
      const maxM = r.examId?.marks || 100;
      if (!sub || !term || r.marks == null) return;
      if (subject && sub.toLowerCase() !== subject.toLowerCase()) return;
      terms.add(term);
      if (!matrix[sub]) matrix[sub] = {};
      if (!matrix[sub][term]) matrix[sub][term] = [];
      matrix[sub][term].push(Math.round((r.marks / maxM) * 100));
    });

    const TERM_ORDER = ['Class Test', 'Unit Test', 'Monthly Test', 'Term 1', 'Term 2', 'Term 3', 'Half Yearly', 'Annual', 'Final'];
    const sortedTerms = [...terms].sort((a, b) => {
      const ia = TERM_ORDER.indexOf(a);
      const ib = TERM_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    const subjects = Object.entries(matrix).map(([sub, termData]) => ({
      subject: sub,
      terms: sortedTerms.map((term) => {
        const scores = termData[term] || [];
        return {
          term,
          avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
          count: scores.length,
        };
      }),
    }));

    return res.json({ success: true, data: { subjects, terms: sortedTerms } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/cohort ─────────────────────────────────────────
// Multi-class performance dashboard — aggregates across all classes the teacher is allocated to
router.get('/cohort', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id || req.teacher?.id;
    if (!schoolId || !teacherId) return res.status(401).json({ error: 'Unauthorized' });

    const allocations = await TeacherAllocation.find({ schoolId, teacherId })
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name')
      .lean();

    if (!allocations.length) return res.json({ success: true, data: [] });

    // Fetch results for each allocation in parallel
    const classResults = await Promise.all(
      allocations.map(async (alloc) => {
        const className = alloc.classId?.name || alloc.grade || '';
        const sectionName = alloc.sectionId?.name || alloc.section || '';
        const subjectName = alloc.subjectId?.name || alloc.subject || '';

        const filter = { schoolId };
        if (className) filter.$or = [{ grade: className }, { grade: `Class ${className}` }];
        if (sectionName) filter.section = sectionName;

        const students = await StudentUser.find(filter).select('_id attendance').lean();
        const studentIds = students.map((s) => s._id);
        if (!studentIds.length) return { className, sectionName, subjectName, avgScore: null, avgAtt: null, studentCount: 0 };

        const results = await ExamResult.find({
          schoolId, studentId: { $in: studentIds }, published: true,
          ...(subjectName ? {} : {}),
        })
          .populate('examId', 'subject marks')
          .lean();

        const subjectResults = subjectName
          ? results.filter((r) => (r.examId?.subject || '').toLowerCase() === subjectName.toLowerCase())
          : results;

        const scores = subjectResults.map((r) => {
          const max = r.examId?.marks || 100;
          return Math.round((r.marks / max) * 100);
        }).filter((s) => !isNaN(s));

        const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

        const attPcts = students.map((s) => {
          const att = s.attendance || [];
          return att.length > 0 ? Math.round((att.filter((a) => a.status === 'present').length / att.length) * 100) : 100;
        });
        const avgAtt = attPcts.length ? Math.round(attPcts.reduce((a, b) => a + b, 0) / attPcts.length) : null;

        return { className, sectionName, subjectName, avgScore, avgAtt, studentCount: students.length };
      })
    );

    return res.json({ success: true, data: classResults });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/grade-book-csv — term-end grade book export ───
// Query: ?term=&subject=&className=&sectionName=
// Streams a CSV; also emails it to admin if ADMIN_EMAIL is set
router.get('/grade-book-csv', authTeacher, async (req, res) => {
  try {
    const schoolId  = req.schoolId;
    const { term, subject, className, sectionName } = req.query;

    const scope = await requireTeacherScope(req, res, { className, section: sectionName, subject });
    if (!scope) return;

    const filter = {
      schoolId,
      ...(term ? { 'examId.term': term } : {}),
    };

    const results = await ExamResult.find(filter)
      .populate('examId', 'title subject term grade section marks date')
      .populate('studentId', 'name grade section roll')
      .lean();

    // Filter by teacher's actual class/section/subject allocation scope
    // (name-based, resolved via buildTeacherAllocationScope — never the
    // request's own className/subject query params, so a caller can't widen
    // their own export beyond what they're allocated to).
    const scoped = results.filter((r) => {
      const subj = r.examId?.subject || '';
      const cls  = r.examId?.grade  || r.studentId?.grade || '';
      const sect = r.examId?.section || r.studentId?.section || '';
      if (subject && subj !== subject) return false;
      if (className && cls !== className) return false;
      if (sectionName && sect !== sectionName) return false;
      return scopeAllowsRequest(scope, { grade: cls, section: sect, subject: subj });
    });

    // Build CSV
    const header = 'Student Name,Roll,Grade,Section,Subject,Exam Title,Term,Marks,Total Marks,Percentage\n';
    const rows = scoped.map((r) => {
      const pct = r.examId?.marks ? ((r.marks / r.examId.marks) * 100).toFixed(1) : '-';
      return [
        r.studentId?.name || '-',
        r.studentId?.roll || '-',
        r.studentId?.grade || '-',
        r.studentId?.section || '-',
        r.examId?.subject || '-',
        r.examId?.title || '-',
        r.examId?.term || '-',
        r.marks ?? '-',
        r.examId?.marks || '-',
        pct,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    }).join('\n');

    const csv = header + rows;

    // Non-blocking email to admin — opt-in only (was previously silent/automatic
    // on every export, with no audit trail of grade data leaving the system).
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && String(req.query.notifyAdmin || '').toLowerCase() === 'true') {
      try {
        const { sendMail } = require('../utils/mailer');
        await sendMail({
          to: adminEmail,
          subject: `Grade Book Export — ${subject || 'All Subjects'} ${className || ''} ${term ? '· ' + term : ''}`,
          text: 'Grade book CSV attached.',
          attachments: [{ filename: 'grade-book.csv', content: csv }],
        });
      } catch (_) { /* email failure must not block the download */ }
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="grade-book-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/low-mastery — subjects where class avg < 50% ──
router.get('/low-mastery', authTeacher, async (req, res) => {
  try {
    const schoolId  = req.schoolId;
    const teacherId = req.user?.id || req.teacher?.id;

    const scope = await requireTeacherScope(req, res);
    if (!scope) return;

    const allocations = await TeacherAllocation.find({ schoolId, teacherId })
      .populate('subjectId', 'name')
      .lean();
    const subjects = [...new Set(allocations.map((a) => a.subjectId?.name).filter(Boolean))];
    if (!subjects.length) return res.json({ success: true, data: [] });

    // Restrict the aggregation to students in the teacher's allocated
    // class/section pairs — previously it averaged mastery across every
    // student in the school for the subject.
    const scopedIds = await StudentUser
      .find(buildScopedStudentFilter(schoolId, scope))
      .distinct('_id');
    if (!scopedIds.length) return res.json({ success: true, data: [] });

    const pipeline = [
      { $match: {
        schoolId: mongoose.Types.ObjectId.isValid(schoolId) ? new mongoose.Types.ObjectId(schoolId) : schoolId,
        studentId: { $in: scopedIds },
        subject: { $in: subjects },
      } },
      { $group: { _id: '$subject', avgScore: { $avg: '$score' }, studentCount: { $sum: 1 } } },
      { $match: { avgScore: { $lt: 50 } } },
      { $sort: { avgScore: 1 } },
    ];

    const lowMastery = await MasteryScore.aggregate(pipeline);
    return res.json({ success: true, data: lowMastery });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/mastery-heatmap?className=&section= ────────────
router.get('/mastery-heatmap', authTeacher, async (req, res) => {
  try {
    const { className, section } = req.query;
    const schoolId = req.schoolId;

    const scope = await requireTeacherScope(req, res, { className, section });
    if (!scope) return;

    const filter = buildScopedStudentFilter(schoolId, scope, { className, section });
    const students = await StudentUser.find(filter).select('_id name roll grade section').lean();

    const studentIds = students.map((s) => s._id);
    const records = await MasteryScore.find({ studentId: { $in: studentIds }, schoolId }).lean();

    const topicSet = new Set();
    records.forEach((r) => topicSet.add(r.topicTitle || r.topicId));
    const topics = [...topicSet].slice(0, 20);

    const cells = {};
    for (const s of students) {
      const sid = String(s._id);
      cells[sid] = {};
      const sRecs = records.filter((r) => String(r.studentId) === sid);
      for (const r of sRecs) {
        const key = r.topicTitle || r.topicId;
        if (topics.includes(key)) cells[sid][key] = r.score;
      }
    }

    return res.json({ success: true, data: { students, topics, cells } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/improvement-trends?className=&section=&days=7 ──
router.get('/improvement-trends', authTeacher, async (req, res) => {
  try {
    const { className, section, days = '7' } = req.query;
    const schoolId = req.schoolId;

    const scope = await requireTeacherScope(req, res, { className, section });
    if (!scope) return;

    const N = Math.min(parseInt(days, 10) || 7, 90);
    const now = Date.now();
    const DAY = 86400000;
    const recentStart = now - N * DAY;
    const priorStart = recentStart - N * DAY;

    const filter = buildScopedStudentFilter(schoolId, scope, { className, section });
    const students = await StudentUser.find(filter).select('_id name roll').lean();

    const StudentProgress = require('../models/StudentProgress');
    const results = await Promise.allSettled(students.map(async (s) => {
      const prog = await StudentProgress.findOne({ studentId: s._id, schoolId }).select('submissions').lean();
      const subs = (prog?.submissions || []).filter((sub) => sub.score != null && sub.submittedAt);
      const recent = subs.filter((sub) => new Date(sub.submittedAt).getTime() >= recentStart);
      const prior = subs.filter((sub) => {
        const t = new Date(sub.submittedAt).getTime();
        return t >= priorStart && t < recentStart;
      });
      const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b.score, 0) / arr.length) : null;
      const recentAvg = avg(recent);
      const priorAvg = avg(prior);
      const delta = recentAvg !== null && priorAvg !== null ? recentAvg - priorAvg : null;
      const trend = delta === null ? 'stable' : delta < -5 ? 'declining' : delta > 5 ? 'improving' : 'stable';
      return { studentId: s._id, name: s.name, roll: s.roll, recentAvg, priorAvg, delta, trend };
    }));

    const data = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    return res.json({ success: true, data, days: N });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/bloom-distribution?subject=&className= ──────────
// Returns Bloom taxonomy level counts across all teaching materials for a subject/class.
router.get('/bloom-distribution', authTeacher, async (req, res) => {
  try {
    const { subject, className } = req.query;

    const scope = await requireTeacherScope(req, res, { className, subject });
    if (!scope) return;
    // requireTeacherScope only enforces the allocation match when a class or
    // section is named; a subject-only request must still be checked so a
    // subject teacher can't read Bloom stats for a subject they don't teach.
    if (subject && !scopeAllowsRequest(scope, { grade: className, subject })) {
      return res.status(403).json({ error: 'You are not allocated to this subject' });
    }

    const TeachingMaterial = require('../models/TeachingMaterial');
    const filter = { schoolId: req.schoolId };
    if (subject)   filter.subjectName = { $regex: subject, $options: 'i' };
    if (className) filter.className   = { $regex: className, $options: 'i' };

    const pipeline = [
      { $match: filter },
      { $group: { _id: { $ifNull: ['$bloomLevel', 'unclassified'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ];
    const results = await TeachingMaterial.aggregate(pipeline);
    const distribution = results.map((r) => ({ bloomLevel: r._id, count: r.count }));
    const total = distribution.reduce((s, r) => s + r.count, 0);
    return res.json({ success: true, data: { distribution, total } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/error-breakdown?subject=&classId= ──────────────
// Returns error type breakdown for the teacher's class — feeds the error history view.
router.get('/error-breakdown', authTeacher, async (req, res) => {
  try {
    const { subject, classId } = req.query;
    const scope = await requireTeacherScope(req, res);
    if (!scope) return;
    if (classId && !(await requireClassIdAllocation(req, res, { classId }))) return;

    const ErrorRecord  = require('../models/ErrorRecord');
    // With a classId the caller is already confirmed allocated to it; without
    // one, fall back to the teacher's allocated class/section pairs rather than
    // every student in the school.
    const studentIds   = await StudentUser.distinct('_id', classId
      ? { schoolId: req.schoolId, classId }
      : buildScopedStudentFilter(req.schoolId, scope));
    const matchFilter = { schoolId: req.schoolId, studentId: { $in: studentIds } };
    if (subject) matchFilter.subject = { $regex: subject, $options: 'i' };

    const pipeline = [
      { $match: matchFilter },
      { $group: { _id: { errorType: '$errorType', topicTitle: '$topicTitle' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ];
    const results = await ErrorRecord.aggregate(pipeline);
    return res.json({ success: true, data: results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// NOTE: a duplicate `GET /at-risk?classId=&subject=` handler (using
// services/mlEngine.computeAtRisk) previously lived here. Express only ever
// dispatches to the first-registered `/at-risk` handler (defined above), so
// this second definition was permanently unreachable dead code and has been
// removed. If the mlEngine-based scoring is still wanted, merge it into the
// `/at-risk` handler above rather than re-adding a shadowed duplicate route.

// ── GET /api/teacher-analytics/class-insights?classId=&subject= ──────────────
// AI-generated narrative summary for the whole class, using actual mastery data.
router.get('/class-insights', authTeacher, async (req, res) => {
  try {
    const { classId, subject, className } = req.query;
    const scope = await requireTeacherScope(req, res);
    if (!scope) return;
    if (classId && !(await requireClassIdAllocation(req, res, { classId }))) return;

    const MasteryScore = require('../models/MasteryScore');
    const axios = require('axios');
    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    // Without a classId, restrict to the teacher's allocated class/section
    // pairs — this handler aggregates mastery and forwards it to the LLM, so an
    // unscoped query would leak the whole school's data into the prompt.
    const studentFilter = classId
      ? { schoolId: req.schoolId, classId }
      : buildScopedStudentFilter(req.schoolId, scope);
    const students = await StudentUser.find(studentFilter).select('_id name grade section').lean();

    const filter = { schoolId: req.schoolId, studentId: { $in: students.map((s) => s._id) } };
    if (subject) filter.subject = { $regex: subject, $options: 'i' };
    const masteryRecords = await MasteryScore.find(filter).lean();

    // Aggregate topic averages
    const topicMap = {};
    for (const r of masteryRecords) {
      const key = `${r.subject}::${r.topicTitle}`;
      if (!topicMap[key]) topicMap[key] = { subject: r.subject, topicTitle: r.topicTitle, scores: [] };
      topicMap[key].scores.push(r.score);
    }
    const topicSummary = Object.values(topicMap).map((t) => ({
      subject: t.subject,
      topicTitle: t.topicTitle,
      avgMastery: Math.round(t.scores.reduce((a, b) => a + b, 0) / t.scores.length),
      studentCount: t.scores.length,
    })).sort((a, b) => a.avgMastery - b.avgMastery);

    // Build a compact text summary to send to the AI
    const weakTopics = topicSummary.slice(0, 5).map((t) => `${t.topicTitle} (avg ${t.avgMastery}%)`).join(', ');
    const strongTopics = topicSummary.slice(-3).reverse().map((t) => `${t.topicTitle} (avg ${t.avgMastery}%)`).join(', ');
    const classContext = [
      `Class: ${className || req.query.className || 'Unknown'}, Subject: ${subject || 'All'}`,
      `Students analysed: ${students.length}`,
      `Weakest topics: ${weakTopics || 'N/A'}`,
      `Strongest topics: ${strongTopics || 'N/A'}`,
    ].join('\n');

    const aiRes = await axios.post(`${AI_URL}/generate/tutor`, {
      question: `Provide a concise class performance summary and 3 actionable teaching recommendations based on this data:\n${classContext}`,
      mode: 'summarize',
      subject: subject || 'General',
      school_id: String(req.schoolId),
    }, { timeout: 30000 });

    return res.json({
      success: true,
      data: {
        topicSummary,
        weakTopics: topicSummary.slice(0, 5),
        strongTopics: topicSummary.slice(-3).reverse(),
        studentCount: students.length,
        aiInsight: aiRes.data?.answer || '',
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
