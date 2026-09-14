import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Calendar, FileText, Loader2, Clock, CheckCircle2, Sparkles, Users, Search as SearchIcon, AlertCircle, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';
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

// ── Shared glass tokens ─────────────────────────────────────────────────────
const GLASS_CARD = 'rounded-2xl border border-[rgba(139,92,246,0.35)] bg-white/60 backdrop-blur-[20px] backdrop-saturate-[180%] shadow-[0_4px_24px_rgba(15,23,42,0.05)]';
const GLASS_HOVER = 'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(15,23,42,0.08)]';
const GLASS_INPUT = 'w-full rounded-xl border border-[rgba(139,92,246,0.25)] bg-white/70 text-sm text-[#0f172a] placeholder:text-[#8e9aaf] transition focus:border-[#8b5cf6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20';

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
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
        days <= 1
          ? 'border-rose-200/70 bg-rose-50 text-rose-600'
          : 'border-[rgba(139,92,246,0.3)] bg-violet-50 text-[#7c3aed]'
      }`}
    >
      {label}
    </span>
  );
};

// ── Flip Digit Unit ───────────────────────────────────────────────────────────
const FlipUnit = ({ value, label }) => {
  const padded = String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-16 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-white/15 shadow-inner backdrop-blur-sm sm:h-20 sm:w-16">
        {/* top/bottom split line */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px bg-black/20" />
        <AnimatePresence mode="popLayout" initial={false}>
          <Motion.span
            key={padded}
            initial={{ y: '-60%', opacity: 0, scale: 0.85 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: '60%', opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="absolute select-none text-3xl font-black tabular-nums tracking-tight text-white sm:text-4xl"
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
      className="relative overflow-hidden rounded-2xl border border-[rgba(139,92,246,0.35)] bg-gradient-to-br from-[#8b5cf6] via-[#7c3aed] to-[#6d28d9] p-5 shadow-[0_16px_40px_rgba(124,58,237,0.28)] sm:p-7"
    >
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/10 blur-xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/3 h-24 w-24 rounded-full bg-white/10 blur-lg" />

      <div className="relative z-10">
        {/* label row */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Clock className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">Next Exam Countdown</p>
            <p className="text-sm font-bold leading-tight text-white">{group.title || group.term}</p>
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
          <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/20">
              <CheckCircle2 className="h-7 w-7 text-emerald-300" />
            </div>
            <div>
              <p className="text-xl font-black text-white">Exam In Progress</p>
              <p className="text-sm text-white/70">Good luck! Do your best.</p>
            </div>
          </Motion.div>
        ) : (
          <div className="flex items-center justify-center gap-3 py-2 sm:gap-4">
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
      </div>
    </Motion.div>
  );
};

// ── Subject palette (dot colour only — rows stay neutral/glass) ─────────────
const SUBJECT_DOTS = ['bg-indigo-500', 'bg-sky-500', 'bg-emerald-500', 'bg-fuchsia-500', 'bg-rose-500', 'bg-violet-500', 'bg-teal-500', 'bg-orange-500'];
const getSubjectDot = (name) => {
  let hash = 0;
  for (let i = 0; i < String(name || '').length; i++) hash = (hash * 31 + String(name).charCodeAt(i)) >>> 0;
  return SUBJECT_DOTS[hash % SUBJECT_DOTS.length];
};

// ── Stat Tile ─────────────────────────────────────────────────────────────────
const StatTile = ({ icon, label, value, sub, iconBg, iconColor, delay = 0 }) => {
  const Icon = icon;
  return (
    <Motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.4, 0, 0.2, 1] }}
      className={`${GLASS_CARD} ${GLASS_HOVER} p-3.5 md:p-4`}
    >
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">{label}</p>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <p className="mt-1.5 truncate text-lg font-bold leading-tight text-[#0f172a] md:text-xl">{value}</p>
      {sub && <p className="mt-1 truncate text-[11px] text-[#8e9aaf]">{sub}</p>}
    </Motion.div>
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
    principalName: String(profile?.principalName || '').trim(),
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
    <div className="min-h-screen space-y-5 bg-slate-100 p-4 pb-8 md:p-6">
      {/* page header */}
      <Motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        className={`${GLASS_CARD} p-5 sm:p-6`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgba(139,92,246,0.35)] bg-violet-50">
            <Calendar className="h-5 w-5 text-[#8b5cf6]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0f172a] sm:text-2xl">Exams</h1>
            <p className="text-sm text-[#64748b]">View your exam schedule and download the routine</p>
          </div>
        </div>
      </Motion.div>

      {/* stat tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={FileText}     label="Total Exams" value={stats.total}     iconBg="bg-blue-50"    iconColor="text-blue-600"    delay={0.02} />
        <StatTile icon={Clock}        label="Scheduled"   value={stats.scheduled} iconBg="bg-[#fffbeb]"  iconColor="text-amber-600"   delay={0.06} />
        <StatTile icon={CheckCircle2} label="Completed"   value={stats.completed} iconBg="bg-emerald-50" iconColor="text-emerald-600" delay={0.10} />
        <StatTile
          icon={Sparkles}
          label="Next Exam"
          value={stats.next ? (stats.next.title || stats.next.term || 'Exam') : 'None'}
          sub={stats.next ? (() => { const d = daysUntil(stats.next.startDate); return d === 0 ? 'Starts today' : d != null && d >= 0 ? `In ${d}d` : ''; })() : 'No upcoming exam'}
          iconBg="bg-violet-50"
          iconColor="text-[#8b5cf6]"
          delay={0.14}
        />
      </div>

      {/* ── Hero Countdown ── */}
      {!loading && nextGroup && <HeroCountdownCard group={nextGroup} />}

      {/* filters */}
      <Motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05, ease: [0.4, 0, 0.2, 1] }}
        className={`${GLASS_CARD} p-4`}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e9aaf]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exam…"
              className={`${GLASS_INPUT} py-2.5 pl-9 pr-3`}
            />
          </div>
          <select
            value={termFilter}
            onChange={(e) => setTermFilter(e.target.value)}
            className={`${GLASS_INPUT} px-3 py-2.5`}
          >
            {TERM_OPTIONS.map((t) => <option key={t} value={t}>{t === 'all' ? 'All Terms' : t}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${GLASS_INPUT} px-3 py-2.5`}
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </Motion.div>

      {/* list */}
      {loading ? (
        <div className={`${GLASS_CARD} flex items-center gap-2 p-8 text-sm text-[#64748b]`}>
          <Loader2 size={16} className="animate-spin text-[#8b5cf6]" /> Loading exam schedule…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200/70 bg-rose-50/80 p-4 text-sm text-rose-700 backdrop-blur-[20px]">
          <AlertCircle size={15} /> {error}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[rgba(139,92,246,0.35)] bg-white/40 p-10 text-center backdrop-blur-[20px]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-50">
            <Calendar className="h-5 w-5 text-[#8b5cf6]" />
          </div>
          <p className="mt-3 text-sm font-semibold text-[#0f172a]">No exams found</p>
          <p className="mt-1 text-xs text-[#8e9aaf]">Try adjusting your filters, or check back later for your schedule.</p>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-4">
          {filteredGroups.map((group, index) => {
            const classLabel = group?.classId?.name || group?.grade || '—';
            const sectionLabel = group?.sectionId?.name || group?.section || '—';
            const statusLabel = String(group?.status || 'Scheduled');
            const normalizedStatus = statusLabel.toLowerCase();
            const isCompleted = normalizedStatus === 'completed';
            const isPublished = normalizedStatus === 'published' || isCompleted;
            const statusClass = isCompleted
              ? 'border-emerald-200/70 bg-emerald-50 text-emerald-700'
              : 'border-amber-200/70 bg-[#fffbeb] text-amber-700';
            const days = daysUntil(group?.startDate);
            const subjects = group?.subjects || [];

            return (
              <Motion.div
                key={group._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.4), ease: [0.4, 0, 0.2, 1] }}
                className={`w-full self-start md:w-[48%] ${GLASS_CARD} ${GLASS_HOVER}`}
              >
                <div className="space-y-4 p-4 md:p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <span className="inline-flex items-center rounded-full border border-[rgba(139,92,246,0.3)] bg-violet-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[#7c3aed]">
                        {group?.term || 'Exam'}
                      </span>
                      <h3 className="mt-1.5 text-lg font-bold text-[#0f172a]">{group?.title || 'Exam Schedule'}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-[#64748b]">
                        <Users size={14} className="text-[#8e9aaf]" />
                        Class {classLabel} · Section {sectionLabel}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-[#8e9aaf]">
                        <Calendar size={12} />
                        {formatDate(group?.startDate)} - {formatDate(group?.endDate)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass}`}>
                        {statusLabel}
                      </span>
                      {!isCompleted && days !== null && days >= 0 && (
                        <CountdownBadge date={group?.startDate} />
                      )}
                      {isPublished ? (
                        <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-xs font-bold text-[#64748b]">
                          {subjects.length} Subjects
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-200/70 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                          Routine not published yet
                        </span>
                      )}
                    </div>
                  </div>

                  {isPublished ? (
                    <>
                      {/* action buttons */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownload(group)}
                          disabled={downloadingGroupId === String(group._id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#8b5cf6] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-violet-200 transition-colors hover:bg-[#7c3aed] disabled:cursor-not-allowed disabled:opacity-60"
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
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100/70"
                          >
                            <PlayCircle size={13} /> Practice Mock
                          </button>
                        )}
                      </div>

                      {/* subject rows */}
                      <div className="space-y-2 rounded-xl border border-[rgba(139,92,246,0.15)] bg-white/40 p-2">
                        {subjects.slice(0, 5).map((exam) => {
                          const subjectName = exam?.subjectId?.name || exam?.subject || exam?.title || 'Subject';
                          const dot = getSubjectDot(subjectName);
                          const room = buildRoomLabel(exam);
                          return (
                            <Motion.div
                              key={exam?._id || subjectName}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2 }}
                              className="flex items-center justify-between gap-3 rounded-lg bg-white/60 px-3 py-2.5"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                                <p className="truncate text-sm font-semibold text-[#0f172a]">{subjectName}</p>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-[#64748b]">
                                {exam?.date && <span>{formatDate(exam.date)}</span>}
                                {exam?.time && (
                                  <span className="flex items-center gap-1 text-[#8e9aaf]">
                                    <Clock size={10} /> {exam.time}
                                  </span>
                                )}
                                {exam?.duration && <span className="hidden text-[#8e9aaf] sm:inline">{exam.duration} min</span>}
                                {exam?.marks && <span className="hidden font-semibold text-[#64748b] sm:inline">{exam.marks} marks</span>}
                                {room !== '—' && <span className="hidden text-[#8e9aaf] sm:inline">Room {room}</span>}
                              </div>
                            </Motion.div>
                          );
                        })}
                        {subjects.length > 5 && (
                          <p className="pl-1 text-xs font-medium text-[#8e9aaf]">+{subjects.length - 5} more subjects</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3.5 py-3 text-xs font-medium text-amber-700">
                      <AlertCircle size={14} className="shrink-0" />
                      The subject-wise routine isn&apos;t published yet — check back once your school publishes it.
                    </div>
                  )}
                </div>
              </Motion.div>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <Motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
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
