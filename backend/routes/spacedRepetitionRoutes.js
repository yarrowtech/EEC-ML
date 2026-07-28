const express = require('express');
const router = express.Router();
const authStudent = require('../middleware/authStudent');
const SpacedRepetitionSchedule = require('../models/SpacedRepetitionSchedule');

// SM-2 inspired intervals per stage: 1, 3, 7, 14, 30 days
const STAGE_INTERVALS = [1, 3, 7, 14, 30];

const nextStage = (currentStage, score) => {
  if (score >= 0.7) return Math.min(currentStage + 1, STAGE_INTERVALS.length - 1);
  if (score >= 0.4) return Math.max(currentStage - 1, 0);
  return 0;
};

// POST /api/spaced-repetition/schedule
// Body: { subject, topicTitle, chapterTitle?, score? }
// Creates or updates a spaced repetition schedule entry after a quiz.
router.post('/schedule', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const { subject, topicTitle, chapterTitle = '', score } = req.body || {};
    if (!subject || !topicTitle) {
      return res.status(400).json({ error: 'subject and topicTitle are required' });
    }

    const normalizedScore = typeof score === 'number' ? Math.max(0, Math.min(1, score)) : null;

    const existing = await SpacedRepetitionSchedule.findOne({ studentId, subject, topicTitle });

    let doc;
    if (existing) {
      const newStage = normalizedScore !== null ? nextStage(existing.stage, normalizedScore) : existing.stage;
      const intervalDays = STAGE_INTERVALS[newStage];
      const nextReviewDate = new Date(Date.now() + intervalDays * 86400000);
      existing.stage = newStage;
      existing.intervalDays = intervalDays;
      existing.lastScore = normalizedScore;
      existing.lastReviewedAt = new Date();
      existing.nextReviewDate = nextReviewDate;
      doc = await existing.save();
    } else {
      const intervalDays = STAGE_INTERVALS[0];
      const nextReviewDate = new Date(Date.now() + intervalDays * 86400000);
      doc = await SpacedRepetitionSchedule.create({
        studentId,
        schoolId,
        subject,
        topicTitle,
        chapterTitle,
        stage: 0,
        intervalDays,
        lastScore: normalizedScore,
        lastReviewedAt: normalizedScore !== null ? new Date() : null,
        nextReviewDate,
      });
    }

    return res.json({ success: true, data: doc });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/spaced-repetition/due
// Returns topics due for review today or overdue.
router.get('/due', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ error: 'Unauthorized' });

    const dueItems = await SpacedRepetitionSchedule.find({
      studentId,
      nextReviewDate: { $lte: new Date() },
    }).sort({ nextReviewDate: 1 }).lean();

    return res.json({ success: true, data: dueItems });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/spaced-repetition/all
// Returns all scheduled items for this student.
router.get('/all', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ error: 'Unauthorized' });

    const items = await SpacedRepetitionSchedule.find({ studentId })
      .sort({ nextReviewDate: 1 }).lean();

    return res.json({ success: true, data: items });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
