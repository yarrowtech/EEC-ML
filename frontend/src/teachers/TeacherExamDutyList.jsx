import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, ClipboardCheck, MapPin, RefreshCw } from 'lucide-react';
import { apiFetch } from '../utils/authSession';

// "My Exam Duty": every exam where this teacher is a named invigilator,
// straight from the exam data (GET /api/exam/teacher/routine), grouped by exam.
// Unlike the duty notification, this shows duties as soon as the admin assigns
// invigilators — marked "Provisional" until the routine is published.

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const to12h = (hhmm) => {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(hhmm || '');
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};
const endTime = (hhmm, mins) => {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m || !Number(mins)) return '';
  const total = Number(m[1]) * 60 + Number(m[2]) + Number(mins);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
const fmtDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value || '—') : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtDay = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { weekday: 'short' });
};
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const venueOf = (exam) => {
  const room = exam?.roomId;
  const parts = [
    room?.floorId?.buildingId?.name,
    room?.floorId?.name,
    room?.roomNumber && `Room ${room.roomNumber}`,
  ].filter(Boolean);
  return parts.join(' · ') || exam?.venue || '—';
};

const TeacherExamDutyList = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('upcoming');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await apiFetch(`${API_BASE}/api/exam/teacher/routine`, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      }, navigate);
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Unable to load exam duty');
      setExams(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load exam duty');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const today = todayIso();
  // Count duties (unique date + time + room slots), not raw subject exams.
  const slotKey = (e) => [String(e.date || '').slice(0, 10), e.time, e.duration, venueOf(e)].join('|');
  // A duty is past once its exam is completed: the admin marked the exam (or
  // its whole exam group) Completed, its date has passed, or — today — its
  // paper has already ended.
  const now = new Date();
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isPastDuty = (e) => {
    if (e.status === 'Completed' || e.groupId?.status === 'Completed') return true;
    const d = String(e.date || '').slice(0, 10);
    if (!d) return false;
    if (d < today) return true;
    if (d === today) {
      const end = endTime(e.time, e.duration) || e.time;
      return Boolean(end) && end <= nowHHMM;
    }
    return false;
  };
  const upcomingCount = new Set(exams.filter((e) => !isPastDuty(e)).map(slotKey)).size;
  const pastCount = new Set(exams.filter(isPastDuty).map(slotKey)).size;

  const groups = useMemo(() => {
    const list = exams.filter((e) => (tab === 'upcoming' ? !isPastDuty(e) : isPastDuty(e)));
    const map = new Map();
    list.forEach((e) => {
      const title = e.groupId?.title || e.title || 'Exam';
      if (!map.has(title)) {
        map.set(title, {
          title,
          published: Boolean(e.groupId?.publishedAt) || e.groupId?.status === 'Published',
          rows: [],
        });
      }
      const g = map.get(title);
      if (e.groupId?.publishedAt || e.groupId?.status === 'Published') g.published = true;
      g.rows.push(e);
    });
    // A combined sitting (several classes/subjects in the same room at the same
    // date + time) is one invigilation duty — merge it into a single row.
    const mergeSlots = (rows) => {
      const slots = new Map();
      rows.forEach((e) => {
        const key = [String(e.date || '').slice(0, 10), e.time, e.duration, venueOf(e)].join('|');
        const subject = e.subjectId?.name || e.subject || '';
        const cls = [e.classId?.name || e.grade, e.sectionId?.name || e.section].filter(Boolean).join(' – ');
        if (!slots.has(key)) {
          slots.set(key, { ...e, subjects: subject ? [subject] : [], classes: cls ? [cls] : [] });
          return;
        }
        const slot = slots.get(key);
        if (subject && !slot.subjects.includes(subject)) slot.subjects.push(subject);
        if (cls && !slot.classes.includes(cls)) slot.classes.push(cls);
      });
      return [...slots.values()];
    };
    return [...map.values()]
      .map((g) => ({
        ...g,
        rows: mergeSlots(g.rows).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time).localeCompare(String(b.time))),
      }))
      .sort((a, b) => (tab === 'upcoming' ? 1 : -1) * String(a.rows[0]?.date).localeCompare(String(b.rows[0]?.date)));
  }, [exams, tab, today, nowHHMM]);

  return (
    <div className="min-h-full bg-slate-50 p-3 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Teacher Portal</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">My Exam Duty</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">Every exam you are assigned to invigilate — date, time, class and room.</p>
            </div>
            <button type="button" onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 disabled:opacity-60">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-indigo-50 p-3"><p className="text-2xl font-semibold text-indigo-700">{upcomingCount}</p><p className="mt-1 text-xs text-indigo-600">Upcoming duties</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-2xl font-semibold text-slate-900">{pastCount}</p><p className="mt-1 text-xs text-slate-500">Completed</p></div>
          </div>
        </section>

        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          {[['upcoming', 'Upcoming'], ['past', 'Past']].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === key ? 'bg-slate-950 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              {label}
            </button>
          ))}
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {loading && !exams.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading exam duty…</div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><ClipboardCheck size={22} /></div>
            <h2 className="mt-4 text-base font-semibold text-slate-950">{tab === 'upcoming' ? 'No upcoming exam duty' : 'No past exam duty'}</h2>
            <p className="mt-1 text-sm text-slate-500">Duties appear here once the admin assigns you as an invigilator.</p>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
                <CalendarClock size={18} className="text-indigo-600" />
                <h2 className="font-semibold text-slate-900">{g.title}</h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tab === 'past' ? 'bg-slate-100 text-slate-600' : g.published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {tab === 'past' ? 'Completed' : g.published ? 'Routine published' : 'Provisional'}
                </span>
                <span className="ml-auto text-xs text-slate-400">{g.rows.length} dut{g.rows.length === 1 ? 'y' : 'ies'}</span>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Date</th>
                      <th className="px-4 py-2 font-semibold">Time</th>
                      <th className="px-4 py-2 font-semibold">Subject</th>
                      {/* <th className="px-4 py-2 font-semibold">Class</th> */}
                      <th className="px-4 py-2 font-semibold">Venue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((e) => {
                      const end = endTime(e.time, e.duration);
                      return (
                        <tr key={e._id} className="border-t border-slate-100">
                          <td className="px-4 py-2.5"><span className="font-medium text-slate-800">{fmtDate(e.date)}</span> <span className="text-xs text-slate-400">{fmtDay(e.date)}</span></td>
                          <td className="px-4 py-2.5 text-slate-700">{e.time ? `${to12h(e.time)}${end ? ` – ${to12h(end)}` : ''}` : '—'}</td>
                          <td className="px-4 py-2.5 text-slate-700">{e.subjects?.join(', ') || e.subjectId?.name || e.subject || '—'}</td>
                          {/* <td className="px-4 py-2.5 text-slate-700">{e.classes?.join(', ') || '—'}</td> */}
                          <td className="px-4 py-2.5 text-slate-700"><span className="inline-flex items-center gap-1"><MapPin size={13} className="text-slate-400" />{venueOf(e)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
};

export default TeacherExamDutyList;
