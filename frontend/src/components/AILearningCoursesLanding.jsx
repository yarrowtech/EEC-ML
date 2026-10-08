import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronRight, CheckCircle2,
  FlaskConical, Globe, Sparkles, Users, CalendarDays,
  Layers, Languages, Landmark, Leaf, Calculator, Palette, Music2,
  Search, Flag, Smile, List, Clock, FolderOpen,
} from 'lucide-react';
import AILearningCoursesReference from './AILearningCoursesReference';
import AILearningPracticePaperPage from './AILearningPracticePaperPage';
import AILearningTryoutSection from './AILearningTryoutSection';
import { slugifyForUrl, deslugifyFromUrl } from '../utils/urlSlug';
import { fetchCachedJson } from '../utils/studentApiCache';
import { useStudentDashboard } from './StudentDashboardContext';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const SMART_LEARNING_MAP_ENDPOINT = `${API_BASE}/api/lesson-plans/student/smart-learning-map`;

// Refined typography for the subject cards — Inter, a lighter title weight
// (bold instead of black) and tighter tracking than the rest of this legacy
// page, matching the Learning hub's newer glassmorphism type scale.
const SUBJECT_CARD_FONT = { fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" };

const CARD_STYLES = [
  {
    grad: 'from-blue-400 to-indigo-600',
    glow: 'hover:shadow-blue-300/50',
    chipA: 'bg-blue-100 text-blue-700',
    chipB: 'bg-green-100 text-green-700',
    icon: Calculator,
    solid: 'bg-blue-500', solidHover: 'hover:bg-blue-600', accentText: 'text-blue-600', accentBg: 'bg-blue-50', ring: 'ring-blue-200', border: 'border-blue-200',
  },
  {
    grad: 'from-emerald-400 to-teal-600',
    glow: 'hover:shadow-emerald-300/50',
    chipA: 'bg-teal-100 text-teal-700',
    chipB: 'bg-purple-100 text-purple-700',
    icon: FlaskConical,
    solid: 'bg-emerald-500', solidHover: 'hover:bg-emerald-600', accentText: 'text-emerald-600', accentBg: 'bg-emerald-50', ring: 'ring-emerald-200', border: 'border-emerald-200',
  },
  {
    grad: 'from-orange-400 to-pink-600',
    glow: 'hover:shadow-orange-300/50',
    chipA: 'bg-orange-100 text-orange-700',
    chipB: 'bg-yellow-100 text-yellow-700',
    icon: Languages,
    solid: 'bg-orange-500', solidHover: 'hover:bg-orange-600', accentText: 'text-orange-600', accentBg: 'bg-orange-50', ring: 'ring-orange-200', border: 'border-orange-200',
  },
  {
    grad: 'from-cyan-500 to-blue-700',
    glow: 'hover:shadow-cyan-300/50',
    chipA: 'bg-cyan-100 text-cyan-700',
    chipB: 'bg-indigo-100 text-indigo-700',
    icon: Globe,
    solid: 'bg-cyan-500', solidHover: 'hover:bg-cyan-600', accentText: 'text-cyan-600', accentBg: 'bg-cyan-50', ring: 'ring-cyan-200', border: 'border-cyan-200',
  },
  {
    grad: 'from-amber-400 to-orange-600',
    glow: 'hover:shadow-amber-300/50',
    chipA: 'bg-amber-100 text-amber-700',
    chipB: 'bg-rose-100 text-rose-700',
    icon: Landmark,
    solid: 'bg-amber-500', solidHover: 'hover:bg-amber-600', accentText: 'text-amber-600', accentBg: 'bg-amber-50', ring: 'ring-amber-200', border: 'border-amber-200',
  },
  {
    grad: 'from-lime-400 to-emerald-600',
    glow: 'hover:shadow-lime-300/50',
    chipA: 'bg-lime-100 text-lime-700',
    chipB: 'bg-teal-100 text-teal-700',
    icon: Leaf,
    solid: 'bg-lime-600', solidHover: 'hover:bg-lime-700', accentText: 'text-lime-700', accentBg: 'bg-lime-50', ring: 'ring-lime-200', border: 'border-lime-200',
  },
  {
    grad: 'from-fuchsia-400 to-purple-600',
    glow: 'hover:shadow-fuchsia-300/50',
    chipA: 'bg-fuchsia-100 text-fuchsia-700',
    chipB: 'bg-indigo-100 text-indigo-700',
    icon: Palette,
    solid: 'bg-fuchsia-500', solidHover: 'hover:bg-fuchsia-600', accentText: 'text-fuchsia-600', accentBg: 'bg-fuchsia-50', ring: 'ring-fuchsia-200', border: 'border-fuchsia-200',
  },
  {
    grad: 'from-rose-400 to-red-600',
    glow: 'hover:shadow-rose-300/50',
    chipA: 'bg-rose-100 text-rose-700',
    chipB: 'bg-orange-100 text-orange-700',
    icon: Music2,
    solid: 'bg-rose-500', solidHover: 'hover:bg-rose-600', accentText: 'text-rose-600', accentBg: 'bg-rose-50', ring: 'ring-rose-200', border: 'border-rose-200',
  },
];

const DEFAULT_STYLE = CARD_STYLES[4]; // amber — fallback while a subject's grid position is still resolving

// Chapter status tiers for the "chapters overview" page — a chapter's
// position in the list plus its own progress decide which tier it lands in
// (see chapterStats in SubjectTopicsView). Purely presentational.
const CHAPTER_STATUS_META = {
  completed: { chip: 'bg-emerald-50 text-emerald-700', label: 'Completed', tile: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500' },
  'almost-done': { chip: 'bg-violet-50 text-violet-700', label: 'Almost Done', tile: 'bg-violet-50 text-violet-700', bar: 'bg-violet-500' },
  'in-progress': { chip: 'bg-amber-50 text-amber-700', label: 'In Progress', tile: 'bg-violet-50 text-violet-700', bar: 'bg-amber-500' },
  ready: { chip: 'bg-violet-50 text-violet-700', label: 'Ready to Start', tile: 'bg-violet-50 text-violet-700', bar: 'bg-violet-500' },
  'up-next': { chip: 'bg-slate-100 text-slate-500', label: 'Up Next', tile: 'bg-slate-100 text-slate-400', bar: 'bg-slate-300' },
  upcoming: { chip: 'bg-slate-100 text-slate-500', label: 'Upcoming', tile: 'bg-slate-100 text-slate-400', bar: 'bg-slate-300' },
};

// Shared "glass" card recipe used across the Smart Learning pages: frosted
// backdrop blur, soft purple border, gentle shadow. GLASS_INNER is the same
// idea at a smaller radius for nested rows/tiles.
const GLASS_CARD = 'rounded-3xl border border-violet-500/35 bg-white/60 backdrop-blur-[20px] backdrop-saturate-[1.8] shadow-[0_8px_32px_rgba(15,23,42,0.06)]';
const GLASS_INNER = 'rounded-xl border border-violet-500/35 bg-white/50 backdrop-blur-[20px]';
const GLASS_HOVER = 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(139,92,246,0.14)]';

const normalize = (value) => String(value || '').trim().toLowerCase();

const SubjectTopicsView = ({ subject, onBack, style = DEFAULT_STYLE }) => {
  const SubjectIcon = style.icon;
  const navigate = useNavigate();
  const { profile, smartLearningReminders = [] } = useStudentDashboard();
  const firstName = String(profile?.name || '').trim().split(/\s+/)[0] || '';
  const [openChapterIndex, setOpenChapterIndex] = useState(-1);
  const [completedSubtopics, setCompletedSubtopics] = useState({});
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const topics = useMemo(() => Array.isArray(subject?.topics) ? subject.topics : [], [subject]);
  const chapters = useMemo(() => {
    const sourceChapters = Array.isArray(subject?.chapters) ? subject.chapters : [];
    if (sourceChapters.length > 0) {
      return sourceChapters.map((chapter) => ({
        ...chapter,
        topics: (Array.isArray(chapter?.topics) ? chapter.topics : []).map((topic) => ({
          ...topic,
          subtopics: (Array.isArray(topic?.subtopics) ? topic.subtopics : [])
            .map((subtopic) => typeof subtopic === 'string' ? subtopic : subtopic?.title)
            .filter(Boolean),
        })),
      }));
    }

    return topics.map((topic, index) => ({
      id: `topic-${index}`,
      title: topic.title || `Chapter ${index + 1}`,
      topics: [topic],
    }));
  }, [subject, topics]);

  const normalizedCompletedSubtopics = useMemo(() => {
    if (!completedSubtopics || typeof completedSubtopics !== 'object' || Array.isArray(completedSubtopics)) {
      return {};
    }

    const topicSubtopicMap = new Map(
      topics.map((topic) => [topic.title, new Set(topic.subtopics || [])])
    );

    const normalized = {};
    Object.entries(completedSubtopics).forEach(([topicTitle, storedSubtopics]) => {
      const validSubtopics = topicSubtopicMap.get(topicTitle);
      if (!validSubtopics || !Array.isArray(storedSubtopics)) return;

      const dedupedValidSubtopics = [...new Set(
        storedSubtopics.filter((subtopic) => validSubtopics.has(subtopic))
      )];

      if (dedupedValidSubtopics.length > 0) {
        normalized[topicTitle] = dedupedValidSubtopics;
      }
    });

    return normalized;
  }, [completedSubtopics, topics]);

  // Calculate topic completion percentages
  const topicProgress = useMemo(() => {
    const progress = {};
    topics.forEach(topic => {
      const subtopicCount = topic.subtopics?.length || 0;
      const completedCount = (normalizedCompletedSubtopics[topic.title] || []).length;
      progress[topic.title] = {
        total: subtopicCount,
        completed: completedCount,
        percentage: subtopicCount > 0 ? Math.round((completedCount / subtopicCount) * 100) : 0
      };
    });
    return progress;
  }, [topics, normalizedCompletedSubtopics]);

  // Calculate overall progress
  const totalSubtopics = topics.reduce((sum, topic) => sum + (topic.subtopics?.length || 0), 0);
  const totalCompletedSubtopics = Object.values(normalizedCompletedSubtopics).reduce((sum, arr) => sum + arr.length, 0);
  const progress = totalSubtopics > 0 ? Math.round((totalCompletedSubtopics / totalSubtopics) * 100) : 0;
  const completedChapterCount = chapters.filter((chapter) => {
    const chapterTopics = chapter.topics || [];
    return chapterTopics.length > 0 && chapterTopics.every((topic) => topicProgress[topic.title]?.percentage === 100);
  }).length;

  // Find the next incomplete topic to continue from
  const nextIncompleteTopic = useMemo(() => {
    return topics.find(topic => topicProgress[topic.title]?.percentage < 100);
  }, [topics, topicProgress]);

  // "Your class" is a placeholder the allocated-subjects fetch falls back to
  // when the timetable didn't supply a real class/section label — not
  // worth surfacing as if it were one.
  const classLabel = useMemo(() => {
    const raw = Array.from(subject?.classNames || [])[0] || '';
    return normalize(raw) === 'your class' ? '' : raw;
  }, [subject]);

  // Per-chapter display stats: progress totals, a status tier (ready / up
  // next / upcoming / in progress / almost done / completed), and the CTA
  // target topic. Computed once so both the list and the search/filter
  // controls read from the same numbers.
  const chapterStats = useMemo(() => {
    return chapters.map((chapter, index) => {
      const chapterTopics = chapter.topics || [];
      const totals = chapterTopics.reduce((acc, topic) => {
        const item = topicProgress[topic.title] || { total: 0, completed: 0 };
        return { total: acc.total + item.total, completed: acc.completed + item.completed };
      }, { total: 0, completed: 0 });
      const percentage = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;
      const totalSubtopicCount = chapterTopics.reduce((sum, topic) => sum + (topic.subtopics?.length || 0), 0);
      const durationLabel = chapter.meta?.duration
        || (Array.isArray(chapter.meta?.instructionalFlow) && chapter.meta.instructionalFlow.length > 0
          ? `${chapter.meta.instructionalFlow.reduce((sum, step) => sum + (Number(step?.duration) || 0), 0)} Min`
          : '');
      const dateLabel = chapter.meta?.date
        ? new Date(chapter.meta.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';

      let status = 'ready';
      if (percentage === 100 && totals.total > 0) status = 'completed';
      else if (percentage >= 50) status = 'almost-done';
      else if (percentage > 0) status = 'in-progress';

      return {
        chapter,
        originalIndex: index,
        firstTopic: chapterTopics[0] || null,
        topicCount: chapterTopics.length,
        subtopicCount: totalSubtopicCount,
        completed: totals.completed,
        total: totals.total,
        percentage,
        durationLabel,
        dateLabel,
        status,
      };
    });
  }, [chapters, topicProgress]);

  const inProgressChapterCount = chapterStats.filter((c) => c.status === 'in-progress' || c.status === 'almost-done').length;

  const visibleChapterStats = useMemo(() => {
    const query = normalize(searchQuery);
    return chapterStats.filter((entry) => {
      if (filterMode === 'in-progress' && entry.status !== 'in-progress' && entry.status !== 'almost-done') return false;
      if (filterMode === 'completed' && entry.status !== 'completed') return false;
      if (query) {
        const chapterMatches = normalize(entry.chapter.title).includes(query);
        const topicMatches = (entry.chapter.topics || []).some((topic) => normalize(topic.title).includes(query));
        if (!chapterMatches && !topicMatches) return false;
      }
      return true;
    });
  }, [chapterStats, searchQuery, filterMode]);

  // Load completed subtopics from localStorage on mount
  useEffect(() => {
    const storageKey = `smart-learning-progress-${subject.key}`;
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Migration for older format where only completed topic titles were stored.
          const migrated = {};
          parsed.forEach((topicTitle) => {
            const topic = topics.find((t) => t.title === topicTitle);
            if (!topic) return;
            migrated[topic.title] = [...new Set(topic.subtopics || [])];
          });
          setCompletedSubtopics(migrated);
        } else if (parsed && typeof parsed === 'object') {
          setCompletedSubtopics(parsed);
        } else {
          setCompletedSubtopics({});
        }
      } catch (e) {
        console.error('Failed to parse saved progress:', e);
        setCompletedSubtopics({});
      }
    } else {
      setCompletedSubtopics({});
    }
    setIsProgressLoaded(true);
  }, [subject.key, topics]);

  // Save completed subtopics to localStorage whenever it changes
  useEffect(() => {
    if (!isProgressLoaded) return;
    const storageKey = `smart-learning-progress-${subject.key}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(normalizedCompletedSubtopics));
    } catch {
      // Storage full/unavailable (private mode, quota exceeded) — progress
      // tracking is best-effort and must not crash the page.
    }
  }, [isProgressLoaded, normalizedCompletedSubtopics, subject.key]);

  const toggleSubtopicCompletion = (topicTitle, subtopic) => {
    setCompletedSubtopics(prev => {
      const topicSubtopics = prev[topicTitle] || [];
      const isCompleted = topicSubtopics.includes(subtopic);

      if (isCompleted) {
        // Remove from completed
        return {
          ...prev,
          [topicTitle]: topicSubtopics.filter(s => s !== subtopic)
        };
      } else {
        // Add to completed
        return {
          ...prev,
          [topicTitle]: [...topicSubtopics, subtopic]
        };
      }
    });
  };

  const teacherName = Array.from(subject?.teacherNames || [])[0] || '';
  const moodLead = firstName ? `Keep going, ${firstName}!` : 'Keep going!';
  const moodTrail = progress === 0 ? 'Ready to dive in?' : progress === 100 ? 'Subject complete!' : `You're ${progress}% through.`;

  const openTopic = (topic) => {
    if (!topic?.title) return;
    const topicSlug = slugifyForUrl(String(topic.title).trim());
    navigate(`/student/smart-learning-courses/subject/${slugifyForUrl(subject.key)}/topic/${topicSlug}?view=details`, {
      state: { smartLearningSubject: subject },
    });
  };

  return (
    <div className="space-y-5" style={SUBJECT_CARD_FONT}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition hover:border-violet-300 hover:text-violet-700"
        >
          <ArrowLeft size={14} /> Back to Subjects
        </button>
        {profile?.academicYear && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            <CalendarDays size={13} className="text-violet-500" /> {profile.academicYear}
          </span>
        )}
      </div>

      <header className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-r from-white via-white to-violet-50/60 px-5 py-4 shadow-sm sm:px-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-200/25 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-extrabold leading-none tracking-tight text-slate-900 sm:text-2xl">{subject.title} Chapters</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
                <CheckCircle2 size={12} /> PUBLISHED
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
                <BookOpen size={12} /> {chapters.length} Unit{chapters.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-xs text-slate-500 sm:text-sm">Choose a chapter to open its topics, materials, and lesson content.</p>
          </div>

          {chapters.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2 shadow-sm">
              <div className="flex items-center gap-2.5 border-r border-slate-200/80 pr-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-100 bg-violet-50 text-violet-600"><Flag size={15} /></div>
                <div>
                  <div className="flex items-baseline gap-1"><span className="text-base font-black leading-none text-slate-900">{completedChapterCount}/{chapters.length}</span><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Chapters</span></div>
                  <div className="mt-1 flex items-center gap-1.5"><div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} /></div><span className="text-[10px] font-semibold text-violet-700">{progress}%</span></div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] text-amber-600">😊</span><strong className="font-semibold">{moodLead}</strong></div>
            </div>
          )}
        </div>
      </header>

      {smartLearningReminders.length > 0 && (
        <section aria-label="Reminders" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-2.5 text-amber-900 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 ring-4 ring-amber-100" />
            <div className="truncate text-xs font-medium sm:text-sm"><span className="font-bold text-amber-950">You have unfinished Smart Learning work.</span><span className="ml-1 hidden text-amber-800 md:inline">Reminders stay here until the paper or worksheet is completed.</span></div>
            {nextIncompleteTopic && <button type="button" onClick={() => openTopic(nextIncompleteTopic)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm transition-colors hover:bg-amber-600">Continue <ArrowRight size={12} /></button>}
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-amber-200/70 px-2 py-0.5 text-xs font-bold text-amber-900">{smartLearningReminders.length} pending</span>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-col items-stretch justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center">
          <div><h2 className="text-lg font-bold tracking-tight text-slate-900">{chapters.length > 0 ? 'Uploaded Chapters' : 'Lesson Content'}</h2><p className="text-xs text-slate-500">Select a module to view materials, notes, and quiz sheets</p></div>
          {chapters.length > 0 && <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center"><div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} /><input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search chapters & topics..." className="w-full rounded-lg border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-violet-500 focus:ring-violet-500" /></div><div className="flex items-center gap-1 rounded-lg bg-slate-100/90 p-1 text-xs font-semibold"><button type="button" onClick={() => setFilterMode('all')} className={`rounded-md px-3 py-1.5 transition ${filterMode === 'all' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}>All ({chapters.length})</button><button type="button" onClick={() => setFilterMode('in-progress')} className={`rounded-md px-3 py-1.5 transition ${filterMode === 'in-progress' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}>In Progress ({inProgressChapterCount})</button><button type="button" onClick={() => setFilterMode('completed')} className={`rounded-md px-3 py-1.5 transition ${filterMode === 'completed' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}>Completed ({completedChapterCount})</button></div></div>}
        </div>

        {chapters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-violet-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-50"><BookOpen className="text-violet-600" size={28} /></div><p className="text-lg font-bold text-slate-800">No Lesson Plans Published Yet</p><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Your teacher hasn't published any lesson plans for <span className="font-semibold">{subject.title}</span> yet.</p></div>
        ) : visibleChapterStats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm"><p className="text-sm font-bold text-slate-700">No chapters match your search</p><button type="button" onClick={() => { setSearchQuery(''); setFilterMode('all'); }} className="mt-2 text-sm font-bold text-violet-600 hover:underline">Clear filters</button></div>
        ) : (
          <div className="space-y-2.5">
            {visibleChapterStats.map((entry) => {
              const { chapter, originalIndex, firstTopic, topicCount, subtopicCount, total, percentage, durationLabel, status } = entry;
              const isOpen = openChapterIndex === originalIndex;
              const meta = CHAPTER_STATUS_META[status];
              const lessonLabel = !firstTopic ? 'No Topics' : status === 'completed' ? 'Review' : status === 'in-progress' || status === 'almost-done' ? 'Continue Lesson' : 'Start Lesson';
              return (
                <article key={chapter.id || `${chapter.title}-${originalIndex}`} className="group overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all duration-200 hover:border-violet-400 hover:shadow-md">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-violet-100 bg-violet-50 text-center text-violet-700`}>
                        {status === 'completed' ? <CheckCircle2 size={22} /> : <><span className="text-[9px] font-extrabold uppercase tracking-wider text-violet-600">UNIT</span><span className="text-sm font-black leading-none">{String(originalIndex + 1).padStart(2, '0')}</span></>}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.chip}`}>{meta.label}</span>{classLabel && <><span className="text-slate-300">•</span><span className="text-xs font-semibold text-slate-500">Class {classLabel}</span></>}</div>
                        <h3 className="truncate text-base font-bold text-slate-900 transition-colors group-hover:text-violet-700">{chapter.title}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1"><Layers size={13} className="text-slate-400" />{topicCount} topic{topicCount === 1 ? '' : 's'}</span><span className="text-slate-300">•</span><span className="inline-flex items-center gap-1"><List size={13} className="text-slate-400" />{subtopicCount} subtopic{subtopicCount === 1 ? '' : 's'}</span>{durationLabel && <><span className="text-slate-300">•</span><span className="inline-flex items-center gap-1"><Clock size={13} className="text-slate-400" />{durationLabel}</span></>}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-2.5 md:justify-end md:border-t-0 md:pt-0">
                      <div className="flex w-28 items-center gap-2 md:w-32"><div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-1.5 rounded-full ${meta.bar}`} style={{ width: `${percentage}%` }} /></div><span className="text-xs font-semibold text-slate-400">{percentage}%</span></div>
                      <div className="flex items-center gap-2"><button type="button" onClick={() => openTopic(firstTopic)} disabled={!firstTopic} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold shadow-sm transition active:scale-[0.98] ${!firstTopic ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-violet-600 text-white shadow-violet-600/25 hover:bg-violet-700'}`}>{lessonLabel}{firstTopic && <ArrowRight size={14} />}</button><button type="button" onClick={() => setOpenChapterIndex(isOpen ? -1 : originalIndex)} className={`rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${isOpen ? 'rotate-180' : ''}`} aria-label={`${isOpen ? 'Hide' : 'Show'} topics for ${chapter.title}`} aria-expanded={isOpen}><ChevronDown size={16} /></button></div>
                    </div>
                  </div>

                  {isOpen && <div className="mt-3 border-t border-slate-100 pt-3"><div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400"><span>Module outline &amp; learning materials</span>{teacherName && <span className="normal-case font-semibold tracking-normal text-slate-500">Teacher: {teacherName}</span>}</div>{(chapter.topics || []).length > 0 ? <div className="space-y-2">{chapter.topics.map((topic) => { const topicProg = topicProgress[topic.title] || { total: 0, completed: 0 }; return <div key={topic.title} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-slate-900">{topic.title}</p>{topicProg.total > 0 && topicProg.completed >= topicProg.total && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Completed</span>}</div><p className="text-xs text-slate-500">{topicProg.completed}/{topicProg.total} subtopics complete</p></div><button type="button" onClick={() => openTopic(topic)} className="shrink-0 self-start rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-violet-700 sm:self-auto">{topicProg.completed > 0 ? 'Continue Lesson' : 'Start Lesson'}</button></div>{topic.subtopics?.length > 0 && <div className="mt-3 space-y-1.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Click to mark as complete</p>{topic.subtopics.map((subtopic, idx) => { const isSubtopicCompleted = (completedSubtopics[topic.title] || []).includes(subtopic); return <button type="button" key={`${subtopic}-${idx}`} onClick={() => toggleSubtopicCompletion(topic.title, subtopic)} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition hover:shadow-sm ${isSubtopicCompleted ? 'border-emerald-300/60 bg-emerald-50' : 'border-slate-200 bg-white hover:border-violet-300'}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${isSubtopicCompleted ? 'bg-emerald-500' : 'border-2 border-violet-300 bg-white'}`}>{isSubtopicCompleted && <CheckCircle2 size={13} className="text-white" />}</span><span className={`text-sm font-medium ${isSubtopicCompleted ? 'text-emerald-700 line-through' : 'text-slate-700'}`}>{subtopic}</span></button>; })}</div>}</div>; })}</div> : <p className="text-sm italic text-slate-500">No topics available.</p>}</div>}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Users size={17} /></div>
        <div><h4 className="text-sm font-bold text-slate-900">Course information</h4><p className="mt-1 text-xs text-slate-500">{teacherName ? `Lessons published by ${teacherName}.` : 'Your teacher will add course information here.'} {subject.title} · {chapters.length} chapter{chapters.length === 1 ? '' : 's'}.</p></div>
      </section>
    </div>
  );
};

const AILearningCoursesLanding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contexts, setContexts] = useState([]);
  const [smartLearningMap, setSmartLearningMap] = useState([]);
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Parse URL params manually
  const urlMatch = location.pathname.match(/\/student\/(?:smart-learning|smart-learning-courses)\/subject\/([^/]+)(?:\/topic\/([^/]+))?(?:\/assessment\/([^/]+))?/);
  const subjectKey = urlMatch?.[1] ? deslugifyFromUrl(urlMatch[1]) : null;
  const topicSlug = urlMatch?.[2] ? deslugifyFromUrl(urlMatch[2]) : null;
  const assessmentSlug = urlMatch?.[3] ? deslugifyFromUrl(urlMatch[3]) : null;

  useEffect(() => {
    // Topic screens own their data requests. Avoid loading the entire landing
    // page first when a student follows a deep link.
    if (topicSlug) {
      return undefined;
    }

    let cancelled = false;

    const fetchAssignedSubjects = async () => {
      try {
        setLoading(true);
        setCurriculumLoading(false);
        setError('');

        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        if (!token || userType !== 'Student') {
          setContexts([]);
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
        const CACHE_TTL = 5 * 60 * 1000;

        // Render the student's assigned subjects as soon as the lightweight
        // allocation request completes. Curriculum details can arrive second.
        const allocationResult = await fetchCachedJson(`${API_BASE}/api/student/allocated-subjects`, {
          ttlMs: CACHE_TTL,
          fetchOptions: { headers },
        });
        if (cancelled) return;

        const allocatedSubjects = Array.isArray(allocationResult?.data?.subjects)
          ? allocationResult.data.subjects
          : [];
        const allocationContexts = allocatedSubjects.flatMap((subject) => {
          const teachers = Array.isArray(subject?.teachers) && subject.teachers.length > 0
            ? subject.teachers
            : [null];
          return teachers.map((teacher) => ({
            subjectId: subject?._id || null,
            subjectName: subject?.name || subject?.code || '',
            teacherName: teacher?.name || '',
            className: 'Your class',
            sectionName: '',
          }));
        });

        setContexts(allocationContexts);
        setCurriculumLoading(true);
        setLoading(false);

        try {
          const separator = SMART_LEARNING_MAP_ENDPOINT.includes('?') ? '&' : '?';
          const mapResult = await fetchCachedJson(`${SMART_LEARNING_MAP_ENDPOINT}${separator}summary=true`, {
            ttlMs: CACHE_TTL,
            forceRefresh: reloadKey > 0,
            fetchOptions: { headers },
          });
          if (!cancelled) {
            setSmartLearningMap(Array.isArray(mapResult?.data?.subjects) ? mapResult.data.subjects : []);
          }
        } catch {
          if (!cancelled) {
            setSmartLearningMap([]);
            setError('Your subjects loaded, but lesson content is temporarily unavailable. Please try again.');
          }
        } finally {
          if (!cancelled) setCurriculumLoading(false);
        }
      } catch {
        if (!cancelled) {
          setContexts([]);
          setSmartLearningMap([]);
          setError('Unable to load your assigned subjects. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAssignedSubjects();
    return () => {
      cancelled = true;
    };
  }, [topicSlug, reloadKey]);

  const assignedSubjects = useMemo(() => {
    const map = new Map();

    // First, add all allocated subjects from timetable
    contexts.forEach((ctx) => {
      const name = String(ctx?.subjectName || '').trim();
      if (!name) return;
      const key = normalize(name);
      if (!map.has(key)) {
        map.set(key, {
          key,
          title: name,
          subjectId: ctx?.subjectId || null,
          teacherNames: new Set(),
          classNames: new Set(),
        });
      }
      const item = map.get(key);
      if (!item.subjectId && ctx?.subjectId) item.subjectId = ctx.subjectId;
      const teacher = String(ctx?.teacherName || '').trim();
      const classLabel = [ctx?.className, ctx?.sectionName].filter(Boolean).join('-');
      if (teacher) item.teacherNames.add(teacher);
      if (classLabel) item.classNames.add(classLabel);
    });

    // Also include subjects that exist only in the Smart Learning map. This keeps
    // standalone uploaded materials visible even when timetable/context data is
    // missing or uses a slightly different subject label.
    smartLearningMap.forEach((mappedSubject) => {
      const key = normalize(mappedSubject?.key || mappedSubject?.title);
      if (!key) return;

      const matchingEntry = mappedSubject?.subjectId
        ? Array.from(map.entries()).find(([, item]) => item.subjectId && String(item.subjectId) === String(mappedSubject.subjectId))
        : null;
      const mapKey = matchingEntry?.[0] || key;

      if (!map.has(mapKey)) {
        map.set(mapKey, {
          key,
          title: String(mappedSubject?.title || mappedSubject?.key || 'Subject').trim(),
          subjectId: mappedSubject?.subjectId || null,
          teacherNames: new Set(),
          classNames: new Set(),
        });
      }
    });

    // Then merge with smart learning map data (lesson plans)
    return Array.from(map.values()).map((item) => {
      const fromMap = smartLearningMap.find((m) => (
        (item.subjectId && m?.subjectId && String(m.subjectId) === String(item.subjectId)) ||
        normalize(m.key || m.title) === item.key
      ));
      const mappedTopics = Array.isArray(fromMap?.topics) ? fromMap.topics : [];
      const mappedChapters = Array.isArray(fromMap?.chapters) ? fromMap.chapters : [];
      return {
        ...item,
        topics: mappedTopics,
        chapters: mappedChapters,
        teacherCount: item.teacherNames.size,
        classCount: item.classNames.size,
        hasLessonPlans: mappedChapters.length > 0 || mappedTopics.length > 0,
      };
    });
    // Removed filter - now showing all allocated subjects regardless of lesson plans
  }, [contexts, smartLearningMap]);

  const selectedSubject = useMemo(() => {
    if (!subjectKey) return null;
    const normalizedKey = normalize(subjectKey);
    const exactMatch = assignedSubjects.find((s) => s.key === normalizedKey);
    if (exactMatch) return exactMatch;

    const fuzzyMatch = assignedSubjects.find((s) => {
      const subjectTitle = normalize(s?.title);
      if (!subjectTitle) return false;
      return (
        subjectTitle === normalizedKey ||
        subjectTitle.includes(normalizedKey) ||
        normalizedKey.includes(subjectTitle)
      );
    });

    return fuzzyMatch || assignedSubjects.find((s) => String(s?.subjectId || '').trim() === String(subjectKey).trim()) || null;
  }, [subjectKey, assignedSubjects]);

  // Redirect an unknown subject overview after both data sources have settled.
  useEffect(() => {
    if (loading || curriculumLoading) return;

    if (subjectKey && !topicSlug && !selectedSubject) {
      navigate('/student/smart-learning-courses', { replace: true });
      return;
    }
  }, [topicSlug, subjectKey, selectedSubject, loading, curriculumLoading, navigate]);

  // If on a topic page, show the learning content (only if subject exists)
  if (topicSlug && subjectKey && assessmentSlug === 'practice-paper') {
    return <AILearningPracticePaperPage />;
  }
  if (topicSlug && subjectKey && assessmentSlug === 'tryout-section') {
    return <AILearningTryoutSection />;
  }

  if (topicSlug && subjectKey) {
    return <AILearningCoursesReference />;
  }

  return (
    <div className="min-h-screen w-full bg-[#f8f9fd] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        {selectedSubject ? (
          <SubjectTopicsView
            subject={selectedSubject}
            onBack={() => navigate('/student/smart-learning-courses')}
            style={CARD_STYLES[Math.max(0, assignedSubjects.findIndex((s) => s.key === selectedSubject.key)) % CARD_STYLES.length]}
          />
        ) : (
          <>
            <div className="mb-8 flex flex-col gap-2">
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight">Your Subjects</h1>
              <p className="text-sm sm:text-base text-slate-600">Showing only subjects assigned to your class timetable.</p>
            </div>

            {error && (
              <div className="mb-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="shrink-0 self-start rounded-lg border border-red-300 bg-white px-3 py-1.5 font-bold text-red-700 transition-colors hover:bg-red-100 sm:self-auto"
                >
                  Try again
                </button>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                    <div className="h-32 animate-pulse bg-slate-200 sm:h-40 lg:h-44" />
                    <div className="space-y-3 p-4 sm:p-6">
                      <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-100" />
                      <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
                      <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : assignedSubjects.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center" style={SUBJECT_CARD_FONT}>
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-amber-100 to-orange-100">
                  <Sparkles className="text-amber-500" size={28} />
                </div>
                <p className="text-lg font-bold tracking-tight text-slate-800">No real smart-learning data found</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">Ask your class teacher to publish lesson-plan topics/materials for your class.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3" style={SUBJECT_CARD_FONT}>
                {assignedSubjects.map((subject, index) => {
                  const style = CARD_STYLES[index % CARD_STYLES.length];
                  const Icon = style.icon;
                  return (
                    <div
                      key={subject.key}
                      className={`group flex flex-col overflow-hidden rounded-3xl bg-white shadow-lg shadow-slate-200/60 ring-1 ring-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${style.glow}`}
                    >
                      <div className={`relative flex h-32 flex-col justify-end overflow-hidden bg-linear-to-br p-4 sm:h-40 sm:p-6 lg:h-44 ${style.grad}`}>
                        {/* Decorative texture */}
                        <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/10" />
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(white_1.5px,transparent_1.5px)] bg-size-[16px_16px] opacity-[0.07]" />
                        <Icon className="absolute -bottom-5 -right-5 size-24 rotate-12 text-white/20 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110" />

                        {/* Floating icon badge */}
                        <div className="absolute left-4 top-4 flex size-10 items-center justify-center rounded-2xl bg-white/20 shadow-sm backdrop-blur-md ring-1 ring-white/30 sm:left-6 sm:top-6">
                          <Icon className="size-5 text-white" />
                        </div>

                        <h3 className="relative text-xl font-bold tracking-tight text-white drop-shadow-sm sm:text-2xl">{subject.title}</h3>
                      </div>
                      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${style.chipA}`}>
                            <Users size={12} /> {subject.teacherCount} Teacher{subject.teacherCount > 1 ? 's' : ''}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${style.chipB}`}>
                            <CalendarDays size={12} /> {subject.classCount} Class Slot{subject.classCount > 1 ? 's' : ''}
                          </span>
                          {subject.hasLessonPlans && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                              <Layers size={12} />
                              {(subject.chapters?.length || subject.topics.length)} {(subject.chapters?.length || 0) > 0 ? 'Chapter' : 'Topic'}{(subject.chapters?.length || subject.topics.length) > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="flex-1 text-sm leading-relaxed text-slate-600 line-clamp-2">
                          {subject.hasLessonPlans
                            ? 'Assigned in your timetable. Start this subject quest now.'
                            : 'Assigned in your timetable. Lesson plans coming soon from your teacher.'}
                        </p>
                        <button
                          onClick={() => {
                            if (subject.hasLessonPlans) {
                              navigate(`/student/smart-learning-courses/subject/${slugifyForUrl(subject.key)}`, {
                                state: { smartLearningSubject: subject },
                              });
                            }
                          }}
                          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-semibold tracking-tight transition-all duration-200 ease-out ${
                            subject.hasLessonPlans
                              ? 'bg-amber-500 text-white shadow-md shadow-amber-300/40 hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-300/50 active:scale-[0.98] cursor-pointer'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                          disabled={curriculumLoading || !subject.hasLessonPlans}
                        >
                          {curriculumLoading ? 'Loading lessons…' : subject.hasLessonPlans ? (
                            <>
                              Start Lesson
                              <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                            </>
                          ) : 'Coming Soon'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AILearningCoursesLanding;
