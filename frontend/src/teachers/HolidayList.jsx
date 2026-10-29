import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  Bell,
  BookOpenCheck,
  Check,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Filter,
  GraduationCap,
  Loader2,
  MoreHorizontal,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const DAY_MS = 24 * 60 * 60 * 1000;

const EVENT_TYPES = {
  holiday: {
    label: 'Holidays',
    icon: CalendarDays,
    chip: 'bg-[#dcf5e6] text-[#15803d]',
    dot: 'bg-[#16a34a]',
    soft: 'bg-[#e9f9ef] text-[#166534]',
  },
  exam: {
    label: 'Exams',
    icon: GraduationCap,
    chip: 'bg-[#fde0e0] text-[#b91c1c]',
    dot: 'bg-[#ef4444]',
    soft: 'bg-[#fdecec] text-[#991b1b]',
  },
  assignment: {
    label: 'Assignments',
    icon: ClipboardList,
    chip: 'bg-[#fdf0d2] text-[#b45309]',
    dot: 'bg-[#f59e0b]',
    soft: 'bg-[#fff6e0] text-[#92400e]',
  },
  meeting: {
    label: 'Meetings',
    icon: Users,
    chip: 'bg-[#ece2fe] text-[#7e22ce]',
    dot: 'bg-[#8b5cf6]',
    soft: 'bg-[#f3ecff] text-[#6b21a8]',
  },
  school: {
    label: 'School Events',
    icon: Sparkles,
    chip: 'bg-[#dbe7fe] text-[#1d4ed8]',
    dot: 'bg-[#2563eb]',
    soft: 'bg-[#e8f0ff] text-[#1e3a8a]',
  },
  reminder: {
    label: 'Reminders',
    icon: Bell,
    chip: 'bg-[#fce7f3] text-[#be185d]',
    dot: 'bg-[#ec4899]',
    soft: 'bg-[#fdf0f7] text-[#9d174d]',
  },
  teacher: {
    label: 'Teacher Events',
    icon: BookOpenCheck,
    chip: 'bg-[#efe4fd] text-[#7e22ce]',
    dot: 'bg-[#a855f7]',
    soft: 'bg-[#f6effe] text-[#6b21a8]',
  },
};

const pad = (value) => String(value).padStart(2, '0');
const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const formatDate = (value) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
};

const formatCompactDate = (value) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatShortDate = (value) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatDateRange = (startValue, endValue) => {
  const start = formatCompactDate(startValue);
  const end = formatCompactDate(endValue || startValue);
  return start === end ? start : `${start} - ${end}`;
};

