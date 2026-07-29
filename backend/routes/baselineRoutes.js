/**
 * Baseline Quiz Routes
 *
 * Teacher endpoints (authTeacher):
 *   POST   /api/baseline/generate       — AI generates MCQs, saves draft
 *   PUT    /api/baseline/:quizId/publish — publish so students see it
 *   GET    /api/baseline/teacher        — list teacher's baseline quizzes
 *
 * Student endpoints (authStudent):
 *   GET    /api/baseline/pending        — list subjects that need baseline
 *   GET    /api/baseline/:quizId        — fetch quiz questions (no answers)
 *   POST   /api/baseline/:quizId/submit — submit answers → score → mastery bootstrap
 */

const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const authTeacher = require('../middleware/authTeacher');
const authStudent = require('../middleware/authStudent');
const BaselineQuiz   = require('../models/BaselineQuiz');
const BaselineResult = require('../models/BaselineResult');
const MasteryScore   = require('../models/MasteryScore');
const { BASELINE, MASTERY } = require('../config/workflowThresholds');
const { runWorkflowTriggers } = require('../services/masteryEngine');
const { TeacherLearningPath } = (() => {
  try { return { TeacherLearningPath: require('../models/TeacherLearningPath') }; }
  catch (_) { return { TeacherLearningPath: null }; }
})();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseQuestionsFromAI(text) {
  // Parses "1. Question\nA) ...\nB) ...\nC) ...\nD) ...\nAnswer: B" format
  const blocks = text.split(/\n(?=\d+\.\s)/).map((b) => b.trim()).filter(Boolean);
  const questions = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const qLine = lines[0]?.replace(/^\d+\.\s*/, '') || '';
    const optLines = lines.filter((l) => /^[A-D][).]\s/.test(l));
    const answerLine = lines.find((l) => /^Answer\s*:/i.test(l)) || '';
    const answerLetter = (answerLine.match(/Answer\s*:\s*([A-D])/i) || [])[1]?.toUpperCase();

    if (!qLine || optLines.length < 2) continue;

    const options = optLines.map((opt) => {
      const letter = opt[0].toUpperCase();
      const text = opt.replace(/^[A-D][).]\s*/, '').trim();
      return { text, isCorrect: letter === answerLetter };
    });

    questions.push({ questionText: qLine, options, marks: 1 });
  }

  return questions;
}

