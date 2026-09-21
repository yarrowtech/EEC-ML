const Exam = require('../models/Exam');
const ExamGroup = require('../models/ExamGroup');
const ExamResult = require('../models/ExamResult');

// Publishes every result under a main exam (group) whose subject exam is
// completed, then clears the group's schedule. Returns how many were updated.
const publishGroupResults = async (group) => {
  const exams = await Exam.find({
    groupId: group._id,
    schoolId: group.schoolId,
  }).select('_id status').lean();

  const completedIds = exams
    .filter((exam) => String(exam.status || '').toLowerCase() === 'completed')
    .map((exam) => exam._id);

  if (!completedIds.length) return { published: 0, ready: false };

  const now = new Date();
  const result = await ExamResult.updateMany(
    { examId: { $in: completedIds }, schoolId: group.schoolId, published: { $ne: true } },
    { published: true, publishedAt: now }
  );

  await ExamGroup.updateOne(
    { _id: group._id, resultPublishAt: group.resultPublishAt },
    { $set: { resultPublishAt: null } }
  );

  return { published: result.modifiedCount || 0, ready: true };
};

// Called every minute by the scheduler — publishes any group whose scheduled
// result time has arrived. Groups with no completed subject exam yet stay
// scheduled and are retried on the next tick.
const runDueScheduledResultPublishes = async () => {
  try {
    const due = await ExamGroup.find({ resultPublishAt: { $ne: null, $lte: new Date() } })
      .select('_id schoolId resultPublishAt')
      .lean();

    for (const group of due) {
      try {
        const { published } = await publishGroupResults(group);
        if (published) console.log(`[result-publish cron] published ${published} result(s) for exam group ${group._id}`);
      } catch (err) {
        console.error('[result-publish cron] group failed:', group._id, err.message);
      }
    }
  } catch (err) {
    console.error('[result-publish cron] error:', err.message);
  }
};

module.exports = { publishGroupResults, runDueScheduledResultPublishes };
