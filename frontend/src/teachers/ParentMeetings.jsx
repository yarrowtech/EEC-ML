import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, Video, Phone, Users, MapPin, Link,
  Plus, Trash2, X, AlertCircle, CheckCircle, ChevronDown, ChevronRight,
  User, Filter
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { formatStudentDisplay } from '../utils/studentDisplay';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '') + '/api';

const mergeOptions = (server, derived) =>
  [...new Set([...(server || []), ...(derived || [])].map(String).filter(Boolean))].sort();

const EMPTY_FORM = {
  studentId: '', title: '', topic: '', description: '',
  meetingDate: '', meetingTime: '', meetingType: 'In Person',
  location: '', meetingLink: ''
};

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  confirmed:  { label: 'Confirmed', cls: 'bg-green-50 text-green-700 border-green-200',  dot: 'bg-green-500' },
  completed:  { label: 'Completed', cls: 'bg-blue-50 text-blue-700 border-blue-200',    dot: 'bg-blue-500'  },
  cancelled:  { label: 'Cancelled', cls: 'bg-red-50 text-red-600 border-red-200',       dot: 'bg-red-400'   },
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
  { value: 'student', label: 'Student' },
  { value: 'class',   label: 'Class'   },
  { value: 'section', label: 'Section' },
];

const STATUS_TABS = ['all', 'scheduled', 'confirmed', 'completed', 'cancelled'];

const inp = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-100 transition placeholder:text-slate-400';

