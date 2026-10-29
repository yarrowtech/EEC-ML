import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronDown,
  Clock,
  Coffee,
  Download,
  Filter,
  Layers,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  School,
  Search,
  Timer,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_LOOKUP = DAYS.reduce((acc, day) => {
  acc[day.toLowerCase()] = day;
  return acc;
}, {});

const to12Hour = (value) => {
  if (!value) return '';
  const [hh, mm] = String(value).split(':');
  const hours = Number(hh);
  if (Number.isNaN(hours)) return value;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${mm || '00'} ${suffix}`;
};

const formatSlot = (entry) => {
  if (entry.startTime && entry.endTime) {
    return `${to12Hour(entry.startTime)} - ${to12Hour(entry.endTime)}`;
  }
  if (entry.startTime) return to12Hour(entry.startTime);
  return entry.period ? `Period ${entry.period}` : 'TBD';
};

const normalizeDayLabel = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  return DAY_LOOKUP[normalized] || null;
};

const normalizeSchedule = (rawSchedule) => {
  const base = DAYS.reduce((acc, day) => {
    acc[day] = [];
    return acc;
  }, {});

  if (!rawSchedule || typeof rawSchedule !== 'object') {
    return base;
  }

  Object.entries(rawSchedule).forEach(([day, entries]) => {
    const dayKey = normalizeDayLabel(day);
    if (!dayKey) return;
    base[dayKey] = Array.isArray(entries) ? entries : [];
  });

  return base;
};

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [value];
};

// Used only for the informational "Class …" / "Section …" chips near the top
// of the page — display-only, not used to filter the schedule (see
// effectiveSchedule for why: the backend's `/routine` scope is exact and
// filtering it again here by fuzzy substring match on legacy profile fields
// was a source of real bugs, both hiding legitimate classes and pulling in
// unrelated ones).
const getCredentialDisplayValues = (teacherProfile, keys) =>
  Array.from(
    new Set(
      keys
        .flatMap((key) => toArray(teacherProfile?.[key]))
        .filter(Boolean)
        .map((value) => String(value).trim())
    )
  );

const toScopeLabel = (scope) => {
  if (scope === 'campus') return 'Campus matched';
  if (scope === 'school-fallback') return 'School fallback';
  if (scope === 'dashboard-fallback') return 'Dashboard fallback';
  return 'School matched';
};

const CLASS_COLORS = [
  { border: 'border-l-blue-500', bg: 'bg-blue-50/80', text: 'text-blue-600' },
  { border: 'border-l-violet-500', bg: 'bg-violet-50/80', text: 'text-violet-600' },
  { border: 'border-l-emerald-500', bg: 'bg-emerald-50/80', text: 'text-emerald-600' },
  { border: 'border-l-amber-500', bg: 'bg-amber-50/80', text: 'text-amber-600' },
  { border: 'border-l-rose-500', bg: 'bg-rose-50/80', text: 'text-rose-600' },
  { border: 'border-l-teal-500', bg: 'bg-teal-50/80', text: 'text-teal-600' },
];

const ClassRoutine = () => {
  const [schedule, setSchedule] = useState({});
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [routineMeta, setRoutineMeta] = useState({ campusScoped: true, timetableCount: 0, filterSource: 'campus', busiestDay: null });
  const [selectedDay, setSelectedDay] = useState(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [viewMode, setViewMode] = useState('weekly');
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openEntry, setOpenEntry] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnceRef = useRef(false);

  const loadRoutine = useCallback(async () => {
    try {
      if (loadedOnceRef.current) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');
      if (!token || (userType !== 'Teacher' && userType !== 'teacher')) {
        setError('Only teachers can view this routine.');
        return;
      }

      const routineResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/teacher/dashboard/routine`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (routineResponse.ok) {
        const data = await routineResponse.json().catch(() => ({}));
        setSchedule(normalizeSchedule(data.schedule));
        setRoutineMeta({
          campusScoped: Boolean(data?.meta?.campusScoped),
          timetableCount: Number(data?.meta?.timetableCount || 0),
          filterSource: data?.meta?.filterSource || (data?.meta?.campusScoped ? 'campus' : 'school'),
          busiestDay: data?.meta?.busiestDay || null,
        });
        if (data.teacher) {
          setTeacherProfile(data.teacher);
        }
      } else {
        const dashboardResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/teacher/dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!dashboardResponse.ok) {
          const data = await dashboardResponse.json().catch(() => ({}));
          throw new Error(data.error || 'Unable to load teacher routine.');
        }

        const dashboardData = await dashboardResponse.json().catch(() => ({}));
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const fallbackSchedule = normalizeSchedule({
          [today]: (dashboardData?.upcomingClasses || []).map((item, index) => ({
            subject: item.subject || 'Subject',
            className: item.class || '',
            sectionName: '',
            classLabel: item.class || '',
            room: item.room || 'TBA',
            startTime: item.time || '',
            endTime: '',
            period: index + 1,
          })),
        });
        setSchedule(fallbackSchedule);
        setRoutineMeta({
          campusScoped: true,
          timetableCount: Number((dashboardData?.upcomingClasses || []).length > 0 ? 1 : 0),
          filterSource: 'dashboard-fallback',
          busiestDay: null,
        });
        setTeacherProfile(dashboardData?.teacher || null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load routine');
    } finally {
      loadedOnceRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRoutine();
  }, [loadRoutine]);

  // These labels are informational only (the small "Class …" / "Section …"
  // chips near the top of the page) — they no longer feed into filtering the
  // schedule itself (see effectiveSchedule below).
  const teacherClassLabels = useMemo(
    () =>
      getCredentialDisplayValues(teacherProfile, [
        'className',
        'class',
        'grade',
        'standard',
        'assignedClass',
        'assignedClasses',
        'assignedClassLabels',
        'classes',
      ]),
    [teacherProfile]
  );

  const teacherSectionLabels = useMemo(
    () =>
      getCredentialDisplayValues(teacherProfile, [
        'sectionName',
        'section',
        'division',
        'assignedSection',
        'assignedSections',
        'sections',
      ]),
    [teacherProfile]
  );

  // `schedule` from `/api/teacher/dashboard/routine` is already scoped
  // exactly to timetable entries where `entries.teacherId === teacherId` —
  // that's the canonical, exact source of "classes this teacher teaches".
  // This used to be re-filtered here against the teacher's legacy profile
  // fields (className/grade/section on TeacherUser) via `matchesCredential`,
  // which matched with plain substring inclusion
  // (`entryValue.includes(credentialValue) || credentialValue.includes(entryValue)`)
  // — so a credential of "1" would also match classes "10", "11", "12", "21", etc.
  // That re-filtering could both wrongly drop legitimate other classes (when a
  // teacher's profile only listed their original homeroom class) and wrongly
  // pull in unrelated classes via substring overlap, corrupting every stat
  // derived from it (Busiest Day, Weekly Classes, Free Periods, …). The
  // backend scope needs no second-guessing here, so it's used directly.
  const effectiveSchedule = schedule;

  useEffect(() => {
    const firstAvailableDay = DAYS.find((day) => (effectiveSchedule[day] || []).length > 0);
    if (firstAvailableDay) {
      setSelectedDay(firstAvailableDay);
    }
  }, [effectiveSchedule]);

  const totalClasses = useMemo(
    () => DAYS.reduce((sum, day) => sum + ((effectiveSchedule[day] || []).length), 0),
    [effectiveSchedule]
  );
  const weeklySlots = useMemo(() => {
    const slotMap = new Map();
    DAYS.forEach((day) => {
      (effectiveSchedule[day] || []).forEach((entry, index) => {
        const slot = formatSlot(entry) || `Period ${entry.period || index + 1}`;
        const order = Number(entry.period || 999);
        if (!slotMap.has(slot)) {
          slotMap.set(slot, { slot, order });
        } else if (order < slotMap.get(slot).order) {
          slotMap.set(slot, { slot, order });
        }
      });
    });
    return Array.from(slotMap.values()).sort((a, b) =>
      a.order === b.order ? a.slot.localeCompare(b.slot) : a.order - b.order
    );
  }, [effectiveSchedule]);
  const weeklyMatrix = useMemo(() => {
    const matrix = {};
    DAYS.forEach((day) => {
      matrix[day] = {};
      (effectiveSchedule[day] || []).forEach((entry, index) => {
        const slot = formatSlot(entry) || `Period ${entry.period || index + 1}`;
        matrix[day][slot] = entry;
      });
    });
    return matrix;
  }, [effectiveSchedule]);
  const scheduleEntries = useMemo(() => DAYS.flatMap((day) =>
    (effectiveSchedule[day] || []).map((entry, index) => ({
      ...entry,
      day,
      index,
      slot: formatSlot(entry) || `Period ${entry.period || index + 1}`,
      subjectLabel: entry.subject || 'Subject',
      classDisplay: entry.classLabel || entry.className || entry.class || 'Class',
      roomDisplay: entry.room || 'TBA',
    }))
  ), [effectiveSchedule]);

  const uniqueSubjects = useMemo(() => Array.from(new Set(scheduleEntries.map((entry) => entry.subjectLabel).filter(Boolean))).sort(), [scheduleEntries]);
  const uniqueRooms = useMemo(() => Array.from(new Set(scheduleEntries.map((entry) => entry.roomDisplay).filter(Boolean))).sort(), [scheduleEntries]);
  const uniqueClasses = useMemo(() => Array.from(new Set(scheduleEntries.map((entry) => entry.classDisplay).filter(Boolean))).sort(), [scheduleEntries]);

  const matchesActiveFilters = useCallback((entry) => {
    const haystack = `${entry.subjectLabel || entry.subject || ''} ${entry.classDisplay || entry.className || ''} ${entry.roomDisplay || entry.room || ''}`.toLowerCase();
    const needle = searchTerm.trim().toLowerCase();
    return (!needle || haystack.includes(needle)) &&
      (subjectFilter === 'all' || (entry.subjectLabel || entry.subject) === subjectFilter) &&
      (roomFilter === 'all' || (entry.roomDisplay || entry.room || 'TBA') === roomFilter) &&
      (classFilter === 'all' || (entry.classDisplay || entry.classLabel || entry.className || 'Class') === classFilter);
  }, [classFilter, roomFilter, searchTerm, subjectFilter]);

  const visibleSchedule = useMemo(() => DAYS.reduce((acc, day) => {
    acc[day] = (effectiveSchedule[day] || []).map((entry, index) => ({
      ...entry,
      day,
      index,
      slot: formatSlot(entry) || `Period ${entry.period || index + 1}`,
      subjectLabel: entry.subject || 'Subject',
      classDisplay: entry.classLabel || entry.className || entry.class || 'Class',
      roomDisplay: entry.room || 'TBA',
    })).filter(matchesActiveFilters);
    return acc;
  }, {}), [effectiveSchedule, matchesActiveFilters]);

  const visibleWeeklyMatrix = useMemo(() => {
    const matrix = {};
    DAYS.forEach((day) => {
      matrix[day] = {};
      (visibleSchedule[day] || []).forEach((entry, index) => {
        const slot = formatSlot(entry) || `Period ${entry.period || index + 1}`;
        matrix[day][slot] = entry;
      });
    });
    return matrix;
  }, [visibleSchedule]);

  const visibleTodayClasses = visibleSchedule[selectedDay] || [];

  const timeToMinutes = useCallback((value) => {
    if (!value) return null;
    const raw = String(value).trim();
    const simple = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (simple) return Number(simple[1]) * 60 + Number(simple[2]);
    const twelve = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!twelve) return null;
    let hours = Number(twelve[1]);
    const minutes = Number(twelve[2]);
    const suffix = twelve[3].toUpperCase();
    if (suffix === 'PM' && hours !== 12) hours += 12;
    if (suffix === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }, []);

  const currentMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  const todayName = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const realTodayClasses = useMemo(() => effectiveSchedule[todayName] || [], [effectiveSchedule, todayName]);

  const nextClass = useMemo(() => {
    const todayCandidates = realTodayClasses
      .map((entry, index) => ({ ...entry, day: todayName, index, startMins: timeToMinutes(entry.startTime), endMins: timeToMinutes(entry.endTime) }))
      .filter((entry) => entry.startMins !== null && entry.endMins !== null && entry.endMins >= currentMinutes)
      .sort((a, b) => a.startMins - b.startMins);
    if (todayCandidates.length) return todayCandidates[0];
    const tomorrowIndex = (DAYS.indexOf(todayName) + 1) % DAYS.length;
    for (let offset = 0; offset < DAYS.length; offset += 1) {
      const day = DAYS[(tomorrowIndex + offset) % DAYS.length];
      const entries = (effectiveSchedule[day] || []).map((entry, index) => ({ ...entry, day, index, startMins: timeToMinutes(entry.startTime) })).sort((a, b) => (a.startMins || 9999) - (b.startMins || 9999));
      if (entries.length) return entries[0];
    }
    return null;
  }, [currentMinutes, effectiveSchedule, realTodayClasses, timeToMinutes, todayName]);

  const countdownLabel = useMemo(() => {
    if (!nextClass) return 'No upcoming class';
    if (nextClass.day !== todayName || nextClass.startMins === null) return `${nextClass.day} · ${formatSlot(nextClass)}`;
    if (nextClass.startMins <= currentMinutes && nextClass.endMins >= currentMinutes) return 'In progress now';
    const diff = nextClass.startMins - currentMinutes;
    if (diff <= 0) return 'Starting soon';
    if (diff < 60) return `Starts in ${diff} min`;
    return `Starts in ${Math.floor(diff / 60)}h ${diff % 60}m`;
  }, [currentMinutes, nextClass, todayName]);

  const totalTeachingMinutes = useMemo(() => scheduleEntries.reduce((sum, entry) => {
    const start = timeToMinutes(entry.startTime);
    const end = timeToMinutes(entry.endTime);
    return start !== null && end !== null && end > start ? sum + (end - start) : sum + 40;
  }, 0), [scheduleEntries, timeToMinutes]);

  // Always derive "busiest day" from the same effectiveSchedule the calendar
  // grid and every other stat card (Weekly Classes, Today's Classes, Free
  // Periods, Subjects) are computed from. This used to prefer the backend's
  // `routineMeta.busiestDay`, which is counted from the RAW, unfiltered
  // timetable query — before the teacher-credential filtering below narrows
  // it down to classes that actually match this teacher's own class/section.
  // Whenever those two counts diverged, the "Busiest Day" card showed a
  // day/count that didn't match what the grid on screen actually displayed.
  const busiestDay = useMemo(() => DAYS.reduce((best, day) => {
    const count = (effectiveSchedule[day] || []).length;
    return count > best.count ? { day, count } : best;
  }, { day: 'None', count: 0 }), [effectiveSchedule]);

  const subjectDistribution = useMemo(() => uniqueSubjects.map((subject) => ({
    subject,
    count: scheduleEntries.filter((entry) => entry.subjectLabel === subject).length,
  })).sort((a, b) => b.count - a.count), [scheduleEntries, uniqueSubjects]);

  const freePeriodCount = Math.max(0, weeklySlots.length * DAYS.length - totalClasses);
  const todayFreeSlots = Math.max(0, weeklySlots.length - realTodayClasses.length);
  const roomSwitches = useMemo(() => DAYS.reduce((sum, day) => {
    const rooms = (effectiveSchedule[day] || []).map((entry) => entry.room || 'TBA');
    return sum + rooms.slice(1).filter((room, index) => room !== rooms[index]).length;
  }, 0), [effectiveSchedule]);

  const longestStreak = useMemo(() => DAYS.reduce((max, day) => {
    let streak = 0;
    let best = 0;
    weeklySlots.forEach((slot) => {
      if (weeklyMatrix[day]?.[slot.slot]) {
        streak += 1;
        best = Math.max(best, streak);
      } else {
        streak = 0;
      }
    });
    return Math.max(max, best);
  }, 0), [weeklyMatrix, weeklySlots]);

  const clearFilters = () => {
    setSearchTerm('');
    setSubjectFilter('all');
    setRoomFilter('all');
    setClassFilter('all');
  };


  // Professional A4-landscape routine: letterhead, teacher details, weekly grid, legend, signatures.
  const downloadPDF = useCallback(() => {
    const generate = async () => {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const PW = 297, PH = 210, M = 12;
      const UW = PW - M * 2;
      const NAVY = [15, 27, 61], BLUE = [37, 99, 235], MUTED = [100, 116, 139], LINE = [214, 222, 233];
      const trunc = (str, n) => { const v = String(str || ''); return v.length > n ? `${v.slice(0, n - 1)}…` : v; };

      const schoolName = teacherProfile?.schoolName || teacherProfile?.campusName || 'School';
      const schoolAddress = teacherProfile?.schoolAddress || '';
      const teacherName = teacherProfile?.name || teacherProfile?.fullName || 'Teacher';
      const logoUrl = teacherProfile?.schoolLogo || '';

      let logo = null;
      if (logoUrl) {
        try {
          const blob = await (await fetch(logoUrl)).blob();
          logo = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch { /* letterhead without logo */ }
      }

      // Mon–Sat always; Sunday only when it has classes.
      const days = DAYS.filter((d, i) => i < 6 || (effectiveSchedule[d] || []).length > 0);
      const subjects = Array.from(new Set(DAYS.flatMap((d) => (effectiveSchedule[d] || []).map((e) => e.subject || 'Subject')))).sort();
      const PALETTE = [
        { fill: [220, 245, 230], bar: [22, 163, 74] },
        { fill: [219, 231, 254], bar: [37, 99, 235] },
        { fill: [236, 226, 254], bar: [147, 51, 234] },
        { fill: [253, 240, 210], bar: [245, 158, 11] },
        { fill: [253, 224, 224], bar: [239, 68, 68] },
        { fill: [213, 243, 241], bar: [20, 184, 166] },
        { fill: [252, 231, 243], bar: [236, 72, 153] },
      ];
      const toneOf = (subject) => PALETTE[Math.max(0, subjects.indexOf(subject || 'Subject')) % PALETTE.length];

      // ── Letterhead ──
      let y = M;
      const LOGO = 18;
      if (logo) {
        try { doc.addImage(logo, M, y, LOGO, LOGO); } catch { /* skip */ }
      }
      const textX = logo ? M + LOGO + 5 : M;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...NAVY);
      doc.text(trunc(schoolName, 60), textX, y + 7);
      if (schoolAddress) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
        doc.text(trunc(schoolAddress, 100), textX, y + 12.5);
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...BLUE);
      doc.text('TEACHER CLASS ROUTINE', PW - M, y + 7, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
      doc.text('Weekly timetable', PW - M, y + 12.5, { align: 'right' });
      y += LOGO + 3;
      doc.setDrawColor(...BLUE); doc.setLineWidth(0.8); doc.line(M, y, PW - M, y);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, y + 1.2, PW - M, y + 1.2);
      y += 5;

      // ── Teacher details strip ──
      const weeklyTotal = DAYS.reduce((n, d) => n + (effectiveSchedule[d] || []).length, 0);
      const details = [
        ['Teacher', teacherName],
        ['Subject', teacherProfile?.subject || subjects.join(', ') || '—'],
        ['Classes', `${weeklyTotal} class${weeklyTotal === 1 ? '' : 'es'} in the week`],
      ];
      const boxW = UW / details.length;
      doc.setFillColor(246, 248, 251); doc.setDrawColor(...LINE); doc.setLineWidth(0.25);
      doc.roundedRect(M, y, UW, 12, 1.5, 1.5, 'FD');
      details.forEach(([label, value], i) => {
        const x = M + i * boxW + 4;
        if (i) doc.line(M + i * boxW, y + 2, M + i * boxW, y + 10);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
        doc.text(label.toUpperCase(), x, y + 4.5);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
        doc.text(trunc(value, Math.floor(boxW / 2.1)), x, y + 9.5);
      });
      y += 16;

      // ── Grid ──
      const TIME_W = 34, HDR_H = 9;
      const COL_W = (UW - TIME_W) / days.length;
      const footerSpace = 20;
      const ROW_H = Math.max(14, Math.min(22, (PH - y - HDR_H - footerSpace) / Math.max(weeklySlots.length, 1)));
      const tableY = y;

      doc.setFillColor(...NAVY);
      doc.rect(M, y, UW, HDR_H, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
      doc.text('TIME', M + TIME_W / 2, y + 5.8, { align: 'center' });
      days.forEach((day, i) => doc.text(day.toUpperCase(), M + TIME_W + i * COL_W + COL_W / 2, y + 5.8, { align: 'center' }));
      y += HDR_H;

      weeklySlots.forEach(({ slot }, r) => {
        if (r % 2) { doc.setFillColor(250, 251, 253); doc.rect(M, y, UW, ROW_H, 'F'); }
        doc.setFillColor(241, 245, 249); doc.rect(M, y, TIME_W, ROW_H, 'F');
        const [from, to] = slot.split(' - ');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...NAVY);
        if (to) {
          doc.text(from, M + TIME_W / 2, y + ROW_H / 2 - 0.8, { align: 'center' });
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
          doc.text(`to ${to}`, M + TIME_W / 2, y + ROW_H / 2 + 3.2, { align: 'center' });
        } else {
          doc.text(slot, M + TIME_W / 2, y + ROW_H / 2 + 1, { align: 'center' });
        }

        days.forEach((day, i) => {
          const x = M + TIME_W + i * COL_W;
          const entry = weeklyMatrix[day]?.[slot];
          if (!entry) {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(203, 213, 225);
            doc.text('—', x + COL_W / 2, y + ROW_H / 2 + 1, { align: 'center' });
            return;
          }
          const tone = toneOf(entry.subject);
          doc.setFillColor(...tone.fill); doc.roundedRect(x + 1.2, y + 1.2, COL_W - 2.4, ROW_H - 2.4, 1.2, 1.2, 'F');
          doc.setFillColor(...tone.bar); doc.rect(x + 1.2, y + 1.2, 1.1, ROW_H - 2.4, 'F');
          const maxCh = Math.max(8, Math.floor(COL_W / 1.9));
          const cx = x + COL_W / 2;
          const cls = entry.classLabel || entry.className || '';
          const room = entry.roomNumber || (entry.room && entry.room !== 'TBA' ? entry.room : '');
          const venue = [entry.building, entry.floor, room ? `Room ${room}` : 'Room TBA'].filter(Boolean).join(' · ');
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
          const venueLines = doc.splitTextToSize(venue, COL_W - 5).slice(0, 2);
          const lineCount = 2 + venueLines.length;
          let ty = y + ROW_H / 2 - ((lineCount - 1) * 3.1) / 2 + 1;
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
          doc.text(trunc(entry.subject || 'Subject', maxCh), cx, ty, { align: 'center' });
          ty += 3.3;
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...tone.bar);
          doc.text(trunc(cls ? `Class ${cls}` : '', maxCh + 4), cx, ty, { align: 'center' });
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(71, 85, 105);
          venueLines.forEach((line) => { ty += 3; doc.text(line, cx, ty, { align: 'center' }); });
        });
        y += ROW_H;
      });

      // Grid lines
      doc.setDrawColor(...LINE); doc.setLineWidth(0.25);
      for (let ly = tableY + HDR_H; ly <= y + 0.01; ly += ROW_H) doc.line(M, ly, PW - M, ly);
      doc.line(M + TIME_W, tableY, M + TIME_W, y);
      for (let i = 1; i < days.length; i += 1) doc.line(M + TIME_W + i * COL_W, tableY + HDR_H, M + TIME_W + i * COL_W, y);
      doc.setDrawColor(...NAVY); doc.setLineWidth(0.4); doc.rect(M, tableY, UW, y - tableY);

      // ── Legend ──
      y += 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...NAVY);
      doc.text('Subjects:', M, y);
      let lx = M + 17;
      doc.setFont('helvetica', 'normal');
      subjects.forEach((subject) => {
        const tone = toneOf(subject);
        doc.setFillColor(...tone.bar); doc.circle(lx + 1.3, y - 1.1, 1.3, 'F');
        doc.setTextColor(71, 85, 105); doc.text(subject, lx + 4, y);
        lx += doc.getTextWidth(subject) + 11;
      });

      // ── Footer ──
      doc.setFont('helvetica', 'normal');

      const generated = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      doc.setDrawColor(...LINE); doc.line(M, PH - 8, PW - M, PH - 8);
      doc.setFontSize(7); doc.setTextColor(148, 163, 184);
      doc.text(`Generated on ${generated}`, M, PH - 4.5);
      doc.text(trunc(schoolName, 60), PW / 2, PH - 4.5, { align: 'center' });
      doc.text('Page 1 of 1', PW - M, PH - 4.5, { align: 'right' });

      doc.save(`class-routine-${teacherName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    };
    generate();
  }, [effectiveSchedule, weeklySlots, weeklyMatrix, teacherProfile, teacherClassLabels]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <div className="h-44 rounded-3xl bg-white/80 animate-pulse" />
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-28 rounded-2xl bg-white animate-pulse" />)}
          </div>
          <div className="h-96 rounded-3xl bg-white animate-pulse" />
        </div>
      </div>
    );
  }

  const teacherName = teacherProfile?.name || teacherProfile?.fullName || 'Teacher';
  const firstName = teacherName.split(' ')[0] || 'Teacher';
  const teachingHours = `${Math.floor(totalTeachingMinutes / 60)}h ${totalTeachingMinutes % 60}m`;
  const activeFilterCount = [subjectFilter, roomFilter, classFilter].filter((item) => item !== 'all').length + (searchTerm.trim() ? 1 : 0);

  const smartStats = [
    { label: 'Weekly Classes', value: totalClasses, insight: `${DAYS.filter((day) => (effectiveSchedule[day] || []).length > 0).length} active teaching days`, icon: Calendar, tone: 'from-blue-500 to-indigo-500' },
    { label: 'Today\'s Classes', value: realTodayClasses.length, insight: todayName, icon: Clock, tone: 'from-violet-500 to-fuchsia-500' },
    { label: 'Teaching Hours', value: teachingHours, insight: 'Estimated weekly contact time', icon: Timer, tone: 'from-emerald-500 to-teal-500' },
    { label: 'Free Periods', value: freePeriodCount, insight: `${todayFreeSlots} available today`, icon: Coffee, tone: 'from-amber-500 to-orange-500' },
    { label: 'Busiest Day', value: busiestDay.day.slice(0, 3), insight: `${busiestDay.count} scheduled classes`, icon: TrendingUp, tone: 'from-rose-500 to-pink-500' },
    { label: 'Subjects', value: uniqueSubjects.length, insight: `${subjectDistribution[0]?.subject || 'No subject'} leads workload`, icon: Layers, tone: 'from-cyan-500 to-sky-500' },
  ];

  // Fixed weekly routine: one colour per subject, shared by the cells and the legend.
  const SUBJECT_TONES = [
    { cell: 'bg-[#dcf5e6] border-l-[#16a34a]', dot: 'bg-[#16a34a]', text: 'text-[#15803d]' },
    { cell: 'bg-[#dbe7fe] border-l-[#2563eb]', dot: 'bg-[#2563eb]', text: 'text-[#1d4ed8]' },
    { cell: 'bg-[#ece2fe] border-l-[#9333ea]', dot: 'bg-[#9333ea]', text: 'text-[#7e22ce]' },
    { cell: 'bg-[#fdf0d2] border-l-[#f59e0b]', dot: 'bg-[#f59e0b]', text: 'text-[#b45309]' },
    { cell: 'bg-[#fde0e0] border-l-[#ef4444]', dot: 'bg-[#ef4444]', text: 'text-[#b91c1c]' },
    { cell: 'bg-[#d5f3f1] border-l-[#14b8a6]', dot: 'bg-[#14b8a6]', text: 'text-[#0f766e]' },
    { cell: 'bg-[#fce7f3] border-l-[#ec4899]', dot: 'bg-[#ec4899]', text: 'text-[#be185d]' },
  ];
  const DAY_TONES = ['#2563eb', '#9333ea', '#16a34a', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899'];
  const toneFor = (subject) => SUBJECT_TONES[Math.max(0, uniqueSubjects.indexOf(subject || 'Subject')) % SUBJECT_TONES.length];
  // Only today's remaining classes count as "next" — no class today means nothing to show.
  const todaysNext = nextClass && nextClass.day === todayName ? nextClass : null;

  return (
    <div className="min-h-screen bg-[#f6f8fb] p-3 sm:p-4">
      <div className="mx-auto max-w-[1400px] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[20px] font-bold leading-tight text-[#0f1b3d]">Teacher Timetable</h1>
            <p className="text-[12px] text-[#64748b]">Your class schedule for the week.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={loadRoutine} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8f0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#0f1b3d] shadow-sm transition hover:bg-slate-50 disabled:cursor-wait">
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-[#2563eb]' : 'text-[#475569]'} /> {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button type="button" onClick={downloadPDF} disabled={totalClasses === 0} className="inline-flex items-center gap-1.5 rounded-full bg-[#2563eb] px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)] transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50">
              <Download size={14} /> Download
            </button>
          </div>
        </div>

        {/* Greeting + today's next class */}
        <section className="flex flex-col gap-3 rounded-xl bg-linear-to-r from-[#2563eb] via-[#4f46e5] to-[#9333ea] p-3.5 text-white shadow-[0_8px_20px_rgba(79,70,229,0.25)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20"><Calendar size={20} /></span>
            <div>
              <h2 className="text-[16px] font-bold">Good day, {firstName}!</h2>
              <p className="text-[12px] text-white/85">
                {realTodayClasses.length
                  ? `You have ${realTodayClasses.length} class${realTodayClasses.length === 1 ? '' : 'es'} today.`
                  : 'You have no classes today. Enjoy your day!'}
              </p>
            </div>
          </div>
          <div className="w-full rounded-lg bg-white px-3.5 py-2 text-[#0f1b3d] md:w-[340px]">
            {todaysNext ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[#dbeafe] px-2 py-px text-[10px] font-semibold text-[#2563eb]">Next Class</span>
                  <span className="text-[11px] font-medium text-[#16a34a]">{countdownLabel}</span>
                </div>
                <p className="mt-1 text-[15px] font-bold">{todaysNext.subject || 'Subject'}</p>
                <p className="flex flex-wrap items-center gap-x-3 text-[12px] text-[#64748b]">
                  <span className="flex items-center gap-1"><Clock size={13} />{formatSlot(todaysNext)}</span>
                  <span className="flex items-center gap-1"><MapPin size={13} />{todaysNext.room ? `Room ${todaysNext.room}` : 'Room TBA'}{todaysNext.classLabel || todaysNext.className ? ` · ${todaysNext.classLabel || todaysNext.className}` : ''}</span>
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2 py-1">
                <Coffee size={16} className="text-[#f59e0b]" />
                <p className="text-[13px] font-medium">{realTodayClasses.length ? 'All classes for today are done.' : 'No class scheduled today.'}</p>
              </div>
            )}
          </div>
        </section>

        {/* Weekly timetable (fixed routine — weekdays only, no dates) */}
        <section className={`relative rounded-xl border border-[#e6ebf2] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-opacity duration-300 ${refreshing ? 'opacity-60' : 'opacity-100'}`}>
          {refreshing && <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-xl"><div className="h-full w-1/3 animate-[excuse-progress_1s_ease-in-out_infinite] bg-[#2563eb]" /></div>}
          <h2 className="mb-2 text-[15px] font-bold text-[#0f1b3d]">Weekly Timetable</h2>

          {error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>
          ) : totalClasses === 0 ? (
            <EmptyTimetable loadRoutine={loadRoutine} />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-[#e6ebf2]">
                <table className="w-full min-w-[820px] table-fixed border-collapse text-[12px]">
                  <thead>
                    <tr>
                      <th className="w-[175px] whitespace-nowrap border-b border-r border-[#eef2f7] bg-[#f8fafc] px-3 py-2 text-left font-semibold text-[#475569]">Time</th>
                      {DAYS.map((day, i) => {
                        const isToday = day === todayName;
                        return (
                          <th key={day} className="border-b border-r border-[#eef2f7] px-1.5 py-1.5 last:border-r-0" style={{ backgroundColor: isToday ? DAY_TONES[i] : `${DAY_TONES[i]}14` }}>
                            <span className={`text-[12px] font-bold ${isToday ? 'text-white' : ''}`} style={isToday ? undefined : { color: DAY_TONES[i] }}>{day.slice(0, 3)}</span>
                            {isToday && <span className="ml-1 rounded-full bg-white/25 px-1.5 text-[9px] font-semibold text-white">Today</span>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {weeklySlots.map(({ slot }) => (
                      <tr key={slot}>
                        <td className="border-b border-r border-[#eef2f7] bg-[#fbfcfe] px-3 py-1 font-medium text-[#0f1b3d]">
                          <span className="flex items-center gap-1.5 whitespace-nowrap"><Clock size={12} className="shrink-0 text-[#94a3b8]" />{slot}</span>
                        </td>
                        {DAYS.map((day) => {
                          const entry = weeklyMatrix[day]?.[slot];
                          const todayCol = day === todayName ? 'bg-[#f5f9ff]' : '';
                          if (!entry) return <td key={day} className={`border-b border-r border-[#eef2f7] text-center text-[#cbd5e1] last:border-r-0 ${todayCol}`}>–</td>;
                          const cls = entry.classLabel || entry.className || entry.class || '';
                          const tone = toneFor(entry.subject);
                          return (
                            <td key={day} className={`border-b border-r border-[#eef2f7] p-1 last:border-r-0 ${todayCol}`}>
                              <button type="button" onClick={() => setOpenEntry({ ...entry, day, slot })} title="View class details" className={`block w-full rounded-md border-l-[3px] px-2 py-1 text-left transition hover:shadow-md hover:brightness-95 ${tone.cell}`}>
                                <p className={`truncate font-bold ${tone.text}`}>{entry.subject || 'Subject'}</p>
                                <p className="truncate text-[11px] text-[#475569]">{[cls, entry.room ? `Rm ${entry.room}` : 'TBA'].filter(Boolean).join(' · ')}</p>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[#475569]">
                {uniqueSubjects.map((subject) => (
                  <span key={subject} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${toneFor(subject).dot}`} />{subject}</span>
                ))}
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#cbd5e1]" />Free Period</span>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Class details popup */}
      {openEntry && (() => {
        const tone = toneFor(openEntry.subject);
        const rows = [
          { icon: Calendar, label: 'Day', value: openEntry.day },
          { icon: Clock, label: 'Time', value: openEntry.slot },
          { icon: Users, label: 'Class', value: openEntry.classLabel || openEntry.className || '—' },
          { icon: School, label: 'Building', value: openEntry.building || '—' },
          { icon: Layers, label: 'Floor', value: openEntry.floor || '—' },
          { icon: MapPin, label: 'Room No.', value: openEntry.roomNumber || (openEntry.room && openEntry.room !== 'TBA' ? openEntry.room : '—') },
        ];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setOpenEntry(null)}>
            <Motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} role="dialog" aria-modal="true" className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className={`flex items-start justify-between gap-3 border-l-4 px-5 py-4 ${tone.cell}`}>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Class details</p>
                  <h3 className={`text-[18px] font-bold ${tone.text}`}>{openEntry.subject || 'Subject'}</h3>
                </div>
                <button type="button" onClick={() => setOpenEntry(null)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-[#475569] hover:bg-white/70"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 p-4">
                {rows.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2 rounded-xl border border-[#eef2f7] px-3 py-2">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${tone.dot}`}><Icon size={14} /></span>
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#64748b]">{label}</p>
                      <p className="whitespace-nowrap text-[13px] font-semibold text-[#0f1b3d]">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Motion.div>
          </div>
        );
      })()}
    </div>
  );
};

const HeroChip = ({ icon, label }) => (
  <Motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur">
    {React.createElement(icon, { size: 13 })}
    {label}
  </Motion.span>
);

const HeroMetric = ({ label, value, sub }) => (
  <Motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-200">{label}</p>
    <p className="mt-2 truncate text-lg font-semibold text-white">{value}</p>
    <p className="mt-1 truncate text-xs text-slate-300">{sub}</p>
  </Motion.div>
);

const ContextPill = ({ icon, label, tone }) => {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>
      {React.createElement(icon, { size: 12 })}
      {label}
    </span>
  );
};

const InsightCard = ({ stat, index }) => {
  const Icon = stat.icon;
  return (
    <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }} whileHover={{ y: -3, scale: 1.01 }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-lg hover:shadow-slate-200/70">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br ${stat.tone} text-white shadow-lg`}><Icon size={18} /></div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><TrendingUp size={11} />Live</span>
      </div>
      <p className="mt-4 text-2xl font-semibold text-slate-950">{stat.value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{stat.label}</p>
      <p className="mt-2 text-[11px] text-slate-400">{stat.insight}</p>
    </Motion.div>
  );
};

const FilterSelect = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100">
      <option value="all">All {label.toLowerCase()}s</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

const EmptyTimetable = ({ loadRoutine }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Calendar size={24} /></div>
    <p className="mt-4 text-sm font-semibold text-slate-700">No classes assigned yet</p>
    <p className="mt-1 text-xs text-slate-400">Check back later or contact administration.</p>
    <button onClick={loadRoutine} className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">Reload schedule</button>
  </div>
);

const WeeklyWorkspace = ({ weeklySlots, matrix, selectedDay, currentMinutes, timeToMinutes }) => (
  <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-slate-950">Weekly Workspace</h2>
        <p className="text-xs text-slate-500">Recurring teaching structure, free periods, and break opportunities.</p>
      </div>
      <MoreHorizontal size={18} className="text-slate-400" />
    </div>
    <div className="overflow-x-auto">
      <div className="min-w-[1040px]">
        <div className="grid grid-cols-[150px_repeat(7,minmax(128px,1fr))] border-b border-slate-100 bg-slate-50">
          <div className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Time</div>
          {DAYS.map((day) => <div key={day} className={`px-3 py-3 text-[11px] font-bold uppercase tracking-[0.14em] ${selectedDay === day ? 'text-indigo-600' : 'text-slate-400'}`}>{day.slice(0, 3)}</div>)}
        </div>
        {weeklySlots.map((slot, si) => {
          const breakInfo = getBreakAfter(weeklySlots, si);
          return (
            <React.Fragment key={slot.slot}>
              <div className="grid grid-cols-[150px_repeat(7,minmax(128px,1fr))] border-b border-slate-100">
                <div className="bg-slate-50/70 px-4 py-3 text-xs font-semibold text-slate-600">{slot.slot}</div>
                {DAYS.map((day) => {
                  const entry = matrix[day]?.[slot.slot];
                  const color = CLASS_COLORS[si % CLASS_COLORS.length];
                  const isCurrent = isEntryCurrent(entry, currentMinutes, timeToMinutes);
                  const isUpcoming = isEntryUpcoming(entry, currentMinutes, timeToMinutes);
                  return (
                    <div key={`${day}-${slot.slot}`} className={`p-2 ${selectedDay === day ? 'bg-indigo-50/30' : ''}`}>
                      {entry ? <ScheduleCard entry={entry} color={color} isCurrent={isCurrent} isUpcoming={isUpcoming} /> : <FreeSlotCard />}
                    </div>
                  );
                })}
              </div>
              {breakInfo && <BreakBanner breakInfo={breakInfo} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  </section>
);

const ScheduleCard = ({ entry, color, isCurrent, isUpcoming }) => (
  <Motion.div whileHover={{ y: -2, scale: 1.01 }} className={`min-h-[92px] rounded-2xl border bg-white p-3 shadow-sm ${isCurrent ? 'border-emerald-300 ring-4 ring-emerald-100' : isUpcoming ? 'border-indigo-300 ring-4 ring-indigo-100' : 'border-slate-100'}`}>
    <div className="flex items-start justify-between gap-2">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${color.bg}`}><BookOpen size={14} className={color.text} /></div>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isCurrent ? 'bg-emerald-100 text-emerald-700' : isUpcoming ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{isCurrent ? 'Now' : isUpcoming ? 'Next' : 'Class'}</span>
    </div>
    <p className="mt-2 truncate text-xs font-bold text-slate-950">{entry.subject || 'Subject'}</p>
    <p className="mt-1 truncate text-[11px] text-slate-500">{entry.classLabel || entry.className || 'Class'}</p>
    <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400">
      <span className="inline-flex items-center gap-1"><MapPin size={11} />{entry.room || 'TBA'}</span>
      <ArrowUpRight size={12} />
    </div>
  </Motion.div>
);

const FreeSlotCard = () => (
  <div className="flex min-h-[92px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-center">
    <Coffee size={15} className="text-slate-300" />
    <p className="mt-2 text-[11px] font-semibold text-slate-400">Free Period</p>
    <p className="mt-0.5 text-[10px] text-slate-300">Available for planning</p>
  </div>
);

const BreakBanner = ({ breakInfo }) => (
  <div className="grid grid-cols-[150px_1fr] border-b border-amber-100 bg-amber-50/80">
    <div className="px-4 py-2 text-[11px] font-semibold text-amber-700">{breakInfo.range}</div>
    <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-amber-800"><Coffee size={14} />{breakInfo.duration} Minute Break</div>
  </div>
);

const DailyAgenda = ({ day, classes, currentMinutes, timeToMinutes }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-5 flex items-center justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-950">{day} Agenda</h2>
        <p className="text-xs text-slate-500">Timeline view with current and upcoming class indicators.</p>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{classes.length} classes</span>
    </div>
    {classes.length === 0 ? <FreeDay day={day} /> : (
      <div className="space-y-0">
        {classes.map((entry, index) => {
          const color = CLASS_COLORS[index % CLASS_COLORS.length];
          const isCurrent = isEntryCurrent(entry, currentMinutes, timeToMinutes);
          const isUpcoming = isEntryUpcoming(entry, currentMinutes, timeToMinutes);
          return (
            <Motion.div key={`${day}-${index}`} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }} className="grid grid-cols-[84px_24px_1fr] gap-3">
              <div className="pt-3 text-right text-xs font-semibold text-slate-400">{formatSlot(entry).split(' - ')[0]}</div>
              <div className="relative flex justify-center">
                <span className={`mt-3 h-3 w-3 rounded-full ${isCurrent ? 'bg-emerald-500 ring-4 ring-emerald-100' : isUpcoming ? 'bg-indigo-500 ring-4 ring-indigo-100' : 'bg-slate-300'}`} />
                {index < classes.length - 1 && <span className="absolute top-6 h-full w-px bg-slate-200" />}
              </div>
              <div className="pb-4"><ScheduleCard entry={entry} color={color} isCurrent={isCurrent} isUpcoming={isUpcoming} /></div>
            </Motion.div>
          );
        })}
      </div>
    )}
  </section>
);

const FreeDay = ({ day }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
    <Coffee className="mx-auto h-7 w-7 text-slate-300" />
    <p className="mt-3 text-sm font-semibold text-slate-600">No classes on {day}</p>
    <p className="mt-1 text-xs text-slate-400">Use this day for planning, grading, or meetings.</p>
  </div>
);

const UpcomingClasses = ({ nextClass, countdownLabel, entries }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-950">Upcoming Classes</h2><Timer size={17} className="text-indigo-600" /></div>
    {nextClass && (
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-500">Next up</p>
        <p className="mt-2 text-sm font-semibold text-slate-950">{nextClass.subject || 'Subject'}</p>
        <p className="mt-1 text-xs text-slate-500">{nextClass.day} · {formatSlot(nextClass)} · {nextClass.room || 'TBA'}</p>
        <span className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-bold text-indigo-700">{countdownLabel}</span>
      </div>
    )}
    <div className="mt-3 space-y-2">
      {entries.slice(0, 4).map((entry, index) => <MiniClassRow key={`${entry.day}-${entry.index}-${index}`} entry={entry} />)}
    </div>
  </section>
);

const MiniClassRow = ({ entry }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><BookOpen size={15} /></div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-semibold text-slate-800">{entry.subject || 'Subject'}</p>
      <p className="truncate text-[11px] text-slate-400">{entry.day} · {entry.slot}</p>
    </div>
    <span className="text-[11px] font-semibold text-slate-400">{entry.room || 'TBA'}</span>
  </div>
);

const FreePeriodInsights = ({ todayFreeSlots, freePeriodCount, busiestDay }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-4 flex items-center gap-2"><Coffee size={17} className="text-amber-600" /><h2 className="text-sm font-semibold text-slate-950">Free Period Insights</h2></div>
    <div className="grid grid-cols-2 gap-3">
      <InfoTile label="Today" value={todayFreeSlots} sub="free slots" />
      <InfoTile label="Weekly" value={freePeriodCount} sub="planning windows" />
    </div>
    <p className={`mt-3 rounded-2xl p-3 text-xs font-medium ${busiestDay.count >= 6 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{busiestDay.count >= 6 ? `${busiestDay.day} looks overloaded. Consider moving low-priority work.` : 'Schedule load looks manageable this week.'}</p>
  </section>
);

const ScheduleInsights = ({ busiestDay, longestStreak, roomSwitches, subjectDistribution }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-4 flex items-center gap-2"><BarChart3 size={17} className="text-cyan-600" /><h2 className="text-sm font-semibold text-slate-950">Schedule Insights</h2></div>
    <div className="space-y-3">
      <InfoTile label="Busiest day" value={busiestDay.day} sub={`${busiestDay.count} classes`} wide />
      <InfoTile label="Longest streak" value={longestStreak} sub="back-to-back classes" wide />
      <InfoTile label="Room switches" value={roomSwitches} sub="weekly movement count" wide />
    </div>
    <div className="mt-4 space-y-2">
      {subjectDistribution.slice(0, 4).map((item) => (
        <div key={item.subject} className="flex items-center gap-2">
          <span className="w-24 truncate text-[11px] font-semibold text-slate-500">{item.subject}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.min(100, item.count * 18)}%` }} /></div>
          <span className="text-[11px] font-bold text-slate-400">{item.count}</span>
        </div>
      ))}
    </div>
  </section>
);

const InfoTile = ({ label, value, sub, wide }) => (
  <div className={`rounded-2xl bg-slate-50 p-3 ${wide ? '' : ''}`}>
    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
    <p className="mt-1 truncate text-lg font-semibold text-slate-950">{value}</p>
    <p className="text-[11px] text-slate-400">{sub}</p>
  </div>
);

const getBreakAfter = (weeklySlots, index) => {
  if (index >= weeklySlots.length - 1) return null;
  const current = weeklySlots[index].slot.split(' - ');
  const next = weeklySlots[index + 1].slot.split(' - ');
  const end = parseDisplayTime(current[1]);
  const start = parseDisplayTime(next[0]);
  if (end === null || start === null || start - end < 10) return null;
  return { duration: start - end, range: `${current[1]?.trim()} - ${next[0]?.trim()}` };
};

const parseDisplayTime = (value) => {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const suffix = match[3].toUpperCase();
  if (suffix === 'PM' && hours !== 12) hours += 12;
  if (suffix === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const isEntryCurrent = (entry, currentMinutes, timeToMinutes) => {
  if (!entry) return false;
  const start = timeToMinutes(entry.startTime);
  const end = timeToMinutes(entry.endTime);
  return start !== null && end !== null && currentMinutes >= start && currentMinutes <= end;
};

const isEntryUpcoming = (entry, currentMinutes, timeToMinutes) => {
  if (!entry) return false;
  const start = timeToMinutes(entry.startTime);
  return start !== null && start > currentMinutes && start - currentMinutes <= 45;
};

export default ClassRoutine;
