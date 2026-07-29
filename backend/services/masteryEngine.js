/**
 * masteryEngine.js
 * Central service that evaluates a student's mastery score and fires all
 * downstream workflow triggers: path unlock, badge award, teacher alert,
 * spaced-repetition scheduling, and push notifications.
 */

const { MASTERY, ENGAGEMENT, BADGE } = require('../config/workflowThresholds');
const NotificationService = require('../utils/notificationService');

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
}

module.exports = {
  runWorkflowTriggers,
  awardBadgeIfEarned,
  unlockNextNode,
  alertTeacherIfStuck,
  sendNudge,
  scheduleSpacedRepetition,
};
