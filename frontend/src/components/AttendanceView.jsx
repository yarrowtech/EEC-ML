import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart2, Check,
  ChevronLeft, ChevronRight, List, RefreshCw, X,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

async function fetchStudentAttendance() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not logged in.");
  // Mounted under /auth in routes/index.js alongside /api/student/auth/schedule
  // (routes/studentRoute.js), even though it's a data read, not an auth action.
  const res = await fetch(`${API_BASE}/api/student/auth/attendance`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Unable to load attendance.");
  const data = await res.json();
  return {
    summary: data.summary,
    session: data.session,
    records: (data.attendance || []).flatMap((record) => {
      const date = new Date(record.date);
      if (!record.date || Number.isNaN(date.getTime())) return [];
      return [{ date: record.dateKey || date.toISOString().slice(0, 10), status: normalizeStatus(record.status) }];
    }),
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toLocalDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fmtDate(dateStr, opts) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(
    "en-US",
    opts || { weekday: "short", month: "short", day: "numeric" }
  );
}

function fmtDateLong(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function normalizeStatus(value) {
  return String(value || "").toLowerCase();
}

const PANEL = "min-w-0 rounded-2xl border border-[#e0e7f5] bg-white/90 shadow-[0_3px_8px_#213a7410]";
const PRESENT = "bg-green-100 text-green-800";
const ABSENT = "bg-red-100 text-red-800";

function countAttendance(records) {
  const present = records.filter((record) => record.status === "present").length;
  const absent = records.filter((record) => record.status === "absent").length;
  const total = present + absent;
  return {
    present,
    absent,
    total,
    percentage: total ? Math.round((present / total) * 100) : 0,
  };
}

function TotalAttendance({ stats, onRefresh, onViewAll, isRefreshing }) {
  const presentShare = stats.total ? Math.min(100, (stats.present / stats.total) * 100) : 0;
  const markedShare = stats.total ? Math.min(100, ((stats.present + stats.absent) / stats.total) * 100) : 0;
  const rows = [
    ["Present", stats.present, "text-green-600"],
    ["Absent", stats.absent, "text-red-600"],
    ["Total Classes", stats.total, "text-slate-700"],
  ];
  return (
    <section className={`${PANEL} flex flex-col lg:max-h-full lg:min-h-0 lg:overflow-y-auto`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5ebf5] px-3 py-2.5">
        <h2 className="flex items-center gap-2 text-base font-extrabold sm:text-lg">
          <BarChart2 className="size-5 text-green-700" aria-hidden="true" />
          Total Attendance
        </h2>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button type="button" onClick={onViewAll} className="rounded-md px-1 py-1 text-xs font-semibold text-blue-700 hover:underline">View All</button>
          <button type="button" onClick={onRefresh} disabled={isRefreshing} aria-busy={isRefreshing} aria-label="Refresh attendance" title="Refresh attendance" className="inline-grid size-8 place-items-center rounded-full border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            <RefreshCw size={16} aria-hidden="true" className={isRefreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 sm:gap-5 md:max-[1025px]:portrait:flex-row md:max-[1025px]:portrait:gap-7">
        <div
          className="grid size-32 shrink-0 place-items-center rounded-full p-3.5 sm:size-36 sm:p-4 lg:size-[clamp(7rem,23dvh,11rem)] lg:p-5"
          style={{ background: `conic-gradient(#16a34a 0 ${presentShare}%, #dc2626 ${presentShare}% ${markedShare}%, #e2e8f0 ${markedShare}% 100%)` }}
        >
          <div className="grid size-full content-center rounded-full bg-white text-center">
            <strong className="text-2xl font-extrabold sm:text-3xl lg:text-4xl md:max-[1025px]:portrait:text-4xl">{stats.percentage}%</strong>
            <span className="text-[10px] sm:text-xs lg:text-sm md:max-[1025px]:portrait:text-sm">Attendance</span>
          </div>
        </div>
        <dl className="grid w-full max-w-sm grid-cols-3 gap-1.5 text-center sm:gap-2 lg:max-w-md lg:gap-3">
          {rows.map(([label, value, tone]) => (
            <div key={label} className="relative px-1 py-2 text-xs after:absolute after:top-1/2 after:-right-1 after:h-6 after:w-px after:-translate-y-1/2 after:bg-slate-300 last:after:hidden lg:px-2 lg:py-2.5 lg:text-sm lg:after:-right-1.5 md:max-[1025px]:portrait:text-sm">
              <dt className="font-medium text-black">{label}</dt>
              <dd className="mt-0.5 text-slate-700"><strong className={`text-base lg:text-xl md:max-[1025px]:portrait:text-[22px]! ${tone}`}>{value}</strong> Days</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function MonthCalendar({ monthDate, setMonthDate, byDate, today, session }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startDay = new Date(year, month, 1).getDay();
  const dayCount = new Date(year, month + 1, 0).getDate();
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;
  const monthKey = toLocalDateKey(monthDate).slice(0, 7);
  const currentMonth = toLocalDateKey(today).slice(0, 7);
  const canGoBack = !session?.startDate || monthKey > session.startDate.slice(0, 7);
  const canAdvance = monthKey < currentMonth && (!session?.endDate || monthKey < session.endDate.slice(0, 7));
  const moveMonth = (offset) => {
    setSelectedDate(null);
    setMonthDate(new Date(year, month + offset, 1));
  };
  const arrowClass = "grid size-9 shrink-0 place-items-center rounded-full border border-[#e0e7f5] bg-white hover:bg-blue-50 sm:size-10";

  return (
    <section className={`${PANEL} flex flex-col p-3 sm:p-4 lg:max-h-full lg:min-h-0 lg:overflow-y-auto`}>
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        {canGoBack ? (
          <button type="button" aria-label="Previous month" className={arrowClass} onClick={() => moveMonth(-1)}><ChevronLeft size={21} /></button>
        ) : <span className="size-9 shrink-0 sm:size-10" aria-hidden="true" />}
        <h2 aria-live="polite" className="text-center text-lg font-extrabold sm:text-xl">{monthLabel}</h2>
        {canAdvance ? (
          <button type="button" aria-label="Next month" className={arrowClass} onClick={() => moveMonth(1)}><ChevronRight size={21} /></button>
        ) : <span className="size-9 shrink-0 sm:size-10" aria-hidden="true" />}
      </div>
      <div className="grid shrink-0 grid-cols-7 gap-x-1 gap-y-1.5 sm:gap-2">
        {DAY_NAMES.map((day, index) => <span key={day} className={`pb-1 text-center text-[11px] font-semibold sm:text-sm ${index === 0 ? "text-red-700" : index === 6 ? "text-blue-700" : "text-slate-600"}`}>{day}</span>)}
        {Array.from({ length: startDay }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
        {Array.from({ length: dayCount }, (_, index) => {
          const date = new Date(year, month, index + 1);
          const key = toLocalDateKey(date);
          if ((session?.startDate && key < session.startDate) || (session?.endDate && key > session.endDate)) {
            return <span key={key} aria-hidden="true" />;
          }
          const stats = countAttendance(byDate[key] || []);
          const status = stats.absent ? "Absent" : stats.present ? "Present" : byDate[key]?.some((record) => record.status === "leave") ? "Leave" : "No class recorded";
          const tone = stats.absent ? ABSENT : stats.present ? PRESENT : date.getDay() === 0 ? "bg-[#fff1ef] text-red-600" : date.getDay() === 6 ? "bg-[#eaf3ff] text-blue-700" : "bg-[#f0f2f7] text-slate-700";
          return (
            <button key={key} type="button" aria-label={`${fmtDateLong(key)}: ${status}`} aria-pressed={key === selectedDate} onClick={() => setSelectedDate(key === selectedDate ? null : key)}
              className={`flex h-9 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-semibold tabular-nums transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700 sm:h-11 sm:text-sm lg:h-[clamp(1.75rem,5dvh,2.75rem)] ${tone} ${key === toLocalDateKey(today) ? "ring-1 ring-inset ring-green-600" : ""} ${key === selectedDate ? "outline-2 -outline-offset-2 outline-blue-600" : ""}`}>
              {index + 1}
              {stats.absent ? <X size={14} strokeWidth={3} aria-hidden="true" /> : stats.present ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DailyTab({ records, byDate, dailyFilter, setDailyFilter }) {
  const sortedDates = [...new Set(records.map((r) => r.date))].sort().reverse();
  const filtered = sortedDates.filter((d) => {
    if (dailyFilter === "all") return true;
    const recs = byDate[d] || [];
    if (dailyFilter === "present") return recs.every((r) => r.status === "present");
    return recs.some((r) => r.status === "absent");
  });

  return (
    <motion.div
      key="daily"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <List className="h-4 w-4 text-indigo-600" />
            Day-by-Day Attendance
            <span className="text-xs font-normal text-slate-400">({filtered.length} {filtered.length === 1 ? "day" : "days"})</span>
          </h2>
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
            {["all", "present", "absent"].map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={dailyFilter === f}
                onClick={() => setDailyFilter(f)}
                className={`rounded-md px-2.5 py-1 font-semibold capitalize transition ${
                  dailyFilter === f
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[600px] divide-y divide-slate-100 overflow-y-auto lg:min-h-0 lg:max-h-none lg:flex-1">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">
              No records match the current filter.
            </p>
          ) : (
            filtered.map((date) => {
              const recs = byDate[date] || [];
              const { present: presentCount, absent: absentCount } = countAttendance(recs);
              const allPresent = presentCount === recs.length;
              const dayNum = new Date(date + "T00:00:00").getDate();

              return (
                <div key={date} className="px-4 py-3 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold ${
                          allPresent ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {dayNum}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {fmtDate(date, { weekday: "long", month: "short", day: "numeric" })}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {recs.length} class{recs.length !== 1 ? "es" : ""} — {presentCount} present
                          {absentCount > 0 && (
                            <span className="text-rose-500">, {absentCount} absent</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        allPresent ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {allPresent ? "Full Attendance" : absentCount ? `${absentCount} Absent` : "Leave"}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function AttendanceDashboard() {
  const { search } = useLocation();
  const requestedFilter = new URLSearchParams(search).get("filter");
  const hasDailyFilter = requestedFilter === "present" || requestedFilter === "absent" || requestedFilter === "all";
  const [showDaily, setShowDaily] = useState(hasDailyFilter);
  const [dailyFilter, setDailyFilter] = useState(hasDailyFilter ? requestedFilter : "all");
  const [today] = useState(() => new Date());
  const [monthDate, setMonthDate] = useState(today);
  const [attendance, setAttendance] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadAttendance = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError("");
    try {
      setAttendance(await fetchStudentAttendance());
    } catch (error) {
      setLoadError(error.message || "Unable to load attendance.");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const { records, byDate, totals } = useMemo(() => {
    const records = attendance?.records || [];
    const byDate = Object.create(null);
    for (const record of records) (byDate[record.date] ??= []).push(record);
    const recorded = countAttendance(records);
    const summary = attendance?.summary;
    return {
      records,
      byDate,
      totals: {
        present: summary?.presentDays ?? recorded.present,
        absent: summary?.absentDays ?? recorded.absent,
        total: summary?.totalClasses ?? recorded.total,
        percentage: summary?.attendancePercentage ?? recorded.percentage,
      },
    };
  }, [attendance]);
  const session = attendance?.session;
  const sessionUpcoming = session?.startDate && session.startDate > toLocalDateKey(today);
  const monthKey = toLocalDateKey(monthDate).slice(0, 7);
  const firstMonth = session?.startDate?.slice(0, 7);
  const lastMonth = session?.endDate?.slice(0, 7);
  const displayedMonth = firstMonth && monthKey < firstMonth
    ? new Date(`${firstMonth}-01T00:00:00`)
    : lastMonth && monthKey > lastMonth
      ? new Date(`${lastMonth}-01T00:00:00`)
      : monthDate;

  return (
    <div className="min-h-full p-3 pb-20 text-[#101437] sm:p-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-3 lg:min-h-0 lg:flex-1">
        <h1 className="sr-only">Attendance</h1>
        {loadError && (
          <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
            <button type="button" onClick={loadAttendance} className="shrink-0 font-semibold underline">Retry</button>
          </div>
        )}
        {!attendance && isRefreshing ? (
          <p role="status" className={`${PANEL} p-6 text-center text-sm text-slate-600`}>Loading attendance…</p>
        ) : showDaily ? (
          <>
            <button type="button" onClick={() => setShowDaily(false)} className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-[#dce5f5] bg-white px-3 py-2 text-sm font-semibold text-blue-700">
              <ChevronLeft size={16} aria-hidden="true" /> Back to overview
            </button>
            <DailyTab records={records} byDate={byDate} dailyFilter={dailyFilter} setDailyFilter={setDailyFilter} />
          </>
        ) : attendance && (
          <>
            <div className="grid gap-3 lg:min-h-0 lg:grid-cols-2 lg:grid-rows-[minmax(0,auto)] lg:items-start lg:max-[1025px]:portrait:grid-cols-1! lg:max-[1025px]:portrait:grid-rows-none!">
              <TotalAttendance
                stats={totals}
                onRefresh={loadAttendance}
                onViewAll={() => { setDailyFilter("all"); setShowDaily(true); }}
                isRefreshing={isRefreshing}
              />
              {sessionUpcoming ? (
                <p className={`${PANEL} p-4 text-sm text-slate-600`}>This session begins {fmtDateLong(session.startDate)}.</p>
              ) : (
                <MonthCalendar key={session?.startDate} monthDate={displayedMonth} setMonthDate={setMonthDate} byDate={byDate} today={today} session={session} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
