import React, { useEffect, useState } from 'react';
import { BookOpen, CalendarCheck, ClipboardCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const OPTIONS = [
  {
    mode: 'subject_wise',
    icon: BookOpen,
    title: 'Subject-wise',
    text: 'Attendance is taken in every subject period. Teachers pick the subject before marking.',
  },
  {
    mode: 'day_wise',
    icon: CalendarCheck,
    title: 'Day-wise',
    text: 'Attendance is taken once a day, in the first class. No subject is needed.',
  },
];

/**
 * School admin choice of how teachers take student attendance.
 * Saves immediately to /api/attendance/admin/settings.
 */
const AttendanceFormatSettings = () => {
  const [mode, setMode] = useState('subject_wise');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    fetch(`${API_BASE}/api/attendance/admin/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => { if (d?.data?.mode) setMode(d.data.mode); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async (next) => {
    if (next === mode || saving) return;
    const token = localStorage.getItem('token');
    setSaving(next);
    try {
      const res = await fetch(`${API_BASE}/api/attendance/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || 'Could not update attendance format');
      setMode(next);
      toast.success(next === 'day_wise' ? 'Teachers will now take attendance once a day' : 'Teachers will now take attendance for each subject');
    } catch (err) {
      toast.error(err.message || 'Could not update attendance format');
    } finally {
      setSaving('');
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <ClipboardCheck size={20} />
        </span>
        <div>
          <h2 className="text-base font-bold text-gray-900 sm:text-lg">Student Attendance Format</h2>
          <p className="text-sm text-gray-500">Choose how teachers take student attendance. The teacher attendance screen follows this choice.</p>
        </div>
      </div>
      <div role="radiogroup" aria-label="Attendance format" className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {OPTIONS.map(({ mode: value, icon: Icon, title, text }) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={loading || Boolean(saving)}
              onClick={() => save(value)}
              className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors disabled:cursor-wait ${active ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {saving === value ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{title}</span>
                  {active && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">Active</span>}
                </span>
                <span className="mt-1 block text-sm text-gray-600">{text}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default AttendanceFormatSettings;
