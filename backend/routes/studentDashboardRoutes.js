const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authStudent = require('../middleware/authStudent');
const MasteryScore = require('../models/MasteryScore');
const StudentProgress = require('../models/StudentProgress');
const TeachingMaterial = require('../models/TeachingMaterial');
const PracticeAttempt = require('../models/PracticeAttempt');
const ExamResult = require('../models/ExamResult');
const FlashcardResult = require('../models/FlashcardResult');

// GET /api/student-dashboard/mastery-topics
router.get('/mastery-topics', authStudent, async (req, res) => {
  try {
    const studentId = req.user.id;
    const schoolId = req.schoolId;
    const records = await MasteryScore.find({ studentId, schoolId })
      .sort({ score: -1 })
      .limit(10)
      .lean();
    const data = records.map((r) => ({
      topicId: r.topicId,
      topicTitle: r.topicTitle,
      subject: r.subject,
      score: r.score,
      attemptCount: r.attemptCount,
      tier: r.score >= 80 ? 'high' : r.score >= 60 ? 'mid' : 'low',
    }));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/student-dashboard/learning-streak
router.get('/learning-streak', authStudent, async (req, res) => {
  try {
    const studentId = req.user.id;
    const schoolId = req.schoolId;

    const [masteryDates, examDates, practiceDates] = await Promise.all([
      MasteryScore.find({ studentId, schoolId }).select('lastUpdated').limit(500).lean(),
      ExamResult.find({ studentId, schoolId }).select('createdAt').limit(500).lean(),
      PracticeAttempt.find({ studentId, schoolId }).select('createdAt').limit(500).lean(),
    ]);

    const allDates = [
      ...masteryDates.map((r) => r.lastUpdated),
      ...examDates.map((r) => r.createdAt),
      ...practiceDates.map((r) => r.createdAt),
    ]
      .filter(Boolean)
      .map((d) => new Date(d).toISOString().slice(0, 10));

    const uniqueDates = [...new Set(allDates)].sort().reverse();
    const totalActiveDays = uniqueDates.length;

    let streak = 0;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const startDate = uniqueDates[0] === today || uniqueDates[0] === yesterday ? uniqueDates[0] : null;

    if (startDate) {
      let cursor = new Date(startDate);
      for (const d of uniqueDates) {
        const expected = cursor.toISOString().slice(0, 10);
        if (d === expected) {
          streak++;
          cursor = new Date(cursor.getTime() - 86400000);
        } else {
          break;
        }
      }
    }

    return res.json({ success: true, data: { streak, lastActiveDate: uniqueDates[0] || null, totalActiveDays } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/student-dashboard/time-by-subject
router.get('/time-by-subject', authStudent, async (req, res) => {
  try {
    const studentId = new mongoose.Types.ObjectId(req.user.id);
    const schoolId = req.schoolId;

    const data = await TeachingMaterial.aggregate([
      { $match: { schoolId, 'viewedBy.studentId': studentId } },
      { $unwind: '$viewedBy' },
      { $match: { 'viewedBy.studentId': studentId } },
      { $group: { _id: { $ifNull: ['$subjectName', 'General'] }, totalSeconds: { $sum: '$viewedBy.timeSpent' } } },
      { $sort: { totalSeconds: -1 } },
      { $project: { _id: 0, subject: '$_id', totalSeconds: 1, totalMinutes: { $round: [{ $divide: ['$totalSeconds', 60] }, 0] } } },
    ]);

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/student-dashboard/flashcard-result
router.post('/flashcard-result', authStudent, async (req, res) => {
  try {
    const studentId = req.user.id;
    const schoolId = req.schoolId;
    const { topicId, topicTitle, subject, result } = req.body || {};
    if (!topicId || !result) return res.status(400).json({ error: 'topicId and result are required' });
    await FlashcardResult.create({ studentId, schoolId, topicId, topicTitle: topicTitle || '', subject: subject || '', result });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/student-dashboard/flashcard-stats
router.get('/flashcard-stats', authStudent, async (req, res) => {
  try {
    const studentId = req.user.id;
    const schoolId = req.schoolId;
    const results = await FlashcardResult.find({ studentId, schoolId }).lean();

    const topicMap = {};
    for (const r of results) {
      if (!topicMap[r.topicId]) {
        topicMap[r.topicId] = { topicId: r.topicId, topicTitle: r.topicTitle, subject: r.subject, gotIt: 0, stillLearning: 0 };
      }
      if (r.result === 'got_it') topicMap[r.topicId].gotIt++;
      else topicMap[r.topicId].stillLearning++;
    }

    const byTopic = Object.values(topicMap).map((t) => ({
      ...t,
      recallRate: t.gotIt + t.stillLearning > 0 ? Math.round((t.gotIt / (t.gotIt + t.stillLearning)) * 100) : 0,
    })).sort((a, b) => b.recallRate - a.recallRate);

    const totalGot = results.filter((r) => r.result === 'got_it').length;
    const overallRate = results.length > 0 ? Math.round((totalGot / results.length) * 100) : 0;

    return res.json({ success: true, data: { overallRate, totalAttempts: results.length, byTopic } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
