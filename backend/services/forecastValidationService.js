/**
 * forecastValidationService.js
 * Retrospective backtest for learningEvidenceService.forecastScores (the
 * daily-linear-regression engine behind classLearningAnalytics.forecastClass,
 * i.e. "Performance Forecasting" and "Topic Failure Prediction"). Same idea as
 * mlValidationService.backtestAtRiskDetection: predict from evidence up to a
 * cutoff, then check the student's own later assessments as ground truth —
 * no external data needed. forecastScores' regression horizon is fixed at 7
 * days, so the backtest's cutoff is pinned to (asOf - 7 days) to match it.
 */
const { forecastScores, loadEvidence, credible } = require('./learningEvidenceService');

const DAY = 86400000;
const HORIZON_DAYS = 7; // matches the fixed horizon baked into forecastScores()
const DEFAULT_PASS_THRESHOLD = 40;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

async function backtestStudent({ studentId, schoolId, cutoff, now, passThreshold }) {
  const priorEvidence = await loadEvidence({ studentId, schoolId, asOf: cutoff, windowDays: 30 });
  const forecast = forecastScores(priorEvidence, cutoff);

  const futureEvents = await loadEvidence({ studentId, schoolId, asOf: now, windowDays: HORIZON_DAYS });
  const actualAvg = mean(futureEvents.filter(credible).map((e) => e.assessmentScore));

  if (forecast.status !== 'estimated' || actualAvg == null) {
    return { studentId, included: false, reason: forecast.status !== 'estimated' ? 'no_forecast' : 'no_outcome_evidence' };
  }

  const error = forecast.predictedScore - actualAvg;
  return {
    studentId,
    included: true,
    predictedScore: forecast.predictedScore,
    actualAvgScore: Math.round(actualAvg * 100) / 100,
    error: Math.round(error * 100) / 100,
    predictedFail: forecast.predictedScore < passThreshold,
    actualFail: actualAvg < passThreshold,
  };
}

// Backtests both framings of the same forecast: regression accuracy (MAE/RMSE
// against the actual next-window average) and pass/fail prediction (confusion
// matrix against a passing threshold) — "Performance Forecasting" and "Topic
// Failure Prediction" are the same underlying engine viewed two ways.
async function backtestScoreForecast({ schoolId, studentIds, asOf, passThreshold = DEFAULT_PASS_THRESHOLD }) {
  const now = asOf ? new Date(asOf).getTime() : Date.now();
  const cutoff = now - HORIZON_DAYS * DAY;

  const rows = await Promise.all(
    studentIds.map((studentId) => backtestStudent({ studentId, schoolId, cutoff, now, passThreshold }))
  );

  const evaluable = rows.filter((r) => r.included);
  const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

  const errors = evaluable.map((r) => r.error);
  const mae = errors.length ? mean(errors.map((e) => Math.abs(e))) : null;
  const rmse = errors.length ? Math.sqrt(mean(errors.map((e) => e * e))) : null;

  const truePositive = evaluable.filter((r) => r.predictedFail && r.actualFail).length;
  const falsePositive = evaluable.filter((r) => r.predictedFail && !r.actualFail).length;
  const falseNegative = evaluable.filter((r) => !r.predictedFail && r.actualFail).length;
  const trueNegative = evaluable.filter((r) => !r.predictedFail && !r.actualFail).length;
  const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : null;
  const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : null;
  const accuracy = evaluable.length ? (truePositive + trueNegative) / evaluable.length : null;

  return {
    method: 'retrospective-holdout-v1',
    horizonDays: HORIZON_DAYS,
    passThreshold,
    sampleSize: evaluable.length,
    excludedCount: rows.length - evaluable.length,
    dataStatus: evaluable.length < 10 ? 'insufficient_sample' : 'available',
    regression: { mae: round2(mae), rmse: round2(rmse) },
    failurePrediction: {
      confusionMatrix: { truePositive, falsePositive, falseNegative, trueNegative },
      precision: round2(precision), recall: round2(recall), accuracy: round2(accuracy),
    },
    rows,
  };
}

module.exports = { backtestScoreForecast, HORIZON_DAYS, DEFAULT_PASS_THRESHOLD };
