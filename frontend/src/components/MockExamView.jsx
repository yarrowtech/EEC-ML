import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Loader2, Lock, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

// ── Countdown Display ─────────────────────────────────────────────────────────
const TimeUnit = ({ value, label }) => (
  <div className="flex flex-col items-center">
    <div className={`flex h-14 w-14 items-center justify-center rounded-xl font-black text-2xl tabular-nums
      ${value <= 5 && label === 'sec' ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/20 text-white'}`}>
      {String(value).padStart(2, '0')}
    </div>
    <span className="mt-1 text-[10px] uppercase tracking-widest text-white/60">{label}</span>
  </div>
);

const Separator = () => <span className="text-white/40 font-black text-xl pb-4">:</span>;

const ExamCountdown = ({ secondsLeft }) => {
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  const urgent = secondsLeft <= 300;
  return (
    <div className={`flex items-center gap-2 rounded-xl px-4 py-2 ${urgent ? 'bg-rose-600' : 'bg-indigo-700'}`}>
      <Clock className="w-4 h-4 text-white/80" />
      <div className="flex items-end gap-1">
        {h > 0 && <><TimeUnit value={h} label="hr" /><Separator /></>}
        <TimeUnit value={m} label="min" />
        <Separator />
        <TimeUnit value={s} label="sec" />
      </div>
    </div>
  );
};

