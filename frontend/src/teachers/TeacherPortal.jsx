import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, NavLink, Outlet, useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import {
  Users,
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
  Library,
  Settings,
  RefreshCw,
  CalendarCheck,
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
import MyWorkPortal from './MyWorkPortal';
import ClassRoutine from './ClassRoutine';
import StudentObservationOverview from './StudentObservationOverview';
import ClassNotes from './ClassNotes';
import PracticeQuestions from './PracticeQuestions';
import TeacherFeedbackPortal from './TeacherFeedbackPortal';
import ExcuseLetters from './ExcuseLetters';
import ExamResultPortal from './ExamResultPortal';
import HolidayList from './HolidayList';
import TeacherAchievements from './TeacherAchievements';
import TeacherAlcove from './TeacherAlcove';
import { useDesktopNotificationBridge } from '../hooks/useDesktopNotificationBridge';
import DesktopNotificationPermissionModal from '../components/DesktopNotificationPermissionModal';
import { AUTH_NOTICE, apiFetch, logoutAndRedirect } from '../utils/authSession';

const PORTAL_BASE = '/teacher';
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const MotionNavLink = Motion(NavLink);

const portalNavigation = [
  { icon: Home, label: 'Dashboard', path: `${PORTAL_BASE}/dashboard` },
  { icon: Users, label: 'Classes & Work', path: `${PORTAL_BASE}/classes` },
  { icon: CalendarDays, label: 'Calendar', path: `${PORTAL_BASE}/calendar` },
  { icon: Clock, label: 'Timetable', path: `${PORTAL_BASE}/timetable` },
  { icon: Bell, label: 'Notifications', path: `${PORTAL_BASE}/notifications` },
  { icon: Library, label: 'Academic Alcove', path: `${PORTAL_BASE}/resource-library` },
  { icon: Brain, label: 'Lesson Plan', path: `${PORTAL_BASE}/lesson-plan` },
  { icon: CalendarCheck, label: 'PTM', path: `${PORTAL_BASE}/ptm` },
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

const teachingLinks = [
  { label: 'Lesson Planner Wizard', to: 'teaching/lesson-planner-wizard' },
  { label: 'Class Notes', to: 'teaching/class-notes' },
  { label: 'Practice Questions', to: 'teaching/practice-questions' },
  { label: 'Study Materials', to: 'teaching/study-materials' },
  { label: 'AI Teaching Assistant', to: 'teaching/ai-assistant' },
];

const studentSectionLinks = studentsLinks.map((item) => ({
  ...item,
  to: item.to.replace(/^students\/?/, '') || '.',
}));

const teachingSectionLinks = teachingLinks.map((item) => ({
  ...item,
  to: item.to.replace(/^teaching\/?/, '') || '.',
}));

const assessmentLinks = [
  { label: 'Exam', to: 'assessments/exam' },
];

const assessmentSectionLinks = assessmentLinks.map((item) => ({
  ...item,
  to: item.to.replace(/^assessments\/?/, '') || '.',
}));

const communicationLinks = [
  { label: 'Chat', to: 'communication/chat' },
  { label: 'Parent Meetings', to: 'communication/parent-meetings' },
  { label: 'Student Feedback', to: 'communication/feedback' },
  { label: 'Excuse Letters', to: 'communication/excuse-letters' },
];

const communicationSectionLinks = communicationLinks.map((item) => ({
  ...item,
  to: item.to.replace(/^communication\/?/, '') || '.',
}));

const buildClassPath = (classId, section) =>
  `${PORTAL_BASE}/classes/${encodeURIComponent(classId || 'current')}${section ? `/${section}` : ''}`;

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

const ClassesHub = () => {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadClasses = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/teacher/dashboard/allocations`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => []);
        setAllocations(Array.isArray(data) ? data : []);
      } catch {
        setAllocations([]);
      } finally {
        setLoading(false);
      }
    };
    loadClasses();
  }, []);

  const classes = useMemo(() => {
    const grouped = new Map();

    allocations.forEach((item, index) => {
      const className = item?.classId?.name || item?.className || 'Class';
      const sectionName = item?.sectionId?.name || item?.sectionName || 'Section';
      const key = `${String(className).trim().toLowerCase()}::${String(sectionName).trim().toLowerCase()}`;
      const subjectName = item?.subjectId?.name || item?.subjectName || item?.subject || 'Assigned subject';
      const mongoId = item?.classId?._id || item?.classId?.id || '';
      const slug = `${String(className).trim()}-${String(sectionName).trim()}`
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `class-${index + 1}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          id: slug,
          mongoId,
          title: `${className} ${sectionName}`.trim(),
          subjects: [],
          isClassTeacher: false,
        });
      }

      const entry = grouped.get(key);
      if (subjectName && !entry.subjects.includes(subjectName)) {
        entry.subjects.push(subjectName);
      }
      if (item?.isClassTeacher) {
        entry.isClassTeacher = true;
      }
    });

    return Array.from(grouped.values()).map((item) => ({
      ...item,
      subject:
        item.subjects.length === 0
          ? 'Assigned subject'
          : item.subjects.length === 1
            ? item.subjects[0]
            : `${item.subjects.slice(0, 2).join(', ')}${item.subjects.length > 2 ? ` +${item.subjects.length - 2}` : ''}`,
      role: item.isClassTeacher ? 'Class teacher' : 'Subject teacher',
    }));
  }, [allocations]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Class-centric workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Classes</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Choose a class-section first. Everything inside this area is scoped to that class context: students, teaching, assignments, assessments, communication, and reports.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading assigned classes...</div>
      ) : classes.length === 0 ? (
        <PlaceholderModule
          icon={Users}
          title="No assigned class-section found"
          description="Your class allocations are not available yet. Use Current Class to continue working with the class-scoped tools."
          actions={[{ label: 'Open Current Class', to: buildClassPath('current') }]}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((item) => (
            <NavLink
              key={item.id}
              to={buildClassPath(item.id)}
              state={{ className: item.title, classMongoId: item.mongoId }}
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-200/70"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.subject}</p>
                </div>
                <ChevronRight size={18} className="text-slate-400" />
              </div>
              <span className="mt-4 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {item.role}
              </span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};

/*
 * Image reference (Content.png):
 *   Title  : "Class :5  Section : A"  — bold, large, centered
 *   Sub    : "Switch class"            — small oval pill, centered
 *   Tabs   : Overview | Students | Observations | AI  (4 tabs, pill bar, centered)
 *            Active = indigo fill (#4F46E5), inactive = dark text, no fill
 *   Caret  : small downward triangle below active tab, connecting to sub-bar
 *   Sub-bar: lavender pill (#EEF2FF / #C7D2FE), 3 items with indigo bullet dots
 *            Active sub-item = white pill inside
 */
const CW_TABS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: Home,
    // Owns the index and the two overview/* alias routes
    ownPaths: (rel) =>
      rel === '' ||
      rel === 'overview' ||
      rel.startsWith('overview/'),
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
      rel === 'assignments' ||
      rel === 'reports' ||
      rel.startsWith('assessments'),
    firstPath: 'students/health-records',
    subTabs: [
      { label: 'Student Health Records', path: 'students/health-records' },
      { label: 'Attendance',             path: 'students/attendance' },
      { label: 'Assignments',            path: 'assignments' },
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
  const [className, setClassName] = useState('');
  const [sectionName, setSectionName] = useState('');
  const basePath = buildClassPath(classId);

  // ── Resolve class name + section separately ───────────────
  useEffect(() => {
    // seed from navigation state
    const navName = location.state?.className || '';
    if (navName) {
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
        const alloc = data.find((it) => {
          if (classMongoId) {
            const aid = it?.classId?._id || it?.classId?.id || it?.classId;
            return String(aid || '') === String(classMongoId);
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
  }, [classId, location.state?.className]);

  // ── Active tab ────────────────────────────────────────────
  const rel = location.pathname.replace(basePath, '').replace(/^\//, '');
  const activeTab = useMemo(() => CW_TABS.find((t) => t.ownPaths(rel)) ?? CW_TABS[0], [rel]);
  const hasSubTabs = activeTab.subTabs.length > 0;

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
            Active: fill=#4F46E5, rx=18.5, h=37
        ──────────────────────────────────────────────────── */}
        <div className="flex justify-center px-6 pt-4 pb-0">
          <div className="inline-flex items-center gap-[5px] rounded-[24px] border border-[#E2E8F0] bg-[#F8FAFC] p-[5.5px]">
            {CW_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab.id;
              const to = tab.subTabs.length > 0
                ? `${basePath}/${tab.firstPath}`
                : `${basePath}/${tab.firstPath}`;
              return (
                <NavLink
                  key={tab.id}
                  to={to}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-[18px] px-4 text-[13.5px] font-semibold',
                    'h-[37px] whitespace-nowrap transition-all duration-150',
                    isActive
                      ? 'bg-white text-white shadow-sm'
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
            Sub-bar: rx=21.5, fill=#EEF2FF, stroke=#C7D2FE
            Active sub-item: rx=16, fill=white, h=32
            Items: indigo bullet dot + text
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
                borderTop: '10px solid #EEF2FF',
                filter: 'drop-shadow(0 -1px 0 #C7D2FE)',
              }}
            />

            {/* Sub-bar pill */}
            <div className="inline-flex items-center gap-[5px] rounded-[22px] border border-[#C7D2FE] bg-[#EEF2FF] p-[5.5px]">
              {activeTab.subTabs.map((sub, idx) => (
                <NavLink
                  key={sub.path + idx}
                  to={`${basePath}/${sub.path}`}
                  className={({ isActive: ia }) =>
                    [
                      'inline-flex items-center gap-1.5 rounded-[16px] px-3',
                      'h-8 text-[12.5px] font-semibold whitespace-nowrap transition-all duration-150',
                      ia
                        ? 'bg-white text-[#0F172A] shadow-sm'
                        : 'text-[#4338CA] hover:text-[#312E81]',
                    ].join(' ')
                  }
                >
                  {/* Indigo bullet dot — r=2.5 from SVG */}
                  <span className="w-[5px] h-[5px] rounded-full bg-[#4F46E5] shrink-0" />
                  {sub.label}
                </NavLink>
              ))}
            </div>
          </Motion.div>
        )}

        {!hasSubTabs && <div className="pb-4" />}
      </div>

      {/* Child route */}
      <Outlet />

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
  const isSmartPlannerRoute = location.pathname.includes('/teaching/lesson-planner');

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
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen flex flex-col bg-white shadow-2xl border-r border-gray-200 overflow-x-hidden ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'
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
            <div className="absolute inset-0 bg-yellow-400 via-yellow-450 opacity-100" />
            <div className="relative p-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="relative">
                    <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/30">
                      <Users size={17} className="text-black" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
                  </div>
                  <div className="text-white">
                    <div className="font-bold text-black text-base leading-tight">Teacher Portal</div>
                    <div className="text-black/80 text-[11px]">Academic Workspace</div>
                  </div>
                </div>
                <button
                  className="hidden lg:inline-flex rounded-lg p-1.5 text-white/90 hover:bg-white/20 transition-colors"
                  onClick={() => setSidebarCollapsed(true)}
                  aria-label="Collapse sidebar"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-1.5 rounded-lg bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors border border-white/30"
                >
                  <X size={17} />
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
              <div className="flex flex-col items-center space-y-2.5">
                <div className="relative">
                  <div className="w-9 h-9 bg-linear-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-md">
                    <Users size={16} className="text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                </div>
                <div className="w-8 h-px bg-gray-300" />
                <button
                  className="hidden lg:inline-flex rounded-lg p-1.5 text-gray-600 hover:bg-gray-100"
                  onClick={() => setSidebarCollapsed(false)}
                  aria-label="Expand sidebar"
                >
                  <ChevronRight size={16} className="rotate-180" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${!sidebarCollapsed ? 'px-3 py-4' : 'px-1 py-2'}`}>
          <div className={`${!sidebarCollapsed ? 'space-y-1' : 'space-y-1'}`}>
            {portalNavigation.map((item) => {
              const active = isItemActive(item.path);
              const Icon = item.icon;
              return (
                <Button
                  key={item.path}
                  asChild
                  variant="ghost"
                  className={`group relative !h-auto !w-full !justify-start !rounded-xl !px-3 !py-2.5 !text-xs !font-semibold ${sidebarCollapsed ? '!justify-center' : 'space-x-2.5'} ${
                    active
                      ? 'bg-linear-to-r from-amber-100 via-yellow-50 to-violet-50 text-amber-950 shadow-sm shadow-amber-100 ring-1 ring-amber-200/80'
                      : 'text-slate-600 hover:bg-linear-to-r hover:from-amber-50 hover:via-yellow-50 hover:to-violet-50 hover:text-amber-950 hover:ring-1 hover:ring-amber-200/70'
                  }`}
                >
                  <MotionNavLink
                    to={item.path}
                    title={sidebarCollapsed ? item.label : undefined}
                    whileHover={{ x: sidebarCollapsed ? 0 : 3, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                    className="flex w-full items-center"
                  >
                    <span className="relative flex shrink-0 items-center justify-center">
                      <span className="absolute inset-0 rounded-lg bg-violet-200/0 transition-colors duration-200 group-hover:bg-violet-200/50" />
                      <Icon size={17} className="relative shrink-0 transition-transform duration-200 group-hover:scale-105" />
                    </span>
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </MotionNavLink>
                </Button>
              );
            })}
          </div>        
        </nav>

        {/* ── Bottom: Logout ── */}
        <div className={`shrink-0 border-t border-gray-200 ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
          <div className={`${!sidebarCollapsed ? 'space-y-2' : 'space-y-1'}`}>
            {sidebarCollapsed ? (
              <button
                onClick={handleLogout}
                className="group relative w-full h-11 flex items-center justify-center rounded-xl text-red-500 hover:bg-linear-to-r hover:from-red-50 hover:to-pink-50 hover:scale-105 hover:shadow-md hover:text-red-600 transition-all duration-300 ease-out transform active:scale-95"
              >
                <div className="relative flex items-center justify-center w-5.5 h-5.5 transition-all duration-300 text-red-500 group-hover:text-red-600 group-hover:scale-110">
                  <LogOut size={16} strokeWidth={1.8} className="shrink-0 transition-all duration-300" />
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
                className="group relative w-full flex items-center px-3 py-2.5 rounded-xl text-red-600 hover:bg-linear-to-r hover:from-red-50 hover:to-pink-50 hover:text-red-700 hover:shadow-md hover:scale-105 transition-all duration-300 ease-out transform active:scale-95"
              >
                <div className="flex items-center justify-center w-[34px] h-[34px] rounded-lg bg-red-100 text-red-600 group-hover:bg-red-200 group-hover:scale-110 transition-all duration-300">
                  <LogOut size={17} className="shrink-0 transition-all duration-300" />
                </div>
                <div className="ml-3">
                  <div className="font-medium text-xs transition-all duration-300">Logout</div>
                  <div className="text-[11px] text-red-500 group-hover:text-red-600 transition-all duration-300">Sign out securely</div>
                </div>
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col h-screen">
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
        </header>

        <main className={`flex-1 min-h-0 ${isSmartPlannerRoute ? 'p-0' : ''} ${isChatRoute ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className={isChatRoute ? 'h-full flex flex-col' : undefined}>
            <Routes>
              <Route index element={<Navigate to="/teacher/dashboard" replace />} />
              <Route path="dashboard" element={<TeacherDashboard />} />
              <Route path="classes" element={<ClassesHub />} />
              <Route path="classes/:classId" element={<ClassWorkspace />}>
                <Route
                  index
                  element={
                    <PlaceholderModule
                      icon={Home}
                      title="Class Overview"
                      description="A concise class command center for roster health, today's schedule, open work, recent notifications, and risk signals."
                      actions={studentsLinks.slice(0, 3)}
                    />
                  }
                />
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
                <Route path="teaching/study-materials" element={<TeacherAlcove />} />
                <Route path="teaching/ai-assistant" element={<AIPoweredTeaching />} />
                <Route path="assignments" element={<AssignmentPortal />} />
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
              <Route path="assignments" element={<Navigate to={buildClassPath('current', 'assignments')} replace />} />
              <Route path="evaluation" element={<Navigate to={buildClassPath('current', 'assignments')} replace />} />
              <Route path="practice-questions" element={<Navigate to={buildClassPath('current', 'teaching/practice-questions')} replace />} />
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
