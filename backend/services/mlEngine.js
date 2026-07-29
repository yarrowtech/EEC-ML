const MasteryScore = require('../models/MasteryScore');
const StudentProgress = require('../models/StudentProgress');
const TeachingMaterial = require('../models/TeachingMaterial');
const StudentUser = require('../models/StudentUser');

const ALPHA = 0.35;
const MASTERY_TARGET = 75;

function tierFromScore(s) {
  if (s >= 80) return 'high';
  if (s >= 60) return 'mid';
  return 'low';
}

function engagementLabel(score) {
  if (score >= 75) return 'very_high';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

async function computeWeightedMastery({ studentId, schoolId, subject }) {
  const filter = { studentId, schoolId };
  if (subject) filter.subject = subject;
  const records = await MasteryScore.find(filter).lean();

  return records.map((r) => {
    const n = Math.max(r.attemptCount || 1, 1);
    // EMA: treat each attempt as contributing alpha*(1-alpha)^k weight
    // With a single stored score and attemptCount, approximate: weightedScore pulls score toward target by decay
    const decay = Math.pow(1 - ALPHA, n - 1);
    const weightedScore = Math.round(r.score * (1 - decay * (1 - ALPHA)) + (decay * ALPHA * r.score));
    return {
      topicId: r.topicId,
      topicTitle: r.topicTitle,
      chapterTitle: r.chapterTitle,
      subject: r.subject,
      rawScore: r.score,
      weightedScore: Math.min(100, Math.max(0, weightedScore)),
      attemptCount: r.attemptCount,
      tier: tierFromScore(r.score),
    };
  });
}

async function computeAtRisk({ studentId, schoolId }) {
  const progress = await StudentProgress.findOne({ studentId, schoolId }).lean();
  const submissions = (progress?.submissions || []).filter(
    (s) => s.score != null && s.submittedAt
  );

  const now = Date.now();
  const DAY = 86400000;
  const recent = submissions.filter((s) => now - new Date(s.submittedAt).getTime() <= 7 * DAY);
  const prior = submissions.filter((s) => {
    const age = now - new Date(s.submittedAt).getTime();
    return age > 7 * DAY && age <= 14 * DAY;
  });

  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b.score, 0) / arr.length : null;
  const recentAvg = avg(recent);
  const priorAvg = avg(prior);

  if (recentAvg === null) {
    return { isAtRisk: false, riskScore: 0, recentAvg: null, priorAvg: null, delta: 0, trend: 'stable', daysAnalyzed: 14 };
  }

  const delta = priorAvg !== null ? recentAvg - priorAvg : 0;
  const trend = delta < -5 ? 'declining' : delta > 5 ? 'improving' : 'stable';
  const isAtRisk = trend === 'declining' || recentAvg < 50;

  // riskScore: 0=safe, 100=critical
  let riskScore = 0;
  if (recentAvg < 40) riskScore = 90;
  else if (recentAvg < 50) riskScore = 70;
  else if (recentAvg < 60) riskScore = 50;
  else riskScore = 20;
  if (delta < -15) riskScore = Math.min(100, riskScore + 20);
  else if (delta < -5) riskScore = Math.min(100, riskScore + 10);

  return { isAtRisk, riskScore, recentAvg: Math.round(recentAvg), priorAvg: priorAvg !== null ? Math.round(priorAvg) : null, delta: Math.round(delta), trend, daysAnalyzed: 14 };
}