const getHolidayDuration = (startValue, endValue) => {
  const start = new Date(startValue);
  const end = new Date(endValue || startValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  return Math.max(1, Math.floor((startOfDay(end) - startOfDay(start)) / DAY_MS) + 1);
};

const isPastEvent = (event) => startOfDay(new Date(event.endDate || event.startDate)) < startOfDay(new Date());

const getCountdown = (event) => {
  const today = startOfDay(new Date());
  const start = startOfDay(new Date(event.startDate));
  const end = startOfDay(new Date(event.endDate || event.startDate));
  if (end < today) return 'Archived';
  if (start <= today && end >= today) return 'Today';
  const days = Math.ceil((start - today) / DAY_MS);
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
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

const overlapsYear = (startValue, endValue, year) => {
  const start = new Date(startValue);
  const end = new Date(endValue || startValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return end >= new Date(year, 0, 1) && start <= new Date(year, 11, 31, 23, 59, 59, 999);
};

const buildMonthDays = (monthDate) => {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
};

const buildSeedEvents = (baseDate) => {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  return [
    { id: 'exam-1', title: 'Unit Test: Mathematics', type: 'exam', startDate: new Date(year, month, 6), endDate: new Date(year, month, 6), time: '10:00 AM', meta: 'Class 8A' },
    { id: 'assignment-1', title: 'Science worksheet due', type: 'assignment', startDate: new Date(year, month, 10), endDate: new Date(year, month, 10), time: '11:59 PM', meta: 'Grade 7' },
    { id: 'meeting-1', title: 'Parent conference block', type: 'meeting', startDate: new Date(year, month, 14), endDate: new Date(year, month, 14), time: '03:30 PM', meta: 'Room 204' },
    { id: 'school-1', title: 'School assembly', type: 'school', startDate: new Date(year, month, 18), endDate: new Date(year, month, 18), time: '08:45 AM', meta: 'Auditorium' },
    { id: 'reminder-1', title: 'Submit weekly lesson notes', type: 'reminder', startDate: new Date(year, month, 22), endDate: new Date(year, month, 22), time: '04:00 PM', meta: 'Teaching workspace' },
    { id: 'teacher-1', title: 'Department planning sync', type: 'teacher', startDate: new Date(year, month, 25), endDate: new Date(year, month, 25), time: '02:00 PM', meta: 'Faculty room' },
  ];
};

// Client cache: show the last calendar instantly, then refresh in the background.
const CALENDAR_CACHE_KEY = 'teacher-calendar-cache-v1';
const CALENDAR_CACHE_TTL = 10 * 60 * 1000;
const readCalendarCache = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(CALENDAR_CACHE_KEY) || 'null');
    const owner = JSON.parse(localStorage.getItem('user') || '{}')?._id || localStorage.getItem('token')?.slice(-16) || '';
    return raw && raw.owner === owner ? raw : null;
  } catch { return null; }
};
const writeCalendarCache = (patch) => {
  try {
    const owner = JSON.parse(localStorage.getItem('user') || '{}')?._id || localStorage.getItem('token')?.slice(-16) || '';
    const prev = readCalendarCache() || {};
    localStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify({ ...prev, ...patch, owner, savedAt: Date.now() }));
  } catch { /* storage full / private mode */ }
};

