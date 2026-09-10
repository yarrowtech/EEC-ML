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

function calculateEma(values, alpha = ALPHA) {
  const scores = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!scores.length) return null;
  return scores.slice(1).reduce((ema, score) => (alpha * score) + ((1 - alpha) * ema), scores[0]);
}

async function computeWeightedMastery({ studentId, schoolId, subject }) {
  const filter = { studentId, schoolId };
  if (subject) filter.subject = subject;
  const records = await MasteryScore.find(filter).lean();

  // MasteryScore is a projection. Reconstruct the weighted value from the
  // append-only event stream when it is available, while retaining the stored
  // projection as a compatibility fallback for legacy records.
  let events = [];
  try {
    const MasteryEvent = require('../models/MasteryEvent');
    const eventFilter = { studentId, schoolId };
    if (subject) eventFilter.subject = subject;
    events = await MasteryEvent.find(eventFilter).sort({ createdAt: 1 }).lean();
  } catch (_) {
    events = [];
  }
  const eventsByTopic = new Map();
  for (const event of events) {
    if (event.metadata?.needsReview || event.source === 'self-report') continue;
    const key = `${event.subject}::${event.topicId}`;
    if (!eventsByTopic.has(key)) eventsByTopic.set(key, []);
    eventsByTopic.get(key).push(event.assessmentScore);
  }

  return records.map((r) => {
    const key = `${r.subject}::${r.topicId}`;
    const ema = calculateEma(eventsByTopic.get(key) || []);
    const weightedScore = Math.round(ema == null ? r.score : ema);
    return {
      topicId: r.topicId,
      topicTitle: r.topicTitle,
      chapterTitle: r.chapterTitle,
      subject: r.subject,
      rawScore: r.score,
      weightedScore: Math.min(100, Math.max(0, weightedScore)),
      attemptCount: r.attemptCount,
      tier: tierFromScore(weightedScore),
    };
  });
}

async function computeAtRisk(scope) {
  const { loadEvidence, summarizeEvidence } = require('./learningEvidenceService');
  const evidence = await loadEvidence(scope);
  const summary = summarizeEvidence(evidence);

  let attendanceRate = null;
  try {
    const student = await StudentUser.findOne({ _id: scope.studentId, schoolId: scope.schoolId })
      .select('attendance').lean();
    const recentAttendance = (student?.attendance || []).filter((entry) => {
      const t = new Date(entry.date).getTime();
      return Number.isFinite(t) && t >= Date.now() - 30 * 86400000;
    });
    if (recentAttendance.length) {
      attendanceRate = Math.round(
        recentAttendance.filter((entry) => entry.status === 'present').length / recentAttendance.length * 100
      );
    }
  } catch (_) { /* attendance is an optional signal */ }

  const riskFactors = [];
  if (summary.trend === 'declining') riskFactors.push('declining_assessment_trend');
  if (summary.recentAvg != null && summary.recentAvg < 50) riskFactors.push('low_recent_assessment');
  if (attendanceRate != null && attendanceRate < 75) riskFactors.push('low_attendance');
  const attendanceRisk = attendanceRate == null ? 0 : attendanceRate < 60 ? 30 : attendanceRate < 75 ? 15 : 0;
  const riskScore = summary.riskScore == null ? null : Math.min(100, summary.riskScore + attendanceRisk);
  const riskBand = riskScore == null ? 'insufficient_data' : riskScore >= 85 ? 'critical' : riskScore >= 70 ? 'high' : riskScore >= 50 ? 'moderate' : 'low';

  return {
    ...summary,
    riskScore,
    attendanceRate,
    riskFactors,
    dropoutRisk: { score: riskScore, band: riskBand, factors: riskFactors, method: 'assessment-trend-attendance-v1' },
  };
}

async function computeRollingTrend(scope) {
  const { loadEvidence, summarizeEvidence } = require('./learningEvidenceService');
  return summarizeEvidence(await loadEvidence(scope));
}

async function computeEngagement({ studentId, schoolId }) {
  const sidStr = String(studentId);
  const materials = await TeachingMaterial.find({ schoolId }).select('viewedBy quizAttempts completedBy').lean();

  let totalViews = 0;
  let totalTime = 0;
  let quizCount = 0;
  let lastActivityAt = null;

  for (const m of materials) {
    const vEntry = (m.viewedBy || []).find((v) => String(v.studentId) === sidStr);
    if (vEntry) {
      totalViews += vEntry.viewCount || 0;
      totalTime += vEntry.timeSpent || 0;
      const viewedAt = new Date(vEntry.lastViewedAt || vEntry.firstViewedAt).getTime();
      if (Number.isFinite(viewedAt) && (!lastActivityAt || viewedAt > lastActivityAt)) lastActivityAt = viewedAt;
    }
    const qEntries = (m.quizAttempts || []).filter((q) => String(q.studentId) === sidStr);
    quizCount += qEntries.length;
    qEntries.forEach((entry) => {
      const submittedAt = new Date(entry.submittedAt || entry.startedAt).getTime();
      if (Number.isFinite(submittedAt) && (!lastActivityAt || submittedAt > lastActivityAt)) lastActivityAt = submittedAt;
    });
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

  const situationalScore = lastActivityAt
    ? Math.max(0, Math.round(100 * Math.exp(-Math.max(0, (Date.now() - lastActivityAt) / 86400000) / 14)))
    : 0;
  let emotionalScore = null;
  try {
    const Wellbeing = require('../models/Wellbeing');
    const wellbeing = await Wellbeing.findOne({ student: studentId, schoolId })
      .select('mood socialEngagement academicStress').lean();
    if (wellbeing) {
      const moodScore = { excellent: 100, good: 80, neutral: 60, concerning: 30, critical: 10 };
      emotionalScore = Math.round((Number(wellbeing.socialEngagement || 5) * 10 * 0.45)
        + ((10 - Number(wellbeing.academicStress || 5)) * 10 * 0.35)
        + ((moodScore[wellbeing.mood] ?? 60) * 0.2));
    }
  } catch (_) { /* optional wellbeing signal */ }

  const behaviouralScore = Math.round(viewScore * 0.25 + timeScore * 0.35 + submissionScore * 0.4);
  const engagementScore = Math.round(
    behaviouralScore * 0.5 + situationalScore * 0.3 + (emotionalScore == null ? behaviouralScore * 0.2 : emotionalScore * 0.2)
  );

  return {
    engagementScore,
    components: {
      viewScore: Math.round(viewScore),
      timeScore: Math.round(timeScore),
      submissionScore: Math.round(submissionScore),
    },
    dimensions: {
      behavioural: behaviouralScore,
      situational: situationalScore,
      emotional: emotionalScore,
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
  calculateEma,
  computeWeightedMastery,
  computeAtRisk,
  computeRollingTrend,
  computeEngagement,
  computeLearningPace,
  detectLearningGaps,
  computeAllScores,
};
