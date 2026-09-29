import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Headphones,
  KeyRound,
  LifeBuoy,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  RefreshCcw,
  Send,
  ShieldCheck,
  Ticket,
  WifiOff,
  Zap,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  BookOpen,
  ClipboardList,
  Eye,
  GraduationCap,
  Paperclip,
  Search,
  Settings,
  Upload,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';

// Support request categories (stored in the complaint's `topic`).
const SUPPORT_CATEGORIES = [
  { value: 'system-issue', label: 'System Issue', Icon: Settings, cls: 'bg-red-50 text-red-600' },
  { value: 'exam-management', label: 'Exam Management', Icon: BookOpen, cls: 'bg-violet-50 text-violet-600' },
  { value: 'student-management', label: 'Student Management', Icon: Users, cls: 'bg-blue-50 text-blue-600' },
  { value: 'examination', label: 'Examination', Icon: ClipboardList, cls: 'bg-purple-50 text-purple-600' },
  { value: 'fee-management', label: 'Fee Management', Icon: Wallet, cls: 'bg-emerald-50 text-emerald-600' },
  { value: 'user-management', label: 'User Management', Icon: UserCog, cls: 'bg-sky-50 text-sky-600' },
  { value: 'service-quality', label: 'Service Quality', Icon: Headphones, cls: 'bg-amber-50 text-amber-600' },
  { value: 'data-privacy', label: 'Data Privacy', Icon: ShieldCheck, cls: 'bg-slate-100 text-slate-600' },
  { value: 'safety', label: 'Student Safety', Icon: GraduationCap, cls: 'bg-rose-50 text-rose-600' },
];
const TYPE_CATEGORY = {
  'password-reset': { label: 'Password Reset', Icon: KeyRound, cls: 'bg-blue-50 text-blue-600' },
  feedback: { label: 'Feedback', Icon: MessageCircle, cls: 'bg-purple-50 text-purple-600' },
};
const PRIORITY_STYLES = {
  critical: { label: 'Critical', Icon: ArrowUp, cls: 'bg-red-100 text-red-700' },
  high: { label: 'High', Icon: ArrowUp, cls: 'bg-red-50 text-red-600' },
  medium: { label: 'Medium', Icon: ArrowUp, cls: 'bg-amber-50 text-amber-600' },
  low: { label: 'Low', Icon: BarChart3, cls: 'bg-gray-100 text-gray-600' },
};
const STATUS_STYLES = {
  open: { label: 'Open', dot: 'bg-amber-500', cls: 'bg-amber-50 text-amber-600' },
  in_progress: { label: 'In Progress', dot: 'bg-blue-600', cls: 'bg-blue-50 text-blue-600' },
  resolved: { label: 'Resolved', dot: 'bg-emerald-600', cls: 'bg-emerald-50 text-emerald-700' },
  closed: { label: 'Closed', dot: 'bg-gray-500', cls: 'bg-gray-100 text-gray-600' },
};
const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open', dot: 'bg-amber-500' },
  { key: 'in_progress', label: 'In Progress', dot: 'bg-blue-600' },
  { key: 'resolved', label: 'Resolved', dot: 'bg-emerald-600' },
  { key: 'closed', label: 'Closed', dot: 'bg-gray-500' },
];
const normalizeStatus = (s) => (s === 'investigating' ? 'in_progress' : (STATUS_STYLES[s] ? s : 'open'));
const categoryOf = (req) => {
  if (TYPE_CATEGORY[req?.supportType]) return TYPE_CATEGORY[req.supportType];
  const key = req?.requestDetails?.topic || req?.category;
  return SUPPORT_CATEGORIES.find((c) => c.value === key) || SUPPORT_CATEGORIES[0];
};
// Latest status change after creation = last reply from the support desk.
const lastReplyAt = (req) => {
  const trail = Array.isArray(req?.auditTrail) ? req.auditTrail : [];
  return trail.length > 1 ? trail[trail.length - 1].changedAt : null;
};
const formatDay = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const formatTime = (d) => (d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '');
const DESCRIPTION_MAX = 1000;
const MAX_ATTACHMENTS = 5;
const ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const PASSWORD_RESET_ROLES = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
  { value: 'principal', label: 'Principal' },
];

