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
  Edit3,
  FileText,
  FlaskConical,
  Lightbulb,
  ListChecks,
  Plus,
  Play,
  RefreshCcw,
  Send,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  UserCheck,
  X,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import RichTextEditor from './RichTextEditor';
import UploadDropzone from './UploadDropzone';
import FileUploadCard from './FileUploadCard';
import AssessmentCard from './AssessmentCard';
import TryoutBuilder from './TryoutBuilder';
import RichTextMaterialEditor from '../RichTextMaterialEditor';

const MotionButton = motion.button;
export const DEFAULT_INSTRUCTIONAL_FLOW = [
  { id: 'hook',      phase: 'THE HOOK',       duration: '10', description: 'Introduction & Overview'  },
  { id: 'instruct',  phase: 'INSTRUCTION',     duration: '25', description: 'Core Concepts & Theory'  },
  { id: 'practice',  phase: 'GUIDED PRACTICE', duration: '30', description: 'Practice & Application'  },
  { id: 'synthesis', phase: 'SYNTHESIS',       duration: '15', description: 'Review & Self-Assessment' },
];

const STEPS = [
  { key: 'info',       label: 'Lesson Info',       icon: Calendar,       color: 'blue'    },
  { key: 'intro',      label: 'Introduction',       icon: Lightbulb,      color: 'amber'   },
  { key: 'content',    label: 'Content',            icon: ListChecks,     color: 'green'   },
  { key: 'materials',  label: 'Materials',          icon: BookOpen,       color: 'purple'  },
  { key: 'assessment', label: 'Assessment',         icon: ClipboardList,  color: 'rose'    },
  { key: 'publish',    label: 'Evaluate & Publish', icon: Send,           color: 'emerald' },
];

const EVAL_TAGS = ['Excellent', 'Good', 'Needs Improvement'];

