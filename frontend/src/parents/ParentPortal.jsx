import React, { lazy, Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  Calendar,
  Bell,
  BookOpen,
  CreditCard,
  Activity,
  MessageCircle,
  AlertOctagon,
  FileEdit,
  FileText,
  Menu,
  X,
  Award,
  Sun,
  Video,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCheck,
  Home,
  LogOut,
  BarChart2,
} from 'lucide-react';
import { useDesktopNotificationBridge } from '../hooks/useDesktopNotificationBridge';
import DesktopNotificationPermissionModal from '../components/DesktopNotificationPermissionModal';
import { AUTH_NOTICE, apiFetch, logoutAndRedirect } from '../utils/authSession';
import { useDialog } from './useDialog';
import './parentPortalDesign.css';

const ParentDashboard = lazy(() => import('./ParentDashboard'));
const ChildGrowthAnalytics = lazy(() => import('./ChildGrowthAnalytics'));
const AcademicReport = lazy(() => import('./AcademicReport'));
const AttendanceReport = lazy(() => import('./AttendanceReport'));
const AchievementsView = lazy(() => import('./AchievementsView'));
const HealthReport = lazy(() => import('./HealthReport'));
const ClassRoutine = lazy(() => import('./ClassRoutine'));
const HolidayList = lazy(() => import('./HolidayList'));
const FeesPayment = lazy(() => import('./FeesPayment'));
const ParentChat = lazy(() => import('./ParentChat'));
const PTMPortal = lazy(() => import('./PTMPortal'));
const ComplaintManagementSystem = lazy(() => import('./ComplaintManagementSystem'));
const ParentObservationNonAcademic = lazy(() => import('./ParentObservationNonAcademic'));
const ExcuseLetters = lazy(() => import('./ExcuseLetters'));

const PortalRouteFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
    <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur-sm">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" aria-hidden="true" />
      Loading page…
    </div>
  </div>
);

// Navigation is grouped so a parent scans by intent, not through a flat list.
const NAV_GROUPS = [
  {
    items: [
      { icon: Home, label: 'Dashboard', description: 'Overview & insights', path: '/parents' },
    ],
  },
  {
    heading: 'Progress',
    items: [
      { icon: BarChart2, label: 'Growth Analytics', description: 'Academic & wellbeing', path: '/parents/analytics' },
      { icon: BookOpen, label: 'Report Card', description: 'Marks & assessments', path: '/parents/academic' },
      { icon: Calendar, label: 'Attendance', description: 'Punctuality tracker', path: '/parents/attendance' },
      { icon: Award, label: 'Achievements', description: 'Celebrate wins', path: '/parents/achievements' },
      { icon: Activity, label: 'Health Record', description: 'Wellness & medical', path: '/parents/health' },
    ],
  },
  {
    heading: 'Schedule',
    items: [
      { icon: Clock, label: 'Class Routine', description: 'Weekly timetable', path: '/parents/routine' },
      { icon: Sun, label: 'Holidays', description: 'School holiday list', path: '/parents/holidays' },
    ],
  },
  {
    heading: 'Money',
    items: [
      { icon: CreditCard, label: 'Fees', description: 'Bills & payments', path: '/parents/fees' },
    ],
  },
  {
    heading: 'Talk to school',
    items: [
      { icon: MessageCircle, label: 'Chat', description: 'Message staff', path: '/parents/chat' },
      { icon: Video, label: 'Meetings', description: 'Parent-teacher meetings', path: '/parents/ptm' },
      { icon: AlertOctagon, label: 'Complaints', description: 'Raise an issue', path: '/parents/complaints' },
      { icon: FileEdit, label: 'Observations', description: 'Share home feedback', path: '/parents/parent-observation' },
      { icon: FileText, label: 'Excuse Letters', description: 'Leave requests', path: '/parents/excuse-letters' },
    ],
  },
];

