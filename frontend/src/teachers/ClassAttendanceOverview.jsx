import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertTriangle, ArrowDown, ArrowUp, BarChart3, BookOpen, CalendarCheck, CalendarDays,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Loader2, Search, TrendingUp,
  User, Users, XCircle,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

// ── Date helpers ─────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const monthKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const dateKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  return monthKeyOf(new Date(y, m - 1 + delta, 1));
};
const monthLabel = (key, opts = { month: 'short', year: 'numeric' }) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', opts);
};
const shortDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
const weekdayOf = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};
const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

const DAY_FILTERS = [
  { value: 'all', label: 'All Days' },
  { value: 'weekdays', label: 'Mon – Fri' },
  { value: 'saturday', label: 'Saturdays' },
];
const dayAllowed = (key, filter) => {
  if (filter === 'all') return true;
  const wd = weekdayOf(key);
  return filter === 'weekdays' ? wd >= 1 && wd <= 5 : wd === 6;
};

const SUBJECT_BAR_COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-400', 'bg-teal-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-400'];
const AVATAR_COLORS = ['bg-rose-100 text-rose-600', 'bg-amber-100 text-amber-700', 'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700'];

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const fetchClassMonth = async ({ className, section, month, subject = '', withSession = false }) => {
  const q = new URLSearchParams({ month, date: dateKeyOf(new Date()) });
  if (className) q.set('className', className);
  if (section) q.set('section', section);
  if (subject) q.set('subject', subject);
  if (withSession) q.set('withSession', 'true');
  const res = await fetch(`${API_BASE}/api/attendance/teacher/students?${q}`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to load attendance');
  return data;
};

// Per-date class totals from each student's attendanceByDate map.
const dailyTotals = (students, dayFilter = 'all') => {
  const byDate = new Map();
  students.forEach((s) => {
    Object.entries(s.attendanceByDate || {}).forEach(([key, rec]) => {
      if (!dayAllowed(key, dayFilter)) return;
      const row = byDate.get(key) || { key, present: 0, absent: 0 };
      if (rec?.status === 'present') row.present += 1;
      else if (rec?.status === 'absent') row.absent += 1;
      byDate.set(key, row);
    });
  });
  return [...byDate.values()]
    .map((r) => ({ ...r, total: r.present + r.absent, rate: pct(r.present, r.present + r.absent) }))
    .sort((a, b) => a.key.localeCompare(b.key));
};

const studentMonthStats = (s, dayFilter) => {
  let present = 0;
  let absent = 0;
  Object.entries(s.attendanceByDate || {}).forEach(([key, rec]) => {
    if (!dayAllowed(key, dayFilter)) return;
    if (rec?.status === 'present') present += 1;
    else if (rec?.status === 'absent') absent += 1;
  });
  return { present, absent, rate: pct(present, present + absent) };
};

// ── Small UI pieces ─────────────────────────────────────────
const Panel = ({ icon: Icon, iconColor = 'text-blue-600', title, action, className = '', children }) => (
  <section className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ${className}`}>
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-slate-900">
        <Icon className={`size-5 ${iconColor}`} /> {title}
      </h2>
      {action}
    </div>
    {children}
  </section>
);

const SelectPill = ({ icon: Icon, value, onChange, options }) => (
  <div className="relative">
    <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-[13px] text-slate-800 shadow-sm outline-none focus:border-blue-300"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
  </div>
);

// Student photo when available, otherwise a coloured initial.
const Avatar = ({ name, index, src }) => {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="size-7 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />;
  }
  return (
    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}>
      {String(name || 'S').trim().charAt(0).toUpperCase()}
    </span>
  );
};

// ── Main ─────────────────────────────────────────────────────
const ClassAttendanceOverview = () => {
  const { className = '', sectionName = '' } = useOutletContext() || {};
  const todayKey = dateKeyOf(new Date());
  const thisMonth = monthKeyOf(new Date());

  const [month, setMonth] = useState(thisMonth);
  const [subject, setSubject] = useState('');
  const [dayFilter, setDayFilter] = useState('all');
  const [trendMode, setTrendMode] = useState('daily');
  const [calendarMonth, setCalendarMonth] = useState(thisMonth);

  const [students, setStudents] = useState([]);
  const [prevStudents, setPrevStudents] = useState([]);
  const [calendarStudents, setCalendarStudents] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [subjectRates, setSubjectRates] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lowModal, setLowModal] = useState(null); // null | { focusId }

  const ready = Boolean(className && sectionName);

  // Selected month + previous month (for the "from last month" delta).
  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError('');
    try {
      const [cur, prev] = await Promise.all([
        fetchClassMonth({ className, section: sectionName, month, subject, withSession: true }),
        fetchClassMonth({ className, section: sectionName, month: shiftMonth(month, -1), subject }).catch(() => null),
      ]);
      setStudents(Array.isArray(cur.students) ? cur.students : []);
      setPrevStudents(Array.isArray(prev?.students) ? prev.students : []);
      setSubjectOptions(Array.isArray(cur?.options?.subjects) ? cur.options.subjects : []);
    } catch (err) {
      setError(err.message || 'Failed to load attendance');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [ready, className, sectionName, month, subject]);

  useEffect(() => { load(); }, [load]);

  // Subject-wise attendance: one request per allocated subject.
  useEffect(() => {
    if (!ready || subjectOptions.length === 0) { setSubjectRates([]); return undefined; }
    let cancelled = false;
    Promise.all(subjectOptions.slice(0, 8).map(async (sub) => {
      const data = await fetchClassMonth({ className, section: sectionName, month, subject: sub }).catch(() => null);
      const days = dailyTotals(Array.isArray(data?.students) ? data.students : [], dayFilter);
      const present = days.reduce((s, d) => s + d.present, 0);
      const total = days.reduce((s, d) => s + d.total, 0);
      return { subject: sub, rate: pct(present, total), total };
    })).then((rows) => { if (!cancelled) setSubjectRates(rows); });
    return () => { cancelled = true; };
  }, [ready, className, sectionName, month, dayFilter, subjectOptions]);

  // Monthly trend (last 6 months) — only fetched when that view is opened.
  useEffect(() => {
    if (trendMode !== 'monthly' || !ready) return undefined;
    let cancelled = false;
    const keys = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
    Promise.all(keys.map(async (key) => {
      const data = await fetchClassMonth({ className, section: sectionName, month: key, subject }).catch(() => null);
      const days = dailyTotals(Array.isArray(data?.students) ? data.students : [], dayFilter);
      const present = days.reduce((s, d) => s + d.present, 0);
      const absent = days.reduce((s, d) => s + d.absent, 0);
      return { label: monthLabel(key, { month: 'short' }), present: pct(present, present + absent), absent: pct(absent, present + absent), total: present + absent };
    })).then((rows) => { if (!cancelled) setMonthlyTrend(rows); });
    return () => { cancelled = true; };
  }, [trendMode, ready, className, sectionName, month, subject, dayFilter]);

  // Calendar month can be browsed independently.
  useEffect(() => {
    if (!ready) return undefined;
    if (calendarMonth === month) { setCalendarStudents(students); return undefined; }
    let cancelled = false;
    fetchClassMonth({ className, section: sectionName, month: calendarMonth, subject })
      .then((d) => { if (!cancelled) setCalendarStudents(Array.isArray(d.students) ? d.students : []); })
      .catch(() => { if (!cancelled) setCalendarStudents([]); });
    return () => { cancelled = true; };
  }, [ready, calendarMonth, month, students, className, sectionName, subject]);

  useEffect(() => {
    fetch(`${API_BASE}/api/holidays/teacher`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setHolidays(Array.isArray(d) ? d : []))
      .catch(() => setHolidays([]));
  }, []);

  const holidayKeys = useMemo(() => {
    const set = new Set();
    holidays.forEach((h) => {
      const start = new Date(h.startDate || h.date);
      const end = new Date(h.endDate || h.startDate || h.date);
      if (Number.isNaN(start.getTime())) return;
      for (let d = new Date(start); d <= end && set.size < 2000; d.setDate(d.getDate() + 1)) set.add(dateKeyOf(d));
    });
    return set;
  }, [holidays]);

  // ── Derived stats ──
  const days = useMemo(() => dailyTotals(students, dayFilter), [students, dayFilter]);
  const prevDays = useMemo(() => dailyTotals(prevStudents, dayFilter), [prevStudents, dayFilter]);
  const totalStudents = students.length;
  const sumPresent = days.reduce((s, d) => s + d.present, 0);
  const sumAbsent = days.reduce((s, d) => s + d.absent, 0);
  const avgRate = pct(sumPresent, sumPresent + sumAbsent);
  const prevPresent = prevDays.reduce((s, d) => s + d.present, 0);
  const prevAvg = pct(prevPresent, prevPresent + prevDays.reduce((s, d) => s + d.absent, 0));
  const delta = prevDays.length ? avgRate - prevAvg : null;
  const today = days.find((d) => d.key === todayKey) || { present: 0, absent: 0 };
  const workingDays = days.length;
  const possible = workingDays * totalStudents;
  const notMarked = Math.max(0, possible - sumPresent - sumAbsent);

  const statCards = [
    { label: 'Total Students', value: totalStudents, helper: `Class ${className} - Section ${sectionName}`, helperCls: 'text-slate-500', icon: Users, bg: 'bg-emerald-100', fg: 'text-emerald-600' },
    { label: 'Present Today', value: today.present, helper: `${pct(today.present, totalStudents)}% attendance rate`, helperCls: 'text-emerald-600', icon: CheckCircle2, bg: 'bg-emerald-100', fg: 'text-emerald-600' },
    { label: 'Absent Today', value: today.absent, helper: `${pct(today.absent, totalStudents)}% of total`, helperCls: 'text-red-500', icon: XCircle, bg: 'bg-red-100', fg: 'text-red-500' },
    {
      label: 'Average Attendance',
      value: `${avgRate}%`,
      helper: delta == null ? 'No data last month' : `${delta >= 0 ? '+' : ''}${delta}% from last month`,
      helperCls: delta == null ? 'text-slate-500' : delta >= 0 ? 'text-emerald-600' : 'text-red-500',
      trend: delta == null ? null : delta >= 0 ? 'up' : 'down',
      icon: User, bg: 'bg-violet-100', fg: 'text-violet-600',
    },
    { label: 'Total Working Days', value: workingDays, helper: month === thisMonth ? 'This month' : monthLabel(month), helperCls: 'text-slate-500', icon: CalendarCheck, bg: 'bg-orange-100', fg: 'text-orange-500' },
  ];

  const trendData = useMemo(() => {
    if (trendMode === 'monthly') return monthlyTrend;
    if (trendMode === 'weekly') {
      const weeks = new Map();
      days.forEach((d) => {
        const wk = Math.ceil(Number(d.key.slice(8)) / 7);
        const row = weeks.get(wk) || { label: `Week ${wk}`, p: 0, a: 0 };
        row.p += d.present; row.a += d.absent;
        weeks.set(wk, row);
      });
      return [...weeks.values()].map((w) => ({ label: w.label, present: pct(w.p, w.p + w.a), absent: pct(w.a, w.p + w.a) }));
    }
    return days.slice(-12).map((d) => ({ label: shortDay(d.key), present: d.rate, absent: 100 - d.rate }));
  }, [trendMode, days, monthlyTrend]);
  const trendAvg = trendData.length ? Math.round(trendData.reduce((s, d) => s + d.present, 0) / trendData.length) : 0;
  const trendWithAvg = trendData.map((d) => ({ ...d, avg: trendAvg }));

  const rows = useMemo(() => students
    .map((s, i) => {
      // Academic-year totals (school days in the active session, holidays excluded),
      // same as the parent portal. Falls back to the selected month if unavailable.
      const session = s.sessionSummary;
      const stats = session
        ? { present: session.presentDays || 0, absent: session.absentDays || 0, rate: session.percentage || 0, schoolDays: session.schoolDays || 0 }
        : { ...studentMonthStats(s, dayFilter), schoolDays: 0 };
      const todayRec = s.attendanceByDate?.[todayKey]?.status || '';
      return { ...s, idx: i, ...stats, todayStatus: todayRec };
    })
    .sort((a, b) => (Number(a.roll) || 9999) - (Number(b.roll) || 9999)), [students, dayFilter, todayKey]);

  const filteredRows = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q && !String(r.name).toLowerCase().includes(q) && !String(r.roll ?? '').includes(q)) return false;
    if (statusFilter === 'present' && r.todayStatus !== 'present') return false;
    if (statusFilter === 'absent' && r.todayStatus !== 'absent') return false;
    if (statusFilter === 'unmarked' && r.todayStatus) return false;
    return true;
  });

  const lowAll = rows.filter((r) => (r.schoolDays || r.present + r.absent) > 0 && r.rate < 92).sort((a, b) => a.rate - b.rate);
  const lowAttendance = lowAll.slice(0, 4);

  const recent = useMemo(() => {
    const marked = days.slice(-4).map((d) => ({ ...d, holiday: false }));
    const lastHoliday = [...holidayKeys].filter((k) => k.startsWith(month) && k <= todayKey).sort().slice(-1)
      .map((k) => ({ key: k, holiday: true }));
    return [...marked, ...lastHoliday].sort((a, b) => b.key.localeCompare(a.key)).slice(0, 4);
  }, [days, holidayKeys, month, todayKey]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const byKey = new Map(dailyTotals(calendarStudents).map((d) => [d.key, d]));
    const [y, m] = calendarMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const lead = first.getDay();
    const count = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = lead; i > 0; i -= 1) cells.push({ label: new Date(y, m - 1, 1 - i).getDate(), muted: true });
    for (let d = 1; d <= count; d += 1) {
      const key = `${calendarMonth}-${pad(d)}`;
      cells.push({ label: d, key, info: byKey.get(key), holiday: holidayKeys.has(key) });
    }
    while (cells.length % 7) cells.push({ label: cells.length - lead - count + 1, muted: true });
    return cells;
  }, [calendarStudents, calendarMonth, holidayKeys]);

  const dayCellCls = (c) => {
    if (c.muted) return 'text-slate-300';
    if (c.key === todayKey) return 'bg-blue-500 text-white font-semibold';
    if (c.holiday) return 'bg-slate-100 text-slate-400';
    if (c.info) {
      if (c.info.rate >= 90) return 'bg-emerald-100 text-slate-800';
      if (c.info.rate >= 75) return 'bg-amber-100 text-slate-800';
      return 'bg-red-100 text-red-600';
    }
    return 'text-slate-700';
  };

  const monthOptions = [0, -1, -2, -3].map((d) => {
    const key = shiftMonth(thisMonth, d);
    return { value: key, label: d === 0 ? `This Month (${monthLabel(key)})` : monthLabel(key, { month: 'long', year: 'numeric' }) };
  });

  if (!ready) {
    return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-blue-500" /></div>;
  }

  return (
    <Motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-[0_2px_16px_rgba(15,23,42,0.05)] sm:p-5"
    >
      {/* Header */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
            <CalendarDays className="size-6" strokeWidth={2.3} />
          </div>
          <div>
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-slate-900">Overall Attendance</h1>
            <p className="text-[13px] text-slate-500">Complete attendance overview for Class {className}-{sectionName}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectPill icon={CalendarDays} value={month} onChange={(v) => { setMonth(v); setCalendarMonth(v); }} options={monthOptions} />
          <SelectPill icon={BookOpen} value={subject} onChange={setSubject} options={[{ value: '', label: 'All Subjects' }, ...subjectOptions.map((s) => ({ value: s, label: s }))]} />
          <SelectPill icon={CalendarCheck} value={dayFilter} onChange={setDayFilter} options={DAY_FILTERS} />
        </div>
      </header>

      {error && <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}

      {/* Stat cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map((c) => (
          <div key={c.label} className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.bg}`}>
              <c.icon className={`size-[18px] ${c.fg}`} strokeWidth={2.3} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] leading-tight text-slate-600">{c.label}</p>
              <p className="text-lg font-bold leading-snug text-slate-900">{loading ? '—' : c.value}</p>
              <p className={`flex items-start gap-0.5 text-[10.5px] leading-tight ${c.helperCls}`}>
                {c.trend === 'up' && <ArrowUp className="mt-px size-3 shrink-0" />}
                {c.trend === 'down' && <ArrowDown className="mt-px size-3 shrink-0" />}
                <span>{c.helper}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Trend / Day type / Subject-wise */}
      <div className="mb-4 grid gap-4 xl:grid-cols-[1.45fr_1fr_1fr]">
        <Panel
          icon={BarChart3}
          title="Attendance Trend"
          action={(
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              {['daily', 'weekly', 'monthly'].map((m) => (
                <button key={m} type="button" onClick={() => setTrendMode(m)} className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition ${trendMode === m ? 'border border-blue-200 bg-blue-100 text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}>
                  {m}
                </button>
              ))}
            </div>
          )}
        >
          {trendWithAvg.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">{loading ? 'Loading…' : 'No attendance recorded yet.'}</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <ComposedChart data={trendWithAvg} margin={{ top: 6, right: 4, left: -22, bottom: 0 }} barSize={18}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v, n) => [`${v}%`, n === 'avg' ? 'Average' : n === 'present' ? 'Present' : 'Absent']} />
                  <Bar dataKey="present" stackId="a" radius={[0, 0, 0, 0]}>
                    {trendWithAvg.map((d) => <Cell key={d.label} fill={d.present >= 75 ? '#4ade80' : '#fbbf24'} />)}
                  </Bar>
                  <Bar dataKey="absent" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
                  <Line dataKey="avg" stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1.5} dot={{ r: 2, fill: '#3b82f6' }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="mt-1 flex flex-wrap justify-center gap-4 text-[11.5px] text-slate-600">
                {[['bg-emerald-400', 'Present'], ['bg-red-400', 'Absent'], ['bg-amber-400', 'Low day (<75%)'], ['bg-blue-500', 'Average Attendance']].map(([c, l]) => (
                  <span key={l} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${c}`} />{l}</span>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel icon={TrendingUp} title="Attendance by Day Type">
          <div className="flex flex-col items-center gap-3">
            <DonutChart
              segments={[
                { value: sumPresent, color: '#22c55e' },
                { value: sumAbsent, color: '#ef4444' },
                { value: notMarked, color: '#94a3b8' },
              ]}
              center={`${avgRate}%`}
            />
            <div className="w-full max-w-[240px] space-y-1.5 text-[13px]">
              {[
                ['bg-emerald-500', 'Present', sumPresent],
                ['bg-red-500', 'Absent', sumAbsent],
                ['bg-slate-400', 'Not Marked', notMarked],
              ].map(([c, l, v]) => (
                <div key={l} className="flex items-center gap-2">
                  <span className={`size-3 rounded-full ${c}`} />
                  <span className="flex-1 text-slate-700">{l}</span>
                  <span className="text-slate-800">{pct(v, possible)}% <span className="text-slate-500">({v})</span></span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel icon={BookOpen} title="Subject-wise Attendance">
          {subjectRates.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No subject attendance yet.</p>
          ) : (
            <div className="space-y-3">
              {subjectRates.map((s, i) => (
                <div key={s.subject} className="flex items-center gap-3 text-[13px]">
                  <span className="w-28 truncate text-slate-700">{s.subject}</span>
                  <div className="h-2 flex-1 rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${SUBJECT_BAR_COLORS[i % SUBJECT_BAR_COLORS.length]}`} style={{ width: `${s.total ? Math.max(s.rate, 2) : 0}%` }} />
                  </div>
                  <span className="w-9 text-right font-semibold text-slate-800">{s.total ? `${s.rate}%` : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Student list (full width), then Calendar | Recent + Low below it */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          icon={Users}
          title="Student Attendance List"
          className="lg:col-span-2"
          action={students[0]?.sessionSummary?.sessionName ? <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">Academic Year {students[0].sessionSummary.sessionName}</span> : null}
        >
          <div className="mb-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or roll number..." className="h-9 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-[13px] outline-none focus:border-blue-300" />
            </div>
            <div className="relative">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 w-36 appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-[13px] outline-none">
                <option value="all">All Status</option>
                <option value="present">Present today</option>
                <option value="absent">Absent today</option>
                <option value="unmarked">Not marked</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
          <div className="max-h-[260px] overflow-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr>{['#', 'Student Name', 'Roll No.', 'Working Days', 'Present Days', 'Absent Days', 'Attendance %', 'Today'].map((h) => <th key={h} className="whitespace-nowrap px-2.5 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-400">{loading ? 'Loading…' : 'No students found.'}</td></tr>
                ) : filteredRows.map((r, i) => (
                  <tr key={r._id} className="text-slate-800">
                    <td className="px-2.5 py-2 text-slate-500">{i + 1}</td>
                    <td className="px-2.5 py-2"><span className="flex items-center gap-2"><Avatar name={r.name} index={r.idx} src={r.profilePic} /><span className="truncate">{r.name}</span></span></td>
                    <td className="px-2.5 py-2 text-center">{r.roll ?? '—'}</td>
                    <td className="px-2.5 py-2 text-center text-slate-500">{r.schoolDays || '—'}</td>
                    <td className="px-2.5 py-2 text-center">{r.present}</td>
                    <td className={`px-2.5 py-2 text-center ${r.absent ? 'text-red-500' : ''}`}>{r.absent}</td>
                    <td className="px-2.5 py-2 text-center font-medium">{r.schoolDays || r.present + r.absent ? `${r.rate}%` : '—'}</td>
                    <td className="px-2.5 py-2">
                      <span className={`inline-block w-20 rounded-md py-0.5 text-center text-xs font-medium ${r.todayStatus === 'present' ? 'bg-emerald-50 text-emerald-600' : r.todayStatus === 'absent' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'}`}>
                        {r.todayStatus === 'present' ? 'Present' : r.todayStatus === 'absent' ? 'Absent' : 'Not Marked'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel icon={CalendarDays} title="Attendance Calendar">
          <div className="mb-2 flex items-center justify-between px-1">
            <button type="button" aria-label="Previous month" onClick={() => setCalendarMonth((k) => shiftMonth(k, -1))} className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"><ChevronLeft className="size-4" /></button>
            <span className="text-sm font-semibold text-slate-900">{monthLabel(calendarMonth, { month: 'long', year: 'numeric' })}</span>
            <button type="button" aria-label="Next month" onClick={() => setCalendarMonth((k) => shiftMonth(k, 1))} disabled={calendarMonth >= thisMonth} className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"><ChevronRight className="size-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <span key={d} className="py-1 text-slate-500">{d}</span>)}
            {calendarDays.map((c, i) => (
              <span
                key={c.key || `m${i}`}
                title={c.info ? `${c.info.present} present · ${c.info.absent} absent (${c.info.rate}%)` : c.holiday ? 'Holiday' : undefined}
                className={`flex h-7 items-center justify-center rounded-lg text-[12px] ${dayCellCls(c)}`}
              >
                {c.label}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-[11px] text-slate-600">
            {[['bg-emerald-400', 'Good (≥90%)'], ['bg-amber-400', '75–89%'], ['bg-red-400', 'Low (<75%)'], ['bg-slate-300', 'Holiday']].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${c}`} />{l}</span>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel icon={Clock} title="Recent Attendance">
            {recent.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No attendance yet.</p>
            ) : (
              <div className="space-y-1.5 text-[12px]">
                {recent.map((r) => (
                  <div key={r.key} className="grid grid-cols-[4.8rem_1fr_1fr_2.5rem] items-center gap-1.5">
                    <span className="text-slate-600">{shortDay(r.key)}</span>
                    {r.holiday ? (
                      <><span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">Holiday</span><span className="text-slate-400">-</span><span className="text-right text-slate-400">-</span></>
                    ) : (
                      <>
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-600">{r.present} Present</span>
                        <span className="rounded-md bg-red-50 px-2 py-0.5 text-red-500">{r.absent} Absent</span>
                        <span className="text-right font-semibold text-slate-800">{r.rate}%</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            icon={AlertTriangle}
            iconColor="text-red-500"
            title="Students with Low Attendance"
            action={lowAll.length > 0 ? (
              <button type="button" onClick={() => setLowModal({ focusId: '' })} className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600 hover:underline">
                View All ({lowAll.length}) <ChevronRight className="size-3.5" />
              </button>
            ) : null}
          >
            {lowAttendance.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Everyone is above 92%.</p>
            ) : (
              <div className="space-y-2">
                {lowAttendance.map((r) => (
                  <div key={r._id} className="flex items-center gap-2.5 text-[12.5px]">
                    <Avatar name={r.name} index={r.idx} src={r.profilePic} />
                    <span className="flex-1 truncate text-slate-800">{r.name}</span>
                    <span className={`w-10 text-right font-semibold ${r.rate < 90 ? 'text-red-500' : 'text-slate-800'}`}>{r.rate}%</span>
                    <button type="button" onClick={() => setLowModal({ focusId: String(r._id) })} className="rounded-md border border-slate-200 px-3 py-0.5 text-xs text-blue-600 hover:bg-blue-50">View</button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* Low-attendance students modal — scrollable table */}
      <AnimatePresence>
        {lowModal && (
          <Motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setLowModal(null)}
          >
            <Motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Students with low attendance"
              initial={{ scale: 0.96, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 10, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                  <AlertTriangle className="size-5 text-red-500" /> Students with Low Attendance
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">{lowAll.length}</span>
                </h3>
                <button type="button" onClick={() => setLowModal(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <XCircle className="size-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <table className="w-full text-left text-[12.5px]">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                    <tr>{['#', 'Student Name', 'Roll No.', 'Working Days', 'Present', 'Absent', 'Attendance %'].map((h) => <th key={h} className="whitespace-nowrap px-2.5 py-2 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lowAll.map((r, i) => (
                      <tr
                        key={r._id}
                        ref={(el) => { if (el && lowModal.focusId === String(r._id)) el.scrollIntoView({ block: 'nearest' }); }}
                        className={lowModal.focusId === String(r._id) ? 'bg-blue-50' : 'text-slate-800'}
                      >
                        <td className="px-2.5 py-2 text-slate-500">{i + 1}</td>
                        <td className="px-2.5 py-2"><span className="flex items-center gap-2"><Avatar name={r.name} index={r.idx} src={r.profilePic} /><span className="truncate">{r.name}</span></span></td>
                        <td className="px-2.5 py-2 text-center">{r.roll ?? '—'}</td>
                        <td className="px-2.5 py-2 text-center text-slate-500">{r.schoolDays || '—'}</td>
                        <td className="px-2.5 py-2 text-center">{r.present}</td>
                        <td className={`px-2.5 py-2 text-center ${r.absent ? 'text-red-500' : ''}`}>{r.absent}</td>
                        <td className={`px-2.5 py-2 text-center font-semibold ${r.rate < 90 ? 'text-red-500' : 'text-slate-800'}`}>{r.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </Motion.div>
  );
};

const DonutChart = ({ segments, center }) => {
  const r = 46;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  return (
    <div className="relative size-[116px] shrink-0">
      <svg viewBox="0 0 116 116" className="size-full -rotate-90">
        <circle cx="58" cy="58" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = <circle key={i} cx="58" cy="58" r={r} fill="none" stroke={s.color} strokeWidth="12" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-900">{center}</span>
        <span className="text-[11px] text-slate-500">Overall</span>
      </div>
    </div>
  );
};

export default ClassAttendanceOverview;
