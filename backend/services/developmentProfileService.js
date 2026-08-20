/**
 * developmentProfileService.js
 *
 * Computes and updates a student's 6-category development profile
 * from existing data sources (flashcards, reading/writing assessments,
 * mastery scores, wellbeing, and observations).
 *
 * Categories:
 *   1. Cognitive      — MasteryScore avg + BaselineResult
 *   2. Memory         — FlashcardResult recall rate + SpacedRepetition stage
 *   3. Creative       — No auto data yet; set via teacher/offline scoring
 *   4. Language       — ReadingAssessment + WritingAssessment scores
 *   5. SocialEmotional— Wellbeing mood + socialEngagement + StudentObservation
 *   6. Physical       — StudentObservation (teacher manual input only for now)
 */

const MasteryScore            = require('../models/MasteryScore');
const FlashcardResult         = require('../models/FlashcardResult');
const SpacedRepetitionSchedule = require('../models/SpacedRepetitionSchedule');
const ReadingAssessment       = require('../models/ReadingAssessment');
const WritingAssessment       = require('../models/WritingAssessment');
const Wellbeing               = require('../models/Wellbeing');
const StudentObservation      = require('../models/StudentObservation');
const StudentDevelopmentProfile = require('../models/StudentDevelopmentProfile');

// ── Helpers ───────────────────────────────────────────────────────────────────

const avg = (arr) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;

const moodToScore = { excellent: 95, good: 75, neutral: 55, concerning: 35, critical: 15 };

// Spaced repetition stage (0–4) → memory health score
const srStageToScore = (stage) => [30, 50, 65, 80, 95][stage] ?? 30;

function computeTrend(oldScore, newScore) {
  if (oldScore == null || newScore == null) return 'unknown';
  const diff = newScore - oldScore;
  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}

// ── Category computers ────────────────────────────────────────────────────────

async function computeCognitive(studentId, schoolId) {
  const scores = await MasteryScore.find({ studentId, schoolId }).lean();
  if (!scores.length) return null;
  return avg(scores.map((s) => s.score));
}

async function computeMemory(studentId, schoolId) {
  const [flashcards, srDocs] = await Promise.all([
    FlashcardResult.find({ studentId, schoolId }).lean(),
    SpacedRepetitionSchedule.find({ studentId, schoolId }).lean(),
  ]);

  const signals = [];

  // Flashcard recall rate
  if (flashcards.length) {
    const gotIt = flashcards.filter((f) => f.result === 'got_it').length;
    signals.push(Math.round((gotIt / flashcards.length) * 100));
  }

  // Spaced repetition stage average
  if (srDocs.length) {
    const srScores = srDocs.map((d) => srStageToScore(d.stage));
    signals.push(avg(srScores));
  }

  return signals.length ? avg(signals) : null;
}

async function computeLanguage(studentId, schoolId) {
  const [reading, writing] = await Promise.all([
    ReadingAssessment.find({ studentId, schoolId }).lean(),
    WritingAssessment.find({ studentId, schoolId }).lean(),
  ]);

  const signals = [];

  if (reading.length) {
    const readingScores = reading
      .map((r) => r.scores?.overall ?? r.score ?? null)
      .filter((s) => s != null);
    if (readingScores.length) signals.push(avg(readingScores));
  }

  if (writing.length) {
    const writingScores = writing
      .map((w) => w.scores?.overall ?? w.score ?? null)
      .filter((s) => s != null);
    if (writingScores.length) signals.push(avg(writingScores));
  }

  return signals.length ? avg(signals) : null;
}

async function computeSocialEmotional(studentId, schoolId) {
  const [wellbeing, observations] = await Promise.all([
    Wellbeing.findOne({ student: studentId, schoolId }).lean(),
    StudentObservation.find({ studentId, schoolId, source: 'teacher' })
      .sort({ recordedAt: -1 }).limit(10).lean(),
  ]);

  const signals = [];

  if (wellbeing) {
    const moodScore = moodToScore[wellbeing.mood] ?? 55;
    const engagementScore = wellbeing.socialEngagement * 10; // 1–10 → 10–100
    signals.push(moodScore, engagementScore);
  }

  // Observations with moodRating (1–5 → 20–100)
  const ratedObs = observations.filter((o) => o.moodRating != null);
  if (ratedObs.length) {
    signals.push(avg(ratedObs.map((o) => o.moodRating * 20)));
  }

  return signals.length ? avg(signals) : null;
}

