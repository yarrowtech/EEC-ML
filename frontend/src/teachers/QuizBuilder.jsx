import React, { useState } from 'react';
import {
  ArrowDown, ArrowUp, CheckSquare, ClipboardPaste, CircleDot, Copy, ListChecks, PenLine, Plus, ToggleLeft, Trash2, TextCursorInput, X,
} from 'lucide-react';

// Question formats a quiz section can use. Keys match the backend
// (backend/utils/quizAssignment.js).
export const QUIZ_TYPES = [
  { key: 'mcq_single', label: 'MCQ – Single answer', short: 'Multiple Choice Questions', icon: CircleDot, tone: 'bg-rose-50 text-rose-600 border-rose-200' },
  { key: 'mcq_multiple', label: 'MCQ – Multiple answers', short: 'Multiple Choice (more than one correct)', icon: CheckSquare, tone: 'bg-violet-50 text-violet-600 border-violet-200' },
  { key: 'fill_blank', label: 'Fill in the Blanks', short: 'Fill in the Blanks', icon: TextCursorInput, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'true_false', label: 'True / False', short: 'True or False', icon: ToggleLeft, tone: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { key: 'short_answer', label: 'Short Answer', short: 'Short Answer Questions', icon: PenLine, tone: 'bg-sky-50 text-sky-600 border-sky-200' },
];
const TYPE_META = Object.fromEntries(QUIZ_TYPES.map((t) => [t.key, t]));
const SECTION_LETTERS = 'ABCDEFGHIJKLMNOPQRST';

let uid = 0;
const nextKey = () => `q${Date.now().toString(36)}${(uid += 1)}`;

const blankQuestion = (type) => ({
  key: nextKey(),
  text: '',
  marks: '',
  options: type === 'mcq_single' || type === 'mcq_multiple' ? ['', '', '', ''] : [],
  correctOptions: [],
  correctBool: null,
  acceptableAnswers: '',
  modelAnswer: '',
});

const blankSection = (type) => ({
  key: nextKey(),
  type,
  title: TYPE_META[type].short,
  instructions: '',
  marksPerQuestion: 1,
  questions: [blankQuestion(type)],
});

const questionMarks = (section, q) => {
  const n = Number(q.marks);
  return Number.isFinite(n) && n > 0 ? n : Number(section.marksPerQuestion) || 0;
};
export const quizTotalMarks = (sections = []) => Math.round(sections.reduce((sum, s) => sum + s.questions.reduce((n, q) => n + questionMarks(s, q), 0), 0) * 100) / 100;

// Converts the builder state into the API payload.
export const toQuizPayload = (sections = []) => sections.map((s) => ({
  ...(s._id ? { _id: s._id } : {}),
  type: s.type,
  title: s.title,
  instructions: s.instructions,
  marksPerQuestion: Number(s.marksPerQuestion) || 1,
  questions: s.questions.map((q) => ({
    ...(q._id ? { _id: q._id } : {}),
    text: q.text,
    marks: questionMarks(s, q),
    options: q.options,
    correctOptions: q.correctOptions,
    correctBool: q.correctBool,
    acceptableAnswers: String(q.acceptableAnswers || '').split('|').map((a) => a.trim()).filter(Boolean),
    modelAnswer: q.modelAnswer,
  })),
}));

// Turns stored quiz sections (from the API) back into builder state.
export const fromQuizPayload = (sections = []) => sections.map((s) => ({
  ...s,
  key: s._id || nextKey(),
  questions: (s.questions || []).map((q) => ({
    ...q,
    key: q._id || nextKey(),
    marks: q.marks ?? '',
    acceptableAnswers: Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers.join(' | ') : q.acceptableAnswers || '',
  })),
}));

// Finds the first problem in the quiz so the teacher can fix it before saving.
export const validateQuiz = (sections = []) => {
  if (!sections.length) return 'Add at least one quiz section.';
  for (let s = 0; s < sections.length; s += 1) {
    const sec = sections[s];
    if (!sec.questions.length) return `Section ${SECTION_LETTERS[s]}: add at least one question.`;
    for (let i = 0; i < sec.questions.length; i += 1) {
      const q = sec.questions[i];
      const where = `Section ${SECTION_LETTERS[s]}, Q${i + 1}`;
      if (!q.text.trim()) return `${where}: write the question.`;
      if (sec.type === 'mcq_single' || sec.type === 'mcq_multiple') {
        if (q.options.filter((o) => o.trim()).length < 2) return `${where}: add at least two options.`;
        if (q.options.some((o) => !o.trim())) return `${where}: remove or fill the empty options.`;
        if (!q.correctOptions.length) return `${where}: mark the correct option.`;
      }
      if (sec.type === 'true_false' && typeof q.correctBool !== 'boolean') return `${where}: choose True or False as the answer.`;
      if (sec.type === 'fill_blank' && !String(q.acceptableAnswers).trim()) return `${where}: add the correct answer.`;
    }
  }
  return '';
};

// ── Paste-to-import ──────────────────────────────────────────────────────────
// Understands question papers like:
//   Section A: Multiple Choice Questions (5 × 1 = 5)
//   1. Which part is called the brain of the computer?
//   - a) Monitor
//   - b) CPU
//   Answer: b
const detectType = (heading) => {
  const h = heading.toLowerCase();
  if (/fill\s*(in)?\s*(the)?\s*blank/.test(h)) return 'fill_blank';
  if (/true\s*(or|\/|&)?\s*false/.test(h)) return 'true_false';
  if (/(multiple|more than one|select all).*(answer|correct)|mcq.*multiple|multi[-\s]?select/.test(h)) return 'mcq_multiple';
  if (/multiple\s*choice|mcq|choose the correct/.test(h)) return 'mcq_single';
  if (/short\s*answer|long\s*answer|answer the following|descriptive|questions?\s*$/.test(h)) return 'short_answer';
  return null;
};

export const parseQuizText = (raw) => {
  const lines = String(raw || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sections = [];
  let section = null;
  let question = null;

  const startSection = (type, title, perMark) => {
    section = { ...blankSection(type), title, marksPerQuestion: perMark || 1, questions: [] };
    sections.push(section);
    question = null;
  };

  lines.forEach((line) => {
    const sectionMatch = line.match(/^(?:section|part)\s+[a-z0-9]+\s*[:.\-–—]?\s*(.*)$/i);
    const headingType = detectType(line);
    if (sectionMatch || (headingType && !/^\d+[.)]/.test(line) && !/^[-•*]?\s*\(?[a-h][).]\s/i.test(line))) {
      const title = (sectionMatch ? sectionMatch[1] : line).replace(/\([^)]*\)\s*$/, '').trim();
      const marksMatch = line.match(/\(\s*\d+\s*[×x*]\s*(\d+(?:\.\d+)?)\s*=/i);
      startSection(detectType(line) || 'short_answer', title || 'Questions', marksMatch ? Number(marksMatch[1]) : null);
      return;
    }

    const qMatch = line.match(/^(?:q\.?\s*)?(\d+)\s*[.)]\s*(.+)$/i);
    if (qMatch) {
      if (!section) startSection('short_answer', 'Questions', 1);
      let text = qMatch[2].trim();
      let marks = '';
      const m = text.match(/\((\d+(?:\.\d+)?)\s*marks?\)\s*$/i);
      if (m) { marks = Number(m[1]); text = text.slice(0, m.index).trim(); }
      question = { ...blankQuestion(section.type), text, marks, options: [] };
      section.questions.push(question);
      return;
    }

    const optMatch = line.match(/^[-•*]?\s*\(?([a-h])[).]\s*(.+)$/i);
    if (optMatch && question) {
      if (section.type !== 'mcq_single' && section.type !== 'mcq_multiple') section.type = 'mcq_single';
      let text = optMatch[2].trim();
      const marked = /(\s\*|✓|✔|\(correct\))\s*$/i.test(text);
      text = text.replace(/(\s\*|✓|✔|\(correct\))\s*$/i, '').trim();
      question.options.push(text);
      if (marked) question.correctOptions.push(question.options.length - 1);
      return;
    }

    const ansMatch = line.match(/^(?:ans(?:wer)?|correct(?: answer)?)\s*[:.\-–]\s*(.+)$/i);
    if (ansMatch && question) {
      const value = ansMatch[1].trim();
      if (section.type === 'mcq_single' || section.type === 'mcq_multiple') {
        const idx = value.toLowerCase().match(/[a-h]/g)?.map((c) => c.charCodeAt(0) - 97).filter((i) => i < question.options.length) || [];
        question.correctOptions = [...new Set(idx)];
        if (idx.length > 1) section.type = 'mcq_multiple';
      } else if (section.type === 'true_false') {
        question.correctBool = /^t/i.test(value) ? true : /^f/i.test(value) ? false : null;
      } else if (section.type === 'fill_blank') {
        question.acceptableAnswers = value.split(/[|/,]/).map((a) => a.trim()).filter(Boolean).join(' | ');
      } else {
        question.modelAnswer = value;
      }
      return;
    }

    // Continuation of the previous question's text.
    if (question && !question.options.length) question.text = `${question.text} ${line}`;
  });

  return sections.filter((s) => s.questions.length).map((s) => ({
    ...s,
    questions: s.questions.map((q) => ({
      ...q,
      options: s.type === 'mcq_single' || s.type === 'mcq_multiple' ? (q.options.length ? q.options : ['', '', '', '']) : [],
      correctOptions: s.type === 'mcq_single' ? q.correctOptions.slice(0, 1) : q.correctOptions,
    })),
  }));
};

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
const iconBtn = 'flex size-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30';

