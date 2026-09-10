/**
 * learningPathService.js
 * Builds an AI bridge learning path: the ordered sequence of curriculum topics
 * a student must work through to get from their current root-cause knowledge
 * gap up to a target topic. Combines curriculum-graph traversal (explicit
 * prerequisite edges, ordered-topic fallback) with the student's live mastery.
 */
const { detectGaps } = require('./gapDetectionEngine');

const MASTERY_TARGET = 75;   // a topic at/above this counts as "ready"
const GAP_THRESHOLD  = 60;

const norm = (s) => String(s || '').toLowerCase().trim();

const bloomBandFromMastery = (score) => {
  if (score == null) return 'remember';
  if (score < 40) return 'remember';
  if (score < 60) return 'understand';
  if (score < 75) return 'apply';
  return 'analyse';
};

const tierFromMastery = (score) => {
  if (score == null || score < 40) return 'blue';
  if (score < 60) return 'orange';
  if (score < MASTERY_TARGET) return 'purple';
  return 'green';
};

// Ordered prerequisite chain for `target` — explicit edges first, transitively,
// then any earlier-in-sequence topic as a fallback for edge-less maps.
function prerequisiteChain(target, topicsByTitle, sortedTopics) {
  const seen = new Set();
  const chain = [];
  const visit = (topic) => {
    if (!topic || seen.has(norm(topic.title))) return;
    seen.add(norm(topic.title));
    const edges = Array.isArray(topic.prerequisites) && topic.prerequisites.length
      ? topic.prerequisites.map((t) => topicsByTitle.get(norm(t))).filter(Boolean)
      : sortedTopics.filter((t) => t.order < topic.order);
    for (const pre of edges) visit(pre);
    if (topic !== target) chain.push(topic);
  };
  visit(target);
  // De-dupe preserving order, then sort by curriculum order.
  return chain.sort((a, b) => a.order - b.order);
}

async function buildBridgePath({ studentId, schoolId, subject, targetTopic, className }) {
  if (!studentId || !schoolId || !subject || !targetTopic) {
    throw new Error('studentId, schoolId, subject and targetTopic are required');
  }
  const MasteryScore  = require('../models/MasteryScore');
  const CurriculumMap = require('../models/CurriculumMap');

  const [masteryDocs, map] = await Promise.all([
    MasteryScore.find({ studentId, schoolId, subject }).lean(),
    CurriculumMap.findOne({ schoolId, subject, ...(className ? { className } : {}) }).lean(),
  ]);

  if (!map || !map.topics?.length) {
    return { status: 'no_curriculum_map', target: targetTopic, steps: [] };
  }

  const masteryByTitle = new Map(masteryDocs.map((d) => [norm(d.topicTitle), d.score]));
  const sortedTopics   = [...map.topics].sort((a, b) => a.order - b.order);
  const topicsByTitle  = new Map(sortedTopics.map((t) => [norm(t.title), t]));

  // Resolve the target (exact, then contains).
  const target = topicsByTitle.get(norm(targetTopic))
    || sortedTopics.find((t) => norm(t.title).includes(norm(targetTopic)))
    || sortedTopics.find((t) => norm(targetTopic).includes(norm(t.title)));
  if (!target) {
    return { status: 'target_not_in_map', target: targetTopic, steps: [] };
  }

  const { rootCauses } = await detectGaps({ studentId, schoolId, subject, className });
  const rootCauseTitles = new Set(rootCauses.map((r) => norm(r.topicTitle)));

  const chain = prerequisiteChain(target, topicsByTitle, sortedTopics);

  // Keep only prerequisites the student has NOT yet reached the target for,
  // then the target itself.
  const pathTopics = [...chain, target].filter((t, i, arr) => {
    if (t === target) return true;
    const score = masteryByTitle.get(norm(t.title));
    return score == null || score < MASTERY_TARGET;
  });

  let assignedActive = false;
  const steps = pathTopics.map((t, idx) => {
    const score = masteryByTitle.get(norm(t.title)) ?? null;
    const isTarget = t === target;
    const done = !isTarget && score != null && score >= MASTERY_TARGET;
    let statusNode = 'locked';
    if (done) statusNode = 'done';
    else if (!assignedActive) { statusNode = 'active'; assignedActive = true; }

    const action = score == null ? 'learn' : score < GAP_THRESHOLD ? 'learn' : score < MASTERY_TARGET ? 'practice' : 'review';
    return {
      idx,
      title: t.title,
      bloom: bloomBandFromMastery(score),
      tier: tierFromMastery(score),
      status: statusNode,
      hasLesson: false,
      currentMastery: score,
      targetMastery: MASTERY_TARGET,
      isRootCauseGap: rootCauseTitles.has(norm(t.title)),
      isTarget,
      action,
      reason: isTarget
        ? `Target topic. Reach ${MASTERY_TARGET}% mastery here.`
        : score == null
          ? `Not started — a prerequisite for "${target.title}".`
          : `Mastery ${score}% — strengthen before moving on to "${target.title}".`,
      estimatedDays: Math.max(1, Math.round((t.estimatedWeeks || 1) * (score == null ? 7 : score < GAP_THRESHOLD ? 5 : 3))),
    };
  });

  const gapCount = steps.filter((s) => !s.isTarget && (s.currentMastery == null || s.currentMastery < GAP_THRESHOLD)).length;
  return {
    status: 'ok',
    subject,
    target: target.title,
    targetOrder: target.order,
    steps,
    totalEstimatedDays: steps.reduce((n, s) => n + s.estimatedDays, 0),
    gapCount,
    rootCauseCount: rootCauses.length,
  };
}

// Shape bridge steps into TeacherLearningPath.nodes so a teacher can publish it.
function toPathNodes(bridge) {
  return (bridge.steps || []).map((s) => ({
    idx: s.idx,
    title: s.title,
    bloom: s.bloom,
    tier: s.tier,
    hasLesson: false,
    status: s.status,
    completedAt: null,
  }));
}

module.exports = { buildBridgePath, toPathNodes, prerequisiteChain, MASTERY_TARGET };
