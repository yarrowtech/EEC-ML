import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion as framerMotion, useReducedMotion } from 'framer-motion';

import {
  Activity,
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
  Eye,
  FileText,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

const MotionSection = framerMotion.section;
const MotionDiv = framerMotion.div;

const getAcademicYearId = (item = {}) =>
  String(item?.classId?.academicYearId?._id || item?.classId?.academicYearId || '').trim();

const cx = (...classes) => classes.filter(Boolean).join(' ');

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

const Badge = ({ children, tone = 'neutral', className = '' }) => {
  const tones = {
    neutral: 'border-slate-200 bg-white text-slate-600',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
  };

  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold', tones[tone], className)}>
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
      transition={{ duration: 0.28, delay }}
      className={cx('rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm shadow-slate-200/70', className)}
    >
      {children}
    </MotionSection>
  );
};
const SectionHeader = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-700">
        {React.createElement(Icon, { size: 18 })}
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

const Progress = ({ value, tone = 'emerald' }) => {
  const tones = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    sky: 'bg-sky-500',
    violet: 'bg-violet-500',
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={cx('h-full rounded-full transition-all duration-500', tones[tone])} style={{ width: `${clampPercent(value)}%` }} />
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 ring-1 ring-slate-200">
      {React.createElement(Icon, { size: 22 })}
    </div>
    <p className="font-semibold text-slate-950">{title}</p>
    <p className="mt-1 max-w-xs text-sm leading-5 text-slate-500">{description}</p>
  </div>
);

