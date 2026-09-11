import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  List,
  BarChart2,
  Flame,
  AlertCircle,
  BookOpen,
  Eye,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════
   SAMPLE DATA
   In a real app this would come from `fetch('/api/attendance')`
   or similar — swap it out inside `handleRefresh` below.
   ════════════════════════════════════════════════════════════ */
const SAMPLE_ATTENDANCE = [
  { _id: "1", date: "2026-09-11", subject: "Mathematics", status: "present" },
  { _id: "2", date: "2026-09-11", subject: "Physics", status: "present" },
  { _id: "3", date: "2026-09-11", subject: "Chemistry", status: "absent" },
  { _id: "4", date: "2026-09-10", subject: "Mathematics", status: "present" },
  { _id: "5", date: "2026-09-10", subject: "Biology", status: "present" },
  { _id: "6", date: "2026-09-09", subject: "English", status: "present" },
  { _id: "7", date: "2026-09-09", subject: "History", status: "present" },
  { _id: "8", date: "2026-09-08", subject: "Mathematics", status: "absent" },
  { _id: "9", date: "2026-09-08", subject: "Physics", status: "present" },
  { _id: "10", date: "2026-09-05", subject: "Chemistry", status: "present" },
  { _id: "11", date: "2026-09-05", subject: "Biology", status: "present" },
  { _id: "12", date: "2026-09-04", subject: "English", status: "present" },
  { _id: "13", date: "2026-09-04", subject: "Mathematics", status: "present" },
  { _id: "14", date: "2026-09-03", subject: "Physics", status: "present" },
  { _id: "15", date: "2026-09-03", subject: "History", status: "absent" },
  { _id: "16", date: "2026-09-02", subject: "Chemistry", status: "present" },
  { _id: "17", date: "2026-09-02", subject: "Biology", status: "present" },
  { _id: "18", date: "2026-09-01", subject: "English", status: "present" },
  { _id: "19", date: "2026-09-01", subject: "Mathematics", status: "present" },
  { _id: "20", date: "2026-08-29", subject: "Physics", status: "present" },
  { _id: "21", date: "2026-08-29", subject: "Chemistry", status: "present" },
  { _id: "22", date: "2026-08-28", subject: "Biology", status: "absent" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ════════════════════════════════════════════════════════════
   PURE HELPERS
   Kept outside the component so they don't get recreated on
   every render, and so they're easy to unit-test in isolation.
   ════════════════════════════════════════════════════════════ */
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
  return String(value || "").toLowerCase() === "absent" ? "absent" : "present";
}

// Turns the raw record list into every derived shape the UI needs.
// This is the React equivalent of the old `processData()` function —
// the difference is it's a pure function fed to useMemo, not a
// function that mutates module-level globals.
function processAttendance(rawRecords) {
  const records = rawRecords.map((r) => ({
    id: r._id || `${r.date}-${r.subject}`,
    date: r.date,
    subject: r.subject || "General",
    status: normalizeStatus(r.status),
  }));

  const total = records.length;
  const present = records.filter((r) => r.status === "present").length;
  const absent = total - present;
  const stats = {
    totalClasses: total,
    attended: present,
    absent,
    percentage: total ? Math.round((present / total) * 100) : 0,
  };

  const byDate = {};
  records.forEach((r) => {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  });

  const subMap = {};
  records.forEach((r) => {
    if (!subMap[r.subject]) subMap[r.subject] = { total: 0, present: 0 };
    subMap[r.subject].total += 1;
    if (r.status === "present") subMap[r.subject].present += 1;
  });
  const subjectStats = Object.entries(subMap)
    .map(([subject, s]) => ({
      subject,
      ...s,
      pct: s.total ? Math.round((s.present / s.total) * 100) : 0,
    }))
    .sort((a, b) => a.pct - b.pct);

  const weeks = {};
  records.forEach((r) => {
    const d = new Date(r.date + "T00:00:00");
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - d.getDay());
    const weekKey = toLocalDateKey(weekStart);
    if (!weeks[weekKey]) weeks[weekKey] = { start: weekStart, records: [], present: 0, absent: 0 };
    weeks[weekKey].records.push(r);
    if (r.status === "present") weeks[weekKey].present += 1;
    else weeks[weekKey].absent += 1;
  });
  const weeklyData = Object.entries(weeks)
    .map(([key, w]) => {
      const end = new Date(w.start);
      end.setDate(end.getDate() + 6);
      return {
        key,
        start: w.start,
        end,
        total: w.records.length,
        present: w.present,
        absent: w.absent,
        pct: w.records.length ? Math.round((w.present / w.records.length) * 100) : 0,
        records: w.records,
      };
    })
    .sort((a, b) => b.key.localeCompare(a.key));

  return { records, stats, byDate, subjectStats, weeklyData };
}

