import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Eye, GraduationCap, Heart,
  Loader2, MapPin, Printer, School, Search, SlidersHorizontal, X,
} from 'lucide-react';
import { ApplicationSheet, fmtDate } from './AdmissionPortal';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '').replace(/\/api$/, '');
const INPUT = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const SELECT = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500';
const CARD = 'rounded-2xl bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]';
const PAGE_SIZE = 8;
const SAVED_KEY = 'eec_saved_schools';

const STATUS = {
  open: { label: 'Admissions Open', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  upcoming: { label: 'Opening Soon', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  closed: { label: 'Closed', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  full: { label: 'Seats Full', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
};
const STATUS_ORDER = ['open', 'upcoming', 'full', 'closed'];

const APP_STATUS = {
  submitted: { label: 'Submitted', cls: 'bg-blue-600 text-white' },
  shortlisted: { label: 'Shortlisted', cls: 'bg-amber-500 text-white' },
  approved: { label: 'Approved', cls: 'bg-violet-600 text-white' },
  admitted: { label: 'Admitted', cls: 'bg-emerald-600 text-white' },
  rejected: { label: 'Rejected', cls: 'bg-rose-600 text-white' },
};

// Sort class names like "Nursery", "KG", "1", "Class 5", "XII" into school order.
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
const classRank = (name) => {
  const n = String(name || '').toLowerCase().replace(/class|grade|std\.?/g, '').trim();
  if (/^(pre|play|nursery)/.test(n)) return -3;
  if (/^(lkg|kg ?1|kg$)/.test(n)) return -2;
  if (/^(ukg|kg ?2)/.test(n)) return -1;
  const num = parseInt(n, 10);
  if (!Number.isNaN(num)) return num;
  return ROMAN[n.split(/\s|-/)[0]] ?? 99;
};
const cityOf = (address) => {
  const parts = String(address || '').split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return '';
  const last = parts[parts.length - 1].replace(/[-–]?\s*\d{6}$/, '').trim();
  return (last && !/^\d+$/.test(last) ? last : parts[parts.length - 2] || parts[0]);
};
const readSaved = () => {
  try { return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')); } catch { return new Set(); }
};

const SchoolLogo = ({ school, size = 'h-8 w-8' }) => (school?.logo
  ? <img src={school.logo} alt="" className={`${size} shrink-0 rounded-lg bg-white object-contain`} />
  : <span className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white`}><School className="h-4 w-4" /></span>);

const FilterBlock = ({ icon: Icon, title, children }) => (
  <div className="border-b border-slate-100 py-3 last:border-0">
    <p className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-800"><Icon className="h-4 w-4 text-slate-500" /> {title}</p>
    {children}
  </div>
);

const AdmissionHub = () => {
  const [view, setView] = useState('browse');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState(readSaved);

  // search + filters (draft values apply on "Apply Filters")
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const EMPTY_FILTERS = { city: '', classFrom: '', classTo: '', statuses: [], savedOnly: false };
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState('relevance');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // "My applications" lookup
  const [track, setTrack] = useState({ guardianPhone: '', dateOfBirth: '' });
  const [tracking, setTracking] = useState(false);
  const [trackError, setTrackError] = useState('');
  const [myApps, setMyApps] = useState(null);
  const [viewApp, setViewApp] = useState(null);

  useEffect(() => { document.title = 'Find Schools · Admissions'; }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admissions/public`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Unable to load schools');
        if (alive) setSessions(json.sessions || []);
      } catch (err) {
        if (alive) setLoadError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // One entry per school, built from its admission notices.
  const schools = useMemo(() => {
    const map = new Map();
    sessions.forEach((sn) => {
      const id = String(sn.school?._id);
      if (!map.has(id)) map.set(id, { ...sn.school, sessions: [] });
      map.get(id).sessions.push(sn);
    });
    return [...map.values()].map((sc) => {
      const classes = [...new Set(sc.sessions.flatMap((sn) => sn.classes || []))].sort((a, b) => classRank(a) - classRank(b));
      const status = STATUS_ORDER.find((st) => sc.sessions.some((sn) => sn.state === st)) || 'closed';
      const open = sc.sessions.filter((sn) => sn.state === 'open');
      return {
        ...sc,
        classes,
        classRange: classes.length ? (classes.length === 1 ? classes[0] : `${classes[0]} – ${classes[classes.length - 1]}`) : 'All classes',
        status,
        city: cityOf(sc.address),
        academicYear: sc.sessions.find((sn) => sn.academicYear)?.academicYear || '',
        lastDate: open.length ? open.map((sn) => new Date(sn.endDate)).sort((a, b) => a - b)[0] : null,
      };
    });
  }, [sessions]);

  const cityOptions = useMemo(() => [...new Set(schools.map((s) => s.city).filter(Boolean))].sort(), [schools]);
  const classOptions = useMemo(() => [...new Set(schools.flatMap((s) => s.classes))].sort((a, b) => classRank(a) - classRank(b)), [schools]);
  const statusCounts = useMemo(() => Object.fromEntries(STATUS_ORDER.map((st) => [st, schools.filter((s) => s.status === st).length])), [schools]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = filters.classFrom ? classRank(filters.classFrom) : -Infinity;
    const to = filters.classTo ? classRank(filters.classTo) : Infinity;
    const list = schools.filter((s) => {
      if (q && ![s.name, s.address, s.academicYear, ...s.classes].some((v) => String(v || '').toLowerCase().includes(q))) return false;
      if (filters.city && s.city !== filters.city) return false;
      if (filters.statuses.length && !filters.statuses.includes(s.status)) return false;
      if (filters.savedOnly && !saved.has(String(s._id))) return false;
      if ((filters.classFrom || filters.classTo) && s.classes.length
        && !s.classes.some((c) => classRank(c) >= from && classRank(c) <= to)) return false;
      return true;
    });
    const byName = (a, b) => String(a.name).localeCompare(String(b.name));
    if (sort === 'name') return list.sort(byName);
    if (sort === 'deadline') return list.sort((a, b) => (a.lastDate || Infinity) - (b.lastDate || Infinity) || byName(a, b));
    return list.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || byName(a, b));
  }, [schools, query, filters, sort, saved]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageNumbers = useMemo(() => {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
    const set = new Set([1, 2, currentPage - 1, currentPage, currentPage + 1, pageCount].filter((n) => n >= 1 && n <= pageCount));
    const sorted = [...set].sort((a, b) => a - b);
    return sorted.flatMap((n, i) => (i && n - sorted[i - 1] > 1 ? ['…', n] : [n]));
  }, [pageCount, currentPage]);

  const toggleSaved = (id) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(SAVED_KEY, JSON.stringify([...next])); } catch { /* storage unavailable */ }
      return next;
    });
  };
  const runSearch = (e) => { e?.preventDefault(); setQuery(searchText); setPage(1); };
  const quickSearch = (text) => { setSearchText(text); setQuery(text); setPage(1); };
  const applyFilters = () => { setFilters(draft); setPage(1); setFiltersOpen(false); };
  const clearFilters = () => { setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(1); };
  const toggleDraftStatus = (st) => setDraft((d) => ({
    ...d, statuses: d.statuses.includes(st) ? d.statuses.filter((x) => x !== st) : [...d.statuses, st],
  }));

  const lookup = async (e) => {
    e?.preventDefault();
    try {
      setTracking(true);
      setTrackError('');
      const res = await fetch(`${API_BASE}/api/admissions/public/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(track),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Unable to find applications');
      setMyApps(Array.isArray(json) ? json : []);
    } catch (err) {
      setTrackError(err.message);
    } finally {
      setTracking(false);
    }
  };

  const quickChips = [...cityOptions.slice(0, 3), ...classOptions.slice(0, 3)];

  const filterPanel = (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-900"><SlidersHorizontal className="h-4 w-4" /> Filters</p>
        <button type="button" onClick={clearFilters} className="text-xs font-semibold text-indigo-600 hover:underline">Clear All</button>
      </div>
      <FilterBlock icon={MapPin} title="Location">
        <select value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} className={SELECT}>
          <option value="">Select City / Area</option>
          {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </FilterBlock>
      <FilterBlock icon={GraduationCap} title="Class Range">
        <div className="grid grid-cols-2 gap-2">
          <select value={draft.classFrom} onChange={(e) => setDraft({ ...draft, classFrom: e.target.value })} className={SELECT}>
            <option value="">From</option>
            {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={draft.classTo} onChange={(e) => setDraft({ ...draft, classTo: e.target.value })} className={SELECT}>
            <option value="">To</option>
            {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </FilterBlock>
      <FilterBlock icon={CalendarDays} title="Admission Status">
        <div className="space-y-1.5">
          {STATUS_ORDER.map((st) => (
            <label key={st} className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={draft.statuses.includes(st)} onChange={() => toggleDraftStatus(st)} className="h-3.5 w-3.5 accent-indigo-600" />
              {STATUS[st].label} <span className="text-slate-400">({statusCounts[st] || 0})</span>
            </label>
          ))}
        </div>
      </FilterBlock>
      <FilterBlock icon={Heart} title="Saved">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={draft.savedOnly} onChange={(e) => setDraft({ ...draft, savedOnly: e.target.checked })} className="h-3.5 w-3.5 accent-indigo-600" />
          Saved schools only <span className="text-slate-400">({saved.size})</span>
        </label>
      </FilterBlock>
      <button type="button" onClick={applyFilters}
        className="mt-2 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
        Apply Filters
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* ── Hero ── */}
        <header className="no-print relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-600 shadow-sm">
          
          <button type="button" onClick={() => setView(view === 'mine' ? 'browse' : 'mine')}
            className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur hover:bg-white">
            {view === 'mine' ? <><School className="h-3.5 w-3.5" /> All Schools</> : <><ClipboardList className="h-3.5 w-3.5" /> My Applications</>}
          </button>
          <div className="relative px-4 py-8 text-center sm:py-10">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Find the Best Schools for Your Child</h1>
            <p className="mt-1.5 text-xs text-white/85 sm:text-sm">Discover schools and apply to as many as you like</p>
            <form onSubmit={(e) => { setView('browse'); runSearch(e); }}
              className="mx-auto mt-5 flex max-w-xl items-center gap-2 rounded-xl bg-white p-1.5 shadow-md">
              <Search className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
              <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search school by name, location, class..."
                className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm text-slate-900 outline-none" />
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700">Search</button>
            </form>
            {quickChips.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {quickChips.map((c) => (
                  <button key={c} type="button" onClick={() => { setView('browse'); quickSearch(c); }}
                    className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-white">{c}</button>
                ))}
              </div>
            )}
          </div>
        </header>

        {view === 'browse' ? (
          <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
            <aside className="no-print hidden lg:block">{filterPanel}</aside>

            <section className="no-print min-w-0">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{filters.city ? `Schools in ${filters.city}` : 'All Schools'}</h2>
                  <p className="text-xs text-slate-500">{filtered.length} school{filtered.length === 1 ? '' : 's'} found{query ? ` for “${query}”` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setFiltersOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 lg:hidden">
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
                  </button>
                  <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${SELECT} w-auto bg-white`}>
                    <option value="relevance">Sort by: Relevance</option>
                    <option value="deadline">Sort by: Last date</option>
                    <option value="name">Sort by: Name</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className={`${CARD} flex justify-center py-16`}><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>
              ) : loadError ? (
                <p className={`${CARD} flex items-center justify-center gap-2 py-16 text-sm text-rose-600`}><AlertTriangle className="h-4 w-4" /> {loadError}</p>
              ) : pageItems.length === 0 ? (
                <p className={`${CARD} py-16 text-center text-sm text-slate-500`}>No schools match your search.</p>
              ) : (
                <div className="space-y-3">
                  {pageItems.map((s) => {
                    const st = STATUS[s.status];
                    const isSaved = saved.has(String(s._id));
                    const href = `/admission/${s.slug || s._id}`;
                    return (
                      <article key={s._id} className={`${CARD} flex flex-col gap-3 p-2.5 sm:flex-row`}>
                        <a href={href} className="relative block h-36 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 sm:h-32 sm:w-48">
                          {s.cover
                            ? <img src={s.cover} alt="" className="h-full w-full object-cover" />
                            : <span className="flex h-full w-full items-center justify-center"><School className="h-10 w-10 text-white/80" /></span>}
                          <span className={`absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${st.badge}`}>{st.label}</span>
                        </a>
                        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-1 pb-1 sm:px-0 sm:pb-0">
                          <div className="flex items-start gap-2">
                            <SchoolLogo school={s} />
                            <a href={href} className="min-w-0 flex-1 truncate text-base font-bold text-slate-900 hover:text-indigo-700">{s.name}</a>
                            <button type="button" onClick={() => toggleSaved(String(s._id))} aria-label={isSaved ? 'Remove from saved' : 'Save school'}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50">
                              <Heart className={`h-4 w-4 ${isSaved ? 'fill-rose-500 text-rose-500' : 'text-slate-600'}`} />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {s.academicYear && <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">Session {s.academicYear}</span>}
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{s.classRange}</span>
                          </div>
                          {s.address && <p className="flex items-center gap-1 truncate text-xs text-slate-600"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{s.address}</span></p>}
                          <p className="flex items-center gap-1 text-[11px] text-slate-500">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {s.lastDate ? `Last date to apply: ${fmtDate(s.lastDate)}` : `${s.sessions.length} admission notice${s.sessions.length === 1 ? '' : 's'}`}
                          </p>
                          <div className="mt-1 flex gap-2">
                            <a href={href} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                              View Details <ArrowRight className="h-3.5 w-3.5" />
                            </a>
                            {s.status === 'open' && (
                              <a href={`${href}/apply/${s.sessions.find((sn) => sn.state === 'open')?._id}`} className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Apply Now</a>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {filtered.length > 0 && (
                <div className="mt-3 flex flex-col items-center justify-between gap-2 sm:flex-row">
                  <p className="text-xs text-slate-500">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1} – {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} schools
                  </p>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                    {pageNumbers.map((n, i) => (n === '…'
                      ? <span key={`gap${i}`} className="px-1 text-xs text-slate-400">…</span>
                      : (
                        <button key={n} type="button" onClick={() => setPage(n)}
                          className={`h-7 min-w-7 rounded-md px-2 text-xs font-semibold ${n === currentPage ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{n}</button>
                      )))}
                    <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Next page"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : (
          /* ── My applications ── */
          <section className={`no-print ${CARD}`}>
            <form onSubmit={lookup} className="grid gap-3 border-b border-slate-100 px-4 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Phone number used in the form</span>
                <input value={track.guardianPhone} inputMode="numeric" required maxLength={10}
                  onChange={(e) => setTrack((t) => ({ ...t, guardianPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className={INPUT} />
              </label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Student&apos;s date of birth</span>
                <input type="date" value={track.dateOfBirth} required onChange={(e) => setTrack((t) => ({ ...t, dateOfBirth: e.target.value }))} className={INPUT} />
              </label>
              <button type="submit" disabled={tracking}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {tracking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find
              </button>
              {trackError && <p className="text-xs text-rose-600 sm:col-span-3">{trackError}</p>}
            </form>
            {myApps === null ? (
              <p className="py-14 text-center text-sm text-slate-500">Enter the phone number and date of birth to see every school you applied to.</p>
            ) : myApps.length === 0 ? (
              <p className="py-14 text-center text-sm text-slate-500">No applications found for these details.</p>
            ) : (
              <div className="overflow-x-auto p-3 sm:p-4">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Sl No</th>
                      <th className="px-3 py-2.5">School</th>
                      <th className="px-3 py-2.5">Admission No</th>
                      <th className="px-3 py-2.5">Student / Class</th>
                      <th className="px-3 py-2.5">Applied On</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myApps.map((a, i) => {
                      const st = APP_STATUS[a.status] || APP_STATUS.submitted;
                      return (
                        <tr key={a._id}>
                          <td className="px-3 py-3 text-xs font-semibold text-slate-500">{i + 1}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <SchoolLogo school={a.school} />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">{a.school?.name || 'School'}</p>
                                <p className="truncate text-[11px] text-slate-500">{a.sessionTitle}{a.academicYear ? ` · ${a.academicYear}` : ''}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-bold text-indigo-700">{a.admissionNumber}</td>
                          <td className="px-3 py-3 text-xs text-slate-700">{a.studentName}<br /><span className="text-slate-400">{a.applyingForClass}</span></td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-700">{fmtDate(a.createdAt)}</td>
                          <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span></td>
                          <td className="px-3 py-3 text-right">
                            <button type="button" onClick={() => setViewApp(a)} aria-label="View application"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700">
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Mobile filters drawer */}
      {filtersOpen && (
        <div className="excuse-fade-in fixed inset-0 z-50 flex justify-end bg-slate-900/50 lg:hidden" onClick={() => setFiltersOpen(false)}>
          <div className="excuse-drawer-in h-full w-[85%] max-w-xs overflow-y-auto bg-slate-100 p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500"><X className="h-4 w-4" /></button>
            </div>
            {filterPanel}
          </div>
        </div>
      )}

      {/* View / print an earlier application */}
      {viewApp && (
        <div className="excuse-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 px-3 py-6">
          <div className="excuse-pop-in w-full max-w-3xl space-y-2">
            <div className="no-print flex justify-end gap-2">
              <button type="button" onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
                <Printer className="h-4 w-4" /> Print / Save as PDF
              </button>
              <button type="button" onClick={() => setViewApp(null)} aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <ApplicationSheet school={viewApp.school} application={viewApp} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdmissionHub;
