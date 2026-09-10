/**
 * misconceptionService.js
 * Maintains an explicit per-student misconception model: recurring wrong
 * answers of the same error type on the same topic are rolled up into a
 * StudentMisconception row (with capped evidence), and rows are auto-resolved
 * once the student masters that topic.
 */
const MAX_EVIDENCE = 5;
const MIN_OCCURRENCES_TO_SURFACE = 2;   // a single slip is not yet a misconception
const RESOLVE_MASTERY = 75;

const norm = (s) => String(s || '').toLowerCase().trim();

// Called from errorClassifier.recordErrors — one upsert per (topic, errorType).
async function recordMisconceptions({ studentId, schoolId, source = '', wrongs = [], classify }) {
  if (!studentId || !schoolId || !wrongs.length) return { updated: 0 };
  const StudentMisconception = require('../models/StudentMisconception');
  const classifyErrorType = classify || require('./errorClassifier').classifyErrorType;

  // Group this batch by topic + error type.
  const groups = new Map();
  for (const w of wrongs) {
    const topicTitle = w.topicTitle || w.subject || '';
    if (!topicTitle) continue;
    const errorType = w.errorType || classifyErrorType(w.questionText, w.correctAnswer, w.studentAnswer) || 'Concept';
    const key = `${norm(w.subject)}::${norm(topicTitle)}::${errorType}`;
    if (!groups.has(key)) groups.set(key, { subject: w.subject || '', topicTitle, topicId: w.topicId || '', errorType, items: [] });
    groups.get(key).items.push(w);
  }

  let updated = 0;
  const now = new Date();
  for (const g of groups.values()) {
    const newEvidence = g.items.slice(0, MAX_EVIDENCE).map((w) => ({
      questionText: String(w.questionText || '').slice(0, 500),
      studentAnswer: String(w.studentAnswer || '').slice(0, 300),
      correctAnswer: String(w.correctAnswer || '').slice(0, 300),
      source, at: now,
    }));
    try {
      await StudentMisconception.updateOne(
        { studentId, subject: g.subject, topicTitle: g.topicTitle, errorType: g.errorType },
        {
          $setOnInsert: {
            schoolId, studentId, subject: g.subject, topicId: g.topicId,
            topicTitle: g.topicTitle, errorType: g.errorType,
            label: `${g.errorType} error on ${g.topicTitle}`,
            firstSeenAt: now,
          },
          $set: { status: 'active', lastSeenAt: now, resolvedAt: null, resolvedByScore: null },
          $inc: { occurrences: g.items.length },
          $push: { evidence: { $each: newEvidence, $slice: -MAX_EVIDENCE } },
        },
        { upsert: true, runValidators: true },
      );
      updated += 1;
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  return { updated };
}

// Called from masteryEngine when a topic score is high — clear its misconceptions.
async function resolveMisconceptionsForTopic({ studentId, schoolId, subject, topicTitle, score }) {
  if (!(score >= RESOLVE_MASTERY) || !topicTitle) return { resolved: 0 };
  const StudentMisconception = require('../models/StudentMisconception');
  const r = await StudentMisconception.updateMany(
    { studentId, schoolId, subject, topicTitle, status: 'active' },
    { $set: { status: 'resolved', resolvedAt: new Date(), resolvedByScore: score } },
  );
  return { resolved: r?.modifiedCount || 0 };
}

async function getStudentMisconceptions(studentId, schoolId, { subject, status = 'active', includeMinor = false } = {}) {
  const StudentMisconception = require('../models/StudentMisconception');
  const filter = { studentId, schoolId };
  if (subject) filter.subject = subject;
  if (status) filter.status = status;
  const rows = await StudentMisconception.find(filter).sort({ occurrences: -1, lastSeenAt: -1 }).limit(100).lean();
  return includeMinor ? rows : rows.filter((r) => r.occurrences >= MIN_OCCURRENCES_TO_SURFACE);
}

module.exports = {
  recordMisconceptions,
  resolveMisconceptionsForTopic,
  getStudentMisconceptions,
  MIN_OCCURRENCES_TO_SURFACE,
  RESOLVE_MASTERY,
};
