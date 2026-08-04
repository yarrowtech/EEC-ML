import React, { useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp, Check, BookOpen, X, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const LEVEL_PRESETS = [
  { label: 'Excellent', score: 4, descriptor: 'Exceeds expectations in all areas.' },
  { label: 'Good',      score: 3, descriptor: 'Meets expectations with minor gaps.' },
  { label: 'Developing',score: 2, descriptor: 'Partially meets expectations.' },
  { label: 'Beginning', score: 1, descriptor: 'Does not yet meet expectations.' },
];

const emptyRubric = () => ({
  title: '', description: '', subject: '',
  criteria: [{ name: '', description: '', maxScore: 4, levels: LEVEL_PRESETS.map((l) => ({ ...l })) }],
});

function CriterionCard({ criterion, index, onChange, onDelete }) {
  const [open, setOpen] = useState(true);

  const updateLevel = (li, field, value) => {
    const levels = criterion.levels.map((l, i) => i === li ? { ...l, [field]: value } : l);
    onChange({ ...criterion, levels });
  };

  const addLevel = () => onChange({ ...criterion, levels: [...criterion.levels, { label: '', score: 0, descriptor: '' }] });
  const removeLevel = (li) => onChange({ ...criterion, levels: criterion.levels.filter((_, i) => i !== li) });

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">{index + 1}</span>
          <span className="font-semibold text-gray-800 text-sm">{criterion.name || `Criterion ${index + 1}`}</span>
          <span className="text-xs text-gray-400">/ {criterion.maxScore} pts</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-rose-50 text-gray-400 hover:text-rose-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <Motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Criterion Name</label>
                  <input value={criterion.name} onChange={(e) => onChange({ ...criterion, name: e.target.value })}
                    placeholder="e.g. Content Quality"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Max Score</label>
                  <input type="number" min="1" value={criterion.maxScore}
                    onChange={(e) => onChange({ ...criterion, maxScore: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
                <input value={criterion.description} onChange={(e) => onChange({ ...criterion, description: e.target.value })}
                  placeholder="What does this criterion measure?"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
              </div>

              {/* Score levels */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Score Levels</p>
                  <button type="button" onClick={addLevel}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
                    <Plus className="w-3 h-3" /> Add Level
                  </button>
                </div>
                <div className="space-y-2">
                  {criterion.levels.map((level, li) => (
                    <div key={li} className="flex items-center gap-2">
                      <input value={level.label} onChange={(e) => updateLevel(li, 'label', e.target.value)}
                        placeholder="Label" className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-indigo-400 focus:outline-none" />
                      <input type="number" min="0" value={level.score} onChange={(e) => updateLevel(li, 'score', Number(e.target.value))}
                        className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-center focus:border-indigo-400 focus:outline-none" />
                      <input value={level.descriptor} onChange={(e) => updateLevel(li, 'descriptor', e.target.value)}
                        placeholder="Descriptor" className="flex-[2] rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-indigo-400 focus:outline-none" />
                      <button type="button" onClick={() => removeLevel(li)}
                        className="p-1 text-gray-400 hover:text-rose-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RubricEditor({ rubricId = null, onSaved, onClose }) {
  const [form, setForm] = useState(emptyRubric());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(rubricId));
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiTask, setAiTask] = useState('');
  const [aiError, setAiError] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!rubricId) return;
    fetch(`${API_BASE}/api/rubrics/${rubricId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((p) => { if (p.success) setForm(p.data); })
      .catch(() => toast.error('Failed to load rubric'))
      .finally(() => setLoading(false));
  }, [rubricId]);

  const updateCriterion = (i, updated) => {
    setForm((f) => ({ ...f, criteria: f.criteria.map((c, ci) => ci === i ? updated : c) }));
  };
  const deleteCriterion = (i) => {
    setForm((f) => ({ ...f, criteria: f.criteria.filter((_, ci) => ci !== i) }));
  };
  const addCriterion = () => {
    setForm((f) => ({
      ...f,
      criteria: [...f.criteria, { name: '', description: '', maxScore: 4, levels: LEVEL_PRESETS.map((l) => ({ ...l })) }],
    }));
  };

  const totalScore = form.criteria.reduce((s, c) => s + (Number(c.maxScore) || 0), 0);

  const handleAIGenerate = async () => {
    if (!form.subject.trim() && !aiTask.trim()) {
      toast.error('Enter a subject or describe the task first');
      return;
    }
    setAiGenerating(true);
    setAiError('');
    try {
      const res = await fetch(`${API_BASE}/api/rubrics/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject: form.subject || aiTask,
          taskDescription: aiTask || `Assessment rubric for ${form.subject}`,
          gradeLevel: '',
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'AI request failed');
      const rubric = payload.data?.rubric;
      if (rubric && Array.isArray(rubric.criteria)) {
        setForm((f) => ({
          ...f,
          title: rubric.title || f.title,
          description: rubric.description || f.description,
          criteria: rubric.criteria.map((c) => ({
            name: c.name || '',
            description: c.description || '',
            maxScore: c.maxScore || 4,
            levels: Array.isArray(c.levels) ? c.levels : LEVEL_PRESETS.map((l) => ({ ...l })),
          })),
        }));
        toast.success('Rubric generated — review and adjust as needed');
      } else {
        setAiError('AI returned unstructured output — try again with a more specific task description.');
      }
    } catch (err) {
      setAiError(err.message || 'Failed to generate rubric');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Rubric title is required');
    if (!form.criteria.length) return toast.error('Add at least one criterion');
    setSaving(true);
    try {
      const method = rubricId ? 'PUT' : 'POST';
      const url = rubricId ? `${API_BASE}/api/rubrics/${rubricId}` : `${API_BASE}/api/rubrics`;
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const payload = await r.json();
      if (payload.success) {
        toast.success(rubricId ? 'Rubric updated' : 'Rubric created');
        onSaved?.(payload.data);
      } else {
        toast.error(payload.error || 'Save failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-48 items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          <h2 className="font-black text-gray-900">{rubricId ? 'Edit Rubric' : 'New Rubric'}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Total: <strong>{totalScore} pts</strong></span>
          {onClose && <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>}
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rubric Title *</label>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Essay Evaluation Rubric"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</label>
          <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="e.g. English"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
        </div>
        <div className="sm:col-span-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Brief description of what this rubric evaluates"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
        </div>
      </div>

      {/* AI Generate */}
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <p className="text-sm font-semibold text-violet-800">AI-Generate Rubric</p>
        </div>
        <input
          value={aiTask}
          onChange={(e) => setAiTask(e.target.value)}
          placeholder="Describe the task, e.g. 'Grade 5 persuasive essay on climate change'"
          className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
        />
        {aiError && <p className="text-xs text-red-600">{aiError}</p>}
        <button
          type="button"
          onClick={handleAIGenerate}
          disabled={aiGenerating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-violet-500/20 hover:shadow-lg disabled:opacity-60 transition-all"
        >
          {aiGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><Sparkles className="w-3.5 h-3.5" /> Generate Criteria</>}
        </button>
      </div>

      {/* Criteria */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-700">Criteria ({form.criteria.length})</p>
          <button type="button" onClick={addCriterion}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1.5 hover:bg-indigo-100 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Criterion
          </button>
        </div>
        <AnimatePresence>
          {form.criteria.map((c, i) => (
            <Motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <CriterionCard criterion={c} index={i} onChange={(u) => updateCriterion(i, u)} onDelete={() => deleteCriterion(i)} />
            </Motion.div>
          ))}
        </AnimatePresence>
        {!form.criteria.length && (
          <div className="flex flex-col items-center gap-2 py-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-sm text-gray-400">No criteria yet — add your first one</p>
          </div>
        )}
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors disabled:opacity-60">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Saving…' : rubricId ? 'Update Rubric' : 'Save Rubric'}
      </button>
    </div>
  );
}
