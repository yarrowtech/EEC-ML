const TeachingMaterial = require('../models/TeachingMaterial');
const PracticeAttempt  = require('../models/PracticeAttempt');
const MasteryScore     = require('../models/MasteryScore');
const NotificationService = require('../utils/notificationService');
const SpacedRepetitionSchedule = require('../models/SpacedRepetitionSchedule');

/**
 * Computes engagement score (0–100) per topic/subject for a student.
 * Score = (timeSpentMin*0.4) + (quizAttempts*10*0.3) + (viewCount*5*0.3), normalised to 100.
 */
async function computeEngagement(studentId, schoolId) {
  const [materials, attempts] = await Promise.all([
    TeachingMaterial.find({ schoolId, isPublished: true })
      .select('subjectName topicTitle engagement')
      .lean(),
    PracticeAttempt.find({ studentId, schoolId })
      .select('subjectId isCorrect createdAt')
      .lean(),
  ]);

  const subjectAttemptMap = {};
  for (const a of attempts) {
    const key = String(a.subjectId || 'general');
    subjectAttemptMap[key] = (subjectAttemptMap[key] || 0) + 1;
  }

  const engagementByTopic = [];
  for (const mat of materials) {
    const eng = mat.engagement || {};
    const views   = eng.viewCount || 0;
    const timeSec = eng.timeSpent || 0;
    const timeMin = timeSec / 60;

    const rawScore = (timeMin * 0.4) + (views * 5 * 0.3);
    const normalised = Math.min(100, Math.round(rawScore));

    engagementByTopic.push({
      subject:    mat.subjectName,
      topicTitle: mat.topicTitle,
      score:      normalised,
      views,
      timeSec,
      isLow:      normalised < 20 && (views > 0 || timeSec > 0),
    });
  }

  return engagementByTopic;
}

/**
 * Sends nudge notification when spaced repetition items are due.
 */
async function sendSpacedRepetitionNudges(schoolId) {
  try {
    const filter = { nextReviewDate: { $lte: new Date() } };
    if (schoolId) filter.schoolId = schoolId;
    const dueItems = await SpacedRepetitionSchedule.find(filter).limit(200).lean();

    // Group by studentId; carry per-item schoolId
    const studentMap = {};
    for (const item of dueItems) {
      const sid = String(item.studentId);
      if (!studentMap[sid]) studentMap[sid] = { items: [], schoolId: item.schoolId };
      studentMap[sid].items.push(item);
    }

    for (const [studentId, { items, schoolId: sid }] of Object.entries(studentMap)) {
      const topicList = items.slice(0, 3).map((i) => i.topicTitle || i.subject).join(', ');
      await NotificationService.createNotification({
        schoolId: sid,
        title: `🔁 Time to Review! (${items.length} topic${items.length > 1 ? 's' : ''})`,
        message: `Your spaced repetition reminder: review ${topicList}${items.length > 3 ? ` and ${items.length - 3} more` : ''} today.`,
        audience: 'Specific',
        type: 'learning',
        priority: 'medium',
        category: 'academic',
        targetUserIds: [studentId],
        relatedEntity: { entityType: 'spaced_repetition', entityId: studentId },
      });
    }
    return Object.keys(studentMap).length;
  } catch (err) {
    return 0;
  }
}

module.exports = { computeEngagement, sendSpacedRepetitionNudges };
