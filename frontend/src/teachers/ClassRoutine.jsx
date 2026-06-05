import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const normalizeValue = (value) => String(value || '').trim().toLowerCase();

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [value];
};

const getCredentialValues = (teacherProfile, keys) =>
  keys
    .flatMap((key) => toArray(teacherProfile?.[key]))
    .filter(Boolean)
    .map((value) => normalizeValue(value));

const getCredentialDisplayValues = (teacherProfile, keys) =>
  Array.from(
    new Set(
      keys
        .flatMap((key) => toArray(teacherProfile?.[key]))
        .filter(Boolean)
        .map((value) => String(value).trim())
    )
  );

const getEntryValues = (entry, keys) =>
  keys
    .map((key) => entry?.[key])
    .filter(Boolean)
    .flatMap((value) => toArray(value))
    .map((value) => normalizeValue(value));

const matchesCredential = (entryValues, credentialValues) => {
  if (!credentialValues.length) return true;
  if (!entryValues.length) return true;
  return entryValues.some((entryValue) =>
    credentialValues.some(
      (credentialValue) =>
        entryValue === credentialValue ||
        entryValue.includes(credentialValue) ||
        credentialValue.includes(entryValue)
    )
  );
};

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
  const [routineMeta, setRoutineMeta] = useState({ campusScoped: true, timetableCount: 0, filterSource: 'campus' });
  const [selectedDay, setSelectedDay] = useState(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [viewMode, setViewMode] = useState('weekly');
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRoutine = useCallback(async () => {
    try {
      setLoading(true);
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
        });
        setTeacherProfile(dashboardData?.teacher || null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load routine');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoutine();
  }, [loadRoutine]);

  const teacherClassValues = useMemo(
    () =>
      getCredentialValues(teacherProfile, [
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

  const teacherSectionValues = useMemo(
    () =>
      getCredentialValues(teacherProfile, [
        'sectionName',
        'section',
        'division',
        'assignedSection',
        'assignedSections',
        'sections',
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

  const filteredSchedule = useMemo(
    () =>
      DAYS.reduce((acc, day) => {
        const entries = schedule[day] || [];
        acc[day] = entries.filter((entry) => {
          const entryClassValues = getEntryValues(entry, ['className', 'class', 'grade', 'standard', 'classLabel']);
          const entrySectionValues = getEntryValues(entry, ['sectionName', 'section', 'division', 'classLabel']);
          const classMatch = matchesCredential(entryClassValues, teacherClassValues);
          const sectionMatch = matchesCredential(entrySectionValues, teacherSectionValues);
          return classMatch && sectionMatch;
        });
        return acc;
      }, {}),
    [schedule, teacherClassValues, teacherSectionValues]
  );

  const filteredTotalClasses = useMemo(
    () => DAYS.reduce((sum, day) => sum + ((filteredSchedule[day] || []).length), 0),
    [filteredSchedule]
  );

  const effectiveSchedule = useMemo(() => {
    // If strict class/section filter removes everything, fallback to teacher-scoped schedule.
    if (filteredTotalClasses > 0) return filteredSchedule;
    return schedule;
  }, [filteredSchedule, schedule, filteredTotalClasses]);

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


  const downloadPDF = useCallback(() => {
    const generate = async () => {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const PW = 297, PH = 210, ML = 14, MR = 14;
      const UW = PW - ML - MR; // 269 mm usable width

      const schoolName    = teacherProfile?.schoolName || teacherProfile?.school?.name || teacherProfile?.campusName || 'School';
      const schoolAddress = teacherProfile?.schoolAddress || teacherProfile?.school?.address || teacherProfile?.campusAddress || teacherProfile?.address || '';
      const teacherName   = teacherProfile?.name || teacherProfile?.fullName || '';
      const subject       = teacherProfile?.subject || '';
      const logoUrl       = teacherProfile?.schoolLogo || '';

      // ── Load school logo as base64 ───────────────────────────────────────
      let logoDataUrl = null;
      if (logoUrl) {
        try {
          const resp = await fetch(logoUrl);
          const blob = await resp.blob();
          logoDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch { /* skip logo if fetch fails */ }
      }

      const activeDays  = DAYS.filter(d => (effectiveSchedule[d] || []).length > 0);
      const displayDays = activeDays.length > 0 ? activeDays : DAYS.slice(0, 6);

      const TIME_W   = 30;
      const COL_W    = (UW - TIME_W) / displayDays.length;
      const HDR_H    = 9;
      const LOGO_SZ  = 22;   // logo size in mm
      const HEADER_H = logoDataUrl ? 38 : 30; // taller header when logo present
      const BRK_H    = 8;    // break row height

      const infoItems = [
        teacherName && `Teacher: ${teacherName}`,
        subject && `Subject: ${subject}`,
        teacherClassLabels.length > 0 && `Class: ${teacherClassLabels.join(', ')}`,
        teacherSectionLabels.length > 0 && `Section: ${teacherSectionLabels.join(', ')}`,
        teacherProfile?.campusName && `Campus: ${teacherProfile.campusName}`,
      ].filter(Boolean);
      const INFO_H = infoItems.length > 0 ? 10 : 0;

      // ── Break detection between consecutive time slots ───────────────────
      const timeToMins = (t) => {
        if (!t) return null;
        const m = t.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
        if (!m) return null;
        let h = parseInt(m[1]), mn = parseInt(m[2]);
        if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
        if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
        return h * 60 + mn;
      };

      const pdfRows = [];
      weeklySlots.forEach((slot, si) => {
        pdfRows.push({ slot: slot.slot, isBreak: false, si });
        if (si < weeklySlots.length - 1) {
          const parts     = slot.slot.split(' - ');
          const nextParts = weeklySlots[si + 1].slot.split(' - ');
          const endMins   = timeToMins(parts[1]?.trim());
          const nextMins  = timeToMins(nextParts[0]?.trim());
          if (endMins !== null && nextMins !== null && nextMins - endMins >= 10) {
            const dur = nextMins - endMins;
            pdfRows.push({
              slot: `${parts[1]?.trim()} - ${nextParts[0]?.trim()}`,
              isBreak: true,
              breakLabel: `Break  (${dur} min)`,
              si: -1,
            });
          }
        }
      });

      const breakCount = pdfRows.filter(r => r.isBreak).length;
      const dataCount  = pdfRows.filter(r => !r.isBreak).length;
      // Available height for data rows
      const availH = PH - HEADER_H - INFO_H - 5 - HDR_H - breakCount * BRK_H - 12;
      const ROW_H  = Math.min(20, Math.max(12, Math.floor(availH / Math.max(dataCount, 1))));

      const TABLE_W = TIME_W + displayDays.length * COL_W;
      const trunc   = (str, n) => { const s = String(str || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

      // ── HEADER BLOCK ──────────────────────────────────────────────────────
      doc.setFillColor(67, 56, 202);      // indigo-700
      doc.rect(0, 0, PW, HEADER_H, 'F');

      // School logo — left side, vertically centered in header (above accent strip)
      const logoAreaH = HEADER_H - 10; // exclude bottom accent strip
      if (logoDataUrl) {
        const logoX = 8;
        const logoY = (logoAreaH - LOGO_SZ) / 2;
        // White circle bg behind logo
        doc.setFillColor(255, 255, 255);
        doc.circle(logoX + LOGO_SZ / 2, logoY + LOGO_SZ / 2, LOGO_SZ / 2 + 1.5, 'F');
        try { doc.addImage(logoDataUrl, logoX, logoY, LOGO_SZ, LOGO_SZ); } catch { /* skip */ }
      }

      // School name — centered
      const nameY = logoDataUrl ? 12 : 11;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text(trunc(schoolName, 55), PW / 2, nameY, { align: 'center' });

      // School address
      if (schoolAddress) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(199, 210, 254);  // indigo-200
        doc.text(trunc(schoolAddress, 90), PW / 2, nameY + 8, { align: 'center' });
      }

      // CLASS ROUTINE accent strip at bottom of header
      doc.setFillColor(79, 70, 229);      // indigo-600
      doc.rect(0, HEADER_H - 10, PW, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(224, 231, 255);    // indigo-100
      doc.text('CLASS ROUTINE', PW / 2, HEADER_H - 3.5, { align: 'center' });

      let y = HEADER_H + 4;

      // ── TEACHER INFO BAR ──────────────────────────────────────────────────
      if (infoItems.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(75, 85, 99);
        doc.text(infoItems.join('   ·   '), PW / 2, y, { align: 'center' });
        y += 5;
      }

      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.3);
      doc.line(ML, y, PW - MR, y);
      y += 5;

      const TABLE_Y = y;

      // ── TABLE HEADER ──────────────────────────────────────────────────────
      doc.setFillColor(243, 244, 246);
      doc.rect(ML, y, TIME_W, HDR_H, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(107, 114, 128);
      doc.text('TIME', ML + TIME_W / 2, y + 5.5, { align: 'center' });

      displayDays.forEach((day, di) => {
        const cx = ML + TIME_W + di * COL_W;
        doc.setFillColor(238, 242, 255);  // indigo-50
        doc.rect(cx, y, COL_W, HDR_H, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(67, 56, 202);    // indigo-700
        doc.text(day.toUpperCase(), cx + COL_W / 2, y + 5.5, { align: 'center' });
      });

      y += HDR_H;

      // ── TABLE ROWS (class rows + break rows) ─────────────────────────────
      const FILLS   = [[239,246,255],[245,243,255],[236,253,245],[255,251,235],[255,241,242],[240,253,250]];
      const ACCENTS = [[59,130,246],[139,92,246],[16,185,129],[245,158,11],[244,63,94],[20,184,166]];
      const subMaxCh = Math.max(8, Math.floor(COL_W / 2.1));

      pdfRows.forEach((row) => {
        if (row.isBreak) {
          // ── BREAK ROW ────────────────────────────────────────────────────
          // Full-width amber strip
          doc.setFillColor(255, 251, 235);          // amber-50
          doc.rect(ML, y, TABLE_W, BRK_H, 'F');
          // Left accent stripe
          doc.setFillColor(245, 158, 11);            // amber-500
          doc.rect(ML, y, 2.5, BRK_H, 'F');
          // Time span (left column)
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.5);
          doc.setTextColor(161, 98, 7);              // amber-700
          doc.text(row.slot, ML + TIME_W / 2, y + BRK_H / 2 + 1.5, { align: 'center' });
          // "Break (X min)" label — centered over day columns
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(161, 98, 7);
          const breakCenterX = ML + TIME_W + (TABLE_W - TIME_W) / 2;
          doc.text(row.breakLabel, breakCenterX, y + BRK_H / 2 + 1.5, { align: 'center' });
          y += BRK_H;
        } else {
          // ── CLASS ROW ────────────────────────────────────────────────────
          const si = row.si;
          const [fr, fg, fb] = FILLS[si % FILLS.length];
          const [ar, ag, ab] = ACCENTS[si % ACCENTS.length];
          const midY = y + ROW_H / 2;

          // Time cell
          doc.setFillColor(249, 250, 251);
          doc.rect(ML, y, TIME_W, ROW_H, 'F');
          const parts = row.slot.split(' - ');
          if (parts.length === 2) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(55, 65, 81);
            doc.text(parts[0], ML + TIME_W / 2, midY - 2, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(107, 114, 128);
            doc.text(parts[1], ML + TIME_W / 2, midY + 3, { align: 'center' });
          } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(55, 65, 81);
            doc.text(row.slot, ML + TIME_W / 2, midY + 1, { align: 'center' });
          }

          // Day cells
          displayDays.forEach((day, di) => {
            const cx    = ML + TIME_W + di * COL_W;
            const entry = weeklyMatrix[day]?.[row.slot];
            if (entry) {
              doc.setFillColor(fr, fg, fb);
              doc.roundedRect(cx + 1.5, y + 1.5, COL_W - 3, ROW_H - 3, 1.5, 1.5, 'F');
              // Accent dot
              doc.setFillColor(ar, ag, ab);
              doc.circle(cx + 5, y + ROW_H * 0.28, 1.4, 'F');
              // Subject
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(7.5);
              doc.setTextColor(17, 24, 39);
              doc.text(trunc(entry.subject || 'Subject', subMaxCh), cx + COL_W / 2, midY - 1.5, { align: 'center' });
              // Class
              const cls = entry.classLabel || entry.className || entry.class || '';
              if (cls) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(ar, ag, ab);
                doc.text(trunc(cls, 18), cx + COL_W / 2, midY + 3.5, { align: 'center' });
              }
              // Room
              doc.setFontSize(6);
              doc.setTextColor(156, 163, 175);
              doc.text(trunc(entry.room || 'TBA', 16), cx + COL_W / 2, y + ROW_H * 0.85, { align: 'center' });
            } else {
              doc.setFillColor(250, 250, 250);
              doc.rect(cx, y, COL_W, ROW_H, 'F');
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(10);
              doc.setTextColor(209, 213, 219);
              doc.text('—', cx + COL_W / 2, midY + 1, { align: 'center' });
            }
          });

          y += ROW_H;
        }
      });

      const TABLE_END_Y = y;

      // ── GRID LINES ────────────────────────────────────────────────────────
      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.35);
      doc.rect(ML, TABLE_Y, TABLE_W, TABLE_END_Y - TABLE_Y);

      doc.setLineWidth(0.2);
      doc.setDrawColor(229, 231, 235);

      // Horizontal lines between rows
      let ly = TABLE_Y + HDR_H;
      pdfRows.forEach((row) => {
        doc.line(ML, ly, ML + TABLE_W, ly);
        ly += row.isBreak ? BRK_H : ROW_H;
      });

      // Vertical lines drawn in segments — break rows are skipped so they
      // appear as a single full-width colspan cell with no dividers inside.
      const vSegs = [];
      let vy = TABLE_Y;
      vSegs.push({ y1: vy, y2: vy + HDR_H });   // header row segment
      vy += HDR_H;
      pdfRows.forEach((row) => {
        if (!row.isBreak) {
          const last = vSegs[vSegs.length - 1];
          if (last && last.y2 === vy) { last.y2 = vy + ROW_H; }  // extend
          else                        { vSegs.push({ y1: vy, y2: vy + ROW_H }); }
          vy += ROW_H;
        } else {
          vy += BRK_H;  // skip — no vertical lines drawn through break row
        }
      });

      const vLineXs = [ML + TIME_W];
      for (let i = 1; i < displayDays.length; i++) vLineXs.push(ML + TIME_W + i * COL_W);
      vLineXs.forEach(lx => vSegs.forEach(seg => doc.line(lx, seg.y1, lx, seg.y2)));

      // ── FOOTER ────────────────────────────────────────────────────────────
      const genDate = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(156, 163, 175);
      doc.text(`Generated: ${genDate}`, ML, PH - 5);
      doc.text(trunc(schoolName, 50), PW - MR, PH - 5, { align: 'right' });

      doc.save(`class-routine-${(teacherProfile?.name || 'teacher').replace(/\s+/g, '-').toLowerCase()}.pdf`);
    };
    generate();
  }, [effectiveSchedule, weeklySlots, weeklyMatrix, teacherProfile, teacherClassLabels, teacherSectionLabels]);

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

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <Motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-xl shadow-slate-300/40">
          <div className="relative p-5 sm:p-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.55),transparent_36%),linear-gradient(135deg,rgba(15,23,42,1),rgba(30,41,59,1))]" />
            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-200">Teacher Timetable</p>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">Good day, {firstName}</h1>
                <p className="mt-3 max-w-3xl text-sm text-slate-300">
                  You have <span className="font-semibold text-white">{realTodayClasses.length} classes today</span>. {nextClass ? `Next class: ${nextClass.subject || 'Subject'} · ${countdownLabel}.` : 'No upcoming class is scheduled.'}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {teacherProfile?.subject && <HeroChip icon={BookOpen} label={teacherProfile.subject} />}
                  {teacherProfile?.campusName && <HeroChip icon={School} label={teacherProfile.campusName} />}
                  <HeroChip icon={Zap} label={`${teachingHours} weekly workload`} />
                  <HeroChip icon={Users} label={`${toScopeLabel(routineMeta.filterSource)} · ${routineMeta.timetableCount} matched`} />
                </div>
              </div>
              <div className="grid min-w-[280px] gap-3 sm:grid-cols-2">
                <HeroMetric label="Next Class" value={nextClass?.subject || 'None'} sub={countdownLabel} />
                <HeroMetric label="Room" value={nextClass?.room || 'TBA'} sub={nextClass ? `${nextClass.classLabel || nextClass.className || 'Class'} · ${nextClass.day}` : 'No upcoming room'} />
              </div>
            </div>
          </div>
        </Motion.section>

        {(teacherClassLabels.length > 0 || teacherSectionLabels.length > 0 || teacherProfile?.subject) && (
          <div className="flex flex-wrap items-center gap-2">
            {teacherProfile?.subject && <ContextPill icon={BookOpen} label={teacherProfile.subject} tone="indigo" />}
            {teacherClassLabels.length > 0 && <ContextPill icon={Users} label={`Class ${teacherClassLabels.join(', ')}`} tone="blue" />}
            {teacherSectionLabels.length > 0 && <ContextPill icon={Layers} label={`Section ${teacherSectionLabels.join(', ')}`} tone="emerald" />}
            {teacherProfile?.campusName && <ContextPill icon={School} label={teacherProfile.campusName} tone="slate" />}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {smartStats.map((stat, index) => <InsightCard key={stat.label} stat={stat} index={index} />)}
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="inline-flex w-fit rounded-2xl border border-slate-200 bg-slate-50 p-1">
              {[{ id: 'weekly', label: 'Week' }, { id: 'daily', label: 'Day' }].map((tab) => (
                <button key={tab.id} type="button" onClick={() => setViewMode(tab.id)} className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${viewMode === tab.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{tab.label}</button>
              ))}
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative md:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search subject, class, room" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100" />
              </div>
              <button type="button" onClick={() => setShowFilters((prev) => !prev)} className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-xs font-semibold transition ${activeFilterCount ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <Filter size={15} /> Filters {activeFilterCount > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-[10px] text-white">{activeFilterCount}</span>}
                <ChevronDown size={14} className={showFilters ? 'rotate-180 transition' : 'transition'} />
              </button>
              <div className="relative">
                <button type="button" onClick={downloadPDF} disabled={totalClasses === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
                  <Download size={15} /> Export PDF
                </button>
              </div>
              <button type="button" onClick={loadRoutine} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <RefreshCw size={15} /> Reload
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showFilters && (
              <Motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-4">
                  <FilterSelect label="Subject" value={subjectFilter} onChange={setSubjectFilter} options={uniqueSubjects} />
                  <FilterSelect label="Room" value={roomFilter} onChange={setRoomFilter} options={uniqueRooms} />
                  <FilterSelect label="Class" value={classFilter} onChange={setClassFilter} options={uniqueClasses} />
                  <div className="flex items-end">
                    <button type="button" onClick={clearFilters} className="h-10 w-full rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Clear filters</button>
                  </div>
                </div>
              </Motion.div>
            )}
          </AnimatePresence>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-5">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DAYS.map((day) => {
                const count = (visibleSchedule[day] || []).length;
                const active = selectedDay === day;
                return (
                  <button key={day} onClick={() => setSelectedDay(day)} className={`shrink-0 rounded-2xl px-3 py-2 text-xs font-semibold transition ${active ? 'bg-slate-950 text-white shadow-lg shadow-slate-200' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    <span className="sm:hidden">{day.slice(0, 3)}</span><span className="hidden sm:inline">{day}</span>
                    <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/15' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>
            ) : totalClasses === 0 ? (
              <EmptyTimetable loadRoutine={loadRoutine} />
            ) : (
              <AnimatePresence mode="wait">
                {viewMode === 'weekly' ? (
                  <Motion.div key="weekly" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <WeeklyWorkspace weeklySlots={weeklySlots} matrix={visibleWeeklyMatrix} selectedDay={selectedDay} currentMinutes={currentMinutes} timeToMinutes={timeToMinutes} />
                  </Motion.div>
                ) : (
                  <Motion.div key="daily" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                    <DailyAgenda day={selectedDay} classes={visibleTodayClasses} currentMinutes={currentMinutes} timeToMinutes={timeToMinutes} />
                  </Motion.div>
                )}
              </AnimatePresence>
            )}
          </main>

          <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
            <UpcomingClasses nextClass={nextClass} countdownLabel={countdownLabel} entries={scheduleEntries.slice(0, 6)} />
            <FreePeriodInsights todayFreeSlots={todayFreeSlots} freePeriodCount={freePeriodCount} busiestDay={busiestDay} />
            <ScheduleInsights busiestDay={busiestDay} longestStreak={longestStreak} roomSwitches={roomSwitches} subjectDistribution={subjectDistribution} />
          </aside>
        </div>
      </div>
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
