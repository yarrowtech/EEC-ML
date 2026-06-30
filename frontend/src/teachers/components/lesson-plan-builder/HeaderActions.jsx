import React from 'react';
import { ArrowRight, Clock, UploadCloud } from 'lucide-react';

const HeaderActions = ({
  autosaveStatus,
  classValue,
  sectionValue,
  subjectValue,
  onClassChange,
  onSectionChange,
  onSubjectChange,
  onUploadMaterial,
  classOptions = [],
  sectionOptions = [],
  subjectOptions = [],
}) => {
  const hasDynamicOptions = classOptions.length > 0;

  return (
    <div className="rounded-xl border border-blue-100 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
      <div className="flex flex-wrap items-center gap-2">
        {/* Step badge inline */}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">1</span>
        <span className="mr-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Class</span>
        <select
          value={classValue}
          onChange={(event) => onClassChange(event.target.value)}
          style={{ colorScheme: 'light', color: '#0f172a', backgroundColor: 'rgba(239,246,255,0.6)' }}
          className="h-8 rounded-lg border border-blue-100 px-2 text-xs font-medium focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700"
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

        <ArrowRight className="size-5 text-slate-400 dark:text-slate-500" />

        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Section</span>
        <select
          value={sectionValue}
          onChange={(event) => onSectionChange(event.target.value)}
          style={{ colorScheme: 'light', color: '#0f172a', backgroundColor: 'rgba(239,246,255,0.6)' }}
          className="h-8 rounded-lg border border-blue-100 px-2 text-xs font-medium focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700"
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

        <ArrowRight className="size-5 text-slate-400 dark:text-slate-500" />

        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Subject</span>
        <select
          value={subjectValue}
          onChange={(event) => onSubjectChange(event.target.value)}
          style={{ colorScheme: 'light', color: '#0f172a', backgroundColor: 'rgba(239,246,255,0.6)' }}
          className="h-8 rounded-lg border border-blue-100 px-2 text-xs font-medium focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-slate-700"
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* {onUploadMaterial && (
          <button
            type="button"
            onClick={onUploadMaterial}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            <UploadCloud className="size-3" />
            Upload Material
          </button>
        )} */}

        <div className="flex items-center gap-1.5">
          <Clock className="size-3 text-slate-400" />
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{autosaveStatus}</span>
        </div>
      </div>
    </div>
  );
};

export default HeaderActions;