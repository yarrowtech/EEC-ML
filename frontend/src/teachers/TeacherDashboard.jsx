/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion as framerMotion, useReducedMotion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Eye,
  FileText,
  Sparkles,
  Users,
  Zap,
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

const deadlineKey = (task) =>
  String(task?.id || `${task?.title || ''}|${task?.class || ''}|${task?.dueDate || ''}`);

const daysUntil = (value) => {
  if (!value) return 'No due date';
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return 'Date pending';
  const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `${days}d left`;
};

// ── Glass design tokens ───────────────────────────────────────────────────────
// Frosted-glass surfaces used throughout: semi-transparent white + blur/
// saturate, soft white borders, and a gentle shadow. Kept as shared class
// strings so every card/pill in the dashboard reads as one consistent system.
const GLASS_PANEL = 'border border-white/70 bg-white/60 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl backdrop-saturate-[1.8]';
const GLASS_PANEL_SOLID = 'border border-white/80 bg-white/75 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.1)] backdrop-blur-xl backdrop-saturate-[1.8]';
const GLASS_INSET = 'border border-white/70 bg-white/50 backdrop-blur-lg backdrop-saturate-[1.8]';

const Badge = ({ children, tone = 'neutral', className = '' }) => {
  const tones = {
    neutral: 'border-slate-200/70 bg-white/60 text-[#64748b]',
    emerald: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700',
    amber: 'border-amber-200/70 bg-[#fffbeb]/90 text-amber-700',
    rose: 'border-rose-200/70 bg-rose-50/80 text-rose-700',
    sky: 'border-sky-200/70 bg-sky-50/80 text-sky-700',
    violet: 'border-violet-200/70 bg-violet-50/80 text-violet-700',
  };

  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-sm', tones[tone], className)}>
      {children}
    </span>
  );
};

const CardShell = ({ children, className = '', delay = 0 }) => {
  const reduceMotion = useReducedMotion();

  return (
    <MotionSection
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay, ease: 'easeOut' }}
      className={cx('rounded-2xl', GLASS_PANEL, className)}
    >
      {children}
    </MotionSection>
  );
};
const SectionHeader = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-4 border-b border-white/60 px-5 py-4">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-xl border border-white/70 bg-white/70 p-2 text-[#8b5cf6] shadow-sm backdrop-blur-sm">
        {React.createElement(Icon, { size: 18 })}
      </div>
      <div>
        <h2 className="text-base font-semibold text-[#0f172a]">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-[#64748b]">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

const Progress = ({ value, tone = 'emerald' }) => {
  const tones = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-400',
    rose: 'bg-rose-500',
    sky: 'bg-sky-500',
    violet: 'bg-[#8b5cf6]',
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/70 ring-1 ring-white/70">
      <div className={cx('h-full rounded-full transition-all duration-500 ease-out', tones[tone])} style={{ width: `${clampPercent(value)}%` }} />
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/70 bg-white/40 px-5 py-10 text-center backdrop-blur-sm">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-[#8e9aaf] shadow-sm">
      {React.createElement(Icon, { size: 22 })}
    </div>
    <p className="font-semibold text-[#0f172a]">{title}</p>
    <p className="mt-1 max-w-xs text-sm leading-5 text-[#64748b]">{description}</p>
  </div>
);

const SkeletonGrid = () => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <div key={index} className={cx('h-36 animate-pulse rounded-2xl', GLASS_INSET)} />
    ))}
  </div>
);

