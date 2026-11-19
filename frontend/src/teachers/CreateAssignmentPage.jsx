import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, CalendarDays, Check, CheckSquare, ClipboardList, Clock, Eye, FileText, Info, LayoutGrid,
  ListChecks, Loader2, Paperclip, PenLine, RotateCcw, Save, Send, Star, Trophy, Type, UploadCloud, X, Zap,
} from 'lucide-react';
import PracticeQuestions from './PracticeQuestions';
import TryoutManagement from '../components/TryoutManagement';
import QuizBuilder, { blankSection, quizTotalMarks } from './QuizBuilder';

import SimpleMcqEditor from './SimpleMcqEditor';
import SimpleBlankEditor from './SimpleBlankEditor';

const MCQ_TYPES = ['mcq_single'];

// Activity cards (same order / look as the design)
const TYPES = [
  { key: 'assignment', label: 'Assignment', hint: 'Text or PDF work', icon: FileText, tone: 'text-blue-600', bg: 'bg-blue-50/60', type: 'Assignment' },
  { key: 'worksheet', label: 'Worksheet', hint: 'Structured practice', icon: ClipboardList, tone: 'text-violet-600', bg: 'bg-violet-50/60', type: 'Worksheet' },
  { key: 'writing', label: 'Writing', hint: 'Essay response', icon: PenLine, tone: 'text-emerald-600', bg: 'bg-emerald-50/60', type: 'Essay' },
  { key: 'mcq', label: 'MCQ', hint: 'Multiple choice', icon: CheckSquare, tone: 'text-orange-500', bg: 'bg-orange-50/70', type: 'Quiz' },
  { key: 'blank', label: 'Fill in Blank', hint: 'Answer completion', icon: Type, tone: 'text-teal-600', bg: 'bg-teal-50/60', type: 'Quiz' },
];
// These use their own builders instead of the assignment form.
const EXTERNAL = new Set(['tryout']);

const LABEL = 'mb-1 block text-[11.5px] font-semibold text-slate-700';
const OPT = 'font-normal text-slate-400';
const INPUT = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
const Req = () => <span className="text-red-500">*</span>;

// A lesson plan doc is one lesson; its textbook chapter ("Chapter 1 · Computer
// Basics") lives on the planner chapter (same as the Lesson Plan builder).
const lessonMeta = (plan) => {
  const ch = plan?.plannerContent?.chapters?.[0] || {};
  const unitNumber = Number(ch.unitNumber ?? plan?.unitNumber) > 0 ? Number(ch.unitNumber ?? plan?.unitNumber) : null;
  const unitTitle = String(ch.unitTitle ?? plan?.unitTitle ?? '').trim();
  const key = unitNumber || unitTitle ? `${unitNumber || ''}|${unitTitle.toLowerCase()}` : '__none__';
  const label = unitNumber && unitTitle ? `Chapter ${unitNumber} – ${unitTitle}` : unitNumber ? `Chapter ${unitNumber}` : unitTitle || 'Other lessons';
  return { key, label, unitNumber, unitTitle, lessonTitle: String(ch.title || plan?.title || 'Untitled lesson').trim(), chapterId: String(ch.id || '') };
};