const QuestionEditor = ({ section, question, index, total, onChange, onRemove, onMove, onDuplicate }) => {
  const isMcq = section.type === 'mcq_single' || section.type === 'mcq_multiple';
  const setOption = (i, value) => onChange({ options: question.options.map((o, j) => (j === i ? value : o)) });
  const removeOption = (i) => onChange({
    options: question.options.filter((_, j) => j !== i),
    correctOptions: question.correctOptions.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c)),
  });
  const toggleCorrect = (i) => {
    if (section.type === 'mcq_single') onChange({ correctOptions: [i] });
    else onChange({ correctOptions: question.correctOptions.includes(i) ? question.correctOptions.filter((c) => c !== i) : [...question.correctOptions, i].sort((a, b) => a - b) });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-2 w-6 shrink-0 text-xs font-bold text-slate-500">{index + 1}.</span>
        <textarea
          value={question.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={section.type === 'short_answer' ? 2 : 1}
          placeholder={section.type === 'fill_blank' ? 'e.g. The __________ is known as the brain of the computer.' : 'Type the question…'}
          className={`${inputCls} resize-y`}
        />
        <div className="flex shrink-0 items-center">
          <input
            type="number" min="0" step="0.5" value={question.marks}
            onChange={(e) => onChange({ marks: e.target.value })}
            placeholder={String(section.marksPerQuestion || 1)}
            title="Marks for this question (leave blank to use the section default)"
            className="w-14 rounded-lg border border-slate-200 px-2 py-2 text-center text-xs outline-none focus:border-blue-400"
          />
          <span className="ml-1 text-[10px] text-slate-400">marks</span>
        </div>
      </div>

      <div className="ml-8 space-y-2">
        {isMcq && (
          <>
            {question.options.map((opt, i) => {
              const correct = question.correctOptions.includes(i);
              return (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button" onClick={() => toggleCorrect(i)}
                    title="Mark as correct"
                    className={`flex size-6 shrink-0 items-center justify-center border text-[10px] font-bold transition ${section.type === 'mcq_single' ? 'rounded-full' : 'rounded-md'} ${correct ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-slate-500 hover:border-emerald-400'}`}
                  >{String.fromCharCode(97 + i)}</button>
                  <input value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${String.fromCharCode(97 + i)}`} className={`${inputCls} py-1.5 ${correct ? 'border-emerald-300 bg-emerald-50/50' : ''}`} />
                  <button type="button" onClick={() => removeOption(i)} disabled={question.options.length <= 2} className={iconBtn} aria-label="Remove option"><X className="size-3.5" /></button>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => onChange({ options: [...question.options, ''] })} disabled={question.options.length >= 8} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 disabled:opacity-40"><Plus className="size-3.5" /> Add option</button>
              <span className="text-[10.5px] text-slate-400">{section.type === 'mcq_single' ? 'Click a letter to mark the one correct answer' : 'Click letters to mark every correct answer'}</span>
            </div>
          </>
        )}

        {section.type === 'true_false' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Correct answer:</span>
            {[true, false].map((v) => (
              <button key={String(v)} type="button" onClick={() => onChange({ correctBool: v })} className={`rounded-lg border px-4 py-1.5 text-xs font-semibold transition ${question.correctBool === v ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{v ? 'True' : 'False'}</button>
            ))}
          </div>
        )}

        {section.type === 'fill_blank' && (
          <div>
            <input value={question.acceptableAnswers} onChange={(e) => onChange({ acceptableAnswers: e.target.value })} placeholder="Correct answer (separate alternatives with | e.g. CPU | Central Processing Unit)" className={`${inputCls} py-1.5`} />
            <p className="mt-1 text-[10.5px] text-slate-400">Answers are matched ignoring capital letters and extra spaces.</p>
          </div>
        )}

        {section.type === 'short_answer' && (
          <textarea value={question.modelAnswer} onChange={(e) => onChange({ modelAnswer: e.target.value })} rows={2} placeholder="Model answer / marking points (optional, only you can see this)" className={`${inputCls} resize-y py-1.5 text-xs`} />
        )}

        <div className="flex justify-end gap-0.5">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className={iconBtn} aria-label="Move up"><ArrowUp className="size-3.5" /></button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className={iconBtn} aria-label="Move down"><ArrowDown className="size-3.5" /></button>
          <button type="button" onClick={onDuplicate} className={iconBtn} aria-label="Duplicate question"><Copy className="size-3.5" /></button>
          <button type="button" onClick={onRemove} disabled={total <= 1} className={`${iconBtn} hover:text-rose-600`} aria-label="Delete question"><Trash2 className="size-3.5" /></button>
        </div>
      </div>
    </div>
  );
};

const QuizBuilder = ({ sections = [], onChange }) => {
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  const updateSection = (sIdx, patch) => onChange(sections.map((s, i) => (i === sIdx ? { ...s, ...patch } : s)));
  const updateQuestion = (sIdx, qIdx, patch) => updateSection(sIdx, { questions: sections[sIdx].questions.map((q, i) => (i === qIdx ? { ...q, ...patch } : q)) });
  const moveItem = (list, from, dir) => {
    const to = from + dir;
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  };
  const changeSectionType = (sIdx, type) => {
    const s = sections[sIdx];
    const wasMcq = s.type === 'mcq_single' || s.type === 'mcq_multiple';
    const isMcq = type === 'mcq_single' || type === 'mcq_multiple';
    updateSection(sIdx, {
      type,
      title: s.title === TYPE_META[s.type].short ? TYPE_META[type].short : s.title,
      questions: s.questions.map((q) => ({
        ...q,
        options: isMcq ? (wasMcq ? q.options : ['', '', '', '']) : [],
        correctOptions: isMcq && wasMcq ? (type === 'mcq_single' ? q.correctOptions.slice(0, 1) : q.correctOptions) : [],
        correctBool: type === 'true_false' ? q.correctBool : null,
      })),
    });
  };

  const runImport = () => {
    const parsed = parseQuizText(importText);
    if (!parsed.length) { setImportError('No numbered questions found. Start each question with 1., 2., … and each section with “Section A: …”.'); return; }
    onChange([...sections, ...parsed]);
    setImportText('');
    setImportError('');
    setImportOpen(false);
  };

  const total = quizTotalMarks(sections);
  const questionCount = sections.reduce((n, s) => n + s.questions.length, 0);

  return (
    <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white"><ListChecks className="size-4" /></span>
          <div>
            <p className="text-sm font-bold text-slate-800">Quiz Questions</p>
            <p className="text-[11px] text-slate-500">{sections.length} section{sections.length === 1 ? '' : 's'} · {questionCount} question{questionCount === 1 ? '' : 's'} · <strong className="text-slate-700">{total} marks</strong></p>
          </div>
        </div>
        <button type="button" onClick={() => setImportOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"><ClipboardPaste className="size-3.5" /> Paste question paper</button>
      </div>

      {importOpen && (
        <div className="mb-3 rounded-xl border border-blue-200 bg-white p-3">
          <p className="mb-1.5 text-xs text-slate-600">Paste your questions. Sections like <code className="rounded bg-slate-100 px-1">Section A: Multiple Choice Questions (5 × 1 = 5)</code>, numbered questions, options <code className="rounded bg-slate-100 px-1">a) …</code> and optional <code className="rounded bg-slate-100 px-1">Answer: b</code> lines are detected. Mark any missing answers after importing.</p>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={8} className={`${inputCls} font-mono text-xs`} placeholder={'Section A: Multiple Choice Questions (5 × 1 = 5)\n1. Which part is called the brain of the computer?\n- a) Monitor\n- b) CPU\nAnswer: b'} />
          {importError && <p className="mt-1 text-xs text-rose-600">{importError}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setImportOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">Cancel</button>
            <button type="button" onClick={runImport} disabled={!importText.trim()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Import questions</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {sections.map((section, sIdx) => {
          const meta = TYPE_META[section.type];
          const sectionMarks = section.questions.reduce((n, q) => n + questionMarks(section, q), 0);
          return (
            <div key={section.key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold ${meta.tone}`}><meta.icon className="size-3.5" /> Section {SECTION_LETTERS[sIdx]}</span>
                <input value={section.title} onChange={(e) => updateSection(sIdx, { title: e.target.value })} className={`${inputCls} min-w-[160px] flex-1 py-1.5 font-semibold`} placeholder="Section title" />
                <select value={section.type} onChange={(e) => changeSectionType(sIdx, e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400">
                  {QUIZ_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <label className="flex items-center gap-1 text-[11px] text-slate-500">
                  <input type="number" min="0.5" step="0.5" value={section.marksPerQuestion} onChange={(e) => updateSection(sIdx, { marksPerQuestion: e.target.value })} className="w-14 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-xs outline-none focus:border-blue-400" />
                  marks each
                </label>
                <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">{section.questions.length} Q · {Math.round(sectionMarks * 100) / 100} marks</span>
                <div className="flex">
                  <button type="button" onClick={() => onChange(moveItem(sections, sIdx, -1))} disabled={sIdx === 0} className={iconBtn} aria-label="Move section up"><ArrowUp className="size-3.5" /></button>
                  <button type="button" onClick={() => onChange(moveItem(sections, sIdx, 1))} disabled={sIdx === sections.length - 1} className={iconBtn} aria-label="Move section down"><ArrowDown className="size-3.5" /></button>
                  <button type="button" onClick={() => onChange(sections.filter((_, i) => i !== sIdx))} className={`${iconBtn} hover:text-rose-600`} aria-label="Delete section"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
              <input value={section.instructions} onChange={(e) => updateSection(sIdx, { instructions: e.target.value })} placeholder="Instructions for students (optional)" className={`${inputCls} mb-3 py-1.5 text-xs`} />

              <div className="space-y-2">
                {section.questions.map((q, qIdx) => (
                  <QuestionEditor
                    key={q.key}
                    section={section}
                    question={q}
                    index={qIdx}
                    total={section.questions.length}
                    onChange={(patch) => updateQuestion(sIdx, qIdx, patch)}
                    onRemove={() => updateSection(sIdx, { questions: section.questions.filter((_, i) => i !== qIdx) })}
                    onMove={(dir) => updateSection(sIdx, { questions: moveItem(section.questions, qIdx, dir) })}
                    onDuplicate={() => updateSection(sIdx, { questions: [...section.questions.slice(0, qIdx + 1), { ...q, _id: undefined, key: nextKey(), options: [...q.options], correctOptions: [...q.correctOptions] }, ...section.questions.slice(qIdx + 1)] })}
                  />
                ))}
              </div>
              <button type="button" onClick={() => updateSection(sIdx, { questions: [...section.questions, blankQuestion(section.type)] })} className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"><Plus className="size-3.5" /> Add question</button>
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Add a section</p>
        <div className="flex flex-wrap gap-2">
          {QUIZ_TYPES.map((t) => (
            <button key={t.key} type="button" onClick={() => onChange([...sections, blankSection(t.key)])} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:-translate-y-0.5 ${t.tone}`}><t.icon className="size-3.5" />{t.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuizBuilder;
