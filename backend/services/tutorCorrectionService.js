/**
 * tutorCorrectionService.js
 * Teacher overrides of AI tutor answers. Corrections live in their own
 * collection (TutorAnswerCorrection) and are joined back onto conversation
 * reads for both the student and the teacher review views.
 */
const TutorAnswerCorrection = require('../models/TutorAnswerCorrection');

// Locate the AI answer a correction targets — by message id (stable across
// client syncs) first, then by index as a fallback.
function resolveTargetMessage(messages = [], { messageId, messageIndex } = {}) {
  if (messageId != null) {
    const i = messages.findIndex((m) => String(m.id) === String(messageId));
    if (i >= 0) return { message: messages[i], index: i };
  }
  const idx = Number(messageIndex);
  if (Number.isInteger(idx) && messages[idx]) return { message: messages[idx], index: idx };
  return { message: null, index: -1 };
}

// Decorate lean conversation docs with their active corrections. Adds a
// `corrections` array per conversation and flags the corrected messages.
async function attachCorrections(conversations, schoolId) {
  const list = Array.isArray(conversations) ? conversations : [conversations];
  const ids = list.map((c) => c && c._id).filter(Boolean);
  if (!ids.length) return conversations;

  const rows = await TutorAnswerCorrection.find({
    schoolId, conversationId: { $in: ids }, status: 'active',
  }).sort({ updatedAt: -1 }).lean();

  const byConversation = new Map();
  for (const row of rows) {
    const key = String(row.conversationId);
    if (!byConversation.has(key)) byConversation.set(key, []);
    byConversation.get(key).push(row);
  }

  for (const conv of list) {
    if (!conv) continue;
    const corrections = byConversation.get(String(conv._id)) || [];
    conv.corrections = corrections;
    if (!corrections.length || !Array.isArray(conv.messages)) continue;
    const byMessageId = new Map(corrections.map((c) => [String(c.messageId), c]));
    conv.messages = conv.messages.map((m) => {
      const c = byMessageId.get(String(m.id));
      return c
        ? { ...m, teacherCorrected: true, correctedText: c.correctedText, correctionReason: c.reason, correctedAt: c.updatedAt }
        : m;
    });
  }
  return conversations;
}

module.exports = { resolveTargetMessage, attachCorrections };
