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
  X,
  Award,
  Sun,
  Video,
  Clock,
  ChevronLeft,
  Menu,
  ChevronRight,
  ChevronDown,
  CheckCheck,
  Home,
  LogOut,
  BarChart2,
  CalendarClock,
  Megaphone,
  MessageSquareHeart,
  FileBadge,
  NotebookPen,
  CalendarDays,
  UserCircle,
  FolderOpen,
  Search,
} from 'lucide-react';
import { useDesktopNotificationBridge } from '../hooks/useDesktopNotificationBridge';
import DesktopNotificationPermissionModal from '../components/DesktopNotificationPermissionModal';
import { AUTH_NOTICE, apiFetch, logoutAndRedirect } from '../utils/authSession';
import { useDialog } from './useDialog';
import './parentPortalDesign.css';
import TenantContext from '../context/TenantContext';
import { parentApiJson } from './parentApi';

const ParentDashboard = lazy(() => import('./ParentDashboard'));
const ChildGrowthAnalytics = lazy(() => import('./ChildGrowthAnalytics'));
const AcademicReport = lazy(() => import('./AcademicReport'));
const AttendanceReport = lazy(() => import('./AttendanceReport'));
const AchievementsView = lazy(() => import('./AchievementsView'));
const HealthReport = lazy(() => import('./HealthReport'));
const ClassRoutine = lazy(() => import('./ClassRoutine'));
const ExamRoutine = lazy(() => import('./ExamRoutine'));
const AdmitCardsView = lazy(() => import('../components/AdmitCardsView'));
const HolidayList = lazy(() => import('./HolidayList'));
const FeesPayment = lazy(() => import('./FeesPayment'));
const ParentChat = lazy(() => import('./ParentChat'));
const PTMPortal = lazy(() => import('./PTMPortal'));
const ComplaintManagementSystem = lazy(() => import('./ComplaintManagementSystem'));
const ParentObservationNonAcademic = lazy(() => import('./ParentObservationNonAcademic'));
const ExcuseLetters = lazy(() => import('./ExcuseLetters'));
const ParentNotices = lazy(() => import('./ParentNotices'));
const ParentTeacherFeedback = lazy(() => import('./ParentTeacherFeedback'));
const ParentHomework = lazy(() => import('./ParentHomework'));
const SchoolCalendar = lazy(() => import('./SchoolCalendar'));
const ChildProfile = lazy(() => import('./ChildProfile'));
const ParentDocuments = lazy(() => import('./ParentDocuments'));

const PortalRouteFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
    <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur-sm">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" aria-hidden="true" />
      Loading page…
    </div>
  </div>
);