function computeStreak(records, byDate) {
  const uniqueDates = [...new Set(records.map((r) => r.date))].sort().reverse();
  let streak = 0;
  for (const d of uniqueDates) {
    const dayRecords = byDate[d] || [];
    const allPresent = dayRecords.length > 0 && dayRecords.every((r) => r.status === "present");
    if (allPresent) streak += 1;
    else break;
  }
  return streak;
}

/* ════════════════════════════════════════════════════════════
   SMALL PRESENTATIONAL PIECES
   ════════════════════════════════════════════════════════════ */
function StatCard({ icon: Icon, iconBg, iconColor, label, value, sub }) {
  return (
    <div className="rounded-2xl bg-white p-5 border border-slate-200/80 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] flex items-start gap-4">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${iconBg}`}
      >
        <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={1.8} />
      </div>
      <div>
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SubjectPill({ subject, status }) {
  const isPresent = status === "present";
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
        isPresent
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-rose-50 text-rose-700 border-rose-200"
      }`}
    >
      {isPresent ? "✓" : "✕"} {subject}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════
   HEADER
   ════════════════════════════════════════════════════════════ */
function Header({ streak, lastSynced, onRefresh, isRefreshing, overallPct }) {
  const onTrack = overallPct >= 75;
  return (
    <header
      className="relative overflow-hidden rounded-3xl bg-white p-6 sm:p-8 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border"
      style={{
        background:
          "linear-gradient(135deg, rgb(245,243,255) 0%, rgb(250,245,255) 50%, rgb(253,244,255) 100%)",
        borderColor: "rgba(196,181,253,0.45)",
      }}
    >
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-200/50 shadow-sm text-indigo-600 shrink-0">
            <CalendarIcon className="w-6 h-6" strokeWidth={1.8} />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800">
                My Attendance
              </h1>
              <AnimatePresence>
                {streak > 0 && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700"
                  >
                    <Flame className="w-3.5 h-3.5" /> {streak} day streak
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Track your overall, daily, and weekly attendance in one place.
            </p>
            <p className="mt-3 text-xs text-slate-400 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Last updated{" "}
              {lastSynced.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        <div className="flex flex-row md:flex-col items-start md:items-end justify-between gap-3 self-stretch md:self-auto border-t md:border-t-0 pt-4 md:pt-0 border-slate-200/80">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              onTrack
                ? "bg-emerald-50 text-emerald-600 border-emerald-200/60"
                : "bg-amber-50 text-amber-600 border-amber-200/60"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                onTrack ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {onTrack ? "On Track" : "Needs Attention"}
          </span>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors border border-slate-200/80 shadow-sm active:scale-95 duration-150 disabled:opacity-60"
          >
            <motion.span
              animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={isRefreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : {}}
              className="flex"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            </motion.span>
            {isRefreshing ? "Refreshing..." : "Refresh data"}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════
   TAB NAV — uses a shared layoutId so the active pill glides
   between buttons instead of just swapping classes.
   ════════════════════════════════════════════════════════════ */
const TABS = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
  { id: "daily", label: "Daily", icon: List },
  { id: "weekly", label: "Weekly", icon: BarChart2 },
];

function TabNav({ activeTab, setActiveTab }) {
  return (
    <nav className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.03)] flex flex-wrap items-center gap-1.5 justify-center">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              active ? "text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {active && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-[0_4px_12px_-2px_rgba(99,102,241,0.35)]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              <Icon className="w-4 h-4" strokeWidth={2} />
              <span className="hidden sm:inline">{label}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* ════════════════════════════════════════════════════════════
   OVERVIEW TAB
   ════════════════════════════════════════════════════════════ */
function CircularProgress({ pct }) {
  const circumference = 2 * Math.PI * 15.9155;
  const color = pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center my-6">
      <svg className="w-48 h-48" viewBox="0 0 36 36">
        <path
          className="fill-none stroke-slate-100"
          strokeWidth="2.8"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <motion.path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          strokeWidth="2.8"
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={`${circumference}, ${circumference}`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (pct / 100) * circumference }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-extrabold text-slate-800 tracking-tight">{pct}%</span>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
          Overall
        </span>
      </div>
    </div>
  );
}

function OverviewTab({ stats, streak, currentDate, records, subjectStats }) {
  const onTrack = stats.percentage >= 75;

  const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  const monthlyRecords = records.filter((r) => r.date.startsWith(monthKey));
  const mPresent = monthlyRecords.filter((r) => r.status === "present").length;
  const mAbsent = monthlyRecords.length - mPresent;
  const mPct = monthlyRecords.length ? Math.round((mPresent / monthlyRecords.length) * 100) : 0;

  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: circular progress */}
        <section className="lg:col-span-4 rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] flex flex-col items-center justify-between text-center bg-gradient-to-br from-indigo-50/70 to-slate-50">
          <div className="w-full flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Rate
            </span>
            <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
          </div>
          <CircularProgress pct={stats.percentage} />
          <div className="w-full space-y-3">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Overall Attendance</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {stats.attended} of {stats.totalClasses} classes attended
              </p>
            </div>
            <div className="pt-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                  onTrack
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-rose-50 text-rose-700 border-rose-100"
                }`}
              >
                {onTrack ? "Healthy attendance trend" : "Needs attention this term"}
              </span>
            </div>
          </div>
        </section>

        {/* Right: metrics */}
        <section className="lg:col-span-8 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              icon={BookOpen}
              iconBg="bg-indigo-500/10 border-indigo-200/50"
              iconColor="text-indigo-600"
              label="Total Classes"
              value={stats.totalClasses}
            />
            <StatCard
              icon={CheckCircle2}
              iconBg="bg-emerald-500/10 border-emerald-200/50"
              iconColor="text-emerald-600"
              label="Present"
              value={stats.attended}
            />
            <StatCard
              icon={XCircle}
              iconBg="bg-rose-500/10 border-rose-200/50"
              iconColor="text-rose-600"
              label="Absent"
              value={stats.absent}
            />
            <StatCard
              icon={Flame}
              iconBg="bg-amber-500/10 border-amber-200/50"
              iconColor="text-amber-600"
              label="Current Streak"
              value={`${streak} days`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-1.5 text-slate-400 mb-2">
                <CalendarIcon className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  This Month
                </span>
              </div>
              <h4 className="text-base font-semibold text-slate-800">
                {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h4>
              <p className="text-xs text-slate-400 mt-1">{monthlyRecords.length} classes recorded</p>
            </div>
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-1.5 text-emerald-600 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Present Days
                </span>
              </div>
              <h4 className="text-2xl font-bold text-slate-800">{mPresent}</h4>
              <p className="text-xs text-slate-400 mt-1">Absences this month: {mAbsent}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-1.5 text-amber-600 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Monthly Rate
                </span>
              </div>
              <h4 className="text-2xl font-bold text-slate-800">{mPct}%</h4>
              <p className="text-xs text-slate-400 mt-1">Based on current month records</p>
            </div>
          </div>
        </section>
      </div>

      {subjectStats.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-600" />
              <h2 className="font-semibold text-slate-900 text-sm">Subject-wise Attendance</h2>
            </div>
            <span className="text-xs font-medium text-slate-400">
              {subjectStats.length} subjects
            </span>
          </div>
          <div className="space-y-4">
            {subjectStats.map((s) => {
              const barColor =
                s.pct >= 75 ? "bg-emerald-500" : s.pct >= 50 ? "bg-amber-500" : "bg-rose-500";
              const textColor =
                s.pct >= 75 ? "text-emerald-600" : s.pct >= 50 ? "text-amber-600" : "text-rose-600";
              return (
                <div key={s.subject} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-800">{s.subject}</span>
                    <span className="text-xs text-slate-500">
                      {s.present}/{s.total} classes ·{" "}
                      <span className={`font-semibold ${textColor}`}>{s.pct}%</span>
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200">
                    <motion.div
                      className={`h-2 rounded-full ${barColor}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${s.pct}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <footer className="bg-white/90 border border-slate-200/80 rounded-2xl p-4 sm:px-5 flex items-center gap-3 text-slate-600 text-xs shadow-sm">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 text-amber-600 border border-amber-200/60 shrink-0">
          <AlertCircle className="w-4 h-4" />
        </div>
        <p className="leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-700">Aim to maintain 75%+ attendance.</span> If
          any entry looks incorrect, please contact your class teacher.
        </p>
      </footer>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════
   CALENDAR TAB
   ════════════════════════════════════════════════════════════ */
function CalendarTab({ currentDate, setCurrentDate, byDate, selectedDate, setSelectedDate }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthly = Object.entries(byDate)
    .filter(([date]) => date.startsWith(monthKey))
    .flatMap(([, recs]) => recs);
  const mPresent = monthly.filter((r) => r.status === "present").length;
  const mAbsent = monthly.length - mPresent;
  const mPct = monthly.length ? Math.round((mPresent / monthly.length) * 100) : 0;

  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - firstDay.getDay());
  const todayKey = toLocalDateKey(new Date());

  const cells = [];
  const cursor = new Date(gridStart);
  for (let i = 0; i < 42; i++) {
    const key = toLocalDateKey(cursor);
    cells.push({
      key,
      dayNum: cursor.getDate(),
      isCurrentMonth: cursor.getMonth() === month,
      isToday: key === todayKey,
      records: byDate[key] || [],
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const selectedRecords = selectedDate ? byDate[selectedDate] || [] : [];

  return (
    <motion.div
      key="calendar"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="rounded-lg p-2 hover:bg-slate-100 transition"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4 text-slate-700" />
          </button>
          <div className="text-center">
            <h2 className="font-semibold text-slate-900">
              {MONTH_NAMES[month]} {year}
            </h2>
            <p className="text-xs text-slate-400">
              {mPresent} present · {mAbsent} absent · {mPct}%
            </p>
          </div>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="rounded-lg p-2 hover:bg-slate-100 transition"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4 text-slate-700" />
          </button>
        </div>

        <div className="p-2 sm:p-4">
          <div className="mb-2 grid grid-cols-7 gap-1 sm:gap-1.5">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-1 text-center text-xs font-semibold text-slate-400">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {cells.map((cell) => {
              const hasAbsent = cell.records.some((r) => r.status === "absent");
              const hasPresent = cell.records.some((r) => r.status === "present");
              const isSelected = cell.key === selectedDate;
              return (
                <button
                  key={cell.key}
                  disabled={!cell.isCurrentMonth}
                  onClick={() => setSelectedDate(cell.key)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-xl border transition-colors ${
                    cell.isCurrentMonth ? "cursor-pointer hover:bg-slate-100" : "cursor-default text-slate-300"
                  } ${cell.isToday ? "border-amber-300 bg-amber-50" : "border-transparent"} ${
                    isSelected ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200" : ""
                  }`}
                >
                  <span className={`text-xs font-medium ${cell.isToday ? "text-amber-600" : ""}`}>
                    {cell.dayNum}
                  </span>
                  {hasAbsent ? (
                    <span className="w-1.5 h-1.5 rounded-full mt-0.5 bg-rose-500" />
                  ) : hasPresent ? (
                    <span className="w-1.5 h-1.5 rounded-full mt-0.5 bg-emerald-500" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Present
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Absent
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-200 ring-1 ring-amber-300" /> Today
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedDate && selectedRecords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-amber-600" />
                {fmtDateLong(selectedDate)}
              </h3>
              <div className="space-y-2">
                {selectedRecords.map((r) => {
                  const isPresent = r.status === "present";
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            isPresent ? "bg-emerald-100" : "bg-rose-100"
                          }`}
                        >
                          {isPresent ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-rose-600" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-slate-800">{r.subject}</span>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isPresent ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {isPresent ? "Present" : "Absent"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{monthly.length}</p>
          <p className="text-xs text-slate-500">Monthly Classes</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{mPresent}</p>
          <p className="text-xs text-slate-500">Present</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{mPct}%</p>
          <p className="text-xs text-slate-500">Rate</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════
   DAILY TAB
   ════════════════════════════════════════════════════════════ */
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
    >
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <List className="h-4 w-4 text-indigo-600" />
            Day-by-Day Attendance
            <span className="text-xs font-normal text-slate-400">({filtered.length} days)</span>
          </h2>
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
            {["all", "present", "absent"].map((f) => (
              <button
                key={f}
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

        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">
              No records match the current filter.
            </p>
          ) : (
            filtered.map((date) => {
              const recs = byDate[date] || [];
              const presentCount = recs.filter((r) => r.status === "present").length;
              const absentCount = recs.length - presentCount;
              const allPresent = absentCount === 0;
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
                      {allPresent ? "Full Attendance" : `${absentCount} Absent`}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
                    {recs.map((r) => (
                      <SubjectPill key={r.id} subject={r.subject} status={r.status} />
                    ))}
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

/* ════════════════════════════════════════════════════════════
   WEEKLY TAB
   ════════════════════════════════════════════════════════════ */
function WeeklyTab({ weeklyData, expandedWeek, setExpandedWeek }) {
  return (
    <motion.div
      key="weekly"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2 px-1">
        <BarChart2 className="h-4 w-4 text-indigo-600" />
        <h2 className="font-semibold text-slate-900">Weekly Breakdown</h2>
        <span className="text-xs text-slate-400">({weeklyData.length} weeks)</span>
      </div>

      {weeklyData.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
          No attendance records available.
        </p>
      ) : (
        weeklyData.map((week) => {
          const isExpanded = expandedWeek === week.key;
          const pctColor =
            week.pct >= 75
              ? "bg-emerald-100 text-emerald-700"
              : week.pct >= 50
              ? "bg-amber-100 text-amber-700"
              : "bg-rose-100 text-rose-700";
          const startLabel = fmtDate(toLocalDateKey(week.start), { month: "short", day: "numeric" });
          const endLabel = fmtDate(toLocalDateKey(week.end), { month: "short", day: "numeric" });
          const sortedRecords = [...week.records].sort(
            (a, b) => a.date.localeCompare(b.date) || a.subject.localeCompare(b.subject)
          );

          return (
            <div
              key={week.key}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpandedWeek(isExpanded ? null : week.key)}
                className="flex w-full items-center justify-between p-4 hover:bg-slate-50 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${pctColor}`}
                  >
                    {week.pct}%
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {startLabel} — {endLabel}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {week.total} classes · {week.present} present · {week.absent} absent
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-0.5">
                    {sortedRecords.slice(0, 20).map((r) => (
                      <div
                        key={r.id}
                        className={`h-5 w-1.5 rounded-full ${
                          r.status === "present" ? "bg-emerald-400" : "bg-rose-400"
                        }`}
                      />
                    ))}
                  </div>
                  <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </motion.span>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden border-t border-slate-100"
                  >
                    <div className="divide-y divide-slate-50">
                      {sortedRecords.map((r) => {
                        const isPresent = r.status === "present";
                        return (
                          <div
                            key={r.id}
                            className="flex items-center justify-between px-4 py-2.5 bg-slate-50/50"
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`h-2 w-2 rounded-full ${
                                  isPresent ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                              />
                              <span className="text-sm text-slate-700">{r.subject}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400">
                                {fmtDate(r.date, { weekday: "short", month: "short", day: "numeric" })}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  isPresent
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {isPresent ? "Present" : "Absent"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })
      )}
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════
   ROOT COMPONENT
   ════════════════════════════════════════════════════════════ */
export default function AttendanceDashboard() {
  // Loads the same font the original design used. Safe to delete
  // this effect if you'd rather just use the Tailwind default sans stack.
  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  const [rawRecords, setRawRecords] = useState(SAMPLE_ATTENDANCE);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [dailyFilter, setDailyFilter] = useState("all");
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState(() => new Date());

  // Derived data — recomputed only when the raw records actually change,
  // not on every render (tab switches, date selection, etc).
  const { records, stats, byDate, subjectStats, weeklyData } = useMemo(
    () => processAttendance(rawRecords),
    [rawRecords]
  );
  const streak = useMemo(() => computeStreak(records, byDate), [records, byDate]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    // Swap this timeout+setRawRecords for a real `fetch()` call in production.
    setTimeout(() => {
      setRawRecords([...SAMPLE_ATTENDANCE]);
      setLastSynced(new Date());
      setIsRefreshing(false);
    }, 800);
  }, []);

  return (
    <div
      className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex justify-center"
      style={{ backgroundColor: "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="w-full max-w-5xl space-y-5">
        <Header
          streak={streak}
          lastSynced={lastSynced}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          overallPct={stats.percentage}
        />
        <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />

        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <OverviewTab
              stats={stats}
              streak={streak}
              currentDate={currentDate}
              records={records}
              subjectStats={subjectStats}
            />
          )}
          {activeTab === "calendar" && (
            <CalendarTab
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              byDate={byDate}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
            />
          )}
          {activeTab === "daily" && (
            <DailyTab
              records={records}
              byDate={byDate}
              dailyFilter={dailyFilter}
              setDailyFilter={setDailyFilter}
            />
          )}
          {activeTab === "weekly" && (
            <WeeklyTab
              weeklyData={weeklyData}
              expandedWeek={expandedWeek}
              setExpandedWeek={setExpandedWeek}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}