const ParentPortal = () => {
  const prefersReducedMotion = useReducedMotion();
  const [sidebarOpen, setSidebarOpen] = useState(() => (
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  ));
  const [parentProfile, setParentProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef(null);
  const notificationsRef = useRef(null);
  const logoutDialogRef = useDialog(showLogoutConfirm, () => setShowLogoutConfirm(false));
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

  useEffect(() => {
    const loadParentProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await apiFetch(`${API_BASE}/api/parent/auth/profile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${token}`,
          },
        }, navigate);
        if (!res.ok) return;
        const data = await res.json();
        setParentProfile(data);
      } catch (err) {
        if (err?.code === AUTH_NOTICE.EXPIRED) return;
        console.error('Failed to load parent profile', err);
      }
    };
    loadParentProfile();
  }, [API_BASE, navigate]);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logoutAndRedirect({ navigate, notice: AUTH_NOTICE.LOGGED_OUT });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (typeof window === 'undefined') return;
      if (window.innerWidth >= 1024) return;
      if (!sidebarOpen) return;
      if (event.target.closest('.parent-sidebar')) return;
      setSidebarOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const handleBreakpointChange = (event) => {
      setSidebarOpen(event.matches);
      setProfileOpen(false);
      setShowNotifications(false);
    };
    desktopQuery.addEventListener?.('change', handleBreakpointChange);
    return () => desktopQuery.removeEventListener?.('change', handleBreakpointChange);
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target) && !event.target.closest('[data-profile-control]')) {
        setProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target) && !event.target.closest('[data-notification-control]')) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const normalizePath = (path) => {
    if (!path) return '/';
    const sanitized = path.replace(/\/+$/, '');
    return sanitized || '/';
  };

  const currentPath = normalizePath(
    location.pathname.startsWith('/parents')
      ? location.pathname
      : location.pathname.replace(/^\/parent(\/|$)/, '/parents$1')
  );
  const handleMenuClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };
  const childrenCount = Array.isArray(parentProfile?.children)
    ? parentProfile.children.length
    : 0;
  const wardLabel = childrenCount === 1 ? 'child' : 'children';
  const parentName = String(parentProfile?.name || 'Parent').trim();
  const nameParts = parentName.split(/\s+/).filter(Boolean);
  const initials = (nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : (nameParts[0]?.[0] || 'P')
  ).toUpperCase();
  const unreadCount = useMemo(
    () => notifications.filter((item) => !item?.isRead).length,
    [notifications]
  );

  const fetchNotifs = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setNotifications([]);
      return;
    }
    setNotifLoading(true);
    setNotifError('');
    try {
      const res = await apiFetch(`${API_BASE}/api/notifications/user`, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
      }, navigate);
      if (res.status === 304) return;
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Failed to load notifications');
      const all = Array.isArray(data) ? data : [];
      setNotifications(
        all
          .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
          .slice(0, 20)
      );
    } catch (err) {
      setNotifError(err.message || 'Failed to load notifications');
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  }, [API_BASE, navigate]);

  useEffect(() => {
    fetchNotifs();
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifs();
    }, 15000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchNotifs();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchNotifs]);

  const markRead = useCallback(async (id) => {
    if (!id) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setNotifications((prev) =>
      prev.map((n) => (String(n?._id || n?.id || '') === String(id) ? { ...n, isRead: true } : n))
    );
    try {
      const res = await apiFetch(`${API_BASE}/api/notifications/user/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      }, navigate);
      if (!res.ok) throw new Error('Failed to mark notification as read');
      await fetchNotifs();
    } catch (err) {
      setNotifError(err.message || 'Failed to mark notification as read');
      await fetchNotifs();
    }
  }, [API_BASE, fetchNotifs, navigate]);

  const markAllRead = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    try {
      const res = await apiFetch(`${API_BASE}/api/notifications/user/read-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      }, navigate);
      if (!res.ok) throw new Error('Failed to mark all notifications as read');
      await fetchNotifs();
    } catch (err) {
      setNotifError(err.message || 'Failed to mark all as read');
      await fetchNotifs();
    }
  }, [API_BASE, fetchNotifs, navigate]);

  const handleToggleNotifications = useCallback(() => {
    const nextOpen = !showNotifications;
    setShowNotifications(nextOpen);
    setProfileOpen(false);
    if (nextOpen && !sidebarOpen) setSidebarOpen(true);
  }, [showNotifications, sidebarOpen]);

  const timeAgo = useCallback((value) => {
    if (!value) return '';
    const ts = new Date(value);
    if (Number.isNaN(ts.getTime())) return '';
    const mins = Math.floor((Date.now() - ts.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return ts.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }, []);

  const resolveNotifPath = useCallback((notification) => {
    const title = String(notification?.title || '').toLowerCase();
    const message = String(notification?.message || '').toLowerCase();
    const type = String(notification?.type || notification?.typeLabel || '').toLowerCase();
    const blob = `${title} ${message} ${type}`;
    if (blob.includes('analytics') || blob.includes('growth')) return '/parents/analytics';
    if (blob.includes('achievement')) return '/parents/achievements';
    if (blob.includes('attendance')) return '/parents/attendance';
    if (blob.includes('academic') || blob.includes('assignment')) return '/parents/academic';
    if (blob.includes('fee') || blob.includes('payment')) return '/parents/fees';
    if (blob.includes('health') || blob.includes('wellbeing')) return '/parents/health';
    if (blob.includes('complaint') || blob.includes('issue')) return '/parents/complaints';
    if (blob.includes('meeting') || blob.includes('ptm')) return '/parents/ptm';
    if (blob.includes('result') || blob.includes('exam')) return '/parents/results';
    if (blob.includes('chat') || blob.includes('message')) return '/parents/chat';
    if (blob.includes('holiday')) return '/parents/holidays';
    return '/parents';
  }, []);
  const {
    showPermissionModal,
    pendingCount,
    syncNotifications,
    requestPermissionFromModal,
    dismissPermissionModal,
  } = useDesktopNotificationBridge({
    scopeKey: 'parent',
    resolvePath: resolveNotifPath,
    appName: 'Parent Portal',
  });

  useEffect(() => {
    syncNotifications(notifications);
  }, [notifications, syncNotifications]);

  const formatNotificationMessage = useCallback((message) => {
    if (!message) return '';
    return String(message).replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\b/g, (isoValue) => {
      const ts = new Date(isoValue);
      if (Number.isNaN(ts.getTime())) return isoValue;
      return ts.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    });
  }, []);

  return (
    <>
    <div className="min-h-screen bg-gray-100 flex relative">
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Cancel logout"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div
            ref={logoutDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="parent-logout-title"
            tabIndex={-1}
            className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden"
          >
            <div className="h-1 bg-linear-to-r from-red-400 to-rose-400" />
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-6 h-6 text-red-500" />
              </div>
              <h3 id="parent-logout-title" className="text-base font-bold text-gray-900 text-center">Confirm Logout</h3>
              <p className="text-sm text-gray-500 text-center mt-1">
                Are you sure you want to log out? Any unsaved changes will be lost.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Mobile Sidebar Toggle */}
      {!sidebarOpen && <button
        className="lg:hidden fixed top-4 left-4 z-30 p-2 bg-violet-600 text-white rounded-lg shadow-lg"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu size={24} />
      </button>}

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar backdrop"
        />
      )}

      <div
        className={`parent-sidebar fixed lg:relative h-[100dvh] min-h-0 shrink-0 bg-white shadow-2xl transition-all duration-500 ease-in-out z-30 flex flex-col border-r border-gray-200 overflow-hidden
          ${sidebarOpen ? 'w-[min(20rem,calc(100vw-1rem))] lg:w-80' : 'w-20'}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{
          transitionProperty: 'width, transform, box-shadow',
          transitionDuration: '0.4s',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        aria-label="Sidebar navigation"
      >
        <div className="relative overflow-hidden">
          <div className={`transition-all duration-400 ease-in-out ${sidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none absolute inset-0'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-violet-500 opacity-95" />
            <div className="relative px-4 py-5">
              <div className="flex items-center gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg border border-white/30">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1 text-white">
                    <div className="font-semibold text-lg leading-tight">
                      {parentProfile?.name ? `${parentProfile.name}` : 'Parent Portal'}
                    </div>
                    <div className="text-white/80 text-xs">
                      {childrenCount ? `${childrenCount} ${wardLabel}` : 'Your children'}
                    </div>
                  </div>
                </div>
                <div className="ml-auto flex shrink-0 gap-2">
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="hidden lg:flex p-2 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors border border-white/30"
                    aria-label="Collapse sidebar"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden p-2 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors border border-white/30"
                    aria-label="Close sidebar"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={`transition-all duration-400 ease-in-out ${!sidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none absolute inset-0'}`}>
            <div className="p-3 border-b border-gray-200 bg-white">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-violet-500 rounded-xl flex items-center justify-center shadow-md">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="hidden lg:flex">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 rounded-lg text-violet-600 hover:bg-violet-50 transition-colors"
                    aria-label="Expand sidebar"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav className={`min-h-0 flex-1 overflow-y-auto overscroll-contain modern-scrollbar ${sidebarOpen ? 'px-4 py-5 space-y-4' : 'px-1 py-4 space-y-3'}`}>
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.heading || 'primary'} className={sidebarOpen ? 'space-y-1' : 'space-y-1'}>
              {group.heading && sidebarOpen && (
                <p className="px-4 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {group.heading}
                </p>
              )}
              {group.heading && !sidebarOpen && groupIndex > 0 && (
                <div className="mx-2 my-1 border-t border-gray-200" aria-hidden="true" />
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const targetPath = normalizePath(item.path);
                const isRootLink = targetPath === '/parents';
                const isActive = isRootLink
                  ? currentPath === targetPath
                  : currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={handleMenuClick}
                    aria-current={isActive ? 'page' : undefined}
                    title={!sidebarOpen ? item.label : undefined}
                    className={`
                      group flex items-center rounded-xl transition-colors duration-200 ${
                        sidebarOpen ? 'px-4 py-2.5' : 'px-2 py-2.5 justify-center'
                      }
                      ${
                        isActive
                          ? 'bg-violet-50 text-violet-700 border-l-[3px] border-violet-600'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-l-[3px] border-transparent'
                      }
                    `}
                  >
                    <Icon
                      className={`flex-shrink-0 transition-colors duration-200 ${isActive ? 'text-violet-600' : 'text-gray-400 group-hover:text-gray-600'}`}
                      size={sidebarOpen ? 19 : 18}
                    />
                    {sidebarOpen && (
                      <div className="ml-3 flex-1 min-w-0">
                        <div className="font-medium text-sm">{item.label}</div>
                        <div className="text-xs text-gray-400 truncate">{item.description}</div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={`${sidebarOpen ? 'p-3' : 'p-2'} shrink-0 border-t border-gray-200 bg-white`}>
          {sidebarOpen && showNotifications && (
            <section ref={notificationsRef} aria-label="Notifications panel" className="mb-3 overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Bell size={15} className="text-violet-600" />
                  <span className="text-sm font-bold text-gray-900">Notifications</span>
                  {unreadCount > 0 && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">{unreadCount}</span>}
                </div>
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-800">
                    <CheckCheck size={12} /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-[30dvh] min-h-0 divide-y divide-gray-100 overflow-y-auto overscroll-contain" aria-live="polite">
                {notifLoading && <p className="px-3 py-5 text-center text-xs text-gray-500">Loading notifications…</p>}
                {!notifLoading && notifError && <p role="alert" className="px-3 py-4 text-xs text-red-600">{notifError}</p>}
                {!notifLoading && !notifError && notifications.length === 0 && <p className="px-3 py-5 text-center text-xs text-gray-500">No notifications yet</p>}
                {!notifLoading && !notifError && notifications.map((notification) => {
                  const id = String(notification?._id || notification?.id || '');
                  const isRead = Boolean(notification?.isRead);
                  return (
                    <button
                      key={id || notification?.title}
                      type="button"
                      onClick={async () => {
                        await markRead(id);
                        setShowNotifications(false);
                        navigate(resolveNotifPath(notification));
                        if (window.innerWidth < 1024) setSidebarOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 text-left transition hover:bg-violet-50 ${isRead ? 'bg-white' : 'bg-violet-50/60'}`}
                    >
                      <span className="flex items-start gap-2">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isRead ? 'bg-gray-200' : 'bg-violet-500'}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-gray-800">{notification?.title || 'Notification'}</span>
                          {notification?.message && <span className="mt-0.5 block line-clamp-2 text-[11px] text-gray-500">{formatNotificationMessage(notification.message)}</span>}
                          <span className="mt-1 block text-[10px] text-gray-400">{timeAgo(notification?.createdAt)}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {sidebarOpen && profileOpen && (
            <section ref={profileRef} aria-label="Profile panel" className="mb-3 rounded-2xl border border-violet-100 bg-violet-50/70 p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-400 text-sm font-bold text-white">{initials}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900">{parentName}</p>
                  <p className="text-[11px] text-gray-500">{childrenCount ? `${childrenCount} ${wardLabel}` : 'Parent account'}</p>
                </div>
              </div>
              <button type="button" onClick={() => { setProfileOpen(false); navigate('/parents'); }} className="mt-3 flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-violet-100">
                <User size={15} className="text-violet-600" /> Open dashboard
              </button>
            </section>
          )}

          <div className={`grid gap-2 ${sidebarOpen ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <motion.button
              data-notification-control
              type="button"
              onClick={handleToggleNotifications}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              aria-expanded={showNotifications}
              aria-label="Notifications"
              className={`relative flex items-center rounded-xl border transition ${sidebarOpen ? 'justify-start gap-2 px-3 py-2.5' : 'justify-center p-2.5'} ${showNotifications ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Bell size={18} />
              {sidebarOpen && <span className="text-xs font-semibold">Notifications</span>}
              {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </motion.button>
            <motion.button
              data-profile-control
              type="button"
              onClick={() => {
                if (!sidebarOpen) setSidebarOpen(true);
                setProfileOpen((open) => !open);
                setShowNotifications(false);
              }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              aria-expanded={profileOpen}
              aria-label="Profile"
              className={`flex items-center rounded-xl border transition ${sidebarOpen ? 'justify-start gap-2 px-3 py-2.5' : 'justify-center p-2.5'} ${profileOpen ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <User size={18} />
              {sidebarOpen && <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold">Profile</span>}
              {sidebarOpen && <ChevronDown size={13} className={`transition-transform ${profileOpen ? 'rotate-180' : ''}`} />}
            </motion.button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className={`group relative mt-2 w-full flex items-center rounded-xl transition-all duration-300 ease-out transform ${
              sidebarOpen ? 'px-3 py-2.5' : 'px-0 py-2 justify-center'
            } text-red-600 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 hover:text-red-700 hover:shadow-md hover:scale-105 active:scale-95`}
          >
            <div className={`flex items-center justify-center rounded-lg transition-all duration-300 ${
              sidebarOpen ? 'w-10 h-10 bg-red-100 group-hover:bg-red-200' : 'w-10 h-10 bg-red-100'
            }`}>
              <LogOut size={20} />
            </div>
            {sidebarOpen && (
              <div className="ml-3 text-left">
                <div className="font-medium text-sm">Logout</div>
                <div className="text-xs text-red-500">Sign out securely</div>
              </div>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col h-screen bg-slate-50">
        <main id="parent-main-content" className="parent-route-canvas flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-violet-50/30 p-2 sm:p-3">
          <div className="h-full min-h-full rounded-[2rem] border border-white/80 bg-white/40 shadow-sm backdrop-blur-sm">
          <Suspense fallback={<PortalRouteFallback />}>
          <Routes>
            <Route
              path="/"
              element={
                <ParentDashboard
                  parentName={parentProfile?.name}
                  childrenNames={Array.isArray(parentProfile?.children) ? parentProfile.children : []}
                  onOpenSidebar={() => setSidebarOpen(true)}
                />
              }
            />
            <Route path="analytics" element={<ChildGrowthAnalytics />} />
            <Route path="attendance" element={<AttendanceReport />} />
            <Route path="holidays" element={<HolidayList />} />
            <Route path="routine" element={<ClassRoutine />} />
            <Route path="academic" element={<AcademicReport />} />
            <Route path="fees" element={<FeesPayment />} />
            <Route path="health" element={<HealthReport />} />
            <Route path="complaints" element={<ComplaintManagementSystem />} />
            <Route path="chat" element={<ParentChat />} />
            <Route path="ptm" element={<PTMPortal />} />
            <Route path="parent-observation" element={<ParentObservationNonAcademic />} />
            <Route path="excuse-letters" element={<ExcuseLetters />} />
            {/* "Results" merged into the Report Card screen — keep the old path working. */}
            <Route path="results" element={<Navigate to="/parents/academic" replace />} />
            <Route path="achievements" element={<AchievementsView />} />
            <Route path="*" element={<Navigate to="/parents" replace />} />
          </Routes>
          </Suspense>
          </div>
        </main>
      </div>
    </div>
    <DesktopNotificationPermissionModal
      open={showPermissionModal}
      onAllow={requestPermissionFromModal}
      onLater={dismissPermissionModal}
      pendingCount={pendingCount}
    />
    </>
  );
};

export default ParentPortal;
