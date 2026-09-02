import React, { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Calendar,
  Droplet,
  Heart,
  Loader2,
  Phone,
  ShieldAlert,
  Sparkles,
  Syringe,
  User,
} from 'lucide-react';
import { formatStudentDisplay } from '../utils/studentDisplay';
import { parentApiJson } from './parentApi';

const MOOD_LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  neutral: 'Neutral',
  concerning: 'Needs attention',
  critical: 'Critical',
};

const Chips = ({ items, tone = 'slate', empty }) => {
  if (!items || items.length === 0) {
    return <p className="text-sm text-slate-400">{empty}</p>;
  }
  const toneClass =
    tone === 'rose'
      ? 'bg-rose-100 text-rose-700'
      : tone === 'amber'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-slate-100 text-slate-700';
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <li key={`${item}-${i}`} className={`rounded-full px-3 py-1 text-sm font-medium ${toneClass}`}>
          {item}
        </li>
      ))}
    </ul>
  );
};

const HealthReport = () => {
  const navigate = useNavigate();
  const selectId = useId();
  const [children, setChildren] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await parentApiJson('/api/parent/auth/health', {}, navigate);
        if (!active) return;
        const list = Array.isArray(data?.children) ? data.children : [];
        setChildren(list);
        if (list.length > 0) setSelectedId(String(list[0].studentId));
      } catch (err) {
        if (active) setError(err.message || 'Unable to load the health report.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  const child = useMemo(
    () => children.find((c) => String(c.studentId) === String(selectedId)) || children[0] || null,
    [children, selectedId],
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-500" aria-live="polite" aria-busy="true">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm font-medium">Loading health records…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
      <header className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full -mr-32 -mt-32" />
        <div className="relative space-y-2">
          <div className="inline-flex items-center gap-2 bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <Heart size={14} />
            <span>Health &amp; Wellbeing</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Health Report</h1>
          <p className="text-slate-600 max-w-2xl text-sm sm:text-base leading-relaxed">
            Medical information recorded during enrolment, plus wellbeing notes from the school counsellor.
            Contact the school office to update any of these details.
          </p>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-center gap-3 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {!error && children.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Heart size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No health records available yet</p>
          <p className="mt-1 text-xs text-slate-400">The school has not added medical details for your children.</p>
        </div>
      )}

      {children.length > 0 && (
        <>
          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <label htmlFor={selectId} className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              Select child
            </label>
            <select
              id={selectId}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full sm:w-80 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none"
            >
              {children.map((c) => (
                <option key={c.studentId} value={c.studentId}>
                  {formatStudentDisplay({ studentName: c.name, roll: c.roll, section: c.className })}
                </option>
              ))}
            </select>
          </section>

          {child && (
            <>
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                  { label: 'Student', value: child.name, icon: User, hint: child.className || '—' },
                  { label: 'Age', value: child.age != null ? `${child.age} yrs` : '—', icon: Calendar, hint: 'From date of birth' },
                  { label: 'Blood Group', value: child.bloodGroup || '—', icon: Droplet, hint: 'On file' },
                  {
                    label: 'Wellbeing',
                    value: child.wellbeing?.mood ? (MOOD_LABELS[child.wellbeing.mood] || child.wellbeing.mood) : '—',
                    icon: Sparkles,
                    hint: child.wellbeing?.lastAssessment
                      ? `Reviewed ${new Date(child.wellbeing.lastAssessment).toLocaleDateString()}`
                      : 'Not assessed',
                  },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="p-3 rounded-xl bg-rose-50 text-rose-600 w-fit mb-4">
                      <stat.icon size={20} aria-hidden="true" />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                    <p className="text-[11px] text-slate-500 mt-2">{stat.hint}</p>
                  </div>
                ))}
              </section>

              <section className="grid gap-6 md:grid-cols-2">
                <article className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <ShieldAlert size={18} className="text-rose-500" aria-hidden="true" /> Allergies
                  </h2>
                  <Chips items={child.allergies} tone="rose" empty="No known allergies recorded." />
                </article>

                <article className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Activity size={18} className="text-amber-500" aria-hidden="true" /> Known health conditions
                  </h2>
                  <Chips items={child.knownHealthIssues} tone="amber" empty="No health conditions recorded." />
                </article>

                <article className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Sparkles size={18} className="text-indigo-500" aria-hidden="true" /> Learning support needs
                  </h2>
                  <Chips items={child.learningDisabilities} empty="No learning support needs recorded." />
                </article>

                <article className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Syringe size={18} className="text-emerald-500" aria-hidden="true" /> Immunisation
                  </h2>
                  <p className="text-sm text-slate-700">{child.immunizationStatus || 'No immunisation status on file.'}</p>
                </article>
              </section>

              {child.wellbeing && (
                <section className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-4">
                  <h2 className="text-lg font-bold text-slate-900">Counsellor wellbeing notes</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{child.wellbeing.academicStress ?? '—'}<span className="text-sm text-slate-400">/10</span></p>
                      <p className="text-[11px] text-slate-500 uppercase tracking-wide">Academic stress</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{child.wellbeing.socialEngagement ?? '—'}<span className="text-sm text-slate-400">/10</span></p>
                      <p className="text-[11px] text-slate-500 uppercase tracking-wide">Social engagement</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{child.wellbeing.counselingSessions ?? 0}</p>
                      <p className="text-[11px] text-slate-500 uppercase tracking-wide">Counselling sessions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{MOOD_LABELS[child.wellbeing.mood] || '—'}</p>
                      <p className="text-[11px] text-slate-500 uppercase tracking-wide">Overall mood</p>
                    </div>
                  </div>
                  {child.wellbeing.notes && (
                    <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4">{child.wellbeing.notes}</p>
                  )}
                </section>
              )}

              <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Phone size={18} className="text-slate-500" aria-hidden="true" /> Emergency contacts
                  </h2>
                </div>
                {child.emergencyContacts.length === 0 ? (
                  <p className="p-6 text-sm text-slate-400">No emergency contacts on file. Please contact the school office.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {child.emergencyContacts.map((c, i) => (
                      <li key={`${c.name}-${i}`} className="px-6 py-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.relation}</p>
                        </div>
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className="text-sm font-semibold text-amber-600 hover:text-amber-700">
                            {c.phone}
                          </a>
                        ) : (
                          <span className="text-sm text-slate-400">No number</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default HealthReport;
