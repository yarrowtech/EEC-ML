import React, { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Mail,
  Phone,
  Calendar,
  Users,
  Star,
  Award,
  Eye,
  Clock,
  Target,
  CheckCircle,
  FileText,
  GraduationCap,
  Activity,
  DollarSign,
  Briefcase,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  KeyRound,
  Copy,
  Check,
  MapPin,
  Building2
} from 'lucide-react';
import Swal from 'sweetalert2';

const normalizeAttendance = (value) => {
  if (!value) return 'Unknown';
  const normalized = String(value).toLowerCase();
  if (normalized === 'present') return 'Present';
  if (normalized === 'absent') return 'Absent';
  return value;
};

const normalizePaymentStatus = (value) => {
  if (!value) return 'Pending';
  const normalized = String(value).toLowerCase();
  if (normalized === 'paid') return 'Paid';
  if (normalized === 'due') return 'Due';
  if (normalized === 'pending') return 'Pending';
  return value;
};

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]?.toUpperCase()).filter(Boolean);
  if (parts.length === 0) return 'S';
  return parts.slice(0, 2).join('');
};

const AVATAR_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-blue-200', text: 'text-blue-800' },
];

const getAvatarColor = (name) => {
  const hash = (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const inputClass =
  'w-full rounded-xl border border-blue-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all bg-white';

const Staff = ({ setShowAdminHeader }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [credentialLoadingId, setCredentialLoadingId] = useState(null);
  const [credentialView, setCredentialView] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [deletingStaffId, setDeletingStaffId] = useState(null);
  const [viewStaff, setViewStaff] = useState(null);

  const [newStaffMember, setNewStaffMember] = useState({
    name: '', email: '', phone: '', position: '', department: '',
    experience: '', qualification: '', salary: '', rating: '',
    status: 'Active', joinDate: '', location: '', avatar: ''
  });
  const [editStaffMember, setEditStaffMember] = useState({
    name: '', email: '', phone: '', position: '', department: '',
    experience: '', qualification: '', salary: '',
    status: 'Active', joinDate: '', location: '', avatar: ''
  });

  const filteredStaff = staff.filter(m => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || m.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getPerformanceMetrics = () => ({
    taskCompletionRate: Math.floor(Math.random() * 20) + 80,
    attendanceRate: Math.floor(Math.random() * 15) + 85,
    totalTasks: Math.floor(Math.random() * 50) + 20,
  });

  const getTodaySchedule = () => {
    const schedules = [
      { time: '09:00-10:00', task: 'Admin Meeting' },
      { time: '10:00-11:00', task: 'Budget Review' },
      { time: '11:30-12:30', task: 'Staff Training' },
      { time: '14:00-15:00', task: 'Facilities Check' },
    ];
    return schedules.slice(0, Math.floor(Math.random() * 3) + 1);
  };

  const getCertifications = () => {
    const allCerts = [
      { name: 'Admin Management', year: '2018', status: 'verified' },
      { name: 'Safety Training', year: '2020', status: 'verified' },
      { name: 'Leadership Dev', year: '2022', status: 'pending' },
      { name: 'Digital Workflow', year: '2023', status: 'verified' },
    ];
    return allCerts.slice(0, Math.floor(Math.random() * 3) + 1);
  };

  const getRecentEvaluations = () => ({
    lastEvaluation: '2024-01-15',
    overallRating: Math.floor(Math.random() * 2) + 4,
    evaluatedBy: 'HR Manager',
    nextEvaluation: '2024-07-15',
  });

  const fetchStaff = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/get-staff`, {
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch staff');
      const normalized = (Array.isArray(data) ? data : []).map((member, idx) => ({
        _id: member._id,
        id: member._id || member.id || idx,
        name: member.name || 'Unnamed Staff',
        empId: member.employeeCode || member.empId || member.staffCode || `EMP-${idx + 1}`,
        email: member.email || '-',
        mobile: member.mobile || member.phone || '-',
        position: member.position || member.role || member.designation || 'Staff',
        department: member.department || 'General',
        qualification: member.qualification || '-',
        experience: Number(member.experience || 0),
        joiningDate: member.joiningDate || member.joinDate || member.createdAt || '',
        status: member.status || 'Active',
        salary: Number(member.salary ?? member.ctc ?? 0),
        attendanceToday: normalizeAttendance(member.attendanceToday),
        lastSalaryDate: member.lastSalaryDate || null,
        paymentStatus: normalizePaymentStatus(member.paymentStatus),
        nextPaymentDue: member.nextPaymentDue || null,
        address: member.address || '',
        avatar: member.avatar || '',
      }));
      setStaff(normalized);
    } catch (err) {
      console.error('Error fetching staff:', err);
      setError(err.message || 'Failed to fetch staff');
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setShowAdminHeader(false);
    fetchStaff();
    // Restore the shell header on unmount — without this, navigating to a
    // page that doesn't itself call setShowAdminHeader(true) leaves the
    // admin shell's top header missing after leaving this page.
    return () => setShowAdminHeader(true);
  }, [setShowAdminHeader]);

  const handleAddStaffChange = (e) => {
    const { name, value } = e.target;
    setNewStaffMember(prev => ({ ...prev, [name]: value }));
  };

  const handleEditStaffChange = (e) => {
    const { name, value } = e.target;
    setEditStaffMember(prev => ({ ...prev, [name]: value }));
  };

  const openEditForm = (staffMember) => {
    if (!staffMember) return;
    setEditingStaff(staffMember);
    setEditStaffMember({
      name: staffMember.name || '',
      email: staffMember.email || '',
      phone: staffMember.mobile || '',
      position: staffMember.position || '',
      department: staffMember.department || '',
      experience: staffMember.experience ? String(staffMember.experience) : '',
      qualification: staffMember.qualification || '',
      salary: staffMember.salary != null ? String(staffMember.salary) : '',
      status: staffMember.status || 'Active',
      joinDate: staffMember.joiningDate || '',
      location: staffMember.location || '',
      avatar: staffMember.avatar || '',
    });
    setShowEditForm(true);
  };

  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitStatus(null);
      const payload = { ...newStaffMember, salary: newStaffMember.salary ? Number(newStaffMember.salary) : undefined };
      Object.keys(payload).forEach((key) => {
        if (payload[key] === '' || payload[key] === undefined || payload[key] === null) delete payload[key];
      });
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/staff/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Registration failed');
      setSubmitStatus({ type: 'success', message: 'Staff member added successfully.' });
      if (data?.username && data?.password) {
        setCredentialView({ name: newStaffMember.name, username: data.username, employeeCode: data.employeeCode || data.username, password: data.password });
      }
      setShowAddForm(false);
      setNewStaffMember({ name: '', email: '', phone: '', position: '', department: '', experience: '', qualification: '', salary: '', rating: '', status: 'Active', joinDate: '', location: '', avatar: '' });
      fetchStaff();
    } catch (error) {
      console.error('Error adding staff member:', error);
      setSubmitStatus({ type: 'error', message: error.message || 'Unable to add staff member' });
    }
  };

  const handleEditStaffSubmit = async (e) => {
    e.preventDefault();
    if (!editingStaff?._id && !editingStaff?.id) return;
    try {
      setSubmitStatus(null);
      const staffId = editingStaff._id || editingStaff.id;
      const payload = {
        name: editStaffMember.name, email: editStaffMember.email, mobile: editStaffMember.phone,
        position: editStaffMember.position, department: editStaffMember.department,
        experience: editStaffMember.experience, qualification: editStaffMember.qualification,
        salary: editStaffMember.salary ? Number(editStaffMember.salary) : undefined,
        status: editStaffMember.status, joiningDate: editStaffMember.joinDate,
      };
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/staff/${staffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to update staff member');
      setSubmitStatus({ type: 'success', message: 'Staff member updated successfully.' });
      setShowEditForm(false);
      setEditingStaff(null);
      fetchStaff();
    } catch (error) {
      console.error('Error updating staff member:', error);
      setSubmitStatus({ type: 'error', message: error.message || 'Unable to update staff member' });
    }
  };

  const handleDeleteStaff = async (staffMember) => {
    const staffId = staffMember?._id || staffMember?.id;
    if (!staffId || deletingStaffId) return;
    const confirmed = await Swal.fire({
      icon: 'warning',
      title: 'Delete staff member?',
      text: `Delete ${staffMember.name || 'this staff member'}? This action cannot be undone.`,
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });
    if (!confirmed.isConfirmed) return;
    setDeletingStaffId(staffId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/staff/${staffId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || 'Unable to delete staff member');
      setStaff((prev) => prev.filter((item) => String(item._id || item.id) !== String(staffId)));
      setSubmitStatus({ type: 'success', message: 'Staff member deleted successfully.' });
    } catch (error) {
      console.error('Error deleting staff member:', error);
      setSubmitStatus({ type: 'error', message: error.message || 'Unable to delete staff member' });
    } finally {
      setDeletingStaffId(null);
    }
  };

  const handleViewCredentials = async (staffMember) => {
    const staffId = staffMember?._id || staffMember?.id;
    if (!staffId) return;
    const confirmReset = await Swal.fire({
      icon: 'question',
      title: 'Reset login password?',
      text: `This will reset ${staffMember.name || 'the staff member'}'s password and generate a new one.`,
      showCancelButton: true,
      confirmButtonText: 'Yes, Reset',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2563eb',
    });
    if (!confirmReset.isConfirmed) return;
    setCredentialLoadingId(staffId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/staff/${staffId}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to generate credentials');
      setCredentialView({ name: staffMember.name, username: data.username, employeeCode: data.employeeCode || data.username, password: data.password });
    } catch (error) {
      setSubmitStatus({ type: 'error', message: error.message || 'Unable to generate credentials' });
    } finally {
      setCredentialLoadingId(null);
    }
  };

  const copyCredential = async (value, field) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy credential:', err);
    }
  };

  const formatDate = (value) => {
    if (!value) return '—';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatMoney = (value) => {
    if (value == null || Number.isNaN(Number(value)) || Number(value) === 0) return '—';
    return `₹${Number(value).toLocaleString('en-IN')}`;
  };

  // ─── shared form fields renderer ────────────────────────────────────
  const renderFormFields = (data, onChange, isEdit = false) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[
        { label: 'Full Name', name: 'name', type: 'text', required: true },
        { label: 'Email', name: 'email', type: 'email', required: true },
        { label: 'Contact Number', name: 'phone', type: 'tel', required: !isEdit },
        { label: 'Position', name: 'position', type: 'text' },
        { label: 'Department', name: 'department', type: 'text' },
        { label: 'Qualification', name: 'qualification', type: 'text' },
        { label: 'Experience (years)', name: 'experience', type: 'number' },
        { label: isEdit ? 'Salary' : 'Basic Salary (Optional)', name: 'salary', type: 'number' },
        { label: 'Join Date', name: 'joinDate', type: 'date' },
      ].map(({ label, name, type, required }) => (
        <div key={name}>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">{label}{required && ' *'}</label>
          <input type={type} name={name} value={data[name] || ''} onChange={onChange} className={inputClass} required={required} min={type === 'number' ? '0' : undefined} />
        </div>
      ))}
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Status</label>
        <select name="status" value={data.status || 'Active'} onChange={onChange} className={inputClass}>
          <option value="Active">Active</option>
          <option value="On Leave">On Leave</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50/40 to-indigo-50/30">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200 flex-shrink-0">
              <Users size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-blue-900">Staff Management</h1>
              <p className="text-sm text-blue-500/80 mt-0.5">Manage staff performance, schedules &amp; evaluations</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 text-sm font-medium self-start sm:self-auto"
          >
            <Plus size={18} />
            Add Staff
          </button>
        </div>

        {/* ── Status alert ── */}
        {submitStatus && (
          <div className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
            submitStatus.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            {submitStatus.type === 'success'
              ? <CheckCircle2 size={15} className="flex-shrink-0" />
              : <XCircle size={15} className="flex-shrink-0" />}
            {submitStatus.message}
          </div>
        )}

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-blue-100/60 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Staff</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{staff.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Users size={20} className="text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-blue-100/60 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Present Today</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{staff.filter(s => s.attendanceToday === 'Present').length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-blue-100/60 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Absent Today</p>
                <p className="text-2xl font-bold text-red-500 mt-1">{staff.filter(s => s.attendanceToday === 'Absent').length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <XCircle size={20} className="text-red-500" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-blue-100/60 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Paid</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{staff.filter(s => s.paymentStatus === 'Paid').length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <DollarSign size={20} className="text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-blue-100/60 shadow-sm hover:shadow-md transition-shadow col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Payment Due</p>
                <p className="text-2xl font-bold text-orange-500 mt-1">{staff.filter(s => s.paymentStatus === 'Due').length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <AlertTriangle size={20} className="text-orange-500" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Search & Filters ── */}
        <div className="bg-white rounded-2xl border border-blue-100/60 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, position or email..."
                className="w-full pl-10 pr-4 py-2.5 border border-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), options: [['All','All Status'],['Active','Active'],['On Leave','On Leave']] },
              ].map((sel, i) => (
                <select key={i} className="border border-blue-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-700 min-w-[130px]" value={sel.value} onChange={sel.onChange}>
                  {sel.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
              <select className="border border-blue-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-700 min-w-[150px]">
                <option value="">All Departments</option>
                {['Administration','Human Resources','Finance','Maintenance','IT Support','Security','Library','Cafeteria'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="border border-blue-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-700 min-w-[130px]">
                <option value="">Attendance</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </select>
              <select className="border border-blue-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-700 min-w-[140px]">
                <option value="">Payment Status</option>
                <option value="paid">Paid</option>
                <option value="due">Due</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-blue-100/60 shadow-sm overflow-hidden">
          {error && (
            <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center animate-pulse">
                <Users size={24} className="text-blue-400" />
              </div>
              <p className="text-blue-500 text-sm font-medium">Loading staff records…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-50 to-indigo-50/60 border-b border-blue-100">
                    {['Staff Member', 'Role & Dept', 'Attendance', 'Payment', 'Performance', 'Schedule', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {filteredStaff.map((staffMember) => {
                    const avatarColor = getAvatarColor(staffMember.name);
                    const metrics = getPerformanceMetrics();
                    const schedule = getTodaySchedule();
                    const evaluation = getRecentEvaluations();
                    return (
                      <tr key={staffMember.id} className="hover:bg-blue-50/40 transition-colors">

                        {/* Staff Member */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold ${avatarColor.bg} ${avatarColor.text}`}>
                              {getInitials(staffMember.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{staffMember.name}</p>
                              <p className="text-xs font-mono text-gray-400">#{staffMember.empId}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <Mail size={11} className="text-blue-400" />
                                  <span className="truncate max-w-[110px]">{staffMember.email}</span>
                                </span>
                              </div>
                              <span className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                <Phone size={11} className="text-emerald-400" />
                                {staffMember.mobile}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role & Dept */}
                        <td className="px-5 py-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <Briefcase size={13} className="text-blue-500 flex-shrink-0" />
                              <span className="text-sm font-semibold text-gray-800">{staffMember.position}</span>
                            </div>
                            <span className="inline-block text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{staffMember.department}</span>
                            <p className="text-xs text-gray-400">Joined: {formatDate(staffMember.joiningDate)}</p>
                          </div>
                        </td>

                        {/* Attendance */}
                        <td className="px-5 py-4">
                          {staffMember.attendanceToday === 'Present' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Present
                            </span>
                          ) : staffMember.attendanceToday === 'Absent' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              Absent
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              Unknown
                            </span>
                          )}
                          <p className="text-xs text-gray-400 mt-1">Today's status</p>
                        </td>

                        {/* Payment */}
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            {staffMember.paymentStatus === 'Paid' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                {staffMember.paymentStatus}
                              </span>
                            )}
                            <p className="text-xs font-semibold text-gray-700">{formatMoney(staffMember.salary)}</p>
                            <p className="text-xs text-gray-400">Last: {formatDate(staffMember.lastSalaryDate)}</p>
                          </div>
                        </td>

                        {/* Performance */}
                        <td className="px-5 py-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <Target size={12} className="text-green-500" />
                              <span className="text-xs font-semibold text-green-600">{metrics.taskCompletionRate}%</span>
                              <span className="text-xs text-gray-400">tasks</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Activity size={12} className="text-blue-500" />
                              <span className="text-xs font-semibold text-blue-600">{metrics.attendanceRate}%</span>
                              <span className="text-xs text-gray-400">attend.</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} size={11} className={i < evaluation.overallRating ? 'text-yellow-400 fill-current' : 'text-gray-200'} />
                              ))}
                            </div>
                          </div>
                        </td>

                        {/* Schedule */}
                        <td className="px-5 py-4">
                          {schedule.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">No tasks today</span>
                          ) : (
                            <div className="space-y-1.5">
                              {schedule.slice(0, 2).map((slot, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                  <Clock size={11} className="text-indigo-400 flex-shrink-0" />
                                  <span className="text-xs text-gray-500 whitespace-nowrap">{slot.time}</span>
                                  <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full truncate max-w-[80px]">{slot.task}</span>
                                </div>
                              ))}
                              {schedule.length > 2 && (
                                <p className="text-xs text-gray-400">+{schedule.length - 2} more</p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                              title="View Details"
                              onClick={() => setViewStaff(staffMember)}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all"
                              title="Generate Credentials"
                              onClick={() => handleViewCredentials(staffMember)}
                              disabled={credentialLoadingId === (staffMember._id || staffMember.id)}
                            >
                              <KeyRound size={15} />
                            </button>
                            <button
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                              title="Edit"
                              onClick={() => openEditForm(staffMember)}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-40"
                              title="Delete"
                              onClick={() => handleDeleteStaff(staffMember)}
                              disabled={deletingStaffId === (staffMember._id || staffMember.id)}
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

              {filteredStaff.length === 0 && !loading && (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                    <Users size={28} className="text-blue-400" />
                  </div>
                  <p className="text-gray-600 font-semibold">No staff found</p>
                  <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          )}

          {/* Footer count */}
          {!loading && filteredStaff.length > 0 && (
            <div className="px-5 py-3.5 border-t border-blue-100 bg-blue-50/30 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing <span className="font-semibold text-gray-700">{filteredStaff.length}</span> of{' '}
                <span className="font-semibold text-gray-700">{staff.length}</span> staff members
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Staff Modal ── */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-blue-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200">
                  <Plus size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-blue-900">Add New Staff</h2>
                  <p className="text-xs text-gray-500">Create staff profile and send login credentials</p>
                </div>
              </div>
              <button onClick={() => setShowAddForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                <XCircle size={18} />
              </button>
            </div>
            <form onSubmit={handleAddStaffSubmit} className="p-6">
              {renderFormFields(newStaffMember, handleAddStaffChange, false)}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-blue-100 pt-4">
                <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 text-sm font-medium">Save & Send Credentials</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Staff Modal ── */}
      {showEditForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-blue-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                  <Edit2 size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-blue-900">Edit Staff Member</h2>
                  <p className="text-xs text-gray-500">Update profile details</p>
                </div>
              </div>
              <button onClick={() => setShowEditForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                <XCircle size={18} />
              </button>
            </div>
            <form onSubmit={handleEditStaffSubmit} className="p-6">
              {renderFormFields(editStaffMember, handleEditStaffChange, true)}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-blue-100 pt-4">
                <button type="button" onClick={() => setShowEditForm(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 text-sm font-medium">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Staff Details Modal ── */}
      {viewStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            {/* Gradient header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 pt-6 pb-10 relative flex-shrink-0">
              <button onClick={() => setViewStaff(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all">
                <XCircle size={18} />
              </button>
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg flex-shrink-0 ${getAvatarColor(viewStaff.name).bg} ${getAvatarColor(viewStaff.name).text}`}>
                  {getInitials(viewStaff.name)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{viewStaff.name}</h2>
                  <p className="text-blue-200 text-sm font-mono mt-0.5">#{viewStaff.empId}</p>
                  <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    viewStaff.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${viewStaff.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {viewStaff.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto -mt-5">
              <div className="bg-white rounded-t-2xl px-6 pt-5 pb-6 space-y-5">
                {/* Contact */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Contact</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><Mail size={14} className="text-blue-500" /></div>
                      <div><p className="text-xs text-gray-400">Email</p><p className="text-sm font-medium text-gray-800">{viewStaff.email || '—'}</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0"><Phone size={14} className="text-emerald-500" /></div>
                      <div><p className="text-xs text-gray-400">Mobile</p><p className="text-sm font-medium text-gray-800">{viewStaff.mobile || '—'}</p></div>
                    </div>
                    {viewStaff.address && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0"><MapPin size={14} className="text-rose-500" /></div>
                        <div><p className="text-xs text-gray-400">Address</p><p className="text-sm font-medium text-gray-800">{viewStaff.address}</p></div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                {/* Professional */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Professional</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: <Briefcase size={14} className="text-blue-500" />, bg: 'bg-blue-50', label: 'Position', value: viewStaff.position },
                      { icon: <Building2 size={14} className="text-indigo-500" />, bg: 'bg-indigo-50', label: 'Department', value: viewStaff.department },
                      { icon: <GraduationCap size={14} className="text-violet-500" />, bg: 'bg-violet-50', label: 'Qualification', value: viewStaff.qualification },
                      { icon: <Award size={14} className="text-orange-500" />, bg: 'bg-orange-50', label: 'Experience', value: viewStaff.experience ? `${viewStaff.experience} yrs` : '—' },
                      { icon: <Calendar size={14} className="text-pink-500" />, bg: 'bg-pink-50', label: 'Joining Date', value: formatDate(viewStaff.joiningDate) },
                      { icon: <DollarSign size={14} className="text-green-500" />, bg: 'bg-green-50', label: 'Salary', value: formatMoney(viewStaff.salary) },
                    ].map(({ icon, bg, label, value }) => (
                      <div key={label} className="flex items-start gap-2.5">
                        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
                        <div><p className="text-xs text-gray-400">{label}</p><p className="text-sm font-medium text-gray-800">{value || '—'}</p></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Attendance & Payment */}
                <div className="border-t border-gray-100 pt-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Today's Overview</p>
                  <div className="flex gap-3">
                    <div className="flex-1 rounded-xl bg-gray-50 px-4 py-3 border border-gray-100">
                      <p className="text-xs text-gray-400 mb-1">Attendance</p>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        viewStaff.attendanceToday === 'Present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${viewStaff.attendanceToday === 'Present' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {viewStaff.attendanceToday}
                      </span>
                    </div>
                    <div className="flex-1 rounded-xl bg-gray-50 px-4 py-3 border border-gray-100">
                      <p className="text-xs text-gray-400 mb-1">Payment</p>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        viewStaff.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${viewStaff.paymentStatus === 'Paid' ? 'bg-green-500' : 'bg-orange-500'}`} />
                        {viewStaff.paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-1 flex items-center justify-between gap-3">
                  <button
                    onClick={() => { setViewStaff(null); handleViewCredentials(viewStaff); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <KeyRound size={15} />
                    Generate Credentials
                  </button>
                  <button onClick={() => setViewStaff(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Credentials Modal ── */}
      {credentialView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <KeyRound size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Login Credentials</h2>
                    <p className="text-blue-200 text-xs mt-0.5">Share these securely with the staff member</p>
                  </div>
                </div>
                <button onClick={() => setCredentialView(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all">
                  <XCircle size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${getAvatarColor(credentialView.name).bg} ${getAvatarColor(credentialView.name).text}`}>
                  {getInitials(credentialView.name || '')}
                </div>
                <div>
                  <p className="text-xs text-blue-500 font-medium">Staff Member</p>
                  <p className="text-sm font-semibold text-blue-900">{credentialView.name || 'Staff'}</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Login ID', value: credentialView.employeeCode || credentialView.username, field: 'id' },
                  { label: 'Password', value: credentialView.password, field: 'pass' },
                ].map(({ label, value, field }) => (
                  <div key={field}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
                    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <code className="text-sm font-mono text-gray-800">{value}</code>
                      <button
                        onClick={() => copyCredential(value, field)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all font-medium ${
                          copiedField === field ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 hover:bg-blue-100 hover:text-blue-700 text-gray-600'
                        }`}
                      >
                        {copiedField === field ? <Check size={12} /> : <Copy size={12} />}
                        {copiedField === field ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">Please ask the staff member to reset their password after first login.</p>
            </div>

            <div className="border-t border-gray-100 px-6 py-4 flex justify-end bg-gray-50/50">
              <button onClick={() => setCredentialView(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors text-sm font-medium">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
