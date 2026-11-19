import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Calculator, CalendarDays, CheckCircle2, CheckSquare, ClipboardList, Clock, Download,
  FileText, FlaskConical, Globe2, Inbox, Laptop, Loader2, Paperclip, PenLine, Play, RefreshCw, Search,
  Send, Star, ChevronDown, Type, UploadCloud, X, Award, MessageSquareText, AlertTriangle,
} from 'lucide-react';
import { fetchCachedJson, clearStudentApiCacheByUrl } from '../utils/studentApiCache';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '').replace(/\/api$/, '');
const ASSIGNMENTS_ENDPOINT = `${API_BASE}/api/assignment/student/assignments`;
const ALLOWED_FILE = /\.(pdf|jpe?g|png|webp|heic|heif)$/i;

// ── what the teacher created → how the student works on it ─────────────
const kindOf = (a) => {
  const type = String(a.type || '').toLowerCase();
  if (a.isQuiz) {
    const secs = a.quizSections || [];
    if (secs.length && secs.every((s) => s.type === 'fill_blank')) return 'blank';
    if (secs.length && secs.every((s) => String(s.type).startsWith('mcq'))) return 'mcq';
    return 'quiz';
  }
  if (type === 'worksheet' || (a.submissionFormat === 'pdf' && type !== 'essay')) return 'worksheet';
  if (a.isEssay || type === 'essay') return 'writing';
  return 'assignment';
};
const KIND = {
  assignment: { label: 'Assignment', icon: FileText, tone: 'bg-blue-100 text-blue-700', solid: 'bg-blue-600', how: 'Read the instructions and type your answer.' },
  worksheet: { label: 'Worksheet', icon: ClipboardList, tone: 'bg-violet-100 text-violet-700', solid: 'bg-violet-600', how: 'Download the worksheet, fill it in, then upload a photo or PDF of it.' },
  writing: { label: 'Writing', icon: PenLine, tone: 'bg-emerald-100 text-emerald-700', solid: 'bg-emerald-600', how: 'Read the prompt and write your answer below.' },
  mcq: { label: 'MCQ Test', icon: CheckSquare, tone: 'bg-orange-100 text-orange-700', solid: 'bg-orange-500', how: 'Choose the correct option for each question. You get your score instantly.' },
  blank: { label: 'Fill in the Blanks', icon: Type, tone: 'bg-teal-100 text-teal-700', solid: 'bg-teal-600', how: 'Type the missing word in each sentence. You get your score instantly.' },
  quiz: { label: 'Quiz', icon: CheckSquare, tone: 'bg-purple-100 text-purple-700', solid: 'bg-purple-600', how: 'Answer all questions, then submit.' },
};

const SUBJECTS = [
  [/math/i, Calculator, 'bg-violet-100 text-violet-600'],
  [/english|hindi|bengali|language|literature/i, BookOpen, 'bg-rose-100 text-rose-600'],
  [/science|physics|chemistry|biology|evs/i, FlaskConical, 'bg-emerald-100 text-emerald-600'],
  [/social|history|geography|civics/i, Globe2, 'bg-sky-100 text-sky-600'],
  [/computer|ict|coding/i, Laptop, 'bg-blue-100 text-blue-600'],
];
const subjectStyle = (name) => {
  const hit = SUBJECTS.find(([re]) => re.test(String(name || '')));
  return hit ? { icon: hit[1], tone: hit[2] } : { icon: FileText, tone: 'bg-indigo-100 text-indigo-600' };
};

