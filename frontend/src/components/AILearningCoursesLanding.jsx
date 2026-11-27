import { groupLessonsByUnit } from '../teachers/components/lesson-plan-builder/chapterGroups';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, ArrowRight, BookOpen, ChevronRight, CheckCircle2,
  FlaskConical, Globe, Sparkles, Users, CalendarDays,
  Layers, Languages, Landmark, Leaf, Calculator, Palette, Music2,
  Search, Flag, Smile, List, Clock, FolderOpen, PlayCircle,
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
// Left accent colour for each lesson card, cycled
const LESSON_ACCENTS = ['border-l-indigo-500', 'border-l-emerald-500', 'border-l-amber-500', 'border-l-rose-500', 'border-l-sky-500', 'border-l-violet-500'];

const CHAPTER_STATUS_META = {
  completed: { chip: 'bg-emerald-600 text-white', label: 'Done', tile: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500' },
  'almost-done': { chip: 'bg-violet-50 text-violet-700', label: 'Almost done', tile: 'bg-violet-50 text-violet-700', bar: 'bg-violet-500' },
  'in-progress': { chip: 'bg-amber-50 text-amber-700', label: 'In progress', tile: 'bg-violet-50 text-violet-700', bar: 'bg-amber-500' },
  ready: { chip: 'bg-slate-100 text-slate-600', label: 'Not started', tile: 'bg-violet-50 text-violet-700', bar: 'bg-violet-500' },
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

const getSubjectCompletion = (subject) => {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(`smart-learning-progress-${subject.key}`) || '{}') || {};
  } catch {
    // Missing or unavailable saved progress starts at zero.
  }
  let total = 0;
  let completed = 0;
  (subject.chapters || []).forEach((chapter) => {
    (chapter.topics || []).forEach((topic) => {
      const subtopics = [...new Set((topic.subtopics || []).map((item) => typeof item === 'string' ? item : item?.title).filter(Boolean))];
      const done = Array.isArray(saved) ? (saved.includes(topic.title) ? subtopics : []) : saved[topic.title];
      total += subtopics.length;
      completed += subtopics.filter((item) => Array.isArray(done) && done.includes(item)).length;
    });
  });
  return total ? Math.round(completed / total * 100) : 0;
};

