import React, { useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { BookOpenCheck, X } from 'lucide-react';
import HeaderActions from './components/lesson-plan-builder/HeaderActions';
import Sidebar from './components/lesson-plan-builder/Sidebar';
import DrawerModal from './components/lesson-plan-builder/DrawerModal';
import RichTextMaterialEditor from './components/RichTextMaterialEditor';
import { assessmentTypes, durationOptions, initialChapters } from './components/lesson-plan-builder/mockData';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const getFileType = (name = '') => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'ppt';
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return 'sheet';
  if (/\.(jpg|jpeg|png|gif|webp)$/.test(lower)) return 'image';
  return 'file';
};

const defaultContentUploads = {
  'Upload Worksheet': [],
  'Upload Tryout': [],
  Assessments: [],
  Experiments: [],
  'Report Upload': [],
  'Explanation Attachments': [],
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

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const asIdString = (value) => (value ? String(value) : '');
const chapterKey = (value) => String(value || '').trim().toLowerCase();

const AIPoweredTeaching = () => {
  const [chapters, setChapters] = useState([]);
  const [openChapterIds, setOpenChapterIds] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedChapterId, setDraggedChapterId] = useState(null);
  const [autosaveStatus, setAutosaveStatus] = useState('Not saved');
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const [classOptions, setClassOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [showUploadMaterial, setShowUploadMaterial] = useState(false);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  });

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

  const loadChaptersForSelection = async (classId, sectionId, subjectId) => {
    if (!classId || !sectionId || !subjectId) return;

    try {
      // Fetch all lesson plans so we can include both saved drafts and published plans.
      const res = await fetch(`${API_BASE}/api/lesson-plans/teacher/my`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch lesson plans');

      const allPlans = Array.isArray(data) ? data : [];
      const matchingPlans = allPlans.filter((plan) => {
        const planClassId = asIdString(plan?.classId?._id || plan?.classId);
        const planSectionId = asIdString(plan?.sectionId?._id || plan?.sectionId);
        const planSubjectId = asIdString(plan?.subjectId?._id || plan?.subjectId);
        return (
          planClassId === asIdString(classId) &&
          planSectionId === asIdString(sectionId) &&
          planSubjectId === asIdString(subjectId)
        );
      });

      if (matchingPlans.length > 0) {
        const merged = [];
        const seen = new Set();

        matchingPlans.forEach((plan) => {
          const raw = Array.isArray(plan?.rawChapters) ? plan.rawChapters : [];
          raw.forEach((chapter, idx) => {
            const title = String(chapter?.title || '').trim();
            const key = chapterKey(title || chapter?.id || `${plan?._id}-draft-${idx}`);
            if (seen.has(key)) return;
            seen.add(key);
            merged.push(
              enrichChapter({
                id: chapter?.id || `draft-${plan?._id}-${idx}`,
                ...chapter,
                title: title || `Chapter ${merged.length + 1}`,
              })
            );
          });

          const plannerChapters = Array.isArray(plan?.plannerContent?.chapters)
            ? plan.plannerContent.chapters
            : [];
          plannerChapters.forEach((chapter, idx) => {
            const title = String(chapter?.title || '').trim();
            const key = chapterKey(title || chapter?.id || `${plan?._id}-published-${idx}`);
            if (seen.has(key)) return;
            seen.add(key);

            const firstSubTopic = chapter?.topics?.[0]?.subTopics?.[0];
            merged.push(
              enrichChapter({
                id: chapter?.id || `published-${plan?._id}-${idx}`,
                title: title || `Chapter ${merged.length + 1}`,
                introductionText: firstSubTopic?.title || '',
                explanation: Array.isArray(firstSubTopic?.learningPaths)
                  ? firstSubTopic.learningPaths.join('\n')
                  : '',
                teacherNotes: Array.isArray(firstSubTopic?.referenceMaterials)
                  ? firstSubTopic.referenceMaterials.join('\n')
                  : '',
              })
            );
          });
        });

        setChapters(merged);
        setOpenChapterIds([]);

        // Keep autosave linked to the most recent matching draft, if present.
        const latestMatchingDraft = matchingPlans.find((plan) => plan?.isDraft === true);
        setCurrentDraftId(latestMatchingDraft?._id || null);
        setAutosaveStatus('Loaded');

        if (merged.length > 0) {
          toast.success(`Loaded ${merged.length} existing ${merged.length === 1 ? 'chapter' : 'chapters'}`);
        }
      } else {
        // No existing draft/published chapter for this selection, start fresh.
        setChapters([]);
        setOpenChapterIds([]);
        setCurrentDraftId(null);
        setAutosaveStatus('Not saved');
      }
    } catch (err) {
      console.error('Error loading chapters for selection:', err);
      toast.error('Failed to load existing chapters');
    }
  };


  const loadDraft = async (draftId, options = { showToast: true, openChapters: false, updateSelection: true }) => {
    try {
      const res = await fetch(`${API_BASE}/api/lesson-plans/teacher/draft/${draftId}`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load draft');

      const draft = data?.data;
      if (!draft) throw new Error('Draft not found');

      setCurrentDraftId(draft._id);

      const loadedChapters = Array.isArray(draft.rawChapters) ? draft.rawChapters.map(enrichChapter) : [];
      setChapters(loadedChapters);

      console.log('Loaded draft:', { id: draft._id, chapterCount: loadedChapters.length, chapters: loadedChapters.map(c => c.title) });

      // Only open chapters if explicitly requested
      if (options.openChapters) {
        setOpenChapterIds(loadedChapters.map(ch => ch.id));
      } else {
        setOpenChapterIds([]);
      }

      // Only update selection if requested (not when loading from class/section/subject selection)
      if (options.updateSelection !== false) {
        setSelectedClass(draft.classId || '');
        setSelectedSection(draft.sectionId || '');
        setSelectedSubject(draft.subjectId || '');

        if (draft.classId) {
          await loadOptions({ classId: draft.classId });
          if (draft.sectionId) {
            await loadOptions({ classId: draft.classId, sectionId: draft.sectionId });
          }
        }
      }

      // Save to localStorage so we can reload on refresh
      localStorage.setItem('currentLessonPlanDraft', draft._id);

      setAutosaveStatus('Loaded');
      if (options.showToast) {
        toast.success('Draft loaded successfully');
      }
      setInitialLoadComplete(true);
    } catch (err) {
      console.error('Failed to load draft:', err);
      toast.error(err?.message || 'Failed to load draft');
    }
  };

  const createNewDraft = async () => {
    try {
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

      const draftId = data?.data?._id;
      setCurrentDraftId(draftId);

      // Save to localStorage
      if (draftId) {
        localStorage.setItem('currentLessonPlanDraft', draftId);
      }

      setAutosaveStatus('Draft created');
      toast.success('New draft created');
      return draftId;
    } catch (err) {
      toast.error(err?.message || 'Failed to create draft');
      return null;
    }
  };

  const saveDraft = async () => {
    try {
      let draftId = currentDraftId;

      if (!draftId) {
        draftId = await createNewDraft();
        if (!draftId) return;
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
      toast.error(err?.message || 'Failed to save draft');
    }
  };

  const debouncedSaveDraft = useMemo(() => {
    let timeoutId = null;
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      setAutosaveStatus('Saving...');
      timeoutId = setTimeout(() => {
        saveDraft();
      }, 2000);
    };
  }, [currentDraftId, chapters, selectedClass, selectedSection, selectedSubject]);

  useEffect(() => {
    const userType = localStorage.getItem('userType');
    if (userType !== 'Teacher') return;

    const initializePage = async () => {
      try {
        // Load options first
        await loadOptions().catch((err) => {
          toast.error(err?.message || 'Failed to load teaching options');
        });

        setInitialLoadComplete(true);
      } catch (err) {
        console.error('Initialization error:', err);
        setInitialLoadComplete(true);
      }
    };

    initializePage();
  }, []);

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
    debouncedSaveDraft();
  };

  const updateChapter = (id, updater) => {
    setChapters((prev) => prev.map((chapter) => (chapter.id === id ? enrichChapter(updater(chapter)) : chapter)));
    touchAutosave();
  };

  const handleAddChapter = () => {
    // Must select class/section/subject first
    if (!selectedClass || !selectedSection || !selectedSubject) {
      toast.error('Please select class, section, and subject first');
      return;
    }

    const nextId = `ch-${Date.now()}`;
    const chapter = enrichChapter({ id: nextId, title: 'Untitled Chapter', duration: durationOptions[0], description: '', files: [], assessments: [] });
    setChapters((prev) => [...prev, chapter]);
    setOpenChapterIds((prev) => [...prev, nextId]);
    touchAutosave();
  };

  const handleDeleteChapter = (id) => {
    setChapters((prev) => prev.filter((chapter) => chapter.id !== id));
    setOpenChapterIds((prev) => prev.filter((chapterId) => chapterId !== id));
    touchAutosave();
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

  const addContentFile = (chapterId, file, bucket) => {
    if (!chapterId || !file || !bucket) return;
    const nextFile = { id: `f-${Date.now()}`, name: file.name || 'Uploaded file', type: getFileType(file.name || ''), progress: 100 };
    updateChapter(chapterId, (chapter) => ({ ...chapter, contentUploads: { ...chapter.contentUploads, [bucket]: [...(chapter.contentUploads[bucket] || []), nextFile] } }));
  };

  const removeContentFile = (chapterId, fileId, bucket) => {
    if (!chapterId || !bucket) return;
    updateChapter(chapterId, (chapter) => ({ ...chapter, contentUploads: { ...chapter.contentUploads, [bucket]: (chapter.contentUploads[bucket] || []).filter((file) => file.id !== fileId) } }));
  };

  const addWorksheetFile = (chapterId, file) => {
    if (!chapterId || !file) return;
    const nextFile = { id: `wf-${Date.now()}`, name: file.name, type: getFileType(file.name), progress: 100 };
    updateChapter(chapterId, (chapter) => ({ ...chapter, worksheetFiles: [...(chapter.worksheetFiles || []), nextFile] }));
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

  const buildPlannerContent = () => {
    const validChapters = chapters
      .map((chapter, chapterIndex) => {
        const chapterTitle = String(chapter.title || '').trim() || `Chapter ${chapterIndex + 1}`;
        const subtopicTitle = stripHtml(chapter.introductionText) || 'Overview';
        return {
          id: `chapter-${chapterIndex + 1}`,
          title: chapterTitle,
          topics: [
            {
              id: `topic-${chapterIndex + 1}`,
              title: chapterTitle,
              subTopics: [
                {
                  id: `subtopic-${chapterIndex + 1}`,
                  title: subtopicTitle,
                  learningPaths: chapter.explanation ? [stripHtml(chapter.explanation)] : [],
                  studyMaterials: chapter.worksheetLink ? [String(chapter.worksheetLink).trim()] : [],
                  mindMaps: [],
                  worksheets: (chapter.worksheetFiles || []).map((file) => file.name).filter(Boolean),
                  referenceMaterials: chapter.teacherNotes ? [stripHtml(chapter.teacherNotes)] : [],
                  tryoutSections: chapter.tryouts || [],
                  selfAssessments: chapter.recap ? [stripHtml(chapter.recap)] : [],
                  questionPapers: {
                    basic: (chapter.assessments || [])[0]?.title || '',
                    intermediate: (chapter.assessments || [])[1]?.title || '',
                    advanced: (chapter.assessments || [])[2]?.title || '',
                  },
                },
              ],
            },
          ],
        };
      })
      .filter(Boolean);

    return { chapters: validChapters };
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
            worksheets: (chapter.worksheetFiles || []).map((file) => file.name).filter(Boolean),
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
      learningObjectives: stripHtml(chapter.introductionText) ? [stripHtml(chapter.introductionText)] : [chapterTitle],
      materialsNeeded: Object.values(chapter.contentUploads || {})
        .flatMap((files) => (files || []).map((file) => file?.name).filter(Boolean)),
      additionalNotes: stripHtml(chapter.teacherNotes) || '',
      plannerContent: singleChapterContent,
    };

    try {
      setPublishing(true);
      const res = await fetch(`${API_BASE}/api/lesson-plans/teacher`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to publish chapter');

      toast.success(`Chapter "${chapterTitle}" published successfully!`);
    } catch (err) {
      toast.error(err?.message || 'Failed to publish chapter');
    } finally {
      setPublishing(false);
    }
  };

  const handleOpenUploadMaterial = () => {
    if (!selectedClass || !selectedSection) {
      toast.error('Select class and section first');
      return;
    }
    setShowUploadMaterial(true);
  };

  const handleNewPlan = () => {
    setCurrentDraftId(null);
    setChapters([]);
    setOpenChapterIds([]);
    setSelectedClass('');
    setSelectedSection('');
    setSelectedSubject('');
    setAutosaveStatus('Not saved');
    setInitialLoadComplete(true);

    // Clear saved draft from localStorage
    localStorage.removeItem('currentLessonPlanDraft');

    toast.success('Started new plan');
  };

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#dbeafe,_#eef2ff_42%,_#f8fafc_70%)] p-4 dark:bg-slate-950 md:p-6">
      <Toaster position="top-right" />
      <div className="mx-auto flex h-full max-w-[1600px] min-h-0 flex-col gap-4">
        <HeaderActions
          autosaveStatus={publishing ? 'Publishing...' : autosaveStatus}
          classValue={selectedClass}
          sectionValue={selectedSection}
          subjectValue={selectedSubject}
          classOptions={classOptions}
          sectionOptions={sectionOptions}
          subjectOptions={subjectOptions}
          onUploadMaterial={handleOpenUploadMaterial}
          onClassChange={async (value) => {
            setSelectedClass(value);
            setSelectedSection('');
            setSelectedSubject('');
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
            // Clear chapters when section changes
            setChapters([]);
            setOpenChapterIds([]);
            setCurrentDraftId(null);
            localStorage.removeItem('currentLessonPlanDraft');
            await loadOptions({ classId: selectedClass, sectionId: value });
          }}
          onSubjectChange={async (value) => {
            setSelectedSubject(value);
            // Load existing chapters for this class/section/subject combination
            await loadChaptersForSelection(selectedClass, selectedSection, value);
          }}
        />

        <div className="flex flex-1 min-h-0 gap-4">
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
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
            onDragStart={setDraggedChapterId}
            onDrop={handleChapterDrop}
          />

          <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-blue-100 bg-white/70 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
            {openChapters.length > 0 ? (
              <div className="h-full min-h-0 space-y-6 overflow-y-auto pb-8 pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-200 hover:[&::-webkit-scrollbar-thumb]:bg-blue-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent">
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
              <div className="flex h-full min-h-0 items-center justify-center overflow-y-auto rounded-2xl border border-dashed border-blue-200 bg-white/80 text-center dark:border-slate-700 dark:bg-slate-900/60 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-200 hover:[&::-webkit-scrollbar-thumb]:bg-blue-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent">
                <div className="max-w-md space-y-3 px-6">
                  <div className="mx-auto w-fit rounded-2xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/40"><BookOpenCheck className="size-6" /></div>
                  <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Chapter Workspace</h2>
                  {selectedClass && selectedSection && selectedSubject ? (
                    chapters.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-slate-600 dark:text-slate-300">You have {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} saved.</p>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Click on a chapter in the sidebar to start editing!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-slate-600 dark:text-slate-300">No chapters yet for this class/section/subject.</p>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Click the + button on the left to create your first chapter!</p>
                      </div>
                    )
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600 dark:text-slate-300">Select a class, section, and subject above to get started.</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Any existing chapters for that selection will load automatically in the sidebar.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showUploadMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl">
            <button
              type="button"
              onClick={() => setShowUploadMaterial(false)}
              className="absolute right-4 top-4 z-10 rounded-full bg-white p-1.5 text-slate-500 shadow hover:bg-slate-100"
              aria-label="Close upload material"
            >
              <X className="size-4" />
            </button>
            <RichTextMaterialEditor
              classId={selectedClass}
              sectionId={selectedSection}
              subjectId={selectedSubject}
              onCancel={() => setShowUploadMaterial(false)}
              onSave={(savedMaterial) => {
                setShowUploadMaterial(false);
                toast.success(
                  savedMaterial?.status === 'published'
                    ? 'Material is now visible to students'
                    : 'Material saved as draft. Choose "Publish now" to make it visible to students.'
                );
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AIPoweredTeaching;
