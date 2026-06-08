import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  Archive,
  BadgeCheck,
  Bell,
  BellRing,
  Briefcase,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Camera,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  Edit,
  FileCheck,
  FileText,
  Gauge,
  IndianRupee,
  LayoutGrid,
  List,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Plus,
  Receipt,
  Save,
  Search,
  Shield,
  Sparkles,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  Upload,
  User,
  Wallet,
  X,
  XCircle,
  Zap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const MotionButton = motion.button;
const MotionDiv = motion.div;

const Progress = ({ value = 0, className }) => (
  <div className={cn('h-2 overflow-hidden rounded-full bg-slate-100', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(Number(value) || 0, 100))}>
    <div className="h-full rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${Math.max(0, Math.min(Number(value) || 0, 100))}%` }} />
  </div>
);

const Avatar = ({ className, children }) => <div className={cn('relative inline-flex shrink-0 overflow-hidden rounded-full', className)}>{children}</div>;
const AvatarImage = ({ src, alt }) => (src ? <img src={src} alt={alt || ''} className="h-full w-full object-cover" /> : null);
const AvatarFallback = ({ className, children }) => <div className={cn('flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-slate-700', className)}>{children}</div>;

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const ease = [0.22, 1, 0.36, 1];
const panelMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.42, ease } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } }
};
const itemMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease } }
};
const staggerMotion = {
  animate: { transition: { staggerChildren: 0.055 } }
};

const emptyAttendanceStats = { presentDays: 0, lateDays: 0, absentDays: 0, attendanceRate: 0 };
const emptyToday = {
  hasCheckedIn: false,
  hasCheckedOut: false,
  checkIn: '-',
  checkOut: '-',
  status: 'Absent',
  workingMinutes: 0
};
const defaultExpenseForm = () => ({
  category: 'Travel',
  amount: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
  receiptFile: null,
  receiptName: '',
  receiptUrl: ''
});
const defaultLeaveForm = { type: 'Sick Leave', startDate: '', endDate: '', reason: '' };

const documentsSeed = [
  { id: 1, name: 'Employee Handbook', type: 'PDF', size: '2.5 MB', category: 'Policy', uploadDate: '2026-01-01' },
  { id: 2, name: 'Salary Certificate', type: 'PDF', size: '150 KB', category: 'Salary Certificates', uploadDate: '2026-03-15' },
  { id: 3, name: 'Tax Declaration Form', type: 'PDF', size: '300 KB', category: 'Tax Forms', uploadDate: '2026-04-01' },
  { id: 4, name: 'Performance Review', type: 'PDF', size: '500 KB', category: 'Performance Reviews', uploadDate: '2026-05-20' }
];

const statusStyles = {
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  present: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  late: 'border-amber-200 bg-amber-50 text-amber-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  absent: 'border-rose-200 bg-rose-50 text-rose-700'
};

const getStatusClass = (status) => statusStyles[String(status || '').toLowerCase()] || 'border-slate-200 bg-slate-100 text-slate-700';

const normalizeJoinDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const mapProfileFromApi = (teacher = {}) => ({
  name: teacher.name || '',
  email: teacher.email || '',
  phone: teacher.mobile || teacher.phone || '',
  department: teacher.department || '',
  employeeId: teacher.username || teacher.employeeCode || teacher.employeeId || '',
  joinDate: normalizeJoinDate(teacher.joiningDate || teacher.joinDate),
  address: teacher.address || '',
  emergencyContact: teacher.emergencyContact || '',
  profilePic: teacher.profilePic || ''
});

const formatDate = (dateStr) => {
  if (!dateStr || dateStr === '-') return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
};

const formatTime = (timeStr) => {
  if (!timeStr || timeStr === '-') return '-';
  const [hours, minutes] = String(timeStr).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return timeStr;
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${period}`;
};

const formatWorkingHours = (minutes) => {
  const totalMinutes = Number(minutes || 0);
  if (!totalMinutes) return '0h 00m';
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`;
};

const toMonthLabel = (monthValue) => {
  const [year, month] = String(monthValue || '').split('-').map(Number);
  if (!year || !month) return monthValue || 'Selected month';
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

const getLeaveDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
};

const SectionTitle = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm">
        {React.createElement(Icon, { className: 'h-4 w-4' })}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
      </div>
    </div>
    {action}
  </div>
);

const MetricCard = ({ icon: Icon, label, value, hint, tone = 'slate', progress, onClick }) => {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200'
  };
  return (
    <MotionButton
      type="button"
      variants={itemMotion}
      whileHover={{ y: -2, scale: 1.01 }}
      onClick={onClick}
      className="rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
    >
      <Card className="h-full border-slate-200/80 bg-white/90 py-0 shadow-sm shadow-slate-200/60 backdrop-blur transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl ring-1', tones[tone])}>
              {React.createElement(Icon, { className: 'h-4 w-4' })}
            </div>
            {typeof progress === 'number' && <Badge className="border-slate-200 bg-white text-slate-600">{Math.round(progress)}%</Badge>}
          </div>
          <div className="mt-4">
            <p className="text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
            <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
            {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
          </div>
          {typeof progress === 'number' && <Progress value={Math.max(0, Math.min(progress, 100))} className="mt-4 h-1.5" />}
        </CardContent>
      </Card>
    </MotionButton>
  );
};

const Field = ({ label, icon: Icon, children }) => (
  <label className="block space-y-1.5">
    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {Icon && React.createElement(Icon, { className: 'h-3.5 w-3.5' })}
      {label}
    </span>
    {children}
  </label>
);

const MiniSelect = ({ value, onChange, children, className, ...props }) => (
  <select
    value={value}
    onChange={onChange}
    className={cn('h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200', className)}
    {...props}
  >
    {children}
  </select>
);

const Modal = ({ open, title, description, children, footer, onClose, size = 'max-w-lg' }) => {
  if (!open) return null;
  const titleId = `${title.replace(/\s+/g, '-').toLowerCase()}-title`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <MotionDiv initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.2, ease }} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cn('w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl', size)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-950">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close modal">×</Button>
        </div>
        <div className="mt-5">{children}</div>
        {footer && <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </MotionDiv>
    </div>
  );
};

