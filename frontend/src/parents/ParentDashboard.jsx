import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Bell,
  CalendarCheck,
  Clock,
  IndianRupee,
  LayoutGrid,
  ReceiptText,
  Trophy,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
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

const NAVY = 'text-[#0b1446]';

const Card = ({
  className = '',
  children,
}) => (
  <section
    className={`
      rounded-2xl
      border border-white
      bg-white
      p-3
      shadow-[0_4px_18px_rgba(30,64,175,0.06)]
      sm:p-3.5
      ${className}
    `}
  >
    {children}
  </section>
);

const CardHead = ({
  title,
  icon: HeadIcon,
  to,
  linkLabel = 'View All',
  right,
}) => (
  <div className="mb-2.5 flex items-center justify-between gap-3">
    <h2 className={`flex min-w-0 items-center gap-1.5 text-sm font-bold leading-tight ${NAVY}`}>
      {HeadIcon ? <HeadIcon size={16} className="shrink-0 text-blue-600" /> : null}
      <span className="truncate">{title}</span>
    </h2>

    {right ||
      (to ? (
        <Link
          to={to}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          {linkLabel}
          <ArrowRight size={13} />
        </Link>
      ) : null)}
  </div>
);

/* ──────────────────────────────────────────────────────────────────────────
   Delta
────────────────────────────────────────────────────────────────────────── */

