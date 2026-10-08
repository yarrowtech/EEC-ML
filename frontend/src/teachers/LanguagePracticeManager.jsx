import ReadingScoreCard from '../components/ReadingScoreCard';
import WritingScoreCard from '../components/WritingScoreCard';
/**
 * Teacher portal for managing reading materials and writing prompts,
 * and reviewing student language assessment results.
 */
import React, { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Mic, PenLine, Plus, Pencil, Trash2, Eye, ChevronRight,
  Loader2, AlertCircle, CheckCircle, XCircle, Download,
  SortAsc, Users, BookOpen, Filter, BarChart2,
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const token = () => localStorage.getItem('token');
const authHeaders = () => ({
  Authorization: `Bearer ${token()}`,
  'Content-Type': 'application/json',
});

const DIFFICULTY_COLORS = {
  easy: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700',
};

const surfaceClass = 'rounded-2xl border border-slate-200/80 bg-white shadow-sm';
const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100';
const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500';

const ScoreBadge = ({ score }) => {
  const color = score >= 80 ? 'bg-emerald-100 text-emerald-700' : score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}/100</span>;
};

// ─── Reading Material Form ────────────────────────────────────────────────────

const ReadingMaterialForm = ({ initial, onSave, onCancel }) => {
  const [form, setForm] = useState({
    title: '',
    contentType: 'paragraph',
    content: '',
    difficulty: 'medium',
    subject: '',
    chapter: '',
    tags: '',
    isPublished: false,
    ...initial,
  });
  const [saving, setSaving] = useState(false);

  const wordCount = form.content.trim().split(/\s+/).filter(Boolean).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.content) {
      toast.error('Title and content are required.');
      return;
    }
    setSaving(true);
    try {
      const url = initial?._id
        ? `${API_BASE}/api/reading-assessment/teacher/materials/${initial._id}`
        : `${API_BASE}/api/reading-assessment/teacher/materials`;
      const resp = await fetch(url, {
        method: initial?._id ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          ...form,
          tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      toast.success(initial?._id ? 'Updated!' : 'Created!');
      onSave(data.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (label, name, type = 'text', props = {}) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        className={inputClass}
        {...props}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <div className={`${surfaceClass} p-5 sm:p-6`}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-violet-600">Reading exercise</p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-slate-900">Build a passage students can read aloud</h2>
            </div>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700">{wordCount} words</span>
          </div>

          <div className="space-y-4">
            {field('Passage title *', 'title', 'text', { placeholder: 'E.g. The Tortoise and the Hare', maxLength: 80 })}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Exercise type *</label>
                <select value={form.contentType} onChange={(e) => setForm((f) => ({ ...f, contentType: e.target.value }))} className={inputClass}>
                  {['story', 'paragraph', 'poem', 'article', 'dialogue'].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Difficulty level</label>
                <select value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))} className={inputClass}>
                  {['easy', 'medium', 'hard'].map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {field('Subject', 'subject', 'text', { placeholder: 'English' })}
              {field('Chapter', 'chapter', 'text', { placeholder: 'Chapter 3' })}
            </div>
          </div>
        </div>

        <div className={`${surfaceClass} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5 sm:px-6">
            <div><p className={labelClass}>Passage content *</p><p className="text-xs text-slate-400">Keep the text clear and easy to follow.</p></div>
            <span className="hidden rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 sm:inline-flex">{form.content.trim().split(/[.!?]+/).filter(Boolean).length} sentences</span>
          </div>
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            rows={11}
            placeholder="Paste or type the reading passage here..."
            className="custom-scroll w-full resize-y border-0 px-5 py-4 text-base leading-8 text-slate-800 outline-none focus:ring-0 sm:px-6"
          />
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 text-xs text-slate-400 sm:px-6">
            <span>{wordCount} words</span><span>Reading passage</span>
          </div>
        </div>

        <div className={`${surfaceClass} p-5 sm:p-6`}>
          {field('Tags', 'tags', 'text', { placeholder: 'animals, fables, moral stories' })}
          <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} className="h-4 w-4 rounded text-violet-600 focus:ring-violet-500" />
            <span><span className="block text-sm font-bold text-slate-800">Publish for students</span><span className="block text-xs text-slate-500">Students can access this exercise immediately.</span></span>
          </label>
          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50">{saving ? 'Saving...' : initial?._id ? 'Update passage' : 'Save passage'}</button>
          </div>
        </div>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-5">
        <div className={`${surfaceClass} overflow-hidden`}>
          <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4"><p className={labelClass}>Student preview</p><h3 className="mt-1 text-lg font-extrabold text-slate-900">{form.title || 'Your passage title'}</h3></div>
          <div className="p-5"><div className="mb-3 flex flex-wrap gap-1.5"><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold capitalize text-violet-700">{form.contentType}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${DIFFICULTY_COLORS[form.difficulty]}`}>{form.difficulty}</span></div><p className="line-clamp-[10] whitespace-pre-wrap font-serif text-sm leading-7 text-slate-600">{form.content || 'Your reading passage will appear here as students see it.'}</p></div>
        </div>
        <div className={`${surfaceClass} p-5`}>
          <p className={labelClass}>Analysis & grade target</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5"><div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3"><span className="text-[10px] font-bold uppercase text-violet-700">Readability</span><p className="mt-1 text-lg font-extrabold text-violet-950">Grade {form.difficulty === 'easy' ? '3.5' : form.difficulty === 'hard' ? '7.0' : '5.0'}</p><span className="text-[10px] text-violet-600">Estimated level</span></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="text-[10px] font-bold uppercase text-slate-500">Target pace</span><p className="mt-1 text-lg font-extrabold text-slate-800">115 WPM</p><span className="text-[10px] text-slate-400">Reading aloud</span></div></div>
        </div>
      </aside>
    </form>
  );
};

// ─── Writing Prompt Form ──────────────────────────────────────────────────────

const WritingPromptForm = ({ initial, onSave, onCancel }) => {
  const [form, setForm] = useState({
    title: '',
    promptType: 'essay',
    question: '',
    instructions: '',
    difficulty: 'medium',
    wordLimit: 0,
    subject: '',
    chapter: '',
    isPublished: false,
    ...initial,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.question) {
      toast.error('Title and question are required.');
      return;
    }
    setSaving(true);
    try {
      const url = initial?._id
        ? `${API_BASE}/api/writing-assessment/teacher/prompts/${initial._id}`
        : `${API_BASE}/api/writing-assessment/teacher/prompts`;
      const resp = await fetch(url, {
        method: initial?._id ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ...form, wordLimit: Number(form.wordLimit) || 0 }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      toast.success(initial?._id ? 'Updated!' : 'Created!');
      onSave(data.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (label, name, type = 'text', props = {}) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        className={inputClass}
        {...props}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <div className={`${surfaceClass} p-5 sm:p-6`}>
          <div className="mb-5"><p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Writing exercise</p><h2 className="mt-1 text-lg font-extrabold tracking-tight text-slate-900">Create a prompt with clear student direction</h2></div>
          <div className="space-y-4">
            {field('Prompt title *', 'title', 'text', { placeholder: 'E.g. My Favourite Season', maxLength: 80 })}
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={labelClass}>Prompt type *</label><select value={form.promptType} onChange={(e) => setForm((f) => ({ ...f, promptType: e.target.value }))} className={inputClass}>{['essay', 'paragraph', 'question', 'letter', 'creative'].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></div>
              <div><label className={labelClass}>Difficulty level</label><select value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))} className={inputClass}>{['easy', 'medium', 'hard'].map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}</select></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">{field('Subject', 'subject', 'text', { placeholder: 'English' })}{field('Chapter', 'chapter', 'text', { placeholder: 'Chapter 5' })}</div>
          </div>
        </div>

        <div className={`${surfaceClass} p-5 sm:p-6`}>
          <div className="mb-2"><label className={labelClass}>Writing question / prompt *</label><p className="text-xs text-slate-400">Write the task exactly as students should see it.</p></div>
          <textarea value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} rows={5} placeholder="Write a short essay about..." className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-base leading-7 text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
          <div className="mt-4"><label className={labelClass}>Instructions <span className="font-medium normal-case tracking-normal text-slate-400">(optional)</span></label><textarea value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} rows={3} placeholder="Use paragraphs. Include an introduction and conclusion." className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100" /></div>
        </div>

        <div className={`${surfaceClass} p-5 sm:p-6`}>
          <div className="grid gap-4 sm:grid-cols-2">{field('Word limit (0 = no limit)', 'wordLimit', 'number', { min: 0, placeholder: '250' })}<div><label className={labelClass}>Student visibility</label><label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3"><input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500" /><span className="text-sm font-semibold text-slate-700">Publish immediately</span></label></div></div>
          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Saving...' : initial?._id ? 'Update prompt' : 'Save prompt'}</button></div>
        </div>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-5">
        <div className={`${surfaceClass} overflow-hidden`}><div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4"><p className={labelClass}>Student preview</p><h3 className="mt-1 text-lg font-extrabold text-slate-900">{form.title || 'Your prompt title'}</h3></div><div className="p-5"><div className="mb-3 flex flex-wrap gap-1.5"><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold capitalize text-emerald-700">{form.promptType}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${DIFFICULTY_COLORS[form.difficulty]}`}>{form.difficulty}</span></div><p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{form.question || 'Your writing prompt will appear here as students see it.'}</p>{form.instructions && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-500"><span className="font-bold text-slate-700">Instructions: </span>{form.instructions}</div>}</div></div>
        <div className={`${surfaceClass} p-5`}><p className={labelClass}>Prompt checklist</p><div className="mt-3 space-y-2 text-sm"><div className={`flex items-center gap-2 ${form.title ? 'text-emerald-700' : 'text-slate-400'}`}><CheckCircle className="h-4 w-4" /> Title added</div><div className={`flex items-center gap-2 ${form.question ? 'text-emerald-700' : 'text-slate-400'}`}><CheckCircle className="h-4 w-4" /> Question added</div><div className="flex items-center gap-2 text-slate-500"><CheckCircle className="h-4 w-4" /> {form.wordLimit > 0 ? `${form.wordLimit}-word limit` : 'No word limit'}</div></div></div>
      </aside>
    </form>
  );
};

// ─── Assessment result viewer ─────────────────────────────────────────────────

export const AssessmentDetailModal = ({ assessment, mode, onClose }) => {
  if (!assessment) return null;
  const student = assessment.studentId || {};

  return (
    <div role="dialog" aria-modal="true" aria-label="Assessment detail" className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
      <Motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Assessment Detail</h3>
            <p className="text-sm text-gray-500">{student.name || [student.firstName, student.lastName].filter(Boolean).join(' ') || 'Student'} — {new Date(assessment.createdAt).toLocaleDateString()}</p>
          </div>
          <button autoFocus aria-label="Close assessment detail" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <XCircle className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {mode === 'reading'
            ? <ReadingScoreCard assessment={assessment} material={assessment.materialId} />
            : <><p className="whitespace-pre-wrap rounded border p-4">{assessment.submission}</p><WritingScoreCard assessment={assessment} prompt={assessment.promptId} /></>}

        </div>
      </Motion.div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const LanguagePracticeManager = () => {
  const [mode, setMode] = useState('reading'); // reading | writing
  const [view, setView] = useState('list'); // list | create | edit | results
  const [editItem, setEditItem] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resultsFor, setResultsFor] = useState(null);
  const [sort, setSort] = useState('latest');
  const [detailAssessment, setDetailAssessment] = useState(null);

  const isReading = mode === 'reading';

  const fetchContent = async () => {
    setLoading(true);
    try {
      const url = isReading
        ? `${API_BASE}/api/reading-assessment/teacher/materials`
        : `${API_BASE}/api/writing-assessment/teacher/prompts`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await resp.json();
      if (isReading) setMaterials(data.data || []);
      else setPrompts(data.data || []);
    } catch {
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssessments = async (id) => {
    setLoading(true);
    try {
      const url = isReading
        ? `${API_BASE}/api/reading-assessment/teacher/assessments/${id}?sort=${sort}`
        : `${API_BASE}/api/writing-assessment/teacher/assessments/${id}?sort=${sort}`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed to load assessments');
      setAssessments(data.data || []);
    } catch {
      toast.error('Failed to load assessments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
    setView('list');
    setAssessments([]);
    setResultsFor(null);
  }, [mode]);

  useEffect(() => {
    if (resultsFor) fetchAssessments(resultsFor._id);
  }, [resultsFor, sort]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this item? Student assessment results will remain.')) return;
    try {
      const url = isReading
        ? `${API_BASE}/api/reading-assessment/teacher/materials/${id}`
        : `${API_BASE}/api/writing-assessment/teacher/prompts/${id}`;
      await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
      toast.success('Deleted');
      fetchContent();
    } catch {
      toast.error('Delete failed');
    }
  };

  const handlePublishToggle = async (item) => {
    const url = isReading
      ? `${API_BASE}/api/reading-assessment/teacher/materials/${item._id}`
      : `${API_BASE}/api/writing-assessment/teacher/prompts/${item._id}`;
    try {
      const resp = await fetch(url, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ isPublished: !item.isPublished }),
      });
      const data = await resp.json();
      if (isReading) setMaterials((m) => m.map((x) => x._id === item._id ? data.data : x));
      else setPrompts((m) => m.map((x) => x._id === item._id ? data.data : x));
      toast.success(data.data.isPublished ? 'Published!' : 'Unpublished');
    } catch {
      toast.error('Failed to update');
    }
  };

  const items = isReading ? materials : prompts;

  return (
    <div className="min-h-screen bg-[#f8f9fe] px-4 py-5 text-slate-800 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1520px] space-y-5">
        <header className={`${surfaceClass} flex flex-col gap-4 p-5 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-600"><BookOpen className="h-5 w-5" /></div>
            <div><h1 className="text-xl font-extrabold tracking-tight text-slate-900 lg:text-2xl">Add Learning Exercises</h1><p className="text-xs font-medium text-slate-500">Create reading passages or writing prompts for students</p></div>
          </div>
          <div className="flex justify-center">
            <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-100/90 p-1.5 shadow-inner">
              {[{ key: 'reading', label: 'Reading', icon: Mic }, { key: 'writing', label: 'Writing', icon: PenLine }].map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setMode(key)} type="button" className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${mode === key ? 'border border-violet-100 bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'}`}>
                  <Icon className={`h-4 w-4 ${mode === key ? 'text-violet-600' : 'text-slate-400'}`} /> {label}
                  {mode === key && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-extrabold text-violet-800">Active</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end md:justify-self-end">
            {view === 'list' && !resultsFor && <button onClick={() => { setView('create'); setEditItem(null); }} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"><Plus className="h-4 w-4" /> New {isReading ? 'Passage' : 'Prompt'}</button>}
          </div>
        </header>

        {resultsFor && <button onClick={() => { setResultsFor(null); setAssessments([]); }} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-violet-700">← Back to {isReading ? 'Passages' : 'Prompts'}</button>}

      {/* Create / Edit form */}
      <AnimatePresence>
        {(view === 'create' || view === 'edit') && (
          <Motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl"
          >
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-violet-600" />
              {view === 'edit' ? 'Edit' : 'New'} {isReading ? 'Reading Passage' : 'Writing Prompt'}
            </div>
            {isReading ? (
              <ReadingMaterialForm
                initial={editItem}
                onSave={() => { setView('list'); fetchContent(); }}
                onCancel={() => setView('list')}
              />
            ) : (
              <WritingPromptForm
                initial={editItem}
                onSave={() => { setView('list'); fetchContent(); }}
                onCancel={() => setView('list')}
              />
            )}
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Assessment results view */}
      {resultsFor && !loading && (
        <div className="space-y-4">
          <div className={`${surfaceClass} flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between`}>
            <div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">Student responses</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">{resultsFor.title || resultsFor.question?.slice(0, 50)}</h2></div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={`${inputClass} w-auto bg-white py-2`}
            >
              <option value="latest">Latest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest score</option>
              <option value="lowest">Lowest score</option>
            </select>
          </div>
          {assessments.length === 0 ? (
            <div className={`${surfaceClass} p-12 text-center text-sm text-slate-400`}>No student responses yet for this {isReading ? 'passage' : 'prompt'}.</div>
          ) : (
            <div className="space-y-2">
              {assessments.map((a) => {
                const student = a.studentId || {};
                return (
                  <Motion.div
                    key={a._id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`${surfaceClass} flex cursor-pointer items-center gap-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md`}
                    onClick={() => setDetailAssessment(a)}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0 ${
                      (a.scores?.overall || 0) >= 80 ? 'bg-emerald-500' : (a.scores?.overall || 0) >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    }`}>
                      {a.scores?.overall || 0}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{student.name || [student.firstName, student.lastName].filter(Boolean).join(' ') || 'Student'}</p>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                        {isReading && <span>{a.scores?.reading_speed || 0} WPM</span>}
                        {!isReading && <span>{a.wordCount || 0} words</span>}
                        {!isReading && a.cefrLevel && <span className="font-medium text-violet-600">{a.cefrLevel}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </Motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Content list */}
      {view === 'list' && !resultsFor && (
        <>
          <div className={`${surfaceClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
            <div><h2 className="text-lg font-extrabold tracking-tight text-slate-900">Your {isReading ? 'reading passages' : 'writing prompts'}</h2><p className="text-xs text-slate-500">Manage content, publish it to students, or review their responses.</p></div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span className="rounded-lg bg-slate-100 px-2.5 py-1.5">{items.length} {isReading ? 'passages' : 'prompts'}</span><span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-emerald-700">{items.filter((item) => item.isPublished).length} published</span></div>
          </div>
          {loading ? (
            <div className={`${surfaceClass} flex justify-center py-16`}><Loader2 className="h-8 w-8 animate-spin text-violet-300" /></div>
          ) : items.length === 0 ? (
            <div className={`${surfaceClass} p-16 text-center`}>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">{isReading ? <Mic className="h-6 w-6" /> : <PenLine className="h-6 w-6" />}</div>
              <p className="text-sm font-semibold text-slate-600">No {isReading ? 'reading passages' : 'writing prompts'} yet.</p>
              <p className="mt-1 text-xs text-slate-400">Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <Motion.div
                  key={item._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${surfaceClass} p-4 transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${DIFFICULTY_COLORS[item.difficulty] || 'bg-slate-100 text-slate-600'}`}>
                          {item.difficulty}
                        </span>
                        {item.isPublished ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Published</span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">Draft</span>
                        )}
                        {item.subject && (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-600">{item.subject}</span>
                        )}
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900">{item.title}</h3>
                      {!isReading && item.question && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.question}</p>
                      )}
                      {isReading && (
                        <p className="mt-1 text-xs text-slate-400">{item.wordCount || 0} words · ~{item.estimatedReadingTime || 1} min read</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => { setResultsFor(item); }}
                        title="View student results"
                        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-indigo-50 text-indigo-500 transition-colors"
                      >
                        <BarChart2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePublishToggle(item)}
                        title={item.isPublished ? 'Unpublish' : 'Publish'}
                        className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
                          item.isPublished ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-emerald-50 text-emerald-500'
                        }`}
                      >
                        {item.isPublished ? <Eye className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => { setEditItem(item); setView('edit'); }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item._id)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-50 text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Assessment detail modal */}
      <AnimatePresence>
        {detailAssessment && (
          <AssessmentDetailModal
            assessment={detailAssessment}
            mode={isReading ? 'reading' : 'writing'}
            onClose={() => setDetailAssessment(null)}
          />
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

export default LanguagePracticeManager;
