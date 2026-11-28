import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, Calendar, CheckCircle2, Clock, Circle, BookOpen, ChevronRight, ChevronLeft, PlayCircle, Check, Play, LayoutGrid, List, Atom, FlaskConical, Pi, Leaf, Code2, Globe2, Languages, ArrowUp, RefreshCw } from 'lucide-react';
import { fetchCachedJson, peekCachedJson } from '../utils/studentApiCache';
import { STUDENT_SYLLABUS_URL, STUDENT_SYLLABUS_TTL_MS } from '../utils/studentDashboardPrefetch';

const STATUS_CONFIG = {
  completed:   { label: 'Completed',   tone: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500',  icon: CheckCircle2 },
  in_progress: { label: 'In Progress', tone: 'bg-amber-100  text-amber-700  border-amber-200',   dot: 'bg-amber-400',   icon: Clock },
  pending:     { label: 'Pending',     tone: 'bg-gray-100   text-gray-600   border-gray-200',     dot: 'bg-gray-300',    icon: Circle },
};

const cfg = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.pending;

// Subject → icon + soft tile colour
const SUBJECT_META = [
  { test: /phys/i, icon: Atom, tile: 'bg-violet-500 text-white' },
  { test: /chem/i, icon: FlaskConical, tile: 'bg-sky-500 text-white' },
  { test: /math/i, icon: Pi, tile: 'bg-amber-500 text-white' },
  { test: /bio|science|evs|environment/i, icon: Leaf, tile: 'bg-emerald-500 text-white' },
  { test: /english|literature/i, icon: BookOpen, tile: 'bg-rose-500 text-white' },
  { test: /hindi|bengali|sanskrit|language|french|urdu/i, icon: Languages, tile: 'bg-orange-500 text-white' },
  { test: /comput|coding|ict|informat/i, icon: Code2, tile: 'bg-indigo-500 text-white' },
  { test: /hist|geo|social|civics|econ/i, icon: Globe2, tile: 'bg-teal-500 text-white' },
];
const subjectMeta = (name) => SUBJECT_META.find((m) => m.test.test(String(name || ''))) || { icon: BookOpen, tile: 'bg-slate-500 text-white' };

// Bar colour + pace label from completion %
const barColor = (p) => (p >= 60 ? 'bg-green-500' : p >= 30 ? 'bg-amber-400' : 'bg-violet-400');
const paceBadge = (p, stat = {}) => {
  if (p >= 80) return { label: 'Ahead', icon: ArrowUp, cls: 'bg-sky-500 text-white' };
  if (p >= 60) return { label: 'On Track', icon: CheckCircle2, cls: 'bg-green-600 text-white' };
  if (p > 0 || stat.inProgress) return { label: 'In Progress', icon: Clock, cls: 'bg-amber-500 text-white' };
  return { label: 'Not Started', icon: Circle, cls: 'bg-slate-500 text-white' };
};

/* Circular ring indicator */
const Ring = ({ percent, size = 56, stroke = 5, color = '#3b82f6' }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
    </svg>
  );
};

