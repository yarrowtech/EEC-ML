import React, { useId } from 'react';

const HeaderActions = ({ autosaveStatus, classValue, sectionValue, subjectValue,
  onClassChange, onSectionChange, onSubjectChange, classOptions = [], sectionOptions = [],
  subjectOptions = [], selectionDisabled = false }) => {
  const id = useId();
  const fields = [
    { key: 'class', label: 'Class', value: classValue, change: onClassChange,
      options: classOptions, placeholder: 'Select class' },
    { key: 'section', label: 'Section', value: sectionValue, change: onSectionChange,
      options: sectionOptions, disabled: !classValue, placeholder: 'Select section' },
    { key: 'subject', label: 'Subject', value: subjectValue, change: onSubjectChange,
      options: subjectOptions.map(o => ({ id: o.subjectId, name: o.subjectName })),
      disabled: !sectionValue, placeholder: 'Select subject' },
  ];
  return (
    <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold text-slate-900 dark:text-white">Lesson plan</h1>
        <p role="status" className="text-xs text-slate-600 dark:text-slate-300">{autosaveStatus}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {fields.map(field => <div key={field.key}>
          <label htmlFor={id + field.key} className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{field.label}</label>
          <select id={id + field.key} value={field.value} disabled={selectionDisabled || field.disabled}
            onChange={event => field.change(event.target.value)}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
            <option value="">{field.options.length ? field.placeholder : 'No available ' + field.label.toLowerCase() + ' options'}</option>
            {field.options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </div>)}
      </div>
    </header>
  );
};
export default HeaderActions;
