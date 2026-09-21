import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, Loader, NotebookPen,
  Mic, PenLine, ListChecks, Puzzle, ChevronRight, ChevronDown,
  FileEdit, Rocket, ArrowLeft, RotateCcw,
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
];

const TONE_CLASSES = {
  indigo: 'bg-indigo-100 text-indigo-700',
  violet: 'bg-violet-100 text-violet-700',
  purple: 'bg-purple-100 text-purple-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
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
  const [papers, setPapers] = useState([]);
  const [homework, setHomework] = useState([]);
  const [homeworkLoading, setHomeworkLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [subjects, setSubjects] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [takingTest, setTakingTest] = useState(false);
  const [openingPaperId, setOpeningPaperId] = useState('');
  const [quickPractice, setQuickPractice] = useState(null);
  const [selectedTryout, setSelectedTryout] = useState(null);
  const [activeFormatView, setActiveFormatView] = useState(null); // null | 'reading' | 'writing'
  const [practiceActivities, setPracticeActivities] = useState([]);
  const [tryoutActivities, setTryoutActivities] = useState([]);
  const [readingMaterials, setReadingMaterials] = useState([]);
  const [writingPrompts, setWritingPrompts] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState('');

  // Subject → Chapter context selectors. Topic isn't a separate selector —
  // each chapter maps to a single assigned topic in practice, so it's
  // derived automatically from the chosen chapter.
  const [subjects, setSubjects] = useState([]);
  const [mapSubjects, setMapSubjects] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [chapterFilter, setChapterFilter] = useState('all');

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

        const subjects = Array.isArray(metaData?.subjects) ? metaData.subjects : [];
        setSubjects(subjects);
        const questionRequests = subjects.flatMap((subject) => ['mcq', 'blank'].map(async (type) => {
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

  // Name of the selected subject, used to match items that only carry a
  // subject name (homework, tryouts) rather than a subjectId (papers, quick activities).
  const selectedSubjectName = useMemo(
    () => subjects.find((s) => String(s.id) === subjectFilter)?.name || '',
    [subjects, subjectFilter]
  );

  // Filter class work by difficulty + subject + search; homework by subject + search only
  const filteredPapers = useMemo(() => {
    if (activityFilter !== 'all' && activityFilter !== 'paper') return [];
    const query = searchQuery.trim().toLowerCase();
    return papers.filter(p => {
      if (difficultyFilter !== 'all' && p.difficulty !== difficultyFilter) return false;
      if (subjectFilter !== 'all' && String(p.subjectId || '') !== subjectFilter) return false;
      return !query || [p.title, p.subjectName, p.chapterTitle, p.topicTitle, p.paperType]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [activityFilter, papers, difficultyFilter, subjectFilter, searchQuery]);

  const filteredHomework = useMemo(() => {
    if (activityFilter !== 'all' && activityFilter !== 'homework') return [];
    const q = searchQuery.trim().toLowerCase();
    return homework.filter((hw) => {
      if (subjectFilter !== 'all' && selectedSubjectName
        && String(hw.subject || '').toLowerCase() !== selectedSubjectName.toLowerCase()) return false;
      if (!q) return true;
      return [hw.title, hw.subject, hw.chapterTitle, hw.topicTitle, hw.topic]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [activityFilter, homework, subjectFilter, selectedSubjectName, searchQuery]);

  const filteredPracticeActivities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return practiceActivities.filter((activity) => {
      if (activityFilter !== 'all' && activityFilter !== activity.type) return false;
      if (subjectFilter !== 'all' && String(activity.id || '') !== subjectFilter) return false;
      return !query || String(activity.name || '').toLowerCase().includes(query);
    });
  }, [activityFilter, practiceActivities, subjectFilter, searchQuery]);

  const filteredTryoutActivities = useMemo(() => {
    if (activityFilter !== 'all' && activityFilter !== 'tryout') return [];
    const query = searchQuery.trim().toLowerCase();
    return tryoutActivities.filter((activity) => {
      if (subjectFilter !== 'all' && selectedSubjectName
        && activity.subjectName?.toLowerCase() !== selectedSubjectName.toLowerCase()) return false;
      return !query || `${activity.subjectName} ${activity.topicName}`.toLowerCase().includes(query);
    });
  }, [activityFilter, searchQuery, tryoutActivities, subjectFilter, selectedSubjectName]);

  const openPaper = async (paper) => {
    if (!paper?._id || openingPaperId) return;
    setOpeningPaperId(String(paper._id));
    try {
      const response = await fetch(`${API_BASE}/api/practice-papers/student/papers/${paper._id}`, {
        headers: authHeaders,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Unable to open practice paper');
      setSelectedPaper(data.paper);
      saveLearningActivity({
        path: '/student/practice-papers',
        label: 'Class Work',
        detail: paper.title,
      });
    } catch (err) {
      toast.error(err.message || 'Unable to open practice paper');
    } finally {
      setOpeningPaperId('');
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
  // Subject and chapter are mandatory before formats render; topic is
  // optional — narrows the Topic Tryout card further but isn't required.
  const contextReady = subjectFilter !== 'all' && chapterFilter !== 'all';

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
                <option value="all">{chapters.length ? 'All Chapters' : 'No assigned chapters yet'}</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>{chapter.title}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            </div>
          </div>
        </section>

        {/* Filters */}
        <div className="mb-6 rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur-xl sm:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title, subject, chapter or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Subject Filter */}
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={String(subject.id)}>{subject.name}</option>
              ))}
            </select>

            {/* Difficulty Filter (class work only) */}
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {[
              { key: 'all', label: 'All activities' },
              { key: 'paper', label: 'Practice papers' },
              { key: 'mcq', label: 'MCQ' },
              { key: 'blank', label: 'Fill blanks' },
              { key: 'tryout', label: 'Tryouts' },
              { key: 'homework', label: 'Homework' },
            ].map((filter) => (
              <button key={filter.key} type="button" onClick={() => setActivityFilter(filter.key)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${activityFilter === filter.key ? 'border-indigo-500 bg-indigo-500 text-white shadow-md shadow-indigo-100' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-700'}`}>
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Choose Your Tryout Format ── */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
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
          ) : !contextReady ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/60 px-6 py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                {subjectFilter === 'all'
                  ? <BookOpen className="size-6" />
                  : <NotebookPen className="size-6" />}
              </div>
              <p className="max-w-xs text-sm font-medium text-indigo-700">
                {subjectFilter === 'all'
                  ? 'Please Select a Subject to see what you can practice.'
                  : 'Pick a chapter above to see what you can practice.'}
              </p>
            </div>
          ) : <>
          <div className="flex flex-col gap-3">
            {FORMAT_DEFS.map((fmt) => {
              const Icon = fmt.icon;
              const available = formatAvailability[fmt.key];
              const checked = selectedFormats.includes(fmt.key);
              const count = formatCounts[fmt.key];
              return (
                <div
                  key={fmt.key}
                  onClick={() => { if (fmt.queueable && available) toggleFormatSelection(fmt.key); }}
                  className={`group rounded-xl bg-white p-4 sm:p-5 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    available ? 'cursor-pointer hover:shadow-md' : 'opacity-50'
                  } ${checked ? 'ring-2 ring-indigo-400/40' : ''}`}
                >
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${TONE_CLASSES[fmt.tone]}`}>
                      <Icon className="size-6" />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-slate-900">{fmt.name}</h4>
                        {fmt.queueable && (
                          <span className="text-xs font-semibold text-slate-500">
                            {available ? `${count} question${count === 1 ? '' : 's'} available` : 'Not available for this selection'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{fmt.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    <button
                      type="button"
                      disabled={!available}
                      onClick={(e) => { e.stopPropagation(); startSingleFormat(fmt.key); }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-indigo-700 hover:bg-indigo-50 font-semibold text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      Start {fmt.shortLabel} <ChevronRight className="size-4" />
                    </button>
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

      {/* ── Sticky bottom dock: custom multi-format launcher ──
          Only shown once formats are queued (as the launcher) — the format
          cards themselves don't render until subject + chapter are picked,
          so there's nothing to nudge toward before then. */}
      {selectedQueueableCount > 0 && (
      <Motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/95 backdrop-blur-xl shadow-xl px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-slate-900 truncate">
              {selectedQueueableCount > 0
                ? `Selected: ${selectedFormats.map((k) => FORMAT_DEFS.find((f) => f.key === k)?.name).join(', ')}`
                : 'No formats selected'}
            </p>
            <p className="text-xs text-slate-500">
              {selectedQueueableCount > 0
                ? `${selectedQueueableCount} format${selectedQueueableCount === 1 ? '' : 's'} queued — they’ll launch one after another`
                : 'Tick MCQ, Fill Blanks or Topic Tryout above to bundle them'}
            </p>
          </div>
          <button
            type="button"
            disabled={selectedQueueableCount === 0}
            onClick={launchQueue}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            <Rocket className="size-4" />
            {selectedQueueableCount > 0 ? `Launch (${selectedQueueableCount})` : 'Select formats to start'}
          </button>
        </div>
      </Motion.div>
      )}
    </div>
  );
};

export default PracticePapersPortal;
