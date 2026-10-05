/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpenText, CheckCircle2, ClipboardPlus, Droplet, Edit, HeartPulse, Info, Loader2, Lock, Pencil, Phone,
  ShieldPlus, Syringe, User, UserRound, Users, Wind, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parentApiJson } from './parentApi';
import { useSharedChildSelection } from './ChildSwitcher';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import { useDialog } from './useDialog';

const CARD = 'rounded-xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]';
const INPUT = 'w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

const MOOD_LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  neutral: 'Neutral',
  concerning: 'Needs attention',
  critical: 'Critical',
};

const PAGE_MOTION = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const RISE = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

// The four medical sections. `list` ones hold comma-separated items.
const SECTIONS = [
  {
    key: 'allergies', list: true, title: 'Allergies', Icon: Wind, iconTone: 'bg-orange-50 text-orange-500',
    subtitle: 'Known allergies to food, medicine, or environmental factors.',
    emptyTitle: 'No Known Allergies', emptyText: (n) => `There are no known allergies on file for ${n}.`,
    placeholder: 'e.g. Peanuts, Dust, Penicillin',
  },
  {
    key: 'knownHealthIssues', list: true, title: 'Known health conditions', Icon: HeartPulse, iconTone: 'bg-rose-50 text-rose-500',
    subtitle: 'Any ongoing or past medical conditions.',
    emptyTitle: 'None', emptyText: () => 'There are no known health conditions on file.',
    placeholder: 'e.g. Asthma, Diabetes',
  },
  {
    key: 'learningDisabilities', list: true, title: 'Learning support needs', Icon: BookOpenText, iconTone: 'bg-violet-50 text-violet-600',
    subtitle: 'Any special educational or learning support requirements.',
    emptyTitle: 'None', emptyText: () => 'There are no learning support needs on file.',
    placeholder: 'e.g. Dyslexia, ADHD',
  },
  {
    key: 'immunizationStatus', list: false, title: 'Immunisation', Icon: Syringe, iconTone: 'bg-blue-50 text-blue-600',
    subtitle: 'Vaccination status as per school records.',
    emptyTitle: 'Not recorded', emptyText: () => 'No immunisation status on file.',
    placeholder: 'e.g. Fully immunized',
  },
];

const CONTACT_TONE = {
  father: 'bg-violet-50 text-violet-600',
  mother: 'bg-rose-50 text-rose-500',
  guardian: 'bg-emerald-50 text-emerald-600',
};

const EditButton = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-600 transition hover:bg-violet-50"
  >
    <Edit size={13} /> Edit
  </button>
);

