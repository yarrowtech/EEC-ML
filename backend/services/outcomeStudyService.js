/**
 * outcomeStudyService.js
 * Pre/post outcome-measurement framework: capture a cohort's learning metric
 * over a baseline window and a post window (from the append-only MasteryEvent
 * stream), then report the mean change, the share of students who improved, and
 * a paired-difference effect size.
 *
 * This is the measurement machinery. Whether an effect is "real" still needs a
 * proper study design and enough students — the service reports sample sizes so
 * that judgement can be made.
 */
const { credible } = require('./learningEvidenceService');

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs) => {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};

// Cohen's d for a paired design: mean(diff) / sd(diff).
function computeEffect(baselineByStudent, postByStudent) {
  const diffs = [];
  const pairs = [];
  for (const [sid, base] of Object.entries(baselineByStudent)) {
    const p = postByStudent[sid];
    if (base == null || p == null) continue;
    diffs.push(p - base);
    pairs.push({ studentId: sid, baseline: base, post: p, delta: p - base });
  }
  const meanDelta = mean(diffs);
  const sdDelta = sd(diffs);
  const effectSize = meanDelta != null && sdDelta ? Math.round((meanDelta / sdDelta) * 100) / 100 : null;
  const pctImproved = diffs.length ? Math.round((diffs.filter((d) => d > 0).length / diffs.length) * 100) : null;

  let interpretation = 'insufficient_data';
  if (effectSize != null) {
    const a = Math.abs(effectSize);
    interpretation = a < 0.2 ? 'negligible' : a < 0.5 ? 'small' : a < 0.8 ? 'medium' : 'large';
    if (effectSize < 0) interpretation += '_decline';
  }
  return {
    pairedN: diffs.length,
    meanDelta: meanDelta != null ? Math.round(meanDelta * 100) / 100 : null,
    sdDelta: sdDelta != null ? Math.round(sdDelta * 100) / 100 : null,
    pctImproved,
    effectSize,
    interpretation,
    pairs,
  };
}

// Mean assessment score (0..100) per student over [start, end].
async function measureWindow({ schoolId, studentIds, subject, metric, window }) {
  const MasteryEvent = require('../models/MasteryEvent');
  const MasteryScore = require('../models/MasteryScore');
  const start = new Date(window.start);
  const end = new Date(window.end);

  const perStudent = [];
  for (const studentId of studentIds) {
    let value = null;
    let sampleCount = 0;
    if (metric === 'mastery_avg') {
      // Snapshot mastery is not time-windowed; use the latest scoreAfter within the window.
      const events = await MasteryEvent.find({
        schoolId, studentId, ...(subject ? { subject } : {}),
        createdAt: { $gte: start, $lte: end },
      }).sort({ createdAt: 1 }).lean();
      const cred = events.filter(credible);
      sampleCount = cred.length;
      value = mean(cred.map((e) => e.scoreAfter));
      if (value == null) {
        // fall back to the mastery snapshot as of now if the window had no events
        const scores = await MasteryScore.find({ schoolId, studentId, ...(subject ? { subject } : {}) }).lean();
        value = mean(scores.map((s) => s.score));
        sampleCount = scores.length;
      }
    } else {
      const events = await MasteryEvent.find({
        schoolId, studentId, ...(subject ? { subject } : {}),
        createdAt: { $gte: start, $lte: end },
      }).lean();
      const cred = events.filter(credible);
      sampleCount = cred.length;
      value = mean(cred.map((e) => e.assessmentScore));
    }
    perStudent.push({ studentId, value: value == null ? null : Math.round(value * 100) / 100, sampleCount });
  }

  const values = perStudent.map((p) => p.value).filter((v) => v != null);
  return {
    perStudent,
    mean: mean(values) != null ? Math.round(mean(values) * 100) / 100 : null,
    sd: sd(values) != null ? Math.round(sd(values) * 100) / 100 : null,
    n: values.length,
    capturedAt: new Date(),
  };
}

async function captureBaseline(study) {
  const measurement = await measureWindow({
    schoolId: study.schoolId, studentIds: study.studentIds, subject: study.subject,
    metric: study.metric, window: study.baselineWindow,
  });
  return measurement;
}

async function capturePostAndResult(study, baseline) {
  const post = await measureWindow({
    schoolId: study.schoolId, studentIds: study.studentIds, subject: study.subject,
    metric: study.metric, window: study.postWindow,
  });
  const baseMap = Object.fromEntries((baseline.perStudent || []).map((p) => [String(p.studentId), p.value]));
  const postMap = Object.fromEntries((post.perStudent || []).map((p) => [String(p.studentId), p.value]));
  const result = { ...computeEffect(baseMap, postMap), baselineMean: baseline.mean, postMean: post.mean, measuredAt: new Date() };
  return { post, result };
}

module.exports = { computeEffect, measureWindow, captureBaseline, capturePostAndResult };
