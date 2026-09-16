import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarCheck2, CalendarDays, ChevronDown, ChevronRight, ChevronUp, Download, Loader2, Search } from 'lucide-react';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import { parentApiFetch } from './parentApi';

const CARD = 'rounded-xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]';

// Client-side cache: paint the last holiday list instantly, then refresh it
// in the background. Scoped to the logged-in token.
const HOLIDAYS_CACHE_KEY = 'parent_holidays_cache_v1';
const HOLIDAYS_CACHE_TTL_MS = 5 * 60 * 1000;

const holidaysCacheScope = () => {
  try {
    return (localStorage.getItem('token') || '').split('.')[1] || 'anonymous';
  } catch {
    return 'anonymous';
  }
};

const readHolidaysCache = () => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(HOLIDAYS_CACHE_KEY) || 'null');
    if (!parsed || parsed.scope !== holidaysCacheScope()) return null;
    if (Date.now() - parsed.cachedAt > HOLIDAYS_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeHolidaysCache = (data) => {
  try {
    sessionStorage.setItem(HOLIDAYS_CACHE_KEY, JSON.stringify({ scope: holidaysCacheScope(), cachedAt: Date.now(), data }));
  } catch {
    // Storage full/blocked — caching is best-effort.
  }
};

const RISE = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};
const PAGE_MOTION = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

// Holidays carry no type, so the badge is inferred from the name.
const HOLIDAY_TYPES = [
  { label: 'National Holiday', tone: 'bg-rose-50 text-rose-600', match: /independence|republic|gandhi|christmas|guru nanak|ambedkar|labour|may day/i },
  { label: 'Festival Holiday', tone: 'bg-emerald-50 text-emerald-600', match: /puja|durga|diwali|deepavali|holi|dussehra|navami|ashtami|saptami|dashami|pongal|onam|kali/i },
  { label: 'Religious Holiday', tone: 'bg-amber-50 text-amber-600', match: /eid|bakrid|muharram|buddha|good friday|easter|mahavir|ramzan|ramadan|shab/i },
];
const DEFAULT_TYPE = { label: 'Cultural Holiday', tone: 'bg-violet-50 text-violet-600' };
const holidayType = (name) => HOLIDAY_TYPES.find((t) => t.match.test(String(name || ''))) || DEFAULT_TYPE;

// Fallback when the school has no active academic year: April → March.
const sessionOf = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
};
const sessionLabel = (key) => (key ? key.replace('-', ' - ') : '');

// The backend sends the school's active session; derive its date window.
const sessionWindow = (activeSession) => {
  const start = new Date(activeSession?.startDate);
  const end = new Date(activeSession?.endDate);
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    return { name: activeSession.name || '', start, end };
  }
  const key = activeSession?.name || sessionOf(new Date());
  const startYear = Number(String(key).slice(0, 4)) || new Date().getFullYear();
  return {
    name: activeSession?.name || sessionLabel(sessionOf(new Date())),
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999),
  };
};

const formatCompactDate = (value) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatWeekday = (value) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { weekday: 'long' });
};

