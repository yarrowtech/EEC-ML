import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Award, Calendar, FileText, Loader2, UserCheck, Trash2, Edit3, X } from 'lucide-react';
import { formatStudentDisplay } from '../utils/studentDisplay';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '') + '/api';
const inp = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-100 transition placeholder:text-slate-400';
const norm = (value = '') => String(value || '').trim().toLowerCase();

const Field = ({ label, children }) => (
  <div>
    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const TeacherAchievements = () => {
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [sessionOptions, setSessionOptions] = useState([]);
  const [classTeacherAllocations, setClassTeacherAllocations] = useState([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);

  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [achievements, setAchievements] = useState([]);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const [deletingAchievementId, setDeletingAchievementId] = useState('');
  const [editingRow, setEditingRow] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', date: '', description: '' });
  const [updatingAchievementId, setUpdatingAchievementId] = useState('');

  const [title, setTitle] = useState('');
  const [achievementDate, setAchievementDate] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const selectedStudent = students.find((s) => String(s._id) === String(selectedStudentId)) || null;
  const allowedPairs = useMemo(() => {
    const set = new Set();
    classTeacherAllocations.forEach((item) => {
      const className = String(item?.className || '').trim();
      const sectionName = String(item?.sectionName || '').trim();
      if (!className || !sectionName) return;
      set.add(`${norm(className)}__${norm(sectionName)}`);
    });
    return set;
  }, [classTeacherAllocations]);
  const allowedClassOptions = useMemo(() => {
    const items = classTeacherAllocations
      .map((item) => String(item?.className || '').trim())
      .filter(Boolean);
    return [...new Set(items)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [classTeacherAllocations]);
  const allowedSectionOptions = useMemo(() => {
    const scoped = classTeacherAllocations
      .filter((item) => !selectedClass || norm(item?.className) === norm(selectedClass))
      .map((item) => String(item?.sectionName || '').trim())
      .filter(Boolean);
    return [...new Set(scoped)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [classTeacherAllocations, selectedClass]);

  useEffect(() => {
    if (selectedClass && !allowedClassOptions.some((item) => norm(item) === norm(selectedClass))) {
      setSelectedClass('');
      setSelectedSection('');
      setSelectedStudentId('');
      return;
    }
    if (selectedSection && !allowedSectionOptions.some((item) => norm(item) === norm(selectedSection))) {
      setSelectedSection('');
      setSelectedStudentId('');
    }
  }, [selectedClass, selectedSection, allowedClassOptions, allowedSectionOptions]);

  useEffect(() => {
    const fetchAllocations = async () => {
      setLoadingAllocations(true);
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/teacher/dashboard/allocations`, { headers });
        const list = Array.isArray(data) ? data : [];
        const classTeacherOnly = list
          .filter((item) => item?.isClassTeacher === true)
          .map((item) => ({
            className: String(item?.classId?.name || '').trim(),
            sectionName: String(item?.sectionId?.name || '').trim(),
            classId: item?.classId?._id || '',
            sectionId: item?.sectionId?._id || '',
          }))
          .filter((item) => item.className && item.sectionName);
        setClassTeacherAllocations(classTeacherOnly);
      } catch {
        setClassTeacherAllocations([]);
      } finally {
        setLoadingAllocations(false);
      }
    };
    fetchAllocations();
  }, [headers]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedSession || !selectedClass || !selectedSection) {
        setStudents([]);
        return;
      }
      setLoadingStudents(true);
      try {
        const query = new URLSearchParams();
        if (selectedSession) query.set('session', selectedSession);
        if (selectedClass) query.set('className', selectedClass);
        if (selectedSection) query.set('section', selectedSection);

        const { data } = await axios.get(`${API_BASE_URL}/meeting/teacher/students?${query.toString()}`, { headers });
        const allStudents = Array.isArray(data?.students) ? data.students : [];
        const nextStudents = allStudents.filter((student) => {
          const className = String(student?.grade || student?.className || student?.class || '').trim();
          const sectionName = String(student?.section || student?.sectionName || '').trim();
          return allowedPairs.has(`${norm(className)}__${norm(sectionName)}`);
        });
        setStudents(nextStudents);
        if (!selectedSession && data?.activeSession) {
          setSelectedSession(data.activeSession);
        }
      } catch {
        setStudents([]);
      } finally {
        setLoadingStudents(false);
      }
    };
    if (!loadingAllocations) {
      fetchStudents();
    }
  }, [headers, selectedSession, selectedClass, selectedSection, allowedPairs, loadingAllocations]);

  useEffect(() => {
    const fetchActiveSession = async () => {
      if (loadingAllocations) return;
      try {
        const [activeYearRes, studentsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/academic/active-year`, { headers }),
          axios.get(`${API_BASE_URL}/meeting/teacher/students`, { headers }),
        ]);
        const activeSessionName =
          String(
            activeYearRes?.data?.name ||
            activeYearRes?.data?.academicYear ||
            activeYearRes?.data?.activeYear ||
            studentsRes?.data?.activeSession ||
            ''
          ).trim();
        const nextOptions = activeSessionName ? [activeSessionName] : [];
        setSessionOptions(nextOptions);
        if (activeSessionName) {
          setSelectedSession(activeSessionName);
        } else {
          setSelectedSession('');
        }
      } catch {
        setSessionOptions([]);
        setSelectedSession('');
      }
    };
    fetchActiveSession();
  }, [headers, loadingAllocations]);

  useEffect(() => {
    const fetchAchievements = async () => {
      setLoadingAchievements(true);
      try {
        const query = new URLSearchParams();
        if (selectedSession) query.set('session', selectedSession);
        if (selectedClass) query.set('className', selectedClass);
        if (selectedSection) query.set('section', selectedSection);
        if (selectedStudentId) query.set('studentId', selectedStudentId);
        const { data } = await axios.get(`${API_BASE_URL}/achievements/teacher/list?${query.toString()}`, { headers });
        setAchievements(Array.isArray(data?.achievements) ? data.achievements : []);
      } catch {
        setAchievements([]);
      } finally {
        setLoadingAchievements(false);
      }
    };
    fetchAchievements();
  }, [headers, selectedSession, selectedClass, selectedSection, selectedStudentId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSession || !selectedClass || !selectedSection || !selectedStudentId) {
      toast.error('Please select session, class, section and student.');
      return;
    }
    if (!title.trim() || !achievementDate) {
      toast.error('Title and achievement date are required.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/achievements/teacher/upload`,
        {
          studentId: selectedStudentId,
          title: title.trim(),
          date: achievementDate,
          description: description.trim(),
        },
        { headers }
      );
      toast.success(data?.message || 'Achievement uploaded.');
      setTitle('');
      setAchievementDate('');
      setDescription('');
      setSelectedStudentId('');
      const query = new URLSearchParams();
      query.set('session', selectedSession);
      query.set('className', selectedClass);
      query.set('section', selectedSection);
      const listRes = await axios.get(`${API_BASE_URL}/achievements/teacher/list?${query.toString()}`, { headers });
      setAchievements(Array.isArray(listRes?.data?.achievements) ? listRes.data.achievements : []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload achievement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAchievement = async (item) => {
    if (!item?.studentId || !item?.achievementId) return;
    const confirmed = window.confirm('Delete this achievement?');
    if (!confirmed) return;
    setDeletingAchievementId(String(item.achievementId));
    try {
      const { data } = await axios.delete(
        `${API_BASE_URL}/achievements/teacher/${item.studentId}/${item.achievementId}`,
        { headers }
      );
      toast.success(data?.message || 'Achievement deleted.');
      setAchievements((prev) =>
        prev.filter((row) => String(row.achievementId) !== String(item.achievementId))
      );
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete achievement');
    } finally {
      setDeletingAchievementId('');
    }
  };

  const openEdit = (item) => {
    setEditingRow(item);
    setEditForm({
      title: item?.title || '',
      date: item?.date ? new Date(item.date).toISOString().slice(0, 10) : '',
      description: item?.description || '',
    });
  };

  const handleUpdateAchievement = async (e) => {
    e.preventDefault();
    if (!editingRow?.studentId || !editingRow?.achievementId) return;
    if (!editForm.title.trim() || !editForm.date) {
      toast.error('Title and date are required.');
      return;
    }

    setUpdatingAchievementId(String(editingRow.achievementId));
    try {
      const { data } = await axios.put(
        `${API_BASE_URL}/achievements/teacher/${editingRow.studentId}/${editingRow.achievementId}`,
        {
          title: editForm.title.trim(),
          date: editForm.date,
          description: editForm.description.trim(),
        },
        { headers }
      );
      toast.success(data?.message || 'Achievement updated.');
      setAchievements((prev) =>
        prev.map((row) =>
          String(row.achievementId) === String(editingRow.achievementId)
            ? {
                ...row,
                title: editForm.title.trim(),
                date: editForm.date,
                description: editForm.description.trim(),
              }
            : row
        )
      );
      setEditingRow(null);
      setEditForm({ title: '', date: '', description: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update achievement');
    } finally {
      setUpdatingAchievementId('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {editingRow && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Edit Achievement</h3>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleUpdateAchievement} className="p-5 space-y-3">
              <Field label="Title">
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  className={inp}
                  required
                />
              </Field>
              <Field label="Achievement Date">
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                  className={inp}
                  required
                />
              </Field>
              <Field label="Achievement Details">
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className={`${inp} resize-none`}
                />
              </Field>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={String(updatingAchievementId) === String(editingRow.achievementId)}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-60"
                >
                  {String(updatingAchievementId) === String(editingRow.achievementId) ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="bg-linear-to-r from-yellow-400 via-amber-400 to-orange-400 px-6 py-7 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl"><Award className="w-6 h-6" /></div>
            Student Achievements Upload
          </h1>
          <p className="text-yellow-100 text-sm mt-1">Bulk-style workflow: select scope, choose a student, then upload achievement details.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Step 1: Select Scope</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <Field label="Session">
                <select
                  value={selectedSession}
                  onChange={(e) => { setSelectedSession(e.target.value); setSelectedClass(''); setSelectedSection(''); setSelectedStudentId(''); }}
                  className={inp}
                  disabled
                >
                  <option value="">Select session</option>
                  {sessionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Class">
                <select
                  value={selectedClass}
                  onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection(''); setSelectedStudentId(''); }}
                  className={inp}
                  disabled={!selectedSession}
                >
                  <option value="">Select class</option>
                  {allowedClassOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Section">
                <select
                  value={selectedSection}
                  onChange={(e) => { setSelectedSection(e.target.value); setSelectedStudentId(''); }}
                  className={inp}
                  disabled={!selectedClass}
                >
                  <option value="">Select section</option>
                  {allowedSectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            {!loadingAllocations && classTeacherAllocations.length === 0 && (
              <p className="mt-3 text-xs text-red-500">
                No class-teacher allocation found. You can manage achievements only for your allocated class and section.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden m-5">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wide">
              Step 2: Students in Selected Class/Section
            </div>

            {!selectedSession || !selectedClass || !selectedSection ? (
              <div className="p-6 text-sm text-slate-500">Select session, class and section to load students.</div>
            ) : loadingStudents ? (
              <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading students...
              </div>
            ) : students.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No students found for selected scope.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-slate-200">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Select</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Section</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((student) => {
                      const isSelected = String(selectedStudentId) === String(student._id);
                      return (
                        <tr
                          key={student._id}
                          className={isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/70'}
                        >
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedStudentId((prev) =>
                                  String(prev) === String(student._id) ? '' : student._id
                                )
                              }
                              className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'
                              }`}
                              aria-label={`Select ${student.name}`}
                            >
                              {isSelected && <UserCheck size={11} />}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">{formatStudentDisplay(student)}</td>
                          <td className="px-4 py-3 text-slate-600">{student.grade || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{student.section || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="px-5 pb-5">
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Step 3: Achievement Details</p>
              {selectedStudent && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  Selected Student: <span className="font-semibold">{selectedStudent.name}</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Title">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inp}
                    placeholder="Achievement title"
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
              <Field label="Achievement Details">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={`${inp} resize-none`}
                  placeholder="Write achievement details..."
                />
              </Field>
              <button
                type="submit"
                disabled={submitting || !selectedStudentId}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-60"
              >
                {submitting ? 'Uploading...' : 'Upload Achievement'}
              </button>
            </div>
          </form>

          <div className="px-5 pb-5">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wide">
                Uploaded Achievements
              </div>
              {loadingAchievements ? (
                <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Loading achievements...
                </div>
              ) : achievements.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">No uploaded achievements for selected scope.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white border-b border-slate-200">
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Title</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Details</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {achievements.map((item) => (
                        <tr key={`${item.studentId}-${item.achievementId}`} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-medium text-slate-800">{item.studentName || '-'}</td>
                          <td className="px-4 py-3 text-slate-700">{item.title || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-[360px]">
                            <p className="line-clamp-2">{item.description || '-'}</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(item)}
                                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100"
                              >
                                <Edit3 size={12} />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAchievement(item)}
                                disabled={String(deletingAchievementId) === String(item.achievementId)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherAchievements;
