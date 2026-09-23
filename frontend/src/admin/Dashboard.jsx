import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  GraduationCap,
  BookOpen,
  UserPlus,
  School,
  Info,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Wallet,
  Receipt,
  Megaphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiFetch } from '../utils/authSession';
import './Dashboard.css';

// ── Data layer ───────────────────────────────────────────────────────────────

const DASHBOARD_CACHE_PREFIX = 'admin_dashboard_cache_v2'; // v2: fees scoped to active year
const CACHE_TTL = { stats: 2 * 60 * 1000, financial: 5 * 60 * 1000 };

const getCacheStorage = () => {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

const getTokenScope = () => {
  const token = localStorage.getItem('token');
  if (!token) return 'anonymous';
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    );
    return `${payload?.id || 'unknown'}_${payload?.schoolId || 'school'}_${payload?.campusId || 'campus'}`;
  } catch {
    return 'fallback';
  }
};

const cacheKey = (segment) => `${DASHBOARD_CACHE_PREFIX}:${segment}:${getTokenScope()}`;

const readCache = (key, ttlMs) => {
  const storage = getCacheStorage();
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(key) || 'null');
    const cachedAt = Number(parsed?.cachedAt || 0);
    if (!cachedAt || Date.now() - cachedAt > ttlMs) {
      storage.removeItem(key);
      return null;
    }
    return parsed?.data ?? null;
  } catch {
    return null;
  }
};

const writeCache = (key, data) => {
  const storage = getCacheStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {
    /* quota / private mode — ignore */
  }
};

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

