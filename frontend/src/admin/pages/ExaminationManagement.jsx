import React, { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  AlertTriangle, Award, BookOpen, Building2, Calendar, Check, ChevronDown, ChevronLeft, ChevronRight,
  Clock, CloudCheck, Copy, DoorOpen, Edit2, FileClock, FileText, Filter, Info, Layers,
  ListChecks, Loader2, MapPin, Plus, RefreshCw, Rocket, RotateCcw, Search, Trash2,
  User, Users, X, CheckCircle2, XCircle, Zap,
} from 'lucide-react';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const EXAM_DRAFTS_API = `${API_BASE}/api/exam/creation-drafts`;

const draftTimeAgo = (iso) => {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleString();
};

const TERM_OPTIONS   = ['Class Test','Unit Test','Monthly Test','Term 1','Term 2','Term 3','Half Yearly','Annual','Final'];
// 'Published' is intentionally not selectable here — it's only ever set via
// the dedicated Publish Routine action, which also posts the notice + PDF.
const GROUP_STATUS_OPTIONS = ['Scheduled', 'Completed'];
const SUBJECT_STATUS_OPTIONS = ['Scheduled','Ongoing','Completed','Cancelled','Postponed'];

const TERM_COLORS = {
  'Class Test':  'bg-sky-50 text-sky-700 border-sky-200',
  'Unit Test':   'bg-violet-50 text-violet-700 border-violet-200',
  'Monthly Test':'bg-amber-50 text-amber-700 border-amber-200',
  'Term 1':      'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Term 2':      'bg-blue-50 text-blue-700 border-blue-200',
  'Term 3':      'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Half Yearly': 'bg-orange-50 text-orange-700 border-orange-200',
  'Annual':      'bg-rose-50 text-rose-700 border-rose-200',
  'Final':       'bg-red-50 text-red-700 border-red-200',
};
const STATUS_COLORS = {
  Scheduled: 'bg-blue-50 text-blue-700',
  Ongoing:   'bg-emerald-50 text-emerald-700',
  Completed: 'bg-slate-100 text-slate-600',
  Cancelled: 'bg-red-50 text-red-600',
  Postponed: 'bg-amber-50 text-amber-700',
  Published: 'bg-emerald-50 text-emerald-700',
};

const EMPTY_GROUP   = { title:'', term:'Term 1', classId:'', sectionId:'', status:'Scheduled', startDate:'', endDate:'' };
const EMPTY_SUBJECT = { subjectId:'', marks:'100', date:'', time:'', duration:'', buildingId:'', floorId:'', roomId:'', venue:'', primaryInstructor:'', secondaryInstructor:'', status:'Scheduled' };