// On/off switch
const Toggle = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`flex h-9 items-center gap-2 text-[12px] font-semibold ${checked ? 'text-blue-700' : 'text-slate-500'}`}
  >
    <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}>
      <span className={`absolute size-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </span>
    {checked ? 'Allowed' : 'Not allowed'}
  </button>
);

const IconInput = ({ icon: Icon, children }) => (
  <div className="relative">
    <Icon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
    {children}
  </div>
);

const CreateAssignmentPage = ({
  onBack,
  newAssignment,
  setNewAssignment,
  handleCreate,
  loading,
  error,
  uploadingPdf,
  handlePdfUpload,
  removePdfAttachment,
  availableLessonPlans = [],
  availableLessonPlanChapters = [],
  workspaceClass,
  defaultSubject = '',
}) => {
  const [kind, setKind] = useState(() => {
    const t = String(newAssignment.type || '').toLowerCase();
    if (t === 'worksheet') return 'worksheet';
    if (t === 'essay') return 'writing';
    if (t === 'quiz') {
      const secs = newAssignment.quizSections || [];
      if (secs.length && secs.every((sec) => MCQ_TYPES.includes(sec.type))) return 'mcq';
      if (secs.length && secs.every((sec) => sec.type === 'fill_blank')) return 'blank';
      return 'quiz';
    }
    return 'assignment';
  });
  const formRef = useRef(null);
  const units = useMemo(() => {
    const map = new Map();
    availableLessonPlans.forEach((plan) => {
      const m = lessonMeta(plan);
      if (!map.has(m.key)) map.set(m.key, { ...m, lessons: [] });
      map.get(m.key).lessons.push({ plan, ...m });
    });
    return [...map.values()].sort((a, b) => {
      if (a.key === '__none__') return 1;
      if (b.key === '__none__') return -1;
      return (a.unitNumber || 9999) - (b.unitNumber || 9999) || a.unitTitle.localeCompare(b.unitTitle);
    });
  }, [availableLessonPlans]);
  const selectedPlan = availableLessonPlans.find((p) => String(p._id) === String(newAssignment.sourceLessonPlanId));
  const [unitKey, setUnitKey] = useState(() => (selectedPlan ? lessonMeta(selectedPlan).key : ''));
  const unitLessons = units.find((u) => u.key === unitKey)?.lessons || [];
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  // Session, class, section and subject come from the class workspace.
  useEffect(() => {
    setNewAssignment((prev) => ({
      ...prev,
      classId: prev.classId || (workspaceClass ? String(workspaceClass.classId) : ''),
      sectionId: prev.sectionId || (workspaceClass ? String(workspaceClass.sectionId) : ''),
      subject: prev.subject || defaultSubject || workspaceClass?.subjects?.[0]?.name || '',
    }));
  }, [workspaceClass, defaultSubject, setNewAssignment]);

  const pickKind = (key) => {
    setKind(key);
    const def = TYPES.find((t) => t.key === key);
    if (def?.type) {
      setNewAssignment((prev) => ({
        ...prev,
        type: def.type,
        isEssay: key === 'writing',
        // Worksheet: teacher uploads the sheet, students upload it back filled in.
        submissionFormat: key === 'worksheet' ? 'pdf' : 'text',
        ...(key === 'assignment' || key === 'worksheet' ? { timeLimit: '' } : {}),
        // MCQ = an auto-graded quiz with multiple-choice sections only.
        ...(key === 'blank' ? (() => {
          const kept = (prev.quizSections || []).filter((sec) => sec.type === 'fill_blank');
          return { quizSections: kept.length ? kept : [blankSection('fill_blank')], attachments: [] };
        })() : {}),
        ...(key === 'mcq' ? (() => {
          const kept = (prev.quizSections || []).filter((sec) => MCQ_TYPES.includes(sec.type));
          return { quizSections: kept.length ? kept : [blankSection('mcq_single')], attachments: [] };
        })() : {}),
      }));
    }
  };

  const set = (patch) => setNewAssignment((prev) => ({ ...prev, ...patch }));
  const today = new Date().toISOString().slice(0, 10);
  const descLen = String(newAssignment.description || '').length;

  const isWorksheet = kind === 'worksheet';
  const isWriting = kind === 'writing';
  const isMcq = kind === 'mcq';
  const isBlank = kind === 'blank';
  // MCQ and Fill in Blank: auto-marked online tests (no files, optional instructions).
  const isAutoTest = isMcq || isBlank;
  const isQuizLike = kind === 'quiz' || isAutoTest;
  const noTimeLimit = kind === 'assignment' || isWorksheet || isWriting;
  // Writing: word range is folded into the prompt students see.
  const [wordMin, setWordMin] = useState('');
  const [wordMax, setWordMax] = useState('');
  const wordLine = () => {
    const lo = Number(wordMin) > 0 ? Number(wordMin) : null;
    const hi = Number(wordMax) > 0 ? Number(wordMax) : null;
    if (lo && hi) return `Word limit: ${lo}–${hi} words`;
    if (hi) return `Word limit: up to ${hi} words`;
    if (lo) return `Word limit: at least ${lo} words`;
    return '';
  };
  const [localError, setLocalError] = useState('');
  const submit = (status) => {
    setLocalError('');
    if (isWorksheet && !(newAssignment.attachments || []).length) {
      setLocalError('Upload the worksheet file before saving.');
      return;
    }
    if (isWriting && Number(wordMin) > 0 && Number(wordMax) > 0 && Number(wordMin) > Number(wordMax)) {
      setLocalError('Minimum words cannot be more than maximum words.');
      return;
    }
    setNewAssignment((prev) => {
      const next = { ...prev, status, ...(isWorksheet ? { submissionFormat: 'pdf' } : {}) };
      if (isWriting) {
        const base = String(prev.description || '').replace(/\n*Word limit:.*$/i, '').trimEnd();
        const line = wordLine();
        next.description = line ? `${base}\n\n${line}` : base;
        next.isEssay = true;
        next.submissionFormat = 'text';
        next.type = 'Essay';
      }
      return next;
    });
    // let state settle, then submit through the existing create handler
    setTimeout(() => formRef.current?.requestSubmit(), 0);
  };

  const reset = () => { setUnitKey(''); setWordMin(''); setWordMax(''); setNewAssignment((prev) => ({
    ...prev,
    title: '', description: '', dueDate: '', publishDate: '', marks: 100, timeLimit: '', difficulty: 'Medium',
    lateSubmissions: false, groups: '', attachments: [], sourceLessonPlanId: '', chapterId: '', chapterTitle: '', topicTitle: '', subTopicTitle: '', quizSections: [],
  })); };

  const onFiles = (files) => {
    const file = files?.[0];
    if (file) handlePdfUpload({ target: { files: [file], value: '' } });
  };

  const classLine = [
    workspaceClass ? `Class ${workspaceClass.className} - Section ${workspaceClass.sectionName}` : '',
    newAssignment.subject,
  ].filter(Boolean).join(' · ');

  // Lock page scroll while the full-page form is open; Esc closes it.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onBack?.(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onBack]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex h-dvh w-screen flex-col bg-slate-100">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
        <button type="button" onClick={onBack} aria-label="Back to assignments" className="flex size-8 items-center justify-center rounded-full text-blue-600 hover:bg-blue-50"><ArrowLeft className="size-4.5" /></button>
        <div className="min-w-0">
          <h1 className="text-[16px] font-bold text-slate-900">Create New Assignment</h1>
          <p className="truncate text-[11.5px] text-slate-500">Design and assign activities to your students{classLine ? ` · ${classLine}` : ''}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-[1280px] space-y-3 px-4 py-3 sm:px-6">
        {/* Activity type */}
        <div>
          <p className="mb-2 flex items-center gap-2 text-[13px] font-bold text-slate-900"><LayoutGrid className="size-4 text-blue-600" /> Choose Activity Type</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {TYPES.map((t) => {
              const active = kind === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => pickKind(t.key)}
                  className={`relative flex flex-col items-center rounded-xl border px-2 py-2.5 text-center transition hover:-translate-y-0.5 hover:shadow-sm ${active ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-200' : `border-slate-200 ${t.bg}`}`}
                >
                  {active && <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-blue-600 text-white"><Check className="size-2.5" /></span>}
                  <t.icon className={`size-5 ${t.tone}`} />
                  <span className={`mt-1 text-[12px] font-bold ${active ? 'text-blue-700' : 'text-slate-800'}`}>{t.label}</span>
                  <span className="text-[10.5px] leading-tight text-slate-500">{t.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {EXTERNAL.has(kind) ? (
          <div className="min-h-[480px] overflow-auto rounded-xl border border-slate-200 bg-white">
            {kind === 'tryout' ? <TryoutManagement /> : <PracticeQuestions key={kind} initialType={kind} />}
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleCreate} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {/* row 1 */}
            <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div>
                <label className={LABEL}>Assignment Title <Req /></label>
                <input required value={newAssignment.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Mathematics Practice Worksheet" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Due Date <Req /></label>
                <IconInput icon={CalendarDays}><input required type="date" min={today} value={newAssignment.dueDate || ''} onChange={(e) => set({ dueDate: e.target.value })} className={`${INPUT} pl-8`} /></IconInput>
              </div>
            </div>

            {/* row 2 */}
            <div className={`grid gap-3 ${isWriting ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_auto_auto]' : noTimeLimit ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_auto]' : 'md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_auto]'}`}>
              <div>
                <label className={LABEL}>Chapter</label>
                <select
                  value={unitKey}
                  onChange={(e) => { setUnitKey(e.target.value); set({ sourceLessonPlanId: '', chapterId: '', chapterTitle: '', topicTitle: '', subTopicTitle: '' }); }}
                  disabled={!units.length}
                  className={`${INPUT} disabled:bg-slate-50 disabled:text-slate-400`}
                >
                  <option value="">{units.length ? 'Select chapter' : 'No published lessons yet'}</option>
                  {units.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Topic</label>
                <select
                  value={newAssignment.sourceLessonPlanId || ''}
                  onChange={(e) => {
                    const lesson = unitLessons.find((l) => String(l.plan._id) === e.target.value);
                    set({
                      sourceLessonPlanId: e.target.value,
                      chapterId: lesson?.chapterId || '',
                      chapterTitle: lesson ? lesson.label : '',
                      topicTitle: lesson?.lessonTitle || '',
                      topic: lesson?.lessonTitle || '',
                      subTopicTitle: '',
                    });
                  }}
                  disabled={!unitKey || !unitLessons.length}
                  className={`${INPUT} disabled:bg-slate-50 disabled:text-slate-400`}
                >
                  <option value="">{unitKey ? 'Select lesson' : 'Select chapter first'}</option>
                  {unitLessons.map((l) => <option key={String(l.plan._id)} value={String(l.plan._id)}>{l.lessonTitle}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Total Marks <Req /></label>
                <IconInput icon={Star}>
                  <input
                    required
                    type="number"
                    min={1}
                    value={isQuizLike ? quizTotalMarks(newAssignment.quizSections || []) || newAssignment.marks : newAssignment.marks}
                    readOnly={isQuizLike}
                    title={isQuizLike ? 'Worked out from the questions' : undefined}
                    onChange={(e) => set({ marks: e.target.value })}
                    className={`${INPUT} pl-8`}
                  />
                </IconInput>
              </div>
              {isWriting && (
              <div>
                <label className={LABEL}>Word Limit <span className={OPT}>(Optional)</span></label>
                <div className="flex items-center gap-1.5">
                  <input type="number" min={1} value={wordMin} onChange={(e) => setWordMin(e.target.value)} placeholder="Min" aria-label="Minimum words" className={`${INPUT} w-[72px]`} />
                  <span className="text-[11px] text-slate-400">–</span>
                  <input type="number" min={1} value={wordMax} onChange={(e) => setWordMax(e.target.value)} placeholder="Max" aria-label="Maximum words" className={`${INPUT} w-[72px]`} />
                </div>
              </div>
              )}
              {!noTimeLimit && (
              <div>
                <label className={LABEL}>Time Limit <span className={OPT}>(minutes) (Optional)</span></label>
                <IconInput icon={Clock}><input type="number" min={1} value={newAssignment.timeLimit || ''} onChange={(e) => set({ timeLimit: e.target.value })} placeholder="e.g. 15" className={`${INPUT} pl-8`} /></IconInput>
              </div>
              )}
              <div>
                <label className={`${LABEL} flex items-center gap-1`} title="Allow students to submit after the due date">Late Submissions <Info className="size-3 text-slate-400" /></label>
                <Toggle checked={Boolean(newAssignment.lateSubmissions)} onChange={(v) => set({ lateSubmissions: v })} label="Allow late submissions" />
              </div>
            </div>

            {isBlank && (
              <div className="rounded-xl border border-teal-100 bg-teal-50/30 p-3">
                <SimpleBlankEditor
                  sections={newAssignment.quizSections || []}
                  onChange={(quizSections) => set({ quizSections, marks: quizTotalMarks(quizSections) || newAssignment.marks })}
                />
              </div>
            )}
            {isMcq && (
              <div className="rounded-xl border border-orange-100 bg-orange-50/30 p-3">
                <SimpleMcqEditor
                  sections={newAssignment.quizSections || []}
                  onChange={(quizSections) => set({ quizSections, marks: quizTotalMarks(quizSections) || newAssignment.marks })}
                />
              </div>
            )}
            {kind === 'quiz' && (
              <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3">
                <QuizBuilder
                  sections={newAssignment.quizSections || []}
                  onChange={(quizSections) => set({ quizSections, marks: quizTotalMarks(quizSections) || newAssignment.marks })}
                />
              </div>
            )}

            {/* row 4 */}
            <div className={`grid gap-3 ${isAutoTest ? '' : 'md:grid-cols-2'}`}>
              <div>
                <label className={`${LABEL} flex items-center gap-1.5`}><FileText className="size-3.5 text-blue-600" /> {isWriting ? 'Writing Prompt' : 'Instructions / Description'} {isWorksheet || isAutoTest ? <span className={OPT}>(Optional)</span> : <Req />}</label>
                <div className="relative">
                  <textarea
                    required={!isWorksheet && !isAutoTest}
                    rows={isAutoTest ? 2 : 4}
                    maxLength={1000}
                    value={newAssignment.description || ''}
                    onChange={(e) => set({ description: e.target.value })}
                    placeholder={isWorksheet ? 'e.g. Print the worksheet, solve all questions and upload a clear scan/photo as PDF.' : isWriting ? 'e.g. Write an essay on "My Favourite Festival". Describe how it is celebrated and why you like it.' : 'Enter clear instructions for students...'}
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="absolute bottom-2 right-3 text-[10.5px] text-slate-400">{descLen} / 1000</span>
                </div>
              </div>
              {isAutoTest ? null : isWriting ? (
              <div>
                <label className={`${LABEL} flex items-center gap-1.5`}><ListChecks className="size-3.5 text-blue-600" /> Grading Rubric <span className={OPT}>(Optional · enables AI evaluation)</span></label>
                <textarea
                  rows={4}
                  maxLength={1000}
                  value={newAssignment.rubric || ''}
                  onChange={(e) => set({ rubric: e.target.value })}
                  placeholder={'e.g.\nContent & ideas – 4\nOrganisation – 3\nGrammar & spelling – 2\nVocabulary – 1'}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              ) : (
              <div>
                <label className={`${LABEL} flex items-center gap-1.5`}><Paperclip className="size-3.5 text-blue-600" /> {isWorksheet ? <>Worksheet File <Req /></> : <>Attachments <span className={OPT}>(Optional)</span></>}</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
                  onClick={() => fileRef.current?.click()}
                  className={`flex min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-3 text-center transition ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-blue-200 bg-slate-50/50 hover:bg-blue-50/40'}`}
                >
                  {uploadingPdf ? <Loader2 className="size-5 animate-spin text-blue-600" /> : <UploadCloud className="size-5 text-blue-600" />}
                  <p className="mt-1 text-[12px] font-medium text-slate-700">{uploadingPdf ? 'Uploading…' : isWorksheet ? 'Upload the worksheet students will solve' : 'Drop files here or click to browse'}</p>
                  <p className="text-[10.5px] text-slate-500">PDF or DOCX — up to 20 MB each</p>
                  <span className="mt-1.5 rounded-md border border-blue-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">Select File</span>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
                </div>
                {(newAssignment.attachments || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {newAssignment.attachments.map((f, i) => (
                      <span key={`${f.url}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                        <FileText className="size-3 text-blue-600" /><span className="max-w-[160px] truncate">{f.name}</span>
                        <button type="button" onClick={() => removePdfAttachment(i)} aria-label={`Remove ${f.name}`} className="text-slate-400 hover:text-red-600"><X className="size-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              )}
            </div>

            {isBlank && (
              <p className="flex items-center gap-2 rounded-lg border border-teal-100 bg-teal-50/70 px-3 py-2 text-[11.5px] text-teal-800">
                <Info className="size-3.5 shrink-0" /> Students type the missing word online and are marked automatically. Capital letters and extra spaces are ignored — add other spellings under “Also accept”.
              </p>
            )}
            {isMcq && (
              <p className="flex items-center gap-2 rounded-lg border border-orange-100 bg-orange-50/70 px-3 py-2 text-[11.5px] text-orange-800">
                <Info className="size-3.5 shrink-0" /> Students answer online and are marked automatically. Total marks are worked out from the questions.
              </p>
            )}
            {isWriting && (
              <p className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-[11.5px] text-emerald-800">
                <Info className="size-3.5 shrink-0" /> Students will type their answer online. With a rubric, AI suggests a score you can review before saving.
              </p>
            )}
            {isWorksheet && (
              <p className="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50/70 px-3 py-2 text-[11.5px] text-violet-800">
                <Info className="size-3.5 shrink-0" /> Students will download this worksheet, fill it in and upload their completed sheet (PDF) before the due date.
              </p>
            )}
            {(localError || error) && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11.5px] font-medium text-red-600">{localError || error}</p>}

          </form>
        )}
      </div>
      </div>

      {/* Footer — full width, like the header */}
      {!EXTERNAL.has(kind) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-200/80 bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6">
          <Eye className="size-4 text-blue-600" />
          <div className="mr-auto leading-tight">
            <p className="text-[12.5px] font-bold text-slate-900">Review &amp; Publish</p>
            <p className="text-[11px] text-slate-500">Check your details before publishing.</p>
          </div>
          <button type="button" onClick={reset} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"><RotateCcw className="size-3.5" /> Reset</button>
          <button type="button" disabled={loading} onClick={() => submit('draft')} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 text-[12px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"><Save className="size-3.5" /> Save as Draft</button>
          <button type="button" onClick={onBack} className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" disabled={loading} onClick={() => submit('active')} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Publish Now
          </button>
        </div>
      )}
    </div>,
    document.body
  );
};

export default CreateAssignmentPage;
