const DAY = 86400000;
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const timeOf = (e) => new Date(e.metadata?.assessedAt || e.createdAt).getTime();
const credible = (e) => !['decay', 'self-report'].includes(e.source)
  && !e.metadata?.needsReview && e.metadata?.provenance !== 'student_reported' && Number.isFinite(e.assessmentScore);

function summarizeEvidence(events, now = Date.now()) {
  const eligible = events.filter(credible).filter((e) => timeOf(e) <= now);
  const recent = eligible.filter((e) => timeOf(e) > now - 7 * DAY);
  const prior = eligible.filter((e) => timeOf(e) > now - 14 * DAY && timeOf(e) <= now - 7 * DAY);
  const recentAvg = mean(recent.map((e) => e.assessmentScore));
  const priorAvg = mean(prior.map((e) => e.assessmentScore));
  const delta = recentAvg != null && priorAvg != null ? recentAvg - priorAvg : null;
  const trend = delta == null ? 'insufficient_data' : delta < -5 ? 'declining' : delta > 5 ? 'improving' : 'stable';
  const isAtRisk = recentAvg != null && (recentAvg < 50 || trend === 'declining');
  const riskScore = recentAvg == null ? null : Math.min(100,
    (recentAvg < 40 ? 90 : recentAvg < 50 ? 70 : recentAvg < 60 ? 50 : 20) + (delta < -15 ? 20 : delta < -5 ? 10 : 0));
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const start = now - (7 - i) * 2 * DAY;
    const group = eligible.filter((e) => timeOf(e) > start && timeOf(e) <= start + 2 * DAY);
    return { label: new Date(start).toISOString().slice(0, 10), avg: mean(group.map((e) => e.assessmentScore)), count: group.length };
  });
  return { isAtRisk, riskScore, recentAvg, priorAvg, delta, trend, daysAnalyzed: 14,
    sampleCount: recent.length, dataStatus: recentAvg == null ? 'insufficient_data' : 'available',
    algorithmVersion: 'assessment-risk-v1', buckets, overallTrend: trend, rollingAvg: mean(eligible.map((e) => e.assessmentScore)) };
}

// Least-squares projection fitted to daily observed scores. This is a statistical
// estimate, with sample count/residual error; it is not a calibrated risk probability.
function forecastScores(events, now = Date.now()) {
  const days = new Map();
  events.filter(credible).filter((e) => timeOf(e) > now - 30 * DAY && timeOf(e) <= now).forEach((e) => {
    const day = Math.floor(timeOf(e) / DAY);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(e.assessmentScore);
  });
  const points = [...days].sort(([a], [b]) => a - b).map(([day, scores]) => ({ x: day - Math.floor(now / DAY), y: mean(scores) }));
  const base = { method: 'daily-linear-regression', version: 'forecast-v1', sampleDays: points.length, horizonDays: 7 };
  if (points.length < 4 || points.at(-1).x - points[0].x < 7 || points.at(-1).x < -7) {
    return { ...base, status: 'insufficient_data', predictedScore: null, residualError: null };
  }
  const mx = mean(points.map((p) => p.x)), my = mean(points.map((p) => p.y));
  const slope = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) /
    points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const intercept = my - slope * mx;
  const residualError = Math.sqrt(mean(points.map((p) => (p.y - (intercept + slope * p.x)) ** 2)));
  return { ...base, status: 'estimated', predictedScore: Math.round(Math.max(0, Math.min(100, intercept + 7 * slope))),
    slopePerDay: slope, residualError, explanation: 'Projection from daily assessment averages over the last 30 days.' };
}

async function loadEvidence({ studentId, schoolId }) {
  return require('../models/MasteryEvent').find({ schoolId, studentId,
    createdAt: { $gte: new Date(Date.now() - 31 * DAY) } }).sort({ createdAt: 1 }).lean();
}

module.exports = { summarizeEvidence, forecastScores, loadEvidence, credible, timeOf };
