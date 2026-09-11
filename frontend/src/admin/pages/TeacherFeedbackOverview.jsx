import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  GraduationCap,
  Heart,
  Layers,
  Meh,
  MessageCircle,
  MessageSquare,
  PieChart as PieChartIcon,
  RefreshCw,
  Search,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const PAGE_SIZE = 10;

const RATING_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444']; // 5★→1★

const CATEGORY_META = [
  { id: 'teaching_quality', label: 'Teaching Quality', icon: Star },
  { id: 'communication', label: 'Communication', icon: MessageCircle },
  { id: 'engagement', label: 'Engagement', icon: Users },
  { id: 'preparation', label: 'Preparation', icon: BookOpen },
  { id: 'availability', label: 'Availability', icon: Heart },
  { id: 'fairness', label: 'Fair Assessment', icon: Target },
];

const RATING_KEYS = CATEGORY_META.map((c) => c.id);

const AVATAR_PALETTE = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-pink-100', text: 'text-pink-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
];

const hashName = (name) => String(name || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const paletteFor = (name) => AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length];

const roundRating = (value) => Math.max(1, Math.min(5, Math.round(Number(value) || 0)));

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

const formatDateChip = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const formatDateRangeChip = (from, to) => {
  if (!from && !to) return 'All dates';
  return `${formatDateChip(from) || '...'} - ${formatDateChip(to) || '...'}`;
};

const computeCategoryAverages = (items) => {
  const result = RATING_KEYS.reduce((acc, key) => {
    acc[key] = { total: 0, count: 0, average: 0 };
    return acc;
  }, {});
  items.forEach((doc) => {
    RATING_KEYS.forEach((key) => {
      const value = Number(doc.ratings?.[key]);
      if (Number.isFinite(value)) {
        result[key].total += value;
        result[key].count += 1;
      }
    });
  });
  RATING_KEYS.forEach((key) => {
    result[key].average = result[key].count ? result[key].total / result[key].count : 0;
  });
  return result;
};

const buildGroups = (docs, keyFn, nameFn, subFn) => {
  const map = new Map();
  docs.forEach((doc) => {
    const key = keyFn(doc);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, { key, name: nameFn(doc), subCounts: new Map(), items: [], count: 0, sumRating: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
    }
    const group = map.get(key);
    group.items.push(doc);
    group.count += 1;
    const rating = Number(doc.overallRating) || 0;
    group.sumRating += rating;
    group.distribution[roundRating(rating)] += 1;
    const sub = subFn(doc);
    if (sub) group.subCounts.set(sub, (group.subCounts.get(sub) || 0) + 1);
  });

  return Array.from(map.values()).map((group) => {
    let topSub = '';
    let topCount = 0;
    group.subCounts.forEach((count, label) => {
      if (count > topCount) {
        topCount = count;
        topSub = label;
      }
    });
    const positive = group.distribution[4] + group.distribution[5];
    const neutral = group.distribution[3];
    const needsImprovement = group.distribution[1] + group.distribution[2];
    return {
      key: group.key,
      name: group.name,
      subLabel: topSub,
      count: group.count,
      avgRating: group.count ? group.sumRating / group.count : 0,
      distribution: group.distribution,
      positivePct: group.count ? Math.round((positive / group.count) * 100) : 0,
      neutralPct: group.count ? Math.round((neutral / group.count) * 100) : 0,
      needsImprovementPct: group.count ? Math.round((needsImprovement / group.count) * 100) : 0,
      items: group.items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    };
  });
};

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

const Avatar = ({ name, size = 'md' }) => {
  const { bg, text } = paletteFor(name);
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
  return (
    <div className={`shrink-0 rounded-full ${bg} ${text} ${sizeClass} flex items-center justify-center font-bold`}>
      {initialsOf(name)}
    </div>
  );
};

const StarRow = ({ value, size = 'w-3.5 h-3.5' }) => {
  const rounded = roundRating(value);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= rounded ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
      ))}
    </span>
  );
};

