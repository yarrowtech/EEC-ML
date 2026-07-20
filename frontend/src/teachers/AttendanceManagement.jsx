import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarCheck,
  CheckCheck,
  ClipboardCheck,
  BookOpen,
  Calculator,
  FlaskConical,
  Landmark,
  Languages,
  Leaf,
  MapPin,
  Printer,
  Search,
  School,
  Users,
  TrendingUp,
  BarChart3,
  Save,
  Loader2,
  Download,
  MoveRight,
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

const parseRollForSort = (roll) => {
  if (roll === null || roll === undefined) return Number.POSITIVE_INFINITY;
  const text = String(roll).trim();
  if (!text) return Number.POSITIVE_INFINITY;
  const direct = Number(text);
  if (Number.isFinite(direct)) return direct;
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
};

const AttendanceManagement = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
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
  const [sectionOptions, setSectionOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [lessonPlanContext, setLessonPlanContext] = useState(null);
  const [schoolMeta, setSchoolMeta] = useState({
    schoolName: 'School',
    schoolAddress: '',
    schoolLogo: '',
    campusName: '',
  });
  const [schoolLogoFailed, setSchoolLogoFailed] = useState(false);
  const hasRequiredHierarchyFilters = useMemo(
    () => Boolean(selectedSession && selectedClass && selectedSection),
    [selectedSession, selectedClass, selectedSection]
  );
  const todayDateString = useMemo(() => new Date(nowTick).toISOString().slice(0, 10), [nowTick]);
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

  const loadAttendance = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Login required');
      setLoading(false);
      return;
    }

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
      if (subject.trim()) query.set('subject', subject.trim());
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
      setSectionOptions(Array.isArray(data?.options?.sections) ? data.options.sections : []);
      setSubjectOptions(Array.isArray(data?.options?.subjects) ? data.options.subjects : []);
      setLessonPlanContext(data?.lessonPlanContext || null);

      const nextState = {};
      (hasRequiredHierarchyFilters ? sortedStudents : []).forEach((student) => {
        nextState[student._id] = student?.selectedDateRecord?.status || STATUS.ABSENT;
      });
      setAttendanceData(nextState);
    } catch (err) {
      setError(err.message || 'Unable to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedDate, selectedSession, selectedClass, selectedSection, subject, isSubstituteMode, searchTerm, hasRequiredHierarchyFilters]);

  useEffect(() => {
    if (!selectedSession && sessionOptions.length > 0) {
      setSelectedSession(sessionOptions[0]);
    }
  }, [selectedSession, sessionOptions]);

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
        subject: subject.trim(),
        substitute: isSubstituteMode,
        session: selectedSession,
        className: selectedClass,
        section: selectedSection,
        entries: students.map((student) => ({
          studentId: student._id,
          status: attendanceData[student._id] || STATUS.ABSENT,
          subject: subject.trim(),
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

  const inputClass = 'w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors';
  const canShowSchoolLogo = Boolean(schoolMeta.schoolLogo && !schoolLogoFailed);

  const subjectTabs = subjectOptions.length > 0
    ? subjectOptions
    : ['Math', 'Science', 'History', 'English', 'EVS'];
  const subjectIcons = [Calculator, FlaskConical, Landmark, Languages, Leaf];
  const classLabel = selectedClass || '5';
  const sectionLabel = selectedSection || 'A';
  const sessionLabel = selectedSession || '2025–2026';
  const updatedTime = new Date(nowTick).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <Motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1100px] rounded-[2rem] border border-[#e2e8ee] bg-white p-5 text-black shadow-[0_4px_20px_rgba(0,20,30,0.05)] transition-shadow hover:shadow-[0_8px_32px_rgba(0,20,30,0.07)] sm:p-8"
    >
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Motion.div
            initial={{ scale: 0.8, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 18 }}
            className="flex size-11 items-center justify-center rounded-[14px] border border-[#e2e8ee] bg-[#f0f4f8]"
          >
            <ClipboardCheck className="size-5" />
          </Motion.div>
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] sm:text-[1.4rem]">Mark Attendance</h1>
            <p className="mt-0.5 text-xs text-black/60">Class {classLabel} · Section {sectionLabel} · Session {sessionLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSelectedDate(todayDateString)} className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8ee] bg-transparent px-4 py-2 text-xs font-medium transition hover:bg-[#f4f7fa]">
            <Calendar className="size-3.5 opacity-50" /> Today
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8ee] bg-[#f0f4f8] px-4 py-2 text-xs font-semibold transition hover:bg-[#e8eef4]">
            <Printer className="size-3.5 opacity-50" /> Print
          </button>
        </div>
      </header>

      <Motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e2e8ee] bg-[#fafbfc] px-4 py-3"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e2e8ee] bg-white">
            {canShowSchoolLogo ? (
              <img src={schoolMeta.schoolLogo} alt={schoolMeta.schoolName || 'School'} className="size-full object-cover" onError={() => setSchoolLogoFailed(true)} />
            ) : (
              <School className="size-4 opacity-45" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{schoolMeta.schoolName || 'School'}</p>
            <p className="truncate text-[11px] text-black/60">
              {schoolMeta.schoolAddress ? <><MapPin className="mr-1 inline size-3 opacity-50" />{schoolMeta.schoolAddress}</> : 'Teacher attendance workspace'}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e2e8ee] bg-[#f0f4f8] px-3 py-1.5 text-xs font-medium">
          <CalendarCheck className="size-3.5 opacity-50" /> {sessionLabel} · Class {classLabel} · Sec {sectionLabel}
        </span>
      </Motion.section>

      <div className="mb-5 grid grid-cols-1 gap-2 rounded-2xl border border-[#e2e8ee] bg-[#fafbfc] p-3 sm:grid-cols-2 lg:grid-cols-5">
        <select value={selectedSession} onChange={(e) => { setSelectedSession(e.target.value); setSelectedClass(''); setSelectedSection(''); }} className={inputClass} aria-label="Session">
          <option value="">Select Session</option>
          {sessionOptions.map((session) => <option key={session} value={session}>{session}</option>)}
        </select>
        <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection(''); }} className={inputClass} aria-label="Class">
          <option value="">Select Class</option>
          {classOptions.map((className) => <option key={className} value={className}>{className}</option>)}
        </select>
        <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} className={inputClass} aria-label="Section">
          <option value="">Select Section</option>
          {sectionOptions.map((section) => <option key={section} value={section}>{section}</option>)}
        </select>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 opacity-45" />
          <input type="date" value={selectedDate} min={todayDateString} max={todayDateString} disabled className={`${inputClass} pl-9`} aria-label="Attendance date" />
        </div>
        <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={inputClass} aria-label="Attendance month" />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => setSubject('')} className={`rounded-full border px-4 py-2 text-xs font-medium transition ${!subject ? 'border-[#b8c4d0] bg-[#e8eef4] font-semibold shadow-sm' : 'border-[#e2e8ee] bg-[#f4f7fa] hover:bg-[#eef2f6]'}`}>
          <BookOpen className="mr-1.5 inline size-3.5 opacity-45" /> All Subjects
        </button>
        {subjectTabs.map((tab, index) => {
          const Icon = subjectIcons[index % subjectIcons.length];
          return (
            <button key={tab} type="button" onClick={() => setSubject(tab)} className={`rounded-full border px-4 py-2 text-xs font-medium transition ${subject === tab ? 'border-[#b8c4d0] bg-[#e8eef4] font-semibold shadow-sm' : 'border-[#e2e8ee] bg-[#f4f7fa] hover:bg-[#eef2f6]'}`}>
              <Icon className="mr-1.5 inline size-3.5 opacity-45" /> {tab}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-medium text-black/70"><CheckCheck className="mr-1 inline size-3.5 opacity-45" />Mark Attendance</span>
          <button type="button" onClick={() => markAllAttendance(STATUS.PRESENT)} disabled={areAllMarkedPresent || isAttendanceLocked} className="inline-flex items-center gap-1.5 rounded-full border border-[#d0d8e0] bg-[#f0f4f8] px-3.5 py-1.5 text-xs font-medium transition hover:bg-[#e8eef4] disabled:cursor-not-allowed disabled:opacity-50"><CheckCheck className="size-3.5 opacity-50" /> Check All</button>
          <button type="button" onClick={() => markAllAttendance(STATUS.ABSENT)} disabled={areAllMarkedAbsent || isAttendanceLocked} className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8ee] bg-white px-3.5 py-1.5 text-xs font-medium transition hover:bg-[#f4f7fa] disabled:cursor-not-allowed disabled:opacity-50"><span className="text-sm leading-none opacity-50">×</span> Uncheck All</button>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-black/60"><input type="checkbox" checked={isSubstituteMode} onChange={(e) => setIsSubstituteMode(e.target.checked)} className="size-3.5 accent-black" /> Substitute attendance</label>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 opacity-40" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search student..." className="w-40 rounded-full border border-[#e2e8ee] bg-white py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-[#b8c4d0] sm:w-48" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8ee] bg-[#f0f4f8] px-3.5 py-1.5 text-xs font-medium"><Users className="size-3.5 opacity-50" /> {students.length} students</span>
        </div>
      </div>

      <Motion.div layout className="mb-5 overflow-hidden rounded-2xl border border-[#e2e8ee] bg-[#fafbfc]">
        <div className="overflow-x-auto">
          {!hasRequiredHierarchyFilters ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-5 text-center">
              <Search className="mb-3 size-8 opacity-30" />
              <p className="text-sm font-medium text-black/70">Select Class and Section to view students</p>
              <p className="mt-1 text-xs text-black/45">Flow: Session → Class → Section</p>
            </div>
          ) : loading ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 text-sm text-black/50"><Loader2 className="size-6 animate-spin opacity-60" /> Loading students...</div>
          ) : students.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center"><Users className="mb-3 size-8 opacity-30" /><p className="text-sm font-medium text-black/60">No students found</p><p className="mt-1 text-xs text-black/40">Try adjusting your filters</p></div>
          ) : (
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead className="border-b border-[#e2e8ee] bg-[#f0f4f8]">
                <tr>
                  <th className="w-[90px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.04em] opacity-65">Roll No</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.04em] opacity-65">Name</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.04em] opacity-65">User ID</th>
                  <th className="w-[100px] px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.04em] opacity-65">Present</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {students.map((student, index) => {
                    const isPresent = (attendanceData[student._id] || STATUS.ABSENT) === STATUS.PRESENT;
                    return (
                      <Motion.tr key={student._id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.035 }} className="border-b border-[#e2e8ee] transition-colors last:border-0 hover:bg-[#f4f7fa]">
                        <td className="px-4 py-3"><span className="text-xs font-semibold opacity-60">{student.roll || '—'}</span></td>
                        <td className="px-4 py-3"><span className="text-sm font-medium">{student.name || '—'}</span></td>
                        <td className="px-4 py-3"><span className="text-xs font-mono opacity-50">{student.username || '—'}</span></td>
                        <td className="px-4 py-3">
                          <label className="flex cursor-pointer items-center justify-center gap-2">
                            <input type="checkbox" checked={isPresent} disabled={isAttendanceLocked} onChange={(e) => toggleStudentPresent(student._id, e.target.checked)} className="size-[18px] cursor-pointer appearance-none rounded-md border-2 border-[#c8d0d8] bg-white transition checked:border-black checked:bg-black disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Mark ${student.name || 'student'} present`} />
                            <span className="sr-only">{isPresent ? 'Present' : 'Absent'}</span>
                          </label>
                        </td>
                      </Motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </Motion.div>

      {(!isSubstituteMode && selectedClass && selectedSection && subject.trim()) && (
        <Motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-5 overflow-hidden rounded-2xl border border-[#e2e8ee] bg-[#fafbfc]">
          <div className="border-b border-[#e2e8ee] px-4 py-3"><h2 className="text-sm font-semibold">Lesson Plan for selected date</h2><p className="mt-0.5 text-[11px] text-black/50">{selectedDate} · {selectedClass} · {selectedSection} · {subject.trim()}</p></div>
          <div className="p-4">
            {!lessonPlanContext?.plans?.length ? <p className="text-xs text-black/50">No lesson plan found for this date/subject.</p> : <div className="space-y-2">{lessonPlanContext.plans.map((plan) => <div key={plan.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#e2e8ee] bg-white px-3 py-2.5"><div><p className="text-sm font-medium">{plan.title || 'Untitled Lesson Plan'}</p><p className="mt-1 text-[11px] text-black/50">{(plan.date || selectedDate || '').toString().slice(0, 10)} · {plan.subject || subject.trim()}</p></div><span className="rounded-full bg-[#f0f4f8] px-2.5 py-1 text-[10px] font-semibold">{plan.status === 'completed' ? 'Completed' : plan.status === 'in_progress' ? 'In Progress' : 'Pending'}</span></div>)}</div>}
          </div>
        </Motion.section>
      )}

      <footer className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3 text-xs text-black/60">
          <span><Users className="mr-1 inline size-3.5 opacity-50" /><strong className="text-black">{presentCount}</strong> present · <strong className="text-black">{absentCount}</strong> absent</span>
          <span className="opacity-45"><CalendarCheck className="mr-1 inline size-3.5" /> Last updated: today {updatedTime}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportToPDF} disabled={!hasRequiredHierarchyFilters || students.length === 0 || loading} className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8ee] bg-transparent px-4 py-2 text-xs font-medium transition hover:bg-[#f4f7fa] disabled:cursor-not-allowed disabled:opacity-50"><Download className="size-3.5 opacity-50" /> Export</button>
          <button type="button" onClick={saveAttendance} disabled={saving || loading || isAttendanceLocked || !hasRequiredHierarchyFilters || students.length === 0} className="inline-flex items-center gap-1.5 rounded-full border border-[#d0d8e0] bg-[#f0f4f8] px-5 py-2 text-xs font-semibold transition hover:bg-[#e8eef4] disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5 opacity-50" />} Save</button>
        </div>
      </footer>

      <AnimatePresence>
        {(error || success || isAttendanceLocked) && (
          <Motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-4 space-y-2">
            {error && <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
            {success && <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{success}</p>}
            {isAttendanceLocked && <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">{attendanceLockReason}</p>}
          </Motion.div>
        )}
      </AnimatePresence>
    </Motion.div>
  );
};

export default AttendanceManagement;
