/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const mongoose = require('mongoose');
const authStudent = require('../middleware/authStudent');
const authTeacher = require('../middleware/authTeacher');
const StudentUser = require('../models/StudentUser');
const TeachingMaterial = require('../models/TeachingMaterial');
const LessonPlan = require('../models/LessonPlan');
const { buildStudentContext } = require('../utils/studentContextBuilder');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const ALLOWED_MODES = ['custom', 'explain', 'visual_explain', 'summarize', 'quiz', 'visual_quiz', 'homework_help', 'notes', 'mind_map', 'flashcards', 'misconception', 'real_world', 'practice_basic', 'practice_intermediate', 'practice_advanced', 'engagement_swap', 'exam_explanation', 'exam_feedback', 'assignment_feedback', 'at_risk_summary'];

const MAX_MATERIALS = 50;
const SUPPORTED_VECTOR_EXTENSIONS = new Set(['pdf', 'docx', 'pptx']);

const normalizeString = (value) => String(value || '').trim();
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeLookup = (value) => normalizeString(value).toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');

const GENERIC_TEXTBOOK_SECTION_TITLES = new Set([
  'let us recite',
  'let us read',
  'let us speak',
  'let us listen',
  'let us write',
  'let us learn',
  'let us do',
  'let us think',
  'let us discuss',
  'new words',
  'word meaning',
  'word meanings',
  'tasks to do',
  'activity',
  'activities',
  'exercise',
  'exercises',
  'grammar',
  'vocabulary',
  'reading',
  'writing',
  'speaking',
  'listening',
]);

const isGenericTextbookSectionTitle = (value) => {
  const normalized = normalizeLookup(value);
  if (!normalized) return false;
  if (GENERIC_TEXTBOOK_SECTION_TITLES.has(normalized)) return true;
  return /^(let us|listen and|read and|think and|look at|complete the|fill in|answer the)\b/.test(normalized);
};

const resolveChapterTitleForRag = ({ requestedChapterTitle, topic, subTopic, materials }) => {
  const requested = normalizeString(requestedChapterTitle);
  const normalizedTopic = normalizeLookup(topic);
  const normalizedSubTopic = normalizeLookup(subTopic);
  const requestedLooksUnsafe = !requested
    || normalizeLookup(requested) === normalizedTopic
    || isGenericTextbookSectionTitle(requested);

  if (!requestedLooksUnsafe) return requested;

  const matchingMaterial = (materials || []).find((material) => {
    const materialChapter = normalizeString(material.chapterTitle);
    if (!materialChapter || isGenericTextbookSectionTitle(materialChapter)) return false;
    const candidates = [
      material.chapterTitle,
      material.topicTitle,
      material.subTopicTitle,
      material.title,
      material.typeLabel,
    ].map(normalizeLookup).filter(Boolean);
    return candidates.includes(normalizedTopic) || (normalizedSubTopic && candidates.includes(normalizedSubTopic));
  });

  if (matchingMaterial?.chapterTitle) {
    return normalizeString(matchingMaterial.chapterTitle);
  }

  return requestedLooksUnsafe ? null : requested;
};

const getAttachmentExtension = (attachment) => {
  const type = normalizeString(attachment?.type).toLowerCase();
  const name = normalizeString(attachment?.name).toLowerCase();
  const fromName = name.includes('.') ? name.split('.').pop() : '';
  if (fromName) return fromName;
  if (type.includes('pdf')) return 'pdf';
  if (type.includes('docx') || type.includes('word')) return 'docx';
  if (type.includes('pptx') || type.includes('powerpoint') || type.includes('presentation')) return 'pptx';
  return type;
};

const isVectorIngestible = (attachment) =>
  Boolean(attachment?.url) && SUPPORTED_VECTOR_EXTENSIONS.has(getAttachmentExtension(attachment));

