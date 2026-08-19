const express = require('express');
const router = express.Router();
const axios = require('axios');
const authParent = require('../middleware/authParent');
const ParentUser = require('../models/ParentUser');
const StudentUser = require('../models/StudentUser');
const MasteryScore = require('../models/MasteryScore');
const ExamResult = require('../models/ExamResult');
const Exam = require('../models/Exam');
const StudentObservation = require('../models/StudentObservation');
const ParentDashboardReport = require('../models/ParentDashboardReport');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const TIMEOUT = 120_000;

const callAI = (mode, context) =>
  axios.post(`${AI_SERVICE_URL}/generate/teacher`, { mode, context }, { timeout: TIMEOUT });

const getChildIds = async (parentId) => {
  const parent = await ParentUser.findById(parentId).select('childrenIds').lean();
  return parent?.childrenIds || [];
};

const ownsStudent = (childIds, studentId) =>
  childIds.some((id) => id.toString() === studentId);

// GET /api/parent-dashboard/weak-areas
router.get('/weak-areas', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id);
    if (!childIds.length) return res.json({ success: true, data: [] });

    const weakAreas = await MasteryScore.find({
      studentId: { $in: childIds },
      score: { $lt: 60 },
      schoolId: req.schoolId,
    })
      .sort({ score: 1 })
      .limit(30)
      .populate('studentId', 'name grade section')
      .lean();

    return res.json({ success: true, data: weakAreas });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/parent-dashboard/remarks-feed
router.get('/remarks-feed', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id);
    if (!childIds.length) return res.json({ success: true, data: [] });

    const remarks = await StudentObservation.find({
      studentId: { $in: childIds },
      schoolId: req.schoolId,
      source: 'teacher',
    })
      .sort({ recordedAt: -1 })
      .limit(20)
      .select('studentId studentName observationText category recordedAt concernLevel')
      .lean();

    return res.json({ success: true, data: remarks });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/parent-dashboard/home-support/:studentId
