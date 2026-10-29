import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, FileText, RefreshCw } from 'lucide-react';
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

  // Accordion + pagination (a page of exam groups at a time).
  const PAGE_SIZE = 5;
  const [openTitle, setOpenTitle] = useState(null);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); setOpenTitle(null); }, [tab]);
  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageGroups = groups.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  // First group on the page opens by default until the teacher picks another.
  const expanded = openTitle === null ? pageGroups[0]?.title : openTitle;

  return (
    <div className="min-h-full bg-[#f6f8fb] p-3 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-6xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-bold leading-tight text-[#0f1b3d]">My Exam Duty</h1>
            <p className="text-[13px] text-[#64748b]">Every exam you are assigned to invigilate — date, time, class and room.</p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-medium text-[#0f1b3d] shadow-sm transition hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#2563eb]' : 'text-[#475569]'} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-2xl border border-[#dbe7fb] bg-[#f2f7ff] px-5 py-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e0ebfd] text-[#2563eb]"><CalendarCheck size={26} /></span>
            <div><p className="text-[28px] font-bold leading-tight text-[#0f1b3d]">{upcomingCount}</p><p className="text-[14px] text-[#64748b]">Upcoming duties</p></div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-[#d4f1de] bg-[#f2fbf5] px-5 py-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dcf5e6] text-[#16a34a]"><CheckCircle2 size={26} /></span>
            <div><p className="text-[28px] font-bold leading-tight text-[#0f1b3d]">{pastCount}</p><p className="text-[14px] text-[#64748b]">Completed duties</p></div>
          </div>
        </div>

        <div className="flex rounded-xl border border-[#e6ebf2] bg-white px-2">
          {[['upcoming', `Upcoming (${upcomingCount})`], ['past', `Past (${pastCount})`]].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`-mb-px border-b-2 px-6 py-3 text-[14px] font-semibold transition ${tab === key ? 'border-[#2563eb] text-[#2563eb]' : 'border-transparent text-[#64748b] hover:text-[#0f1b3d]'}`}>
              {label}
            </button>
          ))}
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {loading && !exams.length ? (
          <div className="rounded-2xl border border-[#e6ebf2] bg-white p-8 text-center text-sm text-[#64748b]">Loading exam duty…</div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><ClipboardCheck size={22} /></div>
            <h2 className="mt-4 text-base font-semibold text-[#0f1b3d]">{tab === 'upcoming' ? 'No upcoming exam duty' : 'No past exam duty'}</h2>
            <p className="mt-1 text-sm text-[#64748b]">Duties appear here once the admin assigns you as an invigilator.</p>
          </div>
        ) : (
          <>
            {pageGroups.map((g) => {
              const isOpen = expanded === g.title;
              const badge = tab === 'past'
                ? { text: 'Completed', cls: 'bg-[#dcf5e6] text-[#15803d]' }
                : g.published ? { text: 'Routine published', cls: 'bg-[#dbeafe] text-[#2563eb]' } : { text: 'Provisional', cls: 'bg-[#fdf0d2] text-[#b45309]' };
              return (
                <section key={g.title} className="overflow-hidden rounded-2xl border border-[#e6ebf2] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <button type="button" onClick={() => setOpenTitle(isOpen ? '' : g.title)} className="flex w-full items-center gap-4 px-4 py-3 text-left">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8f1ff] text-[#2563eb]"><FileText size={22} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-[16px] font-bold text-[#0f1b3d]">{g.title}</h2>
                        <span className={`rounded-full px-3 py-0.5 text-[12px] font-semibold ${badge.cls}`}>{badge.text}</span>
                      </div>
                      <p className="text-[13px] text-[#64748b]">{g.rows.length} dut{g.rows.length === 1 ? 'y' : 'ies'}</p>
                    </div>
                    <ChevronDown size={20} className={`shrink-0 text-[#64748b] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      <div className="overflow-x-auto rounded-xl border border-[#e6ebf2]">
                        <table className="w-full min-w-[640px] text-left text-[13px]">
                          <thead className="bg-[#f8fafc] text-[12px] text-[#64748b]">
                            <tr>
                              <th className="border-r border-[#eef2f7] px-4 py-2.5 font-medium">Date</th>
                              <th className="border-r border-[#eef2f7] px-4 py-2.5 font-medium">Time</th>
                              <th className="border-r border-[#eef2f7] px-4 py-2.5 font-medium">Subject</th>
                              <th className="px-4 py-2.5 font-medium">Venue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.rows.map((e) => {
                              const end = endTime(e.time, e.duration);
                              return (
                                <tr key={e._id} className="border-t border-[#eef2f7] text-[#0f1b3d]">
                                  <td className="border-r border-[#eef2f7] px-4 py-3">{fmtDate(e.date)} ({fmtDay(e.date)})</td>
                                  <td className="border-r border-[#eef2f7] px-4 py-3">{e.time ? `${to12h(e.time)}${end ? ` – ${to12h(end)}` : ''}` : '—'}</td>
                                  <td className="border-r border-[#eef2f7] px-4 py-3">{e.subjects?.join(', ') || e.subjectId?.name || e.subject || '—'}</td>
                                  <td className="px-4 py-3">{venueOf(e)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}

            {groups.length > PAGE_SIZE && (
              <div className="flex items-center justify-between rounded-xl border border-[#e6ebf2] bg-white px-4 py-2 text-[12px] text-[#64748b]">
                <span>Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, groups.length)} of {groups.length} exams</span>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={safePage <= 1} onClick={() => { setPage(safePage - 1); setOpenTitle(null); }} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e2e8f0] disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={16} /></button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" onClick={() => { setPage(n); setOpenTitle(null); }} className={`h-7 min-w-7 rounded-md px-2 font-semibold ${n === safePage ? 'bg-[#2563eb] text-white' : 'border border-[#e2e8f0] text-[#334155] hover:bg-slate-50'}`}>{n}</button>
                  ))}
                  <button type="button" disabled={safePage >= totalPages} onClick={() => { setPage(safePage + 1); setOpenTitle(null); }} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e2e8f0] disabled:opacity-40" aria-label="Next page"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TeacherExamDutyList;
