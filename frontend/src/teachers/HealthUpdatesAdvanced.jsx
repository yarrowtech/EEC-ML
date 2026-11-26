import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, ArrowRight, Bell, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  FileText, Heart, HeartPulse, Home, Leaf, Loader2, Lock, MessageCircle, Plus, RefreshCcw, Save, Search, Shield,
  Smile, TrendingUp, UserRound, Users, Wrench, X, Clock, AlertCircle, Activity, Filter,
} from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import MoodIcon from '../components/MoodIcon';
import { moodEmoji, moodTone, moodScore } from '../utils/moods';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const STATUS_OPTIONS = [
  { value: 'good', label: 'Good', icon: CheckCircle2, active: 'border-emerald-300 bg-emerald-50 text-emerald-700', idle: 'border-emerald-100 bg-emerald-50/40 text-emerald-700' },
  { value: 'moderate', label: 'Moderate', icon: Smile, active: 'border-amber-300 bg-amber-50 text-amber-700', idle: 'border-amber-100 bg-amber-50/40 text-amber-700' },
  { value: 'at_risk', label: 'At Risk', icon: AlertCircle, active: 'border-rose-300 bg-rose-50 text-rose-700', idle: 'border-rose-100 bg-rose-50/40 text-rose-700' },
];
const ISSUE_TODAY_OPTIONS = [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }, { value: 'maybe', label: 'Maybe' }];
const ISSUE_TAGS = [
  { value: 'none', label: 'None' }, { value: 'headache', label: 'Headache' }, { value: 'fatigue', label: 'Fatigue' },
  { value: 'fever', label: 'Fever' }, { value: 'stomach_ache', label: 'Stomach Ache' }, { value: 'other', label: 'Other' },
];
const ISSUE_LABEL = Object.fromEntries(ISSUE_TAGS.map((t) => [t.value, t.label]));
const STATUS_SCORE = { good: 90, moderate: 60, at_risk: 30 };
const ISSUE_PENALTY = { no: 0, maybe: 10, yes: 20 };
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-600', 'bg-pink-100 text-pink-600', 'bg-cyan-100 text-cyan-600',
  'bg-violet-100 text-violet-600', 'bg-rose-100 text-rose-600', 'bg-emerald-100 text-emerald-600', 'bg-amber-100 text-amber-600',
];
const TABS = [
  { key: 'overview', label: 'Overview', icon: Home },
  { key: 'entries', label: 'Health Entry', icon: ClipboardList },
  { key: 'trends', label: 'Trends', icon: TrendingUp },
  { key: 'parent', label: 'Parent', icon: UserRound },
  { key: 'intervention', label: 'Intervention', icon: Wrench },
];
const PAGE_SIZE = 10;
const NOTE_LIMIT = 200;

