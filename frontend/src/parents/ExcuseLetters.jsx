import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, FileText, RefreshCw, User, Send } from 'lucide-react';
import { parentApiJson } from './parentApi';
import PageHeader from './PageHeader';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';

const STATUS_CONFIG = {
  approved: {
    label: 'Approved',
    badge: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
    border: 'border-l-emerald-500',
  },
  rejected: {
    label: 'Rejected',
    badge: 'bg-rose-100 text-rose-700',
    dot: 'bg-rose-500',
    border: 'border-l-rose-500',
  },
  pending: {
    label: 'Pending',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
    border: 'border-l-amber-500',
  },
};

const formatDate = (value) => (
  value
    ? new Date(value).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    : '—'
);

const ExcuseLetters = () => {
  const navigate = useNavigate();
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [children, setChildren] = useState([]);
  const [form, setForm] = useState({ studentId: '', dateFrom: '', dateTo: '', reasonType: 'medical', reason: '', additionalNotes: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadLetters = async () => {
    try {
      setLoading(true);
      setError('');
      const [lettersData, childrenData] = await Promise.all([
        parentApiJson('/api/excuse-letters/parent', {}, navigate),
        parentApiJson('/api/attendance/parent/children', {}, navigate),
      ]);
      setLetters(Array.isArray(lettersData) ? lettersData : []);
      const linked = (childrenData?.children || []).map((entry) => entry.student).filter(Boolean);
      setChildren(linked);
      setForm((current) => ({ ...current, studentId: current.studentId || String(linked[0]?._id || '') }));
    } catch (err) {
      setError(err.message || 'Unable to load excuse letters');
    } finally {
      setLoading(false);
    }
  };

  const submitLetter = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true); setError('');
      await parentApiJson('/api/excuse-letters/parent', { method: 'POST', body: JSON.stringify(form) }, navigate);
      setForm((current) => ({ ...current, dateFrom: '', dateTo: '', reason: '', additionalNotes: '' }));
      await loadLetters();
    } catch (err) { setError(err.message || 'Unable to submit excuse letter'); }
    finally { setSubmitting(false); }
  };

  useEffect(() => {
    loadLetters();
  }, []);

  if (loading) {
    return <div className="p-1"><Loading label="excuse letters" rows={3} /></div>;
  }

  return (
    <div className="min-h-screen space-y-6 bg-[#f5f7fb] p-4 font-sans antialiased sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Excuse Letters"
        icon={FileText}
        subtitle="Leave requests submitted for your children."
        actions={(
          <button
            type="button"
            onClick={loadLetters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-700"
          >
            <RefreshCw size={13} /> Reload
          </button>
        )}
      />

      {error && <ErrorState message={error} onRetry={loadLetters} />}

      <form onSubmit={submitLetter} className="rounded-3xl border border-white/70 bg-white/60 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-[20px] backdrop-saturate-[1.8] transition duration-200 hover:-translate-y-0.5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#0b0e1a]"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><Send size={16} /></span> Send to teacher</h2>
        <p className="mt-1 text-sm text-slate-500">Tag a child and send an absence request to their class teacher.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="sr-only" htmlFor="excuse-student">Student</label><select id="excuse-student" required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className="rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-sm text-slate-700 outline-none transition duration-200 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"><option value="">Select student</option>{children.map((child) => <option key={child._id} value={child._id}>{child.name}</option>)}</select>
          <label className="sr-only" htmlFor="excuse-date-from">Start date</label><input id="excuse-date-from" required type="date" aria-label="Start date" value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} className="rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-sm text-slate-700 outline-none transition duration-200 focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
          <label className="sr-only" htmlFor="excuse-date-to">End date</label><input id="excuse-date-to" required type="date" aria-label="End date" value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} className="rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-sm text-slate-700 outline-none transition duration-200 focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
          <label className="sr-only" htmlFor="excuse-reason-type">Reason type</label><select id="excuse-reason-type" aria-label="Reason type" value={form.reasonType} onChange={(e) => setForm({ ...form, reasonType: e.target.value })} className="rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-sm text-slate-700 outline-none transition duration-200 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"><option value="medical">Medical</option><option value="family">Family</option><option value="travel">Travel</option><option value="other">Other</option></select>
        </div>
        <textarea required rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason for absence" className="mt-3 w-full rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-sm text-slate-700 outline-none transition duration-200 placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
        <textarea rows={2} value={form.additionalNotes} onChange={(e) => setForm({ ...form, additionalNotes: e.target.value })} placeholder="Additional notes (optional)" className="mt-3 w-full rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 text-sm text-slate-700 outline-none transition duration-200 placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
        <button type="submit" disabled={submitting || !children.length} className="mt-3 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Sending…' : 'Send excuse letter'}</button>
      </form>

      {letters.length === 0 ? (
          <EmptyState icon={FileText} title="No excuse letters yet" hint="Use the form above to send an absence request to a child’s teacher." />
      ) : (
        <div className="space-y-3">
          {letters.map((letter) => {
            const status = STATUS_CONFIG[letter.status] || STATUS_CONFIG.pending;
            return (
              <div
                key={letter._id}
                className={`border-l-4 ${status.border} overflow-hidden rounded-3xl border border-white/70 bg-white/60 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-[20px] backdrop-saturate-[1.8] transition duration-200 hover:-translate-y-0.5`}
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100">
                        <User size={16} className="text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#0b0e1a]">{letter.studentName || 'Student'}</p>
                        <p className="text-xs text-gray-500">
                          Class {letter.className || '—'}{letter.sectionName ? `-${letter.sectionName}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={13} className="text-indigo-500" />
                      {formatDate(letter.dateFrom)} → {formatDate(letter.dateTo)}
                    </span>
                    {letter.createdAt && (
                      <span className="inline-flex items-center gap-1.5 text-gray-400">
                        <Clock size={12} /> Submitted {formatDate(letter.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 rounded-xl border border-white/70 bg-white/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                      {letter.reasonType || 'Other'}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-700">{letter.reason}</p>
                    {letter.additionalNotes && (
                      <p className="mt-2 text-xs text-gray-500">{letter.additionalNotes}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};

export default ExcuseLetters;