router.get('/home-support/:studentId', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id);
    if (!ownsStudent(childIds, req.params.studentId)) {
      return res.status(403).json({ error: 'Not authorized for this student' });
    }

    const weakAreas = await MasteryScore.find({
      studentId: req.params.studentId,
      score: { $lt: 70 },
      schoolId: req.schoolId,
    })
      .sort({ score: 1 })
      .limit(6)
      .lean();

    if (!weakAreas.length) {
      return res.json({
        success: true,
        data: { content: 'Great news — no weak areas identified right now! Keep encouraging regular study and reading habits at home.' },
      });
    }

    const context = weakAreas.map((w) => `${w.subject} — ${w.topicTitle}: ${w.score}%`).join('\n');
    const aiRes = await callAI('home_support', context);
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error' });
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/parent-dashboard/weekly-digest/:studentId
router.get('/weekly-digest/:studentId', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id);
    if (!ownsStudent(childIds, req.params.studentId)) {
      return res.status(403).json({ error: 'Not authorized for this student' });
    }

    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const existing = await ParentDashboardReport.findOne({
      parentId: req.user.id,
      studentId: req.params.studentId,
      type: 'weekly_digest',
    }).lean();

    if (existing && Date.now() - new Date(existing.generatedAt) < SEVEN_DAYS) {
      return res.json({ success: true, data: { content: existing.content, generatedAt: existing.generatedAt } });
    }

    const since = new Date(Date.now() - SEVEN_DAYS);
    const [recentExams, recentMastery, student] = await Promise.all([
      ExamResult.find({ studentId: req.params.studentId, createdAt: { $gte: since } }).lean(),
      MasteryScore.find({ studentId: req.params.studentId, lastUpdated: { $gte: since } }).lean(),
      StudentUser.findById(req.params.studentId).select('name grade section').lean(),
    ]);

    const examSummary = recentExams.length
      ? recentExams.map((e) => `${e.subject}: ${e.marksObtained}/${e.totalMarks}`).join(', ')
      : 'No exams this week';
    const masterySummary = recentMastery.length
      ? recentMastery.map((m) => `${m.subject}/${m.topicTitle}: ${m.score}%`).join(', ')
      : 'No mastery activity';

    const context = `Student: ${student?.name || 'Student'}, Class ${student?.grade || ''} ${student?.section || ''}\nExams this week: ${examSummary}\nMastery updates: ${masterySummary}`;
    const aiRes = await callAI('progress_digest', context);
    const content = aiRes.data?.content || '';

    await ParentDashboardReport.findOneAndUpdate(
      { parentId: req.user.id, studentId: req.params.studentId, type: 'weekly_digest' },
      { content, generatedAt: new Date(), schoolId: req.schoolId },
      { upsert: true, new: true }
    );

    return res.json({ success: true, data: { content, generatedAt: new Date() } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error' });
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/parent-dashboard/monthly-report/:studentId
router.get('/monthly-report/:studentId', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id);
    if (!ownsStudent(childIds, req.params.studentId)) {
      return res.status(403).json({ error: 'Not authorized for this student' });
    }

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const existing = await ParentDashboardReport.findOne({
      parentId: req.user.id,
      studentId: req.params.studentId,
      type: 'monthly_report',
    }).lean();

    if (existing && Date.now() - new Date(existing.generatedAt) < THIRTY_DAYS) {
      return res.json({ success: true, data: { content: existing.content, generatedAt: existing.generatedAt } });
    }

    const since = new Date(Date.now() - THIRTY_DAYS);
    const [exams, mastery, remarks, student] = await Promise.all([
      ExamResult.find({ studentId: req.params.studentId, createdAt: { $gte: since } }).lean(),
      MasteryScore.find({ studentId: req.params.studentId }).lean(),
      StudentObservation.find({
        studentId: req.params.studentId,
        source: 'teacher',
        recordedAt: { $gte: since },
      })
        .select('observationText category concernLevel')
        .lean(),
      StudentUser.findById(req.params.studentId).select('name grade section').lean(),
    ]);

    const examSummary = exams.length
      ? exams.map((e) => `${e.subject}: ${e.marksObtained}/${e.totalMarks}`).join('; ')
      : 'No exams this month';
    const masterySummary = mastery.length
      ? mastery.map((m) => `${m.subject}/${m.topicTitle}: ${m.score}%`).join('; ')
      : 'No mastery data';
    const remarksSummary = remarks.length
      ? remarks.map((r) => `[${r.category}] ${r.observationText}`).join(' | ')
      : 'No remarks this month';

    const context = `Student: ${student?.name || 'Student'}, Class ${student?.grade || ''} ${student?.section || ''}\nExam results: ${examSummary}\nMastery scores: ${masterySummary}\nTeacher remarks: ${remarksSummary}`;
    const aiRes = await callAI('monthly_report', context);
    const content = aiRes.data?.content || '';

    await ParentDashboardReport.findOneAndUpdate(
      { parentId: req.user.id, studentId: req.params.studentId, type: 'monthly_report' },
      { content, generatedAt: new Date(), schoolId: req.schoolId },
      { upsert: true, new: true }
    );

    return res.json({ success: true, data: { content, generatedAt: new Date() } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error' });
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/parent-dashboard/analytics/academic/:studentId
router.get('/analytics/academic/:studentId', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id);
    if (!ownsStudent(childIds, req.params.studentId)) {
      return res.status(403).json({ error: 'Not authorized for this student' });
    }
    const sid = req.params.studentId;

    const [masteryScores, examResults, student] = await Promise.all([
      MasteryScore.find({ studentId: sid, schoolId: req.schoolId }).lean(),
      ExamResult.find({ studentId: sid }).populate('examId', 'title subject date totalMarks').lean(),
      StudentUser.findById(sid).select('name grade section attendance').lean(),
    ]);

    // Subject-wise mastery grouped
    const subjectMap = {};
    for (const m of masteryScores) {
      if (!subjectMap[m.subject]) subjectMap[m.subject] = { scores: [], topics: [] };
      subjectMap[m.subject].scores.push(m.score);
      subjectMap[m.subject].topics.push({ title: m.topicTitle, score: m.score, chapter: m.chapterTitle });
    }
    const subjectBreakdown = Object.entries(subjectMap).map(([subject, { scores, topics }]) => ({
      subject,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      topicCount: scores.length,
      topics: topics.sort((a, b) => a.score - b.score),
    })).sort((a, b) => b.avg - a.avg);

    // Exam trend (last 12 published results)
    const examTrend = examResults
      .filter((r) => r.examId)
      .map((r) => ({
        title: r.examId?.title || 'Exam',
        subject: r.examId?.subject || '',
        date: r.examId?.date || r.createdAt,
        marks: r.marks,
        total: r.examId?.totalMarks || 100,
        percentage: r.examId?.totalMarks ? Math.round((r.marks / r.examId.totalMarks) * 100) : null,
        grade: r.grade,
        status: r.status,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-12);

    // Attendance summary from embedded array
    const attendance = Array.isArray(student?.attendance) ? student.attendance : [];
    const presentDays = attendance.filter((a) => String(a.status).toLowerCase() === 'present').length;
    const totalDays = attendance.length;
    const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null;

    // Monthly attendance trend (last 6 months)
    const monthlyAttendance = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      const records = attendance.filter((a) => {
        const dt = new Date(a.date);
        return dt.getFullYear() === yr && dt.getMonth() === mo;
      });
      const present = records.filter((a) => String(a.status).toLowerCase() === 'present').length;
      monthlyAttendance.push({ label, present, total: records.length, pct: records.length ? Math.round((present / records.length) * 100) : null });
    }

    return res.json({
      success: true,
      data: {
        student: { name: student?.name, grade: student?.grade, section: student?.section },
        subjectBreakdown,
        examTrend,
        attendanceSummary: { presentDays, totalDays, attendancePct },
        monthlyAttendance,
        overallMastery: masteryScores.length
          ? Math.round(masteryScores.reduce((a, b) => a + b.score, 0) / masteryScores.length)
          : null,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/parent-dashboard/analytics/wellbeing/:studentId
router.get('/analytics/wellbeing/:studentId', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id);
    if (!ownsStudent(childIds, req.params.studentId)) {
      return res.status(403).json({ error: 'Not authorized for this student' });
    }
    const sid = req.params.studentId;

    const observations = await StudentObservation.find({
      studentId: sid,
      schoolId: req.schoolId,
    })
      .sort({ recordedAt: -1 })
      .limit(60)
      .lean();

    // Concern level distribution
    const concernCounts = { low: 0, medium: 0, high: 0, urgent: 0 };
    for (const o of observations) {
      const lvl = String(o.concernLevel || 'low').toLowerCase();
      if (concernCounts[lvl] !== undefined) concernCounts[lvl]++;
    }

    // Category breakdown
    const categoryMap = {};
    for (const o of observations) {
      const cat = o.category || 'General';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    }
    const categoryBreakdown = Object.entries(categoryMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Mood trend (last 20 with a moodRating)
    const moodTrend = observations
      .filter((o) => o.moodRating != null)
      .slice(0, 20)
      .map((o) => ({
        date: o.recordedAt,
        mood: o.moodRating,
        note: o.observationText?.slice(0, 80) || '',
      }))
      .reverse();

    // Monthly observation count (last 6 months)
    const monthlyObservations = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      const count = observations.filter((o) => {
        const dt = new Date(o.recordedAt);
        return dt.getFullYear() === yr && dt.getMonth() === mo;
      }).length;
      monthlyObservations.push({ label, count });
    }

    // Recent observations for feed
    const recentObservations = observations.slice(0, 8).map((o) => ({
      date: o.recordedAt,
      text: o.observationText,
      category: o.category,
      concernLevel: o.concernLevel,
      moodRating: o.moodRating,
      followUpRequired: o.followUpRequired,
    }));

    const avgMood = moodTrend.length
      ? Math.round((moodTrend.reduce((a, b) => a + b.mood, 0) / moodTrend.length) * 10) / 10
      : null;

    return res.json({
      success: true,
      data: {
        totalObservations: observations.length,
        avgMood,
        concernCounts,
        categoryBreakdown,
        moodTrend,
        monthlyObservations,
        recentObservations,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
