/**
 * studentContextBuilder.js
 *
 * Assembles a structured student context string that is injected into every
 * LLM prompt so the AI tutor can give personalised, tier-aware answers instead
 * of generic responses.
 *
 * Data sources (all fetched in parallel):
 *   - MasteryScore        → per-topic scores and tiers for the active subject
 *   - mlEngine            → atRisk, pace, learning gaps
 *   - StudentProgress     → overall grade, intervention level, weakness analysis
 *   - StudentMemorySummary → rolling long-term memory summary of past sessions
 *   - TutorConversation   → most recent session's last 3 turns (conversational continuity)
 */

const MasteryScore = require('../models/MasteryScore');
const StudentProgress = require('../models/StudentProgress');
const StudentMemorySummary = require('../models/StudentMemorySummary');
const TutorConversation = require('../models/TutorConversation');
const { computeAtRisk, computeLearningPace, detectLearningGaps } = require('../services/mlEngine');

const TIER_LABELS = {
  basic_lesson: 'FOUNDATION — needs basics, use simplest language and short analogies',
  revision: 'REVISION — developing understanding, revisit key concepts',
  medium_quiz: 'DEVELOPING — good grasp, ready for moderate challenge',
  advance: 'PROFICIENT — strong understanding, can handle harder material',
  challenge: 'MASTERY — fully mastered, push with advanced analysis questions',
};

function scoreToTierKey(score) {
  if (score < 40) return 'basic_lesson';
  if (score < 60) return 'revision';
  if (score < 75) return 'medium_quiz';
  if (score < 90) return 'advance';
  return 'challenge';
}

/**
 * Returns the last `maxTurns` message pairs from the most recent tutor conversation.
 * Each pair = one student message + one tutor reply.
 */
async function getRecentConversationTurns(studentId, schoolId, maxTurns = 3) {
  try {
    const recent = await TutorConversation.findOne(
      { studentId, schoolId },
      { messages: 1 },
      { sort: { updatedAt: -1 } }
    ).lean();

    if (!recent?.messages?.length) return [];

    // Take last maxTurns * 2 messages (each turn = 1 user + 1 assistant)
    const last = recent.messages.slice(-(maxTurns * 2));
    return last.map((m) => ({ role: m.role, text: (m.text || '').slice(0, 300) }));
  } catch {
    return [];
  }
}

/**
 * Builds a human-readable context block describing the student's current learning state.
 *
 * @param {string} studentId
 * @param {string} schoolId
 * @param {string} subject     - active subject the student is studying
 * @param {string} topicId     - optional active topic ID for topic-specific mastery
 * @param {string} gradeLevel  - e.g. "Grade 7"
 * @returns {{ contextBlock: string, conversationHistory: Array<{role,text}> }}
 */
