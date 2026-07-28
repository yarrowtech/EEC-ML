const express = require('express');
const router = express.Router();
const authStudent = require('../middleware/authStudent');
const MasteryScore = require('../models/MasteryScore');

// POST /api/mastery/update
// Body: { subject, topicId, topicTitle?, chapterTitle?, score (0-100) }
// Upserts mastery score for a student-topic pair.
router.post('/update', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const { subject, topicId, topicTitle = '', chapterTitle = '', score } = req.body || {};
    if (!subject || !topicId) return res.status(400).json({ error: 'subject and topicId are required' });

    const numericScore = Math.max(0, Math.min(100, Number(score) || 0));

    const doc = await MasteryScore.findOneAndUpdate(
      { studentId, subject, topicId },
      {
        $set: { schoolId, topicTitle, chapterTitle, lastUpdated: new Date() },
        $inc: { attemptCount: 1 },
        // Weighted average: new score counts 30%, history 70%
        $max: { score: numericScore },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Recalculate as weighted average of stored score and new score
    const currentScore = doc.score;
    const attempts = doc.attemptCount;
    const blendedScore = attempts <= 1
      ? numericScore
      : Math.round((currentScore * 0.7) + (numericScore * 0.3));

    doc.score = Math.max(currentScore, blendedScore);
    await doc.save();

    return res.json({ success: true, data: doc });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/mastery/student
// Returns all mastery scores for the logged-in student.
router.get('/student', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ error: 'Unauthorized' });

    const scores = await MasteryScore.find({ studentId }).sort({ subject: 1, topicTitle: 1 }).lean();
    return res.json({ success: true, data: scores });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/mastery/topic?subject=&topicId=
// Returns mastery score for a specific topic.
router.get('/topic', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const { subject, topicId } = req.query;
    if (!studentId) return res.status(401).json({ error: 'Unauthorized' });
    if (!subject || !topicId) return res.status(400).json({ error: 'subject and topicId required' });

    const doc = await MasteryScore.findOne({ studentId, subject, topicId }).lean();
    return res.json({ success: true, data: doc || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
