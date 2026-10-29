import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Clock, FileText, Award } from 'lucide-react';
import { useStudentDashboard } from './StudentDashboardContext';
import { fetchCachedJson } from '../utils/studentApiCache';

// White cards; the colour lives only in the round icon badge.
const CARD_THEMES = [
  { iconBg: 'bg-linear-to-br from-sky-500 to-blue-600 shadow-blue-500/30', badge: 'bg-blue-500 text-white', circle: 'bg-blue-100/70' },
  { iconBg: 'bg-linear-to-br from-amber-400 to-orange-500 shadow-orange-500/30', badge: 'bg-orange-500 text-white', circle: 'bg-orange-100/70' },
  { iconBg: 'bg-linear-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30', badge: 'bg-emerald-500 text-white', circle: 'bg-emerald-100/70' },
  { iconBg: 'bg-linear-to-br from-violet-500 to-fuchsia-600 shadow-violet-500/30', badge: 'bg-violet-500 text-white', circle: 'bg-violet-100/70' },
];

const StatCard = ({ stat, theme, loading }) => {
  const Icon = stat.icon;
  return (
    <Link
      to={stat.to}
      aria-label={`Open ${stat.title}`}
      className={`relative block h-full overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm transition-transform hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500`}
    >
      {/* Light decorative circle bleeding in from the top-right corner */}
      <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full ${theme.circle}`} aria-hidden="true" />

      <div className="relative z-10">
        {/* Icon + badge */}
        <div className="flex items-start justify-between mb-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full shadow-md ${theme.iconBg}`}>
            <Icon size={20} className="text-white" />
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${theme.badge} max-w-22.5 truncate`}>
            {loading ? '…' : stat.change}
          </span>
        </div>

        {/* Value */}
        <p className={`text-2xl font-bold leading-none text-[#0f172a]`}>
          {loading ? <span className="inline-block h-7 w-14 rounded-lg bg-gray-100 animate-pulse" /> : stat.value}
        </p>
        <p className={`mt-1 text-xs font-semibold text-[#64748b]`}>{stat.title}</p>
        {stat.subtitle && <p className="mt-0.5 text-[10px] font-medium text-[#94a3b8]">{stat.subtitle}</p>}
      </div>
    </Link>
  );
};

/** `square` lays the four cards out 2×2 and stretches them to the parent's height. */
const QuickStats = ({ square = false }) => {
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
        to: '/student/attendance',
        value: loading ? '…' : `${attPct}%`,
        change: loading ? 'Loading…' : `${presentDays}/${totalClasses} days`,
        icon: Clock,
      },
      {
        title: 'Assignments',
        to: '/student/assignments',
        value: assignmentSummary.loading ? '…' : String(assignmentSummary.total),
        change: assignmentSummary.loading
          ? 'Loading…'
          : assignmentSummary.total > 0 ? `${assignmentSummary.evaluated} Evaluated` : 'No assignments',
        // Anything not "not_submitted" counts as handed in (submitted, late, graded).
        subtitle: !assignmentSummary.loading && assignmentSummary.total > 0
          ? `${assignmentSummary.total - assignmentSummary.pending} of ${assignmentSummary.total} submitted`
          : '',
        icon: FileText,
      },
      {
        title: 'Achievements',
        to: '/student/achievements',
        value: loading ? '…' : String(dashboardStats?.achievements ?? 0),
        change: 'Keep learning!',
        icon: Trophy,
      },
      {
        title: 'Latest Exam Score',
        to: '/student/results',
        value: examSummary.loading ? '…' : examPct === null ? '—' : `${examPct}%`,
        change: examSummary.loading
          ? 'Loading…'
          : examPct === null ? 'No exams yet' : (examSummary.examName || 'Latest exam'),
        icon: Award,
      },
    ];
  }, [dashboardStats, loading, assignmentSummary, examSummary]);

  return (
    <div className={square ? 'grid h-full grid-cols-2 grid-rows-2 gap-3' : 'grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'}>
      {stats.map((stat, i) => (
        <StatCard key={i} stat={stat} theme={CARD_THEMES[i]} loading={loading} />
      ))}
    </div>
  );
};

export default QuickStats;
