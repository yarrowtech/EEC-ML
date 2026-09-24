import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  ListFilter,
  LogOut,
  Award,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  UserX,
  X,
} from 'lucide-react';
import StudentPromotion from './StudentPromotion';
import LeavingCertificates from './LeavingCertificates';
import { invalidateCache, readCache, writeCache } from '../../utils/swrCache';
import useFitViewportHeight from '../../hooks/useFitViewportHeight';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const PAGE_SIZE = 12;
const LEFT_CACHE_KEY = 'left-students:list';

const authHeader = () => ({
  'Content-Type': 'application/json',
  authorization: `Bearer ${localStorage.getItem('token')}`,
});

const resolvePhotoUrl = (value) => {
  const src = String(value || '').trim();
  if (!src) return '';
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  return `${API_BASE}/${src.replace(/^\/+/, '')}`;
};

// dd/mm/yyyy for real dates; free-text values (e.g. a typed TC date) pass through.
const formatDMY = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB');
};

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// Leave & Left Students: the "Leave Management" tab marks and processes
// departures (embedded StudentPromotion leave section); the "Left Students"
// tab lists finalized (status "Left") students with their TC details.
// eslint-disable-next-line react/prop-types
const LeftStudents = ({ setShowAdminHeader }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = tabParam === 'leave' || tabParam === 'certificates' ? tabParam : 'left';
  const switchTab = (next) => setSearchParams(next === 'left' ? {} : { tab: next }, { replace: true });
  // Paint the last list instantly from the client cache, then revalidate.
  const [students, setStudents] = useState(() => readCache(LEFT_CACHE_KEY) || []);
  const [loading, setLoading] = useState(() => !readCache(LEFT_CACHE_KEY));
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [restoringId, setRestoringId] = useState('');

  useEffect(() => {
    setShowAdminHeader?.(true);
  }, [setShowAdminHeader]);

  // force → skip both caches (after restore / Refresh), so the list is exact.
  const fetchLeft = useCallback(async ({ force = false } = {}) => {
    const cached = force ? null : readCache(LEFT_CACHE_KEY);
    if (cached) setStudents(cached);
    else setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${API_BASE}/api/promotion/leaving-students?status=Left${force ? '&fresh=1' : ''}`,
        { headers: authHeader() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to load left students');
      const list = Array.isArray(data.students) ? data.students : [];
      writeCache(LEFT_CACHE_KEY, list);
      setStudents(list);
    } catch (err) {
      if (!cached) setError(err.message || 'Unable to load left students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeft(); }, [fetchLeft]);

  const classOptions = useMemo(
    () => [...new Set(students.map((s) => s.grade).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'en', { numeric: true })),
    [students]
  );
  const sectionOptions = useMemo(
    () => [...new Set(students.filter((s) => !classFilter || s.grade === classFilter).map((s) => s.section).filter(Boolean))].sort(),
    [students, classFilter]
  );
  const sessionOptions = useMemo(
    () => [...new Set(students.map((s) => s.academicYear).filter(Boolean))].sort().reverse(),
    [students]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) =>
      (!q || [s.name, s.studentCode, s.admissionNumber, s.fatherName, s.guardianName, s.transferCertificateNo]
        .some((v) => String(v || '').toLowerCase().includes(q))) &&
      (!classFilter || s.grade === classFilter) &&
      (!sectionFilter || s.section === sectionFilter) &&
      (!sessionFilter || s.academicYear === sessionFilter)
    );
  }, [students, search, classFilter, sectionFilter, sessionFilter]);

  useEffect(() => { setPage(1); }, [search, classFilter, sectionFilter, sessionFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeFilterCount = [classFilter, sectionFilter, sessionFilter].filter(Boolean).length;

  // ── Selection + bulk restore (server-side job, real % progress) ──
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkJob, setBulkJob] = useState(null); // { total, done, failed, percent, status } while running
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => students.some((s) => s._id === id)));
  }, [students]);
  const filteredIds = useMemo(() => filtered.map((s) => s._id), [filtered]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
  const toggleSelected = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () =>
    setSelectedIds((prev) => (allSelected
      ? prev.filter((id) => !filteredIds.includes(id))
      : [...new Set([...prev, ...filteredIds])]));

  // Warn before refresh/close while the server is still restoring.
  useEffect(() => {
    if (!bulkJob) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [bulkJob]);

  const handleBulkRestore = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const confirm = await Swal.fire({
      icon: 'question',
      title: 'Restore Selected',
      text: `Restore ${ids.length} student(s) back to Active status?`,
      showCancelButton: true,
      confirmButtonText: 'Yes, Restore',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
    });
    if (!confirm.isConfirmed) return;

    setBulkJob({ total: ids.length, done: 0, failed: 0, percent: 0, status: 'running' });
    try {
      const startRes = await fetch(`${API_BASE}/api/promotion/bulk-restore`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ studentIds: ids }),
      });
      const start = await startRes.json().catch(() => ({}));
      if (!startRes.ok) throw new Error(start?.error || 'Failed to start bulk restore');

      // Poll the server for the job's real progress.
      let job = { total: ids.length, done: 0, failed: 0, percent: 0, status: 'running' };
      while (job.status !== 'completed') {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 600));
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch(`${API_BASE}/api/promotion/bulk-restore/${start.jobId}`, { headers: authHeader() });
        // eslint-disable-next-line no-await-in-loop
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Lost track of the restore job');
        job = data;
        setBulkJob(data);
      }
      setSelectedIds([]);
      Swal.fire({
        icon: job.failed ? 'warning' : 'success',
        title: 'Restore Complete',
        text: `${job.restored} student(s) restored${job.failed ? `, ${job.failed} failed` : ''}.`,
        confirmButtonColor: '#6366f1',
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#6366f1' });
    } finally {
      setBulkJob(null);
      invalidateCache('left-students');
      fetchLeft({ force: true });
    }
  };

  const handleRestore = async (student) => {
    const confirm = await Swal.fire({
      icon: 'question',
      title: 'Restore Student',
      text: `Restore ${student.name} back to Active status?`,
      showCancelButton: true,
      confirmButtonText: 'Yes, Restore',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
    });
    if (!confirm.isConfirmed) return;
    setRestoringId(student._id);
    try {
      const res = await fetch(`${API_BASE}/api/promotion/restore-student/${student._id}`, { method: 'PUT', headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to restore.');
      Swal.fire({ icon: 'success', title: 'Restored', text: data.message, confirmButtonColor: '#6366f1' });
      setSelected(null);
      invalidateCache('left-students');
      fetchLeft({ force: true });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#6366f1' });
    } finally {
      setRestoringId('');
    }
  };

  const exportCsv = () => {
    const header = ['Name', 'Student Code', 'Admission No', 'Class', 'Section', 'Session', 'Father', 'Guardian Phone', 'Reason', 'TC No', 'TC Date', 'Remarks'];
    const rows = filtered.map((s) => [
      s.name, s.studentCode, s.admissionNumber, s.grade, s.section, s.academicYear, s.fatherName,
      s.guardianPhone, s.reasonForLeaving, s.transferCertificateNo, s.transferCertificateDate, s.remarks,
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `left-students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-300/40 focus:border-rose-300';

  const fit = useFitViewportHeight();

  return (
    <div
      ref={fit.ref}
      style={fit.style}
      // Every tab fits the viewport (measured height; calc classes are the
      // pre-measure fallback) — only the list inside each card scrolls.
      className="flex h-[calc(100dvh-94px)] md:h-[calc(100dvh-150px)] lg:h-[calc(100dvh-94px)] flex-col gap-3 md:gap-4 overflow-hidden bg-gray-50 p-3 md:p-5"
    >
      {/* Full-page blocking overlay while the server restores students */}
      {bulkJob && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="alertdialog" aria-live="assertive" aria-busy="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-500" />
            <h3 className="mt-4 text-lg font-bold text-gray-900">Restoring students…</h3>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-emerald-600">{bulkJob.percent || 0}%</p>
            <p className="text-sm text-gray-500">
              {bulkJob.done || 0} of {bulkJob.total || 0} processed
              {bulkJob.failed ? ` · ${bulkJob.failed} failed` : ''}
            </p>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${bulkJob.percent || 0}%` }}
              />
            </div>
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              Restoring students — please do not refresh the page or close the window.
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-500 shadow-sm md:h-11 md:w-11">
            <UserX className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-gray-900 md:text-2xl">Leave &amp; Left Students</h1>
            <p className="hidden truncate text-sm text-gray-500 sm:block">Mark students as leaving, finalize departures and view left students with TC details</p>
          </div>
        </div>
        {/* Icon-only below lg (tablet / phone); icon + label on laptop & desktop. */}
        <div className={`shrink-0 items-center gap-2 ${tab === 'left' ? 'flex' : 'hidden'}`}>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!filtered.length}
            title="Export CSV"
            aria-label="Export CSV"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 text-sm font-semibold text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50 lg:px-4"
          >
            <Download className="h-4 w-4" /> <span className="hidden lg:inline">Export</span>
          </button>
          <button
            type="button"
            onClick={() => fetchLeft({ force: true })}
            disabled={loading}
            title="Refresh"
            aria-label="Refresh"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 text-sm font-semibold text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-60 lg:px-4"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> <span className="hidden lg:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs: process departures (Leave Management) | finalized list (Left Students) */}
      <div className="flex shrink-0 items-center gap-5 overflow-x-auto border-b border-gray-200 md:gap-6">
        {[
          { key: 'leave', label: 'Leave Management', icon: LogOut },
          { key: 'left', label: `Left Students${students.length ? ` (${students.length})` : ''}`, icon: UserX },
          { key: 'certificates', label: 'Leaving Certificates', icon: Award },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            className={`relative -mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition-colors ${
              tab === key ? 'border-rose-500 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'certificates' && <LeavingCertificates />}

      {tab === 'leave' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <StudentPromotion section="leave" onShowLeft={() => { invalidateCache('left-students'); switchTab('left'); fetchLeft({ force: true }); }} />
        </div>
      )}

      {tab === 'left' && (
      <>
      {/* Summary */}
      <div className="grid shrink-0 grid-cols-2 gap-3 md:gap-4">
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Total Left</p>
          <p className="text-xl font-bold text-gray-900 tabular-nums md:text-2xl">{students.length}</p>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            <span className="hidden sm:inline">With Transfer Certificate</span><span className="sm:hidden">With TC</span>
          </p>
          <p className="text-xl font-bold text-emerald-600 tabular-nums md:text-2xl">{students.filter((s) => s.transferCertificateNo).length}</p>
        </div>
        {/* <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pending Leave</p>
          <button
            type="button"
            onClick={() => switchTab('leave')}
            className="mt-1 text-sm font-semibold text-indigo-600 hover:underline"
          >
            Open Leave Management →
          </button>
        </div> */}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Search + filters */}
        <div className="shrink-0 space-y-3 border-b border-gray-100 p-3 md:p-4">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-full border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300/40 focus:border-rose-300"
                placeholder="Search by name, student code, admission no, father or TC no"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
                showFilters ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
              aria-label={showFilters ? 'Close filters' : 'Show filters'}
            >
              {showFilters ? <X className="h-4 w-4" /> : <ListFilter className="h-4 w-4" />}
              {!showFilters && activeFilterCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500" />
              )}
            </button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} className={selectCls}>
                <option value="">All Sessions</option>
                {sessionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setSectionFilter(''); }} className={selectCls}>
                <option value="">All Classes</option>
                {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className={selectCls}>
                <option value="">All Sections</option>
                {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
        )}

        {/* Bulk actions */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/60 px-4 py-2.5">
            <span className="text-sm font-semibold text-emerald-800">
              {selectedIds.length} selected
              <button type="button" onClick={() => setSelectedIds([])} className="ml-3 text-xs font-medium text-gray-500 hover:underline">
                Clear
              </button>
            </span>
            <button
              type="button"
              onClick={handleBulkRestore}
              disabled={Boolean(bulkJob)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore Selected ({selectedIds.length})
            </button>
          </div>
        )}

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = selectedIds.length > 0 && !allSelected; }}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 text-rose-600 focus:ring-rose-400"
                    aria-label="Select all left students"
                  />
                </th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Session</th>
                {/* <th className="px-4 py-3">Reason</th> */}
                <th className="px-4 py-3">TC No.</th>
                <th className="px-4 py-3">TC Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="py-16 text-center text-gray-400">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-rose-500" />Loading left students…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center">
                  <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  <p className="font-semibold text-gray-500">No left students found</p>
                  <p className="text-xs text-gray-400">Students appear here once they are marked as Left in Leave Management.</p>
                </td></tr>
              ) : paged.map((s) => {
                const photo = resolvePhotoUrl(s.profilePic);
                const initials = (s.name || 'S').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <tr key={s._id} className={selectedIds.includes(s._id) ? "bg-rose-50/60" : "hover:bg-rose-50/30"}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s._id)}
                        onChange={() => toggleSelected(s._id)}
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 text-rose-600 focus:ring-rose-400"
                        aria-label={`Select ${s.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-rose-100 text-xs font-bold text-rose-600">
                          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : initials}
                        </div>
                        <div className="min-w-0">
                          <p className="whitespace-nowrap font-semibold text-gray-800">{s.name}</p>
                          <p className="text-[11px] font-mono text-gray-400">{s.studentCode || s.admissionNumber || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{[s.grade, s.section].filter(Boolean).join('-') || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{s.academicYear || '—'}</td>
                    {/* <td className="max-w-[180px] truncate px-4 py-3 text-gray-600" title={s.reasonForLeaving}>{s.reasonForLeaving || '—'}</td> */}
                    <td className="px-4 py-3 text-gray-600">{s.transferCertificateNo || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDMY(s.transferCertificateDate)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelected(s)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRestore(s)}
                          disabled={restoringId === s._id}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {restoringId === s._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          Restore
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex shrink-0 flex-col items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5 sm:flex-row">
            <p className="text-xs text-gray-500">
              Showing <b className="text-gray-700">{(safePage - 1) * PAGE_SIZE + 1}</b>–<b className="text-gray-700">{Math.min(safePage * PAGE_SIZE, filtered.length)}</b> of <b className="text-gray-700">{filtered.length}</b>
            </p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40" aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs font-semibold text-gray-600">{safePage} / {pageCount}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={safePage >= pageCount}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40" aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* Details modal — landscape: header strip + Student | Family | Leaving columns */}
      {selected && (() => {
        const photo = resolvePhotoUrl(selected.profilePic);
        const hasParents = String(selected.fatherName || '').trim() || String(selected.motherName || '').trim();
        const Field = ({ label, value, wide = false }) => (
          <div className={`min-w-0 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-1.5 ${wide ? 'col-span-2' : ''}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
            {String(value ?? '').trim()
              ? <p className="truncate text-sm font-medium text-gray-800" title={String(value)}>{value}</p>
              : <p className="text-sm italic text-gray-400">Not recorded</p>}
          </div>
        );
        const Section = ({ title, children }) => (
          <section className="min-w-0">
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">{title}</h4>
            <div className="grid grid-cols-2 gap-2">{children}</div>
          </section>
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm" onClick={() => setSelected(null)}>
            <div
              className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header strip */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-rose-50/70 to-transparent px-4 py-3 md:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-rose-100 text-base font-bold text-rose-600">
                    {photo
                      ? <img src={photo} alt="" className="h-full w-full object-cover" />
                      : (selected.name || 'S').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-bold text-gray-900 md:text-lg">{selected.name}</h3>
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Left</span>
                    </div>
                    <p className="truncate text-xs text-gray-500 md:text-sm">
                      {[selected.grade, selected.section].filter(Boolean).join('-') || '—'}
                      {selected.academicYear ? ` · ${selected.academicYear}` : ''}
                      {selected.transferCertificateNo ? ` · ${selected.transferCertificateNo}` : ''}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body: 3 columns on laptop/desktop, 2 on tablet, 1 on phone */}
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 md:grid-cols-2 md:p-5 lg:grid-cols-3 lg:divide-x lg:divide-gray-100 lg:[&>*:not(:first-child)]:pl-4">
                <Section title="Student">
                  <Field label="Student Code" value={selected.studentCode} wide />
                  <Field label="Admission No" value={selected.admissionNumber} />
                  <Field label="Admission Date" value={selected.admissionDate ? formatDMY(selected.admissionDate) : ''} />
                  <Field label="Roll No" value={selected.roll} />
                  <Field label="Mobile" value={selected.mobile} />
                  <Field label="Email" value={selected.email} wide />
                </Section>

                <Section title="Family">
                  <Field label="Father" value={selected.fatherName} wide />
                  <Field label="Mother" value={selected.motherName} wide />
                  {!hasParents && (
                    <p className="col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      Parent names weren&apos;t entered for this student, so they print blank on the certificate.
                    </p>
                  )}
                </Section>

                <Section title="Leaving Details">
                  <Field label="Reason for Leaving" value={selected.reasonForLeaving} wide />
                  <Field label="Certificate No." value={selected.transferCertificateNo} />
                  <Field label="TC Date" value={selected.transferCertificateDate ? formatDMY(selected.transferCertificateDate) : ''} />
                  <Field label="Date Left" value={selected.leftAt ? formatDMY(selected.leftAt) : ''} />
                  <Field label="Certificate Issued" value={selected.leavingCertificateIssuedAt ? formatDMY(selected.leavingCertificateIssuedAt) : ''} />
                  <div className="col-span-2 min-w-0 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Remarks</p>
                    <p className="line-clamp-2 text-sm font-medium text-gray-800" title={selected.remarks || ''}>{selected.remarks || '—'}</p>
                  </div>
                </Section>
              </div>

              {/* Footer */}
              <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 px-4 py-3 md:px-5">
                <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleRestore(selected)}
                  disabled={restoringId === selected._id}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {restoringId === selected._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Restore to Active
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default LeftStudents;
