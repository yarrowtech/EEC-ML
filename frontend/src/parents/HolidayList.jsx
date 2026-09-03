import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { CalendarCheck2, CalendarDays, Download, Loader2 } from 'lucide-react';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import { parentApiFetch } from './parentApi';

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

const isPastHoliday = (startValue, endValue) => {
  const dt = new Date(endValue || startValue);
  if (Number.isNaN(dt.getTime())) return false;
  const holidayDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return holidayDay < today;
};

const HolidayList = () => {
  const navigate = useNavigate();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [schoolMeta, setSchoolMeta] = useState({ schoolName: 'School', schoolAddress: '', schoolLogo: '' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
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
        setHolidays(holidayItems);
        setSchoolMeta({
          schoolName: data?.school?.name || 'School',
          schoolAddress: data?.school?.address || '',
          schoolLogo: data?.school?.logo || '',
        });
      } catch (err) {
        setError(err.message || 'Unable to load holidays');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDownloadPdf = async () => {
    if (!holidays.length || downloading) return;
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
      doc.text(`Holiday Calendar ${currentYear}`, PW / 2, y, { align: 'center' });
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Prepared on ${now.toLocaleDateString()}`, ML, y);
      doc.text(`Total holidays ${holidays.length}`, PW - MR, y, { align: 'right' });
      y += 8;

      const yearRows = holidays.filter((item) =>
        overlapsYear(item.startDate || item.date, item.endDate || item.startDate || item.date, currentYear)
      );
      const rows = yearRows.length ? yearRows : holidays;

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

  const startOf = (item) => new Date(item.startDate || item.date).getTime() || 0;

  const { upcoming, past } = useMemo(() => {
    const up = [];
    const pa = [];
    holidays.forEach((item) => {
      (isPastHoliday(
        item.startDate || item.date,
        item.endDate || item.startDate || item.date,
      ) ? pa : up).push(item);
    });
    up.sort((a, b) => startOf(a) - startOf(b)); // soonest first
    pa.sort((a, b) => startOf(b) - startOf(a)); // most recent past first
    return { upcoming: up, past: pa };
  }, [holidays]);

  const upcomingHolidayCount = upcoming.length;

  const renderRow = (item, isPast) => (
    <tr key={item._id} className="group bg-white/40 shadow-sm backdrop-blur-xl transition hover:bg-white/65 hover:shadow-md">
      <td className={`rounded-l-2xl border-y border-l border-white/80 px-4 py-4 ${isPast ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
        {formatDateRange(item.startDate || item.date, item.endDate || item.startDate || item.date)}
      </td>
      <td className={`rounded-r-2xl border-y border-r border-white/80 px-4 py-4 font-semibold ${isPast ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
        {item.name}
      </td>
    </tr>
  );

  const groupHeader = (label, count) => (
    <tr>
      <td colSpan={2} className="px-4 pb-1 pt-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="ml-2 text-xs font-medium text-slate-400">{count}</span>
      </td>
    </tr>
  );

  return (
    <div className="relative isolate min-h-[calc(100vh-8rem)] overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-50 via-violet-50/70 to-cyan-50/60 p-3 sm:p-5 lg:p-7">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-violet-300/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="absolute left-1/3 top-1/3 h-72 w-72 rounded-full bg-amber-200/20 blur-3xl" />
      </div>

      <div className="relative space-y-5">
        <header className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/55 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-2xl sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/60 text-violet-600 shadow-lg shadow-violet-900/5 backdrop-blur-xl">
                <CalendarDays className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Academic calendar</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Holiday List</h1>
                <p className="mt-1 text-sm text-slate-500">School holidays and scheduled breaks in one place.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={loading || !holidays.length || downloading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/70 bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/15 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {downloading
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Download className="h-4 w-4" aria-hidden="true" />}
              {downloading ? 'Preparing...' : 'Download PDF'}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/70 pt-5 sm:max-w-md">
            <div className="rounded-2xl border border-white/80 bg-white/45 px-4 py-3 shadow-sm backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total holidays</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? '—' : holidays.length}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/45 px-4 py-3 shadow-sm backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Upcoming</p>
              <p className="mt-1 text-2xl font-bold text-violet-600">{loading ? '—' : upcomingHolidayCount}</p>
            </div>
          </div>
        </header>

        <section className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/50 shadow-xl shadow-slate-900/5 backdrop-blur-2xl">
          <div className="flex items-center gap-3 border-b border-white/70 bg-white/25 px-5 py-4 sm:px-7">
            <CalendarCheck2 className="h-5 w-5 text-violet-600" aria-hidden="true" />
            <h2 className="font-bold text-slate-800">Published holidays</h2>
            {!loading && !error && (
              <span className="ml-auto rounded-full border border-white/80 bg-white/55 px-3 py-1 text-xs font-semibold text-slate-600 backdrop-blur-xl">
                {holidays.length} {holidays.length === 1 ? 'entry' : 'entries'}
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-5"><Loading label="holidays" rows={4} /></div>
          ) : error ? (
            <div className="p-5"><ErrorState message={error} /></div>
          ) : holidays.length === 0 ? (
            <div className="p-5"><EmptyState icon={CalendarDays} title="No holidays announced yet" hint="Holidays appear here once the school publishes them." /></div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto overflow-x-auto p-3 sm:p-5">
              <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 [&>th]:bg-white/80 [&>th]:backdrop-blur-xl">
                    <th className="rounded-l-lg px-4 py-2 font-semibold">Date Range</th>
                    <th className="rounded-r-lg px-4 py-2 font-semibold">Holiday Name</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.length > 0 && groupHeader('Upcoming', `${upcoming.length}`)}
                  {upcoming.map((item) => renderRow(item, false))}
                  {past.length > 0 && groupHeader('Past', `${past.length}`)}
                  {past.map((item) => renderRow(item, true))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default HolidayList;
