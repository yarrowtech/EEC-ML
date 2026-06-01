import React from 'react';
import { Save, Send, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProgressBar from './ProgressBar';

const HeaderActions = ({
  title,
  onTitleChange,
  onSave,
  onPublish,
  autosaveStatus,
  progress,
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

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <select value={classValue} onChange={(event) => onClassChange(event.target.value)} className="h-10 rounded-xl border border-blue-100 bg-blue-50/40 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
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
        <select value={sectionValue} onChange={(event) => onSectionChange(event.target.value)} className="h-10 rounded-xl border border-blue-100 bg-blue-50/40 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
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
        <select value={subjectValue} onChange={(event) => onSubjectChange(event.target.value)} className="h-10 rounded-xl border border-blue-100 bg-blue-50/40 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
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

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-md">
          <Input value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Enter lesson plan title" className="h-10 rounded-xl border-blue-100 bg-blue-50/30" />
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onSave} className="rounded-xl border-blue-200 text-blue-700"><Save className="size-4" /> Save Draft</Button>
            <Button onClick={onPublish} className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white"><Send className="size-4" /> Publish</Button>
          </div>
          <div className="flex items-center gap-3"><span className="text-xs text-slate-500">Auto-save: {autosaveStatus}</span><ProgressBar value={progress} /></div>
        </div>
      </div>
    </div>
  );
};

export default HeaderActions;
