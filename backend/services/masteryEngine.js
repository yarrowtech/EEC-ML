/**
 * masteryEngine.js
 * Central service that evaluates a student's mastery score and fires all
 * downstream workflow triggers: path unlock, badge award, teacher alert,
 * spaced-repetition scheduling, and push notifications.
 */

const { MASTERY, ENGAGEMENT, BADGE } = require('../config/workflowThresholds');
const NotificationService = require('../utils/notificationService');

// ── Knowledge decay ───────────────────────────────────────────────────────────
// Daily decay rate: mastery decays toward a floor of 30% if not practised.
// Applied when the student's SpacedRepetitionSchedule.nextReviewDate is past due.
const DECAY_RATE_PER_DAY = 0.5;  // percentage points per day past due
const DECAY_FLOOR = 30;           // mastery never drops below this

async function applyKnowledgeDecay(studentId, schoolId) {
  try {
    const MasteryScore             = require('../models/MasteryScore');
    const SpacedRepetitionSchedule = require('../models/SpacedRepetitionSchedule');
    const now = new Date();
    const overdue = await SpacedRepetitionSchedule.find({
      studentId, schoolId,
      nextReviewDate: { $lt: now },
    }).lean();
    if (!overdue.length) return;

    for (const item of overdue) {
      const daysLate = Math.max(0, (now - new Date(item.nextReviewDate)) / 86400000);
      if (daysLate < 1) continue;
      const decay = Math.round(daysLate * DECAY_RATE_PER_DAY);
      if (decay <= 0) continue;
      const doc = await MasteryScore.findOne({
        studentId, schoolId, subject: item.subject,
        topicTitle: { $regex: new RegExp(`^${item.topicTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });
      if (!doc) continue;
      const newScore = Math.max(DECAY_FLOOR, doc.score - decay);
      if (newScore < doc.score) {
        doc.score = newScore;
        doc.lastUpdated = now;
        await doc.save();
      }
    }
  } catch (_) { /* non-critical */ }
}

// ── Badge award ───────────────────────────────────────────────────────────────
async function awardBadgeIfEarned(studentId, schoolId, subject, topicTitle, score) {
  if (score < BADGE.MASTERY_THRESHOLD) return;
  try {
    const StudentBadge = require('../models/StudentBadge');
    const title = `${topicTitle || subject} — Mastered`;
    const exists = await StudentBadge.exists({ studentId, title, badgeType: 'mastery' });
    if (exists) return;
    await StudentBadge.create({
      studentId,
      schoolId,
      badgeType: 'mastery',
      title,
      description: `Scored ${score}%+ in AI-assessed mastery for "${topicTitle || subject}"`,
      subject,
      topicTitle,
      iconEmoji: '🏆',
      awardedAt: new Date(),
    });
    await NotificationService.createNotification({
      schoolId,
      title: `🏆 Mastery Badge Earned: ${topicTitle || subject}`,
      message: `You earned a mastery badge for "${topicTitle || subject}"! Check your Badges page.`,
      audience: 'Specific',
      type: 'learning',
      priority: 'high',
      category: 'academic',
      targetUserIds: [studentId],
      relatedEntity: { entityType: 'mastery_badge', entityId: studentId },
    });
  } catch (_) { /* non-critical */ }
}

// ── Unlock next learning-path node ───────────────────────────────────────────
async function unlockNextNode(studentId, subject, score) {
  if (score < MASTERY.MID) return;
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
          if (path.nodes[i + 1]) path.nodes[i + 1].status = 'active';
          changed = true;
          break;
        }
      }
      if (changed) {
        const done = path.nodes.filter((n) => n.status === 'done').length;
        path.progress = Math.round((done / path.nodes.length) * 100);
        await path.save();

        // Check if all nodes complete → fire progress report notification
        if (done === path.nodes.length) {
          alertPathComplete(studentId, schoolId, subject, path).catch(() => {});
        }
      }
    }
  } catch (_) { /* non-critical */ }
}

// ── Alert teacher when student is stuck ──────────────────────────────────────
async function alertTeacherIfStuck(studentId, schoolId, subject, topicTitle, score, attemptCount) {
  if (score >= ENGAGEMENT.DIFFICULTY_THRESHOLD) return;
  if (attemptCount < ENGAGEMENT.DIFFICULTY_ATTEMPTS) return;
  try {
    // Find the teacher(s) who own this student's allocation for the subject
    const TeacherAllocation = require('../models/TeacherAllocation');
    const StudentUser = require('../models/StudentUser');
    const student = await StudentUser.findById(studentId).select('grade section').lean();
    if (!student) return;

    const allocations = await TeacherAllocation.find({
      schoolId,
      subject: { $regex: new RegExp(subject, 'i') },
      className: student.grade,
      sections: student.section,
    }).select('teacherId').lean();

    const teacherIds = [...new Set(allocations.map((a) => String(a.teacherId)))];
    if (!teacherIds.length) return;

    const studentRecord = await StudentUser.findById(studentId).select('name roll grade section').lean();

    await NotificationService.createNotification({
      schoolId,
      title: `⚠️ Student needs help: ${topicTitle || subject}`,
      message: `A student has scored below ${ENGAGEMENT.DIFFICULTY_THRESHOLD}% after ${attemptCount} attempts on "${topicTitle || subject}". Consider intervention.`,
      audience: 'Specific',
      type: 'alert',
      priority: 'high',
      category: 'academic',
      targetUserIds: teacherIds,
      relatedEntity: { entityType: 'mastery', entityId: studentId },
    });

    // Emit real-time alert to all allocated teachers so their intervention tab auto-refreshes
    const io = require('../utils/socketRegistry').get();
    if (io) {
      const payload = {
        studentId,
        studentName: studentRecord?.name || 'A student',
        subject,
        topicTitle,
        score,
        attemptCount,
      };
      teacherIds.forEach((tid) => io.to(`user:${tid}`).emit('intervention_alert', payload));
    }
  } catch (_) { /* non-critical */ }
}

// ── Mastery nudge notification ────────────────────────────────────────────────
async function sendNudge(studentId, schoolId, subject, topicTitle, score) {
  try {
    let title, message;
    if (score >= MASTERY.HIGH) {
      title = `🏆 Topic Mastered: ${topicTitle || subject}`;
      message = `You scored ${score}% — excellent! You've fully mastered this topic. Ready for a challenge?`;
    } else if (score >= MASTERY.MID) {
      title = `🎯 Great Progress: ${topicTitle || subject}`;
      message = `You scored ${score}% — you're doing great! The next topic in your learning path has been unlocked.`;
    } else if (score < MASTERY.CRITICAL) {
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
      priority: score >= MASTERY.MID ? 'high' : 'medium',
      category: 'academic',
      targetUserIds: [studentId],
      relatedEntity: { entityType: 'mastery', entityId: studentId },
    });
  } catch (_) { /* non-critical */ }
}

// ── Learning path complete notification ──────────────────────────────────────
async function alertPathComplete(studentId, schoolId, subject, path) {
  try {
    await NotificationService.createNotification({
      schoolId,
      title: `🎓 Learning Path Complete: ${subject}`,
      message: `You've completed all topics in your "${subject}" learning path! A progress report has been generated for your teacher.`,
      audience: 'Specific',
      type: 'learning',
      priority: 'high',
      category: 'academic',
      targetUserIds: [studentId],
      relatedEntity: { entityType: 'learning_path', entityId: path._id },
    });
  } catch (_) { /* non-critical */ }
}

// ── Schedule spaced repetition for a topic ───────────────────────────────────
async function scheduleSpacedRepetition(studentId, schoolId, subject, topicTitle, chapterTitle, score) {
  try {
    const SpacedRepetitionSchedule = require('../models/SpacedRepetitionSchedule');
    const { SR_INTERVALS } = require('../config/workflowThresholds');
    const existing = await SpacedRepetitionSchedule.findOne({ studentId, subject, topicTitle });
    const currentStage = existing?.stage ?? 0;
    const nextStage = score >= MASTERY.MID ? Math.min(currentStage + 1, SR_INTERVALS.length - 1) : 0;
    const intervalDays = SR_INTERVALS[nextStage];
    const nextReviewDate = new Date(Date.now() + intervalDays * 86400000);

    await SpacedRepetitionSchedule.findOneAndUpdate(
      { studentId, subject, topicTitle },
      {
        $set: {
          schoolId,
          chapterTitle,
          stage: nextStage,
          intervalDays,
          lastScore: score,
          lastReviewedAt: new Date(),
          nextReviewDate,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (_) { /* non-critical */ }
}

/**
 * Main entry point — call this after any mastery-relevant event.
 * Fires all side effects in a non-blocking, fire-and-forget manner.
 */
function runWorkflowTriggers({ studentId, schoolId, subject, topicId, topicTitle, chapterTitle, score, attemptCount }) {
  const s = String(studentId);
  const sc = String(schoolId);

  sendNudge(s, sc, subject, topicTitle, score).catch(() => {});

  if (score >= MASTERY.MID) {
    unlockNextNode(s, subject, score).catch(() => {});
  }

  if (score >= BADGE.MASTERY_THRESHOLD) {
    awardBadgeIfEarned(s, sc, subject, topicTitle, score).catch(() => {});
  }

  if (score < ENGAGEMENT.DIFFICULTY_THRESHOLD && attemptCount >= ENGAGEMENT.DIFFICULTY_ATTEMPTS) {
    alertTeacherIfStuck(s, sc, subject, topicTitle, score, attemptCount).catch(() => {});
  }

  if (topicTitle) {
    scheduleSpacedRepetition(s, sc, subject, topicTitle, chapterTitle || '', score).catch(() => {});
  }

  // Gap detection — runs when score is low enough to warrant root-cause analysis
  if (score < 60) {
    const { runGapDetection } = require('./gapDetectionEngine');
    runGapDetection({ studentId: s, schoolId: sc, subject, topicTitle }).catch(() => {});
  }
}

// ── Enhanced multi-factor mastery score ───────────────────────────────────────
// Blends accuracy (latest score), attempt confidence, recency, and current score.
// Returns an integer 0-100.
function computeEnhancedMasteryScore({
  currentScore = 0,
  newScore,
  attemptCount = 1,
  daysSinceLastPractice = 0,
}) {
  const confidence  = Math.min(1, attemptCount / 5);
  const recencyBonus = Math.max(0, 1 - daysSinceLastPractice / 30);
  const newWeight  = 0.3 + recencyBonus * 0.3;
  const rawBlend   = Math.round(currentScore * (1 - newWeight) + newScore * newWeight);
  const enhanced   = Math.round(currentScore + (rawBlend - currentScore) * confidence);
  return Math.min(100, Math.max(0, enhanced));
}

module.exports = {
  runWorkflowTriggers,
  applyKnowledgeDecay,
  awardBadgeIfEarned,
  unlockNextNode,
  alertTeacherIfStuck,
  sendNudge,
  scheduleSpacedRepetition,
  computeEnhancedMasteryScore,
};
