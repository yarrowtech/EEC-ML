import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, Download, FileSpreadsheet, Plus, Send, Upload, X,
  BookOpen, Edit2, Trash2, Clock, MapPin, User, Calendar,
  RefreshCw, ChevronRight, ChevronLeft, CheckCircle, XCircle, AlertCircle,
  Loader2, Award, TrendingUp, Eye, EyeOff, FileUp, FileDown, Info,
  ArrowRight,
  Edit
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
const Modal = ({ show, onClose, title, subtitle, icon: Icon, iconColor = 'bg-indigo-600', children, maxWidth = 'sm:max-w-3xl', fullPage = false }) => {
  // Lock page scroll behind the modal while it's open — restores whatever
  // the body had before in case another modal/overlay already set it.
  useEffect(() => {
    if (!show) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [show]);

  if (!show) return null;
  if (fullPage) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 bg-white shrink-0">
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
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-5">{children}</div>
        </div>
      </div>,
      document.body
    );
  }
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

const fmtDateTime = (v) =>
  v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

const toLocalInputValue = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* ── full-page, non-dismissible processing overlay ── */
const ProcessingOverlay = ({ open, title, text, percent = 0 }) => {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/70 p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            <p className="mt-1 text-xs text-gray-500">Do not refresh or close this window.</p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-300" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-800">{percent}%</p>
            <p className="mt-1 text-xs text-slate-400">{text}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

/* ── publish / schedule modal for one main exam ── */
const PublishResultModal = ({ group, summary, canSchedule, saving, onClose, onPublishNow, onUnpublish, onSchedule, onCancelSchedule }) => {
  const [mode, setMode] = useState('now');
  const [at, setAt] = useState('');
  const open = Boolean(group);
  const scheduledFor = group?.resultPublishAt && new Date(group.resultPublishAt).getTime() > Date.now() ? group.resultPublishAt : null;
  const minValue = toLocalInputValue(new Date(Date.now() + 60 * 1000));
  const invalidSchedule = mode === 'schedule' && (!at || new Date(at).getTime() <= Date.now());

  useEffect(() => {
    if (open) { setMode('now'); setAt(''); }
  }, [open, group?._id]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          onClick={saving ? undefined : onClose}
        >
          <motion.div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
            initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Publish Results</p>
                <h3 className="font-bold text-slate-900 truncate">{group?.title}{group?.term ? ` (${group.term})` : ''}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{summary?.publishedCount || 0}/{summary?.totalCount || 0} subject results visible to students</p>
              </div>
              <button onClick={onClose} disabled={saving} className="h-8 w-8 shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {scheduledFor && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5">
                  <p className="text-xs text-indigo-700"><Clock size={12} className="inline mr-1 -mt-0.5" />Scheduled for <span className="font-semibold">{fmtDateTime(scheduledFor)}</span></p>
                  <button type="button" onClick={onCancelSchedule} disabled={saving} className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50">Cancel schedule</button>
                </div>
              )}

              <button type="button" onClick={() => setMode('now')}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${mode === 'now' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <p className="text-sm font-bold text-slate-800 flex items-center gap-2"><Send size={14} className="text-emerald-600" /> Publish now</p>
                <p className="text-xs text-slate-500 mt-0.5">Every subject result under this exam becomes visible to students immediately.</p>
              </button>

              {canSchedule && (
                <button type="button" onClick={() => setMode('schedule')}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${mode === 'schedule' ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2"><Calendar size={14} className="text-indigo-600" /> Schedule publish</p>
                  <p className="text-xs text-slate-500 mt-0.5">Results are published automatically when the chosen date and time arrive.</p>
                </button>
              )}

              {mode === 'schedule' && canSchedule && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Publish on</label>
                  <input type="datetime-local" value={at} min={minValue} onChange={(e) => setAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/60">
              {summary?.publishedCount > 0 ? (
                <button type="button" onClick={onUnpublish} disabled={saving}
                  className="px-3 py-2 rounded-xl border border-amber-200 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                  Unpublish all
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-white">Cancel</button>
                {mode === 'now' ? (
                  <button type="button" onClick={onPublishNow} disabled={saving || !summary?.totalCount}
                    className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shadow-md shadow-emerald-200 disabled:opacity-60">
                    Publish
                  </button>
                ) : (
                  <button type="button" onClick={() => onSchedule(at)} disabled={saving || invalidSchedule}
                    className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save schedule'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

/* ════════════════════════════════════════════════════════ */
const Result = ({ setShowAdminHeader }) => {
  useEffect(() => { setShowAdminHeader?.(true); }, [setShowAdminHeader]);
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

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
  const [selectedSession] = useState('');
  const [selectedClass]   = useState('');
  const [selectedSection] = useState('');
  const filterSubject = 'all';

  const [showAddResult, setShowAddResult]   = useState(false);
  const [showEditResult, setShowEditResult] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const emptyR = { session: '', className: '', sectionName: '', examId: '', studentId: '', marks: '', grade: '', remarks: '', status: 'pass' };
  const [resultForm, setResultForm]       = useState(emptyR);
  const [editResultForm, setEditResultForm] = useState(emptyR);
  const [editingResultId, setEditingResultId] = useState(null);
  const [bulkFile, setBulkFile]             = useState(null);
  const [bulkExamId, setBulkExamId]         = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [examSessionFilter, setExamSessionFilter] = useState('');
  const [examNameFilter, setExamNameFilter] = useState('');
  const [examSearchTerm, setExamSearchTerm] = useState('');
  const [examFiltersOpen, setExamFiltersOpen] = useState(false);
  const [navCls, setNavCls] = useState('');
  const [navSec, setNavSec] = useState('');
  const [navSubj, setNavSubj] = useState('');
  const [publishModalGroup, setPublishModalGroup] = useState(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [publishJob, setPublishJob] = useState({ open: false, percent: 0, title: '', text: '' });
  const [updatingCompletedExamGroupId, setUpdatingCompletedExamGroupId] = useState('');
  const [addResultMode, setAddResultMode] = useState('single');
  const [bulkEntryForm, setBulkEntryForm] = useState({ session: '', className: '', sectionName: '', term: '', examId: '' });
  const [bulkEntryRows, setBulkEntryRows] = useState([]);
  const [bulkEntryLoading, setBulkEntryLoading] = useState(false);
  const [bulkEntrySubmitting, setBulkEntrySubmitting] = useState(false);
  const [bulkStep, setBulkStep] = useState(1);
  const [bulkSearchTerm, setBulkSearchTerm] = useState('');
  const [bulkExcludedIds, setBulkExcludedIds] = useState(() => new Set());
  const [bulkPage, setBulkPage] = useState(1);
  const BULK_ROWS_PER_PAGE = 8;

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

  const getGroupExamIds = (group) => new Set((group?.subjects || []).map((s) => String(s?._id || '')));
  const resultsOfGroup = (group, source = results) => {
    const ids = getGroupExamIds(group);
    return ids.size ? source.filter((r) => ids.has(String(r.examId?._id || r.examId))) : [];
  };

  const openPublishModal = (group) => setPublishModalGroup(group);

  const runGroupPublish = async (group, publish) => {
    const ids = resultsOfGroup(group).map((r) => r._id).filter(Boolean);
    if (!ids.length) { toast.error('No result entries found for this exam'); return; }
    setPublishModalGroup(null);
    const CHUNK = 200;
    let done = 0;
    let skipped = 0;
    setPublishJob({ open: true, percent: 0, title: publish ? 'Please wait, publishing results…' : 'Please wait, unpublishing results…', text: `0 of ${ids.length} results` });
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const r = await fetch(`${API_BASE}/api/exam/results/bulk-publish`, {
          method: 'PUT', headers: authH(), body: JSON.stringify({ resultIds: chunk, published: publish }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (publish && String(d?.error || '').toLowerCase().includes('completed')) skipped += chunk.length;
          else throw new Error(d?.error || 'Failed to update results');
        } else {
          skipped += d?.skippedCount || 0;
        }
        done += chunk.length;
        setPublishJob((j) => ({ ...j, percent: Math.round((done / ids.length) * 100), text: `${done} of ${ids.length} results` }));
      }
      if (publish && !group?.pseudo) {
        for (const member of (group?.memberGroups || [group]).filter((g) => g?._id && g.resultPublishAt)) {
          await fetch(`${API_BASE}/api/exam/groups/${member._id}/result-schedule`, {
            method: 'PUT', headers: authH(), body: JSON.stringify({ scheduledAt: null }),
          }).catch(() => {});
        }
      }
      toast.success(`${ids.length - skipped} result(s) ${publish ? 'published' : 'unpublished'}${skipped ? ` (${skipped} skipped: exam not completed)` : ''}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update results');
    } finally {
      await Promise.all([fetchResults(), fetchExamGroups()]);
      setPublishJob((j) => ({ ...j, open: false }));
    }
  };

  const saveGroupSchedule = async (group, localValue) => {
    const members = (group?.memberGroups || [group]).filter((g) => g?._id && !g.pseudo);
    if (!members.length) return;
    setScheduleSaving(true);
    try {
      const scheduledAt = localValue ? new Date(localValue).toISOString() : null;
      for (const member of members) {
        const r = await fetch(`${API_BASE}/api/exam/groups/${member._id}/result-schedule`, {
          method: 'PUT', headers: authH(), body: JSON.stringify({ scheduledAt }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error || 'Failed to save schedule');
      }
      toast.success(scheduledAt ? 'Result publishing scheduled' : 'Schedule cancelled');
      await fetchExamGroups();
      setPublishModalGroup(null);
    } catch (err) {
      toast.error(err.message || 'Failed to save schedule');
    } finally {
      setScheduleSaving(false);
    }
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
      setBulkExcludedIds(new Set());
      setBulkSearchTerm('');
      setBulkPage(1);
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
        if (bulkExcludedIds.has(row.studentId)) return null;
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

  /* ── main-exam cards + class → section → subject drill-down ── */
  const sessionOfGroup = (g) => String(g?.classId?.academicYearId?.name || '').trim();

  const allResultGroups = (() => {
    const list = (Array.isArray(examGroups) ? examGroups : [])
      .filter((g) => String(g?.status || '').toLowerCase() === 'completed' || getCompletedExamGroupSummary(g).totalCount > 0)
      .sort((a, b) => {
        const d1 = a?.startDate ? new Date(a.startDate).getTime() : (a?.createdAt ? new Date(a.createdAt).getTime() : 0);
        const d2 = b?.startDate ? new Date(b.startDate).getTime() : (b?.createdAt ? new Date(b.createdAt).getTime() : 0);
        return d2 - d1;
      });
    const groupedIds = new Set((Array.isArray(examGroups) ? examGroups : []).flatMap((g) => (g.subjects || []).map((s) => String(s._id))));
    // The same exam name (e.g. "Class Test 1") can exist once per class/section —
    // show it as a single card that covers all of them, grouped by session too
    // so "Class Test 1" from two different academic years stays separate.
    const mergedByTitle = new Map();
    list.forEach((g) => {
      const key = `${String(g.title || '').trim().toLowerCase()}::${sessionOfGroup(g)}`;
      if (!mergedByTitle.has(key)) {
        mergedByTitle.set(key, { ...g, _id: `merged:${key}`, session: sessionOfGroup(g), memberGroups: [g], subjects: [...(g.subjects || [])] });
      } else {
        const m = mergedByTitle.get(key);
        m.memberGroups.push(g);
        m.subjects.push(...(g.subjects || []));
        if (!m.resultPublishAt && g.resultPublishAt) m.resultPublishAt = g.resultPublishAt;
      }
    });
    list.length = 0;
    list.push(...mergedByTitle.values());
    const ungrouped = new Map();
    results.forEach((r) => {
      const id = String(r.examId?._id || r.examId || '');
      if (id && !groupedIds.has(id)) ungrouped.set(id, r.examId);
    });
    if (ungrouped.size) {
      list.push({
        _id: '__ungrouped__', pseudo: true, title: 'Other Exams', term: '', status: 'completed', session: '',
        subjects: [...ungrouped.entries()].map(([id, ex]) => ({ ...(ex && typeof ex === 'object' ? ex : {}), _id: id })),
      });
    }
    return list;
  })();

  const examSessionOptions = [...new Set(allResultGroups.map((g) => g.session).filter(Boolean))].sort();
  const examNameOptions = [...new Set(allResultGroups.map((g) => g.title).filter(Boolean))].sort();
  const resultGroups = allResultGroups.filter((g) =>
    (!examSessionFilter || g.session === examSessionFilter) &&
    (!examNameFilter || g.title === examNameFilter) &&
    (!examSearchTerm.trim() || String(g.title || '').toLowerCase().includes(examSearchTerm.trim().toLowerCase()))
  );
  const selectedGroup = resultGroups.find((g) => String(g._id) === String(selectedGroupId)) || null;
  const openGroupDetail = (group) => {
    setSelectedGroupId(String(group._id));
    setNavCls('');
    setNavSec('');
    setNavSubj('');
  };

  const detailResults = selectedGroup ? resultsOfGroup(selectedGroup, filteredResults) : [];
  const gradeOf = (r) => String(r.studentId?.grade || '—').trim() || '—';
  const sectionOf = (r) => String(r.studentId?.section || '—').trim() || '—';
  const groupRowsBy = (rows, keyFn) => {
    const m = new Map();
    rows.forEach((r) => { const k = keyFn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return m;
  };
  const naturalSort = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
  const classNodes = [...groupRowsBy(detailResults, gradeOf).entries()]
    .sort((a, b) => naturalSort(a[0], b[0])).map(([cls, rows]) => ({ cls, rows }));
  const clsRows = navCls ? detailResults.filter((r) => gradeOf(r) === navCls) : [];
  const secNodes = [...groupRowsBy(clsRows, sectionOf).entries()]
    .sort((a, b) => naturalSort(a[0], b[0])).map(([sec, rows]) => ({ sec, rows }));
  const secRows = navSec ? clsRows.filter((r) => sectionOf(r) === navSec) : [];
  const subjNodes = [...groupRowsBy(secRows, (r) => String(r.examId?._id || r.examId)).entries()]
    .map(([examId, rows]) => ({ examId, exam: rows[0]?.examId, rows }))
    .sort((a, b) => naturalSort(a.exam?.subject || '', b.exam?.subject || ''));
  const activeSubj = navSubj ? subjNodes.find((n) => n.examId === navSubj) || null : null;
  const goBackLevel = () => {
    if (navSubj) setNavSubj('');
    else if (navSec) setNavSec('');
    else if (navCls) setNavCls('');
    else setSelectedGroupId('');
  };

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

    // "Completed exam for the particular subject" — only exams the school has
    // actually finished sitting are eligible for result entry. This is scoped
    // to class/section only — Type (term) is a separate, later filter, since
    // a class can easily have several completed exam titles ("First
    // Summative Examination", "Class Test", "Class Test 2", ...) mixed
    // together and picking a type first narrows that down before Exam.
    const examOptionsForScope = exams.filter((exam) => {
      if (String(exam?.status || '').toLowerCase() !== 'completed') return false;
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
    const examTypeOptions = [...new Set(examOptionsForScope.map((exam) => String(exam.term || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    const examOptions = bulkEntryForm.term
      ? examOptionsForScope.filter((exam) => String(exam.term || '').trim() === bulkEntryForm.term)
      : examOptionsForScope;
    const selectedExam = exams.find((exam) => String(exam._id) === String(bulkEntryForm.examId));
    const maxMarks = Number(selectedExam?.marks || 100);

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

    const canProceedToStep2 = Boolean(bulkEntryForm.session && bulkEntryForm.className && bulkEntryForm.sectionName && bulkEntryForm.examId);

    const searchedRows = bulkSearchTerm.trim()
      ? bulkEntryRows.filter((row) => {
          const q = bulkSearchTerm.trim().toLowerCase();
          return String(row.name || '').toLowerCase().includes(q) || String(row.roll || '').toLowerCase().includes(q);
        })
      : bulkEntryRows;
    const totalPages = Math.max(1, Math.ceil(searchedRows.length / BULK_ROWS_PER_PAGE));
    const currentPage = Math.min(bulkPage, totalPages);
    const pagedRows = searchedRows.slice((currentPage - 1) * BULK_ROWS_PER_PAGE, currentPage * BULK_ROWS_PER_PAGE);

    const emptyMarksCount = bulkEntryRows.filter((row) => String(row.marks ?? '').trim() === '').length;
    const handleAutoFill = () => {
      // Fills every still-blank row with full marks (a safe, obviously-visible
      // default an admin will edit down rather than accidentally publish) —
      // grade/status/remarks are then derived the same way a manual entry would be.
      bulkEntryRows.forEach((row) => {
        if (String(row.marks ?? '').trim() === '') {
          handleBulkRowMarksChange(row.studentId, String(maxMarks));
        }
      });
    };

    const includedRows = bulkEntryRows.filter((row) => !bulkExcludedIds.has(row.studentId) && String(row.marks ?? '').trim() !== '');
    const stepMeta = [
      { id: 1, title: 'Select Exam', sub: 'Choose session, class and exam' },
      { id: 2, title: 'Enter Marks', sub: 'Fill marks and save results' },
    ];

    return (
      <form onSubmit={handleBulkResultSubmit} className="space-y-5">
        {/* Step indicator */}
        <div className="flex items-center">
          {stepMeta.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-2.5">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  bulkStep === step.id ? 'bg-indigo-600 text-white' : bulkStep > step.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {step.id}
                </div>
                <div className="hidden sm:block">
                  <p className={`text-sm font-bold ${bulkStep === step.id ? 'text-indigo-700' : 'text-slate-700'}`}>{step.title}</p>
                  <p className="text-xs text-slate-400">{step.sub}</p>
                </div>
              </div>
              {idx < stepMeta.length - 1 && <div className="mx-3 h-px flex-1 bg-slate-200" />}
            </React.Fragment>
          ))}
        </div>

        {bulkStep === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Field label="Session (Active)">
                <select
                  value={bulkEntryForm.session}
                  onChange={(e) => onFilterChange({ session: e.target.value, className: '', sectionName: '', term: '', examId: '' })}
                  className={inp}
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
                  onChange={(e) => onFilterChange({ className: e.target.value, sectionName: '', term: '', examId: '' })}
                  className={inp}
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
                  onChange={(e) => onFilterChange({ sectionName: e.target.value, term: '', examId: '' })}
                  className={inp}
                  disabled={!bulkEntryForm.className}
                >
                  <option value="">Select section</option>
                  {availableSections.map((sectionName) => (
                    <option key={sectionName} value={sectionName}>{sectionName}</option>
                  ))}
                </select>
              </Field>
              <Field label="Type">
                <select
                  value={bulkEntryForm.term}
                  onChange={(e) => onFilterChange({ term: e.target.value, examId: '' })}
                  className={inp}
                  disabled={!bulkEntryForm.sectionName}
                >
                  <option value="">All types</option>
                  {examTypeOptions.map((term) => (
                    <option key={term} value={term}>{term}</option>
                  ))}
                </select>
              </Field>
              <Field label="Exam">
                <select
                  value={bulkEntryForm.examId}
                  onChange={(e) => onFilterChange({ examId: e.target.value })}
                  className={inp}
                  disabled={!bulkEntryForm.sectionName}
                >
                  <option value="">Select exam</option>
                  {examOptions.map((exam) => (
                    <option key={exam._id} value={exam._id}>
                      {exam.subject || exam.title} {exam.term ? `(${exam.term})` : ''} {exam.marks ? `- Max ${exam.marks}` : ''}
                    </option>
                  ))}
                </select>
                {bulkEntryForm.sectionName && !examOptions.length && (
                  <p className="text-xs text-amber-600 mt-1">
                    No completed exams found for this class/section{bulkEntryForm.term ? ` and type (${bulkEntryForm.term})` : ''}.
                  </p>
                )}
              </Field>
            </div>

            <Field label="Subject">
              <input
                value={selectedExam?.subject || selectedExam?.title || ''}
                readOnly
                placeholder="Select an exam to see its subject"
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600"
              />
            </Field>

            {selectedExam && (
              <p className="text-center text-xs text-slate-500">
                Selected Exam: <span className="font-semibold text-slate-700">{selectedExam.title}</span>
                {bulkEntryForm.session ? ` (${bulkEntryForm.session})` : ''} • Class {bulkEntryForm.className}
                {bulkEntryForm.sectionName ? ` - ${bulkEntryForm.sectionName}` : ''} • {selectedExam.subject || selectedExam.title}
              </p>
            )}
          </div>
        )}

        {bulkStep === 2 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold uppercase tracking-wide">Entering marks for:</span>
              <span className="rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold px-2.5 py-1">Class {bulkEntryForm.className || '—'}</span>
              <ArrowRight size={13} className="text-slate-400"  />
              <span className="rounded-full bg-violet-50 border border-violet-100 text-violet-700 font-semibold px-2.5 py-1">Section {bulkEntryForm.sectionName || '—'}</span>
              <ArrowRight size={13} className="text-slate-400" />
              <span className="rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 font-semibold px-2.5 py-1">{selectedExam?.subject || selectedExam?.title || '—'}</span>
              <ArrowRight size={13} className="text-slate-400" />
              {selectedExam?.title && selectedExam?.subject && (
                <span className="rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-semibold px-2.5 py-1">{selectedExam.title}</span>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Students ({searchedRows.length})</p>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={bulkSearchTerm}
                      onChange={(e) => { setBulkSearchTerm(e.target.value); setBulkPage(1); }}
                      placeholder="Search by name or roll number..."
                      className="rounded-lg border border-slate-200 bg-white pl-7 pr-3 py-1.5 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFill}
                    disabled={!emptyMarksCount}
                    className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Auto Fill ({emptyMarksCount})
                  </button>
                </div>
              </div>

              {bulkEntryLoading ? (
                <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Loading students...
                </div>
              ) : bulkEntryRows.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">No students found for this class/section.</div>
              ) : (
                <div className="max-h-[calc(100dvh-330px)] min-h-[320px] overflow-auto lg:max-h-[260px] lg:min-h-[180px]">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr className="border-b border-slate-100">
                        <th className="px-3 py-2 text-left">
                          <input
                            type="checkbox"
                            checked={pagedRows.length > 0 && pagedRows.every((row) => !bulkExcludedIds.has(row.studentId))}
                            onChange={(e) => {
                              setBulkExcludedIds((prev) => {
                                const next = new Set(prev);
                                pagedRows.forEach((row) => (e.target.checked ? next.delete(row.studentId) : next.add(row.studentId)));
                                return next;
                              });
                            }}
                          />
                        </th>
                        {/* <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">#</th> */}
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Roll No.</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Student Name</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Marks (Out of {maxMarks})</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Grade</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pagedRows.map((row) => (
                        <tr key={row.studentId} className={bulkExcludedIds.has(row.studentId) ? 'opacity-50' : ''}>
                          <td className="px-3 py-1">
                            <input
                              type="checkbox"
                              checked={!bulkExcludedIds.has(row.studentId)}
                              onChange={() => {
                                setBulkExcludedIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(row.studentId)) next.delete(row.studentId);
                                  else next.add(row.studentId);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          {/* <td className="px-3 py-2 text-slate-500">{(currentPage - 1) * BULK_ROWS_PER_PAGE + idx + 1}</td> */}
                          <td className="px-3 py-2 text-slate-600">{row.roll || '—'}</td>
                          <td className="px-3 py-1">
                            <div className="font-medium text-slate-800">{row.name || '—'}</div>
                            <div className="text-xs text-slate-400">{row.studentCode || ''}</div>
                          </td>
                          <td className="px-3 py-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={row.marks}
                              onChange={(e) => handleBulkRowMarksChange(row.studentId, e.target.value)}
                              className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                            />
                          </td>
                          <td className="px-3 py-1">
                            <span className={`inline-flex min-w-9 justify-center rounded-md px-2 py-1 text-xs font-bold ${
                              row.grade ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {row.grade || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-1">
                            <select
                              value={row.status}
                              onChange={(e) => handleBulkRowStatusChange(row.studentId, e.target.value)}
                              className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                                row.status === 'fail' ? 'border-red-200 bg-red-50 text-red-700' : row.status === 'absent' ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              <option value="pass">Pass</option>
                              <option value="fail">Fail</option>
                              <option value="absent">Absent</option>
                            </select>
                          </td>
                          <td className="px-3 py-1">
                            <input
                              type="text"
                              value={row.remarks}
                              readOnly
                              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-sm text-slate-600 focus:outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {searchedRows.length > 0 && (
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50">
                  <p className="text-xs text-slate-500">
                    Showing {pagedRows.length} of {searchedRows.length} students
                  </p>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setBulkPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}
                      className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button key={p} type="button" onClick={() => setBulkPage(p)}
                        className={`h-7 w-7 flex items-center justify-center rounded-lg text-xs font-semibold ${p === currentPage ? 'bg-indigo-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-white'}`}>
                        {p}
                      </button>
                    ))}
                    <button type="button" onClick={() => setBulkPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                      className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2.5">
            <Info size={14} className="text-slate-400 shrink-0" />
            <p className="text-xs text-slate-400">Grades, status and remarks are generated automatically based on marks.</p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {bulkStep > 1 && (
              <button type="button" onClick={() => setBulkStep((s) => s - 1)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
                Back
              </button>
            )}
            <button type="button" onClick={closeAddResultModal} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            {bulkStep < 2 ? (
              <button
                type="button"
                onClick={() => setBulkStep((s) => s + 1)}
                disabled={!canProceedToStep2}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={bulkEntrySubmitting || bulkEntryLoading || !includedRows.length}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-60"
              >
                {bulkEntrySubmitting ? 'Saving...' : 'Save Results'}
              </button>
            )}
          </div>
        </div>
      </form>
    );
  };

  const openAddResultModal = async () => {
    const defaultSession = normalizeSession(activeAcademicYearName);
    setAddResultMode('bulk');
    setResultForm((prev) => ({ ...prev, session: defaultSession || prev.session || '' }));
    setBulkEntryForm({ session: defaultSession || '', className: '', sectionName: '', term: '', examId: '' });
    setBulkEntryRows([]);
    setBulkStep(1);
    setBulkSearchTerm('');
    setBulkExcludedIds(new Set());
    setBulkPage(1);
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
    setBulkEntryForm({ session: '', className: '', sectionName: '', term: '', examId: '' });
    setBulkEntryRows([]);
    setBulkEntryLoading(false);
    setBulkEntrySubmitting(false);
    setBulkStep(1);
    setBulkSearchTerm('');
    setBulkExcludedIds(new Set());
    setBulkPage(1);
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
            
            {/* <button onClick={() => navigate('/admin/examination')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-xs text-indigo-700 hover:bg-indigo-100 transition-colors font-semibold">
              <BookOpen size
              ={13} /> Exam Manager
            </button> */}
            <button onClick={openAddResultModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors">
              <Plus size={13} /> Add
            </button>
            <button onClick={() => setShowBulkUpload(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
              <FileUp size={13} /> Bulk
            </button>
            <button onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
              <FileDown size={13} /> Export
            </button>
            
            <button
              onClick={async () => {
                if (refreshing) return;
                setRefreshing(true);
                try {
                  await Promise.all([fetchResults(), fetchExams(), fetchExamGroups()]);
                } finally {
                  setRefreshing(false);
                }
              }}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60">
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Refreshing...' : 'Refresh'}
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
        {/* <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
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
        </div> */}

        {!selectedGroup ? (
          /* ══════════ LEVEL 1: exam name cards ══════════ */
          <>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={examSearchTerm} onChange={(e) => setExamSearchTerm(e.target.value)} placeholder="Search exam name…"
                  className="bg-white w-full pl-8 pr-4 py-2.5 rounded-full border border-slate-200 bg-slate-50 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
              </div>
              <button type="button"
                onClick={() => {
                  if (examFiltersOpen) { setExamSessionFilter(''); setExamNameFilter(''); }
                  setExamFiltersOpen((v) => !v);
                }}
                title={examFiltersOpen ? 'Close filters' : 'Filter by session or exam name'}
                className={`shrink-0 h-[42px] w-[42px] flex items-center justify-center rounded-full border transition-colors ${
                  examFiltersOpen || examSessionFilter || examNameFilter
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}>
                {examFiltersOpen ? <X size={16} /> : <Filter size={16} />}
              </button>
            </div>
            {examFiltersOpen && (
              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100">
                <select value={examSessionFilter} onChange={(e) => setExamSessionFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none min-w-[140px]">
                  <option value="">All Sessions</option>
                  {examSessionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={examNameFilter} onChange={(e) => setExamNameFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none min-w-[160px]">
                  <option value="">All Exam Names</option>
                  {examNameOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="ml-auto text-xs text-slate-400 font-medium">{resultGroups.length} exam{resultGroups.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-indigo-400" />
              <p className="text-sm text-slate-400">Loading results…</p>
            </div>
          ) : resultGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <FileSpreadsheet size={22} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-500">No completed exams yet</p>
              <p className="text-xs text-slate-400">Completed exams show up here as cards once they have results</p>
              <button onClick={openAddResultModal}
                className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                <Plus size={13} /> Add Result
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {resultGroups.map((group) => {
                const summary = getCompletedExamGroupSummary(group);
                const scheduledFor = group.resultPublishAt && new Date(group.resultPublishAt).getTime() > Date.now() ? group.resultPublishAt : null;
                const pct = summary.totalCount ? Math.round((summary.publishedCount / summary.totalCount) * 100) : 0;
                const statusPill = summary.fullyPublished
                  ? { label: 'Published', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', Icon: Eye }
                  : scheduledFor
                    ? { label: 'Scheduled', cls: 'bg-indigo-50 text-indigo-700 border-indigo-100', Icon: Clock }
                    : summary.publishedCount > 0
                      ? { label: 'Partly published', cls: 'bg-sky-50 text-sky-700 border-sky-100', Icon: Eye }
                      : { label: 'Unpublished', cls: 'bg-amber-50 text-amber-700 border-amber-100', Icon: EyeOff };
                return (
                  <div key={group._id}
                    role="button" tabIndex={0}
                    onClick={() => openGroupDetail(group)}
                    onKeyDown={(e) => { if (e.key === 'Enter') openGroupDetail(group); }}
                    className="group bg-white rounded-2xl border border-slate-200 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="h-11 w-11 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                          <BookOpen size={18} className="text-white" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-800 truncate">{group.title}</h3>
                          {group.session && <p className="text-xs text-slate-400 mt-0.5">{group.session}</p>}
                        </div>
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-indigo-400 transition-colors mt-1.5" />
                    </div>

                    <span className={`inline-flex self-start items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold border ${statusPill.cls}`}>
                      <statusPill.Icon size={11} /> {statusPill.label}
                    </span>

                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                        <span className="text-slate-500">{summary.publishedCount}/{summary.totalCount} results published</span>
                        <span className="text-slate-400">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 mt-1">
                      {scheduledFor ? (
                        <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1 truncate"><Clock size={11} className="shrink-0" /> {fmtDateTime(scheduledFor)}</span>
                      ) : <span />}
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); openPublishModal(group); }}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                        <Edit size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </>
        ) : (
          /* ══════════ LEVEL 2+: class cards → section cards → subject cards → students ══════════ */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={goBackLevel}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                <ChevronLeft size={15} /> {navSubj ? 'Subjects' : navSec ? 'Sections' : navCls ? 'Classes' : 'All exams'}
              </button>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                  <span>{selectedGroup.title}</span>
                  {navCls && <><ChevronRight size={13} className="text-slate-300" /><span>Class {navCls}</span></>}
                  {navSec && <><ChevronRight size={13} className="text-slate-300" /><span>Section {navSec}</span></>}
                  {activeSubj && <><ChevronRight size={13} className="text-slate-300" /><span>{activeSubj.exam?.subject || activeSubj.exam?.title}</span></>}
                </p>
                <button type="button" onClick={() => openPublishModal(selectedGroup)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  <Edit2 size={12} /> Edit
                </button>
              </div>
            </div>

            {detailResults.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-14 gap-2">
                <FileSpreadsheet size={22} className="text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">No results found</p>
              </div>
            ) : !navCls ? (
              /* classes */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {classNodes.map(({ cls, rows }) => {
                  const pub = rows.filter((r) => r.published).length;
                  const secCount = new Set(rows.map(sectionOf)).size;
                  return (
                    <button key={cls} type="button" onClick={() => setNavCls(cls)}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3.5 text-left hover:shadow-md hover:border-indigo-200 transition-all flex items-center gap-3">
                      <span className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 text-white text-sm font-bold">{String(cls).slice(0, 3)}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-slate-800">Class {cls}</span>
                        <span className="block text-xs text-slate-400">{secCount} section{secCount !== 1 ? 's' : ''} · {pub}/{rows.length} published</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-slate-300" />
                    </button>
                  );
                })}
              </div>
            ) : !navSec ? (
              /* sections */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {secNodes.map(({ sec, rows }) => {
                  const pub = rows.filter((r) => r.published).length;
                  const subjCount = new Set(rows.map((r) => String(r.examId?._id || r.examId))).size;
                  return (
                    <button key={sec} type="button" onClick={() => setNavSec(sec)}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3.5 text-left hover:shadow-md hover:border-violet-200 transition-all flex items-center gap-3">
                      <span className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 text-white text-sm font-bold">{String(sec).slice(0, 3)}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-slate-800">Section {sec}</span>
                        <span className="block text-xs text-slate-400">{subjCount} subject{subjCount !== 1 ? 's' : ''} · {pub}/{rows.length} published</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-slate-300" />
                    </button>
                  );
                })}
              </div>
            ) : !activeSubj ? (
              /* subjects */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {subjNodes.map(({ examId, exam, rows }) => {
                  const pub = rows.filter((r) => r.published).length;
                  return (
                    <button key={examId} type="button" onClick={() => setNavSubj(examId)}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3.5 text-left hover:shadow-md hover:border-emerald-200 transition-all flex items-center gap-3">
                      <span className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
                        <BookOpen size={16} className="text-white" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-slate-800 truncate">{exam?.subject || exam?.title || 'Subject'}</span>
                        <span className="block text-xs text-slate-400">{rows.length} student{rows.length !== 1 ? 's' : ''} · {pub}/{rows.length} published</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-slate-300" />
                    </button>
                  );
                })}
              </div>
            ) : (
              /* students */
              (() => {
                const exam = activeSubj.exam;
                const rows = activeSubj.rows;
                const examIsCompleted = String(examById.get(String(exam?._id))?.status || exam?.status || '').toLowerCase() === 'completed';
                const publishedCount = rows.filter((r) => r.published).length;
                return (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50/70 border-b border-slate-100">
                      <span className="font-bold text-slate-800 text-sm">{exam?.subject || exam?.title || 'Subject'}
                        {exam?.marks ? <span className="ml-2 text-xs font-medium text-slate-400">Max {exam.marks}</span> : null}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search student…"
                            className="pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs w-40 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${publishedCount > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                          {publishedCount > 0 ? <Eye size={11} /> : <EyeOff size={11} />} {publishedCount}/{rows.length} Published
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            {['Student', 'Marks', 'Grade', 'Status', 'Remarks', 'Visibility', ''].map((h, i) => (
                              <th key={i} className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {rows.map((result, i) => {
                            const statusStyle = STATUS_STYLE[result.status?.toLowerCase()] || 'bg-blue-50 text-blue-700 border border-blue-100';
                            return (
                              <tr key={result._id || i} className="hover:bg-indigo-50/20 transition-colors group">
                                <td className="px-4 py-2.5">
                                  <p className="font-semibold text-slate-800">{result.studentId?.name || 'N/A'}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">Roll {result.studentId?.roll || '—'}</p>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-1">
                                    <Award size={12} className="text-amber-400" />
                                    <span className="font-bold text-slate-800">{result.marks ?? '—'}</span>
                                    {exam?.marks && <span className="text-slate-400 text-xs">/{exam.marks}</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5"><span className="font-semibold text-slate-700">{result.grade || '—'}</span></td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize ${statusStyle}`}>{result.status || '—'}</span>
                                </td>
                                <td className="px-4 py-2.5"><span className="text-xs text-slate-500">{result.remarks || '—'}</span></td>
                                <td className="px-4 py-2.5">
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
                                <td className="px-4 py-2.5">
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
                );
              })()
            )}
          </div>
        )}
      </div>

      {/* ═══ ADD RESULT MODAL ═══ */}
      <Modal show={showAddResult} onClose={closeAddResultModal} title="Add Result" subtitle="Record and upload students' exam results" icon={Plus} iconColor="bg-indigo-600" maxWidth="sm:max-w-4xl" fullPage>
        <div className="space-y-4">
          {/* <div className="inline-flex rounded-full border border-slate-200 p-1 bg-slate-50">
            <button
              type="button"
              onClick={() => setAddResultMode('single')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${addResultMode === 'single' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}
            >
              Single Entryy
            </button>
            <button
              type="button"
              onClick={() => setAddResultMode('bulk')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${addResultMode === 'bulk' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}
            >
              Bulk Entry
            </button>
          </div> */}

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

      <PublishResultModal
        group={publishModalGroup}
        summary={publishModalGroup ? getCompletedExamGroupSummary(publishModalGroup) : null}
        canSchedule={Boolean(publishModalGroup && !publishModalGroup.pseudo)}
        saving={scheduleSaving}
        onClose={() => setPublishModalGroup(null)}
        onPublishNow={() => runGroupPublish(publishModalGroup, true)}
        onUnpublish={() => runGroupPublish(publishModalGroup, false)}
        onSchedule={(at) => saveGroupSchedule(publishModalGroup, at)}
        onCancelSchedule={() => saveGroupSchedule(publishModalGroup, null)}
      />
      <ProcessingOverlay open={publishJob.open} title={publishJob.title} text={publishJob.text} percent={publishJob.percent} />
    </div>
  );
};

export default Result;
