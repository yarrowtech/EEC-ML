import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Loader2, XCircle } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

// ── Step 1: Choose which baseline to take ─────────────────────────────────────
function PendingList({ onSelect }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/api/baseline/pending`, { headers: authH() })
      .then((r) => r.json())
      .then((d) => setPending(Array.isArray(d.data) ? d.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!pending.length) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-400" />
        <p className="text-lg font-bold text-gray-800">All baselines complete!</p>
        <p className="text-sm text-gray-500">You can now access your full learning dashboard.</p>
        <button
          className="mt-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          onClick={() => navigate('/student')}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-black text-gray-900">Baseline Assessment</h2>
      <p className="text-sm text-gray-500">
        Your teacher has prepared a short baseline quiz to personalise your learning path.
        Complete all subjects below.
      </p>
      <div className="space-y-3">
        {pending.map((q) => (
          <button
            key={q._id}
            onClick={() => onSelect(q)}
            className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
          >
            <div>
              <p className="font-bold text-gray-900">{q.subject}</p>
              <p className="text-xs text-gray-400">Baseline Assessment · ~5 questions</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Take a single baseline quiz ───────────────────────────────────────
function TakeQuiz({ quiz, quizMeta, onDone }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const q = quiz.questions[current];
  const total = quiz.questions.length;
  const allAnswered = quiz.questions.every((_, i) => answers[i] !== undefined);

  const handleOption = (optIdx) => {
    setAnswers((prev) => ({ ...prev, [current]: optIdx }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = quiz.questions.map((_, i) => ({ questionIdx: i, chosen: answers[i] ?? -1 }));
      const res = await fetch(`${API_BASE}/api/baseline/${quizMeta._id}/submit`, {
        method: 'POST',
        headers: { ...authH(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      }
    } catch (_) {}
    setSubmitting(false);
  };

  if (result) {
    const levelColor = {
      mastered: 'text-emerald-600',
      proficient: 'text-blue-600',
      developing: 'text-amber-600',
      basic: 'text-orange-600',
      foundational: 'text-red-600',
    }[result.masteryLevel] || 'text-gray-600';

    return (
      <div className="flex flex-col items-center gap-6 py-10 text-center">
        {result.score >= 60 ? (
          <CheckCircle2 className="h-14 w-14 text-emerald-400" />
        ) : (
          <XCircle className="h-14 w-14 text-orange-400" />
        )}
        <div>
          <p className="text-3xl font-black text-gray-900">{result.score}%</p>
          <p className={`mt-1 text-sm font-bold capitalize ${levelColor}`}>{result.masteryLevel}</p>
          <p className="mt-2 text-sm text-gray-500">
            {result.correct} of {result.total} correct — your learning path has been personalised!
          </p>
        </div>
        <button
          className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          onClick={onDone}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{quizMeta.subject} — Baseline</span>
          <span>Q {current + 1} / {total}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100">
          <div
            className="h-1.5 rounded-full bg-indigo-500 transition-all"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="mb-5 text-base font-semibold text-gray-900">{q.questionText}</p>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            const selected = answers[current] === i;
            return (
              <button
                key={i}
                onClick={() => handleOption(i)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  selected
                    ? 'border-indigo-400 bg-indigo-50 font-semibold text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-200 hover:bg-gray-50'
                }`}
              >
                <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                  selected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 text-gray-500'
                }`}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt.text}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          disabled={current === 0}
          onClick={() => setCurrent((c) => c - 1)}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30"
        >
          Previous
        </button>
        {current < total - 1 ? (
          <button
            disabled={answers[current] === undefined}
            onClick={() => setCurrent((c) => c + 1)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            disabled={!allAnswered || submitting}
            onClick={handleSubmit}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Submit
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main orchestrator ─────────────────────────────────────────────────────────
export default function BaselineQuiz() {
  const [selectedMeta, setSelectedMeta] = useState(null);   // { _id, subject }
  const [quiz, setQuiz] = useState(null);                   // full quiz with questions
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [completedIds, setCompletedIds] = useState(new Set());
  const navigate = useNavigate();

  const handleSelect = async (meta) => {
    setSelectedMeta(meta);
    setLoadingQuiz(true);
    try {
      const res = await fetch(`${API_BASE}/api/baseline/${meta._id}`, { headers: authH() });
      const data = await res.json();
      if (data.success) setQuiz(data.data);
    } catch (_) {}
    setLoadingQuiz(false);
  };

  const handleDone = () => {
    setCompletedIds((prev) => new Set([...prev, selectedMeta._id]));
    setSelectedMeta(null);
    setQuiz(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100">
            <span className="text-2xl">📊</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900">Welcome!</h1>
          <p className="mt-1 text-sm text-gray-500">
            Let's find out where you are so your teacher can personalise your learning path.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          {!selectedMeta && (
            <PendingList
              key={[...completedIds].join(',')}
              onSelect={handleSelect}
            />
          )}
          {selectedMeta && loadingQuiz && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          )}
          {selectedMeta && !loadingQuiz && quiz && (
            <TakeQuiz quiz={quiz} quizMeta={selectedMeta} onDone={handleDone} />
          )}
        </div>
      </div>
    </div>
  );
}
