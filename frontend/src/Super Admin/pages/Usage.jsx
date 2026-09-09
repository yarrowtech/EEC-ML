import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  Building2,
  CalendarClock,
  ChevronRight,
  CircleSlash,
  GraduationCap,
  MoonStar,
  Presentation,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  UserX,
  Users,
  X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const authHeaders = () => ({
  'Content-Type': 'application/json',
  authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

/* Frosted-glass surface tokens (kept inline so the exact rgba values
   from the design brief survive Tailwind's utility rounding). */
const glass = {
  background: 'rgba(255, 255, 255, 0.6)',
  backdropFilter: 'blur(20px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
  border: '1px solid rgba(255, 255, 255, 0.7)',
  boxShadow: '0 8px 30px rgba(15, 23, 42, 0.06)',
};
const glassStrong = {
  ...glass,
  background: 'rgba(255, 255, 255, 0.74)',
  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.14)',
};

/* Entrance animation — fade + slide up, staggered. */
const listV = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.03 } },
};
const itemV = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

const ROLE_META = {
  student: { label: 'Students', Icon: GraduationCap, tint: '#8b5cf6' },
  teacher: { label: 'Teachers', Icon: Presentation, tint: '#0ea5e9' },
  parent: { label: 'Parents', Icon: Users, tint: '#10b981' },
  staff: { label: 'Staff', Icon: UserCog, tint: '#f59e0b' },
  principal: { label: 'Principals', Icon: ShieldCheck, tint: '#f43f5e' },
  admin: { label: 'Admins', Icon: ShieldCheck, tint: '#6366f1' },
};

const HEALTH = {
  active: { label: 'Active', fg: '#047857', bg: 'rgba(16, 185, 129, 0.12)', dot: '#10b981' },
  low: { label: 'Low usage', fg: '#b45309', bg: 'rgba(245, 158, 11, 0.14)', dot: '#f59e0b' },
  dormant: { label: 'Dormant', fg: '#be123c', bg: 'rgba(244, 63, 94, 0.12)', dot: '#f43f5e' },
  never: { label: 'Never used', fg: '#475569', bg: 'rgba(148, 163, 184, 0.16)', dot: '#94a3b8' },
};

const HEALTH_ORDER = { active: 0, low: 1, dormant: 2, never: 3 };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fmt = (n) => (Number.isFinite(n) ? n : 0).toLocaleString();

const relTime = (value) => {
  if (!value) return 'Never';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 45) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
};

const deriveHealth = (school) => {
  if (school.health && HEALTH[school.health]) return school.health;
  if (!school.lastActivityAt) return 'never';
  if ((school.active7d || 0) > 0) return 'active';
  if ((school.active30d || 0) > 0) return 'low';
  return 'dormant';
};

const schoolLogo = (school) =>
  school?.logo?.secure_url ||
  school?.logo?.url ||
  (typeof school?.logo === 'string' ? school.logo : '') ||
  school?.logoUrl ||
  '';

/* ------------------------------------------------------------------ */
/*  Primitives                                                         */
/* ------------------------------------------------------------------ */

const GlassCard = ({ as = motion.div, className = '', style, children, ...rest }) => {
  const Comp = as;
  return (
    <Comp className={`rounded-[24px] ${className}`} style={{ ...glass, ...style }} {...rest}>
      {children}
    </Comp>
  );
};

const SoftIcon = ({ Icon, tint }) => (
  <span
    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
    style={{ background: `${tint}1f`, color: tint }}
  >
    <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
  </span>
);

const HealthBadge = ({ health }) => {
  const meta = HEALTH[health] || HEALTH.never;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: meta.bg, color: meta.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
};

const StatusPill = ({ status }) => {
  const inactive = String(status || '').toLowerCase() === 'inactive';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={
        inactive
          ? { background: 'rgba(244,63,94,0.1)', color: '#be123c' }
          : { background: 'rgba(16,185,129,0.1)', color: '#047857' }
      }
    >
      {inactive ? 'Inactive' : 'Active'}
    </span>
  );
};

