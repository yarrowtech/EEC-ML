const express = require('express');
const router = express.Router();
const axios = require('axios');
const WritingPrompt = require('../models/WritingPrompt');
const WritingAssessment = require('../models/WritingAssessment');
const StudentLanguageProfile = require('../models/StudentLanguageProfile');
const authTeacher = require('../middleware/authTeacher');
const authStudent = require('../middleware/authStudent');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ─── Teacher: writing prompt CRUD ────────────────────────────────────────────

router.post('/teacher/prompts', authTeacher, async (req, res) => {
  try {
    const { title, promptType, question, instructions, difficulty, wordLimit, subject, chapter, classId, sectionId, isPublished } = req.body;
    if (!title || !promptType || !question) {
      return res.status(400).json({ success: false, message: 'title, promptType, and question are required' });
    }
    const prompt = await WritingPrompt.create({
      title,
      promptType,
      question,
      instructions: instructions || '',
      difficulty: difficulty || 'medium',
      wordLimit: wordLimit || 0,
      subject,
      chapter,
      classId,
      sectionId,
      isPublished: Boolean(isPublished),
      teacherId: req.teacher?.id || req.userId,
      schoolId: req.schoolId,
      campusId: req.campusId,
    });
    res.status(201).json({ success: true, data: prompt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/teacher/prompts', authTeacher, async (req, res) => {
  try {
    const prompts = await WritingPrompt.find({ schoolId: req.schoolId, campusId: req.campusId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: prompts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/teacher/prompts/:id', authTeacher, async (req, res) => {
  try {
    const prompt = await WritingPrompt.findOneAndUpdate(
      { _id: req.params.id, campusId: req.campusId },
      req.body,
      { new: true }
    );
    if (!prompt) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: prompt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/teacher/prompts/:id', authTeacher, async (req, res) => {
  try {
    await WritingPrompt.findOneAndDelete({ _id: req.params.id, campusId: req.campusId });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Teacher: view all submissions for a prompt
router.get('/teacher/assessments/:promptId', authTeacher, async (req, res) => {
  try {
    const { sort = 'latest' } = req.query;
    const sortMap = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { 'scores.overall': -1 },
      lowest: { 'scores.overall': 1 },
    };
    const assessments = await WritingAssessment.find({
      promptId: req.params.promptId,
      schoolId: req.schoolId,
    })
      .populate('studentId', 'firstName lastName rollNumber')
      .populate('promptId', 'title promptType difficulty')
      .sort(sortMap[sort] || sortMap.latest)
      .lean();
    res.json({ success: true, data: assessments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/teacher/all-assessments', authTeacher, async (req, res) => {
  try {
    const { sort = 'latest', promptId } = req.query;
    const sortMap = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { 'scores.overall': -1 },
      lowest: { 'scores.overall': 1 },
    };
    const filter = { schoolId: req.schoolId };
    if (promptId) filter.promptId = promptId;

    const assessments = await WritingAssessment.find(filter)
      .populate('studentId', 'firstName lastName rollNumber classId sectionId')
      .populate('promptId', 'title promptType difficulty subject chapter')
      .sort(sortMap[sort] || sortMap.latest)
      .limit(200)
      .lean();

    res.json({ success: true, data: assessments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Student: browse available prompts ───────────────────────────────────────

router.get('/student/prompts', authStudent, async (req, res) => {
  try {
    const prompts = await WritingPrompt.find({
      schoolId: req.schoolId,
      campusId: req.campusId,
      isPublished: true,
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: prompts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Student: submit writing for evaluation ───────────────────────────────────

router.post('/student/evaluate', authStudent, async (req, res) => {
  try {
    const { promptId, submission } = req.body;
    if (!promptId || !submission) {
      return res.status(400).json({ success: false, message: 'promptId and submission are required' });
    }

    const prompt = await WritingPrompt.findById(promptId).lean();
    if (!prompt) return res.status(404).json({ success: false, message: 'Prompt not found' });

    const wordCount = submission.trim().split(/\s+/).filter(Boolean).length;
    const characterCount = submission.length;

    const assessment = await WritingAssessment.create({
      studentId: req.userId,
      promptId,
      schoolId: req.schoolId,
      campusId: req.campusId,
      submission,
      wordCount,
      characterCount,
      status: 'processing',
    });

    // Retrieve adaptive memory
    let previousHistory = [];
    try {
      const memoryResp = await axios.post(
        `${AI_SERVICE_URL}/memory/retrieve`,
        { student_id: String(req.userId), mode: 'writing', limit: 3 },
        { timeout: 10_000 }
      );
      previousHistory = memoryResp.data?.results || [];
    } catch {
      // Non-fatal
    }

    const evalResp = await axios.post(
      `${AI_SERVICE_URL}/writing/evaluate`,
      {
        submission,
        prompt_question: prompt.question,
        prompt_type: prompt.promptType,
        difficulty: prompt.difficulty,
        student_id: String(req.userId),
        assessment_id: String(assessment._id),
        previous_history: previousHistory,
      },
      { timeout: 120_000 }
    );

    const result = evalResp.data;

    const updated = await WritingAssessment.findByIdAndUpdate(
      assessment._id,
      {
        scores: {
          overall: result.overall || 0,
          grammar: result.grammar || 0,
          vocabulary: result.vocabulary || 0,
          tone: result.tone || 0,
          coherence: result.coherence || 0,
          verb_tense: result.verb_tense || 0,
          sentence_structure: result.sentence_structure || 0,
          creativity: result.creativity || 0,
        },
        suggestions: result.suggestions || [],
        corrections: result.corrections || [],
        improvedVersion: result.improved_version || '',
        cefrLevel: result.cefr_level || '',
        strengths: result.strengths || [],
        weaknesses: result.weaknesses || [],
        rawEvaluation: result,
        status: 'completed',
      },
      { new: true }
    );

    // Store embedding (fire-and-forget)
    axios
      .post(
        `${AI_SERVICE_URL}/memory/store`,
        {
          student_id: String(req.userId),
          school_id: String(req.schoolId),
          assessment_id: String(assessment._id),
          mode: 'writing',
          content: submission,
          metadata: {
            overall: result.overall,
            weaknesses: result.weaknesses || [],
            grammar_errors: result.corrections?.map((c) => c.type) || [],
            cefr_level: result.cefr_level,
            prompt_title: prompt.title,
          },
        },
        { timeout: 30_000 }
      )
      .catch(() => {});

    _updateLanguageProfile(req.userId, req.schoolId, req.campusId, updated).catch(() => {});

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[WritingAssessment] evaluate error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Student: autosave draft ──────────────────────────────────────────────────

router.post('/student/autosave', authStudent, async (req, res) => {
  try {
    const { promptId, draft } = req.body;
    // Just acknowledge — drafts are managed client-side in localStorage
    res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Student: history ────────────────────────────────────────────────────────

router.get('/student/history', authStudent, async (req, res) => {
  try {
    const assessments = await WritingAssessment.find({
      studentId: req.userId,
      status: 'completed',
    })
      .populate('promptId', 'title promptType difficulty subject chapter')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, data: assessments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/student/assessments/:id', authStudent, async (req, res) => {
  try {
    const assessment = await WritingAssessment.findOne({
      _id: req.params.id,
      studentId: req.userId,
    })
      .populate('promptId')
      .lean();
    if (!assessment) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: assessment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Student: language profile ────────────────────────────────────────────────

router.get('/student/language-profile', authStudent, async (req, res) => {
  try {
    const profile = await StudentLanguageProfile.findOne({ studentId: req.userId }).lean();
    res.json({ success: true, data: profile || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Helper ──────────────────────────────────────────────────────────────────

async function _updateLanguageProfile(studentId, schoolId, campusId, assessment) {
  const existing = await StudentLanguageProfile.findOne({ studentId }).lean() || {};
  const writingStats = existing.writing || {};
  const prevTotal = writingStats.totalAttempts || 0;
  const newTotal = prevTotal + 1;
  const avg = (prev, cur) => Math.round(((prev || 0) * prevTotal + (cur || 0)) / newTotal);

  await StudentLanguageProfile.findOneAndUpdate(
    { studentId },
    {
      studentId,
      schoolId,
      campusId,
      $set: {
        'writing.averageOverall': avg(writingStats.averageOverall, assessment.scores?.overall),
        'writing.averageGrammar': avg(writingStats.averageGrammar, assessment.scores?.grammar),
        'writing.averageVocabulary': avg(writingStats.averageVocabulary, assessment.scores?.vocabulary),
        'writing.averageCoherence': avg(writingStats.averageCoherence, assessment.scores?.coherence),
        'writing.totalAttempts': newTotal,
        'writing.cefrLevel': assessment.cefrLevel || writingStats.cefrLevel || 'A1',
        lastUpdated: new Date(),
      },
    },
    { upsert: true, new: true }
  );
}

module.exports = router;