const SkeletonGrid = () => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <div key={index} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-slate-100/80" />
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
          fetch(`${import.meta.env.VITE_API_URL}/api/teacher/dashboard`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/api/teacher/dashboard/allocations`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/api/academic/active-year`, { headers }).catch(() => null),
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

  const upcomingClasses = dashboardData?.upcomingClasses || [];
  const performanceMetrics = dashboardData?.performanceMetrics || [];
  const upcomingDeadlines = dashboardData?.upcomingDeadlines || [];
  const recentActivities = (dashboardData?.recentActivities || []).map((activity) => ({
    ...activity,
    time: timeAgo(activity.time),
  }));

  const nextClass = upcomingClasses[0];
  const pendingTasks = Number(stats.pendingEvaluations ?? upcomingDeadlines.length ?? 0);

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
    show: { opacity: 1, transition: { staggerChildren: 0.04 } },
  };
  const itemVariants = reduceMotion ? {} : {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-0 bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-[1800px] space-y-4 p-3 pt-0 sm:p-4 sm:pt-0 lg:p-5 lg:pt-0">
        {dashboardError && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle size={18} />
              {dashboardError}
            </div>
          )}

          <MotionDiv variants={pageVariants} initial="hidden" animate="show" className="space-y-4">
            <MotionSection variants={itemVariants} className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-xl shadow-slate-300/40 sm:p-6 lg:p-7">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.35),transparent_34%),linear-gradient(135deg,rgba(14,165,233,0.26),transparent_42%)]" />
              <div className="absolute right-6 top-6 hidden h-36 w-36 rounded-full border border-white/10 lg:block" />
              <div className="relative grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-end">
                <div>
                  <div className="mb-5 flex flex-wrap items-center gap-2">
                    <Badge tone="emerald" className="border-white/15 bg-white/10 text-white"><span className="h-2 w-2 rounded-full bg-emerald-300" />Live workspace</Badge>
                    <Badge tone="neutral" className="border-white/15 bg-white/10 text-white">{dateStr}</Badge>
                    <Badge tone="neutral" className="border-white/15 bg-white/10 text-white">{currentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Badge>
                  </div>
                  <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{getGreeting()}, {teacherName.split(' ')[0]}.</h1>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-slate-200">
                    You have {upcomingClasses.length} classes today and {pendingTasks} pending evaluations. AI can prepare your next lesson, flag student risks, and clear routine work faster.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link to="/teacher/classes" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5">Open classes <ArrowUpRight size={16} /></Link>
                    <Link to="/teacher/lesson-plan" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15">Ask AI <Sparkles size={16} /></Link>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <HeroChip label="Class teacher" value={classTeacherLabel} />
                  <HeroChip label="Next class" value={nextClass ? `${nextClass.subject} at ${nextClass.time}` : 'No class queued'} />
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
                      <CardShell delay={index * 0.03} className="h-full p-5 transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg">
                        <div className="flex items-start justify-between gap-3">
                          <div className={cx('rounded-2xl p-3', stat.tone === 'rose' ? 'bg-rose-50 text-rose-600' : stat.tone === 'amber' ? 'bg-amber-50 text-amber-600' : stat.tone === 'violet' ? 'bg-violet-50 text-violet-600' : stat.tone === 'sky' ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600')}>
                            <Icon size={21} />
                          </div>
                        </div>
                        <div className="mt-5">
                          <div className="flex items-end justify-between gap-3">
                            <p className="text-3xl font-semibold tracking-tight text-slate-950">{stat.value}</p>
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-700">{stat.label}</p>
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
                  <SectionHeader icon={Zap} title="Workflow Actions" subtitle="Grouped by how teachers actually move through the day." action={<Link to="/teacher/classes" className="text-sm font-semibold text-slate-700 hover:text-slate-950">View modules</Link>} />
                  <div className="grid gap-4 p-5 lg:grid-cols-2">
                    {workflowGroups.map((group) => (
                      <div key={group.title}>
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">{group.title}</h3>
                        <div className="space-y-3">
                          {group.items.map((item) => <WorkflowAction key={item.title} item={item} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardShell>

                <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                  <CardShell>
                    <SectionHeader icon={Clock} title="Today's Schedule" subtitle={nextClass ? `Next: ${nextClass.subject} ${nextClass.time}` : 'Your class timeline is clear.'} action={<Badge tone="emerald">Live</Badge>} />
                    <div className="max-h-[430px] space-y-3 overflow-y-auto p-5">
                      {upcomingClasses.length === 0 ? <EmptyState icon={Calendar} title="No classes scheduled" description="Your schedule will appear here when timetable data is available." /> : upcomingClasses.map((classItem, index) => (
                        <ScheduleItem key={classItem.id || `${classItem.subject}-${index}`} classItem={classItem} index={index} reduceMotion={reduceMotion} />
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
                    <div className="grid gap-3 p-5 sm:grid-cols-2">
                      {analyticsSnapshot.map((metric) => (
                        <Link key={metric.label} to="/teacher/classes/current/reports" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white">
                          <div className="mb-4 flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{metric.label}</p>
                              <p className="mt-1 text-xs text-slate-500">{metric.helper}</p>
                            </div>
                            <ArrowUpRight size={16} className="text-slate-400" />
                          </div>
                          <p className="mb-3 text-2xl font-semibold text-slate-950">{metric.value}</p>
                          <Progress value={metric.progress} tone={metric.tone} />
                        </Link>
                      ))}
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
                    <SectionHeader icon={CheckCircle2} title="Priority Task Board" subtitle="Deadlines without report-page overload." action={<Badge tone="amber">{upcomingDeadlines.length} pending</Badge>} />
                    <div className="max-h-[440px] space-y-3 overflow-y-auto p-5">
                      {upcomingDeadlines.length === 0 ? <EmptyState icon={CheckCircle2} title="All caught up" description="No upcoming deadlines are waiting for action." /> : upcomingDeadlines.map((task, index) => <DeadlineTask key={`${task.title}-${index}`} task={task} index={index} />)}
                    </div>
                  </CardShell>
                </div>
              </div>

            </MotionSection>
          </MotionDiv>
      </div>
    </div>
  );
};

const HeroChip = ({ label, value }) => (
  <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
    <p className="text-xs uppercase tracking-wide text-slate-300">{label}</p>
    <p className="mt-1 text-sm font-semibold text-white">{value}</p>
  </div>
);

const WorkflowAction = ({ item }) => {
  const Icon = item.icon;
  return (
    <Link to={item.path} className="group flex min-h-[98px] gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200 transition group-hover:bg-slate-950 group-hover:text-white">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-slate-950">{item.title}</p>
        <p className="mt-1 text-sm leading-5 text-slate-500">{item.description}</p>
      </div>
    </Link>
  );
};

const ScheduleItem = ({ classItem, index, reduceMotion }) => (
  <MotionDiv
    initial={reduceMotion ? false : { opacity: 0, x: -12 }}
    animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
    transition={{ duration: 0.24, delay: index * 0.03 }}
    className={cx('relative rounded-2xl border p-4 transition hover:border-slate-300 hover:bg-slate-50', index === 0 ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-white')}
  >
    <div className="flex items-start gap-3">
      <span className={cx('mt-1 h-12 w-1.5 rounded-full', index === 0 ? 'bg-emerald-500' : 'bg-slate-300')} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-950">{classItem.subject}</h3>
          <Badge tone={index === 0 ? 'emerald' : 'neutral'}>{classItem.status || (index === 0 ? 'Next class' : 'Scheduled')}</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">{classItem.class} {classItem.section && `• ${classItem.section}`} {classItem.room && `• Room ${classItem.room}`}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/teacher/classes/current/students/attendance" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-slate-300"><ClipboardCheck size={14} /> Attendance</Link>
          <Link to="/teacher/classes/current/teaching" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white">Open <ChevronRight size={14} /></Link>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold text-slate-950">{classItem.time}</p>
        <p className="mt-1 text-xs text-slate-500">{index === 0 ? 'Starts soon' : 'Upcoming'}</p>
      </div>
    </div>
  </MotionDiv>
);

const TimeframeToggle = ({ activeTimeframe, setActiveTimeframe }) => (
  <div className="flex rounded-xl bg-slate-100 p-1">
    {['weekly', 'monthly', 'yearly'].map((timeframe) => (
      <button key={timeframe} type="button" onClick={() => setActiveTimeframe(timeframe)} className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition', activeTimeframe === timeframe ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-950')}>
        {timeframe}
      </button>
    ))}
  </div>
);

const ActivityItem = ({ activity, index, total }) => (
  <div className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-2xl p-3 transition hover:bg-slate-50">
    <div className="relative">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Activity size={18} /></div>
      {index < total - 1 && <span className="absolute left-1/2 top-11 h-5 w-px bg-slate-200" />}
    </div>
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-slate-950">{activity.message}</p>
      <p className="mt-1 text-xs text-slate-500">{activity.class || 'Class update'} • {activity.time}</p>
    </div>
    <button className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="View activity"><Eye size={16} /></button>
  </div>
);

const DeadlineTask = ({ task, index }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50">
    <div className="mb-3 flex items-center justify-between gap-2">
      <Badge tone={index === 0 ? 'rose' : 'amber'}>{daysUntil(task.dueDate)}</Badge>
      <span className="text-xs font-semibold text-slate-400">{formatDate(task.dueDate)}</span>
    </div>
    <h3 className="font-semibold text-slate-950">{task.title}</h3>
    <p className="mt-1 text-sm text-slate-500">{task.class || '-'}{task.subject ? ` • ${task.subject}` : ''}</p>
    <div className="mt-4 flex gap-2">
      <button type="button" className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-slate-300">Mark complete</button>
      <Link to="/teacher/classes/current/assignments" className="inline-flex h-8 items-center rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white">Open task</Link>
    </div>
  </div>
);

export default TeacherDashboard;
