/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion as framerMotion, useReducedMotion } from 'framer-motion';

import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  MessageSquare,
  Sparkles,
  Users,
  Zap,
  Star,
  PenLine,
  ClipboardList,
  Megaphone,
} from 'lucide-react';

const MotionSection = framerMotion.section;
const MotionDiv = framerMotion.div;
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const getAcademicYearId = (item = {}) =>
  String(item?.classId?.academicYearId?._id || item?.classId?.academicYearId || '').trim();

const cx = (...classes) => classes.filter(Boolean).join(' ');

// Builds the same `class-section` slug TeacherPortal's ClassWorkspace uses to
// resolve a specific allocation (see buildClassPath/slug matching in
// TeacherPortal.jsx). classItem.class from the dashboard API is already
// "ClassName-SectionName" (e.g. "5-A"), so schedule links can jump straight
// to that class's attendance/teaching pages instead of the generic
// `classes/current/...` shortcut, which always resolves to the teacher's
// primary class-teacher allocation regardless of which class was clicked.
const slugifyClassLabel = (label) => {
  const slug = String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'current';
};

const classWorkspacePath = (classItem, subPath) =>
  `/teacher/classes/${encodeURIComponent(slugifyClassLabel(classItem?.class))}/${subPath}`;

const clampPercent = (value, fallback = 0) => {
  const numeric = Number.parseFloat(String(value ?? '').replace('%', ''));
  if (Number.isNaN(numeric)) return fallback;
  return Math.max(0, Math.min(100, numeric));
};

const formatDate = (value, options = { month: 'short', day: 'numeric' }) => {
  if (!value) return 'TBA';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', options);
};

// Client-side dashboard cache (per teacher token) so revisits paint instantly.
const DASHBOARD_CACHE_KEY = 'teacher_dashboard_cache_v1';
const DASHBOARD_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const dashboardCacheOwner = () => String(localStorage.getItem('token') || '').slice(-24);

const readDashboardCache = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DASHBOARD_CACHE_KEY) || 'null');
    if (!parsed || parsed.owner !== dashboardCacheOwner()) return null;
    if (Date.now() - Number(parsed.savedAt || 0) > DASHBOARD_CACHE_MAX_AGE_MS) return null;
    return parsed.data || null;
  } catch {
    return null;
  }
};

const writeDashboardCache = (data) => {
  try {
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ owner: dashboardCacheOwner(), savedAt: Date.now(), data }));
  } catch { /* storage full or blocked — cache is optional */ }
};

// School cover photo (admin settings) shown in the greeting banner.
const coverImageOf = (dashboard) => String(dashboard?.school?.coverImage || '').trim();

const deadlineKey = (task) =>
  String(task?.id || `${task?.title || ''}|${task?.class || ''}|${task?.dueDate || ''}`);

// ── Glass design tokens ───────────────────────────────────────────────────────
// Frosted-glass surfaces used throughout: semi-transparent white + blur/
// saturate, soft white borders, and a gentle shadow. Kept as shared class
// strings so every card/pill in the dashboard reads as one consistent system.
const GLASS_PANEL = 'border border-white/70 bg-white/60 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl backdrop-saturate-[1.8]';
const GLASS_PANEL_SOLID = 'border border-white/80 bg-white/75 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)] backdrop-blur-xl backdrop-saturate-[1.8]';

