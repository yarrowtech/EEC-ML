import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { AUTH_NOTICE, logoutAndRedirect } from '../utils/authSession';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  CalendarDays, CheckCircle2, Clock3, Edit2,
  GraduationCap, Loader2, Save, Search, Trash2, X, Brain, Sparkles, FileUp, Lock, Download,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const TERM_OPTIONS = ['Class Test', 'Unit Test', 'Monthly Test', 'Term 1', 'Term 2', 'Term 3', 'Half Yearly', 'Annual', 'Final'];
const EXAM_STATUS_OPTIONS = ['scheduled', 'ongoing', 'completed', 'cancelled'];
const RESULT_STATUS_OPTIONS = ['pass', 'fail', 'absent'];

const EMPTY_EXAM = {
  title: '', term: 'Class Test', subjectId: '',
  date: '', time: '', marks: '', duration: '',
  status: 'scheduled', instructor: '', venue: '', published: false,
};

const EMPTY_RESULT = {
  examId: '', studentId: '', marks: '', grade: '', status: 'pass', remarks: '',
};

// ── Helpers ────────────────────────────────────────────────────
const fDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const examStatus = (ex) => {
  const s = String(ex?.status || '').toLowerCase();
  if (s) return s;
  if (!ex?.date) return 'scheduled';
  const d = new Date(ex.date); const t = new Date();
  t.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
  if (d < t) return 'completed';
  if (d.getTime() === t.getTime()) return 'ongoing';
  return 'scheduled';
};

const gradeFrom = (marks, maxMarks) => {
  const m = Number(marks); const mm = Number(maxMarks);
  if (!Number.isFinite(m) || !Number.isFinite(mm) || mm <= 0) return '';
  const p = (m / mm) * 100;
  return p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : 'F';
};