const HolidayList = () => {
  const cached = useMemo(readCalendarCache, []);
  const [holidays, setHolidays] = useState(() => cached?.holidays || []);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [schoolMeta, setSchoolMeta] = useState(() => cached?.schoolMeta || { schoolName: 'School', schoolAddress: '', schoolLogo: '' });
  const [activeDate, setActiveDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [query, setQuery] = useState('');
  const [activeTypes, setActiveTypes] = useState(() => new Set(Object.keys(EVENT_TYPES)));
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    const load = async () => {
      const fresh = cached && Date.now() - (cached.savedAt || 0) < CALENDAR_CACHE_TTL;
      if (!cached) setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/holidays/teacher`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.error || 'Unable to load holidays');
        const list = Array.isArray(data) ? data : [];
        setHolidays(list);
        writeCalendarCache({ holidays: list });
        // School letterhead details rarely change — reuse them while the cache is fresh.
        if (fresh && cached?.schoolMeta) return;

        const trySetMetaFromPayload = (payload) => {
          const source = payload?.teacher || payload || {};
          const schoolName = source?.schoolName || source?.school?.name || source?.campusName || '';
          const schoolAddress = source?.schoolAddress || source?.school?.address || source?.campusAddress || source?.address || '';
          const schoolLogo = source?.schoolLogo || source?.school?.logo?.secure_url || source?.school?.logo || '';
          if (schoolName || schoolAddress || schoolLogo) {
            const meta = { schoolName: schoolName || 'School', schoolAddress: schoolAddress || '', schoolLogo: schoolLogo || '' };
            setSchoolMeta(meta);
            writeCalendarCache({ schoolMeta: meta });
            return true;
          }
          return false;
        };

        try {
          const routineRes = await fetch(`${API_BASE}/api/teacher/dashboard/routine`, { headers: { authorization: `Bearer ${token}` } });
          if (routineRes.ok && trySetMetaFromPayload(await routineRes.json().catch(() => ({})))) return;
        } catch { /* ignore fallback */ }

        try {
          const dashRes = await fetch(`${API_BASE}/api/teacher/dashboard`, { headers: { authorization: `Bearer ${token}` } });
          if (dashRes.ok && trySetMetaFromPayload(await dashRes.json().catch(() => ({})))) return;
        } catch { /* ignore fallback */ }

        trySetMetaFromPayload(JSON.parse(localStorage.getItem('user') || '{}'));
      } catch (err) {
        if (!cached) setError(err.message || 'Unable to load holidays');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const holidayEvents = useMemo(() => holidays.map((item, index) => ({
    id: item._id || `holiday-${index}`,
    title: item.name || 'Untitled holiday',
    type: 'holiday',
    startDate: new Date(item.startDate || item.date),
    endDate: new Date(item.endDate || item.startDate || item.date),
    time: 'All day',
    meta: `${getHolidayDuration(item.startDate || item.date, item.endDate || item.startDate || item.date)} day holiday`,
    raw: item,
  })).filter((event) => !Number.isNaN(event.startDate.getTime())), [holidays]);

  const allEvents = useMemo(() => [...holidayEvents, ...buildSeedEvents(activeDate)], [activeDate, holidayEvents]);

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allEvents
      .filter((event) => activeTypes.has(event.type))
      .filter((event) => !needle || `${event.title} ${event.meta} ${EVENT_TYPES[event.type]?.label}`.toLowerCase().includes(needle))
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  }, [activeTypes, allEvents, query]);

  const eventsByDay = useMemo(() => filteredEvents.reduce((acc, event) => {
    const start = startOfDay(new Date(event.startDate));
    const end = startOfDay(new Date(event.endDate || event.startDate));
    const span = Math.min(62, Math.max(0, Math.round((end - start) / DAY_MS)));
    for (let i = 0; i <= span; i += 1) {
      const key = dateKey(addDays(start, i));
      acc[key] = acc[key] || [];
      acc[key].push(event);
    }
    return acc;
  }, {}), [filteredEvents]);

  const visibleDays = useMemo(() => {
    if (viewMode === 'week') {
      const start = addDays(activeDate, -activeDate.getDay());
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }
    return buildMonthDays(activeDate);
  }, [activeDate, viewMode]);

  const upcomingEvents = useMemo(() => filteredEvents.filter((event) => startOfDay(new Date(event.endDate || event.startDate)) >= startOfDay(new Date())).slice(0, 7), [filteredEvents]);
  const agendaEvents = filteredEvents;
  const holidayHighlights = useMemo(() => holidayEvents.slice().sort((a, b) => new Date(a.startDate) - new Date(b.startDate)).slice(0, 6), [holidayEvents]);

  const categoryCounts = useMemo(() => Object.keys(EVENT_TYPES).map((type) => ({
    type,
    count: allEvents.filter((event) => event.type === type).length,
  })), [allEvents]);

  const toggleType = (type) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next.size ? next : new Set(Object.keys(EVENT_TYPES));
    });
  };

  const handleDownloadPdf = async () => {
    if (!holidays.length || downloading) return;
    setDownloading(true);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const logoData = await toBase64Image(schoolMeta.schoolLogo);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PW = 210;
      const PH = 297;
      const ML = 14;
      const MR = 14;
      const CONTENT_W = PW - ML - MR;
      let y = 14;

      if (logoData) {
        try { doc.addImage(logoData, ML, y, 18, 18); } catch { /* ignore logo decode */ }
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text(schoolMeta.schoolName || 'School', PW / 2, y + 7, { align: 'center' });
      if (schoolMeta.schoolAddress) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(String(schoolMeta.schoolAddress).slice(0, 100), PW / 2, y + 12.5, { align: 'center' });
      }

      y += 26;
      doc.setDrawColor(203, 213, 225);
      doc.line(ML, y, PW - MR, y);
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`Holiday Calendar ${currentYear}`, PW / 2, y, { align: 'center' });
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Prepared on ${now.toLocaleDateString()}`, ML, y);
      doc.text(`Total holidays ${holidays.length}`, PW - MR, y, { align: 'right' });
      y += 8;

      const rows = holidays.filter((item) => overlapsYear(item.startDate || item.date, item.endDate || item.startDate || item.date, currentYear));
      const pdfRows = rows.length ? rows : holidays;
      const col = { sl: 12, name: 64, date: 44, day: 40, days: 22 };
      const rowMinH = 8;
      const drawHeaderRow = (top) => {
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(ML, top, CONTENT_W, rowMinH, 1.2, 1.2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text('#', ML + col.sl / 2, top + 5.3, { align: 'center' });
        doc.text('Holiday', ML + col.sl + 2, top + 5.3);
        doc.text('Date Range', ML + col.sl + col.name + 2, top + 5.3);
        doc.text('Day', ML + col.sl + col.name + col.date + col.day / 2, top + 5.3, { align: 'center' });
        doc.text('Days', ML + col.sl + col.name + col.date + col.day + col.days / 2, top + 5.3, { align: 'center' });
      };

      drawHeaderRow(y);
      y += rowMinH;
      pdfRows.forEach((item, idx) => {
        const start = item.startDate || item.date;
        const end = item.endDate || item.startDate || item.date;
        const dateLabel = formatDateRange(start, end);
        const dayLabel = new Date(start).toLocaleDateString(undefined, { weekday: 'long' });
        const days = getHolidayDuration(start, end);
        const nameLines = doc.splitTextToSize(String(item.name || 'Untitled holiday'), col.name - 4);
        const dateLines = doc.splitTextToSize(dateLabel, col.date - 4);
        const rowH = Math.max(rowMinH, Math.max(nameLines.length, dateLines.length, 1) * 4 + 3.2);
        if (y + rowH > PH - 16) {
          doc.addPage();
          y = 14;
          drawHeaderRow(y);
          y += rowMinH;
        }
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(ML, y, CONTENT_W, rowH, 'F');
        }
        doc.setDrawColor(226, 232, 240);
        doc.rect(ML, y, CONTENT_W, rowH);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text(String(idx + 1), ML + col.sl / 2, y + 5.2, { align: 'center' });
        doc.text(nameLines, ML + col.sl + 2, y + 5.2);
        doc.text(dateLines, ML + col.sl + col.name + 2, y + 5.2);
        doc.text(dayLabel, ML + col.sl + col.name + col.date + col.day / 2, y + 5.2, { align: 'center' });
        doc.text(String(days), ML + col.sl + col.name + col.date + col.day + col.days / 2, y + 5.2, { align: 'center' });
        y += rowH;
      });

      const totalPages = doc.getNumberOfPages();
      doc.setFontSize(8);
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setTextColor(100, 116, 139);
        doc.line(ML, PH - 12, PW - MR, PH - 12);
        doc.text('System generated holiday calendar', ML, PH - 7.5);
        doc.text(`Page ${page} of ${totalPages}`, PW - MR, PH - 7.5, { align: 'right' });
      }
      doc.save(`holiday-list-${currentYear}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  const changeMonth = (offset) => setActiveDate((prev) => (viewMode === 'week'
    ? addDays(prev, offset * 7)
    : new Date(prev.getFullYear(), prev.getMonth() + offset, 1)));
  const monthLabel = activeDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // Fit the page to the viewport (no page scroll): height = window minus where the page starts.
  const pageRef = useRef(null);
  const [pageHeight, setPageHeight] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const top = pageRef.current?.getBoundingClientRect().top ?? 0;
      setPageHeight(Math.max(520, window.innerHeight - Math.max(0, top)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <div ref={pageRef} className="flex flex-col overflow-hidden bg-[#f6f8fb] p-3 sm:p-4" style={pageHeight ? { height: pageHeight } : undefined}>
      <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-bold leading-tight text-[#0f1b3d]">Teacher Calendar</h1>
            <p className="text-[12px] text-[#64748b]">View all your important school events in one place.</p>
          </div>
          <button type="button" onClick={handleDownloadPdf} disabled={loading || !holidays.length || downloading} className="inline-flex items-center gap-1.5 rounded-full bg-[#2563eb] px-3.5 py-2 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)] transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50">
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Holiday List PDF
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e6ebf2] bg-white px-3 py-2 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => changeMonth(-1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e2e8f0] text-[#475569] hover:bg-slate-50" aria-label="Previous"><ChevronLeft size={17} /></button>
            <button type="button" onClick={() => changeMonth(1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e2e8f0] text-[#475569] hover:bg-slate-50" aria-label="Next"><ChevronRight size={17} /></button>
            <h2 className="ml-2 text-[18px] font-bold text-[#0f1b3d]">{monthLabel}</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-full border border-[#e2e8f0]">
              {['month', 'week'].map((mode) => (
                <button key={mode} type="button" onClick={() => setViewMode(mode)} className={`px-4 py-1.5 text-[12px] font-medium capitalize transition ${viewMode === mode ? 'bg-[#2563eb] text-white' : 'bg-white text-[#475569] hover:bg-slate-50'}`}>{mode}</button>
              ))}
            </div>
            <button type="button" onClick={() => setActiveDate(new Date())} className="rounded-full border border-[#e2e8f0] px-4 py-1.5 text-[12px] font-medium text-[#0f1b3d] hover:bg-slate-50">Today</button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
          <main className="flex min-h-0 flex-col">
            {loading ? (
              <div className="rounded-xl border border-[#e6ebf2] bg-white p-8 text-sm text-[#64748b]"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading calendar events...</div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
            ) : (
              <CalendarGrid days={visibleDays} activeDate={activeDate} eventsByDay={eventsByDay} viewMode={viewMode} onSelect={setSelectedEvent} onSelectDay={setSelectedDay} />
            )}
          </main>

          {/* Event filters */}
          <aside className="flex min-h-0 flex-col rounded-xl border border-[#e6ebf2] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <h3 className="text-[14px] font-bold text-[#0f1b3d]">Events</h3>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events..." className="w-full rounded-full border border-[#e2e8f0] py-1.5 pl-8 pr-2 text-[12px] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#2563eb]/10" />
            </div>
            <div className="mt-3 space-y-1">
              {categoryCounts.map(({ type, count }) => {
                const config = EVENT_TYPES[type];
                return (
                  <div key={type} className="flex w-full select-none items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-[#0f1b3d]">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${config.dot}`} />
                    <span className="flex-1">{config.label}</span>
                    <span className={`rounded-full px-1.5 text-[10px] font-semibold ${config.chip}`}>{count}</span>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {selectedEvent && <EventDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
        {selectedDay && <DayDialog day={selectedDay} events={eventsByDay[dateKey(selectedDay)] || []} onClose={() => setSelectedDay(null)} />}
      </AnimatePresence>
    </div>
  );
};

