const COLLECTIONS = [
  ['TutorConversation', 'studentId'],
  ['StudentMemorySummary', 'studentId'],
  ['RecommendationEvent', 'studentId'],
  ['TutorAnswerCorrection', 'studentId'],
  ['LongAnswerSubmission', 'studentId'],
  ['AiInteractionLog', 'userId'],
  ['ReadingAssessment', 'studentId'],
  ['WritingAssessment', 'studentId'],
  ['MasteryEvent', 'studentId'],
  ['PracticeAttempt', 'studentId'],
  ['StudentInsight', 'studentId'],
  ['SpacedRepetitionSchedule', 'studentId'],
  ['WeeklyStudyPlan', 'studentId'],
  ['StudentProgress', 'studentId'],
];

async function exportStudentAiData(studentId, schoolId) {
  const data = {};
  for (const [model, field] of COLLECTIONS) {
    try {
      const Model = require(`../models/${model}`);
      const filter = { [field]: studentId };
      if (schoolId) filter.schoolId = schoolId;
      data[model] = await Model.find(filter).lean();
    } catch (err) {
      // Optional collections may not be installed in older deployments.
      data[model] = { error: err.message };
    }
  }
  return { studentId: String(studentId), schoolId: schoolId ? String(schoolId) : null, exportedAt: new Date().toISOString(), data };
}

module.exports = { exportStudentAiData, COLLECTIONS };