// ── Teacher: generate AI baseline questions ───────────────────────────────────
router.post('/generate', authTeacher, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    const schoolId  = req.schoolId;
    if (!teacherId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const { subject, className, section = '', topic = '' } = req.body || {};
    if (!subject || !className) {
      return res.status(400).json({ error: 'subject and className are required' });
    }

    const n = BASELINE.QUESTIONS_PER_SUBJECT;
    const prompt = `Generate exactly ${n} multiple-choice baseline assessment questions for ${subject} (${className}${section ? ' ' + section : ''})${topic ? ', topic: ' + topic : ''}.

Format STRICTLY as:
1. Question text
A) Option A
B) Option B
C) Option C
D) Option D
Answer: A

Test foundational knowledge appropriate for ${className} students. Vary Bloom's levels across questions.`;

    let rawText = '';
    try {
      const aiResp = await axios.post(`${AI_SERVICE_URL}/generate/teacher`, {
        prompt,
        mode: 'quiz_generate',
        subject,
        context: '',
      }, { timeout: 60000 });
      rawText = aiResp.data?.response || aiResp.data?.content || '';
    } catch (aiErr) {
      return res.status(502).json({ error: 'AI service unavailable', detail: aiErr.message });
    }

    const questions = parseQuestionsFromAI(rawText);
    if (!questions.length) {
      return res.status(422).json({ error: 'AI did not return parseable questions', raw: rawText.slice(0, 500) });
    }

    // Upsert (teacher can regenerate)
    const quiz = await BaselineQuiz.findOneAndUpdate(
      { schoolId, subject, className, section },
      {
        $set: {
          teacherId,
          questions,
          status: 'draft',
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, data: quiz });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Teacher: publish baseline quiz ────────────────────────────────────────────
router.put('/:quizId/publish', authTeacher, async (req, res) => {
  try {
    const quiz = await BaselineQuiz.findOneAndUpdate(
      { _id: req.params.quizId, schoolId: req.schoolId },
      { $set: { status: 'published' } },
      { new: true }
    );
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    return res.json({ success: true, data: quiz });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Teacher: list their baseline quizzes ──────────────────────────────────────
router.get('/teacher', authTeacher, async (req, res) => {
  try {
    const quizzes = await BaselineQuiz.find({
      schoolId: req.schoolId,
      teacherId: req.user?.id,
    }).sort({ updatedAt: -1 }).lean();
    return res.json({ success: true, data: quizzes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Student: pending baselines ────────────────────────────────────────────────
router.get('/pending', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId  = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const StudentUser = require('../models/StudentUser');
    const student = await StudentUser.findById(studentId).select('grade section').lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // All published quizzes for this class/section
    const published = await BaselineQuiz.find({
      schoolId,
      className: student.grade,
      section: { $in: [student.section, ''] },
      status: 'published',
    }).select('_id subject').lean();

    if (!published.length) return res.json({ success: true, data: [] });

    // Filter out already-completed ones
    const completedIds = (await BaselineResult.find({
      studentId,
      quizId: { $in: published.map((q) => q._id) },
    }).select('quizId').lean()).map((r) => String(r.quizId));

    const pending = published.filter((q) => !completedIds.includes(String(q._id)));
    return res.json({ success: true, data: pending });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Student: fetch quiz (answers hidden) ──────────────────────────────────────
router.get('/:quizId', authStudent, async (req, res) => {
  try {
    const quiz = await BaselineQuiz.findOne({
      _id: req.params.quizId,
      schoolId: req.schoolId,
      status: 'published',
    }).lean();
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    // Strip correct answer flags before sending to student
    const sanitized = quiz.questions.map((q) => ({
      questionText: q.questionText,
      options: q.options.map((o) => ({ text: o.text })),
      marks: q.marks,
    }));

    return res.json({ success: true, data: { ...quiz, questions: sanitized } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Student: submit answers ───────────────────────────────────────────────────
router.post('/:quizId/submit', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId  = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const quiz = await BaselineQuiz.findOne({
      _id: req.params.quizId,
      schoolId,
      status: 'published',
    }).lean();
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const alreadyDone = await BaselineResult.exists({ studentId, quizId: quiz._id });
    if (alreadyDone) return res.status(409).json({ error: 'Baseline already completed for this quiz' });

    // answers = [{ questionIdx, chosen }] — chosen is 0-based index of selected option
    const { answers = [] } = req.body || {};

    let correct = 0;
    const gradedAnswers = quiz.questions.map((q, idx) => {
      const submitted = answers.find((a) => a.questionIdx === idx);
      const chosenIdx  = submitted?.chosen ?? -1;
      const isCorrect  = chosenIdx >= 0 && q.options[chosenIdx]?.isCorrect === true;
      if (isCorrect) correct++;
      return { questionIdx: idx, chosen: chosenIdx, correct: isCorrect };
    });

    const totalMarks = quiz.questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const score = totalMarks > 0 ? Math.round((correct / totalMarks) * 100) : 0;

    await BaselineResult.create({
      studentId,
      schoolId,
      quizId: quiz._id,
      subject: quiz.subject,
      score,
      answers: gradedAnswers,
      completedAt: new Date(),
    });

    // Bootstrap mastery score for this subject
    const topicId = quiz.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const masteryDoc = await MasteryScore.findOneAndUpdate(
      { studentId, subject: quiz.subject, topicId },
      {
        $set:  { schoolId, topicTitle: quiz.subject, chapterTitle: 'Baseline', lastUpdated: new Date() },
        $setOnInsert: { attemptCount: 1, score },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Only set score from baseline if no previous attempts exist
    if (masteryDoc.attemptCount <= 1) {
      masteryDoc.score = score;
      await masteryDoc.save();
    }

    // Fire all workflow triggers (badge, unlock, teacher alert, spaced rep)
    runWorkflowTriggers({
      studentId,
      schoolId,
      subject: quiz.subject,
      topicId,
      topicTitle: quiz.subject,
      chapterTitle: 'Baseline',
      score,
      attemptCount: masteryDoc.attemptCount,
    });

    return res.json({
      success: true,
      data: {
        score,
        correct,
        total: quiz.questions.length,
        masteryLevel: score >= MASTERY.HIGH ? 'mastered'
          : score >= MASTERY.MID ? 'proficient'
          : score >= MASTERY.LOW ? 'developing'
          : score >= MASTERY.CRITICAL ? 'basic'
          : 'foundational',
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
