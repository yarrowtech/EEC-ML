import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  Bell,
  BookOpenCheck,
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
    chip: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    soft: 'bg-amber-50 text-amber-800 border-amber-100',
  },
  exam: {
    label: 'Exams',
    icon: GraduationCap,
    chip: 'bg-rose-100 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    soft: 'bg-rose-50 text-rose-800 border-rose-100',
  },
  assignment: {
    label: 'Assignments',
    icon: ClipboardList,
    chip: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    soft: 'bg-blue-50 text-blue-800 border-blue-100',
  },
  meeting: {
    label: 'Meetings',
    icon: Users,
    chip: 'bg-violet-100 text-violet-700 border-violet-200',
    dot: 'bg-violet-500',
    soft: 'bg-violet-50 text-violet-800 border-violet-100',
  },
  school: {
    label: 'School Events',
    icon: Sparkles,
    chip: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    soft: 'bg-emerald-50 text-emerald-800 border-emerald-100',
  },
  reminder: {
    label: 'Reminders',
    icon: Bell,
    chip: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-500',
    soft: 'bg-slate-50 text-slate-800 border-slate-100',
  },
  teacher: {
    label: 'Teacher Events',
    icon: BookOpenCheck,
    chip: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    dot: 'bg-cyan-500',
    soft: 'bg-cyan-50 text-cyan-800 border-cyan-100',
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

const HolidayList = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [schoolMeta, setSchoolMeta] = useState({ schoolName: 'School', schoolAddress: '', schoolLogo: '' });
  const [activeDate, setActiveDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [query, setQuery] = useState('');
  const [activeTypes, setActiveTypes] = useState(() => new Set(Object.keys(EVENT_TYPES)));
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/holidays/teacher`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.error || 'Unable to load holidays');
        setHolidays(Array.isArray(data) ? data : []);

        const trySetMetaFromPayload = (payload) => {
          const source = payload?.teacher || payload || {};
          const schoolName = source?.schoolName || source?.school?.name || source?.campusName || '';
          const schoolAddress = source?.schoolAddress || source?.school?.address || source?.campusAddress || source?.address || '';
          const schoolLogo = source?.schoolLogo || source?.school?.logo?.secure_url || source?.school?.logo || '';
          if (schoolName || schoolAddress || schoolLogo) {
            setSchoolMeta({ schoolName: schoolName || 'School', schoolAddress: schoolAddress || '', schoolLogo: schoolLogo || '' });
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
        setError(err.message || 'Unable to load holidays');
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
    const key = dateKey(new Date(event.startDate));
    acc[key] = acc[key] || [];
    acc[key].push(event);
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
  const agendaEvents = useMemo(() => filteredEvents.slice(0, 18), [filteredEvents]);
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

  const changeMonth = (offset) => setActiveDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  const monthLabel = activeDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Teacher Calendar</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">Smart Scheduling Workspace</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">A centralized calendar for holidays, exams, assignments, meetings, reminders, school events, and teacher planning.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleDownloadPdf} disabled={loading || !holidays.length || downloading} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                Export
              </button>
            </div>
          </div>
        </Motion.div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => changeMonth(-1)} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Previous month"><ChevronLeft size={18} /></button>
                  <button onClick={() => setActiveDate(new Date())} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Today</button>
                  <button onClick={() => changeMonth(1)} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Next month"><ChevronRight size={18} /></button>
                  <div className="ml-2 min-w-[170px] text-lg font-semibold text-slate-950">{monthLabel}</div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100" />
                  </div>
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                    {['month', 'week', 'agenda'].map((mode) => (
                      <button key={mode} onClick={() => setViewMode(mode)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${viewMode === mode ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{mode}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {categoryCounts.map(({ type, count }) => {
                  const config = EVENT_TYPES[type];
                  const Icon = config.icon;
                  const active = activeTypes.has(type);
                  return (
                    <button key={type} onClick={() => toggleType(type)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? config.chip : 'border-slate-200 bg-white text-slate-400'}`}>
                      <Icon size={13} />
                      {config.label}
                      <span className="rounded-full bg-white/70 px-1.5 text-[10px]">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading calendar events...</div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
            ) : viewMode === 'agenda' ? (
              <AgendaTimeline events={agendaEvents} onSelect={setSelectedEvent} />
            ) : (
              <CalendarGrid days={visibleDays} activeDate={activeDate} eventsByDay={eventsByDay} viewMode={viewMode} onSelect={setSelectedEvent} />
            )}

            <HolidayHighlights holidays={holidayHighlights} />
          </main>

          <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
            <UpcomingPanel events={upcomingEvents} onSelect={setSelectedEvent} />
            <AgendaTimeline events={agendaEvents.slice(0, 8)} compact onSelect={setSelectedEvent} />
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {selectedEvent && <EventDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      </AnimatePresence>
    </div>
  );
};

const CalendarGrid = ({ days, activeDate, eventsByDay, viewMode, onSelect }) => (
  <Motion.div key={`${viewMode}-${activeDate.getMonth()}-${activeDate.getFullYear()}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="px-2 py-3">{day}</div>)}
    </div>
    <div className="grid grid-cols-7">
      {days.map((day) => {
        const key = dateKey(day);
        const dayEvents = eventsByDay[key] || [];
        const outside = viewMode === 'month' && day.getMonth() !== activeDate.getMonth();
        const today = key === dateKey(new Date());
        return (
          <Motion.div key={key} whileHover={{ scale: 1.005 }} className={`min-h-[118px] border-b border-r border-slate-100 p-2 transition ${outside ? 'bg-slate-50/70 text-slate-300' : 'bg-white text-slate-700'} ${today ? 'ring-1 ring-inset ring-indigo-300' : ''}`}>
            <div className="flex items-center justify-between">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${today ? 'bg-indigo-600 text-white' : ''}`}>{day.getDate()}</span>
              {dayEvents.length > 2 && <span className="text-[10px] font-semibold text-slate-400">+{dayEvents.length - 2}</span>}
            </div>
            <div className="mt-2 space-y-1">
              {dayEvents.slice(0, viewMode === 'week' ? 5 : 2).map((event) => {
                const config = EVENT_TYPES[event.type];
                return (
                  <button key={event.id} onClick={() => onSelect(event)} className={`flex w-full items-center gap-1.5 truncate rounded-lg border px-2 py-1 text-left text-[11px] font-semibold ${config.soft} hover:shadow-sm`}>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dot}`} />
                    <span className="truncate">{event.title}</span>
                  </button>
                );
              })}
            </div>
          </Motion.div>
        );
      })}
    </div>
  </Motion.div>
);

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
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"><FileText size={15} />Open Details</button>
        </div>
      </Motion.div>
    </Motion.div>
  );
};

export default HolidayList;
