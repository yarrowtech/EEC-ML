import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, XCircle, RefreshCw, Loader2, ChevronLeft, ChevronRight,
  Clock, CheckCircle2, AlertCircle, Ban, School, MessageSquare, Copy, ShieldCheck
} from 'lucide-react';

/* ─── helpers ─── */
const getInitials = (name = '') => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'NA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const STATUS_META = {
  pending:  { label: 'Pending',   cls: 'bg-amber-100 text-amber-700 border-amber-200',   icon: Clock },
  review:   { label: 'Need Info', cls: 'bg-blue-100 text-blue-700 border-blue-200',      icon: AlertCircle },
  rejected: { label: 'Rejected',  cls: 'bg-rose-100 text-rose-700 border-rose-200',      icon: Ban },
  approved: { label: 'Approved',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
};

const PAGE_SIZE = 8;

/* ─── Stat chip ─── */
const Stat = ({ icon, value, label, color }) => {
  const IconComponent = icon;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${color}`}><IconComponent className="w-5 h-5" /></div>
      <div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
};

/* ─── School avatar ─── */
const SchoolAvatar = ({ request }) => {
  const [err, setErr] = useState(false);
  const logo =
    typeof request.logo === 'string' ? request.logo
    : (request.logo?.secure_url || request.logo?.url || request.logo?.path || '');
  const letter = getInitials(request.schoolName || request.name);
  const colors = ['bg-violet-100 text-violet-700','bg-sky-100 text-sky-700','bg-emerald-100 text-emerald-700','bg-amber-100 text-amber-700','bg-rose-100 text-rose-700'];
  const cls = colors[(letter.charCodeAt(0) || 0) % colors.length];

  if (logo && !err) return (
    <img src={logo} alt={request.schoolName} onError={() => setErr(true)}
      className="w-9 h-9 rounded-xl object-cover shrink-0 border border-slate-200" />
  );
  return <div className={`w-9 h-9 rounded-xl ${cls} flex items-center justify-center font-bold text-sm shrink-0`}>{letter}</div>;
};

/* ─── Approve toggle ─── */
const ApproveToggle = ({ approved, loading, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    disabled={loading}
    title={approved ? 'Approved — click to revoke' : 'Not approved yet — click to approve'}
    className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all disabled:opacity-40 ${
      approved
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700'
        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700'
    }`}
  >
    {/* pill */}
    <span className={`relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0 ${approved ? 'bg-emerald-400' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${approved ? 'translate-x-4' : 'translate-x-0'}`} />
    </span>
    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : (approved ? 'Approved' : 'Not Approved Yet')}
  </button>
);

/* ─── Pagination ─── */
const Pagination = ({ page, totalPages, from, to, total, onPage }) => {
  const pages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1,2,3,4,5,'…',totalPages];
    if (page >= totalPages - 3) return [1,'…',totalPages-4,totalPages-3,totalPages-2,totalPages-1,totalPages];
    return [1,'…',page-1,page,page+1,'…',totalPages];
  }, [page, totalPages]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
      <span className="text-xs text-slate-500">{total === 0 ? 'No results' : `${from}–${to} of ${total}`}</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button onClick={() => onPage(page - 1)} disabled={page === 1}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {pages.map((p, i) =>
            p === '…'
              ? <span key={`e${i}`} className="px-1 text-slate-400 text-xs">…</span>
              : <button key={p} onClick={() => onPage(p)}
                  className={`min-w-[30px] h-[30px] rounded-lg text-xs font-semibold border transition-colors ${
                    p === page ? 'bg-violet-600 border-violet-600 text-white shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-white'
                  }`}>{p}</button>
          )}
          <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

