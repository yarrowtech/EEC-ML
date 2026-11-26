/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion as Motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { BookOpenCheck, Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import HeaderActions from './components/lesson-plan-builder/HeaderActions';
import Sidebar from './components/lesson-plan-builder/Sidebar';
import DrawerModal, { DEFAULT_INSTRUCTIONAL_FLOW } from './components/lesson-plan-builder/DrawerModal';
import { getDidYouKnowFacts } from '../components/LessonFacts';
import { knownUnits } from './components/lesson-plan-builder/chapterGroups';
import ChapterPreview from './components/lesson-plan-builder/ChapterPreview';
import { assessmentTypes, durationOptions } from './components/lesson-plan-builder/mockData';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const TEACHING_SELECTION_STORAGE_KEY = 'aiPoweredTeachingSelection';

const getFileType = (name = '') => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'ppt';
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return 'sheet';
  if (/\.(jpg|jpeg|png|gif|webp)$/.test(lower)) return 'image';
  return 'file';
};

const getMaterialType = (name = '') => {
  const type = getFileType(name);
  if (type === 'pdf') return { materialType: 'reading', learningType: 'pdf', category: 'reference', typeLabel: 'PDF Material' };
  if (type === 'ppt') return { materialType: 'reading', learningType: 'ppt', category: 'reference', typeLabel: 'Presentation' };
  if (type === 'docx') return { materialType: 'handout', learningType: 'reference', category: 'reference', typeLabel: 'Document' };
  if (type === 'sheet') return { materialType: 'worksheet', learningType: 'worksheet', category: 'practice', typeLabel: 'Worksheet' };
  if (type === 'image') return { materialType: 'reading', learningType: 'reference', category: 'reference', typeLabel: 'Image Material' };
  return { materialType: 'reading', learningType: 'reference', category: 'reference', typeLabel: 'Uploaded Material' };
};

const titleFromFileName = (name = '') => String(name || 'Uploaded Material').replace(/\.[^/.]+$/, '').trim() || 'Uploaded Material';

const defaultContentUploads = {
  'Upload Tryout': [],
  Experiments: [],
  'Report Upload': [],
  'Explanation Attachments': [],
  'Uploaded Material': [],
};

const LEGACY_WORKSHEET_BUCKETS = new Set([
  'Practice Papers Basic',
  'Practice Papers Intermediate',
  'Practice Papers Advanced',
]);

const removeLegacyWorksheetBuckets = (uploads) => Object.fromEntries(
  Object.entries(uploads || {}).filter(([bucket]) => !LEGACY_WORKSHEET_BUCKETS.has(bucket))
);

const enrichChapter = (chapter) => ({
  ...chapter,
  lessonDate: chapter.lessonDate || '',
  introductionText: chapter.introductionText || chapter.description || '',
  explanation: chapter.explanation || '',
  recap: chapter.recap || '',
  didYouKnow: chapter.didYouKnow || '',
  teacherNotes: chapter.teacherNotes || '',
  evaluation: chapter.evaluation || { participation: '', remarks: '', behaviour: '', progress: '', tag: '' },
  contentUploads: { ...defaultContentUploads, ...removeLegacyWorksheetBuckets(chapter.contentUploads) },
  worksheetFiles: chapter.worksheetFiles || [],
  worksheetLink: chapter.worksheetLink || '',
  assessments: Array.isArray(chapter.assessments) ? chapter.assessments : [],
  history: chapter.history || [],
  tryouts: chapter.tryouts || [],
  labExperiments: Array.isArray(chapter.labExperiments) ? chapter.labExperiments : [],
});

const toIdString = (value) => String(value || '').trim();
// Chapters published by the other teachers of this class are shown read-only.
const ownChaptersOnly = (list) => (Array.isArray(list) ? list.filter((chapter) => !chapter?.readOnly) : []);
const normalizeChapterTitle = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const getPlanTimestamp = (plan) => new Date(plan?.updatedAt || plan?.publishedAt || plan?.createdAt || 0).getTime() || 0;
const getChapterTimestamp = (chapter) => {
  const explicitTimestamp = new Date(chapter?.createdAt || 0).getTime();
  if (explicitTimestamp) return explicitTimestamp;
  const localIdTimestamp = toIdString(chapter?.id).match(/^ch-(\d+)$/)?.[1];
  return Number(localIdTimestamp) || 0;
};

const parseResourceRef = (value) => {
  const text = String(value || '').trim();
  if (!text) return { bucket: '', title: '', url: '' };
  const parts = text.split('::');
  if (parts.length >= 3) {
    const bucket = String(parts[0] || '').trim();
    const title = String(parts[1] || '').trim();
    const url = String(parts.slice(2).join('::') || '').trim();
    return { bucket, title: title || url, url };
  }
  const separator = text.indexOf('::');
  if (separator >= 0) {
    return { bucket: '', title: String(text.slice(0, separator)).trim(), url: String(text.slice(separator + 2)).trim() };
  }
  return { bucket: '', title: text, url: '' };
};

// A published plan only ever persists uploads as flat "bucket::name::url" strings
// on plan.materialsNeeded (see serializeResourceRef) — plannerContent never carries
// contentUploads — so reopening a published chapter must rebuild the bucketed
// upload-card state from that flat list, or every uploaded file silently
// disappears from the builder even though it's still stored and indexed.
const rebuildContentUploadsFromMaterialsNeeded = (materialsNeeded) => {
  const buckets = {};
  (Array.isArray(materialsNeeded) ? materialsNeeded : []).forEach((raw, index) => {
    const { bucket, title, url } = parseResourceRef(raw);
    if (!title || !MATERIAL_BUCKETS.has(bucket)) return;
    buckets[bucket] = [...(buckets[bucket] || []), {
      id: `material-${bucket}-${index}`,
      name: title,
      url,
      type: getFileType(title),
      isUploading: false,
    }];
  });
  return buckets;
};

const hasAnyUploadedFile = (contentUploads) =>
  Object.values(contentUploads || {}).some((files) => Array.isArray(files) && files.length > 0);

