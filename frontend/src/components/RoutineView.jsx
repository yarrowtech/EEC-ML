import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Calendar, Clock, MapPin, BookOpen, AlertCircle, RefreshCcw, Download } from 'lucide-react';
import { useStudentDashboard } from './StudentDashboardContext';
import { clearCacheEntry, readCacheEntry, writeCacheEntry } from '../utils/studentCache';
import { fetchCachedJson } from '../utils/studentApiCache';

const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const dayLabels = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const SUBJECT_PALETTE = [
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500', chip: 'bg-indigo-100 text-indigo-700' },
  { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', dot: 'bg-sky-500', chip: 'bg-sky-100 text-sky-700' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700' },
  { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-700', dot: 'bg-fuchsia-500', chip: 'bg-fuchsia-100 text-fuchsia-700' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500', chip: 'bg-rose-100 text-rose-700' },
  { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500', chip: 'bg-violet-100 text-violet-700' },
  { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', dot: 'bg-teal-500', chip: 'bg-teal-100 text-teal-700' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700' },
];

const getSubjectStyle = (name) => {
  const str = String(name || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return SUBJECT_PALETTE[hash % SUBJECT_PALETTE.length];
};

const TODAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const ROUTINE_CACHE_KEY = 'studentRoutineCacheV1';
const ROUTINE_CACHE_TTL_MS = 10 * 60 * 1000;
const ROUTINE_FETCH_CACHE_TTL_MS = 2 * 60 * 1000;

const normalizeDay = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  return dayOrder.includes(normalized) ? normalized : null;
};

const normalizeSchedule = (rawSchedule) => {
  if (!rawSchedule) return {};

  if (Array.isArray(rawSchedule)) {
    const reduced = rawSchedule.reduce((acc, session) => {
      const day = normalizeDay(session.day || session.weekday || session.dayOfWeek);
      if (!day) return acc;
      acc[day] = acc[day] || [];
      acc[day].push(session);
      return acc;
    }, {});
    return addBreaksToSchedule(reduced);
  }

  if (typeof rawSchedule === 'object') {
    const reduced = Object.entries(rawSchedule).reduce((acc, [day, sessions]) => {
      const dayKey = normalizeDay(day);
      if (!dayKey) return acc;
      acc[dayKey] = Array.isArray(sessions) ? sessions : [];
      return acc;
    }, {});
    return addBreaksToSchedule(reduced);
  }

  return {};
};

const pickId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value._id || value.id || null;
  return null;
};

const hasScheduleEntries = (normalizedSchedule) =>
  dayOrder.some((day) => (normalizedSchedule?.[day] || []).length > 0);

const parseTimeToMinutes = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  const timeMatch = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!timeMatch) return null;
  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const meridiem = timeMatch[3]?.toLowerCase();
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (meridiem) {
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
  }
  return hours * 60 + minutes;
};

const resolveTimeRange = (entry) => {
  const start = entry?.startTime || entry?.time?.split('-')?.[0]?.trim() || '';
  const end = entry?.endTime || entry?.time?.split('-')?.[1]?.trim() || '';
  return { start, end };
};

const addBreaksToSchedule = (schedule) => {
  const next = {};
  dayOrder.forEach((day) => {
    const sessions = Array.isArray(schedule?.[day]) ? [...schedule[day]] : [];
    const withTimes = sessions
      .map((entry) => {
        const range = resolveTimeRange(entry);
        const startMin = parseTimeToMinutes(range.start);
        const endMin = parseTimeToMinutes(range.end);
        return { entry, startMin, endMin, range };
      })
      .filter((item) => item.startMin !== null && item.endMin !== null)
      .sort((a, b) => a.startMin - b.startMin);

    if (withTimes.length === 0) {
      next[day] = sessions;
      return;
    }

    const result = [];
    for (let i = 0; i < withTimes.length; i += 1) {
      const current = withTimes[i];
      result.push(current.entry);
      const nextItem = withTimes[i + 1];
      if (!nextItem) continue;
      if (current.endMin < nextItem.startMin) {
        result.push({
          day,
          startTime: current.range.end,
          endTime: nextItem.range.start,
          time: `${current.range.end} - ${nextItem.range.start}`,
          subject: 'Break',
          instructor: '-',
          room: '',
          isBreak: true,
        });
      }
    }
    next[day] = result;
  });
  return next;
};

