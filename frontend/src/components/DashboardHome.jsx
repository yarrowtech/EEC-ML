import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, ClipboardList, CalendarDays, Compass, CalendarCheck, FileText,
  Bell, MessageSquare, ChevronLeft, ChevronRight, Pause, Play, Clock,
} from 'lucide-react';
import CourseProgress from './CourseProgress';
import AchievementCard from './AchievementCard';
import CalendarWidget from './CalendarWidget';
import QuickStats from './QuickStats';
import RecommendationWidget from './RecommendationWidget';
import EmptyState from './EmptyState';
import { Skeleton } from './ui/skeleton';
import { fetchCachedJson, peekCachedJson } from '../utils/studentApiCache';
import { STUDENT_API_BASE, STUDENT_DASHBOARD_TTL_MS } from '../utils/studentDashboardPrefetch';
import { useStudentDashboard } from './StudentDashboardContext';

const API_BASE = STUDENT_API_BASE;

/** Small inline "this widget failed to load" card with a retry affordance, so a
 *  backend error on a dashboard analytics endpoint is visible instead of the
 *  card silently disappearing. */
const CardError = ({ onRetry, label }) => (
  <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
    <p className="text-sm font-bold text-[#0f172a]">{label}</p>
    <p className="mt-1 text-xs text-[#8e9aaf]">Couldn&apos;t load this right now.</p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-2 rounded-lg bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 hover:bg-amber-200"
    >
      Retry
    </button>
  </div>
);

/** Fetch-with-state hook for the dashboard cards: tracks loading + error and
 *  exposes a reload() the CardError button calls. */
const useCardData = (url, pick) => {
  // Seed from the last cached payload (even if stale) so cards paint instantly;
  // the effect below then revalidates in the background.
  const [state, setState] = useState(() => {
    const cached = peekCachedJson(url);
    return cached
      ? { data: pick(cached), loading: false, error: false }
      : { data: null, loading: true, error: false };
  });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => (s.data != null ? { ...s, error: false } : { ...s, loading: true, error: false }));
    fetchCachedJson(url, { ttlMs: STUDENT_DASHBOARD_TTL_MS, forceRefresh: nonce > 0 })
      .then((r) => { if (alive) setState({ data: pick(r), loading: false, error: false }); })
      .catch((err) => {
        if (!alive) return;
        // An auth failure is already being handled globally — don't also show a retry card.
        if (err?.code === 'expired') return;
        // Keep showing last-known data on a transient failure.
        setState((s) => (s.data != null ? { ...s, loading: false } : { data: null, loading: false, error: true }));
      });
    return () => { alive = false; };
  }, [url, nonce]); // `pick` is a stable inline mapper per card — intentionally not a dep
  return { ...state, reload: () => setNonce((n) => n + 1) };
};

// ── Hero card ────────────────────────────────────────────────────────────
const QUOTES = [
  { text: 'Learning never exhausts the mind. Every new thing makes you stronger!' },
  { text: 'Small steps every day add up to big results over time.' },
  { text: 'Curiosity is the engine of achievement. Keep asking why.' },
  { text: 'Mistakes are proof that you are trying. Keep going!' },
  { text: 'The expert in anything was once a beginner.' },
  { text: 'Knowledge is a treasure that follows its owner everywhere.' },
  { text: 'Focus on progress, not perfection.' },
  { text: "Don't watch the clock; do what it does — keep going!" },
  { text: "Believe in yourself. You're capable of amazing things!" },
  { text: 'Champions are made from desire, dream, and vision!' },
];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const formatDate = () => new Date().toLocaleDateString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
});

/** Campus "hero" illustration — a flat SVG stand-in for a real campus photo so
 *  the hero card never depends on an uploaded asset being present. */
const CampusIllustration = () => (
  <svg viewBox="0 0 400 300" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="400" height="300" fill="#eef2ff" />
    <circle cx="300" cy="70" r="90" fill="#e0e7ff" />
    <rect x="60" y="150" width="280" height="110" rx="4" fill="#ffffff" stroke="#c7d2fe" strokeWidth="2" />
    <rect x="60" y="120" width="280" height="34" fill="#a5b4fc" />
    <polygon points="50,150 200,100 350,150" fill="#818cf8" />
    {Array.from({ length: 6 }).map((_, col) => (
      <rect key={col} x={90 + col * 40} y={175} width="18" height="24" rx="2" fill="#c7d2fe" />
    ))}
    {Array.from({ length: 6 }).map((_, col) => (
      <rect key={`b-${col}`} x={90 + col * 40} y={210} width="18" height="24" rx="2" fill="#c7d2fe" />
    ))}
    <rect x="186" y="210" width="28" height="48" rx="2" fill="#6366f1" />
    <rect x="0" y="258" width="400" height="42" fill="#d9f99d" opacity="0.5" />
    <circle cx="340" cy="235" r="22" fill="#86efac" opacity="0.7" />
    <circle cx="40" cy="245" r="16" fill="#86efac" opacity="0.7" />
  </svg>
);

