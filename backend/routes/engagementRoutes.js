const express = require('express');
const router = express.Router();
const authStudent = require('../middleware/authStudent');
const { computeEngagement } = require('../services/engagementScorer');

// GET /api/engagement/student
// Returns engagement scores per topic and flags low-engagement topics with swap suggestions.
router.get('/student', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId  = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const data = await computeEngagement(studentId, schoolId);

    const lowEngagement = data.filter((d) => d.isLow);
    const suggestions = lowEngagement.map((item) => ({
      subject:    item.subject,
      topicTitle: item.topicTitle,
      score:      item.score,
      suggestion: pickSwapStrategy(item.score),
    }));

    return res.json({ success: true, data: { topics: data, lowEngagement: suggestions } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

function pickSwapStrategy(score) {
  if (score < 5)  return { mode: 'real_world', label: 'Try real-world examples', reason: 'Connect theory to practice.' };
  if (score < 10) return { mode: 'mind_map',   label: 'Try a mind map',          reason: 'Visualise the concept differently.' };
  return           { mode: 'explain',           label: 'Get an explanation',      reason: 'Revisit the concept with a fresh angle.' };
}

module.exports = router;
