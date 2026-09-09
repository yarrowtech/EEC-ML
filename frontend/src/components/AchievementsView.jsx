import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  Medal,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { fetchCachedJson } from '../utils/studentApiCache';

const PAGE_SIZE = 5;

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const STUDENT_ACHIEVEMENTS_ENDPOINT = `${API_BASE}/api/student/auth/achievements`;
const STUDENT_ACHIEVEMENTS_CACHE_TTL_MS = 2 * 60 * 1000;

/* ── Frosted-glass tokens (exact rgba values from the design brief) ── */
const glass = {
  background: 'rgba(255, 255, 255, 0.6)',
  backdropFilter: 'blur(20px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
  border: '1px solid rgba(255, 255, 255, 0.7)',
  boxShadow: '0 8px 30px rgba(15, 23, 42, 0.06)',
};

/* ── Entrance animation — fade + slide up, staggered ── */
const listV = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } } };
const itemV = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

const isImageUrl = (url = '') => /\.(jpe?g|png|webp|gif|heic|heif)(\?|$)/i.test(String(url));

const formatDate = (value) => {
  if (!value) return 'N/A';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const CATEGORY_META = {
  Academic: { label: 'Academic', Icon: GraduationCap, tint: '#8b5cf6' },
  Sports: { label: 'Sports', Icon: Zap, tint: '#10b981' },
  'Extra-Curricular': { label: 'Extra-Curricular', Icon: Sparkles, tint: '#f59e0b' },
  Other: { label: 'Other', Icon: Award, tint: '#64748b' },
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

/* ------------------------------------------------------------------ */
/*  Primitives                                                         */
/* ------------------------------------------------------------------ */

const SoftIcon = ({ Icon, tint, size = 'md' }) => {
  const dim = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  const ic = size === 'lg' ? 20 : 18;
  return (
    <span
      className={`flex ${dim} shrink-0 items-center justify-center rounded-xl`}
      style={{ background: `${tint}1f`, color: tint }}
    >
      <Icon width={ic} height={ic} strokeWidth={2} />
    </span>
  );
};

const StatTile = ({ Icon, label, value, tint }) => (
  <Motion.div
    variants={itemV}
    whileHover={{ y: -2 }}
    transition={{ duration: 0.15, ease: 'easeOut' }}
    className="rounded-[24px] p-4"
    style={glass}
  >
    <SoftIcon Icon={Icon} tint={tint} />
    <p className="mt-3 truncate text-xl font-bold tracking-tight text-slate-900">{value}</p>
    <p className="text-[12px] font-medium text-slate-500">{label}</p>
  </Motion.div>
);

const EmptyState = ({ Icon = CircleSlash, title, hint }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-slate-300/80 bg-white/40 px-6 py-14 text-center">
    <Icon className="h-7 w-7 text-slate-300" strokeWidth={1.75} />
    <p className="text-sm font-semibold text-slate-500">{title}</p>
    {hint && <p className="max-w-xs text-xs text-slate-400">{hint}</p>}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Achievement card                                                   */
/* ------------------------------------------------------------------ */

const AchievementRow = ({ item, achievementId, highlighted }) => {
  const meta = getCategoryMeta(item?.category);
  const hasImage = item?.certificateUrl && isImageUrl(item.certificateUrl);
  return (
    <Motion.div
      id={`achievement-card-${achievementId}`}
      variants={itemV}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="rounded-[24px] p-4 sm:p-5"
      style={{
        ...glass,
        ...(highlighted ? { border: '1px solid rgba(139,92,246,0.5)', boxShadow: '0 0 0 3px rgba(139,92,246,0.18)' } : {}),
      }}
    >
      <div className="flex items-start gap-3.5">
        <SoftIcon Icon={meta.Icon} tint={meta.tint} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900 sm:text-[15px]" style={{ overflowWrap: 'anywhere' }}>
              {item?.title || 'Achievement'}
            </p>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: `${meta.tint}1f`, color: meta.tint }}
            >
              {meta.label}
            </span>
          </div>

          {item?.description && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500" style={{ overflowWrap: 'anywhere' }}>
              {item.description}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={12} strokeWidth={2} />
              {formatDate(item?.date)}
            </span>
            {item?.certificateUrl && (
              <a
                href={item.certificateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200/70 bg-violet-50/80 px-2.5 py-1 text-[11px] font-semibold text-violet-700 transition hover:-translate-y-px hover:bg-violet-100"
              >
                {hasImage ? <ExternalLink size={11} /> : <FileText size={11} />}
                View certificate
              </a>
            )}
          </div>

          {hasImage && (
            <a href={item.certificateUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block w-fit">
              <img
                src={item.certificateUrl}
                alt={`${item?.title || 'Achievement'} certificate`}
                loading="lazy"
                className="max-h-44 w-auto rounded-xl border border-white/70 object-contain shadow-sm transition hover:-translate-y-0.5"
              />
            </a>
          )}
        </div>
      </div>
    </Motion.div>
  );
};

/* ------------------------------------------------------------------ */
/*  View                                                               */
/* ------------------------------------------------------------------ */

const AchievementsView = () => {
  const location = useLocation();
  const [student, setStudent] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [systemBadges, setSystemBadges] = useState([]);
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

        const [achievementsRes, badgesRes] = await Promise.allSettled([
          fetchCachedJson(STUDENT_ACHIEVEMENTS_ENDPOINT, {
            ttlMs: STUDENT_ACHIEVEMENTS_CACHE_TTL_MS,
            fetchOptions: {
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            },
          }),
          fetch(`${API_BASE}/api/student/auth/system-badges`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => (r.ok ? r.json() : { data: [] })),
        ]);

        if (achievementsRes.status === 'fulfilled') {
          const { data } = achievementsRes.value;
          setStudent(data?.student || null);
          setAchievements(Array.isArray(data?.achievements) ? data.achievements : []);
        }
        if (badgesRes.status === 'fulfilled') {
          setSystemBadges(Array.isArray(badgesRes.value?.data) ? badgesRes.value.data : []);
        }
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
    [location.search],
  );

  useEffect(() => {
    if (!targetAchievementId || loading || filteredAchievements.length === 0) return;
    const foundIndex = filteredAchievements.findIndex(
      (item, idx) => resolveAchievementId(item, idx) === targetAchievementId,
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

  const studentLine = student?.name
    ? `${student.name}${student?.grade ? ` · ${student.grade}${student?.section ? `-${student.section}` : ''}` : ''}`
    : 'Every milestone you have earned, in one place';

  const STATS = [
    { Icon: Trophy, label: 'Total achievements', value: totalCount, tint: '#8b5cf6' },
    { Icon: Calendar, label: 'Latest', value: latestDate, tint: '#0ea5e9' },
    { Icon: Award, label: 'Top category', value: getCategoryMeta(topCategory).label || topCategory, tint: '#f59e0b' },
    { Icon: Sparkles, label: 'Badges earned', value: systemBadges.length, tint: '#10b981' },
  ];

  return (
    <div
      className="min-h-full p-4 sm:p-6"
      style={{ background: 'linear-gradient(180deg, #f5f7fb 0%, #eef2f9 100%)' }}
    >
      {/* decorative blurred colour blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.32), transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 right-0 h-80 w-80 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.24), transparent 70%)' }}
        />
      </div>

      <Motion.div
        variants={listV}
        initial="hidden"
        animate="show"
        className="relative mx-auto max-w-5xl space-y-5"
      >
        {/* ── Header ── */}
        <Motion.div variants={itemV} className="rounded-[24px] p-5 sm:p-6" style={glass}>
          <div className="flex items-center gap-3.5">
            <SoftIcon Icon={Trophy} tint="#8b5cf6" size="lg" />
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">My Achievements</h1>
              <p className="mt-0.5 truncate text-sm text-slate-500">{studentLine}</p>
            </div>
          </div>
        </Motion.div>

        {/* ── Stats ── */}
        <Motion.div variants={listV} className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          {STATS.map((s) => (
            <StatTile key={s.label} Icon={s.Icon} label={s.label} value={loading ? '—' : s.value} tint={s.tint} />
          ))}
        </Motion.div>

        {/* ── Earned badges ── */}
        {systemBadges.length > 0 && (
          <Motion.div variants={itemV} className="rounded-[24px] p-5" style={glass}>
            <div className="mb-3 flex items-center gap-2">
              <Medal size={16} className="text-emerald-600" strokeWidth={2} />
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Earned badges</h2>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {systemBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex items-center gap-2.5 rounded-xl border border-white/70 bg-white/55 px-3 py-2"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Medal size={15} strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{badge.label}</p>
                    {badge.description && <p className="text-[11px] text-slate-400">{badge.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Motion.div>
        )}

        {/* ── Filters ── */}
        <Motion.div variants={itemV} className="rounded-[24px] p-4 sm:p-5" style={glass}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Category</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                {CATEGORY_FILTERS.map((cat) => {
                  const active = categoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                        active
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'border border-slate-200 bg-white/60 text-slate-500 hover:bg-white'
                      }`}
                    >
                      {cat === 'all' ? 'All' : getCategoryMeta(cat).label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="achievement-session-filter"
                className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-400"
              >
                Session
              </label>
              <select
                id="achievement-session-filter"
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="w-full rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm font-medium text-slate-600 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 sm:w-auto"
              >
                <option value="all">All sessions</option>
                {sessionOptions.map((session) => (
                  <option key={session} value={session}>
                    {session}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Motion.div>

        {/* ── List ── */}
        <div className="space-y-3.5">
          {loading ? (
            <div className="rounded-[24px] p-10 text-center" style={glass}>
              <Loader2 size={20} className="mx-auto mb-2 animate-spin text-violet-500" />
              <p className="text-sm text-slate-400">Loading achievements…</p>
            </div>
          ) : error ? (
            <div className="rounded-[24px] border border-rose-200/70 bg-rose-50/70 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : achievements.length === 0 ? (
            <EmptyState
              Icon={Award}
              title="No achievements yet"
              hint="When a teacher records an achievement for you, it will appear here."
            />
          ) : filteredAchievements.length === 0 ? (
            <EmptyState Icon={CircleSlash} title="Nothing matches this filter" hint="Try a different category or session." />
          ) : (
            <>
              <p className="px-1 text-xs text-slate-400">
                Showing {pageAchievements.length} of {filteredAchievements.length} achievement
                {filteredAchievements.length !== 1 ? 's' : ''}
                {filteredAchievements.length !== totalCount ? ` (filtered from ${totalCount})` : ''}
              </p>

              <AnimatePresence mode="popLayout">
                <Motion.div key={`${categoryFilter}-${sessionFilter}-${page}`} variants={listV} initial="hidden" animate="show" className="space-y-3.5">
                  {pageAchievements.map((item, localIdx) => {
                    const globalIdx = (page - 1) * PAGE_SIZE + localIdx;
                    const achievementId = resolveAchievementId(item, globalIdx);
                    return (
                      <AchievementRow
                        key={achievementId}
                        item={item}
                        achievementId={achievementId}
                        highlighted={highlightedAchievementId === achievementId}
                      />
                    );
                  })}
                </Motion.div>
              </AnimatePresence>

              {filteredAchievements.length > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/70 bg-white/60 text-slate-500 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPage(i + 1)}
                      className={`h-8 min-w-8 rounded-xl px-2.5 text-xs font-semibold transition ${
                        page === i + 1
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'border border-white/70 bg-white/60 text-slate-500 hover:bg-white'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/70 bg-white/60 text-slate-500 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </Motion.div>
    </div>
  );
};

export default AchievementsView;
