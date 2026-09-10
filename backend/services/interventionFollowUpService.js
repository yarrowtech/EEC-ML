const InterventionLog = require('../models/InterventionLog');
const MasteryEvent = require('../models/MasteryEvent');
const { credible, timeOf } = require('./learningEvidenceService');
const DAY = 86400000;
// A checkpoint looks for assessment evidence in the week following its due date.
const EVIDENCE_WINDOW = 7 * DAY;

const templates = {
  targeted_reteach: { title: 'Targeted reteaching', action: 'Identify the prerequisite gap, model a worked example, practise with support, then complete an independent check.' },
  guided_practice: { title: 'Guided practice', action: 'Review recent errors, practise three examples with feedback, then attempt an independent question.' },
  study_routine: { title: 'Study routine', action: 'Agree a short daily study routine, check participation, and review understanding at the next follow-up.' },
};

const round2 = (n) => Math.round(n * 100) / 100;

// Most recent credible assessment score at or before `before`, optionally scoped
// to a subject/topic. Used to freeze a pre-intervention baseline at creation
// time and to backfill plans created before this field was captured.
function computeBaseline(events, before = Date.now(), { subject, topicId } = {}) {
  const prior = events
    .filter(credible)
    .filter((e) => (!subject || e.subject === subject) && (!topicId || e.topicId === topicId))
    .filter((e) => timeOf(e) <= before)
    .sort((a, b) => timeOf(a) - timeOf(b));
  return prior.at(-1)?.assessmentScore ?? null;
}

function measurePlan(plan, events, now = Date.now()) {
  const eligible = events.filter(credible).filter((e) => (!plan.subject || e.subject === plan.subject)
    && (!plan.topicId || e.topicId === plan.topicId)).sort((a, b) => timeOf(a) - timeOf(b));
  // Baseline is fixed before the intervention; later results cannot change it.
  // Anchor on when the plan was created, not its (often future) scheduled date.
  const anchor = new Date(plan.createdAt || plan.scheduledDate || now).getTime();
  const baseline = plan.baselineScore
    ?? computeBaseline(eligible, anchor, { subject: plan.subject, topicId: plan.topicId });

  const checkpoints = (plan.followUpAssessments || []).map((checkpoint) => {
    if (checkpoint.completedAt || new Date(checkpoint.scheduledDate).getTime() > now) return checkpoint;
    const due = new Date(checkpoint.scheduledDate).getTime();
    const evidence = eligible.find((e) => timeOf(e) >= due && timeOf(e) < due + EVIDENCE_WINDOW && timeOf(e) <= now);
    if (!evidence) return checkpoint;
    return { ...checkpoint, score: evidence.assessmentScore,
      completedAt: new Date(timeOf(evidence)), eventId: evidence._id,
      improvement: baseline == null ? null : round2(evidence.assessmentScore - baseline) };
  });

  // A checkpoint is settled once it has evidence or its evidence window has
  // closed with none. When every checkpoint is settled the plan is done.
  const settled = checkpoints.every((c) => c.completedAt
    || new Date(c.scheduledDate).getTime() + EVIDENCE_WINDOW < now);
  const measured = checkpoints.filter((c) => c.completedAt && c.improvement != null);
  const latest = measured.at(-1) || checkpoints.filter((c) => c.completedAt).at(-1) || null;

  let outcomeSummary = null;
  if (settled) {
    if (latest && latest.improvement != null) {
      const dir = latest.improvement > 0 ? 'improved' : latest.improvement < 0 ? 'declined' : 'unchanged';
      outcomeSummary = `Auto-measured from assessment evidence: baseline ${baseline}% → ${latest.score}% by day ${latest.daysAfter} (${latest.improvement > 0 ? '+' : ''}${latest.improvement}). Outcome: ${dir}.`;
    } else {
      outcomeSummary = 'Auto-closed: no comparable assessment evidence was recorded in the follow-up window.';
    }
  }

  return { baseline, checkpoints, settled, outcomeSummary, latestImprovement: latest?.improvement ?? null };
}

async function measureFollowUps(filter = {}) {
  // Only in-flight plans need re-measuring — completed and cancelled are terminal.
  const plans = await InterventionLog.find({
    ...filter,
    status: { $in: ['planned', 'in_progress'] },
  }).lean();

  for (const plan of plans) {
    const events = await MasteryEvent.find({ schoolId: plan.schoolId, studentId: plan.studentId,
      ...(plan.subject ? { subject: plan.subject } : {}) }).sort({ createdAt: 1 }).lean();
    const measured = measurePlan(plan, events);

    const update = {
      baselineScore: measured.baseline,
      followUpAssessments: measured.checkpoints,
    };
    if (measured.latestImprovement != null) update.improvement = measured.latestImprovement;
    if (measured.settled) {
      update.status = 'completed';
      update.resolvedAt = new Date();
      if (!plan.outcome && measured.outcomeSummary) update.outcome = measured.outcomeSummary;
    }

    await InterventionLog.updateOne({ _id: plan._id, schoolId: plan.schoolId }, { $set: update });
  }
}

module.exports = { measureFollowUps, measurePlan, computeBaseline, templates };