const inp = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition placeholder:text-slate-400';
// Compact variant for dense table cells (the Step 4 routine table) — same look, smaller footprint.
const inpDense = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-100 transition placeholder:text-slate-400';
const Field = ({ label, children }) => (
  <div>
    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const timeToMins = (t) => { const [h,m] = String(t||'').split(':').map(Number); return (h||0)*60+(m||0); };
const hasOverlap = (fd, ft, fdur, ex) => {
  if (!fd||!ft||!fdur||!ex.date||!ex.time||!ex.duration) return false;
  if (String(fd).slice(0,10) !== String(ex.date).slice(0,10)) return false;
  const fs = timeToMins(ft), fe = fs+Number(fdur);
  const es = timeToMins(ex.time), ee = es+Number(ex.duration);
  return fs < ee && fe > es;
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

/* ── Modal shell ── */
const Modal = ({ show, onClose, title, subtitle, icon:Icon, iconColor='bg-indigo-600', children, maxWidth='sm:max-w-2xl' }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white w-full ${maxWidth} rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-100`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {Icon && <div className={`h-9 w-9 rounded-xl ${iconColor} flex items-center justify-center shadow-sm`}><Icon size={16} className="text-white" /></div>}
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">{title}</h3>
              {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

/* ── Create-exam wizard: steps, sub-components ── */
const WIZARD_STEPS = [
  { title: 'Exam Details',              sub: 'Basic information' },
  { title: 'Select Classes & Sections', sub: 'Choose participants' },
  { title: 'Add Subjects',              sub: 'Configure subjects' },
  { title: 'Exam Routine',              sub: 'Set schedule' },
  { title: 'Review & Create',           sub: 'Confirm and save' },
];

const EMPTY_WIZARD_SCHEDULE = { marks:'100', date:'', time:'', duration:'60', buildingId:'', floorId:'', roomId:'', primaryInstructor:'', secondaryInstructor:'', status:'Scheduled' };

const DURATION_OPTIONS = [30, 45, 60, 90, 120, 150, 180];

const formatDuration = (mins) => {
  const n = Number(mins) || 0;
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} hr`;
  return `${h} hr ${m} min`;
};

const addMinutesToTime = (time, mins) => {
  if (!time) return '';
  const [h, m] = String(time).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const total = (h * 60 + m + Number(mins || 0)) % 1440;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const formatTimeLabel = (time) => {
  if (!time) return '—';
  const [h, m] = String(time).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '—';
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${period}`;
};

const formatDateChip = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

const nextWeekday = (d) => {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  while (isWeekend(next)) next.setDate(next.getDate() + 1);
  return next;
};

const toIsoDate = (d) => d.toISOString().slice(0, 10);

const CLASS_AVATAR_PALETTE = [
  'bg-blue-100 text-blue-600',
  'bg-emerald-100 text-emerald-600',
  'bg-rose-100 text-rose-600',
  'bg-violet-100 text-violet-600',
  'bg-pink-100 text-pink-600',
  'bg-amber-100 text-amber-600',
];

const WizardStepper = ({ step }) => (
  <div className="flex items-start">
    {WIZARD_STEPS.map((s, i) => {
      const num = i + 1;
      const isActive = num === step;
      const isDone = num < step;
      return (
        <React.Fragment key={s.title}>
          <div className="flex flex-col items-center text-center px-1 min-w-0">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
              isDone || isActive ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'bg-slate-100 text-slate-400'
            }`}>
              {isDone ? <Check size={15} /> : num}
            </div>
            <p className={`mt-2 text-[11px] sm:text-xs font-semibold whitespace-nowrap ${isActive ? 'text-slate-900' : isDone ? 'text-slate-600' : 'text-slate-400'}`}>{s.title}</p>
            <p className="text-[10px] text-slate-400 whitespace-nowrap hidden sm:block">{s.sub}</p>
          </div>
          {i < WIZARD_STEPS.length - 1 && (
            <div className={`flex-1 h-[2px] mt-4 mx-1 sm:mx-2 rounded-full ${isDone ? 'bg-indigo-500' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

const WizardField = ({ label, required, children }) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const WizardSelect = ({ value, onChange, disabled, dense, children }) => (
  <div className="relative">
    <select value={value} onChange={onChange} disabled={disabled}
      className={`${dense ? inpDense : inp} appearance-none ${dense ? 'pr-6' : 'pr-9'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
      {children}
    </select>
    <ChevronDown size={dense ? 11 : 14} className={`pointer-events-none absolute ${dense ? 'right-1.5' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400`} />
  </div>
);

const WizardDateInput = ({ value, onChange, disabled, dense }) => (
  <div className="relative">
    <Calendar size={dense ? 10 : 14} className={`pointer-events-none absolute ${dense ? 'left-1' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} />
    <input type="date" value={value} onChange={onChange} disabled={disabled}
      className={`${dense ? inpDense : inp} ${dense ? 'pl-5 pr-0.5' : 'pl-9'}`} />
  </div>
);

/* Step 5 review card: square icon badge + title + Edit link, label/value rows below. */
const ReviewCard = ({ icon: Icon, iconColor, title, onEdit, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-2.5">
        <span className={`h-8 w-8 rounded-xl ${iconColor} flex items-center justify-center shrink-0`}>
          <Icon size={14} className="text-white" />
        </span>
        <p className="text-sm font-bold text-slate-800">{title}</p>
      </div>
      <button type="button" onClick={onEdit} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">Edit</button>
    </div>
    <div>{children}</div>
  </div>
);

const ReviewRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 last:border-b-0 text-sm">
    <span className="text-slate-400 shrink-0">{label}</span>
    <span className="font-semibold text-slate-800 text-right">{value}</span>
  </div>
);

/* ════════════════════════════════════════════════════════ */
const ExaminationManagement = ({ setShowAdminHeader }) => {
  useEffect(() => { setShowAdminHeader?.(true); }, [setShowAdminHeader]);

  const authH = () => ({ 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('token')}` });

  /* ── data ── */
  const [groups,    setGroups]    = useState([]);
  const [ungrouped, setUngrouped] = useState([]);   // legacy exams without groupId
  const [classes,   setClasses]   = useState([]);
  const [years,     setYears]     = useState([]);
  const [sections,  setSections]  = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [floors,    setFloors]    = useState([]);
  const [rooms,     setRooms]     = useState([]);
  const [teachers,  setTeachers]  = useState([]);
  const [students,  setStudents]  = useState([]); // for the Step 5 "Total Students" count
  const [pdfHeader, setPdfHeader] = useState({ schoolName: '', schoolAddressLine: '', logoUrl: '' });
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [publishingGroupId, setPublishingGroupId] = useState('');

  /* ── UI state ── */
  const [search,         setSearch]         = useState('');
  const [termFilter,     setTermFilter]      = useState('all');
  const [yearFilterId,   setYearFilterId]    = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  /* ── group modal ── */
  const [showGroupModal,   setShowGroupModal]   = useState(false);
  const [editingGroupId,   setEditingGroupId]   = useState(null);
  const [groupForm,        setGroupForm]        = useState(EMPTY_GROUP);
  const [groupYearId,      setGroupYearId]      = useState('');

  /* ── subject modal ── */
  const [showSubjectModal,   setShowSubjectModal]   = useState(false);
  const [editingSubjectId,   setEditingSubjectId]   = useState(null);
  const [activeGroup,        setActiveGroup]        = useState(null);  // the parent group
  const [subjectForm,        setSubjectForm]        = useState(EMPTY_SUBJECT);

  /* ── create-exam wizard ── */
  const EMPTY_WIZARD_DETAILS = { title:'', term:'Term 1', yearId:'', status:'Scheduled', startDate:'', endDate:'' };
  const [showWizard,         setShowWizard]         = useState(false);
  const [wizardStep,         setWizardStep]         = useState(1);
  const [wizardSaving,       setWizardSaving]       = useState(false);
  const [wizardDetails,      setWizardDetails]      = useState(EMPTY_WIZARD_DETAILS);
  const [wizardSelections,   setWizardSelections]   = useState([]); // [{classId, className, sectionId, sectionName}]
  const [wizardActiveClassId, setWizardActiveClassId] = useState(''); // step 3: which class's subject panel is open
  const [wizardClassSubjects, setWizardClassSubjects] = useState({}); // classId -> subjectId[] (step 3)
  const [wizardSchedule,     setWizardSchedule]     = useState({}); // `${classId}__${sectionId}__${subjectId}` -> schedule fields (step 4)
  const [copyFromOpen,       setCopyFromOpen]       = useState(false);
  const [applyToOpen,        setApplyToOpen]        = useState(false);
  const [applyToTargets,     setApplyToTargets]     = useState([]); // classId[] picked in the "Apply to Other Classes" panel

  /* ── step 4: exam routine ── */
  const [scheduleSearch,       setScheduleSearch]       = useState('');
  const [activeScheduleKey,    setActiveScheduleKey]    = useState(''); // `${classId}__${sectionId}` expanded in the accordion
  const [scheduleCopyOpenFor,  setScheduleCopyOpenFor]  = useState('');
  const [scheduleApplyOpenFor, setScheduleApplyOpenFor] = useState('');
  const [scheduleApplyTargets, setScheduleApplyTargets] = useState([]); // keys picked in "Apply to Other Classes"
  const [newRoutineSubjectId,  setNewRoutineSubjectId]  = useState('');
  const [autoScheduling,       setAutoScheduling]       = useState(false);
  const [showBulkEditModal,    setShowBulkEditModal]    = useState(false);
  const [bulkEditDefaults,     setBulkEditDefaults]     = useState({ time: '10:00', duration: '60', buildingId: '', floorId: '', roomId: '' });

  /* ── create-exam wizard: auto-save drafts to the cloud ── */
  const [examDrafts,         setExamDrafts]         = useState([]);
  const [activeDraftId,      setActiveDraftId]      = useState(null);
  const [showDraftsModal,    setShowDraftsModal]    = useState(false);
  const [deletingDraftId,    setDeletingDraftId]    = useState(null);
  const [draftState,         setDraftState]         = useState('idle'); // idle | pending | saving | saved | error
  const [autoSavedAt,        setAutoSavedAt]        = useState(null);
  const draftAutoTimer = useRef(null);
  const draftLastSnapshot = useRef('');

  /* ── load ── */
  const loadGroups = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/exam/groups`, { headers: authH() });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Failed');
      const list = Array.isArray(data) ? data : [];
      setGroups(list);
      return list;
    } catch (err) { toast.error(err.message || 'Failed to load exam groups'); }
    finally { setLoading(false); }
    return [];
  };

  const loadUngrouped = async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/exam/fetch`, { headers: authH() });
      const data = await res.json().catch(() => []);
      if (res.ok) setUngrouped((Array.isArray(data) ? data : []).filter(e => !e.groupId));
    } catch { /* silent */ }
  };

  const loadOptions = async () => {
    const h = authH();
    const results = await Promise.allSettled([
      fetch(`${API_BASE}/api/academic/years`,             { headers: h }),
      fetch(`${API_BASE}/api/academic/classes`,           { headers: h }),
      fetch(`${API_BASE}/api/academic/sections`,          { headers: h }),
      fetch(`${API_BASE}/api/academic/subjects`,          { headers: h }),
      fetch(`${API_BASE}/api/academic/buildings`,         { headers: h }),
      fetch(`${API_BASE}/api/academic/floors`,            { headers: h }),
      fetch(`${API_BASE}/api/academic/rooms`,             { headers: h }),
      fetch(`${API_BASE}/api/admin/users/get-teachers`,   { headers: h }),
      fetch(`${API_BASE}/api/admin/users/get-students`,   { headers: h }),
      fetch(`${API_BASE}/api/reports/report-cards/template`, { headers: h }),
    ]);
    const parse = async (r) => r.status === 'fulfilled' ? (await r.value.json().catch(() => [])) : [];
    const [y,c,s,sub,b,f,rm,tch,stu,template] = await Promise.all(results.map(parse));
    const yearItems = Array.isArray(y) ? y : [];
    setYears(yearItems);
    const activeYear = yearItems.find((item) => item?.isActive);
    if (activeYear?._id) {
      setGroupYearId(String(activeYear._id));
      setYearFilterId((current) => current || String(activeYear._id));
    } else if (yearItems[0]?._id) {
      setGroupYearId(String(yearItems[0]._id));
      setYearFilterId((current) => current || String(yearItems[0]._id));
    }
    setClasses(Array.isArray(c) ? c : []);
    setSections(Array.isArray(s) ? s : []);
    setSubjects(Array.isArray(sub) ? sub : []);
    setBuildings(Array.isArray(b) ? b : []);
    setFloors(Array.isArray(f) ? f : []);
    setRooms(Array.isArray(rm) ? rm : []);
    setTeachers(Array.isArray(tch) ? tch : []);
    setStudents(Array.isArray(stu) ? stu : []);
    setPdfHeader({
      schoolName: String(template?.schoolName || '').trim(),
      schoolAddressLine: String(template?.schoolAddressLine || '').trim(),
      logoUrl: String(template?.logoUrl || template?.logoUrlOverride || '').trim(),
    });
  };

  useEffect(() => { loadGroups(); loadUngrouped(); loadOptions(); loadExamDrafts(); }, []);

  /* ── derived: subject-modal dropdowns ── */
  const groupClassId = activeGroup?.classId?._id || activeGroup?.classId || '';

  const usedSubjectIds = useMemo(() => new Set(
    (activeGroup?.subjects || [])
      .filter(ex => !editingSubjectId || String(ex._id) !== String(editingSubjectId))
      .map(ex => String(ex.subjectId?._id || ex.subjectId || ''))
  ), [activeGroup, editingSubjectId]);

  const modalSubjects = useMemo(() =>
    subjects.filter(s => {
      if (groupClassId && String(s.classId||'') !== String(groupClassId)) return false;
      return !usedSubjectIds.has(String(s._id));
    }),
    [subjects, groupClassId, usedSubjectIds]);

  const modalFloors = useMemo(() =>
    floors.filter(f => subjectForm.buildingId ? String(f.buildingId?._id||f.buildingId) === String(subjectForm.buildingId) : true),
    [floors, subjectForm.buildingId]);

  const allExamsForConflict = useMemo(() => groups.flatMap(g => g.subjects || []), [groups]);

  const modalRooms = useMemo(() => {
    const occupied = new Set();
    if (subjectForm.date && subjectForm.time && subjectForm.duration) {
      allExamsForConflict.forEach(ex => {
        if (editingSubjectId && ex._id === editingSubjectId) return;
        if (hasOverlap(subjectForm.date, subjectForm.time, subjectForm.duration, ex) && ex.roomId) {
          occupied.add(String(typeof ex.roomId === 'object' ? ex.roomId._id : ex.roomId));
        }
      });
    }
    return rooms.filter(r => {
      if (occupied.has(String(r._id))) return false;
      if (subjectForm.floorId) return String(r.floorId?._id||r.floorId) === String(subjectForm.floorId);
      if (subjectForm.buildingId) return String(r.floorId?.buildingId?._id||r.floorId?.buildingId) === String(subjectForm.buildingId);
      return true;
    });
  }, [rooms, subjectForm.floorId, subjectForm.buildingId, subjectForm.date, subjectForm.time, subjectForm.duration, allExamsForConflict, editingSubjectId]);

  const modalTeachers = useMemo(() => {
    const occupied = new Set();
    if (subjectForm.date && subjectForm.time && subjectForm.duration) {
      allExamsForConflict.forEach(ex => {
        if (editingSubjectId && ex._id === editingSubjectId) return;
        if (hasOverlap(subjectForm.date, subjectForm.time, subjectForm.duration, ex) && ex.instructor) {
          ex.instructor.split(',').forEach(t => occupied.add(t.trim()));
        }
      });
    }
    return teachers.filter(t => !occupied.has(t.name));
  }, [teachers, subjectForm.date, subjectForm.time, subjectForm.duration, allExamsForConflict, editingSubjectId]);

  const activeYears = useMemo(
    () => years.filter((y) => y?.isActive),
    [years]
  );

  const modalClasses = useMemo(
    () => classes.filter((c) => groupYearId ? String(c.academicYearId || '') === String(groupYearId) : true),
    [classes, groupYearId]
  );

  /* ── group sections ── */
  const groupFormSections = useMemo(() =>
    sections.filter(s => groupForm.classId ? String(s.classId) === String(groupForm.classId) : true),
    [sections, groupForm.classId]);

  /* ── wizard: classes for the chosen academic year, and each one's sections ── */
  const wizardClasses = useMemo(
    () => classes.filter((c) => wizardDetails.yearId ? String(c.academicYearId || '') === String(wizardDetails.yearId) : true),
    [classes, wizardDetails.yearId]
  );
  const wizardSectionsForClass = (classId) => sections.filter((s) => String(s.classId) === String(classId));
  const wizardSubjectsForClass = (classId) => subjects.filter((s) => String(s.classId || '') === String(classId));
  const wizardClassAvatar = (classId) => CLASS_AVATAR_PALETTE[Math.max(0, wizardClasses.findIndex((c) => String(c._id) === String(classId))) % CLASS_AVATAR_PALETTE.length];

  /* ── wizard: unique selected classes, in wizardClasses order, for step 3's sidebar ── */
  const wizardSelectedClasses = useMemo(() => {
    const ids = new Set(wizardSelections.map((p) => p.classId));
    return wizardClasses
      .filter((c) => ids.has(c._id))
      .map((c) => ({
        classId: c._id,
        className: c.name,
        sectionCount: wizardSelections.filter((p) => p.classId === c._id).length,
      }));
  }, [wizardClasses, wizardSelections]);

  /* keep the step-3 active class panel pointed at a class that's actually selected */
  useEffect(() => {
    if (!wizardSelectedClasses.some((c) => c.classId === wizardActiveClassId)) {
      setWizardActiveClassId(wizardSelectedClasses[0]?.classId || '');
    }
  }, [wizardSelectedClasses, wizardActiveClassId]);

  /* ── filtered display ── */
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter(g => {
      const classItem = classes.find((item) => String(item._id) === String(g.classId?._id || g.classId || ''));
      const groupYear = String(classItem?.academicYearId || '');
      const matchTerm = termFilter === 'all' || g.term === termFilter;
      const matchYear = !yearFilterId || groupYear === String(yearFilterId);
      const matchQ = !q || [g.title, g.grade, g.section, g.term].some(v => String(v||'').toLowerCase().includes(q));
      return matchTerm && matchYear && matchQ;
    });
  }, [groups, search, termFilter, yearFilterId, classes]);

  const generateExamSchedulePdf = async (group, { download = true } = {}) => {
    if (!group?._id) return null;
    const className = group.classId?.name || group.grade || '—';
    const sectionName = group.sectionId?.name || group.section || '—';
    const classItem = classes.find((item) => String(item._id) === String(group.classId?._id || group.classId || ''));
    const yearName = years.find((y) => String(y._id) === String(classItem?.academicYearId || ''))?.name || '';
    const title = String(group.title || 'Exam Schedule').trim();

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 12;
    let y = 0;

    // ── Gradient-style top banner ──────────────────────────────────────────
    doc.setFillColor(15, 23, 42);           // slate-900
    doc.rect(0, 0, pageWidth, 38, 'F');
    doc.setFillColor(30, 58, 138);          // indigo accent strip on left
    doc.rect(0, 0, 5, 38, 'F');

    // Logo inside banner
    const logoDataUrl = await toDataUrl(pdfHeader.logoUrl);
    if (logoDataUrl) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, 6, 24, 24, 2, 2, 'F');
        doc.addImage(logoDataUrl, 'PNG', margin + 1, 7, 22, 22);
      } catch { /* ignore */ }
    }

    // School name & address inside banner
    const textX = logoDataUrl ? margin + 30 : margin + 8;
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text((pdfHeader.schoolName || 'School').toUpperCase(), textX, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);        // slate-400
    if (pdfHeader.schoolAddressLine) {
      doc.text(pdfHeader.schoolAddressLine, textX, 26);
    }

    y = 46;

    // ── Exam title block ──────────────────────────────────────────────────
    doc.setFillColor(238, 242, 255);        // indigo-50
    doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 22, 3, 3, 'F');
    doc.setDrawColor(199, 210, 254);        // indigo-200
    doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 22, 3, 3, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 27, 75);           // indigo-950
    doc.text(title, pageWidth / 2, y + 4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(99, 102, 241);         // indigo-500
    const meta = [
      yearName ? `Session: ${yearName}` : '',
      `Class: ${className}`,
      `Section: ${sectionName}`,
    ].filter(Boolean).join('   •   ');
    doc.text(meta, pageWidth / 2, y + 11, { align: 'center' });

    y += 26;

    // ── Table ─────────────────────────────────────────────────────────────
    const headers = ['Date', 'Day', 'Subject', 'Venue'];
    const colWidths = [26, 30, 68, 62];
    const tableW = colWidths.reduce((s, v) => s + v, 0);
    const startX = margin;
    const headerRowH = 9;
    const lineH = 4.3;

    // Header row
    doc.setFillColor(30, 41, 59);           // slate-800
    doc.roundedRect(startX, y, tableW, headerRowH, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    let x = startX;
    headers.forEach((h, i) => {
      doc.text(h, x + colWidths[i] / 2, y + 6, { align: 'center' });
      x += colWidths[i];
    });
    y += headerRowH;

    // Data rows
    const rows = (group.subjects || [])
      .map((exam) => {
        const date = exam?.date ? new Date(exam.date) : null;
        const dateText = date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—';
        const dayText = date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString('en-US', { weekday: 'long' })
          : '—';
        const subjectName = exam?.subjectId?.name || exam?.subject || 'Subject';
        const buildingName = exam?.roomId?.floorId?.buildingId?.name;
        const floorName = exam?.roomId?.floorId?.name;
        const roomNumber = exam?.roomId?.roomNumber;
        const venueParts = [buildingName, floorName, roomNumber ? `Room ${roomNumber}` : null].filter(Boolean);
        const venue = venueParts.length ? venueParts.join(' / ') : (exam?.venue || '—');
        return [dateText, dayText, subjectName, venue];
      })
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

    if (!rows.length) {
      rows.push(['—', '—', 'No subjects added yet', '—']);
    }

    rows.forEach((row, idx) => {
      const wrapped = row.map((cell, i) => doc.splitTextToSize(String(cell || ''), colWidths[i] - 4));
      const lineCount = Math.max(...wrapped.map((lines) => lines.length));
      const rowH = Math.max(9, lineCount * lineH + 4.5);

      if (y + rowH > 285) {
        doc.addPage();
        y = 14;
      }
      // Alternating row fill
      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
      doc.rect(startX, y, tableW, rowH, 'F');

      // Row border
      doc.setDrawColor(226, 232, 240);
      doc.rect(startX, y, tableW, rowH, 'S');

      // Vertical column separators
      doc.setDrawColor(226, 232, 240);
      let sepX = startX;
      colWidths.forEach((w, i) => {
        sepX += w;
        if (i < colWidths.length - 1) {
          doc.line(sepX, y, sepX, y + rowH);
        }
      });

      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      let cx = startX;
      wrapped.forEach((lines, i) => {
        const align = i >= 2 ? 'left' : 'center';
        const textXPos = align === 'left' ? cx + 2.5 : cx + colWidths[i] / 2;
        lines.forEach((line, li) => {
          doc.text(line, textXPos, y + 5.7 + li * lineH, { align });
        });
        cx += colWidths[i];
      });
      y += rowH;
    });

    // ── Footer ────────────────────────────────────────────────────────────
    y += 8;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, y);
    doc.text(pdfHeader.schoolName || '', pageWidth - margin, y, { align: 'right' });

    const safeFile = `${title}_${className}_${sectionName}`.replace(/[^\w.-]+/g, '_').toLowerCase();
    const filename = `${safeFile}_schedule.pdf`;
    if (download) {
      doc.save(filename);
      return null;
    }
    return { blob: doc.output('blob'), filename };
  };

  /* ── group handlers ── */
  const openEditGroup   = (g)  => {
    setEditingGroupId(g._id);
    const classId = g.classId?._id || g.classId || '';
    const classItem = classes.find((item) => String(item._id) === String(classId));
    setGroupYearId(String(classItem?.academicYearId || ''));
    setGroupForm({ title: g.title||'', term: g.term||'Term 1', classId, sectionId: g.sectionId?._id||g.sectionId||'', status: g.status||'Scheduled', startDate: g.startDate||'', endDate: g.endDate||'' });
    setShowGroupModal(true);
  };

  const handleSaveGroup = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (!groupForm.title.trim()) throw new Error('Exam group title is required');
      // 'Published' is only ever set via the dedicated Publish Routine action
      // (which also uploads a fresh PDF) — omit it here so a plain edit save
      // never re-triggers the publish notice and wipes its attachment.
      const payload = { ...groupForm };
      if (payload.status === 'Published') delete payload.status;
      const res    = await fetch(`${API_BASE}/api/exam/groups/${editingGroupId}`, { method: 'PUT', headers: authH(), body: JSON.stringify(payload) });
      const data   = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed');
      toast.success('Exam updated!');
      setShowGroupModal(false);
      await loadGroups();
    } catch (err) { toast.error(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  /* Publish (or republish) the exam routine: generate the schedule PDF,
     upload it, then post one consolidated table-wise notice to the Notice
     Board for that class/section — replacing the old one-notice-per-subject
     behavior. */
  const handlePublishRoutine = async (group) => {
    const subCount = group.subjects?.length || 0;
    if (!subCount) { toast.error('Add at least one subject exam before publishing the routine'); return; }
    const alreadyPublished = group.status === 'Published';
    const scopeLabel = [group.classId?.name || group.grade, group.sectionId?.name || group.section].filter(Boolean).join(' - ');
    const conf = await Swal.fire({
      title: alreadyPublished ? 'Republish Exam Routine?' : 'Publish Exam Routine?',
      html: `This posts the ${subCount}-subject schedule${scopeLabel ? ` for <strong>${scopeLabel}</strong>` : ''} to the Notice Board, with the routine PDF attached, visible to students and parents.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      confirmButtonText: alreadyPublished ? 'Republish' : 'Publish',
    });
    if (!conf.isConfirmed) return;

    setPublishingGroupId(group._id);
    try {
      const pdfResult = await generateExamSchedulePdf(group, { download: false });
      let attachment = null;
      if (pdfResult?.blob) {
        const formData = new FormData();
        formData.append('file', new File([pdfResult.blob], pdfResult.filename, { type: 'application/pdf' }));
        formData.append('folder', 'exam-routines');
        formData.append('tags', 'exam,routine,pdf');
        const uploadRes = await fetch(`${API_BASE}/api/uploads/cloudinary/single`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: formData,
        });
        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) throw new Error(uploadData?.message || 'Routine PDF upload failed');
        const uploaded = uploadData?.files?.[0];
        if (uploaded?.secure_url) {
          attachment = {
            name: uploaded.originalName || pdfResult.filename,
            url: uploaded.secure_url,
            size: uploaded.bytes || 0,
            type: uploaded.format || 'pdf',
          };
        }
      }

      const res = await fetch(`${API_BASE}/api/exam/groups/${group._id}`, {
        method: 'PUT',
        headers: authH(),
        body: JSON.stringify({ status: 'Published', attachment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to publish routine');
      toast.success(alreadyPublished ? 'Routine republished' : 'Exam routine published to Notice Board');
      await loadGroups();
    } catch (err) {
      toast.error(err.message || 'Failed to publish routine');
    } finally {
      setPublishingGroupId('');
    }
  };

  const handleDeleteGroup = async (g) => {
    const count = g.subjects?.length || 0;
    const conf  = await Swal.fire({
      title: 'Delete Exam?',
      html: `Delete <strong>${g.title}</strong>${count ? ` and its <strong>${count} subject exam${count>1?'s':''}</strong>` : ''}?`,
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Delete',
    });
    if (!conf.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/api/exam/groups/${g._id}`, { method:'DELETE', headers: authH() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed');
      toast.success('Exam deleted');
      await loadGroups();
    } catch (err) { toast.error(err.message || 'Failed to delete'); }
  };

  /* ── create-exam wizard handlers ── */
  const openCreateWizard = () => {
    const activeYear = activeYears[0] || years[0];
    setWizardDetails({ ...EMPTY_WIZARD_DETAILS, yearId: activeYear?._id ? String(activeYear._id) : '' });
    setWizardSelections([]);
    setWizardActiveClassId('');
    setWizardClassSubjects({});
    setWizardSchedule({});
    setCopyFromOpen(false);
    setApplyToOpen(false);
    setApplyToTargets([]);
    setWizardStep(1);
    setActiveDraftId(null);
    setDraftState('idle');
    setAutoSavedAt(null);
    draftLastSnapshot.current = '';
    setShowWizard(true);
  };

  // Flush any unsaved edits to the cloud before actually closing (X / backdrop).
  const closeWizard = () => {
    if (draftAutoTimer.current) clearTimeout(draftAutoTimer.current);
    const hasContent = (wizardDetails.title || '').trim().length > 1;
    const snapshot = JSON.stringify({ wizardDetails, wizardSelections, wizardClassSubjects, wizardSchedule, wizardStep });
    if (hasContent && snapshot !== draftLastSnapshot.current) {
      draftLastSnapshot.current = snapshot;
      persistExamDraft({ silent: true });
    }
    setShowWizard(false);
  };

  const wizardKey = (classId, sectionId) => `${classId}__${sectionId}`;

  /* keep the step-4 accordion pointed at a selection that's actually chosen */
  useEffect(() => {
    if (!wizardSelections.some((sel) => wizardKey(sel.classId, sel.sectionId) === activeScheduleKey)) {
      const first = wizardSelections[0];
      setActiveScheduleKey(first ? wizardKey(first.classId, first.sectionId) : '');
    }
  }, [wizardSelections, activeScheduleKey]);

  /* ── cloud drafts: list / save / delete / resume ── */
  const draftAuthHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });

  const loadExamDrafts = async () => {
    try {
      const res = await fetch(EXAM_DRAFTS_API, { headers: draftAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setExamDrafts(Array.isArray(data.data) ? data.data : []);
    } catch { /* silent — drafts are a convenience, not critical */ }
  };

  const persistExamDraft = async ({ silent = false } = {}) => {
    if (draftState === 'saving') return;
    setDraftState('saving');
    try {
      const payload = {
        id: activeDraftId || undefined,
        label: wizardDetails.title?.trim() || 'Untitled draft',
        step: wizardStep,
        data: { wizardDetails, wizardSelections, wizardClassSubjects, wizardSchedule },
      };
      const res = await fetch(EXAM_DRAFTS_API, { method: 'POST', headers: draftAuthHeaders(), body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save draft');
      if (data?.data?._id) setActiveDraftId(data.data._id);
      if (data?.data) {
        setExamDrafts((prev) => [data.data, ...prev.filter((d) => d._id !== data.data._id)]);
      }
      setAutoSavedAt(Date.now());
      setDraftState('saved');
      setTimeout(() => setDraftState('idle'), 2500);
    } catch (err) {
      setDraftState('error');
      setTimeout(() => setDraftState('idle'), silent ? 2500 : 3000);
      if (!silent) toast.error(err.message || 'Could not save draft');
    }
  };

  const deleteExamDraft = async (id) => {
    setDeletingDraftId(id);
    try {
      await fetch(`${EXAM_DRAFTS_API}/${id}`, { method: 'DELETE', headers: draftAuthHeaders() });
    } catch { /* silent */ }
    if (activeDraftId === id) setActiveDraftId(null);
    setExamDrafts((prev) => prev.filter((d) => d._id !== id));
    setDeletingDraftId(null);
  };

  const resumeExamDraft = (draft) => {
    const d = draft?.data || {};
    setWizardDetails({ ...EMPTY_WIZARD_DETAILS, ...(d.wizardDetails || {}) });
    setWizardSelections(Array.isArray(d.wizardSelections) ? d.wizardSelections : []);
    setWizardClassSubjects(d.wizardClassSubjects && typeof d.wizardClassSubjects === 'object' ? d.wizardClassSubjects : {});
    setWizardSchedule(d.wizardSchedule && typeof d.wizardSchedule === 'object' ? d.wizardSchedule : {});
    setWizardActiveClassId('');
    setCopyFromOpen(false);
    setApplyToOpen(false);
    setApplyToTargets([]);
    setActiveDraftId(draft._id);
    setDraftState('idle');
    setAutoSavedAt(null);
    draftLastSnapshot.current = '';
    setWizardStep(Math.min(WIZARD_STEPS.length, Math.max(1, Number(draft.step) || 1)));
    setShowWizard(true);
    setShowDraftsModal(false);
  };

  // Auto-save: debounce edits to the wizard, once there's something worth keeping.
  useEffect(() => {
    if (!showWizard || wizardSaving) return undefined;
    const hasContent = (wizardDetails.title || '').trim().length > 1;
    const snapshot = JSON.stringify({ wizardDetails, wizardSelections, wizardClassSubjects, wizardSchedule, wizardStep });
    if (!hasContent || snapshot === draftLastSnapshot.current) return undefined;
    setDraftState((prev) => (prev === 'saving' ? prev : 'pending'));
    if (draftAutoTimer.current) clearTimeout(draftAutoTimer.current);
    draftAutoTimer.current = setTimeout(() => {
      draftLastSnapshot.current = snapshot;
      persistExamDraft({ silent: true });
    }, 2500);
    return () => draftAutoTimer.current && clearTimeout(draftAutoTimer.current);
  }, [showWizard, wizardSaving, wizardDetails, wizardSelections, wizardClassSubjects, wizardSchedule, wizardStep]);

  const toggleWizardSection = (cls, section) => {
    setWizardSelections((prev) => {
      const exists = prev.some((p) => p.classId === cls._id && p.sectionId === section._id);
      if (exists) return prev.filter((p) => !(p.classId === cls._id && p.sectionId === section._id));
      return [...prev, { classId: cls._id, className: cls.name, sectionId: section._id, sectionName: section.name }];
    });
  };

  const toggleWizardAllSections = (cls) => {
    const classSections = wizardSectionsForClass(cls._id);
    setWizardSelections((prev) => {
      const allSelected = classSections.length > 0 && classSections.every((sec) => prev.some((p) => p.classId === cls._id && p.sectionId === sec._id));
      const withoutClass = prev.filter((p) => p.classId !== cls._id);
      if (allSelected) return withoutClass;
      return [...withoutClass, ...classSections.map((sec) => ({ classId: cls._id, className: cls.name, sectionId: sec._id, sectionName: sec.name }))];
    });
  };

  const selectAllWizardClasses = () => {
    const all = [];
    wizardClasses.forEach((cls) => {
      wizardSectionsForClass(cls._id).forEach((sec) => {
        all.push({ classId: cls._id, className: cls.name, sectionId: sec._id, sectionName: sec.name });
      });
    });
    setWizardSelections(all);
  };
  const clearAllWizardClasses = () => setWizardSelections([]);

  /* ── step 3: which subjects apply to each class ── */
  const toggleWizardClassSubject = (classId, subjectId) => {
    setWizardClassSubjects((prev) => {
      const current = prev[classId] || [];
      const next = current.includes(subjectId) ? current.filter((id) => id !== subjectId) : [...current, subjectId];
      return { ...prev, [classId]: next };
    });
  };
  const setWizardClassSubjectIds = (classId, ids) => setWizardClassSubjects((prev) => ({ ...prev, [classId]: ids }));
  const wizardAutoSelectAllSubjects = () => {
    const next = {};
    wizardSelectedClasses.forEach(({ classId }) => { next[classId] = wizardSubjectsForClass(classId).map((s) => s._id); });
    setWizardClassSubjects(next);
  };
  const wizardCopySubjectsFrom = (fromClassId) => {
    if (!wizardActiveClassId || fromClassId === wizardActiveClassId) return;
    const fromNames = new Set((wizardClassSubjects[fromClassId] || [])
      .map((id) => subjects.find((s) => String(s._id) === String(id))?.name)
      .filter(Boolean));
    const matched = wizardSubjectsForClass(wizardActiveClassId).filter((s) => fromNames.has(s.name)).map((s) => s._id);
    setWizardClassSubjectIds(wizardActiveClassId, matched);
    setCopyFromOpen(false);
  };
  const wizardApplyToOtherClasses = () => {
    const fromNames = new Set((wizardClassSubjects[wizardActiveClassId] || [])
      .map((id) => subjects.find((s) => String(s._id) === String(id))?.name)
      .filter(Boolean));
    setWizardClassSubjects((prev) => {
      const next = { ...prev };
      applyToTargets.forEach((classId) => {
        next[classId] = wizardSubjectsForClass(classId).filter((s) => fromNames.has(s.name)).map((s) => s._id);
      });
      return next;
    });
    toast.success(`Applied to ${applyToTargets.length} class${applyToTargets.length !== 1 ? 'es' : ''}`);
    setApplyToTargets([]);
    setApplyToOpen(false);
  };

  /* ── step 4: per (class, section, subject) schedule ── */
  const wizardScheduleKey = (classId, sectionId, subjectId) => `${classId}__${sectionId}__${subjectId}`;
  const getWizardSchedule = (classId, sectionId, subjectId) => wizardSchedule[wizardScheduleKey(classId, sectionId, subjectId)] || EMPTY_WIZARD_SCHEDULE;
  const setWizardScheduleField = (classId, sectionId, subjectId, patch) => {
    const key = wizardScheduleKey(classId, sectionId, subjectId);
    setWizardSchedule((prev) => ({ ...prev, [key]: { ...(prev[key] || EMPTY_WIZARD_SCHEDULE), ...patch } }));
  };

  // Is this teacher already booked (an existing published exam, or another row in this
  // wizard) at the same date/time? Used to keep both the Teacher and Associated Teacher
  // pickers clash-free — for a manual pick, not just Auto-Schedule.
  const isTeacherBusyElsewhere = (name, dateStr, time, duration, excludeKey) => {
    if (!name || !dateStr || !time || !duration) return false;
    const committedClash = allExamsForConflict.some((ex) => {
      if (!ex.instructor) return false;
      if (!ex.instructor.split(',').map((t) => t.trim()).includes(name)) return false;
      return hasOverlap(dateStr, time, duration, ex);
    });
    if (committedClash) return true;
    return Object.entries(wizardSchedule).some(([key, s]) => {
      if (key === excludeKey) return false;
      if (s.primaryInstructor !== name && s.secondaryInstructor !== name) return false;
      return hasOverlap(dateStr, time, duration, s);
    });
  };
  const parseScheduleKey = (key) => {
    const [classId, sectionId] = String(key || '').split('__');
    return { classId, sectionId };
  };

  /* ── step 5: everything the review cards need, derived once ── */
  const stepFiveSummary = useMemo(() => {
    const totalClasses = wizardSelectedClasses.length;
    const totalSections = wizardSelections.length;
    const totalStudents = wizardSelections.reduce((sum, sel) => sum + students.filter((st) =>
      String(st.grade) === String(sel.className) && String(st.section) === String(sel.sectionName)
    ).length, 0);
    const totalSubjectEntries = wizardSelections.reduce((sum, sel) => sum + (wizardClassSubjects[sel.classId] || []).length, 0);
    const classesMissingSubjects = wizardSelectedClasses.filter((c) => (wizardClassSubjects[c.classId] || []).length === 0);

    const allScheduleEntries = [];
    wizardSelections.forEach((sel) => {
      (wizardClassSubjects[sel.classId] || []).forEach((subjectId) => {
        allScheduleEntries.push(getWizardSchedule(sel.classId, sel.sectionId, subjectId));
      });
    });

    const dates = allScheduleEntries.map((e) => e.date).filter(Boolean).sort();
    const examWindowStart = dates[0] || wizardDetails.startDate;
    const examWindowEnd = dates[dates.length - 1] || wizardDetails.endDate;

    const comboCounts = {};
    allScheduleEntries.forEach((e) => {
      if (e.time && e.duration) {
        const k = `${e.time}|${e.duration}`;
        comboCounts[k] = (comboCounts[k] || 0) + 1;
      }
    });
    const topCombo = Object.entries(comboCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const [commonTime, commonDuration] = topCombo ? topCombo.split('|') : ['', ''];

    const uniqueDates = Array.from(new Set(dates)).sort();
    let avgGapDays = null;
    if (uniqueDates.length > 1) {
      let totalGap = 0;
      for (let i = 1; i < uniqueDates.length; i += 1) {
        totalGap += Math.round((new Date(uniqueDates[i]) - new Date(uniqueDates[i - 1])) / 86400000);
      }
      avgGapDays = Math.round(totalGap / (uniqueDates.length - 1));
    }

    const buildingIdsUsed = new Set(allScheduleEntries.map((e) => e.buildingId).filter(Boolean).map(String));
    const buildingsUsedNames = buildings.filter((b) => buildingIdsUsed.has(String(b._id))).map((b) => b.name);

    const floorIdsUsed = new Set(allScheduleEntries.map((e) => e.floorId).filter(Boolean).map(String));
    const floorsUsedNames = floors.filter((f) => floorIdsUsed.has(String(f._id))).map((f) => f.name);

    const roomIdsUsed = new Set(allScheduleEntries.map((e) => e.roomId).filter(Boolean).map(String));
    const roomsUsedLabels = rooms.filter((r) => roomIdsUsed.has(String(r._id))).map((r) => r.roomNumber);

    const teacherNamesUsed = new Set();
    allScheduleEntries.forEach((e) => {
      if (e.primaryInstructor) teacherNamesUsed.add(e.primaryInstructor);
      if (e.secondaryInstructor) teacherNamesUsed.add(e.secondaryInstructor);
    });

    const routineFullyConfigured = allScheduleEntries.length > 0 && allScheduleEntries.every((e) => e.date && e.time && e.roomId);

    return {
      totalClasses, totalSections, totalStudents, totalSubjectEntries, classesMissingSubjects,
      examWindowStart, examWindowEnd, commonTime, commonDuration, avgGapDays,
      buildingsUsedNames, floorsUsedNames, roomsUsedLabels,
      teacherNamesUsed: Array.from(teacherNamesUsed), routineFullyConfigured,
    };
  }, [wizardSelectedClasses, wizardSelections, wizardClassSubjects, wizardSchedule, students, buildings, floors, rooms, wizardDetails.startDate, wizardDetails.endDate]);

  const addRoutineSubject = (classId, subjectId) => {
    if (!subjectId) return;
    setWizardClassSubjects((prev) => {
      const current = prev[classId] || [];
      if (current.includes(subjectId)) return prev;
      return { ...prev, [classId]: [...current, subjectId] };
    });
    setNewRoutineSubjectId('');
  };

  const removeRoutineSubject = (classId, subjectId) => {
    setWizardClassSubjects((prev) => ({ ...prev, [classId]: (prev[classId] || []).filter((id) => id !== subjectId) }));
    setWizardSchedule((prev) => {
      const next = { ...prev };
      wizardSelections.filter((s) => s.classId === classId).forEach((s) => {
        delete next[wizardScheduleKey(s.classId, s.sectionId, subjectId)];
      });
      return next;
    });
  };

  // Copy date/time/duration (never the room — that would double-book it) from one
  // class+section's routine to another, matching subjects by name.
  const copySchedule = (fromKey, toKeys) => {
    const from = parseScheduleKey(fromKey);
    const fromSubjectNames = new Map(
      (wizardClassSubjects[from.classId] || []).map((id) => {
        const schedule = getWizardSchedule(from.classId, from.sectionId, id);
        const name = subjects.find((s) => String(s._id) === String(id))?.name;
        return [name, schedule];
      })
    );
    toKeys.forEach((toKey) => {
      const to = parseScheduleKey(toKey);
      (wizardClassSubjects[to.classId] || []).forEach((subjectId) => {
        const name = subjects.find((s) => String(s._id) === String(subjectId))?.name;
        const source = name && fromSubjectNames.get(name);
        if (!source || !source.date) return;
        setWizardScheduleField(to.classId, to.sectionId, subjectId, { date: source.date, time: source.time, duration: source.duration });
      });
    });
  };

  const goWizardNext = () => {
    if (wizardStep === 1) {
      if (!wizardDetails.title.trim()) { toast.error('Exam title is required'); return; }
      if (!wizardDetails.yearId) { toast.error('Academic year is required'); return; }
    }
    if (wizardStep === 2 && wizardSelections.length === 0) {
      toast.error('Select at least one class & section'); return;
    }
    setWizardStep((s) => Math.min(WIZARD_STEPS.length, s + 1));
  };
  const goWizardBack = () => setWizardStep((s) => Math.max(1, s - 1));

  // Fills in date/time/building/floor/room/instructor for every subject that
  // doesn't already have a date — never touches rows already filled in manually.
  // Uses the same hasOverlap() conflict check as the single-exam Add Subject
  // modal, seeded with every already-published exam plus everything this run
  // itself assigns, so two classes/sections never land in the same room at once.
  const handleAutoSchedule = async () => {
    const totalSubjects = wizardSelections.reduce((n, sel) => n + (wizardClassSubjects[sel.classId] || []).length, 0);
    if (!totalSubjects) {
      toast.error('Add subjects in Step 3 first');
      return;
    }
    const confirm = await Swal.fire({
      title: 'Auto-schedule the routine?',
      html: 'This fills in the date, time, building, floor, room and a free teacher for every subject that doesn’t already have a date set. Rows you’ve already filled in manually are left untouched.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      confirmButtonText: 'Auto-Schedule',
    });
    if (!confirm.isConfirmed) return;

    setAutoScheduling(true);
    try {
      const roomBookings = [];
      const teacherBookings = [];
      allExamsForConflict.forEach((ex) => {
        if (!ex.date || !ex.time || !ex.duration) return;
        const dateStr = String(ex.date).slice(0, 10);
        const roomId = ex.roomId?._id || ex.roomId;
        if (roomId) roomBookings.push({ date: dateStr, time: ex.time, duration: ex.duration, roomId: String(roomId) });
        (ex.instructor || '').split(',').map((t) => t.trim()).filter(Boolean)
          .forEach((name) => teacherBookings.push({ date: dateStr, time: ex.time, duration: ex.duration, name }));
      });
      const isRoomFree = (dateStr, time, duration, roomId) =>
        !roomBookings.some((b) => b.roomId === String(roomId) && hasOverlap(dateStr, time, duration, b));
      const isTeacherFree = (dateStr, time, duration, name) =>
        !teacherBookings.some((b) => b.name === name && hasOverlap(dateStr, time, duration, b));
      // Pick at random among whoever's free, instead of always the first name in the
      // list — otherwise the same teacher ends up on nearly every subject.
      const pickRandomFreeTeacher = (dateStr, time, duration, excludeName) => {
        const free = teachers.filter((t) => t.name !== excludeName && isTeacherFree(dateStr, time, duration, t.name));
        if (!free.length) return null;
        return free[Math.floor(Math.random() * free.length)];
      };

      const startDate = wizardDetails.startDate ? new Date(wizardDetails.startDate) : new Date();
      let filled = 0;
      let unresolvedRooms = 0;
      let unresolvedTeachers = 0;
      let unresolvedAssociates = 0;

      wizardSelections.forEach((sel) => {
        const subjectIds = wizardClassSubjects[sel.classId] || [];
        let cursor = isWeekend(startDate) ? nextWeekday(startDate) : new Date(startDate);

        subjectIds.forEach((subjectId) => {
          const existing = getWizardSchedule(sel.classId, sel.sectionId, subjectId);
          const patch = {};
          let dateStr = existing.date;
          if (!dateStr) {
            dateStr = toIsoDate(cursor);
            cursor = nextWeekday(cursor);
            patch.date = dateStr;
          }
          const time = existing.time || '10:00';
          const duration = existing.duration || '60';
          if (!existing.time) patch.time = time;
          if (!existing.duration) patch.duration = duration;

          if (!existing.roomId) {
            const room = rooms.find((r) => isRoomFree(dateStr, time, duration, r._id));
            if (room) {
              roomBookings.push({ date: dateStr, time, duration, roomId: String(room._id) });
              patch.roomId = room._id;
              patch.floorId = room.floorId?._id || room.floorId || '';
              patch.buildingId = room.floorId?.buildingId?._id || room.floorId?.buildingId || '';
            } else {
              unresolvedRooms += 1;
            }
          }

          const primaryName = existing.primaryInstructor || null;
          if (!primaryName) {
            const teacher = pickRandomFreeTeacher(dateStr, time, duration);
            if (teacher) {
              teacherBookings.push({ date: dateStr, time, duration, name: teacher.name });
              patch.primaryInstructor = teacher.name;
            } else {
              unresolvedTeachers += 1;
            }
          }

          if (!existing.secondaryInstructor) {
            const excludeName = patch.primaryInstructor || primaryName;
            const associate = pickRandomFreeTeacher(dateStr, time, duration, excludeName);
            if (associate) {
              teacherBookings.push({ date: dateStr, time, duration, name: associate.name });
              patch.secondaryInstructor = associate.name;
            } else {
              unresolvedAssociates += 1;
            }
          }

          if (Object.keys(patch).length) {
            setWizardScheduleField(sel.classId, sel.sectionId, subjectId, patch);
            filled += 1;
          }
        });
      });

      if (!filled) {
        await Swal.fire({
          title: 'Nothing to schedule',
          text: 'Every subject already has a date set. Clear a date first if you want Auto-Schedule to redo it.',
          icon: 'info',
          confirmButtonColor: '#4f46e5',
        });
      } else {
        const lines = [`<li>Filled in <strong>${filled}</strong> subject row${filled !== 1 ? 's' : ''} — date, time, duration, building, floor, room, teacher and associated teacher.</li>`];
        if (unresolvedRooms) lines.push(`<li class="text-rose-600"><strong>${unresolvedRooms}</strong> row${unresolvedRooms !== 1 ? 's' : ''} couldn't find a free room — assign one manually.</li>`);
        if (unresolvedTeachers) lines.push(`<li class="text-rose-600"><strong>${unresolvedTeachers}</strong> row${unresolvedTeachers !== 1 ? 's' : ''} couldn't find a free teacher — assign one manually.</li>`);
        if (unresolvedAssociates) lines.push(`<li class="text-rose-600"><strong>${unresolvedAssociates}</strong> row${unresolvedAssociates !== 1 ? 's' : ''} couldn't find a free associated teacher — assign one manually.</li>`);
        await Swal.fire({
          title: 'Routine auto-scheduled',
          html: `<ul class="text-left text-sm space-y-1">${lines.join('')}</ul>`,
          icon: unresolvedRooms || unresolvedTeachers || unresolvedAssociates ? 'warning' : 'success',
          confirmButtonColor: '#4f46e5',
          confirmButtonText: 'Got it',
        });
      }
    } finally {
      setAutoScheduling(false);
    }
  };

  // Bulk-fills the "soft" defaults (start time, duration, preferred building/floor) that
  // Auto-Schedule and the per-row pickers build on — it deliberately never assigns a
  // specific room itself, so it can't double-book two subjects into the same room.
  const applyBulkEdit = () => {
    let applied = 0;
    wizardSelections.forEach((sel) => {
      (wizardClassSubjects[sel.classId] || []).forEach((subjectId) => {
        const existing = getWizardSchedule(sel.classId, sel.sectionId, subjectId);
        if (existing.date || existing.roomId) return; // never touch an already-scheduled subject
        setWizardScheduleField(sel.classId, sel.sectionId, subjectId, {
          time: bulkEditDefaults.time,
          duration: bulkEditDefaults.duration,
          buildingId: bulkEditDefaults.buildingId,
          floorId: bulkEditDefaults.floorId,
        });
        applied += 1;
      });
    });
    toast.success(applied ? `Applied defaults to ${applied} subject${applied !== 1 ? 's' : ''}` : 'Every subject already has a room or date set');
    setShowBulkEditModal(false);
  };

  const handleCreateFromWizard = async () => {
    if (!wizardSelections.length) { toast.error('Select at least one class & section'); setWizardStep(2); return; }
    setWizardSaving(true);
    try {
      let createdGroups = 0;
      let createdSubjects = 0;
      for (const sel of wizardSelections) {
        const res = await fetch(`${API_BASE}/api/exam/groups`, {
          method: 'POST',
          headers: authH(),
          body: JSON.stringify({
            title: wizardDetails.title.trim(),
            term: wizardDetails.term,
            classId: sel.classId,
            sectionId: sel.sectionId,
            status: wizardDetails.status,
            startDate: wizardDetails.startDate,
            endDate: wizardDetails.endDate,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `Failed to create exam for ${sel.className} — ${sel.sectionName}`);
        const groupId = data?.group?._id || data?._id;
        createdGroups += 1;

        const subjectIds = wizardClassSubjects[sel.classId] || [];
        for (const subjectId of subjectIds) {
          const schedule = getWizardSchedule(sel.classId, sel.sectionId, subjectId);
          const instructor = [schedule.primaryInstructor, schedule.secondaryInstructor].filter(Boolean).join(', ');
          const subRes = await fetch(`${API_BASE}/api/exam/add`, {
            method: 'POST',
            headers: authH(),
            body: JSON.stringify({
              groupId,
              classId: sel.classId,
              sectionId: sel.sectionId,
              title: wizardDetails.title.trim(),
              term: wizardDetails.term,
              subjectId,
              marks: schedule.marks === '' ? undefined : Number(schedule.marks),
              date: schedule.date,
              time: schedule.time,
              duration: schedule.duration === '' ? undefined : Number(schedule.duration),
              roomId: schedule.roomId || undefined,
              status: schedule.status || 'Scheduled',
              instructor,
            }),
          });
          const subData = await subRes.json().catch(() => ({}));
          if (!subRes.ok) throw new Error(subData?.error || `Failed to add a subject for ${sel.className} — ${sel.sectionName}`);
          createdSubjects += 1;
        }
      }
      toast.success(`Created ${createdGroups} exam${createdGroups !== 1 ? 's' : ''}${createdSubjects ? ` with ${createdSubjects} subject${createdSubjects !== 1 ? 's' : ''}` : ''}`);
      if (draftAutoTimer.current) clearTimeout(draftAutoTimer.current);
      draftLastSnapshot.current = '';
      if (activeDraftId) await deleteExamDraft(activeDraftId);
      setShowWizard(false);
      await loadGroups();
    } catch (err) {
      toast.error(err.message || 'Failed to create exam');
    } finally {
      setWizardSaving(false);
    }
  };

  /* ── subject handlers ── */
  const openAddSubject = (group) => {
    setActiveGroup(group);
    setEditingSubjectId(null);
    setSubjectForm({ ...EMPTY_SUBJECT });
    setShowSubjectModal(true);
  };

  const openEditSubject = (group, exam) => {
    setActiveGroup(group);
    setEditingSubjectId(exam._id);
    const instructors = (exam.instructor||'').split(',').map(s=>s.trim());
    setSubjectForm({
      subjectId:          exam.subjectId?._id||exam.subjectId||'',
      marks:              exam.marks??'100',
      date:               exam.date ? String(exam.date).slice(0,10) : '',
      time:               exam.time||'',
      duration:           exam.duration??'',
      buildingId:         exam.roomId?.floorId?.buildingId?._id||'',
      floorId:            exam.roomId?.floorId?._id||'',
      roomId:             exam.roomId?._id||exam.roomId||'',
      venue:              exam.venue||'',
      primaryInstructor:  instructors[0]||'',
      secondaryInstructor:instructors[1]||'',
      status:             exam.status||'Scheduled',
    });
    setShowSubjectModal(true);
  };

  const handleSaveSubject = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (!subjectForm.subjectId) throw new Error('Subject is required');
      const instructor = [subjectForm.primaryInstructor, subjectForm.secondaryInstructor].filter(Boolean).join(', ');
      const payload = {
        groupId:   activeGroup._id,
        classId:   activeGroup.classId?._id || activeGroup.classId,
        sectionId: activeGroup.sectionId?._id || activeGroup.sectionId,
        title:     activeGroup.title,
        term:      activeGroup.term,
        subjectId: subjectForm.subjectId,
        marks:     subjectForm.marks === '' ? undefined : Number(subjectForm.marks),
        date:      subjectForm.date,
        time:      subjectForm.time,
        duration:  subjectForm.duration === '' ? undefined : Number(subjectForm.duration),
        roomId:    subjectForm.roomId || undefined,
        venue:     subjectForm.venue,
        status:    subjectForm.status,
        instructor,
      };
      const url    = editingSubjectId ? `${API_BASE}/api/exam/${editingSubjectId}` : `${API_BASE}/api/exam/add`;
      const method = editingSubjectId ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: authH(), body: JSON.stringify(payload) });
      const data   = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed');
      toast.success(editingSubjectId ? 'Subject exam updated!' : 'Subject exam added!');
      setShowSubjectModal(false);
      await loadGroups();
    } catch (err) { toast.error(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDeleteSubject = async (exam) => {
    const conf = await Swal.fire({ title:'Delete Subject Exam?', html:`Delete <strong>${exam.subject || exam.subjectId?.name || 'this subject'}</strong>?`, icon:'warning', showCancelButton:true, confirmButtonColor:'#dc2626', confirmButtonText:'Delete' });
    if (!conf.isConfirmed) return;
    try {
      const res  = await fetch(`${API_BASE}/api/exam/${exam._id}`, { method:'DELETE', headers: authH() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed');
      toast.success('Subject exam deleted');
      await loadGroups();
    } catch (err) { toast.error(err.message || 'Failed to delete'); }
  };

  const toggleGroup = (id) => setExpandedGroups(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  /* ── stats ── */
  const totalSubjects = groups.reduce((n, g) => n + (g.subjects?.length||0), 0);
  const totalScheduled = groups.filter(g => g.status === 'Scheduled').length;
  const totalCompleted = groups.filter(g => g.status === 'Completed').length;
  const totalPublished = groups.filter(g => g.status === 'Published').length;

  /* ════════════ RENDER ════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-5 sm:px-6 sm:py-6 text-white shadow-xl">
        <div className="absolute -top-10 -right-10 h-52 w-52 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Examination Management</h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-400">Create exams, then add subject-wise papers inside each</p>
          </div>
          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 py-1 sm:mx-0 sm:px-0 sm:py-0 sm:overflow-visible sm:gap-3">
            {[{label:'Exams', val:groups.length},{label:'Subjects', val:totalSubjects},{label:'Scheduled', val:totalScheduled},{label:'Published', val:totalPublished},{label:'Completed', val:totalCompleted}].map(({label,val}) => (
              <div key={label} className="flex flex-col items-center rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm shrink-0 min-w-[74px]">
                <span className="text-lg sm:text-xl font-bold">{val}</span>
                <span className="text-[10px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* ── Toolbar ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="relative order-1 flex-1 sm:flex-none">
              <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={yearFilterId}
                onChange={(e) => setYearFilterId(e.target.value)}
                className="w-full sm:w-auto rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-4 py-2.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="">All Sessions</option>
                {years.map((year) => (
                  <option key={year._id} value={year._id}>
                    {year.name}{year.isActive ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={() => setShowDraftsModal(true)}
              className="relative order-2 shrink-0 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              <FileClock size={15} /> Drafts
              {examDrafts.length > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs font-semibold text-indigo-700">
                  {examDrafts.length}
                </span>
              )}
            </button>
            <button onClick={openCreateWizard}
              className="order-2 sm:order-last shrink-0 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200">
              <Plus size={15} /> Create Exam
            </button>
            <div className="relative order-3 basis-full sm:basis-0 sm:flex-1 sm:min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exam or class…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div className="relative order-4 flex-1 sm:flex-none">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select value={termFilter} onChange={e => setTermFilter(e.target.value)}
                className="w-full sm:w-auto rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-4 py-2.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none">
                <option value="all">All Terms</option>
                {TERM_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={() => { loadGroups(); loadUngrouped(); }} aria-label="Refresh"
              className="order-5 shrink-0 flex items-center justify-center gap-1.5 h-11 w-11 sm:h-auto sm:w-auto sm:px-3 sm:py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* ── Groups ── */}
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <Loader2 size={18} className="animate-spin text-indigo-400" /> Loading exams…
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <BookOpen size={22} className="text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-slate-500">No exams yet</p>
            <button onClick={openCreateWizard} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              <Plus size={12} /> Create your first exam
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map(group => {
              const isOpen   = expandedGroups.has(group._id);
              const termCls  = TERM_COLORS[group.term] || 'bg-slate-50 text-slate-600 border-slate-200';
              const statCls  = STATUS_COLORS[group.status] || 'bg-slate-100 text-slate-600';
              const subCount = group.subjects?.length || 0;
              return (
                <div key={group._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* ── group header ── */}
                  <div className="px-5 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                          <BookOpen size={16} className="text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-bold ${termCls}`}>{group.term}</span>
                            <h3 className="font-bold text-slate-800 text-base leading-tight">{group.title}</h3>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-400">
                            {(group.classId?.name || group.grade) && <span>Class {group.classId?.name || group.grade}</span>}
                            {(group.sectionId?.name || group.section) && <><span>·</span><span>Section {group.sectionId?.name || group.section}</span></>}
                            {group.startDate && <><span>·</span><span className="flex items-center gap-1"><Calendar size={10}/>{group.startDate}</span></>}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 sm:mt-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap sm:gap-2 sm:shrink-0">
                        {/* status + subject count */}
                        <div className="flex items-center gap-2 sm:contents">
                          <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statCls}`}>{group.status}</span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            <FileText size={11} /> {subCount} Subject{subCount !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* primary step action */}
                        <button onClick={() => openAddSubject(group)}
                          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors">
                          <Plus size={12} /> Step 2: Add Subject
                        </button>

                        {/* routine + publish */}
                        <div className="grid grid-cols-2 gap-2 sm:contents">
                          <button
                            onClick={() => generateExamSchedulePdf(group)}
                            className="flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            <FileText size={12} />
                            <span className="sm:hidden">Routine</span>
                            <span className="hidden sm:inline">Download Routine</span>
                          </button>
                          <button
                            onClick={() => handlePublishRoutine(group)}
                            disabled={!subCount || publishingGroupId === group._id}
                            title={!subCount ? 'Add at least one subject exam first' : undefined}
                            className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                              group.status === 'Published'
                                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'
                            }`}
                          >
                            {publishingGroupId === group._id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <CheckCircle2 size={12} />}
                            {publishingGroupId === group._id
                              ? 'Publishing…'
                              : group.status === 'Published'
                                ? <><span className="sm:hidden">Republish</span><span className="hidden sm:inline">Republish Routine</span></>
                                : <><span className="sm:hidden">Publish</span><span className="hidden sm:inline">Publish Routine</span></>}
                          </button>
                        </div>

                        {/* edit / delete / view */}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 sm:contents sm:border-0 sm:pt-0">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditGroup(group)}
                              className="h-9 w-9 sm:h-8 sm:w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => handleDeleteGroup(group)}
                              className="h-9 w-9 sm:h-8 sm:w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <button onClick={() => toggleGroup(group._id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
                            <ChevronRight size={13} className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                            {isOpen ? 'Hide' : 'View'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── subject rows ── */}
                  {isOpen && (
                    <div className="border-t border-slate-100">
                      {subCount === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
                          <FileText size={20} className="text-slate-300" />
                          <p className="text-xs font-medium">Step 2 pending: add subjects for this exam</p>
                          <button onClick={() => openAddSubject(group)}
                            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                            <Plus size={11} /> Add first subject
                          </button>
                        </div>
                      ) : (
                        <>
                        {/* ── mobile: stacked subject cards ── */}
                        <div className="sm:hidden divide-y divide-slate-100 bg-slate-50/40">
                          {group.subjects.map(exam => {
                            const venueStr = exam.roomId?.floorId?.buildingId?.name
                              ? `${exam.roomId.floorId.buildingId.name} / ${exam.roomId.floorId.name} / ${exam.roomId.roomNumber}`
                              : (exam.venue || null);
                            const sCls = STATUS_COLORS[exam.status] || 'bg-slate-100 text-slate-600';
                            const isPast = exam.date && new Date(exam.date) < new Date();
                            return (
                              <div key={exam._id} className="px-4 py-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-800 truncate">{exam.subjectId?.name || exam.subject || '—'}</p>
                                    {exam.subjectId?.code && <p className="text-[11px] text-slate-400">{exam.subjectId.code}</p>}
                                  </div>
                                  <span className={`shrink-0 inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${sCls}`}>{exam.status || '—'}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                  {exam.date ? (
                                    <span className={`flex items-center gap-1 ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
                                      <Calendar size={11} />
                                      {new Date(exam.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                                      {exam.time ? ` · ${exam.time}` : ''}
                                    </span>
                                  ) : <span className="text-slate-300">Date not set</span>}
                                  <span className="flex items-center gap-1"><Award size={12} className="text-amber-400" />{exam.marks ?? '—'} marks</span>
                                  {exam.instructor && <span className="flex items-center gap-1"><User size={11} />{exam.instructor}</span>}
                                </div>
                                {venueStr && (
                                  <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
                                    <MapPin size={11} className="mt-0.5 shrink-0 text-slate-400" />{venueStr}
                                  </p>
                                )}
                                <div className="mt-2 flex items-center gap-2">
                                  <button onClick={() => openEditSubject(group, exam)}
                                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 active:bg-slate-50">
                                    <Edit2 size={12} /> Edit
                                  </button>
                                  <button onClick={() => handleDeleteSubject(exam)}
                                    className="flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-600 active:bg-rose-100">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* ── desktop: subject table ── */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50">
                                {['Subject','Date & Time','Venue','Marks','Invigilator','Status',''].map((h,i) => (
                                  <th key={i} className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {group.subjects.map(exam => {
                                const venueStr = exam.roomId?.floorId?.buildingId?.name
                                  ? `${exam.roomId.floorId.buildingId.name} / ${exam.roomId.floorId.name} / ${exam.roomId.roomNumber}`
                                  : (exam.venue || null);
                                const sCls = STATUS_COLORS[exam.status] || 'bg-slate-100 text-slate-600';
                                const isPast = exam.date && new Date(exam.date) < new Date();
                                return (
                                  <tr key={exam._id} className="hover:bg-indigo-50/20 transition-colors group">
                                    <td className="px-4 py-3">
                                      <p className="font-semibold text-slate-800">{exam.subjectId?.name || exam.subject || '—'}</p>
                                      {exam.subjectId?.code && <p className="text-xs text-slate-400">{exam.subjectId.code}</p>}
                                    </td>
                                    <td className="px-4 py-3">
                                      {exam.date ? (
                                        <div className="flex flex-col gap-0.5">
                                          <span className={`flex items-center gap-1.5 text-xs font-medium ${isPast ? 'text-slate-400' : 'text-slate-700'}`}>
                                            <Calendar size={11} />{new Date(exam.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                                          </span>
                                          {exam.time && <span className="flex items-center gap-1.5 text-xs text-slate-400"><Clock size={11}/>{exam.time}</span>}
                                          {exam.duration && <span className="text-xs text-slate-400">{exam.duration} min</span>}
                                        </div>
                                      ) : <span className="text-slate-300 text-xs">Not set</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                      {venueStr ? (
                                        <span className="flex items-start gap-1.5 text-xs text-slate-500 max-w-[160px]">
                                          <MapPin size={11} className="shrink-0 mt-0.5 text-slate-400"/>{venueStr}
                                        </span>
                                      ) : <span className="text-slate-300 text-xs">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1">
                                        <Award size={12} className="text-amber-400 shrink-0"/>
                                        <span className="font-semibold text-slate-700">{exam.marks ?? '—'}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      {exam.instructor ? (
                                        <span className="flex items-center gap-1 text-xs text-slate-500"><User size={10}/>{exam.instructor}</span>
                                      ) : <span className="text-slate-300 text-xs">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold ${sCls}`}>{exam.status||'—'}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditSubject(group, exam)}
                                          className="h-7 w-7 flex items-center justify-center rounded-lg text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                          <Edit2 size={13}/>
                                        </button>
                                        <button onClick={() => handleDeleteSubject(exam)}
                                          className="h-7 w-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                          <Trash2 size={13}/>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Ungrouped / Legacy exams ── */}
        {ungrouped.length > 0 && (
          <details className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-slate-500 flex items-center gap-2 select-none">
              <FileText size={14} /> {ungrouped.length} Legacy Exam{ungrouped.length!==1?'s':''} (without groups)
            </summary>
            <div className="border-t border-slate-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50">{['Exam','Subject','Term','Class','Status',''].map((h,i)=><th key={i} className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {ungrouped.map(ex => (
                    <tr key={ex._id} className="hover:bg-indigo-50/20 group">
                      <td className="px-4 py-3 font-semibold text-slate-800">{ex.title||'—'}</td>
                      <td className="px-4 py-3 text-slate-600">{ex.subjectId?.name||ex.subject||'—'}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-bold ${TERM_COLORS[ex.term]||'bg-slate-50 text-slate-600 border-slate-200'}`}>{ex.term||'—'}</span></td>
                      <td className="px-4 py-3 text-slate-600">{ex.classId?.name||ex.grade||'—'} {ex.sectionId?.name||ex.section||''}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold ${STATUS_COLORS[ex.status]||'bg-slate-100 text-slate-600'}`}>{ex.status||'—'}</span></td>
                      <td className="px-4 py-3">
                        <button onClick={async () => { const c=await Swal.fire({title:'Delete?',html:`Delete <strong>${ex.title||'this exam'}</strong>?`,icon:'warning',showCancelButton:true,confirmButtonColor:'#dc2626',confirmButtonText:'Delete'}); if(!c.isConfirmed)return; const r=await fetch(`${API_BASE}/api/exam/${ex._id}`,{method:'DELETE',headers:authH()}); if(r.ok){toast.success('Deleted');loadUngrouped();}else{toast.error('Failed');} }}
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={13}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>

      {/* ══════════ EDIT GROUP MODAL ══════════ */}
      <Modal show={showGroupModal} onClose={() => setShowGroupModal(false)}
        title="Edit Exam" subtitle="Update exam details"
        icon={BookOpen} iconColor="bg-indigo-600" maxWidth="sm:max-w-lg">
        <form onSubmit={handleSaveGroup} className="space-y-4">
          <Field label="Exam Title">
            <input value={groupForm.title} onChange={e => setGroupForm(p=>({...p,title:e.target.value}))} className={inp} placeholder="e.g. First Term 2024-25" required />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Exam Type / Term">
              <select value={groupForm.term} onChange={e => setGroupForm(p=>({...p,term:e.target.value}))} className={inp}>
                {TERM_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Status">
              {groupForm.status === 'Published' ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 size={14} /> Published — use Republish Routine to update
                </div>
              ) : (
                <select value={groupForm.status} onChange={e => setGroupForm(p=>({...p,status:e.target.value}))} className={inp}>
                  {GROUP_STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Academic Year">
              <select
                value={groupYearId}
                onChange={e => {
                  setGroupYearId(e.target.value);
                  setGroupForm(p => ({ ...p, classId: '', sectionId: '' }));
                }}
                className={inp}
                required
              >
                <option value="">Select active year</option>
                {activeYears.map(y => <option key={y._id} value={y._id}>{y.name} (Active)</option>)}
              </select>
            </Field>
            <div />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Class">
              <select
                value={groupForm.classId}
                onChange={e => setGroupForm(p=>({...p,classId:e.target.value,sectionId:''}))}
                className={inp}
                disabled={!groupYearId}
                required
              >
                <option value="">{groupYearId ? 'Select class' : 'Select active year first'}</option>
                {modalClasses.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Section">
              <select
                value={groupForm.sectionId}
                onChange={e => setGroupForm(p=>({...p,sectionId:e.target.value}))}
                className={inp}
                disabled={!groupForm.classId}
              >
                <option value="">Select section</option>
                {groupFormSections.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Start Date"><input type="date" value={groupForm.startDate} onChange={e => setGroupForm(p=>({...p,startDate:e.target.value}))} className={inp}/></Field>
            <Field label="End Date"><input type="date" value={groupForm.endDate} onChange={e => setGroupForm(p=>({...p,endDate:e.target.value}))} className={inp}/></Field>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button type="button" onClick={() => setShowGroupModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 shadow-md shadow-indigo-200">
              {saving ? <Loader2 size={14} className="animate-spin"/> : <BookOpen size={14}/>}
              {saving ? 'Saving…' : 'Update Exam'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══════════ CREATE EXAM WIZARD ══════════ */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeWizard} />
          <div className="relative bg-white w-full my-4 sm:my-0 rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100">
            <button onClick={closeWizard} aria-label="Close"
              className="absolute right-4 top-4 z-10 h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X size={16} />
            </button>

            {/* step progress header */}
            <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-slate-100">
              <WizardStepper step={wizardStep} />
            </div>

            {/* step content */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
                <div>
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Step {wizardStep} of {WIZARD_STEPS.length}</p>
                  <h2 className="text-2xl font-bold text-slate-900 mt-1">{WIZARD_STEPS[wizardStep - 1].title}</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {wizardStep === 1 && 'Enter the basic information for this exam.'}
                    {wizardStep === 2 && 'Choose the classes and sections for which this exam will be applicable.'}
                    {wizardStep === 3 && 'Add the subject-wise papers for each selected class & section.'}
                    {wizardStep === 4 && 'Review the generated schedule for each class & section.'}
                    {wizardStep === 5 && 'Confirm everything looks right, then create the exam.'}
                  </p>
                </div>
                {wizardStep === 2 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={selectAllWizardClasses}
                      className="px-4 py-2 rounded-xl border border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-colors">
                      Select All Classes
                    </button>
                    <button type="button" onClick={clearAllWizardClasses}
                      className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 transition-colors">
                      Clear All
                    </button>
                  </div>
                )}
                {wizardStep === 3 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                      <button type="button" onClick={() => setCopyFromOpen((v) => !v)} disabled={wizardSelectedClasses.length < 2}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        <Copy size={14} /> Copy Subjects From <ChevronDown size={13} />
                      </button>
                      {copyFromOpen && (
                        <div className="absolute right-0 mt-2 z-20 w-52 rounded-xl border border-slate-100 bg-white shadow-xl py-1.5">
                          {wizardSelectedClasses.filter((c) => c.classId !== wizardActiveClassId).map((c) => (
                            <button key={c.classId} type="button" onClick={() => wizardCopySubjectsFrom(c.classId)}
                              className="w-full text-left px-3.5 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600">
                              {c.className}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => wizardActiveClassId && setWizardClassSubjectIds(wizardActiveClassId, wizardSubjectsForClass(wizardActiveClassId).map((s) => s._id))}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors">
                      Use Default Subjects
                    </button>
                    <button type="button" onClick={wizardAutoSelectAllSubjects}
                      className="px-4 py-2 rounded-xl border border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-colors">
                      Auto-Select All
                    </button>
                  </div>
                )}
                {wizardStep === 4 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => setShowBulkEditModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors">
                      <ListChecks size={14} /> Bulk Edit
                    </button>
                    <button type="button" onClick={handleAutoSchedule} disabled={autoScheduling}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 disabled:opacity-60 transition-colors">
                      {autoScheduling ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                      {autoScheduling ? 'Scheduling…' : 'Auto Schedule'}
                    </button>
                  </div>
                )}
                {wizardStep === 5 && (
                  <button type="button" onClick={() => setWizardStep(1)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors shrink-0">
                    <Edit2 size={13} /> Edit Details
                  </button>
                )}
              </div>

              {wizardStep === 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <WizardField label="Exam Title" required>
                    <input value={wizardDetails.title} onChange={e => setWizardDetails(p => ({ ...p, title: e.target.value }))}
                      className={inp} placeholder="e.g. Summative Assessment – Term 1" />
                  </WizardField>
                  <WizardField label="Exam Type / Term" required>
                    <WizardSelect value={wizardDetails.term} onChange={e => setWizardDetails(p => ({ ...p, term: e.target.value }))}>
                      {TERM_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </WizardSelect>
                  </WizardField>
                  <WizardField label="Academic Year" required>
                    <WizardSelect value={wizardDetails.yearId} onChange={e => setWizardDetails(p => ({ ...p, yearId: e.target.value }))}>
                      <option value="">Select year</option>
                      {years.map(y => <option key={y._id} value={y._id}>{y.name}{y.isActive ? ' (Active)' : ''}</option>)}
                    </WizardSelect>
                  </WizardField>
                  <WizardField label="Status" required>
                    <WizardSelect value={wizardDetails.status} onChange={e => setWizardDetails(p => ({ ...p, status: e.target.value }))}>
                      {GROUP_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </WizardSelect>
                  </WizardField>
                  <WizardField label="Start Date" required>
                    <WizardDateInput value={wizardDetails.startDate} onChange={e => setWizardDetails(p => ({ ...p, startDate: e.target.value }))} />
                  </WizardField>
                  <WizardField label="End Date" required>
                    <WizardDateInput value={wizardDetails.endDate} onChange={e => setWizardDetails(p => ({ ...p, endDate: e.target.value }))} />
                  </WizardField>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  {wizardClasses.length === 0 ? (
                    <p className="text-sm text-slate-400">No classes found for the selected academic year.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {wizardClasses.map((cls, idx) => {
                        const classSections = wizardSectionsForClass(cls._id);
                        const selectedCount = wizardSelections.filter((p) => p.classId === cls._id).length;
                        const allSelected = classSections.length > 0 && selectedCount === classSections.length;
                        const avatarCls = CLASS_AVATAR_PALETTE[idx % CLASS_AVATAR_PALETTE.length];
                        return (
                          <div key={cls._id}
                            className={`relative rounded-2xl border p-4 transition-colors ${
                              allSelected ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-200 bg-white'
                            }`}>
                            <button type="button" onClick={() => toggleWizardAllSections(cls)} disabled={classSections.length === 0}
                              aria-label={`Select all sections of ${cls.name}`}
                              className={`absolute top-3 left-3 h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                                allSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
                              } ${classSections.length === 0 ? 'cursor-not-allowed opacity-50' : ''}`}>
                              {allSelected && <Check size={12} className="text-white" />}
                            </button>

                            <div className="flex items-center gap-3 pl-6">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${avatarCls}`}>
                                <Users size={16} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800">{cls.name}</p>
                                <p className="text-xs text-slate-400">{classSections.length} section{classSections.length !== 1 ? 's' : ''}</p>
                              </div>
                            </div>

                            {classSections.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2 mt-3">
                                <button type="button" onClick={() => toggleWizardAllSections(cls)}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                  <span className={`h-4 w-4 rounded-md border flex items-center justify-center ${allSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                    {allSelected && <Check size={10} className="text-white" />}
                                  </span>
                                  All Sections
                                </button>
                                {classSections.map((sec) => {
                                  const isSelected = wizardSelections.some((p) => p.classId === cls._id && p.sectionId === sec._id);
                                  return (
                                    <button key={sec._id} type="button" onClick={() => toggleWizardSection(cls, sec)} disabled={allSelected}
                                      className={`flex items-center gap-1 px-1.5 py-1 rounded-md border text-xs font-semibold transition-colors ${
                                        isSelected && !allSelected ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-400'
                                      } ${allSelected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}>
                                      <span className={`h-3.5 w-3.5 rounded-sm border flex items-center justify-center ${isSelected && !allSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                        {isSelected && !allSelected && <Check size={9} className="text-white" />}
                                      </span>
                                      {sec.name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {wizardSelections.length > 0 && (() => {
                    const classCount = new Set(wizardSelections.map((p) => p.classId)).size;
                    return (
                      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        <span className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                          <Check size={12} className="text-white" />
                        </span>
                        <span className="font-semibold">{classCount} Class{classCount !== 1 ? 'es' : ''} selected</span>
                        <span className="text-emerald-400">•</span>
                        <span className="font-semibold">{wizardSelections.length} Section{wizardSelections.length !== 1 ? 's' : ''} selected</span>
                        <span className="text-emerald-400">•</span>
                        <span>This exam will be applicable to all selected classes and sections.</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4">
                  {wizardSelectedClasses.length === 0 ? (
                    <p className="text-sm text-slate-400">Go back and select at least one class & section first.</p>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* sidebar: one row per selected class */}
                      <div className="sm:w-64 shrink-0 rounded-2xl border border-slate-200 overflow-hidden self-start">
                        {wizardSelectedClasses.map((c) => {
                          const isActive = c.classId === wizardActiveClassId;
                          const configured = (wizardClassSubjects[c.classId] || []).length > 0;
                          return (
                            <button key={c.classId} type="button" onClick={() => setWizardActiveClassId(c.classId)}
                              className={`w-full flex items-center gap-2.5 px-3.5 py-3 text-left border-b border-b-slate-100 last:border-b-0 transition-colors ${
                                isActive ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent hover:bg-slate-50'
                              }`}>
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${wizardClassAvatar(c.classId)}`}>
                                <Users size={14} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-800 truncate">{c.className}</p>
                                <p className="text-xs text-slate-400">{c.sectionCount} section{c.sectionCount !== 1 ? 's' : ''}</p>
                              </div>
                              <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                                configured ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-400 border border-slate-200'
                              }`}>
                                {configured && <Check size={9} />}
                                {configured ? 'Configured' : 'Not configured'}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* subject checklist for the active class */}
                      <div className="flex-1 rounded-2xl border border-slate-200 p-4 space-y-4">
                        {(() => {
                          const activeClass = wizardSelectedClasses.find((c) => c.classId === wizardActiveClassId);
                          if (!activeClass) return <p className="text-sm text-slate-400">Select a class.</p>;
                          const subjectsForClass = wizardSubjectsForClass(activeClass.classId);
                          const selectedIds = wizardClassSubjects[activeClass.classId] || [];
                          const allSelected = subjectsForClass.length > 0 && selectedIds.length === subjectsForClass.length;
                          return (
                            <>
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{activeClass.className} Subjects
                                    <span className="text-xs font-normal text-slate-400 ml-1.5">(These subjects will be applied to all {activeClass.sectionCount} section{activeClass.sectionCount !== 1 ? 's' : ''})</span>
                                  </p>
                                </div>
                                <button type="button" disabled={subjectsForClass.length === 0}
                                  onClick={() => setWizardClassSubjectIds(activeClass.classId, allSelected ? [] : subjectsForClass.map((s) => s._id))}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40 shrink-0">
                                  <span className={`h-4 w-4 rounded-md border flex items-center justify-center ${allSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                    {allSelected && <Check size={10} className="text-white" />}
                                  </span>
                                  Select All
                                </button>
                              </div>

                              {subjectsForClass.length === 0 ? (
                                <p className="text-xs text-slate-400">No subjects configured for this class yet — add subjects under Academic Setup first.</p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                  {subjectsForClass.map((s) => {
                                    const isChecked = selectedIds.includes(s._id);
                                    return (
                                      <button key={s._id} type="button" onClick={() => toggleWizardClassSubject(activeClass.classId, s._id)}
                                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                                          isChecked ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                                        }`}>
                                        <span className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                          {isChecked && <Check size={10} className="text-white" />}
                                        </span>
                                        <span className="truncate">{s.name}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl bg-sky-50 border border-sky-100 px-3.5 py-2.5">
                                <p className="text-sm text-sky-700 flex items-center gap-1.5">
                                  <Info size={14} className="shrink-0" /> {selectedIds.length} subject{selectedIds.length !== 1 ? 's' : ''} selected for {activeClass.className}
                                </p>
                                <div className="relative">
                                  <button type="button" onClick={() => setApplyToOpen((v) => !v)} disabled={wizardSelectedClasses.length < 2 || selectedIds.length === 0}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-200 bg-white text-sky-700 text-xs font-semibold hover:bg-sky-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                    Apply to Other Classes <ChevronDown size={12} />
                                  </button>
                                  {applyToOpen && (
                                    <div className="absolute right-0 mt-2 z-20 w-56 rounded-xl border border-slate-100 bg-white shadow-xl p-3 space-y-2">
                                      {wizardSelectedClasses.filter((c) => c.classId !== activeClass.classId).map((c) => (
                                        <label key={c.classId} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                          <input type="checkbox" checked={applyToTargets.includes(c.classId)}
                                            onChange={() => setApplyToTargets((prev) => prev.includes(c.classId) ? prev.filter((id) => id !== c.classId) : [...prev, c.classId])} />
                                          {c.className}
                                        </label>
                                      ))}
                                      <button type="button" onClick={wizardApplyToOtherClasses} disabled={applyToTargets.length === 0}
                                        className="w-full mt-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40">
                                        Apply
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100 px-3.5 py-2.5 text-sm text-indigo-700">
                    <Info size={14} className="shrink-0" />
                    <span><span className="font-semibold">Tip:</span> You can copy subjects from one class to another to save time.</span>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* sidebar */}
                    <div className="w-40 shrink-0 rounded-2xl border border-slate-200 overflow-hidden self-start">
                      <div className="p-2.5 border-b border-slate-100">
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input value={scheduleSearch} onChange={(e) => setScheduleSearch(e.target.value)}
                            placeholder="Search class or section..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs focus:border-indigo-400 focus:outline-none" />
                        </div>
                      </div>
                      <div className="max-h-[440px] overflow-y-auto">
                        {wizardSelections
                          .filter((sel) => `${sel.className} ${sel.sectionName}`.toLowerCase().includes(scheduleSearch.trim().toLowerCase()))
                          .map((sel) => {
                            const key = wizardKey(sel.classId, sel.sectionId);
                            const subjectCount = (wizardClassSubjects[sel.classId] || []).length;
                            const isActive = key === activeScheduleKey;
                            return (
                              <button key={key} type="button" onClick={() => setActiveScheduleKey(key)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-b-slate-100 last:border-b-0 transition-colors ${
                                  isActive ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent hover:bg-slate-50'
                                }`}>
                                <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${wizardClassAvatar(sel.classId)}`}>
                                  <Users size={12} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-slate-800 truncate">{sel.className} - {sel.sectionName}</p>
                                  {subjectCount === 0 ? (
                                    <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertTriangle size={10} /> No subjects</p>
                                  ) : (
                                    <p className="text-[11px] text-slate-400">{subjectCount} subjects</p>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* accordion of every selected class + section */}
                    <div className="flex-1 space-y-3 min-w-0">
                      {wizardSelections.map((sel) => {
                        const key = wizardKey(sel.classId, sel.sectionId);
                        const isExpanded = key === activeScheduleKey;
                        const subjectIds = wizardClassSubjects[sel.classId] || [];
                        const subjectsForClass = wizardSubjectsForClass(sel.classId);
                        const availableToAdd = subjectsForClass.filter((s) => !subjectIds.includes(s._id));
                        return (
                          <div key={key} className="rounded-2xl border border-slate-200 overflow-hidden">
                            <button type="button" onClick={() => setActiveScheduleKey(isExpanded ? '' : key)}
                              className="w-full flex items-center gap-2.5 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${wizardClassAvatar(sel.classId)}`}>
                                <Users size={14} />
                              </div>
                              <p className="text-sm font-bold text-slate-800">Class {sel.className} — {sel.sectionName}</p>
                              <span className="text-xs font-semibold text-slate-400">{subjectIds.length} subject{subjectIds.length !== 1 ? 's' : ''}</span>
                              <ChevronDown size={15} className={`ml-auto text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {isExpanded && (
                              <div>
                                <div className="flex items-center justify-end px-4 py-2.5 border-b border-slate-100">
                                  <div className="relative">
                                    <button type="button" onClick={() => setScheduleCopyOpenFor((v) => (v === key ? '' : key))}
                                      disabled={wizardSelections.length < 2}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                      Copy Schedule <ChevronDown size={12} />
                                    </button>
                                    {scheduleCopyOpenFor === key && (
                                      <div className="absolute right-0 mt-2 z-20 w-52 rounded-xl border border-slate-100 bg-white shadow-xl py-1.5">
                                        {wizardSelections.filter((s) => wizardKey(s.classId, s.sectionId) !== key).map((s) => {
                                          const otherKey = wizardKey(s.classId, s.sectionId);
                                          return (
                                            <button key={otherKey} type="button"
                                              onClick={() => { copySchedule(otherKey, [key]); setScheduleCopyOpenFor(''); toast.success('Schedule copied'); }}
                                              className="w-full text-left px-3.5 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600">
                                              {s.className} - {s.sectionName}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {subjectIds.length === 0 ? (
                                  <p className="px-4 py-4 text-xs text-slate-400">No subjects chosen for this class in Step 3.</p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs min-w-[900px] [&_td]:align-top">
                                      <thead>
                                        <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/60">
                                          <th className="px-2 py-1.5 w-6">#</th>
                                          <th className="px-2 py-1.5 w-20">Subject</th>
                                          <th className="px-2 py-1.5 w-20">Date</th>
                                          <th className="px-2 py-1.5 w-16">Start</th>
                                          <th className="px-2 py-1.5 w-16">End</th>
                                          <th className="px-2 py-1.5 w-20">Duration</th>
                                          <th className="px-2 py-1.5 w-32">Building / Floor / Room</th>
                                          <th className="px-2 py-1.5 w-28">Teacher / Associated</th>
                                          <th className="px-2 py-1.5 w-8">Action</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {subjectIds.map((subjectId, idx) => {
                                          const subject = subjectsForClass.find((s) => String(s._id) === String(subjectId));
                                          const schedule = getWizardSchedule(sel.classId, sel.sectionId, subjectId);
                                          const floorsForBuilding = floors.filter((f) => String(f.buildingId?._id || f.buildingId) === String(schedule.buildingId));
                                          const roomsForFloor = rooms.filter((r) => String(r.floorId?._id || r.floorId) === String(schedule.floorId));
                                          const scheduleRowKey = wizardScheduleKey(sel.classId, sel.sectionId, subjectId);
                                          const teacherOptions = (excludeName) => teachers.filter((t) =>
                                            t.name === excludeName ||
                                            !isTeacherBusyElsewhere(t.name, schedule.date, schedule.time, schedule.duration, scheduleRowKey)
                                          );
                                          const primaryOptions = teacherOptions(schedule.primaryInstructor).filter((t) => t.name !== schedule.secondaryInstructor);
                                          const secondaryOptions = teacherOptions(schedule.secondaryInstructor).filter((t) => t.name !== schedule.primaryInstructor);
                                          return (
                                            <tr key={subjectId}>
                                              <td className="px-2 py-1.5 text-slate-400">{idx + 1}</td>
                                              <td className="px-2 py-1.5 font-semibold text-slate-700 truncate max-w-[90px]" title={subject?.name}>{subject?.name || 'Subject'}</td>
                                              <td className="px-1 py-1.5 w-20">
                                                <WizardDateInput dense value={schedule.date} onChange={(e) => setWizardScheduleField(sel.classId, sel.sectionId, subjectId, { date: e.target.value })} />
                                              </td>
                                              <td className="px-1 py-1.5 w-16">
                                                <div className="relative">
                                                  <Clock size={10} className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-slate-400" />
                                                  <input type="time" value={schedule.time} onChange={(e) => setWizardScheduleField(sel.classId, sel.sectionId, subjectId, { time: e.target.value })} className={`${inpDense} pl-5 pr-0.5`} />
                                                </div>
                                              </td>
                                              <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{formatTimeLabel(addMinutesToTime(schedule.time, schedule.duration))}</td>
                                              <td className="px-2 py-1.5">
                                                <WizardSelect dense value={schedule.duration} onChange={(e) => setWizardScheduleField(sel.classId, sel.sectionId, subjectId, { duration: e.target.value })}>
                                                  {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{formatDuration(d)}</option>)}
                                                </WizardSelect>
                                              </td>
                                              <td className="px-2 py-1.5 space-y-1">
                                                <WizardSelect dense value={schedule.buildingId} onChange={(e) => setWizardScheduleField(sel.classId, sel.sectionId, subjectId, { buildingId: e.target.value, floorId: '', roomId: '' })}>
                                                  <option value="">Building —</option>
                                                  {buildings.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                                                </WizardSelect>
                                                <div className="flex gap-1">
                                                  <WizardSelect dense value={schedule.floorId} disabled={!schedule.buildingId} onChange={(e) => setWizardScheduleField(sel.classId, sel.sectionId, subjectId, { floorId: e.target.value, roomId: '' })}>
                                                    <option value="">Floor —</option>
                                                    {floorsForBuilding.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                                                  </WizardSelect>
                                                  <WizardSelect dense value={schedule.roomId} disabled={!schedule.floorId} onChange={(e) => setWizardScheduleField(sel.classId, sel.sectionId, subjectId, { roomId: e.target.value })}>
                                                    <option value="">Room —</option>
                                                    {roomsForFloor.map((r) => <option key={r._id} value={r._id}>{r.roomNumber}</option>)}
                                                  </WizardSelect>
                                                </div>
                                              </td>
                                              <td className="px-2 py-1.5 space-y-1">
                                                <WizardSelect dense value={schedule.primaryInstructor} onChange={(e) => setWizardScheduleField(sel.classId, sel.sectionId, subjectId, { primaryInstructor: e.target.value })}>
                                                  <option value="">Teacher —</option>
                                                  {primaryOptions.map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}
                                                </WizardSelect>
                                                <WizardSelect dense value={schedule.secondaryInstructor} onChange={(e) => setWizardScheduleField(sel.classId, sel.sectionId, subjectId, { secondaryInstructor: e.target.value })}>
                                                  <option value="">Associated —</option>
                                                  {secondaryOptions.map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}
                                                </WizardSelect>
                                              </td>
                                              <td className="px-2 py-1.5">
                                                <button type="button" onClick={() => removeRoutineSubject(sel.classId, subjectId)}
                                                  className="h-6 w-6 flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600">
                                                  <Trash2 size={12} />
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <WizardSelect value={newRoutineSubjectId} onChange={(e) => setNewRoutineSubjectId(e.target.value)} disabled={availableToAdd.length === 0}>
                                      <option value="">{availableToAdd.length ? 'Select subject' : 'All subjects added'}</option>
                                      {availableToAdd.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                                    </WizardSelect>
                                    <button type="button" onClick={() => addRoutineSubject(sel.classId, newRoutineSubjectId)} disabled={!newRoutineSubjectId}
                                      className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                                      <Plus size={14} /> Add Subject
                                    </button>
                                  </div>
                                  <div className="relative">
                                    <button type="button" onClick={() => { setScheduleApplyOpenFor((v) => (v === key ? '' : key)); setScheduleApplyTargets([]); }}
                                      disabled={wizardSelections.length < 2}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                      Apply to Other Classes <ChevronDown size={12} />
                                    </button>
                                    {scheduleApplyOpenFor === key && (
                                      <div className="absolute right-0 bottom-full mb-2 z-20 w-56 rounded-xl border border-slate-100 bg-white shadow-xl p-3 space-y-2">
                                        {wizardSelections.filter((s) => wizardKey(s.classId, s.sectionId) !== key).map((s) => {
                                          const otherKey = wizardKey(s.classId, s.sectionId);
                                          return (
                                            <label key={otherKey} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                              <input type="checkbox" checked={scheduleApplyTargets.includes(otherKey)}
                                                onChange={() => setScheduleApplyTargets((prev) => prev.includes(otherKey) ? prev.filter((k) => k !== otherKey) : [...prev, otherKey])} />
                                              {s.className} - {s.sectionName}
                                            </label>
                                          );
                                        })}
                                        <button type="button"
                                          onClick={() => {
                                            copySchedule(key, scheduleApplyTargets);
                                            toast.success(`Applied to ${scheduleApplyTargets.length} class${scheduleApplyTargets.length !== 1 ? 'es' : ''}`);
                                            setScheduleApplyTargets([]);
                                            setScheduleApplyOpenFor('');
                                          }}
                                          disabled={scheduleApplyTargets.length === 0}
                                          className="w-full mt-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40">
                                          Apply
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {(() => {
                    const emptyOnes = wizardSelections.filter((sel) => (wizardClassSubjects[sel.classId] || []).length === 0);
                    if (!emptyOnes.length) return null;
                    return (
                      <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 space-y-2">
                        <p className="text-sm text-rose-700 flex items-center gap-1.5">
                          <AlertTriangle size={14} className="shrink-0" />
                          The following classes/sections have no subjects selected in Step 3. You can go back to Step 3 to add subjects, or skip them.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {emptyOnes.map((sel) => (
                            <span key={wizardKey(sel.classId, sel.sectionId)} className="px-2.5 py-1 rounded-full bg-white border border-rose-200 text-xs font-semibold text-rose-600">
                              {sel.className} - {sel.sectionName}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {wizardStep === 5 && (() => {
                const s = stepFiveSummary;
                const selectedYear = years.find((y) => String(y._id) === String(wizardDetails.yearId));
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* 1. Exam Details */}
                      <ReviewCard icon={Edit2} iconColor="bg-indigo-600" title="1. Exam Details" onEdit={() => setWizardStep(1)}>
                        <ReviewRow label="Exam Title" value={wizardDetails.title || '—'} />
                        <ReviewRow label="Exam Type / Term" value={wizardDetails.term} />
                        <ReviewRow label="Academic Year" value={`${selectedYear?.name || '—'}${selectedYear?.isActive ? ' (Active)' : ''}`} />
                        <ReviewRow label="Status" value={
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[wizardDetails.status] || 'bg-slate-100 text-slate-600'}`}>{wizardDetails.status}</span>
                        } />
                        <ReviewRow label="Start Date" value={formatDateChip(wizardDetails.startDate) || '—'} />
                        <ReviewRow label="End Date" value={formatDateChip(wizardDetails.endDate) || '—'} />
                      </ReviewCard>

                      {/* 2. Classes & Sections */}
                      <ReviewCard icon={Edit2} iconColor="bg-emerald-500" title="2. Classes & Sections" onEdit={() => setWizardStep(2)}>
                        <ReviewRow label="Total Classes" value={s.totalClasses} />
                        <ReviewRow label="Total Sections" value={s.totalSections} />
                        <ReviewRow label="Selected Classes" value={
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {wizardSelectedClasses.map((c) => (
                              <span key={c.classId} className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold whitespace-nowrap">{c.className}</span>
                            ))}
                          </div>
                        } />
                        <ReviewRow label="Selected Sections" value="As per selection in Step 2" />
                        <ReviewRow label="Total Students" value={s.totalStudents} />
                        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-700 mt-3">
                          <span className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                            <Check size={10} className="text-white" />
                          </span>
                          Classes and sections are successfully configured.
                        </div>
                      </ReviewCard>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* 3. Subjects */}
                      <ReviewCard icon={Users} iconColor="bg-rose-500" title="3. Subjects" onEdit={() => setWizardStep(3)}>
                        <div className="max-h-64 overflow-y-auto pr-1 divide-y divide-slate-100">
                          {wizardSelectedClasses.map((c) => {
                            const ids = wizardClassSubjects[c.classId] || [];
                            const names = subjects.filter((sub) => ids.includes(sub._id)).map((sub) => sub.name);
                            return (
                              <div key={c.classId} className="flex items-center gap-2.5 py-2.5 text-sm">
                                <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${wizardClassAvatar(c.classId)}`}>
                                  <Users size={12} />
                                </div>
                                <p className="font-semibold text-slate-700 shrink-0 whitespace-nowrap">
                                  {c.className} <span className="text-slate-400 font-normal">({c.sectionCount} section{c.sectionCount !== 1 ? 's' : ''})</span>
                                </p>
                                <p className="text-slate-400 text-xs text-right ml-auto truncate" title={names.join(', ')}>
                                  {names.length ? `${names.length} subjects (${names.join(', ')})` : 'No subjects selected'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </ReviewCard>

                      {/* 4. Exam Routine Summary */}
                      <ReviewCard icon={Users} iconColor="bg-violet-500" title="4. Exam Routine Summary" onEdit={() => setWizardStep(4)}>
                        <ReviewRow label="Total Exam Entries" value={s.totalSubjectEntries} />
                        <ReviewRow label="Exam Period" value={`${formatDateChip(s.examWindowStart) || '—'} – ${formatDateChip(s.examWindowEnd) || '—'}`} />
                        <ReviewRow label="Exam Time (Default)" value={
                          s.commonTime ? `${formatTimeLabel(s.commonTime)} – ${formatTimeLabel(addMinutesToTime(s.commonTime, s.commonDuration))}` : '—'
                        } />
                        <ReviewRow label="Gap Between Exams" value={s.avgGapDays != null ? `${s.avgGapDays} Day${s.avgGapDays !== 1 ? 's' : ''}` : '—'} />
                        <ReviewRow label="Buildings Used" value={
                          <span className="inline-block max-w-[220px]">{s.buildingsUsedNames.length ? s.buildingsUsedNames.join(', ') : '—'}</span>
                        } />
                        <ReviewRow label="Floors Used" value={s.floorsUsedNames.length ? s.floorsUsedNames.join(', ') : '—'} />
                        <ReviewRow label="Rooms Used" value={
                          <span className="inline-block max-w-[220px]">{s.roomsUsedLabels.length ? s.roomsUsedLabels.join(', ') : '—'}</span>
                        } />
                        <div className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs mt-3 ${s.routineFullyConfigured ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-amber-50 border border-amber-100 text-amber-700'}`}>
                          {s.routineFullyConfigured ? (
                            <span className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                              <Check size={10} className="text-white" />
                            </span>
                          ) : (
                            <AlertTriangle size={14} className="shrink-0" />
                          )}
                          {s.routineFullyConfigured ? 'Routine is configured for all classes with subjects.' : 'Routine is not fully configured yet — go back to Step 4'}
                        </div>
                      </ReviewCard>
                    </div>

                    {/* Ready to create */}
                    <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-3 max-w-md">
                        <div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                          <Rocket size={16} className="text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Ready to create?</p>
                          <p className="text-xs text-slate-500 mt-0.5">Once you click create, the exam will be available for management. You can still add subjects, edit the routine, or publish it afterwards.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="px-3 py-2 rounded-xl bg-blue-100 text-blue-700 text-center min-w-[64px]">
                          <p className="text-base font-bold leading-none">{s.totalClasses}</p>
                          <p className="text-[10px] font-semibold mt-1">Classes</p>
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-center min-w-[64px]">
                          <p className="text-base font-bold leading-none">{s.totalSections}</p>
                          <p className="text-[10px] font-semibold mt-1">Sections</p>
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-violet-100 text-violet-700 text-center min-w-[64px]">
                          <p className="text-base font-bold leading-none">{s.totalSubjectEntries}</p>
                          <p className="text-[10px] font-semibold mt-1">Subjects</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* nav */}
            <div className="flex items-center justify-between gap-3 px-6 sm:px-8 py-4 border-t border-slate-100 bg-slate-50/60">
              <button type="button" onClick={goWizardBack} disabled={wizardStep === 1}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={15} /> Back
              </button>
              <div className="flex items-center gap-3">
                {(draftState === 'pending' || draftState === 'saving') && (
                  <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Loader2 size={13} className="animate-spin text-amber-500" /> Saving…
                  </span>
                )}
                {autoSavedAt && draftState === 'idle' && (
                  <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
                    <CloudCheck size={13} className="text-emerald-500" />
                    Auto-saved {new Date(autoSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {wizardStep < WIZARD_STEPS.length ? (
                  <button type="button" onClick={goWizardNext}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors">
                    Next <ChevronRight size={15} />
                  </button>
                ) : (
                  <button type="button" onClick={handleCreateFromWizard} disabled={wizardSaving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 shadow-md shadow-indigo-200 transition-colors">
                    {wizardSaving ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
                    {wizardSaving ? 'Creating…' : 'Create Exam'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ BULK EDIT ROUTINE DEFAULTS MODAL ══════════ */}
      <Modal show={showBulkEditModal} onClose={() => setShowBulkEditModal(false)}
        title="Bulk Edit Routine" subtitle="Apply shared defaults to every subject that doesn't have a room or date yet."
        icon={ListChecks} iconColor="bg-indigo-600" maxWidth="sm:max-w-md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <WizardField label="Start Time">
              <div className="relative">
                <Clock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="time" value={bulkEditDefaults.time} onChange={(e) => setBulkEditDefaults((p) => ({ ...p, time: e.target.value }))} className={`${inp} pl-9`} />
              </div>
            </WizardField>
            <WizardField label="Duration">
              <WizardSelect value={bulkEditDefaults.duration} onChange={(e) => setBulkEditDefaults((p) => ({ ...p, duration: e.target.value }))}>
                {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{formatDuration(d)}</option>)}
              </WizardSelect>
            </WizardField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <WizardField label="Preferred Building">
              <WizardSelect value={bulkEditDefaults.buildingId} onChange={(e) => setBulkEditDefaults((p) => ({ ...p, buildingId: e.target.value, floorId: '' }))}>
                <option value="">Any</option>
                {buildings.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </WizardSelect>
            </WizardField>
            <WizardField label="Preferred Floor">
              <WizardSelect value={bulkEditDefaults.floorId} disabled={!bulkEditDefaults.buildingId}
                onChange={(e) => setBulkEditDefaults((p) => ({ ...p, floorId: e.target.value }))}>
                <option value="">Any</option>
                {floors.filter((f) => String(f.buildingId?._id || f.buildingId) === String(bulkEditDefaults.buildingId)).map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
              </WizardSelect>
            </WizardField>
          </div>
          <p className="text-xs text-slate-400">
            The exact room is still assigned per subject — via <span className="font-semibold text-slate-500">Auto Schedule</span> or manually — so two subjects never end up booked into the same room.
          </p>
          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" onClick={() => setShowBulkEditModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={applyBulkEdit} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200">
              <ListChecks size={14} /> Apply Defaults
            </button>
          </div>
        </div>
      </Modal>

      {/* ══════════ CREATE-EXAM DRAFTS MODAL ══════════ */}
      <Modal show={showDraftsModal} onClose={() => setShowDraftsModal(false)}
        title="Exam Drafts" subtitle="Resume a partially set up exam." icon={FileClock} iconColor="bg-indigo-600" maxWidth="sm:max-w-lg">
        {examDrafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
            <FileClock size={32} className="mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">No saved drafts</p>
            <p className="mt-1 text-xs">Start creating an exam — your progress is saved automatically.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {examDrafts.map((d) => (
              <li key={d._id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{d.label || 'Untitled draft'}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    up to &ldquo;{WIZARD_STEPS[Math.max(0, Math.min(WIZARD_STEPS.length - 1, (Number(d.step) || 1) - 1))].title}&rdquo; · saved {draftTimeAgo(d.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => resumeExamDraft(d)}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700">
                    <RotateCcw size={13} /> Resume
                  </button>
                  <button onClick={() => deleteExamDraft(d._id)} disabled={deletingDraftId === d._id} title="Delete draft"
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                    {deletingDraftId === d._id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* ══════════ ADD / EDIT SUBJECT MODAL ══════════ */}
      <Modal show={showSubjectModal} onClose={() => setShowSubjectModal(false)}
        title={editingSubjectId ? 'Edit Subject Exam' : 'Add Subject Exam'}
        subtitle={activeGroup ? `Step 2 — ${activeGroup.title} · ${activeGroup.term}` : 'Step 2 — Add subjects to the exam'}
        icon={FileText} iconColor="bg-violet-600">
        <form onSubmit={handleSaveSubject} className="space-y-5">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Subject">
              <select value={subjectForm.subjectId} onChange={e => setSubjectForm(p=>({...p,subjectId:e.target.value}))} className={inp} required>
                <option value="">Select subject</option>
                {modalSubjects.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Total Marks">
              <input type="number" min="1" value={subjectForm.marks} onChange={e => setSubjectForm(p=>({...p,marks:e.target.value}))} className={inp} placeholder="100"/>
            </Field>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Schedule</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Date"><input type="date" value={subjectForm.date} onChange={e => setSubjectForm(p=>({...p,date:e.target.value}))} className={inp}/></Field>
              <Field label="Time"><input type="time" value={subjectForm.time} onChange={e => setSubjectForm(p=>({...p,time:e.target.value}))} className={inp}/></Field>
              <Field label="Duration (min)"><input type="number" min="0" value={subjectForm.duration} onChange={e => setSubjectForm(p=>({...p,duration:e.target.value}))} className={inp} placeholder="90"/></Field>
              <Field label="Status">
                <select value={subjectForm.status} onChange={e => setSubjectForm(p=>({...p,status:e.target.value}))} className={inp}>
                  {SUBJECT_STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Venue</p>
            <div className="rounded-2xl bg-slate-50/80 border border-slate-100 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Building">
                  <div className="relative">
                    <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                    <select value={subjectForm.buildingId} onChange={e => setSubjectForm(p=>({...p,buildingId:e.target.value,floorId:'',roomId:''}))} className={`${inp} pl-8`}>
                      <option value="">Select building</option>
                      {buildings.map(b=><option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                  </div>
                </Field>
                <Field label="Floor">
                  <div className="relative">
                    <Layers size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                    <select value={subjectForm.floorId} onChange={e => setSubjectForm(p=>({...p,floorId:e.target.value,roomId:''}))} className={`${inp} pl-8`}>
                      <option value="">Select floor</option>
                      {modalFloors.map(f=><option key={f._id} value={f._id}>{f.name}</option>)}
                    </select>
                  </div>
                </Field>
                <Field label="Room">
                  <div className="relative">
                    <DoorOpen size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                    <select value={subjectForm.roomId} onChange={e => {
                      const rid=e.target.value; const room=rooms.find(r=>String(r._id)===String(rid));
                      setSubjectForm(p=>({...p,roomId:rid,buildingId:room?String(room.floorId?.buildingId?._id||room.floorId?.buildingId||p.buildingId):p.buildingId,floorId:room?String(room.floorId?._id||room.floorId||''):p.floorId,venue:room?`${room.floorId?.buildingId?.name||'Building'} / ${room.floorId?.name||'Floor'} / ${room.roomNumber}`:p.venue}));
                    }} className={`${inp} pl-8`}>
                      <option value="">Select room</option>
                      {modalRooms.map(r=><option key={r._id} value={r._id}>{r.floorId?.buildingId?.name||'Bldg'} / {r.floorId?.name||'Floor'} / {r.roomNumber}</option>)}
                    </select>
                  </div>
                </Field>
              </div>
              <Field label="Venue Note (optional)">
                <input value={subjectForm.venue} onChange={e => setSubjectForm(p=>({...p,venue:e.target.value}))} className={inp} placeholder="Custom venue or extra detail"/>
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Primary Invigilator">
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                <select value={subjectForm.primaryInstructor} onChange={e => setSubjectForm(p=>({...p,primaryInstructor:e.target.value}))} className={`${inp} pl-8`}>
                  <option value="">Select</option>
                  {modalTeachers.map(t=><option key={t._id} value={t.name} disabled={t.name===subjectForm.secondaryInstructor}>{t.name}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Secondary Invigilator">
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                <select value={subjectForm.secondaryInstructor} onChange={e => setSubjectForm(p=>({...p,secondaryInstructor:e.target.value}))} className={`${inp} pl-8`}>
                  <option value="">Select</option>
                  {modalTeachers.map(t=><option key={t._id} value={t.name} disabled={t.name===subjectForm.primaryInstructor}>{t.name}</option>)}
                </select>
              </div>
            </Field>
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" onClick={() => setShowSubjectModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-60 shadow-md shadow-violet-200">
              {saving ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>}
              {saving ? 'Saving…' : editingSubjectId ? 'Update Subject' : 'Add Subject'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ExaminationManagement;
