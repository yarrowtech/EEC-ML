import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { CalendarDays, Download, Loader2 } from 'lucide-react';
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

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-amber-600" />
        <h1 className="text-lg font-bold text-gray-900">Holiday List</h1>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={loading || !holidays.length || downloading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {downloading ? 'Preparing...' : 'Download PDF'}
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading holidays...
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : holidays.length === 0 ? (
        <div>
          <p className="text-sm text-gray-500">No holidays announced yet.</p>
          <p className="mt-3 text-sm font-medium text-gray-600">Total Holidays: 0</p>
        </div>
      ) : (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-3 py-2">Date Range</th>
                  <th className="px-3 py-2">Holiday Name</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((item) => (
                  <tr key={item._id} className="border-b border-gray-100">
                    <td className={`px-3 py-2.5 ${isPastHoliday(item.startDate || item.date, item.endDate || item.startDate || item.date) ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      {formatDateRange(item.startDate || item.date, item.endDate || item.startDate || item.date)}
                    </td>
                    <td className={`px-3 py-2.5 font-medium ${isPastHoliday(item.startDate || item.date, item.endDate || item.startDate || item.date) ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {item.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm font-medium text-gray-600">Total Holidays: {holidays.length}</p>
        </div>
      )}
    </div>
  );
};

export default HolidayList;
