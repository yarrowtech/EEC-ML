import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowUp,
  ArrowDown,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Leaf,
  Megaphone,
  MessageSquare,
  Users,
  Wallet,
  X,
  UsersRound,
} from 'lucide-react';
import { parentApiJson } from './parentApi';
import useParentChildren from './useParentChildren';
import { normalizeReportCard } from './reportCardShape';

// Dashboard entrance: each section fades and rises in, one after another.
const RISE = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

/* ── helpers ─────────────────────────────────────────────────────────────── */
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const validDate = (v) => v && !Number.isNaN(new Date(v).getTime());
const fmtDate = (d) => (validDate(d) ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const to12h = (t) => {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(t || '');
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};
const initialsOf = (name) => String(name || 'S').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const subjectName = (s) => s?.subject?.name || s?.subjectName || s?.subject || '';
const greetingFor = (h) => (h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening');
const DASHBOARD_CACHE_PREFIX = 'parent_dashboard_cache_v1';
const DASHBOARD_CACHE_TTL_MS = 3 * 60 * 1000;

const getTokenScope = () => {
  const token = localStorage.getItem('token');
  if (!token) return 'anonymous';
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return `${payload?.id || 'parent'}__`;
  } catch {
    return 'fallback';
  }
};

const dashboardCacheKey = (segment) => `${DASHBOARD_CACHE_PREFIX}:${segment}:${getTokenScope()}`;

const readDashboardCache = (segment) => {
  try {
    const raw = sessionStorage.getItem(dashboardCacheKey(segment));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.cachedAt || Date.now() - parsed.cachedAt > DASHBOARD_CACHE_TTL_MS) return null;
    return parsed.data || null;
  } catch {
    return null;
  }
};

