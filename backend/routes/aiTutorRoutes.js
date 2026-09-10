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
const adminAuth = require('../middleware/adminAuth');
const StudentUser = require('../models/StudentUser');
const TeachingMaterial = require('../models/TeachingMaterial');
const LessonPlan = require('../models/LessonPlan');
const StudentProgress = require('../models/StudentProgress');
const { buildStudentContext } = require('../utils/studentContextBuilder');
const { buildTeacherAllocationScope, studentIsWithinTeacherScope } = require('../utils/teacherAllocationScope');
const { partitionMaterialsByEnabled } = require('../utils/teachingMaterialAccess');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const ALLOWED_MODES = ['custom', 'explain', 'visual_explain', 'summarize', 'quiz', 'visual_quiz', 'homework_help', 'notes', 'mind_map', 'flashcards', 'diagram', 'misconception', 'real_world', 'practice_basic', 'practice_intermediate', 'practice_advanced', 'engagement_swap', 'exam_explanation', 'exam_feedback', 'assignment_feedback', 'at_risk_summary', 'quiz_generate', 'short_answer', 'long_answer', 'bloom_question', 'hinge_question', 'explain_back'];

const MAX_MATERIALS = 50;
const SUPPORTED_VECTOR_EXTENSIONS = new Set(['pdf', 'docx', 'pptx']);

