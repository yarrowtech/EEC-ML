import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar, Clock, Video, Phone, Users, MapPin, Link,
  Plus, Trash2, X, CheckCircle,
  User, Search, Flag, Pencil, Check, ChevronDown, SlidersHorizontal, ChevronLeft, ChevronRight, CalendarPlus, MoreHorizontal, GraduationCap, BarChart3, Heart, FileText, ClipboardList
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { formatStudentDisplay } from '../utils/studentDisplay';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '') + '/api';

// Same Jitsi hash-config the parent portal uses: prejoin screen, lobby auto-knock,
// no invite/dial-in controls. The teacher joins first and admits the parent.
const JITSI_ROOM_CONFIG = '#config.prejoinPageEnabled=true&config.lobby.autoKnock=true&config.disableInviteFunctions=true&config.startWithAudioMuted=true';

const jitsiRoomUrl = (meeting) => {
  if (!meeting) return '';
  if (meeting.meetingLink) return meeting.meetingLink;
  if (!meeting.videoRoom) return '';
  return `https://meet.jit.si/${encodeURIComponent(meeting.videoRoom)}${JITSI_ROOM_CONFIG}`;
};

const mergeOptions = (server, derived) =>
  [...new Set([...(server || []), ...(derived || [])].map(String).filter(Boolean))].sort();

const EMPTY_FORM = {
  studentId: '', title: '', topic: '', description: '',
  meetingDate: '', meetingTime: '', meetingType: 'In Person',
  location: '', meetingLink: '', roomId: ''
};

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', cls: 'bg-amber-500 text-white border-amber-200', dot: 'bg-amber-500' },
  confirmed:  { label: 'Confirmed', cls: 'bg-green-500 text-white border-green-200',  dot: 'bg-green-500' },
  completed:  { label: 'Completed', cls: 'bg-blue-500 text-white border-blue-200',    dot: 'bg-blue-500'  },
  cancelled:  { label: 'Cancelled', cls: 'bg-red-500 text-white border-red-200',       dot: 'bg-red-500'   },
};

