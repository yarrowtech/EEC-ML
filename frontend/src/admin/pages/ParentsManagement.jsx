import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  BookOpen,
  Users,
  Eye,
  Edit2,
  TrendingUp,
  Target,
  GraduationCap,
  Baby,
  ChevronsLeft,
  ChevronsRight,
  X,
  UserCheck,
  Briefcase,
  Shield,
  XCircle,
  Check,
} from 'lucide-react';
import CredentialGeneratorButton from '../components/CredentialGeneratorButton';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const PARENTS_PER_PAGE = 5;

const AVATAR_COLORS = [
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
  { bg: 'bg-green-100', text: 'text-green-700' },
  { bg: 'bg-lime-100', text: 'text-lime-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
];

const getAvatarColor = (name) => {
  const hash = (name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const inputClass =
  'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all bg-white';

const ParentsManagement = ({ setShowAdminHeader }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterRelationship, setFilterRelationship] = useState('All');
  const [filterEngagement, setFilterEngagement] = useState('All');
  const [filterCommunication, setFilterCommunication] = useState('All');
  const [parents, setParents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
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
  const [submitStatus, setSubmitStatus] = useState(null);
  const [selectedParentIds, setSelectedParentIds] = useState([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const filteredParents = parents.filter((parent) => {
    const children = Array.isArray(parent.children) ? parent.children : [];
    const grades = Array.isArray(parent.grades) ? parent.grades : [];
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      !query ||
      parent.name.toLowerCase().includes(query) ||
      parent.loginUsername.toLowerCase().includes(query) ||
      parent.email.toLowerCase().includes(query) ||
      children.some((child) => child.toLowerCase().includes(query));
    const matchesGrade = filterGrade === 'All' || grades.includes(filterGrade);
    const matchesRelationship =
      filterRelationship === 'All' || (parent.relationship || '').toLowerCase() === filterRelationship.toLowerCase();
    const matchesEngagement =
      filterEngagement === 'All' || (parent.engagementLevel || '').toLowerCase() === filterEngagement.toLowerCase();
    const matchesCommunication =
      filterCommunication === 'All' || (parent.communicationStatus || '').toLowerCase() === filterCommunication.toLowerCase();
    return matchesSearch && matchesGrade && matchesRelationship && matchesEngagement && matchesCommunication;
  });

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
  const selectedParentIdSet = useMemo(
    () => new Set(selectedParentIds.map((id) => String(id))),
    [selectedParentIds]
  );
  const isAllVisibleSelected =
    visibleParentIds.length > 0 && visibleParentIds.every((id) => selectedParentIdSet.has(id));
  const isAnyVisibleSelected = visibleParentIds.some((id) => selectedParentIdSet.has(id));
  const startItem = filteredParents.length > 0 ? (currentPage - 1) * PARENTS_PER_PAGE + 1 : 0;
  const endItem = Math.min(currentPage * PARENTS_PER_PAGE, filteredParents.length);

  const handleSearchChange = (val) => { setSearchTerm(val); setCurrentPage(1); };
  const handleFilterGrade = (val) => { setFilterGrade(val); setCurrentPage(1); };
  const handleFilterRelationship = (val) => { setFilterRelationship(val); setCurrentPage(1); };
  const handleFilterEngagement = (val) => { setFilterEngagement(val); setCurrentPage(1); };
  const handleFilterCommunication = (val) => { setFilterCommunication(val); setCurrentPage(1); };

  const fetchParents = async () => {
    setIsLoading(true);
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
      setError(err.message || 'Failed to fetch parents');
      setParents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setShowAdminHeader?.(false);
    setError('');
    fetchParents();
  }, [setShowAdminHeader]);

  useEffect(() => {
    const validIds = new Set(parents.map((parent) => String(parent?.id)).filter(Boolean));
    setSelectedParentIds((prev) => prev.filter((id) => validIds.has(String(id))));
  }, [parents]);

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
      setSubmitStatus({ type: 'error', message: 'Cannot delete: no linked student record.' });
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
      setSubmitStatus({ type: 'success', message: `${child.name || 'Student'} deleted successfully.` });
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.message || 'Failed to delete student' });
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
      setSubmitStatus({ type: 'success', message: `${parent.name || 'Parent'} deleted successfully.` });
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.message || 'Failed to delete parent' });
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
        setSubmitStatus({
          type: 'error',
          message: `${successCount} parent(s) deleted, ${failed.length} failed. Please retry failed records.`,
        });
      } else {
        setSubmitStatus({
          type: 'success',
          message: `${successCount} parent(s) deleted successfully.`,
        });
      }
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.message || 'Failed to delete selected parents' });
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-green-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                <Users size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Parents Management</h1>
                <p className="text-sm text-gray-500 mt-0.5">Manage parent engagement and student relationships</p>
              </div>
            </div>
            {/* <CredentialGeneratorButton
              buttonText="Generate Parent ID"
              defaultRole="Parent"
              allowRoleSelection={false}
              size="sm"
              buttonClassName="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white px-4 py-2.5 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all shadow-md shadow-emerald-200 text-sm font-medium"
            /> */}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 mt-6">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{parents.length}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <UserCheck size={20} className="text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Students</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{parents.reduce((acc, p) => acc + p.children.length, 0)}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <Baby size={20} className="text-green-600" />
                </div>
              </div>
            </div>
            {/* <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Engagement</p>
                  <p className="text-2xl font-bold text-teal-600 mt-1">89%</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                  <TrendingUp size={20} className="text-teal-600" />
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Meetings Due</p>
                  <p className="text-2xl font-bold text-amber-500 mt-1">{Math.floor(parents.length * 0.3)}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Calendar size={20} className="text-amber-500" />
                </div>
              </div>
            </div> */}
          </div>

          {submitStatus && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
                submitStatus.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {submitStatus.type === 'success' ? <Check size={15} className="flex-shrink-0" /> : <XCircle size={15} className="flex-shrink-0" />}
              {submitStatus.message}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
              <XCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Search and Filter */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="flex-1 relative min-w-[200px]">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, child or email..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white shadow-sm text-sm"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <select
              className="sm:w-36 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white shadow-sm text-sm text-gray-700"
              value={filterGrade}
              onChange={(e) => handleFilterGrade(e.target.value)}
            >
              <option value="All">All Grades</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
            <select
              className="sm:w-40 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white shadow-sm text-sm text-gray-700"
              value={filterRelationship}
              onChange={(e) => handleFilterRelationship(e.target.value)}
            >
              <option value="All">All Relations</option>
              <option value="Father">Fathers</option>
              <option value="Mother">Mothers</option>
              <option value="Guardian">Guardians</option>
            </select>
            {/* <select
              className="sm:w-44 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white shadow-sm text-sm text-gray-700"
              value={filterEngagement}
              onChange={(e) => handleFilterEngagement(e.target.value)}
            >
              <option value="All">Engagement Level</option>
              <option value="high">High (90%+)</option>
              <option value="medium">Medium (70-89%)</option>
              <option value="low">Low (Below 70%)</option>
            </select> */}
            {/* <select
              className="sm:w-48 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white shadow-sm text-sm text-gray-700"
              value={filterCommunication}
              onChange={(e) => handleFilterCommunication(e.target.value)}
            >
              <option value="All">Communication</option>
              <option value="recent">Recent Contact</option>
              <option value="pending">Pending Response</option>
              <option value="overdue">Overdue Contact</option>
            </select> */}
          </div>
          {selectedParentIds.length > 0 && (
            <div className="mt-3 flex items-center justify-end">
              <button
                type="button"
                onClick={handleBulkDeleteParents}
                disabled={bulkDeleteLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {bulkDeleteLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete Selected ({selectedParentIds.length})
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-slate-50/80 border-b border-gray-100">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-600"
                      checked={isAllVisibleSelected}
                      disabled={!isAnyVisibleSelected && visibleParentIds.length === 0}
                      onChange={toggleSelectAllVisibleParents}
                      aria-label="Select all visible parents"
                    />
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Parent</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Children & Grades</th>
                  {/* <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Engagement</th> */}
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Communication</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                        <span className="text-sm text-gray-500">Loading parents...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!isLoading && filteredParents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                        <Users size={28} className="text-emerald-400" />
                      </div>
                      <p className="text-gray-600 font-semibold">No parents found</p>
                      <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
                    </td>
                  </tr>
                )}
                {paginatedParents.map((parent) => {
                  const avatarColor = getAvatarColor(parent.name);
                  const initials = (parent.name || 'NA').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <tr key={parent.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-emerald-600"
                          checked={selectedParentIdSet.has(String(parent.id))}
                          onChange={() => toggleParentSelection(parent.id)}
                          aria-label={`Select ${parent.name || 'parent'}`}
                        />
                      </td>
                      {/* Parent Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl ${avatarColor.bg} flex items-center justify-center text-sm font-bold ${avatarColor.text} flex-shrink-0`}>
                            {initials}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{parent.name}</div>
                            <div className="text-xs text-emerald-600 font-mono">{parent.loginUsername}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500">{parent.relationship}</span>
                              {parent.occupation !== '—' && (
                                <span className="inline-block text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{parent.occupation}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail size={13} className="mr-2 text-emerald-400 flex-shrink-0" />
                            <span className="truncate max-w-[180px]">{parent.email}</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone size={13} className="mr-2 text-green-400 flex-shrink-0" />
                            <span>{parent.mobile}</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <MapPin size={13} className="mr-2 text-teal-400 flex-shrink-0" />
                            <span className="truncate max-w-[180px]">{parent.address}</span>
                          </div>
                        </div>
                      </td>

                      {/* Children & Grades */}
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          {(parent.childrenDetails.length ? parent.childrenDetails : parent.children).slice(0, 2).map((child, idx) => {
                            const name = typeof child === 'string' ? child : child.name;
                            const grade = typeof child === 'string' ? parent.grades[idx] : child.grade;
                            const performance = typeof child === 'string' ? null : child.performance;
                            const childAddress = typeof child === 'string' ? '' : child.address;
                            return (
                              <div key={idx} className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <GraduationCap size={13} className="text-emerald-500 flex-shrink-0" />
                                  <span className="text-sm font-medium text-gray-900">{name || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2 ml-5 flex-wrap">
                                  <span className="text-xs text-gray-600">{grade || '—'}</span>
                                  {performance && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      performance === 'Excellent' ? 'bg-emerald-100 text-emerald-800' :
                                      performance === 'Good' ? 'bg-blue-100 text-blue-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {performance}
                                    </span>
                                  )}
                                </div>
                                {childAddress && (
                                  <div className="flex items-center gap-1.5 ml-5">
                                    <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                                    <span className="text-xs text-gray-400 truncate max-w-[160px]">{childAddress}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {parent.childrenDetails.length > 2 && (
                            <button
                              type="button"
                              onClick={() => openChildrenModal(parent)}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                            >
                              +{parent.childrenDetails.length - 2} more
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Engagement */}
                      {/* <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Target size={14} className="text-emerald-600" />
                            <span className="text-sm font-semibold text-emerald-600">{parent.engagementMetrics.eventAttendance}%</span>
                            <span className="text-xs text-gray-500">Events</span>
                          </div>
                          <div className="text-xs text-gray-600">{parent.engagementMetrics.totalInteractions} interactions</div>
                        </div>
                      </td> */}

                      {/* Communication */}
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="text-sm font-medium text-gray-900">{parent.contactPreference}</div>
                          <div className="text-xs text-gray-600">
                            {parent.engagementMetrics.lastContactDays != null
                              ? `Last: ${parent.engagementMetrics.lastContactDays}d ago`
                              : 'Last: —'}
                          </div>
                          <div className="text-xs text-gray-500">Emergency: {parent.emergencyContact}</div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                            title="View Students"
                            onClick={() => openChildrenModal(parent)}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
                            title="Edit"
                            onClick={() => openEditModal(parent)}
                            disabled={parentActionLoadingId === String(parent.id)}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-40"
                            title="Delete"
                            onClick={() => setDeleteConfirmParent(parent)}
                            disabled={parentActionLoadingId === String(parent.id)}
                          >
                            <Trash2 size={15} />
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
          {filteredParents.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-sm text-gray-500">
                  Showing <span className="font-semibold text-gray-700">{startItem}</span> – <span className="font-semibold text-gray-700">{endItem}</span> of <span className="font-semibold text-gray-700">{filteredParents.length}</span> parents
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition" title="First">
                      <ChevronsLeft size={14} />
                    </button>
                    <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      Previous
                    </button>
                    <div className="flex gap-1">
                      {(() => {
                        const pages = [];
                        const showMax = 5;
                        if (totalPages <= showMax + 2) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          pages.push(1);
                          let rangeStart = Math.max(2, currentPage - 1);
                          let rangeEnd = Math.min(totalPages - 1, currentPage + 1);
                          if (currentPage <= 3) { rangeStart = 2; rangeEnd = Math.min(showMax, totalPages - 1); }
                          else if (currentPage >= totalPages - 2) { rangeStart = Math.max(2, totalPages - showMax + 1); rangeEnd = totalPages - 1; }
                          if (rangeStart > 2) pages.push('start-ellipsis');
                          for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
                          if (rangeEnd < totalPages - 1) pages.push('end-ellipsis');
                          pages.push(totalPages);
                        }
                        return pages.map((page) => {
                          if (typeof page === 'string') return <span key={page} className="px-1 text-gray-400 text-xs select-none">&hellip;</span>;
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                                page === currentPage
                                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                                  : 'border border-gray-200 text-gray-600 bg-white hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        });
                      })()}
                    </div>
                    <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      Next
                    </button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition" title="Last">
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Parent Confirmation Modal */}
      {deleteConfirmParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
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
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Child Confirmation Modal */}
      {deleteConfirmChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
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
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Parent Modal */}
      {showEditModal && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
          </div>
        </div>
      )}

      {/* Children Modal */}
      {showChildrenModal && selectedParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 pt-6 pb-10 relative flex-shrink-0">
              <button
                onClick={() => setShowChildrenModal(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shadow-lg flex-shrink-0 ${getAvatarColor(selectedParent.name).bg} ${getAvatarColor(selectedParent.name).text}`}>
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
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentsManagement;
