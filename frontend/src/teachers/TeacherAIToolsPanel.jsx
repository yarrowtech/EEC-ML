import React, { useState, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, BookOpen, HelpCircle, BarChart2, Users, FileText,
  Layers, CheckSquare, ChevronDown, ChevronUp, Loader2, Copy,
  RefreshCcw, AlertCircle, Brain, Target, ClipboardList, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

const post = async (path, body) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
};

// ─── Markdown-lite renderer ──────────────────────────────────────────────────
const MarkdownContent = ({ text }) => {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1 text-sm text-slate-700 leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-slate-800 text-base mt-3">{line.slice(3)}</h3>;
        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-slate-800">{line.slice(2, -2)}</p>;
        if (line.startsWith('- ') || line.startsWith('• ')) return (
          <div key={i} className="flex gap-2"><span className="text-purple-400 mt-0.5">•</span><span>{line.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')}</span></div>
        );
        return <p key={i}>{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>;
      })}
    </div>
  );
};

// ─── Shared AI result card ───────────────────────────────────────────────────
const AIResult = ({ content, onCopy }) => (
  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex justify-end mb-2">
      <button onClick={onCopy} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <Copy className="w-3.5 h-3.5" /> Copy
      </button>
    </div>
    <MarkdownContent text={content} />
  </div>
);

const copyText = (text) => {
  navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
};