const buildSourceId = (material, attachment, index) => {
  const stableAttachmentId = attachment.cloudinaryPublicId || attachment.url || attachment.name || index;
  return `${String(material._id)}:${String(stableAttachmentId)}`;
};

const ingestMaterialAttachments = async (material) => {
  const attachments = Array.isArray(material.attachments) ? material.attachments.filter(isVectorIngestible) : [];
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    await axios.post(
      `${AI_SERVICE_URL}/ingest/material`,
      {
        url: attachment.url,
        material_id: String(material._id),
        source_id: buildSourceId(material, attachment, index),
        file_name: attachment.name || '',
        content_type: attachment.type || '',
        replace_existing: index === 0,
        school_id: String(material.schoolId),
        class_id: String(material.classId || ''),
        section_id: String(material.sectionId || ''),
        academic_year_id: String(material.academicYearId || ''),
        subject_id: String(material.subjectId || ''),
        subject_name: material.subjectName || '',
        curriculum_code: material.curriculumCode || '',
        chapter_id: material.chapterId || '',
        chapter_title: material.chapterTitle || '',
        topic_title: material.topicTitle || '',
      },
      { timeout: 300_000 }
    );
  }
  return attachments.length;
};

const ensureMaterialsIndexed = async (materials) => {
  let indexedAttachmentCount = 0;
  for (const material of materials) {
    indexedAttachmentCount += await ingestMaterialAttachments(material);
  }
  return indexedAttachmentCount;
};

router.get('/source-page', authStudent, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const campusId = req.campusId;
    const studentId = req.user?.id;
    const materialId = normalizeString(req.query?.materialId);
    const pageNumber = Number(req.query?.page);
    if (!schoolId || !studentId) return res.status(401).json({ error: 'Unauthorized' });
    if (!mongoose.Types.ObjectId.isValid(materialId) || !Number.isInteger(pageNumber) || pageNumber < 1) {
      return res.status(400).json({ error: 'materialId and a positive page number are required' });
    }

    const studentFilter = { _id: studentId, schoolId };
    if (campusId) studentFilter.campusId = campusId;
    const student = await StudentUser.findOne(studentFilter).select('classId sectionId').lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const materialFilter = {
      _id: materialId,
      schoolId,
      status: 'published',
      publishedForStudentPortal: true,
    };
    if (campusId) {
      materialFilter.$or = [
        { campusId },
        { campusId: null },
        { campusId: { $exists: false } },
      ];
    }
    if (student.classId) materialFilter.classId = student.classId;
    if (student.sectionId) materialFilter.sectionId = student.sectionId;
    const material = await TeachingMaterial.findOne(materialFilter).select('_id').lean();
    if (!material) return res.status(404).json({ error: 'Published material not found for this student' });

    const pageResponse = await axios.post(
      `${AI_SERVICE_URL}/ingest/material-page`,
      {
        material_id: materialId,
        page_number: pageNumber,
        school_id: String(schoolId),
        class_id: String(student.classId || ''),
        section_id: String(student.sectionId || ''),
      },
      { responseType: 'arraybuffer', timeout: 60_000 }
    );
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'private, max-age=300');
    return res.send(pageResponse.data);
  } catch (err) {
    const status = err?.response?.status === 404 ? 404 : 502;
    return res.status(status).json({ error: 'Unable to render the cited material page' });
  }
});

