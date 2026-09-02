import React, { useEffect, useMemo, useState } from 'react';
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
  UserRound,
  User,
  BookOpen,
  UserPlus,
  School,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiFetch } from '../utils/authSession';
import './Dashboard.css';

// ── Data layer ───────────────────────────────────────────────────────────────

const DASHBOARD_CACHE_PREFIX = 'admin_dashboard_cache_v1';
const CACHE_TTL = { stats: 2 * 60 * 1000, financial: 3 * 60 * 1000 };

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

const computeOutstanding = (invoice = {}) => {
  const total = Number(invoice.totalAmount || 0);
  const paid = Number(invoice.paidAmount || 0);
  const hasBalance = invoice.balanceAmount === 0 || invoice.balanceAmount;
  const balance = hasBalance ? Number(invoice.balanceAmount) : total - paid;
  return Number.isFinite(balance) ? Math.max(0, balance) : 0;
};

const getMonthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const buildFinancialState = (invoices = [], payments = [], months = 6) => {
  const buckets = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: getMonthKey(d), month: d.toLocaleString('default', { month: 'short' }), collected: 0, due: 0 });
  }
  const bucketMap = buckets.reduce((map, b) => map.set(b.key, b), new Map());

  payments.forEach((p) => {
    const ts = p.paidOn || p.createdAt;
    if (ts && bucketMap.has(getMonthKey(new Date(ts)))) {
      bucketMap.get(getMonthKey(new Date(ts))).collected += Number(p.amount || 0);
    }
  });
  invoices.forEach((inv) => {
    const ts = inv.dueDate || inv.createdAt;
    if (ts && bucketMap.has(getMonthKey(new Date(ts)))) {
      bucketMap.get(getMonthKey(new Date(ts))).due += computeOutstanding(inv);
    }
  });

  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totals = invoices.reduce(
    (acc, inv) => {
      const outstanding = computeOutstanding(inv);
      acc.totalOutstanding += outstanding;
      if (inv.dueDate && new Date(inv.dueDate) < new Date() && outstanding > 0) {
        acc.overdueAmount += outstanding;
      }
      return acc;
    },
    { totalOutstanding: 0, overdueAmount: 0 },
  );

  return {
    trend: buckets,
    totals: { totalCollected, totalOutstanding: totals.totalOutstanding, overdueAmount: totals.overdueAmount },
  };
};

// ── Presentational ───────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon, sub, color, delay, loading }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: 'easeOut' }}
    whileHover={{ y: -4, transition: { duration: 0.15 } }}
    className="glass-card p-5 flex flex-col"
  >
    <div className="flex items-center justify-between mb-2">
      <span className="stat-label">{label}</span>
      <span className="opacity-60" style={{ color }} aria-hidden="true">
        {icon}
      </span>
    </div>
    {loading ? (
      <span className="stat-skeleton" aria-hidden="true" />
    ) : (
      <span className="stat-number">{value}</span>
    )}
    <div className="flex items-center gap-1.5 mt-1.5">
      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
        {loading ? '—' : sub}
      </span>
      <span className="text-[10px] text-slate-400">last 30 days</span>
    </div>
  </motion.div>
);

