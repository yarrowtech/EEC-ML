/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Eye,
  Info,
  Layers,
  Save,
  FileText,
  FlaskConical,
  Lightbulb,
  ListChecks,
  Maximize2,
  Mic,
  Minimize2,
  PenLine,
  Play,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  UserCheck,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import RichTextEditor from './RichTextEditor';
import CloudSaveStatus from './CloudSaveStatus';
import ConfirmDialog from '../../../components/ConfirmDialog';
import UploadDropzone from './UploadDropzone';
import { InlineTryoutBuilder } from './TryoutBuilder';
import RichTextMaterialEditor from '../RichTextMaterialEditor';
import { API_BASE } from '@/config/api';

const MotionButton = motion.button;
export const DEFAULT_INSTRUCTIONAL_FLOW = [
  { id: 'hook',      phase: 'THE HOOK',       duration: '10', description: 'Introduction & Overview'  },
  { id: 'instruct',  phase: 'INSTRUCTION',     duration: '25', description: 'Core Concepts & Theory'  },
  { id: 'practice',  phase: 'GUIDED PRACTICE', duration: '30', description: 'Practice & Application'  },
  { id: 'synthesis', phase: 'SYNTHESIS',       duration: '15', description: 'Review & Self-Assessment' },
];

const STEPS = [
  { key: 'info',       label: 'Lesson Info',       icon: Calendar,       color: 'blue', desc: 'Basic details of the chapter',    hint: 'Give the chapter a name, pick the lesson date and duration, and write what students should learn.' },
  { key: 'materials',  label: 'Materials',          icon: BookOpen,       color: 'purple', desc: 'Add learning resources',  hint: 'Upload your PDFs, slides or notes. AI uses them to help write the next steps.' },
  { key: 'intro',      label: 'Introduction',       icon: Lightbulb,      color: 'amber', desc: 'Write a short introduction',   hint: 'Write how you will start the class — a question, story or activity to get students interested.' },
  { key: 'content',    label: 'Content',            icon: ListChecks,     color: 'green', desc: 'Add the main lesson content',   hint: 'Explain the main topic step by step. You can use "Generate with AI" to get a draft.' },
  { key: 'assessment', label: 'Worksheet',          icon: ClipboardList,  color: 'rose', desc: 'Practice questions & activities',    hint: 'Add questions or upload a worksheet to check what students understood.' },
  { key: 'language',   label: 'Language Practice',  icon: Mic,            color: 'indigo', desc: 'Grammar, vocabulary etc.',  hint: 'Optional: add reading or speaking practice for students. You can skip this step.' },
  { key: 'tryout',     label: 'Tryout',             icon: Play,           color: 'pink', desc: 'Quick assessment / quiz',    hint: 'Optional: add a short practice activity students can try. You can skip this step.' },
  { key: 'publish',    label: 'Review & Publish', icon: Send,  color: 'emerald', desc: 'Check and publish the chapter', hint: 'Check everything once, then press "Publish" so students can see this chapter.' },
];

