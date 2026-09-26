import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { FileText, Users, Building2, CalendarCheck, X, CreditCard, Search, ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, IndianRupee, Eye, Settings } from 'lucide-react';
import IDCard from '../components/IDCard';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const ADMIN_PROFILE_CACHE_KEY = 'admin_profile_cache_v1';

const getAdminProfileCacheKey = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return `${ADMIN_PROFILE_CACHE_KEY}:anonymous`;
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return `${ADMIN_PROFILE_CACHE_KEY}:fallback`;
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    const adminId = payload?.id || 'unknown';
    const schoolId = payload?.schoolId || 'school';
    const campusId = payload?.campusId || 'campus';
    return `${ADMIN_PROFILE_CACHE_KEY}:${adminId}_${schoolId}_${campusId}`;
  } catch {
    return `${ADMIN_PROFILE_CACHE_KEY}:fallback`;
  }
};

const getSchoolDisplayName = () => {
  try {
    const raw = sessionStorage.getItem(getAdminProfileCacheKey());
    if (raw) {
      const profile = JSON.parse(raw);
      const schoolName = String(profile?.schoolName || profile?.campusName || '').trim();
      if (schoolName) return schoolName;
    }
  } catch {
    // fall through to fallback
  }
  return 'EEC School';
};


/* ─── Table pagination (shared by Attendance / Leaves / Expenses) ─── */
const PAGE_SIZES = [10, 25, 50];

// Slice a list into pages; jumps back to page 1 whenever the list changes
// (search / filters / month) so you never land on an empty page.
function usePagination(items) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { setPage(1); }, [items, pageSize]);
  const current = Math.min(page, totalPages);
  const rows = items.slice((current - 1) * pageSize, current * pageSize);
  return { rows, page: current, setPage, pageSize, setPageSize, total, totalPages };
}

// 1 … 4 [5] 6 … 12
const pageWindow = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => set.add(p));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => set.add(p));
  const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) out.push('…'); out.push(p); });
  return out;
};

function TablePagination({ pager, label = 'records', extra = null }) {
  const { page, setPage, pageSize, setPageSize, total, totalPages } = pager;
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const navBtn = 'flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span>Showing <b className="text-gray-700">{from}–{to}</b> of <b className="text-gray-700">{total}</b> {label}</span>
        <label className="flex items-center gap-1.5">
          Rows
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        {extra}
      </div>
      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button type="button" className={navBtn} onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Previous page"><ChevronLeft size={15} /></button>
          {pageWindow(page, totalPages).map((p, i) => (p === '…'
            ? <span key={`gap-${i}`} className="w-6 text-center text-gray-400">…</span>
            : (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition ${p === page ? 'bg-yellow-500 text-white shadow-sm' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {p}
              </button>
            )))}
          <button type="button" className={navBtn} onClick={() => setPage(page + 1)} disabled={page === totalPages} aria-label="Next page"><ChevronRight size={15} /></button>
        </nav>
      )}
    </div>
  );
}

/* ─── Small shared UI bits for the HR tabs ─── */
const initialsOf = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
function PersonCell({ name, sub }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-[11px] font-bold text-yellow-700">{initialsOf(name)}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{name || '-'}</p>
        {sub ? <p className="truncate text-xs text-gray-500">{sub}</p> : null}
      </div>
    </div>
  );
}
function StatChip({ icon: Icon, label, value, sub, tone }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600', purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone] || tones.blue}`}><Icon size={19} /></span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold leading-tight text-gray-900">{value}{sub ? <span className="ml-1.5 text-xs font-medium text-gray-400">{sub}</span> : null}</p>
      </div>
    </div>
  );
}
const toolbarInput = 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100';
const thCls = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500';
const tdCls = 'px-4 py-3 text-sm text-gray-600';


