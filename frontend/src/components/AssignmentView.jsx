import React, { useEffect, useState, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Trash2, BookOpen, FlaskConical, Layers, PenLine, GraduationCap,
  ArrowLeft, ChevronRight, Clock, Search, CheckCircle2, X, Maximize2, Minimize2,
} from "lucide-react";
import PointsBadge from "./PointsBadge";
import MoodIcon from "./MoodIcon";
import { MOOD_GROUPS, MOOD_OPTIONS, MOOD_EMOJIS } from "../utils/moods";
import Assignment from "./Assignment";
import { fetchCachedJson, clearStudentApiCacheByUrl } from "../utils/studentApiCache";

/* Glass primitives shared across the non-journal views — matches the Exams page
   and the Journal folio: frosted white, soft purple border, blur + saturate. */
const SURFACE_CARD = 'rounded-3xl border border-[rgba(139,92,246,0.35)] bg-white/60 backdrop-blur-[20px] backdrop-saturate-[180%] shadow-[0_4px_24px_rgba(15,23,42,0.05)]';
const SURFACE_INNER = 'rounded-xl border border-[rgba(139,92,246,0.2)] bg-white/50 backdrop-blur-sm';

const AssignmentView = forwardRef(({ defaultType = "school" }, ref) => {
  const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
  const JOURNAL_ENDPOINT = `${API_BASE}/api/student/auth/journal`;
  const JOURNAL_CACHE_TTL_MS = 2 * 60 * 1000;
  const navigate = useNavigate();
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
  const [journalSession, setJournalSession] = useState(null); // { name, startDate, endDate } of the active school year
  const [openMonths, setOpenMonths] = useState({}); // "YYYY-MM" -> open?
  const [moodPickerOpen, setMoodPickerOpen] = useState(false);
  // Full-screen diary (browser Fullscreen API on the diary card).
  const diaryRef = useRef(null);
  const [diaryFullscreen, setDiaryFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setDiaryFullscreen(Boolean(document.fullscreenElement) && document.fullscreenElement === diaryRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleDiaryFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await diaryRef.current?.requestFullscreen?.();
    } catch { /* browser refused — nothing to do */ }
  };
  const [diarySearchOpen, setDiarySearchOpen] = useState(false);
  const diarySearchRef = useRef(null);
  useEffect(() => { if (diarySearchOpen) diarySearchRef.current?.focus(); }, [diarySearchOpen]);
  const closeDiarySearch = () => { setDiarySearchOpen(false); setJournalSearch(""); };

  useEffect(() => { setAssignmentType(defaultType); }, [defaultType]);
  useEffect(() => { if (assignmentType === "journal") loadJournalEntries(); }, [assignmentType]);

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
      setJournalSession(payload?.session || null);
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
    if (!journalTitle.trim() && !journalContent.trim()) { setAutosaveLabel("Nothing to save"); return; }
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
  const pendingSaveRef = useRef(false);
  const latestSaveRef = useRef(handleSaveDraft);
  latestSaveRef.current = handleSaveDraft;
  useEffect(() => {
    if (assignmentType !== "journal") return;
    if (skipAutosaveRef.current) { skipAutosaveRef.current = false; return; }
    if (!journalTitle.trim() && !journalContent.trim()) { setAutosaveLabel("Saved"); return; }
    setAutosaveLabel("Saving\u2026");
    pendingSaveRef.current = true;
    const t = setTimeout(() => { pendingSaveRef.current = false; handleSaveDraft(); }, 1200);
    return () => clearTimeout(t);
  }, [journalTitle, journalContent, journalTags, journalMood, assignmentType]);

  /* No manual save button \u2014 so flush a pending autosave when the student leaves the page. */
  useEffect(() => () => {
    if (pendingSaveRef.current) { pendingSaveRef.current = false; latestSaveRef.current(); }
  }, []);

  /* ─── Type tabs config ─── */
  const typeTabs = [
    { key: "school", label: "School", icon: BookOpen },
    { key: "eec", label: "Practice", icon: GraduationCap },
    { key: "lab", label: "Lab", icon: FlaskConical },
    { key: "flashcard", label: "FlashCard", icon: Layers },
  ];

  // Mood list shared with the teacher Health & Wellbeing page.
  const moodOptions = MOOD_OPTIONS;
  const moodEmojis = MOOD_EMOJIS;

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
    <div className={assignmentType === "journal" ? "w-full h-full overflow-hidden" : "w-full min-h-screen md:px-4 py-5 pb-24 md:pb-6 overflow-x-hidden"}>

      {/* ═══════════════ JOURNAL — DIARY (edge to edge) ═══════════════ */}
      {assignmentType === "journal" && (() => {
        const moodOf = (m) => moodEmojis[m] || moodEmojis.Neutral;
        const selected = entriesWithIndex.find((e) => e.id === selectedEntryId) || null;
        const pageDate = new Date(selected?.createdAt || Date.now());
        const pageDateLabel = pageDate.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        const wordCount = (journalContent || "").replace(/<[^>]*>/g, "").trim().split(/\s+/).filter(Boolean).length;
        // Diary index: every month of the school session (start → this month), newest first.
        // Inside a month only the days the student actually wrote on are listed.
        const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const dayKey = (d) => `${monthKey(d)}-${String(d.getDate()).padStart(2, "0")}`;
        const today = new Date();
        const entryDate = (e) => new Date(e.createdAt || e.updatedAt);
        const datedEntries = filteredEntries.map((entry) => ({ entry, d: entryDate(entry) })).filter(({ d }) => !Number.isNaN(d.getTime()));
        const sessionStart = journalSession?.startDate ? new Date(journalSession.startDate) : null;
        const earliestEntry = datedEntries.reduce((min, { d }) => (!min || d < min ? d : min), null);
        const rangeStart = sessionStart && !Number.isNaN(sessionStart.getTime()) ? sessionStart : (earliestEntry || today);
        const monthKeys = [];
        for (let c = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1); c <= today; c = new Date(c.getFullYear(), c.getMonth() + 1, 1)) {
          monthKeys.push(monthKey(c));
        }
        // pages written outside the session (e.g. last year) still get their month
        datedEntries.forEach(({ d }) => { if (!monthKeys.includes(monthKey(d))) monthKeys.push(monthKey(d)); });
        monthKeys.sort().reverse();
        const months = monthKeys.map((key) => {
          const [y, m] = key.split("-").map(Number);
          const items = datedEntries.filter(({ d }) => monthKey(d) === key).sort((x, z) => z.d - x.d);
          const days = [];
          items.forEach((it) => {
            const k = dayKey(it.d);
            let day = days.find((x) => x.key === k);
            if (!day) { day = { key: k, d: it.d, entries: [] }; days.push(day); }
            day.entries.push(it.entry);
          });
          return { key, label: new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }), days, count: items.length };
        });
        const searching = Boolean(journalSearch.trim());
        const visibleMonths = searching ? months.filter((mo) => mo.count > 0) : months;
        const selectedMonth = selected ? monthKey(entryDate(selected)) : null;
        const isMonthOpen = (key) => (searching ? true : openMonths[key] ?? (key === (selectedMonth || monthKey(today))));
        const toggleMonth = (key) => setOpenMonths((prev) => ({ ...prev, [key]: !isMonthOpen(key) }));
        const startNewPage = () => { resetJournalForm(); setShowMobileIndex(false); };
        const LINE = 32; // px — ruled-paper line height; text uses the same line height
        // Grow the writing area with its text (wrapped lines too), snapped to whole rules.
        const growToRules = (el) => {
          if (!el) return;
          el.style.height = "auto";
          el.style.height = `${Math.max(14, Math.ceil(el.scrollHeight / LINE) + 1) * LINE}px`;
        };

        return (
          // Same frame as Materials / Practice: lines up with the floating top bar and the sidebar.
          <div ref={diaryRef} className={`flex min-h-0 flex-col overflow-hidden bg-white text-[#0f172a] ${diaryFullscreen ? "h-full w-full" : "m-3 h-[calc(100%-1.5rem)] rounded-2xl border border-slate-200/80 shadow-sm sm:rounded-3xl"}`}>
            {/* ── Top bar ── */}
            <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => {
                  if (window.history.state?.idx > 0) navigate(-1);
                  else navigate("/student", { replace: true });
                }}
                className="hidden shrink-0 items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 shadow-sm hover:bg-violet-50 md:max-[1025px]:portrait:inline-flex"
              >
                <ArrowLeft size={15} aria-hidden="true" /> Back
              </button>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#8b5cf6] text-white shadow-sm">
                <BookOpen className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold leading-tight">My Diary</h1>
                <p className="truncate text-xs text-slate-500">Write a page about your day — what you learned, how you felt.</p>
              </div>
              <span
                className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex ${
                  autosaveLabel === "Saved" ? "bg-emerald-600 text-white" : autosaveLabel.includes("Saving") ? "bg-amber-500 text-white" : "bg-red-600 text-white"
                }`}
              >
                {autosaveLabel === "Saved" ? <CheckCircle2 className="size-3.5" /> : <Clock className="size-3.5" />}
                {autosaveLabel === "Saved" ? "Saved" : autosaveLabel}
              </span>
              <button
                type="button"
                onClick={startNewPage}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#8b5cf6] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-600"
              >
                <Plus className="size-4" /> New page
              </button>
              <button
                type="button"
                onClick={toggleDiaryFullscreen}
                aria-label={diaryFullscreen ? "Exit full screen" : "Full screen"}
                title={diaryFullscreen ? "Exit full screen (Esc)" : "Full screen"}
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              >
                {diaryFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
            </header>

            <div className="flex min-h-0 flex-1">
              {/* ── Left: diary index ── */}
              <aside className={`${showMobileIndex ? "flex" : "hidden"} w-full shrink-0 flex-col border-r border-slate-200 bg-[#faf9ff] lg:flex lg:w-80`}>
                {/* pages count + search icon; the search box slides open in its place */}
                <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 px-3">
                  <p className={`min-w-0 shrink-0 overflow-hidden whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 transition-all duration-300 ease-out ${diarySearchOpen ? "max-w-0 opacity-0" : "max-w-[12rem] opacity-100"}`}>
                    {journalEntries.length} page{journalEntries.length === 1 ? "" : "s"} written
                  </p>
                  <label aria-hidden={!diarySearchOpen} className={`relative ml-auto block overflow-hidden p-0.5 transition-all duration-300 ease-out ${diarySearchOpen ? "w-full opacity-100" : "w-0 opacity-0"}`}>
                    <span className="sr-only">Search my diary</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={diarySearchRef}
                      tabIndex={diarySearchOpen ? 0 : -1}
                      value={journalSearch}
                      onChange={(e) => setJournalSearch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Escape") closeDiarySearch(); }}
                      placeholder="Search my diary…"
                      className="w-full rounded-full border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm focus:border-[#8b5cf6] focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => (diarySearchOpen ? closeDiarySearch() : setDiarySearchOpen(true))}
                    aria-label={diarySearchOpen ? "Close search" : "Search my diary"}
                    title={diarySearchOpen ? "Close search" : "Search"}
                    className={`${diarySearchOpen ? "" : "ml-auto"} flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900`}
                  >
                    <span key={diarySearchOpen ? "x" : "s"} className="flex animate-[diary-icon-in_200ms_ease-out]">
                      {diarySearchOpen ? <X className="size-4" /> : <Search className="size-4" />}
                    </span>
                  </button>
                  <style>{"@keyframes diary-icon-in{from{transform:rotate(-90deg) scale(.6);opacity:0}to{transform:none;opacity:1}}"}</style>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                  {journalLoading && journalEntries.length === 0 && (
                    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
                      <div className="size-5 animate-spin rounded-full border-2 border-[#ede9fe] border-t-[#8b5cf6]" /> Loading pages…
                    </div>
                  )}
                  {!journalLoading && journalEntries.length === 0 && !journalSession && (
                    <div className="px-6 py-12 text-center">
                      <PenLine className="mx-auto size-8 text-[#c4b5fd]" />
                      <p className="mt-2 text-sm font-semibold text-slate-700">Your diary is empty</p>
                      <p className="mt-1 text-xs text-slate-500">Tap <b>New page</b> and write your first page.</p>
                    </div>
                  )}
                  {!journalLoading && journalEntries.length > 0 && filteredEntries.length === 0 && (
                    <p className="px-6 py-12 text-center text-sm text-slate-500">No pages match “{journalSearch}”.</p>
                  )}
                  {(journalEntries.length > 0 || journalSession) && visibleMonths.map((mo) => {
                    const open = isMonthOpen(mo.key);
                    return (
                      <section key={mo.key} className="border-b border-slate-200">
                        <button
                          type="button"
                          onClick={() => toggleMonth(mo.key)}
                          aria-expanded={open}
                          className={`sticky top-0 z-10 flex w-full items-center gap-2 px-4 py-2.5 text-left transition ${open ? "bg-[#f3f0ff]" : "bg-[#faf9ff] hover:bg-[#f3f0ff]"}`}
                        >
                          <span className={`text-sm font-bold ${open ? "text-[#6d28d9]" : "text-slate-700"}`}>{mo.label}</span>
                          <span className={`ml-auto rounded-full px-2 py-px text-[11px] font-semibold ${mo.count ? "bg-[#7c3aed] text-white ring-1 ring-[#ddd6fe]" : "text-slate-400"}`}>
                            {mo.count ? `${mo.count} page${mo.count === 1 ? "" : "s"}` : "No pages"}
                          </span>
                          <ChevronRight className={`size-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} />
                        </button>
                        {open && (
                          mo.days.length === 0 ? (
                            <p className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-400">You didn’t write any pages this month.</p>
                          ) : (
                            <ul className="divide-y divide-slate-200 border-t border-slate-200 bg-white">
                              {/* One row per page, each with its own day card (5 pages on the 19th → five "19 SAT" cards). */}
                              {mo.days.flatMap((day) => day.entries.map((entry) => {
                                const active = selectedEntryId === entry.id;
                                const d = entryDate(entry);
                                return (
                                  <li key={entry.id} className={`group relative transition ${active ? "bg-[#f3f0ff]" : "hover:bg-slate-50"}`}>
                                    {active && <span className="absolute inset-y-0 left-0 w-1 bg-[#8b5cf6]" />}
                                    <button type="button" onClick={() => loadEntry(entry)} className="flex w-full items-center gap-3 px-3 py-2 pr-9 text-left">
                                      <span className={`flex w-11 shrink-0 flex-col items-center rounded-lg border py-1 ${active ? "border-[#8b5cf6] bg-[#8b5cf6] text-white" : "border-slate-200 bg-white text-slate-700"}`}>
                                        <span className="text-lg font-bold leading-none">{d.getDate()}</span>
                                        <span className={`mt-0.5 text-[9px] font-semibold uppercase ${active ? "text-white/80" : "text-slate-400"}`}>{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                                      </span>
                                      <MoodIcon emoji={moodOf(entry.mood)} label={entry.mood} size={18} />
                                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{entry.title || "Untitled page"}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { if (window.confirm("Delete this diary page?")) handleDeleteEntry(entry.id); }}
                                      aria-label={`Delete ${entry.title || "page"}`}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </li>
                                );
                              }))}
                            </ul>
                          )
                        )}
                      </section>
                    );
                  })}
                </div>
              </aside>

              {/* ── Right: the diary page ── */}
              <section className={`${showMobileIndex ? "hidden" : "flex"} min-w-0 flex-1 flex-col lg:flex`}>
                {/* page header: date + mood (kept off the paper so the paper stays clean) */}
                <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setShowMobileIndex(true)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 lg:hidden">
                      <ChevronRight className="size-3.5 rotate-180" /> All pages
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">{selected ? `Page ${selected._entryNumber}` : "New page"}</p>
                      <p className="truncate font-serif text-lg font-semibold text-slate-900">{pageDateLabel}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{wordCount} word{wordCount === 1 ? "" : "s"}</span>
                  </div>
                  <div className="relative mt-2.5 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">Today I feel:</span>
                    <button
                      type="button"
                      onClick={() => setMoodPickerOpen((v) => !v)}
                      aria-expanded={moodPickerOpen}
                      aria-haspopup="dialog"
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${moodPickerOpen ? "border-[#8b5cf6] bg-[#f5f3ff] text-[#6d28d9]" : "border-slate-200 bg-white text-slate-700 hover:border-[#c4b5fd]"}`}
                    >
                      <MoodIcon emoji={moodEmojis[journalMood] || moodEmojis.Neutral} label={journalMood} size={18} /> {journalMood}
                      <ChevronRight className={`size-3.5 transition-transform ${moodPickerOpen ? "-rotate-90" : "rotate-90"}`} />
                    </button>
                    {moodPickerOpen && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setMoodPickerOpen(false)} aria-hidden="true" />
                        <div role="dialog" aria-label="Choose how you feel" className="absolute left-0 top-full z-30 mt-2 w-[min(28rem,calc(100vw-3rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                          {MOOD_GROUPS.map((g) => (
                            <div key={g.label} className="mb-2 last:mb-0">
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{g.label}</p>
                              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                                {g.moods.map(([m, emoji]) => (
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() => { setJournalMood(m); setMoodPickerOpen(false); }}
                                    aria-pressed={journalMood === m}
                                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                                      journalMood === m ? "border-[#8b5cf6] bg-[#f5f3ff] text-[#6d28d9] ring-1 ring-[#8b5cf6]/30" : "border-slate-200 bg-white text-slate-700 hover:border-[#c4b5fd] hover:bg-[#faf9ff]"
                                    }`}
                                  >
                                    <MoodIcon emoji={emoji} label={m} size={20} /> {m}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* ruled paper: white sheet, dark rules, red double margin line.
                    Every line of text is exactly one rule high, so writing sits on the lines. */}
                <div className="min-h-0 flex-1 overflow-y-auto bg-white custom-scrollbar">
                  <div
                    className="relative min-h-full pb-8 pr-6 sm:pr-10"
                    style={{
                      paddingTop: LINE,
                      paddingLeft: 76,
                      backgroundColor: "#ffffff",
                      backgroundImage: [
                        // red double margin line
                        "linear-gradient(to right, transparent 56px, #ef4444 56px, #ef4444 57.5px, transparent 57.5px, transparent 60px, #ef4444 60px, #ef4444 61.5px, transparent 61.5px)",
                        // dark ruled lines, one per LINE
                        `repeating-linear-gradient(to bottom, transparent 0, transparent ${LINE - 1}px, rgba(15,23,42,0.28) ${LINE - 1}px, rgba(15,23,42,0.28) ${LINE}px)`,
                      ].join(", "),
                    }}
                  >
                    {/* title — one ruled line */}
                    <input
                      type="text"
                      value={journalTitle}
                      onChange={(e) => setJournalTitle(e.target.value)}
                      placeholder="Title of today's page…"
                      aria-label="Page title"
                      className="block w-full border-none bg-transparent p-0 font-serif text-[22px] font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-0"
                      style={{ height: LINE, lineHeight: `${LINE}px` }}
                    />

                    {/* writing — every row sits on a rule */}
                    <textarea
                      value={journalContent.replace(/<[^>]*>/g, "")}
                      onChange={(e) => setJournalContent(e.target.value)}
                      placeholder={"Dear Diary,\nToday I learned…"}
                      aria-label="Write your diary page"
                      className="block w-full resize-none overflow-hidden border-none bg-transparent p-0 font-serif text-[17px] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-0"
                      style={{ lineHeight: `${LINE}px`, minHeight: LINE * 14 }}
                      ref={growToRules}
                      onInput={(e) => growToRules(e.currentTarget)}
                    />
                  </div>
                </div>

                {/* footer: save status */}
                <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-4 py-2.5 sm:px-8">
                  <span className="ml-auto text-xs text-slate-500">
                    {autosaveLabel === "Saved" ? "✓ Saves by itself as you write" : autosaveLabel.includes("Saving") ? "Saving…" : autosaveLabel}
                  </span>
                  {selected && (
                    <button
                      type="button"
                      onClick={() => { if (window.confirm("Delete this diary page?")) handleDeleteEntry(selected.id); }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" /> Delete page
                    </button>
                  )}
                </div>
              </section>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════ NON-JOURNAL VIEW ═══════════════ */}
      {assignmentType !== "journal" && (
        <div className="relative mx-auto max-w-7xl">
          {/* Type switching lives in the sidebar now (Assignments / Practice / Lab / Flashcards). */}
          {false && (<>
          <div className={`page-fade-in ${SURFACE_CARD} flex flex-wrap items-center justify-between gap-4 p-4 sm:px-6`}>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#0f172a] sm:text-2xl">
                Assignments
              </h1>
              <p className="mt-0.5 text-xs text-[#64748b] sm:text-sm">
                Manage your assignments and submissions
              </p>
            </div>

            <div className={`flex items-center gap-1 rounded-xl ${SURFACE_INNER} p-1`}>
              {typeTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setAssignmentType(t.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200 ease-out sm:px-4 ${
                    assignmentType === t.key
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-[#64748b] hover:bg-white hover:text-violet-700'
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          </>)}
          {/* ─── Assignment Content ─── */}
          <div className="relative">
            <Assignment assignmentType={assignmentType} />
          </div>
        </div>
      )}
    </div>
  );
});

AssignmentView.displayName = 'AssignmentView';

export default AssignmentView;
