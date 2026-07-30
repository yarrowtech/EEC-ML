const express = require('express');
const router = express.Router();
const axios = require('axios');
const authParent = require('../middleware/authParent');
const ParentUser = require('../models/ParentUser');
const StudentUser = require('../models/StudentUser');
const MasteryScore = require('../models/MasteryScore');
const ExamResult = require('../models/ExamResult');
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

module.exports = router;
