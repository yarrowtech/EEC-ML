import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowUp,
  ArrowDown,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Leaf,
  Megaphone,
  MessageSquare,
  Users,
  Wallet,
  X,
  UsersRound,
} from 'lucide-react';

import { parentApiJson } from './parentApi';
import useParentChildren from './useParentChildren';
import { normalizeReportCard } from './reportCardShape';

/* ──────────────────────────────────────────────────────────────────────────
   Animation
────────────────────────────────────────────────────────────────────────── */

const RISE = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────────────────── */

const inr = (n) =>
  `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

const validDate = (v) =>
  v && !Number.isNaN(new Date(v).getTime());

const fmtDate = (d) =>
  validDate(d)
    ? new Date(d).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

const dayKey = (d) => {
  const x = new Date(d);

  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(x.getDate()).padStart(2, '0')}`;
};

const to12h = (t) => {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);

  if (!m) return String(t || '');

  const h = Number(m[1]);

  return `${((h + 11) % 12) + 1}:${m[2]} ${
    h >= 12 ? 'PM' : 'AM'
  }`;
};

const initialsOf = (name) =>
  String(name || 'S')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const subjectName = (s) =>
  s?.subject?.name ||
  s?.subjectName ||
  s?.subject ||
  '';

const greetingFor = (h) =>
  h < 12
    ? 'Good Morning'
    : h < 17
      ? 'Good Afternoon'
      : 'Good Evening';

const DASHBOARD_CACHE_PREFIX = 'parent_dashboard_cache_v1';
const DASHBOARD_CACHE_TTL_MS = 3 * 60 * 1000;

const getTokenScope = () => {
  const token = localStorage.getItem('token');

  if (!token) return 'anonymous';

  try {
    const payload = JSON.parse(
      atob(
        token
          .split('.')[1]
          .replace(/-/g, '+')
          .replace(/_/g, '/')
      )
    );

    return `${payload?.id || 'parent'}__`;
  } catch {
    return 'fallback';
  }
};

const dashboardCacheKey = (segment) =>
  `${DASHBOARD_CACHE_PREFIX}:${segment}:${getTokenScope()}`;

const readDashboardCache = (segment) => {
  try {
    const raw = sessionStorage.getItem(
      dashboardCacheKey(segment)
    );

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (
      !parsed?.cachedAt ||
      Date.now() - parsed.cachedAt >
        DASHBOARD_CACHE_TTL_MS
    ) {
      return null;
    }

    return parsed.data || null;
  } catch {
    return null;
  }
};