const DAY_HEADER_TONES = ['#ef4444', '#2563eb', '#9333ea', '#16a34a', '#f59e0b', '#14b8a6', '#ec4899'];

const CalendarGrid = ({ days, activeDate, eventsByDay, viewMode, onSelect, onSelectDay }) => {
  const rows = days.length / 7;
  return (
    <Motion.div key={`${viewMode}-${activeDate.getMonth()}-${activeDate.getFullYear()}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e6ebf2] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="grid shrink-0 grid-cols-7 border-b border-[#eef2f7] text-center text-[12px] font-semibold">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
          <div key={day} className="py-2" style={{ color: DAY_HEADER_TONES[i], backgroundColor: `${DAY_HEADER_TONES[i]}12` }}>{day}</div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
        {days.map((day) => {
          const key = dateKey(day);
          const dayEvents = eventsByDay[key] || [];
          const outside = viewMode === 'month' && day.getMonth() !== activeDate.getMonth();
          const isToday = key === dateKey(new Date());
          const weekend = day.getDay() === 0;
          const limit = viewMode === 'week' ? 8 : 2;
          return (
            <div key={key} role="button" tabIndex={0} onClick={() => onSelectDay(day)} onKeyDown={(e) => { if (e.key === 'Enter') onSelectDay(day); }} className={`flex min-h-0 cursor-pointer flex-col overflow-hidden border-b border-r border-[#eef2f7] p-1.5 transition hover:bg-[#f8fbff] [&:nth-child(7n)]:border-r-0 ${outside ? 'bg-[#fafbfc]' : weekend ? 'bg-[#fff8f8]' : 'bg-white'} ${isToday ? 'bg-[#f2f7ff]' : ''}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${isToday ? 'bg-[#2563eb] text-white' : outside ? 'text-[#cbd5e1]' : 'text-[#0f1b3d]'}`}>{day.getDate()}</span>
              <div className="mt-0.5 min-h-0 space-y-1 overflow-hidden">
                {dayEvents.slice(0, limit).map((event) => {
                  const config = EVENT_TYPES[event.type];
                  const done = isPastEvent(event);
                  return (
                    <button key={`${event.id}-${key}`} type="button" onClick={(e) => { e.stopPropagation(); onSelectDay(day); }} title={done ? `${event.title} (completed)` : event.title} className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium transition hover:brightness-95 ${config.soft} ${outside || done ? 'opacity-60' : ''}`}>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${config.dot}`} />
                      <span className={`truncate ${done ? 'line-through decoration-2' : ''}`}>{event.title}</span>
                    </button>
                  );
                })}
                {dayEvents.length > limit && <p className="pl-1 text-[10px] font-semibold text-[#64748b]">+{dayEvents.length - limit} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Motion.div>
  );
};

const UpcomingPanel = ({ events, onSelect }) => (
  <Motion.section initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-sm font-semibold text-slate-950">Upcoming Events</h2>
        <p className="text-xs text-slate-500">Next deadlines, meetings, and reminders</p>
      </div>
      <MoreHorizontal size={18} className="text-slate-400" />
    </div>
    <div className="mt-4 space-y-2">
      {events.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No upcoming events match the filters.</p> : events.map((event, index) => <EventRow key={event.id} event={event} index={index} onSelect={onSelect} />)}
    </div>
  </Motion.section>
);

const EventRow = ({ event, index = 0, onSelect }) => {
  const config = EVENT_TYPES[event.type];
  const Icon = config.icon;
  return (
    <Motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }} onClick={() => onSelect(event)} className="flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-md">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${config.soft}`}><Icon size={16} /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{event.title}</p>
        <p className="mt-1 text-xs text-slate-500">{formatShortDate(event.startDate)} · {event.time || 'All day'}</p>
      </div>
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${isPastEvent(event) ? 'border-slate-200 bg-slate-100 text-slate-400' : config.chip}`}>{getCountdown(event)}</span>
    </Motion.button>
  );
};

