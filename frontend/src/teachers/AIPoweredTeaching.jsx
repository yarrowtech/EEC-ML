import React, { useMemo, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { BookOpenCheck } from 'lucide-react';
import HeaderActions from './components/lesson-plan-builder/HeaderActions';
import Sidebar from './components/lesson-plan-builder/Sidebar';
import DrawerModal from './components/lesson-plan-builder/DrawerModal';
import { assessmentTypes, durationOptions, initialChapters } from './components/lesson-plan-builder/mockData';

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
  history: chapter.history || [],
});

const AIPoweredTeaching = () => {
  const seeded = initialChapters.map(enrichChapter);
  const [lessonTitle, setLessonTitle] = useState('Algebra Foundations - Term 1');
  const [chapters, setChapters] = useState(seeded);
  const [activeChapterId, setActiveChapterId] = useState(seeded[0]?.id || null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedChapterId, setDraggedChapterId] = useState(null);
  const [autosaveStatus, setAutosaveStatus] = useState('Saved 2m ago');
  const [selectedClass, setSelectedClass] = useState('Class 9');
  const [selectedSection, setSelectedSection] = useState('Section A');
  const [selectedSubject, setSelectedSubject] = useState('Mathematics');

  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const query = searchQuery.toLowerCase();
    return chapters.filter((chapter) => chapter.title.toLowerCase().includes(query));
  }, [chapters, searchQuery]);

  const activeChapter = useMemo(() => chapters.find((chapter) => chapter.id === activeChapterId) || null, [chapters, activeChapterId]);

  const progress = useMemo(() => {
    if (!chapters.length) return 0;
    const completed = chapters.reduce((sum, chapter) => {
      const hasTitle = chapter.title && chapter.title !== 'Untitled Chapter';
      const hasDate = Boolean(chapter.lessonDate);
      const hasIntro = (chapter.introductionText || '').replace(/<[^>]*>/g, '').trim().length > 0;
      const hasAssessment = chapter.assessments.length > 0;
      return sum + [hasTitle, hasDate, hasIntro, hasAssessment].filter(Boolean).length;
    }, 0);
    return Math.round((completed / (chapters.length * 4)) * 100);
  }, [chapters]);

  const touchAutosave = () => {
    setAutosaveStatus('Saving...');
    window.setTimeout(() => setAutosaveStatus('Saved just now'), 600);
  };

  const updateChapter = (id, updater) => {
    setChapters((prev) => prev.map((chapter) => (chapter.id === id ? enrichChapter(updater(chapter)) : chapter)));
    touchAutosave();
  };

  const handleAddChapter = () => {
    const nextId = `ch-${Date.now()}`;
    const chapter = enrichChapter({ id: nextId, title: 'Untitled Chapter', duration: durationOptions[0], description: '', files: [], assessments: [] });
    setChapters((prev) => [...prev, chapter]);
    setActiveChapterId(nextId);
    setDrawerOpen(true);
    touchAutosave();
  };

  const handleDeleteChapter = (id) => {
    setChapters((prev) => {
      const next = prev.filter((chapter) => chapter.id !== id);
      if (activeChapterId === id) {
        setActiveChapterId(next[0]?.id || null);
        setDrawerOpen(Boolean(next.length));
      }
      return next;
    });
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

  const addAssessmentToActiveChapter = () => {
    if (!activeChapterId) return;
    const next = { id: `a-${Date.now()}`, title: '', type: assessmentTypes[0], dueDate: '', marks: 0 };
    updateChapter(activeChapterId, (chapter) => ({ ...chapter, assessments: [...chapter.assessments, next] }));
  };

  const updateAssessmentInActiveChapter = (assessmentId, nextAssessment) => {
    if (!activeChapterId) return;
    updateChapter(activeChapterId, (chapter) => ({ ...chapter, assessments: chapter.assessments.map((assessment) => (assessment.id === assessmentId ? nextAssessment : assessment)) }));
  };

  const addContentFile = (file, bucket) => {
    if (!activeChapterId || !file || !bucket) return;
    const nextFile = { id: `f-${Date.now()}`, name: file.name || 'Uploaded file', type: getFileType(file.name || ''), progress: 100 };
    updateChapter(activeChapterId, (chapter) => ({ ...chapter, contentUploads: { ...chapter.contentUploads, [bucket]: [...(chapter.contentUploads[bucket] || []), nextFile] } }));
  };

  const removeContentFile = (fileId, bucket) => {
    if (!activeChapterId || !bucket) return;
    updateChapter(activeChapterId, (chapter) => ({ ...chapter, contentUploads: { ...chapter.contentUploads, [bucket]: (chapter.contentUploads[bucket] || []).filter((file) => file.id !== fileId) } }));
  };

  const addWorksheetFile = (file) => {
    if (!activeChapterId || !file) return;
    const nextFile = { id: `wf-${Date.now()}`, name: file.name, type: getFileType(file.name), progress: 100 };
    updateChapter(activeChapterId, (chapter) => ({ ...chapter, worksheetFiles: [...(chapter.worksheetFiles || []), nextFile] }));
  };

  const removeWorksheetFile = (fileId) => {
    if (!activeChapterId) return;
    updateChapter(activeChapterId, (chapter) => ({ ...chapter, worksheetFiles: (chapter.worksheetFiles || []).filter((file) => file.id !== fileId) }));
  };

  const applyAiSuggestion = () => {
    if (!activeChapterId) return;
    const aiText = '<ul><li>Connect topic with real-life examples.</li><li>Ask one diagnostic question before explanation.</li><li>Conclude with a quick reflective exit ticket.</li></ul>';
    updateChapter(activeChapterId, (chapter) => ({ ...chapter, introductionText: aiText }));
    toast.success('AI lesson suggestion applied');
  };

  const saveVersion = () => {
    if (!activeChapterId || !activeChapter) return;
    const snapshot = { ...activeChapter, history: undefined };
    const item = { id: `v-${Date.now()}`, label: `Version ${new Date().toLocaleTimeString()}`, snapshot };
    updateChapter(activeChapterId, (chapter) => ({ ...chapter, history: [...(chapter.history || []), item] }));
    toast.success('Lesson version saved');
  };

  const restoreVersion = (versionId) => {
    if (!activeChapterId) return;
    updateChapter(activeChapterId, (chapter) => {
      const target = (chapter.history || []).find((item) => item.id === versionId);
      return target ? { ...enrichChapter(target.snapshot), history: chapter.history } : chapter;
    });
    toast.success('Lesson version restored');
  };

  const handlePublish = () => {
    const missing = chapters.filter((chapter) => !chapter.lessonDate || !(chapter.introductionText || '').replace(/<[^>]*>/g, '').trim());
    if (missing.length) {
      toast.error('Add Date and Introduction for all chapters before publishing');
      return;
    }
    toast.success('Lesson plan published');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_#eef2ff_42%,_#f8fafc_70%)] p-4 dark:bg-slate-950 md:p-6">
      <Toaster position="top-right" />
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <HeaderActions
          title={lessonTitle}
          onTitleChange={(value) => { setLessonTitle(value); touchAutosave(); }}
          onSave={() => { setAutosaveStatus('Saved just now'); toast.success('Draft saved'); }}
          onPublish={handlePublish}
          autosaveStatus={autosaveStatus}
          progress={progress}
          classValue={selectedClass}
          sectionValue={selectedSection}
          subjectValue={selectedSubject}
          onClassChange={(value) => { setSelectedClass(value); touchAutosave(); }}
          onSectionChange={(value) => { setSelectedSection(value); touchAutosave(); }}
          onSubjectChange={(value) => { setSelectedSubject(value); touchAutosave(); }}
        />

        <div className="flex min-h-[78vh] gap-4">
          <Sidebar
            chapters={filteredChapters}
            activeChapterId={activeChapterId}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSelect={(id) => { setActiveChapterId(id); setDrawerOpen(true); }}
            onAdd={handleAddChapter}
            onDelete={handleDeleteChapter}
            onRename={(id, title) => updateChapter(id, (chapter) => ({ ...chapter, title }))}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
            onDragStart={setDraggedChapterId}
            onDrop={handleChapterDrop}
          />

          <div className="flex-1 rounded-2xl border border-blue-100 bg-white/70 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
            {drawerOpen && activeChapter ? (
              <DrawerModal
                open={drawerOpen}
                chapter={activeChapter}
                durations={durationOptions}
                assessmentTypes={assessmentTypes}
                onClose={() => setDrawerOpen(false)}
                onUpdate={(nextChapter) => updateChapter(nextChapter.id, () => nextChapter)}
                onAddContentFile={addContentFile}
                onRemoveContentFile={removeContentFile}
                onAddWorksheetFile={addWorksheetFile}
                onRemoveWorksheetFile={removeWorksheetFile}
                onAddAssessment={addAssessmentToActiveChapter}
                onUpdateAssessment={updateAssessmentInActiveChapter}
                onApplyAiSuggestion={applyAiSuggestion}
                onSaveVersion={saveVersion}
                onRestoreVersion={restoreVersion}
              />
            ) : (
              <div className="flex h-full min-h-[70vh] items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-white/80 text-center dark:border-slate-700 dark:bg-slate-900/60">
                <div className="max-w-md space-y-2 px-6">
                  <div className="mx-auto w-fit rounded-2xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/40"><BookOpenCheck className="size-6" /></div>
                  <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Chapter Workspace</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Click any chapter on the left to open its lesson planning modal in this right-side workspace.</p>
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
