import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowRight,
  Users,
  GraduationCap,
  Search,
  ChevronDown,
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

  // ──────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ArrowUpCircle className="w-7 h-7 text-indigo-600" />
          Student Promotion & Leave Management
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Promote students to next class or manage student departures
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
        <button
          onClick={() => setActiveTab("promotion")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "promotion"
              ? "bg-indigo-600 text-white shadow"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <ArrowRight className="w-4 h-4" />
          Class Promotion
        </button>
        <button
          onClick={() => setActiveTab("leave")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "leave"
              ? "bg-indigo-600 text-white shadow"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <LogOut className="w-4 h-4" />
          Leave Management
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB: PROMOTION
      ══════════════════════════════════════════════════════ */}
      {activeTab === "promotion" && (
        <div className="space-y-6">
          {/* Mode selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              Promotion Mode
            </h2>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPromotionMode("bulk");
                  if (previewStudents.length > 0)
                    setSelectedStudentIds(previewStudents.map((s) => s._id));
                }}
                className={`flex-1 border rounded-lg p-3 text-left transition-all ${
                  promotionMode === "bulk"
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-sm text-gray-800">Bulk (Automatic)</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Promote all students of a class at once
                </div>
              </button>
              <button
                onClick={() => {
                  setPromotionMode("manual");
                  setSelectedStudentIds([]);
                }}
                className={`flex-1 border rounded-lg p-3 text-left transition-all ${
                  promotionMode === "manual"
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-sm text-gray-800">Manual (Individual)</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Select specific students to promote
                </div>
              </button>
              <button
                onClick={() => {
                  setPromotionMode("marks");
                  setSelectedStudentIds([]);
                }}
                className={`flex-1 border rounded-lg p-3 text-left transition-all ${
                  promotionMode === "marks"
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-sm text-gray-800">Marks Based</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Promote only passing students and update roll by rank
                </div>
              </button>
            </div>
            {promotionMode === "marks" && (
              <div className="mt-4">
                <label className="block text-xs text-gray-600 mb-1">
                  Minimum Pass Percentage
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={minPromotionPercentage}
                  onChange={(e) => setMinPromotionPercentage(Math.max(0, Math.min(100, Number(e.target.value || 0))))}
                  className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Uses published exam results. Rolls for promoted students are reassigned by marks rank.
                </p>
              </div>
            )}
          </div>

          {/* Promotion form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              Promotion Details
            </h2>

            {loadingMeta && (
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading classes...
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              {/* ── FROM side ── */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  From
                </label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Academic Year *</label>
                    <div className="relative">
                      <select
                        value={fromAcademicYearId}
                        onChange={handleFromAcademicYearChange}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      >
                        <option value="">Select year...</option>
                        {academicYears.map((ay) => (
                          <option key={ay._id} value={ay._id}>
                            {ay.name}{ay.isActive ? " (current)" : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Class *</label>
                    <div className="relative">
                      <select
                        value={fromClassId}
                        onChange={handleFromClassChange}
                        disabled={!fromAcademicYearId}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50 disabled:text-gray-400"
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
                      </select>
                      <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Section <span className="text-gray-400">(optional)</span>
                    </label>
                    <div className="relative">
                      <select
                        value={fromSection}
                        onChange={(e) => {
                          setFromSection(e.target.value);
                          setPreviewStudents([]);
                          setSelectedStudentIds([]);
                        }}
                        disabled={!fromClassId || fromSections.length === 0}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">All sections</option>
                        {fromSections.map((s) => (
                          <option key={s._id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Arrow ── */}
              <div className="hidden lg:flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-indigo-400">
                  <ArrowRight className="w-8 h-8" />
                  <span className="text-xs font-medium text-indigo-500">Promote to</span>
                </div>
              </div>

              {/* ── TO side ── */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  To
                </label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Academic Year *</label>
                    <div className="relative">
                      <select
                        value={toAcademicYearId}
                        onChange={handleToAcademicYearChange}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      >
                        <option value="">Select year...</option>
                        {academicYears.map((ay) => (
                          <option key={ay._id} value={ay._id}>
                            {ay.name}{ay.isActive ? " (current)" : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Class *</label>
                    <div className="relative">
                      <select
                        value={toClassId}
                        onChange={handleToClassChange}
                        disabled={!toAcademicYearId}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">
                          {toAcademicYearId ? "Select class..." : "Select academic year first"}
                        </option>
                        {toYearClasses.map((c) => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Section <span className="text-gray-400">(optional)</span>
                    </label>
                    <div className="relative">
                      <select
                        value={toSection}
                        onChange={(e) => setToSection(e.target.value)}
                        disabled={!toClassId || toSections.length === 0}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">Same / any section</option>
                        {toSections.map((s) => (
                          <option key={s._id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="block text-xs text-gray-600 mb-1">
                Notes <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Annual promotion 2025–26"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mt-5">
              <button
                onClick={handlePreview}
                disabled={loadingPreview || !fromClassName}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                Preview Students
              </button>
              <button
                onClick={handlePromote}
                disabled={promoting || selectedStudentIds.length === 0 || !toClassName}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition"
              >
                <History className="w-4 h-4" />
                {showHistory ? "Hide History" : "View History"}
              </button>
            </div>
          </div>

          {/* Preview table */}
          {previewStudents.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-800">
                    {fromClassName}{fromSection ? ` – ${fromSection}` : ""}
                    {fromAcademicYear ? ` (${fromAcademicYear})` : ""}
                    {" — "}{previewStudents.length} student(s)
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
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={promotionSearch}
                    onChange={(e) => setPromotionSearch(e.target.value)}
                    placeholder="Search by name / roll / code..."
                    className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={allPreviewSelected}
                          onChange={toggleSelectAll}
                          disabled={promotionMode !== "manual"}
                          className="rounded border-gray-300"
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
                          className={`transition ${promotionMode === "manual" ? "cursor-pointer" : ""} ${
                            isSelected ? "bg-indigo-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              disabled={promotionMode !== "manual"}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.studentCode || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{s.grade || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{s.section || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{s.roll || "—"}</td>
                          <td className="px-4 py-3 text-gray-500">{s.academicYear || "—"}</td>
                          {promotionMode === "marks" && (
                            <>
                              <td className="px-4 py-3 text-gray-700 font-medium">
                                {Number(s?.marksSummary?.percentage || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    s?.marksSummary?.eligible
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
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
            </div>
          )}

          {/* Promotion history */}
          {showHistory && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-500" />
                  Promotion History
                </h3>
                <div className="flex items-center gap-3">
                  {loadingHistory && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
                  <button
                    onClick={fetchHistory}
                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
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
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
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
                        <tr key={h._id} className="hover:bg-gray-50">
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
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              h.type === "bulk"
                                ? "bg-purple-100 text-purple-700"
                                : h.type === "marks"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-orange-100 text-orange-700"
                            }`}>
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
            </div>
          )}

          {/* Class overview cards */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
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
                    className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:border-indigo-300 hover:shadow-md transition cursor-pointer"
                  >
                    <div className="text-base font-bold text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {studentCounts[c.name] || 0} student{studentCounts[c.name] !== 1 ? "s" : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: LEAVE MANAGEMENT
      ══════════════════════════════════════════════════════ */}
      {activeTab === "leave" && (
        <div className="space-y-6">
          {/* Active students – select to mark leaving */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-green-500" />
                    Active Students
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Select students to mark as leaving
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <select
                      value={leaveClassFilter}
                      onChange={(e) => { setLeaveClassFilter(e.target.value); setSelectedForLeave([]); }}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-7"
                    >
                      <option value="">All Classes</option>
                      {classes.map((c) => (
                        <option key={c._id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={activeSearch}
                      onChange={(e) => setActiveSearch(e.target.value)}
                      placeholder="Search..."
                      className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <button
                    onClick={handleMarkLeaving}
                    disabled={selectedForLeave.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={allActiveSelected}
                          onChange={toggleSelectAllActive}
                          className="rounded border-gray-300"
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
                    {filteredActive.slice(0, 100).map((s, i) => {
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
                          className={`cursor-pointer transition ${
                            isSelected ? "bg-red-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
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
                {filteredActive.length > 100 && (
                  <div className="px-4 py-2 text-center text-xs text-gray-400 border-t border-gray-100">
                    Showing first 100 of {filteredActive.length} students. Use search or class filter to narrow down.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Leaving students list */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <UserX className="w-4 h-4 text-red-500" />
                  Leaving Students
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {leavingStudents.length} student(s) marked as leaving
                </p>
              </div>
              <button
                onClick={fetchLeavingStudents}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 transition"
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
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
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
                    {leavingStudents.map((s, i) => (
                      <tr key={s._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
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
                          <div className="flex flex-col items-start gap-2">
                            {s.status !== "Left" && (
                              <button
                                onClick={() => handleMarkLeft(s)}
                                disabled={finalizingId === s._id}
                                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium transition disabled:opacity-50"
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
                              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium transition disabled:opacity-50"
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
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          LEAVE MODAL
      ══════════════════════════════════════════════════════ */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <LogOut className="w-5 h-5 text-red-500" />
                Mark as Leaving — {selectedForLeave.length} student(s)
              </h3>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="text-gray-400 hover:text-gray-600 transition p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Reason for Leaving <span className="text-red-500">*</span>
                </label>
                <select
                  value={leaveForm.reasonForLeaving}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, reasonForLeaving: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">Select reason...</option>
                  <option>Family Relocation</option>
                  <option>Transfer to Another School</option>
                  <option>Completed Studies</option>
                  <option>Financial Reasons</option>
                  <option>Health Issues</option>
                  <option>Disciplinary</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Leaving Date</label>
                <input
                  type="date"
                  value={leaveForm.leavingDate}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, leavingDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
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
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">TC Issue Date</label>
                  <input
                    type="date"
                    value={leaveForm.transferCertificateDate}
                    onChange={(e) => setLeaveForm((f) => ({ ...f, transferCertificateDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={submitLeaveForm}
                disabled={submittingLeave}
                className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingLeave ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                Confirm Leaving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentPromotion;
