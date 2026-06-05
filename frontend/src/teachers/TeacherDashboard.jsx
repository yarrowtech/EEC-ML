import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Activity,
  Calendar,
  FileText,
  ClipboardCheck,
  Bell,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  Eye,
  ChevronRight,
  AlertTriangle,
  Award,
  Sparkles,
  ThumbsUp,
  Download,
  Filter,
  MoreHorizontal,
  ArrowUpRight,
  BookOpen,
  GraduationCap,
} from 'lucide-react';

const getAcademicYearId = (item = {}) =>
  String(item?.classId?.academicYearId?._id || item?.classId?.academicYearId || '').trim();

const TeacherDashboard = () => {
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

  const timeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    if (Number.isNaN(diffMs)) return 'Just now';
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

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

  const classTeacherLabel = classTeacherAllocations.length
    ? classTeacherAllocations
        .map((item) => {
          const className = item?.classId?.name || item?.className || 'Class';
          const sectionName = item?.sectionId?.name || item?.sectionName || 'Section';
          return `${className}-${sectionName}`;
        })
        .join(', ')
    : '';

  const stats = dashboardData?.stats || {};
  const teacherName = dashboardData?.teacher?.name || 'Teacher';
  const teacherInitials = teacherName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const quickStats = [
    {
      label: 'Total Students',
      value: stats.totalStudents ?? 0,
      change: '+12.5%',
      trend: 'up',
      icon: Users,
    },
    {
      label: 'Attendance Rate',
      value: `${stats.attendanceRate ?? 0}%`,
      change: '+3.2%',
      trend: 'up',
      icon: Activity,
    },
    {
      label: 'Pending Tasks',
      value: stats.pendingEvaluations ?? 0,
      change: '-8.1%',
      trend: 'down',
      icon: FileText,
    },
    {
      label: 'Upcoming Events',
      value: stats.upcomingEvents ?? 0,
      change: '+2',
      trend: 'up',
      icon: Calendar,
    },
  ];

  const recentActivities = (dashboardData?.recentActivities || []).map((activity) => ({
    ...activity,
    time: timeAgo(activity.time),
  }));

  const upcomingClasses = dashboardData?.upcomingClasses || [];
  const performanceMetrics = dashboardData?.performanceMetrics || [];
  const topStudents = dashboardData?.topStudents || [];
  const upcomingDeadlines = dashboardData?.upcomingDeadlines || [];

  const quickActions = [
    { id: 1, label: 'Mark Attendance', icon: ClipboardCheck, path: '/teacher/attendance' },
    { id: 2, label: 'Assignments', icon: FileText, path: '/teacher/assignments' },
    { id: 3, label: 'Parent Meetings', icon: Calendar, path: '/teacher/parent-meetings' },
    { id: 4, label: 'Student Progress', icon: BarChart3, path: '/teacher/progress' },
    { id: 5, label: 'Weak Students', icon: AlertTriangle, path: '/teacher/weak-students' },
    { id: 6, label: 'Smart Teaching', icon: Sparkles, path: '/teacher/smart-teaching' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-white font-semibold text-lg shadow-lg">
              {teacherInitials}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                {getGreeting()}, {teacherName.split(' ')[0]}
              </h1>
              <p className="text-sm text-muted">{dateStr}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {classTeacherLabel && (
              <span className="px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-medium">
                Class Teacher: {classTeacherLabel}
              </span>
            )}
            <button className="p-2 rounded-xl bg-surface border border-border hover:bg-surface-secondary transition-colors">
              <Download size={18} className="text-foreground/70" />
            </button>
            <button className="p-2 rounded-xl bg-surface border border-border hover:bg-surface-secondary transition-colors">
              <Filter size={18} className="text-foreground/70" />
            </button>
          </div>
        </div>

        {dashboardError && (
          <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {dashboardError}
          </div>
        )}

        {dashboardLoading && (
          <div className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            Loading dashboard data...
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickStats.map((stat, i) => {
            const Icon = stat.icon;
            const isPositive = stat.trend === 'up';
            return (
              <div
                key={i}
                className="bg-surface rounded-2xl border border-border p-5 hover:shadow-lg hover:border-accent/20 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-accent/10">
                    <Icon size={20} className="text-accent" />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-success' : 'text-danger'}`}>
                    {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {stat.change}
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-foreground mb-1">{stat.value}</p>
                <p className="text-sm text-muted">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="bg-surface rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Quick Actions</h2>
            <Link to="/teacher" className="text-sm text-accent hover:underline flex items-center gap-1">
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.id}
                  to={action.path}
                  className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-surface-secondary hover:bg-accent/10 border border-transparent hover:border-accent/20 transition-all duration-200"
                >
                  <div className="p-3 rounded-xl bg-surface group-hover:bg-accent/10 transition-colors">
                    <Icon size={22} className="text-accent" />
                  </div>
                  <span className="text-xs font-medium text-foreground text-center">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Weekly Schedule */}
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-accent" />
                <h2 className="text-base font-semibold text-foreground">Today's Schedule</h2>
              </div>
              <button className="p-1.5 rounded-lg hover:bg-surface-secondary transition-colors">
                <MoreHorizontal size={18} className="text-muted" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[380px] overflow-y-auto">
              {upcomingClasses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-surface-secondary mb-4">
                    <Calendar size={28} className="text-muted" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No classes scheduled</p>
                  <p className="text-xs text-muted">Your schedule will appear here</p>
                </div>
              ) : (
                upcomingClasses.map((c, idx) => (
                  <div
                    key={c.id || idx}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary hover:bg-surface-tertiary transition-colors"
                  >
                    <div className="w-1 h-12 rounded-full bg-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.subject}</p>
                      <p className="text-xs text-muted">
                        {c.class} {c.section && `• ${c.section}`} {c.room && `• ${c.room}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{c.time}</p>
                      <span className="text-xs text-accent font-medium">{c.status || 'Scheduled'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-4 py-3 border-t border-border">
              <Link
                to="/teacher/class-routine"
                className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-accent hover:bg-accent/10 rounded-xl transition-colors"
              >
                View Full Schedule
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>

          {/* Performance Overview */}
          <div className="lg:col-span-2 bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-accent" />
                <h2 className="text-base font-semibold text-foreground">Performance Overview</h2>
              </div>
              <div className="flex items-center gap-1 p-1 bg-surface-secondary rounded-lg">
                {['weekly', 'monthly', 'yearly'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setActiveTimeframe(tf)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      activeTimeframe === tf
                        ? 'bg-surface text-foreground shadow-sm'
                        : 'text-muted hover:text-foreground'
                    }`}
                  >
                    {tf.charAt(0).toUpperCase() + tf.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Subject Performance */}
                <div>
                  <h3 className="text-sm font-medium text-muted mb-4">Subject Averages</h3>
                  <div className="space-y-4">
                    {performanceMetrics.length === 0 ? (
                      <div className="flex flex-col items-center py-8 text-center">
                        <div className="p-3 rounded-full bg-surface-secondary mb-3">
                          <BarChart3 size={24} className="text-muted" />
                        </div>
                        <p className="text-xs text-muted">Data appears after grading</p>
                      </div>
                    ) : (
                      performanceMetrics.map((s, i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-foreground">{s.subject}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground">{s.average}%</span>
                              {s.trend === 'up' && <TrendingUp size={14} className="text-success" />}
                              {s.trend === 'down' && <TrendingDown size={14} className="text-danger" />}
                            </div>
                          </div>
                          <div className="h-2 bg-surface-tertiary rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-all duration-500"
                              style={{ width: `${s.average}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Top Students */}
                <div>
                  <h3 className="text-sm font-medium text-muted mb-4">Top Performers</h3>
                  <div className="space-y-3">
                    {topStudents.length === 0 ? (
                      <div className="flex flex-col items-center py-8 text-center">
                        <div className="p-3 rounded-full bg-surface-secondary mb-3">
                          <Award size={24} className="text-muted" />
                        </div>
                        <p className="text-xs text-muted">Appears after grading</p>
                      </div>
                    ) : (
                      topStudents.map((st, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white ${
                            i === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                            i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                            'bg-gradient-to-br from-amber-600 to-amber-700'
                          }`}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{st.name}</p>
                            <p className="text-xs text-muted">{st.grade}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground">{st.score}%</p>
                            <p className="text-xs text-success font-medium">{st.improvement}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-accent" />
                <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
              </div>
              <span className="text-xs text-muted">{recentActivities.length} updates</span>
            </div>
            <div className="divide-y divide-border">
              {recentActivities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-surface-secondary mb-4">
                    <Bell size={28} className="text-muted" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No recent activity</p>
                  <p className="text-xs text-muted">Updates will appear here</p>
                </div>
              ) : (
                recentActivities.slice(0, 5).map((a, idx) => (
                  <div key={a.id || idx} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-secondary transition-colors">
                    <div className="p-2.5 rounded-xl bg-accent/10 shrink-0">
                      <Activity size={18} className="text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.message}</p>
                      <p className="text-xs text-muted">{a.time}</p>
                    </div>
                    <button className="p-2 rounded-lg hover:bg-surface-tertiary transition-colors">
                      <Eye size={16} className="text-muted" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-danger" />
                <h2 className="text-base font-semibold text-foreground">Deadlines</h2>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-danger/10 text-danger text-xs font-medium">
                {upcomingDeadlines.length} pending
              </span>
            </div>
            <div className="p-4 space-y-3 max-h-[320px] overflow-y-auto">
              {upcomingDeadlines.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-surface-secondary mb-4">
                    <Calendar size={28} className="text-muted" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">All caught up!</p>
                  <p className="text-xs text-muted">No upcoming deadlines</p>
                </div>
              ) : (
                upcomingDeadlines.map((item, idx) => (
                  <div
                    key={`${item.title}-${idx}`}
                    className="p-4 rounded-xl border border-border hover:border-accent/20 hover:bg-accent/5 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-accent uppercase tracking-wide">
                        {item.type || 'Task'}
                      </span>
                      <span className="text-xs font-medium text-muted bg-surface-secondary px-2 py-0.5 rounded-full">
                        {item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBA'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">{item.title}</p>
                    <p className="text-xs text-muted">
                      {item.class || '-'}{item.subject ? ` • ${item.subject}` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TeacherDashboard;
