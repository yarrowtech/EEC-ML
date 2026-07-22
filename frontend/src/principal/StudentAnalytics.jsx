import React, { useEffect, useMemo, useState } from 'react';
import {
  GraduationCap,
  Users,
  Award,
  Loader,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight
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
  const attendanceLeaders = topStudents.slice(0, 5);
  const highlightStats = [
    {
      key: 'students',
      label: 'Enrolled Students',
      value: summary.totalStudents || 0,
      helper: `${gradedStudents} graded this term`,
      icon: GraduationCap,
      accent: 'bg-blue-50 text-blue-600 border-blue-100',
    },
    {
      key: 'attendance',
      label: 'Attendance (30d)',
      value: `${attendanceRate.toFixed(1)}%`,
      helper: 'Rolling average',
      icon: Users,
      accent: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      key: 'high-performers',
      label: 'High Performers',
      value: highPerformers,
      helper: `${highPerformerRate}% of graded`,
      icon: Award,
      accent: 'bg-amber-50 text-amber-600 border-amber-100',
    },
    {
      key: 'needs-support',
      label: 'Needs Support',
      value: weakStudents,
      helper: `${weakStudentRate}% of graded`,
      icon: AlertTriangle,
      accent: 'bg-rose-50 text-rose-600 border-rose-100',
    },
  ];
  const insightCards = [
    {
      label: 'Avg attendance (top 5)',
      value: `${attendanceLeaderAvg ? attendanceLeaderAvg.toFixed(1) : '0.0'}%`,
      detail: 'Across leading students',
    },
    {
      label: 'Leaderboard cut-off',
      value: leaderboardCutoff ? `${leaderboardCutoff}%` : '—',
      detail: '10th ranked student',
    },
    {
      label: 'Grade coverage',
      value: gradedStudents || 0,
      detail: 'Students with recorded grades',
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
          'rgba(59, 130, 246, 0.7)',
          'rgba(34, 197, 94, 0.7)',
          'rgba(251, 191, 36, 0.7)',
          'rgba(239, 68, 68, 0.7)',
          'rgba(107, 114, 128, 0.7)'
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(34, 197, 94, 1)',
          'rgba(251, 191, 36, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(107, 114, 128, 1)'
        ],
        borderWidth: 2,
      }
    ]
  };

  const topStudentsChartData = {
    labels: topStudents.map((d) => d.name),
    datasets: [
      {
        label: 'Attendance (%)',
        data: topStudents.map((d) => Number(d.attendanceRate || 0)),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderRadius: 8,
      }
    ]
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-950 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/80 mb-2">Principal insight</p>
            <h1 className="text-3xl font-bold leading-snug">Student Analytics</h1>
            <p className="text-white/80 mt-2">
              Monitor enrollment, academic performance, and attendance patterns powered by real-time records.
            </p>
          </div>
          <div className="bg-white/10 rounded-2xl p-4 min-w-[220px] backdrop-blur">
            <p className="text-sm text-white/70">Currently Enrolled</p>
            <p className="text-3xl font-bold">{(summary.totalStudents || 0).toLocaleString()}</p>
            <p className="text-xs text-white/70 mt-1">{gradedStudents} students with grade submissions</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-center">
          <Loader className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">Loading student analytics...</span>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {highlightStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.key}
                  className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-start gap-4"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.accent}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wide text-gray-500">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{stat.helper}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 xl:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Performance overview</p>
                  <h3 className="text-xl font-semibold text-gray-900">Grade distribution</h3>
                </div>
                {totalGradeEntries > 0 && (
                  <div className="text-sm text-gray-500">
                    {totalGradeEntries.toLocaleString()} graded submissions
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex items-center justify-center h-72">
                  {performanceDistribution.length ? (
                    <Pie data={performanceChartData} />
                  ) : (
                    <div className="text-center text-sm text-gray-500">
                      No grade distribution available.
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {normalizedGrades.length ? (
                    normalizedGrades.map((item) => (
                      <div key={item.grade}>
                        <div className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1">
                          <span>{item.grade}</span>
                          <span>{item.students} students</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`${item.colorClass} h-2 rounded-full`}
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{item.percent}% of graded students</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No grade data available.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 h-full">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">Live Insights</p>
                <div className="space-y-4">
                  {insightCards.map((insight) => (
                    <div
                      key={insight.label}
                      className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{insight.label}</p>
                        <p className="text-xs text-gray-500">{insight.detail}</p>
                      </div>
                      <div className="text-lg font-semibold text-gray-900">{insight.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">
                  Leaderboard snapshot
                </p>
                {topStudents.length ? (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center">
                      {getInitials(topStudents[0].name)}
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-semibold text-gray-900">{topStudents[0].name}</p>
                      <p className="text-sm text-gray-500">
                        {topStudents[0].grade} • Overall {topStudents[0].overallGrade || '-'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        {Number(topStudents[0].attendanceRate || 0).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                        <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                        Top attendance
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No attendance data available.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Attendance</p>
                  <h3 className="text-lg font-semibold text-gray-900">Top students (30 days)</h3>
                </div>
                {topStudents.length > 0 && (
                  <span className="text-sm text-gray-500">
                    Avg {attendanceLeaderAvg.toFixed(1)}% attendance
                  </span>
                )}
              </div>
              <div className="min-h-[260px] flex items-center justify-center">
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
                          ticks: { stepSize: 20 },
                        },
                      },
                    }}
                  />
                ) : (
                  <p className="text-sm text-gray-500">No attendance leaderboard available.</p>
                )}
              </div>
              {topStudents.length > 0 && (
                <div className="overflow-x-auto mt-6">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="py-2 pr-4 font-medium">Name</th>
                        <th className="py-2 pr-4 font-medium">Class</th>
                        <th className="py-2 pr-4 font-medium">Grade</th>
                        <th className="py-2 pr-2 font-medium text-right">Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topStudents.map((student, idx) => (
                        <tr
                          key={student.id || `${student.name}-${idx}`}
                          className="border-t border-gray-100"
                        >
                          <td className="py-3 pr-4 text-gray-900 font-medium">{student.name}</td>
                          <td className="py-3 pr-4 text-gray-600">{student.grade}</td>
                          <td className="py-3 pr-4 text-gray-600">{student.overallGrade || '-'}</td>
                          <td className="py-3 pr-2 text-gray-900 font-semibold text-right">
                            {Number(student.attendanceRate || 0).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-4">Student spotlight</p>
              {attendanceLeaders.length ? (
                <div className="space-y-4">
                  {attendanceLeaders.map((student, idx) => (
                    <div
                      key={student.id || `${student.name}-${idx}`}
                      className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white shadow flex items-center justify-center font-semibold text-gray-700">
                          {getInitials(student.name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{student.name}</p>
                          <p className="text-xs text-gray-500">
                            {student.grade} • Overall {student.overallGrade || '-'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          {Number(student.attendanceRate || 0).toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">Attendance</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No student spotlight available.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StudentAnalytics;
