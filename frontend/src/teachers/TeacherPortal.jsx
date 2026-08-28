/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, NavLink, Outlet, useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  Users,
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
  Clock,
  Eye,
  LogOut,
  CheckCheck,
  ThumbsUp,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  GraduationCap,
  Library,
  Settings,
  RefreshCw,
  CalendarCheck,
  Activity,
} from 'lucide-react';
import { Button } from '../components/ui/button';

import HealthUpdatesAdvanced from './HealthUpdatesAdvanced';
import ParentMeetings from './ParentMeetings';
import AssignmentPortal from './AssignmentPortal';
import AttendanceManagement from './AttendanceManagement';
import TeacherDashboard from './TeacherDashboard';
import SmartTeachingLessonPlanner from './SmartTeachingLessonPlanner';
import LessonPlannerWizard from './components/LessonPlannerWizard';
import TeacherChat from './TeacherChat';
import StudentAnalyticsPortal from './StudentAnalyticsPortal';
import AILearningPath from './AILearningPath';
import TestTeacherPortal from './TestTeacherPortal';
import AIPoweredTeaching from './AIPoweredTeaching';
import GenerateAIPathPortal from './GenerateAIPathPortal';
import TeacherAIToolsPanel from './TeacherAIToolsPanel';
import MyWorkPortal from './MyWorkPortal';
import ClassRoutine from './ClassRoutine';
import StudentObservationOverview from './StudentObservationOverview';
import ClassNotes from './ClassNotes';
import PracticeQuestions from './PracticeQuestions';
import LanguagePracticeManager from './LanguagePracticeManager';
import TeacherFeedbackPortal from './TeacherFeedbackPortal';
import ExcuseLetters from './ExcuseLetters';
import ExamResultPortal from './ExamResultPortal';
import LiveExamMonitor from './LiveExamMonitor';
import HolidayList from './HolidayList';
import TeacherAchievements from './TeacherAchievements';
import TeacherAlcove from './TeacherAlcove';
import TryoutManagement from '../components/TryoutManagement';
import { useDesktopNotificationBridge } from '../hooks/useDesktopNotificationBridge';
import DesktopNotificationPermissionModal from '../components/DesktopNotificationPermissionModal';
import NotificationPopover from '../components/NotificationPopover';
import { AUTH_NOTICE, apiFetch, logoutAndRedirect } from '../utils/authSession';

const PORTAL_BASE = '/teacher';
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const MotionNavLink = Motion.create(NavLink);

const portalNavigation = [
  { icon: Home, label: 'Dashboard', path: `${PORTAL_BASE}/dashboard` },
  { icon: Users, label: 'Classes & Work', path: `${PORTAL_BASE}/classes` },
  { icon: CalendarDays, label: 'Calendar', path: `${PORTAL_BASE}/calendar` },
  { icon: Clock, label: 'Timetable', path: `${PORTAL_BASE}/timetable` },
  { icon: Bell, label: 'Notifications', path: `${PORTAL_BASE}/notifications` },
  { icon: Library, label: 'Academic Alcove', path: `${PORTAL_BASE}/resource-library` },
  { icon: Brain, label: 'Lesson Plan', path: `${PORTAL_BASE}/lesson-plan` },
  { icon: Brain, label: 'AI Tools', path: `${PORTAL_BASE}/ai-tools` },
  { icon: Activity, label: 'Live Monitor', path: `${PORTAL_BASE}/live-monitor` },
  { icon: CalendarCheck, label: 'PTM', path: `${PORTAL_BASE}/ptm` },
  { icon: MessageSquare, label: 'Chat', path: `${PORTAL_BASE}/classes/current/communication/chat` },
  { icon: ThumbsUp, label: 'Student Feedback', path: `${PORTAL_BASE}/classes/current/communication/feedback` },
  { icon: FileText, label: 'Excuse Letters', path: `${PORTAL_BASE}/classes/current/communication/excuse-letters` },
  { icon: Settings, label: 'Profile & Work', path: `${PORTAL_BASE}/settings` },
];

const studentsLinks = [
  { label: 'Student List', to: 'students' },
  { label: 'Attendance', to: 'students/attendance' },
  { label: 'Health Records', to: 'students/health-records' },
  { label: 'Observations', to: 'students/observations' },
  { label: 'Achievements', to: 'students/achievements' },
  { label: 'Student Analytics', to: 'students/analytics' },
];

const studentSectionLinks = studentsLinks.map((item) => ({
  ...item,
  to: item.to.replace(/^students\/?/, '') || '.',
}));

const teachingSectionLinks = [
  { label: 'Lesson Planner Wizard', to: 'lesson-planner-wizard' },
  { label: 'Class Notes', to: 'class-notes' },
  { label: 'Practice Questions', to: 'practice-questions' },
  { label: 'Language Practice', to: 'language-practice' },
  { label: 'Study Materials', to: 'study-materials' },
  { label: 'AI Teaching Assistant', to: 'ai-assistant' },
];

const assessmentSectionLinks = [
  { label: 'Exam', to: 'exam' },
];

const communicationSectionLinks = [
  { label: 'Chat', to: 'chat' },
  { label: 'Parent Meetings', to: 'parent-meetings' },
  { label: 'Student Feedback', to: 'feedback' },
  { label: 'Excuse Letters', to: 'excuse-letters' },
];

const buildClassPath = (classId, section) =>
  `${PORTAL_BASE}/classes/${encodeURIComponent(classId || 'current')}${section ? `/${section}` : ''}`;

const allocationAcademicYearId = (allocation) => String(
  allocation?.classId?.academicYearId?._id || allocation?.classId?.academicYearId || ''
);

const allocationsForActiveYear = (allocations, activeYearId) => (
  activeYearId
    ? allocations.filter((allocation) => allocationAcademicYearId(allocation) === String(activeYearId))
    : allocations
);

const classDisplayName = (classId) =>
  classId === 'current' ? 'Current Class' : decodeURIComponent(classId || 'Current Class').replace(/-/g, ' ');

const resolveTeacherNotificationPath = (notification) => {
  const title = String(notification?.title || '').toLowerCase();
  const message = String(notification?.message || '').toLowerCase();
  const type = String(notification?.type || notification?.typeLabel || '').toLowerCase();
  const blob = `${title} ${message} ${type}`;
  if (blob.includes('substitute') || blob.includes('attendance')) return '/teacher/attendance';
  if (blob.includes('assignment')) return '/teacher/assignments';
  if (blob.includes('result') || blob.includes('exam')) return '/teacher/result-management';
  if (blob.includes('meeting') || blob.includes('parent')) return '/teacher/parent-meetings';
  if (blob.includes('feedback')) return '/teacher/feedback';
  if (blob.includes('wall') || blob.includes('alcove') || blob.includes('problem library')) return '/teacher/academic-alcove';
  if (blob.includes('chat') || blob.includes('message')) return '/teacher/chat';
  if (blob.includes('health') || blob.includes('wellbeing')) return '/teacher/health-updates';
  return '/teacher/dashboard';
};