const defaultFeedback = { subject: '', category: 'general', sentiment: 'positive', message: '' };
const defaultComplaint = { topic: 'system-issue', incidentDate: '', studentOrStaff: '', description: '', impactLevel: 'low' };

const Support = ({ setShowAdminHeader }) => {
  const location = useLocation();
  const recentRequestsRef = useRef(null);

  useEffect(() => {
    if (location.hash === '#recent-requests' && recentRequestsRef.current) {
      setTimeout(() => {
        recentRequestsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [location.hash]);

  const [passwordResetRole, setPasswordResetRole] = useState('teacher');
  const [passwordResetSearch, setPasswordResetSearch] = useState('');
  const [passwordResetUsers, setPasswordResetUsers] = useState([]);
  const [passwordResetLoadingUsers, setPasswordResetLoadingUsers] = useState(false);
  const [passwordResetUserPickerOpen, setPasswordResetUserPickerOpen] = useState(false);
  const [selectedPasswordResetUser, setSelectedPasswordResetUser] = useState(null);
  const [passwordResetResult, setPasswordResetResult] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState(defaultFeedback);
  const [complaintForm, setComplaintForm] = useState(defaultComplaint);
  const [submitting, setSubmitting] = useState('');
  const [statusBanner, setStatusBanner] = useState(null);
  const [queuedRequests, setQueuedRequests] = useState([]);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentError, setRecentError] = useState(null);
  const showAllHistory = true; // the requests table lists everything and filters client-side
  const helpRef = useRef(null);
  const fileInputRef = useRef(null);
  const [complaintFiles, setComplaintFiles] = useState([]); // [{ name, url, type }]
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [requestSearch, setRequestSearch] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [viewRequest, setViewRequest] = useState(null);
  const [supportSettings, setSupportSettings] = useState({
    phoneNumber: '+91 90420 56789',
    email: 'support@eecschools.com',
    availableDays: 'Mon - Fri',
    availableTime: '8 AM - 6 PM IST',
    onCall24x7: true,
  });

  const supportPhoneHref = useMemo(() => {
    const digits = String(supportSettings.phoneNumber || '').replace(/[^\d+]/g, '');
    return digits ? `tel:${digits}` : 'tel:+919042056789';
  }, [supportSettings.phoneNumber]);

  const supportMailHref = useMemo(() => {
    const email = String(supportSettings.email || '').trim();
    return email ? `mailto:${email}` : 'mailto:support@eecschools.com';
  }, [supportSettings.email]);

  const supportEscalationEmail = useMemo(() => {
    const email = String(supportSettings.email || '').trim();
    return email || 'support@eecschools.com';
  }, [supportSettings.email]);

  useEffect(() => { setShowAdminHeader(true); }, [setShowAdminHeader]);

  const fetchRecentRequests = useCallback(async ({ all = showAllHistory } = {}) => {
    if (typeof window === 'undefined') return;
    const token = window.localStorage.getItem('token');
    if (!token) { setRecentRequests([]); return; }
    setLoadingRecent(true);
    setRecentError(null);
    try {
      const query = all ? '' : '?limit=5';
      const res = await fetch(`${API_BASE}/api/support/requests${query}`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Unable to load recent support requests');
      const data = await res.json();
      setRecentRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      setRecentError(error.message || 'Unable to load recent support requests');
    } finally { setLoadingRecent(false); }
  }, [showAllHistory]);

  useEffect(() => { fetchRecentRequests({ all: showAllHistory }); }, [fetchRecentRequests, showAllHistory]);

  useEffect(() => {
    const fetchSupportSettings = async () => {
      if (typeof window === 'undefined') return;
      const token = window.localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/api/support/settings`, { headers: { authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        setSupportSettings((prev) => ({ ...prev, ...(data || {}), onCall24x7: data?.onCall24x7 !== false }));
      } catch { /* Keep defaults */ }
    };
    fetchSupportSettings();
  }, []);

  const handleInput = (setter) => (e) => {
    const { name, value } = e.target;
    setter((prev) => ({ ...prev, [name]: value }));
  };

  const persistQueue = (queue) => { setQueuedRequests(queue); };

  const saveOfflineRequest = (payload) => {
    persistQueue([...queuedRequests, { ...payload, queuedAt: new Date().toISOString() }]);
  };

  const handleSupportSubmit = async (type, payload, resetForm) => {
    setSubmitting(type);
    setStatusBanner(null);
    const body = { ...payload, supportType: type, submittedAt: new Date().toISOString() };
    try {
      const res = await fetch(`${API_BASE}/api/support/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${(typeof window !== 'undefined' && window.localStorage.getItem('token')) || ''}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Support service unavailable');
      setStatusBanner({ type: 'success', title: 'Request sent to the EEC support desk.', description: 'You will receive a confirmation email shortly.' });
      resetForm();
      fetchRecentRequests({ all: showAllHistory });
    } catch {
      saveOfflineRequest(body);
      setStatusBanner({ type: 'warning', title: 'Support service unreachable.', description: 'Saved locally — will sync when you reconnect. Call the hotline for urgent help.' });
    } finally { setSubmitting(''); }
  };

  const retryQueuedRequests = async () => {
    if (!queuedRequests.length) return;
    setSyncingQueue(true);
    const remaining = [];
    for (const req of queuedRequests) {
      try {
        const res = await fetch(`${API_BASE}/api/support/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${(typeof window !== 'undefined' && window.localStorage.getItem('token')) || ''}` },
          body: JSON.stringify(req),
        });
        if (!res.ok) throw new Error();
      } catch { remaining.push(req); }
    }
    persistQueue(remaining);
    setSyncingQueue(false);
    setStatusBanner(remaining.length
      ? { type: 'warning', title: 'Some requests still queued.', description: 'Retry once you have a stable connection.' }
      : { type: 'success', title: 'All queued requests sent!', description: 'Our support desk has received your pending items.' }
    );
  };

  const fetchPasswordResetUsers = useCallback(async (role, search) => {
    if (typeof window === 'undefined') return;
    const token = window.localStorage.getItem('token');
    if (!token) { setPasswordResetUsers([]); return; }
    setPasswordResetLoadingUsers(true);
    try {
      const query = new URLSearchParams({ role });
      if (search?.trim()) query.set('q', search.trim());
      const res = await fetch(`${API_BASE}/api/admin/users/password-reset/users?${query}`, { headers: { authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to fetch users');
      setPasswordResetUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (error) {
      setPasswordResetUsers([]);
      setStatusBanner({ type: 'error', title: 'Unable to load users.', description: error.message || 'Please retry.' });
    } finally { setPasswordResetLoadingUsers(false); }
  }, []);

  useEffect(() => {
    setSelectedPasswordResetUser(null);
    setPasswordResetResult(null);
    const timer = window.setTimeout(() => fetchPasswordResetUsers(passwordResetRole, passwordResetSearch), 250);
    return () => window.clearTimeout(timer);
  }, [passwordResetRole, passwordResetSearch, fetchPasswordResetUsers]);

  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPasswordResetUser?.id) {
      setStatusBanner({ type: 'error', title: 'Please select a user.', description: 'Choose a role, search, then select one user.' });
      return;
    }
    setSubmitting('password-reset');
    setStatusBanner(null);
    setPasswordResetResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/password-reset/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${(typeof window !== 'undefined' && window.localStorage.getItem('token')) || ''}` },
        body: JSON.stringify({ role: passwordResetRole, userId: selectedPasswordResetUser.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to reset password');
      setPasswordResetResult({ name: data?.name || selectedPasswordResetUser.name, loginId: data?.loginId || selectedPasswordResetUser.userId, password: data?.password || '' });
      setStatusBanner({ type: 'success', title: 'Password reset completed.', description: 'A unique temporary password was generated. Share it securely and ask the user to change it after login.' });
    } catch (error) {
      setStatusBanner({ type: 'error', title: 'Reset failed.', description: error.message || 'Please retry.' });
    } finally { setSubmitting(''); }
  };

  const getTypeLabel = (type) => ({
    'password-reset': 'Password Reset',
    feedback: 'Feedback',
    complaint: 'Complaint',
  }[type] || type);

  const getTypeStyle = (type) => ({
    'password-reset': 'bg-blue-100 text-blue-600',
    feedback: 'bg-purple-100 text-purple-600',
    complaint: 'bg-red-100 text-red-500',
  }[type] || 'bg-gray-100 text-gray-500');

  const getTypeIcon = (type) => ({
    'password-reset': <KeyRound className="h-3.5 w-3.5" />,
    feedback: <MessageCircle className="h-3.5 w-3.5" />,
    complaint: <AlertTriangle className="h-3.5 w-3.5" />,
  }[type] || <Ticket className="h-3.5 w-3.5" />);

  const statusCounts = useMemo(() => {
    const counts = { all: recentRequests.length };
    recentRequests.forEach((r) => { const k = normalizeStatus(r.status); counts[k] = (counts[k] || 0) + 1; });
    return counts;
  }, [recentRequests]);

  const visibleRequests = useMemo(() => {
    const q = requestSearch.trim().toLowerCase();
    return recentRequests
      .filter((r) => statusTab === 'all' || normalizeStatus(r.status) === statusTab)
      .filter((r) => !q || [r.ticketNumber, r.subject, r.message, categoryOf(r).label].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => {
        const diff = new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        return sortOrder === 'oldest' ? -diff : diff;
      });
  }, [recentRequests, requestSearch, statusTab, sortOrder]);

  // Upload chosen files to Cloudinary; their URLs go in the request payload.
  const handleAttachFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const room = MAX_ATTACHMENTS - complaintFiles.length;
    const accepted = files.filter((f) => ATTACHMENT_TYPES.includes(f.type) && f.size <= 5 * 1024 * 1024).slice(0, room);
    if (accepted.length < files.length) {
      setStatusBanner({ type: 'warning', title: 'Some files were skipped.', description: `Only PDF, JPG or PNG up to 5MB each, max ${MAX_ATTACHMENTS} files.` });
    }
    if (!accepted.length) return;
    const token = window.localStorage.getItem('token') || '';
    setUploadingFiles(true);
    try {
      const uploaded = [];
      for (const file of accepted) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'support-attachments');
        const res = await fetch(`${API_BASE}/api/uploads/cloudinary/single`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || data?.message || 'Upload failed');
        const url = data?.files?.[0]?.secure_url || data?.files?.[0]?.url || data?.secure_url || data?.url;
        if (url) uploaded.push({ name: file.name, url, type: file.type });
      }
      setComplaintFiles((prev) => [...prev, ...uploaded].slice(0, MAX_ATTACHMENTS));
    } catch (error) {
      setStatusBanner({ type: 'error', title: 'File upload failed.', description: error.message || 'Please try again.' });
    } finally {
      setUploadingFiles(false);
    }
  };

  const CategoryIcon = (SUPPORT_CATEGORIES.find((c) => c.value === complaintForm.topic) || SUPPORT_CATEGORIES[0]).Icon;
  const reqLabel = 'mb-1.5 block text-sm font-semibold text-gray-800';
  const reqField = 'w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';

  const fieldBase = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition bg-white';
  const fieldLabel = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0';

  return (
    <div className="bg-gray-50/50">
      <div className="max-w-6xl mx-auto px-6 pt-6 pb-8 space-y-6">

        {/* ── Header ─── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <LifeBuoy className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Support Center</p>
              <h1 className="text-2xl font-bold text-gray-900 mt-0.5">How can we help you?</h1>
              <p className="text-sm text-gray-500 mt-0.5">Reset credentials, share feedback, or report an issue to the EEC support team.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a href={supportPhoneHref} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm">
              <Phone className="h-4 w-4 text-gray-500" /> {supportSettings.phoneNumber}
            </a>
            <a href={supportMailHref} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm">
              <Mail className="h-4 w-4 text-gray-500" /> Email support
            </a>
            <div className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              {supportSettings.onCall24x7 ? '24 / 7 On-call' : `${supportSettings.availableDays} · ${supportSettings.availableTime}`}
            </div>
          </div>
        </div>

        {/* ── Status Banner ─── */}
        {statusBanner && (() => {
          const cfgMap = {
            success: { wrap: 'bg-emerald-50 border-emerald-200 border-l-emerald-500', text: 'text-emerald-800', icon: <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" /> },
            warning: { wrap: 'bg-amber-50 border-amber-200 border-l-amber-500', text: 'text-amber-800', icon: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" /> },
            error: { wrap: 'bg-red-50 border-red-200 border-l-red-500', text: 'text-red-800', icon: <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" /> },
          };
          const cfg = cfgMap[statusBanner.type] || cfgMap.error;
          return (
            <div className={`rounded-xl border border-l-4 px-4 py-3.5 flex items-start gap-3 ${cfg.wrap}`}>
              {cfg.icon}
              <div className={cfg.text}>
                <p className="text-sm font-bold">{statusBanner.title}</p>
                <p className="text-xs mt-0.5 opacity-80">{statusBanner.description}</p>
              </div>
            </div>
          );
        })()}

        {/* ── Offline Queue ─── */}
        {queuedRequests.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-linear-to-r from-amber-50 to-orange-50 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-100">
                  <WifiOff className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Offline Queue</p>
                  <p className="text-sm font-semibold text-gray-900">{queuedRequests.length} pending request{queuedRequests.length > 1 ? 's' : ''}</p>
                </div>
              </div>
              <button type="button" onClick={retryQueuedRequests} disabled={syncingQueue}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 text-white px-4 py-2 text-sm font-semibold hover:bg-amber-600 transition disabled:opacity-60 shadow-sm">
                {syncingQueue ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Retry sending
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {queuedRequests.slice(0, 4).map((req, i) => (
                <div key={req.submittedAt + i} className="bg-white rounded-xl p-3 border border-amber-100 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg ${getTypeStyle(req.supportType)}`}>{getTypeIcon(req.supportType)}</span>
                    <p className="text-sm font-semibold text-gray-800 capitalize">{req.supportType?.replace('-', ' ')}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Saved {new Date(req.queuedAt || req.submittedAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Password Reset + Feedback ─── */}
        <div className="grid gap-5 lg:grid-cols-2">

          {/* Password Reset */}
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                  <KeyRound className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Password Reset</h2>
                  <p className="text-xs text-gray-400">Reset to default for teachers, students, or parents.</p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-600">Quick Action</span>
            </div>

            <form className="px-6 pb-6 pt-2 space-y-4" onSubmit={handlePasswordResetSubmit}>
              <div>
                <label className={fieldLabel}>Role <span className="text-red-400 normal-case text-xs">*</span></label>
                <select value={passwordResetRole}
                  onChange={(e) => { setPasswordResetRole(e.target.value); setPasswordResetUserPickerOpen(false); }}
                  className={fieldBase} required>
                  {PASSWORD_RESET_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div className="relative">
                <label className={fieldLabel}>User ID / Name <span className="text-red-400 normal-case text-xs">*</span></label>
                <button type="button"
                  className={`${fieldBase} text-left flex items-center justify-between`}
                  onClick={() => setPasswordResetUserPickerOpen((p) => !p)}
                >
                  <span className={`truncate ${selectedPasswordResetUser ? 'text-gray-900' : 'text-gray-400'}`}>
                    {selectedPasswordResetUser
                      ? `${selectedPasswordResetUser.userId} · ${selectedPasswordResetUser.name}`
                      : 'Search and select a user…'}
                  </span>
                  {passwordResetUserPickerOpen
                    ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                </button>

                {passwordResetUserPickerOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded-2xl border border-gray-200 bg-white shadow-2xl p-3">
                    <input type="text" value={passwordResetSearch}
                      onChange={(e) => setPasswordResetSearch(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                      placeholder="Search by ID or name…"
                      autoFocus
                    />
                    <div className="mt-2 max-h-44 overflow-y-auto">
                      {passwordResetLoadingUsers ? (
                        <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                        </div>
                      ) : passwordResetUsers.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-gray-400">No users found</p>
                      ) : (
                        passwordResetUsers.map((user) => (
                          <button key={user.id} type="button"
                            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-blue-50 transition"
                            onClick={() => { setSelectedPasswordResetUser(user); setPasswordResetUserPickerOpen(false); }}
                          >
                            <p className="text-sm font-semibold text-gray-900">{user.userId}</p>
                            <p className="text-xs text-gray-400">{user.name}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {passwordResetResult && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Reset Complete</p>
                  </div>
                  <div className="space-y-2">
                    {[['Name', passwordResetResult.name], ['Login ID', passwordResetResult.loginId], ['Password', passwordResetResult.password]].map(([k, v]) => (
                      <div key={k} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-emerald-600 w-16">{k}</span>
                        <span className="font-mono text-sm text-gray-800 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-100">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button type="submit" disabled={submitting === 'password-reset'}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white py-2.5 text-sm font-bold hover:from-blue-700 hover:to-indigo-700 transition shadow-sm disabled:opacity-50 disabled:cursor-wait">
                {submitting === 'password-reset' ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Generate Temporary Password
              </button>
            </form>
          </section>

          {/* Feedback */}
          <section className="rounded-2xl border border-purple-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50">
                  <MessageCircle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Product Feedback</h2>
                  <p className="text-xs text-gray-400">Share ideas, improvements, or appreciation with our team.</p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-purple-600">We Value Your Input</span>
            </div>

            <form className="px-6 pb-6 pt-2 space-y-4"
              onSubmit={(e) => { e.preventDefault(); handleSupportSubmit('feedback', feedbackForm, () => setFeedbackForm(defaultFeedback)); }}>
              <div>
                <label className={fieldLabel}>Subject</label>
                <input name="subject" value={feedbackForm.subject} onChange={handleInput(setFeedbackForm)}
                  required className={fieldBase} placeholder="e.g. Attendance dashboard idea" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={fieldLabel}>Category</label>
                  <select name="category" value={feedbackForm.category} onChange={handleInput(setFeedbackForm)} className={fieldBase}>
                    <option value="general">General</option>
                    <option value="feature-request">Feature Request</option>
                    <option value="issue">Issue</option>
                    <option value="praise">Appreciation</option>
                  </select>
                </div>
                <div>
                  <label className={fieldLabel}>Sentiment</label>
                  <select name="sentiment" value={feedbackForm.sentiment} onChange={handleInput(setFeedbackForm)} className={fieldBase}>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Needs attention</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={fieldLabel}>Message</label>
                <textarea name="message" value={feedbackForm.message} onChange={handleInput(setFeedbackForm)}
                  rows={3} className={`${fieldBase} resize-none`}
                  placeholder="Be as descriptive as possible — it helps our team prioritise." />
              </div>
              <button type="submit" disabled={submitting === 'feedback'}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-purple-600 to-pink-600 text-white py-2.5 text-sm font-bold hover:from-purple-700 hover:to-pink-700 transition shadow-sm disabled:opacity-50 disabled:cursor-wait">
                {submitting === 'feedback' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Feedback
              </button>
            </form>
          </section>
        </div>

        {/* ── Create a Support Request ─── */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50">
                <Headphones className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Create a Support Request</h2>
                <p className="text-sm text-gray-500">Facing an issue or have a suggestion? Submit a request and our team will get back to you.</p>
              </div>
            </div>
            <button type="button" onClick={() => helpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50">
              <BookOpen className="h-4 w-4" /> View Help &amp; Guides
            </button>
          </div>

          <form className="space-y-4 px-5 pb-5 pt-5 sm:px-6"
            onSubmit={(e) => {
              e.preventDefault();
              handleSupportSubmit(
                'complaint',
                { ...complaintForm, subject: complaintForm.studentOrStaff, attachments: complaintFiles },
                () => { setComplaintForm(defaultComplaint); setComplaintFiles([]); },
              );
            }}>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={reqLabel}>Category <span className="text-red-500">*</span></label>
                <div className="relative">
                  <CategoryIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-700" />
                  <select name="topic" value={complaintForm.topic} onChange={handleInput(setComplaintForm)} required className={`${reqField} appearance-none pl-11 pr-10`}>
                    {SUPPORT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                </div>
              </div>
              <div>
                <label className={reqLabel}>Priority <span className="text-red-500">*</span></label>
                <div className="relative">
                  <BarChart3 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-700" />
                  <select name="impactLevel" value={complaintForm.impactLevel} onChange={handleInput(setComplaintForm)} required className={`${reqField} appearance-none pl-11 pr-10`}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                </div>
              </div>
              <div>
                <label className={reqLabel}>Subject <span className="text-red-500">*</span></label>
                <input name="studentOrStaff" value={complaintForm.studentOrStaff} onChange={handleInput(setComplaintForm)}
                  required maxLength={120} className={reqField} placeholder="Enter a short title" />
              </div>
            </div>

            <div>
              <label className={reqLabel}>Description <span className="text-red-500">*</span></label>
              <div className="relative">
                <textarea name="description" rows={4} maxLength={DESCRIPTION_MAX} value={complaintForm.description}
                  onChange={handleInput(setComplaintForm)} required className={`${reqField} resize-none pb-7`}
                  placeholder="Describe the issue in detail. Include steps, expected behaviour, and any error messages." />
                <span className="pointer-events-none absolute bottom-2.5 right-4 text-xs text-gray-500">
                  {complaintForm.description.length}/{DESCRIPTION_MAX}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-xl bg-blue-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-start gap-4">
                <Paperclip className="mt-1 h-5 w-5 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-blue-600">Attach Files (Optional)</p>
                  <p className="text-sm text-gray-600">You can upload screenshots, documents (PDF, JPG, PNG). Max {MAX_ATTACHMENTS} files, 5MB each.</p>
                  {complaintFiles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {complaintFiles.map((f, i) => (
                        <span key={f.url} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-2.5 py-1 text-xs text-gray-700">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                          <span className="truncate max-w-45">{f.name}</span>
                          <button type="button" onClick={() => setComplaintFiles((p) => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500" aria-label={`Remove ${f.name}`}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden"
                onChange={(e) => { handleAttachFiles(e.target.files); e.target.value = ''; }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFiles || complaintFiles.length >= MAX_ATTACHMENTS}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-60">
                {uploadingFiles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploadingFiles ? 'Uploading…' : 'Choose Files'}
              </button>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setComplaintForm(defaultComplaint); setComplaintFiles([]); }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50">
                <RefreshCcw className="h-4 w-4" /> Clear
              </button>
              <button type="submit" disabled={submitting === 'complaint' || uploadingFiles}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 sm:min-w-44">
                {submitting === 'complaint' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit Request
              </button>
            </div>
          </form>
        </section>

        {/* ── Your Support Requests ─── */}
        <section id="recent-requests" ref={recentRequestsRef} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Your Support Requests</h2>
                <p className="text-sm text-gray-500">Track the status of your requests and view responses from our support team.</p>
              </div>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input value={requestSearch} onChange={(e) => setRequestSearch(e.target.value)} placeholder="Search requests..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-11 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          <div className="flex flex-col gap-3 px-5 pb-3 pt-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {STATUS_TABS.map((t) => {
                const active = statusTab === t.key;
                return (
                  <button key={t.key} type="button" onClick={() => setStatusTab(t.key)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold transition ${
                      active ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                    }`}>
                    {t.key === 'all'
                      ? <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full ${active ? 'bg-white/90' : 'bg-blue-600'}`}><span className={`h-1.5 w-1.5 rounded-sm ${active ? 'bg-blue-600' : 'bg-white'}`} /></span>
                      : <span className={`h-3 w-3 rounded-full ${t.dot}`} />}
                    {t.label} ({statusCounts[t.key] || 0})
                  </button>
                );
              })}
            </div>
            <div className="relative shrink-0 self-start lg:self-auto">
              <ArrowUpDown className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-700" />
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
                className="appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-11 pr-10 text-sm font-semibold text-gray-800 outline-none focus:border-blue-400">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
            </div>
          </div>

          {recentError && (
            <div className="mx-6 mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-xs text-red-600 font-medium">
              {recentError}
            </div>
          )}

          {loadingRecent && recentRequests.length === 0 ? (
            <div className="flex items-center justify-center gap-3 py-14 text-sm text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> Loading requests…
            </div>
          ) : visibleRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <div className="p-4 rounded-2xl bg-gray-100">
                <Ticket className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-500">{recentRequests.length ? 'No requests match your filters' : 'No support requests yet'}</p>
              <p className="text-xs text-gray-400">Your submitted requests will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto px-2 pb-3 sm:px-3">
              <table className="w-full min-w-225 text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    <th className="rounded-l-lg px-4 py-3">#</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Reply</th>
                    <th className="rounded-r-lg px-4 py-3" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleRequests.map((req) => {
                    const cat = categoryOf(req);
                    const pri = PRIORITY_STYLES[req.priority] || PRIORITY_STYLES.low;
                    const st = STATUS_STYLES[normalizeStatus(req.status)] || STATUS_STYLES.open;
                    const lastReply = lastReplyAt(req);
                    return (
                      <tr key={req.id} className="transition hover:bg-gray-50/60">
                        <td className="whitespace-nowrap px-4 py-3.5 text-gray-600">{req.ticketNumber || '—'}</td>
                        <td className="px-4 py-3.5">
                          <p className="max-w-xs truncate font-semibold text-gray-900">{req.subject || getTypeLabel(req.supportType)}</p>
                          {req.message ? <p className="max-w-xs truncate text-xs text-gray-500">{req.message}</p> : null}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${cat.cls}`}>
                            <cat.Icon className="h-3.5 w-3.5" /> {cat.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${pri.cls}`}>
                            <pri.Icon className="h-3.5 w-3.5" /> {pri.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-gray-600">
                          <p>{formatDay(req.createdAt)}</p>
                          <p>{formatTime(req.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${st.cls}`}>
                            <span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} /> {st.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-gray-600">
                          {lastReply ? (<><p>{formatDay(lastReply)}</p><p>{formatTime(lastReply)}</p></>) : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button type="button" onClick={() => setViewRequest(req)}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50">
                            <Eye className="h-4 w-4" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Request detail modal ─── */}
        {viewRequest && (() => {
          const cat = categoryOf(viewRequest);
          const pri = PRIORITY_STYLES[viewRequest.priority] || PRIORITY_STYLES.low;
          const st = STATUS_STYLES[normalizeStatus(viewRequest.status)] || STATUS_STYLES.open;
          const files = Array.isArray(viewRequest.requestDetails?.attachments) ? viewRequest.requestDetails.attachments : [];
          const replies = (viewRequest.auditTrail || []).slice(1);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setViewRequest(null); }}>
              <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500">{viewRequest.ticketNumber}</p>
                    <h3 className="text-lg font-bold text-gray-900 wrap-break-word">{viewRequest.subject || getTypeLabel(viewRequest.supportType)}</h3>
                  </div>
                  <button type="button" onClick={() => setViewRequest(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-5 px-6 py-5">
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cat.cls}`}><cat.Icon className="h-3.5 w-3.5" /> {cat.label}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${pri.cls}`}><pri.Icon className="h-3.5 w-3.5" /> {pri.label}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${st.cls}`}><span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} /> {st.label}</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">{formatDay(viewRequest.createdAt)} · {formatTime(viewRequest.createdAt)}</span>
                  </div>
                  {viewRequest.message ? (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Description</p>
                      <p className="whitespace-pre-wrap text-sm text-gray-800">{viewRequest.message}</p>
                    </div>
                  ) : null}
                  {files.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Attachments</p>
                      <div className="flex flex-wrap gap-2">
                        {files.map((f) => (
                          <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">
                            <Paperclip className="h-3.5 w-3.5" /> {f.name || 'Attachment'}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {viewRequest.resolutionNotes ? (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">Response from support</p>
                      <p className="whitespace-pre-wrap text-sm text-emerald-900">{viewRequest.resolutionNotes}</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Activity</p>
                    {replies.length === 0 ? (
                      <p className="text-sm text-gray-500">No reply from the support team yet.</p>
                    ) : (
                      <ol className="space-y-3 border-l-2 border-gray-100 pl-4">
                        {replies.slice().reverse().map((a, i) => (
                          <li key={`${a.changedAt}-${i}`}>
                            <p className="text-sm font-semibold text-gray-800">{STATUS_STYLES[normalizeStatus(a.status)]?.label || a.status}{a.changedByName ? ` · ${a.changedByName}` : ''}</p>
                            {a.note ? <p className="text-sm text-gray-600">{a.note}</p> : null}
                            <p className="text-xs text-gray-400">{formatDay(a.changedAt)} · {formatTime(a.changedAt)}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Urgent Help Footer ─── */}
        <section ref={helpRef} className="rounded-2xl bg-linear-to-r from-gray-900 via-slate-900 to-gray-900 text-white overflow-hidden shadow-sm">
          <div className="px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
                <Zap className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Urgent Help</p>
                <h2 className="text-lg font-extrabold">
                  {supportSettings.onCall24x7 ? 'On-call team, 24 / 7' : 'Support team'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5 max-w-sm">
                  Security and compliance incidents are escalated immediately. Our engineers track the same case ID as your portal ticket.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Service status</p>
                  <p className="text-xs font-semibold text-white">All systems normal</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
                  <Clock className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Available window</p>
                  <p className="text-xs font-semibold text-white">{supportSettings.availableDays} · {supportSettings.availableTime}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/15">
                  <Mail className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Escalation email</p>
                  <p className="text-xs font-semibold text-white">{supportEscalationEmail}</p>
                </div>
              </div>
              <a href={supportPhoneHref}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 transition text-white font-bold text-sm px-5 py-2.5 shadow-lg shadow-amber-500/30 shrink-0">
                <Phone className="h-4 w-4" /> Call Now <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Support;