const normalizeTimetablePayload = (payload) => {
  const timetables = [];

  if (Array.isArray(payload)) {
    timetables.push(...payload);
  } else if (Array.isArray(payload?.timetables)) {
    timetables.push(...payload.timetables);
  } else if (payload?.timetable) {
    timetables.push(payload.timetable);
  } else if (Array.isArray(payload?.entries)) {
    timetables.push({ entries: payload.entries });
  }

  const sessions = timetables.flatMap((timetable) =>
    (timetable?.entries || []).map((entry) => ({
      day: entry.dayOfWeek || entry.day || entry.weekday,
      startTime: entry.startTime,
      endTime: entry.endTime,
      time:
        entry.time ||
        (entry.startTime
          ? `${entry.startTime}${entry.endTime ? ` - ${entry.endTime}` : ''}`
          : undefined),
      subject:
        entry.subjectId?.name ||
        entry.subject?.name ||
        entry.subjectName ||
        entry.subject ||
        'Class',
      instructor:
        entry.teacherId?.name ||
        entry.teacher?.name ||
        entry.teacherName ||
        entry.instructor,
      room: entry.room || entry.location || 'TBD',
      className: timetable?.classId?.name || entry.className || entry.class,
      sectionName: timetable?.sectionId?.name || entry.sectionName || entry.section,
    }))
  );

  return normalizeSchedule(sessions);
};

const normalizeValue = (value) => String(value || '').trim().toLowerCase();

const getEntryValues = (entry, keys) =>
  keys
    .map((key) => entry?.[key])
    .filter(Boolean)
    .map((value) => normalizeValue(value));

const isBreakSession = (session) =>
  session?.isBreak ||
  String(session?.subject || session?.course || session?.title || '').trim().toLowerCase() === 'break';

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

