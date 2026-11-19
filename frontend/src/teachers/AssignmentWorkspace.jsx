import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, BookOpen, Calculator, CalendarDays, ClipboardCheck, Edit3, ExternalLink,
  FileText, FlaskConical, Globe2, Info, Laptop, Loader2, MessageSquareText, Plus, Search, Send,
  Trash2, X, Check, Palette, Music, Dumbbell, Languages,
} from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : String(v || ''));

// Subject → icon + tint (matches the card icons in the design)
const SUBJECT_STYLES = [
  { test: /math/i, icon: Calculator, tone: 'bg-violet-100 text-violet-600' },
  { test: /english|hindi|bengali|language|literature/i, icon: BookOpen, tone: 'bg-rose-100 text-rose-600' },
  { test: /science|physics|chemistry|biology|evs/i, icon: FlaskConical, tone: 'bg-emerald-100 text-emerald-600' },
  { test: /social|history|geography|civics/i, icon: Globe2, tone: 'bg-sky-100 text-sky-600' },
  { test: /computer|ict|coding|it\b/i, icon: Laptop, tone: 'bg-blue-100 text-blue-600' },
  { test: /art|drawing/i, icon: Palette, tone: 'bg-amber-100 text-amber-600' },
  { test: /music/i, icon: Music, tone: 'bg-fuchsia-100 text-fuchsia-600' },
  { test: /physical|sport|pe\b/i, icon: Dumbbell, tone: 'bg-orange-100 text-orange-600' },
  { test: /french|spanish|german|sanskrit/i, icon: Languages, tone: 'bg-teal-100 text-teal-600' },
];
const subjectStyle = (subject) => SUBJECT_STYLES.find((s) => s.test.test(String(subject || ''))) || { icon: FileText, tone: 'bg-indigo-100 text-indigo-600' };

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const isGraded = (sub) => sub.score !== null && sub.score !== undefined;

