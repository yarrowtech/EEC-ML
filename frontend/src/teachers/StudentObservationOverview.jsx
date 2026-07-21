import React, { useEffect, useMemo, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock, Heart, Search, Save, ChevronDown, ChevronUp } from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

/* ─── Rating option sets ─────────────────────────────────────── */
const EMOTIONAL_OPTIONS = ["Stable", "Mostly Stable", "Fluctuating", "Needs Support"];
const SOCIAL_OPTIONS    = ["Strong", "Good", "Developing", "Needs Support"];
const BEHAVIOR_OPTIONS  = ["Excellent", "Good", "Average", "Needs Improvement"];
const ATTITUDE_OPTIONS  = ["Excellent", "Good", "Average", "Needs Support"];
const TRAIT_OPTIONS     = ["Strong", "Good", "Developing", "Needs Support"];

/* ─── 5 key sections ─────────────────────────────────────────── */
const SECTION_FIELDS = [
  {
    title: "Emotional & Mental State",
    emoji: "💛",
    group: "health",
    color: "amber",
    fields: [
      { label: "Emotional control",  options: EMOTIONAL_OPTIONS },
      { label: "Stress handling",    options: EMOTIONAL_OPTIONS },
      { label: "Motivation level",   options: EMOTIONAL_OPTIONS },
      { label: "Mood stability",     options: EMOTIONAL_OPTIONS },
      { label: "Self-esteem",        options: EMOTIONAL_OPTIONS },
    ],
  },
  {
    title: "Social Behavior",
    emoji: "🤝",
    group: "emotion",
    color: "blue",
    fields: [
      { label: "Interaction with peers",     options: SOCIAL_OPTIONS },
      { label: "Teamwork",                   options: SOCIAL_OPTIONS },
      { label: "Helping nature",             options: SOCIAL_OPTIONS },
      { label: "Conflict resolution skills", options: SOCIAL_OPTIONS },
    ],
  },
  {
    title: "Classroom Behavior",
    emoji: "🏫",
    group: "emotion",
    color: "indigo",
    fields: [
      { label: "Discipline",                  options: BEHAVIOR_OPTIONS },
      { label: "Respect towards teachers",    options: BEHAVIOR_OPTIONS },
      { label: "Listening skills",            options: BEHAVIOR_OPTIONS },
      { label: "Time management",             options: BEHAVIOR_OPTIONS },
    ],
  },
  {
    title: "Learning & Attitude",
    emoji: "📚",
    group: "emotion",
    color: "emerald",
    fields: [
      { label: "Attention span",       options: ATTITUDE_OPTIONS },
      { label: "Curiosity level",      options: ATTITUDE_OPTIONS },
      { label: "Willingness to learn", options: ATTITUDE_OPTIONS },
      { label: "Initiative",           options: ATTITUDE_OPTIONS },
    ],
  },
  {
    title: "Personal Traits",
    emoji: "⭐",
    group: "emotion",
    color: "violet",
    fields: [
      { label: "Confidence level", options: TRAIT_OPTIONS },
      { label: "Responsibility",   options: TRAIT_OPTIONS },
      { label: "Patience",         options: TRAIT_OPTIONS },
      { label: "Adaptability",     options: TRAIT_OPTIONS },
    ],
  },
];

const NOTES_FIELDS = [
  "Behavioral changes",
  "Unique strengths",
  "Areas of concern",
  "Any incidents worth noting",
];

/* ─── Per-color style tokens (full literals for Tailwind JIT) ── */
const COLOR = {
  amber: {
    header:      "bg-amber-50 border-amber-100",
    text:        "text-amber-700",
    pillActive:  "bg-amber-500 border-amber-500 text-white",
    pillInactive:"bg-white border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700",
  },
  blue: {
    header:      "bg-blue-50 border-blue-100",
    text:        "text-blue-700",
    pillActive:  "bg-blue-500 border-blue-500 text-white",
    pillInactive:"bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700",
  },
  indigo: {
    header:      "bg-indigo-50 border-indigo-100",
    text:        "text-indigo-700",
    pillActive:  "bg-indigo-500 border-indigo-500 text-white",
    pillInactive:"bg-white border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700",
  },
  emerald: {
    header:      "bg-emerald-50 border-emerald-100",
    text:        "text-emerald-700",
    pillActive:  "bg-emerald-500 border-emerald-500 text-white",
    pillInactive:"bg-white border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700",
  },
  violet: {
    header:      "bg-violet-50 border-violet-100",
    text:        "text-violet-700",
    pillActive:  "bg-violet-500 border-violet-500 text-white",
    pillInactive:"bg-white border-slate-200 text-slate-600 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700",
  },
};