// Navigation follows the parent's recommended access map: overview first,
// then the child's learning, exams, money, school info, communication and
// the child's own records. Everything is view-only except requests/messages.
const NAV_GROUPS = [
  // ─────────────────────────────────────────────
  // 1. OVERVIEW
  // ─────────────────────────────────────────────
  {
    heading: 'Overview',
    items: [
      {
        icon: Home,
        label: 'Dashboard',
        description: 'Overview & insights',
        path: '/parents',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 2. ACADEMICS
  // ─────────────────────────────────────────────
  {
    heading: 'Academics',
    items: [
      {
        icon: Calendar,
        label: 'Attendance',
        description: 'Daily record & attendance',
        path: '/parents/attendance',
      },
      {
        icon: NotebookPen,
        label: 'Homework',
        description: 'Assignments & due dates',
        path: '/parents/homework',
      },
      {
        icon: Clock,
        label: 'Class Routine',
        description: 'Weekly timetable',
        path: '/parents/routine',
      },
      {
        icon: BarChart2,
        label: 'Growth Analytics',
        description: 'Academic progress & insights',
        path: '/parents/analytics',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 3. EXAMS & RESULTS
  // ─────────────────────────────────────────────
  {
    heading: 'Exams & Results',
    items: [
      {
        icon: CalendarClock,
        label: 'Exam Schedule',
        description: 'Exam dates & routine',
        path: '/parents/exam-routine',
      },
      {
        icon: FileBadge,
        label: 'Admit Cards',
        description: 'Download exam admit cards',
        path: '/parents/admit-cards',
      },
      {
        icon: BookOpen,
        label: 'Results & Report Card',
        description: 'Marks, grades & report cards',
        path: '/parents/academic',
      },
      {
        icon: Award,
        label: 'Achievements',
        description: 'Awards, badges & milestones',
        path: '/parents/achievements',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 4. FEES & PAYMENTS
  // ─────────────────────────────────────────────
  {
    heading: 'Fees & Payments',
    items: [
      {
        icon: CreditCard,
        label: 'Fees & Payments',
        description: 'Dues, receipts & online payment',
        path: '/parents/fees',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 5. SCHOOL COMMUNICATION
  // ─────────────────────────────────────────────
  {
    heading: 'Annocements',
    items: [
      {
        icon: Megaphone,
        label: 'Notices',
        description: 'Announcements & circulars',
        path: '/parents/notices',
      },
      {
        icon: CalendarDays,
        label: 'School Calendar',
        description: 'School events & important dates',
        path: '/parents/calendar',
      },
      {
        icon: Sun,
        label: 'Holidays',
        description: 'School holiday list',
        path: '/parents/holidays',
      },
      {
        icon: MessageCircle,
        label: 'Messages',
        description: 'Talk to teachers & school',
        path: '/parents/chat',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 6. PARENT–SCHOOL CONNECT
  // ─────────────────────────────────────────────
  {
    heading: 'Communication',
    items: [
      {
        icon: Video,
        label: 'Meetings / PTM',
        description: 'Parent-teacher meetings',
        path: '/parents/ptm',
      },
      {
        icon: MessageSquareHeart,
        label: 'Teacher Feedback',
        description: 'Teacher feedback & responses',
        path: '/parents/teacher-feedback',
      },
      {
        icon: FileEdit,
        label: 'Observations',
        description: 'Share observations from home',
        path: '/parents/parent-observation',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 7. REQUESTS & SUPPORT
  // ─────────────────────────────────────────────
  {
    heading: 'Requests & Support',
    items: [
      {
        icon: FileText,
        label: 'Leave Letters',
        description: 'Submit absence requests',
        path: '/parents/excuse-letters',
      },
      {
        icon: AlertOctagon,
        label: 'Support & Complaints',
        description: 'Raise requests & track replies',
        path: '/parents/complaints',
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 8. CHILD INFORMATION
  // ─────────────────────────────────────────────
  {
    heading: 'Child Information',
    items: [
      {
        icon: UserCircle,
        label: 'Child Profile',
        description: 'School record & contacts',
        path: '/parents/profile',
      },
      {
        icon: FolderOpen,
        label: 'Documents',
        description: 'Reports, receipts & documents',
        path: '/parents/documents',
      },
      {
        icon: Activity,
        label: 'Health Record',
        description: 'Health & wellness information',
        path: '/parents/health',
      },
    ],
  },
];
// Mobile bottom-bar destinations. Everything else is one tap away via "More".
const BOTTOM_NAV = [
  { icon: Home, label: 'Dashboard', path: '/parents' },
  { icon: Calendar, label: 'Attendance', path: '/parents/attendance' },
  { icon: NotebookPen, label: 'Homework', path: '/parents/homework' },
  { icon: CreditCard, label: 'Fees', path: '/parents/fees' },
];

const ParentPortal = () => {
  const prefersReducedMotion = useReducedMotion();
  const [sidebarOpen, setSidebarOpen] = useState(() => (
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  ));
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches
  ));
  const [parentProfile, setParentProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => (
    Object.fromEntries(
      NAV_GROUPS
        .filter((group) => group.heading && group.heading !== 'Overview')
        .map((group) => [group.heading, false])
    )
  ));
  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef(null);
  const notificationsRef = useRef(null);
  const logoutDialogRef = useDialog(showLogoutConfirm, () => setShowLogoutConfirm(false));
  const notifSheetRef = useDialog(showNotifications && !isDesktop, () => setShowNotifications(false));
  const mobileMenuRef = useDialog(mobileMenuOpen, () => setMobileMenuOpen(false));
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  // School branding for the sidebar: tenant (subdomain) first, else the
  // school block the parent exam-schedule API already returns.
  const tenant = React.useContext(TenantContext); // optional: null outside a TenantProvider
  const [fetchedSchool, setFetchedSchool] = useState(null);
  const tenantIsDefault = !tenant?.logo && (!tenant?.name || tenant.name === 'Electronic Educare');
  useEffect(() => {
    if (!tenantIsDefault || !parentProfile || !localStorage.getItem('token')) return undefined;
    let cancelled = false;
    parentApiJson('/api/exam/groups/parent-schedule')
      .then((data) => { if (!cancelled && data?.school) setFetchedSchool({ name: data.school.name || '', logo: data.school.logo || '' }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tenantIsDefault, parentProfile]);
  const schoolBrand = tenantIsDefault ? (fetchedSchool || { name: '', logo: '' }) : { name: tenant.name, logo: tenant.logo };
  const schoolInitials = String(schoolBrand.name || '').trim().split(/\s+/).filter(Boolean)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase()).filter(Boolean).join('.');
  const headerSearchRef = useRef(null);
  const [headerSearch, setHeaderSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [headerNow, setHeaderNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setHeaderNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const close = (e) => { if (headerSearchRef.current && !headerSearchRef.current.contains(e.target)) setShowSearchResults(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const searchMatches = useMemo(() => {
    const q = headerSearch.trim().toLowerCase();
    if (!q) return [];
    return NAV_GROUPS.flatMap((g) => g.items)
      .filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [headerSearch]);

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
      setIsDesktop(event.matches);
      setProfileOpen(false);
      setShowNotifications(false);
      setMobileMenuOpen(false);
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
  const isNavActive = (path) => {
    const target = normalizePath(path);
    if (target === '/parents') return currentPath === target;
    return currentPath === target || currentPath.startsWith(`${target}/`);
  };
  const toggleGroup = (heading) => {
    setOpenGroups((prev) => ({
      ...prev,
      [heading]: !prev[heading],
    }));
  };

  useEffect(() => {
    const activeGroup = NAV_GROUPS.find(
      (group) =>
        group.heading &&
        group.heading !== 'Overview' &&
        group.items.some((item) => isNavActive(item.path))
    );

    if (activeGroup) {
      setOpenGroups((prev) => ({
        ...prev,
        [activeGroup.heading]: true,
      }));
    }
  }, [currentPath]);
  const goTo = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
    setShowNotifications(false);
    setProfileOpen(false);
  };
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
  const parentAvatar = parentProfile?.profileImage
    || parentProfile?.profilePhoto
    || parentProfile?.photo
    || parentProfile?.avatar
    || parentProfile?.image
    || '';
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
      const res = await apiFetch(`${API_BASE}/api/notifications/user?kind=notification`, {
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
      const res = await apiFetch(`${API_BASE}/api/notifications/user/read-all?kind=notification`, {
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
  }, [showNotifications]);

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
    if (String(notification?.typeLabel || '').toLowerCase().startsWith('feedback_')
      || String(notification?.eventType || '').startsWith('FEEDBACK_WINDOW')) return '/parents/teacher-feedback';
    if (blob.includes('analytics') || blob.includes('growth')) return '/parents/analytics';
    if (blob.includes('achievement')) return '/parents/achievements';
    if (blob.includes('attendance')) return '/parents/attendance';
    if (blob.includes('academic') || blob.includes('assignment')) return '/parents/academic';
    if (blob.includes('fee') || blob.includes('payment')) return '/parents/fees';
    if (blob.includes('health') || blob.includes('wellbeing')) return '/parents/health';
    if (blob.includes('complaint') || blob.includes('issue')) return '/parents/complaints';
    if (blob.includes('meeting') || blob.includes('ptm')) return '/parents/ptm';
    if (
      (blob.includes('exam') || blob.includes('examination')) &&
      (blob.includes('routine') || blob.includes('schedule') || blob.includes('date sheet') || blob.includes('datesheet'))
    ) return '/parents/exam-routine';
    if (blob.includes('result') || blob.includes('exam')) return '/parents/academic';
    if (blob.includes('chat') || blob.includes('message')) return '/parents/chat';
    if (blob.includes('holiday')) return '/parents/holidays';
    if (blob.includes('routine') || blob.includes('timetable') || blob.includes('schedule') || blob.includes('period')) return '/parents/routine';
    if (blob.includes('observation')) return '/parents/parent-observation';
    if (blob.includes('excuse') || blob.includes('leave request')) return '/parents/excuse-letters';
    return '/parents';
  }, []);

  // Unread notifications bucketed by the sidebar destination they resolve to,
  // so every nav button can show its own count (e.g. a routine update → "1").
  const sectionBadges = useMemo(() => {
    const counts = {};
    notifications.forEach((item) => {
      if (!item || item.isRead) return;
      const path = normalizePath(resolveNotifPath(item));
      if (!path || path === '/parents') return;
      counts[path] = (counts[path] || 0) + 1;
    });
    return counts;
  }, [notifications, resolveNotifPath]);

  const badgeFor = useCallback(
    (path) => sectionBadges[normalizePath(path)] || 0,
    [sectionBadges],
  );

  // Visiting a section clears its badge by marking those notifications read.
  useEffect(() => {
    if (currentPath === '/parents') return;
    const stale = notifications.filter(
      (item) => item && !item.isRead && normalizePath(resolveNotifPath(item)) === currentPath,
    );
    if (stale.length === 0) return;
    stale.forEach((item) => {
      const id = String(item?._id || item?.id || '');
      if (id) markRead(id);
    });
  }, [currentPath, notifications, resolveNotifPath, markRead]);
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
      {/* Desktop sidebar only — same layout as the school admin sidebar, in the
          parent portal's violet. On mobile the app bar + bottom nav take over. */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`parent-sidebar fixed inset-y-0 left-0 z-50 flex h-dvh shrink-0 flex-col border-r border-gray-100 bg-white shadow-2xl transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:z-30 lg:shadow-lg
          ${sidebarOpen
            ? 'translate-x-0 w-72 lg:w-64'
            : '-translate-x-full lg:translate-x-0 lg:w-[72px]'}`}
        aria-label="Sidebar navigation"
      >
        {/* ── Brand header ── */}
        <div className="relative flex items-center gap-3 border-b border-gray-100 px-4 py-3 bg-indigo-50">
          <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-300 ${sidebarOpen ? 'h-10 w-10' : 'h-9 w-9'} ${schoolBrand.logo ? '' : 'bg-linear-to-br from-violet-600 to-violet-500 text-white shadow-sm'}`}>
            {schoolBrand.logo ? (
              <img src={schoolBrand.logo} alt={schoolBrand.name || 'School logo'} className="h-full w-full object-cover" />
            ) : (
              <Users size={sidebarOpen ? 20 : 18} />
            )}
          </div>
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight text-gray-900">Parent Portal</p>
              <p className="mt-0.5 truncate text-[11px] font-semibold tracking-wide text-violet-500" title={schoolBrand.name || undefined}>
                {schoolInitials || 'Your school'}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className={`flex shrink-0 items-center justify-center transition-all duration-200 ${
              sidebarOpen
                ? 'h-7 w-7 rounded-lg text-gray-400 hover:bg-violet-50 hover:text-violet-600'
                : 'absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-violet-600 text-white shadow-md hover:bg-violet-700'
            }`}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft size={15} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="modern-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2 py-3">
          {NAV_GROUPS.map((group, groupIndex) => {
            const isDashboard = group.heading === 'Overview';
            const isOpen = Boolean(openGroups[group.heading]);
            const groupHasActiveItem = group.items.some((item) => isNavActive(item.path));

            if (isDashboard) {
              const item = group.items[0];
              const Icon = item.icon;
              const badgeCount = badgeFor(item.path);
              const isActive = isNavActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={handleMenuClick}
                  aria-current={isActive ? 'page' : undefined}
                  title={!sidebarOpen ? item.label : undefined}
                  className={`group relative flex items-center gap-3 rounded-full px-3 py-2.5 transition-all duration-200 ${sidebarOpen ? '' : 'justify-center'} ${isActive ? 'bg-violet-50 text-violet-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                  <span className="relative z-10 shrink-0">
                    <span className={`flex rounded-full p-1.5 transition-colors ${isActive ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-violet-50 group-hover:text-violet-500'}`}>
                      <Icon size={17} />
                    </span>
                    {!sidebarOpen && badgeCount > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </span>
                  {sidebarOpen && (
                    <span className={`relative z-10 flex-1 truncate text-sm ${isActive ? 'font-bold' : 'font-semibold'}`}>
                      {item.label}
                    </span>
                  )}
                  {sidebarOpen && badgeCount > 0 && (
                    <span className="relative z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </Link>
              );
            }

            const GroupIcon = group.items[0]?.icon || FolderOpen;

            return (
              <div key={group.heading} className="space-y-1">
                {groupIndex > 1 && !sidebarOpen && (
                  <div className="mx-3 my-1 border-t border-gray-100" aria-hidden="true" />
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (!sidebarOpen) {
                      setSidebarOpen(true);
                      setOpenGroups((prev) => ({ ...prev, [group.heading]: true }));
                    } else {
                      toggleGroup(group.heading);
                    }
                  }}
                  title={!sidebarOpen ? group.heading : undefined}
                  aria-expanded={sidebarOpen ? isOpen : undefined}
                  className={`group relative flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-left transition-all duration-200 ${sidebarOpen ? '' : 'justify-center'} ${groupHasActiveItem ? 'bg-violet-50/70 text-violet-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                  <span className={`flex shrink-0 rounded-full p-1.5 transition-colors ${groupHasActiveItem ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-violet-50 group-hover:text-violet-500'}`}>
                    <GroupIcon size={17} />
                  </span>

                  {sidebarOpen && (
                    <>
                      <span className={`flex-1 truncate text-sm ${groupHasActiveItem ? 'font-bold' : 'font-semibold'}`}>
                        {group.heading}
                      </span>
                      <ChevronDown size={15} className={`shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-violet-500' : ''}`} />
                    </>
                  )}
                </button>

                {sidebarOpen && isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
                    className="ml-4 overflow-hidden border-l border-violet-100 pl-2"
                  >
                    <div className="space-y-0.5 py-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const badgeCount = badgeFor(item.path);
                        const isActive = isNavActive(item.path);

                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={handleMenuClick}
                            aria-current={isActive ? 'page' : undefined}
                            className={`group relative flex items-center gap-2.5 rounded-full px-3 py-2 transition-all duration-150 ${isActive ? 'bg-violet-100 text-violet-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
                          >
                            <span className={`flex shrink-0 rounded-full p-1 ${isActive ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:text-violet-500'}`}>
                              <Icon size={14} />
                            </span>
                            <span className={`min-w-0 flex-1 truncate text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>
                              {item.label}
                            </span>
                            {badgeCount > 0 && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                                {badgeCount > 9 ? '9+' : badgeCount}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── Footer: account + logout ── */}
        <div className="shrink-0 border-t border-gray-100 p-3 bg-gray-50">
          <div className={`flex items-center gap-3 ${sidebarOpen ? '' : 'flex-col'}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-violet-600 to-violet-400 text-xs font-bold text-white">
              {initials}
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{parentName}</p>
                <p className="truncate text-[11px] text-gray-500">Parent</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={17} />
              <span className="sr-only">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col h-screen bg-slate-50">
        {/* Desktop header — same layout as the school admin header (module
            search, clock, notifications, profile), in the parent violet. */}
        <div className="sticky top-0 z-30 hidden shrink-0 lg:block">
          <div className="flex items-center gap-3 border-b border-white/70 bg-violet-50 px-5 py-2 shadow-[0_16px_44px_-12px_rgba(15,23,42,0.10),0_4px_12px_rgba(15,23,42,0.04)] backdrop-blur-xl">
            {/* Module search */}
            <div className="relative max-w-md flex-1" ref={headerSearchRef}>
              <form
                className="flex w-full items-center gap-2 rounded-full border border-gray-300/70 bg-white py-0.5 pl-4 pr-1.5 transition focus-within:border-violet-300 focus-within:shadow-[0_4px_16px_rgba(15,23,42,0.05)]"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchMatches[0]) { goTo(searchMatches[0].path); setHeaderSearch(''); }
                }}
              >
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={headerSearch}
                  onChange={(e) => { setHeaderSearch(e.target.value); setShowSearchResults(true); }}
                  onFocus={() => setShowSearchResults(true)}
                  placeholder="Search modules…"
                  aria-label="Search modules"
                  className="admin-search-input w-full border-none bg-transparent py-2 text-sm font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
                />
                {headerSearch && (
                  <button type="button" onClick={() => setHeaderSearch('')} className="shrink-0 pr-1 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                    <X size={14} />
                  </button>
                )}
              </form>
              {showSearchResults && headerSearch.trim() && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-white/60 bg-white/95 shadow-xl backdrop-blur-xl">
                  {searchMatches.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400">No results</p>
                  ) : (
                    <ul className="divide-y divide-slate-50">
                      {searchMatches.map((item) => (
                        <li key={item.path}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { goTo(item.path); setHeaderSearch(''); setShowSearchResults(false); }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-violet-50/70"
                          >
                            <item.icon size={15} className="shrink-0 text-violet-400" />
                            <span>
                              <span className="block text-sm font-medium text-slate-800">{item.label}</span>
                              <span className="block text-[11px] text-slate-400">{item.description}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {/* Live clock */}
              <div className="hidden items-center gap-2 rounded-full border border-white/30 bg-white/40 px-3.5 py-1.5 text-sm font-medium text-slate-900 xl:flex">
                <Clock size={14} className="shrink-0 text-slate-400" />
                <span className="whitespace-nowrap tabular-nums">{headerNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-slate-400">{headerNow.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </div>

              {/* Notifications */}
              <div className="relative">
                <button
                  data-notification-control
                  type="button"
                  onClick={handleToggleNotifications}
                  aria-expanded={showNotifications}
                  aria-label="Open notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/40 text-slate-600 transition hover:border-white/60 hover:bg-white/80"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {isDesktop && showNotifications && (
                  <section ref={notificationsRef} aria-label="Notifications panel" className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
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
                    <div className="max-h-[60dvh] divide-y divide-gray-100 overflow-y-auto overscroll-contain" aria-live="polite">
                      {notifLoading && <p className="px-4 py-5 text-center text-xs text-gray-500">Loading notifications…</p>}
                      {!notifLoading && notifError && <p role="alert" className="px-4 py-4 text-xs text-red-600">{notifError}</p>}
                      {!notifLoading && !notifError && notifications.length === 0 && <p className="px-4 py-5 text-center text-xs text-gray-500">No notifications yet</p>}
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
                            }}
                            className={`w-full px-4 py-3 text-left transition hover:bg-violet-50 ${isRead ? 'bg-white' : 'bg-violet-50/60'}`}
                          >
                            <span className="flex items-start gap-2">
                              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isRead ? 'bg-gray-200' : 'bg-violet-500'}`} />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-gray-800">{notification?.title || 'Notification'}</span>
                                {notification?.message && <span className="mt-0.5 block line-clamp-2 text-xs text-gray-500">{formatNotificationMessage(notification.message)}</span>}
                                <span className="mt-1 block text-[10px] text-gray-400">{timeAgo(notification?.createdAt)}</span>
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>

              {/* Profile pill */}
              <div className="relative">
                <button
                  data-profile-control
                  type="button"
                  onClick={() => { setProfileOpen((open) => !open); setShowNotifications(false); }}
                  aria-expanded={profileOpen}
                  aria-label="Profile"
                  className="flex items-center gap-2.5 rounded-full border border-white/30 bg-white/40 py-1 pl-1.5 pr-3 transition hover:border-white/50 hover:bg-white/70 active:scale-[0.98]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-violet-600 to-violet-400 text-xs font-semibold text-white shadow-sm ring-2 ring-white/70">
                    {initials}
                  </span>
                  <span className="flex min-w-0 flex-col text-left leading-tight">
                    <span className="whitespace-nowrap text-sm font-semibold text-slate-900">{parentName}</span>
                    <span className="text-[10px] font-medium tracking-wide text-slate-500">
                      {childrenCount ? `Parent · ${childrenCount} ${wardLabel}` : 'Parent'}
                    </span>
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>
                {profileOpen && (
                  <section ref={profileRef} aria-label="Profile panel" className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-violet-100 bg-white p-2 shadow-2xl">
                    <div className="flex items-center gap-3 border-b border-gray-100 px-2 pb-3 pt-1">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-violet-400 text-sm font-bold text-white">{initials}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-gray-900">{parentName}</span>
                        <span className="block text-[11px] text-gray-500">{childrenCount ? `${childrenCount} ${wardLabel}` : 'Parent account'}</span>
                      </span>
                    </div>
                    <button type="button" onClick={() => goTo('/parents/profile')} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-violet-50">
                      <UserCircle size={16} className="text-violet-600" /> Child Profile
                    </button>
                    <button type="button" onClick={() => goTo('/parents/documents')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-violet-50">
                      <FolderOpen size={16} className="text-violet-600" /> Documents
                    </button>
                    <button type="button" onClick={() => { setProfileOpen(false); handleLogout(); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">
                      <LogOut size={16} /> Sign out
                    </button>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile / tablet app bar */}
        <header className="lg:hidden sticky top-0 z-40 shrink-0 border-b border-slate-200/80 bg-white/95 px-3 py-2.5 text-slate-900 shadow-[0_6px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          <div className="flex min-h-11 items-center gap-2">
            <button
              type="button"
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              aria-expanded={sidebarOpen}
              onClick={() => {
                setSidebarOpen((open) => !open);
                setMobileMenuOpen(false);
                setShowNotifications(false);
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-violet-50 hover:text-violet-600 active:scale-95"
            >
              <Menu className="h-5 w-5" />
            </button>

            {!mobileSearchOpen ? (
              <div className="flex w-full items-center justify-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-end overflow-hidden rounded-full">
                  {schoolBrand.logo ? (
                    <img
                      src={schoolBrand.logo}
                      alt={schoolBrand.name || 'School logo'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Users className="h-4.5 w-4.5 text-violet-600" />
                  )}
                </div>
                <div className="w-full flex flex-col gap-0.5 justify-center items-center">
                  <p className="truncate text-[15px] font-bold leading-tight text-slate-900">Parent Portal</p>
                  <p className="truncate text-[10px] font-semibold tracking-wide text-violet-500">
                    {schoolInitials || schoolBrand.name || 'Your school'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative min-w-0 flex-1" ref={headerSearchRef}>
                <form
                  className="flex h-10 w-full items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/70 px-3 shadow-sm focus-within:border-violet-400 focus-within:bg-white"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (searchMatches[0]) {
                      goTo(searchMatches[0].path);
                      setHeaderSearch('');
                      setShowSearchResults(false);
                      setMobileSearchOpen(false);
                    }
                  }}
                >
                  <Search className="h-4 w-4 shrink-0 text-violet-500" />
                  <input
                    autoFocus
                    type="text"
                    value={headerSearch}
                    onChange={(e) => {
                      setHeaderSearch(e.target.value);
                      setShowSearchResults(true);
                    }}
                    onFocus={() => setShowSearchResults(true)}
                    placeholder="Search modules…"
                    aria-label="Search modules"
                    className="w-full min-w-0 border-none bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
                  />
                </form>

                {showSearchResults && headerSearch.trim() && (
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[80] max-h-72 overflow-y-auto rounded-2xl border border-violet-100 bg-white shadow-2xl">
                    {searchMatches.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-400">No results</p>
                    ) : (
                      <ul className="divide-y divide-slate-50">
                        {searchMatches.map((item) => (
                          <li key={item.path}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                goTo(item.path);
                                setHeaderSearch('');
                                setShowSearchResults(false);
                                setMobileSearchOpen(false);
                              }}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-violet-50/70"
                            >
                              <item.icon size={16} className="shrink-0 text-violet-500" />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-slate-800">{item.label}</span>
                                <span className="block truncate text-[11px] text-slate-400">{item.description}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex shrink-0 items-center gap-1">
              {mobileSearchOpen ? (
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => {
                    setMobileSearchOpen(false);
                    setHeaderSearch('');
                    setShowSearchResults(false);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 active:scale-95"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Search"
                  onClick={() => {
                    setMobileSearchOpen(true);
                    setShowNotifications(false);
                    setMobileMenuOpen(false);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-violet-50 hover:text-violet-600 active:scale-95"
                >
                  <Search className="h-5 w-5" />
                </button>
              )}

              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={showNotifications}
                onClick={() => {
                  setShowNotifications((v) => !v);
                  setMobileMenuOpen(false);
                  setMobileSearchOpen(false);
                  setHeaderSearch('');
                  setShowSearchResults(false);
                }}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-violet-50 hover:text-violet-600 active:scale-95"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        <main id="parent-main-content" className="parent-route-canvas flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-violet-50/30 p-0 sm:p-3">
          <div className="h-full min-h-full sm:bg-white/40 sm:backdrop-blur-sm">
          <Suspense fallback={<PortalRouteFallback />}>
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
            <Route path="notices" element={<ParentNotices />} />
            <Route path="teacher-feedback" element={<ParentTeacherFeedback />} />
            <Route path="routine" element={<ClassRoutine />} />
            <Route path="exam-routine" element={<ExamRoutine />} />
            <Route path="admit-cards" element={<AdmitCardsView mode="parent" />} />
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
            <Route path="homework" element={<ParentHomework />} />
            <Route path="calendar" element={<SchoolCalendar />} />
            <Route path="profile" element={<ChildProfile />} />
            <Route path="documents" element={<ParentDocuments />} />
            <Route path="*" element={<Navigate to="/parents" replace />} />
          </Routes>
          </Suspense>
          </div>
        </main>

        {/* Mobile bottom navigation */}
        <nav aria-label="Primary" className="lg:hidden shrink-0 border-t border-slate-200/80 bg-white/95 px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] backdrop-blur-md">
          <div className="mx-auto flex max-w-md items-center justify-around">
            {BOTTOM_NAV.map(({ icon: Icon, label, path }) => {
              const active = isNavActive(path);
              const badgeCount = badgeFor(path);
              return (
                <button
                  key={path}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => goTo(path)}
                  className={`flex flex-col items-center rounded-xl px-3 py-1 transition active:scale-95 ${active ? 'font-semibold text-violet-600' : 'font-medium text-slate-400'}`}
                >
                  <span className={`relative mb-0.5 flex h-8 w-8 items-center justify-center rounded-full ${active ? 'bg-violet-600 text-white' : ''}`}>
                    <Icon className="h-5 w-5" />
                    {badgeCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px]">{label}</span>
                </button>
              );
            })}
            <button
              type="button"
              aria-label="Profile"
              aria-current={isNavActive('/parents/profile') ? 'page' : undefined}
              onClick={() => goTo('/parents/profile')}
              className={`flex flex-col items-center rounded-xl px-3 py-1 transition active:scale-95 ${isNavActive('/parents/profile') ? 'font-semibold text-violet-600' : 'font-medium text-slate-400'}`}
            >
              <span className={`relative mb-0.5 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ${isNavActive('/parents/profile') ? 'bg-violet-100 ring-2 ring-violet-200' : 'bg-slate-100'}`}>
                {parentAvatar ? (
                  <img src={parentAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className={`text-[11px] font-bold ${isNavActive('/parents/profile') ? 'text-violet-600' : 'text-slate-500'}`}>
                    {initials}
                  </span>
                )}
              </span>
              <span className="text-[10px]">Profile</span>
            </button>
          </div>
        </nav>

        {/* Mobile menu sheet — full navigation + account + logout */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-[120]">
            <motion.button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
            />
            <motion.div
              ref={mobileMenuRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              tabIndex={-1}
              className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none"
              initial={{ y: prefersReducedMotion ? 0 : '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            >
              <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-slate-200" aria-hidden="true" />
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-violet-400 text-sm font-bold text-white">{initials}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{parentName}</p>
                    <p className="text-xs text-slate-500">{childrenCount ? `${childrenCount} ${wardLabel}` : 'Parent account'}</p>
                  </div>
                </div>
                <button type="button" aria-label="Close" onClick={() => setMobileMenuOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                {NAV_GROUPS.map((group) => {
                  const isDashboard = group.heading === 'Overview';
                  const isOpen = Boolean(openGroups[group.heading]);
                  const groupHasActiveItem = group.items.some((item) => isNavActive(item.path));

                  if (isDashboard) {
                    const item = group.items[0];
                    const Icon = item.icon;
                    const active = isNavActive(item.path);
                    return (
                      <button key={item.path} type="button" onClick={() => goTo(item.path)} aria-current={active ? 'page' : undefined} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-violet-600' : 'text-slate-400'}`} />
                        <span className="text-sm font-semibold">{item.label}</span>
                      </button>
                    );
                  }

                  const GroupIcon = group.items[0]?.icon || FolderOpen;
                  return (
                    <div key={group.heading} className="mb-1">
                      <button type="button" onClick={() => toggleGroup(group.heading)} aria-expanded={isOpen} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${groupHasActiveItem ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${groupHasActiveItem ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          <GroupIcon size={17} />
                        </span>
                        <span className="flex-1 text-sm font-semibold">{group.heading}</span>
                        <ChevronDown size={17} className={`transition-transform ${isOpen ? 'rotate-180 text-violet-600' : 'text-slate-400'}`} />
                      </button>

                      {isOpen && (
                        <div className="ml-5 mt-1 space-y-1 border-l border-violet-100 pl-3">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            const active = isNavActive(item.path);
                            const badgeCount = badgeFor(item.path);
                            return (
                              <button key={item.path} type="button" onClick={() => goTo(item.path)} aria-current={active ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${active ? 'bg-violet-100 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-violet-600' : 'text-slate-400'}`} />
                                <span className={`min-w-0 flex-1 truncate text-sm ${active ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                                {badgeCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[10px] font-bold text-white">{badgeCount > 9 ? '9+' : badgeCount}</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
              <div className="border-t border-slate-100 px-5 py-3">
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-3 text-sm font-bold text-red-600 active:scale-[0.98]"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Mobile notifications sheet */}
        {showNotifications && !isDesktop && (
          <div className="lg:hidden fixed inset-0 z-[130]">
            <motion.button
              type="button"
              aria-label="Close notifications"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowNotifications(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
            />
            <motion.div
              ref={notifSheetRef}
              role="dialog"
              aria-modal="true"
              aria-label="Notifications"
              tabIndex={-1}
              className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none"
              initial={{ y: prefersReducedMotion ? 0 : '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            >
              <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-slate-200" aria-hidden="true" />
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-violet-600" />
                  <span className="text-sm font-bold text-slate-900">Notifications</span>
                  {unreadCount > 0 && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">{unreadCount}</span>}
                </div>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600">
                      <CheckCheck size={12} /> Mark all read
                    </button>
                  )}
                  <button type="button" aria-label="Close" onClick={() => setShowNotifications(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto" aria-live="polite">
                {notifLoading && <p className="px-5 py-6 text-center text-xs text-slate-500">Loading notifications…</p>}
                {!notifLoading && notifError && <p role="alert" className="px-5 py-5 text-xs text-red-600">{notifError}</p>}
                {!notifLoading && !notifError && notifications.length === 0 && <p className="px-5 py-8 text-center text-xs text-slate-500">No notifications yet</p>}
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
                      }}
                      className={`flex w-full items-start gap-2 px-5 py-3 text-left ${isRead ? 'bg-white' : 'bg-violet-50/60'}`}
                    >
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isRead ? 'bg-slate-200' : 'bg-violet-500'}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-800">{notification?.title || 'Notification'}</span>
                        {notification?.message && <span className="mt-0.5 block line-clamp-2 text-[11px] text-slate-500">{formatNotificationMessage(notification.message)}</span>}
                        <span className="mt-1 block text-[10px] text-slate-400">{timeAgo(notification?.createdAt)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
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



