const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const adminAuth = require('../middleware/adminAuth');
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

// GET /api/admin-analytics/mastery-matrix
router.get('/mastery-matrix', adminAuth, async (req, res) => {
  try {
    const schoolObjId = toObjId(req.schoolId);
    if (!schoolObjId) return res.status(400).json({ error: 'Invalid schoolId' });

    const rows = await MasteryScore.aggregate([
      { $match: { schoolId: schoolObjId } },
      {
        $lookup: {
          from: 'studentusers',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmpty: false } },
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

    const subjects = [...new Set(rows.map((r) => r.subject))].sort();
    const grades = [...new Set(rows.map((r) => r.grade))].sort();
    const matrix = {};
    for (const r of rows) {
      if (!matrix[r.grade]) matrix[r.grade] = {};
      matrix[r.grade][r.subject] = r.avgScore;
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

    const [teachers, subjectMastery] = await Promise.all([
      TeacherUser.find({ schoolId: req.schoolId })
        .select('name subject email phone')
        .lean(),
      MasteryScore.aggregate([
        { $match: { schoolId: schoolObjId } },
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
      ]),
    ]);

    const masteryBySubject = {};
    for (const s of subjectMastery) {
      masteryBySubject[s.subject] = s;
    }

    const result = teachers.map((t) => {
      const subjectStats = masteryBySubject[t.subject] || {};
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

    const rows = await MasteryScore.aggregate([
      { $match: { schoolId: schoolObjId } },
      {
        $group: {
          _id: '$subject',
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
          subject: '$_id',
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

    const students = await StudentUser.find({ schoolId: req.schoolId, status: 'Active' })
      .select('name grade section attendance')
      .lean();

    const failedResults = await ExamResult.aggregate([
      { $match: { schoolId: schoolObjId, status: 'fail' } },
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
      const total = student.attendance?.length || 0;
      const present = student.attendance?.filter((a) => a.status === 'present').length || 0;
      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;
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
          failedExams: failCount,
          riskLevel,
          reasons: [
            ...(lowAttendance ? [`Attendance ${attendanceRate}%`] : []),
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

    const rows = await ExamResult.aggregate([
      {
        $match: {
          schoolId: schoolObjId,
          createdAt: { $gte: sixMonthsAgo },
          status: { $ne: 'absent' },
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
      { $unwind: { path: '$student', preserveNullAndEmpty: false } },
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
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const materials = await TeachingMaterial.find({ schoolId: req.schoolId })
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

    const attempts = await ExamAttempt.find({
      schoolId: schoolObjId,
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

// POST /api/admin-analytics/ai-insights
// Proxies analytics payload to the Python AI service for LLM-generated insights.
// report_type: "overview" | "dropout" | "teacher" | "integrity"
router.post('/ai-insights', adminAuth, async (req, res) => {
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

module.exports = router;
