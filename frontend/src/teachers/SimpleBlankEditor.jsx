import React, { useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Check, Copy, Plus, Trash2, X } from 'lucide-react';
import { blankSection } from './QuizBuilder';

// Simple "sentence with a blank → correct answer" editor. Writes the same
// quizSections shape as QuizBuilder (one fill_blank section) so saving and
// auto-marking work unchanged. Extra accepted answers are stored as "a | b".

const BLANK = '_____';
let seq = 0;
const newKey = () => `b${Date.now().toString(36)}${(seq += 1)}`;
const newQuestion = () => ({
  key: newKey(), text: '', marks: '', options: [], correctOptions: [],
  correctBool: null, acceptableAnswers: '', modelAnswer: '',
});
const splitAnswers = (v) => String(v || '').split('|').map((a) => a.trim()).filter(Boolean);
const joinAnswers = (list) => list.join(' | ');

// Show the sentence with the blank filled in, for a quick preview.
const Preview = ({ text, answer }) => {
  if (!text.trim()) return null;
  const parts = text.split(/_{2,}/);
  return (
    <p className="text-[11.5px] text-slate-500">
      <span className="font-semibold text-slate-400">Preview: </span>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {p}
          {i < parts.length - 1 && (
            <span className="mx-0.5 rounded bg-emerald-100 px-1.5 font-semibold text-emerald-700">{answer || '?'}</span>
          )}
        </React.Fragment>
      ))}
    </p>
  );
};

const AnswerChips = ({ answers, onChange }) => {
  const [draft, setDraft] = useState('');
  const main = answers[0] || '';
  const extra = answers.slice(1);
  const addExtra = () => {
    const v = draft.trim();
    if (!v || answers.some((a) => a.toLowerCase() === v.toLowerCase())) { setDraft(''); return; }
    onChange([main, ...extra, v].filter((a, i) => i === 0 || a));
    setDraft('');
  };
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <label className="block">
        <span className="mb-1 block text-[10.5px] font-semibold text-slate-500">Correct answer</span>
        <input
          value={main}
          onChange={(e) => onChange([e.target.value, ...extra])}
          placeholder="e.g. CPU"
          className="h-8 w-full rounded-lg border border-emerald-300 bg-emerald-50/50 px-2.5 text-[12.5px] font-medium text-emerald-900 outline-none placeholder:font-normal placeholder:text-emerald-700/40 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <div>
        <span className="mb-1 block text-[10.5px] font-semibold text-slate-500">Also accept <span className="font-normal text-slate-400">(optional — other spellings)</span></span>
        <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1">
          {extra.map((a, i) => (
            <span key={`${a}-${i}`} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
              {a}
              <button type="button" onClick={() => onChange([main, ...extra.filter((_, j) => j !== i)])} aria-label={`Remove ${a}`} className="text-slate-400 hover:text-red-500"><X className="size-3" /></button>
            </span>
          ))}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addExtra(); } }}
            onBlur={addExtra}
            placeholder={extra.length ? '' : 'Type and press Enter'}
            className="h-6 min-w-[90px] flex-1 bg-transparent px-1 text-[12px] outline-none placeholder:text-slate-400"
          />
        </div>
      </div>
    </div>
  );
};

const SimpleBlankEditor = ({ sections = [], onChange }) => {
  const section = sections[0] && sections[0].type === 'fill_blank'
    ? sections[0]
    : { ...blankSection('fill_blank'), questions: [newQuestion()] };
  const questions = section.questions.length ? section.questions : [newQuestion()];
  const marksEach = Number(section.marksPerQuestion) || 1;

  const save = (next, patch = {}) => onChange([{ ...section, ...patch, questions: next }]);
  const updateQ = (i, patch) => save(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const addQ = () => save([...questions, newQuestion()]);
  const removeQ = (i) => save(questions.length > 1 ? questions.filter((_, j) => j !== i) : [newQuestion()]);
  const duplicateQ = (i) => save([...questions.slice(0, i + 1), { ...questions[i], _id: undefined, key: newKey() }, ...questions.slice(i + 1)]);
  const insertBlank = (i) => {
    const t = questions[i].text;
    updateQ(i, { text: /_{2,}/.test(t) ? t : `${t}${t && !t.endsWith(' ') ? ' ' : ''}${BLANK}` });
  };

  const isReady = (q) => q.text.trim() && /_{2,}/.test(q.text) && splitAnswers(q.acceptableAnswers).length;
  const done = questions.filter(isReady).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-white px-3 py-2 ring-1 ring-teal-100">
        <p className="text-[12.5px] font-bold text-slate-900">Questions</p>
        <p className="text-[11.5px] text-slate-500"><b className="text-slate-800">{done}</b> of {questions.length} ready</p>
        <label className="ml-auto flex items-center gap-2 text-[11.5px] text-slate-600">
          Marks for each question
          <input type="number" min={1} value={section.marksPerQuestion} onChange={(e) => save(questions, { marksPerQuestion: e.target.value })} className="h-7 w-14 rounded-md border border-slate-200 px-2 text-center text-[12px] outline-none focus:border-blue-400" />
        </label>
        <p className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-bold text-teal-700">Total {questions.length * marksEach} marks</p>
      </div>

      <AnimatePresence initial={false}>
        {questions.map((q, i) => {
          const ready = isReady(q);
          const hasBlank = /_{2,}/.test(q.text);
          const answers = splitAnswers(q.acceptableAnswers);
          return (
            <Motion.div key={q.key || i} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start gap-2.5">
                <span className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${ready ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {ready ? <Check className="size-3.5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex gap-1.5">
                    <input
                      value={q.text}
                      onChange={(e) => updateQ(i, { text: e.target.value })}
                      placeholder={`e.g. The ${BLANK} is the brain of the computer.`}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <button type="button" onClick={() => insertBlank(i)} disabled={hasBlank} title="Add the blank (_____) to the sentence" className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-[11.5px] font-semibold text-teal-700 hover:bg-teal-100 disabled:cursor-default disabled:opacity-40">
                      <Plus className="size-3" /> Blank
                    </button>
                  </div>
                  <p className={`mt-1 text-[10.5px] ${q.text.trim() && !hasBlank ? 'font-semibold text-amber-600' : 'text-slate-400'}`}>
                    {q.text.trim() && !hasBlank ? 'Add a blank: type ___ where the answer goes, or press "+ Blank".' : 'Write the sentence and put ___ where the missing word goes.'}
                  </p>
                </div>
                <button type="button" onClick={() => duplicateQ(i)} title="Duplicate question" aria-label={`Duplicate question ${i + 1}`} className="mt-1 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Copy className="size-3.5" /></button>
                <button type="button" onClick={() => removeQ(i)} title="Delete question" aria-label={`Delete question ${i + 1}`} className="mt-1 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-3.5" /></button>
              </div>

              <div className="ml-8.5 mt-2 space-y-1.5">
                <AnswerChips answers={answers.length ? answers : ['']} onChange={(list) => updateQ(i, { acceptableAnswers: joinAnswers(list.filter((a, k) => k === 0 || a.trim())) })} />
                <Preview text={q.text} answer={answers[0]} />
              </div>
            </Motion.div>
          );
        })}
      </AnimatePresence>

      <button type="button" onClick={addQ} className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-teal-200 bg-white py-2.5 text-[12.5px] font-semibold text-teal-700 transition hover:border-teal-300 hover:bg-teal-50">
        <Plus className="size-4" /> Add question
      </button>
    </div>
  );
};

export default SimpleBlankEditor;
