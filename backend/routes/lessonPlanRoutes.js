const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const adminAuth = require('../middleware/adminAuth');
const authTeacher = require('../middleware/authTeacher');
const authStudent = require('../middleware/authStudent');
const LessonPlan = require('../models/LessonPlan');
const LessonPlanCompletion = require('../models/LessonPlanCompletion');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const StudentUser = require('../models/StudentUser');
const StudentProgress = require('../models/StudentProgress');
const TeachingMaterial = require('../models/TeachingMaterial');
const PracticePaper = require('../models/PracticePaper');
const Assignment = require('../models/Assignment');
const Notification = require('../models/Notification');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const SUPPORTED_VECTOR_EXTENSIONS = new Set(['pdf', 'docx', 'pptx']);

const normalizeString = (value) => String(value || '').trim();
const normalizeLower = (value) => String(value || '').trim().toLowerCase();
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeStringList = (value) =>
  Array.isArray(value) ? value.map((item) => normalizeString(item)).filter(Boolean) : [];

const normalizeTryoutList = (value) =>
  Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : [];

const SMART_TEACHING_SOURCE_FIELDS = [
  { key: 'learningPaths', label: 'Learning Path', learningType: 'note', materialType: 'note', category: 'theory' },
  { key: 'studyMaterials', label: 'Notes', learningType: 'note', materialType: 'note', category: 'theory' },
  { key: 'mindMaps', label: 'Mind Map', learningType: 'mind_map', materialType: 'interactive', category: 'revision' },
  { key: 'referenceMaterials', label: 'Reference Material', learningType: 'pdf', materialType: 'reading', category: 'reference' },
  { key: 'tryoutSections', label: 'Practice', learningType: 'practice', materialType: 'worksheet', category: 'practice' },
  { key: 'selfAssessments', label: 'Assessment', learningType: 'assessment', materialType: 'interactive', category: 'assessment' },
  { key: 'worksheets', label: 'Worksheet', learningType: 'worksheet', materialType: 'worksheet', category: 'practice' },
];

const normalizeIdValue = (value) => normalizeString(value);

