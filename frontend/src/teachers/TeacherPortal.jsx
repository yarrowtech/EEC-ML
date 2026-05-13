import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  Users,
  Activity,
  Calendar,
  Bell,
  FileText,
  ClipboardCheck,
  Menu,
  X,
  UserCheck,
  Home,
  BookOpen,
  MessageSquare,
  BarChart3,
  AlertTriangle,
  Brain,
  Briefcase,
  Clock,
  Eye,
  LogOut,
  CheckCheck,
  ThumbsUp,
  ChevronDown,
  ChevronRight,
  User,
  CalendarDays,
  GraduationCap,
  Award,
} from 'lucide-react';

import HealthUpdatesAdvanced from './HealthUpdatesAdvanced';
import ParentMeetings from './ParentMeetings';
import AssignmentPortal from './AssignmentPortal';
import AttendanceManagement from './AttendanceManagement';
import TeacherDashboard from './TeacherDashboard';
import LessonPlanDashboard from './LessonPlanDashboard';
import SmartTeachingLessonPlanner from './SmartTeachingLessonPlanner';
import LessonPlannerWizard from './components/LessonPlannerWizard';
import TeacherChat from './TeacherChat';
import StudentAnalyticsPortal from './StudentAnalyticsPortal';
import AILearningPath from './AILearningPath';
import TestTeacherPortal from './TestTeacherPortal';
import AIPoweredTeaching from './AIPoweredTeaching';
import MyWorkPortal from './MyWorkPortal';
import ClassRoutine from './ClassRoutine';
import StudentObservationOverview from './StudentObservationOverview';
import ClassNotes from './ClassNotes';
import PracticeQuestions from './PracticeQuestions';
import TeacherFeedbackPortal from './TeacherFeedbackPortal';
import ExcuseLetters from './ExcuseLetters';
import ResultManagement from './ResultManagement';
import HolidayList from './HolidayList';
import TeacherAchievements from './TeacherAchievements';
import TeacherAlcove from './TeacherAlcove';
import { useDesktopNotificationBridge } from '../hooks/useDesktopNotificationBridge';
import DesktopNotificationPermissionModal from '../components/DesktopNotificationPermissionModal';
import { AUTH_NOTICE, apiFetch, logoutAndRedirect } from '../utils/authSession';

