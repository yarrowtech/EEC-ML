import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, CalendarDays, CheckCircle2, CheckSquare, ChevronDown, ChevronRight, ClipboardList, Clock3, FileText,
  Heart, Home, Loader2, MoreHorizontal, Plane, Plus, Search, Send, Users, X, XCircle,
} from 'lucide-react';
import { parentApiJson } from './parentApi';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import { useDialog } from './useDialog';

const CARD = 'rounded-xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]';
const INPUT = 'w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100';
const REASON_MAX = 1000;

const REASON_TYPES = [
  { value: 'medical', label: 'Medical', Icon: Heart, tone: 'bg-rose-50 text-rose-600' },
  { value: 'family', label: 'Family', Icon: Home, tone: 'bg-violet-50 text-violet-600' },
  { value: 'travel', label: 'Travel', Icon: Plane, tone: 'bg-cyan-50 text-cyan-700' },
  { value: 'other', label: 'Other', Icon: MoreHorizontal, tone: 'bg-slate-100 text-slate-600' },
];
const reasonMeta = (value) => REASON_TYPES.find((r) => r.value === value) || REASON_TYPES[3];

const PAGE_MOTION = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const RISE = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};
const LIST_MOTION = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
};

const fmtDate = (v) => {
  const d = new Date(v);
  return !v || Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const dayCount = (from, to) => {
  const a = new Date(from);
  const b = new Date(to || from);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
};

const statusChip = (status) => {
  if (status === 'approved') return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700"><CheckCircle2 size={12} /> Approved</span>;
  if (status === 'rejected') return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-600"><XCircle size={12} /> Rejected</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700"><Clock3 size={12} /> Pending</span>;
};

const ExcuseLetters = () => {
  const navigate = useNavigate();
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [children, setChildren] = useState([]);
  const [form, setForm] = useState({ studentId: '', dateFrom: '', dateTo: '', reasonType: 'medical', reason: '', additionalNotes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [detail, setDetail] = useState(null);
  const detailRef = useDialog(Boolean(detail), () => setDetail(null));

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

  useEffect(() => {
    loadLetters();
  }, []);

  const submitLetter = async (event) => {
    event.preventDefault();
    if (!form.studentId || !form.dateFrom || !form.dateTo || !form.reason.trim()) {
      setFormError('Child, dates and reason are required.');
      return;
    }
    if (new Date(form.dateTo) < new Date(form.dateFrom)) {
      setFormError('The end date cannot be before the start date.');
      return;
    }
    try {
      setSubmitting(true);
      setFormError('');
      await parentApiJson('/api/excuse-letters/parent', { method: 'POST', body: JSON.stringify(form) }, navigate);
      setForm((current) => ({ ...current, dateFrom: '', dateTo: '', reason: '', additionalNotes: '' }));
      await loadLetters();
    } catch (err) {
      setFormError(err.message || 'Unable to submit excuse letter');
    } finally {
      setSubmitting(false);
    }
  };

  const stats = useMemo(() => letters.reduce((acc, l) => {
    acc.total += 1;
    acc[l.status === 'approved' || l.status === 'rejected' ? l.status : 'pending'] += 1;
    return acc;
  }, { total: 0, pending: 0, approved: 0, rejected: 0 }), [letters]);

  const filtered = useMemo(() => letters.filter((l) => {
    const status = l.status || 'pending';
    if (statusFilter !== 'all' && status !== statusFilter) return false;
    const q = searchTerm.trim().toLowerCase();
    return !q || [l.studentName, l.reason, l.reasonType].some((v) => String(v || '').toLowerCase().includes(q));
  }), [letters, statusFilter, searchTerm]);

  const tabs = [
    { key: 'all', label: `All (${stats.total})` },
    { key: 'pending', label: `Pending (${stats.pending})` },
    { key: 'approved', label: `Approved (${stats.approved})` },
    { key: 'rejected', label: `Rejected (${stats.rejected})` },
  ];
  const selectedChild = children.find((c) => String(c._id) === String(form.studentId)) || null;
  const childLine = (c) => [
    c.grade ? `Class ${c.grade}` : '',
    c.section ? `Section ${c.section}` : '',
    c.roll || c.rollNumber ? `Roll ${c.roll || c.rollNumber}` : '',
  ].filter(Boolean).join(' • ');

  if (loading && !letters.length) {
    return <div className="p-3"><Loading label="excuse letters" rows={3} /></div>;
  }

  return (
    <motion.div variants={PAGE_MOTION} initial="hidden" animate="show" className="space-y-3 p-3 sm:p-4 md:p-5">
      <motion.header variants={RISE} className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500"><FileText size={22} /></span>
        <div>
          <h1 className="text-xl font-bold leading-tight text-[#0b1446]">Excuse Letters</h1>
          <p className="text-xs text-slate-500 sm:text-sm">Send absence requests to your child&apos;s class teacher and track their status.</p>
        </div>
      </motion.header>

      {error ? <ErrorState message={error} onRetry={loadLetters} /> : null}

      {/* Stats */}
      <motion.div variants={RISE} className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Total Letters', value: stats.total, sub: 'All requests', Icon: FileText, card: 'border-blue-100 bg-blue-50/40', icon: 'bg-blue-100/80 text-blue-600', tone: 'text-blue-600' },
          { label: 'Pending', value: stats.pending, sub: 'Awaiting teacher', Icon: Clock3, card: 'border-amber-100 bg-amber-50/40', icon: 'bg-amber-100/80 text-amber-600', tone: 'text-amber-600' },
          { label: 'Approved', value: stats.approved, sub: 'Leave accepted', Icon: CheckSquare, card: 'border-emerald-100 bg-emerald-50/40', icon: 'bg-emerald-100/80 text-emerald-600', tone: 'text-emerald-600' },
          { label: 'Rejected', value: stats.rejected, sub: 'Not accepted', Icon: XCircle, card: 'border-violet-100 bg-violet-50/40', icon: 'bg-violet-100/80 text-violet-600', tone: 'text-violet-600' },
        ].map(({ label, value, sub, Icon, card, icon, tone }) => (
          <div key={label} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${card}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${icon}`}><Icon size={20} /></span>
            <div className="min-w-0">
              <p className={`truncate text-xs font-medium ${tone}`}>{label}</p>
              <p className="text-xl font-bold leading-tight text-[#0b1446]">{value}</p>
              <p className="truncate text-[11px] text-slate-500">{sub}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Submit form */}
      <motion.form variants={RISE} onSubmit={submitLetter} className={`${CARD} p-3`}>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white"><Plus size={18} /></span>
          <div>
            <h2 className="text-sm font-bold text-[#0b1446]">Send new excuse letter</h2>
            <p className="text-[11px] text-slate-500">Tag a child and send an absence request to their class teacher.</p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label htmlFor="excuse-student" className="mb-1 block text-xs font-medium text-[#0b1446]">Child <span className="text-rose-500">*</span></label>
              <div className="relative flex items-center gap-2.5 rounded-lg border border-slate-200 px-2.5 py-1.5">
                {selectedChild?.profilePic ? (
                  <img src={selectedChild.profilePic} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-xs font-bold text-blue-600">
                    {String(selectedChild?.name || 'C').charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#0b1446]">{selectedChild?.name || 'Select child'}</p>
                  {selectedChild ? <p className="truncate text-[11px] text-slate-500">{childLine(selectedChild)}</p> : null}
                </div>
                <ChevronDown size={16} className="shrink-0 text-slate-500" />
                <select
                  id="excuse-student"
                  required
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                >
                  <option value="">Select child</option>
                  {children.map((child) => <option key={child._id} value={child._id}>{child.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="excuse-date-from" className="mb-1 block text-xs font-medium text-[#0b1446]">From <span className="text-rose-500">*</span></label>
                <input id="excuse-date-from" required type="date" value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} className={INPUT} />
              </div>
              <div>
                <label htmlFor="excuse-date-to" className="mb-1 block text-xs font-medium text-[#0b1446]">To <span className="text-rose-500">*</span></label>
                <input id="excuse-date-to" required type="date" min={form.dateFrom || undefined} value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} className={INPUT} />
              </div>
            </div>
            {form.dateFrom && form.dateTo ? (
              <p className="-mt-1 text-[11px] text-blue-600">{dayCount(form.dateFrom, form.dateTo)} day{dayCount(form.dateFrom, form.dateTo) === 1 ? '' : 's'} of leave</p>
            ) : null}

            <div>
              <p className="mb-1 text-xs font-medium text-[#0b1446]">Reason type <span className="text-rose-500">*</span></p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Reason type">
                {REASON_TYPES.map(({ value, label, Icon }) => {
                  const active = form.reasonType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setForm({ ...form, reasonType: value })}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${active ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'border-slate-200 bg-white text-[#0b1446] hover:bg-slate-50'}`}
                    >
                      <Icon size={15} className="text-blue-600" /> {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="excuse-reason" className="mb-1 block text-xs font-medium text-[#0b1446]">Reason for absence <span className="text-rose-500">*</span></label>
              <div className="relative">
                <textarea
                  id="excuse-reason"
                  required
                  rows={3}
                  maxLength={REASON_MAX}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Describe why your child will be absent..."
                  className={`${INPUT} resize-none pb-5`}
                />
                <span className="pointer-events-none absolute bottom-2 right-2.5 text-[10px] text-slate-400">{form.reason.length}/{REASON_MAX}</span>
              </div>
            </div>
            <div>
              <label htmlFor="excuse-notes" className="mb-1 block text-xs font-medium text-[#0b1446]">Additional notes <span className="font-normal text-slate-500">(optional)</span></label>
              <textarea
                id="excuse-notes"
                rows={2}
                maxLength={REASON_MAX}
                value={form.additionalNotes}
                onChange={(e) => setForm({ ...form, additionalNotes: e.target.value })}
                placeholder="Anything else the teacher should know..."
                className={`${INPUT} resize-none`}
              />
            </div>
          </div>
        </div>

        {formError && (
          <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-rose-600"><AlertCircle size={14} /> {formError}</p>
        )}
        <motion.button
          type="submit"
          disabled={submitting || !children.length}
          whileTap={{ scale: 0.99 }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {submitting ? 'Sending…' : 'Send excuse letter'}
        </motion.button>
      </motion.form>

      {/* Letter log */}
      <motion.section variants={RISE} className={`${CARD} p-3`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><ClipboardList size={18} /></span>
            <div>
              <h2 className="text-sm font-bold text-[#0b1446]">Letter log</h2>
              <p className="text-[11px] text-slate-500">Excuse letters you have sent to teachers.</p>
            </div>
          </div>
          <label className="relative w-full sm:w-64">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="search" aria-label="Search letters" placeholder="Search letters..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`${INPUT} pl-8`} />
          </label>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter letters by status">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={statusFilter === t.key}
              onClick={() => setStatusFilter(t.key)}
              className={`rounded-lg border px-4 py-1.5 text-xs font-semibold transition ${statusFilter === t.key ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-[#0b1446] hover:bg-slate-50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No excuse letters" hint={searchTerm || statusFilter !== 'all' ? 'Nothing matches this filter.' : 'Use the form above to send an absence request.'} />
        ) : (
          <motion.div key={statusFilter} variants={LIST_MOTION} initial="hidden" animate="show" className="space-y-2">
            {filtered.map((letter) => {
              const reason = reasonMeta(letter.reasonType);
              const days = dayCount(letter.dateFrom, letter.dateTo);
              return (
                <motion.article
                  key={letter._id}
                  variants={ITEM}
                  className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-white p-2 transition hover:border-blue-100 hover:shadow-[0_4px_14px_rgba(15,23,42,0.05)] lg:flex-row lg:items-center"
                >
                  <div className="shrink-0 rounded-md bg-slate-50 px-3 py-2 lg:w-48">
                    <p className="flex items-center gap-1.5 truncate text-xs font-medium text-[#0b1446]"><CalendarDays size={13} className="text-blue-600" />{fmtDate(letter.dateFrom)}{days > 1 ? ` → ${fmtDate(letter.dateTo)}` : ''}</p>
                    <p className="text-[11px] text-slate-500">{days} day{days === 1 ? '' : 's'} · Sent {fmtDate(letter.createdAt)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#0b1446]">{letter.studentName || 'Student'}</p>
                    <p className="line-clamp-1 text-xs text-slate-500">{letter.reason}</p>
                  </div>
                  <span className={`w-fit shrink-0 rounded-full px-3 py-0.5 text-[11px] font-medium ${reason.tone}`}>{reason.label}</span>
                  <div className="min-w-0 lg:w-[28%]">
                    {statusChip(letter.status)}
                    <p className="mt-1 flex items-start gap-1.5 text-[11px] text-slate-600">
                      <Users size={13} className="mt-0.5 shrink-0 text-slate-500" />
                      <span className="min-w-0 truncate">
                        Class Teacher · Class {letter.className || '—'}{letter.sectionName ? ` - Section ${letter.sectionName}` : ''}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetail(letter)}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                  >
                    <FileText size={14} /> View Details <ChevronRight size={14} className="text-slate-500" />
                  </button>
                </motion.article>
              );
            })}
          </motion.div>
        )}
      </motion.section>

      {/* Details modal (portal → full-screen backdrop) */}
      {createPortal(
        <AnimatePresence>
          {detail && (
            <motion.div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/40" onClick={() => setDetail(null)} aria-hidden="true" />
              <motion.div
                ref={detailRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="excuse-detail-title"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border bg-white shadow-xl"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500">Excuse letter</p>
                    <h2 id="excuse-detail-title" className="truncate text-base font-bold text-[#0b1446]">{detail.studentName || 'Student'}</h2>
                  </div>
                  <button type="button" onClick={() => setDetail(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
                </div>
                <div className="space-y-3 overflow-y-auto p-4 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    {statusChip(detail.status)}
                    <span className={`rounded-full px-3 py-0.5 text-[11px] font-medium ${reasonMeta(detail.reasonType).tone}`}>{reasonMeta(detail.reasonType).label}</span>
                  </div>
                  <dl className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1.5">
                    <dt className="text-slate-500">Class</dt><dd className="text-slate-800">{detail.className || '—'}{detail.sectionName ? ` - Section ${detail.sectionName}` : ''}</dd>
                    <dt className="text-slate-500">Leave</dt><dd className="text-slate-800">{fmtDate(detail.dateFrom)} → {fmtDate(detail.dateTo)} ({dayCount(detail.dateFrom, detail.dateTo)} days)</dd>
                    <dt className="text-slate-500">Sent on</dt><dd className="text-slate-800">{fmtDate(detail.createdAt) || '—'}</dd>
                    {detail.reviewedAt ? (<><dt className="text-slate-500">Reviewed on</dt><dd className="text-slate-800">{fmtDate(detail.reviewedAt)}</dd></>) : null}
                  </dl>
                  <div>
                    <p className="mb-1 font-semibold text-[#0b1446]">Reason</p>
                    <p className="whitespace-pre-line text-slate-600">{detail.reason}</p>
                  </div>
                  {detail.additionalNotes ? (
                    <div>
                      <p className="mb-1 font-semibold text-[#0b1446]">Additional notes</p>
                      <p className="whitespace-pre-line text-slate-600">{detail.additionalNotes}</p>
                    </div>
                  ) : null}
                  {detail.teacherRemarks || detail.reviewNote ? (
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                      <p className="mb-1 font-semibold text-emerald-700">Teacher&apos;s response</p>
                      <p className="whitespace-pre-line text-emerald-800">{detail.teacherRemarks || detail.reviewNote}</p>
                    </div>
                  ) : null}
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

export default ExcuseLetters;
