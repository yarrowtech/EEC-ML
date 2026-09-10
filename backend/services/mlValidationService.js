/**
 * mlValidationService.js
 * Retrospective backtest for the at-risk detector in mlEngine.js: for each
 * student, predict at-risk status using only evidence up to a cutoff, then
 * check the actual outcome from the assessment events recorded after that
 * cutoff. This needs no external "ground truth" — a student's own later
 * assessments are the ground truth — so it produces real accuracy numbers
 * from whatever longitudinal history the school already has, and gets more
 * reliable as more history accumulates.
 */
const { computeAtRisk } = require('./mlEngine');
const { loadEvidence, credible } = require('./learningEvidenceService');

const DAY = 86400000;
const AT_RISK_THRESHOLD = 50;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

async function backtestStudent({ studentId, schoolId, cutoff, now, horizonDays }) {
  const predicted = await computeAtRisk({ studentId, schoolId, asOf: cutoff });
  const futureEvents = await loadEvidence({ studentId, schoolId, asOf: now, windowDays: horizonDays });
  const actualAvg = mean(futureEvents.filter(credible).map((e) => e.assessmentScore));

  if (predicted.riskScore == null || actualAvg == null) {
    return { studentId, included: false, reason: predicted.riskScore == null ? 'no_baseline_evidence' : 'no_outcome_evidence' };
  }

  return {
    studentId,
    included: true,
    predictedAtRisk: predicted.riskScore >= AT_RISK_THRESHOLD,
    predictedRiskScore: predicted.riskScore,
    predictedBand: predicted.dropoutRisk.band,
    actualAtRisk: actualAvg < AT_RISK_THRESHOLD,
    actualAvgScore: Math.round(actualAvg * 100) / 100,
  };
}

// Confusion-matrix backtest of computeAtRisk over a student cohort. `horizonDays`
// is both how far back the prediction cutoff sits and the length of the outcome
// window measured forward from it.
async function backtestAtRiskDetection({ schoolId, studentIds, horizonDays = 7, asOf }) {
  const now = asOf ? new Date(asOf).getTime() : Date.now();
  const cutoff = now - horizonDays * DAY;

  const rows = await Promise.all(
    studentIds.map((studentId) => backtestStudent({ studentId, schoolId, cutoff, now, horizonDays }))
  );

  const evaluable = rows.filter((r) => r.included);
  const truePositive = evaluable.filter((r) => r.predictedAtRisk && r.actualAtRisk).length;
  const falsePositive = evaluable.filter((r) => r.predictedAtRisk && !r.actualAtRisk).length;
  const falseNegative = evaluable.filter((r) => !r.predictedAtRisk && r.actualAtRisk).length;
  const trueNegative = evaluable.filter((r) => !r.predictedAtRisk && !r.actualAtRisk).length;

  const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : null;
  const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : null;
  const accuracy = evaluable.length ? (truePositive + trueNegative) / evaluable.length : null;
  const f1 = precision != null && recall != null && precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : null;
  const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

  return {
    method: 'retrospective-holdout-v1',
    horizonDays,
    sampleSize: evaluable.length,
    excludedCount: rows.length - evaluable.length,
    dataStatus: evaluable.length < 10 ? 'insufficient_sample' : 'available',
    confusionMatrix: { truePositive, falsePositive, falseNegative, trueNegative },
    precision: round2(precision),
    recall: round2(recall),
    accuracy: round2(accuracy),
    f1: round2(f1),
    rows,
  };
}

module.exports = { backtestAtRiskDetection };
