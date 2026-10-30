import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText, Send, Calendar, User, CheckCircle, XCircle, Download, Eye,
  Clock, ChevronRight, X, Loader2, AlertTriangle, Plus, History,
  Phone, Mail, Hash, BookOpen, Users, GraduationCap, ShieldCheck, Pencil, Trash2, ChevronLeft,
  Edit,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { clearStudentApiCacheByUrl, fetchCachedJson } from '../utils/studentApiCache';
import { subscribeSocketEvent } from '../hooks/useCommunityWallUnread';

const STATUS_MAP = {
  approved: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle, dot: 'bg-emerald-500' },
  rejected: { label: 'Rejected', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: XCircle, dot: 'bg-rose-500' },
  pending: { label: 'With class teacher', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock, dot: 'bg-amber-500' },
  awaiting_parent: { label: 'Waiting for parent', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', icon: Users, dot: 'bg-violet-500' },
};

const STUDENT_STATUS = {
  submitted: { label: 'Submitted', cls: 'bg-blue-600 text-white border-blue-600' },
  approved: { label: 'Approved', cls: 'bg-emerald-600 text-white border-emerald-600' },
  rejected: { label: 'Rejected', cls: 'bg-rose-600 text-white border-rose-600' },
};
const studentStatusKey = (letter) => {
  if (letter?.status === 'approved') return 'approved';
  if (letter?.status === 'rejected') return 'rejected';
  return 'submitted';
};
const PAGE_SIZE = 8;

// Student letters go: student → parent approval → class teacher decision.
const letterStatus = (letter) => {
  if (letter?.parentReview?.status === 'rejected') return { ...STATUS_MAP.rejected, label: 'Rejected by parent' };
  return STATUS_MAP[letter?.status] || STATUS_MAP.pending;
};

const flowSteps = (letter) => {
  const parent = letter?.parentReview?.status;
  const status = letter?.status;
  const viaParent = letter?.submittedBy === 'student' || (parent && parent !== 'not_required');
  const steps = [{ key: 'sent', label: 'Submitted', state: 'done' }];
  if (viaParent) {
    steps.push({
      key: 'parent',
      label: parent === 'rejected' ? 'Parent rejected' : parent === 'approved' ? 'Parent approved' : 'Parent review',
      state: parent === 'rejected' ? 'failed' : parent === 'approved' ? 'done' : 'current',
    });
  }
  const teacherState = parent === 'rejected' || status === 'awaiting_parent'
    ? 'todo'
    : status === 'approved' ? 'done' : status === 'rejected' ? 'failed' : 'current';
  steps.push({
    key: 'teacher',
    label: status === 'approved' ? 'Teacher approved' : status === 'rejected' && parent !== 'rejected' ? 'Teacher rejected' : 'Class teacher',
    state: teacherState,
  });
  return steps;
};

const STEP_TONE = {
  done: 'bg-emerald-500 text-white',
  current: 'bg-amber-400 text-white',
  failed: 'bg-rose-500 text-white',
  todo: 'bg-slate-200 text-slate-400',
};