const toBase64Image = async (url) => {
  if (!url) return null;
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const getHolidayDuration = (startValue, endValue) => {
  const start = new Date(startValue);
  const end = new Date(endValue || startValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((end - start) / dayMs) + 1);
};

const isPastHoliday = (startValue, endValue) => {
  const dt = new Date(endValue || startValue);
  if (Number.isNaN(dt.getTime())) return false;
  const holidayDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return holidayDay < today;
};


const startOf = (item) => new Date(item.startDate || item.date).getTime() || 0;

const HolidayList = () => {
  const navigate = useNavigate();
  const cached = readHolidaysCache();
  const [holidays, setHolidays] = useState(() => cached?.holidays || []);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [schoolMeta, setSchoolMeta] = useState(() => cached?.schoolMeta || { schoolName: 'School', schoolAddress: '', schoolLogo: '' });
  const [activeSession, setActiveSession] = useState(() => cached?.activeSession || null);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState({ upcoming: true, past: true });

  useEffect(() => {
    const load = async () => {
      const hasCache = Boolean(readHolidaysCache());
      if (!hasCache) setLoading(true);
      setError('');
      try {
        const res = await parentApiFetch('/api/holidays/parent', {}, navigate);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'Unable to load holidays');
        }

        const holidayItems = Array.isArray(data)
          ? data
          : Array.isArray(data?.holidays)
            ? data.holidays
            : [];
        const meta = {
          schoolName: data?.school?.name || 'School',
          schoolAddress: data?.school?.address || '',
          schoolLogo: data?.school?.logo || '',
        };
        const sessionInfo = data?.activeSession || null;
        setHolidays(holidayItems);
        setSchoolMeta(meta);
        setActiveSession(sessionInfo);
        writeHolidaysCache({ holidays: holidayItems, schoolMeta: meta, activeSession: sessionInfo });
      } catch (err) {
        // Keep showing cached data if a background refresh fails.
        if (!hasCache) setError(err.message || 'Unable to load holidays');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const session = useMemo(() => sessionWindow(activeSession), [activeSession]);

  const sessionHolidays = useMemo(
    () => holidays.filter((item) => {
      const start = new Date(item.startDate || item.date);
      const end = new Date(item.endDate || item.startDate || item.date);
      return end >= session.start && start <= session.end;
    }),
    [holidays, session],
  );

  const handleDownloadPdf = async () => {
    if (!sessionHolidays.length || downloading) return;
    setDownloading(true);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const schoolName = schoolMeta.schoolName || 'School';
      const schoolAddress = schoolMeta.schoolAddress || '';
      const logoData = await toBase64Image(schoolMeta.schoolLogo);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PW = 210;
      const PH = 297;
      const ML = 14;
      const MR = 14;
      const CONTENT_W = PW - ML - MR;
      let y = 14;

      if (logoData) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(ML, y, 20, 20, 2, 2, 'F');
        try {
          doc.addImage(logoData, ML + 2, y + 2, 16, 16);
        } catch {
          // no-op if logo decode fails
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text(schoolName, PW / 2, y + 7, { align: 'center' });

      if (schoolAddress) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(String(schoolAddress).slice(0, 100), PW / 2, y + 12.5, { align: 'center' });
      }

      y += 24;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.35);
      doc.line(ML, y, PW - MR, y);
      y += 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(17, 24, 39);
      doc.text(`Holiday Calendar ${session.name}`, PW / 2, y, { align: 'center' });
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Prepared on ${now.toLocaleDateString()}`, ML, y);
      doc.text(`Total holidays ${sessionHolidays.length}`, PW - MR, y, { align: 'right' });
      y += 8;

      const rows = [...sessionHolidays].sort((a, b) => startOf(a) - startOf(b));

      const col = {
        sl: 12,
        name: 64,
        date: 44,
        day: 40,
        days: 22,
      };
      const rowMinH = 8;

      const drawHeaderRow = (top) => {
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(ML, top, CONTENT_W, rowMinH, 1.2, 1.2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text('#', ML + col.sl / 2, top + 5.3, { align: 'center' });
        doc.text('Holiday', ML + col.sl + 2, top + 5.3);
        doc.text('Date', ML + col.sl + col.name + 2, top + 5.3);
        doc.text('Day', ML + col.sl + col.name + col.date + col.day / 2, top + 5.3, { align: 'center' });
        doc.text('Days', ML + col.sl + col.name + col.date + col.day + col.days / 2, top + 5.3, { align: 'center' });
      };

      drawHeaderRow(y);
      y += rowMinH;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      rows.forEach((item, idx) => {
        const start = item.startDate || item.date;
        const end = item.endDate || item.startDate || item.date;
        const compactStart = formatCompactDate(start);
        const compactEnd = formatCompactDate(end);
        const dateLabel = compactStart === compactEnd ? compactStart : `${compactStart} to ${compactEnd}`;
        const dayLabel = formatWeekday(start);
        const days = getHolidayDuration(start, end);

        const nameLines = doc.splitTextToSize(String(item.name || 'Untitled holiday'), col.name - 4);
        const dateLines = doc.splitTextToSize(dateLabel, col.date - 4);
        const maxLines = Math.max(nameLines.length, dateLines.length, 1);
        const rowH = Math.max(rowMinH, maxLines * 4 + 3.2);

        if (y + rowH > PH - 16) {
          doc.addPage();
          y = 14;
          drawHeaderRow(y);
          y += rowMinH;
          doc.setFont('helvetica', 'normal');
        }

        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(ML, y, CONTENT_W, rowH, 'F');
        }

        doc.setDrawColor(226, 232, 240);
        doc.rect(ML, y, CONTENT_W, rowH);
        doc.setTextColor(51, 65, 85);
        doc.text(String(idx + 1), ML + col.sl / 2, y + 5.2, { align: 'center' });
        doc.text(nameLines, ML + col.sl + 2, y + 5.2);
        doc.text(dateLines, ML + col.sl + col.name + 2, y + 5.2);
        doc.text(dayLabel, ML + col.sl + col.name + col.date + col.day / 2, y + 5.2, { align: 'center' });
        doc.text(String(days), ML + col.sl + col.name + col.date + col.day + col.days / 2, y + 5.2, { align: 'center' });
        y += rowH;
      });

      const totalPages = doc.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setTextColor(100, 116, 139);
        doc.line(ML, PH - 12, PW - MR, PH - 12);
        doc.text('System generated holiday calendar', ML, PH - 7.5);
        doc.text(`Page ${page} of ${totalPages}`, PW - MR, PH - 7.5, { align: 'right' });
      }

      doc.save(`holiday-list-${(session.name || String(currentYear)).replace(/\s+/g, '')}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  const { upcoming, past } = useMemo(() => {
    const up = [];
    const pa = [];
    sessionHolidays.forEach((item) => {
      (isPastHoliday(
        item.startDate || item.date,
        item.endDate || item.startDate || item.date,
      ) ? pa : up).push(item);
    });
    up.sort((a, b) => startOf(a) - startOf(b)); // soonest first
    pa.sort((a, b) => startOf(b) - startOf(a)); // most recent past first
    return { upcoming: up, past: pa };
  }, [sessionHolidays]);

  const matches = (item) => !query.trim() || String(item.name || '').toLowerCase().includes(query.trim().toLowerCase());
  const groups = [
    { key: 'upcoming', label: 'Upcoming Holidays', rows: upcoming.filter(matches), tone: 'bg-emerald-50/70 text-emerald-800', icon: 'text-emerald-700' },
    { key: 'past', label: 'Past Holidays', rows: past.filter(matches), tone: 'bg-blue-50/70 text-[#0b1446]', icon: 'text-blue-600' },
  ].filter((g) => tab === 'all' || tab === g.key);

  const tabs = [
    { key: 'all', label: `All (${sessionHolidays.length})` },
    { key: 'upcoming', label: `Upcoming (${upcoming.length})` },
    { key: 'past', label: `Past (${past.length})` },
  ];


  const dateLabel = (item) => {
    const start = formatCompactDate(item.startDate || item.date);
    const end = formatCompactDate(item.endDate || item.startDate || item.date);
    return start === end ? start : `${start} – ${end}`;
  };

  return (
    <motion.div variants={PAGE_MOTION} initial="hidden" animate="show" className="space-y-3 p-3 sm:p-4 md:p-5">
      <motion.nav variants={RISE} aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
        <span>Academic Calendar</span>
        <ChevronRight size={12} />
        <span className="font-medium text-[#0b1446]">Holiday List</span>
      </motion.nav>

      <motion.header variants={RISE} className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
            <CalendarCheck2 size={22} />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight text-[#0b1446]">Holiday List</h1>
            <p className="text-xs text-slate-500 sm:text-sm">School holidays and scheduled breaks in one place.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={loading || !sessionHolidays.length || downloading}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3.5 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
          {downloading ? 'Preparing...' : 'Download PDF'}
        </button>
      </motion.header>


      {/* Stats */}
      <motion.div variants={RISE} className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-xl border border-rose-100 bg-rose-50/60 px-4 py-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100/80 text-rose-500"><CalendarCheck2 size={22} /></span>
          <div>
            <p className="text-xs font-medium text-rose-600">Total holidays</p>
            <p className="text-2xl font-bold leading-tight text-[#0b1446]">{loading ? '—' : sessionHolidays.length}</p>
            <p className="text-[11px] text-slate-500">{session.name ? `Session ${session.name}` : 'This session'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100/80 text-emerald-600"><CalendarCheck2 size={22} /></span>
          <div>
            <p className="text-xs font-medium text-slate-600">Upcoming</p>
            <p className="text-2xl font-bold leading-tight text-[#0b1446]">{loading ? '—' : upcoming.length}</p>
            <p className="text-[11px] text-slate-500">Holidays remaining</p>
          </div>
        </div>
      </motion.div>

      {/* List */}
      <motion.section variants={RISE} className={`${CARD} p-3`}>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-lg border px-4 py-1.5 text-xs font-semibold transition ${tab === t.key ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-[#0b1446] hover:bg-slate-50'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="relative sm:w-56">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search holiday..."
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        {loading ? (
          <Loading label="holidays" rows={4} />
        ) : error ? (
          <ErrorState message={error} />
        ) : sessionHolidays.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No holidays announced yet" hint="Holidays appear here once the school publishes them." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full min-w-[620px] text-xs">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold text-[#0b1446]">
                <tr>
                  <th className="w-12 px-3 py-2">#</th>
                  <th className="w-[22%] px-3 py-2">Date</th>
                  <th className="w-[18%] px-3 py-2">Day</th>
                  <th className="px-3 py-2">Holiday Name</th>
                  <th className="w-36 px-3 py-2"><span className="sr-only">Type</span></th>
                </tr>
              </thead>
              {groups.map((group) => {
                const isOpen = openGroups[group.key];
                return (
                  <tbody key={group.key}>
                    <tr className={group.tone}>
                      <td colSpan={5} className="p-0">
                        <button
                          type="button"
                          onClick={() => setOpenGroups((o) => ({ ...o, [group.key]: !o[group.key] }))}
                          aria-expanded={isOpen}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold"
                        >
                          <CalendarDays size={15} className={group.icon} />
                          {group.label} ({group.rows.length})
                          {isOpen ? <ChevronUp size={15} className="ml-auto" /> : <ChevronDown size={15} className="ml-auto" />}
                        </button>
                      </td>
                    </tr>
                    <AnimatePresence initial={false}>
                      {isOpen && group.rows.map((item, idx) => {
                        const type = holidayType(item.name);
                        return (
                          <motion.tr
                            key={item._id || `${group.key}-${idx}`}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0, transition: { delay: Math.min(idx, 12) * 0.02 } }}
                            exit={{ opacity: 0 }}
                            className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50/70"
                          >
                            <td className="px-3 py-1.5">{idx + 1}</td>
                            <td className="px-3 py-1.5">{dateLabel(item)}</td>
                            <td className="px-3 py-1.5">{formatWeekday(item.startDate || item.date)}</td>
                            <td className="px-3 py-1.5 text-[#0b1446]">{item.name}</td>
                            <td className="px-3 py-1.5 text-right">
                              <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${type.tone}`}>{type.label}</span>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                    {isOpen && group.rows.length === 0 ? (
                      <tr className="border-t border-slate-100"><td colSpan={5} className="px-3 py-3 text-center text-slate-400">No holidays found.</td></tr>
                    ) : null}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}
      </motion.section>
    </motion.div>
  );
};

export default HolidayList;
