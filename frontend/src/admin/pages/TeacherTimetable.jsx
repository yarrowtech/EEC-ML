import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Clock, Users, MapPin, Filter, Download,
  Plus, Edit3, Trash2, X, ChevronLeft, ChevronRight, User,
} from 'lucide-react';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { academicApi, timetableApi, convertTo12Hour } from '../utils/timetableApi';

/* ─────────────────────────────────────────
   Design tokens  –  clean / minimal system
───────────────────────────────────────── */
const T = {
  bg:           '#fafaf9',
  surface:      '#ffffff',
  border:       '#e7e5e4',
  borderSubtle: '#f5f5f4',
  accent:       '#3b5bdb',
  accentSoft:   '#eef2ff',
  text:         '#1c1917',
  textMuted:    '#78716c',
  textSubtle:   '#a8a29e',
  danger:       '#dc2626',
};

const STRIPS = [
  { bar:'#3b5bdb', bg:'#f5f7ff', label:'#1e3a8a' },
  { bar:'#0d9488', bg:'#f0fdfa', label:'#134e4a' },
  { bar:'#7c3aed', bg:'#faf5ff', label:'#4c1d95' },
  { bar:'#b45309', bg:'#fffbeb', label:'#78350f' },
  { bar:'#be185d', bg:'#fdf2f8', label:'#831843' },
  { bar:'#059669', bg:'#f0fdf4', label:'#064e3b' },
  { bar:'#0369a1', bg:'#f0f9ff', label:'#0c4a6e' },
  { bar:'#9333ea', bg:'#fdf4ff', label:'#581c87' },
];
const stripMap = {};
let stripIdx = 0;
const getStrip = (subject = '') => {
  const k = subject.toLowerCase();
  if (!stripMap[k]) { stripMap[k] = STRIPS[stripIdx % STRIPS.length]; stripIdx++; }
  return stripMap[k];
};

const toMins = (v) => { if (!v) return 0; const [h, m] = v.split(':').map(Number); return h * 60 + (m || 0); };

const formatRoomLabel = (roomObj, fallback = '') => {
  if (roomObj && typeof roomObj === 'object' && roomObj.roomNumber) {
    const building = roomObj.floorId?.buildingId?.name;
    const floor = roomObj.floorId?.name;
    return [building, floor, roomObj.roomNumber].filter(Boolean).join(' / ');
  }
  return fallback || '';
};

/* ── shared atoms ── */
const Divider = () => <div style={{ height: 1, background: T.border }} />;

const Tag = ({ children, color = T.accentSoft, textColor = T.accent }) => (
  <span style={{
    display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '.4px',
    textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4,
    background: color, color: textColor,
  }}>{children}</span>
);

const IconBtn = ({ icon, onClick, danger, disabled = false }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: 'none', border: 'none', borderRadius: 5,
    padding: 5, color: danger ? T.danger : T.textMuted,
    opacity: disabled ? 0.45 : 1,
    display: 'flex', alignItems: 'center', transition: 'background .1s',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }}
    onMouseEnter={(e) => e.currentTarget.style.background = T.borderSubtle}
    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
  >
    {React.createElement(icon, { size: 13 })}
  </button>
);

const Row = ({ icon, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.textMuted }}>
    {React.createElement(icon, { size: 10, style: { flexShrink: 0 } })}
    <span>{label}</span>
  </div>
);

const EntryRow = ({ ci, isDeleting, onEdit, onDelete, showMeta }) => (
  <div style={{
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9,
    padding: '10px 14px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12,
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 14, fontWeight: 700, color: T.text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{ci.subject}</div>
      {showMeta && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
          <Row icon={Users} label={`${ci.className}${ci.sectionName ? `-${ci.sectionName}` : ''}` || 'N/A'} />
          <Row icon={MapPin} label={ci.room || 'N/A'} />
        </div>
      )}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>
        <Clock size={13} style={{ flexShrink: 0 }} />
        {ci.slot}
      </span>
      <button
        type="button"
        onClick={onEdit}
        disabled={isDeleting}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          border: `1.5px solid #bfdbfe`, background: T.surface, color: T.accent,
          opacity: isDeleting ? 0.5 : 1, cursor: isDeleting ? 'not-allowed' : 'pointer',
        }}
      >
        <Edit3 size={14} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          border: `1.5px solid #fecaca`, background: '#fef2f2', color: T.danger,
          opacity: isDeleting ? 0.5 : 1, cursor: isDeleting ? 'not-allowed' : 'pointer',
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  </div>
);