const stepAccent = {
  blue:    { ring: 'ring-blue-500',    text: 'text-blue-700 dark:text-blue-300',     banner: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'     },
  amber:   { ring: 'ring-amber-400',   text: 'text-amber-700 dark:text-amber-300',   banner: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'   },
  green:   { ring: 'ring-green-500',   text: 'text-green-700 dark:text-green-300',   banner: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'   },
  purple:  { ring: 'ring-purple-500',  text: 'text-purple-700 dark:text-purple-300', banner: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' },
  rose:    { ring: 'ring-rose-500',    text: 'text-rose-700 dark:text-rose-300',     banner: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'     },
  emerald: { ring: 'ring-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', banner: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
};

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</label>
    {children}
  </div>
);

const Card = ({ children, className = '' }) => (
  <div className={`rounded-[28px] border border-[#ebf0f6] bg-[#fafcff] p-5 shadow-[0_4px_8px_-4px_rgba(0,0,0,0.04)] dark:border-slate-700 dark:bg-slate-900 ${className}`}>
    {children}
  </div>
);

const SectionTitle = ({ icon, iconColor, children }) => (
  <p className={`mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100`}>
    {React.createElement(icon, { className: `size-4 ${iconColor}` })} {children}
  </p>
);

const DrawerModal = ({
  open,
  chapter,
  durations,
  assessmentTypes,
  classId,
  sectionId,
  subjectId,
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
  const [showTryoutBuilder, setShowTryoutBuilder] = useState(false);
  const [showMaterialUpload, setShowMaterialUpload] = useState(false);

  const goToStep = (nextStep) => {
    setCurrentStep((previous) => {
      const next = typeof nextStep === 'function' ? nextStep(previous) : nextStep;
      onStepChange?.(next);
      return next;
    });
  };

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

  const exportPdf = () => {
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
                    value={chapter.duration}
                    onChange={(e) => onUpdate({ ...chapter, duration: e.target.value })}
                    style={{ colorScheme: 'light', color: '#1e293b', backgroundColor: 'white', borderColor: '#e2e8f0' }}
                    className="h-10 w-full rounded-lg border px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="" disabled>Select duration</option>
                    {(durations || []).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
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
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${accent.banner}`}>
              Define what students will learn, how the lesson flows, and the core explanation.
            </p>

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
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle icon={ListChecks} iconColor="text-green-500">Instructional Flow</SectionTitle>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Suggested breakdown — edit as needed</span>
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
              Upload study materials and reference files that students can access anytime.
            </p>

            {/* Study Materials upload */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle icon={BookOpen} iconColor="text-purple-500">Study Materials</SectionTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenMaterialUpload}
                  className="gap-1 text-xs border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300"
                >
                  <UploadCloud className="size-3.5" /> Upload via Editor
                </Button>
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
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${accent.banner}`}>
              Upload practice papers, worksheets, and create interactive tryout questions for students.
            </p>

            {/* Practice Papers */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle icon={ClipboardList} iconColor="text-rose-500">Practice Papers</SectionTitle>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                  Unlocks at 75% progress
                </span>
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

            {/* Tryout / Interactive Questions */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Play className="size-4 text-rose-500" /> Tryout Section
                </p>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {chapter.tryouts?.length > 0
                    ? `${chapter.tryouts.length} question(s) ready`
                    : 'No tryout questions yet'}
                </span>
              </div>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Create interactive questions students answer inside the Smart Learning portal.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTryoutBuilder(true)}
                className="w-full border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:text-rose-300"
              >
                <Edit3 className="size-3.5 mr-1.5" />
                {chapter.tryouts?.length > 0 ? 'Edit Tryout Questions' : 'Create Tryout Questions'}
              </Button>
            </div>

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

            <TryoutBuilder
              open={showTryoutBuilder}
              onClose={() => setShowTryoutBuilder(false)}
              tryouts={chapter.tryouts || []}
              onSaveTryouts={handleSaveTryouts}
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

            <Card>
              <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <UserCheck className="size-4 text-blue-500" /> Class Evaluation
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: 'participation', label: 'Participation',       placeholder: 'e.g. Very active'               },
                  { key: 'remarks',       label: 'Performance Remarks', placeholder: 'e.g. Understood well'           },
                  { key: 'behaviour',     label: 'Behaviour',           placeholder: 'e.g. Attentive and cooperative' },
                  { key: 'progress',      label: 'Progress',            placeholder: 'e.g. On track'                  },
                ].map(({ key, label, placeholder }) => (
                  <Field key={key} label={label}>
                    <Input
                      value={chapter.evaluation?.[key] || ''}
                      onChange={(e) => onUpdate({ ...chapter, evaluation: { ...chapter.evaluation, [key]: e.target.value } })}
                      placeholder={placeholder}
                      className="h-9 text-sm"
                      style={{ color: '#0f172a', caretColor: '#0f172a' }}
                    />
                  </Field>
                ))}
              </div>
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Overall Rating</p>
                <div className="flex flex-wrap gap-2">
                  {EVAL_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onUpdate({ ...chapter, evaluation: { ...chapter.evaluation, tag } })}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                        chapter.evaluation?.tag === tag
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
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
          className="flex w-full flex-col self-start rounded-[28px] border border-[#e9edf2] bg-white shadow-[0_25px_50px_-24px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-[28px] border-b border-[#ebf0f6] bg-[#fafcff] px-5 py-4 dark:border-slate-800 dark:bg-slate-800/60">
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
            <div className="flex items-center gap-1.5">
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
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[#e9edf2] px-5 py-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-1 rounded-full border border-[#e2e8f0] bg-[#f8fafc] p-1">
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
          <div className="max-h-[52vh] overflow-y-auto bg-white p-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 dark:bg-slate-900 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-transparent">
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
          <div className="flex items-center justify-between border-t border-[#ebf0f6] px-5 py-4 dark:border-slate-800">
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
                className="gap-1 rounded-full bg-[#2563eb] px-6 text-white shadow-[0_4px_8px_-4px_rgba(37,99,235,0.3)] hover:bg-blue-700"
              >
                Next <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onPublishChapter}
                disabled={isPublishing}
                className="gap-1 rounded-full bg-[#059669] px-6 text-white shadow-[0_4px_12px_-4px_rgba(5,150,105,0.4)] hover:bg-emerald-700 disabled:opacity-50"
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
