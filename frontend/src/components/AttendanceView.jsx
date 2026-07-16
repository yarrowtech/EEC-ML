import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar, CheckCircle2, XCircle, TrendingUp, Loader2, Clock,
  ChevronLeft, ChevronRight, Target, BarChart3, Eye, BookOpen,
  Flame, CalendarDays, LayoutGrid, List, ChevronDown, ChevronUp, RefreshCcw,
  X, FileText, Download, File, Image as ImageIcon, Paperclip,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { clearCacheEntry, readCacheEntry, writeCacheEntry } from '../utils/studentCache';
import { fetchCachedJson } from '../utils/studentApiCache';

const STATUS_COLORS = {
  present: 'bg-emerald-500',
  absent: 'bg-rose-500',
};

const normalizeStatus = (value) => {
  const text = String(value || '').toLowerCase();
  return text === 'absent' ? 'absent' : 'present';
};

const normalizeDisplaySubject = (value) => {
  const text = String(value || '').trim();
  if (!text) return 'General';
  if (text.toLowerCase().startsWith('general::')) return 'General';
  return text;
};

const normalizeSubjectKey = (value) => String(value || '').trim().toLowerCase();
const subjectTokens = (value) =>
  normalizeSubjectKey(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length > 2);

const subjectsLikelyMatch = (a, b) => {
  const aKey = normalizeSubjectKey(a);
  const bKey = normalizeSubjectKey(b);
  if (!aKey || !bKey) return false;
  if (aKey === bKey) return true;
  if (aKey.includes(bKey) || bKey.includes(aKey)) return true;
  const aTokens = new Set(subjectTokens(aKey));
  const bTokens = subjectTokens(bKey);
  if (!aTokens.size || !bTokens.length) return false;
  let overlap = 0;
  bTokens.forEach((token) => {
    if (aTokens.has(token)) overlap += 1;
  });
  return overlap >= Math.min(2, bTokens.length);
};

/** Returns YYYY-MM-DD in local timezone (avoids UTC offset bugs with toISOString) */
const toLocalDateKey = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ─── Circular Progress Ring ─── */
const CircularProgress = ({ percentage, size = 140, strokeWidth = 10 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 75 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="#e2e8f0" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-slate-900">{percentage}%</span>
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Overall</span>
      </div>
    </div>
  );
};

/* ─── Mini Progress Bar ─── */
const ProgressBar = ({ value, max, className = '' }) => {
  const pct = max ? Math.round((value / max) * 100) : 0;
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className={`h-2 w-full rounded-full bg-slate-100 ${className}`}>
      <div className={`h-2 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }} />
    </div>
  );
};

/* ─── Stat Card ─── */
const StatCard = ({ icon: Icon, label, value, sub, grad, shadow }) => (
  <div className={`relative overflow-hidden rounded-2xl bg-linear-to-br ${grad} p-4 shadow-lg ${shadow} transition-transform hover:-translate-y-0.5`}>
    <div className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
    <div className="relative z-10 flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-white/80">{label}</p>
        <p className="text-xl font-black leading-tight text-white">{value}</p>
        {sub && <p className="text-[10px] text-white/70">{sub}</p>}
      </div>
    </div>
  </div>
);

/* ─── Tab Button ─── */
const TabBtn = ({ active, icon: Icon, label, onClick }) => (
  <button type="button" onClick={onClick}
    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition
      ${active ? 'bg-linear-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-slate-100'}`}>
    <Icon className="h-4 w-4" />
    <span className="hidden sm:inline">{label}</span>
  </button>
);

const ATTENDANCE_CACHE_KEY = 'studentAttendanceCacheV1';
const ATTENDANCE_CACHE_TTL_MS = 5 * 60 * 1000;
const ATTENDANCE_API_CACHE_TTL_MS = 5 * 60 * 1000;
const MATERIALS_API_CACHE_TTL_MS = 2 * 60 * 1000;
const LESSON_PLAN_API_CACHE_TTL_MS = 2 * 60 * 1000;
const EMPTY_STATS = { totalClasses: 0, attended: 0, absent: 0, percentage: 0 };