/* ════════════════════════════════════════
   COMPONENT
════════════════════════════════════════ */
const TeacherTimetable = ({ setShowAdminHeader }) => {
  useEffect(() => { setShowAdminHeader(true); }, [setShowAdminHeader]);

  const [selectedTeacher, setSelectedTeacher] = useState('all');
  const [selectedYearId, setSelectedYearId]   = useState('');
  const [currentWeek, setCurrentWeek]         = useState(new Date());
  const [modalOpen, setModalOpen]             = useState(false);
  const [modalTeacher, setModalTeacher]       = useState(null);
  const [slotModalOpen, setSlotModalOpen]     = useState(false);
  const [slotModalData, setSlotModalData]     = useState(null);
  const [entryModalOpen, setEntryModalOpen]   = useState(false);
  const [entryModalData, setEntryModalData]   = useState(null);
  const [dayModalOpen, setDayModalOpen]       = useState(false);
  const [dayModalDay, setDayModalDay]         = useState(null);
  const [entryForm, setEntryForm]             = useState({
    subjectId: '',
    teacherId: '',
    roomId: '',
    startTime: '',
    endTime: '',
  });
  const [entrySaving, setEntrySaving]         = useState(false);
  const [entryDeletingKey, setEntryDeletingKey] = useState('');
  const [years, setYears]                     = useState([]);
  const [teachers, setTeachers]               = useState([]);
  const [subjects, setSubjects]               = useState([]);
  const [rooms, setRooms]                     = useState([]);
  const [timetables, setTimetables]           = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState(null);
  const [exportingPdf, setExportingPdf]       = useState(false);
  const [schoolBrand, setSchoolBrand]         = useState({ name: 'Electronic Educare', logo: '' });

  const DEFAULT_TIME_SLOTS = [
    { key: '08:00-08:45',  label: '8:00 – 8:45 AM'     },
    { key: '08:45-09:30',  label: '8:45 – 9:30 AM'     },
    { key: '09:30-10:15',  label: '9:30 – 10:15 AM'    },
    { key: '10:15-10:45',  label: '10:15 – 10:45 AM'   },
    { key: '10:45-11:30',  label: '10:45 – 11:30 AM'   },
    { key: '11:30-12:15',  label: '11:30 AM – 12:15 PM' },
  ];
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const activeYear = useMemo(
    () => years.find((year) => year?.isActive) || null,
    [years]
  );

  const yearFilteredTimetables = useMemo(() => {
    if (!selectedYearId) return timetables;
    return (Array.isArray(timetables) ? timetables : []).filter(
      (tt) => String(tt?.classId?.academicYearId || '') === String(selectedYearId)
    );
  }, [timetables, selectedYearId]);

  const timeSlots = useMemo(() => {
    const slots = new Map();
    yearFilteredTimetables.forEach((tt) => {
      (tt.entries || []).forEach((entry) => {
        if (!entry.startTime || !entry.endTime) return;
        const key = `${entry.startTime}-${entry.endTime}`;
        if (!slots.has(key)) slots.set(key, {
          key, startTime: entry.startTime, endTime: entry.endTime,
          label: `${convertTo12Hour(entry.startTime)} – ${convertTo12Hour(entry.endTime)}`,
        });
      });
    });
    if (slots.size === 0) return DEFAULT_TIME_SLOTS;
    return Array.from(slots.values()).sort((a, b) => {
      const d = toMins(a.startTime) - toMins(b.startTime);
      return d !== 0 ? d : toMins(a.endTime) - toMins(b.endTime);
    });
  }, [yearFilteredTimetables]);

  const slotLabelByKey = useMemo(() => {
    const m = new Map(); timeSlots.forEach((s) => m.set(s.key, s.label)); return m;
  }, [timeSlots]);

  const routineData = useMemo(() => {
    const data = {};
    weekDays.forEach((d) => { data[d] = {}; });
    yearFilteredTimetables.forEach((tt) => {
      const className = tt.classId?.name || ''; const sectionName = tt.sectionId?.name || '';
      (tt.entries || []).forEach((entry) => {
        if (!entry.dayOfWeek || !entry.startTime || !entry.endTime) return;
        const day = entry.dayOfWeek; if (!data[day]) data[day] = {};
        const key = `${entry.startTime}-${entry.endTime}`;
        if (!data[day][key]) data[day][key] = [];
        data[day][key].push({
          teacher: entry.teacherId?.name || 'TBA',
          teacherId: entry.teacherId?._id || entry.teacherId || null,
          subject: entry.subjectId?.name || 'Unknown',
          className, sectionName, room: formatRoomLabel(entry.roomId, entry.room),
        });
      });
    });
    return data;
  }, [yearFilteredTimetables]);

  const loadData = async () => {
    try {
      setLoading(true); setError(null);
      const [yd, td, sd, rd, ttd] = await Promise.all([
        academicApi.getYears().catch(() => []),
        academicApi.getTeachers().catch(() => []),
        academicApi.getSubjects().catch(() => []),
        academicApi.getRooms().catch(() => []),
        timetableApi.getAll().catch(() => []),
      ]);
      const yearItems = Array.isArray(yd) ? yd : [];
      setYears(yearItems);
      const preferredYear = yearItems.find((year) => year?.isActive) || yearItems[0] || null;
      const currentYearStillValid = yearItems.some((year) => String(year._id) === String(selectedYearId));
      if (!currentYearStillValid && preferredYear?._id) {
        setSelectedYearId(String(preferredYear._id));
      }
      setTeachers(Array.isArray(td) ? td : []);
      setSubjects(Array.isArray(sd) ? sd : []);
      setRooms(Array.isArray(rd) ? rd : []);
      setTimetables(Array.isArray(ttd) ? ttd : []);
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!years.length) return;
    const hasSelected = years.some((year) => String(year._id) === String(selectedYearId));
    if (!hasSelected) {
      const preferredYear = years.find((year) => year?.isActive) || years[0];
      if (preferredYear?._id) setSelectedYearId(String(preferredYear._id));
    }
  }, [years, selectedYearId]);

  const resolveLogoUrl = (logo) => {
    if (!logo) return '';
    if (typeof logo === 'string') return logo;
    if (typeof logo === 'object') return logo.secure_url || logo.url || logo.path || '';
    return '';
  };
  const loadSchoolBrand = async () => {
    const token = localStorage.getItem('token'); if (!token) return;
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/auth/profile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const profile = await r.json();
      let name = profile?.schoolName || '', logo = profile?.schoolLogo || profile?.logo || '';
      if (profile?.role === 'admin') {
        const sr = await fetch(`${import.meta.env.VITE_API_URL}/api/schools`, { headers: { authorization: `Bearer ${token}` } });
        if (sr.ok) {
          const list = await sr.json(); const schools = Array.isArray(list) ? list : [];
          const m = schools.find((s) => String(s?._id) === String(profile?.schoolId)) || schools[0];
          if (m) { name = m.name || name; logo = resolveLogoUrl(m.logo) || logo; }
        }
      }
      setSchoolBrand({ name: name || 'Electronic Educare', logo: logo || '' });
    } catch (error) {
      console.warn('Failed to load school brand', error);
    }
  };
  useEffect(() => { loadSchoolBrand(); }, []);

  const getFilteredData = () => {
    if (selectedTeacher === 'all') return routineData;
    const f = {};
    Object.keys(routineData).forEach((day) => {
      f[day] = {};
      Object.entries(routineData[day]).forEach(([time, entries]) => {
        const m = (entries || []).filter((e) => String(e.teacherId) === String(selectedTeacher));
        if (m.length > 0) f[day][time] = m;
      });
    });
    return f;
  };

  const getTeacherSchedule = (teacherId) => {
    const s = {};
    weekDays.forEach((day) => {
      s[day] = [];
      yearFilteredTimetables.forEach((tt) => {
        const className = tt.classId?.name || '';
        const sectionName = tt.sectionId?.name || '';
        const classId = tt.classId?._id || tt.classId || '';
        const sectionId = tt.sectionId?._id || tt.sectionId || '';
        const academicYearId = tt.academicYearId?._id || tt.academicYearId || tt.classId?.academicYearId || selectedYearId || '';
        (tt.entries || []).forEach((entry, entryIndex) => {
          const entryTeacherId = entry.teacherId?._id || entry.teacherId || '';
          if (String(entryTeacherId) !== String(teacherId)) return;
          if (String(entry.dayOfWeek || '') !== String(day)) return;
          const subjectId = entry.subjectId?._id || entry.subjectId || '';
          const roomId = entry.roomId?._id || entry.roomId || '';
          const slotKey = `${entry.startTime || ''}-${entry.endTime || ''}`;
          s[day].push({
            timetableId: tt._id,
            entryIndex,
            dayOfWeek: entry.dayOfWeek || day,
            period: entry.period || '',
            startTime: entry.startTime || '',
            endTime: entry.endTime || '',
            slot: slotLabelByKey.get(slotKey) || (entry.startTime && entry.endTime ? `${convertTo12Hour(entry.startTime)} – ${convertTo12Hour(entry.endTime)}` : '-'),
            teacherId: entryTeacherId,
            teacher: entry.teacherId?.name || 'TBA',
            subjectId,
            subject: entry.subjectId?.name || 'Unknown',
            classId,
            sectionId,
            academicYearId,
            className,
            sectionName,
            roomId,
            room: formatRoomLabel(entry.roomId, entry.room),
          });
        });
      });
    });
    return s;
  };

  const timetableData = useMemo(() => getFilteredData(), [routineData, selectedTeacher]);

  const getWeekDates = () => {
    const s = new Date(currentWeek); const d = s.getDay(); s.setDate(s.getDate() - d + (d === 0 ? -6 : 1));
    return weekDays.map((_, i) => { const dt = new Date(s); dt.setDate(s.getDate() + i); return dt; });
  };
  const navigateWeek = (dir) => {
    const nw = new Date(currentWeek); nw.setDate(currentWeek.getDate() + (dir === 'next' ? 7 : -7)); setCurrentWeek(nw);
  };

  const openModal  = (t) => { setModalTeacher(t); setModalOpen(true); };
  const closeModal = () => {
    setModalOpen(false);
    setModalTeacher(null);
    setSlotModalOpen(false);
    setSlotModalData(null);
    closeDayModal();
    closeEntryEditor();
  };
  const openSlotModal = (day, slot, entries) => {
    setSlotModalData({ day, slot, entries: Array.isArray(entries) ? entries : [] });
    setSlotModalOpen(true);
  };
  const closeSlotModal = () => {
    setSlotModalOpen(false);
    setSlotModalData(null);
  };
  const openDayModal = (day) => { setDayModalDay(day); setDayModalOpen(true); };
  const closeDayModal = () => {
    setDayModalOpen(false);
    setDayModalDay(null);
  };

  const normalizeId = (value) => String(value?._id || value || '');

  const resolveEntryDefaults = (entry) => {
    const subjectId = normalizeId(entry?.subjectId);
    const teacherId = normalizeId(entry?.teacherId);
    const roomId = normalizeId(entry?.roomId) || rooms.find((room) => String(room?.roomNumber || '').toLowerCase() === String(entry?.room || '').toLowerCase())?._id || '';
    return {
      subjectId,
      teacherId,
      roomId,
      startTime: entry?.startTime || '',
      endTime: entry?.endTime || '',
    };
  };

  const openEntryEditor = (entry) => {
    if (!entry) return;
    setEntryModalData(entry);
    setEntryForm(resolveEntryDefaults(entry));
    setEntryModalOpen(true);
  };

  const closeEntryEditor = () => {
    setEntryModalOpen(false);
    setEntryModalData(null);
    setEntrySaving(false);
  };

  const getTimetableForEntry = (entry) => {
    if (!entry) return null;
    return yearFilteredTimetables.find((tt) => String(tt._id) === String(entry.timetableId))
      || yearFilteredTimetables.find((tt) => String(tt.classId?._id || tt.classId) === String(entry.classId)
        && String(tt.sectionId?._id || tt.sectionId || '') === String(entry.sectionId || ''));
  };

  const buildSavedEntry = (originalEntry) => {
    const selectedRoom = rooms.find((room) => String(room?._id) === String(entryForm.roomId));
    const selectedSubject = subjects.find((subject) => String(subject?._id) === String(entryForm.subjectId));
    const selectedTeacher = teachers.find((teacher) => String(teacher?._id) === String(entryForm.teacherId));
    return {
      ...originalEntry,
      subjectId: entryForm.subjectId || originalEntry.subjectId,
      teacherId: entryForm.teacherId || originalEntry.teacherId,
      roomId: entryForm.roomId || originalEntry.roomId || undefined,
      room: selectedRoom?.roomNumber || originalEntry.room || '',
      startTime: entryForm.startTime || originalEntry.startTime,
      endTime: entryForm.endTime || originalEntry.endTime,
      subject: selectedSubject?.name || originalEntry.subject || '',
      teacher: selectedTeacher?.name || originalEntry.teacher || '',
    };
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!entryModalData) return;

    if (!entryForm.subjectId || !entryForm.teacherId || !entryForm.startTime || !entryForm.endTime) {
      toast.error('Subject, teacher, start time and end time are required');
      return;
    }

    const timetable = getTimetableForEntry(entryModalData);
    if (!timetable) {
      toast.error('Unable to find the timetable for this class');
      return;
    }

    const classId = timetable.classId?._id || timetable.classId;
    const sectionId = timetable.sectionId?._id || timetable.sectionId || undefined;
    const academicYearId = timetable.academicYearId?._id || timetable.academicYearId || timetable.classId?.academicYearId || selectedYearId || undefined;
    const originalEntries = Array.isArray(timetable.entries) ? timetable.entries : [];
    const updatedEntries = originalEntries.map((entry, index) => (
      index === entryModalData.entryIndex ? buildSavedEntry(entry) : entry
    ));

    setEntrySaving(true);
    try {
      await timetableApi.save({
        classId,
        sectionId,
        academicYearId,
        entries: updatedEntries,
      });
      await loadData();
      toast.success('Schedule updated successfully');
      closeEntryEditor();
    } catch (err) {
      toast.error(err.message || 'Failed to update schedule');
    } finally {
      setEntrySaving(false);
    }
  };

  const handleDeleteEntry = async (entry) => {
    if (!entry) return;
    const timetable = getTimetableForEntry(entry);
    if (!timetable) {
      toast.error('Unable to find the timetable for this class');
      return;
    }

    const actionKey = `${entry.timetableId}:${entry.entryIndex}`;
    if (!window.confirm(`Delete ${entry.subject || 'this class'} from ${entry.className || 'this timetable'}?`)) {
      return;
    }

    const originalEntries = Array.isArray(timetable.entries) ? timetable.entries : [];
    const updatedEntries = originalEntries.filter((_, index) => index !== entry.entryIndex);
    setEntryDeletingKey(actionKey);
    try {
      if (updatedEntries.length === 0) {
        await timetableApi.delete(timetable._id);
      } else {
        await timetableApi.save({
          classId: timetable.classId?._id || timetable.classId,
          sectionId: timetable.sectionId?._id || timetable.sectionId || undefined,
          academicYearId: timetable.academicYearId?._id || timetable.academicYearId || timetable.classId?.academicYearId || selectedYearId || undefined,
          entries: updatedEntries,
        });
      }
      await loadData();
      toast.success('Schedule entry deleted');
      if (entryModalOpen && entryModalData && String(entryModalData.timetableId) === String(entry.timetableId) && entryModalData.entryIndex === entry.entryIndex) {
        closeEntryEditor();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete schedule entry');
    } finally {
      setEntryDeletingKey('');
    }
  };

  /* ── PDF (logic unchanged) ── */
  const loadImageAsDataUrl = async (url) => {
    if (!url) return null;
    try {
      const res = await fetch(url); if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const exportTimetableToPDF = async (teacherOverride = selectedTeacher) => {
    setExportingPdf(true);
    try {
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.width; const pageHeight = pdf.internal.pageSize.height;
      const margin = 10; const currentDate = new Date().toLocaleDateString();
      const exportTeacherId = teacherOverride || 'all';
      const logoDataUrl = await loadImageAsDataUrl(schoolBrand.logo);

      const drawHeader = () => {
        pdf.setFillColor(59, 91, 219); pdf.rect(0, 0, pageWidth, 24, 'F');
        if (logoDataUrl) {
          try {
            pdf.addImage(logoDataUrl, 'PNG', margin, 4, 14, 14);
          } catch (error) {
            console.warn('Failed to embed school logo in timetable PDF', error);
          }
        }
        pdf.setTextColor(255, 255, 255); pdf.setFontSize(14); pdf.setFont(undefined, 'bold');
        pdf.text(schoolBrand.name || 'Electronic Educare', logoDataUrl ? 27 : margin, 11);
        pdf.setFontSize(10); pdf.setFont(undefined, 'normal');
        pdf.text('Teacher Timetable Report', logoDataUrl ? 27 : margin, 18);
        pdf.setTextColor(31, 41, 55); pdf.setFontSize(9);
        const fl = exportTeacherId === 'all' ? 'All Teachers' : (teachers.find((t) => String(t._id) === String(exportTeacherId))?.name || 'Teacher');
        const sessionLabel = years.find((year) => String(year._id) === String(selectedYearId))?.name || 'Session';
        pdf.text(`Filter: ${sessionLabel} • ${fl}`, margin, 30);
        pdf.text(`Generated: ${currentDate}`, pageWidth - margin, 30, { align: 'right' });
      };
      const drawFooter = (pn, tp) => {
        pdf.setDrawColor(209, 213, 219); pdf.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);
        pdf.setFontSize(8); pdf.setTextColor(107, 114, 128);
        pdf.text('School Management System', margin, pageHeight - 4);
        pdf.text(`Page ${pn} of ${tp}`, pageWidth - margin, pageHeight - 4, { align: 'right' });
      };

      const tableTop = 36; const tableBottomLimit = pageHeight - 14;
      const timeColWidth = 30; const dayColWidth = (pageWidth - (margin * 2) - timeColWidth) / weekDays.length;

      const drawTableHeader = (yPos) => {
        pdf.setFillColor(238, 242, 255); pdf.setDrawColor(199, 210, 254); pdf.setLineWidth(0.2);
        let x = margin;
        pdf.rect(x, yPos, timeColWidth, 8, 'FD');
        pdf.setFont(undefined, 'bold'); pdf.setFontSize(8); pdf.setTextColor(30, 58, 138);
        pdf.text('Time', x + 2, yPos + 5.5); x += timeColWidth;
        weekDays.forEach((day) => {
          pdf.setFillColor(224, 231, 255); pdf.rect(x, yPos, dayColWidth, 8, 'FD');
          pdf.text(day, x + 2, yPos + 5.5); x += dayColWidth;
        });
      };

      drawHeader(); let y = tableTop; drawTableHeader(y); y += 8;

      timeSlots.forEach((slot, index) => {
        const dayTexts = weekDays.map((day) => {
          const allEntries = timetableData[day]?.[slot.key] || [];
          const entries = exportTeacherId === 'all'
            ? allEntries
            : allEntries.filter((e) => String(e.teacherId) === String(exportTeacherId));
          if (!entries.length) return '-';
          return entries.map((e, i) => {
            const cl = `${e.className || ''}${e.sectionName ? `-${e.sectionName}` : ''}`;
            return `${i + 1}) ${e.subject || '-'} | ${cl || '-'} | ${e.room || 'N/A'} | ${e.teacher || '-'}`;
          }).join('\n');
        });
        const splitDayLines = dayTexts.map((text) => pdf.splitTextToSize(String(text), dayColWidth - 3));
        const timeLines = pdf.splitTextToSize(slot.label, timeColWidth - 3);
        const maxLines = Math.max(timeLines.length, ...splitDayLines.map((l) => l.length));
        const rowHeight = Math.max(9, (maxLines * 3.4) + 2);

        if (y + rowHeight > tableBottomLimit) { pdf.addPage(); drawHeader(); y = tableTop; drawTableHeader(y); y += 8; }

        const isAlt = index % 2 === 0; let x = margin;
        pdf.setDrawColor(199, 210, 254); pdf.setTextColor(17, 24, 39);
        pdf.setFont(undefined, 'normal'); pdf.setFontSize(7.5);
        pdf.setFillColor(238, 242, 255); pdf.rect(x, y, timeColWidth, rowHeight, 'FD');
        pdf.text(timeLines, x + 1.5, y + 4); x += timeColWidth;
        splitDayLines.forEach((lines) => {
          pdf.setFillColor(...(isAlt ? [255, 255, 255] : [248, 250, 252]));
          pdf.rect(x, y, dayColWidth, rowHeight, 'FD'); pdf.text(lines, x + 1.5, y + 4); x += dayColWidth;
        });
        y += rowHeight;
      });

      y += 6;
      const teachersToShow = exportTeacherId === 'all' ? teachers : [teachers.find((t) => String(t._id) === String(exportTeacherId))].filter(Boolean);
      const ensureSpace = (needed = 10) => { if (y + needed > tableBottomLimit) { pdf.addPage(); drawHeader(); y = tableTop; } };

      ensureSpace(10);
      pdf.setFont(undefined, 'bold'); pdf.setFontSize(11); pdf.setTextColor(30, 58, 138);
      pdf.text('Teacher Schedule Summary', margin, y); y += 4.5;

      const summaryCols = [
        { key: 'teacher', label: 'Teacher', width: 48 }, { key: 'day', label: 'Day', width: 20 },
        { key: 'time', label: 'Time', width: 34 }, { key: 'subject', label: 'Subject', width: 62 },
        { key: 'classSection', label: 'Class-Section', width: 68 }, { key: 'room', label: 'Room', width: 45 },
      ];
      const summaryRows = [];
      teachersToShow.forEach((teacher) => {
        const schedule = getTeacherSchedule(teacher._id); let hasClass = false;
        weekDays.forEach((day) => {
          (schedule[day] || []).forEach((ci) => {
            const cl = `${ci.className || ''}${ci.sectionName ? `-${ci.sectionName}` : ''}`;
            summaryRows.push({
              teacher: `${teacher.name}${teacher.subject ? ` (${teacher.subject})` : ''}`,
              day, time: ci.slot || '-', subject: ci.subject || '-', classSection: cl || '-', room: ci.room || 'N/A',
            }); hasClass = true;
          });
        });
        if (!hasClass) summaryRows.push({
          teacher: `${teacher.name}${teacher.subject ? ` (${teacher.subject})` : ''}`,
          day: '-', time: '-', subject: 'No classes assigned', classSection: '-', room: '-',
        });
      });

      const drawSummaryHeader = () => {
        pdf.setDrawColor(203, 213, 225);
        pdf.setTextColor(17, 24, 39);
        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(8);
        let x = margin;
        summaryCols.forEach((col) => {
          pdf.setFillColor(241, 245, 249);
          pdf.rect(x, y, col.width, 8, 'FD');
          pdf.text(col.label, x + 2, y + 5.2);
          x += col.width;
        });
        y += 8;
      };
      const openSummaryPage = () => {
        pdf.addPage(); drawHeader(); y = tableTop;
        pdf.setFont(undefined, 'bold'); pdf.setFontSize(11); pdf.setTextColor(30, 58, 138);
        pdf.text('Teacher Schedule Summary (Continued)', margin, y); y += 4.5;
        drawSummaryHeader();
      };

      ensureSpace(12); drawSummaryHeader();
      summaryRows.forEach((row, rowIndex) => {
        const wrapped = summaryCols.map((col) => pdf.splitTextToSize(String(row[col.key] || '-'), col.width - 3));
        const maxLines = Math.max(...wrapped.map((l) => l.length));
        const rowHeight = Math.max(8, (maxLines * 3.2) + 2);
        if (y + rowHeight > tableBottomLimit) openSummaryPage();
        const isAlt = rowIndex % 2 === 0; let x = margin;
        pdf.setDrawColor(199, 210, 254); pdf.setTextColor(17, 24, 39);
        pdf.setFont(undefined, 'normal'); pdf.setFontSize(7.5);
        wrapped.forEach((lines, idx) => {
          const col = summaryCols[idx];
          pdf.setFillColor(...(isAlt ? [255, 255, 255] : [248, 250, 252]));
          pdf.rect(x, y, col.width, rowHeight, 'FD'); pdf.text(lines, x + 1.5, y + 4); x += col.width;
        });
        y += rowHeight;
      });

      const totalPages = pdf.getNumberOfPages();
      for (let page = 1; page <= totalPages; page++) { pdf.setPage(page); drawFooter(page, totalPages); }
      const suffix = exportTeacherId === 'all' ? 'all-teachers' : (teachers.find((t) => String(t._id) === String(exportTeacherId))?.name || 'teacher').replace(/ /g, '-');
      pdf.save(`teacher-timetable-${suffix}-${currentDate.replace(/\//g, '-')}.pdf`);
    } finally { setExportingPdf(false); }
  };

  /* ── render ── */
  const weekDates = getWeekDates();
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <div style={{ minHeight: '100vh', background: T.bg, padding: '32px 28px', fontFamily: '"DM Sans", "Outfit", system-ui, sans-serif', color: T.text }}>

      {/* PAGE HEADER */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
              <div style={{ width: 3, height: 20, background: T.accent, borderRadius: 2 }} />
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-0.4px' }}>Teacher Timetable</h1>
            </div>
            <p style={{ margin: '0 0 0 13px', fontSize: 13, color: T.textMuted }}>Manage and view weekly teaching schedules</p>
          </div>
          <button
            onClick={() => exportTimetableToPDF(selectedTeacher)}
            disabled={exportingPdf}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 8,
              border: `1.5px solid ${T.border}`, background: T.surface,
              fontSize: 13, fontWeight: 600, color: T.text,
              cursor: exportingPdf ? 'not-allowed' : 'pointer', opacity: exportingPdf ? .55 : 1,
              transition: 'border-color .12s, color .12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.text; }}
          >
            <Download size={14} />
            {exportingPdf ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* CONTROLS */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 16,
        padding: '12px 18px', background: T.surface,
        border: `1px solid ${T.border}`, borderRadius: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={13} color={T.textSubtle} />
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textSubtle, textTransform: 'uppercase', letterSpacing: '.5px' }}>Session</label>
          <div style={{ position: 'relative', marginLeft: 2 }}>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              style={{
                appearance: 'none', padding: '7px 28px 7px 11px',
                border: `1px solid ${T.border}`, borderRadius: 7,
                fontSize: 13, fontWeight: 500, color: T.text, background: T.bg,
                cursor: 'pointer', outline: 'none',
              }}
            >
              {years.map((year) => (
                <option key={year._id} value={year._id}>
                  {year.name}{String(year._id) === String(activeYear?._id || '') ? ' (Active)' : ''}
                </option>
              ))}
            </select>
            <ChevronRight size={11} color={T.textSubtle} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%) rotate(90deg)', pointerEvents: 'none' }} />
          </div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textSubtle, textTransform: 'uppercase', letterSpacing: '.5px' }}>Teacher</label>
          <div style={{ position: 'relative', marginLeft: 2 }}>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              style={{
                appearance: 'none', padding: '7px 28px 7px 11px',
                border: `1px solid ${T.border}`, borderRadius: 7,
                fontSize: 13, fontWeight: 500, color: T.text, background: T.bg,
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="all">All Teachers</option>
              {teachers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
            <ChevronRight size={11} color={T.textSubtle} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%) rotate(90deg)', pointerEvents: 'none' }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => navigateWeek('prev')} style={{
            background: 'none', border: `1px solid ${T.border}`, cursor: 'pointer',
            borderRadius: 7, padding: '5px 8px', color: T.textMuted, display: 'flex',
            alignItems: 'center', transition: 'background .1s',
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = T.borderSubtle}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          ><ChevronLeft size={13} /></button>

          <div style={{ padding: '5px 14px', fontSize: 13, fontWeight: 600, color: T.text, userSelect: 'none' }}>
            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            &ensp;—&ensp;
            {weekDates[weekDays.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>

          <button onClick={() => navigateWeek('next')} style={{
            background: 'none', border: `1px solid ${T.border}`, cursor: 'pointer',
            borderRadius: 7, padding: '5px 8px', color: T.textMuted, display: 'flex',
            alignItems: 'center', transition: 'background .1s',
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = T.borderSubtle}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          ><ChevronRight size={13} /></button>
        </div>
      </div>

      {/* LOADING / ERROR */}
      {loading && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '48px', textAlign: 'center', marginBottom: 16 }}>
          <div style={{ width: 16, height: 16, border: `2px solid ${T.border}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin .65s linear infinite', margin: '0 auto 10px', display: 'inline-block' }} />
          <div style={{ fontSize: 13, color: T.textMuted }}>Loading timetable…</div>
        </div>
      )}
      {!loading && error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 18px', marginBottom: 16, fontSize: 13, color: T.danger }}>
          {error}
        </div>
      )}

      {/* TIMETABLE */}
      {!loading && !error && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
              {selectedTeacher === 'all'
                ? 'All Teachers'
                : (teachers.find((t) => String(t._id) === String(selectedTeacher))?.name || 'Teacher')}
              <span style={{ fontWeight: 400, color: T.textMuted }}>
                {' '}· {years.find((year) => String(year._id) === String(selectedYearId))?.name || 'Session'} · Weekly View
              </span>
            </span>
            <span style={{ fontSize: 11, color: T.textSubtle }}>{timeSlots.length} time slots</span>
          </div>
          <Divider />

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead>
                <tr style={{ background: T.bg }}>
                  <th style={{
                    padding: '10px 16px', textAlign: 'left',
                    fontSize: 10, fontWeight: 700, color: T.textSubtle,
                    textTransform: 'uppercase', letterSpacing: '.5px',
                    borderBottom: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}`,
                    width: 110, minWidth: 110,
                  }}>Time</th>
                  {weekDays.map((day, idx) => {
                    const date = weekDates[idx];
                    const isToday = todayName.toLowerCase() === day.toLowerCase();
                    return (
                      <th key={day} style={{
                        padding: '10px 14px', textAlign: 'left',
                        fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase',
                        color: isToday ? T.accent : T.textSubtle,
                        borderBottom: isToday ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                        borderRight: `1px solid ${T.borderSubtle}`,
                        background: isToday ? T.accentSoft : T.bg,
                        minWidth: 130,
                      }}>
                        <div>{day.slice(0, 3)}</div>
                        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'none', letterSpacing: 0, marginTop: 1, color: isToday ? T.accent : T.textMuted }}>
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot, rowIdx) => (
                  <tr key={slot.key} style={{ background: rowIdx % 2 === 0 ? T.surface : T.bg }}>
                    <td style={{
                      padding: '12px 16px',
                      borderBottom: `1px solid ${T.borderSubtle}`,
                      borderRight: `1px solid ${T.border}`,
                      verticalAlign: 'middle',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.text, whiteSpace: 'nowrap' }}>
                        {slot.label.split('–')[0].trim()}
                      </div>
                      <div style={{ fontSize: 10, color: T.textSubtle, marginTop: 1 }}>
                        {slot.label.split('–')[1]?.trim()}
                      </div>
                    </td>
                    {weekDays.map((day) => {
                      const entries = timetableData[day]?.[slot.key] || [];
                      const first = entries[0];
                      const extra = entries.length > 1 ? entries.length - 1 : 0;
                      const isToday = todayName.toLowerCase() === day.toLowerCase();
                      return (
                        <td key={`${day}-${slot.key}`} style={{
                          padding: '7px 9px',
                          borderBottom: `1px solid ${T.borderSubtle}`,
                          borderRight: `1px solid ${T.borderSubtle}`,
                          verticalAlign: 'top',
                          background: isToday ? `rgba(59,91,219,.02)` : 'transparent',
                        }}>
                          {first ? (() => {
                            const s = getStrip(first.subject);
                            return (
                              <div style={{
                                borderLeft: `2.5px solid ${s.bar}`, background: s.bg,
                                borderRadius: '0 7px 7px 0', padding: '8px 10px',
                                cursor: 'pointer', transition: 'opacity .1s',
                              }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '.78'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                              >
                                <div style={{ fontSize: 11, fontWeight: 700, color: s.label, marginBottom: 5, lineHeight: 1.2 }}>
                                  {first.subject}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  <Row icon={User} label={first.teacher} />
                                  <Row icon={Users} label={`${first.className}${first.sectionName ? `-${first.sectionName}` : ''}`} />
                                  {first.room && <Row icon={MapPin} label={first.room} />}
                                </div>
                                {extra > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => openSlotModal(day, slot, entries)}
                                    style={{
                                      marginTop: 5,
                                      padding: 0,
                                      border: 'none',
                                      background: 'none',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <Tag color={`${s.bar}1a`} textColor={s.label}>+{extra} more</Tag>
                                  </button>
                                )}
                              </div>
                            );
                          })() : (
                            <div style={{
                              minHeight: 54,
                              border: `1.5px solid ${T.borderSubtle}`, borderRadius: 7,
                              background: 'rgba(250, 250, 249, .65)',
                              padding: '10px 8px',
                            }}>
                              <div style={{
                                height: 34,
                                borderRadius: 6,
                                border: `1px dashed ${T.borderSubtle}`,
                                background: 'rgba(255,255,255,.55)',
                              }} />
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
        </div>
      )}

      {/* STATISTICS */}
      {!loading && !error && selectedTeacher === 'all' && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Teacher Statistics</span>
          </div>
          <Divider />
          <div style={{ padding: '18px' }}>
            {/* stat row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Teachers',       value: teachers.length, color: T.accent },
                { label: 'Total Classes',  value: Object.values(timetableData).flatMap((d) => Object.values(d)).reduce((t, e) => t + e.length, 0), color: '#0d9488' },
                { label: 'Unique Classes', value: new Set(Object.values(timetableData).flatMap((d) => Object.values(d)).flatMap((e) => e.map((c) => `${c.className}${c.sectionName ? `-${c.sectionName}` : ''}`)).filter(Boolean)).size, color: '#7c3aed' },
                { label: 'Rooms',          value: new Set(Object.values(timetableData).flatMap((d) => Object.values(d)).flatMap((e) => e.map((c) => c.room)).filter(Boolean)).size, color: '#b45309' },
                { label: 'Subjects',       value: new Set(Object.values(timetableData).flatMap((d) => Object.values(d)).flatMap((e) => e.map((c) => c.subject)).filter(Boolean)).size, color: '#be185d' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  padding: '12px 18px', borderRadius: 9,
                  border: `1px solid ${T.border}`, textAlign: 'center', minWidth: 88,
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3, fontWeight: 500 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* teacher cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
              {teachers.map((teacher) => {
                const classes = Object.values(timetableData)
                  .flatMap((d) => Object.values(d))
                  .flatMap((e) => e.filter((c) => String(c.teacherId) === String(teacher._id)));
                const unique = new Set(classes.map((c) => `${c.className}${c.sectionName ? `-${c.sectionName}` : ''}`)).size;

                return (
                  <div key={teacher._id} style={{
                    padding: '14px', borderRadius: 9,
                    border: `1px solid ${T.border}`, transition: 'border-color .1s',
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = T.accent}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = T.border}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 7, background: T.accentSoft,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <User size={15} color={T.accent} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{teacher.name}</div>
                        {teacher.subject && <div style={{ fontSize: 11, color: T.textMuted }}>{teacher.subject}</div>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
                      {[
                        { val: classes.length, label: 'Classes/wk', color: T.accent },
                        { val: unique,         label: 'Unique',     color: '#7c3aed' },
                      ].map(({ val, label, color }) => (
                        <div key={label} style={{
                          flex: 1, padding: '7px 8px', background: T.bg, borderRadius: 7,
                          border: `1px solid ${T.borderSubtle}`, textAlign: 'center',
                        }}>
                          <div style={{ fontSize: 17, fontWeight: 800, color }}>{val}</div>
                          <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 500, marginTop: 1 }}>{label}</div>
                        </div>
                      ))}
                    </div>

                    <button onClick={() => openModal(teacher)} style={{
                      width: '100%', padding: '7px', borderRadius: 7,
                      border: `1.5px solid ${T.accent}`, background: 'none',
                      color: T.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      transition: 'all .1s',
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = T.accent; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = T.accent; }}
                    >View Schedule</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      {modalOpen && modalTeacher && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(28,25,23,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, padding: 12,
        }}>
          <div style={{
            background: T.surface, borderRadius: 12, width: 'min(920px, calc(100vw - 24px))',
            maxHeight: 'calc(100vh - 24px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            border: `1px solid ${T.border}`, boxShadow: '0 16px 48px rgba(0,0,0,.12)',
          }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <div style={{ width: 3, height: 16, background: T.accent, borderRadius: 2 }} />
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>{modalTeacher.name}</h2>
                </div>
                <p style={{ margin: '0 0 0 11px', fontSize: 12, color: T.textMuted }}>
                  {modalTeacher.subject || ''} — Weekly Schedule
                </p>
              </div>
              <button onClick={closeModal} style={{
                background: 'none', border: `1px solid ${T.border}`, cursor: 'pointer',
                borderRadius: 6, padding: '5px 6px', color: T.textMuted, display: 'flex', transition: 'all .1s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.danger; e.currentTarget.style.color = T.danger; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {weekDays.map((day) => {
                const sched = getTeacherSchedule(modalTeacher._id)[day];
                const isToday = todayName.toLowerCase() === day.toLowerCase();
                return (
                  <div key={day} style={{
                    border: `1px solid ${isToday ? '#c7d2fe' : T.border}`, borderRadius: 10, overflow: 'hidden',
                    background: isToday ? T.accentSoft : T.surface,
                    display: 'flex', alignItems: 'stretch',
                  }}>
                    <div style={{
                      width: 132, flexShrink: 0, padding: '14px 16px', backgroundColor: '#F2F2F2',
                      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6,
                      borderRight: `1px solid ${isToday ? '#c7d2fe' : T.border}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{day}</span>
                        {isToday && <Tag>Today</Tag>}
                      </div>
                      <Tag>{sched.length} class{sched.length !== 1 ? 'es' : ''}</Tag>
                    </div>
                    {sched.length === 0 ? (
                      <div style={{ flex: 1, minWidth: 0, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8, color: T.textSubtle }}>
                        <Calendar size={16} style={{ opacity: .5, flexShrink: 0 }} />
                        <span style={{ fontSize: 13 }}>No classes scheduled</span>
                      </div>
                    ) : (
                      <div style={{minWidth: 'full', padding: '9px 11px', display: 'flex', flexDirection: 'row', justifyContent: 'between', alignItems: 'center', gap: 6 }}>
                        {(() => {
                          const first = sched[0];
                          const entryKey = `${first.timetableId}:${first.entryIndex}`;
                          const isDeleting = entryDeletingKey === entryKey;
                          return (
                            <EntryRow
                              ci={first}
                              isDeleting={isDeleting}
                              onEdit={() => openEntryEditor(first)}
                              onDelete={() => handleDeleteEntry(first)}
                            />
                          );
                        })()}
                        {sched.length > 1 && (
                          <button
                            type="button"
                            onClick={() => openDayModal(day)}
                            style={{
                              alignSelf: 'flex-start', padding: '4px 10px', borderRadius: 6,
                              border: `1px solid ${T.border}`, background: T.surface, color: T.accent,
                              fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            +{sched.length - 1} more
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.border}`, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 12, color: T.textMuted }}>
                <strong style={{ color: T.text }}>{Object.values(getTeacherSchedule(modalTeacher._id)).flat().length}</strong> total weekly classes
              </span>
              <div style={{ display: 'flex', gap: 7 }}>
                <button
                  onClick={() => exportTimetableToPDF(modalTeacher?._id || 'all')}
                  style={{
                    padding: '7px 14px', borderRadius: 7,
                    border: `1.5px solid ${T.border}`, background: T.surface,
                    color: T.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.text; }}
                >Export</button>
                <button
                  onClick={closeModal}
                  style={{
                    padding: '7px 18px', borderRadius: 7, border: 'none',
                    background: T.accent, color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'opacity .1s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ENTRY EDIT MODAL */}
      {entryModalOpen && entryModalData && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(28,25,23,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 70, padding: 12,
        }}>
          <form onSubmit={handleSaveEntry} style={{
            background: T.surface, borderRadius: 12, width: 'min(640px, calc(100vw - 24px))',
            maxHeight: 'calc(100vh - 24px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            border: `1px solid ${T.border}`, boxShadow: '0 20px 60px rgba(0,0,0,.18)',
          }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                  <div style={{ width: 3, height: 16, background: T.accent, borderRadius: 2 }} />
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>
                    Edit Schedule Entry
                  </h2>
                  <Tag>{entryModalData.dayOfWeek || 'Day'}</Tag>
                </div>
                <p style={{ margin: '0 0 0 11px', fontSize: 12, color: T.textMuted }}>
                  {entryModalData.className || 'Class'}{entryModalData.sectionName ? `-${entryModalData.sectionName}` : ''} · {entryModalData.slot || 'Selected slot'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEntryEditor}
                style={{
                  background: 'none', border: `1px solid ${T.border}`, cursor: 'pointer',
                  borderRadius: 6, padding: '5px 6px', color: T.textMuted, display: 'flex', transition: 'all .1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.danger; e.currentTarget.style.color = T.danger; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'grid', gap: 14 }}>
              {[
                {
                  label: 'Subject',
                  value: entryForm.subjectId,
                  onChange: (value) => setEntryForm((prev) => ({ ...prev, subjectId: value })),
                  options: (subjects || []).filter((subject) => {
                    const subjectClassId = subject?.classId?._id || subject?.classId || '';
                    return !entryModalData.classId || !subjectClassId || String(subjectClassId) === String(entryModalData.classId);
                  }),
                  optionLabel: (subject) => subject?.code ? `${subject.name} (${subject.code})` : subject?.name || 'Subject',
                },
                {
                  label: 'Teacher',
                  value: entryForm.teacherId,
                  onChange: (value) => setEntryForm((prev) => ({ ...prev, teacherId: value })),
                  options: teachers,
                  optionLabel: (teacher) => teacher?.name || 'Teacher',
                },
                {
                  label: 'Room',
                  value: entryForm.roomId,
                  onChange: (value) => setEntryForm((prev) => ({ ...prev, roomId: value })),
                  options: rooms,
                  optionLabel: (room) => {
                    const building = room?.floorId?.buildingId?.name || 'Bldg';
                    const floor = room?.floorId?.name || 'Floor';
                    const number = room?.roomNumber || room?.name || 'Room';
                    return `${building} / ${floor} / ${number}`;
                  },
                  allowEmpty: true,
                },
              ].map((field) => (
                <label key={field.label} style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textSubtle, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    {field.label}
                  </span>
                  <select
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    style={{
                      appearance: 'none',
                      padding: '10px 12px',
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      fontSize: 13,
                      color: T.text,
                      background: T.bg,
                      outline: 'none',
                    }}
                  >
                    {field.allowEmpty ? (
                      <option value="">No room</option>
                    ) : (
                      <option value="" disabled>{`Select ${field.label.toLowerCase()}`}</option>
                    )}
                    {Array.isArray(field.options) && field.options.map((item) => (
                      <option key={item._id} value={item._id}>
                        {field.optionLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textSubtle, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    Start Time
                  </span>
                  <input
                    type="time"
                    value={entryForm.startTime}
                    onChange={(e) => setEntryForm((prev) => ({ ...prev, startTime: e.target.value }))}
                    style={{
                      padding: '10px 12px',
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      fontSize: 13,
                      color: T.text,
                      background: T.bg,
                      outline: 'none',
                    }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textSubtle, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    End Time
                  </span>
                  <input
                    type="time"
                    value={entryForm.endTime}
                    onChange={(e) => setEntryForm((prev) => ({ ...prev, endTime: e.target.value }))}
                    style={{
                      padding: '10px 12px',
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      fontSize: 13,
                      color: T.text,
                      background: T.bg,
                      outline: 'none',
                    }}
                  />
                </label>
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.border}`, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: T.textMuted }}>
                Changes apply to the full timetable record for this class
              </span>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={closeEntryEditor}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 7,
                    border: `1.5px solid ${T.border}`,
                    background: T.surface,
                    color: T.text,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={entrySaving}
                  style={{
                    padding: '7px 18px',
                    borderRadius: 7,
                    border: 'none',
                    background: T.accent,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: entrySaving ? 'not-allowed' : 'pointer',
                    opacity: entrySaving ? 0.75 : 1,
                  }}
                >
                  {entrySaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* DAY CLASSES MODAL */}
      {dayModalOpen && dayModalDay && modalTeacher && (() => {
        const dayEntries = getTeacherSchedule(modalTeacher._id)[dayModalDay] || [];
        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(28,25,23,.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 65, padding: 12,
          }}>
            <div style={{
              background: T.surface, borderRadius: 12, width: 'min(640px, calc(100vw - 24px))',
              maxHeight: 'calc(100vh - 24px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
              border: `1px solid ${T.border}`, boxShadow: '0 16px 48px rgba(0,0,0,.12)',
            }}>
              <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                    <div style={{ width: 3, height: 16, background: T.accent, borderRadius: 2 }} />
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>
                      {dayModalDay}'s Classes
                    </h2>
                    <Tag>{dayEntries.length} class{dayEntries.length !== 1 ? 'es' : ''}</Tag>
                  </div>
                  <p style={{ margin: '0 0 0 11px', fontSize: 12, color: T.textMuted }}>
                    {modalTeacher.name}
                  </p>
                </div>
                <button onClick={closeDayModal} style={{
                  background: 'none', border: `1px solid ${T.border}`, cursor: 'pointer',
                  borderRadius: 6, padding: '5px 6px', color: T.textMuted, display: 'flex', transition: 'all .1s',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.danger; e.currentTarget.style.color = T.danger; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; }}
                >
                  <X size={14} />
                </button>
              </div>

              <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dayEntries.map((ci) => {
                  const entryKey = `${ci.timetableId}:${ci.entryIndex}`;
                  const isDeleting = entryDeletingKey === entryKey;
                  return (
                    <EntryRow
                      key={entryKey}
                      ci={ci}
                      isDeleting={isDeleting}
                      showMeta
                      onEdit={() => openEntryEditor(ci)}
                      onDelete={() => handleDeleteEntry(ci)}
                    />
                  );
                })}
              </div>

              <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.border}`, background: T.bg, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={closeDayModal}
                  style={{
                    padding: '7px 18px', borderRadius: 7, border: 'none',
                    background: T.accent, color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'opacity .1s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SLOT DETAIL MODAL */}
      {slotModalOpen && slotModalData && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(28,25,23,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 60, padding: 12,
        }}>
          <div style={{
            background: T.surface, borderRadius: 12, width: 'min(760px, calc(100vw - 24px))',
            maxHeight: 'calc(100vh - 24px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            border: `1px solid ${T.border}`, boxShadow: '0 16px 48px rgba(0,0,0,.12)',
          }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                  <div style={{ width: 3, height: 16, background: T.accent, borderRadius: 2 }} />
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>
                    Classes in this time slot
                  </h2>
                  <Tag>{slotModalData.day}</Tag>
                </div>
                <p style={{ margin: '0 0 0 11px', fontSize: 12, color: T.textMuted }}>
                  {slotModalData.slot?.label || 'Selected slot'} · {slotModalData.entries.length} class{slotModalData.entries.length !== 1 ? 'es' : ''}
                </p>
              </div>
              <button onClick={closeSlotModal} style={{
                background: 'none', border: `1px solid ${T.border}`, cursor: 'pointer',
                borderRadius: 6, padding: '5px 6px', color: T.textMuted, display: 'flex', transition: 'all .1s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.danger; e.currentTarget.style.color = T.danger; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
              {slotModalData.entries.length === 0 ? (
                <div style={{ padding: '28px 14px', textAlign: 'center', color: T.textSubtle }}>
                  <Clock size={18} style={{ display: 'block', margin: '0 auto 6px', opacity: .35 }} />
                  <span style={{ fontSize: 12 }}>No classes found for this slot</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {slotModalData.entries.map((entry, idx) => {
                    const s = getStrip(entry.subject);
                    const classLabel = `${entry.className || ''}${entry.sectionName ? `-${entry.sectionName}` : ''}` || 'N/A';
                    return (
                      <div key={`${entry.teacherId || entry.teacher || 'entry'}-${idx}`} style={{
                        borderLeft: `2.5px solid ${s.bar}`, background: s.bg,
                        borderRadius: '0 8px 8px 0', padding: '10px 12px',
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: s.label, lineHeight: 1.2 }}>
                              {entry.subject}
                            </span>
                            <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: 'nowrap' }}>
                              {idx === 0 ? 'Shown on card' : `Hidden class ${idx}`}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            <Row icon={User} label={entry.teacher} />
                            <Row icon={Users} label={classLabel} />
                            <Row icon={Clock} label={slotModalData.slot?.label || '-'} />
                            {entry.room && <Row icon={MapPin} label={entry.room} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.border}`, background: T.bg, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={closeSlotModal}
                style={{
                  padding: '7px 18px', borderRadius: 7, border: 'none',
                  background: T.accent, color: '#fff', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'opacity .1s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};

export default TeacherTimetable;
