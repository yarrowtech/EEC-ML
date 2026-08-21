/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CheckCircle2, CircleAlert, Loader2, RefreshCw, Send,
} from 'lucide-react';
import { motion as Motion } from 'framer-motion';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const QuickPracticeRunner = ({ subject, initialType = 'mcq', onBack }) => {
  const [type, setType] = useState(initialType === 'blank' ? 'blank' : 'mcq');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const subjectId = String(subject?.id || subject?._id || '');
  const subjectName = subject?.name || 'Practice activity';
  const token = localStorage.getItem('token');
  const answeredCount = questions.filter((question) => String(answers[question.id] || '').trim()).length;
  const correctCount = results
    ? Object.values(results).filter((result) => result?.isCorrect).length
    : 0;
  const score = results && questions.length
    ? Math.round((correctCount / questions.length) * 100)
    : null;

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  useEffect(() => {
    const controller = new AbortController();
    const loadQuestions = async () => {
      if (!subjectId) {
        setQuestions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      setAnswers({});
      setResults(null);
      try {
        const params = new URLSearchParams({ subjectId, type });
        const response = await fetch(`${API_BASE}/api/practice/student/questions?${params}`, {
          headers: authHeaders,
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || 'Unable to load this activity');
        setQuestions(Array.isArray(data?.questions) ? data.questions : []);
      } catch (loadError) {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'Unable to load this activity');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadQuestions();
    return () => controller.abort();
  }, [authHeaders, subjectId, type]);

  const submitAnswers = async () => {
    if (!questions.length || answeredCount !== questions.length) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/practice/student/submit`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          answers: questions.map((question) => ({
            questionId: question.id,
            answer: answers[question.id] || '',
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Unable to submit your answers');
      setResults(Object.fromEntries(
        (data?.results || []).map((result) => [String(result.questionId), result])
      ));
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit your answers');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef2ff_0,#f8fafc_45%,#f5f3ff_100%)] p-3 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-[1.75rem] border border-white/80 bg-white/70 p-4 shadow-[0_20px_60px_-28px_rgba(79,70,229,0.28)] backdrop-blur-xl sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={onBack} aria-label="Back to activities" className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:-translate-x-0.5 hover:border-indigo-200 hover:text-indigo-700">
                <ArrowLeft size={18} />
              </button>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Teacher activity</p>
                <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">{subjectName}</h1>
                <p className="text-xs text-slate-500">{type === 'mcq' ? 'Multiple-choice practice' : 'Fill in the blanks'}</p>
              </div>
            </div>
            <div className="flex rounded-full border border-slate-200 bg-slate-100/80 p-1">
              {[
                { key: 'mcq', label: 'MCQ' },
                { key: 'blank', label: 'Fill blanks' },
              ].map((option) => (
                <button key={option.key} type="button" onClick={() => setType(option.key)} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${type === option.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {!loading && questions.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                <span>{results ? 'Completed' : `${answeredCount} of ${questions.length} answered`}</span>
                {score !== null && <span className="font-bold text-indigo-700">Score {score}%</span>}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <Motion.div initial={false} animate={{ width: `${results ? 100 : (answeredCount / questions.length) * 100}%` }} className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
              </div>
            </div>
          )}
        </section>

        {error && <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"><CircleAlert size={17} /> {error}</div>}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-3xl border border-white bg-white/70 py-16 text-sm text-slate-500 backdrop-blur-xl"><Loader2 className="animate-spin text-indigo-500" size={20} /> Loading activity…</div>
        ) : questions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 py-14 text-center backdrop-blur-xl">
            <CheckCircle2 className="mx-auto mb-3 text-slate-300" size={34} />
            <h2 className="font-bold text-slate-700">No {type === 'mcq' ? 'MCQ' : 'fill-blank'} questions yet</h2>
            <p className="mt-1 text-sm text-slate-500">Your teacher has not published this activity for {subjectName}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((question, index) => {
              const id = String(question.id);
              const result = results?.[id];
              return (
                <Motion.article key={id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.04, 0.2) }} className="rounded-3xl border border-white/90 bg-white/75 p-4 shadow-[0_12px_36px_-24px_rgba(15,23,42,0.24)] backdrop-blur-xl sm:p-6">
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-700">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="font-semibold leading-6 text-slate-900">{question.question}</h2>
                        {result && <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${result.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{result.isCorrect ? 'Correct' : 'Review'}</span>}
                      </div>
                      {question.type === 'mcq' ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {(question.options || []).map((option, optionIndex) => {
                            const selected = answers[id] === option;
                            const correct = result?.correctAnswer === option;
                            const stateClass = result
                              ? correct ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : selected ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-500'
                              : selected ? 'border-indigo-400 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/40';
                            return (
                              <button key={`${option}-${optionIndex}`} type="button" disabled={Boolean(results)} onClick={() => setAnswers((previous) => ({ ...previous, [id]: option }))} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${stateClass}`}>
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/80 text-[10px] font-bold">{String.fromCharCode(65 + optionIndex)}</span>
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <input type="text" value={answers[id] || ''} disabled={Boolean(results)} onChange={(event) => setAnswers((previous) => ({ ...previous, [id]: event.target.value }))} placeholder="Type your answer" className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50" />
                      )}
                      {result && (
                        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${result.isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
                          {!result.isCorrect && <p><span className="font-semibold">Correct answer:</span> {result.correctAnswer}</p>}
                          {result.explanation && <p className="mt-1 text-slate-600">{result.explanation}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </Motion.article>
              );
            })}

            <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-2xl border border-white/90 bg-white/80 p-3 shadow-[0_16px_50px_-20px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <p className="hidden text-xs font-medium text-slate-500 sm:block">{results ? `${correctCount} of ${questions.length} correct` : `${questions.length - answeredCount} remaining`}</p>
              {results ? (
                <button type="button" onClick={() => { setAnswers({}); setResults(null); }} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><RefreshCw size={15} /> Try again</button>
              ) : (
                <button type="button" onClick={submitAnswers} disabled={submitting || answeredCount !== questions.length} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
                  {submitting ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
                  {submitting ? 'Submitting…' : 'Submit answers'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickPracticeRunner;
