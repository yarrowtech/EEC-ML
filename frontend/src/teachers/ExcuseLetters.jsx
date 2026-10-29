import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle, XCircle, FileText, Eye, Calendar,
  User, Phone, RefreshCw, X, AlertCircle, Clock, Mail, ChevronLeft, ChevronRight, SlidersHorizontal,
} from 'lucide-react';

const STATUS_CFG = {
  approved: { label: 'Approved', bg: 'bg-green-600', text: 'text-white', dot: 'bg-emerald-100', accent: 'border-l-emerald-500' },
  rejected:  { label: 'Rejected', bg: 'bg-rose-600',   text: 'text-rose-100',   dot: 'bg-rose-500',   accent: 'border-l-rose-500'   },
  pending:   { label: 'Pending',  bg: 'bg-amber-600',  text: 'text-amber-100',  dot: 'bg-amber-500',  accent: 'border-l-amber-500'  },
};

const REASON_LABELS = {
  illness:     'Illness / Medical',
  family:      'Family Emergency',
  personal:    'Personal Reasons',
  travel:      'Travel / Vacation',
  appointment: 'Medical Appointment',
  other:       'Other',
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const daysBetween = (from, to) =>
  Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);

const TABS = [
  { key: 'all',      label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const CACHE_KEY = 'teacher_excuse_letters_v1';
const readCachedLetters = () => {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '[]');
    return Array.isArray(cached) ? cached : [];
  } catch {
    return [];
  }
};
const writeCachedLetters = (list) => {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
};

