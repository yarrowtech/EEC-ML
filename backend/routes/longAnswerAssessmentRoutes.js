const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authTeacher = require('../middleware/authTeacher');
const authStudent = require('../middleware/authStudent');
const StudentUser = require('../models/StudentUser');
const TeacherUser = require('../models/TeacherUser');
const LongAnswerQuestion = require('../models/LongAnswerQuestion');
const LongAnswerSubmission = require('../models/LongAnswerSubmission');
const {
  buildTeacherAllocationScope,
  scopeAllowsRequest,
  normalizeClassName,
  normalizeText,
} = require('../utils/teacherAllocationScope');
const {
  evaluateAnswer,
  applyMastery,
  resolveFinalMarks,
} = require('../services/longAnswerAssessmentService');

const teacherId = (req) => req.user?.id || req.teacher?.id;
const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

// ── Teacher: create a long-answer question ───────────────────────────────────
router.post('/teacher/questions', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const tId = teacherId(req);
    if (!schoolId || !tId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      subject = '', grade = '', section = '', topicId = '', topicTitle = '', chapterTitle = '',
      gradeLevel = '', questionText, modelAnswer = '', rubric = '', markingCriteria = [],
      maxMarks = 10, bloomTarget = '', dueDate,
    } = req.body || {};

    if (!String(questionText || '').trim()) {
      return res.status(400).json({ error: 'questionText is required' });
    }
    if (!grade || !subject) {
      return res.status(400).json({ error: 'grade and subject are required' });
    }

    const scope = await buildTeacherAllocationScope({ schoolId, campusId: req.campusId || null, teacherId: tId });
    if (!scope.length || !scopeAllowsRequest(scope, { grade, section, subject })) {
      return res.status(403).json({ error: 'You are not allocated to this class/section/subject' });
    }

    const teacher = await TeacherUser.findOne({ _id: tId, schoolId }).select('name').lean();
    const q = await LongAnswerQuestion.create({
      schoolId, createdBy: tId, teacherName: teacher?.name || '',
      subject, grade, section, topicId, topicTitle, chapterTitle, gradeLevel,
      questionText: String(questionText).trim(), modelAnswer, rubric,
      markingCriteria: Array.isArray(markingCriteria) ? markingCriteria.map(String).slice(0, 20) : [],
      maxMarks: Math.max(1, Math.min(100, Number(maxMarks) || 10)),
      bloomTarget,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: 'draft',
    });
    return res.status(201).json({ success: true, data: q });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Teacher: seed a question from an AI-generated long-answer question ────────
router.post('/teacher/questions/from-generated/:id', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const tId = teacherId(req);
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid question id' });
    }
    const GeneratedQuestion = require('../models/GeneratedQuestion');
    const gen = await GeneratedQuestion.findOne({ _id: req.params.id, schoolId, teacherId: tId }).lean();
    if (!gen) return res.status(404).json({ error: 'Generated question not found' });
    if (gen.questionType !== 'long_answer') {
      return res.status(400).json({ error: 'Only a long_answer generated question can seed this assessment' });
    }

    const { grade = '', section = '', dueDate } = req.body || {};
    if (!grade) return res.status(400).json({ error: 'grade is required' });

    const scope = await buildTeacherAllocationScope({ schoolId, campusId: req.campusId || null, teacherId: tId });
    if (!scope.length || !scopeAllowsRequest(scope, { grade, section, subject: gen.subjectName })) {
      return res.status(403).json({ error: 'You are not allocated to this class/section/subject' });
    }

    const teacher = await TeacherUser.findOne({ _id: tId, schoolId }).select('name').lean();
    const q = await LongAnswerQuestion.create({
      schoolId, createdBy: tId, teacherName: teacher?.name || '',
      subject: gen.subjectName || '', grade, section,
      topicTitle: gen.topicTitle || '', chapterTitle: gen.chapterTitle || '',
      questionText: gen.questionText, modelAnswer: gen.modelAnswer || '',
      markingCriteria: gen.markingCriteria || [],
      maxMarks: Math.max(1, Math.min(100, Number(gen.marks) || 10)),
      bloomTarget: gen.bloomLevel || '',
      sourceQuestionId: gen._id,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: 'draft',
    });
    return res.status(201).json({ success: true, data: q });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const loadOwnQuestion = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ error: 'Invalid question id' });
    return null;
  }
  const q = await LongAnswerQuestion.findOne({ _id: req.params.id, schoolId: req.schoolId, createdBy: teacherId(req) });
  if (!q) {
    res.status(404).json({ error: 'Question not found' });
    return null;
  }
  return q;
};

