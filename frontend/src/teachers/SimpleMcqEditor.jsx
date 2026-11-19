import React from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Check, Copy, Plus, Trash2, X } from 'lucide-react';
import { blankSection } from './QuizBuilder';

// A plain "question → options → tick the right one" editor for MCQ tests.
// It reads/writes the same quizSections shape as QuizBuilder (one
// single-answer MCQ section), so saving and auto-marking work unchanged.

const LETTERS = 'ABCDEFGH';
let seq = 0;
const newKey = () => `m${Date.now().toString(36)}${(seq += 1)}`;
const newQuestion = () => ({
  key: newKey(), text: '', marks: '', options: ['', '', '', ''], correctOptions: [],
  correctBool: null, acceptableAnswers: '', modelAnswer: '',
});

const SimpleMcqEditor = ({ sections = [], onChange }) => {
  // Always work on a single MCQ section.
  const section = sections[0] && sections[0].type === 'mcq_single'
    ? sections[0]
    : { ...blankSection('mcq_single'), questions: (sections[0]?.questions || [newQuestion()]) };
  const questions = section.questions.length ? section.questions : [newQuestion()];
  const marksEach = Number(section.marksPerQuestion) || 1;

  const save = (nextQuestions, patch = {}) => onChange([{ ...section, ...patch, questions: nextQuestions }]);
  const updateQ = (i, patch) => save(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const addQ = () => save([...questions, newQuestion()]);
  const removeQ = (i) => save(questions.length > 1 ? questions.filter((_, j) => j !== i) : [newQuestion()]);
  const duplicateQ = (i) => save([...questions.slice(0, i + 1), { ...questions[i], _id: undefined, key: newKey(), options: [...questions[i].options], correctOptions: [...questions[i].correctOptions] }, ...questions.slice(i + 1)]);

  const setOption = (i, o, value) => updateQ(i, { options: questions[i].options.map((x, k) => (k === o ? value : x)) });
  const addOption = (i) => updateQ(i, { options: [...questions[i].options, ''] });
  const removeOption = (i, o) => {
    const q = questions[i];
    updateQ(i, {
      options: q.options.filter((_, k) => k !== o),
      correctOptions: q.correctOptions.filter((c) => c !== o).map((c) => (c > o ? c - 1 : c)),
    });
  };

  const done = questions.filter((q) => q.text.trim() && q.options.filter((o) => o.trim()).length >= 2 && q.correctOptions.length).length;
  const total = questions.length * marksEach;

  return (
    <div className="space-y-3">
      {/* summary bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-white px-3 py-2 ring-1 ring-orange-100">
        <p className="text-[12.5px] font-bold text-slate-900">Questions</p>
        <p className="text-[11.5px] text-slate-500"><b className="text-slate-800">{done}</b> of {questions.length} ready</p>
        <label className="ml-auto flex items-center gap-2 text-[11.5px] text-slate-600">
          Marks for each question
          <input
            type="number"
            min={1}
            value={section.marksPerQuestion}
            onChange={(e) => save(questions, { marksPerQuestion: e.target.value })}
            className="h-7 w-14 rounded-md border border-slate-200 px-2 text-center text-[12px] outline-none focus:border-blue-400"
          />
        </label>
        <p className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-bold text-orange-700">Total {total} marks</p>
      </div>

      <AnimatePresence initial={false}>
        {questions.map((q, i) => {
          const ready = q.text.trim() && q.options.filter((o) => o.trim()).length >= 2 && q.correctOptions.length;
          return (
            <Motion.div
              key={q.key || i}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="flex items-start gap-2.5">
                <span className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${ready ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {ready ? <Check className="size-3.5" /> : i + 1}
                </span>
                <input
                  value={q.text}
                  onChange={(e) => updateQ(i, { text: e.target.value })}
                  placeholder={`Type question ${i + 1} here…`}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <button type="button" onClick={() => duplicateQ(i)} title="Duplicate question" aria-label={`Duplicate question ${i + 1}`} className="mt-1 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Copy className="size-3.5" /></button>
                <button type="button" onClick={() => removeQ(i)} title="Delete question" aria-label={`Delete question ${i + 1}`} className="mt-1 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-3.5" /></button>
              </div>

              <p className="mb-1.5 ml-8.5 mt-2 text-[10.5px] font-medium text-slate-400">Type the options, then click the circle next to the correct answer.</p>
              <div className="ml-8.5 grid gap-1.5 sm:grid-cols-2">
                {q.options.map((opt, o) => {
                  const correct = q.correctOptions.includes(o);
                  return (
                    <div key={o} className={`flex items-center gap-2 rounded-lg border px-2 py-1 transition ${correct ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                      <button
                        type="button"
                        onClick={() => updateQ(i, { correctOptions: [o] })}
                        aria-label={`Mark option ${LETTERS[o]} as correct`}
                        title="Mark as correct answer"
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition ${correct ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'}`}
                      >
                        {correct && <Check className="size-3" />}
                      </button>
                      <span className="text-[11px] font-bold text-slate-400">{LETTERS[o]}</span>
                      <input
                        value={opt}
                        onChange={(e) => setOption(i, o, e.target.value)}
                        placeholder={`Option ${LETTERS[o]}`}
                        className="h-7 min-w-0 flex-1 bg-transparent text-[12.5px] text-slate-800 outline-none placeholder:text-slate-400"
                      />
                      {correct && <span className="text-[10px] font-bold text-emerald-700">Correct</span>}
                      {q.options.length > 2 && (
                        <button type="button" onClick={() => removeOption(i, o)} aria-label={`Remove option ${LETTERS[o]}`} className="text-slate-300 hover:text-red-500"><X className="size-3.5" /></button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="ml-8.5 mt-2 flex flex-wrap items-center gap-3">
                {/* Correct answer — same as clicking the circle, but explicit */}
                <label className="flex items-center gap-2 text-[11.5px] font-semibold text-slate-700">
                  Correct answer
                  <select
                    value={q.correctOptions.length ? String(q.correctOptions[0]) : ''}
                    onChange={(e) => updateQ(i, { correctOptions: e.target.value === '' ? [] : [Number(e.target.value)] })}
                    className={`h-7 rounded-md border px-2 text-[12px] font-semibold outline-none ${q.correctOptions.length ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}
                    aria-label={`Correct answer for question ${i + 1}`}
                  >
                    <option value="">Select…</option>
                    {q.options.map((opt, o) => (
                      <option key={o} value={o}>{LETTERS[o]}{opt.trim() ? ` – ${opt.trim().slice(0, 40)}` : ''}</option>
                    ))}
                  </select>
                </label>
                {q.options.length < 6 && (
                  <button type="button" onClick={() => addOption(i)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"><Plus className="size-3" /> Add option</button>
                )}
              </div>
            </Motion.div>
          );
        })}
      </AnimatePresence>

      <button
        type="button"
        onClick={addQ}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-orange-200 bg-white py-2.5 text-[12.5px] font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50"
      >
        <Plus className="size-4" /> Add question
      </button>
    </div>
  );
};

export default SimpleMcqEditor;
