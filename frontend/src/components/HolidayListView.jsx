import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import { CalendarDays, Download, Loader2 } from 'lucide-react';
import { useStudentDashboard } from './StudentDashboardContext';
import { fetchCachedJson } from '../utils/studentApiCache';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const STUDENT_HOLIDAYS_ENDPOINT = `${API_BASE}/api/holidays/student`;
const STUDENT_HOLIDAYS_CACHE_TTL_MS = 10 * 60 * 1000;

const formatDate = (value) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
};

const formatCompactDate = (value) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatWeekday = (value) => {
  const dt = new Date(value);
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
  const start = new Date(startValue);
  const end = new Date(endValue || startValue);
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
  const start = new Date(startValue);
  const end = new Date(endValue || startValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((end - start) / dayMs) + 1);
};

const getHolidayStatus = (startValue, endValue) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(startValue);
  const end = new Date(endValue || startValue);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (Number.isNaN(startDay.getTime()) || Number.isNaN(endDay.getTime())) return 'Unknown';
  if (today < startDay) return 'Upcoming';
  if (today > endDay) return 'Past';
  return 'Ongoing';
};

const toSortableDate = (value) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return Number.MAX_SAFE_INTEGER;
  return dt.getTime();
};

const STATUS_TONE = {
  Upcoming: {
    badge: 'bg-emerald-100 text-emerald-700',
    accent: 'border-l-emerald-400',
    dateHeader: 'bg-emerald-500',
    dateBody: 'bg-emerald-50',
    dateText: 'text-emerald-700',
    dateBorder: 'border-emerald-200',
  },
  Ongoing: {
    badge: 'bg-sky-100 text-sky-700',
    accent: 'border-l-sky-400',
    dateHeader: 'bg-sky-500',
    dateBody: 'bg-sky-50',
    dateText: 'text-sky-700',
    dateBorder: 'border-sky-200',
  },
  Past: {
    badge: 'bg-slate-100 text-slate-500',
    accent: 'border-l-slate-300',
    dateHeader: 'bg-slate-400',
    dateBody: 'bg-slate-50',
    dateText: 'text-slate-500',
    dateBorder: 'border-slate-200',
  },
  Unknown: {
    badge: 'bg-slate-100 text-slate-500',
    accent: 'border-l-slate-300',
    dateHeader: 'bg-slate-400',
    dateBody: 'bg-slate-50',
    dateText: 'text-slate-500',
    dateBorder: 'border-slate-200',
  },
};

const STATUS_FILTERS = [
  { key: 'all', label: 'All', activeClass: 'bg-slate-800 border-slate-800' },
  { key: 'Upcoming', label: 'Upcoming', activeClass: 'bg-emerald-500 border-emerald-500' },
  { key: 'Ongoing', label: 'Ongoing', activeClass: 'bg-sky-500 border-sky-500' },
  { key: 'Past', label: 'Past', activeClass: 'bg-slate-400 border-slate-400' },
];

const StatTile = ({ label, value, grad, shadow }) => (
  <div className={`relative overflow-hidden rounded-2xl bg-linear-to-br ${grad} p-3.5 shadow-lg ${shadow} transition-transform hover:-translate-y-0.5 md:p-4`}>
    <div className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
    <div className="relative z-10">
      <p className="text-[11px] font-semibold text-white/80">{label}</p>
      <p className="mt-1.5 text-xl font-black text-white leading-tight">{value}</p>
    </div>
  </div>
);

