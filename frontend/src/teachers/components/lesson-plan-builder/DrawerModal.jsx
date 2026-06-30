import React, { useRef, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Calendar, ClipboardCheck, FileText, FlaskConical, Lightbulb, ListChecks, RefreshCcw, Send, Sparkles, UserCheck, X, Play, Edit3, UploadCloud } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import RichTextEditor from './RichTextEditor';
import UploadDropzone from './UploadDropzone';
import FileUploadCard from './FileUploadCard';
import AssessmentCard from './AssessmentCard';
import TryoutBuilder from './TryoutBuilder';

const STEPS = [
  { key: 'info',      label: 'Lesson Info',       icon: Calendar,      color: 'blue'    },
  { key: 'intro',     label: 'Introduction',       icon: Lightbulb,     color: 'amber'   },
  { key: 'content',   label: 'Content',            icon: ListChecks,    color: 'green'   },
  { key: 'materials', label: 'Materials',          icon: FlaskConical,  color: 'purple'  },
  { key: 'publish',   label: 'Evaluate & Publish', icon: Send,          color: 'emerald' },
];

const EVAL_TAGS = ['Excellent', 'Good', 'Needs Improvement'];

const stepAccent = {
  blue:    { ring: 'ring-blue-500',    bg: 'bg-blue-600',    text: 'text-blue-700 dark:text-blue-300',    banner: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'    },
  amber:   { ring: 'ring-amber-400',   bg: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-300',   banner: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'   },
  green:   { ring: 'ring-green-500',   bg: 'bg-green-600',   text: 'text-green-700 dark:text-green-300',   banner: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'   },
  purple:  { ring: 'ring-purple-500',  bg: 'bg-purple-600',  text: 'text-purple-700 dark:text-purple-300',  banner: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'  },
  emerald: { ring: 'ring-emerald-500', bg: 'bg-emerald-600', text: 'text-emerald-700 dark:text-emerald-300', banner: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
};

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</label>
    {children}
  </div>
);

const Card = ({ children, className = '' }) => (
  <div className={`rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${className}`}>
    {children}
  </div>
);

const DrawerModal = ({
  open,
  chapter,
  durations,
  assessmentTypes,
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
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showTryoutBuilder, setShowTryoutBuilder] = useState(false);
  const materialInputRef = useRef(null);

  if (!chapter) return null;

  const handleSaveTryouts = (tryouts) => {
    onUpdate({ ...chapter, tryouts });
  };

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

  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.section
          key={chapter.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col rounded-2xl border-2 border-blue-200 bg-gradient-to-b from-white to-slate-50/80 p-5 shadow-lg dark:border-slate-600 dark:from-slate-900 dark:to-slate-950/80"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 p-3 dark:from-slate-800 dark:to-slate-800">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{chapter.title}</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onSaveVersion}><RefreshCcw className="size-4" /> Save Version</Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}><FileText className="size-4" /> Print</Button>
              <Button variant="outline" size="sm" onClick={exportPdf}><FileText className="size-4" /> Export PDF</Button>
              <Button variant="ghost" size="icon-sm" onClick={onClose}><X className="size-4" /></Button>
            </div>
          </div>
        );

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
                  className="gap-1.5 border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/40"
                >
                  <Sparkles className="size-3.5" /> AI Suggestion
                </Button>
              </div>
              <RichTextEditor
                value={chapter.introductionText || ''}
                onChange={(value) => onUpdate({ ...chapter, introductionText: value })}
                placeholder="How will you hook students into this lesson?"
              />
            </Card>
          </div>
        );

      case 'content':
        return (
          <div className="space-y-4">
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${accent.banner}`}>
              Add a step-by-step explanation and a short recap students can refer to later.
            </p>
            <Card>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <ListChecks className="size-4 text-green-500" /> Step-by-Step Explanation
              </p>
              <Textarea
                rows={6}
                value={chapter.explanation || ''}
                onChange={(e) => onUpdate({ ...chapter, explanation: e.target.value })}
                placeholder="Walk through what you will teach — one step at a time…"
                className="mb-3 resize-none"
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
            <Card>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <ClipboardCheck className="size-4 text-green-400" /> Quick Recap
              </p>
              <Textarea
                rows={3}
                value={chapter.recap || ''}
                onChange={(e) => onUpdate({ ...chapter, recap: e.target.value })}
                placeholder="Key points students must take away from this lesson…"
                className="resize-none"
              />
            </Card>
          </div>
        );

      case 'materials':
        return (
          <div className="space-y-4">
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${accent.banner}`}>
              Upload worksheets, experiments, practice questions, and study materials.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <UploadDropzone title="Worksheet"      accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" files={chapter.contentUploads?.['Upload Worksheet'] || []} onAddFile={onAddContentFile} onRemoveFile={onRemoveContentFile} />
              <UploadDropzone title="Assessments"    accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" files={chapter.contentUploads?.Assessments || []}          onAddFile={onAddContentFile} onRemoveFile={onRemoveContentFile} />
              <UploadDropzone title="Experiments"    accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" files={chapter.contentUploads?.Experiments || []}           onAddFile={onAddContentFile} onRemoveFile={onRemoveContentFile} />
              <UploadDropzone title="Report Upload"  accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" files={chapter.contentUploads?.['Report Upload'] || []}     onAddFile={onAddContentFile} onRemoveFile={onRemoveContentFile} />
            </div>

            <Card>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <FlaskConical className="size-4 text-purple-500" /> Worksheet File or Link
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                  onChange={(e) => onAddWorksheetFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                <Input
                  value={chapter.worksheetLink || ''}
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

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Practice questions */}
              <div className="flex flex-col justify-between rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
                <div className="mb-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <Play className="size-4 text-purple-500" /> Practice Questions
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {chapter.tryouts?.length > 0
                      ? `${chapter.tryouts.length} question(s) created`
                      : 'Add interactive tryout questions for students'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTryoutBuilder(true)}
                  className="w-full border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-950/40"
                >
                  <Edit3 className="size-3.5 mr-1.5" />
                  {chapter.tryouts?.length > 0 ? 'Edit Questions' : 'Create Tryout'}
                </Button>
              </div>

              {/* Share with students */}
              <div className="flex flex-col justify-between rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                <div className="mb-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <UploadCloud className="size-4 text-blue-500" /> Share with Students
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Upload notes or reference files students can access</p>
                </div>

                <UploadDropzone title="Assessments" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" files={chapter.contentUploads?.Assessments || []} onAddFile={onAddContentFile} onRemoveFile={onRemoveContentFile} />
                <UploadDropzone title="Experiments" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" files={chapter.contentUploads?.Experiments || []} onAddFile={onAddContentFile} onRemoveContentFile={onRemoveContentFile} onRemoveFile={onRemoveContentFile} />
                <UploadDropzone title="Report Upload" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" files={chapter.contentUploads?.['Report Upload'] || []} onAddFile={onAddContentFile} onRemoveFile={onRemoveContentFile} />

                {/* Upload Material Section */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Upload Material</p>
                  <div className="rounded-xl border-2 border-dashed border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 text-center dark:from-blue-900/20 dark:to-cyan-900/20">
                    <UploadCloud className="mx-auto mb-2 size-8 text-blue-500" />
                    <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
                      Share study material with students for this chapter
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenMaterialUpload}
                      className="border-blue-300 text-blue-600 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-400"
                    >
                      <UploadCloud className="size-4 mr-2" />
                      Upload Material
                    </Button>
                  </div>
                </div>
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
                value={chapter.teacherNotes || ''}
                onChange={(e) => onUpdate({ ...chapter, teacherNotes: e.target.value })}
                placeholder="Personal observations, follow-up actions, reminders…"
                className="resize-none"
              />
            </Card>

            <Card>
              <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <UserCheck className="size-4 text-blue-500" /> Class Evaluation
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: 'participation', label: 'Participation',       placeholder: 'e.g. Very active'              },
                  { key: 'remarks',       label: 'Performance Remarks', placeholder: 'e.g. Understood well'          },
                  { key: 'behaviour',     label: 'Behaviour',           placeholder: 'e.g. Attentive and cooperative'},
                  { key: 'progress',      label: 'Progress',            placeholder: 'e.g. On track'                 },
                ].map(({ key, label, placeholder }) => (
                  <Field key={key} label={label}>
                    <Input
                      value={chapter.evaluation?.[key] || ''}
                      onChange={(e) => onUpdate({ ...chapter, evaluation: { ...chapter.evaluation, [key]: e.target.value } })}
                      placeholder={placeholder}
                      className="h-9 text-sm"
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

            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/30">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-emerald-900 dark:text-emerald-100">
                    <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" /> Ready to Publish?
                  </h3>
                  <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                    Students will see this chapter in their Smart Learning section.
                  </p>
                </div>
                <Button
                  onClick={onPublishChapter}
                  disabled={isPublishing}
                  className="rounded-xl bg-emerald-600 px-6 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isPublishing ? 'Publishing…' : <><Send className="size-4 mr-2" />Publish Chapter</>}
                </Button>
              </div>
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
        <Motion.section
          key={chapter.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.18 }}
          className="flex flex-col self-start w-full rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border-b border-slate-100 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-800/60">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {chapter.title || 'Untitled Chapter'}
            </h3>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={onSaveVersion} className="gap-1 text-xs">
                <RefreshCcw className="size-3.5" /> Save Version
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf} className="gap-1 text-xs">
                <FileText className="size-3.5" /> Export PDF
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close chapter" className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Step progress bar */}
          <div className="px-5 pt-4 pb-1">
            <div className="relative flex items-center justify-between">
              {/* connector line */}
              <div className="absolute inset-x-0 top-4 h-0.5 bg-slate-200 dark:bg-slate-700 ml-10 mr-10" />
              <div
                className="absolute top-4 left-0 h-0.5 bg-blue-500 transition-all duration-300 ml-5"
                style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
              />
              {STEPS.map((step, index) => {
                const isActive = index === currentStep;
                const isDone   = index < currentStep;
                const Icon     = step.icon;
                const ac       = stepAccent[step.color];
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    className="relative z-10 flex flex-col items-center gap-1.5 group"
                  >
                    <span
                      className={`flex size-8 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                        isDone
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : isActive
                            ? `${ac.ring} ring-2 ring-offset-1 border-blue-500 bg-blue-600 text-white dark:ring-offset-slate-900`
                            : 'border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <Icon className="size-3.5" />
                      )}
                    </span>
                    <span
                      className={`hidden text-[11px] font-semibold sm:block transition-colors ${
                        isActive
                          ? ac.text
                          : isDone
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step content */}
          <div className="max-h-[52vh] overflow-y-auto p-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-transparent">
            <Motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
            >
              {renderStep()}
            </Motion.div>
          </div>

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
        </motion.section>
      )}
    </AnimatePresence>
  );
};

export default DrawerModal;
