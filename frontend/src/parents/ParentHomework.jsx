import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  Calculator,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  Globe2,
  Languages,
  Leaf,
  ListChecks,
  Monitor,
  Music,
  Palette,
  Search,
  X,
} from 'lucide-react';
import { parentApiJson } from './parentApi';
import useParentChildren from './useParentChildren';

// Homework for the selected child. View only — the student submits from their
// own portal; the parent monitors status, due dates and teacher remarks.

/* ── helpers ─────────────────────────────────────────────────────────────── */
const validDate = (v) => v && !Number.isNaN(new Date(v).getTime());
const fmt = (d) => (validDate(d) ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const subjectOf = (a) => a?.subject?.name || a?.subjectName || a?.subject || 'General';
const attachmentOf = (a) => a?.attachmentUrl || a?.fileUrl || a?.attachment?.url || (Array.isArray(a?.attachments) ? a.attachments[0]?.url : '') || '';
// Cloudinary serves some uploads (raw files, no extension) as downloads. To
// view them instead, fetch the file and open it from a typed blob URL — the
// browser then renders PDFs / images in the new tab. Formats a browser can't
// show (e.g. Word) fall back to the original link.
const VIEWABLE = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', txt: 'text/plain' };
const openAttachmentInTab = async (url) => {
  if (!url) return;
  const tab = window.open('', '_blank'); // open now so the popup isn't blocked
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const ext = (String(url).split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
    let type = VIEWABLE[ext] || (blob.type && blob.type !== 'application/octet-stream' ? blob.type : '');
    if (!type) {
      // No extension / generic type: sniff the first bytes for PDF or images.
      const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
      const sig = String.fromCharCode(...head);
      if (sig.startsWith('%PDF')) type = 'application/pdf';
      else if (head[0] === 0x89 && sig.slice(1, 4) === 'PNG') type = 'image/png';
      else if (head[0] === 0xff && head[1] === 0xd8) type = 'image/jpeg';
    }
    if (!type || !(type.startsWith('image/') || type === 'application/pdf' || type.startsWith('text/'))) {
      if (tab) tab.location.href = url; else window.open(url, '_blank', 'noopener');
      return;
    }
    const objectUrl = URL.createObjectURL(new Blob([blob], { type }));
    if (tab) tab.location.href = objectUrl; else window.open(objectUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5 * 60 * 1000);
  } catch {
    if (tab) tab.location.href = url; else window.open(url, '_blank', 'noopener');
  }
};
const startOfToday = () => new Date(new Date().toDateString());

const STATUS = {
  not_submitted: { label: 'Pending', Icon: Clock, cls: 'bg-amber-50 text-amber-600' },
  overdue: { label: 'Overdue', Icon: AlertCircle, cls: 'bg-red-50 text-red-600' },
  submitted: { label: 'Submitted', Icon: CheckCircle2, cls: 'bg-green-50 text-green-700' },
  late: { label: 'Submitted late', Icon: Clock, cls: 'bg-orange-50 text-orange-500' },
  graded: { label: 'Checked', Icon: CheckCircle2, cls: 'bg-violet-50 text-violet-700' },
};
const statusKey = (a) => {
  const s = a?.submissionStatus || 'not_submitted';
  if (s === 'not_submitted' && validDate(a?.dueDate) && new Date(a.dueDate) < startOfToday()) return 'overdue';
  return STATUS[s] ? s : 'not_submitted';
};
const bucketOf = (k) => (k === 'not_submitted' || k === 'overdue' ? 'pending' : k === 'graded' ? 'checked' : 'submitted');

// Subject → icon + tint, like the design (computer = monitor, science = leaf…).
const subjectStyle = (name) => {
  const s = String(name).toLowerCase();
  if (/computer|ict|coding/.test(s)) return { Icon: Monitor, cls: 'bg-blue-50 text-blue-600' };
  if (/science|evs|biology|chemistry|physics/.test(s)) return { Icon: Leaf, cls: 'bg-green-50 text-green-600' };
  if (/math/.test(s)) return { Icon: Calculator, cls: 'bg-violet-50 text-violet-600' };
  if (/bengali|bangla|hindi|sanskrit|language/.test(s)) return { Icon: BookOpen, cls: 'bg-red-50 text-red-500' };
  if (/english/.test(s)) return { Icon: Languages, cls: 'bg-sky-50 text-sky-600' };
  if (/history|geography|social|civics/.test(s)) return { Icon: Globe2, cls: 'bg-amber-50 text-amber-600' };
  if (/art|drawing|craft/.test(s)) return { Icon: Palette, cls: 'bg-pink-50 text-pink-500' };
  if (/music/.test(s)) return { Icon: Music, cls: 'bg-indigo-50 text-indigo-500' };
  return { Icon: FileText, cls: 'bg-slate-100 text-slate-600' };
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending', dot: 'bg-amber-500' },
  { key: 'submitted', label: 'Submitted', dot: 'bg-green-600' },
  { key: 'checked', label: 'Checked', dot: 'bg-violet-600' },
];
const SORTS = [
  { key: 'due-desc', label: 'Due Date (Latest)' },
  { key: 'due-asc', label: 'Due Date (Oldest)' },
  { key: 'assigned-desc', label: 'Recently Assigned' },
];

// Per-child client cache (memory + sessionStorage) → instant repeat visits.
const CACHE_MAX_AGE = 10 * 60 * 1000;
const cacheKey = (studentId) => {
  let t = '';
  try { t = localStorage.getItem('token') || ''; } catch { /* ignore */ }
  return `parent:homework:v1:${t.slice(-16)}:${studentId}`;
};
const memCache = new Map();
const readCache = (studentId) => {
  const key = cacheKey(studentId);
  let entry = memCache.get(key);
  if (!entry) { try { entry = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { entry = null; } }
  return entry && Date.now() - entry.at < CACHE_MAX_AGE ? entry.data : null;
};
const writeCache = (studentId, data) => {
  const key = cacheKey(studentId);
  const entry = { at: Date.now(), data };
  memCache.set(key, entry);
  try { sessionStorage.setItem(key, JSON.stringify(entry)); } catch { /* quota / private mode */ }
};

const RISE = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } };

