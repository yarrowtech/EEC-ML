import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { AUTH_NOTICE, logoutAndRedirect } from '../utils/authSession';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  Edit2,
  GraduationCap, Loader2, Save, X, FileUp, Lock, Download,
  Edit,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const overviewCache = new Map();
const OVERVIEW_CACHE_TTL = 60_000;
const OVERVIEW_CACHE_LIMIT = 24;
const emptyOverview = { classSectionLabel: '', subjectOptions: [], exams: [], results: [] };

const readOverview = (key) => {
  const cached = overviewCache.get(key);
  return cached?.expiresAt > Date.now() ? cached.data : undefined;
};

const cacheOverview = (key, data) => {
  overviewCache.delete(key);
  if (overviewCache.size >= OVERVIEW_CACHE_LIMIT) overviewCache.delete(overviewCache.keys().next().value);
  overviewCache.set(key, { data, expiresAt: Date.now() + OVERVIEW_CACHE_TTL });
};

const RESULT_STATUS_OPTIONS = ['pass', 'fail', 'absent'];
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
  completed: 'bg-emerald-600 text-white',
  ongoing:   'bg-blue-600 text-white',
  cancelled: 'bg-red-600 text-white',
  scheduled: 'bg-amber-600 text-white',
};
const RESULT_BADGE = {
  pass:   'bg-emerald-600 text-white',
  fail:   'bg-red-600 text-white',
  absent: 'bg-slate-600 text-white',
};

// ── UI primitives ──────────────────────────────────────────────
const IC = 'w-full rounded-xl border border-[#e2e8ee] bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition';

