import React from 'react';
import { Clock } from 'lucide-react';

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
}) => {
  const hasDynamicOptions = classOptions.length > 0;

  return (
    <div className="rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
      <div className="grid gap-3 md:grid-cols-3">
        <select
          value={classValue}
          onChange={(event) => onClassChange(event.target.value)}
          className="h-10 rounded-xl border border-blue-100 bg-blue-50/40 px-3 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {hasDynamicOptions ? (
            <>
              <option value="">Select Class</option>
              {classOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </>
          ) : (
            <><option>Class 8</option><option>Class 9</option><option>Class 10</option></>
          )}
        </select>
        <select
          value={sectionValue}
          onChange={(event) => onSectionChange(event.target.value)}
          className="h-10 rounded-xl border border-blue-100 bg-blue-50/40 px-3 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {hasDynamicOptions ? (
            <>
              <option value="">Select Section</option>
              {sectionOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </>
          ) : (
            <><option>Section A</option><option>Section B</option><option>Section C</option></>
          )}
        </select>
        <select
          value={subjectValue}
          onChange={(event) => onSubjectChange(event.target.value)}
          className="h-10 rounded-xl border border-blue-100 bg-blue-50/40 px-3 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {hasDynamicOptions ? (
            <>
              <option value="">Select Subject</option>
              {subjectOptions.map((option) => (
                <option key={option.subjectId} value={option.subjectId}>{option.subjectName}</option>
              ))}
            </>
          ) : (
            <><option>Mathematics</option><option>Science</option><option>English</option></>
          )}
        </select>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <Clock className="size-3.5 text-slate-400" />
        <span className="text-xs text-slate-500 dark:text-slate-400">{autosaveStatus}</span>
      </div>
    </div>
  );
};

export default HeaderActions;