async function computeRollingTrend({ studentId, schoolId, days = 14 }) {
  const progress = await StudentProgress.findOne({ studentId, schoolId }).lean();
  const submissions = (progress?.submissions || []).filter(
    (s) => s.score != null && s.submittedAt
  );

  const now = Date.now();
  const DAY = 86400000;
  const bucketSize = Math.ceil(days / 7);
  const buckets = [];

  for (let i = 6; i >= 0; i--) {
    const end = now - i * bucketSize * DAY;
    const start = end - bucketSize * DAY;
    const inBucket = submissions.filter((s) => {
      const t = new Date(s.submittedAt).getTime();
      return t >= start && t < end;
    });
    const avg = inBucket.length ? Math.round(inBucket.reduce((a, b) => a + b.score, 0) / inBucket.length) : null;
    const label = `Day ${days - (i + 1) * bucketSize + 1}–${days - i * bucketSize}`;
    buckets.push({ label, avg, count: inBucket.length });
  }

  const scored = buckets.filter((b) => b.avg !== null);
  const rollingAvg = scored.length ? Math.round(scored.reduce((a, b) => a + b.avg, 0) / scored.length) : null;

  let overallTrend = 'stable';
  if (scored.length >= 2) {
    const first = scored[0].avg;
    const last = scored[scored.length - 1].avg;
    const diff = last - first;
    overallTrend = diff < -5 ? 'declining' : diff > 5 ? 'improving' : 'stable';
  }

  return { buckets, overallTrend, rollingAvg };
}

async function computeEngagement({ studentId, schoolId }) {
  const sidStr = String(studentId);
  const materials = await TeachingMaterial.find({ schoolId }).select('viewedBy quizAttempts completedBy').lean();

  let totalViews = 0;
  let totalTime = 0;
  let quizCount = 0;

  for (const m of materials) {
    const vEntry = (m.viewedBy || []).find((v) => String(v.studentId) === sidStr);
    if (vEntry) {
      totalViews += vEntry.viewCount || 0;
      totalTime += vEntry.timeSpent || 0;
    }
    const qEntries = (m.quizAttempts || []).filter((q) => String(q.studentId) === sidStr);
    quizCount += qEntries.length;
  }

  // Get all students in school for median normalisation
  const allStudents = await StudentUser.find({ schoolId }).select('_id').lean();
  const peerTotals = allStudents.map((s) => {
    const pSid = String(s._id);
    let v = 0, t = 0, q = 0;
    for (const m of materials) {
      const ve = (m.viewedBy || []).find((x) => String(x.studentId) === pSid);
      if (ve) { v += ve.viewCount || 0; t += ve.timeSpent || 0; }
      q += (m.quizAttempts || []).filter((x) => String(x.studentId) === pSid).length;
    }
    return { v, t, q };
  });

  const median = (arr) => {
    if (!arr.length) return 1;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2 || 1;
  };

  const medV = median(peerTotals.map((p) => p.v)) || 1;
  const medT = median(peerTotals.map((p) => p.t)) || 1;
  const medQ = median(peerTotals.map((p) => p.q)) || 1;

  const viewScore = Math.min(100, (totalViews / medV) * 50);
  const timeScore = Math.min(100, (totalTime / medT) * 50);
  const submissionScore = Math.min(100, (quizCount / medQ) * 50);

  const engagementScore = Math.round(viewScore * 0.25 + timeScore * 0.35 + submissionScore * 0.4);

  return {
    engagementScore,
    components: {
      viewScore: Math.round(viewScore),
      timeScore: Math.round(timeScore),
      submissionScore: Math.round(submissionScore),
    },
    label: engagementLabel(engagementScore),
  };
}

