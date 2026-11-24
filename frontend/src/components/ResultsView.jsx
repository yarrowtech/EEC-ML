import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Award,
  TrendingUp,
  Download,
  RefreshCw,
  Target,
  Calendar,
  Trophy,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  GraduationCap,
  ShieldCheck,
  BookOpen,
  Search,
  Medal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion as Motion } from 'framer-motion';
import { downloadSingleReportCardPdf } from '../utils/reportCardPdf';
import PageHeader from './PageHeader';

const API_BASE = import.meta.env.VITE_API_URL || '';
const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const dateOnly = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
};

/* SVG circular progress ring — mirrors the attendance ring on the dashboard */
const Ring = ({ pct = 0, size = 104, stroke = 10, color = '#10b981', bg = '#e5e7eb', label = 'Score' }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <svg
      width={size}
      height={size}
      className="-rotate-90"
      role="img"
      aria-label={`${label}: ${Math.round(pct)}%`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.9s ease' }}
      />
    </svg>
  );
};

const scoreTier = (pct) => pct >= 80
  ? { ring: '#10b981', text: 'text-emerald-600', soft: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500' }
  : pct >= 60
    ? { ring: '#f59e0b', text: 'text-amber-600', soft: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-500' }
    : { ring: '#ef4444', text: 'text-rose-600', soft: 'bg-rose-50', border: 'border-rose-200', bar: 'bg-rose-500' };

const RESULTS_PAGE_SIZE = 5;
const JSON_NO_CACHE_OPTIONS = {
  cache: 'no-store',
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  },
};

// ExamGroup has no explicit session/academic-year field, so the session label is
// derived from its start date assuming an Apr–Mar academic year (e.g. "2024-2025").
const deriveSessionLabel = (group) => {
  if (group?.session) return group.session;
  const raw = group?.startDate || group?.endDate;
  if (!raw) return 'Other';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return 'Other';
  const year = parsed.getFullYear();
  const startYear = parsed.getMonth() < 3 ? year - 1 : year;
  return `${startYear}-${startYear + 1}`;
};

const sessionKey = (session) => String(session || '').trim().toLowerCase().replace(/\s*[-–—]\s*/g, '-');
const displayClassName = (value) => {
  const name = String(value || '').trim();
  return name && !/^class\b/i.test(name) ? `Class ${name}` : name;
};

const buildExamCardFromReport = (rc, group, meta = {}) => {
  if (!rc) return null;
  const totals = rc.totals || {};
  const subjects = Array.isArray(rc.subjects) ? rc.subjects : [];
  if (!subjects.length) return null;
  const percentage = toNumber(totals.percentage, 0);
  const promoted = totals.promoted;
  return {
    _id: group?._id || String(rc.studentId || 'exam'),
    examName: group?.title || rc.term || 'Exam',
    sessionLabel: deriveSessionLabel(group),
    date: rc.generatedAt || null,
    startDate: group?.startDate || null,
    endDate: group?.endDate || null,
    examStatus: String(group?.status || '').toLowerCase(),
    obtainedMarks: toNumber(totals.obtainedMarks, 0),
    totalMarks: toNumber(totals.totalMarks, 0),
    percentage,
    grade: String(totals.grade || '').trim(),
    status: promoted === false ? 'Fail' : promoted === true ? 'Pass' : '',
    remarks: promoted === false ? 'Not Promoted' : promoted === true ? 'Promoted' : '',
    subjects: subjects.map((subject) => ({
      name: subject.name || 'Subject',
      marks: toNumber(subject.obtainedMarks, 0),
      maxMarks: toNumber(subject.totalMarks, 0),
      grade: subject.grade || '',
    })),
    rank: meta.rank ?? null,
    percentile: meta.percentile ?? null,
    classSize: meta.total ?? null,
    delta: meta.delta ?? null,
    subject: meta.subject ?? '',
    examId: meta.examId ?? null,
  };
};

const getPublishedExamGroupKey = (result = {}) => String(
  result?.examId?.groupId?._id ||
  result?.examId?.groupId ||
  result?.examId?._id ||
  result?.examId ||
  ''
).trim();

const buildFallbackPublishedCards = (results = []) => {
  const groupMap = new Map();
  const metaMap = new Map(); // key → { rank, percentile, total, delta, subject, examId }

  results.forEach((result) => {
    const key = getPublishedExamGroupKey(result);
    if (!key) return;

    // Persist rank/percentile/delta from enriched API
    if (!metaMap.has(key)) {
      metaMap.set(key, {
        rank: result.rank ?? null,
        percentile: result.percentile ?? null,
        total: result.total ?? null,
        delta: result.delta ?? null,
        subject: result.examId?.subject || '',
        examId: result.examId?._id || result.examId || null,
      });
    }

    const exam = result?.examId || {};
    const student = result?.studentId || {};
    const existing = groupMap.get(key) || {
      group: {
        _id: key,
        title: exam?.term || exam?.title || 'Exam',
        term: exam?.term || '',
        status: String(exam?.status || 'completed').toLowerCase(),
        startDate: null,
        endDate: null,
        session: result.examSession,
        className: result.examClassName || exam.grade,
      },
      student: {
        studentName: student?.name || 'Student',
        studentCode: student?.studentCode || '',
        username: student?.username || '',
        admissionNumber: student?.admissionNumber || '',
        roll: student?.roll || '',
        grade: student?.grade || '',
        section: student?.section || '',
        academicYear: student?.academicYear || '',
      },
      subjects: [],
      schedule: result.examGroupSchedule,
      totalObtained: 0,
      totalMarks: 0,
      latestDate: result?.createdAt || exam?.date || null,
    };

    if (exam.date && !Number.isNaN(new Date(exam.date).getTime())) {
      if (!existing.group.startDate || new Date(exam.date) < new Date(existing.group.startDate)) {
        existing.group.startDate = exam.date;
      }
      if (!existing.group.endDate || new Date(exam.date) > new Date(existing.group.endDate)) {
        existing.group.endDate = exam.date;
      }
    }
    existing.schedule ||= result.examGroupSchedule;

    const obtained = toNumber(result?.marks, 0);
    const maxMarks = toNumber(exam?.marks, 0);
    existing.subjects.push({
      name: exam?.subject || exam?.title || 'Subject',
      obtainedMarks: obtained,
      totalMarks: maxMarks,
      percentage: maxMarks > 0 ? Math.round((obtained / maxMarks) * 100) : 0,
      grade: String(result?.grade || '').trim(),
    });
    existing.totalObtained += obtained;
    existing.totalMarks += maxMarks;
    existing.latestDate = result?.createdAt || existing.latestDate || exam?.date || null;
    groupMap.set(key, existing);
  });

  return [...groupMap.values()]
    .map((entry) => {
      const group = {
        ...entry.group,
        startDate: entry.schedule?.startDate || entry.group.startDate || entry.latestDate,
        endDate: entry.schedule?.endDate || entry.group.endDate,
      };
      const percentage = entry.totalMarks > 0 ? (entry.totalObtained / entry.totalMarks) * 100 : 0;
      const rawReportCard = {
        studentId: entry.student.studentName,
        studentName: entry.student.studentName,
        studentCode: entry.student.studentCode,
        username: entry.student.username,
        admissionNumber: entry.student.admissionNumber,
        roll: entry.student.roll,
        grade: entry.student.grade,
        section: entry.student.section,
        academicYear: entry.student.academicYear,
        term: entry.group.title,
        totals: {
          obtainedMarks: entry.totalObtained,
          totalMarks: entry.totalMarks,
          percentage: Math.round(percentage * 100) / 100,
          grade: percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'F',
          promoted: entry.totalMarks > 0 ? percentage >= 50 : null,
        },
        subjects: entry.subjects,
        generatedAt: entry.latestDate || new Date().toISOString(),
      };

      return {
        id: entry.group._id,
        group,
        raw: rawReportCard,
        card: buildExamCardFromReport(rawReportCard, group, metaMap.get(entry.group._id) || {}),
      };
    })
    .sort((a, b) => {
      const d1 = new Date(a.raw?.generatedAt || a.group?.startDate || 0).getTime();
      const d2 = new Date(b.raw?.generatedAt || b.group?.startDate || 0).getTime();
      return d2 - d1;
    });
};

/**
 * Exam + assignment results.
 * @param {'student'|'parent'} portal  parent mode reads the given child's results
 * @param {string} studentId           required in parent mode
 */
const ResultsView = ({ portal = 'student', studentId = '' } = {}) => {
  const isParent = portal === 'parent';
  const location = useLocation();
  const [template, setTemplate] = useState(null);
  const [reportCard, setReportCard] = useState(null);
  const [academicContext, setAcademicContext] = useState(null);
  const [publishedResults, setPublishedResults] = useState([]);
  const [assignmentResults, setAssignmentResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedSessions, setSelectedSessions] = useState(null);
  const [examFilter, setExamFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState('');
  const [pick, setPick] = useState(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  // One bordered panel that fills the screen; the lists scroll inside it.
  const shellRef = useRef(null);
  const [shellHeight, setShellHeight] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = shellRef.current;
      if (!el || window.innerWidth < 1024) { setShellHeight(null); return; }
      setShellHeight(Math.max(520, window.innerHeight - el.getBoundingClientRect().top - 16));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [loading]);

  const fetchRequestIdRef = useRef(0);

  const fetchExamWiseReport = useCallback(async (refresh = false) => {
    const token = localStorage.getItem('token');
    const userType = localStorage.getItem('userType');
    if (!token || (!isParent && userType !== 'Student')) {
      setError('Please login as student to view results.');
      setLoading(false);
      return;
    }
    if (isParent && !studentId) {
      // Waiting for the parent's child list to resolve.
      setLoading(true);
      return;
    }

    // Rapid navigation away-and-back (location.key changes) can start a new
    // fetch before an earlier one resolves — only the most recent request's
    // response is allowed to update state, so a stale/slow response can't
    // overwrite fresher data.
    const requestId = ++fetchRequestIdRef.current;
    const isStale = () => fetchRequestIdRef.current !== requestId;

    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const childQ = `studentId=${encodeURIComponent(studentId)}`;
      const reportCardEndpoint = isParent
        ? `${API_BASE}/api/reports/report-cards/parent?${childQ}`
        : `${API_BASE}/api/reports/report-cards/me`;
      const resultsEndpoint = isParent
        ? `${API_BASE}/api/parent/results/exams?${childQ}`
        : `${API_BASE}/api/exam/results/me${refresh ? '?refresh=true' : ''}`;
      const assignmentResultsEndpoint = isParent
        ? `${API_BASE}/api/parent/results/assignments?${childQ}`
        : `${API_BASE}/api/student/auth/results`;

      const fetchJson = async (url) => {
        const response = await fetch(url, {
          ...JSON_NO_CACHE_OPTIONS,
          headers: {
            ...JSON_NO_CACHE_OPTIONS.headers,
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          let message = `Request failed (${response.status})`;
          try {
            const payload = await response.json();
            message = payload?.error || payload?.message || message;
          } catch {
            // keep fallback message
          }
          throw new Error(message);
        }
        return response.json();
      };

      const [reportCardResult, studentResultsResult, assignmentResult] = await Promise.allSettled([
        fetchJson(reportCardEndpoint),
        fetchJson(resultsEndpoint),
        fetchJson(assignmentResultsEndpoint),
      ]);

      if (isStale()) return;

      // Template + academic-year badge only — the results list itself is driven
      // entirely by the student's own published results below, so it naturally
      // spans every session/exam the student has ever had, not just the one
      // exam group the report-card endpoint happens to resolve.
      if (reportCardResult.status === 'fulfilled') {
        const data = reportCardResult.value || {};
        if (isParent) {
          // Parent endpoint returns { template, reportCards: [...] }.
          const card = (Array.isArray(data?.reportCards) ? data.reportCards : [])
            .find((c) => String(c?.studentId) === String(studentId)) || null;
          setTemplate(data?.template ? {
            ...data.template,
            signatureLabel: card?.classTeacherName || data.template.signatureLabel,
            principalLabel: card?.principalName || data.template.principalLabel,
          } : null);
          setReportCard(card);
        } else {
          setTemplate(data?.template || null);
          setReportCard(data?.reportCard || null);
        }
      } else if (!refresh) {
        console.warn('Report card fetch skipped', reportCardResult.reason);
        setTemplate(null);
        setReportCard(null);
      }

      if (studentResultsResult.status === 'fulfilled') {
        const payload = studentResultsResult.value;
        // Handle both old array format and new { success, data } format
        const studentResults = Array.isArray(payload) ? payload : (payload?.data || []);
        setPublishedResults(Array.isArray(studentResults) ? studentResults : []);
        setAcademicContext(payload?.academicContext || null);
      } else {
        console.warn('Student results fetch skipped', studentResultsResult.reason);
        if (refresh) setError('Unable to refresh exam results.');
        else {
          setPublishedResults([]);
          setAcademicContext(null);
        }
      }

      if (assignmentResult.status === 'fulfilled') {
        const payload = assignmentResult.value;
        const combinedResults = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.results)
            ? payload.results
            : Array.isArray(payload?.data)
              ? payload.data
              : [];
        setAssignmentResults(combinedResults.filter((result) => result?.resultType === 'assignment'));
      } else if (!refresh) {
        console.warn('Assignment results fetch skipped', assignmentResult.reason);
        setAssignmentResults([]);
      }

    } catch (err) {
      if (isStale()) return;
      console.error('Student results fetch error:', err);
      setError(err.message || 'Unable to load exam results');
      setReportCard(null);
      setPublishedResults([]);
      setAssignmentResults([]);
    } finally {
      if (!isStale()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isParent, studentId]);

  useEffect(() => {
    fetchExamWiseReport();
  }, [fetchExamWiseReport, location.key]);

  const examEntries = useMemo(
    () => buildFallbackPublishedCards(publishedResults),
    [publishedResults]
  );
  const entriesById = useMemo(
    () => new Map(examEntries.map((entry) => [String(entry.id), entry])),
    [examEntries]
  );
  const examCards = useMemo(
    () => examEntries.map((entry) => entry.card).filter(Boolean),
    [examEntries]
  );

  const overview = useMemo(() => {
    if (!examCards.length) {
      return { averagePercentage: 0, examsTaken: 0, topScore: null, recentExam: null };
    }
    const totalPercentage = examCards.reduce((sum, exam) => sum + toNumber(exam.percentage, 0), 0);
    const topScore = examCards.reduce(
      (best, exam) => (!best || toNumber(exam.percentage, 0) > toNumber(best.percentage, 0) ? exam : best),
      null
    );
    const examDateValue = (exam) => new Date(exam?.date || exam?.endDate || exam?.startDate || 0).getTime() || 0;
    const recentExam = examCards.reduce(
      (latest, exam) => (!latest || examDateValue(exam) > examDateValue(latest) ? exam : latest),
      null
    );
    return {
      averagePercentage: totalPercentage / examCards.length,
      examsTaken: examCards.length,
      topScore: topScore ? { percentage: toNumber(topScore.percentage, 0), examName: topScore.examName || 'Exam' } : null,
      recentExam: recentExam
        ? { examName: recentExam.examName || 'Exam', date: recentExam.date || recentExam.endDate || recentExam.startDate || null }
        : null,
    };
  }, [examCards]);

  const activeAcademicSession = String(academicContext?.activeSession || reportCard?.academicYear || '').trim();
  const effectiveExamGroups = useMemo(() => examEntries.map((entry) => entry.group), [examEntries]);

  const groupsWithSession = useMemo(
    () => effectiveExamGroups.map((g) => ({
      ...g,
      sessionLabel: deriveSessionLabel(g),
    })),
    [effectiveExamGroups]
  );

  const sessionOptions = useMemo(() => {
    const options = new Map();
    const addSession = (session, className) => {
      const key = sessionKey(session);
      if (!key) return;
      const option = options.get(key) || { key, label: String(session).trim(), classes: new Set() };
      const name = displayClassName(className);
      if (name) option.classes.add(name);
      options.set(key, option);
    };
    addSession(activeAcademicSession, academicContext?.className || reportCard?.grade);
    groupsWithSession.forEach(group => addSession(group.sessionLabel, group.className));
    academicContext?.history?.forEach(entry => addSession(entry.session, entry.className));
    return [...options.values()].map(option => ({
      key: option.key,
      label: [option.label, [...option.classes].join(', ')].filter(Boolean).join(' · '),
    }));
  }, [groupsWithSession, activeAcademicSession, academicContext, reportCard?.grade]);

  const defaultSession = sessionOptions[0]?.key;
  const selectedSessionKeys = useMemo(
    () => selectedSessions ?? (defaultSession ? [defaultSession] : []),
    [selectedSessions, defaultSession]
  );
  const selectedOptions = sessionOptions.filter(option => selectedSessionKeys.includes(option.key));

  const examOptionsForSession = useMemo(
    () => groupsWithSession.filter(group => selectedSessionKeys.includes(sessionKey(group.sessionLabel))),
    [groupsWithSession, selectedSessionKeys]
  );

  const filteredGroups = useMemo(
    () => examOptionsForSession.filter((g) => examFilter === 'all' || String(g._id) === String(examFilter)),
    [examOptionsForSession, examFilter]
  );

  const filteredCards = useMemo(
    () => filteredGroups
      .map((group) => entriesById.get(String(group._id))?.card)
      .filter(Boolean),
    [entriesById, filteredGroups]
  );

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / RESULTS_PAGE_SIZE));

  const pageGroups = useMemo(
    () => filteredGroups.slice((page - 1) * RESULTS_PAGE_SIZE, page * RESULTS_PAGE_SIZE),
    [filteredGroups, page]
  );

  useEffect(() => {
    setExamFilter('all');
    setPage(1);
  }, [selectedSessionKeys]);

  useEffect(() => {
    setPage(1);
  }, [examFilter]);

  const handleDownloadFor = async (group, rawReportCard) => {
    if (!rawReportCard) {
      toast.error('No report card available');
      return;
    }
    const id = String(group._id);
    setDownloadingId(id);
    try {
      await downloadSingleReportCardPdf({
        template,
        // The per-exam card is built from results only; the server report card
        // carries the profile photo, father's name and session attendance.
        reportCard: {
          ...rawReportCard,
          profilePic: rawReportCard.profilePic || reportCard?.profilePic || '',
          fatherName: rawReportCard.fatherName || reportCard?.fatherName || '',
          dob: rawReportCard.dob || reportCard?.dob || '',
          attendance: rawReportCard.attendance || reportCard?.attendance || null,
        },
        fileName: `report_card_${String(rawReportCard.studentName || 'student').replace(/\s+/g, '_')}_${String(group.title || 'exam').replace(/\s+/g, '_')}.pdf`,
      });
      toast.success('Report card downloaded');
    } catch (err) {
      toast.error(err.message || 'Failed to download report card');
    } finally {
      setDownloadingId('');
    }
  };

  const hasResults = examCards.length > 0;

  if (loading) {
    return (
      <div className="space-y-4 p-4 pb-24 md:pb-6">
        <div className="h-28 bg-gradient-to-r from-yellow-200 to-orange-200 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, idx) => (
            <div key={idx} className="h-24 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse" />
          ))}
        </div>
        <div className="bg-white rounded-xl h-48 border border-gray-100 animate-pulse" />
      </div>
    );
  }

  // ── selection: an exam id or 'assignments' ──────────────────────────
  const firstExamId = filteredGroups[0]?._id ? String(filteredGroups[0]._id) : null;
  const activePick = pick && (pick === 'assignments' ? assignmentResults.length > 0 : filteredGroups.some((g) => String(g._id) === pick))
    ? pick
    : (firstExamId || (assignmentResults.length ? 'assignments' : null));
  const activeGroup = activePick && activePick !== 'assignments' ? filteredGroups.find((g) => String(g._id) === activePick) : null;
  const activeEntry = activeGroup ? entriesById.get(String(activeGroup._id)) : null;

  const stats = [
    { label: 'Exams published', value: overview.examsTaken, icon: Award, tone: 'text-blue-600 bg-blue-50' },
    { label: 'Average score', value: hasResults ? `${overview.averagePercentage.toFixed(1)}%` : '—', icon: Target, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Best exam', value: overview.topScore ? `${parseFloat(overview.topScore.percentage)}%` : '—', sub: overview.topScore?.examName, icon: TrendingUp, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Assignments graded', value: assignmentResults.length, icon: CheckCircle2, tone: 'text-violet-600 bg-violet-50' },
  ];

  return (
    <div className="p-3 pb-24 md:p-4 md:pb-4">
      <div
        ref={shellRef}
        style={shellHeight ? { height: shellHeight } : undefined}
        className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        {/* ── Header strip ── */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><Trophy className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-bold leading-tight text-slate-900">My Results</h1>
            <p className="text-[12px] text-slate-500">Pick an exam on the left to see your marks for every subject.</p>
          </div>
          <div className="flex w-full max-w-full items-center gap-2 sm:w-auto">
            {sessionOptions.length > 0 && (
              <details className="relative min-w-0">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 focus-visible:outline-amber-500">
                  <span className="truncate">
                    {selectedOptions.length === 1 ? `Session ${selectedOptions[0].label}`
                      : selectedOptions.length > 1 ? `${selectedOptions.length} sessions selected` : 'Select sessions'}
                  </span>
                  <ChevronDown size={14} aria-hidden="true" className="shrink-0" />
                </summary>
                <fieldset className="absolute left-0 z-20 mt-2 max-h-56 w-64 max-w-[calc(100vw-4rem)] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg sm:left-auto sm:right-0">
                  <legend className="sr-only">Filter results by session</legend>
                  {sessionOptions.map(option => (
                    <label key={option.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <input type="checkbox" checked={selectedSessionKeys.includes(option.key)} className="accent-amber-600"
                        onChange={e => {
                          const checked = e.target.checked;
                          setSelectedSessions(previous => {
                            const keys = previous ?? selectedSessionKeys;
                            return checked ? [...new Set([...keys, option.key])] : keys.filter(key => key !== option.key);
                          });
                        }} />
                      {option.label}
                    </label>
                  ))}
                </fieldset>
              </details>
            )}
            <button type="button" onClick={() => fetchExamWiseReport(true)} disabled={refreshing}
              aria-label="Refresh results" aria-busy={refreshing} title="Refresh results"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60">
              <RefreshCw size={15} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── Stats row (divided by borders) ── */}
        <div className="grid shrink-0 grid-cols-2 divide-x divide-y divide-slate-200 border-b border-slate-200 md:grid-cols-4 md:divide-y-0">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3 px-4 py-3">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${s.tone}`}><s.icon className="size-4.5" /></span>
              <div className="min-w-0">
                <p className="text-[18px] font-bold leading-none text-slate-900">{s.value}</p>
                <p className="mt-1 truncate text-[11px] text-slate-500">{s.label}{s.sub ? ` · ${s.sub}` : ''}</p>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex shrink-0 items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2 text-[12.5px] text-red-700">
            <AlertCircle size={15} className="shrink-0" /> {error}
          </div>
        )}

        {/* ── Body: list | details ── */}
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          {/* left rail */}
          <aside className={`min-h-0 flex-col border-slate-200 lg:flex lg:border-r ${mobileDetail ? 'hidden' : 'flex'}`}>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              <p className="px-2 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Exams</p>
              {filteredGroups.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[12px] text-slate-500">No exam results published yet.</p>
              ) : filteredGroups.map((g) => {
                const card = entriesById.get(String(g._id))?.card;
                const pct = card ? toNumber(card.percentage, 0) : null;
                const active = activePick === String(g._id);
                return (
                  <button
                    key={g._id}
                    type="button"
                    onClick={() => { setPick(String(g._id)); setMobileDetail(true); }}
                    className={`relative mb-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${active ? 'bg-amber-50 ring-1 ring-amber-200' : 'hover:bg-slate-50'}`}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-amber-500" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-slate-900">{g.title || 'Exam'}</span>
                      <span className="block truncate text-[11px] text-slate-500">{g.sessionLabel}{card?.grade ? ` · Grade ${card.grade}` : ''}</span>
                    </span>
                    {pct !== null && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${pct >= 80 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{pct.toFixed(0)}%</span>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-slate-300" />
                  </button>
                );
              })}

              {assignmentResults.length > 0 && (
                <>
                  <p className="px-2 pb-1.5 pt-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Assignments</p>
                  <button
                    type="button"
                    onClick={() => { setPick('assignments'); setMobileDetail(true); }}
                    className={`relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${activePick === 'assignments' ? 'bg-violet-50 ring-1 ring-violet-200' : 'hover:bg-slate-50'}`}
                  >
                    {activePick === 'assignments' && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-violet-500" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-slate-900">Assignment marks</span>
                      <span className="block text-[11px] text-slate-500">Marks & feedback from teachers</span>
                    </span>
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">{assignmentResults.length}</span>
                    <ChevronRight className="size-4 shrink-0 text-slate-300" />
                  </button>
                </>
              )}
            </div>
          </aside>

          {/* right: details */}
          <section className={`min-h-0 flex-col lg:flex ${mobileDetail ? 'flex' : 'hidden'}`}>
            <button type="button" onClick={() => setMobileDetail(false)} className="m-3 mb-0 inline-flex items-center gap-1 self-start text-[12px] font-semibold text-amber-700 lg:hidden">
              <ChevronLeft className="size-4" /> All results
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              {!activePick ? (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                  <span className="flex size-16 items-center justify-center rounded-full bg-amber-50"><Trophy className="size-8 text-amber-300" /></span>
                  <p className="mt-3 text-[14px] font-semibold text-slate-800">No results yet</p>
                  <p className="mt-1 max-w-sm text-[12.5px] text-slate-500">When your school publishes exam results or your teachers grade assignments, they will show up here.</p>
                </div>
              ) : activePick === 'assignments' ? (
                <div>
                  <p className="mb-3 text-[14px] font-bold text-slate-900">Published Assignment Results</p>
                  <AssignmentResultsTable results={assignmentResults} />
                </div>
              ) : activeEntry?.card ? (
                <ExamCard
                  exam={activeEntry.card}
                  onDownload={() => handleDownloadFor(activeGroup, activeEntry.raw)}
                  downloadingReportCard={downloadingId === String(activeGroup._id)}
                  showDownload
                />
              ) : (
                <p className="rounded-xl bg-slate-50 p-6 text-center text-[12.5px] text-slate-500">No published result for {activeGroup?.title || 'this exam'}.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

// Assignment results as a simple table (one row per graded assignment).
const AssignmentResultsTable = ({ results = [] }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[12.5px]">
        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-12 px-3 py-2.5">Sl No</th>
            <th className="px-3 py-2.5">Assignment</th>
            <th className="px-3 py-2.5">Subject</th>
            <th className="px-3 py-2.5">Submitted</th>
            <th className="px-3 py-2.5">Marks</th>
            <th className="px-3 py-2.5">Teacher Feedback</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {results.map((result, idx) => {
            const obtained = toNumber(result?.obtainedMarks, 0);
            const total = toNumber(result?.totalMarks, 0);
            return (
              <tr key={result._id || idx} className="align-top transition hover:bg-slate-50/70">
                <td className="px-3 py-2.5 font-semibold text-slate-500">{idx + 1}</td>
                <td className="max-w-[200px] px-3 py-2.5"><p className="truncate font-semibold capitalize text-slate-900" title={result?.examName}>{result?.examName || 'Assignment'}</p></td>
                <td className="px-3 py-2.5"><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">{result?.subject || 'Assignment'}</span></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{result?.date ? formatDate(result.date) : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-500"><span className="font-bold text-slate-900">{obtained}</span> / {total} marks</td>
                <td className="max-w-[240px] px-3 py-2.5 text-slate-700">{result?.remarks ? <p className="line-clamp-2" title={result.remarks}>{result.remarks}</p> : <span className="text-slate-400">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

const AssignmentResultCard = ({ result }) => {
  const obtainedMarks = toNumber(result?.obtainedMarks, 0);
  const totalMarks = toNumber(result?.totalMarks, 0);
  const percentage = totalMarks > 0
    ? Math.round((obtainedMarks / totalMarks) * 100)
    : toNumber(result?.percentage, 0);
  const tier = scoreTier(percentage);
  const passed = String(result?.status || '').toLowerCase() === 'pass';
  const message = percentage >= 90 ? 'Excellent work!' : percentage >= 75 ? 'Great job!' : percentage >= 50 ? 'Good effort — keep going.' : 'Needs more practice.';

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* top: subject · title · date | score ring */}
      <div className="flex items-center gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-bold text-indigo-700">
            <BookOpen className="size-3" />{result?.subject || 'Assignment'}
          </span>
          <h3 className="mt-1.5 truncate text-[14px] font-bold capitalize text-slate-900" title={result?.examName}>
            {result?.examName || 'Assignment'}
          </h3>
          {result?.date && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
              <Calendar className="size-3" /> Submitted {formatDate(result.date)}
            </p>
          )}
        </div>
        <div className="relative flex size-16 shrink-0 items-center justify-center">
          <div className="absolute inset-0"><Ring pct={percentage} size={64} stroke={7} color={tier.ring} label="Score" /></div>
          <span className={`relative text-[14px] font-black ${tier.text}`}>{percentage}%</span>
        </div>
      </div>

      {/* middle: marks + progress */}
      <div className="border-t border-slate-100 px-3.5 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] text-slate-500">
            <span className={`text-[18px] font-black ${tier.text}`}>{obtainedMarks}</span> / {totalMarks} marks
          </p>
          <div className="flex items-center gap-1.5">
            {result?.grade && <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${tier.soft} ${tier.text}`}>Grade {result.grade}</span>}
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${passed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {passed ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
              {passed ? 'Pass' : 'Needs work'}
            </span>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <Motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className={`h-full rounded-full ${tier.bar}`} />
        </div>
        <p className="mt-1.5 text-[11px] font-medium text-slate-500">{message}</p>
      </div>

      {/* bottom: feedback */}
      {result?.remarks && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
          <p className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-indigo-600">💬 Teacher feedback</p>
          <p className="mt-0.5 text-[12.5px] italic leading-5 text-slate-700">{result.remarks}</p>
        </div>
      )}
    </article>
  );
};

const HeroMetric = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-white/20 bg-white/15 px-4 py-3 backdrop-blur-sm">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">{label}</p>
    <p className="mt-2 text-xl font-bold text-white">{value}</p>
    <p className="mt-1 text-[11px] text-white/75">{helper}</p>
  </div>
);

const InfoTile = ({ icon, title, copy }) => {
  const Icon = icon;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="inline-flex rounded-xl bg-amber-50 p-2 text-amber-600">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-6 text-slate-500">{copy}</p>
    </div>
  );
};

const SummaryCard = ({ icon, title, value, subtitle, grad, shadow }) => {
  const IconComponent = icon;
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-linear-to-br ${grad} p-3.5 shadow-lg ${shadow} transition-transform hover:-translate-y-0.5 md:p-4`}>
      <div className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold text-white/80">{title}</p>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <IconComponent className="h-4 w-4 text-white" />
          </div>
        </div>
        <p className="mt-1.5 text-lg font-black text-white leading-tight truncate md:text-xl">{value}</p>
        {subtitle && <p className="mt-1 text-[11px] text-white/70 truncate">{subtitle}</p>}
      </div>
    </div>
  );
};

const TermTimeline = ({ cards }) => {
  const data = [...cards]
    .sort((a, b) => new Date(a.date || a.startDate || 0) - new Date(b.date || b.startDate || 0))
    .map((c, index) => ({
      order: index + 1,
      name: c.examName || 'Exam',
      session: c.sessionLabel || 'Other',
      pct: Math.round(toNumber(c.percentage, 0)),
    }));

  const max = Math.max(...data.map((d) => d.pct), 1);

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 shadow-sm">
      <p className="text-sm font-black text-indigo-900 mb-4" id="exam-progress-heading">Exam-wise Progress</p>
      <div className="flex items-end gap-3 overflow-x-auto pb-2" role="group" aria-labelledby="exam-progress-heading">
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1 min-w-[56px]">
            {/* <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">#{d.order}</span> */}
            <span className="text-xs font-bold text-indigo-700">{d.pct}%</span>
            <Motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.round((d.pct / max) * 96)}px` }}
              transition={{ delay: i * 0.08, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              aria-hidden="true"
              className={`w-10 rounded-t-xl ${d.pct >= 80 ? 'bg-emerald-500' : d.pct >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
            />
            <span className="text-[10px] text-indigo-600/70 text-center leading-tight">{d.name}</span>
            <span className="text-[10px] text-indigo-500/80 text-center leading-tight">{d.session}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ExamCard = ({ exam, onDownload, downloadingReportCard, showDownload }) => {
  const percentage = toNumber(exam.percentage, 0);
  const tier = scoreTier(percentage);
  const hasSubjects = Array.isArray(exam.subjects) && exam.subjects.length > 0;
  const passed = String(exam.status).toLowerCase() === 'pass';
  const startDate = formatDate(exam.startDate);
  const endDate = formatDate(exam.endDate);
  const dateLabel = startDate && endDate
    ? `${startDate} \u2192 ${endDate}`
    : startDate || endDate || formatDate(exam.date);

  return (
    <article className={`@container w-full min-w-0 overflow-hidden rounded-2xl border border-t-4 border-slate-200 bg-white shadow-sm ${tier.border}`}>
      <div className={`grid ${hasSubjects ? '@2xl:grid-cols-[minmax(0,1fr)_minmax(14rem,0.65fr)]' : ''}`}>
        <div className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-4 p-4 sm:p-5">
          <div className="min-w-0 basis-28 grow space-y-3">
            <div>
              <h3 className="text-xl font-bold text-slate-950">{exam.examName || 'Exam'}</h3>
              <p className="mt-1 text-sm text-slate-600"><span className="font-medium">Session:</span> {exam.sessionLabel || 'Other'}</p>
              {dateLabel && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                  <Calendar size={14} aria-hidden="true" className="shrink-0" />
                  <span><span className="font-medium">Date:</span> {dateLabel}</span>
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatPill label="Total" value={exam.totalMarks ?? 0} />
              <StatPill label="Obtained" value={exam.obtainedMarks ?? 0} highlight={tier.text} />
              {exam.status && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${passed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                  {passed ? <CheckCircle2 size={13} aria-hidden="true" /> : <XCircle size={13} aria-hidden="true" />}
                  {exam.status}
                </span>
              )}
            </div>
            {exam.remarks && (
              <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="text-xs font-semibold">Result</p>
                <p className="mt-0.5">{exam.remarks}</p>
              </div>
            )}
          </div>
          <div className="flex max-w-full flex-col items-center gap-2">
            <div className="relative shrink-0">
              <Ring pct={percentage} color={tier.ring} size={104} stroke={10} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span aria-hidden="true" className={`text-xl font-bold tabular-nums ${tier.text}`}>{percentage.toFixed(0)}%</span>
                {exam.grade && <span className={`text-sm font-semibold ${tier.text}`}><span className="sr-only">Grade </span>{exam.grade}</span>}
              </div>
            </div>
            {showDownload && (
              <button type="button" onClick={onDownload} disabled={downloadingReportCard}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60">
                <Download size={15} aria-hidden="true" />
                {downloadingReportCard ? 'Downloading...' : 'Download'}
              </button>
            )}
          </div>
        </div>

        {hasSubjects && (
          <section className="min-w-0 border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 @2xl:border-t-0 @2xl:border-l">
            <h4 className="text-sm font-semibold text-slate-900">Subject Breakdown ({exam.subjects.length})</h4>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs text-slate-600">
                  <tr>
                    <th scope="col" className="px-3 py-2">Subject</th>
                    <th scope="col" className="px-3 py-2 text-right">Marks</th>
                    <th scope="col" className="px-3 py-2 text-right">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exam.subjects.map((subject, idx) => {
                    const max = toNumber(subject.maxMarks, 0);
                    const marks = toNumber(subject.marks, 0);
                    return (
                      <tr key={`${subject.name}-${idx}`}>
                        <th scope="row" className="break-words px-3 py-3 font-medium text-slate-800">{subject.name || 'Subject'}</th>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-slate-700">
                          {marks}{max ? `/${max}` : ''}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {subject.grade ? (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${gradeColor(subject.grade)}`}>{subject.grade}</span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </article>
  );
};

const StatPill = ({ label, value, highlight }) => (
  <span className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1">
    <span className="text-gray-400">{label}:</span>
    <span className={`font-semibold ${highlight || 'text-gray-700'}`}>{value}</span>
  </span>
);

const gradeColor = (grade = '') => {
  if (String(grade).startsWith('A')) return 'bg-green-600 text-white';
  if (String(grade).startsWith('B')) return 'bg-blue-500 text-white';
  if (String(grade).startsWith('C')) return 'bg-yellow-500 text-white';
  return 'bg-gray-500 text-white';
};

export default ResultsView;
