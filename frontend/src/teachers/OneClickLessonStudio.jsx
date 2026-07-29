/**
 * OneClickLessonStudio
 * Teacher enters subject + topic → clicks Generate → AI fills everything:
 *   lesson plan fields, differentiated plan, hinge question, exit quiz, misconceptions, learning path
 * Teacher reviews each section (editable), then publishes to the lesson planner
 * and optionally generates a learning path assigned to specific students.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, Pencil, RefreshCw, Send, Sparkles, Users, X,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const authH = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  'Content-Type': 'application/json',
});

// ── Small helpers ─────────────────────────────────────────────────────────────
const Chip = ({ color = 'indigo', children }) => {
  const map = {
    indigo: 'bg-indigo-100 text-indigo-700',
    emerald:'bg-emerald-100 text-emerald-700',
    amber:  'bg-amber-100 text-amber-700',
    red:    'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[color] || map.indigo}`}>{children}</span>;
};

const Section = ({ title, icon: Icon, color = 'indigo', defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 text-${color}-500`} />
          <p className="text-sm font-bold text-gray-800">{title}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 p-5">{children}</div>}
    </div>
  );
};

const EditableText = ({ value, onChange, rows = 4, placeholder }) => (
  <textarea
    rows={rows}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed text-gray-800 focus:border-indigo-400 focus:outline-none resize-none"
  />
);

// ── Gap Analysis display ──────────────────────────────────────────────────────
function GapBadges({ gap }) {
  if (!gap || gap.averageMastery == null) return (
    <p className="text-xs text-gray-400">No mastery data yet for this subject. AI will generate content for all tiers.</p>
  );
  return (
    <div className="flex flex-wrap gap-2">
      <Chip color="indigo">Class avg: {gap.averageMastery}%</Chip>
      <Chip color="red">Foundation: {gap.tierBreakdown.foundation} students</Chip>
      <Chip color="amber">Core: {gap.tierBreakdown.core} students</Chip>
      <Chip color="emerald">Extension: {gap.tierBreakdown.extension} students</Chip>
      {gap.topWeaknesses.map((w, i) => <Chip key={i} color="orange">{w}</Chip>)}
    </div>
  );
}

// ── Hinge question editor ─────────────────────────────────────────────────────
function HingeEditor({ hinge, onChange }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-600">Question</label>
        <input
          type="text"
          value={hinge.question}
          onChange={(e) => onChange({ ...hinge, question: e.target.value })}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {(hinge.options || []).map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...hinge, answer: i })}
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                hinge.answer === i ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 text-gray-500'
              }`}
              title="Correct answer"
            >
              {String.fromCharCode(65 + i)}
            </button>
            <input
              type="text"
              value={opt}
              onChange={(e) => {
                const opts = [...(hinge.options || [])];
                opts[i] = e.target.value;
                onChange({ ...hinge, options: opts });
              }}
              className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none"
            />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400">Click a letter to mark the correct answer.</p>
    </div>
  );
}

// ── Learning path nodes editor ────────────────────────────────────────────────
function PathNodes({ nodes, onChange }) {
  const tierColor = { foundation: 'bg-red-100 text-red-700', core: 'bg-amber-100 text-amber-700', extension: 'bg-emerald-100 text-emerald-700' };
  return (
    <div className="space-y-2">
      {nodes.map((node, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{i + 1}</span>
          <input
            type="text"
            value={node.title}
            onChange={(e) => {
              const next = [...nodes];
              next[i] = { ...node, title: e.target.value };
              onChange(next);
            }}
            className="flex-1 bg-transparent text-sm font-semibold text-gray-800 focus:outline-none"
          />
          <select
            value={node.tier}
            onChange={(e) => {
              const next = [...nodes];
              next[i] = { ...node, tier: e.target.value };
              onChange(next);
            }}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none"
          >
            <option value="foundation">Foundation</option>
            <option value="core">Core</option>
            <option value="extension">Extension</option>
          </select>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tierColor[node.tier] || tierColor.core}`}>{node.bloom}</span>
          <button
            type="button"
            onClick={() => onChange(nodes.filter((_, j) => j !== i))}
            className="text-gray-300 hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...nodes, { idx: nodes.length, title: 'New Topic', bloom: 'understand', tier: 'core', status: 'locked' }])}
        className="text-xs font-semibold text-indigo-600 hover:underline"
      >
        + Add Node
      </button>
    </div>
  );
}

// ── Student picker for path assignment ────────────────────────────────────────
function StudentPicker({ schoolId, selectedIds, onChange }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/student/list`, { headers: authH() })
      .then((r) => r.json())
      .then((d) => setStudents(Array.isArray(d.data) ? d.data : d.students || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter((s) =>
    !search || `${s.name} ${s.grade} ${s.section}`.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => onChange(
    selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search students…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(students.map((s) => s._id))}
          className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
        >
          All
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
        >
          None
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading students…</div>
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-1">
          {filtered.map((s) => {
            const selected = selectedIds.includes(s._id);
            return (
              <button
                key={s._id}
                type="button"
                onClick={() => toggle(s._id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  selected ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${
                  selected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                }`}>
                  {selected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                </span>
                <span className="flex-1">{s.name}</span>
                <span className="text-xs text-gray-400">{s.grade} {s.section}</span>
              </button>
            );
          })}
          {!filtered.length && <p className="py-4 text-center text-sm text-gray-400">No students found</p>}
        </div>
      )}
      <p className="text-xs text-gray-400">{selectedIds.length} student{selectedIds.length !== 1 ? 's' : ''} selected</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OneClickLessonStudio() {
  const navigate = useNavigate();

  // Form inputs
  const [form, setForm] = useState({ subject: '', topic: '', chapterTitle: '', gradeLevel: '' });
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [classOptions, setClassOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);

  // Generated package
  const [pkg, setPkg] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // Editable generated content
  const [lesson, setLesson] = useState({});
  const [tiers, setTiers] = useState({});
  const [hinge, setHinge] = useState({});
  const [misconceptions, setMisconceptions] = useState('');
  const [pathNodes, setPathNodes] = useState([]);

  // Publish state
  const [publishing, setPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState(''); // 'lesson' | 'path' | 'done'
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [publishError, setPublishError] = useState('');
  const [published, setPublished] = useState(false);

  // Load class options
  useEffect(() => {
    fetch(`${API_BASE}/api/lesson-plans/teacher/options`, { headers: authH() })
      .then((r) => r.json())
      .then((d) => setClassOptions(Array.isArray(d.classes) ? d.classes : []))
      .catch(() => {});
  }, []);

  const handleClassChange = (cid) => {
    setClassId(cid);
    setSectionId('');
    setSectionOptions([]);
    fetch(`${API_BASE}/api/lesson-plans/teacher/options?classId=${cid}`, { headers: authH() })
      .then((r) => r.json())
      .then((d) => setSectionOptions(Array.isArray(d.sections) ? d.sections : []))
      .catch(() => {});
  };

  // ── Generate ────────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenError('');
    if (!form.subject || !form.topic) { setGenError('Subject and topic are required.'); return; }
    setGenerating(true);
    setPkg(null);
    setPublished(false);

    try {
      const res = await fetch(`${API_BASE}/api/ai-teacher/generate-lesson-package`, {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify({ ...form, classId, sectionId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Generation failed');

      const d = data.data;
      setPkg(d);
      setLesson(d.lessonPlanFields || {});
      setTiers(d.differentiatedPlan || {});
      setHinge(d.hingeQuestion || {});
      setMisconceptions(d.misconceptions || '');
      setPathNodes(d.learningPathNodes || []);
    } catch (err) {
      setGenError(err.message);
    }
    setGenerating(false);
  };

  // ── Publish lesson plan to planner ─────────────────────────────────────────
  const handlePublishLesson = async () => {
    if (!classId || !sectionId) { setPublishError('Select a class and section first.'); return; }
    if (!form.subject || !form.topic) { setPublishError('Subject and topic are required.'); return; }

    setPublishing(true);
    setPublishError('');
    setPublishStep('lesson');

    try {
      // Build lesson plan payload — posts to existing lesson-plans route
      const opts = await fetch(`${API_BASE}/api/lesson-plans/teacher/options?classId=${classId}&sectionId=${sectionId}`, { headers: authH() })
        .then((r) => r.json()).catch(() => ({}));

      const subjectId = opts.subjects?.[0]?.subjectId || '';

      const payload = {
        classId,
        sectionId,
        subjectId,
        title: form.chapterTitle || form.topic,
        subject: form.subject,
        date: new Date().toISOString().split('T')[0],
        duration: '45',
        learningObjectives: lesson.learningObjectives || [],
        introduction: lesson.introduction || '',
        explanation: lesson.explanation || '',
        recap: lesson.recap || '',
        additionalNotes: `Misconceptions:\n${misconceptions}`,
        curriculumCode: '',
        hingeQuestion: hinge.question || '',
        hingeOptions: hinge.options || [],
        hingeAnswer: hinge.answer || 0,
        hingeThreshold: 50,
        exitQuizThreshold: 60,
        plannerContent: {
          chapters: [{
            title: form.chapterTitle || form.topic,
            sections: [
              { title: 'Foundation', content: tiers.foundation || '' },
              { title: 'Core',       content: tiers.core       || '' },
              { title: 'Extension',  content: tiers.extension  || '' },
            ],
          }],
        },
      };

      const res = await fetch(`${API_BASE}/api/lesson-plans/teacher`, {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish lesson plan');

      // ── Publish learning path to selected students ─────────────────────────
      if (selectedStudents.length && pathNodes.length) {
        setPublishStep('path');

        for (const studentId of selectedStudents) {
          try {
            await fetch(`${API_BASE}/api/learning-paths`, {
              method: 'POST',
              headers: authH(),
              body: JSON.stringify({
                studentId,
                subject: form.subject,
                title: `${form.subject} — ${form.topic}`,
                nodes: pathNodes,
                status: 'published',
              }),
            });
          } catch (_) { /* per-student failure must not block */ }
        }
      }

      setPublishStep('done');
      setPublished(true);
    } catch (err) {
      setPublishError(err.message);
    }
    setPublishing(false);
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
          <Sparkles className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">One-Click Lesson Studio</h1>
          <p className="text-xs text-gray-500">AI detects gaps → generates lesson + differentiated content + path → you review → publish</p>
        </div>
      </div>

      {/* Input panel */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-gray-800">What are you teaching?</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Subject *</label>
            <input type="text" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="e.g. Mathematics" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Topic *</label>
            <input type="text" value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              placeholder="e.g. Fractions" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Chapter / Lesson Title</label>
            <input type="text" value={form.chapterTitle} onChange={(e) => setForm((f) => ({ ...f, chapterTitle: e.target.value }))}
              placeholder="e.g. Adding Unlike Denominators" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Grade Level</label>
            <input type="text" value={form.gradeLevel} onChange={(e) => setForm((f) => ({ ...f, gradeLevel: e.target.value }))}
              placeholder="e.g. Grade 7" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Class</label>
            <select value={classId} onChange={(e) => handleClassChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none">
              <option value="">— select class —</option>
              {classOptions.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Section</label>
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" disabled={!classId}>
              <option value="">— select section —</option>
              {sectionOptions.map((s) => <option key={s.sectionId} value={s.sectionId}>{s.sectionName}</option>)}
            </select>
          </div>
        </div>

        {genError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{genError}</p>}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating everything…</>
              : <><Sparkles className="h-4 w-4" /> Generate with AI</>}
          </button>
          {pkg && (
            <button type="button" onClick={handleGenerate} disabled={generating}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-xs text-gray-600 hover:bg-gray-50">
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate
            </button>
          )}
        </div>

        {generating && (
          <div className="mt-4 rounded-xl bg-indigo-50 px-4 py-3">
            <p className="text-xs font-semibold text-indigo-700">AI is working… detecting gaps · generating lesson · building differentiated plan · creating hinge question · writing exit quiz · analysing misconceptions</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-indigo-100">
              <div className="h-full animate-pulse rounded-full bg-indigo-500" style={{ width: '70%' }} />
            </div>
          </div>
        )}
      </div>

      {/* Generated content — only shown after generation */}
      {pkg && !generating && (
        <>
          {/* Gap analysis */}
          <Section title="Gap Analysis (from student mastery data)" icon={AlertTriangle} color="orange">
            <GapBadges gap={pkg.gapAnalysis} />
          </Section>

          {/* Lesson plan fields */}
          <Section title="Lesson Plan Content" icon={BookOpen} color="indigo">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Learning Objectives</label>
                <div className="space-y-1.5">
                  {(lesson.learningObjectives || []).map((obj, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="text" value={obj}
                        onChange={(e) => {
                          const next = [...(lesson.learningObjectives || [])];
                          next[i] = e.target.value;
                          setLesson((l) => ({ ...l, learningObjectives: next }));
                        }}
                        className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                      />
                      <button type="button" onClick={() => setLesson((l) => ({ ...l, learningObjectives: l.learningObjectives.filter((_, j) => j !== i) }))}
                        className="text-gray-300 hover:text-red-400"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setLesson((l) => ({ ...l, learningObjectives: [...(l.learningObjectives || []), ''] }))}
                    className="text-xs font-semibold text-indigo-600 hover:underline">+ Add objective</button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Introduction / Hook</label>
                <EditableText value={lesson.introduction || ''} onChange={(v) => setLesson((l) => ({ ...l, introduction: v }))} rows={3} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Explanation</label>
                <EditableText value={lesson.explanation || ''} onChange={(v) => setLesson((l) => ({ ...l, explanation: v }))} rows={6} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Recap / Summary</label>
                <EditableText value={lesson.recap || ''} onChange={(v) => setLesson((l) => ({ ...l, recap: v }))} rows={3} />
              </div>
            </div>
          </Section>

          {/* Differentiated plan */}
          <Section title="Differentiated Plan — Foundation · Core · Extension" icon={Users} color="emerald">
            <div className="space-y-4">
              {[
                { key: 'foundation', label: 'Foundation', color: 'red',    emoji: '🔴' },
                { key: 'core',       label: 'Core',       color: 'amber',  emoji: '🟡' },
                { key: 'extension',  label: 'Extension',  color: 'emerald',emoji: '🟢' },
              ].map(({ key, label, color, emoji }) => (
                <div key={key}>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    {emoji} {label} tier
                    <Chip color={color}>{pkg.gapAnalysis?.tierBreakdown?.[key] ?? '—'} students</Chip>
                  </label>
                  <EditableText
                    value={tiers[key] || ''}
                    onChange={(v) => setTiers((t) => ({ ...t, [key]: v }))}
                    rows={5}
                    placeholder={`${label} tier content will appear here…`}
                  />
                </div>
              ))}
            </div>
          </Section>

          {/* Hinge question */}
          <Section title="Hinge Question (diagnostic mid-lesson MCQ)" icon={CheckCircle2} color="indigo" defaultOpen={false}>
            <HingeEditor hinge={hinge} onChange={setHinge} />
          </Section>

          {/* Misconceptions */}
          <Section title="Misconceptions & How to Address Them" icon={AlertTriangle} color="red" defaultOpen={false}>
            <EditableText value={misconceptions} onChange={setMisconceptions} rows={8} placeholder="AI misconception analysis…" />
          </Section>

          {/* Learning path nodes */}
          <Section title="Learning Path Nodes (for student assignment)" icon={BookOpen} color="indigo" defaultOpen={false}>
            <p className="mb-3 text-xs text-gray-500">These nodes will be published to the selected students as their personalised learning path.</p>
            <PathNodes nodes={pathNodes} onChange={setPathNodes} />
          </Section>

          {/* Student assignment + publish */}
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-indigo-900">Assign & Publish</h2>
            <p className="mb-3 text-xs text-gray-600">
              The lesson plan will be published to your lesson planner. Select students to also assign the learning path.
            </p>
            <StudentPicker selectedIds={selectedStudents} onChange={setSelectedStudents} />

            {publishError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{publishError}</p>}

            {published ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                Published! Lesson plan saved · {selectedStudents.length} student path{selectedStudents.length !== 1 ? 's' : ''} assigned.
                <button type="button" onClick={() => navigate('/teacher/lesson-plan')}
                  className="ml-auto text-xs underline">View in Planner →</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePublishLesson}
                disabled={publishing}
                className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {publishing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />
                    {publishStep === 'lesson' ? 'Publishing lesson plan…' : publishStep === 'path' ? 'Assigning learning paths…' : 'Done!'}</>
                ) : (
                  <><Send className="h-4 w-4" /> Publish Lesson + Assign Paths</>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
