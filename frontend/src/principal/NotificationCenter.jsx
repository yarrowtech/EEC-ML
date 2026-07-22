import React, { useMemo, useState } from 'react';
import {
  Bell,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  Search,
  Flag,
  User,
  Calendar,
  FileText,
  DollarSign,
  RefreshCw,
  Loader2
} from 'lucide-react';

const NotificationCenter = ({
  notifications = [],
  loading = false,
  error = '',
  onRefresh,
  onMarkRead,
  onDismiss,
}) => {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState('');
  const [pendingActions, setPendingActions] = useState({});

  const sortedNotifications = useMemo(() => {
    const list = Array.isArray(notifications) ? [...notifications] : [];
    return list.sort((a, b) => {
      const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
      const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
      return bTime - aTime;
    });
  }, [notifications]);

  const priorityStats = useMemo(() => ({
    high: sortedNotifications.filter(n => (n.priority || '').toLowerCase() === 'high').length,
    medium: sortedNotifications.filter(n => (n.priority || '').toLowerCase() === 'medium').length,
    low: sortedNotifications.filter(n => (n.priority || '').toLowerCase() === 'low').length,
    unread: sortedNotifications.filter(n => !n.read).length,
  }), [sortedNotifications]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'urgent':
      case 'warning':
        return AlertTriangle;
      case 'success':
        return CheckCircle;
      case 'info':
        return Info;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (type, priority) => {
    if ((priority || '').toLowerCase() === 'high') return 'red';
    switch (type) {
      case 'urgent':
      case 'warning':
        return 'yellow';
      case 'success':
        return 'green';
      case 'financial':
        return 'emerald';
      case 'academic':
        return 'blue';
      case 'staff':
        return 'purple';
      default:
        return 'gray';
    }
  };

  const getDepartmentIcon = (department = '') => {
    switch (department.toLowerCase()) {
      case 'academic': return FileText;
      case 'finance': return DollarSign;
      case 'hr': return User;
      case 'events': return Calendar;
      case 'safety': return AlertTriangle;
      default: return Bell;
    }
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 60_000) return 'Just now';
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const filteredNotifications = useMemo(() => sortedNotifications.filter((notification) => {
    const priority = (notification.priority || '').toLowerCase();
    if (filter !== 'all' && filter !== 'unread' && priority !== filter) return false;
    if (filter === 'unread' && notification.read) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const titleMatch = (notification.title || '').toLowerCase().includes(q);
      const messageMatch = (notification.message || '').toLowerCase().includes(q);
      if (!titleMatch && !messageMatch) return false;
    }
    return true;
  }), [sortedNotifications, filter, searchQuery]);

  const handleRefresh = () => {
    if (typeof onRefresh === 'function') onRefresh();
  };

  const startAction = (id, type) => {
    setPendingActions((prev) => ({ ...prev, [id]: type }));
    setActionError('');
  };

  const finishAction = (id) => {
    setPendingActions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleMarkReadClick = async (notificationId) => {
    if (!notificationId || typeof onMarkRead !== 'function') return;
    startAction(notificationId, 'read');
    try {
      await onMarkRead(notificationId);
    } catch (err) {
      setActionError(err?.message || 'Unable to update notification.');
    } finally {
      finishAction(notificationId);
    }
  };

  const handleDismissClick = async (notificationId) => {
    if (!notificationId || typeof onDismiss !== 'function') return;
    startAction(notificationId, 'dismiss');
    try {
      await onDismiss(notificationId);
    } catch (err) {
      setActionError(err?.message || 'Unable to dismiss notification.');
    } finally {
      finishAction(notificationId);
    }
  };

  const departmentStats = useMemo(() => {
    const map = new Map();
    sortedNotifications.forEach((notification) => {
      const key = (notification.department || notification.category || 'Other').trim() || 'Other';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  }, [sortedNotifications]);

  const recentHighPriority = sortedNotifications.find((notification) => (notification.priority || '').toLowerCase() === 'high');

  const filterOptions = [
    { key: 'all', label: 'All', count: sortedNotifications.length },
    { key: 'unread', label: 'Unread', count: priorityStats.unread },
    { key: 'high', label: 'High', count: priorityStats.high },
    { key: 'medium', label: 'Medium', count: priorityStats.medium },
    { key: 'low', label: 'Low', count: priorityStats.low },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-950 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/80">Principal alerts hub</p>
            <h1 className="text-3xl font-bold mt-2">Notification Center</h1>
            <p className="text-white/80 mt-2 max-w-3xl">
              Track urgent alerts, finance updates, and academic notices pulled straight from the live feed. Filter, search, and close items.
            </p>
          </div>
          <div className="bg-white/15 rounded-2xl p-4 min-w-[240px]">
            <p className="text-sm text-white/70">Unread alerts</p>
            <p className="text-3xl font-bold">{priorityStats.unread}</p>
            <div className="flex items-center justify-between text-xs text-white/70 mt-2">
              <span>High priority</span>
              <span>{priorityStats.high}</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-white/20 rounded-xl hover:bg-white/30 disabled:opacity-60"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh feed
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600 uppercase">Total notifications</p>
              <p className="text-2xl font-bold text-slate-900">{sortedNotifications.length}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl">
              <Bell className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-red-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-600 uppercase">High priority</p>
              <p className="text-2xl font-bold text-red-600">{priorityStats.high}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-2xl">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600 uppercase">Medium priority</p>
              <p className="text-2xl font-bold text-slate-600">{priorityStats.medium}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl">
              <Flag className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-green-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 uppercase">Low priority</p>
              <p className="text-2xl font-bold text-green-600">{priorityStats.low}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-2xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm">
          {actionError}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => setFilter(option.key)}
              className={`px-4 py-1.5 rounded-full border text-sm font-medium flex items-center gap-2 ${
                filter === option.key
                  ? 'bg-slate-100 border-slate-200 text-slate-900'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{option.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-current">{option.count}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notifications"
            className="w-full border border-gray-200 rounded-2xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Live notifications</h3>
              <p className="text-xs text-slate-700">Click to expand details, mark read, or dismiss</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <Clock className="w-4 h-4" />
              Updated {new Date().toLocaleTimeString()}
            </div>
          </div>
          <div className="divide-y divide-slate-50 max-h-[600px] overflow-auto">
            {loading && (
              <div className="p-6 flex items-center justify-center gap-2 text-slate-800">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading notifications...
              </div>
            )}
            {!loading && filteredNotifications.length === 0 && (
              <div className="p-6 text-center text-slate-800 text-sm">No notifications match the selected filters.</div>
            )}
            {!loading && filteredNotifications.map((notification) => {
              const Icon = getNotificationIcon(notification.type);
              const color = getNotificationColor(notification.type, notification.priority);
              const DepartmentIcon = getDepartmentIcon(notification.department || notification.category);
              const isPending = Boolean(pendingActions[notification.id]);
              const read = Boolean(notification.read);
              return (
                <div key={notification.id} className="p-5 flex flex-col gap-3">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${
                      color === 'red' ? 'bg-red-500' :
                      color === 'yellow' ? 'bg-amber-500' :
                      color === 'green' ? 'bg-green-500' :
                      color === 'emerald' ? 'bg-emerald-500' :
                      color === 'blue' ? 'bg-blue-500' :
                      color === 'purple' ? 'bg-purple-500' : 'bg-gray-500'
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`text-base font-semibold ${read ? 'text-gray-600' : 'text-slate-900'}`}>
                          {notification.title || 'Notification'}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          color === 'red' ? 'bg-red-50 text-red-700' :
                          color === 'yellow' ? 'bg-amber-50 text-amber-700' :
                          color === 'green' ? 'bg-green-50 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {(notification.priority || 'medium').toUpperCase()}
                        </span>
                        {notification.department && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700 flex items-center gap-1">
                            <DepartmentIcon className="w-3 h-3" />
                            {notification.department}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-line mt-1">
                        {notification.message || 'No additional details provided.'}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mt-3">
                        <span>Audience: {notification.audience || 'All'}</span>
                        {notification.createdByName && <span>Sent by: {notification.createdByName}</span>}
                        <span>{formatRelativeTime(notification.createdAt || notification.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {!read && (
                      <button
                        onClick={() => handleMarkReadClick(notification.id)}
                        disabled={isPending}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                      >
                        {pendingActions[notification.id] === 'read' ? 'Marking...' : 'Mark read'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDismissClick(notification.id)}
                      disabled={isPending}
                      className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      {pendingActions[notification.id] === 'dismiss' ? 'Removing...' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-700 uppercase">Department breakdown</p>
                <h3 className="text-lg font-semibold text-slate-900">Which teams are posting</h3>
              </div>
            </div>
            <div className="space-y-3">
              {departmentStats.length ? departmentStats.map((dept) => (
                <div key={dept.label}>
                  <div className="flex items-center justify-between text-sm text-gray-700">
                    <span>{dept.label}</span>
                    <span>{dept.count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                    <div
                      className="h-2 rounded-full bg-slate-500"
                      style={{ width: `${sortedNotifications.length ? Math.min(100, (dept.count / sortedNotifications.length) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-500">No departmental data yet.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-3">
            <p className="text-xs text-slate-700 uppercase">Latest high priority</p>
            {recentHighPriority ? (
              <>
                <p className="text-base font-semibold text-slate-900">{recentHighPriority.title}</p>
                <p className="text-sm text-gray-600">{recentHighPriority.message}</p>
                <p className="text-xs text-gray-500">{formatRelativeTime(recentHighPriority.createdAt || recentHighPriority.timestamp)}</p>
              </>
            ) : (
              <p className="text-sm text-gray-500">No high priority notifications right now.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
