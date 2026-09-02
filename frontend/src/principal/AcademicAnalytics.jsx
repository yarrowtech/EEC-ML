import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Award,
  Calendar,
  Users,
  User,
  BarChart3,
  PieChart,
  Target,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Loader,
  AlertCircle,
  CheckCircle2,
  Clock,
  Inbox,
} from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';

ChartJS.register(ArcElement, Tooltip);

const API_BASE = import.meta.env.VITE_API_URL;

const GRADE_COLOR_HEX = {
  emerald: '#10b981',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
};

const GRADE_COLOR_CLASS = {
  emerald: { dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  green: { dot: 'bg-green-500', bar: 'bg-green-500' },
  blue: { dot: 'bg-blue-500', bar: 'bg-blue-500' },
  yellow: { dot: 'bg-yellow-500', bar: 'bg-yellow-500' },
  orange: { dot: 'bg-orange-500', bar: 'bg-orange-500' },
  red: { dot: 'bg-red-500', bar: 'bg-red-500' },
};

const STATUS_STYLES = {
  completed: { badge: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  upcoming: { badge: 'bg-orange-50 text-orange-700', icon: Clock },
};

const AcademicAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('current_term');

  useEffect(() => {
    const fetchAcademicAnalytics = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/principal/academic/analytics`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${token}`
          }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load academic analytics');
        }
        setAnalytics(data);
      } catch (err) {
        console.error('Academic analytics error:', err);
        setError(err.message || 'Unable to load academic analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAcademicAnalytics();
  }, []);

  const academicOverview = analytics?.academicOverview || {
    averageGPA: '0%',
    passRate: 0,
    honorsStudents: 0,
    improvementRate: 0,
    attendanceRate: 0,
    homeworkCompletion: 0
  };

  const gradeDistribution = analytics?.gradeDistribution || [];
  const subjectPerformance = analytics?.subjectPerformance || [];
  const classAnalytics = analytics?.classAnalytics || [];
  const examSchedule = analytics?.examSchedule || [];

  const gradeTotal = gradeDistribution.reduce((sum, item) => sum + (item.count || 0), 0);
  const gradeDonutData = {
    labels: gradeDistribution.map((item) => item.grade),
    datasets: [
      {
        data: gradeDistribution.map((item) => item.count),
        backgroundColor: gradeDistribution.map((item) => GRADE_COLOR_HEX[item.color] || '#6b7280'),
        borderWidth: 0,
        cutout: '70%',
      },
    ],
  };
  const gradeDonutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: 10,
        borderRadius: 8,
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50">
              <BarChart3 className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Academic Analytics</h1>
              <p className="mt-0.5 text-sm text-slate-500">Comprehensive academic performance insights from your database</p>
            </div>
          </div>

          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="h-11 appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-9 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="current_term">Current Term</option>
              <option value="last_term">Last Term</option>
              <option value="academic_year">Academic Year</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <Loader className="mr-2 h-6 w-6 animate-spin text-indigo-500" />
          <span className="text-slate-600">Loading academic analytics...</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                  <User className="h-5 w-5 text-indigo-600" />
                </div>
                <span className="text-2xl font-bold text-slate-900">{academicOverview.averageGPA}</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">Average Percentage</p>
              <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${academicOverview.averageGPA}` }} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                  <Target className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="text-2xl font-bold text-slate-900">{academicOverview.passRate}%</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">Pass Rate</p>
              <div className="mt-3 flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <ArrowUp className="h-4 w-4" />
                <span>Live from data</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50">
                  <Users className="h-5 w-5 text-rose-600" />
                </div>
                <span className="text-2xl font-bold text-slate-900">{academicOverview.honorsStudents}</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">Honor Students</p>
              <p className="mt-3 text-xs text-slate-400">A/A+ Performers</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-2xl font-bold text-slate-900">{academicOverview.attendanceRate}%</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">Avg Attendance</p>
              <p className="mt-3 text-xs text-slate-400">Academic session</p>
            </div>
          </div>

          {/* Grade Distribution & Subject Performance */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Grade Distribution */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-slate-900">
                <PieChart className="h-5 w-5 text-indigo-500" />
                Grade Distribution
              </h3>
              {gradeDistribution.length > 0 ? (
                <div className="flex flex-col items-center gap-6 sm:flex-row">
                  <div className="relative h-36 w-36 shrink-0">
                    <Doughnut data={gradeDonutData} options={gradeDonutOptions} />
                  </div>
                  <div className="w-full space-y-3">
                    {gradeDistribution.map((item, index) => {
                      const colors = GRADE_COLOR_CLASS[item.color] || { dot: 'bg-gray-500' };
                      return (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className={`h-3 w-3 rounded-full ${colors.dot}`} />
                            <span className="font-medium text-slate-900">{item.grade}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-slate-900">{item.count} students</div>
                            <div className="text-xs text-slate-400">{item.percentage}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                    <PieChart className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No grade distribution data available</p>
                </div>
              )}
            </div>

            {/* Subject Performance */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-slate-900">
                <BookOpen className="h-5 w-5 text-emerald-500" />
                Subject Performance
              </h3>
              {subjectPerformance.length > 0 ? (
                <div className="space-y-4">
                  {subjectPerformance.slice(0, 4).map((subject, index) => (
                    <div key={index} className="rounded-xl border border-slate-100 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-semibold text-slate-900">{subject.subject}</h4>
                        <div className={`flex items-center gap-1 text-sm font-medium ${
                          subject.trend === 'up' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {subject.trend === 'up' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                          Live
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-slate-400">Average Score</div>
                          <div className="font-bold text-slate-900">{subject.avgScore}%</div>
                        </div>
                        <div>
                          <div className="text-slate-400">Above 80%</div>
                          <div className="font-bold text-slate-900">{subject.studentsAbove80}/{subject.totalStudents}</div>
                        </div>
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${subject.avgScore}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                    <BarChart3 className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No subject performance data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Grade-wise Analytics */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="p-6">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <BarChart3 className="h-5 w-5 text-purple-500" />
                Grade-wise Analytics
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Grade</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Total Students</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Average Score</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Top Performers</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Needs Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classAnalytics.length > 0 ? classAnalytics.map((classData, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-semibold text-slate-900">{classData.grade}</td>
                      <td className="px-6 py-4 text-slate-600">{classData.totalStudents}</td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900">{classData.avgGPA}</span>
                        <div className="mt-1 h-1 w-16 rounded-full bg-slate-100">
                          <div className="h-1 rounded-full bg-indigo-500" style={{ width: `${(classData.avgGPA / 4.0) * 100}%` }} />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {classData.topPerformers} students
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                          {classData.needsSupport} students
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                          <Inbox className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">No class-wise analytics available</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Examination Schedule */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-slate-900">
              <Calendar className="h-5 w-5 text-indigo-500" />
              Examination Schedule
            </h3>
            {examSchedule.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {examSchedule.map((exam, index) => {
                  const statusKey = String(exam.status || '').toLowerCase();
                  const style = STATUS_STYLES[statusKey] || { badge: 'bg-blue-50 text-blue-700', icon: Clock };
                  const StatusIcon = style.icon;
                  const statusLabel = exam.status
                    ? exam.status.charAt(0).toUpperCase() + exam.status.slice(1)
                    : 'Scheduled';
                  return (
                    <div key={index} className="rounded-xl border border-slate-100 p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <h4 className="font-semibold text-slate-900">{exam.exam}</h4>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusLabel}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          {new Date(exam.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-slate-400" />
                          {exam.subjects} subjects
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <Calendar className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500">No examination schedule data available</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AcademicAnalytics;
