import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ClipboardCheck, FileText, FlaskConical, Lightbulb, ListChecks, RefreshCcw, Send, Sparkles, UserCheck, X, Play, Edit3, UploadCloud } from 'lucide-react';
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

const evaluationTags = ['Excellent', 'Good', 'Needs Improvement'];

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
  const [showTryoutBuilder, setShowTryoutBuilder] = useState(false);
  const [showMaterialUpload, setShowMaterialUpload] = useState(false);

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

  const dayLabel = chapter.lessonDate
    ? new Date(chapter.lessonDate).toLocaleDateString('en-US', { weekday: 'long' })
    : '';

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

          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-200 hover:[&::-webkit-scrollbar-thumb]:bg-blue-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-1 flex items-center gap-2 text-xs text-slate-500"><Calendar className="size-4" /> Date</p>
                <Input type="date" value={chapter.lessonDate || ''} onChange={(e) => onUpdate({ ...chapter, lessonDate: e.target.value })} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-1 text-xs text-slate-500">Day</p>
                <Input value={dayLabel} readOnly />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-1 text-xs text-slate-500">Duration</p>
                <select value={chapter.duration} onChange={(e) => onUpdate({ ...chapter, duration: e.target.value })} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {(durations || []).map((duration) => <option key={duration} value={duration}>{duration}</option>)}
                </select>
              </div>
            </div>

            <details open className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-100">Content</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <UploadDropzone title="Upload Worksheet" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" files={chapter.contentUploads?.['Upload Worksheet'] || []} onAddFile={onAddContentFile} onRemoveFile={onRemoveContentFile} />

                {/* Tryout Builder Section */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Upload Tryout</p>
                  <div className="rounded-xl border-2 border-dashed border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50 p-4 text-center dark:from-purple-900/20 dark:to-indigo-900/20">
                    <Play className="mx-auto mb-2 size-8 text-purple-500" />
                    <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
                      Create interactive tryout questions
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTryoutBuilder(true)}
                      className="border-purple-300 text-purple-600 hover:bg-purple-100 dark:border-purple-600 dark:text-purple-400"
                    >
                      <Edit3 className="size-4 mr-2" />
                      {chapter.tryouts?.length > 0 ? 'Edit Tryout' : 'Create Tryout'}
                    </Button>
                    {chapter.tryouts?.length > 0 && (
                      <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                        {chapter.tryouts.length} question(s) added
                      </p>
                    )}
                  </div>
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
            </details>

            {/* Tryout Builder Modal */}
            <TryoutBuilder
              open={showTryoutBuilder}
              onClose={() => setShowTryoutBuilder(false)}
              tryouts={chapter.tryouts || []}
              onSaveTryouts={handleSaveTryouts}
            />

            <section className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100"><Lightbulb className="size-4" /> Introduction</p>
                <Button size="sm" variant="outline" onClick={onApplyAiSuggestion}><Sparkles className="size-4" /> AI Suggestion</Button>
              </div>
              <RichTextEditor value={chapter.introductionText || ''} onChange={(value) => onUpdate({ ...chapter, introductionText: value })} placeholder="Write lesson introduction..." />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100"><ListChecks className="size-4" /> Explanation</p>
              <Textarea rows={5} value={chapter.explanation || ''} onChange={(e) => onUpdate({ ...chapter, explanation: e.target.value })} placeholder="Add step-by-step explanations..." className="mb-3" />
              <Input type="file" accept="image/*,video/*,.pdf,.doc,.docx" onChange={(e) => onAddContentFile(e.target.files?.[0] || null, 'Explanation Attachments')} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100"><ClipboardCheck className="size-4" /> Recapitulation</p>
              <Textarea rows={3} value={chapter.recap || ''} onChange={(e) => onUpdate({ ...chapter, recap: e.target.value })} placeholder="Quick recap bullet points..." className="mb-2" />
              <Textarea rows={2} value={chapter.teacherNotes || ''} onChange={(e) => onUpdate({ ...chapter, teacherNotes: e.target.value })} placeholder="Teacher notes" />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100"><UserCheck className="size-4" /> Children Evaluation</p>
              <div className="grid gap-2 md:grid-cols-2">
                <Input value={chapter.evaluation?.participation || ''} onChange={(e) => onUpdate({ ...chapter, evaluation: { ...chapter.evaluation, participation: e.target.value } })} placeholder="Participation rating" />
                <Input value={chapter.evaluation?.remarks || ''} onChange={(e) => onUpdate({ ...chapter, evaluation: { ...chapter.evaluation, remarks: e.target.value } })} placeholder="Performance remarks" />
                <Input value={chapter.evaluation?.behaviour || ''} onChange={(e) => onUpdate({ ...chapter, evaluation: { ...chapter.evaluation, behaviour: e.target.value } })} placeholder="Behaviour observations" />
                <Input value={chapter.evaluation?.progress || ''} onChange={(e) => onUpdate({ ...chapter, evaluation: { ...chapter.evaluation, progress: e.target.value } })} placeholder="Progress tracking" />
              </div>
              <div className="mt-2 flex gap-2">
                {evaluationTags.map((tag) => (
                  <button key={tag} type="button" onClick={() => onUpdate({ ...chapter, evaluation: { ...chapter.evaluation, tag } })} className={`rounded-full px-3 py-1 text-xs ${chapter.evaluation?.tag === tag ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {tag}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100"><FlaskConical className="size-4" /> Worksheet</p>
              <div className="mb-2 flex gap-2">
                <Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={(e) => onAddWorksheetFile(e.target.files?.[0] || null)} />
                <Input value={chapter.worksheetLink || ''} onChange={(e) => onUpdate({ ...chapter, worksheetLink: e.target.value })} placeholder="Link existing worksheet" />
              </div>
              <div className="space-y-2">
                {(chapter.worksheetFiles || []).map((file) => (
                  <FileUploadCard key={file.id} file={file} onRemove={onRemoveWorksheetFile} />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Assessments</p>
                <Button variant="outline" onClick={onAddAssessment}>+ Add Assessment</Button>
              </div>
              <div className="space-y-2">
                {(chapter.assessments || []).map((assessment) => (
                  <AssessmentCard key={assessment.id} assessment={assessment} types={assessmentTypes} onChange={(next) => onUpdateAssessment(assessment.id, next)} />
                ))}
              </div>
            </section>

            {!!chapter.history?.length && (
              <section className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-100">Lesson History</p>
                <div className="space-y-2">
                  {chapter.history.slice(-5).reverse().map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-2 text-xs dark:border-slate-700">
                      <span>{item.label}</span>
                      <Button size="xs" variant="outline" onClick={() => onRestoreVersion(item.id)}>Restore</Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Publish Button Section */}
            <section className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 shadow-lg dark:border-emerald-700 dark:from-emerald-900/30 dark:to-teal-900/30">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Ready to Publish?</h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">Make this chapter available to students in Smart Learning</p>
                </div>
                <Button
                  onClick={onPublishChapter}
                  disabled={isPublishing}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 font-bold text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
                >
                  {isPublishing ? (
                    <>Publishing...</>
                  ) : (
                    <>
                      <Send className="size-4" /> Publish Chapter
                    </>
                  )}
                </Button>
              </div>
            </section>
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
