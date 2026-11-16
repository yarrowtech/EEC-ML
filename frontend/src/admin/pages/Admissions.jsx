import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Eye, Loader2, Pencil, Plus, Printer, Search, Trash2, X, ClipboardList, Megaphone, UserCheck, CheckCircle2, XCircle, KeyRound } from 'lucide-react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { ApplicationSheet } from '../../pages/AdmissionPortal';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '').replace(/\/api$/, '');
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const toInput = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const INPUT = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const CARD = 'rounded-2xl border border-slate-100 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]';
const PAGE_SIZE = 10;

const STATE_TAG = {
  open: { label: 'Open', cls: 'bg-emerald-600 text-white' },
  upcoming: { label: 'Upcoming', cls: 'bg-amber-500 text-white' },
  closed: { label: 'Closed', cls: 'bg-slate-400 text-white' },
  full: { label: 'Seats Full', cls: 'bg-rose-600 text-white' },
  inactive: { label: 'Inactive', cls: 'bg-slate-200 text-slate-600' },
};
const APP_STATUS = {
  submitted: 'bg-blue-600 text-white',
  shortlisted: 'bg-amber-500 text-white',
  approved: 'bg-violet-600 text-white',
  admitted: 'bg-emerald-600 text-white',
  rejected: 'bg-rose-600 text-white',
};
const EMPTY_SESSION = { title: '', academicYear: '', description: '', classes: [], seats: [], startDate: '', endDate: '', isActive: true };
const REVIEW_STATUSES = ['submitted', 'shortlisted', 'approved', 'rejected'];

// Application → payload for /api/student/auth/register (the normal enrolment endpoint).
const toStudentPayload = (a, section) => ({
  name: a.studentName,
  grade: a.applyingForClass,
  section,
  gender: a.gender,
  dob: a.dateOfBirth ? new Date(a.dateOfBirth).toISOString().slice(0, 10) : '',
  admissionDate: new Date().toISOString().slice(0, 10),
  admissionType: a.hasPreviousSchool === 'yes' ? 'Transfer' : 'New Admission',
  academicYear: a.academicYear || '',
  mobile: a.guardianPhone,
  email: a.email,
  address: a.address,
  permanentAddress: a.permanentAddress || a.address,
  pinCode: a.pinCode,
  profilePic: a.profilePic,
  birthPlace: a.birthPlace,
  bloodGroup: a.bloodGroup,
  caste: a.caste,
  category: a.category,
  nationality: a.nationality,
  religion: a.religion,
  fatherName: a.fatherName,
  fatherPhone: a.fatherPhone,
  fatherOccupation: a.fatherOccupation,
  motherName: a.motherName,
  motherPhone: a.motherPhone,
  motherOccupation: a.motherOccupation,
  guardianName: a.guardianName || a.fatherName || a.motherName,
  guardianPhone: a.guardianPhone,
  guardianEmail: a.guardianEmail || a.email,
  guardianRelation: a.guardianRelation || (a.guardianName ? '' : (a.fatherName ? 'Father' : 'Mother')),
  knownHealthIssues: a.knownHealthIssues,
  allergies: a.allergies,
  immunizationStatus: a.immunizationStatus,
  learningDisabilities: a.learningDisabilities,
  aadharNumber: a.aadharNumber,
  birthCertificateNo: a.birthCertificateNo,
  hasPreviousSchool: a.hasPreviousSchool,
  previousSchoolName: a.previousSchool,
  previousClass: a.previousClass,
  previousPercentage: a.previousPercentage,
  transferCertificateNo: a.transferCertificateNo,
  transferCertificateDate: a.transferCertificateDate,
  applicationId: a.admissionNumber,
  applicationDate: a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '',
  approvalStatus: 'Approved',
  documents: a.documents || [],
});

