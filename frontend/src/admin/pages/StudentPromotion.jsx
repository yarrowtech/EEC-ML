import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Users,
  GraduationCap,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  LogOut,
  History,
  Play,
  Eye,
  X,
  Loader2,
  UserX,
  UserCheck,
  Zap,
  BookOpen,
  ArrowUpCircle,
  Sparkles,
  Award,
  Calendar,
  ClipboardList,
  CheckCircle2,
  Filter,
  TrendingUp,
} from "lucide-react";
import Swal from "sweetalert2";

const API_BASE = import.meta.env.VITE_API_URL;

const token = () => localStorage.getItem("token");

// All requests go through the patched window.fetch (ensureAdminFetchScope)
// which automatically injects x-school-id and x-campus-id.
const authHeader = () => ({
  "Content-Type": "application/json",
  authorization: `Bearer ${token()}`,
});

const formatDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "?";

// Static Tailwind class lookups (kept literal, not interpolated, so the
// build's class scanner can see them).
const MODE_STYLES = {
  bulk: {
    icon: Users,
    ring: "border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-100 shadow-sm",
    iconBg: "bg-gradient-to-br from-indigo-500 to-blue-500",
    badge: "bg-indigo-600",
  },
  manual: {
    icon: UserCheck,
    ring: "border-violet-500 bg-violet-50/70 ring-2 ring-violet-100 shadow-sm",
    iconBg: "bg-gradient-to-br from-violet-500 to-fuchsia-500",
    badge: "bg-violet-600",
  },
  marks: {
    icon: Award,
    ring: "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-100 shadow-sm",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500",
    badge: "bg-emerald-600",
  },
};

const MODE_CARDS = [
  { key: "bulk", label: "Bulk (Automatic)", desc: "Promote all students of a class at once" },
  { key: "manual", label: "Manual (Individual)", desc: "Select specific students to promote" },
  { key: "marks", label: "Marks Based", desc: "Promote only passing students and update roll by rank" },
];

const HISTORY_TYPE_STYLES = {
  bulk: "bg-indigo-100 text-indigo-700 border-indigo-200",
  marks: "bg-emerald-100 text-emerald-700 border-emerald-200",
  manual: "bg-orange-100 text-orange-700 border-orange-200",
};

// Reusable styled <select> with a leading icon + chevron, used across the
// promotion form and filters so every dropdown looks consistent.
const SelectField = ({ icon: Icon, className = "", ...props }) => (
  <div className="relative">
    {Icon && (
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
    )}
    <select
      {...props}
      className={`w-full border border-gray-200 rounded-xl ${Icon ? "pl-9" : "pl-3"} pr-8 py-2.5 text-sm appearance-none bg-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition disabled:bg-gray-50 disabled:text-gray-400 ${className}`}
    />
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
  </div>
);

// Reusable styled search input with a leading search icon.
const SearchField = ({ className = "", ...props }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
    <input
      type="text"
      {...props}
      className={`pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition ${className}`}
    />
  </div>
);

const LEAVE_TABLE_PAGE_SIZE = 10;

// Reusable pagination bar for the Leave Management tables.
const PaginationBar = ({ page, totalItems, pageSize, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  const maxVisible = 5;
  let pStart = Math.max(1, page - Math.floor(maxVisible / 2));
  let pEnd = Math.min(totalPages, pStart + maxVisible - 1);
  if (pEnd - pStart < maxVisible - 1) pStart = Math.max(1, pEnd - maxVisible + 1);
  const pages = [];
  for (let i = pStart; i <= pEnd; i++) pages.push(i);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-3">
      <span className="text-xs text-gray-500">
        Showing <strong className="text-gray-700">{start}</strong>–<strong className="text-gray-700">{end}</strong> of <strong className="text-gray-700">{totalItems}</strong>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pStart > 1 && <span className="px-1 text-gray-300 text-xs">…</span>}
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`h-8 min-w-8 px-2 rounded-lg text-xs font-semibold transition ${
              p === page
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-white border border-transparent hover:border-gray-200"
            }`}
          >
            {p}
          </button>
        ))}
        {pEnd < totalPages && <span className="px-1 text-gray-300 text-xs">…</span>}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────
