/**
 * recommendationImpactService.js
 * Persists the lifecycle of study recommendations and measures whether acting
 * on one moved the student's mastery.
 *
 *   recordIssued   — upsert a recommendation the moment it is shown (deduped per day)
 *   recordDecision — student accepts / dismisses / completes it
 *   measureRecommendationImpact — cron sweep: finalize stale accepted recs and
 *                    expire ignored ones
 */

const RecommendationEvent = require('../models/RecommendationEvent');

const DAY = 86400000;
// An accepted recommendation is auto-completed for measurement after this long.
const IMPACT_WINDOW_DAYS = 10;
// An issued-but-ignored recommendation expires after this long.
const EXPIRY_DAYS = 21;

const norm = (s) => String(s || '').toLowerCase().trim();
const dayStamp = (d = new Date()) => new Date(d).toISOString().slice(0, 10);

// Current mastery for the recommendation's topic — matches by topicId first,
// then by case-insensitive topic title within the subject.
async function currentMastery({ schoolId, studentId, subject, topicId, topicTitle }) {
  const MasteryScore = require('../models/MasteryScore');
  const rows = await MasteryScore.find({ schoolId, studentId, ...(subject ? { subject } : {}) })
    .select('score topicId topicTitle subject').lean();
  if (!rows.length) return null;
  if (topicId) {
    const byId = rows.find((r) => r.topicId === topicId);
    if (byId) return byId.score;
  }
  if (topicTitle) {
    const byTitle = rows.find((r) => norm(r.topicTitle) === norm(topicTitle));
    if (byTitle) return byTitle.score;
  }
  return null;
}

function buildDedupeKey({ schoolId, studentId, type, topicId, topicTitle }) {
  const topicKey = topicId || norm(topicTitle) || 'na';
  return `${schoolId}:${studentId}:${type || 'na'}:${topicKey}:${dayStamp()}`;
}

// Upsert on first sight of the day; returns the persisted event (id included).
async function recordIssued({ schoolId, studentId, source = 'next', recommendation }) {
  if (!schoolId || !studentId || !recommendation) return null;
  const dedupeKey = buildDedupeKey({
    schoolId, studentId,
    type: recommendation.type,
    topicId: recommendation.topicId,
    topicTitle: recommendation.topicTitle,
  });
  const setOnInsert = {
    schoolId, studentId, source,
    type: recommendation.type || '',
    subject: recommendation.subject || '',
    topicId: recommendation.topicId || '',
    topicTitle: recommendation.topicTitle || '',
    chapterTitle: recommendation.chapterTitle || '',
    action: recommendation.action || '',
    reason: recommendation.reason || '',
    explainability: recommendation.explainability || '',
    dedupeKey,
    status: 'issued',
    issuedAt: new Date(),
  };
  try {
    await RecommendationEvent.updateOne({ dedupeKey }, { $setOnInsert: setOnInsert }, { upsert: true, runValidators: true });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
  return RecommendationEvent.findOne({ dedupeKey }).lean();
}

async function recordDecision({ id, schoolId, studentId, decision, reason = '' }) {
  const event = await RecommendationEvent.findOne({ _id: id, schoolId, studentId });
  if (!event) return { notFound: true };

  const now = new Date();
  if (decision === 'accept') {
    if (event.status === 'issued') {
      event.status = 'accepted';
      event.respondedAt = now;
      if (event.baselineMastery == null) {
        event.baselineMastery = await currentMastery(event);
      }
    }
  } else if (decision === 'dismiss') {
    if (['issued', 'accepted'].includes(event.status)) {
      event.status = 'dismissed';
      event.respondedAt = event.respondedAt || now;
      event.dismissReason = reason || '';
    }
  } else if (decision === 'complete') {
    if (['issued', 'accepted'].includes(event.status)) {
      // Completing without an explicit accept still counts as acted-upon.
      if (!event.respondedAt) event.respondedAt = now;
      if (event.baselineMastery == null) event.baselineMastery = await currentMastery(event);
      event.status = 'completed';
      event.completedAt = now;
      event.postMastery = await currentMastery(event);
      if (event.baselineMastery != null && event.postMastery != null) {
        event.masteryDelta = Math.round((event.postMastery - event.baselineMastery) * 100) / 100;
      }
    }
  } else {
    return { invalid: true };
  }

  await event.save();
  return { event: event.toObject() };
}

// Cron sweep — finalize accepted recs past the impact window and expire
// recommendations that were never acted on.
async function measureRecommendationImpact(filter = {}) {
  const now = Date.now();

  const stale = await RecommendationEvent.find({
    ...filter,
    status: 'accepted',
    respondedAt: { $lte: new Date(now - IMPACT_WINDOW_DAYS * DAY) },
  }).lean();

  for (const event of stale) {
    const post = await currentMastery(event);
    const update = { status: 'completed', completedAt: new Date() };
    if (post != null) {
      update.postMastery = post;
      if (event.baselineMastery != null) {
        update.masteryDelta = Math.round((post - event.baselineMastery) * 100) / 100;
      }
    }
    await RecommendationEvent.updateOne({ _id: event._id, schoolId: event.schoolId }, { $set: update });
  }

  await RecommendationEvent.updateMany({
    ...filter,
    status: 'issued',
    issuedAt: { $lte: new Date(now - EXPIRY_DAYS * DAY) },
  }, { $set: { status: 'expired' } });

  return { finalized: stale.length };
}

// Aggregate outcomes for a student's own recommendation history.
function summarize(events) {
  const responded = events.filter((e) => e.status !== 'issued' && e.status !== 'expired');
  const acted = events.filter((e) => ['accepted', 'completed'].includes(e.status));
  const completed = events.filter((e) => e.status === 'completed');
  const measured = completed.filter((e) => e.masteryDelta != null);
  const offered = events.filter((e) => e.status !== 'expired').length || events.length;
  return {
    total: events.length,
    acceptanceRate: offered ? Math.round((acted.length / offered) * 100) : 0,
    completionRate: acted.length ? Math.round((completed.length / acted.length) * 100) : 0,
    avgMasteryDelta: measured.length
      ? Math.round((measured.reduce((s, e) => s + e.masteryDelta, 0) / measured.length) * 10) / 10
      : null,
    measuredCount: measured.length,
    respondedCount: responded.length,
  };
}

module.exports = {
  recordIssued,
  recordDecision,
  measureRecommendationImpact,
  currentMastery,
  summarize,
  IMPACT_WINDOW_DAYS,
  EXPIRY_DAYS,
};
