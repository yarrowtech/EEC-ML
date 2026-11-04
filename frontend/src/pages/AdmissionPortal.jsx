import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays, Loader2, School, AlertTriangle, ArrowLeft, ArrowRight, MapPin, Mail, Phone,
  Heart, Share2, Home, FileText, Megaphone, Clock, ChevronRight, PenLine,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '').replace(/\/api$/, '');

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const STATE_TAG = {
  open: { label: 'Open', cls: 'bg-emerald-600 text-white' },
  upcoming: { label: 'Upcoming', cls: 'bg-amber-500 text-white' },
  closed: { label: 'Closed', cls: 'bg-slate-400 text-white' },
  full: { label: 'Seats Full', cls: 'bg-rose-600 text-white' },
};

const cap = (v) => (v ? String(v)[0].toUpperCase() + String(v).slice(1) : '');

// Printable copy of a submitted application (also "Save as PDF" via the browser's print dialog).
// The on-screen sheet lives inside fixed-height, scrolling panels, which clip it when
// printed. A copy is portalled straight into <body> and only that copy is printed.
const ApplicationSheet = (props) => (
  <>
    <ApplicationSheetBody {...props} className="print:hidden" />
    {typeof document !== 'undefined' && createPortal(
      <div className="admission-print-root"><ApplicationSheetBody {...props} /></div>,
      document.body,
    )}
  </>
);

