import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, BookOpen, Bus, Check, CheckCircle2, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock3, Filter,
  CreditCard, FileText, FolderOpen, Heart, Loader2, MessageCircleMore, Monitor, MoreHorizontal, Plus, Search, Send, Users, X, CalendarDays,
} from 'lucide-react';
import { useDialog } from './useDialog';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import { formatStudentDisplay } from '../utils/studentDisplay';
import { parentApiJson } from './parentApi';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];
const CATEGORY_OPTIONS = ['Technical', 'Academic', 'Transport', 'Fees', 'Wellbeing', 'General', 'Other'];
const CARD = 'rounded-xl ';
const INPUT = 'w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100';
const DETAILS_MAX = 1000;
const LOG_PAGE_SIZE = 6;
const CUSTOM_CATEGORY_MAX = 60;

const CATEGORY_ICONS = {
  Technical: Monitor, Academic: BookOpen, Transport: Bus, Fees: CreditCard, Wellbeing: Heart, General: MoreHorizontal, Other: FileText,
};
const CATEGORY_TONE = {
  Technical: 'bg-cyan-50 text-cyan-700',
  Academic: 'bg-violet-50 text-violet-600',
  Transport: 'bg-amber-50 text-amber-700',
  Fees: 'bg-emerald-50 text-emerald-700',
  Wellbeing: 'bg-rose-50 text-rose-600',
  General: 'bg-slate-100 text-slate-600',
  Other: 'bg-slate-100 text-slate-600',
};
const PRIORITY_TONE = {
  low: { chip: 'border-slate-200 bg-slate-50 text-slate-700', dot: 'bg-slate-400', ring: 'ring-slate-200' },
  medium: { chip: 'border-blue-200 bg-blue-50 text-blue-700', dot: 'bg-blue-600', ring: 'ring-blue-200' },
  high: { chip: 'border-amber-200 bg-amber-50 text-amber-600', dot: 'bg-amber-500', ring: 'ring-amber-200' },
  critical: { chip: 'border-rose-200 bg-rose-50 text-rose-600', dot: 'bg-rose-500', ring: 'ring-rose-200' },
};

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

