/**
 * helpSeekingService.js
 * Help-seeking behaviour: logs when and how a student proactively asks for
 * help during a tutor session (entering Homework Help mode, or telling the
 * Socratic tutor "I don't know" mid-conversation), then surfaces per-student
 * and per-class summaries. A student who never seeks help despite low mastery
 * is as important a signal to a teacher as one who seeks help constantly.
 */
const STUCK_PATTERN = /\b(i\s*don'?t\s*know|idk|not\s*sure|no\s*idea|i'?m\s*stuck|help\s*me|give\s*up)\b/i;

function detectStuckSignal(text) {
  return STUCK_PATTERN.test(String(text || ''));
}

async function logEvent({ schoolId, studentId, subject, topicTitle, eventType, mode }) {
  if (!schoolId || !studentId || !eventType) return null;
  const HelpSeekingEvent = require('../models/HelpSeekingEvent');
  return HelpSeekingEvent.create({
    schoolId, studentId, subject: subject || '', topicTitle: topicTitle || '', eventType, mode: mode || '',
  });
}

// Fire-and-forget hook called from the tutor generate route after a response
// is produced — inspects the mode and the student's own message for
// help-seeking signals without adding a round trip to the chat flow.
async function logFromTutorTurn({ schoolId, studentId, subject, topicTitle, mode, question }) {
  try {
    if (mode === 'homework_help') {
      await logEvent({ schoolId, studentId, subject, topicTitle, eventType: 'homework_help_used', mode });
    }
    if (mode === 'homework_help' && detectStuckSignal(question)) {
      await logEvent({ schoolId, studentId, subject, topicTitle, eventType: 'stuck_signal', mode });
    }
  } catch (_) { /* logging must never block the tutor response */ }
}

async function getStudentHelpSeekingProfile({ schoolId, studentId, sinceDays = 30 }) {
  const HelpSeekingEvent = require('../models/HelpSeekingEvent');
  const since = new Date(Date.now() - sinceDays * 86400000);
  const events = await HelpSeekingEvent.find({ schoolId, studentId, createdAt: { $gte: since } })
    .sort({ createdAt: -1 }).limit(500).lean();

  const byType = { homework_help_used: 0, stuck_signal: 0 };
  const bySubject = new Map();
  for (const e of events) {
    byType[e.eventType] = (byType[e.eventType] || 0) + 1;
    bySubject.set(e.subject || 'General', (bySubject.get(e.subject || 'General') || 0) + 1);
  }
  const topSubjects = [...bySubject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([subject, count]) => ({ subject, count }));

  return {
    totalEvents: events.length,
    homeworkHelpUsed: byType.homework_help_used,
    stuckSignals: byType.stuck_signal,
    topSubjects,
    lastEventAt: events[0]?.createdAt || null,
    sinceDays,
  };
}

// Teacher-facing view: students ranked by help-seeking frequency (both
// extremes matter — very high suggests real struggle, very low combined with
// weak mastery elsewhere can mean a student isn't asking for help they need).
async function getClassHelpSeekingSummary({ schoolId, studentIds, sinceDays = 30 }) {
  const results = await Promise.allSettled(
    studentIds.map(async (studentId) => ({
      studentId,
      ...(await getStudentHelpSeekingProfile({ schoolId, studentId, sinceDays })),
    }))
  );
  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value)
    .sort((a, b) => b.totalEvents - a.totalEvents);
}

module.exports = {
  logEvent,
  logFromTutorTurn,
  detectStuckSignal,
  getStudentHelpSeekingProfile,
  getClassHelpSeekingSummary,
};
