import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock, Expand, FileQuestion, Loader2, Lock, Send, ShieldCheck, XCircle,
} from 'lucide-react';
import { clearStudentApiCacheByUrl } from '../utils/studentApiCache';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const ASSIGNMENTS_ENDPOINT = `${API_BASE}/api/assignment/student/assignments`;
const TYPE_HINT = {
  mcq_single: 'Choose one answer',
  mcq_multiple: 'Choose all correct answers',
  fill_blank: 'Fill in the blank',
  true_false: 'True or False',
  short_answer: 'Write a short answer',
};
const BLOCKED_KEYS = new Set(['c', 'x', 'v', 'a', 'p', 's', 'u']);

const storage = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } },
};
const isAnswered = (v) => !(v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length));
const formatClock = (secs) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
const inFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
const enterFullscreen = async () => {
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch { /* the browser refused; the overlay keeps asking */ }
};
const exitFullscreen = () => {
  try {
    if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen();
    else if (document.webkitExitFullscreen && document.webkitFullscreenElement) document.webkitExitFullscreen();
  } catch { /* ignore */ }
};

const QuizAttemptPage = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [phase, setPhase] = useState('loading'); // loading | intro | running | submitted | done
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(null);
  const [isFull, setIsFull] = useState(inFullscreen());
  const [warning, setWarning] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const integrity = useRef({ tabSwitches: 0, fullscreenExits: 0, copyAttempts: 0, autoSubmitted: false });
  const submittingRef = useRef(false);

  const draftKey = `eec.quizDraft.${assignmentId}`;

  const goBack = useCallback(() => {
    exitFullscreen();
    if (window.history.length > 1) navigate(-1);
    else navigate('/student/assignments');
  }, [navigate]);

  // Load the (answer-key-free) quiz for this student.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(ASSIGNMENTS_ENDPOINT, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        const found = (Array.isArray(data) ? data : []).find((a) => String(a._id) === String(assignmentId));
        if (cancelled) return;
        if (!found) throw new Error('This quiz was not found or is not assigned to you.');
        if (!found.isQuiz) throw new Error('This assignment is not a quiz.');
        setAssignment(found);
        const done = ['submitted', 'late', 'graded'].includes(found.submissionStatus);
        if (done) {
          storage.remove(draftKey);
          setPhase('submitted');
          return;
        }
        const draft = storage.get(draftKey);
        if (draft?.answers) setAnswers(draft.answers);
        if (draft?.integrity) integrity.current = { ...integrity.current, ...draft.integrity };
        setPhase('intro');
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.response?.data?.error || err.message || 'Unable to load the quiz');
          setPhase('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [assignmentId, draftKey]);

  const questions = useMemo(() => {
    if (!assignment) return [];
    const flat = [];
    (assignment.quizSections || []).forEach((section, sIdx) => {
      section.questions.forEach((q, qIdx) => flat.push({ ...q, id: String(q._id), section, sIdx, number: qIdx + 1 }));
    });
    return flat;
  }, [assignment]);
  const answeredCount = questions.filter((q) => isAnswered(answers[q.id])).length;

  // Persist progress so a refresh or crash does not lose answers.
  useEffect(() => {
    if (phase !== 'running') return;
    const prev = storage.get(draftKey) || {};
    storage.set(draftKey, { ...prev, answers, integrity: integrity.current });
  }, [answers, phase, draftKey]);

  const submit = useCallback(async ({ auto = false } = {}) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    integrity.current.autoSubmitted = auto;
    try {
      await axios.post(`${API_BASE}/api/assignment/submit`, {
        assignmentId,
        quizAnswers: answers,
        integrityEvents: integrity.current,
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      storage.remove(draftKey);
      clearStudentApiCacheByUrl(ASSIGNMENTS_ENDPOINT);
      setConfirmOpen(false);
      setPhase('done');
      exitFullscreen();
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Submission failed. Check your connection and try again.');
      submittingRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [answers, assignmentId, draftKey]);

  const start = async () => {
    await enterFullscreen();
    setIsFull(inFullscreen());
    const prev = storage.get(draftKey) || {};
    const startedAt = prev.startedAt || Date.now();
    storage.set(draftKey, { ...prev, startedAt, answers, integrity: integrity.current });
    if (assignment.timeLimit) {
      const left = Math.round(assignment.timeLimit * 60 - (Date.now() - startedAt) / 1000);
      setRemaining(Math.max(0, left));
    }
    setPhase('running');
  };

  // Countdown; the start time lives in storage so refreshing does not reset it.
  useEffect(() => {
    if (phase !== 'running' || remaining === null) return undefined;
    if (remaining <= 0) { submit({ auto: true }); return undefined; }
    const t = setTimeout(() => setRemaining((r) => (r === null ? r : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [phase, remaining, submit]);

  // Exam-mode restrictions while the quiz is running.
  useEffect(() => {
    if (phase !== 'running') return undefined;
    const flash = (msg) => { setWarning(msg); window.clearTimeout(flash.t); flash.t = window.setTimeout(() => setWarning(''), 3000); };
    const block = (e) => {
      e.preventDefault();
      integrity.current.copyAttempts += 1;
      flash('Copying, cutting and pasting are disabled during the quiz.');
    };
    const onKey = (e) => {
      const key = String(e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && BLOCKED_KEYS.has(key)) { block(e); return; }
      if (key === 'f12' || key === 'printscreen' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(key))) {
        e.preventDefault();
        integrity.current.copyAttempts += 1;
        if (key === 'printscreen') navigator.clipboard?.writeText?.('').catch(() => {});
        flash('This action is disabled during the quiz.');
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        integrity.current.tabSwitches += 1;
        flash('Leaving the quiz window is recorded and reported to your teacher.');
      }
    };
    const onBlur = () => { if (!document.hidden) integrity.current.tabSwitches += 1; };
    const onFullscreen = () => {
      const full = inFullscreen();
      setIsFull(full);
      if (!full && !submittingRef.current) integrity.current.fullscreenExits += 1;
    };
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    const prevent = (e) => e.preventDefault();

    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('paste', block);
    document.addEventListener('contextmenu', prevent);
    document.addEventListener('dragstart', prevent);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('webkitfullscreenchange', onFullscreen);
    window.addEventListener('blur', onBlur);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('paste', block);
      document.removeEventListener('contextmenu', prevent);
      document.removeEventListener('dragstart', prevent);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('webkitfullscreenchange', onFullscreen);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [phase]);

  const setAnswer = (id, value) => setAnswers((prev) => ({ ...prev, [id]: value }));

  // ── Screens ──────────────────────────────────────────────────────────────
  const shell = (children) => (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">{children}</div>
  );

  if (phase === 'loading') return shell(<Loader2 className="size-8 animate-spin text-blue-600" />);

  if (phase === 'error') return shell(
    <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
      <XCircle className="mx-auto mb-3 size-10 text-rose-500" />
      <p className="mb-5 text-sm text-slate-600">{loadError}</p>
      <button type="button" onClick={goBack} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Back to assignments</button>
    </div>,
  );

  if (phase === 'done' || phase === 'submitted') {
    const result = assignment?.quizResult;
    return shell(
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <CheckCircle2 className="mx-auto mb-3 size-12 text-emerald-500" />
          <h1 className="text-xl font-bold text-slate-900">{phase === 'done' ? 'Quiz submitted!' : 'You have already submitted this quiz'}</h1>
          <p className="mt-1 text-sm text-slate-500">{assignment?.title}</p>
          {assignment?.publishedByTeacher && assignment.score !== undefined
            ? <p className="mt-4 text-3xl font-bold text-blue-600">{assignment.score}<span className="text-lg text-slate-400"> / {assignment.marks}</span></p>
            : <p className="mt-4 text-sm text-slate-500">Your teacher will review your answers and publish your marks.</p>}
          {assignment?.feedback && <p className="mx-auto mt-3 max-w-md rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{assignment.feedback}</p>}
        </div>
        {result?.breakdown?.length > 0 && (
          <div className="mt-6 max-h-[45vh] space-y-2 overflow-y-auto">
            {result.breakdown.map((row, i) => (
              <div key={row.questionId || i} className="rounded-xl border border-slate-100 p-3 text-sm">
                <p className="font-medium text-slate-800">{i + 1}. {row.question}</p>
                <p className="mt-1 text-slate-600">Your answer: <span className={row.correct === true ? 'text-emerald-600' : row.correct === false ? 'text-rose-600' : 'text-slate-700'}>{row.studentAnswer}</span></p>
                {row.correct === false && <p className="text-emerald-700">Correct answer: {row.correctAnswer}</p>}
              </div>
            ))}
          </div>
        )}
        <div className="mt-6 text-center">
          <button type="button" onClick={goBack} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"><ArrowLeft className="size-4" /> Back to assignments</button>
        </div>
      </div>,
    );
  }

  if (phase === 'intro') {
    const resumed = answeredCount > 0;
    return shell(
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-blue-600 text-white"><FileQuestion className="size-6" /></span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{assignment.title}</h1>
            <p className="text-sm text-slate-500">{assignment.subject}{assignment.teacherId?.name ? ` · ${assignment.teacherId.name}` : ''}</p>
          </div>
        </div>
        <div className="mb-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-slate-900">{questions.length}</p><p className="text-[11px] text-slate-500">Questions</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-slate-900">{assignment.marks}</p><p className="text-[11px] text-slate-500">Total marks</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-bold text-slate-900">{assignment.timeLimit ? `${assignment.timeLimit} min` : '—'}</p><p className="text-[11px] text-slate-500">Time limit</p></div>
        </div>
        <div className="mb-4 space-y-1.5">
          {(assignment.quizSections || []).map((s, i) => (
            <div key={s._id || i} className="flex justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
              <span className="text-slate-700">Section {String.fromCharCode(65 + i)}: {s.title}</span>
              <span className="text-slate-500">{s.questions.length} Q · {s.questions.reduce((n, q) => n + (q.marks || 0), 0)} marks</span>
            </div>
          ))}
        </div>
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="mb-1.5 flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" /> Exam rules</p>
          <ul className="list-disc space-y-0.5 pl-5 text-[13px]">
            <li>The quiz opens in full screen. Stay in full screen until you submit.</li>
            <li>Copying, pasting and right-click are disabled.</li>
            <li>Switching tabs or leaving full screen is recorded and shared with your teacher.</li>
            {assignment.timeLimit ? <li>The quiz submits automatically when the timer reaches zero.</li> : null}
            <li>You can submit only once.</li>
          </ul>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={goBack} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={start} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"><Expand className="size-4" /> {resumed ? 'Resume quiz in full screen' : 'Start quiz in full screen'}</button>
        </div>
      </div>,
    );
  }

  // ── Running ──────────────────────────────────────────────────────────────
  const q = questions[current];
  const lowTime = remaining !== null && remaining <= 60;

  return (
    <div className="flex h-screen select-none flex-col bg-slate-50 text-slate-900" style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold">{assignment.title}</h1>
          <p className="text-xs text-slate-500">{answeredCount} of {questions.length} answered · {assignment.marks} marks</p>
        </div>
        <div className="flex items-center gap-3">
          {remaining !== null && (
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm font-bold ${lowTime ? 'animate-pulse bg-rose-100 text-rose-700' : 'bg-blue-50 text-blue-700'}`}><Clock className="size-4" /> {formatClock(Math.max(0, remaining))}</span>
          )}
          <span className="hidden items-center gap-1 text-xs text-slate-400 sm:inline-flex"><Lock className="size-3.5" /> Exam mode</span>
          <button type="button" onClick={() => setConfirmOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Send className="size-4" /> Submit</button>
        </div>
      </header>
      <div className="h-1 bg-slate-100"><div className="h-full bg-blue-600 transition-all" style={{ width: `${(answeredCount / Math.max(1, questions.length)) * 100}%` }} /></div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4 md:block">
          {(assignment.quizSections || []).map((s, sIdx) => (
            <div key={s._id || sIdx} className="mb-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Section {String.fromCharCode(65 + sIdx)}</p>
              <div className="grid grid-cols-5 gap-1.5">
                {questions.map((item, idx) => item.sIdx === sIdx && (
                  <button key={item.id} type="button" onClick={() => setCurrent(idx)} className={`flex aspect-square items-center justify-center rounded-lg text-xs font-semibold transition ${idx === current ? 'bg-blue-600 text-white' : isAnswered(answers[item.id]) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{item.number}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-4 space-y-1 text-[11px] text-slate-500">
            <p className="flex items-center gap-2"><span className="size-3 rounded bg-emerald-100" /> Answered</p>
            <p className="flex items-center gap-2"><span className="size-3 rounded bg-slate-100" /> Not answered</p>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-5 sm:p-8">
          {q && (
            <div className="mx-auto max-w-3xl">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Section {String.fromCharCode(65 + q.sIdx)} · {q.section.title}</p>
                {q.section.instructions && <p className="mt-1 text-xs text-slate-500">{q.section.instructions}</p>}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <p className="text-base font-medium leading-relaxed sm:text-lg"><span className="mr-2 text-slate-400">{q.number}.</span>{q.text}</p>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{q.marks} mark{q.marks === 1 ? '' : 's'}</span>
                </div>
                <p className="mb-3 text-xs text-slate-400">{TYPE_HINT[q.section.type]}</p>

                {(q.section.type === 'mcq_single' || q.section.type === 'mcq_multiple') && (
                  <div className="space-y-2">
                    {q.options.map((opt, i) => {
                      const multi = q.section.type === 'mcq_multiple';
                      const value = answers[q.id];
                      const selected = multi ? (Array.isArray(value) && value.includes(i)) : value === i;
                      const toggle = () => {
                        if (!multi) setAnswer(q.id, i);
                        else {
                          const list = Array.isArray(value) ? value : [];
                          setAnswer(q.id, list.includes(i) ? list.filter((v) => v !== i) : [...list, i].sort((a, b) => a - b));
                        }
                      };
                      return (
                        <button key={i} type="button" onClick={toggle} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${selected ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}>
                          <span className={`flex size-7 shrink-0 items-center justify-center border text-xs font-bold ${multi ? 'rounded-md' : 'rounded-full'} ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-500'}`}>{String.fromCharCode(97 + i)}</span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.section.type === 'true_false' && (
                  <div className="grid grid-cols-2 gap-3">
                    {[true, false].map((v) => (
                      <button key={String(v)} type="button" onClick={() => setAnswer(q.id, v)} className={`rounded-xl border px-4 py-4 text-sm font-semibold transition ${answers[q.id] === v ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 hover:bg-slate-50'}`}>{v ? 'True' : 'False'}</button>
                    ))}
                  </div>
                )}

                {q.section.type === 'fill_blank' && (
                  <input
                    value={answers[q.id] || ''} onChange={(e) => setAnswer(q.id, e.target.value)}
                    onPaste={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}
                    autoComplete="off" spellCheck={false} maxLength={200}
                    placeholder="Type your answer"
                    className="w-full select-text rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                )}

                {q.section.type === 'short_answer' && (
                  <textarea
                    value={answers[q.id] || ''} onChange={(e) => setAnswer(q.id, e.target.value)}
                    onPaste={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}
                    autoComplete="off" spellCheck={false} rows={6} maxLength={3000}
                    placeholder="Write your answer"
                    className="w-full resize-y select-text rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                )}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <button type="button" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-40"><ChevronLeft className="size-4" /> Previous</button>
                <span className="text-xs text-slate-400">Question {current + 1} of {questions.length}</span>
                {current < questions.length - 1 ? (
                  <button type="button" onClick={() => setCurrent((c) => c + 1)} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Next <ChevronRight className="size-4" /></button>
                ) : (
                  <button type="button" onClick={() => setConfirmOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Send className="size-4" /> Finish</button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {warning && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">{warning}</div>
      )}

      {/* Content is hidden whenever the student leaves full screen. */}
      {!isFull && !confirmOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/95 p-4 backdrop-blur">
          <div className="max-w-sm rounded-2xl bg-white p-7 text-center">
            <AlertTriangle className="mx-auto mb-3 size-10 text-amber-500" />
            <h2 className="text-lg font-bold">You left full screen</h2>
            <p className="mt-1 text-sm text-slate-500">This has been recorded. Return to full screen to continue your quiz.</p>
            <button type="button" onClick={async () => { await enterFullscreen(); setIsFull(inFullscreen()); }} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"><Expand className="size-4" /> Return to full screen</button>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h2 className="text-lg font-bold">Submit quiz?</h2>
            <p className="mt-1 text-sm text-slate-500">You answered {answeredCount} of {questions.length} questions.{answeredCount < questions.length ? ` ${questions.length - answeredCount} unanswered question${questions.length - answeredCount === 1 ? '' : 's'} will score zero.` : ''} You cannot change your answers after submitting.</p>
            {submitError && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-600">{submitError}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={submitting} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Keep working</button>
              <button type="button" onClick={() => submit()} disabled={submitting} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-submit failure (e.g. timer ran out while offline) */}
      {submitError && !confirmOpen && (
        <div className="fixed inset-x-0 top-16 z-50 mx-auto w-fit rounded-xl bg-rose-600 px-4 py-2.5 text-sm text-white shadow-lg">
          {submitError} <button type="button" onClick={() => submit({ auto: integrity.current.autoSubmitted })} className="ml-2 underline">Retry</button>
        </div>
      )}
    </div>
  );
};

export default QuizAttemptPage;
