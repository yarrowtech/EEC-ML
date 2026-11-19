import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  Users, Search, Phone, Mail, MapPin, X, Download, UserRound, Droplet, CalendarDays, Hash, ShieldCheck,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

// "Class 5" / "5" / "class-5" → "5"
const classKey = (v) => String(v || '').trim().toLowerCase().replace(/^class[\s-]*/, '');
const sectionKey = (v) => String(v || '').trim().toLowerCase();

const AVATAR_COLORS = [
  'from-indigo-500 to-blue-500', 'from-rose-500 to-pink-500', 'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500', 'from-violet-500 to-purple-500', 'from-cyan-500 to-sky-500',
];
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const colorFor = (name) => AVATAR_COLORS[[...String(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const guardianOf = (s) => {
  if (s.guardianName) return { name: s.guardianName, phone: s.guardianPhone, relation: s.guardianRelation || 'Guardian' };
  if (s.fatherName) return { name: s.fatherName, phone: s.fatherPhone, relation: 'Father' };
  if (s.motherName) return { name: s.motherName, phone: s.motherPhone, relation: 'Mother' };
  return null;
};
const rollOf = (s) => s.roll ?? s.rollNumber ?? null;
// "2011-05-03" (or an ISO date) -> "03/05/2011"
const formatDob = (value) => {
  const raw = String(value || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return raw;
};

const Avatar = ({ student, size = 'size-9' }) => {
  const [broken, setBroken] = useState(false);
  if (student.profilePic && !broken) {
    return <img src={student.profilePic} alt="" onError={() => setBroken(true)} className={`${size} shrink-0 rounded-full object-cover ring-2 ring-white`} />;
  }
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${colorFor(student.name)} text-xs font-bold text-white ring-2 ring-white`}>
      {initials(student.name)}
    </span>
  );
};

const Field = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-2.5">
    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon className="size-3.5" /></span>
    <div className="min-w-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="break-words text-[13px] font-medium text-slate-800">{value || '—'}</p>
    </div>
  </div>
);

// ── Client cache (stale-while-revalidate) ─────────────────────
// Shown instantly from memory (or sessionStorage after a reload), then
// refreshed in the background. Keyed by the login token so another user on
// the same browser never sees this teacher's list. sessionStorage clears when
// the tab closes; attendance history is dropped to keep it small.
const CACHE_TTL_MS = 5 * 60 * 1000;
const memoryCache = new Map();
const cacheKey = () => {
  const token = localStorage.getItem('token') || '';
  let h = 0;
  for (let i = 0; i < token.length; i += 1) h = (h * 31 + token.charCodeAt(i)) | 0;
  return `teacher-student-directory:${h}`;
};
const readCache = () => {
  const key = cacheKey();
  const mem = memoryCache.get(key);
  if (mem) return mem;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    memoryCache.set(key, parsed);
    return parsed;
  } catch { return null; }
};
const writeCache = (students) => {
  const key = cacheKey();
  const entry = { at: Date.now(), students: students.map(({ attendance: _a, ...rest }) => rest) };
  memoryCache.set(key, entry);
  try { sessionStorage.setItem(key, JSON.stringify(entry)); } catch { /* storage full / blocked */ }
};

const StudentDirectory = () => {
  const { className, sectionName } = useOutletContext() || {};
  const initialCache = useMemo(() => readCache(), []);
  const [students, setStudents] = useState(() => initialCache?.students || []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState('all');
  const [selected, setSelected] = useState(null);
  // The card fills the rest of the screen; only the table scrolls inside it.
  const cardRef = useRef(null);
  const [cardHeight, setCardHeight] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = cardRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const bottomGap = window.innerWidth < 1024 ? 76 : 16; // mobile bottom nav
      setCardHeight(Math.max(420, window.innerHeight - top - bottomGap));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = readCache();
      // Fresh enough: no request at all.
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        setStudents(cached.students);
        setLoading(false);
        // still revalidate quietly if older than 30s
        if (Date.now() - cached.at < 30 * 1000) return;
      } else if (!cached) {
        setLoading(true);
      }
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/teacher/dashboard/students`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Unable to load students');
        const list = Array.isArray(data.students) ? data.students : [];
        writeCache(list);
        if (!cancelled) setStudents(list);
      } catch (err) {
        // keep showing cached rows if the refresh fails
        if (!cancelled && !cached) setError(err.message || 'Unable to load students');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Only this class + section (the API returns every allocated section).
  const classStudents = useMemo(() => {
    const ck = classKey(className);
    const sk = sectionKey(sectionName);
    return students
      .filter((s) => (!ck || classKey(s.grade || s.className) === ck) && (!sk || sectionKey(s.section || s.sectionName) === sk))
      .sort((a, b) => (Number(rollOf(a)) || 9999) - (Number(rollOf(b)) || 9999) || String(a.name).localeCompare(String(b.name)));
  }, [students, className, sectionName]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classStudents.filter((s) => {
      if (gender !== 'all' && String(s.gender).toLowerCase() !== gender) return false;
      if (!q) return true;
      const g = guardianOf(s);
      return [s.name, s.username, s.admissionNumber, rollOf(s), s.mobile, g?.name, g?.phone]
        .some((v) => String(v ?? '').toLowerCase().includes(q));
    });
  }, [classStudents, query, gender]);

  const stats = useMemo(() => ({
    total: classStudents.length,
    boys: classStudents.filter((s) => String(s.gender).toLowerCase() === 'male').length,
    girls: classStudents.filter((s) => String(s.gender).toLowerCase() === 'female').length,
    withGuardian: classStudents.filter((s) => guardianOf(s)?.phone).length,
  }), [classStudents]);

  const exportCsv = () => {
    const rows = [['Roll', 'Name', 'Admission No', 'Gender', 'DOB', 'Blood Group', 'Mobile', 'Email', 'Guardian', 'Relation', 'Guardian Phone', 'Address']];
    visible.forEach((s) => {
      const g = guardianOf(s) || {};
      rows.push([rollOf(s) ?? '', s.name, s.admissionNumber, s.gender, formatDob(s.dob), s.bloodGroup, s.mobile, s.email, g.name || '', g.relation || '', g.phone || '', s.address]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `students-${className || 'class'}-${sectionName || ''}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const statCards = [
    { label: 'Total Students', value: stats.total, tone: 'from-indigo-500 to-blue-500' },
    { label: 'Boys', value: stats.boys, tone: 'from-sky-500 to-cyan-500' },
    { label: 'Girls', value: stats.girls, tone: 'from-rose-500 to-pink-500' },
    { label: 'Guardian Contact', value: stats.withGuardian, tone: 'from-emerald-500 to-teal-500' },
  ];

  return (
    <div>
    <div ref={cardRef} style={cardHeight ? { height: cardHeight } : undefined} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 sm:px-8 sm:py-6">
      {/* Title + actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-sm"><Users className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-900">Student Directory</h2>
          <p className="text-xs text-slate-500">Students of {className ? `Class ${classKey(className)}` : 'this class'}{sectionName ? ` - ${sectionName}` : ''} with contact and guardian details</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={!visible.length} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 cursor-pointer disabled:opacity-50">
          <Download className="size-3.5" /> Download Data
        </button>
      </div>

      {/* Stats */}
      <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((c) => (
          <div key={c.label} className="relative flex items-center justify-between gap-2 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 py-3 pl-4 pr-3">
            <span className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${c.tone}`} />
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className="text-xl font-bold text-slate-900">{loading ? '–' : c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, roll, admission no, phone or guardian…"
            className="h-10 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
          {[['all', 'All'], ['male', 'Boys'], ['female', 'Girls']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setGender(v)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${gender === v ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200">
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] shadow-[0_1px_0_0_rgb(226_232_240)] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Roll</th>
                <th className="px-4 py-3">Student</th>
                {/* <th className="px-4 py-3">Admission No</th> */}
                <th className="px-4 py-3">Gender / Blood</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Guardian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && [...Array(6)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((__, j) => <td key={j} className="px-4 py-3.5"><div className="h-3.5 animate-pulse rounded bg-slate-100" /></td>)}</tr>
              ))}
              {!loading && error && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-red-600">{error}</td></tr>
              )}
              {!loading && !error && visible.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center">
                  <UserRound className="mx-auto size-8 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-600">{classStudents.length ? 'No students match your search' : 'No students allocated to this class yet'}</p>
                </td></tr>
              )}
              {!loading && !error && visible.map((s, idx) => {
                const g = guardianOf(s);
                return (
                  <Motion.tr
                    key={s._id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                    onClick={() => setSelected(s)}
                    className="cursor-pointer transition hover:bg-indigo-50/50"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex min-w-8 justify-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{rollOf(s) ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar student={s} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{s.name}</p>
                          <p className="truncate text-xs text-slate-500">{s.username || '—'}</p>
                        </div>
                      </div>
                    </td>
                    {/* <td className="px-4 py-3 text-slate-700">{s.admissionNumber || '—'}</td> */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {s.gender && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${s.gender === 'female' ? 'bg-rose-500 text-white' : 'bg-sky-500 text-white'}`}>{s.gender}</span>}
                        {s.bloodGroup && <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"><Droplet className="size-3 fill-red-500 text-red-500" />{s.bloodGroup}</span>}
                        {!s.gender && !s.bloodGroup && <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.mobile ? <a href={`tel:${s.mobile}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-slate-700 hover:text-indigo-700"><Phone className="size-3.5 text-slate-400 fill-slate-400" />{s.mobile}</a> : <span className="text-slate-400">—</span>}
                      {s.email && <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500"><Mail className="size-3 text-slate-400" />{s.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {g ? (
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{g.name} <span className="text-xs font-normal text-slate-400">· {g.relation}</span></p>
                          {g.phone && <a href={`tel:${g.phone}`} onClick={(e) => e.stopPropagation()} className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:underline"><Phone className="size-3 fill-emerald-700" />{g.phone}</a>}
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                  </Motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && !error && visible.length > 0 && (
          <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-500">
            Showing <b className="text-slate-700">{visible.length}</b> of {classStudents.length} students · click a row for full details
          </div>
        )}
      </div>

      {/* Details drawer */}
      {createPortal(<AnimatePresence>
        {selected && (
          <Motion.div className="fixed inset-0 z-[120] flex justify-end bg-slate-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}>
            <Motion.aside
              initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl"
            >
              <div className="relative bg-gradient-to-br from-indigo-600 to-blue-500 px-5 pb-6 pt-5 text-white">
                <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="absolute right-3 top-3 rounded-full p-1.5 hover:bg-white/15"><X className="size-4" /></button>
                <div className="flex items-center gap-3">
                  <Avatar student={selected} size="size-14" />
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold">{selected.name}</p>
                    <p className="text-xs text-white/80">Roll {rollOf(selected) ?? '—'} · {selected.classLabel || ''}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-5 p-5">
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Student</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field icon={Hash} label="Admission No" value={selected.admissionNumber} />
                    <Field icon={UserRound} label="Gender" value={selected.gender} />
                    <Field icon={CalendarDays} label="Date of Birth" value={formatDob(selected.dob)} />
                    <Field icon={Droplet} label="Blood Group" value={selected.bloodGroup} />
                  </div>
                  <Field icon={Phone} label="Mobile" value={selected.mobile} />
                  <Field icon={Mail} label="Email" value={selected.email} />
                  <Field icon={MapPin} label="Address" value={selected.address} />
                </section>
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Parents & Guardian</h3>
                  {[
                    ['Father', selected.fatherName, selected.fatherPhone],
                    ['Mother', selected.motherName, selected.motherPhone],
                    [selected.guardianRelation ? `Guardian (${selected.guardianRelation})` : 'Guardian', selected.guardianName, selected.guardianPhone],
                  ].filter(([, n, p]) => n || p).map(([rel, n, p]) => (
                    <div key={rel} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><ShieldCheck className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{n || '—'}</p>
                        <p className="text-[11px] text-slate-500">{rel}</p>
                      </div>
                      {p && <a href={`tel:${p}`} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50"><Phone className="size-3" />{p}</a>}
                    </div>
                  ))}
                  {selected.guardianEmail && <Field icon={Mail} label="Guardian Email" value={selected.guardianEmail} />}
                  {!selected.fatherName && !selected.motherName && !selected.guardianName && <p className="text-sm text-slate-400">No guardian details recorded.</p>}
                </section>
              </div>
            </Motion.aside>
          </Motion.div>
        )}
      </AnimatePresence>, document.body)}
    </div>
    </div>
  );
};

export default StudentDirectory;
