import React, { useEffect, useState, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Trash2, BookOpen, FlaskConical, Layers, PenLine, GraduationCap,
  ChevronRight, ChevronLeft, X, Sparkles, Save, Clock, Search, CheckCircle2,
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
  const [journalSearch, setJournalSearch] = useState("");

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

  /* ─── Type tabs config ─── */
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
    return journalEntries.map((e, i) => {
      const d = new Date(e.updatedAt || e.createdAt);
      const ok = !Number.isNaN(d.getTime());
      const k = ok ? d.toISOString().slice(0, 10) : "unknown";
      const label = ok ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Unknown";
      const idx = (indices[k] = (indices[k] || 0) + 1);
      const wordCount = (e.content || "").trim().split(/\s+/).filter(Boolean).length;
      const entryNumber = String(journalEntries.length - i).padStart(3, "0");
      return { ...e, _dateLabel: label, _dateIndex: idx, _dateTotal: counts[k] || 1, _wordCount: wordCount, _entryNumber: entryNumber };
    });
  }, [journalEntries]);

  const filteredEntries = useMemo(() => {
    const q = journalSearch.trim().toLowerCase();
    if (!q) return entriesWithIndex;
    return entriesWithIndex.filter((e) =>
      (e.title || "").toLowerCase().includes(q)
      || (e.content || "").toLowerCase().includes(q)
      || (e.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [entriesWithIndex, journalSearch]);

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className={assignmentType === "journal" ? "w-full h-full overflow-hidden" : "w-full min-h-screen bg-white px-4 md:px-6 py-5 pb-24 md:pb-6 overflow-x-hidden"}>

      {/* ═══════════════ JOURNAL — FOLIO (glass / purple) ═══════════════ */}
      {assignmentType === "journal" && (
        <div data-tour-root className="relative mx-auto h-full max-w-7xl overflow-y-auto custom-scrollbar px-1 pb-6">
          {/* Ambient glow */}
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
            <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-[#ede9fe]/70 blur-[100px]" />
            <div className="absolute top-1/4 -right-20 h-[26rem] w-[26rem] rounded-full bg-[#e0f2fe]/70 blur-[110px]" />
            <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#f3e8ff]/60 blur-[100px]" />
          </div>

          {/* Sticky header */}
          <div className="sticky top-0 z-20 -mx-1 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#8b5cf6]/25 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 text-[#8b5cf6]">
                <BookOpen className="size-4.5" />
              </div>
              <div>
                <h1 className="text-[17px] font-bold leading-none tracking-tight text-[#0f172a]">My Journal</h1>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8]">Personal growth notebook</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {tourDismissed && (
                <button
                  onClick={restartTour}
                  className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[#64748b] transition-colors hover:bg-[#f5f3ff] sm:flex"
                >
                  <Sparkles className="size-3.5" /> Tour
                </button>
              )}
              <div
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-semibold ${
                  autosaveLabel === "Saved"
                    ? "border-[#10b981]/30 bg-[#ecfdf5] text-[#10b981]"
                    : autosaveLabel.includes("Saving")
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-red-200 bg-red-50 text-red-600"
                }`}
              >
                {autosaveLabel === "Saved" ? <CheckCircle2 className="size-3.5" /> : <Clock className="size-3.5" />}
                <span className="hidden sm:inline">{autosaveLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            {/* ─── LEFT: Ledger ─── */}
            <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-80">
              <button
                data-tour="tour-new-entry"
                onClick={() => { resetJournalForm(); setShowMobileIndex(false); }}
                className="group flex w-full items-center justify-center gap-2 rounded-xl border border-[#8b5cf6]/25 bg-white/70 px-4 py-2.5 shadow-sm backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/90"
              >
                <span className="flex size-6 items-center justify-center rounded-lg bg-[#8b5cf6]/15 text-[#8b5cf6] transition-colors duration-200 group-hover:bg-[#8b5cf6] group-hover:text-white">
                  <Plus className="size-3.5 transition-transform duration-200 group-hover:rotate-90" />
                </span>
                <span className="text-[14px] font-semibold text-[#0f172a]">New Entry</span>
              </button>

              <div className="flex flex-col gap-2.5 rounded-2xl border border-[#8b5cf6]/25 bg-white/70 p-3 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between rounded-xl bg-[#f5f3ff]/70 p-1 text-[13px]">
                  <span className="flex-1 rounded-lg bg-white/90 py-1 text-center font-semibold text-[#8b5cf6] shadow-sm">
                    All ({journalEntries.length})
                  </span>
                </div>
                <div className="relative flex items-center">
                  <Search className="pointer-events-none absolute left-3 size-4 text-[#64748b]" />
                  <input
                    value={journalSearch}
                    onChange={(e) => setJournalSearch(e.target.value)}
                    placeholder="Filter by title, tag, or text..."
                    className="w-full rounded-xl border border-[#8b5cf6]/25 bg-white/60 py-1.5 pl-9 pr-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8] transition-all duration-200 focus:border-[#8b5cf6] focus:bg-white/90 focus:outline-none"
                  />
                </div>
              </div>

              {/* Mobile index toggle */}
              <button
                className="flex w-full items-center justify-between rounded-xl border border-[#8b5cf6]/25 bg-white/70 px-4 py-3 backdrop-blur-xl lg:hidden"
                onClick={() => setShowMobileIndex((prev) => !prev)}
              >
                <span className="text-sm font-bold text-[#0f172a]">Entries ({filteredEntries.length})</span>
                <ChevronRight className={`size-4 text-[#94a3b8] transition-transform duration-200 ${showMobileIndex ? "rotate-90" : ""}`} />
              </button>

              <div
                data-tour="tour-timeline"
                className={`${showMobileIndex ? "flex" : "hidden"} max-h-[560px] flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar lg:flex`}
              >
                {journalLoading && (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-[#94a3b8]">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#ede9fe] border-t-[#8b5cf6]" />
                    <span className="text-xs">Loading entries…</span>
                  </div>
                )}

                {!journalLoading && filteredEntries.map((entry) => {
                  const isSelected = selectedEntryId === entry.id;
                  const moodDotColors = {
                    Happy: "#22c55e",
                    Excited: "#f59e0b",
                    Curious: "#6366f1",
                    Challenged: "#ef4444",
                    Neutral: "#94a3b8",
                  };
                  const snippet = (entry.content || "").trim().slice(0, 110);
                  return (
                    <div
                      key={entry.id}
                      onClick={() => loadEntry(entry)}
                      className={`group relative cursor-pointer rounded-2xl border p-4 shadow-sm backdrop-blur-xl transition-all duration-200 ease-out hover:-translate-y-0.5 ${
                        isSelected
                          ? "border-[#8b5cf6] bg-white/85 ring-2 ring-[#8b5cf6]/20"
                          : "border-[#8b5cf6]/20 bg-white/60 hover:bg-white/80"
                      }`}
                    >
                      {isSelected && <div className="absolute bottom-4 left-0 top-4 w-1.5 rounded-r bg-[#8b5cf6]" />}
                      <div className={`flex items-center justify-between ${isSelected ? "pl-2" : ""}`}>
                        <span className={`text-[11px] font-semibold uppercase tracking-wider ${isSelected ? "text-[#8b5cf6]" : "text-[#94a3b8]"}`}>
                          Entry #{entry._entryNumber}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium text-[#64748b]">{entry._dateLabel}</span>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); handleDeleteEntry(entry.id); }}
                            className="rounded p-0.5 text-[#94a3b8] opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <h3 className={`mt-1 line-clamp-1 text-[15px] font-bold text-[#0f172a] ${isSelected ? "pl-2" : ""}`}>
                        {entry.title || "Untitled"}
                      </h3>
                      {snippet && (
                        <p className={`mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#64748b] ${isSelected ? "pl-2" : ""}`}>
                          {snippet}
                        </p>
                      )}
                      <div className={`mt-3 flex flex-wrap items-center gap-1.5 ${isSelected ? "pl-2" : ""}`}>
                        <span className="size-2 shrink-0 rounded-full" style={{ background: moodDotColors[entry.mood] || "#94a3b8" }} />
                        {(entry.tags || []).slice(0, 2).map((tag) => (
                          <span key={tag} className="rounded-xl border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 px-2 py-0.5 text-[11px] font-medium text-[#8b5cf6]">
                            #{tag}
                          </span>
                        ))}
                        <span className="ml-auto text-[11px] font-medium text-[#94a3b8]">{entry._wordCount}w</span>
                      </div>
                    </div>
                  );
                })}

                {!journalLoading && filteredEntries.length === 0 && journalEntries.length > 0 && (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#8b5cf6]/20 bg-white/50 py-12 text-[#94a3b8]">
                    <Search className="size-8 opacity-40" />
                    <p className="text-sm font-medium">No entries match &ldquo;{journalSearch}&rdquo;</p>
                  </div>
                )}

                {!journalLoading && journalEntries.length === 0 && (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#8b5cf6]/20 bg-white/50 py-14 text-[#94a3b8]">
                    <PenLine className="size-9 opacity-40" />
                    <p className="text-sm font-medium">No entries yet</p>
                    <p className="text-center text-xs opacity-70">Click &ldquo;New Entry&rdquo; to write your first page!</p>
                  </div>
                )}
              </div>
            </aside>

            {/* ─── RIGHT: Writing canvas ─── */}
            <section className="w-full flex-1 rounded-2xl border border-[#8b5cf6]/25 bg-white/70 p-6 shadow-sm backdrop-blur-xl md:p-8">
              {/* Top meta bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#8b5cf6]/20 pb-5">
                <span className="rounded-xl border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 px-3 py-1 text-[11px] font-bold uppercase text-[#8b5cf6]">
                  {selectedEntryId ? `Entry #${entriesWithIndex.find((e) => e.id === selectedEntryId)?._entryNumber ?? "new"}` : "New Entry"}
                </span>
                <span className="text-[12px] font-medium text-[#94a3b8]">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </span>
              </div>

              {/* Title input */}
              <div className="pb-4 pt-5">
                <input
                  data-tour="tour-title"
                  type="text"
                  value={journalTitle}
                  onChange={(e) => setJournalTitle(e.target.value)}
                  placeholder="Title this page..."
                  className="w-full border-none bg-transparent p-0 text-[28px] font-bold leading-tight tracking-tight text-[#0f172a] placeholder:text-slate-200 focus:outline-none focus:ring-0 md:text-[32px]"
                />
              </div>

              {/* Body */}
              <div data-tour="tour-content" className="relative">
                <textarea
                  value={journalContent.replace(/<[^>]*>/g, "")}
                  onChange={(e) => setJournalContent(e.target.value)}
                  placeholder="Write about what you learned today..."
                  className="w-full resize-none border-none bg-transparent p-0 text-[15px] leading-relaxed text-[#334155] placeholder:text-slate-200 focus:outline-none focus:ring-0"
                  style={{ minHeight: "320px" }}
                />
              </div>

              {/* Tags & Mood */}
              <div data-tour="tour-mood-tags" className="mt-4 grid grid-cols-1 gap-6 border-t border-[#8b5cf6]/20 pt-5 md:grid-cols-2">
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">Categories &amp; Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {(journalTags || "").split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 rounded-xl border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 px-3 py-1 text-xs font-semibold text-[#8b5cf6]"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() =>
                            setJournalTags(
                              (journalTags || "").split(",").map((t) => t.trim()).filter((t) => t && t !== tag).join(", ")
                            )
                          }
                          className="ml-0.5 text-sm leading-none text-[#8b5cf6]/50 hover:text-[#8b5cf6]"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      placeholder="+ Add Tag"
                      className="w-24 rounded-xl border-2 border-dotted border-[#94a3b8]/40 bg-transparent px-3 py-1 text-xs font-bold text-[#94a3b8] transition focus:border-[#8b5cf6] focus:text-[#8b5cf6] focus:outline-none focus:ring-0"
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === ",") && e.currentTarget.value.trim()) {
                          e.preventDefault();
                          const newTag = e.currentTarget.value.trim().replace(/,$/, "");
                          const existing = (journalTags || "").split(",").map((t) => t.trim()).filter(Boolean);
                          if (newTag && !existing.includes(newTag)) {
                            setJournalTags([...existing, newTag].join(", "));
                          }
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">Current Mood</label>
                  <div className="flex gap-2">
                    {moodOptions.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setJournalMood(m)}
                        title={m}
                        className={`flex size-11 items-center justify-center rounded-xl border text-2xl transition-all ${
                          journalMood === m
                            ? "scale-110 border-[#8b5cf6] bg-[#f5f3ff] shadow-[0_0_0_2px_rgba(139,92,246,0.25)]"
                            : "border-transparent bg-[#f8fafc] grayscale hover:grayscale-0"
                        }`}
                      >
                        {moodEmojis[m]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Save bar */}
              <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#8b5cf6]/20 pt-5">
                <span className="text-[11px] font-semibold text-[#94a3b8]">
                  {autosaveLabel === "Saved" ? "✓ All changes saved" : autosaveLabel.includes("Saving") ? "Saving…" : "Unsaved changes"}
                </span>
                <button
                  data-tour="tour-save"
                  onClick={handleSaveDraft}
                  className="flex items-center gap-2 rounded-xl bg-[#8b5cf6] px-5 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-[#8b5cf6]/30 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-purple-600"
                >
                  <Save className="size-4" />
                  Save Entry
                </button>
              </div>
            </section>
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
                  <div className="absolute rounded-lg ring-4 ring-[#8b5cf6]/60 shadow-lg shadow-[#8b5cf6]/30"
                    style={{ top: relTop - 4, left: relLeft - 4, width: rect.width + 8, height: rect.height + 8, backgroundColor: "rgba(255,255,255,0.15)", pointerEvents: "none" }} />
                )}
                <div
                  className={`absolute flex flex-col rounded-xl border bg-white p-5 shadow-2xl ${isCentered ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" : ""}`}
                  style={{
                    borderColor: "#ede9fe",
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
                        <div key={i} className={`h-2 rounded-full transition-all ${i === tourStep ? "w-5 bg-[#8b5cf6]" : i < tourStep ? "w-2 bg-[#c4b5fd]" : "w-2 bg-gray-200"}`} />
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
                          style={{ backgroundColor: "#8b5cf6" }}>
                          Next <ChevronRight className="h-3 w-3" />
                        </button>
                      ) : (
                        <button onClick={tourFinish} className="flex items-center gap-1 rounded-lg px-4 py-1.5 text-xs font-medium text-white shadow transition hover:brightness-110"
                          style={{ backgroundColor: "#8b5cf6" }}>
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

      {/* ═══════════════ NON-JOURNAL VIEW — REDESIGNED ═══════════════ */}
      {assignmentType !== "journal" && (
        <>
          {/* ─── Floating Card with Centered Header & Tabs ─── */}
          <div className="bg-white rounded-3xl border border-purple-200 shadow-lg p-6 md:p-8">
            {/* Centered Header */}
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tight">
                Assignments
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage your assignments and submissions
              </p>
            </div>

            {/* Tab Bar */}
            <div className="flex flex-wrap justify-center gap-3 mt-6 pt-6 border-t border-slate-100">
              {typeTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setAssignmentType(t.key)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all border-2 ${
                    assignmentType === t.key
                      ? 'border-purple-600 bg-purple-50 text-purple-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300 hover:text-purple-600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <t.icon className="h-4 w-4" />
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ─── Assignment Content ─── */}
          <div className="mt-6">
            <Assignment assignmentType={assignmentType} filter={filter} setFilter={setFilter} />
          </div>
        </>
      )}
    </div>
  );
});

AssignmentView.displayName = 'AssignmentView';

export default AssignmentView;