/* ─── Rating → colour tone helper ───────────────────────────── */
const optionTone = (value) => {
  const v = String(value || "").toLowerCase();
  if (v.includes("excellent") || v.includes("strong") || v.includes("stable") || v.includes("active")) return "emerald";
  if (v.includes("good") || v.includes("mostly") || v.includes("moderate") || v.includes("medium")) return "blue";
  if (v.includes("average") || v.includes("developing") || v.includes("fluctuating") || v.includes("fair")) return "amber";
  if (v.includes("low") || v.includes("needs") || v.includes("inconsistent")) return "red";
  return "slate";
};

const TONE_BADGE = {
  emerald: "bg-emerald-50 text-emerald-700",
  blue:    "bg-blue-50 text-blue-700",
  amber:   "bg-amber-50 text-amber-700",
  red:     "bg-red-50 text-red-700",
  slate:   "bg-slate-100 text-slate-600",
};

/* ─── Helpers ────────────────────────────────────────────────── */
const buildInitialRatings = () => {
  const out = {};
  SECTION_FIELDS.forEach((s) => s.fields.forEach((f) => { out[f.label] = ""; }));
  return out;
};

const buildInitialNotes = () => {
  const out = {};
  NOTES_FIELDS.forEach((f) => { out[f] = ""; });
  return out;
};

const parseSortableNumber = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return Number.POSITIVE_INFINITY;
  const n = Number(text);
  if (Number.isFinite(n)) return n;
  const m = text.match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
};

const TOTAL_FIELDS = SECTION_FIELDS.reduce((sum, s) => sum + s.fields.length, 0);

/* ─── StudentChip ────────────────────────────────────────────── */
const StudentChip = ({ student, selected, onClick, disabled }) => {
  const name     = student.name || "Student";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const roll     = student.roll || student.rollNo || student.rollNumber || "";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all duration-150",
        selected
          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
          : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50",
      ].join(" ")}
    >
      <span className={[
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
        selected ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700",
      ].join(" ")}>
        {initials}
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-xs font-semibold truncate leading-tight">{name}</span>
        {roll && (
          <span className={["text-[10px]", selected ? "text-indigo-200" : "text-slate-400"].join(" ")}>
            Roll {roll}
          </span>
        )}
      </span>
    </button>
  );
};