const HR = ({ setShowAdminHeader }) => {
  const [searchParams] = useSearchParams();
  useEffect(() => { setShowAdminHeader(true); }, []);

  const [tab, setTab] = useState('attendance'); // payroll | vendors | attendance | employees | leaves | expenses | recruitment | policies | add-new
  const [salaryMonth, setSalaryMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Mock data copied/adapted from FeesCollection Payments & Salaries
  const WORKING_DAYS = 26;
  const teachers = [
    { id: 't1', name: 'Prof. Priya Verma', designation: 'Physics', baseSalary: 55000 },
    { id: 't2', name: 'Dr. Arjun Sen', designation: 'Mathematics', baseSalary: 60000 },
    { id: 't3', name: 'Ms. Kavita Rao', designation: 'Chemistry', baseSalary: 52000 },
  ];
  const staff = [
    { id: 's1', name: 'Amit Kumar', role: 'Clerk', baseSalary: 28000 },
    { id: 's2', name: 'Neha Sharma', role: 'Librarian', baseSalary: 32000 },
  ];
  const vendors = [
    { id: 'v1', name: 'ABC Transport Co.', service: 'Bus Service', due: 75000 },
    { id: 'v2', name: 'Tech Supplies Ltd', service: 'IT Maintenance', due: 42000 },
  ];
  const teacherAttendance = { t1: { [salaryMonth]: 24 }, t2: { [salaryMonth]: 26 }, t3: { [salaryMonth]: 25 } };
  const staffAttendance = { s1: { [salaryMonth]: 25 }, s2: { [salaryMonth]: 24 } };
  const getAttendance = (empId, role, month) => (role === 'teachers' ? teacherAttendance[empId]?.[month] : staffAttendance[empId]?.[month]) ?? WORKING_DAYS;
  const computeNetPay = (baseSalary, presentDays) => {
    const perDay = baseSalary / WORKING_DAYS;
    const earnings = perDay * presentDays;
    const allowances = Math.round(baseSalary * 0.10);
    const net = Math.max(0, Math.round(earnings + allowances));
    return { perDay: Math.round(perDay), earnings: Math.round(earnings), allowances, net };
  };
  const generatePayslipPDF = (emp, role, month) => {
    const presentDays = getAttendance(emp.id, role, month);
    const { perDay, earnings, allowances, net } = computeNetPay(emp.baseSalary, presentDays);
    const doc = new jsPDF('p', 'pt', 'a4');
    const m = 48; let y = m;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('EEC Payslip', m, y); y += 14;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`Month: ${month}`, m, y); y += 18;
    doc.setFont('helvetica', 'bold'); doc.text('Employee', m, y); y += 14; doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${emp.name}`, m, y); y += 14;
    doc.text(`Role: ${emp.designation || emp.role || (role === 'teachers' ? 'Teacher' : 'Staff')}`, m, y); y += 14;
    doc.text(`Employee ID: ${emp.id}`, m, y); y += 20;
    doc.setFont('helvetica', 'bold'); doc.text('Salary Summary', m, y); y += 14; doc.setFont('helvetica', 'normal');
    const lines = [
      ['Base Salary', `₹${emp.baseSalary.toLocaleString()}`],
      ['Working Days', `${WORKING_DAYS}`],
      ['Present Days', `${presentDays}`],
      ['Per Day', `₹${perDay.toLocaleString()}`],
      ['Earnings', `₹${earnings.toLocaleString()}`],
      ['Allowances (10%)', `₹${allowances.toLocaleString()}`],
      ['Net Pay', `₹${net.toLocaleString()}`],
    ];
    lines.forEach(([k, v]) => { doc.text(k, m, y); doc.text(v, 400, y, { align: 'right' }); y += 14; });
    y += 10; doc.setFont('helvetica', 'italic'); doc.text('System generated payslip', m, y);
    doc.save(`Payslip_${emp.name.replace(/\s+/g, '_')}_${month}.pdf`);
  };

  // HR Enhancements
  const [employees, setEmployees] = useState([...teachers.map(t => ({ id: t.id, name: t.name, role: t.designation || 'Teacher', type: 'Teacher' })), ...staff.map(s => ({ id: s.id, name: s.name, role: s.role || 'Staff', type: 'Staff' }))]);
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: '', role: '', type: 'Teacher', baseSalary: '' });

  // ID Card functionality
  const [showIDCard, setShowIDCard] = useState(false);
  const [idCardData, setIdCardData] = useState(null);
  const [idCardType, setIdCardType] = useState('student');
  const idCardRef = useRef();
  const addEmployee = (e) => {
    e.preventDefault();
    if (!newEmp.name) return;
    const id = `${newEmp.type === 'Teacher' ? 't' : 's'}${employees.length + 1}`;
    setEmployees(prev => [...prev, { id, name: newEmp.name, role: newEmp.role, type: newEmp.type }]);
    setShowAddEmp(false); setNewEmp({ name: '', role: '', type: 'Teacher', baseSalary: '' });
  };

  const [teacherActivityMonth, setTeacherActivityMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [hrNotice, setHrNotice] = useState({ type: '', text: '' });
  const [teacherLeaves, setTeacherLeaves] = useState([]);
  const [teacherExpenses, setTeacherExpenses] = useState([]);
  const [teacherAttendanceRecords, setTeacherAttendanceRecords] = useState([]);
  const [attendanceSettings, setAttendanceSettings] = useState({ entryTime: '09:00', exitTime: '17:00', graceMinutes: 0 });
  const [attendanceSettingsSaving, setAttendanceSettingsSaving] = useState(false);
  const [leavePolicy, setLeavePolicy] = useState({ casualLeaveDays: 12 });
  const [leavePolicySaving, setLeavePolicySaving] = useState(false);
  const [attendanceTeacherFilter, setAttendanceTeacherFilter] = useState('all');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('all');
  const [attendanceSearch, setAttendanceSearch] = useState('');

  // Leave filters
  const [leaveTeacherFilter, setLeaveTeacherFilter] = useState('all');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('all');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all');
  const [leaveSearch, setLeaveSearch] = useState('');
  const [showLeaveLetterModal, setShowLeaveLetterModal] = useState(false);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);

  // Expense filters
  const [expenseTeacherFilter, setExpenseTeacherFilter] = useState('all');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('all');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [expenseSearch, setExpenseSearch] = useState('');

  const toFriendlyHrError = (err, fallback) => {
    const message = String(err?.message || '').trim();
    if (!message) return fallback;
    const lower = message.toLowerCase();
    if (
      lower.includes('failed to fetch') ||
      lower.includes('network error') ||
      lower.includes('network') ||
      lower.includes('unexpected token')
    ) {
      return fallback;
    }
    return message;
  };

  const normalizedStatus = (status) => String(status || '').trim().toLowerCase();

  const formatLongDate = (value) => {
    if (!value) return '-';
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(parsed);
  };

  const formatLeaveDateRange = (startDate, endDate) => {
    const start = formatLongDate(startDate);
    const end = formatLongDate(endDate);
    if (!startDate && !endDate) return '-';
    if (String(startDate || '').trim() === String(endDate || '').trim()) return start;
    if (!endDate || start === end) return start;
    return `${start} to ${end}`;
  };

  const formatLeaveSubjectDate = (startDate, endDate) => {
    const start = formatLongDate(startDate);
    const end = formatLongDate(endDate);
    if (!startDate && !endDate) return '';
    if (String(startDate || '').trim() === String(endDate || '').trim() || !endDate || start === end) {
      return `on ${start}`;
    }
    return `from ${start} to ${end}`;
  };

  const schoolDisplayName = useMemo(() => getSchoolDisplayName(), []);

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

  const handlePrintLeaveLetter = () => {
    if (!selectedLeaveRequest) return;
    const teacherName = selectedLeaveRequest.teacherName || 'Teacher';
    const teacherEmail = String(selectedLeaveRequest.teacherEmail || '').trim() || 'Not provided';
    const teacherPhone = String(selectedLeaveRequest.teacherPhone || '').trim() || 'Not provided';
    const subjectDate = formatLeaveSubjectDate(selectedLeaveRequest.startDate, selectedLeaveRequest.endDate);
    const leavePeriod = formatLeaveDateRange(selectedLeaveRequest.startDate, selectedLeaveRequest.endDate);
    const printHtml = `
      <html>
        <head>
          <title>Leave Letter</title>
          <style>
            @page { size: A4; margin: 18mm; }
            html, body { width: 210mm; min-height: 297mm; margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; color: #111827; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { width: 100%; min-height: 297mm; box-sizing: border-box; }
            .header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 28px; }
            .title { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
            .muted { color: #6b7280; font-size: 12px; margin: 0; line-height: 1.5; }
            .body { font-size: 13px; line-height: 1.8; }
            .body p { margin: 0 0 14px; }
            .subject { text-align: center; font-weight: 600; }
            .reason { white-space: pre-wrap; }
            .signature { margin-top: 40px; }
            .signature .name { font-weight: 700; margin-top: 6px; }
            .label { font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div>
                <p class="title">${escapeHtml(`${schoolDisplayName} Administration`)}</p>
                <p class="muted">Human Resource Department</p>
              </div>
              <div style="text-align:right;">
                <p class="muted">${escapeHtml(formatLongDate(selectedLeaveRequest.createdAt))}</p>
                <p class="muted">Status: ${escapeHtml(selectedLeaveRequest.status || '-')}</p>
              </div>
            </div>

            <div class="body">
              <p><span class="label">To,</span><br />The HR/Admin<br />${escapeHtml(schoolDisplayName)}</p>
              <p class="subject"><span class="label">Subject:</span> Application for ${escapeHtml(selectedLeaveRequest.type || 'leave')} ${escapeHtml(subjectDate)}</p>
              <p>Dear Sir/Madam,</p>
              <p>I respectfully request leave for the period mentioned above. The reason provided by me is shown below.</p>
              <p class="reason">${escapeHtml(selectedLeaveRequest.reason?.trim() || 'No reason provided.')}</p>
              ${selectedLeaveRequest.adminNote ? `<p><span class="label">Admin note:</span><br />${escapeHtml(selectedLeaveRequest.adminNote)}</p>` : ''}
              <p>I request you to kindly consider this leave application and grant approval.</p>
              <p>Regards,</p>
              <div class="signature">
                <p class="name">${escapeHtml(teacherName)}</p>
                <p class="muted">Email: ${escapeHtml(teacherEmail)}</p>
                <p class="muted">Phone: ${escapeHtml(teacherPhone)}</p>
              </div>
              <p class="muted" style="margin-top: 18px;">Leave period: ${escapeHtml(leavePeriod)}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  const countWeekdaysInMonth = (month) => {
    const [yearStr, monthStr] = String(month || '').split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return 0;
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
    const endDay = isCurrentMonth ? today.getDate() : new Date(year, monthIndex + 1, 0).getDate();
    let count = 0;
    for (let day = 1; day <= endDay; day += 1) {
      const weekday = new Date(year, monthIndex, day).getDay();
      if (weekday !== 0 && weekday !== 6) count += 1;
    }
    return count;
  };

  const attendanceTeacherOptions = useMemo(() => {
    const map = new Map();
    teacherAttendanceRecords.forEach((record) => {
      if (!record?.teacherId) return;
      map.set(String(record.teacherId), record.teacherName || 'Teacher');
    });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [teacherAttendanceRecords]);

  const attendanceStatusOptions = useMemo(() => {
    const statuses = new Set();
    teacherAttendanceRecords.forEach((r) => { if (r?.status) statuses.add(r.status); });
    return [...statuses].sort();
  }, [teacherAttendanceRecords]);

  const attendanceFilteredRecords = useMemo(() => {
    let records = teacherAttendanceRecords;
    if (attendanceTeacherFilter !== 'all') records = records.filter((r) => String(r.teacherId) === String(attendanceTeacherFilter));
    if (attendanceStatusFilter !== 'all') records = records.filter((r) => r.status === attendanceStatusFilter);
    if (attendanceSearch.trim()) {
      const q = attendanceSearch.trim().toLowerCase();
      records = records.filter((r) => (r.teacherName || '').toLowerCase().includes(q) || (r.date || '').includes(q));
    }
    return records;
  }, [teacherAttendanceRecords, attendanceTeacherFilter, attendanceStatusFilter, attendanceSearch]);

  const attendanceSummary = useMemo(() => {
    const byTeacher = new Map();
    teacherAttendanceRecords.forEach((record) => {
      const teacherId = String(record.teacherId || '');
      if (!teacherId) return;
      const current = byTeacher.get(teacherId) || { presentDays: 0 };
      current.presentDays += 1;
      byTeacher.set(teacherId, current);
    });

    const workingDays = countWeekdaysInMonth(teacherActivityMonth);
    if (attendanceTeacherFilter !== 'all') {
      const presentDays = byTeacher.get(String(attendanceTeacherFilter))?.presentDays || 0;
      return {
        teachers: 1,
        presentDays,
        absentDays: Math.max(workingDays - presentDays, 0),
      };
    }

    const teacherCount = attendanceTeacherOptions.length;
    let presentDays = 0;
    let absentDays = 0;
    attendanceTeacherOptions.forEach((teacher) => {
      const p = byTeacher.get(String(teacher.id))?.presentDays || 0;
      presentDays += p;
      absentDays += Math.max(workingDays - p, 0);
    });
    return { teachers: teacherCount, presentDays, absentDays };
  }, [teacherAttendanceRecords, attendanceTeacherFilter, teacherActivityMonth, attendanceTeacherOptions]);

  // Leave filter options & filtered data
  const leaveTeacherOptions = useMemo(() => {
    const map = new Map();
    teacherLeaves.forEach((l) => { if (l?.teacherId) map.set(String(l.teacherId), l.teacherName || 'Teacher'); });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [teacherLeaves]);

  const leaveTypeOptions = useMemo(() => {
    const types = new Set();
    teacherLeaves.forEach((l) => { if (l?.type) types.add(l.type); });
    return [...types].sort();
  }, [teacherLeaves]);

  const filteredLeaves = useMemo(() => {
    let leaves = teacherLeaves;
    if (leaveTeacherFilter !== 'all') leaves = leaves.filter((l) => String(l.teacherId) === String(leaveTeacherFilter));
    if (leaveStatusFilter !== 'all') leaves = leaves.filter((l) => normalizedStatus(l.status) === leaveStatusFilter);
    if (leaveTypeFilter !== 'all') leaves = leaves.filter((l) => l.type === leaveTypeFilter);
    if (leaveSearch.trim()) {
      const q = leaveSearch.trim().toLowerCase();
      leaves = leaves.filter((l) => (l.teacherName || '').toLowerCase().includes(q) || (l.type || '').toLowerCase().includes(q) || (l.reason || '').toLowerCase().includes(q));
    }
    return leaves;
  }, [teacherLeaves, leaveTeacherFilter, leaveStatusFilter, leaveTypeFilter, leaveSearch]);

  const leaveSummary = useMemo(() => {
    const total = teacherLeaves.length;
    const pending = teacherLeaves.filter((l) => normalizedStatus(l.status) === 'pending').length;
    const approved = teacherLeaves.filter((l) => normalizedStatus(l.status) === 'approved' || normalizedStatus(l.status) === 'accepted').length;
    const rejected = teacherLeaves.filter((l) => normalizedStatus(l.status) === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [teacherLeaves]);

  // Expense filter options & filtered data
  const expenseTeacherOptions = useMemo(() => {
    const map = new Map();
    teacherExpenses.forEach((e) => { if (e?.teacherId) map.set(String(e.teacherId), e.teacherName || 'Teacher'); });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [teacherExpenses]);

  const expenseCategoryOptions = useMemo(() => {
    const cats = new Set();
    teacherExpenses.forEach((e) => { if (e?.category) cats.add(e.category); });
    return [...cats].sort();
  }, [teacherExpenses]);

  const filteredExpenses = useMemo(() => {
    let expenses = teacherExpenses;
    if (expenseTeacherFilter !== 'all') expenses = expenses.filter((e) => String(e.teacherId) === String(expenseTeacherFilter));
    if (expenseStatusFilter !== 'all') expenses = expenses.filter((e) => normalizedStatus(e.status) === expenseStatusFilter);
    if (expenseCategoryFilter !== 'all') expenses = expenses.filter((e) => e.category === expenseCategoryFilter);
    if (expenseSearch.trim()) {
      const q = expenseSearch.trim().toLowerCase();
      expenses = expenses.filter((e) => (e.teacherName || '').toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q));
    }
    return expenses;
  }, [teacherExpenses, expenseTeacherFilter, expenseStatusFilter, expenseCategoryFilter, expenseSearch]);

  const expenseSummary = useMemo(() => {
    const total = teacherExpenses.length;
    const totalAmount = teacherExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const pending = teacherExpenses.filter((e) => normalizedStatus(e.status) === 'pending').length;
    const pendingAmount = teacherExpenses.filter((e) => normalizedStatus(e.status) === 'pending').reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const approved = teacherExpenses.filter((e) => normalizedStatus(e.status) === 'approved' || normalizedStatus(e.status) === 'accepted').length;
    const approvedAmount = teacherExpenses.filter((e) => normalizedStatus(e.status) === 'approved' || normalizedStatus(e.status) === 'accepted').reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const rejected = teacherExpenses.filter((e) => normalizedStatus(e.status) === 'rejected').length;
    return { total, totalAmount, pending, pendingAmount, approved, approvedAmount, rejected };
  }, [teacherExpenses]);

  // Status badge helper

  // Table pagination per tab (see usePagination above the component).
  const attendancePager = usePagination(attendanceFilteredRecords);
  const leavesPager = usePagination(filteredLeaves);
  const expensesPager = usePagination(filteredExpenses);
  const [showHrSettings, setShowHrSettings] = useState(false);

  const StatusBadge = ({ status }) => {
    const s = normalizedStatus(status);
    const config = {
      present: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
      approved: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
      accepted: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
      pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
      absent: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
      late: { bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertCircle },
      'half day': { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock },
    };
    const c = config[s] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: AlertCircle };
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
        <Icon size={12} />
        {status}
      </span>
    );
  };

  // Active filter count helper
  const countActiveFilters = (filters) => filters.filter((f) => f !== 'all' && f !== '').length;

  const openLeaveLetter = (leave) => {
    setSelectedLeaveRequest(leave || null);
    setShowLeaveLetterModal(true);
  };

  const closeLeaveLetter = () => {
    setShowLeaveLetterModal(false);
    setSelectedLeaveRequest(null);
  };

  const formatWorkingHours = (minutes) => {
    const totalMinutes = Number(minutes || 0);
    if (!totalMinutes) return '-';
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${String(mins).padStart(2, '0')}m`;
  };

  const fetchTeacherActivities = async (month = teacherActivityMonth) => {
    setActivityLoading(true);
    setActivityError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Admin login required');

      const [leavesRes, expensesRes, attendanceRes, attendanceSettingsRes, leavePolicyRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/users/teacher-leaves`, {
          headers: { authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/admin/users/teacher-expenses`, {
          headers: { authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/admin/users/teacher-attendance?month=${encodeURIComponent(month)}`, {
          headers: { authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/admin/users/teacher-attendance-settings`, {
          headers: { authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/admin/users/teacher-leave-policy`, {
          headers: { authorization: `Bearer ${token}` }
        }),
      ]);

      const [leavesData, expensesData, attendanceData, attendanceSettingsData, leavePolicyData] = await Promise.all([
        leavesRes.json().catch(() => ({})),
        expensesRes.json().catch(() => ({})),
        attendanceRes.json().catch(() => ({})),
        attendanceSettingsRes.json().catch(() => ({})),
        leavePolicyRes.json().catch(() => ({})),
      ]);

      if (!leavesRes.ok) throw new Error(leavesData?.error || 'Unable to load teacher leaves');
      if (!expensesRes.ok) throw new Error(expensesData?.error || 'Unable to load teacher expenses');
      if (!attendanceRes.ok) throw new Error(attendanceData?.error || 'Unable to load teacher attendance');
      if (!attendanceSettingsRes.ok) throw new Error(attendanceSettingsData?.error || 'Unable to load attendance settings');
      if (!leavePolicyRes.ok) throw new Error(leavePolicyData?.error || 'Unable to load leave policy');

      setTeacherLeaves(Array.isArray(leavesData.leaves) ? leavesData.leaves : []);
      setTeacherExpenses(Array.isArray(expensesData.expenses) ? expensesData.expenses : []);
      setTeacherAttendanceRecords(Array.isArray(attendanceData.records) ? attendanceData.records : []);
      setAttendanceSettings({
        entryTime: attendanceSettingsData?.settings?.entryTime || '09:00',
        exitTime: attendanceSettingsData?.settings?.exitTime || '17:00',
        graceMinutes: Number.isFinite(attendanceSettingsData?.settings?.graceMinutes)
          ? attendanceSettingsData.settings.graceMinutes
          : 0,
      });
      setLeavePolicy({
        casualLeaveDays: Number.isFinite(Number(leavePolicyData?.policy?.casualLeaveDays))
          ? Number(leavePolicyData.policy.casualLeaveDays)
          : 12,
      });
    } catch (err) {
      setActivityError(toFriendlyHrError(err, 'Could not load HR data. Please try again.'));
    } finally {
      setActivityLoading(false);
    }
  };

  const saveLeavePolicy = async () => {
    setActivityError('');
    setLeavePolicySaving(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Admin login required');
      const res = await fetch(`${API_BASE}/api/admin/users/teacher-leave-policy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          casualLeaveDays: leavePolicy.casualLeaveDays,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to save leave policy');
      setLeavePolicy({
        casualLeaveDays: Number.isFinite(Number(data?.policy?.casualLeaveDays))
          ? Number(data.policy.casualLeaveDays)
          : Number(leavePolicy.casualLeaveDays) || 0,
      });
    } catch (err) {
      setActivityError(toFriendlyHrError(err, 'Could not save leave policy. Please try again.'));
    } finally {
      setLeavePolicySaving(false);
    }
  };

  const saveAttendanceSettings = async () => {
    setActivityError('');
    setAttendanceSettingsSaving(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Admin login required');
      const res = await fetch(`${API_BASE}/api/admin/users/teacher-attendance-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entryTime: attendanceSettings.entryTime,
          exitTime: attendanceSettings.exitTime,
          graceMinutes: attendanceSettings.graceMinutes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to save attendance settings');
      setAttendanceSettings({
        entryTime: data?.settings?.entryTime || attendanceSettings.entryTime,
        exitTime: data?.settings?.exitTime || attendanceSettings.exitTime,
        graceMinutes: Number.isFinite(data?.settings?.graceMinutes)
          ? data.settings.graceMinutes
          : attendanceSettings.graceMinutes,
      });
      await fetchTeacherActivities(teacherActivityMonth);
    } catch (err) {
      setActivityError(toFriendlyHrError(err, 'Could not save attendance settings. Please try again.'));
    } finally {
      setAttendanceSettingsSaving(false);
    }
  };

  useEffect(() => {
    if (tab === 'attendance' || tab === 'leaves' || tab === 'expenses') {
      fetchTeacherActivities(teacherActivityMonth);
    }
  }, [tab, teacherActivityMonth]);

  useEffect(() => {
    const tabParam = String(searchParams.get('tab') || '').trim().toLowerCase();
    if (tabParam === 'attendance' || tabParam === 'leaves' || tabParam === 'expenses') {
      setTab(tabParam);
    }
  }, [searchParams]);

  const reviewLeaveRequest = async (leaveId, status) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Admin login required');
      const res = await fetch(`${API_BASE}/api/admin/users/teacher-leaves/${leaveId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to update leave status');
      await fetchTeacherActivities(teacherActivityMonth);
    } catch (err) {
      setActivityError(toFriendlyHrError(err, 'Could not update leave status. Please try again.'));
    }
  };

  const reviewExpenseClaim = async (expenseId, status) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Admin login required');
      const res = await fetch(`${API_BASE}/api/admin/users/teacher-expenses/${expenseId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to update expense status');
      await fetchTeacherActivities(teacherActivityMonth);
    } catch (err) {
      setActivityError(toFriendlyHrError(err, 'Could not update expense status. Please try again.'));
    }
  };

  const [jobs] = useState([
    { id: 'J1', title: 'Science Teacher', openings: 2, status: 'Open' },
    { id: 'J2', title: 'Office Assistant', openings: 1, status: 'Open' },
  ]);
  const [candidates] = useState([
    { id: 'C1', name: 'Rohit Das', for: 'Science Teacher', status: 'Screening' },
    { id: 'C2', name: 'Meera N', for: 'Office Assistant', status: 'Interview' },
  ]);

  const [policies, setPolicies] = useState([
    { id: 'P1', name: 'Leave Policy.pdf', date: '2025-06-01' },
    { id: 'P2', name: 'Code of Conduct.pdf', date: '2025-05-12' },
  ]);
  const [uploadName, setUploadName] = useState('');
  const uploadPolicy = (e) => { e.preventDefault(); if (!uploadName) return; setPolicies(prev => [{ id: `P${prev.length + 1}`, name: uploadName, date: new Date().toISOString().slice(0, 10) }, ...prev]); setUploadName(''); };

  // ID Card generation functions
  const generateIDCard = (personData, type) => {
    setIdCardData(personData);
    setIdCardType(type);
    setShowIDCard(true);
  };

  const downloadIDCardPDF = async () => {
    if (!idCardData) return;

    try {
      // Use the same dimensions as the visual card for consistency
      const pdf = new jsPDF('landscape', 'mm', [101.6, 63.5]); // Credit card size + margins

      // Helper function to load image as base64
      const loadImageAsBase64 = (url) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });
      };

      // Generate QR data and get QR image
      const qrData = JSON.stringify({
        id: idCardData.empId || idCardData.admissionNo || `${idCardType.toUpperCase()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        name: `${idCardData.firstName || ''} ${idCardData.lastName || ''}`.trim(),
        type: idCardType,
        school: 'Electronic Educare',
        issued: new Date().toISOString().split('T')[0],
        verification: Math.random().toString(36).substring(2, 15)
      });

      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;

      // Header background gradient effect
      const headerColors = {
        student: [59, 130, 246],
        teacher: [34, 197, 94],
        staff: [147, 51, 234]
      };
      const [r, g, b] = headerColors[idCardType] || [100, 100, 100];

      // Header section with rounded corners effect
      pdf.setFillColor(r, g, b);
      pdf.roundedRect(3, 3, 95.6, 20, 3, 3, 'F');

      // Header gradient effect
      for (let i = 0; i < 20; i++) {
        const alpha = 1 - (i / 20) * 0.4;
        pdf.setFillColor(r * alpha, g * alpha, b * alpha);
        pdf.roundedRect(3, 3 + i, 95.6, 1, 3, 3, 'F');
      }

      // Header text
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('ELECTRONIC EDUCARE', 50.8, 10, { align: 'center' });
      pdf.setFontSize(8);
      pdf.text(`${idCardType.toUpperCase()} ID CARD`, 50.8, 16, { align: 'center' });

      // EEC logo placeholder
      pdf.setFillColor(255, 255, 255, 0.3);
      pdf.circle(10, 13, 3, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(6);
      pdf.text('EEC', 10, 14, { align: 'center' });

      // Security hologram
      pdf.setFillColor(255, 215, 0);
      pdf.circle(90, 13, 2.5, 'F');
      pdf.setFillColor(255, 255, 255, 0.6);
      pdf.circle(90, 13, 1.5, 'F');

      // Main content area with background
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(3, 26, 95.6, 32, 2, 2, 'F');

      pdf.setTextColor(0, 0, 0);
      let y = 30;

      // Profile photo with modern styling
      let photoY = y;
      if (idCardData.photo) {
        try {
          const photoBase64 = await loadImageAsBase64(idCardData.photo);
          if (photoBase64) {
            // Add photo with rounded corner effect
            pdf.addImage(photoBase64, 'JPEG', 10, photoY, 20, 24);

            // Add border around photo
            pdf.setDrawColor(r, g, b);
            pdf.setLineWidth(0.5);
            pdf.roundedRect(10, photoY, 20, 24, 2, 2, 'D');
          } else {
            // Modern photo placeholder
            pdf.setDrawColor(r, g, b);
            pdf.setFillColor(248, 250, 252);
            pdf.roundedRect(10, photoY, 20, 24, 2, 2, 'FD');
            pdf.setFontSize(10);
            pdf.text('📷', 20, photoY + 10, { align: 'center' });
            pdf.setFontSize(7);
            pdf.text('PHOTO', 20, photoY + 16, { align: 'center' });
          }
        } catch {
          // Fallback photo placeholder
          pdf.setDrawColor(r, g, b);
          pdf.setFillColor(248, 250, 252);
          pdf.roundedRect(10, photoY, 20, 24, 2, 2, 'FD');
          pdf.setFontSize(10);
          pdf.text('📷', 20, photoY + 10, { align: 'center' });
          pdf.setFontSize(7);
          pdf.text('PHOTO', 20, photoY + 16, { align: 'center' });
        }
      } else {
        // Modern photo placeholder
        pdf.setDrawColor(r, g, b);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(10, photoY, 20, 24, 2, 2, 'FD');
        pdf.setFontSize(10);
        pdf.text('📷', 20, photoY + 10, { align: 'center' });
        pdf.setFontSize(7);
        pdf.text('PHOTO', 20, photoY + 16, { align: 'center' });
      }

      // Personal details section
      const fullName = `${idCardData.firstName || ''} ${idCardData.lastName || ''}`.trim();
      const idNumber = idCardData.empId || idCardData.admissionNo || `${idCardType.toUpperCase()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      // Name and ID
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(r, g, b);
      pdf.text(fullName, 35, y + 5);

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      pdf.text(`ID: ${idNumber}`, 35, y + 11);

      // Role/Class specific information
      pdf.setFontSize(9);
      pdf.setTextColor(60, 60, 60);
      if (idCardType === 'student') {
        pdf.text(`Class ${idCardData.class || 'N/A'} • Section ${idCardData.section || 'A'}`, 35, y + 16);
        if (idCardData.rollNo) pdf.text(`Roll No: ${idCardData.rollNo}`, 35, y + 21);
      } else {
        const role = idCardData.designation || idCardData.role || (idCardType === 'teacher' ? 'Teacher' : 'Staff');
        pdf.text(role, 35, y + 16);
        if (idCardData.department) pdf.text(idCardData.department, 35, y + 21);
      }

      // Additional info
      if (idCardData.phone) {
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`📞 ${idCardData.phone}`, 35, y + 26);
      }

      // QR Code with modern styling
      try {
        const qrBase64 = await loadImageAsBase64(qrUrl);
        if (qrBase64) {
          pdf.addImage(qrBase64, 'PNG', 78, y, 18, 18);
          // Add border around QR
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(78, y, 18, 18, 1, 1, 'D');
        } else {
          // Modern QR placeholder
          pdf.setDrawColor(200, 200, 200);
          pdf.setFillColor(250, 250, 250);
          pdf.roundedRect(78, y, 18, 18, 1, 1, 'FD');
          pdf.setFontSize(7);
          pdf.setTextColor(120, 120, 120);
          pdf.text('QR CODE', 87, y + 10, { align: 'center' });
        }
      } catch {
        // Modern QR placeholder
        pdf.setDrawColor(200, 200, 200);
        pdf.setFillColor(250, 250, 250);
        pdf.roundedRect(78, y, 18, 18, 1, 1, 'FD');
        pdf.setFontSize(7);
        pdf.setTextColor(120, 120, 120);
        pdf.text('QR CODE', 87, y + 10, { align: 'center' });
      }

      // Footer with modern styling
      const currentYear = new Date().getFullYear();
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(3, 61, 95.6, 8, 2, 2, 'F');

      pdf.setFontSize(7);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Valid: ${currentYear}-${currentYear + 1}`, 8, 65.5);
      pdf.text('🛡️ Authorized Personnel Only', 50.8, 65.5, { align: 'center' });
      pdf.text('Electronic Educare', 93, 65.5, { align: 'right' });

      // Modern border with rounded corners
      pdf.setDrawColor(r, g, b);
      pdf.setLineWidth(1);
      pdf.roundedRect(3, 3, 95.6, 57.5, 3, 3, 'D');

      pdf.save(`ID_Card_${idCardData.firstName}_${idCardData.lastName}_${idCardType}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setHrNotice({ type: 'error', text: 'Unable to generate ID card PDF. Please try again.' });
    }
  };

  const printIDCard = () => {
    if (!idCardRef.current) return;
    // Print the current page instead of copying HTML into a blank popup
    // window — a popup has none of this app's stylesheets loaded, so the
    // Tailwind-styled card rendered with no layout/colors at all (which is
    // why it looked completely empty). #id-card-print-section below hides
    // everything else on the page during printing so only the card shows.
    window.print();
  };

  // Add New functionality merged from NewAdd component
  const [addTab, setAddTab] = useState('teacher');
  const handleSubmit = (e, kind) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const entries = {};
    for (const [k, v] of data.entries()) entries[k] = v;
    if (entries.firstName) {
      generateIDCard(entries, kind.toLowerCase());
    }
    setHrNotice({
      type: 'info',
      text: `${kind} form captured. Persistence API is pending for this section, but ID card preview is ready.`,
    });
  };

  // Form components for Add New section
  const Section = ({ title, children }) => (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
      <h4 className="text-md font-semibold text-gray-800 mb-3">{title}</h4>
      {children}
    </div>
  );

  const Input = ({ label, type = 'text', className = '', inputClassName = '', onFocus, onClick, ...props }) => {
    const openDatePicker = (event) => {
      if (type === 'date' && typeof event?.target?.showPicker === 'function') {
        event.target.showPicker();
      }
    };

    const handleFocus = (event) => {
      openDatePicker(event);
      if (typeof onFocus === 'function') onFocus(event);
    };

    const handleClick = (event) => {
      openDatePicker(event);
      if (typeof onClick === 'function') onClick(event);
    };

    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <label className="text-sm text-gray-700">{label}</label>
        <input
          type={type}
          className={`border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent ${inputClassName}`}
          onFocus={handleFocus}
          onClick={handleClick}
          {...props}
        />
      </div>
    );
  };

  const Select = ({ label, children, className = '', selectClassName = '', ...props }) => (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm text-gray-700">{label}</label>
      <select className={`border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent ${selectClassName}`} {...props}>
        {children}
      </select>
    </div>
  );

  const TextArea = ({ label, rows = 3, className = '', textareaClassName = '', ...props }) => (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm text-gray-700">{label}</label>
      <textarea rows={rows} className={`border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent ${textareaClassName}`} {...props} />
    </div>
  );

  const FileInput = ({ label, multiple = false, className = '', inputClassName = '', name, ...props }) => {
    const [preview, setPreview] = useState(null);

    const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setPreview(event.target.result);
        };
        reader.readAsDataURL(file);
      }

      // Call original onChange if provided
      if (props.onChange) props.onChange(e);
    };

    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <label className="text-sm text-gray-700">{label}</label>
        <input
          type="file"
          multiple={multiple}
          name={name}
          className={`border border-gray-300 rounded-lg px-3 py-2 bg-white ${inputClassName}`}
          onChange={handleFileChange}
          {...props}
        />
        {preview && name === 'photo' && (
          <div className="mt-2">
            <img src={preview} alt="Preview" className="w-16 h-20 object-cover rounded-lg border border-gray-300" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 p-4 md:p-5">
      <div className="max-w-7xl mx-auto">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">HR Management</h1>
            <p className="mt-0.5 text-sm text-gray-500">Teacher attendance, leave requests and expense claims in one place.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
              {[
                { key: 'attendance', label: 'Attendance', icon: Clock },
                { key: 'leaves', label: 'Leaves', icon: CalendarCheck, badge: leaveSummary.pending },
                // { key: 'expenses', label: 'Expenses', icon: IndianRupee, badge: expenseSummary.pending },
              ].map(({ key, label, icon: Icon, badge }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setTab(key); setShowHrSettings(false); }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === key ? 'bg-yellow-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                  <Icon size={15} /> {label}
                  {badge > 0 && (
                    <span className={`rounded-full px-1.5 text-[10px] font-bold ${tab === key ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'}`}>{badge}</span>
                  )}
                </button>
              ))}
            </div>
            {tab !== 'expenses' && (
              <button
                type="button"
                onClick={() => setShowHrSettings((v) => !v)}
                className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition ${showHrSettings ? 'border-yellow-300 bg-yellow-50 text-yellow-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                title={tab === 'attendance' ? 'Attendance timings' : 'Leave policy'}
              >
                <Settings size={15} /> <span className="hidden sm:inline">Settings</span>
              </button>
            )}
          </div>
        </div>

        {hrNotice.text && (
          <div className={`mb-6 rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
            hrNotice.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}>
            <AlertCircle size={16} className="shrink-0" />
            <span>{hrNotice.text}</span>
          </div>
        )}

        {/* Payroll */}
        {tab === 'payroll' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-700">Month:</span>
              <input type="month" value={salaryMonth} onChange={(e) => setSalaryMonth(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base Salary</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present/Working</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allowances</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Pay</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {[...teachers.map(t => ({ ...t, _type: 'teachers' })), ...staff.map(s => ({ ...s, _type: 'staff' }))].map(emp => {
                    const present = getAttendance(emp.id, emp._type, salaryMonth);
                    const { allowances, net } = computeNetPay(emp.baseSalary, present);
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                          <div className="text-sm text-gray-500">{emp.designation || emp.role || (emp._type === 'teachers' ? 'Teacher' : 'Staff')}</div>
                        </td>
                        <td className="px-6 py-4 text-sm">₹{emp.baseSalary.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm">{present}/{WORKING_DAYS}</td>
                        <td className="px-6 py-4 text-sm">₹{allowances.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">₹{net.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex gap-2">
                            <button onClick={() => generatePayslipPDF(emp, emp._type, salaryMonth)} className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50">
                              <FileText size={14} className="mr-1" /> Payslip
                            </button>
                            <button
                              type="button"
                              disabled
                              title="Payroll payment integration is not available yet"
                              className="inline-flex items-center px-3 py-1 rounded text-gray-500 bg-gray-100 cursor-not-allowed"
                            >
                              Payment unavailable
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vendors */}
        {tab === 'vendors' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vendors.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{v.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{v.service}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{v.due.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          type="button"
                          disabled
                          title="Vendor payment integration is not available yet"
                          className="inline-flex items-center px-3 py-1 rounded text-gray-500 bg-gray-100 cursor-not-allowed"
                        >
                          Payment unavailable
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Attendance */}
        {tab === 'attendance' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatChip icon={Users} label="Teachers" value={attendanceSummary.teachers} tone="blue" />
              <StatChip icon={CheckCircle} label="Present entries" value={attendanceSummary.presentDays} tone="green" />
              <StatChip icon={XCircle} label="Absent (month)" value={attendanceSummary.absentDays} tone="red" />
            </div>

            {showHrSettings && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50/40 p-4">
                <p className="mb-3 text-sm font-semibold text-gray-800">Attendance timings</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="text-xs font-medium text-gray-600">Entry time
                    <input type="time" value={attendanceSettings.entryTime} onChange={(e) => setAttendanceSettings((prev) => ({ ...prev, entryTime: e.target.value }))} className={`mt-1 block w-full sm:w-40 ${toolbarInput}`} />
                  </label>
                  <label className="text-xs font-medium text-gray-600">Exit time
                    <input type="time" value={attendanceSettings.exitTime} onChange={(e) => setAttendanceSettings((prev) => ({ ...prev, exitTime: e.target.value }))} className={`mt-1 block w-full sm:w-40 ${toolbarInput}`} />
                  </label>
                  <label className="text-xs font-medium text-gray-600">Grace (min)
                    <input type="number" min="0" max="720" value={attendanceSettings.graceMinutes} onChange={(e) => setAttendanceSettings((prev) => ({ ...prev, graceMinutes: Number(e.target.value || 0) }))} className={`mt-1 block w-full sm:w-32 ${toolbarInput}`} />
                  </label>
                  <button type="button" onClick={saveAttendanceSettings} disabled={attendanceSettingsSaving || activityLoading} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-yellow-500 px-4 text-sm font-semibold text-white hover:bg-yellow-600 disabled:opacity-50">
                    <Clock size={14} /> {attendanceSettingsSaving ? 'Saving...' : 'Save timings'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">Teachers checking in within the grace time are marked Present. Working hours run from check-in to check-out.</p>
              </div>
            )}

            {activityError && (
              <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertCircle size={18} className="shrink-0 text-red-500" />
                <span className="text-sm text-red-700">{activityError}</span>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">

            <div className="flex flex-col gap-2 rounded-t-xl border-b border-gray-100 p-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or date..."
                  value={attendanceSearch}
                  onChange={(e) => setAttendanceSearch(e.target.value)}
                  className={`w-full pl-9 ${toolbarInput}`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="month" value={teacherActivityMonth} onChange={(e) => setTeacherActivityMonth(e.target.value)} className={toolbarInput} aria-label="Month" />
                <select value={attendanceTeacherFilter} onChange={(e) => setAttendanceTeacherFilter(e.target.value)} className={toolbarInput}>
                  <option value="all">All teachers</option>
                  {attendanceTeacherOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select value={attendanceStatusFilter} onChange={(e) => setAttendanceStatusFilter(e.target.value)} className={toolbarInput}>
                  <option value="all">All statuses</option>
                  {attendanceStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {(countActiveFilters([attendanceTeacherFilter, attendanceStatusFilter]) > 0 || attendanceSearch) && (
                  <button type="button" onClick={() => { setAttendanceTeacherFilter('all'); setAttendanceStatusFilter('all'); setAttendanceSearch(''); }} className="px-2 text-sm font-medium text-gray-500 hover:text-gray-800">Reset</button>
                )}
                <button type="button" onClick={() => fetchTeacherActivities(teacherActivityMonth)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50" title="Refresh" aria-label="Refresh">
                  <RefreshCw size={15} className={activityLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={thCls}>Teacher</th>
                      <th className={thCls}>Date</th>
                      <th className={thCls}>Check in</th>
                      <th className={thCls}>Check out</th>
                      <th className={thCls}>Hours</th>
                      <th className={thCls}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activityLoading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400"><RefreshCw size={16} className="mr-2 inline animate-spin text-yellow-600" />Loading attendance…</td></tr> : attendancePager.rows.map((record) => (
                      <tr key={record.id} className="transition-colors hover:bg-gray-50/70">
                        <td className="px-4 py-2.5"><PersonCell name={record.teacherName} /></td>
                        <td className={tdCls}>{formatLongDate(record.date) || record.date}</td>
                        <td className={tdCls}>{record.checkInAt ? new Date(record.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td className={tdCls}>{record.checkOutAt ? new Date(record.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td className={tdCls}>{formatWorkingHours(record.workingMinutes)}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={record.status} /></td>
                      </tr>
                    ))}
                    {!activityLoading && attendanceFilteredRecords.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No attendance records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {!activityLoading && <TablePagination pager={attendancePager} label="records" />}
            </div>
          </div>
        )}

        {/* Employee Directory */}
        {tab === 'employees' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2"><Users size={18} /> Employees</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employees.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{e.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-700">{e.role}</td>
                      <td className="px-6 py-3 text-sm text-gray-700">{e.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {showAddEmp && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
                <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-full max-w-md">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Add Employee</h3>
                    <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowAddEmp(false)}><X size={20} /></button>
                  </div>
                  <form onSubmit={addEmployee} className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Name</label>
                      <input className="w-full border border-gray-300 rounded-lg px-3 py-2" value={newEmp.name} onChange={e => setNewEmp({ ...newEmp, name: e.target.value })} required />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Role</label>
                      <input className="w-full border border-gray-300 rounded-lg px-3 py-2" value={newEmp.role} onChange={e => setNewEmp({ ...newEmp, role: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Type</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2" value={newEmp.type} onChange={e => setNewEmp({ ...newEmp, type: e.target.value })}>
                        <option>Teacher</option>
                        <option>Staff</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setShowAddEmp(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
                      <button type="submit" className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white">Add</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leaves */}
        {tab === 'leaves' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatChip icon={CalendarCheck} label="Total requests" value={leaveSummary.total} tone="blue" />
              <StatChip icon={Clock} label="Pending" value={leaveSummary.pending} tone="amber" />
              <StatChip icon={CheckCircle} label="Approved" value={leaveSummary.approved} tone="green" />
              <StatChip icon={XCircle} label="Rejected" value={leaveSummary.rejected} tone="red" />
            </div>

            {showHrSettings && (
              <div className="flex flex-col gap-3 rounded-xl border border-yellow-200 bg-yellow-50/40 p-4 sm:flex-row sm:items-end">
                <label className="text-xs font-medium text-gray-600">Casual leave days per teacher
                  <input type="number" min="0" max="365" value={leavePolicy.casualLeaveDays} onChange={(e) => setLeavePolicy((prev) => ({ ...prev, casualLeaveDays: e.target.value }))} className={`mt-1 block w-full sm:w-48 ${toolbarInput}`} />
                </label>
                <button type="button" onClick={saveLeavePolicy} disabled={leavePolicySaving} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-yellow-500 px-4 text-sm font-semibold text-white hover:bg-yellow-600 disabled:opacity-60">
                  {leavePolicySaving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {leavePolicySaving ? 'Saving...' : 'Save policy'}
                </button>
                <p className="text-xs text-gray-500 sm:pb-2.5">Teachers can take casual leave up to this approved quota.</p>
              </div>
            )}

            {activityError && (
              <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertCircle size={18} className="shrink-0 text-red-500" />
                <span className="text-sm text-red-700">{activityError}</span>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">

            <div className="flex flex-col gap-2 rounded-t-xl border-b border-gray-100 p-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, type or reason..."
                  value={leaveSearch}
                  onChange={(e) => setLeaveSearch(e.target.value)}
                  className={`w-full pl-9 ${toolbarInput}`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="month" value={teacherActivityMonth} onChange={(e) => setTeacherActivityMonth(e.target.value)} className={toolbarInput} aria-label="Month" />
                <select value={leaveTeacherFilter} onChange={(e) => setLeaveTeacherFilter(e.target.value)} className={toolbarInput}>
                  <option value="all">All teachers</option>
                  {leaveTeacherOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select value={leaveStatusFilter} onChange={(e) => setLeaveStatusFilter(e.target.value)} className={toolbarInput}>
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select value={leaveTypeFilter} onChange={(e) => setLeaveTypeFilter(e.target.value)} className={toolbarInput}>
                  <option value="all">All types</option>
                  {leaveTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {(countActiveFilters([leaveTeacherFilter, leaveStatusFilter, leaveTypeFilter]) > 0 || leaveSearch) && (
                  <button type="button" onClick={() => { setLeaveTeacherFilter('all'); setLeaveStatusFilter('all'); setLeaveTypeFilter('all'); setLeaveSearch(''); }} className="px-2 text-sm font-medium text-gray-500 hover:text-gray-800">Reset</button>
                )}
                <button type="button" onClick={() => fetchTeacherActivities(teacherActivityMonth)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50" title="Refresh" aria-label="Refresh">
                  <RefreshCw size={15} className={activityLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={thCls}>Teacher</th>
                      <th className={thCls}>Type</th>
                      <th className={thCls}>Dates</th>
                      <th className={thCls}>Status</th>
                      <th className={thCls}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activityLoading ? <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400"><RefreshCw size={16} className="mr-2 inline animate-spin text-yellow-600" />Loading leave requests…</td></tr> : leavesPager.rows.map((r) => {
                      const status = normalizedStatus(r.status);
                      const isPending = !['approved', 'accepted', 'rejected'].includes(status);
                      return (
                        <tr key={r.id} className="transition-colors hover:bg-gray-50/70">
                          <td className="px-4 py-2.5"><PersonCell name={r.teacherName} /></td>
                          <td className={tdCls}><span className="inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{r.type}</span></td>
                          <td className={tdCls}>{formatLeaveDateRange(r.startDate, r.endDate)}</td>
                          <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                          <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => openLeaveLetter(r)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50" title="View leave letter"><Eye size={13} /> View</button>
                            {isPending ? (
                              <>
                                <button type="button" onClick={() => reviewLeaveRequest(r.id, 'Approved')} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700" title="Approve"><CheckCircle size={13} /> Approve</button>
                                <button type="button" onClick={() => reviewLeaveRequest(r.id, 'Rejected')} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50" title="Reject"><XCircle size={13} /> Reject</button>
                              </>
                            ) : (
                              <button type="button" onClick={() => reviewLeaveRequest(r.id, status === 'rejected' ? 'Approved' : 'Rejected')} className="text-xs font-medium text-gray-400 underline-offset-2 hover:text-gray-700 hover:underline" title="Change decision">
                                {status === 'rejected' ? 'Approve instead' : 'Reject instead'}
                              </button>
                            )}
                          </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!activityLoading && filteredLeaves.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">No leave requests found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {!activityLoading && <TablePagination pager={leavesPager} label="requests" />}
            </div>
          </div>
        )}

        {showLeaveLetterModal && selectedLeaveRequest && (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
              <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-yellow-50 to-white">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-700">Leave application</p>
                  <h3 className="mt-1 text-lg font-bold text-gray-900">{selectedLeaveRequest.teacherName || 'Teacher'}</h3>
                  <p className="text-sm text-gray-500">
                    {selectedLeaveRequest.type || 'Leave request'} · {formatLeaveDateRange(selectedLeaveRequest.startDate, selectedLeaveRequest.endDate)}
                  </p>
                </div>
                <button
                  onClick={closeLeaveLetter}
                  className="p-2 rounded-lg hover:bg-black/5 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label="Close leave letter"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 sm:p-8 bg-[#fcfaf4] overflow-y-auto">
                <div className="mx-auto max-w-2xl bg-white border border-amber-100 rounded-2xl shadow-sm p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{schoolDisplayName} Administration</p>
                      <p className="text-sm text-gray-500">Human Resource Department</p>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <p>{formatLongDate(selectedLeaveRequest.createdAt)}</p>
                      <p className="mt-1">Status: <span className="font-medium text-gray-800">{selectedLeaveRequest.status || '-'}</span></p>
                    </div>
                  </div>

                  <div className="mt-8 space-y-5 text-sm text-gray-800 leading-7">
                    <p>
                      <span className="font-semibold">To,</span><br />
                      The HR/Admin<br />
                      {schoolDisplayName}
                    </p>

                    <p className="text-center">
                      <span className="font-semibold">Subject:</span> Application for {selectedLeaveRequest.type || 'leave'} {formatLeaveSubjectDate(selectedLeaveRequest.startDate, selectedLeaveRequest.endDate)}
                    </p>

                    <p>Dear Sir/Madam,</p>

                    <p>
                      I respectfully request leave for the period mentioned above. The reason provided by me is shown below.
                    </p>

                    {/* <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">Reason / Letter body</p> */}
                      <p className="whitespace-pre-wrap text-gray-80 -mt-5">
                        {selectedLeaveRequest.reason?.trim() || 'No reason provided.'}
                      </p>
                    {/* </div> */}

                    {selectedLeaveRequest.adminNote ? (
                      <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">Admin note</p>
                        <p className="whitespace-pre-wrap text-gray-800">{selectedLeaveRequest.adminNote}</p>
                      </div>
                    ) : null}

                    <p>
                      I request you to kindly consider this leave application and grant approval.
                    </p>

                    <div className="">
                      <p>Regards,</p>
                      <p className="font-semibold text-gray-900">{selectedLeaveRequest.teacherName || 'Teacher'}</p>
                      <p className="text-sm text-gray-600">{selectedLeaveRequest.teacherPhone || 'Not provided'}</p>
                      <p className="text-sm text-gray-600">{selectedLeaveRequest.teacherEmail || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-end gap-2">
                {/* <button
                  onClick={handlePrintLeaveLetter}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  <FileText size={16} />
                  Print
                </button> */}
                <button
                  onClick={closeLeaveLetter}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Expenses */}
        {tab === 'expenses' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatChip icon={IndianRupee} label="Total claims" value={expenseSummary.total} sub={`₹${expenseSummary.totalAmount.toLocaleString('en-IN')}`} tone="purple" />
              <StatChip icon={Clock} label="Pending" value={expenseSummary.pending} sub={`₹${expenseSummary.pendingAmount.toLocaleString('en-IN')}`} tone="amber" />
              <StatChip icon={CheckCircle} label="Approved" value={expenseSummary.approved} sub={`₹${expenseSummary.approvedAmount.toLocaleString('en-IN')}`} tone="green" />
              <StatChip icon={XCircle} label="Rejected" value={expenseSummary.rejected} tone="red" />
            </div>

            {activityError && (
              <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertCircle size={18} className="shrink-0 text-red-500" />
                <span className="text-sm text-red-700">{activityError}</span>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">

            <div className="flex flex-col gap-2 rounded-t-xl border-b border-gray-100 p-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, category or description..."
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  className={`w-full pl-9 ${toolbarInput}`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="month" value={teacherActivityMonth} onChange={(e) => setTeacherActivityMonth(e.target.value)} className={toolbarInput} aria-label="Month" />
                <select value={expenseTeacherFilter} onChange={(e) => setExpenseTeacherFilter(e.target.value)} className={toolbarInput}>
                  <option value="all">All teachers</option>
                  {expenseTeacherOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select value={expenseStatusFilter} onChange={(e) => setExpenseStatusFilter(e.target.value)} className={toolbarInput}>
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select value={expenseCategoryFilter} onChange={(e) => setExpenseCategoryFilter(e.target.value)} className={toolbarInput}>
                  <option value="all">All categories</option>
                  {expenseCategoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {(countActiveFilters([expenseTeacherFilter, expenseStatusFilter, expenseCategoryFilter]) > 0 || expenseSearch) && (
                  <button type="button" onClick={() => { setExpenseTeacherFilter('all'); setExpenseStatusFilter('all'); setExpenseCategoryFilter('all'); setExpenseSearch(''); }} className="px-2 text-sm font-medium text-gray-500 hover:text-gray-800">Reset</button>
                )}
                <button type="button" onClick={() => fetchTeacherActivities(teacherActivityMonth)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50" title="Refresh" aria-label="Refresh">
                  <RefreshCw size={15} className={activityLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={thCls}>Teacher</th>
                      <th className={thCls}>Category</th>
                      <th className={thCls}>Amount</th>
                      <th className={thCls}>Date</th>
                      <th className={thCls}>Description</th>
                      <th className={thCls}>Status</th>
                      <th className={thCls}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activityLoading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400"><RefreshCw size={16} className="mr-2 inline animate-spin text-yellow-600" />Loading expense claims…</td></tr> : expensesPager.rows.map((expense) => {
                      const status = normalizedStatus(expense.status);
                      const isPending = !['approved', 'accepted', 'rejected'].includes(status);
                      return (
                        <tr key={expense.id} className="transition-colors hover:bg-gray-50/70">
                          <td className="px-4 py-2.5"><PersonCell name={expense.teacherName} /></td>
                          <td className={tdCls}><span className="inline-flex rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">{expense.category}</span></td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">₹{Number(expense.amount || 0).toLocaleString('en-IN')}</td>
                          <td className={tdCls}>{formatLongDate(expense.date) || expense.date}</td>
                          <td className={`${tdCls} max-w-[220px] truncate`} title={expense.description || ''}>{expense.description || '—'}</td>
                          <td className="px-4 py-2.5"><StatusBadge status={expense.status} /></td>
                          <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">

                            {isPending ? (
                              <>
                                <button type="button" onClick={() => reviewExpenseClaim(expense.id, 'Approved')} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700" title="Approve"><CheckCircle size={13} /> Approve</button>
                                <button type="button" onClick={() => reviewExpenseClaim(expense.id, 'Rejected')} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50" title="Reject"><XCircle size={13} /> Reject</button>
                              </>
                            ) : (
                              <button type="button" onClick={() => reviewExpenseClaim(expense.id, status === 'rejected' ? 'Approved' : 'Rejected')} className="text-xs font-medium text-gray-400 underline-offset-2 hover:text-gray-700 hover:underline" title="Change decision">
                                {status === 'rejected' ? 'Approve instead' : 'Reject instead'}
                              </button>
                            )}
                          </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!activityLoading && filteredExpenses.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No expense claims found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {!activityLoading && (
                <TablePagination
                  pager={expensesPager}
                  label="claims"
                  extra={<span>Filtered total: <b className="text-gray-700">₹{filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0).toLocaleString('en-IN')}</b></span>}
                />
              )}
            </div>
          </div>
        )}

        {/* Recruitment */}
        {tab === 'recruitment' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Job Openings</h2>
              <ul className="divide-y divide-gray-200">
                {jobs.map(j => (
                  <li key={j.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{j.title}</div>
                      <div className="text-sm text-gray-600">Openings: {j.openings}</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">{j.status}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Candidates</h2>
              <ul className="divide-y divide-gray-200">
                {candidates.map(c => (
                  <li key={c.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{c.name}</div>
                      <div className="text-sm text-gray-600">For: {c.for}</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800">{c.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Policies */}
        {tab === 'policies' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2"><Building2 size={18} /> HR Policies</h2>
            <form onSubmit={uploadPolicy} className="flex items-center gap-2 mb-4">
              <input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Policy file name (e.g., Travel Policy.pdf)" className="flex-1 border border-gray-300 rounded-lg px-3 py-2" />
              <button type="submit" className="px-3 py-2 rounded bg-yellow-600 text-white hover:bg-yellow-700">Upload</button>
            </form>
            <ul className="divide-y divide-gray-200">
              {policies.map(p => (
                <li key={p.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{p.name}</div>
                    <div className="text-sm text-gray-600">Uploaded: {p.date}</div>
                  </div>
                  <button className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">View</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add New */}
        {tab === 'add-new' && (
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Add New Records</h2>
                <div className="bg-white rounded-lg border border-gray-200 p-1 flex">
                  <button className={`px-3 py-1 rounded-md text-sm font-medium ${addTab === 'teacher' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:text-gray-800'}`} onClick={() => setAddTab('teacher')}>Teacher</button>
                  <button className={`px-3 py-1 rounded-md text-sm font-medium ${addTab === 'student' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:text-gray-800'}`} onClick={() => setAddTab('student')}>Student</button>
                  <button className={`px-3 py-1 rounded-md text-sm font-medium ${addTab === 'staff' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:text-gray-800'}`} onClick={() => setAddTab('staff')}>Staff</button>
                </div>
              </div>

              {addTab === 'teacher' && (
                <form onSubmit={(e) => handleSubmit(e, 'Teacher')} className="space-y-6">
                  <Section title="Personal Information">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input name="firstName" label="First Name" required />
                      <Input name="lastName" label="Last Name" required />
                      <Select name="gender" label="Gender" defaultValue="">
                        <option value="" disabled>-- Select --</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </Select>
                      <Input name="dob" label="Date of Birth" type="date" />
                      <Input name="email" label="Email" type="email" />
                      <Input name="phone" label="Phone" type="tel" />
                      <Input name="address1" label="Address Line 1" className="md:col-span-2" />
                      <Input name="city" label="City" />
                      <Input name="state" label="State" />
                      <Input name="zip" label="ZIP/Postal Code" />
                      <FileInput name="photo" label="Photo" />
                    </div>
                  </Section>

                  <Section title="Employment Details">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input name="empId" label="Employee ID" />
                      <Input name="designation" label="Designation" />
                      <Input name="department" label="Department" />
                      <Input name="joiningDate" label="Date of Joining" type="date" />
                      <Input name="qualification" label="Highest Qualification" />
                      <Input name="experienceYears" label="Experience (years)" type="number" min="0" />
                      <Input name="salary" label="Salary (₹)" type="number" min="0" />
                      <Input name="bankAccount" label="Bank Account No." />
                      <Input name="ifsc" label="IFSC Code" />
                    </div>
                  </Section>

                  <Section title="Documents">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FileInput name="idProof" label="ID Proof (Aadhaar/Passport)" />
                      <FileInput name="addressProof" label="Address Proof" />
                      <FileInput name="pan" label="PAN Card" />
                      <FileInput name="cv" label="Resume/CV" />
                      <FileInput name="qualificationCerts" label="Qualification Certificates" multiple />
                      <FileInput name="experienceLetters" label="Experience Letters" multiple />
                    </div>
                    <TextArea name="notes" label="Notes" />
                  </Section>

                  <div className="flex justify-end gap-2">
                    <button type="reset" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Reset</button>
                    <button
                      type="button"
                      onClick={() => {
                        const form = document.querySelector('form');
                        const formData = new FormData(form);
                        const entries = {};

                        // Handle regular form fields
                        for (const [k, v] of formData.entries()) {
                          if (k !== 'photo') {
                            entries[k] = v;
                          }
                        }

                        // Handle photo file
                        const photoFile = formData.get('photo');
                        if (photoFile && photoFile.size > 0) {
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            entries.photo = e.target.result;
                            if (entries.firstName) generateIDCard(entries, 'teacher');
                          };
                          reader.readAsDataURL(photoFile);
                        } else {
                          if (entries.firstName) generateIDCard(entries, 'teacher');
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                    >
                      <CreditCard size={16} />
                      Generate ID Card
                    </button>
                    <button type="submit" className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white">Add Teacher</button>
                  </div>
                </form>
              )}

              {addTab === 'student' && (
                <form onSubmit={(e) => handleSubmit(e, 'Student')} className="space-y-6">
                  <Section title="Personal Information">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input name="firstName" label="First Name" required />
                      <Input name="lastName" label="Last Name" required />
                      <Select name="gender" label="Gender" defaultValue="">
                        <option value="" disabled>-- Select --</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </Select>
                      <Input name="dob" label="Date of Birth" type="date" />
                      <Input name="email" label="Email" type="email" />
                      <Input name="phone" label="Phone" type="tel" />
                      <Input name="address1" label="Address Line 1" className="md:col-span-2" />
                      <Input name="city" label="City" />
                      <Input name="state" label="State" />
                      <Input name="zip" label="ZIP/Postal Code" />
                      <FileInput name="photo" label="Photo" />
                    </div>
                  </Section>

                  <Section title="Academic Details">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input name="admissionNo" label="Admission No." />
                      <Select name="class" label="Class" defaultValue="">
                        <option value="" disabled>-- Select --</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={`Class ${n}`}>Class {n}</option>
                        ))}
                      </Select>
                      <Select name="section" label="Section" defaultValue="A">
                        {['A', 'B', 'C', 'D'].map(s => <option key={s}>{s}</option>)}
                      </Select>
                      <Input name="rollNo" label="Roll No." />
                      <Input name="admissionDate" label="Date of Admission" type="date" />
                      <Input name="guardianName" label="Guardian Name" />
                      <Input name="guardianRelation" label="Relation" />
                      <Input name="guardianPhone" label="Guardian Phone" type="tel" />
                      <Input name="guardianEmail" label="Guardian Email" type="email" />
                    </div>
                  </Section>

                  <Section title="Documents">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FileInput name="birthCert" label="Birth Certificate" />
                      <FileInput name="transferCert" label="Transfer Certificate" />
                      <FileInput name="aadhaar" label="Aadhaar" />
                      <FileInput name="addressProof" label="Address Proof" />
                      <FileInput name="photos" label="Recent Photos" multiple />
                    </div>
                  </Section>

                  <Section title="Health Record">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Select name="bloodGroup" label="Blood Group" defaultValue="">
                        <option value="" disabled>-- Select --</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => <option key={b}>{b}</option>)}
                      </Select>
                      <Input name="allergies" label="Allergies" />
                      <Input name="conditions" label="Medical Conditions" />
                      <Input name="emergencyName" label="Emergency Contact Name" />
                      <Input name="emergencyPhone" label="Emergency Contact Phone" type="tel" />
                      <FileInput name="vaccinationCard" label="Vaccination Card" />
                    </div>
                    <TextArea name="healthNotes" label="Health Notes" />
                  </Section>

                  <div className="flex justify-end gap-2">
                    <button type="reset" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Reset</button>
                    <button
                      type="button"
                      onClick={() => {
                        const form = document.querySelector('form');
                        const formData = new FormData(form);
                        const entries = {};

                        // Handle regular form fields
                        for (const [k, v] of formData.entries()) {
                          if (k !== 'photo') {
                            entries[k] = v;
                          }
                        }

                        // Handle photo file
                        const photoFile = formData.get('photo');
                        if (photoFile && photoFile.size > 0) {
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            entries.photo = e.target.result;
                            if (entries.firstName) generateIDCard(entries, 'student');
                          };
                          reader.readAsDataURL(photoFile);
                        } else {
                          if (entries.firstName) generateIDCard(entries, 'student');
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                    >
                      <CreditCard size={16} />
                      Generate ID Card
                    </button>
                    <button type="submit" className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white">Add Student</button>
                  </div>
                </form>
              )}

              {addTab === 'staff' && (
                <form onSubmit={(e) => handleSubmit(e, 'Staff')} className="space-y-6">
                  <Section title="Personal Information">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input name="firstName" label="First Name" required />
                      <Input name="lastName" label="Last Name" required />
                      <Select name="gender" label="Gender" defaultValue="">
                        <option value="" disabled>-- Select --</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </Select>
                      <Input name="dob" label="Date of Birth" type="date" />
                      <Input name="email" label="Email" type="email" />
                      <Input name="phone" label="Phone" type="tel" />
                      <Input name="address1" label="Address Line 1" className="md:col-span-2" />
                      <Input name="city" label="City" />
                      <Input name="state" label="State" />
                      <Input name="zip" label="ZIP/Postal Code" />
                      <FileInput name="photo" label="Photo" />
                    </div>
                  </Section>

                  <Section title="Employment Details">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input name="empId" label="Employee ID" />
                      <Input name="role" label="Role" />
                      <Input name="department" label="Department" />
                      <Input name="joiningDate" label="Date of Joining" type="date" />
                      <Input name="contractType" label="Contract Type" />
                      <Input name="salary" label="Salary (₹)" type="number" min="0" />
                      <Input name="bankAccount" label="Bank Account No." />
                      <Input name="ifsc" label="IFSC Code" />
                    </div>
                  </Section>

                  <Section title="Documents">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FileInput name="idProof" label="ID Proof" />
                      <FileInput name="addressProof" label="Address Proof" />
                      <FileInput name="policeVerification" label="Police Verification" />
                      <FileInput name="resume" label="Resume/CV" />
                      <FileInput name="otherDocs" label="Other Documents" multiple />
                    </div>
                    <TextArea name="notes" label="Notes" />
                  </Section>

                  <div className="flex justify-end gap-2">
                    <button type="reset" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Reset</button>
                    <button
                      type="button"
                      onClick={() => {
                        const form = document.querySelector('form');
                        const formData = new FormData(form);
                        const entries = {};

                        // Handle regular form fields
                        for (const [k, v] of formData.entries()) {
                          if (k !== 'photo') {
                            entries[k] = v;
                          }
                        }

                        // Handle photo file
                        const photoFile = formData.get('photo');
                        if (photoFile && photoFile.size > 0) {
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            entries.photo = e.target.result;
                            if (entries.firstName) generateIDCard(entries, 'staff');
                          };
                          reader.readAsDataURL(photoFile);
                        } else {
                          if (entries.firstName) generateIDCard(entries, 'staff');
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                    >
                      <CreditCard size={16} />
                      Generate ID Card
                    </button>
                    <button type="submit" className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white">Add Staff</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ID Card Modal */}
        {showIDCard && idCardData && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            {/* Printing the current page (instead of a blank popup) means every
                stylesheet is already loaded correctly — this just hides
                everything except the card while a print is in progress. */}
            <style>{`
              @media print {
                body * { visibility: hidden; }
                #id-card-print-section, #id-card-print-section * { visibility: visible; }
                #id-card-print-section {
                  position: fixed;
                  inset: 0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }
              }
            `}</style>
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-6 max-w-lg w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">🎓 ID Card Generated Successfully!</h3>
                <button
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                  onClick={() => setShowIDCard(false)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mb-6 flex justify-center">
                <div id="id-card-print-section">
                  <IDCard ref={idCardRef} person={idCardData} type={idCardType} />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-2">
                  <div className="text-blue-600 mt-0.5">ℹ️</div>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Your ID card is ready!</p>
                    <p>This design shows the actual appearance. You can download a PDF version or print directly.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowIDCard(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={printIDCard}
                  className="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <FileText size={16} />
                  Print Card
                </button>
                <button
                  onClick={downloadIDCardPDF}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <CreditCard size={16} />
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HR;