const TeacherDashboard = () => {
  const reduceMotion = useReducedMotion();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [dashboardData, setDashboardData] = useState(null);
  const [classTeacherAllocations, setClassTeacherAllocations] = useState([]);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState('weekly');
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
      setDashboardLoading(true);
      setDashboardError('');
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
        } else {
          setClassTeacherAllocations([]);
        }
      } catch (error) {
        setDashboardError(error.message || 'Unable to load dashboard data');
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

  const insightCards = [
    {
      label: 'Total Students',
      value: stats.totalStudents ?? 0,
      icon: Users,
      path: '/teacher/classes',
      tone: 'sky',
    },
    {
      label: 'Attendance Rate',
      value: `${stats.attendanceRate ?? 0}%`,
      icon: Activity,
      path: '/teacher/classes/current/students/attendance',
      tone: 'emerald',
    },
    {
      label: 'Pending Tasks',
      value: pendingTasks,
      icon: FileText,
      path: '/teacher/classes/current/assignments',
      tone: pendingTasks > 8 ? 'rose' : 'amber',
    },
    {
      label: 'Upcoming Events',
      value: stats.upcomingEvents ?? 0,
      icon: Calendar,
      path: '/teacher/calendar',
      tone: 'violet',
    },
  ];

  const workflowGroups = [
    {
      title: 'Core actions',
      items: [
        { title: 'Open Classes', description: 'Jump into roster and class context.', icon: Users, path: '/teacher/classes' },
        { title: 'Attendance', description: 'Mark today and review exceptions.', icon: ClipboardCheck, path: '/teacher/classes/current/students/attendance' },
        { title: 'Assignments', description: 'Review submissions and pending work.', icon: FileText, path: '/teacher/classes/current/assignments' },
      ],
    },
    {
      title: 'Support',
      items: [
        { title: 'Teaching', description: 'Lesson materials and notes.', icon: BookOpen, path: '/teacher/classes/current/teaching' },
        { title: 'AI Center', description: 'Get class insights and teaching support.', icon: Sparkles, path: '/teacher/lesson-plan' },
      ],
    },
  ];

  const analyticsSnapshot = [
    { label: 'Attendance rate', value: `${stats.attendanceRate ?? 0}%`, helper: 'Current teacher scope', progress: stats.attendanceRate ?? 0, tone: 'emerald' },
    ...performanceMetrics.slice(0, 3).map((metric) => ({
      label: `${metric.subject} average`,
      value: `${metric.average}%`,
      helper: 'Current performance data',
      progress: metric.average,
      tone: 'violet',
    })),
  ];

  const pageVariants = reduceMotion ? {} : {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = reduceMotion ? {} : {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  };

  const mobileClassLabel = classTeacherAllocations.length
    ? classTeacherAllocations
        .map((item) => {
          const className = item?.classId?.name || item?.className || 'Class';
          const sectionName = item?.sectionId?.name || item?.sectionName || '';
          return `${className}${sectionName ? ` ${sectionName}` : ''}`;
        })
        .join(' • ')
    : 'No class assigned';

  const MobileSectionTitle = ({ children, meta }) => (
    <div className="flex items-center justify-between px-1">
      <h2 className="text-base font-bold text-[#0f172a]">{children}</h2>
      {meta && <span className="text-[11px] font-medium text-[#8e9aaf]">{meta}</span>}
    </div>
  );

  return (
    <div className="min-h-0 bg-[#f1f5f9] text-[#0f172a]">
      <div className="mx-auto w-full max-w-md space-y-4 px-4 py-4 lg:hidden">
        {dashboardError && (
          <div className={cx('flex items-center gap-2 rounded-2xl border-rose-200/70 bg-rose-50/80 px-4 py-3 text-xs font-medium text-rose-700 backdrop-blur-sm')}>
            <AlertCircle size={16} /> {dashboardError}
          </div>
        )}

        <section className={cx('relative overflow-hidden rounded-2xl p-5', GLASS_PANEL_SOLID)}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.14),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.1),transparent_50%)]" />
          <div className="relative z-10">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-[10px] font-bold text-[#8b5cf6] shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Teacher workspace
              </span>
              <span className="text-[10px] font-medium text-[#64748b]">
                {currentDateTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-xl font-extrabold leading-snug tracking-tight text-[#0f172a]">
              {getGreeting()},<br /><span className="text-[#8b5cf6]">{teacherName.split(' ')[0]}</span>
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-[#64748b]">
              {dashboardLoading
                ? 'Preparing your teaching workspace…'
                : `You have ${todaysClasses.length} ${todaysClasses.length === 1 ? 'class' : 'classes'} today and ${pendingTasks} tasks waiting.`}
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <MobileSectionTitle meta="Live overview">My classroom</MobileSectionTitle>
          <div className={cx('space-y-4 rounded-2xl p-4', GLASS_PANEL)}>
            <div className="flex items-center gap-3.5 border-b border-white/60 pb-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#8b5cf6] text-sm font-bold text-white shadow-sm ring-2 ring-white/70">
                {teacherName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'T'}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-bold text-[#0f172a]">{teacherName}</h2>
                <p className="truncate text-[11px] font-medium text-[#64748b]">Class teacher • {mobileClassLabel}</p>
              </div>
              <Link to="/teacher/classes" aria-label="Open classes" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/70 text-[#8b5cf6] transition hover:-translate-y-0.5">
                <ChevronRight size={17} />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { value: stats.totalStudents ?? 0, label: 'Students', icon: Users, to: '/teacher/classes', tone: 'text-[#8b5cf6]' },
                { value: `${stats.attendanceRate ?? 0}%`, label: 'Attendance', icon: ClipboardCheck, to: '/teacher/classes/current/students/attendance', tone: 'text-emerald-600' },
                { value: pendingTasks, label: 'Tasks', icon: FileText, to: '/teacher/classes/current/assignments', tone: 'text-amber-600' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.label} to={item.to} className={cx('flex min-h-[76px] flex-col items-center justify-center rounded-xl p-2.5 transition active:scale-95', GLASS_INSET)}>
                    <span className={`text-lg font-black ${item.tone}`}>{item.value}</span>
                    <span className="mt-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-tight text-[#64748b]"><Icon size={11} />{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/teacher/classes/current/students/attendance" className={cx('rounded-2xl p-4 transition active:scale-[.98]', GLASS_PANEL)}>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-emerald-50/80 text-emerald-600"><ClipboardCheck size={18} /></div>
            <p className="text-xs font-bold text-[#0f172a]">Mark attendance</p>
            <p className="mt-1 text-[10px] leading-4 text-[#8e9aaf]">Record today’s class presence</p>
          </Link>
          <Link to="/teacher/lesson-plan" className={cx('rounded-2xl p-4 transition active:scale-[.98]', GLASS_PANEL)}>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-violet-50/80 text-[#8b5cf6]"><Sparkles size={18} /></div>
            <p className="text-xs font-bold text-[#0f172a]">Plan with AI</p>
            <p className="mt-1 text-[10px] leading-4 text-[#8e9aaf]">Create your next lesson faster</p>
          </Link>
        </div>

        <section className="space-y-3">
          <MobileSectionTitle meta={nextClass ? `Next ${nextClass.time}` : 'Today'}>Today’s schedule</MobileSectionTitle>
          <div className={cx('rounded-2xl p-4', GLASS_PANEL)}>
            {todaysClasses.length === 0 ? (
              <div className="flex flex-col items-center py-5 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-emerald-50/80 text-emerald-600"><CheckCircle2 size={18} /></div>
                <p className="mt-2 text-xs font-semibold text-[#0f172a]">Your schedule is clear</p>
                <p className="mt-1 text-[11px] text-[#64748b]">No classes scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todaysClasses.slice(0, 3).map((classItem, index) => (
                  <div key={classItem.id || index} className={cx('flex items-center gap-3 rounded-xl p-3', GLASS_INSET)}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-violet-50/80 text-[#8b5cf6]"><BookOpen size={17} /></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#0f172a]">{classItem.subject || classItem.class}</p><p className="truncate text-[10px] text-[#8e9aaf]">{classItem.class} {classItem.section ? `• ${classItem.section}` : ''}</p></div>
                    <span className="text-[11px] font-bold text-[#64748b]">{classItem.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={cx('rounded-2xl p-4', GLASS_PANEL)}>
          <div className="flex items-center justify-between border-b border-white/60 pb-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#0f172a]"><CheckCircle2 size={15} className="text-[#8b5cf6]" />Priority tasks</div>
            <span className="rounded-full border border-white/70 bg-violet-50/80 px-2 py-0.5 text-[10px] font-semibold text-[#8b5cf6]">{visibleDeadlines.length} pending</span>
          </div>
          {visibleDeadlines.length === 0 ? (
            <div className="flex flex-col items-center py-5 text-center"><CheckCircle2 size={24} className="text-slate-300" /><p className="mt-2 text-xs font-medium text-[#8e9aaf]">All caught up</p></div>
          ) : (
            <div className="mt-3 space-y-2">
              {visibleDeadlines.slice(0, 3).map((task) => (
                <Link key={deadlineKey(task)} to="/teacher/classes/current/assignments" className={cx('flex items-center gap-3 rounded-xl p-3', GLASS_INSET)}>
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#0f172a]">{task.title}</span>
                  <span className="text-[10px] font-medium text-amber-700">{daysUntil(task.dueDate)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className={cx('flex items-start gap-3.5 rounded-2xl p-4', GLASS_PANEL)}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-violet-50/80 text-[#8b5cf6]"><Brain size={20} /></div>
          <div><h2 className="text-xs font-bold text-[#0f172a]">Need teaching support?</h2><p className="mt-0.5 text-[11px] leading-relaxed text-[#64748b]">Use AI tools for lesson ideas, class insights, and differentiated activities.</p><Link to="/teacher/ai-tools" className="mt-2 inline-flex text-xs font-semibold text-[#8b5cf6]">Open AI tools →</Link></div>
        </section>
      </div>

      <div className="hidden lg:block">
      <div className="mx-auto max-w-[1800px] space-y-4 p-3 pt-0 sm:p-4 sm:pt-0 lg:p-5 lg:pt-0">
        {dashboardError && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 backdrop-blur-sm">
              <AlertCircle size={18} />
              {dashboardError}
            </div>
          )}

          <MotionDiv variants={pageVariants} initial="hidden" animate="show" className="space-y-4">
            <MotionSection variants={itemVariants} className={cx('relative overflow-hidden rounded-3xl p-5 sm:p-6 lg:p-7', GLASS_PANEL_SOLID)}>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_45%)]" />
              <div className="pointer-events-none absolute right-6 top-6 hidden h-36 w-36 rounded-full border border-white/60 lg:block" />
              <div className="relative grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-end">
                <div>
                  <div className="mb-5 flex flex-wrap items-center gap-2">
                    <Badge tone="emerald"><span className="h-2 w-2 rounded-full bg-emerald-400" />Live workspace</Badge>
                    <Badge tone="neutral">{dateStr}</Badge>
                    <Badge tone="neutral">{currentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Badge>
                  </div>
                  <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-[#0f172a] sm:text-4xl">{getGreeting()}, {teacherName.split(' ')[0]}.</h1>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-[#64748b]">
                    {dashboardLoading
                      ? 'Loading today\'s timetable and workload…'
                      : `You have ${todaysClasses.length} ${todaysClasses.length === 1 ? 'class' : 'classes'} today and ${pendingTasks} pending evaluations. AI can prepare your next lesson, flag student risks, and clear routine work faster.`}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link to="/teacher/classes" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#8b5cf6] px-4 text-sm font-semibold text-white shadow-sm shadow-violet-300/50 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#7c4deb]">Open classes <ArrowUpRight size={16} /></Link>
                    <Link to="/teacher/lesson-plan" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/70 bg-white/60 px-4 text-sm font-semibold text-[#0f172a] backdrop-blur-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/80">Ask AI <Sparkles size={16} className="text-[#8b5cf6]" /></Link>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <HeroChip label="Class teacher" value={classTeacherLabel} />
                  <HeroChip
                    label="Next class"
                    value={dashboardLoading
                      ? 'Loading from timetable…'
                      : nextClass
                        ? `${nextClass.subject || nextClass.class || 'Details unavailable'} at ${nextClass.time}`
                        : 'No more classes today'}
                  />
                  <HeroChip label="Workload" value={pendingTasks > 0 ? `${pendingTasks} actions need review` : 'Clear for focused teaching'} />
                </div>
              </div>
            </MotionSection>

            {dashboardLoading ? <SkeletonGrid /> : (
              <MotionSection variants={itemVariants} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {insightCards.map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <Link key={stat.label} to={stat.path} className="group">
                      <CardShell delay={index * 0.03} className="h-full p-5 transition duration-200 ease-out hover:-translate-y-1 hover:bg-white/75 hover:shadow-[0_16px_40px_-14px_rgba(15,23,42,0.18)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className={cx('rounded-2xl border border-white/70 p-3', stat.tone === 'rose' ? 'bg-rose-50/80 text-rose-600' : stat.tone === 'amber' ? 'bg-[#fffbeb]/90 text-amber-600' : stat.tone === 'violet' ? 'bg-violet-50/80 text-[#8b5cf6]' : stat.tone === 'sky' ? 'bg-sky-50/80 text-sky-600' : 'bg-emerald-50/80 text-emerald-600')}>
                            <Icon size={21} />
                          </div>
                        </div>
                        <div className="mt-5">
                          <div className="flex items-end justify-between gap-3">
                            <p className="text-3xl font-semibold tracking-tight text-[#0f172a]">{stat.value}</p>
                          </div>
                          <p className="mt-1 text-sm font-medium text-[#64748b]">{stat.label}</p>
                        </div>
                      </CardShell>
                    </Link>
                  );
                })}
              </MotionSection>
            )}

            <MotionSection variants={itemVariants} className="grid gap-4 2xl:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <CardShell>
                  <SectionHeader icon={Zap} title="Workflow Actions" subtitle="Grouped by how teachers actually move through the day." action={<Link to="/teacher/classes" className="text-sm font-semibold text-[#64748b] transition hover:text-[#0f172a]">View modules</Link>} />
                  <div className="grid gap-4 p-5 lg:grid-cols-2">
                    {workflowGroups.map((group) => (
                      <div key={group.title}>
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#8e9aaf]">{group.title}</h3>
                        <div className="space-y-3">
                          {group.items.map((item) => <WorkflowAction key={item.title} item={item} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardShell>

                <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                  <CardShell>
                    <SectionHeader icon={Clock} title="Today's Schedule" subtitle={nextClass ? `Next: ${nextClass.subject || nextClass.class || 'Details unavailable'} ${nextClass.time}` : 'Your class timeline is clear.'} action={<Badge tone="emerald">Live</Badge>} />
                    <div className="max-h-[430px] space-y-3 overflow-y-auto p-5">
                      {todaysClasses.length === 0 ? <EmptyState icon={Calendar} title="No classes scheduled today" description="Today's schedule will appear here when timetable data is available." /> : todaysClasses.map((classItem, index) => (
                        <ScheduleItem key={classItem.id || `${classItem.subject}-${index}`} classItem={classItem} index={index} isNext={classItem.id === nextClass?.id} reduceMotion={reduceMotion} />
                      ))}
                    </div>
                  </CardShell>

                  <CardShell>
                    <SectionHeader
                      icon={BarChart3}
                      title="Analytics Snapshot"
                      subtitle="Compact signals only. Detailed analytics stay in reports."
                      action={<TimeframeToggle activeTimeframe={activeTimeframe} setActiveTimeframe={setActiveTimeframe} />}
                    />
                    <div className="space-y-4 p-5">
                      {analyticsSnapshot.length > 0 && <SnapshotChart metrics={analyticsSnapshot} />}
                      <div className="grid gap-3 sm:grid-cols-2">
                      {analyticsSnapshot.map((metric) => (
                        <Link key={metric.label} to="/teacher/classes/current/reports" className={cx('rounded-2xl p-4 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/70', GLASS_INSET)}>
                          <div className="mb-4 flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold text-[#0f172a]">{metric.label}</p>
                              <p className="mt-1 text-xs text-[#8e9aaf]">{metric.helper}</p>
                            </div>
                            <ArrowUpRight size={16} className="text-[#8e9aaf]" />
                          </div>
                          <p className="mb-3 text-2xl font-semibold text-[#0f172a]">{metric.value}</p>
                          <Progress value={metric.progress} tone={metric.tone} />
                        </Link>
                      ))}
                      </div>
                    </div>
                  </CardShell>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                  <CardShell>
                    <SectionHeader icon={Bell} title="Recent Activity" subtitle="Interactive timeline of relevant classroom updates." action={<Badge tone="neutral">{recentActivities.length} updates</Badge>} />
                    <div className="p-5">
                      {recentActivities.length === 0 ? <EmptyState icon={Bell} title="No recent activity" description="Attendance, assignments, reports, and meetings will appear here." /> : (
                        <div className="space-y-1">
                          {recentActivities.slice(0, 6).map((activity, index) => <ActivityItem key={activity.id || index} activity={activity} index={index} total={Math.min(recentActivities.length, 6)} />)}
                        </div>
                      )}
                    </div>
                  </CardShell>

                  <CardShell>
                    <SectionHeader icon={CheckCircle2} title="Priority Task Board" subtitle="Deadlines without report-page overload." action={<Badge tone="amber">{visibleDeadlines.length} pending</Badge>} />
                    <div className="max-h-[440px] space-y-3 overflow-y-auto p-5">
                      {deadlineError && <p className="rounded-xl border border-rose-200/70 bg-rose-50/80 px-3 py-2 text-xs text-rose-700">{deadlineError}</p>}
                      {visibleDeadlines.length === 0 ? <EmptyState icon={CheckCircle2} title="All caught up" description="No upcoming deadlines are waiting for action." /> : visibleDeadlines.map((task, index) => <DeadlineTask key={deadlineKey(task)} task={task} index={index} onComplete={() => clearDeadline(task)} completing={completingDeadlineId === deadlineKey(task)} />)}
                    </div>
                  </CardShell>
                </div>
              </div>

            </MotionSection>
          </MotionDiv>
      </div>
      </div>
    </div>
  );
};

const HeroChip = ({ label, value }) => (
  <div className="rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm backdrop-blur-lg backdrop-saturate-[1.8]">
    <p className="text-xs uppercase tracking-wide text-[#8e9aaf]">{label}</p>
    <p className="mt-1 text-sm font-semibold text-[#0f172a]">{value}</p>
  </div>
);

const WorkflowAction = ({ item }) => {
  const Icon = item.icon;
  return (
    <Link to={item.path} className={cx('group flex min-h-[98px] gap-3 rounded-2xl p-4 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.18)]', GLASS_INSET)}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/80 text-[#64748b] transition duration-200 ease-out group-hover:bg-[#8b5cf6] group-hover:text-white">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-[#0f172a]">{item.title}</p>
        <p className="mt-1 text-sm leading-5 text-[#64748b]">{item.description}</p>
      </div>
    </Link>
  );
};

const ScheduleItem = ({ classItem, index, isNext, reduceMotion }) => (
  <MotionDiv
    initial={reduceMotion ? false : { opacity: 0, x: -12 }}
    animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
    transition={{ duration: 0.26, delay: index * 0.04, ease: 'easeOut' }}
    className={cx('relative rounded-2xl p-4 transition duration-200 ease-out hover:bg-white/70', isNext ? 'border border-emerald-200/70 bg-emerald-50/60 backdrop-blur-lg backdrop-saturate-[1.8]' : GLASS_INSET)}
  >
    <div className="flex items-start gap-3">
      <span className={cx('mt-1 h-12 w-1.5 rounded-full', isNext ? 'bg-emerald-500' : 'bg-slate-300')} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-[#0f172a]">{classItem.subject}</h3>
          <Badge tone={isNext ? 'emerald' : 'neutral'}>{classItem.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-[#64748b]">{classItem.class} {classItem.section && `• ${classItem.section}`} {classItem.room && `• Room ${classItem.room}`}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={classWorkspacePath(classItem, 'students/attendance')} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/70 bg-white/70 px-3 text-xs font-semibold text-[#64748b] transition hover:bg-white/90"><ClipboardCheck size={14} /> Attendance</Link>
          <Link to={classWorkspacePath(classItem, 'teaching')} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8b5cf6] px-3 text-xs font-semibold text-white transition hover:bg-[#7c4deb]">Open <ChevronRight size={14} /></Link>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold text-[#0f172a]">{classItem.time}</p>
        <p className="mt-1 text-xs text-[#8e9aaf]">{classItem.status === 'In progress' ? 'Happening now' : isNext ? 'Next class' : classItem.status}</p>
      </div>
    </div>
  </MotionDiv>
);

// Bar-fill colors for the snapshot chart, matching the Progress/Badge tone
// palette used across the rest of the dashboard.
const TONE_HEX = {
  emerald: '#10b981',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  rose: '#f43f5e',
  sky: '#0ea5e9',
};

const SnapshotChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
      <p className="font-semibold text-[#0f172a]">{point.label}</p>
      <p className="mt-0.5 text-[#64748b]">{point.value}%</p>
    </div>
  );
};

// Compact bar chart summarizing the same signals as the tiles below it —
// attendance rate plus up to three subject averages — so the "snapshot" is
// scannable at a glance without leaving the dashboard for the full reports.
const SnapshotChart = ({ metrics }) => {
  const chartData = metrics.map((metric) => ({
    label: metric.label,
    shortLabel: metric.label.replace(/\s*average$/i, '').replace(/\s*rate$/i, ''),
    value: clampPercent(metric.progress),
    tone: metric.tone,
  }));

  return (
    <div className={cx('rounded-2xl p-4', GLASS_INSET)}>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 6, right: 8, left: -20, bottom: 0 }} barSize={32}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
          <XAxis
            dataKey="shortLabel"
            tick={{ fill: '#8e9aaf', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(148,163,184,0.3)' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#8e9aaf', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip cursor={{ fill: 'rgba(139,92,246,0.06)' }} content={<SnapshotChartTooltip />} />
          <Bar dataKey="value" radius={[8, 8, 8, 8]}>
            {chartData.map((entry) => (
              <Cell key={entry.label} fill={TONE_HEX[entry.tone] || TONE_HEX.violet} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const TimeframeToggle = ({ activeTimeframe, setActiveTimeframe }) => (
  <div className="flex rounded-xl border border-white/70 bg-white/50 p-1 backdrop-blur-sm">
    {['weekly', 'monthly', 'yearly'].map((timeframe) => (
      <button key={timeframe} type="button" onClick={() => setActiveTimeframe(timeframe)} className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition duration-150 ease-out', activeTimeframe === timeframe ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#8e9aaf] hover:text-[#0f172a]')}>
        {timeframe}
      </button>
    ))}
  </div>
);

const ActivityItem = ({ activity, index, total }) => (
  <div className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-2xl p-3 transition duration-200 ease-out hover:bg-white/60">
    <div className="relative">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-white/70 text-[#64748b]"><Activity size={18} /></div>
      {index < total - 1 && <span className="absolute left-1/2 top-11 h-5 w-px bg-slate-200/70" />}
    </div>
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-[#0f172a]">{activity.message}</p>
      <p className="mt-1 text-xs text-[#8e9aaf]">{activity.class || 'Class update'} • {activity.time}</p>
    </div>
    <button className="flex h-9 w-9 items-center justify-center rounded-xl text-[#8e9aaf] transition hover:bg-white/70 hover:text-[#0f172a]" aria-label="View activity"><Eye size={16} /></button>
  </div>
);

const DeadlineTask = ({ task, index, onComplete, completing = false }) => (
  <div className={cx('rounded-2xl p-4 transition duration-200 ease-out hover:bg-white/70', GLASS_INSET)}>
    <div className="mb-3 flex items-center justify-between gap-2">
      <Badge tone={index === 0 ? 'rose' : 'amber'}>{daysUntil(task.dueDate)}</Badge>
      <span className="text-xs font-semibold text-[#8e9aaf]">{formatDate(task.dueDate)}</span>
    </div>
    <h3 className="font-semibold text-[#0f172a]">{task.title}</h3>
    <p className="mt-1 text-sm text-[#64748b]">{task.class || '-'}{task.subject ? ` • ${task.subject}` : ''}</p>
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        onClick={onComplete}
        disabled={completing}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/70 bg-white/60 px-3 text-xs font-semibold text-[#64748b] transition duration-150 ease-out hover:border-emerald-300/70 hover:bg-emerald-50/80 hover:text-emerald-700"
      >
        <CheckCircle2 size={14} /> {completing ? 'Completing…' : 'Mark complete'}
      </button>
      <Link to="/teacher/classes/current/assignments" className="inline-flex h-8 items-center rounded-lg bg-[#8b5cf6] px-3 text-xs font-semibold text-white transition hover:bg-[#7c4deb]">Open task</Link>
    </div>
  </div>
);

export default TeacherDashboard;
