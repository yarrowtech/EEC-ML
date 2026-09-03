import React, { useEffect, useState, useMemo } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, ChevronRight, RefreshCw, BookOpen } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

// ── Demo data shown when no real mastery scores exist yet ───────────────────
const DEMO_SCORES = [
  { subject: 'Mathematics',  topicId: 'quadratic-equations',   topicTitle: 'Quadratic Equations',     chapterTitle: 'Algebra',              score: 92, attemptCount: 4 },
  { subject: 'Mathematics',  topicId: 'trigonometry-basics',   topicTitle: 'Trigonometry Basics',     chapterTitle: 'Trigonometry',         score: 78, attemptCount: 3 },
  { subject: 'Mathematics',  topicId: 'coordinate-geometry',   topicTitle: 'Coordinate Geometry',     chapterTitle: 'Geometry',             score: 55, attemptCount: 2 },
  { subject: 'Mathematics',  topicId: 'probability',           topicTitle: 'Probability',             chapterTitle: 'Statistics',           score: 35, attemptCount: 1 },
  { subject: 'Science',      topicId: 'laws-of-motion',        topicTitle: 'Laws of Motion',          chapterTitle: 'Physics — Mechanics',  score: 88, attemptCount: 5 },
  { subject: 'Science',      topicId: 'chemical-bonding',      topicTitle: 'Chemical Bonding',        chapterTitle: 'Chemistry',            score: 63, attemptCount: 2 },
  { subject: 'Science',      topicId: 'cell-division',         topicTitle: 'Cell Division',           chapterTitle: 'Biology',              score: 47, attemptCount: 2 },
  { subject: 'Science',      topicId: 'electricity',           topicTitle: 'Electricity & Circuits',  chapterTitle: 'Physics — Electricity',score: 71, attemptCount: 3 },
  { subject: 'English',      topicId: 'grammar-tenses',        topicTitle: 'Verb Tenses',             chapterTitle: 'Grammar',              score: 95, attemptCount: 6 },
  { subject: 'English',      topicId: 'essay-writing',         topicTitle: 'Essay Writing',           chapterTitle: 'Writing Skills',       score: 68, attemptCount: 3 },
  { subject: 'English',      topicId: 'reading-comprehension', topicTitle: 'Reading Comprehension',   chapterTitle: 'Reading Skills',       score: 82, attemptCount: 4 },
  { subject: 'Social Studies', topicId: 'french-revolution',   topicTitle: 'The French Revolution',   chapterTitle: 'World History',        score: 58, attemptCount: 2 },
  { subject: 'Social Studies', topicId: 'indian-geography',    topicTitle: 'Indian Geography',        chapterTitle: 'Geography',            score: 76, attemptCount: 3 },
];