const HolidayListView = () => {
  const { profile } = useStudentDashboard();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const sortedHolidays = [...holidays].sort((a, b) => {
    const aDate = toSortableDate(a.startDate || a.date);
    const bDate = toSortableDate(b.startDate || b.date);
    return aDate - bDate;
  });

  const filteredHolidays = sortedHolidays.filter((item) => {
    if (statusFilter === 'all') return true;
    const start = item.startDate || item.date;
    const end = item.endDate || item.startDate || item.date;
    return getHolidayStatus(start, end) === statusFilter;
  });

  const stats = sortedHolidays.reduce(
    (acc, item) => {
      const start = item.startDate || item.date;
      const end = item.endDate || item.startDate || item.date;
      const status = getHolidayStatus(start, end);
      acc.total += 1;
      if (status === 'Upcoming') acc.upcoming += 1;
      if (status === 'Ongoing') acc.ongoing += 1;
      if (status === 'Past') acc.past += 1;
      return acc;
    },
    { total: 0, upcoming: 0, ongoing: 0, past: 0 }
  );

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

  return (
    <div className="min-h-screen bg-slate-50 space-y-5 p-4 pb-8 sm:p-6">
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-purple-500 via-purple-600 to-violet-700 p-5 shadow-lg shadow-purple-200/60 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <CalendarDays className="h-5.5 w-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">Holiday Calendar</h1>
            <p className="text-sm text-white/80">Track upcoming and completed holidays in one place</p>
          </div>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={loading || !sortedHolidays.length || downloading}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-purple-700 shadow-sm transition-colors hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? 'Preparing...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {!loading && !error && sortedHolidays.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Total" value={stats.total} grad="from-slate-700 to-slate-900" shadow="shadow-slate-300/60" />
            <StatTile label="Upcoming" value={stats.upcoming} grad="from-emerald-500 to-teal-600" shadow="shadow-emerald-200/60" />
            <StatTile label="Ongoing" value={stats.ongoing} grad="from-sky-500 to-blue-600" shadow="shadow-sky-200/60" />
            <StatTile label="Past" value={stats.past} grad="from-slate-400 to-slate-500" shadow="shadow-slate-200/60" />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {STATUS_FILTERS.map(({ key, label, activeClass }) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-bold transition-all ${
                  statusFilter === key
                    ? `${activeClass} text-white shadow-md`
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading holidays...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-medium text-rose-700">{error}</p>
        </div>
      ) : sortedHolidays.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">No holidays announced yet.</p>
        </div>
      ) : filteredHolidays.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">No {statusFilter.toLowerCase()} holidays right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHolidays.map((item) => {
            const start = item.startDate || item.date;
            const end = item.endDate || item.startDate || item.date;
            const status = getHolidayStatus(start, end);
            const duration = getHolidayDuration(start, end);
            const tone = STATUS_TONE[status] || STATUS_TONE.Unknown;
            const isPast = status === 'Past';
            const startDt = new Date(start);
            const hasValidStart = !Number.isNaN(startDt.getTime());
            const monthLabel = hasValidStart ? startDt.toLocaleDateString(undefined, { month: 'short' }).toUpperCase() : '—';
            const dayLabel = hasValidStart ? startDt.getDate() : '—';

            return (
              <div
                key={item._id}
                className={`flex items-center gap-3 rounded-2xl border border-slate-100 border-l-4 bg-white p-3 shadow-sm transition-transform hover:-translate-y-0.5 sm:p-4 ${tone.accent}`}
              >
                <div className={`flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-xl border ${tone.dateBorder}`}>
                  <div className={`w-full py-1 text-center text-[10px] font-bold text-white ${tone.dateHeader}`}>{monthLabel}</div>
                  <div className={`w-full py-1.5 text-center text-lg font-black ${tone.dateText} ${tone.dateBody}`}>{dayLabel}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-semibold ${isPast ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{item.name}</p>
                    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.badge}`}>
                      {status}
                    </span>
                  </div>
                  <p className={`mt-1 text-xs ${isPast ? 'text-slate-400' : 'text-slate-500'}`}>
                    {formatDateRange(start, end)} · {duration} day{duration > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            );
          })}

          <p className="pt-1 text-sm font-semibold text-slate-700">
            {statusFilter === 'all' ? `Total Holidays: ${sortedHolidays.length}` : `Showing ${filteredHolidays.length} of ${sortedHolidays.length} holidays`}
          </p>
        </div>
      )}
    </div>
  );
};

export default HolidayListView;
