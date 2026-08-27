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
const ALLOWED_MODES = ['custom', 'explain', 'visual_explain', 'summarize', 'quiz', 'visual_quiz', 'homework_help', 'notes', 'mind_map', 'flashcards', 'diagram', 'misconception', 'real_world', 'practice_basic', 'practice_intermediate', 'practice_advanced', 'engagement_swap', 'exam_explanation', 'exam_feedback', 'assignment_feedback', 'at_risk_summary', 'quiz_generate', 'short_answer', 'long_answer', 'bloom_question', 'hinge_question', 'explain_back'];

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

    // Conversation history sent straight from the client's chat state — avoids the
    // save-to-Mongo / read-back race and the "newest conversation globally" ambiguity.
    // Sanitised + capped; falls back to the stored read when the client omits it.
    const clientHistory = Array.isArray(req.body?.conversationHistory)
      ? req.body.conversationHistory
          .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && String(t.text || '').trim())
          .map((t) => ({ role: t.role, text: String(t.text).slice(0, 1500) }))
          .slice(-10)
      : [];
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
    let conversationHistory = clientHistory;
    let masteryBasedDifficulty = normalizeString(difficulty) || null;
    try {
      const ctx = await buildStudentContext({
        studentId,
        schoolId,
        subject: normalizeString(subject),
        topicId: normalizeString(topic),
        gradeLevel: student.grade ? `Grade ${student.grade}` : '',
      });
      studentContext = ctx.contextBlock;
      // Prefer the client's live history; only fall back to the stored read when absent.
      if (!conversationHistory.length) conversationHistory = ctx.conversationHistory;

      // Adaptive difficulty: override difficulty from student's mastery when not explicitly set
      if (!difficulty && ['quiz', 'visual_quiz', 'practice_basic', 'practice_intermediate', 'practice_advanced'].includes(normalizedMode)) {
        const MasteryScore = require('../models/MasteryScore');
        const topicMastery = await MasteryScore.findOne({
          studentId,
          schoolId,
          subject: normalizeString(subject),
          topicTitle: { $regex: normalizeString(topic), $options: 'i' },
        }).lean().catch(() => null);
        if (topicMastery) {
          masteryBasedDifficulty = topicMastery.score >= 75 ? 'hard'
            : topicMastery.score >= 50 ? 'medium'
            : 'easy';
        }
      }
    } catch {
      // Non-critical — fall back to generic response if context build fails
    }

    const aiResponse = await axios.post(`${AI_SERVICE_URL}/orchestrate`, {
      task_type: 'generate',
      payload: {
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
        difficulty: masteryBasedDifficulty,
        responseDepth: normalizeString(responseDepth) || null,
        learningGoal: normalizeString(learningGoal) || null,
        wrongAnswer: normalizeString(wrongAnswer) || null,
        studentContext: studentContext || null,
        conversationHistory: conversationHistory.length ? conversationHistory : null,
      },
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

// ── POST /api/ai-tutor/evaluate-answer — academic answer evaluator ────────────
// Evaluates MCQ, short-answer, or long-answer responses and feeds mastery engine.
router.post('/evaluate-answer', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId  = req.schoolId;
    const {
      questionText, correctAnswer, studentAnswer,
      subject, topicTitle, chapterTitle, gradeLevel,
      questionType = 'mcq', context = '', topicId,
    } = req.body || {};

    if (!questionText || !correctAnswer || !studentAnswer) {
      return res.status(400).json({ error: 'questionText, correctAnswer, and studentAnswer are required' });
    }

    const evalResp = await axios.post(`${AI_SERVICE_URL}/orchestrate`, {
      task_type: 'evaluate',
      payload: {
        questionText, correctAnswer, studentAnswer,
        subject: normalizeString(subject),
        topicTitle: normalizeString(topicTitle),
        chapterTitle: normalizeString(chapterTitle),
        gradeLevel: normalizeString(gradeLevel),
        questionType,
        context: normalizeString(context),
      },
    }, { timeout: 120000 });

    const result = evalResp.data;

    // Store wrong answers as error records (non-blocking)
    if (!result.isCorrect && studentId && subject) {
      const { recordErrors } = require('../services/errorClassifier');
      recordErrors({
        studentId, schoolId, source: 'quiz',
        wrongs: [{
          questionId:    '',
          questionText,
          correctAnswer,
          studentAnswer,
          subject:       normalizeString(subject),
          topicTitle:    normalizeString(topicTitle),
          chapterTitle:  normalizeString(chapterTitle),
        }],
      }).catch(() => {});
    }

    // Feed result into mastery engine (non-blocking)
    if (studentId && schoolId && subject && topicTitle) {
      const MasteryScore = require('../models/MasteryScore');
      const { runWorkflowTriggers } = require('../services/masteryEngine');
      const scorePercent = Math.round(result.score * 100);
      const tid = topicId || `${normalizeString(subject)}::${normalizeString(topicTitle)}`;
      MasteryScore.findOneAndUpdate(
        { studentId, subject: normalizeString(subject), topicId: tid },
        {
          $set: {
            schoolId,
            topicTitle: normalizeString(topicTitle),
            chapterTitle: normalizeString(chapterTitle),
            lastUpdated: new Date(),
          },
          $inc: { attemptCount: 1 },
          $max: { score: scorePercent },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).then((doc) => {
        if (!doc) return;
        const blended = doc.attemptCount <= 1
          ? scorePercent
          : Math.round((doc.score * 0.7) + (scorePercent * 0.3));
        doc.score = Math.max(doc.score, blended);
        return doc.save().then(() => runWorkflowTriggers({
          studentId, schoolId, subject: normalizeString(subject),
          topicId: tid, topicTitle: normalizeString(topicTitle),
          chapterTitle: normalizeString(chapterTitle),
          score: doc.score, attemptCount: doc.attemptCount,
        }));
      }).catch(() => {});
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ai-tutor/teacher/student-sessions/:studentId ─────────────────────
// Teacher visibility: read a student's AI tutor conversation history.
router.get('/teacher/student-sessions/:studentId', authTeacher, async (req, res) => {
  try {
    const TutorConversation = require('../models/TutorConversation');
    const { studentId } = req.params;
    const { limit = 10 } = req.query;

    // Verify student belongs to this school
    const student = await StudentUser.findOne({
      _id: studentId,
      schoolId: req.schoolId,
    }).select('name roll className sectionName').lean();
    if (!student) return res.status(404).json({ error: 'Student not found in this school' });

    const conversations = await TutorConversation.find({
      studentId,
      schoolId: req.schoolId,
    })
      .sort({ updatedAt: -1 })
      .limit(Number(limit))
      .lean();

    return res.json({ success: true, data: { student, conversations } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-tutor/flashcard-rating ──────────────────────────────────────
// Student rates a flashcard as "got_it" or "still_learning" — feeds mastery engine
// and updates spaced-repetition schedule for the card's topic.
router.post('/flashcard-rating', authStudent, async (req, res) => {
  try {
    const { topicTitle, chapterTitle, subject, rating } = req.body;
    if (!topicTitle || !subject || !['got_it', 'still_learning'].includes(rating)) {
      return res.status(400).json({ error: 'topicTitle, subject, and rating ("got_it"|"still_learning") are required' });
    }
    const MasteryScore = require('../models/MasteryScore');
    const { runWorkflowTriggers } = require('../services/masteryEngine');
    const studentId = String(req.userId);
    const schoolId = String(req.schoolId);

    // Convert rating to a mastery delta: "got_it" nudges score up, "still_learning" nudges down
    const delta = rating === 'got_it' ? 5 : -5;
    const existing = await MasteryScore.findOne({ studentId, schoolId, subject, topicTitle });
    const currentScore = existing?.score ?? 50;
    const newScore = Math.min(100, Math.max(0, currentScore + delta));
    const attemptCount = (existing?.attemptCount ?? 0) + 1;

    const updated = await MasteryScore.findOneAndUpdate(
      { studentId, schoolId, subject, topicTitle },
      {
        $set: { score: newScore, chapterTitle: chapterTitle || '', lastUpdated: new Date(), attemptCount },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Fire workflow side-effects non-blocking
    runWorkflowTriggers({ studentId, schoolId, subject, topicTitle, chapterTitle: chapterTitle || '', score: newScore, attemptCount });

    return res.json({ success: true, data: { newScore, rating, topicTitle } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ai-tutor/health-card ────────────────────────────────────────────
// Unified student learning health card: mastery + gaps + spaced repetition + language
// assessment + recommendations — all in one API call.
router.get('/health-card', authStudent, async (req, res) => {
  try {
    const { subject } = req.query;
    const studentId = String(req.userId);
    const schoolId  = String(req.schoolId);

    const MasteryScore             = require('../models/MasteryScore');
    const SpacedRepetitionSchedule = require('../models/SpacedRepetitionSchedule');
    const StudentInsight           = require('../models/StudentInsight');
    const { recommendNextTopic }   = require('../services/recommendationEngine');
    const { computeAtRisk }        = require('../services/mlEngine');

    const masteryFilter = { studentId, schoolId };
    if (subject) masteryFilter.subject = { $regex: subject, $options: 'i' };

    const [masteryRecords, overdue, gaps, atRisk] = await Promise.all([
      MasteryScore.find(masteryFilter).sort({ score: 1 }).lean(),
      SpacedRepetitionSchedule.find({ studentId, schoolId, nextReviewDate: { $lt: new Date() } }).lean(),
      StudentInsight.find({ studentId, schoolId, insightType: 'gap_detection', ...(subject ? { subject: { $regex: subject, $options: 'i' } } : {}) })
        .sort({ generatedAt: -1 }).limit(5).lean(),
      computeAtRisk({ studentId, schoolId }),
    ]);

    // Overall mastery summary
    const avgMastery = masteryRecords.length
      ? Math.round(masteryRecords.reduce((s, r) => s + r.score, 0) / masteryRecords.length)
      : null;

    // Subject breakdown
    const subjectMap = {};
    for (const r of masteryRecords) {
      if (!subjectMap[r.subject]) subjectMap[r.subject] = { scores: [], weak: [] };
      subjectMap[r.subject].scores.push(r.score);
      if (r.score < 60) subjectMap[r.subject].weak.push(r.topicTitle);
    }
    const subjectSummary = Object.entries(subjectMap).map(([subj, v]) => ({
      subject: subj,
      avgMastery: Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length),
      weakTopics: v.weak,
    })).sort((a, b) => a.avgMastery - b.avgMastery);

    // Get recommendation for the primary subject
    const primarySubject = subject || subjectSummary[0]?.subject;
    let recommendation = null;
    if (primarySubject) {
      try {
        const rec = await recommendNextTopic({ studentId, schoolId, subject: primarySubject });
        recommendation = rec.recommendation;
      } catch (_) {}
    }

    return res.json({
      success: true,
      data: {
        studentId,
        avgMastery,
        atRisk,
        subjectSummary,
        overdueReviews: overdue.length,
        overdueTopics: overdue.slice(0, 5).map((o) => ({ subject: o.subject, topicTitle: o.topicTitle, daysOverdue: Math.round((Date.now() - new Date(o.nextReviewDate)) / 86400000) })),
        gaps: gaps.map((g) => ({ subject: g.subject, summary: g.summary, payload: g.payload })),
        recommendation,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ai-tutor/academic-memory ────────────────────────────────────────
// Returns a student's tracked academic memory: chapters studied, outcomes achieved,
// and recent mistakes — used to personalise tutor context.
router.get('/academic-memory', authStudent, async (req, res) => {
  try {
    const studentId = String(req.userId);
    const schoolId  = String(req.schoolId);

    const TutorConversation = require('../models/TutorConversation');
    const MasteryScore      = require('../models/MasteryScore');
    const ErrorRecord       = require('../models/ErrorRecord');

    const [conversations, masteredTopics, recentErrors] = await Promise.all([
      TutorConversation.find({ studentId, schoolId })
        .select('topicTitle chapterTitle subject updatedAt')
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean(),
      MasteryScore.find({ studentId, schoolId, score: { $gte: 80 } })
        .select('subject topicTitle chapterTitle score lastUpdated')
        .sort({ lastUpdated: -1 })
        .lean(),
      ErrorRecord.find({ studentId, schoolId })
        .select('subject topicTitle errorType attemptedAt')
        .sort({ attemptedAt: -1 })
        .limit(30)
        .lean(),
    ]);

    // Deduplicate studied chapters from conversations
    const chaptersSet = new Set();
    const studiedChapters = [];
    for (const c of conversations) {
      const key = `${c.subject}::${c.chapterTitle}`;
      if (c.chapterTitle && !chaptersSet.has(key)) {
        chaptersSet.add(key);
        studiedChapters.push({ subject: c.subject, chapterTitle: c.chapterTitle, topicTitle: c.topicTitle, lastStudied: c.updatedAt });
      }
    }

    return res.json({
      success: true,
      data: {
        studiedChapters,
        learningOutcomesAchieved: masteredTopics.map((m) => ({
          subject: m.subject, topicTitle: m.topicTitle, chapterTitle: m.chapterTitle, masteryScore: m.score, achievedAt: m.lastUpdated,
        })),
        recentMistakes: recentErrors.map((e) => ({ subject: e.subject, topicTitle: e.topicTitle, errorType: e.errorType, at: e.attemptedAt })),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-tutor/save-note — save AI-generated notes to student profile ──
router.post('/save-note', authStudent, async (req, res) => {
  try {
    const StudentNote = require('../models/StudentNote');
    const { title, content, subject, topicTitle } = req.body || {};
    if (!content) return res.status(400).json({ error: 'content is required' });
    const note = await StudentNote.create({
      studentId: req.userId,
      schoolId: req.schoolId,
      title: title || 'Study Notes',
      content,
      subject: subject || '',
      topicTitle: topicTitle || '',
    });
    return res.json({ success: true, data: { _id: note._id, title: note.title, savedAt: note.savedAt } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ai-tutor/saved-notes — retrieve all saved notes for student ──────
router.get('/saved-notes', authStudent, async (req, res) => {
  try {
    const StudentNote = require('../models/StudentNote');
    const notes = await StudentNote.find({ studentId: req.userId, schoolId: req.schoolId })
      .sort({ savedAt: -1 }).limit(50).lean();
    return res.json({ success: true, data: notes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-tutor/teacher/correct-answer ─────────────────────────────────
// Teacher can override/correct an AI tutor response in a student's conversation.
router.post('/teacher/correct-answer', authTeacher, async (req, res) => {
  try {
    const TutorConversation = require('../models/TutorConversation');
    const { conversationId, messageIndex, correctedText, reason } = req.body || {};
    if (!conversationId || correctedText == null) {
      return res.status(400).json({ error: 'conversationId and correctedText are required' });
    }
    const conv = await TutorConversation.findOne({ _id: conversationId, schoolId: req.schoolId });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const idx = Number(messageIndex);
    if (!Number.isNaN(idx) && conv.messages[idx]) {
      conv.messages[idx].teacherCorrected = true;
      conv.messages[idx].correctedText    = correctedText;
      conv.messages[idx].correctionReason = reason || '';
      conv.messages[idx].correctedBy      = req.userId;
      conv.messages[idx].correctedAt      = new Date();
      await conv.save();
    }
    return res.json({ success: true, message: 'Answer correction saved' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-tutor/question-bank/save ─────────────────────────────────────
// Teacher saves AI-generated questions permanently to Question Bank.
// Accepts an array of question objects (mcq / short_answer / long_answer).
router.post('/question-bank/save', authTeacher, async (req, res) => {
  try {
    const GeneratedQuestion = require('../models/GeneratedQuestion');
    const { questions, subjectName, chapterTitle, topicTitle } = req.body || {};
    if (!Array.isArray(questions) || !questions.length) {
      return res.status(400).json({ error: 'questions array is required' });
    }
    const docs = questions.map((q) => ({
      schoolId:    req.schoolId,
      teacherId:   req.userId,
      subjectName: q.subjectName || subjectName || '',
      chapterTitle:q.chapterTitle || chapterTitle || '',
      topicTitle:  q.topicTitle || topicTitle || '',
      questionType:q.questionType || 'mcq',
      questionText:q.questionText || '',
      options:     q.options || [],
      modelAnswer: q.modelAnswer || '',
      explanation: q.explanation || '',
      keywords:    q.keywords || [],
      markingCriteria: q.markingCriteria || [],
      bloomLevel:  q.bloomLevel || '',
      difficulty:  q.difficulty || 'medium',
      marks:       q.marks || 1,
    }));
    const saved = await GeneratedQuestion.insertMany(docs);
    return res.json({ success: true, data: { saved: saved.length, ids: saved.map((d) => d._id) } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ai-tutor/question-bank ──────────────────────────────────────────
// Teacher retrieves their school's Question Bank with optional filters.
router.get('/question-bank', authTeacher, async (req, res) => {
  try {
    const GeneratedQuestion = require('../models/GeneratedQuestion');
    const { subject, chapter, topic, type, approved, limit = 100, skip = 0 } = req.query;
    const filter = { schoolId: req.schoolId };
    if (subject) filter.subjectName = { $regex: subject, $options: 'i' };
    if (chapter) filter.chapterTitle = { $regex: chapter, $options: 'i' };
    if (topic)   filter.topicTitle   = { $regex: topic,   $options: 'i' };
    if (type)    filter.questionType  = type;
    if (approved === 'true') filter.isApproved = true;
    const [total, questions] = await Promise.all([
      GeneratedQuestion.countDocuments(filter),
      GeneratedQuestion.find(filter).sort({ generatedAt: -1 }).skip(Number(skip)).limit(Number(limit)).lean(),
    ]);
    return res.json({ success: true, data: { total, questions } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/ai-tutor/question-bank/:id — teacher edits a question ──────────
router.patch('/question-bank/:id', authTeacher, async (req, res) => {
  try {
    const GeneratedQuestion = require('../models/GeneratedQuestion');
    const allowed = ['questionText', 'options', 'modelAnswer', 'explanation', 'keywords',
      'markingCriteria', 'bloomLevel', 'difficulty', 'marks', 'isApproved'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    update.teacherEdited = true;
    const q = await GeneratedQuestion.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.schoolId },
      { $set: update },
      { new: true }
    );
    if (!q) return res.status(404).json({ error: 'Question not found' });
    return res.json({ success: true, data: q });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/ai-tutor/question-bank/:id/approve — teacher approves question ─
router.patch('/question-bank/:id/approve', authTeacher, async (req, res) => {
  try {
    const GeneratedQuestion = require('../models/GeneratedQuestion');
    const q = await GeneratedQuestion.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.schoolId },
      { $set: { isApproved: true } },
      { new: true }
    );
    if (!q) return res.status(404).json({ error: 'Question not found' });
    return res.json({ success: true, data: { _id: q._id, isApproved: true } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-tutor/teacher/generate ─────────────────────────────────────────
// Teacher-controlled question generation with explicit difficulty (required).
router.post('/teacher/generate', authTeacher, async (req, res) => {
  try {
    const {
      mode = 'quiz',
      subject,
      topic,
      subTopic,
      chapterTitle,
      gradeLevel,
      difficulty,
      count,
    } = req.body;

    if (!subject || !topic) {
      return res.status(400).json({ success: false, message: 'subject and topic are required' });
    }
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: 'difficulty is required and must be easy, medium, or hard',
      });
    }

    const allowedModes = ['quiz', 'visual_quiz', 'practice_basic', 'practice_intermediate', 'practice_advanced', 'flashcards'];
    const normalizedMode = allowedModes.includes(mode) ? mode : 'quiz';

    const aiResponse = await axios.post(`${AI_SERVICE_URL}/orchestrate`, {
      task_type: 'generate_questions',
      payload: {
        mode: normalizedMode,
        subject: normalizeString(subject),
        topic: normalizeString(topic),
        subTopic: normalizeString(subTopic) || null,
        chapterTitle: normalizeString(chapterTitle) || null,
        gradeLevel: normalizeString(gradeLevel) || null,
        difficulty,
        count: Math.min(parseInt(count, 10) || 5, 20),
        schoolId: String(req.schoolId),
      },
    }, { timeout: 180000 });

    return res.json({
      success: true,
      data: {
        content: aiResponse.data?.content || '',
        model: aiResponse.data?.model,
        difficulty,
        mode: normalizedMode,
      },
    });
  } catch (err) {
    logger.error('[teacher/generate] error:', err.message);
    return res.status(500).json({ success: false, message: 'Question generation failed', error: err.message });
  }
});

module.exports = router;
