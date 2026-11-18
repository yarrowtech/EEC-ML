import React from 'react';
import {
  BookOpen, Calendar, CheckCircle2, ClipboardList, Clock, Edit, Eye, Paperclip, PencilLine, Play, Target, X,
} from 'lucide-react';
import { DidYouKnowHeader, FactCard, getDidYouKnowFacts, sanitizeRichHtml } from '../../../components/LessonFacts';
import AttachmentPreviewList from './AttachmentPreviewList';

const hasText = (value) => Boolean(String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim());

const countFiles = (uploads) => Object.values(uploads || {})
  .reduce((total, list) => total + (Array.isArray(list) ? list.length : 0), 0);

// Same look as the student reader: purple bar + heading, formatted body.
const ReaderSection = ({ title, html, tone }) => {
  if (!hasText(html) && !/<img/i.test(String(html || ''))) return null;
  const toneCls = tone === 'recap' ? 'border-l-4 border-emerald-400 bg-emerald-50/60 px-4 py-3 rounded-r-xl' : '';
  return (
    <section className="mb-7">
      <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold text-[#0d1c2e]">
        {tone === 'recap' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <span className="h-5 w-1.5 rounded-full bg-[#493ee5]" />}
        {title}
      </h2>
      <div
        className={`rich-reader text-[14.5px] leading-[1.75] text-[#334155] ${toneCls}`}
        // Teacher's own content; still cleaned before display.
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }}
      />
    </section>
  );
};

/**
 * Read-only preview of a chapter, laid out the way students will see it.
 * "Edit chapter" opens the full-page step-by-step editor.
 */
const ChapterPreview = ({ chapter, onEdit, onClose, subjectName = '' }) => {
  const isPublished = chapter.status === 'published' && !chapter.isDraft;
  const objectives = (chapter.learningObjectives || []).filter((o) => String(o || '').trim());
  const facts = getDidYouKnowFacts(chapter).map((f) => String(f || '').trim()).filter(Boolean);
  const materialCount = countFiles(chapter.contentUploads);
  const worksheetFiles = chapter.worksheetFiles || [];
  const assessments = chapter.assessments || [];
  const tryouts = chapter.tryouts || [];
  const dateLabel = chapter.lessonDate
    ? new Date(chapter.lessonDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const nothingYet = !hasText(chapter.introductionText) && !hasText(chapter.explanation) && !hasText(chapter.recap) && !facts.length;

  return (
    <div className="space-y-3 p-1 sm:p-2">
      {/* Summary card (teacher-only) — compact */}
      <div className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-3.5 py-3 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isPublished ? 'bg-emerald-400/90 text-emerald-950' : 'bg-white/25 text-white'}`}>
                {isPublished ? 'Published' : 'Draft'}
              </span>
              <h2 className="truncate text-[15px] font-bold leading-tight" title={chapter.title}>{chapter.title || 'Untitled Lesson'}</h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-white/85">
              <span className="inline-flex items-center gap-1"><Calendar className="size-3" />{dateLabel || 'No date set'}</span>
              <span className="inline-flex items-center gap-1"><Clock className="size-3" />{chapter.duration || 'No duration'}</span>
              {chapter.authorName && <span>By <span className="font-semibold text-white">{chapter.authorName}</span></span>}
            </div>
          </div>
          {chapter.readOnly ? (
            <span className="hidden shrink-0 items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold sm:inline-flex" title={`Only ${chapter.authorName || 'the author'} can edit or delete this lesson`}>
              <Eye className="size-3.5" /> View only
            </span>
          ) : (
            <button
              type="button"
              onClick={onEdit}
              aria-label={isPublished ? 'Edit chapter' : 'Continue editing'}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 active:scale-[.98]"
            >
              <Edit className="size-3.5" /> {isPublished ? 'Edit' : 'Continue editing'}
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close preview" className="shrink-0 rounded-full p-1 text-white/80 hover:bg-white/15 hover:text-white">
              <X className="size-4" />
            </button>
          )}
        </div>
        {chapter.readOnly && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-white/85 sm:hidden">
            <Eye className="size-3.5" /> View only — only {chapter.authorName || 'the author'} can edit this lesson
          </p>
        )}

        {/* counts */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {[
            { label: 'Objectives', value: objectives.length, icon: Target },
            { label: 'Materials', value: materialCount, icon: Paperclip },
            { label: 'Worksheets', value: worksheetFiles.length + assessments.length, icon: ClipboardList },
            { label: 'Tryouts', value: tryouts.length, icon: Play },
          ].map(({ label, value, icon: Icon }) => (
            <span key={label} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white/90">
              <Icon className="size-3" /> <b className="font-bold text-white">{value}</b> {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── What students see ── */}
      <p className="flex items-center gap-1.5 px-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        <Eye className="size-3.5" /> Student view
      </p>
      <article className="mx-auto w-full max-w-[210mm] rounded-sm bg-white px-5 py-6 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-slate-200 sm:px-[7.6%] sm:py-[6%]">
        {/* page header, like the student A4 page */}
        <div className="mb-6 border-b-2 border-[#493ee5] pb-3">
          {subjectName && <p className="text-[10px] font-bold uppercase tracking-widest text-[#493ee5]">{subjectName}</p>}
          <p className="text-lg font-extrabold text-[#0d1c2e]">{chapter.title || 'Untitled Chapter'}</p>
        </div>

        {objectives.length > 0 && (
          <section className="mb-7 rounded-xl bg-[#f8f9ff] p-4">
            <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold text-[#0d1c2e]"><Target size={16} className="text-[#493ee5]" /> What you’ll learn</h2>
            <ul className="space-y-1.5">
              {objectives.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-[14px] text-[#334155]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />{String(o).replace(/<[^>]*>/g, '')}
                </li>
              ))}
            </ul>
          </section>
        )}

        <ReaderSection title="Introduction" html={chapter.introductionText} />
        <ReaderSection title="Explanation" html={chapter.explanation} />
        <ReaderSection title="Quick Recap" html={chapter.recap} tone="recap" />

        {facts.length > 0 && (
          <section className="mb-4">
            <DidYouKnowHeader />
            <div className="space-y-3">
              {facts.map((fact, i) => <FactCard key={i} n={i + 1} text={fact} />)}
            </div>
          </section>
        )}

        {nothingYet && (
          <div className="py-12 text-center">
            <BookOpen className="mx-auto size-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-600">Nothing to show students yet</p>
            <p className="text-xs text-slate-400">Press “{isPublished ? 'Edit chapter' : 'Continue editing'}” to add the introduction and lesson content.</p>
          </div>
        )}
      </article>

      {/* Every attached file, previewable here */}
      <AttachmentPreviewList chapter={chapter} />

      {assessments.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><ClipboardList className="size-4 text-rose-500" /> Assessments</h3>
          <ul className="space-y-1.5 text-[13px] text-slate-600 dark:text-slate-300">
            {assessments.map((a, i) => (
              <li key={a.id || i} className="flex items-center gap-2"><BookOpen className="size-3.5 text-slate-400" /><span className="truncate">{a.title || 'Untitled assessment'}{a.type ? ` · ${a.type}` : ''}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ChapterPreview;