const notificationTypeMeta = (notification) => {
  const type = String(notification?.type || notification?.typeLabel || '').toLowerCase();
  if (type.includes('assignment')) return { label: 'Assignment', icon: ClipboardCheck, tone: 'blue' };
  if (type.includes('exam') || type.includes('result')) return { label: 'Assessment', icon: GraduationCap, tone: 'rose' };
  if (type.includes('meeting') || type.includes('parent')) return { label: 'Meeting', icon: Users, tone: 'violet' };
  if (type.includes('attendance')) return { label: 'Attendance', icon: UserCheck, tone: 'emerald' };
  if (type.includes('chat') || type.includes('message')) return { label: 'Message', icon: MessageSquare, tone: 'indigo' };
  return { label: notification?.typeLabel || 'General', icon: Bell, tone: 'slate' };
};

const notificationTimeLabel = (value) => {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const notificationToneClasses = {
  blue: 'bg-blue-50 text-blue-700',
  rose: 'bg-rose-50 text-rose-700',
  violet: 'bg-violet-50 text-violet-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  slate: 'bg-slate-100 text-slate-600',
};

const TeacherNotifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setNotifications([]);
        return;
      }
      const response = await apiFetch(`${API_BASE}/api/notifications/user`, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      }, navigate);
      if (response.status === 304) return;
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data?.error || 'Unable to load notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadNotifications();
    const poll = setInterval(() => loadNotifications({ silent: true }), 30_000);
    return () => clearInterval(poll);
  }, [loadNotifications]);

  const markRead = useCallback(async (id) => {
    if (!id) return;
    const token = localStorage.getItem('token');
    setNotifications((previous) => previous.map((item) => (
      String(item?._id || item?.id || '') === String(id) ? { ...item, isRead: true } : item
    )));
    try {
      const response = await apiFetch(`${API_BASE}/api/notifications/user/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      }, navigate);
      if (!response.ok) throw new Error('Unable to mark notification as read');
    } catch (err) {
      setError(err.message || 'Unable to mark notification as read');
      await loadNotifications({ silent: true });
    }
  }, [loadNotifications, navigate]);

  const markAllRead = async () => {
    const token = localStorage.getItem('token');
    setNotifications((previous) => previous.map((item) => ({ ...item, isRead: true })));
    try {
      const response = await apiFetch(`${API_BASE}/api/notifications/user/read-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      }, navigate);
      if (!response.ok) throw new Error('Unable to mark all notifications as read');
    } catch (err) {
      setError(err.message || 'Unable to mark all notifications as read');
      await loadNotifications({ silent: true });
    }
  };

  const dismiss = async (id) => {
    if (!id) return;
    const token = localStorage.getItem('token');
    setNotifications((previous) => previous.filter((item) => String(item?._id || item?.id || '') !== String(id)));
    try {
      const response = await apiFetch(`${API_BASE}/api/notifications/user/${id}/dismiss`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      }, navigate);
      if (!response.ok) throw new Error('Unable to dismiss notification');
    } catch (err) {
      setError(err.message || 'Unable to dismiss notification');
      await loadNotifications({ silent: true });
    }
  };

  const unreadCount = notifications.filter((item) => !item?.isRead).length;
  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'unread') return !item?.isRead;
    if (filter === 'read') return Boolean(item?.isRead);
    return true;
  });

  return (
    <div className="min-h-full bg-slate-50 p-3 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Teacher Portal</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">Notifications</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">Keep track of announcements, class updates, meetings and action items in one place.</p>
            </div>
            <button type="button" onClick={() => loadNotifications({ silent: true })} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60">
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-2xl font-semibold text-slate-950">{notifications.length}</p><p className="mt-1 text-xs text-slate-500">Total notifications</p></div>
            <div className="rounded-xl bg-indigo-50 p-3"><p className="text-2xl font-semibold text-indigo-700">{unreadCount}</p><p className="mt-1 text-xs text-indigo-600">Unread</p></div>
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-2xl font-semibold text-emerald-700">{notifications.length - unreadCount}</p><p className="mt-1 text-xs text-emerald-600">Already reviewed</p></div>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1">
            {['all', 'unread', 'read'].map((value) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${filter === value ? 'bg-slate-950 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                {value} {value === 'unread' ? `(${unreadCount})` : ''}
              </button>
            ))}
          </div>
          {unreadCount > 0 && <button type="button" onClick={markAllRead} className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900"><CheckCheck size={15} /> Mark all as read</button>}
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading notifications...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Bell size={22} /></div>
            <h2 className="mt-4 text-base font-semibold text-slate-950">{filter === 'all' ? 'You are all caught up' : `No ${filter} notifications`}</h2>
            <p className="mt-1 text-sm text-slate-500">New school and teaching updates will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => {
              const id = String(notification?._id || notification?.id || notification?.title || 'notification');
              const meta = notificationTypeMeta(notification);
              const Icon = meta.icon;
              const isRead = Boolean(notification?.isRead);
              return (
                <article key={id} className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5 ${isRead ? 'border-slate-200' : 'border-indigo-200 ring-1 ring-indigo-50'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${notificationToneClasses[meta.tone]}`}><Icon size={19} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${notificationToneClasses[meta.tone]}`}>{meta.label}</span>
                        {!isRead && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Unread</span>}
                        {notification?.priority && notification.priority !== 'medium' && <span className="text-[10px] font-semibold capitalize text-slate-400">{notification.priority} priority</span>}
                      </div>
                      <h2 className="mt-2 text-base font-semibold text-slate-950">{notification?.title || 'Notification'}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{notification?.message || 'There is an update waiting for you.'}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                        <span>{notificationTimeLabel(notification?.createdAt)}</span>
                        {notification?.createdByName && <span>From {notification.createdByName}</span>}
                        {(notification?.className || notification?.sectionName) && <span>{[notification.className, notification.sectionName].filter(Boolean).join(' · ')}</span>}
                      </div>
                    </div>
                    <button type="button" onClick={() => dismiss(id)} aria-label="Dismiss notification" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                    {!isRead && <button type="button" onClick={() => markRead(id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Mark as read</button>}
                    <button type="button" onClick={async () => { await markRead(id); navigate(resolveTeacherNotificationPath(notification)); }} className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">Open related page</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const PlaceholderModule = ({ icon = FileText, title, description, actions = [] }) => {
  const ModuleIcon = icon;

  return (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <ModuleIcon size={20} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <NavLink
              key={action.to}
              to={action.to}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {action.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  </div>
  );
};

const GLASS_CARD = {
  background: 'rgba(255, 255, 255, 0.35)',
  backdropFilter: 'blur(18px) saturate(180%)',
  WebkitBackdropFilter: 'blur(18px) saturate(180%)',
  boxShadow: '0 20px 40px -12px rgba(100, 120, 200, 0.15), 0 8px 24px -6px rgba(80, 100, 180, 0.06), inset 0 1px 2px rgba(255, 255, 255, 0.5)',
  border: '1px solid #D7DCFF',
};

const GLASS_CONTROL = {
  background: 'rgba(255, 255, 255, 0.20)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
};

const ClassesHub = () => {
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [allocationError, setAllocationError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setAllocationError('');
      try {
        const token = localStorage.getItem('token');
        const [allocRes, yearRes] = await Promise.all([
          fetch(`${API_BASE}/api/teacher/dashboard/allocations`, {
            headers: { authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/academic/active-year`, {
            headers: { authorization: `Bearer ${token}` },
          }),
        ]);
        const allocRaw = await allocRes.json().catch(() => []);
        if (!allocRes.ok) throw new Error(allocRaw?.error || 'Unable to load teacher allocations');
        const all = Array.isArray(allocRaw) ? allocRaw : [];
        const yearData = yearRes.ok ? await yearRes.json().catch(() => null) : null;
        const activeYearId = yearData?._id ? String(yearData._id) : '';

        const filtered = allocationsForActiveYear(all, activeYearId);
        setAllocations(filtered);
        if (activeYearId && all.length > 0 && filtered.length === 0) {
          setAllocationError('Your allocations belong to an earlier academic year. Ask your administrator to assign the active year.');
        }
      } catch (err) {
        setAllocations([]);
        setAllocationError(err.message || 'Unable to load teacher allocations');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const classNames = useMemo(() => {
    const seen = new Set();
    return allocations
      .map((a) => a?.classId?.name || a?.className || '')
      .filter((n) => n && !seen.has(n) && seen.add(n));
  }, [allocations]);

  useEffect(() => {
    if (classNames.length > 0 && !selectedClass) setSelectedClass(classNames[0]);
  }, [classNames, selectedClass]);

  const sections = useMemo(() => {
    const seen = new Set();
    return allocations
      .filter((a) => (a?.classId?.name || a?.className || '') === selectedClass)
      .map((a) => a?.sectionId?.name || a?.sectionName || '')
      .filter((s) => s && !seen.has(s) && seen.add(s));
  }, [allocations, selectedClass]);

  useEffect(() => {
    if (sections.length > 0) setSelectedSection(sections[0]);
    else setSelectedSection('');
  }, [sections]);

  const subjects = useMemo(() => {
    const seen = new Set();
    return allocations
      .filter(
        (a) =>
          (a?.classId?.name || a?.className || '') === selectedClass &&
          (a?.sectionId?.name || a?.sectionName || '') === selectedSection,
      )
      .map((a) => a?.subjectId?.name || a?.subjectName || a?.subject || '')
      .filter((s) => s && !seen.has(s) && seen.add(s));
  }, [allocations, selectedClass, selectedSection]);

  useEffect(() => {
    if (subjects.length > 0) setSelectedSubject(subjects[0]);
    else setSelectedSubject('');
  }, [subjects]);

  const handleGo = () => {
    if (!selectedClass || !selectedSection) return;
    const alloc = allocations.find(
      (a) =>
        (a?.classId?.name || a?.className || '') === selectedClass &&
        (a?.sectionId?.name || a?.sectionName || '') === selectedSection,
    );
    const mongoId = alloc?.classId?._id || alloc?.classId?.id || '';
    const sectionMongoId = alloc?.sectionId?._id || alloc?.sectionId?.id || '';
    const slug =
      `${selectedClass.trim()}-${selectedSection.trim()}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'current';
    navigate(buildClassPath(slug), {
      state: {
        className: selectedClass,
        sectionName: selectedSection,
        classMongoId: mongoId,
        sectionMongoId,
        subjectName: selectedSubject,
      },
    });
  };

  const SelectField = ({ id, label, value, onChange, options }) => (
    <div >
      <label
        htmlFor={id}
        className="mb-2 block text-[0.75rem] font-medium uppercase tracking-[0.04em] text-[#5363F5]/80"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none rounded-[60px] border border-[#D7DCFF] px-5 py-3 pr-10 text-base font-medium text-[#5363F5] transition-all duration-200 hover:border-[#C4CDFF] focus:border-[#B8C2F5] focus:outline-none focus:ring-2 focus:ring-[#B8C2F5]/40"
          style={GLASS_CONTROL}
        >
          {options.map((o) => (
            <option key={o} value={o} style={{ background: 'rgba(255,255,255,0.95)', color: '#0b1a2b' }}>
              {o}
            </option>
          ))}
          {options.length === 0 && (
            <option value="" style={{ background: 'rgba(255,255,255,0.95)', color: '#0b1a2b' }}>
              —
            </option>
          )}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[1.1rem] text-[#5363F5]/70">
          ⌄
        </span>
      </div>
    </div>
  );

  if (!loading && allocations.length === 0) {
    return (
      <div className="flex min-h-full items-center justify-center bg-white p-6 ">
        <div className="w-full max-w-[520px] rounded-[40px] p-11 text-center" style={GLASS_CARD}>
          <p className="text-sm text-[#2c405e]">{allocationError || 'No class allocations found. Contact your administrator.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-white rounded-[35px] p-6">
      <div
        className="flex w-full max-w-[760px] flex-col rounded-[35px] border border-[#D7DCFF] bg-white/35 transition-colors hover:border-[#C4CDFF]"
        style={{ ...GLASS_CARD, padding: '3.5rem 4rem 4rem' }}
      >
        {/* Title */}
          <h1
          className="mb-8 self-center rounded-[60px] px-6 py-1.5 text-center text-[1.6rem] font-semibold tracking-[-0.02em] text-[#5363F5]"
          style={{ background: 'rgba(255,255,255,0.20)', border: '1px solid #D7DCFF', backdropFilter: 'blur(4px)' }}
        >
          Select Class
        </h1>

        {/* Class + Section */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <SelectField
            id="classSelect"
            label="Class"
            value={selectedClass}
            onChange={setSelectedClass}
            options={classNames}
          />
          <SelectField
            id="sectionSelect"
            label="Section"
            value={selectedSection}
            onChange={setSelectedSection}
            options={sections}
          />
        </div>

        {/* Subject */}
        <SelectField
          id="subjectSelect"
          label="Subject"
          value={selectedSubject}
          onChange={setSelectedSubject}
          options={subjects}
        />

        {/* Divider */}
        <div className="my-4 h-px w-full" style={{ background: 'rgba(255,255,255,0.15)' }} />

        {/* Selection preview */}
        <div
          className="flex flex-wrap items-center justify-center gap-3 rounded-[60px] px-5 py-2.5"
          style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid #D7DCFF', backdropFilter: 'blur(4px)' }}
        >
          <span className="text-[0.7rem] uppercase tracking-[0.04em] text-[#5363F5]/70">Selected</span>
          {[selectedClass, selectedSection, selectedSubject].filter(Boolean).map((val) => (
            <span
              key={val}
              className="rounded-[40px] px-5 py-1 text-[0.85rem] font-medium text-[#5363F5]"
              style={{ background: 'rgba(255,255,255,0.20)', border: '1px solid #D7DCFF' }}
            >
              {val}
            </span>
          ))}
        </div>

        {/* Go button */}
        <button
          type="button"
          onClick={handleGo}
          disabled={!selectedClass || !selectedSection}
          className="mt-5 w-full rounded-[60px] border border-[#D7DCFF] py-3.5 text-base font-semibold text-[#5363F5] transition-all duration-200 hover:-translate-y-1 hover:border-[#C4CDFF] hover:bg-[#C4CDFF]/20 hover:shadow-[0_12px_28px_-10px_rgba(80,100,180,0.20)] active:translate-y-0 active:border-[#B8C2F5] focus:border-[#B8C2F5] focus:outline-none focus:ring-2 focus:ring-[#B8C2F5]/40 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.30)', backdropFilter: 'blur(4px)' }}
        >
          Go to the Class
        </button>
      </div>
    </div>
  );
};

/*
 * Image reference (Content.png):
 *   Title  : "Class :5  Section : A"  — bold, large, centered
 *   Sub    : "Switch class"            — small oval pill, centered
 *   Tabs   : Overview | Students | Observations | AI  (4 tabs, pill bar, centered)
 *            Active = indigo border and text, inactive = dark text
 *   Caret  : small downward triangle below active tab, connecting to sub-bar
 *   Sub-bar: soft purple pill (#F5F5FF / #D7DCFF), 3 items with purple bullet dots
 *            Active sub-item = medium purple focus state inside
 */
const CW_TABS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: Home,
    ownPaths: (rel) => rel.startsWith('overview/'),
    firstPath: 'overview/analytics',
    subTabs: [
      { label: 'Overall Class Analytics',  path: 'overview/analytics' },
      { label: 'Overall Attendance',       path: 'overview/attendance' },
    ],
  },
  {
    id: 'students',
    label: 'Students',
    icon: Users,
    ownPaths: (rel) =>
      rel === 'students' ||
      rel.startsWith('students/health') ||
      rel.startsWith('students/attendance') ||
      rel.startsWith('students/achievements') ||
      rel.startsWith('assignments') ||
      rel === 'reports' ||
      rel.startsWith('assessments'),
    firstPath: 'students/health-records',
    subTabs: [
      { label: 'Student Health Records', path: 'students/health-records' },
      { label: 'Attendance',             path: 'students/attendance' },
      { label: 'Assignments',            path: 'assignments/manage' },
      { label: 'Achievements',           path: 'students/achievements' },
      { label: 'Exam',                   path: 'assessments/exam' },
    ],
  },
  {
    id: 'observations',
    label: 'Observations',
    icon: Eye,
    ownPaths: (rel) =>
      rel.startsWith('students/observations') ||
      rel.includes('ai-learning'),
    firstPath: 'students/observations',
    subTabs: [
      { label: 'Emotional Wellbeing', path: 'students/observations' },
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    icon: BarChart3,
    ownPaths: (rel) =>
      rel === 'teaching' ||
      rel.startsWith('teaching/ai') ||
      rel.startsWith('teaching/lesson-planner') ||
      rel.startsWith('teaching/class-notes') ||
      rel.startsWith('teaching/practice') ||
      rel.startsWith('teaching/study'),
    firstPath: 'teaching/ai-assistant',
    subTabs: [],
  },
];

const ClassWorkspace = () => {
  const { classId = 'current' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [className, setClassName] = useState('');
  const [sectionName, setSectionName] = useState('');
  const basePath = buildClassPath(classId);

  // ── Resolve the `current` placeholder slug to the teacher's real class-section.
  // Dashboard shortcuts (Attendance, Achievements, …) link to `classes/current/…`;
  // without this every child page opens with no class context ("No students found").
  useEffect(() => {
    if (classId !== 'current') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const [res, yearRes] = await Promise.all([
          fetch(`${API_BASE}/api/teacher/dashboard/allocations`, {
            headers: { authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/academic/active-year`, {
            headers: { authorization: `Bearer ${token}` },
          }),
        ]);
        if (!res.ok) return;
        const data = await res.json().catch(() => []);
        const yearData = yearRes.ok ? await yearRes.json().catch(() => null) : null;
        const activeAllocations = allocationsForActiveYear(
          Array.isArray(data) ? data : [],
          yearData?._id ? String(yearData._id) : ''
        );
        if (cancelled || activeAllocations.length === 0) return;
        // Prefer the class-teacher allocation; fall back to the first allocation.
        const primary = activeAllocations.find((a) => a?.isClassTeacher) || activeAllocations[0];
        const cn = String(primary?.classId?.name || primary?.className || '').trim();
        const sn = String(primary?.sectionId?.name || primary?.sectionName || '').trim();
        if (!cn || !sn) return;
        const slug = `${cn}-${sn}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (!slug || slug === 'current' || cancelled) return;
        const rest = location.pathname.slice(basePath.length); // e.g. "/students/attendance"
        navigate(`${buildClassPath(slug)}${rest}${location.search}`, {
          replace: true,
          state: {
            className: cn,
            sectionName: sn,
            classMongoId: primary?.classId?._id || primary?.classId?.id || '',
            sectionMongoId: primary?.sectionId?._id || primary?.sectionId?.id || '',
            subjectName: primary?.subjectId?.name || primary?.subjectName || '',
          },
        });
      } catch {
        /* stay on 'current' — child pages surface their own empty state */
      }
    })();
    return () => { cancelled = true; };
  }, [classId, location.pathname, location.search, basePath, navigate]);

  // ── Resolve class name + section separately ───────────────
  useEffect(() => {
    // seed from navigation state
    const navName = location.state?.className || '';
    const navSection = location.state?.sectionName || '';
    if (navName && navSection) {
      setClassName(navName);
      setSectionName(navSection);
    } else if (navName) {
      const parts = navName.split(' ');
      setClassName(parts[0] || navName);
      setSectionName(parts.slice(1).join(' '));
    } else {
      const fallback = classDisplayName(classId);
      const parts = fallback.split(' ');
      setClassName(parts[0] || fallback);
      setSectionName(parts.slice(1).join(' '));
    }

    if (!classId || classId === 'current') return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/teacher/dashboard/allocations`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => []);
        if (cancelled || !Array.isArray(data)) return;
        const classMongoId = location.state?.classMongoId;
        const sectionMongoId = location.state?.sectionMongoId;
        const alloc = data.find((it) => {
          if (classMongoId) {
            const aid = it?.classId?._id || it?.classId?.id || it?.classId;
            const sid = it?.sectionId?._id || it?.sectionId?.id || it?.sectionId;
            return String(aid || '') === String(classMongoId)
              && (!sectionMongoId || String(sid || '') === String(sectionMongoId));
          }
          // fallback: match by slug derived from class + section name
          const cn = it?.classId?.name || it?.className || '';
          const sn = it?.sectionId?.name || it?.sectionName || '';
          const itSlug = `${String(cn).trim()}-${String(sn).trim()}`
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          return itSlug === classId;
        });
        if (!alloc || cancelled) return;
        const cn = alloc?.classId?.name || alloc?.className || '';
        const sn = alloc?.sectionId?.name || alloc?.sectionName || '';
        if (!cancelled) { setClassName(cn); setSectionName(sn); }
      } catch { /* keep fallback */ }
    };
    load();
    return () => { cancelled = true; };
  }, [classId, location.state?.classMongoId, location.state?.className, location.state?.sectionMongoId, location.state?.sectionName]);

  // ── Active tab ────────────────────────────────────────────
  const rel = location.pathname.replace(basePath, '').replace(/^\//, '');
  const activeTab = useMemo(() => CW_TABS.find((t) => t.ownPaths(rel)) ?? CW_TABS[0], [rel]);
  const hasSubTabs = activeTab.subTabs.length > 0;

  // Communication pages are direct destinations from the main sidebar.
  // Do not render the class workspace header/tabs around them.
  if (rel === 'communication' || rel.startsWith('communication/')) {
    return <Outlet />;
  }

  return (
    <div className="space-y-4">

      {/* ══════════════════════════════════════════════════
          Card  — white, rounded-[20px], subtle shadow
      ══════════════════════════════════════════════════ */}
      <div className="rounded-[20px] bg-white shadow-[0_2px_16px_0_rgba(15,23,42,0.08)] border border-slate-100">

        {/* ── Title block — centered ─────────────────────── */}
        <div className="pt-8 pb-2 flex flex-col items-center gap-3">

          {/* "Class :5  Section : A" */}
          <h1 className="text-[1.75rem] font-bold tracking-tight text-[#0F172A] text-center">
            {className
              ? <>Class&nbsp;:{className}&nbsp;&nbsp;Section&nbsp;:&nbsp;{sectionName || '—'}</>
              : classDisplayName(classId)
            }
          </h1>

          {/* Switch class pill */}
          <NavLink
            to="/teacher/classes"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[13px] font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            Switch class
          </NavLink>
        </div>

        {/* ── Tab bar — centered, pill ───────────────────────
            Ref: rx=24, fill=#F8FAFC, stroke=#E2E8F0, h=48
            Active: indigo border with no fill or shadow, rx=18.5, h=37
        ──────────────────────────────────────────────────── */}
        <div className="flex justify-center px-6 pt-4 pb-0">
          <div className="inline-flex items-center gap-[5px] rounded-[24px] border border-[#E2E8F0] bg-[#F8FAFC] p-[5.5px]">
            {CW_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab.id;
              const to = `${basePath}/${tab.firstPath}`;
              return (
                <NavLink
                  key={tab.id}
                  to={to}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-[18px] px-4 text-[13.5px] font-semibold',
                    'h-[37px] whitespace-nowrap transition-all duration-150',
                    isActive
                      ? 'text-[#5363F5] ring-1 ring-[#B8C2F5]'
                      : 'text-[#475569] hover:text-[#1E293B]',
                  ].join(' ')}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} />
                  {tab.label}
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* ── Caret + Sub-tab bar ────────────────────────────
            Ref image: small downward-pointing triangle
            connecting active tab to the sub-bar below.
            Sub-bar: rx=21.5, fill=#F5F5FF, stroke=#D7DCFF
            Active sub-item: rx=16, fill=white, h=32
            Items: soft purple bullet dot + text
        ──────────────────────────────────────────────────── */}
        {hasSubTabs && (
          <Motion.div
            key={activeTab.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex flex-col items-center pb-6 pt-0"
          >
            {/* Triangle caret — points down from tab bar to sub-bar */}
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: '10px solid transparent',
                borderRight: '10px solid transparent',
                borderTop: '10px solid #F5F5FF',
                filter: 'drop-shadow(0 -1px 0 #D7DCFF)',
              }}
            />

            {/* Sub-bar pill */}
            <div className="inline-flex items-center gap-[5px] rounded-[22px] border border-[#D7DCFF] bg-[#F5F5FF] p-[5.5px]">
              {activeTab.subTabs.map((sub, idx) => (
                <NavLink
                  key={sub.path + idx}
                  to={`${basePath}/${sub.path}`}
                  className={({ isActive: ia }) =>
                    [
                      'inline-flex items-center gap-1.5 rounded-[16px] px-3',
                      'h-8 text-[12.5px] font-semibold whitespace-nowrap transition-all duration-150',
                      ia
                        ? 'bg-[#B8C2F5]/25 text-[#5363F5] shadow-sm ring-1 ring-[#B8C2F5]'
                        : 'text-[#5363F5] hover:bg-[#C4CDFF]/35 hover:text-[#5363F5]',
                    ].join(' ')
                  }
                >
                  {/* Indigo bullet dot — r=2.5 from SVG */}
                  <span className="w-[5px] h-[5px] rounded-full bg-[#5363F5] shrink-0" />
                  {sub.label}
                </NavLink>
              ))}
            </div>
          </Motion.div>
        )}

        {!hasSubTabs && <div className="pb-4" />}
      </div>

      {/* Child route */}
      <Outlet context={{ className, sectionName }} />

    </div>
  );
};

class TeacherPortalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 p-6">
          <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
            <div className="w-full rounded-2xl border border-red-100 bg-white p-8 shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                <AlertTriangle size={26} />
              </div>
              <h1 className="text-center text-xl font-semibold text-slate-950">Teacher portal failed to render</h1>
              <p className="mt-2 text-center text-sm text-slate-500">
                A page-level component crashed. Reloading the portal should recover if the backend is healthy.
              </p>
              <div className="mt-6 flex justify-center">
                <Button type="button" onClick={() => window.location.reload()}>
                  Reload portal
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const TeacherPortalShell = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isChatRoute = location.pathname.includes('/communication/chat');
  const isSmartPlannerRoute = location.pathname.includes('/teaching/lesson-planner') || location.pathname === '/teacher/lesson-plan';
  const isAttendanceRoute = location.pathname.includes('/students/attendance') || location.pathname.includes('/overview/attendance');
  const hasContainedPageScroll = isChatRoute || isSmartPlannerRoute || isAttendanceRoute;

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

  const isItemActive = useCallback((path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`),
  [location.pathname]);

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
    const g = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
    const d = now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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

  const dismissHeaderNotification = useCallback(async (id) => {
    if (!id) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setNotifications((previous) => previous.filter((item) => String(item?._id || item?.id || '') !== String(id)));
    try {
      const response = await apiFetch(`${API_BASE}/api/notifications/user/${id}/dismiss`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      }, navigate);
      if (!response.ok) throw new Error('Failed to dismiss notification');
    } catch (err) {
      setNotifError(err.message || 'Failed to dismiss notification');
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

  const resolveNotifPath = useCallback(resolveTeacherNotificationPath, []);
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
    <div className="flex h-screen h-dvh max-h-screen max-h-dvh min-h-0 overflow-hidden bg-[#fafafa]">
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
        data-testid="teacher-sidebar"
        aria-label="Teacher portal navigation"
        className={`fixed left-0 top-0 z-40 flex h-screen h-dvh max-h-screen max-h-dvh min-h-0 flex-col overflow-hidden border border-[#f0f2f5] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_4px_rgba(0,0,0,0.02)] lg:sticky lg:left-3 lg:top-3 lg:my-3 lg:ml-3 lg:h-[calc(100dvh-1.5rem)] lg:max-h-[calc(100dvh-1.5rem)] lg:rounded-[1.5rem] ${sidebarCollapsed ? 'lg:w-[76px]' : 'lg:w-[280px]'
          } w-80 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        style={{
          fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
          transitionProperty: 'width, transform, box-shadow',
          transitionDuration: '0.3s',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* ── Sidebar Header ── */}
        <div className="shrink-0 border-b border-[#f0f2f5]">
          {sidebarCollapsed ? (
            <div className="flex min-h-[92px] flex-col items-center justify-center gap-3 px-2 py-4">
              <div
                data-testid="teacher-sidebar-logo"
                aria-label="EEC Teacher Portal logo"
                className="flex size-12 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-1.5 shadow-[0_6px_16px_rgba(15,23,42,0.2)]"
              >
                <img src="/logo_new.png" alt="EEC" className="h-full w-full object-contain" />
              </div>
              <button
                type="button"
                className="hidden rounded-lg p-1.5 text-[#8e9aaf] transition-colors hover:bg-[#f5f3ff] hover:text-[#5b21b6] lg:inline-flex"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Expand sidebar"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <Motion.div
              key="expanded-brand"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-between px-6 pb-6 pt-7"
            >
              <div className="min-w-0">
                <div className="truncate text-[1.3rem] font-bold leading-tight tracking-[-0.02em] text-[#0b0e1a]">Teacher Portal</div>
                <div className="mt-1 truncate text-xs font-normal tracking-[0.03em] text-[#6f7a8c]">Academic Workspace</div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="hidden rounded-lg p-1.5 text-[#8e9aaf] transition-colors hover:bg-[#f5f3ff] hover:text-[#5b21b6] lg:inline-flex"
                  onClick={() => setSidebarCollapsed(true)}
                  aria-label="Collapse sidebar"
                >
                  <ChevronRight size={16} className="rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg p-1.5 text-[#8e9aaf] transition-colors hover:bg-[#f5f3ff] hover:text-[#5b21b6] lg:hidden"
                  aria-label="Close sidebar"
                >
                  <X size={17} />
                </button>
              </div>
            </Motion.div>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${!sidebarCollapsed ? 'px-2.5 py-5' : 'px-1.5 py-3'}`}>
          <div className="space-y-0.5">
            {portalNavigation.map((item) => {
              const active = isItemActive(item.path);
              const Icon = item.icon;
              return (
                <Button
                  key={item.path}
                  asChild
                  variant="ghost"
                  className={`group relative !h-auto !w-full !justify-start !rounded-[0.6rem] !border-l-[3px] !px-3 !py-2.5 !text-[0.82rem] !font-medium ${sidebarCollapsed ? '!justify-center !px-2' : 'space-x-2.5'} ${
                    active
                      ? '!border-l-[#8b5cf6] !bg-[#f5f3ff] !font-semibold !text-[#5b21b6] hover:!bg-[#ede9fe]'
                      : '!border-l-transparent !bg-transparent !text-[#4a5668] hover:!bg-[#fffbeb] hover:!text-[#0b0e1a]'
                  }`}
                >
                  <MotionNavLink
                    to={item.path}
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-label={item.label}
                    whileHover={{ x: sidebarCollapsed ? 0 : 4, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="relative flex w-full items-center"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center">
                      <Icon size={16} strokeWidth={1.9} className="shrink-0" />
                    </span>
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </MotionNavLink>
                </Button>
              );
            })}
          </div>        
        </nav>

        {/* ── Bottom: Logout ── */}
        <div className={`mt-auto shrink-0 border-t border-[#f0f2f5] bg-white ${sidebarCollapsed ? 'p-2.5' : 'px-3 py-3.5'}`}>
          <div>
            {sidebarCollapsed ? (
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Logout"
                data-testid="collapsed-sidebar-logout"
                className="group relative flex h-11 w-full items-center justify-center overflow-visible rounded-[0.6rem] text-[#536179] transition-all duration-200 hover:bg-[#f5f3ff] hover:text-[#6d28d9] active:scale-95"
              >
                <span aria-hidden="true" className="absolute inset-1 scale-75 rounded-lg bg-gradient-to-br from-violet-100 via-purple-50 to-amber-50 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100" />
                <span className="relative flex size-8 items-center justify-center">
                  <LogOut size={18} strokeWidth={1.9} className="block shrink-0 text-current" />
                </span>
                <div className="pointer-events-none absolute left-full z-50 ml-3 translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
                  <div className="min-w-max rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-left text-white shadow-2xl">
                    <div className="text-sm font-semibold">Logout</div>
                    <div className="mt-1 text-xs text-gray-300">Sign out securely</div>
                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2">
                      <div className="size-2 rotate-45 border-l border-t border-gray-700 bg-gray-900" />
                    </div>
                  </div>
                </div>
              </button>
            ) : (
              <Motion.button
                type="button"
                onClick={handleLogout}
                initial="rest"
                whileHover="hover"
                whileTap={{ scale: 0.98 }}
                variants={{
                  rest: { color: '#4a5668', borderColor: 'rgba(255,255,255,0)' },
                  hover: { color: '#6d28d9', borderColor: '#ddd6fe' },
                }}
                transition={{ duration: 0.2 }}
                className="group relative flex h-11 w-full items-center gap-2.5 overflow-hidden rounded-[0.6rem] border px-3 text-left text-[0.84rem] font-medium"
              >
                <Motion.span
                  aria-hidden="true"
                  variants={{ rest: { scaleX: 0 }, hover: { scaleX: 1 } }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  className="absolute inset-0 origin-left bg-gradient-to-r from-violet-100/90 via-purple-50 to-amber-50/80"
                />
                <Motion.span
                  aria-hidden="true"
                  variants={{ rest: { x: -45, opacity: 0 }, hover: { x: 235, opacity: [0, 0.75, 0] } }}
                  transition={{ duration: 0.85, ease: 'easeInOut' }}
                  className="absolute -top-3 size-14 rounded-full bg-amber-200/70 blur-xl"
                />
                <Motion.span
                  variants={{ rest: { x: 0, rotate: 0 }, hover: { x: 4, rotate: -8 } }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  className="relative flex shrink-0 items-center justify-center"
                >
                  <LogOut size={17} strokeWidth={1.8} />
                </Motion.span>
                <Motion.span variants={{ rest: { x: 0 }, hover: { x: 2 } }} transition={{ type: 'spring', stiffness: 420, damping: 24 }} className="relative whitespace-nowrap">Logout</Motion.span>
                <Motion.span variants={{ rest: { x: 0, color: '#8e9aaf' }, hover: { x: -2, color: '#7c3aed' } }} transition={{ duration: 0.25 }} className="relative ml-auto whitespace-nowrap text-[0.64rem] font-normal tracking-[0.02em]">Sign out securely</Motion.span>
              </Motion.button>
            )}
          </div>
        </div>
      </aside>

      <div className="flex h-screen h-dvh max-h-screen max-h-dvh min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 w-full bg-slate-100 px-0 py-0">
          <div className="relative flex h-[55px] items-center justify-center rounded-full bg-white">
            <div className="min-w-0 px-16 text-center leading-none">
              <p className="truncate text-[16px] font-semibold tracking-[-0.01em] text-[#1F2A44]">
                {greeting}, <span className="text-[#4F46E5]">{teacherFirstName}</span>
              </p>
              <p className="mt-2 truncate text-[12px] font-normal leading-none text-[#64748B]">
                {dateLabel}
              </p>
            </div>

            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute left-2 rounded-xl p-2 text-slate-600 transition-all hover:bg-slate-100 active:scale-95 lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

              {/* Right: Profile */}
              <div className="absolute right-2 flex items-center gap-1.5 sm:gap-2">
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

                  <AnimatePresence>
                    {showNotifications && (
                      <NotificationPopover
                        notifications={notifications}
                        unreadCount={unreadCount}
                        loading={notifLoading}
                        error={notifError}
                        onMarkAllRead={markAllRead}
                        onDismissNotification={dismissHeaderNotification}
                        formatTime={timeAgo}
                        onOpenNotification={async (notification) => {
                          const id = String(notification?._id || notification?.id || '');
                          if (!notification?.isRead) await markRead(id);
                          setShowNotifications(false);
                          navigate(resolveNotifPath(notification));
                        }}
                      />
                    )}
                  </AnimatePresence>
                </div>

                <div className="relative" ref={profileRef}>
                  <Motion.button
                    type="button"
                    whileHover={{ y: -1, scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                    className={`flex items-center gap-2 rounded-xl border bg-white px-1.5 py-1 transition-colors ${profileOpen
                      ? 'border-violet-200 shadow-[0_8px_20px_-10px_rgba(109,40,217,0.22)]'
                      : 'border-slate-100 shadow-sm hover:border-slate-200 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      setShowNotifications(false);
                      toggleProfile();
                    }}
                    aria-label="Profile menu"
                    aria-haspopup="menu"
                    aria-expanded={profileOpen}
                  >
                    {hasProfileImage ? (
                      <img
                        src={teacherProfile.profilePic}
                        alt={teacherProfile.name || 'Teacher'}
                        className="size-8 rounded-full border border-slate-100 object-cover shadow-sm"
                        onError={(e) => {
                          e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";
                        }}
                      />
                    ) : (
                      <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-300 to-pink-300 text-[11px] font-semibold text-white shadow-sm">
                        {initialsLabel}
                      </div>
                    )}
                    <div className="hidden md:block text-left">
                      <p className="max-w-24 truncate text-[11px] font-semibold leading-tight text-slate-800">
                        {hasProfileImage ? teacherFirstName : teacherFirstLastName}
                      </p>
                      <p className="mt-0.5 max-w-24 truncate text-[9px] text-slate-400">{teacherProfile.department || 'Teacher'}</p>
                    </div>
                    <ChevronDown size={14} className={`hidden text-slate-400 transition-transform duration-200 md:block ${profileOpen ? 'rotate-180 text-violet-500' : ''}`} />
                  </Motion.button>

                  <AnimatePresence>
                    {profileOpen && (
                    <Motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      data-testid="teacher-profile-glass-card"
                      role="menu"
                      className="absolute right-0 z-50 mt-2 w-[min(280px,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.2),0_4px_12px_rgba(15,23,42,0.05)]"
                    >
                      <div className="flex items-center gap-3 pb-3.5">
                          {hasProfileImage ? (
                            <img
                              src={teacherProfile.profilePic}
                              alt={teacherProfile.name || 'Teacher'}
                              className="size-12 shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
                              onError={(e) => {
                                e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='%239475c4' stroke-width='1.5'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";
                              }}
                            />
                          ) : (
                            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-300 to-pink-300 text-base font-semibold text-white shadow-sm">
                              {initialsLabel}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold tracking-tight text-slate-900">{teacherProfile.name || 'Teacher'}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">{teacherProfile.department || 'Educator'}</p>
                          </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <Motion.button
                          type="button"
                          role="menuitem"
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                          onClick={() => { setProfileOpen(false); navigate('/teacher/settings'); }}
                        >
                          My Profile
                        </Motion.button>
                        <Motion.button
                          type="button"
                          role="menuitem"
                          whileHover={{ y: -2, x: 1 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            setProfileOpen(false);
                            handleLogout();
                          }}
                          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                        >
                          <LogOut size={15} strokeWidth={1.8} />
                          Sign out
                        </Motion.button>
                      </div>
                    </Motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
          </div>
        </header>

        <main className={`flex-1 min-h-0 ${isSmartPlannerRoute ? 'p-0' : ''} ${hasContainedPageScroll ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className={isChatRoute
            ? 'flex h-full min-h-0 flex-col'
            : isSmartPlannerRoute
              ? 'h-full min-h-0'
              : isAttendanceRoute
                ? 'h-full min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-6'
                : 'min-h-full p-6'}>
            <Routes>
              <Route index element={<Navigate to="/teacher/dashboard" replace />} />
              <Route path="dashboard" element={<TeacherDashboard />} />
              <Route path="classes" element={<ClassesHub />} />
              <Route path="classes/:classId" element={<ClassWorkspace />}>
                <Route index element={<Navigate to="overview/analytics" replace />} />
                <Route
                  path="students"
                  element={
                    <PlaceholderModule
                      icon={Users}
                      title="Students"
                      description="Student list, attendance, health records, observations, achievements, analytics, and student-specific AI learning paths live here."
                      actions={studentSectionLinks}
                    />
                  }
                />
                <Route path="overview/analytics"  element={<StudentAnalyticsPortal />} />
                <Route path="overview/attendance" element={<AttendanceManagement />} />
                <Route path="students/attendance" element={<AttendanceManagement />} />
                <Route path="students/health-records" element={<HealthUpdatesAdvanced />} />
                <Route path="students/observations" element={<StudentObservationOverview />} />
                <Route path="students/achievements" element={<TeacherAchievements />} />
                <Route path="students/analytics" element={<StudentAnalyticsPortal />} />
                <Route path="students/:studentId/ai-learning/:subject" element={<AILearningPath />} />
                <Route
                  path="teaching"
                  element={
                    <PlaceholderModule
                      icon={BookOpen}
                      title="Teaching Workspace"
                      description="Lesson planning, notes, questions, materials, and AI teaching assistance are owned by this class workspace."
                      actions={teachingSectionLinks}
                    />
                  }
                />
                <Route path="teaching/lesson-planner" element={<SmartTeachingLessonPlanner />} />
                <Route path="teaching/lesson-planner-wizard" element={<LessonPlannerWizard />} />
                <Route path="teaching/class-notes" element={<ClassNotes />} />
                <Route path="teaching/practice-questions" element={<PracticeQuestions />} />
                <Route path="teaching/language-practice" element={<LanguagePracticeManager />} />
                <Route path="teaching/study-materials" element={<TeacherAlcove />} />
                <Route path="teaching/ai-assistant" element={<GenerateAIPathPortal />} />
                <Route path="assignments" element={<Navigate to="manage" replace />} />
                <Route path="assignments/manage" element={<AssignmentPortal view="manage" />} />
                <Route path="assignments/evaluate" element={<AssignmentPortal view="evaluate" />} />
                <Route
                  path="assessments"
                  element={
                    <PlaceholderModule
                      icon={GraduationCap}
                      title="Assessments"
                      description="Formal exams, results, evaluations, and report cards are separated from practice assignments."
                      actions={assessmentSectionLinks}
                    />
                  }
                />
                <Route path="assessments/exam" element={<ExamResultPortal />} />
                <Route
                  path="communication"
                  element={
                    <PlaceholderModule
                      icon={MessageSquare}
                      title="Communication"
                      description="Chat, parent meetings, student feedback, and excuse letters are centralized so other modules trigger communication instead of duplicating it."
                      actions={communicationSectionLinks}
                    />
                  }
                />
                <Route path="communication/chat" element={<TeacherChat />} />
                <Route path="communication/parent-meetings" element={<ParentMeetings />} />
                <Route path="communication/feedback" element={<TeacherFeedbackPortal />} />
                <Route path="communication/excuse-letters" element={<ExcuseLetters />} />
                <Route
                  path="reports"
                  element={<Navigate to="../assessments/exam" replace />}
                />
              </Route>

              <Route path="calendar" element={<HolidayList />} />
              <Route path="timetable" element={<ClassRoutine />} />
              <Route
                path="notifications"
                element={<TeacherNotifications />}
              />
              <Route path="resource-library" element={<TeacherAlcove />} />
              <Route path="lesson-plan" element={<AIPoweredTeaching />} />
              <Route path="tryout" element={<TryoutManagement />} />
              <Route path="ai-tools" element={<TeacherAIToolsPanel />} />
              <Route path="live-monitor" element={<LiveExamMonitor />} />
              <Route path="ptm" element={<ParentMeetings />} />
              <Route path="settings" element={<MyWorkPortal />} />
              <Route path="test" element={<TestTeacherPortal />} />

              <Route path="my-work-portal" element={<Navigate to="/teacher/settings" replace />} />
              <Route path="class-routine" element={<Navigate to="/teacher/timetable" replace />} />
              <Route path="holidays" element={<Navigate to="/teacher/calendar" replace />} />
              <Route path="attendance" element={<Navigate to={buildClassPath('current', 'students/attendance')} replace />} />
              <Route path="achievements" element={<Navigate to={buildClassPath('current', 'students/achievements')} replace />} />
              <Route path="student-analytics" element={<Navigate to={buildClassPath('current', 'students/analytics')} replace />} />
              <Route path="progress" element={<Navigate to={buildClassPath('current', 'students/analytics')} replace />} />
              <Route path="weak-students" element={<Navigate to={buildClassPath('current', 'students/analytics')} replace />} />
              <Route path="health-updates" element={<Navigate to={buildClassPath('current', 'students/health-records')} replace />} />
              <Route path="student-observations" element={<Navigate to={buildClassPath('current', 'students/observations')} replace />} />
              <Route path="smart-teaching" element={<Navigate to={buildClassPath('current', 'teaching/ai-assistant')} replace />} />
              <Route path="smart-teaching/lesson-planner" element={<Navigate to={buildClassPath('current', 'teaching/lesson-planner')} replace />} />
              <Route path="smart-teaching/lesson-planner-wizard" element={<Navigate to={buildClassPath('current', 'teaching/lesson-planner-wizard')} replace />} />
              <Route path="ai-center" element={<Navigate to="/teacher/lesson-plan" replace />} />
              <Route path="ai-powered-teaching" element={<Navigate to="/teacher/lesson-plan" replace />} />
              <Route path="academic-alcove" element={<Navigate to="/teacher/resource-library" replace />} />
              <Route path="ai-learning/:studentId/:subject" element={<Navigate to={buildClassPath('current', 'students')} replace />} />
              <Route path="parent-meetings" element={<Navigate to={buildClassPath('current', 'communication/parent-meetings')} replace />} />
              <Route path="assignments" element={<Navigate to={buildClassPath('current', 'assignments/manage')} replace />} />
              <Route path="evaluation" element={<Navigate to={buildClassPath('current', 'assignments/evaluate')} replace />} />
              <Route path="practice-questions" element={<Navigate to={buildClassPath('current', 'teaching/practice-questions')} replace />} />
              <Route path="language-practice" element={<Navigate to={buildClassPath('current', 'teaching/language-practice')} replace />} />
              <Route path="chat" element={<Navigate to={buildClassPath('current', 'communication/chat')} replace />} />
              <Route path="class-notes" element={<Navigate to={buildClassPath('current', 'teaching/class-notes')} replace />} />
              <Route path="exams" element={<Navigate to={buildClassPath('current', 'assessments/exam')} replace />} />
              <Route path="result-management" element={<Navigate to={buildClassPath('current', 'assessments/exam')} replace />} />
              <Route path="results" element={<Navigate to={buildClassPath('current', 'assessments/exam')} replace />} />
              <Route path="excuse-letters" element={<Navigate to={buildClassPath('current', 'communication/excuse-letters')} replace />} />
              <Route path="feedback" element={<Navigate to={buildClassPath('current', 'communication/feedback')} replace />} />
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

const TeacherPortal = () => (
  <TeacherPortalErrorBoundary>
    <TeacherPortalShell />
  </TeacherPortalErrorBoundary>
);

export default TeacherPortal;
