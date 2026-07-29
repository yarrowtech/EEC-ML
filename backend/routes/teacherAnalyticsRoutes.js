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
    const teacherId = req.user?.id || req.teacher?.id;
    if (!schoolId || !teacherId) return res.status(401).json({ error: 'Unauthorized' });

    const { className, section } = req.query;

    // Get students allocated to this teacher
    const allocations = await TeacherAllocation.find({ schoolId, teacherId })
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .lean();

    const filter = {
      schoolId,
      ...(className ? { $or: [{ grade: className }, { grade: `Class ${className}` }] } : {}),
      ...(section ? { section } : {}),
    };

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
    const teacherId = req.user?.id || req.teacher?.id;
    if (!schoolId || !teacherId) return res.status(401).json({ error: 'Unauthorized' });

    const { className, section } = req.query;

    const filter = { schoolId };
    if (className) filter.$or = [{ grade: className }, { grade: `Class ${className}` }];
    if (section) filter.section = section;

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

    const { studentId, studentName, riskLevel, reason, action, notes, scheduledDate } = req.body || {};
    if (!studentId || !reason || !action) {
      return res.status(400).json({ error: 'studentId, reason, and action are required' });
    }
    const log = await InterventionLog.create({
      schoolId, campusId: req.campusId || null, teacherId,
      studentId, studentName: studentName || '',
      riskLevel: riskLevel || 'medium',
      reason, action, notes: notes || '',
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
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
    return res.json({ success: true, data: logs });
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
    const schoolId = req.schoolId;
    if (!schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const { className, section } = req.query;
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const filter = { schoolId };
    if (className) filter.$or = [{ grade: className }, { grade: `Class ${className}` }];
    if (section) filter.section = section;

    const students = await StudentUser.find(filter)
      .select('name roll grade section attendance')
      .lean();

    const studentIds = students.map((s) => s._id);

    // Recent 7-day exam results
    const recentResults = await ExamResult.find({
      schoolId,
      studentId: { $in: studentIds },
      published: true,
      createdAt: { $gte: cutoff },
    })
      .populate('examId', 'subject marks date')
      .lean();

    const resultsByStudent = {};
    recentResults.forEach((r) => {
      const sid = String(r.studentId);
      if (!resultsByStudent[sid]) resultsByStudent[sid] = [];
      resultsByStudent[sid].push(r);
    });

    // Recent 7-day attendance
    const forecast = students.map((student) => {
      const recentAtt = (student.attendance || []).filter((a) => {
        const d = new Date(a.date || a.createdAt || 0);
        return d >= cutoff;
      });
      const attPct7d = recentAtt.length > 0
        ? Math.round((recentAtt.filter((a) => a.status === 'present').length / recentAtt.length) * 100)
        : null;

      const recentExams = resultsByStudent[String(student._id)] || [];
      const avgScore7d = recentExams.length
        ? Math.round(recentExams.reduce((s, r) => s + (Number(r.marks) || 0), 0) / recentExams.length)
        : null;

      // Overall trend from computeRiskScore but weighted to recent 7d data
      const allAtt = student.attendance || [];
      const totalAttPct = allAtt.length > 0
        ? Math.round((allAtt.filter((a) => a.status === 'present').length / allAtt.length) * 100)
        : 100;

      // 7-day risk signals
      const signals = [];
      if (attPct7d !== null && attPct7d < 60) signals.push({ type: 'attendance', severity: 'critical', value: attPct7d });
      else if (attPct7d !== null && attPct7d < 75) signals.push({ type: 'attendance', severity: 'high', value: attPct7d });

      if (avgScore7d !== null && avgScore7d < 40) signals.push({ type: 'score', severity: 'critical', value: avgScore7d });
      else if (avgScore7d !== null && avgScore7d < 60) signals.push({ type: 'score', severity: 'high', value: avgScore7d });

      // Deterioration check: 7-day att vs overall att
      if (attPct7d !== null && attPct7d < totalAttPct - 15) {
        signals.push({ type: 'declining_attendance', severity: 'high', value: totalAttPct - attPct7d });
      }

      const forecastLevel = signals.some((s) => s.severity === 'critical') ? 'critical'
        : signals.some((s) => s.severity === 'high') ? 'high'
        : signals.length > 0 ? 'medium' : 'low';

      return {
        studentId: student._id,
        name: student.name,
        roll: student.roll,
        grade: student.grade,
        section: student.section,
        forecastLevel,
        signals,
        attPct7d,
        avgScore7d,
        totalAttPct,
        examCount7d: recentExams.length,
      };
    })
      .filter((s) => s.forecastLevel !== 'low')
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2 };
        return (order[a.forecastLevel] ?? 3) - (order[b.forecastLevel] ?? 3);
      });

    return res.json({ success: true, data: forecast, windowDays: 7 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/misconceptions ─────────────────────────────────
// Aggregate wrong practice-attempt answers to detect class-wide misconceptions
router.get('/misconceptions', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    if (!schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const { className, section } = req.query;

    const studentFilter = { schoolId };
    if (className) studentFilter.$or = [{ grade: className }, { grade: `Class ${className}` }];
    if (section) studentFilter.section = section;

    const students = await StudentUser.find(studentFilter).select('_id classId sectionId').lean();
    const studentIds = students.map((s) => s._id);
    const totalStudents = studentIds.length;
    if (!totalStudents) return res.json({ success: true, data: [], totalStudents: 0 });

    // Wrong practice attempts for these students
    const wrongAttempts = await PracticeAttempt.find({
      schoolId,
      studentId: { $in: studentIds },
      isCorrect: false,
    })
      .select('questionId answer studentId')
      .lean();

    if (!wrongAttempts.length) return res.json({ success: true, data: [], totalStudents });

    // Group by questionId
    const byQuestion = {};
    wrongAttempts.forEach((a) => {
      const qid = String(a.questionId);
      if (!byQuestion[qid]) byQuestion[qid] = { students: new Set(), wrongAnswers: {} };
      byQuestion[qid].students.add(String(a.studentId));
      const wa = String(a.answer || '(blank)');
      byQuestion[qid].wrongAnswers[wa] = (byQuestion[qid].wrongAnswers[wa] || 0) + 1;
    });

    // Fetch questions for all question IDs
    const questionIds = Object.keys(byQuestion);
    const questions = await PracticeQuestion.find({ _id: { $in: questionIds } })
      .populate('subjectId', 'name')
      .select('question subjectId')
      .lean();

    const questionMap = {};
    questions.forEach((q) => { questionMap[String(q._id)] = q; });

    const patterns = questionIds
      .map((qid) => {
        const entry = byQuestion[qid];
        const q = questionMap[qid];
        if (!q) return null;
        const uniqueStudentCount = entry.students.size;
        const topWrong = Object.entries(entry.wrongAnswers)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([answer, count]) => ({ answer, count, pct: Math.round((count / totalStudents) * 100) }));
        return {
          topic: q.subjectId?.name || 'Unknown Subject',
          question: (q.question || '').slice(0, 200),
          totalWrong: uniqueStudentCount,
          pct: Math.round((uniqueStudentCount / totalStudents) * 100),
          topWrongAnswers: topWrong,
        };
      })
      .filter((p) => p && p.totalWrong >= 2)
      .sort((a, b) => b.totalWrong - a.totalWrong)
      .slice(0, 20);

    return res.json({ success: true, data: patterns, totalStudents });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/class-gaps ─────────────────────────────────────
// Aggregate mastery scores across a class to identify shared learning gaps
router.get('/class-gaps', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    if (!schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const { className, section, subject } = req.query;

    const filter = { schoolId };
    if (className) filter.$or = [{ grade: className }, { grade: `Class ${className}` }];
    if (section) filter.section = section;

    const students = await StudentUser.find(filter).select('_id name').lean();
    const studentIds = students.map((s) => s._id);
    const totalStudents = studentIds.length;
    if (!totalStudents) return res.json({ success: true, data: [], totalStudents: 0 });

    const masteryFilter = { studentId: { $in: studentIds } };
    if (subject) masteryFilter.subject = { $regex: subject, $options: 'i' };

    const scores = await MasteryScore.find(masteryFilter).lean();

    // Group by topic
    const topicMap = {};
    scores.forEach((s) => {
      const key = s.topicTitle || s.topicId;
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
    if (!schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const { className, section, subject } = req.query;

    const studentFilter = { schoolId };
    if (className) studentFilter.$or = [{ grade: className }, { grade: `Class ${className}` }];
    if (section) studentFilter.section = section;

    const students = await StudentUser.find(studentFilter)
      .select('name roll grade section')
      .lean();

    if (!students.length) return res.json({ success: true, data: [] });

    const studentIds = students.map((s) => s._id);
    const masteryFilter = { studentId: { $in: studentIds } };
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

    const filter = { studentId: new mongoose.Types.ObjectId(studentId) };
    if (subject) filter.subject = { $regex: subject, $options: 'i' };

    const scores = await MasteryScore.find(filter).sort({ updatedAt: 1 }).lean();

    // Group by subject for time-series chart
    const subjectSeries = {};
    scores.forEach((s) => {
      const sub = s.subject;
      if (!subjectSeries[sub]) subjectSeries[sub] = [];
      subjectSeries[sub].push({
        topicTitle: s.topicTitle,
        chapterTitle: s.chapterTitle,
        score: s.score,
        attemptCount: s.attemptCount,
        date: s.updatedAt || s.lastUpdated,
      });
    });

    // Overall progress per subject
    const subjectSummary = Object.entries(subjectSeries).map(([sub, points]) => {
      const sorted = [...points].sort((a, b) => new Date(a.date) - new Date(b.date));
      const avg = Math.round(sorted.reduce((a, p) => a + p.score, 0) / sorted.length);
      const trend = sorted.length >= 2
        ? sorted[sorted.length - 1].score - sorted[0].score
        : 0;
      return { subject: sub, avgMastery: avg, trend, points: sorted, topicCount: sorted.length };
    });

    // Time-to-mastery estimate per topic (simple linear projection)
    const topicsNearMastery = scores
      .filter((s) => s.score >= 60 && s.score < 90 && s.attemptCount > 0)
      .map((s) => {
        const gainPerAttempt = s.score / Math.max(s.attemptCount, 1);
        const remainingGain = 90 - s.score;
        const estimatedAttempts = Math.ceil(remainingGain / Math.max(gainPerAttempt, 1));
        return {
          topicTitle: s.topicTitle,
          subject: s.subject,
          currentScore: s.score,
          estimatedAttemptsToMastery: estimatedAttempts,
        };
      })
      .sort((a, b) => a.estimatedAttemptsToMastery - b.estimatedAttemptsToMastery)
      .slice(0, 5);

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
    const teacherId = req.user?.id || req.teacher?.id;
    if (!schoolId || !teacherId) return res.status(401).json({ error: 'Unauthorized' });

    const { className, section, subject } = req.query;

    const filter = { schoolId };
    if (className) filter.$or = [{ grade: className }, { grade: `Class ${className}` }];
    if (section) filter.section = section;

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
    const teacherId = req.user?.id;
    if (!schoolId || !teacherId) return res.status(401).json({ error: 'Unauthorized' });

    const { term, subject, className, sectionName } = req.query;

    const filter = {
      schoolId,
      ...(term    ? { 'examId.term': term }    : {}),
    };

    const results = await ExamResult.find(filter)
      .populate('examId', 'title subject term grade section marks date')
      .populate('studentId', 'name grade section roll')
      .lean();

    // Filter by teacher's subject/class scope
    const allocations = await TeacherAllocation.find({ schoolId, teacherId }).lean();
    const allocSet = new Set(allocations.map((a) => `${a.subject}|${a.className}`));

    const scoped = results.filter((r) => {
      const subj = r.examId?.subject || '';
      const cls  = r.examId?.grade  || r.studentId?.grade || '';
      if (subject && subj !== subject) return false;
      if (className && cls !== className) return false;
      if (sectionName && (r.examId?.section || r.studentId?.section) !== sectionName) return false;
      return allocSet.has(`${subj}|${cls}`) || allocations.length === 0;
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

    // Non-blocking email to admin
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
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
    const teacherId = req.user?.id;
    if (!schoolId || !teacherId) return res.status(401).json({ error: 'Unauthorized' });

    const allocations = await TeacherAllocation.find({ schoolId, teacherId }).lean();
    const subjects = [...new Set(allocations.map((a) => a.subject))];

    const pipeline = [
      { $match: { schoolId: mongoose.Types.ObjectId.isValid(schoolId) ? new mongoose.Types.ObjectId(schoolId) : schoolId, subject: { $in: subjects } } },
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

module.exports = router;
