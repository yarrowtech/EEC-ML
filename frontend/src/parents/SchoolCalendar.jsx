import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { parentApiJson } from './parentApi';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import useParentChildren from './useParentChildren';

// School calendar: holidays, the selected child's exams and PTMs in one
// month view plus an "upcoming" list. Data comes from the existing parent
// endpoints (holidays, exam schedule, meetings) — nothing new to maintain.
const KINDS = {
  holiday: { label: 'Holiday', short: 'Holiday', dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-600' },
  exam: { label: 'Exam', short: 'Exam', dot: 'bg-blue-600', chip: 'bg-blue-50 text-blue-600' },
  ptm: { label: 'PTM / Meeting', short: 'PTM', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-600' },
};
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const UPCOMING_LIMIT = 12;
const CARD = 'rounded-xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]';

// Client-side cache: paint the last calendar data instantly, then refresh it
// in the background. Scoped to the logged-in token.
const CALENDAR_CACHE_KEY = 'parent_calendar_cache_v1';
const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;

const calendarCacheScope = () => {
  try {
    return (localStorage.getItem('token') || '').split('.')[1] || 'anonymous';
  } catch {
    return 'anonymous';
  }
};

const readCalendarCache = () => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CALENDAR_CACHE_KEY) || 'null');
    if (!parsed || parsed.scope !== calendarCacheScope()) return null;
    if (Date.now() - parsed.cachedAt > CALENDAR_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeCalendarCache = (data) => {
  try {
    sessionStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify({ scope: calendarCacheScope(), cachedAt: Date.now(), data }));
  } catch {
    // Storage full/blocked — caching is best-effort.
  }
};