// ── Main update function ──────────────────────────────────────────────────────

async function updateDevelopmentProfile(studentId, schoolId) {
  const existing = await StudentDevelopmentProfile.findOne({ studentId, schoolId }).lean();

  const [cognitiveScore, memoryScore, languageScore, socialScore] = await Promise.all([
    computeCognitive(studentId, schoolId),
    computeMemory(studentId, schoolId),
    computeLanguage(studentId, schoolId),
    computeSocialEmotional(studentId, schoolId),
  ]);

  const now = new Date();

  const buildCategory = (newScore, oldCategory) => ({
    score: newScore,
    trend: computeTrend(oldCategory?.score ?? null, newScore),
    lastUpdated: newScore != null ? now : (oldCategory?.lastUpdated ?? null),
    dataPoints: (oldCategory?.dataPoints ?? 0) + (newScore != null ? 1 : 0),
  });

  const update = {
    cognitive:       buildCategory(cognitiveScore,  existing?.cognitive),
    memory:          buildCategory(memoryScore,      existing?.memory),
    language:        buildCategory(languageScore,    existing?.language),
    socialEmotional: buildCategory(socialScore,      existing?.socialEmotional),
    // creative and physical require manual/offline input — preserve existing values
    creative:        existing?.creative    ?? { score: null, trend: 'unknown', lastUpdated: null, dataPoints: 0 },
    physical:        existing?.physical    ?? { score: null, trend: 'unknown', lastUpdated: null, dataPoints: 0 },
  };

  return StudentDevelopmentProfile.findOneAndUpdate(
    { studentId, schoolId },
    { $set: update },
    { upsert: true, new: true }
  ).lean();
}

/**
 * Returns a human-readable summary of the 6-category profile for LLM injection.
 */
function formatProfileForLLM(profile) {
  if (!profile) return null;

  const LABELS = {
    cognitive:       'Cognitive Development (reasoning, analysis, intelligence)',
    memory:          'Memory & Attention (recall, concentration, attention span)',
    creative:        'Creative Development (divergent thinking, imagination)',
    language:        'Language & Communication (reading, writing, speaking, vocabulary)',
    socialEmotional: 'Motivation & Social-Emotional (confidence, collaboration, emotional development)',
    physical:        'Physical Development (fine motor skills)',
  };

  const lines = ['── HOLISTIC DEVELOPMENT PROFILE (6 categories) ──'];

  for (const [key, label] of Object.entries(LABELS)) {
    const cat = profile[key];
    if (cat?.score != null) {
      const status = cat.score < 40 ? 'NEEDS SUPPORT' : cat.score < 65 ? 'DEVELOPING' : cat.score < 85 ? 'PROGRESSING' : 'STRONG';
      lines.push(`${label}: ${cat.score}% [${status}] — trend: ${cat.trend}`);
    } else {
      lines.push(`${label}: No data yet`);
    }
  }

  // Highlight the weakest category for the LLM
  const scored = Object.entries(profile)
    .filter(([, v]) => v?.score != null)
    .sort(([, a], [, b]) => a.score - b.score);

  if (scored.length) {
    const [weakKey, weakVal] = scored[0];
    lines.push(`FOCUS AREA: Student needs most support in "${LABELS[weakKey]}" (${weakVal.score}%) — tailor content to strengthen this area.`);
  }

  lines.push('── END HOLISTIC PROFILE ──');
  return lines.join('\n');
}