router.post('/generate', authStudent, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const campusId = req.campusId;
    const studentId = req.user?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const { subject, topic, subTopic, mode, question, chapterTitle, difficulty, responseDepth, learningGoal, wrongAnswer } = req.body || {};
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
      materialType: { $ne: 'folder' },
    };
    if (campusId) {
      materialFilter.$and = [
        ...(materialFilter.$and || []),
        { $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] },
      ];
    }
    if (student.classId) materialFilter.classId = student.classId;
    if (student.sectionId) materialFilter.sectionId = student.sectionId;
    // Do not hard-filter materials by subjectName here. Uploaded/auto-published
    // materials can have slightly different denormalized subject labels than the
    // Smart Learning UI title. Qdrant ranking below decides relevance; this query
    // only establishes the student's class/section privacy scope.

    const lessonPlanFilter = {
      schoolId,
      status: 'published',
    };
    if (campusId) lessonPlanFilter.campusId = campusId;
    if (student.classId) lessonPlanFilter.classId = student.classId;
    if (student.sectionId) lessonPlanFilter.sectionId = student.sectionId;
    if (normalizeString(subject)) {
      lessonPlanFilter.subject = { $regex: `^${escapeRegex(normalizeString(subject))}$`, $options: 'i' };
    }

    const [materials, lessonPlans] = await Promise.all([
      TeachingMaterial.find(materialFilter).limit(MAX_MATERIALS).lean(),
      LessonPlan.find(lessonPlanFilter).limit(25).lean(),
    ]);
    // Do NOT re-ingest here. Publish already indexes attachments into Qdrant.
    // Re-ingesting on every student query deletes and rewrites Qdrant chunks;
    // if the re-parse fails mid-flight the material ends up with zero chunks,
    // causing the model to answer from a different (wrong) PDF.
    const indexedAttachmentCount = 0;
    const resolvedChapterTitle = resolveChapterTitleForRag({
      requestedChapterTitle: chapterTitle,
      topic: normalizedTopic,
      subTopic,
      materials,
    });
    const normalizedSubject = normalizeString(subject).toLowerCase();
    const selectedMaterial = materials.find(
      (material) => normalizeString(material.subjectName).toLowerCase() === normalizedSubject
    ) || null;
    const academicYearId = selectedMaterial?.academicYearId || materials[0]?.academicYearId || null;

    // Build student context for personalised LLM response — fire and forget on error
    let studentContext = '';
    let conversationHistory = [];
    try {
      const ctx = await buildStudentContext({
        studentId,
        schoolId,
        subject: normalizeString(subject),
        topicId: normalizeString(topic),
        gradeLevel: student.grade ? `Grade ${student.grade}` : '',
      });
      studentContext = ctx.contextBlock;
      conversationHistory = ctx.conversationHistory;
    } catch {
      // Non-critical — fall back to generic response if context build fails
    }

    const aiResponse = await axios.post(`${AI_SERVICE_URL}/generate/tutor`, {
      mode: normalizedMode,
      subject: normalizeString(subject) || 'General Knowledge',
      topic: normalizedTopic || normalizedQuestion,
      subTopic: normalizeString(subTopic) || null,
      gradeLevel: student.grade ? `Grade ${student.grade}` : null,
      question: normalizeString(question) || null,
      candidates: [],
      schoolId: String(schoolId),
      classId: student.classId ? String(student.classId) : null,
      sectionId: student.sectionId ? String(student.sectionId) : null,
      academicYearId: academicYearId ? String(academicYearId) : null,
      subjectId: selectedMaterial?.subjectId ? String(selectedMaterial.subjectId) : null,
      curriculumCode: normalizeString(selectedMaterial?.curriculumCode) || null,
      chapterTitle: resolvedChapterTitle,
      difficulty: normalizeString(difficulty) || null,
      responseDepth: normalizeString(responseDepth) || null,
      learningGoal: normalizeString(learningGoal) || null,
      wrongAnswer: normalizeString(wrongAnswer) || null,
      studentContext: studentContext || null,
      conversationHistory: conversationHistory.length ? conversationHistory : null,
    }, { timeout: 180000 });

    return res.json({
      success: true,
      data: {
        content: aiResponse.data?.content || '',
        model: aiResponse.data?.model,
        groundedInMaterial: aiResponse.data?.groundedInMaterial || false,
        noMaterialFound: aiResponse.data?.noMaterialFound || false,
        citations: Array.isArray(aiResponse.data?.citations) ? aiResponse.data.citations : [],
        visuals: Array.isArray(aiResponse.data?.visuals) ? aiResponse.data.visuals : [],
        sourceMaterialCount: materials.length,
        sourceLessonPlanCount: lessonPlans.length,
        candidateChunkCount: 0,
        indexedAttachmentCount,
        ragSource: 'qdrant',
        resolvedChapterTitle,
      },
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    }
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-tutor/assignment-feedback — AI feedback on submission ────────
router.post('/assignment-feedback', authTeacher, async (req, res) => {
  try {
    const { submissionText, subject, assignmentTitle, studentName } = req.body || {};
    if (!submissionText) return res.status(400).json({ error: 'submissionText is required' });
    const prompt = `Assignment: "${assignmentTitle || 'Assignment'}"\nSubject: ${subject || 'General'}\nStudent: ${studentName || 'Student'}\nSubmission:\n${submissionText.slice(0, 2000)}`;
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/generate/tutor`, {
      mode: 'assignment_feedback',
      subject: normalizeString(subject || ''),
      topic: assignmentTitle || '',
      question: prompt,
      school_id: null,
    }, { timeout: 90000 });
    return res.json({ success: true, data: { content: aiResponse.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error' });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-tutor/at-risk-summary — AI risk narrative for a student ─────
router.post('/at-risk-summary', authTeacher, async (req, res) => {
  try {
    const { studentName, riskLevel, attPct, avgScore, scoreTrend, weakAreas } = req.body || {};
    const prompt = `Student: ${studentName}\nRisk Level: ${riskLevel}\nAttendance: ${attPct}%\nAvg Exam Score: ${avgScore ?? 'N/A'}%\nScore Trend: ${scoreTrend > 0 ? `+${scoreTrend}` : scoreTrend} pts\nWeak Areas: ${(weakAreas || []).join(', ') || 'None identified'}`;
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/generate/tutor`, {
      mode: 'at_risk_summary',
      subject: 'Student Risk Analysis',
      topic: studentName || '',
      question: prompt,
      school_id: null,
    }, { timeout: 60000 });
    return res.json({ success: true, data: { content: aiResponse.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error' });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-tutor/exam-feedback — personalised post-exam AI feedback ────
router.post('/exam-feedback', authStudent, async (req, res) => {
  try {
    const { subject, marksScored, totalMarks, examTitle } = req.body || {};
    if (!subject || totalMarks == null) {
      return res.status(400).json({ error: 'subject and totalMarks are required' });
    }
    const pct = Math.round((Number(marksScored) / Number(totalMarks)) * 100);
    const question = `Student scored ${pct}% (${marksScored}/${totalMarks}) on "${examTitle || subject}" exam. Generate personalised post-exam feedback.`;

    const aiResponse = await axios.post(`${AI_SERVICE_URL}/generate/tutor`, {
      mode: 'exam_feedback',
      subject: normalizeString(subject),
      topic: examTitle || subject,
      question,
      school_id: null,
    }, { timeout: 120000 });

    return res.json({ success: true, data: { content: aiResponse.data?.content || '', percentage: pct } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-tutor/exam-explanation — LLM wrong answer explanation ───────
router.post('/exam-explanation', authStudent, async (req, res) => {
  try {
    const { question, studentAnswer, correctAnswer, subject, topicTitle } = req.body || {};
    if (!question || !correctAnswer) {
      return res.status(400).json({ error: 'question and correctAnswer are required' });
    }
    const prompt = `Question: ${question}\nStudent answered: "${studentAnswer || '(no answer)'}"\nCorrect answer: "${correctAnswer}"\nExplain why the correct answer is right and what the student misunderstood.`;

    const aiResponse = await axios.post(`${AI_SERVICE_URL}/generate/tutor`, {
      mode: 'exam_explanation',
      subject: normalizeString(subject || ''),
      topic: topicTitle || '',
      question: prompt,
      school_id: null,
    }, { timeout: 120000 });

    return res.json({ success: true, data: { content: aiResponse.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
