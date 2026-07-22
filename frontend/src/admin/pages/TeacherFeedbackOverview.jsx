import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Filter,
  Heart,
  Layers,
  MessageCircle,
  MessageSquare,
  PieChart as PieChartIcon,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const PAGE_SIZE = 8;

const RATING_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444']; // 5★→1★

const CATEGORY_META = [
  { id: 'teaching_quality', label: 'Teaching Quality', icon: Star },
  { id: 'communication', label: 'Communication', icon: MessageCircle },
  { id: 'engagement', label: 'Engagement', icon: Users },
  { id: 'preparation', label: 'Preparation', icon: BookOpen },
  { id: 'availability', label: 'Availability', icon: Heart },
  { id: 'fairness', label: 'Fair Assessment', icon: Target },
];

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-900">{payload[0].name}</p>
      <p className="text-slate-500">{payload[0].value} submission{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  );
};

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 ${
      checked ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-slate-300'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span
      className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
        checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
      }`}
    />
  </button>
);

const StatCard = ({ icon: Icon, label, value, sub, gradient, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay }}
    className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 backdrop-blur-xl p-5 shadow-[0_4px_24px_-4px_rgba(30,41,59,0.08)] hover:shadow-[0_8px_32px_-4px_rgba(30,41,59,0.14)] transition-shadow"
  >
    <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-20 blur-2xl bg-gradient-to-br ${gradient}`} />
    <div className="relative flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </motion.div>
);

