const express = require('express');
const router = express.Router();
const axios = require('axios');
const authStudent = require('../middleware/authStudent');
const StudentUser = require('../models/StudentUser');
const TeachingMaterial = require('../models/TeachingMaterial');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const ALLOWED_MODES = ['explain', 'summarize', 'quiz', 'homework_help', 'notes', 'mind_map', 'flashcards'];

const MAX_MATERIALS = 50;
const MAX_CANDIDATES = 150;

const normalizeString = (value) => String(value || '').trim();
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// Splits a material's HTML content into small, independently-rankable chunks for retrieval.
// Most content is authored as <li> bullet points (see buildMaterialContent in lessonPlanRoutes.js),
// so each bullet becomes its own candidate; anything else falls back to one chunk per material.
const extractChunks = (material) => {
  const html = String(material.content || '');
  const liItems = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
  if (liItems.length) {
    return liItems.map((text, index) => ({ id: `${material._id}-li-${index}`, text }));
  }
  const whole = stripHtml(html);
  return whole ? [{ id: `${material._id}-full`, text: whole }] : [];
};

router.post('/generate', authStudent, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const campusId = req.campusId;
    const studentId = req.user?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const { subject, topic, subTopic, mode, question } = req.body || {};
    const normalizedMode = normalizeString(mode);
    if (!ALLOWED_MODES.includes(normalizedMode)) {
      return res.status(400).json({ error: `mode must be one of: ${ALLOWED_MODES.join(', ')}` });
    }
    const normalizedTopic = normalizeString(topic);
    const normalizedQuestion = normalizeString(question);
    if (!normalizedTopic && !normalizedQuestion) {
      return res.status(400).json({ error: 'topic or question is required' });
    }

    const studentFilter = { _id: studentId, schoolId };
    if (campusId) studentFilter.campusId = campusId;
    const student = await StudentUser.findOne(studentFilter).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Scope is a hard multi-tenancy/privacy boundary: school, campus, and the student's own
    // class/section. Subject is an optional narrowing filter if the student picked one in the UI;
    // topic is deliberately NOT filtered here — relevance to the actual question is decided by
    // embedding similarity in the ai-service, not by an exact topicTitle string match.
    const materialFilter = {
      schoolId,
      status: 'published',
      publishedForStudentPortal: true,
    };
    if (campusId) materialFilter.campusId = campusId;
    if (student.classId) materialFilter.classId = student.classId;
    if (student.sectionId) materialFilter.sectionId = student.sectionId;
    if (normalizeString(subject)) {
      materialFilter.subjectName = { $regex: `^${escapeRegex(normalizeString(subject))}$`, $options: 'i' };
    }

    const materials = await TeachingMaterial.find(materialFilter).limit(MAX_MATERIALS).lean();
    const candidates = materials.flatMap(extractChunks).slice(0, MAX_CANDIDATES);

    const aiResponse = await axios.post(`${AI_SERVICE_URL}/generate/tutor`, {
      mode: normalizedMode,
      subject: normalizeString(subject) || 'General Knowledge',
      topic: normalizedTopic || normalizedQuestion,
      subTopic: normalizeString(subTopic) || null,
      gradeLevel: student.grade ? `Grade ${student.grade}` : null,
      question: normalizeString(question) || null,
      candidates,
    }, { timeout: 60000 });

    return res.json({
      success: true,
      data: {
        content: aiResponse.data?.content || '',
        model: aiResponse.data?.model,
        groundedInMaterial: aiResponse.data?.groundedInMaterial || false,
        noMaterialFound: aiResponse.data?.noMaterialFound || false,
        sourceMaterialCount: materials.length,
        candidateChunkCount: candidates.length,
      },
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    }
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
