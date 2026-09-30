import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CalendarDays,
  Download,
  Eye,
  FileBadge,
  FileText,
  Loader2,
  School,
  User,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../utils/authSession';
import { generateAdmitCardPdf } from '../utils/examRoutinePdf';
import ChildSwitcher, {
  useSharedChildSelection,
} from '../parents/ChildSwitcher';

const API_BASE = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/$/, '');

/* =========================================================
   EXAM COLORS
========================================================= */

const EXAM_STYLES = [
  {
    iconBg: 'bg-blue-50',
    iconBorder: 'border-blue-100',
    iconColor: 'text-blue-600',

    accent: 'border-blue-100',

    button: 'bg-violet-600 hover:bg-violet-700',
    outline:
      'border-violet-200 text-violet-600 hover:bg-violet-50',

    previewBg: 'bg-violet-50/80',
    previewCircle1: 'bg-violet-200/45',
    previewCircle2: 'bg-violet-100/70',
    previewGlow: 'bg-violet-100/60',

    previewBorder: 'border-violet-200',
    previewTitle: 'text-violet-700',
    previewAvatar: 'bg-violet-100',
    previewAvatarIcon: 'text-violet-500',
    previewLine: 'bg-violet-200',
    previewLineLight: 'bg-violet-100',
  },

  {
    iconBg: 'bg-violet-50',
    iconBorder: 'border-violet-100',
    iconColor: 'text-violet-600',

    accent: 'border-violet-100',

    button: 'bg-violet-600 hover:bg-violet-700',
    outline:
      'border-violet-200 text-violet-600 hover:bg-violet-50',

    previewBg: 'bg-violet-50/80',
    previewCircle1: 'bg-violet-200/45',
    previewCircle2: 'bg-violet-100/70',
    previewGlow: 'bg-violet-100/60',

    previewBorder: 'border-violet-200',
    previewTitle: 'text-violet-700',
    previewAvatar: 'bg-violet-100',
    previewAvatarIcon: 'text-violet-500',
    previewLine: 'bg-violet-200',
    previewLineLight: 'bg-violet-100',
  },

  {
    iconBg: 'bg-amber-50',
    iconBorder: 'border-amber-100',
    iconColor: 'text-amber-600',

    accent: 'border-amber-100',

    button: 'bg-amber-500 hover:bg-amber-600',
    outline:
      'border-amber-200 text-amber-600 hover:bg-amber-50',

    previewBg: 'bg-amber-50/80',
    previewCircle1: 'bg-amber-200/45',
    previewCircle2: 'bg-amber-100/70',
    previewGlow: 'bg-amber-100/60',

    previewBorder: 'border-amber-200',
    previewTitle: 'text-amber-700',
    previewAvatar: 'bg-amber-100',
    previewAvatarIcon: 'text-amber-500',
    previewLine: 'bg-amber-200',
    previewLineLight: 'bg-amber-100',
  },

  {
    iconBg: 'bg-rose-50',
    iconBorder: 'border-rose-100',
    iconColor: 'text-rose-500',

    accent: 'border-rose-100',

    button: 'bg-rose-500 hover:bg-rose-600',
    outline:
      'border-rose-200 text-rose-500 hover:bg-rose-50',

    previewBg: 'bg-rose-50/80',
    previewCircle1: 'bg-rose-200/45',
    previewCircle2: 'bg-rose-100/70',
    previewGlow: 'bg-rose-100/60',

    previewBorder: 'border-rose-200',
    previewTitle: 'text-rose-600',
    previewAvatar: 'bg-rose-100',
    previewAvatarIcon: 'text-rose-500',
    previewLine: 'bg-rose-200',
    previewLineLight: 'bg-rose-100',
  },
];

const getExamStyle = (index) => {
  return EXAM_STYLES[index % EXAM_STYLES.length];
};

/* =========================================================
   STATUS
========================================================= */

const getExamStatus = (group) => {
  const status = String(
    group?.admitCardStatus ||
      group?.status ||
      ''
  ).toLowerCase();

  if (
    status.includes('release') ||
    status.includes('publish') ||
    status.includes('available') ||
    status === 'completed'
  ) {
    return 'available';
  }

  if (group?.admitCardAvailable === true) {
    return 'available';
  }

  if (group?.admitCardAvailable === false) {
    return 'upcoming';
  }

  // Existing endpoint returns groups when cards are available.
  return 'available';
};