const normalizeString = (value) => String(value || '').trim();
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeLookup = (value) => normalizeString(value).toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
const bloomLevelFromMastery = (score) => {
  if (score < 40) return 'remember';
  if (score < 60) return 'understand';
  if (score < 75) return 'apply';
  if (score < 90) return 'analyse';
  return 'evaluate';
};

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
      isEnabled: true,
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

    const [scopedMaterials, lessonPlans] = await Promise.all([
      TeachingMaterial.find(materialFilter).limit(MAX_MATERIALS).lean(),
      LessonPlan.find(lessonPlanFilter).limit(25).lean(),
    ]);
    // A teacher can disable a material after it was already ingested into
    // Qdrant; disabling never touches the vector store (see
    // teachingMaterialRoutes.js toggle-enabled), so ai-service must be told
    // which materials to exclude or a disabled material's content can still
    // surface via semantic/keyword retrieval.
    const { enabled: materials, disabledIds: excludedMaterialIds } = partitionMaterialsByEnabled(scopedMaterials);
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

    // Build student context for personalised LLM response — fire and forget on error.
    // Personalisation (mastery/gaps/memory/development profile in the prompt)
    // requires recorded parental consent; without it the tutor answers from the
    // retrieved course material only.
    let studentContext = '';
    let conversationHistory = clientHistory;
    let masteryBasedDifficulty = normalizeString(difficulty) || null;
    let masteryBasedBloomLevel = null;
    const consent = await require('../services/aiConsentService')
      .personalisationAllowed({ studentId, schoolId })
      .catch(() => ({ allowed: false, reason: 'consent_check_failed' }));
    try {
      if (!consent.allowed) throw new Error('personalisation_not_consented');
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
          masteryBasedBloomLevel = bloomLevelFromMastery(topicMastery.score);
          masteryBasedDifficulty = topicMastery.score >= 75 ? 'hard'
            : topicMastery.score >= 50 ? 'medium'
            : 'easy';
        }
      }
    } catch {
      // Non-critical — fall back to generic response if context build fails
    }

    const aiStarted = Date.now();
    let aiResponse;
    try {
      aiResponse = await axios.post(`${AI_SERVICE_URL}/orchestrate`, {
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
          bloomLevel: masteryBasedBloomLevel,
          excludedMaterialIds,
          studentContext: studentContext || null,
          conversationHistory: conversationHistory.length ? conversationHistory : null,
        },
      }, { timeout: 180000 });
    } catch (aiErr) {
      require('../services/aiInteractionLogger').logAiInteraction({
        schoolId, userId: studentId, userRole: 'student',
        feature: 'tutor_generate', mode: normalizedMode, subject: normalizeString(subject),
        topicTitle: normalizedTopic,
        retrievalConfig: { classId: String(student.classId || ''), sectionId: String(student.sectionId || ''),
          chapterTitle: resolvedChapterTitle, excludedMaterialCount: excludedMaterialIds.length },
        status: 'error', httpStatus: aiErr.response?.status || null,
        errorType: aiErr.response ? 'ai_service_error' : 'network_error',
        latencyMs: Date.now() - aiStarted,
      });
      throw aiErr;
    }

    require('../services/aiInteractionLogger').logAiInteraction({
      schoolId, userId: studentId, userRole: 'student',
      feature: 'tutor_generate', mode: normalizedMode, subject: normalizeString(subject),
      topicTitle: normalizedTopic, aiResponse: aiResponse.data || {},
      retrievalConfig: { classId: String(student.classId || ''), sectionId: String(student.sectionId || ''),
        chapterTitle: resolvedChapterTitle, excludedMaterialCount: excludedMaterialIds.length,
        sourceMaterialCount: materials.length },
      status: 'success', latencyMs: Date.now() - aiStarted,
    });

    return res.json({
      success: true,
      data: {
        content: aiResponse.data?.content || '',
        model: aiResponse.data?.model,
        groundedInMaterial: aiResponse.data?.groundedInMaterial || false,
        noMaterialFound: aiResponse.data?.noMaterialFound || false,
        citations: Array.isArray(aiResponse.data?.citations) ? aiResponse.data.citations : [],
        visuals: Array.isArray(aiResponse.data?.visuals) ? aiResponse.data.visuals : [],
        // The AI service returns a compact provenance block (model, prompt,
        // retrieval scope and grounding decision) for teacher/student explainability.
        lineage: aiResponse.data?.lineage || null,
        sourceMaterialCount: materials.length,
        sourceLessonPlanCount: lessonPlans.length,
        candidateChunkCount: 0,
        indexedAttachmentCount,
        ragSource: 'qdrant',
        resolvedChapterTitle,
        personalisationApplied: Boolean(consent.allowed && studentContext),
        personalisationBlockedReason: consent.allowed ? null : consent.reason,
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
      examAttemptId, answerIndex, assignmentSubmissionId,
    } = req.body || {};

    if (!questionText || !correctAnswer || !studentAnswer) {
      return res.status(400).json({ error: 'questionText, correctAnswer, and studentAnswer are required' });
    }

    const evalStarted = Date.now();
    let evalResp;
    try {
      evalResp = await axios.post(`${AI_SERVICE_URL}/orchestrate`, {
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
    } catch (evalErr) {
      require('../services/aiInteractionLogger').logAiInteraction({
        schoolId, userId: studentId, userRole: 'student',
        feature: 'answer_evaluate', mode: questionType, subject: normalizeString(subject),
        topicTitle: normalizeString(topicTitle),
        status: 'error', httpStatus: evalErr.response?.status || null,
        errorType: evalErr.response ? 'ai_service_error' : 'network_error',
        latencyMs: Date.now() - evalStarted,
      });
      throw evalErr;
    }

    const result = evalResp.data;

    require('../services/aiInteractionLogger').logAiInteraction({
      schoolId, userId: studentId, userRole: 'student',
      feature: 'answer_evaluate', mode: questionType, subject: normalizeString(subject),
      topicTitle: normalizeString(topicTitle), aiResponse: result,
      status: 'success', latencyMs: Date.now() - evalStarted,
    });

    // Free-form tutor answers are practice feedback only. Official records are
    // evaluated from stored questions/rubrics by the assessment submission routes.

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

    if (studentId && schoolId && subject && topicTitle) {
      await require('../services/masteryEventService').applyAssessment({
        studentId, schoolId, subject: normalizeString(subject),
        topicId: topicId || `${normalizeString(subject)}::${normalizeString(topicTitle)}`,
        topicTitle: normalizeString(topicTitle), chapterTitle: normalizeString(chapterTitle),
        source: 'tutor', assessmentScore: result.score * 100,
        metadata: { errorType: result.errorType, missingConcepts: result.missingConcepts,
          confidenceScore: result.confidenceScore, bloomLevel: result.bloomLevel, provenance: 'student_reported' },
      });
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-tutor/explain-photo ────────────────────────────────────────
// Student uploads a photo of a problem (Cloudinary URL from /api/uploads) and
// asks about it; the vision model explains what it sees.
const _ALLOWED_IMAGE_HOSTS = new Set(['res.cloudinary.com']);
router.post('/explain-photo', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId  = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const { imageUrl, question, subject, topic } = req.body || {};
    if (!imageUrl || !String(question || '').trim()) {
      return res.status(400).json({ error: 'imageUrl and question are required' });
    }
    let parsed;
    try { parsed = new URL(imageUrl); } catch { return res.status(400).json({ error: 'imageUrl is not a valid URL' }); }
    if (parsed.protocol !== 'https:' || !_ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) {
      return res.status(400).json({ error: 'imageUrl must be an https Cloudinary URL from this app' });
    }

    const student = await StudentUser.findOne({ _id: studentId, schoolId }).select('grade').lean();

    let imageBuf;
    try {
      const dl = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: 8 * 1024 * 1024 });
      const ct = String(dl.headers['content-type'] || '');
      if (!ct.startsWith('image/')) return res.status(400).json({ error: 'URL does not point to an image' });
      imageBuf = Buffer.from(dl.data);
    } catch (dlErr) {
      return res.status(400).json({ error: 'Could not fetch the image', detail: dlErr.message });
    }

    const started = Date.now();
    let visionRes;
    try {
      visionRes = await axios.post(`${AI_SERVICE_URL}/vision/explain-image`, {
        image: imageBuf.toString('base64'),
        question: normalizeString(question),
        grade_level: student?.grade ? `Grade ${student.grade}` : null,
        subject: normalizeString(subject) || null,
      }, { timeout: 120000 });
    } catch (vErr) {
      require('../services/aiInteractionLogger').logAiInteraction({
        schoolId, userId: studentId, userRole: 'student',
        feature: 'vision_explain_photo', subject: normalizeString(subject), topicTitle: normalizeString(topic),
        status: 'error', httpStatus: vErr.response?.status || null,
        errorType: vErr.response ? 'ai_service_error' : 'network_error', latencyMs: Date.now() - started,
      });
      if (vErr.response) return res.status(502).json({ error: 'Vision service error', detail: vErr.response.data });
      throw vErr;
    }

    require('../services/aiInteractionLogger').logAiInteraction({
      schoolId, userId: studentId, userRole: 'student',
      feature: 'vision_explain_photo', mode: 'explain', subject: normalizeString(subject),
      topicTitle: normalizeString(topic),
      aiResponse: { model: visionRes.data?.model_used, content: visionRes.data?.explanation },
      status: 'success', latencyMs: Date.now() - started,
    });

    return res.json({
      success: true,
      data: { explanation: visionRes.data?.explanation || '', model: visionRes.data?.model_used || '' },
    });
  } catch (err) {
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

    const scope = await buildTeacherAllocationScope({
      schoolId: req.schoolId,
      campusId: req.campusId || null,
      teacherId: req.user?.id || req.teacher?.id,
    });
    if (!studentIsWithinTeacherScope(student, scope)) {
      return res.status(403).json({ error: 'Student is outside your assigned scope' });
    }

    const conversations = await TutorConversation.find({
      studentId,
      schoolId: req.schoolId,
    })
      .sort({ updatedAt: -1 })
      .limit(Number(limit))
      .lean();

    await require('../services/tutorCorrectionService').attachCorrections(conversations, req.schoolId);

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

    await require('../services/masteryEventService').applyAssessment({
      studentId, schoolId, subject, topicId: existing?.topicId || `${subject}::${topicTitle}`,
      topicTitle, chapterTitle: chapterTitle || '', source: 'self-report',
      assessmentScore: rating === 'got_it' ? 100 : 0, metadata: { rating },
    });

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

// ── Shared: confirm a teacher may act on a student's tutor conversation ───────
const loadCorrectableConversation = async (req, res, conversationId) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    res.status(400).json({ error: 'Invalid conversationId' });
    return null;
  }
  const TutorConversation = require('../models/TutorConversation');
  const conv = await TutorConversation.findOne({ _id: conversationId, schoolId: req.schoolId }).lean();
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return null;
  }
  const student = await StudentUser.findOne({ _id: conv.studentId, schoolId: req.schoolId })
    .select('name grade section className sectionName').lean();
  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return null;
  }
  const scope = await buildTeacherAllocationScope({
    schoolId: req.schoolId, campusId: req.campusId || null,
    teacherId: req.user?.id || req.teacher?.id,
  });
  if (!studentIsWithinTeacherScope(student, scope)) {
    res.status(403).json({ error: 'Student is outside your assigned scope' });
    return null;
  }
  return { conv, student };
};

