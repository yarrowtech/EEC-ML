import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import RichTextEditor from './RichTextEditor';
import FileUploadCard from './FileUploadCard';
import AssessmentCard from './AssessmentCard';

const DrawerModal = ({
  open,
  chapter,
  durations,
  assessmentTypes,
  onClose,
  onUpdate,
  onAddFile,
  onRemoveFile,
  onAddAssessment,
  onUpdateAssessment,
}) => {
  return (
    <AnimatePresence mode="wait">
      {open && chapter && (
        <motion.section
          key={chapter.id}
          initial={{ x: 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          className="h-full rounded-2xl border border-blue-100 bg-slate-50 p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">{chapter.title}</h3>
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>

          <div className="h-[calc(100%-3rem)] overflow-y-auto pr-1">
            <section className="mb-5 space-y-2">
              <p className="text-sm font-medium text-slate-700">Duration</p>
              <select
                value={chapter.duration}
                onChange={(event) => onUpdate({ ...chapter, duration: event.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                {durations.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration}
                  </option>
                ))}
              </select>
            </section>

            <section className="mb-5 space-y-2">
              <p className="text-sm font-medium text-slate-700">Lesson Description</p>
              <RichTextEditor
                value={chapter.description}
                onChange={(value) => onUpdate({ ...chapter, description: value })}
                placeholder="Write lesson objectives and explanation..."
              />
            </section>

            <section className="mb-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">Study Materials</p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
                    onChange={(event) => onAddFile(event.target.files?.[0] || null)}
                    className="max-w-52 rounded-xl text-xs"
                  />
                  <Button variant="outline" onClick={() => onAddFile({ name: 'Video Link', type: 'video' })}>
                    Add Video Link
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {chapter.files.map((file) => (
                  <FileUploadCard key={file.id} file={file} onRemove={onRemoveFile} />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Assessment</p>
                <Button variant="outline" onClick={onAddAssessment} className="rounded-xl">
                  <Plus className="size-4" /> + Add Assessment
                </Button>
              </div>
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
            </section>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};

export default DrawerModal;
