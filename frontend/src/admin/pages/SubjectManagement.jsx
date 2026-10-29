import React, { useEffect, useMemo, useState } from 'react';
import {
  GraduationCap, Plus, Trash2, Edit3, X, Search,
  ChevronUp, ChevronDown, ChevronsUpDown, FolderOpen, Layers,
} from 'lucide-react';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || '';
const SUBJECT_MGMT_CACHE_PREFIX = 'subject_mgmt_cache_v1';
const SUBJECT_MGMT_CACHE_TTL_MS = 5 * 60 * 1000;

const getSubjectCacheStorage = () => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const getSubjectCacheScope = () => {
  const token = localStorage.getItem('token');
  if (!token) return 'anonymous';
  try {
    // Re-pad the base64url payload — an un-padded length isn't always a
    // multiple of 4, which would throw on a legitimately-valid token.
    const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/') || '';
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    const adminId = payload?.id || 'unknown';
    const schoolId = payload?.schoolId || 'school';
    const campusId = payload?.campusId || 'campus';
    return `${adminId}_${schoolId}_${campusId}`;
  } catch {
    // Scope the fallback to this token so a genuinely undecodable token
    // still can't collide with another admin's cached subject list on a
    // shared browser/tab (the previous bare 'fallback' key could).
    return `fallback_${token.slice(-16)}`;
  }
};

const getSubjectCacheKey = (segment) =>
  `${SUBJECT_MGMT_CACHE_PREFIX}:${segment}:${getSubjectCacheScope()}`;

const readSubjectCache = (key) => {
  const storage = getSubjectCacheStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cachedAt = Number(parsed?.cachedAt || 0);
    if (!cachedAt || Date.now() - cachedAt > SUBJECT_MGMT_CACHE_TTL_MS) {
      storage.removeItem(key);
      return null;
    }
    return parsed?.data ?? null;
  } catch {
    return null;
  }
};

const writeSubjectCache = (key, data) => {
  const storage = getSubjectCacheStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {
    // Ignore cache write failures.
  }
};

