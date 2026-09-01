import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Calendar,
  CreditCard,
  Video,
  Clock,
  Users,
  Sparkles,
  TrendingUp,
  Award,
  Bell,
  ChevronRight,
  Loader2,
  CheckCircle2,
  User as UserIcon,
  MessageCircle,
  FileText,
  AlertTriangle,
  BookOpen,
  Home,
  Lightbulb,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatStudentDisplay } from '../utils/studentDisplay';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const authHeader = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

// ── Weak Areas Card ───────────────────────────────────────────────────────────
const WeakAreasCard = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/parent-dashboard/weak-areas`, { headers: authHeader() })
      .then((r) => r.json())
      .then((d) => setItems(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const concernColor = (score) => {
    if (score < 40) return 'bg-red-100 text-red-700 border-red-200';
    if (score < 60) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  };

  return (
    <section className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 bg-red-50/40">
        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
          <AlertTriangle size={18} />
        </div>
        <div>
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Weak Areas</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Topics scoring below 60%</p>
        </div>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
            <p className="text-xs font-bold uppercase tracking-widest">All topics on track!</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {items.map((item, i) => (
              <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${concernColor(item.score)}`}>
                <div className="min-w-0 mr-3">
                  <p className="text-xs font-bold truncate">{item.topicTitle}</p>
                  <p className="text-[10px] font-semibold opacity-70">{item.subject} · {item.studentId?.name || 'Student'}</p>
                </div>
                <span className="text-sm font-black flex-shrink-0">{item.score}%</span>
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
  const [remarks, setRemarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/parent-dashboard/remarks-feed`, { headers: authHeader() })
      .then((r) => r.json())
      .then((d) => setRemarks(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const concernBadge = {
    low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    high: 'bg-red-50 text-red-700 border-red-100',
    urgent: 'bg-red-100 text-red-800 border-red-200 font-black',
  };

  return (
    <section className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
          <BookOpen size={18} />
        </div>
        <div>
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Teacher Remarks</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Latest observations from teachers</p>
        </div>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
        ) : remarks.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <MessageCircle size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">No remarks yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {remarks.map((r, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{r.studentName}</p>
                    <p className="text-[10px] text-slate-400">{new Date(r.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {r.category && (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 uppercase">{r.category}</span>
                    )}
                    {r.concernLevel && (
                      <span className={`text-[9px] px-2 py-0.5 rounded-full border uppercase ${concernBadge[r.concernLevel] || concernBadge.low}`}>{r.concernLevel}</span>
                    )}
                  </div>
                </div>
                <p className={`text-xs text-slate-700 leading-relaxed ${expanded === i ? '' : 'line-clamp-2'}`}>{r.observationText}</p>
                {r.observationText?.length > 100 && (
                  <button onClick={() => setExpanded(expanded === i ? null : i)} className="mt-1 text-[10px] font-bold text-indigo-500 flex items-center gap-0.5">
                    {expanded === i ? <><ChevronUp size={10} /> Less</> : <><ChevronDown size={10} /> More</>}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

// ── Home Support Tips Card ────────────────────────────────────────────────────
const HomeSupportCard = ({ studentId, studentName }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/parent-dashboard/home-support/${studentId}`, { headers: authHeader() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Could not load tips');
      setContent(d.data?.content || '');
    } catch {
      setContent('');
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [studentId]);

  const lines = content.split('\n').filter(Boolean);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Home size={16} className="text-amber-600" />
          <p className="text-xs font-black text-amber-900 uppercase tracking-wider">Home Support — {studentName}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-3 py-1 hover:bg-amber-200 transition disabled:opacity-50"
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <Lightbulb size={10} />}
          {fetched ? 'Refresh' : 'Get Tips'}
        </button>
      </div>
      {content && (
        <div className="space-y-1 mt-2">
          {lines.map((line, i) => (
            <p key={i} className={`text-xs leading-relaxed ${line.startsWith('•') ? 'pl-3 text-amber-800' : 'font-bold text-amber-900 mt-2'}`}>{line}</p>
          ))}
        </div>
      )}
      {!content && !loading && fetched && (
        <p role="alert" className="text-xs text-amber-700 mt-2">Could not load tips. Please try again.</p>
      )}
      {!fetched && !loading && (
        <p className="text-[11px] text-amber-700 mt-1">Click "Get Tips" to see AI-generated home support suggestions for this student.</p>
      )}
    </div>
  );
};

