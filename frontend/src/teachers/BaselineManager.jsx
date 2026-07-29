import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Loader2, Plus, Send, Sparkles } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const authH = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  'Content-Type': 'application/json',
});

export default function BaselineManager() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState('');
  const [form, setForm] = useState({ subject: '', className: '', section: '', topic: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/baseline/teacher`, { headers: authH() })
      .then((r) => r.json())
      .then((d) => setQuizzes(Array.isArray(d.data) ? d.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.subject || !form.className) {
      setError('Subject and class are required.');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/baseline/generate`, {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Baseline quiz generated successfully! Review and publish below.');
        load();
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch (err) {
      setError(err.message);
    }
    setGenerating(false);
  };

  const handlePublish = async (quizId) => {
    setPublishing(quizId);
    try {
      const res = await fetch(`${API_BASE}/api/baseline/${quizId}/publish`, {
        method: 'PUT',
        headers: authH(),
      });
      const data = await res.json();
      if (data.success) {
        setQuizzes((prev) => prev.map((q) => q._id === quizId ? { ...q, status: 'published' } : q));
      }
    } catch (_) {}
    setPublishing('');
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
          <BookOpen className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Baseline Assessments</h1>
          <p className="text-xs text-gray-500">Generate AI-powered baseline quizzes to personalise student learning paths</p>
        </div>
      </div>

      {/* Generate form */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-gray-800">Generate New Baseline Quiz</h2>
        <form onSubmit={handleGenerate} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Subject *</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="e.g. Mathematics"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Class *</label>
            <input
              type="text"
              value={form.className}
              onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))}
              placeholder="e.g. Grade 7"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Section</label>
            <input
              type="text"
              value={form.section}
              onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
              placeholder="e.g. A (optional)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Topic Focus (optional)</label>
            <input
              type="text"
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              placeholder="e.g. Fractions and Decimals"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
            {success && <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</p>}
            <button
              type="submit"
              disabled={generating}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating with AI…</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate Baseline Quiz</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Existing quizzes */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <p className="text-sm font-bold text-gray-800">My Baseline Quizzes</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
          </div>
        ) : !quizzes.length ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Plus className="h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-400">No baseline quizzes yet. Generate one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {quizzes.map((q) => (
              <div key={q._id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-semibold text-gray-900">{q.subject}</p>
                  <p className="text-xs text-gray-400">
                    {q.className}{q.section ? ` · ${q.section}` : ''} · {q.questions?.length ?? 0} questions
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {q.status === 'published' ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Published
                    </span>
                  ) : (
                    <button
                      onClick={() => handlePublish(q._id)}
                      disabled={publishing === q._id}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {publishing === q._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Publish
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
