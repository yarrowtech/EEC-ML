const express = require('express');
const router = express.Router();
const authStudent = require('../middleware/authStudent');
const MasteryScore = require('../models/MasteryScore');
const { getNextAction, getSuggestedDifficulty } = require('../services/masteryRouter');
const NotificationService = require('../utils/notificationService');

// ── Helpers ──────────────────────────────────────────────────────────────────
const unlockNextPathNode = async (studentId, subject, score) => {
  if (score < 75) return;
  try {
    const TeacherLearningPath = require('../models/TeacherLearningPath');
    const paths = await TeacherLearningPath.find({
      studentId,
      subject: { $regex: new RegExp(subject, 'i') },
      status: 'published',
    });
    for (const path of paths) {
      let changed = false;
      for (let i = 0; i < path.nodes.length; i++) {
        if (path.nodes[i].status === 'active') {
          path.nodes[i].status = 'done';
          path.nodes[i].completedAt = new Date();
          if (path.nodes[i + 1]) {
            path.nodes[i + 1].status = 'active';
          }
          changed = true;
          break;
        }
      }
      if (changed) {
        const done = path.nodes.filter((n) => n.status === 'done').length;
        path.progress = Math.round((done / path.nodes.length) * 100);
        await path.save();
      }
    }
  } catch (_) {
    // Non-critical — path unlock failure should not break mastery update
  }
};

const sendMasteryNudge = async (studentId, schoolId, subject, topicTitle, score) => {
  try {
    let title, message;
    if (score >= 90) {
      title = `🏆 Topic Mastered: ${topicTitle || subject}`;
      message = `You scored ${score}% — excellent! You've fully mastered this topic. Ready for a challenge?`;
    } else if (score >= 75) {
      title = `🎯 Great Progress: ${topicTitle || subject}`;
      message = `You scored ${score}% — you're doing great! The next topic in your learning path has been unlocked.`;
    } else if (score < 40) {
      title = `📚 Keep Practising: ${topicTitle || subject}`;
      message = `You scored ${score}%. Review the basics and try again — you've got this!`;
    } else {
      return;
    }
    await NotificationService.createNotification({
      schoolId,
      title,
      message,
      audience: 'Specific',
      type: 'learning',
      priority: score >= 75 ? 'high' : 'medium',
      category: 'academic',
      targetUserIds: [studentId],
      relatedEntity: { entityType: 'mastery', entityId: studentId },
    });
  } catch (_) {
    // Non-critical
  }
};