async function computeLearningPace({ studentId, schoolId }) {
  const records = await MasteryScore.find({ studentId, schoolId }).lean();
  if (!records.length) {
    return { avgSessionsPerWeek: 0, currentAvgMastery: 0, targetMastery: MASTERY_TARGET, estimatedWeeksToTarget: null, paceLabel: 'insufficient_data' };
  }

  const currentAvgMastery = Math.round(records.reduce((a, r) => a + r.score, 0) / records.length);

  // Estimate sessions/week from attemptCount and age of records
  const now = Date.now();
  const WEEK = 7 * 86400000;
  const totalAttempts = records.reduce((a, r) => a + (r.attemptCount || 1), 0);
  const oldestCreated = records.reduce((min, r) => {
    const t = new Date(r.createdAt).getTime();
    return t < min ? t : min;
  }, now);
  const ageWeeks = Math.max((now - oldestCreated) / WEEK, 0.1);
  const avgSessionsPerWeek = Math.round((totalAttempts / ageWeeks) * 10) / 10;

  if (currentAvgMastery >= MASTERY_TARGET) {
    return { avgSessionsPerWeek, currentAvgMastery, targetMastery: MASTERY_TARGET, estimatedWeeksToTarget: 0, paceLabel: 'on_track' };
  }

  // Improvement rate: average gain per attempt across records
  // Use (score - 50 baseline) / attemptCount as proxy for weekly gain rate
  const gainPerAttempt = records.reduce((a, r) => {
    const gain = Math.max(0, r.score - 40) / Math.max(r.attemptCount, 1);
    return a + gain;
  }, 0) / records.length;

  const gainPerWeek = gainPerAttempt * avgSessionsPerWeek;
  const gap = MASTERY_TARGET - currentAvgMastery;
  const estimatedWeeksToTarget = gainPerWeek > 0.5 ? Math.ceil(gap / gainPerWeek) : null;

  let paceLabel = 'slow';
  if (estimatedWeeksToTarget === null) paceLabel = 'stalled';
  else if (estimatedWeeksToTarget <= 2) paceLabel = 'fast';
  else if (estimatedWeeksToTarget <= 5) paceLabel = 'on_track';

  return { avgSessionsPerWeek, currentAvgMastery, targetMastery: MASTERY_TARGET, estimatedWeeksToTarget, paceLabel };
}

async function detectLearningGaps({ studentId, schoolId }) {
  const sidStr = String(studentId);
  const weakTopics = await MasteryScore.find({ studentId, schoolId, score: { $lt: 60 } }).lean();
  if (!weakTopics.length) return { gaps: [] };

  const materials = await TeachingMaterial.find({ schoolId }).select('viewedBy quizAttempts subjectName').lean();

  const gaps = weakTopics.map((topic) => {
    const subjectMats = materials.filter(
      (m) => m.subjectName && topic.subject && m.subjectName.toLowerCase() === topic.subject.toLowerCase()
    );

    let totalViews = 0;
    let totalQuizAttempts = 0;
    let avgQuizScore = null;
    const quizScores = [];

    for (const m of subjectMats) {
      const ve = (m.viewedBy || []).find((v) => String(v.studentId) === sidStr);
      if (ve) totalViews += ve.viewCount || 0;
      const qa = (m.quizAttempts || []).filter((q) => String(q.studentId) === sidStr);
      totalQuizAttempts += qa.length;
      qa.forEach((q) => q.score != null && quizScores.push(q.score));
    }

    if (quizScores.length) avgQuizScore = Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length);

    let gapType = 'hard';
    if (topic.attemptCount >= 3) gapType = 'confused';
    else if (totalViews < 1) gapType = 'absent';

    const severity = topic.score < 40 ? 'critical' : topic.score < 50 ? 'high' : 'medium';

    return {
      topicId: topic.topicId,
      topicTitle: topic.topicTitle,
      subject: topic.subject,
      score: topic.score,
      engagementLevel: totalViews === 0 ? 'none' : totalViews < 3 ? 'low' : 'moderate',
      gapType,
      severity,
      avgQuizScore,
    };
  });

  return { gaps: gaps.sort((a, b) => a.score - b.score) };
}

async function computeAllScores({ studentId, schoolId }) {
  const [mastery, atRisk, trend, engagement, pace, gaps] = await Promise.all([
    computeWeightedMastery({ studentId, schoolId }),
    computeAtRisk({ studentId, schoolId }),
    computeRollingTrend({ studentId, schoolId }),
    computeEngagement({ studentId, schoolId }),
    computeLearningPace({ studentId, schoolId }),
    detectLearningGaps({ studentId, schoolId }),
  ]);

  const masteryAvg = mastery.length
    ? Math.round(mastery.reduce((a, m) => a + m.weightedScore, 0) / mastery.length)
    : 0;

  return { mastery, masteryAvg, atRisk, trend, engagement, pace, gaps };
}

module.exports = {
  computeWeightedMastery,
  computeAtRisk,
  computeRollingTrend,
  computeEngagement,
  computeLearningPace,
  detectLearningGaps,
  computeAllScores,
};
