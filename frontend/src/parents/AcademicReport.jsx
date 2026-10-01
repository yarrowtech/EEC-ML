import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  BookOpen,
  CalendarDays,
  Download,
  FileText,
  Info,
  Loader2,
  Medal,
  Star,
  Trophy,
  User,
  MessageSquareText,
  ChevronDown,
  Calculator,
  FlaskConical,
  Globe2,
  Landmark,
  Monitor,
  Palette,
  Languages,
  GraduationCap,
  MousePointerClick,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

import { downloadGradeCardPdf } from '../utils/gradeCardPdf';
import { normalizeReportCard } from './reportCardShape';
import { parentApiJson } from './parentApi';

import ChildSwitcher, {
  useSharedChildSelection,
} from './ChildSwitcher';

import Loading from './Loading';
import useParentChildren from './useParentChildren';
import { EmptyState, ErrorState } from './StateBlock';

/* ========================================================================= */
/* Helpers                                                                   */
/* ========================================================================= */

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const calculatePercentage = (obtained, total) => {
  const obtainedMarks = safeNumber(obtained);
  const totalMarks = safeNumber(total);

  if (totalMarks <= 0) return 0;

  return Number(
    ((obtainedMarks / totalMarks) * 100).toFixed(1)
  );
};

const getGradeFromPercentage = (percentage) => {
  const value = safeNumber(percentage);

  if (value >= 90) return 'A+';
  if (value >= 80) return 'A';
  if (value >= 70) return 'B+';
  if (value >= 60) return 'B';
  if (value >= 50) return 'C';
  if (value >= 40) return 'D';

  return 'F';
};

const getGradeDescription = (grade) => {
  const normalized = String(grade || '')
    .trim()
    .toUpperCase();

  const map = {
    'A+': 'Outstanding',
    A: 'Excellent',
    'B+': 'Very Good',
    B: 'Good',
    C: 'Satisfactory',
    D: 'Needs Improvement',
    F: 'Needs Improvement',
  };

  return map[normalized] || '—';
};

const getGradeClass = (grade) => {
  const normalized = String(grade || '')
    .trim()
    .toUpperCase();

  if (normalized === 'A+' || normalized === 'A') {
    return 'border-emerald-100 bg-emerald-50 text-emerald-600';
  }

  if (
    normalized === 'B+' ||
    normalized === 'B'
  ) {
    return 'border-violet-100 bg-violet-50 text-violet-600';
  }

  if (normalized === 'C') {
    return 'border-amber-100 bg-amber-50 text-amber-600';
  }

  if (normalized === 'D') {
    return 'border-orange-100 bg-orange-50 text-orange-600';
  }

  return 'border-rose-100 bg-rose-50 text-rose-600';
};

const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatShortMonth = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
};

const formatExamDate = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/* ========================================================================= */
/* Subject icon                                                              */
/* ========================================================================= */

const getSubjectIcon = (subject) => {
  const name = String(subject || '').toLowerCase();

  if (
    name.includes('computer') ||
    name.includes('ict') ||
    name.includes('information')
  ) {
    return Monitor;
  }

  if (
    name.includes('drawing') ||
    name.includes('art') ||
    name.includes('craft')
  ) {
    return Palette;
  }

  if (
    name.includes('science') ||
    name.includes('physics') ||
    name.includes('chemistry') ||
    name.includes('biology')
  ) {
    return FlaskConical;
  }

  if (name.includes('geography')) {
    return Globe2;
  }

  if (
    name.includes('history') ||
    name.includes('civics') ||
    name.includes('social')
  ) {
    return Landmark;
  }

  if (
    name.includes('math') ||
    name.includes('mathematics')
  ) {
    return Calculator;
  }

  if (
    name.includes('bengali') ||
    name.includes('english') ||
    name.includes('language')
  ) {
    return Languages;
  }

  return BookOpen;
};

const getSubjectIconClass = (subject) => {
  const name = String(subject || '').toLowerCase();

  if (
    name.includes('computer') ||
    name.includes('ict')
  ) {
    return 'bg-blue-50 text-blue-500';
  }

  if (
    name.includes('drawing') ||
    name.includes('art')
  ) {
    return 'bg-violet-50 text-violet-500';
  }

  if (
    name.includes('science') ||
    name.includes('physics') ||
    name.includes('chemistry') ||
    name.includes('biology')
  ) {
    return 'bg-emerald-50 text-emerald-500';
  }

  if (name.includes('geography')) {
    return 'bg-amber-50 text-amber-500';
  }

  if (
    name.includes('history') ||
    name.includes('civics') ||
    name.includes('social')
  ) {
    return 'bg-purple-50 text-purple-500';
  }

  if (
    name.includes('math') ||
    name.includes('mathematics')
  ) {
    return 'bg-blue-50 text-blue-500';
  }

  return 'bg-rose-50 text-rose-500';
};