const STATUS_TRANSITIONS = {
  scheduled: ['confirmed', 'completed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['scheduled'],
};

const MEETING_TYPES = [
  { value: 'In Person', label: 'In Person', icon: Users,  color: 'text-indigo-600',  bg: 'bg-indigo-50 border-indigo-200'  },
  { value: 'Video Call', label: 'Video Call', icon: Video,  color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200'  },
  { value: 'Phone Call', label: 'Phone Call', icon: Phone,  color: 'text-emerald-600',bg: 'bg-emerald-50 border-emerald-200'},
];

const MEETING_SCOPES = [
  { value: 'student', label: 'One student', hint: 'Session → class → section → student' },
  { value: 'section', label: 'Whole section', hint: 'Every parent in the class you pick' },
  { value: 'class',   label: 'Whole class', hint: 'Every parent of the students you teach this session' },
];

const WIZARD_STEPS = ['Who', 'Details', 'How'];

const STATUS_TABS = ['all', 'scheduled', 'confirmed', 'completed', 'cancelled'];

const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = +h;
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
};

const ParentMeetings = () => {
  const [meetings, setMeetings]           = useState([]);
  const [students, setStudents]           = useState([]);
  const [sessionOptions, setSessionOptions] = useState([]);
  const [classOptions, setClassOptions]   = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);

  // schedule-form scope filters
  const [formSession, setFormSession]     = useState('');
  const [formClass, setFormClass]         = useState('');
  const [formSection, setFormSection]     = useState('');
  const [meetingScope, setMeetingScope]   = useState('student');

  // list filters
  const [filterSession, setFilterSession] = useState('');
  const [filterClass, setFilterClass]     = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [activeTab, setActiveTab]         = useState('all');

  const [loading, setLoading]             = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [updatingId, setUpdatingId]       = useState(null);
  const [error, setError]                 = useState('');
  const [success, setSuccess]             = useState('');
  const [showForm, setShowForm]           = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [openStatusId, setOpenStatusId]   = useState(null);
  const [formData, setFormData]           = useState(EMPTY_FORM);
  const [search, setSearch]               = useState('');
  const [parentPreview, setParentPreview] = useState(null);
  const [filtersOpen, setFiltersOpen]     = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null); // meeting being edited in the drawer
  const [formStep, setFormStep]           = useState(1);
  const [page, setPage]                   = useState(1);
  const [pageSize, setPageSize]           = useState(6);

  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchMeetings(); }, []);
  useEffect(() => { fetchStudents(); }, [formSession, formClass, formSection]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (success) toast.success(success);
  }, [success]);
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  /* ── Close status dropdown on outside click ── */
  useEffect(() => {
    const handler = () => setOpenStatusId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/meeting/teacher/my-meetings`, { headers });
      setMeetings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const query = new URLSearchParams();
      if (formSession) query.set('session', formSession);
      if (formClass)   query.set('className', formClass);
      if (formSection) query.set('section', formSection);
      const { data } = await axios.get(`${API_BASE_URL}/meeting/teacher/students?${query.toString()}`, { headers });
      setStudents(Array.isArray(data?.students) ? data.students : []);
      setSessionOptions(Array.isArray(data?.options?.sessions) ? data.options.sessions : []);
      setClassOptions(Array.isArray(data?.options?.classes)   ? data.options.classes   : []);
      setSectionOptions(Array.isArray(data?.options?.sections) ? data.options.sections : []);
      if (!formSession && data?.activeSession) setFormSession(data.activeSession);
    } catch { /* silent */ }
  };

  const handleUpdateStatus = async (meetingId, newStatus, e) => {
    e?.stopPropagation();
    setUpdatingId(meetingId);
    setOpenStatusId(null);
    try {
      await axios.put(`${API_BASE_URL}/meeting/teacher/update/${meetingId}`, { status: newStatus }, { headers });
      setSuccess(`Meeting marked as ${newStatus}.`);
      fetchMeetings();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (meetingId) => {
    setLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/meeting/teacher/delete/${meetingId}`, { headers });
      setSuccess('Meeting deleted.');
      setDeleteConfirmId(null);
      fetchMeetings();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete meeting');
    } finally {
      setLoading(false);
    }
  };

  const studentTargets = useMemo(() => {
    if (meetingScope === 'student') {
      const p = students.find((s) => String(s._id) === String(formData.studentId));
      return p ? [p] : [];
    }
    if (meetingScope === 'class') {
      // Session only: the list is already limited to the teacher's students for that session.
      return formSession ? students : [];
    }
    if (meetingScope === 'section') {
      if (!formClass) return [];
      return students.filter((s) => String(s?.grade || '').trim().toLowerCase() === formClass.toLowerCase());
    }
    return [];
  }, [meetingScope, students, formData.studentId, formClass, formSection]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingMeeting) {
      if (!formData.title || !formData.topic || !formData.meetingDate || !formData.meetingTime) { setError('Fill all required fields.'); return; }
      setSubmitting(true); setError('');
      try {
        const { title, topic, description, meetingDate, meetingTime, meetingType, location, meetingLink, roomId } = formData;
        await axios.put(`${API_BASE_URL}/meeting/teacher/update/${editingMeeting._id}`,
          { title, topic, description, meetingDate, meetingTime, meetingType, location, meetingLink, roomId: meetingType === 'In Person' ? roomId || null : null }, { headers });
        setSuccess('Meeting updated.');
        setEditingMeeting(null); setFormData(EMPTY_FORM); setShowForm(false); fetchMeetings();
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to update meeting');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!formSession) { setError('Select the session.'); return; }
    if (meetingScope !== 'class' && !formClass) { setError('Select the class.'); return; }
    if (meetingScope === 'student' && !formSection) { setError('Select section before selecting student.'); return; }
    if (meetingScope === 'student' && !formData.studentId) { setError('Select a student.'); return; }
    if (!formData.title || !formData.topic || !formData.meetingDate || !formData.meetingTime) { setError('Fill all required fields.'); return; }
    if (!studentTargets.length) { setError('No students found for the selected scope.'); return; }

    setSubmitting(true); setError('');
    try {
      const { data } = await axios.post(`${API_BASE_URL}/meeting/teacher/create-bulk`, {
        ...formData,
        roomId: formData.meetingType === 'In Person' ? formData.roomId || undefined : undefined,
        studentIds: studentTargets.map((student) => student._id),
      }, { headers });
      const ok = Number(data?.created) || 0;
      const fail = Array.isArray(data?.skipped) ? data.skipped.length : 0;
      if (ok) setSuccess(fail ? `${ok} scheduled, ${fail} skipped (no parent linked).` : `${ok} meeting${ok === 1 ? '' : 's'} scheduled! Parents and students notified.`);
      setFormData(EMPTY_FORM); setShowForm(false); fetchMeetings();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule meeting');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Filter options ──
     Prefer the server-provided lists (from /meeting/teacher/students -> data.options,
     which cover every session/class/section the teacher can meet), then union in
     anything that only appears on an existing meeting. Deriving purely from the
     loaded meetings left the dropdowns empty whenever there were few meetings. */
  const derivedSessions = useMemo(() => meetings.map(m => String(m.studentId?.academicYear || m.studentId?.session || '')).filter(Boolean), [meetings]);
  const derivedClasses  = useMemo(() => meetings.filter(m => !filterSession || String(m.studentId?.academicYear || m.studentId?.session || '') === filterSession).map(m => String(m.studentId?.grade || '')).filter(Boolean), [meetings, filterSession]);
  const derivedSections = useMemo(() => meetings.filter(m => (!filterSession || String(m.studentId?.academicYear || m.studentId?.session || '') === filterSession) && (!filterClass || String(m.studentId?.grade || '') === filterClass)).map(m => String(m.studentId?.section || '')).filter(Boolean), [meetings, filterSession, filterClass]);

  const listSessionOptions = useMemo(() => mergeOptions(sessionOptions, derivedSessions), [sessionOptions, derivedSessions]);
  const listClassOptions   = useMemo(() => mergeOptions(classOptions,   derivedClasses),  [classOptions, derivedClasses]);
  const listSectionOptions = useMemo(() => mergeOptions(sectionOptions, derivedSections), [sectionOptions, derivedSections]);

  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      const mSession = String(m.studentId?.academicYear || m.studentId?.session || '');
      const matchSession  = !filterSession  || mSession === filterSession;
      const matchClass    = !filterClass    || m.studentId?.grade === filterClass;
      const matchSection  = !filterSection  || m.studentId?.section === filterSection;
      const matchStatus   = activeTab === 'all' || m.status === activeTab;
      return matchSession && matchClass && matchSection && matchStatus;
    });
  }, [meetings, filterSession, filterClass, filterSection, activeTab]);

  const tabCounts = useMemo(() => {
    const base = meetings.filter((m) => {
      const mSession = String(m.studentId?.academicYear || m.studentId?.session || '');
      return (!filterSession || mSession === filterSession) &&
             (!filterClass   || m.studentId?.grade === filterClass) &&
             (!filterSection || m.studentId?.section === filterSection);
    });
    return STATUS_TABS.reduce((acc, t) => {
      acc[t] = t === 'all' ? base.length : base.filter(m => m.status === t).length;
      return acc;
    }, {});
  }, [meetings, filterSession, filterClass, filterSection]);

  const stats = useMemo(() => ({
    total:     meetings.length,
    scheduled: meetings.filter(m => m.status === 'scheduled').length,
    confirmed: meetings.filter(m => m.status === 'confirmed').length,
    completed: meetings.filter(m => m.status === 'completed').length,
  }), [meetings]);

  const visibleMeetings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filteredMeetings;
    return filteredMeetings.filter((m) => [m.title, m.topic, m.studentId?.name, m.parentId?.name]
      .some((value) => String(value || '').toLowerCase().includes(q)));
  }, [filteredMeetings, search]);

  // Parent card in the drawer: load the selected student's guardian.
  useEffect(() => {
    if (meetingScope !== 'student' || !formData.studentId) { setParentPreview(null); return undefined; }
    let cancelled = false;
    axios.get(`${API_BASE_URL}/meeting/teacher/student/${formData.studentId}/parent`, { headers })
      .then(({ data }) => { if (!cancelled) setParentPreview(data || null); })
      .catch(() => { if (!cancelled) setParentPreview(null); });
    return () => { cancelled = true; };
  }, [meetingScope, formData.studentId]);

  // Drawer: lock page scroll behind it and close on Escape.
  useEffect(() => {
    if (!showForm) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => { if (event.key === 'Escape') { setShowForm(false); setEditingMeeting(null); } };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [showForm]);

  // The page fills exactly the space below the portal header; the table shows as many
  // rows as fit there and the rest go to the next page, so the page itself never scrolls.
  const ROW_HEIGHT = 62;
  const pageRef = useRef(null);
  const tableAreaRef = useRef(null);
  const [pageHeight, setPageHeight] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const top = pageRef.current?.getBoundingClientRect().top ?? 0;
      setPageHeight(Math.max(420, window.innerHeight - Math.max(0, top)));
      const area = tableAreaRef.current?.clientHeight || 0;
      if (area) setPageSize(Math.max(3, Math.floor((area - 40) / ROW_HEIGHT)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (tableAreaRef.current) observer.observe(tableAreaRef.current);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [filtersOpen, loading, visibleMeetings.length > 0]);

  const pageCount = Math.max(1, Math.ceil(visibleMeetings.length / pageSize));
  useEffect(() => { setPage(1); }, [search, activeTab, filterSession, filterClass, filterSection]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const pagedMeetings = visibleMeetings.slice((page - 1) * pageSize, page * pageSize);

  const closeFilters = () => {
    setFiltersOpen(false);
    setFilterSession(''); setFilterClass(''); setFilterSection('');
  };
  const activeFilterCount = [filterSession, filterClass, filterSection].filter(Boolean).length;

  const stepReady = {
    1: Boolean(editingMeeting) || (meetingScope === 'student'
      ? Boolean(formSession && formClass && formSection && formData.studentId)
      : studentTargets.length > 0),
    // (whole section: session + class; whole class: session only)
    2: Boolean(formData.title.trim() && formData.topic.trim() && formData.meetingDate && formData.meetingTime),
    3: true,
  };
  const summaryWho = editingMeeting
    ? (editingMeeting.studentId?.name || 'Student')
    : meetingScope === 'student'
      ? (students.find((s) => String(s._id) === String(formData.studentId))?.name || '—')
      : `${studentTargets.length} student${studentTargets.length === 1 ? '' : 's'} (${meetingScope === 'class' ? `all classes, ${formSession}` : `Class ${formClass}`})`;

  // Enter / Next moves forward; only the last step actually saves.
  const onWizardSubmit = (e) => {
    if (formStep < 3) {
      e.preventDefault();
      if (stepReady[formStep]) setFormStep(formStep + 1);
      return;
    }
    handleSubmit(e);
  };

  const openForm = () => {
    setEditingMeeting(null);
    setFormStep(1);
    setShowForm(true); setError(''); setMeetingScope('student'); setFormData(EMPTY_FORM);
  };

  const openEdit = (meeting) => {
    setOpenStatusId(null);
    setEditingMeeting(meeting);
    setFormStep(2); // who it's with can't change when editing
    setError('');
    setFormData({
      ...EMPTY_FORM,
      studentId: String(meeting.studentId?._id || meeting.studentId || ''),
      title: meeting.title || '',
      topic: meeting.topic || '',
      description: meeting.description || '',
      meetingDate: meeting.meetingDate ? new Date(meeting.meetingDate).toISOString().slice(0, 10) : '',
      meetingTime: meeting.meetingTime || '',
      meetingType: meeting.meetingType || 'In Person',
      location: meeting.location || '',
      meetingLink: meeting.meetingLink || '',
      roomId: String(meeting.roomId?._id || meeting.roomId || ''),
    });
    setShowForm(true);
  };

  const statCards = [
    { label: 'Total', value: stats.total, icon: Users, tile: 'bg-blue-100 text-blue-600', card: 'bg-white' },
    { label: 'Scheduled', value: stats.scheduled, icon: Calendar, tile: 'bg-amber-100 text-amber-600', card: 'bg-amber-50/60' },
    { label: 'Confirmed', value: stats.confirmed, icon: CheckCircle, tile: 'bg-emerald-100 text-emerald-600', card: 'bg-emerald-50/60' },
    { label: 'Completed', value: stats.completed, icon: Flag, tile: 'bg-indigo-100 text-indigo-600', card: 'bg-indigo-50/60' },
  ];

  const selectCls = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 outline-none focus:border-orange-400';

  return (
    <div ref={pageRef} className="bg-slate-50" style={pageHeight ? { height: pageHeight } : undefined}>
      <div className="mx-auto flex h-full max-w-[1280px] flex-col gap-2 px-2 py-2 sm:px-3">

        {/* ── Header banner ── */}
        <div className="relative flex h-[84px] shrink-0 items-center overflow-hidden rounded-xl bg-linear-to-r from-amber-300 via-amber-200 to-yellow-100 shadow-sm sm:h-24">
          <div className="relative z-10 flex min-w-0 items-center gap-3 px-3 sm:px-5">
            {/* <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/60 text-white shadow-sm">
              <Users className="h-6 w-6" />
            </div> */}
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold text-slate-900 sm:text-2xl">Parent–Teacher Meetings</h1>
              <p className="truncate text-[12px] text-slate-700 sm:text-[13px]">Plan and track meetings with parents</p>
            </div>
          </div>
          {/* Fit to the banner height so the whole illustration shows; fades out on very narrow screens. */}
          <img src="/ptm.png" alt="" aria-hidden="true" className="pointer-events-none absolute bottom-0 right-1 h-full w-auto object-contain opacity-30 sm:right-3 sm:opacity-100" />
        </div>

        {/* ── Stats ── */}
        <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
          {statCards.map(({ label, value, icon: Icon, tile, card }) => (
            <div key={label} className={`flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2 shadow-sm ${card}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tile}`}><Icon className="h-4.5 w-4.5" /></span>
              <div>
                <p className="text-[12px] text-slate-500">{label}</p>
                <p className="text-xl font-bold leading-tight text-slate-900">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Search, filter toggle, schedule ── */}
        <div className="shrink-0 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search meetings or students..." className="h-9 w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 text-[13px] outline-none focus:border-orange-400" />
            </div>
            {filtersOpen ? (
              <button type="button" onClick={closeFilters} title="Close filters" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
                <X className="h-4 w-4" />
                {/* <span className="hidden sm:inline">Cancel</span> */}
              </button>
            ) : (
              <button type="button" onClick={() => setFiltersOpen(true)} title="Filters" className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white">{activeFilterCount}</span>}
              </button>
            )}
            <button type="button" onClick={openForm} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-600 sm:px-4">
              <Plus className="h-4 w-4" />
              {/* <span className="hidden sm:inline">Schedule Meeting</span> */}
            </button>
          </div>
          {filtersOpen && (
            <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2">
              <label className="block">
                <span className="mb-0.5 block text-[11px] text-slate-500">Session</span>
                <select value={filterSession} onChange={(e) => { setFilterSession(e.target.value); setFilterClass(''); setFilterSection(''); }} className={selectCls}>
                  <option value="">All Sessions</option>
                  {listSessionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[11px] text-slate-500">Class</span>
                <select value={filterClass} onChange={(e) => { setFilterClass(e.target.value); setFilterSection(''); }} className={selectCls}>
                  <option value="">All Classes</option>
                  {listClassOptions.map((c) => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[11px] text-slate-500">Section</span>
                <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} className={selectCls}>
                  <option value="">All Sections</option>
                  {listSectionOptions.map((s) => <option key={s} value={s}>Section {s}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>

        {/* ── Tabs + table ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 px-2 [scrollbar-width:none]">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition ${activeTab === tab ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
              >
                {tab === 'all' ? `All (${tabCounts.all || 0})` : STATUS_CONFIG[tab]?.label}
                {tab !== 'all' && <span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">{tabCounts[tab] || 0}</span>}
              </button>
            ))}
          </div>

          <div ref={tableAreaRef} className="min-h-0 flex-1 overflow-hidden">
          {loading && meetings.length === 0 ? (
            <div className="py-14 text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
              <p className="text-[13px] text-slate-400">Loading meetings…</p>
            </div>
          ) : visibleMeetings.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-[13px] font-semibold text-slate-500">{meetings.length === 0 ? 'No meetings yet' : 'No meetings match your filters'}</p>
              <p className="text-[12px] text-slate-400">{meetings.length === 0 ? 'Schedule your first parent-teacher meeting' : 'Try another search or filter'}</p>
            </div>
          ) : (
            <div className="h-full overflow-x-auto overflow-y-hidden">
              <table className="w-full min-w-[820px] text-left">
                <thead>
                  <tr className="bg-slate-50 text-[12px] font-semibold text-slate-600">
                    <th className="px-4 py-2.5">Meeting</th>
                    <th className="px-3 py-2.5">Student &amp; Parent</th>
                    <th className="px-3 py-2.5">Date &amp; Time</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedMeetings.map((meeting) => (
                    <MeetingRow
                      key={meeting._id}
                      meeting={meeting}
                      menuOpen={openStatusId === meeting._id}
                      onToggleMenu={(e) => { e.stopPropagation(); setOpenStatusId(openStatusId === meeting._id ? null : meeting._id); }}
                      isUpdating={updatingId === meeting._id}
                      onUpdateStatus={handleUpdateStatus}
                      confirmingDelete={deleteConfirmId === meeting._id}
                      onAskDelete={() => { setOpenStatusId(null); setDeleteConfirmId(meeting._id); }}
                      onEdit={() => openEdit(meeting)}
                      onDelete={() => handleDelete(meeting._id)}
                      onCancelDelete={() => setDeleteConfirmId(null)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>

          {visibleMeetings.length > 0 && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-[12px] text-slate-500">
              <span>
                Showing <b className="text-slate-700">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, visibleMeetings.length)}</b> of <b className="text-slate-700">{visibleMeetings.length}</b>
              </span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
                {Array.from({ length: pageCount }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === pageCount || Math.abs(n - page) <= 1)
                  .map((n, i, arr) => (
                    <React.Fragment key={n}>
                      {i > 0 && n - arr[i - 1] > 1 && <span className="px-0.5">…</span>}
                      <button type="button" onClick={() => setPage(n)} className={`h-7 min-w-7 rounded-md px-2 text-[12px] font-semibold ${n === page ? 'bg-orange-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{n}</button>
                    </React.Fragment>
                  ))}
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Schedule drawer (slides in from the right) ── */}
      <div className={`fixed inset-0 z-50 ${showForm ? '' : 'pointer-events-none'}`} aria-hidden={!showForm}>
        <div className={`absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-300 ${showForm ? 'opacity-100' : 'opacity-0'}`} onClick={() => { setShowForm(false); setEditingMeeting(null); }} />
        <aside className={`absolute right-0 top-0 flex h-dvh w-full max-w-[440px] flex-col bg-white shadow-2xl transition-transform duration-300 ${showForm ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-500"><CalendarPlus className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-bold text-slate-900">{editingMeeting ? 'Edit Meeting' : 'Schedule a Meeting'}</h3>
              <p className="text-[12px] text-slate-500">{editingMeeting ? 'Update the details; the parent sees the change' : 'Plan a new parent-teacher meeting'}</p>
            </div>
            <button type="button" onClick={() => { setShowForm(false); setEditingMeeting(null); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>

          <form onSubmit={onWizardSubmit} className="flex min-h-0 flex-1 flex-col">
            {/* Step indicator */}
            <ol className="flex items-start border-b border-slate-100 px-4 py-2.5">
              {WIZARD_STEPS.map((label, index) => {
                const n = index + 1;
                const done = n < formStep;
                const current = n === formStep;
                const reachable = n <= formStep || (n === 2 && stepReady[1]) || (n === 3 && stepReady[1] && stepReady[2]);
                return (
                  <li key={label} className="flex flex-1 items-start last:flex-none">
                    <button
                      type="button"
                      disabled={!reachable || (editingMeeting && n === 1)}
                      onClick={() => setFormStep(n)}
                      className="flex w-14 shrink-0 flex-col items-center gap-1 disabled:cursor-default"
                    >
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold transition ${done ? 'bg-emerald-500 text-white' : current ? 'bg-orange-500 text-white ring-4 ring-orange-100' : 'bg-slate-100 text-slate-400'}`}>
                        {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
                      </span>
                      <span className={`text-[11px] font-semibold ${current ? 'text-slate-900' : done ? 'text-emerald-600' : 'text-slate-400'}`}>{label}</span>
                    </button>
                    {n < WIZARD_STEPS.length && <span className={`mt-3.5 h-0.5 flex-1 rounded-full ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                  </li>
                );
              })}
            </ol>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {/* Step 1 — Who */}
              {formStep === 1 && !editingMeeting && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[14px] font-bold text-slate-900">Who is the meeting for?</p>
                    <p className="text-[12px] text-slate-500">Pick one student, or invite every parent in a section or class.</p>
                  </div>
                  <div className="space-y-1.5">
                    {MEETING_SCOPES.map((scope) => (
                      <button key={scope.value} type="button"
                        onClick={() => {
                          setMeetingScope(scope.value);
                          setFormData((p) => ({ ...p, studentId: '' }));
                          if (scope.value !== 'student') setFormSection('');
                          if (scope.value === 'class') setFormClass('');
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${meetingScope === scope.value ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${meetingScope === scope.value ? 'border-orange-500' : 'border-slate-300'}`}>
                          {meetingScope === scope.value && <span className="h-2 w-2 rounded-full bg-orange-500" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold text-slate-800">{scope.label}</span>
                          <span className="block text-[11px] text-slate-500">{scope.hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className={`grid gap-2 ${meetingScope === 'student' ? 'grid-cols-3' : meetingScope === 'section' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <MiniField label="Session" required>
                      <select value={formSession} onChange={(e) => { setFormSession(e.target.value); setFormClass(''); setFormSection(''); setFormData((p) => ({ ...p, studentId: '' })); }} className={selectCls}>
                        <option value="">Select</option>
                        {sessionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </MiniField>
                    {meetingScope !== 'class' && (
                    <MiniField label="Class" required>
                      <select value={formClass} disabled={!formSession} onChange={(e) => { setFormClass(e.target.value); setFormSection(''); setFormData((p) => ({ ...p, studentId: '' })); }} className={`${selectCls} disabled:bg-slate-50`}>
                        <option value="">Select</option>
                        {classOptions.map((c) => <option key={c} value={c}>Class {c}</option>)}
                      </select>
                    </MiniField>
                    )}
                    {meetingScope === 'student' && (
                    <MiniField label="Section" required>
                      <select value={formSection} disabled={!formClass} onChange={(e) => { setFormSection(e.target.value); setFormData((p) => ({ ...p, studentId: '' })); }} className={`${selectCls} disabled:bg-slate-50`}>
                        <option value="">Select</option>
                        {sectionOptions.map((s) => <option key={s} value={s}>Section {s}</option>)}
                      </select>
                    </MiniField>
                    )}
                  </div>
                  {meetingScope === 'student' ? (
                    <>
                      <MiniField label="Student" required>
                        <StudentPicker
                          students={students}
                          value={formData.studentId}
                          disabled={!(formSession && formClass && formSection)}
                          placeholder={formSession && formClass && formSection ? 'Search or select a student…' : 'Select session, class and section first'}
                          onChange={(studentId) => setFormData((p) => ({ ...p, studentId }))}
                        />
                      </MiniField>
                      {formData.studentId && (
                        <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-600"><User className="h-4 w-4" /></span>
                          <div className="min-w-0 text-[12px]">
                            <p className="text-[11px] text-slate-500">Parent / Guardian</p>
                            <p className="truncate font-semibold text-slate-800">{parentPreview?.name || 'Loading…'}{parentPreview?.relation ? <span className="font-normal text-slate-500"> ({parentPreview.relation})</span> : null}</p>
                            {(parentPreview?.mobile || parentPreview?.phone) && <p className="flex items-center gap-1 text-slate-500"><Phone className="h-3 w-3" />{parentPreview.mobile || parentPreview.phone}</p>}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className={`rounded-lg px-3 py-2 text-[12px] ${studentTargets.length ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>
                      {studentTargets.length
                        ? <><b>{studentTargets.length}</b> student{studentTargets.length === 1 ? '' : 's'} selected — every parent gets an invite.</>
                        : meetingScope === 'class' ? 'Select the session to see who will be invited.' : 'Pick a class to see who will be invited.'}
                    </p>
                  )}
                </div>
              )}

              {/* Step 2 — Details */}
              {formStep === 2 && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[14px] font-bold text-slate-900">Meeting details</p>
                    <p className="text-[12px] text-slate-500">What it's about and when it happens.</p>
                  </div>
                  {editingMeeting && (
                    <div className="space-y-1.5 rounded-lg bg-slate-50 p-2.5">
                      <PersonLine name={editingMeeting.studentId?.name} photo={editingMeeting.studentId?.profilePic}
                        sub={editingMeeting.studentId?.grade ? `Class ${editingMeeting.studentId.grade}${editingMeeting.studentId.section ? ` ${editingMeeting.studentId.section}` : ''}` : 'Student'} tone="bg-rose-100 text-rose-600" />
                      {editingMeeting.parentId?.name && <PersonLine name={editingMeeting.parentId.name} photo={editingMeeting.parentId.profilePic} sub={editingMeeting.parentId.mobile || 'Parent'} tone="bg-slate-200 text-slate-600" />}
                    </div>
                  )}
                  <MiniField label="Title" required><input autoFocus type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={selectCls} placeholder="Academic Discussion" /></MiniField>
                  <MiniField label="Topic" required><input type="text" value={formData.topic} onChange={(e) => setFormData({ ...formData, topic: e.target.value })} className={selectCls} placeholder="Student Progress" /></MiniField>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniField label="Date" required><input type="date" min={new Date().toISOString().slice(0, 10)} value={formData.meetingDate} onChange={(e) => setFormData({ ...formData, meetingDate: e.target.value })} className={selectCls} /></MiniField>
                    <MiniField label="Time" required><input type="time" value={formData.meetingTime} onChange={(e) => setFormData({ ...formData, meetingTime: e.target.value })} className={selectCls} /></MiniField>
                  </div>
                  <MiniField label="Description (Optional)">
                    <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-orange-400" placeholder="Add meeting agenda, specific points to discuss..." />
                  </MiniField>
                </div>
              )}

              {/* Step 3 — How + review */}
              {formStep === 3 && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[14px] font-bold text-slate-900">How will you meet?</p>
                    <p className="text-[12px] text-slate-500">Choose the format, then check the summary.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {MEETING_TYPES.map(({ value, label, icon: Icon }) => (
                      <button key={value} type="button"
                        onClick={() => setFormData({ ...formData, meetingType: value, location: '', meetingLink: '' })}
                        className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 text-[12px] font-medium transition ${formData.meetingType === value ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                      >
                        <Icon className="h-5 w-5" />{label}
                      </button>
                    ))}
                  </div>
                  {formData.meetingType === 'In Person' && (
                    <RoomPicker
                      date={formData.meetingDate}
                      time={formData.meetingTime}
                      excludeMeetingId={editingMeeting?._id}
                      headers={headers}
                      roomId={formData.roomId}
                      location={formData.location}
                      onChange={({ roomId, location }) => setFormData((prev) => ({ ...prev, roomId, location }))}
                    />
                  )}
                  {formData.meetingType === 'Video Call' && (
                    <MiniField label="Meeting link (Optional — a secure room is created if empty)">
                      <div className="relative">
                        <Link className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input type="url" value={formData.meetingLink} onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })} className={`${selectCls} pl-8`} placeholder="https://meet.google.com/…" />
                      </div>
                    </MiniField>
                  )}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px]">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Summary</p>
                    <dl className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-1">
                      <dt className="text-slate-500">With</dt>
                      <dd className="truncate font-medium text-slate-800">{summaryWho}</dd>
                      <dt className="text-slate-500">Meeting</dt>
                      <dd className="truncate font-medium text-slate-800">{formData.title} · {formData.topic}</dd>
                      <dt className="text-slate-500">When</dt>
                      <dd className="font-medium text-slate-800">{formData.meetingDate ? new Date(`${formData.meetingDate}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} · {formatTime(formData.meetingTime)}</dd>
                      <dt className="text-slate-500">Format</dt>
                      <dd className="font-medium text-slate-800">{formData.meetingType}{formData.location ? ` · ${formData.location}` : ''}</dd>
                    </dl>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
              {formStep > (editingMeeting ? 2 : 1) ? (
                <button type="button" onClick={() => setFormStep((n) => n - 1)} className="inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-slate-100 text-[13px] font-semibold text-slate-700 hover:bg-slate-200">
                  <ChevronLeft className="h-4 w-4" />Back
                </button>
              ) : (
                <button type="button" onClick={() => { setShowForm(false); setEditingMeeting(null); }} className="h-10 flex-1 rounded-lg bg-slate-100 text-[13px] font-semibold text-slate-700 hover:bg-slate-200">Cancel</button>
              )}
              {formStep < 3 ? (
                <button type="submit" disabled={!stepReady[formStep]} className="inline-flex h-10 flex-[1.6] items-center justify-center gap-1 rounded-lg bg-orange-500 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">
                  Next<ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="submit" disabled={submitting || (!editingMeeting && !studentTargets.length)} className="inline-flex h-10 flex-[1.6] items-center justify-center gap-1.5 rounded-lg bg-orange-500 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">
                  <CalendarPlus className="h-4 w-4" />
                  {editingMeeting ? (submitting ? 'Saving…' : 'Save Changes') : submitting ? 'Scheduling…' : studentTargets.length > 1 ? `Schedule for ${studentTargets.length} students` : 'Schedule Meeting'}
                </button>
              )}
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
};

// Searchable student dropdown: type to filter by name, roll or class.
const StudentPicker = ({ students, value, onChange, disabled, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);
  const selected = students.find((s) => String(s._id) === String(value));

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (!boxRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  const q = query.trim().toLowerCase();
  const matches = q
    ? students.filter((s) => [s.name, s.roll, formatStudentDisplay(s)].some((v) => String(v || '').toLowerCase().includes(q)))
    : students;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((prev) => !prev); setQuery(''); }}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-left text-[13px] outline-none focus:border-orange-400 disabled:cursor-not-allowed disabled:bg-slate-50"
      >
        <span className={`truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>{selected ? formatStudentDisplay(selected) : placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="relative border-b border-slate-100 p-1.5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); if (matches[0]) { onChange(String(matches[0]._id)); setOpen(false); } }
                if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
              }}
              placeholder="Search by name or roll…"
              className="h-8 w-full rounded-md border border-slate-200 pl-7 pr-2 text-[13px] outline-none focus:border-orange-400"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {matches.length === 0 && <li className="px-3 py-2 text-[12px] text-slate-400">No students match “{query}”.</li>}
            {matches.map((s) => (
              <li key={s._id}>
                <button
                  type="button"
                  onClick={() => { onChange(String(s._id)); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-orange-50 ${String(s._id) === String(value) ? 'bg-orange-50 font-semibold text-orange-700' : 'text-slate-700'}`}
                >
                  <span className="truncate">{formatStudentDisplay(s)}</span>
                  {String(s._id) === String(value) && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Building → floor → room, showing which rooms are free at the meeting's date and time.
// "Other place" keeps a free-text venue for meetings outside the room list.
const RoomPicker = ({ date, time, excludeMeetingId, headers, roomId, location, onChange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [buildingId, setBuildingId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [custom, setCustom] = useState(Boolean(location && !roomId));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = new URLSearchParams({ date: date || '', time: time || '' });
    if (excludeMeetingId) query.set('excludeMeetingId', excludeMeetingId);
    axios.get(`${API_BASE_URL}/meeting/teacher/rooms?${query}`, { headers })
      .then(({ data: body }) => {
        if (cancelled) return;
        setData(body);
        // Preselect the building/floor of an already chosen room (editing).
        if (roomId) {
          for (const b of body.buildings || []) {
            for (const f of b.floors || []) {
              if ((f.rooms || []).some((r) => r.id === roomId)) { setBuildingId(b.id); setFloorId(f.id); }
            }
          }
        } else if (body.buildings?.length === 1) {
          setBuildingId(body.buildings[0].id);
        }
      })
      .catch(() => { if (!cancelled) setData({ buildings: [] }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time, excludeMeetingId]);

  const buildings = data?.buildings || [];
  const building = buildings.find((b) => b.id === buildingId);
  const floors = building?.floors || [];
  const floor = floors.find((f) => f.id === floorId);
  const rooms = floor?.rooms || [];
  const freeCount = rooms.filter((r) => r.available).length;
  const selectedRoom = rooms.find((r) => r.id === roomId);

  // If the date/time changed and the chosen room is now taken, drop it.
  useEffect(() => {
    if (selectedRoom && !selectedRoom.available) onChange({ roomId: '', location: '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom?.available]);

  const pick = (room) => onChange({
    roomId: room.id,
    location: [building?.name, floor?.name, `Room ${room.roomNumber}`].filter(Boolean).join(' · '),
  });
  const pickCls = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 outline-none focus:border-orange-400 disabled:bg-slate-50';

  if (custom || (!loading && data && buildings.length === 0)) {
    return (
      <div className="space-y-1.5">
        <MiniField label="Venue (Optional)">
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input type="text" value={location} onChange={(e) => onChange({ roomId: '', location: e.target.value })} className={`${pickCls} pl-8`} placeholder="Staff room, library…" />
          </div>
        </MiniField>
        {buildings.length > 0 && <button type="button" onClick={() => { setCustom(false); onChange({ roomId: '', location: '' }); }} className="text-[12px] font-semibold text-orange-600 hover:underline">Pick a school room instead</button>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-slate-700">Room</span>
        <button type="button" onClick={() => { setCustom(true); onChange({ roomId: '', location: '' }); }} className="text-[11px] font-semibold text-slate-500 hover:text-orange-600">Other place</button>
      </div>
      {!(date && time) && <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">Set the date and time in Details to see which rooms are free.</p>}
      <div className="grid grid-cols-2 gap-2">
        <select value={buildingId} onChange={(e) => { setBuildingId(e.target.value); setFloorId(''); onChange({ roomId: '', location: '' }); }} className={pickCls} disabled={loading}>
          <option value="">{loading ? 'Loading…' : 'Building'}</option>
          {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={floorId} disabled={!buildingId} onChange={(e) => { setFloorId(e.target.value); onChange({ roomId: '', location: '' }); }} className={pickCls}>
          <option value="">Floor</option>
          {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      {floor && (
        rooms.length === 0 ? <p className="text-[12px] text-slate-500">No rooms on this floor.</p> : (
          <>
            <p className="text-[11px] text-slate-500"><b className="text-emerald-600">{freeCount}</b> of {rooms.length} rooms free{date && time ? ' at this time' : ''}</p>
            <div className="grid max-h-36 grid-cols-4 gap-1.5 overflow-y-auto pr-0.5">
              {rooms.map((room) => {
                const chosen = room.id === roomId;
                return (
                  <button
                    key={room.id}
                    type="button"
                    disabled={!room.available}
                    title={room.available ? `Room ${room.roomNumber}${room.label ? ` · ${room.label}` : ''}` : room.reason}
                    onClick={() => pick(room)}
                    className={`rounded-lg border px-1 py-1.5 text-center text-[12px] font-semibold transition ${chosen ? 'border-orange-500 bg-orange-500 text-white' : room.available ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400' : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through'}`}
                  >
                    {room.roomNumber}
                    <span className={`block text-[9px] font-medium no-underline ${chosen ? 'text-white/90' : room.available ? 'text-emerald-600' : 'text-slate-400'}`}>{room.available ? 'Free' : room.reason}</span>
                  </button>
                );
              })}
            </div>
          </>
        )
      )}
    </div>
  );
};

const MiniField = ({ label, required, children }) => (
  <label className="block">
    <span className="mb-0.5 block text-[12px] font-medium text-slate-700">{label}{required && <span className="text-red-500"> *</span>}</span>
    {children}
  </label>
);

// Icon tile for a meeting row, picked from its topic so rows look varied but stable.
const MEETING_ICONS = [
  { icon: GraduationCap, cls: 'bg-violet-50 text-violet-600' },
  { icon: BarChart3, cls: 'bg-emerald-50 text-emerald-600' },
  { icon: Users, cls: 'bg-orange-50 text-orange-500' },
  { icon: Heart, cls: 'bg-rose-50 text-rose-500' },
  { icon: FileText, cls: 'bg-blue-50 text-blue-600' },
  { icon: ClipboardList, cls: 'bg-indigo-50 text-indigo-600' },
];
const meetingIcon = (meeting) => {
  const key = String(meeting.topic || meeting.title || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return MEETING_ICONS[hash % MEETING_ICONS.length];
};

const TYPE_PILL = {
  'In Person': { icon: MapPin, label: 'In person' },
  'Video Call': { icon: Video, label: 'Video call' },
  'Phone Call': { icon: Phone, label: 'Phone call' },
};

const PersonAvatar = ({ name, photo, tone }) => {
  const [broken, setBroken] = useState(false);
  const url = typeof photo === 'string' ? photo : photo?.secure_url || photo?.url || '';
  if (url && !broken) {
    return <img src={url} alt="" onError={() => setBroken(true)} className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />;
  }
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${tone}`}>
      {String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'}
    </span>
  );
};

const PersonLine = ({ name, sub, tone, photo }) => (
  <div className="flex items-center gap-2">
    <PersonAvatar name={name} photo={photo} tone={tone} />
    <div className="min-w-0 leading-tight">
      <p className="truncate text-[13px] font-semibold text-slate-800">{name || '—'}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  </div>
);

const MeetingRow = ({ meeting, menuOpen, onToggleMenu, isUpdating, onUpdateStatus, confirmingDelete, onAskDelete, onEdit, onDelete, onCancelDelete }) => {
  const buttonRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);
  useLayoutEffect(() => {
    if (!menuOpen) { setMenuPos(null); return undefined; }
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = 180;
      const openUp = rect.bottom + menuHeight > window.innerHeight - 8;
      setMenuPos({ right: Math.max(8, window.innerWidth - rect.right), ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [menuOpen]);
  const { icon: TopicIcon, cls } = meetingIcon(meeting);
  const type = TYPE_PILL[meeting.meetingType] || TYPE_PILL['In Person'];
  const TypeIcon = type.icon;
  const status = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled;
  const transitions = STATUS_TRANSITIONS[meeting.status] || [];
  const student = meeting.studentId || {};
  const joinUrl = meeting.meetingType === 'Video Call' ? jitsiRoomUrl(meeting) : meeting.meetingLink;

  return (
    <tr className="align-middle hover:bg-slate-50/60">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cls}`}><TopicIcon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-900">{meeting.title}</p>
            <p className="truncate text-[11px] text-slate-500">{meeting.topic}</p>
          </div>
        </div>
      </td>
      <td className="space-y-1.5 px-3 py-2.5">
        <PersonLine name={student.name} photo={student.profilePic} sub={student.grade ? `Class ${student.grade}${student.section ? ` ${student.section}` : ''}` : ''} tone="bg-rose-100 text-rose-600" />
        {meeting.parentId?.name && <PersonLine name={meeting.parentId.name} photo={meeting.parentId.profilePic} sub={meeting.parentId.relation || 'Parent'} tone="bg-slate-200 text-slate-600" />}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-slate-700">
        <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" />{new Date(meeting.meetingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        <p className="mt-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-slate-400" />{formatTime(meeting.meetingTime)}</p>
      </td>
      <td className="px-3 py-2.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700"><TypeIcon className="h-3 w-3" />{type.label}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />{status.label}</span>
      </td>
      <td className="px-3 py-2.5 text-center">
        {confirmingDelete ? (
          <div className="inline-flex items-center gap-1">
            <button type="button" onClick={onDelete} className="rounded-md bg-red-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-600">Delete</button>
            <button type="button" onClick={onCancelDelete} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200">Keep</button>
          </div>
        ) : (
          <div className="relative inline-block">
            <button ref={buttonRef} type="button" disabled={isUpdating} onClick={onToggleMenu} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Meeting actions">
              {isUpdating ? <span className="h-3.5 w-3.5 animate-spin rounded-full border border-slate-400 border-t-transparent" /> : <MoreHorizontal className="h-4 w-4" />}
            </button>
            {menuOpen && menuPos && createPortal(
              <div style={{ position: 'fixed', ...menuPos }} className="z-60 min-w-40 rounded-lg border border-slate-100 bg-white py-1 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
                {meeting.status !== 'completed' && meeting.status !== 'cancelled' && (
                  <button type="button" onClick={onEdit} className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50">
                    <Pencil className="h-3.5 w-3.5" />Edit
                  </button>
                )}
                {joinUrl && (
                  <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-indigo-600 hover:bg-slate-50">
                    <Video className="h-3.5 w-3.5" />Join meeting
                  </a>
                )}
                {transitions.map((st) => (
                  <button key={st} type="button" onClick={(e) => onUpdateStatus(meeting._id, st, e)} className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50">
                    <span className={`h-2 w-2 rounded-full ${STATUS_CONFIG[st].dot}`} />Mark as {STATUS_CONFIG[st].label}
                  </button>
                ))}
                <button type="button" onClick={onAskDelete} className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-red-600 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />Delete
                </button>
              </div>,
              document.body
            )}
          </div>
        )}
      </td>
    </tr>
  );
};

export default ParentMeetings;
