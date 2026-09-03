/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Calendar,
  Droplet,
  Heart,
  Phone,
  ShieldAlert,
  Sparkles,
  Syringe,
  User,
} from 'lucide-react';
import { parentApiJson } from './parentApi';
import ChildSwitcher, { useSharedChildSelection } from './ChildSwitcher';
import PageHeader from './PageHeader';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';

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
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const childOptions = useMemo(
    () => children.map((c) => ({ id: String(c.studentId || ''), name: c.name || 'Student' })),
    [children],
  );
  const [childKey, setChildKey, selectedOption] = useSharedChildSelection(childOptions);
  const selectedId = selectedOption?.id || '';

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
    return <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto"><Loading label="health records" rows={3} /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto font-sans antialiased">
      <PageHeader
        title="Health Record"
        icon={Heart}
        subtitle="Medical details from enrolment plus counsellor wellbeing notes. Contact the school office to update anything."
      >
        {children.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Child</p>
            <ChildSwitcher options={childOptions} value={childKey} onChange={setChildKey} label="Child" />
          </div>
        )}
      </PageHeader>

      {error && <ErrorState message={error} />}

      {!error && children.length === 0 && (
        <EmptyState icon={Heart} title="No health records yet" hint="The school office maintains this — contact them to add medical details." />
      )}

      {children.length > 0 && (
        <>

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
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
                    <p className="text-xl font-semibold text-slate-900">{stat.value}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">{stat.hint}</p>
                  </div>
                ))}
              </section>

              <section className="grid gap-6 md:grid-cols-2">
                <article className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <ShieldAlert size={18} className="text-rose-500" aria-hidden="true" /> Allergies
                  </h2>
                  <Chips items={child.allergies} tone="rose" empty="No known allergies recorded." />
                </article>

                <article className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <Activity size={18} className="text-amber-500" aria-hidden="true" /> Known health conditions
                  </h2>
                  <Chips items={child.knownHealthIssues} tone="amber" empty="No health conditions recorded." />
                </article>

                <article className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <Sparkles size={18} className="text-indigo-500" aria-hidden="true" /> Learning support needs
                  </h2>
                  <Chips items={child.learningDisabilities} empty="No learning support needs recorded." />
                </article>

                <article className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <Syringe size={18} className="text-emerald-500" aria-hidden="true" /> Immunisation
                  </h2>
                  <p className="text-sm text-slate-700">{child.immunizationStatus || 'No immunisation status on file.'}</p>
                </article>
              </section>

              {child.wellbeing && (
                <section className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-slate-900">Counsellor wellbeing notes</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{child.wellbeing.academicStress ?? '—'}<span className="text-sm text-slate-400">/10</span></p>
                      <p className="text-xs font-medium text-slate-500">Academic stress</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{child.wellbeing.socialEngagement ?? '—'}<span className="text-sm text-slate-400">/10</span></p>
                      <p className="text-xs font-medium text-slate-500">Social engagement</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{child.wellbeing.counselingSessions ?? 0}</p>
                      <p className="text-xs font-medium text-slate-500">Counselling sessions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{MOOD_LABELS[child.wellbeing.mood] || '—'}</p>
                      <p className="text-xs font-medium text-slate-500">Overall mood</p>
                    </div>
                  </div>
                  {child.wellbeing.notes && (
                    <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4">{child.wellbeing.notes}</p>
                  )}
                </section>
              )}

              <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
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
                          <p className="text-sm font-semibold text-slate-900">{c.name}</p>
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
