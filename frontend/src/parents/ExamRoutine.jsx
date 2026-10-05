import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  UserCircle2,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Info,
  BookOpen,
  Monitor,
  Palette,
  FlaskConical,
  Globe2,
  Landmark,
  Calculator,
  PersonStanding,
  Languages,
  GraduationCap,
  Download,
} from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

import { parentApiJson } from './parentApi';
import { generateExamSchedulePdf } from '../utils/examRoutinePdf';
import { useSharedChildSelection } from './ChildSwitcher';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const to12Hour = (value) => {
  const raw = String(value || '').trim();

  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return raw;

  const h = Number(match[1]);
  const m = Number(match[2]);

  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return raw;
  }

  const period = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;

  return `${hh}:${String(m).padStart(2, '0')} ${period}`;
};

const addMinutes = (time24, minutes) => {
  const match = String(time24 || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);

  if (!match || !Number.isFinite(Number(minutes))) {
    return '';
  }

  const total =
    Number(match[1]) * 60 +
    Number(match[2]) +
    Number(minutes);

  const wrapped = ((total % 1440) + 1440) % 1440;

  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatMonthYear = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

const getDay = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
  });
};

const getTimeRange = (exam) => {
  if (exam?.startTime && exam?.endTime) {
    return `${to12Hour(exam.startTime)} – ${to12Hour(exam.endTime)}`;
  }

  if (exam?.startTime) {
    return to12Hour(exam.startTime);
  }

  if (exam?.time) {
    const duration =
      exam?.duration ??
      exam?.durationMinutes ??
      null;

    const endTime24 = duration
      ? addMinutes(exam.time, duration)
      : '';

    return endTime24
      ? `${to12Hour(exam.time)} – ${to12Hour(endTime24)}`
      : to12Hour(exam.time);
  }

  return '—';
};

const getSubjectName = (exam) => {
  return (
    exam?.subjectId?.name ||
    exam?.subject ||
    'Subject'
  );
};

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

  if (
    name.includes('geography')
  ) {
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
    name.includes('physical') ||
    name.includes('sports') ||
    name.includes('p.e.')
  ) {
    return PersonStanding;
  }

  if (
    name.includes('bengali') ||
    name.includes('english') ||
    name.includes('language')
  ) {
    return BookOpen;
  }

  return GraduationCap;
};

const getSubjectIconClass = (subject) => {
  const name = String(subject || '').toLowerCase();

  if (
    name.includes('computer') ||
    name.includes('ict') ||
    name.includes('information')
  ) {
    return 'text-blue-500 bg-blue-50';
  }

  if (
    name.includes('drawing') ||
    name.includes('art') ||
    name.includes('craft')
  ) {
    return 'text-violet-500 bg-violet-50';
  }

  if (
    name.includes('science') ||
    name.includes('physics') ||
    name.includes('chemistry') ||
    name.includes('biology')
  ) {
    return 'text-emerald-500 bg-emerald-50';
  }

  if (name.includes('geography')) {
    return 'text-amber-500 bg-amber-50';
  }

  if (
    name.includes('history') ||
    name.includes('civics') ||
    name.includes('social')
  ) {
    return 'text-purple-500 bg-purple-50';
  }

  if (
    name.includes('math') ||
    name.includes('mathematics')
  ) {
    return 'text-blue-500 bg-blue-50';
  }

  if (
    name.includes('physical') ||
    name.includes('sports') ||
    name.includes('p.e.')
  ) {
    return 'text-green-500 bg-green-50';
  }

  return 'text-rose-500 bg-rose-50';
};

/* -------------------------------------------------------------------------- */
/* Exam rows                                                                  */
/* -------------------------------------------------------------------------- */

const toRoutineRows = (group) => {
  const subjects = Array.isArray(group?.subjects)
    ? group.subjects
    : [];

  return subjects
    .map((exam) => {
      const date = exam?.date
        ? new Date(exam.date)
        : null;

      const validDate =
        date &&
        !Number.isNaN(date.getTime());

      const subject = getSubjectName(exam);

      return {
        rawDate: validDate
          ? date.getTime()
          : Number.MAX_SAFE_INTEGER,

        date: validDate
          ? date.toISOString()
          : null,

        day: validDate
          ? getDay(date)
          : '—',

        subject,

        time: getTimeRange(exam),

        duration:
          exam?.duration ??
          exam?.durationMinutes ??
          null,

        building:
          exam?.roomId?.floorId?.buildingId?.name ||
          '',

        floor:
          exam?.roomId?.floorId?.name ||
          '',

        room:
          exam?.roomId?.roomNumber ||
          '',

        venue:
          exam?.venue ||
          '',
      };
    })
    .sort((a, b) => a.rawDate - b.rawDate);
};

