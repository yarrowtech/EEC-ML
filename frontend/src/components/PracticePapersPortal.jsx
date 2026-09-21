import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, Loader, NotebookPen,
  Mic, PenLine, ListChecks, Puzzle, ChevronRight, ChevronDown,
  ToggleLeft, Shuffle, FileEdit, Rocket, ArrowLeft, RotateCcw,
} from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import ReadingPracticePage from './ReadingPracticePage';
import WritingPracticePage from './WritingPracticePage';
import QuickPracticeRunner from './QuickPracticeRunner';
import AILearningTryoutSection from './AILearningTryoutSection';

// Order the launch queue is always run in, regardless of check order.
const QUEUE_ORDER = ['mcq', 'blank', 'tryout'];

const FORMAT_DEFS = [
  {
    key: 'mcq', name: 'Multiple Choice (MCQ)', icon: ListChecks, tone: 'indigo', queueable: true,
    description: 'Single and multi-select questions your teacher has published for this subject.',
    shortLabel: 'MCQ',
  },
  {
    key: 'blank', name: 'Fill in the Blanks', icon: PenLine, tone: 'violet', queueable: true,
    description: 'Type the missing word or value directly into each statement.',
    shortLabel: 'Blanks',
  },
  {
    key: 'tryout', name: 'Topic Tryout', icon: Puzzle, tone: 'purple', queueable: true,
    description: 'Interactive activities generated from your teacher’s lesson plan for this topic.',
    shortLabel: 'Tryout',
  },
  {
    key: 'reading', name: 'Reading Practice', icon: Mic, tone: 'emerald', queueable: false,
    description: 'Read a passage aloud and get real-time pronunciation and fluency feedback.',
    shortLabel: 'Reading',
  },
  {
    key: 'writing', name: 'Writing Practice', icon: FileEdit, tone: 'amber', queueable: false,
    description: 'Write a response to a prompt and get AI rubric-based evaluation.',
    shortLabel: 'Writing',
  },
  {
    key: 'true_false', name: 'True or False', icon: ToggleLeft, tone: 'slate', comingSoon: true,
    description: 'Fast conceptual checks — coming soon.',
  },
  {
    key: 'matching', name: 'Match the Following', icon: Shuffle, tone: 'slate', comingSoon: true,
    description: 'Pair related terms and concepts — coming soon.',
  },
];

const TONE_CLASSES = {
  indigo: 'bg-indigo-100 text-indigo-700',
  violet: 'bg-violet-100 text-violet-700',
  purple: 'bg-purple-100 text-purple-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  slate: 'bg-slate-100 text-slate-400',
};

// Wraps a self-contained full page (Reading/Writing practice) with a local
// back button, since those pages have no onBack prop of their own.
const FormatPageWrapper = ({ title, onBack, children }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8">
    <div className="max-w-6xl mx-auto">
      <button
        onClick={onBack}
        className="mb-6 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-2 bg-white"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Practice & Activities
      </button>
      <h1 className="sr-only">{title}</h1>
      {children}
    </div>
  </div>
);