const HeroCard = () => {
  const { profile, loading } = useStudentDashboard();

  const studentData = profile || {
    name: 'Student', username: '', grade: '', section: '',
    className: '', sectionName: '', rollNumber: '', roll: '',
    campusName: '', campusType: '', profilePic: null,
  };

  const displayClass = studentData.className || studentData.grade || '';
  const displaySection = studentData.sectionName || studentData.section || '';
  const displayRoll = studentData.rollNumber || studentData.roll || '';
  const displayCampus = studentData.campusName
    ? (studentData.campusType ? `${studentData.campusName} (${studentData.campusType})` : studentData.campusName)
    : '';

  const profileImage = studentData.profilePic || studentData.avatar || '';
  const hasProfileImage = typeof profileImage === 'string' && profileImage.trim() !== '';
  const nameParts = (studentData.name || '').trim().split(/\s+/).filter(Boolean);
  const initials = (nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : (nameParts[0]?.[0] || 'S')).toUpperCase();

  const tags = [
    displayClass ? `Class ${displayClass}` : null,
    displaySection || null,
    displayRoll ? `Roll ${displayRoll}` : null,
    displayCampus || null,
  ].filter(Boolean);

  if (loading) {
    return <Skeleton className="h-[280px] w-full rounded-[28px]" />;
  }

  return (
    <Motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full overflow-hidden rounded-[28px] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.03),0px_1px_3px_rgba(0,0,0,0.05)]"
    >
      {profile?.schoolCoverImage && (
        // Same treatment as the teacher/parent banners: photo fully clear on
        // the right, blending only on its left edge into the card.
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[75%] overflow-hidden sm:block"
          style={{
            maskImage: 'linear-gradient(to right, transparent 0%, black 18%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 18%)',
          }}
        >
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${profile.schoolCoverImage})` }} />
          <div className="absolute inset-0 bg-linear-to-r from-black/60 from-0% via-black/25 via-35% to-transparent to-70%" />
        </div>
      )}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2">
        {/* Left: profile info */}
        <div className="flex flex-col gap-3 p-6">
          <div className="relative w-fit">
            {hasProfileImage ? (
              <img
                src={profileImage}
                alt=""
                className="h-20 w-20 rounded-full border-[3px] border-gray-100 object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-gray-100 bg-[#eef2ff]">
                <span className="select-none text-2xl font-bold text-[#4f46e5]">{initials}</span>
              </div>
            )}
            <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
          </div>

          <span className="w-fit rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-semibold text-[#4f46e5]">
            {formatDate()}
          </span>

          <div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-[#0f172a]">
              {studentData.name || 'Student'}
            </h1>
            {studentData.username && (
              <p className="mt-0.5 text-xs text-[#9ca3af]">ID: {studentData.username}</p>
            )}
          </div>

          <span className="w-fit rounded-full bg-[#eef2ff] px-4 py-1.5 text-sm font-semibold text-[#4f46e5]">
            {getGreeting()}
          </span>

          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4338ca]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#6366f1]" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: campus illustration (only when the school has no cover photo) */}
        {!profile?.schoolCoverImage && (
          <div className="relative hidden min-h-[220px] sm:block">
            <CampusIllustration />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-l from-transparent via-white/0 to-white/60" />
          </div>
        )}
      </div>
    </Motion.div>
  );
};

// ── Daily boost quote carousel ──────────────────────────────────────────
const DailyBoost = () => {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [direction, setDirection] = useState(1);

  const go = useCallback((step) => {
    setDirection(step);
    setCurrent((p) => (p + step + QUOTES.length) % QUOTES.length);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => go(1), 5000);
    return () => clearInterval(id);
  }, [playing, go]);

  const quoteVariants = {
    enter: (dir) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
    center: { opacity: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, x: dir > 0 ? -24 : 24 }),
  };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef2ff] text-[#4f46e5]">⚡</span>
        <span className="text-xs font-bold uppercase tracking-wide text-[#6b7280]">Daily Boost</span>
      </div>

      <div className="relative min-h-[24px] min-w-0 flex-1 overflow-hidden">
        <AnimatePresence custom={direction} mode="wait">
          <Motion.p
            key={current}
            custom={direction}
            variants={quoteVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="flex items-center gap-2 truncate text-sm text-[#374151]"
          >
            <BookOpen size={16} className="shrink-0 text-[#4f46e5]" />
            {QUOTES[current].text}
          </Motion.p>
        </AnimatePresence>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={() => go(-1)} aria-label="Previous" className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50">
          <ChevronLeft size={15} />
        </button>
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'} className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50">
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Next" className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50">
          <ChevronRight size={15} />
        </button>
        <div className="ml-1 hidden items-center gap-1 sm:flex">
          {QUOTES.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === current ? 16 : 6, backgroundColor: i === current ? '#4f46e5' : '#e5e7eb' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Today's schedule ─────────────────────────────────────────────────────
const dayOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const normalizeValue = (value) => String(value ?? '').trim().toLowerCase();

const isBreakSession = (session) =>
  normalizeValue(session?.subject || session?.course || session?.title) === 'break';

const TodaySchedule = ({ setActiveView }) => {
  const { profile } = useStudentDashboard();
  const { data: rawSchedule, loading, error, reload } = useCardData(
    `${API_BASE}/api/student/auth/schedule`,
    (r) => r?.data?.schedule || r?.data?.routine || r?.schedule || {}
  );

  const todaySessions = useMemo(() => {
    if (!rawSchedule) return [];
    const todayKey = dayOrder[new Date().getDay()];
    const entries = Array.isArray(rawSchedule)
      ? rawSchedule.filter((s) => normalizeValue(s.day || s.weekday || s.dayOfWeek) === todayKey)
      : (rawSchedule[todayKey] || rawSchedule[todayKey?.charAt(0).toUpperCase() + todayKey?.slice(1)] || []);

    const classValues = [profile?.className, profile?.grade].filter(Boolean).map(normalizeValue);
    const sectionValues = [profile?.sectionName, profile?.section].filter(Boolean).map(normalizeValue);

    const filtered = (Array.isArray(entries) ? entries : []).filter((entry) => {
      const entryClass = normalizeValue(entry.className || entry.class || entry.grade || entry.standard);
      const entrySection = normalizeValue(entry.sectionName || entry.section || entry.division);
      const classOk = !entryClass || classValues.length === 0 || classValues.includes(entryClass);
      const sectionOk = !entrySection || sectionValues.length === 0 || sectionValues.includes(entrySection);
      return classOk && sectionOk;
    });

    return filtered
      .slice()
      .sort((a, b) => (Number(a.period) || 999) - (Number(b.period) || 999))
      .slice(0, 6);
  }, [rawSchedule, profile]);

  return (
    <div className="rounded-[28px] bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.03),0px_1px_3px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
          <CalendarDays size={18} />
        </span>
        <h2 className="text-base font-bold text-[#0f172a]">Today&apos;s Schedule</h2>
      </div>

      {error && <CardError label="Today's Schedule" onRetry={reload} />}

      {!error && loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      )}

      {!error && !loading && todaySessions.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400">No classes scheduled for today.</p>
      )}

      {!error && !loading && todaySessions.length > 0 && (
        <ol className="relative space-y-4 border-l-2 border-dashed border-gray-100 pl-5">
          {todaySessions.map((session, i) => {
            const subject = session.subject?.name || session.subject || session.course || session.title || 'Class';
            const timeLabel = session.startTime || (session.time ? session.time.split('-')[0].trim() : '');
            const isBreak = isBreakSession(session);
            return (
              <li key={`${subject}-${i}`} className="relative">
                <span className={`absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${isBreak ? 'bg-gray-300' : 'bg-[#6366f1]'}`} />
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                      <Clock size={11} /> {timeLabel || '—'}
                    </p>
                    <p className="truncate text-sm font-semibold text-[#0f172a]">{subject}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${isBreak ? 'bg-gray-100 text-gray-500' : 'bg-[#eef2ff] text-[#4f46e5]'}`}>
                    {isBreak ? 'Break' : `Period ${session.period || i + 1}`}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <button
        type="button"
        onClick={() => setActiveView?.('routine')}
        className="mt-4 flex w-full items-center justify-end gap-1 text-xs font-bold text-[#4f46e5] hover:underline"
      >
        View Full Timetable <ChevronRight size={14} />
      </button>
    </div>
  );
};