/* ─── HistoryEntry ───────────────────────────────────────────── */
const HistoryEntry = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);
  const allRatings = { ...(entry.healthObservations || {}), ...(entry.emotionObservations || {}) };
  const ratingEntries = Object.entries(allRatings).filter(([, v]) => v);

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{entry.studentName || "Student"}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
            <Clock className="h-3 w-3 shrink-0" />
            {entry.recordedAt
              ? new Date(entry.recordedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
              : "—"}
          </p>
        </div>
        {ratingEntries.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && ratingEntries.length > 0 && (
          <Motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ratingEntries.map(([key, val]) => (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${TONE_BADGE[optionTone(val)] || TONE_BADGE.slate}`}
                >
                  {key}: {val}
                </span>
              ))}
            </div>
          </Motion.div>
        )}
      </AnimatePresence>

      {entry.additionalNotes && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500 line-clamp-2 whitespace-pre-line">
          {entry.additionalNotes}
        </p>
      )}
    </div>
  );
};

/* ─── Main component ─────────────────────────────────────────── */
const StudentObservationOverview = () => {
  const [students, setStudents]             = useState([]);
  const [studentIdSet, setStudentIdSet]     = useState(new Set());
  const [observations, setObservations]     = useState([]);
  const [sessionOptions, setSessionOptions] = useState([]);
  const [classOptions, setClassOptions]     = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [selectedSession, setSelectedSession]   = useState("");
  const [selectedClass, setSelectedClass]       = useState("");
  const [selectedSection, setSelectedSection]   = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentSearch, setStudentSearch]         = useState("");
  const [ratings, setRatings] = useState(buildInitialRatings);
  const [notes, setNotes]     = useState(buildInitialNotes);
  const [studentsLoading, setStudentsLoading]       = useState(true);
  const [observationsLoading, setObservationsLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  /* Load students */
  useEffect(() => {
    const load = async () => {
      setStudentsLoading(true);
      setError("");
      try {
        const token    = localStorage.getItem("token");
        const userType = localStorage.getItem("userType");
        if (!token || userType !== "Teacher") throw new Error("Teacher session not found. Please log in again.");
        const query = new URLSearchParams();
        if (selectedSession) query.set("session", selectedSession);
        if (selectedClass)   query.set("className", selectedClass);
        if (selectedSection) query.set("section", selectedSection);
        const res = await fetch(`${API_BASE_URL}/api/attendance/teacher/students?${query.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || "Unable to load students");
        const list = Array.isArray(payload?.students) ? payload.students : [];
        const ids  = new Set(list.map((s) => String(s?._id || s?.id || "")));
        setSessionOptions(Array.isArray(payload?.options?.sessions)  ? payload.options.sessions  : []);
        setClassOptions(Array.isArray(payload?.options?.classes)    ? payload.options.classes    : []);
        setSectionOptions(Array.isArray(payload?.options?.sections) ? payload.options.sections   : []);
        setStudents(list);
        setStudentIdSet(ids);
        if (!ids.has(String(selectedStudentId || ""))) setSelectedStudentId("");
      } catch (err) {
        setError(err.message || "Unable to load data");
        setStudents([]);
        setStudentIdSet(new Set());
      } finally {
        setStudentsLoading(false);
      }
    };
    load();
  }, [selectedSession, selectedClass, selectedSection]);

  /* Load observations */
  useEffect(() => {
    const load = async () => {
      setObservationsLoading(true);
      try {
        const token    = localStorage.getItem("token");
        const userType = localStorage.getItem("userType");
        if (!token || userType !== "Teacher") return;
        const res = await fetch(`${API_BASE_URL}/api/observations/teacher?limit=30`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || "Unable to load observations");
        setObservations(Array.isArray(payload?.observations) ? payload.observations.slice(0, 10) : []);
      } catch (err) {
        console.error("Load observations error:", err);
      } finally {
        setObservationsLoading(false);
      }
    };
    load();
  }, []);

  const filledCount = useMemo(() => Object.values(ratings).filter(Boolean).length, [ratings]);

  const sortedStudents = useMemo(() =>
    [...students].sort((a, b) => {
      const nA = parseSortableNumber(a?.roll ?? a?.rollNo ?? a?.rollNumber ?? a?.studentCode);
      const nB = parseSortableNumber(b?.roll ?? b?.rollNo ?? b?.rollNumber ?? b?.studentCode);
      if (nA !== nB) return nA - nB;
      return String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { numeric: true });
    }),
  [students]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return sortedStudents;
    return sortedStudents.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        String(s.roll || s.rollNo || "").includes(q),
    );
  }, [sortedStudents, studentSearch]);

  const handleRatingChange = (label, value) =>
    setRatings((prev) => ({ ...prev, [label]: prev[label] === value ? "" : value }));

  const handleNoteChange = (field, value) =>
    setNotes((prev) => ({ ...prev, [field]: value }));

  const buildPayload = () => {
    const healthObservations  = {};
    const emotionObservations = {};
    SECTION_FIELDS.forEach((section) =>
      section.fields.forEach((f) => {
        if (!ratings[f.label]) return;
        if (section.group === "health") healthObservations[f.label]  = ratings[f.label];
        else                            emotionObservations[f.label] = ratings[f.label];
      }),
    );
    const concernText    = notes["Areas of concern"] || "";
    const urgencyLevel   = concernText.trim() ? "high" : "normal";
    const followUpRequired = Boolean(concernText.trim());
    const noteLines      = NOTES_FIELDS.map((f) => `${f}: ${notes[f] || "-"}`);
    return {
      studentId: selectedStudentId,
      date: new Date().toISOString().split("T")[0],
      time: new Date().toTimeString().slice(0, 5),
      healthObservations,
      emotionObservations,
      additionalNotes: noteLines.join("\n"),
      urgencyLevel,
      followUpRequired,
      parentNotification: false,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      if (!selectedStudentId) throw new Error("Please select a student.");
      if (!studentIdSet.has(String(selectedStudentId))) throw new Error("Selected student is not in your allocation.");
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Teacher session not found. Please log in again.");
      setSaving(true);
      const res = await fetch(`${API_BASE_URL}/api/observations/teacher`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Unable to save observation");
      setObservations((prev) => [payload, ...prev].slice(0, 10));
      setRatings(buildInitialRatings());
      setNotes(buildInitialNotes());
      setSelectedStudentId("");
      setStudentSearch("");
      setSuccess("Wellbeing observation saved.");
    } catch (err) {
      setError(err.message || "Unable to save observation");
    } finally {
      setSaving(false);
    }
  };

  const progressPct = Math.round((filledCount / TOTAL_FIELDS) * 100);

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <Motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1100px] space-y-4 rounded-[2rem] border border-[#e2e8ee] bg-white p-5 text-black shadow-[0_4px_20px_rgba(0,20,30,0.05)] transition-shadow hover:shadow-[0_8px_32px_rgba(0,20,30,0.07)] sm:p-8"
    >

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_16px_0_rgba(15,23,42,0.08)] px-6 py-5">
        <div className="relative flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-2xl select-none">
            💛
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-950">Emotional Wellbeing</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Record non-academic observations on students' emotional, social, and behavioral wellbeing.
            </p>
          </div>
          {filledCount > 0 && (
            <div className="flex items-center gap-2.5 sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2">
              <div className="h-2 w-28 rounded-full bg-slate-100 overflow-hidden">
                <Motion.div
                  className="h-full rounded-full bg-indigo-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
              <span className="text-xs font-semibold text-indigo-600 tabular-nums">
                {filledCount}/{TOTAL_FIELDS}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Alerts ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <Motion.div
            key="err"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </Motion.div>
        )}
        {success && (
          <Motion.div
            key="ok"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
          </Motion.div>
        )}
      </AnimatePresence>

      {/* ── Two-column grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Left: form ─────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4">

          {/* Filter row */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_16px_0_rgba(15,23,42,0.08)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-3">
              Filter Students
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  label: "Academic Year", value: selectedSession,
                  options: sessionOptions, placeholder: "All Years",
                  onChange: setSelectedSession,
                },
                {
                  label: "Class", value: selectedClass,
                  options: classOptions, placeholder: "All Classes",
                  onChange: (v) => { setSelectedClass(v); setSelectedSection(""); },
                },
                {
                  label: "Section", value: selectedSection,
                  options: sectionOptions, placeholder: "All Sections",
                  onChange: setSelectedSection,
                },
              ].map(({ label, value, options, placeholder, onChange }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={studentsLoading || saving}
                  >
                    <option value="">{placeholder}</option>
                    {options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Student picker */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_16px_0_rgba(15,23,42,0.08)] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Select Student
              </p>
              {selectedStudentId && (
                <button
                  type="button"
                  onClick={() => setSelectedStudentId("")}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or roll…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {studentsLoading ? (
              <p className="py-6 text-center text-sm text-slate-400">Loading students…</p>
            ) : filteredStudents.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No students found.</p>
            ) : (
              <div className="max-h-52 overflow-y-auto pr-0.5">
                <div className="flex flex-wrap gap-2">
                  {filteredStudents.map((student) => {
                    const id = String(student._id || student.id || "");
                    return (
                      <StudentChip
                        key={id}
                        student={student}
                        selected={String(selectedStudentId) === id}
                        onClick={() =>
                          setSelectedStudentId((prev) => (String(prev) === id ? "" : id))
                        }
                        disabled={saving}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Rating sections */}
          {SECTION_FIELDS.map((section, si) => {
            const C = COLOR[section.color] || COLOR.indigo;
            const sectionFilled = section.fields.filter((f) => ratings[f.label]).length;
            return (
              <Motion.div
                key={section.title}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: si * 0.06 }}
                className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_16px_0_rgba(15,23,42,0.08)] overflow-hidden"
              >
                {/* Section header */}
                <div className={`flex items-center justify-between px-5 py-3.5 border-b ${C.header}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg select-none">{section.emoji}</span>
                    <span className={`text-sm font-semibold ${C.text}`}>{section.title}</span>
                  </div>
                  <span className={`text-xs font-semibold tabular-nums ${sectionFilled > 0 ? C.text : "text-slate-400"}`}>
                    {sectionFilled}/{section.fields.length}
                  </span>
                </div>

                {/* Fields */}
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {section.fields.map((fieldDef) => (
                    <div key={fieldDef.label}>
                      <span className="block text-xs font-semibold text-slate-700 mb-2">
                        {fieldDef.label}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {fieldDef.options.map((opt) => {
                          const active = ratings[fieldDef.label] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleRatingChange(fieldDef.label, opt)}
                              disabled={saving}
                              className={[
                                "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all duration-150",
                                active ? C.pillActive : C.pillInactive,
                              ].join(" ")}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Motion.div>
            );
          })}

          {/* Notes */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_16px_0_rgba(15,23,42,0.08)] p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-lg select-none">📝</span>
              <span className="text-sm font-semibold text-slate-700">Special Observations & Notes</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {NOTES_FIELDS.map((f) => (
                <div key={f}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">{f}</label>
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 resize-none"
                    placeholder={`Enter ${f.toLowerCase()}…`}
                    value={notes[f]}
                    onChange={(e) => handleNoteChange(f, e.target.value)}
                    disabled={saving}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || studentsLoading || !selectedStudentId}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Wellbeing Observation"}
          </button>
        </form>

        {/* ── Right: history ──────────────────────────────────── */}
        <div>
          <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_16px_0_rgba(15,23,42,0.08)] p-5 sticky top-4">
            <h2 className="text-sm font-semibold text-slate-950 mb-4">Observation History</h2>

            {observationsLoading ? (
              <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
            ) : observations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <Heart className="h-9 w-9 text-slate-200" />
                <p className="text-sm text-slate-400 text-center leading-relaxed">
                  No observations yet.<br />Save one to see it here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {observations.map((entry, i) => (
                    <Motion.div
                      key={entry.id || entry._id || i}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.04 }}
                    >
                      <HistoryEntry entry={entry} />
                    </Motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

      </div>
    </Motion.div>
  );
};

export default StudentObservationOverview;