const SubjectTopicsView = ({ subject, onBack, style = DEFAULT_STYLE }) => {
  const SubjectIcon = style.icon;
  const navigate = useNavigate();
  const { profile } = useStudentDashboard();
  const [completedSubtopics, setCompletedSubtopics] = useState({});
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const topics = useMemo(() => Array.isArray(subject?.topics) ? subject.topics : [], [subject]);
  const chapters = useMemo(() => {
    const sourceChapters = Array.isArray(subject?.chapters) ? subject.chapters : [];
    if (Array.isArray(subject?.chapters)) {
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

  // What a student will find in each lesson — shown as plain-language chips.
  const contentsOf = (chapter) => {
    const titles = new Set((chapter.topics || []).map((t) => normalize(t.title)));
    const subjectTopics = (Array.isArray(subject?.topics) ? subject.topics : []).filter((t) => titles.has(normalize(t.title)));
    const files = (Array.isArray(chapter.currentAttachments) ? chapter.currentAttachments : Array.isArray(chapter.uploads) ? chapter.uploads : []).length;
    const practice = subjectTopics.reduce((n, t) => n + (Array.isArray(t.tryoutSections) ? t.tryoutSections.length : 0), 0);
    const labs = subjectTopics.reduce((n, t) => n + (Array.isArray(t.labExperiments) ? t.labExperiments.length : 0), 0);
    return { files, practice, labs };
  };
  const ContentsChips = ({ chapter }) => {
    const { labs } = contentsOf(chapter);
    if (!labs) return null;
    const chip = 'inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200';
    return (
      <div className="flex flex-wrap gap-1.5" aria-label="What's inside">
        {labs > 0 && <span className={chip}><FlaskConical size={12} className="text-emerald-500" /> {labs} lab experiment{labs === 1 ? '' : 's'}</span>}
      </div>
    );
  };
  // The one lesson to do next: the first unfinished lesson (in progress first).
  const nextEntry = chapterStats.find((c) => c.firstTopic && (c.status === 'in-progress' || c.status === 'almost-done'))
    || chapterStats.find((c) => c.firstTopic && c.status !== 'completed')
    || null;
  const allDone = chapterStats.length > 0 && chapterStats.every((c) => c.status === 'completed');

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
    // After a refresh the subject's topics arrive a moment later. Saving before
    // then would filter every saved lesson out as "unknown" and wipe the
    // student's "Mark as done" progress — so wait until the topics are known.
    if (!topics.length) return;
    const storageKey = `smart-learning-progress-${subject.key}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(normalizedCompletedSubtopics));
    } catch {
      // Storage full/unavailable (private mode, quota exceeded) — progress
      // tracking is best-effort and must not crash the page.
    }
  }, [isProgressLoaded, normalizedCompletedSubtopics, subject.key, topics.length]);

  const setChapterCompletion = (chapter, checked) => {
    setCompletedSubtopics((previous) => {
      const next = { ...previous };
      (chapter.topics || []).forEach((topic) => {
        next[topic.title] = checked ? [...new Set(topic.subtopics || [])] : [];
      });
      return next;
    });
  };


  const openTopic = (topic) => {
    if (!topic?.title) return;
    const topicSlug = slugifyForUrl(String(topic.title).trim());
    navigate(`/student/smart-learning-courses/subject/${slugifyForUrl(subject.key)}/topic/${topicSlug}?view=details`, {
      state: { smartLearningSubject: subject },
    });
  };

  return (
    <div className="space-y-3 sm:space-y-5" style={SUBJECT_CARD_FONT}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition hover:border-violet-300 hover:text-violet-700"
        >
          <ArrowLeft size={14} /> Back
        </button>
        {profile?.academicYear && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            <CalendarDays size={13} className="text-violet-500" /> {profile.academicYear}
          </span>
        )}
      </div>

      <header className="relative overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48" />
        {/* Title on the left, chapters done on the right, full-width progress below. */}
        <div className="relative z-10 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 text-lg font-extrabold leading-tight tracking-tight text-slate-900 sm:text-2xl">{subject.title} Chapters</h1>
            {chapters.length > 0 && (
              <div className="flex shrink-0 items-center gap-2">
                {/* <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-100 bg-violet-50 text-violet-600"><Flag size={15} /></span> */}
                <span className="flex items-baseline gap-1">
                  <span className="text-base font-black leading-none text-slate-900">{completedChapterCount}/{chapters.length}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Chapters</span>
                </span>
              </div>
            )}
          </div>
          {chapters.length > 0 && (
            <div className="flex items-center gap-2.5" aria-label={`${progress}% completed`}>
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="shrink-0 text-xs font-bold text-violet-700">{progress}% completed</span>
            </div>
          )}
        </div>
      </header>

      {/* {nextEntry && (
        <section className="rounded-2xl border border-violet-200 bg-linear-to-r from-violet-600 to-indigo-600 p-4 text-white shadow-md shadow-violet-600/20 sm:p-5" aria-label="What to do next">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/75">{nextEntry.percentage > 0 ? 'Continue where you left off' : 'Start here'}</p>
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold leading-snug">{nextEntry.chapter.title}</h2>
              <p className="mt-0.5 text-xs text-white/80">
                {nextEntry.chapter.meta?.unitNumber ? `Chapter ${nextEntry.chapter.meta.unitNumber} · ` : ''}
                {nextEntry.percentage > 0 ? `${nextEntry.percentage}% done` : 'Not started yet'}
                {nextEntry.durationLabel ? ` · about ${nextEntry.durationLabel.toLowerCase()}` : ''}
              </p>
            </div>
            <button type="button" onClick={() => openTopic(nextEntry.firstTopic)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-violet-700 shadow-sm transition hover:bg-violet-50 active:scale-[0.98]">
              <PlayCircle size={17} /> {nextEntry.percentage > 0 ? 'Continue lesson' : 'Start lesson'}
            </button>
          </div>
          <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/20 pt-3 text-[11.5px] text-white/85">
            <li><b className="text-white">1.</b> Read the lesson</li>
            <li><b className="text-white">2.</b> Open the files</li>
            <li><b className="text-white">3.</b> Try the practice</li>
            <li><b className="text-white">4.</b> Mark it done ✓</li>
          </ol>
        </section>
      )} */}
      {allDone && (
        <section className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" aria-label="All lessons done">
          <CheckCircle2 size={22} className="shrink-0 text-emerald-600" />
          <p className="text-sm"><b>You've finished every lesson in {subject.title}.</b> Open any lesson below to revise.</p>
        </section>
      )}

      <section className="space-y-4">

        {chapters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-violet-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-50"><BookOpen className="text-violet-600" size={28} /></div><p className="text-lg font-bold text-slate-800">No Lesson Plans Published Yet</p><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Your teacher hasn't published any lesson plans for <span className="font-semibold">{subject.title}</span> yet.</p></div>
        ) : visibleChapterStats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm"><p className="text-sm font-bold text-slate-700">No chapters match your search</p><button type="button" onClick={() => { setSearchQuery(''); setFilterMode('all'); }} className="mt-2 text-sm font-bold text-violet-600 hover:underline">Clear filters</button></div>
        ) : (
          <div className="space-y-5">
            {(() => {
              // Lessons grouped under the teacher's textbook chapters.
              const groups = groupLessonsByUnit(visibleChapterStats.map((entry) => ({
                ...entry,
                unitNumber: entry.chapter?.meta?.unitNumber,
                unitTitle: entry.chapter?.meta?.unitTitle,
              })));
              const showHeadings = groups.some((g) => g.key !== '__none__');
              return groups.map((group) => (
              <section key={group.key} className="space-y-2.5">
                {showHeadings && (
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`flex min-w-0 items-center rounded-full border border-slate-200 bg-white shadow-sm ${group.unitTitle ? 'pr-4' : ''}`}>
                      <span className={`flex h-7 shrink-0 items-center rounded-full px-3 text-[11px] font-extrabold uppercase tracking-wide sm:h-8 sm:text-xs ${group.key === '__none__' ? 'bg-slate-100 text-slate-500' : 'bg-violet-600 text-white shadow-sm shadow-violet-600/25'}`}>
                        {group.unitNumber ? `Chapter ${group.unitNumber}` : group.key === '__none__' ? 'Other lessons' : 'Chapter'}
                      </span>
                      {group.unitTitle && <h2 className="ml-2.5 min-w-0 truncate text-sm font-bold text-slate-900 sm:text-base">{group.unitTitle}</h2>}
                    </div>
                    <span className="hidden h-px flex-1 bg-slate-200 sm:block" />
                    <span className="ml-auto shrink-0 text-[11px] font-semibold text-slate-400 sm:ml-0 sm:text-xs">{group.lessons.length} lesson{group.lessons.length === 1 ? '' : 's'}</span>
                  </div>
                )}
            {group.lessons.map((entry, lessonIndex) => {
              const { chapter, originalIndex, firstTopic, topicCount, subtopicCount, total, percentage, durationLabel, status } = entry;
              const unitBadge = showHeadings ? 'LESSON' : 'UNIT';
              const unitNo = showHeadings ? lessonIndex + 1 : originalIndex + 1;
              const meta = CHAPTER_STATUS_META[status];
              return (
                // The whole card opens the lesson; the right side has "Mark as done" + an arrow.
                <article
                  key={chapter.id || `${chapter.title}-${originalIndex}`}
                  role={firstTopic ? 'link' : undefined}
                  tabIndex={firstTopic ? 0 : undefined}
                  aria-label={firstTopic ? `Open ${chapter.title}` : undefined}
                  onClick={() => firstTopic && openTopic(firstTopic)}
                  onKeyDown={(e) => { if (firstTopic && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); openTopic(firstTopic); } }}
                  className={`group overflow-hidden rounded-xl border border-slate-200 border-l-[5px] ${LESSON_ACCENTS[originalIndex % LESSON_ACCENTS.length]} bg-white p-3.5 shadow-sm transition-all duration-200 ${firstTopic ? 'cursor-pointer hover:border-violet-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500' : 'opacity-70'}`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-violet-100 bg-violet-50 text-center text-violet-700">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-violet-600">{unitBadge}</span><span className="text-sm font-black leading-none">{String(unitNo).padStart(2, '0')}</span>
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">{status !== 'ready' && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${meta.chip}`}>{status === 'completed' ? <CheckCircle2 size={11} /> : <Clock size={11} />}{meta.label}</span>}{nextEntry === entry && <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10.5px] font-bold text-white">Next</span>}</div>
                        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-slate-900 transition-colors group-hover:text-violet-700 sm:text-base lg:truncate">{chapter.title}</h3>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-slate-500 sm:gap-x-3">{durationLabel && <span className="inline-flex items-center gap-1"><Clock size={13} className="text-slate-400" />About {durationLabel.toLowerCase()}</span>}{chapter.teacherName && <><span className="text-slate-300">•</span><span className="inline-flex items-center gap-1"><Users size={13} className="text-slate-400" />By {chapter.teacherName}</span></>}</div>
                        <ContentsChips chapter={chapter} />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                      {/* clicking the checkbox must not open the lesson */}
                      <label
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${total === 0 ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-emerald-50'} ${total > 0 && percentage === 100 ? 'text-emerald-700' : 'text-slate-600'}`}
                      >
                        <input
                          type="checkbox"
                          checked={total > 0 && percentage === 100}
                          disabled={total === 0}
                          onChange={(e) => setChapterCompletion(chapter, e.target.checked)}
                          aria-label={`Mark ${chapter.title} as done`}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-emerald-600 disabled:cursor-not-allowed"
                        />
                        <span className="hidden sm:inline">Mark as done</span>
                      </label>
                      {firstTopic && <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600" />}
                    </div>
                  </div>
                </article>
              );
            })}
              </section>
              ));
            })()}
          </div>
        )}
      </section>

    </div>
  );
};