// Full-page A4 admission confirmation with login details (printed instead of the popup).
const CredentialsLetter = ({ credentials: c }) => {
  const a = c.app;
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const loginUrl = window.location.origin;
  const Detail = ({ label, value }) => (
    <div className="flex items-baseline gap-2 py-1 text-[13px]">
      <span className="w-40 shrink-0 font-semibold text-slate-600">{label}</span>
      <span className="flex-1 border-b border-dotted border-slate-400 font-medium text-slate-900">{value || '—'}</span>
    </div>
  );
  const LoginBox = ({ title, login }) => (
    <div className="rounded-lg border-2 border-slate-700 p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-800">{title}</p>
      {login ? (
        <table className="w-full text-[13px]">
          <tbody>
            <tr><td className="w-24 py-1 font-semibold text-slate-600">User ID</td><td className="py-1 font-mono text-[15px] font-bold">{login.userId}</td></tr>
            <tr><td className="py-1 font-semibold text-slate-600">Password</td><td className="py-1 font-mono text-[15px] font-bold">{login.password}</td></tr>
          </tbody>
        </table>
      ) : (
        <p className="text-[12px] text-slate-600">Linked to the existing parent account registered with this phone number. Please continue to use the same login.</p>
      )}
    </div>
  );
  return (
    <div className="application-sheet bg-white text-slate-900">
      <div className="flex flex-col items-center border-b-4 border-double border-slate-800 pb-3 text-center">
        {a.schoolLogo && <img src={a.schoolLogo} alt="" className="mb-1.5 h-16 w-16 object-contain" />}
        <p className="text-xl font-extrabold uppercase tracking-wide">{a.schoolName}</p>
        {a.schoolAddress && <p className="mt-0.5 text-xs text-slate-600">{a.schoolAddress}</p>}
        {(a.schoolPhone || a.schoolEmail) && (
          <p className="text-[11px] text-slate-500">{[a.schoolPhone && `Phone: ${a.schoolPhone}`, a.schoolEmail && `Email: ${a.schoolEmail}`].filter(Boolean).join('  |  ')}</p>
        )}
      </div>

      <div className="mt-4 flex justify-between text-[12px] text-slate-600">
        <span>Ref: {a.admissionNumber}</span>
        <span>Date: {today}</span>
      </div>
      <div className="mt-3 text-center">
        <p className="inline-block rounded border-2 border-slate-800 px-4 py-1 text-sm font-bold uppercase tracking-[0.15em]">Admission Confirmation</p>
      </div>

      <p className="mt-5 text-[13px] leading-relaxed">
        Dear Parent / Guardian,<br />
        We are pleased to inform you that <b>{a.studentName}</b> has been admitted to <b>{a.applyingForClass}{c.section ? `-${c.section}` : ''}</b>
        {a.academicYear ? <> for the academic session <b>{a.academicYear}</b></> : null}. The login details for the school portal are given below.
      </p>

      <p className="mb-1 mt-5 border-b-2 border-slate-800 pb-0.5 text-[11px] font-bold uppercase tracking-[0.12em]">Student Details</p>
      <div className="flex gap-5">
        <div className="min-w-0 flex-1">
          <Detail label="Name of Student" value={a.studentName} />
          <Detail label="Class & Section" value={`${a.applyingForClass}${c.section ? ` - ${c.section}` : ''}`} />
          <Detail label="Roll No." value={c.roll} />
          <Detail label="Admission No." value={a.admissionNumber} />
          <Detail label="Father's Name" value={a.fatherName} />
          <Detail label="Mother's Name" value={a.motherName} />
          <Detail label="Phone" value={a.guardianPhone} />
        </div>
        <div className="flex h-[45mm] w-[35mm] shrink-0 items-center justify-center overflow-hidden border-2 border-slate-400 bg-slate-50">
          {a.profilePic ? <img src={a.profilePic} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] text-slate-400">Photo</span>}
        </div>
      </div>

      <p className="mb-2 mt-5 border-b-2 border-slate-800 pb-0.5 text-[11px] font-bold uppercase tracking-[0.12em]">Portal Login Details</p>
      <div className="grid grid-cols-2 gap-4">
        <LoginBox title="Student Login" login={c.student} />
        <LoginBox title="Parent Login" login={c.parent} />
      </div>
      <p className="mt-2 text-[12px] text-slate-600">Login at: <b>{loginUrl}</b></p>

      <p className="mb-1 mt-5 border-b-2 border-slate-800 pb-0.5 text-[11px] font-bold uppercase tracking-[0.12em]">Important Instructions</p>
      <ol className="list-decimal space-y-1 pl-5 text-[12px] text-slate-700">
        <li>Change the password after the first login.</li>
        <li>Do not share the login details with anyone outside the family.</li>
        <li>Keep this letter safe for future reference.</li>
      </ol>

      <div className="mt-16 grid grid-cols-2 gap-10 text-center text-[11px] text-slate-600">
        <div className="border-t border-slate-500 pt-1">Received by (Parent / Guardian)</div>
        <div className="border-t border-slate-500 pt-1">Authorised Signatory</div>
      </div>
    </div>
  );
};

