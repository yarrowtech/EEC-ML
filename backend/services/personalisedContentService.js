/**
 * personalisedContentService.js
 * Assembles a student's live "gap profile" — weak topics, root-cause
 * prerequisite gaps, and recurring error types — into a compact context block
 * that AI content generation (worksheets, adaptive practice) can target.
 */
const { detectGaps } = require('./gapDetectionEngine');

const GAP_THRESHOLD = 60;
const WEAK_THRESHOLD = 65;

async function buildStudentGapProfile({ studentId, schoolId, subject, className }) {
  const MasteryScore = require('../models/MasteryScore');
  const ErrorRecord  = require('../models/ErrorRecord');
  const mongoose = require('mongoose');

  const masteryFilter = { studentId, schoolId };
  if (subject) masteryFilter.subject = subject;

  const [mastery, errorAgg, gapResult] = await Promise.all([
    MasteryScore.find(masteryFilter).sort({ score: 1 }).lean(),
    ErrorRecord.aggregate([
      { $match: {
        studentId: mongoose.Types.ObjectId.isValid(studentId) ? new mongoose.Types.ObjectId(studentId) : studentId,
        schoolId: mongoose.Types.ObjectId.isValid(schoolId) ? new mongoose.Types.ObjectId(schoolId) : schoolId,
        ...(subject ? { subject } : {}),
      } },
      { $group: { _id: { errorType: '$errorType', topicTitle: '$topicTitle' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]),
    subject
      ? detectGaps({ studentId, schoolId, subject, className }).catch(() => ({ gaps: [], rootCauses: [] }))
      : Promise.resolve({ gaps: [], rootCauses: [] }),
  ]);

  const weakTopics = mastery
    .filter((m) => m.score < WEAK_THRESHOLD)
    .map((m) => ({ topicTitle: m.topicTitle, subject: m.subject, score: m.score }));

  const errorPatterns = errorAgg.map((e) => ({
    errorType: e._id.errorType || 'Unknown',
    topicTitle: e._id.topicTitle || '',
    count: e.count,
  }));

  const rootCauses = (gapResult.rootCauses || []).map((r) => ({
    topicTitle: r.topicTitle, masteryScore: r.masteryScore, blockedTopics: r.blockedTopics || [],
  }));

  const errorTypeTally = {};
  for (const e of errorPatterns) errorTypeTally[e.errorType] = (errorTypeTally[e.errorType] || 0) + e.count;
  const dominantErrorType = Object.entries(errorTypeTally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const lines = [];
  if (weakTopics.length) {
    lines.push(`Weak topics (mastery < ${WEAK_THRESHOLD}%): ` +
      weakTopics.slice(0, 6).map((t) => `${t.topicTitle} (${t.score}%)`).join(', '));
  }
  if (rootCauses.length) {
    lines.push(`Root-cause prerequisite gaps: ` + rootCauses.slice(0, 4).map((r) => r.topicTitle).join(', '));
  }
  if (errorPatterns.length) {
    lines.push(`Recurring mistakes: ` +
      errorPatterns.slice(0, 5).map((e) => `${e.errorType} on "${e.topicTitle}" (×${e.count})`).join('; '));
  }
  if (dominantErrorType) {
    lines.push(`Most common error category: ${dominantErrorType} — emphasise questions that target this.`);
  }
  if (!lines.length) lines.push('No significant weaknesses recorded — generate general reinforcement practice.');

  const weakestTopic = weakTopics[0]?.topicTitle
    || rootCauses[0]?.topicTitle
    || mastery[0]?.topicTitle
    || null;

  return {
    weakTopics,
    rootCauses,
    errorPatterns,
    dominantErrorType,
    weakestTopic,
    hasGaps: weakTopics.length > 0 || rootCauses.length > 0,
    summaryText: lines.join('\n'),
  };
}

module.exports = { buildStudentGapProfile, GAP_THRESHOLD, WEAK_THRESHOLD };