const slugOf = (alloc) => {
  const cn = String(alloc?.classId?.name || '').trim();
  const sn = String(alloc?.sectionId?.name || '').trim();
  return `${cn}-${sn}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};

// Full literal class strings for Tailwind JIT
const EXAM_BADGE = {
  completed: 'bg-emerald-100 text-emerald-700',
  ongoing:   'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  scheduled: 'bg-amber-100 text-amber-700',
};
const RESULT_BADGE = {
  pass:   'bg-emerald-100 text-emerald-700',
  fail:   'bg-red-100 text-red-700',
  absent: 'bg-slate-100 text-slate-600',
};

const todayLabel = () =>
  new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

// ── UI primitives ──────────────────────────────────────────────
const IC = 'w-full rounded-xl border border-[#e2e8ee] bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition';

const FL = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
    {children}
  </div>
);

const Card = ({ title, badge, children }) => (
  <div className="mb-5 rounded-2xl border border-[#e2e8ee] bg-[#fafbfc] overflow-hidden">
    <div className="flex items-center gap-3 border-b border-[#e2e8ee] px-4 py-3.5">
      <span className="text-sm font-semibold text-slate-800">{title}</span>
      {badge != null && (
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600">{badge}</span>
      )}
    </div>
    <div className="px-4 py-4">{children}</div>
  </div>
);

const Modal = ({ onClose, title, children }) => (
  <Motion.div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <Motion.div
      className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
      initial={{ scale: 0.95, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.95, opacity: 0, y: 10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <div className="flex items-center justify-between border-b border-[#e2e8ee] px-5 py-4">
        <span className="font-semibold text-slate-800">{title}</span>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
          <X size={16} />
        </button>
      </div>
      <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
    </Motion.div>
  </Motion.div>
);

// ── Main Component ─────────────────────────────────────────────
const ExamResultPortal = () => {
  const { classId: classSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [classMongoId, setClassMongoId] = useState('');
  const [sectionMongoId, setSectionMongoId] = useState('');
  const [subjectOptions, setSubjectOptions] = useState([]);

  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [examForm, setExamForm] = useState(EMPTY_EXAM);
  const [savingExam, setSavingExam] = useState(false);

  // Subject-wise marks entry (grid) + Excel bulk upload
  const [marksExam, setMarksExam] = useState(null);
  const [marksRows, setMarksRows] = useState([]);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);
  const [uploadExam, setUploadExam] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState([]);

  const [search, setSearch] = useState('');

  const [editExam, setEditExam] = useState(null);
  const [editExamForm, setEditExamForm] = useState(EMPTY_EXAM);
  const [editResult, setEditResult] = useState(null);
  const [editResultForm, setEditResultForm] = useState(EMPTY_RESULT);
  const [savingEdit, setSavingEdit] = useState(false);

  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState('');

  // ── API helper ─────────────────────────────────────────────
  const apiFetch = useCallback(async (path, opts = {}) => {
    const h = { Authorization: `Bearer ${token}`, ...(opts.headers || {}) };
    if (!(opts.body instanceof FormData)) h['Content-Type'] = 'application/json';
    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: h });
    // 403 here is a scope error (e.g. not allocated for an exam's subject),
    // not an expired session — surface it instead of logging out.
    if (res.status === 401) {
      logoutAndRedirect({ navigate, notice: AUTH_NOTICE.EXPIRED, clearAllLocalStorage: true });
      const authError = new Error('Session expired');
      authError.code = AUTH_NOTICE.EXPIRED;
      throw authError;
    }
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d?.error || d?.message || 'Request failed');
    return d;
  }, [token, navigate]);

  // ── Load all data ─────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const initCid = location.state?.classMongoId || '';
      const [allocData, examData] = await Promise.all([
        apiFetch('/api/teacher/dashboard/allocations').catch(() => []),
        apiFetch('/api/exam/teacher/manage').catch(() => []),
      ]);
      const allocs = Array.isArray(allocData) ? allocData : [];

      // Resolve class + section MongoDB IDs
      const matchAlloc = initCid
        ? allocs.find(it => String(it?.classId?._id) === initCid)
        : allocs.find(it => slugOf(it) === classSlug);

      const cid = String(matchAlloc?.classId?._id || '');
      const sid = String(matchAlloc?.sectionId?._id || '');
      if (cid) setClassMongoId(cid);
      if (sid) setSectionMongoId(sid);

      // Subjects for this class + section
      const seen = new Set();
      const subjs = allocs
        .filter(it => String(it?.classId?._id) === cid && String(it?.sectionId?._id) === sid)
        .reduce((acc, it) => {
          const id = String(it?.subjectId?._id || '');
          const name = String(it?.subjectId?.name || '');
          if (id && name && !seen.has(id)) { seen.add(id); acc.push({ _id: id, name }); }
          return acc;
        }, [])
        .sort((a, b) => a.name.localeCompare(b.name));
      setSubjectOptions(subjs);

      // Only exams of this class + section for subjects allocated to this teacher
      const subjectIdSet = new Set(subjs.map(s => s._id));
      const allExams = Array.isArray(examData) ? examData : [];
      const myExams = allExams.filter(ex =>
        String(ex?.classId?._id || ex?.classId) === cid
        && (!sid || !ex?.sectionId || String(ex?.sectionId?._id || ex?.sectionId) === sid)
        && subjectIdSet.has(String(ex?.subjectId?._id || ex?.subjectId || '')));
      setExams(myExams);

      // Load results for these exams
      const resData = await apiFetch('/api/exam/results').catch(() => []);
      const resArr = Array.isArray(resData) ? resData : [];
      const examIdSet = new Set(myExams.map(ex => String(ex._id)));
      setResults(resArr.filter(r => examIdSet.has(String(r.examId?._id || r.examId))));
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, classSlug, location.state?.classMongoId, token]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Pre-fill hidden IDs in exam form when resolved
  useEffect(() => {
    setExamForm(prev => ({ ...prev, classId: classMongoId, sectionId: sectionMongoId }));
  }, [classMongoId, sectionMongoId]);

  // Auto-clear success after 3 s
  useEffect(() => {
    if (!success) return undefined;
    const t = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [success]);

  // ── Derived ───────────────────────────────────────────────
  // Assigned subjects → their exams, with how many results are already entered
  const subjectGroups = useMemo(() => {
    const resultCountByExam = new Map();
    results.forEach(r => {
      const id = String(r.examId?._id || r.examId || '');
      resultCountByExam.set(id, (resultCountByExam.get(id) || 0) + 1);
    });
    return subjectOptions.map(s => ({
      ...s,
      exams: exams
        .filter(ex => String(ex?.subjectId?._id || ex?.subjectId || '') === s._id)
        .map(ex => ({ ...ex, resultCount: resultCountByExam.get(String(ex._id)) || 0 })),
    }));
  }, [subjectOptions, exams, results]);

  const visibleExams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter(ex => {
      const text = [ex.title, ex.subject, ex.term, ex.subjectId?.name].filter(Boolean).join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [exams, search]);


  const recentResults = useMemo(() =>
    [...results].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 6),
  [results]);

  const summary = useMemo(() => {
    const total = exams.length;
    const published = exams.filter(ex => ex.published).length;
    const completed = exams.filter(ex => examStatus(ex) === 'completed').length;
    const upcoming = exams.filter(ex => examStatus(ex) === 'scheduled').length;
    const pass = results.filter(r => String(r.status).toLowerCase() === 'pass').length;
    const passRate = results.length ? Math.round((pass / results.length) * 100) : 0;
    return { total, published, completed, upcoming, passRate };
  }, [exams, results]);

  const generateAnalysis = async () => {
    setAiAnalysisLoading(true);
    setAiAnalysisError('');
    setAiAnalysis('');
    try {
      // Build wrong-answer patterns from results grouped by exam
      const examMap = {};
      results.forEach((r) => {
        const examTitle = r.examId?.title || 'Exam';
        const subject = r.examId?.subject || subjectOptions[0]?.name || 'General';
        const max = r.examId?.marks || 100;
        const pct = max > 0 ? Math.round((r.marks / max) * 100) : 0;
        if (String(r.status).toLowerCase() === 'fail' || pct < 50) {
          const key = `${examTitle}|${subject}`;
          if (!examMap[key]) examMap[key] = { topic: examTitle, subject, wrongAnswer: 'Below 50%', count: 0, pct: 0 };
          examMap[key].count += 1;
        }
      });
      const patterns = Object.values(examMap).map((p) => ({
        ...p,
        pct: results.length > 0 ? Math.round((p.count / results.length) * 100) : 0,
      }));
      if (!patterns.length) {
        setAiAnalysis('No failing results to analyse — great performance across all exams!');
        return;
      }
      const subject = subjectOptions[0]?.name || 'General';
      const res = await fetch(`${API_BASE}/api/ai-teacher/misconception-report`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, wrongAnswerPatterns: patterns }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'AI request failed');
      setAiAnalysis(payload.data?.content || '');
    } catch (err) {
      setAiAnalysisError(err.message || 'Failed to generate analysis');
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  const SimpleMarkdown = ({ text }) => {
    if (!text) return null;
    return (
      <div className="space-y-1 text-sm text-gray-700 leading-relaxed">
        {text.split('\n').map((line, i) => {
          if (/^##\s/.test(line)) return <p key={i} className="font-bold text-gray-900 mt-3 first:mt-0">{line.replace(/^##\s/, '')}</p>;
          if (/^\*\*(.+)\*\*/.test(line)) return <p key={i} className="font-semibold text-gray-800">{line.replace(/\*\*/g, '')}</p>;
          if (/^[-•]\s/.test(line)) return <p key={i} className="pl-3 before:content-['•'] before:mr-2 before:text-indigo-400">{line.replace(/^[-•]\s/, '').replace(/\*\*/g, '')}</p>;
          if (/^\d+\.\s/.test(line)) return <p key={i} className="pl-3">{line.replace(/\*\*/g, '')}</p>;
          if (!line.trim()) return <div key={i} className="h-1" />;
          return <p key={i}>{line.replace(/\*\*/g, '')}</p>;
        })}
      </div>
    );
  };

  // ── Handlers ──────────────────────────────────────────────
  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!examForm.title.trim()) { setError('Exam title is required'); return; }
    if (!examForm.subjectId) { setError('Subject is required'); return; }
    setSavingExam(true); setError(''); setSuccess('');
    try {
      await apiFetch('/api/exam/teacher/add', {
        method: 'POST',
        body: JSON.stringify({
          title: examForm.title.trim(), term: examForm.term, subjectId: examForm.subjectId,
          date: examForm.date, time: examForm.time,
          marks: examForm.marks === '' ? undefined : Number(examForm.marks),
          duration: examForm.duration === '' ? undefined : Number(examForm.duration),
          status: examForm.status, instructor: examForm.instructor.trim(),
          venue: examForm.venue.trim(), published: examForm.published,
          classId: classMongoId, sectionId: sectionMongoId,
        }),
      });
      setSuccess('Exam created successfully');
      setExamForm({ ...EMPTY_EXAM, classId: classMongoId, sectionId: sectionMongoId });
      await loadAll();
    } catch (err) { setError(err.message || 'Failed to create exam'); }
    finally { setSavingExam(false); }
  };

  // ── Marks entry (whole class grid for one completed exam) ──
  const openMarksEntry = async (exam) => {
    setMarksExam(exam); setMarksRows([]); setLoadingMarks(true); setError('');
    try {
      const d = await apiFetch(`/api/exam/results/exam-students?examId=${encodeURIComponent(exam._id)}`);
      const students = Array.isArray(d?.students) ? d.students : [];
      setMarksRows(students.map(s => ({
        studentId: String(s._id), name: s.name, roll: s.roll,
        marks: s.marks ?? '', status: s.status || '', remarks: '',
        hasResult: s.hasResult, published: s.published,
      })));
    } catch (err) {
      setError(err.message || 'Failed to load students');
      setMarksExam(null);
    } finally { setLoadingMarks(false); }
  };

  const updateMarksRow = (studentId, patch) => {
    setMarksRows(rows => rows.map(r => (r.studentId === studentId ? { ...r, ...patch } : r)));
  };

  const rowStatus = (row, maxMarks) => {
    if (row.status === 'absent') return 'absent';
    if (row.marks === '' || row.marks == null) return '';
    const max = Number(maxMarks) || 100;
    return Number(row.marks) >= max * 0.5 ? 'pass' : 'fail';
  };

  const handleSaveMarks = async () => {
    if (!marksExam) return;
    const max = Number(marksExam.marks);
    const toSave = marksRows.filter(r => r.status === 'absent' || r.marks !== '');
    if (!toSave.length) { setError('Enter marks for at least one student'); return; }
    const invalid = toSave.find(r => r.status !== 'absent'
      && (!Number.isFinite(Number(r.marks)) || Number(r.marks) < 0 || (max > 0 && Number(r.marks) > max)));
    if (invalid) { setError(`Invalid marks for ${invalid.name}${max > 0 ? ` (0–${max})` : ''}`); return; }

    setSavingMarks(true); setError(''); setSuccess('');
    const outcomes = await Promise.allSettled(toSave.map(r => {
      const status = rowStatus(r, max);
      const payload = { examId: marksExam._id, studentId: r.studentId, status, remarks: r.remarks.trim() };
      if (status !== 'absent') {
        payload.marks = Number(r.marks);
        payload.grade = gradeFrom(r.marks, max || 100);
      }
      return apiFetch('/api/exam/results', { method: 'POST', body: JSON.stringify(payload) });
    }));
    const failed = outcomes.filter(o => o.status === 'rejected');
    setSavingMarks(false);
    if (failed.length) {
      setError(`${toSave.length - failed.length} saved, ${failed.length} failed: ${failed[0].reason?.message || 'error'}`);
    } else {
      setSuccess(`Marks saved for ${toSave.length} student${toSave.length !== 1 ? 's' : ''}`);
      setMarksExam(null);
    }
    await loadAll();
  };

  // ── Excel bulk upload (same template/endpoint as admin) ──
  const downloadTemplate = async (exam) => {
    setError('');
    try {
      const d = await apiFetch(`/api/exam/results/exam-students?examId=${encodeURIComponent(exam._id)}`);
      const students = Array.isArray(d?.students) ? d.students : [];
      if (!students.length) { setError('No students found for this exam'); return; }
      const XLSX = await import('xlsx');
      const max = Number(exam.marks) || 100;
      const header = ['studentId', 'examId', 'roll', 'name', 'subject', 'maxMarks', 'marks', 'remarks', 'status'];
      const rows = students.map((s, i) => {
        const r = i + 2;
        return {
          studentId: String(s._id), examId: String(exam._id), roll: s.roll ?? '', name: s.name || '',
          subject: exam.subjectId?.name || exam.subject || '', maxMarks: max,
          marks: s.marks ?? '', remarks: '',
          // blank marks → absent, otherwise pass/fail at 50% (matches the admin template)
          status: { f: `IF(ISBLANK(G${r}),"absent",IF(G${r}>=F${r}*0.5,"pass","fail"))` },
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows, { header });
      ws['!cols'] = [{ hidden: true }, { hidden: true }, { wch: 6 }, { wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 8 }, { wch: 24 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Marks');
      const safe = `${exam.title || 'exam'}_${exam.subjectId?.name || ''}`.replace(/[^a-z0-9]+/gi, '_');
      XLSX.writeFile(wb, `${safe}_marks_template.xlsx`);
    } catch (err) { setError(err.message || 'Could not generate template'); }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) { setError('Choose an Excel file'); return; }
    setUploading(true); setError(''); setSuccess(''); setUploadErrors([]);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      const d = await apiFetch('/api/exam/results/bulk-upload', { method: 'POST', body: fd });
      if (Array.isArray(d?.errors) && d.errors.length) setUploadErrors(d.errors);
      else { setUploadExam(null); setUploadFile(null); }
      setSuccess(d?.message || 'Marks uploaded');
      await loadAll();
    } catch (err) { setError(err.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDeleteExam = async (exam) => {
    if (!window.confirm(`Delete "${exam.title}"? Linked results will also be deleted.`)) return;
    setError(''); setSuccess('');
    try {
      await apiFetch(`/api/exam/teacher/${exam._id}`, { method: 'DELETE' });
      setSuccess('Exam deleted');
      await loadAll();
    } catch (err) { setError(err.message || 'Failed to delete exam'); }
  };

  const handleDeleteResult = async (result) => {
    if (!window.confirm(`Delete result for ${result?.studentId?.name || 'this student'}?`)) return;
    setError(''); setSuccess('');
    try {
      await apiFetch(`/api/exam/results/${result._id}`, { method: 'DELETE' });
      setSuccess('Result deleted');
      await loadAll();
    } catch (err) { setError(err.message || 'Failed to delete result'); }
  };

  const openEditExam = (exam) => {
    setEditExam(exam);
    setEditExamForm({
      title: exam.title || '', term: exam.term || 'Class Test',
      subjectId: exam.subjectId?._id || '', date: exam.date || '',
      time: exam.time || '', marks: exam.marks ?? '', duration: exam.duration ?? '',
      status: exam.status || 'scheduled', instructor: exam.instructor || '',
      venue: exam.venue || '', published: !!exam.published,
    });
  };

  const handleUpdateExam = async (e) => {
    e.preventDefault();
    setSavingEdit(true); setError(''); setSuccess('');
    try {
      await apiFetch(`/api/exam/teacher/${editExam._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editExamForm.title.trim(), term: editExamForm.term,
          subjectId: editExamForm.subjectId, date: editExamForm.date, time: editExamForm.time,
          marks: editExamForm.marks === '' ? undefined : Number(editExamForm.marks),
          duration: editExamForm.duration === '' ? undefined : Number(editExamForm.duration),
          status: editExamForm.status, instructor: editExamForm.instructor.trim(),
          venue: editExamForm.venue.trim(), published: editExamForm.published,
          classId: classMongoId, sectionId: sectionMongoId,
        }),
      });
      setSuccess('Exam updated');
      setEditExam(null);
      await loadAll();
    } catch (err) { setError(err.message || 'Failed to update exam'); }
    finally { setSavingEdit(false); }
  };

  const openEditResult = (result) => {
    setEditResult(result);
    setEditResultForm({
      marks: result.marks ?? '', grade: result.grade || '',
      status: result.status || 'pass', remarks: result.remarks || '',
    });
  };

  const handleUpdateResult = async (e) => {
    e.preventDefault();
    setSavingEdit(true); setError(''); setSuccess('');
    try {
      const payload = { grade: editResultForm.grade, remarks: editResultForm.remarks.trim(), status: editResultForm.status };
      if (editResultForm.status !== 'absent') payload.marks = Number(editResultForm.marks);
      await apiFetch(`/api/exam/results/${editResult._id}`, { method: 'PUT', body: JSON.stringify(payload) });
      setSuccess('Result updated');
      setEditResult(null);
      await loadAll();
    } catch (err) { setError(err.message || 'Failed to update result'); }
    finally { setSavingEdit(false); }
  };

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-400" size={30} />
      </div>
    );
  }

  return (
    <Motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1100px] rounded-[2rem] border border-[#e2e8ee] bg-white p-5 text-black shadow-[0_4px_20px_rgba(0,20,30,0.05)] transition-shadow hover:shadow-[0_8px_32px_rgba(0,20,30,0.07)] sm:p-8"
    >

      {/* ── Page header ─────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-[#e2e8ee] bg-[#f0f4f8]">
            <GraduationCap className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-950">Exam &amp; Results</h1>
            <p className="mt-0.5 text-sm text-slate-500">Create exams, upload results, and track performance.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-500">
          <CalendarDays size={11} className="text-indigo-400" />
          {todayLabel()}
        </span>
      </div>

      {/* Banners */}
      <AnimatePresence>
        {error && (
          <Motion.div key="err" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
          >
            {error}
            <button onClick={() => setError('')} className="ml-3 shrink-0 text-red-400 hover:text-red-600"><X size={13} /></button>
          </Motion.div>
        )}
        {success && (
          <Motion.div key="ok" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700"
          >
            {success}
          </Motion.div>
        )}
      </AnimatePresence>

      {/* ── 1. Create Exam ───────────────────────────────── */}
      <Card title="Create Exam">
        <form onSubmit={handleCreateExam} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <FL label="Title">
              <input className={IC} value={examForm.title} onChange={e => setExamForm(p => ({ ...p, title: e.target.value }))} placeholder="Exam title" required />
            </FL>
            <FL label="Term">
              <select className={IC} value={examForm.term} onChange={e => setExamForm(p => ({ ...p, term: e.target.value }))}>
                {TERM_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FL>
            <FL label="Subject">
              <select className={IC} value={examForm.subjectId} onChange={e => setExamForm(p => ({ ...p, subjectId: e.target.value }))}>
                <option value="">Select subject</option>
                {subjectOptions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </FL>
            <FL label="Date">
              <input type="date" className={IC} value={examForm.date} onChange={e => setExamForm(p => ({ ...p, date: e.target.value }))} />
            </FL>
            <FL label="Time">
              <input type="time" className={IC} value={examForm.time} onChange={e => setExamForm(p => ({ ...p, time: e.target.value }))} />
            </FL>
            <FL label="Max Marks">
              <input type="number" min="0" className={IC} value={examForm.marks} onChange={e => setExamForm(p => ({ ...p, marks: e.target.value }))} placeholder="e.g. 50" />
            </FL>
            <FL label="Status">
              <select className={IC} value={examForm.status} onChange={e => setExamForm(p => ({ ...p, status: e.target.value }))}>
                {EXAM_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FL>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={examForm.published} onChange={e => setExamForm(p => ({ ...p, published: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
              Publish immediately
            </label>
            <button type="submit" disabled={savingExam} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition">
              <Save size={14} />
              {savingExam ? 'Creating…' : 'Create & Notify'}
            </button>
          </div>
        </form>
      </Card>

      {/* ── 2. Subject-wise Marks Entry ──────────────────── */}
      <Card title="Marks Entry — My Subjects" badge={subjectGroups.length}>
        <p className="mb-3 text-xs text-slate-500">
          You can enter marks only for your assigned subjects, and only after the exam status is <span className="font-semibold text-emerald-700">completed</span>.
        </p>
        {subjectGroups.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No subjects are allocated to you for this class.</p>
        ) : (
          <div className="space-y-3">
            {subjectGroups.map(sg => (
              <div key={sg._id} className="rounded-xl border border-[#e2e8ee] bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                  <span className="text-sm font-semibold text-slate-800">{sg.name}</span>
                  <span className="text-[11px] text-slate-400">{sg.exams.length} exam{sg.exams.length !== 1 ? 's' : ''}</span>
                </div>
                {sg.exams.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-400">No exams for this subject yet.</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {sg.exams.map(ex => {
                      const st = examStatus(ex);
                      const isDone = st === 'completed';
                      return (
                        <div key={ex._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm text-slate-800">{ex.title}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${EXAM_BADGE[st] || EXAM_BADGE.scheduled}`}>{st}</span>
                              {ex.resultCount > 0 && (
                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">{ex.resultCount} marked</span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {ex.term}{ex.date ? ` · ${fDate(ex.date)}` : ''}{ex.marks ? ` · ${ex.marks} marks` : ''}
                            </p>
                          </div>
                          {isDone ? (
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button type="button" onClick={() => openMarksEntry(ex)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition">
                                <Edit2 size={12} /> {ex.resultCount ? 'Edit Marks' : 'Enter Marks'}
                              </button>
                              <button type="button" onClick={() => { setUploadExam(ex); setUploadFile(null); setUploadErrors([]); }} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition">
                                <FileUp size={12} /> Bulk Upload
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500" title="Marks can be entered once the exam is completed">
                              <Lock size={12} /> Locked until completed
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── 3. Exams List ────────────────────────────────── */}
      <Card title="Exams" badge={exams.length}>
        <div className="relative mb-4">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${IC} pl-8`} placeholder="Search exam, subject, term…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {visibleExams.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No exams yet. Create one above.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {visibleExams.map(ex => {
              const st = examStatus(ex);
              return (
                <div key={ex._id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-slate-800">{ex.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${EXAM_BADGE[st] || EXAM_BADGE.scheduled}`}>{st}</span>
                      {ex.published && <CheckCircle2 size={12} className="text-emerald-500" />}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                      <span>{ex.subjectId?.name || ex.subject || '—'}</span>
                      <span>·</span>
                      <span>{ex.term}</span>
                      {ex.date && <><span>·</span><CalendarDays size={10} className="inline" /><span>{fDate(ex.date)}</span></>}
                      {ex.time && <><span>·</span><Clock3 size={10} className="inline" /><span>{ex.time}</span></>}
                      {ex.marks && <><span>·</span><span>{ex.marks} marks</span></>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => openEditExam(ex)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition" title="Edit"><Edit2 size={13} /></button>
                    <button type="button" onClick={() => handleDeleteExam(ex)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition" title="Delete"><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── 4. Recent Activity ───────────────────────────── */}
      <Card title="Recent Activity" badge={`${results.length} results`}>
        {recentResults.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No results uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {recentResults.map(r => {
              const st = String(r.status || '').toLowerCase();
              return (
                <div key={r._id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e2e8ee] bg-white px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{r.studentId?.name || 'Student'}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {r.examId?.title || 'Exam'} · Marks: {r.marks ?? '—'} · Grade: {r.grade || '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${RESULT_BADGE[st] || RESULT_BADGE.pass}`}>{st || '—'}</span>
                    <button type="button" onClick={() => openEditResult(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-blue-600 transition" title="Edit"><Edit2 size={12} /></button>
                    <button type="button" onClick={() => handleDeleteResult(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-red-600 transition" title="Delete"><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── 5. Summary ───────────────────────────────────── */}
      <Card title="Summary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total Exams',  value: summary.total,     color: 'text-slate-800' },
            { label: 'Published',    value: summary.published,  color: 'text-emerald-700' },
            { label: 'Completed',    value: summary.completed,  color: 'text-blue-700' },
            { label: 'Pass Rate',    value: `${summary.passRate}%`, color: 'text-indigo-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-[#e2e8ee] bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── 6. AI Post-Exam Analysis ─────────────────────── */}
      <div className="mb-5 rounded-2xl border border-indigo-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Brain size={15} className="text-indigo-600" />
            <span className="text-sm font-semibold text-indigo-900">AI Exam Analysis</span>
          </div>
          <button
            type="button"
            onClick={generateAnalysis}
            disabled={aiAnalysisLoading || !results.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 hover:shadow-lg disabled:opacity-50 transition-all"
          >
            {aiAnalysisLoading
              ? <><Loader2 size={12} className="animate-spin" /> Analysing…</>
              : <><Sparkles size={12} /> Analyse Results</>}
          </button>
        </div>
        <div className="px-4 py-4 bg-[#fafbfc]">
          {!aiAnalysis && !aiAnalysisLoading && !aiAnalysisError && (
            <p className="py-4 text-center text-sm text-slate-400">
              Click "Analyse Results" to get AI insights on misconceptions and re-teaching priorities.
            </p>
          )}
          {aiAnalysisLoading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={28} className="animate-spin text-indigo-400" />
              <p className="text-sm text-slate-500">Identifying misconception patterns…</p>
            </div>
          )}
          {aiAnalysisError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-4 py-2">{aiAnalysisError}</p>
          )}
          {aiAnalysis && <SimpleMarkdown text={aiAnalysis} />}
        </div>
      </div>

      {/* ── Edit Exam Modal ──────────────────────────────── */}
      <AnimatePresence>
        {editExam && (
          <Modal key="edit-exam" onClose={() => setEditExam(null)} title="Edit Exam">
            <form onSubmit={handleUpdateExam} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FL label="Title">
                  <input className={IC} value={editExamForm.title} onChange={e => setEditExamForm(p => ({ ...p, title: e.target.value }))} required />
                </FL>
                <FL label="Term">
                  <select className={IC} value={editExamForm.term} onChange={e => setEditExamForm(p => ({ ...p, term: e.target.value }))}>
                    {TERM_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FL>
                <FL label="Subject">
                  <select className={IC} value={editExamForm.subjectId} onChange={e => setEditExamForm(p => ({ ...p, subjectId: e.target.value }))}>
                    <option value="">Select</option>
                    {subjectOptions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </FL>
                <FL label="Status">
                  <select className={IC} value={editExamForm.status} onChange={e => setEditExamForm(p => ({ ...p, status: e.target.value }))}>
                    {EXAM_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </FL>
                <FL label="Date">
                  <input type="date" className={IC} value={editExamForm.date} onChange={e => setEditExamForm(p => ({ ...p, date: e.target.value }))} />
                </FL>
                <FL label="Time">
                  <input type="time" className={IC} value={editExamForm.time} onChange={e => setEditExamForm(p => ({ ...p, time: e.target.value }))} />
                </FL>
                <FL label="Max Marks">
                  <input type="number" min="0" className={IC} value={editExamForm.marks} onChange={e => setEditExamForm(p => ({ ...p, marks: e.target.value }))} />
                </FL>
                <FL label="Duration (mins)">
                  <input type="number" min="0" className={IC} value={editExamForm.duration} onChange={e => setEditExamForm(p => ({ ...p, duration: e.target.value }))} />
                </FL>
                <FL label="Instructor">
                  <input className={IC} value={editExamForm.instructor} onChange={e => setEditExamForm(p => ({ ...p, instructor: e.target.value }))} />
                </FL>
                <FL label="Venue">
                  <input className={IC} value={editExamForm.venue} onChange={e => setEditExamForm(p => ({ ...p, venue: e.target.value }))} />
                </FL>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={editExamForm.published} onChange={e => setEditExamForm(p => ({ ...p, published: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
                Published
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditExam(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={savingEdit} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition">
                  <Save size={13} />{savingEdit ? 'Saving…' : 'Update Exam'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Marks Entry Modal ────────────────────────────── */}
      <AnimatePresence>
        {marksExam && (
          <Modal key="marks-entry" onClose={() => !savingMarks && setMarksExam(null)}
            title={`Enter Marks — ${marksExam.title} (${marksExam.subjectId?.name || marksExam.subject || ''})`}>
            {loadingMarks ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-400" size={24} /></div>
            ) : marksRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No students found for this exam.</p>
            ) : (
              <>
                <p className="mb-3 text-xs text-slate-500">
                  Max marks: <span className="font-semibold">{marksExam.marks || 100}</span>. Grade and pass/fail are derived automatically. Leave blank to skip a student.
                </p>
                <div className="space-y-1.5">
                  {marksRows.map(r => {
                    const st = rowStatus(r, marksExam.marks);
                    const absent = r.status === 'absent';
                    return (
                      <div key={r.studentId} className="grid grid-cols-[2.5rem_1fr_5rem_auto] items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5">
                        <span className="text-xs text-slate-400">{r.roll ?? '—'}</span>
                        <span className="truncate text-sm text-slate-800" title={r.name}>
                          {r.name}{r.published && <CheckCircle2 size={11} className="ml-1 inline text-emerald-500" title="Published" />}
                        </span>
                        <input type="number" min="0" max={marksExam.marks || undefined} disabled={absent}
                          className={`${IC} px-2 py-1 disabled:bg-slate-100`} value={absent ? '' : r.marks}
                          placeholder={absent ? 'AB' : '—'}
                          onChange={e => updateMarksRow(r.studentId, { marks: e.target.value })} />
                        <div className="flex items-center gap-1.5">
                          <label className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-500">
                            <input type="checkbox" checked={absent} className="accent-slate-600"
                              onChange={e => updateMarksRow(r.studentId, { status: e.target.checked ? 'absent' : '', marks: e.target.checked ? '' : r.marks })} />
                            AB
                          </label>
                          <span className={`w-12 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold capitalize ${st ? RESULT_BADGE[st] : 'text-slate-300'}`}>
                            {st ? (st === 'absent' ? 'absent' : gradeFrom(r.marks, marksExam.marks || 100)) : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setMarksExam(null)} disabled={savingMarks} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={handleSaveMarks} disabled={savingMarks} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition">
                    <Save size={14} /> {savingMarks ? 'Saving…' : 'Save Marks'}
                  </button>
                </div>
              </>
            )}
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Bulk Upload Modal ────────────────────────────── */}
      <AnimatePresence>
        {uploadExam && (
          <Modal key="bulk-upload" onClose={() => !uploading && setUploadExam(null)}
            title={`Bulk Upload — ${uploadExam.title} (${uploadExam.subjectId?.name || uploadExam.subject || ''})`}>
            <form onSubmit={handleBulkUpload} className="space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-500">
                <li>Download the template — it lists every student in this class.</li>
                <li>Fill the <span className="font-semibold">marks</span> column (blank = absent) and optional remarks.</li>
                <li>Upload the filled file.</li>
              </ol>
              <button type="button" onClick={() => downloadTemplate(uploadExam)} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition">
                <Download size={14} /> Download Template
              </button>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e => setUploadFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-violet-700" />
              {uploadErrors.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  {uploadErrors.map((m, i) => <p key={i}>{m}</p>)}
                </div>
              )}
              <div className="flex justify-end">
                <button type="submit" disabled={uploading || !uploadFile} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition">
                  <FileUp size={14} /> {uploading ? 'Uploading…' : 'Upload Marks'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Edit Result Modal ────────────────────────────── */}
      <AnimatePresence>
        {editResult && (
          <Modal key="edit-result" onClose={() => setEditResult(null)} title="Edit Result">
            <form onSubmit={handleUpdateResult} className="space-y-3">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                {editResult.studentId?.name || 'Student'} · {editResult.examId?.title || 'Exam'}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FL label="Marks">
                  <input type="number" min="0" className={IC} value={editResultForm.marks} onChange={e => setEditResultForm(p => ({ ...p, marks: e.target.value }))} disabled={editResultForm.status === 'absent'} />
                </FL>
                <FL label="Grade">
                  <input className={IC} value={editResultForm.grade} onChange={e => setEditResultForm(p => ({ ...p, grade: e.target.value }))} placeholder="A+ / B" />
                </FL>
                <FL label="Status">
                  <select className={IC} value={editResultForm.status} onChange={e => setEditResultForm(p => ({ ...p, status: e.target.value, marks: e.target.value === 'absent' ? '' : p.marks }))}>
                    {RESULT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </FL>
              </div>
              <FL label="Remarks">
                <input className={IC} value={editResultForm.remarks} onChange={e => setEditResultForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Optional" />
              </FL>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditResult(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={savingEdit} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition">
                  <Save size={13} />{savingEdit ? 'Saving…' : 'Update Result'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

    </Motion.div>
  );
};

export default ExamResultPortal;