const normalizeLoadedChapter = (chapter, plan, index) => {
  const source = chapter && typeof chapter === 'object' ? chapter : {};
  const chapterTitle = String(source.title || plan?.title || 'Untitled Chapter').trim() || 'Untitled Chapter';
  const lessonDate = source.lessonDate || (plan?.date ? new Date(plan.date).toISOString().slice(0, 10) : '');
  const sourcePublishedPlanId = toIdString(source.publishedPlanId);
  const planIsPublished = plan?.status === 'published' && plan?.isDraft === false;
  const publishedPlanId = sourcePublishedPlanId || (planIsPublished ? toIdString(plan?._id) : '');
  const status = publishedPlanId ? 'published' : 'draft';
  const planId = toIdString(plan?._id);
  const createdAt = source.createdAt || (planIsPublished ? plan?.createdAt : '') || '';

  // A published plan's chapter (plannerContent) is only an outline; the lesson
  // body lives on the plan itself and the files in its first sub-topic. Fall
  // back to those so EVERY teacher rebuilds the same full chapter — otherwise a
  // colleague (who has no draft copy) sees an emptier chapter and a lower %.
  const firstSubTopic = source.topics?.[0]?.subTopics?.[0] || {};
  const filesFromRefs = (refs, prefix) => (Array.isArray(refs) ? refs : []).map((raw, i) => {
    const { title, url } = parseResourceRef(raw);
    return title || url ? { id: `${prefix}-${planId || index}-${i}`, name: title || 'File', url, type: getFileType(title || url), isUploading: false } : null;
  }).filter(Boolean);
  const planText = (html, text) => String(html || text || '');

  return enrichChapter({
    ...source,
    // Each published plan holds exactly one chapter, and the planner always stamps its
    // chapter id as the literal 'chapter-1' — so the plan's own _id is the only value
    // that's actually unique per chapter. Falling back to source.id would collide across
    // every published chapter and make the sidebar unable to tell them apart.
    id: (planIsPublished ? planId : toIdString(source.id)) || publishedPlanId || `chapter-${index}`,
    introductionText: source.introductionText || plan?.introductionText || planText(plan?.introductionHtml, plan?.introduction),
    explanation: source.explanation || planText(plan?.explanationHtml, plan?.explanation),
    recap: source.recap || planText(plan?.recapHtml, plan?.recap),
    didYouKnow: source.didYouKnow || String(plan?.didYouKnow || ''),
    duration: source.duration || plan?.duration || '',
    learningObjectives: (Array.isArray(source.learningObjectives) && source.learningObjectives.length ? source.learningObjectives : null) || plan?.learningObjectives || [],
    publishedPlanId: publishedPlanId || null,
    createdAt,
    title: chapterTitle,
    lessonDate,
    status,
    isDraft: status !== 'published',
    contentUploads: hasAnyUploadedFile(source.contentUploads)
      ? { ...defaultContentUploads, ...source.contentUploads }
      : { ...defaultContentUploads, ...rebuildContentUploadsFromMaterialsNeeded(plan?.materialsNeeded) },
    worksheetFiles: Array.isArray(source.worksheetFiles) && source.worksheetFiles.length
      ? source.worksheetFiles
      : filesFromRefs(firstSubTopic.worksheets, 'worksheet'),
    worksheetLink: source.worksheetLink || '',
    assessments: Array.isArray(source.assessments) ? source.assessments : [],
    history: Array.isArray(source.history) ? source.history : [],
    tryouts: Array.isArray(source.tryouts) && source.tryouts.length
      ? source.tryouts
      : (Array.isArray(firstSubTopic.tryoutSections) ? firstSubTopic.tryoutSections : []),
    // Virtual lab experiments ("Practical" mode) — from the draft, else the published plan.
    labExperiments: Array.isArray(source.labExperiments) && source.labExperiments.length
      ? source.labExperiments
      : (Array.isArray(firstSubTopic.labExperiments) ? firstSubTopic.labExperiments : []),
  });
};

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const MATERIAL_BUCKETS = new Set(['Study Materials', 'Presentations', 'Images', 'Experiments', 'Report Upload', 'Additional Resources']);

// Backend returns the full AI suggestion in one response; reveal it word-by-word
// on the frontend so the editor feels like the AI is writing live.
const STREAM_TOKEN_DELAY_MS = 22;
const splitStreamTokens = (text) => String(text || '').match(/\S+\s*/g) || [];

const serializeResourceRef = (file, bucket = '') => {
  if (file?.isUploading || !file?.url) return '';
  const name = String(file?.name || '').trim();
  // uploadTeachingFile's `url` is a short-lived signed S3 link meant only for
  // an immediate preview in the builder — it expires (DEFAULT_SIGNED_URL_TTL_SECONDS,
  // 15 min) long before a student ever opens this material. Persist the permanent
  // "s3://bucket/key" marker instead so the backend can re-sign a fresh working
  // url on every future read (see resolveMaterialLink/signAttachmentUrls and the
  // isResolvableResourceUrl comment in backend/routes/lessonPlanRoutes.js).
  const permanentUrl = (file?.storageProvider === 's3' && file?.s3Bucket && file?.s3Key)
    ? `s3://${file.s3Bucket}/${file.s3Key}`
    : String(file?.url || '').trim();
  const safeBucket = String(bucket || '').trim();
  if (name && permanentUrl && safeBucket) return `${safeBucket}::${name}::${permanentUrl}`;
  if (name && permanentUrl) return `${name}::${permanentUrl}`;
  return name || permanentUrl;
};

const readStoredSelection = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(TEACHING_SELECTION_STORAGE_KEY) || '{}');
    return {
      classId: toIdString(saved.classId),
      sectionId: toIdString(saved.sectionId),
      subjectId: toIdString(saved.subjectId),
    };
  } catch {
    return { classId: '', sectionId: '', subjectId: '' };
  }
};

const writeStoredSelection = ({ classId = '', sectionId = '', subjectId = '' }) => {
  const next = {
    classId: toIdString(classId),
    sectionId: toIdString(sectionId),
    subjectId: toIdString(subjectId),
  };

  if (!next.classId && !next.sectionId && !next.subjectId) {
    localStorage.removeItem(TEACHING_SELECTION_STORAGE_KEY);
    return;
  }

  localStorage.setItem(TEACHING_SELECTION_STORAGE_KEY, JSON.stringify(next));
};

