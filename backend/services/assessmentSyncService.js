const { applyAssessment } = require('./masteryEventService');

// Reconcile durable, teacher-published results. Also run by the scheduler so a
// failed side effect is retried without losing the original student submission.
async function syncStudentAssessments({ schoolId, studentId }) {
  const ExamResult = require('../models/ExamResult');
  const StudentProgress = require('../models/StudentProgress');
  const Assignment = require('../models/Assignment');
  const [results, progress] = await Promise.all([
    ExamResult.find({ schoolId, studentId, published: true, status: { $ne: 'absent' } })
      .populate('examId', 'schoolId subject marks').lean(),
    StudentProgress.findOne({ schoolId, studentId }).lean(),
  ]);
  const pending = [];
  const attempts = await require('../models/ExamAttempt').find({ schoolId, studentId,
    status: { $in: ['submitted', 'timed_out'] } }).lean();
  for (const attempt of attempts) {
    for (const answer of attempt.answers || []) {
      if (!answer.subject || !answer.evaluation || answer.evaluation.needsReview) continue;
      pending.push({ source: 'exam', subject: answer.subject, topicTitle: answer.topicTitle,
        topicId: answer.subject + '::' + (answer.topicTitle || 'exam'),
        assessmentScore: answer.evaluation.score * 100,
        eventId: String(attempt._id) + ':' + String(answer.questionId),
        date: attempt.submittedAt,
        metadata: { ...answer.evaluation, provenance: 'stored_exam', questionId: String(answer.questionId) } });
    }
  }
  for (const r of results) {
    const exam = r.examId;
    if (String(exam?.schoolId) !== String(schoolId) || !exam?.subject || !(exam.marks > 0)) continue;
    pending.push({ subject: exam.subject, topicTitle: exam.subject,
      topicId: exam.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      source: 'exam', assessmentScore: r.marks / exam.marks * 100,
      eventId: String(r._id) + ':' + new Date(r.updatedAt || r.createdAt).toISOString(),
      date: r.updatedAt || r.createdAt, metadata: { resultId: String(r._id), provenance: 'teacher_published' } });
  }
  for (const sub of progress?.submissions || []) {
    if (sub.score == null || !sub.publishedByTeacher) continue;
    const assignment = await Assignment.findOne({ _id: sub.assignmentId, schoolId }).lean();
    if (!assignment?.subject || !(assignment.marks > 0)) continue;
    const topicTitle = assignment.topicTitle || assignment.topic || assignment.title;
    pending.push({ subject: assignment.subject, topicTitle, topicId: assignment.subject + '::' + topicTitle,
      chapterTitle: assignment.chapterTitle, source: 'assignment',
      assessmentScore: sub.score / assignment.marks * 100,
      eventId: String(sub._id) + ':' + new Date(sub.gradedAt || sub.publishedAt || sub.submittedAt).toISOString(),
      date: sub.gradedAt || sub.publishedAt || sub.submittedAt,
      metadata: { assignmentId: String(assignment._id), provenance: 'teacher_published',
        missingConcepts: sub.aiMissingConcepts || [], confidenceScore: sub.aiConfidenceScore,
        errorType: sub.aiErrorType, bloomLevel: sub.aiBloomLevel } });
  }
  pending.sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const { date, ...assessment } of pending) {
    await applyAssessment({ schoolId, studentId, ...assessment,
      metadata: { ...assessment.metadata, assessedAt: date } });
  }
}

async function reconcileAssessments() {
  const StudentUser = require('../models/StudentUser');
  for await (const student of StudentUser.find({}).select('_id schoolId').lean().cursor()) {
    try { await syncStudentAssessments({ schoolId: student.schoolId, studentId: student._id }); }
    catch (err) { require('../utils/logger').error({ err, studentId: student._id }, 'Assessment reconciliation failed'); }
  }
}

module.exports = { syncStudentAssessments, reconcileAssessments };
