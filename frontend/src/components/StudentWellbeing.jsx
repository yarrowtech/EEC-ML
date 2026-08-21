import React, { useEffect, useState } from 'react';
import { AlertCircle, Brain, Heart, Loader2, Smile, Users } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const moodStyles = {
  excellent: 'bg-emerald-100 text-emerald-700',
  good: 'bg-blue-100 text-blue-700',
  neutral: 'bg-amber-100 text-amber-700',
  concerning: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

// This repository does not include the prop-types runtime; the component is
// internal and receives a fixed metric shape from StudentWellbeing below.
// eslint-disable-next-line react/prop-types
const Metric = ({ icon: Icon, label, value, color }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className={`inline-flex rounded-xl p-2 ${color}`}><Icon className="h-5 w-5" /></div>
    <p className="mt-3 text-xs font-semibold text-slate-500">{label}</p>
    <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
  </article>
);

const StudentWellbeing = () => {
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/student/auth/wellbeing`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Unable to load wellbeing information');
        setAssessment(payload?.assessment || null);
      } catch (err) {
        setError(err.message || 'Unable to load wellbeing information');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="flex min-h-64 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading wellbeing assessment...</div>;

  return (
    <div className="space-y-5 p-3 pb-24 md:p-5 md:pb-6">
      <header className="rounded-2xl border border-purple-100 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-purple-600">My wellness</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Emotional Wellbeing</h1>
        <p className="mt-2 text-sm text-slate-600">Review the latest assessment recorded by your school support team.</p>
      </header>
      {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-5 w-5" />{error}</div>}
      {!error && !assessment && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Heart className="mx-auto h-9 w-9 text-purple-400" /><p className="mt-3 font-semibold text-slate-700">No wellbeing assessment has been recorded yet.</p><p className="mt-1 text-sm text-slate-500">You can contact your class teacher or counselor if you need support.</p></div>}
      {!error && assessment && (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Metric icon={Smile} label="Current mood" value={String(assessment.mood || 'neutral').replace(/^./, (letter) => letter.toUpperCase())} color={moodStyles[assessment.mood] || moodStyles.neutral} />
            <Metric icon={Brain} label="Academic stress" value={`${assessment.academicStress ?? 5}/10`} color="bg-orange-100 text-orange-700" />
            <Metric icon={Users} label="Social engagement" value={`${assessment.socialEngagement ?? 5}/10`} color="bg-blue-100 text-blue-700" />
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-slate-900">Support summary</h2><span className="text-xs text-slate-500">Updated {assessment.lastAssessment ? new Date(assessment.lastAssessment).toLocaleDateString() : 'recently'}</span></div>
            {assessment.notes ? <p className="mt-4 rounded-xl bg-purple-50 p-4 text-sm leading-6 text-purple-900">{assessment.notes}</p> : <p className="mt-4 text-sm text-slate-500">No additional notes were recorded.</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Counseling sessions: <strong>{assessment.counselingSessions || 0}</strong></p>
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Interventions: <strong>{assessment.interventions?.length || 0}</strong></p>
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Behavior changes: <strong>{assessment.behaviorChanges ? 'Noted' : 'None noted'}</strong></p>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default StudentWellbeing;
