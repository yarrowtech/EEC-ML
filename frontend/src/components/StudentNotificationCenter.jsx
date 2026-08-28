import React, { useMemo, useState } from 'react';
import { Bell, CheckCheck, Loader2, Clock, ArrowRight, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
];

const TYPE_ICONS = {
  assignment: '📋',
  exam: '📝',
  result: '🏆',
  fee: '💳',
  attendance: '📅',
  notice: '📣',
  announcement: '📣',
  achievement: '⭐',
};

const resolveNotifPath = (notification) => {
  const type = notification?.type?.toLowerCase();
  const relatedEntity = notification?.relatedEntity?.entityType?.toLowerCase();
  const typeLabel = String(notification?.typeLabel || '').toLowerCase();
  const text = `${notification?.title || ''} ${notification?.message || ''} ${typeLabel}`.toLowerCase();

  const hasExamRoutine = Array.isArray(notification?.examRoutine) && notification.examRoutine.length > 0;

  if (typeLabel === 'attendance_marked' || text.includes('attendance') || text.includes('marked present') || text.includes('marked absent')) return '/student/attendance';
  if (text.includes('achievement')) return '/student/achievements';
  if (relatedEntity === 'assignment' || type === 'assignment') return '/student/assignments';
  // Published exam-routine notices carry their own schedule table + PDF —
  // route to the notice itself rather than the generic exams list.
  if (hasExamRoutine) return `/student/noticeboard?notice=${notification._id}`;
  if (relatedEntity === 'exam' || type === 'exam') return '/student/exams';
  if (relatedEntity === 'result' || type === 'result') return '/student/results';
  if (type === 'notice' || type === 'announcement') return `/student/noticeboard?notice=${notification._id}`;
  if (type === 'class_note') return '/student/assignments-journal';
  return '/student/home';
};

const getTypeIcon = (notification) => {
  const type = notification?.type?.toLowerCase();
  const text = `${notification?.title || ''} ${notification?.message || ''}`.toLowerCase();
  if (text.includes('achievement')) return TYPE_ICONS.achievement;
  if (type && TYPE_ICONS[type]) return TYPE_ICONS[type];
  const typeLabel = String(notification?.typeLabel || '').toLowerCase();
  if (typeLabel.includes('attendance')) return TYPE_ICONS.attendance;
  return '🔔';
};

const formatTimeAgo = (dateString) => {
  const diff = Date.now() - new Date(dateString).getTime();
  if (diff < 0) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatDateGroup = (dateString) => {
  const d = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diffDays = Math.floor((today - d) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const NotificationRow = ({ notification, onRead, onNavigate }) => {
  const isRead = Boolean(notification?.isRead);
  const icon = getTypeIcon(notification);

  const handleClick = () => {
    if (!isRead) onRead(notification._id);
    onNavigate(resolveNotifPath(notification));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-4 hover:bg-slate-50 transition-colors ${isRead ? '' : 'bg-indigo-50/30'}`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base border ${
        isRead ? 'bg-slate-50 border-slate-100' : 'bg-indigo-50 border-indigo-100'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-snug line-clamp-1 ${isRead ? 'font-medium text-slate-600' : 'font-bold text-slate-900'}`}>
            {notification?.title || 'Notification'}
          </p>
          {!isRead && (
            <span className="mt-0.5 shrink-0 h-2 w-2 rounded-full bg-indigo-500" />
          )}
        </div>
        {notification?.message && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notification.message}</p>
        )}
        <div className="flex items-center gap-1 mt-1.5">
          <Clock size={11} className="text-slate-400" />
          <span className="text-[11px] text-slate-400">{formatTimeAgo(notification?.createdAt)}</span>
        </div>
      </div>
      <ArrowRight size={14} className="text-slate-300 mt-1 shrink-0" />
    </button>
  );
};

const StudentNotificationCenter = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (activeFilter === 'unread') return !n?.isRead;
      if (activeFilter === 'read') return Boolean(n?.isRead);
      return true;
    });
  }, [notifications, activeFilter]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((n) => {
      const key = formatDateGroup(n?.createdAt);
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });
    return Object.entries(groups);
  }, [filtered]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-10 sm:p-6 space-y-5">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 p-5 shadow-lg shadow-indigo-200/60 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white sm:text-2xl">Notifications</h1>
              <p className="text-sm text-white/80">
                {loading ? 'Loading…' : unreadCount > 0 ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
              </p>
            </div>
          </div>
          {!loading && unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
            >
              <CheckCheck size={13} />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      {!loading && notifications.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: notifications.length, color: 'from-slate-600 to-slate-700' },
            { label: 'Unread', value: unreadCount, color: 'from-indigo-500 to-indigo-600' },
            { label: 'Read', value: notifications.length - unreadCount, color: 'from-emerald-500 to-teal-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${color} p-3.5 shadow-sm`}>
              <div className="pointer-events-none absolute -right-3 -top-3 h-14 w-14 rounded-full bg-white/10" />
              <p className="text-[11px] font-semibold text-white/80">{label}</p>
              <p className="mt-1 text-xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        <Filter size={13} className="text-slate-400 shrink-0" />
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-all ${
                activeFilter === tab.key
                  ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              {tab.key === 'unread' && unreadCount > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeFilter === tab.key ? 'bg-white/25 text-white' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notification list */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading notifications…</span>
          </div>
        ) : grouped.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <Bell size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">
              {activeFilter === 'unread' ? 'No unread notifications' :
               activeFilter === 'read' ? 'No read notifications' :
               'No notifications yet'}
            </p>
            <p className="mt-1 text-xs text-slate-400">Check back later for updates from your school.</p>
          </div>
        ) : (
          <div>
            {grouped.map(([dateLabel, items], groupIdx) => (
              <div key={dateLabel} className={groupIdx > 0 ? 'border-t border-slate-100' : ''}>
                <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dateLabel}</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {items.map((n) => {
                    const id = String(n?._id || n?.id || n?.title || Math.random());
                    return (
                      <NotificationRow
                        key={id}
                        notification={n}
                        onRead={markAsRead}
                        onNavigate={navigate}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentNotificationCenter;
