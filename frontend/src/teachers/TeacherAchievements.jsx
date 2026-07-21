import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Award, Calendar, ChevronRight, Edit3, Loader2, Search, Trophy, Trash2, Upload, X } from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '') + '/api';
const norm = (v = '') => String(v || '').trim().toLowerCase();
const todayLabel = () =>
  new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

/* ─── Shared input style ─────────────────────────────────── */
const inp =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-50 disabled:cursor-not-allowed';

/* ─── Field label wrapper ────────────────────────────────── */
const Field = ({ label, children }) => (
  <div>
    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
      {label}
    </label>
    {children}
  </div>
);

/* ─── Step header row ────────────────────────────────────── */
const StepHeader = ({ n, title }) => (
  <div className="flex items-center gap-3 mb-5">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
      {n}
    </span>
    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
    <ChevronRight size={13} className="ml-auto text-slate-300" />
  </div>
);

/* ─── Avatar chip ────────────────────────────────────────── */
const StudentChip = ({ student, selected, onClick, disabled }) => {
  const name    = student.name || 'Student';
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const roll    = student.roll || student.rollNo || student.rollNumber || '';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all duration-150',
        selected
          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50',
      ].join(' ')}
    >
      <span className={[
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
        selected ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700',
      ].join(' ')}>
        {initials}
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-xs font-semibold truncate leading-tight">{name}</span>
        {roll && (
          <span className={['text-[10px]', selected ? 'text-indigo-200' : 'text-slate-400'].join(' ')}>
            Roll {roll}
          </span>
        )}
      </span>
    </button>
  );
};

/* ─── Achievement row card ───────────────────────────────── */
const AchievementCard = ({ item, onEdit, onDelete, deleting }) => (
  <Motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    transition={{ duration: 0.18 }}
    className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
  >
    <div className="flex items-start gap-3 flex-1 min-w-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
        <Trophy size={16} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{item.title || '—'}</span>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
            Achievement
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Award size={10} className="text-slate-400" />
            {item.studentName || '—'}
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={10} className="text-slate-400" />
            {item.date
              ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—'}
          </span>
          {item.description && (
            <span className="line-clamp-1 max-w-xs">{item.description}</span>
          )}
        </div>
      </div>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={() => onEdit(item)}
        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
      >
        <Edit3 size={11} /> Edit
      </button>
      <button
        type="button"
        onClick={() => onDelete(item)}
        disabled={deleting}
        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 text-red-400 hover:border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      </button>
    </div>
  </Motion.div>
);

/* ─── Edit modal ─────────────────────────────────────────── */
const EditModal = ({ item, onClose, onSave, saving }) => {
  const [form, setForm] = useState({
    title:       item?.title || '',
    date:        item?.date ? new Date(item.date).toISOString().slice(0, 10) : '',
    description: item?.description || '',
  });
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <Motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">Edit Achievement</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-3 p-5">
          <Field label="Title">
            <input type="text" value={form.title} onChange={set('title')} className={inp} required placeholder="Achievement title" />
          </Field>
          <Field label="Achievement Date">
            <input type="date" value={form.date} onChange={set('date')} className={inp} required />
          </Field>
          <Field label="Details">
            <textarea value={form.description} onChange={set('description')} rows={3} className={`${inp} rounded-xl resize-none`} placeholder="Achievement details…" />
          </Field>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Motion.div>
    </div>
  );
};