const StudentAvatar = ({ name, photo }) => {
  const [broken, setBroken] = useState(false);
  const url = typeof photo === 'string' ? photo : photo?.secure_url || photo?.url || '';
  if (url && !broken) {
    return <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-gray-200" />;
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-600">
      {String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
    </span>
  );
};

const ExcuseLetters = () => {
  const API_BASE = useMemo(
    () => (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '').replace(/\/api$/, ''),
    []
  );
  const [letters, setLetters]       = useState(readCachedLetters);
  // Skeleton only on a first visit with nothing cached; later loads refresh in place.
  const [loading, setLoading]       = useState(() => readCachedLetters().length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [previewLetter, setPreviewLetter] = useState(null);
  const [activeFilter, setActiveFilter]   = useState('all');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadLetters = async () => {
    try {
      setRefreshing(true);
      setError('');
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/excuse-letters/teacher`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Unable to load letters');
      const list = Array.isArray(data) ? data : [];
      setLetters(list);
      writeCachedLetters(list);
    } catch (err) {
      setError(err.message || 'Unable to load letters');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadLetters(); }, []);

  const updateStatus = async (id, status) => {
    try {
      setUpdatingId(id);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/excuse-letters/teacher/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to update');
      // Keep fields the update response doesn't carry (e.g. the student's photo).
      setLetters((prev) => {
        const next = prev.map((l) => (l._id === id ? { ...l, ...data } : l));
        writeCachedLetters(next);
        return next;
      });
      if (previewLetter?._id === id) setPreviewLetter((prev) => ({ ...prev, ...data }));
    } catch (err) {
      setError(err.message || 'Unable to update');
    } finally {
      setUpdatingId('');
    }
  };

  // Date filter: keep letters whose leave period overlaps the chosen range.
  const datedLetters = useMemo(() => {
    if (!dateFrom && !dateTo) return letters;
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
    return letters.filter((l) => {
      const start = new Date(l.dateFrom);
      const end = new Date(l.dateTo || l.dateFrom);
      return (!from || end >= from) && (!to || start <= to);
    });
  }, [letters, dateFrom, dateTo]);

  const stats = useMemo(() => ({
    total:    datedLetters.length,
    pending:  datedLetters.filter(l => (l.status || 'pending') === 'pending').length,
    approved: datedLetters.filter(l => l.status === 'approved').length,
    rejected: datedLetters.filter(l => l.status === 'rejected').length,
  }), [datedLetters]);

  const filteredLetters = useMemo(
    () => activeFilter === 'all' ? datedLetters : datedLetters.filter(l => (l.status || 'pending') === activeFilter),
    [datedLetters, activeFilter]
  );

  // The page fills the space below the portal header and never scrolls; the table shows as
  // many rows as fit and the rest go to the next page.
  const ROW_HEIGHT = 58;
  const pageRef = useRef(null);
  const tableAreaRef = useRef(null);
  const [pageHeight, setPageHeight] = useState(null);
  const [pageSize, setPageSize] = useState(6);
  const [page, setPage] = useState(1);
  useLayoutEffect(() => {
    const measure = () => {
      const top = pageRef.current?.getBoundingClientRect().top ?? 0;
      setPageHeight(Math.max(420, window.innerHeight - Math.max(0, top)));
      const area = tableAreaRef.current?.clientHeight || 0;
      if (area) setPageSize(Math.max(3, Math.floor((area - 42) / ROW_HEIGHT)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (tableAreaRef.current) observer.observe(tableAreaRef.current);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [loading, Boolean(error), filteredLetters.length > 0, showDateFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredLetters.length / pageSize));
  useEffect(() => { setPage(1); }, [activeFilter, dateFrom, dateTo]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const pagedLetters = filteredLetters.slice((page - 1) * pageSize, page * pageSize);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-white rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-12 bg-white rounded-2xl animate-pulse" />
        {[1,2,3].map(i => <div key={i} className="h-40 bg-white rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div ref={pageRef} className="flex flex-col gap-3 overflow-hidden p-3 sm:p-4 lg:p-6" style={pageHeight ? { height: pageHeight } : undefined}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center shrink-0">
            <FileText size={20} className="text-amber-100" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Excuse Letters</h1>
            <p className="text-xs text-gray-500">Review and approve student leave requests</p>
          </div>
        </div>
        <button
          onClick={loadLetters}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin text-indigo-500' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Letters', value: stats.total,    gradient: 'from-indigo-500 to-violet-500' },
          { label: 'Pending',       value: stats.pending,  gradient: 'from-amber-400 to-orange-500'  },
          { label: 'Approved',      value: stats.approved, gradient: 'from-emerald-500 to-teal-500'  },
          { label: 'Rejected',      value: stats.rejected, gradient: 'from-rose-500 to-pink-500'     },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
            <div className={`w-8 h-1.5 rounded-full bg-linear-to-r ${s.gradient} mb-2`} />
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Table card ─────────────────────────────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white">
        {refreshing && <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-indigo-100"><div className="h-full w-1/3 animate-[excuse-progress_1s_ease-in-out_infinite] bg-indigo-500" /></div>}
        {/* Filter tabs */}
        <div className="flex shrink-0 items-center border-b border-gray-100 px-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(tab => {
            const count = tab.key === 'all' ? stats.total : stats[tab.key];
            const active = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
          <button
            type="button"
            onClick={() => setShowDateFilter((open) => !open)}
            title="Filter by date"
            aria-label="Filter by date"
            aria-expanded={showDateFilter}
            className={`relative ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${showDateFilter ? 'border-indigo-200 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            <SlidersHorizontal size={15} />
            {(dateFrom || dateTo) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-500" />}
          </button>
        </div>

        {showDateFilter && (
          <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-gray-100 bg-gray-50/60 px-4 py-2.5">
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium text-gray-500">From</span>
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-[13px] text-gray-700 outline-none focus:border-indigo-400" />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium text-gray-500">To</span>
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)}
                className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-[13px] text-gray-700 outline-none focus:border-indigo-400" />
            </label>
            <p className="pb-1.5 text-[11px] text-gray-400">Shows letters whose leave falls in this range.</p>
            {(dateFrom || dateTo) && (
              <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} className="ml-auto pb-1.5 text-[12px] font-semibold text-indigo-600 hover:underline">Clear dates</button>
            )}
          </div>
        )}

        <div ref={tableAreaRef} className="min-h-0 flex-1 overflow-hidden">
          {filteredLetters.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                <FileText size={22} className="text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-500">
                {activeFilter === 'all' ? 'No excuse letters yet' : `No ${activeFilter} letters`}
              </p>
              <p className="text-xs text-gray-400 mt-1">Letters submitted by parents will appear here</p>
            </div>
          ) : (
            <div className="h-full overflow-x-auto overflow-y-hidden">
              <table className="w-full min-w-[860px] text-left">
                <thead>
                  <tr className="bg-gray-100 text-[12px] font-semibold text-gray-600">
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Leave Dates</th>
                    <th className="px-3 py-2.5">Reason</th>
                    <th className="px-3 py-2.5">Parent</th>
                    <th className="px-3 py-2.5">Submitted</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedLetters.map((letter) => {
                    const status = letter.status || 'pending';
                    const cfg    = STATUS_CFG[status] || STATUS_CFG.pending;
                    const days   = daysBetween(letter.dateFrom, letter.dateTo);
                    const reasonLabel = REASON_LABELS[letter.reasonType] || letter.reasonType || 'Other';
                    const isBusy = updatingId === letter._id;
                    return (
                      <tr key={letter._id} className="align-middle hover:bg-gray-50/70" style={{ height: ROW_HEIGHT }}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2.5">
                            <StudentAvatar name={letter.studentName} photo={letter.studentPhoto} />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-gray-900">{letter.studentName}</p>
                              <p className="text-[11px] text-gray-500">
                                Class {letter.className}{letter.sectionName && `-${letter.sectionName}`}{letter.rollNumber ? ` · Roll ${letter.rollNumber}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[12px] text-gray-700">
                          <p className="flex items-center gap-1.5 whitespace-nowrap"><Calendar size={12} className="text-indigo-500" />{fmtDate(letter.dateFrom)} → {fmtDate(letter.dateTo)}</p>
                          <span className="mt-0.5 inline-block rounded-full bg-indigo-600 px-1.5 py-px text-[11px] font-semibold text-indigo-100">{days} day{days > 1 ? 's' : ''}</span>
                        </td>
                        <td className="max-w-[220px] px-3 py-2">
                          <span className="inline-block rounded-full bg-amber-600 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-100">{reasonLabel}</span>
                          <p className="truncate text-[12px] text-gray-600" title={letter.reason}>{letter.reason}</p>
                        </td>
                        <td className="px-3 py-2 text-[12px]">
                          <p className="truncate font-medium text-gray-800">{letter.parentName || '—'}</p>
                          {letter.parentPhone && <p className="flex items-center gap-1 text-[11px] text-gray-500"><Phone size={10} />{letter.parentPhone}</p>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-[12px] text-gray-500">{fmtDate(letter.createdAt)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setPreviewLetter(letter)} title="View letter" aria-label="View letter"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-indigo-50 hover:text-indigo-600">
                              <Eye size={15} />
                            </button>
                            <button onClick={() => updateStatus(letter._id, 'approved')} disabled={isBusy || status === 'approved'} title="Approve" aria-label="Approve"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent">
                              {isBusy ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={16} />}
                            </button>
                            <button onClick={() => updateStatus(letter._id, 'rejected')} disabled={isBusy || status === 'rejected'} title="Reject" aria-label="Reject"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent">
                              <XCircle size={16} />
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
        {filteredLetters.length > 0 && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 px-4 py-2 text-[12px] text-gray-500">
            <span>
              Showing <b className="text-gray-700">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredLetters.length)}</b> of <b className="text-gray-700">{filteredLetters.length}</b>
            </span>
            <div className="flex items-center gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft size={15} /></button>
              {Array.from({ length: pageCount }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === pageCount || Math.abs(n - page) <= 1)
                .map((n, i, arr) => (
                  <React.Fragment key={n}>
                    {i > 0 && n - arr[i - 1] > 1 && <span className="px-0.5">…</span>}
                    <button type="button" onClick={() => setPage(n)}
                      className={`h-7 min-w-7 rounded-md px-2 text-[12px] font-semibold ${n === page ? 'bg-indigo-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{n}</button>
                  </React.Fragment>
                ))}
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} aria-label="Next page"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"><ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── Preview modal ──────────────────────────────────────────────────── */}
      {previewLetter && (() => {
        const letter = previewLetter;
        const status = letter.status || 'pending';
        const cfg    = STATUS_CFG[status] || STATUS_CFG.pending;
        const reasonLabel = REASON_LABELS[letter.reasonType] || letter.reasonType || 'Other';
        const isBusy = updatingId === letter._id;
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-indigo-600" />
                  <h3 className="text-sm font-bold text-gray-900">Excuse Letter</h3>
                  <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>
                <button onClick={() => setPreviewLetter(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Modal body — formal letter */}
              <div className="overflow-y-auto flex-1 px-6 py-5">
                {/* Letterhead */}
                <div className="text-center mb-6 pb-4 border-b border-gray-100">
                  <p className="text-base font-bold text-gray-900">{letter.schoolName || 'School'}</p>
                  {letter.schoolAddress && (
                    <p className="text-xs text-gray-500 mt-0.5">{letter.schoolAddress}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">Leave Application</p>
                </div>

                <div className="space-y-4 text-sm text-gray-700">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Date: {fmtDate(letter.createdAt || Date.now())}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {reasonLabel}
                    </span>
                  </div>

                  <div>
                    <p className="font-medium text-gray-600 text-xs mb-0.5">To,</p>
                    <p>The Principal / Class Teacher</p>
                    <p className="text-gray-500">{letter.schoolName || 'School'}</p>
                    {letter.schoolAddress && <p className="text-gray-500">{letter.schoolAddress}</p>}
                  </div>

                  <div>
                    <p className="font-semibold text-gray-900 underline underline-offset-2 text-center">
                      Subject: Request for Leave of Absence
                    </p>
                  </div>

                  <div className="leading-relaxed">
                    <p>Dear Sir/Madam,</p>
                    <p className="mt-2">
                      I am writing to inform you that my ward,{' '}
                      <span className="font-semibold text-gray-900">{letter.studentName}</span>, studying in{' '}
                      Class {letter.className}{letter.sectionName ? `-${letter.sectionName}` : ''}{letter.rollNumber ? `, Roll No. ${letter.rollNumber}` : ''},
                      will not be able to attend school from{' '}
                      <span className="font-semibold text-gray-900">{fmtDate(letter.dateFrom)}</span> to{' '}
                      <span className="font-semibold text-gray-900">{fmtDate(letter.dateTo)}</span>{' '}
                      ({daysBetween(letter.dateFrom, letter.dateTo)} day{daysBetween(letter.dateFrom, letter.dateTo) > 1 ? 's' : ''}).
                    </p>
                    <p className="mt-2">
                      <span className="font-medium text-gray-600">Reason:</span> {letter.reason}
                    </p>
                    {letter.additionalNotes && (
                      <p className="mt-1">
                        <span className="font-medium text-gray-600">Additional notes:</span> {letter.additionalNotes}
                      </p>
                    )}
                    <p className="mt-3">
                      I kindly request you to grant permission for the leave and excuse the absence.
                    </p>
                    <p className="mt-1">Thank you for your consideration.</p>
                  </div>

                  <div className="pt-2">
                    <p>Yours sincerely,</p>
                    <p className="font-semibold text-gray-900 mt-1">{letter.parentName || 'Parent/Guardian'}</p>
                    <p className="text-gray-500 text-xs">Parent / Guardian</p>
                  </div>

                  {(letter.parentEmail || letter.parentPhone || letter.emergencyContact) && (
                    <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-xs">
                      <p className="font-semibold text-gray-600 mb-1">Contact Details</p>
                      {letter.parentEmail && (
                        <p className="flex items-center gap-1.5 text-gray-600">
                          <Mail size={11} className="text-gray-400" /> {letter.parentEmail}
                        </p>
                      )}
                      {letter.parentPhone && (
                        <p className="flex items-center gap-1.5 text-gray-600">
                          <Phone size={11} className="text-gray-400" /> {letter.parentPhone}
                        </p>
                      )}
                      {letter.emergencyContact && (
                        <p className="flex items-center gap-1.5 text-gray-600">
                          <Phone size={11} className="text-red-400" /> Emergency: {letter.emergencyContact}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal footer — actions */}
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                <button
                  onClick={() => setPreviewLetter(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Close
                </button>
                {status !== 'rejected' && (
                  <button
                    onClick={() => updateStatus(letter._id, 'rejected')}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60 transition-colors"
                  >
                    <XCircle size={14} />
                    {isBusy ? 'Updating…' : 'Reject'}
                  </button>
                )}
                {status !== 'approved' && (
                  <button
                    onClick={() => updateStatus(letter._id, 'approved')}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                  >
                    <CheckCircle size={14} />
                    {isBusy ? 'Updating…' : 'Approve'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ExcuseLetters;