const stateOf = (a) => {
  const raw = String(a.submissionStatus || 'not_submitted').toLowerCase();
  if (raw === 'graded' || (a.publishedByTeacher && a.score !== undefined && a.score !== null)) return 'graded';
  if (raw === 'submitted' || raw === 'late') return 'submitted';
  return 'todo';
};
const daysLeft = (due) => (due ? Math.ceil((new Date(due) - new Date()) / 86400000) : null);
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const dueChip = (a) => {
  const d = daysLeft(a.dueDate);
  if (d === null) return { text: 'No due date', cls: 'bg-slate-100 text-slate-600' };
  if (d < 0) return { text: `Overdue by ${-d} day${d === -1 ? '' : 's'}`, cls: 'bg-red-50 text-red-600' };
  if (d === 0) return { text: 'Due today', cls: 'bg-amber-50 text-amber-700' };
  if (d === 1) return { text: 'Due tomorrow', cls: 'bg-amber-50 text-amber-700' };
  return { text: `${d} days left`, cls: d <= 3 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600' };
};
const wordLimitOf = (text) => {
  const m = String(text || '').match(/Word limit:\s*(?:(\d+)\s*[–-]\s*(\d+)|up to (\d+)|at least (\d+))/i);
  if (!m) return null;
  if (m[1]) return { min: +m[1], max: +m[2] };
  if (m[3]) return { min: 0, max: +m[3] };
  return { min: +m[4], max: 0 };
};
const countWords = (t) => (String(t || '').trim() ? String(t).trim().split(/\s+/).length : 0);
const fileName = (url) => { try { return decodeURIComponent(new URL(url).pathname.split('/').pop()); } catch { return 'File'; } };

const TABS = [
  { key: 'todo', label: 'To Do' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'graded', label: 'Graded' },
];

const StudentSchoolAssignments = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('todo');
  const [subject, setSubject] = useState('all');
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const [selectedId, setSelectedId] = useState(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null); // { url, name, size }
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef(null);

  const wrapRef = useRef(null);
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (!el || window.innerWidth < 1024) { setHeight(null); return; }
      setHeight(Math.max(460, window.innerHeight - el.getBoundingClientRect().top - 20));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const load = async (force = false) => {
    setLoading(true);
    try {
      const { data } = await fetchCachedJson(ASSIGNMENTS_ENDPOINT, {
        ttlMs: 2 * 60 * 1000,
        forceRefresh: force,
        fetchOptions: { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } },
      });
      const list = Array.isArray(data) ? data : Array.isArray(data?.assignments) ? data.assignments : [];
      setItems(list.map((a) => ({ ...a, id: String(a._id), kind: kindOf(a), state: stateOf(a) })));
    } catch (err) {
      console.error('Error fetching assignments:', err);
      toast.error('Could not load assignments.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(true); }, []);

  const subjects = useMemo(() => [...new Set(items.map((a) => a.subject || 'General'))].sort(), [items]);
  const counts = useMemo(() => {
    const scoped = items.filter((a) => subject === 'all' || (a.subject || 'General') === subject);
    return { todo: scoped.filter((a) => a.state === 'todo').length, submitted: scoped.filter((a) => a.state === 'submitted').length, graded: scoped.filter((a) => a.state === 'graded').length };
  }, [items, subject]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((a) => a.state === tab)
      .filter((a) => subject === 'all' || (a.subject || 'General') === subject)
      .filter((a) => !q || [a.title, a.subject, a.topic, a.chapterTitle].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => (tab === 'todo'
        ? new Date(a.dueDate || 8e15) - new Date(b.dueDate || 8e15)
        : new Date(b.submittedAt || b.dueDate || 0) - new Date(a.submittedAt || a.dueDate || 0)));
  }, [items, tab, subject, query]);

  const selected = items.find((a) => a.id === selectedId) || null;
  // Lock page scroll while the full-page view is open; Esc closes it.
  useEffect(() => {
    if (!selectedId) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [selectedId]);
  useEffect(() => { setText(''); setFile(null); }, [selectedId]);

  const upload = async (f) => {
    if (!f) return;
    if (!ALLOWED_FILE.test(f.name)) { toast.error('Please upload a PDF or a photo (JPG, PNG, WEBP or HEIC).'); return; }
    if (f.size > 20 * 1024 * 1024) { toast.error('File must be under 20 MB.'); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', f);
      const { data } = await axios.post(`${API_BASE}/api/uploads/cloudinary/single`, form, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'multipart/form-data' } });
      const up = data.files?.[0];
      if (!up?.secure_url) throw new Error('Upload failed');
      setFile({ url: up.secure_url, name: up.originalName || f.name, size: f.size });
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!selected) return;
    const needsFile = selected.kind === 'worksheet';
    if (needsFile && !file) { toast.error('Upload your completed worksheet first.'); return; }
    if (!needsFile && !text.trim()) { toast.error('Write your answer before submitting.'); return; }
    const limit = selected.kind === 'writing' ? wordLimitOf(selected.description) : null;
    if (limit?.min && countWords(text) < limit.min) { toast.error(`Write at least ${limit.min} words.`); return; }
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API_BASE}/api/assignment/submit`, {
        assignmentId: selected.id,
        submissionText: text,
        attachmentUrl: file?.url || undefined,
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      toast.success('Submitted! Your teacher will review it.');
      setItems((prev) => prev.map((a) => (a.id === selected.id ? {
        ...a, state: 'submitted', submissionStatus: data?.status || 'submitted', submittedAt: data?.submittedAt || new Date().toISOString(),
        submissionText: data?.submissionText ?? text, attachmentUrl: data?.attachmentUrl ?? file?.url ?? '',
      } : a)));
      clearStudentApiCacheByUrl(ASSIGNMENTS_ENDPOINT);
      setTab('submitted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── detail panel per type ────────────────────────────────────────────
  const renderWork = (a) => {
    const K = KIND[a.kind];
    if (a.state === 'graded') {
      const pct = a.marks ? Math.round((Number(a.score) / Number(a.marks)) * 100) : null;
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 p-4 text-white">
            <Award className="size-9 shrink-0" />
            <div className="flex-1">
              <p className="text-[12px] font-medium text-white/85">Your score</p>
              <p className="text-3xl font-bold leading-none">{a.score}<span className="text-lg text-white/75"> / {a.marks}</span></p>
            </div>
            {pct !== null && <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold">{pct}%</span>}
          </div>
          {a.feedback && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500"><MessageSquareText className="size-3.5" /> Teacher feedback</p>
              <p className="whitespace-pre-wrap text-[13px] text-slate-800">{a.feedback}</p>
            </div>
          )}
          {a.isQuiz && (
            <button type="button" onClick={() => navigate(`/student/quiz/${a.id}`)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[12px] font-semibold text-blue-700 hover:bg-blue-100">
              <CheckCircle2 className="size-3.5" /> See answers
            </button>
          )}
          <SubmittedCopy a={a} />
        </div>
      );
    }
    if (a.state === 'submitted') {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
            <CheckCircle2 className="size-6 shrink-0 text-blue-600" />
            <div>
              <p className="text-[13px] font-bold text-slate-900">Submitted{a.submissionStatus === 'late' ? ' (late)' : ''}</p>
              <p className="text-[11.5px] text-slate-600">{a.submittedAt ? `On ${fmtDate(a.submittedAt)} · ` : ''}Waiting for your teacher to check it.</p>
            </div>
          </div>
          <SubmittedCopy a={a} />
        </div>
      );
    }
    // To do
    if (a.isQuiz) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <K.icon className="mx-auto size-10 text-orange-500" />
          <p className="mt-2 text-[15px] font-bold text-slate-900">Ready to start?</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2 text-[11.5px]">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{a.quizQuestionCount || '—'} questions</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{a.marks} marks</span>
            {a.timeLimit ? <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">⏱ {a.timeLimit} min</span> : null}
          </div>
          <p className="mx-auto mt-2 max-w-sm text-[12px] text-slate-500">You can attempt this only once. Your score appears as soon as you submit.</p>
          <button type="button" onClick={() => navigate(`/student/quiz/${a.id}`)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-blue-700">
            <Play className="size-4" /> Start test
          </button>
        </div>
      );
    }
    if (a.kind === 'worksheet') {
      return (
        <div className="space-y-3">
          <Step n={1} title="Download the worksheet">
            <Attachments list={a.attachments} empty="Your teacher has not attached the worksheet yet." />
          </Step>
          <Step n={2} title="Fill it in on paper or on your device" />
          <Step n={3} title="Upload your completed worksheet">
            <Dropzone file={file} uploading={uploading} dragOver={dragOver} setDragOver={setDragOver} onFile={upload} inputRef={fileInput} onRemove={() => setFile(null)} />
          </Step>
        </div>
      );
    }
    const limit = a.kind === 'writing' ? wordLimitOf(a.description) : null;
    const words = countWords(text);
    const over = limit?.max && words > limit.max;
    return (
      <div className="space-y-3">
        {a.attachments?.length > 0 && <Attachments list={a.attachments} />}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[12px] font-semibold text-slate-700">Your answer</label>
            <span className={`text-[11px] font-medium ${over ? 'text-red-600' : limit && words >= (limit.min || 0) && words > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
              {words} word{words === 1 ? '' : 's'}{limit ? ` · ${limit.min && limit.max ? `${limit.min}–${limit.max}` : limit.max ? `up to ${limit.max}` : `at least ${limit.min}`}` : ''}
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={a.kind === 'writing' ? 10 : 7}
            placeholder={a.kind === 'writing' ? 'Start writing here…' : 'Write your answer here…'}
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] leading-relaxed text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>
    );
  };

  const canSubmit = selected && selected.state === 'todo' && !selected.isQuiz;
  const summary = { todo: items.filter((a) => a.state === 'todo').length, dueSoon: items.filter((a) => a.state === 'todo' && (daysLeft(a.dueDate) ?? 99) <= 2).length, graded: items.filter((a) => a.state === 'graded').length };

  return (
    <div className="space-y-3">
      <div ref={wrapRef} style={height ? { height } : undefined} className="flex min-h-[460px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><ClipboardList className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-bold leading-tight text-slate-900">My Assignments</h1>
            <p className="text-[12px] text-slate-500">Click <b>View</b> on any assignment to open it, do the work and submit.</p>
          </div>
          <button type="button" onClick={() => load(true)} aria-label="Refresh" title="Refresh" className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>

        {/* summary — divided by borders */}
        <div className="grid shrink-0 grid-cols-3 divide-x divide-slate-200 border-b border-slate-200">
          {[
            { label: 'To do', value: summary.todo, icon: FileText, tone: 'bg-blue-50 text-blue-600' },
            { label: 'Due in 2 days', value: summary.dueSoon, icon: Clock, tone: 'bg-amber-50 text-amber-600' },
            { label: 'Graded', value: summary.graded, icon: Award, tone: 'bg-emerald-50 text-emerald-600' },
          ].map((c) => (
            <div key={c.label} className="flex items-center gap-3 px-4 py-2.5">
              <span className={`hidden size-8 shrink-0 items-center justify-center rounded-lg sm:flex ${c.tone}`}><c.icon className="size-4" /></span>
              <div className="min-w-0">
                <p className="text-[17px] font-bold leading-none text-slate-900">{c.value}</p>
                <p className="mt-1 truncate text-[11px] text-slate-500">{c.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* tabs | search + subject */}
        <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 border-b border-slate-200 px-3 pt-2">
          <div className="flex overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`relative inline-flex shrink-0 items-center gap-1.5 px-2.5 pb-2.5 pt-1 text-[12.5px] font-semibold ${tab === t.key ? 'text-violet-700' : 'text-slate-500 hover:text-slate-800'}`}>
                {t.label}
                <span className={`rounded-full px-1.5 text-[10px] font-bold ${tab === t.key ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{counts[t.key]}</span>
                {tab === t.key && <Motion.span layoutId="stu-tab" className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-violet-600" />}
              </button>
            ))}
          </div>
          <div className="mb-2 ml-auto flex w-full items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assignments…" className="h-8 w-full rounded-full border border-slate-200 bg-slate-50 pl-8 pr-3 text-[12px] outline-none focus:border-violet-300 focus:bg-white" />
            </div>
            <div className="relative shrink-0">
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                aria-label="Filter by subject"
                className="h-8 appearance-none rounded-full border border-slate-200 bg-white pl-3 pr-8 text-[12px] font-semibold text-slate-700 outline-none focus:border-violet-300"
              >
                <option value="all">All subjects</option>
                {subjects.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>

        {/* table */}
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226_232_240)]">
              <tr>
                <th className="w-14 px-4 py-2.5">Sl No</th>
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5">Subject</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Due Date</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !items.length ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(7)].map((__, j) => <td key={j} className="px-4 py-3"><div className="h-3.5 animate-pulse rounded bg-slate-100" /></td>)}</tr>
                ))
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <Inbox className="mx-auto size-9 text-slate-300" />
                    <p className="mt-2 text-[13px] font-semibold text-slate-700">{tab === 'todo' ? 'All caught up! 🎉' : tab === 'submitted' ? 'Nothing waiting for checking' : 'No graded work yet'}</p>
                    <p className="text-[11.5px] text-slate-400">{query ? 'Try a different search.' : tab === 'todo' ? 'New work from your teachers will appear here.' : ''}</p>
                  </td>
                </tr>
              ) : list.map((a, idx) => {
                const K = KIND[a.kind];
                const chip = dueChip(a);
                return (
                  <tr key={a.id} className="transition hover:bg-violet-50/40">
                    <td className="px-4 py-2.5 font-semibold text-slate-500">{idx + 1}</td>
                    <td className="max-w-[280px] px-4 py-2.5">
                      <p className="truncate font-semibold text-slate-900" title={a.title}>{a.title}</p>
                      {a.chapterTitle && <p className="truncate text-[11px] text-slate-400">{a.chapterTitle}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-slate-700">{a.subject || 'General'}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold text-white ${K.solid}`}>{K.label}</span></td>
                    <td className="px-4 py-2.5 text-slate-600">{fmtDate(a.dueDate)}</td>
                    <td className="px-4 py-2.5">
                      {a.state === 'todo' && <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${chip.cls}`}>{chip.text}</span>}
                      {a.state === 'submitted' && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700">Awaiting marks</span>}
                      {a.state === 'graded' && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">{a.score}/{a.marks}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" aria-label={`Open assignment ${a.title}`} onClick={() => setSelectedId(a.id)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 text-[12px] font-semibold text-white shadow-sm hover:bg-violet-700">
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full-page view */}
      {selected && createPortal(
        <div className="fixed inset-0 z-[100] flex h-dvh w-screen flex-col bg-slate-100">
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
            <button type="button" onClick={() => setSelectedId(null)} aria-label="Back to assignments" className="flex size-8 items-center justify-center rounded-full text-violet-700 hover:bg-violet-50"><ArrowLeft className="size-4.5" /></button>
            {(() => { const S = subjectStyle(selected.subject); return <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${S.tone}`}><S.icon className="size-5" /></span>; })()}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-bold leading-tight text-slate-900">{selected.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-slate-500">
                <span>{selected.subject}</span>
                {selected.chapterTitle && <span>{selected.chapterTitle}</span>}
                <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />Due {fmtDate(selected.dueDate)}</span>
                <span className="inline-flex items-center gap-1"><Star className="size-3" />{selected.marks} marks</span>
                {selected.timeLimit && !selected.isQuiz ? <span className="inline-flex items-center gap-1"><Clock className="size-3" />{selected.timeLimit} min</span> : null}
                {selected.teacherId?.name && <span>By {selected.teacherId.name}</span>}
              </p>
            </div>
            {(() => { const K = KIND[selected.kind]; return <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${K.tone}`}><K.icon className="size-3.5" />{K.label}</span>; })()}
            <button type="button" onClick={() => setSelectedId(null)} aria-label="Close" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X className="size-4.5" /></button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-[960px] space-y-3 px-4 py-4 sm:px-6">
              {selected.state === 'todo' && (
                <p className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-[12.5px] text-violet-800"><span aria-hidden="true">💡</span>{KIND[selected.kind].how}</p>
              )}
              {selected.state === 'todo' && dueChip(selected).text.startsWith('Overdue') && (
                <p className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] text-red-700"><AlertTriangle className="size-3.5" /> This is past the due date — it will be marked late.</p>
              )}
              {selected.description && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{selected.kind === 'writing' ? 'Writing prompt' : 'Instructions'}</p>
                  <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-800">{selected.description}</p>
                </div>
              )}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                {renderWork(selected)}
              </div>
            </div>
          </div>

          {canSubmit && (
            <div className="flex shrink-0 items-center gap-3 border-t border-slate-200/80 bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6">
              <p className="mr-auto text-[11.5px] text-slate-500">You can submit only once — check your work first.</p>
              <button type="button" onClick={() => setSelectedId(null)} className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={submit} disabled={submitting || uploading} aria-label="Turn in assignment" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-5 text-[13px] font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

// ── small pieces ───────────────────────────────────────────────────────
const Step = ({ n, title, children }) => (
  <div className="flex gap-3">
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">{n}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-semibold text-slate-800">{title}</p>
      {children && <div className="mt-1.5">{children}</div>}
    </div>
  </div>
);

const Attachments = ({ list = [], empty }) => (
  list.length ? (
    <div className="flex flex-wrap gap-2">
      {list.map((f, i) => (
        <a key={`${f.url}-${i}`} href={f.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 hover:border-violet-300 hover:bg-violet-50">
          <Paperclip className="size-3.5 shrink-0 text-violet-600" /><span className="truncate">{f.name || fileName(f.url)}</span><Download className="size-3.5 shrink-0 text-slate-400" />
        </a>
      ))}
    </div>
  ) : (empty ? <p className="text-[12px] text-slate-400">{empty}</p> : null)
);

const Dropzone = ({ file, uploading, dragOver, setDragOver, onFile, inputRef, onRemove }) => (
  file ? (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
      <CheckCircle2 className="size-5 text-emerald-600" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-slate-800">{file.name}</p>
        <p className="text-[11px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB · ready to submit</p>
      </div>
      <a href={file.url} target="_blank" rel="noreferrer" className="text-[11.5px] font-semibold text-emerald-700 hover:underline">View</a>
      <button type="button" onClick={onRemove} aria-label="Remove file" className="rounded-full p-1 text-slate-400 hover:bg-white hover:text-red-600"><X className="size-3.5" /></button>
    </div>
  ) : (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files?.[0]); }}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${dragOver ? 'border-violet-400 bg-violet-50' : 'border-violet-200 bg-slate-50/60 hover:bg-violet-50/50'}`}
    >
      {uploading ? <Loader2 className="size-6 animate-spin text-violet-600" /> : <UploadCloud className="size-6 text-violet-600" />}
      <p className="mt-1.5 text-[12.5px] font-semibold text-slate-700">{uploading ? 'Uploading…' : 'Tap to upload or drag a file here'}</p>
      <p className="text-[11px] text-slate-500">PDF or photo (JPG, PNG) · up to 20 MB</p>
      <input ref={inputRef} type="file" accept=".pdf,image/*" aria-label="Upload a PDF or photo" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  )
);

const SubmittedCopy = ({ a }) => (
  (a.submissionText && !a.isQuiz) || a.attachmentUrl ? (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="mb-1 text-[11.5px] font-semibold text-slate-500">Your submission</p>
      {a.submissionText && !a.isQuiz && <p className="max-h-60 overflow-y-auto whitespace-pre-wrap text-[12.5px] text-slate-700">{a.submissionText}</p>}
      {a.attachmentUrl && (
        <a href={a.attachmentUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-violet-700 hover:underline"><Paperclip className="size-3.5" /> {fileName(a.attachmentUrl)}</a>
      )}
    </div>
  ) : null
);

export default StudentSchoolAssignments;