const RatingBadge = ({ value }) => {
  const rating = Number(value || 0);
  const tone =
    rating >= 4
      ? 'from-emerald-500 to-teal-500'
      : rating >= 2.5
      ? 'from-amber-400 to-orange-500'
      : 'from-rose-500 to-red-500';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r ${tone} text-white text-xs font-bold shadow-sm`}>
      <Star className="w-3 h-3 fill-white" />
      {rating.toFixed(1)}
    </span>
  );
};

const TeacherFeedbackOverview = ({ setShowAdminHeader }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [filters, setFilters] = useState({ teachers: [], classes: [], sections: [], subjects: [] });
  const [settings, setSettings] = useState({ enabled: false, startDate: '', endDate: '' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState({
    teacherId: 'all',
    className: 'all',
    sectionName: 'all',
    subjectName: 'all',
    search: '',
  });

  useEffect(() => {
    setShowAdminHeader?.(true);
  }, [setShowAdminHeader]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (query.teacherId !== 'all') params.append('teacherId', query.teacherId);
      if (query.className !== 'all') params.append('className', query.className);
      if (query.sectionName !== 'all') params.append('sectionName', query.sectionName);
      if (query.subjectName !== 'all') params.append('subjectName', query.subjectName);
      if (query.search.trim()) params.append('search', query.search.trim());

      const [overviewRes, settingsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/feedback/teacher-feedback?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/admin/feedback/teacher-feedback/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const data = await overviewRes.json().catch(() => ({}));
      if (!overviewRes.ok) throw new Error(data.error || 'Failed to load teacher feedback');
      const settingsData = await settingsRes.json().catch(() => ({}));
      if (!settingsRes.ok) throw new Error(settingsData.error || 'Failed to load teacher feedback settings');

      setStats(data?.stats || null);
      setFeedback(Array.isArray(data?.feedback) ? data.feedback : []);
      setFilters({
        teachers: Array.isArray(data?.filters?.teachers) ? data.filters.teachers : [],
        classes: Array.isArray(data?.filters?.classes) ? data.filters.classes : [],
        sections: Array.isArray(data?.filters?.sections) ? data.filters.sections : [],
        subjects: Array.isArray(data?.filters?.subjects) ? data.filters.subjects : [],
      });
      setSettings({
        enabled: Boolean(settingsData?.settings?.enabled),
        startDate: settingsData?.settings?.startDate ? new Date(settingsData.settings.startDate).toISOString().slice(0, 10) : '',
        endDate: settingsData?.settings?.endDate ? new Date(settingsData.settings.endDate).toISOString().slice(0, 10) : '',
      });
    } catch (err) {
      setError(err.message || 'Unable to load teacher feedback');
      setStats(null);
      setFeedback([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const averageRating = useMemo(() => Number(stats?.averageRating || 0).toFixed(1), [stats]);

  const positivePct = useMemo(() => {
    const dist = stats?.ratingDistribution;
    if (!dist || !stats?.totalFeedback) return 0;
    return Math.round(((Number(dist[4] || 0) + Number(dist[5] || 0)) / stats.totalFeedback) * 100);
  }, [stats]);

  const ratingPieData = useMemo(
    () =>
      [5, 4, 3, 2, 1]
        .map((r, i) => ({
          name: `${r} Star${r > 1 ? 's' : ''}`,
          value: stats?.ratingDistribution?.[r] || 0,
          color: RATING_COLORS[i],
        }))
        .filter((d) => d.value > 0),
    [stats]
  );

  const hasActiveFilters =
    query.teacherId !== 'all' ||
    query.className !== 'all' ||
    query.sectionName !== 'all' ||
    query.subjectName !== 'all' ||
    query.search.trim() !== '';

  const resetFilters = () => {
    setQuery({
      teacherId: 'all',
      className: 'all',
      sectionName: 'all',
      subjectName: 'all',
      search: '',
    });
  };

  const persistSettings = async (payload) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/api/admin/feedback/teacher-feedback/settings`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update teacher feedback settings');
    return {
      enabled: Boolean(data?.settings?.enabled),
      startDate: data?.settings?.startDate ? new Date(data.settings.startDate).toISOString().slice(0, 10) : '',
      endDate: data?.settings?.endDate ? new Date(data.settings.endDate).toISOString().slice(0, 10) : '',
    };
  };

  const saveFeedbackWindow = async () => {
    setError('');
    if (settings.enabled && (!settings.startDate || !settings.endDate)) {
      setError('Start date and end date are required when feedback is enabled.');
      return;
    }
    setSavingSettings(true);
    try {
      const next = await persistSettings({
        enabled: settings.enabled,
        startDate: settings.startDate || null,
        endDate: settings.endDate || null,
      });
      setSettings(next);
    } catch (err) {
      setError(err.message || 'Unable to save teacher feedback settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // The toggle itself should take effect immediately, like any switch —
  // it shouldn't silently wait on a separate "Save Window" click.
  const handleToggleEnabled = async (nextEnabled) => {
    setError('');

    if (nextEnabled && (!settings.startDate || !settings.endDate)) {
      // Can't enable without a date range yet; reveal the date fields and
      // let the admin fill them in, then use Save Window to turn it on.
      setSettings((prev) => ({ ...prev, enabled: true }));
      setError('Set a start date and end date, then click Save Window to enable feedback.');
      return;
    }

    const previousEnabled = settings.enabled;
    setSettings((prev) => ({ ...prev, enabled: nextEnabled }));
    setSavingSettings(true);
    try {
      const next = await persistSettings({
        enabled: nextEnabled,
        startDate: settings.startDate || null,
        endDate: settings.endDate || null,
      });
      setSettings(next);
    } catch (err) {
      setSettings((prev) => ({ ...prev, enabled: previousEnabled }));
      setError(err.message || 'Unable to update teacher feedback settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(feedback.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedFeedback = feedback.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = feedback.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, feedback.length);

  const pageNumbers = useMemo(() => {
    const span = 2;
    const nums = new Set([1, totalPages]);
    for (let p = currentPage - span; p <= currentPage + span; p += 1) {
      if (p >= 1 && p <= totalPages) nums.add(p);
    }
    return Array.from(nums).sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  const selectClass =
    'rounded-full border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm transition-colors hover:border-indigo-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/30 p-4 sm:p-6 space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 p-6 sm:p-7 shadow-lg shadow-indigo-200/50"
      >
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-fuchsia-400/20 rounded-full blur-3xl" />
        <div className="relative flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white/90 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Feedback Insights
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
              <MessageSquare className="w-7 h-7" />
              Teacher Feedback Overview
            </h1>
            <p className="text-sm text-indigo-100 mt-1.5">View feedback by teacher, class, section and subject.</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={fetchFeedback}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-indigo-700 bg-white hover:bg-indigo-50 transition-colors shadow-md disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </motion.button>
        </div>
      </motion.div>

      {/* Feedback window settings */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl p-5 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm font-bold text-slate-800">Student Feedback Window</p>
          </div>
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-2">
            <Toggle checked={settings.enabled} onChange={handleToggleEnabled} disabled={savingSettings} />
            <span className={`text-xs font-semibold ${settings.enabled ? 'text-emerald-600' : 'text-slate-500'}`}>
              {savingSettings ? 'Saving...' : settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="date"
            value={settings.startDate}
            onChange={(e) => setSettings((prev) => ({ ...prev, startDate: e.target.value }))}
            className={selectClass}
            disabled={!settings.enabled}
          />
          <input
            type="date"
            value={settings.endDate}
            onChange={(e) => setSettings((prev) => ({ ...prev, endDate: e.target.value }))}
            className={selectClass}
            disabled={!settings.enabled}
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={saveFeedbackWindow}
            disabled={savingSettings}
            className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold px-4 py-2.5 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
          >
            {savingSettings ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Save Window
              </>
            )}
          </motion.button>
        </div>
        <AnimatePresence>
          {!settings.enabled && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-center gap-2"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Feedback is currently disabled. Students will see "Feedback not started".
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={MessageSquare}
          label="Total Feedback"
          value={stats?.totalFeedback ?? 0}
          sub="Submissions received"
          gradient="from-indigo-500 to-blue-500"
          delay={0.05}
        />
        <StatCard
          icon={TrendingUp}
          label="Average Rating"
          value={`${averageRating} / 5`}
          sub={
            <span className="inline-flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${i <= Math.round(Number(averageRating)) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                />
              ))}
            </span>
          }
          gradient="from-amber-400 to-orange-500"
          delay={0.1}
        />
        <StatCard
          icon={ThumbsUp}
          label="Positive Feedback"
          value={`${positivePct}%`}
          sub="Rated 4★ or higher"
          gradient="from-emerald-500 to-teal-500"
          delay={0.15}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.18 }}
          className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
              <PieChartIcon className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm font-bold text-slate-800">Rating Distribution</p>
          </div>
          {ratingPieData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-slate-400">No data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={ratingPieData} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value">
                    {ratingPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-2">
                {[5, 4, 3, 2, 1].map((r, i) => {
                  const count = stats?.ratingDistribution?.[r] || 0;
                  const pct = stats?.totalFeedback ? Math.round((count / stats.totalFeedback) * 100) : 0;
                  return (
                    <div key={r} className="flex items-center gap-2 text-xs">
                      <span className="w-10 text-slate-500 shrink-0">{r}★</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: RATING_COLORS[i] }} />
                      </div>
                      <span className="w-8 text-right text-slate-400">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.22 }}
          className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm font-bold text-slate-800">Category Averages</p>
          </div>
          {!stats?.totalFeedback ? (
            <div className="h-52 flex items-center justify-center text-sm text-slate-400">No data yet</div>
          ) : (
            <div className="space-y-3.5">
              {CATEGORY_META.map((cat) => {
                const Icon = cat.icon;
                const average = stats?.categoryAverages?.[cat.id]?.average || 0;
                const pct = (average / 5) * 100;
                return (
                  <div key={cat.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-slate-600 truncate">{cat.label}</p>
                        <p className="text-xs font-bold text-slate-800 shrink-0">{average.toFixed(1)}</p>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: 0.25 }}
                          className="h-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
        className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl p-4 sm:p-5 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-sm">
              <Filter className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm font-bold text-slate-800">Filters</p>
          </div>
          {hasActiveFilters && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </motion.button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <select
            value={query.teacherId}
            onChange={(e) => setQuery((prev) => ({ ...prev, teacherId: e.target.value }))}
            className={selectClass}
          >
            <option value="all">All Teachers</option>
            {filters.teachers.map((teacher) => (
              <option key={`${teacher.teacherId}-${teacher.teacherName}`} value={String(teacher.teacherId || '')}>
                {teacher.teacherName}
              </option>
            ))}
          </select>
          <select
            value={query.className}
            onChange={(e) => setQuery((prev) => ({ ...prev, className: e.target.value }))}
            className={selectClass}
          >
            <option value="all">All Classes</option>
            {filters.classes.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={query.sectionName}
            onChange={(e) => setQuery((prev) => ({ ...prev, sectionName: e.target.value }))}
            className={selectClass}
          >
            <option value="all">All Sections</option>
            {filters.sections.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={query.subjectName}
            onChange={(e) => setQuery((prev) => ({ ...prev, subjectName: e.target.value }))}
            className={selectClass}
          >
            <option value="all">All Subjects</option>
            {filters.subjects.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query.search}
              onChange={(e) => setQuery((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Search..."
              className={`w-full pl-9 pr-3 ${selectClass}`}
            />
          </div>
        </div>
      </motion.div>

      {/* Feedback list */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
        className="rounded-full border border-white/60 bg-white/80 backdrop-blur-xl shadow-sm overflow-hidden"
      >
        {loading ? (
          <div className="p-14 flex flex-col items-center justify-center gap-3 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-sm font-medium">Loading feedback...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-red-700 bg-red-50 border-t border-red-100 flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        ) : feedback.length === 0 ? (
          <div className="p-14 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <MessageSquare className="w-7 h-7" />
            </div>
            <p className="text-sm font-medium text-slate-500">No feedback found for the selected filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr className="text-left text-slate-500">
                    <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wide">Teacher</th>
                    <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wide">Subject</th>
                    <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wide">Class</th>
                    <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wide">Section</th>
                    <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wide">Rating</th>
                    <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wide">Student</th>
                    <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wide">Comments</th>
                    <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedFeedback.map((item, idx) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25, delay: Math.min(idx * 0.02, 0.4) }}
                      className="border-b border-slate-100 align-top hover:bg-indigo-50/40 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{item.teacherName || '-'}</td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                          {item.subjectName || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-violet-400" />
                          {item.className || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{item.sectionName || '-'}</td>
                      <td className="px-4 py-3.5">
                        <RatingBadge value={item.overallRating} />
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {item.studentName || 'Anonymous Student'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 max-w-[320px]">
                        <p className="line-clamp-2">{item.comments || '-'}</p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '-'}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between flex-wrap gap-3 px-4 sm:px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
              <p className="text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-700">{rangeStart}</span>–
                <span className="font-semibold text-slate-700">{rangeEnd}</span> of{' '}
                <span className="font-semibold text-slate-700">{feedback.length}</span> results
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-500 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {pageNumbers.map((p, idx) => {
                  const prev = pageNumbers[idx - 1];
                  const showEllipsis = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && <span className="w-8 h-8 flex items-center justify-center text-slate-300 text-xs">…</span>}
                      <button
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                          p === currentPage
                            ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-500 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default TeacherFeedbackOverview;