const escapeHtml = (v) => String(v || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const textToParagraphs = (text) => String(text || '').split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join('');
// "Did You Know?" is a list of facts. Older chapters stored one rich-text
// blob; split that into facts (list items / paragraphs / lines).
export const getDidYouKnowFacts = (chapter = {}) => {
  if (Array.isArray(chapter.didYouKnowFacts)) return chapter.didYouKnowFacts;
  const raw = String(chapter.didYouKnow || '');
  if (!raw.trim()) return [];
  const parts = /<li[\s>]/i.test(raw)
    ? raw.split(/<\/li>/i)
    : raw.split(/<\/p>|<br\s*\/?>|\n/i);
  return parts
    .map((p) => p.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
};

const plainText = (v) => String(v || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
const countUploads = (uploads) => Object.values(uploads || {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);
// true = filled in, false = required but missing, null = optional and empty
export const stepStatus = (key, chapter = {}) => {
  switch (key) {
    case 'info': {
      const title = String(chapter.title || '').trim();
      return Boolean(title && title !== 'Untitled Chapter' && chapter.lessonDate && String(chapter.duration || '').trim());
    }
    case 'materials': return countUploads(chapter.contentUploads) > 0;
    case 'intro': return Boolean(plainText(chapter.introductionText));
    case 'content': return Boolean(plainText(chapter.explanation));
    case 'assessment': return ((chapter.worksheetFiles || []).length + (chapter.assessments || []).length) > 0;
    case 'language': return null;
    case 'tryout': return (chapter.tryouts || []).length > 0 ? true : null;
    case 'publish': return chapter.status === 'published' && !chapter.isDraft ? true : null;
    default: return null;
  }
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const toIsoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Dates from today → 10 weeks ahead that fall on the given weekdays (no past dates).
const buildLessonDates = (days) => {
  if (!days.length) return [];
  const wanted = new Set(days.map((d) => WEEKDAYS.indexOf(d)).filter((i) => i >= 0));
  const out = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < 70; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (wanted.has(d.getDay())) out.push(d);
  }
  return out;
};

const EVAL_TAGS = ['Excellent', 'Good', 'Needs Improvement'];

const stepAccent = {
  blue:    { ring: 'ring-blue-500',    text: 'text-blue-700 dark:text-blue-300',     banner: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'     },
  amber:   { ring: 'ring-amber-400',   text: 'text-amber-700 dark:text-amber-300',   banner: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'   },
  green:   { ring: 'ring-green-500',   text: 'text-green-700 dark:text-green-300',   banner: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'   },
  purple:  { ring: 'ring-purple-500',  text: 'text-purple-700 dark:text-purple-300', banner: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' },
  rose:    { ring: 'ring-rose-500',    text: 'text-rose-700 dark:text-rose-300',     banner: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'     },
  pink:    { ring: 'ring-pink-500',    text: 'text-pink-700 dark:text-pink-300',     banner: 'bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300'     },
  emerald: { ring: 'ring-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', banner: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  indigo:  { ring: 'ring-indigo-500',  text: 'text-indigo-700 dark:text-indigo-300',   banner: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'   },
};

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</label>
    {children}
  </div>
);

const InfoLabel = ({ icon: Icon, required, optional, children }) => (
  <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
    <Icon className="size-3.5 text-slate-600 dark:text-slate-300" />
    {children}
    {required && <span className="text-rose-500">*</span>}
    {optional && <span className="text-xs font-normal text-slate-500">(Optional)</span>}
  </label>
);

const StepHeading = ({ step }) => (
  <div className="mb-4 flex items-center gap-2.5">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
      {React.createElement(step.icon, { className: 'size-5' })}
    </span>
    <div>
      <h4 className="text-base font-bold text-slate-900 dark:text-white">{step.label}</h4>
      <p className="text-xs text-slate-500 dark:text-slate-400">{step.hint}</p>
    </div>
  </div>
);

const Card = ({ children, className = '' }) => (
  <div className={`min-w-0 rounded-[22px] border border-[#ebf0f6] bg-[#fafcff] p-3 shadow-[0_4px_8px_-4px_rgba(0,0,0,0.04)] sm:rounded-[28px] sm:p-5 dark:border-slate-700 dark:bg-slate-900 ${className}`}>
    {children}
  </div>
);

const SectionTitle = ({ icon, iconColor, children }) => (
  <p className={`mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100`}>
    {React.createElement(icon, { className: `size-4 ${iconColor}` })} {children}
  </p>
);

const authHdrs = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

// Backend returns the full "Generate with AI" result in one response; reveal it
// progressively on the frontend so the Content step feels like the AI is
// writing live rather than the fields just snapping to their final values.
const CONTENT_STREAM_TOKEN_DELAY_MS = 20;
const splitStreamTokens = (text) => String(text || '').match(/\S+\s*/g) || [];

const DrawerModal = ({
  open,
  chapter,
  durations,
  assessmentTypes,
  classId,
  sectionId,
  subjectId,
  subjectName,
  onClose,
  onUpdate,
  onAddContentFile,
  onRemoveContentFile,
  onAddWorksheetFile,
  onRemoveWorksheetFile,
  onAddAssessment,
  onUpdateAssessment,
  onApplyAiSuggestion,
  onSaveVersion,
  onRestoreVersion,
  onPublishChapter,
  isPublishing = false,
  publishProgress = 0,
  externalStep,
  onStepChange,
  classDisplayName = '',
  autosaveStatus = '',
  onPreview,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [customDurationSelected, setCustomDurationSelected] = useState(() => (
    Boolean(chapter.duration) && !(durations || []).includes(chapter.duration)
  ));
  const [showMaterialUpload, setShowMaterialUpload] = useState(false);
  const [idoweEdoLoading, setIdoweEdoLoading] = useState(false);
  const [contentGenerating, setContentGenerating] = useState(false);
  const [contentStreaming, setContentStreaming] = useState(false);
  const contentStreamTimersRef = React.useRef([]);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = React.useRef(null);

  const toggleFullscreen = React.useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;

    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch {
      // Fallback: CSS-only fullscreen if the Fullscreen API is blocked
      setIsFullscreen((v) => !v);
    }
  }, []);

  // Keep React state in sync if the user exits fullscreen via ESC
  React.useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Close fullscreen when the drawer closes
  React.useEffect(() => {
    if (!open && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [open]);

  // ESC closes drawer's CSS-only fullscreen fallback
  React.useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  React.useEffect(() => () => {
    contentStreamTimersRef.current.forEach(clearTimeout);
  }, []);

  // Language Practice step state
  const [langTab, setLangTab] = useState('reading'); // 'reading' | 'writing'
  const [langSaving, setLangSaving] = useState(false);
  const [langItems, setLangItems] = useState({ reading: [], writing: [] });
  // { id, mode, title } for the language item awaiting delete confirmation.
  const [pendingLangDelete, setPendingLangDelete] = useState(null);
  const [langLoaded, setLangLoaded] = useState(false);
  const [readingForm, setReadingForm] = useState({
    title: '', contentType: 'paragraph', content: '', difficulty: 'medium',
  });
  const [writingForm, setWritingForm] = useState({
    title: '', promptType: 'essay', question: '', instructions: '', difficulty: 'medium', wordLimit: '',
  });

  // Curriculum map topic picker
  const [curriculumTopics, setCurriculumTopics] = useState([]);
  // Weekdays this class/section/subject is on the teacher's routine.
  const [routineDays, setRoutineDays] = useState([]);
  const [routineLoading, setRoutineLoading] = useState(false);
  React.useEffect(() => {
    if (!classId || !sectionId) { setRoutineDays([]); return undefined; }
    let cancelled = false;
    setRoutineLoading(true);
    fetch(`${API_BASE}/api/teacher/dashboard/routine`, { headers: authHdrs() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const schedule = data?.schedule || {};
        const days = WEEKDAYS.filter((day) => (schedule[day] || []).some((e) => (
          String(e.classId || '') === String(classId)
          && String(e.sectionId || '') === String(sectionId)
          && (!subjectId || !e.subjectId || String(e.subjectId) === String(subjectId))
        )));
        setRoutineDays(days);
      })
      .catch(() => { if (!cancelled) setRoutineDays([]); })
      .finally(() => { if (!cancelled) setRoutineLoading(false); });
    return () => { cancelled = true; };
  }, [classId, sectionId, subjectId]);
  const lessonDates = React.useMemo(() => buildLessonDates(routineDays), [routineDays]);
  const [curriculumLoading, setCurriculumLoading] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    const subject = subjectName || '';
    const className = classDisplayName || '';
    if (!subject && !className) return;
    setCurriculumLoading(true);
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (className) params.set('className', className);
    fetch(`${API_BASE}/api/curriculum-map?${params}`, { headers: authHdrs() })
      .then((r) => r.json())
      .then((d) => {
        const maps = d?.data || [];
        const topics = maps.flatMap((m) => (m.topics || []).map((t) => ({ label: t.title, mapId: m._id, order: t.order })));
        setCurriculumTopics(topics);
      })
      .catch(() => setCurriculumTopics([]))
      .finally(() => setCurriculumLoading(false));
  }, [open, subjectName, classDisplayName]);

  const generateIdoWeeDo = async () => {
    const subject = subjectName || 'General';
    const topic = chapter?.title || 'Lesson Topic';
    setIdoweEdoLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai-teacher/idoweedo`, {
        method: 'POST',
        headers: authHdrs(),
        body: JSON.stringify({
          subject,
          topic,
          gradeLevel: null,
          totalMinutes: 60,
          classId,
          sectionId,
          subjectId,
          chapterTitle: chapter?.title || topic,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Generation failed');
      const text = data?.data?.content || '';
      // Parse phases from LLM markdown output
      const phaseMap = {
        HOOK: { id: 'hook', phase: 'THE HOOK', duration: '10' },
        'I DO': { id: 'instruct', phase: 'I DO', duration: '15' },
        'WE DO': { id: 'practice', phase: 'WE DO', duration: '20' },
        'YOU DO': { id: 'synthesis', phase: 'YOU DO', duration: '15' },
      };
      // Extract only the 4 phase lines — ignore any surrounding summary text
      const descriptions = {};
      text.split('\n').forEach((line) => {
        // Strip markdown bold markers and leading hashes, then normalise
        const clean = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
        for (const key of Object.keys(phaseMap)) {
          // Match "HOOK:", "I DO:", "WE DO:", "YOU DO:" at the start of the line
          const prefix = key + ':';
          if (clean.toUpperCase().startsWith(prefix)) {
            descriptions[key] = clean.slice(prefix.length).trim();
            return;
          }
        }
      });
      const updatedFlow = Object.entries(phaseMap).map(([key, base]) => ({
        ...base,
        description: (descriptions[key] || '').slice(0, 120).trim() || base.phase + ' phase',
      }));
      // Only update instructionalFlow — do not overwrite explanation with raw AI dump
      onUpdate({ ...chapter, instructionalFlow: updatedFlow });
      toast.success('I Do / We Do / You Do generated!');
    } catch (err) {
      toast.error(err?.message || 'AI generation failed');
    } finally {
      setIdoweEdoLoading(false);
    }
  };

  const generateAllContent = async () => {
    const subject = subjectName || 'General';
    const topic = chapter?.title || 'Lesson Topic';
    setContentGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai-teacher/generate-content`, {
        method: 'POST',
        headers: authHdrs(),
        body: JSON.stringify({
          subject,
          topic,
          gradeLevel: null,
          classId,
          sectionId,
          subjectId,
          chapterTitle: chapter?.title || topic,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.detail || 'Generation failed');

      const { objectives: aiObj, flow: aiFlow, explanation: aiExp, recap: aiRecap } = data.data || {};

      const phaseMap = {
        HOOK:    { id: 'hook',     phase: 'THE HOOK',       duration: '10' },
        'I DO':  { id: 'instruct', phase: 'I DO',           duration: '15' },
        'WE DO': { id: 'practice', phase: 'WE DO',          duration: '20' },
        'YOU DO':{ id: 'synthesis',phase: 'YOU DO',         duration: '15' },
      };

      const generatedFieldCount = [aiObj?.length, aiExp?.trim(), aiRecap?.trim()]
        .filter(Boolean).length;
      if (generatedFieldCount === 0) {
        throw new Error('AI returned no usable lesson content for this chapter');
      }

      // Only fill fields the teacher hasn't already customised — computed up
      // front so streamContentIntoChapter knows exactly what to reveal.
      const objectivesToApply = (chapter.learningObjectives || []).length === 0 && Array.isArray(aiObj) && aiObj.length
        ? aiObj
        : null;

      const hasCustomFlow = Array.isArray(chapter.instructionalFlow) && chapter.instructionalFlow.length > 0;
      const flowToApply = (!hasCustomFlow && aiFlow)
        ? Object.entries(phaseMap).map(([key, base]) => ({
            ...base,
            description: (aiFlow[key] || '').slice(0, 120).trim() || base.phase + ' phase',
          }))
        : null;

      const explanationToApply = !chapter.explanation?.trim() && aiExp ? aiExp : null;
      const recapToApply = !chapter.recap?.trim() && aiRecap ? aiRecap : null;

      streamContentIntoChapter(chapter, { objectivesToApply, flowToApply, explanationToApply, recapToApply });
    } catch (err) {
      toast.error(err?.message || 'AI generation failed');
      setContentGenerating(false);
    }
  };

  // Reveals a "Generate with AI" result progressively instead of the Content
  // step just snapping to its final values: objectives are appended one at a
  // time, and the explanation/recap/flow-phase descriptions stream in word by
  // word, all advancing together on the same tick so it reads as one AI pass.
  const streamContentIntoChapter = (baseChapter, { objectivesToApply, flowToApply, explanationToApply, recapToApply }) => {
    contentStreamTimersRef.current.forEach(clearTimeout);
    contentStreamTimersRef.current = [];

    const explanationTokens = explanationToApply ? splitStreamTokens(explanationToApply) : [];
    const recapTokens = recapToApply ? splitStreamTokens(recapToApply) : [];
    const flowTokenSets = (flowToApply || []).map((phase) => splitStreamTokens(phase.description || ''));
    const objectiveCount = objectivesToApply?.length || 0;

    const totalSteps = Math.max(
      explanationTokens.length,
      recapTokens.length,
      objectiveCount,
      ...flowTokenSets.map((tokens) => tokens.length),
      0
    );

    if (totalSteps === 0) {
      setContentGenerating(false);
      toast.success('Content generated from your uploaded material');
      return;
    }

    setContentStreaming(true);
    let step = 0;
    let explanationText = '';
    let recapText = '';
    const flowTexts = flowTokenSets.map(() => '');

    const pushStep = () => {
      if (step < explanationTokens.length) explanationText += explanationTokens[step];
      if (step < recapTokens.length) recapText += recapTokens[step];
      flowTokenSets.forEach((tokens, i) => {
        if (step < tokens.length) flowTexts[i] += tokens[step];
      });
      const objectivesSoFar = objectiveCount ? objectivesToApply.slice(0, Math.min(step + 1, objectiveCount)) : null;

      step += 1;
      const isDone = step >= totalSteps;

      onUpdate({
        ...baseChapter,
        ...(objectivesToApply ? { learningObjectives: objectivesSoFar } : {}),
        ...(flowToApply ? { instructionalFlow: flowToApply.map((phase, i) => ({ ...phase, description: flowTexts[i] })) } : {}),
        // The editors are rich text now: keep AI line breaks as paragraphs.
        ...(explanationToApply ? { explanation: textToParagraphs(explanationText) } : {}),
        ...(recapToApply ? { recap: textToParagraphs(recapText) } : {}),
      });

      if (!isDone) {
        contentStreamTimersRef.current.push(window.setTimeout(pushStep, CONTENT_STREAM_TOKEN_DELAY_MS));
      } else {
        setContentStreaming(false);
        setContentGenerating(false);
        toast.success('Content generated from your uploaded material');
      }
    };

    pushStep();
  };

  const goToStep = (nextStep) => {
    // Keep the state updater pure. Calling the parent callback from inside the
    // updater causes React to update AIPoweredTeaching while DrawerModal is
    // rendering, which triggers the setState-during-render warning.
    const next = typeof nextStep === 'function' ? nextStep(currentStep) : nextStep;
    setCurrentStep(next);
    onStepChange?.(next);
  };

  // Load existing reading materials & writing prompts when language step becomes active
  React.useEffect(() => {
    const isLangStep = STEPS[currentStep]?.key === 'language';
    if (!isLangStep || langLoaded || !classId) return;
    const hdrs = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
    const base = API_BASE;
    Promise.all([
      fetch(`${base}/api/reading-assessment/teacher/materials`, { headers: hdrs }).then((r) => r.json()).catch(() => ({ data: [] })),
      fetch(`${base}/api/writing-assessment/teacher/prompts`,   { headers: hdrs }).then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([rm, wp]) => {
      setLangItems({ reading: rm.data || [], writing: wp.data || [] });
      setLangLoaded(true);
    });
  }, [currentStep, langLoaded, classId, chapter?.title]);

  // Only items made for this chapter of this class/section/subject.
  const chapterLang = React.useMemo(() => {
    const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const idOf = (v) => String(v?._id || v || '');
    const title = norm(chapter?.title);
    const matches = (x) => Boolean(title)
      && norm(x.chapter) === title
      && (!x.classId || !classId || idOf(x.classId) === String(classId))
      && (!x.sectionId || !sectionId || idOf(x.sectionId) === String(sectionId))
      && (!x.subjectId || !subjectId || idOf(x.subjectId) === String(subjectId));
    return { reading: langItems.reading.filter(matches), writing: langItems.writing.filter(matches) };
  }, [langItems, chapter?.title, classId, sectionId, subjectId]);

  React.useEffect(() => {
    if (Number.isInteger(externalStep) && externalStep !== currentStep) {
      setCurrentStep(externalStep);
    }
  }, [externalStep, currentStep]);

  if (!chapter) return null;

  const dayLabel = chapter.lessonDate
    ? new Date(chapter.lessonDate).toLocaleDateString('en-US', { weekday: 'long' })
    : '';

  const isPublished = chapter.status === 'published' && !chapter.isDraft;
  const accent = stepAccent[STEPS[currentStep].color];

  // Learning objectives helpers
  const objectives = chapter.learningObjectives || [];
  const addObjective = () => onUpdate({ ...chapter, learningObjectives: [...objectives, ''] });
  const updateObjective = (i, val) => {
    const next = [...objectives];
    next[i] = val;
    onUpdate({ ...chapter, learningObjectives: next });
  };
  const removeObjective = (i) => onUpdate({ ...chapter, learningObjectives: objectives.filter((_, idx) => idx !== i) });

  // Instructional flow helpers
  const flow = chapter.instructionalFlow?.length > 0 ? chapter.instructionalFlow : DEFAULT_INSTRUCTIONAL_FLOW;
  const updateFlow = (id, field, val) =>
    onUpdate({ ...chapter, instructionalFlow: flow.map((p) => (p.id === id ? { ...p, [field]: val } : p)) });

  const handleSaveTryouts = (tryouts) => onUpdate({ ...chapter, tryouts });

  const handleOpenMaterialUpload = () => {
    if (!classId || !sectionId) {
      toast.error('Select class and section first');
      return;
    }
    setShowMaterialUpload(true);
  };

  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.text(chapter.title || 'Lesson Plan', 14, 20);
    doc.text(`Date: ${chapter.lessonDate || '-'}`, 14, 30);
    doc.text(`Day: ${dayLabel || '-'}`, 14, 38);
    doc.text(`Introduction: ${(chapter.introductionText || '').replace(/<[^>]*>/g, '').slice(0, 300)}`, 14, 48, { maxWidth: 180 });
    doc.text(`Explanation: ${(chapter.explanation || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 350)}`, 14, 85, { maxWidth: 180 });
    doc.save(`${chapter.title || 'lesson-plan'}.pdf`);
  };

  const renderStep = () => {
    switch (STEPS[currentStep].key) {

      /* ─── LESSON INFO ─────────────────────────────────────────── */
      case 'info':
        return (
          <div className="min-h-full bg-white p-4 sm:p-6 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
                <Layers className="size-5" />
              </span>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">Chapter Details</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Enter the basic information about your chapter.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <InfoLabel icon={BookOpen} required>Chapter Title</InfoLabel>
                <input
                  value={chapter.title === 'Untitled Chapter' ? '' : chapter.title}
                  onChange={(e) => onUpdate({ ...chapter, title: e.target.value })}
                  placeholder="Enter chapter name (e.g. “Types of Plants”)"
                  className="h-10 w-full rounded-full border border-blue-500 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 dark:border-blue-400 dark:bg-slate-800 dark:text-white"
                />
                {curriculumTopics.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) onUpdate({ ...chapter, title: e.target.value }); }}
                    style={{ colorScheme: 'light' }}
                    className="mt-2 h-10 w-full rounded-full border border-blue-100 bg-blue-50/60 px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="">Or pick a topic from the curriculum…</option>
                    {curriculumTopics.map((t, i) => <option key={i} value={t.label}>{t.order}. {t.label}</option>)}
                  </select>
                )}
                {curriculumLoading && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                    <span className="inline-block size-3 animate-spin rounded-full border border-slate-300 border-t-blue-500" />
                    Loading curriculum topics…
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[220px_150px_minmax(0,1fr)]">
                <div>
                  <InfoLabel icon={Calendar} required>Lesson Date</InfoLabel>
                  {lessonDates.length > 0 ? (
                    <select
                      value={chapter.lessonDate || ''}
                      onChange={(e) => onUpdate({ ...chapter, lessonDate: e.target.value })}
                      style={{ colorScheme: 'light' }}
                      className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="" disabled>Select a class day</option>
                      {chapter.lessonDate && !lessonDates.some((d) => toIsoDate(d) === chapter.lessonDate) && (
                        <option value={chapter.lessonDate}>{new Date(`${chapter.lessonDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} (saved)</option>
                      )}
                      {lessonDates.map((d) => {
                        const iso = toIsoDate(d);
                        const isToday = iso === toIsoDate(new Date());
                        return (
                          <option key={iso} value={iso}>
                            {d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}{isToday ? ' · Today' : ''}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="date"
                      min={toIsoDate(new Date())}
                      value={chapter.lessonDate}
                      onChange={(e) => onUpdate({ ...chapter, lessonDate: e.target.value })}
                      style={{ colorScheme: 'light' }}
                      className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  )}
                  <p className="mt-1 pl-2 text-[11px] text-slate-400">
                    {routineLoading
                      ? 'Checking your timetable…'
                      : routineDays.length
                        ? `Class days: ${routineDays.map((d) => d.slice(0, 3)).join(', ')}`
                        : 'Not on your timetable — any date allowed'}
                  </p>
                </div>
                <div>
                  <InfoLabel icon={Calendar} optional>Day</InfoLabel>
                  <input
                    value={dayLabel || ''}
                    readOnly
                    placeholder="e.g. Monday, Day 1"
                    className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  />
                </div>
                <div>
                  <InfoLabel icon={Clock} required>Duration</InfoLabel>
                  <div className="flex gap-2">
                  <select
                    value={customDurationSelected ? '__custom__' : chapter.duration}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setCustomDurationSelected(true);
                        if ((durations || []).includes(chapter.duration)) onUpdate({ ...chapter, duration: '' });
                        return;
                      }
                      setCustomDurationSelected(false);
                      onUpdate({ ...chapter, duration: e.target.value });
                    }}
                    style={{ colorScheme: 'light' }}
                    className={`h-9 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${customDurationSelected ? 'w-[120px] shrink-0' : 'w-full max-w-[220px]'}`}
                  >
                    <option value="" disabled>Select duration</option>
                    {(durations || []).map((d) => <option key={d} value={d}>{d}</option>)}
                    <option value="__custom__">Custom…</option>
                  </select>
                  {customDurationSelected && (
                    <input
                      type="text"
                      value={chapter.duration}
                      onChange={(e) => onUpdate({ ...chapter, duration: e.target.value })}
                      placeholder="e.g. 75 Minutes"
                      aria-label="Custom lesson duration"
                      autoFocus
                      className="h-9 min-w-0 flex-1 rounded-full border border-blue-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-xl bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 dark:bg-slate-800/60">
                <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  <Info className="size-3.5" /> Tips
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300">Give a clear and meaningful chapter title, choose the lesson date, and set an appropriate duration (e.g. 30–60 minutes).</p>
              </div>
            </div>
          </div>
        );

      /* ─── INTRODUCTION ────────────────────────────────────────── */
      case 'intro':
        return (
          <div className="space-y-4">
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${accent.banner}`}>
              Write a short hook that gets students interested. Use AI for a quick suggestion.
            </p>
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Lightbulb className="size-4 text-amber-500" /> Introduction
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onApplyAiSuggestion}
                  disabled={chapter.aiWriting}
                  className="gap-1.5 border-purple-200 text-purple-600 hover:bg-purple-50 disabled:opacity-70 dark:border-purple-700 dark:text-purple-400"
                >
                  {chapter.aiWriting ? (
                    <>
                      <span className="size-3.5 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
                      Writing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" /> AI Suggestion
                    </>
                  )}
                </Button>
              </div>
              {chapter.aiWriting && (
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-purple-600 dark:text-purple-400">
                  <Sparkles className="size-3.5 animate-pulse" />
                  AI is writing your introduction…
                  <span className="inline-flex gap-0.5">
                    <span className="size-1 animate-bounce rounded-full bg-purple-400 [animation-delay:-0.3s]" />
                    <span className="size-1 animate-bounce rounded-full bg-purple-400 [animation-delay:-0.15s]" />
                    <span className="size-1 animate-bounce rounded-full bg-purple-400" />
                  </span>
                </div>
              )}
              <RichTextEditor
                value={chapter.introductionText}
                onChange={(value) => onUpdate({ ...chapter, introductionText: value })}
                placeholder="How will you hook students into this lesson?"
              />
            </Card>
          </div>
        );

      /* ─── CONTENT ─────────────────────────────────────────────── */
      case 'content':
        return (
          <div className="space-y-4">
            <div className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${accent.banner}`}>
              <p className="text-sm font-medium">
                Define what students will learn, how the lesson flows, and the core explanation.
              </p>
              <button
                type="button"
                onClick={generateAllContent}
                disabled={contentGenerating}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {contentGenerating ? (
                  <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {contentStreaming ? 'Writing…' : contentGenerating ? 'Generating…' : 'Generate with AI'}
              </button>
            </div>
            {contentStreaming && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
                <Sparkles className="size-3.5 animate-pulse" />
                AI is writing your objectives, flow, and explanation…
                <span className="inline-flex gap-0.5">
                  <span className="size-1 animate-bounce rounded-full bg-green-500 [animation-delay:-0.3s]" />
                  <span className="size-1 animate-bounce rounded-full bg-green-500 [animation-delay:-0.15s]" />
                  <span className="size-1 animate-bounce rounded-full bg-green-500" />
                </span>
              </div>
            )}

            {/* Learning Objectives */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle icon={Target} iconColor="text-green-500">Learning Objectives</SectionTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addObjective}
                  className="gap-1 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700"
                >
                  <Plus className="size-3.5" /> Add Objective
                </Button>
              </div>
              {objectives.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  No objectives yet — click "Add Objective" to define what students will learn.
                </p>
              ) : (
                <div className="space-y-2">
                  {objectives.map((obj, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-[11px] font-bold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        {i + 1}
                      </span>
                      <Input
                        value={obj}
                        onChange={(e) => updateObjective(i, e.target.value)}
                        placeholder={`Objective ${i + 1}…`}
                        className="h-9 flex-1 rounded-full px-4 text-sm"
                        style={{ color: '#0f172a', caretColor: '#0f172a' }}
                      />
                      <button
                        type="button"
                        onClick={() => removeObjective(i)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Instructional Flow */}
            <Card>
              <div className="mb-3">
                <SectionTitle icon={ListChecks} iconColor="text-green-500">Instructional Flow</SectionTitle>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {flow.map((phase) => (
                  <div
                    key={phase.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="size-2 rounded-full bg-green-500 shrink-0" />
                      <Input
                        value={phase.phase}
                        onChange={(e) => updateFlow(phase.id, 'phase', e.target.value)}
                        className="h-7 flex-1 border-0 bg-transparent p-0 text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 focus-visible:ring-0"
                        style={{ color: '#334155', caretColor: '#334155' }}
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <Clock className="size-3 text-slate-400" />
                        <input
                          type="number"
                          min="1"
                          value={phase.duration}
                          onChange={(e) => updateFlow(phase.id, 'duration', e.target.value)}
                          className="w-10 rounded border border-slate-200 bg-white px-1 text-center text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          style={{ color: '#475569', caretColor: '#475569' }}
                        />
                        <span className="text-[11px] text-slate-400">m</span>
                      </div>
                    </div>
                    <Input
                      value={phase.description}
                      onChange={(e) => updateFlow(phase.id, 'description', e.target.value)}
                      placeholder="Brief description…"
                      className="h-8 rounded-full border-slate-200 bg-white px-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      style={{ color: '#475569', caretColor: '#475569' }}
                    />
                  </div>
                ))}
              </div>
            </Card>

            {/* Explanation */}
            <Card>
              <SectionTitle icon={ListChecks} iconColor="text-green-400">Step-by-Step Explanation</SectionTitle>
              <RichTextEditor
                value={chapter.explanation}
                onChange={(value) => onUpdate({ ...chapter, explanation: value })}
                placeholder="Walk through what you will teach — one step at a time… (add images, tables and formatting from the toolbar)"
                height={320}
              />
              
            </Card>

            {/* Quick Recap */}
            <Card>
              <SectionTitle icon={CheckCircle2} iconColor="text-green-400">Quick Recap</SectionTitle>
              <RichTextEditor
                value={chapter.recap}
                onChange={(value) => onUpdate({ ...chapter, recap: value })}
                placeholder="Key points students must take away from this lesson…"
                height={200}
              />
            </Card>
            {/* Did You Know? */}
            <Card>
              <SectionTitle icon={Lightbulb} iconColor="text-amber-400">Did You Know?</SectionTitle>
              {(() => {
                const facts = getDidYouKnowFacts(chapter);
                const saveFacts = (next) => onUpdate({
                  ...chapter,
                  didYouKnowFacts: next,
                  // plain copy (one fact per line) for older readers / PDF
                  didYouKnow: next.map((f) => String(f || '').trim()).filter(Boolean).join('\n'),
                });
                return (
                  <div className="space-y-2">
                    {facts.length === 0 && (
                      <p className="text-xs text-slate-400">Add fun or surprising facts. Tip: write “Title: fact” (e.g. “CPU – The Brain of a Computer: It processes data and instructions.”) to give the fact a bold title.</p>
                    )}
                    {facts.map((fact, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          Fact {i + 1}
                        </span>
                        <Input
                          value={fact}
                          onChange={(e) => saveFacts(facts.map((f, idx) => (idx === i ? e.target.value : f)))}
                          placeholder={`Title: fact ${i + 1}… (e.g. Computers Are Used in Space!: Astronauts use computers…)`}
                          className="h-9 flex-1 rounded-full px-4 text-sm"
                          style={{ color: '#0f172a', caretColor: '#0f172a' }}
                        />
                        <button
                          type="button"
                          onClick={() => saveFacts(facts.filter((_, idx) => idx !== i))}
                          aria-label={`Delete fact ${i + 1}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => saveFacts([...facts, ''])}
                      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-amber-300 bg-amber-50/60 px-3.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                      <Plus className="size-3.5" /> Add {facts.length ? `fact ${facts.length + 1}` : 'a fact'}
                    </button>
                  </div>
                );
              })()}
            </Card>
          </div>
        );

      /* ─── MATERIALS ───────────────────────────────────────────── */
      case 'materials':
        return (
          <div className="space-y-4">
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${accent.banner}`}>
              Upload study materials first — PDFs, slides, and documents are instantly indexed so AI features in the next steps can generate content based on your material.
            </p>

            {/* Study Materials upload */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle icon={BookOpen} iconColor="text-purple-500">Study Materials</SectionTitle>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <UploadDropzone
                  title="PDF / Documents"
                  accept=".pdf,.doc,.docx"
                  files={chapter.contentUploads?.['Study Materials'] || []}
                  onAddFile={(file) => onAddContentFile(file, 'Study Materials')}
                  onRemoveFile={(fileId) => onRemoveContentFile(fileId, 'Study Materials')}
                />
                <UploadDropzone
                  title="Presentations & Slides"
                  accept=".ppt,.pptx,.pdf"
                  files={chapter.contentUploads?.['Presentations'] || []}
                  onAddFile={(file) => onAddContentFile(file, 'Presentations')}
                  onRemoveFile={(fileId) => onRemoveContentFile(fileId, 'Presentations')}
                />
                <UploadDropzone
                  title="Images & Diagrams"
                  accept="image/*"
                  files={chapter.contentUploads?.['Images'] || []}
                  onAddFile={(file) => onAddContentFile(file, 'Images')}
                  onRemoveFile={(fileId) => onRemoveContentFile(fileId, 'Images')}
                />
                <UploadDropzone
                  title="Videos & Experiments"
                  accept="video/*,.pdf,.doc,.docx"
                  files={chapter.contentUploads?.['Experiments'] || []}
                  onAddFile={(file) => onAddContentFile(file, 'Experiments')}
                  onRemoveFile={(fileId) => onRemoveContentFile(fileId, 'Experiments')}
                />
              </div>
            </Card>

            {/* Reference link */}
            <Card>
              <SectionTitle icon={FlaskConical} iconColor="text-purple-500">Article Reference</SectionTitle>
              <div className="flex items-center gap-2">
                <Input
                  type="url"
                  inputMode="url"
                  value={chapter.worksheetLink || ''}
                  onChange={(e) => onUpdate({ ...chapter, worksheetLink: e.target.value })}
                  onPaste={(e) => {
                    // Take the pasted text as-is (trimmed) so a link copied with
                    // spaces / line breaks still lands in the field.
                    const pasted = e.clipboardData?.getData('text');
                    if (!pasted) return;
                    e.preventDefault();
                    onUpdate({ ...chapter, worksheetLink: pasted.trim() });
                  }}
                  placeholder="Paste an article or reference URL…"
                  className="h-10 flex-1 rounded-full bg-white px-4 text-slate-900 caret-slate-900 dark:bg-slate-800 dark:text-white"
                />
                {/^https?:\/\//i.test(String(chapter.worksheetLink || '').trim()) && (
                  <a
                    href={String(chapter.worksheetLink).trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 shrink-0 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800"
                  >
                    Open link
                  </a>
                )}
              </div>
            </Card>

            {/* Report uploads */}
            <Card>
              <SectionTitle icon={FileText} iconColor="text-purple-400">Reports & Additional Files</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <UploadDropzone
                  title="Class Notes"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                  files={chapter.contentUploads?.['Report Upload'] || []}
                  onAddFile={(file) => onAddContentFile(file, 'Report Upload')}
                  onRemoveFile={(fileId) => onRemoveContentFile(fileId, 'Report Upload')}
                />
                <UploadDropzone
                  title="Additional Resources"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                  files={chapter.contentUploads?.['Additional Resources'] || []}
                  onAddFile={(file) => onAddContentFile(file, 'Additional Resources')}
                  onRemoveFile={(fileId) => onRemoveContentFile(fileId, 'Additional Resources')}
                />
              </div>
            </Card>
          </div>
        );

      /* ─── WORKSHEET ───────────────────────────────────────────── */
      case 'assessment':
        return (
          <div className="space-y-4">

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle icon={ClipboardList} iconColor="text-rose-500">Worksheet</SectionTitle>
              </div>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Upload one worksheet for this chapter. Accepted files: PDF and DOCX.</p>
              <UploadDropzone
                title="Upload Worksheet"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                files={chapter.worksheetFiles || []}
                onAddFile={onAddWorksheetFile}
                onRemoveFile={onRemoveWorksheetFile}
              />
            </Card>

          </div>
        );

      /* ─── LANGUAGE PRACTICE ─────────────────────────────────── */
      case 'language': {
        const saveReading = async () => {
          if (!readingForm.title.trim() || !readingForm.content.trim()) {
            toast.error('Title and passage are required');
            return;
          }
          if (!classId || !sectionId) {
            toast.error('Select class and section first');
            return;
          }
          setLangSaving(true);
          try {
            const base = API_BASE;
            const resp = await fetch(`${base}/api/reading-assessment/teacher/materials`, {
              method: 'POST',
              headers: authHdrs(),
              body: JSON.stringify({
                ...readingForm,
                subject: subjectName,
                chapter: chapter?.title || '',
                classId,
                sectionId,
                isPublished: true,
              }),
            });
            if (!resp.ok) throw new Error('Save failed');
            const data = await resp.json();
            setLangItems((prev) => ({ ...prev, reading: [data.data, ...prev.reading] }));
            setReadingForm({ title: '', contentType: 'paragraph', content: '', difficulty: 'medium' });
            toast.success('Reading passage saved & published to students');
          } catch (err) {
            toast.error(err.message || 'Save failed');
          } finally {
            setLangSaving(false);
          }
        };

        const saveWriting = async () => {
          if (!writingForm.title.trim() || !writingForm.question.trim()) {
            toast.error('Title and prompt are required');
            return;
          }
          if (!classId || !sectionId) {
            toast.error('Select class and section first');
            return;
          }
          setLangSaving(true);
          try {
            const base = API_BASE;
            const resp = await fetch(`${base}/api/writing-assessment/teacher/prompts`, {
              method: 'POST',
              headers: authHdrs(),
              body: JSON.stringify({
                ...writingForm,
                wordLimit: Number(writingForm.wordLimit) || 0,
                subject: subjectName,
                chapter: chapter?.title || '',
                classId,
                sectionId,
                isPublished: true,
              }),
            });
            if (!resp.ok) throw new Error('Save failed');
            const data = await resp.json();
            setLangItems((prev) => ({ ...prev, writing: [data.data, ...prev.writing] }));
            setWritingForm({ title: '', promptType: 'essay', question: '', instructions: '', difficulty: 'medium', wordLimit: '' });
            toast.success('Writing prompt saved & published to students');
          } catch (err) {
            toast.error(err.message || 'Save failed');
          } finally {
            setLangSaving(false);
          }
        };

        const deleteItem = (id, mode) => {
          const item = (langItems[mode] || []).find((x) => x._id === id);
          setPendingLangDelete({ id, mode, title: item?.title || '' });
        };

        const deleteItemNow = async (id, mode) => {
          const base = API_BASE;
          const url = mode === 'reading'
            ? `${base}/api/reading-assessment/teacher/materials/${id}`
            : `${base}/api/writing-assessment/teacher/prompts/${id}`;
          try {
            const resp = await fetch(url, { method: 'DELETE', headers: authHdrs() });
            if (!resp.ok) throw new Error('Delete failed');
            setLangItems((prev) => ({ ...prev, [mode]: prev[mode].filter((x) => x._id !== id) }));
            toast.success('Removed');
          } catch {
            toast.error('Failed to remove item. Please try again.');
          }
        };

        const DIFF_COLORS = {
          easy: 'bg-emerald-100 text-emerald-700',
          medium: 'bg-amber-100 text-amber-700',
          hard: 'bg-red-100 text-red-700',
        };

        const inputCls = 'w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
        const selectCls = inputCls;

        return (
          <div className="space-y-4">
            <ConfirmDialog
              open={Boolean(pendingLangDelete)}
              onOpenChange={(open) => { if (!open) setPendingLangDelete(null); }}
              onConfirm={() => {
                const target = pendingLangDelete;
                setPendingLangDelete(null);
                if (target) deleteItemNow(target.id, target.mode);
              }}
              icon={Trash2}
              title={pendingLangDelete?.mode === 'reading' ? 'Delete reading material?' : 'Delete writing prompt?'}
              description={`"${pendingLangDelete?.title || 'This item'}" will be removed and students will no longer see it. This cannot be undone.`}
              confirmLabel="Delete"
            />
            {/* Sub-tab toggle */}
            <div className="mx-auto flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60">
              {[
                { key: 'reading', label: 'Reading', icon: Mic },
                { key: 'writing', label: 'Writing', icon: PenLine },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLangTab(key)}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                    langTab === key
                      ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* ── READING form ── */}
            {langTab === 'reading' && (
              <Card>
                <SectionTitle icon={Mic} iconColor="text-indigo-500">New Reading Passage</SectionTitle>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Title *</label>
                    <input
                      className={inputCls}
                      placeholder="e.g. The Tortoise and the Hare"
                      value={readingForm.title}
                      onChange={(e) => setReadingForm((f) => ({ ...f, title: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Type</label>
                      <select
                        className={selectCls}
                        value={readingForm.contentType}
                        onChange={(e) => setReadingForm((f) => ({ ...f, contentType: e.target.value }))}
                      >
                        {['story', 'paragraph', 'poem', 'article', 'dialogue'].map((t) => (
                          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Difficulty</label>
                      <select
                        className={selectCls}
                        value={readingForm.difficulty}
                        onChange={(e) => setReadingForm((f) => ({ ...f, difficulty: e.target.value }))}
                      >
                        {['easy', 'medium', 'hard'].map((d) => (
                          <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Passage *{' '}
                      <span className="font-normal normal-case text-slate-400">
                        ({readingForm.content.trim().split(/\s+/).filter(Boolean).length} words)
                      </span>
                    </label>
                    <textarea
                      className={`${inputCls.replace('rounded-full', 'rounded-2xl')} resize-y leading-7`}
                      rows={6}
                      placeholder="Paste or type the reading passage here…"
                      value={readingForm.content}
                      onChange={(e) => setReadingForm((f) => ({ ...f, content: e.target.value }))}
                      style={{ fontFamily: 'Georgia, serif' }}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={saveReading}
                      disabled={langSaving}
                      className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {langSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>

                {/* Existing passages for this chapter */}
                {chapterLang.reading.length > 0 && (
                  <div className="mt-5 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Saved Passages</p>
                    {chapterLang.reading.map((item) => (
                      <div key={item._id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800/40">
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100" title={item.title}>{item.title}</p>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 text-[11px]">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium capitalize text-slate-600 dark:bg-slate-700 dark:text-slate-300">{item.contentType || 'reading'}</span>
                          {item.wordCount > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">{item.wordCount} words</span>}
                          {item.difficulty && <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${DIFF_COLORS[item.difficulty] || 'bg-slate-100 text-slate-600'}`}>{item.difficulty}</span>}
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${item.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.isPublished ? 'Published' : 'Draft'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteItem(item._id, 'reading')}
                          aria-label={`Delete ${item.title}`}
                          className="shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* ── WRITING form ── */}
            {langTab === 'writing' && (
              <Card>
                <SectionTitle icon={PenLine} iconColor="text-emerald-500">Create Writing</SectionTitle>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Title *</label>
                    <input
                      className={inputCls}
                      placeholder="e.g. My Favourite Season"
                      value={writingForm.title}
                      onChange={(e) => setWritingForm((f) => ({ ...f, title: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Type</label>
                      <select
                        className={selectCls}
                        value={writingForm.promptType}
                        onChange={(e) => setWritingForm((f) => ({ ...f, promptType: e.target.value }))}
                      >
                        {['essay', 'paragraph', 'question', 'letter', 'creative'].map((t) => (
                          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Difficulty</label>
                      <select
                        className={selectCls}
                        value={writingForm.difficulty}
                        onChange={(e) => setWritingForm((f) => ({ ...f, difficulty: e.target.value }))}
                      >
                        {['easy', 'medium', 'hard'].map((d) => (
                          <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Question *</label>
                    <textarea
                      className={`${inputCls.replace('rounded-full', 'rounded-2xl')} resize-y`}
                      rows={3}
                      placeholder="e.g. Write an essay on global warming and its effects on the environment."
                      value={writingForm.question}
                      onChange={(e) => setWritingForm((f) => ({ ...f, question: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Instructions <span className="font-normal normal-case text-slate-400">(optional)</span></label>
                    <textarea
                      className={`${inputCls.replace('rounded-full', 'rounded-2xl')} resize-y`}
                      rows={2}
                      placeholder="e.g. Use paragraphs. Include an introduction and conclusion. Write 150–200 words."
                      value={writingForm.instructions}
                      onChange={(e) => setWritingForm((f) => ({ ...f, instructions: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Word Limit <span className="font-normal normal-case text-slate-400">(0 = no limit)</span></label>
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      placeholder="e.g. 200"
                      value={writingForm.wordLimit}
                      onChange={(e) => setWritingForm((f) => ({ ...f, wordLimit: e.target.value }))}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={saveWriting}
                      disabled={langSaving}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {langSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>

                {/* Existing prompts for this chapter */}
                {chapterLang.writing.length > 0 && (
                  <div className="mt-5 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Saved</p>
                    {chapterLang.writing.map((item) => (
                      <div key={item._id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800/40">
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100" title={item.title}>{item.title}</p>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 text-[11px]">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium capitalize text-slate-600 dark:bg-slate-700 dark:text-slate-300">{item.promptType || 'writing'}</span>
                          {item.wordLimit > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">{item.wordLimit} word limit</span>}
                          {item.difficulty && <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${DIFF_COLORS[item.difficulty] || 'bg-slate-100 text-slate-600'}`}>{item.difficulty}</span>}
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${item.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.isPublished ? 'Published' : 'Draft'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteItem(item._id, 'writing')}
                          aria-label={`Delete ${item.title}`}
                          className="shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        );
      }

      /* ─── TRYOUT ──────────────────────────────────────────────── */
      case 'tryout':
        return (
          <div className="space-y-4">
            
            <InlineTryoutBuilder
              tryouts={chapter.tryouts || []}
              onSaveTryouts={handleSaveTryouts}
              topicTitle={chapter.title || ''}
              subjectName={subjectName}
              gradeLevel={classDisplayName}
            />
          </div>
        );

      /* ─── EVALUATE & PUBLISH ──────────────────────────────────── */
      case 'publish': {
        const reviewMaterials = Object.entries(chapter.contentUploads || {})
          .flatMap(([bucket, files]) => (Array.isArray(files) ? files : []).map((file) => ({ ...file, bucket })))
          .filter((file) => file?.name || file?.url);
        const reviewObjectives = Array.isArray(chapter.learningObjectives)
          ? chapter.learningObjectives.filter(Boolean)
          : [];
        const reviewFlow = Array.isArray(chapter.instructionalFlow)
          ? chapter.instructionalFlow.filter((step) => step?.description || step?.phase)
          : [];
        const reviewTryouts = Array.isArray(chapter.tryouts) ? chapter.tryouts : [];
        const reviewPracticeItems = Array.isArray(chapter.assessments) ? chapter.assessments.filter((item) => item?.title) : [];
        const reviewDueDate = chapter.lessonDate || new Date().toISOString().slice(0, 10);
        return (
          <div className="space-y-4">

            <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"><CheckCircle2 className="size-5" /></div>
                <div>
                  <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Review before publishing</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-800 dark:text-emerald-300">This complete chapter package will become visible immediately to students in the selected class and section. Publishing again replaces the currently published version.</p>
                </div>
              </div>
            </Card>

            <Card>
              <SectionTitle icon={BookOpen} iconColor="text-blue-500">Chapter information</SectionTitle>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Title</p><p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{chapter.title || 'Untitled Chapter'}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Class and subject</p><p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{[classDisplayName, subjectName].filter(Boolean).join(' · ') || 'Selected class and subject'}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Lesson date</p><p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{chapter.lessonDate || 'Not set'}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Duration</p><p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{chapter.duration || 'Not set'}</p></div>
              </div>
            </Card>

            <Card>
              <SectionTitle icon={FileText} iconColor="text-violet-500">Materials</SectionTitle>
              {reviewMaterials.length > 0 || chapter.worksheetLink ? (
                <div className="space-y-2">
                  {reviewMaterials.map((file) => (
                    <div key={`${file.bucket}-${file.id || file.name}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{file.name || 'Uploaded material'}</p><p className="text-[10px] text-slate-400">{file.bucket}</p></div>
                      {file.url && <a href={file.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-blue-600 hover:underline">Preview</a>}
                    </div>
                  ))}
                  {chapter.worksheetLink && <a href={chapter.worksheetLink} target="_blank" rel="noreferrer" className="block truncate text-xs font-semibold text-blue-600 hover:underline">Reference link: {chapter.worksheetLink}</a>}
                </div>
              ) : <p className="text-sm text-slate-500">No additional materials added.</p>}
            </Card>

            <Card>
              <SectionTitle icon={Lightbulb} iconColor="text-amber-500">Introduction</SectionTitle>
              {plainText(chapter.introductionText) ? <div className="rich-reader text-sm leading-relaxed text-slate-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: chapter.introductionText }} /> : <p className="text-sm text-slate-400">No introduction added.</p>}
            </Card>

            <Card>
              <SectionTitle icon={ListChecks} iconColor="text-green-500">Content</SectionTitle>
              {reviewObjectives.length > 0 && <div className="mb-3"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Learning objectives</p><ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">{reviewObjectives.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}
              {plainText(chapter.explanation) ? <div className="rich-reader text-sm leading-relaxed text-slate-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: chapter.explanation }} /> : <p className="text-sm text-slate-400">No lesson content added.</p>}
              {plainText(chapter.recap) && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300"><p className="mb-1 font-semibold">Recap</p><div className="rich-reader" dangerouslySetInnerHTML={{ __html: chapter.recap }} /></div>}
              {getDidYouKnowFacts(chapter).some((f) => String(f).trim()) && <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"><p className="mb-1 font-semibold">Did you know?</p><ol className="space-y-1">{getDidYouKnowFacts(chapter).filter((f) => String(f).trim()).map((f, i) => <li key={i}><span className="font-semibold">Fact {i + 1}:</span> {f}</li>)}</ol></div>}
              {reviewFlow.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{reviewFlow.map((step, index) => <span key={`${step.id || step.phase || index}`} className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{step.phase || `Step ${index + 1}`}</span>)}</div>}
            </Card>

            <Card>
              <SectionTitle icon={ClipboardList} iconColor="text-rose-500">Worksheet</SectionTitle>
              {chapter.worksheetFiles?.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Students can preview/download this file, complete it, and submit their work once.</p>
                  {chapter.worksheetFiles.map((file) => <div key={file.id || file.name} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2"><span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{file.name || 'Worksheet file'}</span>{file.url && <a href={file.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-amber-700 hover:underline">Preview</a>}</div>)}
                  <div className="grid gap-2 pt-1 text-xs sm:grid-cols-2"><p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300"><span className="font-semibold">Due date:</span> {reviewDueDate}</p><p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300"><span className="font-semibold">Submission:</span> One student submission</p></div>
                </div>
              ) : <p className="text-sm text-slate-500">No worksheet uploaded. Students will not receive a worksheet until one is added.</p>}
            </Card>

            <Card>
              <SectionTitle icon={ClipboardList} iconColor="text-indigo-500">Practice</SectionTitle>
              {reviewPracticeItems.length > 0 ? <div className="space-y-2">{reviewPracticeItems.map((item) => <div key={item.id || item.title} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">{item.title}</div>)}</div> : <p className="text-sm text-slate-500">No additional practice paper added in this chapter.</p>}
            </Card>

            <Card>
              <SectionTitle icon={Play} iconColor="text-pink-500">Tryout</SectionTitle>
              {reviewTryouts.length > 0 ? <div className="space-y-2">{reviewTryouts.map((item, index) => <div key={item.id || item.title || index} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">{item.title || item.name || `Tryout ${index + 1}`}</div>)}</div> : <p className="text-sm text-slate-500">No tryout added in this chapter.</p>}
            </Card>

            {!!chapter.history?.length && (
              <Card>
                <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Saved Versions</p>
                <div className="space-y-2">
                  {chapter.history.slice(-5).reverse().map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
                      <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
                      <Button size="xs" variant="outline" onClick={() => onRestoreVersion(item.id)} className="text-xs">
                        Restore
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div >
              <div >
              </div>
              {(isPublishing || publishProgress > 0) && (
                <div className="mt-4 max-w-md">
                  <div className="mb-1.5 flex items-center justify-between">
                    <ProgressLabel>Data Ingestion Pipeline</ProgressLabel>
                    <ProgressValue value={publishProgress} />
                  </div>
                  <Progress value={publishProgress} className="h-1.5 bg-emerald-200/80 [&>div]:bg-emerald-600" />
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                    Converting the chapter's PDF into chunks and storing them in the Qdrant vector database.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.section
          key={chapter.id}
          ref={containerRef}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.18 }}
          className={[
            'flex min-h-full min-w-0 w-full flex-1 flex-col text-slate-900 dark:text-slate-100 bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/50 lg:h-full lg:min-h-0 lg:overflow-hidden dark:from-slate-950 dark:via-slate-950 dark:to-slate-900',
            isFullscreen
              ? 'fixed inset-0 z-[100] h-dvh w-screen overflow-hidden rounded-none sm:rounded-none border-0'
              : '',
          ].join(' ')}
        >
          {/* ── Top bar ── */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 bg-white/90 px-3 py-2 backdrop-blur sm:gap-2.5 sm:px-5 dark:border-slate-800 dark:bg-slate-900/90">
            <button type="button" onClick={onClose} aria-label="Close chapter" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
              <ArrowLeft className="size-4" />
            </button>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
              <BookOpen className="size-4" />
            </div>
            <h3 className="min-w-0 truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg dark:text-white">
              {isPublished ? 'Edit Chapter' : 'Create Chapter'}
            </h3>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
              {isPublished ? 'Published' : 'Draft'}
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {autosaveStatus && (
                <CloudSaveStatus status={autosaveStatus} className="mr-1 hidden md:inline-flex" />
              )}
              <button type="button" onClick={onSaveVersion} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                <Save className="size-3.5" /><span className="hidden sm:inline">Save Draft</span>
              </button>
              <button type="button" onClick={exportPdf} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                <FileText className="size-3.5" /><span className="hidden sm:inline">Export PDF</span>
              </button>
              <span className="hidden h-7 w-px bg-slate-200 sm:block dark:bg-slate-700" />
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                title={isFullscreen ? 'Exit fullscreen' : 'View lesson plan in fullscreen'}
                className="hidden size-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 sm:flex dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
            </div>
          </div>

          {/* ── Body: vertical stepper + step content ── */}
          <div className="flex min-h-0 flex-1 flex-col bg-white lg:flex-row lg:overflow-hidden dark:bg-slate-900">
            {/* Stepper (laptop / desktop) */}
            <nav aria-label="Lesson plan steps" className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-200/80 bg-slate-50/60 p-2.5 lg:flex dark:border-slate-800 dark:bg-slate-900">
              <ol className="flex min-h-full flex-col">
                {STEPS.map((step, index) => {
                  const isActive = index === currentStep;
                  const status = stepStatus(step.key, chapter);
                  const isDone = status === true;
                  const isMissing = status === false && index < currentStep;
                  return (
                    <li key={step.key} className="relative flex min-h-[52px] flex-1 items-center">
                      {index < STEPS.length - 1 && (
                        <span aria-hidden="true" className={`absolute left-[22px] top-[calc(50%+8px)] h-[calc(100%-24px)] w-0.5 ${isDone ? 'bg-emerald-300' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      )}
                      <button
                        type="button"
                        onClick={() => goToStep(index)}
                        aria-current={isActive ? 'step' : undefined}
                        className={`relative flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${isActive ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                      >
                        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : isDone ? 'bg-emerald-500 text-white' : isMissing ? 'bg-amber-400 text-white' : 'bg-slate-300 text-white dark:bg-slate-600'}`} title={isMissing ? 'Some required details are missing' : undefined}>
                          {isDone && !isActive ? <Check className="size-3" strokeWidth={3} /> : isMissing ? '!' : index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className={`block text-[13px] font-semibold leading-tight ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-slate-100'}`}>{step.label}</span>
                          <span className={`mt-0.5 block text-[11px] ${isMissing ? 'font-medium text-amber-600' : 'text-slate-500 dark:text-slate-400'}`}>{isMissing ? 'Details missing — tap to finish' : step.desc}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>

            {/* Stepper (phone / tablet) */}
            <div className="overflow-x-auto border-b border-slate-200/80 px-3 py-2 lg:hidden dark:border-slate-800">
              <div className="flex w-max items-center gap-1.5 px-1">
                {STEPS.map((step, index) => {
                  const isActive = index === currentStep;
                  const status = stepStatus(step.key, chapter);
                  const isDone = status === true;
                  const isMissing = status === false && index < currentStep;
                  return (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => goToStep(index)}
                      aria-current={isActive ? 'step' : undefined}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${isActive ? 'bg-blue-600 text-white shadow' : isDone ? 'bg-emerald-50 text-emerald-700' : isMissing ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'}`}
                    >
                      {isDone && !isActive ? <Check className="size-3.5" strokeWidth={3} /> : <span>{isMissing ? '!' : index + 1}</span>}
                      <span className={isActive ? 'inline' : 'hidden sm:inline'}>{step.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step content */}
            <div className="min-w-0 flex-1 lg:overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
              >
                {STEPS[currentStep].key === 'info' ? renderStep() : (
                  <div className="min-h-full bg-white p-4 sm:p-6 dark:bg-slate-900">
                    <StepHeading step={STEPS[currentStep]} />
                    {renderStep()}
                  </div>
                )}
              </motion.div>
            </div>
          </div>

          {/* ── Bottom bar ── */}
          <div className="sticky bottom-0 z-10 border-t border-slate-200/80 bg-white/95 px-3 py-2 backdrop-blur sm:px-5 lg:static dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex items-center justify-between gap-3">
              {currentStep === 0 ? <span className="w-[72px] shrink-0 sm:w-[88px]" aria-hidden="true" /> : (
              <button
                type="button"
                onClick={() => goToStep((s) => Math.max(0, s - 1))}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:opacity-70 sm:px-5 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
              >
                <ArrowLeft className="size-4" /> Back
              </button>
              )}

              <div className="flex min-w-0 flex-1 items-center justify-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                <span className="shrink-0">Step <span className="font-semibold text-slate-900 dark:text-white">{currentStep + 1}</span> of {STEPS.length}</span>
                <span className="hidden h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-slate-200 sm:block dark:bg-slate-700">
                  <span className="block h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${Math.round(((currentStep + 1) / STEPS.length) * 100)}%` }} />
                </span>
                <span className="hidden shrink-0 md:inline"><span className="font-semibold text-slate-900 dark:text-white">{Math.round(((currentStep + 1) / STEPS.length) * 100)}%</span> Complete</span>
              </div>

              {currentStep < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => goToStep((s) => s + 1)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 active:scale-[.98] sm:px-5"
                >
                  <span className="sm:hidden">Next</span>
                  <span className="hidden max-w-[220px] truncate sm:inline">Next: {STEPS[currentStep + 1].label}</span>
                  <ArrowRight className="size-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPublishChapter}
                  disabled={isPublishing}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 disabled:opacity-50 sm:px-5"
                >
                  {isPublishing ? (isPublished ? 'Updating...' : 'Publishing...') : <><Send className="size-4" /> Publish</>}
                </button>
              )}
            </div>
          </div>
        </motion.section>
      )}

      {/* Material upload modal */}
      {showMaterialUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl">
            <button
              type="button"
              onClick={() => setShowMaterialUpload(false)}
              className="absolute right-4 top-4 z-10 rounded-full bg-white p-1.5 text-slate-500 shadow hover:bg-slate-100"
              aria-label="Close upload material"
            >
              <X className="size-4" />
            </button>
            <RichTextMaterialEditor
              classId={classId}
              sectionId={sectionId}
              subjectId={subjectId}
              chapterId={chapter.id}
              chapterTitle={chapter.title}
              onCancel={() => setShowMaterialUpload(false)}
              onSave={(savedMaterial) => {
                setShowMaterialUpload(false);
                toast.success(
                  savedMaterial?.status === 'published'
                    ? 'Material is now visible to students'
                    : 'Material saved as draft. Choose "Publish now" to make it visible to students.'
                );
              }}
            />
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DrawerModal;