/* -------------------------------------------------------------------------- */
/* Exam status                                                                */
/* -------------------------------------------------------------------------- */

const getExamState = (group) => {
  const backendState = String(
    group?.examState || ''
  ).toLowerCase();

  if (
    backendState === 'completed' ||
    String(group?.status || '').toLowerCase() === 'completed'
  ) {
    return 'completed';
  }

  if (
    backendState === 'published' ||
    String(group?.status || '').toLowerCase() === 'published'
  ) {
    return 'upcoming';
  }

  return 'coming-soon';
};

const getStateConfig = (state) => {
  switch (state) {
    case 'completed':
      return {
        label: 'Completed',
        icon: CheckCircle2,
        badgeClass:
          'border border-emerald-100 bg-emerald-50 text-emerald-600',
        iconClass:
          'bg-emerald-500 text-white',
        headerClass:
          'border-blue-100 bg-gradient-to-r from-blue-50 via-white to-blue-50/60',
        iconBoxClass:
          'bg-blue-100 text-blue-600',
      };

    case 'upcoming':
      return {
        label: 'Upcoming',
        icon: Clock3,
        badgeClass:
          'border border-amber-100 bg-amber-50 text-amber-600',
        iconClass:
          'bg-amber-500 text-white',
        headerClass:
          'border-violet-100 bg-gradient-to-r from-violet-50 via-white to-violet-50/60',
        iconBoxClass:
          'bg-violet-100 text-violet-600',
      };

    default:
      return {
        label: 'Coming Soon',
        icon: Clock3,
        badgeClass:
          'border border-slate-200 bg-slate-100 text-slate-600',
        iconClass:
          'bg-slate-400 text-white',
        headerClass:
          'border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/60',
        iconBoxClass:
          'bg-emerald-100 text-emerald-600',
      };
  }
};

/* -------------------------------------------------------------------------- */
/* Routine Table                                                              */
/* -------------------------------------------------------------------------- */

