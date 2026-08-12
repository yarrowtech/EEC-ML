import React, { useEffect, useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Circle,
  FileText,
  GraduationCap,
  ListChecks,
  NotebookPen,
  Pencil,
  Sparkles,
  Target,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { TutorMessageContent, renderInlineTutorText } from './TutorMessageContent';

// ── Helpers ──────────────────────────────────────────────────────────────────

const stripTutorMarkdown = (value) => String(value || '')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/^#{1,6}\s*/, '')
  .trim();

const isLikelyNotesHeading = (line, nextLine = '') => {
  const text = stripTutorMarkdown(line);
  if (!text || !nextLine.trim()) return false;
  if (/^\d+[.)]/.test(text) || /^[a-z][.)]\s/i.test(text)) return false;
  if (/[.!?;:]$/.test(text)) return false;
  if (text.length > 72) return false;
  if (/^(new words|tasks to do)$/i.test(text)) return false;
  return /^[A-Z0-9]/.test(text);
};

const normalizeTaskSignature = (task) => {
  const body = [task.title, ...task.items]
    .map((item) => stripTutorMarkdown(item).toLowerCase().replace(/\s+/g, ' ').trim())
    .join('|');
  return body.replace(/^[a-z][.)]\s*/gm, '');
};

const classifyTask = (title) => {
  const text = title.toLowerCase();
  if (/answer|factual|question/.test(text)) return { label: 'Questions', tone: 'sky' };
  if (/think|discuss|share|views/.test(text)) return { label: 'Discuss', tone: 'violet' };
  if (/complete|fill|tense|sentence|blank/.test(text)) return { label: 'Practice', tone: 'emerald' };
  if (/listen|repeat|pronounce|read/.test(text)) return { label: 'Reading', tone: 'amber' };
  if (/draw|make|choose|find out|self-assessment/.test(text)) return { label: 'Activity', tone: 'rose' };
  return { label: 'Task', tone: 'slate' };
};

const TASK_TONE_CLASS = {
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
};

function parseNotesResponse(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
  const parsed = {
    title: 'Study Notes',
    subtitle: '',
    sections: [],
    words: [],
    tasks: [],
    duplicateCount: 0,
  };

  let index = 0;
  if (lines[index]) {
    parsed.title = stripTutorMarkdown(lines[index]);
    index += 1;
  }
  if (lines[index] && /study notes/i.test(lines[index])) {
    parsed.subtitle = stripTutorMarkdown(lines[index]);
    index += 1;
  }

  let mode = 'sections';
  let currentSection = null;
  let currentTask = null;

  const flushSection = () => {
    if (currentSection && (currentSection.heading || currentSection.lines.length)) {
      parsed.sections.push(currentSection);
    }
    currentSection = null;
  };

  const flushTask = () => {
    if (currentTask) parsed.tasks.push(currentTask);
    currentTask = null;
  };

  for (; index < lines.length; index += 1) {
    const clean = stripTutorMarkdown(lines[index]);

    if (/^new words$/i.test(clean)) {
      flushSection();
      flushTask();
      mode = 'words';
      continue;
    }
    if (/^tasks to do$/i.test(clean)) {
      flushSection();
      flushTask();
      mode = 'tasks';
      continue;
    }

    if (mode === 'words') {
      parsed.words.push(clean.replace(/^[-*+]\s*/, ''));
      continue;
    }

    if (mode === 'tasks') {
      const taskMatch = clean.match(/^(\d+)\.\s*(.+)$/);
      if (taskMatch) {
        flushTask();
        currentTask = { number: taskMatch[1], title: taskMatch[2], items: [] };
        continue;
      }
      if (!currentTask) currentTask = { number: String(parsed.tasks.length + 1), title: clean, items: [] };
      currentTask.items.push(clean);
      continue;
    }

    if (isLikelyNotesHeading(clean, lines[index + 1] || '')) {
      flushSection();
      currentSection = { heading: clean, lines: [] };
      continue;
    }

    if (!currentSection) currentSection = { heading: '', lines: [] };
    currentSection.lines.push(clean);
  }

  flushSection();
  flushTask();

  const seenTasks = new Set();
  parsed.tasks = parsed.tasks.filter((task) => {
    const signature = normalizeTaskSignature(task);
    if (!signature) return false;
    if (seenTasks.has(signature)) {
      parsed.duplicateCount += 1;
      return false;
    }
    seenTasks.add(signature);
    return true;
  });

  parsed.words = [...new Set(parsed.words.filter(Boolean))];
  return parsed;
}

