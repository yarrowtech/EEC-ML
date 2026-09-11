import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BookOpen, ClipboardList, CalendarDays, Compass } from 'lucide-react';
import WelcomeCard from './WelcomeCard';
import CourseProgress from './CourseProgress';
import AchievementCard from './AchievementCard';
import CalendarWidget from './CalendarWidget';
import QuickStats from './QuickStats';
import RecommendationWidget from './RecommendationWidget';
import PageHeader from './PageHeader';
import EmptyState from './EmptyState';
import { Skeleton } from './ui/skeleton';
import { fetchCachedJson } from '../utils/studentApiCache';
import { useStudentDashboard } from './StudentDashboardContext';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

/** Small inline "this widget failed to load" card with a retry affordance, so a
 *  backend error on a dashboard analytics endpoint is visible instead of the
 *  card silently disappearing. */
const CardError = ({ onRetry, label }) => (
  <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
    <p className="text-sm font-semibold text-gray-700">{label}</p>
    <p className="mt-1 text-xs text-gray-500">Couldn&apos;t load this right now.</p>
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
  const [state, setState] = useState({ data: null, loading: true, error: false });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    fetchCachedJson(url, { ttlMs: 5 * 60 * 1000, forceRefresh: nonce > 0 })
      .then((r) => { if (alive) setState({ data: pick(r), loading: false, error: false }); })
      .catch((err) => {
        if (!alive) return;
        // An auth failure is already being handled globally — don't also show a retry card.
        if (err?.code === 'expired') return;
        setState({ data: null, loading: false, error: true });
      });
    return () => { alive = false; };
  }, [url, nonce]); // `pick` is a stable inline mapper per card — intentionally not a dep
  return { ...state, reload: () => setNonce((n) => n + 1) };
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
      <p className="mb-3 text-sm font-black text-amber-900">Score Trend</p>
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
    (r) => (r?.data || []).slice()
  );

  if (error) return <CardError label="Retention Forecast" onRetry={reload} />;
  if (loading || !topics || !topics.length) return null;

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
      <p className="mb-1 text-sm font-black text-violet-900">Retention Forecast</p>
      <p className="mb-3 text-xs text-violet-600">Estimated memory decay since your last review of each topic</p>
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
        <p className="text-sm font-black text-rose-900">Confidence Calibration</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${overall.color}`}>{overall.label}</span>
      </div>
      <p className="mb-3 text-xs text-rose-600">How your self-rated confidence compares to your actual mastery</p>
      <div className="space-y-2">
        {profile.topics.slice(0, 5).map((t) => {
          const meta = CALIBRATION_META[t.calibrationLabel] || CALIBRATION_META.insufficient_data;
          return (
            <div key={`${t.subject}-${t.topicId}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-1.5">
              <span className="truncate text-xs font-semibold text-gray-700">{t.topicTitle || t.topicId}</span>
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
      <p className="mb-1 text-sm font-black text-cyan-900">Your Learning Style</p>
      <p className="mb-3 text-xs text-cyan-600">Based on which study modes you actually use most</p>
      <div className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2.5">
        <span className="text-2xl">{meta.emoji}</span>
        <div>
          <p className="text-sm font-bold text-gray-800">{meta.label}</p>
          <p className="text-[11px] text-gray-500">{profile.confidence}% of your recent sessions</p>
        </div>
      </div>
      {profile.selfReported && profile.agreesWithSelfReport === false && (
        <p className="mt-2 text-[11px] text-cyan-700">
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
        <p className="text-sm font-black text-fuchsia-900">Community</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>{meta.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white/70 px-2 py-2">
          <p className="text-lg font-bold text-gray-800">{profile.postsAuthored}</p>
          <p className="text-[10px] text-gray-500">Posts</p>
        </div>
        <div className="rounded-lg bg-white/70 px-2 py-2">
          <p className="text-lg font-bold text-gray-800">{profile.commentsAuthored}</p>
          <p className="text-[10px] text-gray-500">Comments</p>
        </div>
        <div className="rounded-lg bg-white/70 px-2 py-2">
          <p className="text-lg font-bold text-gray-800">{profile.likesReceived}</p>
          <p className="text-[10px] text-gray-500">Likes received</p>
        </div>
      </div>
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
          <p className="font-black text-lg text-amber-900 leading-tight">{streakLabel}</p>
          <p className="text-xs text-amber-700/70">
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
              key={record.date || i}
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
      <p className="mb-3 text-sm font-black text-gray-800">Topic Mastery</p>
      <div className="space-y-2">
        {data.slice(0, 6).map((t) => (
          <div key={t.topicId}>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span className="truncate max-w-[65%] font-medium">{t.topicTitle}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">{t.subject}</span>
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
        <p className="text-sm font-black text-amber-900">{data.streak} day learning streak</p>
        <p className="text-xs text-amber-700">{data.totalActiveDays} active days total</p>
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
      <p className="mb-3 text-sm font-black text-gray-800">Time Spent by Subject</p>
      <div className="space-y-2">
        {data.slice(0, 5).map((d) => (
          <div key={d.subject}>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span className="font-medium">{d.subject}</span>
              <span className="text-gray-400">{d.totalMinutes}m</span>
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
        <p className="text-sm font-black text-gray-800">Flashcard Recall</p>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">{data.overallRate}% recall</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
        <div className="h-full rounded-full bg-amber-200" style={{ width: `${data.overallRate}%` }} />
      </div>
      <div className="space-y-1.5">
        {data.byTopic.slice(0, 3).map((t) => (
          <div key={t.topicId} className="flex items-center justify-between text-xs">
            <span className="text-gray-600 truncate max-w-[65%]">{t.topicTitle}</span>
            <span className={`font-semibold ${t.recallRate >= 70 ? 'text-emerald-600' : t.recallRate >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{t.recallRate}%</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-gray-400">{data.totalAttempts} total flashcard attempts</p>
    </div>
  );
};

const TODAY_LABEL = new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
});

/** Full-grid placeholder shown on the first load, before the dashboard data
 *  resolves — keeps the page shape stable instead of a staggered pop-in. */
const DashboardSkeleton = () => (
  <div className="space-y-4 sm:space-y-6 p-4 sm:p-6" aria-hidden="true">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-28 w-full rounded-2xl" />
    <Skeleton className="h-20 w-full rounded-2xl" />
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
    </div>
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
      <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
      <Skeleton className="h-64 rounded-2xl" />
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
              <span className="block text-sm font-semibold text-slate-800">{label}</span>
              <span className="block text-xs text-slate-500">{desc}</span>
            </span>
          </Link>
        ))}
      </div>
    }
  />
);

const DashboardHome = () => {
  const { loading, error, stats, recentAttendance } = useStudentDashboard();

  const isNewStudent = useMemo(() => (
    !loading && !error && stats
    && (stats.totalClasses || 0) === 0
    && (stats.achievements || 0) === 0
    && (!recentAttendance || recentAttendance.length === 0)
  ), [loading, error, stats, recentAttendance]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="relative space-y-4 sm:space-y-6 p-4 sm:p-6">
      <PageHeader eyebrow={TODAY_LABEL} title="Dashboard" />

      {/* Welcome Section */}
      <WelcomeCard />

      {isNewStudent ? (
        <FirstRunDashboard />
      ) : (
        <>
          {/* Streaks — attendance and learning activity, side by side so they
              read as two related metrics rather than a duplicated card. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StreakTracker />
            <LearningStreakCard />
          </div>

          {/* Progress Trend */}
          <ProgressTrendChart />

          {/* Forgetting curve — knowledge decay since last review, per topic */}
          <ForgettingCurveChart />

          {/* Confidence calibration — self-rating vs. actual mastery, per topic */}
          <ConfidenceCalibrationCard />

          {/* Learning style — detected content-format preference vs. self-report */}
          <LearningStyleCard />

          {/* Social / belonging — Alcove peer community participation */}
          <BelongingCard />

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