const AttendanceView = () => {
  const location = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [dailyFilter, setDailyFilter] = useState('all');
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState(EMPTY_STATS);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [lastSynced, setLastSynced] = useState(null);
  const [silentRefreshing, setSilentRefreshing] = useState(false);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [materialsDate, setMaterialsDate] = useState('');
  const [materials, setMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [lessonPlanStatuses, setLessonPlanStatuses] = useState([]);
  const [loadingLessonPlans, setLoadingLessonPlans] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const filter = params.get('filter');
    if (filter && ['all', 'present', 'absent'].includes(filter)) {
      setDailyFilter(filter);
      setActiveTab('daily');
    }
  }, [location.search]);

  const fetchAttendance = useCallback(async ({ silent = false, forceRefresh = false } = {}) => {
    try {
      if (silent) setSilentRefreshing(true);
      else setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');
      if (!token || userType !== 'Student') {
        clearCacheEntry(ATTENDANCE_CACHE_KEY);
        throw new Error('Student session not found. Please login again.');
      }
      const { data } = await fetchCachedJson(
        `${import.meta.env.VITE_API_URL}/api/student/auth/attendance`,
        {
          ttlMs: ATTENDANCE_API_CACHE_TTL_MS,
          forceRefresh,
          fetchOptions: {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          },
        }
      );

      const summary = data?.summary || {};
      const normalizedRecords = Array.isArray(data?.attendance)
        ? data.attendance.map((record) => ({
            id: record._id || `${record.date}-${record.subject}`,
            date: toLocalDateKey(record.date),
            subject: normalizeDisplaySubject(record.subject),
            status: normalizeStatus(record.status),
          }))
        : [];

      const nextStats = {
        totalClasses: summary.totalClasses || normalizedRecords.length || 0,
        attended: summary.presentDays || normalizedRecords.filter((r) => r.status === 'present').length || 0,
        absent: summary.absentDays || normalizedRecords.filter((r) => r.status === 'absent').length || 0,
        percentage: summary.attendancePercentage || 0,
      };

      setAttendanceStats(nextStats);
      setAttendanceRecords(normalizedRecords);
      const now = new Date();
      setLastSynced(now);
      writeCacheEntry(
        ATTENDANCE_CACHE_KEY,
        { stats: nextStats, records: normalizedRecords },
        ATTENDANCE_CACHE_TTL_MS,
      );
    } catch (err) {
      setError(err.message || 'Unable to fetch attendance');
    } finally {
      if (silent) setSilentRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cachedEntry = readCacheEntry(ATTENDANCE_CACHE_KEY);
    if (cachedEntry?.data) {
      const cachedStats = { ...EMPTY_STATS, ...(cachedEntry.data.stats || {}) };
      const cachedRecords = Array.isArray(cachedEntry.data.records) ? cachedEntry.data.records : [];
      setAttendanceStats(cachedStats);
      setAttendanceRecords(cachedRecords);
      setLastSynced(new Date(cachedEntry.timestamp));
      setLoading(false);
    }
    fetchAttendance({ silent: Boolean(cachedEntry), forceRefresh: false });
  }, [fetchAttendance]);

  /* ─── Derived data ─── */
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const daysOfWeek = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const recordsByDate = useMemo(() => {
    const map = {};
    attendanceRecords.forEach((r) => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });
    return map;
  }, [attendanceRecords]);

  /* ─── Streak calculation ─── */
  const currentStreak = useMemo(() => {
    const uniqueDates = [...new Set(attendanceRecords.map((r) => r.date))].sort().reverse();
    let streak = 0;
    for (const d of uniqueDates) {
      const dayRecords = recordsByDate[d] || [];
      const allPresent = dayRecords.every((r) => r.status === 'present');
      if (allPresent) streak += 1;
      else break;
    }
    return streak;
  }, [attendanceRecords, recordsByDate]);

  /* ─── Subject-wise stats ─── */
  const subjectStats = useMemo(() => {
    const map = {};
    attendanceRecords.forEach((r) => {
      if (!map[r.subject]) map[r.subject] = { total: 0, present: 0 };
      map[r.subject].total += 1;
      if (r.status === 'present') map[r.subject].present += 1;
    });
    return Object.entries(map)
      .map(([subject, s]) => ({ subject, ...s, pct: s.total ? Math.round((s.present / s.total) * 100) : 0 }))
      .sort((a, b) => a.pct - b.pct);
  }, [attendanceRecords]);

  /* ─── Calendar helpers ─── */
  const navigateMonth = (dir) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + dir);
    setCurrentDate(next);
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const start = new Date(firstDay);
    start.setDate(start.getDate() - firstDay.getDay());
    const days = [];
    const cursor = new Date(start);
    for (let i = 0; i < 42; i += 1) {
      const key = toLocalDateKey(cursor);
      const dayRecords = recordsByDate[key] || [];
      const hasAbsent = dayRecords.some((e) => e.status === 'absent');
      const hasPresent = dayRecords.some((e) => e.status === 'present');
      days.push({
        key, date: new Date(cursor),
        isCurrentMonth: cursor.getMonth() === month,
        isToday: key === toLocalDateKey(new Date()),
        status: hasAbsent ? 'absent' : hasPresent ? 'present' : null,
        count: dayRecords.length,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [currentDate, recordsByDate]);

  /* ─── Monthly stats ─── */
  const monthlyRecords = useMemo(() => {
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    return attendanceRecords.filter((item) => item.date.startsWith(monthKey));
  }, [attendanceRecords, currentDate]);

  const monthlyPresent = monthlyRecords.filter((r) => r.status === 'present').length;
  const monthlyAbsent = monthlyRecords.filter((r) => r.status === 'absent').length;
  const monthlyPct = monthlyRecords.length ? Math.round((monthlyPresent / monthlyRecords.length) * 100) : 0;

  /* ─── Daily records (sorted newest first) ─── */
  const sortedDailyDates = useMemo(() => {
    return [...new Set(attendanceRecords.map((r) => r.date))].sort().reverse();
  }, [attendanceRecords]);

  const filteredDailyDates = useMemo(() => {
    if (dailyFilter === 'all') return sortedDailyDates;
    return sortedDailyDates.filter((d) => {
      const records = recordsByDate[d] || [];
      if (dailyFilter === 'present') return records.every((r) => r.status === 'present');
      return records.some((r) => r.status === 'absent');
    });
  }, [sortedDailyDates, dailyFilter, recordsByDate]);

  /* ─── Weekly grouping ─── */
  const weeklyData = useMemo(() => {
    const weeks = {};
    attendanceRecords.forEach((r) => {
      const d = new Date(r.date);
      const dayOfWeek = d.getDay();
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - dayOfWeek);
      const weekKey = toLocalDateKey(weekStart);
      if (!weeks[weekKey]) weeks[weekKey] = { start: weekStart, records: [], present: 0, absent: 0 };
      weeks[weekKey].records.push(r);
      if (r.status === 'present') weeks[weekKey].present += 1;
      else weeks[weekKey].absent += 1;
    });
    return Object.entries(weeks)
      .map(([key, w]) => ({
        key,
        start: w.start,
        end: new Date(new Date(w.start).setDate(w.start.getDate() + 6)),
        total: w.records.length,
        present: w.present,
        absent: w.absent,
        pct: w.records.length ? Math.round((w.present / w.records.length) * 100) : 0,
        records: w.records,
      }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [attendanceRecords]);

  const selectedDateRecords = selectedDate ? recordsByDate[selectedDate] || [] : [];
  const clickedDateAttendanceRecords = materialsDate ? recordsByDate[materialsDate] || [] : [];
  const clickedAttendanceBySubject = useMemo(() => {
    const map = new Map();
    clickedDateAttendanceRecords.forEach((record) => {
      const key = normalizeSubjectKey(record.subject);
      if (!key || map.has(key)) return;
      map.set(key, record);
    });
    return map;
  }, [clickedDateAttendanceRecords]);

  const fmtDate = (dateStr, opts) =>
    new Date(dateStr).toLocaleDateString('en-US', opts || { weekday: 'short', month: 'short', day: 'numeric' });

  const fmtDateLong = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

  const getFileIcon = (type) => {
    if (type?.startsWith('image/')) return ImageIcon;
    if (type === 'application/pdf') return FileText;
    return File;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const fetchMaterialsForDate = async (dateStr) => {
    setLoadingMaterials(true);
    setMaterials([]);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const { data } = await fetchCachedJson(
        `${import.meta.env.VITE_API_URL}/api/notifications/user`,
        {
          ttlMs: MATERIALS_API_CACHE_TTL_MS,
          fetchOptions: {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        }
      );
      const allNotices = Array.isArray(data) ? data : [];

      // Filter notices for the selected date
      const dateMaterials = allNotices.filter((notice) => {
        if (!notice.createdAt && !notice.date) return false;
        const noticeDate = toLocalDateKey(notice.createdAt || notice.date);
        return noticeDate === dateStr && notice.type === 'class_note';
      });

      setMaterials(dateMaterials);
    } catch (err) {
      console.error('Failed to fetch materials:', err);
      setMaterials([]);
    } finally {
      setLoadingMaterials(false);
    }
  };

  const fetchLessonPlanStatusForDate = async (dateStr) => {
    setLoadingLessonPlans(true);
    setLessonPlanStatuses([]);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const { data } = await fetchCachedJson(
        `${import.meta.env.VITE_API_URL}/api/lesson-plans/student/status?fromDate=${dateStr}&toDate=${dateStr}`,
        {
          ttlMs: LESSON_PLAN_API_CACHE_TTL_MS,
          fetchOptions: {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        }
      );
      setLessonPlanStatuses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch lesson plan status:', err);
      setLessonPlanStatuses([]);
    } finally {
      setLoadingLessonPlans(false);
    }
  };

  const handleDateClick = (dateKey) => {
    setSelectedDate(dateKey);
    setMaterialsDate(dateKey);
    setShowMaterialsModal(true);
    fetchMaterialsForDate(dateKey);
    fetchLessonPlanStatusForDate(dateKey);
  };

  /* ─── RENDER ─── */
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="mt-3 text-sm text-slate-500">Loading your attendance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 p-3 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">

        {/* ─── Header ─── */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-indigo-500 via-indigo-600 to-purple-600 p-5 shadow-lg shadow-indigo-200/60 sm:p-6">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-10 left-1/3 h-28 w-28 rounded-full bg-white/10" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <CalendarDays className="h-5.5 w-5.5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white sm:text-2xl">My Attendance</h1>
                <p className="mt-1 text-sm text-white/80">
                  Track your overall, daily, and weekly attendance in one place.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentStreak > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                  <Flame className="h-3.5 w-3.5" />
                  {currentStreak} day streak
                </div>
              )}
              <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                attendanceStats.percentage >= 75
                  ? 'border-white/25 bg-white/15 text-white'
                  : 'border-amber-300 bg-amber-400 text-amber-950'
              }`}>
                {attendanceStats.percentage >= 75 ? 'On Track' : 'Needs Attention'}
              </div>
            </div>
          </div>
          <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/70">
            <p>
              {lastSynced
                ? `Last updated ${lastSynced.toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`
                : 'Waiting for the first sync...'}
            </p>
            <button
              type="button"
              onClick={() => fetchAttendance({ silent: true, forceRefresh: true })}
              disabled={silentRefreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${silentRefreshing ? 'animate-spin' : ''}`} />
              {silentRefreshing ? 'Refreshing' : 'Refresh data'}
            </button>
          </div>
          {error && (
            <p className="relative mt-3 rounded-lg border border-white/30 bg-white/15 p-3 text-sm text-white">{error}</p>
          )}
        </div>

        {/* ─── Tab Navigation ─── */}
        <div className="flex items-center gap-1 rounded-xl bg-white border border-slate-200 p-1.5 shadow-sm overflow-x-auto">
          <TabBtn active={activeTab === 'overview'} icon={Eye} label="Overview" onClick={() => setActiveTab('overview')} />
          <TabBtn active={activeTab === 'calendar'} icon={CalendarDays} label="Calendar" onClick={() => setActiveTab('calendar')} />
          <TabBtn active={activeTab === 'daily'} icon={List} label="Daily" onClick={() => setActiveTab('daily')} />
          <TabBtn active={activeTab === 'weekly'} icon={BarChart3} label="Weekly" onClick={() => setActiveTab('weekly')} />
        </div>

        {/* ═══════════ OVERVIEW TAB ═══════════ */}
        {activeTab === 'overview' && (
          <>
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.10),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.10),_transparent_24%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 md:p-6">
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
                  <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 text-center shadow-sm">
                    <CircularProgress percentage={attendanceStats.percentage} />
                    <p className="mt-4 text-sm font-semibold text-slate-700">Overall Attendance</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {attendanceStats.attended} of {attendanceStats.totalClasses} classes attended
                    </p>
                    <div className="mt-4 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                      {attendanceStats.percentage >= 75 ? 'Healthy attendance trend' : 'Needs attention this term'}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <StatCard icon={BookOpen} label="Total Classes" value={attendanceStats.totalClasses} grad="from-indigo-500 to-blue-600" shadow="shadow-indigo-200/60" />
                      <StatCard icon={CheckCircle2} label="Present" value={attendanceStats.attended} grad="from-emerald-500 to-teal-600" shadow="shadow-emerald-200/60" />
                      <StatCard icon={XCircle} label="Absent" value={attendanceStats.absent} grad="from-rose-500 to-red-600" shadow="shadow-rose-200/60" />
                      <StatCard icon={Flame} label="Current Streak" value={`${currentStreak} day${currentStreak !== 1 ? 's' : ''}`} grad="from-orange-400 to-amber-500" shadow="shadow-orange-200/60" />
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <CalendarDays className="h-3.5 w-3.5 text-indigo-600" />
                          This Month
                        </div>
                        <p className="mt-3 text-base font-semibold text-slate-900">
                          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {monthlyRecords.length} classes recorded
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Present Days</p>
                        <p className="mt-3 text-3xl font-bold text-emerald-600">{monthlyPresent}</p>
                        <p className="mt-1 text-xs text-emerald-700/80">Absences this month: {monthlyAbsent}</p>
                      </div>
                      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Monthly Rate</p>
                        <p className="mt-3 text-3xl font-bold text-indigo-600">{monthlyPct}%</p>
                        <p className="mt-1 text-xs text-indigo-700/80">Based on current month records</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {subjectStats.length > 0 && (
                <div className="p-5 md:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-indigo-600" />
                      <h2 className="font-semibold text-slate-900">Subject-wise Attendance</h2>
                    </div>
                    <span className="text-xs font-medium text-slate-400">{subjectStats.length} subjects</span>
                  </div>
                  <div className="space-y-4">
                    {subjectStats.map((s) => (
                      <div key={s.subject} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-800">{s.subject}</span>
                          <span className="text-xs text-slate-500">
                            {s.present}/{s.total} classes ·{' '}
                            <span className={`font-semibold ${
                              s.pct >= 75 ? 'text-emerald-600' : s.pct >= 50 ? 'text-amber-600' : 'text-rose-600'
                            }`}>{s.pct}%</span>
                          </span>
                        </div>
                        <ProgressBar value={s.present} max={s.total} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Target className="h-4 w-4 shrink-0 text-indigo-600" />
                Aim to maintain 75%+ attendance. If any entry looks incorrect, contact your class teacher.
              </p>
            </div>
          </>
        )}

        {/* ═══════════ CALENDAR TAB ═══════════ */}
        {activeTab === 'calendar' && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Month navigator */}
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <button onClick={() => navigateMonth(-1)}
                  className="rounded-lg p-2 hover:bg-slate-100 transition" aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4 text-slate-700" />
                </button>
                <div className="text-center">
                  <h2 className="font-semibold text-slate-900">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {monthlyPresent} present &middot; {monthlyAbsent} absent &middot; {monthlyPct}%
                  </p>
                </div>
                <button onClick={() => navigateMonth(1)}
                  className="rounded-lg p-2 hover:bg-slate-100 transition" aria-label="Next month">
                  <ChevronRight className="h-4 w-4 text-slate-700" />
                </button>
              </div>

              {/* Calendar grid */}
              <div className="p-2 sm:p-4">
                <div className="mb-2 grid grid-cols-7 gap-1 sm:gap-1.5">
                  {daysOfWeek.map((day) => (
                    <div key={day} className="py-1 text-center text-xs font-semibold text-slate-400">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {calendarDays.map((day) => (
                    <button key={day.key} type="button"
                      onClick={() => {
                        if (day.isCurrentMonth) {
                          handleDateClick(day.key);
                        }
                      }}
                      className={`relative flex flex-col items-center justify-center aspect-square rounded-xl border transition
                        ${selectedDate === day.key ? 'border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50' : ''}
                        ${day.isToday && selectedDate !== day.key ? 'border-indigo-300 bg-indigo-50/50' : ''}
                        ${day.isCurrentMonth
                          ? 'text-slate-900 hover:bg-slate-50 cursor-pointer'
                          : 'text-slate-300 border-transparent cursor-default'}
                        ${!day.isToday && selectedDate !== day.key ? 'border-slate-100' : ''}
                      `}>
                      <span className={`text-xs font-medium ${day.isToday ? 'text-indigo-600' : ''}`}>
                        {day.date.getDate()}
                      </span>
                      {day.status && (
                        <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${STATUS_COLORS[day.status]}`} />
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Present
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Absent
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-200 ring-1 ring-indigo-300" /> Today
                  </div>
                </div>
              </div>
            </div>

            {/* Selected date detail */}
            {selectedDateRecords.length > 0 && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-5 shadow-sm animate-in fade-in">
                <h3 className="mb-3 text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  {fmtDateLong(selectedDate)}
                </h3>
                <div className="space-y-2">
                  {selectedDateRecords.map((record) => (
                    <div key={record.id}
                      className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          record.status === 'present' ? 'bg-emerald-100' : 'bg-rose-100'
                        }`}>
                          {record.status === 'present'
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            : <XCircle className="h-4 w-4 text-rose-600" />}
                        </div>
                        <span className="text-sm font-medium text-slate-800">{record.subject}</span>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        record.status === 'present'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}>
                        {record.status === 'present' ? 'Present' : 'Absent'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly stats below calendar */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">{monthlyRecords.length}</p>
                <p className="text-xs text-slate-500">Monthly Classes</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{monthlyPresent}</p>
                <p className="text-xs text-slate-500">Present</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-indigo-600">{monthlyPct}%</p>
                <p className="text-xs text-slate-500">Rate</p>
              </div>
            </div>
          </>
        )}

        {/* ═══════════ DAILY TAB ═══════════ */}
        {activeTab === 'daily' && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Daily header with filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <List className="h-4 w-4 text-indigo-600" />
                Day-by-Day Attendance
                <span className="text-xs font-normal text-slate-400">({filteredDailyDates.length} days)</span>
              </h2>
              <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
                {['all', 'present', 'absent'].map((v) => (
                  <button key={v} type="button" onClick={() => setDailyFilter(v)}
                    className={`rounded-md px-2.5 py-1 font-semibold transition ${
                      dailyFilter === v
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}>
                    {v === 'all' ? 'All' : v === 'present' ? 'Present' : 'Absent'}
                  </button>
                ))}
              </div>
            </div>

            {/* Daily list */}
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto pb-20 md:pb-0">
              {filteredDailyDates.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-400">No records match the current filter.</p>
              )}
              {filteredDailyDates.map((date) => {
                const records = recordsByDate[date] || [];
                const presentCount = records.filter((r) => r.status === 'present').length;
                const absentCount = records.length - presentCount;
                const allPresent = absentCount === 0;

                return (
                  <div key={date} className="px-4 py-3 hover:bg-slate-50 transition">
                    {/* Date header row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold ${
                          allPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {new Date(date).getDate()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {fmtDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {records.length} class{records.length !== 1 ? 'es' : ''} — {presentCount} present
                            {absentCount > 0 && <span className="text-rose-500">, {absentCount} absent</span>}
                          </p>
                        </div>
                      </div>
                      <div className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        allPresent
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}>
                        {allPresent ? 'Full Attendance' : `${absentCount} Absent`}
                      </div>
                    </div>

                    {/* Subject pills */}
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
                      {records.map((r) => (
                        <span key={r.id}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            r.status === 'present'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                          {r.status === 'present'
                            ? <CheckCircle2 className="h-3 w-3" />
                            : <XCircle className="h-3 w-3" />}
                          {/* {r.subject} */}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════ WEEKLY TAB ═══════════ */}
        {activeTab === 'weekly' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              <h2 className="font-semibold text-slate-900">Weekly Breakdown</h2>
              <span className="text-xs text-slate-400">({weeklyData.length} weeks)</span>
            </div>

            {weeklyData.length === 0 && (
              <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                No attendance records available.
              </p>
            )}

            {weeklyData.map((week) => {
              const isExpanded = expandedWeek === week.key;
              return (
                <div key={week.key}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition">
                  {/* Week summary row */}
                  <button type="button" onClick={() => setExpandedWeek(isExpanded ? null : week.key)}
                    className="flex w-full items-center justify-between p-4 hover:bg-slate-50 transition text-left">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                        week.pct >= 75
                          ? 'bg-emerald-100 text-emerald-700'
                          : week.pct >= 50
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}>
                        {week.pct}%
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {fmtDate(toLocalDateKey(week.start), { month: 'short', day: 'numeric' })}
                          {' — '}
                          {fmtDate(toLocalDateKey(week.end), { month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {week.total} classes &middot; {week.present} present &middot; {week.absent} absent
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Mini visual bar */}
                      <div className="hidden sm:flex items-center gap-0.5">
                        {Array.from({ length: Math.min(week.total, 20) }).map((_, i) => {
                          const sorted = [...week.records].sort((a, b) => a.date.localeCompare(b.date));
                          const r = sorted[i];
                          return (
                            <div key={i}
                              className={`h-5 w-1.5 rounded-full ${
                                r?.status === 'present' ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                              title={r ? `${r.date} - ${r.subject} - ${r.status}` : ''} />
                          );
                        })}
                      </div>
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4 text-slate-400" />
                        : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {[...week.records]
                        .sort((a, b) => a.date.localeCompare(b.date) || a.subject.localeCompare(b.subject))
                        .map((r) => (
                          <div key={r.id} className="flex items-center justify-between px-4 py-2.5 bg-slate-50/50">
                            <div className="flex items-center gap-2.5">
                              <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[r.status]}`} />
                              <span className="text-sm text-slate-700">{r.subject}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400">
                                {fmtDate(r.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                r.status === 'present'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}>
                                {r.status === 'present' ? 'Present' : 'Absent'}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Learning Materials Modal */}
      {showMaterialsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-600" />
                  Learning Materials
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {materialsDate ? fmtDateLong(materialsDate) : 'Select a date'}
                </p>
              </div>
              <button
                onClick={() => setShowMaterialsModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-5">
              <div className="space-y-5">
                <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Attendance</h3>
                  {(recordsByDate[materialsDate] || []).length === 0 ? (
                    <p className="text-xs text-slate-500">No attendance records found for this date.</p>
                  ) : (
                    <div className="space-y-2">
                      {(recordsByDate[materialsDate] || []).map((record) => (
                        <div
                          key={record.id}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex items-center justify-between gap-3"
                        >
                          <p className="text-sm font-medium text-slate-800">{record.subject || 'General'}</p>
                          {record.status === 'present' ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                              Present
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-rose-600">You missed today</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Lesson Plan Completion</h3>
                  {loadingLessonPlans ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                      Loading lesson plan status...
                    </div>
                  ) : lessonPlanStatuses.length === 0 ? (
                    <p className="text-xs text-slate-500">No lesson plan status found for this date.</p>
                  ) : (
                    <div className="space-y-2">
                      {lessonPlanStatuses.map((plan) => {
                        const planSubject = normalizeDisplaySubject(plan.subject || 'General');
                        const planSubjectKey = normalizeSubjectKey(planSubject);
                        let attendanceForPlan = clickedAttendanceBySubject.get(planSubjectKey) || null;
                        if (!attendanceForPlan) {
                          attendanceForPlan = clickedDateAttendanceRecords.find((record) =>
                            subjectsLikelyMatch(record.subject, planSubject)
                          ) || null;
                        }
                        const isCompletedFromAttendance = Boolean(attendanceForPlan);
                        const effectiveStatus = isCompletedFromAttendance ? 'completed' : plan.status;
                        const effectiveCompletion = isCompletedFromAttendance
                          ? 100
                          : (Number.isFinite(Number(plan.completionPercent)) ? Number(plan.completionPercent) : 0);

                        return (
                          <div
                            key={plan._id || `${plan.lessonPlanId}-${plan.date}`}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{plan.title || 'Lesson Plan'}</p>
                                <p className="text-xs text-slate-500 mt-1">{planSubject} · {(plan.teacherName || 'Teacher')}</p>
                              </div>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                effectiveStatus === 'completed'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : effectiveStatus === 'in_progress'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-200 text-slate-700'
                              }`}>
                                {effectiveStatus === 'completed' ? 'Completed' : effectiveStatus === 'in_progress' ? 'In Progress' : 'Pending'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-2">
                              Completion: {effectiveCompletion}%
                            </p>
                            {attendanceForPlan?.status === 'present' && (
                              <p className="text-[11px] text-emerald-600 mt-1.5 font-medium">
                                Lesson is completed. You learned today these topics.
                              </p>
                            )}
                            {attendanceForPlan?.status === 'absent' && (
                              <p className="text-[11px] text-rose-600 mt-1.5 font-medium">
                                Lesson is completed. You missed today these topics.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Learning Materials</h3>
                  {loadingMaterials ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                      Loading materials...
                    </div>
                  ) : materials.length === 0 ? (
                    <p className="text-xs text-slate-500">There are no learning materials available for this date.</p>
                  ) : (
                    <div className="space-y-4">
                      {materials.map((material, idx) => {
                        const attachments = Array.isArray(material.attachments) ? material.attachments : [];
                        return (
                          <div
                            key={material._id || idx}
                            className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 hover:shadow-md transition"
                          >
                            <div className="mb-3">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                  <FileText className="h-5 w-5 text-indigo-600" />
                                  {material.title}
                                </h3>
                                {material.priority && (
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    material.priority === 'high'
                                      ? 'bg-red-100 text-red-700'
                                      : material.priority === 'medium'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}>
                                    {material.priority}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-600 leading-relaxed">{material.message}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                {material.subjectName && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-blue-700">
                                    <BookOpen className="h-3 w-3" />
                                    {material.subjectName}
                                  </span>
                                )}
                                {material.typeLabel && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-purple-700">
                                    {material.typeLabel}
                                  </span>
                                )}
                                {material.createdByName && (
                                  <span className="text-slate-500">By {material.createdByName}</span>
                                )}
                              </div>
                            </div>
                            {attachments.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-slate-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <Paperclip className="h-4 w-4 text-indigo-600" />
                                  <span className="text-sm font-semibold text-slate-700">
                                    Attachments ({attachments.length})
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                  {attachments.map((attachment, attIdx) => {
                                    const FileIcon = getFileIcon(attachment?.type);
                                    return (
                                      <a
                                        key={attIdx}
                                        href={attachment?.url || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 hover:border-indigo-300 hover:bg-indigo-50 transition group"
                                      >
                                        <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition">
                                          <FileIcon className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-slate-900 truncate group-hover:text-indigo-700">
                                            {attachment?.name || `File ${attIdx + 1}`}
                                          </p>
                                          {attachment?.size && (
                                            <p className="text-xs text-slate-500">{formatFileSize(attachment.size)}</p>
                                          )}
                                        </div>
                                        <Download className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                onClick={() => setShowMaterialsModal(false)}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceView;