const SubjectManagement = ({ setShowAdminHeader }) => {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Filters
  const [activeClassId, setActiveClassId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', classId: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  // Edit modal
  const [editingSubject, setEditingSubject] = useState(null);

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Sorting
  const [sortConfig, setSortConfig] = useState({ field: 'name', order: 'asc' });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      authorization: token ? `Bearer ${token}` : '',
    };
  }, []);

  const apiRequest = async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders, ...options });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Request failed');
    return data;
  };

  const loadData = async () => {
    const cacheKey = getSubjectCacheKey('core');
    const cached = readSubjectCache(cacheKey);
    if (cached) {
      setClasses(Array.isArray(cached.classes) ? cached.classes : []);
      setSubjects(Array.isArray(cached.subjects) ? cached.subjects : []);
    }

    try {
      const [classData, subjectData] = await Promise.all([
        apiRequest('/api/academic/classes'),
        apiRequest('/api/academic/subjects'),
      ]);
      const nextClasses = Array.isArray(classData) ? classData : [];
      const nextSubjects = Array.isArray(subjectData) ? subjectData : [];
      setClasses(nextClasses);
      setSubjects(nextSubjects);
      writeSubjectCache(cacheKey, { classes: nextClasses, subjects: nextSubjects });
    } catch (err) {
      if (!cached) {
        toast.error(err.message || 'Failed to load data');
      } else {
        console.warn('Subject data fetch failed, showing cached data:', err);
      }
    }
  };

  useEffect(() => {
    setShowAdminHeader?.(false);
    loadData();
  }, [setShowAdminHeader]);

  /* ─── Derived data ─── */
  const classMap = useMemo(() => {
    const map = {};
    classes.forEach((c) => { map[c._id] = c.name; });
    return map;
  }, [classes]);

  const classTabs = useMemo(() => {
    const tabs = [{ id: 'all', name: 'All Classes' }];
    classes.forEach((cls) => tabs.push({ id: String(cls._id), name: cls.name }));
    return tabs;
  }, [classes]);

  const filteredSubjects = useMemo(() => {
    let list = subjects;
    if (activeClassId !== 'all') {
      list = list.filter((s) => String(s.classId) === activeClassId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.code && s.code.toLowerCase().includes(q)) ||
          (classMap[s.classId] || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [subjects, activeClassId, searchQuery, classMap]);

  // Stats per class
  const subjectsByClass = useMemo(() => {
    const map = { unassigned: 0 };
    classes.forEach((c) => { map[c._id] = 0; });
    subjects.forEach((s) => {
      if (s.classId && map[s.classId] !== undefined) map[s.classId]++;
      else map.unassigned++;
    });
    return map;
  }, [subjects, classes]);

  /* ─── Sorting ─── */
  const sortData = (data) => {
    if (!sortConfig.field) return data;
    return [...data].sort((a, b) => {
      let aVal = a[sortConfig.field];
      let bVal = b[sortConfig.field];
      if (sortConfig.field === 'className') {
        aVal = classMap[a.classId] || '';
        bVal = classMap[b.classId] || '';
      }
      if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal || '').toLowerCase(); }
      if (aVal < bVal) return sortConfig.order === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.order === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedSubjects = useMemo(() => sortData(filteredSubjects), [filteredSubjects, sortConfig]);

  /* ─── Pagination ─── */
  const totalPages = Math.ceil(sortedSubjects.length / itemsPerPage);
  const paginatedSubjects = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedSubjects.slice(start, start + itemsPerPage);
  }, [sortedSubjects, currentPage, itemsPerPage]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [activeClassId, searchQuery]);

  /* ─── CRUD ─── */
  const submitSubject = async (e) => {
    e.preventDefault();
    if (!subjectForm.name.trim()) { toast.error('Subject name is required'); return; }
    setIsSubmitting(true);
    try {
      await apiRequest('/api/academic/subjects', {
        method: 'POST',
        body: JSON.stringify({
          name: subjectForm.name.trim(),
          code: subjectForm.code.trim(),
          classId: subjectForm.classId || undefined,
        }),
      });
      toast.success('Subject added');
      setSubjectForm({ name: '', code: '', classId: '' });
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Unable to save subject');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateSubject = async (e) => {
    e.preventDefault();
    if (!editingSubject) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/api/academic/subjects/${editingSubject._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingSubject.name.trim(),
          code: (editingSubject.code || '').trim(),
          classId: editingSubject.classId || undefined,
        }),
      });
      toast.success('Subject updated');
      setEditingSubject(null);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Unable to update subject');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteSubject = async (id) => {
    const confirm = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this subject? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
    });
    if (!confirm.isConfirmed) return;

    setDeletingId(id);
    try {
      await apiRequest(`/api/academic/subjects/${id}`, { method: 'DELETE' });
      toast.success('Subject deleted');
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      await loadData();
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.message, icon: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  /* ─── Bulk ops ─── */
  const handleSelectAll = () => {
    if (selectedIds.length === paginatedSubjects.length && paginatedSubjects.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedSubjects.map((s) => s._id));
    }
  };

  const handleSelectItem = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirm = await Swal.fire({
      title: 'Bulk Delete',
      html: `Are you sure you want to delete <strong>${selectedIds.length}</strong> subject(s)?<br>This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete all',
    });
    if (!confirm.isConfirmed) return;

    let successCount = 0;
    let failCount = 0;
    Swal.fire({ title: 'Deleting...', html: `Deleted: <b>0</b> / ${selectedIds.length}`, allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    for (const id of selectedIds) {
      try {
        const res = await fetch(`${API_BASE}/api/academic/subjects/${id}`, { method: 'DELETE', headers: authHeaders });
        if (res.ok) successCount++; else failCount++;
        Swal.update({ html: `Deleted: <b>${successCount}</b> / ${selectedIds.length}${failCount > 0 ? ` (${failCount} failed)` : ''}` });
      } catch { failCount++; }
    }
    await loadData();
    setSelectedIds([]);
    Swal.fire({
      title: 'Completed',
      html: `Successfully deleted <b>${successCount}</b> subject(s)${failCount > 0 ? `<br>${failCount} deletion(s) failed` : ''}`,
      icon: successCount > 0 ? 'success' : 'error',
    });
  };

  /* ─── Sort toggle ─── */
  const toggleSort = (field) => {
    setSortConfig((prev) => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  /* ═══════════════ SUB-COMPONENTS ═══════════════ */

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );

  const SortableHeader = ({ label, field }) => (
    <th
      onClick={() => toggleSort(field)}
      className="cursor-pointer select-none whitespace-nowrap bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 transition hover:bg-amber-50"
    >
      <div className="flex items-center gap-1.5">
        {label}
        {sortConfig.field === field ? (
          sortConfig.order === 'asc' ? (
            <ChevronUp className="h-3.5 w-3.5 text-amber-600" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-amber-600" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 text-gray-300" />
        )}
      </div>
    </th>
  );

  const PaginationBar = () => {
    if (sortedSubjects.length === 0) return null;
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, sortedSubjects.length);

    const pages = [];
    const maxVisible = 5;
    let pStart = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let pEnd = Math.min(totalPages, pStart + maxVisible - 1);
    if (pEnd - pStart < maxVisible - 1) pStart = Math.max(1, pEnd - maxVisible + 1);
    for (let i = pStart; i <= pEnd; i++) pages.push(i);

    return (
      <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/50 px-4 py-3 sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{start}–{end} of {sortedSubjects.length}</span>
          <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="rounded border border-gray-200 px-2 py-1 text-xs focus:ring-2 focus:ring-amber-200">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setCurrentPage((p) => p - 1)} disabled={currentPage === 1}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40">
            Prev
          </button>
          {pStart > 1 && (
            <>
              <button onClick={() => setCurrentPage(1)} className="rounded-md border border-gray-200 px-2.5 py-1 text-xs hover:bg-gray-100">1</button>
              {pStart > 2 && <span className="px-1 text-xs text-gray-400">...</span>}
            </>
          )}
          {pages.map((n) => (
            <button key={n} onClick={() => setCurrentPage(n)}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${currentPage === n ? 'border-amber-400 bg-amber-500 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
              {n}
            </button>
          ))}
          {pEnd < totalPages && (
            <>
              {pEnd < totalPages - 1 && <span className="px-1 text-xs text-gray-400">...</span>}
              <button onClick={() => setCurrentPage(totalPages)} className="rounded-md border border-gray-200 px-2.5 py-1 text-xs hover:bg-gray-100">{totalPages}</button>
            </>
          )}
          <button onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage === totalPages}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40">
            Next
          </button>
        </div>
      </div>
    );
  };

  const EditModal = () => {
    if (!editingSubject) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-800">Edit Subject</h2>
            <button type="button" onClick={() => setEditingSubject(null)} disabled={isSubmitting} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={updateSubject} className="px-6 py-5">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Subject Name</label>
                <input type="text" value={editingSubject.name} onChange={(e) => setEditingSubject((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Subject Code</label>
                <input type="text" value={editingSubject.code || ''} onChange={(e) => setEditingSubject((p) => ({ ...p, code: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  placeholder="MATH101" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
                <select value={editingSubject.classId || ''} onChange={(e) => setEditingSubject((p) => ({ ...p, classId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100">
                  <option value="">All Classes</option>
                  {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setEditingSubject(null)} disabled={isSubmitting}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  /* ═══════════════ RENDER ═══════════════ */

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* ─── Header ─── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subject Management</h1>
            <p className="mt-1 text-sm text-gray-500">Campus-wise subject setup by class.</p>
          </div>
          <button onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-amber-600">
            <Plus className="h-4 w-4" />
            {showAddForm ? 'Hide Form' : 'Add Subject'}
          </button>
        </div>

        {/* ─── Stat Cards ─── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={GraduationCap} label="Total Subjects" value={subjects.length} color="bg-amber-500" />
          <StatCard icon={Layers} label="Classes" value={classes.length} color="bg-blue-500" />
          <StatCard
            icon={GraduationCap}
            label="Assigned to Class"
            value={subjects.filter((s) => s.classId).length}
            color="bg-emerald-500"
          />
          <StatCard
            icon={GraduationCap}
            label="Unassigned"
            value={subjectsByClass.unassigned}
            color="bg-violet-500"
          />
        </div>

        {/* ─── Add Form ─── */}
        {showAddForm && (
          <form onSubmit={submitSubject} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-800">Add Subject</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Subject Name</label>
                <input type="text" value={subjectForm.name} onChange={(e) => setSubjectForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  placeholder="Mathematics" required />
              </div>
              {/* <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Subject Code</label>
                <input type="text" value={subjectForm.code} onChange={(e) => setSubjectForm((p) => ({ ...p, code: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  placeholder="MATH101" />
              </div> */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
                <select value={subjectForm.classId} onChange={(e) => setSubjectForm((p) => ({ ...p, classId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100">
                  <option value="">All Classes</option>
                  {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                  <Plus className="h-4 w-4" /> Add Subject
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ─── Class Filter Tabs ─── */}
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
          {classTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveClassId(tab.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeClassId === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.name}
              {tab.id !== 'all' && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeClassId === tab.id ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'
                }`}>
                  {subjectsByClass[tab.id] || 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── Table Card ─── */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Subjects {activeClassId !== 'all' && `— ${classMap[activeClassId] || ''}`}
            </h3>
            <div className="w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search subjects..."
                  className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100" />
              </div>
            </div>
          </div>

          {/* Bulk action bar */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2">
              <span className="text-sm font-medium text-gray-700">{selectedIds.length} selected</span>
              <div className="flex gap-2">
                <button onClick={() => setSelectedIds([])} className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-white">Clear</button>
                <button onClick={handleBulkDelete} className="flex items-center gap-1 rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="w-12 bg-gray-50 px-4 py-3">
                    <input type="checkbox"
                      checked={selectedIds.length === paginatedSubjects.length && paginatedSubjects.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-amber-500" />
                  </th>
                  <SortableHeader label="Name" field="name" />
                  {/* <SortableHeader label="Code" field="code" /> */}
                  <SortableHeader label="Class" field="className" />
                  <th className="bg-gray-50 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedSubjects.map((subject) => (
                  <tr key={subject._id} className="transition hover:bg-amber-50/30">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.includes(subject._id)}
                        onChange={() => handleSelectItem(subject._id)}
                        className="h-4 w-4 rounded border-gray-300 text-amber-500" />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{subject.name}</td>
                    {/* <td className="px-4 py-3 text-sm text-gray-500">
                      {subject.code ? (
                        <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono">{subject.code}</span>
                      ) : '—'}
                    </td> */}
                    <td className="px-4 py-3 text-sm text-gray-500">{classMap[subject.classId] || 'All'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditingSubject({ ...subject })}
                          className="rounded-md p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600" title="Edit">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteSubject(subject._id)} disabled={deletingId === subject._id}
                          className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {paginatedSubjects.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <FolderOpen className="mb-3 h-10 w-10" />
                <p className="text-sm">{searchQuery || activeClassId !== 'all' ? 'No matching subjects found.' : 'No subjects yet.'}</p>
              </div>
            )}
          </div>

          <PaginationBar />
        </div>

        {/* ─── Edit Modal ─── */}
        <EditModal />
      </div>
    </div>
  );
};

export default SubjectManagement;
