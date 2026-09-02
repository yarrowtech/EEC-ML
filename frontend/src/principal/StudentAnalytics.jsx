import React, { useEffect, useMemo, useState } from 'react';
import {
  GraduationCap,
  Users,
  Award,
  Loader,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Trophy,
  UsersRound,
} from 'lucide-react';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const API_BASE = import.meta.env.VITE_API_URL;

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-rose-100 text-rose-700',
];

const StudentAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    const fetchStudentAnalytics = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        // No academicYearId passed — the backend defaults to whichever
        // session is currently marked active for this school.
        const res = await fetch(`${API_BASE}/api/principal/students/analytics`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${token}`
          }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load student analytics');
        }
        setAnalytics(data);
      } catch (err) {
        console.error('Student analytics error:', err);
        setError(err.message || 'Unable to load student analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchStudentAnalytics();
  }, []);

  const summary = analytics?.summary || {};
  const performanceDistribution = Array.isArray(analytics?.gradeDistribution) ? analytics.gradeDistribution : [];
  const topStudents = useMemo(
    () => (Array.isArray(analytics?.topStudents) ? analytics.topStudents.slice(0, 5) : []),
    [analytics]
  );
  const weakStudents = summary?.weakStudents || 0;
  const gradedStudents = summary?.gradedStudents || 0;
  const highPerformers = summary?.highPerformers || 0;
  const attendanceRate = Number(summary?.attendanceRate || 0);
  const highPerformerRate = gradedStudents
    ? Number(((highPerformers / gradedStudents) * 100).toFixed(1))
    : 0;
  const weakStudentRate = gradedStudents
    ? Number(((weakStudents / gradedStudents) * 100).toFixed(1))
    : 0;
  const attendanceLeaderAvg = topStudents.length
    ? Number(
        (
          topStudents.reduce((acc, curr) => acc + Number(curr.attendanceRate || 0), 0) /
          topStudents.length
        ).toFixed(1)
      )
    : 0;
  const leaderboardCutoff = topStudents.length
    ? Number(topStudents[topStudents.length - 1].attendanceRate || 0).toFixed(1)
    : null;
  const totalGradeEntries = performanceDistribution.reduce(
    (sum, item) => sum + Number(item.students || 0),
    0
  );
  const normalizedGrades = performanceDistribution.map((item, idx) => ({
    ...item,
    percent: totalGradeEntries
      ? Number(((Number(item.students || 0) / totalGradeEntries) * 100).toFixed(1))
      : 0,
    colorClass: ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-orange-500', 'bg-rose-500'][
      idx % 5
    ],
  }));
  const highlightStats = [
    {
      key: 'students',
      label: 'Enrolled Students',
      value: summary.totalStudents || 0,
      helper: `${gradedStudents} graded this term`,
      icon: GraduationCap,
      accent: 'bg-indigo-50 text-indigo-600',
    },
    {
      key: 'attendance',
      label: 'Attendance Rate',
      value: `${attendanceRate.toFixed(1)}%`,
      helper: 'Academic session',
      icon: Users,
      accent: 'bg-emerald-50 text-emerald-600',
    },
    {
      key: 'high-performers',
      label: 'High Performers',
      value: highPerformers,
      helper: `${highPerformerRate}% of graded`,
      icon: Award,
      accent: 'bg-amber-50 text-amber-600',
    },
    {
      key: 'needs-support',
      label: 'Needs Support',
      value: weakStudents,
      helper: `${weakStudentRate}% of graded`,
      icon: AlertTriangle,
      accent: 'bg-rose-50 text-rose-600',
    },
  ];
  const insightCards = [
    {
      label: 'Avg attendance (top 5)',
      value: `${attendanceLeaderAvg ? attendanceLeaderAvg.toFixed(1) : '0.0'}%`,
      detail: 'Across leading students',
      icon: BarChart3,
      accent: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: 'Leaderboard cut-off',
      value: leaderboardCutoff ? `${leaderboardCutoff}%` : '—',
      detail: '10th ranked student',
      icon: Trophy,
      accent: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Grade coverage',
      value: gradedStudents || 0,
      detail: 'Students with recorded grades',
      icon: UsersRound,
      accent: 'bg-purple-50 text-purple-600',
    },
  ];
  const getInitials = (name = '') => {
    if (!name?.trim()) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'S';
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const performanceChartData = {
    labels: performanceDistribution.map((d) => d.grade),
    datasets: [
      {
        label: 'Students',
        data: performanceDistribution.map((d) => d.students),
        backgroundColor: [
          'rgba(99, 102, 241, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(107, 114, 128, 0.8)'
        ],
        borderWidth: 0,
      }
    ]
  };

  const topStudentsChartData = {
    labels: topStudents.map((d) => d.name),
    datasets: [
      {
        label: 'Attendance (%)',
        data: topStudents.map((d) => Number(d.attendanceRate || 0)),
        backgroundColor: 'rgba(99, 102, 241, 0.75)',
        borderRadius: 8,
      }
    ]
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-linear-to-br from-indigo-50 via-violet-50 to-indigo-100 p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/40" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Principal Insight</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Student Analytics</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Monitor enrollment, academic performance, and attendance patterns powered by real-time records.
            </p>
          </div>
          <div className="flex min-w-55 items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50">
              <UsersRound className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Currently Enrolled</p>
              <p className="text-3xl font-bold text-slate-900">{(summary.totalStudents || 0).toLocaleString()}</p>
              <p className="mt-0.5 text-xs text-slate-400">{gradedStudents} students with grade submissions</p>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <Loader className="mr-2 h-6 w-6 animate-spin text-indigo-500" />
          <span className="text-slate-600">Loading student analytics...</span>
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
          {/* Highlight stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {highlightStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.key}
                  className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${stat.accent}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    <p className="mt-1 text-xs text-slate-400">{stat.helper}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grade Distribution + Live Insights */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Performance Overview</p>
                  <h3 className="text-lg font-bold text-slate-900">Grade Distribution</h3>
                </div>
                {totalGradeEntries > 0 && (
                  <span className="text-sm text-slate-500">{totalGradeEntries.toLocaleString()} graded submissions</span>
                )}
              </div>
              {performanceDistribution.length ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="flex h-64 items-center justify-center">
                    <Pie data={performanceChartData} />
                  </div>
                  <div className="space-y-4">
                    {normalizedGrades.map((item) => (
                      <div key={item.grade}>
                        <div className="mb-1 flex items-center justify-between text-sm font-medium text-slate-700">
                          <span>{item.grade}</span>
                          <span>{item.students} students</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className={`${item.colorClass} h-2 rounded-full`} style={{ width: `${item.percent}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{item.percent}% of graded students</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                    <BarChart3 className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No grade data available.</p>
                  <p className="mt-0.5 text-xs text-slate-400">No grade distribution available.</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-400">Live Insights</p>
              <div className="space-y-3">
                {insightCards.map((insight) => {
                  const Icon = insight.icon;
                  return (
                    <div
                      key={insight.label}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${insight.accent}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{insight.label}</p>
                          <p className="text-xs text-slate-400">{insight.detail}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-lg font-bold text-slate-900">{insight.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top Students + Student Spotlight */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Attendance</p>
                  <h3 className="text-base font-bold text-slate-900">Top students (30 days)</h3>
                </div>
                {topStudents.length > 0 && (
                  <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    Avg {attendanceLeaderAvg.toFixed(1)}% attendance
                  </span>
                )}
              </div>
              <div className="flex min-h-60 items-center justify-center">
                {topStudents.length ? (
                  <Bar
                    data={topStudentsChartData}
                    options={{
                      responsive: true,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: {
                          min: 0,
                          max: 100,
                          title: { display: true, text: 'Attendance (%)' },
                          ticks: { stepSize: 25 },
                          grid: { color: 'rgba(0,0,0,0.05)' },
                        },
                        x: { grid: { display: false } },
                      },
                    }}
                  />
                ) : (
                  <p className="text-sm font-medium text-slate-500">No attendance leaderboard available.</p>
                )}
              </div>
              {topStudents.length > 0 && (
                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Class</th>
                        <th className="py-2 pr-4">Grade</th>
                        <th className="py-2 pr-2 text-right">Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topStudents.map((student, idx) => (
                        <tr key={student.id || `${student.name}-${idx}`} className="border-t border-slate-100">
                          <td className="py-3 pr-4 font-medium text-slate-900">{student.name}</td>
                          <td className="py-3 pr-4 text-slate-600">{student.grade}</td>
                          <td className="py-3 pr-4 text-slate-600">{student.overallGrade || '-'}</td>
                          <td className="py-3 pr-2 text-right font-semibold text-slate-900">
                            {Number(student.attendanceRate || 0).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-400">Student Spotlight</p>
              {topStudents.length ? (
                <div className="space-y-3">
                  {topStudents.map((student, idx) => (
                    <div
                      key={student.id || `${student.name}-${idx}`}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-bold ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                          {getInitials(student.name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                          <p className="text-xs text-slate-400">
                            {student.grade} • Overall {student.overallGrade || '-'}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-bold text-slate-900">
                          {Number(student.attendanceRate || 0).toFixed(1)}%
                        </p>
                        <p className="text-xs text-slate-400">Attendance</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-medium text-slate-500">No student spotlight available.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StudentAnalytics;
