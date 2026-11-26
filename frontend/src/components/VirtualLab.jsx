import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ChevronDown, ChevronRight, FlaskConical, Loader, Play, Trophy } from 'lucide-react';
import VirtualLabPlayer from './virtualLab/VirtualLabPlayer';
import { loadSmartLearningSubjects, peekSmartLearningSubjects } from '../utils/smartLearningMap';
import { isExperimentReady } from '../utils/virtualLab';

// Student Virtual Lab: subjects → chapters → topics → experiments the teacher
// added in the lesson plan ("Practical" mode). An experiment opens full screen.
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const norm = (v) => String(v || '').trim().toLowerCase();
const asArray = (v) => (Array.isArray(v) ? v : []);
const byChapterNumber = (a, b) => {
  const na = Number(String(a).match(/\d+/)?.[0] ?? Infinity);
  const nb = Number(String(b).match(/\d+/)?.[0] ?? Infinity);
  return na !== nb ? na - nb : String(a).localeCompare(String(b), undefined, { numeric: true });
};
const PALETTE = ['bg-emerald-700', 'bg-teal-700', 'bg-sky-700', 'bg-violet-700'];
const toneFor = (name) => PALETTE[Array.from(String(name)).reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length];

const VirtualLab = () => {
  const [seed] = useState(() => peekSmartLearningSubjects());
  const [subjects, setSubjects] = useState(() => seed?.subjects || []);
  const [loading, setLoading] = useState(() => !seed);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [openChapters, setOpenChapters] = useState({});
  const [running, setRunning] = useState(null); // { experiment, subjectName, chapterTitle, topicTitle }

  const loadResults = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/lesson-plans/student/lab-results`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setResults(asArray(data.results));
    } catch { /* best effort */ }
  }, []);

  const load = useCallback(async ({ quiet = false, force = false } = {}) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      setSubjects(await loadSmartLearningSubjects({ force }));
    } catch (err) {
      setError(err?.message || 'Could not load your experiments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load({ quiet: Boolean(seed) }); loadResults(); }, [load, loadResults, seed]);

  const bestXp = (experimentId) => results.filter((r) => r.experimentId === experimentId).reduce((m, r) => Math.max(m, Number(r.xp) || 0), -1);

  // Subject → chapters → topics → experiments (only what has experiments).
  const labSubjects = useMemo(() => subjects.map((subject) => {
    const byTopic = new Map();
    asArray(subject.topics).forEach((t) => {
      const exps = asArray(t.labExperiments).filter(isExperimentReady);
      if (exps.length && !byTopic.has(norm(t.title))) byTopic.set(norm(t.title), exps);
    });
    const chapters = asArray(subject.chapters)
      .map((ch) => ({
        title: ch.title || 'Chapter',
        topics: asArray(ch.topics).filter((t) => byTopic.has(norm(t.title))).map((t) => ({ title: t.title, experiments: byTopic.get(norm(t.title)) })),
      }))
      .filter((ch) => ch.topics.length)
      .sort((a, b) => byChapterNumber(a.title, b.title));
    const count = chapters.reduce((n, ch) => n + ch.topics.reduce((m, t) => m + t.experiments.length, 0), 0);
    return { key: subject.key || subject.title, name: subject.title || subject.key || 'Subject', chapters, count };
  }).filter((s) => s.count > 0).sort((a, b) => a.name.localeCompare(b.name)), [subjects]);

  const current = labSubjects.find((s) => s.key === selectedSubject) || null;
  const isOpen = (title, i) => openChapters[title] ?? i === 0;

  if (running) {
    return (
      <VirtualLabPlayer
        key={running.experiment.id}
        experiment={running.experiment}
        subjectName={running.subjectName}
        chapterTitle={running.chapterTitle}
        topicTitle={running.topicTitle}
        onExit={() => { setRunning(null); loadResults(); }}
      />
    );
  }

  return (
    <main className="m-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-[#f8f9fd] text-slate-900 shadow-sm sm:rounded-3xl">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
        {current && (
          <button type="button" onClick={() => setSelectedSubject(null)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <ArrowLeft size={14} /> All subjects
          </button>
        )}
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm"><FlaskConical size={19} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{current ? current.name : 'Virtual Lab'}</h1>
          <p className="truncate text-xs text-slate-500">{current ? 'Pick a chapter, then an experiment to perform.' : 'Do science experiments yourself — choose a subject.'}</p>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex shrink-0 items-center gap-2 border-b border-red-100 bg-red-50 px-5 py-2 text-sm text-red-700">
          <AlertCircle size={16} />{error}
          <button type="button" onClick={() => load({ force: true })} className="ml-auto font-semibold underline">Try again</button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader className="h-5 w-5 animate-spin" />Loading experiments…</div>
        ) : !current ? (
          labSubjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <FlaskConical className="mx-auto mb-3 h-8 w-8 text-emerald-400" />
              <h2 className="font-semibold">No experiments yet</h2>
              <p className="mt-1 text-sm text-slate-500">Experiments your teachers add will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {labSubjects.map((s) => (
                <button key={s.key} type="button" onClick={() => { setSelectedSubject(s.key); setOpenChapters({}); }} className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${toneFor(s.name)}`}><FlaskConical size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold">{s.name}</span>
                    <span className="block text-xs text-slate-500">{s.chapters.length} chapter{s.chapters.length === 1 ? '' : 's'} · {s.count} experiment{s.count === 1 ? '' : 's'}</span>
                  </span>
                  <ChevronRight size={18} className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {current.chapters.map((ch, ci) => {
              const open = isOpen(ch.title, ci);
              return (
                <section key={ch.title} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  <button type="button" aria-expanded={open} onClick={() => setOpenChapters((p) => ({ ...p, [ch.title]: !open }))} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ${toneFor(current.name)}`}>{ci + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{ch.title}</span>
                      <span className="block text-xs text-slate-500">{ch.topics.length} topic{ch.topics.length === 1 ? '' : 's'}</span>
                    </span>
                    <ChevronDown size={18} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/50">
                      {ch.topics.map((t, ti) => (
                        <div key={t.title} className="px-4 py-3 sm:pl-16">
                          <p className="mb-2 text-sm font-semibold text-slate-800"><span className="mr-1.5 text-xs font-bold text-slate-400">{ci + 1}.{ti + 1}</span>{t.title}</p>
                          <ul className="space-y-2">
                            {t.experiments.map((exp) => {
                              const best = bestXp(exp.id);
                              return (
                                <li key={exp.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><FlaskConical size={16} /></span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">{exp.title}</p>
                                    <p className="truncate text-xs text-slate-500">
                                      {exp.kind === 'germination'
                                        ? `${exp.totalDays || 7} days · ${(exp.jars || []).length} test jars · `
                                        : exp.kind === 'embed'
                                          ? `Interactive simulation${exp.provider === 'phet' ? ' · PhET' : ''} · `
                                          : `${(exp.stages || []).length} stages · `}
                                      {(exp.questions || []).length} questions
                                    </p>
                                  </div>
                                  {best >= 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"><Trophy size={12} /> Best {best} XP</span>}
                                  <button type="button" onClick={() => setRunning({ experiment: exp, subjectName: current.key, chapterTitle: ch.title, topicTitle: t.title })} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700">
                                    <Play size={13} /> {best >= 0 ? 'Do again' : 'Start experiment'}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

export default VirtualLab;
