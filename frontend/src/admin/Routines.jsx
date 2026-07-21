import React, { useState, useEffect, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import Swal from 'sweetalert2';
import {
  Plus, Edit2, Trash2, Clock, Calendar, ChevronLeft, ChevronRight,
  Grid, Loader2, AlertCircle, Sparkles, Download, BookOpen,
  Users, CheckCircle2, XCircle, X, Save, Copy, RotateCcw,
  ChevronDown, Layers, ArrowRight, Search
} from 'lucide-react';
import {
  timetableApi, academicApi, transformTimetablesToRoutines,
  convertTo24Hour, convertTo12Hour
} from './utils/timetableApi';

/* ─────────────────────── constants ─────────────────────── */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };

const TIMES = [
  '8:00 AM - 8:45 AM',
  '8:45 AM - 9:30 AM',
  '9:30 AM - 10:15 AM',
  '10:15 AM - 10:45 AM',
  '10:45 AM - 11:30 AM',
  '11:30 AM - 12:15 PM',
];
const DEFAULT_BREAK_TIMES = ['10:15 AM - 10:45 AM'];
const DEFAULT_START_TIME = '08:00';
const DEFAULT_PERIOD_MINUTES = 45;

const ROUTINE_TEMPLATES = [
  { id: 'balanced', name: 'Balanced', pattern: ['Mathematics', 'English', 'Science', 'Social Science', 'Computer', 'Hindi'] },
  { id: 'stem',     name: 'STEM',     pattern: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer', 'Mathematics'] },
  { id: 'revision', name: 'Revision', pattern: ['English', 'Mathematics', 'Science', 'Social Science', 'Computer', 'English'] },
];

const TEACHERS = {
  Mathematics: 'Dr. Rakesh Sharma', Physics: 'Prof. Priya Verma', Chemistry: 'Mr. Arjun Singh',
  Biology: 'Dr. Kavita Rao', English: 'Ms. Anjali Mehra', 'Social Science': 'Mr. Suresh Patel',
  Science: 'Dr. Kavita Rao', Hindi: 'Mr. Rohan Gupta', Computer: 'Ms. Nidhi Kapoor',
};

/* ─────────────────────── helpers ─────────────────────── */
const getId = (v) => (v && typeof v === 'object' ? v._id : v);

const addMinutesToTime = (time24, minutes) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '';
  const t = ((h * 60 + m + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const parseTimeRange = (range) => {
  if (!range || typeof range !== 'string') return { start: '', end: '' };
  const [s, e] = range.split('-').map(p => p.trim());
  return { start: s ? convertTo24Hour(s) : '', end: e ? convertTo24Hour(e) : '' };
};

const formatTimeRange = (s24, e24) => (!s24 || !e24) ? '' : `${convertTo12Hour(s24)} - ${convertTo12Hour(e24)}`;

const isBreakSlot = (time) => DEFAULT_BREAK_TIMES.includes(time);

const normalizeDayLabel = (v = '') => {
  const raw = String(v).trim().toLowerCase();
  const map = { mon:'Monday',monday:'Monday',tue:'Tuesday',tues:'Tuesday',tuesday:'Tuesday',wed:'Wednesday',wednesday:'Wednesday',thu:'Thursday',thur:'Thursday',thurs:'Thursday',thursday:'Thursday',fri:'Friday',friday:'Friday',sat:'Saturday',saturday:'Saturday',sun:'Sunday',sunday:'Sunday' };
  return map[raw] || String(v).trim();
};

const getDefaultSlots = () =>
  TIMES.map(time => {
    const p = parseTimeRange(time);
    return { time, startTime: p.start, endTime: p.end, isBreak: DEFAULT_BREAK_TIMES.includes(time), subject: DEFAULT_BREAK_TIMES.includes(time) ? 'Break' : '', teacher: DEFAULT_BREAK_TIMES.includes(time) ? '-' : '', subjectId: null, teacherId: null, roomId: null, room: '' };
  });

const buildScheduleForDay = (existing = []) => {
  if (Array.isArray(existing) && existing.length > 0) {
    const norm = existing.map(e => {
      const p = parseTimeRange(e.time); const isBreak = Boolean(e.isBreak) || e.subject === 'Break';
      const st = e.startTime || p.start || ''; const et = e.endTime || p.end || '';
      return { time: e.time || formatTimeRange(st, et), startTime: st, endTime: et, isBreak, subject: isBreak ? 'Break' : (e.subject||''), teacher: isBreak ? '-' : (e.teacher||''), subjectId: e.subjectId||null, teacherId: e.teacherId||null, roomId: e.roomId||null, room: e.room||'' };
    });
    // Only fall back to the default break slot when this day has no break
    // of its own yet — once a custom break is saved, it must not be
    // silently re-added alongside it.
    const hasBreak = norm.some(e => e.isBreak);
    const missing = hasBreak ? [] : getDefaultSlots().filter(s => s.isBreak);
    return [...norm, ...missing].sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
  }
  return getDefaultSlots();
};

const pruneEmptySlots = (schedule = []) =>
  schedule.filter(s => s?.isBreak || (String(s?.subject||'').trim() && String(s?.teacher||'').trim()));

/* ─────────────────────── sub-components ─────────────────────── */

const Toast = ({ show, message, type }) => {
  if (!show) return null;
  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium transition-all ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      {message}
    </div>
  );
};

const DayCard = ({ day, routine, onEdit, isSelected, onClick }) => {
  const periods = routine?.schedule?.filter(s => !s.isBreak && s.subject) || [];
  const hasData = periods.length > 0;
  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl border-2 cursor-pointer transition-all duration-200 overflow-hidden group ${isSelected ? 'border-indigo-500 shadow-lg shadow-indigo-100' : 'border-gray-100 hover:border-indigo-200 hover:shadow-md'} bg-white`}
    >
      {/* color strip */}
      <div className={`h-1.5 w-full ${hasData ? 'bg-gradient-to-r from-indigo-400 to-violet-400' : 'bg-gray-100'}`} />

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-bold text-gray-900 text-sm">{day}</p>
            <p className="text-xs text-gray-400">{periods.length} period{periods.length !== 1 ? 's' : ''}</p>
          </div>
          {hasData && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50">
              <CheckCircle2 size={14} className="text-indigo-500" />
            </span>
          )}
        </div>

        {hasData ? (
          <div className="space-y-1 mb-3">
            {periods.slice(0, 3).map((p, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-300 shrink-0" />
                <span className="truncate text-gray-600">{p.subject}</span>
              </div>
            ))}
            {periods.length > 3 && <p className="text-xs text-gray-400 pl-3">+{periods.length - 3} more</p>}
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-3 italic">No schedule yet</p>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className={`w-full py-1.5 rounded-xl text-xs font-semibold transition-colors ${hasData ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
        >
          {hasData ? '✎ Edit' : '+ Add'}
        </button>
      </div>
    </div>
  );
};

const TeacherPicker = ({ value, teachers, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);

  const sortedTeachers = useMemo(
    () => [...teachers].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [teachers]
  );

  const filteredTeachers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedTeachers;
    return sortedTeachers.filter(t => String(t.name || '').toLowerCase().includes(q));
  }, [sortedTeachers, query]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selectTeacher = (name) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={open ? query : (value || '')}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(''); }}
          placeholder="Search teacher…"
          className={`w-full rounded-xl border pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 ${value ? 'border-emerald-300 bg-emerald-50/40 text-slate-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {value && (
            <button type="button" onClick={() => selectTeacher('')}
              className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 border-b border-slate-100">
              Clear selection
            </button>
          )}
          {filteredTeachers.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400">No teachers found</div>
          )}
          {filteredTeachers.map(t => (
            <button
              key={t._id}
              type="button"
              onClick={() => selectTeacher(t.name)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors ${value === t.name ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700'}`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────── main component ─────────────────────── */
const Routines = ({ setShowAdminHeader }) => {
  /* data */
  const [routines, setRoutines]   = useState([]);
  const [years, setYears]         = useState([]);
  const [classes, setClasses]     = useState([]);
  const [sections, setSections]   = useState([]);
  const [subjects, setSubjects]   = useState([]);
  const [teachers, setTeachers]   = useState([]);
  const [floors, setFloors]       = useState([]);
  const [rooms, setRooms]         = useState([]);

  /* ui */
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [saving, setSaving]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState('');
  const [toast, setToast]         = useState({ show: false, message: '', type: 'success' });

  /* filters */
  const [selectedYearId, setSelectedYearId]   = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedDay, setSelectedDay]         = useState('Monday');

  /* modal */
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [form, setForm]                     = useState({ classId: '', sectionId: '', day: 'Monday', schedule: [] });
  const [formYearId, setFormYearId]         = useState('');
  const [showAdvanced, setShowAdvanced]     = useState(false);
  const [selectedCopyRoutine, setSelectedCopyRoutine] = useState('');
  const [wizardStep, setWizardStep]         = useState(1);

  /* conflicts */
  const [conflicts, setConflicts]               = useState([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  /* delete all */
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  /* ── toast ── */
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type }), 3500);
  };

  /* ── load ── */
  const loadInitialData = async () => {
    try {
      setLoading(true); setError(null);
      const [ttData, yrData, clsData, secData, subData, tchData, flData, rmData] = await Promise.allSettled([
        timetableApi.getAll(), academicApi.getYears(), academicApi.getClasses(), academicApi.getSections(),
        academicApi.getSubjects(), academicApi.getTeachers(), academicApi.getFloors(), academicApi.getRooms(),
      ]);
      const safe = (r, fallback = []) => r.status === 'fulfilled' ? (Array.isArray(r.value) ? r.value : fallback) : fallback;
      const yearItems = safe(yrData);
      setRoutines(transformTimetablesToRoutines(safe(ttData)));
      setYears(yearItems);
      setClasses(safe(clsData)); setSections(safe(secData)); setSubjects(safe(subData));
      setTeachers(safe(tchData)); setFloors(safe(flData)); setRooms(safe(rmData));
      const activeYear = yearItems.find((y) => y?.isActive);
      if (activeYear?._id) {
        setSelectedYearId(String(activeYear._id));
      } else if (yearItems[0]?._id) {
        setSelectedYearId(String(yearItems[0]._id));
      }
    } catch (err) { setError(err.message || 'Failed to load'); showToast(err.message || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { setShowAdminHeader?.(false); }, []);
  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => { if (!isModalOpen) { setSelectedCopyRoutine(''); setShowAdvanced(false); setWizardStep(1); } }, [isModalOpen]);
  useEffect(() => {
    if (!isModalOpen) return;
    if (formYearId) return;
    if (selectedYearId) setFormYearId(selectedYearId);
  }, [isModalOpen, formYearId, selectedYearId]);

  /* ── derived ── */
  // Resolved strictly by classId so subjects always match the exact
  // class + session chosen in Step 1 — class names are commonly reused
  // across sessions (e.g. a new "Class 10" every academic year), so
  // matching by name alone could pull in a different session's class.
  const selectedClassDoc = useMemo(
    () => classes.find((c) => String(c._id) === String(form.classId)) || null,
    [classes, form.classId]
  );

  const selectedSectionDoc = useMemo(
    () => sections.find((s) => String(s._id) === String(form.sectionId)) || null,
    [sections, form.sectionId]
  );

  const classFilteredSubjects = useMemo(() =>
    selectedClassDoc?._id ? subjects.filter(s => String(s.classId) === String(selectedClassDoc._id)) : [],
    [subjects, selectedClassDoc]
  );

  const modalClasses = useMemo(() => {
    if (!formYearId) return [];
    return classes.filter((c) => String(c.academicYearId || '') === String(formYearId));
  }, [classes, formYearId]);

  const modalSections = useMemo(() => {
    if (!form.classId) return [];
    return sections.filter((s) => String(getId(s.classId) || '') === String(form.classId));
  }, [sections, form.classId]);

  const roomsById = useMemo(() => { const m = new Map(); rooms.forEach(r => r?._id && m.set(String(r._id), r)); return m; }, [rooms]);

  const roomOptions = useMemo(() =>
    rooms.map(r => ({
      id: r._id,
      label: `${r.floorId?.buildingId?.name || 'Bldg'} / ${r.floorId?.name || 'Floor'} (${r.floorId?.floorCode || '-'}) / ${r.roomNumber}`,
      roomNumber: r.roomNumber || '',
    })).sort((a, b) => a.label.localeCompare(b.label)),
    [rooms]
  );

  const copyableRoutines = useMemo(() =>
    routines.map(r => ({ id: String(r.id), label: `Class ${r.class}-${r.section} • ${normalizeDayLabel(r.day)}` })),
    [routines]
  );

  const filteredClasses = useMemo(() => {
    if (!selectedYearId) return [];
    return classes.filter((c) => String(c.academicYearId || '') === String(selectedYearId));
  }, [classes, selectedYearId]);

  const activeYears = useMemo(
    () => years.filter((year) => year?.isActive),
    [years]
  );

  useEffect(() => {
    if (!activeYears.length) return;
    const hasSelected = activeYears.some((year) => String(year._id) === String(selectedYearId));
    if (!hasSelected) {
      setSelectedYearId(String(activeYears[0]._id));
      setSelectedClassId('');
      setSelectedSectionId('');
    }
  }, [activeYears, selectedYearId]);

  const filteredSections = useMemo(() => {
    if (!selectedClassId) return [];
    return sections.filter((s) => String(getId(s.classId) || '') === String(selectedClassId));
  }, [sections, selectedClassId]);

  const selectedClassDocByFilter = useMemo(
    () => classes.find((c) => String(c._id) === String(selectedClassId)) || null,
    [classes, selectedClassId]
  );
  const selectedSectionDocByFilter = useMemo(
    () => sections.find((s) => String(s._id) === String(selectedSectionId)) || null,
    [sections, selectedSectionId]
  );
  const selectedClassName = selectedClassDocByFilter?.name || '';
  const selectedSectionName = selectedSectionDocByFilter?.name || '';
  const selectedYearName = useMemo(
    () => years.find((y) => String(y._id) === String(selectedYearId))?.name || '',
    [years, selectedYearId]
  );

  useEffect(() => {
    if (selectedYearId && selectedClassId && selectedSectionId) {
      console.groupCollapsed(
        `[Admin Routine View] Viewing routine for: ${selectedYearName} / ${selectedClassName} / ${selectedSectionName}`
      );
      console.log('Session ID:', selectedYearId);
      console.log('Class ID:', selectedClassId);
      console.log('Section ID:', selectedSectionId);
      console.groupEnd();
    }
  }, [selectedYearId, selectedClassId, selectedSectionId, selectedYearName, selectedClassName, selectedSectionName]);

  const getRoutineForDay = (day, classId = selectedClassId, sectionId = selectedSectionId) =>
    routines.find(
      (r) =>
        String(r.classId || '') === String(classId || '') &&
        String(r.sectionId || '') === String(sectionId || '') &&
        normalizeDayLabel(r.day) === normalizeDayLabel(day)
    );

  /* ── auto generate ── */
  const handleAutoGenerate = async () => {
    const confirm = await Swal.fire({
      icon: 'question',
      title: 'Generate routines?',
      text: 'This will overwrite existing timetables.',
      showCancelButton: true,
      confirmButtonText: 'Yes, Generate',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2563eb',
    });
    if (!confirm.isConfirmed) return;
    try {
      setGenerating(true);
      const result = await timetableApi.autoGenerate({ overwriteExisting: true });
      const total = result?.totalGenerated || 0;
      const msg = `Generated ${total} timetable${total !== 1 ? 's' : ''}.`;
      setGenerateMessage(msg); showToast(msg);
      await loadInitialData();
    } catch (err) { showToast(err.message || 'Auto-generation failed.', 'error'); }
    finally { setGenerating(false); }
  };

  /* ── open editor ── */
  const openRoutineEditor = ({ day = 'Monday' } = {}) => {
    const clsDoc =
      classes.find((c) => String(c._id) === String(selectedClassId || '')) ||
      filteredClasses[0] ||
      classes[0] ||
      null;
    const avail = sections.filter(s => !clsDoc || String(getId(s.classId)) === String(clsDoc._id));
    const secDoc =
      sections.find((s) => String(s._id) === String(selectedSectionId || '')) ||
      avail[0] ||
      null;
    const nextYearId = String(clsDoc?.academicYearId || selectedYearId || '');
    const existing = routines.find(
      (r) =>
        String(r.classId || '') === String(clsDoc?._id || '') &&
        String(r.sectionId || '') === String(secDoc?._id || '') &&
        normalizeDayLabel(r.day) === normalizeDayLabel(day)
    );
    setFormYearId(nextYearId);
    setForm({ classId: String(clsDoc?._id || ''), sectionId: String(secDoc?._id || ''), day, schedule: buildScheduleForDay(existing?.schedule || []) });
    setEditingRoutine(existing || null);
    setWizardStep(1);
    setIsModalOpen(true);
  };

  const updateRowTimeField = (idx, field, value) => {
    setForm(prev => {
      const schedule = [...prev.schedule];
      const cur = schedule[idx]; if (!cur) return prev;
      const p = parseTimeRange(cur.time);
      const ns = field === 'start' ? value : (cur.startTime || p.start || '');
      const ne = field === 'end'   ? value : (cur.endTime   || p.end   || '');
      schedule[idx] = { ...cur, startTime: ns, endTime: ne, time: (ns && ne) ? formatTimeRange(ns, ne) : cur.time };
      return { ...prev, schedule };
    });
  };

  const handleAddTimeSlot = () => {
    setForm(prev => {
      const last = prev.schedule[prev.schedule.length - 1];
      const st = last?.endTime || DEFAULT_START_TIME;
      const et = addMinutesToTime(st, DEFAULT_PERIOD_MINUTES);
      return { ...prev, schedule: [...prev.schedule, { time: formatTimeRange(st, et), startTime: st, endTime: et, isBreak: false, subject: '', teacher: '', subjectId: null, teacherId: null, roomId: null, room: '' }] };
    });
  };

  const handleRemoveTimeSlot = (idx) => {
    setForm(prev => prev.schedule.length <= 1 ? prev : { ...prev, schedule: prev.schedule.filter((_, i) => i !== idx) });
  };

  const handleApplyTemplate = (templateId) => {
    const t = ROUTINE_TEMPLATES.find(x => x.id === templateId); if (!t) return;
    setForm(prev => ({
      ...prev,
      schedule: prev.schedule.map((slot, idx) =>
        slot.isBreak ? { ...slot, subject: 'Break', teacher: '-', roomId: null, room: '' }
          : { ...slot, subject: t.pattern[idx % t.pattern.length] || slot.subject, teacher: TEACHERS[t.pattern[idx % t.pattern.length]] || slot.teacher }
      )
    }));
    showToast(`Applied "${t.name}" template`);
  };

  const handleCopyFromExistingRoutine = () => {
    const r = routines.find(x => String(x.id) === String(selectedCopyRoutine)); if (!r) return;
    setForm(prev => ({ ...prev, schedule: buildScheduleForDay(r.schedule) }));
    setSelectedCopyRoutine(''); showToast('Schedule copied');
  };

  const handleResetSchedule = () => setForm(prev => ({ ...prev, schedule: buildScheduleForDay() }));
  const handleClearSubjects = () => setForm(prev => ({
    ...prev,
    schedule: prev.schedule.map(s => s.isBreak ? { ...s, subject: 'Break', teacher: '-', roomId: null, room: '' } : { ...s, subject: '', teacher: '', roomId: null, room: '' })
  }));

  /* ── save ── */
  const handleSave = async () => {
    try {
      setSaving(true); setConflicts([]);
      const classDoc = selectedClassDoc;
      const sectionDoc = selectedSectionDoc;
      if (!formYearId) { showToast('Select a session', 'error'); return; }
      if (!classDoc) { showToast('Select a class', 'error'); return; }
      const incomplete = form.schedule.filter(p => !p.isBreak && (!p.subject || !p.teacher));
      if (incomplete.length) { showToast('Fill subject and teacher for all periods', 'error'); return; }
      const timingIssues = form.schedule.filter(p => !p.startTime || !p.endTime || p.startTime >= p.endTime);
      if (timingIssues.length) { showToast('Fix period timings', 'error'); return; }

      const entries = form.schedule.filter(p => p.isBreak || p.subject).map((p, idx) => {
        const parsed = parseTimeRange(p.time);
        const subject = !p.isBreak ? subjects.find(s => s.name === p.subject && (!classDoc || String(s.classId) === String(classDoc._id))) : null;
        const teacher = !p.isBreak ? teachers.find(t => t.name === p.teacher) : null;
        const roomDoc = p.roomId ? roomsById.get(String(p.roomId)) : null;
        return {
          dayOfWeek: form.day,
          period: idx + 1,
          isBreak: !!p.isBreak,
          subjectId: subject?._id || null,
          teacherId: teacher?._id || null,
          roomId: roomDoc?._id || p.roomId || null,
          startTime: p.startTime || parsed.start,
          endTime: p.endTime || parsed.end,
          room: roomDoc?.roomNumber || p.room || '',
        };
      });
      if (!entries.some(e => !e.isBreak)) { showToast('Add at least one period', 'error'); return; }

      const conflictResult = await timetableApi.validateConflicts({ classId: classDoc._id, sectionId: sectionDoc?._id || null, dayOfWeek: form.day, entries, excludeTimetableId: editingRoutine?.timetableId });
      if (conflictResult.hasConflicts) { setConflicts(conflictResult.conflicts); setShowConflictModal(true); setSaving(false); return; }

      await timetableApi.saveDay({ classId: classDoc._id, sectionId: sectionDoc?._id || null, dayOfWeek: form.day, entries });
      showToast('Routine saved successfully!'); setIsModalOpen(false); setEditingRoutine(null);
      await loadInitialData();
    } catch (err) { showToast(err.message || 'Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  /* ── export ── */
  const weeklyGrid = useMemo(() => {
    if (!selectedClassId || !selectedSectionId) return null;
    const byDay = new Map();
    routines.forEach(r => {
      if (
        String(r.classId || '') === String(selectedClassId) &&
        String(r.sectionId || '') === String(selectedSectionId)
      ) {
        byDay.set(r.day, r);
      }
    });
    const headers = ['Time', ...DAYS];
    const rows = TIMES.map(time => {
      const cells = DAYS.map(day => { const e = byDay.get(day); const p = e?.schedule.find(x => x.time === time); return p ? (p.subject === 'Break' ? 'Break' : `${p.subject} — ${p.teacher}`) : ''; });
      return [time, ...cells];
    });
    return { headers, rows };
  }, [selectedClassId, selectedSectionId, routines]);

  const exportCSV = () => {
    if (!weeklyGrid) return;
    const lines = [weeklyGrid.headers.join(','), ...weeklyGrid.rows.map(r => r.map(c => { const s = String(c||''); return s.includes(',') ? `"${s.replace(/"/g,'""')}"` : s; }).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `routine_${selectedClassName}_${selectedSectionName}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!Array.isArray(routines) || routines.length === 0) {
      showToast('No routines available to export', 'error');
      return;
    }

    const dayIndex = new Map(DAYS.map((d, i) => [d, i]));
    const sortedRoutines = [...routines].sort((a, b) => {
      const classCmp = String(a.class || '').localeCompare(String(b.class || ''), undefined, { numeric: true, sensitivity: 'base' });
      if (classCmp !== 0) return classCmp;
      const secCmp = String(a.section || '').localeCompare(String(b.section || ''), undefined, { numeric: true, sensitivity: 'base' });
      if (secCmp !== 0) return secCmp;
      const dayCmp = (dayIndex.get(normalizeDayLabel(a.day)) ?? 99) - (dayIndex.get(normalizeDayLabel(b.day)) ?? 99);
      return dayCmp;
    });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 36;
    const tableW = pageW - margin * 2;
    const cols = [
      { key: 'time', label: 'Time', w: 118 },
      { key: 'subject', label: 'Subject', w: 150 },
      { key: 'teacher', label: 'Teacher', w: 148 },
      { key: 'room', label: 'Room', w: tableW - (118 + 150 + 148) },
    ];

    let y = margin;

    const ensureSpace = (h) => {
      if (y + h <= pageH - margin) return;
      doc.addPage();
      y = margin;
    };

    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    doc.text('All Class Routines', margin, y);
    y += 16;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    doc.setTextColor(20);
    y += 18;

    sortedRoutines.forEach((routine, idx) => {
      const schedule = Array.isArray(routine.schedule)
        ? [...routine.schedule].sort((a, b) => {
            const aKey = (a.startTime || parseTimeRange(a.time).start || '');
            const bKey = (b.startTime || parseTimeRange(b.time).start || '');
            return aKey.localeCompare(bKey);
          })
        : [];

      const title = `Class ${routine.class || '-'} - Section ${routine.section || '-'} - ${normalizeDayLabel(routine.day || '')}`;
      ensureSpace(24);
      doc.setFillColor(245, 247, 255);
      doc.rect(margin, y, tableW, 20, 'F');
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(title, margin + 8, y + 14);
      y += 20;

      ensureSpace(22);
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, tableW, 18, 'F');
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      let x = margin;
      cols.forEach((c) => {
        doc.text(c.label, x + 6, y + 12);
        x += c.w;
      });
      y += 18;

      doc.setFont(undefined, 'normal');
      schedule.forEach((row) => {
        ensureSpace(18);
        let cx = margin;
        const values = {
          time: row.time || `${convertTo12Hour(row.startTime || '')} - ${convertTo12Hour(row.endTime || '')}`.trim(),
          subject: row.isBreak ? 'Break' : (row.subject || '-'),
          teacher: row.isBreak ? '-' : (row.teacher || '-'),
          room: row.isBreak ? '-' : (row.room || '-'),
        };
        cols.forEach((c) => {
          doc.setDrawColor(230);
          doc.rect(cx, y, c.w, 18);
          const text = doc.splitTextToSize(String(values[c.key] || '-'), c.w - 10)[0] || '-';
          doc.text(text, cx + 6, y + 12);
          cx += c.w;
        });
        y += 18;
      });

      if (idx < sortedRoutines.length - 1) y += 10;
    });

    doc.save(`all_routines_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  /* ── delete all routines ── */
  const handleDeleteAllRoutines = async () => {
    if (!routines.length) return;
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Delete all routines?',
      text: 'This will permanently remove every class routine for this school. This cannot be undone.',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete All',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#DC2626',
    });
    if (!confirm.isConfirmed) return;

    setIsDeletingAll(true);
    try {
      const result = await timetableApi.deleteAll();
      await loadInitialData();
      showToast(`${result?.deletedCount ?? 'All'} routine(s) deleted successfully.`);
    } catch (err) {
      showToast(err.message || 'Failed to delete routines.', 'error');
    } finally {
      setIsDeletingAll(false);
    }
  };

  /* ════════════════════ RENDER ════════════════════ */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="h-10 w-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 text-sm">Loading routines…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-slate-700 font-medium">{error}</p>
        <button onClick={loadInitialData} className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm hover:bg-indigo-700">Retry</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toast {...toast} />

      {/* ──────── HEADER ──────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <Calendar size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Class Routines</h1>
              <p className="text-xs text-slate-500">Manage weekly timetables</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* <button onClick={exportCSV} disabled={!weeklyGrid}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Download size={14} /> CSV
            </button> */}
            <button onClick={exportPDF} disabled={routines.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Download size={14} /> PDF
            </button>
            {/* <button onClick={handleAutoGenerate} disabled={generating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-sm text-indigo-700 hover:bg-indigo-100 disabled:opacity-60 transition-colors">
              <Sparkles size={14} /> {generating ? 'Generating…' : 'Auto Generate'}
            </button> */}
            <button onClick={handleDeleteAllRoutines} disabled={isDeletingAll || routines.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {isDeletingAll ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {isDeletingAll ? 'Deleting…' : 'Delete All Routines'}
            </button>
            <button onClick={() => openRoutineEditor({ day: selectedDay || 'Monday' })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors">
              <Plus size={14} /> New Routine
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ──────── FILTERS ──────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Filter by Session, Class & Section</p>
          <div className="flex flex-wrap gap-3 items-center">
            <select value={selectedYearId} onChange={e => { setSelectedYearId(e.target.value); setSelectedClassId(''); setSelectedSectionId(''); }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 min-w-[160px]">
              <option value="">Select Active Session</option>
              {activeYears.map(y => <option key={y._id} value={y._id}>{y.name}</option>)}
            </select>
            <ChevronRight size={14} className="text-slate-300" />
            <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setSelectedSectionId(''); }}
              disabled={!selectedYearId}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 min-w-[140px]">
              <option value="">All Classes</option>
              {filteredClasses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <ChevronRight size={14} className="text-slate-300" />
            <select value={selectedSectionId} onChange={e => setSelectedSectionId(e.target.value)}
              disabled={!selectedClassId}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 min-w-[140px]">
              <option value="">All Sections</option>
              {filteredSections.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            {selectedClassId && selectedSectionId && (
              <span className="ml-auto text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl font-semibold border border-indigo-100">
                Class {selectedClassName} — {selectedSectionName}
              </span>
            )}
          </div>
          {generateMessage && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
              <CheckCircle2 size={13} /> {generateMessage}
            </div>
          )}
        </div>

        {/* ──────── EMPTY STATE ──────── */}
        {routines.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar size={28} className="text-indigo-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">No routines yet</h3>
            <p className="text-sm text-slate-400 mb-6">Create your first class timetable to get started.</p>
            <button onClick={() => openRoutineEditor({ day: 'Monday' })}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200">
              <Plus size={16} /> Create First Routine
            </button>
          </div>
        )}

        {/* ──────── SELECT PROMPT ──────── */}
        {routines.length > 0 && (!selectedClassId || !selectedSectionId) && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="h-14 w-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users size={24} className="text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">Select Session, Class & Section</h3>
            <p className="text-sm text-slate-400">Choose session first, then class and section to view the weekly schedule.</p>
          </div>
        )}

        {/* ──────── WEEKLY DAY CARDS ──────── */}
        {selectedClassId && selectedSectionId && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">Weekly Overview</h2>
                <p className="text-xs text-slate-400 mt-0.5">Click a day to preview, or use the edit button</p>
              </div>
              <button onClick={() => openRoutineEditor({ day: selectedDay })}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                <Plus size={13} /> Add / Edit Day
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {DAYS.map(day => (
                <DayCard
                  key={day}
                  day={day}
                  routine={getRoutineForDay(day)}
                  isSelected={selectedDay === day}
                  onClick={() => setSelectedDay(day)}
                  onEdit={() => openRoutineEditor({ day })}
                />
              ))}
            </div>
          </div>
        )}

        {/* ──────── DAY DETAIL VIEW ──────── */}
        {selectedClassId && selectedSectionId && (() => {
          const routine = getRoutineForDay(selectedDay);
          const periods = routine?.schedule || [];
          if (!routine) return null;
          return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-indigo-400" />
                  <h2 className="text-sm font-bold text-slate-800">{selectedDay} Schedule</h2>
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg font-medium">
                    {periods.filter(p => !p.isBreak && p.subject).length} periods
                  </span>
                </div>
                <button onClick={() => openRoutineEditor({ day: selectedDay })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors">
                  <Edit2 size={12} /> Edit {selectedDay}
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {periods.map((p, i) => (
                  <div key={i} className={`flex items-center gap-4 px-5 py-3.5 ${p.isBreak ? 'bg-slate-50/80' : ''}`}>
                    <div className="w-36 shrink-0">
                      <p className="text-xs font-mono text-slate-500">{p.time || '—'}</p>
                    </div>
                    {p.isBreak ? (
                      <span className="text-xs font-semibold text-slate-400 italic">Break</span>
                    ) : (
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                          <BookOpen size={13} className="text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{p.subject}</p>
                          <p className="text-xs text-slate-400 truncate">{p.teacher}{p.room ? ` · ${p.room}` : ''}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ──────── ALL ROUTINES TABLE (when no class/section selected) ──────── */}
        {routines.length > 0 && selectedClassId && selectedSectionId && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">All Days Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Day</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Periods</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Subjects</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {DAYS.map(day => {
                    const r = getRoutineForDay(day);
                    const periods = r?.schedule?.filter(p => !p.isBreak && p.subject) || [];
                    return (
                      <tr key={day} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${periods.length > 0 ? 'bg-indigo-400' : 'bg-slate-200'}`} />
                            <span className="font-semibold text-slate-800">{day}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">{periods.length > 0 ? `${periods.length} periods` : <span className="italic text-slate-300">Not set</span>}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {periods.slice(0, 4).map((p, i) => (
                              <span key={i} className="text-[11px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-medium">{p.subject}</span>
                            ))}
                            {periods.length > 4 && <span className="text-[11px] text-slate-400">+{periods.length - 4}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button onClick={() => openRoutineEditor({ day })}
                            className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all">
                            <Edit2 size={11} /> {periods.length > 0 ? 'Edit' : 'Add'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════ EDIT MODAL ══════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">

            {/* ── Wizard Header ── */}
            <div className="px-6 pt-5 pb-0 bg-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                    <Calendar size={16} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-tight">{editingRoutine ? 'Edit Routine' : 'Create New Routine'}</h3>
                    <p className="text-xs text-slate-400">
                      {wizardStep === 1 && 'Choose session, class, section and day'}
                      {wizardStep === 2 && 'Apply templates or copy from an existing routine'}
                      {wizardStep === 3 && 'Fill in subjects, teachers and rooms for each period'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-0 mb-0">
                {[
                  { n: 1, label: 'Setup', icon: '📋' },
                  { n: 2, label: 'Quick Tools', icon: '⚡' },
                  { n: 3, label: 'Schedule', icon: '🗓' },
                ].map(({ n, label, icon }, i) => {
                  const done = wizardStep > n;
                  const active = wizardStep === n;
                  return (
                    <React.Fragment key={n}>
                      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-colors border-b-2 ${
                        active ? 'border-indigo-500 text-indigo-700 bg-indigo-50/60'
                        : done  ? 'border-emerald-400 text-emerald-600 bg-emerald-50/40 cursor-pointer'
                        : 'border-transparent text-slate-400 bg-transparent'
                      }`}
                        onClick={() => done && setWizardStep(n)}
                      >
                        <span className={`h-5 w-5 rounded-full text-[10px] flex items-center justify-center font-bold shrink-0 ${
                          active ? 'bg-indigo-600 text-white'
                          : done  ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-500'
                        }`}>
                          {done ? '✓' : n}
                        </span>
                        <span className="hidden sm:block">{label}</span>
                      </div>
                      {i < 2 && <div className={`flex-1 h-px mx-1 ${wizardStep > n ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="border-b border-slate-100" />
            </div>

            {/* ── Wizard Body ── */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* ─── Step 1: Setup ─── */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div className="rounded-2xl bg-indigo-50/50 border border-indigo-100 p-5">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-4">Session & Class</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Academic Session <span className="text-rose-500">*</span></label>
                        <select
                          value={formYearId}
                          onChange={(e) => { setFormYearId(e.target.value); setForm((f) => ({ ...f, classId: '', sectionId: '' })); }}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        >
                          <option value="">— Select session —</option>
                          {activeYears.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Class <span className="text-rose-500">*</span></label>
                        <select
                          value={form.classId}
                          onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value, sectionId: '' }))}
                          disabled={!formYearId}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">— Select class —</option>
                          {modalClasses.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                        {!formYearId && <p className="text-[11px] text-slate-400 mt-1">Select a session first</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Section</label>
                        <select
                          value={form.sectionId}
                          onChange={(e) => setForm((f) => ({ ...f, sectionId: e.target.value }))}
                          disabled={!form.classId}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">— Select section —</option>
                          {modalSections.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                        </select>
                        {!form.classId && <p className="text-[11px] text-slate-400 mt-1">Select a class first</p>}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Day of Week</p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {DAYS.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, day }))}
                          className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                            form.day === day
                              ? 'border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-200'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                          }`}
                        >
                          {DAY_SHORT[day]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary chip */}
                  {formYearId && form.classId && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl font-semibold">
                        {years.find(y => String(y._id) === String(formYearId))?.name}
                      </span>
                      <span className="text-slate-300 text-xs">›</span>
                      <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-3 py-1.5 rounded-xl font-semibold">
                        Class {selectedClassDoc?.name || ''}{selectedSectionDoc?.name ? ` – ${selectedSectionDoc.name}` : ''}
                      </span>
                      <span className="text-slate-300 text-xs">›</span>
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl font-semibold">
                        {form.day}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Step 2: Quick Tools ─── */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-indigo-50/60 border border-indigo-100 p-5">
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-1">Apply a Template</p>
                    <p className="text-xs text-slate-500 mb-4">Instantly fill all periods with a pre-set subject pattern.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {ROUTINE_TEMPLATES.map(t => (
                        <button key={t.id} type="button" onClick={() => { handleApplyTemplate(t.id); }}
                          className="flex flex-col items-start gap-1 p-4 rounded-2xl bg-white border-2 border-indigo-100 hover:border-indigo-400 hover:shadow-md transition-all text-left group">
                          <span className="text-base">⚡</span>
                          <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-700">{t.name}</span>
                          <span className="text-[11px] text-slate-400 truncate w-full">{t.pattern.slice(0, 4).join(', ')}…</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1">Copy from Existing Routine</p>
                    <p className="text-xs text-slate-500 mb-3">Reuse a schedule you've already created.</p>
                    <div className="flex gap-2">
                      <select value={selectedCopyRoutine} onChange={e => setSelectedCopyRoutine(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                        <option value="">— Pick a routine to copy from —</option>
                        {copyableRoutines.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                      <button type="button" onClick={handleCopyFromExistingRoutine} disabled={!selectedCopyRoutine}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50 hover:bg-indigo-700 transition-colors">
                        <Copy size={14} /> Copy
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-amber-50/60 border border-amber-100 p-5">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1">Reset / Clear</p>
                    <p className="text-xs text-slate-500 mb-3">Start fresh or clear all subjects from the schedule.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleClearSubjects}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-amber-200 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors">
                        <XCircle size={14} /> Clear Subjects
                      </button>
                      <button type="button" onClick={handleResetSchedule}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                        <RotateCcw size={14} /> Reset to Default
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Step 3: Schedule ─── */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  {/* Context pill */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl font-semibold">
                      {years.find(y => String(y._id) === String(formYearId))?.name}
                    </span>
                    <span className="text-slate-300">›</span>
                    <span className="bg-violet-50 text-violet-700 border border-violet-200 px-3 py-1.5 rounded-xl font-semibold">
                      Class {selectedClassDoc?.name || ''}{selectedSectionDoc?.name ? ` – ${selectedSectionDoc.name}` : ''}
                    </span>
                    <span className="text-slate-300">›</span>
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl font-semibold">{form.day}</span>
                    <span className="ml-auto text-slate-400">
                      {form.schedule.filter(s => !s.isBreak && s.subject).length}/{form.schedule.filter(s => !s.isBreak).length} periods filled
                    </span>
                  </div>

                  {/* Period cards */}
                  <div className="space-y-2">
                    {form.schedule.map((row, idx) => (
                      <div key={idx} className={`rounded-2xl border-2 p-4 transition-all ${row.isBreak ? 'border-slate-100 bg-slate-50' : (row.subject && row.teacher) ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white hover:border-indigo-200'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-6 w-6 rounded-lg text-[10px] font-bold flex items-center justify-center ${row.isBreak ? 'bg-slate-200 text-slate-500' : 'bg-indigo-100 text-indigo-700'}`}>
                              {row.isBreak ? '☕' : idx + 1}
                            </span>
                            <span className="text-xs font-mono text-slate-500">{row.time || '—'}</span>
                            {row.isBreak && <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">Break</span>}
                            {!row.isBreak && row.subject && row.teacher && <CheckCircle2 size={13} className="text-emerald-500" />}
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                              <input type="checkbox" checked={row.isBreak}
                                onChange={e => {
                                  const ib = e.target.checked;
                                  const next = [...form.schedule];
                                  next[idx] = ib ? {...row, isBreak: true, subject: 'Break', teacher: '-', roomId: null, room: ''} : {...row, isBreak: false, subject: '', teacher: '', roomId: null, room: ''};
                                  setForm(f => ({...f, schedule: next}));
                                }}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer" />
                              Break
                            </label>
                            <button type="button" onClick={() => handleRemoveTimeSlot(idx)} disabled={form.schedule.length <= 1}
                              className="h-6 w-6 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Time pickers */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Start</label>
                            <input type="time" value={row.startTime || parseTimeRange(row.time).start || ''}
                              onChange={e => updateRowTimeField(idx, 'start', e.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">End</label>
                            <input type="time" value={row.endTime || parseTimeRange(row.time).end || ''}
                              onChange={e => updateRowTimeField(idx, 'end', e.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" />
                          </div>
                        </div>

                        {!row.isBreak && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Subject</label>
                              <select value={row.subject}
                                onChange={e => { const next = [...form.schedule]; next[idx] = {...row, subject: e.target.value}; setForm(f => ({...f, schedule: next})); }}
                                className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 ${row.subject ? 'border-emerald-300 bg-emerald-50/40 text-slate-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                                <option value="">— Subject —</option>
                                {classFilteredSubjects.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Teacher</label>
                              <TeacherPicker
                                value={row.teacher}
                                teachers={teachers}
                                onChange={(name) => { const next = [...form.schedule]; next[idx] = {...row, teacher: name}; setForm(f => ({...f, schedule: next})); }}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Room (optional)</label>
                              <select value={row.roomId || ''}
                                onChange={e => { const rid = e.target.value; const opt = roomOptions.find(o => String(o.id) === String(rid)); const next = [...form.schedule]; next[idx] = {...row, roomId: rid||null, room: opt?.roomNumber||row.room||''}; setForm(f => ({...f, schedule: next})); }}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100">
                                <option value="">— Room —</option>
                                {roomOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button type="button" onClick={handleAddTimeSlot}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 hover:border-indigo-400 transition-colors">
                    <Plus size={15} /> Add Period
                  </button>
                </div>
              )}
            </div>

            {/* ── Wizard Footer ── */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
              <button
                onClick={() => wizardStep === 1 ? setIsModalOpen(false) : setWizardStep(s => s - 1)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 font-medium transition-colors"
              >
                <ChevronLeft size={15} />
                {wizardStep === 1 ? 'Cancel' : 'Back'}
              </button>

              {wizardStep < 3 ? (
                <button
                  onClick={() => {
                    if (wizardStep === 1 && !formYearId) { showToast('Please select a session', 'error'); return; }
                    if (wizardStep === 1 && !form.classId) { showToast('Please select a class', 'error'); return; }
                    setWizardStep(s => s + 1);
                  }}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors"
                >
                  Next <ArrowRight size={15} />
                </button>
              ) : (
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 shadow-md shadow-emerald-200 transition-colors">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? 'Saving…' : 'Save Routine'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ CONFLICT MODAL ══════════════════ */}
      {showConflictModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowConflictModal(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-red-100 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-red-50 bg-red-50/80">
              <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertCircle size={16} className="text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-sm">Schedule Conflicts</h3>
                <p className="text-xs text-slate-400">Please resolve before saving</p>
              </div>
              <button onClick={() => setShowConflictModal(false)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-2 max-h-72 overflow-y-auto">
              {conflicts.map((c, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700">
                  <XCircle size={14} className="shrink-0 mt-0.5 text-red-400" />
                  {c.message}
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
              <button onClick={() => { setShowConflictModal(false); setConflicts([]); }}
                className="px-5 py-2 rounded-xl bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition-colors">
                Close & Fix
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Routines;
