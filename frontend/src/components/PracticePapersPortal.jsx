import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Search, Loader, Play, NotebookPen,
  CheckCircle, Clock, Award, Zap, FileText, Home, ArrowUpRight,
  Mic, PenLine, ListChecks, Puzzle, GraduationCap, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion as Motion } from 'framer-motion';
import PracticeTestInterface from './PracticeTestInterface';
import { saveLearningActivity } from '../utils/learningContinuity';
import ReadingPracticePage from './ReadingPracticePage';
import WritingPracticePage from './WritingPracticePage';
import QuickPracticeRunner from './QuickPracticeRunner';
import AILearningTryoutSection from './AILearningTryoutSection';

// Joins subject → chapter → topic into a single meta line, skipping blanks.
const paperContextLine = (item) => {
  const subject = item.subjectName || item.subject || '';
  const chapter = item.chapterTitle || item.chapter || '';
  const topic = item.topicTitle || item.topic || (Array.isArray(item.topics) ? item.topics[0] : '') || '';
  return [subject, chapter, topic].map((v) => String(v).trim()).filter(Boolean);
};

const ContextBadges = ({ item }) => {
  const parts = paperContextLine(item);
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {parts.map((part, idx) => (
        <React.Fragment key={`${part}-${idx}`}>
          {idx > 0 && <span className="text-gray-300">›</span>}
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            idx === 0 ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'bg-gray-100 text-gray-600'
          }`}>
            {part}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

const SUB_TABS = [
  { key: 'papers', label: 'Teacher Activities', icon: Zap, hint: 'Papers, MCQs & tryouts' },
  { key: 'reading', label: 'Reading Practice', icon: Mic, hint: 'Read aloud & get scored' },
  { key: 'writing', label: 'Writing Practice', icon: PenLine, hint: 'Write & get evaluated' },
];

const PracticePapersPortal = () => {
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState('papers');

  // State
  const [papers, setPapers] = useState([]);
  const [homework, setHomework] = useState([]);
  const [homeworkLoading, setHomeworkLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [takingTest, setTakingTest] = useState(false);
  const [openingPaperId, setOpeningPaperId] = useState('');
  const [quickPractice, setQuickPractice] = useState(null);
  const [selectedTryout, setSelectedTryout] = useState(null);
  const [practiceActivities, setPracticeActivities] = useState([]);
  const [tryoutActivities, setTryoutActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState('');

  const authHeaders = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  // Fetch homework (assignments given by teachers to solve at home)
  useEffect(() => {
    const fetchHomework = async () => {
      setHomeworkLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/assignment/student/assignments`, {
          headers: authHeaders
        });
        if (response.ok) {
          const data = await response.json();
          setHomework(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Error fetching homework:', err);
      } finally {
        setHomeworkLoading(false);
      }
    };

    fetchHomework();
  }, [API_BASE, authHeaders]);

  // Fetch class work (practice papers published from what was taught in class)
  useEffect(() => {
    const fetchPapers = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);

        const response = await fetch(`${API_BASE}/api/practice-papers/student/papers?${params}`, {
          headers: authHeaders
        });

        if (!response.ok) throw new Error('Failed to fetch papers');

        const data = await response.json();
        setPapers(data.papers || []);
      } catch (err) {
        console.error('Error fetching papers:', err);
        toast.error('Failed to load practice papers');
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchPapers, 300);
    return () => clearTimeout(debounceTimer);
  }, [API_BASE, authHeaders, searchQuery]);

  // Teacher question-bank activities (MCQ and fill-in-the-blank) are stored
  // separately from full practice papers. Load their counts here so students
  // can discover and launch them from one portal.
  useEffect(() => {
    const controller = new AbortController();
    const fetchTeacherActivities = async () => {
      setActivitiesLoading(true);
      setActivitiesError('');
      try {
        const [metaResponse, mapResponse] = await Promise.all([
          fetch(`${API_BASE}/api/practice/student/meta`, { headers: authHeaders, signal: controller.signal }),
          fetch(`${API_BASE}/api/lesson-plans/student/smart-learning-map`, { headers: authHeaders, signal: controller.signal }),
        ]);
        const metaData = await metaResponse.json().catch(() => ({}));
        const mapData = await mapResponse.json().catch(() => ({}));
        if (!metaResponse.ok) throw new Error(metaData?.error || 'Unable to load teacher activities');

        const subjects = Array.isArray(metaData?.subjects) ? metaData.subjects : [];
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
          const tryoutMap = new Map();
          (Array.isArray(mapData?.subjects) ? mapData.subjects : []).forEach((subject) => {
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

  // Filter class work by difficulty + search; homework by search only
  const filteredPapers = useMemo(() => {
    if (activityFilter !== 'all' && activityFilter !== 'paper') return [];
    const query = searchQuery.trim().toLowerCase();
    return papers.filter(p => {
      if (difficultyFilter !== 'all' && p.difficulty !== difficultyFilter) return false;
      return !query || [p.title, p.subjectName, p.chapterTitle, p.topicTitle, p.paperType]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [activityFilter, papers, difficultyFilter, searchQuery]);

  const filteredHomework = useMemo(() => {
    if (activityFilter !== 'all' && activityFilter !== 'homework') return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return homework;
    return homework.filter((hw) =>
      [hw.title, hw.subject, hw.chapterTitle, hw.topicTitle, hw.topic]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [activityFilter, homework, searchQuery]);

  const filteredPracticeActivities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return practiceActivities.filter((activity) => {
      if (activityFilter !== 'all' && activityFilter !== activity.type) return false;
      return !query || String(activity.name || '').toLowerCase().includes(query);
    });
  }, [activityFilter, practiceActivities, searchQuery]);

  const filteredTryoutActivities = useMemo(() => {
    if (activityFilter !== 'all' && activityFilter !== 'tryout') return [];
    const query = searchQuery.trim().toLowerCase();
    return tryoutActivities.filter((activity) => (
      !query || `${activity.subjectName} ${activity.topicName}`.toLowerCase().includes(query)
    ));
  }, [activityFilter, searchQuery, tryoutActivities]);

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
    return <QuickPracticeRunner subject={quickPractice} initialType={quickPractice.type} onBack={() => setQuickPractice(null)} />;
  }

  if (selectedTryout) {
    return (
      <AILearningTryoutSection
        assignedSubjectName={selectedTryout.subjectName}
        assignedTopicName={selectedTryout.topicName}
        onBack={() => setSelectedTryout(null)}
      />
    );
  }

  // If taking test
  if (takingTest && selectedPaper) {
    return (
      <PracticeTestInterface
        paperId={selectedPaper._id}
        paperTitle={selectedPaper.title}
        onBack={() => {
          setTakingTest(false);
          // Refetch papers to update attempt counts
          setPapers(papers.map(p => p._id === selectedPaper._id ? selectedPaper : p));
        }}
      />
    );
  }

  // Paper details view
  if (selectedPaper && !takingTest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setSelectedPaper(null)}
            className="mb-6 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            ← Back to Papers
          </button>

          <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">{selectedPaper.title}</h1>
                  <div className="mb-2">
                    <ContextBadges item={selectedPaper} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-gray-600">
                    <span className="text-sm font-medium">Questions: {selectedPaper.totalQuestions}</span>
                    <span className="text-sm">•</span>
                    <span className="text-sm font-medium">Total Marks: {selectedPaper.totalMarks}</span>
                  </div>
                </div>
                <button
                  onClick={() => setTakingTest(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 whitespace-nowrap"
                >
                  <Play className="w-5 h-5" />
                  Start Test
                </button>
              </div>

              {/* Tags */}
              {selectedPaper.tags && selectedPaper.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedPaper.tags.map((tag, idx) => (
                    <span key={idx} className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-600 mb-1">Duration</p>
                <p className="font-semibold flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {selectedPaper.duration ? `${selectedPaper.duration} min` : 'No limit'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Difficulty</p>
                <p className="font-semibold capitalize">{selectedPaper.difficulty}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Passing Score</p>
                <p className="font-semibold">{selectedPaper.passingPercentage}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Attempts</p>
                <p className="font-semibold">{selectedPaper.allowRetakes ? 'Unlimited' : 'Once only'}</p>
              </div>
            </div>

            {/* Description */}
            {selectedPaper.description && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-2">Instructions</h2>
                <p className="text-gray-700 whitespace-pre-line">{selectedPaper.description}</p>
              </div>
            )}

            {/* Question Breakdown */}
            <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h2 className="text-lg font-semibold mb-4">Question Breakdown</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {selectedPaper.questions.slice(0, 6).map((q, idx) => (
                  <div key={idx} className="text-sm">
                    <p className="text-gray-600">Q{idx + 1}</p>
                    <p className="font-medium line-clamp-2">{q.questionText}</p>
                    <p className="text-xs text-gray-500 mt-1">{q.marks} marks • {q.questionType}</p>
                  </div>
                ))}
                {selectedPaper.totalQuestions > 6 && (
                  <div className="text-sm">
                    <p className="text-gray-600">...</p>
                    <p className="font-medium">+{selectedPaper.totalQuestions - 6} more</p>
                  </div>
                )}
              </div>
            </div>

            {/* Statistics */}
            {selectedPaper.totalAttempts > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h2 className="text-lg font-semibold mb-4">Class Statistics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Attempts</p>
                    <p className="text-2xl font-bold text-amber-600">{selectedPaper.totalAttempts}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Average Score</p>
                    <p className="text-2xl font-bold text-blue-600">{selectedPaper.averageScore}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pass Rate</p>
                    <p className="text-2xl font-bold text-green-600">{selectedPaper.passRate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Highest Score</p>
                    <p className="text-2xl font-bold text-purple-600">{selectedPaper.highestScore}%</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main list view — Class Work (done in class) + Home Work (to solve at home)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Sub-tab navigation */}
        <div className="mb-6">
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#E7E3D9] bg-white/80 backdrop-blur-sm p-1.5 sm:p-2">
            {SUB_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = tab.key === activeSubTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveSubTab(tab.key)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all ${
                    active
                      ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-200/60'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className={`flex w-8 h-8 shrink-0 items-center justify-center rounded-lg ${
                    active ? 'bg-white/20' : 'bg-indigo-50 text-indigo-500'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 hidden sm:block">
                    <span className="block text-sm font-bold leading-tight truncate">{tab.label}</span>
                    <span className={`block text-[11px] truncate ${active ? 'text-white/75' : 'text-gray-400'}`}>{tab.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reading Practice tab */}
        {activeSubTab === 'reading' && (
          <Motion.div
            key="reading"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <ReadingPracticePage />
          </Motion.div>
        )}

        {/* Writing Practice tab */}
        {activeSubTab === 'writing' && (
          <Motion.div
            key="writing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <WritingPracticePage />
          </Motion.div>
        )}

        {/* Practice Papers tab (existing content below) */}
        {activeSubTab === 'papers' && (<>

        {/* Header */}
        <section className="relative mb-6 overflow-hidden rounded-[2rem] border border-white/70 bg-white/65 p-5 shadow-[0_24px_70px_-34px_rgba(79,70,229,0.38)] backdrop-blur-xl sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-indigo-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-violet-200/35 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200"><GraduationCap size={21} /></div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Assigned by your teachers</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Practice & Activities</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">Find practice papers, MCQs, fill-in-the-blanks, topic tryouts, and homework in one place.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[330px]">
              {[
                { label: 'Papers', value: papers.length, tone: 'text-blue-700 bg-blue-50' },
                { label: 'Quick sets', value: practiceActivities.length, tone: 'text-emerald-700 bg-emerald-50' },
                { label: 'Tryouts', value: tryoutActivities.length, tone: 'text-violet-700 bg-violet-50' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/80 bg-white/75 p-3 text-center shadow-sm">
                  <p className={`mx-auto w-fit rounded-lg px-2 py-0.5 text-lg font-bold ${stat.tone}`}>{stat.value}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Filters */}
        <div className="mb-6 rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur-xl sm:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        {/* ── Quick teacher activities ── */}
        {(activityFilter === 'all' || activityFilter === 'mcq' || activityFilter === 'blank') && (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white"><ListChecks size={17} /></div>
              <div>
                <h2 className="text-xl font-bold leading-tight text-gray-900">Quick Activities</h2>
                <p className="text-xs text-gray-500">MCQs and fill-in-the-blanks published for your class</p>
              </div>
              {!activitiesLoading && <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">{filteredPracticeActivities.length}</span>}
            </div>
            {activitiesLoading ? (
              <div className="flex justify-center rounded-2xl border border-white/80 bg-white/60 py-12"><Loader className="size-7 animate-spin text-emerald-600" /></div>
            ) : activitiesError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">{activitiesError}</div>
            ) : filteredPracticeActivities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/65 p-9 text-center"><ListChecks className="mx-auto mb-3 text-slate-300" size={34} /><p className="font-medium text-slate-600">No matching quick activities</p><p className="mt-1 text-sm text-slate-400">Teacher-created MCQs and fill-in-the-blanks will appear here.</p></div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPracticeActivities.map((activity) => (
                  <button key={`${activity.id}-${activity.type}`} type="button" onClick={() => setQuickPractice(activity)} className="group rounded-2xl border border-white/90 bg-white/75 p-5 text-left shadow-[0_12px_36px_-28px_rgba(15,23,42,0.3)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                      <span className={`flex size-10 items-center justify-center rounded-xl ${activity.type === 'mcq' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{activity.type === 'mcq' ? <CheckCircle size={19} /> : <PenLine size={18} />}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-500">{activity.count} questions</span>
                    </div>
                    <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{activity.type === 'mcq' ? 'Multiple choice' : 'Fill in blanks'}</p>
                    <h3 className="mt-1 text-base font-bold text-slate-900">{activity.name}</h3>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">Start activity <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-1" /></span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Lesson-plan tryouts ── */}
        {(activityFilter === 'all' || activityFilter === 'tryout') && !activitiesLoading && filteredTryoutActivities.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-violet-600 text-white"><Puzzle size={17} /></div>
              <div><h2 className="text-xl font-bold leading-tight text-gray-900">Assigned Tryouts</h2><p className="text-xs text-gray-500">Interactive topic activities from your lesson plan</p></div>
              <span className="ml-auto rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">{filteredTryoutActivities.length}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTryoutActivities.map((activity) => (
                <button key={activity.id} type="button" onClick={() => setSelectedTryout(activity)} className="group rounded-2xl border border-white/90 bg-white/75 p-5 text-left shadow-[0_12px_36px_-28px_rgba(15,23,42,0.3)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg">
                  <div className="flex items-start justify-between"><span className="flex size-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Puzzle size={19} /></span><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase text-violet-700">{activity.count} prompts</span></div>
                  <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-violet-500">{activity.subjectName}</p>
                  <h3 className="mt-1 text-base font-bold text-slate-900">{activity.topicName}</h3>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-violet-700">Open tryout <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-1" /></span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Class Work ── */}
        {(activityFilter === 'all' || activityFilter === 'paper') && <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <NotebookPen className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">Class Work</h2>
              <p className="text-xs text-gray-500">Practice what your teacher covered in class</p>
            </div>
            {!loading && (
              <span className="ml-auto text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                {filteredPapers.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredPapers.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-10 text-center">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No class work yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Papers appear here after your teacher publishes the day&apos;s lesson.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPapers.map(paper => (
                <div
                  key={paper._id}
                  onClick={() => openPaper(paper)}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer overflow-hidden border border-transparent hover:border-blue-200"
                >
                  {/* Card Header */}
                  <div className="p-4 sm:p-5 border-b">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-lg font-semibold line-clamp-2 flex-1">{paper.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                        paper.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                        paper.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {paper.difficulty}
                      </span>
                    </div>
                    <ContextBadges item={paper} />
                  </div>

                  {/* Card Content */}
                  <div className="p-4 sm:p-5 space-y-3">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <FileText className="w-4 h-4" />
                        <span>{paper.totalQuestions} Q</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <Award className="w-4 h-4" />
                        <span>{paper.totalMarks} marks</span>
                      </div>
                      {paper.duration > 0 && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>{paper.duration} min</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-gray-600">
                        <span className="text-xs">Pass: {paper.passingPercentage}%</span>
                      </div>
                    </div>

                    {/* Class Stats */}
                    {paper.totalAttempts > 0 && (
                      <div className="pt-2 border-t text-xs text-gray-600">
                        <p>{paper.passRate}% pass rate • Avg: {paper.averageScore}%</p>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="px-4 sm:px-5 py-3 bg-gray-50 border-t flex items-center justify-between">
                    <span className="text-xs text-gray-600">
                      {new Date(paper.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openPaper(paper);
                      }}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      {openingPaperId === String(paper._id) ? 'Opening…' : 'Start'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>}

        {/* ── Home Work ── */}
        {(activityFilter === 'all' || activityFilter === 'homework') && <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Home className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">Home Work</h2>
              <p className="text-xs text-gray-500">Assignments your teacher gave you to solve at home</p>
            </div>
            {!homeworkLoading && (
              <span className="ml-auto text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                {filteredHomework.length}
              </span>
            )}
          </div>

          {homeworkLoading ? (
            <div className="flex justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : filteredHomework.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-10 text-center">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No homework right now</p>
              <p className="text-sm text-gray-500 mt-1">
                Assignments from your teachers will show up here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHomework.map((hw) => {
                const due = hw.dueDate ? new Date(hw.dueDate) : null;
                const submitted = hw.submissionStatus && hw.submissionStatus !== 'not_submitted';
                const overdue = !submitted && due && due < new Date();
                return (
                  <div
                    key={hw._id}
                    onClick={() => {
                      saveLearningActivity({ path: '/student/assignments', label: 'Home Work', detail: hw.title });
                      navigate('/student/assignments');
                    }}
                    className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer overflow-hidden border border-transparent hover:border-emerald-200"
                  >
                    <div className="p-4 sm:p-5 border-b">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-lg font-semibold line-clamp-2 flex-1">{hw.title}</h3>
                        {submitted ? (
                          <span className="text-xs px-2 py-1 rounded-full whitespace-nowrap bg-emerald-100 text-emerald-700 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Done
                          </span>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                            overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {overdue ? 'Overdue' : 'To do'}
                          </span>
                        )}
                      </div>
                      <ContextBadges item={hw} />
                    </div>

                    <div className="p-4 sm:p-5 space-y-2 text-sm text-gray-600">
                      {hw.description && <p className="line-clamp-2">{hw.description}</p>}
                      <div className="flex items-center gap-4 text-xs">
                        {due && (
                          <span className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-semibold' : ''}`}>
                            <Clock className="w-3.5 h-3.5" />
                            Due {due.toLocaleDateString()}
                          </span>
                        )}
                        {Number(hw.marks) > 0 && (
                          <span className="flex items-center gap-1">
                            <Award className="w-3.5 h-3.5" /> {hw.marks} marks
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-4 sm:px-5 py-3 bg-gray-50 border-t flex items-center justify-between">
                      <span className="text-xs text-gray-600">{hw.teacherId?.name || hw.teacherName || ''}</span>
                      <span className="px-3 py-1 text-sm bg-emerald-600 text-white rounded flex items-center gap-1">
                        {submitted ? 'Review' : 'Solve'}
                        <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>}
        </>)}
      </div>
    </div>
  );
};

export default PracticePapersPortal;