// Entrance: sections rise in one after another; list rows stagger.
const PAGE_MOTION = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const RISE = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};
const LIST_MOTION = { hidden: {}, show: { transition: { staggerChildren: 0.03, delayChildren: 0.1 } } };
const ROW = {
  hidden: { opacity: 0, x: 10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const validDate = (v) => v && !Number.isNaN(new Date(v).getTime());

const expandRange = (start, end) => {
  const out = [];
  const s = new Date(start);
  const e = validDate(end) ? new Date(end) : s;
  for (let d = new Date(s.getFullYear(), s.getMonth(), s.getDate()); d <= e && out.length < 62; d.setDate(d.getDate() + 1)) {
    out.push(new Date(d));
  }
  return out;
};

const SchoolCalendar = () => {
  const navigate = useNavigate();
  const { selected, loading: childLoading } = useParentChildren();
  const [raw, setRaw] = useState(() => readCalendarCache() || { holidays: [], examChildren: [], meetings: [] });
  const [loading, setLoading] = useState(() => !readCalendarCache());
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [pickedDay, setPickedDay] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const cached = readCalendarCache();
    if (!cached) setLoading(true);
    setError('');
    const [h, e, m] = await Promise.allSettled([
      parentApiJson('/api/holidays/parent', {}, navigate),
      parentApiJson('/api/exam/groups/parent-schedule', {}, navigate),
      parentApiJson('/api/meeting/parent/my-meetings', {}, navigate),
    ]);
    const holidays = h.status === 'fulfilled' ? (Array.isArray(h.value) ? h.value : h.value?.holidays || []) : [];
    const examChildren = e.status === 'fulfilled' ? (e.value?.children || []) : [];
    const meetings = m.status === 'fulfilled' && Array.isArray(m.value) ? m.value : [];
    if ([h, e, m].every((r) => r.status === 'rejected')) {
      // Keep showing cached data if a background refresh fails.
      if (!cached) setError(h.reason?.message || 'Unable to load the calendar');
      setLoading(false);
      return;
    }
    const next = { holidays, examChildren, meetings };
    setRaw(next);
    writeCalendarCache(next);
    setLoading(false);
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  // Flatten every source into { date, kind, title, sub }.
  const events = useMemo(() => {
    const list = [];
    raw.holidays.forEach((hol) => {
      const start = hol.startDate || hol.date;
      if (!validDate(start)) return;
      expandRange(start, hol.endDate).forEach((d) => list.push({ date: d, kind: 'holiday', title: hol.name || hol.title || 'Holiday', sub: hol.description || '' }));
    });
    const child = raw.examChildren.find((c) => String(c.studentId) === String(selected?.id)) || raw.examChildren[0];
    (child?.groups || []).forEach((g) => {
      (g.subjects || []).forEach((s) => {
        if (!validDate(s.date)) return;
        const subj = s.subject?.name || s.subjectName || s.subject || 'Exam';
        const time = s.startTime ? `${s.startTime}${s.endTime ? ` – ${s.endTime}` : ''}` : '';
        list.push({ date: new Date(s.date), kind: 'exam', title: `${g.title || 'Exam'} — ${subj}`, sub: [time, s.venue].filter(Boolean).join(' · ') });
      });
    });
    raw.meetings
      .filter((mt) => !selected?.id || !mt.studentId || String(mt.studentId?._id || mt.studentId) === String(selected.id))
      .forEach((mt) => {
        if (!validDate(mt.meetingDate)) return;
        list.push({ date: new Date(mt.meetingDate), kind: 'ptm', title: mt.title || mt.topic || 'Parent-teacher meeting', sub: [mt.meetingTime, mt.meetingType, mt.status].filter(Boolean).join(' · ') });
      });
    return list.sort((a, b) => a.date - b.date);
  }, [raw, selected?.id]);

  const byDay = useMemo(() => {
    const map = new Map();
    events.forEach((ev) => {
      const k = dayKey(ev.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(ev);
    });
    return map;
  }, [events]);

  const monthCells = useMemo(() => {
    const first = new Date(cursor);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);

  const today = dayKey(new Date());
  const upcoming = useMemo(() => {
    const now = new Date(new Date().toDateString());
    return events.filter((ev) => ev.date >= now);
  }, [events]);
  const visibleUpcoming = showAll ? upcoming : upcoming.slice(0, UPCOMING_LIMIT);
  const pickedEvents = pickedDay ? byDay.get(pickedDay) || [] : [];


  const shiftMonth = (by) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + by, 1));
  const goToday = () => {
    const n = new Date();
    setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
    setPickedDay(null);
  };
  const openEvent = (ev) => {
    setCursor(new Date(ev.date.getFullYear(), ev.date.getMonth(), 1));
    setPickedDay(dayKey(ev.date));
  };

  if (loading && childLoading) return <Loading />;

  return (
    <motion.div variants={PAGE_MOTION} initial="hidden" animate="show" className="space-y-4 p-3 sm:p-4 md:p-5">
      <motion.header variants={RISE} className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <CalendarDays size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight text-[#0b1446]">School Calendar</h1>
            <p className="text-xs text-slate-500 sm:text-sm">Holidays, exams and parent-teacher meetings at a glance.</p>
          </div>
        </div>
      </motion.header>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {/* Month grid */}
          <motion.section variants={RISE} className={`${CARD} p-3`}>
            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1">
                <h2 className="text-base font-bold text-[#0b1446]">{cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
                <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600">
                  <ChevronRight size={14} />
                </button>
              </div>
              <button type="button" onClick={goToday} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">
                Today
              </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-100">
              <div className="grid grid-cols-7 bg-slate-50 text-center text-[11px] font-medium text-slate-600">
                {WEEKDAYS.map((w) => <div key={w} className="py-2">{w}</div>)}
              </div>
              <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={dayKey(cursor)}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="grid grid-cols-7"
              >
                {monthCells.map((d, i) => {
                  const k = dayKey(d);
                  const inMonth = d.getMonth() === cursor.getMonth();
                  const evs = byDay.get(k) || [];
                  const kinds = [...new Set(evs.map((e) => e.kind))];
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setPickedDay(evs.length ? k : null)}
                      className={`flex h-14 flex-col items-center justify-center gap-1 border-slate-100 text-sm transition ${i % 7 ? 'border-l' : ''} ${i >= 7 ? 'border-t' : ''} ${
                        inMonth ? 'text-slate-800' : 'text-slate-300'
                      } ${pickedDay === k ? 'bg-blue-50' : evs.length ? 'hover:bg-slate-50' : ''}`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110 ${k === today ? 'bg-blue-600 font-bold text-white shadow-[0_4px_10px_rgba(37,99,235,0.35)]' : ''}`}>
                        {d.getDate()}
                      </span>
                      <span className="flex h-1.5 gap-0.5">
                        {inMonth && kinds.map((kind) => <span key={kind} className={`h-1.5 w-1.5 rounded-full ${KINDS[kind].dot}`} />)}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-3 flex flex-wrap gap-5 rounded-lg bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
              {Object.entries(KINDS).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${v.dot}`} />{v.label}</span>
              ))}
            </div>

            <AnimatePresence initial={false}>
            {pickedDay && (
              <motion.div
                key={pickedDay}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="mt-3 space-y-2 overflow-hidden border-t border-slate-100 pt-3"
              >
                <p className="text-sm font-semibold text-slate-700">{new Date(pickedDay).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                {pickedEvents.map((ev, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 rounded-md px-2 py-0.5 text-[10px] font-semibold ${KINDS[ev.kind].chip}`}>{KINDS[ev.kind].label}</span>
                    <div><p className="font-medium text-slate-800">{ev.title}</p>{ev.sub ? <p className="text-xs text-slate-500">{ev.sub}</p> : null}</div>
                  </div>
                ))}
              </motion.div>
            )}
            </AnimatePresence>
          </motion.section>
        </div>

        {/* Upcoming */}
        <motion.section variants={RISE} className={`${CARD} p-3`}>
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-[#0b1446]">Upcoming</h2>
            {upcoming.length > UPCOMING_LIMIT ? (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-blue-600 hover:underline">
                {showAll ? 'Show Less' : 'View All'}
              </button>
            ) : null}
          </div>
          {loading ? <Loading /> : upcoming.length === 0 ? (
            <EmptyState title="Nothing coming up" hint="Holidays, exams and meetings will show here." icon={CalendarDays} />
          ) : (
            <motion.ul variants={LIST_MOTION} initial="hidden" animate="show" className="space-y-1.5">
              {visibleUpcoming.map((ev, i) => (
                <motion.li key={`${dayKey(ev.date)}-${ev.kind}-${i}`} variants={ROW}>
                  <motion.button
                    type="button"
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => openEvent(ev)}
                    className="group flex w-full items-center gap-3 rounded-lg border border-slate-100 bg-white p-1.5 pr-3 text-left transition hover:border-blue-200 hover:bg-blue-50/30"
                  >
                    <div className="w-11 shrink-0 rounded-md bg-slate-50 py-1 text-center">
                      <p className="text-[10px] text-slate-500">{ev.date.toLocaleDateString('en-GB', { month: 'short' })}</p>
                      <p className="text-base font-bold leading-tight text-[#0b1446]">{ev.date.getDate()}</p>
                    </div>
                    <span className={`w-[68px] shrink-0 rounded-md py-1 text-center text-[11px] font-semibold ${KINDS[ev.kind].chip}`}>{KINDS[ev.kind].short}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#0b1446]">{ev.title}</p>
                      {ev.sub ? <p className="truncate text-[11px] text-slate-500">{ev.sub}</p> : null}
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-slate-500 group-hover:text-blue-600" />
                  </motion.button>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </motion.section>
      </div>
    </motion.div>
  );
};

export default SchoolCalendar;
