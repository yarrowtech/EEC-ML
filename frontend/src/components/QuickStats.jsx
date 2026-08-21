import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, Clock, FileText, Award } from 'lucide-react';
import { useStudentDashboard } from './StudentDashboardContext';
import { fetchCachedJson } from '../utils/studentApiCache';

/* Thin linear progress bar */
const Bar = ({ pct, colorClass = 'bg-slate-300' }) => (
  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
    <div
      className={`h-full rounded-full ${colorClass} transition-all duration-700`}
      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
    />
  </div>
);

const CARD_THEMES = [
  {
    bg: 'from-sky-100 to-blue-100', shadow: 'shadow-blue-100/60', iconBg: 'bg-white/70',
    iconColor: 'text-blue-600', valueColor: 'text-blue-950', labelColor: 'text-blue-800/70', badge: 'bg-white/70 text-blue-700', bar: 'bg-blue-300',
  },
  {
    bg: 'from-amber-100 to-yellow-100', shadow: 'shadow-amber-100/60', iconBg: 'bg-white/70',
    iconColor: 'text-amber-700', valueColor: 'text-amber-950', labelColor: 'text-amber-800/70', badge: 'bg-white/70 text-amber-700', bar: 'bg-amber-300',
  },
  {
    bg: 'from-emerald-100 to-teal-100', shadow: 'shadow-emerald-100/60', iconBg: 'bg-white/70',
    iconColor: 'text-emerald-700', valueColor: 'text-emerald-950', labelColor: 'text-emerald-800/70', badge: 'bg-white/70 text-emerald-700', bar: 'bg-emerald-300',
  },
  {
    bg: 'from-violet-100 to-purple-100', shadow: 'shadow-violet-100/60', iconBg: 'bg-white/70',
    iconColor: 'text-violet-700', valueColor: 'text-violet-950', labelColor: 'text-violet-800/70', badge: 'bg-white/70 text-violet-700', bar: 'bg-violet-300',
  },
];

const StatCard = ({ stat, theme, loading }) => {
  const Icon = stat.icon;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-linear-to-br ${theme.bg} p-4 sm:p-5 shadow-lg ${theme.shadow} transition-transform hover:-translate-y-0.5`}
    >
      {/* Decorative circle */}
      <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/40" />

      <div className="relative z-10">
        {/* Icon + badge */}
        <div className="flex items-start justify-between mb-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${theme.iconBg} backdrop-blur-sm`}>
            <Icon size={20} className={theme.iconColor} />
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${theme.badge} max-w-22.5 truncate`}>
            {loading ? '…' : stat.change}
          </span>
        </div>

        {/* Value */}
        <p className={`text-2xl font-black leading-none ${theme.valueColor}`}>
          {loading ? <span className="inline-block h-7 w-14 rounded-lg bg-white/50 animate-pulse" /> : stat.value}
        </p>
        <p className={`mt-1 text-xs font-semibold ${theme.labelColor}`}>{stat.title}</p>

        {/* Progress bar for attendance / progress */}
        {!loading && stat.progress !== undefined && <Bar pct={stat.progress} colorClass={theme.bar} />}
      </div>
    </div>
  );
};

const QuickStats = () => {
  const { stats: dashboardStats, loading } = useStudentDashboard();
  const [assignmentSummary, setAssignmentSummary] = useState({ total: 0, pending: 0, evaluated: 0, loading: false });
  const [examSummary, setExamSummary] = useState({ percentage: null, examName: '', loading: false });

  // Fire immediately on mount (in parallel with the dashboard's own fetch) instead of
  // waiting on `loading` — that previously made these two cards wait for the dashboard
  // fetch to finish before even starting their own network calls.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setAssignmentSummary({ total: 0, pending: 0, evaluated: 0, loading: false }); return; }

    const fetchAssignments = async () => {
      try {
        setAssignmentSummary(prev => ({ ...prev, loading: true }));
        const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
        const { data } = await fetchCachedJson(`${API_BASE}/api/assignment/student/assignments`, {
          ttlMs: 5 * 60 * 1000,
          fetchOptions: { headers: { Authorization: `Bearer ${token}` } },
        });
        const list = Array.isArray(data) ? data : Array.isArray(data?.assignments) ? data.assignments : [];
        setAssignmentSummary({
          total: list.length,
          pending: list.filter(a => a?.submissionStatus === 'not_submitted' || !a?.submissionStatus).length,
          evaluated: list.filter(a => a?.submissionStatus === 'graded').length,
          loading: false,
        });
      } catch {
        setAssignmentSummary({ total: 0, pending: 0, evaluated: 0, loading: false });
      }
    };
    fetchAssignments();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setExamSummary({ percentage: null, examName: '', loading: false }); return; }

    const fetchLatestExam = async () => {
      try {
        setExamSummary(prev => ({ ...prev, loading: true }));
        const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
        const { data } = await fetchCachedJson(`${API_BASE}/api/reports/report-cards/me`, {
          ttlMs: 5 * 60 * 1000,
          fetchOptions: { headers: { Authorization: `Bearer ${token}` } },
        });
        const totals = data?.reportCard?.totals || {};
        const percentage = Number(totals.percentage);
        setExamSummary({
          percentage: Number.isFinite(percentage) ? percentage : null,
          examName: data?.selectedExamGroupTitle || data?.reportCard?.term || '',
          loading: false,
        });
      } catch {
        setExamSummary({ percentage: null, examName: '', loading: false });
      }
    };
    fetchLatestExam();
  }, []);

  const stats = useMemo(() => {
    const attPct = dashboardStats?.attendancePercentage ?? 0;
    const presentDays = dashboardStats?.presentDays ?? 0;
    const totalClasses = dashboardStats?.totalClasses ?? 0;
    const examPct = examSummary.percentage;

    return [
      {
        title: 'Attendance',
        value: loading ? '…' : `${attPct}%`,
        change: loading ? 'Loading…' : `${presentDays}/${totalClasses} days`,
        icon: Clock,
        progress: attPct,
      },
      {
        title: 'Assignments',
        value: assignmentSummary.loading ? '…' : String(assignmentSummary.total),
        change: assignmentSummary.loading
          ? 'Loading…'
          : assignmentSummary.total > 0 ? `${assignmentSummary.evaluated} Evaluated` : 'No assignments',
        icon: FileText,
      },
      {
        title: 'Achievements',
        value: loading ? '…' : String(dashboardStats?.achievements ?? 0),
        change: 'Keep learning!',
        icon: Trophy,
      },
      {
        title: 'Latest Exam Score',
        value: examSummary.loading ? '…' : examPct === null ? '—' : `${examPct}%`,
        change: examSummary.loading
          ? 'Loading…'
          : examPct === null ? 'No exams yet' : (examSummary.examName || 'Latest exam'),
        icon: Award,
        progress: examPct === null ? undefined : examPct,
      },
    ];
  }, [dashboardStats, loading, assignmentSummary, examSummary]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat, i) => (
        <StatCard key={i} stat={stat} theme={CARD_THEMES[i]} loading={loading} />
      ))}
    </div>
  );
};

export default QuickStats;
