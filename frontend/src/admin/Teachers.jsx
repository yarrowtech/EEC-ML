import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Mail,
  Phone,
  BookOpen,
  Eye,
  XCircle,
  Building2,
  KeyRound,
  Copy,
  Check,
  GraduationCap,
  MapPin,
  Briefcase,
  Calendar,
  User,
  Award,
  Hash,
  Crown,
  RefreshCcw,
  Loader2,
  X,
  FileDown,
  Upload,
  Archive,
  ArchiveRestore,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import CredentialGeneratorButton from './components/CredentialGeneratorButton';

const API_BASE = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '');

const TEACHERS_CACHE_PREFIX = 'admin_teachers_cache_v1';
const TEACHERS_CACHE_TTL_MS = 5 * 60 * 1000;

const AVATAR_COLORS = [
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
  { bg: 'bg-pink-100', text: 'text-pink-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
];

const getAvatarColor = (name) => {
  const hash = (name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const resolveImageUrl = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value.secure_url || value.url || value.path || '';
  }
  return '';
};

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const normalizeDayLabel = (value) => {
  const lower = String(value || '').trim().toLowerCase();
  return WEEK_DAYS.find((day) => day.toLowerCase() === lower) || null;
};

const getTodayCacheDateKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const parseDateOnly = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const primary = text.slice(0, 10);
  const matched = primary.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matched) {
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    const d = new Date(year, month - 1, day);
    if (
      d.getFullYear() === year &&
      d.getMonth() === (month - 1) &&
      d.getDate() === day
    ) {
      return d;
    }
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const toLocalDateKey = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatScheduleMeta = (entry) => {
  const dayLabel = entry?.dayOfWeek ? `${entry.dayOfWeek}:` : '';
  const classLabel = [entry?.className, entry?.sectionName].filter(Boolean).join('-');
  const timeLabel = [entry?.startTime, entry?.endTime].filter(Boolean).join('-');
  return [dayLabel, classLabel, timeLabel].filter(Boolean).join(' ');
};

const inputClass =
  'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all bg-white';

const resolveTeacherStatus = (teacher, todayCheckedInTeacherIds, todayApprovedLeaveTeacherIds) => {
  const teacherId = String(teacher?._id || teacher?.id || '');
  if (todayCheckedInTeacherIds.has(teacherId)) {
    return 'Present';
  }
  if (todayApprovedLeaveTeacherIds.has(teacherId)) {
    return 'On Leave';
  }
  return 'Absent';
};

const Teachers = ({setShowAdminHeader}) => {
  const [activeTab, setActiveTab] = useState('teachers');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [teachers, setTeachers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [credentialLoadingId, setCredentialLoadingId] = useState(null);
  const [deletingTeacherId, setDeletingTeacherId] = useState(null);
  const [deleteConfirmTeacher, setDeleteConfirmTeacher] = useState(null);
  const [credentialView, setCredentialView] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [viewTeacher, setViewTeacher] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [principalLoadingId, setPrincipalLoadingId] = useState(null);
  const [principalCredentialView, setPrincipalCredentialView] = useState(null);

  // Principals tab state
  const [principals, setPrincipals] = useState([]);
  const [loadingPrincipals, setLoadingPrincipals] = useState(false);
  const [principalSearchTerm, setPrincipalSearchTerm] = useState('');
  const [principalCredLoadingId, setPrincipalCredLoadingId] = useState(null);
  const [principalDeleteLoadingId, setPrincipalDeleteLoadingId] = useState(null);
  const [deleteConfirmPrincipal, setDeleteConfirmPrincipal] = useState(null);
  const [makePrincipalConfirmTeacher, setMakePrincipalConfirmTeacher] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [tableRefreshing, setTableRefreshing] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState([]);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [archivingTeacherId, setArchivingTeacherId] = useState(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archivedTeachers, setArchivedTeachers] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [unarchivingTeacherId, setUnarchivingTeacherId] = useState(null);
  const bulkFileInputRef = useRef(null);

  const principalIdentitySet = useMemo(() => {
    return new Set(
      (Array.isArray(principals) ? principals : [])
        .map((principal) => String(principal?.email || principal?.username || '').trim().toLowerCase())
        .filter(Boolean)
    );
  }, [principals]);

  const teacherPhotoByIdentity = useMemo(() => {
    const map = new Map();
    (Array.isArray(teachers) ? teachers : []).forEach((teacher) => {
      const identity = String(teacher?.email || teacher?.username || '').trim().toLowerCase();
      if (!identity) return;
      const photo = resolveImageUrl(teacher?.profilePic || teacher?.avatar || teacher?.photo);
      if (!photo) return;
      map.set(identity, photo);
    });
    return map;
  }, [teachers]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const [newTeacher, setNewTeacher] = useState({
    name: '',
    email: '',
    mobile: '',
    subject: '',
    department: '',
    experience: '',
    qualification: '',
    status: 'Active',
    joiningDate: '',
    gender: '',
    address: '',
    pinCode: '',
    location: '',
    avatar: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [formTouched, setFormTouched] = useState({});

  // Filter teachers based on search and status
  const filteredTeachers = teachers.filter(teacher => {
    const teacherName = (teacher.name || '').toLowerCase();
    const teacherSubject = (teacher.subject || '').toLowerCase();
    const teacherEmail = (teacher.email || '').toLowerCase();
    const matchesSearch = teacherName.includes(searchTerm.toLowerCase()) ||
                         teacherSubject.includes(searchTerm.toLowerCase()) ||
                         teacherEmail.includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || teacher.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTeachers = filteredTeachers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage);

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  const getTeachersCacheKey = () => {
    const token = localStorage.getItem('token');
    const dayKey = getTodayCacheDateKey();
    if (!token) return `${TEACHERS_CACHE_PREFIX}_anonymous_${dayKey}`;
    try {
      const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      const adminId = payload?.id || 'unknown';
      const schoolId = payload?.schoolId || 'school';
      const campusId = payload?.campusId || 'campus';
      return `${TEACHERS_CACHE_PREFIX}_${adminId}_${schoolId}_${campusId}_${dayKey}`;
    } catch {
      return `${TEACHERS_CACHE_PREFIX}_fallback_${dayKey}`;
    }
  };

  const readTeachersCache = () => {
    try {
      const cachedRaw = sessionStorage.getItem(getTeachersCacheKey());
      if (!cachedRaw) return null;
      const cached = JSON.parse(cachedRaw);
      if (!Array.isArray(cached?.teachers)) return null;
      const cachedAt = Number(cached?.cachedAt || 0);
      const isFresh = cachedAt > 0 && (Date.now() - cachedAt) <= TEACHERS_CACHE_TTL_MS;
      return { teachers: cached.teachers, isFresh };
    } catch (err) {
      console.warn('Unable to read teachers cache', err);
      return null;
    }
  };

  const writeTeachersCache = (teachersData) => {
    try {
      sessionStorage.setItem(
        getTeachersCacheKey(),
        JSON.stringify({ teachers: teachersData, cachedAt: Date.now() })
      );
    } catch (err) {
      console.warn('Unable to cache teachers data', err);
    }
  };

  const fetchTeachers = async ({ useCache = false } = {}) => {
    if (useCache) {
      const cached = readTeachersCache();
      if (cached?.teachers?.length) {
        setTeachers(cached.teachers);
      }
    }

    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`
    };

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const [teachersRes, attendanceRes, timetableRes, principalsRes, leavesRes] = await Promise.all([
      fetch(`${API_BASE}/api/admin/users/get-teachers`, {
        method: 'GET',
        headers
      }),
      fetch(`${API_BASE}/api/admin/users/teacher-attendance?month=${encodeURIComponent(monthKey)}`, {
        method: 'GET',
        headers
      }),
      fetch(`${API_BASE}/api/timetable/all`, {
        method: 'GET',
        headers
      }),
      fetch(`${API_BASE}/api/admin/users/get-principals`, {
        method: 'GET',
        headers
      }),
      fetch(`${API_BASE}/api/admin/users/teacher-leaves?status=Approved`, {
        method: 'GET',
        headers
      })
    ]);

    if (!teachersRes.ok) {
      throw new Error('Failed to fetch teachers');
    }

    const data = await teachersRes.json();
    const attendanceData = attendanceRes.ok ? await attendanceRes.json().catch(() => ({})) : {};
    const timetableData = timetableRes.ok ? await timetableRes.json().catch(() => []) : [];
    const leavesData = leavesRes.ok ? await leavesRes.json().catch(() => ({})) : {};
    const todayCheckedInTeacherIds = new Set(
      (Array.isArray(attendanceData?.records) ? attendanceData.records : [])
        .filter((record) => {
          if (!record?.checkInAt) return false;
          const recordDateKey = String(record?.date || '').trim();
          const checkInDateKey = toLocalDateKey(record?.checkInAt);
          return recordDateKey === todayKey || checkInDateKey === todayKey;
        })
        .map((record) => String(record?.teacherId))
    );
    const todayDate = parseDateOnly(todayKey);
    const todayApprovedLeaveTeacherIds = new Set(
      (Array.isArray(leavesData?.leaves) ? leavesData.leaves : [])
        .filter((leave) => {
          const leaveStatus = String(leave?.status || '').trim().toLowerCase();
          if (!(leaveStatus === 'approved' || leaveStatus === 'accepted')) return false;
          const start = parseDateOnly(leave?.startDate);
          const end = parseDateOnly(leave?.endDate);
          if (!todayDate || !start || !end) return false;
          if (end < start) return false;
          return start <= todayDate && todayDate <= end;
        })
        .map((leave) => String(leave?.teacherId || ''))
        .filter(Boolean)
    );
    const scheduleByTeacherId = new Map();

    (Array.isArray(timetableData) ? timetableData : []).forEach((timetable) => {
      const className = timetable?.classId?.name || '';
      const sectionName = timetable?.sectionId?.name || '';
      (Array.isArray(timetable?.entries) ? timetable.entries : []).forEach((entry) => {
        if (!entry?.teacherId || !entry?.dayOfWeek) return;
        const teacherId = String(entry.teacherId?._id || entry.teacherId);
        if (!teacherId) return;
        if (!scheduleByTeacherId.has(teacherId)) scheduleByTeacherId.set(teacherId, []);
        const dayOfWeek = normalizeDayLabel(entry.dayOfWeek);
        if (!dayOfWeek) return;
        scheduleByTeacherId.get(teacherId).push({
          dayOfWeek,
          period: entry.period,
          startTime: entry.startTime || '',
          endTime: entry.endTime || '',
          subjectName: entry?.subjectId?.name || '',
          className,
          sectionName,
        });
      });
    });

    const principalsData = principalsRes.ok ? await principalsRes.json().catch(() => []) : [];
    setPrincipals(Array.isArray(principalsData) ? principalsData : []);
    const principalEmailSet = new Set(
      (Array.isArray(principalsData) ? principalsData : [])
        .map((principal) => String(principal?.email || principal?.username || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const normalized = (Array.isArray(data) ? data : []).map((teacher, idx) => ({
      ...teacher,
      id: teacher._id || teacher.id || idx,
      name: teacher.name || 'Unnamed Teacher',
      email: teacher.email || '-',
      mobile: teacher.mobile || '-',
      subject: teacher.subject || '-',
      department: teacher.department || '-',
      qualification: teacher.qualification || '-',
      joiningDate: teacher.joiningDate || teacher.joinDate || '',
      empId: teacher.employeeCode || teacher.empId || '-',
      profilePic: resolveImageUrl(teacher.profilePic || teacher.avatar || teacher.photo),
      scheduleTodayEntries: [...(scheduleByTeacherId.get(String(teacher._id || teacher.id || '')) || [])]
        .sort((a, b) => {
          const dayDiff = WEEK_DAYS.indexOf(a.dayOfWeek) - WEEK_DAYS.indexOf(b.dayOfWeek);
          if (dayDiff !== 0) return dayDiff;
          return (Number(a.period) || 0) - (Number(b.period) || 0);
        }),
      isPrincipal: principalEmailSet.has(String(teacher.email || '').trim().toLowerCase()),
      status: resolveTeacherStatus(teacher, todayCheckedInTeacherIds, todayApprovedLeaveTeacherIds)
    }));
    setTeachers(normalized);
    writeTeachersCache(normalized);
  };

  const handleRefreshTableData = async () => {
    setTableRefreshing(true);
    try {
      await fetchTeachers({ useCache: false });
    } catch (err) {
      toast.error(err.message || 'Failed to refresh teachers data');
    } finally {
      setTableRefreshing(false);
    }
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const fetchPrincipals = async () => {
    setLoadingPrincipals(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/get-principals`, {
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setPrincipals(Array.isArray(data) ? data : (data.principals || []));
      }
    } catch (err) {
      console.error('Error fetching principals:', err);
    } finally {
      setLoadingPrincipals(false);
    }
  };

  const handleViewPrincipalCredentials = async (principal) => {
    const principalId = principal?._id || principal?.id;
    if (!principalId) return;
    setPrincipalCredLoadingId(principalId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/principals/${principalId}/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to load credentials');
      const canCopy = !data?.lastLoginAt && data?.initialPassword; // canCopy is not used here, but it is in the JSX. Let's keep it.
      const principalResetAt = data?.lastLoginAt ? new Date(data.lastLoginAt) : null;
      const passwordValue = principalResetAt
        ? `Password reset by the principal at ${principalResetAt.toLocaleDateString()}`
        : (data?.initialPassword || 'Not available');
      setPrincipalCredentialView({
        name: data?.name || principal.name,
        photo: resolveImageUrl(principal?.profilePic) || teacherPhotoByIdentity.get(String(principal?.email || principal?.username || '').trim().toLowerCase()) || '',
        username: data.username || data.email || principal.email,
        email: data.email || principal.email,
        password: passwordValue
      });
    } catch (error) {
      setSubmitStatus({ type: 'error', message: error.message || 'Unable to load credentials' });
    } finally {
      setPrincipalCredLoadingId(null);
    }
  };

  const handleDeletePrincipal = async (principal) => {
    const principalId = principal?._id || principal?.id;
    if (!principalId || principalDeleteLoadingId) return;
    const removedPrincipalEmail = String(principal?.email || principal?.username || '').trim().toLowerCase();

    setPrincipalDeleteLoadingId(principalId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/principals/${principalId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Unable to delete principal');
      }

      setPrincipals((prev) => prev.filter((item) => String(item._id || item.id) !== String(principalId)));
      if (removedPrincipalEmail) {
        setTeachers((prev) =>
          prev.map((teacher) => {
            const teacherEmail = String(teacher?.email || '').trim().toLowerCase();
            if (teacherEmail !== removedPrincipalEmail) return teacher;
            return { ...teacher, isPrincipal: false };
          })
        );
      }
      setSubmitStatus(null);
      toast.success(`${principal?.name || 'Principal'} deleted successfully.`);
      await Promise.allSettled([
        fetchPrincipals(),
        fetchTeachers({ useCache: false }),
      ]);
    } catch (error) {
      setSubmitStatus(null);
      toast.error(error.message || 'Unable to delete principal');
    } finally {
      setPrincipalDeleteLoadingId(null);
      setDeleteConfirmPrincipal(null);
    }
  };

  useEffect(() => {
    setShowAdminHeader(true);
    fetchTeachers({ useCache: true }).catch(err => {
      console.error("Error fetching teachers:", err);
    });
  }, [setShowAdminHeader]);

  useEffect(() => {
    if (activeTab !== 'teachers') return undefined;
    const intervalId = window.setInterval(() => {
      fetchTeachers({ useCache: false }).catch((err) => {
        console.error('Error refreshing teachers:', err);
      });
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'principals' && principals.length === 0) {
      fetchPrincipals();
    }
  }, [activeTab]);

  const validateTeacherForm = (data) => {
    const errors = {};
    if (!data.name.trim()) {
      errors.name = 'Full name is required.';
    } else if (data.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters.';
    }
    if (!data.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (!data.mobile.trim()) {
      errors.mobile = 'Contact number is required.';
    } else if (!/^\+?[\d\s\-]{7,15}$/.test(data.mobile.trim())) {
      errors.mobile = 'Enter a valid contact number (7–15 digits).';
    }
    if (data.experience !== '' && (isNaN(Number(data.experience)) || Number(data.experience) < 0)) {
      errors.experience = 'Experience must be a non-negative number.';
    }
    if (data.pinCode && !/^\d{4,10}$/.test(data.pinCode.trim())) {
      errors.pinCode = 'Enter a valid pin code (4–10 digits).';
    }
    if (data.joiningDate) {
      const d = new Date(data.joiningDate);
      if (isNaN(d.getTime())) errors.joiningDate = 'Enter a valid date.';
    }
    return errors;
  };

  const handleAddTeacherChange = (e) => {
    const { name, value } = e.target;
    setNewTeacher(prev => ({ ...prev, [name]: value }));
    if (formTouched[name]) {
      const errors = validateTeacherForm({ ...newTeacher, [name]: value });
      setFormErrors(prev => ({ ...prev, [name]: errors[name] || '' }));
    }
  };

  const handleFormBlur = (e) => {
    const { name } = e.target;
    setFormTouched(prev => ({ ...prev, [name]: true }));
    const errors = validateTeacherForm(newTeacher);
    setFormErrors(prev => ({ ...prev, [name]: errors[name] || '' }));
  };

  const resetTeacherForm = () => {
    setNewTeacher({
      name: '',
      email: '',
      mobile: '',
      subject: '',
      department: '',
      experience: '',
      qualification: '',
      status: 'Active',
      joiningDate: '',
      gender: '',
      address: '',
      pinCode: '',
      location: '',
      avatar: ''
    });
    setEditingTeacherId(null);
    setFormErrors({});
    setFormTouched({});
  };

  const handleEditTeacher = (teacher) => {
    const teacherId = teacher?._id || teacher?.id;
    if (!teacherId) return;
    setEditingTeacherId(teacherId);
    setNewTeacher({
      name: teacher?.name || '',
      email: teacher?.email || '',
      mobile: teacher?.mobile || '',
      subject: teacher?.subject || '',
      department: teacher?.department || '',
      experience: teacher?.experience || '',
      qualification: teacher?.qualification || '',
      status: teacher?.status || 'Active',
      joiningDate: teacher?.joiningDate || '',
      gender: teacher?.gender || '',
      address: teacher?.address || '',
      pinCode: teacher?.pinCode || '',
      location: teacher?.location || '',
      avatar: teacher?.avatar || ''
    });
    setShowAddForm(true);
  };

  const handleAddTeacherSubmit = async (e) => {
    e.preventDefault();
    const allFields = ['name', 'email', 'mobile', 'experience', 'pinCode', 'joiningDate'];
    setFormTouched(allFields.reduce((acc, f) => ({ ...acc, [f]: true }), {}));
    const errors = validateTeacherForm(newTeacher);
    setFormErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    try {
      setSubmitStatus(null);
      const payload = {
        name: newTeacher.name,
        email: newTeacher.email,
        mobile: newTeacher.mobile,
        subject: newTeacher.subject,
        department: newTeacher.department,
        experience: newTeacher.experience,
        qualification: newTeacher.qualification,
        status: newTeacher.status,
        joiningDate: newTeacher.joiningDate,
        gender: newTeacher.gender,
        address: newTeacher.address,
        pinCode: newTeacher.pinCode
      };

      const isEditMode = Boolean(editingTeacherId);
      const endpoint = isEditMode
        ? `${API_BASE}/api/admin/users/teachers/${editingTeacherId}`
        : `${import.meta.env.VITE_API_URL}/api/teacher/auth/register`;
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Teacher save failed:', data);
        throw new Error(data?.error || 'Unable to save teacher');
      }

      if (isEditMode) {
        setSubmitStatus({ type: 'success', message: 'Teacher updated successfully.' });
      } else {
        setSubmitStatus(null);
        toast.success(
          data?.emailSent
            ? 'Teacher added and credentials emailed.'
            : 'Teacher added. Email not sent.'
        );
        if (data?.username && data?.password) {
          setCredentialView({
            name: newTeacher.name,
            username: data.username,
            employeeCode: data.employeeCode || data.username,
            password: data.password
          });
        }
      }
      setShowAddForm(false);
      await fetchTeachers();
      resetTeacherForm();
    }
    catch (error) {
      console.error('Error saving teacher:', error);
      if (editingTeacherId) {
        setSubmitStatus({ type: 'error', message: error.message || 'Unable to save teacher' });
      } else {
        setSubmitStatus(null);
        toast.error(error.message || 'Unable to add teacher');
      }
    }
  };

  const handleViewCredentials = async (teacher) => {
    const teacherId = teacher?._id || teacher?.id;
    if (!teacherId) return;
    setCredentialLoadingId(teacherId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/teachers/${teacherId}/credentials`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to load credentials');
      }
      const teacherResetAt = data?.lastLoginAt ? new Date(data.lastLoginAt) : null;
      const hasUserReset = Boolean(teacherResetAt);
      setCredentialView({
        id: teacherId,
        photo: resolveImageUrl(teacher?.profilePic),
        name: data?.name || teacher.name,
        username: data?.username || teacher.username || teacher.employeeCode,
        employeeCode: data.employeeCode || data.username,
        password: hasUserReset
          ? `Password reset by the user at ${teacherResetAt.toLocaleString()}`
          : (data?.initialPassword || 'Not available'),
        canCopyPassword: !hasUserReset && Boolean(data?.initialPassword)
      });
    } catch (error) {
      setSubmitStatus({ type: 'error', message: error.message || 'Unable to load credentials' });
    } finally {
      setCredentialLoadingId(null);
    }
  };

  const handleResetCredentials = async () => {
    const teacherId = credentialView?.id;
    if (!teacherId) return;
    setCredentialLoadingId(teacherId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/teachers/${teacherId}/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to reset credentials');
      }
      setCredentialView((prev) => ({
        ...(prev || {}),
        id: teacherId,
        name: data?.name || prev?.name || 'Teacher',
        username: data?.username || prev?.username || '',
        employeeCode: data?.employeeCode || data?.username || prev?.employeeCode || '',
        password: data?.password || 'Not available',
        canCopyPassword: Boolean(data?.password)
      }));
      setSubmitStatus({ type: 'success', message: 'Teacher password reset successfully.' });
    } catch (error) {
      setSubmitStatus({ type: 'error', message: error.message || 'Unable to reset credentials' });
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

  const handleDeleteTeacher = async (teacher) => {
    const teacherId = teacher?._id || teacher?.id;
    if (!teacherId || deletingTeacherId) return;

    setDeletingTeacherId(teacherId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/teachers/${teacherId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Unable to delete teacher');
      }

      setTeachers((prev) => prev.filter((item) => String(item._id || item.id) !== String(teacherId)));
      setSubmitStatus(null);
      toast.success(`${teacher.name || 'Teacher'} deleted successfully.`);
      fetchTeachers().catch(console.error);
    } catch (error) {
      setSubmitStatus(null);
      toast.error(error.message || 'Unable to delete teacher');
    } finally {
      setDeletingTeacherId(null);
      setDeleteConfirmTeacher(null);
    }
  };

  /* -------------------- Bulk selection -------------------- */
  const toggleTeacherSelection = (teacherId) => {
    if (!teacherId) return;
    const id = String(teacherId);
    setSelectedTeacherIds((prev) => {
      const set = new Set(prev.map(String));
      if (set.has(id)) set.delete(id); else set.add(id);
      return Array.from(set);
    });
  };

  const filteredTeacherIds = useMemo(
    () => filteredTeachers.map((t) => String(t._id || t.id)).filter(Boolean),
    [filteredTeachers]
  );
  const isAllFilteredSelected = filteredTeacherIds.length > 0
    && filteredTeacherIds.every((id) => selectedTeacherIds.includes(id));

  const toggleSelectAllFilteredTeachers = () => {
    setSelectedTeacherIds(isAllFilteredSelected ? [] : filteredTeacherIds);
  };

  /* -------------------- Archive (single + bulk) -------------------- */
  const handleArchiveTeacher = async (teacher) => {
    const teacherId = teacher?._id || teacher?.id;
    if (!teacherId || archivingTeacherId) return;
    setArchivingTeacherId(teacherId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/teachers/${teacherId}/archive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to archive teacher');
      // Instant: drop it from the visible list right away instead of waiting on a refetch.
      setTeachers((prev) => prev.filter((item) => String(item._id || item.id) !== String(teacherId)));
      setSelectedTeacherIds((prev) => prev.filter((id) => id !== String(teacherId)));
      toast.success(`${teacher.name || 'Teacher'} archived.`);
    } catch (error) {
      toast.error(error.message || 'Unable to archive teacher');
    } finally {
      setArchivingTeacherId(null);
    }
  };

  const handleBulkArchiveTeachers = async () => {
    if (!selectedTeacherIds.length || isBulkArchiving) return;
    setIsBulkArchiving(true);
    const ids = [...selectedTeacherIds];
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/teachers/bulk/archive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ids })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to archive teachers');
      const idSet = new Set(ids.map(String));
      setTeachers((prev) => prev.filter((item) => !idSet.has(String(item._id || item.id))));
      setSelectedTeacherIds([]);
      toast.success(`${data?.archived ?? ids.length} teacher(s) archived.`);
    } catch (error) {
      toast.error(error.message || 'Unable to archive teachers');
    } finally {
      setIsBulkArchiving(false);
    }
  };

  const fetchArchivedTeachers = async () => {
    setLoadingArchived(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/teachers/archived`, {
        headers: { authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Unable to load archived teachers');
      setArchivedTeachers(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error.message || 'Unable to load archived teachers');
    } finally {
      setLoadingArchived(false);
    }
  };

  const openArchiveModal = () => {
    setShowArchiveModal(true);
    fetchArchivedTeachers();
  };

  const handleUnarchiveTeacher = async (teacher) => {
    const teacherId = teacher?._id || teacher?.id;
    if (!teacherId || unarchivingTeacherId) return;
    setUnarchivingTeacherId(teacherId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/teachers/${teacherId}/unarchive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to unarchive teacher');
      setArchivedTeachers((prev) => prev.filter((item) => String(item._id || item.id) !== String(teacherId)));
      fetchTeachers({ useCache: false }).catch(console.error);
      toast.success(`${teacher.name || 'Teacher'} restored.`);
    } catch (error) {
      toast.error(error.message || 'Unable to unarchive teacher');
    } finally {
      setUnarchivingTeacherId(null);
    }
  };

  const exportTeachersPdf = () => {
    const doc = new jsPDF('l', 'pt', 'a4');
    const marginX = 36;
    let y = 36;
    const now = new Date();
    const tableHeaders = ['#', 'Name', 'Employee ID', 'Email', 'Mobile', 'Subject', 'Department', 'Status'];
    const columnWidths = [24, 120, 90, 170, 90, 100, 100, 70];
    const rows = [...teachers]
      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
      .map((teacher, index) => ([
        String(index + 1),
        String(teacher?.name || '-'),
        String(teacher?.empId || teacher?.employeeCode || teacher?.username || '-'),
        String(teacher?.email || '-'),
        String(teacher?.mobile || '-'),
        String(teacher?.subject || '-'),
        String(teacher?.department || '-'),
        String(teacher?.status || '-'),
      ]));

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 78, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('Teachers List Report', marginX, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${now.toLocaleString('en-IN')}`, marginX, 62);
    doc.text(`Total Teachers: ${teachers.length}`, marginX + 260, 62);

    y = 100;
    const rowHeight = 24;
    const drawHeader = () => {
      let x = marginX;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      tableHeaders.forEach((header, idx) => {
        const width = columnWidths[idx];
        doc.setFillColor(30, 64, 175);
        doc.rect(x, y, width, rowHeight, 'F');
        doc.text(header, x + 4, y + 16);
        x += width;
      });
      y += rowHeight;
    };

    const drawRow = (row, isAlt) => {
      let x = marginX;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      row.forEach((cell, idx) => {
        const width = columnWidths[idx];
        doc.setFillColor(isAlt ? 248 : 255, isAlt ? 250 : 255, isAlt ? 252 : 255);
        doc.rect(x, y, width, rowHeight, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(x, y, width, rowHeight);
        const text = doc.splitTextToSize(String(cell), width - 8);
        doc.text(text[0] || '-', x + 4, y + 16);
        x += width;
      });
      y += rowHeight;
    };

    drawHeader();
    rows.forEach((row, index) => {
      if (y + rowHeight > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        y = 36;
        drawHeader();
      }
      drawRow(row, index % 2 === 0);
    });

    const fileDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    doc.save(`teachers_list_${fileDate}.pdf`);
  };

  const generateBulkTeacherPassword = (seed = 0) => {
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `Teach@${randomPart}${seed % 10}a`;
  };

  const normalizeBulkTeacherRow = (row = {}) => {
    const read = (keys = []) => {
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== undefined && row[key] !== null) {
          return String(row[key]).trim();
        }
      }
      return '';
    };
    const normalizeGender = (value) => {
      const normalized = String(value || '').trim().toLowerCase();
      if (!normalized) return '';
      if (normalized === 'male' || normalized === 'm') return 'male';
      if (normalized === 'female' || normalized === 'f') return 'female';
      if (normalized === 'other' || normalized === 'o') return 'other';
      return normalized;
    };

    return {
      name: read(['name', 'Name', 'teacherName', 'Teacher Name']),
      email: read(['email', 'Email']),
      mobile: read(['mobile', 'Mobile', 'phone', 'Phone']),
      gender: normalizeGender(read(['gender', 'Gender'])),
      qualification: read(['qualification', 'Qualification']),
      subject: read(['subject', 'Subject']),
      department: read(['department', 'Department']),
      experience: read(['experience', 'Experience']),
      joiningDate: read(['joiningDate', 'Joining Date', 'joining_date']),
      address: read(['address', 'Address']),
      pinCode: read(['pinCode', 'Pincode', 'Pin Code', 'pin_code']),
      // password: read(['password', 'Password']) || generateBulkTeacherPassword(idx + 1),
    };
  };

  const downloadTeacherDemoTemplate = () => {
    const rows = [
      {
        name: 'Koushik Bala',
        email: 'koushik.bala@example.com',
        mobile: '1234567890',
        gender: 'male',
        qualification: 'M.Sc',
        subject: 'Mathematics',
        department: 'Science',
        experience: '5',
        joiningDate: '2026-04-01',
        address: 'Kolkata',
        pinCode: '700001',
        // password: 'Teach@123a',
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Teachers');
    XLSX.writeFile(workbook, 'teacher_bulk_upload_template.xlsx');
  };

  const handleBulkUploadTeachers = async (file) => {
    if (!file) return;
    setBulkUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new Error('Uploaded file has no sheet.');
      const worksheet = workbook.Sheets[firstSheet];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      const normalizedRows = rawRows
        .map((row) => normalizeBulkTeacherRow(row))
        .filter((row) => row.name || row.email || row.mobile);

      if (!normalizedRows.length) {
        throw new Error('No teacher rows found in the uploaded file.');
      }

      const res = await fetch(`${API_BASE}/api/admin/users/bulk-create-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          role: 'teacher',
          users: normalizedRows,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Bulk upload failed');
      }

      const created = Number(data?.created || 0);
      const failed = Number(data?.failed || 0);
      if (created > 0) {
        toast.success(`${created} teacher(s) uploaded successfully.`);
      }
      if (failed > 0) {
        const firstError = Array.isArray(data?.errors) && data.errors[0]?.error ? ` First error: ${data.errors[0].error}` : '';
        toast.error(`${failed} row(s) failed.${firstError}`);
      }
      await fetchTeachers({ useCache: false });
    } catch (error) {
      toast.error(error.message || 'Unable to upload teachers');
    } finally {
      setBulkUploading(false);
      if (bulkFileInputRef.current) {
        bulkFileInputRef.current.value = '';
      }
    }
  };

  const handleMakePrincipal = async (teacher) => {
    const teacherId = teacher?._id || teacher?.id;
    if (!teacherId) return;
    setPrincipalLoadingId(teacherId);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/teachers/${teacherId}/make-principal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to create principal account');
      }
      setPrincipalCredentialView({
        name: data.teacherName || teacher.name,
        username: data.username,
        email: data.email,
        password: data.password
      });
      setSubmitStatus(null);
      toast.success(`Principal account created for ${teacher.name || 'teacher'}`);
    } catch (error) {
      setSubmitStatus(null);
      toast.error(error.message || 'Unable to create principal account');
    } finally {
      setPrincipalLoadingId(null);
      setMakePrincipalConfirmTeacher(null);
    }
  };

  return (
    // Same page shell as /admin/students and /admin/parents — plain header,
    // filter bar, content card — recolored sky-blue instead of yellow/emerald.
    <div className="page-fade-in flex h-[calc(100dvh-94px)] flex-col overflow-hidden bg-gray-50">
      <div className="w-full flex-1 flex flex-col p-3 md:p-5 lg:p-6 overflow-hidden text-sm md:text-base">
        {/* Header */}
        <div className="flex flex-col sm:flex-wrap gap-3 sm:justify-between sm:items-center mb-1 flex-shrink-0">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 text-center">
              Teachers
            </h1>
            <p className="text-gray-500 mt-1 text-sm text-center">
              Manage your teaching staff, credentials, and principal assignments
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-stretch sm:justify-start">
            <button
              onClick={() => {
                resetTeacherForm();
                setShowAddForm(true);
              }}
              className="bg-sky-500 text-white px-3 py-2 rounded-full hover:bg-sky-600 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
            >
              <Plus size={15} /> Add
            </button>
            
            <button
              onClick={downloadTeacherDemoTemplate}
              className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
            >
              <FileDown size={15} /> Demo
            </button>
            <button
              onClick={() => bulkFileInputRef.current?.click()}
              disabled={bulkUploading}
              className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 disabled:opacity-60 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
            >
              <Upload size={15} /> {bulkUploading ? 'Uploading...' : 'Bulk Upload'}
            </button>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBulkUploadTeachers(file);
              }}
            />
            <button
              onClick={exportTeachersPdf}
              className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
            >
              <FileDown size={15} /> Download Data
            </button>
            
            {activeTab === 'teachers' && selectedTeacherIds.length > 0 && (
              <button
                onClick={handleBulkArchiveTeachers}
                disabled={isBulkArchiving}
                className="bg-sky-600 text-white px-3 py-2 rounded-full hover:bg-sky-700 disabled:opacity-60 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
                title={`Archive ${selectedTeacherIds.length} selected teacher(s)`}
              >
                {isBulkArchiving ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />}
                {isBulkArchiving ? 'Archiving...' : `Archive (${selectedTeacherIds.length})`}
              </button>
            )}
            {activeTab === 'teachers' && (
              <button
                onClick={toggleSelectAllFilteredTeachers}
                disabled={filteredTeacherIds.length === 0}
                className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 disabled:opacity-60 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
                title={isAllFilteredSelected ? 'Clear selection' : `Select all ${filteredTeacherIds.length} teacher(s)`}
              >
                <CheckCircle size={15} />
                {isAllFilteredSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
            <button
              onClick={openArchiveModal}
              className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
            >
              <Archive size={15} /> Archived
            </button>
            <button
              onClick={handleRefreshTableData}
              disabled={tableRefreshing}
              className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 disabled:opacity-60 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
              title="Refresh teachers table data"
            >
              {tableRefreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
              {tableRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {submitStatus && (
          <div
            className={`mt-2 rounded-xl border px-4 py-3 text-sm flex items-center gap-2 flex-shrink-0 ${
              submitStatus.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {submitStatus.type === 'success'
              ? <Check size={15} className="flex-shrink-0" />
              : <XCircle size={15} className="flex-shrink-0" />}
            {submitStatus.message}
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0">
          {/* Tabs */}
          <div className="relative mt-1 mb-2 flex justify-center items-center gap-1 p-1.5 bg-white border border-gray-200 rounded-full w-fit shadow-sm flex-shrink-0">
            {[
              { key: 'teachers', label: 'Teachers', icon: GraduationCap, count: teachers.length },
              { key: 'principals', label: 'Principals', icon: Crown, count: principals.length },
            ].map((tab) => {
              const TabIcon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative z-10 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    active ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {active && (
                    <Motion.span
                      layoutId="teachersTabIndicator"
                      className="absolute inset-0 -z-10 rounded-full bg-sky-500 shadow-sm"
                      transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
                    />
                  )}
                  <TabIcon size={15} />
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filter Bar — Teachers only */}
          {activeTab === 'teachers' && (
            <div className="mb-1 p-3 md:p-4 flex-shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px] relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, subject or email..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[130px]"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="All">All Status</option>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="On Leave">On Leave</option>
                </select>
                {filterStatus !== 'All' && (
                  <button
                    onClick={() => setFilterStatus('All')}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X size={14} /> Clear
                  </button>
                )}
              </div>
              {filterStatus !== 'All' && (
                <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500">Active filters:</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-100 text-sky-800 rounded-full text-xs font-medium">
                    Status: {filterStatus}
                    <button onClick={() => setFilterStatus('All')} className="hover:text-sky-600"><X size={12} /></button>
                  </span>
                </div>
              )}
            </div>
          )}

        {/* Teachers Table */}
        {activeTab === 'teachers' && <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-slate-50/80 border-b border-gray-100">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Teacher</th>
                  {/* <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th> */}
                  {/* <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject & Dept</th> */}
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Weekly Routine</th>
                  {/* <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Qualification</th> */}
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentTeachers.map((teacher) => {
                  const avatarColor = getAvatarColor(teacher.name);
                  const teacherInitials = (teacher.name || 'NA').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  const teacherIsPrincipal = principalIdentitySet.has(String(teacher?.email || '').trim().toLowerCase());
                  return (
                    <tr key={teacher._id || teacher.id} className="hover:bg-sky-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${avatarColor.bg} flex items-center justify-center text-sm font-bold ${avatarColor.text} flex-shrink-0 overflow-hidden`}>
                            {teacher.profilePic ? (
                              <img
                                src={teacher.profilePic}
                                alt={teacher.name || 'Teacher'}
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              teacherInitials
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                              <span>{teacher.name}</span>
                              {teacherIsPrincipal && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 text-[11px] font-semibold">
                                  <Crown size={11} />
                                  Principal
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 font-mono">ID:{teacher.empId}</div>
                          </div>
                        </div>
                      </td>
                      {/* <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail size={13} className="mr-2 text-sky-400 flex-shrink-0" />
                            <span className="truncate max-w-[180px]">{teacher.email}</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone size={13} className="mr-2 text-emerald-400 flex-shrink-0" />
                            <span>{teacher.mobile}</span>
                          </div>
                        </div>
                      </td> */}
                      {/* <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center text-sm font-medium text-gray-800">
                            <BookOpen size={13} className="mr-2 text-sky-400 flex-shrink-0" />
                            {teacher.subject}
                          </div>
                          <span className="inline-block text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                            {teacher.department}
                          </span>
                        </div>
                      </td> */}
                      <td className="px-6 py-4">
                        {teacher.scheduleTodayEntries?.length ? (
                          <div className="space-y-2 min-w-[250px]">
                            {teacher.scheduleTodayEntries.slice(0, 1).map((entry, idx) => (
                              <div key={`${teacher.id || teacher._id}-sched-${idx}`} className="text-sm">
                                <div className="font-medium text-gray-800">{entry.subjectName || 'Class'}</div>
                                <div className="text-xs text-gray-500">({formatScheduleMeta(entry)})</div>
                              </div>
                            ))}
                            {teacher.scheduleTodayEntries.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setScheduleModal({ teacherName: teacher.name, entries: teacher.scheduleTodayEntries })}
                                className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                              >
                                More ({teacher.scheduleTodayEntries.length - 1})
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">No routine assigned</div>
                        )}
                      </td>
                      {/* <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-800">{teacher.qualification || '-'}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Joined: {teacher.joiningDate ? new Date(teacher.joiningDate).toLocaleDateString() : '-'}
                        </div>
                      </td> */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                          ${teacher.status === 'Present'
                            ? 'bg-emerald-100 text-emerald-700'
                            : teacher.status === 'Absent'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            teacher.status === 'Present'
                              ? 'bg-emerald-500'
                              : teacher.status === 'Absent'
                                ? 'bg-rose-500'
                                : 'bg-amber-500'
                          }`} />
                          {teacher.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleViewCredentials(teacher)}
                            disabled={credentialLoadingId === (teacher._id || teacher.id)}
                            className="inline-flex items-center gap-1.5 rounded-full font-medium bg-amber-500 text-white hover:bg-amber-600 transition p-1 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                            title="View Credentials"
                          >
                            <KeyRound size={13} />
                            {credentialLoadingId === (teacher._id || teacher.id) ? '' : ''}
                          </button>
                          <button
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-all"
                            title="View Details"
                            onClick={() => setViewTeacher(teacher)}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-all disabled:opacity-40"
                            title={teacherIsPrincipal ? 'Already Principal' : 'Make Principal'}
                            onClick={() => setMakePrincipalConfirmTeacher(teacher)}
                            disabled={teacherIsPrincipal || principalLoadingId === (teacher._id || teacher.id)}
                          >
                            <Crown size={15} />
                          </button>
                          <button
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
                            title="Edit"
                            onClick={() => handleEditTeacher(teacher)}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-40"
                            title="Delete"
                            onClick={() => setDeleteConfirmTeacher(teacher)}
                            disabled={deletingTeacherId === (teacher._id || teacher.id)}
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
          {filteredTeachers.length > 0 && (
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-sm text-gray-500">
                  Showing{' '}
                  <span className="font-semibold text-gray-700">{indexOfFirstItem + 1}</span>
                  {' '}–{' '}
                  <span className="font-semibold text-gray-700">{Math.min(indexOfLastItem, filteredTeachers.length)}</span>
                  {' '}of{' '}
                  <span className="font-semibold text-gray-700">{filteredTeachers.length}</span> teachers
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={prevPage}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <div className="flex gap-1">
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => paginate(i + 1)}
                        className={`w-8 h-8 rounded-full text-sm font-medium transition-all
                          ${currentPage === i + 1
                            ? 'bg-sky-600 text-white shadow-sm shadow-sky-200'
                            : 'border border-gray-200 text-gray-600 bg-white hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200'
                          }`}
                      >
                        {i + 1}
                      </button>
                    )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
                  </div>
                  <button
                    onClick={nextPage}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredTeachers.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center mx-auto mb-4">
                <GraduationCap size={28} className="text-sky-400" />
              </div>
              <p className="text-gray-600 font-semibold">No teachers found</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          )}
        </div>}

        {/* Principals Tab */}
        {activeTab === 'principals' && (
          <div>
            {/* Principals search */}
            <div className="mb-4 flex flex-col sm:flex-row gap-3 mt-4">
              <div className="flex-1 relative">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent bg-white shadow-sm text-sm"
                  value={principalSearchTerm}
                  onChange={(e) => setPrincipalSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={fetchPrincipals}
                className="sm:w-auto px-4 py-2.5 border border-gray-200 rounded-full bg-white hover:bg-gray-50 text-sm text-gray-600 font-medium shadow-sm transition-colors"
              >
                <RefreshCcw />
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-sky-50 to-pink-50/50 border-b border-gray-100">
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Principal</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Login ID</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loadingPrincipals ? (
                      <tr>
                        <td colSpan={4} className="py-16 text-center">
                          <div className="flex items-center justify-center gap-2 text-gray-400">
                            <span className="w-5 h-5 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin" />
                            Loading principals...
                          </div>
                        </td>
                      </tr>
                    ) : principals.filter(p => {
                        const q = principalSearchTerm.toLowerCase();
                        return !q || (p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q);
                      }).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-16 text-center">
                          <div className="w-14 h-14 rounded-2xl bg-sky-50 flex items-center justify-center mx-auto mb-3">
                            <Crown size={24} className="text-sky-300" />
                          </div>
                          <p className="text-gray-500 font-medium text-sm">No principals found</p>
                          <p className="text-gray-400 text-xs mt-1">Assign a teacher as principal using the Teachers tab</p>
                        </td>
                      </tr>
                    ) : (
                      principals
                        .filter(p => {
                          const q = principalSearchTerm.toLowerCase();
                          return !q || (p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q);
                        })
                        .map((principal) => {
                          const avatarColor = getAvatarColor(principal.name);
                          const initials = (principal.name || 'P').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                          const loginId = principal.username || principal.employeeCode || principal.email || '—';
                          const principalIdentity = String(principal?.email || principal?.username || '').trim().toLowerCase();
                          const principalPhoto = resolveImageUrl(principal?.profilePic) || teacherPhotoByIdentity.get(principalIdentity) || '';
                          return (
                            <tr key={principal._id || principal.id} className="hover:bg-sky-50/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-xl ${avatarColor.bg} flex items-center justify-center text-sm font-bold ${avatarColor.text} flex-shrink-0 overflow-hidden`}>
                                    {principalPhoto ? (
                                      <img src={principalPhoto} alt={principal.name} className="w-full h-full object-cover" />
                                    ) : initials}
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                      {principal.name}
                                      <Crown size={12} className="text-sky-400" />
                                    </div>
                                    <div className="text-xs text-gray-400">Principal</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-1.5">
                                  <div className="flex items-center text-sm text-gray-600">
                                    <Mail size={13} className="mr-2 text-sky-400 flex-shrink-0" />
                                    <span className="truncate max-w-[180px]">{principal.email || '—'}</span>
                                  </div>
                                  {principal.mobile && (
                                    <div className="flex items-center text-sm text-gray-600">
                                      <Phone size={13} className="mr-2 text-emerald-400 flex-shrink-0" />
                                      <span>{principal.mobile}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <code className="text-xs font-mono bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg">{loginId}</code>
                                  <button
                                    onClick={() => copyCredential(loginId, `pid_${principal._id || principal.id}`)}
                                    className={`p-1 rounded-lg transition-all ${copiedField === `pid_${principal._id || principal.id}` ? 'text-emerald-600' : 'text-gray-400 hover:text-sky-600 hover:bg-sky-50'}`}
                                    title="Copy Login ID"
                                  >
                                    {copiedField === `pid_${principal._id || principal.id}` ? <Check size={13} /> : <Copy size={13} />}
                                  </button>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleViewPrincipalCredentials(principal)}
                                    disabled={principalCredLoadingId === (principal._id || principal.id) || principalDeleteLoadingId === (principal._id || principal.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors text-xs font-medium disabled:opacity-50"
                                    title="Reset & View Credentials"
                                  >
                                    {principalCredLoadingId === (principal._id || principal.id) ? (
                                      <span className="w-3 h-3 border border-sky-400 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <KeyRound size={13} />
                                    )}
                                    Credentials
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmPrincipal(principal)}
                                    disabled={principalDeleteLoadingId === (principal._id || principal.id) || principalCredLoadingId === (principal._id || principal.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors text-xs font-medium disabled:opacity-50"
                                    title="Delete Principal"
                                  >
                                    {principalDeleteLoadingId === (principal._id || principal.id) ? (
                                      <span className="w-3 h-3 border border-rose-400 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Trash2 size={13} />
                                    )}
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Add / Edit Teacher Modal */}
      {showAddForm && (() => {
        const fe = (field) => formTouched[field] && formErrors[field];
        const fieldClass = (field) =>
          `w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all bg-white ${
            fe(field)
              ? 'border-red-400 focus:ring-red-300 bg-red-50/30'
              : 'border-gray-200 focus:ring-sky-400 focus:border-transparent'
          }`;
        const hasErrors = Object.values(formErrors).some(Boolean);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

              {/* Modal header */}
              <div className="flex-shrink-0 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shadow-md shadow-sky-200">
                    {editingTeacherId ? <Edit2 size={17} className="text-white" /> : <Plus size={17} className="text-white" />}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">{editingTeacherId ? 'Edit Teacher' : 'Add New Teacher'}</h2>
                    <p className="text-xs text-gray-400">{editingTeacherId ? 'Update the teacher\'s information' : 'Fill in all required fields to register a teacher'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); resetTeacherForm(); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                >
                  <XCircle size={18} />
                </button>
              </div>

              {/* Scrollable body */}
              <form onSubmit={handleAddTeacherSubmit} className="flex flex-col flex-1 overflow-hidden" noValidate>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                  {/* Section: Basic Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <User size={13} className="text-sky-500" />
                      <span className="text-xs font-bold text-sky-600 uppercase tracking-widest">Basic Information</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      {/* Full Name */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            name="name"
                            value={newTeacher.name}
                            onChange={handleAddTeacherChange}
                            onBlur={handleFormBlur}
                            placeholder="e.g., Priya Sharma"
                            className={`${fieldClass('name')} pl-9`}
                          />
                        </div>
                        {fe('name') && (
                          <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                            <XCircle size={11} /> {formErrors.name}
                          </p>
                        )}
                      </div>

                      {/* Gender */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Gender</label>
                        <select
                          name="gender"
                          value={newTeacher.gender}
                          onChange={handleAddTeacherChange}
                          onBlur={handleFormBlur}
                          className={fieldClass('gender')}
                        >
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <input
                            type="email"
                            name="email"
                            value={newTeacher.email}
                            onChange={handleAddTeacherChange}
                            onBlur={handleFormBlur}
                            placeholder="teacher@school.edu"
                            className={`${fieldClass('email')} pl-9`}
                            autoComplete="off"
                          />
                        </div>
                        {fe('email') && (
                          <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                            <XCircle size={11} /> {formErrors.email}
                          </p>
                        )}
                      </div>

                      {/* Mobile */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                          Contact Number <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <input
                            type="tel"
                            name="mobile"
                            value={newTeacher.mobile}
                            onChange={handleAddTeacherChange}
                            onBlur={handleFormBlur}
                            placeholder="e.g., 9876543210"
                            className={`${fieldClass('mobile')} pl-9`}
                          />
                        </div>
                        {fe('mobile') && (
                          <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                            <XCircle size={11} /> {formErrors.mobile}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section: Academic Details */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <GraduationCap size={13} className="text-sky-500" />
                      <span className="text-xs font-bold text-sky-600 uppercase tracking-widest">Academic Details</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      {/* Qualification */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Qualification</label>
                        <div className="relative">
                          <Award size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            name="qualification"
                            value={newTeacher.qualification}
                            onChange={handleAddTeacherChange}
                            onBlur={handleFormBlur}
                            placeholder="e.g., M.Sc, B.Ed"
                            className={`${fieldClass('qualification')} pl-9`}
                          />
                        </div>
                      </div>

                      {/* Subject */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subject</label>
                        <div className="relative">
                          <BookOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            name="subject"
                            value={newTeacher.subject}
                            onChange={handleAddTeacherChange}
                            onBlur={handleFormBlur}
                            placeholder="e.g., Mathematics"
                            className={`${fieldClass('subject')} pl-9`}
                          />
                        </div>
                      </div>

                      {/* Department */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Department</label>
                        <div className="relative">
                          <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            name="department"
                            value={newTeacher.department}
                            onChange={handleAddTeacherChange}
                            onBlur={handleFormBlur}
                            placeholder="e.g., Science"
                            className={`${fieldClass('department')} pl-9`}
                          />
                        </div>
                      </div>

                      {/* Experience */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Experience (years)</label>
                        <div className="relative">
                          <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <input
                            type="number"
                            name="experience"
                            value={newTeacher.experience}
                            onChange={handleAddTeacherChange}
                            onBlur={handleFormBlur}
                            placeholder="0"
                            min="0"
                            max="60"
                            className={`${fieldClass('experience')} pl-9`}
                          />
                        </div>
                        {fe('experience') && (
                          <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                            <XCircle size={11} /> {formErrors.experience}
                          </p>
                        )}
                      </div>

                      {/* Joining Date */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Joining Date</label>
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <input
                            type="date"
                            name="joiningDate"
                            value={newTeacher.joiningDate}
                            onChange={handleAddTeacherChange}
                            onBlur={handleFormBlur}
                            className={`${fieldClass('joiningDate')} pl-9`}
                          />
                        </div>
                        {fe('joiningDate') && (
                          <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                            <XCircle size={11} /> {formErrors.joiningDate}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section: Location */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin size={13} className="text-rose-500" />
                      <span className="text-xs font-bold text-rose-600 uppercase tracking-widest">Location</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Address</label>
                        <div className="relative">
                          <MapPin size={14} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            name="address"
                            value={newTeacher.address}
                            onChange={handleAddTeacherChange}
                            onBlur={handleFormBlur}
                            placeholder="Street, City, State"
                            className={`${fieldClass('address')} pl-9`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Pin Code</label>
                        <div className="relative">
                          <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            name="pinCode"
                            value={newTeacher.pinCode}
                            onChange={handleAddTeacherChange}
                            onBlur={handleFormBlur}
                            placeholder="e.g., 110001"
                            maxLength={10}
                            className={`${fieldClass('pinCode')} pl-9`}
                          />
                        </div>
                        {fe('pinCode') && (
                          <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                            <XCircle size={11} /> {formErrors.pinCode}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Required fields note */}
                  <p className="text-xs text-gray-400"><span className="text-red-500">*</span> Required fields</p>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4">
                  {hasErrors && Object.values(formTouched).some(Boolean) && (
                    <p className="text-xs text-red-500 flex items-center gap-1.5 mb-3">
                      <XCircle size={13} />
                      Please fix the errors above before submitting.
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => { setShowAddForm(false); resetTeacherForm(); }}
                      className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-sky-600 text-white hover:from-sky-700 hover:to-sky-700 transition-all shadow-md shadow-sky-200 text-sm font-semibold flex items-center gap-2"
                    >
                      {editingTeacherId ? <><Check size={15} /> Update Teacher</> : <><Plus size={15} /> Add Teacher</>}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Teacher Details Modal */}
      {viewTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

            {/* Gradient Profile Header */}
            <div className="bg-gradient-to-r from-sky-600 to-sky-600 px-6 pt-6 pb-10 relative flex-shrink-0">
              <button
                onClick={() => setViewTeacher(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all"
              >
                <XCircle size={18} />
              </button>
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg flex-shrink-0 ${getAvatarColor(viewTeacher.name).bg} ${getAvatarColor(viewTeacher.name).text} overflow-hidden`}>
                  {viewTeacher.profilePic ? (
                    <img
                      src={viewTeacher.profilePic}
                      alt={viewTeacher.name || 'Teacher'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (viewTeacher.name || 'NA').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>{viewTeacher.name}</span>
                    {principalIdentitySet.has(String(viewTeacher?.email || '').trim().toLowerCase()) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100/90 text-sky-700 px-2 py-0.5 text-[11px] font-semibold">
                        <Crown size={11} />
                        Principal
                      </span>
                    )}
                  </h2>
                  <p className="text-sky-200 text-sm mt-0.5 font-mono">#{viewTeacher.empId}</p>
                  <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold
                    ${viewTeacher.status === 'Present'
                      ? 'bg-emerald-100 text-emerald-700'
                      : viewTeacher.status === 'Absent'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      viewTeacher.status === 'Present'
                        ? 'bg-emerald-500'
                        : viewTeacher.status === 'Absent'
                          ? 'bg-rose-500'
                          : 'bg-amber-500'
                    }`} />
                    {viewTeacher.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Body — pulls up over the gradient */}
            <div className="overflow-y-auto mt-5">
              <div className="bg-white rounded-t-2xl px-6 pt-5 pb-6 space-y-5">

                {/* Contact Info */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Contact</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                        <Mail size={14} className="text-sky-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Email</p>
                        <p className="text-sm font-medium text-gray-800">{viewTeacher.email || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Phone size={14} className="text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Mobile</p>
                        <p className="text-sm font-medium text-gray-800">{viewTeacher.mobile || '—'}</p>
                      </div>
                    </div>
                    {(viewTeacher.address || viewTeacher.pinCode) && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                          <MapPin size={14} className="text-rose-500" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Address</p>
                          <p className="text-sm font-medium text-gray-800">
                            {[viewTeacher.address, viewTeacher.pinCode].filter(Boolean).join(', ') || '—'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                {/* Professional Info */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Professional</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={14} className="text-sky-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Subject</p>
                        <p className="text-sm font-medium text-gray-800">{viewTeacher.subject || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Building2 size={14} className="text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Department</p>
                        <p className="text-sm font-medium text-gray-800">{viewTeacher.department || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <Award size={14} className="text-amber-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Qualification</p>
                        <p className="text-sm font-medium text-gray-800">{viewTeacher.qualification || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                        <Briefcase size={14} className="text-teal-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Experience</p>
                        <p className="text-sm font-medium text-gray-800">
                          {viewTeacher.experience ? `${viewTeacher.experience} yrs` : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center flex-shrink-0">
                        <Calendar size={14} className="text-pink-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Joining Date</p>
                        <p className="text-sm font-medium text-gray-800">
                          {viewTeacher.joiningDate ? new Date(viewTeacher.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Gender</p>
                        <p className="text-sm font-medium text-gray-800 capitalize">{viewTeacher.gender || '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 pt-1">
                  {/* <button
                    onClick={() => {
                      setViewTeacher(null);
                      handleViewCredentials(viewTeacher);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors text-sm font-medium"
                  >
                    <KeyRound size={15} />
                    Generate Credentials
                  </button> */}
                  <button
                    onClick={() => setViewTeacher(null)}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Details Modal */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Weekly Routine</h2>
                <p className="text-sm text-gray-500">{scheduleModal.teacherName}</p>
              </div>
              <button
                onClick={() => setScheduleModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="space-y-3">
                {scheduleModal.entries.map((entry, idx) => (
                  <div key={`schedule-modal-${idx}`} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900">{entry.subjectName || 'Class'}</div>
                    <div className="text-xs text-gray-500 mt-1">({formatScheduleMeta(entry)})</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setScheduleModal(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {/* Delete Confirmation Modal */}
      {deleteConfirmTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete Teacher</h3>
              <p className="text-sm text-gray-500 mt-2">
                Are you sure you want to delete <span className="font-semibold text-gray-700">{deleteConfirmTeacher.name || 'this teacher'}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 pb-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmTeacher(null)}
                disabled={!!deletingTeacherId}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTeacher(deleteConfirmTeacher)}
                disabled={!!deletingTeacherId}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {deletingTeacherId ? (
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

      {deleteConfirmPrincipal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete Principal</h3>
              <p className="text-sm text-gray-500 mt-2">
                Are you sure you want to delete <span className="font-semibold text-gray-700">{deleteConfirmPrincipal.name || 'this principal'}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 pb-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmPrincipal(null)}
                disabled={!!principalDeleteLoadingId}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeletePrincipal(deleteConfirmPrincipal)}
                disabled={!!principalDeleteLoadingId}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {principalDeleteLoadingId ? (
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

      {makePrincipalConfirmTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-sky-50 flex items-center justify-center mx-auto mb-4">
                <Crown size={24} className="text-sky-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Make Principal</h3>
              <p className="text-sm text-gray-500 mt-2">
                This will create a Principal account for <span className="font-semibold text-gray-700">{makePrincipalConfirmTeacher.name || 'this teacher'}</span>. Continue?
              </p>
            </div>
            <div className="px-6 pb-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMakePrincipalConfirmTeacher(null)}
                disabled={!!principalLoadingId}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleMakePrincipal(makePrincipalConfirmTeacher)}
                disabled={!!principalLoadingId}
                className="flex-1 px-4 py-2.5 rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {principalLoadingId ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {credentialView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Gradient Header */}
            <div className="bg-gradient-to-r from-sky-600 to-sky-600 px-6 py-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <KeyRound size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Login Credentials</h2>
                    <p className="text-sky-200 text-xs mt-0.5">Share these securely with the teacher</p>
                  </div>
                </div>
                <button
                  onClick={() => setCredentialView(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
                >
                  <XCircle size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Teacher identity */}
              <div className="flex flex-col justify center items-center gap-3 p-3 bg-sky-50 rounded-lg">
                {credentialView.photo ? (
                  <img src={credentialView.photo} alt={credentialView.name} className="w-14 h-14 rounded-full object-cover flex-shrink-0 border-2 border-white" />
                ) : (
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${getAvatarColor(credentialView.name).bg} ${getAvatarColor(credentialView.name).text}`}
                  >
                    {(credentialView.name || 'T').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-semibold text-sky-900">{credentialView.name || 'Teacher'}</p>
                  <p className="text-xs text-sky-500 font-medium">Teacher</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Login ID */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Login ID</p>
                  <div className="flex items-center justify-between rounded-full border border-gray-200 bg-gray-50 px-4 py-3">
                    <code className="text-sm font-mono text-gray-800">
                      {credentialView.employeeCode || credentialView.username}
                    </code>
                    <button
                      onClick={() => copyCredential(credentialView.employeeCode || credentialView.username, 'id')}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all font-medium ${
                        copiedField === 'id'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-200 hover:bg-sky-100 hover:text-sky-700 text-gray-600'
                      }`}
                    >
                      {copiedField === 'id' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedField === 'id' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Password</p>
                  <div className="flex items-center justify-between rounded-full border border-gray-200 bg-gray-50 px-4 py-3">
                    <code className="text-sm font-mono text-gray-800">{credentialView.password}</code>
                    {credentialView.canCopyPassword && (
                      <button
                        onClick={() => copyCredential(credentialView.password, 'pass')}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all font-medium ${
                          copiedField === 'pass'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-200 hover:bg-sky-100 hover:text-sky-700 text-gray-600'
                        }`}
                      >
                        {copiedField === 'pass' ? <Check size={12} /> : <Copy size={12} />}
                        {copiedField === 'pass' ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-400">
                If the teacher has already reset the password, only the reset status is shown.
              </p>
            </div>

            <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-end bg-gray-50/50">
              {/* <button
                onClick={handleResetCredentials}
                disabled={credentialLoadingId === credentialView.id}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {credentialLoadingId === credentialView.id ? 'Resetting...' : 'Reset Password'}
              </button> */}
              <button
                onClick={() => setCredentialView(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Principal Credentials Modal */}
      {principalCredentialView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Gradient Header */}
            <div className="bg-gradient-to-r from-sky-600 to-pink-600 px-6 py-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Crown size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Principal Login Credentials</h2>
                    <p className="text-sky-200 text-xs mt-0.5">Share these securely with the principal</p>
                  </div>
                </div>
                <button
                  onClick={() => setPrincipalCredentialView(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
                >
                  <XCircle size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Principal identity */}
              <div className="flex flex-col items-center gap-3 p-3 bg-sky-50 rounded-lg">
                {principalCredentialView.photo ? (
                  <img src={principalCredentialView.photo} alt={principalCredentialView.name} className="w-14 h-14 border-2 border-white rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${getAvatarColor(principalCredentialView.name).bg} ${getAvatarColor(principalCredentialView.name).text}`}
                  >
                    {(principalCredentialView.name || 'P').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className='text-center'>
                  <p className="text-sm font-semibold text-sky-900">{principalCredentialView.name || 'Principal'}</p>
                  <p className="text-xs text-sky-500 font-medium">Principal</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Login ID / Email */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Login ID (Email)</p>
                  <div className="flex items-center justify-between rounded-full border border-gray-200 bg-gray-50 px-4 py-3">
                    <code className="text-sm font-mono text-gray-800">
                      {principalCredentialView.username || principalCredentialView.email}
                    </code>
                    <button
                      onClick={() => copyCredential(principalCredentialView.username || principalCredentialView.email, 'principal_id')}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all font-medium ${
                        copiedField === 'principal_id'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-200 hover:bg-sky-100 hover:text-sky-700 text-gray-600'
                      }`}
                    >
                      {copiedField === 'principal_id' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedField === 'principal_id' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Password</p>
                  <div className="flex items-center justify-between rounded-full border border-gray-200 bg-gray-50 px-4 py-3">
                    <code className="text-sm font-mono text-gray-800 break-all">{principalCredentialView.password}</code>
                    {principalCredentialView.canCopy && (
                      <button
                        onClick={() => copyCredential(principalCredentialView.password, 'principal_pass')}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all font-medium ${
                          copiedField === 'principal_pass'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-200 hover:bg-sky-100 hover:text-sky-700 text-gray-600'
                        }`}
                      >
                        {copiedField === 'principal_pass' ? <Check size={12} /> : <Copy size={12} />}
                        {copiedField === 'principal_pass' ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <p className="text-xs text-amber-800">
                  <span className="font-semibold">Important:</span> Principal account created successfully. Please ask them to change their password after first login.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100 px-6 py-4 flex justify-end bg-gray-50/50">
              <button
                onClick={() => setPrincipalCredentialView(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors text-sm font-medium"
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

export default Teachers;