// ════════════════════════════════════════════════════════════════════════════
// TAB: Lesson Content Generator
// ════════════════════════════════════════════════════════════════════════════
const LessonContentTab = () => {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const generate = async () => {
    if (!subject || !topic) { toast.error('Subject and topic are required'); return; }
    setLoading(true);
    try {
      const data = await post('/api/ai-teacher/lesson-content', { subject, topic, gradeLevel });
      setResult(data?.data?.content || '');
      toast.success('Lesson content generated!');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Generate a full lesson plan with hook, key concepts, step-by-step explanation and recap.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <input className="input-field" placeholder="Subject *" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <input className="input-field" placeholder="Topic / Chapter *" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <input className="input-field" placeholder="Grade (optional)" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
      </div>
      <button onClick={generate} disabled={loading} className="ai-btn">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? 'Generating…' : 'Generate Lesson Content'}
      </button>
      {result && <AIResult content={result} onCopy={() => copyText(result)} />}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// TAB: Hinge Question Generator
// ════════════════════════════════════════════════════════════════════════════
const HingeQuestionTab = () => {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const generate = async () => {
    if (!subject || !topic) { toast.error('Subject and topic are required'); return; }
    setLoading(true);
    try {
      const data = await post('/api/ai-teacher/hinge-questions', { subject, topic, gradeLevel });
      setResult(data?.data?.content || '');
      toast.success('Hinge questions generated!');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Generate diagnostic hinge questions to check for understanding before moving on. Each question targets a specific misconception.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <input className="input-field" placeholder="Subject *" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <input className="input-field" placeholder="Topic *" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <input className="input-field" placeholder="Grade (optional)" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
      </div>
      <button onClick={generate} disabled={loading} className="ai-btn">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <HelpCircle className="w-4 h-4" />}
        {loading ? 'Generating…' : 'Generate Hinge Questions'}
      </button>
      {result && <AIResult content={result} onCopy={() => copyText(result)} />}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// TAB: Differentiated Content
// ════════════════════════════════════════════════════════════════════════════
const DifferentiatedTab = () => {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const generate = async () => {
    if (!subject || !topic) { toast.error('Subject and topic are required'); return; }
    setLoading(true);
    try {
      const data = await post('/api/ai-teacher/differentiated-content', { subject, topic, gradeLevel });
      setResult(data?.data?.content || '');
      toast.success('Differentiated content generated!');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Generate Foundation, Standard, and Extension versions of content and practice for the same topic.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <input className="input-field" placeholder="Subject *" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <input className="input-field" placeholder="Topic *" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <input className="input-field" placeholder="Grade (optional)" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
      </div>
      <button onClick={generate} disabled={loading} className="ai-btn">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
        {loading ? 'Generating…' : 'Generate Foundation / Standard / Extension'}
      </button>
      {result && <AIResult content={result} onCopy={() => copyText(result)} />}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// TAB: Class Performance Summary
// ════════════════════════════════════════════════════════════════════════════
const ClassSummaryTab = () => {
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [stats, setStats] = useState(null);

  const generate = async () => {
    setLoading(true);
    try {
      const data = await post('/api/ai-teacher/class-summary', { className, section, subject });
      setResult(data?.data?.content || '');
      setStats(data?.data?.stats || null);
      toast.success('Class summary generated!');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Generate an AI-written summary of your class's performance, with data-driven recommendations.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <input className="input-field" placeholder="Class (e.g. 7)" value={className} onChange={(e) => setClassName(e.target.value)} />
        <input className="input-field" placeholder="Section (e.g. A)" value={section} onChange={(e) => setSection(e.target.value)} />
        <input className="input-field" placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <button onClick={generate} disabled={loading} className="ai-btn">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
        {loading ? 'Analysing…' : 'Generate Class Summary'}
      </button>
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-blue-50 p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{stats.totalStudents}</p>
            <p className="text-xs text-blue-600">Total Students</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700">{stats.avgAtt}%</p>
            <p className="text-xs text-emerald-600">Avg Attendance</p>
          </div>
          <div className="rounded-lg bg-rose-50 p-3 text-center">
            <p className="text-2xl font-bold text-rose-700">{stats.below75}</p>
            <p className="text-xs text-rose-600">Below 75% Att</p>
          </div>
        </div>
      )}
      {result && <AIResult content={result} onCopy={() => copyText(result)} />}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// TAB: Parent Report Writer
// ════════════════════════════════════════════════════════════════════════════
const ParentReportTab = () => {
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const generate = async () => {
    if (!studentId && !studentName) { toast.error('Enter student ID or name'); return; }
    setLoading(true);
    try {
      const data = await post('/api/ai-teacher/parent-report', { studentId, studentName, grade, section });
      setResult(data?.data?.content || '');
      toast.success('Parent report generated!');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Auto-generate a warm, professional parent-facing progress report based on the student's academic data.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <input className="input-field" placeholder="Student ID" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
        <input className="input-field" placeholder="Student Name" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
        <input className="input-field" placeholder="Grade (optional)" value={grade} onChange={(e) => setGrade(e.target.value)} />
        <input className="input-field" placeholder="Section (optional)" value={section} onChange={(e) => setSection(e.target.value)} />
      </div>
      <button onClick={generate} disabled={loading} className="ai-btn">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        {loading ? 'Writing…' : 'Generate Parent Report'}
      </button>
      {result && <AIResult content={result} onCopy={() => copyText(result)} />}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// TAB: Exit Ticket Grader
// ════════════════════════════════════════════════════════════════════════════
const ExitTicketTab = () => {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const grade = async () => {
    if (!question || !response) { toast.error('Question and student response are required'); return; }
    setLoading(true);
    try {
      const data = await post('/api/ai-teacher/exit-ticket-grade', {
        question, studentResponse: response, subject, topic,
      });
      setResult(data?.data?.content || '');
      toast.success('Exit ticket graded!');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Paste an exit ticket question and a student's response — AI grades understanding and recommends next steps.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <input className="input-field" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <input className="input-field" placeholder="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
      </div>
      <textarea
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none"
        rows={2} placeholder="Exit ticket question *"
        value={question} onChange={(e) => setQuestion(e.target.value)}
      />
      <textarea
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none"
        rows={3} placeholder="Student's response *"
        value={response} onChange={(e) => setResponse(e.target.value)}
      />
      <button onClick={grade} disabled={loading} className="ai-btn">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
        {loading ? 'Grading…' : 'Grade Exit Ticket'}
      </button>
      {result && <AIResult content={result} onCopy={() => copyText(result)} />}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// TAB: I Do / We Do / You Do
// ════════════════════════════════════════════════════════════════════════════
const IdoWeedoTab = () => {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [totalMinutes, setTotalMinutes] = useState('60');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const generate = async () => {
    if (!subject || !topic) { toast.error('Subject and topic are required'); return; }
    setLoading(true);
    try {
      const data = await post('/api/ai-teacher/idoweedo', { subject, topic, gradeLevel, totalMinutes: Number(totalMinutes) || 60 });
      setResult(data?.data?.content || '');
      toast.success('I Do / We Do / You Do lesson generated!');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Generate a Gradual Release lesson plan with HOOK → I Do → We Do → You Do phases, each with teacher actions, student actions, and activities.</p>
      <div className="grid sm:grid-cols-4 gap-3">
        <input className="input-field" placeholder="Subject *" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <input className="input-field" placeholder="Topic *" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <input className="input-field" placeholder="Grade (optional)" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
        <input className="input-field" type="number" placeholder="Minutes (60)" value={totalMinutes} onChange={(e) => setTotalMinutes(e.target.value)} />
      </div>
      <button onClick={generate} disabled={loading} className="ai-btn">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
        {loading ? 'Generating…' : 'Generate I Do / We Do / You Do'}
      </button>
      {result && <AIResult content={result} onCopy={() => copyText(result)} />}
    </div>
  );
};

// ─── Curriculum Alignment Checker ───────────────────────────────────────────
const CurriculumAlignmentTab = () => {
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [curriculumStandard, setCurriculumStandard] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const check = async () => {
    if (!curriculumStandard.trim() || !lessonContent.trim()) {
      toast.error('Both curriculum standard and lesson content are required');
      return;
    }
    setLoading(true);
    setResult('');
    try {
      const data = await post('/api/ai-teacher/curriculum-check', { subject, gradeLevel, curriculumStandard, lessonContent });
      setResult(data?.data?.content || '');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Paste your lesson plan and the curriculum standard/objective. AI will score alignment,
        identify gaps, and suggest improvements.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <input className="input-field" placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <input className="input-field" placeholder="Grade level (optional)" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Curriculum Standard / Learning Objective *</label>
        <textarea
          className="input-field min-h-[80px] resize-y"
          placeholder="e.g. 'Students will be able to identify and explain Newton's three laws of motion with real-world examples.'"
          value={curriculumStandard}
          onChange={(e) => setCurriculumStandard(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Lesson Content to Check *</label>
        <textarea
          className="input-field min-h-[140px] resize-y"
          placeholder="Paste your lesson plan, teaching notes, or content outline here..."
          value={lessonContent}
          onChange={(e) => setLessonContent(e.target.value)}
        />
      </div>
      <button onClick={check} disabled={loading} className="ai-btn">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        {loading ? 'Checking alignment…' : 'Check Curriculum Alignment'}
      </button>
      {result && <AIResult content={result} onCopy={() => copyText(result)} />}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
const TABS = [
  { key: 'lesson',     label: 'Lesson Content',        icon: BookOpen,      component: LessonContentTab   },
  { key: 'hinge',      label: 'Hinge Questions',        icon: HelpCircle,    component: HingeQuestionTab   },
  { key: 'idoweedo',   label: 'I Do / We Do / You Do',  icon: Target,        component: IdoWeedoTab        },
  { key: 'diff',       label: 'Differentiated Content', icon: Layers,        component: DifferentiatedTab  },
  { key: 'summary',    label: 'Class Summary',          icon: BarChart2,     component: ClassSummaryTab    },
  { key: 'parent',     label: 'Parent Report',          icon: FileText,      component: ParentReportTab    },
  { key: 'exit',       label: 'Exit Ticket Grader',     icon: CheckSquare,   component: ExitTicketTab      },
  { key: 'curriculum', label: 'Curriculum Alignment',   icon: ShieldCheck,   component: CurriculumAlignmentTab },
];

const TeacherAIToolsPanel = () => {
  const [activeTab, setActiveTab] = useState('lesson');
  const ActiveComponent = TABS.find((t) => t.key === activeTab)?.component || LessonContentTab;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50/30 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">AI Teaching Tools</h1>
            <p className="text-xs text-slate-500">LLM-powered tools for lesson design, assessment and reporting</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                active
                  ? 'bg-white shadow-md text-purple-700 border border-purple-200'
                  : 'bg-white/60 text-slate-600 hover:bg-white hover:text-slate-800 border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-purple-600' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <AnimatePresence mode="wait">
        <Motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <ActiveComponent />
        </Motion.div>
      </AnimatePresence>

      {/* Global styles injected via className helpers */}
      <style>{`
        .input-field {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          background: white;
          color: #0f172a;
          outline: none;
        }
        .input-field:focus { border-color: #a78bfa; box-shadow: 0 0 0 2px rgba(167,139,250,0.2); }
        .ai-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1.25rem;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          color: white;
          font-size: 0.875rem;
          font-weight: 600;
          border-radius: 0.75rem;
          cursor: pointer;
          transition: opacity 0.15s;
          border: none;
        }
        .ai-btn:hover { opacity: 0.9; }
        .ai-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
};

export default TeacherAIToolsPanel;
