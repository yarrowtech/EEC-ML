/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Calendar,
  CheckCheck,
  ClipboardCheck,
  BookOpen,
  MapPin,
  Printer,
  Search,
  X,
  School,
  Users,
  Save,
  Loader2,
  Download,
  ChevronDown,
  CalendarX2,
} from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const STATUS = Object.freeze({
  PRESENT: 'present',
  ABSENT: 'absent',
});
const ATTENDANCE_OPEN_HOUR = 8;
const ATTENDANCE_CLOSE_HOUR = 20;

const resolveLogoUrl = (logo) => {
  if (!logo) return '';
  if (typeof logo === 'string') return logo;
  if (typeof logo === 'object') return logo.secure_url || logo.url || logo.path || '';
  return '';
};

const toAbsoluteAssetUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  if (raw.startsWith('/')) return `${API_BASE}${raw}`;
  return `${API_BASE}/${raw.replace(/^\/+/, '')}`;
};

// `toISOString()` is UTC — for any timezone ahead of UTC (e.g. IST, UTC+5:30),
// the UTC date is still "yesterday" for the first few hours of the local day,
// which would mis-lock/mis-label attendance for that whole window. Build the
// date string from local Y/M/D instead.
const toLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toLocalMonthString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const escapePrintHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const parseRollForSort = (roll) => {
  if (roll === null || roll === undefined) return Number.POSITIVE_INFINITY;
  const text = String(roll).trim();
  if (!text) return Number.POSITIVE_INFINITY;
  const direct = Number(text);
  if (Number.isFinite(direct)) return direct;
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
};

// Shared field styling for the attendance filter row.
const selectCls = 'h-9 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-[13px] font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-600';
const FilterBox = ({ icon: Icon, tone, label, children }) => (
  <div className="flex min-w-0 flex-1 items-end gap-2">
    {Icon && <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="size-4.5" /></span>}
    <label className="min-w-0 flex-1">
      <span className="mb-1 block text-[11px] text-slate-500">{label}</span>
      <span className="relative block">
        {children}
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
      </span>
    </label>
  </div>
);