/* ── page ────────────────────────────────────────────────────────────────── */
const ParentHomework = () => {
  const navigate = useNavigate();
  const { selected, error: childError } = useParentChildren();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('due-desc');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    if (!selected?.id) { setItems([]); return; }
    const cached = readCache(selected.id);
    if (cached) setItems(cached);
    setLoading(!cached);
    setError('');
    try {
      const data = await parentApiJson(`/api/assignment/parent/assignments?studentId=${encodeURIComponent(selected.id)}`, {}, navigate);
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      writeCache(selected.id, list);
    } catch (err) {
      if (!cached) { setError(err.message || 'Unable to load homework'); setItems([]); }
    } finally {
      setLoading(false);
    }
  }, [selected?.id, navigate]);

  useEffect(() => { load(); }, [load]);


  // Filter pill strip: arrows scroll it and dim at either end.
  const pillsRef = useRef(null);
  const [pillScroll, setPillScroll] = useState({ left: false, right: false });
  const updatePillScroll = useCallback(() => {
    const el = pillsRef.current;
    if (!el) return;
    setPillScroll({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    updatePillScroll();
    window.addEventListener('resize', updatePillScroll);
    return () => window.removeEventListener('resize', updatePillScroll);
  }, [updatePillScroll]);
  // Pill widths change once counts load — re-check which arrows to show.
  useEffect(() => { updatePillScroll(); }, [items, updatePillScroll]);
  const scrollPills = (dir) => {
    const el = pillsRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(140, el.clientWidth * 0.6), behavior: 'smooth' });
  };

  const ROW_H = 60;
  const HEAD_H = 44;
  const tableBoxRef = useRef(null);
  const [pageSize, setPageSize] = useState(8);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const el = tableBoxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const fits = window.matchMedia('(min-width: 1024px)').matches
        ? Math.max(3, Math.floor((el.clientHeight - HEAD_H - 2) / ROW_H))
        : 8;
      setPageSize((cur) => (cur === fits ? cur : fits));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Re-measure once rows render (their real height is only known then).
    const table = el.querySelector('table');
    if (table) ro.observe(table);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  const counts = useMemo(() => {
    const c = { all: items.length, pending: 0, submitted: 0, checked: 0 };
    items.forEach((a) => { c[bucketOf(statusKey(a))] += 1; });
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const time = (v) => (validDate(v) ? new Date(v).getTime() : 0);
    return items
      .filter((a) => filter === 'all' || bucketOf(statusKey(a)) === filter)
      .filter((a) => !q || [a.title, a.description, subjectOf(a)].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => {
        if (sort === 'due-asc') return time(a.dueDate) - time(b.dueDate);
        if (sort === 'assigned-desc') return time(b.createdAt) - time(a.createdAt);
        return time(b.dueDate) - time(a.dueDate);
      });
  }, [items, filter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageItems = visible.slice((page - 1) * pageSize, page * pageSize);
  const pageWindow = (() => {
    const start = Math.max(1, Math.min(page - 1, totalPages - 2));
    return Array.from({ length: Math.min(3, totalPages) }, (_, i) => start + i);
  })();
  useEffect(() => { setPage(1); }, [filter, search, sort, selected?.id]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);


  const STAT_CARDS = [
    { key: 'all', label: 'Total', value: counts.all, Icon: FileText, tile: 'bg-blue-100/70 text-blue-600', bg: 'from-white to-blue-50/40' },
    { key: 'pending', label: 'Pending', value: counts.pending, Icon: Clock, tile: 'bg-amber-100/70 text-amber-500', bg: 'from-white to-amber-50/60' },
    { key: 'submitted', label: 'Submitted', value: counts.submitted, Icon: Check, tile: 'bg-green-100/70 text-green-600', bg: 'from-white to-green-50/50', solid: 'bg-green-600' },
    { key: 'checked', label: 'Checked', value: counts.checked, Icon: FileCheck2, tile: 'bg-violet-100/70 text-violet-600', bg: 'from-white to-violet-50/50' },
  ];

  return (
    <motion.div
      className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 bg-slate-50 p-3 sm:p-4 lg:h-full lg:min-h-0 lg:overflow-hidden lg:p-5"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
    >
      {/* ── Title + child picker ── */}
      <motion.div variants={RISE} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Homework</h1>
          <p className="mt-0.5 text-sm text-slate-600">Assignments given to your child, their due dates and status.</p>
        </div>
      </motion.div>

      {childError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{childError}</p> : null}

      {/* ── Stat cards ── */}
      <motion.div variants={RISE} className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {STAT_CARDS.map((s) => (
          <motion.button
            key={s.key}
            type="button"
            whileHover={{ y: -3 }}
            onClick={() => setFilter(s.key)}
            className={`flex items-center gap-3 rounded-2xl border border-slate-100 bg-linear-to-br ${s.bg} px-4 py-3 text-left shadow-[0_2px_12px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md`}
          >
            <span className={`flex h-8 w-11 shrink-0 items-center justify-center rounded-xl ${s.tile}`}>
              {s.solid
                ? <span className={`flex h-7 w-7 items-center justify-center rounded-full text-white ${s.solid}`}><s.Icon size={15} strokeWidth={3} /></span>
                : <s.Icon size={21} />}
            </span>
            <span>
              <span className="block text-sm font-medium text-slate-700">{s.label}</span>
              <span className="block text-xl font-bold leading-tight text-slate-900">{s.value}</span>
            </span>
          </motion.button>
        ))}
      </motion.div>

      {/* ── Filters + list ── */}
      <motion.section variants={RISE} className="flex min-h-0 flex-col rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:p-4 lg:flex-1">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => scrollPills(-1)}
            aria-label="Scroll filters left"
            className={`h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 ${pillScroll.left ? 'flex' : 'hidden'}`}
          >
            <ChevronLeft size={17} />
          </button>
          <div ref={pillsRef} onScroll={updatePillScroll} className="flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-smooth py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold transition ${
                    active ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {f.dot
                    ? <span className={`h-3 w-3 rounded-full ${f.dot}`} />
                    : <ListChecks size={15} />}
                  {f.label} ({counts[f.key] || 0})
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => scrollPills(1)}
            aria-label="Scroll filters right"
            className={`h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 ${pillScroll.right ? 'flex' : 'hidden'}`}
          >
            <ChevronRight size={17} />
          </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative sm:w-60">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search homework..."
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
            </div>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3.5 pr-10 text-sm font-medium text-slate-800 outline-none focus:border-violet-300 sm:w-48"
              >
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
        </div>

        <div ref={tableBoxRef} className="mt-3 min-h-0 flex-1 overflow-auto overscroll-contain rounded-xl border border-slate-100">
          <table className="w-full min-w-190 table-fixed text-sm">
            <colgroup>
              <col className="w-[13rem]" />
              <col />
              <col className="w-[9.5rem]" />
              <col className="w-[9.5rem]" />
              <col className="w-[9.5rem]" />
            </colgroup>
            <thead>
              <tr className="sticky top-0 z-10 h-11 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4">Subject</th>
                <th className="px-4">Homework</th>
                <th className="px-4">Assigned</th>
                <th className="px-4">Due</th>
                <th className="px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i} style={{ height: ROW_H }}><td colSpan={5} className="px-4"><div className="h-8 animate-pulse rounded-lg bg-slate-100" /></td></tr>
                ))
              ) : error ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-red-600">
                  {error} <button type="button" onClick={load} className="ml-2 font-semibold underline">Try again</button>
                </td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center">
                  <BookOpen size={30} className="mx-auto text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-600">No homework here</p>
                  <p className="text-xs text-slate-400">{items.length ? 'Try another filter or search.' : 'Homework assigned by teachers will appear here.'}</p>
                </td></tr>
              ) : pageItems.map((a, i) => {
                const k = statusKey(a);
                const st = STATUS[k];
                const subj = subjectOf(a);
                const sty = subjectStyle(subj);
                const dueRed = k === 'overdue' || k === 'late';
                return (
                  <motion.tr
                    key={`${page}-${a._id}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.035, 0.3), duration: 0.25 }}
                    style={{ height: ROW_H }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open homework: ${a.title || 'Homework'}`}
                    onClick={() => setOpen(a)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(a); } }}
                    className="cursor-pointer transition-colors hover:bg-violet-50/50 focus:bg-violet-50/60 focus:outline-none"
                  >
                    <td className="px-4">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${sty.cls}`}><sty.Icon size={19} /></span>
                        <span className="truncate font-medium text-slate-800" title={subj}>{subj}</span>
                      </div>
                    </td>
                    <td className="px-4">
                      <p className="truncate font-bold text-slate-900" title={a.title}>{a.title || 'Homework'}</p>
                      {a.description ? <p className="truncate text-xs text-slate-500" title={a.description}>{a.description}</p> : null}
                    </td>
                    <td className="px-4 text-slate-600">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><CalendarDays size={14} className="text-slate-400" />{fmt(a.createdAt)}</span>
                    </td>
                    <td className={`px-4 ${dueRed ? 'text-red-600' : 'text-slate-600'}`}>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><CalendarCheck size={14} className={dueRed ? 'text-red-500' : 'text-slate-400'} />{fmt(a.dueDate)}</span>
                    </td>
                    <td className="px-4">
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${st.cls}`}>
                        <st.Icon size={14} /> {st.label}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="mt-3 flex shrink-0 flex-col items-center justify-between gap-2 sm:flex-row">
          <span className="text-xs text-slate-500">
            Showing {visible.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, visible.length)} of {visible.length} homework
          </span>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={15} /></button>
            {pageWindow.map((n) => (
              <button key={n} type="button" onClick={() => setPage(n)} className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm font-semibold ${n === page ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{n}</button>
            ))}
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Next page"><ChevronRight size={15} /></button>
          </div>
        </div>
      </motion.section>

      {/* ── Detail modal (portal → full-screen backdrop) ── */}
      {createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[9999] flex h-dvh w-screen items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(null); }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-violet-600">{subjectOf(open)}</p>
                  <h3 className="text-lg font-bold text-slate-900">{open.title}</h3>
                </div>
                <button type="button" onClick={() => setOpen(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
              </div>
              <div className="space-y-4 px-5 py-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-slate-500">Assigned</p><p className="font-semibold text-slate-800">{fmt(open.createdAt)}</p></div>
                  <div><p className="text-xs text-slate-500">Due</p><p className="font-semibold text-slate-800">{fmt(open.dueDate)}</p></div>
                  <div><p className="text-xs text-slate-500">Teacher</p><p className="font-semibold text-slate-800">{open.teacherId?.name || '—'}</p></div>
                  <div><p className="text-xs text-slate-500">Status</p><p className="font-semibold text-slate-800">{STATUS[statusKey(open)].label}</p></div>
                  {open.submittedAt ? <div><p className="text-xs text-slate-500">Submitted on</p><p className="font-semibold text-slate-800">{fmt(open.submittedAt)}</p></div> : null}
                  {open.score !== undefined && open.score !== null ? <div><p className="text-xs text-slate-500">Marks</p><p className="font-semibold text-slate-800">{open.score}{open.maxScore || open.totalMarks ? ` / ${open.maxScore || open.totalMarks}` : ''}</p></div> : null}
                </div>
                {open.description ? <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p><p className="whitespace-pre-wrap text-slate-700">{open.description}</p></div> : null}
                {attachmentOf(open) ? (
                  <button type="button" onClick={() => openAttachmentInTab(attachmentOf(open))} className="inline-flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 font-semibold text-violet-700 hover:bg-violet-100">
                    <ExternalLink size={15} /> Open attachment
                  </button>
                ) : null}
                {open.feedback ? (
                  <div className="rounded-xl border border-green-100 bg-green-50 p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-700">Teacher remarks</p>
                    <p className="whitespace-pre-wrap text-green-900">{open.feedback}</p>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </motion.div>
  );
};

export default ParentHomework;
