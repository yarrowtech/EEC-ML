import React, { useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Edit3,
  FileText,
  FlaskConical,
  Lightbulb,
  ListChecks,
  Play,
  RefreshCcw,
  Send,
  Sparkles,
  UploadCloud,
  UserCheck,
  X,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import RichTextEditor from './RichTextEditor';
import UploadDropzone from './UploadDropzone';
import FileUploadCard from './FileUploadCard';
import AssessmentCard from './AssessmentCard';
import TryoutBuilder from './TryoutBuilder';
import RichTextMaterialEditor from '../RichTextMaterialEditor';

const STEPS = [
  { key: 'info',       label: 'Lesson Info',    icon: Calendar },
  { key: 'intro',      label: 'Introduction',   icon: Lightbulb },
  { key: 'content',    label: 'Content',        icon: ListChecks },
  { key: 'materials',  label: 'Materials',      icon: FlaskConical },
  { key: 'publish',    label: 'Evaluate & Publish', icon: Send },
];

const EVAL_TAGS = ['Excellent', 'Good', 'Needs Improvement'];

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
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showTryoutBuilder, setShowTryoutBuilder] = useState(false);
  const [showMaterialUpload, setShowMaterialUpload] = useState(false);

  if (!chapter) return null;

  const dayLabel = chapter.lessonDate
    ? new Date(chapter.lessonDate).toLocaleDateString('en-US', { weekday: 'long' })
    : '';

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

      case 'info':
        return (
          <div className="space-y-4">
            <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              Set the date and duration for this lesson.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Calendar className="size-3.5" /> Lesson Date
                </label>
                <Input
                  type="date"
                  value={chapter.lessonDate || ''}
                  onChange={(e) => onUpdate({ ...chapter, lessonDate: e.target.value })}
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Day of Week</label>
                <Input
                  value={dayLabel || 'Auto-filled from date'}
                  readOnly
                  className="bg-slate-50 text-slate-500 dark:bg-slate-800"
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Duration</label>
                <select
                  value={chapter.duration}
                  onChange={(e) => onUpdate({ ...chapter, duration: e.target.value })}
                  style={{ colorScheme: 'light' }}
                  className="h-10 w-full rounded-lg border border-input bg-white px-2.5 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                >
                  {(durations || []).map((d) => <option key={d} value={d} className="text-slate-900">{d}</option>)}
                </select>
              </div>
            </div>
          </div>
        );

      case 'intro':
        return (
          <div className="space-y-4">
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Write a short introduction. Use AI to get a quick suggestion.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
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
                value={chapter.introductionText || ''}
                onChange={(value) => onUpdate({ ...chapter, introductionText: value })}
                placeholder="How will you introduce this lesson to your students?"
              />
            </div>
          </div>
        );

      case 'content':
        return (
          <div className="space-y-4">
            <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
              Add your step-by-step explanation and a quick recap for students.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                <ListChecks className="size-4 text-green-500" /> Step-by-Step Explanation
              </p>
              <Textarea
                rows={6}
                value={chapter.explanation || ''}
                onChange={(e) => onUpdate({ ...chapter, explanation: e.target.value })}
                placeholder="Write what you will teach — step by step..."
                className="mb-3"
              />
              <label className="mb-1 block text-xs font-medium text-slate-500">Attach a file (image, video, PDF…)</label>
              <Input
                type="file"
                accept="image/*,video/*,.pdf,.doc,.docx"
                onChange={(e) => onAddContentFile(e.target.files?.[0] || null, 'Explanation Attachments')}
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                <ClipboardCheck className="size-4 text-slate-500" /> Quick Recap
              </p>
              <Textarea
                rows={3}
                value={chapter.recap || ''}
                onChange={(e) => onUpdate({ ...chapter, recap: e.target.value })}
                placeholder="Key points students should remember from this lesson..."
              />
            </div>
          </div>
        );

      case 'materials':
        return (
          <div className="space-y-4">
            <p className="rounded-xl bg-purple-50 px-3 py-2 text-sm text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
              Upload worksheets, experiments, and create practice questions for students.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <UploadDropzone
                title="Upload Worksheet"
                accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                files={chapter.contentUploads?.['Upload Worksheet'] || []}
                onAddFile={onAddContentFile}
                onRemoveFile={onRemoveContentFile}
              />
              <UploadDropzone
                title="Assessments"
                accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                files={chapter.contentUploads?.Assessments || []}
                onAddFile={onAddContentFile}
                onRemoveFile={onRemoveContentFile}
              />
              <UploadDropzone
                title="Experiments"
                accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                files={chapter.contentUploads?.Experiments || []}
                onAddFile={onAddContentFile}
                onRemoveFile={onRemoveContentFile}
              />
              <UploadDropzone
                title="Report Upload"
                accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                files={chapter.contentUploads?.['Report Upload'] || []}
                onAddFile={onAddContentFile}
                onRemoveFile={onRemoveContentFile}
              />
            </div>

            {/* Worksheet link */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                <FlaskConical className="size-4 text-purple-500" /> Link or Upload a Worksheet
              </p>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                  onChange={(e) => onAddWorksheetFile(e.target.files?.[0] || null)}
                />
                <Input
                  value={chapter.worksheetLink || ''}
                  onChange={(e) => onUpdate({ ...chapter, worksheetLink: e.target.value })}
                  placeholder="Or paste a worksheet link..."
                />
              </div>
              <div className="mt-2 space-y-2">
                {(chapter.worksheetFiles || []).map((file) => (
                  <FileUploadCard key={file.id} file={file} onRemove={onRemoveWorksheetFile} />
                ))}
              </div>
            </div>

            {/* Tryout questions */}
            <div className="flex items-center justify-between rounded-2xl border border-purple-200 bg-purple-50/60 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                  <Play className="size-4 text-purple-500" /> Interactive Practice Questions
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {chapter.tryouts?.length > 0
                    ? `${chapter.tryouts.length} question(s) created`
                    : 'Create tryout questions students can answer'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTryoutBuilder(true)}
                className="shrink-0 border-purple-300 text-purple-600 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-400"
              >
                <Edit3 className="size-3.5 mr-1.5" />
                {chapter.tryouts?.length > 0 ? 'Edit Questions' : 'Create Tryout'}
              </Button>
            </div>

            {/* Share material with students */}
            <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                  <UploadCloud className="size-4 text-blue-500" /> Share Study Material with Students
                </p>
                <p className="mt-0.5 text-xs text-slate-500">Upload notes or reference files students can access</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenMaterialUpload}
                className="shrink-0 border-blue-300 text-blue-600 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-400"
              >
                <UploadCloud className="size-3.5 mr-1.5" /> Upload
              </Button>
            </div>

            {/* Assessments list */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Assessments</p>
                <Button variant="outline" size="sm" onClick={onAddAssessment}>+ Add Assessment</Button>
              </div>
              {(chapter.assessments || []).length === 0 ? (
                <p className="text-sm text-slate-400">No assessments yet. Click "Add Assessment" to create one.</p>
              ) : (
                <div className="space-y-2">
                  {(chapter.assessments || []).map((assessment) => (
                    <AssessmentCard
                      key={assessment.id}
                      assessment={assessment}
                      types={assessmentTypes}
                      onChange={(next) => onUpdateAssessment(assessment.id, next)}
                    />
                  ))}
                </div>
              )}
            </div>

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
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              Rate your class, add private notes, then publish this chapter to students.
            </p>

            {/* Teacher notes */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                Teacher Notes <span className="text-xs font-normal text-slate-400">(private, not shown to students)</span>
              </p>
              <Textarea
                rows={2}
                value={chapter.teacherNotes || ''}
                onChange={(e) => onUpdate({ ...chapter, teacherNotes: e.target.value })}
                placeholder="Add private notes for yourself..."
              />
            </div>

            {/* Student evaluation */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                <UserCheck className="size-4 text-blue-500" /> Evaluate Your Students
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Participation</label>
                  <Input
                    value={chapter.evaluation?.participation || ''}
                    onChange={(e) => onUpdate({ ...chapter, evaluation: { ...chapter.evaluation, participation: e.target.value } })}
                    placeholder="e.g. Very active"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Performance Remarks</label>
                  <Input
                    value={chapter.evaluation?.remarks || ''}
                    onChange={(e) => onUpdate({ ...chapter, evaluation: { ...chapter.evaluation, remarks: e.target.value } })}
                    placeholder="e.g. Understood well"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Behaviour</label>
                  <Input
                    value={chapter.evaluation?.behaviour || ''}
                    onChange={(e) => onUpdate({ ...chapter, evaluation: { ...chapter.evaluation, behaviour: e.target.value } })}
                    placeholder="e.g. Attentive and cooperative"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Progress</label>
                  <Input
                    value={chapter.evaluation?.progress || ''}
                    onChange={(e) => onUpdate({ ...chapter, evaluation: { ...chapter.evaluation, progress: e.target.value } })}
                    placeholder="e.g. On track"
                  />
                </div>
              </div>
              <div className="mt-3">
                <p className="mb-2 text-xs font-medium text-slate-500">Overall Rating</p>
                <div className="flex flex-wrap gap-2">
                  {EVAL_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onUpdate({ ...chapter, evaluation: { ...chapter.evaluation, tag } })}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                        chapter.evaluation?.tag === tag
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Version history */}
            {!!chapter.history?.length && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-100">Saved Versions</p>
                <div className="space-y-2">
                  {chapter.history.slice(-5).reverse().map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-2 text-xs dark:border-slate-700">
                      <span>{item.label}</span>
                      <Button size="xs" variant="outline" onClick={() => onRestoreVersion(item.id)}>Restore</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Publish */}
            <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 dark:border-emerald-700 dark:from-emerald-900/30 dark:to-teal-900/30">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-emerald-900 dark:text-emerald-100">
                    <CheckCircle2 className="size-5" /> Ready to Publish?
                  </h3>
                  <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                    Students will see this chapter in their Smart Learning section.
                  </p>
                </div>
                <Button
                  onClick={onPublishChapter}
                  disabled={isPublishing}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 font-bold text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
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
          className="flex flex-col rounded-2xl border-2 border-blue-200 bg-gradient-to-b from-white to-slate-50/80 shadow-lg dark:border-slate-600 dark:from-slate-900 dark:to-slate-950/80"
        >
          {/* Chapter header */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl bg-gradient-to-r from-blue-50 to-purple-50 px-5 py-3 dark:from-slate-800 dark:to-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{chapter.title}</h3>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={onSaveVersion} className="gap-1">
                <RefreshCcw className="size-3.5" /> Save Version
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf} className="gap-1">
                <FileText className="size-3.5" /> PDF
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close chapter">
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Step tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 bg-white px-4 pt-3 dark:border-slate-800 dark:bg-slate-900">
            {STEPS.map((step, index) => {
              const isActive = index === currentStep;
              const isPast = index < currentStep;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 pb-2 text-xs font-semibold transition ${
                    isActive
                      ? 'border-blue-600 text-blue-700 dark:text-blue-300'
                      : isPast
                      ? 'border-transparent text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  {isPast ? (
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                  ) : (
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {index + 1}
                    </span>
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              );
            })}
          </div>

          {/* Step content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-200 hover:[&::-webkit-scrollbar-thumb]:bg-blue-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent">
            <Motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
            >
              {renderStep()}
            </Motion.div>
          </div>

          {/* Navigation footer */}
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ChevronLeft className="size-4" /> Back
            </Button>
            <span className="text-xs text-slate-400">Step {currentStep + 1} of {STEPS.length}</span>
            {currentStep < STEPS.length - 1 ? (
              <Button
                size="sm"
                onClick={() => setCurrentStep((s) => s + 1)}
                className="gap-1 bg-blue-600 text-white hover:bg-blue-700"
              >
                Next <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onPublishChapter}
                disabled={isPublishing}
                className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isPublishing ? 'Publishing…' : <><Send className="size-3.5" /> Publish</>}
              </Button>
            )}
          </div>
        </Motion.section>
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