const FlowTracker = ({ letter }) => {
  const steps = flowSteps(letter);
  return (
    <div className="flex items-center">
      {steps.map((step, i) => (
        <React.Fragment key={step.key}>
          {i > 0 && <span className={`mx-1.5 h-0.5 flex-1 rounded-full ${step.state === 'todo' ? 'bg-slate-200' : 'bg-emerald-300'}`} />}
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${STEP_TONE[step.state]}`}>
              {step.state === 'done' ? <CheckCircle className="h-3 w-3" /> : step.state === 'failed' ? <XCircle className="h-3 w-3" /> : i + 1}
            </span>
            <span className={`text-[11px] font-semibold ${step.state === 'todo' ? 'text-slate-400' : 'text-slate-700'}`}>{step.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

const REASON_TYPES = [
  { value: 'illness', label: 'Illness / Medical' },
  { value: 'family', label: 'Family Emergency' },
  { value: 'personal', label: 'Personal Reasons' },
  { value: 'travel', label: 'Travel / Vacation' },
  { value: 'appointment', label: 'Medical Appointment' },
  { value: 'other', label: 'Other' },
];
// "Other" shows the student's own wording when they typed one.
const reasonTypeLabel = (l) => (l?.reasonType === 'other' && String(l?.customReasonType || '').trim()
  ? l.customReasonType
  : REASON_TYPES.find((r) => r.value === l?.reasonType)?.label || l?.reasonType || '');

const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const daysBetween = (a, b) => {
  if (!a || !b) return 0;
  const ms = new Date(b) - new Date(a);
  return Math.max(1, Math.ceil(ms / 86400000) + 1);
};

/* ─── Reusable input wrapper ─── */
const Field = ({ label, icon: Icon, children, readOnly }) => (
  <div>
    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </label>
    {children || (
      <div className={`rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm ${readOnly ? 'bg-slate-50 text-slate-600' : 'bg-white text-slate-900'}`} />
    )}
  </div>
);

const ExcuseLetter = () => {
  const API_BASE = useMemo(
    () => (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '').replace(/\/api$/, ''),
    []
  );
  const EXCUSE_LETTERS_ENDPOINT = `${API_BASE}/api/excuse-letters/student`;
  const EXCUSE_LETTERS_CACHE_TTL_MS = 2 * 60 * 1000;

  const [formData, setFormData] = useState({
    studentName: '', rollNumber: '', className: '', sectionName: '',
    schoolName: '', schoolAddress: '', parentName: '', parentEmail: '', parentPhone: '',
    dateFrom: '', dateTo: '', reason: '', reasonType: 'illness', customReasonType: '',
    additionalNotes: '', emergencyContact: '',
  });
  const [submittedLetters, setSubmittedLetters] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [previewLetter, setPreviewLetter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const loadProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const { data } = await fetchCachedJson(`${API_BASE}/api/student/auth/profile`, {
        ttlMs: 10 * 60 * 1000,
        fetchOptions: {
          headers: { Authorization: `Bearer ${token}` },
        },
      });
      let schoolName = data?.schoolName || data?.schoolInfo?.name || data?.school?.name || '';
      let schoolAddress = data?.schoolAddress || data?.schoolInfo?.address || data?.school?.address || '';
      if (!schoolName) {
        const { data: dash } = await fetchCachedJson(`${API_BASE}/api/student/auth/dashboard`, {
          ttlMs: 5 * 60 * 1000,
          fetchOptions: {
            headers: { Authorization: `Bearer ${token}` },
          },
        });
        schoolName = dash?.profile?.schoolName || dash?.profile?.school?.name || schoolName;
        schoolAddress = dash?.profile?.schoolAddress || dash?.profile?.school?.address || schoolAddress;
      }
      setFormData((prev) => ({
        ...prev,
        studentName: data?.name || '',
        rollNumber: data?.roll || '',
        className: data?.grade || data?.className || '',
        sectionName: data?.section || data?.sectionName || '',
        schoolName,
        schoolAddress,
        parentName: data?.guardianName || data?.fatherName || data?.motherName || '',
        parentEmail: data?.guardianEmail || data?.email || '',
        parentPhone: data?.guardianPhone || data?.fatherPhone || data?.motherPhone || '',
      }));
    } catch {
      // ignore profile prefill errors
    }
  };

  const loadLetters = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;
      const { data } = await fetchCachedJson(EXCUSE_LETTERS_ENDPOINT, {
        ttlMs: EXCUSE_LETTERS_CACHE_TTL_MS,
        fetchOptions: {
          headers: { Authorization: `Bearer ${token}` },
        },
      });
      setSubmittedLetters(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); loadLetters(); }, []);
  // Parent rejection / teacher decision updates the table instantly.
  useEffect(() => subscribeSocketEvent('new_notification', (payload) => {
    if (String(payload?.typeLabel || '').startsWith('excuse_letter')) {
      clearStudentApiCacheByUrl(EXCUSE_LETTERS_ENDPOINT);
      loadLetters();
    }
  }), []);

  const blankForm = { dateFrom: '', dateTo: '', reason: '', reasonType: 'illness', customReasonType: '', additionalNotes: '' };
  const openNewLetter = () => {
    setEditingId('');
    setError('');
    setFormData((prev) => ({ ...prev, ...blankForm }));
    setDrawerOpen(true);
  };
  const toInputDate = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
  const openEditLetter = (letter) => {
    setEditingId(String(letter._id));
    setError('');
    setFormData((prev) => ({
      ...prev,
      dateFrom: toInputDate(letter.dateFrom),
      dateTo: toInputDate(letter.dateTo),
      reason: letter.reason || '',
      reasonType: letter.reasonType || 'other',
      customReasonType: letter.customReasonType || '',
      additionalNotes: letter.additionalNotes || '',
    }));
    setDrawerOpen(true);
  };
  const deleteLetter = async (letter) => {
    try {
      setDeletingId(String(letter._id));
      const token = localStorage.getItem('token');
      const res = await fetch(`${EXCUSE_LETTERS_ENDPOINT}/${letter._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to delete');
      clearStudentApiCacheByUrl(EXCUSE_LETTERS_ENDPOINT);
      setSubmittedLetters((prev) => prev.filter((l) => String(l._id) !== String(letter._id)));
      setConfirmDelete(null);
    } catch (err) {
      window.alert(err.message || 'Unable to delete');
    } finally {
      setDeletingId('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const token = localStorage.getItem('token');
      const payload = {
        dateFrom: formData.dateFrom, dateTo: formData.dateTo,
        reason: formData.reason, reasonType: formData.reasonType,
        customReasonType: formData.reasonType === 'other' ? formData.customReasonType.trim() : '',
        additionalNotes: formData.additionalNotes, emergencyContact: formData.emergencyContact,
      };
      const res = await fetch(editingId ? `${EXCUSE_LETTERS_ENDPOINT}/${editingId}` : EXCUSE_LETTERS_ENDPOINT, {
        method: editingId ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to submit');
      clearStudentApiCacheByUrl(EXCUSE_LETTERS_ENDPOINT);
      await loadLetters();
      setFormData((prev) => ({
        ...prev, dateFrom: '', dateTo: '', reason: '', reasonType: 'illness', customReasonType: '', customReasonType: '',
        additionalNotes: '', emergencyContact: '',
      }));
      setSuccess(editingId ? 'Letter updated.' : 'Letter submitted successfully.');
      setDrawerOpen(false);
      setEditingId('');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Unable to submit');
    } finally {
      setSaving(false);
    }
  };

  const generateLetterPreview = (letter) => {
    const d = letter || formData;
    return `Date: ${new Date().toLocaleDateString()}

To,
The Principal / Class Teacher
${d.schoolName || 'School'}
${d.schoolAddress || ''}

Subject: Request for Leave of Absence

Dear Sir/Madam,

I am writing to inform you that my ward, ${d.studentName}, studying in Class ${d.className}-${d.sectionName}, Roll Number: ${d.rollNumber}, will not be able to attend school from ${fmtDate(d.dateFrom)} to ${fmtDate(d.dateTo)}.

Reason for absence: ${d.reason}
Type: ${reasonTypeLabel(d)}
${d.additionalNotes ? `\nAdditional Information: ${d.additionalNotes}` : ''}

I kindly request you to grant permission for the leave and excuse the absence.

Thank you for your consideration.

Yours sincerely,
${d.parentName}
(Parent/Guardian)

Contact Details:
Email: ${d.parentEmail}
Phone: ${d.parentPhone}${d.emergencyContact ? `\nEmergency Contact: ${d.emergencyContact}` : ''}`;
  };

  // Fill school / student / parent details from the profile when the stored letter lacks them.
  const withProfile = (letter) => {
    const out = { ...letter };
    ['schoolName', 'schoolAddress', 'studentName', 'rollNumber', 'className', 'sectionName', 'parentName', 'parentEmail', 'parentPhone']
      .forEach((key) => { if (!out[key]) out[key] = formData[key] || ''; });
    return out;
  };

  const downloadLetter = (raw) => {
    const d = withProfile(raw);
    const days = daysBetween(d.dateFrom, d.dateTo);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const M = 22;
    const width = W - M * 2;
    let y = 24;
    const text = (str, opts = {}) => {
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setFontSize(opts.size || 11);
      doc.setTextColor(...(opts.color || [51, 65, 85]));
      const lines = doc.splitTextToSize(String(str), width);
      doc.text(lines, opts.center ? W / 2 : M, y, { align: opts.center ? 'center' : 'left' });
      y += lines.length * ((opts.size || 11) * 0.45) + (opts.gap ?? 2);
    };

    // Letterhead
    text(d.schoolName || 'School', { bold: true, size: 16, center: true, color: [15, 23, 42], gap: 1 });
    if (d.schoolAddress) text(d.schoolAddress, { size: 9.5, center: true, color: [100, 116, 139], gap: 1 });
    text('Leave Application', { size: 9.5, center: true, color: [148, 163, 184], gap: 3 });
    doc.setDrawColor(226, 232, 240);
    doc.line(M, y, W - M, y);
    y += 8;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100, 116, 139);
    doc.text(`Date: ${fmtDate(d.createdAt || Date.now())}`, M, y);
    doc.text(`Type: ${reasonTypeLabel(d)}`, W - M, y, { align: 'right' });
    y += 10;

    text('To,', { size: 10, color: [100, 116, 139], gap: 1 });
    text('The Principal / Class Teacher', { gap: 1 });
    text(d.schoolName || 'School', { gap: 1 });
    if (d.schoolAddress) text(d.schoolAddress, { gap: 1 });
    y += 5;

    text('Subject: Request for Leave of Absence', { bold: true, center: true, color: [15, 23, 42], gap: 6 });
    text('Dear Sir/Madam,', { gap: 4 });
    // Paragraph with bold runs: wraps word by word, switching font per segment.
    const richText = (segments, gap = 4) => {
      const size = 11;
      const lineH = size * 0.45;
      doc.setFontSize(size);
      doc.setTextColor(51, 65, 85);
      let x = M;
      segments.forEach(({ t, bold }) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        String(t).split(/(\s+)/).filter(Boolean).forEach((word) => {
          const w = doc.getTextWidth(word);
          if (/^\s+$/.test(word)) { if (x > M) x += w; return; }
          if (x + w > M + width && x > M) { x = M; y += lineH; }
          doc.text(word, x, y);
          x += w;
        });
      });
      y += lineH + gap;
    };
    richText([
      { t: 'I, ' },
      { t: d.studentName || 'Student', bold: true },
      { t: ', a student of ' },
      { t: `Class ${d.className}${d.sectionName ? `-${d.sectionName}` : ''}`, bold: true },
      ...(d.rollNumber ? [{ t: ', ' }, { t: `Roll No. ${d.rollNumber}`, bold: true }] : []),
      { t: ', will not be able to attend school from ' },
      { t: fmtDate(d.dateFrom), bold: true },
      { t: ' to ' },
      { t: fmtDate(d.dateTo), bold: true },
      { t: ` (${days} day${days > 1 ? 's' : ''}).` },
    ]);
    text(d.reason, { gap: 3 });
    if (d.additionalNotes) text(d.additionalNotes, { gap: 3 });
    y += 2;
    text('I kindly request you to grant me leave for the above days and excuse my absence.', { gap: 2 });
    text('Thank you for your consideration.', { gap: 10 });

    text('Yours sincerely,', { gap: 2 });
    text(d.studentName || 'Student', { bold: true, color: [15, 23, 42], gap: 1 });
    text(`Class ${d.className}${d.sectionName ? `-${d.sectionName}` : ''}`, { size: 9.5, color: [100, 116, 139], gap: 8 });

    if (d.parentName || d.parentPhone || d.parentEmail) {
      text('Parent / Guardian', { bold: true, size: 10, color: [71, 85, 105], gap: 1 });
      [d.parentName, d.parentPhone && `Phone: ${d.parentPhone}`, d.parentEmail && `Email: ${d.parentEmail}`]
        .filter(Boolean)
        .forEach((line) => text(line, { size: 10, color: [100, 116, 139], gap: 1 }));
    }

    const stamp = new Date(d.dateFrom).toISOString().slice(0, 10);
    doc.save(`excuse_letter_${String(d.studentName || 'student').replace(/\s+/g, '_')}_${stamp}.pdf`);
  };

  const leaveDays = daysBetween(formData.dateFrom, formData.dateTo);

  const pendingCount = submittedLetters.filter((l) => studentStatusKey(l) === 'submitted').length;
  const approvedCount = submittedLetters.filter((l) => l.status === 'approved').length;

  const rejectedCount = submittedLetters.filter((l) => l.status === 'rejected').length;
  const todayIso = new Date().toISOString().slice(0, 10);
  const closeDrawer = () => { if (!saving) { setDrawerOpen(false); setError(''); setEditingId(''); } };
  const pageCount = Math.max(1, Math.ceil(submittedLetters.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = submittedLetters.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="h-full p-3 sm:p-4">
      {/* ─── One card: header, stats and the letter list ─── */}
      <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-100 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
            <FileText className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-slate-900">Excuse Letters</h1>
            <p className="text-xs text-slate-500">Request leave and track your letters.</p>
          </div>
          <button type="button" onClick={openNewLetter}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> New Letter
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3 sm:grid-cols-4 sm:px-5">
          {[
            { label: 'Total', value: submittedLetters.length, tone: 'bg-indigo-50 text-indigo-700' },
            { label: 'Submitted', value: pendingCount, tone: 'bg-amber-50 text-amber-700' },
            { label: 'Approved', value: approvedCount, tone: 'bg-emerald-50 text-emerald-700' },
            { label: 'Rejected', value: rejectedCount, tone: 'bg-rose-50 text-rose-700' },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl px-3 py-2 ${item.tone}`}>
              <p className="text-lg font-bold leading-tight">{item.value}</p>
              <p className="text-[11px] font-medium opacity-80">{item.label}</p>
            </div>
          ))}
        </div>

        {success && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 sm:mx-5">
            <CheckCircle className="h-4 w-4 shrink-0" /> {success}
          </div>
        )}

        {/* Letter table */}
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 sm:px-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              <span className="ml-2 text-sm text-slate-500">Loading letters...</span>
            </div>
          ) : submittedLetters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center">
              <FileText className="mx-auto mb-2 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No letters yet</p>
              <p className="mt-0.5 text-xs text-slate-400">Tap “New Letter” to request a leave.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">Sl No</th>
                    <th className="px-3 py-2.5">Submitted</th>
                    <th className="px-3 py-2.5">Leave dates</th>
                    <th className="px-3 py-2.5">Days</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageRows.map((letter, i) => {
                    const st = STUDENT_STATUS[studentStatusKey(letter)];
                    const days = daysBetween(letter.dateFrom, letter.dateTo);
                    // Editable only until the parent acts on it.
                    const editable = letter.status === 'awaiting_parent';
                    const busy = deletingId === String(letter._id);
                    return (
                      <tr key={letter._id || letter.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2.5 text-xs font-semibold text-slate-500">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">{fmtDate(letter.createdAt || letter.submittedOn)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs font-medium text-slate-800">
                          {fmtDate(letter.dateFrom)} <span className="text-slate-400">→</span> {fmtDate(letter.dateTo)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">{days}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">{reasonTypeLabel(letter)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" onClick={() => setPreviewLetter(letter)} title="View letter" aria-label="View letter" className="flex h-8 w-8 items-center justify-center rounded-full text-indigo-600 transition">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {/* Once the parent or teacher acts, the letter is locked: no edit/delete. */}
                            {editable && (
                              <>
                            <button type="button" onClick={() => openEditLetter(letter)} disabled={!editable} title={editable ? 'Edit' : 'Already reviewed — cannot edit'} aria-label="Edit letter" className="flex h-8 w-8 items-center justify-center rounded-full text-blue-600 transition">
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => setConfirmDelete(letter)} disabled={!editable || busy} title={editable ? 'Delete' : 'Already reviewed — cannot delete'} aria-label="Delete letter" className="flex h-8 w-8 items-center justify-center rounded-full text-rose-600 transition disabled:opacity-60">
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                              </>
                            )}
                            <button type="button" onClick={() => downloadLetter(letter)} title="Download" aria-label="Download letter" className="flex h-8 w-8 items-center justify-center rounded-full text-emerald-600 transition">
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {submittedLetters.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 sm:px-5">
            <span>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, submittedLetters.length)} of {submittedLetters.length}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page" className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" onClick={() => setPage(n)}
                  className={`h-7 min-w-7 rounded-full px-2 text-xs font-semibold ${n === currentPage ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {n}
                </button>
              ))}
              <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount} aria-label="Next page" className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition disabled:opacity-40">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ NEW LETTER DRAWER (right side) ═══════ */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={(e) => { if (e.target === e.currentTarget) closeDrawer(); }}>
          <form onSubmit={handleSubmit} className="excuse-drawer-in flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">{editingId ? 'Edit Excuse Letter' : 'New Excuse Letter'}</h2>
                <p className="text-[11px] text-slate-500">Fill in the leave details below.</p>
              </div>
              <button type="button" onClick={closeDrawer} aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Date range</label>
                <div className="flex items-center gap-2">
                  <input type="date" name="dateFrom" value={formData.dateFrom} min={todayIso} onChange={handleInputChange} required
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  <input type="date" name="dateTo" value={formData.dateTo} min={formData.dateFrom || todayIso} onChange={handleInputChange} required
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </div>
                {formData.dateFrom && formData.dateTo && (
                  <p className="mt-1 text-[11px] font-semibold text-indigo-600">{leaveDays} day{leaveDays !== 1 ? 's' : ''} leave</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Type</label>
                <select name="reasonType" value={formData.reasonType} onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                  {REASON_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                {formData.reasonType === 'other' && (
                  <input type="text" name="customReasonType" value={formData.customReasonType} onChange={handleInputChange}
                    required maxLength={60} autoFocus placeholder="Type the leave type..."
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Reason for leave</label>
                <textarea name="reason" value={formData.reason} onChange={handleInputChange} rows={4} required
                  placeholder="Describe why you need the leave..."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Additional notes <span className="font-normal text-slate-400">(optional)</span></label>
                <textarea name="additionalNotes" value={formData.additionalNotes} onChange={handleInputChange} rows={3}
                  placeholder="Any additional information..."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-5 py-3">
              <button type="button" onClick={closeDrawer} disabled={saving}
                className="rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {saving ? 'Submitting...' : editingId ? 'Update' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══════ DELETE CONFIRMATION ═══════ */}
      {confirmDelete && (
        <div className="excuse-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={(e) => { if (e.target === e.currentTarget && !deletingId) setConfirmDelete(null); }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-letter-title" className="excuse-pop-in w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
              <Trash2 className="h-6 w-6 text-rose-600" />
            </div>
            <h3 id="delete-letter-title" className="text-base font-bold text-slate-900">Delete this letter?</h3>
            <p className="mt-1 text-sm text-slate-500">
              Are you sure you want to delete the excuse letter for{' '}
              <span className="font-semibold text-slate-700">{fmtDate(confirmDelete.dateFrom)} → {fmtDate(confirmDelete.dateTo)}</span>? This cannot be undone.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} disabled={Boolean(deletingId)}
                className="rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={() => deleteLetter(confirmDelete)} disabled={Boolean(deletingId)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                {deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deletingId ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ VIEW LETTER MODAL ═══════ */}
      {previewLetter && (() => {
        const d = withProfile(previewLetter);
        const days = daysBetween(d.dateFrom, d.dateTo);
        const st = previewLetter._id ? STUDENT_STATUS[studentStatusKey(previewLetter)] : null;
        return (
          <div className="excuse-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setPreviewLetter(null); }}>
            <div role="dialog" aria-modal="true" aria-labelledby="view-letter-title" className="excuse-pop-in flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-[18px] w-[18px] text-indigo-600" />
                  <h3 id="view-letter-title" className="text-sm font-bold text-slate-900">Excuse Letter</h3>
                  {st && <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>}
                </div>
                <button type="button" onClick={() => setPreviewLetter(null)} aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
                <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8">
                  {/* Letterhead */}
                  <div className="mb-5 border-b border-slate-100 pb-4 text-center">
                    <p className="text-base font-bold text-slate-900">{d.schoolName || 'School'}</p>
                    {d.schoolAddress && <p className="mt-0.5 text-xs text-slate-500">{d.schoolAddress}</p>}
                    <p className="mt-0.5 text-xs text-slate-400">Leave Application</p>
                  </div>

                  <div className="space-y-4 text-sm text-slate-700">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Date: {fmtDate(d.createdAt || Date.now())}</span>
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-medium text-indigo-600">{reasonTypeLabel(d)}</span>
                    </div>

                    <div>
                      <p className="mb-0.5 text-xs font-medium text-slate-500">To,</p>
                      <p>The Principal / Class Teacher</p>
                      <p className="text-slate-500">{d.schoolName || 'School'}</p>
                      {d.schoolAddress && <p className="text-slate-500">{d.schoolAddress}</p>}
                    </div>

                    <p className="text-center font-semibold text-slate-900 underline underline-offset-2">Subject: Request for Leave of Absence</p>

                    <div className="leading-relaxed">
                      <p>Dear Sir/Madam,</p>
                      <p className="mt-2">
                        I, <span className="font-semibold text-slate-900">{d.studentName}</span>, a student of Class {d.className}
                        {d.sectionName ? `-${d.sectionName}` : ''}{d.rollNumber ? `, Roll No. ${d.rollNumber}` : ''}, will not be able to attend school from{' '}
                        <span className="font-semibold text-slate-900">{fmtDate(d.dateFrom)}</span> to{' '}
                        <span className="font-semibold text-slate-900">{fmtDate(d.dateTo)}</span> ({days} day{days > 1 ? 's' : ''}).
                      </p>
                      <p className="mt-2">{d.reason}</p>
                      {d.additionalNotes && <p className="mt-1">{d.additionalNotes}</p>}
                      <p className="mt-3">I kindly request you to grant me leave for the above days and excuse my absence.</p>
                      <p className="mt-1">Thank you for your consideration.</p>
                    </div>

                    <div className="pt-2">
                      <p>Yours sincerely,</p>
                      <p className="mt-1 font-semibold text-slate-900">{d.studentName || 'Student'}</p>
                      <p className="text-xs text-slate-500">Class {d.className}{d.sectionName ? `-${d.sectionName}` : ''}</p>
                    </div>

                    {(d.parentName || d.parentPhone || d.parentEmail) && (
                      <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-xs">
                        <p className="mb-1 font-semibold text-slate-600">Parent / Guardian</p>
                        {d.parentName && <p className="flex items-center gap-1.5 text-slate-600"><User className="h-3 w-3 text-slate-400" /> {d.parentName}</p>}
                        {d.parentPhone && <p className="flex items-center gap-1.5 text-slate-600"><Phone className="h-3 w-3 text-slate-400" /> {d.parentPhone}</p>}
                        {d.parentEmail && <p className="flex items-center gap-1.5 text-slate-600"><Mail className="h-3 w-3 text-slate-400" /> {d.parentEmail}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-5 py-3">
                <button type="button" onClick={() => setPreviewLetter(null)}
                  className="rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Close
                </button>
                <button type="button" onClick={() => downloadLetter(previewLetter)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                  <Download className="h-4 w-4" /> Download PDF
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ExcuseLetter;