const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
const localDateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const initials = (name) => String(name || 'S').split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
const avatarColor = (name) => AVATAR_COLORS[(String(name || '').charCodeAt(0) || 0) % AVATAR_COLORS.length];
const photoUrl = (p) => (!p ? '' : typeof p === 'string' ? p : p.secure_url || p.url || '');
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });
const formatDate = (key) => {
  const d = new Date(`${key}T00:00:00`);
  return Number.isNaN(d.getTime()) ? key : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const parseSortNumber = (value) => {
  const n = Number(String(value ?? '').match(/\d+/)?.[0]);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
};

const toneOf = (score) => (score >= 70 ? 'good' : score >= 40 ? 'moderate' : 'risk');
const TONE = {
  good: { label: 'Good', pill: 'bg-emerald-600 text-white', score: 'bg-emerald-600 text-white', bar: 'bg-emerald-500' },
  moderate: { label: 'Moderate', pill: 'bg-amber-600 text-white', score: 'bg-amber-600 text-white', bar: 'bg-amber-400' },
  risk: { label: 'At Risk', pill: 'bg-rose-600 text-white', score: 'bg-rose-600 text-white', bar: 'bg-rose-500' },
};

// Scores come from the teacher's saved daily check-ins; when a student has no
// check-ins yet we fall back to an attendance-derived baseline.
// Scores (0–100):
//  Mood       — the student's own diary moods (last 30 days); teacher-entered mood
//               scores are blended in when there are any.
//  Behaviour  — teacher behaviour scores, blended with the diary mood (a happy,
//               settled student usually behaves well; a stressed one may not).
//  Health     — teacher health entries (status − issue penalty).
//  Engagement — tryout / practice attempts: average auto-marked score, plus a
//               bonus for practising often (up to 10 attempts in 30 days).
//  Wellbeing  — mood 30% · behaviour 25% · health 20% · engagement 25%
//               (missing parts are left out and the rest re-weighted).
const computeMetrics = (student) => {
  const logs = student.logs || [];
  const diary = Object.values(student.diaryMoods || {});
  const tryouts = student.tryouts || null;

  const diaryMood = diary.length ? avg(diary.map((m) => moodScore(m.mood))) : null;
  const teacherMoods = logs.map((l) => l.mood).filter((v) => v !== null && v !== undefined);
  const teacherMood = teacherMoods.length ? avg(teacherMoods) : (logs.length ? avg(logs.map((l) => STATUS_SCORE[l.overallStatus] ?? 60)) : null);
  const mood = diaryMood !== null && teacherMood !== null ? Math.round(diaryMood * 0.6 + teacherMood * 0.4)
    : diaryMood ?? teacherMood;

  const teacherBehaviours = logs.map((l) => l.behavior).filter((v) => v !== null && v !== undefined);
  const teacherBehaviour = teacherBehaviours.length ? avg(teacherBehaviours) : null;
  const behavior = teacherBehaviour !== null && mood !== null ? Math.round(teacherBehaviour * 0.6 + mood * 0.4)
    : teacherBehaviour ?? mood;

  const health = logs.length ? avg(logs.map((l) => Math.max(0, (STATUS_SCORE[l.overallStatus] ?? 60) - (ISSUE_PENALTY[l.issueToday] || 0)))) : null;

  const engagement = tryouts && tryouts.attempts > 0
    ? Math.round(Math.min(100, (tryouts.avgScore ?? 50) * 0.75 + Math.min(tryouts.attempts, 10) * 2.5))
    : null;

  const parts = [[mood, 0.3], [behavior, 0.25], [health, 0.2], [engagement, 0.25]].filter(([v]) => v !== null && v !== undefined);
  const hasData = parts.length > 0;
  const base = student.baseline;
  const weight = parts.reduce((n, [, w]) => n + w, 0);
  const wellbeing = hasData ? Math.round(parts.reduce((n, [v, w]) => n + v * w, 0) / weight) : base;
  return {
    mood: mood ?? base,
    behavior: behavior ?? base,
    health: health ?? base,
    engagement: engagement ?? null,
    wellbeing,
    hasData,
    sources: { diaryDays: diary.length, teacherEntries: logs.length, tryoutAttempts: tryouts?.attempts || 0 },
  };
};

const Avatar = ({ name, profilePic, className = 'size-9 text-xs' }) => {
  const [failed, setFailed] = useState(false);
  const src = photoUrl(profilePic);
  if (src && !failed) return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={`shrink-0 rounded-full object-cover ${className}`} />;
  return <span className={`flex shrink-0 items-center justify-center rounded-full font-bold ${avatarColor(name)} ${className}`}>{initials(name)}</span>;
};

const SelectBox = ({ value, onChange, children, className = '' }) => (
  <div className={`relative ${className}`}>
    <select value={value} onChange={onChange} className="w-full appearance-none rounded-lg border border-[#e2e8f0] bg-white py-2 pl-3 pr-8 text-xs text-[#14234b] outline-none focus:border-blue-300">
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
  </div>
);

const TrendGraph = ({ series, height = 110 }) => {
  const width = 320;
  const toPoints = (arr) => arr.map((v, i) => `${(i / Math.max(1, arr.length - 1)) * width},${height - (Math.max(0, Math.min(100, v)) / 100) * height}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full rounded-lg border border-slate-100 bg-slate-50" preserveAspectRatio="none">
      {series.map((s) => s.points.length > 0 && <polyline key={s.label} fill="none" stroke={s.color} strokeWidth="2.5" points={toPoints(s.points)} />)}
    </svg>
  );
};

const Pager = ({ page, totalPages, onPage }) => {
  const pages = useMemo(() => {
    if (totalPages <= 6) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set([1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages));
    if (page <= 3) [2, 3, 4, 5].forEach((n) => set.add(n));
    const sorted = [...set].sort((a, b) => a - b);
    const out = [];
    sorted.forEach((n, i) => { if (i && n - sorted[i - 1] > 1) out.push('…'); out.push(n); });
    return out;
  }, [page, totalPages]);
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page === 1} className="flex size-7 items-center justify-center rounded-md border border-[#e2e8f0] bg-white disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
      {pages.map((n, i) => n === '…' ? <span key={`e${i}`} className="px-0.5 text-xs">…</span> : (
        <button key={n} type="button" onClick={() => onPage(n)} className={`flex size-7 items-center justify-center rounded-md border text-xs ${n === page ? 'border-blue-600 bg-blue-600 font-semibold text-white' : 'border-[#e2e8f0] bg-white text-[#2a3a60] hover:bg-[#f3f6fd]'}`}>{n}</button>
      ))}
      <button type="button" onClick={() => onPage(page + 1)} disabled={page === totalPages} className="flex size-7 items-center justify-center rounded-md border border-[#e2e8f0] bg-white text-blue-600 disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
    </div>
  );
};

const Modal = ({ open, onClose, children, width = 'max-w-5xl' }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <Motion.div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <Motion.div role="dialog" aria-modal="true" initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.97 }} transition={{ type: 'spring', stiffness: 340, damping: 30 }} className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${width}`} onClick={(e) => e.stopPropagation()}>
            {children}
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

// Mood the student picked in their own diary ("Today I feel").
const MOOD_TONE_CLS = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  okay: 'border-slate-200 bg-slate-50 text-slate-700',
  tough: 'border-rose-200 bg-rose-50 text-rose-700',
};
const StudentMoodChip = ({ mood, at, size = 'sm' }) => {
  if (!mood) return <span className="text-[10.5px] text-slate-400">Not shared</span>;
  const time = at ? new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  return (
    <span title={time ? `Shared at ${time}` : undefined} className={`inline-flex items-center gap-1 rounded-full border font-semibold ${MOOD_TONE_CLS[moodTone(mood)]} ${size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[10.5px]'}`}>
      <MoodIcon emoji={moodEmoji(mood)} label={mood} size={size === 'lg' ? 20 : 14} /> {mood}
    </span>
  );
};

const emptyRow = () => ({ include: true, overallStatus: 'good', issueToday: 'no', issueTag: 'none', mood: '', behavior: '', notes: '' });

const BulkEntryModal = ({ open, onClose, students, onSaved }) => {
  const [date, setDate] = useState(localDateKey());
  const [rows, setRows] = useState({});
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);

  // Prefill each row from that day's saved entry, if any.
  useEffect(() => {
    if (!open) return;
    const next = {};
    students.forEach((s) => {
      const log = s.logs.find((l) => l.date === date);
      next[s.id] = log
        ? { include: true, overallStatus: log.overallStatus, issueToday: log.issueToday, issueTag: log.issueTag, mood: log.mood ?? '', behavior: log.behavior ?? '', notes: log.notes || '' }
        : emptyRow();
    });
    setRows(next);
  }, [open, date, students]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? students.filter((s) => s.name.toLowerCase().includes(q) || String(s.roll).toLowerCase().includes(q)) : students;
  }, [students, filter]);
  const update = (id, patch) => setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const includedIds = students.filter((s) => rows[s.id]?.include).map((s) => s.id);
  const allIncluded = students.length > 0 && includedIds.length === students.length;
  const applyToAll = (patch) => setRows((prev) => Object.fromEntries(Object.entries(prev).map(([id, r]) => [id, r.include ? { ...r, ...patch } : r])));

  const save = async () => {
    if (!includedIds.length) { toast.error('Select at least one student'); return; }
    setSaving(true);
    try {
      const entries = includedIds.map((id) => {
        const r = rows[id];
        return {
          studentId: id, overallStatus: r.overallStatus, issueToday: r.issueToday,
          issueTag: r.issueToday === 'no' ? 'none' : r.issueTag,
          mood: r.mood === '' ? null : Number(r.mood), behavior: r.behavior === '' ? null : Number(r.behavior),
          notes: r.notes,
        };
      });
      const res = await fetch(`${API_BASE}/api/health-records/logs/bulk`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ date, entries }) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Unable to save entries');
      toast.success(payload.message || 'Health entries saved');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-md border border-[#e2e8f0] bg-white px-2 py-1.5 text-[11px] outline-none focus:border-blue-300 disabled:bg-slate-50 disabled:text-slate-400';

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><ClipboardList className="size-5" /></span>
          <div>
            <h3 className="text-[15px] font-bold text-[#14234b]">Bulk Health Entry</h3>
            <p className="text-[11.5px] text-slate-500">Record today's health and wellbeing status for every student at once. Existing entries for the date are updated.</p>
          </div>
        </div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="size-4" /></button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
        <label className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs text-[#14234b]">
          <Calendar className="size-3.5 text-slate-500" />
          <input type="date" value={date} max={localDateKey()} onChange={(e) => e.target.value && setDate(e.target.value)} className="bg-transparent text-xs outline-none" />
        </label>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find student by name or roll..." className="w-full rounded-lg border border-[#e2e8f0] bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-300" />
        </div>
        <span className="text-[11px] text-slate-500">Set selected to:</span>
        {STATUS_OPTIONS.map((o) => (
          <button key={o.value} type="button" onClick={() => applyToAll({ overallStatus: o.value })} className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${o.idle}`}>{o.label}</button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="sticky top-0 z-10 bg-[#f3f6fd] text-left text-[11px] font-semibold text-[#2a3a60]">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" checked={allIncluded} onChange={(e) => setRows((prev) => Object.fromEntries(Object.entries(prev).map(([id, r]) => [id, { ...r, include: e.target.checked }])))} aria-label="Select all students" />
              </th>
              <th className="px-3 py-2.5">Student</th>
              <th className="px-3 py-2.5">Overall Status</th>
              <th className="w-24 px-3 py-2.5">Any Issue?</th>
              <th className="w-32 px-3 py-2.5">Issue</th>
              <th className="w-20 px-3 py-2.5">Mood</th>
              <th className="w-20 px-3 py-2.5">Behavior</th>
              <th className="px-3 py-2.5">Notes</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400">No students to show.</td></tr>}
            {visible.map((s) => {
              const r = rows[s.id] || emptyRow();
              const disabled = !r.include;
              return (
                <tr key={s.id} className={`border-t border-[#eef2f7] ${disabled ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2"><input type="checkbox" checked={r.include} onChange={(e) => update(s.id, { include: e.target.checked })} aria-label={`Include ${s.name}`} /></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={s.name} profilePic={s.profilePic} className="size-7 text-[10px]" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#14234b]">{s.name}</p>
                        <p className="text-[10px] text-slate-500">Roll {s.roll || '—'} · {s.className}</p>
                        {s.diaryMoods?.[date] && <div className="mt-0.5"><StudentMoodChip mood={s.diaryMoods[date].mood} at={s.diaryMoods[date].at} /></div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {STATUS_OPTIONS.map((o) => (
                        <button key={o.value} type="button" disabled={disabled} onClick={() => update(s.id, { overallStatus: o.value })} className={`rounded-md border px-2 py-1 text-[10.5px] font-semibold transition ${r.overallStatus === o.value ? o.active : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'}`}>{o.label}</button>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select disabled={disabled} value={r.issueToday} onChange={(e) => update(s.id, { issueToday: e.target.value, issueTag: e.target.value === 'no' ? 'none' : r.issueTag })} className={inputCls}>
                      {ISSUE_TODAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select disabled={disabled || r.issueToday === 'no'} value={r.issueToday === 'no' ? 'none' : r.issueTag} onChange={(e) => update(s.id, { issueTag: e.target.value })} className={inputCls}>
                      {ISSUE_TAGS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2"><input disabled={disabled} type="number" min={0} max={100} value={r.mood} placeholder="0-100" onChange={(e) => update(s.id, { mood: e.target.value })} className={inputCls} /></td>
                  <td className="px-3 py-2"><input disabled={disabled} type="number" min={0} max={100} value={r.behavior} placeholder="0-100" onChange={(e) => update(s.id, { behavior: e.target.value })} className={inputCls} /></td>
                  <td className="px-3 py-2"><input disabled={disabled} value={r.notes} maxLength={NOTE_LIMIT} placeholder="Short note..." onChange={(e) => update(s.id, { notes: e.target.value })} className={inputCls} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
        <p className="text-xs text-slate-500">{includedIds.length} of {students.length} students selected · {formatDate(date)}</p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={save} disabled={saving || !includedIds.length} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save {includedIds.length} entries
          </button>
        </div>
      </div>
    </Modal>
  );
};

const HealthUpdatesAdvanced = () => {
  const [students, setStudents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [studentMoods, setStudentMoods] = useState([]); // [{ studentId, mood, at }] from student diaries
  const [tryoutStats, setTryoutStats] = useState([]); // [{ studentId, attempts, avgScore, lastAt }]
  const [selectedId, setSelectedId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const searchInputRef = useRef(null);
  useEffect(() => { if (searchOpen) searchInputRef.current?.focus(); }, [searchOpen]);
  const closeSearch = () => { setSearchOpen(false); setSearch(''); };

  // The page fits the screen (no page scroll): the root takes the height left
  // below it, and the table shows as many rows per page as fit.
  const rootRef = useRef(null);
  const tableBoxRef = useRef(null);
  const [rootHeight, setRootHeight] = useState(null);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useLayoutEffect(() => {
    const measure = () => {
      const root = rootRef.current;
      if (root && window.innerWidth >= 768) {
        setRootHeight(Math.max(420, Math.floor(window.innerHeight - root.getBoundingClientRect().top - 16)));
      } else {
        setRootHeight(null);
      }
      const box = tableBoxRef.current;
      if (box) {
        const ROW = 49; const HEAD = 34;
        setPageSize(Math.max(3, Math.floor((box.clientHeight - HEAD) / ROW)));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver !== 'undefined' && tableBoxRef.current ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(tableBoxRef.current);
    return () => { window.removeEventListener('resize', measure); ro?.disconnect(); };
  }, []);
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
  const [page, setPage] = useState(1);
  const [range, setRange] = useState(7);
  const [tab, setTab] = useState('overview');
  const [reloadKey, setReloadKey] = useState(0);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [quick, setQuick] = useState({ date: localDateKey(), overallStatus: 'good', issueToday: 'no', issueTag: 'none', notes: '' });
  const [savingQuick, setSavingQuick] = useState(false);
  const [action, setAction] = useState({ type: 'Talked to student', followUpDate: '', notes: '', confidential: false });
  const [savingAction, setSavingAction] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadStudents = async () => {
      setLoadingStudents(true);
      setLoadError('');
      try {
        const token = localStorage.getItem('token');
        if (!token || localStorage.getItem('userType') !== 'Teacher') throw new Error('Teacher login required');
        const now = new Date();
        const query = new URLSearchParams({ month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, date: localDateKey(now) });
        if (selectedSession) query.set('session', selectedSession);
        if (selectedClass) query.set('className', selectedClass);
        if (selectedSection) query.set('section', selectedSection);
        const res = await fetch(`${API_BASE}/api/attendance/teacher/students?${query.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'Unable to load students');

        const mapped = (Array.isArray(payload?.students) ? payload.students : []).map((s) => {
          const pct = Number(s?.monthlySummary?.attendancePercentage ?? s?.overallSummary?.attendancePercentage ?? 80);
          return {
            id: String(s._id || s.id),
            name: s.name || 'Student',
            className: `${s.className || s.grade || '-'}${s.section ? `-${s.section}` : ''}`,
            roll: s.roll || s.rollNo || s.rollNumber || '',
            section: s.section || '',
            profilePic: s.profilePic,
            baseline: Math.max(45, Math.min(95, Math.round(Number.isFinite(pct) ? pct : 80))),
          };
        });

        // Fetch saved check-ins in chunks to keep the query string short.
        const ids = mapped.map((s) => s.id);
        const chunks = [];
        for (let i = 0; i < ids.length; i += 80) chunks.push(ids.slice(i, i + 80));
        const results = await Promise.all(chunks.map(async (chunk) => {
          const r = await fetch(`${API_BASE}/api/health-records/logs?days=30&studentIds=${chunk.join(',')}`, { headers: { Authorization: `Bearer ${token}` } });
          const p = await r.json().catch(() => ({}));
          return r.ok ? p.data : { logs: [], interventions: [], studentMoods: [], tryoutStats: [] };
        }));
        if (cancelled) return;
        setStudents(mapped);
        setLogs(results.flatMap((r) => r?.logs || []));
        setInterventions(results.flatMap((r) => r?.interventions || []));
        setStudentMoods(results.flatMap((r) => r?.studentMoods || []));
        setTryoutStats(results.flatMap((r) => r?.tryoutStats || []));
        setSessionOptions(Array.isArray(payload?.options?.sessions) ? payload.options.sessions : []);
        setClassOptions(Array.isArray(payload?.options?.classes) ? payload.options.classes : []);
        setSectionOptions(Array.isArray(payload?.options?.sections) ? payload.options.sections : []);
        setSelectedId((prev) => (mapped.some((s) => s.id === prev) ? prev : mapped[0]?.id || null));
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || 'Unable to load student data');
        setStudents([]);
        setSelectedId(null);
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    };
    loadStudents();
    return () => { cancelled = true; };
  }, [selectedSession, selectedClass, selectedSection, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const enriched = useMemo(() => {
    const logsBy = {};
    logs.forEach((l) => { (logsBy[String(l.studentId)] ||= []).push(l); });
    const actionsBy = {};
    interventions.forEach((a) => { (actionsBy[String(a.studentId)] ||= []).push(a); });
    const moodsBy = {};
    studentMoods.forEach((m) => {
      const day = localDateKey(new Date(m.at));
      const byDay = (moodsBy[String(m.studentId)] ||= {});
      if (!byDay[day] || new Date(m.at) > new Date(byDay[day].at)) byDay[day] = { mood: m.mood, at: m.at };
    });
    const today = localDateKey();
    const tryoutsBy = Object.fromEntries(tryoutStats.map((t) => [String(t.studentId), t]));
    return students.map((s) => {
      const studentLogs = (logsBy[s.id] || []).sort((a, b) => b.date.localeCompare(a.date));
      const diaryMoods = moodsBy[s.id] || {};
      const withLogs = { ...s, logs: studentLogs, interventions: actionsBy[s.id] || [], diaryMoods, todayMood: diaryMoods[today] || null, tryouts: tryoutsBy[s.id] || null };
      const metrics = computeMetrics(withLogs);
      return { ...withLogs, metrics, tone: toneOf(metrics.wellbeing) };
    });
  }, [students, logs, interventions, studentMoods, tryoutStats]);

  const directory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched
      .filter((s) => !q || s.name.toLowerCase().includes(q) || String(s.roll).toLowerCase().includes(q))
      .filter((s) => statusFilter === 'all' || s.tone === statusFilter)
      .sort((a, b) => parseSortNumber(a.roll) - parseSortNumber(b.roll) || a.name.localeCompare(b.name));
  }, [enriched, search, statusFilter]);

  useEffect(() => { setPage(1); }, [search, statusFilter, selectedSession, selectedClass, selectedSection]);
  const totalPages = Math.max(1, Math.ceil(directory.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = directory.slice(pageStart, pageStart + pageSize);

  const selected = useMemo(() => enriched.find((s) => s.id === selectedId) || null, [enriched, selectedId]);
  const todayKey = localDateKey();
  const checkedIn = enriched.filter((s) => s.logs.some((l) => l.date === todayKey)).length;
  const moodsSharedToday = enriched.filter((s) => s.todayMood).length;
  const toughMoodsToday = enriched.filter((s) => s.todayMood && moodTone(s.todayMood.mood) === 'tough').length;
  const counts = {
    good: enriched.filter((s) => s.tone === 'good').length,
    moderate: enriched.filter((s) => s.tone === 'moderate').length,
    risk: enriched.filter((s) => s.tone === 'risk').length,
  };
  const frequentIssues = useMemo(() => {
    const map = {};
    logs.forEach((l) => { if (l.issueTag && l.issueTag !== 'none') map[l.issueTag] = (map[l.issueTag] || 0) + 1; });
    return Object.entries(map).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [logs]);
  const repeatedIssueStudents = useMemo(() => enriched.filter((s) => {
    const c = {};
    s.logs.forEach((l) => { if (l.issueTag !== 'none') c[l.issueTag] = (c[l.issueTag] || 0) + 1; });
    return Object.values(c).some((n) => n >= 3);
  }), [enriched]);

  useEffect(() => {
    if (!selected) return;
    const existing = selected.logs.find((l) => l.date === quick.date);
    setQuick((q) => existing
      ? { ...q, overallStatus: existing.overallStatus, issueToday: existing.issueToday, issueTag: existing.issueTag, notes: existing.notes || '' }
      : { ...q, overallStatus: 'good', issueToday: 'no', issueTag: 'none', notes: '' });
    // Only re-seed when the student or date changes, not on every log refresh.
  }, [selectedId, quick.date]);

  const saveQuickEntry = async () => {
    if (!selected) return;
    setSavingQuick(true);
    try {
      const res = await fetch(`${API_BASE}/api/health-records/logs/bulk`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ date: quick.date, entries: [{ studentId: selected.id, overallStatus: quick.overallStatus, issueToday: quick.issueToday, issueTag: quick.issueToday === 'no' ? 'none' : quick.issueTag, notes: quick.notes }] }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Unable to save entry');
      toast.success(`Health entry saved for ${selected.name}`);
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingQuick(false);
    }
  };

  const saveIntervention = async () => {
    if (!selected) return;
    setSavingAction(true);
    try {
      const res = await fetch(`${API_BASE}/api/health-records/interventions`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ studentId: selected.id, ...action }) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Unable to save action');
      toast.success('Action saved');
      setAction({ type: 'Talked to student', followUpDate: '', notes: '', confidential: false });
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingAction(false);
    }
  };

  const trend = useMemo(() => {
    if (!selected) return [];
    const from = localDateKey(new Date(Date.now() - (range - 1) * 86400000));
    const points = [...selected.logs].filter((l) => l.date >= from).reverse();
    return [
      { label: 'Mood', color: '#2563eb', points: points.map((l) => l.mood ?? STATUS_SCORE[l.overallStatus]) },
      { label: 'Health', color: '#10b981', points: points.map((l) => Math.max(0, STATUS_SCORE[l.overallStatus] - (ISSUE_PENALTY[l.issueToday] || 0))) },
      { label: 'Behavior', color: '#f97316', points: points.map((l) => l.behavior ?? selected.baseline) },
    ];
  }, [selected, range]);

  const total = enriched.length || 1;

  const metricCards = selected ? [
    { label: 'Mood', value: selected.metrics.mood, icon: Smile, iconCls: 'text-emerald-500' },
    { label: 'Behavior', value: selected.metrics.behavior, icon: Users, iconCls: 'text-blue-600' },
    { label: 'Health', value: selected.metrics.health, icon: Heart, iconCls: 'text-rose-500' },
    { label: 'Engagement', value: selected.metrics.engagement, icon: TrendingUp, iconCls: 'text-violet-600', empty: 'No tryouts yet' },
    { label: 'Wellbeing', value: selected.metrics.wellbeing, icon: Leaf, iconCls: 'text-emerald-600' },
  ] : [];

  const panelCls = 'rounded-xl border border-[#eef2f7] bg-white p-4 shadow-[0_2px_10px_rgba(0,20,30,0.03)]';

  return (
    <Motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} ref={rootRef} style={rootHeight ? { height: rootHeight } : undefined} className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 overflow-hidden rounded-2xl border border-[#eaedf0] bg-[#fbfcff] p-4 text-[#14234b] shadow-[0_4px_20px_rgba(0,20,30,0.05)] sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><HeartPulse className="size-6" /></span>
          <div>
            <h1 className="text-xl font-bold">Student Health &amp; Wellbeing</h1>
            <p className="text-xs text-[#4a5a85]">Track students' mood, behavior, health and overall wellbeing.</p>
            {enriched.length > 0 && (
              <p className="mt-1 text-[11px] font-semibold text-[#4a5a85]">
                Today: {moodsSharedToday} of {enriched.length} students shared their mood in their diary
                {toughMoodsToday > 0 && <span className="ml-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">{toughMoodsToday} feeling low</span>}
              </p>
            )}
          </div>
        </div>
        <div className="relative flex items-center gap-2">
          {/* search: icon that slides open into a box */}
          <label aria-hidden={!searchOpen} className={`relative block overflow-hidden p-0.5 transition-all duration-300 ease-out ${searchOpen ? 'w-56 opacity-100' : 'w-0 opacity-0'}`}>
            <span className="sr-only">Search student</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input ref={searchInputRef} tabIndex={searchOpen ? 0 : -1} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }} placeholder="Search by name or roll…" className="w-full rounded-full border border-[#e2e8f0] bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-300" />
          </label>
          <button type="button" onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))} aria-label={searchOpen ? 'Close search' : 'Search students'} title={searchOpen ? 'Close search' : 'Search'} className="flex size-9 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-600 hover:bg-blue-50">
            {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
          </button>
          {/* status filter */}
          <button type="button" onClick={() => setFilterOpen((v) => !v)} aria-expanded={filterOpen} aria-label="Filter by status" title="Filter by status" className={`relative flex size-9 shrink-0 items-center justify-center rounded-full border transition ${statusFilter !== 'all' ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-white text-blue-600 hover:bg-blue-50'}`}>
            <Filter className="size-4" />
          </button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setFilterOpen(false)} aria-hidden="true" />
              <div role="menu" aria-label="Status filter" className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</p>
                {[['all', 'All students'], ['good', 'Good'], ['moderate', 'Moderate'], ['risk', 'At Risk']].map(([value, label]) => (
                  <button key={value} type="button" role="menuitemradio" aria-checked={statusFilter === value} onClick={() => { setStatusFilter(value); setFilterOpen(false); }} className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold ${statusFilter === value ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                    {label} {statusFilter === value && <CheckCircle2 className="size-3.5" />}
                  </button>
                ))}
              </div>
            </>
          )}
          <button type="button" onClick={refresh} disabled={loadingStudents} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50">
            {loadingStudents ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />} Refresh
          </button>
          <button type="button" onClick={() => setBulkOpen(true)} disabled={loadingStudents || !enriched.length} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            <Plus className="size-3.5" /> Add Entries
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Student Directory (full width) — click a student to open their wellbeing in a modal */}
        <section className={`${panelCls} flex min-h-0 flex-1 flex-col`}>
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-sm font-bold">Student Directory</h2>
            {statusFilter !== 'all' && (
              <button type="button" onClick={() => setStatusFilter('all')} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100">
                Status: {{ good: 'Good', moderate: 'Moderate', risk: 'At Risk' }[statusFilter]} <X className="size-3" />
              </button>
            )}
          </div>

          <div ref={tableBoxRef} className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[#f3f6fd] text-left text-[11px] font-semibold text-[#2a3a60]">
                <tr><th className="w-8 px-2 py-2 text-center">#</th><th className="px-2 py-2">Student</th><th className="px-2 py-2 text-center" title="Mood the student shared in their diary today">Today's mood</th><th className="px-2 py-2 text-center">Score</th><th className="px-2 py-2 text-center">Status</th></tr>
              </thead>
              <tbody>
                {loadingStudents && <tr><td colSpan={5} className="py-10 text-center text-slate-400"><Loader2 className="mx-auto size-5 animate-spin text-blue-500" /></td></tr>}
                {!loadingStudents && loadError && <tr><td colSpan={5} className="p-3"><div className="rounded-lg bg-rose-50 p-3 text-rose-600">{loadError}</div></td></tr>}
                {!loadingStudents && !loadError && !pageRows.length && <tr><td colSpan={5} className="py-10 text-center text-slate-400">No students match the current filters.</td></tr>}
                {!loadingStudents && pageRows.map((s, i) => {
                  const t = TONE[s.tone];
                  const active = s.id === selectedId;
                  return (
                    <tr key={s.id} onClick={() => { setSelectedId(s.id); setDetailOpen(true); }} className={`cursor-pointer border-t border-[#eef2f7] transition ${active && detailOpen ? 'bg-blue-50/70 outline outline-1 -outline-offset-1 outline-blue-200' : 'hover:bg-[#fafbff]'}`}>
                      <td className="px-2 py-2 text-center text-[#4a5a85]">{pageStart + i + 1}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar name={s.name} profilePic={s.profilePic} className="size-8 text-[11px]" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{s.name}</p>
                            <p className="text-[10px] text-[#6a7896]">{s.className} · Roll {s.roll || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">{s.todayMood ? <StudentMoodChip mood={s.todayMood.mood} at={s.todayMood.at} /> : <span className="text-[10.5px] text-slate-300">—</span>}</td>
                      <td className="px-2 py-2 text-center"><span className={`inline-block min-w-[40px] rounded-full px-2.5 py-1 font-semibold ${t.score}`}>{s.metrics.wellbeing}</span></td>
                      <td className="px-2 py-2 text-center"><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10.5px] font-medium ${t.pill}`}>{s.tone === 'risk' && <span className="size-1.5 rounded-full bg-white" />}{t.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 text-[11px] text-[#4a5a85]">
            <p>Showing {directory.length ? pageStart + 1 : 0} to {Math.min(pageStart + pageSize, directory.length)} of {directory.length} students</p>
            <Pager page={currentPage} totalPages={totalPages} onPage={setPage} />
          </div>
        </section>

        {/* Student detail — opens in a modal */}
        <Modal open={detailOpen && Boolean(selected)} onClose={() => setDetailOpen(false)} width="max-w-6xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-bold text-[#14234b]">Student wellbeing</p>
          <button type="button" onClick={() => setDetailOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="size-4" /></button>
        </div>
        <section className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {!selected ? (
            <div className="flex min-h-[300px] items-center justify-center text-sm text-slate-400">{loadingStudents ? 'Loading…' : 'Select a student to view wellbeing.'}</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={selected.name} profilePic={selected.profilePic} className="size-12 text-base" />
                  <div>
                    <h2 className="text-lg font-bold">{selected.name}</h2>
                    <p className="text-xs text-[#6a7896]">{selected.className} · Roll {selected.roll || '—'} · Sec {selected.section || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-1 overflow-x-auto rounded-full border border-[#eef2f7] bg-white p-1">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" onClick={() => setTab(key)} className={`inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium transition ${tab === key ? 'bg-blue-600 text-white shadow-sm' : 'text-[#2a3a60] hover:bg-slate-50'}`}><Icon className="size-3.5" />{label}</button>
                ))}
              </div>

              {/* Mood the student shared in their diary */}
              <div className="rounded-xl border border-[#eef2f7] bg-white p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-[#4a5a85]">Today's mood <span className="font-normal text-slate-400">· shared by the student in their diary</span></p>
                    <div className="mt-1.5">
                      {selected.todayMood
                        ? <StudentMoodChip mood={selected.todayMood.mood} at={selected.todayMood.at} size="lg" />
                        : <span className="text-xs text-slate-400">{selected.name.split(' ')[0]} hasn't written in their diary today.</span>}
                    </div>
                  </div>
                  <div className="flex items-end gap-1.5" aria-label="Moods over the last 7 days">
                    {Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(Date.now() - (6 - i) * 86400000);
                      const m = selected.diaryMoods[localDateKey(d)];
                      return (
                        <div key={i} className="flex w-9 flex-col items-center gap-1" title={m ? `${d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}: ${m.mood}` : 'Not shared'}>
                          <span className={`flex size-8 items-center justify-center rounded-full border ${m ? MOOD_TONE_CLS[moodTone(m.mood)] : 'border-dashed border-slate-200 bg-white'}`}>
                            {m ? <MoodIcon emoji={moodEmoji(m.mood)} label={m.mood} size={18} /> : <span className="text-[10px] text-slate-300">—</span>}
                          </span>
                          <span className={`text-[9.5px] font-semibold ${i === 6 ? 'text-blue-600' : 'text-slate-400'}`}>{i === 6 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' })}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {metricCards.map(({ label, value, icon: Icon, iconCls, empty }) => (
                  <div key={label} className="rounded-xl border border-[#eef2f7] bg-white p-3">
                    <div className="flex items-center gap-3">
                      <Icon className={`size-6 ${iconCls}`} />
                      <div><p className="text-[11px] text-[#4a5a85]">{label}</p><p className="text-lg font-bold leading-tight">{value === null || value === undefined ? <span className="text-xs font-medium text-slate-400">{empty || '—'}</span> : `${value}%`}</p></div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${TONE[toneOf(value ?? 0)].bar}`} style={{ width: `${value ?? 0}%` }} /></div>
                  </div>
                ))}
              </div>
              <p className="-mt-2 text-[10.5px] text-slate-400">
                {selected.metrics.hasData
                  ? `Based on ${selected.metrics.sources.diaryDays} diary mood day${selected.metrics.sources.diaryDays === 1 ? '' : 's'}, ${selected.metrics.sources.teacherEntries} health entr${selected.metrics.sources.teacherEntries === 1 ? 'y' : 'ies'} and ${selected.metrics.sources.tryoutAttempts} tryout attempt${selected.metrics.sources.tryoutAttempts === 1 ? '' : 's'} in the last 30 days.`
                  : 'No diary moods, health entries or tryouts yet — scores are estimated from attendance.'}
              </p>

              <AnimatePresence mode="wait" initial={false}>
                <Motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
                  {tab === 'overview' && (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                      <div className={panelCls}>
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><ClipboardList className="size-4" /></span>
                            <div><h3 className="text-sm font-bold">Quick Health Entry</h3><p className="text-[11px] text-[#6a7896]">Mark today's health and wellbeing status.</p></div>
                          </div>
                          <label className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-xs">
                            <Calendar className="size-3.5 text-slate-500" />
                            <input type="date" value={quick.date} max={localDateKey()} onChange={(e) => e.target.value && setQuick((q) => ({ ...q, date: e.target.value }))} className="bg-transparent text-xs outline-none" />
                          </label>
                        </div>

                        <p className="mb-1.5 text-xs font-medium">Overall Status</p>
                        <div className="mb-4 grid grid-cols-3 gap-2">
                          {STATUS_OPTIONS.map(({ value, label, icon: Icon, active, idle }) => (
                            <button key={value} type="button" onClick={() => setQuick((q) => ({ ...q, overallStatus: value }))} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${quick.overallStatus === value ? `${active} ring-1 ring-current/20` : idle}`}><Icon className="size-4" />{label}</button>
                          ))}
                        </div>

                        <p className="mb-1.5 text-xs font-medium">Any Issue Today?</p>
                        <div className="mb-4 flex gap-6">
                          {ISSUE_TODAY_OPTIONS.map((o) => (
                            <label key={o.value} className="flex cursor-pointer items-center gap-2 text-xs">
                              <input type="radio" name="issueToday" checked={quick.issueToday === o.value} onChange={() => setQuick((q) => ({ ...q, issueToday: o.value, issueTag: o.value === 'no' ? 'none' : q.issueTag }))} className="size-4 accent-blue-600" />{o.label}
                            </label>
                          ))}
                        </div>

                        <p className="mb-1.5 text-xs font-medium">If Yes, Select Issue</p>
                        <div className="mb-4 flex flex-wrap gap-2">
                          {ISSUE_TAGS.map((o) => {
                            const on = (quick.issueToday === 'no' ? 'none' : quick.issueTag) === o.value;
                            return (
                              <button key={o.value} type="button" disabled={quick.issueToday === 'no' && o.value !== 'none'} onClick={() => setQuick((q) => ({ ...q, issueTag: o.value }))} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] transition disabled:opacity-40 ${on ? 'border-blue-400 bg-blue-50 font-semibold text-blue-600' : 'border-slate-200 bg-slate-50 text-[#2a3a60] hover:bg-slate-100'}`}>{on && <CheckCircle2 className="size-3.5" />}{o.label}</button>
                            );
                          })}
                        </div>

                        <p className="mb-1.5 text-xs font-medium">Short Notes (Optional)</p>
                        <textarea value={quick.notes} maxLength={NOTE_LIMIT} onChange={(e) => setQuick((q) => ({ ...q, notes: e.target.value }))} placeholder="Write a short note..." rows={3} className="w-full resize-none rounded-lg border border-[#e2e8f0] px-3 py-2 text-xs outline-none focus:border-blue-300" />
                        <p className="mb-3 text-right text-[10px] text-slate-400">{quick.notes.length}/{NOTE_LIMIT}</p>
                        <button type="button" onClick={saveQuickEntry} disabled={savingQuick} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                          {savingQuick ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save in 1 click
                        </button>
                      </div>

                      <div className="space-y-4">

                        <div className={panelCls}>
                          <div className="flex items-start gap-2.5">
                            <span className="flex size-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Activity className="size-4" /></span>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-bold">Frequent Issues</h3>
                              {frequentIssues.length ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">{frequentIssues.map(([k, n]) => <span key={k} className="rounded-md bg-slate-50 px-2 py-1 text-[11px] text-[#2a3a60]">{ISSUE_LABEL[k] || k}: <strong>{n}</strong></span>)}</div>
                              ) : (
                                <div className="mt-1"><p className="text-xs text-[#2a3a60]">No frequent issues</p><p className="text-[10.5px] text-slate-400">There are no repeated issues reported in the last 30 days.</p></div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className={panelCls}>
                          <div className="flex items-start gap-2.5">
                            <span className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-500"><Bell className="size-4" /></span>
                            <div className="min-w-0 flex-1">
                              <h3 className="mb-2 text-sm font-bold">Smart Alert</h3>
                              {repeatedIssueStudents.length ? (
                                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-700"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><p className="font-semibold">Repeated issue detected (3+ times)</p><p>{repeatedIssueStudents.slice(0, 3).map((s) => s.name).join(', ')}{repeatedIssueStudents.length > 3 ? ` +${repeatedIssueStudents.length - 3} more` : ''}</p></div></div>
                              ) : (
                                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-emerald-800"><Shield className="mt-0.5 size-4 shrink-0 text-emerald-600" /><div><p className="font-semibold">No repeated critical pattern.</p><p className="text-emerald-700/80">All students are within normal range.</p></div></div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {tab === 'entries' && (
                    <div className={panelCls}>
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><Calendar className="size-4 text-blue-600" /> Health entries · last 30 days</h3>
                      {selected.logs.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-[#f3f6fd] text-left text-[11px] font-semibold text-[#2a3a60]"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Issue</th><th className="px-3 py-2" title="Mood the student picked in their diary that day">Mood</th><th className="px-3 py-2">Behavior</th><th className="px-3 py-2">Notes</th></tr></thead>
                            <tbody>
                              {selected.logs.map((l) => {
                                const opt = STATUS_OPTIONS.find((o) => o.value === l.overallStatus);
                                return (
                                  <tr key={l._id || l.date} className="border-t border-[#eef2f7]">
                                    <td className="px-3 py-2">{formatDate(l.date)}</td>
                                    <td className="px-3 py-2"><span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${opt?.active || ''}`}>{opt?.label}</span></td>
                                    <td className="px-3 py-2">{l.issueToday === 'no' ? 'No' : `${l.issueToday === 'maybe' ? 'Maybe' : 'Yes'} · ${ISSUE_LABEL[l.issueTag] || '—'}`}</td>
                                    <td className="px-3 py-2">
                                      {selected.diaryMoods[l.date]
                                        ? <StudentMoodChip mood={selected.diaryMoods[l.date].mood} at={selected.diaryMoods[l.date].at} />
                                        : l.mood ?? <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-3 py-2">{l.behavior ?? '—'}</td>
                                    <td className="px-3 py-2 text-[#4a5a85]">{l.notes || '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : <p className="py-6 text-center text-xs text-slate-400">No health entries recorded in the last 30 days.</p>}
                    </div>
                  )}

                  {tab === 'trends' && (
                    <div className={`${panelCls} space-y-3`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex gap-3 text-[11px]">{trend.map((s) => <span key={s.label} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: s.color }} />{s.label}</span>)}</div>
                        <div className="flex gap-1">{[7, 30].map((d) => <button key={d} type="button" onClick={() => setRange(d)} className={`rounded-lg px-3 py-1 text-[11px] font-medium ${range === d ? 'bg-blue-600 text-white' : 'bg-slate-100 text-[#2a3a60]'}`}>{d} days</button>)}</div>
                      </div>
                      {trend[0]?.points.length > 1 ? <TrendGraph series={trend} /> : <p className="py-6 text-center text-xs text-slate-400">At least two entries in this range are needed to draw a trend.</p>}
                    </div>
                  )}

                  {tab === 'parent' && (
                    <div className={`${panelCls} text-xs text-[#4a5a85]`}>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#14234b]"><MessageCircle className="size-4 text-blue-600" /> Parent Feedback</h3>
                      <p>No parent feedback has been shared for {selected.name} yet.</p>
                    </div>
                  )}

                  {tab === 'intervention' && (
                    <div className={`${panelCls} space-y-3`}>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <SelectBox value={action.type} onChange={(e) => setAction((a) => ({ ...a, type: e.target.value }))}><option>Talked to student</option><option>Informed parent</option><option>Sent to counselor</option></SelectBox>
                        <label className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-xs"><span className="text-slate-500">Follow-up</span><input type="date" value={action.followUpDate} onChange={(e) => setAction((a) => ({ ...a, followUpDate: e.target.value }))} className="flex-1 bg-transparent outline-none" /></label>
                      </div>
                      <textarea value={action.notes} maxLength={1000} onChange={(e) => setAction((a) => ({ ...a, notes: e.target.value }))} rows={3} placeholder="Action notes..." className="w-full resize-none rounded-lg border border-[#e2e8f0] px-3 py-2 text-xs outline-none focus:border-blue-300" />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button type="button" onClick={saveIntervention} disabled={savingAction} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{savingAction ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save Action</button>
                      </div>
                      <div className="space-y-2">
                        {selected.interventions.map((a) => (
                          <div key={a._id} className="rounded-lg border border-[#eef2f7] bg-slate-50 p-2.5 text-xs">
                            <p className="font-semibold">{a.type} <span className="font-normal text-slate-500">· {formatDate(a.date)}{a.followUpDate ? ` · Follow-up ${formatDate(a.followUpDate)}` : ''}</span></p>
                            {a.notes && <p className="mt-0.5 text-[#4a5a85]">{a.notes}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </Motion.div>
              </AnimatePresence>
            </>
          )}
        </section>
        </Modal>
      </div>

      <BulkEntryModal open={bulkOpen} onClose={() => setBulkOpen(false)} students={directory} onSaved={refresh} />
    </Motion.div>
  );
};

export default HealthUpdatesAdvanced;
