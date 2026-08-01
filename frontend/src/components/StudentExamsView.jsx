import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Calendar, FileText, Loader2, Clock, CheckCircle2, Sparkles, Users, Search as SearchIcon, AlertCircle, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { useStudentDashboard } from './StudentDashboardContext';
import { fetchCachedJson } from '../utils/studentApiCache';
import { generateExamSchedulePdf, buildRoomLabel } from '../utils/examRoutinePdf';
import MockExamView from './MockExamView';
import WrongAnswerReviewView from './WrongAnswerReviewView';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const STUDENT_EXAMS_ENDPOINT = `${API_BASE}/api/exam/groups/student-schedule`;
const STUDENT_EXAMS_CACHE_TTL_MS = 2 * 60 * 1000;

const TERM_OPTIONS = ['all', 'Class Test', 'Unit Test', 'Monthly Test', 'Term 1', 'Term 2', 'Term 3', 'Half Yearly', 'Annual', 'Final'];
const STATUS_OPTIONS = ['all', 'scheduled', 'completed'];

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatFullDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const parseExamDateTime = (dateStr, timeStr) => {
  if (!dateStr) return null;
  let d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    const parts = String(dateStr).split('/');
    if (parts.length === 3) d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
  }
  if (Number.isNaN(d.getTime())) return null;

  if (timeStr) {
    const m = String(timeStr).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (m) {
      let h = parseInt(m[1], 10);
      const mins = parseInt(m[2], 10);
      const ampm = m[3]?.toUpperCase();
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      d.setHours(h, mins, 0, 0);
    }
  }
  return d;
};

const calcTimeLeft = (target) => {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
};

const useCountdown = (target) => {
  const compute = useCallback(() => calcTimeLeft(target), [target]);
  const [t, setT] = useState(compute);
  useEffect(() => {
    setT(compute());
    const id = setInterval(() => setT(compute()), 1000);
    return () => clearInterval(id);
  }, [compute]);
  return t;
};

const daysUntil = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
};

// ── Days-until pill ─────────────────────────────────────────────────────────
const CountdownBadge = ({ date }) => {
  const days = daysUntil(date);
  if (days === null || days < 0) return null;
  const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${days <= 1 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>
      {label}
    </span>
  );
};