const StatTile = ({ icon: Icon, iconBg, iconColor, label, value, sub, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
  >
    <div className={`w-11 h-11 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
  </motion.div>
);

const MiniStat = ({ icon: Icon, iconBg, iconColor, label, value }) => (
  <div className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50/60 py-3 px-2 text-center">
    <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center`}>
      <Icon className={`w-4 h-4 ${iconColor}`} />
    </div>
    <p className="text-base font-bold text-slate-900">{value}</p>
    <p className="text-[11px] text-slate-500 leading-tight">{label}</p>
  </div>
);

const TabButton = ({ active, icon: Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
      active
        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200'
        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
    }`}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

const Modal = ({ title, onClose, children, wide }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onClose}
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
  >
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      onClick={(e) => e.stopPropagation()}
      className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[85vh] overflow-hidden flex flex-col`}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 overflow-y-auto">{children}</div>
    </motion.div>
  </motion.div>
);

const FeedbackItem = ({ item, showTeacher }) => (
  <div className="rounded-xl border border-slate-100 bg-white p-3.5">
    <div className="flex items-start gap-3">
      <Avatar name={item.isAnonymous ? 'Anonymous Student' : (item.studentName || 'Student')} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-800">
            {item.isAnonymous ? 'Anonymous Student' : (item.studentName || 'Student')}
          </p>
          <div className="flex items-center gap-2">
            <StarRow value={item.overallRating} />
            <span className="text-xs text-slate-400">{formatDate(item.createdAt)}</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
          {showTeacher ? (
            <span className="inline-flex items-center gap-1">
              <Users className="w-3 h-3 text-indigo-400" />
              {item.teacherName || '-'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Layers className="w-3 h-3 text-violet-400" />
              {item.className || '-'}{item.sectionName ? ` • ${item.sectionName}` : ''}
            </span>
          )}
        </p>
        {item.comments && <p className="text-sm text-slate-600 mt-1.5">&ldquo;{item.comments}&rdquo;</p>}
      </div>
    </div>
  </div>
);

const TeacherFeedbackOverview = ({ setShowAdminHeader }) => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ classes: [], sections: [], subjects: [] });

  const [activeTab, setActiveTab] = useState('teacher'); // 'teacher' | 'student'
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('rating'); // 'rating' | 'count' | 'name'
  const [selectedKey, setSelectedKey] = useState(null);
  const [page, setPage] = useState(1);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [allFeedbackOpen, setAllFeedbackOpen] = useState(false);

  const [query, setQuery] = useState({ className: 'all', sectionName: 'all', subjectName: 'all', from: '', to: '' });
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [draftRange, setDraftRange] = useState({ from: '', to: '' });
  const dateRangeRef = useRef(null);

  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [windowSettings, setWindowSettings] = useState({ enabled: false, startDate: '', endDate: '' });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [windowPanelOpen, setWindowPanelOpen] = useState(false);

  useEffect(() => {
    setShowAdminHeader?.(true);
  }, [setShowAdminHeader]);

  useEffect(() => {
    const onClickAway = (e) => {
      if (dateRangeRef.current && !dateRangeRef.current.contains(e.target)) {
        setDateRangeOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (query.className !== 'all') params.append('className', query.className);
      if (query.sectionName !== 'all') params.append('sectionName', query.sectionName);
      if (query.subjectName !== 'all') params.append('subjectName', query.subjectName);
      if (query.from) params.append('from', query.from);
      if (query.to) params.append('to', query.to);

      const res = await fetch(`${API_BASE}/api/admin/feedback/teacher-feedback?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load teacher feedback');

      setStats(data?.stats || null);
      setFeedback(Array.isArray(data?.feedback) ? data.feedback : []);
      setFilterOptions({
        classes: Array.isArray(data?.filters?.classes) ? data.filters.classes : [],
        sections: Array.isArray(data?.filters?.sections) ? data.filters.sections : [],
        subjects: Array.isArray(data?.filters?.subjects) ? data.filters.subjects : [],
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

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/academic/years`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ([]));
        if (!res.ok) throw new Error(data?.error || 'Failed to load academic sessions');
        const list = Array.isArray(data) ? data : [];
        setSessions(list);
        const active = list.find((year) => year.isActive) || list[0];
        if (active) setSelectedSessionId(active._id);
      } catch (err) {
        setError(err.message || 'Unable to load academic sessions');
      }
    };
    fetchSessions();
  }, []);

  const fetchWindowSettings = useCallback(async (sessionId) => {
    if (!sessionId) return;
    setSettingsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/admin/feedback/teacher-feedback/settings?sessionId=${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load teacher feedback settings');
      setWindowSettings({
        enabled: Boolean(data?.settings?.enabled),
        startDate: data?.settings?.startDate ? new Date(data.settings.startDate).toISOString().slice(0, 10) : '',
        endDate: data?.settings?.endDate ? new Date(data.settings.endDate).toISOString().slice(0, 10) : '',
      });
    } catch (err) {
      setError(err.message || 'Unable to load teacher feedback settings');
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWindowSettings(selectedSessionId);
  }, [selectedSessionId, fetchWindowSettings]);

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
    if (!selectedSessionId) {
      setError('Select an academic session first.');
      return;
    }
    if (windowSettings.enabled && (!windowSettings.startDate || !windowSettings.endDate)) {
      setError('Start date and end date are required when feedback is enabled.');
      return;
    }
    setSavingSettings(true);
    try {
      const next = await persistSettings({
        sessionId: selectedSessionId,
        enabled: windowSettings.enabled,
        startDate: windowSettings.startDate || null,
        endDate: windowSettings.endDate || null,
      });
      setWindowSettings(next);
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

    if (!selectedSessionId) {
      setError('Select an academic session first.');
      return;
    }

    if (nextEnabled && (!windowSettings.startDate || !windowSettings.endDate)) {
      setWindowSettings((prev) => ({ ...prev, enabled: true }));
      setError('Set a start date and end date, then click Save Window to enable feedback.');
      return;
    }

    const previousEnabled = windowSettings.enabled;
    setWindowSettings((prev) => ({ ...prev, enabled: nextEnabled }));
    setSavingSettings(true);
    try {
      const next = await persistSettings({
        sessionId: selectedSessionId,
        enabled: nextEnabled,
        startDate: windowSettings.startDate || null,
        endDate: windowSettings.endDate || null,
      });
      setWindowSettings(next);
    } catch (err) {
      setWindowSettings((prev) => ({ ...prev, enabled: previousEnabled }));
      setError(err.message || 'Unable to update teacher feedback settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const teacherGroups = useMemo(
    () => buildGroups(
      feedback,
      (d) => (d.teacherId ? String(d.teacherId) : d.teacherName),
      (d) => d.teacherName || 'Teacher',
      (d) => d.subjectName
    ),
    [feedback]
  );

  const studentGroups = useMemo(
    () => buildGroups(
      feedback,
      (d) => (d.isAnonymous ? 'anonymous' : (d.studentName || 'Unknown Student')),
      (d) => (d.isAnonymous ? 'Anonymous Students' : (d.studentName || 'Unknown Student')),
      (d) => [d.className, d.sectionName].filter(Boolean).join(' • ')
    ),
    [feedback]
  );

  const activeGroups = activeTab === 'teacher' ? teacherGroups : studentGroups;

  const visibleGroups = useMemo(() => {
    const filtered = activeGroups.filter((g) => g.name.toLowerCase().includes(searchText.trim().toLowerCase()));
    const sorted = filtered.slice().sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'count') return b.count - a.count;
      return b.avgRating - a.avgRating;
    });
    return sorted;
  }, [activeGroups, searchText, sortBy]);

  useEffect(() => {
    setPage(1);
    setShowAllRecent(false);
    if (!visibleGroups.some((g) => g.key === selectedKey)) {
      setSelectedKey(visibleGroups[0]?.key || null);
    }
  }, [visibleGroups, selectedKey]);

  useEffect(() => {
    setSelectedKey(null);
  }, [activeTab]);

  const selectedGroup = visibleGroups.find((g) => g.key === selectedKey) || null;

  const totalPages = Math.max(1, Math.ceil(visibleGroups.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedGroups = visibleGroups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = visibleGroups.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, visibleGroups.length);

  const pageNumbers = useMemo(() => {
    const span = 2;
    const nums = new Set([1, totalPages]);
    for (let p = currentPage - span; p <= currentPage + span; p += 1) {
      if (p >= 1 && p <= totalPages) nums.add(p);
    }
    return Array.from(nums).sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  const averageRating = useMemo(() => Number(stats?.averageRating || 0).toFixed(1), [stats]);
  const positivePct = useMemo(() => {
    const dist = stats?.ratingDistribution;
    if (!dist || !stats?.totalFeedback) return 0;
    return Math.round(((Number(dist[4] || 0) + Number(dist[5] || 0)) / stats.totalFeedback) * 100);
  }, [stats]);

  const exportCsv = () => {
    const rows = [
      ['Teacher', 'Subject', 'Class', 'Section', 'Student', 'Rating', 'Comments', 'Date'],
      ...feedback.map((f) => [
        f.teacherName, f.subjectName, f.className, f.sectionName,
        f.isAnonymous ? 'Anonymous Student' : f.studentName,
        f.overallRating, (f.comments || '').replace(/\n/g, ' '), formatDate(f.createdAt),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teacher-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const applyDateRange = () => {
    setQuery((prev) => ({ ...prev, from: draftRange.from, to: draftRange.to }));
    setDateRangeOpen(false);
  };

  const clearDateRange = () => {
    setDraftRange({ from: '', to: '' });
    setQuery((prev) => ({ ...prev, from: '', to: '' }));
    setDateRangeOpen(false);
  };

  const selectClass =
    'rounded-full border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm transition-colors hover:border-indigo-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none';

  const recentItems = selectedGroup ? (showAllRecent ? selectedGroup.items : selectedGroup.items.slice(0, 3)) : [];
  const categoryAverages = useMemo(() => computeCategoryAverages(selectedGroup?.items || []), [selectedGroup]);
  const groupPieData = useMemo(
    () =>
      [5, 4, 3, 2, 1]
        .map((r, i) => ({
          name: `${r} Star${r > 1 ? 's' : ''}`,
          value: selectedGroup?.distribution?.[r] || 0,
          color: RATING_COLORS[i],
        }))
        .filter((d) => d.value > 0),
    [selectedGroup]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 p-4 sm:p-6 space-y-5">
      {/* Breadcrumb */}
      {/* <div className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Teacher Feedback
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="font-semibold text-slate-700">Overview</span>
      </div> */}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50 to-white border border-indigo-100 p-6 sm:p-7"
      >
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-56 h-56 bg-violet-200/30 rounded-full blur-3xl" />
        <div className="relative flex items-center justify-between gap-6 flex-wrap">
          <div className="max-w-xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Teacher Feedback</h1>
            <p className="text-sm text-slate-500 mt-1.5">
              View and analyze feedback for each teacher. Check detailed insights, student comments and ratings.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -top-2 -right-3 bg-white rounded-full shadow-md px-1.5 py-1 flex items-center gap-0.5">
                {[1, 2, 3, 4].map((i) => (
                  <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 leading-snug">Great Teachers<br />Build Brighter Futures</p>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 mt-1.5" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TabButton active={activeTab === 'teacher'} icon={Users} label="Teacher Wise" onClick={() => setActiveTab('teacher')} />
          <TabButton active={activeTab === 'student'} icon={User} label="Student Wise" onClick={() => setActiveTab('student')} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWindowPanelOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Clock className="w-4 h-4" />
            Feedback Window
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Feedback window settings (session-wise) */}
      <AnimatePresence>
        {windowPanelOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">Student Feedback Window</p>
                </div>
                <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-2">
                  <Toggle checked={windowSettings.enabled} onChange={handleToggleEnabled} disabled={savingSettings || !selectedSessionId} />
                  <span className={`text-xs font-semibold ${windowSettings.enabled ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {savingSettings ? 'Saving...' : windowSettings.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  1. Academic Session
                </label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className={`${selectClass} w-full sm:w-72`}
                  disabled={settingsLoading || sessions.length === 0}
                >
                  {sessions.length === 0 && <option value="">No sessions found</option>}
                  {sessions.map((session) => (
                    <option key={session._id} value={session._id}>
                      {session.name}{session.isActive ? ' (active)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  2. Feedback Window Dates
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="date"
                    value={windowSettings.startDate}
                    onChange={(e) => setWindowSettings((prev) => ({ ...prev, startDate: e.target.value }))}
                    className={selectClass}
                    disabled={!windowSettings.enabled || !selectedSessionId}
                  />
                  <input
                    type="date"
                    value={windowSettings.endDate}
                    onChange={(e) => setWindowSettings((prev) => ({ ...prev, endDate: e.target.value }))}
                    className={selectClass}
                    disabled={!windowSettings.enabled || !selectedSessionId}
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={saveFeedbackWindow}
                    disabled={savingSettings || !selectedSessionId}
                    className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold px-4 py-2.5 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
                  >
                    {savingSettings ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> 3. Save Window
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
              <AnimatePresence>
                {!windowSettings.enabled && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-center gap-2"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Feedback is currently disabled for this session. Students will see &quot;Feedback not started&quot;.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          label={activeTab === 'teacher' ? 'Total Teachers' : 'Total Students'}
          value={activeGroups.length}
          delay={0.02}
        />
        <StatTile
          icon={Star}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          label="Average Rating"
          value={`${averageRating} / 5`}
          sub={<StarRow value={Number(averageRating)} />}
          delay={0.06}
        />
        <StatTile
          icon={ThumbsUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          label="Positive Feedback"
          value={`${positivePct}%`}
          sub={<span className="text-xs text-slate-400">Rated 4★ or higher</span>}
          delay={0.1}
        />
        <StatTile
          icon={MessageSquare}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          label="Total Feedback"
          value={stats?.totalFeedback ?? 0}
          sub={<span className="text-xs text-slate-400">From all students</span>}
          delay={0.14}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={query.className}
          onChange={(e) => setQuery((prev) => ({ ...prev, className: e.target.value }))}
          className={selectClass}
        >
          <option value="all">All Classes</option>
          {filterOptions.classes.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select
          value={query.subjectName}
          onChange={(e) => setQuery((prev) => ({ ...prev, subjectName: e.target.value }))}
          className={selectClass}
        >
          <option value="all">All Subjects</option>
          {filterOptions.subjects.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select
          value={query.sectionName}
          onChange={(e) => setQuery((prev) => ({ ...prev, sectionName: e.target.value }))}
          className={selectClass}
        >
          <option value="all">All Sections</option>
          {filterOptions.sections.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={`Search ${activeTab === 'teacher' ? 'teacher' : 'student'} by name...`}
            className={`w-full pl-9 pr-3 ${selectClass}`}
          />
        </div>
        <div className="relative" ref={dateRangeRef}>
          <button
            onClick={() => {
              setDraftRange({ from: query.from, to: query.to });
              setDateRangeOpen((v) => !v);
            }}
            className={`${selectClass} inline-flex items-center gap-2`}
          >
            <Calendar className="w-4 h-4 text-slate-400" />
            {formatDateRangeChip(query.from, query.to)}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <AnimatePresence>
            {dateRangeOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute right-0 mt-2 z-20 w-64 rounded-2xl border border-slate-100 bg-white shadow-xl p-4 space-y-3"
              >
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">From</label>
                  <input
                    type="date"
                    value={draftRange.from}
                    onChange={(e) => setDraftRange((prev) => ({ ...prev, from: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">To</label>
                  <input
                    type="date"
                    value={draftRange.to}
                    onChange={(e) => setDraftRange((prev) => ({ ...prev, to: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button onClick={clearDateRange} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Clear</button>
                  <button
                    onClick={applyDateRange}
                    className="text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 rounded-full"
                  >
                    Apply
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl text-red-700 bg-red-50 border border-red-100 flex items-center gap-2 text-sm font-medium">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* List + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        {/* Left: list */}
        <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-sm flex flex-col">
          <div className="flex items-center justify-between gap-2 p-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-800">
              {activeTab === 'teacher' ? 'Teachers' : 'Students'} ({visibleGroups.length})
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="hidden sm:inline">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 focus:outline-none"
              >
                <option value="rating">Average Rating</option>
                <option value="count">Most Feedback</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
              <p className="text-sm font-medium">Loading...</p>
            </div>
          ) : paginatedGroups.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center gap-2 text-slate-400">
              <MessageSquare className="w-8 h-8" />
              <p className="text-sm font-medium text-slate-500">No results found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {paginatedGroups.map((group) => (
                <button
                  key={group.key}
                  onClick={() => setSelectedKey(group.key)}
                  className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${
                    group.key === selectedKey ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'border-l-4 border-transparent hover:bg-slate-50'
                  }`}
                >
                  <Avatar name={group.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{group.name}</p>
                    <p className="text-xs text-slate-500 truncate">{group.subLabel || '-'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500 flex items-center justify-end gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {group.count}
                    </p>
                    <p className="text-xs font-bold text-slate-700 flex items-center justify-end gap-1 mt-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {group.avgRating.toFixed(1)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {visibleGroups.length > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 border-t border-slate-100 mt-auto">
              <p className="text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-700">{rangeStart}</span>–
                <span className="font-semibold text-slate-700">{rangeEnd}</span> of{' '}
                <span className="font-semibold text-slate-700">{visibleGroups.length}</span> {activeTab === 'teacher' ? 'teachers' : 'students'}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {pageNumbers.map((p, idx) => {
                  const prev = pageNumbers[idx - 1];
                  const showEllipsis = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && <span className="w-6 text-center text-slate-300 text-xs">…</span>}
                      <button
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
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
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-sm p-5">
          {!selectedGroup ? (
            <div className="h-full min-h-[320px] flex flex-col items-center justify-center gap-3 text-slate-400">
              <MessageSquare className="w-10 h-10" />
              <p className="text-sm font-medium">
                Select a {activeTab === 'teacher' ? 'teacher' : 'student'} to see detailed feedback.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Avatar name={selectedGroup.name} size="lg" />
                  <div>
                    <p className="text-lg font-bold text-slate-900">{selectedGroup.name}</p>
                    <p className="text-sm text-slate-500">{selectedGroup.subLabel || '-'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-slate-900 flex items-center gap-1.5 justify-end">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    {selectedGroup.avgRating.toFixed(1)} / 5
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Based on {selectedGroup.count} feedbacks</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniStat icon={MessageSquare} iconBg="bg-blue-50" iconColor="text-blue-600" label="Total Feedbacks" value={selectedGroup.count} />
                <MiniStat icon={ThumbsUp} iconBg="bg-emerald-50" iconColor="text-emerald-600" label="Positive Feedback" value={`${selectedGroup.positivePct}%`} />
                <MiniStat icon={Meh} iconBg="bg-amber-50" iconColor="text-amber-600" label="Neutral" value={`${selectedGroup.neutralPct}%`} />
                <MiniStat icon={ThumbsDown} iconBg="bg-rose-50" iconColor="text-rose-600" label="Needs Improvement" value={`${selectedGroup.needsImprovementPct}%`} />
              </div>

              <div>
                <p className="text-sm font-bold text-slate-800 mb-3">Rating Distribution</p>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((r, i) => {
                    const count = selectedGroup.distribution[r] || 0;
                    const pct = selectedGroup.count ? Math.round((count / selectedGroup.count) * 100) : 0;
                    return (
                      <div key={r} className="flex items-center gap-2 text-xs">
                        <span className="w-10 text-slate-500 shrink-0">{r} ★</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full">
                          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: RATING_COLORS[i] }} />
                        </div>
                        <span className="w-16 text-right text-slate-400">{pct}% ({count})</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-slate-800">Recent Feedback</p>
                  {selectedGroup.items.length > 3 && (
                    <button
                      onClick={() => setShowAllRecent((v) => !v)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      {showAllRecent ? 'Show Less' : 'View All'}
                    </button>
                  )}
                </div>
                <div className="space-y-2.5">
                  {recentItems.map((item) => (
                    <FeedbackItem key={item.id} item={item} showTeacher={activeTab === 'student'} />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap pt-1">
                <button
                  onClick={() => setAnalysisOpen(true)}
                  className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 rounded-full border border-indigo-200 text-indigo-600 text-sm font-semibold px-4 py-2.5 hover:bg-indigo-50 transition-colors"
                >
                  <BarChart3 className="w-4 h-4" />
                  View Detailed Analysis
                </button>
                <button
                  onClick={() => setAllFeedbackOpen(true)}
                  className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold px-4 py-2.5 hover:from-indigo-700 hover:to-violet-700 shadow-md shadow-indigo-200 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  View All Feedback
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed analysis modal */}
      <AnimatePresence>
        {analysisOpen && selectedGroup && (
          <Modal title={`Detailed Analysis · ${selectedGroup.name}`} onClose={() => setAnalysisOpen(false)} wide>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                    <PieChartIcon className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">Rating Distribution</p>
                </div>
                {groupPieData.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-sm text-slate-400">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={groupPieData} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value">
                        {groupPieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                      <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                    <BarChart3 className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">Category Averages</p>
                </div>
                <div className="space-y-3.5">
                  {CATEGORY_META.map((cat) => {
                    const Icon = cat.icon;
                    const average = categoryAverages?.[cat.id]?.average || 0;
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
                            <div className="h-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* All feedback modal */}
      <AnimatePresence>
        {allFeedbackOpen && selectedGroup && (
          <Modal title={`All Feedback · ${selectedGroup.name} (${selectedGroup.count})`} onClose={() => setAllFeedbackOpen(false)} wide>
            <div className="space-y-2.5">
              {selectedGroup.items.map((item) => (
                <FeedbackItem key={item.id} item={item} showTeacher={activeTab === 'student'} />
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeacherFeedbackOverview;
