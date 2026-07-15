import React, { useEffect, useState, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Trash2, BookOpen, FlaskConical, Layers, PenLine, GraduationCap,
  ChevronRight, ChevronLeft, X, Sparkles, Save, Clock,
} from "lucide-react";
import PointsBadge from "./PointsBadge";
import Assignment from "./Assignment";
import { fetchCachedJson, clearStudentApiCacheByUrl } from "../utils/studentApiCache";

/* ═══════════════ TOUR STEPS CONFIG ═══════════════ */
const TOUR_STEPS = [
  { target: "tour-welcome", title: "Welcome to Your Learning Journal!", description: "This is your personal space to record what you learn every day. Let\u2019s take a quick tour!", emoji: "\u{1F4D6}", position: "center" },
  { target: "tour-timeline", title: "Your Pages", description: "All your journal entries appear here as pages. Click any page to revisit it.", emoji: "\u{1F4C5}", position: "right" },
  { target: "tour-new-entry", title: "Start a New Page", description: "Click \u201CNew Page\u201D to begin a fresh journal entry for today.", emoji: "\u2795", position: "right" },
  { target: "tour-title", title: "Give It a Title", description: "Write a short title \u2014 like \u201CDiscovered photosynthesis\u201D or \u201CMath breakthrough!\u201D", emoji: "\u270F\uFE0F", position: "left" },
  { target: "tour-content", title: "Write Your Notes", description: "This is your lined paper. Describe what you learned, questions you have, or anything interesting.", emoji: "\u{1F4DD}", position: "left" },
  { target: "tour-mood-tags", title: "Mood & Tags", description: "Add tags to organize entries and pick an emoji that matches how you felt.", emoji: "\u{1F3F7}\uFE0F", position: "top" },
  { target: "tour-save", title: "Auto-Save & Manual Save", description: "Your journal auto-saves as you type! You can also click Save anytime.", emoji: "\u{1F4BE}", position: "top" },
  { target: "tour-done", title: "You\u2019re All Set!", description: "Start writing your first entry now. Happy writing!", emoji: "\u{1F389}", position: "center" },
];
const TOUR_STORAGE_KEY = "journal_tour_completed";