// Indian short scale for chart axis labels (₹5k, ₹1.2L, ₹3.4Cr).
const formatCompactINR = (value = 0) => {
  const n = Number(value) || 0;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1)}k`;
  return `₹${n}`;
};

// ── Presentational ───────────────────────────────────────────────────────────

// Counts up from 0 to `target` over `duration` ms whenever `target` changes
// (an ease-out curve so it settles rather than ticking at a constant rate).
const useCountUp = (target, duration = 900) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const end = Number(target) || 0;
    if (end <= 0) {
      setValue(0);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(end * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
};

// Stat card: tinted icon tile, label + big count, arrow link, "+N vs last 30
// days" pill, optional footnote and a soft decorative wave in the corner.
const StatCard = ({ label, value, icon, recent, color, tint, delay, loading, note, info, onOpen }) => {
  const animatedValue = useCountUp(loading ? 0 : value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.05)] flex flex-col"
    >
      <svg
        className="pointer-events-none absolute -bottom-2 right-0 h-20 w-3/5"
        viewBox="0 0 200 80"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0,80 C60,78 70,40 120,30 C160,22 180,8 200,0 L200,80 Z" fill={tint} opacity="0.55" />
      </svg>

      <div className="relative flex items-start gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ color, background: tint }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            {label}
            {info ? (
              <span title={info} className="text-slate-400">
                <Info size={14} />
              </span>
            ) : null}
          </p>
          <p className="text-2xl font-bold leading-tight text-slate-900 tabular-nums">
            {loading ? '—' : animatedValue.toLocaleString('en-IN')}
          </p>
        </div>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
            aria-label={`Open ${label}`}
          >
            <ArrowRight size={16} />
          </button>
        ) : null}
      </div>

      <div className="relative mt-2.5 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
          <ArrowUp size={12} strokeWidth={2.5} />
          {loading ? '—' : `+${Number(recent || 0).toLocaleString('en-IN')}`}
        </span>
        <span className="text-xs text-slate-400">vs last 30 days</span>
      </div>
      {note ? <p className="relative mt-1.5 text-[11px] leading-snug text-slate-500">{note}</p> : null}
    </motion.div>
  );
};

// Small inline school illustration for the greeting banner.
const SchoolIllustration = () => (
  <svg viewBox="0 0 260 110" className="h-full w-auto" aria-hidden="true">
    <ellipse cx="45" cy="18" rx="16" ry="7" fill="#e2e8f0" />
    <ellipse cx="215" cy="16" rx="18" ry="7" fill="#e2e8f0" />
    <g fill="#a7e3cf">
      <ellipse cx="22" cy="62" rx="14" ry="26" />
      <ellipse cx="60" cy="76" rx="10" ry="18" />
      <ellipse cx="232" cy="80" rx="8" ry="15" />
    </g>
    <g stroke="#94a3b8" strokeWidth="1.5">
      <line x1="22" y1="70" x2="22" y2="108" />
      <line x1="60" y1="82" x2="60" y2="108" />
      <line x1="232" y1="86" x2="232" y2="108" />
    </g>
    <rect x="80" y="52" width="130" height="56" rx="2" fill="#dbe4fb" />
    <polygon points="72,54 145,54 145,42 90,42" fill="#b9c8f3" />
    <polygon points="145,54 218,54 200,42 145,42" fill="#b9c8f3" />
    <rect x="120" y="30" width="50" height="78" fill="#e4ebfd" />
    <polygon points="112,34 145,10 178,34" fill="#b9c8f3" />
    <line x1="145" y1="10" x2="145" y2="0" stroke="#94a3b8" strokeWidth="1.5" />
    <polygon points="145,0 158,3 145,6" fill="#b9c8f3" />
    <circle cx="145" cy="40" r="6" fill="#fff" stroke="#b9c8f3" strokeWidth="1.5" />
    <path d="M136,108 v-16 a9,9 0 0 1 18,0 v16 z" fill="#b9c8f3" />
    <g fill="#fff">
      {[88, 100, 184, 196].map((x) => (
        <g key={x}>
          <rect x={x} y="62" width="8" height="8" rx="1" />
          <rect x={x} y="78" width="8" height="8" rx="1" />
        </g>
      ))}
      <rect x="128" y="54" width="8" height="8" rx="1" />
      <rect x="154" y="54" width="8" height="8" rx="1" />
    </g>
  </svg>
);

// Grid tile: tinted icon badge on top, label underneath.
const QuickAction = ({ label, icon, color, onClick }) => (
  <Button
    variant="ghost"
    onClick={onClick}
    className={cn(
      'h-auto w-full flex-col items-center justify-center gap-2 lg:gap-1.5 whitespace-normal',
      'bg-white/30 backdrop-blur-sm border border-white/40 rounded-2xl',
      'hover:bg-white/70 hover:border-white/70 hover:-translate-y-0.5 transition-all',
      'text-slate-700 font-medium text-xs sm:text-sm px-2 py-4 lg:py-1.5 text-center leading-tight',
    )}
  >
    <span
      className="flex h-10 w-10 lg:h-8 lg:w-8 shrink-0 items-center justify-center rounded-xl"
      style={{ color, background: `${color}1a` }}
      aria-hidden="true"
    >
      {icon}
    </span>
    {label}
  </Button>
);

// ── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard = ({ setShowAdminHeader }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(() => readCache(cacheKey('stats'), CACHE_TTL.stats));
  const [statsLoading, setStatsLoading] = useState(() => !readCache(cacheKey('stats'), CACHE_TTL.stats));
  const [financial, setFinancial] = useState(() => readCache(cacheKey('financial'), CACHE_TTL.financial));
  const [financialLoading, setFinancialLoading] = useState(
    () => !readCache(cacheKey('financial'), CACHE_TTL.financial),
  );

  useEffect(() => {
    setShowAdminHeader?.(true);
  }, [setShowAdminHeader]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(
          `${import.meta.env.VITE_API_URL}/api/admin/users/dashboard-stats`,
          { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } },
          navigate,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load stats');
        if (cancelled) return;
        setStats(data);
        writeCache(cacheKey('stats'), data);
      } catch {
        /* keep cached values if we have them */
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = { authorization: `Bearer ${localStorage.getItem('token')}` };
        // Same endpoint the Fees Dashboard uses, so both pages report identical
        // collected / outstanding / overdue figures.
        const res = await apiFetch(`${import.meta.env.VITE_API_URL}/api/fees/admin/summary?activeYear=1`, { headers }, navigate);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load fee summary');
        if (cancelled) return;
        const next = {
          trend: Array.isArray(data?.monthlyTrend) ? data.monthlyTrend : [],
          activeYearName: data?.academicYearName || '',
          totals: {
            totalCollected: Number(data?.totals?.totalCollected || 0),
            totalOutstanding: Number(data?.totals?.totalOutstanding || 0),
            overdueAmount: Number(data?.totals?.overdueAmount || 0),
          },
        };
        setFinancial(next);
        writeCache(cacheKey('financial'), next);
      } catch {
        if (!cancelled && !financial) {
          setFinancial({ trend: [], totals: { totalCollected: 0, totalOutstanding: 0, overdueAmount: 0 } });
        }
      } finally {
        if (!cancelled) setFinancialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const statCards = useMemo(
    () => [
      {
        label: 'Students',
        value: stats?.students?.total ?? 0,
        recent: stats?.students?.recent ?? 0,
        icon: <Users size={24} strokeWidth={2} />,
        color: '#2563eb',
        tint: '#e8f0fe',
        path: '/admin/students',
        delay: 0.05,
      },
      {
        label: 'Teachers',
        value: stats?.teachers?.total ?? 0,
        recent: stats?.teachers?.recent ?? 0,
        icon: <GraduationCap size={24} strokeWidth={2} />,
        color: '#7c3aed',
        tint: '#f1ebfe',
        path: '/admin/teachers',
        delay: 0.1,
      },
      {
        label: 'Parents',
        value: stats?.parents?.total ?? 0,
        recent: stats?.parents?.recent ?? 0,
        icon: <Users size={24} strokeWidth={2} />,
        color: '#059669',
        tint: '#e3f7ee',
        path: '/admin/parents',
        delay: 0.15,
      },
      {
        label: 'All Users',
        value: stats?.totalUsers ?? 0,
        recent: stats?.recentTotal ?? 0,
        icon: <Users size={24} strokeWidth={2} />,
        color: '#ea580c',
        tint: '#fdeee2',
        path: '/admin/analytics',
        info: 'Students, teachers, parents and school admins',
        // note: 'Includes students, teachers, parents and school admins',
        delay: 0.2,
      },
    ],
    [stats],
  );

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const quickActions = [
    { label: 'Academic Setup', icon: <BookOpen size={18} strokeWidth={2} />, color: '#8b5cf6', path: '/admin/academics' },
    { label: 'Add Student', icon: <UserPlus size={18} strokeWidth={2} />, color: '#60a5fa', path: '/admin/students' },
    { label: 'Add Teacher', icon: <School size={18} strokeWidth={2} />, color: '#10b981', path: '/admin/teachers' },
    { label: 'Collect Fees', icon: <Wallet size={18} strokeWidth={2} />, color: '#f59e0b', path: '/admin/fees/collection?view=payments' },
    { label: 'Fee Receipts', icon: <Receipt size={18} strokeWidth={2} />, color: '#f43f5e', path: '/admin/fees/receipts' },
    { label: 'Post Notice', icon: <Megaphone size={18} strokeWidth={2} />, color: '#0ea5e9', path: '/admin/notices/post' },
  ];

  const chartData = financial?.trend ?? [];
  const activeYearLabel = financial?.activeYearName || '';

  // Quick-actions horizontal scroller (lg+): arrow state + page-by-page scroll.
  const qaScrollRef = useRef(null);
  const [qaScroll, setQaScroll] = useState({ canLeft: false, canRight: false });
  const updateQaScroll = useCallback(() => {
    const el = qaScrollRef.current;
    if (!el) return;
    setQaScroll({
      canLeft: el.scrollLeft > 2,
      canRight: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);
  useEffect(() => {
    updateQaScroll();
    window.addEventListener('resize', updateQaScroll);
    return () => window.removeEventListener('resize', updateQaScroll);
  }, [updateQaScroll]);
  const scrollQuickActions = (dir) => {
    const el = qaScrollRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.6), behavior: 'smooth' });
  };
  const totals = financial?.totals ?? { totalCollected: 0, totalOutstanding: 0, overdueAmount: 0 };
  const hasChartData = chartData.some((d) => d.collected > 0 || d.due > 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  return (
    <motion.div
      className="admin-dashboard-root min-h-screen p-4 md:p-6 lg:min-h-0 lg:h-[calc(100dvh-94px)] lg:overflow-hidden lg:p-5"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-4 lg:h-full lg:flex lg:flex-col">
        {/* ── Header ── */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-r from-white via-slate-50 to-indigo-50/70 px-4 py-2.5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] lg:shrink-0"
        >
          <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-1.5 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
                {greeting}, <span className="text-blue-600">Admin</span>
                {/* <span className="inline-block origin-[70%_70%] animate-[wave_2.4s_ease-in-out_infinite]" aria-hidden="true">👋</span> */}
              </h1>
              <p className="mt-0.5 text-xs text-slate-500 md:text-sm">
                Here&apos;s what&apos;s happening across your school this week.
              </p>
            </div>

            <div className="flex items-center gap-2.5 md:border-l md:border-slate-200 md:pl-5">
              <CalendarDays size={22} className="shrink-0 text-slate-500" />
              <div>
                <p className="text-sm font-semibold text-slate-800">{todayLabel}</p>
                {activeYearLabel ? <p className="text-xs text-slate-500">Academic Year {activeYearLabel}</p> : null}
              </div>
            </div>

            <div className="hidden h-12 flex-1 justify-end opacity-90 xl:flex">
              <SchoolIllustration />
            </div>

            <div className="flex flex-col items-start gap-0.5 md:ml-auto md:items-end">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
              <span className="text-xs text-slate-500">
                {statsLoading || financialLoading ? 'Updating…' : 'Updated just now'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:shrink-0">
          {statCards.map((stat) => (
            <StatCard key={stat.label} {...stat} loading={statsLoading} onOpen={() => navigate(stat.path)} />
          ))}
        </div>

        {/* ── Fees + Quick Actions ── */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-4 lg:flex-1 lg:min-h-0">
          {/* Fees Collection */}
          <div className="lg:col-span-2 glass-card p-5 md:p-6 lg:p-5 lg:flex lg:flex-col lg:min-h-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="section-title">Fees Collection</h3>
                <p className="section-subtitle">{activeYearLabel ? `${activeYearLabel} · ` : ''}Current students · collected vs. outstanding — last 6 months</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="legend-dot" style={{ background: '#8b5cf6' }} />
                  <span className="text-slate-500">Collected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="legend-dot" style={{ background: '#f59e0b' }} />
                  <span className="text-slate-500">Due</span>
                </div>
              </div>
            </div>

            <div className="h-[220px] w-full lg:h-auto lg:flex-1 lg:min-h-[120px]">
              {financialLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  Loading chart…
                </div>
              ) : !hasChartData ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  No fee activity in the last 6 months.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                      tickFormatter={formatCompactINR}
                      width={56}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                      contentStyle={{
                        background: 'rgba(255,255,255,0.9)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.6)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                        padding: '8px 12px',
                        fontSize: '12px',
                      }}
                      formatter={(value, name) => [
                        formatCurrency(value),
                        name === 'collected' ? 'Collected' : 'Due',
                      ]}
                    />
                    <Bar dataKey="collected" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="due" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-200/50">
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Collected</p>
                <p className="text-sm font-semibold text-slate-900">
                  {financialLoading ? '—' : formatCurrency(totals.totalCollected)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Due</p>
                <p className="text-sm font-semibold text-amber-600">
                  {financialLoading ? '—' : formatCurrency(totals.totalOutstanding)}
                </p>
              </div>
            </div>

          </div>

          {/* Quick Actions — tiles on mobile/tablet; horizontally scrolling chips (with arrows) on lg+ */}
          <div className="glass-card p-5 md:p-6 lg:p-4 flex flex-col lg:min-h-0 lg:overflow-hidden">
            <div className="mb-4 lg:mb-3 lg:shrink-0">
              <h3 className="section-title">Quick Actions</h3>
              <p className="section-subtitle">Common admin tasks</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 lg:hidden">
              {quickActions.map((action) => (
                <QuickAction
                  key={action.label}
                  label={action.label}
                  icon={action.icon}
                  color={action.color}
                  onClick={() => navigate(action.path)}
                />
              ))}
            </div>
            <div className="relative hidden lg:flex lg:flex-1 lg:min-h-0 lg:items-center">
              {qaScroll.canLeft && (
                <button
                  type="button"
                  onClick={() => scrollQuickActions(-1)}
                  className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:bg-white/30"
                  aria-label="Scroll quick actions left"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <div
                ref={qaScrollRef}
                onScroll={updateQaScroll}
                className="qa-scroll grid w-full grid-flow-col grid-rows-3 auto-cols-max content-center gap-2 overflow-x-auto scroll-smooth px-1 py-1"
              >
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => navigate(action.path)}
                    className="group inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-white/30 hover:text-black"
                  >
                    <span style={{ color: action.color }} className="flex" aria-hidden="true">
                      {React.cloneElement(action.icon, { size: 15 })}
                    </span>
                    {action.label}
                  </button>
                ))}
              </div>
              {qaScroll.canRight && (
                <button
                  type="button"
                  onClick={() => scrollQuickActions(1)}
                  className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:bg-slate-50"
                  aria-label="Scroll quick actions right"
                >
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
            <div className="mt-4 pt-4 lg:mt-3 lg:pt-2.5 lg:shrink-0 border-t border-slate-200/50">
              <p className="text-[10px] text-slate-400 text-center">
                Need help?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/admin/support')}
                  className="text-slate-300 font-medium hover:text-slate-300"
                >
                  Contact support
                </button>
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Footer ── */}
      </div>
    </motion.div>
  );
};

export default Dashboard;
