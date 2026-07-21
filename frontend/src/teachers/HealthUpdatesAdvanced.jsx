import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, Calendar, CheckCircle2, Heart, MessageCircle, Search, Shield, TrendingUp, User } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

const moodScores = { '😊': 95, '😐': 65, '😟': 35 };
const energyScores = { High: 90, Medium: 65, Low: 40 };
const issueScores = { No: 95, Yes: 40 };

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

const computeMetrics = (student) => {
  const logs = student.logs || [];
  const moodScore = logs.length ? avg(logs.map((l) => moodScores[l.mood] || 50)) : Math.round(student.moodBase ?? 70);
  const healthScore = logs.length
    ? avg(logs.map((l) => Math.round((energyScores[l.energy] + issueScores[l.physicalIssue]) / 2)))
    : Math.round(student.healthBase ?? 70);
  const behaviorScore = logs.length
    ? avg(logs.map((l) => l.behaviorScore ?? student.behaviorBaseline ?? 60))
    : Math.round(student.behaviorBaseline ?? 70);
  const wellbeingScore = Math.round(moodScore * 0.35 + behaviorScore * 0.35 + healthScore * 0.3);
  const issueCounts = logs.reduce((acc, l) => {
    const k = String(l.issueTag || '').toLowerCase();
    if (k && k !== 'none') acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const maxIssueCount = Object.values(issueCounts).reduce((m, n) => Math.max(m, n), 0);
  const autoAlert = maxIssueCount >= 3;
  const status = autoAlert || wellbeingScore < 45 ? 'Critical' : wellbeingScore < 70 ? 'Risk' : 'Good';
  return { moodScore, behaviorScore, healthScore, wellbeingScore, autoAlert, status };
};

const statusClass = (status) => (status === 'Critical' ? 'bg-red-100 text-red-700' : status === 'Risk' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700');

const TrendGraph = ({ pointsA = [], pointsB = [], colorA = '#2563eb', colorB = '#f59e0b' }) => {
  const width = 320;
  const height = 120;
  const toPolyline = (arr) => {
    if (!arr.length) return '';
    return arr.map((v, i) => `${(i / Math.max(1, arr.length - 1)) * width},${height - (Math.max(0, Math.min(100, v)) / 100) * height}`).join(' ');
  };
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 bg-slate-50 rounded-lg border border-slate-200">
      <polyline fill="none" stroke={colorA} strokeWidth="3" points={toPolyline(pointsA)} />
      {pointsB.length > 0 && <polyline fill="none" stroke={colorB} strokeWidth="3" points={toPolyline(pointsB)} />}
    </svg>
  );
};

const parseSortNumber = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return Number.POSITIVE_INFINITY;
  const n = Number(text);
  if (Number.isFinite(n)) return n;
  const m = text.match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
};

const HealthUpdatesAdvanced = () => {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sessionOptions, setSessionOptions] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [range, setRange] = useState('7');
  const [quick, setQuick] = useState({ mood: '😊', energy: 'High', physicalIssue: 'No', notes: '', issueTag: 'none' });
  const [action, setAction] = useState({ type: 'Talked to student', followUpDate: '', notes: '', privateNote: false });
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const loadStudents = async () => {
      setLoadingStudents(true);
      setLoadError('');
      try {
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        if (!token || userType !== 'Teacher') throw new Error('Teacher login required');

        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const date = now.toISOString().slice(0, 10);
        const query = new URLSearchParams({ month, date });
        if (selectedSession) query.set('session', selectedSession);
        if (selectedClass) query.set('className', selectedClass);
        if (selectedSection) query.set('section', selectedSection);
        if (search.trim()) query.set('search', search.trim());

        const res = await fetch(`${API_BASE}/api/attendance/teacher/students?${query.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'Unable to load students');

        const mapped = (Array.isArray(payload?.students) ? payload.students : []).map((s) => {
          const attendancePercent = Number(
            s?.monthlySummary?.attendancePercentage ??
              s?.overallSummary?.attendancePercentage ??
              80
          );
          const safePct = Number.isFinite(attendancePercent) ? attendancePercent : 80;
          return {
            id: String(s._id || s.id),
            name: s.name || 'Student',
            className: `${s.className || s.grade || '-'}${s.section ? `-${s.section}` : ''}`,
            roll: s.roll || s.rollNo || s.rollNumber || '',
            section: s.section || '',
            parentFeedback: { homeBehavior: '—', sleepScreen: '—', emotionalState: '—' },
            behaviorBaseline: Math.max(45, Math.min(95, Math.round(safePct))),
            moodBase: Math.max(45, Math.min(95, Math.round(safePct * 0.9))),
            healthBase: Math.max(45, Math.min(95, Math.round(safePct))),
            logs: [],
            interventions: [],
            confidentialNotes: [],
          };
        });

        setStudents(mapped);
        setSessionOptions(Array.isArray(payload?.options?.sessions) ? payload.options.sessions : []);
        setClassOptions(Array.isArray(payload?.options?.classes) ? payload.options.classes : []);
        setSectionOptions(Array.isArray(payload?.options?.sections) ? payload.options.sections : []);
        setSelectedId((prev) => (mapped.some((s) => s.id === prev) ? prev : mapped[0]?.id || null));
      } catch (err) {
        console.error('Health updates student fetch error:', err);
        setLoadError(err.message || 'Unable to load student data');
        setStudents([]);
        setSelectedId(null);
      } finally {
        setLoadingStudents(false);
      }
    };
    loadStudents();
  }, [selectedSession, selectedClass, selectedSection, search]);

  const enriched = useMemo(() => students.map((s) => ({ ...s, metrics: computeMetrics(s) })), [students]);
  const selectedStudent = useMemo(() => enriched.find((s) => s.id === selectedId) || null, [enriched, selectedId]);

  const directory = useMemo(() => {
    let list = enriched.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.className.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== 'all') list = list.filter((s) => s.metrics.status.toLowerCase() === statusFilter);
    list = [...list].sort((a, b) => {
      if (sortBy === 'lowest') {
        const diff = a.metrics.wellbeingScore - b.metrics.wellbeingScore;
        if (diff !== 0) return diff;
      }
      const aDate = a.logs[0]?.date || '';
      const bDate = b.logs[0]?.date || '';
      const byDate = String(bDate).localeCompare(String(aDate));
      if (byDate !== 0) return byDate;
      const byRoll = parseSortNumber(a.roll) - parseSortNumber(b.roll);
      if (byRoll !== 0) return byRoll;
      return String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
    });
    return list;
  }, [enriched, search, statusFilter, sortBy]);

  const emotionalInsights = useMemo(() => {
    const atRisk = enriched.filter((s) => s.metrics.status !== 'Good');
    const issueMap = {};
    enriched.forEach((s) => s.logs.forEach((l) => {
      const key = String(l.issueTag || '').toLowerCase();
      if (key && key !== 'none') issueMap[key] = (issueMap[key] || 0) + 1;
    }));
    const frequentIssues = Object.entries(issueMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { atRisk, frequentIssues };
  }, [enriched]);

  const saveQuickEntry = () => {
    if (!selectedStudent) return;
    const entry = {
      date: new Date().toISOString().slice(0, 10),
      mood: quick.mood,
      energy: quick.energy,
      physicalIssue: quick.physicalIssue,
      notes: quick.notes.trim(),
      issueTag: quick.issueTag.trim().toLowerCase() || 'none',
      behaviorScore: selectedStudent.behaviorBaseline,
      attendance: 1,
    };
    setStudents((prev) => prev.map((s) => (s.id === selectedStudent.id ? { ...s, logs: [entry, ...(s.logs || [])] } : s)));
    setQuick((q) => ({ ...q, notes: '', issueTag: q.physicalIssue === 'Yes' ? q.issueTag : 'none' }));
  };

  const saveIntervention = () => {
    if (!selectedStudent) return;
    const entry = { type: action.type, date: new Date().toISOString().slice(0, 10), followUpDate: action.followUpDate, description: action.notes };
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== selectedStudent.id) return s;
        return {
          ...s,
          interventions: [entry, ...(s.interventions || [])],
          confidentialNotes: action.privateNote && action.notes ? [{ date: entry.date, note: action.notes }, ...(s.confidentialNotes || [])] : s.confidentialNotes,
        };
      })
    );
    setAction({ type: 'Talked to student', followUpDate: '', notes: '', privateNote: false });
  };

  const trendData = useMemo(() => {
    if (!selectedStudent) return { mood: [], attendance: [], behavior: [] };
    const limit = Number(range);
    const logs = [...selectedStudent.logs].slice(0, limit).reverse();
    return {
      mood: logs.map((l) => moodScores[l.mood] || 50),
      attendance: logs.map((l) => (l.attendance ? 100 : 20)),
      behavior: logs.map((l) => l.behaviorScore || 60),
    };
  }, [selectedStudent, range]);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const checkedInCount = enriched.filter((student) => student.logs.some((log) => log.date === todayKey)).length;
  const pendingCount = Math.max(enriched.length - checkedInCount, 0);
  const atRiskCount = emotionalInsights.atRisk.length;
  const healthCounts = {
    good: enriched.filter((student) => student.metrics.status === 'Good').length,
    moderate: enriched.filter((student) => student.metrics.status === 'Risk').length,
    risk: enriched.filter((student) => student.metrics.status === 'Critical').length,
  };
  const toneFor = (score) => score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';
  const toneStyles = {
    green: { bar: 'border-l-[#16a34a]', avatar: 'bg-[#dcfce7] text-[#16a34a]', score: 'bg-[#dcfce7] text-[#16a34a]', dot: 'bg-[#16a34a]', badge: 'bg-[#dcfce7] text-[#16a34a]' },
    yellow: { bar: 'border-l-[#d97706]', avatar: 'bg-[#fef3c7] text-[#d97706]', score: 'bg-[#fef3c7] text-[#d97706]', dot: 'bg-[#d97706]', badge: 'bg-[#fef3c7] text-[#d97706]' },
    red: { bar: 'border-l-[#dc2626]', avatar: 'bg-[#fecaca] text-[#dc2626]', score: 'bg-[#fecaca] text-[#dc2626]', dot: 'bg-[#dc2626]', badge: 'bg-[#fecaca] text-[#dc2626]' },
  };
  const initials = (name) => String(name || 'Student').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1100px] rounded-[2rem] border border-[#e2e8ee] bg-white p-5 text-[#0b1a33] shadow-[0_4px_20px_rgba(0,20,30,0.05)] transition-shadow hover:shadow-[0_8px_32px_rgba(0,20,30,0.07)] sm:p-8"
    >
      <div className="w-full">
        <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Students', value: enriched.length, icon: User, color: 'bg-[#eff6ff] text-[#2563eb]' },
            { label: 'Checked In', value: checkedInCount, icon: CheckCircle2, color: 'bg-[#ecfdf5] text-[#16a34a]' },
            { label: 'Pending', value: pendingCount, icon: Calendar, color: 'bg-[#fffbeb] text-[#d97706]' },
            { label: 'At Risk', value: atRiskCount, icon: AlertCircle, color: 'bg-[#fef2f2] text-[#dc2626]' },
          ].map((stat, index) => (
            <Motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} className="flex items-center gap-3 rounded-2xl border border-[#edf2f7] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={'flex size-10 items-center justify-center rounded-xl ' + stat.color}><stat.icon className="size-4" /></div>
              <div><p className="text-2xl font-bold leading-none">{stat.value}</p><p className="mt-1 text-[10px] uppercase tracking-[0.03em] text-slate-400">{stat.label}</p></div>
            </Motion.div>
          ))}
        </div>

        <Motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.3 }}
          className="mb-6 flex flex-wrap items-center gap-4 rounded-full border border-[#edf2f7] bg-[#fafbfc] px-4 py-2 text-[11px] font-medium text-slate-500"
        >
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#16a34a]" /> Good (70-100)</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#d97706]" /> Moderate (40-69)</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#dc2626]" /> At Risk (0-39)</span>
          <span className="ml-auto flex items-center gap-3 text-slate-400"><span className="text-[#16a34a]">● {healthCounts.good}</span><span className="text-[#d97706]">● {healthCounts.moderate}</span><span className="text-[#dc2626]">● {healthCounts.risk}</span></span>
        </Motion.div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Motion.section layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.35 }} className="rounded-2xl border border-[#edf2f7] bg-[#fafbfc] p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><span className="text-blue-600">▦</span> Student Directory</h2>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setStatusFilter('all')} className={'rounded-full border px-3 py-1 text-[10px] font-medium ' + (statusFilter === 'all' ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-transparent bg-slate-50 text-slate-400')}>All Years</button>
                <button type="button" onClick={() => setSelectedClass('')} className="rounded-full border border-transparent bg-slate-50 px-3 py-1 text-[10px] font-medium text-slate-400">All Classes</button>
                <button type="button" onClick={() => setSelectedSection('')} className="rounded-full border border-transparent bg-slate-50 px-3 py-1 text-[10px] font-medium text-slate-400">All Sections</button>
                <button type="button" onClick={() => setStatusFilter('critical')} className={'rounded-full border px-3 py-1 text-[10px] font-medium ' + (statusFilter === 'critical' ? 'border-red-200 bg-red-50 text-red-600' : 'border-transparent bg-slate-50 text-slate-400')}>Recent Issue</button>
              </div>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-300" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student..." className="w-full rounded-full border border-[#edf2f7] bg-[#fafbfc] py-2 pl-9 pr-3 text-xs outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10" />
            </div>

            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select value={selectedSession} onChange={(event) => setSelectedSession(event.target.value)} className="rounded-full border border-[#edf2f7] bg-[#fafbfc] px-3 py-2 text-xs outline-none"><option value="">All Years</option>{sessionOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} className="rounded-full border border-[#edf2f7] bg-[#fafbfc] px-3 py-2 text-xs outline-none"><option value="">All Classes</option>{classOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              <select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)} className="rounded-full border border-[#edf2f7] bg-[#fafbfc] px-3 py-2 text-xs outline-none"><option value="">All Sections</option>{sectionOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-full border border-[#edf2f7] bg-[#fafbfc] px-3 py-1.5 text-[11px] outline-none"><option value="all">All Status</option><option value="good">Good</option><option value="risk">Risk</option><option value="critical">Critical</option></select>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-full border border-[#edf2f7] bg-[#fafbfc] px-3 py-1.5 text-[11px] outline-none"><option value="recent">Recent issue</option><option value="lowest">Lowest wellbeing</option></select>
            </div>

            <div className="max-h-[430px] space-y-1 overflow-y-auto pr-1">
              {loadingStudents && <div className="p-5 text-center text-sm text-slate-400">Loading students...</div>}
              {loadError && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600">{loadError}</div>}
              {!loadingStudents && !directory.length && !loadError && <div className="p-8 text-center text-sm text-slate-400">No students match the current filters.</div>}
              <AnimatePresence initial={false}>
                {directory.map((student, index) => {
                  const tone = toneFor(student.metrics.wellbeingScore);
                  const styles = toneStyles[tone];
                  return (
                    <Motion.button key={student.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ delay: index * 0.035 }} type="button" onClick={() => setSelectedId(student.id)} className={'flex w-full items-center justify-between rounded-xl border-l-4 px-3 py-2 text-left transition hover:translate-x-0.5 hover:bg-slate-50 ' + styles.bar + (selectedId === student.id ? ' bg-blue-50 ring-1 ring-blue-200' : '')}>
                      <span className="flex min-w-0 items-center gap-2.5"><span className={'flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ' + styles.avatar}>{initials(student.name)}</span><span className="min-w-0"><span className="block truncate text-xs font-medium">{student.name}</span><span className="block text-[10px] text-slate-400">{student.className} · Roll {student.roll || '—'} · Sec {student.section || '—'}</span></span></span>
                      <span className="flex items-center gap-1.5"><span className={'size-2.5 rounded-full ' + styles.dot} /><span className={'rounded-full px-2 py-0.5 text-[10px] font-semibold ' + styles.score}>{student.metrics.wellbeingScore}</span>{tone === 'red' && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[9px] font-bold uppercase text-red-600">Risk</span>}</span>
                    </Motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </Motion.section>

          <aside className="space-y-4">
            {selectedStudent ? (
              <Motion.section layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, duration: 0.35 }} className="relative overflow-hidden rounded-2xl border border-[#edf2f7] bg-white p-4 shadow-sm">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-green-600" />
                <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
                  <span className={'flex size-11 items-center justify-center rounded-full text-sm font-semibold ' + toneStyles[toneFor(selectedStudent.metrics.wellbeingScore)].avatar}>{initials(selectedStudent.name)}</span>
                  <div className="min-w-0"><h3 className="truncate text-sm font-semibold">{selectedStudent.name}</h3><p className="text-[10px] text-slate-400">{selectedStudent.className} · Roll {selectedStudent.roll || '—'} · Sec {selectedStudent.section || '—'}</p></div>
                  <span className={'ml-auto rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase ' + statusClass(selectedStudent.metrics.status)}>{selectedStudent.metrics.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Mood', value: selectedStudent.metrics.moodScore, color: 'text-blue-600' },
                    { label: 'Behavior', value: selectedStudent.metrics.behaviorScore, color: 'text-violet-600' },
                    { label: 'Health', value: selectedStudent.metrics.healthScore, color: 'text-green-600' },
                  ].map((metric) => <div key={metric.label} className="rounded-xl bg-slate-50 p-2 text-center"><p className={'text-base font-bold ' + metric.color}>{metric.value}</p><p className="text-[9px] uppercase text-slate-400">{metric.label}</p></div>)}
                  <div className={'col-span-2 rounded-xl p-3 text-center ' + toneStyles[toneFor(selectedStudent.metrics.wellbeingScore)].badge}><p className="text-2xl font-bold">{selectedStudent.metrics.wellbeingScore}</p><p className="text-[9px] uppercase text-slate-600">Wellbeing</p></div>
                </div>
              </Motion.section>
            ) : <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Select a student to view wellbeing.</div>}

            <Motion.section layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.35 }} className="rounded-2xl border border-[#edf2f7] bg-white p-4 shadow-sm">
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold"><Heart className="size-3.5 text-blue-600" /> Quick Health Entry</h4>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {[
                  { label: 'Good', value: 'High', active: 'bg-[#16a34a] text-white border-transparent' },
                  { label: 'Moderate', value: 'Medium', active: 'bg-[#d97706] text-white border-transparent' },
                  { label: 'At Risk', value: 'Low', active: 'bg-[#dc2626] text-white border-transparent' },
                ].map((entry) => <button key={entry.label} type="button" onClick={() => setQuick((previous) => ({ ...previous, energy: entry.value }))} className={'rounded-full border px-3 py-1 text-[10px] font-medium transition ' + (quick.energy === entry.value ? entry.active : 'border-slate-200 text-slate-400')}>{entry.label}</button>)}
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {['No', 'Yes', 'Maybe'].map((value) => <button key={value} type="button" onClick={() => setQuick((previous) => ({ ...previous, physicalIssue: value === 'Maybe' ? 'No' : value }))} className={'rounded-full border px-3 py-1 text-[10px] font-medium ' + ((quick.physicalIssue === value || (value === 'Maybe' && quick.physicalIssue === 'No')) ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-400')}>{value}</button>)}
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">{['none', 'Headache', 'Fatigue'].map((value) => <button key={value} type="button" onClick={() => setQuick((previous) => ({ ...previous, issueTag: value.toLowerCase() }))} className={'rounded-full border px-3 py-1 text-[10px] font-medium ' + (quick.issueTag.toLowerCase() === value.toLowerCase() ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-400')}>{value}</button>)}</div>
              <textarea value={quick.notes} onChange={(event) => setQuick((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Short notes..." className="mb-2 min-h-10 w-full resize-y rounded-xl border border-[#edf2f7] bg-[#fafbfc] px-3 py-2 text-xs outline-none focus:border-blue-500" />
              <button type="button" onClick={saveQuickEntry} disabled={!selectedStudent} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"><CheckCircle2 className="size-3.5" /> Save in 1 click</button>
            </Motion.section>

            <Motion.section layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46, duration: 0.35 }} className="rounded-2xl border border-[#edf2f7] bg-white p-4 shadow-sm">
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold"><AlertCircle className="size-3.5 text-red-600" /> At Risk Students</h4>
              <div className="flex flex-wrap gap-1.5">{emotionalInsights.atRisk.map((student) => <button type="button" key={student.id} onClick={() => setSelectedId(student.id)} className="rounded-full border border-slate-200 bg-[#fafbfc] px-2.5 py-1 text-[10px] text-slate-600 hover:bg-slate-100">{student.name.split(' ').slice(0, 2).join(' ')} <span className={student.metrics.status === 'Critical' ? 'font-semibold text-red-600' : 'font-semibold text-amber-600'}>{student.metrics.wellbeingScore}</span></button>)}{!emotionalInsights.atRisk.length && <span className="text-xs text-slate-400">No at-risk students.</span>}</div>
            </Motion.section>

            <Motion.section layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52, duration: 0.35 }} className="rounded-2xl border border-[#edf2f7] bg-white p-4 shadow-sm">
              <h4 className="mb-1 flex items-center gap-2 text-xs font-semibold"><Activity className="size-3.5 text-amber-500" /> Frequent Issues</h4>
              {emotionalInsights.frequentIssues.length ? <div className="flex flex-wrap gap-1.5">{emotionalInsights.frequentIssues.map(([issue, count]) => <span key={issue} className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] text-slate-600">{issue}: {count}</span>)}</div> : <p className="flex items-center gap-1.5 text-xs text-slate-300"><CheckCircle2 className="size-3.5 text-green-600" /> No frequent issues</p>}
            </Motion.section>
          </aside>
        </div>

        {selectedStudent && (
          <Motion.section layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58, duration: 0.35 }} className="mt-6 rounded-2xl border border-[#edf2f7] bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-sm font-semibold">Student wellbeing details</h2><p className="mt-0.5 text-xs text-slate-400">{selectedStudent.name} · {selectedStudent.className}</p></div>
              <div className="flex flex-wrap gap-1.5">
                {['overview', 'trends', 'parent', 'intervention', 'confidential', 'daily'].map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={'rounded-full px-3 py-1.5 text-[10px] font-medium capitalize transition ' + (tab === item ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{item}</button>)}
              </div>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <Motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
                {tab === 'overview' && <div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><h4 className="mb-1 text-xs font-semibold">Smart Alert</h4><p className="text-xs text-slate-600">{selectedStudent.metrics.autoAlert ? 'Repeated issue detected 3+ times. Auto alert raised.' : 'No repeated critical pattern.'}</p></div><div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><h4 className="mb-1 text-xs font-semibold">Emotional Insights</h4><p className="text-xs text-slate-600">At-risk students: <strong>{emotionalInsights.atRisk.length}</strong></p><div className="mt-2 flex flex-wrap gap-1.5">{emotionalInsights.frequentIssues.map(([issue, count]) => <span key={issue} className="rounded-full bg-white px-2 py-1 text-[10px] text-slate-500">{issue}: {count}</span>)}</div></div></div>}
                {tab === 'trends' && <div className="space-y-3"><div className="flex gap-1.5"><button type="button" onClick={() => setRange('7')} className={'rounded-full px-3 py-1 text-[10px] ' + (range === '7' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100')}>7 days</button><button type="button" onClick={() => setRange('30')} className={'rounded-full px-3 py-1 text-[10px] ' + (range === '30' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100')}>30 days</button></div><TrendGraph pointsA={trendData.mood} /><TrendGraph pointsA={trendData.attendance} pointsB={trendData.mood} colorA="#10b981" colorB="#2563eb" /><TrendGraph pointsA={trendData.behavior} colorA="#f97316" /></div>}
                {tab === 'parent' && <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600"><h4 className="mb-2 flex items-center gap-2 font-semibold text-slate-800"><MessageCircle className="size-3.5" /> Parent Feedback</h4><p>Home behavior: {selectedStudent.parentFeedback.homeBehavior}</p><p>Sleep/screen time: {selectedStudent.parentFeedback.sleepScreen}</p><p>Emotional state: {selectedStudent.parentFeedback.emotionalState}</p></div>}
                {tab === 'intervention' && <div className="space-y-3"><div className="grid gap-2 md:grid-cols-2"><select value={action.type} onChange={(event) => setAction((previous) => ({ ...previous, type: event.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs"><option>Talked to student</option><option>Informed parent</option><option>Sent to counselor</option></select><input type="date" value={action.followUpDate} onChange={(event) => setAction((previous) => ({ ...previous, followUpDate: event.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" /></div><textarea value={action.notes} onChange={(event) => setAction((previous) => ({ ...previous, notes: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" rows={3} placeholder="Action notes..." /><label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={action.privateNote} onChange={(event) => setAction((previous) => ({ ...previous, privateNote: event.target.checked }))} /> Private note</label><button type="button" onClick={saveIntervention} className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Save Action</button>{selectedStudent.interventions?.map((item, index) => <div key={item.date + index} className="rounded-xl border border-slate-100 bg-slate-50 p-2 text-xs text-slate-600">{item.date} · {item.type}{item.followUpDate ? ' · Follow-up: ' + item.followUpDate : ''}<div className="mt-1 text-slate-500">{item.description}</div></div>)}</div>}
                {tab === 'confidential' && <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600"><h4 className="mb-2 flex items-center gap-2 font-semibold text-slate-800"><Shield className="size-3.5" /> Confidential Notes</h4>{selectedStudent.confidentialNotes?.length ? selectedStudent.confidentialNotes.map((item, index) => <div key={item.date + index} className="mb-1 rounded-lg bg-white p-2">{item.date} · {item.note}</div>) : 'No confidential notes yet.'}</div>}
                {tab === 'daily' && <div className="max-h-56 space-y-2 overflow-y-auto"><h4 className="flex items-center gap-2 text-xs font-semibold"><Calendar className="size-3.5" /> Daily Logs</h4>{selectedStudent.logs.map((item, index) => <div key={item.date + index} className="rounded-xl border border-slate-100 bg-slate-50 p-2 text-xs text-slate-600">{item.date} · Energy {item.energy} · Physical issue {item.physicalIssue}<div>Mood: {item.mood} · {item.notes || 'No notes'}</div></div>)}</div>}
              </Motion.div>
            </AnimatePresence>
          </Motion.section>
        )}
      </div>
    </Motion.div>
  );

};

const MetricCard = ({ label, value, icon }) => (
  <div className="border rounded-xl p-3 bg-slate-50">
    <div className="flex items-center gap-2 text-slate-600 text-xs">{icon}<span>{label}</span></div>
    <div className="text-xl font-semibold text-slate-900 mt-1">{value}</div>
  </div>
);

export default HealthUpdatesAdvanced;
