/**
 * confidenceTrackingService.js
 * Learner confidence tracking (dynamic self-perception): a student rates how
 * confident they feel on a topic (1-5) right after a quiz/practice attempt.
 * Each rating is compared against their actual mastery score at that moment,
 * surfacing the over/under-confidence gap a raw mastery score can't show —
 * a student stuck at 40% mastery who rates themselves "very confident" needs
 * a different intervention than one who rates themselves "not confident".
 */
const GAP_THRESHOLD = 15; // |confidence% - mastery%| within this band counts as calibrated

function labelFromGap(gap) {
  if (gap == null) return 'insufficient_data';
  if (gap > GAP_THRESHOLD) return 'overconfident';
  if (gap < -GAP_THRESHOLD) return 'underconfident';
  return 'calibrated';
}

async function recordCheckin({ studentId, schoolId, subject, topicId, topicTitle, confidenceRating, source = 'manual' }) {
  const rating = Number(confidenceRating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw Object.assign(new Error('confidenceRating must be an integer from 1 to 5'), { status: 400 });
  }
  if (!topicId) throw Object.assign(new Error('topicId is required'), { status: 400 });

  const MasteryScore = require('../models/MasteryScore');
  const masteryDoc = await MasteryScore.findOne({ studentId, schoolId, subject, topicId }).select('score').lean();
  const masteryScoreAtCheckin = masteryDoc ? masteryDoc.score : null;
  const confidencePercent = Math.round(((rating - 1) / 4) * 100);
  const calibrationGap = masteryScoreAtCheckin == null ? null : confidencePercent - masteryScoreAtCheckin;
  const calibrationLabel = labelFromGap(calibrationGap);

  const StudentConfidenceCheckin = require('../models/StudentConfidenceCheckin');
  const doc = await StudentConfidenceCheckin.create({
    schoolId, studentId, subject: subject || '', topicId, topicTitle: topicTitle || '',
    confidenceRating: rating, confidencePercent, masteryScoreAtCheckin, calibrationGap, calibrationLabel, source,
  });

  return doc.toObject ? doc.toObject() : doc;
}

// Most-recent checkin per topic, plus an overall calibration trend for the student.
async function getStudentCalibrationProfile({ studentId, schoolId, subject }) {
  const StudentConfidenceCheckin = require('../models/StudentConfidenceCheckin');
  const filter = { studentId, schoolId };
  if (subject) filter.subject = subject;
  const checkins = await StudentConfidenceCheckin.find(filter).sort({ createdAt: -1 }).limit(200).lean();

  const latestByTopic = new Map();
  for (const c of checkins) {
    const key = `${c.subject}::${c.topicId}`;
    if (!latestByTopic.has(key)) latestByTopic.set(key, c); // sorted desc, so first hit is most recent
  }
  const topics = [...latestByTopic.values()];
  const gaps = topics.map((t) => t.calibrationGap).filter((g) => g != null);
  const overallGap = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;

  return {
    topics: topics.map((t) => ({
      subject: t.subject, topicId: t.topicId, topicTitle: t.topicTitle,
      confidencePercent: t.confidencePercent, masteryScoreAtCheckin: t.masteryScoreAtCheckin,
      calibrationGap: t.calibrationGap, calibrationLabel: t.calibrationLabel, checkedInAt: t.createdAt,
    })),
    overallGap,
    overallLabel: labelFromGap(overallGap),
    sampleSize: gaps.length,
    history: checkins.slice(0, 30).map((c) => ({ at: c.createdAt, gap: c.calibrationGap, label: c.calibrationLabel })).reverse(),
  };
}

// Teacher-facing view: which students in a class are most miscalibrated, ranked
// by the size of their average confidence/mastery gap (largest first).
async function getClassCalibrationSummary({ schoolId, studentIds, subject }) {
  const results = await Promise.allSettled(
    studentIds.map(async (studentId) => ({
      studentId,
      ...(await getStudentCalibrationProfile({ studentId, schoolId, subject })),
    }))
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((r) => r.sampleSize > 0)
    .sort((a, b) => Math.abs(b.overallGap ?? 0) - Math.abs(a.overallGap ?? 0));
}

module.exports = {
  recordCheckin,
  getStudentCalibrationProfile,
  getClassCalibrationSummary,
  labelFromGap,
  GAP_THRESHOLD,
};