const statusChip = (status) => {
  if (status === 'resolved') return <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2.5 py-0.5 text-[11px] font-medium text-white"><CheckCircle2 size={12} /> Resolved</span>;
  if (status === 'in_progress') return <span className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-2.5 py-0.5 text-[11px] font-medium text-amber-700"><Clock3 size={12} /> In Progress</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-medium text-white"><CheckCircle2 size={12} /> Open</span>;
};
const priorityChip = (priority) => {
  const p = String(priority || 'medium');
  const tone = { low: 'bg-slate-100 text-slate-600', medium: 'bg-amber-50 text-amber-600', high: 'bg-orange-50 text-orange-600', critical: 'bg-rose-50 text-rose-600' }[p] || 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${tone}`}><AlertCircle size={12} /> {p}</span>;
};

const resolveAssignee = (complaint) => {
  if (!complaint) return 'School Admin';
  return (
    complaint.assignedTo ||
    complaint.owner ||
    (complaint.targetRole === 'teacher' ? 'Class Teacher' : 'School Admin')
  );
};

const ComplaintManagementSystem = () => {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [detail, setDetail] = useState(null);
  const detailRef = useDialog(Boolean(detail), () => setDetail(null));
  const [showCreate, setShowCreate] = useState(false);
  const createRef = useDialog(showCreate, () => setShowCreate(false));
  const [filterOpen, setFilterOpen] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const filterRef = useRef(null);

  // Close the status filter menu on outside click / Esc.
  useEffect(() => {
    if (!filterOpen) return undefined;
    const onDown = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setFilterOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [filterOpen]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: CATEGORY_OPTIONS[0],
    priority: 'medium',
    studentId: '',
    customCategory: '',
  });
  const isOtherCategory = form.category === 'Other';

  const isAcademicCategory = (form.category || '').toLowerCase().includes('academic');

  const fetchComplaints = async () => {
    if (!localStorage.getItem('token')) {
      setError('Please login to view complaints.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await parentApiJson('/api/parent/auth/complaints', {}, navigate);
      setComplaints(Array.isArray(data.complaints) ? data.complaints : []);
      setChildren(Array.isArray(data.children) ? data.children : []);
      setForm((prev) => {
        if (prev.studentId || !Array.isArray(data.children) || data.children.length === 0) return prev;
        return { ...prev, studentId: data.children[0].studentId || '' };
      });
    } catch (err) {
      setError(err.message || 'Unable to load complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  useEffect(() => {
    if (!children.length) return;
    setForm((prev) => {
      if (prev.studentId) return prev;
      return { ...prev, studentId: children[0].studentId || '' };
    });
  }, [children]);

  useEffect(() => {
    if (!isAcademicCategory || !children.length) return;
    setForm((prev) => ({
      ...prev,
      studentId: prev.studentId || children[0].studentId || '',
    }));
  }, [isAcademicCategory, children]);

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    if (!localStorage.getItem('token')) {
      setSubmissionError('Please login to file a complaint.');
      return;
    }
    if (!form.title.trim() || !form.description.trim()) {
      setSubmissionError('Title and description are required.');
      return;
    }
    if (isOtherCategory && !form.customCategory.trim()) {
      setSubmissionError('Please type the category for "Other".');
      return;
    }
    if (isAcademicCategory && children.length > 0 && !form.studentId) {
      setSubmissionError('Select a child so the complaint can reach the class teacher.');
      return;
    }

    setSubmitting(true);
    setSubmissionError('');
    try {
      const { customCategory, ...payload } = form;
      // "Other" sends the parent's own wording as the category (routes to the school admin).
      if (isOtherCategory) payload.category = customCategory.trim().slice(0, CUSTOM_CATEGORY_MAX);
      if (!payload.studentId) {
        delete payload.studentId;
      }
      const data = await parentApiJson('/api/parent/auth/complaints', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, navigate);
      setComplaints((prev) => [data, ...prev]);
      setForm({
        title: '',
        description: '',
        category: CATEGORY_OPTIONS[0],
        priority: 'medium',
        studentId: children[0]?.studentId || '',
        customCategory: '',
      });
      setShowCreate(false);
    } catch (err) {
      setSubmissionError(err.message || 'Unable to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredComplaints = useMemo(() => {
    return complaints.filter((complaint) => {
      const matchesStatus = statusFilter === 'all' || complaint.status === statusFilter;
      const matchesSearch =
        !searchTerm ||
        complaint.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (complaint.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (complaint.ticketNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [complaints, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    return complaints.reduce(
      (acc, complaint) => {
        acc.total += 1;
        if (complaint.status === 'open') acc.open += 1;
        if (complaint.status === 'in_progress') acc.inProgress += 1;
        if (complaint.status === 'resolved') acc.resolved += 1;
        return acc;
      },
      { total: 0, open: 0, inProgress: 0, resolved: 0 }
    );
  }, [complaints]);

  const tabs = [
    { key: 'all', label: `All (${stats.total})` },
    { key: 'open', label: `Open (${stats.open})` },
    { key: 'in_progress', label: `In Progress (${stats.inProgress})` },
    { key: 'resolved', label: `Resolved (${stats.resolved})` },
  ];
  useEffect(() => { setLogPage(1); }, [statusFilter, searchTerm]);
  const logPages = Math.max(1, Math.ceil(filteredComplaints.length / LOG_PAGE_SIZE));
  const currentLogPage = Math.min(logPage, logPages);
  const pagedComplaints = filteredComplaints.slice((currentLogPage - 1) * LOG_PAGE_SIZE, currentLogPage * LOG_PAGE_SIZE);
  const openCreate = () => { setSubmissionError(''); setShowCreate(true); };

  const selectedChild = children.find((c) => String(c.studentId) === String(form.studentId)) || null;
  const childLine = (c) => [c.studentCode || c.username || c.admissionNumber ? `ID: ${c.studentCode || c.username || c.admissionNumber}` : '', c.section ? `Section: ${c.section}` : '']
    .filter(Boolean).join(' • ');

  return (
    <motion.div variants={PAGE_MOTION} initial="hidden" animate="show" className="space-y-3 p-3 sm:p-4 md:p-5 lg:flex lg:h-full lg:flex-col lg:gap-3 lg:space-y-0 lg:overflow-y-auto lg:[&>*]:shrink-0">
      <motion.header variants={RISE} className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500"><MessageCircleMore size={22} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight text-[#0b1446] sm:text-xl">Support &amp; Complaints</h1>
          <p className="text-xs text-slate-500 sm:text-sm">Raise an issue with the school support desk and track its status.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 sm:w-auto"
        >
          <Plus size={16} /> New Complaint
        </button>
      </motion.header>

      {/* Stats */}
      <motion.div variants={RISE} className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Total Tickets', value: stats.total, sub: 'All complaints', Icon: FileText, card: 'border-blue-100 bg-blue-50/40', icon: 'bg-blue-100/80 text-blue-600', tone: 'text-blue-600' },
          { label: 'Open', value: stats.open, sub: 'Awaiting response', Icon: FolderOpen, card: 'border-emerald-100 bg-emerald-50/40', icon: 'bg-emerald-100/80 text-emerald-600', tone: 'text-emerald-600' },
          { label: 'In Progress', value: stats.inProgress, sub: 'Being resolved', Icon: Clock3, card: 'border-amber-100 bg-amber-50/40', icon: 'bg-amber-100/80 text-amber-600', tone: 'text-amber-600' },
          { label: 'Resolved', value: stats.resolved, sub: 'Completed', Icon: CheckSquare, card: 'border-violet-100 bg-violet-50/40', icon: 'bg-violet-100/80 text-violet-600', tone: 'text-violet-600' },
        ].map(({ label, value, sub, Icon, card, icon, tone }) => (
          <div key={label} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${card}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${icon}`}><Icon size={20} /></span>
            <div className="min-w-0">
              <p className={`truncate text-xs font-medium ${tone}`}>{label}</p>
              <p className="text-xl font-bold leading-tight text-[#0b1446]">{loading ? '—' : value}</p>
              <p className="truncate text-[11px] text-slate-500">{sub}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Complaint log */}
      <motion.section variants={RISE} className={`${CARD} p-3 lg:flex lg:min-h-[260px] lg:flex-1 lg:flex-col lg:!shrink`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><ClipboardList size={18} /></span>
            <div>
              <h2 className="text-sm font-bold text-[#0b1446]">Complaint log</h2>
              <p className="text-[11px] text-slate-500">Tickets you have submitted to the support desk.</p>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Search complaints by ticket or title"
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${INPUT} pl-8`}
              />
            </label>
            <div ref={filterRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={filterOpen}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition ${statusFilter !== 'all' ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-[#0b1446] hover:bg-slate-50'}`}
              >
                <Filter size={14} />
                <span className="hidden sm:inline">{statusFilter === 'all' ? '' : tabs.find((t) => t.key === statusFilter)?.label.split(' (')[0]}</span>
                {statusFilter !== 'all' ? <span className="h-1.5 w-1.5 rounded-full bg-violet-600 sm:hidden" /> : null}
                <ChevronDown size={13} className={`transition ${filterOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {filterOpen ? (
                  <motion.ul
                    role="menu"
                    aria-label="Filter complaints by status"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full z-30 mt-1.5 w-48 overflow-hidden rounded-xl border border-slate-100 bg-white p-1 shadow-xl"
                  >
                    {tabs.map((t) => (
                      <li key={t.key}>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={statusFilter === t.key}
                          onClick={() => { setStatusFilter(t.key); setFilterOpen(false); }}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium transition ${statusFilter === t.key ? 'bg-violet-50 text-violet-700' : 'text-[#0b1446] hover:bg-slate-50'}`}
                        >
                          {t.label}
                          {statusFilter === t.key ? <CheckCircle2 size={14} className="text-violet-600" /> : null}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {loading ? (
          <Loading label="complaints" rows={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchComplaints} />
        ) : filteredComplaints.length === 0 ? (
          <EmptyState icon={FileText} title="No complaints" hint={searchTerm || statusFilter !== 'all' ? 'Nothing matches this filter.' : 'Tap “New Complaint” to raise an issue.'} />
        ) : (
          <motion.div key={`${statusFilter}-${currentLogPage}`} variants={LIST_MOTION} initial="hidden" animate="show" className="grid gap-2 md:grid-cols-2 lg:-mx-1 lg:min-h-0 lg:flex-1 lg:grid-cols-1 lg:content-start lg:overflow-y-auto lg:overscroll-contain lg:px-1 lg:pb-1">
            {pagedComplaints.map((complaint) => {
              const categoryTone = CATEGORY_TONE[complaint.category] || 'bg-slate-100 text-slate-600';
              const studentLine = complaint.studentName
                ? formatStudentDisplay({ studentName: complaint.studentName, studentId: complaint.studentId, roll: complaint.studentRoll || complaint.roll, section: complaint.studentSection })
                : '';
              return (
                <motion.article
                  key={complaint.id}
                  variants={ITEM}
                  className="rounded-xl border border-slate-100 bg-white transition hover:border-violet-100 shadow-2xl hover:shadow-[0_4px_14px_rgba(15,23,42,0.05)] lg:flex lg:items-center lg:gap-3 lg:rounded-lg lg:p-2.5"
                >
                  {/* Phone / tablet: compact card */}
                  <div className="space-y-3 lg:hidden">
                    {/* Main Card */}
                    <div className="overflow-hidden">

                      {/* Top Section */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">

                          {/* Left: Title + Ticket Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-3">

                              {/* Ticket Icon */}
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                                <FileText size={20} strokeWidth={2} />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-[15px] font-bold text-[#0b1446]">
                                  {complaint.title}
                                </p>

                                <p className="mt-0.5 break-words text-[11px] font-medium text-slate-500">
                                  Ticket #{complaint.ticketNumber}
                                </p>

                                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                                  <CalendarDays size={11} />
                                  <span>
                                    Updated {fmtDate(complaint.updatedAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Status */}
                          <div className="shrink-0">
                            {statusChip(complaint.status)}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="mt-4 line-clamp-2 break-words text-[12px] leading-5 text-slate-600">
                          {complaint.description}
                        </p>

                        {/* Category + Priority */}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold ${categoryTone}`}
                          >
                            {complaint.category}
                          </span>

                          {priorityChip(complaint.priority)}
                        </div>
                      </div>

                      {/* Bottom Information */}
                      <div className="border-t border-slate-100 bg-slate-100 rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between gap-3">

                          {/* Assignee / Student */}
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-100">
                              <Users size={15} />
                            </div>

                            <div className="min-w-0">
                              <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                                Class Teacher
                              </p>

                              <p className="truncate text-[11px] font-semibold text-[#0b1446]">
                                {resolveAssignee(complaint)}
                              </p>

                              {/* {studentLine && (
                                <p className="truncate text-[10px] text-slate-500">
                                  {studentLine}
                                </p>
                              )} */}
                            </div>
                          </div>

                          {/* View Button */}
                          <button
                            type="button"
                            onClick={() => setDetail(complaint)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm transition-all duration-200 hover:bg-violet-700 hover:shadow-md active:scale-[0.98]"
                          >
                            View
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Desktop: single row */}
                  <div className="hidden w-48 shrink-0 rounded-md bg-slate-50 px-3 py-2 lg:block">
                    <p className="truncate text-xs font-medium text-[#0b1446]">Ticket #{complaint.ticketNumber}</p>
                    <p className="text-[11px] text-slate-500">Updated {fmtDate(complaint.updatedAt)}</p>
                  </div>
                  <div className="hidden min-w-0 flex-1 lg:block">
                    <p className="truncate text-sm font-bold text-[#0b1446]">{complaint.title}</p>
                    <p className="line-clamp-1 text-xs text-slate-500">{complaint.description}</p>
                  </div>
                  <span className={`hidden w-fit shrink-0 rounded-full px-3 py-0.5 text-[11px] font-medium lg:inline-block ${categoryTone}`}>{complaint.category}</span>
                  <div className="hidden min-w-0 w-[34%] lg:block">
                    <div className="flex flex-wrap gap-1.5">
                      {statusChip(complaint.status)}
                      {priorityChip(complaint.priority)}
                    </div>
                    <p className="mt-1 flex items-start gap-1.5 text-[11px] text-slate-600">
                      <Users size={13} className="mt-0.5 shrink-0 text-slate-500" />
                      <span className="min-w-0">
                        <span className="block">Assigned to {resolveAssignee(complaint)}</span>
                        {studentLine ? <span className="block truncate text-slate-500">{studentLine}</span> : null}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetail(complaint)}
                    className="hidden shrink-0 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-600 transition hover:bg-violet-50 lg:inline-flex"
                  >
                    <FileText size={14} /> View Details <ChevronRight size={14} className="text-slate-500" />
                  </button>
                </motion.article>
              );
            })}
          </motion.div>
        )}

        {!loading && !error && filteredComplaints.length > 0 ? (
          <div className="mt-3 flex shrink-0 flex-col items-center justify-between gap-2 border-t border-slate-100 pt-3 sm:flex-row">
            <p className="text-[11px] text-slate-500">
              Showing {(currentLogPage - 1) * LOG_PAGE_SIZE + 1}–{Math.min(currentLogPage * LOG_PAGE_SIZE, filteredComplaints.length)} of {filteredComplaints.length} tickets
            </p>
            {logPages > 1 ? (
              <nav aria-label="Complaint log pages" className="flex items-center gap-1">
                <button type="button" disabled={currentLogPage <= 1} onClick={() => setLogPage(currentLogPage - 1)} aria-label="Previous page" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={15} /></button>
                {Array.from({ length: logPages }, (_, i) => i + 1)
                  .slice(Math.max(0, Math.min(currentLogPage - 2, logPages - 3)), Math.max(0, Math.min(currentLogPage - 2, logPages - 3)) + 3)
                  .map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLogPage(n)}
                      aria-current={n === currentLogPage ? 'page' : undefined}
                      className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition ${n === currentLogPage ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      {n}
                    </button>
                  ))}
                <button type="button" disabled={currentLogPage >= logPages} onClick={() => setLogPage(currentLogPage + 1)} aria-label="Next page" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={15} /></button>
              </nav>
            ) : null}
          </div>
        ) : null}
      </motion.section>

      {/* Create modal (portal → full-screen backdrop; bottom sheet on phones) */}
      {createPortal(
        <AnimatePresence>
          {showCreate && (
            <motion.div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setShowCreate(false)} aria-hidden="true" />
              <motion.form
                ref={createRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="complaint-create-title"
                onSubmit={handleFormSubmit}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                transition={{ duration: 0.22 }}
                className="relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none sm:max-w-lg sm:rounded-2xl sm:pb-0 lg:max-w-2xl"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white"><Plus size={18} /></span>
                    <div className="min-w-0">
                      <h2 id="complaint-create-title" className="text-sm font-bold text-[#0b1446] sm:text-base">Submit new complaint</h2>
                      <p className="text-[11px] text-slate-500">Tell us about the issue and we will get back to you.</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowCreate(false)} aria-label="Close" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="complaint-title" className="mb-1 block text-xs font-medium text-[#0b1446]">Title <span className="text-rose-500">*</span></label>
                        <input
                          id="complaint-title"
                          type="text"
                          maxLength={120}
                          value={form.title}
                          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                          className={INPUT}
                          placeholder="Enter a short title for your complaint (e.g., App Issue, Fee Query)"
                        />
                      </div>

                      <div>
                        <p className="mb-1 text-xs font-medium text-[#0b1446]">Category <span className="text-rose-500">*</span></p>
                        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
                          {CATEGORY_OPTIONS.map((option) => {
                            const Icon = CATEGORY_ICONS[option] || MoreHorizontal;
                            const active = form.category === option;
                            return (
                              <button
                                key={option}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setForm((prev) => ({ ...prev, category: option }))}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${active ? 'border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-200' : 'border-slate-200 bg-white text-[#0b1446] hover:bg-slate-50'}`}
                              >
                                <Icon size={15} className="text-violet-600" /> {option}
                              </button>
                            );
                          })}
                        </div>
                        {isOtherCategory ? (
                          <input
                            id="complaint-custom-category"
                            autoFocus
                            maxLength={CUSTOM_CATEGORY_MAX}
                            value={form.customCategory}
                            onChange={(e) => setForm((prev) => ({ ...prev, customCategory: e.target.value }))}
                            placeholder="Type the category (e.g. Canteen, Safety)"
                            aria-label="Custom category"
                            className={`${INPUT} mt-2`}
                          />
                        ) : null}
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          {isAcademicCategory
                            ? 'Academic complaints are routed directly to your child’s class teacher.'
                            : 'Other categories are sent to the school administration team.'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label htmlFor="complaint-details" className="mb-1 block text-xs font-medium text-[#0b1446]">Details <span className="text-rose-500">*</span></label>
                        <div className="relative">
                          <textarea
                            id="complaint-details"
                            rows={3}
                            maxLength={DETAILS_MAX}
                            value={form.description}
                            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                            className={`${INPUT} resize-none pb-5`}
                            placeholder="Describe your issue in detail..."
                          />
                          <span className="pointer-events-none absolute bottom-2 right-2.5 text-[10px] text-slate-400">{form.description.length}/{DETAILS_MAX}</span>
                        </div>
                      </div>

                      <div>
                        <p className="mb-1 text-xs font-medium text-[#0b1446]">Priority <span className="text-rose-500">*</span></p>
                        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Priority">
                          {PRIORITY_OPTIONS.map((option) => {
                            const active = form.priority === option.value;
                            const tone = PRIORITY_TONE[option.value];
                            return (
                              <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setForm((prev) => ({ ...prev, priority: option.value }))}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${tone.chip} ${active ? `ring-2 ${tone.ring}` : ''}`}
                              >
                                <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full ${tone.dot}`}>
                                  {active ? <Check size={9} className="text-white" strokeWidth={4} /> : null}
                                </span>
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {children.length > 0 && (
                        <div>
                          <label htmlFor="complaint-child" className="mb-1 block text-xs font-medium text-[#0b1446]">
                            Related child {isAcademicCategory ? '(required for academic issues)' : '(optional)'}
                          </label>
                          <div className="relative flex items-center gap-2.5 rounded-lg border border-slate-200 px-2.5 py-1.5">
                            {selectedChild?.profilePic ? (
                              <img src={selectedChild.profilePic} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                            ) : (
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-violet-600">
                                {String(selectedChild?.name || 'C').charAt(0).toUpperCase()}
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-[#0b1446]">{selectedChild?.name || 'Select child'}</p>
                              {selectedChild ? <p className="truncate text-[11px] text-slate-500">{childLine(selectedChild)}</p> : null}
                            </div>
                            <ChevronDown size={16} className="shrink-0 text-slate-500" />
                            <select
                              id="complaint-child"
                              value={form.studentId}
                              onChange={(e) => setForm((prev) => ({ ...prev, studentId: e.target.value }))}
                              className="absolute inset-0 cursor-pointer opacity-0"
                            >
                              {!isAcademicCategory ? <option value="">No specific child</option> : null}
                              {children.map((child) => (
                                <option key={child.studentId} value={child.studentId}>
                                  {formatStudentDisplay({
                                    name: child.name,
                                    username: child.username,
                                    studentCode: child.studentCode,
                                    admissionNumber: child.admissionNumber,
                                    studentId: child.studentId,
                                    roll: child.roll || child.rollNo || child.rollNumber,
                                    section: child.section,
                                  })}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                      {isAcademicCategory && !children.length && (
                        <p className="text-[11px] text-violet-600">No linked children were found, so this complaint will be forwarded to the school admin.</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-100 px-4 py-3">
                  {submissionError && (
                    <p role="alert" className="mb-2 flex items-center gap-2 text-xs text-rose-600"><AlertCircle size={14} /> {submissionError}</p>
                  )}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => setShowCreate(false)} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button>
                    <motion.button
                      type="submit"
                      disabled={submitting}
                      whileTap={{ scale: 0.99 }}
                      className="flex items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      {submitting ? 'Submitting…' : 'Submit'}
                    </motion.button>
                  </div>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

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
                aria-labelledby="complaint-detail-title"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border bg-white shadow-xl"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500">Ticket #{detail.ticketNumber}</p>
                    <h2 id="complaint-detail-title" className="truncate text-base font-bold text-[#0b1446]">{detail.title}</h2>
                  </div>
                  <button type="button" onClick={() => setDetail(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
                </div>
                <div className="space-y-3 overflow-y-auto p-4 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    {statusChip(detail.status)}
                    {priorityChip(detail.priority)}
                    <span className={`rounded-full px-3 py-0.5 text-[11px] font-medium ${CATEGORY_TONE[detail.category] || 'bg-slate-100 text-slate-600'}`}>{detail.category}</span>
                  </div>
                  <div>
                    <p className="mb-1 font-semibold text-[#0b1446]">Details</p>
                    <p className="whitespace-pre-line text-slate-600">{detail.description}</p>
                  </div>
                  <dl className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1.5">
                    <dt className="text-slate-500">Assigned to</dt><dd className="text-slate-800">{resolveAssignee(detail)}</dd>
                    {detail.studentName ? (<><dt className="text-slate-500">Child</dt><dd className="text-slate-800">{detail.studentName}{detail.studentSection ? ` • Section ${detail.studentSection}` : ''}</dd></>) : null}
                    <dt className="text-slate-500">Raised on</dt><dd className="text-slate-800">{fmtDate(detail.createdAt) || '—'}</dd>
                    <dt className="text-slate-500">Last updated</dt><dd className="text-slate-800">{fmtDate(detail.updatedAt) || '—'}</dd>
                  </dl>
                  {detail.resolutionNotes ? (
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                      <p className="mb-1 font-semibold text-emerald-700">Response from school</p>
                      <p className="whitespace-pre-line text-emerald-800">{detail.resolutionNotes}</p>
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

export default ComplaintManagementSystem;