// ── Mastery level config ────────────────────────────────────────────────────
const LEVELS = [
  { min: 90,  label: 'Mastered',   emoji: '🏆', color: 'emerald', bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { min: 75,  label: 'Advanced',   emoji: '🎯', color: 'violet',  bar: 'bg-violet-500',  badge: 'bg-violet-100 text-violet-700 border-violet-200'   },
  { min: 60,  label: 'Proficient', emoji: '⚡', color: 'blue',    bar: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700 border-blue-200'          },
  { min: 40,  label: 'Developing', emoji: '📈', color: 'amber',   bar: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700 border-amber-200'       },
  { min: 0,   label: 'Beginner',   emoji: '🌱', color: 'rose',    bar: 'bg-rose-400',    badge: 'bg-rose-100 text-rose-700 border-rose-200'          },
];

const getLevel = (score) => LEVELS.find((l) => score >= l.min) || LEVELS[LEVELS.length - 1];

// ── Topic Row ───────────────────────────────────────────────────────────────
const TopicRow = ({ item }) => {
  const level = getLevel(item.score);
  const topicName = item.topicTitle || item.topicId;
  return (
    <Motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
      aria-label={`${topicName}: ${item.score} percent, ${level.label}, ${item.attemptCount} attempt${item.attemptCount !== 1 ? 's' : ''}`}
    >
      {/* Emoji + title */}
      <span className="text-xl shrink-0" aria-hidden="true">{level.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{topicName}</p>
        {item.chapterTitle && (
          <p className="text-xs text-slate-400 truncate">{item.chapterTitle}</p>
        )}
        {/* Progress bar */}
        <div
          className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"
          role="progressbar"
          aria-valuenow={item.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${topicName} mastery`}
        >
          <Motion.div
            initial={{ width: 0 }}
            animate={{ width: `${item.score}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className={`h-full rounded-full ${level.bar}`}
          />
        </div>
      </div>

      {/* Score */}
      <div className="text-right shrink-0">
        <p className="text-base font-extrabold text-slate-800">{item.score}%</p>
        <p className="text-[10px] text-slate-400">{item.attemptCount} attempt{item.attemptCount !== 1 ? 's' : ''}</p>
      </div>

      {/* Level badge (text label hidden on small screens but announced via row aria-label) */}
      <span className={`hidden sm:inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${level.badge}`}>
        {level.label}
      </span>
    </Motion.div>
  );
};

// ── Subject Accordion ────────────────────────────────────────────────────────
const SubjectAccordion = ({ subject, topics }) => {
  const [open, setOpen] = useState(true);
  const avg = Math.round(topics.reduce((s, t) => s + t.score, 0) / topics.length);
  const level = getLevel(avg);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-100/70 transition-colors"
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg`}
          style={{ background: `var(--subject-bg, #f1f5f9)` }}>
          <BookOpen className="size-4 text-slate-500" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">{subject}</p>
          <p className="text-xs text-slate-500">{topics.length} topic{topics.length !== 1 ? 's' : ''} · Avg {avg}%</p>
        </div>

        {/* Mini progress bar */}
        <div
          className="hidden sm:block w-24 h-1.5 rounded-full bg-slate-200 overflow-hidden mx-3"
          role="progressbar"
          aria-valuenow={avg}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${subject} average mastery`}
        >
          <div className={`h-full rounded-full ${level.bar}`} style={{ width: `${avg}%` }} />
        </div>

        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold mr-2 ${level.badge}`}>
          {avg}% {level.label}
        </span>
        {open
          ? <ChevronDown className="size-4 text-slate-400 shrink-0" aria-hidden="true" />
          : <ChevronRight className="size-4 text-slate-400 shrink-0" aria-hidden="true" />}
      </button>

      {/* Topics */}
      <AnimatePresence>
        {open && (
          <Motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {topics.map((t) => <TopicRow key={`${t.subject}-${t.topicId}`} item={t} />)}
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Summary Stats Bar ────────────────────────────────────────────────────────
const StatCard = ({ label, value, color }) => (
  <div className={`flex-1 rounded-2xl border p-4 text-center ${color}`}>
    <p className="text-2xl font-extrabold">{value}</p>
    <p className="text-xs font-semibold opacity-70 mt-0.5">{label}</p>
  </div>
);

// ── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center px-6">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100">
      <Brain className="size-8 text-violet-400" />
    </div>
    <p className="text-lg font-bold text-slate-700">No mastery data yet</p>
    <p className="mt-1 text-sm text-slate-500 max-w-xs">
      Complete a quiz in the AI Tutor to start tracking your mastery level per topic.
    </p>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
const MasteryView = () => {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const fetchScores = async () => {
    setLoading(true);
    setError('');
    setLoadFailed(false);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/mastery/student`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load mastery data');
      const real = data.data || [];
      if (real.length === 0) {
        setScores(DEMO_SCORES);
        setIsDemo(true);
      } else {
        setScores(real);
        setIsDemo(false);
      }
    } catch (err) {
      // Show demo so the page isn't blank, but tell the student it's not their data.
      setScores(DEMO_SCORES);
      setIsDemo(true);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchScores(); }, []);

  // Group by subject
  const grouped = useMemo(() => {
    const map = {};
    for (const item of scores) {
      const sub = item.subject || 'General';
      if (!map[sub]) map[sub] = [];
      map[sub].push(item);
    }
    return map;
  }, [scores]);

  // Summary stats
  const mastered   = scores.filter((s) => s.score >= 90).length;
  const advanced   = scores.filter((s) => s.score >= 75 && s.score < 90).length;
  const inProgress = scores.filter((s) => s.score < 75).length;
  const overallAvg = scores.length
    ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Mastery Progress</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your topic-by-topic mastery levels from AI Tutor quizzes</p>
        </div>
        <button
          type="button"
          onClick={fetchScores}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Load-failure banner — distinct from the "no quizzes yet" sample state */}
      {loadFailed && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3" role="alert">
          <span className="text-lg shrink-0" aria-hidden="true">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-800">Couldn&apos;t load your mastery data</p>
            <p className="text-xs text-rose-700 mt-0.5">Showing sample data below. </p>
          </div>
          <button
            type="button"
            onClick={fetchScores}
            className="shrink-0 rounded-lg bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 hover:bg-rose-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Demo banner */}
      {isDemo && !loadFailed && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-lg shrink-0">🎯</span>
          <div>
            <p className="text-sm font-bold text-amber-800">Sample data — complete a quiz to see your real progress</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Go to AI Tutor, pick a subject and topic, tap <span className="font-semibold">Create Quiz</span>, finish it — your score will appear here automatically.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      {scores.length > 0 && (
        <div className="mb-6 flex gap-3 flex-wrap sm:flex-nowrap">
          <StatCard label="Overall Avg" value={`${overallAvg}%`} color="border-violet-200 bg-violet-50 text-violet-800" />
          <StatCard label="Mastered 🏆" value={mastered} color="border-emerald-200 bg-emerald-50 text-emerald-800" />
          <StatCard label="Advanced 🎯" value={advanced} color="border-indigo-200 bg-indigo-50 text-indigo-800" />
          <StatCard label="In Progress" value={inProgress} color="border-amber-200 bg-amber-50 text-amber-800" />
        </div>
      )}

      {/* Level legend */}
      <div className="mb-5 flex flex-wrap gap-2">
        {LEVELS.slice().reverse().map((l) => (
          <span key={l.label} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${l.badge}`}>
            {l.emoji} {l.label}
          </span>
        ))}
      </div>

      {/* Content */}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 font-medium">
          {error}
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([subject, topics]) => (
            <SubjectAccordion key={subject} subject={subject} topics={topics} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MasteryView;
