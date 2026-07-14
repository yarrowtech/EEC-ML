import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Calendar, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStudentDashboard } from './StudentDashboardContext';
import { fetchCachedJson } from '../utils/studentApiCache';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const STUDENT_EXAMS_ENDPOINT = `${API_BASE}/api/exam/groups/student-schedule`;
const STUDENT_EXAMS_CACHE_TTL_MS = 2 * 60 * 1000;

const TERM_OPTIONS = ['all', 'Class Test', 'Unit Test', 'Monthly Test', 'Term 1', 'Term 2', 'Term 3', 'Half Yearly', 'Annual', 'Final'];
const STATUS_OPTIONS = ['all', 'scheduled', 'completed'];

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
};

const toDataUrl = async (url) => {
  const src = String(url || '').trim();
  if (!src) return '';
  try {
    const response = await fetch(src);
    if (!response.ok) return '';
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

const buildRoomLabel = (exam) => {
  const roomNumber = exam?.roomId?.roomNumber;
  if (roomNumber) return roomNumber;
  return String(exam?.venue || '').trim() || '—';
};

const generateExamSchedulePdf = async (group, pdfHeader) => {
  if (!group?._id) return;
  const className = group.classId?.name || group.grade || '—';
  const sectionName = group.sectionId?.name || group.section || '—';
  const title = String(group.title || 'Exam Schedule').trim();

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = 0;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, 5, 38, 'F');

  const logoDataUrl = await toDataUrl(pdfHeader.logoUrl);
  if (logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, 6, 24, 24, 2, 2, 'F');
      doc.addImage(logoDataUrl, 'PNG', margin + 1, 7, 22, 22);
    } catch {
      // Ignore logo rendering failures.
    }
  }

  const textX = logoDataUrl ? margin + 30 : margin + 8;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text((pdfHeader.schoolName || 'School').toUpperCase(), textX, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  if (pdfHeader.schoolAddressLine) {
    doc.text(pdfHeader.schoolAddressLine, textX, 26);
  }

  y = 46;

  doc.setFillColor(238, 242, 255);
  doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 22, 3, 3, 'F');
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 22, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 27, 75);
  doc.text(title, pageWidth / 2, y + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(99, 102, 241);
  const meta = [`Class: ${className}`, `Section: ${sectionName}`].join('   •   ');
  doc.text(meta, pageWidth / 2, y + 11, { align: 'center' });

  y += 26;

  const headers = ['Date', 'Day', 'Subject', 'Room No.'];
  const colWidths = [30, 34, 88, 30];
  const tableW = colWidths.reduce((s, v) => s + v, 0);
  const startX = margin;
  const rowH = 9;

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(startX, y, tableW, rowH, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  let x = startX;
  headers.forEach((header, index) => {
    doc.text(header, x + colWidths[index] / 2, y + 6, { align: 'center' });
    x += colWidths[index];
  });
  y += rowH;

  const rows = (group.subjects || [])
    .map((exam) => {
      const date = exam?.date ? new Date(exam.date) : null;
      const dateText = date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';
      const dayText = date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString('en-US', { weekday: 'long' })
        : '—';
      const subjectText = exam?.subjectId?.name || exam?.subject || exam?.title || '—';
      return [dateText, dayText, subjectText, buildRoomLabel(exam)];
    })
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  if (!rows.length) {
    rows.push(['—', '—', 'No subject exams scheduled', '—']);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  rows.forEach((row, rowIndex) => {
    if (y + rowH > 285) {
      doc.addPage();
      y = 18;
    }
    doc.setFillColor(rowIndex % 2 === 0 ? 248 : 255, rowIndex % 2 === 0 ? 250 : 255, rowIndex % 2 === 0 ? 252 : 255);
    doc.rect(startX, y, tableW, rowH, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(startX, y, tableW, rowH);

    let colX = startX;
    row.forEach((cell, i) => {
      const align = i === 2 ? 'left' : 'center';
      const textXPos = align === 'left' ? colX + 2.5 : colX + colWidths[i] / 2;
      doc.setTextColor(15, 23, 42);
      doc.text(String(cell || '—'), textXPos, y + 5.7, { align });
      colX += colWidths[i];
    });
    y += rowH;
  });

  const safeTitle = String(title || 'exam_schedule').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const safeClass = String(className || 'class').replace(/\s+/g, '_');
  const safeSection = String(sectionName || 'section').replace(/\s+/g, '_');
  doc.save(`${safeTitle}_${safeClass}_${safeSection}.pdf`);
};

const StudentExamsView = () => {
  const { profile } = useStudentDashboard();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [termFilter, setTermFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [downloadingGroupId, setDownloadingGroupId] = useState('');

  useEffect(() => {
    const fetchStudentExamSchedule = async () => {
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');
      if (!token || userType !== 'Student') {
        setError('Please login as student.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const { data } = await fetchCachedJson(STUDENT_EXAMS_ENDPOINT, {
          ttlMs: STUDENT_EXAMS_CACHE_TTL_MS,
          fetchOptions: {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        });
        setGroups(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load exam schedule');
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStudentExamSchedule();
  }, []);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((group) => {
      const groupStatus = String(group?.status || '').toLowerCase();
      const termMatches = termFilter === 'all' || String(group?.term || '') === termFilter;
      const statusMatches = statusFilter === 'all' || groupStatus === statusFilter;
      const queryMatches = !q
        || [group?.title, group?.term, group?.grade, group?.section]
          .some((value) => String(value || '').toLowerCase().includes(q));
      return termMatches && statusMatches && queryMatches;
    });
  }, [groups, search, statusFilter, termFilter]);

  const pdfHeader = useMemo(() => ({
    schoolName: String(profile?.schoolName || '').trim(),
    schoolAddressLine: String(profile?.schoolAddress || '').trim(),
    logoUrl: String(profile?.schoolLogo || '').trim(),
  }), [profile?.schoolAddress, profile?.schoolLogo, profile?.schoolName]);

  const handleDownload = async (group) => {
    try {
      setDownloadingGroupId(String(group?._id || ''));
      await generateExamSchedulePdf(group, pdfHeader);
      toast.success('Exam routine downloaded');
    } catch (err) {
      toast.error(err.message || 'Failed to download exam routine');
    } finally {
      setDownloadingGroupId('');
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Calendar size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Exams</h2>
            <p className="text-xs text-slate-500">View your exam schedule and download routine</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exam"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition placeholder:text-slate-400"
        />
        <select
          value={termFilter}
          onChange={(e) => setTermFilter(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
        >
          {TERM_OPTIONS.map((term) => (
            <option key={term} value={term}>{term === 'all' ? 'All Terms' : term}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>{status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-sm text-slate-500 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          Loading exam schedule...
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm p-8 text-sm text-slate-500 text-center">
          No exams found for your schedule.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const classLabel = group?.classId?.name || group?.grade || '—';
            const sectionLabel = group?.sectionId?.name || group?.section || '—';
            const statusLabel = String(group?.status || 'Scheduled');
            const normalizedStatus = statusLabel.toLowerCase();
            const statusClass = normalizedStatus === 'completed'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-blue-50 text-blue-700';

            return (
              <div key={group._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">{group?.term || 'Exam'}</p>
                    <h3 className="text-lg font-semibold text-slate-900">{group?.title || 'Exam Schedule'}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Class {classLabel} · Section {sectionLabel}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDate(group?.startDate)} - {formatDate(group?.endDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusClass}`}>
                      {statusLabel}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                      {(group?.subjects || []).length} Subjects
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => handleDownload(group)}
                    disabled={downloadingGroupId === String(group._id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {downloadingGroupId === String(group._id) ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                    {downloadingGroupId === String(group._id) ? 'Preparing...' : 'Download Routine'}
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {(group?.subjects || []).slice(0, 4).map((exam) => (
                    <div key={exam?._id || `${group._id}-${exam?.subject || exam?.title}`} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-800">{exam?.subjectId?.name || exam?.subject || exam?.title || 'Subject'}</p>
                        <p className="text-xs text-slate-500">{formatDate(exam?.date)}</p>
                      </div>
                    </div>
                  ))}
                  {(group?.subjects || []).length > 4 && (
                    <p className="text-xs text-slate-400">+{(group.subjects || []).length - 4} more subjects in this exam</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentExamsView;
