import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Camera, Check, CheckCircle2, Clock, FileText, GraduationCap,
  Eye, HeartPulse, Home, Loader2, X, Mail, MapPin, Paperclip, Phone, Printer, School, Trash2, Upload, User, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ApplicationSheet, STATE_TAG, fmtDate } from './AdmissionPortal';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '').replace(/\/api$/, '');
const INPUT = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

const EMPTY_FORM = {
  studentName: '', dateOfBirth: '', gender: '', applyingForClass: '', profilePic: '',
  birthPlace: '', bloodGroup: '', nationality: 'Indian', religion: '', category: '',
  aadharNumber: '', birthCertificateNo: '',
  guardianPhone: '', email: '', address: '', permanentAddress: '', pinCode: '',
  fatherName: '', fatherPhone: '', fatherOccupation: '',
  motherName: '', motherPhone: '', motherOccupation: '',
  guardianName: '', guardianRelation: '', guardianEmail: '',
  knownHealthIssues: '', allergies: '', immunizationStatus: '', learningDisabilities: '',
  hasPreviousSchool: '', previousSchool: '', previousClass: '', previousPercentage: '',
  transferCertificateNo: '', transferCertificateDate: '',
  documents: [],
};

const DOCUMENT_TYPES = [
  { type: 'birth_certificate', label: 'Birth Certificate', required: true },
  { type: 'transfer_certificate', label: 'Transfer Certificate (TC)', previousOnly: true, hint: 'Upload the TC from the previous school' },
  { type: 'report_card', label: 'Previous Report Card', previousOnly: true },
  { type: 'aadhar_card', label: 'Aadhaar Card' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not known'];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS', 'NA'];
const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other', 'NA'];
const NATIONALITIES = ['Indian', 'Nepalese', 'Bhutanese', 'Bangladeshi', 'Sri Lankan', 'NRI / OCI'];
const PREVIOUS_CLASSES = ['Nursery', 'LKG', 'UKG', ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`)];
const OCCUPATIONS = [
  'Service (Government)', 'Service (Private)', 'Business', 'Self-employed', 'Teacher', 'Doctor',
  'Engineer', 'Lawyer', 'Farmer', 'Defence / Police', 'Daily wage worker', 'Homemaker', 'Retired', 'Unemployed',
];

// Preset occupations, with "Other" opening a free-text box.
const OccupationSelect = ({ value, onChange }) => {
  const [custom, setCustom] = React.useState(() => Boolean(value) && !OCCUPATIONS.includes(value));
  return (
    <div className="space-y-1.5">
      <select value={custom ? '__other' : value}
        onChange={(e) => {
          const v = e.target.value;
          setCustom(v === '__other');
          onChange(v === '__other' ? '' : v);
        }}
        className={INPUT}>
        <option value="">Select occupation</option>
        {OCCUPATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value="__other">Other</option>
      </select>
      {custom && (
        <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={120} autoFocus placeholder="Enter occupation" className={INPUT} />
      )}
    </div>
  );
};

const Field = ({ label, required, children, span = '' }) => (
  <label className={`block ${span}`}>
    <span className="mb-1 block text-[11px] font-semibold text-slate-600">
      {label}{required && <span className="text-rose-500"> *</span>}
    </span>
    {children}
  </label>
);

const STEPS = [
  { key: 'student', label: 'Student', icon: User },
  { key: 'contact', label: 'Contact', icon: Home },
  { key: 'parents', label: 'Parents', icon: Users },
  { key: 'history', label: 'Health & School', icon: HeartPulse },
  { key: 'documents', label: 'Documents', icon: Paperclip },
];

const Section = ({ icon: Icon, title, hint, children }) => (
  <section className="mb-4 last:mb-0">
    <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Icon className="h-4 w-4" /></span>
      <div>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  </section>
);

const AdmissionApply = () => {
  const { schoolId, sessionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(''); // field being uploaded
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const photoInput = useRef(null);
  const bodyRef = useRef(null);
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(null); // document being viewed
  const [sameAddress, setSameAddress] = useState(false);
  // Keep the permanent address in step with the current one while the box is ticked.
  useEffect(() => {
    if (sameAddress) setForm((f) => (f.permanentAddress === f.address ? f : { ...f, permanentAddress: f.address }));
  }, [sameAddress, form.address]);
  const lastStep = STEPS.length - 1;
  const goStep = (n) => { setStep(n); bodyRef.current?.scrollTo({ top: 0 }); };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admissions/public/${schoolId}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Unable to load the admission');
        if (alive) setData(json);
      } catch (err) {
        if (alive) setLoadError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [schoolId]);

  const school = data?.school;
  const session = useMemo(() => (data?.sessions || []).find((sn) => String(sn._id) === String(sessionId)) || null, [data, sessionId]);
  const seatByClass = useMemo(() => new Map((session?.classSeats || []).map((c) => [c.className, c])), [session]);
  const schoolPath = `/admission/${school?.slug || schoolId}`;

  useEffect(() => {
    if (school?.name) document.title = `Apply · ${school.name}`;
    if (school?.slug && school.slug !== schoolId) {
      window.history.replaceState(window.history.state, '', `/admission/${school.slug}/apply/${sessionId}`);
    }
  }, [school, schoolId, sessionId]);

  useEffect(() => {
    // Pre-select the only open class.
    const open = (session?.classes || []).filter((c) => !seatByClass.get(c)?.full);
    if (open.length === 1) setForm((f) => (f.applyingForClass ? f : { ...f, applyingForClass: open[0] }));
  }, [session, seatByClass]);

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const setDigits = (name, max) => (e) => setForm((f) => ({ ...f, [name]: e.target.value.replace(/\D/g, '').slice(0, max) }));

  const uploadFile = async (file, key) => {
    if (!file) return null;
    if (file.size > 100 * 1024) { toast.error(`"${file.name}" is ${Math.ceil(file.size / 1024)}KB. Each file must be 100KB or smaller.`); return null; }
    try {
      setUploading(key);
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${API_BASE}/api/admissions/public/${school?._id || schoolId}/upload`, { method: 'POST', body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Upload failed');
      return json;
    } catch (err) {
      toast.error(err.message);
      return null;
    } finally {
      setUploading('');
    }
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file && !file.type.startsWith('image/')) { toast.error('The photo must be an image.'); return; }
    const up = await uploadFile(file, 'photo');
    if (up) setForm((f) => ({ ...f, profilePic: up.url }));
  };

  const onDocument = async (type, label, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const up = await uploadFile(file, type);
    if (up) {
      setForm((f) => ({
        ...f,
        documents: [...f.documents.filter((d) => d.type !== type), { type, label, url: up.url, fileName: up.fileName }],
      }));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (step === 0 && !form.profilePic) { toast.error("Please upload the student's photo."); return; }
    if (step === 1 && form.guardianPhone.length !== 10) { toast.error('Phone number must be 10 digits.'); return; }
    if (step < lastStep) { goStep(step + 1); return; }
    if (!form.documents.some((d) => d.type === 'birth_certificate')) { toast.error('Please upload the birth certificate.'); return; }
    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/api/admissions/public/${school._id}/sessions/${session._id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Unable to submit the application');
      setSubmitted(json);
      bodyRef.current?.scrollTo({ top: 0 });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>;
  }

  const blocked = loadError || !session || session.state !== 'open';
  const blockedMsg = loadError || (!session ? 'This admission is not available.'
    : session.state === 'full' ? 'All seats for this admission are filled.'
      : session.state === 'upcoming' ? `Admissions open on ${fmtDate(session.startDate)}.` : 'Admissions are closed.');

  const seats = (session?.classSeats || []).filter((c) => c.capacity);
  const InfoRow = ({ icon: Icon, children }) => (
    <p className="flex items-start gap-2 text-xs text-slate-600"><Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" /><span className="min-w-0 break-words">{children}</span></p>
  );

  return (
    <div className="flex h-[100dvh] flex-col gap-3 overflow-hidden bg-slate-100 p-3 sm:p-4 lg:flex-row print:block print:h-auto print:overflow-visible print:bg-white">
      {/* ── School card (left) ── */}
      <aside className="no-print flex shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm lg:w-80">
        <div className="relative hidden h-32 shrink-0 bg-gradient-to-r from-indigo-600 to-violet-600 lg:block">
          {school?.cover && <img src={school.cover} alt="" className="h-full w-full object-cover" />}
          <a href={schoolPath} aria-label="Back to school page"
            className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm hover:bg-white"><ArrowLeft className="h-4 w-4" /></a>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-3 lg:p-4">
          <div className="relative z-10 flex items-center gap-3 lg:-mt-12 lg:flex-col lg:items-start">
            <a href={schoolPath} aria-label="Back" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 lg:hidden"><ArrowLeft className="h-4 w-4" /></a>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-white shadow-md lg:h-16 lg:w-16">
              {school?.logo ? <img src={school.logo} alt="" className="h-full w-full object-contain" /> : <School className="h-6 w-6 text-indigo-600" />}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold text-slate-900 lg:whitespace-normal lg:text-base">{school?.name || 'Admission'}</h1>
              <p className="truncate text-[11px] text-slate-500 lg:hidden">{session?.title}</p>
            </div>
          </div>
          <div className="mt-3 hidden min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:flex">
            {session && (
              <div className="rounded-xl bg-indigo-50/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">{session.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${(STATE_TAG[session?.state] || STATE_TAG.closed).cls}`}>{(STATE_TAG[session?.state] || STATE_TAG.closed).label}</span>
                </div>
                {session.academicYear && <p className="text-[11px] text-slate-600">Session {session.academicYear}</p>}
                <div className="mt-2 space-y-1">
                  <InfoRow icon={CalendarDays}>Starts {fmtDate(session.startDate)}</InfoRow>
                  <InfoRow icon={Clock}>Last date {fmtDate(session.endDate)}</InfoRow>
                </div>
                {seats.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {seats.map((c) => (
                      <span key={c.className} className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${c.full ? 'bg-rose-100 text-rose-700' : 'bg-white text-slate-700'}`}>
                        {c.className}: {c.full ? 'Full' : `${c.available} left`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              {school?.address && <InfoRow icon={MapPin}>{school.address}</InfoRow>}
              {school?.phone && <InfoRow icon={Phone}>{school.phone}</InfoRow>}
              {school?.email && <InfoRow icon={Mail}>{school.email}</InfoRow>}
            </div>
            <p className="mt-auto rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">
              Fields marked <span className="text-rose-500">*</span> are required. Keep your admission number after submitting to track the application.
            </p>
          </div>
        </div>
      </aside>

      {/* ── Form (right) ── */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm print:overflow-visible print:shadow-none">
        {submitted ? (
          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto p-4 print:overflow-visible print:p-0">
              <div className="space-y-3">
                <div className="no-print p-2 text-center">
                  <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-emerald-500" />
                  <p className="text-base font-bold text-slate-900">Application submitted successfully</p>
                  <p className="mt-1 text-sm text-slate-500">Your admission number is</p>
                  <p className="mt-1 text-3xl font-extrabold tracking-wider text-indigo-700">{submitted.admissionNumber}</p>
                  <p className="mt-1 text-xs text-slate-400">The school will review your application. Once admitted, login details are shared with you.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                      <Printer className="h-4 w-4" /> Print / Save as PDF
                    </button>
                    <a href={schoolPath} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                      <ArrowLeft className="h-4 w-4" /> Back to school
                    </a>
                    <a href="/admissions" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                      Apply to more schools
                    </a>
                  </div>
                </div>
                <ApplicationSheet school={school} application={submitted} />
              </div>
          </div>
        ) : blocked ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <AlertTriangle className="mb-2 h-8 w-8 text-amber-500" />
            <p className="font-semibold text-slate-800">{blockedMsg}</p>
            <a href={schoolPath} className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:underline">Back to school page</a>
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            {/* Step indicator */}
            <div className="shrink-0 border-b border-slate-100 px-4 py-3">
              <ol className="flex items-center">
                {STEPS.map((st, i) => {
                  const done = i < step;
                  const active = i === step;
                  return (
                    <li key={st.key} className={`flex items-center ${i < lastStep ? 'flex-1' : ''}`}>
                      <button type="button" disabled={i > step} onClick={() => goStep(i)} className="flex items-center gap-2 disabled:cursor-default">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
                          {done ? <Check className="h-4 w-4" /> : <st.icon className="h-4 w-4" />}
                        </span>
                        <span className={`hidden text-xs font-semibold xl:block ${active ? 'text-indigo-700' : done ? 'text-slate-700' : 'text-slate-400'}`}>{st.label}</span>
                      </button>
                      {i < lastStep && <span className={`mx-2 h-0.5 flex-1 rounded ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-[11px] font-semibold text-slate-500 xl:hidden">Step {step + 1} of {STEPS.length} · <span className="text-indigo-700">{STEPS[step].label}</span></p>
            </div>

            <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {step === 0 && (
                <>
              {/* Student */}
              <Section icon={User} title="Student Details">
                <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
                  <button type="button" onClick={() => photoInput.current?.click()}
                    className="relative flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-indigo-400">
                    {uploading === 'photo' ? <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                      : form.profilePic ? <img src={form.profilePic} alt="Student" className="h-full w-full object-cover" />
                        : <Camera className="h-6 w-6 text-slate-400" />}
                  </button>
                  <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPhoto} />
                  <div className="text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">Student photo <span className="text-rose-500">*</span></p>
                    <p>Recent passport-size photo, JPG / PNG, max 100KB.</p>
                    <button type="button" onClick={() => photoInput.current?.click()} className="mt-1 font-semibold text-indigo-600 hover:underline">
                      {form.profilePic ? 'Change photo' : 'Upload photo'}
                    </button>
                  </div>
                </div>
                <Field label="Student full name" required><input value={form.studentName} onChange={set('studentName')} required maxLength={120} className={INPUT} /></Field>
                <Field label="Date of birth" required><input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} required max={new Date().toISOString().slice(0, 10)} className={INPUT} /></Field>
                <Field label="Gender" required>
                  <select value={form.gender} onChange={set('gender')} required className={INPUT}>
                    <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Applying for class" required>
                  {session.classes?.length ? (
                    <select value={form.applyingForClass} onChange={set('applyingForClass')} required className={INPUT}>
                      <option value="">Select class</option>
                      {session.classes.map((c) => {
                        const seat = seatByClass.get(c);
                        return (
                          <option key={c} value={c} disabled={seat?.full}>
                            {c}{seat?.full ? ' — Seats Full' : seat?.capacity ? ` (${seat.available} seats left)` : ''}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input value={form.applyingForClass} onChange={set('applyingForClass')} required maxLength={40} className={INPUT} />
                  )}
                </Field>
                <Field label="Place of birth"><input value={form.birthPlace} onChange={set('birthPlace')} maxLength={120} className={INPUT} /></Field>
                <Field label="Blood group">
                  <select value={form.bloodGroup} onChange={set('bloodGroup')} className={INPUT}>
                    <option value="">Select</option>{BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Nationality" required>
                  <div className="space-y-1.5">
                    <select value={NATIONALITIES.includes(form.nationality) ? form.nationality : '__other'}
                      onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value === '__other' ? ' ' : e.target.value }))}
                      required className={INPUT}>
                      {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
                      <option value="__other">Other</option>
                    </select>
                    {!NATIONALITIES.includes(form.nationality) && (
                      <input value={form.nationality.trimStart()} onChange={set('nationality')} required maxLength={60} autoFocus placeholder="Enter nationality" className={INPUT} />
                    )}
                  </div>
                </Field>
                <Field label="Religion">
                  <select value={form.religion} onChange={set('religion')} className={INPUT}>
                    <option value="">Select</option>{RELIGIONS.map((r) => <option key={r}>{r}</option>)}
                    {form.religion && !RELIGIONS.includes(form.religion) && <option>{form.religion}</option>}
                  </select>
                </Field>
                <Field label="Category">
                  <select value={form.category} onChange={set('category')} className={INPUT}>
                    <option value="">Select</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Aadhaar number"><input value={form.aadharNumber} onChange={setDigits('aadharNumber', 12)} inputMode="numeric" placeholder="12 digits" className={INPUT} /></Field>
                <Field label="Birth certificate number"><input value={form.birthCertificateNo} onChange={set('birthCertificateNo')} maxLength={60} className={INPUT} /></Field>
              </Section>
                </>
              )}
              {step === 1 && (
                <>
              {/* Contact */}
              <Section icon={Home} title="Contact & Address">
                <Field label="Phone number" required><input value={form.guardianPhone} onChange={setDigits('guardianPhone', 10)} inputMode="numeric" required placeholder="10 digits" className={INPUT} /></Field>
                <Field label="Email" required><input type="email" value={form.email} onChange={set('email')} required maxLength={160} className={INPUT} /></Field>
                <Field label="Pin code" required><input value={form.pinCode} onChange={setDigits('pinCode', 6)} inputMode="numeric" required className={INPUT} /></Field>
                <Field label="Current address" required span="sm:col-span-2 lg:col-span-3">
                  <textarea value={form.address} onChange={set('address')} required rows={2} maxLength={500} className={`${INPUT} resize-none`} />
                </Field>
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-600">Permanent address <span className="text-rose-500">*</span></span>
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-indigo-700">
                      <input type="checkbox" checked={sameAddress}
                        onChange={(e) => {
                          setSameAddress(e.target.checked);
                          if (!e.target.checked) setForm((f) => ({ ...f, permanentAddress: '' }));
                        }}
                        className="h-3.5 w-3.5 accent-indigo-600" />
                      Same as current address
                    </label>
                  </div>
                  <textarea value={form.permanentAddress} onChange={set('permanentAddress')} readOnly={sameAddress} required rows={2} maxLength={500}
                    className={`${INPUT} resize-none ${sameAddress ? 'bg-slate-50 text-slate-500' : ''}`} />
                </div>
              </Section>
                </>
              )}
              {step === 2 && (
                <>
              {/* Parents */}
              <Section icon={Users} title="Parents / Guardian" hint="A parent login is created with the phone number above once the student is admitted.">
                <Field label="Father's name" required><input value={form.fatherName} onChange={set('fatherName')} required maxLength={120} className={INPUT} /></Field>
                <Field label="Father's phone"><input value={form.fatherPhone} onChange={setDigits('fatherPhone', 10)} inputMode="numeric" className={INPUT} /></Field>
                <Field label="Father's occupation"><OccupationSelect value={form.fatherOccupation} onChange={(v) => setForm((f) => ({ ...f, fatherOccupation: v }))} /></Field>
                <Field label="Mother's name" required><input value={form.motherName} onChange={set('motherName')} required maxLength={120} className={INPUT} /></Field>
                <Field label="Mother's phone"><input value={form.motherPhone} onChange={setDigits('motherPhone', 10)} inputMode="numeric" className={INPUT} /></Field>
                <Field label="Mother's occupation"><OccupationSelect value={form.motherOccupation} onChange={(v) => setForm((f) => ({ ...f, motherOccupation: v }))} /></Field>
                <Field label="Guardian name (if not a parent)"><input value={form.guardianName} onChange={set('guardianName')} maxLength={120} className={INPUT} /></Field>
                <Field label="Relation to student"><input value={form.guardianRelation} onChange={set('guardianRelation')} maxLength={40} placeholder="e.g. Uncle" className={INPUT} /></Field>
                <Field label="Guardian email"><input type="email" value={form.guardianEmail} onChange={set('guardianEmail')} maxLength={160} className={INPUT} /></Field>
              </Section>
                </>
              )}
              {step === 3 && (
                <>
              {/* Health */}
              <Section icon={HeartPulse} title="Health Information">
                <Field label="Known health issues"><input value={form.knownHealthIssues} onChange={set('knownHealthIssues')} maxLength={500} placeholder="None" className={INPUT} /></Field>
                <Field label="Allergies"><input value={form.allergies} onChange={set('allergies')} maxLength={300} placeholder="None" className={INPUT} /></Field>
                <Field label="Immunization">
                  <select value={form.immunizationStatus} onChange={set('immunizationStatus')} className={INPUT}>
                    <option value="">Select</option><option>Complete</option><option>Partial</option><option>Not done</option>
                  </select>
                </Field>
                <Field label="Learning needs / disabilities" span="sm:col-span-2 lg:col-span-3"><input value={form.learningDisabilities} onChange={set('learningDisabilities')} maxLength={300} placeholder="None" className={INPUT} /></Field>
              </Section>

              {/* Previous school */}
              <Section icon={GraduationCap} title="Previous Schooling">
                <div className="sm:col-span-2 lg:col-span-3">
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Has the student attended a school before? <span className="text-rose-500">*</span></span>
                  <div className="flex gap-2">
                    {[['yes', 'Yes'], ['no', 'No, first school']].map(([v, l]) => (
                      <label key={v} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${form.hasPreviousSchool === v ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>
                        <input type="radio" name="hasPreviousSchool" value={v} checked={form.hasPreviousSchool === v} onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => ({
                            ...f,
                            hasPreviousSchool: v,
                            documents: v === 'yes' ? f.documents : f.documents.filter((d) => !['transfer_certificate', 'report_card'].includes(d.type)),
                          }));
                        }} required className="accent-indigo-600" />{l}
                      </label>
                    ))}
                  </div>
                </div>
                {form.hasPreviousSchool === 'yes' && (
                  <>
                    <Field label="Previous school name" required><input value={form.previousSchool} onChange={set('previousSchool')} required maxLength={160} className={INPUT} /></Field>
                    <Field label="Last class attended" required>
                      <select value={form.previousClass} onChange={set('previousClass')} required className={INPUT}>
                        <option value="">Select class</option>
                        {PREVIOUS_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                        {form.previousClass && !PREVIOUS_CLASSES.includes(form.previousClass) && <option value={form.previousClass}>{form.previousClass}</option>}
                      </select>
                    </Field>
                    <Field label="Percentage / grade"><input value={form.previousPercentage} onChange={set('previousPercentage')} maxLength={20} className={INPUT} /></Field>
                    <Field label="TC number (if available)"><input value={form.transferCertificateNo} onChange={set('transferCertificateNo')} maxLength={60} className={INPUT} /></Field>
                    <Field label="TC date (if available)"><input type="date" value={form.transferCertificateDate} onChange={set('transferCertificateDate')} className={INPUT} /></Field>
                  </>
                )}
              </Section>
                </>
              )}
              {step === 4 && (
                <>
              {/* Documents */}
              <Section icon={Paperclip} title="Documents" hint="JPG, PNG or PDF, max 100KB each.">
                {DOCUMENT_TYPES.filter((d) => !d.previousOnly || form.hasPreviousSchool === 'yes').map((d) => {
                  const doc = form.documents.find((x) => x.type === d.type);
                  return (
                    <div key={d.type} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${doc ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200'}`}>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${doc ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {doc ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">{d.label}{d.required && <span className="text-rose-500"> *</span>}</p>
                        {doc
                          ? <button type="button" onClick={() => setPreview(doc)} className="block max-w-full truncate text-left text-[11px] text-indigo-600 hover:underline">{doc.fileName || 'View file'}</button>
                          : <p className="text-[11px] text-slate-400">{d.hint || (d.required ? 'Required' : 'Optional')}</p>}
                      </div>
                      {uploading === d.type ? <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> : (
                        <>
                          {doc && (
                            <button type="button" title="View document" aria-label={`View ${d.label}`} onClick={() => setPreview(doc)}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700"><Eye className="h-3.5 w-3.5" /></button>
                          )}
                          {doc && (
                            <button type="button" aria-label={`Remove ${d.label}`} onClick={() => setForm((f) => ({ ...f, documents: f.documents.filter((x) => x.type !== d.type) }))}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-700"><Trash2 className="h-3.5 w-3.5" /></button>
                          )}
                          <label className="flex h-7 cursor-pointer items-center gap-1 rounded-full bg-indigo-600 px-2.5 text-[11px] font-semibold text-white hover:bg-indigo-700">
                            <Upload className="h-3.5 w-3.5" /> {doc ? 'Replace' : 'Upload'}
                            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(e) => onDocument(d.type, d.label, e)} />
                          </label>
                        </>
                      )}
                    </div>
                  );
                })}
              </Section>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
              {step === 0 ? (
                <a href={schoolPath} className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</a>
              ) : (
                <button type="button" onClick={() => goStep(step - 1)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              )}
              <button type="submit" disabled={submitting || Boolean(uploading)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {step < lastStep ? <>Next <ArrowRight className="h-4 w-4" /></> : submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        )}
      </main>

      {preview && (
        <div className="excuse-fade-in no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={() => setPreview(null)}>
          <div className="excuse-pop-in flex h-[85dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{preview.label}</p>
                {preview.fileName && <p className="truncate text-[11px] text-slate-500">{preview.fileName}</p>}
              </div>
              <button type="button" onClick={() => setPreview(null)} aria-label="Close preview"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100">
              {/\.pdf($|\?)/i.test(preview.url) || /\.pdf$/i.test(preview.fileName || '')
                ? <iframe src={preview.url} title={preview.label} className="h-full w-full border-0 bg-white" />
                : <img src={preview.url} alt={preview.label} className="max-h-full max-w-full object-contain" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdmissionApply;