const PracticePapersPortal = () => {
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  const token = localStorage.getItem('token');

  // State
  const [quickPractice, setQuickPractice] = useState(null);
  const [selectedTryout, setSelectedTryout] = useState(null);
  const [activeFormatView, setActiveFormatView] = useState(null); // null | 'reading' | 'writing'
  const [practiceActivities, setPracticeActivities] = useState([]);
  const [tryoutActivities, setTryoutActivities] = useState([]);
  const [readingMaterials, setReadingMaterials] = useState([]);
  const [writingPrompts, setWritingPrompts] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState('');

  // Subject → Chapter → Topic context selectors
  const [subjects, setSubjects] = useState([]);
  const [mapSubjects, setMapSubjects] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');

  // Multi-format launch queue
  const [selectedFormats, setSelectedFormats] = useState([]);
  const [queue, setQueue] = useState(null);
  const [queuePos, setQueuePos] = useState(0);

  const authHeaders = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  // Teacher question-bank activities (MCQ and fill-in-the-blank) are stored
  // separately from full practice papers, and the lesson-plan map gives us
  // the subject → chapter → topic tree plus which topics have tryouts.
  useEffect(() => {
    const controller = new AbortController();
    const fetchTeacherActivities = async () => {
      setActivitiesLoading(true);
      setActivitiesError('');
      try {
        const [metaResponse, mapResponse, readingResponse, writingResponse] = await Promise.all([
          fetch(`${API_BASE}/api/practice/student/meta`, { headers: authHeaders, signal: controller.signal }),
          fetch(`${API_BASE}/api/lesson-plans/student/smart-learning-map`, { headers: authHeaders, signal: controller.signal }),
          fetch(`${API_BASE}/api/reading-assessment/student/materials`, { headers: authHeaders, signal: controller.signal }),
          fetch(`${API_BASE}/api/writing-assessment/student/prompts`, { headers: authHeaders, signal: controller.signal }),
        ]);
        const metaData = await metaResponse.json().catch(() => ({}));
        const mapData = await mapResponse.json().catch(() => ({}));
        const readingData = await readingResponse.json().catch(() => ({}));
        const writingData = await writingResponse.json().catch(() => ({}));
        if (!metaResponse.ok) throw new Error(metaData?.error || 'Unable to load teacher activities');

        const metaSubjects = Array.isArray(metaData?.subjects) ? metaData.subjects : [];
        setSubjects(metaSubjects);
        const questionRequests = metaSubjects.flatMap((subject) => ['mcq', 'blank'].map(async (type) => {
          const params = new URLSearchParams({ subjectId: String(subject.id), type });
          const response = await fetch(`${API_BASE}/api/practice/student/questions?${params}`, {
            headers: authHeaders,
            signal: controller.signal,
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) return null;
          const count = Array.isArray(data?.questions) ? data.questions.length : 0;
          return count > 0 ? { ...subject, type, count } : null;
        }));
        const questionGroups = await Promise.all(questionRequests);
        setPracticeActivities(questionGroups.filter(Boolean));

        if (mapResponse.ok) {
          const mapSubjectList = Array.isArray(mapData?.subjects) ? mapData.subjects : [];
          setMapSubjects(mapSubjectList);

          const tryoutMap = new Map();
          mapSubjectList.forEach((subject) => {
            (Array.isArray(subject?.topics) ? subject.topics : []).forEach((topic) => {
              const questions = Array.isArray(topic?.tryoutSections) ? topic.tryoutSections : [];
              if (!questions.length) return;
              const subjectName = subject.title || subject.key || 'Subject';
              const topicName = topic.title || 'Topic';
              const key = `${subjectName.toLowerCase()}::${topicName.toLowerCase()}`;
              tryoutMap.set(key, {
                id: key,
                subjectName,
                topicName,
                count: questions.length,
              });
            });
          });
          setTryoutActivities(Array.from(tryoutMap.values()));
        }
      } catch (err) {
        if (err.name !== 'AbortError') setActivitiesError(err.message || 'Unable to load teacher activities');
      } finally {
        if (!controller.signal.aborted) setActivitiesLoading(false);
      }
    };
    fetchTeacherActivities();
    return () => controller.abort();
  }, [API_BASE, authHeaders]);

  // Reset dependent selectors whenever an ancestor changes.
  useEffect(() => {
    setChapterFilter('all');
    setTopicFilter('all');
  }, [subjectFilter]);
  useEffect(() => {
    setTopicFilter('all');
  }, [chapterFilter]);
  // Availability of each format shifts with context — drop any selection
  // that's no longer valid instead of silently launching the wrong thing.
  useEffect(() => {
    setSelectedFormats([]);
  }, [subjectFilter, chapterFilter, topicFilter]);

  const selectedSubjectName = useMemo(
    () => subjects.find((s) => String(s.id) === subjectFilter)?.name || '',
    [subjects, subjectFilter]
  );

  const selectedSubjectMapEntry = useMemo(() => {
    if (subjectFilter === 'all') return null;
    return mapSubjects.find((s) => (
      (s.subjectId && String(s.subjectId) === subjectFilter)
      || (selectedSubjectName && String(s.title || '').toLowerCase() === selectedSubjectName.toLowerCase())
    )) || null;
  }, [mapSubjects, subjectFilter, selectedSubjectName]);

  const chapters = selectedSubjectMapEntry?.chapters || [];
  const selectedChapterEntry = useMemo(
    () => chapters.find((c) => c.id === chapterFilter) || null,
    [chapters, chapterFilter]
  );
  const topics = selectedChapterEntry?.topics || [];
  const selectedTopicEntry = useMemo(
    () => topics.find((t) => t.id === topicFilter) || null,
    [topics, topicFilter]
  );
  const selectedChapterTitle = selectedChapterEntry?.title || '';
  const selectedTopicTitle = selectedTopicEntry?.title || '';

  // Real content lookups behind each format card — no card claims to work
  // unless there's an actual published set/topic behind it.
  const mcqActivity = useMemo(
    () => practiceActivities.find((a) => a.type === 'mcq' && String(a.id) === subjectFilter) || null,
    [practiceActivities, subjectFilter]
  );
  const blankActivity = useMemo(
    () => practiceActivities.find((a) => a.type === 'blank' && String(a.id) === subjectFilter) || null,
    [practiceActivities, subjectFilter]
  );
  const tryoutActivity = useMemo(() => {
    if (!selectedSubjectName || !selectedTopicTitle) return null;
    const key = `${selectedSubjectName.toLowerCase()}::${selectedTopicTitle.toLowerCase()}`;
    return tryoutActivities.find((t) => t.id === key) || null;
  }, [tryoutActivities, selectedSubjectName, selectedTopicTitle]);

  const formatAvailability = {
    mcq: Boolean(mcqActivity),
    blank: Boolean(blankActivity),
    tryout: Boolean(tryoutActivity),
    reading: true,
    writing: true,
  };
  const formatCounts = {
    mcq: mcqActivity?.count || 0,
    blank: blankActivity?.count || 0,
    tryout: tryoutActivity?.count || 0,
  };

  const launchFormat = (key) => {
    if (key === 'mcq' && mcqActivity) setQuickPractice(mcqActivity);
    else if (key === 'blank' && blankActivity) setQuickPractice(blankActivity);
    else if (key === 'tryout' && tryoutActivity) setSelectedTryout({ subjectName: selectedSubjectName, topicName: selectedTopicTitle });
    else if (key === 'reading') setActiveFormatView('reading');
    else if (key === 'writing') setActiveFormatView('writing');
  };

  const startSingleFormat = (key) => {
    setQueue(null);
    setQueuePos(0);
    launchFormat(key);
  };

  const toggleFormatSelection = (key) => {
    if (!formatAvailability[key]) return;
    setSelectedFormats((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const launchQueue = () => {
    const ordered = QUEUE_ORDER.filter((k) => selectedFormats.includes(k));
    if (!ordered.length) return;
    setQueue(ordered);
    setQueuePos(0);
    launchFormat(ordered[0]);
  };

  const resetSelection = () => setSelectedFormats([]);

  // Shared "close this format's runner" handler — advances to the next
  // queued format if one is waiting, otherwise returns to the picker.
  const handleRunnerBack = () => {
    setQuickPractice(null);
    setSelectedTryout(null);
    if (queue && queuePos < queue.length - 1) {
      const nextPos = queuePos + 1;
      setQueuePos(nextPos);
      launchFormat(queue[nextPos]);
    } else {
      setQueue(null);
      setQueuePos(0);
    }
  };

  if (quickPractice) {
    return <QuickPracticeRunner subject={quickPractice} initialType={quickPractice.type} onBack={handleRunnerBack} />;
  }

  if (selectedTryout) {
    return (
      <AILearningTryoutSection
        assignedSubjectName={selectedTryout.subjectName}
        assignedTopicName={selectedTryout.topicName}
        onBack={handleRunnerBack}
      />
    );
  }

  if (activeFormatView === 'reading') {
    return (
      <FormatPageWrapper title="Reading Practice" onBack={() => setActiveFormatView(null)}>
        <ReadingPracticePage />
      </FormatPageWrapper>
    );
  }

  if (activeFormatView === 'writing') {
    return (
      <FormatPageWrapper title="Writing Practice" onBack={() => setActiveFormatView(null)}>
        <WritingPracticePage />
      </FormatPageWrapper>
    );
  }

  const selectedQueueableCount = selectedFormats.length;

  // Main list view
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8 pb-28">
      <div className="max-w-7xl mx-auto">
        {/* ── Subject / Chapter / Topic context bar ── */}
        <div className="mb-6 rounded-2xl border border-white/80 bg-white/80 backdrop-blur-xl p-3 sm:p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 shrink-0">Browsing</span>
            <div className="relative min-w-[190px] flex-1 sm:flex-initial">
              <BookOpen className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-indigo-500" />
              <select
                aria-label="Select Subject"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="all">All Subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={String(subject.id)}>{subject.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            </div>
            <div className="relative min-w-[220px] flex-1 sm:flex-initial">
              <NotebookPen className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-violet-500" />
              <select
                aria-label="Select Chapter"
                value={chapterFilter}
                onChange={(e) => setChapterFilter(e.target.value)}
                disabled={subjectFilter === 'all' || chapters.length === 0}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">{chapters.length ? 'All Chapters' : 'No chapters yet'}</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>{chapter.title}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            </div>
            <div className="relative min-w-[210px] flex-1 sm:flex-initial">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-purple-500 font-bold text-sm">#</span>
              <select
                aria-label="Select Topic"
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                disabled={chapterFilter === 'all' || topics.length === 0}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">{topics.length ? 'All Topics' : 'No topics yet'}</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>{topic.title}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            </div>
          </div>
          {/* Breadcrumb */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="text-slate-400">Showing:</span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 font-semibold">
              {subjectFilter === 'all' ? 'All subjects' : selectedSubjectName}
            </span>
            {chapterFilter !== 'all' && selectedChapterTitle && (<>
              <ChevronRight className="size-3 text-slate-300" />
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700 font-semibold">{selectedChapterTitle}</span>
            </>)}
            {topicFilter !== 'all' && selectedTopicTitle && (<>
              <ChevronRight className="size-3 text-slate-300" />
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-700 font-semibold">{selectedTopicTitle}</span>
            </>)}
          </div>
        </div>

        {/* ── Choose Your Tryout Format ── */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">Choose Your Tryout Format</h2>
            {selectedQueueableCount > 0 && (
              <button type="button" onClick={resetSelection} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600">
                <RotateCcw className="size-3.5" /> Clear selection
              </button>
            )}
          </div>

          {activitiesLoading ? (
            <div className="flex justify-center rounded-2xl border border-white/80 bg-white/60 py-12"><Loader className="size-7 animate-spin text-indigo-600" /></div>
          ) : activitiesError ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{activitiesError}</div>
          ) : <>
          {subjectFilter === 'all' && (
            <div className="mb-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-700">
              Pick a subject above to see what you can practice.
            </div>
          )}

          <div className="flex flex-col gap-3">
            {FORMAT_DEFS.map((fmt) => {
              const Icon = fmt.icon;
              const available = !fmt.comingSoon && formatAvailability[fmt.key];
              const checked = selectedFormats.includes(fmt.key);
              const count = formatCounts[fmt.key];
              return (
                <div
                  key={fmt.key}
                  onClick={() => { if (fmt.queueable && available) toggleFormatSelection(fmt.key); }}
                  className={`group rounded-xl bg-white p-4 sm:p-5 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    fmt.comingSoon ? 'opacity-60' : available ? 'cursor-pointer hover:shadow-md' : 'opacity-50'
                  } ${checked ? 'ring-2 ring-indigo-400/40' : ''}`}
                >
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${TONE_CLASSES[fmt.tone]}`}>
                      <Icon className="size-6" />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-slate-900">{fmt.name}</h4>
                        {fmt.comingSoon ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-400">Coming soon</span>
                        ) : fmt.queueable ? (
                          <span className="text-xs font-semibold text-slate-500">
                            {available ? `${count} question${count === 1 ? '' : 's'} available` : 'Not available for this selection'}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-slate-500">{fmt.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    {!fmt.comingSoon && (
                      <button
                        type="button"
                        disabled={!available}
                        onClick={(e) => { e.stopPropagation(); startSingleFormat(fmt.key); }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-indigo-700 hover:bg-indigo-50 font-semibold text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        Start {fmt.shortLabel} <ChevronRight className="size-4" />
                      </button>
                    )}
                    {fmt.queueable && (
                      <label className="flex items-center p-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!available}
                          onChange={() => toggleFormatSelection(fmt.key)}
                          className="w-5 h-5 accent-indigo-600 rounded cursor-pointer disabled:cursor-not-allowed"
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </>}
        </section>
      </div>

      {/* ── Sticky bottom dock: custom multi-format launcher ── */}
    </div>
  );
};

export default PracticePapersPortal;
