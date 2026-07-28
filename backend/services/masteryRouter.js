const MasteryScore = require('../models/MasteryScore');

const THRESHOLDS = { CRITICAL: 40, LOW: 60, MID: 75, HIGH: 90 };
const INTERVALS  = [1, 3, 7, 14, 30];

const TIER_MAP = {
  basic_lesson:  { difficulty: 'easy',   action: 'basic_lesson',  label: 'Review Basics',          description: 'Start with foundational concepts for this topic.' },
  revision:      { difficulty: 'easy',   action: 'revision',      label: 'Revise & Practice',      description: 'Revisit key concepts and try easy questions.' },
  medium_quiz:   { difficulty: 'medium', action: 'medium_quiz',   label: 'Take a Quiz',            description: 'Test your understanding with medium-difficulty questions.' },
  advance:       { difficulty: 'hard',   action: 'advance',       label: 'Advance to Next Topic',  description: 'Move forward — you have a strong grasp of this topic.' },
  challenge:     { difficulty: 'hard',   action: 'challenge',     label: 'Challenge Yourself',     description: 'You\'ve mastered this. Try advanced and analysis-level questions.' },
};

/**
 * Returns the recommended next action for a student on a topic.
 */
async function getNextAction(studentId, subject, topicId) {
  const m = await MasteryScore.findOne({ studentId, subject, topicId }).lean();
  const score = m?.score ?? 0;

  let key;
  if (score < THRESHOLDS.CRITICAL) key = 'basic_lesson';
  else if (score < THRESHOLDS.LOW)  key = 'revision';
  else if (score < THRESHOLDS.MID)  key = 'medium_quiz';
  else if (score < THRESHOLDS.HIGH) key = 'advance';
  else                               key = 'challenge';

  return {
    score,
    attemptCount: m?.attemptCount ?? 0,
    topicTitle: m?.topicTitle || '',
    chapterTitle: m?.chapterTitle || '',
    ...TIER_MAP[key],
    thresholds: THRESHOLDS,
  };
}

/**
 * Returns suggested quiz difficulty string based on mastery score.
 */
async function getSuggestedDifficulty(studentId, subject, topicId) {
  const result = await getNextAction(studentId, subject, topicId);
  return result.difficulty;
}

/**
 * Returns spaced repetition interval index based on mastery stage.
 */
function getNextInterval(stage = 0) {
  return INTERVALS[Math.min(stage, INTERVALS.length - 1)];
}

module.exports = { getNextAction, getSuggestedDifficulty, getNextInterval, THRESHOLDS };
