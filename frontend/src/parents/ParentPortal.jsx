import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  Calendar,
  Bell,
  BookOpen,
  CreditCard,
  Activity,
  MessageSquare,
  MessageCircle,
  AlertOctagon,
  FileEdit,
  FileText,
  Search,
  Menu,
  X,
  Award,
  GraduationCap,
  Video,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCheck,
  Home,
  Eye,
  LogOut,
  BarChart2,
} from 'lucide-react';
import AttendanceReport from './AttendanceReport';
import AcademicReport from './AcademicReport';
import FeesPayment from './FeesPayment';
import HealthReport from './HealthReport';
import ComplaintManagementSystem from './ComplaintManagementSystem';
import ResultsView from './ResultsView';
import AchievementsView from './AchievementsView';
import PTMPortal from './PTMPortal';
import ParentDashboard from './ParentDashboard';
import ParentObservationNonAcademic from './ParentObservationNonAcademic';
import ParentChat from './ParentChat';
import ClassRoutine from './ClassRoutine';
import HolidayList from './HolidayList';
import ExcuseLetters from './ExcuseLetters';
import ChildGrowthAnalytics from './ChildGrowthAnalytics';
import { useDesktopNotificationBridge } from '../hooks/useDesktopNotificationBridge';
import DesktopNotificationPermissionModal from '../components/DesktopNotificationPermissionModal';
import { AUTH_NOTICE, apiFetch, logoutAndRedirect } from '../utils/authSession';

const MENU_ITEMS = [
  { icon: Home, label: 'Dashboard', description: 'Overview & insights', path: '/parents' },
  { icon: BarChart2, label: 'Growth Analytics', description: 'Academic & wellbeing', path: '/parents/analytics' },
  { icon: Calendar, label: 'Holiday List', description: 'School holidays', path: '/parents/holidays' },
  { icon: Clock, label: 'Class Routine', description: 'Weekly schedule', path: '/parents/routine' },
  { icon: Calendar, label: 'Attendance Report', description: 'Punctuality tracker', path: '/parents/attendance' },
  { icon: BookOpen, label: 'Academic Report', description: 'Learning progress', path: '/parents/academic' },
  { icon: CreditCard, label: 'Fees Payment', description: 'Bills & dues', path: '/parents/fees' },
  { icon: Activity, label: 'Health Report', description: 'Wellness records', path: '/parents/health' },
  { icon: MessageCircle, label: 'Chat', description: 'Connect with staff', path: '/parents/chat' },
  { icon: AlertOctagon, label: 'Complaints', description: 'Issue resolution', path: '/parents/complaints' },
  { icon: Video, label: 'Parent-Teacher Meetings', description: 'Upcoming PTMs', path: '/parents/ptm' },
  { icon: FileEdit, label: 'Parent Observation', description: 'Share feedback', path: '/parents/parent-observation' },
  { icon: FileText, label: 'Excuse Letters', description: 'Children leave requests', path: '/parents/excuse-letters' },
  { icon: GraduationCap, label: 'Results', description: 'Performance summary', path: '/parents/results' },
  { icon: Award, label: 'Achievements', description: 'Celebrate wins', path: '/parents/achievements' },
];

