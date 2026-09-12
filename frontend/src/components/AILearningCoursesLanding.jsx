import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronRight, CheckCircle2,
  FlaskConical, Globe, Sparkles, Users, CalendarDays,
  Layers, Languages, Landmark, Leaf, Calculator, Palette, Music2,
  Search, Flag, Smile, List, Clock, FolderOpen, MessageCircle,
} from 'lucide-react';
import AILearningCoursesReference from './AILearningCoursesReference';
import AILearningPracticePaperPage from './AILearningPracticePaperPage';
import AILearningTryoutSection from './AILearningTryoutSection';
import { slugifyForUrl, deslugifyFromUrl } from '../utils/urlSlug';
import { fetchCachedJson } from '../utils/studentApiCache';
import { useStudentDashboard } from './StudentDashboardContext';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const SMART_LEARNING_MAP_ENDPOINT = `${API_BASE}/api/lesson-plans/student/smart-learning-map`;

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
  const { profile } = useStudentDashboard();
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
    let readyAssigned = false;
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

      let status = 'upcoming';
      if (percentage === 100 && totals.total > 0) status = 'completed';
      else if (percentage >= 50) status = 'almost-done';
      else if (percentage > 0) status = 'in-progress';
      else if (!readyAssigned) { status = 'ready'; readyAssigned = true; }

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
    }).map((entry, index, all) => {
      // A second pass upgrades the first not-yet-started chapter right
      // after "ready" to "up-next" so the rest read as "upcoming".
      if (entry.status !== 'upcoming') return entry;
      const readyIndex = all.findIndex((e) => e.status === 'ready');
      if (readyIndex !== -1 && index === readyIndex + 1) return { ...entry, status: 'up-next' };
      return entry;
    });
  }, [chapters, topicProgress]);

  const inProgressChapterCount = chapterStats.filter((c) => c.status === 'in-progress' || c.status === 'almost-done').length;

  const visibleChapterStats = useMemo(() => {
    const query = normalize(searchQuery);
    return chapterStats.filter((entry) => {
      if (filterMode === 'in-progress' && entry.status !== 'in-progress' && entry.status !== 'almost-done') return false;
      if (query && !normalize(entry.chapter.title).includes(query)) return false;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onBack}
            className={`inline-flex items-center gap-2 rounded-xl ${GLASS_INNER} px-3 py-2 text-sm font-bold text-slate-700 ${GLASS_HOVER} hover:text-violet-700`}
          >
            <ArrowLeft size={16} /> Back to Subjects
          </button>
          <div className="flex items-center gap-1.5 text-sm text-[#8e9aaf]">
            <span>Learn</span>
            <ChevronRight size={14} />
            <span>{subject.title}</span>
            <ChevronRight size={14} />
            <span className="font-bold text-violet-600">{chapters.length > 0 ? 'Published Chapters' : 'Chapters'}</span>
          </div>
        </div>
        {profile?.academicYear && (
          <div className={`inline-flex items-center gap-1.5 self-start rounded-full ${GLASS_INNER} px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#8e9aaf] sm:self-auto`}>
            <CalendarDays size={14} className="text-violet-500" /> {profile.academicYear}
          </div>
        )}
      </div>

      <section className={`relative overflow-hidden ${GLASS_CARD} p-5 sm:p-8`}>
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -top-8 -right-8 h-56 w-56 rounded-full bg-amber-100/50 blur-2xl" />
        <SubjectIcon className="pointer-events-none absolute -bottom-8 -right-6 size-40 rotate-12 text-violet-900/[0.04] sm:size-56" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
              <SubjectIcon size={13} />
              {chapters.length > 0 ? 'Published Chapters' : 'Coming Soon'}
            </span>
            <h1 className="mt-3 text-2xl font-bold text-[#0f172a] sm:text-4xl">{subject.title} {chapters.length > 0 ? 'Chapters' : ''}</h1>
            <p className="mt-2 max-w-xl text-sm text-[#64748b] sm:text-base">
              {chapters.length > 0
                ? 'All chapters published by your teacher are listed here with their topics and subtopics.'
                : 'Your teacher will publish lesson content here soon. Stay tuned!'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className={`flex items-center gap-2 ${GLASS_INNER} px-3 py-2 text-sm font-semibold text-slate-700`}>
                <BookOpen size={16} className="text-violet-600" /> {chapters.length} Active Unit{chapters.length === 1 ? '' : 's'}
              </div>
              {subject.teacherCount > 0 && (
                <div className={`flex items-center gap-2 ${GLASS_INNER} px-3 py-2 text-sm font-semibold text-slate-700`}>
                  <Users size={16} className="text-violet-600" /> {subject.teacherCount} Teacher{subject.teacherCount > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {chapters.length > 0 && (
            <div className="w-full lg:w-[300px]">
              <div className={`flex flex-col gap-4 ${GLASS_CARD} p-5`}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#8e9aaf]">Your Progress</span>
                    <div className="mt-1 text-2xl font-bold text-[#0f172a]">
                      {completedChapterCount}/{chapters.length} <span className="text-sm font-normal text-[#8e9aaf]">Chapters</span>
                    </div>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-600">
                    <Flag size={20} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#8e9aaf]">Course Completion</span>
                    <span className="font-bold text-violet-600">{progress}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/70">
                    <div className="h-full rounded-full bg-violet-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className={`flex items-center gap-3 ${GLASS_INNER} px-3 py-2.5`}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                    <Smile size={16} />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    {moodLead} <span className="font-normal text-[#64748b]">{moodTrail}</span>
                  </p>
                </div>
                {nextIncompleteTopic && progress > 0 && progress < 100 && (
                  <button
                    onClick={() => {
                      const topicSlug = slugifyForUrl(String(nextIncompleteTopic.title || '').trim());
                      navigate(`/student/smart-learning-courses/subject/${slugifyForUrl(subject.key)}/topic/${topicSlug}`);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-600"
                  >
                    Continue: {nextIncompleteTopic.title}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#0f172a] sm:text-3xl">
              {chapters.length > 0 ? 'Uploaded Chapters' : 'Lesson Content'}
            </h2>
            <p className="text-sm text-[#64748b]">Select a module to view materials, notes, and quiz sheets</p>
          </div>
          {chapters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex items-center gap-2 ${GLASS_INNER} px-3 py-2`}>
                <Search size={16} className="text-[#8e9aaf]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search chapters..."
                  className="w-36 bg-transparent text-sm text-slate-700 outline-none placeholder:text-[#8e9aaf] sm:w-48"
                />
              </div>
              <div className={`flex items-center gap-1 ${GLASS_INNER} p-1`}>
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${filterMode === 'all' ? 'bg-violet-500 text-white' : 'text-slate-500 hover:bg-white/60'}`}
                >
                  All ({chapters.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('in-progress')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${filterMode === 'in-progress' ? 'bg-violet-500 text-white' : 'text-slate-500 hover:bg-white/60'}`}
                >
                  In Progress ({inProgressChapterCount})
                </button>
              </div>
            </div>
          )}
        </div>

        {chapters.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-violet-500/30 bg-white/40 p-10 text-center backdrop-blur-[20px]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
              <BookOpen className="text-amber-600" size={32} />
            </div>
            <p className="mb-2 text-xl font-bold text-slate-800">No Lesson Plans Published Yet</p>
            <p className="mx-auto max-w-md text-sm text-[#64748b]">
              Your teacher hasn't published any lesson plans for <span className="font-semibold">{subject.title}</span> yet.
              Check back soon or ask your teacher about upcoming topics!
            </p>
          </div>
        ) : visibleChapterStats.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-violet-500/30 bg-white/40 p-10 text-center backdrop-blur-[20px]">
            <p className="text-base font-bold text-slate-700">No chapters match your search</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setFilterMode('all'); }}
              className="mt-2 text-sm font-bold text-violet-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleChapterStats.map((entry) => {
              const { chapter, originalIndex, firstTopic, topicCount, subtopicCount, total, percentage, durationLabel, status } = entry;
              const isOpen = openChapterIndex === originalIndex;
              const meta = CHAPTER_STATUS_META[status];
              const isLocked = status === 'up-next' || status === 'upcoming';

              return (
                <div
                  key={chapter.id || `${chapter.title}-${originalIndex}`}
                  className={`overflow-hidden ${GLASS_CARD} ${GLASS_HOVER}`}
                >
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl ${meta.tile}`}>
                        {status === 'completed' ? (
                          <CheckCircle2 size={24} strokeWidth={2.2} />
                        ) : (
                          <>
                            <span className="text-[10px] font-bold uppercase tracking-wide">Unit</span>
                            <span className="text-xl font-bold leading-none">{String(originalIndex + 1).padStart(2, '0')}</span>
                          </>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${meta.chip}`}>{meta.label}</span>
                          {classLabel && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-xs font-semibold text-[#64748b]">Class {classLabel}</span>
                            </>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-[#0f172a] sm:text-xl">{chapter.title}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#64748b]">
                          <span className="inline-flex items-center gap-1"><Layers size={14} className="text-violet-500" /> {topicCount} topic{topicCount === 1 ? '' : 's'}</span>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1"><List size={14} className="text-violet-500" /> {subtopicCount} subtopic{subtopicCount === 1 ? '' : 's'}</span>
                          {durationLabel && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="inline-flex items-center gap-1"><Clock size={14} /> {durationLabel}</span>
                            </>
                          )}
                        </div>
                        {total > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/70">
                              <div className={`h-full rounded-full transition-all duration-500 ${meta.bar}`} style={{ width: `${percentage}%` }} />
                            </div>
                            <span className="text-xs font-bold text-[#8e9aaf]">{percentage}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (!firstTopic) return;
                          const topicSlug = slugifyForUrl(String(firstTopic.title || '').trim());
                          navigate(`/student/smart-learning-courses/subject/${slugifyForUrl(subject.key)}/topic/${topicSlug}`, {
                            state: { smartLearningSubject: subject },
                          });
                        }}
                        disabled={!firstTopic}
                        className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${
                          !firstTopic
                            ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                            : status === 'completed'
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : status === 'in-progress' || status === 'almost-done'
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : status === 'ready'
                            ? 'bg-violet-500 text-white hover:bg-violet-600'
                            : 'bg-white/60 text-slate-700 hover:bg-white/80'
                        }`}
                      >
                        <span>
                          {!firstTopic ? 'No Topics' : status === 'completed' ? 'Review' : status === 'in-progress' || status === 'almost-done' ? 'Continue' : status === 'ready' ? 'Start Learning' : 'Explore Chapter'}
                        </span>
                        {firstTopic && (isLocked ? <FolderOpen size={16} /> : <ArrowRight size={16} />)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenChapterIndex(isOpen ? -1 : originalIndex)}
                        className={`rounded-xl p-2.5 text-[#8e9aaf] transition-transform hover:bg-white/60 hover:text-slate-600 ${isOpen ? 'rotate-180' : ''}`}
                        aria-label={`${isOpen ? 'Hide' : 'Show'} topics for ${chapter.title}`}
                        aria-expanded={isOpen}
                      >
                        <ChevronDown size={18} />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-violet-500/20 bg-white/30 px-5 pb-5 pt-4 backdrop-blur-[20px] sm:px-6">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-[#8e9aaf]">
                        <span>Module Outline &amp; Learning Materials</span>
                        {teacherName && <span className="normal-case font-semibold text-[#64748b]">Teacher: {teacherName}</span>}
                      </div>
                      {(chapter.topics || []).length > 0 ? (
                        <div className="space-y-3 border-l-2 border-dashed border-violet-500/25 pl-4 sm:pl-5">
                          {chapter.topics.map((topic) => {
                            const topicProg = topicProgress[topic.title] || { total: 0, completed: 0, percentage: 0 };
                            return (
                              <div key={topic.title} className={`relative ${GLASS_INNER} p-4`}>
                                <span className="absolute -left-5.25 top-6 h-2.5 w-2.5 rounded-full bg-violet-500 ring-4 ring-white sm:-left-6.25" />
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="truncate text-base font-bold text-[#0f172a]">{topic.title}</p>
                                    <p className="text-xs font-medium text-[#64748b]">{topicProg.completed}/{topicProg.total} subtopics complete</p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const topicSlug = slugifyForUrl(String(topic.title || '').trim());
                                      navigate(`/student/smart-learning-courses/subject/${slugifyForUrl(subject.key)}/topic/${topicSlug}`);
                                    }}
                                    className="shrink-0 rounded-full bg-violet-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-600 sm:text-sm"
                                  >
                                    Open Topic
                                  </button>
                                </div>
                                {topic.subtopics && topic.subtopics.length > 0 ? (
                                  <div className="mt-4 space-y-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8e9aaf]">Click to mark as complete</p>
                                    {topic.subtopics.map((subtopic, idx) => {
                                      const isSubtopicCompleted = (completedSubtopics[topic.title] || []).includes(subtopic);
                                      return (
                                        <button
                                          key={`${subtopic}-${idx}`}
                                          onClick={() => toggleSubtopicCompletion(topic.title, subtopic)}
                                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all hover:shadow-sm ${
                                            isSubtopicCompleted
                                              ? 'border-emerald-300/60 bg-emerald-50/70'
                                              : 'border-violet-500/25 bg-white/40 hover:border-violet-500/45'
                                          }`}
                                        >
                                          <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                                            isSubtopicCompleted ? 'bg-emerald-500' : 'bg-white border-2 border-violet-500/30'
                                          }`}>
                                            {isSubtopicCompleted && (
                                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                              </svg>
                                            )}
                                          </div>
                                          <span className={`text-sm font-medium ${isSubtopicCompleted ? 'text-emerald-700 line-through' : 'text-slate-700'}`}>
                                            {subtopic}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="mt-3 text-sm text-[#64748b] italic">No subtopics available</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-[#64748b] italic">No subtopics available</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={`flex items-start gap-4 ${GLASS_CARD} p-5`}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <MessageCircle size={22} />
          </div>
          <div>
            <h4 className="text-base font-bold text-[#0f172a]">Need help with a topic?</h4>
            <p className="mt-1 text-sm text-[#64748b]">
              {teacherName
                ? `Ask your teacher ${teacherName} directly, or post in the Class Wall.`
                : 'Post your question in the Class Wall and your teacher will see it.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/student/assignments-academic-alcove')}
              className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-violet-600 hover:underline"
            >
              Ask on Class Wall <ArrowRight size={14} />
            </button>
          </div>
        </div>
        <div className={`flex items-start gap-4 ${GLASS_CARD} p-5`}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
            <FolderOpen size={22} />
          </div>
          <div>
            <h4 className="text-base font-bold text-[#0f172a]">Explore other subjects</h4>
            <p className="mt-1 text-sm text-[#64748b]">Head back to your subjects list to pick up another chapter.</p>
            <button
              type="button"
              onClick={onBack}
              className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-violet-600 hover:underline"
            >
              Back to Subjects <ArrowRight size={14} />
            </button>
          </div>
        </div>
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
    <div className="w-full min-h-screen bg-[#f1f5f9] text-slate-900 p-4 sm:p-6 md:p-8">
      <div className="mx-auto w-full max-w-[1200px]">
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
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-amber-100 to-orange-100">
                  <Sparkles className="text-amber-500" size={28} />
                </div>
                <p className="text-lg font-bold text-slate-800">No real smart-learning data found</p>
                <p className="mt-1 text-sm text-slate-500">Ask your class teacher to publish lesson-plan topics/materials for your class.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
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

                        <h3 className="relative text-xl font-black leading-tight text-white drop-shadow-sm sm:text-2xl">{subject.title}</h3>
                      </div>
                      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${style.chipA}`}>
                            <Users size={12} /> {subject.teacherCount} Teacher{subject.teacherCount > 1 ? 's' : ''}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${style.chipB}`}>
                            <CalendarDays size={12} /> {subject.classCount} Class Slot{subject.classCount > 1 ? 's' : ''}
                          </span>
                          {subject.hasLessonPlans && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                              <Layers size={12} />
                              {(subject.chapters?.length || subject.topics.length)} {(subject.chapters?.length || 0) > 0 ? 'Chapter' : 'Topic'}{(subject.chapters?.length || subject.topics.length) > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="flex-1 text-sm text-slate-600 line-clamp-2">
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
                          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-bold transition-all duration-200 ease-out ${
                            subject.hasLessonPlans
                              ? 'bg-amber-500 text-white shadow-md shadow-amber-300/40 hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-300/50 active:scale-[0.98] cursor-pointer'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                          disabled={curriculumLoading || !subject.hasLessonPlans}
                        >
                          {curriculumLoading ? 'Loading lessons…' : subject.hasLessonPlans ? (
                            <>
                              Start Learning
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
