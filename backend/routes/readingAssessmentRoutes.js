const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const axios = require('axios');
const ReadingMaterial = require('../models/ReadingMaterial');
const ReadingAssessment = require('../models/ReadingAssessment');
const StudentLanguageProfile = require('../models/StudentLanguageProfile');
const authTeacher = require('../middleware/authTeacher');
const authStudent = require('../middleware/authStudent');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Audio stored in memory and forwarded directly to AI service
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Teacher: reading material CRUD ──────────────────────────────────────────

router.post('/teacher/materials', authTeacher, async (req, res) => {
  try {
    const { title, contentType, content, difficulty, subject, chapter, classId, sectionId, tags, isPublished } = req.body;
    if (!title || !contentType || !content) {
      return res.status(400).json({ success: false, message: 'title, contentType, and content are required' });
    }
    const words = content.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const estimatedReadingTime = Math.ceil(wordCount / 200); // avg reading speed 200 wpm

    const material = await ReadingMaterial.create({
      title,
      contentType,
      content,
      difficulty: difficulty || 'medium',
      subject,
      chapter,
      classId,
      sectionId,
      tags: tags || [],
      wordCount,
      estimatedReadingTime,
      isPublished: Boolean(isPublished),
      teacherId: req.teacher?.id || req.userId,
      schoolId: req.schoolId,
      campusId: req.campusId,
    });

    res.status(201).json({ success: true, data: material });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/teacher/materials', authTeacher, async (req, res) => {
  try {
    const query = { schoolId: req.schoolId, campusId: req.campusId };
    const materials = await ReadingMaterial.find(query)
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: materials });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/teacher/materials/:id', authTeacher, async (req, res) => {
  try {
    const { content, ...rest } = req.body;
    const update = { ...rest };
    if (content) {
      const words = content.trim().split(/\s+/).filter(Boolean);
      update.content = content;
      update.wordCount = words.length;
      update.estimatedReadingTime = Math.ceil(words.length / 200);
    }
    const material = await ReadingMaterial.findOneAndUpdate(
      { _id: req.params.id, campusId: req.campusId },
      update,
      { new: true }
    );
    if (!material) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: material });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/teacher/materials/:id', authTeacher, async (req, res) => {
  try {
    await ReadingMaterial.findOneAndDelete({ _id: req.params.id, campusId: req.campusId });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Teacher: view all assessments for a material
router.get('/teacher/assessments/:materialId', authTeacher, async (req, res) => {
  try {
    const { sort = 'latest' } = req.query;
    const sortMap = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { 'scores.overall': -1 },
      lowest: { 'scores.overall': 1 },
    };
    const assessments = await ReadingAssessment.find({
      materialId: req.params.materialId,
      schoolId: req.schoolId,
    })
      .populate('studentId', 'firstName lastName rollNumber')
      .populate('materialId', 'title contentType difficulty')
      .sort(sortMap[sort] || sortMap.latest)
      .lean();
    res.json({ success: true, data: assessments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Teacher: all assessments across all materials (for dashboard)
router.get('/teacher/all-assessments', authTeacher, async (req, res) => {
  try {
    const { sort = 'latest', materialId, classId } = req.query;
    const sortMap = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { 'scores.overall': -1 },
      lowest: { 'scores.overall': 1 },
    };
    const filter = { schoolId: req.schoolId };
    if (materialId) filter.materialId = materialId;

    const assessments = await ReadingAssessment.find(filter)
      .populate('studentId', 'firstName lastName rollNumber classId sectionId')
      .populate('materialId', 'title contentType difficulty subject chapter classId sectionId')
      .sort(sortMap[sort] || sortMap.latest)
      .limit(200)
      .lean();

    res.json({ success: true, data: assessments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Student: browse available materials ─────────────────────────────────────

router.get('/student/materials', authStudent, async (req, res) => {
  try {
    const materials = await ReadingMaterial.find({
      schoolId: req.schoolId,
      campusId: req.campusId,
      isPublished: true,
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: materials });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/student/materials/:id', authStudent, async (req, res) => {
  try {
    const material = await ReadingMaterial.findOne({
      _id: req.params.id,
      isPublished: true,
    }).lean();
    if (!material) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: material });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Student: submit audio for evaluation ────────────────────────────────────

router.post('/student/evaluate', authStudent, upload.single('audio'), async (req, res) => {
  try {
    const { materialId, audioDurationSeconds } = req.body;
    if (!materialId) return res.status(400).json({ success: false, message: 'materialId is required' });
    if (!req.file) return res.status(400).json({ success: false, message: 'audio file is required' });

    const material = await ReadingMaterial.findById(materialId).lean();
    if (!material) return res.status(404).json({ success: false, message: 'Material not found' });

    // Create pending assessment record
    const assessment = await ReadingAssessment.create({
      studentId: req.userId,
      materialId,
      schoolId: req.schoolId,
      campusId: req.campusId,
      audioDurationSeconds: Number(audioDurationSeconds) || 0,
      status: 'processing',
    });

    // Retrieve adaptive memory for personalized feedback
    let previousHistory = [];
    try {
      const memoryResp = await axios.post(
        `${AI_SERVICE_URL}/memory/retrieve`,
        { student_id: String(req.userId), mode: 'reading', limit: 3 },
        { timeout: 10_000 }
      );
      previousHistory = memoryResp.data?.results || [];
    } catch {
      // Non-fatal: proceed without history
    }

    // Forward audio to AI service for transcription + evaluation
    const FormData = require('form-data');
    const form = new FormData();
    form.append('audio', req.file.buffer, {
      filename: req.file.originalname || 'recording.webm',
      contentType: req.file.mimetype || 'audio/webm',
    });
    form.append('reference_text', material.content);
    form.append('student_id', String(req.userId));
    form.append('assessment_id', String(assessment._id));
    form.append('previous_history', JSON.stringify(previousHistory));

    const evalResp = await axios.post(`${AI_SERVICE_URL}/reading/evaluate`, form, {
      headers: form.getHeaders(),
      timeout: 180_000,
      maxBodyLength: Infinity,
    });

    const result = evalResp.data;

    // Persist evaluation
    const updated = await ReadingAssessment.findByIdAndUpdate(
      assessment._id,
      {
        transcript: result.transcript || '',
        scores: {
          overall: result.overall || 0,
          pronunciation: result.pronunciation || 0,
          grammar: result.grammar || 0,
          fluency: result.fluency || 0,
          confidence: result.confidence || 0,
          accent: result.accent || 0,
          reading_speed: result.reading_speed || 0,
        },
        mispronounced_words: result.mispronounced_words || [],
        missed_words: result.missed_words || [],
        extra_words: result.extra_words || [],
        suggestions: result.suggestions || [],
        strengths: result.strengths || [],
        weaknesses: result.weaknesses || [],
        rawEvaluation: result,
        status: 'completed',
      },
      { new: true }
    );

    // Store embedding in Qdrant for adaptive memory (fire-and-forget)
    axios
      .post(
        `${AI_SERVICE_URL}/memory/store`,
        {
          student_id: String(req.userId),
          school_id: String(req.schoolId),
          assessment_id: String(assessment._id),
          mode: 'reading',
          content: result.transcript || '',
          metadata: {
            overall: result.overall,
            weaknesses: result.weaknesses || [],
            mispronounced_words: result.mispronounced_words || [],
            missed_words: result.missed_words || [],
            reading_speed: result.reading_speed,
            material_title: material.title,
          },
        },
        { timeout: 30_000 }
      )
      .catch(() => {});

    // Update student language profile (fire-and-forget)
    _updateLanguageProfile(req.userId, req.schoolId, req.campusId, 'reading', updated).catch(() => {});

    res.json({ success: true, data: updated });
  } catch (err) {
    const detail = err.response?.data?.detail || err.response?.data || err.message;
    console.error('[ReadingAssessment] evaluate error:', JSON.stringify(detail));
    res.status(500).json({ success: false, message: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  }
});

// ─── Student: history ────────────────────────────────────────────────────────

router.get('/student/history', authStudent, async (req, res) => {
  try {
    const assessments = await ReadingAssessment.find({
      studentId: req.userId,
      status: 'completed',
    })
      .populate('materialId', 'title contentType difficulty subject chapter')
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
    const assessment = await ReadingAssessment.findOne({
      _id: req.params.id,
      studentId: req.userId,
    })
      .populate('materialId', 'title contentType difficulty subject chapter content wordCount estimatedReadingTime')
      .lean();
    if (!assessment) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: assessment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Helper: update language profile after assessment ────────────────────────

async function _updateLanguageProfile(studentId, schoolId, campusId, mode, assessment) {
  const existing = await StudentLanguageProfile.findOne({ studentId }) || {};
  const readingStats = existing.reading || {};

  const prevTotal = readingStats.totalAttempts || 0;
  const newTotal = prevTotal + 1;
  const avg = (prev, cur) => Math.round(((prev || 0) * prevTotal + (cur || 0)) / newTotal);

  await StudentLanguageProfile.findOneAndUpdate(
    { studentId },
    {
      studentId,
      schoolId,
      campusId,
      $set: {
        'reading.averageOverall': avg(readingStats.averageOverall, assessment.scores?.overall),
        'reading.averagePronunciation': avg(readingStats.averagePronunciation, assessment.scores?.pronunciation),
        'reading.averageFluency': avg(readingStats.averageFluency, assessment.scores?.fluency),
        'reading.averageConfidence': avg(readingStats.averageConfidence, assessment.scores?.confidence),
        'reading.averageSpeed': avg(readingStats.averageSpeed, assessment.scores?.reading_speed),
        'reading.totalAttempts': newTotal,
        lastUpdated: new Date(),
      },
    },
    { upsert: true, new: true }
  );
}

module.exports = router;