const StudentPromotion = ({ setShowAdminHeader }) => {
  useEffect(() => {
    if (setShowAdminHeader) setShowAdminHeader(true);
  }, [setShowAdminHeader]);

  const [activeTab, setActiveTab] = useState("promotion");

  // ── shared data ──────────────────────────────────────────
  const [classes, setClasses] = useState([]);       // [{_id, name, order}]
  const [academicYears, setAcademicYears] = useState([]); // [{_id, name, isActive}]
  const [loadingMeta, setLoadingMeta] = useState(false);

  // ── promotion tab ─────────────────────────────────────────
  const [fromClassId, setFromClassId] = useState("");
  const [fromClassName, setFromClassName] = useState("");
  const [fromSection, setFromSection] = useState("");
  const [fromSections, setFromSections] = useState([]);
  const [fromAcademicYearId, setFromAcademicYearId] = useState("");
  const [fromAcademicYear, setFromAcademicYear] = useState("");

  const [toClassId, setToClassId] = useState("");
  const [toClassName, setToClassName] = useState("");
  const [toSection, setToSection] = useState("");
  const [toSections, setToSections] = useState([]);
  const [toAcademicYearId, setToAcademicYearId] = useState("");
  const [toAcademicYear, setToAcademicYear] = useState("");

  const [previewStudents, setPreviewStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const [promotionMode, setPromotionMode] = useState("bulk");
  const [minPromotionPercentage, setMinPromotionPercentage] = useState(50);
  const [promotionSearch, setPromotionSearch] = useState("");
  const [notes, setNotes] = useState("");

  const [promotionHistory, setPromotionHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // per-class student counts (computed from all students)
  const [studentCounts, setStudentCounts] = useState({});

  // ── leave tab ─────────────────────────────────────────────
  const [leavingStudents, setLeavingStudents] = useState([]);
  const [loadingLeaving, setLoadingLeaving] = useState(false);

  const [activeStudents, setActiveStudents] = useState([]);
  const [loadingActive, setLoadingActive] = useState(false);

  const [activeSearch, setActiveSearch] = useState("");
  const [leaveClassFilter, setLeaveClassFilter] = useState("");
  const [activePage, setActivePage] = useState(1);
  const [leavingPage, setLeavingPage] = useState(1);

  const [selectedForLeave, setSelectedForLeave] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leavingDate: "",
    reasonForLeaving: "",
    transferCertificateNo: "",
    transferCertificateDate: "",
    remarks: "",
  });
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [finalizingId, setFinalizingId] = useState(null);

  // ──────────────────────────────────────────────────────────
  // Fetch classes & academic years from existing academic API
  // ──────────────────────────────────────────────────────────
  const fetchMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [classRes, yearRes, studentRes] = await Promise.all([
        fetch(`${API_BASE}/api/academic/classes`, { headers: authHeader() }),
        fetch(`${API_BASE}/api/academic/years`, { headers: authHeader() }),
        fetch(`${API_BASE}/api/admin/users/get-students`, { headers: authHeader() }),
      ]);

      if (classRes.ok) {
        const data = await classRes.json();
        setClasses(Array.isArray(data) ? data : []);
      }
      if (yearRes.ok) {
        const data = await yearRes.json();
        const years = Array.isArray(data) ? data : [];
        setAcademicYears(years);
        // "To" defaults to the active session — that's genuinely the
        // destination of a promotion. "From" must NOT default to that
        // same active year: schools commonly create + activate the new
        // session first and only then run promotions, so defaulting
        // "From" to "active" would silently search for students who are
        // already in the year they're being promoted INTO, finding none.
        // Default "From" to the year immediately before the active one
        // (by start date) instead, and leave it blank if there isn't one.
        const sorted = [...years].sort(
          (a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0)
        );
        const active = years.find((y) => y.isActive);
        if (active) {
          setToAcademicYearId(active._id);
          setToAcademicYear(active.name);

          const activeIdx = sorted.findIndex((y) => String(y._id) === String(active._id));
          const previous = activeIdx > 0 ? sorted[activeIdx - 1] : null;
          if (previous) {
            setFromAcademicYearId(previous._id);
            setFromAcademicYear(previous.name);
          }
        }
      }
      if (studentRes.ok) {
        const data = await studentRes.json();
        const students = Array.isArray(data) ? data : [];
        // Build per-class count map
        const counts = {};
        for (const s of students) {
          const g = String(s.grade || "").trim();
          if (!g) continue;
          counts[g] = (counts[g] || 0) + 1;
        }
        setStudentCounts(counts);
      }
    } catch (err) {
      console.error("Failed to load metadata", err);
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  // ──────────────────────────────────────────────────────────
  // Fetch sections for a class using classId (from academic API)
  // /api/academic/sections?classId=<id>
  // ──────────────────────────────────────────────────────────
  const fetchSections = useCallback(async (classId, setter) => {
    setter([]);
    if (!classId) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/academic/sections?classId=${classId}`,
        { headers: authHeader() }
      );
      if (res.ok) {
        const data = await res.json();
        setter(Array.isArray(data) ? data : []);
      }
    } catch {
      setter([]);
    }
  }, []);

  useEffect(() => {
    fetchSections(fromClassId, setFromSections);
    setFromSection("");
  }, [fromClassId, fetchSections]);

  useEffect(() => {
    fetchSections(toClassId, setToSections);
    setToSection("");
  }, [toClassId, fetchSections]);

  // ──────────────────────────────────────────────────────────
  // Class select handler
  // ──────────────────────────────────────────────────────────
  const handleFromClassChange = (e) => {
    const selectedId = e.target.value;
    const cls = classes.find((c) => c._id === selectedId);
    setFromClassId(selectedId);
    setFromClassName(cls ? cls.name : "");
    setFromSection("");
    setPreviewStudents([]);
    setSelectedStudentIds([]);
  };

  const handleFromAcademicYearChange = (e) => {
    const selectedId = e.target.value;
    const selectedYear = academicYears.find((y) => String(y._id) === String(selectedId));
    setFromAcademicYearId(selectedId);
    setFromAcademicYear(selectedYear?.name || "");
    setFromClassId("");
    setFromClassName("");
    setFromSections([]);
    setFromSection("");
    setPreviewStudents([]);
    setSelectedStudentIds([]);
  };

  const handleToClassChange = (e) => {
    const selectedId = e.target.value;
    const cls = classes.find((c) => c._id === selectedId);
    setToClassId(selectedId);
    setToClassName(cls ? cls.name : "");
    setToSection("");
  };

  const handleToAcademicYearChange = (e) => {
    const selectedId = e.target.value;
    const selectedYear = academicYears.find((y) => String(y._id) === String(selectedId));
    setToAcademicYearId(selectedId);
    setToAcademicYear(selectedYear?.name || "");
    setToClassId("");
    setToClassName("");
    setToSections([]);
    setToSection("");
  };

  // ──────────────────────────────────────────────────────────
  // Preview students
  // ──────────────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!fromClassName) {
      Swal.fire({ icon: "warning", title: "Select Source Class", text: "Please select the class to promote from.", confirmButtonColor: "#6366f1" });
      return;
    }
    setLoadingPreview(true);
    setPreviewStudents([]);
    setSelectedStudentIds([]);
    try {
      const body = { fromClass: fromClassName };
      if (fromSection) body.fromSection = fromSection;
      if (fromAcademicYear) body.fromAcademicYear = fromAcademicYear;

      const endpoint =
        promotionMode === "marks"
          ? `${API_BASE}/api/promotion/preview-marks`
          : `${API_BASE}/api/promotion/preview`;
      if (promotionMode === "marks") {
        body.minPercentage = Number(minPromotionPercentage || 50);
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const students = (data.students || []).filter(
          (s) => !["Leaving", "Left"].includes(String(s?.status || ""))
        );
        setPreviewStudents(students);
        if (students.length > 0 && data.academicYearRelaxed) {
          Swal.fire({
            toast: true,
            position: "top-end",
            icon: "info",
            title: `No students matched session "${fromAcademicYear}" — showing all students in ${fromClassName}${fromSection ? " – " + fromSection : ""} instead.`,
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true,
          });
        }
        if (students.length === 0) {
          Swal.fire({
            icon: "info",
            title: "No Students Found",
            text: `No eligible students found in ${fromClassName}${fromSection ? " – " + fromSection : ""}${fromAcademicYear ? " (" + fromAcademicYear + ")" : ""}.`,
            confirmButtonColor: "#6366f1",
          });
        } else if (promotionMode === "bulk") {
          setSelectedStudentIds(students.map((s) => s._id));
        } else if (promotionMode === "marks") {
          const eligibleIds = Array.isArray(data.eligibleIds) ? data.eligibleIds : [];
          setSelectedStudentIds(eligibleIds);
          if (eligibleIds.length === 0) {
            Swal.fire({
              icon: "info",
              title: "No Eligible Students",
              text: `No students meet the pass criteria (${minPromotionPercentage}%).`,
              confirmButtonColor: "#6366f1",
            });
          }
        }
      } else {
        Swal.fire({ icon: "error", title: "Error", text: data.error || "Failed to load students.", confirmButtonColor: "#6366f1" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Network Error", text: "Could not reach server.", confirmButtonColor: "#6366f1" });
    } finally {
      setLoadingPreview(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // Execute promotion
  // ──────────────────────────────────────────────────────────
  const handlePromote = async () => {
    if (!toClassName) {
      Swal.fire({ icon: "warning", title: "Select Target Class", text: "Please select the class to promote to.", confirmButtonColor: "#6366f1" });
      return;
    }
    if (selectedStudentIds.length === 0) {
      Swal.fire({ icon: "warning", title: "No Students Selected", text: "Please preview and select students first.", confirmButtonColor: "#6366f1" });
      return;
    }
    const targetYearName =
      academicYears.find((y) => String(y._id) === String(toAcademicYearId))?.name ||
      toAcademicYear ||
      "";
    if (!targetYearName) {
      Swal.fire({ icon: "warning", title: "Select Target Academic Year", text: "Please select target academic year.", confirmButtonColor: "#6366f1" });
      return;
    }

    const confirm = await Swal.fire({
      icon: "question",
      title: "Confirm Promotion",
      html: `Promote <strong>${selectedStudentIds.length}</strong> student(s)<br/>
             From: <strong>${fromClassName}${fromSection ? " – " + fromSection : ""}</strong><br/>
             To: <strong>${toClassName}${toSection ? " – " + toSection : ""}</strong>
             ${targetYearName ? `<br/>Academic Year: <strong>${targetYearName}</strong>` : ""}
             ${promotionMode === "marks" ? `<br/>Pass Criteria: <strong>${minPromotionPercentage}% and above</strong><br/>Roll numbers will be reassigned by marks rank.` : ""}`,
      showCancelButton: true,
      confirmButtonText: "Yes, Promote",
      confirmButtonColor: "#6366f1",
      cancelButtonColor: "#6b7280",
    });
    if (!confirm.isConfirmed) return;

    setPromoting(true);
    try {
      const res = await fetch(`${API_BASE}/api/promotion/execute`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          studentIds: selectedStudentIds,
          toClass: toClassName,
          toSection: toSection || undefined,
          toAcademicYear: targetYearName || undefined,
          fromClass: fromClassName,
          fromSection: fromSection || undefined,
          fromAcademicYear: fromAcademicYear || undefined,
          type: promotionMode,
          marksConfig:
            promotionMode === "marks"
              ? { minPercentage: Number(minPromotionPercentage || 50) }
              : undefined,
          notes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire({ icon: "success", title: "Promoted!", text: data.message, confirmButtonColor: "#6366f1" });
        // Reset form
        setPreviewStudents([]);
        setSelectedStudentIds([]);
        setFromClassId("");
        setFromClassName("");
        setFromSection("");
        setToClassId("");
        setToClassName("");
        setToSection("");
        setMinPromotionPercentage(50);
        setNotes("");
        fetchMeta();
        if (showHistory) fetchHistory();
      } else {
        Swal.fire({ icon: "error", title: "Error", text: data.error || "Promotion failed.", confirmButtonColor: "#6366f1" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Network Error", text: "Could not reach server.", confirmButtonColor: "#6366f1" });
    } finally {
      setPromoting(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // Promotion history
  // ──────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/api/promotion/history`, { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        setPromotionHistory(data.history || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const toggleHistory = () => {
    setShowHistory((v) => {
      const next = !v;
      if (next) fetchHistory();
      return next;
    });
  };

  // ──────────────────────────────────────────────────────────
  // Leave tab – fetch leaving + active students
  // ──────────────────────────────────────────────────────────
  const fetchLeavingStudents = useCallback(async () => {
    setLoadingLeaving(true);
    try {
      const params = new URLSearchParams();
      if (leaveClassFilter) params.set("classFilter", leaveClassFilter);
      const res = await fetch(
        `${API_BASE}/api/promotion/leaving-students?${params.toString()}`,
        { headers: authHeader() }
      );
      if (res.ok) {
        const data = await res.json();
        setLeavingStudents(data.students || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingLeaving(false);
    }
  }, [leaveClassFilter]);

  const fetchActiveStudents = useCallback(async () => {
    setLoadingActive(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/get-students`, {
        headers: authHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        const list = (Array.isArray(data) ? data : []).filter(
          (s) => !["Leaving", "Left"].includes(s.status)
        );
        setActiveStudents(list);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingActive(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "leave") {
      fetchLeavingStudents();
      fetchActiveStudents();
    }
  }, [activeTab, fetchLeavingStudents, fetchActiveStudents]);

  // Re-fetch leaving list when class filter changes
  useEffect(() => {
    if (activeTab === "leave") {
      fetchLeavingStudents();
    }
  }, [leaveClassFilter, activeTab, fetchLeavingStudents]);

  // Reset to page 1 whenever the underlying filtered list changes
  useEffect(() => {
    setActivePage(1);
  }, [leaveClassFilter, activeSearch]);

  useEffect(() => {
    setLeavingPage(1);
  }, [leaveClassFilter]);

  // ──────────────────────────────────────────────────────────
  // Mark as Leaving
  // ──────────────────────────────────────────────────────────
  const handleMarkLeaving = () => {
    if (selectedForLeave.length === 0) {
      Swal.fire({ icon: "warning", title: "No Students Selected", text: "Please select at least one student.", confirmButtonColor: "#6366f1" });
      return;
    }
    setLeaveForm({ leavingDate: "", reasonForLeaving: "", transferCertificateNo: "", transferCertificateDate: "", remarks: "" });
    setShowLeaveModal(true);
  };

  const submitLeaveForm = async () => {
    if (!leaveForm.reasonForLeaving) {
      Swal.fire({ icon: "warning", title: "Reason Required", text: "Please select a reason for leaving.", confirmButtonColor: "#6366f1" });
      return;
    }
    setSubmittingLeave(true);
    try {
      const res = await fetch(`${API_BASE}/api/promotion/mark-leaving`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ studentIds: selectedForLeave, ...leaveForm }),
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire({ icon: "success", title: "Marked as Leaving", text: data.message, confirmButtonColor: "#6366f1" });
        setShowLeaveModal(false);
        setSelectedForLeave([]);
        setLeaveForm({ leavingDate: "", reasonForLeaving: "", transferCertificateNo: "", transferCertificateDate: "", remarks: "" });
        fetchLeavingStudents();
        fetchActiveStudents();
        fetchMeta(); // refresh counts
      } else {
        Swal.fire({ icon: "error", title: "Error", text: data.error || "Failed to mark students.", confirmButtonColor: "#6366f1" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Network Error", text: "Could not reach server.", confirmButtonColor: "#6366f1" });
    } finally {
      setSubmittingLeave(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // Restore student
  // ──────────────────────────────────────────────────────────
  const handleRestore = async (student) => {
    const confirm = await Swal.fire({
      icon: "question",
      title: "Restore Student",
      text: `Restore ${student.name} back to Active status?`,
      showCancelButton: true,
      confirmButtonText: "Yes, Restore",
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#6b7280",
    });
    if (!confirm.isConfirmed) return;

    setRestoringId(student._id);
    try {
      const res = await fetch(
        `${API_BASE}/api/promotion/restore-student/${student._id}`,
        { method: "PUT", headers: authHeader() }
      );
      const data = await res.json();
      if (res.ok) {
        Swal.fire({ icon: "success", title: "Restored", text: data.message, confirmButtonColor: "#6366f1" });
        fetchLeavingStudents();
        fetchActiveStudents();
        fetchMeta();
      } else {
        Swal.fire({ icon: "error", title: "Error", text: data.error || "Failed to restore.", confirmButtonColor: "#6366f1" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Network Error", text: "Could not reach server.", confirmButtonColor: "#6366f1" });
    } finally {
      setRestoringId(null);
    }
  };

  const handleMarkLeft = async (student) => {
    if (!student || student.status === "Left") return;
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Mark as Left",
      text: `Finalize ${student.name} as Left? This confirms the student has exited.`,
      showCancelButton: true,
      confirmButtonText: "Yes, Mark Left",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });
    if (!confirm.isConfirmed) return;

    setFinalizingId(student._id);
    try {
      const res = await fetch(
        `${API_BASE}/api/promotion/mark-left/${student._id}`,
        { method: "PUT", headers: authHeader() }
      );
      const data = await res.json();
      if (res.ok) {
        Swal.fire({ icon: "success", title: "Updated", text: data.message, confirmButtonColor: "#6366f1" });
        fetchLeavingStudents();
        fetchMeta();
      } else {
        Swal.fire({ icon: "error", title: "Error", text: data.error || "Failed to mark as Left.", confirmButtonColor: "#6366f1" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Network Error", text: "Could not reach server.", confirmButtonColor: "#6366f1" });
    } finally {
      setFinalizingId(null);
    }
  };

  // ──────────────────────────────────────────────────────────
  // Derived / filtered lists
  // ──────────────────────────────────────────────────────────
  const filteredPreview = previewStudents.filter((s) => {
    if (!promotionSearch) return true;
    const q = promotionSearch.toLowerCase();
    return (
      (s.name || "").toLowerCase().includes(q) ||
      String(s.roll || "").includes(q) ||
      (s.studentCode || "").toLowerCase().includes(q)
    );
  });

  const fromYearClasses = fromAcademicYearId
    ? classes.filter((c) => String(c.academicYearId || "") === String(fromAcademicYearId))
    : [];
  const toYearClasses = toAcademicYearId
    ? classes.filter((c) => String(c.academicYearId || "") === String(toAcademicYearId))
    : [];

  const filteredActive = activeStudents.filter((s) => {
    const matchClass = !leaveClassFilter || (s.grade || "") === leaveClassFilter;
    if (!matchClass) return false;
    if (!activeSearch) return true;
    const q = activeSearch.toLowerCase();
    return (
      (s.name || "").toLowerCase().includes(q) ||
      String(s.roll || "").includes(q) ||
      (s.studentCode || "").toLowerCase().includes(q)
    );
  });

  const allPreviewSelected =
    filteredPreview.length > 0 &&
    filteredPreview.every((s) => selectedStudentIds.includes(s._id));

  const toggleSelectAll = () => {
    if (allPreviewSelected) {
      setSelectedStudentIds((prev) =>
        prev.filter((id) => !filteredPreview.some((s) => s._id === id))
      );
    } else {
      const toAdd = filteredPreview.map((s) => s._id);
      setSelectedStudentIds((prev) => [...new Set([...prev, ...toAdd])]);
    }
  };

  const allActiveSelected =
    filteredActive.length > 0 &&
    filteredActive.every((s) => selectedForLeave.includes(s._id));

  const toggleSelectAllActive = () => {
    if (allActiveSelected) {
      setSelectedForLeave((prev) =>
        prev.filter((id) => !filteredActive.some((s) => s._id === id))
      );
    } else {
      const toAdd = filteredActive.map((s) => s._id);
      setSelectedForLeave((prev) => [...new Set([...prev, ...toAdd])]);
    }
  };

  const paginatedActive = useMemo(() => {
    const start = (activePage - 1) * LEAVE_TABLE_PAGE_SIZE;
    return filteredActive.slice(start, start + LEAVE_TABLE_PAGE_SIZE);
  }, [filteredActive, activePage]);

  const paginatedLeaving = useMemo(() => {
    const start = (leavingPage - 1) * LEAVE_TABLE_PAGE_SIZE;
    return leavingStudents.slice(start, start + LEAVE_TABLE_PAGE_SIZE);
  }, [leavingStudents, leavingPage]);

  // ──────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-white p-4 md:p-6">
      {/* ──────── Hero header ──────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 md:p-8 mb-6 shadow-lg shadow-indigo-200/60">
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-20 -left-16 w-64 h-64 rounded-full bg-black/10 pointer-events-none" />
        <div className="absolute top-1/2 right-16 w-20 h-20 rounded-full bg-yellow-300/10 border border-yellow-300/20 pointer-events-none" />
        <div className="relative flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-sm flex items-center justify-center shadow-inner shrink-0">
            <ArrowUpCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-2.5 py-0.5 mb-1.5">
              <Sparkles className="w-3 h-3 text-yellow-200" />
              <span className="text-[11px] font-semibold text-white/90 tracking-wide">Academic Operations</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white leading-tight">
              Student Promotion &amp; Leave Management
            </h1>
            <p className="text-indigo-100/80 text-sm mt-1">
              Promote students to their next class or manage student departures — all in one place.
            </p>
          </div>
        </div>
      </div>

      {/* ──────── Tabs ──────── */}
      <div className="relative flex gap-1 mb-6 bg-white/80 backdrop-blur border border-gray-200/70 rounded-full p-1.5 w-fit shadow-sm">
        {[
          { key: "promotion", label: "Class Promotion", icon: ArrowRight },
          { key: "leave", label: "Leave Management", icon: LogOut },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                active ? "text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {active && (
                <Motion.span
                  layoutId="promoTabIndicator"
                  className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-200"
                  transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
                />
              )}
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* ══════════════════════════════════════════════════════
            TAB: PROMOTION
        ══════════════════════════════════════════════════════ */}
        {activeTab === "promotion" && (
          <Motion.div
            key="promotion"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Mode selector */}
            <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200/70 p-5 md:p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-bold text-gray-800">Promotion Mode</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {MODE_CARDS.map(({ key, label, desc }) => {
                  const style = MODE_STYLES[key];
                  const Icon = style.icon;
                  const active = promotionMode === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setPromotionMode(key);
                        if (key === "bulk" && previewStudents.length > 0) {
                          setSelectedStudentIds(previewStudents.map((s) => s._id));
                        } else if (key !== "bulk") {
                          setSelectedStudentIds([]);
                        }
                      }}
                      className={`relative border rounded-2xl p-4 text-left transition-all ${
                        active ? style.ring : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                      }`}
                    >
                      {active && (
                        <span className={`absolute top-3 right-3 h-5 w-5 rounded-full ${style.badge} flex items-center justify-center shadow-sm`}>
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        </span>
                      )}
                      <div className={`h-9 w-9 rounded-xl ${style.iconBg} flex items-center justify-center shadow-sm mb-3`}>
                        <Icon className="w-4.5 h-4.5 text-white" />
                      </div>
                      <div className="font-semibold text-sm text-gray-800">{label}</div>
                      <div className="text-xs text-gray-500 mt-0.5 leading-snug">{desc}</div>
                    </button>
                  );
                })}
              </div>
              <AnimatePresence>
                {promotionMode === "marks" && (
                  <Motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 bg-emerald-50/70 border border-emerald-100 rounded-xl p-4">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Minimum Pass Percentage
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={minPromotionPercentage}
                        onChange={(e) => setMinPromotionPercentage(Math.max(0, Math.min(100, Number(e.target.value || 0))))}
                        className="w-40 border border-emerald-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                      <p className="text-xs text-emerald-700/70 mt-1.5">
                        Uses published exam results. Rolls for promoted students are reassigned by marks rank.
                      </p>
                    </div>
                  </Motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Promotion form */}
            <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200/70 p-5 md:p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-sm">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-bold text-gray-800">Promotion Details</h2>
              </div>

              {loadingMeta && (
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading classes...
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-5 items-stretch">
                {/* ── FROM side ── */}
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> From
                  </span>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Academic Year *</label>
                      <SelectField
                        icon={Calendar}
                        value={fromAcademicYearId}
                        onChange={handleFromAcademicYearChange}
                      >
                        <option value="">Select year...</option>
                        {academicYears.map((ay) => (
                          <option key={ay._id} value={ay._id}>
                            {ay.name}{ay.isActive ? " (current)" : ""}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Class *</label>
                      <SelectField
                        icon={GraduationCap}
                        value={fromClassId}
                        onChange={handleFromClassChange}
                        disabled={!fromAcademicYearId}
                      >
                        <option value="">
                          {fromAcademicYearId ? "Select class..." : "Select academic year first"}
                        </option>
                        {fromYearClasses.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                            {studentCounts[c.name]
                              ? ` (${studentCounts[c.name]} students)`
                              : ""}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Section <span className="text-gray-400">(optional)</span>
                      </label>
                      <SelectField
                        icon={Filter}
                        value={fromSection}
                        onChange={(e) => {
                          setFromSection(e.target.value);
                          setPreviewStudents([]);
                          setSelectedStudentIds([]);
                        }}
                        disabled={!fromClassId || fromSections.length === 0}
                      >
                        <option value="">All sections</option>
                        {fromSections.map((s) => (
                          <option key={s._id} value={s.name}>{s.name}</option>
                        ))}
                      </SelectField>
                    </div>
                  </div>
                </div>

                {/* ── Arrow ── */}
                <div className="flex lg:flex-col items-center justify-center gap-2 py-2 lg:py-0">
                  <div className="relative flex items-center justify-center">
                    <span className="absolute h-14 w-14 rounded-full bg-indigo-200/40 animate-ping" />
                    <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-200">
                      <ArrowRight className="w-5 h-5 text-white rotate-90 lg:rotate-0" />
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-500 whitespace-nowrap">Promote to</span>
                </div>

                {/* ── TO side ── */}
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> To
                  </span>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Academic Year *</label>
                      <SelectField
                        icon={Calendar}
                        value={toAcademicYearId}
                        onChange={handleToAcademicYearChange}
                      >
                        <option value="">Select year...</option>
                        {academicYears.map((ay) => (
                          <option key={ay._id} value={ay._id}>
                            {ay.name}{ay.isActive ? " (current)" : ""}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Class *</label>
                      <SelectField
                        icon={GraduationCap}
                        value={toClassId}
                        onChange={handleToClassChange}
                        disabled={!toAcademicYearId}
                      >
                        <option value="">
                          {toAcademicYearId ? "Select class..." : "Select academic year first"}
                        </option>
                        {toYearClasses.map((c) => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </SelectField>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Section <span className="text-gray-400">(optional)</span>
                      </label>
                      <SelectField
                        icon={Filter}
                        value={toSection}
                        onChange={(e) => setToSection(e.target.value)}
                        disabled={!toClassId || toSections.length === 0}
                      >
                        <option value="">Same / any section</option>
                        {toSections.map((s) => (
                          <option key={s._id} value={s.name}>{s.name}</option>
                        ))}
                      </SelectField>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="mt-5">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
                  <ClipboardList className="w-3.5 h-3.5 text-gray-400" />
                  Notes <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Annual promotion 2025–26"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
                />
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-gray-100">
                <button
                  onClick={handlePreview}
                  disabled={loadingPreview || !fromClassName}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  Preview Students
                </button>
                <button
                  onClick={handlePromote}
                  disabled={promoting || selectedStudentIds.length === 0 || !toClassName}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-200/70 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
                >
                  {promoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {promotionMode === "bulk"
                    ? `Promote All (${selectedStudentIds.length})`
                    : promotionMode === "marks"
                      ? `Promote Eligible (${selectedStudentIds.length})`
                      : `Promote Selected (${selectedStudentIds.length})`}
                </button>
                <button
                  onClick={toggleHistory}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-100 transition ml-auto"
                >
                  <History className="w-4 h-4" />
                  {showHistory ? "Hide History" : "View History"}
                </button>
              </div>
            </div>

            {/* Preview table */}
            <AnimatePresence>
              {previewStudents.length > 0 && (
                <Motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden"
                >
                  <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-indigo-50/60 to-transparent">
                    <div>
                      <h3 className="font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                        {fromClassName}{fromSection ? ` – ${fromSection}` : ""}
                        {fromAcademicYear ? ` (${fromAcademicYear})` : ""}
                        <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                          <Users className="w-3 h-3" /> {previewStudents.length}
                        </span>
                      </h3>
                      {promotionMode === "manual" && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {selectedStudentIds.length} selected — click rows to toggle
                        </p>
                      )}
                      {promotionMode === "marks" && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {selectedStudentIds.length} eligible at {minPromotionPercentage}% and above
                        </p>
                      )}
                    </div>
                    <SearchField
                      value={promotionSearch}
                      onChange={(e) => setPromotionSearch(e.target.value)}
                      placeholder="Search by name / roll / code..."
                      className="w-64"
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50/80 backdrop-blur text-gray-500 text-xs uppercase tracking-wide sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={allPreviewSelected}
                              onChange={toggleSelectAll}
                              disabled={promotionMode !== "manual"}
                              className="rounded border-gray-300 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </th>
                          <th className="px-4 py-3 text-left">#</th>
                          <th className="px-4 py-3 text-left">Name</th>
                          <th className="px-4 py-3 text-left">Code</th>
                          <th className="px-4 py-3 text-left">Class</th>
                          <th className="px-4 py-3 text-left">Section</th>
                          <th className="px-4 py-3 text-left">Roll</th>
                          <th className="px-4 py-3 text-left">Acad. Year</th>
                          {promotionMode === "marks" && (
                            <>
                              <th className="px-4 py-3 text-left">%</th>
                              <th className="px-4 py-3 text-left">Eligibility</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredPreview.map((s, i) => {
                          const isSelected = selectedStudentIds.includes(s._id);
                          return (
                            <tr
                              key={s._id}
                              onClick={() => {
                                if (promotionMode !== "manual") return;
                                setSelectedStudentIds((prev) =>
                                  prev.includes(s._id)
                                    ? prev.filter((id) => id !== s._id)
                                    : [...prev, s._id]
                                );
                              }}
                              className={`transition-colors ${promotionMode === "manual" ? "cursor-pointer" : ""} ${
                                isSelected ? "bg-indigo-50/70" : "even:bg-gray-50/40 hover:bg-indigo-50/30"
                              }`}
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  readOnly
                                  disabled={promotionMode !== "manual"}
                                  className="rounded border-gray-300 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
                                    {initials(s.name)}
                                  </div>
                                  <span className="font-medium text-gray-800">{s.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.studentCode || "—"}</td>
                              <td className="px-4 py-3 text-gray-600">{s.grade || "—"}</td>
                              <td className="px-4 py-3 text-gray-600">{s.section || "—"}</td>
                              <td className="px-4 py-3 text-gray-600">{s.roll || "—"}</td>
                              <td className="px-4 py-3 text-gray-500">{s.academicYear || "—"}</td>
                              {promotionMode === "marks" && (
                                <>
                                  <td className="px-4 py-3 text-gray-700 font-semibold">
                                    {Number(s?.marksSummary?.percentage || 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                        s?.marksSummary?.eligible
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-red-100 text-red-700"
                                      }`}
                                    >
                                      {s?.marksSummary?.eligible ? <CheckCircle2 className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                      {s?.marksSummary?.eligible ? "Eligible" : "Ineligible"}
                                    </span>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                        {filteredPreview.length === 0 && (
                          <tr>
                            <td colSpan={promotionMode === "marks" ? 10 : 8} className="px-4 py-8 text-center text-gray-400 text-sm">
                              No students match your search.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Motion.div>
              )}
            </AnimatePresence>

            {/* Promotion history */}
            <AnimatePresence>
              {showHistory && (
                <Motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden"
                >
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 to-transparent">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <History className="w-4 h-4 text-indigo-500" />
                      Promotion History
                    </h3>
                    <div className="flex items-center gap-3">
                      {loadingHistory && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
                      <button
                        onClick={fetchHistory}
                        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Refresh
                      </button>
                    </div>
                  </div>
                  {promotionHistory.length === 0 && !loadingHistory ? (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      No promotion records yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wide">
                          <tr>
                            <th className="px-4 py-3 text-left">Date</th>
                            <th className="px-4 py-3 text-left">From</th>
                            <th className="px-4 py-3 text-left">To</th>
                            <th className="px-4 py-3 text-left">Students</th>
                            <th className="px-4 py-3 text-left">Type</th>
                            <th className="px-4 py-3 text-left">Academic Year</th>
                            <th className="px-4 py-3 text-left">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {promotionHistory.map((h) => (
                            <tr key={h._id} className={`hover:bg-gray-50/70 border-l-4 ${
                              h.type === "bulk" ? "border-l-indigo-400" : h.type === "marks" ? "border-l-emerald-400" : "border-l-orange-400"
                            }`}>
                              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(h.createdAt)}</td>
                              <td className="px-4 py-3 font-medium text-gray-800">
                                {h.fromClass}{h.fromSection ? ` – ${h.fromSection}` : ""}
                              </td>
                              <td className="px-4 py-3 font-medium text-indigo-700">
                                {h.toClass}{h.toSection ? ` – ${h.toSection}` : ""}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                                  <Users className="w-3 h-3" />
                                  {h.studentCount}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${HISTORY_TYPE_STYLES[h.type] || HISTORY_TYPE_STYLES.manual}`}>
                                  {h.type === "bulk" ? "Bulk" : h.type === "marks" ? "Marks" : "Manual"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-500">{h.toAcademicYear || "—"}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px] truncate">{h.notes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Motion.div>
              )}
            </AnimatePresence>

            {/* Class overview cards */}
            <div>
              <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-indigo-500" />
                Class Overview
              </h3>
              {loadingMeta ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : classes.length === 0 ? (
                <p className="text-gray-400 text-sm">No classes configured yet. Add classes in Academic Setup.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {classes.map((c) => (
                    <div
                      key={c._id}
                      onClick={() => {
                        setFromClassId(c._id);
                        setFromClassName(c.name);
                        setPreviewStudents([]);
                        setSelectedStudentIds([]);
                      }}
                      className="group relative bg-white rounded-2xl border border-gray-200/70 p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden"
                    >
                      <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-indigo-50 group-hover:bg-indigo-100 transition-colors" />
                      <div className="relative">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-xs shadow-sm mb-2.5">
                          {initials(c.name)}
                        </div>
                        <div className="text-base font-bold text-gray-800">{c.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {studentCounts[c.name] || 0} student{studentCounts[c.name] !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Motion.div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: LEAVE MANAGEMENT
        ══════════════════════════════════════════════════════ */}
        {activeTab === "leave" && (
          <Motion.div
            key="leave"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Active students – select to mark leaving */}
            <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50/60 to-transparent">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
                        <UserCheck className="w-3.5 h-3.5 text-white" />
                      </div>
                      Active Students
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5 ml-9">
                      Select students to mark as leaving
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SelectField
                      icon={Filter}
                      value={leaveClassFilter}
                      onChange={(e) => { setLeaveClassFilter(e.target.value); setSelectedForLeave([]); }}
                      className="w-40"
                    >
                      <option value="">All Classes</option>
                      {classes.map((c) => (
                        <option key={c._id} value={c.name}>{c.name}</option>
                      ))}
                    </SelectField>
                    <SearchField
                      value={activeSearch}
                      onChange={(e) => setActiveSearch(e.target.value)}
                      placeholder="Search..."
                      className="w-48"
                    />
                    <button
                      onClick={handleMarkLeaving}
                      disabled={selectedForLeave.length === 0}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-red-200/70 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
                    >
                      <LogOut className="w-4 h-4" />
                      Mark Leaving ({selectedForLeave.length})
                    </button>
                  </div>
                </div>
              </div>

              {loadingActive ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading students...
                </div>
              ) : filteredActive.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  {leaveClassFilter
                    ? `No active students in ${leaveClassFilter}.`
                    : "No active students found."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={allActiveSelected}
                            onChange={toggleSelectAllActive}
                            className="rounded border-gray-300 accent-rose-600 cursor-pointer"
                          />
                        </th>
                        <th className="px-4 py-3 text-left">#</th>
                        <th className="px-4 py-3 text-left">Name</th>
                        <th className="px-4 py-3 text-left">Code</th>
                        <th className="px-4 py-3 text-left">Class</th>
                        <th className="px-4 py-3 text-left">Section</th>
                        <th className="px-4 py-3 text-left">Roll</th>
                        <th className="px-4 py-3 text-left">Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedActive.map((s, i) => {
                        const isSelected = selectedForLeave.includes(s._id);
                        return (
                          <tr
                            key={s._id}
                            onClick={() =>
                              setSelectedForLeave((prev) =>
                                prev.includes(s._id)
                                  ? prev.filter((id) => id !== s._id)
                                  : [...prev, s._id]
                              )
                            }
                            className={`cursor-pointer transition-colors ${
                              isSelected ? "bg-rose-50/70" : "even:bg-gray-50/40 hover:bg-rose-50/30"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="rounded border-gray-300 accent-rose-600 cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 text-gray-400">{(activePage - 1) * LEAVE_TABLE_PAGE_SIZE + i + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
                                  {initials(s.name)}
                                </div>
                                <span className="font-medium text-gray-800">{s.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.studentCode || "—"}</td>
                            <td className="px-4 py-3 text-gray-600">{s.grade || "—"}</td>
                            <td className="px-4 py-3 text-gray-600">{s.section || "—"}</td>
                            <td className="px-4 py-3 text-gray-600">{s.roll || "—"}</td>
                            <td className="px-4 py-3 text-gray-500">{s.mobile || s.guardianPhone || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <PaginationBar
                    page={activePage}
                    totalItems={filteredActive.length}
                    pageSize={LEAVE_TABLE_PAGE_SIZE}
                    onPageChange={setActivePage}
                  />
                </div>
              )}
            </div>

            {/* Leaving students list */}
            <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-orange-50/60 to-transparent">
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-sm">
                      <UserX className="w-3.5 h-3.5 text-white" />
                    </div>
                    Leaving Students
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 ml-9">
                    {leavingStudents.length} student(s) marked as leaving
                  </p>
                </div>
                <button
                  onClick={fetchLeavingStudents}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 transition font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              {loadingLeaving ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading...
                </div>
              ) : leavingStudents.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No students marked as leaving.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left">#</th>
                        <th className="px-4 py-3 text-left">Name</th>
                        <th className="px-4 py-3 text-left">Class</th>
                        <th className="px-4 py-3 text-left">Section</th>
                        <th className="px-4 py-3 text-left">Reason</th>
                        <th className="px-4 py-3 text-left">TC No.</th>
                        <th className="px-4 py-3 text-left">TC Date</th>
                        <th className="px-4 py-3 text-left">Remarks</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedLeaving.map((s, i) => (
                        <tr key={s._id} className="even:bg-gray-50/40 hover:bg-orange-50/30 transition-colors">
                          <td className="px-4 py-3 text-gray-400">{(leavingPage - 1) * LEAVE_TABLE_PAGE_SIZE + i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{s.name}</div>
                            <div className="text-xs text-gray-400 font-mono">{s.studentCode || ""}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{s.grade || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{s.section || "—"}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-[130px] truncate" title={s.reasonForLeaving}>
                            {s.reasonForLeaving || "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{s.transferCertificateNo || "—"}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.transferCertificateDate || "—"}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[130px] truncate" title={s.remarks}>
                            {s.remarks || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                              s.status === "Left"
                                ? "bg-red-100 text-red-700"
                                : "bg-orange-100 text-orange-700"
                            }`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-start gap-1.5">
                              {s.status !== "Left" && (
                                <button
                                  onClick={() => handleMarkLeft(s)}
                                  disabled={finalizingId === s._id}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-xs text-red-600 hover:bg-red-100 font-medium transition disabled:opacity-50"
                                >
                                  {finalizingId === s._id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <LogOut className="w-3.5 h-3.5" />
                                  )}
                                  Mark Left
                                </button>
                              )}
                              <button
                                onClick={() => handleRestore(s)}
                                disabled={restoringId === s._id}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-xs text-emerald-600 hover:bg-emerald-100 font-medium transition disabled:opacity-50"
                              >
                                {restoringId === s._id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3.5 h-3.5" />
                                )}
                                Restore
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <PaginationBar
                    page={leavingPage}
                    totalItems={leavingStudents.length}
                    pageSize={LEAVE_TABLE_PAGE_SIZE}
                    onPageChange={setLeavingPage}
                  />
                </div>
              )}
            </div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          LEAVE MODAL
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showLeaveModal && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          >
            <Motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.35, bounce: 0.2 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-800 flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm">
                    <LogOut className="w-4 h-4 text-white" />
                  </div>
                  <span>Mark as Leaving<br /><span className="text-xs font-normal text-gray-400">{selectedForLeave.length} student(s)</span></span>
                </h3>
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition p-1.5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Reason for Leaving <span className="text-red-500">*</span>
                  </label>
                  <SelectField
                    value={leaveForm.reasonForLeaving}
                    onChange={(e) => setLeaveForm((f) => ({ ...f, reasonForLeaving: e.target.value }))}
                  >
                    <option value="">Select reason...</option>
                    <option>Family Relocation</option>
                    <option>Transfer to Another School</option>
                    <option>Completed Studies</option>
                    <option>Financial Reasons</option>
                    <option>Health Issues</option>
                    <option>Disciplinary</option>
                    <option>Other</option>
                  </SelectField>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Leaving Date</label>
                  <input
                    type="date"
                    value={leaveForm.leavingDate}
                    onChange={(e) => setLeaveForm((f) => ({ ...f, leavingDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">TC Number</label>
                    <input
                      type="text"
                      value={leaveForm.transferCertificateNo}
                      onChange={(e) => setLeaveForm((f) => ({ ...f, transferCertificateNo: e.target.value }))}
                      placeholder="TC-001"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">TC Issue Date</label>
                    <input
                      type="date"
                      value={leaveForm.transferCertificateDate}
                      onChange={(e) => setLeaveForm((f) => ({ ...f, transferCertificateDate: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                  <textarea
                    value={leaveForm.remarks}
                    onChange={(e) => setLeaveForm((f) => ({ ...f, remarks: e.target.value }))}
                    rows={2}
                    placeholder="Any additional notes..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={submitLeaveForm}
                  disabled={submittingLeave}
                  className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:shadow-lg shadow-red-200/70 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submittingLeave ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                  Confirm Leaving
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentPromotion;
