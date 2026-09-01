import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Users,
  Eye,
  Edit2,
  GraduationCap,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const PARENTS_PER_PAGE = 8;

const inputClass =
  'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all bg-white';

const toastOk = (title) =>
  Swal.fire({ icon: 'success', title, toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
const toastErr = (title, text) =>
  Swal.fire({ icon: 'error', title, text, toast: true, position: 'top-end', showConfirmButton: false, timer: 2500 });

const ParentsManagement = ({ setShowAdminHeader }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterRelationship, setFilterRelationship] = useState('');
  const [parents, setParents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tableRefreshing, setTableRefreshing] = useState(false);
  const [showChildrenModal, setShowChildrenModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [childActionLoadingId, setChildActionLoadingId] = useState('');
  const [parentActionLoadingId, setParentActionLoadingId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaveError, setEditSaveError] = useState('');
  const [deleteConfirmParent, setDeleteConfirmParent] = useState(null);
  const [deleteConfirmChild, setDeleteConfirmChild] = useState(null);
  const [selectedParentIds, setSelectedParentIds] = useState([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const tableBodyScrollRef = useRef(null);
  const tableHeaderRef = useRef(null);

  const filteredParents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return parents.filter((parent) => {
      const children = Array.isArray(parent.children) ? parent.children : [];
      const grades = Array.isArray(parent.grades) ? parent.grades : [];
      const matchesSearch =
        !query ||
        parent.name.toLowerCase().includes(query) ||
        parent.loginUsername.toLowerCase().includes(query) ||
        parent.email.toLowerCase().includes(query) ||
        children.some((child) => child.toLowerCase().includes(query));
      const matchesGrade = !filterGrade || grades.includes(filterGrade);
      const matchesRelationship =
        !filterRelationship || (parent.relationship || '').toLowerCase() === filterRelationship.toLowerCase();
      return matchesSearch && matchesGrade && matchesRelationship;
    });
  }, [parents, searchTerm, filterGrade, filterRelationship]);

  const gradeOptions = useMemo(() => {
    const unique = new Set();
    parents.forEach((parent) => {
      (Array.isArray(parent.grades) ? parent.grades : []).forEach((grade) => {
        const trimmed = String(grade || '').trim();
        if (trimmed && trimmed !== '—') unique.add(trimmed);
      });
    });
    return Array.from(unique).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [parents]);

  const totalPages = Math.max(1, Math.ceil(filteredParents.length / PARENTS_PER_PAGE));
  const paginatedParents = useMemo(() => {
    const start = (currentPage - 1) * PARENTS_PER_PAGE;
    return filteredParents.slice(start, start + PARENTS_PER_PAGE);
  }, [filteredParents, currentPage]);
  const visibleParentIds = useMemo(
    () => paginatedParents.map((parent) => String(parent?.id)).filter(Boolean),
    [paginatedParents]
  );
  const filteredParentIds = useMemo(
    () => filteredParents.map((parent) => String(parent?.id)).filter(Boolean),
    [filteredParents]
  );
  const selectedParentIdSet = useMemo(
    () => new Set(selectedParentIds.map((id) => String(id))),
    [selectedParentIds]
  );
  const isAllVisibleSelected =
    visibleParentIds.length > 0 && visibleParentIds.every((id) => selectedParentIdSet.has(id));
  const isAnyVisibleSelected = visibleParentIds.some((id) => selectedParentIdSet.has(id));
  const isAllFilteredSelected =
    filteredParentIds.length > 0 && filteredParentIds.every((id) => selectedParentIdSet.has(id));
  const startItem = filteredParents.length > 0 ? (currentPage - 1) * PARENTS_PER_PAGE + 1 : 0;
  const endItem = Math.min(currentPage * PARENTS_PER_PAGE, filteredParents.length);

  const handleSearchChange = (val) => { setSearchTerm(val); setCurrentPage(1); };
  const handleFilterGrade = (val) => { setFilterGrade(val); setCurrentPage(1); };
  const handleFilterRelationship = (val) => { setFilterRelationship(val); setCurrentPage(1); };
  const clearFilters = () => { setSearchTerm(''); setFilterGrade(''); setFilterRelationship(''); setCurrentPage(1); };

  const fetchParents = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/get-parents`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch parents');
      const data = await res.json();
      const normalized = (Array.isArray(data) ? data : []).map((parent, idx) => {
        const children = Array.isArray(parent.children) ? parent.children : [];
        const grades = Array.isArray(parent.grade) ? parent.grade : Array.isArray(parent.grades) ? parent.grades : [];
        const engagementMetrics = parent.engagementMetrics || parent.metrics || {};

        // Build children details from populated childrenIds or fallback
        const populatedChildren = Array.isArray(parent.childrenIds) ? parent.childrenIds : [];
        const childrenDetailsFromApi = Array.isArray(parent.childrenDetails) ? parent.childrenDetails : [];

        const mappedChildrenDetails = populatedChildren.length
          ? populatedChildren.map((child, childIdx) => ({
              id: child?._id || child?.id || null,
              name: child?.name || children[childIdx] || 'Unnamed Student',
              grade: child?.grade || grades[childIdx] || '—',
              section: child?.section || '',
              performance: child?.performance || '',
              address: child?.address || '',
              pinCode: child?.pinCode || '',
            }))
          : childrenDetailsFromApi.length
            ? childrenDetailsFromApi.map((child, childIdx) => ({
                id: child?._id || child?.id || null,
                name: child?.name || children[childIdx] || 'Unnamed Student',
                grade: child?.grade || grades[childIdx] || '—',
                section: child?.section || '',
                performance: child?.performance || '',
                address: child?.address || '',
                pinCode: child?.pinCode || '',
              }))
            : children.map((childName, childIdx) => ({
                id: null,
                name: childName || 'Unnamed Student',
                grade: grades[childIdx] || '—',
                section: '',
                performance: '',
                address: '',
                pinCode: '',
              }));

        const firstStudentAddress =
          mappedChildrenDetails.find((child) => String(child?.address || '').trim())?.address || '';

        return {
          id: parent._id || parent.id || idx,
          name: parent.name || 'Unnamed Parent',
          loginUsername: parent.username || '—',
          parentId: parent._id ? `PAR-${parent._id.slice(-4)}` : `PAR-${idx + 1}`,
          email: parent.email || '—',
          mobile: parent.mobile || '—',
          children,
          grades,
          occupation: parent.occupation || '—',
          address: String(parent.address || '').trim() || firstStudentAddress || '—',
          joinDate: parent.createdAt ? new Date(parent.createdAt).toISOString().slice(0, 10) : '—',
          emergencyContact: parent.emergencyContact || parent.mobile || '—',
          relationship: parent.relationship || 'Parent',
          contactPreference: parent.contactPreference || parent.preferredContact || '—',
          communicationStatus: parent.communicationStatus || '—',
          engagementLevel: parent.engagementLevel || '—',
          engagementMetrics: {
            communicationRate: engagementMetrics.communicationRate ?? 0,
            eventAttendance: engagementMetrics.eventAttendance ?? 0,
            meetingParticipation: engagementMetrics.meetingParticipation ?? 0,
            responsiveness: engagementMetrics.responsiveness ?? 0,
            totalInteractions: engagementMetrics.totalInteractions ?? 0,
            lastContactDays: engagementMetrics.lastContactDays ?? null,
          },
          recentActivities: Array.isArray(parent.recentActivities) ? parent.recentActivities : [],
          childrenDetails: mappedChildrenDetails,
        };
      });
      setParents(normalized);
    } catch (err) {
      console.error('Error fetching parents:', err);
      toastErr('Unable to load parents', err.message || 'Please try again');
      setParents([]);
    }
  }, []);

  useEffect(() => {
    setShowAdminHeader?.(true);
    setIsLoading(true);
    fetchParents().finally(() => setIsLoading(false));
  }, [setShowAdminHeader, fetchParents]);

  const handleRefreshTableData = async () => {
    if (tableRefreshing) return;
    setTableRefreshing(true);
    try {
      await fetchParents();
    } finally {
      setTableRefreshing(false);
    }
  };

  useEffect(() => {
    const validIds = new Set(parents.map((parent) => String(parent?.id)).filter(Boolean));
    setSelectedParentIds((prev) => prev.filter((id) => validIds.has(String(id))));
  }, [parents]);

  // Keep the current page in range once filters shrink the result set.
  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const toggleParentSelection = (parentId) => {
    if (!parentId) return;
    const id = String(parentId);
    setSelectedParentIds((prev) => {
      const nextSet = new Set(prev.map((value) => String(value)));
      if (nextSet.has(id)) {
        nextSet.delete(id);
      } else {
        nextSet.add(id);
      }
      return Array.from(nextSet);
    });
  };

  const toggleSelectAllVisibleParents = () => {
    setSelectedParentIds((prev) => {
      const nextSet = new Set(prev.map((value) => String(value)));
      if (isAllVisibleSelected) {
        visibleParentIds.forEach((id) => nextSet.delete(String(id)));
      } else {
        visibleParentIds.forEach((id) => nextSet.add(String(id)));
      }
      return Array.from(nextSet);
    });
  };

  const toggleSelectAllFilteredParents = () => {
    setSelectedParentIds(isAllFilteredSelected ? [] : filteredParentIds);
  };

  const openChildrenModal = (parent) => {
    setSelectedParent(parent);
    setShowChildrenModal(true);
  };

  const handleEditChild = (childName = '') => {
    navigate('/admin/students');
    if (childName) localStorage.setItem('admin_student_search', childName);
    setShowChildrenModal(false);
  };

  const handleDeleteChild = async (child) => {
    if (!child?.id) {
      toastErr('Cannot delete', 'No linked student record.');
      return;
    }
    setChildActionLoadingId(String(child.id));
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/students/${child.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete student');
      await fetchParents();
      setSelectedParent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          childrenDetails: (prev.childrenDetails || []).filter((item) => String(item.id) !== String(child.id)),
        };
      });
      toastOk(`${child.name || 'Student'} deleted`);
    } catch (err) {
      toastErr('Unable to delete student', err.message);
    } finally {
      setChildActionLoadingId('');
      setDeleteConfirmChild(null);
    }
  };

  const openEditModal = (parent) => {
    setEditForm({
      id: parent.id,
      name: parent.name === '—' ? '' : parent.name || '',
      email: parent.email === '—' ? '' : parent.email || '',
      mobile: parent.mobile === '—' ? '' : parent.mobile || '',
      relationship: parent.relationship === 'Parent' || parent.relationship === '—' ? '' : parent.relationship || '',
      occupation: parent.occupation === '—' ? '' : parent.occupation || '',
      address: parent.address === '—' ? '' : parent.address || '',
      emergencyContact: parent.emergencyContact === '—' ? '' : parent.emergencyContact || '',
      contactPreference: parent.contactPreference === '—' ? '' : parent.contactPreference || '',
    });
    setEditSaveError('');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm?.id) return;
    setEditSaving(true);
    setEditSaveError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/parents/${editForm.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim().toLowerCase(),
          mobile: editForm.mobile.trim(),
          relationship: editForm.relationship,
          occupation: editForm.occupation.trim(),
          address: editForm.address.trim(),
          emergencyContact: editForm.emergencyContact.trim(),
          contactPreference: editForm.contactPreference,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update parent');
      await fetchParents();
      setShowEditModal(false);
      setEditForm(null);
      toastOk('Parent updated');
    } catch (err) {
      setEditSaveError(err.message || 'Failed to update parent');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteParent = async (parent) => {
    if (!parent?.id) return;
    setParentActionLoadingId(String(parent.id));
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/parents/${parent.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete parent');
      setSelectedParentIds((prev) => prev.filter((id) => String(id) !== String(parent.id)));
      await fetchParents();
      toastOk(`${parent.name || 'Parent'} deleted`);
    } catch (err) {
      toastErr('Unable to delete parent', err.message);
    } finally {
      setParentActionLoadingId('');
      setDeleteConfirmParent(null);
    }
  };

  const handleBulkDeleteParents = async () => {
    if (!selectedParentIds.length || bulkDeleteLoading) return;
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Delete selected parents?',
      text: `Delete ${selectedParentIds.length} selected parent(s)? This action cannot be undone.`,
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    setBulkDeleteLoading(true);
    try {
      const results = await Promise.allSettled(
        selectedParentIds.map((id) =>
          fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/parents/${id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }).then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data?.error || 'Failed to delete parent');
            }
            return true;
          })
        )
      );
      const failed = results.filter((result) => result.status === 'rejected');
      const successCount = results.length - failed.length;

      setSelectedParentIds([]);
      await fetchParents();

      if (failed.length) {
        Swal.fire({
          icon: 'warning',
          title: 'Bulk delete completed',
          html: `<p><strong>${successCount}</strong> deleted, <strong>${failed.length}</strong> failed. Please retry the failed records.</p>`,
        });
      } else {
        toastOk(`${successCount} parent(s) deleted`);
      }
    } catch (err) {
      toastErr('Unable to delete selected parents', err.message);
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const activeFilterCount = [searchTerm, filterGrade, filterRelationship].filter(Boolean).length;

  /* -------------------- UI -------------------- */
  return (
    // Fixed to the viewport so the parents table scrolls inside its own
    // container instead of the whole page scrolling — same layout as
    // /admin/students.
    <div className="page-fade-in flex h-[calc(100dvh-94px)] flex-col overflow-hidden bg-gray-50">
      <div className="w-full flex-1 flex flex-col p-3 md:p-5 lg:p-6 overflow-hidden text-sm md:text-base">
        {/* Header */}
        <div className="flex flex-col sm:flex-wrap gap-3 sm:justify-between sm:items-center mb-1 flex-shrink-0">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 text-center">
              Parents Management
            </h1>
            <p className="text-gray-500 mt-1 text-sm text-center">
              Manage parent engagement and student relationships
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-stretch sm:justify-start">
            {selectedParentIds.length > 0 && (
              <button
                onClick={handleBulkDeleteParents}
                disabled={bulkDeleteLoading}
                className="bg-red-500 text-white px-3 py-2 rounded-full hover:bg-red-600 disabled:opacity-60 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
                title={`Delete ${selectedParentIds.length} selected parent(s)`}
              >
                {bulkDeleteLoading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                {bulkDeleteLoading ? 'Deleting...' : 'Delete Selected'}
              </button>
            )}
            <button
              onClick={toggleSelectAllFilteredParents}
              disabled={filteredParentIds.length === 0}
              className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 disabled:opacity-60 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
              title={isAllFilteredSelected ? 'Clear selection' : `Select all ${filteredParentIds.length} parent(s)`}
            >
              <CheckCircle size={15} />
              {isAllFilteredSelected ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={handleRefreshTableData}
              disabled={tableRefreshing}
              className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 disabled:opacity-60 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
              title="Refresh parents table data"
            >
              {tableRefreshing ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
              {tableRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Filter Bar */}
          <div className="mb-1 p-3 md:p-4 flex-shrink-0">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="flex-1 min-w-[200px] relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, child or email..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>

              {/* Grade Filter */}
              <select
                value={filterGrade}
                onChange={(e) => handleFilterGrade(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[130px]"
              >
                <option value="">All Grades</option>
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>

              {/* Relationship Filter */}
              <select
                value={filterRelationship}
                onChange={(e) => handleFilterRelationship(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[130px]"
              >
                <option value="">All Relations</option>
                <option value="Father">Fathers</option>
                <option value="Mother">Mothers</option>
                <option value="Guardian">Guardians</option>
              </select>

              {/* Reset */}
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={14} /> Clear
                </button>
              )}
            </div>

            {/* Active filter tags */}
            {(filterGrade || filterRelationship) && (
              <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500">Active filters:</span>
                {filterGrade && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-medium">
                    Grade: {filterGrade}
                    <button onClick={() => handleFilterGrade('')} className="hover:text-emerald-600"><X size={12} /></button>
                  </span>
                )}
                {filterRelationship && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    Relation: {filterRelationship}
                    <button onClick={() => handleFilterRelationship('')} className="hover:text-green-600"><X size={12} /></button>
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">{filteredParents.length} parent{filteredParents.length !== 1 ? 's' : ''} found</span>
              </div>
            )}
          </div>

          {/* Parents Table */}
          {/* Rounded card clips the corners. Header sits in its own div so the
              body scrollbar starts *below* the header, not through it. */}
          <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {/* Header (does not scroll vertically; horizontal scroll synced to body) */}
            <div ref={tableHeaderRef} className="shrink-0 overflow-hidden border-b border-gray-200 table-scroll-gutter">
              <table className="w-full min-w-[900px] border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: '5%' }} /><col style={{ width: '22%' }} /><col style={{ width: '20%' }} />
                  <col style={{ width: '25%' }} /><col style={{ width: '13%' }} /><col style={{ width: '15%' }} />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border-b border-gray-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[5%]">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded-full border-2 border-emerald-200 bg-white text-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:ring-offset-0 cursor-pointer transition shadow-sm"
                        checked={isAllVisibleSelected}
                        disabled={!isAnyVisibleSelected && visibleParentIds.length === 0}
                        onChange={toggleSelectAllVisibleParents}
                        aria-label="Select all visible parents"
                      />
                    </th>
                    <th className="border-b border-gray-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[22%]">Parent</th>
                    <th className="border-b border-gray-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[20%]">Contact</th>
                    <th className="border-b border-gray-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[25%]">Children &amp; Grades</th>
                    <th className="border-b border-gray-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[13%]">Communication</th>
                    <th className="border-b border-gray-200 px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 w-[15%]">Actions</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Body (this is where the vertical scrollbar lives) */}
            <div
              ref={tableBodyScrollRef}
              onScroll={(e) => {
                if (tableHeaderRef.current) tableHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft;
              }}
              className="flex-1 overflow-auto table-scroll"
            >
              <table className="w-full min-w-[900px] border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: '5%' }} /><col style={{ width: '22%' }} /><col style={{ width: '20%' }} />
                  <col style={{ width: '25%' }} /><col style={{ width: '13%' }} /><col style={{ width: '15%' }} />
                </colgroup>
                <tbody className={tableRefreshing ? 'opacity-70 animate-pulse' : ''}>
                  {isLoading && parents.length === 0 ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={`parent-skeleton-${i}`} className="animate-pulse">
                        <td className="px-2 py-3.5"><div className="h-4 w-4 rounded bg-gray-200" /></td>
                        <td className="px-2 py-3.5">
                          <div className="h-3.5 w-3/4 rounded bg-gray-200 mb-2" />
                          <div className="h-3 w-1/2 rounded bg-gray-100" />
                        </td>
                        <td className="px-2 py-3.5"><div className="h-3.5 w-2/3 rounded bg-gray-200" /></td>
                        <td className="px-2 py-3.5"><div className="h-3.5 w-2/3 rounded bg-gray-200" /></td>
                        <td className="px-2 py-3.5"><div className="h-3.5 w-3/4 rounded bg-gray-200" /></td>
                        <td className="px-2 py-3.5"><div className="h-3.5 w-1/2 rounded bg-gray-200 mx-auto" /></td>
                      </tr>
                    ))
                  ) : (
                    <>
                      {paginatedParents.map((parent) => {
                        const initials = (parent.name || 'NA').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                        return (
                          <tr key={parent.id} className="hover:bg-emerald-50/30 transition-colors">
                            <td
                              className="border-b border-gray-100 px-2 py-2.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className="h-5 w-5 rounded-full border-2 border-emerald-200 bg-white text-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:ring-offset-0 cursor-pointer transition shadow-sm"
                                checked={selectedParentIdSet.has(String(parent.id))}
                                onChange={() => toggleParentSelection(parent.id)}
                                aria-label={`Select ${parent.name || 'parent'}`}
                              />
                            </td>

                            {/* Parent Info */}
                            <td
                              className="border-b border-gray-100 px-2 py-2.5 cursor-pointer"
                              onClick={() => openChildrenModal(parent)}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-100 to-green-200 flex items-center justify-center text-xs font-semibold text-emerald-700 flex-shrink-0">
                                  {initials}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-gray-900 text-xs truncate hover:text-emerald-600 transition">
                                    {parent.name}
                                  </div>
                                  <div className="text-[11px] text-emerald-600 font-mono truncate">{parent.loginUsername}</div>
                                  <div className="text-[11px] text-gray-400 truncate">
                                    {parent.relationship}
                                    {parent.occupation !== '—' ? ` · ${parent.occupation}` : ''}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Contact */}
                            <td className="border-b border-gray-100 px-2 py-2.5">
                              <div className="text-xs text-gray-600 space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <Mail size={12} className="text-emerald-400 flex-shrink-0" />
                                  <span className="truncate">{parent.email}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Phone size={12} className="text-green-400 flex-shrink-0" />
                                  <span>{parent.mobile}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-gray-500">
                                  <MapPin size={12} className="text-teal-400 flex-shrink-0" />
                                  <span className="truncate">{parent.address}</span>
                                </div>
                              </div>
                            </td>

                            {/* Children & Grades */}
                            <td className="border-b border-gray-100 px-2 py-2.5">
                              <div className="space-y-1.5">
                                {(parent.childrenDetails.length ? parent.childrenDetails : parent.children).slice(0, 2).map((child, idx) => {
                                  const name = typeof child === 'string' ? child : child.name;
                                  const grade = typeof child === 'string' ? parent.grades[idx] : child.grade;
                                  return (
                                    <div key={idx} className="flex items-center gap-1.5">
                                      <GraduationCap size={12} className="text-emerald-500 flex-shrink-0" />
                                      <span className="text-xs font-medium text-gray-900 truncate">{name || '—'}</span>
                                      <span className="text-xs text-gray-500 flex-shrink-0">({grade || '—'})</span>
                                    </div>
                                  );
                                })}
                                {parent.childrenDetails.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openChildrenModal(parent); }}
                                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                                  >
                                    +{parent.childrenDetails.length - 2} more
                                  </button>
                                )}
                                {parent.childrenDetails.length === 0 && (
                                  <span className="text-xs text-gray-400">No linked students</span>
                                )}
                              </div>
                            </td>

                            {/* Communication */}
                            <td className="border-b border-gray-100 px-2 py-2.5 text-xs text-gray-600">
                              <div className="font-medium text-gray-900">{parent.contactPreference}</div>
                              <div className="text-gray-500">
                                {parent.engagementMetrics.lastContactDays != null
                                  ? `Last: ${parent.engagementMetrics.lastContactDays}d ago`
                                  : 'Last: —'}
                              </div>
                            </td>

                            {/* Actions */}
                            <td
                              className="border-b border-gray-100 px-2 py-2.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-1 justify-center flex-wrap">
                                <button
                                  onClick={() => openChildrenModal(parent)}
                                  className="inline-flex items-center px-1.5 py-1 text-emerald-600 hover:bg-emerald-50 rounded-md text-xs transition"
                                  title="View Students"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  onClick={() => openEditModal(parent)}
                                  disabled={parentActionLoadingId === String(parent.id)}
                                  className="inline-flex items-center px-1.5 py-1 text-gray-500 hover:bg-gray-100 rounded-md text-xs transition disabled:opacity-50"
                                  title="Edit Parent"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmParent(parent)}
                                  disabled={parentActionLoadingId === String(parent.id)}
                                  className="inline-flex items-center px-1.5 py-1 text-red-600 hover:bg-red-100 rounded-md text-xs transition disabled:opacity-50"
                                  title="Delete Parent"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!isLoading && filteredParents.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-14 px-4 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                                <Users size={28} className="text-emerald-300" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-700">No parents found</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {parents.length === 0 ? 'Parents appear here once students are enrolled' : 'Try adjusting your search or filters'}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0 pt-3 border-t border-gray-100 px-1">
            <p className="text-gray-500 text-xs">
              {filteredParents.length === 0
                ? 'No parents to display'
                : `Showing ${startItem}–${endItem} of ${filteredParents.length} parents`}
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title="First page"
                >
                  <ChevronsLeft size={14} />
                </button>
                <button
                  className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  title="Previous page"
                >
                  <ChevronLeft size={14} />
                </button>

                {(() => {
                  const pages = [];
                  const showMax = 5;
                  if (totalPages <= showMax + 2) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    let rangeStart = Math.max(2, currentPage - 1);
                    let rangeEnd = Math.min(totalPages - 1, currentPage + 1);
                    if (currentPage <= 3) {
                      rangeStart = 2;
                      rangeEnd = Math.min(showMax, totalPages - 1);
                    } else if (currentPage >= totalPages - 2) {
                      rangeStart = Math.max(2, totalPages - showMax + 1);
                      rangeEnd = totalPages - 1;
                    }
                    if (rangeStart > 2) pages.push('start-ellipsis');
                    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
                    if (rangeEnd < totalPages - 1) pages.push('end-ellipsis');
                    pages.push(totalPages);
                  }
                  return pages.map((page) => {
                    if (typeof page === 'string') {
                      return (
                        <span key={page} className="px-1 text-gray-400 text-xs select-none">&hellip;</span>
                      );
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-[28px] h-7 rounded-md text-xs font-medium transition ${
                          page === currentPage
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  });
                })()}

                <button
                  className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  title="Next page"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title="Last page"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Delete Parent Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirmParent && (
            <Motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Motion.div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.34, 1.1, 0.64, 1] }}
              >
                <div className="px-6 pt-6 pb-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={24} className="text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Delete Parent</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    Are you sure you want to delete <span className="font-semibold text-gray-700">{deleteConfirmParent.name || 'this parent'}</span>? This action cannot be undone.
                  </p>
                </div>
                <div className="px-6 pb-6 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmParent(null)}
                    disabled={!!parentActionLoadingId}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteParent(deleteConfirmParent)}
                    disabled={!!parentActionLoadingId}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  >
                    {parentActionLoadingId ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
                  </button>
                </div>
              </Motion.div>
            </Motion.div>
          )}
        </AnimatePresence>

        {/* Delete Child Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirmChild && (
            <Motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Motion.div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.34, 1.1, 0.64, 1] }}
              >
                <div className="px-6 pt-6 pb-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={24} className="text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Delete Student</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    Are you sure you want to delete <span className="font-semibold text-gray-700">{deleteConfirmChild.name || 'this student'}</span>? This action cannot be undone.
                  </p>
                </div>
                <div className="px-6 pb-6 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmChild(null)}
                    disabled={!!childActionLoadingId}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteChild(deleteConfirmChild)}
                    disabled={!!childActionLoadingId}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  >
                    {childActionLoadingId ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
                  </button>
                </div>
              </Motion.div>
            </Motion.div>
          )}
        </AnimatePresence>

        {/* Edit Parent Modal */}
        <AnimatePresence>
          {showEditModal && editForm && (
            <Motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Motion.div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.34, 1.1, 0.64, 1] }}
              >
                <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
                  <div>
                    <h3 className="text-base font-bold text-white">Edit Parent</h3>
                    <p className="text-xs text-emerald-100 mt-0.5">Update parent information</p>
                  </div>
                  <button
                    onClick={() => { setShowEditModal(false); setEditForm(null); setEditSaveError(''); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-6">
                  {editSaveError && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                      {editSaveError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Full Name</label>
                      <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="Parent full name" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Email</label>
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} placeholder="email@example.com" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Mobile</label>
                      <input type="text" value={editForm.mobile} onChange={(e) => setEditForm((f) => ({ ...f, mobile: e.target.value }))} className={inputClass} placeholder="+91 XXXXX XXXXX" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Relationship</label>
                      <select value={editForm.relationship} onChange={(e) => setEditForm((f) => ({ ...f, relationship: e.target.value }))} className={inputClass}>
                        <option value="">Select relationship</option>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Guardian">Guardian</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Occupation</label>
                      <input type="text" value={editForm.occupation} onChange={(e) => setEditForm((f) => ({ ...f, occupation: e.target.value }))} className={inputClass} placeholder="e.g. Engineer, Teacher..." />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Emergency Contact</label>
                      <input type="text" value={editForm.emergencyContact} onChange={(e) => setEditForm((f) => ({ ...f, emergencyContact: e.target.value }))} className={inputClass} placeholder="Emergency phone number" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Contact Preference</label>
                      <select value={editForm.contactPreference} onChange={(e) => setEditForm((f) => ({ ...f, contactPreference: e.target.value }))} className={inputClass}>
                        <option value="">Select preference</option>
                        <option value="Phone">Phone</option>
                        <option value="Email">Email</option>
                        <option value="SMS">SMS</option>
                        <option value="WhatsApp">WhatsApp</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Address</label>
                      <textarea value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} rows={2} className={`${inputClass} resize-none`} placeholder="Full address" />
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 rounded-b-2xl">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setEditForm(null); setEditSaveError(''); }}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={editSaving}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 transition-all shadow-md shadow-emerald-200 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {editSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </Motion.div>
            </Motion.div>
          )}
        </AnimatePresence>

        {/* Children Modal */}
        <AnimatePresence>
          {showChildrenModal && selectedParent && (
            <Motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Motion.div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.34, 1.1, 0.64, 1] }}
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 pt-6 pb-10 relative flex-shrink-0">
                  <button
                    onClick={() => setShowChildrenModal(false)}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all"
                  >
                    <X size={18} />
                  </button>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shadow-lg flex-shrink-0 bg-white/15 text-white border border-white/25">
                      {(selectedParent.name || 'NA').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Students of {selectedParent.name}</h2>
                      <p className="text-emerald-200 text-sm mt-0.5 font-mono">Login: {selectedParent.loginUsername}</p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto mt-5">
                  <div className="bg-white rounded-t-2xl px-6 pt-5 pb-6">
                    {(selectedParent.childrenDetails || []).length === 0 ? (
                      <div className="text-center py-10">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                          <GraduationCap size={24} className="text-emerald-400" />
                        </div>
                        <p className="text-sm text-gray-500">No linked students found.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedParent.childrenDetails.map((child, idx) => (
                          <div key={`${child.id || child.name}-${idx}`} className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3.5 hover:bg-emerald-50/30 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <GraduationCap size={15} className="text-emerald-500 flex-shrink-0" />
                                  <span className="font-semibold text-gray-900 text-sm">{child.name}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 ml-6 flex-wrap">
                                  <span className="text-xs text-gray-600">Grade: {child.grade || '—'}</span>
                                  {child.section && <span className="text-xs text-gray-600">Section: {child.section}</span>}
                                  {child.performance && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      child.performance === 'Excellent' ? 'bg-emerald-100 text-emerald-800' :
                                      child.performance === 'Good' ? 'bg-blue-100 text-blue-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {child.performance}
                                    </span>
                                  )}
                                </div>
                                {(child.address || child.pinCode) && (
                                  <div className="flex items-center gap-1.5 mt-1.5 ml-6">
                                    <MapPin size={12} className="text-teal-400 flex-shrink-0" />
                                    <span className="text-xs text-gray-500">{[child.address, child.pinCode].filter(Boolean).join(', ')}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleEditChild(child.name)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100 transition-colors"
                                >
                                  <Edit2 size={12} />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmChild(child)}
                                  disabled={childActionLoadingId === String(child.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-100 disabled:opacity-60 transition-colors"
                                >
                                  <Trash2 size={12} />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end flex-shrink-0">
                  <button
                    onClick={() => setShowChildrenModal(false)}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              </Motion.div>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ParentsManagement;