const AssignmentView = forwardRef(({ defaultType = "school" }, ref) => {
  const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
  const JOURNAL_ENDPOINT = `${API_BASE}/api/student/auth/journal`;
  const JOURNAL_CACHE_TTL_MS = 2 * 60 * 1000;
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [assignmentType, setAssignmentType] = useState(defaultType);

  /* Journal state */
  const [journalTitle, setJournalTitle] = useState("");
  const [journalContent, setJournalContent] = useState("");
  const [journalTags, setJournalTags] = useState("");
  const [journalMood, setJournalMood] = useState("Neutral");
  const [journalEntries, setJournalEntries] = useState([]);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [autosaveLabel, setAutosaveLabel] = useState("Saved");
  const [journalLoading, setJournalLoading] = useState(false);
  const skipAutosaveRef = useRef(false);
  const [showMobileIndex, setShowMobileIndex] = useState(false);

  /* Tour state */
  const [tourStep, setTourStep] = useState(-1);
  const [tourDismissed, setTourDismissed] = useState(() => {
    try { return localStorage.getItem(TOUR_STORAGE_KEY) === "true"; } catch { return false; }
  });

  useEffect(() => { setAssignmentType(defaultType); }, [defaultType]);
  useEffect(() => { if (assignmentType === "journal") loadJournalEntries(); }, [assignmentType]);
  useEffect(() => {
    if (assignmentType === "journal" && !tourDismissed && tourStep === -1) {
      const t = setTimeout(() => setTourStep(0), 600);
      return () => clearTimeout(t);
    }
  }, [assignmentType, tourDismissed]);

  /* Tour helpers */
  const tourNext = useCallback(() => setTourStep((s) => Math.min(s + 1, TOUR_STEPS.length - 1)), []);
  const tourPrev = useCallback(() => setTourStep((s) => Math.max(s - 1, 0)), []);
  const tourFinish = useCallback(() => { setTourStep(-1); setTourDismissed(true); try { localStorage.setItem(TOUR_STORAGE_KEY, "true"); } catch { } }, []);
  const tourSkip = tourFinish;
  const restartTour = useCallback(() => { setTourDismissed(false); setTourStep(0); try { localStorage.removeItem(TOUR_STORAGE_KEY); } catch { } }, []);

  /* Auth */
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  /* Journal CRUD */
  const normalizeEntry = (entry) => ({
    id: entry?._id || entry?.id,
    title: entry?.title || "",
    content: entry?.content || "",
    tags: Array.isArray(entry?.tags) ? entry.tags : [],
    mood: entry?.mood || "Neutral",
    createdAt: entry?.createdAt,
    updatedAt: entry?.updatedAt,
  });

  const loadJournalEntries = async ({ forceRefresh = false } = {}) => {
    const headers = getAuthHeaders();
    if (!headers) { setAutosaveLabel("Login required"); setJournalEntries([]); return; }
    setJournalLoading(true);
    try {
      const { data: payload } = await fetchCachedJson(JOURNAL_ENDPOINT, {
        ttlMs: JOURNAL_CACHE_TTL_MS,
        forceRefresh,
        fetchOptions: { headers },
      });
      setJournalEntries((Array.isArray(payload?.entries) ? payload.entries : []).map(normalizeEntry));
      setAutosaveLabel("Saved");
    } catch (err) {
      console.error("Journal load error:", err);
      setAutosaveLabel("Not saved");
    } finally { setJournalLoading(false); }
  };

  const resetJournalForm = () => { setSelectedEntryId(null); setJournalTitle(""); setJournalContent(""); setJournalTags(""); setJournalMood("Neutral"); };

  const handleSaveDraft = async () => {
    const headers = getAuthHeaders();
    if (!headers) { setAutosaveLabel("Login required"); return; }
    if (!journalTitle.trim() && !journalContent.trim()) return;
    setAutosaveLabel("Saving\u2026");
    const payload = { title: journalTitle.trim() || "Untitled", content: journalContent, tags: (journalTags || "").split(",").map((t) => t.trim()).filter(Boolean), mood: journalMood };
    try {
      if (selectedEntryId) {
        const res = await fetch(`${API_BASE}/api/student/auth/journal/${selectedEntryId}`, { method: "PUT", headers, body: JSON.stringify(payload) });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || "Unable to update"); }
        const data = await res.json();
        const entry = normalizeEntry(data?.entry || data);
        setJournalEntries((prev) => prev.map((e) => (e.id === selectedEntryId ? entry : e)));
      } else {
        const res = await fetch(`${API_BASE}/api/student/auth/journal`, { method: "POST", headers, body: JSON.stringify(payload) });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || "Unable to create"); }
        const data = await res.json();
        const entry = normalizeEntry(data?.entry || data);
        setJournalEntries((prev) => [entry, ...prev]);
        setSelectedEntryId(entry.id);
      }
      clearStudentApiCacheByUrl(JOURNAL_ENDPOINT);
      setAutosaveLabel("Saved");
    } catch (err) { console.error("Journal save error:", err); setAutosaveLabel("Not saved"); }
  };

  const handleDeleteEntry = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE}/api/student/auth/journal/${id}`, { method: "DELETE", headers });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || "Unable to delete"); }
      setJournalEntries((prev) => prev.filter((e) => e.id !== id));
      clearStudentApiCacheByUrl(JOURNAL_ENDPOINT);
      if (selectedEntryId === id) resetJournalForm();
    } catch (err) { console.error("Journal delete error:", err); }
  };

  const loadEntry = (entry) => {
    skipAutosaveRef.current = true;
    setSelectedEntryId(entry.id);
    setJournalTitle(entry.title || "");
    setJournalContent(entry.content || "");
    setJournalTags((entry.tags || []).join(", "));
    setJournalMood(entry.mood || "Neutral");
    setShowMobileIndex(false);
  };

  /* Expose save method to parent via ref */
  useImperativeHandle(ref, () => ({
    saveJournal: handleSaveDraft,
  }));

  /* Autosave debounce */
  useEffect(() => {
    if (assignmentType !== "journal") return;
    if (skipAutosaveRef.current) { skipAutosaveRef.current = false; return; }
    if (!journalTitle.trim() && !journalContent.trim()) { setAutosaveLabel("Saved"); return; }
    setAutosaveLabel("Saving\u2026");
    const t = setTimeout(() => handleSaveDraft(), 1200);
    return () => clearTimeout(t);
  }, [journalTitle, journalContent, journalTags, journalMood, assignmentType]);

  /* Type tabs */
  const typeTabs = [
    { key: "school", label: "School", icon: BookOpen },
    { key: "eec", label: "Practice", icon: GraduationCap },
    { key: "lab", label: "Lab", icon: FlaskConical },
    { key: "flashcard", label: "FlashCard", icon: Layers },
  ];

  const moodOptions = ["Happy", "Neutral", "Curious", "Challenged", "Excited"];
  const moodEmojis = { Happy: "\u{1F60A}", Neutral: "\u{1F610}", Curious: "\u{1F914}", Challenged: "\u{1F4AA}", Excited: "\u{1F389}" };

  const entriesWithIndex = useMemo(() => {
    const counts = {};
    journalEntries.forEach((e) => {
      const d = new Date(e.updatedAt || e.createdAt);
      const k = Number.isNaN(d.getTime()) ? "unknown" : d.toISOString().slice(0, 10);
      counts[k] = (counts[k] || 0) + 1;
    });
    const indices = {};
    return journalEntries.map((e) => {
      const d = new Date(e.updatedAt || e.createdAt);
      const ok = !Number.isNaN(d.getTime());
      const k = ok ? d.toISOString().slice(0, 10) : "unknown";
      const label = ok ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Unknown";
      const idx = (indices[k] = (indices[k] || 0) + 1);
      return { ...e, _dateLabel: label, _dateIndex: idx, _dateTotal: counts[k] || 1 };
    });
  }, [journalEntries]);

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className={assignmentType === "journal" ? "w-full h-full overflow-hidden" : "w-full min-h-screen bg-slate-50 px-3 sm:px-6 md:px-8 py-5 pb-24 md:pb-6 space-y-5 overflow-x-hidden"}>

      {/* Header (non-journal) */}
      {assignmentType !== "journal" && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-200/60">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Assignments</h1>
              <p className="mt-0.5 text-sm text-slate-500">Manage your assignments and submissions</p>
            </div>
          </div>
          {/* <PointsBadge /> */}
        </div>
      )}

      {/* Type Tabs (non-journal) */}
      {assignmentType !== "journal" && (
        <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm border border-slate-100">
          {typeTabs.filter(t => t.key !== 'tryout' && t.key !== 'flashcard' && t.key !== 'lab').map((t) => (
            <button key={t.key} onClick={() => { setAssignmentType(t.key); }}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${assignmentType === t.key ? "bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200/60" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ═══════════════ JOURNAL - VIBRANT MINIMALIST ═══════════════ */}
      {assignmentType === "journal" && (
        <div data-tour-root className="relative mx-auto max-w-7xl h-full">

          {/* ── Journal Wrapper ── */}
          <div
            className="rounded-2xl overflow-hidden flex flex-col h-full"
            style={{
              background: "#fdfcf8",
              boxShadow: "0 20px 60px -10px rgba(61,90,69,0.15), 0 0 0 1px rgba(61,90,69,0.08)",
            }}
          >
            {/* ── Sticky Header ── */}
            <div
              className="shrink-0 border-b flex items-center justify-between px-4 sm:px-6 h-16 z-20 sticky top-0"
              style={{
                borderColor: "rgba(61,90,69,0.12)",
                background: "rgba(253,252,248,0.85)",
                backdropFilter: "blur(12px)",
              }}
            >
              {/* Left: Brand */}
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shadow-md"
                  style={{ background: "#3d5a45" }}
                >
                  <BookOpen className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h1
                    className="font-bold text-lg leading-none"
                    style={{ color: "#3d5a45", fontFamily: "'Merriweather', Georgia, serif" }}
                  >
                    My Learning Journal
                  </h1>
                  <p className="text-[10px] uppercase tracking-widest font-semibold mt-0.5" style={{ color: "#9ca3af" }}>
                    Personal Growth Notebook
                  </p>
                </div>
              </div>

              {/* Right: Tour + Autosave + Points */}
              <div className="flex items-center gap-2 sm:gap-3">
                {tourDismissed && (
                  <button
                    onClick={restartTour}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all"
                    style={{ color: "#6b7280", background: "transparent" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Tour
                  </button>
                )}
                <div
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${autosaveLabel === "Saved"
                    ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                    : autosaveLabel.includes("Saving")
                      ? "text-amber-700 bg-amber-50 border-amber-100"
                      : "text-red-600 bg-red-50 border-red-100"
                    }`}
                >
                  {autosaveLabel === "Saved" ? <Save className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  <span className="hidden sm:inline">{autosaveLabel}</span>
                </div>
                {/* <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold"
                  style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#b45309" }}
                >
                  <span>⚡</span>
                  <PointsBadge />
                </div> */}
              </div>
            </div>

            {/* ── Main Content: Sidebar + Editor ── */}
            <div className="flex flex-1 min-h-0 flex-col sm:flex-row overflow-hidden">

              {/* ─── Left Sidebar: Index ─── */}
              <aside
                data-tour="tour-timeline"
                className="w-full sm:w-72 lg:w-80 shrink-0 flex flex-col border-r overflow-hidden"
                style={{ borderColor: "rgba(61,90,69,0.1)", background: "#f9f8f5" }}
              >
                {/* Mobile Index Toggle */}
                <button
                  className="sm:hidden flex items-center justify-between w-full px-4 py-3 border-b"
                  style={{ borderColor: "rgba(61,90,69,0.1)" }}
                  onClick={() => setShowMobileIndex(prev => !prev)}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" style={{ color: "#3d5a45" }} />
                    <span className="text-sm font-bold" style={{ color: "#3d5a45" }}>Index</span>
                    {journalEntries.length > 0 && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: "#d1fae5", color: "#065f46" }}
                      >
                        {journalEntries.length}
                      </span>
                    )}
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 transition-transform duration-200 ${showMobileIndex ? "rotate-90" : ""}`}
                    style={{ color: "#9ca3af" }}
                  />
                </button>

                {/* Index Panel */}
                <div className={`${showMobileIndex ? "flex" : "hidden"} sm:flex flex-col flex-1 p-4 lg:p-5 overflow-hidden`}>

                  {/* Index heading (desktop) */}
                  <div className="hidden sm:flex items-center justify-between mb-4">
                    <h2
                      className="text-xs font-bold uppercase tracking-[0.2em]"
                      style={{ color: "#9ca3af", fontFamily: "'Merriweather', Georgia, serif" }}
                    >
                      Index
                    </h2>
                    <span className="text-[10px] font-semibold" style={{ color: "#3d5a45" }}>
                      {journalEntries.length} {journalEntries.length === 1 ? "page" : "pages"}
                    </span>
                  </div>

                  {/* New Entry Button */}
                  <button
                    data-tour="tour-new-entry"
                    onClick={() => { resetJournalForm(); setShowMobileIndex(false); }}
                    className="group mb-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-all"
                    style={{ borderColor: "#a3c4a8", color: "#3d5a45", background: "rgba(61,90,69,0.03)" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#3d5a45"; e.currentTarget.style.background = "rgba(61,90,69,0.06)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#a3c4a8"; e.currentTarget.style.background = "rgba(61,90,69,0.03)"; }}
                  >
                    <Plus className="h-4 w-4 transition-transform group-hover:rotate-90 duration-200" />
                    New Entry
                  </button>

                  {/* Entry List */}
                  <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 custom-scrollbar">
                    {journalLoading && (
                      <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color: "#9ca3af" }}>
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-200 border-t-green-600" />
                        <span className="text-xs">Loading entries…</span>
                      </div>
                    )}

                    {!journalLoading && entriesWithIndex.map((entry, idx) => {
                      const isSelected = selectedEntryId === entry.id;
                      const moodDotColors = {
                        Happy: "#22c55e",
                        Excited: "#f59e0b",
                        Curious: "#6366f1",
                        Challenged: "#ef4444",
                        Neutral: "#94a3b8",
                      };
                      const entryNumber = String(journalEntries.length - idx).padStart(3, "0");
                      return (
                        <div
                          key={entry.id}
                          onClick={() => loadEntry(entry)}
                          className="group relative cursor-pointer rounded-xl transition-all"
                          style={{
                            padding: "12px 14px",
                            background: isSelected ? "#3d5a45" : "#ffffff",
                            boxShadow: isSelected
                              ? "0 4px 14px -3px rgba(61,90,69,0.35)"
                              : "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
                          }}
                          onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.boxShadow = "0 4px 12px -2px rgba(0,0,0,0.12)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                          onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "none"; } }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div
                                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                                style={{ color: isSelected ? "rgba(255,255,255,0.55)" : "#9ca3af" }}
                              >
                                Entry #{entryNumber}
                              </div>
                              <h3
                                className="text-sm font-bold leading-snug truncate"
                                style={{
                                  color: isSelected ? "#ffffff" : "#1e293b",
                                  fontFamily: "'Merriweather', Georgia, serif",
                                }}
                              >
                                {entry.title || "Untitled"}
                              </h3>
                              <p
                                className="text-[11px] mt-0.5"
                                style={{ color: isSelected ? "rgba(255,255,255,0.6)" : "#9ca3af" }}
                              >
                                {entry._dateLabel}
                              </p>
                            </div>
                            <button
                              onClick={ev => { ev.stopPropagation(); handleDeleteEntry(entry.id); }}
                              className="shrink-0 rounded p-1 transition opacity-0 group-hover:opacity-100"
                              style={{ color: isSelected ? "rgba(255,255,255,0.5)" : "#ef4444" }}
                              onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {/* Mood dot + category */}
                          <div className="flex items-center gap-1.5 mt-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: moodDotColors[entry.mood] || "#94a3b8" }}
                            />
                            {entry.tags?.length > 0 && (
                              <span
                                className="text-[9px] font-semibold uppercase tracking-wide"
                                style={{ color: isSelected ? "rgba(255,255,255,0.5)" : "#9ca3af" }}
                              >
                                {entry.tags[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {!journalLoading && journalEntries.length === 0 && (
                      <div className="flex flex-col items-center py-14 gap-2" style={{ color: "#9ca3af" }}>
                        <PenLine className="h-9 w-9 opacity-40" />
                        <p className="text-sm font-medium">No entries yet</p>
                        <p className="text-xs opacity-70 text-center">Click "New Entry" to write your first page!</p>
                      </div>
                    )}
                  </div>

                  {/* Total Pages footer */}
                  {journalEntries.length > 0 && (
                    <div
                      className="mt-3 pt-3 border-t flex items-center justify-between text-[10px] font-bold uppercase tracking-widest"
                      style={{ borderColor: "rgba(61,90,69,0.1)", color: "#9ca3af" }}
                    >
                      <span>Total Pages</span>
                      <span style={{ color: "#3d5a45" }}>{journalEntries.length}</span>
                    </div>
                  )}
                </div>
              </aside>

              {/* ─── Right: Writing Canvas ─── */}
              <section
                className="flex-1 flex flex-col min-h-0"
                style={{ background: "#ffffff" }}
              >
                {/* Scrollable writing area */}
                <div className="flex-1 overflow-y-auto px-6 sm:px-10 lg:px-20 py-8 sm:py-12 pb-24 lg:pb-12 custom-scrollbar">
                  <div className="max-w-3xl mx-auto space-y-6">

                    {/* Date + decoration dots */}
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-bold uppercase tracking-[0.2em]"
                        style={{ color: "#94a3b8" }}
                      >
                        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      </span>
                      <div className="flex gap-2">
                        {[0, 1, 2].map(i => (
                          <div
                            key={i}
                            className="w-3 h-3 rounded-full border-2"
                            style={{ borderColor: "#e2e8f0" }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Title input */}
                    <input
                      data-tour="tour-title"
                      type="text"
                      value={journalTitle}
                      onChange={e => setJournalTitle(e.target.value)}
                      placeholder="Title this page..."
                      className="w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none placeholder-slate-200"
                      style={{
                        fontSize: "clamp(1.75rem, 4vw, 3rem)",
                        fontWeight: "800",
                        fontFamily: "'Merriweather', Georgia, serif",
                        color: "#1e293b",
                        lineHeight: "1.2",
                      }}
                    />

                    {/* Lined writing area */}
                    <div
                      data-tour="tour-content"
                      className="relative"
                      style={{ minHeight: "360px" }}
                    >
                      {/* Horizontal lines */}
                      <div
                        className="absolute inset-0 pointer-events-none opacity-40"
                        style={{
                          backgroundImage: "linear-gradient(#e2e8f0 1px, transparent 1px)",
                          backgroundSize: "100% 2.5rem",
                        }}
                      />
                      <textarea
                        value={journalContent.replace(/<[^>]*>/g, "")}
                        onChange={e => setJournalContent(e.target.value)}
                        placeholder="Write about what you learned today..."
                        className="w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none resize-none placeholder-slate-200"
                        style={{
                          minHeight: "360px",
                          fontSize: "1.0625rem",
                          lineHeight: "2.5rem",
                          color: "#475569",
                          fontFamily: "'Merriweather', Georgia, serif",
                          position: "relative",
                          zIndex: 1,
                        }}
                      />
                    </div>

                    {/* Tags & Mood section */}
                    <div
                      data-tour="tour-mood-tags"
                      className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-6 border-t"
                      style={{ borderColor: "#f1f5f9" }}
                    >
                      {/* Tags */}
                      <div className="space-y-3">
                        <label
                          className="block text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: "#94a3b8" }}
                        >
                          Categories &amp; Tags
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {/* Render each tag as a pill */}
                          {(journalTags || "").split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                            <span
                              key={tag}
                              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border"
                              style={{ background: "#f0fdf4", color: "#16a34a", borderColor: "#bbf7d0" }}
                            >
                              #{tag}
                              <button
                                type="button"
                                onClick={() =>
                                  setJournalTags(
                                    (journalTags || "").split(",")
                                      .map(t => t.trim())
                                      .filter(t => t && t !== tag)
                                      .join(", ")
                                  )
                                }
                                className="ml-0.5 text-green-400 hover:text-green-700 leading-none text-sm"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          {/* Quick-add tag input / button */}
                          <input
                            type="text"
                            placeholder="+ Add Tag"
                            className="px-3 py-1 rounded-full border-2 border-dotted text-xs font-bold transition focus:outline-none focus:ring-0"
                            style={{ borderColor: "#e2e8f0", color: "#94a3b8", background: "transparent", width: "100px" }}
                            onKeyDown={e => {
                              if ((e.key === "Enter" || e.key === ",") && e.currentTarget.value.trim()) {
                                e.preventDefault();
                                const newTag = e.currentTarget.value.trim().replace(/,$/, "");
                                const existing = (journalTags || "").split(",").map(t => t.trim()).filter(Boolean);
                                if (newTag && !existing.includes(newTag)) {
                                  setJournalTags([...existing, newTag].join(", "));
                                }
                                e.currentTarget.value = "";
                              }
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = "#3d5a45"; e.currentTarget.style.color = "#3d5a45"; }}
                            onBlur={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#94a3b8"; }}
                          />
                        </div>
                      </div>

                      {/* Mood */}
                      <div className="space-y-3">
                        <label
                          className="block text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: "#94a3b8" }}
                        >
                          Current Mood
                        </label>
                        <div className="flex gap-2">
                          {moodOptions.map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setJournalMood(m)}
                              title={m}
                              className="w-11 h-11 flex items-center justify-center rounded-xl text-2xl transition-all border"
                              style={{
                                background: journalMood === m ? "#fef3c7" : "#f8fafc",
                                borderColor: journalMood === m ? "#fbbf24" : "transparent",
                                filter: journalMood === m ? "none" : "grayscale(1)",
                                boxShadow: journalMood === m ? "0 0 0 2px #fde68a" : "none",
                                transform: journalMood === m ? "scale(1.1)" : "scale(1)",
                              }}
                              onMouseEnter={e => { if (journalMood !== m) e.currentTarget.style.filter = "none"; }}
                              onMouseLeave={e => { if (journalMood !== m) e.currentTarget.style.filter = "grayscale(1)"; }}
                            >
                              {moodEmojis[m]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* ── Bottom Save Bar (sticky inside section) ── */}
                <div
                  className="shrink-0 md:flex items-center justify-between px-6 sm:px-10 lg:px-20 py-3 border-t pb-20 md:pb-3 hidden"
                  style={{ borderColor: "#f1f5f9", background: "#ffffff" }}
                >
                  <span className="text-[11px] font-semibold" style={{ color: "#94a3b8" }}>
                    {autosaveLabel === "Saved" ? "✓ All changes saved" : autosaveLabel.includes("Saving") ? "Saving…" : "Unsaved changes"}
                  </span>
                  <button
                    data-tour="tour-save"
                    onClick={handleSaveDraft}
                    className="group flex items-center gap-2 text-white font-bold tracking-wide transition-all active:scale-95"
                    style={{
                      paddingLeft: "1.25rem",
                      paddingRight: "1.5rem",
                      paddingTop: "0.625rem",
                      paddingBottom: "0.625rem",
                      borderRadius: "9999px",
                      background: "#3d5a45",
                      boxShadow: "0 4px 14px -3px rgba(61,90,69,0.45)",
                      fontSize: "0.875rem",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#2d4535"; e.currentTarget.style.transform = "scale(1.03)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#3d5a45"; e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <Save className="h-4 w-4" />
                    Save Entry
                  </button>
                </div>
              </section>
            </div>
          </div>

          {/* ═══════════════ TOUR OVERLAY ═══════════════ */}
          {tourStep >= 0 && tourStep < TOUR_STEPS.length && (() => {
            const step = TOUR_STEPS[tourStep];
            const isCentered = step.position === "center";
            const targetEl = !isCentered ? document.querySelector(`[data-tour="${step.target}"]`) : null;
            const rect = targetEl?.getBoundingClientRect();
            const parentRect = targetEl?.closest("[data-tour-root]")?.getBoundingClientRect();
            const relTop = rect && parentRect ? rect.top - parentRect.top : 0;
            const relLeft = rect && parentRect ? rect.left - parentRect.left : 0;

            return (
              <div className="absolute inset-0 z-50 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={tourSkip} />
                {targetEl && rect && parentRect && (
                  <div className="absolute rounded-lg ring-4 ring-green-400/60 shadow-lg shadow-green-300/30"
                    style={{ top: relTop - 4, left: relLeft - 4, width: rect.width + 8, height: rect.height + 8, backgroundColor: "rgba(255,255,255,0.15)", pointerEvents: "none" }} />
                )}
                <div
                  className={`absolute flex flex-col rounded-xl border bg-white p-5 shadow-2xl ${isCentered ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" : ""}`}
                  style={{
                    borderColor: "#dcfce7",
                    width: "min(340px, 85vw)",
                    zIndex: 60,
                    ...(!isCentered && rect && parentRect ? {
                      top: step.position === "top" ? Math.max(10, relTop - 180) : Math.min(Math.max(10, relTop + 10), parentRect.height - 220),
                      left: Math.max(10, Math.min(step.position === "right" ? relLeft + rect.width + 16 : step.position === "left" ? relLeft - 356 : relLeft, parentRect.width - 360)),
                    } : {}),
                  }}
                >
                  <button onClick={tourSkip} className="absolute right-2 top-2 rounded-full p-1 text-gray-400 hover:bg-gray-100 transition">
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{step.emoji}</span>
                    <h3 className="text-base font-bold text-gray-900 pr-6">{step.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{step.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                      {TOUR_STEPS.map((_, i) => (
                        <div key={i} className={`h-2 rounded-full transition-all ${i === tourStep ? "w-5 bg-green-500" : i < tourStep ? "w-2 bg-green-300" : "w-2 bg-gray-200"}`} />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      {tourStep > 0 && (
                        <button onClick={tourPrev} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition">
                          <ChevronLeft className="h-3 w-3" /> Back
                        </button>
                      )}
                      {tourStep < TOUR_STEPS.length - 1 ? (
                        <button onClick={tourNext} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow transition hover:brightness-110"
                          style={{ backgroundColor: "#3d5a45" }}>
                          Next <ChevronRight className="h-3 w-3" />
                        </button>
                      ) : (
                        <button onClick={tourFinish} className="flex items-center gap-1 rounded-lg px-4 py-1.5 text-xs font-medium text-white shadow transition hover:brightness-110"
                          style={{ backgroundColor: "#3d5a45" }}>
                          Start Writing!
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-center text-[10px] text-gray-400">{tourStep + 1} of {TOUR_STEPS.length}</div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Assignment types */}
      {["school", "eec", "lab", "flashcard"].includes(assignmentType) && (
        <Assignment assignmentType={assignmentType} filter={filter} setFilter={setFilter} />
      )}
    </div>
  );
});

AssignmentView.displayName = 'AssignmentView';

export default AssignmentView;
