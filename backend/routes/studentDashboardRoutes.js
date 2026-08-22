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
const SpacedRepetition = require('../models/SpacedRepetition');
const { updateDevelopmentProfile } = require('../services/developmentProfileService');

// SM-2 algorithm — updates interval/easeFactor/repetitions in place and returns nextReview Date.
function applySpacedRepetition(record, gotIt) {
  const q = gotIt ? 4 : 1;
  if (q >= 3) {
    if (record.repetitions === 0) record.interval = 1;
    else if (record.repetitions === 1) record.interval = 6;
    else record.interval = Math.round(record.interval * record.easeFactor);
    record.easeFactor = Math.min(2.5, record.easeFactor + 0.1);
    record.repetitions += 1;
  } else {
    record.interval = 1;
    record.easeFactor = Math.max(1.3, record.easeFactor - 0.2);
    record.repetitions = 0;
  }
  const next = new Date();
  next.setDate(next.getDate() + record.interval);
  next.setHours(0, 0, 0, 0);
  record.nextReview = next;
  record.lastReview = new Date();
  return next;
}

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
    // Fire-and-forget: recompute development profile after flashcard practice
    updateDevelopmentProfile(studentId, schoolId).catch(() => {});
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

// POST /api/student-dashboard/spaced-repetition/review
// Called after each card rating. Creates or updates the SM-2 record for the card.
router.post('/spaced-repetition/review', authStudent, async (req, res) => {
  try {
    const studentId = req.user.id;
    const schoolId = req.schoolId;
    const { cardHash, cardFront, cardBack, subject, topic, result } = req.body || {};
    if (!cardHash || !cardFront || !cardBack || !result) {
      return res.status(400).json({ error: 'cardHash, cardFront, cardBack, and result are required' });
    }
    const gotIt = result === 'got_it';
    let record = await SpacedRepetition.findOne({ studentId, cardHash });
    if (!record) {
      record = new SpacedRepetition({
        studentId, schoolId,
        subject: subject || '', topic: topic || '',
        cardHash, cardFront, cardBack,
        interval: 1, easeFactor: 2.5, repetitions: 0,
      });
    }
    const nextReview = applySpacedRepetition(record, gotIt);
    await record.save();
    return res.json({ success: true, data: { nextReview, interval: record.interval, repetitions: record.repetitions } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/student-dashboard/spaced-repetition/due
// Returns cards due for review today (nextReview <= now).
// Optional query params: subject, topic (to scope to current session's subject/topic).
router.get('/spaced-repetition/due', authStudent, async (req, res) => {
  try {
    const studentId = req.user.id;
    const { subject, topic } = req.query;
    const filter = { studentId, nextReview: { $lte: new Date() } };
    if (subject) filter.subject = subject;
    if (topic) filter.topic = topic;
    const due = await SpacedRepetition.find(filter)
      .sort({ nextReview: 1 })
      .limit(20)
      .select('cardFront cardBack nextReview interval repetitions subject topic')
      .lean();
    return res.json({ success: true, data: { dueCount: due.length, cards: due } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/student-dashboard/sync-development-profile
// Call this after any learning activity to recompute the 6-category profile.
router.post('/sync-development-profile', authStudent, async (req, res) => {
  try {
    const studentId = req.user.id;
    const schoolId = req.schoolId;
    const profile = await updateDevelopmentProfile(studentId, schoolId);
    return res.json({ success: true, data: profile });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/student-dashboard/development-profile
router.get('/development-profile', authStudent, async (req, res) => {
  try {
    const studentId = req.user.id;
    const schoolId = req.schoolId;
    const StudentDevelopmentProfile = require('../models/StudentDevelopmentProfile');
    const profile = await StudentDevelopmentProfile.findOne({ studentId, schoolId }).lean();
    return res.json({ success: true, data: profile || null });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
