import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, AlertCircle, Clock, Mail, Phone, RefreshCw, Trash2, Users, GraduationCap, School as SchoolIcon, UserCheck } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

const MetricCard = ({ icon, label, value, sub, color, loading }) => {
  const Icon = icon;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
      <div className="min-w-0">
        {loading ? (
          <div className="h-6 w-14 rounded bg-slate-100 animate-pulse" />
        ) : (
          <div className="text-xl font-bold text-slate-800">{value}</div>
        )}
        <div className="text-xs text-slate-500 truncate">{label}{sub ? <span className="text-slate-400"> • {sub}</span> : null}</div>
      </div>
    </div>
  );
};

const formatDate = (value) =>
  new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  review: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700'
};

const Overview = ({
  requests,
  feedbackItems,
  issues,
  requestLoading = false,
  bulkDeleteLoading = false,
  requestError = null,
  onRefreshRequests,
  onDeleteAllPendingRequests,
  onRequestAction,
  onIssueUpdate,
  onFeedbackUpdate
}) => {
  const [activeRequestAction, setActiveRequestAction] = useState(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [actionError, setActionError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !API_BASE) {
      setMetricsLoading(false);
      return;
    }
    setMetricsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Unable to load platform metrics');
      setMetrics(await response.json());
    } catch (error) {
      console.error('Failed to load platform metrics', error);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const pendingRequests = requests.filter((request) => request.status === 'pending');
  const urgentIssues = issues.filter((issue) => issue.status !== 'resolved');
  const feedbackQueue = feedbackItems.filter((item) => item.status !== 'resolved');

  const recentRequests = [...requests]
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .slice(0, 3);

  const handleRequestAction = async (requestId, status) => {
    try {
      setActionError(null);
      setActiveRequestAction(`${requestId}:${status}`);
      await onRequestAction(requestId, status);
    } catch (error) {
      setActionError(error?.message || 'Unable to update request');
    } finally {
      setActiveRequestAction(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!onDeleteAllPendingRequests) return;
    try {
      setActionError(null);
      await onDeleteAllPendingRequests(bulkDeleteConfirmText);
      setBulkDeleteConfirmText('');
      setShowBulkDeleteConfirm(false);
    } catch (error) {
      setActionError(error?.message || 'Unable to delete pending requests');
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform metrics (from /api/super-admin/overview) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          icon={SchoolIcon}
          label="Schools"
          sub={metrics ? `${metrics.schools?.active ?? 0} active` : null}
          value={metrics?.schools?.total ?? '—'}
          color="bg-violet-100 text-violet-600"
          loading={metricsLoading}
        />
        <MetricCard
          icon={GraduationCap}
          label="Students"
          value={metrics?.users?.students ?? '—'}
          color="bg-sky-100 text-sky-600"
          loading={metricsLoading}
        />
        <MetricCard
          icon={Users}
          label="Teachers"
          sub={metrics ? `${metrics.users?.parents ?? 0} parents` : null}
          value={metrics?.users?.teachers ?? '—'}
          color="bg-emerald-100 text-emerald-600"
          loading={metricsLoading}
        />
        <MetricCard
          icon={UserCheck}
          label="School admins"
          sub={metrics ? `${metrics.schools?.registrations?.pending ?? 0} pending reg.` : null}
          value={metrics?.admins?.schoolAdmins ?? '—'}
          color="bg-amber-100 text-amber-600"
          loading={metricsLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase text-slate-400 tracking-wide">Approval Centre</p>
              <h2 className="text-xl font-semibold text-slate-800">Schools waiting for action</h2>
            </div>
            <span className="text-sm text-slate-500">{pendingRequests.length} pending</span>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={onRefreshRequests}
              disabled={requestLoading || bulkDeleteLoading}
            >
              <RefreshCw size={14} className={requestLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <Link
              to="/super-admin/requests"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
            >
              Open Requests Page
            </Link>
            <button
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 text-sm text-rose-700 hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => setShowBulkDeleteConfirm((prev) => !prev)}
              disabled={pendingRequests.length === 0 || requestLoading || bulkDeleteLoading}
            >
              <Trash2 size={14} />
              Delete All Pending
            </button>
          </div>

          {(requestError || actionError) && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {actionError || requestError}
            </div>
          )}

          {showBulkDeleteConfirm && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3">
              <p className="text-sm text-rose-800 font-medium">
                This will permanently delete all pending school registrations.
              </p>
              <p className="text-xs text-rose-700">
                Type <span className="font-semibold">DELETE</span> to confirm.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={bulkDeleteConfirmText}
                  onChange={(event) => setBulkDeleteConfirmText(event.target.value)}
                  className="w-full sm:w-64 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                  placeholder="Type DELETE"
                />
                <button
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteLoading || bulkDeleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                >
                  {bulkDeleteLoading ? 'Deleting...' : 'Confirm delete'}
                </button>
                <button
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm"
                  onClick={() => {
                    setShowBulkDeleteConfirm(false);
                    setBulkDeleteConfirmText('');
                  }}
                  disabled={bulkDeleteLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {pendingRequests.length === 0 && (
            <p className="text-sm text-slate-500">All caught up! Every school request is processed.</p>
          )}

          <div className="space-y-4">
            {pendingRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-slate-100 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{request.schoolName}</p>
                      <p className="text-xs text-slate-500">{request.board} • {request.studentCount} students</p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-500 flex gap-4">
                    <span className="flex items-center gap-1"><Clock size={14} /> {formatDate(request.submittedAt)}</span>
                    <span className="flex items-center gap-1"><Mail size={14} /> {request.contactEmail}</span>
                    <span className="flex items-center gap-1"><Phone size={14} /> {request.contactPerson}</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* <button
                    className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={() => handleRequestAction(request.id, 'review')}
                    disabled={Boolean(activeRequestAction)}
                  >
                    {activeRequestAction === `${request.id}:review` ? 'Updating...' : 'Request Info'}
                  </button> */}
                  <button
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={() => handleRequestAction(request.id, 'approved')}
                    disabled={Boolean(activeRequestAction)}
                  >
                    {activeRequestAction === `${request.id}:approved` ? 'Approving...' : 'Approve Now'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-violet-50 text-violet-500">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Recent approvals</p>
                <p className="font-semibold text-slate-800">Activation timeline</p>
              </div>
            </div>
            <div className="space-y-3">
              {recentRequests.map((request) => (
                <div key={request.id} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{request.schoolName}</p>
                      <p className="text-xs text-slate-500">Campus: {request.campuses}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[request.status] || 'bg-slate-100 text-slate-500'}`}>
                      {request.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Updated {request.updatedAt ? formatDate(request.updatedAt) : formatDate(request.submittedAt)}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-500">
              <AlertCircle size={18} />
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Issue room</p>
              <p className="font-semibold text-slate-800">Incidents under watch</p>
            </div>
          </div>
          {urgentIssues.length === 0 ? (
            <p className="text-sm text-slate-500">No open incidents right now.</p>
          ) : (
            <div className="space-y-3">
              {urgentIssues.map((issue) => (
                <div key={issue.id} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{issue.title}</p>
                      <p className="text-xs text-slate-500">Owner: {issue.owner}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      issue.severity === 'high'
                        ? 'bg-red-100 text-red-600'
                        : issue.severity === 'medium'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-sky-100 text-sky-700'
                    }`}>
                      {issue.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{issue.description}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      className="text-xs px-3 py-1 border border-slate-200 rounded-lg text-slate-600"
                      onClick={() => onIssueUpdate(issue.id, { status: 'investigating' })}
                    >
                      Escalate
                    </button>
                    <button
                      className="text-xs px-3 py-1 rounded-lg bg-emerald-50 text-emerald-600"
                      onClick={() => onIssueUpdate(issue.id, { status: 'resolved' })}
                    >
                      Mark resolved
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-500">
              <Mail size={18} />
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Feedback</p>
              <p className="font-semibold text-slate-800">Responses waiting</p>
            </div>
          </div>
          {feedbackQueue.length === 0 ? (
            <p className="text-sm text-slate-500">No pending feedback threads.</p>
          ) : (
            <div className="space-y-3">
              {feedbackQueue.map((feedback) => (
                <div key={feedback.id} className="border border-slate-100 rounded-lg p-3">
                  <p className="text-sm font-semibold text-slate-700">{feedback.topic}</p>
                  <p className="text-xs text-slate-500">{feedback.schoolName}</p>
                  <p className="text-sm text-slate-600 mt-2">{feedback.message}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      className="text-xs px-3 py-1 border border-slate-200 rounded-lg text-slate-600"
                      onClick={() => onFeedbackUpdate(feedback.id, { status: 'in_progress' })}
                    >
                      Discuss
                    </button>
                    <button
                      className="text-xs px-3 py-1 rounded-lg bg-sky-50 text-sky-600"
                      onClick={() => onFeedbackUpdate(feedback.id, { status: 'resolved' })}
                    >
                      Close feedback
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Overview;
