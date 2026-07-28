import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  TrendingUp,
  TrendingDown,
  Download,
  Target,
  Calendar,
  Trophy,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  GraduationCap,
  ShieldCheck,
  BookOpen,
  Search,
  Medal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { downloadSingleReportCardPdf } from '../utils/reportCardPdf';
import { fetchCachedJson } from '../utils/studentApiCache';
import PostExamFeedbackView from './PostExamFeedbackView';

const API_BASE = import.meta.env.VITE_API_URL || '';
const RESULTS_CACHE_TTL_MS = 2 * 60 * 1000;

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
};

/* SVG circular progress ring — mirrors the attendance ring on the dashboard */
const Ring = ({ pct = 0, size = 104, stroke = 10, color = '#10b981', bg = '#e5e7eb' }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
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

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-sky-500', 'bg-violet-500', 'bg-fuchsia-500',
  'bg-teal-500', 'bg-orange-500', 'bg-pink-500', 'bg-blue-500',
];

const RESULTS_PAGE_SIZE = 5;

// ExamGroup has no explicit session/academic-year field, so the session label is
// derived from its start date assuming an Apr–Mar academic year (e.g. "2024-2025").
const deriveSessionLabel = (group) => {
  const raw = group?.startDate || group?.endDate;
  if (!raw) return 'Other';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return 'Other';
  const year = parsed.getFullYear();
  const startYear = parsed.getMonth() < 3 ? year - 1 : year;
  return `${startYear}-${startYear + 1}`;
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
        startDate: exam?.date || result?.createdAt || null,
        endDate: exam?.date || result?.createdAt || null,
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
      totalObtained: 0,
      totalMarks: 0,
      latestDate: result?.createdAt || exam?.date || null,
    };

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
        group: entry.group,
        raw: rawReportCard,
        card: buildExamCardFromReport(rawReportCard, entry.group, metaMap.get(entry.group._id) || {}),
      };
    })
    .sort((a, b) => {
      const d1 = new Date(a.raw?.generatedAt || a.group?.startDate || 0).getTime();
      const d2 = new Date(b.raw?.generatedAt || b.group?.startDate || 0).getTime();
      return d2 - d1;
    });
};

