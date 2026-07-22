import React from 'react';
import {
  Calendar, Download, RefreshCw, ArrowUp, ArrowDown,
  Bell, Activity, BarChart3, PieChart, TrendingUp, Users,
  GraduationCap, BookOpen, DollarSign
} from 'lucide-react';
import { Bar, Pie } from 'react-chartjs-2';

const OverviewPage = ({ overview, isLoading, loadError, schoolStats, quickStats, attendanceTrend, studentPerformance, criticalNotifications, recentActivities, monthlyGrowth, schoolName, onRefreshOverview }) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // ChartJS data for Attendance Trend
  const attendanceChartData = {
    labels: attendanceTrend.map((d) => d.month),
    datasets: [
      {
        label: 'Attendance Rate',
        data: attendanceTrend.map((d) => d.value),
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderRadius: 6,
        barThickness: 32,
      },
      {
        label: 'Target',
        data: Array(attendanceTrend.length).fill(95),
        backgroundColor: 'rgba(16, 185, 129, 0.3)',
        borderRadius: 6,
        barThickness: 32,
      }
    ]
  };

  const attendanceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: { size: 12, weight: '500' },
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle',
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        borderRadius: 8,
        titleFont: { size: 13, weight: '600' },
        bodyFont: { size: 12 },
      }
    },
    scales: {
      y: {
        min: 85,
        max: 100,
        ticks: {
          stepSize: 5,
          font: { size: 11 },
          color: '#6b7280',
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
        border: { display: false }
      },
      x: {
        ticks: {
          font: { size: 11 },
          color: '#6b7280',
        },
        grid: {
          display: false,
        },
        border: { display: false }
      }
    },
  };

  // ChartJS data for Student Performance Distribution
  const performanceChartData = {
    labels: studentPerformance.map((d) => d.grade),
    datasets: [
      {
        label: 'Students',
        data: studentPerformance.map((d) => d.students),
        backgroundColor: [
          'rgba(99, 102, 241, 0.9)',
          'rgba(59, 130, 246, 0.9)',
          'rgba(16, 185, 129, 0.9)',
          'rgba(251, 146, 60, 0.9)',
          'rgba(239, 68, 68, 0.9)'
        ],
        borderWidth: 0,
      }
    ]
  };

  const performanceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: { size: 11, weight: '500' },
          padding: 12,
          usePointStyle: true,
          pointStyle: 'circle',
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        borderRadius: 8,
        titleFont: { size: 13, weight: '600' },
        bodyFont: { size: 12 },
      }
    },
  };

  const renderQuickStatsCard = (stat, index) => {
    const Icon = stat.icon;
    const colorMap = {
      'bg-blue-600': 'from-blue-500 to-blue-600',
      'bg-green-600': 'from-green-500 to-green-600',
      'bg-purple-600': 'from-purple-500 to-purple-600',
      'bg-orange-600': 'from-orange-500 to-orange-600',
      'bg-indigo-600': 'from-indigo-500 to-indigo-600',
      'bg-yellow-500': 'from-yellow-400 to-yellow-500',
    };

    const gradient = colorMap[stat.color] || 'from-gray-500 to-gray-600';

    return (
      <div
        key={index}
        className="group relative bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden"
      >
        {/* Animated background gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>

        <div className="relative flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 mb-2">{stat.title}</p>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</h3>
            {stat.change && (
              <div className={`inline-flex items-center gap-1 text-sm font-semibold ${
                stat.changeType === 'increase'
                  ? 'text-green-600'
                  : stat.changeType === 'decrease'
                  ? 'text-red-600'
                  : 'text-gray-400'
              }`}>
                {stat.changeType === 'increase' && <ArrowUp className="w-4 h-4" />}
                {stat.changeType === 'decrease' && <ArrowDown className="w-4 h-4" />}
                <span>{stat.change}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-md group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Header */}
      <div className="relative bg-slate-950 rounded-2xl p-8 border border-slate-200 shadow-xl overflow-hidden text-white">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold">
              {getGreeting()}, Principal
            </h1>
            <p className="text-slate-300 text-base">
              Overview of {schoolName || 'your institution'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white/10 rounded-xl border border-white/15">
              <Calendar className="w-5 h-5 text-slate-200" />
              <span className="text-sm font-medium text-slate-100">
                {new Date().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>

            <button
              onClick={onRefreshOverview}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 rounded-xl transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm font-semibold">Refresh</span>
            </button>

            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/15 hover:bg-white/15 text-slate-100 rounded-xl transition-all duration-200">
              <Download className="w-4 h-4" />
              <span className="text-sm font-semibold">Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Key Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
          {quickStats.map((stat, index) => renderQuickStatsCard(stat, index))}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Attendance Trend Chart */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Attendance Overview</h3>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
              <TrendingUp className="w-4 h-4 text-slate-700" />
              <span className="text-sm font-semibold text-slate-700">Last 6 Months</span>
            </div>
          </div>
          <div className="h-80">
            {attendanceTrend.length > 0 ? (
              <Bar data={attendanceChartData} options={attendanceChartOptions} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <BarChart3 className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm font-medium">No attendance data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Student Performance */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Performance Distribution</h3>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
              <GraduationCap className="w-4 h-4 text-slate-700" />
              <span className="text-sm font-semibold text-slate-700">Current Term</span>
            </div>
          </div>
          <div className="h-80 flex items-center justify-center">
            {studentPerformance.length > 0 ? (
              <Pie data={performanceChartData} options={performanceChartOptions} />
            ) : (
              <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <PieChart className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm font-medium">No performance data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notifications and Activities */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Critical Notifications */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Bell className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Critical Alerts</h3>
            </div>
            {criticalNotifications.length > 0 && (
              <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                {criticalNotifications.length}
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {criticalNotifications.length > 0 ? (
              criticalNotifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className="p-5 hover:bg-gray-50 transition-colors cursor-pointer group">
                  <div className="flex items-start gap-4">
                    <div className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${
                      notification.priority === 'high' ? 'bg-red-500' : 'bg-yellow-500'
                    } group-hover:scale-125 transition-transform`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-gray-900 text-sm">{notification.title}</p>
                        <span className="text-xs text-gray-400 ml-2">{notification.timestamp}</span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{notification.message}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm font-medium">No critical notifications</p>
                <p className="text-gray-400 text-xs mt-1">You're all caught up!</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Recent Activities</h3>
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {recentActivities.length > 0 ? (
              recentActivities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="p-5 hover:bg-gray-50 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      activity.type === 'staff' ? 'bg-green-500' :
                      activity.type === 'student' ? 'bg-blue-500' :
                      activity.type === 'finance' ? 'bg-purple-500' :
                      'bg-orange-500'
                    } group-hover:scale-125 transition-transform`}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                      <span className="text-xs text-gray-400">{activity.time}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm font-medium">No recent activities</p>
                <p className="text-gray-400 text-xs mt-1">Activities will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

export default OverviewPage;