const Delta = ({ value }) => {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) {
    return null;
  }
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
        up ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
      }`}
    >
      {up ? <ArrowUp size={10} strokeWidth={3} /> : <ArrowDown size={10} strokeWidth={3} />}
      {Math.abs(value)}%
    </span>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   Compact Stat Card — tinted card + soft icon tile (matches design mock)
────────────────────────────────────────────────────────────────────────── */

const StatCard = ({
  to,
  Icon,
  tone,
  bg,
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
    animatedValue === null || animatedValue === undefined
      ? value
      : formatter
        ? formatter(count)
        : count.toLocaleString('en-IN');

  return (
    <Link
      to={to}
      className={`
        group
        relative
        flex
        min-h-[92px]
        items-center
        gap-3
        rounded-2xl
        border border-white
        p-3
        pr-7
        shadow-[0_4px_18px_rgba(30,64,175,0.06)]
        transition
        hover:-translate-y-0.5
        hover:shadow-md
        ${bg || 'bg-white'}
      `}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
        <Icon size={22} fill={fillIcon ? 'currentColor' : 'none'} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-600">{label}</p>

        <div className="mt-0.5 flex items-center gap-1.5">
          <p className={`truncate text-lg font-extrabold leading-tight tabular-nums sm:text-xl ${NAVY}`}>
            {displayValue}
          </p>
          <Delta value={delta} />
        </div>

        {sub ? <p className="mt-0.5 truncate text-[11px] text-slate-500">{sub}</p> : null}
        {sub2 ? <p className="mt-0.5 truncate text-[11px] font-semibold text-red-500">{sub2}</p> : null}
      </div>

      <ChevronRight
        size={15}
        className="absolute right-2.5 top-3 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600"
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
    selected: child,
    loading: childLoading,
    school,
  } = useParentChildren();

  const coverImage = school?.coverImage || '';


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

    // Active-session attendance from the server: school days elapsed in
    // the session (Sundays + holidays excluded) vs days marked present.
    const session = entry?.sessionSummary || null;
    const percent = session
      ? session.percentage
      : pct(records) ??
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

      present: session
        ? session.presentDays
        : records.length
          ? records.filter(
              (r) => r.status === 'present'
            ).length
          : summary.presentDays || 0,

      total: session
        ? session.schoolDays
        : records.length ||
          summary.totalClasses ||
          0,

      sessionName: session?.sessionName || '',

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

    const now = new Date();
    // A paper is over once its end (or start) time has passed today.
    const paperOver = (s) => {
      const d = new Date(s.date);
      if (dayKey(d) !== dayKey(now)) return false;
      const m = String(s.endTime || s.startTime || s.time || '').match(/^(\d{1,2}):(\d{2})/);
      if (!m) return false;
      const t = new Date(d);
      t.setHours(Number(m[1]), Number(m[2]), 0, 0);
      return t < now;
    };

    (kid?.groups || []).forEach(
      (g) =>
        // Completed exams (status Completed / last paper done) are not upcoming.
        !(g.completed || g.examState === 'completed') &&
        (g.subjects || []).forEach(
          (s) => {
            if (
              validDate(s.date) &&
              new Date(s.date) >= today &&
              !paperOver(s)
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

  const childFirstName = String(child?.name || '').trim().split(/s+/)[0] || '';

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
        p-3
        sm:p-4
        lg:p-5
      "
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: reduceMotion ? 0 : 0.06,
            delayChildren: 0.03,
          },
        },
      }}
    >
      {/* Greeting */}
      <motion.div variants={RISE}>
        <h1 className={`text-xl font-extrabold sm:text-2xl ${NAVY}`}>
          {greeting} 
          {/* <span aria-hidden="true">👋</span> */}
        </h1>
        <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">
          Here&apos;s an overview of {childFirstName ? `${childFirstName}’s` : 'your child’s'} academic journey.
        </p>
      </motion.div>

      {/* Child Banner */}
      <motion.section
        variants={RISE}
        className="relative overflow-hidden rounded-2xl border border-white bg-gradient-to-r from-[#eaf1fd] via-[#eef4fd] to-[#dfeafb] shadow-[0_4px_18px_rgba(30,64,175,0.06)]"
      >
        {coverImage ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-3/5 overflow-hidden md:block">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${coverImage})` }} />
            <div className="absolute inset-0 bg-gradient-to-r from-[#eef4fd] via-[#eef4fd]/40 to-transparent" />
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-y-0 right-16 hidden opacity-70 md:block lg:right-40">
            <BannerBuilding />
          </div>
        )}

        <div className="relative flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-5 sm:py-3.5">
          {child ? (
            <span className="rounded-full bg-gradient-to-br from-violet-200 to-blue-200 p-1">
              <Avatar size="h-14 w-14 sm:h-[72px] sm:w-[72px]" text="text-lg" />
            </span>
          ) : (
            <span className="h-14 w-14 animate-pulse rounded-full bg-white/70" />
          )}

          <div className="min-w-0 flex-1">
            <h2 className={`truncate text-base font-extrabold sm:text-xl ${NAVY}`}>
              {child?.name || (childLoading ? 'Loading…' : 'No child linked')}
            </h2>

            {child && (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-medium text-slate-700">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full border-2 border-blue-400" />
                  Class {child.grade || '—'}
                </span>
                {child.section ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full border-2 border-blue-400" />
                    Section {child.section}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full border-2 border-blue-400" />
                  Roll {child.roll !== '' && child.roll !== null && child.roll !== undefined ? child.roll : '—'}
                </span>
              </p>
            )}

            {child && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-700">
                <span> <strong> ID:</strong> {child.admissionNumber || child.studentCode || '—'}</span>
                {attendance.sessionName ? (
                  <>
                    <span className="text-slate-300">|</span>
                    <span> <strong>Session:</strong> {attendance.sessionName}</span>
                  </>
                ) : null}
              </p>
            )}
          </div>

          <p className="hidden shrink-0 rotate-[-4deg] rounded-xl bg-white/70 px-3 py-2 text-right font-[cursive] text-sm leading-snug text-slate-700 backdrop-blur-sm lg:block">
            “Keep learning,
            <br />
            keep growing!” <span className="text-amber-400">☀</span>
          </p>
        </div>
      </motion.section>

      {/* Stat Cards */}
      <motion.div variants={RISE} className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <StatCard
          to="/parents/attendance"
          Icon={UsersRound}
          tone="bg-gradient-to-br from-green-100 to-green-200/70 text-green-600"
          bg="bg-gradient-to-br from-white to-green-50"
          label="Attendance"
          value={`${attendance.percent}%`}
          animatedValue={attendance.percent}
          formatter={(n) => `${n}%`}
          delta={attendance.delta}
          sub={`Present: ${attendance.present} / ${attendance.total} days`}
        />

        <StatCard
          to="/parents/fees"
          Icon={Wallet}
          tone="bg-gradient-to-br from-rose-100 to-rose-200/70 text-rose-500"
          bg="bg-gradient-to-br from-white to-rose-50"
          label="Fee Due"
          value={fees.fullyPaid ? 'Fully Paid' : inr(fees.due)}
          animatedValue={fees.fullyPaid ? undefined : fees.due}
          formatter={inr}
          sub={fees.fullyPaid ? 'No pending fees' : ''}
          sub2={
            !fees.fullyPaid && fees.focus && validDate(fees.focus.dueDate)
              ? `Due: ${fmtDate(fees.focus.dueDate)}`
              : ''
          }
        />

        <StatCard
          to="/parents/academic"
          Icon={BarChart3}
          tone="bg-gradient-to-br from-violet-100 to-violet-200/70 text-violet-600"
          bg="bg-gradient-to-br from-white to-violet-50"
          label="Average Marks"
          value={results.average === null ? '—' : `${results.average}%`}
          animatedValue={results.average ?? null}
          formatter={(n) => `${n}%`}
          delta={results.delta}
          sub={
            results.count
              ? `Last ${results.count} Exam${results.count > 1 ? 's' : ''}`
              : 'No results yet'
          }
        />

        <StatCard
          to="/parents/exam-routine"
          Icon={CalendarDays}
          tone="bg-gradient-to-br from-amber-100 to-orange-200/70 text-orange-500"
          bg="bg-gradient-to-br from-white to-orange-50"
          label="Upcoming Exam"
          value={nextExam ? nextExam.subject : 'No Upcoming Exam'}
          animatedValue={null}
          sub={
            nextExam
              ? `${fmtDate(nextExam.date)}${nextExam.time ? ` | ${nextExam.time}` : ''}`
              : 'Check back later'
          }
        />
      </motion.div>

      {/* Cards — one grid so tablet (md) and desktop (lg) can order them differently:
          tablet: Attendance+Fee, Latest Result+Events, Homework+Quick Actions, Notices.
          desktop: Attendance+Fee+Events, Homework+Notices, Latest Result+Quick Actions. */}
      <motion.div variants={RISE} className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
        {/* Attendance */}
        <Card className="md:order-1 lg:order-1 lg:col-span-2">
          <CardHead
            title="Today's Attendance"
            icon={CalendarCheck}
            right={<span className="text-[11px] text-slate-500">{todayLabel}</span>}
          />

          <Link
            to="/parents/attendance"
            className={`flex items-center gap-3 rounded-xl px-3 py-3 transition hover:shadow-sm ${
              todayStatus === 'present'
                ? 'bg-green-50'
                : todayStatus === 'absent'
                  ? 'bg-red-50'
                  : 'bg-[#eef3fc]'
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${
                todayStatus === 'present'
                  ? 'bg-green-600'
                  : todayStatus === 'absent'
                    ? 'bg-red-500'
                    : 'bg-[#34509a]'
              }`}
            >
              {todayStatus === 'absent' ? <X size={18} strokeWidth={3} /> : <Check size={18} strokeWidth={3} />}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={`block text-sm font-bold leading-tight ${
                  todayStatus === 'present'
                    ? 'text-green-700'
                    : todayStatus === 'absent'
                      ? 'text-red-600'
                      : NAVY
                }`}
              >
                {todayStatus === 'present' ? 'Present' : todayStatus === 'absent' ? 'Absent' : 'Not marked yet'}
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-600">
                {todayStatus
                  ? attendance.today?.markedAt
                    ? `Marked at ${new Date(attendance.today.markedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                    : 'Marked for today'
                  : 'Attendance will appear once marked by the school.'}
              </span>
            </span>

            <ChevronRight size={15} className="text-slate-400" />
          </Link>
        </Card>

        {/* Fee */}
        <Card className="md:order-2 lg:order-2 lg:col-span-2">
          <CardHead title="Fee Summary" to="/parents/fees" linkLabel="View Details" />

          {fees.focus ? (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-green-600"
                  style={{
                    width: `${fees.total > 0 ? Math.min(100, (fees.paid / fees.total) * 100) : 0}%`,
                  }}
                />
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {[
                  { label: 'Paid', value: fees.paid, Icon: IndianRupee, box: 'bg-green-50', icon: 'text-green-600', val: 'text-slate-900' },
                  { label: 'Due', value: fees.balance, Icon: Clock, box: 'bg-rose-50', icon: 'text-rose-500', val: 'text-rose-600' },
                  { label: 'Total', value: fees.total, Icon: ReceiptText, box: 'bg-slate-50', icon: 'text-slate-600', val: 'text-slate-900' },
                ].map(({ label, value, Icon: TileIcon, box, icon, val }) => (
                  <div key={label} className={`flex min-w-0 flex-col items-center rounded-xl px-1.5 py-2 text-center ${box}`}>
                    <TileIcon size={18} className={icon} />
                    <p className="mt-1 text-[10px] text-slate-600">{label}</p>
                    <p className={`max-w-full truncate text-sm font-bold ${val}`} title={inr(value)}>
                      {inr(value)}
                    </p>
                  </div>
                ))}
              </div>

              {fees.balance > 0 && (
                <Link
                  to="/parents/fees"
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  <CreditCard size={14} />
                  Pay Now
                </Link>
              )}
            </>
          ) : (
            <p className="rounded-lg bg-slate-50 py-5 text-center text-xs text-slate-500">No fee invoices yet</p>
          )}
        </Card>

        {/* Events */}
        <Card className="md:order-4 lg:order-3 lg:col-span-2">
          <CardHead title="Upcoming Events" icon={Bell} to="/parents/calendar" />

          {events.length === 0 ? (
            <p className="rounded-lg bg-slate-50 py-5 text-center text-xs text-slate-500">Nothing coming up</p>
          ) : (
            <ul className="space-y-1.5">
              {events.map((ev, i) => {
                const cfg =
                  ev.kind === 'exam'
                    ? { Icon: CalendarDays, cls: 'bg-violet-100 text-violet-600' }
                    : ev.kind === 'ptm'
                      ? { Icon: Users, cls: 'bg-rose-100 text-rose-500' }
                      : { Icon: Leaf, cls: 'bg-green-100 text-green-600' };

                return (
                  <li key={i}>
                    <Link
                      to="/parents/calendar"
                      className="flex items-center gap-2.5 rounded-xl bg-[#f3f6fc] px-2 py-1.5 transition hover:bg-[#e9effa]"
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.cls}`}>
                        <cfg.Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-xs font-bold ${NAVY}`}>{ev.title}</span>
                        <span className="block truncate text-[10px] text-slate-500">{ev.sub}</span>
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-slate-400" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        {/* Homework */}
        <Card className="md:order-5 lg:order-4 lg:col-span-3">
          <CardHead title="Recent Homework" icon={CalendarDays} to="/parents/homework" />

          {recentHomework.length === 0 ? (
            <p className="rounded-lg bg-slate-50 py-5 text-center text-xs text-slate-500">No homework yet</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentHomework.map((a, i) => {
                const pending = !a.submissionStatus || a.submissionStatus === 'not_submitted';
                const tone = SUBJECT_TONES[i % SUBJECT_TONES.length].icon;

                return (
                  <li key={a._id}>
                    <Link to="/parents/homework" className="flex items-center gap-2.5 py-2 transition hover:bg-slate-50/60">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                        <BookOpen size={17} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-xs font-bold ${NAVY}`}>{subjectName(a) || 'General'}</span>
                        <span className="block truncate text-[11px] text-slate-600" title={a.title}>{a.title}</span>
                        {validDate(a.dueDate) && (
                          <span className="block text-[10px] text-slate-500">Due: {fmtDate(a.dueDate)}</span>
                        )}
                      </span>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          pending ? 'bg-orange-50 text-orange-500' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {pending ? 'Pending' : 'Submitted'}
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-slate-400" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Notices */}
        <Card className="md:order-7 md:col-span-2 lg:order-5 lg:col-span-3">
          <CardHead title="Recent Notices" icon={FileText} to="/parents/notices" />

          {recentNotices.length === 0 ? (
            <p className="rounded-lg bg-slate-50 py-5 text-center text-xs text-slate-500">No notices yet</p>
          ) : (
            <ul className="space-y-1.5">
              {recentNotices.map((n) => {
                const label = String(n.typeLabel || n.title || '').toLowerCase();
                const cfg = /holiday/.test(label)
                  ? { Icon: Megaphone, cls: 'bg-rose-100 text-rose-500' }
                  : /ptm|meeting|parent/.test(label)
                    ? { Icon: Users, cls: 'bg-violet-100 text-violet-600' }
                    : { Icon: FileText, cls: 'bg-blue-100 text-blue-600' };

                return (
                  <li key={n._id}>
                    <Link
                      to="/parents/notices"
                      state={{ openNoticeId: n._id }}
                      className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-[#f3f6fc]"
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.cls}`}>
                        <cfg.Icon size={17} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={`truncate text-xs font-bold ${NAVY}`}>{n.title}</span>
                          <span className="shrink-0 text-[10px] text-slate-500">{fmtDate(n.createdAt)}</span>
                        </span>
                        {n.message ? (
                          <span className="block truncate text-[11px] text-slate-600">{n.message}</span>
                        ) : null}
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-slate-400" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        {/* Latest Result */}
        <Card className="md:order-3 lg:order-6 lg:col-span-3">
          <CardHead title="Latest Exam Result" icon={Trophy} to="/parents/academic" />

          {results.latest ? (
            <div className="rounded-xl border border-slate-100 p-2.5">
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className={`text-xs font-bold ${NAVY}`}>{results.latest.name}</span>
                {validDate(results.latest.date) && (
                  <span className="text-[11px] text-slate-500">{fmtDate(results.latest.date)}</span>
                )}
                <Link
                  to="/parents/academic"
                  className="ml-auto rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-100"
                >
                  View Report
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {results.latest.rows.map((r, i) => (
                  <div
                    key={`${r.subject}-${i}`}
                    className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${SUBJECT_TONES[i % SUBJECT_TONES.length].tile}`}
                  >
                    <BookOpen size={18} className="shrink-0 opacity-80" />
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-medium text-slate-700">{r.subject || 'Subject'}</span>
                      <span className={`block text-base font-extrabold ${NAVY}`}>
                        {Number(r.obtainedMarks || 0)}/{Number(r.totalMarks || 0)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 py-5 text-center text-xs text-slate-500">No published results yet</p>
          )}
        </Card>

        {/* Quick Actions */}
        <Card className="md:order-6 lg:order-7 lg:col-span-3">
          <CardHead title="Quick Actions" icon={LayoutGrid} />

          <div className="grid grid-cols-5 gap-2 md:flex md:flex-wrap md:justify-center md:gap-x-4 md:gap-y-3 lg:grid lg:gap-2">
            {[
              { to: '/parents/fees', label: 'Pay Fees', Icon: Wallet, cls: 'bg-rose-50 text-rose-500' },
              { to: '/parents/attendance', label: 'Attendance', Icon: Users, cls: 'bg-green-50 text-green-600' },
              { to: '/parents/academic', label: 'Results', Icon: BarChart3, cls: 'bg-violet-50 text-violet-600' },
              { to: '/parents/excuse-letters', label: 'Apply Leave', Icon: ClipboardList, cls: 'bg-orange-50 text-orange-500' },
              { to: '/parents/chat', label: 'Message', Icon: MessageSquare, cls: 'bg-blue-50 text-blue-600' },
            ].map(({ to, label, Icon, cls }) => (
              <Link key={to} to={to} className="group flex min-w-0 flex-col items-center gap-1.5 text-center md:w-[76px] lg:w-auto">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm transition group-hover:-translate-y-0.5 sm:h-12 sm:w-12 ${cls}`}
                >
                  <Icon size={20} />
                </span>
                <span className={`max-w-full truncate text-[10px] font-semibold sm:text-[11px] ${NAVY}`}>{label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default ParentDashboard;
