/**
 * equityMonitoringService.js
 * Equity / bias monitoring: checks whether the AI answer evaluator behaves
 * consistently across student cohorts, rather than assuming it does.
 *
 * Deliberately scoped to gender only. caste/religion/category exist on
 * StudentUser but are NOT used here — slicing AI performance by those fields
 * is a sensitive, high-stakes analysis that needs dedicated ethical review
 * and is out of scope for an automated monitor. This is a starting point
 * (one legitimate, low-risk cohort split), not the full feature.
 *
 * A flagged gap is a prompt for a human to look closer, never a verdict —
 * cohorts can differ for many legitimate reasons (subject mix, sample
 * composition) that this aggregate view cannot see.
 */
const MIN_COHORT_SAMPLE = 10;
const SCORE_GAP_THRESHOLD = 0.15;      // score is 0..1
const NEEDS_REVIEW_GAP_THRESHOLD = 0.15; // rate, 0..1

async function computeGenderModelParity({ schoolId, sinceDays = 90 }) {
  const AiInteractionLog = require('../models/AiInteractionLog');
  const StudentUser = require('../models/StudentUser');
  const since = new Date(Date.now() - sinceDays * 86400000);

  const students = await StudentUser.find({ schoolId }).select('gender').lean();
  const genderById = new Map(students.map((s) => [String(s._id), s.gender || 'unspecified']));

  const logs = await AiInteractionLog.find({
    schoolId, feature: { $in: ['answer_evaluate', 'long_answer_evaluate'] },
    status: 'success', score: { $ne: null }, createdAt: { $gte: since },
  }).select('userId score confidenceScore needsReview').lean();

  const byGender = new Map();
  for (const log of logs) {
    const gender = genderById.get(String(log.userId)) || 'unspecified';
    if (!byGender.has(gender)) byGender.set(gender, { scores: [], confidences: [], needsReviewCount: 0, count: 0 });
    const bucket = byGender.get(gender);
    bucket.count += 1;
    bucket.scores.push(log.score);
    if (log.confidenceScore != null) bucket.confidences.push(log.confidenceScore);
    if (log.needsReview) bucket.needsReviewCount += 1;
  }

  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const cohorts = [...byGender.entries()].map(([gender, b]) => ({
    gender,
    sampleSize: b.count,
    avgScore: mean(b.scores),
    avgConfidence: mean(b.confidences),
    needsReviewRate: b.count ? b.needsReviewCount / b.count : null,
    meetsMinSample: b.count >= MIN_COHORT_SAMPLE,
  }));

  const eligible = cohorts.filter((c) => c.meetsMinSample && c.avgScore != null);
  const flags = [];
  if (eligible.length >= 2) {
    const byScore = [...eligible].sort((a, b) => a.avgScore - b.avgScore);
    const scoreGap = byScore[byScore.length - 1].avgScore - byScore[0].avgScore;
    if (scoreGap >= SCORE_GAP_THRESHOLD) {
      flags.push({
        signal: 'avg_score_gap', gap: Math.round(scoreGap * 100) / 100,
        lower: byScore[0].gender, higher: byScore[byScore.length - 1].gender,
      });
    }
    const byReview = [...eligible].filter((c) => c.needsReviewRate != null).sort((a, b) => a.needsReviewRate - b.needsReviewRate);
    if (byReview.length >= 2) {
      const reviewGap = byReview[byReview.length - 1].needsReviewRate - byReview[0].needsReviewRate;
      if (reviewGap >= NEEDS_REVIEW_GAP_THRESHOLD) {
        flags.push({
          signal: 'needs_review_rate_gap', gap: Math.round(reviewGap * 100) / 100,
          lower: byReview[0].gender, higher: byReview[byReview.length - 1].gender,
        });
      }
    }
  }

  return {
    method: 'gender-cohort-v1',
    sinceDays,
    minCohortSample: MIN_COHORT_SAMPLE,
    cohorts,
    dataStatus: eligible.length >= 2 ? 'available' : 'insufficient_sample',
    flags,
  };
}

module.exports = { computeGenderModelParity, MIN_COHORT_SAMPLE, SCORE_GAP_THRESHOLD, NEEDS_REVIEW_GAP_THRESHOLD };