const MyWorkPortal = () => {
  const shouldReduceMotion = useReducedMotion();
  const profilePicInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const [attendanceData, setAttendanceData] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState(emptyAttendanceStats);
  const [todayAttendance, setTodayAttendance] = useState(emptyToday);
  const [attendanceTiming, setAttendanceTiming] = useState({ entryTime: '09:00', exitTime: '17:00' });
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');

  const [leaveData, setLeaveData] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaveEditId, setLeaveEditId] = useState(null);
  const [leaveViewMode, setLeaveViewMode] = useState('timeline');
  const [leaveToDelete, setLeaveToDelete] = useState(null);
  const [leaveDeleting, setLeaveDeleting] = useState(false);
  const [leaveForm, setLeaveForm] = useState(defaultLeaveForm);
  const [leavePolicy, setLeavePolicy] = useState({ casualLeaveDays: 12 });
  const [leaveQuota, setLeaveQuota] = useState({ casualUsedDays: 0, casualAvailableDays: 12 });
  const [showLeaveForm, setShowLeaveForm] = useState(false);

  const [expenses, setExpenses] = useState([]);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [expenseEditId, setExpenseEditId] = useState(null);
  const [expenseViewMode, setExpenseViewMode] = useState('cards');
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [expenseDeleting, setExpenseDeleting] = useState(false);
  const [expenseForm, setExpenseForm] = useState(defaultExpenseForm);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    employeeId: '',
    joinDate: '',
    address: '',
    emergencyContact: '',
    profilePic: ''
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [editProfile, setEditProfile] = useState(false);

  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Leave Request Approved', message: 'Your sick leave request has been approved.', type: 'success', category: 'Leave Updates', read: false, timestamp: '2 hours ago' },
    { id: 2, title: 'Expense Claim Update', message: 'A submitted expense claim needs additional documentation.', type: 'warning', category: 'Expense Updates', read: false, timestamp: '5 hours ago' },
    { id: 3, title: 'Profile Update Required', message: 'Please verify your emergency contact information.', type: 'info', category: 'Profile Actions', read: true, timestamp: '1 day ago' },
    { id: 4, title: 'Attendance Reminder', message: 'Check out when your work session is complete.', type: 'info', category: 'Attendance Alerts', read: true, timestamp: '2 days ago' }
  ]);
  const [documentQuery, setDocumentQuery] = useState('');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Sparkles },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'leave', label: 'Leave Management', icon: CalendarRange },
    { id: 'expenses', label: 'Expenses & Claims', icon: Wallet },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: BellRing },
    { id: 'profile', label: 'Profile & Identity', icon: User },
    { id: 'insights', label: 'Work Insights', icon: TrendingUp }
  ];

  const fetchWorkAttendance = useCallback(async (monthValue = selectedMonth) => {
    setAttendanceLoading(true);
    setAttendanceError('');
    try {
      const token = localStorage.getItem('token');
      const userType = (localStorage.getItem('userType') || '').toLowerCase();
      if (!token || userType !== 'teacher') throw new Error('Teacher login required');

      const res = await fetch(`${API_BASE}/api/teacher/dashboard/work-attendance?month=${monthValue}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to load attendance');

      setAttendanceData(Array.isArray(data.records) ? data.records : []);
      setAttendanceStats(data.stats || emptyAttendanceStats);
      setTodayAttendance(data.today || emptyToday);
      setAttendanceTiming({ entryTime: data?.settings?.entryTime || '09:00', exitTime: data?.settings?.exitTime || '17:00' });
    } catch (error) {
      setAttendanceError(error.message || 'Unable to load attendance');
    } finally {
      setAttendanceLoading(false);
    }
  }, [selectedMonth]);

  const handleCheckIn = async () => {
    setAttendanceSaving(true);
    setAttendanceError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/teacher/dashboard/work-attendance/check-in`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to check in');
      await fetchWorkAttendance(selectedMonth);
    } catch (error) {
      setAttendanceError(error.message || 'Unable to check in');
    } finally {
      setAttendanceSaving(false);
    }
  };

  const handleCheckOut = async () => {
    setAttendanceSaving(true);
    setAttendanceError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/teacher/dashboard/work-attendance/check-out`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to check out');
      await fetchWorkAttendance(selectedMonth);
    } catch (error) {
      setAttendanceError(error.message || 'Unable to check out');
    } finally {
      setAttendanceSaving(false);
    }
  };

  const fetchLeaveRequests = async () => {
    setLeaveLoading(true);
    setLeaveError('');
    try {
      const token = localStorage.getItem('token');
      const userType = (localStorage.getItem('userType') || '').toLowerCase();
      if (!token || userType !== 'teacher') throw new Error('Teacher login required');

      const res = await fetch(`${API_BASE}/api/teacher/dashboard/leave-requests`, {
        headers: { authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to load leave requests');

      setLeaveData(Array.isArray(data.leaves) ? data.leaves : []);
      setLeavePolicy({ casualLeaveDays: Number(data?.leavePolicy?.casualLeaveDays) || 12 });
      setLeaveQuota({
        casualUsedDays: Number(data?.leaveStats?.casualUsedDays) || 0,
        casualAvailableDays: Number(data?.leaveStats?.casualAvailableDays) || 12
      });
    } catch (error) {
      setLeaveError(error.message || 'Unable to load leave requests');
    } finally {
      setLeaveLoading(false);
    }
  };

  const submitLeaveRequest = async (e) => {
    e.preventDefault();
    setLeaveError('');
    setLeaveSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Teacher login required');
      if (!leaveForm.startDate || !leaveForm.endDate) throw new Error('Start and end date are required');

      const endpoint = leaveEditId
        ? `${API_BASE}/api/teacher/dashboard/leave-requests/${leaveEditId}`
        : `${API_BASE}/api/teacher/dashboard/leave-requests`;
      const res = await fetch(endpoint, {
        method: leaveEditId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(leaveForm)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to submit leave request');

      setShowLeaveForm(false);
      setLeaveEditId(null);
      setLeaveForm(defaultLeaveForm);
      await fetchLeaveRequests();
    } catch (error) {
      setLeaveError(error.message || 'Unable to submit leave request');
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleEditLeave = (leave) => {
    if (!leave || String(leave.status).toLowerCase() !== 'pending') return;
    setLeaveEditId(leave.id);
    setLeaveForm({ type: leave.type || 'Sick Leave', startDate: leave.startDate || '', endDate: leave.endDate || '', reason: leave.reason || '' });
    setShowLeaveForm(true);
  };

  const confirmDeleteLeave = async () => {
    if (!leaveToDelete) return;
    setLeaveDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/teacher/dashboard/leave-requests/${leaveToDelete.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Unable to delete');
      setLeaveToDelete(null);
      await fetchLeaveRequests();
    } catch (error) {
      setLeaveError(error.message || 'Unable to delete leave request');
      setLeaveToDelete(null);
    } finally {
      setLeaveDeleting(false);
    }
  };

  const fetchExpenses = async () => {
    setExpenseLoading(true);
    setExpenseError('');
    try {
      const token = localStorage.getItem('token');
      const userType = (localStorage.getItem('userType') || '').toLowerCase();
      if (!token || userType !== 'teacher') throw new Error('Teacher login required');

      const res = await fetch(`${API_BASE}/api/teacher/dashboard/expenses`, {
        headers: { authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to load expenses');
      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
    } catch (error) {
      setExpenseError(error.message || 'Unable to load expenses');
    } finally {
      setExpenseLoading(false);
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setExpenseError('');
    setExpenseSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Teacher login required');
      if (!expenseForm.amount || Number(expenseForm.amount) <= 0) throw new Error('Amount must be greater than 0');

      let receiptUrl = expenseForm.receiptUrl || '';
      let receiptName = expenseForm.receiptName || '';
      if (expenseForm.receiptFile) {
        const uploadForm = new FormData();
        uploadForm.append('file', expenseForm.receiptFile);
        uploadForm.append('folder', 'teacher_expenses');
        const uploadRes = await fetch(`${API_BASE}/api/uploads/cloudinary/single`, { method: 'POST', body: uploadForm });
        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || !uploadData?.files?.[0]?.secure_url) throw new Error('Unable to upload receipt');
        receiptUrl = uploadData.files[0].secure_url;
        receiptName = uploadData.files[0].originalName || expenseForm.receiptFile.name;
      }

      const endpoint = expenseEditId
        ? `${API_BASE}/api/teacher/dashboard/expenses/${expenseEditId}`
        : `${API_BASE}/api/teacher/dashboard/expenses`;
      const res = await fetch(endpoint, {
        method: expenseEditId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...expenseForm, amount: Number(expenseForm.amount), receiptUrl, receiptName, receiptFile: undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to submit expense');

      setShowExpenseForm(false);
      setExpenseEditId(null);
      setExpenseForm(defaultExpenseForm());
      await fetchExpenses();
    } catch (error) {
      setExpenseError(error.message || 'Unable to submit expense');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleEditExpense = (expense) => {
    if (!expense || String(expense.status).toLowerCase() !== 'pending') return;
    setExpenseEditId(expense.id);
    setExpenseForm({
      category: expense.category || 'Travel',
      amount: expense.amount || '',
      description: expense.description || '',
      date: expense.date || new Date().toISOString().slice(0, 10),
      receiptFile: null,
      receiptName: expense.receiptName || '',
      receiptUrl: expense.receiptUrl || ''
    });
    setShowExpenseForm(true);
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setExpenseDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/teacher/dashboard/expenses/${expenseToDelete.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Unable to delete');
      setExpenseToDelete(null);
      await fetchExpenses();
    } catch (error) {
      setExpenseError(error.message || 'Unable to delete expense');
      setExpenseToDelete(null);
    } finally {
      setExpenseDeleting(false);
    }
  };

  const handleProfileEditSave = async () => {
    setProfileError('');
    setProfileSuccess('');
    if (!editProfile) {
      setEditProfile(true);
      return;
    }

    try {
      setProfileSaving(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Teacher login required');
      const res = await fetch(`${API_BASE}/api/teacher/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: profileData.name,
          email: profileData.email,
          mobile: profileData.phone,
          department: profileData.department,
          joiningDate: profileData.joinDate || null,
          address: profileData.address,
          emergencyContact: profileData.emergencyContact
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to update profile');
      setProfileData(mapProfileFromApi(data?.teacher || data || {}));
      setProfileSuccess('Profile updated successfully');
      setEditProfile(false);
    } catch (error) {
      setProfileError(error.message || 'Unable to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleProfilePicUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfileError('');
    setProfileSuccess('');
    setProfileSaving(true);
    try {
      if (!file.type.startsWith('image/')) throw new Error('Please select an image file');
      if (file.size > 5 * 1024 * 1024) throw new Error('Image size should be 5MB or less');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'teacher_profiles');
      const uploadRes = await fetch(`${API_BASE}/api/uploads/cloudinary/single`, { method: 'POST', body: formData });
      const uploadData = await uploadRes.json().catch(() => ({}));
      const uploadedUrl = uploadData?.files?.[0]?.secure_url;
      if (!uploadRes.ok || !uploadedUrl) throw new Error('Unable to upload image');

      const token = localStorage.getItem('token');
      const saveRes = await fetch(`${API_BASE}/api/teacher/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ profilePic: uploadedUrl })
      });
      if (!saveRes.ok) throw new Error('Unable to save profile photo');
      setProfileData((prev) => ({ ...prev, profilePic: uploadedUrl }));
      setProfileSuccess('Profile photo updated successfully');
    } catch (error) {
      setProfileError(error.message || 'Unable to update photo');
    } finally {
      if (profilePicInputRef.current) profilePicInputRef.current.value = '';
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    fetchWorkAttendance(selectedMonth);
  }, [fetchWorkAttendance, selectedMonth]);

  useEffect(() => {
    fetchLeaveRequests();
    fetchExpenses();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError('');
      try {
        const token = localStorage.getItem('token');
        const userType = (localStorage.getItem('userType') || '').toLowerCase();
        if (!token || userType !== 'teacher') throw new Error('Teacher login required');
        const res = await fetch(`${API_BASE}/api/teacher/auth/profile`, { headers: { authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Unable to load profile');
        setProfileData(mapProfileFromApi(data?.teacher || data || {}));
      } catch (error) {
        setProfileError(error.message || 'Unable to load profile');
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, []);

  const leaveStats = useMemo(() => {
    const usedDays = leaveData
      .filter((leave) => String(leave.status).toLowerCase() === 'approved' && String(leave.type || '').toLowerCase() === 'casual leave')
      .reduce((sum, leave) => sum + getLeaveDays(leave.startDate, leave.endDate), 0);
    const pendingRequests = leaveData.filter((leave) => String(leave.status).toLowerCase() === 'pending').length;
    return {
      usedDays,
      pendingRequests,
      availableDays: Math.max((leavePolicy.casualLeaveDays || 0) - usedDays, 0)
    };
  }, [leaveData, leavePolicy.casualLeaveDays]);

  const expenseStats = useMemo(() => ({
    approved: expenses.filter((expense) => String(expense.status).toLowerCase() === 'approved').reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    pending: expenses.filter((expense) => String(expense.status).toLowerCase() === 'pending').reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    rejected: expenses.filter((expense) => String(expense.status).toLowerCase() === 'rejected').reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    pendingCount: expenses.filter((expense) => String(expense.status).toLowerCase() === 'pending').length
  }), [expenses]);

  const profileCompletion = useMemo(() => {
    const fields = ['name', 'email', 'phone', 'department', 'employeeId', 'joinDate', 'address', 'emergencyContact'];
    const filled = fields.filter((field) => String(profileData[field] || '').trim()).length;
    return Math.round((filled / fields.length) * 100);
  }, [profileData]);

  const attendanceHeatmap = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = year && month ? new Date(year, month, 0).getDate() : 30;
    const byDate = new Map(attendanceData.map((record) => [String(record.date || '').slice(0, 10), record]));
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { day, record: byDate.get(key) };
    });
  }, [attendanceData, selectedMonth]);

  const filteredDocuments = useMemo(() => {
    const query = documentQuery.trim().toLowerCase();
    if (!query) return documentsSeed;
    return documentsSeed.filter((document) => `${document.name} ${document.category} ${document.type}`.toLowerCase().includes(query));
  }, [documentQuery]);

  const insightScore = Math.round((Number(attendanceStats.attendanceRate || 0) + profileCompletion + Math.min(100, (leaveQuota.casualAvailableDays / Math.max(leavePolicy.casualLeaveDays || 1, 1)) * 100)) / 3);
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;
  const activeSession = todayAttendance.hasCheckedIn && !todayAttendance.hasCheckedOut;

  const openLeaveForm = () => {
    setLeaveEditId(null);
    setLeaveForm(defaultLeaveForm);
    setShowLeaveForm(true);
  };

  const openExpenseForm = () => {
    setExpenseEditId(null);
    setExpenseForm(defaultExpenseForm());
    setShowExpenseForm(true);
  };

  const quickActions = [
    { label: activeSession ? 'Check Out' : 'Check In', icon: activeSession ? LogOut : LogIn, onClick: activeSession ? handleCheckOut : handleCheckIn, disabled: attendanceSaving || todayAttendance.hasCheckedOut || (!activeSession && todayAttendance.hasCheckedIn), tone: 'emerald' },
    { label: 'Apply Leave', icon: CalendarRange, onClick: openLeaveForm, disabled: false, tone: 'blue' },
    { label: 'Submit Claim', icon: Receipt, onClick: openExpenseForm, disabled: false, tone: 'violet' },
    { label: 'Update Profile', icon: User, onClick: () => setActiveTab('profile'), disabled: false, tone: 'slate' }
  ];

  const tabContentProps = shouldReduceMotion ? {} : panelMotion;

  const renderOverview = () => (
    <MotionDiv {...tabContentProps} className="space-y-6">
      <Card className="overflow-hidden border-slate-200/80 bg-white py-0 shadow-sm">
        <CardContent className="p-0">
          <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="relative min-h-[260px] overflow-hidden bg-[radial-gradient(circle_at_top_left,#e0f2fe,transparent_35%),linear-gradient(135deg,#f8fafc,#ffffff_52%,#ecfeff)] p-5 sm:p-7">
              <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-slate-200 to-transparent" />
              <div className="relative flex flex-col gap-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border border-white shadow-md">
                      <AvatarImage src={profileData.profilePic} alt={profileData.name || 'Teacher'} />
                      <AvatarFallback className="bg-slate-900 text-lg font-semibold text-white">{profileData.name?.charAt(0) || 'T'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <Badge className="mb-2 border-cyan-200 bg-cyan-50 text-cyan-700">Work Portal</Badge>
                      <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">My Work</h1>
                      <p className="mt-1 text-sm text-slate-500">{profileData.name || 'Teacher'} · {profileData.department || 'Academic team'} · {formatDate(new Date().toISOString().slice(0, 10))}</p>
                    </div>
                  </div>
                  <Badge className={cn('w-fit border px-3 py-1.5', getStatusClass(todayAttendance.status))}>{todayAttendance.status || 'Not marked'}</Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Today</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{todayAttendance.hasCheckedIn ? `Checked in at ${formatTime(todayAttendance.checkIn)}` : 'Ready for check-in'}</p>
                    <p className="mt-1 text-xs text-slate-500">Expected window {formatTime(attendanceTiming.entryTime)} - {formatTime(attendanceTiming.exitTime)}</p>
                  </div>
                  <div className="rounded-xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Session</p>
                    <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Timer className="h-4 w-4 text-cyan-600" />{formatWorkingHours(todayAttendance.workingMinutes)}</p>
                    <p className="mt-1 text-xs text-slate-500">{activeSession ? 'Live work timer active' : 'No active work session'}</p>
                  </div>
                  <div className="rounded-xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Next Action</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{leaveStats.pendingRequests ? `${leaveStats.pendingRequests} leave request pending` : 'No leave bottlenecks'}</p>
                    <p className="mt-1 text-xs text-slate-500">{expenseStats.pendingCount} reimbursement claims pending</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-950 p-5 text-white lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Monthly insight</p>
                  <p className="mt-2 text-4xl font-semibold">{insightScore}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-cyan-200">
                  <Gauge className="h-5 w-5" />
                </div>
              </div>
              <Progress value={insightScore} className="mt-5 h-2 bg-white/10" />
              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-slate-400">Attendance rate</span><span>{attendanceStats.attendanceRate || 0}%</span></div>
                <div className="flex items-center justify-between"><span className="text-slate-400">Leave days remaining</span><span>{leaveQuota.casualAvailableDays}</span></div>
                <div className="flex items-center justify-between"><span className="text-slate-400">Profile completion</span><span>{profileCompletion}%</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <MotionDiv variants={staggerMotion} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CheckCircle} label="Days Present" value={attendanceStats.presentDays} hint={`${attendanceStats.lateDays || 0} late arrivals this month`} tone="emerald" progress={attendanceStats.attendanceRate || 0} onClick={() => setActiveTab('attendance')} />
        <MetricCard icon={CalendarCheck} label="Leave Balance" value={leaveQuota.casualAvailableDays} hint={`${leaveStats.pendingRequests} pending approvals`} tone="blue" progress={(leaveQuota.casualAvailableDays / Math.max(leavePolicy.casualLeaveDays || 1, 1)) * 100} onClick={() => setActiveTab('leave')} />
        <MetricCard icon={Receipt} label="Pending Claims" value={expenseStats.pendingCount} hint={`Rs ${expenseStats.pending.toLocaleString('en-IN')} awaiting review`} tone="amber" onClick={() => setActiveTab('expenses')} />
        <MetricCard icon={BellRing} label="Unread Alerts" value={unreadNotifications} hint="Workflow inbox" tone="violet" onClick={() => setActiveTab('notifications')} />
      </MotionDiv>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <Card className="border-slate-200 bg-white py-0 shadow-sm">
          <CardHeader className="border-b border-slate-100 p-4">
            <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-600" />Activity Timeline</CardTitle>
            <CardDescription>Recent operational updates across attendance, leave, and claims.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              {[
                { icon: LogIn, title: todayAttendance.hasCheckedIn ? `Checked in at ${formatTime(todayAttendance.checkIn)}` : 'No check-in recorded yet', meta: 'Attendance', tone: 'emerald' },
                { icon: CalendarRange, title: leaveData[0] ? `${leaveData[0].type} request is ${leaveData[0].status}` : 'No leave requests submitted', meta: 'Leave Management', tone: 'blue' },
                { icon: Wallet, title: expenses[0] ? `${expenses[0].category} claim is ${expenses[0].status}` : 'No reimbursement claims submitted', meta: 'Expenses & Claims', tone: 'violet' }
              ].map((item, index) => (
                <MotionDiv key={item.meta} variants={itemMotion} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', item.tone === 'emerald' && 'bg-emerald-50 text-emerald-700', item.tone === 'blue' && 'bg-blue-50 text-blue-700', item.tone === 'violet' && 'bg-violet-50 text-violet-700')}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    {index < 2 && <div className="mt-2 h-8 w-px bg-slate-200" />}
                  </div>
                  <div className="min-w-0 pt-1">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.meta}</p>
                  </div>
                </MotionDiv>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white py-0 shadow-sm">
          <CardHeader className="border-b border-slate-100 p-4">
            <CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-600" />Quick Actions</CardTitle>
            <CardDescription>Common work operations stay one click away.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
            {quickActions.map((action) => (
              <Button key={action.label} type="button" variant="outline" className="h-12 justify-start rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50" disabled={action.disabled} onClick={action.onClick}>
                <action.icon className="h-4 w-4" />
                {action.label}
                <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </MotionDiv>
  );

  const renderAttendance = () => (
    <MotionDiv {...tabContentProps} className="space-y-5">
      <SectionTitle
        icon={Clock}
        title="Attendance"
        description="Track the live work session, monthly consistency, punctuality, and attendance history."
        action={<Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="h-9 w-44" />}
      />
      {attendanceError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{attendanceError}</div>}
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-slate-200 bg-white py-0 shadow-sm">
          <CardHeader className="p-4">
            <CardTitle>Current Session</CardTitle>
            <CardDescription>{toMonthLabel(selectedMonth)} work attendance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
              <div className={cn('mx-auto flex h-24 w-24 items-center justify-center rounded-full border-8 bg-white', activeSession ? 'border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-500')}>
                <Timer className="h-8 w-8" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-slate-950">{formatWorkingHours(todayAttendance.workingMinutes)}</p>
              <p className="mt-1 text-sm text-slate-500">{activeSession ? 'Live work timer active' : 'Session is not active'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Check-in</p><p className="mt-1 font-semibold text-slate-900">{formatTime(todayAttendance.checkIn)}</p></div>
              <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Check-out</p><p className="mt-1 font-semibold text-slate-900">{formatTime(todayAttendance.checkOut)}</p></div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={attendanceSaving || todayAttendance.hasCheckedIn} onClick={handleCheckIn}><LogIn className="h-4 w-4" />Check In</Button>
              <Button className="flex-1" variant="outline" disabled={attendanceSaving || !todayAttendance.hasCheckedIn || todayAttendance.hasCheckedOut} onClick={handleCheckOut}><LogOut className="h-4 w-4" />Check Out</Button>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white py-0 shadow-sm">
          <CardHeader className="p-4">
            <CardTitle>Monthly Heatmap</CardTitle>
            <CardDescription>Present, late, and absent days at a glance.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-7 gap-2">
              {attendanceHeatmap.map(({ day, record }) => {
                const status = String(record?.status || '').toLowerCase();
                return (
                  <div
                    key={day}
                    title={record ? `${record.status} · ${formatTime(record.checkIn || record.checkInAt)}` : 'No record'}
                    className={cn('flex aspect-square items-center justify-center rounded-lg border text-xs font-semibold', !record && 'border-slate-100 bg-slate-50 text-slate-400', status === 'present' && 'border-emerald-200 bg-emerald-100 text-emerald-800', status === 'late' && 'border-amber-200 bg-amber-100 text-amber-800', status === 'absent' && 'border-rose-200 bg-rose-100 text-rose-800')}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      <MotionDiv variants={staggerMotion} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={BadgeCheck} label="Attendance Rate" value={`${attendanceStats.attendanceRate || 0}%`} tone="emerald" progress={attendanceStats.attendanceRate || 0} />
        <MetricCard icon={Clock} label="Late Days" value={attendanceStats.lateDays || 0} tone="amber" />
        <MetricCard icon={XCircle} label="Absent Days" value={attendanceStats.absentDays || 0} tone="rose" />
        <MetricCard icon={Target} label="Consistency" value={`${Math.max(0, 100 - Number(attendanceStats.lateDays || 0) * 5)}%`} tone="blue" />
      </MotionDiv>
      <Card className="border-slate-200 bg-white py-0 shadow-sm">
        <CardHeader className="p-4"><CardTitle>Session Activity</CardTitle><CardDescription>Recent attendance records as workflow cards.</CardDescription></CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          {attendanceLoading && <p className="text-sm text-slate-500">Loading attendance...</p>}
          {!attendanceLoading && attendanceData.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No attendance records for this month.</p>}
          {attendanceData.slice(0, 10).map((record) => (
            <div key={record.id || record.date} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><CalendarDays className="h-4 w-4" /></div><div><p className="font-semibold text-slate-900">{formatDate(record.date)}</p><p className="text-sm text-slate-500">{formatTime(record.checkIn || record.checkInAt)} - {formatTime(record.checkOut || record.checkOutAt)}</p></div></div>
              <div className="flex items-center gap-2"><Badge className={cn('border', getStatusClass(record.status))}>{record.status || 'Recorded'}</Badge><span className="text-sm font-medium text-slate-600">{formatWorkingHours(record.workingMinutes)}</span></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </MotionDiv>
  );

  const renderLeave = () => (
    <MotionDiv {...tabContentProps} className="space-y-5">
      <SectionTitle icon={CalendarRange} title="Leave Management" description="Request leave, follow approval progress, and monitor remaining leave quota." action={<Button onClick={openLeaveForm}><Plus className="h-4 w-4" />Apply Leave</Button>} />
      {leaveError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{leaveError}</div>}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={CalendarCheck} label="Available Casual Leave" value={leaveQuota.casualAvailableDays} tone="blue" progress={(leaveQuota.casualAvailableDays / Math.max(leavePolicy.casualLeaveDays || 1, 1)) * 100} />
        <MetricCard icon={Archive} label="Used Leave" value={leaveQuota.casualUsedDays || leaveStats.usedDays} tone="slate" />
        <MetricCard icon={Clock} label="Pending Requests" value={leaveStats.pendingRequests} tone="amber" />
      </div>
      <Card className="border-slate-200 bg-white py-0 shadow-sm">
        <CardHeader className="flex-row items-center justify-between gap-3 p-4">
          <div><CardTitle>Leave Workflow</CardTitle><CardDescription>Cards include duration, status, remarks, and approval flow.</CardDescription></div>
          <div className="flex rounded-lg border border-slate-200 p-1"><Button size="icon-sm" variant={leaveViewMode === 'timeline' ? 'secondary' : 'ghost'} onClick={() => setLeaveViewMode('timeline')}><List className="h-4 w-4" /></Button><Button size="icon-sm" variant={leaveViewMode === 'grid' ? 'secondary' : 'ghost'} onClick={() => setLeaveViewMode('grid')}><LayoutGrid className="h-4 w-4" /></Button></div>
        </CardHeader>
        <CardContent className={cn('p-4 pt-0', leaveViewMode === 'grid' ? 'grid gap-4 md:grid-cols-2' : 'space-y-3')}>
          {leaveLoading && <p className="text-sm text-slate-500">Loading leave requests...</p>}
          {!leaveLoading && leaveData.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No leave requests yet.</p>}
          {leaveData.map((leave) => {
            const isPending = String(leave.status).toLowerCase() === 'pending';
            return (
              <MotionDiv key={leave.id} variants={itemMotion} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div><Badge className="mb-3 border-blue-200 bg-blue-50 text-blue-700">{leave.type}</Badge><h3 className="font-semibold text-slate-950">{getLeaveDays(leave.startDate, leave.endDate)} day request</h3><p className="mt-1 text-sm text-slate-500">{formatDate(leave.startDate)} - {formatDate(leave.endDate)}</p></div>
                  <Badge className={cn('border', getStatusClass(leave.status))}>{leave.status}</Badge>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500"><span className="block font-semibold text-slate-800">Submitted</span>{formatDate(leave.createdAt || leave.requestDate || leave.startDate)}</div><div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500"><span className="block font-semibold text-slate-800">Approval</span>{isPending ? 'Awaiting admin' : 'Reviewed'}</div><div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500"><span className="block font-semibold text-slate-800">Remarks</span>{leave.adminNote || leave.adminRemarks || 'No remarks'}</div></div>
                {leave.reason && <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">{leave.reason}</p>}
                {isPending && <div className="mt-4 flex gap-2"><Button variant="outline" size="sm" onClick={() => handleEditLeave(leave)}><Edit className="h-3.5 w-3.5" />Edit</Button><Button variant="destructive" size="sm" onClick={() => setLeaveToDelete(leave)}><Trash2 className="h-3.5 w-3.5" />Delete</Button></div>}
              </MotionDiv>
            );
          })}
        </CardContent>
      </Card>
    </MotionDiv>
  );

  const renderExpenses = () => (
    <MotionDiv {...tabContentProps} className="space-y-5">
      <SectionTitle icon={Wallet} title="Expenses & Claims" description="Submit reimbursements, track finance approvals, and review receipt evidence." action={<Button onClick={openExpenseForm}><Plus className="h-4 w-4" />Submit Claim</Button>} />
      {expenseError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{expenseError}</div>}
      <div className="grid gap-4 sm:grid-cols-3"><MetricCard icon={CheckCircle} label="Approved" value={`Rs ${expenseStats.approved.toLocaleString('en-IN')}`} tone="emerald" /><MetricCard icon={Clock} label="Pending" value={`Rs ${expenseStats.pending.toLocaleString('en-IN')}`} tone="amber" /><MetricCard icon={XCircle} label="Rejected" value={`Rs ${expenseStats.rejected.toLocaleString('en-IN')}`} tone="rose" /></div>
      <Card className="border-slate-200 bg-white py-0 shadow-sm">
        <CardHeader className="flex-row items-center justify-between gap-3 p-4"><div><CardTitle>Claim Tracker</CardTitle><CardDescription>Receipt previews and animated approval status cards.</CardDescription></div><div className="flex rounded-lg border border-slate-200 p-1"><Button size="icon-sm" variant={expenseViewMode === 'cards' ? 'secondary' : 'ghost'} onClick={() => setExpenseViewMode('cards')}><LayoutGrid className="h-4 w-4" /></Button><Button size="icon-sm" variant={expenseViewMode === 'list' ? 'secondary' : 'ghost'} onClick={() => setExpenseViewMode('list')}><List className="h-4 w-4" /></Button></div></CardHeader>
        <CardContent className={cn('p-4 pt-0', expenseViewMode === 'cards' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3')}>
          {expenseLoading && <p className="text-sm text-slate-500">Loading expenses...</p>}
          {!expenseLoading && expenses.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No claims submitted yet.</p>}
          {expenses.map((expense) => {
            const isPending = String(expense.status).toLowerCase() === 'pending';
            return (
              <MotionDiv key={expense.id} variants={itemMotion} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Receipt className="h-4 w-4" /></div><Badge className={cn('border', getStatusClass(expense.status))}>{expense.status}</Badge></div>
                <h3 className="mt-4 font-semibold text-slate-950">{expense.category}</h3>
                <p className="mt-1 flex items-center text-2xl font-semibold text-slate-950"><IndianRupee className="h-5 w-5" />{Number(expense.amount || 0).toLocaleString('en-IN')}</p>
                <p className="mt-2 line-clamp-2 text-sm text-slate-500">{expense.description || 'No description provided'}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{formatDate(expense.date)}</span>{expense.receiptUrl && <a className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700" href={expense.receiptUrl} target="_blank" rel="noreferrer"><FileCheck className="h-3.5 w-3.5" />Receipt</a>}</div>
                {expense.adminNote && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">Admin: {expense.adminNote}</p>}
                {isPending && <div className="mt-4 flex gap-2"><Button variant="outline" size="sm" onClick={() => handleEditExpense(expense)}><Edit className="h-3.5 w-3.5" />Edit</Button><Button variant="destructive" size="sm" onClick={() => setExpenseToDelete(expense)}><Trash2 className="h-3.5 w-3.5" />Delete</Button></div>}
              </MotionDiv>
            );
          })}
        </CardContent>
      </Card>
    </MotionDiv>
  );

  const renderDocuments = () => (
    <MotionDiv {...tabContentProps} className="space-y-5">
      <SectionTitle icon={FileText} title="Documents" description="Searchable access to professional documents, certificates, forms, and administrative files." action={<Button variant="outline"><Upload className="h-4 w-4" />Upload Document</Button>} />
      <Card className="border-slate-200 bg-white py-0 shadow-sm">
        <CardHeader className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={documentQuery} onChange={(e) => setDocumentQuery(e.target.value)} placeholder="Search documents" className="pl-9" /></div></CardHeader>
        <CardContent className="grid gap-4 p-4 pt-0 md:grid-cols-2 xl:grid-cols-4">
          {filteredDocuments.map((document) => (
            <MotionDiv key={document.id} whileHover={{ y: -2 }} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700"><FileText className="h-5 w-5" /></div>
              <h3 className="mt-4 font-semibold text-slate-950">{document.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{document.category}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{document.type} · {document.size}</span><span>{formatDate(document.uploadDate)}</span></div>
              <div className="mt-4 flex gap-2"><Button variant="outline" size="sm" className="flex-1"><FileCheck className="h-3.5 w-3.5" />Preview</Button><Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" /></Button></div>
            </MotionDiv>
          ))}
        </CardContent>
      </Card>
    </MotionDiv>
  );

  const renderNotifications = () => (
    <MotionDiv {...tabContentProps} className="space-y-5">
      <SectionTitle icon={BellRing} title="Notifications" description="A smart workflow inbox for leave, expense, attendance, administrative, and profile actions." action={<Badge className="border-violet-200 bg-violet-50 text-violet-700">{unreadNotifications} unread</Badge>} />
      <div className="grid gap-3">
        {notifications.map((notification) => (
          <MotionButton key={notification.id} whileHover={{ x: 2 }} type="button" onClick={() => setNotifications((prev) => prev.map((item) => item.id === notification.id ? { ...item, read: true } : item))} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm outline-none transition hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-slate-400">
            <div className="flex gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', notification.type === 'success' && 'bg-emerald-50 text-emerald-700', notification.type === 'warning' && 'bg-amber-50 text-amber-700', notification.type === 'info' && 'bg-blue-50 text-blue-700')}>
                {notification.type === 'success' ? <CheckCircle className="h-4 w-4" /> : notification.type === 'warning' ? <AlertCircle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{notification.title}</h3>{!notification.read && <span className="h-2 w-2 rounded-full bg-violet-500" />}<Badge className="border-slate-200 bg-slate-50 text-slate-600">{notification.category}</Badge></div><p className="mt-1 text-sm text-slate-500">{notification.message}</p></div>
              <span className="hidden text-xs text-slate-400 sm:block">{notification.timestamp}</span>
            </div>
          </MotionButton>
        ))}
      </div>
    </MotionDiv>
  );

  const renderProfile = () => (
    <MotionDiv {...tabContentProps} className="space-y-5">
      <SectionTitle icon={User} title="Profile & Identity" description="Maintain professional identity, contact details, and secure emergency information." action={<Button onClick={handleProfileEditSave} disabled={profileSaving || profileLoading}>{editProfile ? <Save className="h-4 w-4" /> : <Edit className="h-4 w-4" />}{editProfile ? 'Save Profile' : 'Edit Profile'}</Button>} />
      {profileError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{profileError}</div>}
      {profileSuccess && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{profileSuccess}</div>}
      <div className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
        <Card className="border-slate-200 bg-white py-0 shadow-sm"><CardContent className="p-5 text-center"><Avatar className="mx-auto h-24 w-24 border border-slate-200 shadow-sm"><AvatarImage src={profileData.profilePic} alt={profileData.name || 'Teacher'} /><AvatarFallback className="bg-slate-900 text-2xl font-semibold text-white">{profileData.name?.charAt(0) || 'T'}</AvatarFallback></Avatar><h3 className="mt-4 text-lg font-semibold text-slate-950">{profileData.name || 'Teacher'}</h3><p className="text-sm text-slate-500">{profileData.department || 'Department not set'}</p><div className="mt-5 text-left"><div className="flex items-center justify-between text-sm"><span className="text-slate-500">Profile completion</span><span className="font-semibold text-slate-900">{profileCompletion}%</span></div><Progress value={profileCompletion} className="mt-2 h-2" /></div><input ref={profilePicInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} /><Button variant="outline" className="mt-5 w-full" onClick={() => profilePicInputRef.current?.click()} disabled={profileSaving}><Camera className="h-4 w-4" />Update Avatar</Button></CardContent></Card>
        <Card className="border-slate-200 bg-white py-0 shadow-sm"><CardHeader className="p-4"><CardTitle>Identity Details</CardTitle><CardDescription>Grouped sections for personal, contact, professional, and emergency information.</CardDescription></CardHeader><CardContent className="grid gap-4 p-4 pt-0 md:grid-cols-2">
          <Field label="Full Name" icon={User}><Input value={profileData.name} disabled={!editProfile} onChange={(e) => setProfileData((prev) => ({ ...prev, name: e.target.value }))} /></Field>
          <Field label="Employee ID" icon={BadgeCheck}><Input value={profileData.employeeId} disabled /></Field>
          <Field label="Email" icon={Mail}><Input value={profileData.email} disabled={!editProfile} onChange={(e) => setProfileData((prev) => ({ ...prev, email: e.target.value }))} /></Field>
          <Field label="Phone" icon={Phone}><Input value={profileData.phone} disabled={!editProfile} onChange={(e) => setProfileData((prev) => ({ ...prev, phone: e.target.value }))} /></Field>
          <Field label="Department" icon={Briefcase}><Input value={profileData.department} disabled={!editProfile} onChange={(e) => setProfileData((prev) => ({ ...prev, department: e.target.value }))} /></Field>
          <Field label="Joining Date" icon={CalendarDays}><Input type="date" value={profileData.joinDate} disabled={!editProfile} onChange={(e) => setProfileData((prev) => ({ ...prev, joinDate: e.target.value }))} /></Field>
          <Field label="Address" icon={MapPin}><Textarea value={profileData.address} disabled={!editProfile} onChange={(e) => setProfileData((prev) => ({ ...prev, address: e.target.value }))} className="min-h-20" /></Field>
          <Field label="Emergency Contact" icon={Shield}><Textarea value={profileData.emergencyContact} disabled={!editProfile} onChange={(e) => setProfileData((prev) => ({ ...prev, emergencyContact: e.target.value }))} className="min-h-20" /></Field>
        </CardContent></Card>
      </div>
    </MotionDiv>
  );

  const renderInsights = () => (
    <MotionDiv {...tabContentProps} className="space-y-5">
      <SectionTitle icon={TrendingUp} title="Work Insights" description="Operational signals that summarize consistency, leave usage, reimbursements, and monthly readiness." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard icon={Gauge} label="Work Health Score" value={insightScore} tone="blue" progress={insightScore} /><MetricCard icon={Activity} label="Attendance Consistency" value={`${attendanceStats.attendanceRate || 0}%`} tone="emerald" progress={attendanceStats.attendanceRate || 0} /><MetricCard icon={CalendarRange} label="Leave Utilization" value={`${leaveStats.usedDays}/${leavePolicy.casualLeaveDays}`} tone="amber" progress={(leaveStats.usedDays / Math.max(leavePolicy.casualLeaveDays || 1, 1)) * 100} /><MetricCard icon={Wallet} label="Claim Volume" value={`Rs ${(expenseStats.approved + expenseStats.pending).toLocaleString('en-IN')}`} tone="violet" /></div>
      <Card className="border-slate-200 bg-white py-0 shadow-sm"><CardHeader className="p-4"><CardTitle>Monthly Work Statistics</CardTitle><CardDescription>{toMonthLabel(selectedMonth)} summary</CardDescription></CardHeader><CardContent className="space-y-4 p-4 pt-0"><div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Work streak</p><p className="mt-1 text-xl font-semibold text-slate-950">{attendanceStats.presentDays || 0} days</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Punctuality signal</p><p className="mt-1 text-xl font-semibold text-slate-950">{attendanceStats.lateDays ? 'Needs attention' : 'On track'}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Pending approvals</p><p className="mt-1 text-xl font-semibold text-slate-950">{leaveStats.pendingRequests + expenseStats.pendingCount}</p></div></div><Separator /><p className="text-sm text-slate-500">Insight is calculated from attendance rate, remaining leave buffer, and profile readiness. It is a workspace signal, not a performance grade.</p></CardContent></Card>
    </MotionDiv>
  );

  const renderContent = () => {
    const content = {
      overview: renderOverview,
      attendance: renderAttendance,
      leave: renderLeave,
      expenses: renderExpenses,
      documents: renderDocuments,
      notifications: renderNotifications,
      profile: renderProfile,
      insights: renderInsights
    }[activeTab];
    return content?.();
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-3 py-4 text-slate-900 sm:px-5 lg:px-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Teacher Work Portal</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">My Work</h1><p className="mt-1 text-sm text-slate-500">Attendance, leave, claims, documents, notifications, and identity in one workspace.</p></div>
            <div className="flex flex-wrap gap-2">{quickActions.slice(0, 3).map((action) => <Button key={action.label} size="sm" variant={action.label === 'Check In' || action.label === 'Check Out' ? 'default' : 'outline'} disabled={action.disabled} onClick={action.onClick}><action.icon className="h-3.5 w-3.5" />{action.label}</Button>)}</div>
          </div>

          <div className="sticky top-0 z-20 -mx-3 border-y border-slate-200/70 bg-[#f6f8fb]/90 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tabs.map((tab) => {
                const active = activeTab === tab.id;
                return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={cn('flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-slate-400', active ? 'border-slate-900 bg-slate-950 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950')}><tab.icon className="h-4 w-4" />{tab.label}</button>;
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
        </div>

        <AnimatePresence>
          {showLeaveForm && (
            <Modal open title={leaveEditId ? 'Edit Leave Request' : 'Apply Leave'} description="Submit a leave request with dates, type, and context for approval." onClose={() => { setShowLeaveForm(false); setLeaveEditId(null); }}>
              <form className="space-y-4" onSubmit={submitLeaveRequest}>
                {leaveError && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{leaveError}</div>}
                <Field label="Leave Type"><MiniSelect value={leaveForm.type} onChange={(e) => setLeaveForm((prev) => ({ ...prev, type: e.target.value }))}><option>Sick Leave</option><option>Casual Leave</option><option>Half Day</option><option>Emergency Leave</option></MiniSelect></Field>
                <div className="grid gap-3 sm:grid-cols-2"><Field label="Start Date"><Input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm((prev) => ({ ...prev, startDate: e.target.value }))} /></Field><Field label="End Date"><Input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm((prev) => ({ ...prev, endDate: e.target.value }))} /></Field></div>
                <Field label="Reason"><Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))} placeholder="Reason for leave" /></Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setShowLeaveForm(false)}>Cancel</Button><Button type="submit" disabled={leaveSubmitting}><Check className="h-4 w-4" />{leaveSubmitting ? 'Submitting...' : leaveEditId ? 'Update Request' : 'Submit Request'}</Button></div>
              </form>
            </Modal>
          )}

          {showExpenseForm && (
            <Modal open title={expenseEditId ? 'Edit Expense Claim' : 'Submit Expense Claim'} description="Attach receipts and submit the claim for finance approval." onClose={() => { setShowExpenseForm(false); setExpenseEditId(null); }}>
              <form className="space-y-4" onSubmit={handleExpenseSubmit}>
                {expenseError && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{expenseError}</div>}
                <div className="grid gap-3 sm:grid-cols-2"><Field label="Category"><MiniSelect value={expenseForm.category} onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}><option>Travel</option><option>Supplies</option><option>Training</option><option>Entertainment</option><option>Other</option></MiniSelect></Field><Field label="Date"><Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value }))} /></Field></div>
                <Field label="Amount"><Input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))} placeholder="0.00" /></Field>
                <Field label="Description"><Textarea value={expenseForm.description} onChange={(e) => setExpenseForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Describe the expense" /></Field>
                <Field label="Receipt"><div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center"><input id="receipt-upload" type="file" className="hidden" onChange={(e) => setExpenseForm((prev) => ({ ...prev, receiptFile: e.target.files?.[0] || null }))} /><label htmlFor="receipt-upload" className="cursor-pointer text-sm text-slate-600"><Upload className="mx-auto mb-2 h-6 w-6 text-slate-400" />Click to upload receipt</label>{expenseForm.receiptFile && <p className="mt-2 text-xs text-emerald-700">Selected: {expenseForm.receiptFile.name}</p>}{expenseForm.receiptName && !expenseForm.receiptFile && <p className="mt-2 text-xs text-slate-500">Current: {expenseForm.receiptName}</p>}</div></Field>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setShowExpenseForm(false)}>Cancel</Button><Button type="submit" disabled={expenseSubmitting}><Check className="h-4 w-4" />{expenseSubmitting ? 'Submitting...' : expenseEditId ? 'Update Claim' : 'Submit Claim'}</Button></div>
              </form>
            </Modal>
          )}

          {leaveToDelete && (
            <Modal open title="Delete leave request?" description="This pending leave request will be removed permanently." size="max-w-sm" onClose={() => setLeaveToDelete(null)} footer={<><Button variant="outline" onClick={() => setLeaveToDelete(null)} disabled={leaveDeleting}>Cancel</Button><Button variant="destructive" onClick={confirmDeleteLeave} disabled={leaveDeleting}><Trash2 className="h-4 w-4" />Delete</Button></>} />
          )}

          {expenseToDelete && (
            <Modal open title="Delete expense claim?" description="This pending claim will be removed permanently." size="max-w-sm" onClose={() => setExpenseToDelete(null)} footer={<><Button variant="outline" onClick={() => setExpenseToDelete(null)} disabled={expenseDeleting}>Cancel</Button><Button variant="destructive" onClick={confirmDeleteExpense} disabled={expenseDeleting}><Trash2 className="h-4 w-4" />Delete</Button></>} />
          )}
        </AnimatePresence>
    </div>
  );
};

export default MyWorkPortal;
