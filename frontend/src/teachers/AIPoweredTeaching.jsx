import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { BookOpenCheck } from 'lucide-react';
import HeaderActions from './components/lesson-plan-builder/HeaderActions';
import Sidebar from './components/lesson-plan-builder/Sidebar';
import DrawerModal, { DEFAULT_INSTRUCTIONAL_FLOW } from './components/lesson-plan-builder/DrawerModal';
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
  'Upload Worksheet': [],
  'Upload Tryout': [],
  Assessments: [],
  Experiments: [],
  'Report Upload': [],
  'Explanation Attachments': [],
  'Uploaded Material': [],
};

const enrichChapter = (chapter) => ({
  ...chapter,
  lessonDate: chapter.lessonDate || '',
  introductionText: chapter.introductionText || chapter.description || '',
  explanation: chapter.explanation || '',
  recap: chapter.recap || '',
  teacherNotes: chapter.teacherNotes || '',
  evaluation: chapter.evaluation || { participation: '', remarks: '', behaviour: '', progress: '', tag: '' },
  contentUploads: { ...defaultContentUploads, ...(chapter.contentUploads || {}) },
  worksheetFiles: chapter.worksheetFiles || [],
  worksheetLink: chapter.worksheetLink || '',
  assessments: Array.isArray(chapter.assessments) ? chapter.assessments : [],
  history: chapter.history || [],
  tryouts: chapter.tryouts || [],
});

const toIdString = (value) => String(value || '').trim();

const normalizeLoadedChapter = (chapter, plan, index) => {
  const source = chapter && typeof chapter === 'object' ? chapter : {};
  const chapterTitle = String(source.title || plan?.title || 'Untitled Chapter').trim() || 'Untitled Chapter';
  const lessonDate = source.lessonDate || (plan?.date ? new Date(plan.date).toISOString().slice(0, 10) : '');
  const status = plan?.status === 'published' && plan?.isDraft === false ? 'published' : 'draft';

  return enrichChapter({
    ...source,
    id: toIdString(source.id || `${toIdString(plan?._id) || 'plan'}-${index}`),
    introductionText: source.introductionText || plan?.introductionText || '',
    learningObjectives: source.learningObjectives || plan?.learningObjectives || [],
    publishedPlanId: status === 'published' ? toIdString(plan?._id) : null,
    publishedChapterTitle: status === 'published' ? chapterTitle : '',
    title: chapterTitle,
    lessonDate,
    status,
    isDraft: status !== 'published',
    contentUploads: source.contentUploads || defaultContentUploads,
    worksheetFiles: Array.isArray(source.worksheetFiles) ? source.worksheetFiles : [],
    worksheetLink: source.worksheetLink || '',
    assessments: Array.isArray(source.assessments) ? source.assessments : [],
    history: Array.isArray(source.history) ? source.history : [],
    tryouts: Array.isArray(source.tryouts) ? source.tryouts : [],
  });
};

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const MATERIAL_BUCKETS = new Set(['Study Materials', 'Presentations', 'Images', 'Experiments', 'Report Upload', 'Additional Resources']);