// ── POST /api/ai-tutor/teacher/correct-answer ─────────────────────────────────
// Teacher overrides a specific AI tutor answer in a student's conversation.
// The correction is stored in its own collection so the student's next chat
// sync cannot wipe it, and is joined back onto conversation reads.
router.post('/teacher/correct-answer', authTeacher, async (req, res) => {
  try {
    const teacherId = req.user?.id || req.teacher?.id;
    const { conversationId, messageId, messageIndex, correctedText, reason } = req.body || {};
    if (!conversationId || !String(correctedText || '').trim()) {
      return res.status(400).json({ error: 'conversationId and a non-empty correctedText are required' });
    }
    if (messageId == null && messageIndex == null) {
      return res.status(400).json({ error: 'messageId or messageIndex is required' });
    }

    const loaded = await loadCorrectableConversation(req, res, conversationId);
    if (!loaded) return;
    const { conv } = loaded;

    const { resolveTargetMessage } = require('../services/tutorCorrectionService');
    const { message, index } = resolveTargetMessage(conv.messages, { messageId, messageIndex });
    if (!message) return res.status(404).json({ error: 'Target message not found in this conversation' });
    if (message.role !== 'assistant') {
      return res.status(400).json({ error: 'Only an AI answer (assistant message) can be corrected' });
    }

    const TutorAnswerCorrection = require('../models/TutorAnswerCorrection');
    const teacher = await require('../models/TeacherUser').findOne({ _id: teacherId, schoolId: req.schoolId })
      .select('name').lean();

    const correction = await TutorAnswerCorrection.findOneAndUpdate(
      { conversationId: conv._id, messageId: String(message.id) },
      {
        $set: {
          schoolId: req.schoolId, studentId: conv.studentId, clientId: conv.clientId || '',
          messageIndex: index,
          originalText: String(message.text || ''),
          correctedText: String(correctedText).trim(),
          reason: String(reason || '').trim(),
          status: 'active', withdrawnAt: null,
          teacherId, teacherName: teacher?.name || '',
        },
        $setOnInsert: { messageId: String(message.id) },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    try {
      await require('../models/AuditLog').create({
        schoolId: req.schoolId, actorId: teacherId, actorType: 'teacher', actorName: teacher?.name || '',
        action: 'ai_tutor.answer_correction', entity: 'TutorAnswerCorrection', entityId: correction._id,
        ip: req.ip,
        meta: { conversationId: String(conv._id), studentId: String(conv.studentId), messageId: String(message.id), reason: correction.reason },
      });
    } catch (_) { /* audit failure must not block the correction */ }

    return res.json({ success: true, data: correction });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/ai-tutor/teacher/correct-answer/:id ──────────────────────────
// Withdraw a previously saved correction.
router.delete('/teacher/correct-answer/:id', authTeacher, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid correction id' });
    }
    const TutorAnswerCorrection = require('../models/TutorAnswerCorrection');
    const existing = await TutorAnswerCorrection.findOne({ _id: req.params.id, schoolId: req.schoolId }).lean();
    if (!existing) return res.status(404).json({ error: 'Correction not found' });

    const loaded = await loadCorrectableConversation(req, res, String(existing.conversationId));
    if (!loaded) return;

    const updated = await TutorAnswerCorrection.findOneAndUpdate(
      { _id: existing._id, schoolId: req.schoolId },
      { $set: { status: 'withdrawn', withdrawnAt: new Date() } },
      { new: true }
    );
    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ai-tutor/teacher/corrections ────────────────────────────────────
// List AI-answer corrections the teacher can see (their allocation scope),
// optionally filtered by student or conversation.
router.get('/teacher/corrections', authTeacher, async (req, res) => {
  try {
    const { studentId, conversationId, includeWithdrawn } = req.query;
    const TutorAnswerCorrection = require('../models/TutorAnswerCorrection');

    const filter = { schoolId: req.schoolId };
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) filter.studentId = studentId;
    if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) filter.conversationId = conversationId;
    if (String(includeWithdrawn) !== 'true') filter.status = 'active';

    const rows = await TutorAnswerCorrection.find(filter).sort({ updatedAt: -1 }).limit(200).lean();

    // Restrict to students within the teacher's allocation scope.
    const scope = await buildTeacherAllocationScope({
      schoolId: req.schoolId, campusId: req.campusId || null,
      teacherId: req.user?.id || req.teacher?.id,
    });
    const studentIds = [...new Set(rows.map((r) => String(r.studentId)))];
    const students = await StudentUser.find({ _id: { $in: studentIds }, schoolId: req.schoolId })
      .select('name grade section className sectionName').lean();
    const inScope = new Set(students.filter((s) => studentIsWithinTeacherScope(s, scope)).map((s) => String(s._id)));

    return res.json({ success: true, data: rows.filter((r) => inScope.has(String(r.studentId))) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ai-tutor/admin/interaction-logs ─────────────────────────────────
// Explainable-AI audit trail: which model / prompt / retrieval config produced
// each AI answer, how it went, and how long it took.
router.get('/admin/interaction-logs', adminAuth, async (req, res) => {
  try {
    const AiInteractionLog = require('../models/AiInteractionLog');
    const { feature, status, userId, from, to } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    const filter = { schoolId: req.schoolId };
    if (feature) filter.feature = feature;
    if (status) filter.status = status;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) filter.userId = userId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const [logs, summary] = await Promise.all([
      AiInteractionLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      AiInteractionLog.aggregate([
        { $match: filter },
        { $group: {
          _id: '$feature',
          total: { $sum: 1 },
          errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
          grounded: { $sum: { $cond: ['$grounded', 1, 0] } },
          needsReview: { $sum: { $cond: ['$needsReview', 1, 0] } },
          avgLatencyMs: { $avg: '$latencyMs' },
        } },
      ]),
    ]);
    return res.json({ success: true, data: logs, summary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ai-tutor/consent-status ─────────────────────────────────────────
// The calling student's AI-personalisation consent status.
router.get('/consent-status', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId  = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });
    const status = await require('../services/aiConsentService').personalisationAllowed({ studentId, schoolId });
    return res.json({ success: true, data: status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-tutor/admin/consent/:studentId ──────────────────────────────
// Record parental consent for AI personalisation (admin, audited).
router.post('/admin/consent/:studentId', adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }
    const { givenBy } = req.body || {};
    if (!String(givenBy || '').trim()) return res.status(400).json({ error: 'givenBy (consenting parent/guardian name) is required' });

    const result = await require('../services/aiConsentService').recordConsent({
      studentId: req.params.studentId, schoolId: req.schoolId,
      givenBy, actor: { id: req.user?.id, type: 'admin', name: req.user?.name },
    });
    if (result.notFound) return res.status(404).json({ error: 'Student not found in this school' });
    return res.json({ success: true, data: result.student });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ai-tutor/admin/retention-policy ─────────────────────────────────
router.get('/admin/retention-policy', adminAuth, async (req, res) => {
  try {
    const { RETENTION } = require('../config/workflowThresholds');
    const StudentUser = require('../models/StudentUser');
    const dueForPurge = await StudentUser.countDocuments({
      schoolId: req.schoolId, dataRetentionExpiresAt: { $ne: null, $lte: new Date() },
    });
    return res.json({ success: true, data: {
      conversationRetentionDays: RETENTION.CONVERSATION_DAYS,
      memorySummaryRetentionDays: RETENTION.MEMORY_SUMMARY_DAYS,
      aiInteractionLogRetentionDays: Number(process.env.AI_LOG_RETENTION_DAYS) || 180,
      studentsDueForPurge: dueForPurge,
    } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-tutor/admin/purge-ai-data/:studentId ────────────────────────
// Explicit erasure of a student's AI data (deletion request / off-boarding).
router.post('/admin/purge-ai-data/:studentId', adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }
    const student = await StudentUser.findOne({ _id: req.params.studentId, schoolId: req.schoolId }).select('_id name').lean();
    if (!student) return res.status(404).json({ error: 'Student not found in this school' });

    const result = await require('../services/dataRetentionService')
      .purgeStudentAiData(student._id, req.schoolId);

    try {
      await require('../models/AuditLog').create({
        schoolId: req.schoolId, actorId: req.user?.id || null, actorType: 'admin', actorName: req.user?.name || '',
        action: 'ai_data.purged', entity: 'StudentUser', entityId: student._id,
        ip: req.ip, meta: { result },
      });
    } catch (_) { /* audit must not block */ }

    return res.json({ success: true, data: result });
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