const PORTAL_BASE = '/teacher';
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const menuSections = [
  {
    id: 'overview',
    label: 'Overview',
    icon: Home,
    children: [
      { icon: Home, label: 'Dashboard', path: `${PORTAL_BASE}/dashboard` },
      { icon: Briefcase, label: 'My Work Portal', path: `${PORTAL_BASE}/my-work-portal` },
      { icon: Clock, label: 'Class Routine', path: `${PORTAL_BASE}/class-routine` },
      { icon: CalendarDays, label: 'Holiday List', path: `${PORTAL_BASE}/holidays` },
    ],
  },
  {
    id: 'students',
    label: 'Student Management',
    icon: Users,
    children: [
      { icon: UserCheck, label: 'Attendance', path: `${PORTAL_BASE}/attendance` },
      { icon: Award, label: 'Achievements', path: `${PORTAL_BASE}/achievements` },
      // { icon: BarChart3, label: 'Student Analytics', path: `${PORTAL_BASE}/student-analytics` },
      { icon: Activity, label: 'Student Health Updates', path: `${PORTAL_BASE}/health-updates` },
      { icon: Eye, label: 'Student Observations', path: `${PORTAL_BASE}/student-observations` },
    ],
  },
  {
    id: 'teaching',
    label: 'Teaching Tools',
    icon: BookOpen,
    children: [
      { icon: Brain, label: 'Smart Teaching', path: `${PORTAL_BASE}/smart-teaching` },
      { icon: BookOpen, label: "Teacher's Wall", path: `${PORTAL_BASE}/academic-alcove` },
      { icon: FileText, label: 'Assignments', path: `${PORTAL_BASE}/assignments` },
      { icon: FileText, label: 'Practice Questions', path: `${PORTAL_BASE}/practice-questions` },
      { icon: BookOpen, label: 'Lesson Plans', path: `${PORTAL_BASE}/lesson-plans` },
      { icon: FileText, label: 'Class Notes', path: `${PORTAL_BASE}/class-notes` },
    ],
  },
  {
    id: 'assessment',
    label: 'Assessment',
    icon: GraduationCap,
    children: [
      { icon: ClipboardCheck, label: 'Result Management', path: `${PORTAL_BASE}/result-management` },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: MessageSquare,
    children: [
      { icon: MessageSquare, label: 'Chat', path: `${PORTAL_BASE}/chat` },
      { icon: Calendar, label: 'Parent Meetings', path: `${PORTAL_BASE}/parent-meetings` },
      { icon: FileText, label: 'Excuse Letters', path: `${PORTAL_BASE}/excuse-letters` },
      { icon: ThumbsUp, label: 'Student Feedback', path: `${PORTAL_BASE}/feedback` },
    ],
  },
];

const TeacherPortal = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isChatRoute = location.pathname.startsWith('/teacher/chat');
  const isSmartPlannerRoute = location.pathname.startsWith('/teacher/smart-teaching/lesson-planner');

  useEffect(() => {
    if (!location.pathname.startsWith('/teachers')) return;
    const canonicalPath = location.pathname.replace('/teachers', '/teacher');
    navigate(canonicalPath, { replace: true });
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
      return;
    }
    setSidebarOpen(true);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen || window.innerWidth >= 1024) return undefined;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const isItemActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  useEffect(() => {
    const activeSection = menuSections.find((section) =>
      section.children.some((item) => isItemActive(item.path))
    );
    if (!activeSection) return;
    setOpenGroups((prev) => ({ ...prev, [activeSection.id]: true }));
  }, [location.pathname]);

  const menuItems = useMemo(
    () => menuSections.flatMap((section) => section.children),
    []
  );

  const activePageTitle = useMemo(() => {
    const active = menuItems.find(
      (item) => isItemActive(item.path)
    );
    return active?.label || 'Teacher Portal';
  }, [location.pathname, menuItems]);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logoutAndRedirect({ navigate, notice: AUTH_NOTICE.LOGGED_OUT });
  };

  // Teacher profile state for header
  const [teacherProfile, setTeacherProfile] = useState({ name: '', profilePic: '', department: '' });
  const [profileOpen, setProfileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');
  const profileRef = useRef(null);
  const notificationsRef = useRef(null);

  // Fetch teacher profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/teacher/auth/profile`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        setTeacherProfile({
          name: data.name || '',
          profilePic: data.profilePic || '',
          department: data.department || '',
        });
      } catch { /* ignore */ }
    };
    loadProfile();
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleProfile = useCallback(() => {
    setProfileOpen((prev) => !prev);
  }, []);

  // Greeting and date
  const { greeting, dateLabel } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const g = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const d = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    return { greeting: g, dateLabel: d };
  }, []);

  const nameParts = (teacherProfile.name || '').trim().split(/\s+/).filter(Boolean);
  const teacherFirstName = nameParts[0] || 'Teacher';
  const teacherFirstLastName = nameParts.length >= 2
    ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
    : (nameParts[0] || 'Teacher');
  const initialsLabel = (nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : (nameParts[0]?.[0] || 'T')
  ).toUpperCase();
  const hasProfileImage = typeof teacherProfile.profilePic === 'string' && teacherProfile.profilePic.trim() !== '';
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
  }, [navigate]);

  useEffect(() => {
    fetchNotifs();
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifs();
    }, 15_000);
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
  }, [fetchNotifs, navigate]);

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
  }, [fetchNotifs, navigate]);

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
    if (blob.includes('substitute')) return '/teacher/attendance';
    if (blob.includes('assignment')) return '/teacher/assignments';
    if (blob.includes('result') || blob.includes('exam')) return '/teacher/result-management';
    if (blob.includes('attendance')) return '/teacher/attendance';
    if (blob.includes('meeting') || blob.includes('parent')) return '/teacher/parent-meetings';
    if (blob.includes('feedback')) return '/teacher/feedback';
    if (blob.includes('wall') || blob.includes('alcove') || blob.includes('problem library')) return '/teacher/academic-alcove';
    if (blob.includes('chat') || blob.includes('message')) return '/teacher/chat';
    if (blob.includes('health') || blob.includes('wellbeing')) return '/teacher/health-updates';
    return '/teacher/dashboard';
  }, []);
  const {
    showPermissionModal,
    pendingCount,
    syncNotifications,
    requestPermissionFromModal,
    dismissPermissionModal,
  } = useDesktopNotificationBridge({
    scopeKey: 'teacher',
    resolvePath: resolveNotifPath,
    appName: 'Teacher Portal',
  });

  useEffect(() => {
    syncNotifications(notifications);
  }, [notifications, syncNotifications]);

  return (
    <>
    <div className="min-h-screen bg-slate-100 flex">
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
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen flex flex-col bg-white shadow-2xl border-r border-gray-200 overflow-x-hidden ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-80'
          } w-80 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        style={{
          transitionProperty: 'width, transform, box-shadow',
          transitionDuration: '0.4s',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* ── Sidebar Header ── */}
        <div className="relative shrink-0 overflow-hidden">
          {/* Expanded header */}
          <div className={`transition-all duration-400 ease-in-out ${!sidebarCollapsed
              ? 'opacity-100 transform translate-x-0'
              : 'opacity-0 transform -translate-x-4 pointer-events-none absolute inset-0'
            }`}>
            <div className="absolute inset-0 bg-linear-to-br from-yellow-600 via-yellow-600 to-yellow-500 opacity-90" />
            <div className="relative p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/30">
                      <Users size={20} className="text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
                  </div>
                  <div className="text-white">
                    <div className="font-bold text-lg leading-tight">Teacher Portal</div>
                    <div className="text-white/80 text-xs">Academic Workspace</div>
                  </div>
                </div>
                <button
                  className="hidden lg:inline-flex rounded-lg p-2 text-white/90 hover:bg-white/20 transition-colors"
                  onClick={() => setSidebarCollapsed(true)}
                  aria-label="Collapse sidebar"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-2 rounded-lg bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors border border-white/30"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Collapsed header */}
          <div className={`transition-all duration-400 ease-in-out ${sidebarCollapsed
              ? 'opacity-100 transform translate-x-0'
              : 'opacity-0 transform translate-x-4 pointer-events-none absolute inset-0'
            }`}>
            <div className="p-2 border-b border-gray-200">
              <div className="flex flex-col items-center space-y-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-linear-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-md">
                    <Users size={18} className="text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                </div>
                <div className="w-8 h-px bg-gray-300" />
                <button
                  className="hidden lg:inline-flex rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                  onClick={() => setSidebarCollapsed(false)}
                  aria-label="Expand sidebar"
                >
                  <ChevronRight size={18} className="rotate-180" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${!sidebarCollapsed ? 'px-4 py-6' : 'px-1 py-2'}`}>
          <div className={`${!sidebarCollapsed ? 'space-y-2' : 'space-y-1'}`}>
            {menuSections.map((section) => {
              const isSectionActive = section.children.some((child) => isItemActive(child.path));
              const isOpen = openGroups[section.id] ?? isSectionActive;
              return (
                <div key={section.id} className="mb-1">
                  <button
                    type="button"
                    title={sidebarCollapsed ? section.label : undefined}
                    onClick={() =>
                      sidebarCollapsed
                        ? setSidebarCollapsed(false)
                        : setOpenGroups((prev) => ({ ...prev, [section.id]: !isOpen }))
                    }
                    className={`
                      w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-3 rounded-lg
                      group transition-all duration-300 ease-out transform
                      text-gray-600 hover:bg-linear-to-r hover:from-blue-50 hover:to-yellow-50 hover:text-gray-900 hover:shadow-md hover:scale-105 active:scale-95
                    `}
                  >
                    <section.icon
                      size={20}
                      className="shrink-0 transition-all duration-300 text-gray-600 group-hover:text-blue-600 group-hover:scale-110"
                    />
                    {!sidebarCollapsed && (
                      <span className="font-medium flex-1 text-left transition-all duration-300">{section.label}</span>
                    )}
                    {!sidebarCollapsed && (
                      isOpen
                        ? <ChevronDown size={16} className="text-gray-400 group-hover:text-blue-600 transition-all duration-300 group-hover:rotate-180" />
                        : <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600 transition-all duration-300 group-hover:translate-x-1" />
                    )}
                  </button>

                  {!sidebarCollapsed && isOpen && (
                    <div className="ml-6 mt-1 space-y-1">
                      {section.children.map((item) => {
                        const active = isItemActive(item.path);
                        return (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            className={`
                              w-full flex items-center space-x-3 px-4 py-2 rounded-lg
                              group transition-all duration-300 ease-out transform
                              ${active
                                ? 'bg-linear-to-r from-yellow-100 to-yellow-50 text-yellow-700 border-l-2 border-yellow-500 shadow-sm'
                                : 'text-gray-500 hover:bg-linear-to-r hover:from-gray-50 hover:to-blue-50 hover:text-gray-700 hover:shadow-sm hover:scale-105 active:scale-95 hover:border-l-2 hover:border-blue-200'
                              }
                            `}
                          >
                            <item.icon
                              size={16}
                              className={`shrink-0 transition-all duration-300 ${active ? 'text-yellow-600' : 'group-hover:text-blue-600 group-hover:scale-110'
                                }`}
                            />
                            <span className="text-sm font-medium transition-all duration-300">{item.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* ── Bottom: Logout ── */}
        <div className={`shrink-0 border-t border-gray-200 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
          <div className={`${!sidebarCollapsed ? 'space-y-2' : 'space-y-1'}`}>
            {sidebarCollapsed ? (
              <button
                onClick={handleLogout}
                className="group relative w-full h-12 flex items-center justify-center rounded-xl text-red-500 hover:bg-linear-to-r hover:from-red-50 hover:to-pink-50 hover:scale-105 hover:shadow-md hover:text-red-600 transition-all duration-300 ease-out transform active:scale-95"
              >
                <div className="relative flex items-center justify-center w-6 h-6 transition-all duration-300 text-red-500 group-hover:text-red-600 group-hover:scale-110">
                  <LogOut size={18} strokeWidth={1.8} className="shrink-0 transition-all duration-300" />
                </div>
                <div className="absolute left-full ml-3 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out transform translate-x-2 group-hover:translate-x-0 pointer-events-none z-50">
                  <div className="bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-gray-700 min-w-max">
                    <div className="font-semibold text-sm">Logout</div>
                    <div className="text-xs text-gray-300 mt-1">Sign out securely</div>
                    <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2">
                      <div className="w-2 h-2 bg-gray-900 border-l border-t border-gray-700 rotate-45" />
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 rounded-xl ring-1 ring-transparent group-hover:ring-red-300/30 transition-all duration-300" />
              </button>
            ) : (
              <button
                onClick={handleLogout}
                className="group relative w-full flex items-center px-4 py-3 rounded-xl text-red-600 hover:bg-linear-to-r hover:from-red-50 hover:to-pink-50 hover:text-red-700 hover:shadow-md hover:scale-105 transition-all duration-300 ease-out transform active:scale-95"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 text-red-600 group-hover:bg-red-200 group-hover:scale-110 transition-all duration-300">
                  <LogOut size={20} className="shrink-0 transition-all duration-300" />
                </div>
                <div className="ml-3">
                  <div className="font-medium text-sm transition-all duration-300">Logout</div>
                  <div className="text-xs text-red-500 group-hover:text-red-600 transition-all duration-300">Sign out securely</div>
                </div>
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col h-screen">
        <header className="sticky top-0 z-20 w-full bg-white/80 backdrop-blur-xl border-b border-gray-100">
          <div className="px-3 sm:px-5">
            <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">

              {/* Left: Sidebar toggle + Greeting + Page title */}
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
                    {greeting}, <span className="text-indigo-600">{teacherFirstName}</span>
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <CalendarDays size={12} />
                    <span>{dateLabel}</span>
                    <span className="text-gray-300">|</span>
                    <span className="truncate">{activePageTitle}</span>
                  </div>
                </div>
              </div>

              {/* Right: Profile */}
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
                          <Bell size={14} className="text-indigo-500" />
                          <span className="text-sm font-bold text-gray-900">Notifications</span>
                          {unreadCount > 0 && (
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                          )}
                        </div>
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            onClick={markAllRead}
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
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
                              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${isRead ? '' : 'bg-indigo-50/50'}`}
                            >
                              <div className="flex items-start gap-2">
                                {!isRead && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                                <div className={!isRead ? '' : 'ml-3.5'}>
                                  <p className="text-sm font-medium text-gray-800 line-clamp-1">{n?.title || 'Notification'}</p>
                                  {n?.message && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>}
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
                    {hasProfileImage ? (
                      <img
                        src={teacherProfile.profilePic}
                        alt=""
                        className="w-8 h-8 rounded-lg border border-gray-200 object-cover"
                        onError={(e) => {
                          e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                        {initialsLabel}
                      </div>
                    )}
                    <div className="hidden md:block text-left">
                      <p className="text-xs font-semibold text-gray-800 leading-tight">
                        {hasProfileImage ? teacherFirstName : teacherFirstLastName}
                      </p>
                      <p className="text-[10px] text-gray-400">Teacher</p>
                    </div>
                    <ChevronDown size={14} className={`hidden md:block text-gray-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden">
                      {/* Profile card */}
                      <div className="px-4 py-3 bg-linear-to-br from-blue-50 to-indigo-50 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          {hasProfileImage ? (
                            <img src={teacherProfile.profilePic} alt="" className="w-10 h-10 rounded-lg border-2 border-white object-cover shadow-sm" onError={(e) => { e.target.style.display = 'none'; }} />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-linear-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                              {initialsLabel}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{teacherProfile.name || 'Teacher'}</p>
                            <p className="text-[11px] text-gray-500">{teacherProfile.department || 'Educator'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="py-1">
                        <button
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => { setProfileOpen(false); navigate('/teacher/my-work-portal'); }}
                        >
                          <User size={15} className="text-gray-400" />
                          My Profile
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

        <main className={`flex-1 min-h-0 ${isSmartPlannerRoute ? 'p-0' : 'p-2 sm:p-4'} ${isChatRoute ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className={isChatRoute ? 'h-full flex flex-col' : undefined}>
            <Routes>
              <Route index element={<Navigate to="/teacher/dashboard" replace />} />
              <Route path="dashboard" element={<TeacherDashboard />} />
              <Route path="test" element={<TestTeacherPortal />} />
              <Route path="my-work-portal" element={<MyWorkPortal />} />
              <Route path="class-routine" element={<ClassRoutine />} />
              <Route path="holidays" element={<HolidayList />} />
              <Route path="attendance" element={<AttendanceManagement />} />
              <Route path="achievements" element={<TeacherAchievements />} />
              <Route path="student-analytics" element={<StudentAnalyticsPortal />} />
              <Route path="progress" element={<Navigate to="/teacher/student-analytics" replace />} />
              <Route path="weak-students" element={<Navigate to="/teacher/student-analytics" replace />} />
              <Route path="smart-teaching" element={<AIPoweredTeaching />} />
              <Route path="smart-teaching/lesson-planner" element={<SmartTeachingLessonPlanner />} />
              <Route path="smart-teaching/lesson-planner-wizard" element={<LessonPlannerWizard />} />
              <Route path="ai-powered-teaching" element={<Navigate to="/teacher/smart-teaching" replace />} />
              <Route path="academic-alcove" element={<TeacherAlcove />} />
              <Route path="ai-learning/:studentId/:subject" element={<AILearningPath />} />
              <Route path="health-updates" element={<HealthUpdatesAdvanced />} />
              <Route path="student-observations" element={<StudentObservationOverview />} />
              <Route path="parent-meetings" element={<ParentMeetings />} />
              <Route path="assignments" element={<AssignmentPortal />} />
              <Route path="evaluation" element={<Navigate to="/teacher/assignments" replace />} />
              <Route path="practice-questions" element={<PracticeQuestions />} />
              <Route path="chat" element={<TeacherChat />} />
              <Route path="lesson-plans" element={<LessonPlanDashboard />} />
              <Route path="class-notes" element={<ClassNotes />} />
              <Route path="exams" element={<Navigate to="/teacher/result-management" replace />} />
              <Route path="result-management" element={<ResultManagement />} />
              <Route path="results" element={<Navigate to="/teacher/result-management" replace />} />
              <Route path="excuse-letters" element={<ExcuseLetters />} />
              <Route path="feedback" element={<TeacherFeedbackPortal />} />
            </Routes>
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

export default TeacherPortal;
