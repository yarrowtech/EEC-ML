const express = require('express');
const router = express.Router();
const axios = require('axios');
const authStudent = require('../middleware/authStudent');
const StudentUser = require('../models/StudentUser');
const TeachingMaterial = require('../models/TeachingMaterial');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const ALLOWED_MODES = ['explain', 'summarize', 'quiz', 'homework_help', 'notes', 'mind_map', 'flashcards'];

const normalizeString = (value) => String(value || '').trim();
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

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

    let materials = [];
    if (normalizedTopic) {
      const materialFilter = {
        schoolId,
        status: 'published',
        publishedForStudentPortal: true,
        topicTitle: { $regex: `^${escapeRegex(normalizedTopic)}$`, $options: 'i' },
      };
      if (campusId) materialFilter.campusId = campusId;
      if (student.classId) materialFilter.classId = student.classId;
      if (student.sectionId) materialFilter.sectionId = student.sectionId;
      if (normalizeString(subject)) {
        materialFilter.subjectName = { $regex: `^${escapeRegex(normalizeString(subject))}$`, $options: 'i' };
      }
      if (normalizeString(subTopic)) {
        materialFilter.subTopicTitle = { $regex: `^${escapeRegex(normalizeString(subTopic))}$`, $options: 'i' };
      }
      materials = await TeachingMaterial.find(materialFilter).limit(5).lean();
    }
    const context = materials.map((item) => stripHtml(item.content)).filter(Boolean).join('\n\n');

    const aiResponse = await axios.post(`${AI_SERVICE_URL}/generate/tutor`, {
      mode: normalizedMode,
      subject: normalizeString(subject) || 'General Knowledge',
      topic: normalizedTopic || normalizedQuestion,
      subTopic: normalizeString(subTopic) || null,
      gradeLevel: student.grade ? `Grade ${student.grade}` : null,
      context,
      question: normalizeString(question) || null,
    }, { timeout: 60000 });

    return res.json({
      success: true,
      data: {
        content: aiResponse.data?.content || '',
        model: aiResponse.data?.model,
        groundedInMaterial: aiResponse.data?.groundedInMaterial || false,
        sourceMaterialCount: materials.length,
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