const StatusPill = ({ status }) => {
  const map = {
    evaluated: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    pending: 'bg-amber-50 text-amber-700 ring-amber-100',
    draft: 'bg-slate-100 text-slate-600 ring-slate-200',
    waiting: 'bg-sky-50 text-sky-700 ring-sky-100',
  };
  const label = { evaluated: 'Evaluated', pending: 'Pending', draft: 'Draft', waiting: 'No submissions' }[status];
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${map[status]}`}>{label}</span>;
};

const AnswerModal = ({ sub, onClose }) => createPortal(
  <AnimatePresence>
    {sub && (
      <Motion.div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/40 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <Motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }} onClick={(e) => e.stopPropagation()} className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{sub.studentName}</p>
              <p className="text-[11px] text-slate-500">Submitted {fmtDate(sub.submittedAt)} · {sub.assignmentTitle}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
          </div>
          <div className="space-y-3 overflow-y-auto p-4 text-[13px] text-slate-700">
            {sub.submissionText ? <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 leading-relaxed">{sub.submissionText}</p> : null}
            {sub.quizResult?.answers?.length ? (
              <div className="space-y-2">
                {sub.quizResult.answers.map((a, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                    <p className="text-[11px] font-semibold text-slate-500">Q{i + 1}{a.questionText ? ` · ${a.questionText}` : ''}</p>
                    <p className="mt-0.5">{typeof a.answer === 'object' ? JSON.stringify(a.answer) : String(a.answer ?? '—')}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {sub.attachmentUrl ? (
              <a href={sub.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                <ExternalLink className="size-3.5" /> Open attachment
              </a>
            ) : null}
            {!sub.submissionText && !sub.attachmentUrl && !sub.quizResult?.answers?.length && <p className="text-center text-slate-400">No answer content.</p>}
            {sub.aiScore !== null && sub.aiScore !== undefined && (
              <div className="rounded-xl border border-violet-100 bg-violet-50 p-3">
                <p className="text-[11px] font-semibold text-violet-700">AI suggestion: {sub.aiScore} / {sub.totalMarks}</p>
                {sub.aiGradingFeedback && <p className="mt-1 text-[12px] text-violet-900">{sub.aiGradingFeedback}</p>}
              </div>
            )}
          </div>
        </Motion.div>
      </Motion.div>
    )}
  </AnimatePresence>,
  document.body
);

const AssignmentWorkspace = ({
  assignments = [],
  submissions = [],
  setSubmissions,
  loading = false,
  loadingSubmissions = false,
  currentClass = null,
  getAssignmentClassName,
  getAssignmentSectionName,
  onCreate,
  onOpenDetail,
  onDelete,
  onPublish,
  publishingAssignments = {},
}) => {
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detailTab, setDetailTab] = useState('submissions');
  const [drafts, setDrafts] = useState({}); // submissionId -> marks string
  const [activeSubId, setActiveSubId] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [rowSaving, setRowSaving] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type, text }
  const [viewing, setViewing] = useState(null);

  // Fill the screen; lists scroll inside their own panes.
  const wrapRef = useRef(null);
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (!el || window.innerWidth < 1024) { setHeight(null); return; }
      setHeight(Math.max(480, window.innerHeight - el.getBoundingClientRect().top - 20));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Only this class + section's assignments.
  const classAssignments = useMemo(() => {
    if (!currentClass) return assignments;
    return assignments.filter((a) => idOf(a.classId) === String(currentClass.classId) && (!currentClass.sectionId || !idOf(a.sectionId) || idOf(a.sectionId) === String(currentClass.sectionId)));
  }, [assignments, currentClass]);

  const subsByAssignment = useMemo(() => {
    const map = new Map();
    submissions.forEach((s) => {
      const k = String(s.assignmentId);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    });
    return map;
  }, [submissions]);

  const evalStatus = (a) => {
    if (a.status === 'draft') return 'draft';
    const subs = subsByAssignment.get(String(a._id)) || [];
    if (!subs.length) return 'waiting';
    return subs.every(isGraded) ? 'evaluated' : 'pending';
  };

  const counts = useMemo(() => {
    let pending = 0; let evaluated = 0;
    classAssignments.forEach((a) => { const st = evalStatus(a); if (st === 'pending') pending += 1; if (st === 'evaluated') evaluated += 1; });
    return { all: classAssignments.length, pending, evaluated };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classAssignments, subsByAssignment]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classAssignments
      .filter((a) => tab === 'all' || evalStatus(a) === tab)
      .filter((a) => !q || [a.title, a.subject, a.topic].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.dueDate || b.createdAt || 0) - new Date(a.dueDate || a.createdAt || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classAssignments, tab, query, subsByAssignment]);

  const selected = classAssignments.find((a) => String(a._id) === String(selectedId)) || null;
  useEffect(() => {
    if (!selectedId && list.length && window.innerWidth >= 1024) setSelectedId(String(list[0]._id));
  }, [list, selectedId]);

  const rows = useMemo(() => {
    if (!selected) return [];
    return [...(subsByAssignment.get(String(selected._id)) || [])].sort((a, b) => String(a.studentName || '').localeCompare(String(b.studentName || '')));
  }, [selected, subsByAssignment]);

  // reset per-assignment editing state
  useEffect(() => {
    setDrafts({}); setActiveSubId(null); setFeedback(''); setMessage(null); setDetailTab('submissions');
  }, [selectedId]);

  const activeSub = rows.find((r) => String(r.submissionId) === String(activeSubId)) || null;
  const pickRow = (sub) => { setActiveSubId(String(sub.submissionId)); setFeedback(sub.feedback || ''); };

  const markValue = (sub) => drafts[sub.submissionId] ?? (isGraded(sub) ? String(sub.score) : '');

  const applySaved = (grades) => {
    const byKey = new Map(grades.map((g) => [`${idOf(g.studentId)}::${idOf(g.assignmentId)}`, g]));
    setSubmissions?.((prev) => prev.map((s) => {
      const g = byKey.get(`${idOf(s.studentId)}::${idOf(s.assignmentId)}`);
      return g ? { ...s, score: g.score, feedback: g.feedback, status: 'graded', publishedByTeacher: true, publishedAt: new Date().toISOString() } : s;
    }));
    setDrafts((prev) => { const next = { ...prev }; grades.forEach((g) => { delete next[g.submissionId]; }); return next; });
  };

  // Saving a grade keeps it hidden from the student until it is published,
  // so every save here also publishes — the student sees marks + feedback at once.
  const publish = (assignmentId, studentIds) => axios.post(
    `${API_BASE_URL}/api/assignment/teacher/publish-grades`,
    { assignmentId: idOf(assignmentId), studentIds: studentIds.map(idOf) },
    { headers: authHeaders() }
  );

  const validate = (sub, value) => {
    const n = Number(value);
    const max = Number(sub.totalMarks ?? selected?.marks);
    if (value === '' || !Number.isFinite(n) || n < 0) return `Enter valid marks for ${sub.studentName}.`;
    if (Number.isFinite(max) && n > max) return `Marks for ${sub.studentName} cannot exceed ${max}.`;
    return null;
  };

  const saveRow = async (sub) => {
    const value = markValue(sub);
    const err = validate(sub, value);
    if (err) { setMessage({ type: 'error', text: err }); return; }
    const fb = String(activeSubId) === String(sub.submissionId) ? feedback : (sub.feedback || '');
    setRowSaving((p) => ({ ...p, [sub.submissionId]: true }));
    setMessage(null);
    try {
      await axios.post(`${API_BASE_URL}/api/assignment/teacher/grade`, { studentId: idOf(sub.studentId), assignmentId: idOf(sub.assignmentId), score: Number(value), feedback: fb }, { headers: authHeaders() });
      await publish(sub.assignmentId, [sub.studentId]);
      applySaved([{ submissionId: sub.submissionId, studentId: sub.studentId, assignmentId: sub.assignmentId, score: Number(value), feedback: fb }]);
      setMessage({ type: 'success', text: `Saved and shared marks with ${sub.studentName}.` });
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'Failed to save marks.' });
    } finally {
      setRowSaving((p) => ({ ...p, [sub.submissionId]: false }));
    }
  };

  const saveAll = async () => {
    const changed = rows.filter((s) => drafts[s.submissionId] !== undefined || (String(activeSubId) === String(s.submissionId) && feedback !== (s.feedback || '') && markValue(s) !== ''));
    if (!changed.length) { setMessage({ type: 'error', text: 'Enter marks or feedback before saving.' }); return; }
    for (const s of changed) { const err = validate(s, markValue(s)); if (err) { setMessage({ type: 'error', text: err }); return; } }
    const grades = changed.map((s) => ({
      submissionId: s.submissionId,
      studentId: idOf(s.studentId),
      assignmentId: idOf(s.assignmentId),
      score: Number(markValue(s)),
      feedback: String(activeSubId) === String(s.submissionId) ? feedback : (s.feedback || ''),
    }));
    setBulkSaving(true); setMessage(null);
    try {
      await axios.post(`${API_BASE_URL}/api/assignment/teacher/grade-bulk`, { grades: grades.map(({ submissionId: _s, ...g }) => g) }, { headers: authHeaders() });
      await publish(selected._id, grades.map((g) => g.studentId));
      applySaved(grades);
      setMessage({ type: 'success', text: `${grades.length} evaluation${grades.length === 1 ? '' : 's'} saved and shared with students.` });
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'Failed to save evaluation.' });
    } finally {
      setBulkSaving(false);
    }
  };

  const TABS = [
    { key: 'all', label: 'All Assignments', count: counts.all, badge: '' },
    { key: 'pending', label: 'Pending', count: counts.pending, badge: 'bg-amber-400 text-white' },
    { key: 'evaluated', label: 'Evaluated', count: counts.evaluated, badge: 'bg-emerald-500 text-white' },
  ];

  const showDetailOnMobile = Boolean(selected);

  return (
    <div
      ref={wrapRef}
      style={height ? { height } : undefined}
      className="grid min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
    >
      {/* ── LEFT: assignment list ── */}
      <section className={`min-h-0 flex-col border-slate-200 lg:flex lg:border-r ${showDetailOnMobile ? 'hidden' : 'flex'}`}>
        <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 px-3 pt-2">
          <AnimatePresence mode="wait" initial={false}>
            {searchOpen ? (
              <Motion.div key="s" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: '100%' }} exit={{ opacity: 0, width: 0 }} className="relative mb-2 flex-1 overflow-hidden">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); setQuery(''); } }} placeholder="Search assignments…" className="h-8 w-full rounded-full border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none focus:border-blue-300 focus:bg-white" />
              </Motion.div>
            ) : (
              <Motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TABS.map((t) => (
                  <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`relative inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-2 pb-2 pt-1 text-[12px] font-semibold transition ${tab === t.key ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}>
                    {t.label}
                    {t.badge ? <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${t.badge}`}>{t.count}</span> : <span>({t.count})</span>}
                    {tab === t.key && <Motion.span layoutId="aw-tab" className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-blue-600" />}
                  </button>
                ))}
              </Motion.div>
            )}
          </AnimatePresence>
          <button type="button" onClick={() => { if (searchOpen) { setSearchOpen(false); setQuery(''); } else setSearchOpen(true); }} aria-label={searchOpen ? 'Close search' : 'Search assignments'} className="mb-2 flex size-7 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            {searchOpen ? <X className="size-3.5" /> : <Search className="size-3.5" />}
          </button>
          <button type="button" onClick={onCreate} title="New assignment" aria-label="New assignment" className="mb-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700">
            <Plus className="size-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2.5">
          {loading && !classAssignments.length ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-[84px] animate-pulse rounded-xl bg-slate-100" />)
          ) : list.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <ClipboardCheck className="size-8 text-slate-300" />
              <p className="mt-2 text-xs font-medium text-slate-500">{query ? 'No assignments match your search' : 'No assignments here yet'}</p>
              {!query && <button type="button" onClick={onCreate} className="mt-3 inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white"><Plus className="size-3" /> New assignment</button>}
            </div>
          ) : list.map((a) => {
            const st = evalStatus(a);
            const { icon: Icon, tone } = subjectStyle(a.subject);
            const active = String(a._id) === String(selectedId);
            const cls = [getAssignmentClassName?.(a), getAssignmentSectionName?.(a)].filter(Boolean).join(' - ');
            return (
              <button
                key={a._id}
                type="button"
                onClick={() => setSelectedId(String(a._id))}
                className={`relative flex w-full items-start gap-3 rounded-xl border p-2.5 text-left transition ${active ? 'border-blue-200 bg-blue-50/70' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'}`}
              >
                {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-blue-600" />}
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-[13px] font-bold text-slate-900">{a.subject ? `${a.subject} – ` : ''}{a.title}</span>
                    <StatusPill status={st} />
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />Due: {fmtDate(a.dueDate)}</span>
                    <span className="text-slate-300">|</span>
                    <span>Marks: {a.marks ?? '—'}</span>
                  </span>
                  <span className="mt-1.5 flex items-center justify-between gap-2">
                    {cls ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-medium text-blue-700">{cls.toLowerCase().startsWith('class') ? cls : `Class ${cls}`}</span> : <span />}
                    <span className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      {st === 'pending' ? 'Evaluate' : st === 'evaluated' ? 'View Results' : 'Open'} <ArrowRight className="size-3" />
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── RIGHT: evaluate ── */}
      <section className={`min-h-0 flex-col lg:flex ${showDetailOnMobile ? 'flex' : 'hidden'}`}>
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <ClipboardCheck className="size-10 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-600">Select an assignment to evaluate</p>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-100 px-4 py-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600"><ClipboardCheck className="size-4" /></span>
              <h2 className="flex-1 text-[15px] font-bold text-slate-900">Evaluate Assignment</h2>
              {selected.status === 'draft' && (
                <button type="button" onClick={() => onPublish?.(selected)} disabled={publishingAssignments[selected._id]} className="inline-flex h-7 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {publishingAssignments[selected._id] ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />} Publish
                </button>
              )}
              <button type="button" onClick={() => onOpenDetail?.(selected)} title="Edit details" aria-label="Edit details" className="flex size-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Edit3 className="size-3.5" /></button>
              <button type="button" onClick={() => onDelete?.(selected)} title="Delete" aria-label="Delete assignment" className="flex size-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-3.5" /></button>
              <button type="button" onClick={() => setSelectedId(null)} className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 lg:hidden">
                <ArrowLeft className="size-3" /> Back to List
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
              {/* assignment summary */}
              {(() => {
                const { icon: Icon, tone } = subjectStyle(selected.subject);
                const cls = [getAssignmentClassName?.(selected), getAssignmentSectionName?.(selected)].filter(Boolean).join(' - ');
                return (
                  <div className="flex items-center gap-3">
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-slate-900">{selected.subject ? `${selected.subject} – ` : ''}{selected.title}</p>
                      <p className="text-[11.5px] text-slate-500">
                        {cls && <>Class: {cls} <span className="mx-1 text-slate-300">|</span></>}Due: {fmtDate(selected.dueDate)} <span className="mx-1 text-slate-300">|</span> Total Marks: {selected.marks ?? '—'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <p className="mt-3 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-[11.5px] text-slate-700">
                <Info className="size-4 shrink-0 text-blue-600" /> Evaluate the submitted answers and provide marks with feedback.
              </p>

              <div className="mt-3 flex gap-1 border-b border-slate-200">
                {[['submissions', `Submissions (${rows.length})`], ['instructions', 'Instructions']].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setDetailTab(k)} className={`relative px-2.5 pb-2 text-[12.5px] font-semibold ${detailTab === k ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}>
                    {l}
                    {detailTab === k && <Motion.span layoutId="aw-dtab" className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-blue-600" />}
                  </button>
                ))}
              </div>

              {detailTab === 'instructions' ? (
                <div className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-[12.5px] leading-relaxed text-slate-700">
                  {selected.description || selected.instructions || 'No instructions were added for this assignment.'}
                </div>
              ) : loadingSubmissions && !rows.length ? (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500"><Loader2 className="size-4 animate-spin" /> Loading submissions…</div>
              ) : !rows.length ? (
                <p className="py-10 text-center text-xs text-slate-500">{selected.status === 'draft' ? 'Publish this assignment so students can submit.' : 'No submissions yet.'}</p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full min-w-[520px] text-left text-[12px]">
                    <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600">
                      <tr>
                        <th className="w-8 px-2.5 py-2">#</th>
                        <th className="px-2.5 py-2">Student</th>
                        <th className="px-2.5 py-2">Submission</th>
                        <th className="w-28 px-2.5 py-2">Marks</th>
                        <th className="px-2.5 py-2">Status</th>
                        <th className="px-2.5 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((s, i) => {
                        const graded = isGraded(s);
                        const isActive = String(activeSubId) === String(s.submissionId);
                        return (
                          <tr key={s.submissionId} onClick={() => pickRow(s)} className={`cursor-pointer transition ${isActive ? 'bg-blue-50/60' : 'hover:bg-slate-50/70'}`}>
                            <td className="px-2.5 py-1.5 text-slate-500">{i + 1}</td>
                            <td className="px-2.5 py-1.5 font-medium text-slate-800">{s.studentName || '—'}</td>
                            <td className="px-2.5 py-1.5">
                              <button type="button" onClick={(e) => { e.stopPropagation(); setViewing(s); }} className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50/60 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100">
                                <FileText className="size-3" /> View Answer
                              </button>
                            </td>
                            <td className="px-2.5 py-1.5">
                              {(() => {
                                // Full marks for this assignment — the input can never go above it.
                                const fullMarks = Number(s.totalMarks ?? selected.marks);
                                const hasMax = Number.isFinite(fullMarks) && fullMarks > 0;
                                return (
                                  <span className="inline-flex items-center gap-1">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      min={0}
                                      max={hasMax ? fullMarks : undefined}
                                      step="0.5"
                                      value={markValue(s)}
                                      placeholder="—"
                                      onClick={(e) => e.stopPropagation()}
                                      onFocus={() => pickRow(s)}
                                      onKeyDown={(e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
                                      onChange={(e) => {
                                        let v = e.target.value;
                                        if (v !== '') {
                                          const n = Number(v);
                                          if (!Number.isFinite(n) || n < 0) v = '0';
                                          else if (hasMax && n > fullMarks) {
                                            v = String(fullMarks);
                                            setMessage({ type: 'error', text: `Marks can't be more than the full marks (${fullMarks}).` });
                                          }
                                        }
                                        setDrafts((p) => ({ ...p, [s.submissionId]: v }));
                                      }}
                                      className="h-7 w-14 rounded-md border border-slate-200 px-2 text-[12px] outline-none focus:border-blue-400"
                                      aria-label={`Marks for ${s.studentName}${hasMax ? ` out of ${fullMarks}` : ''}`}
                                    />
                                    {hasMax && <span className="text-[11px] text-slate-400">/ {fullMarks}</span>}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-2.5 py-1.5"><StatusPill status={graded ? 'evaluated' : 'pending'} /></td>
                            <td className="px-2.5 py-1.5 text-right">
                              <button type="button" onClick={(e) => { e.stopPropagation(); pickRow(s); saveRow(s); }} disabled={rowSaving[s.submissionId]} className={`inline-flex h-7 min-w-[64px] items-center justify-center gap-1 rounded-md px-2.5 text-[11px] font-semibold text-white transition disabled:opacity-60 ${graded ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'}`}>
                                {rowSaving[s.submissionId] ? <Loader2 className="size-3 animate-spin" /> : graded ? 'Update' : 'Evaluate'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* feedback + save */}
            {detailTab === 'submissions' && rows.length > 0 && (
              <div className="shrink-0 border-t border-slate-100 px-4 py-2.5">
                <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-slate-700">
                  <MessageSquareText className="size-3.5 text-blue-600" /> Add Feedback <span className="font-normal text-slate-400">(Optional{activeSub ? ` · for ${activeSub.studentName}` : ' · pick a student'})</span>
                </p>
                <div className="flex items-stretch gap-2">
                  <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} disabled={!activeSub} rows={2} placeholder={activeSub ? 'Enter feedback for the student…' : 'Click a student row to add feedback'} className="min-w-0 flex-1 resize-none rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] outline-none focus:border-blue-400 disabled:bg-slate-50" />
                  <button type="button" onClick={saveAll} disabled={bulkSaving} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
                    {bulkSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Save Evaluation
                  </button>
                </div>
                {message && <p className={`mt-1.5 text-[11px] font-medium ${message.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>{message.text}</p>}
              </div>
            )}
          </>
        )}
      </section>

      <AnswerModal sub={viewing} onClose={() => setViewing(null)} />
    </div>
  );
};

export default AssignmentWorkspace;
