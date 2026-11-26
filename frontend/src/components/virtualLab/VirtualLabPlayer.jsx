import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, Droplets, FlaskConical, Lightbulb, NotebookPen,
  RotateCcw, Sun, SunDim, Thermometer, Trophy, X, Eye, Loader2,
} from 'lucide-react';
import SeedJar from './SeedJar';
import {
  WATER_LEVELS, OUTCOME_LABEL, growthStage, jarObservation, jarOutcome, labXp,
} from '../../utils/virtualLab';
import { isAllowedSimUrl } from '../../utils/simulationCatalog';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const OUTCOME_TONE = {
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  poor: 'bg-amber-50 text-amber-700 ring-amber-200',
  none: 'bg-rose-50 text-rose-700 ring-rose-200',
};

/**
 * Full-screen interactive experiment for a student.
 * Steps: 1 Do it (stages) · 2 Observe (jars + controls, germination only) · 3 Notebook · 4 Quiz · 5 Result.
 */
const VirtualLabPlayer = ({ experiment, subjectName = '', chapterTitle = '', topicTitle = '', onExit }) => {
  const isGermination = experiment.kind === 'germination' && (experiment.jars || []).length > 0;
  // Imported 3rd-party simulation (e.g. PhET) — only approved hosts are ever embedded.
  const isEmbed = experiment.kind === 'embed' && isAllowedSimUrl(experiment.simUrl);
  const steps = [
    { key: 'do', label: isEmbed ? 'Explore the simulation' : 'Do the experiment', icon: FlaskConical },
    ...(isGermination ? [{ key: 'observe', label: 'Observe', icon: Eye }] : []),
    { key: 'notebook', label: 'Notebook', icon: NotebookPen },
    ...((experiment.questions || []).length ? [{ key: 'quiz', label: 'Quiz', icon: Lightbulb }] : []),
    { key: 'result', label: 'Result', icon: Trophy },
  ];
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  // 1. stages
  const [doneStages, setDoneStages] = useState(() => new Set());
  const allStagesDone = (experiment.stages || []).every((_, i) => doneStages.has(i));

  // 2. simulation
  const totalDays = Number(experiment.totalDays) || 7;
  const [day, setDay] = useState(0);
  const [myJar, setMyJar] = useState({ name: 'Your jar', water: 1, air: true, warm: true, light: true });
  const jars = useMemo(() => [myJar, ...(experiment.jars || [])], [myJar, experiment.jars]);
  const [focusJar, setFocusJar] = useState(0);
  const setWater = (delta) => setMyJar((j) => { const water = Math.max(0, Math.min(2, j.water + delta)); return { ...j, water, air: water < 2 }; });

  // 3. notebook
  const [notes, setNotes] = useState({}); // day -> text
  const [noteDraft, setNoteDraft] = useState('');
  const notesCount = Object.values(notes).filter((t) => String(t).trim()).length;
  useEffect(() => { setNoteDraft(notes[day] || ''); }, [day]); // eslint-disable-line react-hooks/exhaustive-deps

  // 4. quiz
  const questions = experiment.questions || [];
  const [answers, setAnswers] = useState({});
  const [quizChecked, setQuizChecked] = useState(false);
  const quizCorrect = questions.filter((q, i) => Number(answers[i]) === Number(q.correctAnswer)).length;

  // 5. result
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const xp = labXp(experiment, { completed: allStagesDone, observationsCount: notesCount, quizCorrect, quizTotal: questions.length });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/lesson-plans/student/lab-submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experimentId: experiment.id,
          title: experiment.title,
          subjectName,
          chapterTitle,
          topicTitle,
          completed: allStagesDone,
          observations: Object.entries(notes).filter(([, t]) => String(t).trim()).map(([d, text]) => ({ day: Number(d), text: String(text).trim() })),
          quizCorrect,
          quizTotal: questions.length,
          xp,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setSaved(res.ok ? (data.result || { xp }) : { error: data?.error || 'Could not save your result' });
    } catch {
      setSaved({ error: 'Could not save your result' });
    } finally {
      setSaving(false);
    }
  };

  const canNext = step.key === 'do' ? allStagesDone : step.key === 'quiz' ? quizChecked : true;
  const goNext = () => {
    if (stepIndex < steps.length - 1) {
      const next = stepIndex + 1;
      setStepIndex(next);
      if (steps[next].key === 'result' && !saved) submit();
    }
  };

  const focused = jars[focusJar] || jars[0];

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#f4f7fb] text-slate-900">
      {/* top bar */}
      <header className="flex shrink-0 items-center gap-3 bg-linear-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white shadow">
        <span className="flex size-9 items-center justify-center rounded-full bg-white/20"><FlaskConical size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-white/80">{[subjectName, 'Virtual Lab', chapterTitle].filter(Boolean).join(' · ')}</p>
          <h1 className="truncate text-base font-bold sm:text-lg">{experiment.title}</h1>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {isGermination && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{totalDays} Days</span>}
          {isGermination && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{(experiment.jars || []).length} Test jars</span>}
          {questions.length > 0 && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{questions.length} Questions</span>}
        </div>
        <button type="button" onClick={onExit} aria-label="Exit experiment" className="flex size-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"><X size={18} /></button>
      </header>

      {/* step tabs */}
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const active = i === stepIndex;
          const done = i < stepIndex;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => i <= stepIndex && setStepIndex(i)}
              disabled={i > stepIndex}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${active ? 'bg-emerald-600 text-white shadow-sm' : done ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400'}`}
            >
              {done ? <Check size={13} /> : <Icon size={13} />} {i + 1}. {s.label}
            </button>
          );
        })}
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
          {/* 1. do the experiment */}
          {step.key === 'do' && isEmbed && (
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="aspect-video w-full bg-slate-100">
                  <iframe
                    title={experiment.title}
                    src={experiment.simUrl}
                    className="h-full w-full"
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    allow="fullscreen"
                    allowFullScreen
                  />
                </div>
                {experiment.attribution && <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">Simulation: {experiment.attribution}</p>}
              </section>
              <aside className="space-y-3">
                {experiment.objective && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><b>Objective:</b> {experiment.objective}</p>}
                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h2 className="mb-2 text-sm font-bold text-slate-700">Try these in the simulation</h2>
                  <ol className="space-y-2">
                    {(experiment.stages || []).map((s, i) => {
                      const done = doneStages.has(i);
                      return (
                        <li key={i}>
                          <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm transition ${done ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 hover:border-emerald-300'}`}>
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={() => setDoneStages((prev) => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; })}
                              className="mt-0.5 accent-emerald-600"
                            />
                            <span>
                              <span className="block font-semibold">{s.title}</span>
                              {s.instruction && <span className="block text-xs text-slate-600">{s.instruction}</span>}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              </aside>
            </div>
          )}
          {step.key === 'do' && !isEmbed && (
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                {experiment.objective && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><b>Objective:</b> {experiment.objective}</p>}
                <h2 className="mb-3 text-sm font-bold text-slate-700">Do each step in order</h2>
                <ol className="space-y-2.5">
                  {(experiment.stages || []).map((s, i) => {
                    const done = doneStages.has(i);
                    const unlocked = i === 0 || doneStages.has(i - 1);
                    return (
                      <li key={i} className={`flex items-start gap-3 rounded-xl border p-3 transition ${done ? 'border-emerald-200 bg-emerald-50/60' : unlocked ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{done ? <Check size={15} /> : i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">Stage {i + 1}: {s.title}</p>
                          {s.instruction && <p className="mt-0.5 text-xs text-slate-600">{s.instruction}</p>}
                        </div>
                        <button
                          type="button"
                          disabled={!unlocked || done}
                          onClick={() => setDoneStages((prev) => new Set(prev).add(i))}
                          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400'}`}
                        >
                          {done ? 'Done' : 'Do it'}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
              <aside className="space-y-4">
                {(experiment.materials || []).length > 0 && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-2 text-sm font-bold text-slate-700">Materials required</h3>
                    <ul className="space-y-1 text-sm text-slate-600">
                      {experiment.materials.map((m) => <li key={m} className="flex items-center gap-2"><ChevronRight size={13} className="text-emerald-500" />{m}</li>)}
                    </ul>
                  </section>
                )}
                {isGermination && (
                  <section className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4">
                    <SeedJar stage={doneStages.has(2) ? 1 : 0} water={doneStages.has(2) ? 1 : 0} light size={120} />
                    <p className="mt-2 text-center text-xs text-slate-500">{doneStages.size === 0 ? 'Start with stage 1.' : `${doneStages.size} of ${experiment.stages.length} stages done`}</p>
                  </section>
                )}
              </aside>
            </div>
          )}

          {/* 2. observe (germination simulation) */}
          {step.key === 'observe' && (
            <div className="space-y-4">
              <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                <span className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-bold text-white">Day {day} / {totalDays}</span>
                <button type="button" onClick={() => setDay((d) => Math.min(totalDays, d + 1))} disabled={day >= totalDays} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">Next day <ArrowRight size={13} /></button>
                <button type="button" onClick={() => { setDay(0); setMyJar({ name: 'Your jar', water: 1, air: true, warm: true, light: true }); }} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><RotateCcw size={13} /> Reset experiment</button>
                <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
                <span className="text-xs font-semibold text-slate-500">Your jar:</span>
                <button type="button" onClick={() => setWater(1)} disabled={myJar.water >= 2} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 disabled:opacity-40"><Droplets size={13} /> Add water</button>
                <button type="button" onClick={() => setWater(-1)} disabled={myJar.water <= 0} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 disabled:opacity-40"><Droplets size={13} /> Remove water</button>
                <button type="button" onClick={() => setMyJar((j) => ({ ...j, warm: !j.warm }))} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${myJar.warm ? 'bg-orange-50 text-orange-700 ring-orange-200' : 'bg-blue-50 text-blue-700 ring-blue-200'}`}><Thermometer size={13} /> {myJar.warm ? 'Warm' : 'Cold'}</button>
                <button type="button" onClick={() => setMyJar((j) => ({ ...j, light: !j.light }))} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${myJar.light ? 'bg-yellow-50 text-yellow-700 ring-yellow-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{myJar.light ? <Sun size={13} /> : <SunDim size={13} />} Light {myJar.light ? 'on' : 'off'}</button>
              </section>

              <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {jars.map((jar, i) => {
                  const outcome = jarOutcome(jar);
                  return (
                    <button
                      key={jar.name}
                      type="button"
                      onClick={() => setFocusJar(i)}
                      className={`flex flex-col items-center rounded-2xl border bg-white p-3 text-center transition ${focusJar === i ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200 hover:border-emerald-300'}`}
                    >
                      <SeedJar stage={growthStage(jar, day)} water={jar.water} light={jar.light} size={96} label={jar.name} />
                      <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-slate-700">{jar.name}</p>
                      <p className="text-[10px] text-slate-500">{WATER_LEVELS[jar.water]} · {jar.warm ? 'warm' : 'cold'} · light {jar.light ? 'on' : 'off'}</p>
                      {day >= totalDays && <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${OUTCOME_TONE[outcome]}`}>{OUTCOME_LABEL[outcome]}</span>}
                    </button>
                  );
                })}
              </section>

              <section className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <Eye size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Observe · {focused.name} · Day {day}</p>
                  <p className="mt-0.5 text-sm text-emerald-900">{jarObservation(experiment, focused, day)}</p>
                </div>
              </section>
              {day >= totalDays && experiment.conclusion && (
                <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700"><b>What we learn:</b> {experiment.conclusion}</p>
              )}
            </div>
          )}

          {/* 3. notebook */}
          {step.key === 'notebook' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold text-slate-700">Observation notebook</h2>
              <p className="mb-3 text-xs text-slate-500">Write what you saw. Record at least 3 observations to earn {experiment.xp?.observations || 0} XP.</p>
              {isGermination && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                    <button key={d} type="button" onClick={() => setDay(d)} className={`rounded-full px-3 py-1 text-xs font-semibold ${day === d ? 'bg-emerald-600 text-white' : notes[d] ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>Day {d}{notes[d] ? ' ✓' : ''}</button>
                  ))}
                </div>
              )}
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={3}
                placeholder={isGermination ? `What did you see on day ${day || 1}?` : 'What did you observe?'}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">{notesCount} observation{notesCount === 1 ? '' : 's'} recorded</span>
                <button
                  type="button"
                  disabled={!noteDraft.trim()}
                  onClick={() => {
                    const key = isGermination ? (day || 1) : Object.keys(notes).length + 1;
                    setNotes((prev) => ({ ...prev, [key]: noteDraft.trim() }));
                    if (!isGermination) setNoteDraft('');
                  }}
                  className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Save observation
                </button>
              </div>
              {notesCount > 0 && (
                <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {Object.entries(notes).filter(([, t]) => String(t).trim()).map(([d, t]) => (
                    <li key={d} className="px-3 py-2 text-sm"><span className="mr-2 text-xs font-semibold text-emerald-700">{isGermination ? `Day ${d}` : `#${d}`}</span>{t}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* 4. quiz */}
          {step.key === 'quiz' && (
            <section className="space-y-3">
              {questions.map((q, qi) => (
                <div key={qi} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold">{qi + 1}. {q.question}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {(q.options || []).map((opt, oi) => {
                      const chosen = Number(answers[qi]) === oi;
                      const correct = Number(q.correctAnswer) === oi;
                      const tone = !quizChecked
                        ? (chosen ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300')
                        : correct ? 'border-emerald-500 bg-emerald-50' : chosen ? 'border-rose-400 bg-rose-50' : 'border-slate-200 opacity-70';
                      return (
                        <button key={oi} type="button" disabled={quizChecked} onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))} className={`rounded-xl border px-3 py-2 text-left text-sm transition ${tone}`}>
                          <span className="mr-2 font-bold text-slate-500">{String.fromCharCode(65 + oi)}.</span>{opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!quizChecked ? (
                <button type="button" disabled={Object.keys(answers).length < questions.length} onClick={() => setQuizChecked(true)} className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">Check answers</button>
              ) : (
                <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">You got {quizCorrect} of {questions.length} right.</p>
              )}
            </section>
          )}

          {/* 5. result */}
          {step.key === 'result' && (
            <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <Trophy size={44} className="mx-auto text-amber-500" />
              <h2 className="mt-2 text-xl font-bold">Experiment complete!</h2>
              <p className="mt-1 text-4xl font-extrabold text-emerald-600">{xp} XP</p>
              <ul className="mt-4 space-y-1.5 text-left text-sm">
                <li className="flex items-center justify-between"><span>Completed the experiment</span><b className={allStagesDone ? 'text-emerald-600' : 'text-slate-400'}>+{allStagesDone ? experiment.xp?.complete || 0 : 0}</b></li>
                <li className="flex items-center justify-between"><span>Recorded observations ({notesCount})</span><b className={notesCount >= 3 ? 'text-emerald-600' : 'text-slate-400'}>+{notesCount >= 3 ? experiment.xp?.observations || 0 : 0}</b></li>
                {questions.length > 0 && <li className="flex items-center justify-between"><span>Quiz ({quizCorrect}/{questions.length})</span><b className={quizCorrect === questions.length ? 'text-emerald-600' : 'text-slate-400'}>+{quizCorrect === questions.length ? experiment.xp?.quiz || 0 : 0}</b></li>}
              </ul>
              <p className="mt-4 text-xs text-slate-500">
                {saving ? <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Saving…</span> : saved?.error ? saved.error : saved ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={12} /> Saved to your lab record</span> : ''}
              </p>
              <button type="button" onClick={onExit} className="mt-4 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Back to experiments</button>
            </section>
          )}
        </div>
      </main>

      {/* bottom bar */}
      {step.key !== 'result' && (
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
          <button type="button" onClick={() => (stepIndex ? setStepIndex(stepIndex - 1) : onExit())} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <ArrowLeft size={15} /> {stepIndex ? 'Back' : 'Exit'}
          </button>
          <span className="hidden text-xs text-slate-500 sm:inline">
            {step.key === 'do' && !allStagesDone ? 'Finish every stage to continue.' : step.key === 'quiz' && !quizChecked ? 'Answer all questions, then check.' : ''}
          </span>
          <button type="button" disabled={!canNext} onClick={goNext} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
            {steps[stepIndex + 1]?.key === 'result' ? 'Finish' : 'Next'} <ArrowRight size={15} />
          </button>
        </footer>
      )}
    </div>
  );
};

export default VirtualLabPlayer;
