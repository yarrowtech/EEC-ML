import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, ChevronDown, ChevronRight, ClipboardList, GraduationCap, Loader, Play, Search, X } from 'lucide-react';
import AILearningTryoutSection, { typeMeta, normalizeQuestionType } from './AILearningTryoutSection';
import { loadSmartLearningSubjects, peekSmartLearningSubjects } from '../utils/smartLearningMap';

// Student Practice page: subjects → that subject's tryouts → "Practice now"
// opens the tryout straight in the full-screen exam.

const norm = (v) => String(v || '').trim().toLowerCase();
const asArray = (v) => (Array.isArray(v) ? v : []);

const PALETTE = [
  { strip: 'from-violet-500 to-indigo-500', badge: 'bg-violet-700' },
  { strip: 'from-emerald-500 to-teal-500', badge: 'bg-emerald-700' },
  { strip: 'from-sky-500 to-blue-500', badge: 'bg-sky-700' },
  { strip: 'from-amber-400 to-orange-500', badge: 'bg-amber-700' },
];
const toneFor = (name) => PALETTE[Array.from(String(name)).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % PALETTE.length];

// Chapter order: first number in the title (Chapter 1, 2 … 10), then alphabetical.
const byChapterNumber = (a, b) => {
  const na = Number(String(a).match(/\d+/)?.[0] ?? Infinity);
  const nb = Number(String(b).match(/\d+/)?.[0] ?? Infinity);
  return na !== nb ? na - nb : String(a).localeCompare(String(b), undefined, { numeric: true });
};

