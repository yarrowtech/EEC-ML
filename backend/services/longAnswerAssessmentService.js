/**
 * longAnswerAssessmentService.js
 * Evaluates a student's written long-answer response against the teacher's
 * model answer / rubric, persists the AI grade, and pushes an official mastery
 * event once the grade is trustworthy (or after a teacher review).
 */
const { evaluateStoredAnswer } = require('./academicEvaluator');
const { applyAssessment } = require('./masteryEventService');

const clampMarks = (marks, max) => Math.max(0, Math.min(max, Math.round(marks * 100) / 100));

// Run the evaluator and shape the result for storage on the submission.
async function evaluateAnswer({ question, answerText, studentId } = {}) {
  const context = [question.rubric, ...(question.markingCriteria || [])].filter(Boolean).join('\n');
  const started = Date.now();
  let raw;
  try {
    raw = await evaluateStoredAnswer({
      questionText: question.questionText,
      correctAnswer: question.modelAnswer || '',
      studentAnswer: answerText,
      subject: question.subject || '',
      topicTitle: question.topicTitle || '',
      questionType: 'long_answer',
      context,
    });
  } catch (err) {
    require('./aiInteractionLogger').logAiInteraction({
      schoolId: question.schoolId, userId: studentId, userRole: 'student',
      feature: 'long_answer_evaluate', subject: question.subject, topicTitle: question.topicTitle,
      entity: 'LongAnswerQuestion', entityId: question._id,
      status: 'error', errorType: err.response ? 'ai_service_error' : 'network_error',
      latencyMs: Date.now() - started,
    });
    throw err;
  }
  require('./aiInteractionLogger').logAiInteraction({
    schoolId: question.schoolId, userId: studentId, userRole: 'student',
    feature: 'long_answer_evaluate', subject: question.subject, topicTitle: question.topicTitle,
    aiResponse: raw, entity: 'LongAnswerQuestion', entityId: question._id,
    status: 'success', latencyMs: Date.now() - started,
  });
  const score = Number.isFinite(raw.score) ? raw.score : 0;
  return {
    score,
    marks: clampMarks(score * question.maxMarks, question.maxMarks),
    feedback: raw.feedback || '',
    errorType: raw.errorType || '',
    bloomLevel: raw.bloomLevel || '',
    missingConcepts: Array.isArray(raw.missingConcepts) ? raw.missingConcepts.map(String).slice(0, 30) : [],
    confidenceScore: Number.isFinite(raw.confidenceScore) ? raw.confidenceScore : null,
    evaluationMethod: raw.evaluationMethod || 'llm',
    evaluatorVersion: raw.evaluatorVersion || 'academic-v1',
    needsReview: Boolean(raw.needsReview),
    latencyMs: raw.latencyMs ?? null,
  };
}

function resolveFinalMarks(submission) {
  const t = submission.teacherReview?.marks;
  if (Number.isFinite(t)) return t;
  return Number.isFinite(submission.ai?.marks) ? submission.ai.marks : null;
}

// Push a mastery event for a graded submission. Skips AI grades flagged for
// review until a teacher has confirmed them. Idempotent per grade source via
// the eventId (a teacher review produces a distinct, superseding event).
async function applyMastery({ schoolId, question, submission }) {
  const finalMarks = resolveFinalMarks(submission);
  if (finalMarks == null || !(question.maxMarks > 0)) return false;

  const reviewed = Boolean(submission.teacherReview?.reviewedAt);
  if (!reviewed && submission.ai?.needsReview) return false;

  const topicId = question.topicId
    || `${question.subject || 'subject'}::${question.topicTitle || question.chapterTitle || 'long-answer'}`;
  const stamp = reviewed
    ? new Date(submission.teacherReview.reviewedAt).toISOString()
    : new Date(submission.submittedAt || submission.createdAt || Date.now()).toISOString();

  await applyAssessment({
    schoolId,
    studentId: submission.studentId,
    subject: question.subject || 'General',
    topicId,
    topicTitle: question.topicTitle || question.subject || '',
    chapterTitle: question.chapterTitle || '',
    source: 'assignment',
    assessmentScore: (finalMarks / question.maxMarks) * 100,
    eventId: `long_answer:${submission._id}:${reviewed ? 'review' : 'ai'}:${stamp}`,
    metadata: {
      provenance: reviewed ? 'teacher_reviewed' : 'long_answer_ai',
      questionId: String(question._id),
      errorType: submission.ai?.errorType,
      bloomLevel: submission.ai?.bloomLevel,
      missingConcepts: submission.ai?.missingConcepts || [],
      confidenceScore: submission.ai?.confidenceScore,
      needsReview: submission.ai?.needsReview,
      assessedAt: stamp,
    },
  });
  return true;
}

module.exports = { evaluateAnswer, applyMastery, resolveFinalMarks, clampMarks };
