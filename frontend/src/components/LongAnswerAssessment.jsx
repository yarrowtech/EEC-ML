import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Loader2, Send, CheckCircle, Clock, AlertCircle, ChevronLeft } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const LongAnswerAssessment = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  }), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/long-answer-assessments/student/questions`, { headers: headers() });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Unable to load questions');
      setQuestions(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setError(err.message || 'Unable to load questions');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const openQuestion = (q) => {
    setActive(q);
    setAnswerText('');
    setSubmitError('');
    setResult(null);
  };

  const submitAnswer = async () => {
    if (answerText.trim().length < 10) {
      setSubmitError('Your answer must be at least 10 characters');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${API_BASE}/api/long-answer-assessments/student/questions/${active._id}/submit`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ answerText }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Unable to submit answer');
      setResult(payload.data);
      await load();
    } catch (err) {
      setSubmitError(err.message || 'Unable to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  if (active) {
    const already = active.submission;
    return (
      <div className="space-y-5 p-3 pb-24 md:p-5 md:pb-6">
        <button onClick={() => setActive(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-indigo-600 transition-colors">
          <ChevronLeft size={16} /> Back to questions
        </button>
        <div className="rounded-2xl border border-indigo-100 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{active.subject} {active.topicTitle ? `· ${active.topicTitle}` : ''}</p>
          <h1 className="mt-1 text-lg font-bold text-slate-900">{active.questionText}</h1>
          <p className="mt-2 text-xs text-slate-500">Max marks: {active.maxMarks}{active.dueDate ? ` • Due ${new Date(active.dueDate).toLocaleDateString()}` : ''}</p>
        </div>

        {result ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-center gap-2 text-emerald-700"><CheckCircle size={18} /><p className="font-bold">Answer submitted</p></div>
            <p className="mt-2 text-sm text-emerald-800">Marks: {result.marks ?? '—'} / {result.maxMarks}</p>
            {result.feedback && <p className="mt-2 text-sm text-emerald-800">{result.feedback}</p>}
            {Array.isArray(result.missingConcepts) && result.missingConcepts.length > 0 && (
              <p className="mt-2 text-xs text-emerald-700">Missing concepts: {result.missingConcepts.join(', ')}</p>
            )}
            {result.pendingTeacherReview && <p className="mt-2 text-xs text-amber-700">Your teacher will review this grade.</p>}
          </div>
        ) : already ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-slate-700"><Clock size={18} /><p className="font-bold">You already submitted this answer</p></div>
            <p className="mt-2 text-sm text-slate-600">Status: {already.status}{already.reviewed ? ' · Reviewed by teacher' : ''}</p>
            {already.finalMarks !== null && already.finalMarks !== undefined && (
              <p className="mt-2 text-sm text-slate-700">Marks: {already.finalMarks} / {active.maxMarks}</p>
            )}
            {already.feedback && <p className="mt-2 text-sm text-slate-600">{already.feedback}</p>}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <label className="block text-sm font-semibold text-slate-700" htmlFor="long-answer-text">Your answer</label>
            <textarea
              id="long-answer-text"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              rows={10}
              placeholder="Write your answer here..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
            {submitError && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-5 w-5 shrink-0" />{submitError}</div>}
            <button onClick={submitAnswer} disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? 'Submitting…' : 'Submit Answer'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 p-3 pb-24 md:p-5 md:pb-6">
      <header className="rounded-2xl border border-indigo-100 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Assessment</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Long-Answer Questions</h1>
        <p className="mt-2 text-sm text-slate-600">Questions assigned by your teacher that need a written answer.</p>
      </header>
      {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-5 w-5" />{error}</div>}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        {loading ? (
          <p className="text-sm text-slate-500">Loading questions...</p>
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <ClipboardList className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">No long-answer questions assigned yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <button
                key={q._id}
                onClick={() => openQuestion(q)}
                className="w-full text-left rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900 line-clamp-2">{q.questionText}</p>
                    <p className="mt-1 text-xs text-slate-500">{q.subject}{q.topicTitle ? ` · ${q.topicTitle}` : ''} · {q.maxMarks} marks</p>
                  </div>
                  {q.submission ? (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      {q.submission.reviewed ? 'Reviewed' : 'Submitted'}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Pending</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default LongAnswerAssessment;