const Modal = ({ onClose, title, wide = false, closeDisabled = false, children }) => {
  const titleId = useId();
  return createPortal(
    <Motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && !closeDisabled && onClose()}
    >
      <Motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${wide ? 'max-w-6xl' : 'max-w-lg'} rounded-2xl bg-white shadow-2xl overflow-hidden`}
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <div className="flex items-center justify-between border-b border-[#e2e8ee] px-5 py-4">
          <h2 id={titleId} className="font-semibold text-slate-800">{title}</h2>
          <button type="button" aria-label="Close dialog" disabled={closeDisabled} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition disabled:opacity-50">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </Motion.div>
    </Motion.div>,
    document.body,
  );
};

// ── Main Component ─────────────────────────────────────────────
const ExamResultPortal = () => {
  const { classId: classSlug } = useParams();
  const { state } = useLocation();
  const classId = String(state?.classMongoId || '');
  const sectionId = String(state?.sectionMongoId || '');
  const subjectName = String(useOutletContext()?.subjectName || '').trim();
  const token = localStorage.getItem('token');
  const cacheKey = JSON.stringify([token, classSlug, classId, sectionId, subjectName]);

  return (
    <ClassExamResults
      key={cacheKey}
      cacheKey={cacheKey}
      token={token}
      classSlug={classSlug}
      classId={classId}
      sectionId={sectionId}
      subjectName={subjectName}
    />
  );
};

const ClassExamResults = ({ classSlug, classId, sectionId, subjectName, cacheKey, token }) => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(() => token ? readOverview(cacheKey) : undefined);
  const { classSectionLabel, subjectOptions, exams, results } = overview || emptyOverview;
  const subjectLabel = subjectName || subjectOptions.map(subject => subject.name).join(', ');
  const [loading, setLoading] = useState(Boolean(token));
  const overviewRequest = useRef(null);
  const overviewActive = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Subject-wise marks entry (grid) + Excel bulk upload
  const [marksExam, setMarksExam] = useState(null);
  const [marksRows, setMarksRows] = useState([]);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);
  const maxMarks = Number(marksExam?.marks ?? 100);
  const emptyMarksCount = marksRows.filter(r => r.included && r.marks === '' && r.status !== 'absent').length;
  const [uploadExam, setUploadExam] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState([]);

  // ── API helper ─────────────────────────────────────────────
  const apiFetch = useCallback(async (path, opts = {}) => {
    const h = { Authorization: `Bearer ${token}`, ...(opts.headers || {}) };
    if (!(opts.body instanceof FormData)) h['Content-Type'] = 'application/json';
    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: h });
    // 403 here is a scope error (e.g. not allocated for an exam's subject),
    // not an expired session — surface it instead of logging out.
    if (res.status === 401) {
      overviewCache.clear();
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
    if (!overviewActive.current) return;
    if (!token) { setLoading(false); return; }
    overviewRequest.current?.abort();
    const request = new AbortController();
    overviewRequest.current = request;
    setLoading(true);
    setError('');
    try {
      const options = { signal: request.signal };
      const [allocData, examData, resData] = await Promise.all([
        apiFetch('/api/teacher/dashboard/allocations', options),
        apiFetch('/api/exam/teacher/manage?includeStudentCounts=true', options),
        apiFetch('/api/exam/results?teacherOverview=true', options),
      ]);
      if (request.signal.aborted) return;
      const allocs = Array.isArray(allocData) ? allocData : [];
      const routeAllocations = allocs.filter(it => slugOf(it) === classSlug);
      const candidates = classSlug === 'current' ? allocs : routeAllocations;
      const matchAlloc = candidates.find(it =>
        classId && sectionId && String(it.classId?._id) === classId && String(it.sectionId?._id) === sectionId
      ) || routeAllocations[0];

      const cid = String(matchAlloc?.classId?._id || '');
      const sid = String(matchAlloc?.sectionId?._id || '');
      const sectionName = matchAlloc?.sectionId?.name || '';
      const label = cid && sid ? `Class ${matchAlloc.classId.name} · Section ${sectionName}` : '';

      // Subjects for this class + section
      const seen = new Set();
      const subjs = allocs
        .filter(it => cid && sid && String(it?.classId?._id) === cid && String(it?.sectionId?._id) === sid)
        .reduce((acc, it) => {
          const id = String(it?.subjectId?._id || '');
          const name = String(it?.subjectId?.name || '');
          if (id && name && (!subjectName || name.trim() === subjectName) && !seen.has(id)) {
            seen.add(id);
            acc.push({ _id: id, name });
          }
          return acc;
        }, [])
        .sort((a, b) => a.name.localeCompare(b.name));

      // Only exams of this class + section for subjects allocated to this teacher
      const subjectIdSet = new Set(subjs.map(s => s._id));
      const allExams = Array.isArray(examData) ? examData : [];
      const myExams = allExams.filter(ex =>
        String(ex?.classId?._id || ex?.classId) === cid
        && (ex.sectionId
          ? String(ex.sectionId._id || ex.sectionId) === sid
          : sectionName && String(ex.section || '').trim().toLowerCase() === sectionName.trim().toLowerCase())
        && subjectIdSet.has(String(ex?.subjectId?._id || ex?.subjectId || '')));

      const resArr = Array.isArray(resData) ? resData : [];
      const examIdSet = new Set(myExams.map(ex => String(ex._id)));
      const data = {
        classSectionLabel: label,
        subjectOptions: subjs,
        exams: myExams,
        results: resArr.filter(r => examIdSet.has(String(r.examId?._id || r.examId))),
      };
      cacheOverview(cacheKey, data);
      setOverview(data);
    } catch (err) {
      if (!request.signal.aborted) setError(err.message || 'Failed to load data');
    } finally {
      if (overviewRequest.current === request && !request.signal.aborted) {
        overviewRequest.current = null;
        setLoading(false);
      }
    }
  }, [apiFetch, cacheKey, classId, classSlug, sectionId, subjectName, token]);

  useEffect(() => {
    overviewActive.current = true;
    loadAll();
    return () => {
      overviewActive.current = false;
      overviewRequest.current?.abort();
    };
  }, [loadAll]);

  const invalidateOverview = () => {
    overviewRequest.current?.abort();
    overviewCache.clear();
  };

  // Auto-clear success after 3 s
  useEffect(() => {
    if (!success) return undefined;
    const t = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [success]);

  // ── Derived ───────────────────────────────────────────────
  const resultStatsByExam = useMemo(() => {
    const statsByExam = new Map();
    results.forEach(r => {
      const id = String(r.examId?._id || r.examId || '');
      const stats = statsByExam.get(id) || { resultCount: 0, publishedCount: 0, passCount: 0 };
      stats.resultCount += 1;
      if (r.published === true) stats.publishedCount += 1;
      if (String(r.status).toLowerCase() === 'pass') stats.passCount += 1;
      statsByExam.set(id, stats);
    });
    return statsByExam;
  }, [results]);

  const subjectGroups = useMemo(() =>
    subjectOptions.map(s => ({
      ...s,
      exams: exams
        .filter(ex => String(ex?.subjectId?._id || ex?.subjectId || '') === s._id)
        .map(ex => ({ ...ex, ...resultStatsByExam.get(String(ex._id)) })),
    })),
  [subjectOptions, exams, resultStatsByExam]);

  // ── Marks entry (whole class grid for one completed exam) ──
  const openMarksEntry = async (exam) => {
    setMarksExam(exam); setMarksRows([]); setLoadingMarks(true); setError('');
    try {
      const d = await apiFetch(`/api/exam/results/exam-students?examId=${encodeURIComponent(exam._id)}`);
      const students = Array.isArray(d?.students) ? d.students : [];
      setMarksRows(students.map(s => ({
        studentId: String(s._id), name: s.name, roll: s.roll, studentCode: s.studentCode,
        marks: s.status === 'absent' ? '' : s.marks ?? '', grade: s.gradeValue || '',
        status: s.status || '', remarks: s.remarks || '',
        included: !s.published, changed: false, published: s.published,
      })));
    } catch (err) {
      setError(err.message || 'Failed to load students');
    } finally { setLoadingMarks(false); }
  };

  const updateMarksRow = (studentId, patch) => {
    setMarksRows(rows => rows.map(r => (r.studentId === studentId ? { ...r, changed: true, ...patch } : r)));
  };

  const marksFields = (marks) => ({
    marks,
    grade: marks === '' ? '' : gradeFrom(marks, maxMarks),
    status: marks === '' ? '' : Number(marks) >= maxMarks * 0.5 ? 'pass' : 'fail',
  });

  const autoFillMarks = () => {
    setMarksRows(rows => rows.map(r =>
      r.included && r.marks === '' && r.status !== 'absent'
        ? { ...r, ...marksFields(String(maxMarks)), changed: true }
        : r
    ));
  };

  const handleSaveMarks = async () => {
    if (!marksExam) return;
    const toSave = marksRows.filter(r => !r.published && r.included && r.changed && (r.status === 'absent' || r.marks !== '' || r.status));
    if (!toSave.length) { setError('Enter marks or select Absent for at least one student'); return; }
    const invalid = toSave.find(r => r.status !== 'absent'
      && (r.marks === '' || !Number.isFinite(Number(r.marks)) || Number(r.marks) < 0 || Number(r.marks) > maxMarks));
    if (invalid) { setError(`Enter marks between 0 and ${maxMarks} for ${invalid.name}`); return; }

    invalidateOverview();
    setSavingMarks(true); setError(''); setSuccess('');
    const outcomes = await Promise.allSettled(toSave.map(r => {
      const payload = { examId: marksExam._id, studentId: r.studentId, status: r.status, remarks: r.remarks.trim(), grade: r.grade };
      if (r.status !== 'absent') {
        payload.marks = Number(r.marks);
      }
      return apiFetch('/api/exam/results', { method: 'POST', body: JSON.stringify(payload) });
    }));
    const failed = outcomes.filter(o => o.status === 'rejected');
    setSavingMarks(false);
    if (failed.length) {
      const savedIds = new Set(toSave.filter((_, i) => outcomes[i].status === 'fulfilled').map(r => r.studentId));
      setMarksRows(rows => rows.map(r => savedIds.has(r.studentId) ? { ...r, changed: false } : r));
      setError(`${toSave.length - failed.length} saved, ${failed.length} failed: ${failed[0].reason?.message || 'error'}`);
    } else {
      setSuccess(`Marks saved for ${toSave.length} student${toSave.length !== 1 ? 's' : ''}`);
      setMarksExam(null);
      await loadAll();
    }
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
    invalidateOverview();
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

  // ── Render ────────────────────────────────────────────────
  return (
    <div
      className="mx-auto w-full rounded-[2rem] border border-[#e2e8ee] bg-white p-4 text-black shadow-[0_4px_20px_rgba(0,20,30,0.05)] transition-shadow hover:shadow-[0_8px_32px_rgba(0,20,30,0.07)] sm:p-6"
    >

      {/* ── Page header ─────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3">
        {/* <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-[#e2e8ee] bg-[#f0f4f8]">
          <GraduationCap className="h-5 w-5 text-indigo-500" />
        </div> */}
        <div>
          <h1 className="text-xl font-semibold text-slate-950">Exam Results</h1>
          {classSectionLabel && (
            <p className="mt-0.5 text-sm text-slate-600">
              {classSectionLabel}{subjectLabel && ` · ${subjectLabel}`}
            </p>
          )}
        </div>
      </div>

      {/* Banners */}
      <AnimatePresence>
        {error && !marksExam && (
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

      {loading && !overview ? (
        <div role="status" className="overflow-hidden rounded-xl border border-slate-200">
          <span className="sr-only">Loading exams and results</span>
          <div aria-hidden="true" className="motion-safe:animate-pulse">
            <div className="h-10 bg-slate-100" />
            {[1, 2, 3, 4].map(row => (
              <div key={row} className="grid grid-cols-[2fr_1fr_1fr] items-center gap-3 border-t border-slate-100 px-3 py-4 sm:grid-cols-[2fr_repeat(4,1fr)_1.5fr]">
                <div className="space-y-2">
                  <div className="h-3 w-4/5 rounded bg-slate-200" />
                  <div className="h-2 w-3/5 rounded bg-slate-100" />
                </div>
                {[1, 2, 3, 4].map(column => (
                  <div key={column} className="hidden h-3 w-4/5 rounded bg-slate-100 sm:block" />
                ))}
                <div className="h-6 w-3/4 rounded-full bg-slate-100 sm:hidden" />
                <div className="h-7 rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      ) : subjectGroups.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          {subjectName
            ? `${subjectName} is no longer allocated to you for this class and section.`
            : 'No subjects are allocated to you for this class and section.'}
        </p>
      ) : exams.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No exams yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table aria-label="Marks entry exams" className="w-full min-w-[36rem] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-2.5 py-2">Exam</th>
                <th scope="col" className="px-2.5 py-2">Exam status</th>
                <th scope="col" className="px-2.5 py-2 text-right">Marked students</th>
                <th scope="col" className="px-2.5 py-2 text-right">Pass rate</th>
                <th scope="col" className="px-2.5 py-2">Result status</th>
                <th scope="col" className="px-2.5 py-2">Actions</th>
              </tr>
            </thead>
            {subjectGroups.filter(sg => sg.exams.length > 0).map(sg => (
              <tbody key={sg._id} className="divide-y divide-slate-100 border-b border-slate-100 last:border-b-0">
                {sg.exams.map(ex => {
                  const st = examStatus(ex);
                  const isDone = st === 'completed';
                  const marked = ex.resultCount ?? 0;
                  const passRate = marked ? `${Math.round((ex.passCount / marked) * 100)}%` : '—';
                  const published = ex.publishedCount ?? 0;
                  const resultsLocked = published > 0 && published === marked;
                  const publicationStatus = published === 0 ? 'Unpublished'
                    : resultsLocked ? 'Published'
                    : `${published} of ${marked} published`;
                  return (
                    <tr key={ex._id} className="align-middle hover:bg-slate-50">
                      <th scope="row" className="px-2.5 py-3 text-slate-800">
                        <div className="font-semibold">{ex.title}</div>
                        <div className="mt-1 font-normal text-slate-600">
                          {[ex.term, ex.date && fDate(ex.date), ex.marks != null && `${ex.marks} marks`].filter(Boolean).join(' · ')}
                        </div>
                      </th>
                      <td className="px-2.5 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 font-medium capitalize ${EXAM_BADGE[st] || EXAM_BADGE.scheduled}`}>{st}</span>
                      </td>
                      <td className="px-2.5 py-3 text-center font-medium tabular-nums text-slate-800">{marked}/{ex.rosterCount ?? ex.noOfStudents ?? '—'}</td>
                      <td className="px-2.5 py-3 text-right font-medium tabular-nums text-slate-800">{passRate}</td>
                      <td className="px-2.5 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${published > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-slate-100'}`}>
                          {publicationStatus}
                        </span>
                      </td>
                      <td className="px-2.5 py-3">
                        {resultsLocked ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600" title="An admin must unpublish results before they can be edited">
                            <Lock size={12} aria-hidden="true" /> Locked
                          </span>
                        ) : isDone ? (
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <button type="button" onClick={() => openMarksEntry(ex)} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition">
                              <Edit size={12} /> {marked ? 'Edit' : 'Enter Marks'}
                            </button>
                            {marked === 0 && (
                              <button type="button" onClick={() => { setUploadExam(ex); setUploadFile(null); setUploadErrors([]); }} className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition">
                                <FileUp size={12} /> Bulk
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500" title="Marks can be entered once the exam is completed">
                            <Lock size={12} /> Locked until completed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}

      <AnimatePresence>
        {marksExam && (
          <Modal
            key="marks-entry"
            title="Enter Marks"
            wide
            closeDisabled={loadingMarks || savingMarks}
            onClose={() => { setMarksExam(null); loadAll(); }}
          >
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                {[classSectionLabel, marksExam.subjectId?.name || marksExam.subject, marksExam.title].filter(Boolean).join(' · ')}
              </p>
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
              <fieldset disabled={loadingMarks || savingMarks} className="min-w-0 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">Students ({marksRows.length})</h3>
                  <button
                    type="button"
                    onClick={autoFillMarks}
                    disabled={!emptyMarksCount}
                    title={`Fill blank marks with ${maxMarks} for selected students`}
                    className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    Auto Fill ({emptyMarksCount})
                  </button>
                </div>
                {loadingMarks ? (
                  <p role="status" className="flex items-center gap-2 px-4 py-6 text-sm text-slate-600">
                    <Loader2 size={16} className="animate-spin" /> Loading students…
                  </p>
                ) : marksRows.length === 0 ? (
                  !error && <p className="px-4 py-6 text-sm text-slate-600">No students found for this exam.</p>
                ) : (
                  <div className="max-h-[50vh] overflow-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="sticky top-0 bg-slate-100 text-xs text-slate-600">
                        <tr>
                          <th scope="col" className="p-3">
                            <input
                              type="checkbox"
                              aria-label="Include all students"
                              checked={marksRows.some(r => !r.published) && marksRows.every(r => r.published || r.included)}
                              disabled={marksRows.every(r => r.published)}
                              onChange={e => {
                                const included = e.target.checked;
                                setMarksRows(rows => rows.map(r => r.published ? r : { ...r, included }));
                              }}
                              className="accent-indigo-600"
                            />
                          </th>
                          <th scope="col" className="p-3">Roll No.</th>
                          <th scope="col" className="p-3">Student Name</th>
                          <th scope="col" className="p-3">Marks (Out of {maxMarks})</th>
                          <th scope="col" className="p-3">Grade</th>
                          <th scope="col" className="p-3">Status</th>
                          <th scope="col" className="p-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {marksRows.map(r => (
                          <tr key={r.studentId} className="hover:bg-slate-50">
                            <td className="p-3">
                              <input type="checkbox" aria-label={`Include ${r.name}`} checked={r.included} disabled={r.published}
                                onChange={e => updateMarksRow(r.studentId, { included: e.target.checked, changed: r.changed })}
                                className="accent-indigo-600" />
                            </td>
                            <td className="whitespace-nowrap p-3 text-slate-600">{r.roll ?? '—'}</td>
                            <th scope="row" className="whitespace-nowrap p-3 font-semibold text-slate-900">
                              {r.name}{r.published && <Lock size={12} className="ml-1 inline text-slate-500" title="Published and locked" />}
                              {r.studentCode && <div className="text-xs font-normal text-slate-500">{r.studentCode}</div>}
                            </th>
                            <td className="p-3">
                              <input type="number" min="0" max={maxMarks} step="any" aria-label={`Marks for ${r.name}`}
                                disabled={!r.included || r.status === 'absent'} value={r.marks}
                                onChange={e => updateMarksRow(r.studentId, marksFields(e.target.value))}
                                className={`${IC} max-w-24 disabled:bg-slate-100`} />
                            </td>
                            <td className="p-3 font-semibold text-slate-700">{r.grade || '—'}</td>
                            <td className="p-3">
                              <select aria-label={`Status for ${r.name}`} disabled={!r.included} value={r.status}
                                onChange={e => {
                                  const status = e.target.value;
                                  updateMarksRow(r.studentId, status === 'absent' ? { marks: '', grade: '', status } : { status });
                                }}
                                className={`${IC} min-w-24 capitalize ${RESULT_BADGE[r.status] || ''}`}>
                                <option value="" disabled>Select</option>
                                {RESULT_STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                              </select>
                            </td>
                            <td className="p-3">
                              <input aria-label={`Remarks for ${r.name}`} value={r.remarks} disabled={!r.included}
                                onChange={e => updateMarksRow(r.studentId, { remarks: e.target.value })}
                                className={`${IC} min-w-36 disabled:bg-slate-100`} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </fieldset>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">Auto Fill sets blank marks to {maxMarks} for selected students. Review entries before saving.</p>
                <button type="button" onClick={handleSaveMarks} disabled={loadingMarks || savingMarks || marksRows.every(r => r.published)}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                  <Save size={14} /> {savingMarks ? 'Saving…' : 'Save Marks'}
                </button>
              </div>
            </div>
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

    </div>
  );
};

export default ExamResultPortal;
