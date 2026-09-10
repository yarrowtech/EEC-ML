const mongoose = require('mongoose');
const MasteryEvent = require('../models/MasteryEvent');
const MasteryScore = require('../models/MasteryScore');

function percentage(value) {
  if (value == null || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100) {
    throw new Error('Assessment score must be a finite percentage between 0 and 100');
  }
  return Number(value);
}

function blendScore(previous, score, source) {
  const next = percentage(score);
  if (source === 'decay' || previous == null) return next;
  return Math.round(percentage(previous) * 0.7 + next * 0.3);
}

// Score and history commit together. Requires a MongoDB replica set.
async function applyAssessment({ schoolId, studentId, subject, topicId, topicTitle = '', chapterTitle = '', source,
  assessmentScore, eventId, metadata = {} }) {
  if (!schoolId || !studentId || !subject || !topicId) throw new Error('Assessment scope is required');
  const score = percentage(assessmentScore);
  const eventKey = eventId ? `${schoolId}:${studentId}:${source}:${eventId}:${topicId}` : undefined;
  const session = await mongoose.startSession();
  let result;
  let created = false;
  try {
    await session.withTransaction(async () => {
      created = false;
      const filter = { schoolId, studentId, subject, topicId };
      if (eventKey && await MasteryEvent.findOne({ eventKey }).session(session)) {
        result = await MasteryScore.findOne(filter).session(session);
        return;
      }
      const previous = await MasteryScore.findOne(filter).session(session);
      const scoreAfter = blendScore(previous?.score, score, source);
      const attemptCount = (previous?.attemptCount || 0) + (source === 'decay' ? 0 : 1);
      result = await MasteryScore.findOneAndUpdate(filter, {
        $set: { topicTitle, chapterTitle, score: scoreAfter, attemptCount, lastUpdated: new Date() },
      }, { upsert: true, new: true, runValidators: true, session });
      await MasteryEvent.create([{
        schoolId, studentId, subject, topicId, topicTitle, chapterTitle, source, eventKey,
        scoreBefore: previous?.score ?? null, assessmentScore: score, scoreAfter,
        attemptCount: Math.max(1, attemptCount), metadata: { ...metadata, algorithmVersion: 'mastery-ema-v1' },
      }], { session });
      created = true;
    });
  } finally {
    await session.endSession();
  }
  if (created && source !== 'decay') {
    require('./masteryEngine').runWorkflowTriggers({ schoolId, studentId, subject, topicId, topicTitle,
      chapterTitle, score: result.score, attemptCount: result.attemptCount });
  }
  return result;
}

module.exports = { applyAssessment, blendScore, percentage };
