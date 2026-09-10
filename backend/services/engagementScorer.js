const TeachingMaterial = require('../models/TeachingMaterial');
const NotificationService = require('../utils/notificationService');
const SpacedRepetitionSchedule = require('../models/SpacedRepetitionSchedule');

/**
 * Computes engagement score (0–100) per topic/subject for a student.
 * Score = (timeSpentMin*0.4) + (quizAttempts*10*0.3) + (viewCount*5*0.3), normalised to 100.
 */
async function computeEngagement(studentId, schoolId) {
  const [materials] = await Promise.all([
    TeachingMaterial.find({
      schoolId,
      $or: [
        { publishedForStudentPortal: true },
        { status: 'published' },
        // Keep compatibility with legacy documents that used isPublished.
        { isPublished: true },
      ],
    })
      .select('subjectName topicTitle viewedBy quizAttempts')
      .lean(),
  ]);

  const engagementByTopic = [];
  let wellbeing = null;
  try {
    const Wellbeing = require('../models/Wellbeing');
    wellbeing = await Wellbeing.findOne({ student: studentId, schoolId })
      .select('mood socialEngagement academicStress lastAssessment')
      .lean();
  } catch (_) {
    // Wellbeing is optional; behavioural and situational scores still work.
  }

  const moodScore = {
    excellent: 100,
    good: 80,
    neutral: 60,
    concerning: 30,
    critical: 10,
  };
  const emotionalScore = wellbeing
    ? Math.round((Number(wellbeing.socialEngagement || 5) * 10 * 0.45)
      + ((10 - Number(wellbeing.academicStress || 5)) * 10 * 0.35)
      + ((moodScore[wellbeing.mood] ?? 60) * 0.2))
    : null;

  for (const mat of materials) {
    const sid = String(studentId);
    const viewEntry = (mat.viewedBy || []).find((entry) => String(entry.studentId) === sid);
    const studentAttempts = (mat.quizAttempts || []).filter((entry) => String(entry.studentId) === sid);
    const views   = viewEntry?.viewCount || 0;
    const timeSec = viewEntry?.timeSpent || 0;
    const timeMin = timeSec / 60;
    const lastActivity = [
      viewEntry?.lastViewedAt,
      ...studentAttempts.map((entry) => entry.submittedAt || entry.startedAt),
    ].filter(Boolean).map((value) => new Date(value).getTime()).filter(Number.isFinite).sort((a, b) => b - a)[0];

    const behavioural = Math.min(100, Math.round((timeMin * 0.4) + (studentAttempts.length * 10 * 0.3) + (views * 5 * 0.3)));
    const daysSinceActivity = lastActivity ? Math.max(0, (Date.now() - lastActivity) / 86400000) : Infinity;
    const situational = Number.isFinite(daysSinceActivity)
      ? Math.max(0, Math.round(100 * Math.exp(-daysSinceActivity / 14)))
      : 0;
    const normalised = Math.min(100, Math.max(0, Math.round(
      behavioural * 0.5 + situational * 0.3 + (emotionalScore == null ? behavioural * 0.2 : emotionalScore * 0.2)
    )));

    engagementByTopic.push({
      subject:    mat.subjectName,
      topicTitle: mat.topicTitle,
      score:      normalised,
      dimensions: {
        behavioural,
        situational,
        emotional: emotionalScore,
      },
      views,
      timeSec,
      quizAttempts: studentAttempts.length,
      lastActivityAt: lastActivity ? new Date(lastActivity) : null,
      isLow:      normalised < 20 && (views > 0 || timeSec > 0 || studentAttempts.length > 0),
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
