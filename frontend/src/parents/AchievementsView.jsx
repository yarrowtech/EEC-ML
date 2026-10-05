import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Filter,
  GraduationCap,
  Star,
  Tag,
  Trophy,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import { parentApiJson } from './parentApi';
import { useSharedChildSelection } from './ChildSwitcher';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import { PreviewModal, fileKind } from './DocPreview';
import GeneratedCertificate from './GeneratedCertificate';

/* ---------- client cache (stale-while-revalidate, per login) ----------
 * memory → localStorage (24h) → network. Anything older than FRESH_MS is shown
 * instantly and refreshed in the background. The server also caches the
 * endpoint for 60s per parent. */
const FRESH_MS = 60 * 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const cacheKey = () => {
  let t = '';
  try { t = localStorage.getItem('token') || ''; } catch { /* ignore */ }
  return `parent:achievements:v2:${t.slice(-16)}`;
};
let memCache = null;
let inflight = null;
const readCache = () => {
  const key = cacheKey();
  if (memCache?.key === key) return memCache;
  try {
    const entry = JSON.parse(localStorage.getItem(key) || 'null');
    memCache = entry && Date.now() - entry.at < MAX_AGE_MS ? { ...entry, key } : null;
  } catch { memCache = null; }
  return memCache;
};
const writeCache = (data) => {
  memCache = { key: cacheKey(), at: Date.now(), data };
  try { localStorage.setItem(memCache.key, JSON.stringify({ at: memCache.at, data })); } catch { /* quota */ }
};

const isExtra = (a) => a.category === 'Extra-Curricular' || a.category === 'Sports';
const isRecent = (a) => a.date && Date.now() - new Date(a.date).getTime() <= 30 * 24 * 60 * 60 * 1000;
const longDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

const CATEGORY_STYLE = {
  Academic: { chip: 'bg-blue-50 text-blue-600', Icon: GraduationCap },
  'Extra-Curricular': { chip: 'bg-rose-50 text-rose-500', Icon: Star },
  Sports: { chip: 'bg-emerald-50 text-emerald-600', Icon: Trophy },
  Other: { chip: 'bg-amber-50 text-amber-600', Icon: Tag },
};
const styleOf = (cat) => CATEGORY_STYLE[cat] || CATEGORY_STYLE.Other;

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

const selectClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
const arrowClass = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-blue-600';

/* ---------------------------- small parts ---------------------------- */