const QuickAction = ({ label, icon, color, onClick }) => (
  <Button
    variant="ghost"
    onClick={onClick}
    className={cn(
      'quick-action-btn w-full justify-start',
      'bg-white/30 backdrop-blur-sm border border-white/30 rounded-full',
      'hover:bg-white/60 hover:border-white/60 transition-all',
      'text-slate-700 font-medium text-sm px-4 py-2 h-auto',
    )}
  >
    <span className="icon" style={{ color }} aria-hidden="true">
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
        const [invoiceRes, paymentRes] = await Promise.all([
          apiFetch(`${import.meta.env.VITE_API_URL}/api/fees/invoices`, { headers }, navigate),
          apiFetch(`${import.meta.env.VITE_API_URL}/api/fees/payments`, { headers }, navigate),
        ]);
        const invoices = await invoiceRes.json().catch(() => []);
        const payments = await paymentRes.json().catch(() => []);
        if (!invoiceRes.ok) throw new Error('Failed to load invoices');
        if (!paymentRes.ok) throw new Error('Failed to load payments');
        if (cancelled) return;
        const next = buildFinancialState(
          Array.isArray(invoices) ? invoices : [],
          Array.isArray(payments) ? payments : [],
        );
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
        value: (stats?.students?.total ?? 0).toLocaleString('en-IN'),
        sub: `+${stats?.students?.recent ?? 0} new`,
        icon: <Users size={24} strokeWidth={2} />,
        color: '#8b5cf6',
        delay: 0.05,
      },
      {
        label: 'Teachers',
        value: (stats?.teachers?.total ?? 0).toLocaleString('en-IN'),
        sub: `+${stats?.teachers?.recent ?? 0} new`,
        icon: <GraduationCap size={24} strokeWidth={2} />,
        color: '#60a5fa',
        delay: 0.1,
      },
      {
        label: 'Parents',
        value: (stats?.parents?.total ?? 0).toLocaleString('en-IN'),
        sub: `+${stats?.parents?.recent ?? 0} new`,
        icon: <UserRound size={24} strokeWidth={2} />,
        color: '#a78bfa',
        delay: 0.15,
      },
      {
        label: 'All Users',
        value: (stats?.totalUsers ?? 0).toLocaleString('en-IN'),
        sub: `+${stats?.recentTotal ?? 0} new`,
        icon: <User size={24} strokeWidth={2} />,
        color: '#10b981',
        delay: 0.2,
      },
    ],
    [stats],
  );

  const quickActions = [
    { label: 'Academic Setup', icon: <BookOpen size={16} strokeWidth={2} />, color: '#8b5cf6', path: '/admin/academics' },
    { label: 'Add Student', icon: <UserPlus size={16} strokeWidth={2} />, color: '#60a5fa', path: '/admin/students' },
    { label: 'Add Teacher', icon: <School size={16} strokeWidth={2} />, color: '#10b981', path: '/admin/teachers' },
  ];

  const chartData = financial?.trend ?? [];
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
      className="admin-dashboard-root min-h-screen p-6 md:p-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Header ── */}
        <motion.div variants={itemVariants} className="glass rounded-[24px] p-6 md:p-8 glass-hover">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
                {greeting}, Admin
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Here&apos;s what&apos;s happening across your school this week.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white/30 px-3 py-1.5 rounded-full border border-white/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </div>
              <span className="text-xs text-slate-400">
                {statsLoading || financialLoading ? 'Updating…' : 'Updated just now'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <StatCard key={stat.label} {...stat} loading={statsLoading} />
          ))}
        </div>

        {/* ── Fees + Quick Actions ── */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Fees Collection */}
          <div className="lg:col-span-2 glass-card p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="section-title">Fees Collection</h3>
                <p className="section-subtitle">Revenue trend — last 6 months</p>
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

            <div className="h-[220px] w-full">
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
                    <Bar dataKey="collected" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="due" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200/50">
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Collected</p>
                <p className="text-sm font-semibold text-slate-900">
                  {financialLoading ? '—' : formatCurrency(totals.totalCollected)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Outstanding</p>
                <p className="text-sm font-semibold text-amber-600">
                  {financialLoading ? '—' : formatCurrency(totals.totalOutstanding)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Overdue</p>
                <p className="text-sm font-semibold text-rose-500">
                  {financialLoading ? '—' : formatCurrency(totals.overdueAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-card p-5 md:p-6 flex flex-col">
            <div className="mb-4">
              <h3 className="section-title">Quick Actions</h3>
              <p className="section-subtitle">Common admin tasks</p>
            </div>
            <div className="flex-1 flex flex-col gap-2.5">
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
            <div className="mt-4 pt-4 border-t border-slate-200/50">
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
        <motion.div variants={itemVariants} className="text-center text-xs text-slate-400 py-2">
          © {new Date().getFullYear()} School Admin · All rights reserved
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
