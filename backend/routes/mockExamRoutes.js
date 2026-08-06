const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authStudent = require('../middleware/authStudent');
const adminAuth = require('../middleware/adminAuth');
const teacherAuth = require('../middleware/authTeacher');
const Exam = require('../models/Exam');
const ExamQuestion = require('../models/ExamQuestion');
const ExamAttempt = require('../models/ExamAttempt');
const StudentUser = require('../models/StudentUser');
const MasteryScore = require('../models/MasteryScore');
const NotificationService = require('../utils/notificationService');

const adminOrTeacherAuth = (req, res, next) => {
  adminAuth(req, res, (adminErr) => {
    if (!adminErr) return next();
    teacherAuth(req, res, next);
  });
};

// ── Admin/Teacher: Add questions to an exam ──────────────────────────────────
router.post('/questions', adminOrTeacherAuth, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.admin?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' });
    const { examId, questions } = req.body || {};
    if (!examId || !Array.isArray(questions) || !questions.length) {
      return res.status(400).json({ error: 'examId and questions[] are required' });
    }
    const docs = questions.map((q, i) => ({
      schoolId,
      campusId: req.campusId || null,
      examId,
      type: q.type || 'mcq',
      question: q.question,
      options: q.options || [],
      answer: q.answer || '',
      marks: q.marks || 1,
      topicTitle: q.topicTitle || '',
      chapterTitle: q.chapterTitle || '',
      subject: q.subject || '',
      order: q.order ?? i,
    }));
    const created = await ExamQuestion.insertMany(docs, { ordered: false });
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin/Teacher: Get questions for an exam ─────────────────────────────────
router.get('/questions/:examId', adminOrTeacherAuth, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.admin?.schoolId || null;
    const { examId } = req.params;
    const questions = await ExamQuestion.find({ schoolId, examId }).sort({ order: 1 }).lean();
    return res.json({ success: true, data: questions });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Student: Get exam questions (answers stripped, only for isMock or live exam) ──
router.get('/attempt/:examId', authStudent, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const studentId = req.user?.id;
    const { examId } = req.params;

    const exam = await Exam.findOne({ _id: examId, schoolId, published: true }).lean();
    if (!exam) return res.status(404).json({ error: 'Exam not found or not published' });

    const questions = await ExamQuestion.find({ schoolId, examId }).sort({ order: 1 })
      .select('-answer').lean();

    const existingAttempt = await ExamAttempt.findOne({ examId, studentId }).lean();

    return res.json({ success: true, data: { exam, questions, existingAttempt } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Student: Start attempt ────────────────────────────────────────────────────
router.post('/attempt/start', authStudent, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const studentId = req.user?.id;
    const { examId, isMock = false } = req.body || {};
    if (!examId) return res.status(400).json({ error: 'examId required' });

    const existing = await ExamAttempt.findOne({ examId, studentId });
    if (existing && existing.status === 'submitted') {
      return res.status(400).json({ error: 'Exam already submitted' });
    }
    if (existing) return res.json({ success: true, data: existing });

    const questions = await ExamQuestion.find({ schoolId, examId }).lean();
    const totalMarks = questions.reduce((s, q) => s + (q.marks || 1), 0);

    const attempt = await ExamAttempt.create({
      schoolId,
      campusId: req.campusId || null,
      examId,
      studentId,
      answers: [],
      totalMarks,
      isMock,
      startedAt: new Date(),
      status: 'in_progress',
    });
    return res.status(201).json({ success: true, data: attempt });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Student: Submit attempt ───────────────────────────────────────────────────
router.post('/attempt/submit', authStudent, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const studentId = req.user?.id;
    const { examId, answers = [], timedOut = false } = req.body || {};
    if (!examId) return res.status(400).json({ error: 'examId required' });

    const attempt = await ExamAttempt.findOne({ examId, studentId });
    if (!attempt) return res.status(404).json({ error: 'Attempt not found. Call /start first.' });
    if (attempt.status === 'submitted') return res.json({ success: true, data: attempt });

    const questions = await ExamQuestion.find({ schoolId, examId }).lean();
    const questionMap = {};
    questions.forEach((q) => { questionMap[String(q._id)] = q; });

    let marksScored = 0;
    const gradedAnswers = answers.map((a) => {
      const q = questionMap[String(a.questionId)];
      if (!q) return { ...a, isCorrect: false, marksAwarded: 0 };
      const isCorrect = q.type === 'mcq' || q.type === 'true_false'
        ? String(a.studentAnswer || '').trim().toLowerCase() === String(q.answer || '').trim().toLowerCase()
        : null;
      const awarded = isCorrect === true ? (q.marks || 1) : 0;
      marksScored += awarded;
      return {
        questionId: q._id,
        studentAnswer: a.studentAnswer || '',
        isCorrect,
        marksAwarded: awarded,
        topicTitle: q.topicTitle || '',
        subject: q.subject || '',
      };
    });

    const percentage = attempt.totalMarks > 0
      ? Math.round((marksScored / attempt.totalMarks) * 100) : 0;

    attempt.answers = gradedAnswers;
    attempt.marksScored = marksScored;
    attempt.percentage = percentage;
    attempt.submittedAt = new Date();
    attempt.status = timedOut ? 'timed_out' : 'submitted';
    await attempt.save();

    // Non-blocking: trigger mastery update per topic cluster
    if (questions.length > 0) {
      const subjectGroups = {};
      gradedAnswers.forEach((a) => {
        const key = `${a.subject}|||${a.topicTitle}`;
        if (!subjectGroups[key]) subjectGroups[key] = { correct: 0, total: 0, subject: a.subject, topicTitle: a.topicTitle };
        subjectGroups[key].total++;
        if (a.isCorrect) subjectGroups[key].correct++;
      });
      const axios = require('axios');
      const BASE = `http://localhost:${process.env.PORT || 5000}`;
      Object.values(subjectGroups).forEach(({ subject, topicTitle, correct, total }) => {
        if (!subject) return;
        const pct = Math.round((correct / total) * 100);
        axios.post(`${BASE}/api/mastery/post-exam`, {
          studentId: String(studentId),
          schoolId: String(schoolId),
          subject,
          marksScored: correct,
          totalMarks: total,
        }, {
          headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET },
        }).catch(() => {});
      });
    }

    return res.json({ success: true, data: attempt });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Student: Get wrong answer review for a submitted attempt ─────────────────
router.get('/attempt/:examId/wrong-answers', authStudent, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const studentId = req.user?.id;
    const { examId } = req.params;

    const attempt = await ExamAttempt.findOne({ examId, studentId, status: { $in: ['submitted', 'timed_out'] } }).lean();
    if (!attempt) return res.status(404).json({ error: 'No submitted attempt found' });

    const wrongIds = attempt.answers.filter((a) => a.isCorrect === false).map((a) => a.questionId);
    if (!wrongIds.length) return res.json({ success: true, data: [] });

    const questions = await ExamQuestion.find({ _id: { $in: wrongIds } }).lean();
    const qMap = {};
    questions.forEach((q) => { qMap[String(q._id)] = q; });

    const wrongAnswers = attempt.answers
      .filter((a) => a.isCorrect === false)
      .map((a) => ({
        questionId: a.questionId,
        question: qMap[String(a.questionId)]?.question || '',
        options: qMap[String(a.questionId)]?.options || [],
        correctAnswer: qMap[String(a.questionId)]?.answer || '',
        studentAnswer: a.studentAnswer,
        topicTitle: a.topicTitle || qMap[String(a.questionId)]?.topicTitle || '',
        subject: a.subject || qMap[String(a.questionId)]?.subject || '',
        marks: qMap[String(a.questionId)]?.marks || 1,
      }));

    return res.json({ success: true, data: wrongAnswers });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET: Pre-exam revision check — exams within 7 days ───────────────────────
router.get('/pre-revision', authStudent, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const student = await StudentUser.findById(req.user?.id).select('grade section classId sectionId').lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingExams = await Exam.find({
      schoolId,
      published: true,
      $or: [
        { classId: student.classId, sectionId: student.sectionId },
        { grade: student.grade, section: student.section },
      ],
    }).lean();

    const upcoming = upcomingExams.filter((exam) => {
      const d = new Date(exam.date);
      return !Number.isNaN(d.getTime()) && d >= now && d <= in7Days;
    });

    const revisionItems = upcoming.map((exam) => ({
      examId: exam._id,
      title: exam.title,
      subject: exam.subject,
      date: exam.date,
      daysLeft: Math.ceil((new Date(exam.date) - now) / 86400000),
      suggestedMode: 'revision',
    }));

    // Auto-assign revision path nodes for these subjects (non-blocking)
    const TeacherLearningPath = require('../models/TeacherLearningPath');
    revisionItems.forEach(async ({ subject }) => {
      try {
        const paths = await TeacherLearningPath.find({
          studentId: req.user?.id,
          subject: { $regex: new RegExp(subject, 'i') },
          status: 'published',
        });
        for (const path of paths) {
          const needsRevisionNode = !path.nodes.some((n) => n.status === 'active' && n.tier === 'revision');
          if (needsRevisionNode) {
            const nextLocked = path.nodes.find((n) => n.status === 'locked');
            if (nextLocked) {
              nextLocked.status = 'active';
              nextLocked.tier = 'revision';
              await path.save();
            }
          }
        }
      } catch (_) {}
    });

    return res.json({ success: true, data: revisionItems });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
