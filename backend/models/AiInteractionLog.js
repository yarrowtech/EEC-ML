const mongoose = require('mongoose');

// Audit/lineage record for every call the backend makes to the AI service.
// Captures who asked, what feature/mode, which model + prompt + retrieval config
// produced the answer, and how it went — the substrate for explainable-AI,
// quality monitoring, and (later) a governed training-data pipeline.
const aiInteractionLogSchema = new mongoose.Schema({
  schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'School', index: true, default: null },
  userId:    { type: mongoose.Schema.Types.ObjectId, index: true, default: null },
  userRole:  { type: String, default: '' },   // student | teacher | admin | ...

  feature:   { type: String, required: true, index: true }, // tutor_generate | answer_evaluate | long_answer_evaluate | teacher_generate
  mode:      { type: String, default: '' },
  subject:   { type: String, default: '' },
  topicTitle:{ type: String, default: '' },

  // What produced the answer
  model:            { type: String, default: '' },
  provider:         { type: String, default: '' },   // ollama | openrouter
  promptSource:     { type: String, default: '' },   // prompt file id, or 'inline'
  retrievalConfig:  { type: mongoose.Schema.Types.Mixed, default: {} }, // { classId, sectionId, chapterTitle, excludedMaterialCount, rewrittenQuery, chunkCount, citationCount }
  rewrittenQuery:   { type: String, default: '' },
  grounded:         { type: Boolean, default: false },
  noMaterialFound:  { type: Boolean, default: false },
  fallbackUsed:     { type: Boolean, default: false },

  // Outcome
  status:        { type: String, enum: ['success', 'error'], default: 'success', index: true },
  httpStatus:    { type: Number, default: null },
  errorType:     { type: String, default: '' },
  latencyMs:     { type: Number, default: null },
  outputChars:   { type: Number, default: null },
  citationCount: { type: Number, default: 0 },
  score:         { type: Number, default: null },     // for evaluations (0..1)
  confidenceScore:{ type: Number, default: null },
  needsReview:   { type: Boolean, default: false },

  // Lineage back to the artifact this call produced / the student it concerns
  entity:    { type: String, default: '' },
  entityId:  { type: mongoose.Schema.Types.ObjectId, default: null },

  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

aiInteractionLogSchema.index({ schoolId: 1, feature: 1, createdAt: -1 });
aiInteractionLogSchema.index({ schoolId: 1, userId: 1, createdAt: -1 });

// Retention: interaction logs expire after AI_LOG_RETENTION_DAYS (default 180).
const RETENTION_DAYS = Number(process.env.AI_LOG_RETENTION_DAYS) || 180;
aiInteractionLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 86400 });

module.exports = mongoose.model('AiInteractionLog', aiInteractionLogSchema);
