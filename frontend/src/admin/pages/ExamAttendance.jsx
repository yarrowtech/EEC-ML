import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ChevronDown, Circle, RefreshCw, ScanLine, Search, Users } from 'lucide-react';
import { apiFetch } from '../../utils/authSession';

// Exam attendance (admit-card QR scans), live: date → class/section → students.
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const POLL_MS = 5000;

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtTime = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const ExamAttendance = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(localToday());
  const [dates, setDates] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lastSync, setLastSync] = useState(null);

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`${API_BASE}/api/exam-attendance/dates`, { headers: headers() }, navigate);
        const body = await res.json().catch(() => null);
        if (res.ok) setDates(body?.data?.dates || []);
      } catch { /* ignore */ }
    })();
  }, [navigate]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/exam-attendance?date=${date}`, { headers: headers(), cache: 'no-store' }, navigate);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || 'Failed to load exam attendance');
      setData(body.data);
      setError('');
      setLastSync(new Date());
    } catch (err) {
      if (err?.code) return;
      setError(err.message || 'Failed to load exam attendance');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [date, navigate]);

  useEffect(() => { load(false); }, [load]);

  // Live updates while the page is visible.
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const classes = data?.classes || [];
  const totals = data?.totals || { expected: 0, present: 0 };
  const q = query.trim().toLowerCase();

  const filteredClasses = useMemo(() => classes.map((c) => {
    const students = c.students.filter((s) => {
      if (q && ![s.name, s.username, String(s.roll ?? '')].some((v) => String(v || '').toLowerCase().includes(q))) return false;
      const presentCount = s.attendance.filter((a) => a.present).length;
      if (statusFilter === 'present') return presentCount > 0;
      if (statusFilter === 'absent') return presentCount < s.attendance.length;
      return true;
    });
    return { ...c, filtered: students };
  }).filter((c) => !q || c.filtered.length), [classes, q, statusFilter]);

  const dateOptions = useMemo(() => [...new Set([...dates, date])].sort(), [dates, date]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><ScanLine className="text-indigo-600" /> Exam Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">Students are marked present when the invigilator scans the QR code on their admit card.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          Live{lastSync ? ` · updated ${lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
          <button type="button" onClick={() => load(false)} className="ml-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Refresh"><RefreshCw size={15} /></button>
        </div>
      </div>

      {/* Date + filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <CalendarDays size={16} />
          <select value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800">
            {dateOptions.map((d) => <option key={d} value={d}>{fmtDate(d)}{d === localToday() ? ' (Today)' : ''}</option>)}
          </select>
        </label>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700" />
        <div className="relative min-w-[12rem] flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, roll no, login ID"
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm" />
        </div>
        <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold">
          {['all', 'present', 'absent'].map((k) => (
            <button key={k} type="button" onClick={() => setStatusFilter(k)}
              className={`rounded-md px-3 py-1 capitalize ${statusFilter === k ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{k}</button>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Classes with exams', value: classes.length },
          { label: 'Expected (student × exam)', value: totals.expected },
          { label: 'Present', value: totals.present, tone: 'text-emerald-600' },
          { label: 'Attendance', value: `${pct(totals.present, totals.expected)}%`, tone: 'text-indigo-600' },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{t.label}</p>
            <p className={`mt-1 text-2xl font-bold ${t.tone || 'text-slate-900'}`}>{t.value}</p>
          </div>
        ))}
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {loading && !data && <p className="py-10 text-center text-sm text-slate-400">Loading…</p>}
      {!loading && !error && classes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
          <Users className="mx-auto text-slate-300" size={36} />
          <p className="mt-2 text-sm text-slate-500">No exams scheduled on {fmtDate(date)}.</p>
        </div>
      )}

      {/* Classes */}
      <div className="space-y-3">
        {filteredClasses.map((c) => {
          const key = `${c.grade}|${c.section}`;
          const isOpen = open[key] ?? Boolean(q);
          const p = pct(c.present, c.expected);
          return (
            <div key={key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <button type="button" onClick={() => setOpen((o) => ({ ...o, [key]: !isOpen }))}
                className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-sm font-bold text-indigo-700">Class {c.grade}-{c.section}</span>
                <span className="text-xs text-slate-500">{c.exams.map((e) => `${e.subject}${e.time ? ` (${e.time})` : ''}`).join(' · ')}</span>
                <span className="ml-auto flex items-center gap-3">
                  <span className="hidden h-2 w-32 overflow-hidden rounded-full bg-slate-100 sm:block">
                    <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${p}%` }} />
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{c.present}/{c.expected} <span className="text-xs font-normal text-slate-400">({p}%)</span></span>
                  <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {isOpen && (
                <div className="overflow-x-auto border-t border-slate-100">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Sl</th>
                        <th className="px-4 py-2.5">Student</th>
                        <th className="px-4 py-2.5">Roll No</th>
                        <th className="px-4 py-2.5">Login ID</th>
                        <th className="px-4 py-2.5">Class</th>
                        {c.exams.map((e) => <th key={e.id} className="px-4 py-2.5">{e.subject}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {c.filtered.length === 0 && (
                        <tr><td colSpan={5 + c.exams.length} className="px-4 py-6 text-center text-slate-400">No students match.</td></tr>
                      )}
                      {c.filtered.map((s, i) => (
                        <tr key={s.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5 text-xs text-slate-500">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-800">{s.name}</td>
                          <td className="px-4 py-2.5 text-slate-600">{s.roll ?? '—'}</td>
                          <td className="px-4 py-2.5 text-slate-600">{s.username || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-600">{s.grade}-{s.section}</td>
                          {s.attendance.map((a) => (
                            <td key={a.examId} className="px-4 py-2.5">
                              {a.present ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                                  title={a.markedByName ? `Scanned by ${a.markedByName}` : ''}>
                                  <CheckCircle2 size={13} /> Present · {fmtTime(a.markedAt)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                                  <Circle size={11} /> Not scanned
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExamAttendance;