const Admissions = ({ setShowAdminHeader }) => {
  // ?tab=applications | notifications (dashboard quick actions deep-link here).
  const [tab, setTab] = useState(() => (new URLSearchParams(window.location.search).get('tab') === 'applications' ? 'applications' : 'notifications'));
  const [schoolId, setSchoolId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null); // session being created / edited
  const [saving, setSaving] = useState(false);
  const [sessionFilter, setSessionFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [viewApp, setViewApp] = useState(null);
  const [sectionsByClass, setSectionsByClass] = useState({});
  const [admitFor, setAdmitFor] = useState(null); // { app, section }
  const [admitting, setAdmitting] = useState(false);
  const [credentials, setCredentials] = useState(null);

  useEffect(() => { setShowAdminHeader?.(true); }, [setShowAdminHeader]);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  }), []);

  const api = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_BASE}/api/admissions${path}`, { headers, ...options });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Request failed');
    return json;
  }, [headers]);

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([api('/admin/sessions'), api('/admin/applications')]);
      setSchoolId(s.slug || s.schoolId || '');
      setSessions(s.sessions || []);
      setClassOptions(s.classOptions || []);
      setAcademicYears(s.academicYears || []);
      setSectionsByClass(s.sectionsByClass || {});
      setApplications(Array.isArray(a) ? a : []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const publicUrl = schoolId ? `${window.location.origin}/admission/${schoolId}` : '';
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(publicUrl); toast.success('Admission page link copied'); } catch { toast.error('Could not copy the link'); }
  };

  const saveSession = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const body = JSON.stringify(drawer);
      if (drawer._id) await api(`/admin/sessions/${drawer._id}`, { method: 'PUT', body });
      else await api('/admin/sessions', { method: 'POST', body });
      toast.success(drawer._id ? 'Admission updated' : 'Admission created');
      setDrawer(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (session) => {
    try {
      const updated = await api(`/admin/sessions/${session._id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive: !session.isActive }) });
      setSessions((prev) => prev.map((s) => (s._id === session._id ? { ...s, ...updated } : s)));
      toast.success(updated.isActive ? 'Published on the admission page' : 'Hidden from the admission page');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteSession = async (session) => {
    if (!window.confirm(`Delete "${session.title}"?`)) return;
    try {
      await api(`/admin/sessions/${session._id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s._id !== session._id));
      toast.success('Deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setAppStatus = async (app, status) => {
    try {
      await api(`/admin/applications/${app._id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setApplications((prev) => prev.map((a) => (a._id === app._id ? { ...a, status } : a)));
      setViewApp((v) => (v && v._id === app._id ? { ...v, status } : v));
      toast.success(`Marked ${status}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Admit: seat check → create student + parent accounts → link them to the application.
  const admit = async () => {
    const { app, section } = admitFor;
    try {
      setAdmitting(true);
      await api(`/admin/applications/${app._id}/admit/check`, { method: 'POST' });
      const res = await fetch(`${API_BASE}/api/student/auth/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify(toStudentPayload(app, section)),
      });
      const reg = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(reg?.error || 'Could not create the student account');
      const updated = await api(`/admin/applications/${app._id}/admit`, {
        method: 'POST',
        body: JSON.stringify({ studentId: reg.userId, parentUsername: reg.parentCredentials?.userId || '' }),
      });
      setApplications((prev) => prev.map((a) => (a._id === app._id ? { ...a, ...updated, sessionId: a.sessionId } : a)));
      setCredentials({
        app,
        section,
        roll: reg.roll,
        student: { userId: reg.username, password: reg.password },
        parent: reg.parentCredentials,
      });
      setAdmitFor(null);
      setViewApp(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdmitting(false);
    }
  };

  const filteredApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applications.filter((a) => (sessionFilter === 'all' || String(a.sessionId) === sessionFilter)
      && (!q || [a.admissionNumber, a.studentName, a.guardianPhone, a.applyingForClass].some((v) => String(v || '').toLowerCase().includes(q))));
  }, [applications, sessionFilter, query]);
  useEffect(() => { setPage(1); }, [sessionFilter, query]);
  const pageCount = Math.max(1, Math.ceil(filteredApps.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageApps = filteredApps.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-3 p-3 sm:p-4">
      {/* Header */}
      <div className={`${CARD} flex flex-wrap items-center gap-3 px-4 py-3`}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><Megaphone className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-slate-900">Admissions</h1>
          <p className="text-xs text-slate-500">Publish admission notifications and review applications.</p>
        </div>
        {publicUrl && (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <Copy className="h-3.5 w-3.5" /> Copy page link
            </button>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <ExternalLink className="h-3.5 w-3.5" /> Open page
            </a>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'notifications', label: `Admission Notifications (${sessions.length})`, icon: Megaphone },
          { key: 'applications', label: `Applications (${applications.length})`, icon: ClipboardList },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${tab === key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === 'notifications' ? (
        <section className={CARD}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">Admission Notifications</h2>
            <button type="button" onClick={() => setDrawer({ ...EMPTY_SESSION, academicYear: academicYears[0]?.name || '' })}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
              <Plus className="h-3.5 w-3.5" /> New Admission
            </button>
          </div>
          {sessions.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No admission notifications yet.</p>
          ) : (
            <div className="overflow-x-auto p-3">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">Title</th><th className="px-3 py-2.5">Start Date</th><th className="px-3 py-2.5">End Date</th>
                    <th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Seats (admitted)</th><th className="px-3 py-2.5">Applications</th><th className="px-3 py-2.5">Active</th><th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((s) => {
                    const tag = STATE_TAG[s.state] || STATE_TAG.inactive;
                    return (
                      <tr key={s._id}>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-slate-900">{s.title}</p>
                          <p className="text-[11px] text-slate-500">{[s.academicYear, s.classes?.length ? s.classes.join(', ') : 'All classes'].filter(Boolean).join(' · ')}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs">{fmtDate(s.startDate)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs">{fmtDate(s.endDate)}</td>
                        <td className="px-3 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tag.cls}`}>{tag.label}</span></td>
                        <td className="px-3 py-2.5">
                          <div className="flex max-w-[220px] flex-wrap gap-1">
                            {(s.classSeats || []).filter((c) => c.capacity).map((c) => (
                              <span key={c.className} className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${c.full ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                                {c.className}: {c.filled}/{c.capacity}
                              </span>
                            ))}
                            {!(s.classSeats || []).some((c) => c.capacity) && <span className="text-[11px] text-slate-400">No limit</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <button type="button" onClick={() => { setSessionFilter(String(s._id)); setTab('applications'); }} className="text-xs font-semibold text-indigo-600 hover:underline">
                            {s.applicationCount || 0}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <button type="button" role="switch" aria-checked={s.isActive} onClick={() => toggleActive(s)} aria-label="Toggle active"
                            className={`relative h-5 w-9 rounded-full transition ${s.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${s.isActive ? 'left-[18px]' : 'left-0.5'}`} />
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1.5">
                            <button type="button" title="Edit" onClick={() => setDrawer({ ...s, seats: s.seats || [], startDate: toInput(s.startDate), endDate: toInput(s.endDate) })}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"><Pencil className="h-3.5 w-3.5" /></button>
                            <button type="button" title="Delete" onClick={() => deleteSession(s)}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-700"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className={CARD}>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
            <h2 className="mr-auto text-sm font-bold text-slate-900">Applied Students</h2>
            <select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs">
              <option value="all">All admissions</option>
              {sessions.map((s) => <option key={s._id} value={String(s._id)}>{s.title}</option>)}
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Admission no, name, phone…"
                className="w-56 rounded-full border border-slate-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-indigo-400" />
            </div>
          </div>
          {filteredApps.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No applications yet.</p>
          ) : (
            <div className="overflow-x-auto p-3">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">Sl No</th><th className="px-3 py-2.5">Admission No</th><th className="px-3 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Class</th><th className="px-3 py-2.5">Phone</th><th className="px-3 py-2.5">Applied On</th>
                    <th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageApps.map((a, i) => (
                    <tr key={a._id}>
                      <td className="px-3 py-2.5 text-xs font-semibold text-slate-500">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-3 py-2.5 text-xs font-bold text-indigo-700">{a.admissionNumber}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-900">{a.studentName}</p>
                        <p className="text-[11px] text-slate-500">{a.sessionTitle}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{a.applyingForClass}</td>
                      <td className="px-3 py-2.5 text-xs">{a.guardianPhone}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs">{fmtDate(a.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        {a.status === 'admitted' ? (
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${APP_STATUS.admitted}`}>Admitted{a.studentUsername ? ` · ${a.studentUsername}` : ''}</span>
                        ) : (
                          <select value={a.status} onChange={(e) => setAppStatus(a, e.target.value)}
                            className={`rounded-full border-0 px-2.5 py-1 text-[11px] font-semibold capitalize ${APP_STATUS[a.status] || APP_STATUS.submitted}`}>
                            {REVIEW_STATUSES.map((k) => <option key={k} value={k} className="bg-white text-slate-800">{k}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" title="View" onClick={() => setViewApp(a)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700"><Eye className="h-3.5 w-3.5" /></button>
                          {a.status === 'approved' && (
                            <button type="button" title="Admit" onClick={() => setAdmitFor({ app: a, section: (sectionsByClass[a.applyingForClass] || [])[0] || '' })}
                              className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-600 px-3 text-[11px] font-semibold text-white hover:bg-emerald-700"><UserCheck className="h-3.5 w-3.5" /> Admit</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredApps.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
              <span>Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredApps.length)} of {filteredApps.length}</span>
              <div className="flex gap-1">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" onClick={() => setPage(n)}
                    className={`h-7 min-w-7 rounded-full px-2 font-semibold ${n === currentPage ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'}`}>{n}</button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Create / edit drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={(e) => { if (e.target === e.currentTarget && !saving) setDrawer(null); }}>
          <form onSubmit={saveSession} className="excuse-drawer-in flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">{drawer._id ? 'Edit Admission' : 'New Admission'}</h2>
              <button type="button" onClick={() => setDrawer(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Title *</span>
                <input value={drawer.title} onChange={(e) => setDrawer({ ...drawer, title: e.target.value })} required maxLength={120} placeholder="Admission 2027-28" className={INPUT} /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Academic year</span>
                <select value={drawer.academicYear} onChange={(e) => setDrawer({ ...drawer, academicYear: e.target.value })} className={INPUT}>
                  <option value="">Select academic year</option>
                  {drawer.academicYear && !academicYears.some((y) => y.name === drawer.academicYear) && (
                    <option value={drawer.academicYear}>{drawer.academicYear}</option>
                  )}
                  {academicYears.map((y) => (
                    <option key={y.name} value={y.name}>{y.name}{y.status === 'upcoming' ? ' (Upcoming)' : ' (Current)'}</option>
                  ))}
                </select></label>
              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-600">Admission dates *</span>
                <div className="flex items-center gap-2">
                  <input type="date" value={drawer.startDate} onChange={(e) => setDrawer({ ...drawer, startDate: e.target.value })} required className={INPUT} />
                  <span className="text-slate-400">→</span>
                  <input type="date" value={drawer.endDate} min={drawer.startDate || undefined} onChange={(e) => setDrawer({ ...drawer, endDate: e.target.value })} required className={INPUT} />
                </div>
              </div>
              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-600">Classes open for admission <span className="font-normal text-slate-400">(none = any class)</span></span>
                <div className="flex flex-wrap gap-1.5">
                  {classOptions.map((c) => {
                    const on = drawer.classes.includes(c);
                    return (
                      <button key={c} type="button" onClick={() => setDrawer({ ...drawer, classes: on ? drawer.classes.filter((x) => x !== c) : [...drawer.classes, c] })}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{c}</button>
                    );
                  })}
                </div>
              </div>
              {drawer.classes.length > 0 && (
                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Seats per class <span className="font-normal text-slate-400">(blank = no limit)</span></span>
                  <div className="grid grid-cols-2 gap-2">
                    {drawer.classes.map((c) => {
                      const current = (drawer.seats || []).find((x) => x.className === c)?.capacity || '';
                      return (
                        <label key={c} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5">
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{c}</span>
                          <input type="number" min="0" value={current} placeholder="∞"
                            onChange={(e) => {
                              const capacity = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
                              const rest = (drawer.seats || []).filter((x) => x.className !== c);
                              setDrawer({ ...drawer, seats: capacity ? [...rest, { className: c, capacity }] : rest });
                            }}
                            className="w-16 rounded-md border border-slate-200 px-2 py-1 text-right text-xs outline-none focus:border-indigo-500" />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Description</span>
                <textarea value={drawer.description} onChange={(e) => setDrawer({ ...drawer, description: e.target.value })} rows={3} maxLength={1000} className={`${INPUT} resize-none`} /></label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={drawer.isActive} onChange={(e) => setDrawer({ ...drawer, isActive: e.target.checked })} className="h-4 w-4 accent-indigo-600" />
                Active — show on the public admission page
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-5 py-3">
              <button type="button" onClick={() => setDrawer(null)} className="rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}{drawer._id ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View application */}
      {viewApp && (
        <div className="excuse-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setViewApp(null); }}>
          <div className="excuse-pop-in flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="no-print flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-bold text-slate-900">Application · {viewApp.admissionNumber}</h3>
              <div className="flex flex-wrap justify-end gap-1.5">
                {viewApp.status !== 'admitted' && viewApp.status !== 'approved' && (
                  <button type="button" onClick={() => setAppStatus(viewApp, 'approved')} className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>
                )}
                {viewApp.status === 'approved' && (
                  <button type="button" onClick={() => setAdmitFor({ app: viewApp, section: (sectionsByClass[viewApp.applyingForClass] || [])[0] || '' })} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"><UserCheck className="h-3.5 w-3.5" /> Admit</button>
                )}
                {viewApp.status !== 'admitted' && viewApp.status !== 'rejected' && (
                  <button type="button" onClick={() => setAppStatus(viewApp, 'rejected')} className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"><XCircle className="h-3.5 w-3.5" /> Reject</button>
                )}
                <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"><Printer className="h-3.5 w-3.5" /> Print</button>
                <button type="button" onClick={() => setViewApp(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="overflow-y-auto p-4">
              <ApplicationSheet school={{ name: viewApp.schoolName || 'Admission Application', address: viewApp.schoolAddress, phone: viewApp.schoolPhone, email: viewApp.schoolEmail, logo: viewApp.schoolLogo }} application={viewApp} />
            </div>
          </div>
        </div>
      )}
      {/* Admit: pick a section */}
      {admitFor && (
        <div className="excuse-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget && !admitting) setAdmitFor(null); }}>
          <div className="excuse-pop-in w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><UserCheck className="h-5 w-5" /></span>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-slate-900">Admit {admitFor.app.studentName}</h3>
                <p className="text-xs text-slate-500">{admitFor.app.admissionNumber} · {admitFor.app.applyingForClass}</p>
              </div>
            </div>
            <label className="mt-4 block"><span className="mb-1 block text-xs font-semibold text-slate-600">Section</span>
              {(sectionsByClass[admitFor.app.applyingForClass] || []).length ? (
                <select value={admitFor.section} onChange={(e) => setAdmitFor({ ...admitFor, section: e.target.value })} className={INPUT}>
                  {sectionsByClass[admitFor.app.applyingForClass].map((sec) => <option key={sec} value={sec}>{sec}</option>)}
                </select>
              ) : (
                <input value={admitFor.section} onChange={(e) => setAdmitFor({ ...admitFor, section: e.target.value.toUpperCase().slice(0, 10) })} placeholder="e.g. A" className={INPUT} />
              )}
            </label>
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              This creates the student account and the parent account (or links an existing parent with the same phone), with login IDs and passwords.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={admitting} onClick={() => setAdmitFor(null)} className="rounded-full border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={admitting} onClick={admit}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {admitting && <Loader2 className="h-4 w-4 animate-spin" />} Admit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials after admission */}
      {credentials && (
        <div className="excuse-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="excuse-pop-in w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {createPortal(<div className="admission-print-root"><CredentialsLetter credentials={credentials} /></div>, document.body)}
            <div className="p-5">
              <div className="text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                <h3 className="mt-1 text-base font-bold text-slate-900">{credentials.app.studentName} is admitted</h3>
                <p className="text-xs text-slate-500">
                  {credentials.app.applyingForClass}{credentials.section ? `-${credentials.section}` : ''}{credentials.roll ? ` · Roll ${credentials.roll}` : ''} · {credentials.app.admissionNumber}
                </p>
              </div>
              {[['Student login', credentials.student], ['Parent login', credentials.parent]].map(([label, c]) => (
                <div key={label} className="mt-3 rounded-xl border border-slate-200 p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700"><KeyRound className="h-3.5 w-3.5 text-indigo-600" /> {label}</p>
                  {c ? (
                    <div className="grid grid-cols-[80px_1fr] gap-y-1 text-xs">
                      <span className="text-slate-500">User ID</span><span className="font-mono font-semibold text-slate-900">{c.userId}</span>
                      <span className="text-slate-500">Password</span><span className="font-mono font-semibold text-slate-900">{c.password}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Linked to the parent's existing account (same phone number). They can log in with their current ID.</p>
                  )}
                </div>
              ))}
              <p className="mt-3 text-[11px] text-slate-400">Passwords are shown once here. Share them with the family and ask them to change it after first login.</p>
            </div>
            <div className="no-print grid grid-cols-2 gap-2 border-t border-slate-100 px-5 py-3">
              <button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><Printer className="h-4 w-4" /> Print</button>
              <button type="button" onClick={() => setCredentials(null)} className="rounded-full bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admissions;