// ── Flip Digit Unit ───────────────────────────────────────────────────────────
const FlipUnit = ({ value, label }) => {
  const padded = String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-16 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 shadow-inner sm:h-20 sm:w-16">
        {/* top/bottom split line */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-black/20 z-10" />
        <AnimatePresence mode="popLayout" initial={false}>
          <Motion.span
            key={padded}
            initial={{ y: '-60%', opacity: 0, scale: 0.85 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: '60%', opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="absolute text-3xl font-black text-white tabular-nums tracking-tight select-none sm:text-4xl"
          >
            {padded}
          </Motion.span>
        </AnimatePresence>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/70">{label}</span>
    </div>
  );
};

// ── Hero Countdown Card ───────────────────────────────────────────────────────
const HeroCountdownCard = ({ group }) => {
  const target = useMemo(
    () => parseExamDateTime(group.startDate, group.startTime),
    [group.startDate, group.startTime]
  );
  const t = useCountdown(target);

  if (!target) return null;

  const isToday = daysUntil(group.startDate) === 0;
  const isStarted = !t;

  return (
    <Motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 shadow-2xl shadow-indigo-300/40">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/10 blur-xl" />
        <div className="pointer-events-none absolute right-1/3 bottom-0 h-24 w-24 rounded-full bg-purple-400/20 blur-lg" />

        <CardContent className="relative z-10 p-5 sm:p-7">
          {/* label row */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">Next Exam Countdown</p>
              <p className="text-sm font-bold text-white leading-tight">{group.title || group.term}</p>
            </div>
            {isToday && (
              <Motion.span
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="ml-auto rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-black text-white shadow-lg"
              >
                TODAY
              </Motion.span>
            )}
          </div>

          {isStarted ? (
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 py-4"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/20">
                <CheckCircle2 className="h-7 w-7 text-emerald-300" />
              </div>
              <div>
                <p className="text-xl font-black text-white">Exam In Progress</p>
                <p className="text-sm text-white/70">Good luck! Do your best.</p>
              </div>
            </Motion.div>
          ) : (
            <div className="flex items-center justify-center gap-3 sm:gap-4 py-2">
              <FlipUnit value={t.days}    label="Days"    />
              <span className="mb-6 text-2xl font-black text-white/40 sm:text-3xl">:</span>
              <FlipUnit value={t.hours}   label="Hours"   />
              <span className="mb-6 text-2xl font-black text-white/40 sm:text-3xl">:</span>
              <FlipUnit value={t.minutes} label="Minutes" />
              <span className="mb-6 text-2xl font-black text-white/40 sm:text-3xl">:</span>
              <FlipUnit value={t.seconds} label="Seconds" />
            </div>
          )}

          {/* date + time footer */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
              <Calendar className="h-3.5 w-3.5" />
              {formatFullDate(group.startDate)}
            </span>
            {group.startTime && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
                <Clock className="h-3.5 w-3.5" />
                {group.startTime}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Motion.div>
  );
};

// ── Inline mini-countdown badge ───────────────────────────────────────────────
const MiniCountdown = ({ dateStr, timeStr }) => {
  const target = useMemo(() => parseExamDateTime(dateStr, timeStr), [dateStr, timeStr]);
  const t = useCountdown(target);
  if (!t) return <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 font-bold text-[11px]">Started</Badge>;
  const pad = (n) => String(n).padStart(2, '0');
  const label = t.days > 0
    ? `${t.days}d ${pad(t.hours)}:${pad(t.minutes)}:${pad(t.seconds)}`
    : `${pad(t.hours)}:${pad(t.minutes)}:${pad(t.seconds)}`;
  return (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 font-bold text-[11px] gap-1">
      <Clock className="h-3 w-3 text-amber-500" />
      {label}
    </Badge>
  );
};

// ── Subject palette ───────────────────────────────────────────────────────────
const SUBJECT_PALETTE = [
  { bg: 'bg-indigo-50',   border: 'border-indigo-200',  text: 'text-indigo-700',  dot: 'bg-indigo-500'  },
  { bg: 'bg-sky-50',      border: 'border-sky-200',     text: 'text-sky-700',     dot: 'bg-sky-500'     },
  { bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { bg: 'bg-fuchsia-50',  border: 'border-fuchsia-200', text: 'text-fuchsia-700', dot: 'bg-fuchsia-500' },
  { bg: 'bg-rose-50',     border: 'border-rose-200',    text: 'text-rose-700',    dot: 'bg-rose-500'    },
  { bg: 'bg-violet-50',   border: 'border-violet-200',  text: 'text-violet-700',  dot: 'bg-violet-500'  },
  { bg: 'bg-teal-50',     border: 'border-teal-200',    text: 'text-teal-700',    dot: 'bg-teal-500'    },
  { bg: 'bg-orange-50',   border: 'border-orange-200',  text: 'text-orange-700',  dot: 'bg-orange-500'  },
];
const getSubjectStyle = (name) => {
  let hash = 0;
  for (let i = 0; i < String(name || '').length; i++) hash = (hash * 31 + String(name).charCodeAt(i)) >>> 0;
  return SUBJECT_PALETTE[hash % SUBJECT_PALETTE.length];
};

// ── Stat Tile ─────────────────────────────────────────────────────────────────
const StatTile = (props) => {
  const { icon, label, value, sub, grad, shadow } = props;
  const Icon = icon;
  return (
  <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${grad} p-3.5 shadow-lg ${shadow} transition-transform hover:-translate-y-0.5 md:p-4`}>
    <div className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
    <div className="relative z-10">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold text-white/80">{label}</p>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <p className="mt-1.5 text-lg font-black text-white leading-tight truncate md:text-xl">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-white/70 truncate">{sub}</p>}
    </div>
  </div>
  );
};

// ── Main View ─────────────────────────────────────────────────────────────────
const StudentExamsView = () => {
  const { profile } = useStudentDashboard();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [termFilter, setTermFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [downloadingGroupId, setDownloadingGroupId] = useState('');
  const [mockExamOpen, setMockExamOpen] = useState(null); // { examId, examTitle, durationMinutes }
  const [reviewExam, setReviewExam] = useState(null);     // { examId, examTitle }

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setError('Please login as student.'); setLoading(false); return; }
      setLoading(true);
      setError('');
      try {
        const { data } = await fetchCachedJson(STUDENT_EXAMS_ENDPOINT, {
          ttlMs: STUDENT_EXAMS_CACHE_TTL_MS,
          fetchOptions: { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
        });
        setGroups(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load exam schedule');
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      const termMatches   = termFilter   === 'all' || String(g?.term   || '') === termFilter;
      const statusMatches = statusFilter === 'all' || String(g?.status || '').toLowerCase() === statusFilter;
      const queryMatches  = !q || [g?.title, g?.term, g?.grade, g?.section].some((v) => String(v || '').toLowerCase().includes(q));
      return termMatches && statusMatches && queryMatches;
    });
  }, [groups, search, statusFilter, termFilter]);

  const { stats, nextGroup } = useMemo(() => {
    const total     = groups.length;
    const completed = groups.filter((g) => String(g?.status || '').toLowerCase() === 'completed').length;
    const scheduled = total - completed;
    const upcoming  = groups
      .filter((g) => String(g?.status || '').toLowerCase() !== 'completed')
      .map((g) => ({ g, dt: parseExamDateTime(g.startDate, g.startTime) }))
      .filter((e) => e.dt && e.dt > new Date())
      .sort((a, b) => a.dt - b.dt);
    return {
      stats: { total, completed, scheduled, next: upcoming[0]?.g || null },
      nextGroup: upcoming[0]?.g || null,
    };
  }, [groups]);

  const pdfHeader = useMemo(() => ({
    schoolName: String(profile?.schoolName || '').trim(),
    schoolAddressLine: String(profile?.schoolAddress || '').trim(),
    logoUrl: String(profile?.schoolLogo || '').trim(),
  }), [profile]);

  const handleDownload = async (group) => {
    try {
      setDownloadingGroupId(String(group?._id || ''));
      await generateExamSchedulePdf(group, pdfHeader);
      toast.success('Exam routine downloaded');
    } catch (err) {
      toast.error(err.message || 'Failed to download exam routine');
    } finally {
      setDownloadingGroupId('');
    }
  };

  return (
    <>
    <div className="min-h-screen bg-slate-50 space-y-5 p-4 pb-8 md:p-6">
      {/* page header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 p-5 shadow-lg shadow-indigo-200/60 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">Exams</h1>
            <p className="text-sm text-white/80">View your exam schedule and download the routine</p>
          </div>
        </div>
      </div>

      {/* stat tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={FileText}    label="Total Exams" value={stats.total}     grad="from-blue-500 to-indigo-600"    shadow="shadow-blue-200/60"    />
        <StatTile icon={Clock}       label="Scheduled"   value={stats.scheduled} grad="from-amber-400 to-orange-500"   shadow="shadow-amber-200/60"   />
        <StatTile icon={CheckCircle2}label="Completed"   value={stats.completed} grad="from-emerald-500 to-teal-600"   shadow="shadow-emerald-200/60" />
        <StatTile
          icon={Sparkles}
          label="Next Exam"
          value={stats.next ? (stats.next.title || stats.next.term || 'Exam') : 'None'}
          sub={stats.next ? (() => { const d = daysUntil(stats.next.startDate); return d === 0 ? 'Starts today' : d != null && d >= 0 ? `In ${d}d` : ''; })() : 'No upcoming exam'}
          grad="from-purple-500 to-fuchsia-600"
          shadow="shadow-purple-200/60"
        />
      </div>

      {/* ── Hero Countdown ── */}
      {!loading && nextGroup && <HeroCountdownCard group={nextGroup} />}

      {/* filters */}
      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exam…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition placeholder:text-slate-400"
            />
          </div>
          <select
            value={termFilter}
            onChange={(e) => setTermFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
          >
            {TERM_OPTIONS.map((t) => <option key={t} value={t}>{t === 'all' ? 'All Terms' : t}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </CardContent>
      </Card>

      {/* list */}
      {loading ? (
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-8 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Loading exam schedule…
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-rose-100 bg-rose-50 shadow-sm">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-rose-700">
            <AlertCircle size={15} /> {error}
          </CardContent>
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card className="border-dashed border-slate-200 shadow-sm">
          <CardContent className="p-8 text-center text-sm text-slate-500">No exams found for your schedule.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4 flex justify-center flex-wrap gap-4">
          {filteredGroups.map((group) => {
            const classLabel = group?.classId?.name || group?.grade || '—';
            const sectionLabel = group?.sectionId?.name || group?.section || '—';
            const statusLabel = String(group?.status || 'Scheduled');
            const normalizedStatus = statusLabel.toLowerCase();
            const isCompleted = normalizedStatus === 'completed';
            const statusClass = isCompleted
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-blue-50 text-blue-700';
            const days = daysUntil(group?.startDate);
            const subjects = group?.subjects || [];

            return (
              <div
                key={group._id}
                className={`w-full md:w-[48%] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm border-t-4 self-start ${
                  isCompleted ? 'border-t-emerald-400' : 'border-t-indigo-400'
                }`}
              >
                <div className="p-4 md:p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-indigo-600">
                        {group?.term || 'Exam'}
                      </span>
                      <h3 className="mt-1.5 text-lg font-bold text-slate-900">{group?.title || 'Exam Schedule'}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                        <Users size={14} className="text-slate-400" />
                        Class {classLabel} · Section {sectionLabel}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar size={12} />
                        {formatDate(group?.startDate)} - {formatDate(group?.endDate)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}>
                        {statusLabel}
                      </span>
                      {!isCompleted && days !== null && days >= 0 && (
                        <CountdownBadge date={group?.startDate} />
                      )}
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        {subjects.length} Subjects
                      </span>
                    </div>
                  </div>

                    <CardContent className="px-4 pb-4 md:px-5 md:pb-5 space-y-3">
                      {/* action buttons */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownload(group)}
                          disabled={downloadingGroupId === String(group._id)}
                          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-200 transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {downloadingGroupId === String(group._id) ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                          {downloadingGroupId === String(group._id) ? 'Preparing…' : 'Download Routine'}
                        </button>
                        {subjects[0]?._id && (
                          <button
                            type="button"
                            onClick={() => setMockExamOpen({
                              examId: String(subjects[0]._id),
                              examTitle: `${group.title} — Practice Mock`,
                              durationMinutes: subjects[0]?.duration || 60,
                              isMock: true,
                            })}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            <PlayCircle size={13} /> Practice Mock
                          </button>
                        )}
                      </div>

                      {/* subject rows */}
                      <div className="space-y-2">
                        {subjects.slice(0, 5).map((exam) => {
                          const subjectName = exam?.subjectId?.name || exam?.subject || exam?.title || 'Subject';
                          const style = getSubjectStyle(subjectName);
                          const room = buildRoomLabel(exam);
                          return (
                            <Motion.div
                              key={exam?._id || subjectName}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2 }}
                              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${style.border} ${style.bg}`}
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                                <p className={`truncate text-sm font-semibold ${style.text}`}>{subjectName}</p>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-slate-500">
                                {exam?.date && <span>{formatDate(exam.date)}</span>}
                                {exam?.time && (
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <Clock size={10} /> {exam.time}
                                  </span>
                                )}
                                {exam?.duration && <span className="hidden sm:inline text-slate-400">{exam.duration} min</span>}
                                {exam?.marks && <span className="hidden sm:inline font-semibold text-slate-600">{exam.marks} marks</span>}
                                {room !== '—' && <span className="hidden sm:inline text-slate-400">Room {room}</span>}
                              </div>
                            </Motion.div>
                          );
                        })}
                        {subjects.length > 5 && (
                          <p className="text-xs font-medium text-slate-400 pl-1">+{subjects.length - 5} more subjects</p>
                        )}
                      </div>
                    </CardContent>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>

    {/* Mock Exam Modal */}
    <AnimatePresence>
      {mockExamOpen && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <Motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {reviewExam ? (
              <WrongAnswerReviewView
                examId={reviewExam.examId}
                examTitle={reviewExam.examTitle}
                onClose={() => { setReviewExam(null); setMockExamOpen(null); }}
              />
            ) : (
              <MockExamView
                examId={mockExamOpen.examId}
                examTitle={mockExamOpen.examTitle}
                durationMinutes={mockExamOpen.durationMinutes}
                isMock={mockExamOpen.isMock}
                onClose={() => setMockExamOpen(null)}
                onFinished={(attempt, action) => {
                  if (action === 'review') {
                    setReviewExam({ examId: mockExamOpen.examId, examTitle: mockExamOpen.examTitle });
                  } else {
                    setMockExamOpen(null);
                  }
                }}
              />
            )}
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default StudentExamsView;