const TeacherDashboard = () => {
  const reduceMotion = useReducedMotion();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [dashboardData, setDashboardData] = useState(null);
  const [classTeacherAllocations, setClassTeacherAllocations] = useState([]);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [clearedDeadlines, setClearedDeadlines] = useState(() => new Set());
  const [completingDeadlineId, setCompletingDeadlineId] = useState('');
  const [deadlineError, setDeadlineError] = useState('');

  const clearDeadline = async (task) => {
    const taskId = deadlineKey(task);
    if (!task?.id || completingDeadlineId) return;
    setDeadlineError('');
    setCompletingDeadlineId(taskId);
    setClearedDeadlines((previous) => new Set(previous).add(taskId));
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/teacher/dashboard/deadlines/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Unable to complete deadline task');
    } catch (err) {
      setClearedDeadlines((previous) => {
        const next = new Set(previous);
        next.delete(taskId);
        return next;
      });
      setDeadlineError(err.message || 'Unable to complete deadline task');
    } finally {
      setCompletingDeadlineId('');
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchDashboard = async () => {
      setDashboardError('');
      // Stale-while-revalidate: paint the last dashboard instantly from the
      // per-teacher cache, then refresh it from the server in the background.
      const cached = readDashboardCache();
      if (cached) {
        setDashboardData(cached.dashboard);
        setClassTeacherAllocations(cached.classTeacherAllocations || []);
        setDashboardLoading(false);
      } else {
        setDashboardLoading(true);
      }
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        };
        const [dashboardRes, allocationRes, activeYearRes] = await Promise.all([
          fetch(`${API_BASE}/api/teacher/dashboard`, { headers }),
          fetch(`${API_BASE}/api/teacher/dashboard/allocations`, { headers }),
          fetch(`${API_BASE}/api/academic/active-year`, { headers }).catch(() => null),
        ]);

        const dashboardPayload = await dashboardRes.json().catch(() => ({}));
        if (!dashboardRes.ok) {
          throw new Error(dashboardPayload?.error || 'Unable to load dashboard data');
        }
        setDashboardData(dashboardPayload);

        const allocationPayload = await allocationRes.json().catch(() => []);
        if (allocationRes.ok && Array.isArray(allocationPayload)) {
          const activeYearPayload = activeYearRes?.ok ? await activeYearRes.json().catch(() => null) : null;
          const activeYearId = String(
            activeYearPayload?._id ||
            activeYearPayload?.id ||
            activeYearPayload?.data?._id ||
            activeYearPayload?.data?.id ||
            ''
          ).trim();
          const classTeacherOnly = allocationPayload
            .filter((item) => Boolean(item?.isClassTeacher))
            .filter((item) => {
              if (!activeYearId) return false;
              return getAcademicYearId(item) === activeYearId;
            });
          setClassTeacherAllocations(classTeacherOnly);
          writeDashboardCache({ dashboard: dashboardPayload, classTeacherAllocations: classTeacherOnly });
        } else {
          setClassTeacherAllocations([]);
          writeDashboardCache({ dashboard: dashboardPayload, classTeacherAllocations: [] });
        }
      } catch (error) {
        // Keep showing cached data if the refresh fails; only surface the error otherwise.
        if (!cached) setDashboardError(error.message || 'Unable to load dashboard data');
      } finally {
        setDashboardLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const timeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    if (Number.isNaN(diffMs)) return 'Just now';
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const getGreeting = () => {
    const hour = currentDateTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const dateStr = currentDateTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const stats = dashboardData?.stats || {};
  const teacherName = dashboardData?.teacher?.name || 'Teacher';
  const classTeacherLabel = classTeacherAllocations.length
    ? classTeacherAllocations
      .map((item) => {
        const className = item?.classId?.name || item?.className || 'Class';
        const sectionName = item?.sectionId?.name || item?.sectionName || 'Section';
        return `${className}-${sectionName}`;
      })
      .join(', ')
    : 'No class teacher allocation';

  const todaysClasses = Array.isArray(dashboardData?.todaysClasses) ? dashboardData.todaysClasses : [];
  const performanceMetrics = dashboardData?.performanceMetrics || [];
  const upcomingDeadlines = dashboardData?.upcomingDeadlines || [];
  const recentActivities = (dashboardData?.recentActivities || []).map((activity) => ({
    ...activity,
    time: timeAgo(activity.time),
  }));

  const visibleDeadlines = upcomingDeadlines.filter((task) => !clearedDeadlines.has(deadlineKey(task)));

  const nextClass = dashboardData?.nextClass || null;
  const pendingTasks = Number(stats.pendingEvaluations ?? visibleDeadlines.length ?? 0);

  const pageVariants = reduceMotion ? {} : {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = reduceMotion ? {} : {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  };

  // ── Desktop dashboard data ──
  const completedClasses = todaysClasses.filter((c) => c.status === 'Completed').length;
  const attendance = {
    present: dashboardData?.attendanceSummary?.present ?? 0,
    absent: dashboardData?.attendanceSummary?.absent ?? 0,
    notMarked: dashboardData?.attendanceSummary?.notMarked ?? 0,
  };
  // Today's attendance: students marked present today out of all students
  // in the teacher's classes (unmarked students count as not present yet).
  const attendanceTotal = attendance.present + attendance.absent + attendance.notMarked;
  const attendancePercent = attendanceTotal ? (attendance.present / attendanceTotal) * 100 : 0;

  const statCards = [
    { label: 'My Classes Today', value: todaysClasses.length, helper: 'View Schedule →', icon: BookOpen, iconBg: 'bg-blue-500', iconColor: 'text-white', to: '/teacher/timetable' },
    { label: 'Total Students', value: stats.totalStudents ?? 0, helper: 'Across my classes', icon: Users, iconBg: 'bg-green-500', iconColor: 'text-white', to: '/teacher/classes' },
    { label: 'Attendance', value: `${completedClasses} / ${todaysClasses.length}`, helper: 'Classes completed', icon: CheckCircle2, iconBg: 'bg-red-500', iconColor: 'text-white', to: '/teacher/classes/current/students/attendance' },
    { label: 'Submissions to Grade', value: pendingTasks, helper: 'Homework / assignments to check', icon: ClipboardList, iconBg: 'bg-orange-500', iconColor: 'text-white', to: '/teacher/classes/current/assignments' },
  ];

  const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const todayIdx = (currentDateTime.getDay() + 6) % 7;
  const nowMinutes = currentDateTime.getHours() * 60 + currentDateTime.getMinutes();
  const toMinutes = (t) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const upcomingSchedule = (Array.isArray(dashboardData?.upcomingClasses) ? dashboardData.upcomingClasses : [])
    .map((c) => {
      const offset = (WEEK.indexOf(c.dayOfWeek) - todayIdx + 7) % 7;
      const start = toMinutes(c.startTime);
      return { ...c, offset, start: start ?? Number(c.period || 0) };
    })
    .filter((c) => c.offset > 0 || (c.start ?? 0) >= nowMinutes)
    .sort((a, b) => a.offset - b.offset || a.start - b.start)
    .slice(0, 4)
    .map((c) => ({ ...c, dayLabel: c.offset === 0 ? 'Today' : c.offset === 1 ? 'Tomorrow' : c.dayOfWeek }));

  const lowSubject = performanceMetrics.find((m) => Number(m.average) < 50);
  const studentAlerts = [
    attendance.absent > 0 && { title: `${attendance.absent} student${attendance.absent === 1 ? '' : 's'} absent today`, sub: 'Need attention', icon: Users, cls: 'bg-red-400 text-white', to: '/teacher/classes/current/students/attendance' },
    pendingTasks > 0 && { title: `${pendingTasks} submission${pendingTasks === 1 ? '' : 's'} awaiting review`, sub: 'Homework / assignments', icon: FileText, cls: 'bg-orange-400 text-white', to: '/teacher/classes/current/assignments' },
    lowSubject && { title: `${lowSubject.subject} average is ${lowSubject.average}%`, sub: 'Recent tests', icon: Star, cls: 'bg-amber-500 text-white', to: '/teacher/classes/current/students/analytics' },
  ].filter(Boolean);

  const mobileClassLabel = classTeacherAllocations.length
    ? classTeacherAllocations
      .map((item) => {
        const className = item?.classId?.name || item?.className || 'Class';
        const sectionName = item?.sectionId?.name || item?.sectionName || '';
        return `${className}${sectionName ? ` ${sectionName}` : ''}`;
      })
      .join(' • ')
    : 'No class assigned';

  return (
    <div className="min-h-0 bg-[#f1f5f9] text-[#0f172a]">
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-1 pb-4 sm:max-w-xl md:max-w-none md:px-8 lg:hidden">
        {dashboardError && (
          <div className={cx('flex items-center gap-2 rounded-2xl border-rose-200/70 bg-rose-50/80 px-4 py-3 text-xs font-medium text-rose-700 backdrop-blur-sm')}>
            <AlertCircle size={16} /> {dashboardError}
          </div>
        )}

        {/* Top app bar */}
        <header className="flex items-center justify-between gap-3 px-1 py-1">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-sky-400 p-[2px] shadow-sm shadow-violet-200">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[14px] bg-white text-[#8b5cf6]">
                <BookOpen size={19} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-sm font-bold tracking-tight text-[#0f172a]">{teacherName}</h1>
                <span className="shrink-0 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-[#7c3aed]">Portal</span>
              </div>
              <p className="truncate text-xs font-medium text-[#64748b]">{mobileClassLabel}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Link to="/teacher/notifications" aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-[#64748b] shadow-sm transition active:scale-95">
              <Bell size={16} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </Link>
            <Link to="/teacher/settings" aria-label="Open profile" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#7c3aed] to-indigo-500 p-[2px] shadow-sm transition active:scale-95">
              <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-xs font-bold text-[#7c3aed]">
                {teacherName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'T'}
              </span>
            </Link>
          </div>
        </header>

        {/* Hero card */}
        <section className={cx('relative overflow-hidden rounded-3xl p-5', GLASS_PANEL_SOLID)}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.14),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.1),transparent_50%)]" />
          <div className="relative z-10">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-[10px] font-bold text-[#8b5cf6] shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live workspace
              </span>
              <span className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-[10px] font-medium text-[#64748b] shadow-sm">
                {currentDateTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {currentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <h2 className="text-2xl font-black leading-snug tracking-tight text-[#0f172a]">
              {getGreeting()}, {teacherName.split(' ')[0]}.
            </h2>
            <p className="mt-1 mb-4 text-xs leading-relaxed text-[#64748b]">
              {dashboardLoading
                ? 'Loading today\'s timetable and workload context…'
                : `You have ${todaysClasses.length} ${todaysClasses.length === 1 ? 'class' : 'classes'} today and ${pendingTasks} tasks waiting.`}
            </p>
            <div className="flex items-center gap-2.5">
              <Link to="/teacher/classes" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#8b5cf6] px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-violet-300/50 transition active:scale-[.98]">
                Open classes <ArrowUpRight size={14} />
              </Link>
              <Link to="/teacher/lesson-plan" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/70 bg-white/80 px-4 py-2.5 text-xs font-semibold text-[#0f172a] shadow-sm backdrop-blur-sm transition active:scale-[.98]">
                Ask AI <Sparkles size={14} className="text-[#8b5cf6]" />
              </Link>
            </div>
          </div>
        </section>

        {/* Quick status overview */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#94a3b8]">Class &amp; Schedule Status</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {[
              { icon: Users, label: 'Class Teacher', value: classTeacherLabel, to: '/teacher/classes', tone: 'bg-slate-100 text-slate-500' },
              {
                icon: Clock,
                label: 'Next Class',
                value: dashboardLoading
                  ? 'Loading from timetable…'
                  : nextClass ? `${nextClass.subject || nextClass.class || 'Details unavailable'} • ${nextClass.time}` : 'No more classes today',
                to: '/teacher/classes',
                tone: 'bg-violet-50 text-[#8b5cf6]',
              },
              {
                icon: CheckCircle2,
                label: 'Workload',
                value: pendingTasks > 0 ? `${pendingTasks} actions need review` : 'Clear for focused teaching',
                to: '/teacher/classes/current/assignments',
                tone: 'bg-emerald-50 text-emerald-600',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} to={item.to} className={cx('flex items-center justify-between gap-3 rounded-2xl p-3.5 transition active:scale-[.99]', GLASS_PANEL)}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', item.tone)}><Icon size={17} /></div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">{item.label}</p>
                      <p className="truncate text-xs font-semibold text-[#0f172a]">{item.value}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-slate-300" />
                </Link>
              );
            })}
          </div>
        </section>

        {/* Quick pill shortcuts */}
        <section className="space-y-2 pt-1">
          <span className="px-1 text-xs font-bold uppercase tracking-wider text-[#94a3b8]">Quick Shortcuts</span>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {[
              { label: 'Lesson Plan', icon: Calendar, to: '/teacher/lesson-plan' },
              { label: 'PTM', icon: Users, to: '/teacher/ptm' },
              { label: 'Student Chat', icon: MessageSquare, to: '/teacher/classes/current/communication/chat' },
              { label: 'Excuse Letters', icon: FileText, to: '/teacher/classes/current/communication/excuse-letters' },
              { label: 'Academic Alcove', icon: BookOpen, to: '/teacher/resource-library' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} to={item.to} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs font-medium text-[#0f172a] shadow-sm transition active:bg-slate-50">
                  <Icon size={14} className="text-[#8b5cf6]" /> {item.label}
                </Link>
              );
            })}
          </div>
        </section>

        {/* Workflow actions */}
        <section className={cx('rounded-3xl p-4', GLASS_PANEL)}>
          <div className="flex items-start justify-between gap-3 border-b border-white/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-violet-50/80 text-[#8b5cf6]"><Zap size={16} /></div>
              <div>
                <h3 className="text-sm font-bold text-[#0f172a]">Workflow Actions</h3>
                <p className="text-[11px] text-[#64748b]">Grouped by how teachers actually move through the day.</p>
              </div>
            </div>
            <Link to="/teacher/classes" className="shrink-0 text-xs font-semibold text-[#8b5cf6]">View modules</Link>
          </div>
          <div className="md:grid md:grid-cols-2 md:gap-x-6">
            {[
              {
                title: 'Core Actions', items: [
                  { title: 'Open Classes', description: 'Jump into roster and class context.', icon: Users, path: '/teacher/classes' },
                  { title: 'Attendance', description: 'Mark today and review exceptions.', icon: ClipboardCheck, path: '/teacher/classes/current/students/attendance' },
                ]
              },
              {
                title: 'Support', items: [
                  { title: 'Teaching', description: 'Lesson materials and notes.', icon: BookOpen, path: '/teacher/classes/current/teaching' },
                  { title: 'AI Center', description: 'Get class insights and teaching support.', icon: Sparkles, path: '/teacher/lesson-plan' },
                ]
              },
            ].map((group) => (
              <div key={group.title} className="mt-4">
                <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">{group.title}</p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.title} to={item.path} className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/50 p-3 transition active:scale-[.99] hover:bg-white/80">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/70 bg-white text-[#64748b] shadow-sm"><Icon size={16} /></div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#0f172a]">{item.title}</h4>
                          <p className="mt-0.5 text-[11px] leading-snug text-[#64748b]">{item.description}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="hidden lg:block">
        <MotionDiv variants={pageVariants} initial="hidden" animate="show" className="mx-auto max-w-[1240px] space-y-4 px-5 pb-6 pt-1">
          {dashboardError && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              <AlertCircle size={16} /> {dashboardError}
            </div>
          )}

          {/* ── Greeting banner ── */}
          <MotionSection variants={itemVariants} className="relative overflow-hidden rounded-2xl border border-white bg-gradient-to-r from-[#eaf1fd] via-[#eef4fd] to-[#dfeafb] px-7 py-5 shadow-[0_4px_18px_rgba(30,64,175,0.06)]">
            {coverImageOf(dashboardData) ? (
              // Same treatment as the parent/admin banners: photo fully clear on
              // the right, blending only on its left edge into the banner.
              <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-3/5 overflow-hidden">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${coverImageOf(dashboardData)})` }} />
                <div className="absolute inset-0 bg-gradient-to-r from-[#eef4fd] via-[#eef4fd]/40 to-transparent" />
              </div>
            ) : (
              <SchoolIllustration />
            )}
            <div className="relative z-10">
              <h1 className="text-[26px] font-bold tracking-tight text-slate-900">
                {getGreeting()}, {teacherName} 
                {/* <span aria-hidden="true">👋</span> */}
              </h1>
              <p className="mt-1 text-[15px] text-slate-600">
                {dateStr} <span className="mx-1.5 text-slate-300">|</span> Have a great day of teaching!
              </p>
            </div>
          </MotionSection>

          {/* ── Stat cards ── */}
          <MotionSection variants={itemVariants} className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {statCards.map((card) => (
              <Link key={card.label} to={card.to} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className={cx('flex h-14 w-14 shrink-0 items-center justify-center rounded-full', card.iconBg)}>
                  {React.createElement(card.icon, { size: 26, className: card.iconColor })}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">{card.label}</p>
                  <p className="text-[26px] font-bold leading-tight text-slate-900">{dashboardLoading ? '—' : card.value}</p>
                  <p className="truncate text-[11px] text-slate-500">{card.helper}</p>
                </div>
              </Link>
            ))}
          </MotionSection>

          {/* ── Classes / Attendance / Quick actions ── */}
          <MotionSection variants={itemVariants} className="grid gap-4 xl:grid-cols-[1.6fr_1fr_0.95fr]">
            <Panel icon={Calendar} iconColor="text-blue-600" title="Today's Classes" link={{ to: '/teacher/timetable', label: 'View Full Schedule' }}>
              {todaysClasses.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">{dashboardLoading ? 'Loading timetable…' : 'No classes scheduled today.'}</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-100">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>{['Time', 'Class', 'Subject', 'Room', 'Status', 'Action'].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {todaysClasses.slice(0, 6).map((c, i) => {
                        const st = c.status === 'In progress' ? 'Ongoing' : c.status;
                        return (
                          <tr key={c.id || i} className="text-slate-800">
                            <td className="whitespace-nowrap px-3 py-2.5">{formatClock(c.startTime) || c.time}</td>
                            <td className="px-3 py-2.5">{c.class || '—'}</td>
                            <td className="px-3 py-2.5">{c.subject || '—'}</td>
                            <td className="px-3 py-2.5">{c.room || '—'}</td>
                            <td className="px-3 py-2.5">
                              <span className={cx('rounded-md px-2 py-1 text-xs font-medium', st === 'Completed' ? 'bg-emerald-50 text-emerald-600' : st === 'Ongoing' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500')}>{st}</span>
                            </td>
                            <td className="px-3 py-2">
                              {st === 'Ongoing' ? (
                                <Link to={classWorkspacePath(c, 'students/attendance')} className="inline-flex w-full justify-center whitespace-nowrap rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700">Take Attendance</Link>
                              ) : (
                                <Link to={classWorkspacePath(c, 'teaching')} className="inline-flex w-full justify-center rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50">View</Link>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel icon={Users} iconColor="text-blue-600" title="Today's Attendance" link={{ to: '/teacher/classes/current/students/attendance', label: 'Details' }}>
              <div className="flex items-center gap-5 px-1">
                <Donut percent={attendancePercent} />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{attendance.present} / {attendanceTotal}</p>
                  <p className="text-sm text-slate-500">Students present today</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 px-1 text-sm">
                {[
                  { label: 'Present', value: attendance.present, dot: 'bg-emerald-500' },
                  { label: 'Absent', value: attendance.absent, dot: 'bg-rose-500' },
                  { label: 'Not Marked', value: attendance.notMarked, dot: 'bg-slate-300' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className={cx('h-3.5 w-3.5 rounded-full', row.dot)} />
                    <span className="flex-1 text-slate-700">{row.label}</span>
                    <span className="w-12 text-right font-semibold text-slate-900">{row.value}</span>
                  </div>
                ))}
              </div>
              <Link to="/teacher/classes/current/students/attendance" className="mt-4 block rounded-full text-white py-2.5 text-center text-sm font-semibold bg-blue-500 hover:bg-blue-700">Take Attendance</Link>
            </Panel>

            <Panel icon={Zap} iconColor="text-amber-500" title="Quick Actions">
              <div className="grid grid-cols-2 gap-2.5">
                {QUICK_ACTIONS.map((a) => (
                  <Link
                    key={a.label}
                    to={a.to}
                    className={cx(
                      'flex h-[76px] flex-col items-center justify-center gap-2 rounded-xl border px-2 text-center text-xs font-medium leading-tight text-gray-700 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
                      a.cls
                    )}
                  >
                    {/* Icon background */}
                    <div
                      className={cx(
                        'flex h-9 w-9 items-center justify-center rounded-full',
                        a.iconBg
                      )}
                    >
                      {React.createElement(a.icon, {
                        size: 18,
                        strokeWidth: 2.2,
                        className: 'text-white',
                      })}
                    </div>

                    {/* Label */}
                    <span className="text-[10px] font-medium text-gray-700">{a.label}</span>
                  </Link>
                ))}
              </div>
            </Panel>
          </MotionSection>

          {/* ── Homework / Schedule / Alerts + Activity ── */}
          <MotionSection variants={itemVariants} className="grid gap-4 xl:grid-cols-3">
            <Panel icon={FileText} iconColor="text-blue-600" title="Homework & Assignments" link={{ to: '/teacher/classes/current/assignments', label: 'View All' }}>
              <p className="-mt-1 mb-3 text-[11.5px] text-slate-500">Your assignments that are due soon or still need follow-up.</p>
              {deadlineError && <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{deadlineError}</p>}
              {visibleDeadlines.length === 0 ? (
                <div className="flex flex-col items-center px-4 py-8 text-center">
                  <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={20} /></span>
                  <p className="text-sm font-semibold text-slate-800">You're all caught up</p>
                  <p className="mt-1 text-xs text-slate-500">No assignment is due soon, and nothing from the last 2 weeks is waiting to be graded or submitted.</p>
                  <Link to="/teacher/classes/current/assignments/manage" className="mt-3 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">+ Create assignment</Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {visibleDeadlines.map((task) => {
                    const total = Number(task.totalStudents) || 0;
                    const done = Number(task.submittedCount) || 0;
                    const toGrade = Number(task.toGradeCount) || 0;
                    const missing = Math.max(0, total - done);
                    const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
                    const due = dueLabel(task.dueDate);
                    return (
                      <div key={deadlineKey(task)} className="flex gap-3 py-3 first:pt-0">
                        <div className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', task.overdue ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600')}><FileText size={17} /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900" title={task.title}>{task.title}</p>
                            <span className={cx('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium', due.cls)}>{due.text}</span>
                          </div>
                          <p className="text-xs text-slate-500">Class {[task.class, task.section].filter(Boolean).join('-') || '—'}{task.subject ? ` • ${task.subject}` : ''}</p>
                          <div className="mt-1.5">
                            <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                              <span><span className="font-semibold text-slate-700">{done}</span> of {total || '—'} students submitted</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-100"><div className={cx('h-full rounded-full', pct === 100 ? 'bg-emerald-500' : 'bg-blue-600')} style={{ width: `${pct}%` }} /></div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {toGrade > 0 && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600">{toGrade} to grade</span>}
                            {missing > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{missing} not submitted</span>}
                            {toGrade === 0 && missing === 0 && total > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">All submitted & graded</span>}
                            <button type="button" onClick={() => clearDeadline(task)} disabled={completingDeadlineId === deadlineKey(task)} title="Hide this from the dashboard" className="ml-auto rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                              {completingDeadlineId === deadlineKey(task) ? '…' : 'Mark done'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel icon={Calendar} iconColor="text-blue-600" title="Upcoming Schedule" link={{ to: '/teacher/timetable', label: 'View All' }}>
              {upcomingSchedule.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">Nothing scheduled.</p>
              ) : (
                <ol className="relative ml-1.5 space-y-4 border-l-2 border-slate-100 pl-5">
                  {upcomingSchedule.map((c, i) => (
                    <li key={`${c.id || i}-${c.dayLabel}`} className="relative">
                      <span className={cx('absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white', i % 3 === 2 ? 'bg-violet-500' : 'bg-blue-500')} />
                      <p className="text-sm font-semibold text-slate-900">{c.dayLabel} • {formatClock(c.startTime) || c.time}</p>
                      <p className="text-[13px] text-slate-600">Class {c.class || '—'}{c.subject ? ` • ${c.subject}` : ''}</p>
                      {c.room && <p className="text-[13px] text-slate-500">Room {c.room}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <div className="space-y-4">
              <Panel icon={Bell} iconColor="text-rose-500" title="Student Alerts" link={{ to: '/teacher/classes/current/students/analytics', label: 'View All' }}>
                {studentAlerts.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">No alerts right now.</p>
                ) : (
                  <div className="space-y-2">
                    {studentAlerts.map((a) => (
                      <Link key={a.title} to={a.to} className="flex items-center gap-3 rounded-lg p-1 hover:bg-slate-50">
                        <div className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', a.cls)}>{React.createElement(a.icon, { size: 16 })}</div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-slate-900">{a.title}</p>
                          <p className="text-[11px] text-slate-500">{a.sub}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel icon={Clock} iconColor="text-blue-600" title="Recent Activity" link={{ to: '/teacher/notifications', label: 'View All' }}>
                {recentActivities.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">No recent activity.</p>
                ) : (
                  <ul className="space-y-2">
                    {recentActivities.slice(0, 4).map((a, i) => (
                      <li key={a.id || i} className="flex items-center gap-2.5 text-[12.5px]">
                        <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full border-2', ['border-emerald-500', 'border-amber-400', 'border-amber-400', 'border-rose-400'][i % 4])} />
                        <span className="min-w-0 flex-1 truncate text-slate-700">{a.message}</span>
                        <span className="shrink-0 text-[11px] text-slate-400">{a.time}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </MotionSection>
        </MotionDiv>
      </div>
    </div>
  );
};

const QUICK_ACTIONS = [
  {
    label: 'Create Homework',
    icon: FileText,
    to: '/teacher/classes/current/assignments/manage',
    cls: 'bg-white shadow-md border-gray-100',
    iconBg: 'bg-blue-600',
  },
  {
    label: 'Create Assignment',
    icon: PenLine,
    to: '/teacher/classes/current/assignments/manage',
    cls: 'bg-white shadow-md border-gray-100',
    iconBg: 'bg-emerald-600',
  },
  {
    label: 'Upload Study Material',
    icon: BookOpen,
    to: '/teacher/classes/current/teaching/study-materials',
    cls: 'bg-white shadow-md border-gray-100',
    iconBg: 'bg-violet-600',
  },
  {
    label: 'Create Exam',
    icon: ClipboardList,
    to: '/teacher/classes/current/assessments/exam',
    cls: 'bg-white shadow-md border-gray-100',
    iconBg: 'bg-orange-500',
  },
  {
    label: 'Enter Marks',
    icon: BarChart3,
    to: '/teacher/classes/current/assessments/exam',
    cls: 'bg-white shadow-md border-gray-100',
    iconBg: 'bg-rose-500',
  },
  {
    label: 'Post Notice',
    icon: Megaphone,
    to: '/teacher/notifications',
    cls: 'bg-white shadow-md border-gray-100',
    iconBg: 'bg-cyan-600',
  },
];

const formatClock = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  if (!m) return '';
  const h = Number(m[1]);
  return `${String(((h + 11) % 12) + 1).padStart(2, '0')}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};

const dueLabel = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return { text: 'No due date', cls: 'bg-slate-100 text-slate-600' };
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: `Overdue by ${-days} day${days === -1 ? '' : 's'}`, cls: 'bg-rose-50 text-rose-600' };
  if (days === 0) return { text: 'Due Today', cls: 'bg-rose-50 text-rose-600' };
  if (days === 1) return { text: 'Due Tomorrow', cls: 'bg-rose-50 text-rose-600' };
  if (days <= 3) return { text: `Due in ${days} days`, cls: 'bg-amber-50 text-amber-600' };
  return { text: `Due ${formatDate(value, { day: 'numeric', month: 'short' })}`, cls: 'bg-slate-100 text-slate-600' };
};

const Panel = ({ icon: Icon, iconColor, title, link, children }) => (
  <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <Icon size={18} className={iconColor} />
        <h2 className="text-[16px] font-semibold text-slate-900">{title}</h2>
      </div>
      {link && (
        <Link to={link.to} className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium text-blue-600 hover:underline">
          {link.label} <ChevronRight size={13} />
        </Link>
      )}
    </div>
    {children}
  </section>
);

const Donut = ({ percent }) => {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[104px] w-[104px] shrink-0">
      <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90">
        <circle cx="52" cy="52" r={r} fill="none" stroke="#dcfce7" strokeWidth="11" />
        <circle
          cx="52" cy="52" r={r} fill="none" stroke="#22c55e" strokeWidth="11" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - clampPercent(percent) / 100)}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-slate-900">{Math.round(clampPercent(percent))}%</span>
    </div>
  );
};

// Decorative school + trees for the greeting banner (pure SVG, no asset).
const SchoolIllustration = () => (
  <svg aria-hidden="true" viewBox="0 0 420 110" className="pointer-events-none absolute bottom-0 right-0 h-full w-[46%] max-w-[460px]" preserveAspectRatio="xMaxYMax meet">
    <ellipse cx="400" cy="40" rx="40" ry="38" fill="#86c46b" />
    <ellipse cx="385" cy="70" rx="45" ry="40" fill="#6fb35a" />
    <rect x="150" y="45" width="200" height="65" fill="#f5efe1" />
    <rect x="215" y="25" width="70" height="85" fill="#efe5d0" />
    <polygon points="210,27 250,8 290,27" fill="#d8c7a6" />
    <circle cx="250" cy="40" r="6" fill="#9fc3e6" />
    {[160, 180, 300, 320].flatMap((x) => [58, 82].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="14" height="12" fill="#9fc3e6" />))}
    {[225, 260].flatMap((x) => [55, 78].map((y) => <rect key={`c${x}-${y}`} x={x} y={y} width="14" height="14" fill="#9fc3e6" />))}
    <rect x="243" y="92" width="14" height="18" fill="#c9b48e" />
    <ellipse cx="120" cy="100" rx="40" ry="14" fill="#8fcb73" />
    <ellipse cx="370" cy="104" rx="60" ry="10" fill="#7dbb63" />
  </svg>
);

export default TeacherDashboard;