const SchoolAvatar = ({ school, size = 44 }) => {
  const [broken, setBroken] = useState(false);
  const logo = schoolLogo(school);
  const letter = (school?.name || '?').trim().charAt(0).toUpperCase();
  if (logo && !broken) {
    return (
      <img
        src={logo}
        alt=""
        onError={() => setBroken(true)}
        className="shrink-0 rounded-xl border border-white/70 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl border border-white/70 text-sm font-bold"
      style={{ width: size, height: size, background: 'rgba(139,92,246,0.14)', color: '#7c3aed' }}
    >
      {letter}
    </span>
  );
};

const EmptyState = ({ Icon = CircleSlash, title, hint }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300/80 bg-white/40 px-6 py-12 text-center">
    <Icon className="h-7 w-7 text-slate-300" strokeWidth={1.75} />
    <p className="text-sm font-semibold text-slate-500">{title}</p>
    {hint && <p className="max-w-xs text-xs text-slate-400">{hint}</p>}
  </div>
);

const Meter = ({ value, total, tint }) => {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
      <motion.div
        className="h-full rounded-full"
        style={{ background: tint }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  KPI strip                                                          */
/* ------------------------------------------------------------------ */

const Kpi = ({ Icon, tint, label, value, sub }) => (
  <GlassCard
    variants={itemV}
    whileHover={{ y: -2 }}
    transition={{ duration: 0.15, ease: 'easeOut' }}
    className="p-4"
  >
    <div className="flex items-start justify-between">
      <SoftIcon Icon={Icon} tint={tint} />
      <ArrowUpRight className="h-4 w-4 text-slate-300" />
    </div>
    <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
    <p className="text-[13px] font-medium text-slate-500">{label}</p>
    {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
  </GlassCard>
);

/* ------------------------------------------------------------------ */
/*  School row                                                         */
/* ------------------------------------------------------------------ */

const MiniStat = ({ label, value }) => (
  <div className="text-center">
    <p className="text-sm font-bold text-slate-800">{value}</p>
    <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
  </div>
);

const SchoolRow = ({ school, onOpen }) => {
  const health = deriveHealth(school);
  return (
    <GlassCard
      as={motion.button}
      variants={itemV}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      onClick={() => onOpen(school)}
      className="flex w-full items-center gap-4 p-4 text-left"
    >
      <SchoolAvatar school={school} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{school.name || 'Untitled school'}</p>
          <StatusPill status={school.status} />
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {fmt(school.totalUsers)} users · last activity {relTime(school.lastActivityAt)}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-6 sm:flex">
        <MiniStat label="24h" value={fmt(school.active24h)} />
        <MiniStat label="7 days" value={fmt(school.active7d)} />
        <MiniStat label="30 days" value={fmt(school.active30d)} />
      </div>
      <HealthBadge health={health} />
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
    </GlassCard>
  );
};

/* ------------------------------------------------------------------ */
/*  School detail modal                                                */
/* ------------------------------------------------------------------ */

const ACTIVITY_FILTERS = [
  { value: 'all', label: 'Everyone' },
  { value: 'active', label: 'Active (30d)' },
  { value: 'dormant', label: 'Dormant' },
  { value: 'never', label: 'Never active' },
];

const Pager = ({ page, pageSize, total, onPage }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between px-1 pt-3 text-xs text-slate-500">
      <span>
        {from}–{to} of {fmt(total)}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1 font-medium text-slate-600 transition hover:bg-white disabled:opacity-40"
        >
          Prev
        </button>
        <span className="tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1 font-medium text-slate-600 transition hover:bg-white disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
};

const RoleBreakdownRow = ({ row }) => {
  const meta = ROLE_META[row.role] || { label: row.role, Icon: Users, tint: '#64748b' };
  return (
    <div className="flex items-center gap-3 py-2.5">
      <SoftIcon Icon={meta.Icon} tint={meta.tint} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-slate-700">{meta.label}</p>
          <p className="text-xs text-slate-400">
            <span className="font-semibold text-slate-600">{fmt(row.active30d)}</span> / {fmt(row.total)} active
          </p>
        </div>
        <div className="mt-1.5">
          <Meter value={row.active30d || 0} total={row.total || 0} tint={meta.tint} />
        </div>
      </div>
    </div>
  );
};

const PersonRow = ({ person }) => {
  const meta = ROLE_META[person.role] || { label: person.role, Icon: Users, tint: '#64748b' };
  const ever = person.lastActiveAt || person.lastLoginAt;
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/60">
      <SSoftDot tint={meta.tint} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{person.name || person.identifier || 'Unnamed'}</p>
        <p className="truncate text-[11px] text-slate-400">
          {meta.label}
          {person.identifier ? ` · ${person.identifier}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-medium text-slate-600">{relTime(person.lastActiveAt)}</p>
        <p className="text-[10px] text-slate-400">
          {ever ? `login ${relTime(person.lastLoginAt)}` : 'never signed in'}
        </p>
      </div>
    </div>
  );
};

const SSoftDot = ({ tint }) => (
  <span className="h-8 w-8 shrink-0 rounded-lg" style={{ background: `${tint}1f` }}>
    <span className="mx-auto mt-[13px] block h-1.5 w-1.5 rounded-full" style={{ background: tint }} />
  </span>
);

const SchoolDetailModal = ({ school, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [role, setRole] = useState('all');
  const [activity, setActivity] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const debounceRef = useRef(null);

  const schoolId = school?.schoolId || school?._id || school?.id;

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        role,
        activity,
        q: query.trim(),
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(
        `${API_BASE}/api/super-admin/usage/schools/${schoolId}?${params.toString()}`,
        { headers: authHeaders() },
      );
      if (!res.ok) throw new Error('Unable to load this school’s usage');
      setDetail(await res.json());
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [schoolId, role, activity, query, page]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, query ? 300 : 0);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [load, query]);

  useEffect(() => {
    setPage(1);
  }, [role, activity, query]);

  const summary = detail?.summary || {};
  const byRole = detail?.byRole || [];
  const admins = detail?.admins || [];
  const users = detail?.users || { items: [], total: 0 };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      style={{ background: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(4px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-4xl overflow-hidden rounded-[24px]"
        style={glassStrong}
      >
        {/* header */}
        <div className="flex items-center gap-4 border-b border-white/60 px-6 py-5">
          <SchoolAvatar school={school} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-bold text-slate-900">{school?.name || 'School'}</h3>
              <StatusPill status={school?.status} />
            </div>
            <p className="text-xs text-slate-400">
              Last activity {relTime(summary.lastActivityAt || school?.lastActivityAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/70 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* summary strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total users', value: fmt(summary.totalUsers) },
              { label: 'Active · 24h', value: fmt(summary.active24h) },
              { label: 'Active · 7d', value: fmt(summary.active7d) },
              { label: 'Active · 30d', value: fmt(summary.active30d) },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/70 bg-white/50 px-3 py-2.5">
                <p className="text-lg font-bold text-slate-900">{loading ? '—' : s.value}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* role breakdown */}
            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">By role</h4>
              {byRole.length === 0 && !loading ? (
                <EmptyState Icon={Users} title="No role data yet" hint="Activity is recorded as people use the portal." />
              ) : (
                <div className="divide-y divide-white/60">
                  {byRole.map((row) => (
                    <RoleBreakdownRow key={row.role} row={row} />
                  ))}
                </div>
              )}
            </section>

            {/* admin accounts */}
            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Admin accounts</h4>
              {admins.length === 0 && !loading ? (
                <EmptyState Icon={ShieldCheck} title="No admin accounts" />
              ) : (
                <div className="space-y-2">
                  {admins.map((admin) => (
                    <div key={admin.id || admin.username} className="rounded-xl border border-white/70 bg-white/50 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {admin.name || admin.username || 'Admin'}
                        </p>
                        <StatusPill status={admin.status} />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="truncate">{admin.campusName || admin.email || admin.username}</span>
                        <span className="shrink-0">
                          active {relTime(admin.lastActiveAt)} · login {relTime(admin.lastLoginAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* user directory */}
          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">User directory</h4>
              <div className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/60 px-3 py-1.5">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search users…"
                  className="w-40 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {['all', ...Object.keys(ROLE_META)].map((r) => (
                <Chip key={r} active={role === r} onClick={() => setRole(r)}>
                  {r === 'all' ? 'All roles' : ROLE_META[r].label}
                </Chip>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {ACTIVITY_FILTERS.map((f) => (
                <Chip key={f.value} active={activity === f.value} onClick={() => setActivity(f.value)} subtle>
                  {f.label}
                </Chip>
              ))}
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/40 p-1.5">
              {loading ? (
                <div className="space-y-1.5 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-11 animate-pulse rounded-xl bg-white/60" />
                  ))}
                </div>
              ) : users.items.length === 0 ? (
                <EmptyState Icon={UserX} title="No users match" hint="Try a different role or activity filter." />
              ) : (
                <div className="divide-y divide-white/50">
                  {users.items.map((person) => (
                    <PersonRow key={person.id || person.identifier} person={person} />
                  ))}
                </div>
              )}
            </div>
            <Pager page={page} pageSize={pageSize} total={users.total || 0} onPage={setPage} />
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Chip = ({ active, subtle, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
      active
        ? subtle
          ? 'bg-slate-900 text-white'
          : 'bg-violet-600 text-white shadow-sm'
        : 'border border-slate-200 bg-white/60 text-slate-500 hover:bg-white'
    }`}
  >
    {children}
  </button>
);

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const SORTS = [
  { value: 'recent', label: 'Recent activity' },
  { value: 'active7d', label: 'Most active (7d)' },
  { value: 'users', label: 'Most users' },
  { value: 'name', label: 'Name' },
  { value: 'health', label: 'Needs attention' },
];

export default function Usage() {
  const [overview, setOverview] = useState(null);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ovRes, schRes] = await Promise.all([
        fetch(`${API_BASE}/api/super-admin/usage/overview`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/super-admin/usage/schools`, { headers: authHeaders() }),
      ]);
      if (!schRes.ok) throw new Error('Unable to load usage data');
      const schPayload = await schRes.json();
      setSchools(Array.isArray(schPayload?.schools) ? schPayload.schools : []);
      setOverview(ovRes.ok ? await ovRes.json() : null);
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    if (overview?.totals) return overview.totals;
    const acc = schools.reduce(
      (a, s) => ({
        users: a.users + (s.totalUsers || 0),
        active24h: a.active24h + (s.active24h || 0),
        active7d: a.active7d + (s.active7d || 0),
        active30d: a.active30d + (s.active30d || 0),
      }),
      { users: 0, active24h: 0, active7d: 0, active30d: 0 },
    );
    return {
      ...acc,
      dormant: Math.max(0, acc.users - acc.active30d),
      neverActive: null,
    };
  }, [overview, schools]);

  const byRole = overview?.byRole || [];

  const visibleSchools = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let rows = schools.filter((s) => {
      if (healthFilter !== 'all' && deriveHealth(s) !== healthFilter) return false;
      if (needle && !String(s.name || '').toLowerCase().includes(needle)) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case 'active7d':
          return (b.active7d || 0) - (a.active7d || 0);
        case 'users':
          return (b.totalUsers || 0) - (a.totalUsers || 0);
        case 'name':
          return String(a.name || '').localeCompare(String(b.name || ''));
        case 'health':
          return HEALTH_ORDER[deriveHealth(b)] - HEALTH_ORDER[deriveHealth(a)];
        default:
          return (
            new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime()
          );
      }
    });
    return rows;
  }, [schools, query, healthFilter, sort]);

  const healthCounts = useMemo(() => {
    const c = { all: schools.length, active: 0, low: 0, dormant: 0, never: 0 };
    schools.forEach((s) => {
      c[deriveHealth(s)] += 1;
    });
    return c;
  }, [schools]);

  const pct = (v) => (totals.users > 0 ? Math.round((v / totals.users) * 100) : 0);

  return (
    <div
      className="-m-4 min-h-full p-4 sm:-m-6 sm:p-6"
      style={{ background: 'linear-gradient(180deg, #f5f7fb 0%, #eef2f9 100%)' }}
    >
      {/* decorative blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 right-0 h-80 w-80 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.28), transparent 70%)' }}
        />
      </div>

      <motion.div
        variants={listV}
        initial="hidden"
        animate="show"
        className="relative mx-auto max-w-6xl space-y-6"
      >
        {/* heading */}
        <motion.div variants={itemV} className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Platform insight</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">System usage</h1>
            <p className="mt-1 text-sm text-slate-500">
              Who is actually using the platform — by school, by role, right down to each account.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/60 px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:-translate-y-0.5 hover:bg-white"
            style={{ backdropFilter: 'blur(12px)' }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </motion.div>

        {error && (
          <motion.div
            variants={itemV}
            className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800"
          >
            {error} — the usage API may not be deployed yet.
          </motion.div>
        )}

        {/* KPI strip */}
        <motion.div
          variants={listV}
          className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5"
        >
          <Kpi
            Icon={Activity}
            tint="#8b5cf6"
            label="Active today"
            value={loading ? '—' : fmt(totals.active24h)}
            sub={loading ? '' : `${pct(totals.active24h)}% of all users`}
          />
          <Kpi
            Icon={Users}
            tint="#10b981"
            label="Active this week"
            value={loading ? '—' : fmt(totals.active7d)}
            sub={loading ? '' : `${pct(totals.active7d)}% of all users`}
          />
          <Kpi
            Icon={CalendarClock}
            tint="#0ea5e9"
            label="Active this month"
            value={loading ? '—' : fmt(totals.active30d)}
            sub={loading ? '' : `${pct(totals.active30d)}% of all users`}
          />
          <Kpi
            Icon={MoonStar}
            tint="#f59e0b"
            label="Dormant 30d+"
            value={loading ? '—' : fmt(totals.dormant)}
            sub={loading ? '' : 'no recent activity'}
          />
          <Kpi
            Icon={UserX}
            tint="#94a3b8"
            label="Never signed in"
            value={loading ? '—' : totals.neverActive == null ? '—' : fmt(totals.neverActive)}
            sub={loading ? '' : 'accounts never used'}
          />
        </motion.div>

        {/* role breakdown */}
        {byRole.length > 0 && (
          <GlassCard variants={itemV} className="p-5">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Active by role · last 30 days
            </h4>
            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {byRole.map((row) => (
                <RoleBreakdownRow key={row.role} row={row} />
              ))}
            </div>
          </GlassCard>
        )}

        {/* schools */}
        <motion.div variants={itemV} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Schools</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/60 px-3 py-2"
                style={{ backdropFilter: 'blur(12px)' }}
              >
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search schools…"
                  className="w-44 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm text-slate-600 focus:outline-none"
                style={{ backdropFilter: 'blur(12px)' }}
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* health filter chips */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: 'all', label: 'All schools' },
              { value: 'active', label: HEALTH.active.label },
              { value: 'low', label: HEALTH.low.label },
              { value: 'dormant', label: HEALTH.dormant.label },
              { value: 'never', label: HEALTH.never.label },
            ].map((f) => (
              <Chip
                key={f.value}
                active={healthFilter === f.value}
                onClick={() => setHealthFilter(f.value)}
              >
                {f.label}
                <span className="ml-1.5 opacity-60">{healthCounts[f.value] ?? 0}</span>
              </Chip>
            ))}
          </div>

          {/* list */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[76px] animate-pulse rounded-[24px] bg-white/50" />
              ))}
            </div>
          ) : visibleSchools.length === 0 ? (
            <EmptyState
              Icon={Building2}
              title="No schools to show"
              hint={
                schools.length === 0
                  ? 'Usage data will appear here once the API is live and people start using the portals.'
                  : 'No schools match the current filters.'
              }
            />
          ) : (
            <motion.div variants={listV} className="space-y-3">
              {visibleSchools.map((school) => (
                <SchoolRow
                  key={school.schoolId || school._id || school.id || school.name}
                  school={school}
                  onOpen={setSelected}
                />
              ))}
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {selected && <SchoolDetailModal school={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
