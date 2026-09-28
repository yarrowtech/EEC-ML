import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
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
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const PASSWORD_RESET_ROLES = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
  { value: 'principal', label: 'Principal' },
];

const defaultFeedback = { subject: '', category: 'general', sentiment: 'positive', message: '' };
const defaultComplaint = { topic: 'system-issue', incidentDate: '', studentOrStaff: '', description: '', impactLevel: 'low' };
const SUPPORT_STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  investigating: 'In Progress',
  resolved: 'Resolved',
};

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
  const [showAllHistory, setShowAllHistory] = useState(false);
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

  const getStatusDot = (status) => ({
    resolved: 'bg-emerald-500',
    in_progress: 'bg-blue-500',
    investigating: 'bg-blue-500',
    open: 'bg-amber-500',
  }[status] || 'bg-gray-400');

  const getStatusColor = (status) => ({
    resolved: 'text-emerald-600',
    in_progress: 'text-blue-600',
    investigating: 'text-blue-600',
    open: 'text-amber-600',
  }[status] || 'text-gray-500');

  const getTypeBadge = (type) => ({
    'password-reset': 'bg-blue-100 text-blue-700',
    feedback: 'bg-purple-100 text-purple-700',
    complaint: 'bg-red-100 text-red-600',
  }[type] || 'bg-gray-100 text-gray-600');

  const getTypeLabel = (type) => ({
    'password-reset': 'Password Reset',
    feedback: 'Feedback',
    complaint: 'Complaint',
  }[type] || type);

  const getPriorityBadge = (priority) => ({
    high: 'bg-red-50 text-red-600 border-red-200',
    medium: 'bg-gray-50 text-gray-600 border-gray-200',
    low: 'bg-gray-50 text-gray-500 border-gray-200',
    critical: 'bg-red-100 text-red-700 border-red-300',
  }[priority] || 'bg-gray-50 text-gray-500 border-gray-200');

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

        {/* ── Complaint ─── */}
        <section className="rounded-2xl border border-red-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">File a Complaint</h2>
                <p className="text-xs text-gray-400">Escalate safeguarding, product incidents, or compliance concerns to our desk.</p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-red-600">Report an Issue</span>
          </div>

          <form className="px-6 pb-6 pt-2 space-y-4"
            onSubmit={(e) => { e.preventDefault(); handleSupportSubmit('complaint', complaintForm, () => setComplaintForm(defaultComplaint)); }}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className={fieldLabel}>Topic</label>
                <select name="topic" value={complaintForm.topic} onChange={handleInput(setComplaintForm)} className={fieldBase}>
                  <option value="system-issue">System Issue</option>
                  <option value="service-quality">Service Quality</option>
                  <option value="data-privacy">Data Privacy</option>
                  <option value="safety">Student Safety</option>
                </select>
              </div>
              <div>
                <label className={fieldLabel}>Impact Level</label>
                <select name="impactLevel" value={complaintForm.impactLevel} onChange={handleInput(setComplaintForm)} className={fieldBase}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className={fieldLabel}>Incident Date</label>
                <input type="date" name="incidentDate" value={complaintForm.incidentDate}
                  onChange={handleInput(setComplaintForm)} className={fieldBase} />
              </div>
              <div>
                <label className={fieldLabel}>Title</label>
                <input name="studentOrStaff" value={complaintForm.studentOrStaff}
                  onChange={handleInput(setComplaintForm)} className={fieldBase} placeholder="Enter title" />
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Describe the Issue</label>
              <textarea name="description" rows={3} value={complaintForm.description}
                onChange={handleInput(setComplaintForm)} required className={`${fieldBase} resize-none`}
                placeholder="Include evidence, attachments shared via email, and the expected resolution timeline." />
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={submitting === 'complaint'}
                className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-red-600 to-rose-600 text-white px-6 py-2.5 text-sm font-bold hover:from-red-700 hover:to-rose-700 transition shadow-sm disabled:opacity-50 disabled:cursor-wait">
                {submitting === 'complaint' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit Complaint
              </button>
            </div>
          </form>
        </section>

        {/* ── Recent Requests (table layout) ─── */}
        <section id="recent-requests" ref={recentRequestsRef} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                <Headphones className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Recent Requests</h2>
                <p className="text-xs text-gray-400">Track the status of your support requests.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fetchRecentRequests({ all: showAllHistory })} disabled={loadingRecent}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 shadow-sm disabled:opacity-60">
                {loadingRecent ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Refresh
              </button>
              <button type="button" onClick={() => setShowAllHistory((p) => !p)} disabled={loadingRecent}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 shadow-sm disabled:opacity-60">
                {showAllHistory ? 'View less' : 'View more'} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {recentError && (
            <div className="mx-6 mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-xs text-red-600 font-medium">
              {recentError}
            </div>
          )}

          {loadingRecent ? (
            <div className="flex items-center justify-center gap-3 py-14 text-sm text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> Loading tickets…
            </div>
          ) : recentRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <div className="p-4 rounded-2xl bg-gray-100">
                <Ticket className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-500">No support tickets yet</p>
              <p className="text-xs text-gray-400">Your submitted requests will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-gray-100 bg-gray-50/60 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <th className="px-6 py-3">#</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50/60 transition">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-300 shrink-0" />
                          <span className="font-mono text-xs text-gray-500">{req.ticketNumber || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-gray-800 truncate max-w-xs">{req.subject || req.supportType?.replace('-', ' ')}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getTypeBadge(req.supportType)}`}>
                          {getTypeLabel(req.supportType)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-gray-500">
                        {new Date(req.updatedAt || req.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${getStatusColor(req.status)}`}>
                          <span className={`h-2 w-2 rounded-full ${getStatusDot(req.status)}`} />
                          {SUPPORT_STATUS_LABELS[req.status] || req.status?.replace('_', ' ') || 'Open'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {req.priority && (
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${getPriorityBadge(req.priority)}`}>
                            {req.priority}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Urgent Help Footer ─── */}
        <section className="rounded-2xl bg-linear-to-r from-gray-900 via-slate-900 to-gray-900 text-white overflow-hidden shadow-sm">
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
