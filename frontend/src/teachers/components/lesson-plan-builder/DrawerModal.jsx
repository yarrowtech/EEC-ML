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
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  FlaskConical,
  Lightbulb,
  ListChecks,
  Mic,
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
import UploadDropzone from './UploadDropzone';
import FileUploadCard from './FileUploadCard';
import AssessmentCard from './AssessmentCard';
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
  { key: 'info',       label: 'Lesson Info',       icon: Calendar,       color: 'blue'    },
  { key: 'materials',  label: 'Materials',          icon: BookOpen,       color: 'purple'  },
  { key: 'intro',      label: 'Introduction',       icon: Lightbulb,      color: 'amber'   },
  { key: 'content',    label: 'Content',            icon: ListChecks,     color: 'green'   },
  { key: 'assessment', label: 'Assessment',         icon: ClipboardList,  color: 'rose'    },
  { key: 'language',   label: 'Language Practice',  icon: Mic,            color: 'indigo'  },
  { key: 'tryout',     label: 'Tryout',             icon: Play,           color: 'pink'    },
  { key: 'publish',    label: 'Evaluate & Publish', icon: Send,           color: 'emerald' },
];

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
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [customDurationSelected, setCustomDurationSelected] = useState(() => (
    Boolean(chapter.duration) && !(durations || []).includes(chapter.duration)
  ));
  const [showMaterialUpload, setShowMaterialUpload] = useState(false);
  const [idoweEdoLoading, setIdoweEdoLoading] = useState(false);
  const [contentGenerating, setContentGenerating] = useState(false);

  // Language Practice step state
  const [langTab, setLangTab] = useState('reading'); // 'reading' | 'writing'
  const [langSaving, setLangSaving] = useState(false);
  const [langItems, setLangItems] = useState({ reading: [], writing: [] });
  const [langLoaded, setLangLoaded] = useState(false);
  const [readingForm, setReadingForm] = useState({
    title: '', contentType: 'paragraph', content: '', difficulty: 'medium',
  });
  const [writingForm, setWritingForm] = useState({
    title: '', promptType: 'essay', question: '', instructions: '', difficulty: 'medium', wordLimit: '',
  });

  // Curriculum map topic picker
  const [curriculumTopics, setCurriculumTopics] = useState([]);
  const [curriculumLoading, setCurriculumLoading] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    const subject = localStorage.getItem('selectedSubjectName') || '';
    const className = localStorage.getItem('selectedClassName') || '';
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
  }, [open]);

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

      onUpdate({
        ...chapter,
        // Only fill objectives if currently empty
        learningObjectives: (chapter.learningObjectives || []).length === 0 && Array.isArray(aiObj) && aiObj.length
          ? aiObj
          : chapter.learningObjectives,
        // Only fill flow if teacher hasn't customised it yet
        instructionalFlow: (() => {
          const hasCustomFlow = Array.isArray(chapter.instructionalFlow) && chapter.instructionalFlow.length > 0;
          if (hasCustomFlow || !aiFlow) return chapter.instructionalFlow || DEFAULT_INSTRUCTIONAL_FLOW;
          return Object.entries(phaseMap).map(([key, base]) => ({
            ...base,
            description: (aiFlow[key] || '').slice(0, 120).trim() || base.phase + ' phase',
          }));
        })(),
        // Only fill explanation if empty
        explanation: !chapter.explanation?.trim() && aiExp ? aiExp : chapter.explanation,
        // Only fill recap if empty
        recap: !chapter.recap?.trim() && aiRecap ? aiRecap : chapter.recap,
      });
      toast.success('Content generated from your uploaded material');
    } catch (err) {
      toast.error(err?.message || 'AI generation failed');
    } finally {
      setContentGenerating(false);
    }
  };

  const goToStep = (nextStep) => {
    setCurrentStep((previous) => {
      const next = typeof nextStep === 'function' ? nextStep(previous) : nextStep;
      onStepChange?.(next);
      return next;
    });
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
      // Filter to materials for this chapter only (by chapter title match or just show all if no chapter)
      const chTitle = chapter?.title || '';
      const filterByChapter = (arr) => chTitle
        ? arr.filter((x) => !x.chapter || x.chapter === chTitle)
        : arr;
      setLangItems({
        reading: filterByChapter(rm.data || []),
        writing: filterByChapter(wp.data || []),
      });
      setLangLoaded(true);
    });
  }, [currentStep, langLoaded, classId, chapter?.title]);

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
    doc.text(`Explanation: ${(chapter.explanation || '').slice(0, 350)}`, 14, 85, { maxWidth: 180 });
    doc.save(`${chapter.title || 'lesson-plan'}.pdf`);
  };

  const renderStep = () => {
    switch (STEPS[currentStep].key) {

      /* ─── LESSON INFO ─────────────────────────────────────────── */
      case 'info':
        return (
          <div className="space-y-4">
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${accent.banner}`}>
              Name this lesson, pick a date and set how long it will run.
            </p>
            <Card>
              <Field label="Chapter Title">
                <Input
                  value={chapter.title}
                  onChange={(e) => onUpdate({ ...chapter, title: e.target.value })}
                  placeholder="e.g. Photosynthesis — Light Reactions"
                  className="h-10 rounded-lg border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"
                  style={{ color: '#0f172a', caretColor: '#0f172a' }}
                />
              </Field>
              {curriculumTopics.length > 0 && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                    Or pick from curriculum map
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) onUpdate({ ...chapter, title: e.target.value });
                    }}
                    style={{ colorScheme: 'light', color: '#1e293b', backgroundColor: '#f0f7ff', borderColor: '#bfdbfe' }}
                    className="h-9 w-full rounded-lg border px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="">— Select a curriculum topic —</option>
                    {curriculumTopics.map((t, i) => (
                      <option key={i} value={t.label}>{t.order}. {t.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {curriculumLoading && (
                <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
                  <span className="animate-spin inline-block w-3 h-3 border border-slate-300 border-t-blue-500 rounded-full" />
                  Loading curriculum topics…
                </p>
              )}
            </Card>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <Field label="Lesson Date">
                  <input
                    type="date"
                    value={chapter.lessonDate}
                    onChange={(e) => onUpdate({ ...chapter, lessonDate: e.target.value })}
                    style={{ colorScheme: 'light', color: '#1e293b', backgroundColor: 'white', borderColor: '#e2e8f0' }}
                    className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </Field>
              </Card>
              <Card>
                <Field label="Day">
                  <input
                    value={dayLabel || ''}
                    readOnly
                    placeholder="Auto-filled"
                    style={{ color: '#64748b', backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
                    className="h-10 w-full rounded-lg border px-3 text-sm"
                  />
                </Field>
              </Card>
              <Card>
                <Field label="Duration">
                  <select
                    value={customDurationSelected ? '__custom__' : chapter.duration}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setCustomDurationSelected(true);
                        if ((durations || []).includes(chapter.duration)) {
                          onUpdate({ ...chapter, duration: '' });
                        }
                        return;
                      }
                      setCustomDurationSelected(false);
                      onUpdate({ ...chapter, duration: e.target.value });
                    }}
                    style={{ colorScheme: 'light', color: '#1e293b', backgroundColor: 'white', borderColor: '#e2e8f0' }}
                    className="h-10 w-full rounded-lg border px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                      style={{ color: '#1e293b', backgroundColor: 'white', borderColor: '#e2e8f0' }}
                      className="mt-2 h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  )}
                </Field>
              </Card>
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
                  className="gap-1.5 border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400"
                >
                  <Sparkles className="size-3.5" /> AI Suggestion
                </Button>
              </div>
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
                <Sparkles className="size-3.5" />
                {contentGenerating ? 'Generating…' : 'Generate with AI'}
              </button>
            </div>

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
                        className="h-9 flex-1 text-sm"
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
                      className="h-8 border-slate-200 bg-white text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      style={{ color: '#475569', caretColor: '#475569' }}
                    />
                  </div>
                ))}
              </div>
            </Card>

            {/* Explanation */}
            <Card>
              <SectionTitle icon={ListChecks} iconColor="text-green-400">Step-by-Step Explanation</SectionTitle>
              <Textarea
                rows={5}
                value={chapter.explanation}
                onChange={(e) => onUpdate({ ...chapter, explanation: e.target.value })}
                placeholder="Walk through what you will teach — one step at a time…"
                className="mb-3 resize-none"
                style={{ color: '#0f172a', caretColor: '#0f172a' }}
              />
              <Field label="Attach a file (image, video, PDF…)">
                <Input
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  onChange={(e) => onAddContentFile(e.target.files?.[0] || null, 'Explanation Attachments')}
                  className="cursor-pointer"
                />
              </Field>
            </Card>

            {/* Quick Recap */}
            <Card>
              <SectionTitle icon={CheckCircle2} iconColor="text-green-400">Quick Recap</SectionTitle>
              <Textarea
                rows={3}
                value={chapter.recap}
                onChange={(e) => onUpdate({ ...chapter, recap: e.target.value })}
                placeholder="Key points students must take away from this lesson…"
                className="resize-none"
                style={{ color: '#0f172a', caretColor: '#0f172a' }}
              />
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

            {/* Reference / Worksheet link */}
            <Card>
              <SectionTitle icon={FlaskConical} iconColor="text-purple-500">Worksheet File or Link</SectionTitle>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                  onChange={(e) => onAddWorksheetFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                <Input
                  value={chapter.worksheetLink}
                  onChange={(e) => onUpdate({ ...chapter, worksheetLink: e.target.value })}
                  placeholder="Or paste a worksheet URL…"
                />
              </div>
              {(chapter.worksheetFiles || []).length > 0 && (
                <div className="mt-3 space-y-2">
                  {chapter.worksheetFiles.map((file) => (
                    <FileUploadCard key={file.id} file={file} onRemove={onRemoveWorksheetFile} />
                  ))}
                </div>
              )}
            </Card>

            {/* Report uploads */}
            <Card>
              <SectionTitle icon={FileText} iconColor="text-purple-400">Reports & Additional Files</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <UploadDropzone
                  title="Report Upload"
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

      /* ─── ASSESSMENT ──────────────────────────────────────────── */
      case 'assessment':
        return (
          <div className="space-y-4">
            
            {/* Practice Papers */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle icon={ClipboardList} iconColor="text-rose-500">Practice Papers</SectionTitle>
                
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Basic',        bucket: 'Practice Papers Basic'        },
                  { label: 'Intermediate', bucket: 'Practice Papers Intermediate'  },
                  { label: 'Advanced',     bucket: 'Practice Papers Advanced'      },
                ].map(({ label, bucket }) => (
                  <div key={bucket} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                    <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</p>
                    <UploadDropzone
                      title={label}
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      files={chapter.contentUploads?.[bucket] || []}
                      onAddFile={(file) => onAddContentFile(file, bucket)}
                      onRemoveFile={(fileId) => onRemoveContentFile(fileId, bucket)}
                    />
                  </div>
                ))}
              </div>
            </Card>

            {/* Worksheets */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle icon={FileText} iconColor="text-rose-400">Worksheets</SectionTitle>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  Available in Uploaded Resources
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <UploadDropzone
                  title="Worksheet Files"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                  files={chapter.contentUploads?.['Upload Worksheet'] || []}
                  onAddFile={(file) => onAddContentFile(file, 'Upload Worksheet')}
                  onRemoveFile={(fileId) => onRemoveContentFile(fileId, 'Upload Worksheet')}
                />
                <div className="flex flex-col justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Worksheet Link</p>
                  <Input
                    value={chapter.worksheetLink || ''}
                    onChange={(e) => onUpdate({ ...chapter, worksheetLink: e.target.value })}
                    placeholder="Paste a Google Docs / Drive URL…"
                    className="text-xs"
                    style={{ color: '#0f172a', caretColor: '#0f172a' }}
                  />
                </div>
              </div>
            </Card>

            {/* Structured assessments */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle icon={ClipboardCheck} iconColor="text-rose-400">Structured Assessments</SectionTitle>
                <Button variant="outline" size="sm" onClick={onAddAssessment} className="text-xs">
                  + Add Assessment
                </Button>
              </div>
              {(chapter.assessments || []).length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">No assessments yet — click "Add Assessment" to create one.</p>
              ) : (
                <div className="space-y-2">
                  {chapter.assessments.map((assessment) => (
                    <AssessmentCard
                      key={assessment.id}
                      assessment={assessment}
                      types={assessmentTypes}
                      onChange={(next) => onUpdateAssessment(assessment.id, next)}
                    />
                  ))}
                </div>
              )}
            </Card>

          </div>
        );

      /* ─── LANGUAGE PRACTICE ─────────────────────────────────── */
      case 'language': {
        const subjectName = localStorage.getItem('selectedSubjectName') || '';

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

        const deleteItem = async (id, mode) => {
          if (!confirm('Remove this item?')) return;
          const base = API_BASE;
          const url = mode === 'reading'
            ? `${base}/api/reading-assessment/teacher/materials/${id}`
            : `${base}/api/writing-assessment/teacher/prompts/${id}`;
          await fetch(url, { method: 'DELETE', headers: authHdrs() }).catch(() => {});
          setLangItems((prev) => ({ ...prev, [mode]: prev[mode].filter((x) => x._id !== id) }));
          toast.success('Removed');
        };

        const DIFF_COLORS = {
          easy: 'bg-emerald-100 text-emerald-700',
          medium: 'bg-amber-100 text-amber-700',
          hard: 'bg-red-100 text-red-700',
        };

        const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
        const selectCls = inputCls;

        return (
          <div className="space-y-4">
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${accent.banner}`}>
              Add reading passages students will read aloud, or writing prompts they will respond to. Both are published instantly to the student portal.
            </p>

            {/* Sub-tab toggle */}
            <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60 w-fit">
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
                      className={`${inputCls} resize-y leading-7`}
                      rows={6}
                      placeholder="Paste or type the reading passage here…"
                      value={readingForm.content}
                      onChange={(e) => setReadingForm((f) => ({ ...f, content: e.target.value }))}
                      style={{ fontFamily: 'Georgia, serif' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={saveReading}
                    disabled={langSaving}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {langSaving ? 'Saving…' : <><Plus className="size-4" /> Save & Publish Passage</>}
                  </button>
                </div>

                {/* Existing passages for this chapter */}
                {langItems.reading.length > 0 && (
                  <div className="mt-5 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Saved Passages</p>
                    {langItems.reading.map((item) => (
                      <div key={item._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/40">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                            <span className="capitalize">{item.contentType}</span>
                            <span>·</span>
                            <span>{item.wordCount || 0} words</span>
                            <span className={`rounded-full px-1.5 py-0.5 font-medium ${DIFF_COLORS[item.difficulty] || ''}`}>
                              {item.difficulty}
                            </span>
                            {item.isPublished && <span className="text-emerald-600 font-medium">Published</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteItem(item._id, 'reading')}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
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
                <SectionTitle icon={PenLine} iconColor="text-emerald-500">New Writing Prompt</SectionTitle>
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
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Prompt / Question *</label>
                    <textarea
                      className={`${inputCls} resize-y`}
                      rows={3}
                      placeholder="e.g. Write an essay on global warming and its effects on the environment."
                      value={writingForm.question}
                      onChange={(e) => setWritingForm((f) => ({ ...f, question: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Instructions <span className="font-normal normal-case text-slate-400">(optional)</span></label>
                    <textarea
                      className={`${inputCls} resize-y`}
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

                  <button
                    type="button"
                    onClick={saveWriting}
                    disabled={langSaving}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {langSaving ? 'Saving…' : <><Plus className="size-4" /> Save & Publish Prompt</>}
                  </button>
                </div>

                {/* Existing prompts for this chapter */}
                {langItems.writing.length > 0 && (
                  <div className="mt-5 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Saved Prompts</p>
                    {langItems.writing.map((item) => (
                      <div key={item._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/40">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-400">{item.question}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                            <span className="capitalize">{item.promptType}</span>
                            {item.wordLimit > 0 && <><span>·</span><span>{item.wordLimit} word limit</span></>}
                            <span className={`rounded-full px-1.5 py-0.5 font-medium ${DIFF_COLORS[item.difficulty] || ''}`}>
                              {item.difficulty}
                            </span>
                            {item.isPublished && <span className="text-emerald-600 font-medium">Published</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteItem(item._id, 'writing')}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
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
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${accent.banner}`}>
              Create interactive questions students answer inside the Smart Learning portal.
            </p>
            <InlineTryoutBuilder
              tryouts={chapter.tryouts || []}
              onSaveTryouts={handleSaveTryouts}
              topicTitle={chapter.title || ''}
            />
          </div>
        );

      /* ─── EVALUATE & PUBLISH ──────────────────────────────────── */
      case 'publish':
        return (
          <div className="space-y-4">
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${accent.banner}`}>
              Add private notes, rate the class, then publish this chapter to students.
            </p>

            <Card>
              <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Teacher Notes{' '}
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(private — not shown to students)</span>
              </p>
              <Textarea
                rows={3}
                value={chapter.teacherNotes}
                onChange={(e) => onUpdate({ ...chapter, teacherNotes: e.target.value })}
                placeholder="Personal observations, follow-up actions, reminders…"
                className="resize-none"
                style={{ color: '#0f172a', caretColor: '#0f172a' }}
              />
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

      default:
        return null;
    }
  };

  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.section
          key={chapter.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.18 }}
          className="flex min-w-0 w-full flex-col self-start overflow-hidden rounded-[22px] border border-[#e9edf2] bg-white shadow-[0_25px_50px_-24px_rgba(15,23,42,0.28)] sm:rounded-[28px] lg:h-full lg:min-h-0 dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-[22px] border-b border-[#ebf0f6] bg-[#fafcff] px-3 py-3 sm:rounded-t-[28px] sm:px-5 sm:py-4 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#2563eb]">
                <BookOpen className="size-4" />
              </div>
              <h3 className="truncate text-lg font-semibold tracking-[-0.01em] text-[#0b2b4a] dark:text-white">
              {chapter.title || 'Untitled Chapter'}
              </h3>
              <span className={`hidden rounded-full px-3 py-1 text-[11px] font-medium sm:inline-flex ${isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-[#dbe7fe] text-[#1e4f8a]'}`}>
                {isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={onSaveVersion} className="hidden gap-1 rounded-full border-[#dce2ea] text-xs sm:inline-flex">
                <RefreshCcw className="size-3.5" /> Save Version
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf} className="gap-1 rounded-full border-[#dce2ea] text-xs">
                <FileText className="size-3.5" /> Export PDF
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close chapter" className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Step navigation */}
          <div className="overflow-x-auto border-b border-[#e9edf2] px-3 py-2 sm:px-5 sm:py-3 dark:border-slate-800">
            <div className="flex w-max min-w-full items-center gap-1 rounded-full border border-[#e2e8f0] bg-[#f8fafc] p-1">
              {STEPS.map((step, index) => {
                const isActive = index === currentStep;
                const isDone = index < currentStep;
                const Icon = step.icon;
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => goToStep(index)}
                    aria-current={isActive ? 'step' : undefined}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all ${isActive ? 'bg-[#eef2ff] font-semibold text-[#2563eb] shadow-sm' : isDone ? 'text-emerald-600 hover:bg-emerald-50' : 'text-[#475569] hover:bg-white hover:text-[#1e293b]'}`}
                  >
                    {isDone ? <CheckCircle2 className="size-3.5" /> : <Icon className="size-3.5" />}
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step content */}
          <div className="max-h-none min-w-0 overflow-y-auto bg-white p-3 sm:p-5 lg:min-h-0 lg:flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 dark:bg-slate-900 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-transparent">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
            >
              {renderStep()}
            </motion.div>
          </div>

          {/* Footer navigation */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ebf0f6] px-3 py-3 sm:px-5 sm:py-4 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToStep((s) => Math.max(0, s - 1))}
              disabled={currentStep === 0}
              className="gap-1 rounded-full border-0 bg-[#f1f5f9] text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft className="size-4" /> Back
            </Button>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Step <span className="font-semibold text-slate-600 dark:text-slate-300">{currentStep + 1}</span> / {STEPS.length}
            </span>
            {currentStep < STEPS.length - 1 ? (
              <Button
                size="sm"
                onClick={() => goToStep((s) => s + 1)}
                className="gap-1 rounded-full bg-[#2563eb] px-4 text-white shadow-[0_4px_8px_-4px_rgba(37,99,235,0.3)] hover:bg-blue-700 sm:px-6"
              >
                Next <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onPublishChapter}
                disabled={isPublishing}
                className="gap-1 rounded-full bg-[#059669] px-4 text-white shadow-[0_4px_12px_-4px_rgba(5,150,105,0.4)] hover:bg-emerald-700 disabled:opacity-50 sm:px-6"
              >
                {isPublishing ? (isPublished ? 'Updating...' : 'Publishing...') : <><Send className="size-3.5" /> {isPublished ? 'Update' : 'Publish'}</>}
              </Button>
            )}
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