const RoutineView = () => {
  const { profile } = useStudentDashboard();
  const [schedule, setSchedule] = useState({});
  const [selectedDay, setSelectedDay] = useState(dayOrder[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [silentRefreshing, setSilentRefreshing] = useState(false);

  const fetchSchedule = useCallback(async ({ silent = false, forceRefresh = false } = {}) => {
    try {
      if (silent) setSilentRefreshing(true);
      else setLoading(true);
      setError(null);

      console.groupCollapsed('[Student Routine View] Fetching schedule...');
      console.log('Student Profile:', profile);

      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');
      if (!token || userType !== 'Student') {
        clearCacheEntry(ROUTINE_CACHE_KEY);
        setSchedule({});
        throw new Error('Only students can view this routine.');
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const fetchRoutinePayload = async (endpoint) => {
        const { data } = await fetchCachedJson(`${import.meta.env.VITE_API_URL}${endpoint}`, {
          ttlMs: ROUTINE_FETCH_CACHE_TTL_MS,
          forceRefresh,
          fetchOptions: { headers },
        });
        return data;
      };

      let normalized = null;

      // Attempt 1: Fetch schedule specific to the authenticated student.
      // This is the ideal endpoint as it requires no parameters.
      try {
        const studentScheduleData = await fetchRoutinePayload('/api/student/auth/schedule');
        if (studentScheduleData) {
          const tempNormalized = normalizeSchedule(
            studentScheduleData.schedule || studentScheduleData.routine || studentScheduleData.data?.schedule
          );
          if (hasScheduleEntries(tempNormalized)) {
            normalized = tempNormalized;
          }
        }
      } catch (e) {
        console.warn('Failed to fetch student-specific schedule:', e.message);
      }

      // Attempt 2 (Fallback): Fetch timetable for the student's class/section if the first attempt failed.
      if (!normalized) {
        const studentEndpoints = [
          '/api/timetable/student',
          '/api/student/timetable'
        ];

        for (const endpoint of studentEndpoints) {
          try {
            const data = await fetchRoutinePayload(endpoint);
            if (data) {
              const tempNormalized =
                normalizeTimetablePayload(data) || normalizeSchedule(data.schedule || data.routine || data.data?.schedule);
              if (hasScheduleEntries(tempNormalized)) {
                normalized = tempNormalized;
                break;
              }
            }
          } catch (e) {
            console.warn(`Failed to fetch from ${endpoint}:`, e.message);
          }
        }
      }

      // Attempt 3: Try general timetable API only if we have valid database IDs.
      // We skip this if we only have names (like grade="1") because it causes a 403 Forbidden error.
      if (!normalized) {
        const classValue = pickId(profile?.classId || profile?.currentClass || profile?.className || profile?.grade || profile?.class);
        const sectionValue = pickId(profile?.sectionId || profile?.currentSection || profile?.sectionName || profile?.section);
        const sessionValue = pickId(profile?.academicYearId || profile?.sessionId || profile?.academicYear || profile?.session);

        const isValidId = (id) => String(id).length === 24 && /^[0-9a-fA-F]{24}$/.test(String(id));

        if (classValue && isValidId(classValue)) {
          try {
            const params = new URLSearchParams();
            
            params.append('classId', classValue);

            if (sectionValue) {
              if (isValidId(sectionValue)) {
                params.append('sectionId', sectionValue);
              }
            }

            if (sessionValue) {
              if (isValidId(sessionValue)) {
                params.append('academicYearId', sessionValue);
              }
            }

            const timetableData = await fetchRoutinePayload(
              `/api/timetable?${params.toString()}`
            );
            if (timetableData) {
              const tempNormalized = normalizeTimetablePayload(timetableData);
              if (hasScheduleEntries(tempNormalized)) {
                normalized = tempNormalized;
              }
            }
          } catch (e) {
            console.warn('Failed to fetch class timetable as fallback:', e.message);
          }
        }
      }

      if (!normalized) {
        console.log('[Student Routine View] No routine data found for this student.');
        setSchedule({});
        const now = new Date();
        setLastUpdated(now);
        setError('No routine has been assigned yet for your class/section.');
        clearCacheEntry(ROUTINE_CACHE_KEY);
        console.groupEnd();
        return;
      }

      console.log('[Student Routine View] Fetched and normalized routine:', normalized);
      const now = new Date();
      setSchedule(normalized);
      setLastUpdated(now);
      writeCacheEntry(
        ROUTINE_CACHE_KEY,
        { schedule: normalized, lastUpdated: now.toISOString() },
        ROUTINE_CACHE_TTL_MS
      );
      console.groupEnd();
    } catch (err) {
      setError(err.message || 'Failed to load routine');
      console.groupEnd();
    } finally {
      if (silent) setSilentRefreshing(false);
      else setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    const cachedEntry = readCacheEntry(ROUTINE_CACHE_KEY);
    if (cachedEntry?.data?.schedule) {
      setSchedule(cachedEntry.data.schedule);
      const cachedDate = cachedEntry.data.lastUpdated
        ? new Date(cachedEntry.data.lastUpdated)
        : new Date(cachedEntry.timestamp);
      setLastUpdated(cachedDate);
      setLoading(false);
    }
    fetchSchedule({ silent: Boolean(cachedEntry?.data?.schedule), forceRefresh: false });
  }, [fetchSchedule]);

  const studentClassValues = useMemo(
    () =>
      [profile?.className, profile?.grade]
        .filter(Boolean)
        .map((value) => normalizeValue(value)),
    [profile]
  );

  const studentSectionValues = useMemo(
    () =>
      [profile?.sectionName, profile?.section]
        .filter(Boolean)
        .map((value) => normalizeValue(value)),
    [profile]
  );

  const filteredSchedule = useMemo(() => {
    return dayOrder.reduce((acc, day) => {
      const entries = schedule[day] || [];
      acc[day] = entries.filter((entry) => {
        const entryClassValues = getEntryValues(entry, ['className', 'class', 'grade', 'standard']);
        const entrySectionValues = getEntryValues(entry, ['sectionName', 'section', 'division']);
        const classMatch = matchesCredential(entryClassValues, studentClassValues);
        const sectionMatch = matchesCredential(entrySectionValues, studentSectionValues);
        return classMatch && sectionMatch;
      });
      return acc;
    }, {});
  }, [schedule, studentClassValues, studentSectionValues]);

  const weeklySlots = useMemo(() => {
    const slotMap = new Map();
    dayOrder.forEach((day) => {
      (filteredSchedule[day] || []).forEach((session, index) => {
        const timeLabel =
          session.time ||
          (session.startTime
            ? `${session.startTime}${session.endTime ? ` - ${session.endTime}` : ''}`
            : `Period ${session.period || index + 1}`);
        const periodOrder = Number(session.period || 999);
        const startLabel = String(timeLabel).split('-')[0]?.trim();
        const timeOrder = parseTimeToMinutes(startLabel);
        if (!slotMap.has(timeLabel)) {
          slotMap.set(timeLabel, { timeLabel, periodOrder, timeOrder });
        } else {
          const prev = slotMap.get(timeLabel);
          if (periodOrder < prev.periodOrder) {
            slotMap.set(timeLabel, { timeLabel, periodOrder, timeOrder });
          }
        }
      });
    });
    return Array.from(slotMap.values()).sort((a, b) =>
      (a.timeOrder ?? a.periodOrder) === (b.timeOrder ?? b.periodOrder)
        ? a.timeLabel.localeCompare(b.timeLabel)
        : (a.timeOrder ?? a.periodOrder) - (b.timeOrder ?? b.periodOrder)
    );
  }, [filteredSchedule]);

  const weeklyMatrix = useMemo(() => {
    const matrix = {};
    dayOrder.forEach((day) => {
      matrix[day] = {};
      (filteredSchedule[day] || []).forEach((session, index) => {
        const timeLabel =
          session.time ||
          (session.startTime
            ? `${session.startTime}${session.endTime ? ` - ${session.endTime}` : ''}`
            : `Period ${session.period || index + 1}`);
        matrix[day][timeLabel] = session;
      });
    });
    return matrix;
  }, [filteredSchedule]);

  useEffect(() => {
    const firstAvailableDay = dayOrder.find((day) => filteredSchedule[day]?.length) || dayOrder[0];
    setSelectedDay(firstAvailableDay);
  }, [filteredSchedule]);

  const todayKey = useMemo(() => TODAY_KEYS[new Date().getDay()], []);

  const daySessions = filteredSchedule[selectedDay] || [];
  const totalSessions = useMemo(
    () => dayOrder.reduce((sum, day) => sum + (filteredSchedule[day]?.length || 0), 0),
    [filteredSchedule]
  );

  const downloadPDF = useCallback(() => {
    const generate = async () => {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const PW = 297, PH = 210, ML = 14, MR = 14;
      const UW = PW - ML - MR;

      const schoolName    = profile?.schoolName || profile?.school?.name || profile?.campusName || 'School';
      const schoolAddress = profile?.schoolAddress || profile?.school?.address || profile?.address || '';
      const studentName   = profile?.name || profile?.fullName || '';
      const className     = profile?.className || profile?.grade || '';
      const sectionName   = profile?.sectionName || profile?.section || '';
      const logoUrl       = profile?.schoolLogo || profile?.school?.logo?.secure_url || profile?.school?.logo || '';

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

      const activeDays  = dayOrder.filter(d => (filteredSchedule[d] || []).length > 0);
      const displayDays = activeDays.length > 0 ? activeDays : dayOrder.slice(0, 6);

      const TIME_W   = 30;
      const COL_W    = (UW - TIME_W) / displayDays.length;
      const HDR_H    = 9;
      const LOGO_SZ  = 22;
      const HEADER_H = logoDataUrl ? 38 : 30;
      const BRK_H    = 8;

      // ── Build pdfRows — detect break slots via weeklyMatrix ──────────────
      const pdfRows = [];
      let colorIdx = 0;
      weeklySlots.forEach((slot) => {
        const anySession = displayDays.map(d => weeklyMatrix[d]?.[slot.timeLabel]).find(Boolean);
        const isBreak = Boolean(anySession?.isBreak);
        pdfRows.push({ timeLabel: slot.timeLabel, isBreak, si: isBreak ? -1 : colorIdx });
        if (!isBreak) colorIdx++;
      });

      const infoItems = [
        studentName && `Student: ${studentName}`,
        className   && `Class: ${className}`,
        sectionName && `Section: ${sectionName}`,
      ].filter(Boolean);
      const INFO_H = infoItems.length > 0 ? 10 : 0;

      const breakCount = pdfRows.filter(r => r.isBreak).length;
      const dataCount  = pdfRows.filter(r => !r.isBreak).length;
      const availH = PH - HEADER_H - INFO_H - 5 - HDR_H - breakCount * BRK_H - 12;
      const ROW_H  = Math.min(20, Math.max(12, Math.floor(availH / Math.max(dataCount, 1))));

      const TABLE_W = TIME_W + displayDays.length * COL_W;
      const trunc   = (str, n) => { const s = String(str || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

      // ── HEADER BLOCK ──────────────────────────────────────────────────────
      doc.setFillColor(67, 56, 202);
      doc.rect(0, 0, PW, HEADER_H, 'F');

      const logoAreaH = HEADER_H - 10;
      if (logoDataUrl) {
        const logoX = 8;
        const logoY = (logoAreaH - LOGO_SZ) / 2;
        doc.setFillColor(255, 255, 255);
        doc.circle(logoX + LOGO_SZ / 2, logoY + LOGO_SZ / 2, LOGO_SZ / 2 + 1.5, 'F');
        try { doc.addImage(logoDataUrl, logoX, logoY, LOGO_SZ, LOGO_SZ); } catch { /* skip */ }
      }

      const nameY = logoDataUrl ? 12 : 11;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text(trunc(schoolName, 55), PW / 2, nameY, { align: 'center' });

      if (schoolAddress) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(199, 210, 254);
        doc.text(trunc(schoolAddress, 90), PW / 2, nameY + 8, { align: 'center' });
      }

      doc.setFillColor(79, 70, 229);
      doc.rect(0, HEADER_H - 10, PW, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(224, 231, 255);
      doc.text('CLASS ROUTINE', PW / 2, HEADER_H - 3.5, { align: 'center' });

      let y = HEADER_H + 4;

      // ── STUDENT INFO BAR ──────────────────────────────────────────────────
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
        doc.setFillColor(238, 242, 255);
        doc.rect(cx, y, COL_W, HDR_H, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(67, 56, 202);
        doc.text(dayLabels[day].toUpperCase(), cx + COL_W / 2, y + 5.5, { align: 'center' });
      });

      y += HDR_H;

      // ── TABLE ROWS ────────────────────────────────────────────────────────
      const FILLS   = [[239,246,255],[245,243,255],[236,253,245],[255,251,235],[255,241,242],[240,253,250]];
      const ACCENTS = [[59,130,246],[139,92,246],[16,185,129],[245,158,11],[244,63,94],[20,184,166]];
      const subMaxCh = Math.max(8, Math.floor(COL_W / 2.1));

      pdfRows.forEach((row) => {
        if (row.isBreak) {
          // ── BREAK ROW ──────────────────────────────────────────────────
          doc.setFillColor(255, 251, 235);
          doc.rect(ML, y, TABLE_W, BRK_H, 'F');
          doc.setFillColor(245, 158, 11);
          doc.rect(ML, y, 2.5, BRK_H, 'F');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.5);
          doc.setTextColor(161, 98, 7);
          doc.text(row.timeLabel, ML + TIME_W / 2, y + BRK_H / 2 + 1.5, { align: 'center' });
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(161, 98, 7);
          const breakCenterX = ML + TIME_W + (TABLE_W - TIME_W) / 2;
          doc.text('Break', breakCenterX, y + BRK_H / 2 + 1.5, { align: 'center' });
          y += BRK_H;
        } else {
          // ── CLASS ROW ──────────────────────────────────────────────────
          const [fr, fg, fb] = FILLS[row.si % FILLS.length];
          const [ar, ag, ab] = ACCENTS[row.si % ACCENTS.length];
          const midY = y + ROW_H / 2;

          // Time cell
          doc.setFillColor(249, 250, 251);
          doc.rect(ML, y, TIME_W, ROW_H, 'F');
          const parts = row.timeLabel.split(' - ');
          if (parts.length === 2) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(55, 65, 81);
            doc.text(parts[0].trim(), ML + TIME_W / 2, midY - 2, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(107, 114, 128);
            doc.text(parts[1].trim(), ML + TIME_W / 2, midY + 3, { align: 'center' });
          } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(55, 65, 81);
            doc.text(row.timeLabel, ML + TIME_W / 2, midY + 1, { align: 'center' });
          }

          // Day cells
          displayDays.forEach((day, di) => {
            const cx      = ML + TIME_W + di * COL_W;
            const session = weeklyMatrix[day]?.[row.timeLabel];
            if (session && !session.isBreak) {
              doc.setFillColor(fr, fg, fb);
              doc.roundedRect(cx + 1.5, y + 1.5, COL_W - 3, ROW_H - 3, 1.5, 1.5, 'F');
              doc.setFillColor(ar, ag, ab);
              doc.circle(cx + 5, y + ROW_H * 0.28, 1.4, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(7.5);
              doc.setTextColor(17, 24, 39);
              doc.text(trunc(session.course || session.subject || session.title || 'Class', subMaxCh), cx + COL_W / 2, midY - 1.5, { align: 'center' });
              const instr = session.instructor || session.teacher || '';
              if (instr) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(ar, ag, ab);
                doc.text(trunc(instr, 18), cx + COL_W / 2, midY + 3.5, { align: 'center' });
              }
              doc.setFontSize(6);
              doc.setTextColor(156, 163, 175);
              doc.text(trunc(session.room || session.location || 'TBD', 16), cx + COL_W / 2, y + ROW_H * 0.85, { align: 'center' });
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

      // Vertical lines — segment-based, break rows skipped (colspan effect)
      const vSegs = [];
      let vy = TABLE_Y;
      vSegs.push({ y1: vy, y2: vy + HDR_H });
      vy += HDR_H;
      pdfRows.forEach((row) => {
        if (!row.isBreak) {
          const last = vSegs[vSegs.length - 1];
          if (last && last.y2 === vy) { last.y2 = vy + ROW_H; }
          else                        { vSegs.push({ y1: vy, y2: vy + ROW_H }); }
          vy += ROW_H;
        } else {
          vy += BRK_H;
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
      doc.text(`Downloaded: ${genDate}`, ML, PH - 5);
      doc.text(trunc(schoolName, 50), PW - MR, PH - 5, { align: 'right' });

      doc.save(`class-routine-${(studentName || 'student').replace(/\s+/g, '-').toLowerCase()}.pdf`);
    };
    generate();
  }, [filteredSchedule, weeklySlots, weeklyMatrix, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 pt-4 pb-4 sm:p-6 space-y-4">
        <div className="h-28 bg-white rounded-2xl shadow-sm animate-pulse" />
        <div className="h-52 bg-white rounded-2xl shadow-sm animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 pt-4 pb-4 sm:p-6 space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-indigo-500 via-indigo-600 to-purple-600 p-5 shadow-lg shadow-indigo-200/60 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Calendar className="h-5.5 w-5.5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white sm:text-2xl">Daily Routine</h1>
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/80">
              {/* <span>Student view only</span> */}
              {(profile?.academicYear || profile?.session) && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
                  Session {profile?.academicYear || profile?.session}
                </span>
              )}
              {(profile?.className || profile?.grade) && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
                  Class {profile?.className || profile?.grade}
                </span>
              )}
              {(profile?.sectionName || profile?.section) && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
                  Section {profile?.sectionName || profile?.section}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end md:text-right">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-white/85">
              <p>
                Total: <span className="font-bold text-white">{totalSessions} sessions</span>
              </p>
              <p className="text-xs text-white/60">
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}`
                  : 'Waiting for first sync...'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadPDF}
                disabled={totalSessions === 0}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => fetchSchedule({ silent: true, forceRefresh: true })}
                disabled={silentRefreshing}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw
                  className={`h-3.5 w-3.5 ${silentRefreshing ? 'animate-spin' : ''}`}
                />
                {silentRefreshing ? 'Refreshing' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
        {error && (
          <div className="relative mt-4 flex items-center rounded-lg border border-white/30 bg-white/15 px-3 py-2 text-sm text-white">
            <AlertCircle size={16} className="mr-2 shrink-0" />
            {error}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        {totalSessions === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-lg font-semibold text-slate-800">No routine assigned yet</p>
            <p className="text-sm text-slate-500 mt-2">
              Please ask your school admin to assign timetable for your class and section.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile / tablet: day tabs + session cards */}
            <div className="sm:hidden">
              <div className="flex overflow-x-auto gap-2 mb-4 pb-1 -mx-4 px-4 scrollbar-hide">
                {dayOrder.map((day) => {
                  const isToday = day === todayKey;
                  const active = selectedDay === day;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                        active
                          ? 'bg-linear-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {dayLabels[day].slice(0, 3)}
                      {isToday && <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : 'bg-indigo-500'}`} />}
                      {filteredSchedule[day]?.length ? (
                        <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                          active ? 'bg-white/25 text-white' : 'bg-slate-300 text-slate-600'
                        }`}>
                          {filteredSchedule[day].length}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {daySessions.length > 0 ? (
                <div className="space-y-3">
                  {daySessions.map((session, index) => {
                    const isBreak = isBreakSession(session);
                    const style = getSubjectStyle(session.course || session.subject || session.title);
                    const timeLabel = session.time || `${session.startTime || '--'}${session.endTime ? ` - ${session.endTime}` : ''}`;
                    return (
                      <div
                        key={session.id || `${selectedDay}-${index}`}
                        className={`rounded-2xl border p-4 shadow-sm transition-transform active:scale-[0.99] ${
                          isBreak ? 'border-amber-200 bg-amber-50' : `${style.border} ${style.bg}`
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] uppercase font-semibold tracking-wider ${isBreak ? 'text-amber-600' : style.text}`}>
                            {session.type || (isBreak ? 'Break' : `Period ${session.period || index + 1}`)}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            isBreak ? 'bg-amber-100 text-amber-700' : style.chip
                          }`}>
                            <Clock size={11} />
                            {timeLabel}
                          </span>
                        </div>
                        <h3 className={`text-base font-bold flex items-center gap-2 ${isBreak ? 'text-amber-800' : 'text-slate-900'}`}>
                          <BookOpen size={15} className={isBreak ? 'text-amber-500' : style.text} />
                          {session.course || session.subject || session.title || 'Class'}
                        </h3>
                        {!isBreak && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
                            {(session.instructor || session.teacher) && (
                              <span className="text-xs text-slate-500">
                                {session.instructor || session.teacher}
                              </span>
                            )}
                            {(session.room || session.location) && (
                              <span className={`inline-flex items-center gap-1 text-xs ${style.text}`}>
                                <MapPin size={11} />
                                {session.room || session.location}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                  No classes scheduled for {dayLabels[selectedDay]}. Please select another day.
                </div>
              )}
            </div>

            {/* Desktop / large tablet: weekly grid */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[900px] w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left text-sm font-semibold text-slate-700 px-4 py-3 border-b border-slate-200">
                      Time
                    </th>
                    {dayOrder.map((day) => {
                      const isToday = day === todayKey;
                      return (
                        <th
                          key={`head-${day}`}
                          className={`text-left text-sm font-semibold px-4 py-3 border-b border-slate-200 ${
                            isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {dayLabels[day]}
                            {isToday && (
                              <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold">Today</span>
                            )}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {weeklySlots.map((slot) => (
                    <tr key={`row-${slot.timeLabel}`} className="align-top">
                      <td className="px-4 py-3 text-sm font-medium text-slate-700 border-b border-slate-100 bg-slate-50">
                        {slot.timeLabel}
                      </td>
                      {dayOrder.map((day) => {
                        const session = weeklyMatrix[day]?.[slot.timeLabel];
                        const isToday = day === todayKey;
                        const style = session ? getSubjectStyle(session.course || session.subject || session.title) : null;
                        return (
                          <td
                            key={`cell-${day}-${slot.timeLabel}`}
                            className={`px-3 py-3 border-b border-slate-100 ${isToday ? 'bg-indigo-50/40' : ''}`}
                          >
                            {session ? (
                              <div
                                className={`rounded-lg border px-3 py-2 ${
                                  isBreakSession(session)
                                    ? 'border-amber-200 bg-amber-50'
                                    : `${style.border} ${style.bg}`
                                }`}
                              >
                                <p className={`text-sm font-semibold ${isBreakSession(session) ? 'text-amber-800' : 'text-slate-900'}`}>
                                  {session.course || session.subject || session.title || 'Class'}
                                </p>
                                {!isBreakSession(session) && (
                                  <p className={`text-xs mt-1 ${style.text}`}>
                                    {session.instructor || session.teacher || 'TBA'}
                                    {(session.room || session.location) ? ` | ${session.room || session.location}` : ''}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400 text-center">
                                --
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RoutineView;
