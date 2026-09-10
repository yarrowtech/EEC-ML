const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authStudent = require('../middleware/authStudent');
const MasteryScore = require('../models/MasteryScore');
const TeachingMaterial = require('../models/TeachingMaterial');
const SpacedRepetitionSchedule = require('../models/SpacedRepetitionSchedule');
const RecommendationEvent = require('../models/RecommendationEvent');
const {
  recordIssued,
  recordDecision,
  summarize,
} = require('../services/recommendationImpactService');

// Persist each recommendation the moment it is shown (deduped per day) and
// attach its lifecycle id so the client can report acceptance / completion.
async function attachTracking(schoolId, studentId, source, recs) {
  return Promise.all((recs || []).map(async (rec) => {
    try {
      const ev = await recordIssued({ schoolId, studentId, source, recommendation: rec });
      return ev ? { ...rec, id: String(ev._id), status: ev.status } : rec;
    } catch (_) {
      return rec;
    }
  }));
}

// GET /api/recommendations/student
// Returns personalised topic + material recommendations based on:
//  1. Lowest mastery scores (weak topics needing work)
//  2. Spaced repetition topics due for review
//  3. Topics never attempted (new)
router.get('/student', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId  = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const [scores, dueItems, materials] = await Promise.all([
      MasteryScore.find({ studentId, schoolId }).sort({ score: 1 }).lean(),
      SpacedRepetitionSchedule.find({ studentId, nextReviewDate: { $lte: new Date() } })
        .sort({ nextReviewDate: 1 }).limit(5).lean(),
      TeachingMaterial.find({ schoolId, isPublished: true })
        .select('topicTitle chapterTitle subjectName fileType fileUrl topicId')
        .limit(100).lean(),
    ]);

    const recommendations = [];

    // 1. Spaced repetition — highest priority
    for (const item of dueItems) {
      recommendations.push({
        type: 'spaced_repetition',
        priority: 1,
        subject: item.subject,
        topicId: item.topicId || item.topicTitle?.toLowerCase().replace(/\s+/g, '-'),
        topicTitle: item.topicTitle,
        chapterTitle: item.chapterTitle || '',
        label: '🔁 Due for Review',
        reason: `Last reviewed ${item.lastScore ? `with score ${item.lastScore}%` : 'earlier'}. Time to reinforce!`,
        action: 'quiz',
        difficulty: item.lastScore >= 75 ? 'hard' : item.lastScore >= 50 ? 'medium' : 'easy',
      });
    }

    // 2. Weak mastery topics (score < 60)
    const weak = scores.filter((s) => s.score < 60).slice(0, 4);
    for (const s of weak) {
      const mat = materials.find((m) =>
        m.topicTitle?.toLowerCase().includes(s.topicTitle?.toLowerCase()) ||
        m.subjectName?.toLowerCase().includes(s.subject?.toLowerCase())
      );
      recommendations.push({
        type: 'weak_topic',
        priority: 2,
        subject: s.subject,
        topicId: s.topicId,
        topicTitle: s.topicTitle,
        chapterTitle: s.chapterTitle || '',
        label: '📈 Needs Improvement',
        reason: `Your mastery is ${s.score}%. Practice more to strengthen understanding.`,
        action: s.score < 40 ? 'explain' : 'quiz',
        difficulty: 'easy',
        material: mat ? { title: mat.topicTitle, fileType: mat.fileType, fileUrl: mat.fileUrl } : null,
      });
    }

    // 3. Medium mastery — ready to level up (60-74)
    const levelUp = scores.filter((s) => s.score >= 60 && s.score < 75).slice(0, 3);
    for (const s of levelUp) {
      recommendations.push({
        type: 'level_up',
        priority: 3,
        subject: s.subject,
        topicId: s.topicId,
        topicTitle: s.topicTitle,
        chapterTitle: s.chapterTitle || '',
        label: '⚡ Level Up',
        reason: `You\'re at ${s.score}%. One more good quiz and you\'ll unlock the next topic!`,
        action: 'quiz',
        difficulty: 'medium',
      });
    }

    // 4. Available materials for subjects with no mastery (new topics)
    const attemptedSubjects = new Set(scores.map((s) => s.subject?.toLowerCase()));
    const newMaterials = materials
      .filter((m) => !attemptedSubjects.has(m.subjectName?.toLowerCase()))
      .slice(0, 3);
    for (const mat of newMaterials) {
      recommendations.push({
        type: 'new_topic',
        priority: 4,
        subject: mat.subjectName,
        topicId: mat.topicId || mat.topicTitle?.toLowerCase().replace(/\s+/g, '-'),
        topicTitle: mat.topicTitle,
        chapterTitle: mat.chapterTitle || '',
        label: '🌱 New Topic',
        reason: 'You haven\'t started this topic yet. Begin with the basics!',
        action: 'explain',
        difficulty: 'easy',
        material: { title: mat.topicTitle, fileType: mat.fileType, fileUrl: mat.fileUrl },
      });
    }

    recommendations.sort((a, b) => a.priority - b.priority);

    const tracked = await attachTracking(schoolId, studentId, 'student_feed', recommendations.slice(0, 8));
    return res.json({ success: true, data: tracked });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/recommendations/next?subject=&className=
// Intelligent next-topic recommendation using curriculum map + gap detection + spaced repetition.
// Returns a single explainable recommendation the student can accept or skip.
router.get('/next', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId  = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });
    const { subject, className } = req.query;
    const { recommendNextTopic } = require('../services/recommendationEngine');
    const result = await recommendNextTopic({ studentId, schoolId, subject, className });
    const [tracked] = await attachTracking(schoolId, studentId, 'next', result.recommendation ? [result.recommendation] : []);
    return res.json({ success: true, data: tracked || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/recommendations/all-subjects
// Returns one recommendation per subject the student has started.
router.get('/all-subjects', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId  = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });
    const { recommendAcrossSubjects } = require('../services/recommendationEngine');
    const recommendations = await recommendAcrossSubjects({ studentId, schoolId });
    const tracked = await attachTracking(schoolId, studentId, 'all_subjects', recommendations);
    return res.json({ success: true, data: tracked });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/recommendations/:id/:decision  (decision: accept | dismiss | complete)
// Records the student's response so acceptance, completion, and mastery impact
// can be measured.
const VALID_DECISIONS = ['accept', 'dismiss', 'complete'];
router.post('/:id/:decision', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId  = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });
    if (!VALID_DECISIONS.includes(req.params.decision)) {
      return res.status(400).json({ error: 'decision must be accept, dismiss, or complete' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid recommendation id' });
    }
    const result = await recordDecision({
      id: req.params.id, schoolId, studentId,
      decision: req.params.decision,
      reason: req.body?.reason || '',
    });
    if (result.notFound) return res.status(404).json({ error: 'Recommendation not found' });
    if (result.invalid) return res.status(400).json({ error: 'Invalid decision' });
    return res.json({ success: true, data: result.event });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/recommendations/history
// The student's own recommendation history with acceptance / completion /
// impact aggregates.
router.get('/history', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId  = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const events = await RecommendationEvent.find({ schoolId, studentId })
      .sort({ issuedAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ success: true, data: events, summary: summarize(events) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
