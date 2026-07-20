import React from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Clock, Layers, PencilLine, Users } from 'lucide-react';
import { motion as Motion } from 'framer-motion';

const HeaderActions = ({
  autosaveStatus,
  classValue,
  sectionValue,
  subjectValue,
  onClassChange,
  onSectionChange,
  onSubjectChange,
  classOptions = [],
  sectionOptions = [],
  subjectOptions = [],
  currentChapter = null,
  currentStep = 0,
}) => {
  const hasDynamicOptions = classOptions.length > 0;
  const stepLabels = ['Lesson Info', 'Introduction', 'Content', 'Materials', 'Assessment', 'Review & Publish'];
  const selectedChapterTitle = currentChapter?.title || 'Lesson Planner';
  const selectedChapterStatus = currentChapter?.status === 'published' && !currentChapter?.isDraft ? 'Published' : 'Draft';

  return (
    <Motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="rounded-[28px] border border-[#e9edf2] bg-[#f8fafc] px-4 py-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2.5 lg:gap-4">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[11px] font-bold text-white">1</span>
          <span className="text-xs font-semibold text-[#475569]">Class</span>
        </div>
        <select
          value={classValue}
          onChange={(event) => onClassChange(event.target.value)}
          style={{ colorScheme: 'light', color: '#1e293b', backgroundColor: 'white' }}
          className="h-9 min-w-[112px] rounded-full border border-[#dce2ea] px-3 text-xs font-medium outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
        >
          {hasDynamicOptions ? (
            <>
              <option value="">Select Class</option>
              {classOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </>
          ) : (
            <><option>Class 8</option><option>Class 9</option><option>Class 10</option></>
          )}
        </select>

        <ArrowRight className="hidden size-4 text-[#94a3b8] sm:block" />

        <div className="flex items-center gap-2">
          <Users className="size-4 text-[#2563eb]" />
          <span className="text-xs font-semibold text-[#475569]">Section</span>
        </div>
        <select
          value={sectionValue}
          onChange={(event) => onSectionChange(event.target.value)}
          style={{ colorScheme: 'light', color: '#1e293b', backgroundColor: 'white' }}
          className="h-9 min-w-[108px] rounded-full border border-[#dce2ea] px-3 text-xs font-medium outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
        >
          {hasDynamicOptions ? (
            <>
              <option value="">Select Section</option>
              {sectionOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </>
          ) : (
            <><option>Section A</option><option>Section B</option><option>Section C</option></>
          )}
        </select>

        <ArrowRight className="hidden size-4 text-[#94a3b8] sm:block" />

        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-[#2563eb]" />
          <span className="text-xs font-semibold text-[#475569]">Subject</span>
        </div>
        <select
          value={subjectValue}
          onChange={(event) => onSubjectChange(event.target.value)}
          style={{ colorScheme: 'light', color: '#1e293b', backgroundColor: 'white' }}
          className="h-9 min-w-[128px] rounded-full border border-[#dce2ea] px-3 text-xs font-medium outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
        >
          {hasDynamicOptions ? (
            <>
              <option value="">Select Subject</option>
              {subjectOptions.map((o) => <option key={o.subjectId} value={o.subjectId}>{o.subjectName}</option>)}
            </>
          ) : (
            <><option>Mathematics</option><option>Science</option><option>English</option></>
          )}
        </select>
        <Motion.div layout className="flex min-w-0 flex-1 items-center justify-between gap-3 lg:ml-auto">
          <div className="flex min-w-0 items-center gap-3">
            <Layers className="hidden size-4 text-[#2563eb] xl:block" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold tracking-[-0.01em] text-[#0f2b45]">{selectedChapterTitle}</p>
              <p className="flex items-center gap-1 text-[11px] text-[#64748b]">
                <Clock className="size-3" /> {autosaveStatus}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ${selectedChapterStatus === 'Published' ? 'bg-emerald-100 text-emerald-700' : 'bg-[#dbe7fe] text-[#1e4f8a]'}`}>
              <PencilLine className="mr-1 inline size-3" />{selectedChapterStatus}
            </span>
          </div>

          <div className="hidden shrink-0 items-center gap-2 rounded-full bg-[#f1f4f9] px-3 py-1.5 text-xs font-medium text-[#64748b] md:flex">
            <ArrowLeft className="size-3.5" />
            <span className="rounded-full bg-[#2563eb] px-2.5 py-1 text-[11px] font-semibold text-white">{currentStep + 1} / {stepLabels.length}</span>
            <ArrowRight className="size-3.5" />
            <span className="ml-1 whitespace-nowrap">{stepLabels[currentStep] || stepLabels[0]}</span>
          </div>
        </Motion.div>
      </div>
    </Motion.div>
  );
};

export default HeaderActions;