/**
 * Maps the student's weakest development category to a recommended Bloom's level.
 *
 * Bloom's Taxonomy (low → high):
 *   remember → understand → apply → analyse → evaluate → create
 *
 * Logic:
 *   - If Memory is weak       → start at remember/understand (build recall foundation)
 *   - If Cognitive is weak    → target apply/analyse (develop reasoning)
 *   - If Creative is weak     → target evaluate/create (push imagination)
 *   - If Language is weak     → target understand/apply (practice expression)
 *   - If Social-Emotional weak→ target evaluate/create (debate, empathy scenarios)
 *   - Strong overall (≥80%)   → always push to evaluate/create
 *   - No data                 → default to apply/analyse (safe middle ground)
 */
function getBloomRecommendation(profile) {
  if (!profile) {
    return {
      targetLevels: ['apply', 'analyse'],
      reason: 'No profile data — using default middle Bloom levels',
      instruction: 'Target APPLY and ANALYSE level questions — ask students to use knowledge in new situations and break down concepts.',
    };
  }

  // Find weakest scored category
  const categories = [
    { key: 'memory',          score: profile.memory?.score },
    { key: 'cognitive',       score: profile.cognitive?.score },
    { key: 'creative',        score: profile.creative?.score },
    { key: 'language',        score: profile.language?.score },
    { key: 'socialEmotional', score: profile.socialEmotional?.score },
  ].filter((c) => c.score != null).sort((a, b) => a.score - b.score);

  // Check if student is strong overall
  const scoredCategories = categories.filter((c) => c.score != null);
  const avgScore = scoredCategories.length
    ? scoredCategories.reduce((s, c) => s + c.score, 0) / scoredCategories.length
    : null;

  if (avgScore != null && avgScore >= 80) {
    return {
      targetLevels: ['evaluate', 'create'],
      reason: `Strong overall (avg ${Math.round(avgScore)}%) — push to highest Bloom levels`,
      instruction: 'Student is performing well. Target EVALUATE and CREATE level — ask them to judge, debate, design, and invent. Push beyond the textbook.',
    };
  }

  const weakest = categories[0];
  if (!weakest) {
    return {
      targetLevels: ['apply', 'analyse'],
      reason: 'No category data — using default',
      instruction: 'Target APPLY and ANALYSE level questions.',
    };
  }

  const BLOOM_MAP = {
    memory: {
      targetLevels: ['remember', 'understand'],
      reason: `Memory weak (${weakest.score}%) — build recall foundation first`,
      instruction: 'Student struggles with memory. Target REMEMBER and UNDERSTAND levels — use repetition, mnemonics, simple recall questions, and "explain in your own words" prompts. Do not jump to higher-order thinking yet.',
    },
    cognitive: {
      targetLevels: ['apply', 'analyse'],
      reason: `Cognitive weak (${weakest.score}%) — develop reasoning`,
      instruction: 'Student needs cognitive development. Target APPLY and ANALYSE levels — ask "what would happen if", "compare these two", "why did this occur" type questions. Encourage step-by-step reasoning.',
    },
    creative: {
      targetLevels: ['evaluate', 'create'],
      reason: `Creative thinking weak (${weakest.score}%) — push imagination`,
      instruction: 'Student needs creative development. Target EVALUATE and CREATE levels — ask them to design, invent, imagine scenarios, write stories, and defend opinions. Use open-ended "what if" questions.',
    },
    language: {
      targetLevels: ['understand', 'apply'],
      reason: `Language weak (${weakest.score}%) — practice expression`,
      instruction: 'Student struggles with language expression. Target UNDERSTAND and APPLY levels — ask them to explain concepts in their own words, write short responses, and use new vocabulary in sentences.',
    },
    socialEmotional: {
      targetLevels: ['evaluate', 'create'],
      reason: `Social-emotional weak (${weakest.score}%) — build confidence through expression`,
      instruction: 'Student needs social-emotional support. Use EVALUATE and CREATE levels with collaborative framing — "how would you help a friend understand this?", debate prompts, and group scenario questions.',
    },
  };

  return BLOOM_MAP[weakest.key] || {
    targetLevels: ['apply', 'analyse'],
    reason: 'Default Bloom target',
    instruction: 'Target APPLY and ANALYSE level questions.',
  };
}

module.exports = { updateDevelopmentProfile, formatProfileForLLM, getBloomRecommendation };