const AILearningCoursesLanding = ({ resumePath = null }) => {
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
          forceRefresh: true,
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
            forceRefresh: true,
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

  const resumeMatch = resumePath?.match(/^\/student\/(?:smart-learning|smart-learning-courses)\/subject\/([^/?#]+)\/topic\/([^/?#]+)/);
  const resumeSubject = resumeMatch && assignedSubjects.find(
    (subject) => normalize(slugifyForUrl(subject.key)) === normalize(resumeMatch[1])
      || String(subject.subjectId) === resumeMatch[1]
  );
  const resumeChapterIndex = resumeSubject?.chapters.findIndex((chapter) =>
    chapter.topics?.some((topic) => normalize(slugifyForUrl(topic.title)) === normalize(resumeMatch[2]))
  ) ?? -1;
  const resumeChapterNumber = resumeChapterIndex >= 0
    ? resumeSubject.chapters[resumeChapterIndex].meta?.unitNumber || resumeChapterIndex + 1
    : null;
  const firstSubjectWithChapters = assignedSubjects.find((subject) =>
    subject.chapters.some((chapter) => chapter.topics?.some((topic) => topic?.title))
  );
  const firstChapterIndex = firstSubjectWithChapters?.chapters.findIndex((chapter) =>
    chapter.topics?.some((topic) => topic?.title)
  );
  const firstChapter = firstSubjectWithChapters?.chapters[firstChapterIndex];
  const firstTopic = firstChapter?.topics.find((topic) => topic?.title);
  const continueSubject = resumeSubject || firstSubjectWithChapters;
  const continueChapterNumber = resumeSubject
    ? resumeChapterNumber
    : firstChapter?.meta?.unitNumber || (firstTopic ? firstChapterIndex + 1 : null);
  const continuePath = resumeSubject
    ? resumePath
    : firstTopic && `/student/smart-learning-courses/subject/${slugifyForUrl(continueSubject.key)}/topic/${slugifyForUrl(firstTopic.title)}?view=details`;

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
    <div className={`m-3 rounded-2xl border border-slate-200/80 bg-[#f8f9fd] px-4 py-4 text-slate-900 shadow-sm sm:rounded-3xl sm:px-5 flex min-h-0 flex-1 flex-col overflow-hidden`}>
      <div className={selectedSubject ? 'min-h-0 w-full flex-1 overflow-y-auto overscroll-contain pr-1 custom-scrollbar' : 'flex min-h-0 w-full flex-1 flex-col'}>
        {selectedSubject ? (
          <SubjectTopicsView
            subject={selectedSubject}
            onBack={() => navigate('/student/smart-learning-courses')}
            style={CARD_STYLES[Math.max(0, assignedSubjects.findIndex((s) => s.key === selectedSubject.key)) % CARD_STYLES.length]}
          />
        ) : (
          <>
            <div className="mb-4 grid shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
              <h1 className="whitespace-nowrap text-xl font-bold tracking-tight sm:text-2xl">My Subjects</h1>
              {continuePath && (
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
                  <p className="min-w-0 text-right text-xs text-slate-600">
                    Where you left off{' '}
                    <strong className="text-slate-900">
                      {continueSubject.title}{continueChapterNumber != null && ` — Chapter ${continueChapterNumber}`}
                    </strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(continuePath, { state: { smartLearningSubject: continueSubject } })}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
                  >
                    <PlayCircle size={16} aria-hidden="true" /> Continue
                  </button>
                </div>
              )}
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

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 pb-2 custom-scrollbar" role="region" aria-label="My subjects" tabIndex={0}>
            {loading ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                    <div className="h-24 animate-pulse bg-slate-200" />
                    <div className="space-y-3 p-3">
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
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3" style={SUBJECT_CARD_FONT}>
                {assignedSubjects.map((subject, index) => {
                  const style = CARD_STYLES[index % CARD_STYLES.length];
                  const Icon = style.icon;
                  return (
                    <div
                      key={subject.key}
                      className={`group flex min-w-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md ${style.glow}`}
                    >
                      <div className={`relative flex h-24 flex-col justify-end overflow-hidden bg-linear-to-br p-3 ${style.grad}`}>
                        {/* Decorative texture */}
                        <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/10" />
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(white_1.5px,transparent_1.5px)] bg-size-[16px_16px] opacity-[0.07]" />
                        <Icon className="absolute -bottom-5 -right-5 size-24 rotate-12 text-white/20 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110" />

                        {/* Floating icon badge */}
                        <div className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg bg-white/20 ring-1 ring-white/30">
                          <Icon className="size-5 text-white" />
                        </div>

                        <h3 className="relative pr-10 text-lg font-bold tracking-tight text-white">{subject.title}</h3>
                      </div>
                      <div className="flex flex-1 flex-col gap-3 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                            <Layers size={12} /> {subject.chapters.length} Chapter{subject.chapters.length === 1 ? '' : 's'}
                          </span>
                          <span className="text-xs font-semibold text-slate-600">{getSubjectCompletion(subject)}% completed</span>
                        </div>
                        <button
                          onClick={() => {
                            if (subject.hasLessonPlans) {
                              navigate(`/student/smart-learning-courses/subject/${slugifyForUrl(subject.key)}`, {
                                state: { smartLearningSubject: subject },
                              });
                            }
                          }}
                          className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold tracking-tight transition-all duration-200 ease-out ${
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
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AILearningCoursesLanding;
