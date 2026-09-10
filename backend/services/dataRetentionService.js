/**
 * dataRetentionService.js
 * Enforces the AI-data retention lifecycle:
 *   - tutor conversations pruned past RETENTION.CONVERSATION_DAYS
 *   - rolling memory summaries pruned past RETENTION.MEMORY_SUMMARY_DAYS
 *   - every AI artifact for a student purged once their
 *     StudentUser.dataRetentionExpiresAt has passed (graduation / exit)
 * Also exposes purgeStudentAiData() for an explicit erasure request.
 */
const { RETENTION } = require('../config/workflowThresholds');
const { logger } = require('../utils/logger');

const DAY = 86400000;

// Every collection that stores AI-derived data keyed by the student.
const STUDENT_AI_COLLECTIONS = [
  { model: 'TutorConversation', field: 'studentId' },
  { model: 'StudentMemorySummary', field: 'studentId' },
  { model: 'RecommendationEvent', field: 'studentId' },
  { model: 'TutorAnswerCorrection', field: 'studentId' },
  { model: 'LongAnswerSubmission', field: 'studentId' },
  { model: 'AiInteractionLog', field: 'userId' },
  { model: 'ReadingAssessment', field: 'studentId' },
  { model: 'WritingAssessment', field: 'studentId' },
];

async function purgeStudentAiData(studentId, schoolId) {
  const result = {};
  for (const { model, field } of STUDENT_AI_COLLECTIONS) {
    try {
      const Model = require(`../models/${model}`);
      const filter = { [field]: studentId };
      if (schoolId) filter.schoolId = schoolId;
      const r = await Model.deleteMany(filter);
      result[model] = r?.deletedCount || 0;
    } catch (err) {
      result[model] = `error: ${err.message}`;
    }
  }
  return result;
}

// Students whose retention window has closed — every AI artifact is removed.
async function purgeExpiredStudents({ limit = 200 } = {}) {
  const StudentUser = require('../models/StudentUser');
  const expired = await StudentUser.find({
    dataRetentionExpiresAt: { $ne: null, $lte: new Date() },
  }).select('_id schoolId').limit(limit).lean();

  let purged = 0;
  for (const s of expired) {
    try {
      await purgeStudentAiData(s._id, s.schoolId);
      purged += 1;
    } catch (err) {
      logger.warn({ err: err.message, studentId: String(s._id) }, 'retention purge failed for student');
    }
  }
  return { expiredStudents: expired.length, purged };
}

// Delete conversations untouched for longer than the retention window, except
// for students still within an explicit retention hold.
async function pruneOldConversations() {
  const TutorConversation = require('../models/TutorConversation');
  const cutoff = new Date(Date.now() - RETENTION.CONVERSATION_DAYS * DAY);
  const r = await TutorConversation.deleteMany({ updatedAt: { $lt: cutoff } });
  return { deleted: r?.deletedCount || 0, cutoff };
}

// Drop stale per-subject memory entries and empty out fully-stale summaries.
async function pruneOldMemory() {
  const StudentMemorySummary = require('../models/StudentMemorySummary');
  const cutoff = new Date(Date.now() - RETENTION.MEMORY_SUMMARY_DAYS * DAY);
  let trimmed = 0;
  const stale = await StudentMemorySummary.find({ updatedAt: { $lt: cutoff } });
  for (const doc of stale) {
    doc.summary = '';
    doc.keyInsights = [];
    if (doc.subjectSummaries) doc.subjectSummaries = undefined;
    await doc.save();
    trimmed += 1;
  }
  return { trimmed, cutoff };
}

async function runRetentionSweep() {
  const [conv, mem, expired] = await Promise.all([
    pruneOldConversations().catch((err) => ({ error: err.message })),
    pruneOldMemory().catch((err) => ({ error: err.message })),
    purgeExpiredStudents().catch((err) => ({ error: err.message })),
  ]);
  logger.info({ conv, mem, expired }, 'AI data retention sweep complete');
  return { conversations: conv, memory: mem, expiredStudents: expired };
}

module.exports = {
  purgeStudentAiData,
  purgeExpiredStudents,
  pruneOldConversations,
  pruneOldMemory,
  runRetentionSweep,
  STUDENT_AI_COLLECTIONS,
};
