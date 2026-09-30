import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileText,
  Heart,
  Lightbulb,
  MessageSquareText,
  MessagesSquare,
  Palette,
  PersonStanding,
  Settings2,
  Sprout,
  Star,
  Trophy,
  Users,
} from 'lucide-react';
import { parentApiJson } from './parentApi';
import useParentChildren from './useParentChildren';
import { normalizeReportCard } from './reportCardShape';

// Child Growth Analysis — one simple view of academics, skills, attendance
// and holistic development for the selected child.

/* ── helpers ─────────────────────────────────────────────────────────────── */
const validDate = (v) => v && !Number.isNaN(new Date(v).getTime());
const fmtDate = (d) => (validDate(d) ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const avg = (list) => { const v = list.filter((n) => Number.isFinite(n)); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
const initials = (n) => String(n || 'S').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const BAR_COLORS = ['#60a5fa', '#a78bfa', '#6ee7a7', '#fdba74', '#f87171', '#67e8f9', '#818cf8', '#f9a8d4', '#fcd34d'];
const EXAM_TILES = [
  { bg: 'bg-blue-50', icon: 'text-blue-600', value: 'text-blue-600' },
  { bg: 'bg-violet-50', icon: 'text-violet-600', value: 'text-violet-600' },
  { bg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-600' },
  { bg: 'bg-orange-50', icon: 'text-orange-500', value: 'text-orange-500' },
];
const levelOf = (score) => {
  if (score === null || score === undefined) return 'Not rated';
  if (score >= 85) return 'Very Good';
  if (score >= 65) return 'Good';
  if (score >= 45) return 'Average';
  return 'Needs Support';
};

const Delta = ({ value }) => {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return null;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-bold ${up ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
      {up ? <ArrowUp size={11} strokeWidth={3} /> : <ArrowDown size={11} strokeWidth={3} />}{Math.abs(value)}%
    </span>
  );
};

const Card = ({ className = '', children }) => (
  <section className={`flex h-[230px] flex-col rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:p-4 ${className}`}>{children}</section>
);
const CardHead = ({ Icon, iconCls, title, subtitle, right }) => (
  <div className="mb-3 flex items-start justify-between gap-3">
    <div className="flex items-start gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconCls}`}><Icon size={18} /></span>
      <div>
        <h2 className="text-[15px] font-bold leading-tight text-slate-900">{title}</h2>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
    {right}
  </div>
);
const ViewAll = ({ to, label = '' }) => (
  <Link to={to} className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-blue-600 hover:text-blue-700">{label}{label !== '' ? <ChevronRight size={15} /> : null}</Link>
);

// Client cache → instant repeat visits; refreshed in the background.
const CACHE_MAX_AGE = 10 * 60 * 1000;
const tokenTail = () => { try { return (localStorage.getItem('token') || '').slice(-16); } catch { return ''; } };
const mem = new Map();
const readCache = (name) => {
  const key = `parent:growth:v1:${tokenTail()}:${name}`;
  let entry = mem.get(key);
  if (!entry) { try { entry = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { entry = null; } }
  return entry && Date.now() - entry.at < CACHE_MAX_AGE ? entry.data : null;
};
const writeCache = (name, data) => {
  const key = `parent:growth:v1:${tokenTail()}:${name}`;
  const entry = { at: Date.now(), data };
  mem.set(key, entry);
  try { sessionStorage.setItem(key, JSON.stringify(entry)); } catch { /* quota */ }
};

const RISE = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } };

/* ── page ────────────────────────────────────────────────────────────────── */
const ChildGrowthAnalytics = () => {
  const navigate = useNavigate();
  const { children, options, setChildKey, selected: child } = useParentChildren();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  const [reportCards, setReportCards] = useState(() => (readCache('shared')?.reportCards || []).map(normalizeReportCard));
  const [academic, setAcademic] = useState(null);
  const [skills, setSkills] = useState(null);
  const [wellbeing, setWellbeing] = useState(null);
  const [remarks, setRemarks] = useState(() => readCache('shared')?.remarks || []);
  const [examWindow, setExamWindow] = useState(3);

  useEffect(() => {
    let off = false;
    Promise.allSettled([
      parentApiJson('/api/reports/report-cards/parent', {}, navigate),
      parentApiJson('/api/parent-dashboard/remarks-feed', {}, navigate),
    ]).then(([r, m]) => {
      if (off) return;
      const cached = readCache('shared') || {};
      const next = {
        reportCards: r.status === 'fulfilled' ? (r.value?.reportCards || []) : (cached.reportCards || []),
        remarks: m.status === 'fulfilled' ? (m.value?.data || []) : (cached.remarks || []),
      };
      setReportCards(next.reportCards.map(normalizeReportCard));
      setRemarks(next.remarks);
      writeCache('shared', next);
    });
    return () => { off = true; };
  }, [navigate]);

  useEffect(() => {
    if (!child?.id) return undefined;
    let off = false;
    const id = encodeURIComponent(child.id);
    const cachedChild = readCache(`child:${child.id}`);
    if (cachedChild) {
      setAcademic(cachedChild.academic);
      setSkills(cachedChild.skills);
      setWellbeing(cachedChild.wellbeing);
    }
    Promise.allSettled([
      parentApiJson(`/api/parent-dashboard/analytics/academic/${id}`, {}, navigate),
      parentApiJson(`/api/parent-dashboard/analytics/skills/${id}`, {}, navigate),
      parentApiJson(`/api/parent-dashboard/analytics/wellbeing/${id}`, {}, navigate),
    ]).then(([a, s, w]) => {
      if (off) return;
      const next = {
        academic: a.status === 'fulfilled' ? a.value?.data || null : cachedChild?.academic || null,
        skills: s.status === 'fulfilled' ? s.value?.data || null : cachedChild?.skills || null,
        wellbeing: w.status === 'fulfilled' ? w.value?.data || null : cachedChild?.wellbeing || null,
      };
      setAcademic(next.academic);
      setSkills(next.skills);
      setWellbeing(next.wellbeing);
      writeCache(`child:${child.id}`, next);
    });
    return () => { off = true; };
  }, [child?.id, navigate]);

  useEffect(() => {
    const close = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  /* ── exams (published report card) ── */
  const exams = useMemo(() => {
    const card = reportCards.find((c) => String(c.studentId) === String(child?.id)) || null;
    const byExam = new Map();
    (card?.exams || []).forEach((x) => {
      const key = x.examName || x.term || 'Exam';
      if (!byExam.has(key)) byExam.set(key, { name: key, date: x.date, rows: [] });
      const g = byExam.get(key);
      if (validDate(x.date) && (!validDate(g.date) || new Date(x.date) > new Date(g.date))) g.date = x.date;
      g.rows.push(x);
    });
    return [...byExam.values()].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [reportCards, child?.id]);
  const pct = (r) => (Number(r.totalMarks) > 0 ? Math.round((Number(r.obtainedMarks || 0) / Number(r.totalMarks)) * 100) : null);
  const examPct = (g) => {
    const ob = g.rows.reduce((s, r) => s + Number(r.obtainedMarks || 0), 0);
    const tot = g.rows.reduce((s, r) => s + Number(r.totalMarks || 0), 0);
    return tot > 0 ? Math.round((ob / tot) * 100) : null;
  };

  const subjectBars = useMemo(() => {
    const map = new Map();
    exams.slice(0, examWindow).forEach((g) => g.rows.forEach((r) => {
      const p = pct(r);
      if (p === null || !r.subject) return;
      if (!map.has(r.subject)) map.set(r.subject, []);
      map.get(r.subject).push(p);
    }));
    let list = [...map.entries()].map(([subject, list2]) => ({ subject, value: avg(list2) }));
    if (!list.length && academic?.subjectBreakdown?.length) {
      list = academic.subjectBreakdown.map((s) => ({ subject: s.subject, value: s.avg }));
    }
    return list;
  }, [exams, examWindow, academic]);

  /* ── stat cards ── */
  const academicScore = avg(subjectBars.map((b) => b.value)) ?? academic?.overallMastery ?? null;
  const academicDelta = exams.length >= 2 && examPct(exams[0]) !== null && examPct(exams[1]) !== null ? examPct(exams[0]) - examPct(exams[1]) : null;

  const skillRows = useMemo(() => {
    const all = (skills?.domains || []).flatMap((d) => d.skills || []);
    const find = (re) => all.find((s) => re.test(s.label))?.score ?? null;
    const domainScore = (re) => (skills?.domains || []).find((d) => re.test(d.name))?.score ?? null;
    return [
      { label: 'Cognitive Ability', value: find(/cognitive ability/i) ?? domainScore(/cognitive/i), color: '#2563eb', Icon: BrainCircuit, tile: 'bg-violet-50 text-violet-600' },
      { label: 'Communication', value: find(/communication strategies/i) ?? domainScore(/language/i), color: '#7c3aed', Icon: MessagesSquare, tile: 'bg-violet-50 text-violet-600' },
      { label: 'Creativity', value: find(/creative thinking/i) ?? skills?.holistic?.academicGrowth?.breakdown?.creative?.score ?? null, color: '#fb923c', Icon: Palette, tile: 'bg-orange-50 text-orange-500' },
      { label: 'Logical Thinking', value: find(/critical thinking|reasoning/i), color: '#16a34a', Icon: Settings2, tile: 'bg-teal-50 text-teal-600' },
      { label: 'Problem Solving', value: find(/convergent/i), color: '#ef4444', Icon: Lightbulb, tile: 'bg-amber-50 text-amber-500' },
    ];
  }, [skills]);
  const skillScore = avg(skillRows.map((s) => s.value)) ?? skills?.overallSkillScore ?? null;
  const wellbeingScore = skills?.holistic?.emotionalWellbeing?.score
    ?? (wellbeing?.avgMood ? Math.round(wellbeing.avgMood * 20) : null);
  const overall = avg([academicScore, skillScore, wellbeingScore, academic?.attendanceSummary?.attendancePct]);

  const attendanceTrend = (academic?.monthlyAttendance || []).map((m) => ({ month: String(m.label).split(' ')[0], pct: m.pct }));

  /* ── holistic ── */
  const domain = (re) => (skills?.domains || []).find((d) => re.test(d.name))?.score ?? null;
  const physical = skills?.holistic?.emotionalWellbeing?.breakdown?.physical?.score ?? domain(/physical/i);
  const social = skills?.holistic?.emotionalWellbeing?.breakdown?.socialEmotional?.score ?? domain(/social/i);
  const cocurricular = skills?.holistic?.academicGrowth?.breakdown?.creative?.score ?? skillRows[2].value;
  const holistic = [
    { label: 'Physical', score: physical, note: 'Active participation in activities', Icon: PersonStanding, bg: 'bg-rose-50/70', icon: 'text-red-500' },
    { label: 'Social', score: social, note: 'Well-behaved and cooperative', Icon: Users, bg: 'bg-blue-50/70', icon: 'text-blue-600' },
    { label: 'Emotional', score: wellbeingScore, note: 'Shows positive behaviour', Icon: Heart, bg: 'bg-pink-50/70', icon: 'text-red-500' },
    { label: 'Co-curricular', score: cocurricular, note: 'Participates in art, music and events', Icon: Star, bg: 'bg-amber-50/70', icon: 'text-amber-500' },
  ];

  const remark = remarks.find((r) => !child?.id || String(r.studentId) === String(child.id));
  const latestExam = exams[0] || null;
  const classLine = child ? `Class ${child.grade || '—'}${child.section ? ` - Section ${child.section}` : ''}` : '';

  const STATS = [
    { label: 'Overall Progress', value: overall, sub: 'Across academics, skills & wellbeing', Icon: BarChart3, tile: 'bg-green-100 text-green-600', bg: 'from-white to-green-50/60' },
    { label: 'Academic Performance', value: academicScore, delta: academicDelta, sub: 'Based on recent exams & tests', Icon: BookOpen, tile: 'bg-violet-100 text-violet-600', bg: 'from-white to-violet-50/60' },
    { label: 'Skill Development', value: skillScore, sub: 'Across learning domains', Icon: BrainCircuit, tile: 'bg-orange-100 text-orange-500', bg: 'from-white to-orange-50/70' },
    { label: 'Emotional Wellbeing', value: wellbeingScore, sub: 'Based on activities & observations', Icon: Heart, tile: 'bg-red-100 text-red-500', bg: 'from-white to-red-50/60' },
  ];

  return (
    <motion.div
      className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 bg-slate-50 p-3 sm:p-4 lg:p-6"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
    >
      {/* ── Title + academic year + child ── */}
      <motion.div variants={RISE} className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Child Growth Analysis</h1>
          <p className="mt-0.5 text-sm text-slate-600">A simple view of your child&apos;s academic progress, skills, and overall development.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* {child?.academicYear ? (
            <span className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm">
              <CalendarDays size={16} className="text-slate-500" /> Academic Year {child.academicYear}
            </span>
          ) : null} */}
          {child && (
            <div className="relative" ref={pickerRef}>
              <button
                type="button"
                onClick={() => options.length > 1 && setPickerOpen((o) => !o)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 pr-4 text-left shadow-sm sm:w-72"
              >
                {child.photo
                  ? <img src={child.photo} alt={child.name} className="h-10 w-10 rounded-xl object-cover" />
                  : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700">{initials(child.name)}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900">{child.name}</span>
                  <span className="block truncate text-xs text-slate-500">{classLine}</span>
                </span>
                {options.length > 1 && <ChevronDown size={17} className={`text-slate-500 transition ${pickerOpen ? 'rotate-180' : ''}`} />}
              </button>
              {pickerOpen && (
                <ul className="absolute right-0 z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
                  {children.map((c, i) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => { const o = options[i]; setChildKey(`${o.id || ''}::${o.name || ''}`); setPickerOpen(false); }} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 ${c.id === child.id ? 'bg-violet-50' : ''}`}>
                        {c.photo ? <img src={c.photo} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">{initials(c.name)}</span>}
                        <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Stat cards ── */}
      <motion.div variants={RISE} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((s) => (
          <motion.div key={s.label} whileHover={{ y: -3 }} className={`flex h-full items-center gap-3 rounded-2xl border border-slate-100 bg-linear-to-br ${s.bg} px-4 py-3 shadow-[0_2px_12px_rgba(15,23,42,0.04)]`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.tile}`}><s.Icon size={20} /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800">{s.label}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <p className="text-xl font-bold leading-tight text-slate-900">{s.value === null || s.value === undefined ? '—' : `${s.value}%`}</p>
                <Delta value={s.delta} />
              </div>
              <p className="text-[11px] text-slate-500">{s.sub}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Academic performance + skills ── */}
      <motion.div variants={RISE} className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(0,1fr)]">
        <Card>
          <CardHead
            Icon={BookOpen}
            iconCls="bg-blue-50 text-blue-600"
            title="Academic Performance"
            subtitle="Subject-wise performance based on recent assessments."
            right={(
              <div className="relative">
                <select value={examWindow} onChange={(e) => setExamWindow(Number(e.target.value))} className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-800 outline-none focus:border-violet-300">
                  <option value={1}>Latest Exam</option>
                  <option value={3}>Last 3 Exams</option>
                  <option value={99}>All Exams</option>
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            )}
          />
          {subjectBars.length === 0 ? (
            <p className="rounded-xl bg-slate-50 py-10 text-center text-sm text-slate-500">Results will appear once the school publishes marks.</p>
          ) : (
            <div className="h-32 min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectBars} margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="subject" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={0} tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} formatter={(v) => [`${v}%`, 'Score']} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56} animationDuration={900}>
                    {subjectBars.map((b, i) => <Cell key={b.subject} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    <LabelList dataKey="value" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 12, fontWeight: 600, fill: '#0f172a' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardHead Icon={Trophy} iconCls="bg-amber-50 text-amber-500" title="Skill Development" subtitle="Your child's learning skills and abilities." />
          <ul className="flex flex-1 flex-col justify-around gap-1">
            {skillRows.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${s.tile}`}><s.Icon size={14} /></span>
                <span className="w-32 shrink-0 text-sm text-slate-800">{s.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <motion.span initial={{ width: 0 }} animate={{ width: `${s.value ?? 0}%` }} transition={{ duration: 0.8, delay: i * 0.08 }} className="block h-full rounded-full" style={{ background: s.color }} />
                </span>
                <span className="w-10 shrink-0 text-right text-sm font-bold text-slate-900">{s.value === null ? '—' : `${s.value}%`}</span>
              </li>
            ))}
          </ul>
        </Card>
      </motion.div>

      {/* ── Recent exams + attendance trend ── */}
      <motion.div variants={RISE} className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(0,1fr)]">
        <Card>
          <CardHead Icon={FileText} iconCls="bg-violet-50 text-violet-600" title="Recent Exam Performance" subtitle={latestExam ? `Marks obtained in ${latestExam.name}.` : 'Marks obtained in latest exams.'} right={<ViewAll to="/parents/academic" />} />
          {!latestExam ? (
            <p className="rounded-xl bg-slate-50 py-10 text-center text-sm text-slate-500">No published exam results yet.</p>
          ) : (
            <div className="flex flex-1 flex-wrap gap-3">
              {latestExam.rows.slice(0, 4).map((r, i) => {
                const t = EXAM_TILES[i % EXAM_TILES.length];
                return (
                  <motion.div key={`${r.subject}-${i}`} whileHover={{ y: -3 }} className={`min-w-28 flex-auto rounded-xl px-4 py-4 ${t.bg}`}>
                    <FileText size={20} className={t.icon} />
                    <p className="mt-3 whitespace-nowrap text-sm font-medium text-slate-800">{r.subject}</p>
                    <p className={`mt-0.5 text-2xl font-bold ${t.value}`}>{Number(r.obtainedMarks || 0)}<span className="text-base font-semibold">/{Number(r.totalMarks || 0)}</span></p>
                  </motion.div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <CardHead Icon={BarChart3} iconCls="bg-green-50 text-green-600" title="Attendance Trend" subtitle="Attendance percentage over the months." right={<ViewAll to="/parents/attendance" />} />
          {attendanceTrend.every((m) => m.pct === null) ? (
            <p className="rounded-xl bg-slate-50 py-10 text-center text-sm text-slate-500">No attendance recorded yet.</p>
          ) : (
            <div className="h-40 min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={attendanceTrend} margin={{ top: 22, right: 12, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Attendance']} />
                  <Area type="monotone" dataKey="pct" stroke="none" fill="url(#attFill)" connectNulls />
                  <Line type="monotone" dataKey="pct" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }} connectNulls animationDuration={900}>
                    <LabelList dataKey="pct" position="top" formatter={(v) => (v === null ? '' : `${v}%`)} style={{ fontSize: 11, fontWeight: 600, fill: '#0f172a' }} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ── Holistic + teacher remarks ── */}
      <motion.div variants={RISE} className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(0,1fr)]">
        <Card>
          <CardHead Icon={Sprout} iconCls="bg-green-50 text-green-600" title="Holistic Development" subtitle="Overall growth beyond academics." right={<ViewAll to="/parents/parent-observation" label="View Details" />} />
          <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
            {holistic.map((h) => (
              <motion.div key={h.label} whileHover={{ y: -3 }} className={`flex h-full flex-col rounded-xl px-4 py-3.5 ${h.bg}`}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/80 shadow-sm">
                  <h.Icon size={18} className={h.icon} />
                </span>
                <p className="mt-2.5 text-xs font-medium text-slate-600">{h.label}</p>
                <p className={`text-base font-bold leading-tight ${h.score === null || h.score === undefined ? 'text-slate-400' : 'text-slate-900'}`}>{levelOf(h.score)}</p>
                <p className="mt-1.5 text-xs leading-snug text-slate-500">{h.note}</p>
              </motion.div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead Icon={MessageSquareText} iconCls="bg-violet-50 text-violet-600" title="Teacher Remarks" subtitle="Overall feedback from teachers." />
          {!remark ? (
            <p className="rounded-xl bg-slate-50 py-10 text-center text-sm text-slate-500">No remarks from teachers yet.</p>
          ) : (
            <div className="flex flex-1 gap-4 rounded-xl border border-slate-100 p-4">
              {remark.teacherId?.profilePic
                ? <img src={remark.teacherId.profilePic} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-lg font-bold text-violet-700">{initials(remark.teacherId?.name || 'T')}</span>}
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-slate-700">&ldquo;{remark.observationText}&rdquo;</p>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{remark.teacherId?.name || 'Class Teacher'}</p>
                    <p className="text-xs text-slate-500">{remark.category || 'Teacher'}</p>
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">{fmtDate(remark.recordedAt)}</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default ChildGrowthAnalytics;
