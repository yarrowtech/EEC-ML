import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, HeartPulse, Loader2, ShieldCheck } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const valueOrPending = (value) => String(value || '').trim() || 'Not recorded';

const StudentHealthReport = () => {
  const [data, setData] = useState({ profile: {}, observations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/student/auth/health`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Unable to load health information');
        setData({
          profile: payload?.profile || {},
          observations: Array.isArray(payload?.observations) ? payload.observations : [],
        });
      } catch (err) {
        setError(err.message || 'Unable to load health information');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="flex min-h-64 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading health record...</div>;

  return (
    <div className="space-y-5 p-3 pb-24 md:p-5 md:pb-6">
      <header className="rounded-2xl border border-rose-100 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-rose-600">My wellness record</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Health Information</h1>
        <p className="mt-2 text-sm text-slate-600">Your school profile and health observations shared by teachers.</p>
      </header>
      {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-5 w-5" />{error}</div>}

      {!error && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Blood group', valueOrPending(data.profile.bloodGroup)],
              ['Allergies', valueOrPending(data.profile.allergies)],
              ['Known health issues', valueOrPending(data.profile.knownHealthIssues)],
              ['Immunization', valueOrPending(data.profile.immunizationStatus)],
            ].map(([label, value]) => (
              <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
              </article>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-rose-500" /><h2 className="font-bold text-slate-900">Shared teacher observations</h2></div>
            {data.observations.length === 0 ? (
              <div className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500"><ShieldCheck className="mx-auto mb-2 h-8 w-8 text-emerald-500" />No health observations require your attention.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {data.observations.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{item.teacherName}</p>
                      <span className="text-xs text-slate-500">{item.recordedAt ? new Date(item.recordedAt).toLocaleDateString() : ''}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(item.healthObservations || {}).map(([key, value]) => (
                        <span key={key} className="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-700">{key}: {String(value)}</span>
                      ))}
                    </div>
                    {item.additionalNotes && <p className="mt-3 text-sm text-slate-600">{item.additionalNotes}</p>}
                    {item.followUpRequired && <p className="mt-2 flex items-center gap-1 text-xs font-bold text-amber-700"><Activity className="h-3.5 w-3.5" /> Follow-up requested</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default StudentHealthReport;