const SectionHead = ({ Icon, iconTone, title, subtitle, action }) => (
  <div className="flex items-start gap-3">
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconTone}`}><Icon size={20} /></span>
    <div className="min-w-0 flex-1">
      <h2 className="text-sm font-bold text-[#0b1446]">{title}</h2>
      <p className="text-[11px] text-slate-500">{subtitle}</p>
    </div>
    {action}
  </div>
);

const HealthReport = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [school, setSchool] = useState({ coverImage: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit modal: { type: 'section', key } | { type: 'contacts' }
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const editRef = useDialog(Boolean(editing), () => setEditing(null));

  const childOptions = useMemo(
    () => children.map((c) => ({ id: String(c.studentId || ''), name: c.name || 'Student' })),
    [children],
  );
  const [, selectedOption] = useSharedChildSelection(childOptions);
  const selectedId = selectedOption?.id || '';

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await parentApiJson('/api/parent/auth/health', {}, navigate);
      setChildren(Array.isArray(data?.children) ? data.children : []);
      setSchool(data?.school || { coverImage: '' });
    } catch (err) {
      setError(err.message || 'Unable to load the health report.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const child = useMemo(
    () => children.find((c) => String(c.studentId) === String(selectedId)) || children[0] || null,
    [children, selectedId],
  );
  const firstName = String(child?.name || 'your child').split(' ')[0];
  const classLine = child
    ? [child.grade ? `Class ${child.grade}` : '', child.section ? `Section ${child.section}` : ''].filter(Boolean).join(' - ')
    : '';

  /* ── Editing ───────────────────────────────────────────────────────────── */
  const openSectionEdit = (section) => {
    const value = child?.[section.key];
    setDraft({ value: section.list ? (value || []).join(', ') : (value || '') });
    setSaveError('');
    setEditing({ type: 'section', key: section.key });
  };

  const openContactsEdit = () => {
    const byKey = Object.fromEntries((child?.emergencyContacts || []).map((c) => [c.key, c]));
    setDraft({
      father: { name: byKey.father?.name || '', phone: byKey.father?.phone || '' },
      mother: { name: byKey.mother?.name || '', phone: byKey.mother?.phone || '' },
    });
    setSaveError('');
    setEditing({ type: 'contacts' });
  };

  const save = async () => {
    if (!child || !editing) return;
    const body = editing.type === 'contacts'
      ? { emergencyContacts: { father: draft.father, mother: draft.mother } }
      : { [editing.key]: draft.value };
    setSaving(true);
    setSaveError('');
    try {
      await parentApiJson(`/api/parent/auth/health/${child.studentId}`, { method: 'PUT', body: JSON.stringify(body) }, navigate);
      await load();
      setEditing(null);
      toast.success('Health record updated');
    } catch (err) {
      setSaveError(err.message || 'Unable to save changes');
    } finally {
      setSaving(false);
    }
  };

  const editingSection = editing?.type === 'section' ? SECTIONS.find((s) => s.key === editing.key) : null;

  if (loading) {
    return <div className="p-3 sm:p-4 md:p-5"><Loading label="health records" rows={3} /></div>;
  }

  return (
    <motion.div variants={PAGE_MOTION} initial="hidden" animate="show" className="space-y-3 p-3 sm:p-4 md:p-5">
      {/* Header + child selector (top right) */}
      <motion.header variants={RISE} className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500"><HeartPulse size={22} /></span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight text-[#0b1446]">Health Record</h1>
            <p className="text-xs text-slate-500 sm:text-sm">Medical details from enrolment plus counsellor wellbeing notes.</p>
          </div>
        </div>
      </motion.header>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && children.length === 0 && (
        <EmptyState icon={HeartPulse} title="No health records yet" hint="The school office maintains this — contact them to add medical details." />
      )}

      {child && (
        <>
          {/* Child card with the school cover photo in the background */}
          <motion.section variants={RISE} className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-r from-white via-blue-50/40 to-blue-50">
            {school.coverImage ? (
              <>
                <img src={school.coverImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/40" aria-hidden="true" />
              </>
            ) : (
              <ClipboardPlus aria-hidden="true" size={110} className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-blue-200/70 md:block" />
            )}
            <div className="relative flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              {child.profilePic ? (
                <img src={child.profilePic} alt="" className="h-24 w-24 shrink-0 rounded-full object-cover shadow-sm" />
              ) : (
                <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-3xl font-bold text-blue-600">
                  {String(child.name || 'C').charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold text-[#0b1446]">{child.name}</h2>
                <p className="mb-2 flex items-center gap-1.5 text-xs text-slate-600">
                  <Users size={14} className="text-slate-500" /> {classLine || '—'}{child.roll ? ` • Roll ${child.roll}` : ''}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:max-w-xl">
                  {[
                    { label: 'Age', value: child.age != null ? `${child.age} yrs` : '—', hint: 'From date of birth', Icon: ShieldPlus, tone: 'bg-blue-50 text-blue-600' },
                    { label: 'Blood Group', value: child.bloodGroup || '—', hint: 'On file', Icon: Droplet, tone: 'bg-rose-50 text-rose-500' },
                    {
                      label: 'Wellbeing',
                      value: child.wellbeing?.mood ? (MOOD_LABELS[child.wellbeing.mood] || child.wellbeing.mood) : '—',
                      hint: child.wellbeing?.lastAssessment ? `Reviewed ${new Date(child.wellbeing.lastAssessment).toLocaleDateString('en-GB')}` : 'Not assessed',
                      Icon: HeartPulse,
                      tone: 'bg-amber-50 text-amber-500',
                    },
                  ].map(({ label, value, hint, Icon, tone }) => (
                    <div key={label} className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-white/90 px-2.5 py-2 backdrop-blur-sm">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon size={18} /></span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500">{label}</p>
                        <p className="truncate text-sm font-bold text-[#0b1446]">{value}</p>
                        <p className="truncate text-[10px] text-slate-500">{hint}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>

          <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            {/* Medical sections */}
            <div className="space-y-3">
              {SECTIONS.map((section) => {
                const value = child[section.key];
                const items = section.list ? (value || []) : (value ? [value] : []);
                return (
                  <motion.section key={section.key} variants={RISE} className={`${CARD} space-y-2.5 p-3`}>
                    <SectionHead
                      Icon={section.Icon}
                      iconTone={section.iconTone}
                      title={section.title}
                      subtitle={section.subtitle}
                      action={<EditButton onClick={() => openSectionEdit(section)} label={`Edit ${section.title}`} />}
                    />
                    {items.length === 0 ? (
                      <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">
                        <CheckCircle2 size={22} className="shrink-0 fill-emerald-500 text-white" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-700">{section.emptyTitle}</p>
                          <p className="text-[11px] text-slate-600">{section.emptyText(firstName)}</p>
                        </div>
                      </div>
                    ) : section.list ? (
                      <ul className="flex flex-wrap gap-1.5 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2.5">
                        {items.map((item, i) => (
                          <li key={`${item}-${i}`} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-amber-800 shadow-sm">{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">
                        <CheckCircle2 size={22} className="shrink-0 fill-emerald-500 text-white" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-700">{value}</p>
                          <p className="text-[11px] text-slate-600">As per school records.</p>
                        </div>
                      </div>
                    )}
                  </motion.section>
                );
              })}
            </div>

            {/* Right column */}
            <div className="space-y-3">
              <motion.section variants={RISE} className={`${CARD} space-y-2 p-3`}>
                <SectionHead
                  Icon={Phone}
                  iconTone="bg-blue-50 text-blue-600"
                  title="Emergency contacts"
                  subtitle="People to contact in case of emergency."
                  action={<EditButton onClick={openContactsEdit} label="Edit emergency contacts" />}
                />
                {child.emergencyContacts.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-[11px] text-slate-500">No emergency contacts on file.</p>
                ) : child.emergencyContacts.map((c, i) => (
                  <div key={`${c.name}-${i}`} className="flex items-center gap-3 rounded-lg border border-slate-100 px-2.5 py-2">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${CONTACT_TONE[c.key] || 'bg-slate-100 text-slate-600'}`}><UserRound size={18} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#0b1446]">{c.name}</p>
                      <p className="truncate text-[11px] text-slate-500">{c.relation}</p>
                    </div>
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 px-2.5 py-1 text-xs font-semibold text-violet-600 transition hover:bg-violet-50">
                        <Phone size={13} /> {c.phone}
                      </a>
                    ) : (
                      <span className="shrink-0 text-[11px] text-slate-400">No number</span>
                    )}
                  </div>
                ))}
              </motion.section>

              <motion.section variants={RISE} className={`${CARD} space-y-2 p-3`}>
                <SectionHead
                  Icon={ClipboardPlus}
                  iconTone="bg-blue-50 text-blue-600"
                  title="Counsellor wellbeing notes"
                  subtitle="Notes from the school counsellor about your child's wellbeing."
                />
                {child.wellbeing ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      {[
                        ['Academic stress', child.wellbeing.academicStress != null ? `${child.wellbeing.academicStress}/10` : '—'],
                        ['Social engagement', child.wellbeing.socialEngagement != null ? `${child.wellbeing.socialEngagement}/10` : '—'],
                        ['Counselling sessions', child.wellbeing.counselingSessions ?? 0],
                        ['Overall mood', MOOD_LABELS[child.wellbeing.mood] || '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg bg-slate-50 px-2 py-1.5">
                          <p className="text-sm font-bold text-[#0b1446]">{value}</p>
                          <p className="text-[10px] text-slate-500">{label}</p>
                        </div>
                      ))}
                    </div>
                    {child.wellbeing.notes ? <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">{child.wellbeing.notes}</p> : null}
                  </>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2.5">
                    <Info size={20} className="shrink-0 fill-amber-400 text-white" />
                    <div>
                      <p className="text-sm font-semibold text-amber-700">Not assessed</p>
                      <p className="text-[11px] text-slate-600">No wellbeing notes available yet.</p>
                    </div>
                  </div>
                )}
              </motion.section>

              <motion.section variants={RISE} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                <p className="mb-1.5 flex items-center gap-2 text-sm font-bold text-emerald-700">
                  <Info size={18} className="fill-emerald-500 text-white" /> Important information
                </p>
                <ul className="list-disc space-y-1 pl-8 text-[11px] text-slate-700">
                  <li>The information shown here is based on school records.</li>
                  <li>Changes you save here update your child&apos;s record for the school.</li>
                  <li>Keep emergency contact numbers updated at all times.</li>
                  <li>To change the guardian contact, please contact the school office.</li>
                </ul>
              </motion.section>
            </div>
          </div>
        </>
      )}

      {/* Edit modal (portal → full-screen backdrop) */}
      {createPortal(
        <AnimatePresence>
          {editing && (
            <motion.div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} aria-hidden="true" />
              <motion.div
                ref={editRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="health-edit-title"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-md rounded-xl border bg-white shadow-xl"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div>
                    <h2 id="health-edit-title" className="text-base font-bold text-[#0b1446]">
                      Edit {editingSection ? editingSection.title.toLowerCase() : 'emergency contacts'}
                    </h2>
                    <p className="text-[11px] text-slate-500">{child?.name}</p>
                  </div>
                  <button type="button" onClick={() => setEditing(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
                </div>

                <div className="space-y-3 p-4">
                  {editingSection ? (
                    <div>
                      <label htmlFor="health-edit-value" className="mb-1 block text-xs font-medium text-[#0b1446]">{editingSection.title}</label>
                      {editingSection.list ? (
                        <>
                          <textarea
                            id="health-edit-value"
                            rows={3}
                            maxLength={1000}
                            value={draft.value}
                            onChange={(e) => setDraft({ value: e.target.value })}
                            placeholder={editingSection.placeholder}
                            className={`${INPUT} resize-none`}
                          />
                          <p className="mt-1 text-[11px] text-slate-500">Separate items with commas. Leave empty if there are none.</p>
                        </>
                      ) : (
                        <input
                          id="health-edit-value"
                          maxLength={200}
                          value={draft.value}
                          onChange={(e) => setDraft({ value: e.target.value })}
                          placeholder={editingSection.placeholder}
                          className={INPUT}
                        />
                      )}
                    </div>
                  ) : (
                    <>
                      {['father', 'mother'].map((key) => (
                        <fieldset key={key} className="m-0 grid grid-cols-2 gap-2 border-0 p-0">
                          <legend className="mb-1 flex items-center gap-1.5 text-xs font-semibold capitalize text-[#0b1446]"><User size={13} /> {key}</legend>
                          <input
                            aria-label={`${key} name`}
                            maxLength={100}
                            value={draft[key]?.name || ''}
                            onChange={(e) => setDraft((d) => ({ ...d, [key]: { ...d[key], name: e.target.value } }))}
                            placeholder="Name"
                            className={INPUT}
                          />
                          <input
                            aria-label={`${key} phone`}
                            type="tel"
                            inputMode="tel"
                            maxLength={15}
                            value={draft[key]?.phone || ''}
                            onChange={(e) => setDraft((d) => ({ ...d, [key]: { ...d[key], phone: e.target.value.replace(/[^\d+\s-]/g, '') } }))}
                            placeholder="Phone"
                            className={INPUT}
                          />
                        </fieldset>
                      ))}
                      <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500">
                        <Lock size={13} className="mt-0.5 shrink-0" /> The guardian contact is linked to your login, so it can only be changed by the school office.
                      </p>
                    </>
                  )}
                  {saveError ? <p role="alert" className="text-xs text-rose-600">{saveError}</p> : null}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
                  <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </motion.div>
  );
};

export default HealthReport;