/* ─── Issued credentials modal (shown once after approval) ─── */
const IssuedCredentialsModal = ({ issued, onClose }) => {
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    const text = issued.credentials
      .map((entry) => `${entry.campusName} (${entry.campusType})\nUsername: ${entry.username}\nPassword: ${entry.password}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Clipboard copy failed', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600"><ShieldCheck size={20} /></div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">School approved — credentials issued</h3>
            <p className="text-sm text-slate-500">{issued.schoolName}</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            These passwords are shown <strong>only once</strong> and are not stored anywhere in this portal.
            {issued.emailSent
              ? ` A copy has been emailed to ${issued.notifiedEmail || 'the school contact'}.`
              : ' The credential email could not be sent — copy and share them securely now.'}
          </div>

          {issued.credentials.map((entry, index) => (
            <div key={`${entry.username}-${index}`} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-700 mb-2">
                {entry.campusName} <span className="text-xs font-medium text-slate-400">({entry.campusType})</span>
              </p>
              <div className="grid sm:grid-cols-2 gap-2 text-sm font-mono">
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                  <span className="block text-[10px] font-sans font-semibold uppercase text-slate-400">Username</span>
                  {entry.username}
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                  <span className="block text-[10px] font-sans font-semibold uppercase text-slate-400">Password</span>
                  {entry.password}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={copyAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Copy size={15} />
            {copied ? 'Copied!' : 'Copy all'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold"
          >
            Done — I've saved these
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Main ─── */
const Requests = ({
  requests,
  onRequestAction,
  loading = false,
  bulkDeleteLoading = false,
  error = null,
  onRefresh,
  onDeleteAllPendingRequests
}) => {
  const [searchTerm, setSearchTerm]               = useState('');
  const [statusFilter, setStatusFilter]           = useState('all');
  const [activeAction, setActiveAction]           = useState(null);
  const [showBulkConfirm, setShowBulkConfirm]     = useState(false);
  const [bulkConfirmText, setBulkConfirmText]     = useState('');
  const [actionError, setActionError]             = useState(null);
  const [currentPage, setCurrentPage]             = useState(1);
  const [approveModalOpen, setApproveModalOpen]   = useState(false);
  const [approveTarget, setApproveTarget]         = useState(null);
  const [approveNote, setApproveNote]             = useState('');
  const [approveEmail, setApproveEmail]           = useState('');
  const [approveUsernames, setApproveUsernames]   = useState([]);
  const [issuedCredentials, setIssuedCredentials] = useState(null);

  const pendingCount = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests]);

  const filteredRequests = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return requests.filter((r) => {
      if (r.status === 'approved') return false;
      const matchesSearch =
        String(r.schoolName || '').toLowerCase().includes(q) ||
        String(r.contactPerson || '').toLowerCase().includes(q) ||
        String(r.contactEmail || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const from = filteredRequests.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to   = Math.min(currentPage * PAGE_SIZE, filteredRequests.length);

  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);

  const resolveCampuses = (r) => {
    if (!r) return [];
    if (Array.isArray(r.campusList) && r.campusList.length) return r.campusList;
    if (Array.isArray(r.campuses) && r.campuses.length) return r.campuses;
    if (r.campusName) return [{ name: r.campusName, campusType: 'Main' }];
    return [{ name: r.schoolName || r.name || 'Main Campus', campusType: 'Main' }];
  };

  const updateStatus = async (request, status) => {
    const requestId = typeof request === 'object' ? request?.id : request;
    if (!requestId) return;
    const currentRequest =
      typeof request === 'object'
        ? request
        : requests.find((item) => String(item.id) === String(requestId));
    if (!currentRequest) return;

    if (status === 'approved') {
      const campuses = resolveCampuses(currentRequest);
      setApproveTarget(currentRequest);
      setApproveNote('');
      setApproveEmail(currentRequest.contactEmail || currentRequest.officialEmail || '');
      setApproveUsernames(
        campuses.map((campus, index) => ({
          campusName: campus?.name || `Campus ${index + 1}`,
          campusType: campus?.campusType || 'Campus',
          campusId: campus?.id || campus?._id || campus?.campusId || null,
          username: ''
        }))
      );
      setApproveModalOpen(true);
      return;
    }

    const note = status === 'review' ? window.prompt('Add a note for the school (optional)') : undefined;
    try {
      setActionError(null);
      setActiveAction(`${requestId}:${status}`);
      await onRequestAction(requestId, status, note);
    } catch (e) {
      setActionError(e?.message || 'Unable to update this request');
    } finally {
      setActiveAction(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!onDeleteAllPendingRequests) return;
    try {
      setActionError(null);
      await onDeleteAllPendingRequests(bulkConfirmText);
      setBulkConfirmText('');
      setShowBulkConfirm(false);
    } catch (e) {
      setActionError(e?.message || 'Unable to delete pending requests');
    }
  };

  const closeApproveModal = () => {
    setApproveModalOpen(false);
    setApproveTarget(null);
    setApproveNote('');
    setApproveEmail('');
    setApproveUsernames([]);
  };

  const approveSchool = async () => {
    if (!approveTarget?.id) return;
    const requestId = approveTarget.id;
    const customUsernames = approveUsernames
      .map((entry) => ({ ...entry, username: String(entry.username || '').trim() }))
      .filter((entry) => entry.username);

    try {
      setActionError(null);
      setActiveAction(`${requestId}:approved`);
      const result = await onRequestAction(requestId, 'approved', approveNote, {
        contactEmail: approveEmail || undefined,
        credentials: customUsernames.length ? customUsernames : undefined
      });
      closeApproveModal();
      if (Array.isArray(result?.credentials) && result.credentials.length) {
        setIssuedCredentials({
          schoolName: approveTarget.schoolName || approveTarget.name,
          credentials: result.credentials,
          emailSent: result.emailSent !== false,
          notifiedEmail: result.notifiedEmail
        });
      }
    } catch (e) {
      setActionError(e?.message || 'Unable to approve this request');
    } finally {
      setActiveAction(null);
    }
  };

  const FILTERS = [
    { value: 'all',      label: 'All',       active: 'bg-slate-900 text-white border-slate-900' },
    { value: 'pending',  label: 'Pending',   active: 'bg-amber-500 text-white border-amber-500' },
    { value: 'review',   label: 'Need Info', active: 'bg-blue-500 text-white border-blue-500' },
    { value: 'rejected', label: 'Rejected',  active: 'bg-rose-500 text-white border-rose-500' },
  ];

  return (
    <div className="space-y-5">

      {/* ── Header card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-0.5">School Onboarding</p>
            <h2 className="text-2xl font-bold text-slate-800">Approval Workspace</h2>
          </div>
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={School}       value={requests.filter(r => r.status !== 'approved').length} label="Total Requests" color="bg-violet-100 text-violet-600" />
          <Stat icon={Clock}        value={pendingCount}                                          label="Pending"        color="bg-amber-100 text-amber-600" />
          <Stat icon={AlertCircle}  value={requests.filter(r => r.status === 'review').length}   label="Need Info"      color="bg-blue-100 text-blue-600" />
          <Stat icon={Ban}          value={requests.filter(r => r.status === 'rejected').length} label="Rejected"       color="bg-rose-100 text-rose-600" />
        </div>

        {/* Filter tabs + search + bulk delete */}
        <div className="mt-5 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                statusFilter === f.value ? f.active : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus-within:ring-2 focus-within:ring-violet-300 focus-within:border-violet-300 transition-all">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              type="text"
              className="bg-transparent flex-1 text-sm focus:outline-none placeholder:text-slate-400"
              placeholder="Search by school name, contact person or email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowBulkConfirm((p) => !p)}
            disabled={loading || bulkDeleteLoading || pendingCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {bulkDeleteLoading ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
            Delete pending ({pendingCount})
          </button>
        </div>

        {/* Bulk delete confirm */}
        {showBulkConfirm && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3">
            <p className="text-sm text-rose-800 font-semibold">Permanently delete all pending registration requests?</p>
            <p className="text-xs text-rose-700">Type <span className="font-bold">DELETE</span> to confirm.</p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={bulkConfirmText}
                onChange={(e) => setBulkConfirmText(e.target.value)}
                className="w-48 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                placeholder="Type DELETE"
              />
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteLoading || bulkConfirmText.trim().toUpperCase() !== 'DELETE'}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {bulkDeleteLoading ? 'Deleting…' : 'Confirm delete all'}
              </button>
              <button
                onClick={() => { setShowBulkConfirm(false); setBulkConfirmText(''); }}
                disabled={bulkDeleteLoading}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {(error || actionError) && (
        <div className="flex items-center justify-between bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-4">
          <span>{actionError || error}</span>
          {onRefresh && (
            <button onClick={onRefresh} className="ml-4 px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-medium">Retry</button>
          )}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 flex flex-col items-center gap-3 text-slate-500">
          <Loader2 size={24} className="animate-spin text-violet-500" />
          <p className="text-sm">Loading school registration requests…</p>
        </div>
      )}

      {/* ── Table ── */}
      {!loading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <School className="w-10 h-10 mx-auto mb-2 text-slate-200" />
              No requests match the current filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">School</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Submitted</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Approve</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedRequests.map((request) => {
                      const meta      = STATUS_META[request.status] || STATUS_META.pending;
                      const StatusIcon = meta.icon;
                      const isApproved = request.status === 'approved';
                      const isRejected = request.status === 'rejected';
                      const busy       = Boolean(activeAction);

                      return (
                        <tr key={request.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* School */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <SchoolAvatar request={request} />
                              <div>
                                <Link
                                  to={`/super-admin/requests/${request.id}`}
                                  className="font-semibold text-slate-800 hover:text-violet-600 transition-colors leading-tight block"
                                >
                                  {request.schoolName || request.name}
                                </Link>
                                <p className="text-xs text-slate-400 mt-0.5">{request.contactEmail || '—'}</p>
                              </div>
                            </div>
                          </td>

                          {/* Submitted */}
                          <td className="px-5 py-4 text-slate-500 text-xs whitespace-nowrap">
                            {request.submittedAt
                              ? new Date(request.submittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                              : '—'}
                          </td>

                          {/* Status badge */}
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold ${meta.cls}`}>
                              <StatusIcon className="w-3 h-3" />
                              {meta.label}
                            </span>
                          </td>

                          {/* Approve toggle */}
                          <td className="px-5 py-4">
                            <ApproveToggle
                              approved={isApproved}
                              loading={activeAction === `${request.id}:approved`}
                              onChange={() => updateStatus(request, isApproved ? 'pending' : 'approved')}
                            />
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Review */}
                              <button
                                onClick={() => updateStatus(request, 'review')}
                                disabled={busy || isRejected || isApproved}
                                title="Request more info"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                {activeAction === `${request.id}:review`
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <MessageSquare className="w-3 h-3" />}
                                Review
                              </button>

                              {/* Reject */}
                              <button
                                onClick={() => updateStatus(request, 'rejected')}
                                disabled={busy || isRejected || isApproved}
                                title="Reject request"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                {activeAction === `${request.id}:rejected`
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <Ban className="w-3 h-3" />}
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={currentPage}
                totalPages={totalPages}
                from={from}
                to={to}
                total={filteredRequests.length}
                onPage={(p) => setCurrentPage(Math.max(1, Math.min(p, totalPages)))}
              />
            </>
          )}
        </div>
      )}

      {/* ── Approve modal ── */}
      {approveModalOpen && approveTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Approve School</h3>
              <p className="text-sm text-slate-500 mt-1">{approveTarget.schoolName || approveTarget.name}</p>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                An admin account is created for each campus with a <strong>secure password generated on the server</strong>.
                Credentials are emailed to the school and shown to you once after approval.
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">School Email</label>
                <input
                  type="email"
                  value={approveEmail}
                  onChange={(e) => setApproveEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  placeholder="school@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Approval Note (Optional)</label>
                <textarea
                  rows={2}
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  placeholder="Any internal/admin note"
                />
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Campus Admin Usernames</p>
                {approveUsernames.map((entry, index) => (
                  <div key={`${entry.campusId || entry.campusName}-${index}`} className="rounded-xl border border-slate-200 p-3 space-y-2">
                    <p className="text-sm font-semibold text-slate-700">
                      {entry.campusName} <span className="text-xs font-medium text-slate-400">({entry.campusType})</span>
                    </p>
                    <input
                      type="text"
                      value={entry.username}
                      onChange={(e) => setApproveUsernames((prev) => prev.map((item, idx) => idx === index ? { ...item, username: e.target.value } : item))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                      placeholder="Leave blank to auto-generate (e.g. EEC-DPS-1234)"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={closeApproveModal}
                disabled={Boolean(activeAction)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={approveSchool}
                disabled={activeAction === `${approveTarget.id}:approved`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {activeAction === `${approveTarget.id}:approved` && <Loader2 className="w-4 h-4 animate-spin" />}
                Approve & Email Credentials
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Issued credentials (one-time display) ── */}
      {issuedCredentials && (
        <IssuedCredentialsModal issued={issuedCredentials} onClose={() => setIssuedCredentials(null)} />
      )}
    </div>
  );
};

export default Requests;