/* =========================================================
   DATE
========================================================= */

const formatDate = (date) => {
  if (!date) return '—';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/* =========================================================
   TIME
========================================================= */

const formatTime = (value) => {
  if (!value) return '—';

  const raw = String(value).trim();

  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return raw;

  const hour = Number(match[1]);
  const minute = match[2];

  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = ((hour + 11) % 12) + 1;

  return `${displayHour}:${minute} ${period}`;
};

/* =========================================================
   EXAM START DATE
========================================================= */

const getExamStartDate = (group) => {
  const subjects = Array.isArray(group?.subjects)
    ? group.subjects
    : [];

  const dates = subjects
    .map((subject) => subject?.date)
    .filter(Boolean)
    .map((date) => new Date(date))
    .filter(
      (date) => !Number.isNaN(date.getTime())
    );

  if (!dates.length) return null;

  return dates.sort((a, b) => a - b)[0];
};

/* =========================================================
   VENUE
========================================================= */

const getExamVenue = (group) => {
  const subject = Array.isArray(group?.subjects)
    ? group.subjects.find(
        (item) =>
          item?.roomId ||
          item?.venue ||
          item?.room ||
          item?.building
      )
    : null;

  return (
    subject?.roomId?.floorId?.buildingId?.name ||
    subject?.building ||
    subject?.venue ||
    group?.venue ||
    'School Campus'
  );
};

/* =========================================================
   ADMIT CARD PREVIEW
   Minimal design matching the reference image
========================================================= */

const AdmitCardPreview = ({ style }) => {
  return (
    <div
      className={`
        relative
        flex
        h-[128px]
        w-[172px]
        shrink-0
        items-center
        justify-center
        overflow-hidden
        rounded-xl
        ${style.previewBg}
      `}
    >
      {/* Large soft circle */}
      <div
        className={`
          absolute
          -left-[24px]
          top-1/2
          h-[108px]
          w-[108px]
          -translate-y-1/2
          rounded-full
          ${style.previewCircle1}
        `}
      />

      {/* Secondary overlapping circle */}
      <div
        className={`
          absolute
          left-[20px]
          top-1/2
          h-[78px]
          w-[78px]
          -translate-y-1/2
          rounded-full
          ${style.previewCircle2}
        `}
      />

      {/* Top-right soft glow */}
      <div
        className={`
          absolute
          -right-[24px]
          -top-[24px]
          h-[92px]
          w-[92px]
          rounded-full
          blur-xl
          ${style.previewGlow}
        `}
      />

      {/* Admit Card */}
      <div
        className={`
          relative
          z-10
          h-[91px]
          w-[130px]
          rounded-[10px]
          border
          bg-white
          px-3
          py-2
          shadow-[0_5px_14px_rgba(15,23,42,0.08)]
          ${style.previewBorder}
        `}
      >
        {/* Header */}
        <div
          className={`
            text-center
            text-[8px]
            font-extrabold
            tracking-wide
            ${style.previewTitle}
          `}
        >
          ADMIT CARD
        </div>

        {/* Student row */}
        <div className="mt-2 flex items-center gap-2">
          {/* Avatar */}
          <div
            className={`
              flex
              h-[30px]
              w-[30px]
              shrink-0
              items-center
              justify-center
              rounded-md
              ${style.previewAvatar}
            `}
          >
            <User
              size={17}
              strokeWidth={2}
              className={
                style.previewAvatarIcon
              }
            />
          </div>

          {/* Information lines */}
          <div className="flex flex-1 flex-col gap-[5px]">
            <span
              className={`
                block
                h-[4px]
                w-[42px]
                rounded-full
                ${style.previewLine}
              `}
            />

            <span
              className={`
                block
                h-[4px]
                w-[34px]
                rounded-full
                ${style.previewLineLight}
              `}
            />

            <span
              className={`
                block
                h-[4px]
                w-[27px]
                rounded-full
                ${style.previewLineLight}
              `}
            />
          </div>
        </div>

        {/* Bottom information lines */}
        <div className="mt-2 flex gap-1.5">
          <span
            className={`
              h-[3px]
              w-[42px]
              rounded-full
              ${style.previewLineLight}
            `}
          />

          <span
            className={`
              h-[3px]
              w-[22px]
              rounded-full
              ${style.previewLineLight}
            `}
          />
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   META ITEM
========================================================= */

const MetaItem = ({
  icon: Icon,
  label,
  value,
}) => {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <Icon
          size={14}
          strokeWidth={1.8}
        />
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-medium leading-none text-slate-500">
          {label}
        </p>

        <p className="mt-1 truncate text-xs font-semibold leading-none text-slate-700">
          {value || '—'}
        </p>
      </div>
    </div>
  );
};

/* =========================================================
   MAIN COMPONENT
========================================================= */

// Client cache (memory + sessionStorage, per login & portal) → instant visits.
const ADMIT_CACHE_MAX_AGE = 10 * 60 * 1000;
const admitCacheKey = (mode) => {
  let t = '';
  try { t = localStorage.getItem('token') || ''; } catch { /* ignore */ }
  return `admit-cards:v1:${mode}:${t.slice(-16)}`;
};
const admitMem = new Map();
const readAdmitCache = (mode) => {
  const key = admitCacheKey(mode);
  let entry = admitMem.get(key);
  if (!entry) { try { entry = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { entry = null; } }
  return entry && Date.now() - entry.at < ADMIT_CACHE_MAX_AGE ? entry.data : null;
};
const writeAdmitCache = (mode, data) => {
  const key = admitCacheKey(mode);
  const entry = { at: Date.now(), data };
  admitMem.set(key, entry);
  try { sessionStorage.setItem(key, JSON.stringify(entry)); } catch { /* quota */ }
};

const AdmitCardsView = ({
  mode = 'student',
}) => {
  const navigate = useNavigate();

  const [payload, setPayload] =
    useState(() => readAdmitCache(mode));

  const [loading, setLoading] =
    useState(() => !readAdmitCache(mode));

  // In-app admit card preview: { url, title, group }
  const [preview, setPreview] = useState(null);

  const [error, setError] =
    useState('');

  const [downloadingId, setDownloadingId] =
    useState('');

  const [viewingId, setViewingId] =
    useState('');

  /* =======================================================
     LOAD DATA
  ======================================================= */

  useEffect(() => {
    const load = async () => {
      const token =
        localStorage.getItem('token');

      if (!token) {
        setError(
          'Please login to view admit cards.'
        );

        setLoading(false);

        return;
      }

      const cached = readAdmitCache(mode);
      if (!cached) setLoading(true);
      setError('');

      try {
        const endpoint =
          mode === 'parent'
            ? '/api/exam/groups/parent-admit-cards'
            : '/api/exam/groups/student-admit-cards';

        const res = await apiFetch(
          `${API_BASE}${endpoint}`,
          {
            headers: {
              'Content-Type':
                'application/json',
              authorization: `Bearer ${token}`,
            },
          },
          navigate
        );

        const data =
          await res
            .json()
            .catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data?.error ||
              'Unable to load admit cards'
          );
        }

        setPayload(data);
        writeAdmitCache(mode, data);
      } catch (err) {
        // Keep cached admit cards visible if the background refresh fails.
        if (!cached) setError(
          err.message ||
            'Unable to load admit cards'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [mode, navigate]);

  /* =======================================================
     CHILDREN
  ======================================================= */

  const children = useMemo(() => {
    if (mode === 'parent') {
      return Array.isArray(
        payload?.children
      )
        ? payload.children
        : [];
    }

    if (payload?.student) {
      return [
        {
          ...payload.student,
          groups: Array.isArray(
            payload?.groups
          )
            ? payload.groups
            : [],
        },
      ];
    }

    return [];
  }, [mode, payload]);

  /* =======================================================
     CHILD OPTIONS
  ======================================================= */

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
    childKey,
    setChildKey,
    selectedOption,
  ] = useSharedChildSelection(
    childOptions
  );

  /* =======================================================
     SELECTED CHILD
  ======================================================= */

  const selectedChild =
    children.find(
      (child) =>
        String(
          child.studentId || ''
        ) ===
        String(
          selectedOption?.id || ''
        )
    ) ||
    children[0] ||
    null;

  /* =======================================================
     GROUPS
  ======================================================= */

  const groups = useMemo(() => {
    const items = Array.isArray(
      selectedChild?.groups
    )
      ? selectedChild.groups
      : [];

    return [...items].sort(
      (a, b) => {
        const dateA =
          getExamStartDate(a);

        const dateB =
          getExamStartDate(b);

        if (!dateA && !dateB)
          return 0;

        if (!dateA) return 1;

        if (!dateB) return -1;

        return dateA - dateB;
      }
    );
  }, [selectedChild]);

  /* =======================================================
     PDF HEADER
  ======================================================= */

  const pdfHeader = {
    schoolName:
      payload?.school?.name || '',

    schoolAddressLine:
      payload?.school?.address || '',

    logoUrl:
      payload?.school?.logo || '',

    principalName:
      payload?.principalName || '',

    board: payload?.school?.board || '',
  };

  /* =======================================================
     DOWNLOAD
  ======================================================= */

  const download = async (group) => {
    try {
      setDownloadingId(
        String(group?._id || '')
      );

      await generateAdmitCardPdf({
        student: selectedChild,
        group,
        pdfHeader,
      });

      toast.success(
        'Admit card downloaded'
      );
    } catch (err) {
      toast.error(
        err.message ||
          'Failed to download admit card'
      );
    } finally {
      setDownloadingId('');
    }
  };

  /* =======================================================
     VIEW
  ======================================================= */

  const viewAdmitCard = (group) => {
    setViewingId(
      String(group?._id || '')
    );

    setTimeout(async () => {
      try {
        const blob = await generateAdmitCardPdf({
          student: selectedChild,
          group,
          pdfHeader,
          output: 'blob',
        });
        if (blob) {
          setPreview({ url: URL.createObjectURL(blob), title: group?.title || 'Admit Card', group });
        }
      } catch (err) {
        toast.error(
          err.message ||
            'Unable to open admit card'
        );
      } finally {
        setViewingId('');
      }
    }, 50);
  };

  const closePreview = () => {
    setPreview((cur) => {
      if (cur?.url) setTimeout(() => URL.revokeObjectURL(cur.url), 300);
      return null;
    });
  };
  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closePreview(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-[1250px] items-center gap-2 px-4 py-5 text-sm text-slate-600">
        <Loader2
          className="h-4 w-4 animate-spin text-blue-600"
        />

        Loading admit cards...
      </div>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="mx-auto w-full max-w-[1250px] space-y-4 px-3 py-3 sm:px-4 sm:py-4">

      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-violet-100 bg-violet-50">
            <FileBadge
              size={23}
              strokeWidth={1.8}
              className="text-violet-600"
            />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Admit Cards
            </h1>

            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              Download admit cards for all examinations.
            </p>
          </div>

        </div>

        {/* Child Selector */}

        {mode === 'parent' && selectedChild && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end"
          >
            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2.5 pr-4 shadow-sm">
              {selectedChild.profilePic || selectedChild.photo ? (
                <img src={selectedChild.profilePic || selectedChild.photo} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                  {String(selectedChild.studentName || 'S').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-900">{selectedChild.studentName || 'Student'}</span>
                <span className="block truncate text-xs text-slate-500">
                  {selectedChild.grade ? `Class ${selectedChild.grade}${selectedChild.section ? ` - Section ${selectedChild.section}` : ''}` : 'Student'}
                </span>
              </span>
            </div>
            {childOptions.length > 1 && (
              <ChildSwitcher
                options={childOptions}
                value={childKey}
                onChange={setChildKey}
              />
            )}
          </motion.div>
        )}

      </div>

      {/* ===================================================
          ERROR
      =================================================== */}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* ===================================================
          EMPTY STATE
      =================================================== */}

      {!error &&
        groups.length === 0 && (
          <div className="rounded-xl border border-dashed border-violet-200 bg-white px-5 py-10 text-center shadow-sm">

            <CalendarDays className="mx-auto h-9 w-9 text-violet-300" />

            <p className="mt-3 text-sm font-semibold text-slate-800">
              No admit card available yet
            </p>

            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              Admit cards will appear here once
              the school publishes them.
            </p>

          </div>
        )}

      {/* ===================================================
          EXAM CARDS
      =================================================== */}

      {!error &&
        groups.length > 0 && (
          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          >

            {groups.map(
              (group, index) => {
                const style =
                  getExamStyle(index);

                const status =
                  getExamStatus(group);

                const available =
                  status === 'available';

                const startDate =
                  getExamStartDate(
                    group
                  );

                const subjects =
                  Array.isArray(
                    group?.subjects
                  )
                    ? group.subjects
                    : [];

                const subjectCount =
                  subjects.length;

                const className =
                  selectedChild?.grade
                    ? `Class ${selectedChild.grade}${
                        selectedChild?.section
                          ? ` - Section ${selectedChild.section}`
                          : ''
                      }`
                    : 'Class —';

                return (
                  <motion.section
                    variants={{
                      hidden: { opacity: 0, y: 16 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
                    }}
                    whileHover={{ y: -2 }}
                    key={
                      group?._id ||
                      index
                    }
                    className={`
                      overflow-hidden
                      rounded-xl
                      border
                      bg-white
                      shadow-sm
                      transition-shadow
                      hover:shadow-md
                      ${style.accent}
                    `}
                  >

                    <div
                      className="
                        grid
                        gap-3
                        p-3
                        sm:p-3.5
                        lg:grid-cols-[minmax(0,1fr)_172px_185px]
                        lg:items-center
                      "
                    >

                      {/* =================================
                          LEFT CONTENT
                      ================================= */}

                      <div className="min-w-0">

                        <div className="flex items-start gap-3">

                          {/* Exam Icon */}

                          <div
                            className={`
                              flex
                              h-11
                              w-11
                              shrink-0
                              items-center
                              justify-center
                              rounded-xl
                              border
                              ${style.iconBg}
                              ${style.iconBorder}
                            `}
                          >
                            <FileText
                              size={21}
                              strokeWidth={1.8}
                              className={
                                style.iconColor
                              }
                            />
                          </div>

                          <div className="min-w-0 flex-1">

                            {/* Title */}

                            <div className="flex flex-wrap items-center gap-2">

                              <h2 className="truncate text-base font-bold text-slate-900 sm:text-[17px]">
                                {group?.title ||
                                  'Examination'}
                              </h2>

                              <span
                                className={`
                                  rounded-full
                                  px-2.5
                                  py-1
                                  text-[10px]
                                  font-bold
                                  ${
                                    available
                                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : 'border border-slate-200 bg-slate-100 text-slate-500'
                                  }
                                `}
                              >
                                {available
                                  ? 'Available'
                                  : 'Not Released'}
                              </span>

                            </div>

                            {/* Academic Year */}

                            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">

                              Academic Year:{' '}

                              <span className="font-medium text-slate-600">
                                {group?.academicYearName ||
                                  '—'}
                              </span>

                              <span className="mx-2 text-slate-300">
                                |
                              </span>

                              {group?.term ||
                                group?.termName ||
                                'Exam'}

                            </p>

                          </div>

                        </div>

                        {/* =================================
                            META
                        ================================= */}

                        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50/80 px-2.5 py-2 sm:grid-cols-4">

                          <MetaItem
                            icon={
                              CalendarDays
                            }
                            label="Exam Start"
                            value={
                              startDate
                                ? formatDate(
                                    startDate
                                  )
                                : '—'
                            }
                          />

                          <MetaItem
                            icon={FileText}
                            label="Subjects"
                            value={`${subjectCount} Subject${
                              subjectCount !==
                              1
                                ? 's'
                                : ''
                            }`}
                          />

                          <MetaItem
                            icon={Users}
                            label="Class"
                            value={
                              className
                            }
                          />

                          <MetaItem
                            icon={School}
                            label="Venue"
                            value={getExamVenue(
                              group
                            )}
                          />

                        </div>

                      </div>

                      {/* =================================
                          ADMIT CARD PREVIEW
                      ================================= */}

                      <div className="hidden items-center justify-center lg:flex">

                        <AdmitCardPreview
                          style={style}
                        />

                      </div>

                      {/* =================================
                          ACTIONS
                      ================================= */}

                      <div className="relative isolate flex flex-col gap-2">

                        {/* Decorative circles behind the buttons */}
                        <span aria-hidden="true" className="pointer-events-none absolute -right-6 -top-8 -z-10 h-24 w-24 rounded-full bg-violet-200/40" />
                        <span aria-hidden="true" className="pointer-events-none absolute -bottom-7 -left-5 -z-10 h-16 w-16 rounded-full bg-sky-200/50" />
                        <span aria-hidden="true" className="pointer-events-none absolute -right-2 bottom-2 -z-10 h-8 w-8 rounded-full border-2 border-amber-300/60" />
                        <span aria-hidden="true" className="pointer-events-none absolute left-3 -top-4 -z-10 h-5 w-5 rounded-full bg-pink-200/70" />

                        {/* View */}

                        <button
                          type="button"
                          onClick={() =>
                            viewAdmitCard(
                              group
                            )
                          }
                          disabled={
                            !available ||
                            viewingId ===
                              String(
                                group?._id
                              )
                          }
                          className={`
                            inline-flex
                            h-9
                            w-full
                            items-center
                            justify-center
                            gap-2
                            rounded-lg
                            border
                            bg-white
                            px-3
                            text-xs
                            font-semibold
                            transition
                            sm:h-10
                            sm:text-sm
                            ${style.outline}
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                          `}
                        >

                          {viewingId ===
                          String(
                            group?._id
                          ) ? (
                            <Loader2
                              size={15}
                              className="animate-spin"
                            />
                          ) : (
                            <Eye
                              size={16}
                            />
                          )}

                          View Admit Card

                        </button>

                        {/* Download */}

                        <button
                          type="button"
                          onClick={() =>
                            download(
                              group
                            )
                          }
                          disabled={
                            !available ||
                            downloadingId ===
                              String(
                                group?._id
                              )
                          }
                          className={`
                            inline-flex
                            h-9
                            w-full
                            items-center
                            justify-center
                            gap-2
                            rounded-lg
                            px-3
                            text-xs
                            font-semibold
                            text-white
                            shadow-sm
                            transition
                            sm:h-10
                            sm:text-sm
                            ${style.button}
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                          `}
                        >

                          {downloadingId ===
                          String(
                            group?._id
                          ) ? (
                            <Loader2
                              size={15}
                              className="animate-spin"
                            />
                          ) : (
                            <Download
                              size={16}
                            />
                          )}

                          Download PDF

                        </button>

                      </div>

                    </div>

                    {/* =====================================
                        MOBILE FOOTER
                    ===================================== */}

                    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/40 px-4 py-2.5 lg:hidden">

                      <div className="flex items-center gap-2">

                        <FileBadge
                          size={15}
                          className={
                            style.iconColor
                          }
                        />

                        <span className="text-xs font-medium text-slate-500">
                          {subjectCount}{' '}
                          subjects
                        </span>

                      </div>

                      <span className="max-w-[150px] truncate text-[11px] text-slate-400">
                        {getExamVenue(
                          group
                        )}
                      </span>

                    </div>

                  </motion.section>
                );
              }
            )}

          </motion.div>
        )}

      {/* ===================================================
          FOOTNOTE
      =================================================== */}

      {!error &&
        groups.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-xs text-slate-600">

            <AlertCircle
              size={14}
              className="mt-0.5 shrink-0 text-blue-500"
            />

            <p>
              Please verify the exam date,
              reporting time, and venue on the
              admit card before the examination.
            </p>

          </div>
        )}

      {/* Admit card preview — portal so the dark backdrop covers the whole screen */}
      {createPortal(
        <AnimatePresence>
          {preview && (
            <motion.div
              className="fixed inset-0 z-[9999] flex h-dvh w-screen items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseDown={(e) => { if (e.target === e.currentTarget) closePreview(); }}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={`${preview.title} admit card`}
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                transition={{ duration: 0.22 }}
                className="flex h-full max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{preview.title}</p>
                    <p className="truncate text-xs text-slate-500">{selectedChild?.studentName || ''} · Admit Card</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => download(preview.group)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={closePreview}
                      aria-label="Close preview"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <iframe title={`${preview.title} admit card`} src={preview.url} className="h-full w-full flex-1 bg-slate-100" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};

export default AdmitCardsView;