/* ========================================================================= */
/* Build exam groups                                                         */
/* ========================================================================= */

/*
 * Your API currently exposes `selectedReport.exams`.
 *
 * Each item is assumed to look approximately like:
 *
 * {
 *   examName,
 *   subject,
 *   term,
 *   date,
 *   obtainedMarks,
 *   totalMarks,
 *   percentage,
 *   grade,
 *   remarks
 * }
 *
 * We group these subject records into individual examinations.
 */

const buildExamGroups = (report) => {
  if (!report) return [];

  const exams = Array.isArray(report.exams)
    ? report.exams
    : [];

  const groups = new Map();

  exams.forEach((exam, index) => {
    // Show only results the school has published.
    if (exam?.published === false || exam?.isPublished === false) return;
    if (/^(draft|pending|unpublished)$/i.test(String(exam?.status || ''))) return;

    const examName =
      String(
        exam?.examName ||
          exam?.exam ||
          exam?.assessmentName ||
          'Examination'
      ).trim();

    const term =
      String(
        exam?.term ||
          exam?.termName ||
          ''
      ).trim();

    const key = `${examName}__${term}`;

    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        examName,
        term,
        date:
          exam?.date ||
          exam?.examDate ||
          exam?.publishedAt ||
          null,
        subjects: [],
        sourceIndexes: [],
      });
    }

    const group = groups.get(key);

    group.subjects.push(exam);
    group.sourceIndexes.push(index);

    if (
      !group.date &&
      (exam?.date || exam?.examDate)
    ) {
      group.date =
        exam.date ||
        exam.examDate;
    }
  });

  return Array.from(groups.values())
    .map((group) => {
      let obtained = 0;
      let total = 0;

      group.subjects.forEach((subject) => {
        obtained += safeNumber(
          subject?.obtainedMarks
        );

        total += safeNumber(
          subject?.totalMarks
        );
      });

      const percentage =
        calculatePercentage(
          obtained,
          total
        );

      const firstSubject =
        group.subjects[0] || {};

      const grade =
        firstSubject?.examGrade ||
        firstSubject?.overallGrade ||
        group?.grade ||
        getGradeFromPercentage(
          percentage
        );

      return {
        ...group,
        obtainedMarks: obtained,
        totalMarks: total,
        percentage,
        grade,
      };
    })
    .filter((group) => group.totalMarks > 0)
    // Latest exam first.
    .sort((a, b) => {
      const dateA = a.date
        ? new Date(a.date).getTime()
        : 0;

      const dateB = b.date
        ? new Date(b.date).getTime()
        : 0;

      return dateB - dateA;
    });
};

/* ========================================================================= */
/* Main component                                                            */
/* ========================================================================= */

// Client cache (memory + sessionStorage, per login) → instant repeat visits.
const REPORT_CACHE_MAX_AGE = 10 * 60 * 1000;
const reportCacheKey = () => {
  let t = '';
  try { t = localStorage.getItem('token') || ''; } catch { /* ignore */ }
  return `parent:report-cards:v1:${t.slice(-16)}`;
};
let reportMemCache = null;
const readReportCache = () => {
  const key = reportCacheKey();
  let entry = reportMemCache?.key === key ? reportMemCache : null;
  if (!entry) { try { entry = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { entry = null; } }
  return entry && Date.now() - entry.at < REPORT_CACHE_MAX_AGE ? entry.data : null;
};
const writeReportCache = (data) => {
  reportMemCache = { key: reportCacheKey(), at: Date.now(), data };
  try { sessionStorage.setItem(reportMemCache.key, JSON.stringify(reportMemCache)); } catch { /* quota */ }
};

const RISE = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } };

const AcademicReport = () => {
  const navigate = useNavigate();

  const [reportCards, setReportCards] =
    useState(() => (readReportCache()?.reportCards || []).map(normalizeReportCard));

  const [template, setTemplate] =
    useState(() => readReportCache()?.template || null);

  const [loading, setLoading] =
    useState(() => !readReportCache());

  const [error, setError] =
    useState('');

  const [isExporting, setIsExporting] =
    useState(false);

  const [selectedExamId, setSelectedExamId] =
    useState('');

  /* ----------------------------------------------------------------------- */
  /* Children                                                                */
  /* ----------------------------------------------------------------------- */

  const childOptions = useMemo(
    () =>
      reportCards.map((card) => ({
        id: String(
          card.studentId || ''
        ),

        name:
          card.studentName ||
          'Student',
      })),
    [reportCards]
  );

  const [
    childKey,
    setChildKey,
    selectedOption,
  ] = useSharedChildSelection(
    childOptions
  );

  const selectedStudentId =
    selectedOption?.id || '';

  // Photo from the child's profile (report cards don't always carry it).
  const { children: profileChildren, parent: profileParent } = useParentChildren();

  /* ----------------------------------------------------------------------- */
  /* Fetch data                                                              */
  /* ----------------------------------------------------------------------- */

  useEffect(() => {
    const fetchRealData = async () => {
      if (!localStorage.getItem('token')) {
        setError(
          'Please login to view academic reports.'
        );

        setLoading(false);
        return;
      }

      const cached = readReportCache();
      if (!cached) setLoading(true);
      setError('');

      try {
        const data =
          await parentApiJson(
            '/api/reports/report-cards/parent',
            {},
            navigate
          );

        const cards = (
          Array.isArray(
            data?.reportCards
          )
            ? data.reportCards
            : []
        ).map(normalizeReportCard);

        setReportCards(cards);
        setTemplate(
          data?.template || null
        );
        writeReportCache({ reportCards: data?.reportCards || [], template: data?.template || null });
      } catch (err) {
        if (!cached) setError(
          err?.message ||
            'Unable to load academic report'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRealData();
  }, [navigate]);

  /* ----------------------------------------------------------------------- */
  /* Selected report                                                         */
  /* ----------------------------------------------------------------------- */

  const selectedReport = useMemo(
    () =>
      reportCards.find(
        (card) =>
          String(card.studentId) ===
          String(selectedStudentId)
      ) || null,

    [
      reportCards,
      selectedStudentId,
    ]
  );

  const childPhoto =
    selectedReport?.profilePic ||
    profileChildren.find((c) => String(c.id) === String(selectedReport?.studentId))?.photo ||
    '';

  /* ----------------------------------------------------------------------- */
  /* Exam groups                                                             */
  /* ----------------------------------------------------------------------- */

  const examGroups = useMemo(
    () =>
      buildExamGroups(
        selectedReport
      ),
    [selectedReport]
  );

  /* ----------------------------------------------------------------------- */
  /* Default exam                                                            */
  /* ----------------------------------------------------------------------- */

  useEffect(() => {
    if (!examGroups.length) {
      setSelectedExamId('');
      return;
    }

    /*
     * Open the latest published report first.
     */

    const latest = examGroups[0];

    setSelectedExamId(
      latest?.id || ''
    );
  }, [
    selectedStudentId,
    examGroups.map(
      (exam) => exam.id
    ).join('|'),
  ]);

  /* ----------------------------------------------------------------------- */
  /* Selected exam                                                           */
  /* ----------------------------------------------------------------------- */

  const selectedExam = useMemo(
    () =>
      examGroups.find(
        (exam) =>
          exam.id ===
          selectedExamId
      ) ||
      examGroups[0] ||
      null,

    [
      examGroups,
      selectedExamId,
    ]
  );

  /* ----------------------------------------------------------------------- */
  /* Exam summary                                                            */
  /* ----------------------------------------------------------------------- */

  const examSummary = useMemo(() => {
    if (!selectedExam) {
      return {
        obtained: 0,
        total: 0,
        percentage: 0,
        grade: '—',
        rank: '—',
      };
    }

    const obtained =
      selectedExam.subjects.reduce(
        (sum, subject) =>
          sum +
          safeNumber(
            subject?.obtainedMarks
          ),
        0
      );

    const total =
      selectedExam.subjects.reduce(
        (sum, subject) =>
          sum +
          safeNumber(
            subject?.totalMarks
          ),
        0
      );

    const percentage =
      calculatePercentage(
        obtained,
        total
      );

    const grade =
      selectedExam.subjects.find(
        (subject) =>
          subject?.overallGrade ||
          subject?.examGrade
      )?.overallGrade ||
      selectedExam.subjects.find(
        (subject) =>
          subject?.overallGrade ||
          subject?.examGrade
      )?.examGrade ||
      selectedReport?.examTotals?.[
        selectedExam.examName
      ]?.grade ||
      getGradeFromPercentage(
        percentage
      );

    const rank =
      selectedExam.subjects.find(
        (subject) =>
          subject?.rank != null
      )?.rank ||
      selectedReport?.rank ||
      selectedReport?.totals?.rank ||
      '—';

    return {
      obtained,
      total,
      percentage,
      grade,
      rank,
    };
  }, [
    selectedExam,
    selectedReport,
  ]);

  const subjectHighlights = useMemo(() => {
    const rows = (selectedExam?.subjects || [])
      .map((s) => ({
        name: s?.subject || 'Subject',
        pct: Math.round(calculatePercentage(s?.obtainedMarks, s?.totalMarks)),
        total: safeNumber(s?.totalMarks),
      }))
      .filter((s) => s.total > 0)
      .sort((a, b) => b.pct - a.pct);
    if (!rows.length) return { best: null, focus: null };
    const best = rows[0];
    const focus = rows.length > 1 && rows[rows.length - 1].pct < 60 ? rows[rows.length - 1] : null;
    return { best, focus };
  }, [selectedExam]);

  /* ----------------------------------------------------------------------- */
  /* Teacher remarks                                                         */
  /* ----------------------------------------------------------------------- */

  const teacherRemarks = useMemo(() => {
    if (!selectedReport) {
      return null;
    }

    const selectedSubjectRemark =
      selectedExam?.subjects?.find(
        (subject) =>
          subject?.teacherRemarks ||
          subject?.classTeacherRemarks
      );

    return (
      selectedExam?.teacherRemarks ||
      selectedExam?.classTeacherRemarks ||
      selectedSubjectRemark?.teacherRemarks ||
      selectedSubjectRemark?.classTeacherRemarks ||
      selectedReport?.teacherRemarks ||
      selectedReport?.classTeacherRemarks ||
      selectedReport?.remarks ||
      ''
    );
  }, [
    selectedReport,
    selectedExam,
  ]);

  /* ----------------------------------------------------------------------- */
  /* Teacher information                                                     */
  /* ----------------------------------------------------------------------- */

  const teacherName =
    selectedExam?.teacherName ||
    selectedExam?.classTeacherName ||
    selectedReport?.teacherName ||
    selectedReport?.classTeacherName ||
    'Class Teacher';

  const teacherDate =
    selectedExam?.remarksDate ||
    selectedExam?.teacherRemarksDate ||
    selectedReport?.remarksDate ||
    selectedReport?.teacherRemarksDate ||
    selectedExam?.date ||
    null;

  /* ----------------------------------------------------------------------- */
  /* Export                                                                  */
  /* ----------------------------------------------------------------------- */

  const handleExport = async () => {
    if (!selectedReport) {
      toast.error(
        'No report data to export'
      );

      return;
    }

    setIsExporting(true);

    try {
      // The PDF prints reportCard.subjects / totals / term. Give it just the
      // selected exam's subjects (skipping blank or zero-mark rows) instead of
      // the all-exam aggregate, which produced rows like "Subject 290 0 0% F".
      const pdfSubjects = (selectedExam?.subjects || [])
        .filter((s) => String(s?.subject || '').trim() && safeNumber(s?.totalMarks) > 0)
        .map((s) => {
          const obtainedMarks = safeNumber(s.obtainedMarks);
          const totalMarks = safeNumber(s.totalMarks);
          const percentage = calculatePercentage(obtainedMarks, totalMarks);
          return {
            name: String(s.subject).trim(),
            obtainedMarks,
            totalMarks,
            percentage,
            grade: s.grade || getGradeFromPercentage(percentage),
          };
        });

      const reportForPdf = {
        ...selectedReport,

        term: selectedExam?.examName || selectedReport.term,
        subjects: pdfSubjects,
        totals: {
          ...(selectedReport.totals || {}),
          obtainedMarks: examSummary.obtained,
          totalMarks: examSummary.total,
          percentage: Math.round(examSummary.percentage * 10) / 10,
          grade: examSummary.grade,
        },

        selectedExam:
          selectedExam || null,

        selectedExamName:
          selectedExam?.examName || '',

        selectedExamSubjects:
          selectedExam?.subjects || [],

        selectedExamTotals: {
          obtainedMarks:
            examSummary.obtained,

          totalMarks:
            examSummary.total,

          percentage:
            examSummary.percentage,

          grade:
            examSummary.grade,

          rank:
            examSummary.rank,
        },
      };

      const fileName =
        `${selectedExam?.examName || 'Academic_Report'}_` +
        `${selectedReport.studentName || 'Student'}`
          .replace(/\s+/g, '_')
          .replace(
            /[^a-zA-Z0-9_-]/g,
            ''
          ) +
        '.pdf';

      const success =
        await downloadGradeCardPdf({
          template,
          reportCard: {
            ...reportForPdf,
            overallRemark: teacherRemarks || '',
            classTeacherName:
              selectedReport.classTeacherName ||
              (teacherName !== 'Class Teacher' ? teacherName : ''),
          },
          profile:
            profileChildren.find((c) => String(c.id) === String(selectedReport.studentId)) || {},
          parentName: profileParent?.name || '',
          photoUrl: childPhoto,
          fileName,
        });

      if (success) {
        toast.success(
          'Report card downloaded successfully'
        );
      } else {
        toast.error(
          'Failed to generate report card'
        );
      }
    } catch (err) {
      console.error(
        'Export error:',
        err
      );

      toast.error(
        'Error generating PDF'
      );
    } finally {
      setIsExporting(false);
    }
  };

  /* ----------------------------------------------------------------------- */
  /* Loading                                                                 */
  /* ----------------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="space-y-4">
        <Loading label="academic report" />
      </div>
    );
  }

  /* ----------------------------------------------------------------------- */
  /* Empty                                                                   */
  /* ----------------------------------------------------------------------- */

  if (
    !error &&
    !reportCards.length
  ) {
    return (
      <div className="space-y-5">
        <EmptyState
          icon={FileText}
          title="No results published yet"
          hint="Results appear here as soon as the school publishes them. You'll also get a notification."
        />
      </div>
    );
  }

  /* ----------------------------------------------------------------------- */
  /* UI                                                                      */
  /* ----------------------------------------------------------------------- */

  return (
    <div className="min-w-0 space-y-3">

      {/* ================================================================== */}
      {/* PAGE HEADER                                                        */}
      {/* ================================================================== */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <FileText className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Results & Report Card
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              View your child&apos;s exam results, grades and report cards.
            </p>
          </div>
        </div>

        {selectedReport && (
          <div className="w-full shrink-0 sm:w-[280px] lg:w-[300px]">
            <ChildSwitcher
              options={childOptions}
              value={childKey}
              onChange={setChildKey}
              label="Select Child"
            />
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* ERROR                                                              */}
      {/* ================================================================== */}

      {error && (
        <ErrorState
          message={error}
        />
      )}

      {/* ================================================================== */}
      {/* HOW IT WORKS — 3 simple steps for parents                          */}
      {/* ================================================================== */}

      {!error && examGroups.length > 0 && (
        <motion.ol
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {[
            { n: 1, Icon: MousePointerClick, title: 'Choose an exam', text: 'Tap any published exam below.' },
            { n: 2, Icon: ClipboardCheck, title: 'See the result', text: 'Marks, grade and remarks for every subject.' },
            { n: 3, Icon: Download, title: 'Download', text: 'Save or print the official report card.' },
          ].map((s) => (
            <motion.li key={s.n} variants={RISE} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">{s.n}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900"><s.Icon className="h-4 w-4 text-violet-500" /> {s.title}</span>
                <span className="block truncate text-[11px] text-slate-500">{s.text}</span>
              </span>
            </motion.li>
          ))}
        </motion.ol>
      )}

      {!error && examGroups.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Published exams ({examGroups.length})</h2>
          <span className="text-xs text-slate-400">Latest first</span>
        </div>
      )}

      {/* ================================================================== */}
      {/* EXAM SELECTOR                                                      */}
      {/* ================================================================== */}

      {!error &&
        examGroups.length > 0 && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3"
          >

            {examGroups.map(
              (exam, index) => {
                const isSelected =
                  exam.id ===
                  selectedExamId;

                const percentage =
                  exam.percentage;

                const examColor =
                  index % 4 === 0
                    ? {
                        icon:
                          'bg-blue-50 text-blue-600',
                        border:
                          'border-blue-300',
                        glow:
                          'bg-blue-50/40',
                      }
                    : index % 4 === 1
                    ? {
                        icon:
                          'bg-violet-50 text-violet-600',
                        border:
                          'border-violet-300',
                        glow:
                          'bg-violet-50/40',
                      }
                    : index % 4 === 2
                    ? {
                        icon:
                          'bg-amber-50 text-amber-600',
                        border:
                          'border-amber-300',
                        glow:
                          'bg-amber-50/40',
                      }
                    : {
                        icon:
                          'bg-rose-50 text-rose-600',
                        border:
                          'border-rose-300',
                        glow:
                          'bg-rose-50/40',
                      };

                return (
                  <motion.button
                    variants={RISE}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    aria-pressed={isSelected}
                    key={exam.id}
                    onClick={() =>
                      setSelectedExamId(
                        exam.id
                      )
                    }
                    className={`group relative overflow-hidden rounded-xl border bg-white p-3.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                      isSelected
                        ? `${examColor.border} ring-1 ring-inset ${examColor.border}`
                        : 'border-slate-200'
                    }`}
                  >

                    {/* Background */}
                    <div
                      className={`pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-bl-full opacity-60 ${examColor.glow}`}
                    />

                    <div className="relative flex items-start justify-between gap-3">

                      <div className="flex min-w-0 items-center gap-3">

                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${examColor.icon}`}
                        >
                          <FileText
                            className="h-6 w-6"
                            strokeWidth={2}
                          />
                        </div>

                        <div className="min-w-0">

                          <p className="truncate text-sm font-bold text-slate-900">
                            {exam.examName}
                          </p>

                          <p className="mt-0.5 text-xs font-medium text-slate-500">
                            {formatShortMonth(
                              exam.date
                            )}
                          </p>

                        </div>
                      </div>

                      <div className="shrink-0 text-right">

                        {exam.subjects?.length > 0 ? (
                          <p className="text-sm font-bold text-slate-900">
                            {Math.round(
                              percentage
                            )}
                            %
                          </p>
                        ) : (
                          <p className="text-sm font-bold text-slate-900">
                            -
                          </p>
                        )}

                      </div>
                    </div>

                    <div className="relative mt-3 flex items-center justify-between">

                      <span className="flex items-center gap-1.5">
                        <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                          Published
                        </span>
                        {index === 0 && (
                          <span className="inline-flex items-center rounded-full bg-violet-600 px-2 py-1 text-[10px] font-bold text-white">
                            Latest
                          </span>
                        )}
                      </span>

                      <span className={`text-[11px] font-semibold ${isSelected ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                        {isSelected ? 'Viewing ✓' : 'View result →'}
                      </span>

                    </div>
                  </motion.button>
                );
              }
            )}
          </motion.div>
        )}

      {/* ================================================================== */}
      {/* SELECTED REPORT CARD                                               */}
      {/* ================================================================== */}

      {!error &&
        selectedReport &&
        selectedExam && (
          <motion.section
            key={selectedExam.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >

            {/* ------------------------------------------------------------ */}
            {/* Report Header                                                 */}
            {/* ------------------------------------------------------------ */}

            <div className="border-b border-slate-100 px-4 py-3">

              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                <div className="flex items-start gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <FileText
                      className="h-6 w-6"
                      strokeWidth={2}
                    />
                  </div>

                  <div>

                    <div className="flex flex-wrap items-center gap-2">

                      <h2 className="text-sm font-bold text-slate-900">
                        {selectedExam.examName}
                      </h2>

                      <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                        Published
                      </span>

                    </div>

                    <p className="mt-1 text-[11px] font-medium text-slate-500">

                      Academic Year:{' '}
                      <span className="text-slate-700">
                        {selectedReport.academicYear ||
                          selectedReport.academicSession ||
                          '—'}
                      </span>

                      <span className="mx-2 text-slate-300">
                        |
                      </span>

                      {selectedExam.term && (
                        <>
                          {selectedExam.term}

                          <span className="mx-2 text-slate-300">
                            |
                          </span>
                        </>
                      )}

                      Class{' '}
                      {selectedReport.grade ||
                        '—'}

                      {selectedReport.section && (
                        <>
                          {' '}
                          - Section{' '}
                          {
                            selectedReport.section
                          }
                        </>
                      )}

                    </p>
                  </div>
                </div>

                {/* Download */}
                <button
                  type="button"
                  onClick={
                    handleExport
                  }
                  disabled={
                    isExporting
                  }
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {isExporting ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                    />
                  ) : (
                    <Download
                      className="h-3.5 w-3.5"
                    />
                  )}

                  <span>
                    {isExporting
                      ? 'Generating...'
                      : 'Download Report Card (PDF)'}
                  </span>
                </button>

              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* In one line — what this result means                         */}
            {/* ------------------------------------------------------------ */}

            <div className="mx-4 mt-3 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 text-xs text-slate-700">
              <span className="font-semibold text-slate-900">{selectedReport.studentName || 'Your child'}</span>
              {' '}scored{' '}
              <span className="font-semibold text-slate-900">{examSummary.obtained} out of {examSummary.total}</span>
              {' '}({Math.round(examSummary.percentage)}%) in{' '}
              <span className="font-semibold text-slate-900">{selectedExam.examName}</span>
              {' '}— Grade <span className="font-semibold text-slate-900">{examSummary.grade}</span>
              {' '}({getGradeDescription(examSummary.grade)}).
              {subjectHighlights.best && (
                <span className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                    <TrendingUp className="h-3.5 w-3.5" /> Best: {subjectHighlights.best.name} ({subjectHighlights.best.pct}%)
                  </span>
                  {subjectHighlights.focus && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5" /> Needs practice: {subjectHighlights.focus.name} ({subjectHighlights.focus.pct}%)
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* Summary Stats                                                 */}
            {/* ------------------------------------------------------------ */}

            <div className={`grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-3 ${examSummary.rank !== '—' ? 'lg:grid-cols-4' : ''}`}>

              {/* Percentage */}
              <div className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2.5">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-500">
                  <Trophy
                    className="h-6 w-6"
                    strokeWidth={2}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-medium text-slate-500">
                    Percentage
                  </p>

                  <p className="mt-0.5 text-base font-bold text-slate-900">
                    {Math.round(
                      examSummary.percentage
                    )}
                    %
                  </p>
                </div>

              </div>

              {/* Total Marks */}
              <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2.5">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <BarChartIcon />
                </div>

                <div>
                  <p className="text-[10px] font-medium text-slate-500">
                    Total Marks
                  </p>

                  <p className="mt-0.5 text-base font-bold text-slate-900">
                    {examSummary.obtained}{' '}
                    <span className="text-slate-400">
                      /{' '}
                      {
                        examSummary.total
                      }
                    </span>
                  </p>
                </div>

              </div>

              {/* Grade */}
              <div className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2.5">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-500">
                  <Star
                    className="h-6 w-6"
                    fill="currentColor"
                  />
                </div>

                <div>
                  <p className="text-[10px] font-medium text-slate-500">
                    Grade
                  </p>

                  <p className="mt-0.5 text-base font-bold text-slate-900">
                    {examSummary.grade}
                  </p>
                </div>

              </div>

              {/* Rank (only when the school publishes one) */}
              {examSummary.rank !== '—' && (
              <div className="flex items-center gap-3 rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2.5">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-500">
                  <Medal
                    className="h-6 w-6"
                    strokeWidth={2}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-medium text-slate-500">
                    Rank
                  </p>

                  <p className="mt-0.5 text-base font-bold text-slate-900">
                    {examSummary.rank}
                  </p>
                </div>

              </div>
              )}

            </div>

            {/* ------------------------------------------------------------ */}
            {/* Subject Table                                                  */}
            {/* ------------------------------------------------------------ */}

            <div className="px-4 pb-4">

              <div className="overflow-hidden rounded-xl border border-slate-200">

                <div className="overflow-x-auto">

                  <table className="min-w-[760px] w-full border-collapse">

                    <thead>
                      <tr className="bg-slate-50">

                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500">
                          #
                        </th>

                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500">
                          Subject
                        </th>

                        <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500">
                          Max Marks
                        </th>

                        <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500">
                          Marks Obtained
                        </th>

                        <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500">
                          Grade
                        </th>

                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500">
                          Remarks
                        </th>

                      </tr>
                    </thead>

                    <tbody>

                      {selectedExam.subjects.map(
                        (subject, index) => {
                          const obtained =
                            safeNumber(
                              subject?.obtainedMarks
                            );

                          const total =
                            safeNumber(
                              subject?.totalMarks
                            );

                          const percentage =
                            subject?.percentage != null
                              ? safeNumber(
                                  subject.percentage
                                )
                              : calculatePercentage(
                                  obtained,
                                  total
                                );

                          const grade =
                            subject?.grade ||
                            getGradeFromPercentage(
                              percentage
                            );

                          const SubjectIcon =
                            getSubjectIcon(
                              subject?.subject
                            );

                          const iconClass =
                            getSubjectIconClass(
                              subject?.subject
                            );

                          return (
                            <tr
                              key={`${subject?.subject}-${index}`}
                              className="border-t border-slate-100 transition hover:bg-slate-50/60"
                            >

                              {/* # */}
                              <td className="px-5 py-3 text-xs font-medium text-slate-500">
                                {index + 1}
                              </td>

                              {/* Subject */}
                              <td className="px-4 py-3">

                                <div className="flex items-center gap-2.5">

                                  <span
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
                                  >
                                    <SubjectIcon
                                      className="h-3.5 w-3.5"
                                      strokeWidth={2.2}
                                    />
                                  </span>

                                  <span className="text-xs font-medium text-slate-700">
                                    {
                                      subject?.subject ||
                                      'Subject'
                                    }
                                  </span>

                                </div>

                              </td>

                              {/* Max */}
                              <td className="px-3 py-2 text-center text-xs font-medium text-slate-600">
                                <span className="underline decoration-slate-200 underline-offset-2">
                                  {total}
                                </span>
                              </td>

                              {/* Obtained */}
                              <td className="px-3 py-2 text-center text-xs font-medium text-slate-600">
                                <span className="underline decoration-slate-200 underline-offset-2">
                                  {obtained}
                                </span>
                              </td>

                              {/* Grade */}
                              <td className="px-3 py-2 text-center">

                                <span
                                  className={`inline-flex min-w-[50px] items-center justify-center rounded-full border px-3 py-1 text-xs font-bold ${getGradeClass(
                                    grade
                                  )}`}
                                >
                                  {grade}
                                </span>

                              </td>

                              {/* Remarks */}
                              <td className="px-4 py-3">

                                <span className="text-sm font-medium text-slate-600">
                                  {subject?.remarks ||
                                    getGradeDescription(
                                      grade
                                    )}
                                </span>

                              </td>

                            </tr>
                          );
                        }
                      )}

                      {/* Total */}
                      <tr className="border-t border-slate-200 bg-slate-50/70">

                        <td
                          colSpan={2}
                          className="px-3 py-2 text-right text-xs font-bold text-slate-800"
                        >
                          Total
                        </td>

                        <td className="px-3 py-2 text-center text-xs font-bold text-slate-900">
                          {
                            examSummary.total
                          }
                        </td>

                        <td className="px-3 py-2 text-center text-xs font-bold text-slate-900">
                          {
                            examSummary.obtained
                          }
                        </td>

                        <td className="px-3 py-2 text-center">

                          <span
                            className={`inline-flex min-w-[50px] items-center justify-center rounded-full border px-3 py-1 text-xs font-bold ${getGradeClass(
                              examSummary.grade
                            )}`}
                          >
                            {
                              examSummary.grade
                            }
                          </span>

                        </td>

                        <td className="px-3 py-2 text-xs text-slate-500">
                          -
                        </td>

                      </tr>

                    </tbody>

                  </table>

                </div>

              </div>

            </div>

          </motion.section>
        )}

      {/* ================================================================== */}
      {/* BOTTOM INFORMATION                                                 */}
      {/* ================================================================== */}

      {!error &&
        selectedReport &&
        selectedExam && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">

            {/* ------------------------------------------------------------ */}
            {/* Teacher Remarks                                               */}
            {/* ------------------------------------------------------------ */}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-3">

              <div className="border-b border-slate-100 px-4 py-2.5">

                <div className="flex items-center gap-2.5">

                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <MessageSquareText
                      className="h-3.5 w-3.5"
                    />
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">
                    Class Teacher's Remarks
                  </h3>

                </div>

              </div>

              <div className="p-3">

                <div className="flex gap-2.5 rounded-lg bg-blue-50/70 p-3">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-slate-300">

                    {selectedReport.teacherProfilePic ? (
                      <img
                        src={
                          selectedReport.teacherProfilePic
                        }
                        alt={
                          teacherName
                        }
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User
                        className="h-6 w-6"
                      />
                    )}

                  </div>

                  <div className="min-w-0 flex-1">

                    <p className="text-xs leading-5 text-slate-700">

                      {teacherRemarks || (
                        <span className="italic text-slate-500">The class teacher hasn&apos;t added remarks for this exam yet.</span>
                      )}

                    </p>

                    <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">

                      <div>

                        <p className="text-xs font-bold text-slate-800">
                          {teacherName}
                        </p>

                        <p className="text-[10px] font-medium text-slate-500">
                          Class Teacher
                        </p>

                      </div>

                      {teacherDate && (
                        <p className="text-[10px] font-medium text-slate-500">
                          {formatDate(
                            teacherDate
                          )}
                        </p>
                      )}

                    </div>

                  </div>

                </div>

              </div>

            </section>

            {/* ------------------------------------------------------------ */}
            {/* Grading System                                                 */}
            {/* ------------------------------------------------------------ */}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">

              <div className="border-b border-slate-100 px-4 py-2.5">

                <div className="flex items-center gap-2.5">

                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Info
                      className="h-3.5 w-3.5"
                    />
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">
                    Grading System
                  </h3>

                </div>

              </div>

              <div className="p-3">

                <div className="overflow-hidden rounded-xl border border-slate-200">

                  <table className="w-full border-collapse">

                    <tbody>

                      {[
                        {
                          grade: 'A+',
                          range: '90 - 100',
                          description:
                            'Outstanding',
                        },
                        {
                          grade: 'A',
                          range: '80 - 89',
                          description:
                            'Excellent',
                        },
                        {
                          grade: 'B+',
                          range: '70 - 79',
                          description:
                            'Very Good',
                        },
                        {
                          grade: 'B',
                          range: '60 - 69',
                          description:
                            'Good',
                        },
                        {
                          grade: 'C',
                          range: '50 - 59',
                          description:
                            'Satisfactory',
                        },
                        {
                          grade: 'D',
                          range: 'Below 50',
                          description:
                            'Needs Improvement',
                        },
                      ].map(
                        (item) => (
                          <tr
                            key={
                              item.grade
                            }
                            className="border-b border-slate-100 last:border-0"
                          >

                            <td className="px-2.5 py-1.5 text-[10px] font-bold text-slate-700">
                              {item.grade}
                            </td>

                            <td className="px-2.5 py-1.5 text-[10px] font-medium text-slate-600">
                              {item.range}
                            </td>

                            <td className="px-2.5 py-1.5 text-[10px] font-medium text-slate-500">
                              {
                                item.description
                              }
                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </div>

            </section>

          </div>
        )}

      {/* ================================================================== */}
      {/* IMPORTANT NOTE                                                     */}
      {/* ================================================================== */}

      {!error &&
        selectedReport &&
        selectedExam && (
          <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[10px] text-slate-500">

            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />

            <p>
              Results and grades shown here are
              published by the school. For any
              discrepancy, please contact the
              school administration.
            </p>

          </div>
        )}

    </div>
  );
};

/* ========================================================================= */
/* Small Bar Chart Icon                                                      */
/* ========================================================================= */

const BarChartIcon = () => {
  return (
    <div className="flex h-6 items-end gap-1">
      <span className="h-3 w-1.5 rounded-sm bg-blue-400" />
      <span className="h-5 w-1.5 rounded-sm bg-blue-500" />
      <span className="h-6 w-1.5 rounded-sm bg-blue-600" />
    </div>
  );
};

export default AcademicReport;