const serializeResourceRef = (file, bucket = '') => {
  const name = String(file?.name || '').trim();
  const url = String(file?.url || '').trim();
  const safeBucket = String(bucket || '').trim();
  if (name && url && safeBucket) return `${safeBucket}::${name}::${url}`;
  if (name && url) return `${name}::${url}`;
  return name || url;
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

const AIPoweredTeaching = () => {
  const [chapters, setChapters] = useState([]);
  const [openChapterIds, setOpenChapterIds] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedChapterId, setDraggedChapterId] = useState(null);
  const [autosaveStatus, setAutosaveStatus] = useState('Not saved');
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [classOptions, setClassOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  });

  const uploadTeachingFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'smart_learning_materials');
    formData.append('tags', 'smart_learning,lesson_plan,teaching_material');

    const res = await fetch(`${API_BASE}/api/uploads/cloudinary/single`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || 'Failed to upload file');

    const uploaded = data?.files?.[0];
    if (!uploaded?.secure_url) throw new Error('Upload completed without a file URL');
    return {
      name: uploaded.originalName || file.name || 'Uploaded file',
      url: uploaded.secure_url,
      size: uploaded.bytes || file.size || 0,
      type: getFileType(uploaded.originalName || file.name || ''),
      cloudinaryPublicId: uploaded.public_id || '',
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

      // Only load chapters the teacher explicitly published — ignore auto-save drafts
      const matchingPlans = Array.isArray(data)
        ? data.filter((plan) =>
            toIdString(plan?.classId) === toIdString(classId) &&
            toIdString(plan?.sectionId) === toIdString(sectionId) &&
            toIdString(plan?.subjectId) === toIdString(subjectId) &&
            plan?.status === 'published' &&
            !plan?.isDraft
          )
        : [];

      const nextChapters = matchingPlans.flatMap((plan, pi) => {
        const plannerChapters = Array.isArray(plan?.plannerContent?.chapters) ? plan.plannerContent.chapters : [];
        const rawChapters = Array.isArray(plan?.rawChapters) ? plan.rawChapters : [];
        const source = plannerChapters.length > 0 ? plannerChapters : rawChapters;
        return source.map((ch, ci) => normalizeLoadedChapter(ch, plan, pi * 100 + ci));
      });

      if (requestSeq !== chapterLoadSeqRef.current) return;

      setChapters(nextChapters);
      setOpenChapterIds((prev) => prev.filter((cid) => nextChapters.some((ch) => ch.id === cid)));
      setAutosaveStatus(nextChapters.length > 0 ? 'Chapters loaded' : 'No chapters yet');
      // Published plans only — reset draft tracking so autosave creates a fresh draft
      setCurrentDraftId(null);
      localStorage.removeItem('currentLessonPlanDraft');
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

  const saveDraft = async () => {
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
            rawChapters: chapters,
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
        setAutosaveStatus('Draft saved');
        return;
      }

      const res = await fetch(`${API_BASE}/api/lesson-plans/teacher/draft/${draftId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          title: 'Lesson Plan Draft',
          rawChapters: chapters,
          classId: selectedClass,
          sectionId: selectedSection,
          subjectId: selectedSubject,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save draft');

      setAutosaveStatus('Saved just now');
    } catch (err) {
      setAutosaveStatus('Save failed');
      console.error('Autosave failed:', err?.message);
    }
  };

  useEffect(() => {
    const userType = localStorage.getItem('userType');
    if (userType !== 'Teacher') return;

    const initializePage = async () => {
      try {
        const storedSelection = readStoredSelection();

        await loadOptions().catch((err) => {
          toast.error(err?.message || 'Failed to load teaching options');
        });

        if (storedSelection.classId) {
          setSelectedClass(storedSelection.classId);
          await loadOptions({ classId: storedSelection.classId });
        }

        if (storedSelection.classId && storedSelection.sectionId) {
          setSelectedSection(storedSelection.sectionId);
          await loadOptions({ classId: storedSelection.classId, sectionId: storedSelection.sectionId });
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
    setAutosaveStatus('Saving...');
    autosaveTimerRef.current = setTimeout(saveDraft, 2000);
  };

  const updateChapter = (id, updater) => {
    setChapters((prev) => prev.map((chapter) => (chapter.id === id ? enrichChapter(updater(chapter)) : chapter)));
    touchAutosave();
  };

  const handleAddChapter = () => {
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
    const chapter = enrichChapter({ id: nextId, title: 'Untitled Chapter', duration: durationOptions[0], description: '', files: [], assessments: [] });
    setChapters((prev) => [...prev, chapter]);
    setOpenChapterIds((prev) => [...prev, nextId]);
    touchAutosave();
  };

  const handleDeleteChapter = async (id) => {
    const chapter = chapters.find((item) => item.id === id);
    const chapterTitle = String(chapter?.title || '').trim();
    const publishedChapterTitle = String(chapter?.publishedChapterTitle || chapterTitle).trim();
    const publishedPlanId = toIdString(chapter?.publishedPlanId);
    const isPublishedChapter = chapter?.status === 'published' && chapter?.isDraft === false;

    if (!chapter) return;

    const nextChapters = chapters.filter((ch) => ch.id !== id);
    setSidebarCollapsed(false);
    setChapters(nextChapters);
    setOpenChapterIds((prev) => prev.filter((cid) => cid !== id));
    setAutosaveStatus('Deleting...');

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveStateRef.current = { ...autosaveStateRef.current, chapters: nextChapters };
    await saveDraft();

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
        setAutosaveStatus('Deleted locally');
        toast.error('Chapter deleted from this page, but Smart Learning cleanup failed');
        return;
      }
    }

    toast.success(`Chapter "${chapterTitle || 'Untitled Chapter'}" deleted`);
  };

  const handleChapterDrop = (targetId) => {
    if (!draggedChapterId || draggedChapterId === targetId) return;
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
    const next = { id: `a-${Date.now()}`, title: '', type: assessmentTypes[0], dueDate: '', marks: 0 };
    updateChapter(chapterId, (chapter) => ({ ...chapter, assessments: [...(chapter.assessments || []), next] }));
  };

  const updateAssessmentInActiveChapter = (chapterId, assessmentId, nextAssessment) => {
    if (!chapterId) return;
    updateChapter(chapterId, (chapter) => ({ ...chapter, assessments: (chapter.assessments || []).map((assessment) => (assessment.id === assessmentId ? nextAssessment : assessment)) }));
  };

  const addContentFile = async (chapterId, file, bucket) => {
    if (!chapterId || !file || !bucket) return;
    try {
      const uploaded = await uploadTeachingFile(file);
      const nextFile = { id: `f-${Date.now()}`, ...uploaded, progress: 100 };
      updateChapter(chapterId, (chapter) => {
        const currentBucketFiles = chapter.contentUploads?.[bucket] || [];
        const newContentUploads = { ...chapter.contentUploads, [bucket]: [...currentBucketFiles, nextFile] };
        return { ...chapter, contentUploads: newContentUploads };
      });
      toast.success('File uploaded');
    } catch (err) {
      toast.error(err?.message || 'Failed to upload file');
    }
  };

  const removeContentFile = (chapterId, fileId, bucket) => {
    if (!chapterId || !bucket) return;
    updateChapter(chapterId, (chapter) => ({ ...chapter, contentUploads: { ...chapter.contentUploads, [bucket]: (chapter.contentUploads[bucket] || []).filter((file) => file.id !== fileId) } }));
  };

  const addWorksheetFile = async (chapterId, file) => {
    if (!chapterId || !file) return;
    try {
      const uploaded = await uploadTeachingFile(file);
      const nextFile = { id: `wf-${Date.now()}`, ...uploaded, progress: 100 };
      updateChapter(chapterId, (chapter) => ({ ...chapter, worksheetFiles: [...(chapter.worksheetFiles || []), nextFile] }));
      toast.success('Worksheet uploaded');
    } catch (err) {
      toast.error(err?.message || 'Failed to upload worksheet');
    }
  };

  const removeWorksheetFile = (chapterId, fileId) => {
    if (!chapterId) return;
    updateChapter(chapterId, (chapter) => ({ ...chapter, worksheetFiles: (chapter.worksheetFiles || []).filter((file) => file.id !== fileId) }));
  };

  const applyAiSuggestion = (chapterId) => {
    if (!chapterId) return;
    const aiText = '<ul><li>Connect topic with real-life examples.</li><li>Ask one diagnostic question before explanation.</li><li>Conclude with a quick reflective exit ticket.</li></ul>';
    updateChapter(chapterId, (chapter) => ({ ...chapter, introductionText: aiText }));
    toast.success('AI lesson suggestion applied');
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
    if (!chapter) {
      toast.error('Chapter not found');
      return;
    }

    // Validation
    if (!selectedClass || !selectedSection || !selectedSubject) {
      toast.error('Select class, section and subject before publishing');
      return;
    }

    if (!chapter.title || chapter.title === 'Untitled Chapter') {
      toast.error('Please add a title to this chapter');
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
            selfAssessments: chapter.recap ? [stripHtml(chapter.recap)] : [],
            questionPapers: {
              basic: (chapter.assessments || [])[0]?.title || '',
              intermediate: (chapter.assessments || [])[1]?.title || '',
              advanced: (chapter.assessments || [])[2]?.title || '',
            },
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
      // Step-by-step explanation and quick recap from Content tab
      explanation: stripHtml(chapter.explanation) || '',
      recap: stripHtml(chapter.recap) || '',
      materialsNeeded: Object.entries(chapter.contentUploads || {})
        .filter(([bucket]) => MATERIAL_BUCKETS.has(bucket))
        .flatMap(([bucket, files]) => (files || []).map((file) => serializeResourceRef(file, bucket)).filter(Boolean)),
      additionalNotes: stripHtml(chapter.teacherNotes) || '',
      plannerContent: singleChapterContent,
    };

    try {
      setPublishing(true);
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to publish chapter');

      // If it was a new chapter, update its state with the new plan ID
      const newPlanId = data?.data?._id;
      updateChapter(chapterId, (ch) => ({
        ...ch,
        publishedPlanId: isUpdate ? ch.publishedPlanId : newPlanId,
        publishedChapterTitle: chapterTitle,
        status: 'published',
        isDraft: false,
      }));
      toast.success(`Chapter "${chapterTitle}" published successfully!`);
    } catch (err) {
      toast.error(err?.message || 'Failed to publish chapter');
    } finally {
      setPublishing(false);
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

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#dbeafe,_#eef2ff_42%,_#f8fafc_70%)] p-3 dark:bg-slate-950">
      <div className="mx-auto flex h-full max-w-[1600px] min-h-0 flex-col gap-2.5">
        <HeaderActions
          autosaveStatus={publishing ? 'Publishing...' : autosaveStatus}
          classValue={selectedClass}
          sectionValue={selectedSection}
          subjectValue={selectedSubject}
          classOptions={classOptions}
          sectionOptions={sectionOptions}
          subjectOptions={subjectOptions}
          onUploadMaterial={handleUploadMaterialFiles}
          uploadMaterialDisabled={uploadingMaterial}
          onClassChange={async (value) => {
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
          }}
          onSectionChange={async (value) => {
            setSelectedSection(value);
            setSelectedSubject('');
            writeStoredSelection({ classId: selectedClass, sectionId: value });
            // Clear chapters when section changes
            setChapters([]);
            setOpenChapterIds([]);
            setCurrentDraftId(null);
            localStorage.removeItem('currentLessonPlanDraft');
            await loadOptions({ classId: selectedClass, sectionId: value });
          }}
          onSubjectChange={(value) => {
            setSelectedSubject(value);
            writeStoredSelection({ classId: selectedClass, sectionId: selectedSection, subjectId: value });
            setChapters([]);
            setOpenChapterIds([]);
            setCurrentDraftId(null);
            setAutosaveStatus('Not saved');
            localStorage.removeItem('currentLessonPlanDraft');
          }}
        />

        <div className="flex flex-1 min-h-0 gap-2.5">
          <Sidebar
            chapters={filteredChapters}
            activeChapterId={openChapterIds[openChapterIds.length - 1] || null}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSelect={(id) => {
              if (!openChapterIds.includes(id)) {
                setOpenChapterIds((prev) => [...prev, id]);
              }
            }}
            onAdd={handleAddChapter}
            onDelete={handleDeleteChapter}
            onRename={(id, title) => updateChapter(id, (chapter) => ({ ...chapter, title }))}
            addDisabled={!selectedClass || !selectedSection || !selectedSubject}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
            onDragStart={setDraggedChapterId}
            onDrop={handleChapterDrop}
          />

          <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl ">
            {openChapters.length > 0 ? (
              <div className="space-y-4 overflow-y-auto pb-4 pr-1">
                {openChapters.map((chapter) => (
                  <DrawerModal
                    key={chapter.id}
                    open={true}
                    chapter={chapter}
                    durations={durationOptions}
                    assessmentTypes={assessmentTypes}
                    classId={selectedClass}
                    sectionId={selectedSection}
                    subjectId={selectedSubject}
                    onClose={() => handleCloseChapter(chapter.id)}
                    onUpdate={(nextChapter) => updateChapter(nextChapter.id, () => nextChapter)}
                    onAddContentFile={(file, bucket) => addContentFile(chapter.id, file, bucket)}
                    onRemoveContentFile={(fileId, bucket) => removeContentFile(chapter.id, fileId, bucket)}
                    onAddWorksheetFile={(file) => addWorksheetFile(chapter.id, file)}
                    onRemoveWorksheetFile={(fileId) => removeWorksheetFile(chapter.id, fileId)}
                    onAddAssessment={() => addAssessmentToActiveChapter(chapter.id)}
                    onUpdateAssessment={(assessmentId, nextAssessment) => updateAssessmentInActiveChapter(chapter.id, assessmentId, nextAssessment)}
                    onApplyAiSuggestion={() => applyAiSuggestion(chapter.id)}
                    onSaveVersion={() => saveVersion(chapter.id)}
                    onRestoreVersion={(versionId) => restoreVersion(chapter.id, versionId)}
                    onPublishChapter={() => handlePublishChapter(chapter.id)}
                    isPublishing={publishing}
                  />
                ))}
              </div>
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
                          { step: 2, text: 'Click + in the sidebar to add a chapter' },
                          { step: 3, text: 'Fill in the chapter details step by step' },
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
                      <p className="mt-1 text-xs text-slate-400">Click a chapter in the sidebar to open it, or press + to add one.</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No chapters yet</p>
                      <p className="mt-1 text-xs text-slate-400">Press the + button in the sidebar to create your first chapter.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIPoweredTeaching;
