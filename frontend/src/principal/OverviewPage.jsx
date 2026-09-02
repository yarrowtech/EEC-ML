import React, { useMemo } from 'react';
import {
  Calendar, Download, RefreshCw, ChevronDown,
  Bell, Activity, TrendingUp, GraduationCap,
} from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, ArcElement, Filler, Tooltip, Legend);

// Fixed circular icon styling for the six quick-stat cards, in display order.
const STAT_STYLES = [
  { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { bg: 'bg-blue-50', text: 'text-blue-600' },
  { bg: 'bg-orange-50', text: 'text-orange-600' },
  { bg: 'bg-rose-50', text: 'text-rose-600' },
  { bg: 'bg-purple-50', text: 'text-purple-600' },
];

const DONUT_PALETTE = ['#6366f1', '#3b82f6', '#22c55e', '#fb923c', '#ef4444', '#6b7280'];

const OverviewPage = ({ overview, isLoading, loadError, schoolStats, quickStats, attendanceTrend, studentPerformance, criticalNotifications, recentActivities, monthlyGrowth, schoolName, academicYears, selectedYearId, onSelectYear, isRefreshing, onRefreshOverview }) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const attendanceChartData = {
    labels: attendanceTrend.map((d) => d.month),
    datasets: [
      {
        label: 'Attendance Rate',
        data: attendanceTrend.map((d) => d.value),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 5,
        tension: 0.4,
        fill: true,
        borderWidth: 2.5,
      },
      {
        label: 'Target',
        data: Array(attendanceTrend.length).fill(95),
        borderColor: '#22c55e',
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderDash: [6, 5],
        tension: 0,
        borderWidth: 2,
      },
    ],
  };

  const attendanceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: {
          font: { size: 12, weight: '500' },
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: 10,
        borderRadius: 8,
        titleFont: { size: 12, weight: '600' },
        bodyFont: { size: 12 },
      },
    },
    scales: {
      y: {
        min: 80,
        max: 100,
        ticks: { stepSize: 5, font: { size: 11 }, color: '#94a3b8' },
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        border: { display: false },
      },
      x: {
        ticks: { font: { size: 11 }, color: '#94a3b8' },
        grid: { display: false },
        border: { display: false },
      },
    },
  };

  const performanceTotal = studentPerformance.reduce((sum, d) => sum + (d.students || 0), 0);
  const topGrade = useMemo(
    () => studentPerformance.reduce((max, d) => (!max || d.students > max.students ? d : max), null),
    [studentPerformance]
  );
  const topGradePercent = topGrade && performanceTotal > 0
    ? Math.round((topGrade.students / performanceTotal) * 100)
    : 0;

  const performanceChartData = {
    labels: studentPerformance.map((d) => d.grade),
    datasets: [
      {
        data: studentPerformance.map((d) => d.students),
        backgroundColor: DONUT_PALETTE,
        borderWidth: 0,
        cutout: '72%',
      },
    ],
  };

  const performanceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: 10,
        borderRadius: 8,
        titleFont: { size: 12, weight: '600' },
        bodyFont: { size: 12 },
      },
    },
  };

  const renderQuickStatsCard = (stat, index) => {
    const Icon = stat.icon;
    const style = STAT_STYLES[index % STAT_STYLES.length];

    return (
      <div
        key={stat.title}
        className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-sm transition-shadow hover:shadow-md"
      >
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${style.bg}`}>
          <Icon className={`h-6 w-6 ${style.text}`} strokeWidth={2} />
        </div>
        <p className="text-xs font-medium text-slate-500">{stat.title}</p>
        {isLoading ? (
          <span className="h-7 w-16 animate-pulse rounded-md bg-slate-100" />
        ) : (
          <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
        )}
        {stat.change && (
          <span className="text-[11px] font-semibold text-emerald-600">{stat.change}</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-indigo-600 via-indigo-600 to-violet-600 p-6 shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">
              {getGreeting()}, Principal
            </h1>
            <p className="text-sm text-indigo-100 sm:text-base">
              Here&apos;s what&apos;s happening at {schoolName || 'your institution'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5">
              <Calendar className="h-4 w-4 text-indigo-100" />
              <span className="text-sm font-medium text-white">
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <button
              onClick={onRefreshOverview}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-slate-900 shadow-sm transition-colors duration-200 hover:bg-slate-100 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-white"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="text-sm font-semibold">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {/* <button className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-white transition-all duration-200 hover:bg-white/15">
              <Download className="h-4 w-4" />
              <span className="text-sm font-semibold">Export</span>
            </button> */}
          </div>
        </div>

        {/* Decorative school illustration */}
        <svg
          className="pointer-events-none absolute bottom-0 right-6 hidden h-28 w-28 text-white/15 lg:block"
          viewBox="0 0 100 100"
          fill="none"
          aria-hidden="true"
        >
          <path d="M50 8 L88 30 H12 Z" fill="currentColor" />
          <rect x="18" y="30" width="64" height="54" rx="2" fill="currentColor" opacity="0.85" />
          <rect x="44" y="10" width="6" height="12" fill="currentColor" />
          <circle cx="47" cy="8" r="3" fill="currentColor" />
          <rect x="30" y="42" width="10" height="10" rx="1" fill="#4338ca" />
          <rect x="60" y="42" width="10" height="10" rx="1" fill="#4338ca" />
          <rect x="30" y="60" width="10" height="10" rx="1" fill="#4338ca" />
          <rect x="45" y="60" width="10" height="24" rx="1" fill="#4338ca" />
          <rect x="60" y="60" width="10" height="10" rx="1" fill="#4338ca" />
          <circle cx="10" cy="80" r="9" fill="currentColor" opacity="0.7" />
          <circle cx="92" cy="76" r="7" fill="currentColor" opacity="0.7" />
        </svg>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {quickStats.map((stat, index) => renderQuickStatsCard(stat, index))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Attendance Trend Chart */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Attendance Overview</h3>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              Last 6 Months
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
          <div className="h-72">
            {attendanceTrend.length > 0 ? (
              <Line data={attendanceChartData} options={attendanceChartOptions} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <TrendingUp className="h-7 w-7 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500">No attendance data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Student Performance */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Performance Distribution</h3>
            <div className="relative">
              <GraduationCap className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedYearId || ''}
                onChange={(e) => onSelectYear?.(e.target.value)}
                disabled={!academicYears?.length}
                className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {!academicYears?.length && <option value="">Current Term</option>}
                {academicYears?.map((year) => (
                  <option key={year._id} value={year._id}>
                    {year.name}{year.isActive ? ' (Active)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          {studentPerformance.length > 0 ? (
            <>
              <div className="relative mx-auto h-56 w-56">
                <Doughnut data={performanceChartData} options={performanceChartOptions} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900">{topGradePercent}%</span>
                  <span className="text-xs text-slate-400">{topGrade?.grade || ''}</span>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                {studentPerformance.map((d, i) => (
                  <div key={d.grade} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="h-2 w-2 rounded-full" style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }} />
                    <span>{d.grade}</span>
                    <span className="font-semibold text-slate-800">
                      {performanceTotal > 0 ? Math.round((d.students / performanceTotal) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-56 flex-col items-center justify-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <GraduationCap className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500">No performance data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Notifications and Activities */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Critical Alerts */}
        {/* <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50">
                <Bell className="h-4.5 w-4.5 text-rose-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Critical Alerts</h3>
            </div>
            {criticalNotifications.length > 0 && (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                {criticalNotifications.length}
              </span>
            )}
          </div>
          <div className="max-h-96 divide-y divide-slate-50 overflow-y-auto">
            {criticalNotifications.length > 0 ? (
              criticalNotifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className="group cursor-pointer p-4 transition-colors hover:bg-slate-50">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full transition-transform group-hover:scale-125 ${
                      notification.priority === 'high' ? 'bg-rose-500' : 'bg-amber-500'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                        <span className="whitespace-nowrap text-xs text-slate-400">{notification.timestamp}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{notification.message}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <Bell className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500">No critical notifications</p>
                <p className="mt-0.5 text-xs text-slate-400">You&apos;re all caught up!</p>
              </div>
            )}
          </div>
          {criticalNotifications.length > 0 && (
            <div className="border-t border-slate-100 p-3 text-center">
              <a href="/principal/notifications" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                View All Alerts
              </a>
            </div>
          )}
        </div> */}

        {/* Recent Activities */}
        {/* <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                <Activity className="h-4.5 w-4.5 text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Recent Activities</h3>
            </div>
          </div>
          <div className="max-h-96 divide-y divide-slate-50 overflow-y-auto">
            {recentActivities.length > 0 ? (
              recentActivities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="group cursor-pointer p-4 transition-colors hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 shrink-0 rounded-full transition-transform group-hover:scale-125 ${
                      activity.type === 'staff' ? 'bg-emerald-500' :
                      activity.type === 'student' ? 'bg-blue-500' :
                      activity.type === 'finance' ? 'bg-purple-500' :
                      'bg-orange-500'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{activity.action}</p>
                      <span className="text-xs text-slate-400">{activity.time}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <Activity className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500">No recent activities</p>
                <p className="mt-0.5 text-xs text-slate-400">Activities will appear here</p>
              </div>
            )}
          </div>
        </div> */}
      </div>

      <p className="pt-2 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {schoolName || 'Electronic Educare'}. All rights reserved.
      </p>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.5s ease-out; }
      `}</style>
    </div>
  );
};

export default OverviewPage;
