import React, { useEffect, useMemo, useState } from 'react';
import { Award, Calendar, Loader2, Trophy, Star, Zap, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { fetchCachedJson } from '../utils/studentApiCache';

const PAGE_SIZE = 5;

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const STUDENT_ACHIEVEMENTS_ENDPOINT = `${API_BASE}/api/student/auth/achievements`;
const STUDENT_ACHIEVEMENTS_CACHE_TTL_MS = 2 * 60 * 1000;

const formatDate = (value) => {
  if (!value) return 'N/A';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const CATEGORY_META = {
  Academic: { badge: 'bg-blue-100 text-blue-700', chip: 'bg-blue-500', border: 'border-l-blue-400', icon: Star },
  Sports: { badge: 'bg-emerald-100 text-emerald-700', chip: 'bg-emerald-500', border: 'border-l-emerald-400', icon: Zap },
  'Extra-Curricular': { badge: 'bg-purple-100 text-purple-700', chip: 'bg-purple-500', border: 'border-l-purple-400', icon: Sparkles },
  Other: { badge: 'bg-slate-100 text-slate-700', chip: 'bg-slate-400', border: 'border-l-slate-300', icon: Award },
};

const getCategoryMeta = (category) => CATEGORY_META[category] || CATEGORY_META.Other;

const CATEGORY_FILTERS = ['all', 'Academic', 'Sports', 'Extra-Curricular', 'Other'];

// Achievements have no explicit session/academic-year field, so the session label is
// derived from the achievement date assuming an Apr–Mar academic year (e.g. "2024-2025").
const deriveSessionLabel = (value) => {
  if (!value) return 'Other';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return 'Other';
  const year = dt.getFullYear();
  const startYear = dt.getMonth() < 3 ? year - 1 : year;
  return `${startYear}-${startYear + 1}`;
};

const resolveAchievementId = (item, idx) => String(item?._id || item?.id || idx);

const StatTile = ({ icon, label, value, grad, shadow }) => {
  const IconComp = icon;
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-linear-to-br ${grad} p-3.5 shadow-lg ${shadow} transition-transform hover:-translate-y-0.5 md:p-4`}>
      <div className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold text-white/80">{label}</p>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <IconComp className="h-4 w-4 text-white" />
          </div>
        </div>
        <p className="mt-1.5 text-lg font-black text-white leading-tight truncate md:text-xl">{value}</p>
      </div>
    </div>
  );
};

const AchievementsView = () => {
  const location = useLocation();
  const [student, setStudent] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [highlightedAchievementId, setHighlightedAchievementId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchAchievements = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Please login again.');

        const { data } = await fetchCachedJson(STUDENT_ACHIEVEMENTS_ENDPOINT, {
          ttlMs: STUDENT_ACHIEVEMENTS_CACHE_TTL_MS,
          fetchOptions: {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        });

        setStudent(data?.student || null);
        setAchievements(Array.isArray(data?.achievements) ? data.achievements : []);
      } catch (err) {
        setError(err.message || 'Unable to load achievements');
        setStudent(null);
        setAchievements([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, []);

  const totalCount = achievements.length;
  const latestDate = useMemo(() => {
    if (!achievements.length) return 'N/A';
    return formatDate(achievements[0]?.date);
  }, [achievements]);

  const sessionOptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    achievements.forEach((item) => {
      const label = deriveSessionLabel(item?.date);
      if (!seen.has(label)) {
        seen.add(label);
        list.push(label);
      }
    });
    return list;
  }, [achievements]);

  const topCategory = useMemo(() => {
    const counts = {};
    achievements.forEach((item) => {
      const key = item?.category || 'Other';
      counts[key] = (counts[key] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0] || 'N/A';
  }, [achievements]);

  const filteredAchievements = useMemo(() => {
    return achievements.filter((item) => {
      const matchesCategory = categoryFilter === 'all' || (item?.category || 'Other') === categoryFilter;
      const matchesSession = sessionFilter === 'all' || deriveSessionLabel(item?.date) === sessionFilter;
      return matchesCategory && matchesSession;
    });
  }, [achievements, categoryFilter, sessionFilter]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, sessionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAchievements.length / PAGE_SIZE));
  const pageAchievements = filteredAchievements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const targetAchievementId = useMemo(
    () => new URLSearchParams(location.search).get('achievementId') || '',
    [location.search]
  );

  useEffect(() => {
    if (!targetAchievementId || loading || filteredAchievements.length === 0) return;
    const foundIndex = filteredAchievements.findIndex(
      (item, idx) => resolveAchievementId(item, idx) === targetAchievementId
    );
    if (foundIndex === -1) return;
    setPage(Math.floor(foundIndex / PAGE_SIZE) + 1);
  }, [filteredAchievements, loading, targetAchievementId]);

  useEffect(() => {
    if (!targetAchievementId || highlightedAchievementId) return;
    const element = document.getElementById(`achievement-card-${targetAchievementId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedAchievementId(targetAchievementId);
    const timeoutId = window.setTimeout(() => setHighlightedAchievementId(''), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [page, targetAchievementId, highlightedAchievementId]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-amber-400 via-yellow-400 to-orange-500 p-5 text-white shadow-lg shadow-amber-200/60 sm:p-6">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-10 left-1/3 h-28 w-28 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Trophy className="h-5.5 w-5.5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">My Achievements</h1>
              <p className="mt-1 text-sm text-white/85">
                {student?.name
                  ? `${student.name}${student?.grade ? ` • ${student.grade}${student?.section ? `-${student.section}` : ''}` : ''}`
                  : 'Every milestone you have earned, in one place'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile icon={Trophy} label="Total Achievements" value={totalCount} grad="from-amber-400 to-orange-500" shadow="shadow-amber-200/60" />
          <StatTile icon={Calendar} label="Latest" value={latestDate} grad="from-indigo-500 to-blue-600" shadow="shadow-indigo-200/60" />
          <StatTile icon={Award} label="Top Category" value={topCategory} grad="from-purple-500 to-fuchsia-600" shadow="shadow-purple-200/60" />
          <StatTile icon={Sparkles} label="Sessions" value={sessionOptions.length || 1} grad="from-emerald-500 to-teal-600" shadow="shadow-emerald-200/60" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Category</p>
              <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
                {CATEGORY_FILTERS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
                      categoryFilter === cat
                        ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="achievement-session-filter" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Session
              </label>
              <select
                id="achievement-session-filter"
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-auto"
              >
                <option value="all">All Sessions</option>
                {sessionOptions.map((session) => (
                  <option key={session} value={session}>{session}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className=" p-4 sm:p-5">
          {loading ? (
            <div className="py-10 flex items-center justify-center gap-2 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading achievements...</span>
            </div>
          ) : error ? (
            <div className="py-8 text-sm text-red-600">{error}</div>
          ) : achievements.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <Award size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">No achievements yet.</p>
            </div>
          ) : filteredAchievements.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <Award size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">No achievements match this filter.</p>
            </div>
          ) : (
            <>
              <p className="mb-3 px-1 text-xs text-slate-400">
                Showing {pageAchievements.length} of {filteredAchievements.length} achievement{filteredAchievements.length !== 1 ? 's' : ''}
                {filteredAchievements.length !== totalCount ? ` (filtered from ${totalCount})` : ''}
              </p>
              <div className="space-y-3">
                {pageAchievements.map((item, localIdx) => {
                  const globalIdx = (page - 1) * PAGE_SIZE + localIdx;
                  const achievementId = resolveAchievementId(item, globalIdx);
                  const isHighlighted = highlightedAchievementId === achievementId;
                  const meta = getCategoryMeta(item?.category);
                  const CategoryIcon = meta.icon;
                  return (
                    <div
                      id={`achievement-card-${achievementId}`}
                      key={achievementId}
                      className={`flex items-center gap-3 rounded-2xl border border-slate-100 border-l-4 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                        meta.border
                      } ${isHighlighted ? 'ring-2 ring-indigo-300 bg-indigo-50/40' : ''}`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${meta.chip}`}>
                        <CategoryIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-bold text-slate-900 wrap-break-word">{item?.title || 'Achievement'}</p>
                          <span className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full ${meta.badge}`}>
                            {item?.category || 'Other'}
                          </span>
                        </div>
                        {item?.description && <p className="mt-1 text-sm text-slate-600 wrap-break-word">{item.description}</p>}
                        <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                          <Calendar size={12} />
                          {formatDate(item?.date)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredAchievements.length > PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPage(i + 1)}
                      className={`h-8 min-w-8 rounded-lg px-2.5 text-xs font-bold transition-colors ${
                        page === i + 1
                          ? 'bg-linear-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                          : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AchievementsView;
