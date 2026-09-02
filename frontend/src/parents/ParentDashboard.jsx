import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Calendar,
  CreditCard,
  Video,
  Menu,
  Clock,
  Users,
  Sparkles,
  TrendingUp,
  Award,
  ChevronRight,
  Loader2,
  CheckCircle2,
  User as UserIcon,
  MessageCircle,
  FileText,
  AlertTriangle,
  BookOpen,
  Lightbulb,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  LifeBuoy,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatStudentDisplay } from '../utils/studentDisplay';
import { parentApiFetch, parentApiJson } from './parentApi';
import { mapAttendanceChildForDashboard } from './attendanceViewModel';

const getInitials = (name) => String(name || 'Student')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase();

// ── Weak Areas Card ───────────────────────────────────────────────────────────
const WeakAreasCard = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    parentApiJson('/api/parent-dashboard/weak-areas', {}, navigate)
      .then((d) => setItems(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [navigate]);

  const concernColor = (score) => {
    if (score < 40) return 'bg-red-100 text-red-700 border-red-200';
    if (score < 60) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  };

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <AlertTriangle size={14} className="text-amber-500" /> Weak Areas
        </h2>
        <span className="rounded-full border border-amber-200/60 bg-amber-50/70 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          Topics below 60%
        </span>
      </div>
      <div className="flex-1 px-4 pb-4 pt-1">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-emerald-200/60 bg-emerald-50/30 py-6 text-center text-slate-400">
            <CheckCircle2 size={26} className="mx-auto mb-2 text-emerald-400" />
            <p className="text-xs font-semibold">All topics on track</p>
          </div>
        ) : (
          <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between border-b border-slate-100/60 py-2 last:border-0">
                <div className="min-w-0 mr-3">
                  <p className="truncate text-sm font-medium text-slate-700">{item.topicTitle}</p>
                  <p className="text-[11px] text-slate-400">{item.subject} · {item.studentId?.name || 'Student'}</p>
                </div>
                <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${concernColor(item.score)}`}>{item.score}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

// ── Teacher Remarks Feed ──────────────────────────────────────────────────────
const RemarksFeedCard = () => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [remarks, setRemarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    parentApiJson('/api/parent-dashboard/remarks-feed', {}, navigate)
      .then((d) => setRemarks(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [navigate]);

  const concernBadge = {
    low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    high: 'bg-red-50 text-red-700 border-red-100',
    urgent: 'bg-red-100 text-red-800 border-red-200 font-black',
  };

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <BookOpen size={14} className="text-blue-500" /> Teacher Remarks
        </h2>
        <span className="rounded-full border border-emerald-200/60 bg-emerald-50/70 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Latest</span>
      </div>
      <div className="flex-1 px-4 pb-4 pt-1">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
        ) : remarks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200/60 bg-slate-50 py-6 text-center text-slate-400">
            <MessageCircle size={26} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs font-semibold">No remarks yet</p>
          </div>
        ) : (
          <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
            {remarks.map((r, i) => (
              <motion.div key={i} whileHover={prefersReducedMotion ? undefined : { x: 3 }} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 transition hover:bg-white">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{r.studentName}</p>
                    <p className="text-[11px] text-slate-400">{new Date(r.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {r.category && (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 uppercase">{r.category}</span>
                    )}
                    {r.concernLevel && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border uppercase ${concernBadge[r.concernLevel] || concernBadge.low}`}>{r.concernLevel}</span>
                    )}
                  </div>
                </div>
                <p className={`text-xs leading-relaxed text-slate-600 ${expanded === i ? '' : 'line-clamp-2'}`}>{r.observationText}</p>
                {r.observationText?.length > 100 && (
                  <button onClick={() => setExpanded(expanded === i ? null : i)} className="mt-1 text-[11px] font-bold text-indigo-500 flex items-center gap-0.5">
                    {expanded === i ? <><ChevronUp size={10} /> Less</> : <><ChevronDown size={10} /> More</>}
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

// ── AI report cards ──────────────────────────────────────────────────────────
// All three cards self-load their most recent cached report on mount. The server
// only regenerates (an LLM call) when its cache is stale or "Refresh" forces it.
const relativeTime = (value) => {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

const ReportSkeleton = () => (
  <div className="mt-2 space-y-2" aria-hidden="true">
    <div className="h-2.5 w-3/4 animate-pulse rounded bg-slate-200" />
    <div className="h-2.5 w-full animate-pulse rounded bg-slate-200" />
    <div className="h-2.5 w-5/6 animate-pulse rounded bg-slate-200" />
  </div>
);

const useAiReport = (path, navigate) => {
  const [content, setContent] = useState('');
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError('');
    try {
      const d = await parentApiJson(`${path}${force ? '?refresh=1' : ''}`, {}, navigate);
      setContent(d.data?.content || '');
      setGeneratedAt(d.data?.generatedAt || null);
      if (!d.data?.content) setError('No report available yet — check back after more classwork is recorded.');
    } catch (err) {
      setError(err.message || 'Couldn’t load this report.');
    } finally {
      setLoading(false);
    }
  }, [path, navigate]);

  useEffect(() => { load(false); }, [load]);

  return { content, generatedAt, loading, error, refresh: () => load(true) };
};

const AiReportCard = ({ title, Icon, palette, studentName, path }) => {
  const navigate = useNavigate();
  const { content, generatedAt, loading, error, refresh } = useAiReport(path, navigate);
  const lines = content.split('\n').filter(Boolean);
  const showSkeleton = loading && !content;

  return (
    <div aria-label={`${title} for ${studentName}`} className={`rounded-lg border ${palette.border} ${palette.bg} p-3`}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={15} className={palette.icon} aria-hidden="true" />
          <p className={`text-xs font-semibold ${palette.heading}`}>{title}</p>
        </div>
        {(content || error) && (
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 transition hover:bg-white hover:text-slate-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            Refresh
          </button>
        )}
      </div>

      {generatedAt && !showSkeleton && (
        <p className="text-[11px] text-slate-400">Updated {relativeTime(generatedAt)}</p>
      )}

      {showSkeleton && <ReportSkeleton />}

      {content && !showSkeleton && (
        <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto pr-1">
          {lines.map((line, i) => (
            <p key={i} className={`text-xs leading-relaxed ${line.startsWith('##') ? palette.h2 : line.startsWith('•') || line.startsWith('-') ? palette.bullet : palette.body}`}>
              {line.replace(/^##\s*/, '')}
            </p>
          ))}
        </div>
      )}

      {error && !loading && !content && (
        <p role="status" className="mt-2 text-[11px] text-slate-500">{error}</p>
      )}
    </div>
  );
};

const HomeSupportCard = ({ studentId, studentName }) => (
  <AiReportCard
    title="Home Support"
    Icon={Lightbulb}
    studentName={studentName}
    path={`/api/parent-dashboard/home-support/${studentId}`}
    palette={{
      border: 'border-slate-200', bg: 'bg-slate-50', icon: 'text-violet-600', heading: 'text-slate-800',
      body: 'text-slate-600', h2: 'font-bold text-slate-800 mt-2', bullet: 'pl-3 text-slate-600',
    }}
  />
);

const AIDigestCard = ({ studentId, studentName, type }) => {
  const isWeekly = type === 'weekly';
  return (
    <AiReportCard
      title={isWeekly ? 'Weekly Digest' : 'Monthly Report'}
      Icon={isWeekly ? TrendingUp : FileText}
      studentName={studentName}
      path={`/api/parent-dashboard/${isWeekly ? 'weekly-digest' : 'monthly-report'}/${studentId}`}
      palette={isWeekly
        ? { border: 'border-indigo-200', bg: 'bg-indigo-50/60', icon: 'text-indigo-600', heading: 'text-indigo-900', body: 'text-indigo-800', h2: 'font-bold text-indigo-900 mt-2', bullet: 'pl-3 text-indigo-800' }
        : { border: 'border-violet-200', bg: 'bg-violet-50', icon: 'text-violet-600', heading: 'text-violet-900', body: 'text-violet-800', h2: 'font-bold text-violet-900 mt-2', bullet: 'pl-3 text-violet-800' }}
    />
  );
};

const ParentDashboard = ({
  parentName,
  onOpenSidebar,
}) => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [childrenData, setChildrenData] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [feeSummary, setFeeSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const tick = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Auth token missing');

        const [attendanceRes, meetingsRes, feeRes] = await Promise.all([
          parentApiFetch('/api/attendance/parent/children', {}, navigate),
          parentApiFetch('/api/meeting/parent/my-meetings', {}, navigate),
          parentApiFetch('/api/fees/parent/summary', {}, navigate),
        ]);

        if (attendanceRes.ok) {
          const attendance = await attendanceRes.json();

          // Merge data to get rich child info
          const children = (attendance.children || []).map(mapAttendanceChildForDashboard);
          setChildrenData(children);
        } else {
          throw new Error('attendance');
        }

        if (meetingsRes.ok) {
          const data = await meetingsRes.json();
          setMeetings(Array.isArray(data) ? data : []);
        }

        if (feeRes.ok) {
          setFeeSummary(await feeRes.json());
        }
        setLastUpdatedAt(new Date());
      } catch (err) {
        if (err?.code === 'expired') return;
        console.error('Dashboard fetch error:', err);
        setError('Failed to refresh dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  const getGreeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const avgAttendance = useMemo(() => {
    if (!childrenData.length) return 0;
    const sum = childrenData.reduce((acc, c) => acc + (c.attendancePercentage || 0), 0);
    return Math.round(sum / childrenData.length);
  }, [childrenData]);

  const upcomingMeetings = useMemo(() => 
    meetings
      .filter(m => new Date(m.meetingDate) >= new Date())
      .sort((a, b) => new Date(a.meetingDate) - new Date(b.meetingDate))
      .slice(0, 3),
    [meetings]
  );

  const formatMeetingDate = useCallback((dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }, []);

  const academicSession = useMemo(() => {
    const year = currentTime.getFullYear();
    const startYear = currentTime.getMonth() >= 3 ? year : year - 1;
    return `${startYear}–${startYear + 1} Session`;
  }, [currentTime]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) return loading ? 'Refreshing now' : 'Update unavailable';
    return `Today, ${lastUpdatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }, [lastUpdatedAt, loading]);

  const statsData = useMemo(() => {
    const nextMeeting = upcomingMeetings[0];
    const openInvoices = Number(feeSummary?.openInvoiceCount || 0);
    const pendingAmount = Number(feeSummary?.outstandingAmount || 0);

    return [
      {
        id: 'attendance',
        label: 'Monthly attendance',
        value: `${avgAttendance}%`,
        sub: 'Current month · across all children',
        icon: Calendar,
        iconClass: 'bg-emerald-50 text-emerald-600',
        valueClass: 'text-slate-800',
      },
      {
        id: 'ptms',
        label: 'Upcoming meetings',
        value: String(upcomingMeetings.length),
        sub: nextMeeting ? `Next ${formatMeetingDate(nextMeeting.meetingDate)}` : 'None scheduled',
        icon: Video,
        iconClass: 'bg-amber-50 text-amber-600',
        valueClass: 'text-slate-800',
      },
      {
        id: 'children',
        label: 'Linked children',
        value: String(childrenData.length),
        sub: childrenData.length ? 'Active profiles' : 'None linked yet',
        icon: Users,
        iconClass: 'bg-violet-50 text-violet-600',
        valueClass: 'text-slate-800',
      },
      {
        id: 'invoices',
        label: 'Open invoices',
        value: String(openInvoices),
        sub: openInvoices ? `₹${pendingAmount.toLocaleString('en-IN')} due` : 'All fees cleared',
        icon: CreditCard,
        iconClass: openInvoices ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600',
        valueClass: openInvoices ? 'text-rose-600' : 'text-slate-800',
      },
    ];
  }, [avgAttendance, childrenData.length, feeSummary, formatMeetingDate, upcomingMeetings]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : { staggerChildren: 0.08, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 18 },
    visible: {
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : { type: 'spring', stiffness: 300, damping: 24 },
    },
  };

  if (loading && childrenData.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50" aria-busy="true" aria-live="polite">
        <Loader2 size={40} className="animate-spin text-violet-600" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-500">Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-slate-50 p-2 sm:p-4 lg:p-6">
        <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden="true">
          <motion.div
            className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-purple-300/30 blur-3xl sm:h-96 sm:w-96"
            animate={prefersReducedMotion ? undefined : { x: [0, -32, 0], y: [0, 24, 0] }}
            transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-300/30 blur-3xl sm:h-80 sm:w-80"
            animate={prefersReducedMotion ? undefined : { x: [0, 32, 0], y: [0, -24, 0] }}
            transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut', delay: 2 }}
          />
          <motion.div
            className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-300/10 blur-3xl"
            animate={prefersReducedMotion ? undefined : { scale: [1, 1.2, 1], x: [0, 18, 0], y: [0, -18, 0] }}
            transition={{ repeat: Infinity, duration: 16, ease: 'easeInOut', delay: 0.5 }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: 'easeOut' }}
          className="w-full rounded-[1.75rem] border border-white/80 bg-white/60 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur-xl sm:p-6 lg:p-8"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/60 pb-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <motion.button
                type="button"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                onClick={onOpenSidebar}
                className="-ml-1.5 rounded-lg p-1.5 text-slate-500 transition hover:bg-white/60 lg:hidden"
                aria-label="Open parent navigation"
              >
                <Menu size={20} />
              </motion.button>
              <div className="flex items-center gap-3">
                <motion.div
                  className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 sm:text-xs"
                  animate={prefersReducedMotion ? undefined : { opacity: [0.8, 1, 0.8] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                >
                  <span className="relative flex h-2.5 w-2.5">
                    {!prefersReducedMotion && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/30" />
                  </span>
                  Portal Active
                </motion.div>
                <span className="hidden text-xs text-slate-300 sm:inline">·</span>
                <span className="hidden rounded-full border border-white/60 bg-white/40 px-3 py-1 text-xs font-medium text-slate-500 backdrop-blur-sm sm:inline">
                  {currentTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-7 sm:mb-8">
            <motion.h1
              initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.15, duration: prefersReducedMotion ? 0 : 0.5 }}
              className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl lg:text-4xl"
            >
              {getGreeting()}, <br className="sm:hidden" />
              <span className="bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">{parentName || 'Parent Account'}</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.25, duration: prefersReducedMotion ? 0 : 0.5 }}
              className="mt-1 max-w-xl text-sm text-slate-500 sm:text-base"
            >
              Track academic progress, monitor wellbeing, and stay connected with the institution.
            </motion.p>
          </div>

          {error && (
            <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </motion.div>
      </section>

      <motion.section
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: 'easeOut' }}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-800">Your children</h2>
          <span className="text-xs font-medium text-slate-400">
            Updated {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {childrenData.length === 0 ? (
            <motion.div variants={itemVariants} className="md:col-span-2 rounded-xl border border-dashed border-slate-200/60 bg-slate-50 py-10 text-center text-slate-400">
              <UserIcon size={38} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold">No active student profiles linked</p>
            </motion.div>
          ) : childrenData.map((child) => (
            <motion.article
              key={child._id}
              variants={itemVariants}
              whileHover={prefersReducedMotion ? undefined : { y: -4 }}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md md:col-span-2"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-600 text-base font-bold text-white shadow-md shadow-violet-500/20">
                  {getInitials(child.name)}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-slate-800">{child.name}</h3>
                  <p className="truncate text-xs text-slate-500">
                    Class {child.grade} {child.section} · {formatStudentDisplay({ username: child.username, studentCode: child.studentCode, roll: child.roll })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="flex min-h-16 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center">
                  <span className="text-base font-bold text-violet-600">{child.attendancePercentage}%</span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><Calendar size={12} /> Monthly attendance</span>
                </div>
                <Link to="/parents/routine" className="flex min-h-16 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center transition hover:-translate-y-0.5 hover:bg-white">
                  <span className="text-base font-bold text-emerald-600">View</span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><Clock size={12} /> Routine</span>
                </Link>
                <Link to="/parents/academic" className="flex min-h-16 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center transition hover:-translate-y-0.5 hover:bg-white">
                  <span className="text-base font-bold text-violet-600">View</span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><Award size={12} /> Report card</span>
                </Link>
              </div>
            </motion.article>
          ))}

          <motion.div variants={itemVariants}><WeakAreasCard /></motion.div>
          <motion.div variants={itemVariants}><RemarksFeedCard /></motion.div>

          <motion.section variants={itemVariants} className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"><Calendar size={14} /> Upcoming Events</h3>
            {upcomingMeetings.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200/50 bg-slate-50 py-5 text-center">
                <Video size={28} className="mb-2 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">No meetings scheduled</p>
                <p className="text-xs text-slate-400">Check back later for updates</p>
              </div>
            ) : (
              <div className="flex-1 space-y-2">
                {upcomingMeetings.map((meeting) => (
                  <div key={meeting._id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-700">{meeting.title || meeting.topic || 'Parent-teacher meeting'}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400"><Clock size={10} /> {formatMeetingDate(meeting.meetingDate)} · {meeting.meetingTime}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${meeting.status === 'confirmed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{String(meeting.status || 'pending').replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link to="/parents/ptm" className="mt-2 inline-flex items-center justify-end text-xs font-semibold text-violet-600 hover:text-violet-700">View All Meetings <ChevronRight size={14} /></Link>
          </motion.section>

          <motion.section variants={itemVariants} className="flex h-full flex-col rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600"><LifeBuoy size={17} /></div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Need technical assistance?</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">Our support team can help with portal navigation or student records.</p>
              </div>
            </div>
            <Link to="/parents/complaints" className="mt-auto self-start rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-violet-600/20 transition hover:bg-violet-700">Contact Support</Link>
          </motion.section>

          {childrenData.length > 0 && (
            <motion.section variants={itemVariants} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"><Sparkles size={14} className="text-violet-500" /> AI-Powered Reports</h3>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-600">Personalized</span>
              </div>
              <div className="space-y-4">
                {childrenData.map((child) => (
                  <div key={child._id}>
                    <p className="mb-2 text-xs text-slate-400">{child.name} · Class {child.grade} {child.section}</p>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <HomeSupportCard studentId={child._id} studentName={child.name} />
                      <AIDigestCard studentId={child._id} studentName={child.name} type="weekly" />
                      <AIDigestCard studentId={child._id} studentName={child.name} type="monthly" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </motion.div>
      </motion.section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-bold tracking-tight text-slate-800">At a glance</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link
            to="/parents/chat"
            className="flex flex-col justify-between rounded-xl border border-violet-200 bg-violet-50 p-4 transition hover:bg-violet-100"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-violet-600 shadow-sm">
              <MessageCircle size={18} aria-hidden="true" />
            </span>
            <span className="mt-3">
              <span className="block text-sm font-bold text-slate-800">Message staff</span>
              <span className="mt-0.5 block text-xs text-slate-500">Open chat</span>
            </span>
          </Link>
          {statsData.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${item.iconClass}`}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="mt-3">
                  <span className={`block text-2xl font-bold leading-none ${item.valueClass || 'text-slate-800'}`}>{item.value}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-600">{item.label}</span>
                  <span className="block text-xs text-slate-400">{item.sub}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-slate-100 pt-6 pb-8 text-center">
        <p className="text-xs font-medium tracking-wide text-slate-400">
          Electronic Educare
        </p>
      </footer>
    </div>
  );
};

export default ParentDashboard;
