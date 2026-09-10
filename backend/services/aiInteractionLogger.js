/**
 * aiInteractionLogger.js
 * Fire-and-forget lineage logging for every backend → AI-service call.
 * Never throws — a logging failure must not affect the user-facing response.
 */
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

const clip = (s, n = 2000) => (s == null ? '' : String(s).slice(0, n));
const asObjectId = (v) => (v != null && mongoose.isValidObjectId(v) ? v : null);

// Normalise the ai-service `lineage` block (added on the Python side) plus
// whatever the Node caller already knows into one flat record.
function shapeRecord({
  schoolId, userId, userRole,
  feature, mode, subject, topicTitle,
  aiResponse = {}, retrievalConfig = {},
  status = 'success', httpStatus = null, errorType = '', latencyMs = null,
  entity = '', entityId = null,
}) {
  const lineage = aiResponse.lineage || {};
  return {
    schoolId: asObjectId(schoolId),
    userId: asObjectId(userId),
    userRole: userRole || '',
    feature,
    mode: mode || aiResponse.mode || '',
    subject: subject || '',
    topicTitle: topicTitle || '',
    model: aiResponse.model || lineage.model || '',
    provider: lineage.provider || aiResponse.provider || '',
    promptSource: lineage.promptSource || '',
    rewrittenQuery: clip(lineage.rewrittenQuery, 500),
    retrievalConfig: {
      ...retrievalConfig,
      chunkCount: lineage.retrievalChunkCount ?? retrievalConfig.chunkCount ?? null,
      citationCount: lineage.citationCount ?? (Array.isArray(aiResponse.citations) ? aiResponse.citations.length : 0),
    },
    grounded: Boolean(aiResponse.groundedInMaterial),
    noMaterialFound: Boolean(aiResponse.noMaterialFound),
    fallbackUsed: Boolean(lineage.fallbackUsed || aiResponse.fallbackUsed),
    status,
    httpStatus,
    errorType,
    latencyMs,
    outputChars: aiResponse.content != null ? String(aiResponse.content).length : null,
    citationCount: Array.isArray(aiResponse.citations) ? aiResponse.citations.length : 0,
    score: Number.isFinite(aiResponse.score) ? aiResponse.score : null,
    confidenceScore: Number.isFinite(aiResponse.confidenceScore) ? aiResponse.confidenceScore : null,
    needsReview: Boolean(aiResponse.needsReview),
    entity: entity || '',
    entityId: asObjectId(entityId),
    createdAt: new Date(),
  };
}

async function logAiInteraction(input) {
  try {
    const AiInteractionLog = require('../models/AiInteractionLog');
    await AiInteractionLog.create(shapeRecord(input));
  } catch (err) {
    logger.warn({ err: err.message, feature: input?.feature }, 'ai interaction log write failed');
  }
}

module.exports = { logAiInteraction, shapeRecord };
