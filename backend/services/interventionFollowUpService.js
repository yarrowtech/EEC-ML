const InterventionLog = require('../models/InterventionLog');
const MasteryEvent = require('../models/MasteryEvent');
const { credible, timeOf } = require('./learningEvidenceService');
const DAY = 86400000;

const templates = {
  targeted_reteach: { title: 'Targeted reteaching', action: 'Identify the prerequisite gap, model a worked example, practise with support, then complete an independent check.' },
  guided_practice: { title: 'Guided practice', action: 'Review recent errors, practise three examples with feedback, then attempt an independent question.' },
  study_routine: { title: 'Study routine', action: 'Agree a short daily study routine, check participation, and review understanding at the next follow-up.' },
};

function measurePlan(plan, events, now = Date.now()) {
  const eligible = events.filter(credible).filter((e) => (!plan.subject || e.subject === plan.subject)
    && (!plan.topicId || e.topicId === plan.topicId)).sort((a, b) => timeOf(a) - timeOf(b));
  const start = new Date(plan.scheduledDate || plan.createdAt).getTime();
  // Baseline is fixed before the intervention; later results cannot change it.
  const baseline = plan.baselineScore ?? eligible.filter((e) => timeOf(e) <= start).at(-1)?.assessmentScore ?? null;
  return { baseline, checkpoints: (plan.followUpAssessments || []).map((checkpoint) => {
    if (checkpoint.completedAt || new Date(checkpoint.scheduledDate).getTime() > now) return checkpoint;
    const due = new Date(checkpoint.scheduledDate).getTime();
    const evidence = eligible.find((e) => timeOf(e) >= due && timeOf(e) < due + 7 * DAY && timeOf(e) <= now);
    if (!evidence) return checkpoint;
    return { ...checkpoint, score: evidence.assessmentScore,
      completedAt: new Date(timeOf(evidence)), eventId: evidence._id,
      improvement: baseline == null ? null : Math.round((evidence.assessmentScore - baseline) * 100) / 100 };
  }) };
}

async function measureFollowUps(filter = {}) {
  const plans = await InterventionLog.find({ ...filter, status: { $ne: 'cancelled' } }).lean();
  for (const plan of plans) {
    const events = await MasteryEvent.find({ schoolId: plan.schoolId, studentId: plan.studentId,
      ...(plan.subject ? { subject: plan.subject } : {}) }).sort({ createdAt: 1 }).lean();
    const measured = measurePlan(plan, events);
    const latest = measured.checkpoints.filter((c) => c.completedAt).at(-1);
    await InterventionLog.updateOne({ _id: plan._id, schoolId: plan.schoolId }, { $set: {
      baselineScore: measured.baseline, followUpAssessments: measured.checkpoints,
      ...(latest ? { improvement: latest.improvement } : {}),
    } });
  }
}

module.exports = { measureFollowUps, measurePlan, templates };