const ApplicationSheetBody = ({ school, application: a, className = '' }) => {
  const studentRows = [
    ['Name of Student', a.studentName], ['Date of Birth', fmtDate(a.dateOfBirth)], ['Gender', cap(a.gender)],
    ['Class Applied For', a.applyingForClass], ['Place of Birth', a.birthPlace], ['Blood Group', a.bloodGroup],
    ['Nationality', a.nationality], ['Religion', a.religion], ['Category', a.category],
    ['Aadhaar No.', a.aadharNumber], ['Birth Certificate No.', a.birthCertificateNo],
  ];
  const sections = [
    ['Contact & Address', [
      ['Phone', a.guardianPhone], ['Email', a.email], ['Pin Code', a.pinCode],
      ['Current Address', a.address, true], ['Permanent Address', a.permanentAddress, true],
    ]],
    ['Parents / Guardian', [
      ["Father's Name", a.fatherName], ["Father's Phone", a.fatherPhone], ["Father's Occupation", a.fatherOccupation],
      ["Mother's Name", a.motherName], ["Mother's Phone", a.motherPhone], ["Mother's Occupation", a.motherOccupation],
      ['Guardian', a.guardianName ? `${a.guardianName}${a.guardianRelation ? ` (${a.guardianRelation})` : ''}` : ''], ['Guardian Email', a.guardianEmail],
    ]],
    ['Health Information', [
      ['Known Health Issues', a.knownHealthIssues], ['Allergies', a.allergies],
      ['Immunization', a.immunizationStatus], ['Learning Needs', a.learningDisabilities],
    ]],
    ['Previous Schooling', a.hasPreviousSchool === 'yes' ? [
      ['Previous School', a.previousSchool, true], ['Last Class Attended', a.previousClass], ['Percentage / Grade', a.previousPercentage],
      ['TC Number', a.transferCertificateNo], ['TC Date', a.transferCertificateDate ? fmtDate(a.transferCertificateDate) : ''],
    ] : [['Previous School', a.hasPreviousSchool === 'no' ? 'None (first school)' : a.previousSchool, true]]],
  ].map(([title, rows]) => [title, rows.filter(([, v]) => v)]).filter(([, rows]) => rows.length);

  const Heading = ({ children }) => (
    <p className="mb-2 mt-4 border-b-2 border-slate-800 pb-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-800">{children}</p>
  );
  const Row = ({ label, value, wide }) => (
    <div className={`flex items-baseline gap-2 py-1 text-[12px] ${wide ? 'col-span-2' : ''}`}>
      <span className="shrink-0 font-semibold text-slate-600">{label}:</span>
      <span className="min-w-0 flex-1 border-b border-dotted border-slate-400 pb-0.5 font-medium text-slate-900">{value}</span>
    </div>
  );

  return (
    <div className={`application-sheet mx-auto max-w-[210mm] rounded-xl border border-slate-200 bg-white p-6 text-slate-900 sm:p-8 ${className}`}>
      {/* Letterhead */}
      <div className="flex flex-col items-center border-b-4 border-double border-slate-800 pb-3 text-center">
        {school?.logo && <img src={school.logo} alt="" className="mb-1.5 h-16 w-16 object-contain" />}
        <p className="text-xl font-extrabold uppercase tracking-wide text-slate-900">{school?.name}</p>
        {school?.address && <p className="mt-0.5 text-xs text-slate-600">{school.address}</p>}
        {(school?.phone || school?.email) && (
          <p className="text-[11px] text-slate-500">{[school.phone && `Phone: ${school.phone}`, school.email && `Email: ${school.email}`].filter(Boolean).join('  |  ')}</p>
        )}
      </div>

      <div className="mt-3 text-center">
        <p className="inline-block rounded border-2 border-slate-800 px-4 py-1 text-sm font-bold uppercase tracking-[0.15em]">Application Form for Admission</p>
        {(a.sessionTitle || a.academicYear) && (
          <p className="mt-1 text-xs text-slate-600">{a.sessionTitle}{a.academicYear ? ` · Academic Session ${a.academicYear}` : ''}</p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-[11px]">
        <div><p className="text-slate-500">Admission No.</p><p className="text-sm font-bold text-slate-900">{a.admissionNumber}</p></div>
        <div className="text-center"><p className="text-slate-500">Class Applied For</p><p className="text-sm font-bold text-slate-900">{a.applyingForClass}</p></div>
        <div className="text-right"><p className="text-slate-500">Date of Application</p><p className="text-sm font-bold text-slate-900">{fmtDate(a.createdAt)}</p></div>
      </div>

      {/* Student details with photograph */}
      <Heading>Student Details</Heading>
      <div className="flex gap-4">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4">
          {studentRows.filter(([, v]) => v).map(([k, v]) => <Row key={k} label={k} value={v} wide={k === 'Name of Student'} />)}
        </div>
        <div className="flex h-[45mm] w-[35mm] shrink-0 items-center justify-center overflow-hidden border-2 border-slate-400 bg-slate-50">
          {a.profilePic
            ? <img src={a.profilePic} alt="Student" className="h-full w-full object-cover" />
            : <span className="px-2 text-center text-[10px] text-slate-400">Affix passport size photograph</span>}
        </div>
      </div>

      {sections.map(([title, rows]) => (
        <div key={title}>
          <Heading>{title}</Heading>
          <div className="grid grid-cols-2 gap-x-4">
            {rows.map(([k, v, wide]) => <Row key={k} label={k} value={v} wide={wide} />)}
          </div>
        </div>
      ))}

      {a.documents?.length > 0 && (
        <>
          <Heading>Documents Submitted</Heading>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
            {a.documents.map((d) => (
              <p key={d.url} className="flex items-center gap-2">
                <span className="flex h-3.5 w-3.5 items-center justify-center border border-slate-600 text-[10px] font-bold leading-none">✓</span>
                {d.label}
              </p>
            ))}
          </div>
        </>
      )}

      <Heading>Declaration</Heading>
      <p className="text-[11px] leading-relaxed text-slate-700">
        I hereby declare that the information given above is true and correct to the best of my knowledge. I agree to abide by the
        rules and regulations of the school. I understand that admission is subject to verification of documents and availability of seats.
      </p>

      <div className="mt-12 grid grid-cols-2 gap-10 text-center text-[11px] text-slate-600">
        <div className="border-t border-slate-500 pt-1">Date &amp; Place</div>
        <div className="border-t border-slate-500 pt-1">Signature of Parent / Guardian</div>
      </div>

      <div className="mt-6 rounded-md border border-dashed border-slate-400 p-3 text-[11px] text-slate-600">
        <p className="mb-2 font-bold uppercase tracking-wide text-slate-700">For Office Use Only</p>
        <div className="grid grid-cols-3 gap-4">
          <span>Admitted to Class: ________</span><span>Section: ________</span><span>Roll No.: ________</span>
        </div>
      </div>
    </div>
  );
};

const AdmissionPortal = () => {
  const { schoolId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('overview');
  const [saved, setSaved] = useState(false);
  const [shareMsg, setShareMsg] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admissions/public/${schoolId}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Unable to load admissions');
        if (alive) setData(json);
      } catch (err) {
        if (alive) setLoadError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [schoolId]);

  useEffect(() => {
    if (data?.school?.name) document.title = `Admissions · ${data.school.name}`;
    // Show the school's name in the address bar instead of its id.
    const slug = data?.school?.slug;
    if (slug && slug !== schoolId) window.history.replaceState(window.history.state, '', `/admission/${slug}`);
    try {
      const list = JSON.parse(localStorage.getItem('eec_saved_schools') || '[]');
      if (data?.school?._id) setSaved(list.includes(String(data.school._id)));
    } catch { /* storage unavailable */ }
  }, [data, schoolId]);

  const school = data?.school;
  const sessions = useMemo(() => data?.sessions || [], [data]);

  const openForm = (session) => {
    navigate(`/admission/${school?.slug || schoolId}/apply/${session._id}`);
  };
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>;
  }
  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-rose-500" />
          <p className="font-semibold text-slate-800">{loadError}</p>
        </div>
      </div>
    );
  }

  const openCount = sessions.filter((sn) => sn.state === 'open').length;
  const featured = sessions.find((sn) => sn.state === 'open') || sessions[0] || null;
  const others = sessions.filter((sn) => sn !== featured);
  const classRange = (() => {
    const all = [...new Set(sessions.flatMap((sn) => sn.classes || []))];
    if (!all.length) return '';
    return all.length === 1 ? all[0] : `${all[0]} – ${all[all.length - 1]}`;
  })();
  const ROW_TONES = [
    { box: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600' },
    { box: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600' },
    { box: 'bg-sky-50', icon: 'bg-sky-100 text-sky-600' },
  ];

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: school?.name, url });
      else { await navigator.clipboard.writeText(url); setShareMsg('Link copied'); setTimeout(() => setShareMsg(''), 1800); }
    } catch { /* cancelled */ }
  };
  const toggleSaved = () => {
    const next = !saved;
    setSaved(next);
    try {
      const list = new Set(JSON.parse(localStorage.getItem('eec_saved_schools') || '[]'));
      if (next) list.add(String(school?._id)); else list.delete(String(school?._id));
      localStorage.setItem('eec_saved_schools', JSON.stringify([...list]));
    } catch { /* storage unavailable */ }
  };
  const goTab = (key) => {
    setTab(key);
    document.getElementById(`adm-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const TABS = [['overview', 'Overview', Home], ['admissions', 'Admissions', FileText], ['contact', 'Contact', Phone]];
  const SIDE = 'rounded-xl bg-slate-50 px-3 py-2.5';

  return (
    <div className="min-h-screen bg-slate-100 px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-5xl space-y-3">
        {/* ── Hero ── */}
        <header className="no-print relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-600 shadow-sm">
          {school?.cover && <img src={school.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/55 to-slate-900/10" />
          <div className="relative flex flex-col gap-3 p-4 pt-12 sm:flex-row sm:items-center sm:gap-4 sm:p-5 sm:pt-12">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-md sm:h-24 sm:w-24">
              {school?.logo
                ? <img src={school.logo} alt="" className="h-full w-full object-contain" />
                : <School className="h-9 w-9 text-indigo-600" />}
            </div>
            <div className="min-w-0 flex-1 text-white">
              <h1 className="truncate text-xl font-bold sm:text-2xl">{school?.name}</h1>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {featured?.academicYear && <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">Session {featured.academicYear}</span>}
                {classRange && <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">{classRange}</span>}
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${openCount ? 'bg-emerald-500 text-white' : 'bg-white/80 text-slate-700'}`}>
                  {openCount ? 'Admissions Open' : 'No open admissions'}
                </span>
              </div>
              {school?.address && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-white/90"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{school.address}</span></p>
              )}
            </div>
            <a href="/admissions" aria-label="All schools" title="All schools"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm backdrop-blur hover:bg-white"><ArrowLeft className="h-4 w-4" /></a>
            <div className="flex shrink-0 gap-2 sm:self-end">
              <button type="button" onClick={toggleSaved}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
                <Heart className={`h-3.5 w-3.5 ${saved ? 'fill-rose-500 text-rose-500' : ''}`} /> {saved ? 'Saved' : 'Save'}
              </button>
              <button type="button" onClick={share}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
                <Share2 className="h-3.5 w-3.5" /> {shareMsg || 'Share'}
              </button>
            </div>
          </div>
        </header>

        {/* ── Tabs ── */}
        <nav className="no-print flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">
          {TABS.map(([key, label, Icon]) => (
            <button key={key} type="button" onClick={() => goTab(key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${tab === key ? 'bg-indigo-50 text-indigo-700 shadow-[inset_0_-2px_0_#4f46e5]' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
          <a href="/admissions" className="ml-auto inline-flex shrink-0 items-center rounded-lg px-3.5 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">All schools</a>
        </nav>

        {(
          <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
            {/* ── Admission notices ── */}
            <section id="adm-admissions" className="scroll-mt-4 rounded-2xl bg-white p-4 shadow-sm">
              <div id="adm-overview" className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Megaphone className="h-5 w-5 text-indigo-600" /> Admission Notice</h2>
                <span className="text-[11px] font-semibold text-indigo-600">{sessions.length} notice{sessions.length === 1 ? '' : 's'}</span>
              </div>

              {!featured ? (
                <p className="py-10 text-center text-sm text-slate-500">No admissions are published right now. Please check back later.</p>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex flex-col gap-3 rounded-xl bg-indigo-50/70 p-3.5 sm:flex-row sm:items-center">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-500"><Megaphone className="h-7 w-7" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 sm:text-[15px]">{featured.title}</p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {[featured.classes?.length ? featured.classes.join(', ') : 'All classes', featured.academicYear && `Session ${featured.academicYear}`].filter(Boolean).join(' | ')}
                      </p>
                      {featured.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{featured.description}</p>}
                      {featured.classSeats?.some((c) => c.capacity) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {featured.classSeats.filter((c) => c.capacity).map((c) => (
                            <span key={c.className} className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${c.full ? 'bg-rose-100 text-rose-700' : 'bg-white text-slate-700'}`}>
                              {c.className}: {c.full ? 'Seats Full' : `${c.available} seat${c.available === 1 ? '' : 's'} left`}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Starts: {fmtDate(featured.startDate)}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Last date: {fmtDate(featured.endDate)}</span>
                      </div>
                    </div>
                    {featured.state === 'open' ? (
                      <button type="button" onClick={() => openForm(featured)}
                        className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
                        Apply Now <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className={`shrink-0 self-start rounded-lg px-3 py-1.5 text-xs font-semibold sm:self-center ${(STATE_TAG[featured.state] || STATE_TAG.closed).cls}`}>
                        {(STATE_TAG[featured.state] || STATE_TAG.closed).label}
                      </span>
                    )}
                  </div>

                  {others.map((sn, i) => {
                    const tone = ROW_TONES[i % ROW_TONES.length];
                    const tag = STATE_TAG[sn.state] || STATE_TAG.closed;
                    return (
                      <button key={sn._id} type="button" disabled={sn.state !== 'open'} onClick={() => openForm(sn)}
                        className={`flex w-full items-center gap-3 rounded-xl ${tone.box} px-3.5 py-2.5 text-left transition hover:brightness-[0.98] disabled:cursor-default`}>
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}><FileText className="h-4.5 w-4.5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-slate-900">{sn.title}</span>
                          <span className="block text-[11px] text-slate-600">{fmtDate(sn.startDate)} – {fmtDate(sn.endDate)}{sn.classes?.length ? ` · ${sn.classes.join(', ')}` : ''}</span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tag.cls}`}>{tag.label}</span>
                        {sn.state === 'open' && <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Sidebar ── */}
            <aside id="adm-contact" className="scroll-mt-4 space-y-3">
              <div className="space-y-2 rounded-2xl bg-white p-3 shadow-sm">
                {featured?.state === 'open' ? (
                  <button type="button" onClick={() => openForm(featured)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                    <PenLine className="h-4 w-4" /> Apply for Admission
                  </button>
                ) : (
                  <p className="rounded-lg bg-slate-100 py-2.5 text-center text-sm font-semibold text-slate-500">
                    {featured?.state === 'full' ? 'Seats are full' : 'Admissions are not open'}
                  </p>
                )}
                {school?.phone && (
                  <a href={`tel:${school.phone}`} className={`flex items-center gap-3 ${SIDE} hover:bg-slate-100`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><Phone className="h-4 w-4" /></span>
                    <span className="min-w-0"><span className="block text-xs font-bold text-slate-900">Admission Helpline</span><span className="block truncate text-[11px] text-slate-600">{school.phone}</span></span>
                  </a>
                )}
                {school?.email && (
                  <a href={`mailto:${school.email}`} className={`flex items-center gap-3 ${SIDE} hover:bg-slate-100`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><Mail className="h-4 w-4" /></span>
                    <span className="min-w-0"><span className="block text-xs font-bold text-slate-900">Email Us</span><span className="block truncate text-[11px] text-slate-600">{school.email}</span></span>
                  </a>
                )}
                {school?.address && (
                  <div className={`flex items-center gap-3 ${SIDE}`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><MapPin className="h-4 w-4" /></span>
                    <span className="min-w-0"><span className="block text-xs font-bold text-slate-900">Address</span><span className="block text-[11px] text-slate-600">{school.address}</span></span>
                  </div>
                )}
              </div>
              {featured && (
                <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 shadow-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600"><CalendarDays className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{featured.academicYear ? `Session ${featured.academicYear}` : featured.title}</p>
                    <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${(STATE_TAG[featured.state] || STATE_TAG.closed).cls}`}>
                      {featured.state === 'open' ? 'Admissions Open' : (STATE_TAG[featured.state] || STATE_TAG.closed).label}
                    </span>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export { ApplicationSheet, STATE_TAG, fmtDate };
export default AdmissionPortal;