// ── Quick links ───────────────────────────────────────────────────────────
const QuickLinks = ({ setActiveView }) => {
  const { unreadChatCount } = useStudentDashboard();

  const links = [
    { key: 'attendance', label: 'Attendance', icon: CalendarCheck, color: 'bg-emerald-50 text-emerald-600' },
    { key: 'exams', label: 'Exams', icon: FileText, color: 'bg-indigo-50 text-indigo-600' },
    { key: 'lesson-plan-status', label: 'Syllabus', icon: BookOpen, color: 'bg-sky-50 text-sky-600' },
    { key: 'holidays', label: 'Holidays', icon: CalendarDays, color: 'bg-amber-50 text-amber-600' },
    { key: 'noticeboard', label: 'Notice Board', icon: Bell, color: 'bg-rose-50 text-rose-600' },
    { key: 'chat', label: 'Messages', icon: MessageSquare, color: 'bg-blue-50 text-blue-600', badge: unreadChatCount },
  ];

  return (
    <div className="rounded-[28px] bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.03),0px_1px_3px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
          <Compass size={18} />
        </span>
        <h2 className="text-base font-bold text-[#0f172a]">Quick Links</h2>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {links.map(({ key, label, icon: Icon, color, badge }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveView?.(key)}
            className="relative flex flex-col items-center gap-2 rounded-2xl border border-gray-50 bg-gray-50/60 p-3 text-center transition-colors hover:bg-gray-100"
          >
            {badge > 0 && (
              <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}>
              <Icon size={17} />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-[#374151]">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const ProgressTrendChart = () => {
  const { data: chartData, loading, error, reload } = useCardData(
    `${API_BASE}/api/exam/results/me`,
    (r) => {
      const results = r?.data?.data || [];
      return [...results]
        .filter((x) => x.marks != null && x.examId?.date)
        .sort((a, b) => new Date(a.examId.date) - new Date(b.examId.date))
        .slice(-10)
        .map((x) => ({
          name: x.examId?.title
            ? x.examId.title.slice(0, 12)
            : new Date(x.examId.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          marks: Number(x.marks),
          subject: x.examId?.subject || '',
        }));
    }
  );

  if (error) return <CardError label="Score Trend" onRetry={reload} />;
  if (loading || !chartData || chartData.length < 2) return null;

  return (
    <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
      <p className="mb-3 text-sm font-bold text-[#0f172a]">Score Trend</p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#fde68a" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#b45309' }} />
          <YAxis tick={{ fontSize: 10, fill: '#b45309' }} domain={[0, 100]} />
          <ReTooltip
            contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #fde68a' }}
            formatter={(v) => [`${v} marks`, 'Score']}
          />
          <Line
            type="monotone"
            dataKey="marks"
            stroke="#b45309"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#b45309', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Same exponential-decay formula the backend uses for /api/spaced-repetition/retention
// (see estimateRetention in spacedRepetitionRoutes.js) — swept over a day range to draw
// an actual curve instead of the single-point snapshot the API returns.
const FORGETTING_CURVE_COLORS = ['#dc2626', '#d97706', '#059669'];
const forgettingCurvePoints = (intervalDays, maxDays) => Array.from({ length: maxDays + 1 }, (_, day) => ({
  day, retention: Math.round(100 * Math.pow(0.9, day / (intervalDays || 1))),
}));

const ForgettingCurveChart = () => {
  const { data: topics, loading, error, reload } = useCardData(
    `${API_BASE}/api/spaced-repetition/retention`,
    // Endpoint returns { success, data: [...] }; tolerate a bare array too.
    (r) => (Array.isArray(r?.data?.data) ? r.data.data : Array.isArray(r?.data) ? r.data : []).slice()
  );

  if (error) return <CardError label="Retention Forecast" onRetry={reload} />;

  if (loading) {
    return (
      <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50 p-4 shadow-sm">
        <Skeleton className="h-5 w-32" />
      </div>
    );
  }

  if (!topics || !topics.length) {
    return (
      <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50 p-4 shadow-sm flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#0f172a]">Retention Forecast</p>
          <p className="mt-0.5 text-xs text-[#64748b]">Available in a week</p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-[#a78bfa]" />
      </div>
    );
  }

  const tracked = [...topics]
    .sort((a, b) => (a.estimatedRetention ?? 100) - (b.estimatedRetention ?? 100))
    .slice(0, 3);
  const maxDays = Math.max(21, ...tracked.map((t) => Math.ceil(t.daysSinceReview || 0) + 3));

  const chartData = Array.from({ length: maxDays + 1 }, (_, day) => {
    const point = { day };
    tracked.forEach((t) => {
      point[t.topicTitle || t.subject] = forgettingCurvePoints(t.intervalDays, maxDays)[day].retention;
    });
    return point;
  });

  return (
    <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50 p-4 shadow-sm">
      <p className="mb-1 text-sm font-bold text-[#0f172a]">Retention Forecast</p>
      <p className="mb-3 text-xs text-[#64748b]">Estimated memory decay since your last review of each topic</p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#7c3aed' }} label={{ value: 'Days since review', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#7c3aed' }} />
          <YAxis tick={{ fontSize: 10, fill: '#7c3aed' }} domain={[0, 100]} />
          <ReTooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e9d5ff' }} formatter={(v) => [`${v}%`, 'Retention']} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {tracked.map((t, i) => (
            <Line
              key={t.topicTitle || t.subject || i}
              type="monotone"
              dataKey={t.topicTitle || t.subject}
              stroke={FORGETTING_CURVE_COLORS[i % FORGETTING_CURVE_COLORS.length]}
              strokeWidth={2.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const CALIBRATION_META = {
  overconfident: { label: 'Overconfident', color: 'text-amber-700 bg-amber-100' },
  underconfident: { label: 'Underconfident', color: 'text-sky-700 bg-sky-100' },
  calibrated: { label: 'Well calibrated', color: 'text-emerald-700 bg-emerald-100' },
  insufficient_data: { label: 'Not enough data', color: 'text-gray-500 bg-gray-100' },
};

// Learner confidence calibration: the student's own self-rating vs. their actual
// mastery score per topic (see backend/services/confidenceTrackingService.js).
const ConfidenceCalibrationCard = () => {
  const { data: profile, loading, error, reload } = useCardData(
    `${API_BASE}/api/confidence/profile`,
    (r) => r?.data || null
  );

  if (error) return <CardError label="Confidence Calibration" onRetry={reload} />;
  if (loading || !profile || !profile.topics?.length) return null;

  const overall = CALIBRATION_META[profile.overallLabel] || CALIBRATION_META.insufficient_data;

  return (
    <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-pink-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-[#0f172a]">Confidence Calibration</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${overall.color}`}>{overall.label}</span>
      </div>
      <p className="mb-3 text-xs text-[#64748b]">How your self-rated confidence compares to your actual mastery</p>
      <div className="space-y-2">
        {profile.topics.slice(0, 5).map((t) => {
          const meta = CALIBRATION_META[t.calibrationLabel] || CALIBRATION_META.insufficient_data;
          return (
            <div key={`${t.subject}-${t.topicId}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-1.5">
              <span className="truncate text-xs font-semibold text-[#0f172a]">{t.topicTitle || t.topicId}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>{meta.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const LEARNING_STYLE_META = {
  visual: { label: 'Visual', emoji: '🖼️' },
  reading: { label: 'Reading', emoji: '📖' },
  'hands-on': { label: 'Hands-on', emoji: '✍️' },
  listening: { label: 'Guided/Verbal', emoji: '💬' },
};

// Learning style detection: which tutor content format the student actually
// engages with most, compared against their self-reported preference.
// See backend/services/learningStyleService.js.
const LearningStyleCard = () => {
  const { data: profile, loading, error, reload } = useCardData(
    `${API_BASE}/api/learning-style/me`,
    (r) => r?.data || null
  );

  if (error) return <CardError label="Learning Style" onRetry={reload} />;
  if (loading || !profile || profile.dataStatus !== 'available') return null;

  const meta = LEARNING_STYLE_META[profile.detectedStyle] || { label: profile.detectedStyle, emoji: '✨' };

  return (
    <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-sky-50 p-4 shadow-sm">
      <p className="mb-1 text-sm font-bold text-[#0f172a]">Your Learning Style</p>
      <p className="mb-3 text-xs text-[#64748b]">Based on which study modes you actually use most</p>
      <div className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2.5">
        <span className="text-2xl">{meta.emoji}</span>
        <div>
          <p className="text-sm font-bold text-[#0f172a]">{meta.label}</p>
          <p className="text-[11px] text-[#8e9aaf]">{profile.confidence}% of your recent sessions</p>
        </div>
      </div>
      {profile.selfReported && profile.agreesWithSelfReport === false && (
        <p className="mt-2 text-[11px] text-[#64748b]">
          You told us you prefer <strong>{LEARNING_STYLE_META[profile.selfReported]?.label || profile.selfReported}</strong> — worth trying those modes more often!
        </p>
      )}
    </div>
  );
};

const BELONGING_BAND_META = {
  isolated: { label: 'Just getting started', color: 'text-slate-600 bg-slate-100' },
  low: { label: 'Getting involved', color: 'text-amber-700 bg-amber-100' },
  moderate: { label: 'Active in the community', color: 'text-sky-700 bg-sky-100' },
  active: { label: 'Community champion', color: 'text-emerald-700 bg-emerald-100' },
};

// Social / belonging — participation in the Alcove peer community (posts,
// comments, likes) as a light-touch nudge toward staying connected with
// classmates. See backend/services/belongingService.js.
const BelongingCard = () => {
  const { data: profile, loading, error, reload } = useCardData(
    `${API_BASE}/api/belonging/me`,
    (r) => r?.data || null
  );

  if (error) return <CardError label="Community" onRetry={reload} />;
  if (loading || !profile) return null;

  const meta = BELONGING_BAND_META[profile.band] || BELONGING_BAND_META.isolated;

  return (
    <div className="rounded-2xl border border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 to-pink-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-[#0f172a]">Community</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>{meta.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white/70 px-2 py-2">
          <p className="text-lg font-bold text-[#0f172a]">{profile.postsAuthored}</p>
          <p className="text-[10px] text-[#8e9aaf]">Posts</p>
        </div>
        <div className="rounded-lg bg-white/70 px-2 py-2">
          <p className="text-lg font-bold text-[#0f172a]">{profile.commentsAuthored}</p>
          <p className="text-[10px] text-[#8e9aaf]">Comments</p>
        </div>
        <div className="rounded-lg bg-white/70 px-2 py-2">
          <p className="text-lg font-bold text-[#0f172a]">{profile.likesReceived}</p>
          <p className="text-[10px] text-[#8e9aaf]">Likes received</p>
        </div>
      </div>
    </div>
  );
};

// Help-seeking behaviour — how often the student reaches for Homework Help,
// the quiz misconception explainer, or signals they're stuck, in their own
// words ("I don't know" etc). See backend/services/helpSeekingService.js.
const HelpSeekingCard = () => {
  const { data: profile, loading, error, reload } = useCardData(
    `${API_BASE}/api/help-seeking/profile`,
    (r) => r?.data || null
  );

  if (error) return <CardError label="Help-Seeking" onRetry={reload} />;
  if (loading || !profile || !profile.totalEvents) return null;

  return (
    <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50 p-4 shadow-sm">
      <p className="mb-1 text-sm font-bold text-[#0f172a]">Asking For Help</p>
      <p className="mb-3 text-xs text-[#64748b]">Last {profile.sinceDays} days — reaching out is a strength, not a weakness</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white/70 px-2 py-2">
          <p className="text-lg font-bold text-[#0f172a]">{profile.homeworkHelpUsed}</p>
          <p className="text-[10px] text-[#8e9aaf]">Homework help</p>
        </div>
        <div className="rounded-lg bg-white/70 px-2 py-2">
          <p className="text-lg font-bold text-[#0f172a]">{profile.misconceptionExplainerUsed}</p>
          <p className="text-[10px] text-[#8e9aaf]">Mistakes explained</p>
        </div>
        <div className="rounded-lg bg-white/70 px-2 py-2">
          <p className="text-lg font-bold text-[#0f172a]">{profile.stuckSignals}</p>
          <p className="text-[10px] text-[#8e9aaf]">Times stuck</p>
        </div>
      </div>
      {profile.topSubjects?.length > 0 && (
        <p className="mt-2 text-[11px] text-[#64748b]">Most often in {profile.topSubjects[0].subject}</p>
      )}
    </div>
  );
};

const computeStreak = (recentAttendance) => {
  if (!Array.isArray(recentAttendance) || recentAttendance.length === 0) return 0;
  const sorted = [...recentAttendance].sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0;
  for (const record of sorted) {
    if (record.status === 'present') streak++;
    else break;
  }
  return streak;
};

const STREAK_MILESTONES = [3, 5, 7, 10];

const StreakTracker = () => {
  const { recentAttendance, stats, loading } = useStudentDashboard();
  const streak = useMemo(() => computeStreak(recentAttendance), [recentAttendance]);
  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak) || null;
  const attPct = stats?.attendancePercentage ?? null;

  if (loading) return null;
  if (!recentAttendance?.length) return null;

  const dots = recentAttendance
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-7);

  const streakLabel = streak === 0
    ? 'Start your streak today!'
    : streak === 1
    ? '1 day streak 🔥'
    : `${streak} day streak 🔥`;

  return (
    <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
      {/* Streak badge */}
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200">
          <span className="text-2xl leading-none select-none">{streak >= 7 ? '🏆' : streak >= 3 ? '🔥' : '✨'}</span>
        </div>
        <div>
          <p className="text-lg font-bold leading-tight text-[#0f172a]">{streakLabel}</p>
          <p className="text-xs text-[#64748b]">
            {nextMilestone
              ? `${nextMilestone - streak} more day${nextMilestone - streak !== 1 ? 's' : ''} to reach ${nextMilestone}-day milestone`
              : 'Incredible consistency! Keep it up!'}
          </p>
        </div>
      </div>

      {/* Day dots */}
      <div className="flex items-center gap-1.5 sm:ml-auto">
        {dots.map((record, i) => {
          const isPresent = record.status === 'present';
          const isLeave = record.status === 'leave';
          return (
            <div
              key={`${record.date || ''}-${i}`}
              title={`${new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} — ${record.status}`}
              className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                isPresent
                  ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                  : isLeave
                  ? 'bg-blue-200 border-blue-300 text-blue-700'
                  : 'bg-white border-red-200 text-red-400'
              }`}
            >
              {isPresent ? '✓' : isLeave ? 'L' : '✗'}
            </div>
          );
        })}
        {attPct !== null && (
          <span className="ml-1 rounded-full bg-amber-100 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-800">
            {attPct}%
          </span>
        )}
      </div>
    </div>
  );
};

const tierColor = (score) => score >= 80 ? 'bg-emerald-200' : score >= 60 ? 'bg-amber-200' : 'bg-red-200';
const tierText = (score) => score >= 80 ? 'text-emerald-700' : score >= 60 ? 'text-amber-700' : 'text-red-600';

const MasteryTopicsCard = () => {
  const { data, loading, error, reload } = useCardData(
    `${API_BASE}/api/student-dashboard/mastery-topics`,
    (r) => r?.data?.data || []
  );
  if (error) return <CardError label="Topic Mastery" onRetry={reload} />;
  if (loading || !data || !data.length) return null;
  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-bold text-[#0f172a]">Topic Mastery</p>
      <div className="space-y-2">
        {data.slice(0, 6).map((t) => (
          <div key={t.topicId}>
            <div className="flex justify-between text-xs text-[#64748b] mb-1">
              <span className="truncate max-w-[65%] font-medium">{t.topicTitle}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#8e9aaf]">{t.subject}</span>
                <span className={`font-bold ${tierText(t.score)}`}>{t.score}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${tierColor(t.score)}`} style={{ width: `${t.score}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LearningStreakCard = () => {
  const { data, error, reload } = useCardData(
    `${API_BASE}/api/student-dashboard/learning-streak`,
    (r) => r?.data?.data || null
  );
  if (error) return <CardError label="Learning streak" onRetry={reload} />;
  if (!data) return null;
  return (
    <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-3 shadow-sm flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200">
        <span className="text-lg leading-none">{data.streak >= 7 ? '🏆' : data.streak >= 3 ? '⚡' : '📖'}</span>
      </div>
      <div>
        <p className="text-sm font-bold text-[#0f172a]">{data.streak} day learning streak</p>
        <p className="text-xs text-[#64748b]">{data.totalActiveDays} active days total</p>
      </div>
    </div>
  );
};

const TimeBySubjectCard = () => {
  const { data, loading, error, reload } = useCardData(
    `${API_BASE}/api/student-dashboard/time-by-subject`,
    (r) => r?.data?.data || []
  );
  if (error) return <CardError label="Time Spent by Subject" onRetry={reload} />;
  if (loading || !data || !data.length) return null;
  const max = Math.max(...data.map((d) => d.totalMinutes), 1);
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-bold text-[#0f172a]">Time Spent by Subject</p>
      <div className="space-y-2">
        {data.slice(0, 5).map((d) => (
          <div key={d.subject}>
            <div className="flex justify-between text-xs text-[#64748b] mb-1">
              <span className="font-medium">{d.subject}</span>
              <span className="text-[#8e9aaf]">{d.totalMinutes}m</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-200" style={{ width: `${(d.totalMinutes / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const FlashcardStatsCard = () => {
  const { data, loading, error, reload } = useCardData(
    `${API_BASE}/api/student-dashboard/flashcard-stats`,
    (r) => r?.data?.data || null
  );
  if (error) return <CardError label="Flashcard Recall" onRetry={reload} />;
  if (loading || !data || data.totalAttempts === 0) return null;
  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-[#0f172a]">Flashcard Recall</p>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">{data.overallRate}% recall</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
        <div className="h-full rounded-full bg-amber-200" style={{ width: `${data.overallRate}%` }} />
      </div>
      <div className="space-y-1.5">
        {data.byTopic.slice(0, 3).map((t) => (
          <div key={t.topicId} className="flex items-center justify-between text-xs">
            <span className="text-[#64748b] truncate max-w-[65%]">{t.topicTitle}</span>
            <span className={`font-semibold ${t.recallRate >= 70 ? 'text-emerald-600' : t.recallRate >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{t.recallRate}%</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-[#8e9aaf]">{data.totalAttempts} total flashcard attempts</p>
    </div>
  );
};

/** Full-grid placeholder shown on the first load, before the dashboard data
 *  resolves — keeps the page shape stable instead of a staggered pop-in. */
const DashboardSkeleton = () => (
  <div className="space-y-4 sm:space-y-6 p-4 sm:p-6" aria-hidden="true">
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
      <Skeleton className="h-[280px] rounded-[28px] lg:col-span-2" />
      <Skeleton className="h-[280px] rounded-[28px]" />
    </div>
    <Skeleton className="h-16 w-full rounded-2xl" />
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
    </div>
  </div>
);

const FIRST_RUN_LINKS = [
  { to: '/student/learning', icon: Compass, label: 'Open the Learning hub', desc: 'Start a lesson or ask the AI tutor' },
  { to: '/student/assignments', icon: ClipboardList, label: 'Check your assignments', desc: 'See what your teachers have set' },
  { to: '/student/routine', icon: CalendarDays, label: 'View your timetable', desc: 'Know what class is next' },
  { to: '/student/materials', icon: BookOpen, label: 'Browse study materials', desc: 'Notes and resources from teachers' },
];

/** Shown to a brand-new student whose account has no attendance, results or
 *  activity yet — so the dashboard explains what will fill it and where to begin
 *  instead of rendering a screen of empty cards. */
const FirstRunDashboard = () => (
  <EmptyState
    icon={Compass}
    title="Your dashboard is getting ready"
    description="Progress, streaks and results will appear here as you attend classes and use the portal. Here's where to start:"
    action={
      <div className="mt-2 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
        {FIRST_RUN_LINKS.map(({ to, icon: Icon, label, desc }) => (
          <Link
            key={to}
            to={to}
            className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-50/40"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-[#0f172a]">{label}</span>
              <span className="block text-xs text-slate-500">{desc}</span>
            </span>
          </Link>
        ))}
      </div>
    }
  />
);

const DashboardHome = ({ setActiveView }) => {
  const { loading, error, stats, recentAttendance, smartLearningReminders } = useStudentDashboard();

  const isNewStudent = useMemo(() => (
    !loading && !error && stats
    && (stats.totalClasses || 0) === 0
    && (stats.achievements || 0) === 0
    && (!recentAttendance || recentAttendance.length === 0)
  ), [loading, error, stats, recentAttendance]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="relative space-y-4 p-4 sm:space-y-6 sm:p-6">
      {/* Hero + Today's Schedule */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HeroCard />
        </div>
        <TodaySchedule setActiveView={setActiveView} />
      </div>

      {smartLearningReminders.length > 0 && (
        <section className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-sm" aria-label="Smart Learning reminders">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-indigo-950">Smart Learning reminders</p>
              <p className="mt-1 text-xs text-indigo-700">You have unfinished learning work to pick up.</p>
            </div>
            <Link to="/student/smart-learning-courses" className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">Open Smart Learning</Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {smartLearningReminders.slice(0, 3).map((reminder) => (
              <span key={reminder.id} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800">{reminder.kind}: {reminder.title}</span>
            ))}
          </div>
        </section>
      )}

      {isNewStudent ? (
        <FirstRunDashboard />
      ) : (
        <>
          {/* Daily boost + Quick Links */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            <div className="space-y-4 sm:space-y-6 lg:col-span-2">
              <DailyBoost />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <LearningStreakCard />
                <ForgettingCurveChart />
              </div>
            </div>
            <QuickLinks setActiveView={setActiveView} />
          </div>

          {/* Streaks — attendance and learning activity, side by side so they
              read as two related metrics rather than a duplicated card. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StreakTracker />
          </div>

          {/* Progress Trend */}
          <ProgressTrendChart />

          {/* Confidence calibration — self-rating vs. actual mastery, per topic */}
          <ConfidenceCalibrationCard />

          {/* Learning style — detected content-format preference vs. self-report */}
          <LearningStyleCard />

          {/* Social / belonging — Alcove peer community participation */}
          <BelongingCard />

          {/* Help-seeking behaviour — the student's own pattern */}
          <HelpSeekingCard />

          {/* Quick Stats */}
          <QuickStats />

          {/* Learning-analytics cards — each renders only when it has data */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MasteryTopicsCard />
            <TimeBySubjectCard />
            <FlashcardStatsCard />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            {/* Main Content - Left 2 columns */}
            <div className="space-y-4 sm:space-y-6 lg:col-span-2">
              <CourseProgress />
              <AchievementCard />
            </div>

            {/* Sidebar - Right 1 column */}
            <div className="space-y-4 sm:space-y-6">
              <RecommendationWidget />
              <CalendarWidget />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardHome;