const ResultsView = () => {
  const [template, setTemplate] = useState(null);
  const [reportCard, setReportCard] = useState(null);
  const [publishedResults, setPublishedResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sessionFilter, setSessionFilter] = useState('all');
  const [examFilter, setExamFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState('');

  const fetchExamWiseReport = useCallback(async () => {
    const token = localStorage.getItem('token');
    const userType = localStorage.getItem('userType');
    if (!token || userType !== 'Student') {
      setError('Please login as student to view results.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const reportCardEndpoint = `${API_BASE}/api/reports/report-cards/me`;
      const resultsEndpoint = `${API_BASE}/api/exam/results/me`;

      const [reportCardResult, studentResultsResult] = await Promise.allSettled([
        fetchCachedJson(reportCardEndpoint, {
          ttlMs: RESULTS_CACHE_TTL_MS,
          forceRefresh: true,
          fetchOptions: {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        }),
        fetchCachedJson(resultsEndpoint, {
          ttlMs: RESULTS_CACHE_TTL_MS,
          forceRefresh: true,
          fetchOptions: {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        }),
      ]);

      // Template + academic-year badge only — the results list itself is driven
      // entirely by the student's own published results below, so it naturally
      // spans every session/exam the student has ever had, not just the one
      // exam group the report-card endpoint happens to resolve.
      if (reportCardResult.status === 'fulfilled') {
        const data = reportCardResult.value?.data || {};
        setTemplate(data?.template || null);
        setReportCard(data?.reportCard || null);
      } else {
        console.warn('Report card fetch skipped', reportCardResult.reason);
        setTemplate(null);
        setReportCard(null);
      }

      if (studentResultsResult.status === 'fulfilled') {
        const payload = studentResultsResult.value;
        // Handle both old array format and new { success, data } format
        const studentResults = Array.isArray(payload) ? payload : (payload?.data || []);
        setPublishedResults(Array.isArray(studentResults) ? studentResults : []);
      } else {
        console.warn('Student results fetch skipped', studentResultsResult.reason);
        setPublishedResults([]);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Student results fetch error:', err);
      setError(err.message || 'Unable to load exam results');
      setReportCard(null);
      setPublishedResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExamWiseReport();
  }, [fetchExamWiseReport]);

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

  const activeAcademicSession = String(reportCard?.academicYear || '').trim();
  const effectiveExamGroups = useMemo(() => examEntries.map((entry) => entry.group), [examEntries]);

  const groupsWithSession = useMemo(
    () => effectiveExamGroups.map((g) => ({
      ...g,
      sessionLabel: deriveSessionLabel(g),
    })),
    [effectiveExamGroups]
  );

  const sessionOptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    if (activeAcademicSession) {
      seen.add(activeAcademicSession);
      list.push(activeAcademicSession);
    }
    groupsWithSession.forEach((g) => {
      if (!seen.has(g.sessionLabel)) {
        seen.add(g.sessionLabel);
        list.push(g.sessionLabel);
      }
    });
    return list;
  }, [groupsWithSession, activeAcademicSession]);

  const examOptionsForSession = useMemo(
    () => groupsWithSession.filter((g) => sessionFilter === 'all' || g.sessionLabel === sessionFilter),
    [groupsWithSession, sessionFilter]
  );

  const filteredGroups = useMemo(
    () => examOptionsForSession.filter((g) => examFilter === 'all' || String(g._id) === String(examFilter)),
    [examOptionsForSession, examFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / RESULTS_PAGE_SIZE));

  const pageGroups = useMemo(
    () => filteredGroups.slice((page - 1) * RESULTS_PAGE_SIZE, page * RESULTS_PAGE_SIZE),
    [filteredGroups, page]
  );

  useEffect(() => {
    setExamFilter('all');
    setPage(1);
  }, [sessionFilter]);

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
        reportCard: rawReportCard,
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

  return (
    <div className="space-y-5 bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.14),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.12),_transparent_26%),linear-gradient(180deg,_#fffaf3_0%,_#f8fafc_100%)] p-3 pb-24 md:p-4 md:pb-6">
      {/* <div className="relative overflow-hidden rounded-[28px] border border-amber-200/70 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 p-5 text-white shadow-[0_28px_80px_-45px_rgba(249,115,22,0.65)] md:p-7">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-white/40 blur-3xl" />
          <div className="absolute -left-12 bottom-0 h-32 w-32 rounded-full bg-yellow-100/50 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90">
              <Sparkles className="h-3.5 w-3.5" />
              Academic Progress
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Trophy className="h-7 w-7 text-amber-100" />
              <h1 className="text-2xl font-bold tracking-tight md:text-4xl">My Results</h1>
            </div>
            <p className="mt-2 text-sm leading-6 text-amber-50/95 md:text-base">
              Track your published exam performance, review subject-wise marks, and download the official report card when it becomes available.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[430px]">
            <HeroMetric
              label="Average"
              value={`${overview.averagePercentage.toFixed(1)}%`}
              helper={hasResults ? 'Across published exams' : 'Waiting for first result'}
            />
            <HeroMetric
              label="Published"
              value={overview.examsTaken}
              helper={overview.examsTaken === 1 ? 'Exam available' : 'Exams available'}
            />
            <HeroMetric
              label="Updated"
              value={lastUpdated ? lastUpdated.toLocaleDateString() : 'Today'}
              helper="Latest sync"
            />
          </div>
        </div>
      </div> */}
      <h1 className='text-4xl font-bold pl-2'>My Results</h1>
      {activeAcademicSession && (
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />
          Active Session: {activeAcademicSession}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard
          icon={Award}
          title="Published Exams"
          value={overview.examsTaken}
          subtitle={hasResults ? 'Results available now' : 'No published records yet'}
          grad="from-blue-500 to-indigo-600"
          shadow="shadow-blue-200/60"
        />
        <SummaryCard
          icon={TrendingUp}
          title="Best Exam"
          value={overview.topScore ? `${parseFloat(overview.topScore.percentage)}%` : 'N/A'}
          subtitle={overview.topScore?.examName || 'Awaiting published result'}
          grad="from-emerald-500 to-teal-600"
          shadow="shadow-emerald-200/60"
        />
        <SummaryCard
          icon={Target}
          title="Average Score"
          value={`${parseFloat(overview.averagePercentage)}%`}
          subtitle={hasResults ? 'Current published average' : 'Will appear after first result'}
          grad="from-amber-400 to-orange-500"
          shadow="shadow-amber-200/60"
        />
        <SummaryCard
          icon={Calendar}
          title="Latest Exam"
          value={overview.recentExam?.examName || 'Not available'}
          subtitle={overview.recentExam?.date ? formatDate(overview.recentExam.date) : 'No exam published'}
          grad="from-purple-500 to-fuchsia-600"
          shadow="shadow-purple-200/60"
        />
      </div>

      {/* Term-wise Progress Timeline */}
      {examCards.length >= 2 && (
        <TermTimeline cards={examCards} />
      )}

      {effectiveExamGroups.length === 0 ? (
        <div className="overflow-hidden rounded-[28px] border border-dashed border-amber-200 bg-white shadow-[0_18px_45px_-38px_rgba(15,23,42,0.35)]">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="border-b border-amber-100 bg-[linear-gradient(135deg,_rgba(254,243,199,0.55),_rgba(255,255,255,0.95))] p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Awaiting Publication
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Results have not been published yet</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                Your school has not released an exam result for this term yet. Once marks are published, this page will automatically show your overall percentage, subject breakdown, grade, and downloadable report card.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <InfoTile
                  icon={GraduationCap}
                  title="What will appear here"
                  copy="Exam name, marks, grade, pass or fail status, and subject-wise performance."
                />
                <InfoTile
                  icon={BookOpen}
                  title="What to do now"
                  copy="Check with your class teacher or school noticeboard if you expected a published result already."
                />
              </div>
            </div>

            <div className="flex flex-col justify-center bg-slate-50/80 p-6 sm:p-8">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
                <Trophy className="h-10 w-10 text-amber-300" />
              </div>
              <p className="mt-5 text-center text-sm font-semibold text-slate-700">
                Nothing is missing from your account right now.
              </p>
              <p className="mt-2 text-center text-sm leading-6 text-slate-500">
                This section will update as soon as the school publishes your exam record.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Search className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Find a Result</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Session</label>
                <select
                  value={sessionFilter}
                  onChange={(e) => setSessionFilter(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="all">All Sessions</option>
                  {sessionOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Exam</label>
                <select
                  value={examFilter}
                  onChange={(e) => setExamFilter(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="all">All Exams</option>
                  {examOptionsForSession.map((g) => (
                    <option key={g._id} value={g._id}>{g.title || 'Exam'}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-4 flex flex-wrap justify-center gap-4">
            {filteredGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                No exams match this filter.
              </div>
            ) : (
              pageGroups.map((g) => {
                const entry = entriesById.get(String(g._id));
                if (!entry?.card) {
                  return (
                    <div key={g._id} className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                      No published result for {g.title || 'this exam'}.
                    </div>
                  );
                }
                return (
                  <ExamCard
                    key={g._id}
                    exam={entry.card}
                    onDownload={() => handleDownloadFor(g, entry.raw)}
                    downloadingReportCard={downloadingId === String(g._id)}
                    showDownload
                  />
                );
              })
            )}

            {filteredGroups.length > RESULTS_PAGE_SIZE && (
              <div className="flex items-center justify-center gap-1.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPage(idx + 1)}
                    className={`h-8 min-w-8 rounded-lg px-2.5 text-xs font-bold transition-colors ${page === idx + 1
                      ? 'bg-linear-to-r from-indigo-500 to-purple-600 text-white shadow-sm'
                      : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
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
    .map((c) => ({ name: (c.examName || 'Exam').slice(0, 14), pct: Math.round(toNumber(c.percentage, 0)) }));

  const max = Math.max(...data.map((d) => d.pct), 1);

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 shadow-sm">
      <p className="text-sm font-black text-indigo-900 mb-4">Term-wise Progress</p>
      <div className="flex items-end gap-3 overflow-x-auto pb-2">
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1 min-w-[56px]">
            <span className="text-xs font-bold text-indigo-700">{d.pct}%</span>
            <Motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.round((d.pct / max) * 96)}px` }}
              transition={{ delay: i * 0.08, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className={`w-10 rounded-t-xl ${d.pct >= 80 ? 'bg-emerald-500' : d.pct >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
            />
            <span className="text-[10px] text-indigo-600/70 text-center leading-tight">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ExamCard = ({ exam, onDownload, downloadingReportCard, showDownload }) => {
  const [expanded, setExpanded] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const percentage = toNumber(exam.percentage, 0);
  const tier = scoreTier(percentage);
  const hasSubjects = Array.isArray(exam.subjects) && exam.subjects.length > 0;
  const delta = exam.delta;
  const rank = exam.rank;
  const percentile = exam.percentile;
  const classSize = exam.classSize;

  return (
    <div className={`w-full sm:w-[49%] bg-white rounded-2xl shadow-sm border border-gray-200 border-t-4 self-start ${tier.border} overflow-hidden`}>
      <div className="p-4 md:p-5">
        {/* <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 leading-snug">{exam.examName || 'Exam'}</h3>
            {(exam.startDate || exam.endDate) ? (
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1.5">
                <Calendar size={11} />
                {formatDate(exam.startDate) || '-'} - {formatDate(exam.endDate) || '-'}
              </div>
            ) : exam.date && (
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1.5">
                <Calendar size={11} />
                {formatDate(exam.date)}
              </div>
            )}

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <StatPill label="Total" value={exam.totalMarks ?? 0} />
              <StatPill label="Obtained" value={exam.obtainedMarks ?? 0} highlight={tier.text} />
              {rank && <StatPill label="Rank" value={`#${rank}${classSize ? `/${classSize}` : ''}`} highlight="text-indigo-600" />}
              {percentile != null && <StatPill label="Percentile" value={`${percentile}%ile`} highlight={percentile >= 75 ? 'text-emerald-600' : 'text-amber-600'} />}
              {delta != null && (
                <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full
                  ${delta > 0 ? 'bg-emerald-50 text-emerald-700' : delta < 0 ? 'bg-rose-50 text-rose-600' : 'bg-gray-50 text-gray-500'}`}>
                  {delta > 0 ? <TrendingUp size={11} /> : delta < 0 ? <TrendingDown size={11} /> : null}
                  {delta > 0 ? `+${delta}%` : `${delta}%`} vs prev
                </span>
              )}
              {exam.status && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                    String(exam.status).toLowerCase() === 'pass' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                  }`}
                >
                  {String(exam.status).toLowerCase() === 'pass' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                  {exam.status}
                </span>
              )}
            </div>

            {exam.remarks && (
              <div className="w-auto mt-3 p-3 rounded-xl border-l-4 bg-amber-50 border-amber-400">
                <p className="text-xs font-semibold mb-0.5 text-amber-900">Result</p>
                <p className="text-xs leading-relaxed text-amber-800">{exam.remarks}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              {showDownload && (
                <button
                  type="button"
                  onClick={onDownload}
                  disabled={downloadingReportCard}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-linear-to-r from-indigo-500 to-purple-600 rounded-full px-3.5 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm shadow-indigo-200"
                >
                  <Download size={12} />
                  {downloadingReportCard ? 'Downloading...' : 'Download Grade Card'}
                </button>
              )}
              <button
                onClick={() => setShowFeedback((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3.5 py-1.5 hover:bg-indigo-100 transition-colors"
              >
                <Sparkles size={12} /> AI Feedback
              </button>
            </div>
          </div>

          <div className="relative shrink-0 flex items-center justify-center">
            <Ring pct={percentage} color={tier.ring} size={104} stroke={10} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className={`text-xl font-black leading-none ${tier.text}`}>
                {percentage.toFixed(0)}<span className="text-xs font-semibold">%</span>
              </p>
              {exam.grade && <p className={`mt-1 text-xs font-bold ${tier.text}`}>{exam.grade}</p>}
            </div>
          </div>
        </div> */}
        <div>
          <div className="text-center">
            <h3 className="text-base md:text-lg font-extrabold text-gray-900 leading-snug">{exam.examName || 'Exam'}</h3>
            {(exam.startDate || exam.endDate) ? (
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1.5 justify-center">
                <Calendar size={11} /> 
                <span className='font-bold text-gray-500'>Date: </span>
                {formatDate(exam.startDate) || '-'} → {formatDate(exam.endDate) || '-'}
              </div>
            ) : exam.date && (
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1.5 justify-center">
                <Calendar size={11} />
                <span className='font-bold text-gray-500'>Date: </span>
                {formatDate(exam.date)}
              </div>
            )}
          </div>
          <div className='flex justify-between items-center gap-4 md:gap-0'>
            <div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <StatPill label="Total" value={exam.totalMarks ?? 0} />
                <StatPill label="Obtained" value={exam.obtainedMarks ?? 0} highlight={tier.text} />
                {exam.status && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${String(exam.status).toLowerCase() === 'pass' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                      }`}
                  >
                    {String(exam.status).toLowerCase() === 'pass' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                    {exam.status}
                  </span>
                )}
              </div>
              {exam.remarks && (
                <div className="w-auto mt-3 p-3 rounded-xl border-l-4 bg-amber-50 border-amber-400">
                  <p className="text-xs font-semibold mb-0.5 text-amber-900">Result</p>
                  <p className="text-xs leading-relaxed text-amber-800">{exam.remarks}</p>
                </div>
              )}
            </div>
            <div>
              <div className="relative shrink-0 flex items-center justify-center">
                <Ring pct={percentage} color={tier.ring} size={104} stroke={10} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className={`text-xl font-black leading-none ${tier.text}`}>
                    {percentage.toFixed(0)}<span className="text-xs font-semibold">%</span>
                  </p>
                  {exam.grade && <p className={`mt-1 text-xs font-bold ${tier.text}`}>{exam.grade}</p>}
                </div>
              </div>
              {showDownload && (
              <button
                type="button"
                onClick={onDownload}
                disabled={downloadingReportCard}
                className="mt-3 flex items-center gap-1.5 text-[7px] md:text-xs font-semibold text-white bg-linear-to-r from-indigo-500 to-purple-600 rounded-full px-3.5 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm shadow-indigo-200"
              >
                <Download size={12} />
                {downloadingReportCard ? 'Downloading...' : 'Download Grade Card'}
              </button>
            )}
            </div>
          </div>
        </div>
      </div>

      {hasSubjects && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium border-t border-gray-100 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <span>Subject Breakdown ({exam.subjects.length})</span>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {expanded && (
            <div className="divide-y divide-gray-50">
              {exam.subjects.map((subject, idx) => {
                const subjMax = toNumber(subject.maxMarks, 0);
                const subjMarks = toNumber(subject.marks, 0);
                const subjPct = subjMax > 0 ? Math.min(100, (subjMarks / subjMax) * 100) : 0;
                const subjTier = scoreTier(subjPct);
                const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                return (
                  <div key={`${subject.name}-${idx}`} className="px-4 py-3 flex items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white text-sm font-bold ${avatarColor}`}>
                      {(subject.name || 'S').trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{subject.name || 'Subject'}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-gray-700">
                            {subjMarks}
                            {subjMax ? `/${subjMax}` : ''}
                          </span>
                          {subject.grade && (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${gradeColor(subject.grade)}`}>
                              {subject.grade}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full rounded-full ${subjTier.bar}`} style={{ width: `${subjPct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {showFeedback && (
          <Motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <PostExamFeedbackView
              subject={exam.subject || exam.examName || ''}
              marksScored={exam.obtainedMarks}
              totalMarks={exam.totalMarks}
              examTitle={exam.examName}
              onClose={() => setShowFeedback(false)}
            />
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StatPill = ({ label, value, highlight }) => (
  <span className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1">
    <span className="text-gray-400">{label}:</span>
    <span className={`font-semibold ${highlight || 'text-gray-700'}`}>{value}</span>
  </span>
);

const gradeColor = (grade = '') => {
  if (String(grade).startsWith('A')) return 'bg-green-100 text-green-700';
  if (String(grade).startsWith('B')) return 'bg-blue-100 text-blue-700';
  if (String(grade).startsWith('C')) return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-700';
};

export default ResultsView;