const toPlainText = (items) => normalizeStringList(items).join('\n').trim();

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const inferAttachmentType = (value) => {
  const parsed = parseResourceRef(value);
  const text = parsed.url || parsed.title;
  if (!text) return 'text';
  if (/youtube\.com|youtu\.be/i.test(text)) return 'video';
  if (/\.pdf(\?|#|$)/i.test(text)) return 'pdf';
  if (/\.pptx?(\?|#|$)/i.test(text)) return 'ppt';
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(text)) return 'video';
  if (/^https?:\/\//i.test(text)) return 'link';
  return 'text';
};

const parseResourceRef = (value) => {
  const text = normalizeString(value);
  if (!text) return { title: '', url: '' };
  const parts = text.split('::');
  if (parts.length >= 3) {
    const bucket = normalizeString(parts[0]);
    const title = normalizeString(parts[1]);
    const url = normalizeString(parts.slice(2).join('::'));
    return { bucket, title: title || url, url: /^https?:\/\//i.test(url) ? url : '' };
  }
  const separator = text.indexOf('::');
  if (separator >= 0) {
    const title = normalizeString(text.slice(0, separator));
    const url = normalizeString(text.slice(separator + 2));
    return { title: title || url, url: /^https?:\/\//i.test(url) ? url : '' };
  }
  return {
    title: text,
    url: /^https?:\/\//i.test(text) ? text : '',
  };
};

const formatPlanDay = (dateValue) => {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { weekday: 'long' });
};

const buildAttachmentList = (items) =>
  normalizeStringList(items)
    .map(parseResourceRef)
    .filter((item) => item.url)
    .map((item, index) => ({
      name: item.title || `Resource ${index + 1}`,
      url: item.url,
      size: 0,
      type: inferAttachmentType(item.url),
    }));

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

const buildVectorSourceId = (material, attachment, index) => {
  const stableAttachmentId = attachment.cloudinaryPublicId || attachment.url || attachment.name || index;
  return `${String(material._id)}:${String(stableAttachmentId)}`;
};

const deleteMaterialVectors = (materialId) =>
  axios.delete(`${AI_SERVICE_URL}/ingest/material/${encodeURIComponent(String(materialId))}`, {
    timeout: 60_000,
  });

const ingestPublishedMaterialAttachments = async (material) => {
  const attachments = Array.isArray(material.attachments) ? material.attachments.filter(isVectorIngestible) : [];

  if (!attachments.length) {
    try {
      await deleteMaterialVectors(material._id);
    } catch (err) {
      console.error(
        '[Smart Learning ingest] failed to clear vectors for material',
        String(material._id),
        err.response?.data || err.message
      );
    }
    return { indexedAttachmentCount: 0, failedAttachmentCount: 0 };
  }

  let indexedAttachmentCount = 0;
  let failedAttachmentCount = 0;
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    try {
      const response = await axios.post(
        `${AI_SERVICE_URL}/ingest/material`,
        {
          url: attachment.url,
          material_id: String(material._id),
          source_id: buildVectorSourceId(material, attachment, index),
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
      if ((response.data?.chunks_indexed || 0) > 0) indexedAttachmentCount += 1;
      else failedAttachmentCount += 1;
    } catch (err) {
      failedAttachmentCount += 1;
      console.error(
        '[Smart Learning ingest] failed for material',
        String(material._id),
        attachment.name || attachment.url,
        err.response?.data || err.message
      );
    }
  }

  return { indexedAttachmentCount, failedAttachmentCount };
};

const buildMaterialContent = (label, title, items) => {
  const normalized = normalizeStringList(items);
  if (!normalized.length) return '';
  const body = normalized.map((item) => {
    const resource = parseResourceRef(item);
    const text = resource.url ? `${resource.title} - ${resource.url}` : resource.title;
    return `<li>${escapeHtml(text)}</li>`;
  }).join('');
  return [
    `<h2>${escapeHtml(title)}</h2>`,
    `<h3>${escapeHtml(label)}</h3>`,
    `<ul>${body}</ul>`,
  ].join('');
};

const buildSourceMaterialPayloads = ({ plan, chapter, topic, subTopic, chapterIndex, topicIndex, subTopicIndex }) => {
  const chapterId = normalizeIdValue(chapter?.id) || `chapter-${chapterIndex + 1}`;
  const topicId = normalizeIdValue(topic?.id) || `topic-${chapterIndex + 1}-${topicIndex + 1}`;
  const subTopicId = normalizeIdValue(subTopic?.id) || `subtopic-${chapterIndex + 1}-${topicIndex + 1}-${subTopicIndex + 1}`;
  const chapterTitle = normalizeString(chapter?.title) || `Chapter ${chapterIndex + 1}`;
  const topicTitle = normalizeString(topic?.title) || `Topic ${topicIndex + 1}`;
  const subTopicTitle = normalizeString(subTopic?.title) || `Sub Topic ${subTopicIndex + 1}`;
  const baseTitle = [plan.subject || 'Subject', chapterTitle, topicTitle, subTopicTitle].join(' • ');

  const payloads = [];

  SMART_TEACHING_SOURCE_FIELDS.forEach((field) => {
    const items = normalizeStringList(subTopic?.[field.key]);
    if (!items.length) return;
    payloads.push({
      title: `${baseTitle} • ${field.label}`,
      content: buildMaterialContent(field.label, baseTitle, items),
      attachments: buildAttachmentList(items),
      materialType: field.materialType,
      learningType: field.learningType,
      typeLabel: field.label,
      category: field.category,
      chapterId,
      chapterTitle,
      topicTitle,
      subTopicTitle,
      sourceSubTopicId: subTopicId,
    });
  });

  return {
    baseTitle,
    chapterId,
    chapterTitle,
    topicTitle,
    subTopicTitle,
    payloads,
  };
};

const createPublishedStudentNotification = async ({ schoolId, campusId, plan, chapterTitle, topicTitle, subTopicTitle }) => {
  const messageParts = [plan.subject || 'Subject', chapterTitle, topicTitle, subTopicTitle].filter(Boolean);
  await Notification.create({
    schoolId,
    campusId: campusId || null,
    title: 'New Smart Teaching content published',
    message: `${messageParts.join(' • ')} is now available in Smart Learning.`,
    audience: 'Student',
    classId: plan.classId,
    sectionId: plan.sectionId,
    subjectId: plan.subjectId,
    createdByType: 'teacher',
    createdByTeacherId: plan.teacherId,
    createdByName: plan.teacherName || '',
    className: plan.className || '',
    sectionName: plan.sectionName || '',
    subjectName: plan.subject || '',
    type: 'class_note',
    typeLabel: 'Smart Learning content',
    priority: 'medium',
    category: 'academic',
  });
};

const publishSmartLearningArtifacts = async ({ schoolId, campusId, plan, chapter, topic, subTopic, chapterIndex, topicIndex, subTopicIndex, publishAssignment = true, publishPracticePaper = true }) => {
  const base = buildSourceMaterialPayloads({ plan, chapter, topic, subTopic, chapterIndex, topicIndex, subTopicIndex });
  const createdMaterials = [];
  let vectorIndexedAttachmentCount = 0;
  let vectorFailedAttachmentCount = 0;

  for (const payload of base.payloads) {
    const materialFilter = {
      schoolId,
      sourceLessonPlanId: plan._id,
      sourceSubTopicId: payload.sourceSubTopicId,
      learningType: payload.learningType,
      chapterId: base.chapterId,
      topicTitle: base.topicTitle,
      subTopicTitle: base.subTopicTitle,
    };
    if (campusId) materialFilter.campusId = campusId;

    let material = await TeachingMaterial.findOne(materialFilter);
    if (material) {
      if (material.content !== payload.content || material.title !== payload.title) {
        material.versions = material.versions || [];
        material.versions.push({
          versionNumber: Number(material.currentVersion || 1),
          content: material.content || '',
          title: material.title || '',
          attachments: Array.isArray(material.attachments) ? material.attachments : [],
          editedBy: plan.teacherId,
          editedAt: new Date(),
          changeDescription: 'Auto-published update',
        });
        material.currentVersion = Number(material.currentVersion || 1) + 1;
      }
      material.title = payload.title;
      material.content = payload.content;
      material.materialType = payload.materialType;
      material.learningType = payload.learningType;
      material.typeLabel = payload.typeLabel;
      material.classId = plan.classId;
      material.sectionId = plan.sectionId;
      material.subjectId = plan.subjectId;
      material.className = plan.className || '';
      material.sectionName = plan.sectionName || '';
      material.subjectName = plan.subject || '';
      material.chapterId = base.chapterId;
      material.chapterTitle = base.chapterTitle;
      material.topicTitle = base.topicTitle;
      material.subTopicTitle = base.subTopicTitle;
      material.sourceLessonPlanId = plan._id;
      material.sourceSubTopicId = payload.sourceSubTopicId;
      material.teacherId = plan.teacherId;
      material.teacherName = plan.teacherName || 'Teacher';
      material.status = 'published';
      material.publishedForStudentPortal = true;
      material.publishedAt = new Date();
      material.priority = 'medium';
      material.difficulty = 'intermediate';
      material.category = payload.category;
      material.tags = ['lesson-plan', 'smart-learning', 'auto-published'];
      material.attachments = payload.attachments;
      await material.save();
    } else {
      material = await TeachingMaterial.create({
        schoolId,
        campusId: campusId || null,
        title: payload.title,
        content: payload.content,
        materialType: payload.materialType,
        learningType: payload.learningType,
        typeLabel: payload.typeLabel,
        classId: plan.classId,
        sectionId: plan.sectionId,
        subjectId: plan.subjectId,
        className: plan.className || '',
        sectionName: plan.sectionName || '',
        subjectName: plan.subject || '',
        chapterId: base.chapterId,
        chapterTitle: base.chapterTitle,
        topicTitle: base.topicTitle,
        subTopicTitle: base.subTopicTitle,
        sourceLessonPlanId: plan._id,
        sourceSubTopicId: payload.sourceSubTopicId,
        teacherId: plan.teacherId,
        teacherName: plan.teacherName || 'Teacher',
        status: 'published',
        publishedForStudentPortal: true,
        publishedAt: new Date(),
        priority: 'medium',
        difficulty: 'intermediate',
        category: payload.category,
        tags: ['lesson-plan', 'smart-learning', 'auto-published'],
        attachments: payload.attachments,
      });
    }
    createdMaterials.push(material);
    const vectorResult = await ingestPublishedMaterialAttachments(material);
    vectorIndexedAttachmentCount += vectorResult.indexedAttachmentCount;
    vectorFailedAttachmentCount += vectorResult.failedAttachmentCount;
  }

  let assignment = null;
  const worksheetItems = normalizeStringList(subTopic?.worksheets);
  if (publishAssignment && worksheetItems.length > 0) {
    const assignmentFilter = {
      schoolId,
      sourceLessonPlanId: plan._id,
      chapterId: base.chapterId,
      topicTitle: base.topicTitle,
      subTopicTitle: base.subTopicTitle,
      type: 'Worksheet',
    };
    if (campusId) assignmentFilter.campusId = campusId;
    assignment = await Assignment.findOne(assignmentFilter);
    if (assignment) {
      assignment.teacherId = plan.teacherId;
      assignment.title = `${base.baseTitle} • Worksheet Assignment`;
      assignment.description = toPlainText(worksheetItems) || `Auto-published worksheet from ${base.subTopicTitle}`;
      assignment.subject = plan.subject || '';
      assignment.topic = base.topicTitle;
      assignment.difficulty = 'Medium';
      assignment.class = plan.className || '';
      assignment.section = plan.sectionName || '';
      assignment.classId = plan.classId;
      assignment.sectionId = plan.sectionId;
      assignment.chapterId = base.chapterId;
      assignment.chapterTitle = base.chapterTitle;
      assignment.topicTitle = base.topicTitle;
      assignment.subTopicTitle = base.subTopicTitle;
      assignment.sourceLessonPlanId = plan._id;
      assignment.marks = Math.max(10, worksheetItems.length * 10);
      assignment.attachments = buildAttachmentList(worksheetItems);
      assignment.submissionFormat = 'text';
      assignment.status = 'active';
      assignment.publishedForStudentPortal = true;
      assignment.dueDate = plan.date || new Date();
      await assignment.save();
    } else {
      assignment = await Assignment.create({
        schoolId,
        campusId: campusId || null,
        teacherId: plan.teacherId,
        title: `${base.baseTitle} • Worksheet Assignment`,
        description: toPlainText(worksheetItems) || `Auto-published worksheet from ${base.subTopicTitle}`,
        subject: plan.subject || '',
        topic: base.topicTitle,
        type: 'Worksheet',
        difficulty: 'Medium',
        class: plan.className || '',
        section: plan.sectionName || '',
        classId: plan.classId,
        sectionId: plan.sectionId,
        chapterId: base.chapterId,
        chapterTitle: base.chapterTitle,
        topicTitle: base.topicTitle,
        subTopicTitle: base.subTopicTitle,
        sourceLessonPlanId: plan._id,
        marks: Math.max(10, worksheetItems.length * 10),
        attachments: buildAttachmentList(worksheetItems),
        submissionFormat: 'text',
        status: 'active',
        publishedForStudentPortal: true,
        dueDate: plan.date || new Date(),
      });
    }
  }

  let paper = null;
  if (publishPracticePaper) {
    const outline = subTopic?.questionPapers || {};
    const mkQuestion = (label, difficulty, marks) => ({
      questionText: String(outline?.[label] || '').trim() || `${base.subTopicTitle} (${label})`,
      questionType: 'short_answer',
      options: [],
      correctAnswer: '',
      explanation: '',
      marks,
      difficulty,
    });

    const hasAnyOutline = Boolean(
      normalizeString(outline?.basic) || normalizeString(outline?.intermediate) || normalizeString(outline?.advanced)
    );

    if (hasAnyOutline) {
      const questions = [
        mkQuestion('basic', 'easy', 2),
        mkQuestion('intermediate', 'medium', 3),
        mkQuestion('advanced', 'hard', 5),
      ];

      const paperFilter = {
        schoolId,
        sourceLessonPlanId: plan._id,
        chapterId: base.chapterId,
        topicTitle: base.topicTitle,
        subTopicTitle: base.subTopicTitle,
        paperType: 'practice_set',
      };
      if (campusId) paperFilter.campusId = campusId;
      paper = await PracticePaper.findOne(paperFilter);
      if (paper) {
        paper.teachingMaterialId = createdMaterials[0]?._id || null;
        paper.title = `${base.baseTitle} • Practice Paper`;
        paper.description = `Auto-generated from lesson planner subtopic: ${base.subTopicTitle}`;
        paper.classId = plan.classId;
        paper.sectionId = plan.sectionId;
        paper.subjectId = plan.subjectId;
        paper.className = plan.className || '';
        paper.sectionName = plan.sectionName || '';
        paper.subjectName = plan.subject || '';
        paper.chapterId = base.chapterId;
        paper.chapterTitle = base.chapterTitle;
        paper.topicTitle = base.topicTitle;
        paper.subTopicTitle = base.subTopicTitle;
        paper.sourceLessonPlanId = plan._id;
        paper.teacherId = plan.teacherId;
        paper.teacherName = plan.teacherName || 'Teacher';
        paper.questions = questions;
        paper.duration = 20;
        paper.difficulty = 'mixed';
        paper.chapter = base.chapterTitle;
        paper.topics = [base.topicTitle, base.subTopicTitle].filter(Boolean);
        paper.passingPercentage = 40;
        paper.status = 'published';
        paper.publishedForStudentPortal = true;
        paper.publishedAt = new Date();
        paper.tags = ['lesson-plan', 'smart-learning', 'auto-published'];
        await paper.save();
      } else {
        paper = await PracticePaper.create({
          schoolId,
          campusId: campusId || null,
          teachingMaterialId: createdMaterials[0]?._id || null,
          title: `${base.baseTitle} • Practice Paper`,
          description: `Auto-generated from lesson planner subtopic: ${base.subTopicTitle}`,
          paperType: 'practice_set',
          classId: plan.classId,
          sectionId: plan.sectionId,
          subjectId: plan.subjectId,
          className: plan.className || '',
          sectionName: plan.sectionName || '',
          subjectName: plan.subject || '',
          chapterId: base.chapterId,
          chapterTitle: base.chapterTitle,
          topicTitle: base.topicTitle,
          subTopicTitle: base.subTopicTitle,
          sourceLessonPlanId: plan._id,
          teacherId: plan.teacherId,
          teacherName: plan.teacherName || 'Teacher',
          questions,
          duration: 20,
          difficulty: 'mixed',
          chapter: base.chapterTitle,
          topics: [base.topicTitle, base.subTopicTitle].filter(Boolean),
          passingPercentage: 40,
          status: 'published',
          publishedForStudentPortal: true,
          publishedAt: new Date(),
          tags: ['lesson-plan', 'smart-learning', 'auto-published'],
        });
      }
    }
  }

  await createPublishedStudentNotification({
    schoolId,
    campusId,
    plan,
    chapterTitle: base.chapterTitle,
    topicTitle: base.topicTitle,
    subTopicTitle: base.subTopicTitle,
  });

  return {
    materials: createdMaterials,
    assignment,
    paper,
    vectorIndexedAttachmentCount,
    vectorFailedAttachmentCount,
  };
};

const publishPlanLevelResourceMaterial = async ({ schoolId, campusId, plan }) => {
  const items = normalizeStringList(plan.materialsNeeded);
  const attachments = buildAttachmentList(items);
  if (!attachments.length) {
    return {
      material: null,
      vectorIndexedAttachmentCount: 0,
      vectorFailedAttachmentCount: 0,
    };
  }

  const chapterTitle = normalizeString(plan.title) || 'Study Materials';
  const materialFilter = {
    schoolId,
    sourceLessonPlanId: plan._id,
    sourceSubTopicId: 'plan-materials-needed',
    learningType: 'pdf',
  };
  if (campusId) materialFilter.campusId = campusId;

  const payload = {
    title: `${plan.subject || 'Subject'} • ${chapterTitle} • Uploaded Materials`,
    content: buildMaterialContent('Uploaded Materials', chapterTitle, items),
    attachments,
    materialType: 'reading',
    learningType: 'pdf',
    typeLabel: 'Uploaded Materials',
    category: 'reference',
    chapterId: normalizeIdValue(plan._id),
    chapterTitle,
    topicTitle: chapterTitle,
    subTopicTitle: 'Uploaded Materials',
    sourceSubTopicId: 'plan-materials-needed',
  };

  let material = await TeachingMaterial.findOne(materialFilter);
  if (material) {
    material.title = payload.title;
    material.content = payload.content;
    material.materialType = payload.materialType;
    material.learningType = payload.learningType;
    material.typeLabel = payload.typeLabel;
    material.classId = plan.classId;
    material.sectionId = plan.sectionId;
    material.subjectId = plan.subjectId;
    material.className = plan.className || '';
    material.sectionName = plan.sectionName || '';
    material.subjectName = plan.subject || '';
    material.chapterId = payload.chapterId;
    material.chapterTitle = payload.chapterTitle;
    material.topicTitle = payload.topicTitle;
    material.subTopicTitle = payload.subTopicTitle;
    material.sourceLessonPlanId = plan._id;
    material.sourceSubTopicId = payload.sourceSubTopicId;
    material.teacherId = plan.teacherId;
    material.teacherName = plan.teacherName || 'Teacher';
    material.status = 'published';
    material.publishedForStudentPortal = true;
    material.publishedAt = new Date();
    material.priority = 'medium';
    material.difficulty = 'intermediate';
    material.category = payload.category;
    material.tags = ['lesson-plan', 'smart-learning', 'uploaded-material'];
    material.attachments = payload.attachments;
    await material.save();
  } else {
    material = await TeachingMaterial.create({
      schoolId,
      campusId: campusId || null,
      title: payload.title,
      content: payload.content,
      materialType: payload.materialType,
      learningType: payload.learningType,
      typeLabel: payload.typeLabel,
      classId: plan.classId,
      sectionId: plan.sectionId,
      subjectId: plan.subjectId,
      className: plan.className || '',
      sectionName: plan.sectionName || '',
      subjectName: plan.subject || '',
      chapterId: payload.chapterId,
      chapterTitle: payload.chapterTitle,
      topicTitle: payload.topicTitle,
      subTopicTitle: payload.subTopicTitle,
      sourceLessonPlanId: plan._id,
      sourceSubTopicId: payload.sourceSubTopicId,
      teacherId: plan.teacherId,
      teacherName: plan.teacherName || 'Teacher',
      status: 'published',
      publishedForStudentPortal: true,
      publishedAt: new Date(),
      priority: 'medium',
      difficulty: 'intermediate',
      category: payload.category,
      tags: ['lesson-plan', 'smart-learning', 'uploaded-material'],
      attachments: payload.attachments,
    });
  }

  const vectorResult = await ingestPublishedMaterialAttachments(material);
  return { material, ...vectorResult };
};

const publishPlanSmartLearningArtifacts = async ({ schoolId, campusId, plan }) => {
  const planner = sanitizePlannerContent(plan.plannerContent);
  const publishedArtifacts = [];
  const planResource = await publishPlanLevelResourceMaterial({ schoolId, campusId, plan });

  for (let chapterIndex = 0; chapterIndex < (planner.chapters || []).length; chapterIndex += 1) {
    const chapter = planner.chapters[chapterIndex];
    for (let topicIndex = 0; topicIndex < (chapter.topics || []).length; topicIndex += 1) {
      const topic = chapter.topics[topicIndex];
      for (let subTopicIndex = 0; subTopicIndex < (topic.subTopics || []).length; subTopicIndex += 1) {
        const subTopic = topic.subTopics[subTopicIndex];
        const artifacts = await publishSmartLearningArtifacts({
          schoolId,
          campusId,
          plan,
          chapter,
          topic,
          subTopic,
          chapterIndex,
          topicIndex,
          subTopicIndex,
        });
        publishedArtifacts.push(artifacts);
      }
    }
  }

  return {
    publishedArtifacts,
    publishedCount: publishedArtifacts.length,
    vectorIndexedAttachmentCount: publishedArtifacts.reduce(
      (sum, item) => sum + Number(item?.vectorIndexedAttachmentCount || 0),
      Number(planResource.vectorIndexedAttachmentCount || 0)
    ),
    vectorFailedAttachmentCount: publishedArtifacts.reduce(
      (sum, item) => sum + Number(item?.vectorFailedAttachmentCount || 0),
      Number(planResource.vectorFailedAttachmentCount || 0)
    ),
  };
};

const sanitizePlannerContent = (value) => {
  if (!value || typeof value !== 'object') return { chapters: [] };
  const chapters = Array.isArray(value.chapters) ? value.chapters : [];

  return {
    chapters: chapters.map((chapter, chapterIndex) => {
      const topics = Array.isArray(chapter?.topics) ? chapter.topics : [];
      return {
        id: normalizeString(chapter?.id) || `chapter-${chapterIndex + 1}`,
        title: normalizeString(chapter?.title),
        topics: topics.map((topic, topicIndex) => {
          const subTopics = Array.isArray(topic?.subTopics) ? topic.subTopics : [];
          return {
            id: normalizeString(topic?.id) || `topic-${chapterIndex + 1}-${topicIndex + 1}`,
            title: normalizeString(topic?.title),
            subTopics: subTopics.map((subTopic, subTopicIndex) => ({
              id: normalizeString(subTopic?.id) || `subtopic-${chapterIndex + 1}-${topicIndex + 1}-${subTopicIndex + 1}`,
              title: normalizeString(subTopic?.title),
              learningPaths: normalizeStringList(subTopic?.learningPaths),
              studyMaterials: normalizeStringList(subTopic?.studyMaterials),
              mindMaps: normalizeStringList(subTopic?.mindMaps),
              worksheets: normalizeStringList(subTopic?.worksheets),
              referenceMaterials: normalizeStringList(subTopic?.referenceMaterials),
              tryoutSections: normalizeTryoutList(subTopic?.tryoutSections),
              selfAssessments: normalizeStringList(subTopic?.selfAssessments),
              questionPapers: {
                basic: normalizeString(subTopic?.questionPapers?.basic),
                intermediate: normalizeString(subTopic?.questionPapers?.intermediate),
                advanced: normalizeString(subTopic?.questionPapers?.advanced),
              },
            })),
          };
        }),
      };
    }),
  };
};

const resolveSchoolId = (req) => req.schoolId || req.admin?.schoolId || req.user?.schoolId || null;

const resolveCampusId = (req) => req.campusId || req.admin?.campusId || req.user?.campusId || null;

const buildClassFilter = (schoolId, campusId) => {
  const filter = { schoolId };
  if (campusId) filter.campusId = campusId;
  return filter;
};

const buildSectionFilter = (schoolId, campusId, classId) => {
  const filter = { schoolId, classId };
  if (campusId) filter.campusId = campusId;
  return filter;
};

const buildTimetableFilter = (schoolId, campusId, classId, sectionId) => {
  const filter = { schoolId, classId, sectionId };
  if (campusId) filter.campusId = campusId;
  return filter;
};

const parsePlanDate = (value) => {
  const normalized = normalizeString(value);
  const pureDateMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (pureDateMatch) {
    const year = Number(pureDateMatch[1]);
    const month = Number(pureDateMatch[2]);
    const day = Number(pureDateMatch[3]);
    const localDate = new Date(year, month - 1, day);
    if (!Number.isNaN(localDate.getTime())) return localDate;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toDayStart = (value) => {
  const parsed = parsePlanDate(value);
  if (!parsed) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const normalizeCompletionPayload = ({ status, isCompleted, completionPercent }) => {
  const explicitStatus = normalizeLower(status);
  const normalizedPercent = Number.isFinite(Number(completionPercent))
    ? Math.max(0, Math.min(100, Number(completionPercent)))
    : null;
  const normalizedCompleted = typeof isCompleted === 'boolean' ? isCompleted : null;

  if (explicitStatus === 'completed') {
    return { status: 'completed', isCompleted: true, completionPercent: 100 };
  }
  if (explicitStatus === 'in_progress') {
    return {
      status: 'in_progress',
      isCompleted: false,
      completionPercent: normalizedPercent === null ? 50 : normalizedPercent,
    };
  }
  if (explicitStatus === 'pending') {
    return { status: 'pending', isCompleted: false, completionPercent: 0 };
  }

  if (normalizedCompleted === true) {
    return { status: 'completed', isCompleted: true, completionPercent: 100 };
  }
  if (normalizedPercent !== null) {
    if (normalizedPercent >= 100) return { status: 'completed', isCompleted: true, completionPercent: 100 };
    if (normalizedPercent > 0) return { status: 'in_progress', isCompleted: false, completionPercent: normalizedPercent };
  }

  return { status: 'pending', isCompleted: false, completionPercent: 0 };
};

const getAllocationCombos = async ({ schoolId, campusId, classId, sectionId, teacherId = null }) => {
  const timetables = await Timetable.find(buildTimetableFilter(schoolId, campusId, classId, sectionId))
    .populate('entries.teacherId', 'name')
    .populate('entries.subjectId', 'name')
    .lean();

  const comboMap = new Map();
  timetables.forEach((tt) => {
    (tt.entries || []).forEach((entry) => {
      const tid = entry.teacherId?._id;
      const sid = entry.subjectId?._id;
      const tname = entry.teacherId?.name;
      const sname = entry.subjectId?.name;
      if (!tid || !sid || !tname || !sname) return;
      if (teacherId && String(tid) !== String(teacherId)) return;
      const key = `${tid}::${sid}`;
      if (!comboMap.has(key)) {
        comboMap.set(key, {
          teacherId: String(tid),
          teacherName: String(tname),
          subjectId: String(sid),
          subjectName: String(sname),
          label: `${tname} (${sname})`
        });
      }
    });
  });

  return Array.from(comboMap.values()).sort((a, b) => a.label.localeCompare(b.label));
};

const resolvePlanPayload = async ({ schoolId, campusId, payload, forcedTeacherId = null }) => {
  const {
    classId,
    sectionId,
    teacherId: incomingTeacherId,
    subjectId,
    title,
    subject,
    date,
    duration,
    learningObjectives,
    instructionalFlow,
    explanation,
    recap,
    materialsNeeded,
    additionalNotes,
    plannerContent,
  } = payload || {};

  const teacherId = forcedTeacherId || incomingTeacherId;

  if (!classId || !sectionId || !teacherId || !subjectId || !title || !date) {
    return { error: 'classId, sectionId, teacherId, subjectId, title and date are required' };
  }

  const classFilter = { schoolId, _id: classId };
  if (campusId) classFilter.campusId = campusId;
  const classDoc = await ClassModel.findOne(classFilter).lean();
  if (!classDoc) return { error: 'Class not found', status: 404 };

  const sectionFilter = { schoolId, classId, _id: sectionId };
  if (campusId) sectionFilter.campusId = campusId;
  const sectionDoc = await Section.findOne(sectionFilter).lean();
  if (!sectionDoc) return { error: 'Section not found', status: 404 };

  const combos = await getAllocationCombos({ schoolId, campusId, classId, sectionId, teacherId: forcedTeacherId || null });
  const selectedCombo = combos.find((item) => String(item.teacherId) === String(teacherId) && String(item.subjectId) === String(subjectId));

  if (!selectedCombo) {
    return {
      error: forcedTeacherId
        ? 'You are not allocated to this class/section with this subject in timetable'
        : 'Selected teacher is not allocated for this class/section with this subject in timetable',
      status: 403,
    };
  }

  const parsedDate = parsePlanDate(date);
  if (!parsedDate) return { error: 'Invalid date' };

  return {
    data: {
      classId,
      sectionId,
      teacherId,
      subjectId,
      className: classDoc.name || '',
      sectionName: sectionDoc.name || '',
      teacherName: selectedCombo.teacherName || 'Teacher',
      subject: normalizeString(subject) || selectedCombo.subjectName,
      title: normalizeString(title),
      date: parsedDate,
      duration: normalizeString(duration),
      learningObjectives: Array.isArray(learningObjectives)
        ? learningObjectives.map((item) => normalizeString(item)).filter(Boolean)
        : [],
      instructionalFlow: Array.isArray(instructionalFlow)
        ? instructionalFlow
            .filter((item) => item && typeof item === 'object')
            .map((item) => ({
              id: normalizeString(item.id),
              phase: normalizeString(item.phase),
              duration: normalizeString(item.duration),
              description: normalizeString(item.description),
            }))
        : [],
      explanation: normalizeString(explanation),
      recap: normalizeString(recap),
      materialsNeeded: Array.isArray(materialsNeeded)
        ? materialsNeeded.map((item) => normalizeString(item)).filter(Boolean)
        : [],
      additionalNotes: normalizeString(additionalNotes),
      plannerContent: sanitizePlannerContent(plannerContent),
    },
  };
};

router.get('/admin/options', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const requestedClassId = normalizeString(req.query?.classId);
    const requestedSectionId = normalizeString(req.query?.sectionId);

    const classes = await ClassModel.find(buildClassFilter(schoolId, campusId))
      .select('name')
      .sort({ name: 1 })
      .lean();

    let sections = [];
    if (requestedClassId) {
      sections = await Section.find(buildSectionFilter(schoolId, campusId, requestedClassId))
        .select('name classId')
        .sort({ name: 1 })
        .lean();
    }

    const allocations = requestedClassId && requestedSectionId
      ? await getAllocationCombos({ schoolId, campusId, classId: requestedClassId, sectionId: requestedSectionId })
      : [];

    res.json({
      classes: classes.map((item) => ({ id: String(item._id), name: item.name })),
      sections: sections.map((item) => ({ id: String(item._id), name: item.name, classId: String(item.classId) })),
      allocations,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teacher/options', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const requestedClassId = normalizeString(req.query?.classId);
    const requestedSectionId = normalizeString(req.query?.sectionId);

    const ttFilter = { schoolId, 'entries.teacherId': teacherId };
    if (campusId) ttFilter.campusId = campusId;

    const teacherTables = await Timetable.find(ttFilter)
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .populate('entries.subjectId', 'name')
      .lean();

    const classMap = new Map();
    const sectionMap = new Map();

    teacherTables.forEach((tt) => {
      const cid = String(tt.classId?._id || '');
      const sid = String(tt.sectionId?._id || '');
      if (!cid || !sid) return;
      if (!classMap.has(cid)) classMap.set(cid, { id: cid, name: tt.classId?.name || '' });
      const skey = `${cid}::${sid}`;
      if (!sectionMap.has(skey)) sectionMap.set(skey, { id: sid, classId: cid, name: tt.sectionId?.name || '' });
    });

    const classes = Array.from(classMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const sections = Array.from(sectionMap.values())
      .filter((sec) => !requestedClassId || sec.classId === requestedClassId)
      .sort((a, b) => a.name.localeCompare(b.name));

    let subjects = [];
    if (requestedClassId && requestedSectionId) {
      const combos = await getAllocationCombos({
        schoolId,
        campusId,
        classId: requestedClassId,
        sectionId: requestedSectionId,
        teacherId,
      });
      subjects = combos.map((combo) => ({
        subjectId: combo.subjectId,
        subjectName: combo.subjectName,
      }));
    }

    res.json({ classes, sections, subjects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const filter = { schoolId };
    if (campusId) filter.campusId = campusId;

    const plans = await LessonPlan.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const resolved = await resolvePlanPayload({ schoolId, campusId, payload: req.body });
    if (resolved.error) return res.status(resolved.status || 400).json({ error: resolved.error });

    const plan = await LessonPlan.create({
      schoolId,
      campusId: campusId || null,
      ...resolved.data,
      createdBy: req.admin?.id || null,
      updatedBy: req.admin?.id || null,
    });

    res.status(201).json({ message: 'Lesson plan created', plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/admin/:id', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const id = req.params?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const filter = { _id: id, schoolId };
    if (campusId) filter.campusId = campusId;

    const existing = await LessonPlan.findOne(filter);
    if (!existing) return res.status(404).json({ error: 'Lesson plan not found' });

    const resolved = await resolvePlanPayload({ schoolId, campusId, payload: req.body });
    if (resolved.error) return res.status(resolved.status || 400).json({ error: resolved.error });

    Object.assign(existing, resolved.data, { updatedBy: req.admin?.id || null });
    if (existing.status === 'published') {
      existing.status = 'draft';
      existing.publishedAt = null;
      existing.publishedBy = null;
    }
    await existing.save();

    res.json({ message: 'Lesson plan updated', plan: existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/:id', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const id = req.params?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const filter = { _id: id, schoolId };
    if (campusId) filter.campusId = campusId;

    const deleted = await LessonPlan.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ error: 'Lesson plan not found' });

    res.json({ message: 'Lesson plan deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teacher/my', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { schoolId, teacherId };
    if (campusId) filter.campusId = campusId;

    const plans = await LessonPlan.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teacher/drafts', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { schoolId, teacherId, isDraft: true };
    if (campusId) filter.campusId = campusId;

    const drafts = await LessonPlan.find(filter).sort({ updatedAt: -1 }).lean();
    res.json({ success: true, data: drafts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teacher/draft/:id', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const id = req.params?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { _id: id, schoolId, teacherId };
    if (campusId) filter.campusId = campusId;

    const draft = await LessonPlan.findOne(filter).lean();
    if (!draft) return res.status(404).json({ error: 'Draft not found' });

    res.json({ success: true, data: draft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teacher/draft', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const { title, rawChapters, classId, sectionId, subjectId } = req.body;

    const draftData = {
      schoolId,
      campusId: campusId || null,
      teacherId,
      title: normalizeString(title) || 'Untitled Draft',
      rawChapters: rawChapters || [],
      isDraft: true,
      status: 'draft',
      learningObjectives: [],
      materialsNeeded: [],
      additionalNotes: '',
      plannerContent: { chapters: [] }
    };

    // Only add IDs if they are valid ObjectIds
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      draftData.classId = classId;
    }
    if (sectionId && mongoose.Types.ObjectId.isValid(sectionId)) {
      draftData.sectionId = sectionId;
    }
    if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
      draftData.subjectId = subjectId;
    }

    const plan = await LessonPlan.create(draftData);

    res.status(201).json({ success: true, message: 'Draft created', data: plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/teacher/draft/:id', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const id = req.params?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { _id: id, schoolId, teacherId };
    if (campusId) filter.campusId = campusId;

    const existing = await LessonPlan.findOne(filter);
    if (!existing) return res.status(404).json({ error: 'Draft not found' });

    const { title, rawChapters, classId, sectionId, subjectId } = req.body;

    if (title !== undefined) existing.title = normalizeString(title) || 'Untitled Draft';
    if (rawChapters !== undefined) existing.rawChapters = rawChapters;

    // Only update IDs if they are valid ObjectIds or explicitly null
    if (classId !== undefined) {
      existing.classId = (classId && mongoose.Types.ObjectId.isValid(classId)) ? classId : null;
    }
    if (sectionId !== undefined) {
      existing.sectionId = (sectionId && mongoose.Types.ObjectId.isValid(sectionId)) ? sectionId : null;
    }
    if (subjectId !== undefined) {
      existing.subjectId = (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) ? subjectId : null;
    }

    await existing.save();

    res.json({ success: true, message: 'Draft updated', data: existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teacher/:lessonPlanId/status', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const lessonPlanId = req.params?.lessonPlanId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const planFilter = { _id: lessonPlanId, schoolId, teacherId };
    if (campusId) planFilter.campusId = campusId;
    const plan = await LessonPlan.findOne(planFilter).lean();
    if (!plan) return res.status(404).json({ error: 'Lesson plan not found' });

    const statusFilter = { schoolId, lessonPlanId, teacherId };
    if (campusId) statusFilter.campusId = campusId;
    const statuses = await LessonPlanCompletion.find(statusFilter).sort({ date: -1, createdAt: -1 }).lean();

    res.json(statuses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teacher/:lessonPlanId/status', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const lessonPlanId = req.params?.lessonPlanId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const planFilter = { _id: lessonPlanId, schoolId, teacherId };
    if (campusId) planFilter.campusId = campusId;
    const plan = await LessonPlan.findOne(planFilter).lean();
    if (!plan) return res.status(404).json({ error: 'Lesson plan not found' });

    const dayDate = toDayStart(req.body?.date);
    if (!dayDate) return res.status(400).json({ error: 'Valid date is required' });
    const normalized = normalizeCompletionPayload({
      status: req.body?.status,
      isCompleted: req.body?.isCompleted,
      completionPercent: req.body?.completionPercent,
    });

    const update = {
      schoolId,
      campusId: campusId || null,
      lessonPlanId: plan._id,
      classId: plan.classId,
      sectionId: plan.sectionId,
      teacherId: plan.teacherId,
      subjectId: plan.subjectId,
      className: plan.className || '',
      sectionName: plan.sectionName || '',
      teacherName: plan.teacherName || 'Teacher',
      subject: plan.subject || '',
      title: plan.title || '',
      date: dayDate,
      status: normalized.status,
      isCompleted: normalized.isCompleted,
      completionPercent: normalized.completionPercent,
      remarks: String(req.body?.remarks || '').trim(),
    };

    const completion = await LessonPlanCompletion.findOneAndUpdate(
      { schoolId, campusId: campusId || null, lessonPlanId: plan._id, date: dayDate },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: 'Status saved', completion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/teacher/:lessonPlanId/status/:statusId', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const lessonPlanId = req.params?.lessonPlanId;
    const statusId = req.params?.statusId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { _id: statusId, schoolId, lessonPlanId, teacherId };
    if (campusId) filter.campusId = campusId;
    const existing = await LessonPlanCompletion.findOne(filter);
    if (!existing) return res.status(404).json({ error: 'Status not found' });

    if (req.body?.date) {
      const nextDate = toDayStart(req.body.date);
      if (!nextDate) return res.status(400).json({ error: 'Invalid date' });
      existing.date = nextDate;
    }
    const normalized = normalizeCompletionPayload({
      status: req.body?.status,
      isCompleted: req.body?.isCompleted,
      completionPercent: req.body?.completionPercent,
    });
    existing.status = normalized.status;
    existing.isCompleted = normalized.isCompleted;
    existing.completionPercent = normalized.completionPercent;
    existing.remarks = String(req.body?.remarks || '').trim();
    await existing.save();

    res.json({ message: 'Status updated', completion: existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/teacher/:lessonPlanId/status/:statusId', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const lessonPlanId = req.params?.lessonPlanId;
    const statusId = req.params?.statusId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { _id: statusId, schoolId, lessonPlanId, teacherId };
    if (campusId) filter.campusId = campusId;
    const deleted = await LessonPlanCompletion.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ error: 'Status not found' });

    res.json({ message: 'Status deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/student/status', authStudent, async (req, res) => {
  try {
    logStudentPortalEvent(req, {
      feature: 'lesson_plan_status',
      action: 'lesson_plan_status.fetch',
      targetType: 'student',
      targetId: req.user?.id,
      fromDate: req.query?.fromDate || undefined,
      toDate: req.query?.toDate || undefined,
    });
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const studentId = req.user?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const studentFilter = { _id: studentId, schoolId };
    if (campusId) studentFilter.campusId = campusId;
    const student = await StudentUser.findOne(studentFilter).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const className = normalizeLower(student.grade);
    const sectionName = normalizeLower(student.section);
    if (!className || !sectionName) {
      logStudentPortalEvent(req, {
        feature: 'lesson_plan_status',
        action: 'lesson_plan_status.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'student',
        targetId: studentId,
        resultCount: 0,
      });
      return res.json([]);
    }

    const planFilter = {
      schoolId,
      className: { $regex: `^${escapeRegex(className)}$`, $options: 'i' },
      sectionName: { $regex: `^${escapeRegex(sectionName)}$`, $options: 'i' },
    };
    if (campusId) planFilter.campusId = campusId;
    if (req.query?.fromDate || req.query?.toDate) {
      planFilter.date = {};
      if (req.query?.fromDate) {
        const from = toDayStart(req.query.fromDate);
        if (from) planFilter.date.$gte = from;
      }
      if (req.query?.toDate) {
        const to = toDayStart(req.query.toDate);
        if (to) {
          to.setHours(23, 59, 59, 999);
          planFilter.date.$lte = to;
        }
      }
      if (!Object.keys(planFilter.date).length) delete planFilter.date;
    }

    const plans = await LessonPlan.find(planFilter).sort({ date: -1, createdAt: -1 }).lean();
    if (!plans.length) {
      logStudentPortalEvent(req, {
        feature: 'lesson_plan_status',
        action: 'lesson_plan_status.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'student',
        targetId: studentId,
        resultCount: 0,
      });
      return res.json([]);
    }

    const planIds = plans.map((plan) => plan._id);
    const statusFilter = { schoolId, lessonPlanId: { $in: planIds } };
    if (campusId) statusFilter.campusId = campusId;
    if (req.query?.fromDate || req.query?.toDate) {
      statusFilter.date = {};
      if (req.query?.fromDate) {
        const from = toDayStart(req.query.fromDate);
        if (from) statusFilter.date.$gte = from;
      }
      if (req.query?.toDate) {
        const to = toDayStart(req.query.toDate);
        if (to) {
          to.setHours(23, 59, 59, 999);
          statusFilter.date.$lte = to;
        }
      }
      if (!Object.keys(statusFilter.date).length) {
        delete statusFilter.date;
      }
    }

    const statuses = await LessonPlanCompletion.find(statusFilter).sort({ date: -1, createdAt: -1 }).lean();
    const planById = new Map(plans.map((plan) => [String(plan._id), plan]));
    const statusKeySet = new Set(
      statuses.map((row) => `${String(row.lessonPlanId)}::${toDayStart(row.date)?.toISOString() || ''}`)
    );

    const defaultPending = plans
      .map((plan) => {
        const date = toDayStart(plan.date);
        const key = `${String(plan._id)}::${date?.toISOString() || ''}`;
        if (!date || statusKeySet.has(key)) return null;
        return {
          _id: `pending-${plan._id}-${date.toISOString()}`,
          lessonPlanId: plan._id,
          title: plan.title,
          subject: plan.subject,
          className: plan.className,
          sectionName: plan.sectionName,
          teacherName: plan.teacherName,
          date,
          status: 'pending',
          isCompleted: false,
          completionPercent: 0,
          remarks: '',
        };
      })
      .filter(Boolean);

    const normalizedStatuses = statuses.map((row) => {
      const plan = planById.get(String(row.lessonPlanId));
      return {
        ...row,
        title: row.title || plan?.title || '',
        subject: row.subject || plan?.subject || '',
        className: row.className || plan?.className || '',
        sectionName: row.sectionName || plan?.sectionName || '',
        teacherName: row.teacherName || plan?.teacherName || 'Teacher',
      };
    });

    const data = [...normalizedStatuses, ...defaultPending].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    res.json(data);
    logStudentPortalEvent(req, {
      feature: 'lesson_plan_status',
      action: 'lesson_plan_status.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: studentId,
      resultCount: data.length,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'lesson_plan_status',
      action: 'lesson_plan_status.fetch',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(500).json({ error: err.message });
  }
});

router.post('/teacher', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const resolved = await resolvePlanPayload({ schoolId, campusId, payload: req.body, forcedTeacherId: teacherId });
    if (resolved.error) return res.status(resolved.status || 400).json({ error: resolved.error });

    const draftId = req.body?.draftId;

    let plan;
    if (draftId) {
      const filter = { _id: draftId, schoolId, teacherId, isDraft: true };
      if (campusId) filter.campusId = campusId;

      const existingDraft = await LessonPlan.findOne(filter);
      if (existingDraft) {
        Object.assign(existingDraft, resolved.data, {
          isDraft: false,
          status: 'published',
          publishedAt: new Date()
        });
        await existingDraft.save();
        plan = existingDraft;
      } else {
        plan = await LessonPlan.create({
          schoolId,
          campusId: campusId || null,
          ...resolved.data,
          isDraft: false,
          status: 'published',
          publishedAt: new Date()
        });
      }
    } else {
      plan = await LessonPlan.create({
        schoolId,
        campusId: campusId || null,
        ...resolved.data,
        isDraft: false,
        status: 'published',
        publishedAt: new Date()
      });
    }

    const publishResult = await publishPlanSmartLearningArtifacts({ schoolId, campusId, plan });

    res.status(201).json({
      message: 'Lesson plan created',
      plan,
      publishedCount: publishResult.publishedCount,
      vectorIndexedAttachmentCount: publishResult.vectorIndexedAttachmentCount,
      vectorFailedAttachmentCount: publishResult.vectorFailedAttachmentCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/teacher/:id', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const id = req.params?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { _id: id, schoolId, teacherId };
    if (campusId) filter.campusId = campusId;

    const existing = await LessonPlan.findOne(filter);
    if (!existing) return res.status(404).json({ error: 'Lesson plan not found' });

    const resolved = await resolvePlanPayload({ schoolId, campusId, payload: req.body, forcedTeacherId: teacherId });
    if (resolved.error) return res.status(resolved.status || 400).json({ error: resolved.error });

    Object.assign(existing, resolved.data);
    if (existing.status === 'published') {
      existing.status = 'draft';
      existing.publishedAt = null;
      existing.publishedBy = null;
    }
    await existing.save();

    res.json({ message: 'Lesson plan updated', plan: existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teacher/:id/publish', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const id = req.params?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { _id: id, schoolId, teacherId };
    if (campusId) filter.campusId = campusId;

    const plan = await LessonPlan.findOne(filter);
    if (!plan) return res.status(404).json({ error: 'Lesson plan not found' });

    const publishResult = await publishPlanSmartLearningArtifacts({ schoolId, campusId, plan });

    plan.status = 'published';
    plan.publishedAt = new Date();
    plan.publishedBy = teacherId;
    plan.publishedVersion = (Number(plan.publishedVersion) || 0) + 1;
    await plan.save();

    res.json({
      message: 'Lesson plan published to Smart Learning',
      plan,
      publishedCount: publishResult.publishedCount,
      vectorIndexedAttachmentCount: publishResult.vectorIndexedAttachmentCount,
      vectorFailedAttachmentCount: publishResult.vectorFailedAttachmentCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teacher/:id/publish-subtopic', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const id = req.params?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const { chapterIndex, topicIndex, subTopicIndex, publishPracticePaper = true } = req.body || {};
    if (![chapterIndex, topicIndex, subTopicIndex].every((v) => Number.isInteger(v) && v >= 0)) {
      return res.status(400).json({ error: 'chapterIndex, topicIndex and subTopicIndex must be non-negative integers' });
    }

    const filter = { _id: id, schoolId, teacherId };
    if (campusId) filter.campusId = campusId;

    const plan = await LessonPlan.findOne(filter).lean();
    if (!plan) return res.status(404).json({ error: 'Lesson plan not found' });

    const planner = sanitizePlannerContent(plan.plannerContent);
    const chapter = planner?.chapters?.[chapterIndex];
    const topic = chapter?.topics?.[topicIndex];
    const subTopic = topic?.subTopics?.[subTopicIndex];

    if (!chapter || !topic || !subTopic) {
      return res.status(404).json({ error: 'Subtopic not found in planner content' });
    }

    const artifacts = await publishSmartLearningArtifacts({
      schoolId,
      campusId,
      plan,
      chapter,
      topic,
      subTopic,
      chapterIndex,
      topicIndex,
      subTopicIndex,
      publishAssignment: true,
      publishPracticePaper,
    });

    return res.status(201).json({
      message: 'Published to student portal',
      ...artifacts,
      material: artifacts.materials?.[0] || null,
      paper: artifacts.paper || null,
      assignment: artifacts.assignment || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/teacher/:id', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    const id = req.params?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { _id: id, schoolId, teacherId };
    if (campusId) filter.campusId = campusId;

    const deleted = await LessonPlan.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ error: 'Lesson plan not found' });

    res.json({ message: 'Lesson plan deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/teacher/smart-learning/chapter', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const { classId, sectionId, subjectId, chapterTitle } = req.body || {};
    const title = normalizeString(chapterTitle);
    if (!classId || !sectionId || !subjectId || !title) {
      return res.status(400).json({ error: 'classId, sectionId, subjectId and chapterTitle are required' });
    }

    const planFilter = {
      schoolId,
      teacherId,
      classId,
      sectionId,
      subjectId,
      status: 'published',
      isDraft: false,
    };
    if (campusId) planFilter.campusId = campusId;

    const plans = await LessonPlan.find(planFilter);
    const matchingPlans = plans.filter((plan) => {
      const planner = sanitizePlannerContent(plan.plannerContent);
      return (planner.chapters || []).some((chapter) => normalizeLower(chapter?.title) === normalizeLower(title));
    });

    if (!matchingPlans.length) {
      return res.json({
        message: 'No published student chapter matched this title',
        archivedPlans: 0,
        updatedPlans: 0,
        archivedMaterials: 0,
        archivedPapers: 0,
        hiddenAssignments: 0,
      });
    }

    const matchingPlanIds = matchingPlans.map((plan) => plan._id);
    const artifactFilter = {
      schoolId,
      teacherId,
      sourceLessonPlanId: { $in: matchingPlanIds },
      chapterTitle: { $regex: `^${escapeRegex(title)}$`, $options: 'i' },
    };
    if (campusId) artifactFilter.campusId = campusId;

    const [materialResult, paperResult, assignmentResult] = await Promise.all([
      TeachingMaterial.updateMany(artifactFilter, { $set: { status: 'archived', publishedForStudentPortal: false } }),
      PracticePaper.updateMany(artifactFilter, { $set: { status: 'archived', publishedForStudentPortal: false } }),
      Assignment.updateMany(artifactFilter, { $set: { status: 'draft', publishedForStudentPortal: false } }),
    ]);

    let archivedPlans = 0;
    let updatedPlans = 0;
    for (const plan of matchingPlans) {
      const planner = sanitizePlannerContent(plan.plannerContent);
      const remainingChapters = (planner.chapters || []).filter((chapter) => normalizeLower(chapter?.title) !== normalizeLower(title));

      if (!remainingChapters.length) {
        plan.status = 'archived';
        plan.publishedForStudentPortal = false;
        archivedPlans += 1;
      } else {
        plan.plannerContent = { ...planner, chapters: remainingChapters };
        if (Array.isArray(plan.rawChapters)) {
          plan.rawChapters = plan.rawChapters.filter((chapter) => normalizeLower(chapter?.title) !== normalizeLower(title));
        }
        updatedPlans += 1;
      }
      await plan.save();
    }

    res.json({
      message: 'Chapter unpublished from Smart Learning',
      archivedPlans,
      updatedPlans,
      archivedMaterials: materialResult.modifiedCount || 0,
      archivedPapers: paperResult.modifiedCount || 0,
      hiddenAssignments: assignmentResult.modifiedCount || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/student/smart-learning-map', authStudent, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const studentId = req.user?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const studentFilter = { _id: studentId, schoolId };
    if (campusId) studentFilter.campusId = campusId;
    const student = await StudentUser.findOne(studentFilter).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const classId = student.classId || null;
    const sectionId = student.sectionId || null;

    const planFilter = {
      schoolId,
      status: 'published',
      isDraft: false
    };
    if (campusId) planFilter.campusId = campusId;

    if (classId && sectionId) {
      planFilter.classId = classId;
      planFilter.sectionId = sectionId;
    } else {
      const className = normalizeLower(student.grade);
      const sectionName = normalizeLower(student.section);
      if (!className || !sectionName) return res.json({ subjects: [] });
      planFilter.className = { $regex: '^' + escapeRegex(className) + '$', $options: 'i' };
      planFilter.sectionName = { $regex: '^' + escapeRegex(sectionName) + '$', $options: 'i' };
    }

    const plans = await LessonPlan.find(planFilter).sort({ date: -1, createdAt: -1 }).lean();

    const publishedPlans = plans.filter((plan) => plan.status !== 'draft');
    const planIds = publishedPlans.map((plan) => plan._id);
    const subjectIds = [...new Set(
      publishedPlans
        .map((plan) => String(plan.subjectId || '').trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )];
    const subjectDocs = subjectIds.length
      ? await Subject.find({ schoolId, _id: { $in: subjectIds }, ...(campusId ? { campusId } : {}) }).select('name').lean()
      : [];
    const subjectNameById = new Map(subjectDocs.map((subject) => [String(subject._id), normalizeString(subject.name)]));
    const materialFilter = {
      schoolId,
      status: 'published',
      publishedForStudentPortal: true,
      sourceLessonPlanId: { $in: planIds },
    };
    const paperFilter = {
      schoolId,
      status: 'published',
      publishedForStudentPortal: true,
      sourceLessonPlanId: { $in: planIds },
    };
    const assignmentFilter = {
      schoolId,
      status: 'active',
      publishedForStudentPortal: true,
      sourceLessonPlanId: { $in: planIds },
    };
    const standaloneMaterialFilter = {
      schoolId,
      status: 'published',
      materialType: { $ne: 'folder' },
      chapterTitle: { $exists: true, $ne: '' },
      $or: [
        { sourceLessonPlanId: null },
        { sourceLessonPlanId: { $exists: false } },
      ],
    };
    if (classId && sectionId) {
      standaloneMaterialFilter.classId = classId;
      standaloneMaterialFilter.sectionId = sectionId;
    } else {
      standaloneMaterialFilter.className = planFilter.className;
      standaloneMaterialFilter.sectionName = planFilter.sectionName;
    }
    if (campusId) {
      materialFilter.campusId = campusId;
      paperFilter.campusId = campusId;
      assignmentFilter.campusId = campusId;
      standaloneMaterialFilter.$and = [
        ...(standaloneMaterialFilter.$and || []),
        { $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] },
      ];
    }

    const [materials, papers, assignments, standaloneMaterials] = await Promise.all([
      TeachingMaterial.find(materialFilter).sort({ publishedAt: -1, createdAt: -1 }).lean(),
      PracticePaper.find(paperFilter).sort({ publishedAt: -1, createdAt: -1 }).lean(),
      Assignment.find(assignmentFilter).sort({ dueDate: -1, createdAt: -1 }).lean(),
      TeachingMaterial.find(standaloneMaterialFilter).sort({ publishedAt: -1, createdAt: -1 }).lean(),
    ]);

    const makeContentBucket = () => ({
      materials: [],
      assignments: [],
      assessments: [],
    });

    const subjectMap = new Map();
    const seenContentKeys = new Set();

    const getSubjectEntry = (plan) => {
      const subjectId = String(plan.subjectId || '').trim();
      const subjectTitle = subjectNameById.get(subjectId) || normalizeString(plan.subject) || normalizeString(plan.subjectName) || 'Subject';
      const subjectKey = normalizeLower(subjectTitle) || normalizeLower(plan.title);
      const mapKey = subjectId || subjectKey;
      if (!mapKey) return null;
      if (!subjectMap.has(mapKey)) {
        subjectMap.set(mapKey, {
          key: subjectKey,
          subjectId: subjectId || null,
          title: subjectTitle,
          chapters: new Map(),
          topics: new Map(),
          contentMetrics: {
            materials: 0,
            assignments: 0,
            assessments: 0,
          },
        });
      }
      return subjectMap.get(mapKey);
    };

    const getMaterialSubjectEntry = (material) => getSubjectEntry({
      subjectId: material.subjectId,
      subject: material.subjectName,
      subjectName: material.subjectName,
      title: material.subjectName || material.title,
    });

    const getChapterMapKey = (chapter, fallbackTitle = '') => {
      const title = normalizeLower(chapter?.title || fallbackTitle);
      return title || normalizeIdValue(chapter?.id);
    };

    const buildChapterMeta = (plan, chapter = null) => {
      const planDate = plan?.date ? new Date(plan.date) : null;
      const chapterDuration = normalizeString(chapter?.duration);
      const planDuration = normalizeString(plan?.duration);
      const learningObjectives = Array.isArray(plan?.learningObjectives)
        ? plan.learningObjectives.map((item) => normalizeString(item)).filter(Boolean)
        : [];
      const instructionalFlow = Array.isArray(plan?.instructionalFlow)
        ? plan.instructionalFlow.filter((item) => item && typeof item === 'object')
        : [];

      return {
        date: planDate && !Number.isNaN(planDate.getTime()) ? planDate.toISOString() : null,
        day: planDate && !Number.isNaN(planDate.getTime()) ? planDate.toLocaleDateString('en-US', { weekday: 'long' }) : '',
        duration: chapterDuration || planDuration || '',
        learningObjectives,
        instructionalFlow,
        explanation: normalizeString(plan?.explanation) || '',
        recap: normalizeString(plan?.recap) || '',
      };
    };

    const mergeChapterMeta = (currentMeta = {}, nextMeta = {}) => ({
      date: nextMeta.date || currentMeta.date || null,
      day: nextMeta.day || currentMeta.day || '',
      duration: nextMeta.duration || currentMeta.duration || '',
      learningObjectives: Array.from(new Set([...(currentMeta.learningObjectives || []), ...(nextMeta.learningObjectives || [])])),
      instructionalFlow: Array.isArray(nextMeta.instructionalFlow) && nextMeta.instructionalFlow.length > 0
        ? nextMeta.instructionalFlow
        : (Array.isArray(currentMeta.instructionalFlow) ? currentMeta.instructionalFlow : []),
      explanation: nextMeta.explanation || currentMeta.explanation || '',
      recap: nextMeta.recap || currentMeta.recap || '',
    });

    const ensureChapterTopicSubTopic = (subjectEntry, plan, chapter, topic, subTopic) => {
      const chapterTitle = normalizeString(chapter?.title) || 'Chapter';
      const topicTitle = normalizeString(topic?.title) || 'Topic';
      const subTopicTitle = normalizeString(subTopic?.title) || 'Sub Topic';
      const chapterId = normalizeIdValue(chapter?.id) || chapterTitle.toLowerCase();
      const chapterKey = getChapterMapKey(chapter, chapterTitle) || chapterId;
      const topicId = normalizeIdValue(topic?.id) || topicTitle.toLowerCase();
      const subTopicId = normalizeIdValue(subTopic?.id) || subTopicTitle.toLowerCase();

      if (!subjectEntry.chapters.has(chapterKey)) {
        subjectEntry.chapters.set(chapterKey, {
          id: chapterId,
          title: chapterTitle,
          uploads: [],
          meta: {},
          topics: new Map(),
        });
      }
      const chapterEntry = subjectEntry.chapters.get(chapterKey);
      chapterEntry.meta = mergeChapterMeta(chapterEntry.meta, buildChapterMeta(plan, chapter));

      if (!chapterEntry.topics.has(topicId)) {
        chapterEntry.topics.set(topicId, {
          id: topicId,
          title: topicTitle,
          subtopics: new Map(),
        });
      }
      const topicEntry = chapterEntry.topics.get(topicId);

      if (!subjectEntry.topics.has(topicId)) {
        subjectEntry.topics.set(topicId, {
          title: topicTitle,
          subtopics: new Set(),
        });
      }

      if (!topicEntry.subtopics.has(subTopicId)) {
        topicEntry.subtopics.set(subTopicId, {
          id: subTopicId,
          title: subTopicTitle,
          worksheetUploads: [],
          ...makeContentBucket(),
        });
      }

      return topicEntry.subtopics.get(subTopicId);
    };

    const attachPublishedContent = (doc, bucketKey) => {
      const plan = publishedPlans.find((item) => String(item._id) === String(doc.sourceLessonPlanId));
      if (!plan) return;
      const planner = sanitizePlannerContent(plan.plannerContent);
      const chapter = (planner.chapters || []).find((item) => normalizeString(item.title) === normalizeString(doc.chapterTitle))
        || (planner.chapters || []).find((item) => normalizeIdValue(item.id) === normalizeIdValue(doc.chapterId));
      const topic = chapter?.topics?.find((item) => normalizeString(item.title) === normalizeString(doc.topicTitle));
      const subTopic = topic?.subTopics?.find((item) => normalizeString(item.title) === normalizeString(doc.subTopicTitle));
      const subjectEntry = getSubjectEntry(plan);
      if (!subjectEntry || !chapter || !topic || !subTopic) return;
      const subTopicEntry = ensureChapterTopicSubTopic(subjectEntry, plan, chapter, topic, subTopic);
      const dedupeKey = [
        String(doc.sourceLessonPlanId || ''),
        bucketKey,
        String(doc.chapterId || ''),
        normalizeString(doc.topicTitle),
        normalizeString(doc.subTopicTitle),
        normalizeString(doc.learningType || doc.materialType || doc.paperType || ''),
      ].join('::');
      if (seenContentKeys.has(dedupeKey)) return;
      seenContentKeys.add(dedupeKey);

      const baseItem = {
        id: String(doc._id),
        title: doc.title || '',
        type: bucketKey,
        learningType: doc.learningType || doc.materialType || doc.paperType || 'note',
        status: doc.status || 'published',
        publishedAt: doc.publishedAt || doc.createdAt || null,
      };

      if (bucketKey === 'materials') {
        subTopicEntry.materials.push({
          ...baseItem,
          content: doc.content || doc.plainTextContent || '',
          attachments: Array.isArray(doc.attachments) ? doc.attachments : [],
          views: doc.views || 0,
          downloads: doc.downloads || 0,
          viewsBy: Array.isArray(doc.viewedBy) ? doc.viewedBy.length : 0,
        });
        subjectEntry.contentMetrics.materials += 1;
      } else if (bucketKey === 'assignments') {
        subTopicEntry.assignments.push({
          ...baseItem,
          description: doc.description || '',
          dueDate: doc.dueDate || null,
          marks: doc.marks || 0,
          attachments: Array.isArray(doc.attachments) ? doc.attachments : [],
          submissions: Array.isArray(doc.submissions) ? doc.submissions.length : 0,
        });
        subjectEntry.contentMetrics.assignments += 1;
      } else if (bucketKey === 'assessments') {
        subTopicEntry.assessments.push({
          ...baseItem,
          description: doc.description || '',
          duration: doc.duration || 0,
          totalQuestions: doc.totalQuestions || 0,
          attempts: doc.totalAttempts || 0,
          averageScore: doc.averageScore || 0,
        });
        subjectEntry.contentMetrics.assessments += 1;
      }
    };

    materials.forEach((doc) => attachPublishedContent(doc, 'materials'));
    assignments.forEach((doc) => attachPublishedContent(doc, 'assignments'));
    papers.forEach((doc) => attachPublishedContent(doc, 'assessments'));

    standaloneMaterials.forEach((material) => {
      const subjectEntry = getMaterialSubjectEntry(material);
      if (!subjectEntry) return;
      const chapterTitle = normalizeString(material.chapterTitle || material.chapterId);
      if (!chapterTitle) return;
      const chapterId = normalizeIdValue(material.chapterId) || chapterTitle.toLowerCase();
      const chapterKey = getChapterMapKey({ id: chapterId, title: chapterTitle }, chapterTitle) || chapterId;
      const topicTitle = normalizeString(material.topicTitle) || chapterTitle;
      const topicId = normalizeIdValue(material.topicTitle) || topicTitle.toLowerCase();
      const subTopicTitle = normalizeString(material.subTopicTitle) || 'Uploaded Materials';
      const subTopicId = normalizeIdValue(material.subTopicTitle) || subTopicTitle.toLowerCase();

      if (!subjectEntry.chapters.has(chapterKey)) {
        subjectEntry.chapters.set(chapterKey, {
          id: chapterId,
          title: chapterTitle,
          uploads: [],
          meta: {},
          topics: new Map(),
        });
      }

      const chapterEntry = subjectEntry.chapters.get(chapterKey);
      if (!chapterEntry.topics.has(topicId)) {
        chapterEntry.topics.set(topicId, {
          id: topicId,
          title: topicTitle,
          subtopics: new Map(),
        });
      }

      if (!subjectEntry.topics.has(topicId)) {
        subjectEntry.topics.set(topicId, {
          title: topicTitle,
          subtopics: new Set(),
          tryoutSections: [],
        });
      }
      subjectEntry.topics.get(topicId).subtopics.add(subTopicTitle);

      const topicEntry = chapterEntry.topics.get(topicId);
      if (!topicEntry.subtopics.has(subTopicId)) {
        topicEntry.subtopics.set(subTopicId, {
          id: subTopicId,
          title: subTopicTitle,
          worksheetUploads: [],
          ...makeContentBucket(),
        });
      }

      const subTopicEntry = topicEntry.subtopics.get(subTopicId);
      const dedupeKey = ['standalone-material', String(material._id || '')].join('::');
      if (seenContentKeys.has(dedupeKey)) return;
      seenContentKeys.add(dedupeKey);
      subTopicEntry.materials.push({
        id: String(material._id),
        title: material.title || '',
        type: 'materials',
        learningType: material.learningType || material.materialType || 'note',
        status: material.status || 'published',
        publishedAt: material.publishedAt || material.createdAt || null,
        content: material.content || material.plainTextContent || '',
        attachments: Array.isArray(material.attachments) ? material.attachments : [],
        views: material.views || 0,
        downloads: material.downloads || 0,
        viewsBy: Array.isArray(material.viewedBy) ? material.viewedBy.length : 0,
      });
      subjectEntry.contentMetrics.materials += 1;
    });

    publishedPlans.forEach((plan) => {
      const subjectEntry = getSubjectEntry(plan);
      if (!subjectEntry) return;
      const planner = sanitizePlannerContent(plan.plannerContent);
      (planner.chapters || []).forEach((chapter) => {
        const chapterId = normalizeIdValue(chapter.id) || normalizeString(chapter.title).toLowerCase();
        const chapterKey = getChapterMapKey(chapter) || chapterId;
        if (!subjectEntry.chapters.has(chapterKey)) {
          subjectEntry.chapters.set(chapterKey, {
            id: chapterId,
            title: normalizeString(chapter.title) || 'Chapter',
            uploads: [],
            topics: new Map(),
          });
        }
        const chapterEntry = subjectEntry.chapters.get(chapterKey);
        chapterEntry.meta = mergeChapterMeta(chapterEntry.meta, buildChapterMeta(plan, chapter));
        const planUploads = normalizeStringList(plan.materialsNeeded).map((item, index) => {
          const resource = parseResourceRef(item);
          return {
            id: `plan-upload-${chapterId}-${index + 1}`,
            title: resource.title,
            type: inferAttachmentType(resource.url || resource.title),
            bucket: resource.bucket || 'Uploaded Material',
            url: resource.url,
          };
        });
        if (planUploads.length > 0) {
          const existingUploadTitles = new Set((chapterEntry.uploads || []).map((item) => normalizeLower(item.title)));
          planUploads.forEach((upload) => {
            if (!existingUploadTitles.has(normalizeLower(upload.title))) {
              chapterEntry.uploads.push(upload);
              existingUploadTitles.add(normalizeLower(upload.title));
            }
          });
        }
        (chapter.topics || []).forEach((topic) => {
          const topicId = normalizeIdValue(topic.id) || normalizeString(topic.title).toLowerCase();
          if (!chapterEntry.topics.has(topicId)) {
            chapterEntry.topics.set(topicId, {
              id: topicId,
              title: normalizeString(topic.title) || 'Topic',
              subtopics: new Map(),
            });
          }
          if (!subjectEntry.topics.has(topicId)) {
            subjectEntry.topics.set(topicId, {
              title: normalizeString(topic.title) || 'Topic',
              subtopics: new Set(),
              tryoutSections: [],
            });
          }
          const topicEntry = subjectEntry.topics.get(topicId);
          if (!Array.isArray(topicEntry.tryoutSections)) topicEntry.tryoutSections = [];
          const chapterTopicEntry = chapterEntry.topics.get(topicId);
          (topic.subTopics || []).forEach((sub) => {
            const subTitle = normalizeString(sub.title);
            if (subTitle) topicEntry.subtopics.add(subTitle);
            const subTopicId = normalizeIdValue(sub.id) || subTitle.toLowerCase();
            const worksheetUploads = normalizeStringList(sub.worksheets).map((item, uploadIndex) => {
              const resource = parseResourceRef(item);
              return {
                id: `worksheet-${subTopicId}-${uploadIndex + 1}`,
                title: resource.title,
                type: inferAttachmentType(resource.url || resource.title),
                url: resource.url,
              };
            });
            if (subTitle && chapterTopicEntry && !chapterTopicEntry.subtopics.has(subTopicId)) {
              chapterTopicEntry.subtopics.set(subTopicId, {
                id: subTopicId,
                title: subTitle,
                worksheetUploads,
                ...makeContentBucket(),
              });
            } else if (subTitle && chapterTopicEntry) {
              const subTopicEntry = chapterTopicEntry.subtopics.get(subTopicId);
              subTopicEntry.worksheetUploads = worksheetUploads;
            }
            if (Array.isArray(sub.tryoutSections)) {
              topicEntry.tryoutSections.push(...sub.tryoutSections);
            }
          });
        });
      });
    });

    const subjects = Array.from(subjectMap.values()).map((subject) => ({
      key: subject.key,
      subjectId: subject.subjectId,
      title: subject.title,
      chapters: Array.from(subject.chapters.values()).map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        meta: chapter.meta || {},
        uploads: chapter.uploads || [],
        topics: Array.from(chapter.topics.values()).map((topic) => ({
          id: topic.id,
          title: topic.title,
          subtopics: Array.from(topic.subtopics.values()).map((subtopic) => ({
            id: subtopic.id,
            title: subtopic.title,
            worksheetUploads: subtopic.worksheetUploads || [],
            materials: subtopic.materials || [],
            assignments: subtopic.assignments || [],
            assessments: subtopic.assessments || [],
          })),
        })),
      })),
      topics: Array.from(subject.topics.values()).map((topic) => ({
        title: topic.title,
        subtopics: Array.from(topic.subtopics),
        tryoutSections: topic.tryoutSections,
      })),
    }));

    return res.json({ subjects });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/student/smart-learning-overview', authStudent, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const studentId = req.user?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const studentFilter = { _id: studentId, schoolId };
    if (campusId) studentFilter.campusId = campusId;
    const student = await StudentUser.findOne(studentFilter).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const classId = student.classId || null;
    const sectionId = student.sectionId || null;
    const scopeFilter = { schoolId, status: 'published', publishedForStudentPortal: true };
    if (campusId) scopeFilter.campusId = campusId;
    const studentScope = {};
    if (classId) studentScope.classId = classId;
    if (sectionId) studentScope.sectionId = sectionId;
    const legacyScope = (!classId || !sectionId) && student.grade && student.section
      ? {
          className: { $regex: `^${escapeRegex(normalizeLower(student.grade))}$`, $options: 'i' },
          sectionName: { $regex: `^${escapeRegex(normalizeLower(student.section))}$`, $options: 'i' },
        }
      : null;

    const [materials, papers, assignments, progress] = await Promise.all([
      TeachingMaterial.find(legacyScope ? { ...scopeFilter, ...legacyScope } : { ...scopeFilter, ...studentScope }).lean(),
      PracticePaper.find(legacyScope ? { ...scopeFilter, ...legacyScope } : { ...scopeFilter, ...studentScope }).lean(),
      Assignment.find({
        schoolId,
        status: 'active',
        publishedForStudentPortal: true,
        ...(campusId ? { campusId } : {}),
        ...(legacyScope ? legacyScope : studentScope),
      }).lean(),
      StudentProgress.findOne({ schoolId, studentId }).lean(),
    ]);

    const submissionIds = new Set((progress?.submissions || []).map((item) => String(item.assignmentId || '')).filter(Boolean));
    const completedMaterials = materials.filter((item) => Array.isArray(item.completedBy) && item.completedBy.some((entry) => String(entry.studentId) === String(studentId))).length;
    const viewedMaterials = materials.filter((item) => Array.isArray(item.viewedBy) && item.viewedBy.some((entry) => String(entry.studentId) === String(studentId))).length;
    const completedPapers = papers.filter((item) => Array.isArray(item.studentAttempts) && item.studentAttempts.some((attempt) => String(attempt.studentId) === String(studentId) && attempt.submittedAt)).length;
    const submittedAssignments = assignments.filter((item) => submissionIds.has(String(item._id))).length;
    const totalContent = materials.length + papers.length + assignments.length;
    const completedContent = completedMaterials + completedPapers + submittedAssignments;
    const overallProgress = totalContent > 0 ? Math.round((completedContent / totalContent) * 100) : 0;

    const subjectBuckets = new Map();
    [...materials, ...papers, ...assignments].forEach((item) => {
      const subjectName = normalizeString(item.subjectName || item.subject || '') || 'Subject';
      if (!subjectBuckets.has(subjectName)) {
        subjectBuckets.set(subjectName, {
          subject: subjectName,
          total: 0,
          completed: 0,
        });
      }
      const bucket = subjectBuckets.get(subjectName);
      bucket.total += 1;
      const isCompleted =
        (Array.isArray(item.completedBy) && item.completedBy.some((entry) => String(entry.studentId) === String(studentId))) ||
        (Array.isArray(item.studentAttempts) && item.studentAttempts.some((attempt) => String(attempt.studentId) === String(studentId) && attempt.submittedAt)) ||
        submissionIds.has(String(item._id));
      if (isCompleted) bucket.completed += 1;
    });

    res.json({
      overallProgress,
      learningHours: Math.round(
        materials.reduce((sum, item) => {
          const view = Array.isArray(item.viewedBy)
            ? item.viewedBy.find((entry) => String(entry.studentId) === String(studentId))
            : null;
          return sum + Number(view?.timeSpent || 0);
        }, 0) / 3600 * 100
      ) / 100,
      completedChapters: materials.length + papers.length + assignments.length > 0 ? Array.from(new Set([
        ...materials.filter((item) => Array.isArray(item.completedBy) && item.completedBy.some((entry) => String(entry.studentId) === String(studentId))).map((item) => item.chapterTitle || item.chapterId || ''),
        ...papers.filter((item) => Array.isArray(item.studentAttempts) && item.studentAttempts.some((attempt) => String(attempt.studentId) === String(studentId) && attempt.submittedAt)).map((item) => item.chapterTitle || item.chapterId || ''),
        ...assignments.filter((item) => submissionIds.has(String(item._id))).map((item) => item.chapterTitle || item.chapterId || ''),
      ].filter(Boolean))).length : 0,
      pendingChapters: Math.max(0, materials.length + papers.length + assignments.length - completedContent),
      assignmentStatus: {
        total: assignments.length,
        submitted: submittedAssignments,
        pending: Math.max(0, assignments.length - submittedAssignments),
      },
      assessmentScores: papers.map((item) => ({
        id: String(item._id),
        title: item.title || '',
        averageScore: Number(item.averageScore || 0),
        attempts: Number(item.totalAttempts || 0),
      })),
      subjectProgress: Array.from(subjectBuckets.values()).map((bucket) => ({
        ...bucket,
        progress: bucket.total > 0 ? Math.round((bucket.completed / bucket.total) * 100) : 0,
      })),
      contentTotals: {
        materials: materials.length,
        assessments: papers.length,
        assignments: assignments.length,
      },
      viewedMaterials,
      completedMaterials,
      completedAssessments: completedPapers,
      submittedAssignments,
      subjects: Array.from(subjectBuckets.values()).map((bucket) => ({
        key: normalizeLower(bucket.subject),
        title: bucket.subject,
        total: bucket.total,
        completed: bucket.completed,
        progress: bucket.total > 0 ? Math.round((bucket.completed / bucket.total) * 100) : 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teacher/smart-learning-analytics', authTeacher, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const campusId = resolveCampusId(req);
    const teacherId = req.user?.id || req.teacher?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const scopeFilter = {
      schoolId,
      teacherId,
      status: 'published',
      publishedForStudentPortal: true,
    };
    if (campusId) scopeFilter.campusId = campusId;

    const [plans, materials, papers, assignments, progressDocs] = await Promise.all([
      LessonPlan.find({
        schoolId,
        teacherId,
        status: 'published',
        ...(campusId ? { campusId } : {}),
      }).lean(),
      TeachingMaterial.find(scopeFilter).lean(),
      PracticePaper.find(scopeFilter).lean(),
      Assignment.find({
        schoolId,
        teacherId,
        status: 'active',
        publishedForStudentPortal: true,
        ...(campusId ? { campusId } : {}),
      }).lean(),
      StudentProgress.find({ schoolId }).select('studentId submissions progressMetrics').lean(),
    ]);

    const totalViews = materials.reduce((sum, item) => sum + Number(item.views || 0), 0);
    const totalDownloads = materials.reduce((sum, item) => sum + Number(item.downloads || 0), 0);
    const materialCompletion = materials.reduce((sum, item) => sum + (Array.isArray(item.completedBy) ? item.completedBy.length : 0), 0);
    const assessmentAttempts = papers.reduce((sum, item) => sum + Number(item.totalAttempts || 0), 0);
    const averageAssessmentScore = papers.length > 0
      ? Math.round(papers.reduce((sum, item) => sum + Number(item.averageScore || 0), 0) / papers.length)
      : 0;
    const studentIdsReached = new Set();
    materials.forEach((item) => (item.viewedBy || []).forEach((entry) => studentIdsReached.add(String(entry.studentId))));
    materials.forEach((item) => (item.completedBy || []).forEach((entry) => studentIdsReached.add(String(entry.studentId))));
    papers.forEach((item) => (item.studentAttempts || []).forEach((entry) => studentIdsReached.add(String(entry.studentId))));
    progressDocs.forEach((doc) => (doc.submissions || []).forEach((submission) => studentIdsReached.add(String(submission.studentId || doc.studentId || ''))));

    const chapterTitles = new Set([
      ...plans.map((plan) => String(plan.title || '').trim()).filter(Boolean),
      ...materials.map((item) => String(item.chapterTitle || '').trim()).filter(Boolean),
      ...papers.map((item) => String(item.chapterTitle || '').trim()).filter(Boolean),
      ...assignments.map((item) => String(item.chapterTitle || '').trim()).filter(Boolean),
    ]);

    res.json({
      contentMetrics: {
        totalChapters: chapterTitles.size,
        totalNotes: materials.filter((item) => item.learningType === 'note').length,
        totalPDFs: materials.filter((item) => item.learningType === 'pdf').length,
        totalPPTs: materials.filter((item) => item.learningType === 'ppt').length,
        totalVideos: materials.filter((item) => item.learningType === 'video').length,
        totalAssignments: assignments.length,
        totalAssessments: papers.length,
      },
      engagement: {
        studentsReached: studentIdsReached.size,
        contentViews: totalViews,
        averageCompletionPercent: materials.length + papers.length + assignments.length > 0
          ? Math.round(((materialCompletion + assessmentAttempts + assignments.length) / (materials.length + papers.length + assignments.length)) * 100)
          : 0,
        learningHours: Math.round((materials.reduce((sum, item) => {
          const seconds = (item.viewedBy || []).reduce((inner, entry) => inner + Number(entry.timeSpent || 0), 0);
          return sum + seconds;
        }, 0) / 3600) * 100) / 100,
      },
      assessmentMetrics: {
        attemptCount: assessmentAttempts,
        averageScore: averageAssessmentScore,
        passRate: papers.length > 0
          ? Math.round((papers.filter((item) => Number(item.passRate || 0) > 0).length / papers.length) * 100)
          : 0,
      },
      assignmentMetrics: {
        totalAssignments: assignments.length,
        pendingSubmissions: Math.max(0, assignments.length - progressDocs.reduce((sum, doc) => sum + (doc.submissions || []).length, 0)),
        submissionRate: assignments.length > 0
          ? Math.round((progressDocs.reduce((sum, doc) => sum + (doc.submissions || []).length, 0) / assignments.length) * 100)
          : 0,
      },
      totals: {
        materials: materials.length,
        papers: papers.length,
        assignments: assignments.length,
        planCount: plans.length,
        downloads: totalDownloads,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