const LessonPlanStatusView = () => {
  const [items, setItems]       = useState(() => {
    if (!localStorage.getItem('token') || localStorage.getItem('userType') !== 'Student') return [];
    const cached = peekCachedJson(STUDENT_SYLLABUS_URL)?.data;
    return Array.isArray(cached) ? cached : [];
  });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [activeSubject, setActiveSubject] = useState('all');
  const [view, setView] = useState('list'); // list | grid

  /* ── Fetch ──────────────────────────────────────────────────────────── */
  const loadStatus = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');
      if (!token || userType !== 'Student') {
        setItems([]);
        setError('Please login as student.');
        return;
      }

      const { data } = await fetchCachedJson(STUDENT_SYLLABUS_URL, {
        ttlMs: STUDENT_SYLLABUS_TTL_MS,
        forceRefresh,
        fetchOptions: {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(forceRefresh ? { 'Cache-Control': 'no-cache' } : {}),
          },
        },
      });
      const nextItems = Array.isArray(data) ? data : [];
      setItems(nextItems);
      setActiveSubject((subject) =>
        nextItems.some((item) => (item.subject || 'Unknown') === subject) ? subject : 'all'
      );
    } catch (err) {
      setError(err.message || 'Failed to load syllabus status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  /* ── Derived data ───────────────────────────────────────────────────── */

  /* unique subjects in order of first appearance */
  const subjects = useMemo(() => {
    const seen = new Set();
    const list = [];
    items.forEach((item) => {
      const s = item.subject || 'Unknown';
      if (!seen.has(s)) { seen.add(s); list.push(s); }
    });
    return list;
  }, [items]);

  /* per-subject stats: { completed, total, avgPercent } */
  const subjectStats = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      const s = item.subject || 'Unknown';
      if (!map[s]) map[s] = { completed: 0, inProgress: 0, pending: 0, total: 0, sumPercent: 0 };
      map[s].total++;
      map[s].sumPercent += item.completionPercent || 0;
      if (item.status === 'completed')   map[s].completed++;
      else if (item.status === 'in_progress') map[s].inProgress++;
      else map[s].pending++;
    });
    Object.keys(map).forEach((s) => {
      map[s].avgPercent = map[s].total ? Math.round(map[s].sumPercent / map[s].total) : 0;
    });
    return map;
  }, [items]);

  /* overall stats across all items */
  const overallStats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.status === 'completed').length;
    const inProgress = items.filter((i) => i.status === 'in_progress').length;
    const avgPercent = total ? Math.round(items.reduce((s, i) => s + (i.completionPercent || 0), 0) / total) : 0;
    return { total, completed, inProgress, pending: total - completed - inProgress, avgPercent };
  }, [items]);

  /* Selected subject → chapters in ascending order, each with its lessons in order.
     A lesson can have several date updates: keep its furthest progress. */
  const subjectChapters = useMemo(() => {
    if (activeSubject === 'all') return [];
    const lessons = new Map();
    items.forEach((item) => {
      if ((item.subject || 'Unknown') !== activeSubject) return;
      const key = String(item.lessonPlanId || item._id);
      const prev = lessons.get(key);
      const pct = item.completionPercent || 0;
      const rank = { completed: 2, in_progress: 1, pending: 0 };
      if (!prev) {
        lessons.set(key, { ...item, completionPercent: pct, firstDate: item.date, lastDate: item.date });
        return;
      }
      const better = pct > prev.completionPercent || (rank[item.status] || 0) > (rank[prev.status] || 0);
      const next = better ? { ...prev, ...item, completionPercent: Math.max(pct, prev.completionPercent) } : prev;
      const t = new Date(item.date).getTime();
      if (t < new Date(prev.firstDate).getTime()) next.firstDate = item.date;
      if (t > new Date(prev.lastDate).getTime()) next.lastDate = item.date;
      lessons.set(key, next);
    });
    const chapters = new Map();
    lessons.forEach((lesson) => {
      const key = lesson.unitNumber ? `n:${lesson.unitNumber}` : lesson.unitTitle ? `t:${lesson.unitTitle.toLowerCase()}` : `l:${lesson.lessonPlanId || lesson._id}`;
      if (!chapters.has(key)) {
        chapters.set(key, {
          key,
          number: lesson.unitNumber || null,
          title: lesson.unitTitle || (lesson.unitNumber ? '' : (lesson.lessonTitle || lesson.title || 'Lesson')),
          lessons: [],
        });
      }
      chapters.get(key).lessons.push(lesson);
    });
    const byStart = (a, b) => new Date(a.firstDate || 0) - new Date(b.firstDate || 0);
    const list = Array.from(chapters.values()).map((ch) => {
      ch.lessons.sort(byStart);
      ch.percent = ch.lessons.length ? Math.round(ch.lessons.reduce((n, l) => n + (l.completionPercent || 0), 0) / ch.lessons.length) : 0;
      ch.firstDate = ch.lessons[0]?.firstDate;
      return ch;
    });
    // numbered chapters by number, then un-numbered ones by when they were taught
    list.sort((a, b) => (a.number && b.number ? a.number - b.number : a.number ? -1 : b.number ? 1 : byStart(a, b)));
    let seq = 0;
    return list.map((ch) => { seq = ch.number || seq + 1; return { ...ch, displayNumber: ch.number || seq }; });
  }, [items, activeSubject]);

  /* ── Render ─────────────────────────────────────────────────────────── */
  const pctOf = (n) => (overallStats.total ? Math.round((n / overallStats.total) * 100) : 0);
  const selected = activeSubject !== 'all' ? activeSubject : null;
  const selectedStat = selected ? (subjectStats[selected] || {}) : null;

  return (
    <main className="m-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-[#f8f9fd] p-4 text-slate-900 shadow-sm sm:rounded-3xl sm:px-5">
        {/* ── Header ── */}
        <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
          {/* <BookOpen className="h-7 w-7 shrink-0 text-violet-600" strokeWidth={1.8} /> */}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Syllabus Completion Status</h1>
            <p className="mt-0.5 text-sm text-slate-500">Track your syllabus progress for each subject</p>
          </div>
          <button
            type="button"
            onClick={() => loadStatus(true)}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:opacity-60"
          >
            <RefreshCw aria-hidden="true" className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-2 pb-2 custom-scrollbar" role="region" aria-label="Syllabus progress" tabIndex={0}>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

        {loading && items.length === 0 ? (
          <div className="space-y-3" role="status" aria-label="Loading syllabus status">
            <div className="h-36 animate-pulse rounded-2xl bg-white shadow-sm" />
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-white shadow-sm" />)}
          </div>
        ) : items.length === 0 ? (
          !error && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
              <BookOpenCheck className="h-9 w-9 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No syllabus updates yet</p>
              <p className="text-xs text-slate-400">Your teachers haven&apos;t posted any lesson progress.</p>
            </div>
          )
        ) : (
          <>
            {/* ── Overall card ── */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm p-4 sm:p-5">
              <div className="pointer-events-none absolute -bottom-10 right-24 h-28 w-56 rounded-full bg-violet-50" />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4 sm:flex-1">
                  <div className="relative flex shrink-0 items-center justify-center">
                    <Ring percent={overallStats.avgPercent} size={104} stroke={11} color="#22c55e" />
                    <span className="absolute text-2xl font-bold text-slate-900">{overallStats.avgPercent}%</span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold leading-tight sm:text-lg">Overall Syllabus Completion</h2>
                    <p className="mt-1 text-sm text-slate-500">{overallStats.avgPercent}% completed</p>
                  </div>
                </div>
                <div className="hidden h-20 w-px bg-slate-200 sm:block" />
                <ul className="grid grid-cols-2 gap-2 sm:block sm:space-y-2.5 sm:pl-2">
                  {[
                    { label: 'Completed', value: pctOf(overallStats.completed), icon: Check, cls: 'bg-emerald-500' },
                    { label: 'In Progress', value: pctOf(overallStats.inProgress), icon: Play, cls: 'bg-violet-500' },
                  ].map(({ label, value, icon: Icon, cls }) => (
                    <li key={label} className="flex flex-col items-center gap-1 text-center text-sm sm:flex-row sm:gap-2.5 sm:text-left">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${cls}`}><Icon className="h-3.5 w-3.5" strokeWidth={3} fill={Icon === Play ? 'currentColor' : 'none'} /></span>
                      <span className="text-slate-600 sm:w-24">{label}:</span>
                      <span className="font-bold text-slate-900">{value}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {selected ? (
              /* ── One subject: its lessons ── */
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setActiveSubject('all')} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                    <ChevronLeft className="h-4 w-4" /> All subjects
                  </button>
                  <h2 className="min-w-0 truncate text-base font-bold sm:text-lg">{selected}</h2>
                  <span className="ml-auto text-sm font-bold text-slate-700">{selectedStat.avgPercent || 0}%</span>
                </div>
                {subjectChapters.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500">No updates yet for this subject.</p>
                ) : (
                  <div className="space-y-3">
                    {subjectChapters.map((ch) => (
                      <section key={ch.key} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="h-1 bg-linear-to-r from-violet-500 to-indigo-500" />
                        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-700 text-sm font-bold text-white shadow-sm" aria-label={`Chapter ${ch.displayNumber}`}>{ch.displayNumber}</span>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-bold text-slate-900">{ch.title ? `Chapter ${ch.displayNumber} · ${ch.title}` : `Chapter ${ch.displayNumber}`}</h3>
                            <p className="text-xs text-slate-500">{ch.lessons.length} lesson{ch.lessons.length === 1 ? '' : 's'}</p>
                          </div>
                          <div className="flex w-28 items-center gap-2 sm:w-40">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${barColor(ch.percent)}`} style={{ width: `${ch.percent}%` }} /></div>
                            <span className="w-9 text-right text-xs font-bold text-slate-700">{ch.percent}%</span>
                          </div>
                        </div>
                        <ol className="divide-y divide-slate-100">
                          {ch.lessons.map((item, li) => {
                            const c = cfg(item.status);
                            const pct = item.completionPercent || 0;
                            return (
                              <li key={item.lessonPlanId || item._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-slate-900">{ch.displayNumber}.{li + 1} {item.lessonTitle || item.title || 'Lesson'}</p>
                                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                                    {item.teacherName && <span>{item.teacherName}</span>}
                                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{item.lastDate ? new Date(item.lastDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                                  </p>
                                </div>
                                <div className="flex w-full items-center gap-3 sm:w-48">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${pct}%` }} /></div>
                                  <span className="w-9 text-right text-xs font-bold text-slate-700">{pct}%</span>
                                </div>
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${c.tone}`}>{c.label}</span>
                              </li>
                            );
                          })}
                        </ol>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ── Subject-wise completion ── */
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold sm:text-lg">Subject-wise Completion</h2>
                  <div className="flex rounded-xl border border-slate-200 bg-white p-0.5" role="group" aria-label="View">
                    <button type="button" onClick={() => setView('grid')} aria-pressed={view === 'grid'} aria-label="Grid view" className={`rounded-lg p-1.5 ${view === 'grid' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><LayoutGrid className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="List view" className={`rounded-lg p-1.5 ${view === 'list' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><List className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className={view === 'grid' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : 'space-y-2'}>
                  {subjects.map((subj) => {
                    const stat = subjectStats[subj] || {};
                    const pct = stat.avgPercent || 0;
                    const meta = subjectMeta(subj);
                    const Icon = meta.icon;
                    const badge = paceBadge(pct, stat);
                    const BadgeIcon = badge.icon;
                    return (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => setActiveSubject(subj)}
                        className={`group w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-950/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${view === 'grid' ? 'p-4' : 'flex items-center gap-3 px-3 py-2.5 sm:gap-4'}`}
                      >
                        {view === 'grid' ? (
                          <>
                            <div className="-mx-4 -mt-4 mb-3 h-1 bg-linear-to-r from-violet-500 to-indigo-500" />
                            <div className="flex items-center gap-3">
                              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.tile}`}><Icon className="h-5 w-5" /></span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-bold text-slate-900">{subj}</span>
                                <span className="block text-xs text-slate-500">{stat.total || 0} lesson{stat.total === 1 ? '' : 's'}</span>
                              </span>
                              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                            </div>
                            <div className="mt-3 flex items-center gap-3">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${pct}%` }} /></div>
                              <span className="text-sm font-bold text-slate-900">{pct}%</span>
                            </div>
                            <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}><BadgeIcon className="h-3.5 w-3.5" />{badge.label}</span>
                          </>
                        ) : (
                          <>
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tile}`}><Icon className="h-4 w-4" /></span>
                            <span className="min-w-0 flex-1 truncate font-bold text-slate-900 sm:w-36 sm:flex-none">{subj}</span>
                            <span className="hidden h-6 w-px bg-slate-200 sm:block" />
                            <span className="hidden w-20 shrink-0 text-sm text-slate-500 sm:block">{stat.total || 0} lesson{stat.total === 1 ? '' : 's'}</span>
                            <span className="hidden h-2 flex-1 overflow-hidden rounded-full bg-slate-100 sm:block"><span className={`block h-full rounded-full ${barColor(pct)}`} style={{ width: `${pct}%` }} /></span>
                            <span className="w-10 shrink-0 text-right text-sm font-bold text-slate-900">{pct}%</span>
                            <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold md:inline-flex ${badge.cls}`}><BadgeIcon className="h-3.5 w-3.5" />{badge.label}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
        </div>
    </main>
  );
};

export default LessonPlanStatusView;