const StatCard = ({ label, value, hint, Icon, tone }) => (
  <Motion.div
    variants={fadeUp}
    whileHover={{ y: -2 }}
    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${tone.card}`}
  >
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}>
      <Icon size={20} />
    </span>
    <div className="min-w-0">
      <p className={`text-xs font-medium ${tone.label}`}>{label}</p>
      <p className="text-xl font-extrabold leading-tight text-[#10145c]">{value}</p>
      <p className="truncate text-[11px] text-slate-500">{hint}</p>
    </div>
  </Motion.div>
);

const CertificateThumb = ({ achievement, onOpen }) => {
  const kind = fileKind({ url: achievement.certificateUrl });
  return (
    <Motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ scale: 1.01 }}
      className="relative flex min-h-[140px] w-full items-center justify-center overflow-hidden rounded-lg border-4 border-[#b91c1c]/80 bg-[#fdf6e3] p-1"
      aria-label={`View ${achievement.title} certificate`}
    >
      {kind === 'image' ? (
        <img src={achievement.certificateUrl} alt={`${achievement.title} certificate`} className="max-h-[220px] w-full object-contain" />
      ) : (
        <div className="flex flex-col items-center gap-1.5 p-4 text-center">
          <Trophy size={30} className="text-amber-500" />
          <p className="font-serif text-base font-bold tracking-wide text-slate-800">CERTIFICATE</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">of achievement</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-red-600 shadow-sm">
            <FileText size={12} /> {kind === 'pdf' ? 'PDF' : 'File'} · Click to view
          </span>
        </div>
      )}
    </Motion.button>
  );
};

// Full details of one achievement (description, certificate, uploader…).
const downloadCertificatePdf = async (node, fileName) => {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: null,
    // The school logo stays on screen but is left out of the PDF.
    ignoreElements: (el) => el.dataset?.pdfExclude === 'true',
  });
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(fileName);
};

const AchievementModal = ({ achievement: a, onClose, onViewCertificate, certContext }) => {
  const certRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    if (!certRef.current || !a) return;
    setDownloading(true);
    try {
      await downloadCertificatePdf(certRef.current, `${(a.title || 'certificate').replace(/[^\w-]+/g, '_')}_certificate.pdf`);
    } finally {
      setDownloading(false);
    }
  };
  useEffect(() => {
    if (!a) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [a, onClose]);

  return createPortal(
    <AnimatePresence>
      {a && (
        <Motion.div
          key="ach-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9000] flex h-screen w-screen items-center justify-center bg-black/70 p-3 sm:p-6"
          onClick={onClose}
        >
          <Motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            {(() => {
              const st = styleOf(a.category);
              return (
                <>
                  <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-white shadow ring-4 ring-amber-100">
                      <Star size={17} fill="currentColor" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-[#10145c] sm:text-lg">{a.title}</h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.chip}`}>
                          <st.Icon size={12} /> {a.category || 'Other'}
                        </span>
                        {isRecent(a) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                            <Zap size={12} fill="currentColor" /> Recent
                          </span>
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="overflow-y-auto p-4">
                    {a.description && <p className="text-sm text-slate-600">{a.description}</p>}
                    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                      {a.certificateUrl ? (
                        <CertificateThumb achievement={a} onOpen={onViewCertificate} />
                      ) : (
                        <div className="self-start">
                          <GeneratedCertificate
                            ref={certRef}
                            schoolName={certContext?.schoolName}
                            schoolLogo={certContext?.schoolLogo}
                            studentName={certContext?.studentName}
                            grade={certContext?.grade}
                            teacherName={a.issuer || certContext?.teacherName}
                            title={a.title}
                            description={a.description}
                            category={a.category}
                            date={a.date}
                          />
                        </div>
                      )}
                      <div className="overflow-hidden rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2.5 bg-blue-50/60 px-3 py-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                            <FileText size={15} />
                          </span>
                          <p className="text-sm font-bold text-[#10145c]">Certificate</p>
                        </div>
                        <div className="space-y-2 p-3 text-[13px]">
                          <div>
                            <p className="text-[11px] text-slate-500">Uploaded By</p>
                            <p className="mt-0.5 flex items-center gap-2 font-medium text-slate-800">
                              <UserRound size={14} className="shrink-0 text-slate-500" /> {String(a.issuer || 'School').replace(/\s*\(Class Teacher\)\s*$/i, '')}
                            </p>
                          </div>
                          <p className="flex items-center gap-2 font-medium text-slate-800">
                            <CalendarDays size={14} className="shrink-0 text-slate-500" /> {longDate(a.date)}
                          </p>
                          <div>
                            <p className="flex items-center gap-2 text-[11px] text-slate-500"><Calendar size={12} /> Category</p>
                            <p className="mt-0.5 flex items-center gap-2 font-medium text-slate-800">
                              <st.Icon size={14} className="shrink-0 text-slate-500" /> {a.category || 'Other'}
                            </p>
                          </div>
                          {!a.certificateUrl && (
                            <Motion.button
                              type="button"
                              whileTap={{ scale: 0.97 }}
                              onClick={handleDownload}
                              disabled={downloading}
                              className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                            >
                              <Download size={14} /> {downloading ? 'Preparing…' : 'Download Certificate'}
                            </Motion.button>
                          )}
                          {a.certificateUrl && (
                            <Motion.button
                              type="button"
                              whileTap={{ scale: 0.97 }}
                              onClick={onViewCertificate}
                              className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-300 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                            >
                              <ExternalLink size={14} /> View Certificate
                            </Motion.button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

/* ------------------------------- page ------------------------------- */

const AchievementsView = () => {
  const navigate = useNavigate();
  const initial = readCache()?.data || null;
  const [childrenReports, setChildrenReports] = useState(initial?.children || []);
  const [school, setSchool] = useState(initial?.school || {});
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [draft, setDraft] = useState({ category: 'all', year: 'all' });
  const [filter, setFilter] = useState({ category: 'all', year: 'all' });
  const [preview, setPreview] = useState(null);
  const tabsRef = useRef(null);
  const [showFilter, setShowFilter] = useState(false);
  const [detail, setDetail] = useState(null);
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const updateScroll = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    setScrollState({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return undefined;
    updateScroll();
    el.addEventListener('scroll', updateScroll, { passive: true });
    const ro = new ResizeObserver(updateScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateScroll); ro.disconnect(); };
  }, [updateScroll]);
  const scrollTabs = (dir) => tabsRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });

  const load = useCallback(async (force = false) => {
    const cached = readCache();
    if (!force && cached && Date.now() - cached.at < FRESH_MS) {
      setChildrenReports(cached.data.children || []);
      setSchool(cached.data.school || {});
      setLoading(false);
      return;
    }
    if (!cached) setLoading(true);
    setError('');
    try {
      if (!inflight) {
        inflight = parentApiJson('/api/parent/auth/achievements', {}, navigate).finally(() => { inflight = null; });
      }
      const data = await inflight;
      const children = (Array.isArray(data?.children) ? data.children : []).map((c) => ({
        ...c,
        achievements: Array.isArray(c.achievements) ? c.achievements : [],
      }));
      setChildrenReports(children);
      setSchool(data?.school || {});
      writeCache({ children, school: data?.school || {} });
    } catch (err) {
      if (!cached) setError(err.message || 'Unable to load achievements');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const childOptions = useMemo(
    () => childrenReports.map((c) => ({ id: String(c.studentId || ''), name: c.studentName || 'Student' })),
    [childrenReports],
  );
  const [, , selectedOption] = useSharedChildSelection(childOptions);
  const kids = useMemo(
    () => childrenReports.map((c) => ({
      id: String(c.studentId || ''),
      name: c.studentName || 'Student',
      photo: c.photo,
      grade: c.grade,
      section: c.section,
      roll: c.roll,
    })),
    [childrenReports],
  );
  const selectedChild = childrenReports.find((c) => String(c.studentId) === selectedOption?.id) || null;
  const all = useMemo(
    () => [...(selectedChild?.achievements || [])].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)),
    [selectedChild],
  );

  const years = useMemo(
    () => [...new Set(all.map((a) => a.date && new Date(a.date).getFullYear()).filter(Boolean))].sort((a, b) => b - a),
    [all],
  );
  const categories = useMemo(() => [...new Set(all.map((a) => a.category).filter(Boolean))], [all]);

  const counts = {
    all: all.length,
    academic: all.filter((a) => a.category === 'Academic').length,
    extra: all.filter(isExtra).length,
    certificates: all.length,
    recent: all.filter(isRecent).length,
  };

  const visible = all.filter((a) => {
    if (tab === 'academic' && a.category !== 'Academic') return false;
    if (tab === 'extra' && !isExtra(a)) return false;
    if (filter.category !== 'all' && a.category !== filter.category) return false;
    if (filter.year !== 'all' && String(new Date(a.date).getFullYear()) !== filter.year) return false;
    return true;
  });


  const openCertificate = (a) => setPreview({
    name: `${a.title} Certificate`,
    url: a.certificateUrl,
    date: a.date,
    verified: true,
  });

  const TABS = [
    { key: 'all', label: `All (${counts.all})`, Icon: GraduationCap, iconClass: 'text-blue-600' },
    { key: 'academic', label: `Academic (${counts.academic})`, Icon: GraduationCap, iconClass: 'text-blue-600' },
    { key: 'extra', label: `Extra-Curricular (${counts.extra})`, Icon: Star, iconClass: 'text-amber-500' },
    { key: 'certificates', label: `Certificates (${counts.certificates})`, Icon: FileText, iconClass: 'text-blue-600' },
  ];

  return (
    <div className="min-h-full space-y-3 bg-[#f5f8ff] p-3 sm:p-4">
      {/* Header + child selector */}
      <Motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-20 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100/80 text-orange-500">
            <Trophy size={24} />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight text-[#10145c] sm:text-2xl">Achievements</h1>
            <p className="text-xs text-slate-500 sm:text-sm">Awards, medals and certificates your child has earned this year.</p>
          </div>
        </div>
      </Motion.div>

      {/* Stats */}
      <Motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Total Awards" value={counts.all} hint="All time accomplishments" Icon={Trophy}
          tone={{ card: 'border-blue-100 bg-blue-50/40', icon: 'bg-blue-100 text-blue-600', label: 'text-blue-600' }} />
        <StatCard label="Academic" value={counts.academic} hint="Scholastic excellence" Icon={GraduationCap}
          tone={{ card: 'border-emerald-100 bg-emerald-50/40', icon: 'bg-emerald-100 text-emerald-600', label: 'text-emerald-600' }} />
        <StatCard label="Extra-Curricular" value={counts.extra} hint="Talent & Sports" Icon={Star}
          tone={{ card: 'border-rose-100 bg-rose-50/40', icon: 'bg-rose-100 text-rose-500', label: 'text-rose-500' }} />
        <StatCard label="Recent Wins" value={counts.recent} hint="Last 30 days" Icon={BarChart3}
          tone={{ card: 'border-amber-100 bg-amber-50/40', icon: 'bg-amber-100 text-amber-500', label: 'text-amber-600' }} />
      </Motion.div>

      {/* Tabs with scroll arrows */}
      <div className="flex items-center gap-2">
        {scrollState.left && (
          <button type="button" onClick={() => scrollTabs(-1)} aria-label="Scroll tabs left" className={arrowClass}>
            <ChevronLeft size={18} />
          </button>
        )}
        <div ref={tabsRef} className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ key, label, Icon, iconClass }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full border px-4 py-2 text-xs font-semibold transition sm:min-w-[140px] ${tab === key ? 'border-violet-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              {tab === key && (
                <Motion.span layoutId="achievement-tab" className="absolute inset-0 bg-violet-600" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
              )}
              <span className="relative flex items-center gap-2">
                <Icon size={15} className={tab === key ? 'text-white' : iconClass} /> {label}
              </span>
            </button>
          ))}
        </div>
        {scrollState.right && (
          <button type="button" onClick={() => scrollTabs(1)} aria-label="Scroll tabs right" className={arrowClass}>
            <ChevronRight size={18} />
          </button>
        )}
        <Motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowFilter((v) => !v)}
          aria-label={showFilter ? 'Hide filter' : 'Show filter'}
          aria-expanded={showFilter}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border shadow-sm transition ${showFilter ? 'border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100' : 'border-slate-200 bg-white text-violet-600 hover:bg-blue-50'}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <Motion.span
              key={showFilter ? 'x' : 'f'}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex"
            >
              {showFilter ? <X size={18} /> : <Filter size={17} />}
            </Motion.span>
          </AnimatePresence>
        </Motion.button>
      </div>

      {/* Filter */}
      <AnimatePresence initial={false}>
      {showFilter && (
      <Motion.section
        key="filter"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.22 }}
        style={{ overflow: 'hidden' }}
        className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-3 shadow-[0_2px_12px_rgba(15,23,42,0.04)] md:flex-row md:items-end md:gap-3"
      >
        <div className="flex items-center gap-2 md:mb-2 md:mr-1">
          <Filter size={17} className="text-blue-600" />
          <h3 className="whitespace-nowrap text-sm font-bold text-[#10145c]">Filter Achievements</h3>
        </div>
        <label className="block flex-1">
          <span className="text-xs font-medium text-slate-600">Category</span>
          <select value={draft.category} onChange={(e) => setDraft((s) => ({ ...s, category: e.target.value }))} className={selectClass}>
            <option value="all">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block flex-1">
          <span className="text-xs font-medium text-slate-600">Year</span>
          <select value={draft.year} onChange={(e) => setDraft((s) => ({ ...s, year: e.target.value }))} className={selectClass}>
            <option value="all">All Years</option>
            {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </label>
        <Motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => setFilter(draft)}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Filter size={15} /> Apply Filter
        </Motion.button>
      </Motion.section>
      )}
      </AnimatePresence>

      {/* Timeline */}
      <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-3 bg-blue-50/60 px-3 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <Trophy size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#10145c]">Achievement Timeline</h2>
            <p className="text-[11px] text-slate-500">A chronological view of your child&apos;s achievements.</p>
          </div>
        </div>

        <div className="p-3">
          {loading ? (
            <Loading label="achievements" rows={3} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => load(true)} />
          ) : visible.length === 0 ? (
            <EmptyState icon={Trophy} title="No achievements yet" hint="Awards and certificates appear here once the school records them." />
          ) : (
            <Motion.ol
              key={`${tab}-${filter.category}-${filter.year}-${selectedOption?.id || ''}`}
              variants={stagger}
              initial="hidden"
              animate="show"
              className="relative space-y-3"
            >
              {visible.map((a, idx) => {
                const st = styleOf(a.category);
                const d = a.date ? new Date(a.date) : null;
                return (
                  <Motion.li variants={fadeUp} key={a._id || idx} className="relative flex gap-3">
                    {/* Rail + date */}
                    <div className="relative hidden w-20 shrink-0 sm:block">
                      <span className="absolute bottom-[-0.75rem] left-[11px] top-7 w-px bg-slate-200" />
                      <span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 ring-4 ring-blue-100">
                        <span className="h-2 w-2 rounded-full bg-white" />
                      </span>
                      {d && (
                        <div className="mt-1.5 pl-7 text-center">
                          <p className="text-lg font-bold leading-tight text-[#10145c]">{d.getDate()}</p>
                          <p className="text-[10px] font-medium uppercase text-slate-500">
                            {d.toLocaleDateString('en-GB', { month: 'short' })} {d.getFullYear()}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Card — title + category; click for full details */}
                    <Motion.button
                      type="button"
                      onClick={() => setDetail(a)}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-100 p-3 text-left shadow-[0_1px_6px_rgba(15,23,42,0.04)] transition hover:border-blue-200 hover:shadow-md"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-white shadow ring-4 ring-amber-100">
                        <Star size={17} fill="currentColor" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-bold text-[#10145c] sm:text-base">{a.title}</h3>
                        <span className={`mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.chip}`}>
                          <st.Icon size={12} /> {a.category || 'Other'}
                        </span>
                        {d && <p className="mt-1 text-xs text-slate-400 sm:hidden">{longDate(a.date)}</p>}
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-slate-400" />
                    </Motion.button>
                  </Motion.li>
                );
              })}
            </Motion.ol>
          )}
        </div>
      </section>

      <AchievementModal
        achievement={detail}
        onClose={() => setDetail(null)}
        onViewCertificate={() => detail && openCertificate(detail)}
        certContext={{
          schoolName: school?.name,
          schoolLogo: school?.logo,
          studentName: selectedChild?.studentName,
          grade: selectedChild?.grade,
          teacherName: selectedChild?.classTeacher,
        }}
      />
      <PreviewModal doc={preview} onClose={() => setPreview(null)} />
    </div>
  );
};

export default AchievementsView;