const AgendaTimeline = ({ events, compact = false, onSelect }) => (
  <section className="chat-scroll min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#e6ebf2] bg-white p-4 shadow-sm">
    <div className="mb-4 flex items-center gap-2">
      <Clock size={17} className="text-indigo-600" />
      <h2 className="text-sm font-semibold text-slate-950">Agenda Timeline</h2>
    </div>
    <div className="space-y-3">
      {events.length === 0 ? <p className="text-sm text-slate-500">No agenda items match the selected filters.</p> : events.map((event, index) => {
        const config = EVENT_TYPES[event.type];
        return (
          <Motion.button key={event.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.025 }} onClick={() => onSelect(event)} className="grid w-full grid-cols-[72px_1fr] gap-3 text-left">
            <div className="text-right text-xs font-semibold text-slate-400">{formatShortDate(event.startDate)}</div>
            <div className={`rounded-xl border px-3 py-2 ${config.soft} ${compact ? '' : 'hover:shadow-sm'}`}>
              <p className="text-sm font-semibold">{event.title}</p>
              {!compact && <p className="mt-1 text-xs opacity-75">{event.time || 'All day'} · {event.meta}</p>}
            </div>
          </Motion.button>
        );
      })}
    </div>
  </section>
);

const HolidayHighlights = ({ holidays }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <CalendarDays size={17} className="text-amber-600" />
        <h2 className="text-sm font-semibold text-slate-950">Holiday Highlights</h2>
      </div>
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Holiday category</span>
    </div>
    {holidays.length === 0 ? <p className="text-sm text-slate-500">No holidays announced yet.</p> : (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {holidays.map((holiday, index) => {
          const archived = isPastEvent(holiday);
          return (
            <Motion.button key={holiday.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }} onClick={() => {}} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${archived ? 'border-slate-200 bg-slate-50 opacity-65 grayscale' : 'border-amber-100 bg-amber-50/70'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm"><CalendarDays size={18} /></div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${archived ? 'border-slate-200 bg-white text-slate-500' : 'border-amber-200 bg-white text-amber-700'}`}>{archived ? 'Archived' : getCountdown(holiday)}</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-950">{holiday.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{formatDateRange(holiday.startDate, holiday.endDate)}</p>
              <p className="mt-3 text-xs font-semibold text-slate-600">{getHolidayDuration(holiday.startDate, holiday.endDate)} day duration</p>
            </Motion.button>
          );
        })}
      </div>
    )}
  </section>
);

const EventDialog = ({ event, onClose }) => {
  const config = EVENT_TYPES[event.type];
  const Icon = config.icon;
  return (
    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <Motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(eventArg) => eventArg.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${config.soft}`}><Icon size={20} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${config.chip}`}>{config.label}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{getCountdown(event)}</span>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">{event.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{formatDate(event.startDate)}{event.endDate && dateKey(new Date(event.endDate)) !== dateKey(new Date(event.startDate)) ? ` to ${formatDate(event.endDate)}` : ''}</p>
            <p className="mt-1 text-sm text-slate-500">{event.time || 'All day'} · {event.meta}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[{ label: 'Category', value: config.label }, { label: 'Duration', value: `${getHolidayDuration(event.startDate, event.endDate)} day` }, { label: 'Status', value: isPastEvent(event) ? 'Archived' : 'Active' }].map((item) => (
            <div key={item.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
        </div>
      </Motion.div>
    </Motion.div>
  );
};

// Everything happening on one date — holidays and other events with full details.
const DayDialog = ({ day, events, onClose }) => (
  <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
    <Motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex shrink-0 items-start justify-between gap-3 bg-linear-to-r from-[#2563eb] to-[#9333ea] px-5 py-4 text-white">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">{day.toLocaleDateString(undefined, { weekday: 'long' })}</p>
          <h2 className="text-[20px] font-bold">{day.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
          <p className="text-[12px] text-white/85">{events.length ? `${events.length} event${events.length === 1 ? '' : 's'}` : 'No events'}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg leading-none hover:bg-white/25">×</button>
      </div>
      <div className="chat-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {events.length === 0 ? (
          <div className="py-8 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-[#cbd5e1]" />
            <p className="mt-2 text-[14px] font-semibold text-[#0f1b3d]">Nothing scheduled</p>
            <p className="text-[12px] text-[#64748b]">There are no holidays or events on this day.</p>
          </div>
        ) : events.map((event) => {
          const config = EVENT_TYPES[event.type];
          const Icon = config.icon;
          const done = isPastEvent(event);
          const days = getHolidayDuration(event.startDate, event.endDate);
          const description = event.raw?.description || event.raw?.reason || event.raw?.notes || '';
          return (
            <div key={event.id} className={`rounded-xl p-3 ${config.soft}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${config.dot}`}><Icon size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${config.chip}`}>{config.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${done ? 'bg-slate-200 text-slate-600' : 'bg-white text-[#16a34a]'}`}>{done ? 'Completed' : getCountdown(event)}</span>
                  </div>
                  <h3 className="mt-1.5 text-[15px] font-bold text-[#0f1b3d]">{event.title}</h3>
                  {description && <p className="mt-1 text-[12px] text-[#475569]">{description}</p>}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-lg bg-white/80 px-2 py-1.5"><p className="text-[#64748b]">Dates</p><p className="font-semibold text-[#0f1b3d]">{formatDateRange(event.startDate, event.endDate)}</p></div>
                <div className="rounded-lg bg-white/80 px-2 py-1.5"><p className="text-[#64748b]">Duration</p><p className="font-semibold text-[#0f1b3d]">{days} day{days === 1 ? '' : 's'}</p></div>
                <div className="rounded-lg bg-white/80 px-2 py-1.5"><p className="text-[#64748b]">Time</p><p className="font-semibold text-[#0f1b3d]">{event.time || 'All day'}</p></div>
              </div>
              {event.meta && event.type !== 'holiday' && <p className="mt-2 text-[11px] text-[#475569]">{event.meta}</p>}
            </div>
          );
        })}
      </div>
    </Motion.div>
  </Motion.div>
);

export default HolidayList;