const RoutineTable = ({ group }) => {
  const rows = useMemo(
    () => toRoutineRows(group),
    [group]
  );

  if (!rows.length) {
    return (
      <div className="border-t border-slate-100 bg-white px-5 py-6">
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

          <p>
            The detailed subject-wise routine has not
            been published yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[1000px] w-full border-collapse">
          <thead>
            <tr className="bg-slate-50/90 text-left">
              <th className="px-5 py-3 text-xs font-bold text-slate-500">
                #
              </th>

              <th className="px-4 py-3 text-xs font-bold text-slate-500">
                Date
              </th>

              <th className="px-4 py-3 text-xs font-bold text-slate-500">
                Day
              </th>

              <th className="px-4 py-3 text-xs font-bold text-slate-500">
                Subject
              </th>

              <th className="px-4 py-3 text-xs font-bold text-slate-500">
                Time
              </th>

              <th className="px-4 py-3 text-xs font-bold text-slate-500">
                Duration
              </th>

              <th className="px-4 py-3 text-xs font-bold text-slate-500">
                Building
              </th>

              <th className="px-4 py-3 text-xs font-bold text-slate-500">
                Floor
              </th>

              <th className="px-4 py-3 text-xs font-bold text-slate-500">
                Room
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const SubjectIcon =
                getSubjectIcon(row.subject);

              const subjectIconClass =
                getSubjectIconClass(row.subject);

              return (
                <tr
                  key={`${row.subject}-${row.date}-${index}`}
                  className="border-t border-slate-100 transition hover:bg-slate-50/70"
                >
                  <td className="px-5 py-2.5 text-xs font-medium text-slate-500">
                    {index + 1}
                  </td>

                  <td className="px-4 py-2.5 text-xs font-medium text-slate-600">
                    {formatDate(row.date)}
                  </td>

                  <td className="px-4 py-2.5 text-xs font-medium text-slate-600">
                    <span className="underline decoration-slate-200 underline-offset-2">
                      {row.day}
                    </span>
                  </td>

                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${subjectIconClass}`}
                      >
                        <SubjectIcon
                          className="h-4 w-4"
                          strokeWidth={2.2}
                        />
                      </span>

                      <span className="text-xs font-medium text-slate-700">
                        {row.subject}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-2.5 text-xs font-medium text-slate-600">
                    <span className="underline decoration-slate-200 underline-offset-2">
                      {row.time}
                    </span>
                  </td>

                  <td className="px-4 py-2.5 text-xs font-medium text-slate-600">
                    {row.duration
                      ? `${row.duration} min`
                      : '—'}
                  </td>

                  <td className="px-4 py-2.5 text-xs font-medium text-slate-600">
                    {row.building || '—'}
                  </td>

                  <td className="px-4 py-2.5 text-xs font-medium text-slate-600">
                    {row.floor || '—'}
                  </td>

                  <td className="px-4 py-2.5 text-xs font-medium text-slate-600">
                    {row.room || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Exam Card                                                                  */
/* -------------------------------------------------------------------------- */

const ExamCard = ({
  group,
  isOpen,
  onToggle,
  onDownload,
  isExporting,
}) => {
  const state = getExamState(group);
  const config = getStateConfig(state);

  const StatusIcon = config.icon;

  const firstExamDate =
    Array.isArray(group?.subjects) &&
    group.subjects.length
      ? group.subjects
          .map((subject) => subject?.date)
          .filter(Boolean)
          .sort(
            (a, b) =>
              new Date(a).getTime() -
              new Date(b).getTime()
          )[0]
      : group?.startDate;

  const monthText =
    formatMonthYear(firstExamDate);

  const termText =
    group?.termName ||
    group?.term ||
    group?.academicTerm ||
    '';

  const subtitleParts = [];

  if (termText) {
    subtitleParts.push(termText);
  }

  if (monthText) {
    subtitleParts.push(monthText);
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border shadow-sm ${config.headerClass}`}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                             */}
      {/* ------------------------------------------------------------------ */}

      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' ||
            event.key === ' '
          ) {
            event.preventDefault();
            onToggle();
          }
        }}
        className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 select-none"
      >
        <div className="flex min-w-0 items-center gap-4">
          {/* Exam Icon */}
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${config.iconBoxClass}`}
          >
            <CalendarDays
              className="h-6 w-6"
              strokeWidth={2}
            />
          </div>

          {/* Title */}
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg">
              {group?.title || 'Examination'}
            </h2>

            <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">
              {subtitleParts.length
                ? subtitleParts.join(' · ')
                : `Class ${
                    group?.classId?.name || '—'
                  }`}
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex shrink-0 items-center gap-2">
          {(state === 'published' || state === 'completed') && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDownload();
              }}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          )}

          {/* Status */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${config.badgeClass}`}
          >
            <StatusIcon
              className="h-3.5 w-3.5"
              strokeWidth={2.5}
            />

            <span className="hidden sm:inline">
              {config.label}
            </span>
          </span>

          <ChevronDown
            className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Body                                                               */}
      {/* ------------------------------------------------------------------ */}

      <AnimatePresence initial={false}>
        {isOpen && (
          <Motion.div
            initial={{
              height: 0,
              opacity: 0,
            }}
            animate={{
              height: 'auto',
              opacity: 1,
            }}
            exit={{
              height: 0,
              opacity: 0,
            }}
            transition={{
              duration: 0.22,
              ease: 'easeInOut',
            }}
            className="overflow-hidden"
          >
            {/* Completed message */}
            {state === 'completed' && (
              <div className="flex items-start gap-3 border-t border-blue-100 bg-blue-50/70 px-5 py-3.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <Info className="h-3.5 w-3.5" />
                </span>

                <div>
                  <p className="text-sm font-semibold text-blue-700">
                    This examination has been
                    completed.
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    The routine below is kept for your
                    reference. Results will be shared
                    once they are published.
                  </p>
                </div>
              </div>
            )}

            {/* Published routine */}
            {state === 'upcoming' &&
            Array.isArray(group?.subjects) &&
            group.subjects.length > 0 ? (
              <RoutineTable group={group} />
            ) : state === 'completed' &&
              Array.isArray(group?.subjects) &&
              group.subjects.length > 0 ? (
              <RoutineTable group={group} />
            ) : (
              /* Not published yet */
              <div className="flex items-start gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    The routine for{' '}
                    {group?.title || 'this examination'}{' '}
                    will be published soon.
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    You will be notified once the
                    subject-wise schedule is available.
                  </p>
                </div>
              </div>
            )}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

// Client cache (memory + sessionStorage, per login) → instant repeat visits.
const SCHEDULE_CACHE_MAX_AGE = 10 * 60 * 1000;
const scheduleCacheKey = () => {
  let t = '';
  try { t = localStorage.getItem('token') || ''; } catch { /* ignore */ }
  return `parent:exam-schedule:v1:${t.slice(-16)}`;
};
let scheduleMemCache = null;
const readScheduleCache = () => {
  const key = scheduleCacheKey();
  let entry = scheduleMemCache?.key === key ? scheduleMemCache : null;
  if (!entry) { try { entry = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { entry = null; } }
  return entry && Date.now() - entry.at < SCHEDULE_CACHE_MAX_AGE ? entry.data : null;
};
const writeScheduleCache = (data) => {
  scheduleMemCache = { key: scheduleCacheKey(), at: Date.now(), data };
  try { sessionStorage.setItem(scheduleMemCache.key, JSON.stringify(scheduleMemCache)); } catch { /* quota */ }
};

const ExamRoutine = () => {
  const navigate = useNavigate();

  const cachedSchedule = readScheduleCache();
  const [children, setChildren] = useState(() => cachedSchedule?.children || []);
  const [pdfHeader, setPdfHeader] = useState(() => cachedSchedule?.pdfHeader || {});

  const [loading, setLoading] = useState(!cachedSchedule);
  const [error, setError] = useState('');

  const [isExporting, setIsExporting] =
    useState(false);

  const [openGroupId, setOpenGroupId] =
    useState('');

  /* ---------------------------------------------------------------------- */
  /* Children                                                               */
  /* ---------------------------------------------------------------------- */

  const childOptions = useMemo(
    () =>
      children.map((child) => ({
        id: String(
          child.studentId || ''
        ),

        name:
          child.studentName ||
          'Student',
      })),

    [children]
  );

  const [
    ,
    ,
    selectedOption,
  ] = useSharedChildSelection(
    childOptions
  );

  const selectedStudentId =
    selectedOption?.id || '';

  /* ---------------------------------------------------------------------- */
  /* API                                                                    */
  /* ---------------------------------------------------------------------- */

  const loadSchedules = async () => {
    const cached = readScheduleCache();
    if (!cached) setLoading(true);
    setError('');

    try {
      const data =
        await parentApiJson(
          '/api/exam/groups/parent-schedule',
          {},
          navigate
        );

      const nextChildren = Array.isArray(data?.children) ? data.children : [];
      setChildren(nextChildren);

      const nextHeader = {
        schoolName: String(
          data?.school?.name || ''
        ).trim(),

        schoolAddressLine: String(
          data?.school?.address || ''
        ).trim(),

        logoUrl: String(
          data?.school?.logo || ''
        ).trim(),

        principalName: String(
          data?.principalName || ''
        ).trim(),
      };
      setPdfHeader(nextHeader);
      writeScheduleCache({ children: nextChildren, pdfHeader: nextHeader });
    } catch (err) {
      // Keep cached routines on screen if the background refresh fails.
      if (!cached) setError(
        err?.message ||
          'Unable to load exam routine'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Selected child                                                         */
  /* ---------------------------------------------------------------------- */

  const selectedChild = useMemo(
    () =>
      children.find(
        (child) =>
          String(child.studentId) ===
          String(selectedStudentId)
      ) || null,

    [children, selectedStudentId]
  );

  /* ---------------------------------------------------------------------- */
  /* Groups                                                                 */
  /* ---------------------------------------------------------------------- */

  const groups = useMemo(() => {
    if (
      !Array.isArray(
        selectedChild?.groups
      )
    ) {
      return [];
    }

    // Latest exam first. An exam's date = its start date, else its earliest
    // subject date; groups without any date go last.
    const examTime = (g) => {
      const times = [g?.startDate, ...(g?.subjects || []).map((s) => s?.date)]
        .map((d) => new Date(d || '').getTime())
        .filter((t) => Number.isFinite(t));
      return times.length ? Math.min(...times) : -Infinity;
    };
    return [...selectedChild.groups].sort((a, b) => examTime(b) - examTime(a));
  }, [selectedChild]);

  /* ---------------------------------------------------------------------- */
  /* Open first exam                                                        */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!groups.length) {
      setOpenGroupId('');
      return;
    }

    /*
     * Open the first available routine.
     *
     * If there is a published/completed routine,
     * prefer that. Otherwise open the first exam.
     */

    const preferred =
      groups.find((group) => {
        const state =
          getExamState(group);

        return (
          state === 'completed' ||
          state === 'upcoming'
        );
      }) || groups[0];

    setOpenGroupId(
      preferred?._id
        ? String(preferred._id)
        : ''
    );
  }, [
    selectedStudentId,
    groups,
  ]);

  /* ---------------------------------------------------------------------- */
  /* PDF                                                                    */
  /* ---------------------------------------------------------------------- */

  const handleDownload = async (group) => {
    setIsExporting(true);

    try {
      // Same PDF the student portal downloads (generated from the live
      // schedule with the school letterhead), not the admin's notice copy.
      await generateExamSchedulePdf(group, pdfHeader);
      toast.success('Exam routine downloaded');
    } catch (err) {
      toast.error(err?.message || 'Failed to download exam routine');
    } finally {
      setIsExporting(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Loading                                                                */
  /* ---------------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="space-y-4">
        <Loading label="exam routine" />
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* UI                                                                      */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="min-w-0 space-y-5">

      {/* ================================================================== */}
      {/* PAGE HEADER                                                        */}
      {/* ================================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

        {/* Left */}
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <CalendarDays
              className="h-6 w-6"
              strokeWidth={2}
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Exam Schedule
            </h1>

            <p className="mt-0.5 text-sm text-slate-500">
              View all examination schedules
              for your child.
            </p>
          </div>
        </div>

        {/* Right - Child Selector */}
        {selectedChild && (
          <div className="w-full lg:w-[275px]">

            <div className="relative">
              {selectedChild.profilePic ? (
                <img
                  src={selectedChild.profilePic}
                  alt={
                    selectedChild.studentName ||
                    'Student'
                  }
                  className="absolute left-3 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <UserCircle2 className="absolute left-3 top-1/2 z-10 h-9 w-9 -translate-y-1/2 text-slate-300" />
              )}

              <div className="rounded-xl border border-slate-200 bg-white py-2 pl-14 pr-3 shadow-sm">
                <p className="text-sm font-bold text-slate-800">
                  {selectedChild.studentName ||
                    'Student'}
                </p>

                <p className="text-xs text-slate-500">
                  {selectedChild.grade
                    ? `Class ${selectedChild.grade}`
                    : 'Class —'}

                  {selectedChild.section
                    ? ` - Section ${selectedChild.section}`
                    : ''}
                </p>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* ERROR                                                              */}
      {/* ================================================================== */}

      {error && (
        <ErrorState
          message={error}
          onRetry={loadSchedules}
        />
      )}

      {/* ================================================================== */}
      {/* EMPTY                                                              */}
      {/* ================================================================== */}

      {!error &&
        !groups.length && (
          <EmptyState
            title="No exam schedule published yet"
            hint="Once the school publishes an exam routine for this class, it will appear here."
            icon={CalendarDays}
          />
        )}

      {/* ================================================================== */}
      {/* EXAM LIST                                                          */}
      {/* ================================================================== */}

      {!error &&
        groups.length > 0 && (
          <Motion.div
            className="space-y-4"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          >

            {groups.map((group) => {
              const groupId =
                String(group?._id || '');

              const isOpen =
                openGroupId === groupId;

              return (
                <Motion.div
                  key={groupId}
                  layout
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
                  }}
                >
                <ExamCard
                  group={group}
                  isOpen={isOpen}
                  isExporting={isExporting}
                  onDownload={() =>
                    handleDownload(group)
                  }
                  onToggle={() =>
                    setOpenGroupId(
                      isOpen
                        ? ''
                        : groupId
                    )
                  }
                />
                </Motion.div>
              );
            })}
          </Motion.div>
        )}

      {/* ================================================================== */}
      {/* IMPORTANT NOTE                                                     */}
      {/* ================================================================== */}

      {!error &&
        groups.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3.5">

            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />

            <p className="text-xs leading-5 text-slate-600 sm:text-sm">
              <span className="font-bold text-slate-700">
                Important Note:{' '}
              </span>

              Please make sure your child reaches
              the exam venue at least 15 minutes
              before the scheduled time.
            </p>
          </div>
        )}
    </div>
  );
};

export default ExamRoutine;