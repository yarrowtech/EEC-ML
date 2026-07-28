import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Download, FileSpreadsheet, Plus, Send, Upload, X,
  BookOpen, Edit2, Trash2, Clock, MapPin, User, Calendar,
  RefreshCw, ChevronRight, CheckCircle, XCircle, AlertCircle,
  Loader2, Award, TrendingUp, Eye, EyeOff, FileUp, FileDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { getStoredAdminScope } from '../utils/adminScope';
import { formatStudentDisplay } from '../../utils/studentDisplay';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_URL;

/* ── helpers ── */
const authH = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json',
});

const STATUS_STYLE = {
  pass:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  fail:   'bg-red-50 text-red-600 border border-red-200',
  absent: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const TERM_STYLE = {
  'Term 1':   'bg-blue-50 text-blue-700 border-blue-100',
  'Term 2':   'bg-violet-50 text-violet-700 border-violet-100',
  'Term 3':   'bg-orange-50 text-orange-700 border-orange-100',
  'Final':    'bg-rose-50 text-rose-700 border-rose-100',
  'Annual':   'bg-red-50 text-red-700 border-red-100',
  'Half Yearly':'bg-amber-50 text-amber-700 border-amber-100',
};

const EXAM_STATUS_STYLE = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  scheduled: 'bg-amber-50 text-amber-700 border-amber-100',
};

const inp = 'w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition placeholder:text-slate-400';
const deriveGradeFromPercentage = (percentage) => {
  if (!Number.isFinite(percentage)) return '';
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
};
const normalizeSession = (value = '') => String(value).trim();
const getStudentSession = (student = {}) => normalizeSession(student?.academicYear || student?.session || '');
const getExamClassName = (exam = {}) =>
  String(exam?.classId?.name || exam?.grade || exam?.className || exam?.class || '').trim();
const getExamSectionName = (exam = {}) =>
  String(exam?.sectionId?.name || exam?.section || exam?.sectionName || '').trim();
const deriveRemarkFromMarks = (marks, maxMarks, status = 'pass') => {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  const parsedMarks = Number(marks);
  if (!Number.isFinite(parsedMarks)) return '';
  if (normalizedStatus === 'absent' || parsedMarks <= 0) return 'NOT PROMOTED';
  const parsedMax = Number(maxMarks);
  if (!Number.isFinite(parsedMax) || parsedMax <= 0) return '';
  const percentage = (parsedMarks / parsedMax) * 100;
  return percentage >= 50 ? 'PROMOTED' : 'PROMOTED BUT FAIL';
};

