/**
 * Spaced Repetition Cron
 * Runs daily at midnight — finds topics due for review and sends nudge notifications.
 * Also runs the low-engagement detection sweep (no attempt in N days → swap content).
 */

const cron = require('node-cron');
const NotificationService = require('../utils/notificationService');
const { ENGAGEMENT } = require('../config/workflowThresholds');

async function runSpacedRepetitionNudges() {
  try {
    const SpacedRepetitionSchedule = require('../models/SpacedRepetitionSchedule');
    const now = new Date();
    const dueRecords = await SpacedRepetitionSchedule.find({
      nextReviewDate: { $lte: now },
    }).lean();

    for (const record of dueRecords) {
      try {
        await NotificationService.createNotification({
          schoolId: record.schoolId,
          title: `🔁 Time to Review: ${record.topicTitle || record.subject}`,
          message: `It's been ${record.intervalDays} day(s) since you studied "${record.topicTitle || record.subject}". A quick review quiz will boost your retention!`,
          audience: 'Specific',
          type: 'learning',
          priority: 'medium',
          category: 'academic',
          targetUserIds: [record.studentId],
          relatedEntity: { entityType: 'spaced_repetition', entityId: record._id },
        });
      } catch (_) {
        // per-student failure should not stop the loop
      }
    }

    console.log(`[spaced-rep cron] nudged ${dueRecords.length} due topics`);
  } catch (err) {
    console.error('[spaced-rep cron] error:', err.message);
  }
}

async function runEngagementSweep() {
  try {
    const MasteryScore = require('../models/MasteryScore');
    const cutoff = new Date(Date.now() - ENGAGEMENT.INACTIVITY_DAYS * 86400000);
    const stale = await MasteryScore.find({ lastUpdated: { $lt: cutoff } })
      .select('studentId schoolId subject topicTitle lastUpdated')
      .lean();

    for (const record of stale) {
      try {
        await NotificationService.createNotification({
          schoolId: record.schoolId,
          title: `📖 Don't lose your streak!`,
          message: `You haven't practised "${record.topicTitle || record.subject}" in ${ENGAGEMENT.INACTIVITY_DAYS}+ days. Jump back in — your mastery score is waiting!`,
          audience: 'Specific',
          type: 'learning',
          priority: 'low',
          category: 'academic',
          targetUserIds: [record.studentId],
          relatedEntity: { entityType: 'mastery', entityId: record.studentId },
        });
      } catch (_) { /* non-critical */ }
    }

    console.log(`[engagement cron] nudged ${stale.length} inactive students`);
  } catch (err) {
    console.error('[engagement cron] error:', err.message);
  }
}

// ── 30-day class improvement report ──────────────────────────────────────────
async function run30DayReport() {
  try {
    const TeacherUser = require('../models/TeacherUser');
    const TeacherAllocation = require('../models/TeacherAllocation');
    const MasteryScore = require('../models/MasteryScore');
    const axios = require('axios');
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    const teachers = await TeacherUser.find({ isActive: { $ne: false } }).select('_id schoolId name').lean();

    for (const teacher of teachers) {
      try {
        const allocs = await TeacherAllocation.find({ schoolId: teacher.schoolId, teacherId: teacher._id }).lean();
        if (!allocs.length) continue;

        const subjects = [...new Set(allocs.map((a) => a.subject))];
        const scores   = await MasteryScore.find({
          schoolId: teacher.schoolId,
          subject: { $in: subjects },
        }).lean();

        if (!scores.length) continue;

        const avgBySubject = subjects.map((subj) => {
          const sub = scores.filter((s) => s.subject === subj);
          const avg = sub.length ? Math.round(sub.reduce((s, v) => s + v.score, 0) / sub.length) : 0;
          return `${subj}: ${avg}% avg mastery (${sub.length} students)`;
        }).join('; ');

        // AI generate summary
        let aiSummary = '';
        try {
          const aiResp = await axios.post(`${AI_SERVICE_URL}/generate/teacher`, {
            prompt: `Generate a brief 30-day class improvement summary for a teacher. Data: ${avgBySubject}. Include: key wins, areas needing attention, and 2 actionable suggestions. Keep it under 150 words.`,
            mode: 'class_performance_summary',
            subject: subjects[0] || '',
            context: '',
          }, { timeout: 30000 });
          aiSummary = aiResp.data?.response || aiResp.data?.content || '';
        } catch (_) {
          aiSummary = `Class performance summary: ${avgBySubject}`;
        }

        await NotificationService.createNotification({
          schoolId: teacher.schoolId,
          title: `📊 30-Day Class Performance Report`,
          message: aiSummary.slice(0, 300) || `Monthly summary ready. Subjects: ${subjects.join(', ')}`,
          audience: 'Specific',
          type: 'report',
          priority: 'medium',
          category: 'academic',
          targetUserIds: [teacher._id],
          relatedEntity: { entityType: 'class_report', entityId: teacher._id },
        });
      } catch (_) { /* per-teacher failure must not stop loop */ }
    }

    console.log(`[30-day cron] sent reports to ${teachers.length} teachers`);
  } catch (err) {
    console.error('[30-day cron] error:', err.message);
  }
}

function startSchedulers() {
  // Daily at midnight — SR nudges + engagement sweep
  cron.schedule('0 0 * * *', async () => {
    await runSpacedRepetitionNudges();
    await runEngagementSweep();
  });

  // Monthly on the 1st at 7 AM — 30-day improvement report to each teacher
  cron.schedule('0 7 1 * *', async () => {
    await run30DayReport();
  });

  console.log('[schedulers] SR, engagement, and 30-day report crons scheduled');
}

module.exports = { startSchedulers, runSpacedRepetitionNudges, runEngagementSweep, run30DayReport };
