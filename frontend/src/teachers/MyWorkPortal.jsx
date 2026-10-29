import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  Play,
  Flame,
  Info,
  Users,
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
  Loader2,
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
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { subscribeSocketEvent } from '@/hooks/useCommunityWallUnread';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const MotionButton = motion.button;
const MotionDiv = motion.div;

const Progress = ({ value = 0, className }) => (
  <div className={cn('h-2 overflow-hidden rounded-full bg-slate-100', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(Number(value) || 0, 100))}>
    <div className="h-full rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${Math.max(0, Math.min(Number(value) || 0, 100))}%` }} />
  </div>
);

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

// Map a raw /api/notifications/user record into the shape this portal renders.
const relativeTime = (value) => {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};
const mapNotification = (raw) => {
  const kindText = `${raw?.type || ''} ${raw?.typeLabel || ''} ${raw?.title || ''}`.toLowerCase();
  const type = /approv|success|confirm|complete/.test(kindText)
    ? 'success'
    : /reject|declin|overdue|warning|action required|pending|documentation/.test(kindText)
      ? 'warning'
      : 'info';
  return {
    id: String(raw?._id || raw?.id || ''),
    title: raw?.title || 'Notification',
    message: raw?.message || '',
    type,
    category: raw?.typeLabel || raw?.category || 'Workflow',
    read: Boolean(raw?.isRead),
    timestamp: relativeTime(raw?.createdAt),
  };
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
const defaultLeaveForm = { type: 'Sick Leave', customType: '', startDate: '', endDate: '', reason: '' };
// Local YYYY-MM-DD for today (date inputs compare as strings).
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const LEAVE_TYPES = ['Sick Leave', 'Casual Leave', 'Half Day', 'Emergency Leave'];

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
  permanentAddress: teacher.permanentAddress || '',
  sameAsPresent: Boolean(teacher.address) && teacher.permanentAddress === teacher.address,
  emergencyContact: teacher.emergencyContact || '',
  emergencyContactName: teacher.emergencyContactName || '',
  gender: teacher.gender || '',
  dob: teacher.dob || '',
  bloodGroup: teacher.bloodGroup || '',
  accountStatus: teacher.accountStatus || 'Active',
  alternatePhone: teacher.alternatePhone || '',
  pinCode: teacher.pinCode || '',
  city: teacher.city || '',
  district: teacher.district || '',
  state: teacher.state || '',
  designation: teacher.designation || '',
  specialization: teacher.specialization || '',
  employeeType: teacher.employeeType || '',
  qualification: teacher.qualification || '',
  experience: teacher.experience || '',
  classTeacherOf: teacher.classTeacherOf || '',
  profilePic: teacher.profilePic || '',
  subject: teacher.subject || '',
  coverImage: teacher.schoolCoverImage || '',
  classLabels: Array.isArray(teacher.classLabels) ? teacher.classLabels : [],
});

// Labelled form field for the Profile & Identity page (module level so inputs keep focus).
const ProfileField = ({ label, required, full, children }) => (
  <label className={cn('block', full && 'sm:col-span-2')}>
    <span className="mb-1 block text-[12px] font-medium text-[#0f1b3d]">{label}{required && <span className="text-[#ef4444]"> *</span>}</span>
    {children}
  </label>
);

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

// Card tints used across the My Work overview (green / blue / amber / purple).
const TONES = {
  green:  { bg: '#effaf3', border: '#d4f1de', tile: '#d8f3e2', icon: '#16a34a', ring: '#22c55e', track: '#d8f3e2' },
  blue:   { bg: '#eff5ff', border: '#d9e6fd', tile: '#dbe7fe', icon: '#2563eb', ring: '#2563eb', track: '#dbe7fe' },
  amber:  { bg: '#fff8ec', border: '#fbe7c6', tile: '#fdebc8', icon: '#f59e0b', ring: '#f59e0b', track: '#fdebc8' },
  purple: { bg: '#f7f2ff', border: '#e8dcfd', tile: '#ece2fe', icon: '#9333ea', ring: '#a855f7', track: '#ece2fe' },
};

