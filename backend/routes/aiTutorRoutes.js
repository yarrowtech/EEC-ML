const express = require('express');
const router = express.Router();
const axios = require('axios');
const authStudent = require('../middleware/authStudent');
const StudentUser = require('../models/StudentUser');
const TeachingMaterial = require('../models/TeachingMaterial');
const LessonPlan = require('../models/LessonPlan');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const ALLOWED_MODES = ['explain', 'summarize', 'quiz', 'homework_help', 'notes', 'mind_map', 'flashcards'];

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
        subject_name: material.subjectName || '',
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

router.post('/generate', authStudent, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const campusId = req.campusId;
    const studentId = req.user?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const { subject, topic, subTopic, mode, question, chapterTitle } = req.body || {};
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
      chapterTitle: resolvedChapterTitle,
    }, { timeout: 180000 });

    return res.json({
      success: true,
      data: {
        content: aiResponse.data?.content || '',
        model: aiResponse.data?.model,
        groundedInMaterial: aiResponse.data?.groundedInMaterial || false,
        noMaterialFound: aiResponse.data?.noMaterialFound || false,
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

module.exports = router;