// ── Teacher: edit a draft ────────────────────────────────────────────────────
router.patch('/teacher/questions/:id', authTeacher, async (req, res) => {
  try {
    const q = await loadOwnQuestion(req, res);
    if (!q) return;
    if (q.status !== 'draft') return res.status(409).json({ error: 'Only a draft can be edited' });

    const editable = ['questionText', 'modelAnswer', 'rubric', 'topicId', 'topicTitle', 'chapterTitle', 'gradeLevel', 'bloomTarget'];
    for (const key of editable) {
      if (req.body?.[key] !== undefined) q[key] = req.body[key];
    }
    if (req.body?.markingCriteria !== undefined) {
      q.markingCriteria = Array.isArray(req.body.markingCriteria) ? req.body.markingCriteria.map(String).slice(0, 20) : [];
    }
    if (req.body?.maxMarks !== undefined) q.maxMarks = Math.max(1, Math.min(100, Number(req.body.maxMarks) || q.maxMarks));
    if (req.body?.dueDate !== undefined) q.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    await q.save();
    return res.json({ success: true, data: q });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Teacher: publish / close ─────────────────────────────────────────────────
router.patch('/teacher/questions/:id/publish', authTeacher, async (req, res) => {
  try {
    const q = await loadOwnQuestion(req, res);
    if (!q) return;
    if (q.status === 'published') return res.json({ success: true, data: q });
    if (q.status === 'closed') return res.status(409).json({ error: 'A closed question cannot be re-published' });
    q.status = 'published';
    q.publishedAt = new Date();
    await q.save();
    return res.json({ success: true, data: q });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/teacher/questions/:id/close', authTeacher, async (req, res) => {
  try {
    const q = await loadOwnQuestion(req, res);
    if (!q) return;
    q.status = 'closed';
    q.closedAt = new Date();
    await q.save();
    return res.json({ success: true, data: q });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Teacher: list own questions (with submission counts) ─────────────────────
router.get('/teacher/questions', authTeacher, async (req, res) => {
  try {
    const filter = { schoolId: req.schoolId, createdBy: teacherId(req) };
    if (req.query.status) filter.status = req.query.status;
    const questions = await LongAnswerQuestion.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    const counts = await LongAnswerSubmission.aggregate([
      { $match: { questionId: { $in: questions.map((q) => q._id) } } },
      { $group: { _id: '$questionId', total: { $sum: 1 }, needsReview: { $sum: { $cond: ['$ai.needsReview', 1, 0] } },
        reviewed: { $sum: { $cond: [{ $eq: ['$status', 'reviewed'] }, 1, 0] } } } },
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c]));
    const data = questions.map((q) => ({ ...q, submissions: byId.get(String(q._id)) || { total: 0, needsReview: 0, reviewed: 0 } }));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Teacher: submissions for one question (review view) ──────────────────────
router.get('/teacher/questions/:id/submissions', authTeacher, async (req, res) => {
  try {
    const q = await loadOwnQuestion(req, res);
    if (!q) return;
    const submissions = await LongAnswerSubmission.find({ questionId: q._id, schoolId: req.schoolId })
      .sort({ 'ai.needsReview': -1, submittedAt: 1 }).lean();
    return res.json({ success: true, data: { question: q, submissions } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Teacher: review / override an AI grade ───────────────────────────────────
router.patch('/teacher/submissions/:id/review', authTeacher, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid submission id' });
    }
    const submission = await LongAnswerSubmission.findOne({ _id: req.params.id, schoolId: req.schoolId });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const q = await LongAnswerQuestion.findOne({ _id: submission.questionId, schoolId: req.schoolId, createdBy: teacherId(req) });
    if (!q) return res.status(403).json({ error: 'You do not own this question' });

    const { marks, feedback } = req.body || {};
    if (marks === undefined || !Number.isFinite(Number(marks)) || Number(marks) < 0 || Number(marks) > q.maxMarks) {
      return res.status(400).json({ error: `marks must be a number between 0 and ${q.maxMarks}` });
    }
    const teacher = await TeacherUser.findOne({ _id: teacherId(req), schoolId: req.schoolId }).select('name').lean();
    submission.teacherReview = {
      marks: Number(marks),
      feedback: String(feedback || ''),
      reviewedBy: teacherId(req),
      reviewerName: teacher?.name || '',
      reviewedAt: new Date(),
    };
    submission.finalMarks = resolveFinalMarks(submission);
    submission.status = 'reviewed';
    await submission.save();

    try {
      await require('../models/AuditLog').create({
        schoolId: req.schoolId, actorId: teacherId(req), actorType: 'teacher', actorName: teacher?.name || '',
        action: 'long_answer.grade_review', entity: 'LongAnswerSubmission', entityId: submission._id, ip: req.ip,
        meta: { questionId: String(q._id), studentId: String(submission.studentId),
          aiMarks: submission.ai?.marks, teacherMarks: Number(marks) },
      });
    } catch (_) { /* audit must not block */ }

    try {
      const applied = await applyMastery({ schoolId: req.schoolId, question: q.toObject(), submission: submission.toObject() });
      if (applied && !submission.masteryApplied) {
        await LongAnswerSubmission.updateOne({ _id: submission._id }, { $set: { masteryApplied: true } });
      }
    } catch (err) {
      require('../utils/logger').logger.error({ err, submissionId: String(submission._id) }, 'long-answer review mastery apply failed');
    }

    return res.json({ success: true, data: submission });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Student: questions assigned to me ────────────────────────────────────────
router.get('/student/questions', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const student = await StudentUser.findOne({ _id: studentId, schoolId }).select('name grade section').lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const gradeNorm = normalizeClassName(student.grade);
    const sectionNorm = normalizeText(student.section);

    const published = await LongAnswerQuestion.find({ schoolId, status: 'published' })
      .sort({ publishedAt: -1 }).limit(200).lean();
    const mine = published.filter((q) => normalizeClassName(q.grade) === gradeNorm
      && (!q.section || normalizeText(q.section) === sectionNorm));

    const submissions = await LongAnswerSubmission.find({
      schoolId, studentId, questionId: { $in: mine.map((q) => q._id) },
    }).lean();
    const bySubmission = new Map(submissions.map((s) => [String(s.questionId), s]));

    const data = mine.map((q) => {
      const s = bySubmission.get(String(q._id));
      return {
        ...q,
        modelAnswer: undefined, rubric: undefined, markingCriteria: undefined, // hide the marking scheme
        submission: s ? {
          _id: s._id, status: s.status, submittedAt: s.submittedAt, wordCount: s.wordCount,
          finalMarks: s.finalMarks ?? s.ai?.marks ?? null,
          feedback: s.teacherReview?.reviewedAt ? s.teacherReview.feedback : s.ai?.feedback,
          reviewed: Boolean(s.teacherReview?.reviewedAt),
          missingConcepts: s.ai?.missingConcepts || [],
        } : null,
      };
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Student: submit an answer ───────────────────────────────────────────────
router.post('/student/questions/:id/submit', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid question id' });
    }
    const answerText = String(req.body?.answerText || '').trim();
    if (answerText.length < 10) {
      return res.status(400).json({ error: 'answerText must be at least 10 characters' });
    }

    const q = await LongAnswerQuestion.findOne({ _id: req.params.id, schoolId }).lean();
    if (!q) return res.status(404).json({ error: 'Question not found' });
    if (q.status !== 'published') return res.status(409).json({ error: 'This question is not open for submission' });

    const student = await StudentUser.findOne({ _id: studentId, schoolId }).select('name grade section').lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (normalizeClassName(student.grade) !== normalizeClassName(q.grade)
      || (q.section && normalizeText(student.section) !== normalizeText(q.section))) {
      return res.status(403).json({ error: 'This question is not assigned to your class' });
    }

    const existing = await LongAnswerSubmission.findOne({ questionId: q._id, studentId });
    if (existing && existing.status !== 'failed') {
      return res.status(409).json({ error: 'You have already submitted an answer', data: { submissionId: existing._id } });
    }

    let ai;
    try {
      ai = await evaluateAnswer({ question: q, answerText, studentId });
    } catch (err) {
      // Persist the answer even if evaluation fails so it is never lost.
      await LongAnswerSubmission.findOneAndUpdate(
        { questionId: q._id, studentId },
        { $set: { schoolId, studentName: student.name || '', answerText, wordCount: wordCount(answerText),
          submittedAt: new Date(), status: 'failed' }, $inc: { attemptCount: existing ? 1 : 0 } },
        { upsert: true, setDefaultsOnInsert: true }
      );
      return res.status(502).json({ error: 'Evaluation service unavailable — your answer was saved and will be graded shortly' });
    }

    const submission = await LongAnswerSubmission.findOneAndUpdate(
      { questionId: q._id, studentId },
      {
        $set: {
          schoolId, studentName: student.name || '', answerText, wordCount: wordCount(answerText),
          submittedAt: new Date(), ai,
          finalMarks: ai.marks,
          status: 'evaluated',
        },
        $setOnInsert: { attemptCount: 1 },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    try {
      const applied = await applyMastery({ schoolId, question: q, submission: submission.toObject() });
      if (applied) await LongAnswerSubmission.updateOne({ _id: submission._id }, { $set: { masteryApplied: true } });
    } catch (err) {
      require('../utils/logger').logger.error({ err, submissionId: String(submission._id) }, 'long-answer mastery apply failed');
    }

    if (ai.score < 0.6) {
      require('../services/errorClassifier').recordErrors({
        studentId, schoolId, source: 'exam',
        wrongs: [{ questionId: String(q._id), questionText: q.questionText, correctAnswer: q.modelAnswer || '',
          studentAnswer: answerText, subject: q.subject || '', topicTitle: q.topicTitle || '', chapterTitle: q.chapterTitle || '' }],
      }).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      data: {
        _id: submission._id, status: submission.status,
        marks: ai.marks, maxMarks: q.maxMarks,
        feedback: ai.feedback, missingConcepts: ai.missingConcepts,
        bloomLevel: ai.bloomLevel, errorType: ai.errorType,
        pendingTeacherReview: ai.needsReview,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Student: my submission history ──────────────────────────────────────────
router.get('/student/submissions', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const submissions = await LongAnswerSubmission.find({ schoolId, studentId })
      .sort({ createdAt: -1 }).limit(100).lean();
    const questions = await LongAnswerQuestion.find({ _id: { $in: submissions.map((s) => s.questionId) } })
      .select('questionText subject topicTitle maxMarks').lean();
    const byId = new Map(questions.map((q) => [String(q._id), q]));
    const data = submissions.map((s) => ({
      _id: s._id,
      question: byId.get(String(s.questionId)) || null,
      status: s.status,
      submittedAt: s.submittedAt,
      finalMarks: s.finalMarks ?? s.ai?.marks ?? null,
      feedback: s.teacherReview?.reviewedAt ? s.teacherReview.feedback : s.ai?.feedback,
      reviewed: Boolean(s.teacherReview?.reviewedAt),
      missingConcepts: s.ai?.missingConcepts || [],
    }));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