const RingGauge = ({ percent = 0, color, track, text, sub, size = 84 }) => {
  const stroke = size < 70 ? 6 : 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="white" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-bold text-[#0f1b3d]" style={{ fontSize: Math.round(size / 5.6) }}>{text}</span>
        {sub && <span className="mt-0.5 text-[10px] font-semibold text-[#334155]">{sub}</span>}
      </div>
    </div>
  );
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

const Modal = ({ open, title, description, children, footer, onClose, size = 'max-w-lg', drawer = false }) => {
  if (!open) return null;
  // drawer: full-height panel that slides in from the right edge
  if (drawer) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
        <MotionDiv initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.28, ease }} role="dialog" aria-modal="true" aria-labelledby="drawer-title" className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 id="drawer-title" className="text-lg font-semibold text-slate-950">{title}</h2>
              {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close panel"><X className="h-4 w-4" /></Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
        </MotionDiv>
      </div>
    );
  }
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
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview');
  // Notification links (e.g. ?tab=leave) open the matching section.
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);
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
  const [leaveToDelete, setLeaveToDelete] = useState(null);
  const [leaveDeleting, setLeaveDeleting] = useState(false);
  const [leaveForm, setLeaveForm] = useState(defaultLeaveForm);
  const [leavePolicy, setLeavePolicy] = useState({ casualLeaveDays: 12 });
  const [leaveQuota, setLeaveQuota] = useState({
    casualUsedDays: 0,
    casualAvailableDays: 12,
    totalAllowanceDays: 12,
    approvedLeaveDays: 0,
    pendingLeaveDays: 0,
    absentDays: 0,
    usedDays: 0,
    availableDays: 12,
    projectedAvailableDays: 12,
  });
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
  const [, setEditProfile] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [documentQuery, setDocumentQuery] = useState('');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Sparkles },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'leave', label: 'Leave Management', icon: CalendarRange },
    { id: 'expenses', label: 'Expenses & Claims', icon: Wallet },
    // { id: 'documents', label: 'Documents', icon: FileText },
    // { id: 'notifications', label: 'Notifications', icon: BellRing },
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
      const policyDays = Number(data?.leavePolicy?.casualLeaveDays) || 12;
      setLeavePolicy({ casualLeaveDays: policyDays });
      const stats = data?.leaveStats || {};
      const num = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
      const totalAllowanceDays = num(stats.totalAllowanceDays, policyDays);
      const availableDays = num(stats.availableDays, num(stats.casualAvailableDays, totalAllowanceDays));
      setLeaveQuota({
        casualUsedDays: num(stats.casualUsedDays, 0),
        casualAvailableDays: availableDays,
        totalAllowanceDays,
        approvedLeaveDays: num(stats.approvedLeaveDays, 0),
        pendingLeaveDays: num(stats.pendingLeaveDays, 0),
        absentDays: num(stats.absentDays, 0),
        usedDays: num(stats.usedDays, Math.max(totalAllowanceDays - availableDays, 0)),
        availableDays,
        projectedAvailableDays: num(stats.projectedAvailableDays, availableDays),
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
      if (!leaveEditId && leaveForm.startDate < todayISO()) throw new Error('Start date cannot be in the past');
      if (leaveForm.endDate < leaveForm.startDate) throw new Error('End date cannot be before the start date');
      const isOther = leaveForm.type === 'Others';
      if (isOther && !leaveForm.customType.trim()) throw new Error('Enter the leave type name');
      const { customType, ...rest } = leaveForm;
      const payload = { ...rest, type: isOther ? customType.trim() : leaveForm.type };

      const endpoint = leaveEditId
        ? `${API_BASE}/api/teacher/dashboard/leave-requests/${leaveEditId}`
        : `${API_BASE}/api/teacher/dashboard/leave-requests`;
      const res = await fetch(endpoint, {
        method: leaveEditId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
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
    const known = !leave.type || LEAVE_TYPES.includes(leave.type);
    setLeaveForm({ type: known ? (leave.type || 'Sick Leave') : 'Others', customType: known ? '' : leave.type, startDate: leave.startDate || '', endDate: leave.endDate || '', reason: leave.reason || '' });
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
        const uploadRes = await fetch(`${API_BASE}/api/uploads/cloudinary/single`, {
          method: 'POST',
          headers: { authorization: `Bearer ${localStorage.getItem('token') || ''}` },
          body: uploadForm,
        });
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

    const isTenDigits = (v) => /^\d{10}$/.test(String(v || ''));
    const phoneProblem = !isTenDigits(profileData.phone)
      ? ['contact', 'Phone must be a 10-digit number']
      : profileData.alternatePhone && !isTenDigits(profileData.alternatePhone)
        ? ['contact', 'Alternate phone must be a 10-digit number']
        : profileData.emergencyContact && !isTenDigits(profileData.emergencyContact)
          ? ['emergency', 'Emergency contact phone must be a 10-digit number']
          : null;
    if (phoneProblem) {
      setProfileSection(phoneProblem[0]);
      setProfileError(phoneProblem[1]);
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
          email: profileData.email,
          mobile: profileData.phone,
          alternatePhone: profileData.alternatePhone,
          pinCode: profileData.pinCode,
          address: profileData.address,
          permanentAddress: profileData.sameAsPresent ? profileData.address : profileData.permanentAddress,
          city: profileData.city,
          district: profileData.district,
          state: profileData.state,
          qualification: profileData.qualification,
          specialization: profileData.specialization,
          experience: profileData.experience,
          emergencyContactName: profileData.emergencyContactName,
          emergencyContact: profileData.emergencyContact
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to update profile');
      setProfileData((prev) => ({ ...mapProfileFromApi(data?.teacher || data || {}), coverImage: prev.coverImage, classLabels: prev.classLabels }));
      setProfileSuccess('Profile updated successfully');
      setEditProfile(false);
    } catch (error) {
      setProfileError(error.message || 'Unable to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    fetchWorkAttendance(selectedMonth);
  }, [fetchWorkAttendance, selectedMonth]);

  const fetchNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { setNotifications([]); return; }
      const res = await fetch(`${API_BASE}/api/notifications/user?kind=notification`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Unable to load notifications');
      setNotifications(
        (Array.isArray(data) ? data : [])
          .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
          .slice(0, 30)
          .map(mapNotification)
      );
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const markNotificationRead = useCallback(async (id) => {
    if (!id) return;
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await fetch(`${API_BASE}/api/notifications/user/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      });
    } catch {
      /* optimistic update stands; server will reconcile on next load */
    }
  }, []);

  useEffect(() => {
    fetchLeaveRequests();
    fetchExpenses();
    fetchNotifications();
  }, [fetchNotifications]);

  // When an admin approves/rejects a leave, refresh the table + balance right away.
  const fetchLeaveRequestsRef = useRef(fetchLeaveRequests);
  fetchLeaveRequestsRef.current = fetchLeaveRequests;
  useEffect(() => subscribeSocketEvent('new_notification', (payload) => {
    if (String(payload?.typeLabel || '') === 'teacher_leave_reviewed') fetchLeaveRequestsRef.current();
  }), []);

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
    const approved = leaveData.filter((leave) => String(leave.status).toLowerCase() === 'approved');
    // "Used Leave" / "Leave Utilization" reflect ALL approved leave, so a sick or
    // other-type leave still moves them. `casualUsedDays` stays casual-only for the
    // dedicated casual-leave balance card.
    const usedDays = approved.reduce((sum, leave) => sum + getLeaveDays(leave.startDate, leave.endDate), 0);
    const casualUsedDays = approved
      .filter((leave) => String(leave.type || '').toLowerCase() === 'casual leave')
      .reduce((sum, leave) => sum + getLeaveDays(leave.startDate, leave.endDate), 0);
    const pendingRequests = leaveData.filter((leave) => String(leave.status).toLowerCase() === 'pending').length;
    return {
      usedDays,
      casualUsedDays,
      pendingRequests,
      availableDays: Math.max((leavePolicy.casualLeaveDays || 0) - casualUsedDays, 0)
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
    // { label: activeSession ? 'Check Out' : 'Check In', icon: activeSession ? LogOut : LogIn, onClick: activeSession ? handleCheckOut : handleCheckIn, disabled: attendanceSaving || todayAttendance.hasCheckedOut || (!activeSession && todayAttendance.hasCheckedIn), tone: 'emerald' },
    // { label: 'Apply Leave', icon: CalendarRange, onClick: openLeaveForm, disabled: false, tone: 'blue' },
    // { label: 'Submit Claim', icon: Receipt, onClick: openExpenseForm, disabled: false, tone: 'violet' },
    // { label: 'Update Profile', icon: User, onClick: () => setActiveTab('profile'), disabled: false, tone: 'slate' }
  ];

  const tabContentProps = shouldReduceMotion ? {} : panelMotion;

  // ── Overview: one screen, no page scroll (sized to the space below the portal header) ──
  const overviewRef = useRef(null);
  const [overviewHeight, setOverviewHeight] = useState(null);
  useLayoutEffect(() => {
    if (!['overview', 'attendance', 'leave', 'profile'].includes(activeTab)) return undefined;
    const measure = () => {
      const top = overviewRef.current?.getBoundingClientRect().top ?? 0;
      setOverviewHeight(Math.max(560, window.innerHeight - Math.max(0, top)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeTab]);

  const quickActionCards = [
    { label: 'My Attendance', hint: "Take today's attendance", icon: CalendarCheck, tone: TONES.green, onClick: () => setActiveTab('attendance') },
    { label: 'My Leaves', hint: 'Request time off', icon: FileText, tone: TONES.blue, onClick: () => setActiveTab('leave') },
    { label: 'Update Profile', hint: 'Manage your information', icon: User, tone: TONES.purple, onClick: () => setActiveTab('profile') },
  ];
  const claimVolume = expenseStats.approved + expenseStats.pending;
  const insightRings = [
    { label: 'Work Health Score', tone: TONES.blue, icon: BarChart3, percent: insightScore, text: `${insightScore}%`, tip: 'Average of attendance rate, leave buffer left and profile completeness.' },
    { label: 'Attendance Consistency', tone: TONES.green, icon: User, percent: attendanceStats.attendanceRate || 0, text: `${attendanceStats.attendanceRate || 0}%`, tip: 'Share of working days you were present this month.' },
    { label: 'Approved Leave Days', tone: TONES.amber, icon: CalendarCheck, percent: Math.min(100, (leaveQuota.approvedLeaveDays / Math.max(leaveQuota.totalAllowanceDays || 1, 1)) * 100), text: String(leaveQuota.approvedLeaveDays || 0), sub: 'days', tip: 'Leave days approved this session.' },
    { label: 'Claim Volume', tone: TONES.purple, icon: FileText, percent: claimVolume ? 100 : 0, text: `Rs ${claimVolume.toLocaleString('en-IN')}`, tip: 'Approved plus pending reimbursement claims.' },
  ];
  const punctualityOk = !attendanceStats.lateDays;

  const renderOverview = () => (
    <MotionDiv {...tabContentProps} className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Profile banner — school cover photo on the right */}
      <div className="relative flex min-h-[92px] shrink-0 items-center overflow-hidden rounded-2xl border border-[#dbe9fb] bg-linear-to-r from-[#e6f1fd] via-[#eef6ff] to-[#f5f9ff]">
        {profileData.coverImage && (
          <div className="absolute inset-y-0 right-0 hidden w-[80%] md:block">
            <img src={profileData.coverImage} alt="" className="h-full w-full object-cover" />
            {/* Fade only the left edge so the name and details stay readable over the photo. */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #eef6ff 0%, rgba(238,246,255,0.85) 22%, rgba(238,246,255,0.25) 42%, transparent 60%)' }} />
          </div>
        )}
        <div className="relative flex items-center gap-4 px-4 py-2.5 sm:px-5">
          <Avatar className="h-16 w-16 shrink-0 border-[3px] border-white shadow-[0_6px_18px_rgba(30,64,175,0.15)]">
            <AvatarImage src={profileData.profilePic} alt={profileData.name || 'Teacher'} className="object-cover" />
            <AvatarFallback className="bg-[#1e3a8a] text-2xl font-semibold text-white">{profileData.name?.charAt(0) || 'T'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <span className="inline-block rounded-full bg-[#2563eb] px-2.5 py-px text-[11px] font-semibold text-white">Teacher</span>
            <h2 className="mt-1 truncate text-[19px] font-bold leading-tight text-[#0f1b3d]">{profileData.name || 'Teacher'}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[12px] text-[#475569]">
              {(profileData.subject || profileData.department) && (
                <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-[#64748b]" />{profileData.subject || profileData.department}</span>
              )}
              {profileData.classLabels?.length > 0 && (
                <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-[#64748b]" /> <span className='font-medium text-[#0f1b3d]'> Class Teacher: </span> {profileData.classLabels.join(', ')}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="shrink-0">
        <h3 className="mb-1.5 text-[13px] font-bold text-[#0f1b3d]">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {quickActionCards.map(({ label, hint, icon: Icon, tone, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              title={hint}
              className="group flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-left transition hover:shadow-sm"
              style={{ backgroundColor: tone.bg, borderColor: tone.border }}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm" style={{ backgroundColor: tone.icon }}><Icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#0f1b3d]">{label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#64748b] transition group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Work Insights */}
      <div className="flex shrink-0 flex-col rounded-2xl border border-[#e6ebf2] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-0.5 h-5 w-5 text-[#2563eb]" />
            <div>
              <h3 className="text-[14px] font-bold text-[#0f1b3d]">Work Insights</h3>
              <p className="text-[12px] text-[#64748b]">Operational signals that summarize consistency, leave usage, reimbursements, and monthly readiness.</p>
            </div>
          </div>
          <label className="relative flex h-8 shrink-0 items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-2.5 text-[12px] font-medium text-[#0f1b3d]">
            <CalendarDays className="h-4 w-4 text-[#64748b]" />
            <span>{toMonthLabel(selectedMonth)}</span>
            <ChevronDown className="h-4 w-4 text-[#64748b]" />
            <input type="month" value={selectedMonth} onChange={(e) => e.target.value && setSelectedMonth(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Choose month" />
          </label>
        </div>

        <div className="mt-2 grid min-h-0 shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
          {insightRings.map(({ label, tone, icon: Icon, percent, text, sub, tip }) => (
            <div key={label} className="relative flex flex-col items-center rounded-xl px-2 py-2" style={{ backgroundColor: tone.bg }}>
              {/* <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: tone.tile, color: tone.icon }}><Icon className="h-3.5 w-3.5" /></span> */}
              <RingGauge percent={percent} color={tone.ring} track={tone.track} text={text} sub={sub} size={62} />
              <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-[#0f1b3d]">
                {label}
                <span title={tip} className="cursor-help text-[#94a3b8]"><Info className="h-3.5 w-3.5" /></span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-2 grid min-h-0 grid-cols-1 items-center gap-2 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 text-[#2563eb]" />
              <div>
                <p className="text-[13px] font-bold text-[#0f1b3d]">Monthly Work Statistics</p>
                <p className="text-[12px] text-[#64748b]">{toMonthLabel(selectedMonth)} summary</p>
              </div>
            </div>
            <div className="mt-1.5 grid grid-cols-3 divide-x divide-[#e2e8f0]">
              {[
                { label: 'Work streak', value: `${attendanceStats.presentDays || 0} day${attendanceStats.presentDays === 1 ? '' : 's'}`, icon: Flame, tile: '#ef4444', color: '#fdecec', valueColor: '#0f1b3d' },
                { label: 'Punctuality signal', value: punctualityOk ? 'On track' : 'Needs attention', icon: Clock, tile: '#9333ea', color: '#f5ecfd', valueColor: punctualityOk ? '#16a34a' : '#f59e0b' },
                { label: 'Pending approvals', value: String(leaveStats.pendingRequests + expenseStats.pendingCount), icon: Check, tile: '#16a34a', color: '#e3f6ea', valueColor: '#0f1b3d' },
              ].map(({ label, value, icon: Icon, tile, color, valueColor }) => (
                <div key={label} className="flex items-center gap-3 px-3 first:pl-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: tile, color }}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] text-[#64748b] font-bold">{label}</p>
                    <p className="truncate text-[14px] font-bold" style={{ color: valueColor }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-[#eef5ff] px-3 py-2 text-[11px] leading-4 text-[#475569]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" />
            <p>Insight is calculated from attendance rate, remaining leave buffer, and profile readiness. It is a workspace signal, not a performance grade.</p>
          </div>
        </div>
      </div>
    </MotionDiv>
  );

  // Day picked on the attendance calendar ('YYYY-MM-DD'); its details replace the activity list.
  const [selectedAttendanceDay, setSelectedAttendanceDay] = useState(null);
  const shiftMonth = (delta) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const next = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };
  const ATTENDANCE_TONE = {
    present: 'bg-[#dcf5e6] text-[#0f1b3d]',
    late: 'bg-[#fdf0d2] text-[#0f1b3d]',
    absent: 'bg-[#fde0e0] text-[#0f1b3d]',
  };
  const ATTENDANCE_SOLID = { present: 'bg-[#16a34a] text-white', late: 'bg-[#f59e0b] text-white', absent: 'bg-[#ef4444] text-white' };

  const renderAttendance = () => {
    const [calYear, calMonth] = selectedMonth.split('-').map(Number);
    const leadingBlanks = calYear && calMonth ? new Date(calYear, calMonth - 1, 1).getDay() : 0;
    const todayKey = new Date().toISOString().slice(0, 10);
    const calendarCells = [...Array.from({ length: leadingBlanks }, () => null), ...attendanceHeatmap];
    while (calendarCells.length % 7) calendarCells.push(null);
    const consistency = Math.max(0, 100 - Number(attendanceStats.lateDays || 0) * 5);
    const statCards = [
      { label: 'Attendance Rate', value: `${attendanceStats.attendanceRate || 0}%`, icon: User, tile: '#dcf5e6', color: '#16a34a', tip: 'Share of working days you were present this month.' },
      { label: 'Late Days', value: attendanceStats.lateDays || 0, icon: Clock, tile: '#fdf0d2', color: '#f59e0b', tip: 'Days you checked in after the start time.' },
      { label: 'Absent Days', value: attendanceStats.absentDays || 0, icon: XCircle, tile: '#fde0e0', color: '#ef4444', tip: 'Working days with no check-in.' },
      { label: 'Consistency', value: `${consistency}%`, icon: BarChart3, tile: '#efe4fd', color: '#9333ea', tip: 'Starts at 100% and drops 5% per late day.' },
    ];
    const pickedDay = selectedAttendanceDay?.startsWith(selectedMonth) ? selectedAttendanceDay : null;
    const pickedRecord = pickedDay ? attendanceHeatmap.find((c) => `${selectedMonth}-${String(c.day).padStart(2, '0')}` === pickedDay)?.record : null;
    const pickedStatus = String(pickedRecord?.status || '').toLowerCase();
    const sessionStatus = activeSession
      ? { text: 'Session active', cls: 'bg-[#15803d] text-white' }
      : todayAttendance.hasCheckedOut
        ? { text: 'Checked out', cls: 'bg-[#dbeafe] text-[#2563eb]' }
        : { text: 'Not checked in yet', cls: 'bg-[#fdf0d2] text-[#b45309]' };
    const primaryAction = activeSession
      ? { label: 'Check-out', sub: 'End your work session', icon: LogOut, onClick: handleCheckOut, disabled: attendanceSaving }
      : { label: 'Check-in', sub: 'Start your work session', icon: Play, onClick: handleCheckIn, disabled: attendanceSaving || todayAttendance.hasCheckedIn };

    return (
      <MotionDiv {...tabContentProps} className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold leading-tight text-[#0f1b3d]">Attendance</h2>
            <p className="text-[12px] text-[#64748b]">Track your work session, monthly consistency, and attendance history.</p>
          </div>
        </div>

        {attendanceError && <div className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{attendanceError}</div>}

        {/* Current session */}
        <div className="grid shrink-0 grid-cols-1 items-center gap-2 rounded-xl border border-[#dbe9fb] bg-[#eef5ff] px-3 py-2 lg:grid-cols-[1fr_auto_auto]">
          <div className="flex flex-wrap items-center justify-between gap-3 lg:border-r lg:border-[#d6e4f7] lg:pr-4">
            <div>
              <p className="flex items-center gap-2 text-[13px] font-bold text-[#0f1b3d]"><span className={cn('h-2 w-2 rounded-full', activeSession ? 'animate-pulse bg-[#22c55e]' : 'bg-[#22c55e]')} />Current Session</p>
              <p className="pl-4 text-[11px] text-[#64748b]">{toMonthLabel(selectedMonth)} work attendance</p>
              <div className="flex items-center gap-2 pl-1">
                <span className="text-[20px] font-bold leading-tight text-[#0f1b3d]">{formatWorkingHours(todayAttendance.workingMinutes)}</span>
                <span className={cn('rounded-full px-2 py-px text-[11px] font-medium', sessionStatus.cls)}>{sessionStatus.text}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-1.5 text-left text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <primaryAction.icon className="h-4 w-4 fill-white" />
              <span><span className="block text-[13px] font-bold leading-tight">{todayAttendance.hasCheckedOut ? 'Done for today' : primaryAction.label}</span><span className="block text-[10px] text-white/85">{primaryAction.sub}</span></span>
            </button>
          </div>
          {[
            { label: 'Check-in', value: todayAttendance.checkIn, icon: Clock },
            { label: 'Check-out', value: todayAttendance.checkOut, icon: LogOut },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex min-w-[150px] items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-2.5 py-1.5">
              {/* <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#dbeafe] text-[#2563eb]"><Icon className="h-3 w-3" /></span> */}
              <p className="text-[11px] text-[#64748b]">{label}:</p>
              <p className="ml-auto text-[13px] font-bold text-[#0f1b3d]">{value ? formatTime(value) : '-'}</p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
          {statCards.map(({ label, value, icon: Icon, color, tip }) => (
            <div key={label} className="flex items-center gap-2 rounded-xl border border-[#e6ebf2] bg-white px-2.5 py-1.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm" style={{ backgroundColor: color }}><Icon className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="text-[16px] font-bold leading-tight text-[#0f1b3d]">{value}</p>
                <p className="flex items-center gap-1 text-[11px] text-[#64748b]">{label}<span title={tip} className="cursor-help text-[#94a3b8]"><Info className="h-3.5 w-3.5" /></span></p>
              </div>
            </div>
          ))}
        </div>

        {/* Calendar + activity */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[1.15fr_1fr]">
          <div className="flex min-h-0 flex-col rounded-2xl border border-[#e6ebf2] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex shrink-0 items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 text-[#2563eb]" />
                <div>
                  <p className="text-[14px] font-bold text-[#0f1b3d]">Monthly Attendance</p>
                  <p className="text-[11px] text-[#64748b]">Present, late, and absent days at a glance.</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex h-8 items-center overflow-hidden rounded-lg border border-[#e2e8f0] bg-white text-[12px] font-medium text-[#0f1b3d]">
                  <label className="relative flex h-full items-center gap-1.5 px-2.5">
                    <CalendarDays className="h-3.5 w-3.5 text-[#2563eb]" />
                    {toMonthLabel(selectedMonth)}
                    <input type="month" value={selectedMonth} onChange={(e) => e.target.value && setSelectedMonth(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Choose month" />
                  </label>
                  <button type="button" onClick={() => shiftMonth(-1)} className="flex h-full w-7 items-center justify-center border-l border-[#e2e8f0] hover:bg-slate-50" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" onClick={() => shiftMonth(1)} className="flex h-full w-7 items-center justify-center border-l border-[#e2e8f0] hover:bg-slate-50" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#475569]">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#22c55e]" />Present</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f59e0b]" />Late</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#ef4444]" />Absent</span>
                </div>
              </div>
            </div>
            <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#eef2f7]">
              <div className="grid shrink-0 grid-cols-7 bg-[#f8fafc] text-center text-[11px] font-medium text-[#64748b]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <span key={d} className="py-1">{d}</span>)}
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridAutoRows: '1fr' }}>
                {calendarCells.map((cell, index) => {
                  if (!cell) return <div key={`blank-${index}`} className="border-t border-r border-[#eef2f7] last:border-r-0" />;
                  const status = String(cell.record?.status || '').toLowerCase();
                  const key = `${selectedMonth}-${String(cell.day).padStart(2, '0')}`;
                  const isToday = key === todayKey;
                  return (
                    <div key={cell.day} className="border-t border-r border-[#eef2f7] p-0.5 [&:nth-child(7n)]:border-r-0">
                      <button
                        type="button"
                        onClick={() => setSelectedAttendanceDay(pickedDay === key ? null : key)}
                        title={cell.record ? `${cell.record.status} · ${formatTime(cell.record.checkIn || cell.record.checkInAt)}` : 'No record'}
                        className={cn('flex h-full min-h-[30px] w-full items-center justify-center rounded-md text-[12px] font-medium text-[#334155] transition hover:ring-2 hover:ring-[#93c5fd]', ATTENDANCE_TONE[status], isToday && 'bg-[#2563eb] font-bold text-white', pickedDay === key && 'ring-2 ring-[#2563eb] ring-offset-1')}
                      >
                        {cell.day}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col rounded-2xl border border-[#e6ebf2] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex shrink-0 items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 text-[#2563eb]" />
              <div>
                <p className="text-[14px] font-bold text-[#0f1b3d]">Session Activity</p>
                <p className="text-[11px] text-[#64748b]">Recent attendance records.</p>
              </div>
            </div>
            {pickedDay ? (
              <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex items-center justify-between rounded-xl bg-[#eef5ff] px-3 py-2">
                  <div>
                    <p className="text-[15px] font-bold text-[#0f1b3d]">{new Date(`${pickedDay}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p className="text-[11px] text-[#64748b]">{new Date(`${pickedDay}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })}</p>
                  </div>
                  <span className={cn('rounded-full px-3 py-0.5 text-[12px] font-semibold capitalize', ATTENDANCE_SOLID[pickedStatus] || 'bg-slate-400 text-white')}>{pickedRecord?.status || 'No record'}</span>
                </div>
                {pickedRecord ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Check-in', value: formatTime(pickedRecord.checkIn || pickedRecord.checkInAt), icon: LogIn, tile: '#dcf5e6', color: '#16a34a' },
                      { label: 'Check-out', value: formatTime(pickedRecord.checkOut || pickedRecord.checkOutAt), icon: LogOut, tile: '#fde0e0', color: '#ef4444' },
                      { label: 'Total time', value: formatWorkingHours(pickedRecord.workingMinutes), icon: Timer, tile: '#dbeafe', color: '#2563eb' },
                      { label: 'Status', value: pickedRecord.status || 'Recorded', icon: pickedStatus === 'late' ? Clock : pickedStatus === 'absent' ? XCircle : CheckCircle, tile: pickedStatus === 'late' ? '#fdf0d2' : pickedStatus === 'absent' ? '#fde0e0' : '#dcf5e6', color: pickedStatus === 'late' ? '#f59e0b' : pickedStatus === 'absent' ? '#ef4444' : '#16a34a' },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="flex items-center gap-2 rounded-xl border border-[#e6ebf2] px-3 py-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm" style={{ backgroundColor: color }}><Icon className="h-4 w-4" /></span>
                        <div className="min-w-0">
                          <p className="text-[11px] text-[#64748b]">{label}</p>
                          <p className="truncate text-[14px] font-bold capitalize text-[#0f1b3d]">{value || '-'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-[12px] text-[#64748b]">No attendance was recorded for this day.</p>
                )}
                {pickedRecord?.remarks && <p className="rounded-xl bg-[#f8fafc] px-3 py-2 text-[12px] text-[#475569]"><span className="font-semibold text-[#0f1b3d]">Remarks: </span>{pickedRecord.remarks}</p>}
                <button type="button" onClick={() => setSelectedAttendanceDay(null)} className="mt-auto inline-flex items-center gap-1 self-start text-[12px] font-semibold text-[#2563eb] hover:underline">
                  <ArrowLeft className="h-3.5 w-3.5" />Back to recent records
                </button>
              </div>
            ) : (
            <div className="chat-scroll mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
              {attendanceLoading && <p className="text-[12px] text-[#64748b]">Loading attendance...</p>}
              {!attendanceLoading && attendanceData.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-[12px] text-[#64748b]">No attendance records for this month.</p>}
              {attendanceData.map((record) => {
                const status = String(record.status || '').toLowerCase();
                return (
                  <button type="button" onClick={() => setSelectedAttendanceDay(String(record.date || '').slice(0, 10))} key={record.id || record.date} className="flex w-full items-center gap-3 rounded-xl border border-[#e6ebf2] px-3 py-2 text-left text-[12px] transition hover:border-[#bfdbfe] hover:bg-[#f8fbff]">
                    <span className="w-[86px] shrink-0 font-medium text-[#0f1b3d]">{formatDate(record.date)}</span>
                    <span className="min-w-0 flex-1 truncate text-[#64748b]">{formatTime(record.checkIn || record.checkInAt)} – {formatTime(record.checkOut || record.checkOutAt)}</span>
                    <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize', ATTENDANCE_SOLID[status] || 'bg-slate-400 text-white')}>{record.status || 'Recorded'}</span>
                    <span className="w-[52px] shrink-0 text-right text-[#475569]">{formatWorkingHours(record.workingMinutes)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#94a3b8]" />
                  </button>
                );
              })}
            </div>
            )}
          </div>
        </div>

        {/* <div className="flex shrink-0 items-start gap-3 rounded-2xl border border-[#dbe9fb] bg-[#eef5ff] px-4 py-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" />
          <div>
            <p className="text-[13px] font-bold text-[#0f1b3d]">About Attendance</p>
            <p className="text-[11px] text-[#475569]">Your attendance is recorded when you check-in and check-out. Make sure to check-in at the start of your work session.</p>
          </div>
        </div> */}
      </MotionDiv>
    );
  };

  // Leave table: status filter + pagination sized to the rows that fit the card.
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('all');
  const [leavePage, setLeavePage] = useState(1);
  const [leaveTableEl, setLeaveTableEl] = useState(null);
  const [leavePageSize, setLeavePageSize] = useState(6);
  useEffect(() => {
    if (!leaveTableEl || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      // ~44px per row after the 36px header row
      setLeavePageSize(Math.max(3, Math.floor((entry.contentRect.height - 36) / 44)));
    });
    observer.observe(leaveTableEl);
    return () => observer.disconnect();
  }, [leaveTableEl]);
  useEffect(() => { setLeavePage(1); }, [leaveStatusFilter]);

  const renderLeave = () => {
    const filtered = leaveStatusFilter === 'all' ? leaveData : leaveData.filter((l) => String(l.status || '').toLowerCase() === leaveStatusFilter);
    const totalPages = Math.max(1, Math.ceil(filtered.length / leavePageSize));
    const page = Math.min(leavePage, totalPages);
    const rows = filtered.slice((page - 1) * leavePageSize, page * leavePageSize);
    const balancePct = (leaveQuota.availableDays / Math.max(leaveQuota.totalAllowanceDays || 1, 1)) * 100;
    const LEAVE_SOLID = { approved: 'bg-[#16a34a] text-white', pending: 'bg-[#f59e0b] text-white', rejected: 'bg-[#ef4444] text-white' };
    const cards = [
      { label: 'Total Allowance', value: leaveQuota.totalAllowanceDays, hint: 'days this session', icon: CalendarCheck, bg: '#f2f7ff', border: '#dbe7fb', color: '#2563eb' },
      { label: 'Leave Taken', value: leaveQuota.approvedLeaveDays, hint: leaveQuota.pendingLeaveDays > 0 ? `${leaveQuota.pendingLeaveDays} more pending` : 'approved leave', icon: CalendarRange, bg: '#fffaf0', border: '#fbe9c8', color: '#f59e0b' },
      { label: 'Absent Days', value: leaveQuota.absentDays, hint: 'counted against leave', icon: XCircle, bg: '#fff5f5', border: '#fbdcdc', color: '#ef4444' },
    ];

    return (
      <MotionDiv {...tabContentProps} className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold leading-tight text-[#0f1b3d]">Leave Management</h2>
            <p className="text-[12px] text-[#64748b]">Request leave, follow approval progress, and monitor remaining leave quota.</p>
          </div>
          <button type="button" onClick={openLeaveForm} className="flex items-center gap-2 rounded-full bg-[#f59e0b] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(245,158,11,0.3)] transition hover:bg-[#d97706]">
            <Plus className="h-4 w-4" />Request Leave
          </button>
        </div>

        {leaveError && <div className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{leaveError}</div>}

        <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(({ label, value, hint, icon: Icon, bg, border, color }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ backgroundColor: bg, borderColor: border }}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm" style={{ backgroundColor: color }}><Icon className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-[20px] font-bold leading-tight text-[#0f1b3d]">{value}</p>
                <p className="truncate text-[12px] font-medium text-[#0f1b3d]">{label}</p>
                <p className="truncate text-[11px] text-[#64748b]">{hint}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 rounded-xl border border-[#d4f1de] bg-[#f2fbf5] px-3 py-2">
            <RingGauge percent={balancePct} color={leaveQuota.availableDays <= 0 ? '#ef4444' : '#16a34a'} track="#d8f3e2" text={`${Math.round(balancePct)}%`} size={54} />
            <div className="min-w-0">
              <p className="text-[20px] font-bold leading-tight text-[#0f1b3d]">{leaveQuota.availableDays}</p>
              <p className="truncate text-[12px] font-medium text-[#0f1b3d]">Leave Balance</p>
              <p className="truncate text-[11px] text-[#64748b]">
                {leaveQuota.pendingLeaveDays > 0 ? `${leaveQuota.usedDays} of ${leaveQuota.totalAllowanceDays} used · ${leaveQuota.pendingLeaveDays} pending` : `${leaveQuota.usedDays} of ${leaveQuota.totalAllowanceDays} used`}
              </p>
            </div>
          </div>
        </div>

        {/* <div className="flex shrink-0 items-center gap-3 rounded-xl border border-[#dbe9fb] bg-[#eef5ff] px-4 py-2 text-[13px] text-[#0f1b3d]">
          <FileText className="h-4 w-4 shrink-0 text-[#2563eb]" />
          <span>
            {leaveQuota.totalAllowanceDays} allowance – {leaveQuota.approvedLeaveDays} leave – {leaveQuota.absentDays} absent
            {' '}= <b className={leaveQuota.availableDays <= 0 ? 'text-[#dc2626]' : 'text-[#2563eb]'}>{leaveQuota.availableDays} left</b>{leaveQuota.pendingLeaveDays > 0 && <span className="text-[#64748b]"> · {leaveQuota.pendingLeaveDays} pending approval (not deducted yet)</span>}
          </span>
        </div> */}

        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e6ebf2] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#eef2f7] px-4 py-2.5">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-4 w-4 text-[#2563eb]" />
              <div>
                <p className="text-[14px] font-bold text-[#0f1b3d]">Leave Workflow</p>
                <p className="text-[11px] text-[#64748b]">Duration, status, remarks, and approval flow.</p>
              </div>
            </div>
            <div className="relative">
              <select value={leaveStatusFilter} onChange={(e) => setLeaveStatusFilter(e.target.value)} className="h-8 appearance-none rounded-lg border border-[#e2e8f0] bg-white pl-3 pr-8 text-[12px] font-medium text-[#0f1b3d] outline-none focus:border-[#93c5fd]">
                <option value="all">All Requests</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-[#64748b]" />
            </div>
          </div>

          <div ref={setLeaveTableEl} className="min-h-0 flex-1 overflow-hidden px-4">
            {leaveLoading ? (
              <p className="py-6 text-center text-[12px] text-[#64748b]">Loading leave requests...</p>
            ) : filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#f1f5f9]"><CalendarDays className="h-10 w-10 text-[#94a3b8]" /></div>
                <p className="mt-3 text-[15px] font-bold text-[#0f1b3d]">{leaveData.length ? 'No requests match this filter.' : 'No leave requests yet.'}</p>
                <p className="text-[12px] text-[#64748b]">Click “Request Leave” to apply for a new leave.</p>
              </div>
            ) : (
              <table className="w-full table-fixed text-left text-[12px]">
                <thead>
                  <tr className="h-9 text-[11px] font-semibold uppercase tracking-wide text-[#64748b] bg-gray-100">
                    <th className="w-[16%]">Type</th>
                    <th className="w-[22%]">Dates</th>
                    <th className="w-[8%]">Days</th>
                    <th className="w-[13%]">Submitted</th>
                    <th className="w-[11%]">Status</th>
                    <th>Remarks</th>
                    <th className="w-[80px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((leave) => {
                    const status = String(leave.status || '').toLowerCase();
                    return (
                      <tr key={leave.id} className="h-11 border-t border-[#eef2f7] text-[#334155]">
                        <td className="truncate pr-2 font-semibold text-[#0f1b3d]">{leave.type}</td>
                        <td className="truncate pr-2">{formatDate(leave.startDate)} <span className="text-[#94a3b8]">→</span> {formatDate(leave.endDate)}</td>
                        <td>{getLeaveDays(leave.startDate, leave.endDate)}</td>
                        <td className="truncate pr-2">{formatDate(leave.createdAt || leave.requestDate || leave.startDate)}</td>
                        <td><span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize', LEAVE_SOLID[status] || 'bg-slate-400 text-white')}>{leave.status}</span></td>
                        <td className="truncate pr-2 text-[#64748b]" title={leave.reason || ''}>{leave.adminNote || leave.adminRemarks || leave.reason || '—'}</td>
                        <td className="text-right">
                          {status === 'pending' ? (
                            <div className="inline-flex gap-1">
                              <button type="button" onClick={() => handleEditLeave(leave)} title="Edit" className="flex h-7 w-7 items-center justify-center rounded-md text-[#2563eb] hover:bg-[#eef5ff]"><Edit className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => setLeaveToDelete(leave)} title="Delete" className="flex h-7 w-7 items-center justify-center rounded-md text-[#ef4444] hover:bg-[#fff1f1]"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : <span className="text-[#94a3b8]">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="flex shrink-0 items-center justify-between border-t border-[#eef2f7] px-4 py-2 text-[12px] text-[#64748b]">
              <span>Showing {(page - 1) * leavePageSize + 1}–{Math.min(page * leavePageSize, filtered.length)} of {filtered.length}</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setLeavePage(page - 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e2e8f0] disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" onClick={() => setLeavePage(n)} className={cn('h-7 min-w-7 rounded-md px-2 font-semibold', n === page ? 'bg-[#2563eb] text-white' : 'border border-[#e2e8f0] text-[#334155] hover:bg-slate-50')}>{n}</button>
                ))}
                <button type="button" disabled={page >= totalPages} onClick={() => setLeavePage(page + 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e2e8f0] disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      </MotionDiv>
    );
  };


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
        {!notificationsLoading && notifications.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            <Bell className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            All caught up — no notifications.
          </div>
        )}
        {notifications.map((notification) => (
          <MotionButton key={notification.id} whileHover={{ x: 2 }} type="button" onClick={() => markNotificationRead(notification.id)} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm outline-none transition hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-slate-400">
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

  const [profileSection, setProfileSection] = useState('personal');
  const setProfileField = (key) => (e) => setProfileData((prev) => ({ ...prev, [key]: e.target.value }));

  const renderProfile = () => {
    const fieldBase = 'w-full border border-[#dbe3ee] bg-white text-[13px] text-[#0f1b3d] outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 disabled:cursor-not-allowed disabled:bg-[#f1f5f9] disabled:text-[#64748b]';
    const inputCls = cn(fieldBase, 'h-10 rounded-full px-4');
    const textareaCls = cn(fieldBase, 'h-16 resize-none rounded-2xl px-4 py-2');
    const text = (key, props = {}) => <input className={inputCls} value={profileData[key] || ''} onChange={setProfileField(key)} {...props} />;
    // 10-digit mobile number: digits only, capped at 10.
    const phone = (key, required = false) => {
      const value = profileData[key] || '';
      const invalid = value && value.length !== 10;
      return (
        <>
          <input
            className={cn(inputCls, invalid && 'border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/15')}
            type="tel" inputMode="numeric" maxLength={10} required={required} placeholder="10-digit number"
            value={value}
            onChange={(e) => setProfileData((prev) => ({ ...prev, [key]: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
          />
          {invalid && <span className="mt-0.5 block pl-3 text-[11px] text-[#ef4444]">Enter a valid 10-digit number</span>}
        </>
      );
    };
    const sections = [
      { id: 'personal', label: 'Personal Information', icon: User, hint: 'Basic details used for your official profile.' },
      { id: 'contact', label: 'Contact Information', icon: Phone, hint: 'How the school can reach you.' },
      { id: 'professional', label: 'Professional Details', icon: Briefcase, hint: 'Your role, qualifications and teaching assignment.' },
      { id: 'emergency', label: 'Emergency Contact', icon: Shield, hint: 'Person to be contacted in case of emergency.' },
    ];
    const current = sections.find((s) => s.id === profileSection) || sections[0];

    return (
      <MotionDiv {...tabContentProps} className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="shrink-0">
          <h2 className="text-[22px] font-bold leading-tight text-[#0f1b3d]">Profile &amp; Identity</h2>
          <p className="text-[12px] text-[#64748b]">Maintain professional identity, contact details, and secure emergency information.</p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
          {/* Profile card (left) */}
          <div className="flex flex-col items-center rounded-2xl border border-[#dbe9fb] bg-[#eef5ff] px-5 py-5 text-center">
            <Avatar className="h-24 w-24 border-4 border-white shadow-[0_6px_18px_rgba(30,64,175,0.15)]">
              <AvatarImage src={profileData.profilePic} alt={profileData.name || 'Teacher'} className="object-cover" />
              <AvatarFallback className="bg-[#1e3a8a] text-2xl font-semibold text-white">{profileData.name?.charAt(0) || 'T'}</AvatarFallback>
            </Avatar>
            <h3 className="mt-3 max-w-full truncate text-[18px] font-bold text-[#0f1b3d]">{profileData.name || 'Teacher'}</h3>
            {/* {profileData.subject && profileData.subject !== profileData.department && <p className="flex items-center gap-1.5 text-[12px] text-[#64748b]"><BookOpen className="h-3.5 w-3.5" />{profileData.subject}</p>} */}
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#2563eb]"><Briefcase className="h-4 w-4" />{profileData.department || 'Department not set'}</p>
            {profileData.employeeId && <span className="mt-2 rounded-full bg-[#2563eb] px-3 py-0.5 text-[11px] font-semibold text-white">{profileData.employeeId}</span>}
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#64748b]"><CalendarDays className="h-3.5 w-3.5" />Joined {profileData.joinDate ? new Date(`${profileData.joinDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>

            <div className="mt-4 flex w-full flex-col items-center gap-2 rounded-xl border border-[#d4f1de] bg-[#f2fbf5] px-3 py-4 text-center">
              <RingGauge percent={profileCompletion} color={profileCompletion >= 80 ? '#16a34a' : profileCompletion >= 50 ? '#f59e0b' : '#ef4444'} track="#d8f3e2" text={`${profileCompletion}%`} size={84} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#0f1b3d]">Profile completion</p>
                <p className="text-[11px] text-[#64748b]">{profileCompletion >= 100 ? 'All details filled in' : 'Fill in the remaining details'}</p>
              </div>
            </div>
          </div>

        {/* Fields (right) with tabs */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#e6ebf2] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <nav className="flex shrink-0 gap-1 overflow-x-auto overflow-y-hidden border-b border-[#eef2f7] px-3 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sections.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setProfileSection(id)} className={cn('-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-[13px] transition', profileSection === id ? 'border-[#2563eb] font-semibold text-[#2563eb]' : 'border-transparent text-[#475569] hover:text-[#0f1b3d]')}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </nav>

          <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); handleProfileEditSave(); }}>
            <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-5 py-3">
              <p className="text-[15px] font-bold text-[#0f1b3d]">{current.label}</p>
              <p className="mb-3 text-[11px] text-[#64748b]">{current.hint}</p>
              {profileError && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{profileError}</div>}
              {profileSuccess && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">{profileSuccess}</div>}

              {profileSection === 'personal' && (
                <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
                  <ProfileField label="Full Name">{text('name', { disabled: true })}</ProfileField>
                  <ProfileField label="Employee ID">{text('employeeId', { disabled: true })}</ProfileField>
                  <ProfileField label="Gender">{text('gender', { disabled: true, className: cn(inputCls, 'capitalize') })}</ProfileField>
                  <ProfileField label="Date of Birth">{text('dob', { type: 'date', disabled: true })}</ProfileField>
                  <ProfileField label="Blood Group">{text('bloodGroup', { disabled: true, placeholder: '—' })}</ProfileField>
                  <p className="self-end pb-2 text-[11px] text-[#94a3b8] sm:col-span-2">These details are maintained by the school office. Contact the admin to change them.</p>
                </div>
              )}
              {profileSection === 'contact' && (
                <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
                  <ProfileField label="Email" required>{text('email', { type: 'email', required: true })}</ProfileField>
                  <ProfileField label="Phone" required>{phone('phone', true)}</ProfileField>
                  <ProfileField label="Alternate Phone">{phone('alternatePhone')}</ProfileField>
                  <ProfileField label="PIN Code">{text('pinCode', { inputMode: 'numeric', maxLength: 6, onChange: (e) => setProfileData((prev) => ({ ...prev, pinCode: e.target.value.replace(/\D/g, '').slice(0, 6) })) })}</ProfileField>
                  <ProfileField label="Present Address" full>
                    <textarea className={textareaCls} value={profileData.address || ''} onChange={(e) => setProfileData((prev) => ({ ...prev, address: e.target.value, ...(prev.sameAsPresent ? { permanentAddress: e.target.value } : {}) }))} />
                  </ProfileField>
                  <div className="sm:col-span-2">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-[12px] font-medium text-[#0f1b3d]">Permanent Address</span>
                      <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-[#475569]">
                        <input type="checkbox" className="h-3.5 w-3.5 accent-[#2563eb]" checked={!!profileData.sameAsPresent} onChange={(e) => setProfileData((prev) => ({ ...prev, sameAsPresent: e.target.checked, ...(e.target.checked ? { permanentAddress: prev.address } : {}) }))} />
                        Same as present address
                      </label>
                    </div>
                    <textarea className={textareaCls} value={profileData.permanentAddress || ''} onChange={(e) => setProfileData((prev) => ({ ...prev, permanentAddress: e.target.value, sameAsPresent: false }))} />
                  </div>
                  <ProfileField label="City">{text('city')}</ProfileField>
                  <ProfileField label="District">{text('district')}</ProfileField>
                  <ProfileField label="State">{text('state')}</ProfileField>
                </div>
              )}
              {profileSection === 'professional' && (
                <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
                  <ProfileField label="Department">{text('department', { disabled: true, placeholder: '—' })}</ProfileField>
                  <ProfileField label="Specialization">{text('specialization', { placeholder: 'e.g. Organic Chemistry' })}</ProfileField>
                  <ProfileField label="Qualification">{text('qualification', { placeholder: 'e.g. M.Sc, B.Ed' })}</ProfileField>
                  <ProfileField label="Experience">{text('experience', { placeholder: 'e.g. 5 years' })}</ProfileField>
                </div>
              )}
              {profileSection === 'emergency' && (
                <div className="rounded-xl border border-[#fbd5d5] bg-[#fff5f5] p-4">
                  <p className="flex items-center gap-2 text-[13px] font-bold text-[#0f1b3d]"><Shield className="h-4 w-4 text-[#ef4444]" />Emergency Contact</p>
                  <p className="mb-3 pl-6 text-[11px] text-[#64748b]">Person to be contacted in case of emergency.</p>
                  <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
                    <ProfileField label="Contact Name" required>{text('emergencyContactName')}</ProfileField>
                    <ProfileField label="Contact Phone" required>{phone('emergencyContact', true)}</ProfileField>
                  </div>
                </div>
              )}
            </div>
            <div className="flex shrink-0 justify-end border-t border-[#eef2f7] px-5 py-2.5">
              <button type="submit" disabled={profileSaving || profileLoading} className="flex items-center gap-2 rounded-full bg-[#2563eb] px-5 py-2 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition hover:bg-[#1d4ed8] disabled:opacity-60">
                <Save className="h-4 w-4" />{profileSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
        </div>
      </MotionDiv>
    );
  };

  const renderInsights = () => (
    <MotionDiv {...tabContentProps} className="space-y-5">
      <SectionTitle icon={TrendingUp} title="Work Insights" description="Operational signals that summarize consistency, leave usage, reimbursements, and monthly readiness." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard icon={Gauge} label="Work Health Score" value={insightScore} tone="blue" progress={insightScore} /><MetricCard icon={Activity} label="Attendance Consistency" value={`${attendanceStats.attendanceRate || 0}%`} tone="emerald" progress={attendanceStats.attendanceRate || 0} /><MetricCard icon={CalendarRange} label="Approved Leave Days" value={`${leaveQuota.approvedLeaveDays} day${leaveQuota.approvedLeaveDays === 1 ? '' : 's'}`} tone="amber" /><MetricCard icon={Wallet} label="Claim Volume" value={`Rs ${(expenseStats.approved + expenseStats.pending).toLocaleString('en-IN')}`} tone="violet" /></div>
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

  const isOverview = activeTab === 'overview';
  const fitsScreen = isOverview || ['attendance', 'leave', 'profile'].includes(activeTab);
  const hasOwnHeader = ['attendance', 'leave', 'profile'].includes(activeTab);
  return (
    <div
      ref={overviewRef}
      className={cn('bg-[#f6f8fb] px-3 py-3 text-slate-900 sm:px-5 lg:px-6', fitsScreen ? 'flex flex-col overflow-hidden' : 'min-h-screen')}
      style={fitsScreen && overviewHeight ? { height: overviewHeight } : undefined}
    >
        <div className={cn('mx-auto w-full max-w-7xl', fitsScreen ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-5')}>
          <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
            <div>
              {!isOverview && (
                <button type="button" onClick={() => setActiveTab('overview')} className="mb-1 inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563eb] hover:underline">
                  <ArrowLeft className="h-3.5 w-3.5" />Back to My Work
                </button>
              )}
              {!hasOwnHeader && (
                <>
                  <h1 className="text-[22px] font-bold leading-tight tracking-tight text-[#0f1b3d]">My Profile</h1>
                  <p className="text-[12px] text-[#64748b]">Manage your daily teaching activities from here.</p>
                </>
              )}
            </div>
            {!isOverview && !hasOwnHeader && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {tabs.filter((tab) => tab.id !== 'overview').map((tab) => {
                  const active = activeTab === tab.id;
                  return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={cn('flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-slate-400', active ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950')}><tab.icon className="h-3.5 w-3.5" />{tab.label}</button>;
                })}
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
        </div>

        <AnimatePresence>
          {showLeaveForm && (
            <Modal
              open
              drawer
              title={leaveEditId ? 'Edit Leave Request' : 'Request Leave'}
              description="Submit a leave request with dates, type, and context for approval."
              onClose={() => { setShowLeaveForm(false); setLeaveEditId(null); }}
              footer={(
                <>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowLeaveForm(false); setLeaveEditId(null); }}>Cancel</Button>
                  <Button type="submit" form="leave-request-form" className="flex-1 bg-[#2563eb] text-white hover:bg-[#1d4ed8]" disabled={leaveSubmitting}><Check className="h-4 w-4" />{leaveSubmitting ? 'Submitting...' : leaveEditId ? 'Update Request' : 'Submit Request'}</Button>
                </>
              )}
            >
              <form id="leave-request-form" className="space-y-4" onSubmit={submitLeaveRequest}>
                {leaveError && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{leaveError}</div>}
                <Field label="Leave Type">
                  <MiniSelect value={leaveForm.type} onChange={(e) => setLeaveForm((prev) => ({ ...prev, type: e.target.value }))}>
                    {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
                    <option value="Others">Others</option>
                  </MiniSelect>
                </Field>
                {leaveForm.type === 'Others' && (
                  <Field label="Leave Type Name">
                    <Input autoFocus value={leaveForm.customType} onChange={(e) => setLeaveForm((prev) => ({ ...prev, customType: e.target.value }))} placeholder="e.g. Maternity Leave, Study Leave" maxLength={60} />
                  </Field>
                )}
                <Field label="Start Date"><Input type="date" min={todayISO()} value={leaveForm.startDate} onChange={(e) => setLeaveForm((prev) => ({ ...prev, startDate: e.target.value }))} /></Field>
                <Field label="End Date"><Input type="date" min={leaveForm.startDate && leaveForm.startDate > todayISO() ? leaveForm.startDate : todayISO()} value={leaveForm.endDate} onChange={(e) => setLeaveForm((prev) => ({ ...prev, endDate: e.target.value }))} /></Field>
                <Field label="Reason"><Textarea rows={5} value={leaveForm.reason} onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))} placeholder="Reason for leave" /></Field>
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
