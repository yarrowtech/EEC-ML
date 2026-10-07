import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  HeartPulse,
  PartyPopper,
  Users,
  X,
} from 'lucide-react';
import { parentApiJson } from './parentApi';
import useParentChildren from './useParentChildren';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const parseKey = (k) => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const validDate = (v) => v && !Number.isNaN(new Date(v).getTime());
const fmtDay = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtShort = (v) => (validDate(v) ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const monthLabel = (d) => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PAGE_SIZE = 10;

const STATUS = {
  present: { label: 'Present', pill: 'bg-green-50 text-green-700', dot: 'bg-green-500', day: 'bg-green-50 text-green-700' },
  absent: { label: 'Absent', pill: 'bg-red-50 text-red-600', dot: 'bg-red-500', day: 'bg-red-50 text-red-600' },
  late: { label: 'Late', pill: 'bg-amber-50 text-amber-600', dot: 'bg-amber-400', day: 'bg-amber-50 text-amber-600' },
  holiday: { label: 'Holiday', pill: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', day: 'bg-slate-100 text-slate-500' },
};

// Several subject entries can exist for one day; the day counts as present if
// the child attended at all, late if marked late, otherwise absent.
const dayStatusOf = (entries) => {
  const s = entries.map((e) => String(e.status || '').toLowerCase());
  // if (s.includes('late')) return 'late';
  if (s.includes('present')) return 'present';
  if (s.includes('absent')) return 'absent';
  return s[0] || 'present';
};

const Delta = ({ value }) => {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return null;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
      {up ? <ArrowUp size={12} strokeWidth={3} /> : <ArrowDown size={12} strokeWidth={3} />}{Math.abs(value)}%
    </span>
  );
};

const Card = ({ className = '', children }) => (
  <section className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:p-5 ${className}`}>{children}</section>
);

// Client cache for this page: memory for in-app navigation + sessionStorage
// for reloads, scoped to the signed-in token. Max age 10 min.
const PAGE_CACHE_PREFIX = 'parent:attendance:v1:';
const PAGE_CACHE_MAX_AGE = 10 * 60 * 1000;
let memoryPageCache = null; // { key, at, data }
const pageCacheKey = () => {
  let t = '';
  try { t = localStorage.getItem('token') || ''; } catch { /* ignore */ }
  return PAGE_CACHE_PREFIX + t.slice(-16);
};
const readPageCache = () => {
  const key = pageCacheKey();
  let entry = memoryPageCache?.key === key ? memoryPageCache : null;
  if (!entry) {
    try { entry = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { entry = null; }
  }
  if (!entry || Date.now() - entry.at > PAGE_CACHE_MAX_AGE) return null;
  return entry.data;
};
const writePageCache = (data) => {
  const entry = { key: pageCacheKey(), at: Date.now(), data };
  memoryPageCache = entry;
  try { sessionStorage.setItem(entry.key, JSON.stringify(entry)); } catch { /* quota / private mode */ }
};

const RISE = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } };

/* ── page ────────────────────────────────────────────────────────────────── */
const AttendanceReport = () => {
  const navigate = useNavigate();
  const { selected: child } = useParentChildren();

  const cachedPage = readPageCache();
  const [attendanceKids, setAttendanceKids] = useState(() => cachedPage?.attendanceKids || []);
  const [holidays, setHolidays] = useState(() => cachedPage?.holidays || []);
  const [letters, setLetters] = useState(() => cachedPage?.letters || []);
  const [loading, setLoading] = useState(!cachedPage);
  const [error, setError] = useState('');

  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [calDir, setCalDir] = useState(1);
  const [selectedDay, setSelectedDay] = useState(() => keyOf(new Date()));
  const [tableMonth, setTableMonth] = useState(() => monthKeyOf(new Date()));
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Stale-while-revalidate: cached data (if any) is already on screen; this
  // refreshes it in the background and re-saves the cache.
  useEffect(() => {
    let off = false;
    Promise.allSettled([
      parentApiJson('/api/attendance/parent/children', {}, navigate),
      parentApiJson('/api/holidays/parent', {}, navigate),
      parentApiJson('/api/excuse-letters/parent', {}, navigate),
    ]).then(([a, h, l]) => {
      if (off) return;
      if (a.status === 'rejected') {
        // Keep showing cached data if the refresh fails.
        if (!readPageCache()) setError(a.reason?.message || 'Unable to load attendance');
        setLoading(false);
        return;
      }
      setError('');
      const hv = h.status === 'fulfilled' ? h.value : null;
      const next = {
        attendanceKids: a.value?.children || [],
        holidays: Array.isArray(hv) ? hv : hv?.holidays || [],
        letters: l.status === 'fulfilled' && Array.isArray(l.value) ? l.value : [],
      };
      setAttendanceKids(next.attendanceKids);
      setHolidays(next.holidays);
      setLetters(next.letters);
      writePageCache(next);
      setLoading(false);
    });
    return () => { off = true; };
  }, [navigate]);


  /* ── per-day maps ── */
  const entry = useMemo(
    () => attendanceKids.find((k) => String(k?.student?._id) === String(child?.id)) || attendanceKids[0] || null,
    [attendanceKids, child?.id],
  );
  const rawRecords = useMemo(() => (Array.isArray(entry?.records) ? entry.records : []), [entry]);

  const days = useMemo(() => {
    const map = new Map();
    rawRecords.forEach((r) => { if (!map.has(r.date)) map.set(r.date, []); map.get(r.date).push(r); });
    const out = new Map();
    map.forEach((list, k) => out.set(k, dayStatusOf(list)));
    return out;
  }, [rawRecords]);

  const holidayDays = useMemo(() => {
    const map = new Map();
    holidays.forEach((h) => {
      const start = h.startDate || h.date;
      if (!validDate(start)) return;
      const s = new Date(start);
      const e = validDate(h.endDate) ? new Date(h.endDate) : s;
      for (let d = new Date(s.getFullYear(), s.getMonth(), s.getDate()); d <= e; d.setDate(d.getDate() + 1)) {
        map.set(keyOf(d), h.name || h.title || 'Holiday');
      }
    });
    return map;
  }, [holidays]);

  const childLetters = useMemo(
    () => letters.filter((l) => !child?.id || String(l.studentId?._id || l.studentId) === String(child.id))
      .sort((a, b) => new Date(b.dateFrom || b.createdAt || 0) - new Date(a.dateFrom || a.createdAt || 0)),
    [letters, child?.id],
  );
  const leaveReasonFor = (k) => {
    const d = parseKey(k);
    const hit = childLetters.find((l) => validDate(l.dateFrom) && new Date(new Date(l.dateFrom).toDateString()) <= d
      && d <= new Date(new Date(l.dateTo || l.dateFrom).toDateString()));
    return hit ? (hit.reason || hit.reasonType || 'Leave') : '';
  };

  /* ── stats ── */
  const stats = useMemo(() => {
    let present = 0; let absent = 0; let late = 0;
    days.forEach((s) => { if (s === 'present') present += 1; else if (s === 'absent') absent += 1; else if (s === 'late') late += 1; });
    const total = present + absent + late;
    const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
    const monthPct = (mk) => {
      let p = 0; let t = 0;
      days.forEach((s, k) => { if (k.startsWith(mk)) { t += 1; if (s !== 'absent') p += 1; } });
      return t ? Math.round((p / t) * 100) : null;
    };
    const now = new Date();
    const cur = monthPct(monthKeyOf(now));
    const prev = monthPct(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
    const delta = cur !== null && prev !== null ? cur - prev : null;

    // Same academic-session figures as the dashboard: school days since the
    // session started (Sundays + holidays excluded) vs days marked present.
    const session = entry?.sessionSummary;
    if (session && Number(session.schoolDays) > 0) {
      const schoolDays = Number(session.schoolDays);
      const sPresent = Number(session.presentDays) || 0;
      const sAbsent = Number(session.absentDays) || 0;
      const sPct = (n) => Math.round((n / schoolDays) * 100);
      return {
        present: sPresent, absent: sAbsent, late: 0, total: schoolDays,
        overall: Number(session.percentage) || sPct(sPresent),
        presentPct: sPct(sPresent), absentPct: sPct(sAbsent), latePct: 0,
        delta,
        sessionName: session.sessionName || '',
      };
    }

    return {
      present, absent, late, total,
      overall: total ? Math.round(((present + late) / total) * 100) : 0,
      presentPct: pct(present), absentPct: pct(absent), latePct: pct(late),
      delta,
      sessionName: '',
    };
  }, [days, entry]);

  /* ── calendar ── */
  const cells = useMemo(() => {
    const start = new Date(calMonth);
    start.setDate(1 - calMonth.getDay());
    return Array.from({ length: 35 + (new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate() + calMonth.getDay() > 35 ? 7 : 0) },
      (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [calMonth]);
  const statusForDay = (k) => days.get(k) || (holidayDays.has(k) ? 'holiday' : null);

  /* ── records table ── */
  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - i, 1));
  }, []);
  const tableRows = useMemo(() => {
    const keys = new Set();
    days.forEach((_, k) => { if (k.startsWith(tableMonth)) keys.add(k); });
    holidayDays.forEach((_, k) => { if (k.startsWith(tableMonth) && parseKey(k) <= new Date()) keys.add(k); });
    return [...keys].sort((a, b) => b.localeCompare(a))
      .map((k) => {
        const status = days.get(k) || 'holiday';
        const remark = status === 'holiday' ? (holidayDays.get(k) || 'School Closed') : status === 'absent' ? leaveReasonFor(k) : '';
        return { key: k, date: parseKey(k), status, remark };
      })
      .filter((r) => statusFilter === 'all' || r.status === statusFilter);
  }, [days, holidayDays, tableMonth, statusFilter, childLetters]);
  const pages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const pageRows = tableRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [tableMonth, statusFilter, child?.id]);

  /* ── overview (last 6 months) ── */
  const overview = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)).map((m) => {
      const mk = monthKeyOf(m);
      const c = { present: 0, absent: 0, late: 0, holiday: 0 };
      days.forEach((s, k) => { if (k.startsWith(mk) && c[s] !== undefined) c[s] += 1; });
      holidayDays.forEach((_, k) => { if (k.startsWith(mk) && !days.has(k)) c.holiday += 1; });
      return { label: m.toLocaleDateString('en-GB', { month: 'short' }), ...c };
    });
  }, [days, holidayDays]);
  const overviewMax = Math.max(5, ...overview.map((o) => o.present + o.absent + o.late + o.holiday));
  const overviewTop = Math.ceil(overviewMax / 5) * 5;
  const holidayTotal = overview.reduce((s, o) => s + o.holiday, 0);

  /* ── subject-wise ── */
  const subjects = useMemo(() => {
    const map = new Map();
    rawRecords.forEach((r) => {
      // Daily (whole-day) attendance is stored as "general::general" — skip it.
      const raw = String(r.subject || '').trim();
      const name = raw.includes('::') ? raw.split('::').pop().trim() : raw;
      if (!name || /^general$/i.test(name)) return;
      if (!map.has(name)) map.set(name, { name, total: 0, present: 0 });
      const s = map.get(name);
      s.total += 1;
      if (r.status !== 'absent') s.present += 1;
    });
    return [...map.values()].map((s) => ({ ...s, pct: Math.round((s.present / s.total) * 100) }))
      .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 6);
  }, [rawRecords]);


  return (
    <motion.div
      data-testid="attendance-report"
      className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 bg-slate-50 p-3 sm:p-4 lg:p-6"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
    >
      {/* ── Title + child picker ── */}
      <motion.div variants={RISE} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
          <p className="mt-0.5 text-sm text-slate-600">View your child&apos;s daily attendance, monthly summary and detailed records.</p>
        </div>
      </motion.div>

      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      {/* ── Stat cards ── */}
      <motion.div variants={RISE} className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="col-span-2 flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] lg:col-span-1">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-green-600"><Users size={26} /></span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700">Overall Attendance</p>
            <div className="mt-0.5 flex items-center gap-2"><p className="text-2xl font-bold text-slate-900">{stats.overall}%</p><Delta value={stats.delta} /></div>
            <p className="mt-1 text-xs text-slate-500">Present: {stats.present + stats.late} / {stats.total} days</p>
            {/* {stats.sessionName ? (
              <p className="mt-0.5 text-[11px] text-slate-400">Session: {stats.sessionName}</p>
            ) : null} */}
          </div>
        </div>
        {[
          { label: 'Present Days', value: stats.present, sub: `${stats.presentPct}%`, subCls: 'text-green-600', icon: <Check size={20} strokeWidth={3} />, tile: 'bg-green-50', dot: 'bg-green-600' },
          { label: 'Absent Days', value: stats.absent, sub: `${stats.absentPct}%`, subCls: 'text-red-500', icon: <X size={20} strokeWidth={3} />, tile: 'bg-red-50', dot: 'bg-red-500' },
          // { label: 'Late Days', value: stats.late, sub: `${stats.latePct}%`, subCls: 'text-amber-500', icon: <Clock size={20} strokeWidth={3} />, tile: 'bg-amber-50', dot: 'bg-amber-400' },
          // { label: 'Total Working Days', value: stats.total, sub: 'This academic session', subCls: 'text-slate-500', icon: <CalendarDays size={22} />, tile: 'bg-violet-50', dot: '' },
        ].map((s) => (
          <motion.div key={s.label} whileHover={{ y: -3 }} transition={{ duration: 0.15 }} className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] hover:shadow-md">
            <span className={`flex h-10 w-10 shrink-0 sm:h-12 sm:w-12 items-center justify-center rounded-xl ${s.tile}`}>
              {s.dot ? <span className={`flex h-7 w-7 items-center justify-center rounded-full text-white ${s.dot}`}>{s.icon}</span> : <span className="text-violet-600">{s.icon}</span>}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700">{s.label}</p>
              <p className="mt-0.5 text-2xl font-bold text-slate-900">{s.value}</p>
              <p className={`mt-0.5 text-xs font-semibold ${s.subCls}`}>{s.sub}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Calendar + records ── */}
      <motion.div variants={RISE} className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="flex min-w-0 flex-col">
          <h2 className="text-base font-bold text-slate-900">Attendance Calendar</h2>
          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={() => { setCalDir(-1); setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50" aria-label="Previous month"><ChevronLeft size={17} /></button>
            <p className="text-base font-bold text-slate-900">{monthLabel(calMonth)}</p>
            <button type="button" onClick={() => { setCalDir(1); setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50" aria-label="Next month"><ChevronRight size={17} /></button>
          </div>
          <div className="mt-4 grid grid-cols-7 text-center">
            {WEEK.map((w) => <span key={w} className="text-xs font-medium text-slate-600">{w}</span>)}
          </div>
          <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={monthKeyOf(calMonth)}
            initial={{ opacity: 0, x: calDir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: calDir * -24 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mt-2 grid grid-cols-7 gap-y-1.5 text-center"
          >
            {cells.map((d, idx) => {
              const k = keyOf(d);
              const inMonth = d.getMonth() === calMonth.getMonth();
              const st = inMonth ? statusForDay(k) : null;
              const selected = k === selectedDay;
              return (
                <motion.button
                  key={k}
                  type="button"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(idx * 0.008, 0.3), type: 'spring', stiffness: 420, damping: 26 }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => { setSelectedDay(k); setTableMonth(k.slice(0, 7)); }}
                  className={`mx-auto flex aspect-square w-full max-w-9 items-center justify-center rounded-full text-xs font-semibold transition sm:text-sm xl:max-w-11 ${
                    !inMonth ? 'text-slate-300' : st ? STATUS[st].day : 'text-slate-700 hover:bg-slate-50'
                  } ${selected ? 'ring-2 ring-blue-600 ring-offset-1' : ''}`}
                  title={st ? STATUS[st].label : undefined}
                >
                  {d.getDate()}
                </motion.button>
              );
            })}
          </motion.div>
          </AnimatePresence>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 sm:text-sm">
            {['present', 'absent', 'holiday'].map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${STATUS[s].dot}`} />{STATUS[s].label}</span>
            ))}
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-blue-600" />Selected</span>
          </div>
        </Card>

        <Card className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">Attendance Records</h2>
            <div className="flex gap-2">
              <div className="relative">
                <select aria-label="Attendance month" value={tableMonth} onChange={(e) => setTableMonth(e.target.value)} className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-800 outline-none focus:border-violet-300">
                  {monthOptions.map((m) => <option key={monthKeyOf(m)} value={monthKeyOf(m)}>{monthLabel(m)}</option>)}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
              <div className="relative">
                <select aria-label="Attendance status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-800 outline-none focus:border-violet-300">
                  <option value="all">All Status</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="holiday">Holiday</option>
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
          </div>
          <div className="mt-3 flex-1 overflow-x-auto">
            <table className="w-full min-w-[280px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-3">#</th>
                  <th className="px-2 py-3">Date</th>
                  <th className="px-2 py-3">Day</th>
                  <th className="px-2 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={4} className="py-10 text-center text-slate-400">Loading…</td></tr>
                ) : pageRows.length === 0 ? (
                  <tr><td colSpan={4} className="py-10 text-center text-slate-400">No records for this month</td></tr>
                ) : pageRows.map((r, i) => (
                  <motion.tr
                    key={`${tableMonth}-${statusFilter}-${page}-${r.key}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                    className={`transition-colors hover:bg-slate-50 ${r.key === selectedDay ? 'bg-blue-50/50' : ''}`}
                  >
                    <td className="px-2 py-2.5 text-slate-600">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-slate-800">{fmtDay(r.date)}</td>
                    <td className="px-2 py-2.5 text-slate-600">{WEEK[r.date.getDay()]}</td>
                    <td className="px-2 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[r.status].pill}`}>
                        <span className={`h-2 w-2 rounded-full ${STATUS[r.status].dot}`} />{STATUS[r.status].label}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
            <span className="text-xs text-slate-500">
              Showing {tableRows.length ? (page - 1) * PAGE_SIZE + 1 : 0} to {Math.min(page * PAGE_SIZE, tableRows.length)} of {tableRows.length} records
            </span>
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={15} /></button>
              {Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, page - 2), Math.max(0, page - 2) + 3).map((n) => (
                <button key={n} type="button" onClick={() => setPage(n)} className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm font-semibold ${n === page ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{n}</button>
              ))}
              <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40" aria-label="Next page"><ChevronRight size={15} /></button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ── Overview / Subject-wise / Leave ── */}
      <motion.div variants={RISE} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,3.5fr)_minmax(0,3.5fr)]">
        <Card className="min-w-0 md:col-span-2 xl:col-span-1">
          <h2 className="text-base font-bold text-slate-900">Attendance Overview</h2>
          <div className="mt-4 flex gap-4 sm:gap-6">
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
              <div className="flex h-40 flex-col justify-between pb-5 text-right text-[11px] text-slate-400">
                {[5, 4, 3, 2, 1, 0].map((i) => <span key={i}>{Math.round((overviewTop / 5) * i)}</span>)}
              </div>
              <div className="flex h-40 min-w-[260px] flex-1 items-end justify-around gap-1.5 border-b border-slate-100">
                {overview.map((o) => {
                  const h = (n) => `${(n / overviewTop) * 100}%`;
                  return (
                    <div key={o.label} className="flex h-full w-full max-w-9 flex-col items-center">
                      <div className="flex w-full flex-1 flex-col-reverse overflow-hidden rounded-t">
                        <motion.div initial={{ height: 0 }} animate={{ height: h(o.present) }} transition={{ duration: 0.6 }} className="w-full bg-green-500" />
                        {/* <motion.div initial={{ height: 0 }} animate={{ height: h(o.late) }} transition={{ duration: 0.6 }} className="w-full bg-amber-400" /> */}
                        <motion.div initial={{ height: 0 }} animate={{ height: h(o.absent) }} transition={{ duration: 0.6 }} className="w-full bg-red-500" />
                        <motion.div initial={{ height: 0 }} animate={{ height: h(o.holiday) }} transition={{ duration: 0.6 }} className="w-full bg-slate-200" />
                      </div>
                      <span className="mt-1.5 text-[10px] text-slate-500 sm:text-xs">{o.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <ul className="hidden w-36 shrink-0 space-y-3 self-center text-sm sm:block">
              {/* {[['present', stats.present], ['absent', stats.absent], ['late', stats.late], ['holiday', holidayTotal]].map(([k, v]) => ( */}
              {[['present', stats.present], ['absent', stats.absent],
               ['holiday', holidayTotal]].map(([k, v]) => (
                <li key={k} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${STATUS[k].dot}`} />{STATUS[k].label}</span>
                  <span className="font-semibold text-slate-900">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-bold text-slate-900">Subject-wise Attendance</h2>
          {subjects.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 py-6 text-center text-sm text-slate-500">Attendance is recorded per day for this class, not per subject.</p>
          ) : (
            <ul className="mt-4 space-y-3.5">
              {subjects.map((s) => (
                <li key={s.name} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 truncate text-slate-700 sm:w-28" title={s.name}>{s.name}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <motion.span initial={{ width: 0 }} animate={{ width: `${s.pct}%` }} transition={{ duration: 0.7 }} className="block h-full rounded-full bg-emerald-500" />
                  </span>
                  <span className="w-10 shrink-0 text-right font-semibold text-slate-900">{s.pct}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Leave History</h2>
            <Link to="/parents/excuse-letters" className="text-sm font-semibold text-blue-600 hover:text-blue-700">View All</Link>
          </div>
          {childLetters.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 py-6 text-center text-sm text-slate-500">No leave requests yet</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {childLetters.slice(0, 3).map((l) => {
                const type = String(l.reasonType || '').toLowerCase();
                const cfg = type.includes('medical') || type.includes('sick')
                  ? { Icon: HeartPulse, cls: 'bg-rose-50 text-rose-500' }
                  : type.includes('family') || type.includes('function') ? { Icon: PartyPopper, cls: 'bg-amber-50 text-amber-500' }
                    : { Icon: FileText, cls: 'bg-blue-50 text-blue-600' };
                const status = String(l.status || 'pending').toLowerCase();
                const pill = status === 'approved' ? 'bg-emerald-50 text-emerald-600' : status === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600';
                return (
                  <li key={l._id} className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.cls}`}><cfg.Icon size={19} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold capitalize text-slate-900">{l.reason || l.reasonType || 'Leave'}</span>
                      <span className="block text-xs text-slate-500">{fmtShort(l.dateFrom)}{l.dateTo && l.dateTo !== l.dateFrom ? ` – ${fmtShort(l.dateTo)}` : ''}</span>
                    </span>
                    <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ${pill}`}>{status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default AttendanceReport;
