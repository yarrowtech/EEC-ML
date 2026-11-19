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
  Loader2,
  LogIn,
  LogOut,
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
  const [workToday, setWorkToday] = useState(null);
  const [workSaving, setWorkSaving] = useState(false);

  const loadWorkToday = async () => {
    try {
      const token = localStorage.getItem('token');
      const month = new Date().toISOString().slice(0, 7);
      const res = await fetch(`${API_BASE}/api/teacher/dashboard/work-attendance?month=${month}`, { headers: { authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setWorkToday(data.today || {});
    } catch { /* tile falls back to "Entry" */ }
  };
  useEffect(() => { loadWorkToday(); }, []);

  const handleWorkAttendance = async () => {
    if (workSaving || workToday?.hasCheckedOut) return;
    const action = workToday?.hasCheckedIn ? 'check-out' : 'check-in';
    setWorkSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/teacher/dashboard/work-attendance/${action}`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || (action === 'check-in' ? 'Unable to mark entry' : 'Unable to mark exit'));
      await loadWorkToday();
    } catch (err) {
      setDeadlineError(err.message);
    } finally {
      setWorkSaving(false);
    }
  };

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

  // No timetable entry today (and nothing marked yet) → show a "no schedule" note instead of 0%.
  const hasClassToday = (Array.isArray(dashboardData?.upcomingClasses) ? dashboardData.upcomingClasses : [])
    .some((c) => c.dayOfWeek === WEEK[todayIdx]);
  const noScheduleToday = Boolean(dashboardData) && !hasClassToday && !attendance.present && !attendance.absent;

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
    <div className="min-h-0 bg-gray- text-[#0f172a]">
      <div>
        <MotionDiv variants={pageVariants} initial="hidden" animate="show" className="mx-auto max-w-[1240px] space-y-3 px-3 pb-4 pt-3 sm:px-4 lg:space-y-4 lg:px-5 lg:pb-6 lg:pt-1">
          {dashboardError && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              <AlertCircle size={16} /> {dashboardError}
            </div>
          )}

          {/* Mobile/tablet: student-style profile card */}
          <div className="lg:hidden">
            {/* Profile card — student-portal style, school cover photo behind */}
            {(() => {
              const t = dashboardData?.teacher || {};
              const cover = coverImageOf(dashboardData);
              const initials = teacherName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'T';
              const loginId = t.username || (t.empId != null ? String(t.empId) : '');
              const tags = [
                t.department ? `${t.department} Department` : null,
                t.designation || null,
              ].filter(Boolean);
              return (
                <MotionSection
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className={cx('relative overflow-hidden rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.03),0px_1px_3px_rgba(0,0,0,0.05)]', cover ? 'bg-black' : 'bg-white')}
                >
                  {cover && (
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${cover})` }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                    </div>
                  )}
                  <div className={cx('relative z-10 flex flex-col items-center gap-3 p-6 text-center', cover && 'm-3 rounded-2xl bg-black/60 p-5 backdrop-blur-[2px]')}>
                    <div className="relative w-fit">
                      {t.profilePic ? (
                        <img src={t.profilePic} alt="" className="h-20 w-20 rounded-full border-[3px] border-gray-100 object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-gray-100 bg-[#eef2ff]">
                          <span className="select-none text-2xl font-bold text-[#4f46e5]">{initials}</span>
                        </div>
                      )}
                      <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
                    </div>
                    <div>
                      <h1 className={cx('text-2xl font-bold leading-tight tracking-tight', cover ? 'text-white' : 'text-[#0f172a]')}>{teacherName}</h1>
                      {loginId && <p className={cx('mt-0.5 text-xs', cover ? 'text-white/70' : 'text-[#9ca3af]')}>ID: {loginId}</p>}
                      {t.academicYear && <p className={cx('mt-0.5 text-xs font-medium', cover ? 'text-white/80' : 'text-[#64748b]')}>Academic Year {t.academicYear}</p>}
                    </div>
                    <span className={cx('inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', cover ? 'bg-white/15 text-white' : 'bg-indigo-50 text-[#4338ca]')}>
                      <Users size={13} className="shrink-0" />
                      <span className="truncate">
                        {classTeacherAllocations.length
                          ? `Class Teacher of ${classTeacherAllocations.map((item) => {
                            const cls = item?.classId?.name || item?.className || 'Class';
                            const sec = item?.sectionId?.name || item?.sectionName || '';
                            return `Class ${String(cls).replace(/^class\s*/i, '')}${sec ? ` - ${sec}` : ''}`;
                          }).join(', ')}`
                          : 'Not a class teacher'}
                      </span>
                    </span>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-1">
                        {tags.map((tag, index) => (
                          <span key={tag} className={cx('inline-flex items-center gap-1.5 text-xs font-medium', cover ? 'text-white/90' : 'text-[#4338ca]')}>
                            {index > 0 && <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', cover ? 'bg-white/80' : 'bg-[#6366f1]')} />}
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </MotionSection>
              );
            })()}
    
              </div>

          {/* ── Greeting banner (desktop) ── */}
          <MotionSection variants={itemVariants} className="relative hidden overflow-hidden lg:block rounded-2xl border border-white bg-gradient-to-r from-[#eaf1fd] via-[#eef4fd] to-[#dfeafb] px-7 py-5 shadow-[0_4px_18px_rgba(30,64,175,0.06)]">
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
          <MotionSection variants={itemVariants} className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-2 lg:gap-4 xl:grid-cols-4">
            {statCards.map((card, i) => {
              const theme = [
                { card: 'from-blue-50 via-white to-white border-blue-100', icon: 'from-blue-500 to-indigo-600 shadow-blue-500/30', blob: 'bg-blue-400/15', text: 'text-blue-600', bar: 'from-blue-500 to-indigo-500' },
                { card: 'from-emerald-50 via-white to-white border-emerald-100', icon: 'from-emerald-500 to-teal-600 shadow-emerald-500/30', blob: 'bg-emerald-400/15', text: 'text-emerald-600', bar: 'from-emerald-500 to-teal-500' },
                { card: 'from-rose-50 via-white to-white border-rose-100', icon: 'from-rose-500 to-pink-600 shadow-rose-500/30', blob: 'bg-rose-400/15', text: 'text-rose-600', bar: 'from-rose-500 to-pink-500' },
                { card: 'from-amber-50 via-white to-white border-amber-100', icon: 'from-amber-500 to-orange-600 shadow-orange-500/30', blob: 'bg-amber-400/20', text: 'text-orange-600', bar: 'from-amber-500 to-orange-500' },
              ][i % 4];
              return (
                <Link key={card.label} to={card.to} className={cx('group relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-br p-3.5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-[.98] lg:p-4', theme.card)}>
                  <span aria-hidden="true" className={cx('pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full transition-transform duration-500 group-hover:scale-125', theme.blob)} />
                  <span aria-hidden="true" className={cx('pointer-events-none absolute -bottom-8 right-8 h-16 w-16 rounded-full', theme.blob)} />
                  <div className="relative flex items-start justify-between gap-2">
                    <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105 lg:h-12 lg:w-12', theme.icon)}>
                      {React.createElement(card.icon, { size: 22, strokeWidth: 2.2 })}
                    </div>
                    <ArrowUpRight size={16} className={cx('shrink-0 opacity-50 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100', theme.text)} />
                  </div>
                  <p className="relative mt-3 text-[26px] font-extrabold leading-none tracking-tight text-slate-900 lg:text-[30px]">{dashboardLoading ? '—' : card.value}</p>
                  <p className="relative mt-1.5 truncate text-[13px] font-semibold text-slate-700">{card.label}</p>
                  <p className={cx('relative truncate text-[11px] font-medium', theme.text)}>{card.helper.replace(/\s*→$/, '')}</p>
                </Link>
              );
            })}
          </MotionSection>

          {/* ── Classes / Attendance / Quick actions ── */}
          <MotionSection variants={itemVariants} className="grid gap-3 md:grid-cols-2 lg:gap-4 xl:grid-cols-[1.6fr_1fr_0.95fr]">
            <Panel icon={Calendar} iconColor="text-blue-600" title="Today's Classes" className="md:col-span-2 xl:col-span-1" link={{ to: '/teacher/timetable', label: 'View Full Schedule' }}>
              {todaysClasses.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">{dashboardLoading ? 'Loading timetable…' : 'No classes scheduled today.'}</p>
              ) : (
                <>
                <div className="space-y-2 sm:hidden">
                  {todaysClasses.slice(0, 6).map((c, i) => {
                    const st = c.status === 'In progress' ? 'Ongoing' : c.status;
                    return (
                      <div key={c.id || i} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                        <div className="w-16 shrink-0 text-center">
                          <p className="text-[13px] font-bold text-slate-900">{formatClock(c.startTime) || c.time}</p>
                          <span className={cx('mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium', st === 'Completed' ? 'bg-green-600 text-white' : st === 'Ongoing' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500')}>{st}</span>
                        </div>
                        <div className="min-w-0 flex-1 border-l border-slate-100 pl-3">
                          <p className="truncate text-sm font-semibold text-slate-900">{c.subject || '—'}</p>
                          <p className="truncate text-xs text-slate-500">Class {c.class || '—'}{c.room ? ` • Room ${c.room}` : ''}</p>
                        </div>
                        {st === 'Ongoing' ? (
                          <Link to={classWorkspacePath(c, 'students/attendance')} className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white">Attendance</Link>
                        ) : (
                          <Link to={classWorkspacePath(c, 'teaching')} className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-white bg-blue-500">View</Link>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="hidden overflow-x-auto rounded-xl lg:overflow-hidden border border-slate-100 sm:block">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>{['Time', 'Class', 'Subject', 'Room', 'Status', 'Action'].map((h) => <th key={h} className="px-2.5 py-2.5 xl:px-2 font-medium">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {todaysClasses.slice(0, 6).map((c, i) => {
                        const st = c.status === 'In progress' ? 'Ongoing' : c.status;
                        return (
                          <tr key={c.id || i} className="text-slate-800">
                            <td className="whitespace-nowrap px-2.5 py-2.5 xl:px-2">{formatClock(c.startTime) || c.time}</td>
                            <td className="px-2.5 py-2.5 xl:px-2">{c.class || '—'}</td>
                            <td className="px-2.5 py-2.5 xl:px-2">{c.subject || '—'}</td>
                            <td className="px-2.5 py-2.5 xl:px-2">{c.room || '—'}</td>
                            <td className="px-2.5 py-2.5 xl:px-2">
                              <span className={cx('rounded-full px-2 py-1 text-xs font-medium', st === 'Completed' ? 'bg-green-600/80 text-white' : st === 'Ongoing' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500')}>{st}</span>
                            </td>
                            <td className="px-2.5 py-2 xl:px-2">
                              {st === 'Ongoing' ? (
                                <Link to={classWorkspacePath(c, 'students/attendance')} className="inline-flex w-full justify-center whitespace-nowrap rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700">Take Attendance</Link>
                              ) : (
                                <Link to={classWorkspacePath(c, 'teaching')} className="inline-flex w-full justify-center rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold bg-blue-500 text-white">View</Link>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </Panel>

            <Panel icon={Users} iconColor="text-blue-600" title="Today's Attendance" link={{ to: '/teacher/classes/current/students/attendance', label: 'Details' }}>
              {noScheduleToday ? (
                <div className="flex flex-col items-center justify-center px-2 py-6 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-500"><Calendar size={26} /></span>
                  <p className="mt-3 text-[15px] font-semibold text-slate-900">No schedule today</p>
                  <p className="mt-1 text-[12.5px] text-slate-500">You have no classes on {WEEK[todayIdx]}, so there is no attendance to take.</p>
                  <Link to="/teacher/timetable" className="mt-4 rounded-full border border-slate-200 px-4 py-2 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50">View Timetable</Link>
                </div>
              ) : (
              <>
              <div className="flex flex-col items-center px-1 text-center">
                <Donut percent={attendancePercent} />
                <p className="mt-3 text-2xl font-bold text-slate-900">{attendance.present} / {attendanceTotal}</p>
                <p className="text-sm text-slate-500">Students present today</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: 'Present', value: attendance.present, dot: 'bg-emerald-500', box: 'bg-emerald-50 text-emerald-700' },
                  { label: 'Absent', value: attendance.absent, dot: 'bg-rose-500', box: 'bg-rose-50 text-rose-700' },
                  { label: 'Not Marked', value: attendance.notMarked, dot: 'bg-slate-400', box: 'bg-slate-50 text-slate-600' },
                ].map((row) => (
                  <div key={row.label} className={cx('flex flex-col items-center rounded-xl px-1 py-2.5 text-center', row.box)}>
                    <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium">
                      <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', row.dot)} />
                      {row.label}
                    </span>
                    <span className="mt-1 text-lg font-bold text-slate-900">{row.value}</span>
                  </div>
                ))}
              </div>
              <Link to="/teacher/classes/current/students/attendance" className="mt-4 block rounded-full text-white py-2.5 text-center text-sm font-semibold bg-blue-500 hover:bg-blue-700">Take Attendance</Link>
              </>
              )}
            </Panel>

            <Panel icon={Zap} iconColor="text-amber-500" title="Quick Actions">
              <div className="grid grid-cols-2 gap-2.5">
                {(() => {
                  const checkedIn = Boolean(workToday?.hasCheckedIn);
                  const done = Boolean(workToday?.hasCheckedOut);
                  const fmt = (t) => formatClock(t) || t || '';
                  const tile = done
                    ? { label: 'Day Completed', sub: `Entry ${fmt(workToday.checkIn)} · Exit ${fmt(workToday.checkOut)}`, icon: CheckCircle2, bg: 'bg-slate-400', cls: 'border-slate-200 bg-slate-50' }
                    : checkedIn
                      ? { label: 'Mark Exit', sub: `Entry at ${fmt(workToday.checkIn)}`, icon: LogOut, bg: 'bg-rose-500', cls: 'border-rose-100 bg-rose-50' }
                      : { label: 'Mark Entry', sub: 'Start your work day', icon: LogIn, bg: 'bg-emerald-600', cls: 'border-emerald-100 bg-emerald-50' };
                  return (
                    <button
                      type="button"
                      onClick={handleWorkAttendance}
                      disabled={workSaving || done}
                      className={cx('col-span-2 flex h-[60px] items-center gap-3 rounded-xl border px-3 text-left shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-default disabled:hover:translate-y-0', tile.cls)}
                    >
                      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white', tile.bg)}>
                        {workSaving ? <Loader2 size={18} className="animate-spin" /> : React.createElement(tile.icon, { size: 18, strokeWidth: 2.2 })}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-gray-800">{tile.label}</span>
                        <span className="block truncate text-[11px] text-gray-500">{tile.sub}</span>
                      </span>
                    </button>
                  );
                })()}
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
                    <span className="text-[11px] font-medium text-gray-700 lg:text-[10px]">{a.label}</span>
                  </Link>
                ))}
              </div>
            </Panel>
          </MotionSection>

          {/* ── Homework / Schedule / Alerts + Activity ── */}
          <MotionSection variants={itemVariants} className="grid gap-3 md:grid-cols-2 lg:gap-4 xl:grid-cols-3">
            <Panel icon={FileText} iconColor="text-blue-600" title="Homework & Assignments" link={{ to: '/teacher/classes/current/assignments', label: 'View All' }}>
              <p className="mb-3 text-[11.5px] text-slate-500">Your assignments that are due soon or still need follow-up.</p>
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
                  {visibleDeadlines.slice(0, 2).map((task) => {
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
                <ul className="space-y-2">
                  {upcomingSchedule.map((c, i) => {
                    const accent = [
                      'bg-blue-50 text-blue-700',
                      'bg-violet-50 text-violet-700',
                      'bg-emerald-50 text-emerald-700',
                      'bg-amber-50 text-amber-700',
                    ][i % 4];
                    const [clock, meridiem] = String(formatClock(c.startTime) || c.time || '').split(' ');
                    return (
                      <li key={`${c.id || i}-${c.dayLabel}`} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5 transition hover:bg-slate-50">
                        <div className={cx('flex w-[58px] shrink-0 flex-col items-center justify-center rounded-lg py-1.5 leading-tight', accent)}>
                          <span className="text-[10px] font-semibold uppercase tracking-wide">{c.dayLabel === 'Today' || c.dayLabel === 'Tomorrow' ? c.dayLabel : String(c.dayLabel).slice(0, 3)}</span>
                          <span className="text-[13px] font-bold">{clock || '—'}</span>
                          {meridiem && <span className="text-[9px] font-semibold opacity-70">{meridiem}</span>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{c.subject || 'Class'}</p>
                          <p className="truncate text-xs text-slate-500">Class {c.class || '—'}</p>
                        </div>
                        <span className={cx('shrink-0 rounded-full px-2 py-1 text-[11px] font-medium', c.room ? 'bg-slate-200 text-slate-600' : 'text-slate-300')}>
                          {c.room ? `Room ${c.room}` : 'No room'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <div className="md:col-span-2 xl:col-span-1">
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
    label: 'Enter Marks',
    icon: BarChart3,
    to: '/teacher/classes/current/assessments/exam',
    cls: 'bg-white shadow-md border-gray-100',
    iconBg: 'bg-rose-500',
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

const Panel = ({ icon: Icon, iconColor, title, link, children, className = '' }) => (
  <section className={cx('min-w-0 rounded-2xl bg-white p-3.5 shadow-sm sm:p-4', className)}>
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon size={18} className={iconColor} />
        <h2 className="truncate text-[15px] font-semibold text-slate-900 sm:text-[16px]">{title}</h2>
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
