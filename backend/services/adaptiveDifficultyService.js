/**
 * adaptiveDifficultyService.js
 * Within-session adaptive difficulty for practice/quiz flows.
 *
 * Starting rung comes from the student's mastery band for the topic. Then it
 * steps up on a run of correct answers and down on a wrong answer, bounded to
 * [easy, hard]. The settled rung is persisted per (student, topic) so the next
 * session resumes there.
 */
const RUNGS = ['easy', 'medium', 'hard'];
const STEP_UP_STREAK = 2;   // consecutive correct to move up a rung
const FAST_MS = 12000;      // an answer faster than this that's also correct counts double

const BLOOM_BY_RUNG = { easy: 'understand', medium: 'apply', hard: 'analyse' };

const clampRung = (i) => Math.max(0, Math.min(RUNGS.length - 1, i));

function startingDifficulty(masteryScore) {
  if (masteryScore == null || masteryScore < 45) return 'easy';
  if (masteryScore < 75) return 'medium';
  return 'hard';
}

/**
 * @param {object} p
 * @param {string} p.currentDifficulty  current rung
 * @param {boolean} p.lastCorrect       outcome of the just-answered question
 * @param {number} [p.consecutiveCorrect] running streak from the client (pre-answer)
 * @param {number} [p.responseMs]        time the student took on the last question
 * @returns {{ nextDifficulty, bloomLevel, consecutiveCorrect, changed, reason }}
 */
function step({ currentDifficulty = 'medium', lastCorrect, consecutiveCorrect = 0, responseMs = null }) {
  let idx = RUNGS.indexOf(currentDifficulty);
  if (idx < 0) idx = 1;

  let streak = Number(consecutiveCorrect) || 0;
  let nextIdx = idx;
  let reason = 'hold';

  if (lastCorrect) {
    const weight = responseMs != null && responseMs > 0 && responseMs < FAST_MS ? 2 : 1;
    streak += weight;
    if (streak >= STEP_UP_STREAK && idx < RUNGS.length - 1) {
      nextIdx = idx + 1;
      streak = 0;
      reason = 'stepped up after a correct run';
    } else {
      reason = 'correct — holding difficulty';
    }
  } else {
    streak = 0;
    if (idx > 0) {
      nextIdx = idx - 1;
      reason = 'stepped down after a wrong answer';
    } else {
      reason = 'wrong — already at the easiest rung';
    }
  }

  nextIdx = clampRung(nextIdx);
  const nextDifficulty = RUNGS[nextIdx];
  return {
    nextDifficulty,
    bloomLevel: BLOOM_BY_RUNG[nextDifficulty],
    consecutiveCorrect: streak,
    changed: nextIdx !== idx,
    reason,
  };
}

// Load or seed the persisted rung for a topic, blended with the mastery band.
async function resume({ studentId, schoolId, subject, topicId, topicTitle }) {
  const AdaptivePracticeState = require('../models/AdaptivePracticeState');
  const MasteryScore = require('../models/MasteryScore');
  const [state, mastery] = await Promise.all([
    AdaptivePracticeState.findOne({ studentId, subject, topicId }).lean(),
    MasteryScore.findOne({ studentId, schoolId, subject, topicId }).lean(),
  ]);
  const masteryRung = startingDifficulty(mastery?.score ?? null);
  // Use the persisted rung, but never more than one rung above the mastery band.
  let difficulty = state?.difficulty || masteryRung;
  if (RUNGS.indexOf(difficulty) > RUNGS.indexOf(masteryRung) + 1) difficulty = RUNGS[clampRung(RUNGS.indexOf(masteryRung) + 1)];
  return {
    difficulty,
    bloomLevel: BLOOM_BY_RUNG[difficulty],
    masteryScore: mastery?.score ?? null,
    fromPersistedState: Boolean(state),
    topicTitle: topicTitle || state?.topicTitle || mastery?.topicTitle || '',
  };
}

async function persist({ studentId, schoolId, subject, topicId, topicTitle, difficulty, bloomLevel, answered, correct }) {
  const AdaptivePracticeState = require('../models/AdaptivePracticeState');
  await AdaptivePracticeState.updateOne(
    { studentId, subject, topicId },
    {
      $setOnInsert: { schoolId, studentId, subject, topicId },
      $set: { difficulty, bloomLevel, topicTitle: topicTitle || '', lastSessionAt: new Date() },
      $inc: { questionsAnswered: answered ? 1 : 0, correctCount: correct ? 1 : 0 },
    },
    { upsert: true, runValidators: true },
  );
}

module.exports = { step, resume, persist, startingDifficulty, RUNGS, BLOOM_BY_RUNG };