// ── AI Digest Card (weekly / monthly) ────────────────────────────────────────
const AIDigestCard = ({ studentId, studentName, type }) => {
  const [content, setContent] = useState('');
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [loadError, setLoadError] = useState('');

  const endpoint = type === 'weekly' ? 'weekly-digest' : 'monthly-report';
  const label = type === 'weekly' ? 'Weekly Digest' : 'Monthly Report';
  const Icon = type === 'weekly' ? TrendingUp : FileText;
  const color = type === 'weekly' ? 'indigo' : 'purple';

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setLoadError('');
    try {
      const r = await fetch(`${API_BASE}/api/parent-dashboard/${endpoint}/${studentId}`, { headers: authHeader() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'The report could not be generated right now.');
      setContent(d.data?.content || '');
      setGeneratedAt(d.data?.generatedAt);
      if (!d.data?.content) setLoadError('No report content was returned. Please try again.');
    } catch (err) {
      setLoadError(err.message || 'The report could not be generated right now.');
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [studentId, endpoint]);

  const lines = content.split('\n').filter(Boolean);

  const colorMap = {
    indigo: { border: 'border-indigo-200', bg: 'bg-indigo-50/60', icon: 'text-indigo-600', heading: 'text-indigo-900', body: 'text-indigo-800', btn: 'text-indigo-700 bg-indigo-100 border-indigo-200 hover:bg-indigo-200', h2: 'font-black text-indigo-900 mt-2', bullet: 'pl-3 text-indigo-800' },
    purple: { border: 'border-purple-200', bg: 'bg-purple-50/60', icon: 'text-purple-600', heading: 'text-purple-900', body: 'text-purple-800', btn: 'text-purple-700 bg-purple-100 border-purple-200 hover:bg-purple-200', h2: 'font-black text-purple-900 mt-2', bullet: 'pl-3 text-purple-800' },
  }[color];

  return (
    <div className={`rounded-2xl border ${colorMap.border} ${colorMap.bg} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className={colorMap.icon} />
          <div>
            <p className={`text-xs font-black uppercase tracking-wider ${colorMap.heading}`}>{label} — {studentName}</p>
            {generatedAt && <p className="text-[9px] text-slate-400">Generated {new Date(generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className={`flex items-center gap-1 text-[10px] font-black border rounded-full px-3 py-1 transition disabled:opacity-50 ${colorMap.btn}`}
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
          {fetched ? 'Refresh' : 'Generate'}
        </button>
      </div>
      {content && (
        <div className="space-y-0.5 mt-2 max-h-48 overflow-y-auto pr-1">
          {lines.map((line, i) => (
            <p key={i} className={`text-xs leading-relaxed ${line.startsWith('##') ? colorMap.h2 : line.startsWith('•') || line.startsWith('-') ? colorMap.bullet : colorMap.body}`}>
              {line.replace(/^##\s*/, '')}
            </p>
          ))}
        </div>
      )}
      {!content && !loading && !fetched && (
        <p className={`text-[11px] mt-1 ${colorMap.body}`}>Click "Generate" to create an AI-powered {label.toLowerCase()} for this student.</p>
      )}
      {loadError && !loading && (
        <p role="alert" className="text-[11px] mt-1 text-rose-600">{loadError}</p>
      )}
    </div>
  );
};

const ParentDashboard = ({ parentName }) => {
  const prefersReducedMotion = useReducedMotion();
  const [currentTime, setCurrentTime] = useState(new Date());
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
          fetch(`${API_BASE}/api/attendance/parent/children`, { headers: authHeader() }),
          fetch(`${API_BASE}/api/meeting/parent/my-meetings`, { headers: authHeader() }),
          fetch(`${API_BASE}/api/fees/parent/summary`, { headers: authHeader() }),
        ]);

        if (attendanceRes.ok) {
          const attendance = await attendanceRes.json();

          // Merge data to get rich child info
          const children = (attendance.children || []).map(c => ({
            ...c.student,
            attendancePercentage: c.summary?.attendancePercentage || 0,
            presentDays: c.summary?.presentDays || 0,
            totalDays: c.summary?.totalClasses || 0,
          }));
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
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError('Failed to refresh dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

  const statsData = useMemo(() => {
    const nextMeeting = upcomingMeetings[0];
    const openInvoices = Number(feeSummary?.openInvoiceCount || 0);
    const pendingAmount = Number(feeSummary?.outstandingAmount || 0);

    return [
      {
        id: 'attendance',
        label: 'Avg Attendance',
        value: `${avgAttendance}%`,
        sub: 'Across all wards',
        icon: Calendar,
        iconClass: 'bg-emerald-100/80 text-emerald-600',
      },
      {
        id: 'ptms',
        label: 'Upcoming PTMs',
        value: nextMeeting ? 'Scheduled ahead' : 'No meetings',
        sub: nextMeeting ? `Next: ${formatMeetingDate(nextMeeting.meetingDate)}` : 'Nothing scheduled',
        icon: Video,
        iconClass: 'bg-amber-100/80 text-amber-600',
        valueClass: nextMeeting ? 'text-amber-600' : 'text-slate-700',
      },
      {
        id: 'children',
        label: 'Linked Children',
        value: childrenData.length ? 'Active profiles' : 'No profiles',
        sub: `${childrenData.length} ${childrenData.length === 1 ? 'child' : 'children'} linked`,
        icon: Users,
        iconClass: 'bg-emerald-100/80 text-emerald-600',
        valueClass: childrenData.length ? 'text-emerald-600' : 'text-slate-700',
      },
      {
        id: 'invoices',
        label: 'Open Invoices',
        value: openInvoices ? `${openInvoices} open` : 'All fees cleared',
        sub: openInvoices ? `₹${pendingAmount.toLocaleString('en-IN')} pending` : '₹0 pending',
        icon: CreditCard,
        iconClass: openInvoices ? 'bg-rose-100/80 text-rose-600' : 'bg-emerald-100/80 text-emerald-600',
        valueClass: openInvoices ? 'text-rose-600' : 'text-emerald-600',
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
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-slate-50">
        <Loader2 size={48} className="animate-spin text-indigo-600" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Constructing Portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-2 sm:p-4 lg:p-6 space-y-8 max-w-7xl mx-auto">
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
        </div>

        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: 'easeOut' }}
          className="w-full rounded-[1.75rem] border border-white/80 bg-white/60 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur-xl sm:p-6 lg:p-8"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600 sm:text-xs">
                <motion.span
                  className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/30"
                  animate={prefersReducedMotion ? undefined : { scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                />
                Portal Active
              </div>
              <span className="text-xs text-slate-300">·</span>
              <span className="text-[11px] font-medium text-slate-500 sm:text-xs">
                {currentTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-white/70 bg-white/50 px-3 py-1.5 text-[11px] font-medium text-slate-500 shadow-sm backdrop-blur-sm sm:px-4 sm:text-xs">
              <Calendar size={14} aria-hidden="true" /> {academicSession}
            </div>
          </div>

          <div className="mb-7 sm:mb-8">
            <motion.h1
              initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.15, duration: prefersReducedMotion ? 0 : 0.5 }}
              className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl"
            >
              {getGreeting()}, <span className="text-purple-600">{parentName || 'Parent Account'}</span>
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

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
          >
            <motion.div
              variants={itemVariants}
              whileHover={prefersReducedMotion ? undefined : { y: -4 }}
              className="flex min-h-[140px] flex-col justify-between rounded-2xl border border-purple-200/60 bg-purple-50/60 p-5 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100/80 text-purple-600">
                  <MessageCircle size={19} aria-hidden="true" />
                </span>
                Staff Chat
              </div>
              <div>
                <p className="mb-2 text-sm text-slate-500">Connect with teachers</p>
                <Link
                  to="/parents/chat"
                  className="inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-purple-600/20 transition hover:bg-purple-700 active:scale-95"
                >
                  Open <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </motion.div>

            {statsData.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.id}
                  variants={itemVariants}
                  whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                  className="flex min-h-[140px] flex-col justify-between rounded-2xl border border-white/70 bg-white/45 p-5 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.iconClass}`}>
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    {item.label}
                  </div>
                  <div>
                    <p className={`text-lg font-bold leading-tight ${item.valueClass || 'text-slate-800'}`}>{item.value}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.sub}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </section>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Children Status Roster */}
        <div className="lg:col-span-8 space-y-8">
          <section className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                  <Users size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Ward Overview</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Student Status</p>
                </div>
              </div>
            </div>
            
            <div className="p-8">
              {childrenData.length === 0 ? (
                <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl">
                  <UserIcon size={48} className="mx-auto mb-4 opacity-10" />
                  <p className="text-sm font-bold uppercase tracking-widest">No active student profiles linked</p>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {childrenData.map((child) => (
                    <div key={child._id} className="group relative border border-slate-100 rounded-[2rem] p-6 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm transition-transform group-hover:scale-110 group-hover:-rotate-6">
                          <UserIcon size={28} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-black text-slate-900 truncate">
                            {child.name}
                          </h3>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                            {child.grade} {child.section} • {formatStudentDisplay({ username: child.username, studentCode: child.studentCode, roll: child.roll }).split('• ID: ')[1]}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                              <Calendar size={10} /> Attendance
                            </span>
                            <span className="text-sm font-black text-slate-900">{child.attendancePercentage}%</span>
                          </div>
                          <div
                            className="w-full h-2 bg-slate-200 rounded-full overflow-hidden"
                            role="progressbar"
                            aria-valuenow={Math.round(child.attendancePercentage)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${child.name} attendance`}
                          >
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${
                                child.attendancePercentage >= 85 ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${child.attendancePercentage}%` }}
                            />
                          </div>
                        </div>

                        <div className="pt-4 grid grid-cols-2 gap-3 border-t border-slate-100/50">
                          <Link to="/parents/routine" className="flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                            <Clock size={12} /> Routine
                          </Link>
                          <Link to="/parents/results" className="flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                            <Award size={12} /> Results
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Side: Quick Links & Meetings */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Bell size={16} className="text-indigo-500" />
                Upcoming Events
              </h2>
            </div>
            
            <div className="p-6">
              {upcomingMeetings.length === 0 ? (
                <div className="text-center py-12 px-6 text-slate-400">
                  <Video size={32} className="mx-auto mb-3 opacity-10" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No meetings scheduled</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingMeetings.map((meeting) => (
                    <div key={meeting._id} className="group relative p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0 group-hover:scale-110 transition-transform">
                          <Calendar size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate pr-16">{meeting.title || meeting.topic}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                            <Clock size={10} /> {formatMeetingDate(meeting.meetingDate)} • {meeting.meetingTime}
                          </p>
                        </div>
                      </div>
                      <span className={`absolute top-4 right-4 text-[8px] font-black px-2 py-0.5 rounded-full border ${
                        meeting.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {String(meeting.status || 'pending').replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              <Link to="/parents/ptm" className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-slate-50 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-900 hover:text-white transition-all group">
                View All Meetings <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </section>

          <section className="bg-indigo-600 rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10 space-y-4">
              <h3 className="text-xl font-black leading-tight">Need technical assistance?</h3>
              <p className="text-indigo-100 text-xs font-medium leading-relaxed">
                Our support team is available 24/7 to help you with portal navigation or student records.
              </p>
              <Link to="/parents/complaints" className="block text-center w-full bg-white text-indigo-600 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all active:scale-95 shadow-lg shadow-indigo-900/20">
                Open Support Ticket
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* Section 6C — Parent Dashboard Tracking */}
      <section className="grid gap-6 lg:grid-cols-2">
        <WeakAreasCard />
        <RemarksFeedCard />
      </section>

      {/* Per-child AI reports */}
      {childrenData.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-500" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">AI-Powered Reports</h2>
          </div>
          {childrenData.map((child) => (
            <div key={child._id} className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-6 space-y-4">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <UserIcon size={12} /> {child.name} · Class {child.grade} {child.section}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <HomeSupportCard studentId={child._id} studentName={child.name} />
                <AIDigestCard studentId={child._id} studentName={child.name} type="weekly" />
                <AIDigestCard studentId={child._id} studentName={child.name} type="monthly" />
              </div>
            </div>
          ))}
        </section>
      )}

      <footer className="text-center pb-8 border-t border-slate-100 pt-8">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
          Electronic Educare • Unified Parent Experience
        </p>
      </footer>
    </div>
  );
};

export default ParentDashboard;