// Student profile photo when available, otherwise a coloured initial.
const StudentAvatar = ({ student, toneClass }) => {
  const [failed, setFailed] = useState(false);
  if (student?.profilePic && !failed) {
    return <img src={student.profilePic} alt="" loading="lazy" onError={() => setFailed(true)} className="size-7 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />;
  }
  return (
    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${toneClass}`}>
      {String(student?.name || 'S').charAt(0).toUpperCase()}
    </span>
  );
};

const AttendanceManagement = () => {
  const { className: contextClassName, sectionName: contextSectionName } = useOutletContext() || {};
  const [selectedDate, setSelectedDate] = useState(toLocalDateString(new Date()));
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [selectedMonth, setSelectedMonth] = useState(toLocalMonthString(new Date()));
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [subject, setSubject] = useState('');
  const [isSubstituteMode, setIsSubstituteMode] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [students, setStudents] = useState([]);
  const [sessionOptions, setSessionOptions] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [sectionOptions, setSectionOptionsList] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  // School's attendance format (set by admin): 'subject_wise' | 'day_wise'
  const [attendanceMode, setAttendanceMode] = useState('subject_wise');
  const isDayWise = attendanceMode === 'day_wise';
  const [attendanceData, setAttendanceData] = useState({});
  const [lessonPlanContext, setLessonPlanContext] = useState(null);
  // Desktop: the page fills the screen exactly (no page scroll); the student
  // list and the left panel scroll inside themselves.
  const [searchOpen, setSearchOpen] = useState(false);
  const pageRef = useRef(null);
  const [pageHeight, setPageHeight] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = pageRef.current;
      if (!el || window.innerWidth < 1024) { setPageHeight(null); return; }
      const top = el.getBoundingClientRect().top;
      setPageHeight(Math.max(440, window.innerHeight - top - 32));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const [schoolMeta, setSchoolMeta] = useState({
    schoolName: 'School',
    schoolAddress: '',
    schoolLogo: '',
    campusName: '',
  });
  const [schoolLogoFailed, setSchoolLogoFailed] = useState(false);
  // Teacher's weekly routine ({ Monday: [...periods], ... }); null until loaded
  // (or if it couldn't be loaded — then attendance is never blocked by it).
  const [routineSchedule, setRoutineSchedule] = useState(null);
  const hasRequiredHierarchyFilters = useMemo(
    () => Boolean(selectedSession && selectedClass && selectedSection),
    [selectedSession, selectedClass, selectedSection]
  );
  const todayDateString = useMemo(() => toLocalDateString(new Date(nowTick)), [nowTick]);
  const attendanceLockReason = useMemo(() => {
    const now = new Date(nowTick);
    const selected = new Date(`${selectedDate}T00:00:00`);
    const isToday = (
      selected.getFullYear() === now.getFullYear()
      && selected.getMonth() === now.getMonth()
      && selected.getDate() === now.getDate()
    );
    if (!isToday) return 'Attendance can only be marked for today.';
    const minutes = (now.getHours() * 60) + now.getMinutes();
    if (minutes < (ATTENDANCE_OPEN_HOUR * 60) || minutes >= (ATTENDANCE_CLOSE_HOUR * 60)) {
      return 'Attendance can be marked only between 8:00 AM and 8:00 PM.';
    }
    return '';
  }, [nowTick, selectedDate]);
  const isAttendanceLocked = Boolean(attendanceLockReason);

  // Rapid class/section switching fires a new fetch before the previous one
  // resolves. Without this guard, a stale response for the OLD class could
  // land after the new class's response and overwrite `students`/
  // `attendanceData` with the old roster — while `selectedClass`/
  // `selectedSection` already reflect the new class, so `saveAttendance`
  // would submit the old class's students under the new class's label.
  const loadRequestIdRef = useRef(0);

  const loadAttendance = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Login required');
      setLoading(false);
      return;
    }

    const requestId = ++loadRequestIdRef.current;
    const isStale = () => loadRequestIdRef.current !== requestId;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const query = new URLSearchParams({
        month: selectedMonth,
        date: selectedDate,
      });
      if (selectedSession) query.set('session', selectedSession);
      if (selectedClass) query.set('className', selectedClass);
      if (selectedSection) query.set('section', selectedSection);
      if (subject.trim() && !isDayWise) query.set('subject', subject.trim());
      if (isSubstituteMode) query.set('substitute', 'true');
      if (searchTerm.trim()) query.set('search', searchTerm.trim());

      const res = await fetch(`${API_BASE}/api/attendance/teacher/students?${query.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load attendance');
      }
      if (isStale()) return;

      const nextStudents = Array.isArray(data.students) ? data.students : [];
      const sortedStudents = [...nextStudents].sort((a, b) => {
        const rollA = parseRollForSort(a?.roll);
        const rollB = parseRollForSort(b?.roll);
        if (rollA !== rollB) return rollA - rollB;
        return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { numeric: true });
      });
      if (hasRequiredHierarchyFilters) {
        setStudents(sortedStudents);
      } else {
        setStudents([]);
      }
      setSessionOptions(Array.isArray(data?.options?.sessions) ? data.options.sessions : []);
      setClassOptions(Array.isArray(data?.options?.classes) ? data.options.classes : []);
      setSectionOptionsList(Array.isArray(data?.options?.sections) ? data.options.sections : []);
      setSubjectOptions(Array.isArray(data?.options?.subjects) ? data.options.subjects : []);
      setAttendanceMode(data?.attendanceMode === 'day_wise' ? 'day_wise' : 'subject_wise');
      setLessonPlanContext(data?.lessonPlanContext || null);

      const nextState = {};
      (hasRequiredHierarchyFilters ? sortedStudents : []).forEach((student) => {
        nextState[student._id] = student?.selectedDateRecord?.status || STATUS.ABSENT;
      });
      setAttendanceData(nextState);
    } catch (err) {
      if (isStale()) return;
      setError(err.message || 'Unable to load attendance data');
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [selectedMonth, selectedDate, selectedSession, selectedClass, selectedSection, subject, isSubstituteMode, searchTerm, hasRequiredHierarchyFilters, isDayWise]);

  useEffect(() => {
    if (!selectedSession && sessionOptions.length > 0) {
      setSelectedSession(sessionOptions[0]);
    }
  }, [selectedSession, sessionOptions]);

  // Class/section come from the class the teacher already selected in the
  // class workspace (via route context) — no need to ask again here. Skipped
  // in substitute mode so picking a different class to cover isn't clobbered.
  useEffect(() => {
    if (!isSubstituteMode && contextClassName) setSelectedClass(contextClassName);
  }, [contextClassName, isSubstituteMode]);
  useEffect(() => {
    if (!isSubstituteMode && contextSectionName) setSelectedSection(contextSectionName);
  }, [contextSectionName, isSubstituteMode]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedDate !== todayDateString) {
      setSelectedDate(todayDateString);
    }
  }, [selectedDate, todayDateString]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    if (subject && !subjectOptions.includes(subject)) {
      setSubject('');
    }
  }, [subject, subjectOptions]);

  // Once the teacher's real allocated subjects load, default to the first
  // one instead of sitting on the generic "All Subjects" view.
  useEffect(() => {
    if (isDayWise) {
      if (subject) setSubject('');
      return;
    }
    if (!subject && subjectOptions.length > 0) {
      setSubject(subjectOptions[0]);
    }
  }, [subject, subjectOptions, isDayWise]);

  useEffect(() => {
    const loadSchoolMeta = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      const trySetMetaFromPayload = (payload) => {
        const source = payload?.teacher || payload?.profile || payload || {};
        const schoolName = source?.schoolName || source?.school?.name || '';
        const campusName = source?.campusName || source?.campus?.name || '';
        const schoolAddress = source?.schoolAddress || source?.school?.address || source?.campusAddress || source?.address || '';
        const schoolLogo = resolveLogoUrl(source?.schoolLogo) || resolveLogoUrl(source?.school?.logo) || '';
        if (!schoolName && !campusName && !schoolAddress && !schoolLogo) return false;
        setSchoolMeta({
          schoolName: schoolName || 'School',
          schoolAddress: schoolAddress || '',
          schoolLogo: toAbsoluteAssetUrl(schoolLogo) || '',
          campusName: campusName || '',
        });
        setSchoolLogoFailed(false);
        return true;
      };

      try {
        const routineRes = await fetch(`${API_BASE}/api/teacher/dashboard/routine`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (routineRes.ok) {
          const routineData = await routineRes.json().catch(() => ({}));
          if (routineData?.schedule && typeof routineData.schedule === 'object') {
            setRoutineSchedule(routineData.schedule);
          }
          if (trySetMetaFromPayload(routineData)) return;
        }
      } catch {
        // ignore and fallback
      }

      try {
        const dashboardRes = await fetch(`${API_BASE}/api/teacher/dashboard`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (dashboardRes.ok) {
          const dashboardData = await dashboardRes.json().catch(() => ({}));
          if (trySetMetaFromPayload(dashboardData)) return;
        }
      } catch {
        // ignore and fallback
      }

      try {
        const profileRes = await fetch(`${API_BASE}/api/teacher/auth/profile`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (profileRes.ok) {
          const profileData = await profileRes.json().catch(() => ({}));
          if (trySetMetaFromPayload(profileData)) return;
        }
      } catch {
        // ignore and fallback
      }

      try {
        const localUser = JSON.parse(localStorage.getItem('user') || '{}');
        trySetMetaFromPayload(localUser);
      } catch {
        // ignore local parsing issues
      }
    };

    loadSchoolMeta();
  }, []);

  const toggleStudentPresent = (studentId, checked) => {
    setAttendanceData((prev) => ({
      ...prev,
      [studentId]: checked ? STATUS.PRESENT : STATUS.ABSENT,
    }));
  };

  const markAllAttendance = useCallback((statusValue) => {
    const normalizedStatus = statusValue === STATUS.PRESENT ? STATUS.PRESENT : STATUS.ABSENT;
    setAttendanceData((prev) => {
      const next = { ...prev };
      students.forEach((student) => {
        next[student._id] = normalizedStatus;
      });
      return next;
    });
  }, [students]);

  const saveAttendance = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    if (isAttendanceLocked) {
      setError(attendanceLockReason);
      setSuccess('');
      toast.error(attendanceLockReason);
      return;
    }
    if (isSubstituteMode && (!selectedSession || !selectedClass || !selectedSection)) {
      const message = 'For substitute attendance, please select session, class and section first.';
      setError(message);
      setSuccess('');
      toast.error(message);
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        date: selectedDate,
        subject: isDayWise ? '' : subject.trim(),
        substitute: isSubstituteMode,
        session: selectedSession,
        className: selectedClass,
        section: selectedSection,
        entries: students.map((student) => ({
          studentId: student._id,
          status: attendanceData[student._id] || STATUS.ABSENT,
          subject: isDayWise ? '' : subject.trim(),
        })),
      };

      const res = await fetch(`${API_BASE}/api/attendance/teacher/bulk-upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to save attendance');
      }

      const matched = Number(data?.lessonPlansMatched || 0);
      const completed = Number(data?.lessonPlansCompleted || 0);
      const outcome = matched > 0
        ? `${completed} lesson plan${completed !== 1 ? 's' : ''} auto-marked completed`
        : 'No lesson plan matched for auto-completion';
      const substituteNote = isSubstituteMode ? ' Saved as substitute attendance (subject shown as General for students).' : '';
      setSuccess(`Saved (${data.created || 0} new, ${data.updated || 0} updated). ${outcome}.${substituteNote}`);
      toast.success('Attendance record updated successfully');
      await loadAttendance();
    } catch (err) {
      const message = err.message || 'Could not save attendance';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const exportToPDF = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.width;

    pdf.setFontSize(18);
    pdf.setFont(undefined, 'bold');
    pdf.text('Attendance Report', pageWidth / 2, 20, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Date: ${selectedDate}`, 14, 30);

    let y = 40;
    pdf.setFont(undefined, 'bold');
    pdf.text('Name', 14, y);
    pdf.text('Class', 74, y);
    pdf.text('Section', 104, y);
    pdf.text('Status', 134, y);

    pdf.setFont(undefined, 'normal');
    y += 8;
    students.forEach((student) => {
      pdf.text(String(student.name || ''), 14, y);
      pdf.text(String(student.className || student.grade || ''), 74, y);
      pdf.text(String(student.section || ''), 104, y);
      pdf.text(String(attendanceData[student._id] || STATUS.ABSENT).toUpperCase(), 134, y);
      y += 7;
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }
    });

    pdf.save(`attendance-${selectedDate}.pdf`);
  };

  const presentCount = useMemo(
    () => Object.values(attendanceData).filter((status) => status === STATUS.PRESENT).length,
    [attendanceData]
  );
  const absentCount = useMemo(
    () => Object.values(attendanceData).filter((status) => status === STATUS.ABSENT).length,
    [attendanceData]
  );
  const areAllMarkedPresent = useMemo(
    () => students.length > 0 && students.every((student) => (attendanceData[student._id] || STATUS.ABSENT) === STATUS.PRESENT),
    [students, attendanceData]
  );
  const areAllMarkedAbsent = useMemo(
    () => students.length > 0 && students.every((student) => (attendanceData[student._id] || STATUS.ABSENT) === STATUS.ABSENT),
    [students, attendanceData]
  );

  // Today's periods this teacher has with the selected class/section.
  const todaysPeriods = useMemo(() => {
    if (!routineSchedule) return null;
    const dayName = new Date(nowTick).toLocaleDateString('en-US', { weekday: 'long' });
    const norm = (v) => String(v || '').trim().toLowerCase();
    return (Array.isArray(routineSchedule[dayName]) ? routineSchedule[dayName] : []).filter((p) => (
      norm(p.className) === norm(selectedClass)
      && (!selectedSection || !p.sectionName || norm(p.sectionName) === norm(selectedSection))
    ));
  }, [routineSchedule, nowTick, selectedClass, selectedSection]);
  // Substitute teachers cover classes outside their routine, so never block them.
  const noClassToday = !isSubstituteMode && Array.isArray(todaysPeriods) && todaysPeriods.length === 0;

  const canShowSchoolLogo = Boolean(schoolMeta.schoolLogo && !schoolLogoFailed);

  const subjectTabs = subjectOptions.length > 0
    ? subjectOptions
    : ['Math', 'Science', 'History', 'English', 'EVS'];
  const classLabel = selectedClass || '5';
  const sectionLabel = selectedSection || 'A';
  const sessionLabel = selectedSession || '2025–2026';
  const updatedTime = new Date(nowTick).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const printAttendance = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=760');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print the attendance report');
      return;
    }

    printWindow.opener = null;
    const rows = students.map((student) => {
      const status = attendanceData[student._id] || STATUS.ABSENT;
      return `
        <tr>
          <td>${escapePrintHtml(student.roll || '—')}</td>
          <td>${escapePrintHtml(student.name || '—')}</td>
          <td>${escapePrintHtml(student.username || '—')}</td>
          <td class="status ${status === STATUS.PRESENT ? 'present' : 'absent'}">${escapePrintHtml(status.toUpperCase())}</td>
        </tr>`;
    }).join('');

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Attendance Report - ${escapePrintHtml(selectedDate)}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #172033; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
            .report { width: 100%; }
            .header { border-bottom: 2px solid #172033; padding-bottom: 12px; text-align: center; }
            h1 { margin: 0; font-size: 22px; }
            .school { margin-top: 5px; color: #475569; font-size: 13px; font-weight: 600; }
            .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 16px 0 12px; }
            .meta-item { border: 1px solid #d8dee8; border-radius: 8px; padding: 8px 10px; }
            .meta-label { display: block; margin-bottom: 3px; color: #64748b; font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
            .summary { display: flex; gap: 18px; margin-bottom: 12px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; }
            thead { display: table-header-group; }
            tr { break-inside: avoid; page-break-inside: avoid; }
            th, td { border: 1px solid #cbd5e1; padding: 7px 9px; text-align: left; }
            th { background: #eef2f6; font-size: 10px; letter-spacing: .04em; text-transform: uppercase; }
            th:first-child, td:first-child { width: 14%; }
            th:nth-child(3), td:nth-child(3) { width: 24%; }
            th:last-child, td:last-child { width: 16%; text-align: center; }
            .status { font-size: 10px; font-weight: 700; }
            .present { color: #047857; }
            .absent { color: #b91c1c; }
            .empty { padding: 30px; color: #64748b; text-align: center; }
            .signatures { display: flex; justify-content: space-between; gap: 60px; margin-top: 42px; }
            .signature { width: 200px; border-top: 1px solid #64748b; padding-top: 6px; text-align: center; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <main class="report">
            <div class="header">
              <h1>Attendance Report</h1>
              <div class="school">${escapePrintHtml(schoolMeta.schoolName || 'School')}</div>
            </div>
            <section class="meta">
              <div class="meta-item"><span class="meta-label">Date</span>${escapePrintHtml(selectedDate)}</div>
              <div class="meta-item"><span class="meta-label">Class</span>${escapePrintHtml(classLabel)}</div>
              <div class="meta-item"><span class="meta-label">Section</span>${escapePrintHtml(sectionLabel)}</div>
              <div class="meta-item"><span class="meta-label">Subject</span>${escapePrintHtml(subject.trim() || 'All Subjects')}</div>
            </section>
            <div class="summary">
              <span>Total: ${students.length}</span>
              <span>Present: ${presentCount}</span>
              <span>Absent: ${absentCount}</span>
              <span>Session: ${escapePrintHtml(sessionLabel)}</span>
            </div>
            <table>
              <thead><tr><th>Roll No</th><th>Student Name</th><th>User ID</th><th>Status</th></tr></thead>
              <tbody>${rows || '<tr><td class="empty" colspan="4">No students found.</td></tr>'}</tbody>
            </table>
            <div class="signatures">
              <div class="signature">Teacher Signature</div>
              <div class="signature">Authorized Signature</div>
            </div>
          </main>
        </body>
      </html>`);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  const selectedDateObj = new Date(`${selectedDate}T00:00:00`);
  const dateBig = Number.isNaN(selectedDateObj.getTime()) ? selectedDate : selectedDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const weekdayLabel = Number.isNaN(selectedDateObj.getTime()) ? '' : selectedDateObj.toLocaleDateString('en-GB', { weekday: 'long' });
  const monthChoices = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { key, label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) };
  });
  const AVATAR_TONES = ['bg-rose-100 text-rose-600', 'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700'];
  return (
    <Motion.div
      ref={pageRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={pageHeight ? { height: pageHeight } : undefined}
      className="mx-auto grid w-full min-w-0 max-w-[1240px] gap-3 lg:grid-cols-[320px_minmax(0,1fr)]"
    >
      {/* ── LEFT: school · date · subject · lesson plan ── */}
      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50">
            {canShowSchoolLogo ? (
              <img src={schoolMeta.schoolLogo} alt={schoolMeta.schoolName || 'School'} className="size-full object-cover" onError={() => setSchoolLogoFailed(true)} />
            ) : (
              <School className="size-5 text-blue-600" />
            )}
          </div>
          <p className="min-w-0 text-[13.5px] font-bold leading-tight text-slate-900">{schoolMeta.schoolName || 'School'}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-500 px-3 py-2 text-white shadow-sm">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold"><Calendar className="size-3.5" /> {dateBig} <span className="font-normal text-white/80">· {weekdayLabel}</span></p>
          <p className="mt-0.5 text-[10.5px] text-white/75">{sessionLabel} · Class {classLabel} · Sec {sectionLabel}{subject.trim() ? ` · ${subject.trim()}` : ''}</p>
        </div>

        {/* Subject comes from the class workspace; the pickers only appear when
            covering another class (substitute attendance). */}
        <div className="border-t border-slate-100 pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] leading-tight text-slate-600">
            <input type="checkbox" checked={isSubstituteMode} onChange={(e) => setIsSubstituteMode(e.target.checked)} className="size-4 accent-blue-600" />
            <span>Substitute attendance<br /><span className="text-slate-400">(covering another class)</span></span>
          </label>
          <AnimatePresence initial={false}>
            {isSubstituteMode && (
              <Motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="space-y-2.5 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                  <FilterBox label="Class">
                    <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection(''); }} className={selectCls} aria-label="Substitute class">
                      <option value="">Select class</option>
                      {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </FilterBox>
                  <FilterBox label="Section">
                    <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedClass} className={selectCls} aria-label="Substitute section">
                      <option value="">{selectedClass ? 'Select section' : 'Class first'}</option>
                      {sectionOptions.map((sec) => <option key={sec} value={sec}>{sec}</option>)}
                    </select>
                  </FilterBox>
                  </div>
                  {!isDayWise && (
                  <FilterBox label="Subject">
                    <select value={subject} onChange={(e) => setSubject(e.target.value)} className={selectCls} aria-label="Subject">
                      {subjectOptions.length === 0 && <option value="">All Subjects</option>}
                      {subjectTabs.map((tab) => <option key={tab} value={tab}>{tab}</option>)}
                    </select>
                  </FilterBox>
                  )}
                </div>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Lesson plan */}
        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-slate-800"><BookOpen className="size-4 text-blue-600" /> Lesson plan for today</p>
          {isSubstituteMode || isDayWise || !subject.trim() ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[12px] text-slate-500">{isSubstituteMode ? 'Lesson plans are not shown in substitute mode.' : isDayWise ? 'Your school takes attendance once a day, so it isn’t linked to a subject’s lesson plan.' : 'Pick a subject to see its lesson plan.'}</p>
          ) : !lessonPlanContext?.plans?.length ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[12px] text-slate-500">No lesson plan for this date/subject.</p>
          ) : (
            <div className="space-y-2">
              {lessonPlanContext.plans.map((plan) => (
                <div key={plan.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="truncate text-[12.5px] font-medium text-slate-900">{plan.title || 'Untitled Lesson Plan'}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-[10.5px] text-slate-500">{plan.date ? toLocalDateString(new Date(plan.date)) : selectedDate}</p>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${plan.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : plan.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {plan.status === 'completed' ? 'Completed' : plan.status === 'in_progress' ? 'In Progress' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── RIGHT: student list ── */}
      <section className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-semibold text-slate-900">Today&apos;s Attendance</h2>
              <p className="truncate text-[12px] text-slate-500">{isDayWise ? 'Day-wise attendance · once per day (first class)' : (subject.trim() || 'All subjects')}</p>
            </div>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            {/* Mark All · Uncheck All · 🔍 — the search field opens over the two buttons */}
            <AnimatePresence mode="wait" initial={false}>
              {searchOpen ? (
                <Motion.div
                  key="att-search"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 240, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="relative overflow-hidden"
                >
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    autoFocus
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); setSearchTerm(''); } }}
                    placeholder="Search student..."
                    className="h-9 w-[240px] rounded-full border border-slate-200 bg-white pl-9 pr-3 text-[13px] outline-none transition focus:border-blue-300"
                  />
                </Motion.div>
              ) : (
                <Motion.div
                  key="att-actions"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2"
                >
              <button type="button" onClick={() => markAllAttendance(STATUS.PRESENT)} disabled={areAllMarkedPresent || isAttendanceLocked} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                <CheckCheck className="size-4" /> Mark All
              </button>
              <button type="button" onClick={() => markAllAttendance(STATUS.ABSENT)} disabled={areAllMarkedAbsent || isAttendanceLocked} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                <span className="text-base leading-none">×</span> Uncheck All
              </button>
                </Motion.div>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={() => { if (searchOpen) { setSearchOpen(false); setSearchTerm(''); } else setSearchOpen(true); }}
              aria-label={searchOpen ? 'Close search' : 'Search students'}
              title={searchOpen ? 'Close search' : 'Search'}
              className={`flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border transition-colors ${searchOpen ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <Motion.span
                  key={searchOpen ? 'x' : 's'}
                  initial={{ rotate: -180, scale: 0.4, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  exit={{ rotate: 180, scale: 0.4, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex"
                >
                  {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
                </Motion.span>
              </AnimatePresence>
            </button>
            <button
              type="button"
              onClick={printAttendance}
              disabled={loading || !hasRequiredHierarchyFilters}
              aria-label="Print attendance"
              title="Print"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="size-4" />
            </button>
          </div>
        </div>

        <div className="min-h-[240px] min-w-0 flex-1 overflow-auto overscroll-contain rounded-xl border border-slate-100">
          {!hasRequiredHierarchyFilters ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-5 text-center">
              <Loader2 className="mb-3 size-7 animate-spin text-blue-400" />
              <p className="text-sm font-medium text-slate-700">Loading class roster…</p>
              <p className="mt-1 text-xs text-slate-400">Resolving class and section details</p>
            </div>
          ) : noClassToday ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-5 text-center">
              <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-500"><CalendarX2 className="size-6" /></span>
              <p className="text-sm font-semibold text-slate-700">No classes scheduled today</p>
              <p className="mt-1 max-w-sm text-xs text-slate-400">
                You don't have a period with Class {selectedClass}{selectedSection ? `-${selectedSection}` : ''} in today's routine, so there's no attendance to mark.
                Covering for another teacher? Turn on substitute mode.
              </p>
            </div>
          ) : loading ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="size-6 animate-spin text-blue-500" /> Loading students...</div>
          ) : students.length === 0 ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center"><Users className="mb-3 size-8 text-slate-300" /><p className="text-sm font-medium text-slate-600">No students found</p><p className="mt-1 text-xs text-slate-400">Try adjusting your filters</p></div>
          ) : (
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[12px] text-slate-600">
                <tr>
                  <th className="w-14 px-3 py-2 text-center font-medium">Roll</th>
                  <th className="px-3 py-2 font-medium">Student Name</th>
                  <th className="px-3 py-2 text-center font-medium">User ID</th>
                  <th className="px-3 py-2 text-center font-medium">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student, index) => {
                  const isPresent = (attendanceData[student._id] || STATUS.ABSENT) === STATUS.PRESENT;
                  return (
                    <tr key={student._id} className="text-slate-800 transition-colors hover:bg-slate-50/60">
                      <td className="px-3 py-1.5 text-center text-slate-600">{student.roll || '—'}</td>
                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-2.5">
                          <StudentAvatar student={student} toneClass={AVATAR_TONES[index % AVATAR_TONES.length]} />
                          <span className="truncate font-medium">{student.name || '—'}</span>
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono text-[11.5px] text-slate-500">{student.username || '—'}</td>
                      <td className="px-3 py-1.5 text-center">
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isPresent}
                            disabled={isAttendanceLocked}
                            onChange={(e) => toggleStudentPresent(student._id, e.target.checked)}
                            aria-label={`Mark ${student.name || 'student'} present`}
                            className="size-[18px] cursor-pointer rounded accent-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <AnimatePresence>
          {(error || success || isAttendanceLocked) && (
            <Motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-2 shrink-0 space-y-1.5">
              {error && <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600">{error}</p>}
              {success && <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">{success}</p>}
              {isAttendanceLocked && <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">{attendanceLockReason}</p>}
            </Motion.div>
          )}
        </AnimatePresence>

        <div className="mt-3 flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="leading-tight">
            <p className="text-[14px] font-bold text-slate-900">{presentCount} present · {absentCount} absent</p>
            <p className="text-[11.5px] text-slate-500">Last updated: today {updatedTime}</p>
          </div>
          <button type="button" onClick={saveAttendance} disabled={saving || loading || noClassToday || isAttendanceLocked || !hasRequiredHierarchyFilters || students.length === 0} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-600 px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </button>
        </div>
      </section>
    </Motion.div>
  );
};

export default AttendanceManagement;