const PracticeTryouts = () => {
  // Paint the last cached copy instantly; a background refresh follows.
  const [seed] = useState(() => peekSmartLearningSubjects());
  const [subjects, setSubjects] = useState(() => seed?.subjects || []);
  const [loading, setLoading] = useState(() => !seed);
  const [error, setError] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(null); // subject key
  const [practising, setPractising] = useState(null); // { subjectName, topicTitle }
  const [query, setQuery] = useState('');
  const [openChapters, setOpenChapters] = useState({}); // chapter title -> open?
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  // quiet = refresh in the background without the full-page spinner.
  const load = useCallback(async ({ signal, force = false, quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      if (!localStorage.getItem('token')) { setSubjects([]); return; }
      setSubjects(await loadSmartLearningSubjects({ force, signal }));
    } catch (err) {
      if (err?.name !== 'AbortError') setError(err?.message || 'Could not load your tryouts');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Cached copy already on screen → refresh quietly (only hits the network when stale).
    load({ signal: controller.signal, quiet: Boolean(seed) });
    return () => controller.abort();
  }, [load, seed]);

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  // Subject → chapters → topics, the same structure as the teacher's lesson plan.
  // Only chapters/topics that have tryout questions are listed.
  const tryoutSubjects = useMemo(() => subjects.map((subject) => {
    const tryoutsByTopic = new Map();
    asArray(subject.topics).forEach((t) => {
      const questions = asArray(t.tryoutSections).filter((q) => q && typeof q === 'object');
      if (questions.length && !tryoutsByTopic.has(norm(t.title))) tryoutsByTopic.set(norm(t.title), questions);
    });
    const describe = (title) => {
      const questions = tryoutsByTopic.get(norm(title)) || [];
      const types = [];
      questions.forEach((q) => { const ty = normalizeQuestionType(q.type); if (!types.includes(ty)) types.push(ty); });
      return { topic: title, questionCount: questions.length, types };
    };
    const chapters = asArray(subject.chapters)
      .map((ch) => ({
        title: ch.title || 'Chapter',
        topics: asArray(ch.topics).filter((t) => tryoutsByTopic.has(norm(t.title))).map((t) => describe(t.title)),
      }))
      .filter((ch) => ch.topics.length > 0)
      .sort((a, b) => byChapterNumber(a.title, b.title));
    const total = chapters.reduce((n, ch) => n + ch.topics.reduce((m, t) => m + t.questionCount, 0), 0);
    const topicCount = chapters.reduce((n, ch) => n + ch.topics.length, 0);
    return { key: subject.key || subject.title, name: subject.title || subject.key || 'Subject', chapters, total, topicCount };
  }).filter((s) => s.chapters.length > 0).sort((a, b) => a.name.localeCompare(b.name)), [subjects]);

  const current = tryoutSubjects.find((s) => s.key === selectedSubject) || null;
  const q = query.trim().toLowerCase();
  const visibleSubjects = tryoutSubjects.filter((s) => !q || s.name.toLowerCase().includes(q));
  const visibleChapters = (current?.chapters || [])
    .map((ch) => (!q || ch.title.toLowerCase().includes(q) ? ch : { ...ch, topics: ch.topics.filter((t) => t.topic.toLowerCase().includes(q)) }))
    .filter((ch) => ch.topics.length > 0);
  const isOpen = (title, index) => (q ? true : openChapters[title] ?? index === 0); // first chapter open by default
  const toggleChapter = (title, index) => setOpenChapters((prev) => ({ ...prev, [title]: !isOpen(title, index) }));

  const closeSearch = () => { setSearchOpen(false); setQuery(''); };
  const openSubject = (key) => { setSelectedSubject(key); setOpenChapters({}); closeSearch(); };
  const backToSubjects = () => { setSelectedSubject(null); closeSearch(); };

  if (practising) {
    return (
      // The page sits in a fixed-height container, so the results screen scrolls here.
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AILearningTryoutSection
          key={`${practising.subjectName}::${practising.topicTitle}`}
          assignedSubjectName={practising.subjectName}
          assignedTopicName={practising.topicTitle}
          autoStart
          onBack={() => { setPractising(null); load({ quiet: true }); }}
        />
      </div>
    );
  }

  return (
    <main className="m-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-[#f8f9fd] p-4 text-slate-900 shadow-sm sm:rounded-3xl sm:px-5">
      {/* header + search */}
      <div className="mb-5 flex shrink-0 items-center gap-3">
        {current && (
          <button type="button" onClick={backToSubjects} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <ArrowLeft size={14} /> All subjects
          </button>
        )}
        <div className={`min-w-0 flex-1 ${searchOpen ? 'hidden sm:block' : ''}`}>
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{current ? current.name : 'Practice'}</h1>
          {!current && <p className="mt-0.5 text-sm text-slate-500">Choose a subject to practise the tryouts your teachers added.</p>}
        </div>
        <div className={`ml-auto flex items-center gap-2 ${searchOpen ? 'flex-1 sm:flex-none' : ''}`}>
          <label aria-hidden={!searchOpen} className={`relative block overflow-hidden p-0.5 transition-all duration-300 ease-out ${searchOpen ? 'w-full max-w-72 opacity-100 sm:w-72' : 'w-0 max-w-0 opacity-0'}`}>
            <span className="sr-only">{current ? 'Search chapters or topics' : 'Search subjects'}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input ref={searchRef} tabIndex={searchOpen ? 0 : -1} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }} placeholder={current ? 'Search chapter or topic' : 'Search subject'} className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </label>
          <button type="button" onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))} aria-label={searchOpen ? 'Close search' : 'Open search'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50">
            <Motion.span key={searchOpen ? 'x' : 's'} initial={{ rotate: -90, scale: 0.6, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ duration: 0.2 }} className="flex">{searchOpen ? <X size={16} /> : <Search size={16} />}</Motion.span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} />{error}
          <button type="button" onClick={() => load({ force: true })} className="ml-auto shrink-0 font-semibold underline">Try again</button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 pb-2 custom-scrollbar" role="region" aria-label="Practice tryouts" tabIndex={0}>
      {loading ? (
        <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader className="h-5 w-5 animate-spin" />Loading your tryouts…</div>
      ) : !current ? (
        visibleSubjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <ClipboardList className="mx-auto mb-3 h-8 w-8 text-violet-400" />
            <h2 className="font-semibold">{tryoutSubjects.length ? 'No subjects match your search' : 'No tryouts yet'}</h2>
            <p className="mt-1 text-sm text-slate-500">{tryoutSubjects.length ? 'Try another subject name.' : 'Tryouts from your teachers will appear here when they add them.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleSubjects.map((s) => {
              const tone = toneFor(s.name);
              return (
                <button key={s.key} type="button" onClick={() => openSubject(s.key)} className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-950/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                  <div className={`h-1 bg-linear-to-r ${tone.strip}`} />
                  <div className="flex items-center gap-3 p-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${tone.badge}`}><GraduationCap size={22} /></div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-bold">{s.name}</h2>
                      <p className="mt-0.5 text-xs text-slate-500">{s.chapters.length} chapter{s.chapters.length === 1 ? '' : 's'} · {s.topicCount} topic{s.topicCount === 1 ? '' : 's'} · {s.total} question{s.total === 1 ? '' : 's'}</p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : visibleChapters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="font-semibold">No chapters or topics match your search</h2>
          <p className="mt-1 text-sm text-slate-500">Try another chapter or topic name.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleChapters.map((ch, ci) => {
            const tone = toneFor(current.name);
            const open = isOpen(ch.title, ci);
            const chapterQuestions = ch.topics.reduce((n, t) => n + t.questionCount, 0);
            return (
              <section key={ch.title} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleChapter(ch.title, ci)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ${tone.badge}`}>{ci + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-snug">{ch.title}</span>
                    <span className="block text-xs text-slate-500">{ch.topics.length} topic{ch.topics.length === 1 ? '' : 's'} · {chapterQuestions} question{chapterQuestions === 1 ? '' : 's'}</span>
                  </span>
                  <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/50">
                    {ch.topics.map((t, ti) => (
                      <li key={t.topic} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 pl-6 sm:pl-16">
                        <span className="text-xs font-bold text-slate-400">{ci + 1}.{ti + 1}</span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-slate-800">{t.topic}</h3>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">{t.questionCount} question{t.questionCount === 1 ? '' : 's'}</span>
                            {t.types.map((ty) => (
                              <span key={ty} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">{typeMeta(ty).short}</span>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPractising({ subjectName: current.key, topicTitle: t.topic })}
                          aria-label={`Practice now: ${t.topic}`}
                          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
                        >
                          <Play size={13} /> Practice now
                        </button>
                      </li>
                    ))}
                  </ul>
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

export default PracticeTryouts;
