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
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        {...props}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {field('Title *', 'title', 'text', { placeholder: 'E.g. The Tortoise and the Hare' })}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Content Type *</label>
          <select value={form.contentType} onChange={(e) => setForm((f) => ({ ...f, contentType: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            {['story', 'paragraph', 'poem', 'article', 'dialogue'].map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Difficulty</label>
          <select value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            {['easy', 'medium', 'hard'].map((d) => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('Subject', 'subject', 'text', { placeholder: 'English' })}
        {field('Chapter', 'chapter', 'text', { placeholder: 'Chapter 3' })}
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          Reading Passage * <span className="text-gray-400 font-normal">({wordCount} words)</span>
        </label>
        <textarea
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          rows={8}
          placeholder="Paste the reading passage here..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y leading-7 font-['Georgia',serif]"
        />
      </div>
      {field('Tags (comma-separated)', 'tags', 'text', { placeholder: 'animals, fables, moral stories' })}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isPublished}
          onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
          className="w-4 h-4 text-indigo-600 rounded"
        />
        <span className="text-sm font-medium text-gray-700">Publish (visible to students)</span>
      </label>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50">
          {saving ? 'Saving...' : initial?._id ? 'Update' : 'Create'}
        </button>
      </div>
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
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
        {...props}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {field('Title *', 'title', 'text', { placeholder: 'E.g. My Favourite Season' })}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Prompt Type *</label>
          <select value={form.promptType} onChange={(e) => setForm((f) => ({ ...f, promptType: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
            {['essay', 'paragraph', 'question', 'letter', 'creative'].map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Difficulty</label>
          <select value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
            {['easy', 'medium', 'hard'].map((d) => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Writing Question / Prompt *</label>
        <textarea
          value={form.question}
          onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
          rows={3}
          placeholder="Write a short essay about..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-y"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Instructions (optional)</label>
        <textarea
          value={form.instructions}
          onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
          rows={2}
          placeholder="Use paragraphs. Include an introduction and conclusion."
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-y"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('Subject', 'subject', 'text', { placeholder: 'English' })}
        {field('Chapter', 'chapter', 'text', { placeholder: 'Chapter 5' })}
      </div>
      {field('Word Limit (0 = no limit)', 'wordLimit', 'number', { min: 0, placeholder: '250' })}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isPublished}
          onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
          className="w-4 h-4 text-emerald-600 rounded"
        />
        <span className="text-sm font-medium text-gray-700">Publish (visible to students)</span>
      </label>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50">
          {saving ? 'Saving...' : initial?._id ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
};

// ─── Assessment result viewer ─────────────────────────────────────────────────

const AssessmentDetailModal = ({ assessment, mode, onClose }) => {
  if (!assessment) return null;
  const { scores = {}, suggestions = [], transcript, submission } = assessment;
  const student = assessment.studentId || {};

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Assessment Detail</h3>
            <p className="text-sm text-gray-500">{student.firstName} {student.lastName} — {new Date(assessment.createdAt).toLocaleDateString()}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <XCircle className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* Scores grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(scores).map(([key, val]) => (
              <div key={key} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 capitalize mb-1">{key.replace('_', ' ')}</p>
                <ScoreBadge score={val || 0} />
              </div>
            ))}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="bg-indigo-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">AI Suggestions</p>
              <ul className="space-y-1.5">
                {suggestions.map((s, i) => <li key={i} className="text-sm text-indigo-700">• {s}</li>)}
              </ul>
            </div>
          )}

          {/* Reading transcript */}
          {mode === 'reading' && transcript && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Transcript</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4 leading-relaxed">{transcript}</p>
            </div>
          )}

          {/* Writing submission + improved */}
          {mode === 'writing' && (
            <>
              {assessment.submission && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Student's Submission</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4 leading-relaxed whitespace-pre-wrap">{assessment.submission}</p>
                </div>
              )}
              {assessment.improvedVersion && (
                <div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">AI-Improved Version</p>
                  <p className="text-sm text-gray-700 bg-emerald-50 rounded-xl p-4 leading-relaxed whitespace-pre-wrap border border-emerald-100">{assessment.improvedVersion}</p>
                </div>
              )}
              {assessment.cefrLevel && (
                <p className="text-sm font-semibold">CEFR Level: <span className="text-indigo-700">{assessment.cefrLevel}</span></p>
              )}
            </>
          )}
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
  const accentClass = isReading ? 'indigo' : 'emerald';
  const accentBg = isReading ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700';

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Language Practice</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create reading passages and writing prompts for students</p>
        </div>
        {view === 'list' && !resultsFor && (
          <button
            onClick={() => { setView('create'); setEditItem(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 ${accentBg} text-white rounded-xl text-sm font-semibold transition-colors`}
          >
            <Plus className="w-4 h-4" />
            New {isReading ? 'Passage' : 'Prompt'}
          </button>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'reading', label: 'Reading', icon: Mic },
          { key: 'writing', label: 'Writing', icon: PenLine },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Results back button */}
      {resultsFor && (
        <button
          onClick={() => { setResultsFor(null); setAssessments([]); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back to {isReading ? 'Passages' : 'Prompts'}
        </button>
      )}

      {/* Create / Edit form */}
      <AnimatePresence>
        {(view === 'create' || view === 'edit') && (
          <Motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
          >
            <h2 className="font-bold text-gray-900 mb-4">
              {view === 'edit' ? 'Edit' : 'New'} {isReading ? 'Reading Passage' : 'Writing Prompt'}
            </h2>
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
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-bold text-gray-900">
              Results for: <span className="text-indigo-700">{resultsFor.title || resultsFor.question?.slice(0, 50)}</span>
            </h2>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
            >
              <option value="latest">Latest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest score</option>
              <option value="lowest">Lowest score</option>
            </select>
          </div>
          {assessments.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No assessments yet for this {isReading ? 'passage' : 'prompt'}.</div>
          ) : (
            <div className="space-y-2">
              {assessments.map((a) => {
                const student = a.studentId || {};
                return (
                  <Motion.div
                    key={a._id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all"
                    onClick={() => setDetailAssessment(a)}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0 ${
                      (a.scores?.overall || 0) >= 80 ? 'bg-emerald-500' : (a.scores?.overall || 0) >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    }`}>
                      {a.scores?.overall || 0}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{student.firstName} {student.lastName}</p>
                      <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-gray-400">
                        <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                        {isReading && <span>{a.scores?.reading_speed || 0} WPM</span>}
                        {!isReading && <span>{a.wordCount || 0} words</span>}
                        {!isReading && a.cefrLevel && <span className="text-indigo-600 font-medium">{a.cefrLevel}</span>}
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
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-gray-300 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              {isReading ? <Mic className="w-10 h-10 text-gray-200 mx-auto mb-3" /> : <PenLine className="w-10 h-10 text-gray-200 mx-auto mb-3" />}
              <p className="text-gray-400 text-sm">
                No {isReading ? 'reading passages' : 'writing prompts'} yet. Create one to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <Motion.div
                  key={item._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[item.difficulty] || 'bg-gray-100 text-gray-600'}`}>
                          {item.difficulty}
                        </span>
                        {item.isPublished ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">Published</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">Draft</span>
                        )}
                        {item.subject && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{item.subject}</span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 text-sm">{item.title}</h3>
                      {!isReading && item.question && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.question}</p>
                      )}
                      {isReading && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.wordCount || 0} words · ~{item.estimatedReadingTime || 1} min</p>
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
  );
};

export default LanguagePracticeManager;