const ParentPortal = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

  useEffect(() => {
    const loadParentProfile = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/api/parent/auth/profile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        setParentProfile(data);
      } catch (err) {
        console.error('Failed to load parent profile', err);
      }
    };
    loadParentProfile();
  }, [API_BASE]);

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
    const handler = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
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
  const activePageTitle = useMemo(() => {
    const active = MENU_ITEMS.find((item) => {
      const targetPath = normalizePath(item.path);
      const isRootLink = targetPath === '/parents';
      return isRootLink
        ? currentPath === targetPath
        : currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
    });
    return active?.label || 'Parent Portal';
  }, [currentPath]);

  const handleMenuClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };
  const toggleProfile = useCallback(() => {
    setProfileOpen((prev) => !prev);
  }, []);

  const childrenCount = Array.isArray(parentProfile?.children)
    ? parentProfile.children.length
    : 0;
  const wardLabel = childrenCount === 1 ? 'ward' : 'wards';
  const parentName = String(parentProfile?.name || 'Parent').trim();
  const nameParts = parentName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || 'Parent';
  const initials = (nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : (nameParts[0]?.[0] || 'P')
  ).toUpperCase();
  const { greeting, dateLabel } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const g = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const d = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    return { greeting: g, dateLabel: d };
  }, []);

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

  const handleToggleNotifications = useCallback(async () => {
    const nextOpen = !showNotifications;
    if (nextOpen && unreadCount > 0) {
      await markAllRead();
    }
    setShowNotifications(nextOpen);
    setProfileOpen(false);
  }, [markAllRead, showNotifications, unreadCount]);

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
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="h-1 bg-linear-to-r from-red-400 to-rose-400" />
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900 text-center">Confirm Logout</h3>
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
        className="lg:hidden fixed top-4 left-4 z-30 p-2 bg-yellow-500 text-white rounded-lg shadow-lg"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu size={24} />
      </button>}

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar backdrop"
        />
      )}

      <div
        className={`parent-sidebar fixed lg:relative h-screen bg-white shadow-2xl transition-all duration-500 ease-in-out z-30 flex flex-col border-r border-gray-200 overflow-hidden
          ${sidebarOpen ? 'w-80' : 'w-20'}
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
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-500 opacity-95" />
            <div className="relative px-4 py-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg border border-white/30">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
                  </div>
                  <div className="text-white">
                    <div className="font-semibold text-lg leading-tight">
                      {parentProfile?.name ? `${parentProfile.name}` : 'Parent Portal'}
                    </div>
                    <div className="text-white/80 text-xs">
                      Monitoring {childrenCount || 'your'} {childrenCount ? wardLabel : 'wards'}
                    </div>
                    <div className="text-white/70 text-xs mt-1">
                      Stay updated with weekly progress
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
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
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-md">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="hidden lg:flex">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                    aria-label="Expand sidebar"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav className={`flex-1 overflow-y-auto modern-scrollbar ${sidebarOpen ? 'px-4 py-6 space-y-2' : 'px-1 py-4 space-y-1'}`}>
          {MENU_ITEMS.map((item) => {
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
                className={`
                  group flex items-start rounded-2xl transition-all duration-300 ease-out transform ${
                    sidebarOpen ? 'px-4 py-3' : 'px-2 py-3 justify-center'
                  }
                  ${
                    isActive
                      ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 text-yellow-700 shadow-md border-l-4 border-yellow-500'
                      : 'text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-yellow-50 hover:text-gray-900 hover:shadow-md hover:scale-105 active:scale-95 hover:border-l-4 hover:border-blue-300'
                  }
                `}
              >
                <Icon
                  className={`flex-shrink-0 transition-all duration-300 ${isActive ? 'text-yellow-600' : 'text-gray-500 group-hover:text-blue-600 group-hover:scale-110'}`}
                  size={sidebarOpen ? 20 : 18}
                />
                {sidebarOpen && (
                  <div className="ml-3 flex-1">
                    <div className="font-medium text-sm text-gray-800">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={`${sidebarOpen ? 'p-4' : 'p-2'} border-t border-gray-200`}>
          <button
            type="button"
            onClick={handleLogout}
            className={`group relative w-full flex items-center rounded-xl transition-all duration-300 ease-out transform ${
              sidebarOpen ? 'px-4 py-3' : 'px-0 py-2 justify-center'
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

      <div className="flex-1 min-w-0 flex flex-col h-screen bg-gray-50">
        <header className="sticky top-0 z-20 w-full bg-white/80 backdrop-blur-xl border-b border-gray-100">
          <div className="px-3 sm:px-5">
            <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
                  aria-label="Open sidebar"
                >
                  <Menu size={20} className="text-gray-600" />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {greeting}, <span className="text-amber-600">{firstName}</span>
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Calendar size={12} />
                    <span>{dateLabel}</span>
                    <span className="text-gray-300">|</span>
                    <span className="truncate">{activePageTitle}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="relative" ref={notificationsRef}>
                  <button
                    onClick={handleToggleNotifications}
                    className="relative w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 border border-gray-100 transition-all"
                    aria-label="Notifications"
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                        <div className="flex items-center gap-2">
                          <Bell size={14} className="text-amber-500" />
                          <span className="text-sm font-bold text-gray-900">Notifications</span>
                          {unreadCount > 0 && (
                            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                          )}
                        </div>
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            onClick={markAllRead}
                            className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-semibold"
                          >
                            <CheckCheck size={12} />
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                        {notifLoading && (
                          <div className="px-4 py-6 text-sm text-gray-400 text-center">Loading...</div>
                        )}
                        {!notifLoading && notifError && (
                          <div className="px-4 py-4 text-sm text-red-600">{notifError}</div>
                        )}
                        {!notifLoading && !notifError && notifications.length === 0 && (
                          <div className="px-4 py-8 text-sm text-gray-400 text-center">
                            <Bell size={24} className="mx-auto text-gray-200 mb-2" />
                            No notifications yet
                          </div>
                        )}
                        {!notifLoading && !notifError && notifications.map((n) => {
                          const id = String(n?._id || n?.id || '');
                          const isRead = Boolean(n?.isRead);
                          return (
                            <button
                              key={id || n?.title}
                              type="button"
                              onClick={async () => {
                                await markRead(id);
                                setShowNotifications(false);
                                navigate(resolveNotifPath(n));
                              }}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${isRead ? '' : 'bg-amber-50/50'}`}
                            >
                              <div className="flex items-start gap-2">
                                {!isRead && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
                                <div className={!isRead ? '' : 'ml-3.5'}>
                                  <p className="text-sm font-medium text-gray-800 line-clamp-1">{n?.title || 'Notification'}</p>
                                  {n?.message && (
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                      {formatNotificationMessage(n.message)}
                                    </p>
                                  )}
                                  <p className="text-[11px] text-gray-400 mt-1">
                                    <span>{timeAgo(n?.createdAt)}</span>
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative" ref={profileRef}>
                  <button
                    className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-gray-100 active:scale-95 transition-all"
                    onClick={() => {
                      setShowNotifications(false);
                      toggleProfile();
                    }}
                    aria-label="Profile menu"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                      {initials}
                    </div>
                    <div className="hidden md:block text-left">
                      <p className="text-xs font-semibold text-gray-800 leading-tight">{parentName}</p>
                      <p className="text-[10px] text-gray-400">Parent</p>
                    </div>
                    <ChevronDown size={14} className={`hidden md:block text-gray-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden">
                      <div className="px-4 py-3 bg-gradient-to-br from-amber-50 to-yellow-50 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{parentName}</p>
                            <p className="text-[11px] text-gray-500">Parent</p>
                          </div>
                        </div>
                      </div>

                      <div className="py-1">
                        <button
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => { setProfileOpen(false); navigate('/parents'); }}
                        >
                          <User size={15} className="text-gray-400" />
                          Dashboard
                        </button>
                      </div>
                      <div className="border-t border-gray-100 py-1">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut size={15} className="text-red-400" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-2 sm:p-3">
          <Routes>
            <Route
              path="/"
              element={
                <ParentDashboard
                  parentName={parentProfile?.name}
                  childrenNames={Array.isArray(parentProfile?.children) ? parentProfile.children : []}
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
            <Route path="results" element={<ResultsView />} />
            <Route path="achievements" element={<AchievementsView />} />
          </Routes>
        </div>
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