async function buildStudentContext({ studentId, schoolId, subject, topicId, gradeLevel }) {
  const [masteryScores, atRisk, pace, gapData, progress, memory, conversationHistory] =
    await Promise.allSettled([
      MasteryScore.find({ studentId, schoolId, subject }).sort({ score: 1 }).lean(),
      computeAtRisk({ studentId, schoolId }),
      computeLearningPace({ studentId, schoolId }),
      detectLearningGaps({ studentId, schoolId }),
      StudentProgress.findOne({ studentId, schoolId })
        .select('overallGrade interventionLevel weaknessAnalysis')
        .lean(),
      StudentMemorySummary.findOne({ studentId, schoolId }).lean(),
      getRecentConversationTurns(studentId, schoolId, 3),
    ]);

  const mastery = masteryScores.status === 'fulfilled' ? masteryScores.value : [];
  const risk = atRisk.status === 'fulfilled' ? atRisk.value : null;
  const learningPace = pace.status === 'fulfilled' ? pace.value : null;
  const gaps = gapData.status === 'fulfilled' ? gapData.value?.gaps || [] : [];
  const prog = progress.status === 'fulfilled' ? progress.value : null;
  const mem = memory.status === 'fulfilled' ? memory.value : null;
  const history = conversationHistory.status === 'fulfilled' ? conversationHistory.value : [];

  const lines = ['── STUDENT LEARNING PROFILE (for AI personalisation) ──'];

  // Grade & overall standing
  const grade = gradeLevel || 'School level';
  const overallGrade = prog?.overallGrade || 'N/A';
  const interventionLevel = prog?.interventionLevel || 'low';
  lines.push(`Grade: ${grade}  |  Overall Grade: ${overallGrade}  |  Intervention Level: ${interventionLevel}`);

  // Active topic mastery
  if (subject) {
    const subjectMastery = mastery.filter((m) => m.subject?.toLowerCase() === subject?.toLowerCase());
    if (subjectMastery.length) {
      const avgScore = Math.round(subjectMastery.reduce((s, m) => s + m.score, 0) / subjectMastery.length);
      const activeTopic = topicId ? subjectMastery.find((m) => m.topicId === topicId) : null;
      const activeScore = activeTopic?.score ?? avgScore;
      const tierKey = scoreToTierKey(activeScore);
      const tierLabel = TIER_LABELS[tierKey];
      lines.push(
        `Current subject: ${subject} — mastery score ${activeScore}% → TIER: ${tierLabel}`
      );

      // Weak topics in this subject
      const weakInSubject = subjectMastery.filter((m) => m.score < 60).slice(0, 3);
      if (weakInSubject.length) {
        lines.push(
          `Weak topics in ${subject}: ${weakInSubject.map((m) => `${m.topicTitle || m.topicId} (${m.score}%)`).join(', ')}`
        );
      }
    } else {
      lines.push(`Current subject: ${subject} — no mastery data yet (treat as FOUNDATION tier)`);
    }
  }

  // At-risk status
  if (risk) {
    if (risk.isAtRisk) {
      lines.push(
        `Risk status: AT-RISK — ${risk.trend} trend, recent avg ${risk.recentAvg}% (was ${risk.priorAvg ?? 'N/A'}%). Use extra encouragement.`
      );
    } else {
      lines.push(`Risk status: On track (recent avg ${risk.recentAvg ?? 'N/A'}%, trend: ${risk.trend})`);
    }
  }

  // Learning pace
  if (learningPace) {
    const paceLabel = learningPace.paceLabel || 'unknown';
    const weeksLeft = learningPace.estimatedWeeksToTarget;
    const weeksStr = weeksLeft != null ? `, ~${weeksLeft} weeks to mastery target` : '';
    lines.push(`Learning pace: ${paceLabel}${weeksStr} | Avg ${learningPace.avgSessionsPerWeek ?? 0} sessions/week`);
  }

  // Cross-subject learning gaps (top 3 critical)
  const criticalGaps = gaps.filter((g) => g.severity === 'critical').slice(0, 3);
  if (criticalGaps.length) {
    lines.push(
      `Critical learning gaps: ${criticalGaps.map((g) => `${g.topicTitle || g.topicId} in ${g.subject} (${g.score}%)`).join('; ')}`
    );
  }

  // Weakness analysis from StudentProgress
  if (prog?.weaknessAnalysis?.length) {
    const topWeak = prog.weaknessAnalysis.slice(0, 2);
    lines.push(
      `Known weak areas: ${topWeak.map((w) => `${w.subject} (consistency ${w.consistencyScore}%)`).join(', ')}`
    );
  }

  // Long-term memory summary from past sessions
  if (mem?.summary) {
    lines.push(`Past session memory: ${mem.summary.slice(0, 400)}`);
  }
  if (mem?.keyInsights?.length) {
    lines.push(`Key learning insights: ${mem.keyInsights.slice(0, 3).join(' | ')}`);
  }

  lines.push(
    '── END PROFILE ──',
    'Adapt your language, depth, and difficulty to match this student\'s tier above.',
    'For FOUNDATION tier: use simple words, short sentences, concrete analogies.',
    'For MASTERY tier: use precise vocabulary, push analysis and synthesis.',
    'If student is AT-RISK: be extra encouraging, celebrate small wins, avoid discouraging phrasing.'
  );

  return {
    contextBlock: lines.join('\n'),
    conversationHistory: history,
  };
}

module.exports = { buildStudentContext };