// `initialSelection` ({ classId, sectionId, subjectName }) opens the builder on
// the class the teacher picked in Classes & Work instead of the last-used one.
const AIPoweredTeaching = ({ initialSelection = null } = {}) => {
  const [chapters, setChapters] = useState([]);
  const [openChapterIds, setOpenChapterIds] = useState([]);
  // Clicking a chapter shows a read-only preview; the step editor opens full-page.
  const [editorOpen, setEditorOpen] = useState(false);
  // Chapter waiting for the delete confirmation dialog.
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  // "New chapter" dialog: { unitNumber, unitTitle } while open
  const [newUnit, setNewUnit] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedChapterId, setDraggedChapterId] = useState(null);
  const [autosaveStatus, setAutosaveStatus] = useState('Not saved');
  const [selectionChanging, setSelectionChanging] = useState(false);
  const selectionChangingRef = useRef(false);
  const savingRef = useRef(null);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [classOptions, setClassOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);

  const selectedSubjectName = useMemo(() => (
    subjectOptions.find((option) => toIdString(option?.subjectId) === toIdString(selectedSubject))?.subjectName || ''
  ), [selectedSubject, subjectOptions]);
  const selectedClassName = useMemo(() => (
    classOptions.find((option) => toIdString(option?.id) === toIdString(selectedClass))?.name || ''
  ), [selectedClass, classOptions]);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  });

  const uploadTeachingFile = async (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    const data = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/api/uploads/s3/study-material/single`);
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token') || ''}`);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !onProgress) return;
        const percent = Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100)));
        onProgress(percent);
      };

      xhr.onload = () => {
        const responseData = (() => {
          try {
            return JSON.parse(xhr.responseText || '{}');
          } catch {
            return {};
          }
        })();
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve(responseData);
        } else {
          const reason = responseData?.message || responseData?.error
            || (xhr.status === 413 ? 'File is too large' : xhr.status === 401 ? 'Your session expired — please log in again' : xhr.status === 429 ? 'Too many uploads — wait a minute and try again' : '');
          const detail = responseData?.detail ? ` (${responseData.detail})` : '';
          reject(new Error(`${reason || `Upload failed (error ${xhr.status})`}${detail}`));
        }
      };

      xhr.onerror = () => reject(new Error('Could not reach the server — check your connection and try again'));
      xhr.onabort = () => reject(new Error('Upload cancelled'));
      xhr.send(formData);
    });

    const uploaded = data?.files?.[0];
    // `storageUrl` is the private s3:// key and cannot be opened by a browser.
    // Prefer the short-lived signed HTTPS URL returned by the API for previews,
    // saved attachments, and AI ingestion; retain the storage metadata below.
    const storageUrl = uploaded?.secure_url || uploaded?.url || uploaded?.storageUrl;
    if (!storageUrl) throw new Error('Upload completed without a file URL');
    return {
      name: uploaded.originalName || file.name || 'Uploaded file',
      url: storageUrl,
      size: uploaded.bytes || file.size || 0,
      type: getFileType(uploaded.originalName || file.name || ''),
      storageProvider: uploaded.storageProvider || 's3',
      s3Key: uploaded.s3Key || '',
      s3Bucket: uploaded.s3Bucket || '',
      s3Region: uploaded.s3Region || '',
    };
  };

  const loadOptions = async ({ classId = '', sectionId = '' } = {}) => {
    const query = new URLSearchParams();
    if (classId) query.set('classId', classId);
    if (sectionId) query.set('sectionId', sectionId);

    const res = await fetch(`${API_BASE}/api/lesson-plans/teacher/options?${query.toString()}`, {
      headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Failed to load class/section/subject options');

    setClassOptions(Array.isArray(data?.classes) ? data.classes : []);
    setSectionOptions(Array.isArray(data?.sections) ? data.sections : []);
    setSubjectOptions(Array.isArray(data?.subjects) ? data.subjects : []);
    return data;
  };

  const chapterLoadSeqRef = useRef(0);

  const loadChaptersForSelection = async (classId, sectionId, subjectId) => {
    if (!classId || !sectionId || !subjectId) {
      setChapters([]);
      setOpenChapterIds([]);
      return;
    }
    const requestSeq = ++chapterLoadSeqRef.current;
    try {
      const res = await fetch(`${API_BASE}/api/lesson-plans/teacher/my`, { headers: authHeaders() });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Failed to load saved chapters');

      const matchingPlans = Array.isArray(data)
        ? data.filter((plan) =>
            toIdString(plan?.classId) === toIdString(classId) &&
            toIdString(plan?.sectionId) === toIdString(sectionId) &&
            toIdString(plan?.subjectId) === toIdString(subjectId)
          )
        : [];

      const publishedPlans = matchingPlans
        .filter((plan) => plan?.status === 'published' && !plan?.isDraft)
        .sort((a, b) => getPlanTimestamp(b) - getPlanTimestamp(a));
      const publishedChapterTitles = new Set();
      const publishedChapters = publishedPlans.flatMap((plan, pi) => {
        const plannerChapters = Array.isArray(plan?.plannerContent?.chapters) ? plan.plannerContent.chapters : [];
        const rawChapters = Array.isArray(plan?.rawChapters) ? plan.rawChapters : [];
        const source = plannerChapters.length > 0 ? plannerChapters : rawChapters;
        return source.map((ch, ci) => normalizeLoadedChapter(ch, plan, pi * 100 + ci));
      }).filter((chapter) => {
        const titleKey = normalizeChapterTitle(chapter.title);
        if (!titleKey || publishedChapterTitles.has(titleKey)) return false;
        publishedChapterTitles.add(titleKey);
        return true;
      });

      // Drafts contain the full editable builder state (uploads, notes, assessments,
      // instructional flow, etc.). Restore the most recently updated one and attach
      // published IDs where possible so a later Publish performs an update, not a duplicate.
      const latestDraft = matchingPlans
        .filter((plan) => plan?.isDraft || plan?.status === 'draft')
        .sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0))[0] || null;
      const loadedDraftChapters = Array.isArray(latestDraft?.rawChapters)
        ? latestDraft.rawChapters.map((chapter, index) => normalizeLoadedChapter(chapter, latestDraft, index))
        : [];
      const preferredPublishedIdByTitle = new Map(
        publishedChapters.map((chapter) => [normalizeChapterTitle(chapter.title), chapter.publishedPlanId])
      );
      const draftChapterByTitle = new Map();
      loadedDraftChapters.forEach((chapter) => {
        const titleKey = normalizeChapterTitle(chapter.title) || toIdString(chapter.id);
        const existing = draftChapterByTitle.get(titleKey);
        const preferredPublishedId = preferredPublishedIdByTitle.get(titleKey);
        if (!existing || (chapter.publishedPlanId && chapter.publishedPlanId === preferredPublishedId)) {
          draftChapterByTitle.set(titleKey, chapter);
        }
      });
      const draftChapters = Array.from(draftChapterByTitle.values());

      const matchedPublishedIds = new Set();
      const restoredDraftChapters = draftChapters.map((draftChapter) => {
        const matchingPublished = publishedChapters.find((publishedChapter) => {
          if (draftChapter.publishedPlanId && draftChapter.publishedPlanId === publishedChapter.publishedPlanId) return true;
          return normalizeChapterTitle(draftChapter.title) === normalizeChapterTitle(publishedChapter.title);
        });
        if (!matchingPublished) return draftChapter;
        matchedPublishedIds.add(matchingPublished.publishedPlanId);
        return {
          ...draftChapter,
          id: matchingPublished.id,
          publishedPlanId: matchingPublished.publishedPlanId,
          publishedChapterTitle: matchingPublished.title,
          createdAt: draftChapter.createdAt || matchingPublished.createdAt,
          status: 'published',
          isDraft: false,
        };
      });

      const nextChapters = [...(latestDraft
        ? [
            ...restoredDraftChapters,
            ...publishedChapters.filter((chapter) => !matchedPublishedIds.has(chapter.publishedPlanId)),
          ]
        : publishedChapters
      )].sort((a, b) => getChapterTimestamp(b) - getChapterTimestamp(a))
        .map((chapter) => ({ ...chapter, authorName: 'You' }));

      // Published chapters by the other teachers of this class/section/subject.
      let sharedChapters = [];
      try {
        const q = new URLSearchParams({ classId, sectionId, subjectId });
        const sharedRes = await fetch(`${API_BASE}/api/lesson-plans/teacher/class-shared?${q}`, { headers: authHeaders() });
        const sharedPlans = sharedRes.ok ? await sharedRes.json().catch(() => []) : [];
        sharedChapters = (Array.isArray(sharedPlans) ? sharedPlans : []).flatMap((plan, pi) => {
          const plannerChapters = Array.isArray(plan?.plannerContent?.chapters) ? plan.plannerContent.chapters : [];
          const raw = Array.isArray(plan?.rawChapters) ? plan.rawChapters : [];
          const source = plannerChapters.length > 0 ? plannerChapters : raw;
          return source.map((ch, ci) => ({
            ...normalizeLoadedChapter(ch, plan, 5000 + pi * 100 + ci),
            id: `shared-${toIdString(plan?._id)}-${ci}`,
            readOnly: true,
            authorName: plan?.authorName || 'Another teacher',
            authorId: toIdString(plan?.teacherId),
          }));
        });
      } catch {
        // Shared chapters are optional — my own chapters still load.
      }
      nextChapters.push(...sharedChapters);

      if (requestSeq !== chapterLoadSeqRef.current) return;

      setChapters(nextChapters);
      setOpenChapterIds((prev) => prev.filter((cid) => nextChapters.some((ch) => ch.id === cid)));
      setAutosaveStatus(latestDraft ? 'Draft restored' : nextChapters.length > 0 ? 'Chapters loaded' : 'No chapters yet');
      const restoredDraftId = toIdString(latestDraft?._id);
      setCurrentDraftId(restoredDraftId || null);
      if (restoredDraftId) localStorage.setItem('currentLessonPlanDraft', restoredDraftId);
      else localStorage.removeItem('currentLessonPlanDraft');
    } catch (err) {
      if (requestSeq !== chapterLoadSeqRef.current) return;
      setChapters([]);
      setOpenChapterIds([]);
      setAutosaveStatus('Load failed');
      toast.error(err?.message || 'Failed to load saved chapters');
    }
  };

  // Always-current snapshot so the timer callback reads fresh state, not a stale closure
  const autosaveStateRef = useRef({});
  autosaveStateRef.current = { currentDraftId, chapters, selectedClass, selectedSection, selectedSubject };

  // Stable timer ref — one timer at a time, never lost across re-renders
  const autosaveTimerRef = useRef(null);
  const autosaveDirtyRef = useRef(false);

  // Pending word-reveal timers for the AI Suggestion streaming effect, keyed by chapterId
  const introStreamTimersRef = useRef({});
  useEffect(() => () => {
    Object.values(introStreamTimersRef.current).forEach((timers) => timers.forEach(clearTimeout));
  }, []);

  const persistDraft = async () => {
    const { currentDraftId, chapters, selectedClass, selectedSection, selectedSubject } = autosaveStateRef.current;

    if (!selectedClass || !selectedSection || !selectedSubject) return;

    try {
      let draftId = currentDraftId;

      if (!draftId) {
        // POST already persists rawChapters — return immediately, no PUT needed
        const res = await fetch(`${API_BASE}/api/lesson-plans/teacher/draft`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            title: 'Lesson Plan Draft',
            rawChapters: ownChaptersOnly(chapters),
            classId: selectedClass,
            sectionId: selectedSection,
            subjectId: selectedSubject,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to create draft');

        draftId = data?.data?._id;
        if (draftId) {
          setCurrentDraftId(draftId);
          localStorage.setItem('currentLessonPlanDraft', draftId);
        }
        autosaveDirtyRef.current = false;
        setAutosaveStatus('Draft saved');
        return true;
      }

      const res = await fetch(`${API_BASE}/api/lesson-plans/teacher/draft/${draftId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          title: 'Lesson Plan Draft',
          rawChapters: ownChaptersOnly(chapters),
          classId: selectedClass,
          sectionId: selectedSection,
          subjectId: selectedSubject,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save draft');

      autosaveDirtyRef.current = false;
      setAutosaveStatus('Saved just now');
      return true;
    } catch (err) {
      setAutosaveStatus('Save failed');
      console.error('Autosave failed:', err?.message);
      return false;
    }
  };

  const saveDraft = async () => {
    if (savingRef.current) await savingRef.current;
    const request = persistDraft();
    savingRef.current = request;
    try { return await request; }
    finally { if (savingRef.current === request) savingRef.current = null; }
  };

  const changeSelection = async (change) => {
    if (selectionChangingRef.current) return;
    selectionChangingRef.current = true;
    setSelectionChanging(true);
    try {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (savingRef.current) await savingRef.current;
      if (autosaveStateRef.current.selectedSubject && !(await saveDraft())) {
        toast.error('Could not save your changes. Please try switching again.');
        return;
      }
      await change();
    } finally {
      selectionChangingRef.current = false;
      setSelectionChanging(false);
    }
  };

  // Flush a pending edit when the teacher leaves this route before the debounce
  // timer fires. `keepalive` lets the request finish during page navigation.
  useEffect(() => () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (!autosaveDirtyRef.current) return;

    const snapshot = autosaveStateRef.current;
    if (!snapshot.selectedClass || !snapshot.selectedSection || !snapshot.selectedSubject) return;

    const draftId = toIdString(snapshot.currentDraftId);
    fetch(draftId
      ? `${API_BASE}/api/lesson-plans/teacher/draft/${draftId}`
      : `${API_BASE}/api/lesson-plans/teacher/draft`, {
      method: draftId ? 'PUT' : 'POST',
      headers: authHeaders(),
      keepalive: true,
      body: JSON.stringify({
        title: 'Lesson Plan Draft',
        rawChapters: ownChaptersOnly(snapshot.chapters),
        classId: snapshot.selectedClass,
        sectionId: snapshot.selectedSection,
        subjectId: snapshot.selectedSubject,
      }),
    }).catch((err) => console.error('Final autosave failed:', err?.message));
  }, []);

  useEffect(() => {
    const userType = localStorage.getItem('userType');
    if (userType !== 'Teacher') return;

    const initializePage = async () => {
      try {
        const fromClass = initialSelection && toIdString(initialSelection.classId)
          ? {
            classId: toIdString(initialSelection.classId),
            sectionId: toIdString(initialSelection.sectionId),
            subjectId: '',
          }
          : null;
        const storedSelection = fromClass || readStoredSelection();

        const initialOptions = await loadOptions().catch((err) => {
          toast.error(err?.message || 'Failed to load teaching options');
          return null;
        });
        if (!initialOptions) return;

        const storedClassIsAvailable = (initialOptions.classes || [])
          .some((item) => toIdString(item?.id) === storedSelection.classId);
        if (storedSelection.classId && !storedClassIsAvailable) {
          writeStoredSelection({});
          return;
        }

        if (storedSelection.classId) {
          setSelectedClass(storedSelection.classId);
          const classOptionsData = await loadOptions({ classId: storedSelection.classId });
          const storedSectionIsAvailable = (classOptionsData.sections || [])
            .some((item) => toIdString(item?.id) === storedSelection.sectionId);
          if (storedSelection.sectionId && !storedSectionIsAvailable) {
            writeStoredSelection({ classId: storedSelection.classId });
            return;
          }
        }

        if (storedSelection.classId && storedSelection.sectionId) {
          setSelectedSection(storedSelection.sectionId);
          const sectionOptionsData = await loadOptions({ classId: storedSelection.classId, sectionId: storedSelection.sectionId });
          // Opened from a class: pick that class's subject (by name), or the
          // only subject, or the last-used one if it belongs to this class.
          if (fromClass) {
            const subjects = sectionOptionsData.subjects || [];
            const wanted = String(initialSelection.subjectName || '').trim().toLowerCase();
            const remembered = readStoredSelection();
            const match = (wanted && subjects.find((s) => String(s?.subjectName || '').trim().toLowerCase() === wanted))
              || (subjects.length === 1 ? subjects[0] : null)
              || subjects.find((s) => toIdString(s?.subjectId) === remembered.subjectId);
            storedSelection.subjectId = toIdString(match?.subjectId);
            writeStoredSelection(storedSelection);
          }
          const storedSubjectIsAvailable = (sectionOptionsData.subjects || [])
            .some((item) => toIdString(item?.subjectId) === storedSelection.subjectId);
          if (storedSelection.subjectId && !storedSubjectIsAvailable) {
            writeStoredSelection({ classId: storedSelection.classId, sectionId: storedSelection.sectionId });
            return;
          }
        }

        if (storedSelection.classId && storedSelection.sectionId && storedSelection.subjectId) {
          setSelectedSubject(storedSelection.subjectId);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };

    initializePage();
  }, []);

  useEffect(() => {
    if (!selectedClass || !selectedSection || !selectedSubject) return;
    loadChaptersForSelection(selectedClass, selectedSection, selectedSubject);
  }, [selectedClass, selectedSection, selectedSubject]);

  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const query = searchQuery.toLowerCase();
    return chapters.filter((chapter) => chapter.title.toLowerCase().includes(query));
  }, [chapters, searchQuery]);

  const openChapters = useMemo(() => {
    return openChapterIds
      .map(id => chapters.find(ch => ch.id === id))
      .filter(Boolean);
  }, [chapters, openChapterIds]);

  const touchAutosave = () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveDirtyRef.current = true;
    setAutosaveStatus('Saving...');
    autosaveTimerRef.current = setTimeout(saveDraft, 2000);
  };

  const updateChapter = (id, updater) => {
    if (chapters.find((chapter) => chapter.id === id)?.readOnly) return;
    setChapters((prev) => prev.map((chapter) => (chapter.id === id && !chapter.readOnly ? enrichChapter(updater(chapter)) : chapter)));
    touchAutosave();
  };

  // Lessons live inside chapters: `unit` = { unitNumber, unitTitle } of the
  // chapter the new lesson belongs to (none → "Not in a chapter yet").
  const handleAddChapter = (unit = null) => {
    const missing = [];
    if (!selectedClass) missing.push('class');
    if (!selectedSection) missing.push('section');
    if (!selectedSubject) missing.push('subject');

    if (missing.length > 0) {
      const missingText = missing.join(', ');
      const message = `Please select ${missingText} before adding a chapter.`;
      toast.error(message);
      // You could also use window.alert(message); for a more prominent alert.
      return;
    }

    const nextId = `ch-${Date.now()}`;
    const chapter = enrichChapter({
      id: nextId,
      createdAt: new Date().toISOString(),
      title: 'Untitled Lesson',
      duration: durationOptions[0],
      description: '',
      files: [],
      assessments: [],
      unitNumber: unit?.unitNumber || '',
      unitTitle: unit?.unitTitle || '',
    });
    setChapters((prev) => [chapter, ...prev]);
    setOpenChapterIds([nextId]);
    setActiveStep(0);
    setEditorOpen(true);
    touchAutosave();
  };

  // Ask first (custom dialog); the actual delete runs from its confirm button.
  const handleDeleteChapter = (id) => {
    const target = chapters.find((item) => item.id === id);
    if (target?.readOnly) {
      toast.error(`Only ${target.authorName || 'its author'} can delete this chapter.`);
      return;
    }
    if (target) setPendingDeleteId(id);
  };

  const deleteChapterNow = async (id) => {
    const chapter = chapters.find((item) => item.id === id);
    if (!chapter) return;

    const chapterTitle = String(chapter?.title || '').trim();
    const publishedChapterTitle = String(chapter?.publishedChapterTitle || chapterTitle).trim();
    const publishedPlanId = toIdString(chapter?.publishedPlanId);
    const isPublishedChapter = Boolean(publishedPlanId) || chapter?.status === 'published';


    setAutosaveStatus('Deleting...');

    if (selectedClass && selectedSection && selectedSubject && isPublishedChapter && (publishedPlanId || publishedChapterTitle)) {
      try {
        const res = await fetch(`${API_BASE}/api/lesson-plans/teacher/smart-learning/chapter`, {
          method: 'DELETE',
          headers: authHeaders(),
          body: JSON.stringify({
            classId: selectedClass,
            sectionId: selectedSection,
            subjectId: selectedSubject,
            lessonPlanId: publishedPlanId || undefined,
            chapterTitle: publishedChapterTitle || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to delete published chapter');
      } catch (err) {
        console.warn('Could not remove chapter from Smart Learning:', err?.message);
        setAutosaveStatus('Delete failed');
        toast.error('Could not delete the published chapter. Please try again.');
        return;
      }
    }

    const nextChapters = chapters.filter((ch) => ch.id !== id);
    setSidebarCollapsed(false);
    setChapters(nextChapters);
    setOpenChapterIds((prev) => prev.filter((cid) => cid !== id));
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveStateRef.current = { ...autosaveStateRef.current, chapters: nextChapters };
    await saveDraft();
    toast.success(`Chapter "${chapterTitle || 'Untitled Chapter'}" deleted`);
  };

  const handleChapterDrop = (targetId) => {
    if (!draggedChapterId || draggedChapterId === targetId) return;
    if (chapters.some((chapter) => (chapter.id === targetId || chapter.id === draggedChapterId) && chapter.readOnly)) return;
    setChapters((prev) => {
      const next = [...prev];
      const from = next.findIndex((item) => item.id === draggedChapterId);
      const to = next.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedChapterId(null);
    touchAutosave();
  };

  const handleCloseChapter = (id) => {
    setOpenChapterIds((prev) => prev.filter((chapterId) => chapterId !== id));
  };

  const addAssessmentToActiveChapter = (chapterId) => {
    if (!chapterId) return;
    const next = { id: `a-${Date.now()}`, title: '', type: assessmentTypes[0], dueDate: '', marks: '' };
    updateChapter(chapterId, (chapter) => ({ ...chapter, assessments: [...(chapter.assessments || []), next] }));
  };

  const updateAssessmentInActiveChapter = (chapterId, assessmentId, nextAssessment) => {
    if (!chapterId) return;
    updateChapter(chapterId, (chapter) => ({ ...chapter, assessments: (chapter.assessments || []).map((assessment) => (assessment.id === assessmentId ? nextAssessment : assessment)) }));
  };

  // AI-ingestible file types (must match backend SUPPORTED_VECTOR_EXTENSIONS)
  const AI_INGESTIBLE_TYPES = new Set(['pdf', 'docx', 'ppt']);

  const ingestFileForAI = async (uploadedFile, chapterId) => {
    if (!AI_INGESTIBLE_TYPES.has(uploadedFile.type)) return false;
    const chapter = chapters.find((ch) => ch.id === chapterId);
    const response = await fetch(`${API_BASE}/api/ai-teacher/ingest-file`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        url: uploadedFile.url,
        fileName: uploadedFile.name,
        classId: selectedClass,
        sectionId: selectedSection,
        subjectId: selectedSubject,
        subjectName: selectedSubjectName,
        chapterTitle: chapter?.title || '',
        cloudinaryPublicId: uploadedFile.cloudinaryPublicId,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success !== true) {
      throw new Error(data?.detail?.detail || data?.detail || data?.error || 'AI indexing failed');
    }
    return true;
  };

  const addContentFile = async (chapterId, file, bucket) => {
    if (!chapterId || !file || !bucket) return;
    const tempId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const setProgress = (progress) => {
      updateChapter(chapterId, (chapter) => {
        const currentBucketFiles = chapter.contentUploads?.[bucket] || [];
        return {
          ...chapter,
          contentUploads: {
            ...chapter.contentUploads,
            [bucket]: currentBucketFiles.map((item) => (
              item.id === tempId ? { ...item, progress } : item
            )),
          },
        };
      });
    };

    updateChapter(chapterId, (chapter) => {
      const currentBucketFiles = chapter.contentUploads?.[bucket] || [];
      const pendingFile = {
        id: tempId,
        name: file.name || 'Uploading file',
        size: file.size || 0,
        type: getFileType(file.name || ''),
        progress: 1,
        isUploading: true,
      };
      return { ...chapter, contentUploads: { ...chapter.contentUploads, [bucket]: [...currentBucketFiles, pendingFile] } };
    });

    try {
      const uploaded = await uploadTeachingFile(file, setProgress);
      const nextFile = { id: tempId, ...uploaded, progress: 100, isUploading: false };
      updateChapter(chapterId, (chapter) => {
        const currentBucketFiles = chapter.contentUploads?.[bucket] || [];
        const newContentUploads = {
          ...chapter.contentUploads,
          [bucket]: currentBucketFiles.map((item) => (item.id === tempId ? nextFile : item)),
        };
        return { ...chapter, contentUploads: newContentUploads };
      });
      toast.success('File uploaded');
      try {
        await ingestFileForAI(nextFile, chapterId);
      } catch (ingestError) {
        // AI indexing is best-effort. The uploaded file must remain usable
        // when the AI service, allocation scope, or Qdrant is unavailable.
        console.warn('AI indexing skipped after successful file upload:', ingestError?.message || ingestError);
      }
    } catch (err) {
      updateChapter(chapterId, (chapter) => ({
        ...chapter,
        contentUploads: {
          ...chapter.contentUploads,
          [bucket]: (chapter.contentUploads?.[bucket] || []).filter((item) => item.id !== tempId),
        },
      }));
      toast.error(`"${file.name}" was not uploaded: ${err?.message || 'Failed to upload file'}`);
      console.error('Lesson material upload failed:', err);
    }
  };

  const removeContentFile = (chapterId, fileId, bucket) => {
    if (!chapterId || !bucket) return;
    updateChapter(chapterId, (chapter) => ({ ...chapter, contentUploads: { ...chapter.contentUploads, [bucket]: (chapter.contentUploads[bucket] || []).filter((file) => file.id !== fileId) } }));
    toast.success('File deleted');
  };

  const addWorksheetFile = async (chapterId, file) => {
    if (!chapterId || !file) return;
    const currentChapter = chapters.find((chapter) => chapter.id === chapterId);
    if ((currentChapter?.worksheetFiles || []).length > 0) {
      toast.error('Only one worksheet can be uploaded for this chapter');
      return;
    }
    const fileName = String(file.name || '').toLowerCase();
    if (!fileName.endsWith('.pdf') && !fileName.endsWith('.doc') && !fileName.endsWith('.docx')) {
      toast.error('Worksheet must be a PDF or DOCX file');
      return;
    }
    const tempId = `worksheet-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const setProgress = (progress) => {
      updateChapter(chapterId, (chapter) => ({
        ...chapter,
        worksheetFiles: (chapter.worksheetFiles || []).map((item) => (
          item.id === tempId ? { ...item, progress } : item
        )),
      }));
    };

    updateChapter(chapterId, (chapter) => ({
      ...chapter,
      worksheetFiles: [
        ...(chapter.worksheetFiles || []),
        {
          id: tempId,
          name: file.name || 'Uploading worksheet',
          size: file.size || 0,
          type: getFileType(file.name || ''),
          progress: 1,
          isUploading: true,
        },
      ],
    }));

    try {
      const uploaded = await uploadTeachingFile(file, setProgress);
      const nextFile = { id: tempId, ...uploaded, progress: 100, isUploading: false };
      updateChapter(chapterId, (chapter) => ({
        ...chapter,
        worksheetFiles: (chapter.worksheetFiles || []).map((item) => (item.id === tempId ? nextFile : item)),
      }));
      toast.success('Worksheet uploaded');
      try {
        await ingestFileForAI(nextFile, chapterId);
      } catch (ingestError) {
        // AI indexing is best-effort and must never make a successful upload
        // look like a failed worksheet upload.
        console.warn('AI indexing skipped after successful worksheet upload:', ingestError?.message || ingestError);
      }
    } catch (err) {
      updateChapter(chapterId, (chapter) => ({
        ...chapter,
        worksheetFiles: (chapter.worksheetFiles || []).filter((item) => item.id !== tempId),
      }));
      toast.error(err?.message || 'Failed to upload worksheet');
    }
  };

  const removeWorksheetFile = (chapterId, fileId) => {
    if (!chapterId) return;
    updateChapter(chapterId, (chapter) => ({ ...chapter, worksheetFiles: (chapter.worksheetFiles || []).filter((file) => file.id !== fileId) }));
  };

  // Reveals `fullText` into chapter[field] one word at a time so the editor
  // looks like the AI is writing live, instead of the text just appearing.
  // `chapter.aiWriting` flips false once the last token lands.
  const streamTextIntoChapter = (chapterId, field, fullText) => {
    (introStreamTimersRef.current[chapterId] || []).forEach(clearTimeout);

    const tokens = splitStreamTokens(fullText);
    if (!tokens.length) {
      updateChapter(chapterId, (ch) => ({ ...ch, [field]: '', aiWriting: false }));
      delete introStreamTimersRef.current[chapterId];
      return;
    }

    let tokenIndex = 0;
    let streamedText = '';
    const timers = [];
    introStreamTimersRef.current[chapterId] = timers;

    const pushNextToken = () => {
      streamedText += tokens[tokenIndex];
      tokenIndex += 1;
      const isDone = tokenIndex >= tokens.length;

      updateChapter(chapterId, (ch) => ({ ...ch, [field]: streamedText, aiWriting: !isDone }));

      if (!isDone) {
        timers.push(window.setTimeout(pushNextToken, STREAM_TOKEN_DELAY_MS));
      } else {
        delete introStreamTimersRef.current[chapterId];
        toast.success('AI lesson content applied!');
      }
    };

    pushNextToken();
  };

  const applyAiSuggestion = async (chapterId) => {
    if (!chapterId) return;
    const chapter = chapters.find((ch) => ch.id === chapterId);
    if (!chapter || chapter.aiWriting) return;

    const subject = selectedSubjectName || 'General';
    const topic = chapter.title || 'Lesson Topic';

    updateChapter(chapterId, (ch) => ({ ...ch, aiWriting: true }));
    try {
      const res = await fetch(`${API_BASE}/api/ai-teacher/lesson-content`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          subject,
          topic,
          gradeLevel: null,
          chapterTitle: chapter.title || topic,
          classId: selectedClass,
          sectionId: selectedSection,
          subjectId: selectedSubject,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'AI generation failed');

      // Strip markdown, take only the first paragraph (intro should be concise)
      const raw = (data?.data?.content || '')
        .replace(/^#{1,3}\s+/gm, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .trim();
      const firstPara = raw.split(/\n{2,}/)[0].trim();
      const introText = firstPara || raw;

      streamTextIntoChapter(chapterId, 'introductionText', introText);
    } catch (err) {
      updateChapter(chapterId, (ch) => ({ ...ch, aiWriting: false }));
      toast.error(err?.message || 'AI generation failed');
    }
  };

  const saveVersion = (chapterId) => {
    if (!chapterId) return;
    const chapter = chapters.find(ch => ch.id === chapterId);
    if (!chapter) return;
    const snapshot = { ...chapter, history: undefined };
    const item = { id: `v-${Date.now()}`, label: `Version ${new Date().toLocaleTimeString()}`, snapshot };
    updateChapter(chapterId, (chapter) => ({ ...chapter, history: [...(chapter.history || []), item] }));
    toast.success('Lesson version saved');
  };

  const restoreVersion = (chapterId, versionId) => {
    if (!chapterId) return;
    updateChapter(chapterId, (chapter) => {
      const target = (chapter.history || []).find((item) => item.id === versionId);
      return target ? { ...enrichChapter(target.snapshot), history: chapter.history } : chapter;
    });
    toast.success('Lesson version restored');
  };

  const handlePublishChapter = async (chapterId) => {
    const chapter = chapters.find(ch => ch.id === chapterId);
    if (chapter?.readOnly) {
      toast.error(`Only ${chapter.authorName || 'its author'} can publish this chapter.`);
      return;
    }
    if (!chapter) {
      toast.error('Chapter not found');
      return;
    }

    // Validation
    if (!selectedClass || !selectedSection || !selectedSubject) {
      toast.error('Select class, section and subject before publishing');
      return;
    }

    if (!chapter.title || /^untitled (chapter|lesson)$/i.test(String(chapter.title).trim())) {
      toast.error('Please add a title to this chapter');
      return;
    }

    const hasUploadingFiles = [
      ...(chapter.worksheetFiles || []),
      ...Object.values(chapter.contentUploads || {}).flat(),
    ].some((file) => file?.isUploading);
    if (hasUploadingFiles) {
      toast.error('Please wait for uploads to finish before publishing');
      return;
    }

    const selectedSubjectOption = subjectOptions.find((item) => item.subjectId === selectedSubject);

    // Use chapter's date if available, otherwise use today's date
    const date = chapter.lessonDate || new Date().toISOString().slice(0, 10);

    // Create planner content for this single chapter
    const chapterTitle = String(chapter.title || '').trim();
    const subtopicTitle = stripHtml(chapter.introductionText) || 'Overview';

    const singleChapterContent = {
      chapters: [{
        id: 'chapter-1',
        title: chapterTitle,
        // textbook chapter → students see lessons grouped the same way
        unitNumber: Number(chapter.unitNumber) > 0 ? Number(chapter.unitNumber) : null,
        unitTitle: String(chapter.unitTitle || '').trim(),
        topics: [{
          id: 'topic-1',
          title: chapterTitle,
          subTopics: [{
            id: 'subtopic-1',
            title: subtopicTitle,
            learningPaths: chapter.explanation ? [stripHtml(chapter.explanation)] : [],
            studyMaterials: chapter.worksheetLink ? [String(chapter.worksheetLink).trim()] : [],
            mindMaps: [],
            worksheets: (chapter.worksheetFiles || []).map(serializeResourceRef).filter(Boolean),
            referenceMaterials: chapter.teacherNotes ? [stripHtml(chapter.teacherNotes)] : [],
            tryoutSections: chapter.tryouts || [],
            labExperiments: chapter.labExperiments || [],
            selfAssessments: chapter.recap ? [stripHtml(chapter.recap)] : [],
          }],
        }],
      }]
    };

    const payload = {
      classId: selectedClass,
      sectionId: selectedSection,
      subjectId: selectedSubject,
      title: chapterTitle,
      subject: selectedSubjectOption?.subjectName || 'Subject',
      date,
      duration: String(chapter.duration || '').trim(),
      // Use the actual objectives array from the Content tab
      learningObjectives: Array.isArray(chapter.learningObjectives) && chapter.learningObjectives.some(Boolean)
        ? chapter.learningObjectives.filter(Boolean)
        : (stripHtml(chapter.introductionText) ? [stripHtml(chapter.introductionText)] : [chapterTitle]),
      // Instructional flow phases from Content tab
      instructionalFlow: (Array.isArray(chapter.instructionalFlow) && chapter.instructionalFlow.length > 0
        ? chapter.instructionalFlow
        : DEFAULT_INSTRUCTIONAL_FLOW
      ).map(p => ({ id: p.id, phase: p.phase, duration: p.duration, description: p.description })),
      // Introduction hook from the Introduction tab
      introduction: stripHtml(chapter.introductionText) || '',
      // Step-by-step explanation and quick recap from Content tab
      explanation: stripHtml(chapter.explanation) || '',
      recap: stripHtml(chapter.recap) || '',
      // Facts, one per line (the student reader shows them as Fact 1, Fact 2…)
      didYouKnow: getDidYouKnowFacts(chapter).map((f) => String(f).trim()).filter(Boolean).join('\n'),
      // Formatted versions (bold/italic/images) for the student reader.
      introductionHtml: chapter.introductionText || '',
      explanationHtml: chapter.explanation || '',
      recapHtml: chapter.recap || '',
      didYouKnowHtml: '',
      materialsNeeded: Object.entries(chapter.contentUploads || {})
        .filter(([bucket]) => MATERIAL_BUCKETS.has(bucket))
        .flatMap(([bucket, files]) => (files || []).map((file) => serializeResourceRef(file, bucket)).filter(Boolean)),
      additionalNotes: stripHtml(chapter.teacherNotes) || '',
      plannerContent: singleChapterContent,
      // AI workflow trigger fields
      curriculumCode:    chapter.curriculumCode    || '',
      hingeQuestion:     chapter.hingeQuestion     || '',
      hingeOptions:      chapter.hingeOptions      || [],
      hingeAnswer:       chapter.hingeAnswer       ?? 0,
      hingeThreshold:    chapter.hingeThreshold    ?? 50,
      exitQuizThreshold: chapter.exitQuizThreshold ?? 60,
    };

    let progressTimer = null;
    try {
      setPublishing(true);
      setPublishProgress(8);
      progressTimer = setInterval(() => {
        setPublishProgress((current) => {
          if (current >= 92) return current;
          const nextStep = current < 45 ? 9 : current < 75 ? 5 : 2;
          return Math.min(92, current + nextStep);
        });
      }, 450);

      const isUpdate = !!chapter.publishedPlanId;
      const url = isUpdate
        ? `${API_BASE}/api/lesson-plans/teacher/${chapter.publishedPlanId}`
        : `${API_BASE}/api/lesson-plans/teacher`;
      const method = isUpdate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      setPublishProgress(95);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to publish chapter');
      setPublishProgress(100);

      // If it was a new chapter, update its state with the new plan ID
      const newPlanId = data?.plan?._id || data?.data?._id;
      updateChapter(chapterId, (ch) => ({
        ...ch,
        publishedPlanId: isUpdate ? ch.publishedPlanId : newPlanId,
        status: 'published',
        isDraft: false,
      }));
      toast.success(`Chapter "${chapterTitle}" published successfully!`);
    } catch (err) {
      toast.error(err?.message || 'Failed to publish chapter');
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setTimeout(() => {
        setPublishing(false);
        setPublishProgress(0);
      }, 900);
    }
  };

  const createTeachingMaterialFromFile = async (file, uploaded) => {
    const fileTitle = titleFromFileName(uploaded.name || file.name);
    const materialMeta = getMaterialType(uploaded.name || file.name);
    const res = await fetch(`${API_BASE}/api/teaching-materials`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: fileTitle,
        content: '',
        ...materialMeta,
        status: 'published',
        classId: selectedClass,
        sectionId: selectedSection,
        subjectId: selectedSubject,
        chapterId: fileTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        chapterTitle: fileTitle,
        topicTitle: fileTitle,
        subTopicTitle: 'Uploaded Materials',
        attachments: [uploaded],
        tags: ['smart-learning', 'uploaded-material'],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || data?.error || `Failed to save ${file.name}`);
    return data.material;
  };

  const handleUploadMaterialFiles = async (files = []) => {
    if (uploadingMaterial) return;
    if (!selectedClass || !selectedSection || !selectedSubject) {
      toast.error('Select class, section, and subject first');
      return;
    }
    if (!files.length) return;

    setUploadingMaterial(true);
    setAutosaveStatus('Uploading material...');

    let uploadedCount = 0;
    try {
      for (const file of files) {
        const uploaded = await uploadTeachingFile(file);
        await createTeachingMaterialFromFile(file, uploaded);
        uploadedCount += 1;
      }

      toast.success(`${uploadedCount} material${uploadedCount === 1 ? '' : 's'} uploaded`);
      setAutosaveStatus('Material uploaded');
    } catch (err) {
      toast.error(err?.message || 'Failed to upload material');
      setAutosaveStatus(uploadedCount > 0 ? 'Some materials uploaded' : 'Upload failed');
    } finally {
      setUploadingMaterial(false);
    }
  };

  const activeChapter = openChapters[openChapters.length - 1] || null;

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain rounded-2xl bg-[#f4f7fb] p-0 lg:overflow-hidden dark:bg-slate-950">
      <Motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="flex min-h-full w-full min-w-0 flex-col bg-white shadow-none lg:h-full lg:min-h-0 lg:overflow-hidden"
      >
        {/* Inside a class (Classes & Work) the class/section/subject are already
            chosen, so the selector header is not shown there. */}
        {(!initialSelection || (subjectOptions.length > 1 && !selectedSubject)) && (
        <HeaderActions
          autosaveStatus={publishing ? 'Publishing...' : autosaveStatus}
          selectionDisabled={selectionChanging || publishing}
          classValue={selectedClass}
          sectionValue={selectedSection}
          subjectValue={selectedSubject}
          classOptions={classOptions}
          sectionOptions={sectionOptions}
          subjectOptions={subjectOptions}
          currentChapter={activeChapter}
          currentStep={activeStep}
          onUploadMaterial={handleUploadMaterialFiles}
          uploadMaterialDisabled={uploadingMaterial}
          onClassChange={(value) => changeSelection(async () => {
            setSelectedClass(value);
            setSelectedSection('');
            setSelectedSubject('');
            writeStoredSelection({ classId: value });
            setSubjectOptions([]);
            // Clear chapters when class changes
            setChapters([]);
            setOpenChapterIds([]);
            setCurrentDraftId(null);
            localStorage.removeItem('currentLessonPlanDraft');
            await loadOptions({ classId: value });
          })}
          onSectionChange={(value) => changeSelection(async () => {
            setSelectedSection(value);
            setSelectedSubject('');
            writeStoredSelection({ classId: selectedClass, sectionId: value });
            // Clear chapters when section changes
            setChapters([]);
            setOpenChapterIds([]);
            setCurrentDraftId(null);
            localStorage.removeItem('currentLessonPlanDraft');
            await loadOptions({ classId: selectedClass, sectionId: value });
          })}
          onSubjectChange={(value) => changeSelection(async () => {
            setSelectedSubject(value);
            writeStoredSelection({ classId: selectedClass, sectionId: selectedSection, subjectId: value });
            setChapters([]);
            setOpenChapterIds([]);
            setCurrentDraftId(null);
            setAutosaveStatus('Not saved');
            localStorage.removeItem('currentLessonPlanDraft');
          })}
        />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-2 sm:p-3 lg:h-full lg:min-h-0 lg:flex-row">
          <Sidebar
            chapters={filteredChapters}
            activeChapterId={openChapterIds[openChapterIds.length - 1] || null}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSelect={(id) => {
              setOpenChapterIds([id]);
              setActiveStep(0);
              setEditorOpen(false);
            }}
            onAdd={() => {
              const used = knownUnits(chapters).map((u) => Number(u.unitNumber) || 0);
              setNewUnit({ unitNumber: (used.length ? Math.max(...used) : 0) + 1, unitTitle: '' });
            }}
            onAddLesson={(unit) => handleAddChapter(unit)}
            onRefresh={async () => {
              if (!selectedClass || !selectedSection || !selectedSubject) return;
              // save any unsaved edit first so the reload can't drop it
              if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
              if (autosaveDirtyRef.current) await saveDraft();
              await loadChaptersForSelection(selectedClass, selectedSection, selectedSubject);
              toast.success('Lessons refreshed');
            }}
            onDelete={handleDeleteChapter}
            onRename={(id, title) => updateChapter(id, (chapter) => ({ ...chapter, title }))}
            addDisabled={!selectedClass || !selectedSection || !selectedSubject}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
            onDragStart={setDraggedChapterId}
            onDrop={handleChapterDrop}
          />

          <div className="min-w-0 flex-1 rounded-[22px] bg-white sm:rounded-[28px] lg:h-full lg:min-h-0 lg:overflow-y-auto">
            {activeChapter ? (
              <>
                <ChapterPreview
                  chapter={activeChapter}
                  subjectName={selectedSubjectName}
                  onEdit={activeChapter.readOnly ? undefined : () => setEditorOpen(true)}
                  onClose={() => handleCloseChapter(activeChapter.id)}
                />
                {editorOpen && !activeChapter.readOnly && createPortal(
                  // Full-page editor, like the student admission form (portalled so
                  // the animated page wrapper cannot trap the fixed overlay).
                  <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-white lg:overflow-hidden dark:bg-slate-950">
                    <div className="flex min-h-full w-full flex-col lg:h-full">
                      <DrawerModal
                        key={activeChapter.id}
                        open={true}
                        chapter={activeChapter}
                        durations={durationOptions}
                        assessmentTypes={assessmentTypes}
                        classId={selectedClass}
                        sectionId={selectedSection}
                        subjectId={selectedSubject}
                        subjectName={selectedSubjectName}
                        classDisplayName={selectedClassName}
                        onClose={() => setEditorOpen(false)}
                        onPreview={() => setEditorOpen(false)}
                        // dates already taken by the other chapters of this class (mine + colleagues')
                        chapterOptions={knownUnits(chapters)}
                        usedLessonDates={chapters.filter((c) => c.id !== activeChapter.id).map((c) => c.lessonDate).filter(Boolean)}
                        autosaveStatus={publishing ? 'Publishing...' : autosaveStatus}
                        onUpdate={(nextChapter) => updateChapter(nextChapter.id, () => nextChapter)}
                        onAddContentFile={(file, bucket) => addContentFile(activeChapter.id, file, bucket)}
                        onRemoveContentFile={(fileId, bucket) => removeContentFile(activeChapter.id, fileId, bucket)}
                        onAddWorksheetFile={(file) => addWorksheetFile(activeChapter.id, file)}
                        onRemoveWorksheetFile={(fileId) => removeWorksheetFile(activeChapter.id, fileId)}
                        onAddAssessment={() => addAssessmentToActiveChapter(activeChapter.id)}
                        onUpdateAssessment={(assessmentId, nextAssessment) => updateAssessmentInActiveChapter(activeChapter.id, assessmentId, nextAssessment)}
                        onApplyAiSuggestion={() => applyAiSuggestion(activeChapter.id)}
                        onSaveVersion={() => saveVersion(activeChapter.id)}
                        onRestoreVersion={(versionId) => restoreVersion(activeChapter.id, versionId)}
                        onPublishChapter={() => handlePublishChapter(activeChapter.id)}
                        isPublishing={publishing}
                        publishProgress={publishProgress}
                        externalStep={activeStep}
                        onStepChange={(step) => {
                          setActiveStep(step);
                        }}
                      />
                    </div>
                  </div>,
                  document.body,
                )}
              </>
            ) : (
              <div className="flex items-center justify-center overflow-y-auto rounded-2xl border border-dashed border-blue-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="w-full max-w-sm px-5 py-6">
                  <div className="mx-auto mb-4 w-fit rounded-xl bg-blue-100 p-2.5 text-blue-600 dark:bg-blue-900/40">
                    <BookOpenCheck className="size-5" />
                  </div>

                  {!selectedClass || !selectedSection || !selectedSubject ? (
                    <>
                      <h2 className="mb-4 text-center text-base font-bold text-slate-800 dark:text-slate-100">How to get started</h2>
                      <div className="space-y-2">
                        {[
                          { step: 1, text: 'Select class, section & subject above' },
                          { step: 2, text: 'Press "+ Add Chapter" to create a chapter' },
                          { step: 3, text: 'Fill each step and press "Next" — your work saves automatically' },
                          { step: 4, text: 'Hit "Publish" to share with students' },
                        ].map(({ step, text }) => (
                          <div key={step} className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">{step}</span>
                            <p className="text-xs text-slate-600 dark:text-slate-300">{text}</p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-center text-[11px] text-slate-400">Start by selecting your class above ↑</p>
                    </>
                  ) : chapters.length > 0 ? (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} ready
                      </p>
                      <p className="mt-1 text-xs text-slate-400">Click a chapter in the list to open it, or press "+ Add Chapter" to create a new one.</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No chapters yet</p>
                      <p className="mt-1 text-xs text-slate-400">Press "+ Add Chapter" in the chapter list to create your first chapter.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Motion.div>

      {newUnit && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" onClick={() => setNewUnit(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const unitTitle = String(newUnit.unitTitle || '').trim();
              if (!unitTitle) { toast.error('Give the chapter a name'); return; }
              const unit = { unitNumber: Number(newUnit.unitNumber) > 0 ? Math.floor(Number(newUnit.unitNumber)) : '', unitTitle };
              setNewUnit(null);
              handleAddChapter(unit); // creates the chapter's first lesson
            }}
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
            <div className="p-5">
              <h3 className="text-base font-bold text-slate-900">New chapter</h3>
              <p className="mt-0.5 text-xs text-slate-500">Create the chapter, then add its lessons one by one.</p>
              <div className="mt-4 flex gap-2">
                <label className="w-24 shrink-0">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">No.</span>
                  <input
                    type="number"
                    min={1}
                    value={newUnit.unitNumber}
                    onChange={(e) => setNewUnit((u) => ({ ...u, unitNumber: e.target.value }))}
                    className="h-10 w-full rounded-full border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </label>
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Chapter name</span>
                  <input
                    autoFocus
                    value={newUnit.unitTitle}
                    onChange={(e) => setNewUnit((u) => ({ ...u, unitTitle: e.target.value }))}
                    placeholder="e.g. Computer Basics"
                    className="h-10 w-full rounded-full border border-slate-200 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </label>
              </div>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setNewUnit(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Create & add lesson</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {(() => {
        const pending = chapters.find((item) => item.id === pendingDeleteId);
        const title = String(pending?.title || '').trim() || 'this chapter';
        const published = pending?.status === 'published' && pending?.isDraft === false;
        return (
          <ConfirmDialog
            open={Boolean(pending)}
            onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
            onConfirm={() => { const id = pendingDeleteId; setPendingDeleteId(null); if (id) deleteChapterNow(id); }}
            icon={Trash2}
            title="Delete chapter?"
            description={published
              ? `"${title}" will be deleted and removed from the published lesson plan, so students will no longer see it. This cannot be undone.`
              : `"${title}" and everything in it will be deleted. This cannot be undone.`}
            confirmLabel="Delete chapter"
          />
        );
      })()}
    </div>
  );
};

export default AIPoweredTeaching;
