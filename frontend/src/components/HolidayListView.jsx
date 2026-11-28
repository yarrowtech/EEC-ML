import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { useStudentDashboard } from './StudentDashboardContext';
import { fetchCachedJson } from '../utils/studentApiCache';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const STUDENT_HOLIDAYS_ENDPOINT = `${API_BASE}/api/holidays/student`;
const STUDENT_EXAMS_ENDPOINT = `${API_BASE}/api/exam/groups/student-schedule`;
const STUDENT_HOLIDAYS_CACHE_TTL_MS = 10 * 60 * 1000;

const calendarDate = (value) => {
  const datePart = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  if (datePart) return new Date(+datePart[1], +datePart[2] - 1, +datePart[3]);
  return new Date(value ?? NaN);
};

const formatDate = (value) => {
  const dt = calendarDate(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
};

const formatCompactDate = (value) => {
  const dt = calendarDate(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatWeekday = (value) => {
  const dt = calendarDate(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(undefined, { weekday: 'long' });
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
  const start = calendarDate(startValue);
  const end = calendarDate(endValue || startValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  return end >= yearStart && start <= yearEnd;
};

const formatDateRange = (startValue, endValue) => {
  const start = formatDate(startValue);
  const end = formatDate(endValue || startValue);
  if (start === end) return start;
  return `${start} to ${end}`;
};

const getHolidayDuration = (startValue, endValue) => {
  const start = calendarDate(startValue);
  const end = calendarDate(endValue || startValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((end - start) / dayMs) + 1);
};

const getHolidayStatus = (startValue, endValue) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = calendarDate(startValue);
  const end = calendarDate(endValue || startValue);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (Number.isNaN(startDay.getTime()) || Number.isNaN(endDay.getTime())) return 'Unknown';
  if (today < startDay) return 'Upcoming';
  if (today > endDay) return 'Past';
  return 'Ongoing';
};

const toSortableDate = (value) => {
  const dt = calendarDate(value);
  if (Number.isNaN(dt.getTime())) return Number.MAX_SAFE_INTEGER;
  return dt.getTime();
};

const TABS = [
  ['Overview', '🗓️'],
  ['Holidays', '🏖️'],
  ['Events', '⭐'],
  ['Calendar', '📅'],
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PANEL = 'rounded-2xl border border-indigo-100 bg-white/75 p-3 shadow-sm shadow-indigo-100/70 sm:p-4';
const dayTime = (value) => {
  if (!value) return NaN;
  const date = calendarDate(value);
  return date.setHours(0, 0, 0, 0);
};

const EventRows = ({ entries, emptyMessage }) => entries.length ? (
  <ul className="space-y-2">
    {entries.map(({ key, name, start, end, type }) => {
      const date = calendarDate(start);
      const tone = type === 'Holiday' ? 'bg-rose-100 text-rose-800' : 'bg-violet-100 text-violet-800';
      return (
        <li key={key} className="flex items-center gap-3 rounded-xl border border-indigo-50 bg-white p-2.5 shadow-sm shadow-indigo-100/50">
          <div className={`flex w-13 shrink-0 flex-col items-center rounded-xl px-2 py-1.5 font-bold leading-tight ${tone}`}>
            <span className="text-xs">{date.toLocaleDateString(undefined, { month: 'short' })}</span>
            <span className="text-xl">{date.getDate()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-bold">
              {name}
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{type}</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-600">{formatDateRange(start, end)}</p>
          </div>
          <span className="hidden shrink-0 text-2xl sm:block" aria-hidden="true">{type === 'Holiday' ? '🎉' : '📋'}</span>
        </li>
      );
    })}
  </ul>
) : <p className="py-3 text-sm text-slate-500">{emptyMessage}</p>;

const MonthCalendar = ({ month, setMonth, entries, today }) => {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const startOffset = new Date(year, monthIndex, 1).getDay();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  return (
    <section className={PANEL} aria-label="Monthly calendar">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))} className="rounded-lg p-1.5 text-violet-700 hover:bg-violet-50"><ChevronLeft size={20} /></button>
        <h2 className="text-center text-lg font-extrabold sm:text-xl" aria-live="polite">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))} className="rounded-lg p-1.5 text-violet-700 hover:bg-violet-50"><ChevronRight size={20} /></button>
      </div>
      <div className="grid grid-cols-7 justify-items-center gap-y-1.5 text-sm">
        {WEEKDAYS.map((day) => <span key={day} className={day === 'Sun' ? 'font-semibold text-red-600' : 'font-semibold'}>{day}</span>)}
        {Array.from({ length: startOffset }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: dayCount }, (_, index) => {
          const day = index + 1;
          const time = +new Date(year, monthIndex, day);
          const matches = entries.filter((entry) => time >= dayTime(entry.start) && time <= dayTime(entry.end));
          const holiday = matches.some((entry) => entry.type === 'Holiday');
          const exam = matches.some((entry) => entry.type === 'Exam');
          const tone = time === today ? 'bg-violet-700 text-white' : holiday ? 'bg-rose-200 text-rose-900' : exam ? 'bg-violet-200 text-violet-900' : (index + startOffset) % 7 === 0 ? 'text-red-600' : '';
          const label = [formatDate(time), ...matches.map((entry) => entry.name)].join(', ');
          return <time key={day} aria-current={time === today ? 'date' : undefined} aria-label={label} title={label} className={`relative grid h-8 w-8 place-items-center rounded-full font-semibold ${tone}`}>{day}{holiday && exam && <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-violet-400" />}</time>;
        })}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-indigo-100 pt-2.5 text-xs font-medium sm:text-sm">
        {[
          ['Holiday', 'bg-rose-200'],
          ['Exam', 'bg-violet-200'],
          ['Today', 'bg-violet-700'],
        ].map(([label, color]) => <span key={label} className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded-full ${color}`} />{label}</span>)}
      </div>
    </section>
  );
};

const HolidayListView = () => {
  const { profile } = useStudentDashboard();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [month, setMonth] = useState(() => new Date());
  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [examsError, setExamsError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const sortedHolidays = [...holidays].sort((a, b) => {
    const aDate = toSortableDate(a.startDate || a.date);
    const bDate = toSortableDate(b.startDate || b.date);
    return aDate - bDate;
  });

  const today = dayTime(new Date());
  const holidayEntries = sortedHolidays.map((item) => ({
    key: 'holiday-' + item._id,
    name: item.name,
    start: item.startDate || item.date,
    end: item.endDate || item.startDate || item.date,
    type: 'Holiday',
  }));
  const examEntries = exams.filter((exam) => ['published', 'completed'].includes(String(exam.status).toLowerCase())).map((exam) => ({
    key: 'exam-' + exam._id,
    name: exam.name || exam.title || 'Exam',
    start: exam.startDate,
    end: exam.endDate || exam.startDate,
    type: 'Exam',
  })).filter((exam) => Number.isFinite(dayTime(exam.start)));
  const calendarEntries = [...holidayEntries, ...examEntries].sort((a, b) => toSortableDate(a.start) - toSortableDate(b.start));
  const upcoming = calendarEntries.filter((entry) => dayTime(entry.end) >= today);
  const activeHolidays = holidayEntries.filter((entry) => dayTime(entry.end) >= today);
  const nextHoliday = activeHolidays.find((entry) => dayTime(entry.start) >= today) || activeHolidays[0];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        if (!token || userType !== 'Student') {
          setHolidays([]);
          setError('Please login as student.');
          return;
        }

        const { data } = await fetchCachedJson(STUDENT_HOLIDAYS_ENDPOINT, {
          ttlMs: STUDENT_HOLIDAYS_CACHE_TTL_MS,
          fetchOptions: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        });
        setHolidays(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Unable to load holidays');
      } finally {
        setLoading(false);
      }
    };
    load();
    if (!localStorage.getItem('token') || localStorage.getItem('userType') !== 'Student') {
      setExamsLoading(false);
      return;
    }
    fetchCachedJson(STUDENT_EXAMS_ENDPOINT)
      .then(({ data }) => setExams(Array.isArray(data) ? data : []))
      .catch(() => setExamsError('Unable to load the exam schedule.'))
      .finally(() => setExamsLoading(false));
  }, []);

  const handleDownloadPdf = async () => {
    if (!sortedHolidays.length || downloading) return;
    setDownloading(true);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const schoolName = profile?.schoolName || profile?.school?.name || profile?.campusName || 'School';
      const schoolAddress = profile?.schoolAddress || profile?.school?.address || profile?.address || '';
      const logoUrl = profile?.schoolLogo || profile?.school?.logo?.secure_url || profile?.school?.logo || '';
      const logoData = await toBase64Image(logoUrl);

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
      doc.text(`Holiday Calendar ${currentYear}`, PW / 2, y, { align: 'center' });
      y += 7;

      const yearRows = sortedHolidays.filter((item) =>
        overlapsYear(item.startDate || item.date, item.endDate || item.startDate || item.date, currentYear)
      );
      const rows = yearRows.length ? yearRows : sortedHolidays;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Prepared on ${now.toLocaleDateString()}`, ML, y);
      doc.text(`Total holidays ${rows.length}`, PW - MR, y, { align: 'right' });
      y += 7;

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

      doc.save(`holiday-list-${currentYear}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  const calendar = <MonthCalendar month={month} setMonth={setMonth} entries={calendarEntries} today={today} />;
  const actionClass = 'inline-flex shrink-0 items-center gap-1 text-xs font-bold text-violet-700 hover:text-violet-900 sm:text-sm';

  return (
    <main aria-label="School holidays" className="mx-auto w-full max-w-6xl space-y-4 bg-linear-to-b from-white to-indigo-50/50 p-3 text-slate-950 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <nav aria-label="Holiday views" className="flex flex-wrap gap-1.5">
          {TABS.map(([tab, icon]) => (
            <button
              key={tab}
              type="button"
              aria-pressed={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold shadow-sm shadow-indigo-100 sm:text-sm ${activeTab === tab ? 'border-violet-700 bg-linear-to-r from-violet-700 to-indigo-600 text-white' : 'border-indigo-50 bg-white hover:bg-indigo-50'}`}
            >
              <span aria-hidden="true">{icon}</span>{tab}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={loading || !sortedHolidays.length || downloading}
          className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-violet-700 to-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-200 hover:brightness-110 disabled:opacity-50 sm:text-sm"
        >
          <Download size={16} aria-hidden="true" />
          {downloading ? 'Preparing…' : 'Download Holiday List'}
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-violet-800">PDF</span>
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {examsError && activeTab !== 'Holidays' && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{examsError}</p>}
      {(loading || (examsLoading && activeTab !== 'Holidays')) && (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="animate-spin" size={16} />Loading calendar…</p>
      )}

      {activeTab === 'Overview' && (
        <>
          <div className="grid items-start gap-3 lg:grid-cols-[0.9fr_1.15fr]">
            {calendar}
            <section className={PANEL}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold sm:text-xl"><span aria-hidden="true" className="mr-2">📣</span>Upcoming Events &amp; Holidays</h2>
                <button type="button" onClick={() => setActiveTab('Events')} className={actionClass}>View All <ArrowRight size={15} /></button>
              </div>
              <EventRows entries={upcoming.slice(0, 3)} emptyMessage={loading || examsLoading ? '' : 'No upcoming events or holidays.'} />
            </section>
          </div>
          <div className="grid items-start gap-3 lg:grid-cols-[0.9fr_1.15fr]">
            <section className={PANEL}>
              <div className="flex items-center justify-between gap-2 rounded-xl bg-linear-to-br from-rose-50 to-pink-100 p-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold"><span aria-hidden="true" className="mr-2">🏖️</span>Next Holiday</h2>
                  {nextHoliday ? (
                    <>
                      <p className="mt-2 text-xl font-extrabold">{nextHoliday.name}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium"><CalendarDays size={15} className="shrink-0 text-rose-700" />{formatDateRange(nextHoliday.start, nextHoliday.end)}</p>
                      <span className="mt-2 inline-flex rounded-full bg-rose-200 px-2.5 py-1 text-xs font-bold text-rose-900">School Closed</span>
                    </>
                  ) : <p className="mt-2 text-sm text-slate-600">{loading ? 'Loading holidays…' : 'No upcoming holidays.'}</p>}
                </div>
                {nextHoliday && <div aria-hidden="true" className="hidden shrink-0 rotate-6 overflow-hidden rounded-xl bg-white text-center shadow-md shadow-rose-200 sm:block">
                  <div className="bg-rose-500 px-4 py-0.5 text-xs font-bold uppercase text-white">{calendarDate(nextHoliday.start).toLocaleDateString(undefined, { month: 'short' })}</div>
                  <div className="px-4 py-1 text-3xl font-black">{calendarDate(nextHoliday.start).getDate()}</div>
                </div>}
              </div>
            </section>
            <section className={PANEL}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold sm:text-xl"><span aria-hidden="true" className="mr-2">🌴</span>Holidays at a Glance</h2>
                <button type="button" onClick={() => setActiveTab('Holidays')} className={actionClass}>View Full List <ArrowRight size={15} /></button>
              </div>
              <dl className="grid grid-cols-3 gap-2">
                {[
                  ['Total Holidays', holidayEntries.length, '🗓️', 'bg-emerald-50'],
                  ['Upcoming & Ongoing', activeHolidays.length, '🎉', 'bg-rose-50'],
                  ['Past Holidays', holidayEntries.length - activeHolidays.length, '📅', 'bg-blue-50'],
                ].map(([label, count, icon, tone]) => (
                  <div key={label} className={`rounded-xl p-2.5 sm:p-3 ${tone}`}>
                    <dt className="flex flex-wrap items-center gap-x-1 text-xs font-semibold"><span aria-hidden="true">{icon}</span>{label}</dt>
                    <dd className="mt-0.5 text-xl font-black sm:text-2xl">{loading || error ? '—' : count}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </>
      )}

      {activeTab === 'Holidays' && (
        <section className={`max-w-2xl ${PANEL}`}>
          <h2 className="mb-2 text-lg font-extrabold">Holidays</h2>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {['all', 'Upcoming', 'Ongoing', 'Past'].map((status) => (
              <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => setStatusFilter(status)} className={`rounded-full px-3 py-1 text-xs font-semibold ${statusFilter === status ? 'bg-violet-700 text-white' : 'bg-violet-50 text-violet-800 hover:bg-violet-100'}`}>{status === 'all' ? 'All' : status}</button>
            ))}
          </div>
          {!loading && !error && <EventRows entries={holidayEntries.filter((entry) => statusFilter === 'all' || getHolidayStatus(entry.start, entry.end) === statusFilter)} emptyMessage="No holidays in this view." />}
        </section>
      )}
      {activeTab === 'Events' && (
        <section className={`max-w-2xl ${PANEL}`}>
          <h2 className="mb-3 text-lg font-extrabold">Upcoming Events &amp; Holidays</h2>
          {!loading && !examsLoading && <EventRows entries={upcoming} emptyMessage="No upcoming events or holidays." />}
        </section>
      )}
      {activeTab === 'Calendar' && <div className="max-w-lg">{calendar}</div>}
    </main>
  );
};

export default HolidayListView;