/* ── modal shell ── */
const Modal = ({ show, onClose, title, subtitle, icon: Icon, iconColor = 'bg-indigo-600', children, maxWidth = 'sm:max-w-3xl' }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white w-full ${maxWidth} rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-100`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={`h-9 w-9 rounded-xl ${iconColor} flex items-center justify-center shadow-sm`}>
                <Icon size={16} className="text-white" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">{title}</h3>
              {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

/* ── field label wrapper ── */
const Field = ({ label, children }) => (
  <div>
    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

/* ── stat card ── */
const StatCard = ({ label, value, icon: Icon, bg, text, border }) => (
  <div className={`rounded-2xl border p-4 ${bg} ${border}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${text}`}>{value}</p>
      </div>
      {React.createElement(Icon, { size: 28, className: `${text} opacity-60` })}
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════ */
const Result = ({ setShowAdminHeader }) => {
  useEffect(() => { setShowAdminHeader?.(true); }, [setShowAdminHeader]);

  const [results, setResults]   = useState([]);
  const [exams, setExams]       = useState([]);
  const [examGroups, setExamGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [activeAcademicYearId, setActiveAcademicYearId] = useState('');
  const [activeAcademicYearName, setActiveAcademicYearName] = useState('');

  const [loading, setLoading]           = useState(true);
  const [, setLoadingExams] = useState(false);
  const [, setLoadingExamGroups] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [searchTerm, setSearchTerm]     = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass]   = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [filterSubject, setFilterSubject]   = useState('all');

  const [showAddResult, setShowAddResult]   = useState(false);
  const [showEditResult, setShowEditResult] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const emptyR = { session: '', className: '', sectionName: '', examId: '', studentId: '', marks: '', grade: '', remarks: '', status: 'pass' };
  const [resultForm, setResultForm]       = useState(emptyR);
  const [editResultForm, setEditResultForm] = useState(emptyR);
  const [editingResultId, setEditingResultId] = useState(null);
  const [bulkFile, setBulkFile]             = useState(null);
  const [bulkExamId, setBulkExamId]         = useState('');
  const [expandedExams, setExpandedExams]   = useState(new Set());
  const [examTabState, setExamTabState]     = useState({});   // { [examId]: { cls: 'all', sec: 'all' } }
  const [updatingCompletedExamGroupId, setUpdatingCompletedExamGroupId] = useState('');
  const [addResultMode, setAddResultMode] = useState('single');
  const [bulkEntryForm, setBulkEntryForm] = useState({ session: '', className: '', sectionName: '', examId: '' });
  const [bulkEntryRows, setBulkEntryRows] = useState([]);
  const [bulkEntryLoading, setBulkEntryLoading] = useState(false);
  const [bulkEntrySubmitting, setBulkEntrySubmitting] = useState(false);

  /* ── fetch ── */
  const fetchResults = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/exam/results/admin`, { headers: authH() });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setResults(Array.isArray(d) ? d : []);
    } catch { toast.error('Failed to load results'); setResults([]); }
    finally { setLoading(false); }
  };

  const fetchExams = async () => {
    setLoadingExams(true);
    try {
      const r = await fetch(`${API_BASE}/api/exam/results/exam-options`, { headers: authH() });
      if (r.ok) { const d = await r.json(); setExams(Array.isArray(d) ? d : []); }
    } catch { toast.error('Error fetching exams'); }
    finally { setLoadingExams(false); }
  };

  const fetchExamGroups = async () => {
    setLoadingExamGroups(true);
    try {
      const r = await fetch(`${API_BASE}/api/exam/groups`, { headers: authH() });
      if (r.ok) {
        const d = await r.json();
        setExamGroups(Array.isArray(d) ? d : []);
      } else {
        setExamGroups([]);
      }
    } catch {
      toast.error('Error fetching exam groups');
      setExamGroups([]);
    } finally {
      setLoadingExamGroups(false);
    }
  };

  const fetchAcademicSetup = async () => {
    try {
      const [yearsRes, classesRes, sectionsRes, activeYearRes] = await Promise.all([
        fetch(`${API_BASE}/api/academic/years`, { headers: authH() }),
        fetch(`${API_BASE}/api/academic/classes`, { headers: authH() }),
        fetch(`${API_BASE}/api/academic/sections`, { headers: authH() }),
        fetch(`${API_BASE}/api/academic/active-year`, { headers: authH() }).catch(() => null),
      ]);

      const yearsData = yearsRes.ok ? await yearsRes.json().catch(() => []) : [];
      const classesData = classesRes.ok ? await classesRes.json().catch(() => []) : [];
      const sectionsData = sectionsRes.ok ? await sectionsRes.json().catch(() => []) : [];
      const activeYearData = activeYearRes?.ok ? await activeYearRes.json().catch(() => null) : null;

      const yearItems = Array.isArray(yearsData) ? yearsData : [];
      setAcademicYears(yearItems);
      setClasses(Array.isArray(classesData) ? classesData : []);
      setSections(Array.isArray(sectionsData) ? sectionsData : []);

      const activeFromList = yearItems.find((year) => Boolean(year?.isActive));
      const activeName =
        normalizeSession(
          activeYearData?.name ||
          activeYearData?.academicYear ||
          activeYearData?.activeYear ||
          activeYearData?.data?.name ||
          activeFromList?.name ||
          ''
        );
      const activeId = String(
        activeYearData?._id ||
        activeYearData?.id ||
        activeYearData?.data?._id ||
        activeYearData?.data?.id ||
        activeFromList?._id ||
        activeFromList?.id ||
        ''
      ).trim();

      setActiveAcademicYearName(activeName);
      setActiveAcademicYearId(activeId);
    } catch {
      setAcademicYears([]);
      setClasses([]);
      setSections([]);
      setActiveAcademicYearId('');
      setActiveAcademicYearName('');
    }
  };

  const normalizeClass = (v = '') => { const s = String(v).trim(); const n = s.match(/\d+/); return n ? n[0] : s.replace(/^class\s+/i,'').trim().toLowerCase(); };
  const normSec = (v = '') => String(v).trim().toLowerCase();

  const fetchStudentsByClass = async (forceAll = false) => {
    setLoadingStudents(true);
    try {
      const { schoolId } = getStoredAdminScope();
      const url = new URL(`${API_BASE}/api/admin/users/get-students`);
      if (schoolId) url.searchParams.set('schoolId', schoolId);
      const r = await fetch(url, { headers: authH() });
      if (!r.ok) throw new Error();
      const all = await r.json();
      let filtered = Array.isArray(all) ? all : [];
      if (!forceAll && selectedClass) {
        const nc = normalizeClass(selectedClass); const ns = normSec(selectedSection);
        filtered = filtered.filter(s => normalizeClass(s.grade||s.class||'') === nc && (selectedSection ? normSec(s.section||'') === ns : true));
      }
      const map = new Map(); const seen = new Set();
      filtered.forEach(s => {
        const id = String(s._id||s.id||'');
        const key = `${(s.name||'').toLowerCase()}-${s.roll}-${(s.grade||'').toLowerCase()}`;
        if (id && !seen.has(key)) { map.set(id, s); seen.add(key); }
      });
      setStudents([...map.values()].sort((a,b) => (a.name||'').localeCompare(b.name||'')));
    } catch { toast.error('Failed to fetch students'); setStudents([]); }
    finally { setLoadingStudents(false); }
  };

  useEffect(() => { fetchResults(); fetchExams(); fetchExamGroups(); fetchAcademicSetup(); }, []);
  useEffect(() => { if (selectedClass) fetchStudentsByClass(); }, [selectedClass, selectedSection]);

  const handleTogglePublish = async (id, val) => {
    try {
      const r = await fetch(`${API_BASE}/api/exam/results/${id}/publish`, { method: 'PUT', headers: authH(), body: JSON.stringify({ published: val }) });
      if (!r.ok) throw new Error();
      const d = await r.json();
      toast.success(d.message || `Result ${val ? 'published' : 'unpublished'}`);
      fetchResults();
    } catch { toast.error('Failed to update publish status'); }
  };

  const handlePublishExam = async (examId, publish) => {
    const examResults = results.filter(r => (r.examId?._id || String(r.examId)) === examId);
    const resultIds = examResults.map(r => r._id);
    if (!resultIds.length) return;
    const label = publish ? 'Publish' : 'Unpublish';
    const c = await Swal.fire({ title: `${label} All Results?`, html: `${label} all <strong>${examResults.length}</strong> results for this exam?`, icon: 'question', showCancelButton: true, confirmButtonColor: publish ? '#059669' : '#d97706', confirmButtonText: label });
    if (!c.isConfirmed) return;
    try {
      const r = await fetch(`${API_BASE}/api/exam/results/bulk-publish`, { method: 'PUT', headers: authH(), body: JSON.stringify({ resultIds, published: publish }) });
      if (!r.ok) throw new Error();
      const d = await r.json();
      toast.success(d.message || `Results ${publish ? 'published' : 'unpublished'}`);
      fetchResults();
    } catch { toast.error('Failed to update publish status'); }
  };

  const getCompletedExamGroupSummary = (group) => {
    const groupExamIds = new Set((group?.subjects || []).map((subjectExam) => String(subjectExam?._id || '')));
    const examResults = groupExamIds.size
      ? results.filter(r => groupExamIds.has(String(r.examId?._id || r.examId)))
      : [];
    const publishedCount = examResults.filter((result) => Boolean(result.published)).length;
    const totalCount = examResults.length;
    const fullyPublished = totalCount > 0 && publishedCount === totalCount;
    return { publishedCount, totalCount, fullyPublished, groupExamIds };
  };

  const handleCompletedExamGroupPublish = async (group, publish) => {
    const groupExamIds = new Set((group?.subjects || []).map((subjectExam) => String(subjectExam?._id || '')));
    if (!groupExamIds.size) {
      toast.error('No subject exams found under selected main exam');
      return;
    }
    const examResults = results.filter(r => groupExamIds.has(String(r.examId?._id || r.examId)));
    if (!examResults.length) {
      toast.error('No result entries found for the selected main exam');
      return;
    }
    const resultIds = examResults.map(r => r._id).filter(Boolean);
    if (!resultIds.length) {
      toast.error('No valid result entries found for the selected exam');
      return;
    }
    setUpdatingCompletedExamGroupId(String(group?._id || ''));
    try {
      const r = await fetch(`${API_BASE}/api/exam/results/bulk-publish`, {
        method: 'PUT',
        headers: authH(),
        body: JSON.stringify({ resultIds, published: publish })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Failed to update exam visibility');
      toast.success(d?.message || `Selected exam results ${publish ? 'published' : 'unpublished'}`);
      await fetchResults();
    } catch (err) {
      toast.error(err.message || 'Failed to update exam visibility');
    } finally {
      setUpdatingCompletedExamGroupId('');
    }
  };

  const toggleExamExpand = (examId) => {
    setExpandedExams(prev => { const s = new Set(prev); s.has(examId) ? s.delete(examId) : s.add(examId); return s; });
  };

  /* ── add result ── */
  const handleAddResult = async (e) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API_BASE}/api/exam/results`, { method: 'POST', headers: authH(), body: JSON.stringify(resultForm) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success('Result added'); closeAddResultModal(); fetchResults();
    } catch (err) { toast.error(err.message || 'Failed to add result'); }
  };

  const loadBulkEntryRows = async ({ examId, session, className, sectionName }) => {
    if (!examId || !session || !className || !sectionName) {
      setBulkEntryRows([]);
      return;
    }

    setBulkEntryLoading(true);
    try {
      const selectedExam = exams.find((ex) => String(ex._id) === String(examId));
      const maxMarks = Number(selectedExam?.marks || 100);
      const selectedSession = normalizeSession(session);
      const activeSession = normalizeSession(activeAcademicYearName);
      const scopedStudents = students
        .filter((s) => {
          const studentSession = getStudentSession(s);
          return studentSession === selectedSession || (!studentSession && activeSession && selectedSession === activeSession);
        })
        .filter((s) => normalizeClass(s.grade || s.class || '') === normalizeClass(className))
        .filter((s) => normSec(s.section || '') === normSec(sectionName))
        .sort((a, b) => {
          const ra = Number(a?.roll);
          const rb = Number(b?.roll);
          if (Number.isFinite(ra) && Number.isFinite(rb) && ra !== rb) return ra - rb;
          return String(a?.name || '').localeCompare(String(b?.name || ''));
        });

      if (!scopedStudents.length) {
        setBulkEntryRows([]);
        return;
      }

      const resultsRes = await fetch(`${API_BASE}/api/exam/results?examId=${encodeURIComponent(examId)}`, { headers: authH() });
      const resultList = resultsRes.ok ? await resultsRes.json().catch(() => []) : [];
      const resultByStudentId = new Map(
        (Array.isArray(resultList) ? resultList : [])
          .map((r) => [String(r?.studentId?._id || r?.studentId || ''), r])
          .filter(([id]) => Boolean(id))
      );

      const nextRows = scopedStudents.map((student) => {
        const existing = resultByStudentId.get(String(student._id)) || null;
        const existingMarks = existing?.marks ?? '';
        return {
          studentId: String(student._id),
          name: student.name || '',
          roll: student.roll ?? '',
          studentCode: student.studentCode || '',
          marks: existingMarks,
          status: existing?.status || 'pass',
          grade: existing?.grade || '',
          remarks: existing?.remarks || deriveRemarkFromMarks(existingMarks, maxMarks, existing?.status || 'pass') || '',
        };
      });

      setBulkEntryRows(nextRows);
    } catch (err) {
      console.error('Failed to load bulk entry rows', err);
      toast.error('Failed to load students for bulk result entry');
      setBulkEntryRows([]);
    } finally {
      setBulkEntryLoading(false);
    }
  };

  useEffect(() => {
    if (!showAddResult || addResultMode !== 'bulk') return;
    if (!bulkEntryForm.session || !bulkEntryForm.className || !bulkEntryForm.sectionName || !bulkEntryForm.examId) return;
    if (!students.length || !exams.length) return;
    loadBulkEntryRows(bulkEntryForm);
  }, [
    addResultMode,
    bulkEntryForm.session,
    bulkEntryForm.className,
    bulkEntryForm.sectionName,
    bulkEntryForm.examId,
    exams,
    students,
    showAddResult,
  ]);

  const handleBulkRowMarksChange = (studentId, value) => {
    setBulkEntryRows((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;
        const selectedExam = exams.find((ex) => String(ex._id) === String(bulkEntryForm.examId));
        const maxMarks = Number(selectedExam?.marks || 100);
        const sanitizedValue = String(value ?? '').replace(/[^\d]/g, '');
        if (sanitizedValue === '') {
          return {
            ...row,
            marks: '',
            grade: '',
            remarks: '',
          };
        }
        const parsed = Number(sanitizedValue);
        const clampedMarks = Number.isFinite(parsed) && Number.isFinite(maxMarks) && maxMarks > 0
          ? Math.min(parsed, maxMarks)
          : parsed;
        const percentage = Number.isFinite(parsed) && Number.isFinite(maxMarks) && maxMarks > 0
          ? (clampedMarks / maxMarks) * 100
          : NaN;
        const nextGrade = Number.isFinite(percentage) ? deriveGradeFromPercentage(percentage) : row.grade;
        const nextStatus = row.status === 'absent'
          ? 'absent'
          : Number.isFinite(percentage)
            ? (percentage >= 50 ? 'pass' : 'fail')
            : row.status;
        return {
          ...row,
          marks: String(clampedMarks),
          grade: nextGrade,
          status: nextStatus,
          remarks: deriveRemarkFromMarks(clampedMarks, maxMarks, nextStatus) || '',
        };
      })
    );
  };

  const handleBulkRowStatusChange = (studentId, value) => {
    setBulkEntryRows((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;
        const selectedExam = exams.find((ex) => String(ex._id) === String(bulkEntryForm.examId));
        return {
          ...row,
          status: value,
          remarks: deriveRemarkFromMarks(row.marks, selectedExam?.marks || 100, value) || '',
        };
      })
    );
  };

  const handleBulkResultSubmit = async (e) => {
    e.preventDefault();
    const selectedExam = exams.find((ex) => String(ex._id) === String(bulkEntryForm.examId));
    if (!selectedExam?._id) {
      toast.error('Select an exam');
      return;
    }
    const payloadRows = bulkEntryRows
      .map((row) => {
        const marksText = String(row.marks ?? '').trim();
        if (!marksText) return null;
        const marks = Number(marksText);
        if (!Number.isFinite(marks) || marks < 0) return { error: `Invalid marks for ${row.name || 'student'}` };
        const remarks = deriveRemarkFromMarks(marks, selectedExam?.marks || 100, row.status) || row.remarks || '';
        return {
          examId: selectedExam._id,
          studentId: row.studentId,
          marks,
          grade: row.grade || '',
          remarks,
          status: row.status || 'pass',
        };
      })
      .filter(Boolean);

    const invalidRow = payloadRows.find((item) => item?.error);
    if (invalidRow?.error) {
      toast.error(invalidRow.error);
      return;
    }
    if (!payloadRows.length) {
      toast.error('Enter marks for at least one student');
      return;
    }

    setBulkEntrySubmitting(true);
    try {
      const results = await Promise.allSettled(
        payloadRows.map((body) =>
          fetch(`${API_BASE}/api/exam/results`, {
            method: 'POST',
            headers: authH(),
            body: JSON.stringify(body),
          }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Failed to save result');
            return data;
          })
        )
      );

      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected');

      if (successCount) {
        toast.success(`${successCount} result${successCount > 1 ? 's' : ''} uploaded`);
      }
      if (failed.length) {
        toast.error(`${failed.length} result${failed.length > 1 ? 's' : ''} failed`);
      }

      await fetchResults();
      await loadBulkEntryRows(bulkEntryForm);
    } catch (err) {
      toast.error(err.message || 'Bulk upload failed');
    } finally {
      setBulkEntrySubmitting(false);
    }
  };

  /* ── edit result ── */
  const openEditResult = async (result) => {
    setEditingResultId(result._id);
    setEditResultForm({ 
      session: result.studentId?.academicYear || result.studentId?.session || '', 
      className: result.studentId?.grade || result.studentId?.class || '', 
      sectionName: result.studentId?.section || '', 
      examId: result.examId?._id||result.examId||'', 
      studentId: result.studentId?._id||result.studentId||'', 
      marks: result.marks ?? '', 
      grade: result.grade||'', 
      remarks: result.remarks||'', 
      status: result.status||'pass' 
    });
    await Promise.all([fetchExams(), fetchStudentsByClass(true)]);
    setShowEditResult(true);
  };

  const handleUpdateResult = async (e) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API_BASE}/api/exam/results/${editingResultId}`, { method: 'PUT', headers: authH(), body: JSON.stringify(editResultForm) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success('Result updated'); setShowEditResult(false); setEditingResultId(null); fetchResults();
    } catch (err) { toast.error(err.message || 'Failed to update result'); }
  };

  /* ── delete ── */
  const handleDeleteResult = async (result) => {
    const c = await Swal.fire({ title: 'Delete Result?', html: `Delete result for <strong>${result.studentId?.name || 'this student'}</strong>?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Delete' });
    if (!c.isConfirmed) return;
    try {
      const r = await fetch(`${API_BASE}/api/exam/results/${result._id}`, { method: 'DELETE', headers: authH() });
      if (!r.ok) throw new Error();
      toast.success('Result deleted'); fetchResults();
    } catch { toast.error('Failed to delete result'); }
  };

  /* ── bulk upload ── */
  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkFile) { toast.error('Select an Excel file'); return; }
    const fd = new FormData(); fd.append('file', bulkFile);
    try {
      const r = await fetch(`${API_BASE}/api/exam/results/bulk-upload`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Upload failed');
      Swal.fire({ title: 'Upload Complete!', html: `<strong>${d.count || 0}</strong> results uploaded.${d.errors?.length ? `<br/><div class="text-xs text-red-500 mt-2 text-left">${d.errors.slice(0,5).join('<br/>')}</div>` : ''}`, icon: d.errors?.length ? 'warning' : 'success' });
      setShowBulkUpload(false); setBulkFile(null); fetchResults();
    } catch (err) { toast.error(err.message || 'Failed to upload file'); }
  };

  const downloadExcelTemplate = async () => {
    if (!bulkExamId) {
      toast.error('Please select an exam first to generate its template.');
      return;
    }
    toast.loading('Generating template...');
    try {
      const [studentsRes, examsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/users/get-students`, { headers: authH() }),
        fetch(`${API_BASE}/api/exam/fetch`, { headers: authH() })
      ]);
      if (!studentsRes.ok || !examsRes.ok) throw new Error('Failed to fetch data for template.');

      const allStudents = await studentsRes.json();
      const allExams = await examsRes.json();

      const selectedBulkExam = allExams.find(ex => ex._id === bulkExamId);
      let validStudents = allStudents;
      
      if (selectedBulkExam) {
        const examClass = (selectedBulkExam.classId?.name || selectedBulkExam.grade || '').trim().toLowerCase();
        const examSection = (selectedBulkExam.sectionId?.name || selectedBulkExam.section || '').trim().toLowerCase();
        
        validStudents = allStudents.filter(s => {
           const studentClass = (s.grade || s.class || '').trim().toLowerCase();
           const studentSection = (s.section || '').trim().toLowerCase();
           const matchClass = !examClass || studentClass === examClass;
           const matchSection = !examSection || studentSection === examSection;
           return matchClass && matchSection;
        });
      }

      const wb = XLSX.utils.book_new();

      // Hidden sheet with exam data for VLOOKUP
      const examsDataForSheet = [['Exam ID', 'Max Marks']];
      allExams.forEach(exam => {
        if (exam._id && exam.marks) {
          examsDataForSheet.push([exam._id, exam.marks]);
        }
      });
      const ws_exams = XLSX.utils.aoa_to_sheet(examsDataForSheet);
      XLSX.utils.book_append_sheet(wb, ws_exams, 'ExamsData');
      if (!wb.Workbook) wb.Workbook = {};
      if (!wb.Workbook.Sheets) wb.Workbook.Sheets = [];
      const examSheetIndex = wb.SheetNames.indexOf('ExamsData');
      if (examSheetIndex > -1) {
        if (!wb.Workbook.Sheets[examSheetIndex]) wb.Workbook.Sheets[examSheetIndex] = {};
        wb.Workbook.Sheets[examSheetIndex].Hidden = 1;
      }

      // Group students by class and section
      const studentsByGroup = validStudents.reduce((acc, student) => {
        const className = student.grade || student.class || 'Uncategorized';
        const sectionName = student.section || 'A';
        const key = `${className}-${sectionName}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(student);
        return acc;
      }, {});

      // Create a sheet for each group
      for (const groupKey in studentsByGroup) {
        const studentsInGroup = studentsByGroup[groupKey];
        const safeSheetName = groupKey.replace(/[^a-zA-Z0-9-]/g, '_').slice(0, 31);

        const sheetData = studentsInGroup.map((s, index) => {
          const rowNum = index + 2;
          const gradeFormula = `IF(ISBLANK(I${rowNum}), "", IF(ISERROR(VLOOKUP(G${rowNum},ExamsData!A:B,2,FALSE)), "N/A", IF(VLOOKUP(G${rowNum},ExamsData!A:B,2,FALSE)>0, IF((I${rowNum}/VLOOKUP(G${rowNum},ExamsData!A:B,2,FALSE))>=0.9, "A+", IF((I${rowNum}/VLOOKUP(G${rowNum},ExamsData!A:B,2,FALSE))>=0.8, "A", IF((I${rowNum}/VLOOKUP(G${rowNum},ExamsData!A:B,2,FALSE))>=0.7, "B", IF((I${rowNum}/VLOOKUP(G${rowNum},ExamsData!A:B,2,FALSE))>=0.6, "C", IF((I${rowNum}/VLOOKUP(G${rowNum},ExamsData!A:B,2,FALSE))>=0.5, "D", "F"))))), "N/A")))`;
          const statusFormula = `IF(ISBLANK(I${rowNum}),"absent",IF(ISERROR(VLOOKUP(G${rowNum},ExamsData!A:B,2,FALSE)),"pass",IF(I${rowNum}>=(VLOOKUP(G${rowNum},ExamsData!A:B,2,FALSE)*0.5),"pass","fail")))`;
          const remarksFormula = `IF(L${rowNum}="pass","Promoted",IF(L${rowNum}="fail","Not Promoted",""))`;

          return {
            studentId: s._id,
            session: s.academicYear || s.session || '',
            roll: s.roll || '',
            class: s.grade || s.class || '',
            section: s.section || '',
            name: s.name,
            examId: selectedBulkExam ? selectedBulkExam._id : '',
            subject: selectedBulkExam ? selectedBulkExam.subject : '',
            marks: '',
            grade: { f: gradeFormula },
            remarks: { f: remarksFormula },
            status: { f: statusFormula }
          };
        });

        const ws = XLSX.utils.json_to_sheet(sheetData, {
          header: ['studentId', 'session', 'roll', 'class', 'section', 'name', 'examId', 'subject', 'marks', 'grade', 'remarks', 'status']
        });
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      }

      XLSX.writeFile(wb, 'results_upload_template.xlsx');
      toast.dismiss();
      toast.success('Template downloaded!');
    } catch (err) {
      toast.dismiss();
      toast.error(err.message || 'Could not generate template.');
    }
  };

  const exportToCSV = () => {
    if (!filteredResults.length) { toast.error('No results to export'); return; }
    const hdr = ['Student', 'Roll', 'Class', 'Section', 'Exam', 'Subject', 'Marks', 'Grade', 'Status'];
    const rows = filteredResults.map(r => [r.studentId?.name||'N/A', r.studentId?.roll||'N/A', r.studentId?.grade||'N/A', r.studentId?.section||'N/A', r.examId?.title||'N/A', r.examId?.subject||'N/A', r.marks||0, r.grade||'N/A', r.status||'N/A']);
    const csv = [hdr.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `results_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success('Exported successfully');
  };

  /* ── computed ── */
  const uniqueSubjects = [...new Set(results.map(r => r.examId?.subject).filter(Boolean))];
  const studentSessionById = new Map(
    students
      .map((student) => [String(student?._id || ''), String(student?.academicYear || student?.session || '').trim()])
      .filter(([id]) => Boolean(id))
  );
  const getResultSession = (result) =>
    String(
      result?.studentId?.academicYear ||
      result?.studentId?.session ||
      studentSessionById.get(String(result?.studentId?._id || result?.studentId || '')) ||
      ''
    ).trim();
  const filterSessionOptions = [...new Set(
    results.map((result) => getResultSession(result)).filter(Boolean)
  )].sort();
  const filterClassOptions = [...new Set(
    results
      .filter((result) => !selectedSession || getResultSession(result) === selectedSession)
      .map((result) => String(result?.studentId?.grade || '').trim())
      .filter(Boolean)
  )].sort();
  const filterSectionOptions = [...new Set(
    results
      .filter((result) => !selectedSession || getResultSession(result) === selectedSession)
      .filter((result) => !selectedClass || String(result?.studentId?.grade || '').trim() === selectedClass)
      .map((result) => String(result?.studentId?.section || '').trim())
      .filter(Boolean)
  )].sort();
  const completedExamGroupOptions = (Array.isArray(examGroups) ? examGroups : [])
    .filter(group => String(group?.status || '').toLowerCase() === 'completed')
    .sort((a, b) => {
      const d1 = a?.startDate ? new Date(a.startDate).getTime() : (a?.createdAt ? new Date(a.createdAt).getTime() : 0);
      const d2 = b?.startDate ? new Date(b.startDate).getTime() : (b?.createdAt ? new Date(b.createdAt).getTime() : 0);
      return d2 - d1;
    });

  const filteredResults = results.filter(r => {
    const name = (r.studentId?.name||'').toLowerCase();
    const subj = (r.examId?.subject||'').toLowerCase();
    const q = searchTerm.toLowerCase();
    const resultSession = getResultSession(r);
    const resultClass = normalizeClass(r?.studentId?.grade || r?.studentId?.class || '');
    const selectedClassNormalized = normalizeClass(selectedClass);
    return (!q || name.includes(q) || subj.includes(q)) &&
      (!selectedSession || resultSession === selectedSession) &&
      (!selectedClass || resultClass === selectedClassNormalized) &&
      (!selectedSection || normSec(r?.studentId?.section || '') === normSec(selectedSection)) &&
      (filterSubject === 'all' || r.examId?.subject === filterSubject);
  });

  const stats = {
    total: filteredResults.length,
    pass: filteredResults.filter(r => r.status?.toLowerCase() === 'pass').length,
    fail: filteredResults.filter(r => r.status?.toLowerCase() === 'fail').length,
    absent: filteredResults.filter(r => r.status?.toLowerCase() === 'absent').length,
  };

  const passRate = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0;
  const examById = new Map((Array.isArray(exams) ? exams : []).map((exam) => [String(exam._id), exam]));
  const resultsByExam = filteredResults.reduce((acc, r) => {
    const eid = r.examId?._id || String(r.examId) || 'unknown';
    if (!acc[eid]) acc[eid] = { exam: r.examId, results: [] };
    acc[eid].results.push(r);
    return acc;
  }, {});

  /* ── result form fields (reusable) ── */
  const renderResultFields = (form, setForm, options = {}) => {
    const lockScope = Boolean(options?.lockScope);
    const autoRemarks = Boolean(options?.autoRemarks);
    const selectedExam = exams.find(ex => ex._id === form.examId);
    const selectedStudentResult = results.find((result) => (
      String(result?.studentId?._id || result?.studentId || '') === String(form.studentId || '') &&
      String(result?.examId?._id || result?.examId || '') === String(form.examId || '')
    ));

    const applyExistingResult = (nextForm) => {
      const matchedResult = results.find((result) => (
        String(result?.studentId?._id || result?.studentId || '') === String(nextForm.studentId || '') &&
        String(result?.examId?._id || result?.examId || '') === String(nextForm.examId || '')
      ));
      if (!matchedResult) return nextForm;
      const matchedExam = exams.find((ex) => String(ex._id) === String(nextForm.examId || ''));
      const matchedStatus = matchedResult.status || 'pass';
      return {
        ...nextForm,
        marks: matchedResult.marks ?? '',
        grade: matchedResult.grade || '',
        status: matchedStatus,
        remarks: autoRemarks
          ? deriveRemarkFromMarks(matchedResult.marks, matchedExam?.marks || 100, matchedStatus) || ''
          : (matchedResult.remarks || ''),
      };
    };

    const handleMarksChange = (e) => {
      const rawMarks = e.target.value;
      const maxMarks = Number(selectedExam?.marks || 100);
      if (rawMarks === '') {
        setForm({ ...form, marks: '', grade: '', remarks: autoRemarks ? '' : form.remarks });
        return;
      }
      const numericMarks = Number(rawMarks);
      if (!Number.isFinite(numericMarks)) return;
      const clampedMarks = Number.isFinite(maxMarks) && maxMarks > 0
        ? Math.min(Math.max(numericMarks, 0), maxMarks)
        : Math.max(numericMarks, 0);
      let newGrade = form.grade;
      if (selectedExam?.marks && rawMarks !== '') {
        const percentage = (clampedMarks / Number(selectedExam.marks)) * 100;
        if (percentage >= 90) newGrade = 'A+';
        else if (percentage >= 80) newGrade = 'A';
        else if (percentage >= 70) newGrade = 'B';
        else if (percentage >= 60) newGrade = 'C';
        else if (percentage >= 50) newGrade = 'D';
        else newGrade = 'F';
      }
      const nextRemarks = autoRemarks
        ? deriveRemarkFromMarks(clampedMarks, selectedExam?.marks || 100, form.status)
        : form.remarks;
      setForm({ ...form, marks: String(clampedMarks), grade: newGrade, remarks: nextRemarks });
    };

    const activeSession = normalizeSession(activeAcademicYearName);
    const selectedSessionYearId = academicYears.find(
      (year) => normalizeSession(year?.name || '') === normalizeSession(form.session)
    )?._id || activeAcademicYearId;
    const availableSessionsFromStudents = [...new Set(
      students
        .map((s) => getStudentSession(s))
        .filter(Boolean)
    )].sort();
    const availableSessions = activeSession
      ? [activeSession]
      : availableSessionsFromStudents;
    const sessionOptions = form.session && !availableSessions.includes(String(form.session).trim())
      ? [String(form.session).trim(), ...availableSessions]
      : availableSessions;

    const sessionScopedStudents = students.filter((s) => {
      if (!form.session) return true;
      const selectedSession = String(form.session).trim();
      const studentSession = getStudentSession(s);
      return studentSession === selectedSession || (!studentSession && activeSession && selectedSession === activeSession);
    });

    const yearScopedClassNames = [...new Set(
      classes
        .filter((c) => !selectedSessionYearId || String(c.academicYearId || '') === String(selectedSessionYearId))
        .map((c) => String(c.name || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const studentScopedClassNames = [...new Set(
      sessionScopedStudents
        .map((s) => String(s.grade || s.class || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const availableClasses = (form.session && activeSession && String(form.session).trim() === activeSession && yearScopedClassNames.length)
      ? yearScopedClassNames
      : studentScopedClassNames;
    const classOptions = form.className && !availableClasses.includes(String(form.className).trim())
      ? [String(form.className).trim(), ...availableClasses]
      : availableClasses;

    const selectedClassIds = classes
      .filter((c) => String(c.name || '').trim() === String(form.className || '').trim())
      .filter((c) => !selectedSessionYearId || String(c.academicYearId || '') === String(selectedSessionYearId))
      .map((c) => String(c._id || c.id || ''))
      .filter(Boolean);
    const masterSections = [...new Set(
      sections
        .filter((s) => !selectedClassIds.length || selectedClassIds.includes(String(s.classId || '')))
        .map((s) => String(s.name || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const studentSections = [...new Set(
      sessionScopedStudents
        .filter((s) => !form.className || normalizeClass(s.grade || s.class || '') === normalizeClass(form.className))
        .map((s) => String(s.section || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const availableSections = (form.className && masterSections.length) ? masterSections : studentSections;
    const sectionOptions = form.sectionName && !availableSections.includes(String(form.sectionName).trim())
      ? [String(form.sectionName).trim(), ...availableSections]
      : availableSections;

    const selectedClassIdsForSession = classes
      .filter((c) => !selectedSessionYearId || String(c.academicYearId || '') === String(selectedSessionYearId))
      .filter((c) => String(c.name || '').trim() === String(form.className || '').trim())
      .map((c) => String(c._id || c.id || ''))
      .filter(Boolean);
    const examOptions = exams.filter((exam) => {
      const examClass = getExamClassName(exam);
      const examSection = getExamSectionName(exam);
      const examYearId = String(exam?.classId?.academicYearId || '');
      const matchSession = !selectedSessionYearId || examYearId === String(selectedSessionYearId);
      const matchClass = !form.className
        || normalizeClass(examClass) === normalizeClass(form.className)
        || selectedClassIdsForSession.includes(String(exam?.classId?._id || exam?.classId || ''));
      const matchSection = !form.sectionName || normSec(examSection) === normSec(form.sectionName);
      return matchSession && matchClass && matchSection;
    });

    const filteredStudents = students.filter(s => {
      const studentSession = getStudentSession(s);
      const formSession = String(form.session || '').trim();
      const matchSession = !formSession || studentSession === formSession || (!studentSession && activeSession && formSession === activeSession);
      const matchClass = !form.className || normalizeClass(s.grade || s.class || '') === normalizeClass(form.className);
      const matchSection = !form.sectionName || normSec(s.section || '') === normSec(form.sectionName);
      return matchSession && matchClass && matchSection;
    });

    return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Session">
          <select
            value={form.session || ''}
            onChange={e => {
              if (lockScope) return;
              setForm({
                ...form,
                session: e.target.value,
                className: '',
                sectionName: '',
                studentId: '',
                examId: '',
              });
            }}
            className={inp}
            disabled={lockScope || Boolean(activeSession)}
          >
            <option value="">
              {lockScope ? 'Session not available' : activeSession ? activeSession : 'Select session'}
            </option>
            {sessionOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </Field>
        <Field label="Class">
          <select
            value={form.className || ''}
            onChange={e => {
              if (lockScope) return;
              setForm({...form, className: e.target.value, sectionName: '', studentId: '', examId: ''});
            }}
            className={inp}
            disabled={lockScope}
          >
            <option value="">{lockScope ? 'Class not available' : 'Select class'}</option>
            {classOptions.map((className) => (
              <option key={className} value={className}>{className}</option>
            ))}
          </select>
        </Field>
        <Field label="Section">
          <select
            value={form.sectionName || ''}
            onChange={e => {
              if (lockScope) return;
              setForm({...form, sectionName: e.target.value, studentId: '', examId: ''});
            }}
            className={inp}
            disabled={lockScope}
          >
            <option value="">{lockScope ? 'Section not available' : 'Select section'}</option>
            {sectionOptions.map((sectionName) => (
              <option key={sectionName} value={sectionName}>{sectionName}</option>
            ))}
          </select>
        </Field>
      </div>
      
        <Field label="Student">
        <select
          value={form.studentId}
          onChange={e => {
            const nextForm = applyExistingResult({
              ...form,
              studentId: e.target.value,
            });
            setForm(nextForm);
          }}
          required
          disabled={loadingStudents}
          className={`${inp} disabled:opacity-60`}
        >
          <option value="">{loadingStudents ? 'Loading…' : filteredStudents.length === 0 ? 'No students found' : 'Choose a student…'}</option>
          {filteredStudents.map(s => <option key={s._id} value={s._id}>{formatStudentDisplay(s)}</option>)}
        </select>
        {!loadingStudents && filteredStudents.length > 0 && <p className="text-xs text-slate-400 mt-1">{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} available</p>}
      </Field>

      <Field label="Exam">
        <select
          value={form.examId}
          onChange={e => {
            const nextExamId = e.target.value;
            const nextForm = applyExistingResult({
              ...form,
              examId: nextExamId,
              marks: '',
              grade: '',
              remarks: autoRemarks ? '' : form.remarks,
            });
            setForm(nextForm);
          }}
          required
          className={inp}
        >
          <option value="">{examOptions.length ? 'Choose an exam…' : 'No matching exam subjects'}</option>
          {examOptions.map(ex => <option key={ex._id} value={ex._id}>{ex.title} – {ex.subject} ({ex.term}) {ex.marks ? `[Max: ${ex.marks}]` : ''}</option>)}
        </select>
        {!exams.length && <p className="text-xs text-indigo-500 mt-1">No exams found. Create exams from Exam Management.</p>}
        {!!exams.length && !examOptions.length && (
          <p className="text-xs text-amber-600 mt-1">No exam subjects match the selected session, class, and section.</p>
        )}
      </Field>
      {selectedStudentResult && (
        <p className="text-xs text-emerald-600 -mt-1">
          Existing marks found for this student and exam. The saved values have been loaded.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Marks">
          <input type="number" value={form.marks} onChange={handleMarksChange} required min="0" max={Number(selectedExam?.marks || 100)} step="1" className={inp} placeholder="0" />
          <p className="text-xs text-slate-400 mt-1">Allowed range: 0 to {Number(selectedExam?.marks || 100)}</p>
        </Field>
        <Field label="Grade">
          <input type="text" value={form.grade} onChange={e => setForm({...form, grade: e.target.value})} className={inp} placeholder="A, B, C…" />
        </Field>
      </div>
      <Field label="Status">
        <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inp}>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
          <option value="absent">Absent</option>
        </select>
      </Field>
      <Field label="Remarks">
        <textarea
          value={form.remarks}
          onChange={e => {
            if (autoRemarks) return;
            setForm({...form, remarks: e.target.value});
          }}
          rows="2"
          className={`${inp} resize-none ${autoRemarks ? 'bg-slate-100 text-slate-600' : ''}`}
          placeholder="Optional remarks…"
          readOnly={autoRemarks}
        />
        {autoRemarks && (
          <p className="text-xs text-slate-400 mt-1">Remarks are generated automatically from the marks entered.</p>
        )}
      </Field>
    </div>
    );
  };

  const renderBulkEntryFields = () => {
    const activeSession = normalizeSession(activeAcademicYearName);
    const selectedSessionYearId = academicYears.find(
      (year) => normalizeSession(year?.name || '') === normalizeSession(bulkEntryForm.session)
    )?._id || activeAcademicYearId;
    const availableSessionsFromStudents = [...new Set(
      students.map((s) => getStudentSession(s)).filter(Boolean)
    )].sort();
    const availableSessions = activeSession ? [activeSession] : availableSessionsFromStudents;
    const sessionScopedStudents = students.filter((s) =>
      !bulkEntryForm.session ||
      getStudentSession(s) === String(bulkEntryForm.session).trim() ||
      (!getStudentSession(s) && activeSession && String(bulkEntryForm.session).trim() === activeSession)
    );
    const yearScopedClassNames = [...new Set(
      classes
        .filter((c) => !activeAcademicYearId || String(c.academicYearId || '') === String(activeAcademicYearId))
        .map((c) => String(c.name || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const studentScopedClassNames = [...new Set(
      sessionScopedStudents.map((s) => String(s.grade || s.class || '').trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const availableClasses = (bulkEntryForm.session && activeSession && String(bulkEntryForm.session).trim() === activeSession && yearScopedClassNames.length)
      ? yearScopedClassNames
      : studentScopedClassNames;
    const selectedClassIds = classes
      .filter((c) => String(c.name || '').trim() === String(bulkEntryForm.className || '').trim())
      .filter((c) => !activeAcademicYearId || String(c.academicYearId || '') === String(activeAcademicYearId))
      .map((c) => String(c._id || c.id || ''))
      .filter(Boolean);
    const availableSectionsFromMaster = [...new Set(
      sections
        .filter((s) => !selectedClassIds.length || selectedClassIds.includes(String(s.classId || '')))
        .map((s) => String(s.name || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const availableSectionsFromStudents = [...new Set(
      sessionScopedStudents
        .filter((s) => !bulkEntryForm.className || normalizeClass(s.grade || s.class || '') === normalizeClass(bulkEntryForm.className))
        .map((s) => String(s.section || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const availableSections = (bulkEntryForm.className && availableSectionsFromMaster.length)
      ? availableSectionsFromMaster
      : availableSectionsFromStudents;

    const examOptions = exams.filter((exam) => {
      const examClass = getExamClassName(exam);
      const examSection = getExamSectionName(exam);
      const examYearId = String(exam?.classId?.academicYearId || '');
      const selectedClassIdsForSession = classes
        .filter((c) => !selectedSessionYearId || String(c.academicYearId || '') === String(selectedSessionYearId))
        .filter((c) => String(c.name || '').trim() === String(bulkEntryForm.className || '').trim())
        .map((c) => String(c._id || c.id || ''))
        .filter(Boolean);
      const matchSession = !selectedSessionYearId || examYearId === String(selectedSessionYearId);
      const matchClass = !bulkEntryForm.className
        || normalizeClass(examClass) === normalizeClass(bulkEntryForm.className)
        || selectedClassIdsForSession.includes(String(exam?.classId?._id || exam?.classId || ''));
      const matchSection = !bulkEntryForm.sectionName || normSec(examSection) === normSec(bulkEntryForm.sectionName);
      return matchSession && matchClass && matchSection;
    });
    const selectedExam = exams.find((exam) => String(exam._id) === String(bulkEntryForm.examId));

    const onFilterChange = (patch) => {
      const next = {
        ...bulkEntryForm,
        ...patch,
      };
      setBulkEntryForm(next);
      const hasAllFilters = next.session && next.className && next.sectionName && next.examId;
      if (hasAllFilters) {
        loadBulkEntryRows(next);
      } else {
        setBulkEntryRows([]);
      }
    };

    return (
      <form onSubmit={handleBulkResultSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Field label="Session(Active)">
            <select
              value={bulkEntryForm.session}
              onChange={(e) => onFilterChange({ session: e.target.value, className: '', sectionName: '', examId: '' })}
              className={`${inp} sm:max-w-[180px]`}
              disabled={Boolean(activeSession)}
            >
              <option value="">{activeSession || 'Select session'}</option>
              {availableSessions.map((session) => (
                <option key={session} value={session}>{session}</option>
              ))}
            </select>
          </Field>
          <Field label="Class">
            <select
              value={bulkEntryForm.className}
              onChange={(e) => onFilterChange({ className: e.target.value, sectionName: '', examId: '' })}
              className={`${inp} sm:max-w-[180px]`}
              disabled={!bulkEntryForm.session}
            >
              <option value="">Select class</option>
              {availableClasses.map((className) => (
                <option key={className} value={className}>{className}</option>
              ))}
            </select>
          </Field>
          <Field label="Section">
            <select
              value={bulkEntryForm.sectionName}
              onChange={(e) => onFilterChange({ sectionName: e.target.value, examId: '' })}
              className={`${inp} sm:max-w-[180px]`}
              disabled={!bulkEntryForm.className}
            >
              <option value="">Select section</option>
              {availableSections.map((sectionName) => (
                <option key={sectionName} value={sectionName}>{sectionName}</option>
              ))}
            </select>
          </Field>
          <Field label="Exam Subject">
            <select
              value={bulkEntryForm.examId}
              onChange={(e) => onFilterChange({ examId: e.target.value })}
              className={`${inp} sm:max-w-[260px]`}
              disabled={!bulkEntryForm.sectionName}
            >
              <option value="">Select exam</option>
              {examOptions.map((exam) => (
                <option key={exam._id} value={exam._id}>
                  {exam.subject || exam.title} {exam.term ? `(${exam.term})` : ''} {exam.marks ? `- Max ${exam.marks}` : ''}
                </option>
              ))}
            </select>
            {bulkEntryForm.session && bulkEntryForm.className && !examOptions.length && (
              <p className="text-xs text-amber-600 mt-1">
                No exam subjects found for the selected session and class.
              </p>
            )}
          </Field>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="text-center px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wide">
            Students
          </div>
          {bulkEntryLoading ? (
            <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Loading students...
            </div>
          ) : bulkEntryRows.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              Select session, class, section, and exam to load students.
            </div>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Student</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Roll</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Marks{selectedExam?.marks ? ` / ${selectedExam.marks}` : ''}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Grade</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {bulkEntryRows.map((row) => (
                    <tr key={row.studentId}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{row.name || '—'}</div>
                        <div className="text-xs text-slate-400">{row.studentCode || ''}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{row.roll || '—'}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          min="0"
                          max={selectedExam?.marks || undefined}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={row.marks}
                          onChange={(e) => handleBulkRowMarksChange(row.studentId, e.target.value)}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.grade}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBulkEntryRows((prev) => prev.map((item) => item.studentId === row.studentId ? { ...item, grade: value } : item));
                          }}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.status}
                          onChange={(e) => {
                            handleBulkRowStatusChange(row.studentId, e.target.value);
                          }}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                        >
                          <option value="pass">Pass</option>
                          <option value="fail">Fail</option>
                          <option value="absent">Absent</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.remarks}
                          readOnly
                          className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-600 focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={closeAddResultModal}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={bulkEntrySubmitting || bulkEntryLoading || !bulkEntryRows.length}
            className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-60"
          >
            {bulkEntrySubmitting ? 'Uploading...' : 'Upload All Marks'}
          </button>
        </div>
      </form>
    );
  };

  const openAddResultModal = async () => {
    const defaultSession = normalizeSession(activeAcademicYearName);
    setAddResultMode('bulk');
    setResultForm((prev) => ({ ...prev, session: defaultSession || prev.session || '' }));
    setBulkEntryForm({ session: defaultSession || '', className: '', sectionName: '', examId: '' });
    setBulkEntryRows([]);
    setShowAddResult(true);

    void Promise.all([
      fetchExams(),
      fetchStudentsByClass(true),
      fetchAcademicSetup(),
    ]);
  };

  const closeAddResultModal = () => {
    setShowAddResult(false);
    setResultForm(emptyR);
    setAddResultMode('single');
    setBulkEntryForm({ session: '', className: '', sectionName: '', examId: '' });
    setBulkEntryRows([]);
    setBulkEntryLoading(false);
    setBulkEntrySubmitting(false);
  };

  useEffect(() => {
    if (!showAddResult) return;
    const activeSession = normalizeSession(activeAcademicYearName);
    if (!activeSession) return;
    setResultForm((prev) => (prev.session ? prev : { ...prev, session: activeSession }));
    setBulkEntryForm((prev) => (prev.session ? prev : { ...prev, session: activeSession }));
  }, [activeAcademicYearName, showAddResult]);

  /* ════════════ RENDER ════════════ */
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <FileSpreadsheet size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Result Management</h1>
              <p className="text-xs text-slate-500">Record marks and publish student results</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { fetchResults(); fetchExams(); fetchExamGroups(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
              <RefreshCw size={13} /> Refresh
            </button>
            <button onClick={() => { window.location.href = '/admin/examination'; }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-xs text-indigo-700 hover:bg-indigo-100 transition-colors font-semibold">
              <BookOpen size={13} /> Exam Manager
            </button>
            <button onClick={() => setShowBulkUpload(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
              <FileUp size={13} /> Bulk Upload
            </button>
            <button onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
              <FileDown size={13} /> Export
            </button>
            <button onClick={openAddResultModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors">
              <Plus size={13} /> Add Result
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Results" value={stats.total} icon={FileSpreadsheet} bg="bg-white" border="border-slate-200" text="text-slate-700" />
          <StatCard label="Passed" value={stats.pass} icon={CheckCircle} bg="bg-emerald-50" border="border-emerald-100" text="text-emerald-600" />
          <StatCard label="Failed" value={stats.fail} icon={XCircle} bg="bg-red-50" border="border-red-100" text="text-red-600" />
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Pass Rate</p>
              <TrendingUp size={18} className="text-indigo-400" />
            </div>
            <p className="text-2xl font-bold text-indigo-600">{passRate}%</p>
            <div className="mt-2 h-1.5 rounded-full bg-indigo-100 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${passRate}%` }} />
            </div>
          </div>
        </div>

        {/* ── Completed Exam Publish Toggles ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <label className="mb-2 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Completed Main Exams
          </label>
          {!completedExamGroupOptions.length ? (
            <p className="text-sm text-slate-500">No completed main exams found</p>
          ) : (
            <div className="space-y-2">
              {completedExamGroupOptions.map((group) => {
                const { publishedCount, totalCount, fullyPublished } = getCompletedExamGroupSummary(group);
                const isUpdating = updatingCompletedExamGroupId === String(group._id);
                const disabled = isUpdating || totalCount === 0;
                return (
                  <div key={group._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        {group.title} {group.term ? `(${group.term})` : ''}
                      </p>
                      <p className="text-xs text-slate-500">
                        {publishedCount}/{totalCount} subject results visible to students
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleCompletedExamGroupPublish(group, !fullyPublished)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors duration-300 focus:outline-none ${
                          fullyPublished ? 'bg-emerald-500 border-emerald-500' : 'bg-gray-200 border-gray-200'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${fullyPublished ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      <span className={`text-sm font-semibold ${fullyPublished ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {isUpdating ? 'Updating...' : fullyPublished ? 'Published' : 'Unpublished'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search student or subject…"
                className="pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 w-52" />
            </div>
            <select value={selectedSession} onChange={e => { setSelectedSession(e.target.value); setSelectedClass(''); setSelectedSection(''); }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none min-w-[140px]">
              <option value="">All Sessions</option>
              {filterSessionOptions.map(session => <option key={session} value={session}>{session}</option>)}
            </select>
            <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none min-w-[120px]">
              <option value="">All Classes</option>
              {filterClassOptions.map(className => <option key={className} value={className}>{className}</option>)}
            </select>
            <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none min-w-[120px]">
              <option value="">All Sections</option>
              {filterSectionOptions.map(sectionName => <option key={sectionName} value={sectionName}>{sectionName}</option>)}
            </select>
            <div className="relative">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-4 py-2.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none min-w-[140px]">
                <option value="all">All Subjects</option>
                {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <span className="ml-auto text-xs text-slate-400 font-medium">{filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* ── Results by Exam ── */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={28} className="animate-spin text-indigo-400" />
            <p className="text-sm text-slate-400">Loading results…</p>
          </div>
        ) : Object.keys(resultsByExam).length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FileSpreadsheet size={22} className="text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-500">No results found</p>
            <p className="text-xs text-slate-400">Try adjusting filters or add a new result</p>
            <button onClick={openAddResultModal}
              className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              <Plus size={13} /> Add Result
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(resultsByExam).map(([examId, { exam, results: examResults }]) => {
              const isExpanded = expandedExams.has(examId);
              const passCount      = examResults.filter(r => r.status?.toLowerCase() === 'pass').length;
              const failCount      = examResults.filter(r => r.status?.toLowerCase() === 'fail').length;
              const publishedCount = examResults.filter(r => r.published).length;
              const allPublished   = publishedCount === examResults.length && examResults.length > 0;
              const termStyle      = TERM_STYLE[exam?.term] || 'bg-slate-50 text-slate-600 border-slate-100';
              const fullExam       = examById.get(String(examId)) || {};
              const examStatusRaw  = String(fullExam?.status || exam?.status || '').trim();
              const examStatusKey  = examStatusRaw.toLowerCase();
              const examIsCompleted = examStatusKey === 'completed';
              const examStatusStyle = EXAM_STATUS_STYLE[examStatusKey] || 'bg-slate-50 text-slate-600 border-slate-100';
              const canUnpublishAll = allPublished;
              const canPublishAll = examIsCompleted && !allPublished;
              const publishAllDisabled = !canPublishAll && !canUnpublishAll;

              // per-exam tab state
              const tabCls  = examTabState[examId]?.cls  || 'all';
              const tabSec  = examTabState[examId]?.sec  || 'all';
              const setTab  = (patch) => setExamTabState(prev => ({ ...prev, [examId]: { cls: 'all', sec: 'all', ...prev[examId], ...patch } }));

              const examClasses  = [...new Set(examResults.map(r => r.studentId?.grade).filter(Boolean))].sort();
              const examSections = [...new Set(
                examResults
                  .filter(r => tabCls === 'all' || r.studentId?.grade === tabCls)
                  .map(r => r.studentId?.section).filter(Boolean)
              )].sort();
              const visibleResults = examResults.filter(r => {
                const mc = tabCls === 'all' || r.studentId?.grade === tabCls;
                const ms = tabSec === 'all' || r.studentId?.section === tabSec;
                return mc && ms;
              });
              return (
                <div key={examId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* ── Exam header ── */}
                  <div className="px-5 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {exam?.term && <span className={`inline-flex rounded-lg px-2 py-0.5 text-[10px] font-bold border ${termStyle}`}>{exam.term}</span>}
                          {!!examStatusRaw && (
                            <span className={`inline-flex rounded-lg px-2 py-0.5 text-[10px] font-bold border capitalize ${examStatusStyle}`}>
                              {examStatusKey}
                            </span>
                          )}
                          <h3 className="font-bold text-slate-800">{exam?.title || 'Unknown Exam'}</h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                          <span>{exam?.subject || '—'}</span>
                          {(exam?.classId?.name || exam?.grade) && <><span>·</span><span>Class {exam?.classId?.name || exam?.grade}</span></>}
                          {(exam?.sectionId?.name || exam?.section) && <><span>·</span><span>Section {exam?.sectionId?.name || exam?.section}</span></>}
                          {exam?.marks && <><span>·</span><span>Max: {exam.marks}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 text-xs font-semibold border border-slate-200">
                          <FileSpreadsheet size={11} /> {examResults.length}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
                          <CheckCircle size={11} /> {passCount} Pass
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-semibold border border-red-100">
                          <XCircle size={11} /> {failCount} Fail
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${publishedCount > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                          {publishedCount > 0 ? <Eye size={11} /> : <EyeOff size={11} />}
                          {publishedCount}/{examResults.length} Published
                        </span>
                        <button
                          onClick={() => handlePublishExam(examId, !allPublished)}
                          disabled={publishAllDisabled}
                          title={!examIsCompleted && !allPublished ? 'Only completed exams can be published' : ''}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-colors ${
                            allPublished
                              ? 'bg-amber-500 text-white hover:bg-amber-600'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'
                          } ${publishAllDisabled ? 'opacity-50 cursor-not-allowed hover:bg-inherit' : ''}`}
                        >
                          <Send size={11} /> {allPublished ? 'Unpublish All' : 'Publish Completed'}
                        </button>
                        <button onClick={() => toggleExamExpand(examId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                          <ChevronRight size={13} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                          {isExpanded ? 'Hide' : 'View'} Students
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* ── Expanded student rows ── */}
                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      {/* Class tabs */}
                      {examClasses.length > 1 && (
                        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-100 flex-wrap bg-slate-50/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1">Class</span>
                          {['all', ...examClasses].map(cls => (
                            <button key={cls} onClick={() => setTab({ cls, sec: 'all' })}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${tabCls === cls ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700'}`}>
                              {cls === 'all' ? 'All Classes' : `Class ${cls}`}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Section tabs */}
                      {examSections.length > 1 && (
                        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-100 flex-wrap bg-slate-50/40">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1">Section</span>
                          {['all', ...examSections].map(sec => (
                            <button key={sec} onClick={() => setTab({ sec })}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${tabSec === sec ? 'bg-violet-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-violet-50 hover:text-violet-700'}`}>
                              {sec === 'all' ? 'All Sections' : `Section ${sec}`}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            {['Student', 'Marks', 'Grade', 'Status', 'Remarks', 'Visibility', ''].map((h, i) => (
                              <th key={i} className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {visibleResults.map((result, i) => {
                            const statusKey   = result.status?.toLowerCase();
                            const statusStyle = STATUS_STYLE[statusKey] || 'bg-blue-50 text-blue-700 border border-blue-100';
                            return (
                              <tr key={result._id || i} className="hover:bg-indigo-50/20 transition-colors group">
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-slate-800">{result.studentId?.name || 'N/A'}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">Roll {result.studentId?.roll || '—'} · {result.studentId?.grade || '—'} {result.studentId?.section || ''}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1">
                                    <Award size={12} className="text-amber-400" />
                                    <span className="font-bold text-slate-800">{result.marks ?? '—'}</span>
                                    {exam?.marks && <span className="text-slate-400 text-xs">/{exam.marks}</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="font-semibold text-slate-700">{result.grade || '—'}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize ${statusStyle}`}>{result.status || '—'}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs text-slate-500">{result.remarks || '—'}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleTogglePublish(result._id, !result.published)}
                                      disabled={!examIsCompleted && !result.published}
                                      title={!examIsCompleted && !result.published ? 'Only completed exams can be published' : ''}
                                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors duration-300 focus:outline-none ${
                                        result.published ? 'bg-emerald-500 border-emerald-500' : 'bg-gray-200 border-gray-200'
                                      } ${!examIsCompleted && !result.published ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${result.published ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </button>
                                    <span className={`text-[11px] font-semibold ${result.published ? 'text-emerald-600' : 'text-gray-400'}`}>
                                      {result.published ? 'Published' : 'Unpublished'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditResult(result)}
                                      className="h-7 w-7 flex items-center justify-center rounded-lg text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                      <Edit2 size={13} />
                                    </button>
                                    <button onClick={() => handleDeleteResult(result)}
                                      className="h-7 w-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
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
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ ADD RESULT MODAL ═══ */}
      <Modal show={showAddResult} onClose={closeAddResultModal} title="Add Result" subtitle="Record a student's exam result" icon={Plus} iconColor="bg-indigo-600">
        <div className="space-y-4">
          <div className="inline-flex rounded-full border border-slate-200 p-1 bg-slate-50">
            <button
              type="button"
              onClick={() => setAddResultMode('single')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${addResultMode === 'single' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}
            >
              Single Entry
            </button>
            <button
              type="button"
              onClick={() => setAddResultMode('bulk')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${addResultMode === 'bulk' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}
            >
              Bulk Entry
            </button>
          </div>

          {addResultMode === 'single' ? (
            <form onSubmit={handleAddResult} className="space-y-4">
              {renderResultFields(resultForm, setResultForm, { autoRemarks: true })}
              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={closeAddResultModal} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200">Add Result</button>
              </div>
            </form>
          ) : (
            renderBulkEntryFields()
          )}
        </div>
      </Modal>

      {/* ═══ EDIT RESULT MODAL ═══ */}
      <Modal show={showEditResult} onClose={() => setShowEditResult(false)} title="Edit Result" subtitle="Update result details" icon={Edit2} iconColor="bg-slate-600">
        <form onSubmit={handleUpdateResult} className="space-y-4">
          {renderResultFields(editResultForm, setEditResultForm, { lockScope: true, autoRemarks: false })}
          <div className="flex justify-end gap-2.5 pt-2">
            <button type="button" onClick={() => setShowEditResult(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200">Save Changes</button>
          </div>
        </form>
      </Modal>

      {/* ═══ BULK UPLOAD MODAL ═══ */}
      <Modal show={showBulkUpload} onClose={() => { setShowBulkUpload(false); setBulkExamId(''); setBulkFile(null); }} title="Bulk Upload Results" subtitle="Select an exam, download the template, fill it, and upload." icon={FileUp} iconColor="bg-violet-600" maxWidth="sm:max-w-lg">
        <form onSubmit={handleBulkUpload} className="space-y-4" encType="multipart/form-data">
          <Field label="Select Completed Exam (For Template)">
            <select value={bulkExamId} onChange={e => setBulkExamId(e.target.value)} className={inp}>
              <option value="">Choose a completed exam...</option>
              {exams.filter(ex => ex.status?.toLowerCase() === 'completed').map(ex => (
                <option key={ex._id} value={ex._id}>{ex.title} – {ex.subject} ({ex.term})</option>
              ))}
            </select>
          </Field>
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <FileUp size={28} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600 mb-1">Select your filled Excel file</p>
            <p className="text-xs text-slate-400 mb-4">Columns: studentId, examId, subject, marks, remarks, status</p>
            <input type="file" accept=".xlsx, .xls" onChange={e => setBulkFile(e.target.files[0])} required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100" />
            {bulkFile && <p className="mt-2 text-xs text-emerald-600 font-medium">✓ {bulkFile.name}</p>}
          </div>
          <button type="button" onClick={downloadExcelTemplate}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            <FileDown size={14} /> Download Excel Template
          </button>
          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" onClick={() => setShowBulkUpload(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 shadow-md shadow-violet-200">Upload Results</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Result;
