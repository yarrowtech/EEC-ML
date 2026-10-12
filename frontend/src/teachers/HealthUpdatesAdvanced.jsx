import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, ArrowRight, Bell, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  FileText, Heart, HeartPulse, Home, Leaf, Loader2, Lock, MessageCircle, Plus, RefreshCcw, Save, Search, Shield,
  Smile, TrendingUp, UserRound, Users, Wrench, X, Clock, AlertCircle, Activity,
} from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

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
  { key: 'confidential', label: 'Confidential', icon: Lock },
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
  good: { label: 'Good', pill: 'bg-emerald-50 text-emerald-600', score: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
  moderate: { label: 'Moderate', pill: 'bg-amber-50 text-amber-600', score: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400' },
  risk: { label: 'At Risk', pill: 'bg-rose-50 text-rose-600', score: 'bg-amber-50 text-amber-600', bar: 'bg-rose-500' },
};

// Scores come from the teacher's saved daily check-ins; when a student has no
// check-ins yet we fall back to an attendance-derived baseline.
const computeMetrics = (student) => {
  const logs = student.logs || [];
  if (!logs.length) {
    const base = student.baseline;
    return { mood: base, behavior: base, health: base, wellbeing: base, hasData: false };
  }
  const mood = avg(logs.map((l) => l.mood ?? STATUS_SCORE[l.overallStatus] ?? 60));
  const behavior = avg(logs.map((l) => l.behavior ?? student.baseline));
  const health = avg(logs.map((l) => Math.max(0, (STATUS_SCORE[l.overallStatus] ?? 60) - (ISSUE_PENALTY[l.issueToday] || 0))));
  const wellbeing = Math.round(mood * 0.35 + behavior * 0.35 + health * 0.3);
  return { mood, behavior, health, wellbeing, hasData: true };
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
          return r.ok ? p.data : { logs: [], interventions: [] };
        }));
        if (cancelled) return;
        setStudents(mapped);
        setLogs(results.flatMap((r) => r?.logs || []));
        setInterventions(results.flatMap((r) => r?.interventions || []));
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
    return students.map((s) => {
      const studentLogs = (logsBy[s.id] || []).sort((a, b) => b.date.localeCompare(a.date));
      const withLogs = { ...s, logs: studentLogs, interventions: actionsBy[s.id] || [] };
      const metrics = computeMetrics(withLogs);
      return { ...withLogs, metrics, tone: toneOf(metrics.wellbeing) };
    });
  }, [students, logs, interventions]);

  const directory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched
      .filter((s) => !q || s.name.toLowerCase().includes(q) || String(s.roll).toLowerCase().includes(q))
      .filter((s) => statusFilter === 'all' || s.tone === statusFilter)
      .sort((a, b) => parseSortNumber(a.roll) - parseSortNumber(b.roll) || a.name.localeCompare(b.name));
  }, [enriched, search, statusFilter]);

  useEffect(() => { setPage(1); }, [search, statusFilter, selectedSession, selectedClass, selectedSection]);
  const totalPages = Math.max(1, Math.ceil(directory.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = directory.slice(pageStart, pageStart + PAGE_SIZE);

  const selected = useMemo(() => enriched.find((s) => s.id === selectedId) || null, [enriched, selectedId]);
  const todayKey = localDateKey();
  const checkedIn = enriched.filter((s) => s.logs.some((l) => l.date === todayKey)).length;
  const counts = {
    good: enriched.filter((s) => s.tone === 'good').length,
    moderate: enriched.filter((s) => s.tone === 'moderate').length,
    risk: enriched.filter((s) => s.tone === 'risk').length,
  };
  const atRisk = useMemo(() => enriched.filter((s) => s.tone !== 'good').sort((a, b) => a.metrics.wellbeing - b.metrics.wellbeing), [enriched]);
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
  const stats = [
    { value: enriched.length, label: 'Students', hint: 'Total in this class', icon: Users, card: 'border-blue-100 bg-blue-50/50', iconBox: 'bg-blue-100 text-blue-600' },
    { value: checkedIn, label: 'Checked In', hint: 'Health entry submitted', icon: CheckCircle2, card: 'border-emerald-100 bg-emerald-50/50', iconBox: 'bg-emerald-100 text-emerald-600' },
    { value: Math.max(enriched.length - checkedIn, 0), label: 'Pending', hint: 'Yet to submit', icon: Clock, card: 'border-amber-100 bg-amber-50/50', iconBox: 'bg-amber-100 text-amber-500' },
    { value: counts.risk, label: 'At Risk', hint: 'Score 0 – 39', icon: AlertTriangle, card: 'border-rose-100 bg-rose-50/50', iconBox: 'bg-rose-100 text-rose-600', valueCls: 'text-rose-700' },
  ];

  const metricCards = selected ? [
    { label: 'Mood', value: selected.metrics.mood, icon: Smile, iconCls: 'text-emerald-500' },
    { label: 'Behavior', value: selected.metrics.behavior, icon: Users, iconCls: 'text-blue-600' },
    { label: 'Health', value: selected.metrics.health, icon: Heart, iconCls: 'text-rose-500' },
    { label: 'Wellbeing', value: selected.metrics.wellbeing, icon: Leaf, iconCls: 'text-emerald-600' },
  ] : [];

  const panelCls = 'rounded-xl border border-[#eef2f7] bg-white p-4 shadow-[0_2px_10px_rgba(0,20,30,0.03)]';

  return (
    <Motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mx-auto w-full max-w-[1400px] space-y-4 rounded-2xl border border-[#eaedf0] bg-[#fbfcff] p-4 text-[#14234b] shadow-[0_4px_20px_rgba(0,20,30,0.05)] sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><HeartPulse className="size-6" /></span>
          <div>
            <h1 className="text-xl font-bold">Student Health &amp; Wellbeing</h1>
            <p className="text-xs text-[#4a5a85]">Track students' mood, behavior, health and overall wellbeing.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={refresh} disabled={loadingStudents} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50">
            {loadingStudents ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />} Refresh
          </button>
          <button type="button" onClick={() => setBulkOpen(true)} disabled={loadingStudents || !enriched.length} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            <Plus className="size-3.5" /> Add Entries
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.2fr)]">
        {stats.map(({ value, label, hint, icon: Icon, card, iconBox, valueCls }) => (
          <div key={label} className={`flex items-center gap-3 rounded-xl border p-3 ${card}`}>
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${iconBox}`}><Icon className="size-5" /></span>
            <div className="min-w-0">
              <p className={`text-xl font-bold leading-tight ${valueCls || ''}`}>{loadingStudents ? '–' : value}</p>
              <p className="text-xs font-medium text-[#2a3a60]">{label}</p>
              <p className="truncate text-[10px] text-[#6a7896]">{hint}</p>
            </div>
          </div>
        ))}
        <div className="flex flex-col justify-center gap-1.5 rounded-xl border border-[#eef2f7] bg-white p-3 sm:col-span-2 xl:col-span-1">
          {[['Good (70–100)', counts.good, 'bg-emerald-500'], ['Moderate (40–69)', counts.moderate, 'bg-amber-400'], ['At Risk (0–39)', counts.risk, 'bg-rose-500']].map(([label, n, color]) => (
            <div key={label} className="flex items-center gap-2 text-[11px]">
              <span className={`size-2 rounded-full ${color}`} />
              <span className="w-24 shrink-0 text-[#2a3a60]">{label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${(n / total) * 100}%` }} /></div>
              <span className="w-6 text-right text-[#2a3a60]">{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Student Directory */}
        <section className={`${panelCls} flex flex-col`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold">Student Directory</h2>
            <div className="relative min-w-[160px] flex-1 sm:max-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student..." className="w-full rounded-lg border border-[#e2e8f0] py-2 pl-8 pr-3 text-xs outline-none focus:border-blue-300" />
            </div>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SelectBox value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}><option value="">All Years</option>{sessionOptions.map((o) => <option key={o} value={o}>{o}</option>)}</SelectBox>
            <SelectBox value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}><option value="">All Classes</option>{classOptions.map((o) => <option key={o} value={o}>{o}</option>)}</SelectBox>
            <SelectBox value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}><option value="">All Sections</option>{sectionOptions.map((o) => <option key={o} value={o}>{o}</option>)}</SelectBox>
            <SelectBox value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All Status</option><option value="good">Good</option><option value="moderate">Moderate</option><option value="risk">At Risk</option></SelectBox>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#f3f6fd] text-left text-[11px] font-semibold text-[#2a3a60]">
                <tr><th className="w-8 px-2 py-2 text-center">#</th><th className="px-2 py-2">Student</th><th className="px-2 py-2 text-center">Score</th><th className="px-2 py-2 text-center">Status</th></tr>
              </thead>
              <tbody>
                {loadingStudents && <tr><td colSpan={4} className="py-10 text-center text-slate-400"><Loader2 className="mx-auto size-5 animate-spin text-blue-500" /></td></tr>}
                {!loadingStudents && loadError && <tr><td colSpan={4} className="p-3"><div className="rounded-lg bg-rose-50 p-3 text-rose-600">{loadError}</div></td></tr>}
                {!loadingStudents && !loadError && !pageRows.length && <tr><td colSpan={4} className="py-10 text-center text-slate-400">No students match the current filters.</td></tr>}
                {!loadingStudents && pageRows.map((s, i) => {
                  const t = TONE[s.tone];
                  const active = s.id === selectedId;
                  return (
                    <tr key={s.id} onClick={() => setSelectedId(s.id)} className={`cursor-pointer border-t border-[#eef2f7] transition ${active ? 'bg-blue-50/70 outline outline-1 -outline-offset-1 outline-blue-200' : 'hover:bg-[#fafbff]'}`}>
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
                      <td className="px-2 py-2 text-center"><span className={`inline-block min-w-[36px] rounded-md px-1.5 py-1 font-semibold ${t.score}`}>{s.metrics.wellbeing}</span></td>
                      <td className="px-2 py-2 text-center"><span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium ${t.pill}`}>{s.tone === 'risk' && <span className="size-1.5 rounded-full bg-rose-500" />}{t.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#4a5a85]">
            <p>Showing {directory.length ? pageStart + 1 : 0} to {Math.min(pageStart + PAGE_SIZE, directory.length)} of {directory.length} students</p>
            <Pager page={currentPage} totalPages={totalPages} onPage={setPage} />
          </div>
        </section>

        {/* Student detail */}
        <section className={`${panelCls} space-y-4`}>
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
                <button type="button" onClick={() => setTab('entries')} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"><FileText className="size-3.5" /> View Full Report</button>
              </div>

              <div className="flex gap-1 overflow-x-auto rounded-xl border border-[#eef2f7] bg-white p-1">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" onClick={() => setTab(key)} className={`inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ${tab === key ? 'bg-blue-600 text-white shadow-sm' : 'text-[#2a3a60] hover:bg-slate-50'}`}><Icon className="size-3.5" />{label}</button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {metricCards.map(({ label, value, icon: Icon, iconCls }) => (
                  <div key={label} className="rounded-xl border border-[#eef2f7] bg-white p-3">
                    <div className="flex items-center gap-3">
                      <Icon className={`size-6 ${iconCls}`} />
                      <div><p className="text-[11px] text-[#4a5a85]">{label}</p><p className="text-lg font-bold leading-tight">{value}</p></div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${TONE[toneOf(value)].bar}`} style={{ width: `${value}%` }} /></div>
                  </div>
                ))}
              </div>
              {!selected.metrics.hasData && <p className="-mt-2 text-[10.5px] text-slate-400">No health entries yet — scores are estimated from attendance until the first entry is saved.</p>}

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
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="flex size-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><AlertTriangle className="size-4" /></span>
                              <div><h3 className="text-sm font-bold">At Risk Students</h3><p className="text-xs text-rose-600">{atRisk.length} students</p></div>
                            </div>
                            <button type="button" onClick={() => setStatusFilter('risk')} className="rounded-lg border border-blue-200 px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50">View All</button>
                          </div>
                          {atRisk.length ? (
                            <>
                              <ul className="divide-y divide-[#eef2f7] text-xs">
                                {atRisk.slice(0, 5).map((s, i) => (
                                  <li key={s.id}>
                                    <button type="button" onClick={() => setSelectedId(s.id)} className="flex w-full items-center gap-3 py-1.5 text-left hover:bg-slate-50">
                                      <span className="w-4 text-[#6a7896]">{i + 1}</span>
                                      <span className="flex-1 truncate font-medium">{s.name}</span>
                                      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${s.tone === 'risk' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>{s.metrics.wellbeing}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                              {atRisk.length > 5 && <button type="button" onClick={() => setStatusFilter('risk')} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600">View all {atRisk.length} at-risk students <ArrowRight className="size-3" /></button>}
                            </>
                          ) : <p className="text-xs text-slate-400">No at-risk students.</p>}
                        </div>

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
                            <thead className="bg-[#f3f6fd] text-left text-[11px] font-semibold text-[#2a3a60]"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Issue</th><th className="px-3 py-2">Mood</th><th className="px-3 py-2">Behavior</th><th className="px-3 py-2">Notes</th></tr></thead>
                            <tbody>
                              {selected.logs.map((l) => {
                                const opt = STATUS_OPTIONS.find((o) => o.value === l.overallStatus);
                                return (
                                  <tr key={l._id || l.date} className="border-t border-[#eef2f7]">
                                    <td className="px-3 py-2">{formatDate(l.date)}</td>
                                    <td className="px-3 py-2"><span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${opt?.active || ''}`}>{opt?.label}</span></td>
                                    <td className="px-3 py-2">{l.issueToday === 'no' ? 'No' : `${l.issueToday === 'maybe' ? 'Maybe' : 'Yes'} · ${ISSUE_LABEL[l.issueTag] || '—'}`}</td>
                                    <td className="px-3 py-2">{l.mood ?? '—'}</td>
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
                        <label className="flex items-center gap-2 text-xs text-[#4a5a85]"><input type="checkbox" checked={action.confidential} onChange={(e) => setAction((a) => ({ ...a, confidential: e.target.checked }))} className="accent-blue-600" /> Confidential note</label>
                        <button type="button" onClick={saveIntervention} disabled={savingAction} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{savingAction ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save Action</button>
                      </div>
                      <div className="space-y-2">
                        {selected.interventions.filter((a) => !a.confidential).map((a) => (
                          <div key={a._id} className="rounded-lg border border-[#eef2f7] bg-slate-50 p-2.5 text-xs">
                            <p className="font-semibold">{a.type} <span className="font-normal text-slate-500">· {formatDate(a.date)}{a.followUpDate ? ` · Follow-up ${formatDate(a.followUpDate)}` : ''}</span></p>
                            {a.notes && <p className="mt-0.5 text-[#4a5a85]">{a.notes}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {tab === 'confidential' && (
                    <div className={`${panelCls} text-xs`}>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Lock className="size-4 text-blue-600" /> Confidential Notes</h3>
                      {selected.interventions.some((a) => a.confidential) ? selected.interventions.filter((a) => a.confidential).map((a) => (
                        <div key={a._id} className="mb-2 rounded-lg bg-slate-50 p-2.5"><p className="text-[10.5px] text-slate-500">{formatDate(a.date)} · {a.type}</p><p className="mt-0.5">{a.notes || '—'}</p></div>
                      )) : <p className="text-slate-400">No confidential notes yet.</p>}
                    </div>
                  )}
                </Motion.div>
              </AnimatePresence>
            </>
          )}
        </section>
      </div>

      <BulkEntryModal open={bulkOpen} onClose={() => setBulkOpen(false)} students={directory} onSaved={refresh} />
    </Motion.div>
  );
};

export default HealthUpdatesAdvanced;