const writeDashboardCache = (segment, data) => {
  try {
    sessionStorage.setItem(dashboardCacheKey(segment), JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {
    // Storage is best-effort; the dashboard still works without it.
  }
};

const useCountUp = (target, duration = 900) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const end = Number(target) || 0;
    if (end <= 0) {
      setValue(0);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(end * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
};

const SUBJECT_TONES = [
  { tile: 'bg-green-50 text-green-700', icon: 'bg-violet-50 text-violet-600' },
  { tile: 'bg-blue-50 text-blue-700', icon: 'bg-red-50 text-red-500' },
  { tile: 'bg-red-50 text-red-600', icon: 'bg-sky-50 text-sky-600' },
  { tile: 'bg-violet-50 text-violet-700', icon: 'bg-amber-50 text-amber-600' },
  { tile: 'bg-amber-50 text-amber-700', icon: 'bg-green-50 text-green-600' },
];

/* ── small building blocks ───────────────────────────────────────────────── */
const Card = ({ className = '', children }) => (
  <section className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:p-5 ${className}`}>{children}</section>
);

const CardHead = ({ title, to, linkLabel = 'View All', right }) => (
  <div className="mb-3 flex items-start justify-between gap-3">
    <h2 className="min-w-0 text-base font-bold leading-snug text-slate-900">{title}</h2>
    {right || (to ? <Link to={to} className="shrink-0 whitespace-nowrap pt-0.5 text-sm font-semibold text-blue-600 hover:text-blue-700">{linkLabel}</Link> : null)}
  </div>
);

const Delta = ({ value }) => {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return null;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${up ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
      {up ? <ArrowUp size={12} strokeWidth={3} /> : <ArrowDown size={12} strokeWidth={3} />}{Math.abs(value)}%
    </span>
  );
};

const StatCard = ({ to, Icon, tone, fillIcon = false, label, value, animatedValue, formatter, delta, sub, sub2 }) => {
  const count = useCountUp(animatedValue ?? 0);
  const displayValue = animatedValue === null || animatedValue === undefined
    ? value
    : (formatter ? formatter(count) : count.toLocaleString('en-IN'));
  return (
    <Link to={to} className="group relative flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-4 pr-8 shadow-[0_2px_12px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-md">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={22} fill={fillIcon ? "currentColor" : "none"} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <p className="truncate text-2xl font-bold leading-tight text-slate-900 tabular-nums">{displayValue}</p>
          <Delta value={delta} />
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">{sub}</p>
        {sub2 ? <p className="mt-0.5 truncate text-xs font-semibold text-red-500">{sub2}</p> : null}
      </div>
      <ChevronRight size={17} className="absolute right-3 top-4 text-slate-400 transition group-hover:translate-x-0.5" />
    </Link>
  );
};

// Soft school-building line art for the child banner (right side).
const BannerBuilding = () => (
  <svg viewBox="0 0 420 140" className="h-full w-auto" aria-hidden="true">
    <g fill="none" stroke="#b9c7de" strokeWidth="1.5" opacity="0.85">
      <rect x="90" y="52" width="240" height="84" fill="#eef3fb" />
      <polygon points="80,54 210,14 340,54" fill="#e4ebf7" />
      <rect x="180" y="30" width="60" height="106" fill="#e9eff9" />
      <polygon points="172,34 210,6 248,34" fill="#dfe7f5" />
      {[104, 132, 160, 262, 290, 316].map((x) => (
        <g key={x}><rect x={x} y="66" width="16" height="22" fill="#fff" /><rect x={x} y="100" width="16" height="22" fill="#fff" /></g>
      ))}
      <path d="M196 136 v-26 a14 14 0 0 1 28 0 v26" fill="#dfe7f5" />
      <circle cx="210" cy="50" r="8" fill="#fff" />
    </g>
    <g fill="#cfe3d4" opacity="0.8">
      <ellipse cx="46" cy="104" rx="26" ry="34" />
      <ellipse cx="380" cy="108" rx="24" ry="30" />
    </g>
  </svg>
);

/* ── dashboard ───────────────────────────────────────────────────────────── */
const ParentDashboard = ({ parentName = '' }) => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { children, options, setChildKey, selected: child, loading: childLoading, school } = useParentChildren();
  const coverImage = school?.coverImage || '';
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  const cachedPortalData = useMemo(() => readDashboardCache('portal'), []);
  const [attendanceKids, setAttendanceKids] = useState(() => cachedPortalData?.attendanceKids || []);
  const [invoices, setInvoices] = useState([]);
  const [reportCards, setReportCards] = useState(() => (cachedPortalData?.reportCards || []).map(normalizeReportCard));
  const [examKids, setExamKids] = useState(() => cachedPortalData?.examKids || []);
  const [homework, setHomework] = useState([]);
  const [notices, setNotices] = useState(() => cachedPortalData?.notices || []);
  const [meetings, setMeetings] = useState(() => cachedPortalData?.meetings || []);
  const [holidays, setHolidays] = useState(() => cachedPortalData?.holidays || []);

  // School-wide sources — once.
  useEffect(() => {
    let off = false;
    Promise.allSettled([
      parentApiJson('/api/attendance/parent/children', {}, navigate),
      parentApiJson('/api/reports/report-cards/parent', {}, navigate),
      parentApiJson('/api/exam/groups/parent-schedule', {}, navigate),
      parentApiJson('/api/notifications/user?kind=notice', {}, navigate),
      parentApiJson('/api/meeting/parent/my-meetings', {}, navigate),
      parentApiJson('/api/holidays/parent', {}, navigate),
    ]).then(([a, r, e, n, m, h]) => {
      if (off) return;
      const ok = (x) => (x.status === 'fulfilled' ? x.value : null);
      const nextPortalData = {
        attendanceKids: ok(a)?.children || [],
        reportCards: ok(r)?.reportCards || [],
        examKids: ok(e)?.children || [],
        notices: Array.isArray(ok(n)) ? ok(n) : [],
        meetings: Array.isArray(ok(m)) ? ok(m) : [],
        holidays: (() => {
          const hv = ok(h);
          return Array.isArray(hv) ? hv : hv?.holidays || [];
        })(),
      };
      setAttendanceKids(nextPortalData.attendanceKids);
      setReportCards(nextPortalData.reportCards.map(normalizeReportCard));
      setExamKids(nextPortalData.examKids);
      setNotices(nextPortalData.notices);
      setMeetings(nextPortalData.meetings);
      setHolidays(nextPortalData.holidays);
      writeDashboardCache('portal', nextPortalData);
    });
    return () => { off = true; };
  }, [navigate]);

  // Per-child sources.
  useEffect(() => {
    if (!child?.id) return undefined;
    const childCacheKey = `child:${child.id}`;
    const cachedChildData = readDashboardCache(childCacheKey);
    if (cachedChildData) {
      setInvoices(cachedChildData.invoices || []);
      setHomework(cachedChildData.homework || []);
    }

    let off = false;
    const q = encodeURIComponent(child.id);
    Promise.allSettled([
      parentApiJson(`/api/fees/parent/invoices?studentId=${q}`, {}, navigate),
      parentApiJson(`/api/assignment/parent/assignments?studentId=${q}`, {}, navigate),
    ]).then(([f, hw]) => {
      if (off) return;
      const nextChildData = {
        invoices: f.status === 'fulfilled' ? (f.value?.invoices || []) : [],
        homework: hw.status === 'fulfilled' && Array.isArray(hw.value) ? hw.value : [],
      };
      setInvoices(nextChildData.invoices);
      setHomework(nextChildData.homework);
      writeDashboardCache(childCacheKey, nextChildData);
    });
    return () => { off = true; };
  }, [child?.id, navigate]);

  useEffect(() => {
    const close = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  /* ── derived: attendance ── */
  const attendance = useMemo(() => {
    const entry = attendanceKids.find((k) => String(k?.student?._id || k?.student?.id) === String(child?.id)) || null;
    const records = Array.isArray(entry?.records) ? entry.records : [];
    const now = new Date();
    const monthKey = (d) => String(d).slice(0, 7);
    const thisM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevM = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const pct = (list) => (list.length ? Math.round((list.filter((r) => r.status === 'present').length / list.length) * 100) : null);
    const cur = records.filter((r) => monthKey(r.date) === thisM);
    const last = records.filter((r) => monthKey(r.date) === prevM);
    const summary = entry?.monthlySummary || {};
    const percent = pct(cur) ?? summary.attendancePercentage ?? 0;
    const lastPct = pct(last);
    const today = records.find((r) => r.date === dayKey(now));
    return {
      percent,
      delta: lastPct === null ? null : percent - lastPct,
      present: cur.length ? cur.filter((r) => r.status === 'present').length : summary.presentDays || 0,
      total: cur.length || summary.totalClasses || 0,
      today,
    };
  }, [attendanceKids, child?.id]);

  /* ── derived: fees ── */
  const fees = useMemo(() => {
    const open = invoices.filter((i) => Number(i.balanceAmount) > 0)
      .sort((a, b) => new Date(a.dueDate || 8.64e15) - new Date(b.dueDate || 8.64e15));
    const due = open.reduce((s, i) => s + Number(i.balanceAmount || 0), 0);
    const focus = open[0] || invoices.slice().sort((a, b) => new Date(b.dueDate || 0) - new Date(a.dueDate || 0))[0] || null;
    const total = Number(focus?.totalAmount || 0) - Number(focus?.discountAmount || 0);
    const paid = Number(focus?.paidAmount || 0);
    return { due, focus, total: Math.max(total, 0), paid, balance: Number(focus?.balanceAmount || 0) };
  }, [invoices]);

  /* ── derived: marks / results ── */
  const results = useMemo(() => {
    const card = reportCards.find((c) => String(c.studentId) === String(child?.id)) || null;
    const exams = card?.exams || [];
    const byExam = new Map();
    exams.forEach((x) => {
      const key = x.examName || x.term || 'Exam';
      if (!byExam.has(key)) byExam.set(key, { name: key, date: x.date, rows: [] });
      const g = byExam.get(key);
      if (validDate(x.date) && (!validDate(g.date) || new Date(x.date) > new Date(g.date))) g.date = x.date;
      g.rows.push(x);
    });
    const groups = [...byExam.values()].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const avg = (g) => {
      const ob = g.rows.reduce((s, r) => s + Number(r.obtainedMarks || 0), 0);
      const tot = g.rows.reduce((s, r) => s + Number(r.totalMarks || 0), 0);
      return tot > 0 ? Math.round((ob / tot) * 100) : null;
    };
    const recent = groups.slice(0, 3).map(avg).filter((v) => v !== null);
    const average = recent.length ? Math.round(recent.reduce((s, v) => s + v, 0) / recent.length) : null;
    const delta = groups.length >= 2 && avg(groups[0]) !== null && avg(groups[1]) !== null ? avg(groups[0]) - avg(groups[1]) : null;
    return { latest: groups[0] || null, average, delta, count: recent.length };
  }, [reportCards, child?.id]);

  /* ── derived: exams / events ── */
  const upcomingExams = useMemo(() => {
    const kid = examKids.find((c) => String(c.studentId) === String(child?.id)) || examKids[0];
    const today = new Date(new Date().toDateString());
    const rows = [];
    (kid?.groups || []).forEach((g) => (g.subjects || []).forEach((s) => {
      if (validDate(s.date) && new Date(s.date) >= today) rows.push({ date: new Date(s.date), subject: subjectName(s) || g.title || 'Exam', name: `${subjectName(s)} ${g.title || ''}`.trim(), time: to12h(s.startTime || s.time) });
    }));
    return rows.sort((a, b) => a.date - b.date);
  }, [examKids, child?.id]);

  const events = useMemo(() => {
    const today = new Date(new Date().toDateString());
    const list = [];
    upcomingExams.slice(0, 3).forEach((x) => list.push({ kind: 'exam', date: x.date, title: x.name, sub: `${fmtDate(x.date)}${x.time ? `  |  ${x.time}` : ''}` }));
    meetings.forEach((m) => {
      if (!validDate(m.meetingDate) || new Date(m.meetingDate) < today) return;
      if (m.studentId && child?.id && String(m.studentId?._id || m.studentId) !== String(child.id)) return;
      list.push({ kind: 'ptm', date: new Date(m.meetingDate), title: m.title || 'Parent Teacher Meeting', sub: `${fmtDate(m.meetingDate)}${m.meetingTime ? `  |  ${to12h(m.meetingTime)}` : ''}` });
    });
    holidays.forEach((h) => {
      const start = h.startDate || h.date;
      if (!validDate(start)) return;
      const end = validDate(h.endDate) ? h.endDate : start;
      if (new Date(end) < today) return;
      const s = new Date(start);
      const e = new Date(end);
      const range = dayKey(s) === dayKey(e)
        ? fmtDate(s)
        : `${s.getDate()} – ${fmtDate(e)}`;
      list.push({ kind: 'holiday', date: s, title: h.name || h.title || 'Holiday', sub: range });
    });
    return list.sort((a, b) => a.date - b.date).slice(0, 3);
  }, [upcomingExams, meetings, holidays, child?.id]);

  const recentHomework = useMemo(
    () => homework.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 3),
    [homework],
  );
  const recentNotices = useMemo(
    () => notices.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 3),
    [notices],
  );

  const firstName = String(parentName || '').trim();
  const greeting = `${greetingFor(new Date().getHours())}${firstName ? `, ${firstName}` : ''}`;
  const nextExam = upcomingExams[0];
  const todayLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ` (${new Date().toLocaleDateString('en-US', { weekday: 'short' })})`;
  const todayStatus = attendance.today?.status;
  const classLine = child ? `Class ${child.grade || '—'}${child.section ? ` - Section ${child.section}` : ''}` : '';
  const Avatar = ({ size = 'h-12 w-12', text = 'text-base' }) => (child?.photo ? (
    <img src={child.photo} alt={child.name} className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} ${text} flex shrink-0 items-center justify-center rounded-xl bg-violet-100 font-bold text-violet-700`}>{initialsOf(child?.name)}</span>
  ));

  return (
    <motion.div
      data-testid="parent-dashboard"
      className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 bg-slate-50 p-3 sm:gap-5 sm:p-4 lg:p-6"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: reduceMotion ? 0 : 0.08, delayChildren: 0.05 } } }}
    >
      {/* ── Greeting + child picker ── */}
      <motion.div variants={RISE} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{greeting}
            {/* <span aria-hidden="true">👋</span> */}
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">Here&apos;s an overview of your child&apos;s academic journey.</p>
        </div>
        {child && (
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => options.length > 1 && setPickerOpen((o) => !o)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 pr-4 text-left shadow-sm sm:w-72"
              aria-haspopup={options.length > 1 ? 'listbox' : undefined}
              aria-expanded={pickerOpen}
            >
              <Avatar size="h-10 w-10" text="text-sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900">{child.name}</span>
                <span className="block truncate text-xs text-slate-500">{classLine}</span>
              </span>
              {options.length > 1 && <ChevronDown size={17} className={`text-slate-500 transition ${pickerOpen ? 'rotate-180' : ''}`} />}
            </button>
            {pickerOpen && (
              <ul role="listbox" className="absolute right-0 z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
                {children.map((c, i) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => { const o = options[i]; setChildKey(`${o.id || ''}::${o.name || ''}`); setPickerOpen(false); }}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 ${c.id === child.id ? 'bg-violet-50' : ''}`}
                    >
                      {c.photo ? <img src={c.photo} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">{initialsOf(c.name)}</span>}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-800">{c.name}</span>
                        <span className="block text-xs text-slate-500">Class {c.grade}{c.section ? ` - Section ${c.section}` : ''}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Child banner ── */}
      <motion.section variants={RISE} className="relative overflow-hidden rounded-2xl border border-blue-100 bg-linear-to-r from-sky-50 via-blue-50 to-sky-100/70">
        {coverImage ? (
          // School cover photo, blurred and washed out so the text stays readable.
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute -inset-4 scale-105 bg-cover bg-center opacity-60 blur-[3px]"
              style={{ backgroundImage: `url(${coverImage})` }}
            />
            <div className="absolute inset-0 bg-linear-to-r from-sky-50/95 via-sky-50/70 to-white/30" />
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-y-0 right-24 hidden opacity-70 md:block lg:right-56"><BannerBuilding /></div>
        )}
        <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          {child ? <Avatar size="h-20 w-20 sm:h-24 sm:w-24" text="text-2xl" /> : <span className="h-20 w-20 animate-pulse rounded-xl bg-white/70" />}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{child?.name || (childLoading ? 'Loading…' : 'No child linked')}</h2>
            {child && <p className="mt-1 text-sm font-semibold text-slate-800 sm:text-base">{classLine}</p>}
            {child && (
              <p className="mt-2 text-sm text-slate-500">
                Admission No: <strong>{child.admissionNumber || child.studentCode || '—'}</strong>
                <span className="mx-2 text-slate-300">|</span>
                Roll No: <strong>{child.roll !== '' && child.roll !== null && child.roll !== undefined ? child.roll : '—'}</strong>
              </p>
            )}
          </div>
          <p className="hidden shrink-0 rotate-[-4deg] text-right font-[cursive] text-xl leading-snug text-slate-700 lg:block">
            “Keep learning,<br />&nbsp;&nbsp;keep growing!” <span className="text-amber-400">☀</span>
          </p>
        </div>
      </motion.section>

      {/* ── Stat cards ── */}
      <motion.div variants={RISE} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        <StatCard
          to="/parents/attendance"
          Icon={UsersRound}
          tone="bg-green-50 text-green-600"
          fillIcon
          label="Attendance"
          value={`${attendance.percent}%`}
          animatedValue={attendance.percent}
          formatter={(n) => `${n}%`}
          delta={attendance.delta}
          sub={`Present: ${attendance.present} / ${attendance.total} days`}
        />
        <StatCard to="/parents/fees" Icon={Wallet} tone="bg-red-50 text-red-500"  label="Fee Due"
          // value={inr(fees.due)} animatedValue={fees.due} formatter={inr} sub={fees.focus ? (fees.focus.title || 'Fees') : 'No fees due'} sub2={fees.focus && validDate(fees.focus.dueDate) ? `Due date: ${fmtDate(fees.focus.dueDate)}` : ''} />
          value={inr(fees.due)} animatedValue={fees.due} formatter={inr} sub2={fees.focus && validDate(fees.focus.dueDate) ? `Due: ${fmtDate(fees.focus.dueDate)}` : ''} />
        <StatCard to="/parents/academic" Icon={BarChart3} tone="bg-violet-50 text-violet-600" label="Average Marks"
          value={results.average === null ? '—' : `${results.average}%`} animatedValue={results.average ?? null} formatter={(n) => `${n}%`} delta={results.delta} sub={results.count ? `Last ${results.count} Exam${results.count > 1 ? 's' : ''}` : 'No results yet'} />
        {/* <StatCard to="/parents/exam-routine" Icon={CalendarDays} tone="bg-amber-50 text-amber-500" label="Upcoming Exam"
          value={nextExam ? '1 Scheduled' : '0 Scheduled'} animatedValue={nextExam ? 1 : 0} formatter={(n) => (n > 0 ? '1 Scheduled' : '0 Scheduled')} sub={nextExam ? `${nextExam.name} | ${fmtDate(nextExam.date)}${nextExam.time ? ` | ${nextExam.time}` : ''}` : 'Check back later'} /> */}
        <StatCard
          to="/parents/exam-routine"
          Icon={CalendarDays}
          tone="bg-amber-50 text-amber-500"
          label="Upcoming Exam"
          value={nextExam ? nextExam.subject : 'No Upcoming Exam'}
          animatedValue={null}
          sub={
            nextExam
              ? `${fmtDate(nextExam.date)}${nextExam.time ? ` | ${nextExam.time}` : ''}`
              : 'Check back later'
          }
        />
      </motion.div>

      {/* -- Today / Fee summary / Events -- */}
      <motion.div variants={RISE} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHead title="Today's Attendance" right={<span className="text-sm text-slate-500">{todayLabel}</span>} />
          <Link
            to="/parents/attendance"
            className={`flex items-center gap-4 rounded-xl border px-4 py-4 transition hover:shadow-sm ${todayStatus === 'present' ? 'border-green-200 bg-green-50' : todayStatus === 'absent' ? 'border-red-100 bg-red-50' : 'border-slate-100 bg-slate-50'
              }`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${todayStatus === 'present' ? 'bg-green-600' : todayStatus === 'absent' ? 'bg-red-500' : 'bg-slate-400'
              }`}>
              {todayStatus === 'absent' ? <X size={22} strokeWidth={3} /> : <Check size={22} strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-lg font-bold leading-tight ${todayStatus === 'present' ? 'text-green-700' : todayStatus === 'absent' ? 'text-red-600' : 'text-slate-600'}`}>
                {todayStatus === 'present' ? 'Present' : todayStatus === 'absent' ? 'Absent' : 'Not marked yet'}
              </span>
              <span className="mt-0.5 block text-xs text-slate-600">
                {todayStatus ? (attendance.today?.markedAt ? `Marked at ${new Date(attendance.today.markedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'Marked for today') : 'Attendance will appear once the teacher marks it'}
              </span>
            </span>
            <ChevronRight size={18} className="text-slate-500" />
          </Link>
        </Card>

        <Card>
          <CardHead title="Fee Summary" to="/parents/fees" linkLabel="View Details" />
          {fees.focus ? (
            <>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-green-500" style={{ width: `${fees.total > 0 ? Math.min(100, (fees.paid / fees.total) * 100) : 0}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="min-w-0"><p className="text-xs text-slate-500">Paid</p><p className="truncate text-base font-bold text-slate-900" title={inr(fees.paid)}>{inr(fees.paid)}</p></div>
                <div className="min-w-0"><p className="text-xs text-slate-500">Due</p><p className="truncate text-base font-bold text-red-600" title={inr(fees.balance)}>{inr(fees.balance)}</p></div>
                <div className="min-w-0"><p className="text-xs text-slate-500">Total</p><p className="truncate text-base font-bold text-slate-900" title={inr(fees.total)}>{inr(fees.total)}</p></div>
              </div>
              <div className="mt-4">
                {fees.balance > 0 && (
                  <Link to="/parents/fees" className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                    <CreditCard size={18} /> Pay Now
                  </Link>
                )}
              </div>
            </>
          ) : <p className="rounded-xl bg-slate-50 py-6 text-center text-sm text-slate-500">No fee invoices yet</p>}
        </Card>

        <Card>
          <CardHead title="Upcoming Events" to="/parents/calendar" />
          {events.length === 0 ? <p className="rounded-xl bg-slate-50 py-6 text-center text-sm text-slate-500">Nothing coming up</p> : (
            <ul className="space-y-1">
              {events.map((ev, i) => {
                const cfg = ev.kind === 'exam'
                  ? { Icon: CalendarDays, cls: 'bg-blue-50 text-blue-600' }
                  : ev.kind === 'ptm' ? { Icon: Users, cls: 'bg-red-50 text-red-500' } : { Icon: Leaf, cls: 'bg-green-50 text-green-600' };
                return (
                  <li key={i} className="flex items-center gap-3 py-1.5">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.cls}`}><cfg.Icon size={17} /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{ev.title}</span>
                      <span className="block truncate text-xs text-slate-500">{ev.sub}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </motion.div>
      {/* ── Homework / Notices ── */}
      <motion.div variants={RISE} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="Recent Homework" to="/parents/homework" />
          {recentHomework.length === 0 ? <p className="rounded-xl bg-slate-50 py-6 text-center text-sm text-slate-500">No homework yet</p> : (
            <ul className="divide-y divide-slate-100">
              {recentHomework.map((a, i) => {
                const pending = !a.submissionStatus || a.submissionStatus === 'not_submitted';
                const tone = SUBJECT_TONES[i % SUBJECT_TONES.length].icon;
                return (
                  <li key={a._id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}><BookOpen size={20} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{subjectName(a) || 'General'}</span>
                      <span className="block line-clamp-2 text-sm text-slate-600" title={a.title}>{a.title}</span>
                      {validDate(a.dueDate) && <span className="mt-0.5 block text-xs text-slate-500">Due: {fmtDate(a.dueDate)}</span>}
                    </span>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${pending ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-600'}`}>
                      {pending ? 'Pending' : 'Submitted'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title="Recent Notices" to="/parents/notices" />
          {recentNotices.length === 0 ? <p className="rounded-xl bg-slate-50 py-6 text-center text-sm text-slate-500">No notices yet</p> : (
            <ul className="divide-y divide-slate-100">
              {recentNotices.map((n) => {
                const label = String(n.typeLabel || n.title || '').toLowerCase();
                const cfg = /holiday/.test(label) ? { Icon: Megaphone, cls: 'bg-red-50 text-red-500' }
                  : /ptm|meeting|parent/.test(label) ? { Icon: Users, cls: 'bg-violet-50 text-violet-600' }
                    : { Icon: FileText, cls: 'bg-blue-50 text-blue-600' };
                return (
                  <li key={n._id} className="py-1.5 first:pt-0 last:pb-0">
                    <Link
                      to="/parents/notices"
                      state={{ openNoticeId: n._id }}
                      className="-mx-2 flex items-start gap-3 rounded-xl px-2 py-1.5 transition hover:bg-slate-50"
                    >
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cfg.cls}`}><cfg.Icon size={20} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{n.title}</span>
                        {n.message ? <span className="block truncate text-sm text-slate-600">{n.message}</span> : null}
                      </span>
                      <span className="shrink-0 text-sm text-slate-500">{fmtDate(n.createdAt)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </motion.div>

      {/* ── Latest result / Quick actions ── */}
      <motion.div variants={RISE} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="Latest Exam Result" to="/parents/academic" />
          {results.latest ? (
            <div className="rounded-xl border border-slate-100 p-3">
              <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1">
                <span className="text-sm font-bold text-slate-900">{results.latest.name}</span>
                {validDate(results.latest.date) && <span className="text-sm text-slate-500">{fmtDate(results.latest.date)}</span>}
                <Link to="/parents/academic" className="ml-auto rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100">View Report Card</Link>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
                {results.latest.rows.map((r, i) => (
                  <div key={`${r.subject}-${i}`} className={`rounded-xl px-3 py-2.5 ${SUBJECT_TONES[i % SUBJECT_TONES.length].tile}`}>
                    <p className="text-sm font-medium leading-snug wrap-break-word">{r.subject || 'Subject'}</p>
                    <p className="text-lg font-bold">{Number(r.obtainedMarks || 0)}/{Number(r.totalMarks || 0)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="rounded-xl bg-slate-50 py-6 text-center text-sm text-slate-500">No published results yet</p>}
        </Card>

        <Card>
          <CardHead title="Quick Actions" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {[
              { to: '/parents/fees', label: 'Pay Fees', Icon: Wallet, cls: 'bg-red-50 text-red-500' },
              { to: '/parents/attendance', label: 'View Attendance', Icon: Users, cls: 'bg-green-50 text-green-600' },
              { to: '/parents/academic', label: 'Check Results', Icon: BarChart3, cls: 'bg-violet-50 text-violet-600' },
              { to: '/parents/excuse-letters', label: 'Apply Leave', Icon: ClipboardList, cls: 'bg-amber-50 text-amber-500' },
              { to: '/parents/chat', label: 'Send Message', Icon: MessageSquare, cls: 'bg-blue-50 text-blue-600' },
            ].map(({ to, label, Icon, cls }) => (
              <Link key={to} to={to} className="group flex flex-col items-center gap-2 text-center">
                <span className={`flex h-16 w-full max-w-20 items-center justify-center rounded-2xl transition group-hover:-translate-y-0.5 ${cls}`}><Icon size={24} /></span>
                <span className="text-xs font-medium text-slate-700 sm:text-sm">{label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default ParentDashboard;