const exportNotesPdf = async (title, rawText) => {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 15;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 60);
  doc.text(title || 'Study Notes', margin, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, margin, y);
  y += 8;

  doc.setDrawColor(200, 200, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  const lines = rawText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { y += 3; continue; }
    const isHeading = trimmed.startsWith('**') && trimmed.endsWith('**');
    if (isHeading) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(60, 40, 140);
      doc.text(trimmed.replace(/\*\*/g, ''), margin, y);
      y += 7;
    } else {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(50, 50, 60);
      const wrapped = doc.splitTextToSize(trimmed, maxW);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5 + 1;
    }
  }

  doc.save(`study-notes-${Date.now()}.pdf`);
};

// ── Component ─────────────────────────────────────────────────────────────────

export function NotesUI({ text }) {
  const notes = useMemo(() => parseNotesResponse(text), [text]);
  const [markedSections, setMarkedSections] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async () => {
    setExporting(true);
    try { await exportNotesPdf(notes.title || 'Study Notes', text); }
    finally { setExporting(false); }
  };

  const studyStats = useMemo(() => {
    const minutes = Math.max(5, Math.min(30, notes.sections.length * 2 + Math.ceil(notes.tasks.length / 2) + Math.ceil(notes.words.length / 4)));
    const focus = notes.sections.slice(0, 3).map((section) => section.heading).filter(Boolean);
    return { minutes, focus };
  }, [notes.sections, notes.tasks.length, notes.words.length]);

  const markedCount = markedSections.size;
  const sectionProgress = notes.sections.length ? Math.round((markedCount / notes.sections.length) * 100) : 0;

  useEffect(() => {
    setMarkedSections(new Set());
  }, [text]);

  const toggleSectionMarked = (index) => {
    setMarkedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (!notes.sections.length && !notes.words.length && !notes.tasks.length) {
    return <TutorMessageContent text={text} />;
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#f0f9ff_0%,#ffffff_48%,#FFFBEB_100%)] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white/80 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-700">
              <GraduationCap className="size-3.5" />
              Study mode
            </p>
            <h3 className="mt-1 text-base font-bold leading-snug text-slate-900">{notes.title}</h3>
            {notes.subtitle && <p className="mt-0.5 text-xs text-slate-500">{notes.subtitle}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold items-center">
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-violet-700">{studyStats.minutes} min revision</span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-sky-700">{notes.sections.length} sections</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">{notes.tasks.length} tasks</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">{notes.words.length} words</span>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting}
              className="flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              <FileText className="size-3" />
              {exporting ? 'Exporting…' : 'Export PDF'}
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-white bg-white/75 p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <p className="text-xs font-bold text-slate-900">Study progress</p>
            </div>
            <span className="text-xs font-semibold text-emerald-700">
              {markedCount}/{notes.sections.length} sections marked
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <Motion.div
              className="h-full rounded-full bg-emerald-500"
              animate={{ width: `${sectionProgress}%` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { label: 'Read', value: `${notes.sections.length} short parts`, icon: BookOpen, tone: 'text-sky-700 bg-sky-100' },
            { label: 'Recall', value: `${notes.words.length} word prompts`, icon: BrainCircuit, tone: 'text-violet-700 bg-violet-100' },
            { label: 'Practice', value: `${notes.tasks.length} task cards`, icon: Pencil, tone: 'text-emerald-700 bg-emerald-100' },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="flex items-center gap-2 rounded-xl border border-white bg-white/75 px-3 py-2 shadow-sm">
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', step.tone)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900">{step.label}</p>
                  <p className="truncate text-[11px] text-slate-500">{step.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="mx-3 mt-3 grid h-auto grid-cols-3 rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="notes" className="gap-1.5 rounded-lg text-xs">
            <BookOpen className="size-3.5" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5 rounded-lg text-xs">
            <ListChecks className="size-3.5" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="words" className="gap-1.5 rounded-lg text-xs">
            <NotebookPen className="size-3.5" />
            Words
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="m-0 p-3">
          {studyStats.focus.length > 0 && (
            <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50/70 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Target className="size-4 text-violet-700" />
                <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Focus while reading</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {studyStats.focus.map((item) => (
                  <span key={item} className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {notes.sections.map((section, i) => {
              const isMarked = markedSections.has(i);
              return (
                <Motion.div
                  key={`${section.heading || 'section'}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    'relative overflow-hidden rounded-xl border bg-white p-3 shadow-sm transition-colors',
                    'before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1',
                    isMarked
                      ? 'border-emerald-300 bg-emerald-50/30 before:bg-emerald-500'
                      : i === 0 ? 'border-sky-200 before:bg-sky-400 lg:col-span-2' : 'border-slate-200 before:bg-emerald-300',
                    i === 0 && 'lg:col-span-2'
                  )}
                >
                  {section.heading && (
                    <div className="mb-2 flex items-start gap-2 pl-1">
                      <span className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                        isMarked ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
                      )}>
                        {isMarked ? <CheckCircle2 className="size-4" /> : String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">{section.heading}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-400">Read, cover, then explain in your own words</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSectionMarked(i)}
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors',
                          isMarked
                            ? 'border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
                        )}
                        aria-pressed={isMarked}
                      >
                        <CheckCircle2 className="size-3.5" />
                        {isMarked ? 'Marked' : 'Mark studied'}
                      </button>
                    </div>
                  )}
                  <div className={cn(
                    'space-y-2 rounded-lg px-3 py-2 text-sm leading-7 text-slate-700',
                    isMarked
                      ? 'bg-[repeating-linear-gradient(to_bottom,#FFFBEB_0,#FFFBEB_27px,#FEF3C7_28px)]'
                      : 'bg-[repeating-linear-gradient(to_bottom,#ffffff_0,#ffffff_27px,#f1f5f9_28px)]'
                  )}>
                    {section.lines.map((line, lineIndex) => (
                      <p key={lineIndex}>{renderInlineTutorText(line, `note-${i}-${lineIndex}`)}</p>
                    ))}
                  </div>
                  <div className={cn(
                    'mt-2 flex items-center gap-1.5 text-[11px] font-medium',
                    isMarked ? 'text-emerald-700' : 'text-slate-400'
                  )}>
                    <CheckCircle2 className={cn('size-3.5', isMarked ? 'text-emerald-600' : 'text-slate-300')} />
                    {isMarked ? 'Section marked as studied' : 'Mark after you can retell this section'}
                  </div>
                </Motion.div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="m-0 p-3">
          {notes.duplicateCount > 0 && (
            <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              {notes.duplicateCount} repeated task group{notes.duplicateCount === 1 ? '' : 's'} collapsed for easier revision.
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {notes.tasks.map((task, i) => {
              const type = classifyTask(task.title);
              return (
                <Motion.div
                  key={`${task.number}-${task.title}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.035 }}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="mb-2 flex items-start gap-2">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white">
                      <Circle className="size-3 text-slate-300" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', TASK_TONE_CLASS[type.tone])}>
                        {type.label}
                      </span>
                      <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">
                        {renderInlineTutorText(task.title, `task-title-${i}`)}
                      </p>
                    </div>
                  </div>
                  {task.items.length > 0 && (
                    <div className="space-y-1.5 border-t border-slate-100 pt-2">
                      {task.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="grid grid-cols-[auto_1fr] gap-2 text-xs leading-relaxed text-slate-700">
                          <span className="mt-1.5 size-1.5 rounded-full bg-slate-300" />
                          <span>{renderInlineTutorText(item, `task-${i}-${itemIndex}`)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Motion.div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="words" className="m-0 p-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Word bank</p>
                <p className="mt-0.5 text-[11px] text-amber-800/70">Say the word, guess the meaning, then use it in one sentence.</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-amber-700">
                <Sparkles className="size-3.5" />
                Recall drill
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {notes.words.map((word) => (
                <div key={word} className="rounded-xl border border-white bg-white p-3 shadow-sm">
                  <p className="text-sm font-bold text-slate-900">{word}</p>
                  <div className="mt-2 h-8 rounded-lg border border-dashed border-amber-200 bg-amber-50/60" />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default NotesUI;