const writeDashboardCache = (segment, data) => {
  try {
    sessionStorage.setItem(
      dashboardCacheKey(segment),
      JSON.stringify({
        cachedAt: Date.now(),
        data,
      })
    );
  } catch {
    // Storage is best-effort.
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   Count animation
────────────────────────────────────────────────────────────────────────── */

const useCountUp = (target, duration = 750) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const end = Number(target) || 0;

    if (end <= 0) {
      setValue(0);
      return undefined;
    }

    let frame;

    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(
        1,
        (now - start) / duration
      );

      const eased = 1 - (1 - progress) ** 3;

      setValue(Math.round(end * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
};

/* ──────────────────────────────────────────────────────────────────────────
   Theme
────────────────────────────────────────────────────────────────────────── */

const SUBJECT_TONES = [
  {
    tile: 'bg-green-50 text-green-700',
    icon: 'bg-violet-50 text-violet-600',
  },
  {
    tile: 'bg-blue-50 text-blue-700',
    icon: 'bg-red-50 text-red-500',
  },
  {
    tile: 'bg-red-50 text-red-600',
    icon: 'bg-sky-50 text-sky-600',
  },
  {
    tile: 'bg-violet-50 text-violet-700',
    icon: 'bg-amber-50 text-amber-600',
  },
  {
    tile: 'bg-amber-50 text-amber-700',
    icon: 'bg-green-50 text-green-600',
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   Compact Card
────────────────────────────────────────────────────────────────────────── */

const Card = ({
  className = '',
  children,
}) => (
  <section
    className={`
      rounded-xl
      border border-slate-100
      bg-white
      p-3.5
      shadow-[0_2px_10px_rgba(15,23,42,0.035)]
      sm:p-4
      ${className}
    `}
  >
    {children}
  </section>
);

const CardHead = ({
  title,
  to,
  linkLabel = 'View All',
  right,
}) => (
  <div className="mb-2.5 flex items-center justify-between gap-3">
    <h2 className="min-w-0 text-sm font-bold leading-tight text-slate-900 sm:text-[15px]">
      {title}
    </h2>

    {right ||
      (to ? (
        <Link
          to={to}
          className="
            shrink-0
            whitespace-nowrap
            text-xs
            font-semibold
            text-blue-600
            hover:text-blue-700
          "
        >
          {linkLabel}
        </Link>
      ) : null)}
  </div>
);

/* ──────────────────────────────────────────────────────────────────────────
   Delta
────────────────────────────────────────────────────────────────────────── */

const Delta = ({ value }) => {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value) ||
    value === 0
  ) {
    return null;
  }

  const up = value > 0;

  return (
    <span
      className={`
        inline-flex
        items-center
        gap-0.5
        rounded-full
        px-1.5
        py-0.5
        text-[10px]
        font-bold
        ${
          up
            ? 'bg-green-50 text-green-600'
            : 'bg-red-50 text-red-600'
        }
      `}
    >
      {up ? (
        <ArrowUp size={10} strokeWidth={3} />
      ) : (
        <ArrowDown size={10} strokeWidth={3} />
      )}

      {Math.abs(value)}%
    </span>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   Compact Stat Card
────────────────────────────────────────────────────────────────────────── */

const StatCard = ({
  to,
  Icon,
  tone,
  fillIcon = false,
  label,
  value,
  animatedValue,
  formatter,
  delta,
  sub,
  sub2,
}) => {
  const count = useCountUp(animatedValue ?? 0);

  const displayValue =
    animatedValue === null ||
    animatedValue === undefined
      ? value
      : formatter
        ? formatter(count)
        : count.toLocaleString('en-IN');

  return (
    <Link
      to={to}
      className="
        group
        relative
        flex
        min-h-[104px]
        items-center
        gap-3
        rounded-xl
        border border-slate-100
        bg-white
        p-3
        pr-7
        shadow-[0_2px_10px_rgba(15,23,42,0.035)]
        transition
        hover:-translate-y-0.5
        hover:shadow-md
      "
    >
      <span
        className={`
          flex
          h-10
          w-10
          shrink-0
          items-center
          justify-center
          rounded-xl
          ${tone}
        `}
      >
        <Icon
          size={19}
          fill={fillIcon ? 'currentColor' : 'none'}
        />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-600">
          {label}
        </p>

        <div className="mt-0.5 flex items-center gap-1.5">
          <p className="truncate text-lg font-bold leading-tight text-slate-900 tabular-nums sm:text-xl">
            {displayValue}
          </p>

          <Delta value={delta} />
        </div>

        {sub ? (
          <p className="mt-0.5 truncate text-[10px] text-slate-500">
            {sub}
          </p>
        ) : null}

        {sub2 ? (
          <p className="mt-0.5 truncate text-[10px] font-semibold text-red-500">
            {sub2}
          </p>
        ) : null}
      </div>

      <ChevronRight
        size={15}
        className="
          absolute
          right-2.5
          top-3
          text-slate-300
          transition
          group-hover:translate-x-0.5
          group-hover:text-slate-500
        "
      />
    </Link>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   Banner Building
────────────────────────────────────────────────────────────────────────── */

const BannerBuilding = () => (
  <svg
    viewBox="0 0 420 140"
    className="h-full w-auto"
    aria-hidden="true"
  >
    <g
      fill="none"
      stroke="#b9c7de"
      strokeWidth="1.5"
      opacity="0.85"
    >
      <rect
        x="90"
        y="52"
        width="240"
        height="84"
        fill="#eef3fb"
      />

      <polygon
        points="80,54 210,14 340,54"
        fill="#e4ebf7"
      />

      <rect
        x="180"
        y="30"
        width="60"
        height="106"
        fill="#e9eff9"
      />

      <polygon
        points="172,34 210,6 248,34"
        fill="#dfe7f5"
      />

      {[104, 132, 160, 262, 290, 316].map(
        (x) => (
          <g key={x}>
            <rect
              x={x}
              y="66"
              width="16"
              height="22"
              fill="#fff"
            />

            <rect
              x={x}
              y="100"
              width="16"
              height="22"
              fill="#fff"
            />
          </g>
        )
      )}

      <path
        d="M196 136 v-26 a14 14 0 0 1 28 0 v26"
        fill="#dfe7f5"
      />

      <circle
        cx="210"
        cy="50"
        r="8"
        fill="#fff"
      />
    </g>

    <g fill="#cfe3d4" opacity="0.8">
      <ellipse
        cx="46"
        cy="104"
        rx="26"
        ry="34"
      />

      <ellipse
        cx="380"
        cy="108"
        rx="24"
        ry="30"
      />
    </g>
  </svg>
);

/* ──────────────────────────────────────────────────────────────────────────
   Dashboard
────────────────────────────────────────────────────────────────────────── */

const ParentDashboard = ({
  parentName = '',
}) => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const {
    children,
    options,
    setChildKey,
    selected: child,
    loading: childLoading,
    school,
  } = useParentChildren();

  const coverImage = school?.coverImage || '';

  const [pickerOpen, setPickerOpen] =
    useState(false);

  const pickerRef = useRef(null);

  const cachedPortalData = useMemo(
    () => readDashboardCache('portal'),
    []
  );

  const [attendanceKids, setAttendanceKids] =
    useState(
      () =>
        cachedPortalData?.attendanceKids || []
    );

  const [invoices, setInvoices] = useState([]);

  const [reportCards, setReportCards] =
    useState(() =>
      (cachedPortalData?.reportCards || []).map(
        normalizeReportCard
      )
    );

  const [examKids, setExamKids] = useState(
    () => cachedPortalData?.examKids || []
  );

  const [homework, setHomework] = useState([]);

  const [notices, setNotices] = useState(
    () => cachedPortalData?.notices || []
  );

  const [meetings, setMeetings] = useState(
    () => cachedPortalData?.meetings || []
  );

  const [holidays, setHolidays] = useState(
    () => cachedPortalData?.holidays || []
  );

  /* ─────────────────────────────────────────────
     School-wide sources
  ───────────────────────────────────────────── */

  useEffect(() => {
    let off = false;

    Promise.allSettled([
      parentApiJson(
        '/api/attendance/parent/children',
        {},
        navigate
      ),

      parentApiJson(
        '/api/reports/report-cards/parent',
        {},
        navigate
      ),

      parentApiJson(
        '/api/exam/groups/parent-schedule',
        {},
        navigate
      ),

      parentApiJson(
        '/api/notifications/user?kind=notice',
        {},
        navigate
      ),

      parentApiJson(
        '/api/meeting/parent/my-meetings',
        {},
        navigate
      ),

      parentApiJson(
        '/api/holidays/parent',
        {},
        navigate
      ),
    ]).then(
      ([a, r, e, n, m, h]) => {
        if (off) return;

        const ok = (x) =>
          x.status === 'fulfilled'
            ? x.value
            : null;

        const nextPortalData = {
          attendanceKids:
            ok(a)?.children || [],

          reportCards:
            ok(r)?.reportCards || [],

          examKids:
            ok(e)?.children || [],

          notices:
            Array.isArray(ok(n))
              ? ok(n)
              : [],

          meetings:
            Array.isArray(ok(m))
              ? ok(m)
              : [],

          holidays: (() => {
            const hv = ok(h);

            return Array.isArray(hv)
              ? hv
              : hv?.holidays || [];
          })(),
        };

        setAttendanceKids(
          nextPortalData.attendanceKids
        );

        setReportCards(
          nextPortalData.reportCards.map(
            normalizeReportCard
          )
        );

        setExamKids(
          nextPortalData.examKids
        );

        setNotices(
          nextPortalData.notices
        );

        setMeetings(
          nextPortalData.meetings
        );

        setHolidays(
          nextPortalData.holidays
        );

        writeDashboardCache(
          'portal',
          nextPortalData
        );
      }
    );

    return () => {
      off = true;
    };
  }, [navigate]);

  /* ─────────────────────────────────────────────
     Per-child sources
  ───────────────────────────────────────────── */

  useEffect(() => {
    if (!child?.id) return undefined;

    const childCacheKey = `child:${child.id}`;

    const cachedChildData =
      readDashboardCache(childCacheKey);

    if (cachedChildData) {
      setInvoices(
        cachedChildData.invoices || []
      );

      setHomework(
        cachedChildData.homework || []
      );
    }

    let off = false;

    const q = encodeURIComponent(child.id);

    Promise.allSettled([
      parentApiJson(
        `/api/fees/parent/invoices?studentId=${q}`,
        {},
        navigate
      ),

      parentApiJson(
        `/api/assignment/parent/assignments?studentId=${q}`,
        {},
        navigate
      ),
    ]).then(([f, hw]) => {
      if (off) return;

      const nextChildData = {
        invoices:
          f.status === 'fulfilled'
            ? f.value?.invoices || []
            : [],

        homework:
          hw.status === 'fulfilled' &&
          Array.isArray(hw.value)
            ? hw.value
            : [],
      };

      setInvoices(
        nextChildData.invoices
      );

      setHomework(
        nextChildData.homework
      );

      writeDashboardCache(
        childCacheKey,
        nextChildData
      );
    });

    return () => {
      off = true;
    };
  }, [child?.id, navigate]);

  /* ─────────────────────────────────────────────
     Close picker
  ───────────────────────────────────────────── */

  useEffect(() => {
    const close = (e) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target)
      ) {
        setPickerOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      close
    );

    return () =>
      document.removeEventListener(
        'mousedown',
        close
      );
  }, []);

  /* ─────────────────────────────────────────────
     Attendance
  ───────────────────────────────────────────── */

  const attendance = useMemo(() => {
    const entry =
      attendanceKids.find(
        (k) =>
          String(
            k?.student?._id ||
              k?.student?.id
          ) === String(child?.id)
      ) || null;

    const records = Array.isArray(
      entry?.records
    )
      ? entry.records
      : [];

    const now = new Date();

    const monthKey = (d) =>
      String(d).slice(0, 7);

    const thisM = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}`;

    const prev = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    const prevM = `${prev.getFullYear()}-${String(
      prev.getMonth() + 1
    ).padStart(2, '0')}`;

    const pct = (list) =>
      list.length
        ? Math.round(
            (list.filter(
              (r) => r.status === 'present'
            ).length /
              list.length) *
              100
          )
        : null;

    const cur = records.filter(
      (r) =>
        monthKey(r.date) === thisM
    );

    const last = records.filter(
      (r) =>
        monthKey(r.date) === prevM
    );

    const summary =
      entry?.monthlySummary || {};

    // Overall attendance across all recorded days, not just this month.
    const percent =
      pct(records) ??
      summary.attendancePercentage ??
      0;

    const curPct = pct(cur);
    const lastPct = pct(last);

    const today = records.find(
      (r) => r.date === dayKey(now)
    );

    return {
      percent,
      delta:
        curPct === null || lastPct === null
          ? null
          : curPct - lastPct,

      present: records.length
        ? records.filter(
            (r) => r.status === 'present'
          ).length
        : summary.presentDays || 0,

      total:
        records.length ||
        summary.totalClasses ||
        0,

      today,
    };
  }, [attendanceKids, child?.id]);

  /* ─────────────────────────────────────────────
     Fees
  ───────────────────────────────────────────── */

  const fees = useMemo(() => {
    const open = invoices
      .filter(
        (i) =>
          Number(i.balanceAmount) > 0
      )
      .sort(
        (a, b) =>
          new Date(
            a.dueDate || 8.64e15
          ) -
          new Date(
            b.dueDate || 8.64e15
          )
      );

    const due = open.reduce(
      (s, i) =>
        s + Number(i.balanceAmount || 0),
      0
    );

    const focus =
      open[0] ||
      invoices
        .slice()
        .sort(
          (a, b) =>
            new Date(
              b.dueDate || 0
            ) -
            new Date(
              a.dueDate || 0
            )
        )[0] ||
      null;

    const total =
      Number(focus?.totalAmount || 0) -
      Number(focus?.discountAmount || 0);

    const paid =
      Number(focus?.paidAmount || 0);

    return {
      due,
      fullyPaid:
        invoices.length > 0 && due <= 0,
      focus,
      total: Math.max(total, 0),
      paid,
      balance: Number(
        focus?.balanceAmount || 0
      ),
    };
  }, [invoices]);

  /* ─────────────────────────────────────────────
     Results
  ───────────────────────────────────────────── */

  const results = useMemo(() => {
    const card =
      reportCards.find(
        (c) =>
          String(c.studentId) ===
          String(child?.id)
      ) || null;

    const exams = card?.exams || [];

    const byExam = new Map();

    exams.forEach((x) => {
      const key =
        x.examName ||
        x.term ||
        'Exam';

      if (!byExam.has(key)) {
        byExam.set(key, {
          name: key,
          date: x.date,
          rows: [],
        });
      }

      const g = byExam.get(key);

      if (
        validDate(x.date) &&
        (!validDate(g.date) ||
          new Date(x.date) >
            new Date(g.date))
      ) {
        g.date = x.date;
      }

      g.rows.push(x);
    });

    const groups = [
      ...byExam.values(),
    ].sort(
      (a, b) =>
        new Date(b.date || 0) -
        new Date(a.date || 0)
    );

    const avg = (g) => {
      const ob = g.rows.reduce(
        (s, r) =>
          s +
          Number(
            r.obtainedMarks || 0
          ),
        0
      );

      const tot = g.rows.reduce(
        (s, r) =>
          s +
          Number(
            r.totalMarks || 0
          ),
        0
      );

      return tot > 0
        ? Math.round(
            (ob / tot) * 100
          )
        : null;
    };

    const recent = groups
      .slice(0, 3)
      .map(avg)
      .filter(
        (v) => v !== null
      );

    const average = recent.length
      ? Math.round(
          recent.reduce(
            (s, v) => s + v,
            0
          ) / recent.length
        )
      : null;

    const delta =
      groups.length >= 2 &&
      avg(groups[0]) !== null &&
      avg(groups[1]) !== null
        ? avg(groups[0]) -
          avg(groups[1])
        : null;

    return {
      latest: groups[0] || null,
      average,
      delta,
      count: recent.length,
    };
  }, [reportCards, child?.id]);

  /* ─────────────────────────────────────────────
     Exams
  ───────────────────────────────────────────── */

  const upcomingExams = useMemo(() => {
    const kid =
      examKids.find(
        (c) =>
          String(c.studentId) ===
          String(child?.id)
      ) || examKids[0];

    const today = new Date(
      new Date().toDateString()
    );

    const rows = [];

    (kid?.groups || []).forEach(
      (g) =>
        (g.subjects || []).forEach(
          (s) => {
            if (
              validDate(s.date) &&
              new Date(s.date) >= today
            ) {
              rows.push({
                date: new Date(s.date),
                subject:
                  subjectName(s) ||
                  g.title ||
                  'Exam',

                name: `${subjectName(
                  s
                )} ${g.title || ''}`.trim(),

                time: to12h(
                  s.startTime ||
                    s.time
                ),
              });
            }
          }
        )
    );

    return rows.sort(
      (a, b) => a.date - b.date
    );
  }, [examKids, child?.id]);

  /* ─────────────────────────────────────────────
     Events
  ───────────────────────────────────────────── */

  const events = useMemo(() => {
    const today = new Date(
      new Date().toDateString()
    );

    const list = [];

    upcomingExams
      .slice(0, 3)
      .forEach((x) =>
        list.push({
          kind: 'exam',
          date: x.date,
          title: x.name,
          sub: `${fmtDate(
            x.date
          )}${x.time ? `  |  ${x.time}` : ''}`,
        })
      );

    meetings.forEach((m) => {
      if (
        !validDate(m.meetingDate) ||
        new Date(m.meetingDate) < today
      ) {
        return;
      }

      if (
        m.studentId &&
        child?.id &&
        String(
          m.studentId?._id ||
            m.studentId
        ) !== String(child.id)
      ) {
        return;
      }

      list.push({
        kind: 'ptm',
        date: new Date(
          m.meetingDate
        ),
        title:
          m.title ||
          'Parent Teacher Meeting',

        sub: `${fmtDate(
          m.meetingDate
        )}${
          m.meetingTime
            ? `  |  ${to12h(
                m.meetingTime
              )}`
            : ''
        }`,
      });
    });

    holidays.forEach((h) => {
      const start =
        h.startDate || h.date;

      if (!validDate(start)) return;

      const end = validDate(h.endDate)
        ? h.endDate
        : start;

      if (new Date(end) < today)
        return;

      const s = new Date(start);
      const e = new Date(end);

      const range =
        dayKey(s) === dayKey(e)
          ? fmtDate(s)
          : `${s.getDate()} – ${fmtDate(
              e
            )}`;

      list.push({
        kind: 'holiday',
        date: s,
        title:
          h.name ||
          h.title ||
          'Holiday',
        sub: range,
      });
    });

    return list
      .sort(
        (a, b) =>
          a.date - b.date
      )
      .slice(0, 3);
  }, [
    upcomingExams,
    meetings,
    holidays,
    child?.id,
  ]);

  /* ─────────────────────────────────────────────
     Recent items
  ───────────────────────────────────────────── */

  const recentHomework = useMemo(
    () =>
      homework
        .slice()
        .sort(
          (a, b) =>
            new Date(
              b.createdAt || 0
            ) -
            new Date(
              a.createdAt || 0
            )
        )
        .slice(0, 3),
    [homework]
  );

  const recentNotices = useMemo(
    () =>
      notices
        .slice()
        .sort(
          (a, b) =>
            new Date(
              b.createdAt || 0
            ) -
            new Date(
              a.createdAt || 0
            )
        )
        .slice(0, 3),
    [notices]
  );

  /* ─────────────────────────────────────────────
     General UI values
  ───────────────────────────────────────────── */

  const firstName = String(
    parentName || ''
  ).trim();

  const greeting = `${
    greetingFor(
      new Date().getHours()
    )
  }${firstName ? `, ${firstName}` : ''}`;

  const nextExam =
    upcomingExams[0];

  const todayLabel =
    new Date().toLocaleDateString(
      'en-GB',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }
    ) +
    ` (${new Date().toLocaleDateString(
      'en-US',
      { weekday: 'short' }
    )})`;

  const todayStatus =
    attendance.today?.status;

  const classLine = child
    ? `Class ${child.grade || '—'}${
        child.section
          ? ` - Section ${child.section}`
          : ''
      }`
    : '';

  const Avatar = ({
    size = 'h-10 w-10',
    text = 'text-sm',
  }) =>
    child?.photo ? (
      <img
        src={child.photo}
        alt={child.name}
        className={`${size} shrink-0 rounded-full object-cover`}
      />
    ) : (
      <span
        className={`
          ${size}
          ${text}
          flex
          shrink-0
          items-center
          justify-center
          rounded-full
          bg-violet-100
          font-bold
          text-violet-700
        `}
      >
        {initialsOf(child?.name)}
      </span>
    );

  /* ────────────────────────────────────────────────────────────────────────
     Render
  ──────────────────────────────────────────────────────────────────────── */

  return (
    <motion.div
      data-testid="parent-dashboard"
      className="
        mx-auto
        flex
        min-h-screen
        max-w-6xl
        flex-col
        gap-3
        bg-slate-50
        p-3
        sm:gap-3.5
        sm:p-4
        lg:p-5
      "
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren:
              reduceMotion ? 0 : 0.06,
            delayChildren: 0.03,
          },
        },
      }}
    >
      {/* ─────────────────────────────────────
          Greeting
      ───────────────────────────────────── */}

      <motion.div
        variants={RISE}
        className="
          flex
          flex-col
          gap-2
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >
        <div>
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
            {greeting}
          </h1>

          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            Here&apos;s an overview of your
            child&apos;s academic journey.
          </p>
        </div>

        {child && (
          <div
            className="relative"
            ref={pickerRef}
          >
            <button
              type="button"
              onClick={() =>
                options.length > 1 &&
                setPickerOpen(
                  (o) => !o
                )
              }
              className="
                flex
                w-full
                items-center
                gap-2.5
                rounded-xl
                border border-slate-200
                bg-white
                px-2.5
                py-2
                pr-3
                text-left
                shadow-sm
                sm:w-64
              "
              aria-haspopup={
                options.length > 1
                  ? 'listbox'
                  : undefined
              }
              aria-expanded={pickerOpen}
            >
              <Avatar
                size="h-8 w-8"
                text="text-xs"
              />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-slate-900">
                  {child.name}
                </span>

                <span className="block truncate text-[10px] text-slate-500">
                  {classLine}
                </span>
              </span>

              {options.length > 1 && (
                <ChevronDown
                  size={15}
                  className={`
                    text-slate-400
                    transition
                    ${
                      pickerOpen
                        ? 'rotate-180'
                        : ''
                    }
                  `}
                />
              )}
            </button>

            {pickerOpen && (
              <ul
                role="listbox"
                className="
                  absolute
                  right-0
                  z-20
                  mt-1.5
                  w-full
                  overflow-hidden
                  rounded-xl
                  border border-slate-100
                  bg-white
                  shadow-xl
                "
              >
                {children.map(
                  (c, i) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const o =
                            options[i];

                          setChildKey(
                            `${
                              o.id || ''
                            }::${
                              o.name || ''
                            }`
                          );

                          setPickerOpen(
                            false
                          );
                        }}
                        className={`
                          flex
                          w-full
                          items-center
                          gap-2.5
                          px-2.5
                          py-2
                          text-left
                          hover:bg-slate-50
                          ${
                            c.id ===
                            child.id
                              ? 'bg-violet-50'
                              : ''
                          }
                        `}
                      >
                        {c.photo ? (
                          <img
                            src={c.photo}
                            alt=""
                            className="
                              h-7
                              w-7
                              rounded-full
                              object-cover
                            "
                          />
                        ) : (
                          <span
                            className="
                              flex
                              h-7
                              w-7
                              items-center
                              justify-center
                              rounded-full
                              bg-violet-100
                              text-[10px]
                              font-bold
                              text-violet-700
                            "
                          >
                            {initialsOf(
                              c.name
                            )}
                          </span>
                        )}

                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-slate-800">
                            {c.name}
                          </span>

                          <span className="block text-[10px] text-slate-500">
                            Class {c.grade}
                            {c.section
                              ? ` - Section ${c.section}`
                              : ''}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        )}
      </motion.div>

      {/* ─────────────────────────────────────
          Child Banner
      ───────────────────────────────────── */}

      <motion.section
        variants={RISE}
        className="
          relative
          overflow-hidden
          rounded-xl
          border border-blue-100
          bg-gradient-to-r
          from-sky-50
          via-blue-50
          to-sky-100/70
        "
      >
        {coverImage ? (
          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              inset-0
              overflow-hidden
            "
          >
            <div
              className="
                absolute
                -inset-4
                scale-105
                bg-cover
                bg-center
                opacity-50
                blur-[3px]
              "
              style={{
                backgroundImage: `url(${coverImage})`,
              }}
            />

            <div className="absolute inset-0 bg-gradient-to-r from-sky-50/95 via-sky-50/75 to-white/30" />
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-y-0 right-16 hidden opacity-60 md:block lg:right-40">
            <BannerBuilding />
          </div>
        )}

        <div
          className="
            relative
            flex
            items-center
            gap-3
            px-3
            py-3
            sm:px-4
            sm:py-3.5
          "
        >
          {child ? (
            <Avatar
              size="h-14 w-14 sm:h-16 sm:w-16"
              text="text-lg"
            />
          ) : (
            <span className="h-14 w-14 animate-pulse rounded-full bg-white/70" />
          )}

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold text-slate-900 sm:text-base">
              {child?.name ||
                (childLoading
                  ? 'Loading…'
                  : 'No child linked')}
            </h2>

            {child && (
              <p className="mt-0.5 text-xs font-semibold text-slate-700">
                {classLine}
              </p>
            )}

            {child && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                <span>
                  ID:{' '}
                  <strong>
                    {child.admissionNumber ||
                      child.studentCode ||
                      '—'}
                  </strong>
                </span>

                <span className="text-slate-300">
                  |
                </span>

                <span>
                  Roll:{' '}
                  <strong>
                    {child.roll !== '' &&
                    child.roll !== null &&
                    child.roll !==
                      undefined
                      ? child.roll
                      : '—'}
                  </strong>
                </span>
              </div>
            )}
          </div>

          <p
            className="
              hidden
              shrink-0
              rotate-[-4deg]
              text-right
              font-[cursive]
              text-sm
              leading-snug
              text-slate-600
              lg:block
          "
          >
            “Keep learning,
            <br />
            keep growing!”{' '}
            <span className="text-amber-400">
              ☀
            </span>
          </p>
        </div>
      </motion.section>

      {/* ─────────────────────────────────────
          Stat Cards
      ───────────────────────────────────── */}

      <motion.div
        variants={RISE}
        className="
          grid
          grid-cols-2
          gap-2.5
          xl:grid-cols-4
        "
      >
        <StatCard
          to="/parents/attendance"
          Icon={UsersRound}
          tone="bg-green-50 text-green-600"
          fillIcon
          label="Attendance"
          value={`${attendance.percent}%`}
          animatedValue={attendance.percent}
          formatter={(n) => `${n}%`}
          delta={attendance.delta}
          sub={`Present: ${attendance.present} / ${attendance.total}`}
        />

        <StatCard
          to="/parents/fees"
          Icon={Wallet}
          tone="bg-red-50 text-red-500"
          label="Fee Due"
          value={
            fees.fullyPaid
              ? 'Fully Paid'
              : inr(fees.due)
          }
          animatedValue={
            fees.fullyPaid
              ? undefined
              : fees.due
          }
          formatter={inr}
          sub2={
            !fees.fullyPaid &&
            fees.focus &&
            validDate(
              fees.focus.dueDate
            )
              ? `Due: ${fmtDate(
                  fees.focus.dueDate
                )}`
              : ''
          }
        />

        <StatCard
          to="/parents/academic"
          Icon={BarChart3}
          tone="bg-violet-50 text-violet-600"
          label="Average Marks"
          value={
            results.average === null
              ? '—'
              : `${results.average}%`
          }
          animatedValue={
            results.average ?? null
          }
          formatter={(n) => `${n}%`}
          delta={results.delta}
          sub={
            results.count
              ? `Last ${results.count} Exam${
                  results.count > 1
                    ? 's'
                    : ''
                }`
              : 'No results yet'
          }
        />

        <StatCard
          to="/parents/exam-routine"
          Icon={CalendarDays}
          tone="bg-amber-50 text-amber-500"
          label="Upcoming Exam"
          value={
            nextExam
              ? nextExam.subject
              : 'No Upcoming Exam'
          }
          animatedValue={null}
          sub={
            nextExam
              ? `${fmtDate(
                  nextExam.date
                )}${
                  nextExam.time
                    ? ` | ${nextExam.time}`
                    : ''
                }`
              : 'Check back later'
          }
        />
      </motion.div>

      {/* ─────────────────────────────────────
          Attendance / Fee / Events
      ───────────────────────────────────── */}

      <motion.div
        variants={RISE}
        className="
          grid
          grid-cols-1
          gap-3
          lg:grid-cols-3
        "
      >
        {/* Attendance */}

        <Card>
          <CardHead
            title="Today's Attendance"
            right={
              <span className="text-[10px] text-slate-400">
                {todayLabel}
              </span>
            }
          />

          <Link
            to="/parents/attendance"
            className={`
              flex
              items-center
              gap-2.5
              rounded-lg
              border
              px-3
              py-2.5
              transition
              hover:shadow-sm
              ${
                todayStatus ===
                'present'
                  ? 'border-green-200 bg-green-50'
                  : todayStatus ===
                      'absent'
                    ? 'border-red-100 bg-red-50'
                    : 'border-slate-100 bg-slate-50'
              }
            `}
          >
            <span
              className={`
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                rounded-full
                text-white
                ${
                  todayStatus ===
                  'present'
                    ? 'bg-green-600'
                    : todayStatus ===
                        'absent'
                      ? 'bg-red-500'
                      : 'bg-slate-400'
                }
              `}
            >
              {todayStatus ===
              'absent' ? (
                <X
                  size={17}
                  strokeWidth={3}
                />
              ) : (
                <Check
                  size={17}
                  strokeWidth={3}
                />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={`
                  block
                  text-sm
                  font-bold
                  leading-tight
                  ${
                    todayStatus ===
                    'present'
                      ? 'text-green-700'
                      : todayStatus ===
                          'absent'
                        ? 'text-red-600'
                        : 'text-slate-600'
                  }
                `}
              >
                {todayStatus ===
                'present'
                  ? 'Present'
                  : todayStatus ===
                      'absent'
                    ? 'Absent'
                    : 'Not marked yet'}
              </span>

              <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                {todayStatus
                  ? attendance
                      .today
                      ?.markedAt
                    ? `Marked at ${new Date(
                        attendance.today.markedAt
                      ).toLocaleTimeString(
                        'en-US',
                        {
                          hour: 'numeric',
                          minute: '2-digit',
                        }
                      )}`
                    : 'Marked for today'
                  : 'Attendance will appear once marked'}
              </span>
            </span>

            <ChevronRight
              size={15}
              className="text-slate-400"
            />
          </Link>
        </Card>

        {/* Fee */}

        <Card>
          <CardHead
            title="Fee Summary"
            to="/parents/fees"
            linkLabel="View Details"
          />

          {fees.focus ? (
            <>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-green-600"
                  style={{
                    width: `${
                      fees.total > 0
                        ? Math.min(
                            100,
                            (fees.paid /
                              fees.total) *
                              100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="min-w-0 bg-green-100 px-2.5 py-1.5 text-center rounded-lg">
                  <p className="text-[10px] text-slate-800 font-bold">
                    Paid
                  </p>

                  <p
                    className="truncate text-sm font-bold text-green-600"
                    title={inr(
                      fees.paid
                    )}
                  >
                    {inr(fees.paid)}
                  </p>
                </div>

                <div className="min-w-0 bg-red-100 px-2.5 py-1.5 text-center rounded-lg">
                  <p className="text-[10px] text-slate-800 font-bold">
                    Due
                  </p>

                  <p
                    className="truncate text-sm font-bold text-red-600"
                    title={inr(
                      fees.balance
                    )}
                  >
                    {inr(
                      fees.balance
                    )}
                  </p>
                </div>

                <div className="min-w-0 bg-slate-100 px-2.5 py-1.5 text-center rounded-lg">
                  <p className="text-[10px] text-slate-800 font-bold">
                    Total
                  </p>

                  <p
                    className="truncate text-sm font-bold text-slate-900"
                    title={inr(
                      fees.total
                    )}
                  >
                    {inr(fees.total)}
                  </p>
                </div>
              </div>

              {fees.balance > 0 && (
                <Link
                  to="/parents/fees"
                  className="
                    mt-3
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-1.5
                    rounded-lg
                    bg-violet-500
                    px-3
                    py-2
                    text-xs
                    font-semibold
                    text-white
                    shadow-sm
                    hover:bg-violet-600
                  "
                >
                  <CreditCard
                    size={15}
                  />
                  Pay Now
                </Link>
              )}
            </>
          ) : (
            <p className="rounded-lg bg-slate-50 py-5 text-center text-xs text-slate-500">
              No fee invoices yet
            </p>
          )}
        </Card>

        {/* Events */}

        <Card>
          <CardHead
            title="Upcoming Events"
            to="/parents/calendar"
          />

          {events.length === 0 ? (
            <p className="rounded-lg bg-slate-50 py-5 text-center text-xs text-slate-500">
              Nothing coming up
            </p>
          ) : (
            <ul className="space-y-0.5">
              {events.map(
                (ev, i) => {
                  const cfg =
                    ev.kind === 'exam'
                      ? {
                          Icon: CalendarDays,
                          cls: 'bg-blue-50 text-blue-600',
                        }
                      : ev.kind ===
                          'ptm'
                        ? {
                            Icon: Users,
                            cls: 'bg-red-50 text-red-500',
                          }
                        : {
                            Icon: Leaf,
                            cls: 'bg-green-50 text-green-600',
                          };

                  return (
                    <li
                      key={i}
                      className="flex items-center gap-2.5 py-1.5 px-1.5 bg-gray-200/65 rounded-lg"
                    >
                      <span
                        className={`
                          flex
                          h-8
                          w-8
                          shrink-0
                          items-center
                          justify-center
                          rounded-lg
                          ${cfg.cls}
                        `}
                      >
                        <cfg.Icon
                          size={15}
                        />
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-900">
                          {ev.title}
                        </span>

                        <span className="block truncate text-[10px] text-slate-500">
                          {ev.sub}
                        </span>
                      </span>
                    </li>
                  );
                }
              )}
            </ul>
          )}
        </Card>
      </motion.div>

      {/* ─────────────────────────────────────
          Homework / Notices
      ───────────────────────────────────── */}

      <motion.div
        variants={RISE}
        className="
          grid
          grid-cols-1
          gap-3
          lg:grid-cols-2
        "
      >
        {/* Homework */}

        <Card>
          <CardHead
            title="Recent Homework"
            to="/parents/homework"
          />

          {recentHomework.length ===
          0 ? (
            <p className="rounded-lg bg-slate-50 py-5 text-center text-xs text-slate-500">
              No homework yet
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentHomework.map(
                (a, i) => {
                  const pending =
                    !a.submissionStatus ||
                    a.submissionStatus ===
                      'not_submitted';

                  const tone =
                    SUBJECT_TONES[
                      i %
                        SUBJECT_TONES.length
                    ].icon;

                  return (
                    <li
                      key={a._id}
                      className="
                        flex
                        items-center
                        gap-2.5
                        py-2
                        first:pt-0
                        last:pb-0
                      "
                    >
                      <span
                        className={`
                          flex
                          h-9
                          w-9
                          shrink-0
                          items-center
                          justify-center
                          rounded-lg
                          ${tone}
                        `}
                      >
                        <BookOpen
                          size={17}
                        />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-slate-900">
                          {subjectName(
                            a
                          ) ||
                            'General'}
                        </span>

                        <span
                          className="block truncate text-xs text-slate-600"
                          title={a.title}
                        >
                          {a.title}
                        </span>

                        {validDate(
                          a.dueDate
                        ) && (
                          <span className="mt-0.5 block text-[10px] text-slate-400">
                            Due:{' '}
                            {fmtDate(
                              a.dueDate
                            )}
                          </span>
                        )}
                      </span>

                      <span
                        className={`
                          shrink-0
                          rounded-full
                          px-2
                          py-1
                          text-[10px]
                          font-semibold
                          ${
                            pending
                              ? 'bg-orange-50 text-orange-500'
                              : 'bg-green-50 text-green-600'
                          }
                        `}
                      >
                        {pending
                          ? 'Pending'
                          : 'Submitted'}
                      </span>
                    </li>
                  );
                }
              )}
            </ul>
          )}
        </Card>

        {/* Notices */}

        <Card>
          <CardHead
            title="Recent Notices"
            to="/parents/notices"
          />

          {recentNotices.length ===
          0 ? (
            <p className="rounded-lg bg-slate-50 py-5 text-center text-xs text-slate-500">
              No notices yet
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentNotices.map(
                (n) => {
                  const label =
                    String(
                      n.typeLabel ||
                        n.title ||
                        ''
                    ).toLowerCase();

                  const cfg =
                    /holiday/.test(
                      label
                    )
                      ? {
                          Icon: Megaphone,
                          cls: 'bg-red-50 text-red-500',
                        }
                      : /ptm|meeting|parent/.test(
                            label
                          )
                        ? {
                            Icon: Users,
                            cls: 'bg-violet-50 text-violet-600',
                          }
                        : {
                            Icon: FileText,
                            cls: 'bg-blue-50 text-blue-600',
                          };

                  return (
                    <li
                      key={n._id}
                      className="py-1.5 first:pt-0 last:pb-0"
                    >
                      <Link
                        to="/parents/notices"
                        state={{
                          openNoticeId:
                            n._id,
                        }}
                        className="
                          -mx-1.5
                          flex
                          items-center
                          gap-2.5
                          rounded-lg
                          px-1.5
                          py-1.5
                          transition
                          hover:bg-slate-50
                        "
                      >
                        <span
                          className={`
                            flex
                            h-9
                            w-9
                            shrink-0
                            items-center
                            justify-center
                            rounded-lg
                            ${cfg.cls}
                          `}
                        >
                          <cfg.Icon
                            size={17}
                          />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-slate-900">
                            {n.title}
                          </span>

                          {n.message ? (
                            <span className="block truncate text-[10px] text-slate-500">
                              {
                                n.message
                              }
                            </span>
                          ) : null}
                        </span>

                        <span className="shrink-0 text-[10px] text-slate-400">
                          {fmtDate(
                            n.createdAt
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                }
              )}
            </ul>
          )}
        </Card>
      </motion.div>

      {/* ─────────────────────────────────────
          Latest Result / Quick Actions
      ───────────────────────────────────── */}

      <motion.div
        variants={RISE}
        className="
          grid
          grid-cols-1
          gap-3
          lg:grid-cols-2
        "
      >
        {/* Latest Result */}

        <Card>
          <CardHead
            title="Latest Exam Result"
            to="/parents/academic"
          />

          {results.latest ? (
            <div className="rounded-lg border border-slate-100 p-2.5">
              <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-xs font-bold text-slate-900">
                  {results.latest.name}
                </span>

                {validDate(
                  results.latest.date
                ) && (
                  <span className="text-[10px] text-slate-400">
                    {fmtDate(
                      results.latest.date
                    )}
                  </span>
                )}

                <Link
                  to="/parents/academic"
                  className="
                    ml-auto
                    rounded-md
                    bg-blue-50
                    px-2
                    py-1
                    text-[10px]
                    font-semibold
                    text-blue-600
                    hover:bg-blue-100
                  "
                >
                  View Report
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {results.latest.rows.map(
                  (r, i) => (
                    <div
                      key={`${r.subject}-${i}`}
                      className={`
                        rounded-lg
                        px-2.5
                        py-2
                        ${
                          SUBJECT_TONES[
                            i %
                              SUBJECT_TONES.length
                          ].tile
                        }
                      `}
                    >
                      <p className="truncate text-[10px] font-medium">
                        {r.subject ||
                          'Subject'}
                      </p>

                      <p className="text-sm font-bold">
                        {Number(
                          r.obtainedMarks ||
                            0
                        )}
                        /
                        {Number(
                          r.totalMarks ||
                            0
                        )}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 py-5 text-center text-xs text-slate-500">
              No published results yet
            </p>
          )}
        </Card>

        {/* Quick Actions */}

        <Card>
          <CardHead title="Quick Actions" />

          <div className="grid grid-cols-5 gap-2">
            {[
              {
                to: '/parents/fees',
                label: 'Pay Fees',
                Icon: Wallet,
                cls: 'bg-red-50 text-red-500',
              },

              {
                to: '/parents/attendance',
                label: 'Attendance',
                Icon: Users,
                cls: 'bg-green-50 text-green-600',
              },

              {
                to: '/parents/academic',
                label: 'Results',
                Icon: BarChart3,
                cls: 'bg-violet-50 text-violet-600',
              },

              {
                to: '/parents/excuse-letters',
                label: 'Apply Leave',
                Icon: ClipboardList,
                cls: 'bg-amber-50 text-amber-500',
              },

              {
                to: '/parents/chat',
                label: 'Message',
                Icon: MessageSquare,
                cls: 'bg-blue-50 text-blue-600',
              },
            ].map(
              ({
                to,
                label,
                Icon,
                cls,
              }) => (
                <Link
                  key={to}
                  to={to}
                  className="
                    group
                    flex
                    min-w-0
                    flex-col
                    items-center
                    gap-1.5
                    text-center
                  "
                >
                  <span
                    className={`
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-xl
                      transition
                      group-hover:-translate-y-0.5
                      ${cls}
                    `}
                  >
                    <Icon size={18} />
                  </span>

                  <span className="truncate text-[9px] font-medium text-slate-600 sm:text-[10px]">
                    {label}
                  </span>
                </Link>
              )
            )}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default ParentDashboard;