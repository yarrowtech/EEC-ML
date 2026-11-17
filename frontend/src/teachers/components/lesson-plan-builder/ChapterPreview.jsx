import React from 'react';
import {
  BookOpen, Calendar, CheckCircle2, ClipboardList, Clock, FileText, Lightbulb,
  ListChecks, Paperclip, PencilLine, Play, Sparkles, Target, X,
} from 'lucide-react';

const stripHtml = (value) => String(value || '')
  .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n\s*\n+/g, '\n\n')
  .trim();

const countFiles = (uploads) => Object.values(uploads || {})
  .reduce((total, list) => total + (Array.isArray(list) ? list.length : 0), 0);

const Section = ({ icon: Icon, tone, title, children, empty }) => (
  <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="mb-2 flex items-center gap-2">
      <span className={`flex size-7 items-center justify-center rounded-lg ${tone}`}><Icon className="size-4" /></span>
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
    </div>
    {children || <p className="text-xs italic text-slate-400">{empty || 'Not added yet.'}</p>}
  </section>
);

const TextBlock = ({ value }) => {
  const text = stripHtml(value);
  return text ? <p className="whitespace-pre-line text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{text}</p> : null;
};

/**
 * Read-only summary of a chapter. Shown when a teacher clicks a chapter in the
 * list; "Edit chapter" opens the full-page step-by-step editor.
 */
const ChapterPreview = ({ chapter, onEdit, onClose }) => {
  const isPublished = chapter.status === 'published' && !chapter.isDraft;
  const objectives = (chapter.learningObjectives || []).filter((o) => String(o || '').trim());
  const materialCount = countFiles(chapter.contentUploads);
  const worksheetCount = (chapter.worksheetFiles || []).length;
  const assessments = chapter.assessments || [];
  const tryouts = chapter.tryouts || [];
  const dateLabel = chapter.lessonDate
    ? new Date(chapter.lessonDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div className="space-y-3 p-1 sm:p-2">
      {/* Title card */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 p-4 text-white shadow-md sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${isPublished ? 'bg-emerald-400/90 text-emerald-950' : 'bg-white/25 text-white'}`}>
              {isPublished ? 'Published' : 'Draft'}
            </span>
            <h2 className="mt-2 break-words text-xl font-bold leading-tight sm:text-2xl">{chapter.title || 'Untitled Chapter'}</h2>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/85">
              <span className="inline-flex items-center gap-1"><Calendar className="size-3.5" />{dateLabel || 'No date set'}</span>
              <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{chapter.duration || 'No duration'}</span>
            </div>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close preview" className="shrink-0 rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white">
              <X className="size-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 active:scale-[.98] sm:w-auto"
        >
          <PencilLine className="size-4" /> {isPublished ? 'Edit chapter' : 'Continue editing'}
        </button>
      </div>

      {/* Quick counts */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Objectives', value: objectives.length, icon: Target, tone: 'bg-blue-50 text-blue-600' },
          { label: 'Materials', value: materialCount, icon: Paperclip, tone: 'bg-purple-50 text-purple-600' },
          { label: 'Worksheets', value: worksheetCount + assessments.length, icon: ClipboardList, tone: 'bg-rose-50 text-rose-600' },
          { label: 'Tryouts', value: tryouts.length, icon: Play, tone: 'bg-pink-50 text-pink-600' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="size-4" /></span>
            <div>
              <p className="text-base font-bold leading-none text-slate-900 dark:text-white">{value}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <Section icon={Target} tone="bg-blue-50 text-blue-600" title="Learning objectives" empty="No objectives written yet.">
        {objectives.length > 0 && (
          <ul className="space-y-1.5">
            {objectives.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />{stripHtml(o)}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Lightbulb} tone="bg-amber-50 text-amber-600" title="Introduction">
        <TextBlock value={chapter.introductionText} />
      </Section>

      <Section icon={ListChecks} tone="bg-green-50 text-green-600" title="Content / explanation">
        <TextBlock value={chapter.explanation} />
      </Section>

      {(stripHtml(chapter.recap) || stripHtml(chapter.didYouKnow)) && (
        <Section icon={Sparkles} tone="bg-indigo-50 text-indigo-600" title="Recap & did you know">
          <div className="space-y-2">
            <TextBlock value={chapter.recap} />
            <TextBlock value={chapter.didYouKnow} />
          </div>
        </Section>
      )}

      <Section icon={FileText} tone="bg-rose-50 text-rose-600" title="Worksheets & assessments" empty="No worksheet or assessment added yet.">
        {(worksheetCount > 0 || assessments.length > 0) && (
          <ul className="space-y-1.5 text-[13px] text-slate-600 dark:text-slate-300">
            {(chapter.worksheetFiles || []).map((f, i) => (
              <li key={f.id || i} className="flex items-center gap-2"><Paperclip className="size-3.5 text-slate-400" /><span className="truncate">{f.name || f.fileName || 'Worksheet file'}</span></li>
            ))}
            {assessments.map((a, i) => (
              <li key={a.id || i} className="flex items-center gap-2"><BookOpen className="size-3.5 text-slate-400" /><span className="truncate">{a.title || 'Untitled assessment'}{a.type ? ` · ${a.type}` : ''}</span></li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
};

export default ChapterPreview;