/* ─── Main component ─────────────────────────────────────── */
const TeacherAchievements = () => {
  const [students, setStudents]                               = useState([]);
  const [loadingStudents, setLoadingStudents]                 = useState(false);
  const [sessionOptions, setSessionOptions]                   = useState([]);
  const [classTeacherAllocations, setClassTeacherAllocations] = useState([]);
  const [loadingAllocations, setLoadingAllocations]           = useState(false);
  const [selectedSession, setSelectedSession]                 = useState('');
  const [selectedClass, setSelectedClass]                     = useState('');
  const [selectedSection, setSelectedSection]                 = useState('');
  const [selectedStudentId, setSelectedStudentId]             = useState('');
  const [studentSearch, setStudentSearch]                     = useState('');
  const [achievements, setAchievements]                       = useState([]);
  const [loadingAchievements, setLoadingAchievements]         = useState(false);
  const [deletingAchievementId, setDeletingAchievementId]     = useState('');
  const [editingRow, setEditingRow]                           = useState(null);
  const [updatingAchievementId, setUpdatingAchievementId]     = useState('');
  const [title, setTitle]                                     = useState('');
  const [achievementDate, setAchievementDate]                 = useState('');
  const [description, setDescription]                         = useState('');
  const [submitting, setSubmitting]                           = useState(false);

  const token   = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const selectedStudent = students.find((s) => String(s._id) === String(selectedStudentId)) || null;

  const allowedPairs = useMemo(() => {
    const set = new Set();
    classTeacherAllocations.forEach((i) => {
      const cn = String(i?.className || '').trim();
      const sn = String(i?.sectionName || '').trim();
      if (cn && sn) set.add(`${norm(cn)}__${norm(sn)}`);
    });
    return set;
  }, [classTeacherAllocations]);

  const allowedClassOptions = useMemo(() =>
    [...new Set(classTeacherAllocations.map((i) => String(i?.className || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  [classTeacherAllocations]);

  const allowedSectionOptions = useMemo(() =>
    [...new Set(
      classTeacherAllocations
        .filter((i) => !selectedClass || norm(i?.className) === norm(selectedClass))
        .map((i) => String(i?.sectionName || '').trim())
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  [classTeacherAllocations, selectedClass]);

  useEffect(() => {
    if (selectedClass && !allowedClassOptions.some((i) => norm(i) === norm(selectedClass))) {
      setSelectedClass(''); setSelectedSection(''); setSelectedStudentId('');
    } else if (selectedSection && !allowedSectionOptions.some((i) => norm(i) === norm(selectedSection))) {
      setSelectedSection(''); setSelectedStudentId('');
    }
  }, [selectedClass, selectedSection, allowedClassOptions, allowedSectionOptions]);

  useEffect(() => {
    const run = async () => {
      setLoadingAllocations(true);
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/teacher/dashboard/allocations`, { headers });
        setClassTeacherAllocations(
          (Array.isArray(data) ? data : [])
            .filter((i) => i?.isClassTeacher === true)
            .map((i) => ({
              className:   String(i?.classId?.name   || '').trim(),
              sectionName: String(i?.sectionId?.name || '').trim(),
              classId:     i?.classId?._id  || '',
              sectionId:   i?.sectionId?._id || '',
            }))
            .filter((i) => i.className && i.sectionName),
        );
      } catch { setClassTeacherAllocations([]); }
      finally { setLoadingAllocations(false); }
    };
    run();
  }, [headers]);

  useEffect(() => {
    if (!selectedSession || !selectedClass || !selectedSection) { setStudents([]); return; }
    const run = async () => {
      setLoadingStudents(true);
      try {
        const q = new URLSearchParams({ session: selectedSession, className: selectedClass, section: selectedSection });
        const { data } = await axios.get(`${API_BASE_URL}/meeting/teacher/students?${q}`, { headers });
        setStudents(
          (Array.isArray(data?.students) ? data.students : []).filter((s) => {
            const cn = String(s?.grade || s?.className || s?.class || '').trim();
            const sn = String(s?.section || s?.sectionName || '').trim();
            return allowedPairs.has(`${norm(cn)}__${norm(sn)}`);
          }),
        );
      } catch { setStudents([]); }
      finally { setLoadingStudents(false); }
    };
    if (!loadingAllocations) run();
  }, [headers, selectedSession, selectedClass, selectedSection, allowedPairs, loadingAllocations]);

  useEffect(() => {
    if (loadingAllocations) return;
    const run = async () => {
      try {
        const [yr, sr] = await Promise.all([
          axios.get(`${API_BASE_URL}/academic/active-year`, { headers }),
          axios.get(`${API_BASE_URL}/meeting/teacher/students`,  { headers }),
        ]);
        const name = String(yr?.data?.name || yr?.data?.academicYear || yr?.data?.activeYear || sr?.data?.activeSession || '').trim();
        setSessionOptions(name ? [name] : []);
        if (name) setSelectedSession(name);
      } catch { setSessionOptions([]); }
    };
    run();
  }, [headers, loadingAllocations]);

  useEffect(() => {
    const run = async () => {
      setLoadingAchievements(true);
      try {
        const q = new URLSearchParams();
        if (selectedSession)   q.set('session',   selectedSession);
        if (selectedClass)     q.set('className', selectedClass);
        if (selectedSection)   q.set('section',   selectedSection);
        if (selectedStudentId) q.set('studentId', selectedStudentId);
        const { data } = await axios.get(`${API_BASE_URL}/achievements/teacher/list?${q}`, { headers });
        setAchievements(Array.isArray(data?.achievements) ? data.achievements : []);
      } catch { setAchievements([]); }
      finally { setLoadingAchievements(false); }
    };
    run();
  }, [headers, selectedSession, selectedClass, selectedSection, selectedStudentId]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return q
      ? students.filter((s) => (s.name || '').toLowerCase().includes(q) || String(s.roll || s.rollNo || '').includes(q))
      : students;
  }, [students, studentSearch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSession || !selectedClass || !selectedSection || !selectedStudentId) {
      toast.error('Please select session, class, section and student.'); return;
    }
    if (!title.trim() || !achievementDate) { toast.error('Title and date are required.'); return; }
    setSubmitting(true);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/achievements/teacher/upload`,
        { studentId: selectedStudentId, title: title.trim(), date: achievementDate, description: description.trim() },
        { headers },
      );
      toast.success(data?.message || 'Achievement uploaded.');
      setTitle(''); setAchievementDate(''); setDescription(''); setSelectedStudentId('');
      const q = new URLSearchParams({ session: selectedSession, className: selectedClass, section: selectedSection });
      const lr = await axios.get(`${API_BASE_URL}/achievements/teacher/list?${q}`, { headers });
      setAchievements(Array.isArray(lr?.data?.achievements) ? lr.data.achievements : []);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to upload'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (item) => {
    if (!item?.studentId || !item?.achievementId) return;
    if (!window.confirm('Delete this achievement?')) return;
    setDeletingAchievementId(String(item.achievementId));
    try {
      const { data } = await axios.delete(`${API_BASE_URL}/achievements/teacher/${item.studentId}/${item.achievementId}`, { headers });
      toast.success(data?.message || 'Deleted.');
      setAchievements((p) => p.filter((r) => String(r.achievementId) !== String(item.achievementId)));
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
    finally { setDeletingAchievementId(''); }
  };

  const handleUpdate = async (form) => {
    if (!editingRow?.studentId || !editingRow?.achievementId) return;
    if (!form.title.trim() || !form.date) { toast.error('Title and date are required.'); return; }
    setUpdatingAchievementId(String(editingRow.achievementId));
    try {
      const { data } = await axios.put(
        `${API_BASE_URL}/achievements/teacher/${editingRow.studentId}/${editingRow.achievementId}`,
        { title: form.title.trim(), date: form.date, description: form.description.trim() },
        { headers },
      );
      toast.success(data?.message || 'Updated.');
      setAchievements((p) =>
        p.map((r) =>
          String(r.achievementId) === String(editingRow.achievementId)
            ? { ...r, title: form.title.trim(), date: form.date, description: form.description.trim() }
            : r,
        ),
      );
      setEditingRow(null);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update'); }
    finally { setUpdatingAchievementId(''); }
  };

  const scopeReady = selectedSession && selectedClass && selectedSection;

  return (
    <>
      <AnimatePresence>
        {editingRow && (
          <EditModal
            item={editingRow}
            onClose={() => setEditingRow(null)}
            onSave={handleUpdate}
            saving={String(updatingAchievementId) === String(editingRow?.achievementId)}
          />
        )}
      </AnimatePresence>

      {/* ── Floating page card (matches the attendance page structure) ── */}
      <Motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto w-full max-w-[1100px] rounded-[2rem] border border-[#e2e8ee] bg-white p-5 text-black shadow-[0_4px_20px_rgba(0,20,30,0.05)] transition-shadow hover:shadow-[0_8px_32px_rgba(0,20,30,0.07)] sm:p-8"
      >

        {/* ── Page header ───────────────────────────────────── */}
        <Motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.3 }}
          className="mb-6 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-[#e2e8ee] bg-[#f0f4f8]">
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-950">Student Achievements</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Select scope → pick student → upload achievement details.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-500">
            <Calendar size={11} className="text-indigo-400" />
            {todayLabel()}
          </span>
        </Motion.div>

        {/* ── Step 1: Scope ─────────────────────────────────── */}
        <Motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.3 }}
          className="mb-5 rounded-2xl border border-[#e2e8ee] bg-[#fafbfc] px-4 py-4"
        >
          <StepHeader n={1} title="Select scope" />
          <div className="flex flex-wrap gap-3">
            {[
              {
                label: 'SESSION', value: selectedSession, disabled: true,
                options: sessionOptions,
                onChange: (v) => { setSelectedSession(v); setSelectedClass(''); setSelectedSection(''); setSelectedStudentId(''); },
                placeholder: 'Select',
              },
              {
                label: 'CLASS', value: selectedClass, disabled: !selectedSession,
                options: allowedClassOptions,
                onChange: (v) => { setSelectedClass(v); setSelectedSection(''); setSelectedStudentId(''); },
                placeholder: 'Select class',
              },
              {
                label: 'SECTION', value: selectedSection, disabled: !selectedClass,
                options: allowedSectionOptions,
                onChange: (v) => { setSelectedSection(v); setSelectedStudentId(''); },
                placeholder: 'Select section',
              },
            ].map(({ label, value, disabled, options, onChange, placeholder }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {label}
                </span>
                <select
                  className="border-0 bg-transparent text-sm font-medium text-slate-800 outline-none disabled:opacity-50"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  disabled={disabled}
                >
                  <option value="">{placeholder}</option>
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          {!loadingAllocations && classTeacherAllocations.length === 0 && (
            <p className="mt-3 text-xs text-red-500">
              No class-teacher allocation found. Achievements can only be managed for your allocated class.
            </p>
          )}
        </Motion.div>

        {/* ── Step 2: Student picker ─────────────────────────── */}
        <Motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="mb-5 rounded-2xl border border-[#e2e8ee] bg-[#fafbfc] px-4 py-4"
        >
          <StepHeader n={2} title="Students in selected class / section" />

          {!scopeReady ? (
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <Award size={18} className="text-slate-200" />
              Select session, class and section to load students.
            </div>
          ) : loadingStudents ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 size={14} className="animate-spin" /> Loading students…
            </div>
          ) : students.length === 0 ? (
            <p className="text-sm text-slate-400">No students found for selected scope.</p>
          ) : (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or roll…"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="max-h-48 overflow-y-auto pr-0.5">
                <div className="flex flex-wrap gap-2">
                  {filteredStudents.map((student) => {
                    const id = String(student._id || '');
                    return (
                      <StudentChip
                        key={id}
                        student={student}
                        selected={String(selectedStudentId) === id}
                        onClick={() => setSelectedStudentId((p) => String(p) === id ? '' : id)}
                        disabled={submitting}
                      />
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </Motion.div>

        {/* ── Step 3: Achievement details ────────────────────── */}
        <Motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.3 }}
          className="mb-5 rounded-2xl border border-[#e2e8ee] bg-[#fafbfc] px-4 py-4"
        >
          <StepHeader n={3} title="Achievement details" />

          {selectedStudent && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-200 text-[10px] font-bold text-indigo-800">
                {(selectedStudent.name || 'S').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
              <span className="font-semibold text-indigo-700">{selectedStudent.name}</span>
              <span className="text-indigo-400">selected</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Title">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inp}
                  placeholder="e.g. Science Olympiad Gold"
                  required
                />
              </Field>
              <Field label="Achievement Date">
                <input
                  type="date"
                  value={achievementDate}
                  onChange={(e) => setAchievementDate(e.target.value)}
                  className={inp}
                  required
                />
              </Field>
            </div>
            <Field label="Details">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={`${inp} rounded-xl resize-none`}
                placeholder="Write achievement details…"
              />
            </Field>
            <button
              type="submit"
              disabled={submitting || !selectedStudentId}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 active:scale-[0.97] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting
                ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                : <><Upload size={14} className="opacity-70" /> Upload</>}
            </button>
          </form>
        </Motion.div>

        {/* ── Step 4: Uploaded achievements ─────────────────── */}
        <Motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.3 }}
          className="rounded-2xl border border-[#e2e8ee] bg-[#fafbfc] p-4"
        >
          <div className="flex items-center gap-3 mb-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
              4
            </span>
            <h3 className="text-sm font-semibold text-slate-800">Uploaded achievements</h3>
            {achievements.length > 0 && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">
                {achievements.length}
              </span>
            )}
            <ChevronRight size={13} className="ml-auto text-slate-300" />
          </div>

          {loadingAchievements ? (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : achievements.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-400">
              <Trophy size={18} className="text-slate-200" />
              Upload achievements using the form above to see them here.
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {achievements.map((item) => (
                  <AchievementCard
                    key={`${item.studentId}-${item.achievementId}`}
                    item={item}
                    onEdit={setEditingRow}
                    onDelete={handleDelete}
                    deleting={String(deletingAchievementId) === String(item.achievementId)}
                  />
                ))}
              </AnimatePresence>
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-400">
                <Trophy size={13} className="text-slate-300" />
                Upload more achievements using the form above.
              </div>
            </div>
          )}
        </Motion.div>

      </Motion.div>
    </>
  );
};

export default TeacherAchievements;
