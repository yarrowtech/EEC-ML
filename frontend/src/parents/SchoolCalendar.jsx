import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { parentApiJson } from './parentApi';
import ChildSwitcher from './ChildSwitcher';
import PageHeader from './PageHeader';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import useParentChildren from './useParentChildren';

// School calendar: holidays, the selected child's exams and PTMs in one
// month view plus an "upcoming" list. Data comes from the existing parent
// endpoints (holidays, exam schedule, meetings) — nothing new to maintain.
const KINDS = {
  holiday: { label: 'Holiday', dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700' },
  exam: { label: 'Exam', dot: 'bg-violet-600', chip: 'bg-violet-50 text-violet-700' },
  ptm: { label: 'PTM / Meeting', dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700' },
};
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  const { options, childKey, setChildKey, selected, loading: childLoading } = useParentChildren();
  const [raw, setRaw] = useState({ holidays: [], examChildren: [], meetings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [pickedDay, setPickedDay] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [h, e, m] = await Promise.allSettled([
      parentApiJson('/api/holidays/parent', {}, navigate),
      parentApiJson('/api/exam/groups/parent-schedule', {}, navigate),
      parentApiJson('/api/meeting/parent/my-meetings', {}, navigate),
    ]);
    const holidays = h.status === 'fulfilled' ? (Array.isArray(h.value) ? h.value : h.value?.holidays || []) : [];
    const examChildren = e.status === 'fulfilled' ? (e.value?.children || []) : [];
    const meetings = m.status === 'fulfilled' && Array.isArray(m.value) ? m.value : [];
    if ([h, e, m].every((r) => r.status === 'rejected')) setError(h.reason?.message || 'Unable to load the calendar');
    setRaw({ holidays, examChildren, meetings });
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
    return events.filter((ev) => ev.date >= now).slice(0, 12);
  }, [events]);
  const pickedEvents = pickedDay ? byDay.get(pickedDay) || [] : [];

  if (loading && childLoading) return <Loading />;

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      <PageHeader title="School Calendar" icon={CalendarDays} subtitle="Holidays, exams and parent-teacher meetings at a glance.">
        <ChildSwitcher options={options} value={childKey} onChange={setChildKey} />
      </PageHeader>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Previous month"><ChevronLeft size={18} /></button>
            <h2 className="text-base font-bold text-slate-900">{cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
            <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Next month"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-400">
            {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((d) => {
              const k = dayKey(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const evs = byDay.get(k) || [];
              const kinds = [...new Set(evs.map((e) => e.kind))];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPickedDay(evs.length ? k : null)}
                  className={`flex aspect-square flex-col items-center justify-start rounded-lg p-1 text-sm transition sm:aspect-auto sm:min-h-16 ${
                    inMonth ? 'text-slate-800' : 'text-slate-300'
                  } ${pickedDay === k ? 'bg-violet-50 ring-2 ring-violet-400' : evs.length ? 'hover:bg-slate-50' : ''} ${
                    kinds.includes('holiday') && inMonth ? 'bg-rose-50/60' : ''
                  }`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${k === today ? 'bg-violet-600 text-white' : ''}`}>{d.getDate()}</span>
                  <span className="mt-1 flex gap-0.5">
                    {kinds.map((kind) => <span key={kind} className={`h-1.5 w-1.5 rounded-full ${KINDS[kind].dot}`} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            {Object.entries(KINDS).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${v.dot}`} />{v.label}</span>
            ))}
          </div>
          {pickedDay && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <p className="text-sm font-semibold text-slate-700">{new Date(pickedDay).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              {pickedEvents.map((ev, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${KINDS[ev.kind].chip}`}>{KINDS[ev.kind].label}</span>
                  <div><p className="font-medium text-slate-800">{ev.title}</p>{ev.sub ? <p className="text-xs text-slate-500">{ev.sub}</p> : null}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-slate-900">Upcoming</h2>
          {loading ? <Loading /> : upcoming.length === 0 ? (
            <EmptyState title="Nothing coming up" hint="Holidays, exams and meetings will show here." icon={CalendarDays} />
          ) : (
            <ul className="space-y-3">
              {upcoming.map((ev, i) => (
                <li key={i} className="flex gap-3">
                  <div className="w-12 shrink-0 rounded-lg bg-slate-50 py-1 text-center">
                    <p className="text-[10px] font-semibold uppercase text-slate-400">{ev.date.toLocaleDateString('en-GB', { month: 'short' })}</p>
                    <p className="text-lg font-bold leading-tight text-slate-800">{ev.date.getDate()}</p>
                  </div>
                  <div className="min-w-0">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${KINDS[ev.kind].chip}`}>{KINDS[ev.kind].label}</span>
                    <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{ev.title}</p>
                    {ev.sub ? <p className="truncate text-xs text-slate-500">{ev.sub}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default SchoolCalendar;