// ── POST /api/mastery/update ─────────────────────────────────────────────────
router.post('/update', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId  = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const { subject, topicId, topicTitle = '', chapterTitle = '', score } = req.body || {};
    if (!subject || !topicId) return res.status(400).json({ error: 'subject and topicId are required' });

    const numericScore = Math.max(0, Math.min(100, Number(score) || 0));

    const doc = await MasteryScore.findOneAndUpdate(
      { studentId, subject, topicId },
      {
        $set:  { schoolId, topicTitle, chapterTitle, lastUpdated: new Date() },
        $inc:  { attemptCount: 1 },
        $max:  { score: numericScore },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const attempts = doc.attemptCount;
    const blended  = attempts <= 1 ? numericScore : Math.round((doc.score * 0.7) + (numericScore * 0.3));
    const finalScore = Math.max(doc.score, blended);
    doc.score = finalScore;
    await doc.save();

    // Side effects — non-blocking via central engine
    const { runWorkflowTriggers } = require('../services/masteryEngine');
    runWorkflowTriggers({
      studentId,
      schoolId,
      subject,
      topicId,
      topicTitle,
      chapterTitle,
      score: finalScore,
      attemptCount: doc.attemptCount,
    });

    return res.json({ success: true, data: doc });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/mastery/student ─────────────────────────────────────────────────
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

// ── GET /api/mastery/topic?subject=&topicId= ─────────────────────────────────
router.get('/topic', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const { subject, topicId } = req.query;
    if (!studentId)          return res.status(401).json({ error: 'Unauthorized' });
    if (!subject || !topicId) return res.status(400).json({ error: 'subject and topicId required' });
    const doc = await MasteryScore.findOne({ studentId, subject, topicId }).lean();
    return res.json({ success: true, data: doc || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Auto-award mastery badge when score first crosses 90
const awardMasteryBadge = async (studentId, subject, topicTitle, schoolId) => {
  try {
    const StudentUser = require('../models/StudentUser');
    const student = await StudentUser.findById(studentId).select('achievements name grade section').lean();
    if (!student) return;
    const badgeTitle = `${topicTitle || subject} — Mastered`;
    const already = (student.achievements || []).some((a) => a.title === badgeTitle && a.awardType === 'Mastery Badge');
    if (already) return;
    await StudentUser.findByIdAndUpdate(studentId, {
      $push: {
        achievements: {
          title: badgeTitle,
          date: new Date(),
          description: `Scored 90%+ in AI-assessed mastery for "${topicTitle || subject}"`,
          category: 'Academic',
          awardType: 'Mastery Badge',
          issuer: 'EEC AI Tutor',
        },
      },
    });
    await NotificationService.createNotification({
      schoolId,
      title: `🏅 Mastery Badge Earned: ${topicTitle || subject}`,
      message: `You earned a mastery badge for "${topicTitle || subject}"! Check your Achievements page.`,
      audience: 'Specific',
      type: 'learning',
      priority: 'high',
      category: 'academic',
      targetUserIds: [studentId],
      relatedEntity: { entityType: 'mastery_badge', entityId: studentId },
    });
  } catch (_) { /* non-critical */ }
};

// ── POST /api/mastery/post-exam — triggered after exam result is published ────
router.post('/post-exam', async (req, res) => {
  // Called internally from examRoute; no student auth needed, uses adminAuth via the caller.
  try {
    const { studentId, schoolId, subject, marksScored, totalMarks } = req.body || {};
    if (!studentId || !schoolId || !subject || totalMarks == null) {
      return res.status(400).json({ error: 'studentId, schoolId, subject, totalMarks are required' });
    }
    const pct = Math.max(0, Math.min(100, Math.round((Number(marksScored) / Number(totalMarks)) * 100)));
    const topicId = subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const doc = await MasteryScore.findOneAndUpdate(
      { studentId, subject, topicId },
      {
        $set:  { schoolId, topicTitle: subject, lastUpdated: new Date() },
        $inc:  { attemptCount: 1 },
        $max:  { score: pct },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const blended  = doc.attemptCount <= 1 ? pct : Math.round((doc.score * 0.6) + (pct * 0.4));
    const finalScore = Math.max(doc.score, blended);
    doc.score = finalScore;
    await doc.save();

    if (finalScore >= 75) unlockNextPathNode(studentId, subject, finalScore);
    if (finalScore >= 90)  awardMasteryBadge(studentId, subject, subject, schoolId);
    sendMasteryNudge(studentId, schoolId, subject, subject, finalScore);
    return res.json({ success: true, data: { finalScore } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/mastery/next-action?subject=&topicId= ───────────────────────────
router.get('/next-action', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const { subject, topicId } = req.query;
    if (!studentId)          return res.status(401).json({ error: 'Unauthorized' });
    if (!subject || !topicId) return res.status(400).json({ error: 'subject and topicId required' });
    const result = await getNextAction(studentId, subject, topicId);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/mastery/suggested-difficulty?subject=&topicId= ─────────────────
router.get('/suggested-difficulty', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const { subject, topicId } = req.query;
    if (!studentId) return res.status(401).json({ error: 'Unauthorized' });
    const difficulty = await getSuggestedDifficulty(studentId, subject || '', topicId || '');
    return res.json({ success: true, data: { difficulty } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/mastery/lesson-complete ────────────────────────────────────────
// Called when a student finishes a lesson/content block.
// Updates mastery, fires all workflow triggers, returns next action.
router.post('/lesson-complete', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId  = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const { subject, topicId, topicTitle = '', chapterTitle = '', selfRating } = req.body || {};
    if (!subject || !topicId) return res.status(400).json({ error: 'subject and topicId are required' });

    // selfRating: 1-5 (1=very confused, 5=fully understood) — convert to 0-100 score
    const ratingScore = selfRating ? Math.min(100, Math.round((Number(selfRating) / 5) * 100)) : 60;

    const doc = await MasteryScore.findOneAndUpdate(
      { studentId, subject, topicId },
      {
        $set:  { schoolId, topicTitle, chapterTitle, lastUpdated: new Date() },
        $inc:  { attemptCount: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Weighted blend: lesson self-rating carries 30% weight
    const prev = doc.score || 0;
    const blended = doc.attemptCount <= 1 ? ratingScore : Math.round((prev * 0.7) + (ratingScore * 0.3));
    doc.score = Math.max(prev, blended);
    await doc.save();

    const { runWorkflowTriggers } = require('../services/masteryEngine');
    runWorkflowTriggers({
      studentId,
      schoolId,
      subject,
      topicId,
      topicTitle,
      chapterTitle,
      score: doc.score,
      attemptCount: doc.attemptCount,
    });

    const nextAction = await getNextAction(studentId, subject, topicId);
    return res.json({ success: true, data: { mastery: doc, nextAction } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/mastery/badges?studentId= ──────────────────────────────────────
router.get('/badges', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ error: 'Unauthorized' });
    const StudentBadge = require('../models/StudentBadge');
    const badges = await StudentBadge.find({ studentId }).sort({ awardedAt: -1 }).lean();
    return res.json({ success: true, data: badges });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