// ── Result Screen ─────────────────────────────────────────────────────────────
const ResultScreen = ({ attempt, examTitle, onReview, onClose }) => {
  const pct = attempt?.percentage ?? 0;
  const passed = pct >= 40;
  return (
    <Motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 py-12 px-4"
    >
      <div className={`flex h-24 w-24 items-center justify-center rounded-full text-5xl shadow-lg
        ${pct >= 80 ? 'bg-emerald-100' : pct >= 40 ? 'bg-amber-100' : 'bg-rose-100'}`}>
        {pct >= 80 ? '🏆' : pct >= 40 ? '📘' : '📖'}
      </div>
      <div className="text-center">
        <p className="text-3xl font-black text-gray-900">{pct}%</p>
        <p className="text-gray-500 mt-1">{attempt.marksScored} / {attempt.totalMarks} marks</p>
        <Badge className={`mt-2 ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {passed ? 'Passed' : 'Needs Improvement'}
        </Badge>
      </div>
      <p className="text-center text-gray-600 max-w-sm">
        {pct >= 80
          ? 'Excellent work! You have a strong grasp of this topic.'
          : pct >= 40
          ? 'Good effort! Review the topics you missed and try again.'
          : 'Don\'t give up — review the material and give it another go!'}
      </p>
      <div className="flex gap-3">
        <button onClick={onReview}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors">
          Review Wrong Answers
        </button>
        <button onClick={onClose}
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors">
          Close
        </button>
      </div>
    </Motion.div>
  );
};

// ── Main MockExamView ─────────────────────────────────────────────────────────
export default function MockExamView({ examId, examTitle, durationMinutes = 60, isMock = false, onClose, onFinished }) {
  const [phase, setPhase] = useState('loading'); // loading | briefing | exam | submitting | results
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [attempt, setAttempt] = useState(null);
  const [warnings, setWarnings] = useState(0);
  const timerRef = useRef(null);
  const attemptStartedRef = useRef(false);

  const token = localStorage.getItem('token');

  // ── Anti-copy / security measures ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'exam') return;

    const block = (e) => { e.preventDefault(); return false; };
    const warnUser = () => {
      setWarnings((w) => {
        const next = w + 1;
        if (next >= 3) {
          toast.error('Multiple tab-switch violations detected. Exam auto-submitted.');
          handleSubmit(true);
        } else {
          toast('⚠️ Please stay on the exam tab!', { icon: '🔒', duration: 3000 });
        }
        return next;
      });
    };

    const handleVisibility = () => { if (document.hidden) warnUser(); };
    const handleKeyDown = (e) => {
      // Block common copy shortcuts and browser shortcuts that expose content
      if ((e.ctrlKey || e.metaKey) && ['c', 'a', 'p', 'u', 's'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i', 'j'].includes(e.key.toLowerCase()))) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', block);
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    return () => {
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, [phase]);

  // ── Load questions ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!examId) return;
    fetch(`${API_BASE}/api/mock-exam/attempt/${examId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.success) {
          setQuestions(payload.data.questions || []);
          if (payload.data.existingAttempt?.status === 'submitted') {
            setAttempt(payload.data.existingAttempt);
            setPhase('results');
          } else {
            setPhase('briefing');
          }
        } else {
          toast.error(payload.error || 'Failed to load exam');
          onClose?.();
        }
      })
      .catch(() => { toast.error('Network error'); onClose?.(); });
  }, [examId]);

  // ── Start attempt ─────────────────────────────────────────────────────────
  const startExam = async () => {
    if (attemptStartedRef.current) { setPhase('exam'); return; }
    try {
      const r = await fetch(`${API_BASE}/api/mock-exam/attempt/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ examId, isMock }),
      });
      const payload = await r.json();
      if (payload.success) {
        attemptStartedRef.current = true;
        setPhase('exam');
      } else {
        toast.error(payload.error || 'Could not start exam');
      }
    } catch {
      toast.error('Network error');
    }
  };

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'exam') return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          handleSubmit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (timedOut = false) => {
    if (phase === 'submitting' || phase === 'results') return;
    clearInterval(timerRef.current);
    setPhase('submitting');

    const answersArr = Object.entries(answers).map(([questionId, studentAnswer]) => ({
      questionId,
      studentAnswer,
    }));

    try {
      const r = await fetch(`${API_BASE}/api/mock-exam/attempt/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ examId, answers: answersArr, timedOut }),
      });
      const payload = await r.json();
      if (payload.success) {
        setAttempt(payload.data);
        setPhase('results');
        onFinished?.(payload.data);
      } else {
        toast.error(payload.error || 'Submission failed');
        setPhase('exam');
      }
    } catch {
      toast.error('Network error during submission');
      setPhase('exam');
    }
  }, [phase, answers, examId]);

  const handleReview = () => {
    if (onFinished) onFinished(attempt, 'review');
    else onClose?.();
  };

  // ── Render phases ─────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (phase === 'briefing') {
    return (
      <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="max-w-lg mx-auto p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-3xl mx-auto">📝</div>
          <h2 className="text-2xl font-black text-gray-900">{examTitle || 'Exam'}</h2>
          <p className="text-gray-500">{questions.length} questions · {durationMinutes} minutes</p>
        </div>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 space-y-2">
            <p className="font-semibold text-amber-800 flex items-center gap-2"><Shield className="w-4 h-4" />Exam Rules</p>
            <ul className="text-sm text-amber-700 space-y-1 list-disc pl-4">
              <li>Do not switch tabs or windows during the exam</li>
              <li>Copy-paste and right-click are disabled</li>
              <li>The exam will auto-submit when time runs out</li>
              <li>3 tab-switch violations = automatic submission</li>
            </ul>
          </CardContent>
        </Card>
        <button onClick={startExam}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
          <Lock className="w-5 h-5" /> Start Exam
        </button>
      </Motion.div>
    );
  }

  if (phase === 'results') {
    return <ResultScreen attempt={attempt} examTitle={examTitle} onReview={handleReview} onClose={onClose} />;
  }

  if (phase === 'submitting') {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-gray-500">Grading your answers…</p>
      </div>
    );
  }

  // ── Exam phase ─────────────────────────────────────────────────────────────
  const q = questions[currentIdx];
  const answered = Object.keys(answers).length;
  const total = questions.length;
  const progressPct = Math.round((answered / total) * 100);

  return (
    <div className="flex flex-col h-full min-h-0 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white rounded-t-2xl shrink-0">
        <div>
          <p className="font-bold text-sm">{examTitle}</p>
          <p className="text-xs text-indigo-200">{answered}/{total} answered</p>
        </div>
        <ExamCountdown secondsLeft={secondsLeft} />
      </div>

      {/* Security warning bar */}
      {warnings > 0 && (
        <div className="flex items-center gap-2 bg-rose-50 border-b border-rose-200 px-4 py-2 text-sm text-rose-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Tab-switch violation {warnings}/3 — stay focused!
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <Motion.div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <AnimatePresence mode="wait">
          <Motion.div
            key={currentIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {q && (
              <>
                <div className="flex items-start gap-3">
                  <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">
                    {currentIdx + 1}
                  </span>
                  <p className="text-gray-800 font-medium leading-relaxed pt-1">{q.question}</p>
                </div>

                {q.type === 'mcq' || q.type === 'true_false' ? (
                  <div className="space-y-2 pl-11">
                    {(q.options?.length ? q.options : ['True', 'False']).map((opt, i) => {
                      const selected = answers[String(q._id)] === opt;
                      return (
                        <button
                          key={i}
                          onClick={() => setAnswers((prev) => ({ ...prev, [String(q._id)]: opt }))}
                          className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all
                            ${selected
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                              : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50 text-gray-700'}`}
                        >
                          <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    className="w-full ml-11 rounded-xl border-2 border-gray-200 p-3 text-sm text-gray-700 resize-none focus:border-indigo-400 focus:outline-none"
                    rows={5}
                    placeholder="Write your answer here…"
                    value={answers[String(q._id)] || ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [String(q._id)]: e.target.value }))}
                    style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                  />
                )}
              </>
            )}
          </Motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="shrink-0 border-t border-gray-100 p-4 flex items-center justify-between gap-3">
        {/* Question dots */}
        <div className="flex gap-1 flex-wrap max-w-[200px]">
          {questions.map((qs, i) => (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={`h-5 w-5 rounded-full text-[9px] font-bold transition-all
                ${i === currentIdx ? 'bg-indigo-600 text-white scale-110' : answers[String(qs._id)] ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" />
          </button>
          {currentIdx < questions.length - 1 ? (
            <button onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 flex items-center gap-1">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => handleSubmit(false)}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