const Field = ({ label, required, children }) => (
  <div>
    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const FlowNode = ({ label, value, active }) => (
  <div className={`min-w-[120px] rounded-lg border px-3 py-2 ${active ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className={`text-xs font-semibold truncate ${active ? 'text-amber-700' : 'text-slate-500'}`}>
      {value || 'Not selected'}
    </p>
  </div>
);

const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = +h;
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
};

/* ─── Status badge ─── */
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
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
      if (!formClass) return [];
      return students.filter((s) => String(s?.grade || '').trim().toLowerCase() === formClass.toLowerCase());
    }
    if (meetingScope === 'section') {
      if (!formClass || !formSection) return [];
      return students.filter(
        (s) =>
          String(s?.grade || '').trim().toLowerCase() === formClass.toLowerCase() &&
          String(s?.section || '').trim().toLowerCase() === formSection.toLowerCase()
      );
    }
    return [];
  }, [meetingScope, students, formData.studentId, formClass, formSection]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formSession || !formClass) { setError('Select session and class.'); return; }
    if (meetingScope === 'student' && !formSection) { setError('Select section before selecting student.'); return; }
    if (meetingScope === 'section' && !formSection) { setError('Select section.'); return; }
    if (meetingScope === 'student' && !formData.studentId) { setError('Select a student.'); return; }
    if (!formData.title || !formData.topic || !formData.meetingDate || !formData.meetingTime) { setError('Fill all required fields.'); return; }
    if (!studentTargets.length) { setError('No students found for the selected scope.'); return; }

    setSubmitting(true); setError('');
    try {
      const reqs = studentTargets.map(async (student) => {
        const parentRes = await axios.get(`${API_BASE_URL}/meeting/teacher/student/${student._id}/parent`, { headers });
        return axios.post(`${API_BASE_URL}/meeting/teacher/create`, { ...formData, studentId: student._id, parentId: parentRes.data._id }, { headers });
      });
      const results    = await Promise.allSettled(reqs);
      const ok         = results.filter((r) => r.status === 'fulfilled').length;
      const fail       = results.length - ok;
      if (ok)   setSuccess(fail ? `${ok} scheduled, ${fail} failed.` : `${ok} meeting(s) scheduled! Parents notified.`);
      if (fail) setError('Some meetings could not be scheduled.');
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

  const selectedStudent = students.find((s) => String(s._id) === String(formData.studentId));
  const studentsFlowValue = meetingScope === 'student'
    ? (selectedStudent?.name || (formSession && formClass && formSection ? 'Select student' : 'Wait for section'))
    : (studentTargets.length ? `${studentTargets.length} selected` : 'Will auto select');

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <div className="bg-linear-to-r from-yellow-400 via-amber-400 to-orange-400 px-6 py-7 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl"><Users className="w-6 h-6" /></div>
              Parent-Teacher Meetings
            </h1>
            <p className="text-yellow-100 text-sm mt-1">Schedule, filter and track all parent meetings</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setError(''); setMeetingScope('student'); setFormData(EMPTY_FORM); }}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 bg-white text-amber-700 rounded-xl text-sm font-semibold hover:bg-yellow-50 shadow-md transition-colors"
          >
            <Plus className="w-4 h-4" /> Schedule Meeting
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',     value: stats.total,     color: 'text-slate-700',  bg: 'bg-white border-slate-200'       },
            { label: 'Scheduled', value: stats.scheduled, color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-100'    },
            { label: 'Confirmed', value: stats.confirmed, color: 'text-green-700',  bg: 'bg-green-50 border-green-100'    },
            { label: 'Completed', value: stats.completed, color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-100'      },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 shadow-sm ${bg}`}>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Alerts ── */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /><span className="flex-1">{error}</span>
            <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" /><span>{success}</span>
          </div>
        )}

        {/* ── Meetings list card ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Filter bar */}
          <div className="px-5 py-4 border-b border-slate-100 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide mr-1">Filter by</span>

              {/* Session */}
              <select
                value={filterSession}
                onChange={(e) => { setFilterSession(e.target.value); setFilterClass(''); setFilterSection(''); }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-400 min-w-32"
              >
                <option value="">All Sessions</option>
                {listSessionOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Class */}
              <select
                value={filterClass}
                onChange={(e) => { setFilterClass(e.target.value); setFilterSection(''); }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-400 min-w-28"
              >
                <option value="">All Classes</option>
                {listClassOptions.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>

              {/* Section */}
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-400 min-w-28"
              >
                <option value="">All Sections</option>
                {listSectionOptions.map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>

              {(filterSession || filterClass || filterSection) && (
                <button
                  onClick={() => { setFilterSession(''); setFilterClass(''); setFilterSection(''); }}
                  className="text-xs text-amber-600 hover:text-amber-800 font-semibold ml-1"
                >
                  Clear
                </button>
              )}

              <span className="ml-auto text-xs text-slate-400 font-medium">
                {filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Status tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === tab
                      ? tab === 'all'
                        ? 'bg-slate-800 text-white'
                        : tab === 'scheduled'  ? 'bg-amber-500 text-white'
                        : tab === 'confirmed'  ? 'bg-green-600 text-white'
                        : tab === 'completed'  ? 'bg-blue-600 text-white'
                        : 'bg-red-500 text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {tab === 'all' ? 'All' : STATUS_CONFIG[tab]?.label}
                  {tabCounts[tab] > 0 && (
                    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      activeTab === tab ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {tabCounts[tab]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Meeting rows */}
          {loading && meetings.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400">Loading meetings…</p>
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6 text-slate-300" />
              </div>
              <p className="font-semibold text-slate-500 mb-1">
                {meetings.length === 0 ? 'No meetings yet' : 'No meetings match filters'}
              </p>
              <p className="text-xs text-slate-400">
                {meetings.length === 0 ? 'Schedule your first parent-teacher meeting' : 'Try adjusting the filters above'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredMeetings.map((meeting) => {
                const typeInfo   = MEETING_TYPES.find(t => t.value === meeting.meetingType) || MEETING_TYPES[0];
                const TypeIcon   = typeInfo.icon;
                const transitions = STATUS_TRANSITIONS[meeting.status] || [];
                const isUpdating  = updatingId === meeting._id;

                return (
                  <div key={meeting._id} className="px-5 py-4 hover:bg-slate-50/60 transition-colors group">
                    <div className="flex items-start gap-4">

                      {/* Type icon */}
                      <div className={`shrink-0 mt-0.5 p-2.5 rounded-xl border ${typeInfo.bg}`}>
                        <TypeIcon className={`w-4 h-4 ${typeInfo.color}`} />
                      </div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <h3 className="font-semibold text-slate-800 text-sm">{meeting.title}</h3>
                              <StatusBadge status={meeting.status} />
                            </div>
                            <p className="text-xs text-slate-500 font-medium">{meeting.topic}</p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Status updater */}
                            {transitions.length > 0 && (
                              <div className="relative">
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={(e) => { e.stopPropagation(); setOpenStatusId(openStatusId === meeting._id ? null : meeting._id); }}
                                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  {isUpdating ? (
                                    <div className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <><span>Update</span><ChevronDown className="w-3 h-3" /></>
                                  )}
                                </button>
                                {openStatusId === meeting._id && (
                                  <div
                                    className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-slate-100 py-1 min-w-36"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {transitions.map((st) => {
                                      const cfg = STATUS_CONFIG[st];
                                      return (
                                        <button
                                          key={st}
                                          onClick={(e) => handleUpdateStatus(meeting._id, st, e)}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors"
                                        >
                                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                          <span className="font-medium text-slate-700">Mark as {cfg.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Delete */}
                            {deleteConfirmId === meeting._id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleDelete(meeting._id)} className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-1.5 rounded-lg">Yes</button>
                                <button onClick={() => setDeleteConfirmId(null)} className="text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded-lg">No</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(meeting._id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Meta pills */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-2">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span className="font-medium text-slate-600">{meeting.studentId?.name}</span>
                            {meeting.studentId?.grade && <span>· Class {meeting.studentId.grade}{meeting.studentId.section ? ` ${meeting.studentId.section}` : ''}</span>}
                          </span>
                          {meeting.parentId?.name && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {meeting.parentId.name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(meeting.meetingDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(meeting.meetingTime)}
                          </span>
                          {meeting.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />{meeting.location}
                            </span>
                          )}
                          {meeting.meetingLink && (
                            <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700 font-medium">
                              <Link className="w-3 h-3" />Join
                            </a>
                          )}
                        </div>
                        {meeting.description && (
                          <p className="text-xs text-slate-400 mt-1.5 italic line-clamp-1">{meeting.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Schedule Meeting Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col border border-slate-100 z-10">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm shadow-amber-200">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Schedule Meeting</h3>
                  <p className="text-xs text-slate-400">Parent will be notified immediately</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 rounded-xl px-3 py-2.5 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
                </div>
              )}

              {/* Step 1 — Scope */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                  Select Scope
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {MEETING_SCOPES.map((scope) => (
                    <button key={scope.value} type="button"
                      onClick={() => { setMeetingScope(scope.value); setFormData(p => ({ ...p, studentId: '' })); if (scope.value === 'class') setFormSection(''); }}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${meetingScope === scope.value ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      {scope.label} Wise
                    </button>
                  ))}
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-700">Reference Flow</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <FlowNode label="Session" value={formSession} active={Boolean(formSession)} />
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
                    <FlowNode label="Class" value={formClass} active={Boolean(formSession && formClass)} />
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
                    <FlowNode label="Section" value={formSection} active={Boolean(formSession && formClass && formSection)} />
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
                    <FlowNode
                      label="Students"
                      value={studentsFlowValue}
                      active={meetingScope === 'student' ? Boolean(formData.studentId) : studentTargets.length > 0}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Session" required>
                    <select value={formSession} onChange={(e) => { setFormSession(e.target.value); setFormClass(''); setFormSection(''); setFormData(p => ({ ...p, studentId: '' })); }} className={inp} required>
                      <option value="">Session…</option>
                      {sessionOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  {formSession && (
                    <Field label="Class" required>
                      <select value={formClass} onChange={(e) => { setFormClass(e.target.value); setFormSection(''); setFormData(p => ({ ...p, studentId: '' })); }} className={inp} required>
                        <option value="">Class…</option>
                        {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                  )}
                  {formSession && formClass && (
                    <Field label="Section" required={meetingScope !== 'class'}>
                      <select value={formSection} onChange={(e) => { setFormSection(e.target.value); setFormData(p => ({ ...p, studentId: '' })); }} className={inp} required={meetingScope !== 'class'}>
                        <option value="">{meetingScope === 'class' ? 'All Sections' : 'Section…'}</option>
                        {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                  )}
                </div>
                {meetingScope === 'student' && formSession && formClass && formSection && (
                  <Field label="Student" required>
                    <select value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className={inp} required>
                      <option value="">Select student…</option>
                      {students.map(s => <option key={s._id} value={s._id}>{formatStudentDisplay(s)}</option>)}
                    </select>
                  </Field>
                )}
                {meetingScope === 'student' && formSession && formClass && !formSection && (
                  <p className="text-xs text-slate-400">Select section to load students.</p>
                )}
                {/* Target preview */}
                <div className={`rounded-lg px-3 py-2 text-xs ${studentTargets.length ? 'bg-green-50 border border-green-100 text-green-700' : 'bg-slate-50 border border-slate-200 text-slate-400'}`}>
                  <span className="font-bold">{studentTargets.length}</span> student{studentTargets.length !== 1 ? 's' : ''} selected
                  {studentTargets.length > 0 && <span className="ml-1 text-green-600">· {studentTargets.slice(0, 2).map(s => s.name).join(', ')}{studentTargets.length > 2 ? ` +${studentTargets.length - 2} more` : ''}</span>}
                </div>
              </div>

              {/* Step 2 — Details */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">2</span>
                  Meeting Details
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Title" required>
                    <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={inp} placeholder="Academic Discussion" required />
                  </Field>
                  <Field label="Topic" required>
                    <input type="text" value={formData.topic} onChange={(e) => setFormData({ ...formData, topic: e.target.value })} className={inp} placeholder="Student Progress" required />
                  </Field>
                  <Field label="Date" required>
                    <input type="date" value={formData.meetingDate} onChange={(e) => setFormData({ ...formData, meetingDate: e.target.value })} className={inp} required />
                  </Field>
                  <Field label="Time" required>
                    <input type="time" value={formData.meetingTime} onChange={(e) => setFormData({ ...formData, meetingTime: e.target.value })} className={inp} required />
                  </Field>
                </div>
                <Field label="Description">
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={`${inp} resize-none`} rows="2" placeholder="Additional agenda details…" />
                </Field>
              </div>

              {/* Step 3 — Type */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">3</span>
                  Meeting Type
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {MEETING_TYPES.map(({ value, label, icon: Icon, color, bg }) => (
                    <button key={value} type="button"
                      onClick={() => setFormData({ ...formData, meetingType: value, location: '', meetingLink: '' })}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${formData.meetingType === value ? `${bg} ${color} border-current shadow-sm` : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      <Icon className="w-4 h-4" />{label}
                    </button>
                  ))}
                </div>
                {formData.meetingType === 'In Person' && (
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className={`${inp} pl-9`} placeholder="Room / venue" />
                  </div>
                )}
                {formData.meetingType === 'Video Call' && (
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input type="url" value={formData.meetingLink} onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })} className={`${inp} pl-9`} placeholder="https://meet.google.com/…" />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pb-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
                <button type="submit" disabled={submitting || !studentTargets.length}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 shadow-md shadow-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {submitting ? 'Scheduling…' : `Schedule for ${studentTargets.length || 0} Student${studentTargets.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentMeetings;
