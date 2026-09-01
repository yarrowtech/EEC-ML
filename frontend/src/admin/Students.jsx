import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Phone,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Hash,
  BookOpen,
  Search,
  Plus,
  Edit2,
  MoreVertical,
  Heart,
  AlertCircle,
  CheckCircle,
  IndianRupee,
  Smile,
  Frown,
  Meh,
  TrendingUp,
  Brain,
  Users,
  MessageCircle,
  Star,
  X,
  Upload,
  GraduationCap,
  FileDown,
  Archive,
  RotateCcw,
  FileClock,
  Trash2,
  Eye,
  KeyRound,
  Loader2,
  CalendarDays,
  Wallet,
} from "lucide-react";
import StudentEnrollWizard, { DocPreviewModal } from "./components/StudentEnrollWizard";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import CredentialGeneratorButton from './components/CredentialGeneratorButton';

const API_BASE = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '');

const escapeHtml = (value) => {
  const str = String(value ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const STUDENTS_CACHE_PREFIX = "admin_students_cache_v1";
const DRAFTS_API = `${API_BASE}/api/student/auth/enrollment-drafts`;
const ENROLL_STEP_LABELS = [
  "Student Personal Information",
  "Address Information",
  "Parent / Guardian Information",
  "Previous Academic History",
  "Medical Information",
  "Admission & Academic Details",
  "Documents",
  "Office / Administration",
  "Review & Submit",
];

const draftTimeAgo = (iso) => {
  const t = new Date(iso).getTime();
  if (!t) return "";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d > 1 ? "s" : ""} ago`;
  return new Date(iso).toLocaleString();
};

// Blank "Enroll New Student" form. Kept at module scope so it can seed useState
// and reset the form after enrolling / starting a fresh draft.
const INITIAL_NEW_STUDENT = {
  // core
  name: "", email: "", mobile: "", gender: "", dob: "",
  address: "", permanentAddress: "", pincode: "", status: "Active",
  // Personal Details Extended
  birthPlace: "", nationality: "Indian", religion: "", caste: "", category: "", photograph: "",
  // Guardian/Parent Info
  guardianName: "", guardianEmail: "", guardianPhone: "",
  guardianRelation: "", guardianType: "", // guardianType: father | mother | existing | other
  fatherName: "", fatherOccupation: "", fatherPhone: "",
  motherName: "", motherOccupation: "", motherPhone: "",
  // Emergency Contact
  emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
  // Academic History
  hasPreviousSchool: "", // "" | "yes" | "no"
  previousSchoolName: "", previousClass: "", previousPercentage: "",
  transferCertificateNo: "", transferCertificateDate: "", reasonForLeaving: "",
  // Medical Info
  bloodGroup: "", knownHealthIssues: "", allergies: "", immunizationStatus: "", learningDisabilities: "",
  // Documents
  aadharNumber: "", birthCertificateNo: "",
  documents: [], // [{ type, label, url, fileName }]
  // Office Use
  applicationId: "", applicationDate: "", approvalStatus: "Approved", remarks: "",
  // academic
  serialNo: "", academicYear: "", admissionDate: "", admissionNumber: "", roll: "", class: "", section: "",
  admissionType: "New Admission",
};
const EXCLUDED_STUDENT_STATUSES = new Set(["leaving", "left", "expelled"]);
const shouldHideLeavingStudent = (student) =>
  EXCLUDED_STUDENT_STATUSES.has(String(student?.status || "").trim().toLowerCase());

const STUDENTS_PER_PAGE = 10;

const Students = ({ setShowAdminHeader }) => {
  const navigate = useNavigate(); 

  const [studentData, setStudentData] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [tableRefreshing, setTableRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showWellbeingModal, setShowWellbeingModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [wellbeingData, setWellbeingData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enrollDrafts, setEnrollDrafts] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [resumeStep, setResumeStep] = useState(0);
  const [enrollSessionKey, setEnrollSessionKey] = useState(0);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importJob, setImportJob] = useState(null); // { total, processed, imported, failed } while a bulk import runs
  const importProgressTimerRef = useRef(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteJob, setDeleteJob] = useState(null); // { total, processed, phase, deleted } while a bulk delete runs
  const fileInputRef = useRef(null);
  const tableBodyScrollRef = useRef(null);
  const tableHeaderRef = useRef(null);
  const editRequestTokenRef = useRef(0); // guards the background "fresh copy" fetch in openEditWizard
  const refreshRequestTokenRef = useRef(0); // guards against an older refreshStudents() overwriting a newer one
  const [archivedStudents, setArchivedStudents] = useState([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveActionLoading, setArchiveActionLoading] = useState(false);
  const [restoringStudentId, setRestoringStudentId] = useState(null); // row-level "Restoring…" state
  const [selectedArchivedStudentIds, setSelectedArchivedStudentIds] = useState([]);
  const [isArchiving, setIsArchiving] = useState(false);
  const [bulkOpJob, setBulkOpJob] = useState(null); // { mode: 'archive' | 'restore', total, processed } while a bulk archive/restore job runs
  const [deletingId, setDeletingId] = useState(null);
  const [credentialLoadingId, setCredentialLoadingId] = useState(null);
  const [credentialStatus, setCredentialStatus] = useState({});
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [enrollContext, setEnrollContext] = useState({
    schoolName: "NIF",
    campusType: "",
  });
  const [academicYears, setAcademicYears] = useState([]);
  const [academicClasses, setAcademicClasses] = useState([]);
  const [academicSections, setAcademicSections] = useState([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [editSelectedClassId, setEditSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [parentDirectory, setParentDirectory] = useState([]);
  const [parentSearchTerm, setParentSearchTerm] = useState("");
  const [editSelectedAcademicYearId, setEditSelectedAcademicYearId] = useState("");
  const [selectedExistingParent, setSelectedExistingParent] = useState(null);

  // View modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [editSelectedSectionId, setEditSelectedSectionId] = useState("");
  const [viewStudent, setViewStudent] = useState(null);
  const [viewAttendance, setViewAttendance] = useState([]);
  const [viewFees, setViewFees] = useState([]);
  const [viewParent, setViewParent] = useState(null);
  const [docPreview, setDocPreview] = useState(null); // { src, label }
  const [feeSession, setFeeSession] = useState(""); // selected session id in the Fees tab
  const [editingStudentId, setEditingStudentId] = useState(null); // set when the wizard is editing an existing student
  const [loadingViewData, setLoadingViewData] = useState(false);
  const [viewTab, setViewTab] = useState("overview");

  const [newStudent, setNewStudent] = useState(() => ({ ...INITIAL_NEW_STUDENT }));

  const [currentPage, setCurrentPage] = useState(1);

  /* -------------------- Derived -------------------- */
  const filteredStudents = useMemo(
    () =>
      studentData.filter((student) => {
        const matchesSearch = [
          student.name,
          student.roll,
          student.email,
          student.username,
          student.studentCode,
          student.parent?.username,
        ]
          .filter(Boolean)
          .some((v) =>
            String(v).toLowerCase().includes(searchTerm.toLowerCase())
          );
        if (!matchesSearch) return false;

        const studentSession = String(student.academicYear || "").trim();
        const studentClass = String(student.class || student.grade || "").trim();
        const studentSection = String(student.section || "").trim();

        if (sessionFilter && studentSession !== sessionFilter) return false;
        if (classFilter && studentClass !== classFilter) return false;
        if (sectionFilter && studentSection !== sectionFilter) return false;
        return true;
      }),
    [studentData, searchTerm, sessionFilter, classFilter, sectionFilter]
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE)
  );
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * STUDENTS_PER_PAGE;
    return filteredStudents.slice(start, start + STUDENTS_PER_PAGE);
  }, [filteredStudents, currentPage]);
  const visibleStudentIds = useMemo(
    () => paginatedStudents.map((student) => String(student?._id || student?.id)).filter(Boolean),
    [paginatedStudents]
  );
  const filteredStudentIds = useMemo(
    () => filteredStudents.map((student) => String(student?._id || student?.id)).filter(Boolean),
    [filteredStudents]
  );
  const selectedIdSet = useMemo(
    () => new Set(selectedStudentIds.map((id) => String(id))),
    [selectedStudentIds]
  );
  const isAllVisibleSelected =
    visibleStudentIds.length > 0 && visibleStudentIds.every((id) => selectedIdSet.has(id));
  const isAnyVisibleSelected = visibleStudentIds.some((id) => selectedIdSet.has(id));
  const isAllFilteredSelected =
    filteredStudentIds.length > 0 && filteredStudentIds.every((id) => selectedIdSet.has(id));
  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, idx) => idx + 1),
    [totalPages]
  );
  const startItem =
    filteredStudents.length > 0
      ? (currentPage - 1) * STUDENTS_PER_PAGE + 1
      : 0;
  const endItem = Math.min(
    currentPage * STUDENTS_PER_PAGE,
    filteredStudents.length
  );
  const sessionOptions = useMemo(
    () =>
      academicYears
        .filter((year) => year?.isActive)
        .map((year) => String(year?.name || "").trim())
        .filter(Boolean),
    [academicYears]
  );
  const academicYearNameById = useMemo(
    () =>
      new Map(
        academicYears
          .map((year) => [String(year?._id || "").trim(), String(year?.name || "").trim()])
          .filter(([id, name]) => id && name)
      ),
    [academicYears]
  );

  useEffect(() => {
    if (!sessionOptions.length) return;
    if (sessionFilter && !sessionOptions.includes(sessionFilter)) {
      setSessionFilter("");
      setClassFilter("");
      setSectionFilter("");
    }
  }, [sessionOptions, sessionFilter]);
  const classOptions = useMemo(
    () => {
      const source = sessionFilter
        ? studentData.filter((s) => String(s.academicYear || "").trim() === String(sessionFilter).trim())
        : studentData;
      const classFromStudents = source
        .map((s) => String(s.class || s.grade || "").trim())
        .filter(Boolean);
      const classFromCatalog = academicClasses
        .map((item) => String(item?.name || "").trim())
        .filter(Boolean);
      return Array.from(new Set([...classFromStudents, ...classFromCatalog])).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );
    },
    [sessionFilter, studentData, academicClasses]
  );
  const sectionOptions = useMemo(
    () => {
      let source = studentData;
      if (sessionFilter) source = source.filter((s) => String(s.academicYear || "").trim() === String(sessionFilter).trim());
      if (classFilter) source = source.filter((s) => String(s.class || s.grade || "").trim() === String(classFilter).trim());
      const sectionFromStudents = source
        .map((s) => String(s.section || "").trim())
        .filter(Boolean);

      const selectedCatalogClass = classFilter
        ? academicClasses.find((item) => String(item?.name || "").trim() === String(classFilter).trim())
        : null;
      const sectionFromCatalog = selectedCatalogClass
        ? academicSections
            .filter((section) => String(section?.classId || "") === String(selectedCatalogClass?._id || ""))
            .map((section) => String(section?.name || "").trim())
            .filter(Boolean)
        : academicSections.map((section) => String(section?.name || "").trim()).filter(Boolean);

      return Array.from(new Set([...sectionFromStudents, ...sectionFromCatalog])).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );
    },
    [sessionFilter, classFilter, studentData, academicClasses, academicSections]
  );
  const filteredAcademicSections = useMemo(() => {
    if (!selectedClassId) return [];
    return academicSections.filter(
      (section) => String(section.classId) === String(selectedClassId)
    );
  }, [academicSections, selectedClassId]);
  const addFormClassOptions = useMemo(
    () =>
      academicClasses.map((item) => ({
        id: String(item._id),
        name: item.name,
      })),
    [academicClasses]
  );
  const addFormSectionOptions = useMemo(
    () =>
      filteredAcademicSections.map((item) => ({
        id: String(item._id),
        name: item.name,
      })),
    [filteredAcademicSections]
  );
  const editFormSectionOptions = useMemo(() => {
    if (!editSelectedClassId) return [];
    return academicSections
      .filter((section) => String(section.classId) === String(editSelectedClassId))
      .map((item) => ({
        id: String(item._id),
        name: item.name,
      }));
  }, [academicSections, editSelectedClassId]);
  const editRollOptions = useMemo(() => {
    if (!editingStudent) return [];
    const targetClass = String(editingStudent.class || editingStudent.grade || "").trim();
    const targetSection = String(editingStudent.section || "").trim();
    const targetYear = String(editingStudent.academicYear || "").trim();
    const rolls = studentData
      .filter((student) => {
        const sameClass = String(student.class || student.grade || "").trim() === targetClass;
        const sameSection = String(student.section || "").trim() === targetSection;
        const sameYear = !targetYear || String(student.academicYear || "").trim() === targetYear;
        return sameClass && sameSection && sameYear;
      })
      .map((student) => Number(student.roll))
      .filter((roll) => Number.isFinite(roll) && roll > 0);

    const currentRoll = Number(editingStudent.roll);
    if (Number.isFinite(currentRoll) && currentRoll > 0) {
      rolls.push(currentRoll);
    }
    const normalized = Array.from(new Set(rolls)).sort((a, b) => a - b);
    if (normalized.length > 0) return normalized;
    return Array.from({ length: 100 }, (_, idx) => idx + 1);
  }, [editingStudent, studentData]);
  const editAcademicYearOptions = useMemo(() => {
    const catalogYears = academicYears
      .map((year) => String(year?.name || "").trim())
      .filter(Boolean);
    const currentYear = String(editingStudent?.academicYear || "").trim();

    return Array.from(
      new Set([...catalogYears, ...(currentYear ? [currentYear] : [])])
    ).sort();
  }, [academicYears, editingStudent]);
  useEffect(() => {
    setCurrentPage((prev) => {
      const next = Math.min(prev, totalPages);
      return next < 1 ? 1 : next;
    });
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sessionFilter, classFilter, sectionFilter]);

  // Refresh archived students when modal opens
  useEffect(() => {
    if (showArchiveModal) {
      refreshArchivedStudents();
    } else {
      setSelectedArchivedStudentIds([]);
    }
  }, [showArchiveModal]);

  /* -------------------- Helpers -------------------- */
  const getTodayAttendance = (student) => {
    if (!student.attendance || student.attendance.length === 0) return null;
    const today = new Date().toDateString();
    return student.attendance.find(
      (att) => new Date(att.date).toDateString() === today
    );
  };

  const getHealthStatus = (student) => {
    const healthStatuses = ["healthy", "sick", "injured", "absent-sick"];
    return (
      student.healthStatus ||
      healthStatuses[Math.floor(Math.random() * healthStatuses.length)]
    );
  };

  const getFeeStatusClass = (status) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "partial":
        return "bg-yellow-100 text-yellow-800";
      case "N/A":
        return "bg-gray-100 text-gray-600";
      case "due":
      default:
        return "bg-red-100 text-red-800";
    }
  };

  const formatCurrency = (value = 0) =>
    `₹${Number(value || 0).toLocaleString()}`;

  const getSessionLabel = useCallback(
    (academicYearId, fallback = "-") => {
      const key = String(academicYearId || "").trim();
      return academicYearNameById.get(key) || fallback;
    },
    [academicYearNameById]
  );

  const getStudentFeeSessionSummary = useCallback(
    (student) => {
      const invoices = Array.isArray(student?.feeInvoices) ? student.feeInvoices : [];
      if (!invoices.length) return null;

      const currentSessionName = String(student?.academicYear || "").trim();
      const currentSessionIds = academicYears
        .filter((year) => String(year?.name || "").trim() === currentSessionName)
        .map((year) => String(year?._id || "").trim())
        .filter(Boolean);

      const grouped = invoices.reduce((acc, invoice) => {
        const sessionKey = String(invoice?.academicYearId || "").trim() || "unassigned";
        if (!acc.has(sessionKey)) {
          acc.set(sessionKey, {
            academicYearId: invoice?.academicYearId || null,
            sessionLabel: getSessionLabel(invoice?.academicYearId, currentSessionName || "Current Session"),
            totalAmount: 0,
            paidAmount: 0,
            balanceAmount: 0,
            invoices: [],
          });
        }
        const entry = acc.get(sessionKey);
        entry.totalAmount += Number(invoice?.totalAmount || 0);
        entry.paidAmount += Number(invoice?.paidAmount || 0);
        entry.balanceAmount += Number(invoice?.balanceAmount || 0);
        entry.invoices.push(invoice);
        return acc;
      }, new Map());

      const sessionGroups = Array.from(grouped.values()).sort((a, b) => {
        const aMatch = currentSessionIds.includes(String(a.academicYearId || ""));
        const bMatch = currentSessionIds.includes(String(b.academicYearId || ""));
        if (aMatch !== bMatch) return aMatch ? -1 : 1;
        return String(a.sessionLabel || "").localeCompare(String(b.sessionLabel || ""));
      });

      return sessionGroups[0] || null;
    },
    [academicYears, getSessionLabel]
  );

  const extractLinkedStudentId = (childRef) => {
    if (!childRef) return "";
    if (typeof childRef === "string") return childRef;
    if (typeof childRef === "object") {
      return String(childRef._id || childRef.id || "");
    }
    return "";
  };

  const toDateInputValue = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

    const dayFirst = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dayFirst) {
      const day = String(dayFirst[1]).padStart(2, "0");
      const month = String(dayFirst[2]).padStart(2, "0");
      const year = dayFirst[3];
      return `${year}-${month}-${day}`;
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return "";
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getMoodIcon = (mood) => {
    const moodIcons = {
      excellent: { icon: Smile, color: "text-green-600", bg: "bg-green-100" },
      good: { icon: Smile, color: "text-blue-600", bg: "bg-blue-100" },
      neutral: { icon: Meh, color: "text-yellow-600", bg: "bg-yellow-100" },
      concerning: { icon: Frown, color: "text-orange-600", bg: "bg-orange-100" },
      critical: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-100" },
    };
    return moodIcons[mood] || moodIcons.neutral;
  };

  const getWellbeingStatus = (studentId) => {
    if (!wellbeingData[studentId]) {
      const moods = ["excellent", "good", "neutral", "concerning", "critical"];
      const mood = moods[Math.floor(Math.random() * moods.length)];
      const socialEngagement = Math.floor(Math.random() * 10) + 1;
      const academicStress = Math.floor(Math.random() * 10) + 1;
      const behaviorChanges = Math.random() > 0.7;

      setWellbeingData((prev) => ({
        ...prev,
        [studentId]: {
          mood,
          socialEngagement,
          academicStress,
          behaviorChanges,
          lastAssessment: new Date().toISOString().split("T")[0],
          notes: "",
          interventions: [],
          counselingSessions: Math.floor(Math.random() * 5),
          parentNotifications: Math.floor(Math.random() * 3),
        },
      }));
      return { mood, socialEngagement, academicStress, behaviorChanges };
    }
    return wellbeingData[studentId];
  };

  const updateWellbeingData = (studentId, updates) => {
    setWellbeingData((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        ...updates,
        lastAssessment: new Date().toISOString().split("T")[0],
      },
    }));
  };

  const openWellbeingModal = (student) => {
    setSelectedStudent(student);
    setShowWellbeingModal(true);
  };

  const getStudentsCacheKey = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) return `${STUDENTS_CACHE_PREFIX}_anonymous`;
    try {
      const base64 = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(base64));
      const adminId = payload?.id || "unknown";
      const schoolId = payload?.schoolId || "school";
      const campusId = payload?.campusId || "campus";
      return `${STUDENTS_CACHE_PREFIX}_${adminId}_${schoolId}_${campusId}`;
    } catch {
      return `${STUDENTS_CACHE_PREFIX}_fallback`;
    }
  }, []);

  const fetchParents = async () => {
    const res = await fetch(`${API_BASE}/api/admin/users/get-parents`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    if (!res.ok) {
      throw new Error("Failed to fetch parents");
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  };

  const refreshStudents = async ({ useCache = false, showLoader = false } = {}) => {
    // refreshStudents() is fired from many places (import, archive, restore,
    // edit, delete, the manual Refresh button); without this, an older call
    // that's still in flight can resolve after a newer one and silently
    // overwrite fresh data with stale data (e.g. new imports "disappearing"
    // until a hard page refresh).
    const requestToken = ++refreshRequestTokenRef.current;
    if (showLoader) setStudentsLoading(true);
    let servedFromCache = false;
    if (useCache) {
      try {
        const cachedRaw = sessionStorage.getItem(getStudentsCacheKey());
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (Array.isArray(cached?.students)) {
            setStudentData(cached.students.filter((student) => !shouldHideLeavingStudent(student)));
            setParentDirectory(Array.isArray(cached?.parents) ? cached.parents : []);
            servedFromCache = true;
            if (showLoader) setStudentsLoading(false);
          }
        }
      } catch (err) {
        console.warn("Unable to read students cache", err);
      }
    }

    try {
    const [studentsResult, parentsResult, invoicesResult] = await Promise.allSettled([
      fetch(`${API_BASE}/api/admin/users/get-students`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }).then((res) => (res.ok ? res.json() : [])),
      fetchParents(),
      fetch(`${API_BASE}/api/fees/invoices`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }).then((res) => (res.ok ? res.json() : [])),
    ]);

    // A newer refreshStudents() call started (and possibly already finished)
    // while this one was in flight — applying this stale response now would
    // clobber the fresher data, so drop it.
    if (refreshRequestTokenRef.current !== requestToken) return;

    const students =
      studentsResult.status === "fulfilled" && Array.isArray(studentsResult.value)
        ? studentsResult.value
        : [];
    const activeStudents = students.filter((student) => !shouldHideLeavingStudent(student));
    const parents = parentsResult.status === "fulfilled" ? parentsResult.value : [];
    const invoices =
      invoicesResult.status === "fulfilled" && Array.isArray(invoicesResult.value)
        ? invoicesResult.value
        : [];
    setParentDirectory(parents);

    const feeSummaryByStudentId = new Map();
    const feeInvoicesByStudentId = new Map();
    invoices.forEach((invoice) => {
      const key = String(invoice?.studentId || "");
      if (!key) return;
      const total = Number(invoice?.totalAmount || 0);
      const paid = Number(invoice?.paidAmount || 0);
      const balance = Number(invoice?.balanceAmount || 0);
      if (!feeInvoicesByStudentId.has(key)) {
        feeInvoicesByStudentId.set(key, []);
      }
      feeInvoicesByStudentId.get(key).push(invoice);
      if (!feeSummaryByStudentId.has(key)) {
        feeSummaryByStudentId.set(key, {
          totalFee: 0,
          paidAmount: 0,
          dueAmount: 0,
        });
      }
      const current = feeSummaryByStudentId.get(key);
      current.totalFee += Number.isFinite(total) ? total : 0;
      current.paidAmount += Number.isFinite(paid) ? paid : 0;
      current.dueAmount += Number.isFinite(balance) ? balance : 0;
    });

    if (!parents.length) {
      const withFees = activeStudents.map((student) => {
        const fee = feeSummaryByStudentId.get(String(student?._id || "")) || {
          totalFee: 0,
          paidAmount: 0,
          dueAmount: 0,
        };
        return {
          ...student,
          feeInvoices: feeInvoicesByStudentId.get(String(student?._id || "")) || [],
          feeSummary: {
            ...fee,
            status: fee.totalFee === 0
              ? "N/A"
              : fee.dueAmount <= 0
                ? "paid"
                : fee.paidAmount > 0
                  ? "partial"
                  : "due",
          },
        };
      });
      setStudentData(withFees);
      try {
        sessionStorage.setItem(
          getStudentsCacheKey(),
          JSON.stringify({ students: withFees, parents, cachedAt: Date.now() })
        );
      } catch (err) {
        console.warn("Unable to cache students data", err);
      }
      return;
    }

    const parentByStudentUserId = new Map();
    parents.forEach((parent) => {
      const ids = Array.isArray(parent.childrenIds) ? parent.childrenIds : [];
      ids.forEach((id) => {
        const linkedId = extractLinkedStudentId(id);
        if (linkedId) parentByStudentUserId.set(linkedId, parent);
      });
    });

    const enriched = activeStudents.map((student) => {
      const studentId = student?._id ? String(student._id) : null;
      const portalUserId = student?.studentPortalUser
        ? String(student.studentPortalUser)
        : null;
      const parent =
        (studentId && parentByStudentUserId.get(studentId)) ||
        (portalUserId && parentByStudentUserId.get(portalUserId)) ||
        null;

      const fee = feeSummaryByStudentId.get(studentId || "") || {
        totalFee: 0,
        paidAmount: 0,
        dueAmount: 0,
      };
      const feeSummary = {
        ...fee,
        status: fee.totalFee === 0
          ? "N/A"
          : fee.dueAmount <= 0
            ? "paid"
            : fee.paidAmount > 0
              ? "partial"
              : "due",
      };

      if (!parent) return { ...student, feeSummary, feeInvoices: feeInvoicesByStudentId.get(studentId || "") || [] };

      return {
        ...student,
        feeSummary,
        feeInvoices: feeInvoicesByStudentId.get(studentId || "") || [],
        parent,
        guardianName: student.guardianName || parent.name || student.guardianName,
        guardianEmail: student.guardianEmail || parent.email || student.guardianEmail,
        guardianPhone: student.guardianPhone || parent.mobile || student.guardianPhone,
      };
    });

    setStudentData(enriched);
    try {
      sessionStorage.setItem(
        getStudentsCacheKey(),
        JSON.stringify({ students: enriched, parents, cachedAt: Date.now() })
      );
    } catch (err) {
      console.warn("Unable to cache students data", err);
    }
    } finally {
      if (showLoader && !servedFromCache) setStudentsLoading(false);
    }
  };

  const handleRefreshTableData = async () => {
    if (tableRefreshing) return;
    setTableRefreshing(true);
    try {
      await refreshStudents({ useCache: false, showLoader: false });
    } catch (err) {
      console.error("Failed to refresh students table data:", err);
    } finally {
      setTableRefreshing(false);
    }
  };

  const matchedParents = useMemo(() => {
    const query = parentSearchTerm.trim().toLowerCase();
    if (!query) return [];
    return parentDirectory
      .filter((parent) => {
        const name = String(parent?.name || "").toLowerCase();
        const username = String(parent?.username || "").toLowerCase();
        const mobile = String(parent?.mobile || "").toLowerCase();
        const email = String(parent?.email || "").toLowerCase();
        return name.includes(query) || username.includes(query) || mobile.includes(query) || email.includes(query);
      })
      .slice(0, 8);
  }, [parentDirectory, parentSearchTerm]);

  const normalizeStudentForEdit = (student) => {
    if (!student) return student;
    const normalized = {
      ...student,
      class: student.class || student.grade || "",
      grade: student.grade || student.class || "",
      pincode: student.pincode || student.pinCode || "",
      permanentAddress: student.permanentAddress || "",
    };

    if (
      (!normalized.guardianName || !normalized.guardianEmail || !normalized.guardianPhone) &&
      parentDirectory.length > 0
    ) {
      const parentByStudentUserId = new Map();
      parentDirectory.forEach((parent) => {
        const ids = Array.isArray(parent.childrenIds) ? parent.childrenIds : [];
        ids.forEach((id) => {
          const linkedId = extractLinkedStudentId(id);
          if (linkedId) parentByStudentUserId.set(linkedId, parent);
        });
      });
      const studentId = normalized?._id ? String(normalized._id) : null;
      const portalUserId = normalized?.studentPortalUser
        ? String(normalized.studentPortalUser)
        : null;
      const parent =
        (studentId && parentByStudentUserId.get(studentId)) ||
        (portalUserId && parentByStudentUserId.get(portalUserId)) ||
        null;
      if (parent) {
        normalized.guardianName = normalized.guardianName || parent.name || "";
        normalized.guardianEmail = normalized.guardianEmail || parent.email || "";
        normalized.guardianPhone = normalized.guardianPhone || parent.mobile || "";
      }
    }

    return normalized;
  };

  const handleSelectExistingParent = (parent) => {
    if (!parent) {
      setSelectedExistingParent(null);
      return;
    }
    setSelectedExistingParent(parent);
    setParentSearchTerm(parent.name || parent.username || "");
    setNewStudent((prev) => ({
      ...prev,
      guardianName: prev.guardianName || parent.name || "",
      guardianEmail: prev.guardianEmail || parent.email || "",
      guardianPhone: prev.guardianPhone || parent.mobile || "",
    }));
  };

  const refreshEnrollContext = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // Only the school name needs a network call here; campusType comes from
      // the admin-profile cache that AdminApp already populated. (Re-POSTing
      // /api/admin/auth/profile on every students-page visit was hammering the
      // strict auth rate limiter.)
      const schoolsRes = await fetch(`${API_BASE}/api/schools`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        },
      });
      const schools = schoolsRes.ok ? await schoolsRes.json().catch(() => []) : [];
      const firstSchool = Array.isArray(schools) ? schools[0] || null : null;

      let campusType = "";
      try {
        for (let i = 0; i < sessionStorage.length; i += 1) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith("admin_profile_cache_v1:")) {
            const cached = JSON.parse(sessionStorage.getItem(key) || "{}");
            if (cached?.campusType) { campusType = cached.campusType; break; }
          }
        }
      } catch { /* cache is best-effort */ }

      setEnrollContext({
        schoolName: firstSchool?.name || "NIF",
        campusType,
      });
    } catch (err) {
      console.error("Failed to load school context:", err);
    }
  };

  const refreshAcademicCatalog = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const headers = {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
      };
      const [yearsRes, classesRes, sectionsRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/academic/years`, { method: "GET", headers }).then((res) =>
          res.ok ? res.json() : []
        ),
        fetch(`${API_BASE}/api/academic/classes?scope=school`, { method: "GET", headers }).then((res) =>
          res.ok ? res.json() : []
        ),
        fetch(`${API_BASE}/api/academic/sections?scope=school`, { method: "GET", headers }).then((res) =>
          res.ok ? res.json() : []
        ),
      ]);

      setAcademicYears(
        yearsRes.status === "fulfilled" && Array.isArray(yearsRes.value)
          ? yearsRes.value
          : []
      );
      setAcademicClasses(
        classesRes.status === "fulfilled" && Array.isArray(classesRes.value)
          ? [...classesRes.value].sort((a, b) =>
              String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { numeric: true, sensitivity: "base" })
            )
          : []
      );
      setAcademicSections(
        sectionsRes.status === "fulfilled" && Array.isArray(sectionsRes.value)
          ? sectionsRes.value
          : []
      );
    } catch (error) {
      console.error("Failed to load academic catalog:", error);
    }
  };

  // Fetch archived students from backend (plus their outstanding fee balance)
  const refreshArchivedStudents = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
      };
      const [res, invoicesRes] = await Promise.all([
        fetch(`${API_BASE}/api/nif/students/archived`, { method: "GET", headers }),
        fetch(`${API_BASE}/api/fees/invoices`, { method: "GET", headers }).catch(() => null),
      ]);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];

        // Sum each student's invoice balances so the "Outstanding" column
        // reflects real dues (archived docs don't carry a feeSummary).
        const dueByStudentId = new Map();
        if (invoicesRes && invoicesRes.ok) {
          const invoices = await invoicesRes.json().catch(() => []);
          (Array.isArray(invoices) ? invoices : []).forEach((invoice) => {
            const key = String(invoice?.studentId || "");
            if (!key) return;
            const balance = Number(invoice?.balanceAmount || 0);
            dueByStudentId.set(key, (dueByStudentId.get(key) || 0) + (Number.isFinite(balance) ? balance : 0));
          });
        }

        setArchivedStudents(
          list.map((student) => ({
            ...student,
            feeSummary: {
              ...(student.feeSummary || {}),
              totalDue: dueByStudentId.get(String(student?._id || "")) || 0,
            },
          }))
        );
      } else {
        const errorText = await res.text();
        console.error("Failed to fetch archived students:", res.status, errorText);
        setArchivedStudents([]);
      }
    } catch (err) {
      console.error("Error fetching archived students:", err);
      setArchivedStudents([]);
    }
  };

  /* -------------------- Effects -------------------- */
  useEffect(() => {
    setShowAdminHeader?.(true);
    refreshStudents({ useCache: true, showLoader: true }).catch(console.error);
    refreshArchivedStudents().catch(console.error);
    refreshEnrollContext().catch(console.error);
    refreshAcademicCatalog().catch(console.error);
  }, [setShowAdminHeader, getStudentsCacheKey]);

  /* -------------------- Archive Student -------------------- */
  const handleArchiveStudent = async (student) => {
    const result = await Swal.fire({
      title: "Archive Student?",
      text: `Are you sure you want to archive ${student.name}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, archive it!",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    const confirmResult = await Swal.fire({
      title: "Confirm Archive",
      text: "Would you like to add this record to archive?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, move to archive",
      cancelButtonText: "No, keep active",
    });

    if (!confirmResult.isConfirmed) return;

    setIsArchiving(true);
    try {
      const res = await fetch(`${API_BASE}/api/nif/students/${student._id}/archive`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (res.ok) {
        Swal.fire({
          title: "Archived!",
          text: `${student.name} has been moved to archive.`,
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
        await refreshStudents();
        await refreshArchivedStudents();
      } else {
        throw new Error("Failed to archive student");
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "Error!",
        text: "Failed to archive student. Please try again.",
        icon: "error",
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDeleteStudent = async (student) => {
    if (!student?._id || deletingId) return;

    const firstConfirm = await Swal.fire({
      title: "Delete student?",
      text: `This will permanently remove ${student.name}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Delete permanently",
    });
    if (!firstConfirm.isConfirmed) return;

    setDeletingId(student._id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/students/${student._id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Failed to delete student");
      }

      // Optimistic UI update so deletion feels instant.
      setStudentData((prev) =>
        prev.filter((item) => String(item?._id || item?.id) !== String(student._id))
      );

      Swal.fire({
        title: "Deleted",
        text: `${student.name} and associated fee records have been removed.`,
        icon: "success",
        timer: 1200,
        showConfirmButton: false,
      });

      // Refresh in background to keep data consistent without blocking UI.
      refreshStudents().catch(console.error);
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "Error",
        text: err.message || "Failed to delete student",
        icon: "error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleStudentSelection = (studentId) => {
    if (!studentId) return;
    const id = String(studentId);
    setSelectedStudentIds((prev) => {
      const set = new Set(prev.map((v) => String(v)));
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      return Array.from(set);
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedStudentIds((prev) => {
      const set = new Set(prev.map((v) => String(v)));
      if (isAllVisibleSelected) {
        visibleStudentIds.forEach((id) => set.delete(String(id)));
      } else {
        visibleStudentIds.forEach((id) => set.add(String(id)));
      }
      return Array.from(set);
    });
  };

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudentIds);
    }
  };

  const handleBulkDeleteStudents = async () => {
    if (!selectedStudentIds.length) return;
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Delete selected students?",
      html: `<p>This will permanently remove <strong>${selectedStudentIds.length}</strong> student(s).</p>`,
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#DC2626",
    });
    if (!confirm.isConfirmed) return;

    const total = selectedStudentIds.length;
    setIsBulkDeleting(true);
    setDeleteJob({ total, processed: 0, phase: "students", deleted: 0 });

    try {
      const startRes = await fetch(`${API_BASE}/api/admin/users/students/bulk`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ ids: selectedStudentIds }),
      });
      const startData = await startRes.json().catch(() => ({}));
      if (!startRes.ok || !startData.jobId) {
        throw new Error(startData.error || startData.message || startRes.statusText);
      }

      // Poll the server for real progress.
      const jobId = startData.jobId;
      let job;
      for (;;) {
        await new Promise((r) => setTimeout(r, 1000));
        const stRes = await fetch(`${API_BASE}/api/admin/users/students/bulk/status/${jobId}`, {
          headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (!stRes.ok) continue;
        job = await stRes.json().catch(() => null);
        if (!job) continue;
        setDeleteJob({
          total: job.total ?? total,
          processed: job.processed ?? 0,
          phase: job.phase || "students",
          deleted: job.deletedCount ?? 0,
        });
        setDeleteProgress(job.total ? Math.round(((job.processed ?? 0) / job.total) * 100) : 0);
        if (job.status === "completed" || job.status === "failed") break;
      }

      if (job.status === "failed") {
        throw new Error(job.error || "Bulk delete failed on the server.");
      }

      setSelectedStudentIds([]);
      await refreshStudents();
      Swal.fire({
        icon: "success",
        title: "Students Deleted",
        text: `${job.deletedCount || total} student(s) deleted successfully${job.deletedParents ? `, ${job.deletedParents} parent account(s) removed` : ""}.`,
        timer: 2500,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Bulk Delete Failed",
        text: err.message || "Unable to delete selected students.",
      });
    } finally {
      setIsBulkDeleting(false);
      setDeleteJob(null);
      setDeleteProgress(0);
    }
  };

  // Polls a bulk archive/restore job until it finishes, updating `bulkOpJob`
  // with real server-side progress (not a client-side fake timer).
  const pollBulkOpJob = async (statusUrl, mode) => {
    let data;
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const res = await fetch(statusUrl, {
        headers: { authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) continue;
      data = await res.json().catch(() => null);
      if (!data) continue;
      setBulkOpJob({ mode, total: data.total || 0, processed: data.processed || 0 });
      if (data.status === "completed" || data.status === "failed") break;
    }
    return data;
  };

  const handleBulkArchiveStudents = async () => {
    if (!selectedStudentIds.length || isArchiving) return;

    const confirm = await Swal.fire({
      icon: "warning",
      title: "Archive selected students?",
      html: `<p>This will move <strong>${selectedStudentIds.length}</strong> student(s) to archive.</p>`,
      showCancelButton: true,
      confirmButtonText: "Yes, Archive",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#2563EB",
    });
    if (!confirm.isConfirmed) return;

    setIsArchiving(true);
    const archivedIds = selectedStudentIds;
    try {
      const startRes = await fetch(`${API_BASE}/api/nif/students/bulk/archive`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ ids: archivedIds }),
      });
      const startData = await startRes.json().catch(() => ({}));
      if (!startRes.ok || !startData.jobId) {
        throw new Error(startData.error || startData.message || "Failed to start archive job");
      }

      setBulkOpJob({ mode: "archive", total: startData.total || archivedIds.length, processed: 0 });
      const data = await pollBulkOpJob(
        `${API_BASE}/api/nif/students/bulk/archive/status/${startData.jobId}`,
        "archive"
      );

      if (data.status === "failed") {
        throw new Error(data.error || "Archive job failed");
      }

      setSelectedStudentIds([]);
      // Drop the now-archived rows from the active table immediately; the
      // full reload (with fee/session enrichment) happens in the background.
      setStudentData((prev) => prev.filter((s) => !archivedIds.includes(String(s?._id || s?.id))));
      refreshStudents().catch(console.error);
      refreshArchivedStudents().catch(console.error);

      if (data.skipped > 0) {
        Swal.fire({
          icon: "warning",
          title: "Bulk Archive Completed",
          html: `<p><strong>${data.archived}</strong> archived, <strong>${data.skipped}</strong> skipped.</p>`,
        });
      } else {
        Swal.fire({
          icon: "success",
          title: "Students Archived",
          text: `${data.archived} student(s) archived successfully.`,
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Archive failed",
        text: err.message || "Unable to archive selected students.",
      });
    } finally {
      setIsArchiving(false);
      setBulkOpJob(null);
    }
  };

  /* -------------------- Add Student -------------------- */
  const handleAddStudentChange = (e) => {
    const { name, value } = e.target;
    setNewStudent((prev) => ({ ...prev, [name]: value }));
  };

  // Upload an enrolment document to Cloudinary; reports progress and returns the hosted URL.
  const uploadEnrollDocument = (file, onProgress) =>
    new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "nif_students");
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/api/uploads/cloudinary/single`);
      xhr.setRequestHeader("authorization", `Bearer ${localStorage.getItem("token")}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
        if (xhr.status >= 200 && xhr.status < 300 && data?.files?.[0]?.secure_url) {
          resolve(data.files[0].secure_url);
        } else {
          reject(new Error(data?.message || `Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(fd);
    });

  /* -------------------- Enrollment drafts -------------------- */
  const draftAuthHeaders = () => ({
    "Content-Type": "application/json",
    authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const loadEnrollDrafts = useCallback(async () => {
    try {
      const res = await fetch(DRAFTS_API, { headers: draftAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setEnrollDrafts(Array.isArray(data.data) ? data.data : []);
    } catch {
      /* offline / ignore */
    }
  }, []);

  const saveEnrollDraft = async ({ step, silent = false } = {}) => {
    const payload = {
      id: activeDraftId || undefined,
      label: newStudent.name?.trim() || "Untitled draft",
      className: newStudent.class || "",
      step: Number(step) || 0,
      data: {
        newStudent,
        selectedAcademicYearId,
        selectedClassId,
        selectedSectionId,
        selectedExistingParentId: selectedExistingParent?._id || null,
      },
    };
    const res = await fetch(DRAFTS_API, {
      method: "POST",
      headers: draftAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not save draft");
    if (data?.data?._id) setActiveDraftId(data.data._id);
    if (data?.data) {
      // keep the local list fresh without an extra round-trip
      setEnrollDrafts((prev) => {
        const rest = prev.filter((d) => d._id !== data.data._id);
        return [data.data, ...rest];
      });
    }
    if (!silent) await loadEnrollDrafts();
    return data.data;
  };

  const deleteEnrollDraft = async (id) => {
    setDeletingDraftId(id);
    try {
      await fetch(`${DRAFTS_API}/${id}`, { method: "DELETE", headers: draftAuthHeaders() });
    } catch {
      /* ignore */
    }
    if (activeDraftId === id) setActiveDraftId(null);
    setEnrollDrafts((prev) => prev.filter((d) => d._id !== id));
    setDeletingDraftId(null);
  };

  const resumeEnrollDraft = (draft) => {
    const d = draft?.data || {};
    setNewStudent({ ...INITIAL_NEW_STUDENT, ...(d.newStudent || {}) });
    setSelectedAcademicYearId(d.selectedAcademicYearId || "");
    setSelectedClassId(d.selectedClassId || "");
    setSelectedSectionId(d.selectedSectionId || "");
    setActiveDraftId(draft._id);
    setResumeStep(Number(draft.step) || 0);
    setEnrollSessionKey((k) => k + 1);
    setShowDraftsModal(false);
    setShowAddForm(true);
  };

  const startNewEnrollment = () => {
    editRequestTokenRef.current += 1; // invalidate any in-flight "fresh copy" fetch from a prior edit
    setNewStudent({ ...INITIAL_NEW_STUDENT });
    setSelectedAcademicYearId("");
    setSelectedClassId("");
    setSelectedSectionId("");
    setSelectedExistingParent(null);
    setParentSearchTerm("");
    setActiveDraftId(null);
    setEditingStudentId(null);
    setResumeStep(0);
    setEnrollSessionKey((k) => k + 1);
    setShowAddForm(true);
  };

  // Open the multi-step wizard pre-filled with an existing student, in edit mode.
  // Applies a normalized student record into the wizard's form + selector state.
  const applyEditSource = useCallback((src) => {
    setNewStudent((prev) => ({
      ...prev,
      ...src,
      class: src.class || src.grade || "",
      pincode: src.pincode || src.pinCode || "",
      photograph: src.photograph || src.profilePic || "",
      hasPreviousSchool: src.hasPreviousSchool || (src.previousSchoolName ? "yes" : "no"),
      guardianType: src.guardianType || "",
      status: src.status || "Active",
      approvalStatus: src.approvalStatus || "Approved",
      admissionType: src.admissionType || "New Admission",
      documents: Array.isArray(src.documents) ? src.documents : [],
    }));

    const cls = academicClasses.find((c) => String(c?.name || "").trim() === String(src.class || src.grade || "").trim());
    const yr = academicYears.find((y) => String(y?.name || "").trim() === String(src.academicYear || "").trim());
    const sec = academicSections.find(
      (x) => String(x.classId) === (cls ? String(cls._id) : "") && String(x.name || "").trim() === String(src.section || "").trim()
    );
    setSelectedAcademicYearId(yr ? String(yr._id) : "");
    setSelectedClassId(cls ? String(cls._id) : "");
    setSelectedSectionId(sec ? String(sec._id) : "");
  }, [academicClasses, academicYears, academicSections]);

  const openEditWizard = (student) => {
    if (!student?._id) return;

    // Open instantly with whatever's already on screen (the row/view data),
    // then quietly patch in a freshly-fetched copy in the background instead
    // of blocking the wizard open on a full student-list round trip.
    const src = normalizeStudentForEdit(student);
    setNewStudent({ ...INITIAL_NEW_STUDENT, ...src });
    applyEditSource(src);
    setSelectedExistingParent(null);
    setParentSearchTerm("");
    setActiveDraftId(null);
    setEditingStudentId(student._id);
    setResumeStep(0);
    setEnrollSessionKey((k) => k + 1);
    setShowViewModal(false);
    setShowAddForm(true);

    const requestToken = ++editRequestTokenRef.current;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/users/get-students`, {
          headers: { "Content-Type": "application/json", authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const fresh = Array.isArray(data) && data.find((s) => String(s?._id) === String(student._id));
        // Bail if the admin has since closed the wizard or opened a different
        // record — don't clobber whatever is on screen now.
        if (!fresh || editRequestTokenRef.current !== requestToken) return;
        applyEditSource(normalizeStudentForEdit(fresh));
      } catch { /* keep what we already showed */ }
    })();
  };

  useEffect(() => {
    loadEnrollDrafts();
  }, [loadEnrollDrafts]);

  useEffect(() => {
    if (showAddForm || showDraftsModal) loadEnrollDrafts();
  }, [showAddForm, showDraftsModal, loadEnrollDrafts]);

  // Warn before leaving while a bulk delete / import / archive / restore is running.
  useEffect(() => {
    if (!deleteJob && !isImporting && !bulkOpJob) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [deleteJob, isImporting, bulkOpJob]);

  // Lock the page behind the drafts modal so only the modal scrolls.
  useEffect(() => {
    if (!showDraftsModal) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showDraftsModal]);

  const handleAcademicClassChange = (e) => {
    const nextClassId = e.target.value;
    const selectedClass = addFormClassOptions.find(
      (item) => String(item.id) === String(nextClassId)
    );
    setSelectedClassId(nextClassId);
    setSelectedSectionId("");
    setNewStudent((prev) => ({
      ...prev,
      class: selectedClass?.name || "",
      section: "",
    }));
  };

  const handleEditClassChange = (e) => {
    const nextClassId = e.target.value;
    const selectedClass = academicClasses.find(
      (item) => String(item._id) === String(nextClassId)
    );
    setEditSelectedClassId(nextClassId);
    setEditingStudent((prev) =>
      prev
        ? {
            ...prev,
            class: selectedClass?.name || "",
            grade: selectedClass?.name || "",
            section: "",
          }
        : prev
    );
  };

  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();
    const requiredFields = [
      "name",
      "mobile",
      "gender",
      "admissionDate",
      "class",
      "section",
    ];

    const missing = requiredFields.filter(
      (f) => !newStudent[f] || String(newStudent[f]).trim() === ""
    );

    if (missing.length) {
      await Swal.fire({
        icon: "warning",
        title: "Required fields missing",
        text: `Please fill required fields: ${missing.join(", ")}`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: newStudent.name,
        email: newStudent.email,
        mobile: newStudent.mobile,
        gender: newStudent.gender,
        dob: newStudent.dob,
        address: newStudent.address,
        permanentAddress: newStudent.permanentAddress,
        pinCode: newStudent.pincode,
        birthPlace: newStudent.birthPlace,
        nationality: newStudent.nationality,
        religion: newStudent.religion,
        caste: newStudent.caste,
        category: newStudent.category,
        profilePic: newStudent.photograph,
        guardianName: newStudent.guardianName,
        guardianPhone: newStudent.guardianPhone,
        guardianEmail: newStudent.guardianEmail,
        guardianRelation: newStudent.guardianRelation,
        admissionNumber: newStudent.admissionNumber,
        admissionDate: newStudent.admissionDate,
        admissionType: newStudent.admissionType,
        roll: newStudent.roll,
        grade: newStudent.class,
        section: newStudent.section,
        academicYear: newStudent.academicYear,
        serialNo: newStudent.serialNo,
        status: newStudent.status,
        applicationId: newStudent.applicationId,
        applicationDate: newStudent.applicationDate,
        approvalStatus: newStudent.approvalStatus,
        hasPreviousSchool: newStudent.hasPreviousSchool,
        previousSchoolName: newStudent.previousSchoolName,
        previousClass: newStudent.previousClass,
        previousPercentage: newStudent.previousPercentage,
        transferCertificateNo: newStudent.transferCertificateNo,
        transferCertificateDate: newStudent.transferCertificateDate,
        reasonForLeaving: newStudent.reasonForLeaving,
        bloodGroup: newStudent.bloodGroup,
        fatherName: newStudent.fatherName,
        fatherPhone: newStudent.fatherPhone,
        fatherOccupation: newStudent.fatherOccupation,
        motherName: newStudent.motherName,
        motherPhone: newStudent.motherPhone,
        motherOccupation: newStudent.motherOccupation,
        knownHealthIssues: newStudent.knownHealthIssues,
        allergies: newStudent.allergies,
        immunizationStatus: newStudent.immunizationStatus,
        learningDisabilities: newStudent.learningDisabilities,
        aadharNumber: newStudent.aadharNumber,
        birthCertificateNo: newStudent.birthCertificateNo,
        documents: Array.isArray(newStudent.documents) ? newStudent.documents : [],
        remarks: newStudent.remarks,
      };

      payload.academicYearId = selectedAcademicYearId;
      payload.classId = selectedClassId;
      payload.sectionId = selectedSectionId;

      // ── Edit mode: update the existing student instead of registering a new one ──
      if (editingStudentId) {
        payload.grade = newStudent.class;
        const upd = await fetch(`${API_BASE}/api/admin/users/students/${editingStudentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${localStorage.getItem("token")}` },
          body: JSON.stringify(payload),
        });
        const updData = await upd.json().catch(() => ({}));
        if (!upd.ok) {
          await Swal.fire({ icon: "error", title: "Update failed", text: updData.error || updData.message || upd.statusText });
          return;
        }
        await refreshStudents();
        setShowAddForm(false);
        setEditingStudentId(null);
        await Swal.fire({ icon: "success", title: "Student updated", timer: 1800, showConfirmButton: false });
        return;
      }

      const res = await fetch(`${API_BASE}/api/student/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Registration failed",
          text: data.error || data.message || res.statusText,
        });
        return;
      }
      const studentId = data.studentCode || data.username || data.userId || "Generated";
      const studentPassword = data.password || "";
      const parentId = data?.parentCredentials?.userId || "";
      const parentPassword = data?.parentCredentials?.password || "";
      const admissionNo = data.admissionNumber || "";
      const rollNo = data.roll ?? "";
      const applicationNo = data.applicationId || "";
      Swal.fire({
        icon: "success",
        title: "Student enrolled successfully!",
        html: `
          <div class="text-left space-y-2">
          <div><strong>Student ID:</strong> ${escapeHtml(studentId)}</div>
          ${applicationNo ? `<div><strong>Application ID:</strong> ${escapeHtml(applicationNo)}</div>` : ""}
          ${admissionNo ? `<div><strong>Admission Number:</strong> ${escapeHtml(admissionNo)}</div>` : ""}
          ${rollNo !== "" ? `<div><strong>Roll Number:</strong> ${escapeHtml(String(rollNo))}</div>` : ""}
          ${studentPassword ? `<div><strong>Student Password:</strong> ${escapeHtml(studentPassword)}</div>` : ""}
          ${parentId ? `<div><strong>Parent ID:</strong> ${escapeHtml(parentId)}</div>` : ""}
          ${parentPassword ? `<div><strong>Parent Password:</strong> ${escapeHtml(parentPassword)}</div>` : ""}
          </div>
        `,
        confirmButtonColor: "#EAB308",
      });

      await refreshStudents();

      // enrollment succeeded — drop the draft it came from (if any)
      if (activeDraftId) {
        await deleteEnrollDraft(activeDraftId);
        setActiveDraftId(null);
      }

      setShowAddForm(false);
      setParentSearchTerm("");
      setSelectedExistingParent(null);
      setSelectedAcademicYearId("");
      setSelectedClassId("");
      setSelectedSectionId("");
      setNewStudent({
        name: "",
        email: "",
        mobile: "",
        gender: "",
        dob: "",
        address: "",
        pincode: "",
        status: "Active",
        guardianName: "",
        guardianEmail: "",
        guardianPhone: "",
        serialNo: "",
        batchCode: "",
        admissionDate: "",
        roll: "",
        grade: "",
        section: "",
        course: "",
        courseId: "",
        duration: "",
        formNo: "",
        enrollmentNo: "",
      });
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: "error",
        title: "Unable to add student",
        text: err.message || "Something went wrong",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudentCredentialProvision = async (student, credentials) => {
    if (!student?._id) {
      Swal.fire({
        icon: "warning",
        title: "Student not saved",
        text: "Please save the student before generating credentials.",
      });
      return;
    }

    setCredentialLoadingId(student._id);
    try {
      const res = await fetch(`${API_BASE}/api/student/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          username: credentials.id,
          password: credentials.password,
          studentId: student._id,
          nifId: student.serialNo,
          name: student.name,
          email: student.email,
          mobile: student.mobile,
          grade: student.grade,
          section: student.section,
          batchCode: student.batchCode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error || data.message || res.statusText || "Failed to issue credentials"
        );
      }
      const loginId = data.studentCode || data.username || credentials.id;
      const loginPassword = data.password || credentials.password;
      setCredentialStatus((prev) => ({ ...prev, [student._id]: "active" }));
      Swal.fire({
        icon: "success",
        title: "Credentials Issued Successfully",
        html: `
          <div class="text-left space-y-4">
            <p class="text-gray-700 mb-4"><strong>${escapeHtml(student.name)}</strong> can now log in with these credentials:</p>

            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
              <div>
                <p class="text-xs font-semibold text-yellow-700 uppercase mb-1">Student ID</p>
                <div class="flex items-center justify-between bg-white rounded px-3 py-2 border border-yellow-100">
                  <code class="text-sm font-mono text-gray-800" id="swal-cred-id">${escapeHtml(loginId)}</code>
                  <button
                    onclick="navigator.clipboard.writeText(document.getElementById('swal-cred-id').textContent)"
                    class="text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded"
                    title="Copy ID"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <p class="text-xs font-semibold text-yellow-700 uppercase mb-1">Password</p>
                <div class="flex items-center justify-between bg-white rounded px-3 py-2 border border-yellow-100">
                  <code class="text-sm font-mono text-gray-800" id="swal-cred-pw">${escapeHtml(loginPassword)}</code>
                  <button
                    onclick="navigator.clipboard.writeText(document.getElementById('swal-cred-pw').textContent)"
                    class="text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded"
                    title="Copy Password"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <p class="text-xs text-gray-500 mt-3">⚠️ Please save these credentials securely. Share them with the student.</p>
          </div>
        `,
        width: "600px",
        showConfirmButton: true,
        confirmButtonText: "Done",
        confirmButtonColor: "#EAB308",
      });
    } catch (err) {
      console.error(err);
      setCredentialStatus((prev) => ({ ...prev, [student._id]: "error" }));
      Swal.fire({
        icon: "error",
        title: "Credential Error",
        text: err.message || "Unable to generate credentials",
      });
    } finally {
      setCredentialLoadingId(null);
    }
  };

  const handleResetStudentCredentials = async (student) => {
    if (!student?._id) return;
    const studentName = escapeHtml(student.name || "this student");
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Reset Student Credentials?",
      html: `<p>This will generate a new temporary password for <strong>${studentName}</strong>.<br/>The student must use it to log in and will be prompted to change it.</p>`,
      showCancelButton: true,
      confirmButtonText: "Yes, Reset",
      confirmButtonColor: "#EAB308",
      cancelButtonText: "Cancel",
    });
    if (!confirm.isConfirmed) return;

    setCredentialLoadingId(student._id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/password-reset/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ role: "student", userId: student._id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || res.statusText || "Failed to reset credentials");
      }
      const loginId = data.loginId || student.username || student.studentCode || "-";
      const newPassword = data.password || "-";
      Swal.fire({
        icon: "success",
        title: "Credentials Reset",
        html: `
          <div class="text-left space-y-4">
            <p class="text-gray-700 mb-4">New temporary credentials for <strong>${studentName}</strong>:</p>
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
              <div>
                <p class="text-xs font-semibold text-yellow-700 uppercase mb-1">Student ID</p>
                <div class="flex items-center justify-between bg-white rounded px-3 py-2 border border-yellow-100">
                  <code class="text-sm font-mono text-gray-800" id="swal-rst-id">${escapeHtml(loginId)}</code>
                  <button onclick="navigator.clipboard.writeText(document.getElementById('swal-rst-id').textContent)" class="text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded">Copy</button>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-yellow-700 uppercase mb-1">New Password</p>
                <div class="flex items-center justify-between bg-white rounded px-3 py-2 border border-yellow-100">
                  <code class="text-sm font-mono text-gray-800" id="swal-rst-pw">${escapeHtml(newPassword)}</code>
                  <button onclick="navigator.clipboard.writeText(document.getElementById('swal-rst-pw').textContent)" class="text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded">Copy</button>
                </div>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-3">⚠️ Share these credentials securely. The student should change their password after logging in.</p>
          </div>
        `,
        width: "600px",
        confirmButtonText: "Done",
        confirmButtonColor: "#EAB308",
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Reset Failed",
        text: err.message || "Unable to reset credentials",
      });
    } finally {
      setCredentialLoadingId(null);
    }
  };

  const CRED_ICON_EYE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const CRED_ICON_EYE_OFF = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';
  const CRED_ICON_COPY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
  const CRED_ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const CRED_ICON_X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  const buildCredentialPasswordBlock = (label, resetAt, rawPassword, idPrefix) => {
    if (resetAt) {
      const message = `Password reset by the user at ${resetAt.toLocaleString()}`;
      return {
        html: `
          <div>
            <div class="text-xs font-semibold text-gray-500 uppercase">${escapeHtml(label)}</div>
            <div class="text-sm text-gray-600 mt-1">${escapeHtml(message)}</div>
          </div>
        `,
        wire: () => {},
      };
    }
    if (!rawPassword) {
      return {
        html: `
          <div>
            <div class="text-xs font-semibold text-gray-500 uppercase">${escapeHtml(label)}</div>
            <div class="text-sm text-gray-400 mt-1">Not available</div>
          </div>
        `,
        wire: () => {},
      };
    }
    const valueId = `swal-${idPrefix}-value`;
    const toggleId = `swal-${idPrefix}-toggle`;
    const copyId = `swal-${idPrefix}-copy`;
    const toggleBtnClass = "inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 active:scale-95 transition-all";
    const copyBtnBaseClasses = ["border-gray-200", "bg-gray-50", "text-gray-600", "hover:bg-gray-100"];
    const copyBtnSuccessClasses = ["border-emerald-200", "bg-emerald-50", "text-emerald-600"];
    const copyBtnClass = `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold active:scale-95 transition-all ${copyBtnBaseClasses.join(" ")}`;
    return {
      html: `
        <div>
          <div class="text-xs font-semibold text-gray-500 uppercase">${escapeHtml(label)}</div>
          <div class="flex items-center gap-2 mt-1.5">
            <div class="font-mono text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 min-w-30" id="${valueId}" data-visible="false">••••••••</div>
            <button type="button" id="${toggleId}" class="${toggleBtnClass}">${CRED_ICON_EYE}<span>Show</span></button>
            <button type="button" id="${copyId}" class="${copyBtnClass}">${CRED_ICON_COPY}<span>Copy</span></button>
          </div>
        </div>
      `,
      wire: () => {
        const valueEl = document.getElementById(valueId);
        const toggleBtn = document.getElementById(toggleId);
        const copyBtn = document.getElementById(copyId);
        if (!valueEl || !toggleBtn || !copyBtn) return;
        toggleBtn.addEventListener("click", () => {
          const nowVisible = valueEl.dataset.visible !== "true";
          valueEl.textContent = nowVisible ? rawPassword : "••••••••";
          valueEl.dataset.visible = nowVisible ? "true" : "false";
          toggleBtn.innerHTML = nowVisible
            ? `${CRED_ICON_EYE_OFF}<span>Hide</span>`
            : `${CRED_ICON_EYE}<span>Show</span>`;
        });
        copyBtn.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(rawPassword);
            copyBtn.innerHTML = `${CRED_ICON_CHECK}<span>Copied!</span>`;
            copyBtn.classList.remove(...copyBtnBaseClasses);
            copyBtn.classList.add(...copyBtnSuccessClasses);
            setTimeout(() => {
              copyBtn.innerHTML = `${CRED_ICON_COPY}<span>Copy</span>`;
              copyBtn.classList.remove(...copyBtnSuccessClasses);
              copyBtn.classList.add(...copyBtnBaseClasses);
            }, 1500);
          } catch {
            copyBtn.innerHTML = `${CRED_ICON_X}<span>Failed</span>`;
          }
        });
      },
    };
  };

  const handleViewStudentCredentials = (student) => {
    if (!student) return;
    const loginId = student.username || student.studentCode || "-";
    const studentResetAt = student.lastLoginAt ? new Date(student.lastLoginAt) : null;
    const linkedParent =
      student.parent ||
      parentDirectory.find((p) => {
        const ids = Array.isArray(p.childrenIds) ? p.childrenIds : [];
        return ids.some((id) => extractLinkedStudentId(id) === String(student._id || ""));
      }) ||
      null;
    const parent = linkedParent;
    const parentId = parent?.username || parent?.userId || "-";
    const parentResetAt = parent?.lastLoginAt ? new Date(parent.lastLoginAt) : null;

    const studentBlock = buildCredentialPasswordBlock("Password", studentResetAt, student.initialPassword, "spw");
    const parentBlock = buildCredentialPasswordBlock("Parent Password", parentResetAt, parent?.initialPassword, "ppw");

    Swal.fire({
      icon: "info",
      title: "Student Credentials",
      html: `
        <div class="text-left space-y-3">
          <div>
            <div class="text-xs font-semibold text-gray-500 uppercase">Student ID</div>
            <div class="font-mono text-sm text-gray-900">${escapeHtml(loginId)}</div>
          </div>
          ${studentBlock.html}
          <div class="pt-2 border-t border-gray-200"></div>
          <div>
            <div class="text-xs font-semibold text-gray-500 uppercase">Parent ID</div>
            <div class="font-mono text-sm text-gray-900">${escapeHtml(parentId)}</div>
          </div>
          ${parentBlock.html}
        </div>
      `,
      confirmButtonColor: "#EAB308",
      didOpen: () => {
        studentBlock.wire();
        parentBlock.wire();
      },
    });
  };

  const handleBulkCredentialGeneration = async () => {
    // Get students without portal access
    const studentsWithoutPortal = studentData.filter(
      (student) => !student.studentPortalUser && student.status === "Active"
    );

    if (studentsWithoutPortal.length === 0) {
      Swal.fire({
        icon: "info",
        title: "No Students Found",
        text: "All active students already have portal credentials.",
      });
      return;
    }

    const result = await Swal.fire({
      icon: "question",
      title: "Generate Credentials for All Students",
      html: `
        <p>This will generate portal credentials for <strong>${studentsWithoutPortal.length}</strong> students.</p>
        <p class="text-sm text-gray-600 mt-2">Credentials will be automatically generated and exported to CSV.</p>
      `,
      showCancelButton: true,
      confirmButtonText: "Generate & Export",
      confirmButtonColor: "#EAB308",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    setIsBulkGenerating(true);

    const credentialsList = [];
    const errors = [];

    // Show progress
    Swal.fire({
      title: "Generating Credentials",
      html: `<div>Processing: <strong>0</strong> / ${studentsWithoutPortal.length}</div>`,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    for (let i = 0; i < studentsWithoutPortal.length; i++) {
      const student = studentsWithoutPortal[i];

      // Update progress
      Swal.update({
        html: `<div>Processing: <strong>${i + 1}</strong> / ${studentsWithoutPortal.length}</div>
               <div class="text-sm text-gray-600 mt-2">${escapeHtml(student.name)}</div>`,
      });

      try {
        // Generate credentials using the credential generator logic
        const admissionYear = student.admissionDate
          ? new Date(student.admissionDate).getFullYear()
          : new Date().getFullYear();

        const batchCodeValue = student.batchCode || "GEN";
        const sanitizedBatch = batchCodeValue
          .toString()
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase();
        const year = admissionYear.toString().slice(-2);
        const random = Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0");
        const username = `STU-${year}${sanitizedBatch}-${random}`;

        // Generate password
        const generatePassword = () => {
          const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
          const lowercase = "abcdefghjkmnpqrstuvwxyz";
          const numbers = "0123456789";
          const symbols = "!@#$%&*?";
          const allChars = `${uppercase}${lowercase}${numbers}${symbols}`;

          let password = "";
          password += uppercase[Math.floor(Math.random() * uppercase.length)];
          password += lowercase[Math.floor(Math.random() * lowercase.length)];
          password += numbers[Math.floor(Math.random() * numbers.length)];
          password += symbols[Math.floor(Math.random() * symbols.length)];

          while (password.length < 10) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
          }

          // Shuffle
          return password
            .split("")
            .sort(() => Math.random() - 0.5)
            .join("");
        };

        const password = generatePassword();

        // Send to backend
        const res = await fetch(`${API_BASE}/api/student/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            username,
            password,
            studentId: student._id,
            nifId: student.serialNo,
            name: student.name,
            email: student.email,
            mobile: student.mobile,
            grade: student.grade,
            section: student.section,
            batchCode: student.batchCode,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || data.message || "Failed to generate credentials");
        }
        const loginId = data.studentCode || data.username || username;
        const loginPassword = data.password || password;

        // Store credentials for CSV export
        credentialsList.push({
          serialNo: student.serialNo || "",
          name: student.name,
          batchCode: student.batchCode,
          grade: student.grade,
          section: student.section,
          roll: student.roll,
          mobile: student.mobile,
          email: student.email,
          username: loginId,
          password: loginPassword,
        });

        setCredentialStatus((prev) => ({ ...prev, [student._id]: "active" }));
      } catch (error) {
        console.error(`Error generating credentials for ${student.name}:`, error);
        errors.push({
          student: student.name,
          error: error.message,
        });
      }
    }

    setIsBulkGenerating(false);

    // Export to CSV
    if (credentialsList.length > 0) {
      exportCredentialsToCSV(credentialsList);
    }

    // Refresh student data
    await refreshStudents();

    // Show results
    const successCount = credentialsList.length;
    const errorCount = errors.length;

    let resultHtml = `<p><strong>${successCount}</strong> credentials generated successfully.</p>`;

    if (errorCount > 0) {
      resultHtml += `<p class="text-red-600 mt-2"><strong>${errorCount}</strong> failed.</p>`;
      resultHtml += `<div class="text-left mt-3 max-h-40 overflow-y-auto text-sm">`;
      errors.forEach((err) => {
        resultHtml += `<div class="mb-1">• ${err.student}: ${err.error}</div>`;
      });
      resultHtml += `</div>`;
    }

    if (successCount > 0) {
      resultHtml += `<p class="text-sm text-gray-600 mt-3">✓ Credentials exported to CSV file</p>`;
    }

    Swal.fire({
      icon: successCount > 0 ? "success" : "error",
      title: "Bulk Credential Generation Complete",
      html: resultHtml,
      confirmButtonColor: "#EAB308",
    });
  };

  const exportCredentialsToCSV = (credentialsList) => {
    // Create CSV header
    const headers = [
      "Serial No",
      "Student Name",
      "Batch Code",
      "Grade",
      "Section",
      "Roll",
      "Mobile",
      "Email",
      "Portal ID",
      "Portal Password",
    ];

    // Create CSV rows
    const rows = credentialsList.map((cred) => [
      cred.serialNo,
      cred.name,
      cred.batchCode,
      cred.grade,
      cred.section,
      cred.roll,
      cred.mobile,
      cred.email,
      cred.username,
      cred.password,
    ]);

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const cellStr = String(cell || "");
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(",")
      )
      .join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `student_credentials_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent || !editingStudent._id) return;

    setIsUpdating(true);
    try {
      const payload = {
        name: editingStudent.name,
        email: editingStudent.email,
        mobile: editingStudent.mobile,
        gender: (editingStudent.gender || "").toLowerCase(),
        dob: editingStudent.dob,
        address: editingStudent.address,
        permanentAddress: editingStudent.permanentAddress,
        pinCode: editingStudent.pincode || editingStudent.pinCode,
        birthPlace: editingStudent.birthPlace,
        nationality: editingStudent.nationality,
        religion: editingStudent.religion,
        caste: editingStudent.caste,
        category: editingStudent.category,
        profilePic: editingStudent.profilePic,
        admissionNumber: editingStudent.admissionNumber,
        roll: editingStudent.roll,
        grade: editingStudent.class || editingStudent.grade,
        section: editingStudent.section,
        admissionDate: editingStudent.admissionDate,
        academicYear: editingStudent.academicYear,
        serialNo: editingStudent.serialNo,
        status: editingStudent.status,
        applicationId: editingStudent.applicationId,
        applicationDate: editingStudent.applicationDate,
        approvalStatus: editingStudent.approvalStatus,
        previousSchoolName: editingStudent.previousSchoolName,
        previousClass: editingStudent.previousClass,
        previousPercentage: editingStudent.previousPercentage,
        transferCertificateNo: editingStudent.transferCertificateNo,
        transferCertificateDate: editingStudent.transferCertificateDate,
        reasonForLeaving: editingStudent.reasonForLeaving,
        bloodGroup: editingStudent.bloodGroup,
        fatherName: editingStudent.fatherName,
        fatherPhone: editingStudent.fatherPhone,
        fatherOccupation: editingStudent.fatherOccupation,
        motherName: editingStudent.motherName,
        motherPhone: editingStudent.motherPhone,
        motherOccupation: editingStudent.motherOccupation,
        guardianName: editingStudent.guardianName,
        guardianPhone: editingStudent.guardianPhone,
        guardianEmail: editingStudent.guardianEmail,
        knownHealthIssues: editingStudent.knownHealthIssues,
        allergies: editingStudent.allergies,
        immunizationStatus: editingStudent.immunizationStatus,
        learningDisabilities: editingStudent.learningDisabilities,
        aadharNumber: editingStudent.aadharNumber,
        birthCertificateNo: editingStudent.birthCertificateNo,
        remarks: editingStudent.remarks,
      };
      payload.academicYearId = editSelectedAcademicYearId;
      payload.classId = editSelectedClassId;
      payload.sectionId = editSelectedSectionId;
      const res = await fetch(
        `${API_BASE}/api/admin/users/students/${editingStudent._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) {
        await refreshStudents();
        setShowDetailModal(false);
        setEditingStudent(null);
        setEditSelectedClassId("");
        setEditSelectedAcademicYearId("");
        setEditSelectedSectionId("");
        Swal.fire({
          title: "Success!",
          text: "Student details updated successfully",
          icon: "success",
          timer: 2000,
        });
      } else {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update student");
      }
    } catch (err) {
      Swal.fire({
        title: "Error",
        text: err.message || "Failed to update student",
        icon: "error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const loadStudentForEdit = async (student) => {
    if (!student?._id) return;
    const normalizedStudent = normalizeStudentForEdit(student);
    setEditingStudent(normalizedStudent);
    const matchedClass = academicClasses.find(
      (item) =>
        String(item?.name || "").trim() ===
        String(normalizedStudent?.class || normalizedStudent?.grade || "").trim()
    );
    setEditSelectedClassId(matchedClass ? String(matchedClass._id) : "");
    const matchedYear = academicYears.find((y) => String(y.name).trim() === String(normalizedStudent.academicYear || "").trim());
    setEditSelectedAcademicYearId(matchedYear ? String(matchedYear._id) : "");
    const matchedSection = academicSections.find(
      (s) =>
        String(s.classId) === (matchedClass ? String(matchedClass._id) : "") &&
        String(s.name || "").trim() === String(normalizedStudent.section || "").trim()
    );
    setEditSelectedSectionId(matchedSection ? String(matchedSection._id) : "");
    setShowDetailModal(true);

    try {
      const res = await fetch(`${API_BASE}/api/admin/users/get-students`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      const fresh = data.find((s) => String(s?._id) === String(student._id));
      if (fresh) {
        const normalizedFresh = normalizeStudentForEdit(fresh);
        setEditingStudent(normalizedFresh);
        const matchedFreshClass = academicClasses.find(
          (item) =>
            String(item?.name || "").trim() ===
            String(normalizedFresh?.class || normalizedFresh?.grade || "").trim()
        );
        setEditSelectedClassId(matchedFreshClass ? String(matchedFreshClass._id) : "");
        const freshMatchedYear = academicYears.find((y) => String(y.name).trim() === String(normalizedFresh.academicYear || "").trim());
        setEditSelectedAcademicYearId(freshMatchedYear ? String(freshMatchedYear._id) : "");
        const freshMatchedSection = academicSections.find(
          (s) =>
            String(s.classId) === (matchedFreshClass ? String(matchedFreshClass._id) : "") &&
            String(s.name || "").trim() === String(normalizedFresh.section || "").trim()
        );
        setEditSelectedSectionId(freshMatchedSection ? String(freshMatchedSection._id) : "");
      }
    } catch (err) {
      console.error("Failed to fetch student details:", err);
    }
  };

  useEffect(() => {
    if (!editingStudent || !academicClasses.length) return;
    const className = String(editingStudent.class || editingStudent.grade || "").trim();
    const matchedClass = academicClasses.find(
      (item) => String(item?.name || "").trim() === className
    );
    if (matchedClass) {
      setEditSelectedClassId(String(matchedClass._id));
      const sectionName = String(editingStudent.section || "").trim();
      const yearName = String(editingStudent.academicYear || "").trim();
      if (yearName) {
        const matchedYear = academicYears.find((y) => String(y.name).trim() === yearName);
        if (matchedYear) setEditSelectedAcademicYearId(String(matchedYear._id));
      }
      if (sectionName) {
        const matchedSection = academicSections.find(
          (s) => String(s.classId) === String(matchedClass._id) && String(s.name || "").trim() === sectionName
        );
        if (matchedSection) setEditSelectedSectionId(String(matchedSection._id));
      }
    }
  }, [editingStudent, academicClasses, academicYears, academicSections]);

  const openViewModal = useCallback(async (student) => {
    if (!student?._id) return;
    const normalized = normalizeStudentForEdit(student);
    setViewStudent(normalized);
    setShowViewModal(true);
    setViewTab("overview");
    setViewAttendance([]);
    setViewFees([]);
    setViewParent(null);
    setFeeSession("");
    setLoadingViewData(true);

    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
    };

    try {
      const [attendanceRes, feesRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/attendance/admin/students?studentId=${student._id}`, { headers }),
        fetch(`${API_BASE}/api/fees/invoices?studentId=${student._id}`, { headers }),
      ]);

      if (attendanceRes.status === "fulfilled" && attendanceRes.value.ok) {
        const attData = await attendanceRes.value.json();
        let records = [];

        // New admin attendance shape: { students: [{ attendanceByDate: {...}, selectedDateRecord: {...} }] }
        if (Array.isArray(attData?.students)) {
          const studentAttendance = attData.students.find(
            (item) => String(item?._id) === String(student._id)
          );
          if (studentAttendance?.attendanceByDate && typeof studentAttendance.attendanceByDate === "object") {
            records = Object.values(studentAttendance.attendanceByDate);
          }
        } else if (Array.isArray(attData)) {
          // Legacy array shape fallback
          records = attData.flatMap((s) => s.attendance || []);
        } else if (Array.isArray(attData?.attendance)) {
          // Legacy object shape fallback
          records = attData.attendance;
        }

        // Final fallback: use attendance already present on the selected student payload.
        if ((!records || records.length === 0) && Array.isArray(normalized?.attendance)) {
          records = normalized.attendance;
        }

        setViewAttendance(Array.isArray(records) ? records : []);
      }

      if (feesRes.status === "fulfilled" && feesRes.value.ok) {
        const feeData = await feesRes.value.json();
        setViewFees(Array.isArray(feeData) ? feeData : []);
      }

      // Find linked parent
      if (parentDirectory.length > 0) {
        const linked = parentDirectory.find((p) => {
          const ids = Array.isArray(p.childrenIds) ? p.childrenIds : [];
          return ids.some((id) => extractLinkedStudentId(id) === String(student._id));
        });
        if (linked) setViewParent(linked);
      }
    } catch (err) {
      console.error("Failed to load view data:", err);
    } finally {
      setLoadingViewData(false);
    }
  }, [parentDirectory]);

  const handleUnarchiveStudent = async (studentId) => {
    if (!studentId) return;
    const confirm = await Swal.fire({
      icon: "question",
      title: "Restore student?",
      text: "This will move the student back to active records.",
      showCancelButton: true,
      confirmButtonText: "Yes, Restore",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#16A34A",
    });
    if (!confirm.isConfirmed) return;
    try {
      setArchiveActionLoading(true);
      setRestoringStudentId(String(studentId));
      const res = await fetch(
        `${API_BASE}/api/nif/students/${studentId}/unarchive`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to restore student");
      }
      // Drop it from the archived list immediately instead of waiting on a
      // full students+parents+invoices reload — that round trip happens in
      // the background and is what made restoring feel slow before.
      setArchivedStudents((prev) => prev.filter((s) => String(s?._id) !== String(studentId)));
      Swal.fire({
        icon: "success",
        title: "Student restored",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 1500,
      });
      refreshStudents().catch(console.error);
      refreshArchivedStudents().catch(console.error);
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: "error",
        title: "Unable to restore student",
        text: err.message || "Please try again",
      });
    } finally {
      setArchiveActionLoading(false);
      setRestoringStudentId(null);
    }
  };

  const toggleArchivedStudentSelection = (studentId) => {
    if (!studentId) return;
    const id = String(studentId);
    setSelectedArchivedStudentIds((prev) => {
      const set = new Set(prev.map((value) => String(value)));
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      return Array.from(set);
    });
  };

  const toggleSelectAllArchived = () => {
    const archivedIds = archivedStudents
      .map((student) => String(student?._id || ""))
      .filter(Boolean);
    setSelectedArchivedStudentIds((prev) => {
      const set = new Set(prev.map((value) => String(value)));
      const allSelected =
        archivedIds.length > 0 && archivedIds.every((id) => set.has(id));
      if (allSelected) {
        archivedIds.forEach((id) => set.delete(id));
      } else {
        archivedIds.forEach((id) => set.add(id));
      }
      return Array.from(set);
    });
  };

  const handleBulkUnarchiveStudents = async () => {
    if (!selectedArchivedStudentIds.length || archiveActionLoading) return;

    const confirm = await Swal.fire({
      icon: "question",
      title: "Restore selected students?",
      html: `<p>This will restore <strong>${selectedArchivedStudentIds.length}</strong> student(s).</p>`,
      showCancelButton: true,
      confirmButtonText: "Yes, Restore",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#16A34A",
    });
    if (!confirm.isConfirmed) return;

    setArchiveActionLoading(true);
    const restoreIds = selectedArchivedStudentIds;
    try {
      const startRes = await fetch(`${API_BASE}/api/nif/students/bulk/unarchive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ ids: restoreIds }),
      });
      const startData = await startRes.json().catch(() => ({}));
      if (!startRes.ok || !startData.jobId) {
        throw new Error(startData.error || startData.message || "Failed to start restore job");
      }

      setBulkOpJob({ mode: "restore", total: startData.total || restoreIds.length, processed: 0 });
      const data = await pollBulkOpJob(
        `${API_BASE}/api/nif/students/bulk/unarchive/status/${startData.jobId}`,
        "restore"
      );

      if (data.status === "failed") {
        throw new Error(data.error || "Restore job failed");
      }

      setSelectedArchivedStudentIds([]);
      // Drop the restored rows immediately; reconcile fully in the background
      // instead of blocking the UI on a full students+parents+invoices reload.
      setArchivedStudents((prev) => prev.filter((s) => !restoreIds.includes(String(s?._id))));
      refreshStudents().catch(console.error);
      refreshArchivedStudents().catch(console.error);

      if (data.skipped > 0) {
        Swal.fire({
          icon: "warning",
          title: "Bulk Restore Completed",
          html: `<p><strong>${data.restored}</strong> restored, <strong>${data.skipped}</strong> skipped.</p>`,
        });
      } else {
        Swal.fire({
          icon: "success",
          title: "Students restored",
          text: `${data.restored} student(s) restored successfully.`,
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Restore failed",
        text: err.message || "Failed to restore selected students",
      });
    } finally {
      setArchiveActionLoading(false);
      setBulkOpJob(null);
    }
  };

  /* -------------------- Bulk Upload -------------------- */
  // These match the required fields in the manual "Add Student" form
  // Simple normalization - remove spaces, underscores, hyphens and lowercase
  const normalize = (h) => h?.toString().trim().toLowerCase().replace(/[\s_-]+/g, '');

  // Map Excel column headers to model field names (case-insensitive, flexible)
  const COLUMN_MAP = {
    // Core fields
    'name': 'name',
    'studentname': 'name',
    'fullname': 'name',
    'studentfullname': 'name',
    'mobile': 'mobile',
    'mobileno': 'mobile',
    'mobilenumber': 'mobile',
    'phone': 'mobile',
    'phoneno': 'mobile',
    'phonenumber': 'mobile',
    'contact': 'mobile',
    'contactno': 'mobile',
    'contactnumber': 'mobile',
    'whatsapp': 'mobile',
    'email': 'email',
    'emailid': 'email',
    'emailaddress': 'email',
    'mail': 'email',
    'mailid': 'email',
    'gender': 'gender',
    'sex': 'gender',
    'dob': 'dob',
    'dateofbirth': 'dob',
    'birthdate': 'dob',

    // Address
    'address': 'address',
    'address1': 'address',
    'residence': 'address',
    'residentialaddress': 'address',
    'presentaddress': 'address',
    'currentaddress': 'address',
    'pincode': 'pincode',
    'pin': 'pincode',
    'zipcode': 'pincode',
    'postalcode': 'pincode',
    'postcode': 'pincode',

    // Academic
    'batchcode': 'batchCode',
    'batch': 'batchCode',
    'session': 'batchCode',
    'academicyear': 'batchCode',
    'batchid': 'batchCode',
    'admissiondate': 'admissionDate',
    'admission': 'admissionDate',
    'dateofadmission': 'admissionDate',
    'doa': 'admissionDate',
    'roll': 'roll',
    'rollno': 'roll',
    'rollnumber': 'roll',
    'admissionno': 'roll',
    'section': 'section',
    'sec': 'section',
    'division': 'section',
    'course': 'class',
    'coursename': 'class',
    'class': 'class',
    'classname': 'class',
    'program': 'class',
    'programname': 'class',
    'stream': 'class',
    'grade': 'class',
    'classgrade': 'class',

    // IDs
    'serialno': 'serialNo',
    'serialn': 'serialNo',
    'srlno': 'serialNo',
    'serial': 'serialNo',
    'srno': 'serialNo',
    'formno': 'formNo',
    'formn': 'formNo',
    'form': 'formNo',
    'enrollmentno': 'enrollmentNo',
    'enrollmentn': 'enrollmentNo',
    'enrollment': 'enrollmentNo',

    // Guardian
    'guardianname': 'guardianName',
    'guardian': 'guardianName',
    'parentname': 'guardianName',
    'fathername': 'guardianName',
    'mothername': 'guardianName',
    'guardianloginname': 'guardianName',
    'father': 'fatherName',
    'mother': 'motherName',
    'guardianemail': 'guardianEmail',
    'parentemail': 'guardianEmail',
    'fatheremail': 'guardianEmail',
    'motheremail': 'guardianEmail',
    'guardianloginemail': 'guardianEmail',
    'guardianphone': 'guardianPhone',
    'guardianph': 'guardianPhone',
    'guardianphn': 'guardianPhone',
    'guardiancontact': 'guardianPhone',
    'parentphone': 'guardianPhone',
    'parentmobile': 'guardianPhone',
    'fatherphone': 'guardianPhone',
    'motherphone': 'guardianPhone',
    'fathercontact': 'guardianPhone',
    'mothercontact': 'guardianPhone',
    'guardianloginphone': 'guardianPhone',
    'bloodgroup': 'bloodGroup',
    'bloodgrp': 'bloodGroup',
    'blood': 'bloodGroup',
    'permanentaddress': 'permanentAddress',
    'permaddress': 'permanentAddress',
    'peraddress': 'permanentAddress',
    'nationality': 'nationality',
    'religion': 'religion',
    'category': 'category',

    // Personal (extended)
    'birthplace': 'birthPlace',
    'placeofbirth': 'birthPlace',
    'caste': 'caste',
    'aadhar': 'aadharNumber',
    'aadhaar': 'aadharNumber',
    'aadharno': 'aadharNumber',
    'aadhaarno': 'aadharNumber',
    'aadharnumber': 'aadharNumber',
    'aadhaarnumber': 'aadharNumber',
    'admissionnumber': 'admissionNumber',
    'admissionno2': 'admissionNumber',
    'admno': 'admissionNumber',
    'admissiontype': 'admissionType',
    'approvalstatus': 'approvalStatus',
    'applicationid': 'applicationId',
    'applicationdate': 'applicationDate',
    'remarks': 'remarks',
    'birthcertificateno': 'birthCertificateNo',
    'birthcertificate': 'birthCertificateNo',

    // Father / Mother
    'fathersname': 'fatherName',
    'fatherfullname': 'fatherName',
    'fathersphone': 'fatherPhone',
    'fathermobile': 'fatherPhone',
    'fathersmobile': 'fatherPhone',
    'fatheroccupation': 'fatherOccupation',
    'fathersoccupation': 'fatherOccupation',
    'mothersname': 'motherName',
    'motherfullname': 'motherName',
    'mothersphone': 'motherPhone',
    'mothermobile': 'motherPhone',
    'mothersmobile': 'motherPhone',
    'motheroccupation': 'motherOccupation',
    'mothersoccupation': 'motherOccupation',
    'guardianrelation': 'guardianRelation',
    'relationship': 'guardianRelation',
    'relationshipwithstudent': 'guardianRelation',
    'relationwithstudent': 'guardianRelation',

    // Previous academic
    'haspreviousschool': 'hasPreviousSchool',
    'previousschoolname': 'previousSchoolName',
    'previousschool': 'previousSchoolName',
    'classlastattended': 'previousClass',
    'previousclass': 'previousClass',
    'lastclass': 'previousClass',
    'previouspercentage': 'previousPercentage',
    'percentageobtained': 'previousPercentage',
    'percentage': 'previousPercentage',
    'tcnumber': 'transferCertificateNo',
    'tcno': 'transferCertificateNo',
    'transfercertificateno': 'transferCertificateNo',
    'tcdate': 'transferCertificateDate',
    'transfercertificatedate': 'transferCertificateDate',
    'reasonforleaving': 'reasonForLeaving',

    // Medical
    'knownhealthissues': 'knownHealthIssues',
    'healthissues': 'knownHealthIssues',
    'allergies': 'allergies',
    'immunizationstatus': 'immunizationStatus',
    'immunization': 'immunizationStatus',
    'learningdisabilities': 'learningDisabilities',

    // Status
    'status': 'status',
  };

  const DEFAULT_COLUMN_ORDER = [
    'name',
    'mobile',
    'gender',
    'batchCode',
    'admissionDate',
    'roll',
    'section',
    'class',
    'email',
    'dob',
    'address',
    'pincode',
    'guardianName',
    'guardianPhone',
    'serialNo',
    'formNo',
    'enrollmentNo',
    'guardianEmail',
    'status',
    'dob',
    'bloodGroup',
    'permanentAddress',
    'nationality',
    'religion',
    'category',
  ];

  const mapHeaderToField = (header) => {
    const normalized = normalize(header);
    if (!normalized) return null;
    if (COLUMN_MAP[normalized]) return COLUMN_MAP[normalized];

    if (normalized.includes('name') && normalized.includes('student')) return 'name';
    if (normalized.includes('full') && normalized.includes('name')) return 'name';
    if (normalized.includes('phone') || normalized.includes('mobile') || normalized.includes('contact') || normalized.includes('whatsapp')) return 'mobile';
    if (normalized.includes('email')) return 'email';
    if (normalized.includes('gender') || normalized === 'sex') return 'gender';
    if (normalized.includes('dob') || normalized.includes('birth')) return 'dob';
    if (normalized.includes('admission') && normalized.includes('date')) return 'admissionDate';
    if (normalized.includes('batch') || normalized.includes('session') || normalized.includes('academicyear')) return 'batchCode';
    if (normalized.includes('roll')) return 'roll';
    if (normalized.includes('section') || normalized === 'sec' || normalized.includes('division')) return 'section';
    if (normalized.includes('course') || normalized.includes('program') || normalized.includes('stream')) return 'class';
    if (normalized.includes('class')) return 'class';
    if (normalized.includes('grade')) return 'class';
    if (normalized.includes('address')) return 'address';
    if (normalized.includes('permanent') && normalized.includes('address')) return 'permanentAddress';
    if (normalized.includes('pin') || normalized.includes('zip') || normalized.includes('postal')) return 'pincode';
    if (normalized.includes('serial') || normalized.includes('srno')) return 'serialNo';
    if (normalized.includes('form')) return 'formNo';
    if (normalized.includes('enrollment')) return 'enrollmentNo';

    if (normalized.includes('guardianlogin')) {
      if (normalized.includes('email')) return 'guardianEmail';
      if (normalized.includes('phone') || normalized.includes('mobile') || normalized.includes('contact')) return 'guardianPhone';
      if (normalized.includes('name')) return 'guardianName';
    }
    if (normalized.includes('guardian') || normalized.includes('parent') || normalized.includes('father') || normalized.includes('mother')) {
      if (normalized.includes('email')) return 'guardianEmail';
      if (normalized.includes('phone') || normalized.includes('mobile') || normalized.includes('contact')) return 'guardianPhone';
      if (normalized.includes('name')) return 'guardianName';
      return 'guardianName';
    }

    if (normalized.includes('blood')) return 'bloodGroup';
    if (normalized.includes('nationality')) return 'nationality';
    if (normalized.includes('religion')) return 'religion';
    if (normalized.includes('category')) return 'category';

    return null;
  };

  const buildPositionalHeaderMap = (rowLen) => {
    const map = {};
    DEFAULT_COLUMN_ORDER.forEach((field, idx) => {
      if (idx < rowLen) map[field] = idx;
    });
    return map;
  };

  const isLikelyHeaderRow = (row) => {
    if (!row || !row.length) return false;
    const cells = row.map((c) => String(c || "").trim()).filter(Boolean);
    if (!cells.length) return false;
    let headerHits = 0;
    for (const cell of cells) {
      const normalized = normalize(cell);
      if (COLUMN_MAP[normalized]) {
        headerHits++;
        continue;
      }
      if (/(name|student|phone|mobile|contact|email|gender|dob|birth|admission|batch|session|roll|section|class|course|program|stream|address|pin|zip|postal|guardian|parent|father|mother|serial|form|enrollment|status|grade)/.test(normalized)) {
        headerHits++;
      }
    }
    return headerHits >= Math.max(2, Math.ceil(cells.length * 0.3));
  };

  // simple CSV parser with quotes support
  const parseCsv = (text) => {
    const out = [];
    let i = 0,
      f = "",
      row = [],
      q = false;
    const pf = () => {
        row.push(f);
        f = "";
      },
      pr = () => {
        out.push(row);
        row = [];
      };

    while (i < text.length) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            f += '"';
            i += 2;
          } else {
            q = false;
            i++;
          }
        } else {
          f += c;
          i++;
        }
      } else {
        if (c === '"') {
          q = true;
          i++;
        } else if (c === ",") {
          pf();
          i++;
        } else if (c === "\r") {
          i++;
        } else if (c === "\n") {
          pf();
          pr();
          i++;
        } else {
          f += c;
          i++;
        }
      }
    }
    pf();
    if (row.length) pr();
    return out;
  };

  const toISO = (s) => {
    const t = String(s || "").trim();
    if (!t) return null;

    // Already in ISO format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

    // Handle DD/MM/YYYY or DD-MM-YYYY (day first - common in many countries)
    const ddmmyyyy = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (ddmmyyyy) {
      const day = String(ddmmyyyy[1]).padStart(2, "0");
      const month = String(ddmmyyyy[2]).padStart(2, "0");
      const year = ddmmyyyy[3];
      return `${year}-${month}-${day}`;
    }

    // Handle Excel date serial numbers (days since 1900-01-01)
    if (/^\d{5}$/.test(t)) {
      const excelEpoch = new Date(1900, 0, 1);
      const days = parseInt(t) - 2; // Excel has a bug counting 1900 as leap year
      const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    // Handle M/D/YYYY or MM/DD/YYYY formats (try parsing as date)
    const parsed = new Date(t);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    return null;
  };

  const normalizeClassLikeValue = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";

    // Examples:
    // "Class 5" -> "5"
    // "class-10" -> "10"
    // "5" -> "5"
    const classMatch = raw.match(/^class[\s\-_:]*([a-z0-9]+)$/i);
    if (classMatch?.[1]) return classMatch[1].toUpperCase();
    return raw;
  };

  const isNumericClassLabel = (value) => /^\d{1,2}$/.test(String(value || "").trim());

  const parseFileToRows = async (file) => {
    const fileName = file.name.toLowerCase();

    // Handle Excel files (.xlsx, .xls)
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
      return jsonData;
    }

    // Handle CSV files
    if (fileName.endsWith('.csv')) {
      const text = await file.text();
      return parseCsv(text);
    }

    throw new Error("Unsupported file format. Please use .csv, .xlsx, or .xls files.");
  };

  const downloadStudentDemoTemplate = () => {
    // Pull live values so the sample rows use this school's real session / classes.
    const activeYear =
      academicYears.find((y) => y.isActive) || academicYears[0] || null;
    const session = activeYear?.name || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    const admissionDate = activeYear?.startDate
      ? new Date(activeYear.startDate).toISOString().slice(0, 10)
      : `${new Date().getFullYear()}-04-01`;
    const admissionYearNum = new Date(admissionDate).getFullYear();

    // Classes that belong to the active session (fall back to all), sorted naturally.
    const yearClasses = academicClasses
      .filter((c) => !activeYear || String(c.academicYearId || "") === String(activeYear._id || ""))
      .slice()
      .sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { numeric: true, sensitivity: "base" })
      );
    const classList = yearClasses.length ? yearClasses : academicClasses.slice();
    const sectionsOf = (cls) =>
      academicSections
        .filter((s) => String(s.classId) === String(cls?._id || ""))
        .map((s) => s.name)
        .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }));

    // Build one (class, section) pair for every combination in the database.
    const pairs = [];
    if (classList.length) {
      classList.forEach((cls) => {
        const secs = sectionsOf(cls);
        if (secs.length) secs.forEach((sec) => pairs.push({ className: cls.name, section: sec }));
        else pairs.push({ className: cls.name, section: "" });
      });
    } else {
      // No academic setup yet — still give something usable.
      ["5", "6", "7", "8"].forEach((c) => ["A", "B"].forEach((sec) => pairs.push({ className: c, section: sec })));
    }

    // Placeholder names only — not real people.
    const FIRST = ["John", "Jane", "Sam", "Alex", "Chris", "Pat", "Taylor", "Jordan", "Casey", "Riley", "Morgan", "Jamie"];
    const LAST = ["Doe", "Roe", "Smith", "Public", "Bloggs", "Sample", "Example", "Test"];
    const CITIES = [["Sampleton", "100001"], ["Testville", "100002"], ["Democity", "100003"], ["Placeholder", "100004"]];

    const rows = pairs.map((p, i) => {
      const first = FIRST[i % FIRST.length];
      const last = LAST[i % LAST.length];
      const fullName = `${first} ${last}`;
      const father = `Father ${last}`;
      const mother = `Mother ${last}`;
      const [city, pin] = CITIES[i % CITIES.length];
      const gender = i % 2 === 0 ? "male" : "female";
      return {
        name: fullName,
        mobile: `98${String(76000000 + i).slice(-8)}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${i + 1}@example.com`,
        gender,
        dob: `201${2 - (i % 5)}-0${(i % 9) + 1}-1${i % 8}`,
        birthPlace: city,
        nationality: "Indian",
        religion: "Hindu",
        caste: "General",
        category: "General",
        aadharNumber: `${100000000000 + i}`,
        address: `${12 + i}, Lake View Road, ${city}`,
        permanentAddress: `${12 + i}, Lake View Road, ${city}`,
        pincode: pin,
        // Auto-generated on upload if left blank — sample values shown for reference.
        admissionNumber: `ADM/${admissionYearNum}/${String(i + 1).padStart(4, "0")}`,
        admissionDate,
        admissionType: "New Admission",
        academicYear: session,
        class: p.className,
        section: p.section,
        roll: "",
        serialNo: `${1001 + i}`,
        status: "Active",
        approvalStatus: "Approved",
        applicationId: "",
        applicationDate: admissionDate,
        // Parent / guardian
        fatherName: father,
        fatherPhone: `98${String(76500000 + i).slice(-8)}`,
        fatherOccupation: "Business",
        motherName: mother,
        motherPhone: `91${String(23400000 + i).slice(-8)}`,
        motherOccupation: "Homemaker",
        guardianName: father,
        guardianPhone: `98${String(76500000 + i).slice(-8)}`,
        guardianEmail: `${father.split(" ")[0].toLowerCase()}${i + 1}@example.com`,
        guardianRelation: "Father",
        // Previous academic
        hasPreviousSchool: "yes",
        previousSchoolName: "Sample Public School",
        previousClass: p.className,
        previousPercentage: `${80 + (i % 15)}%`,
        transferCertificateNo: `TC/2024/${100 + i}`,
        transferCertificateDate: "2024-05-10",
        reasonForLeaving: "Relocated",
        // Medical
        bloodGroup: ["O+", "A+", "B+", "AB+", "O-"][i % 5],
        knownHealthIssues: "None",
        allergies: "None",
        immunizationStatus: "Up to date",
        learningDisabilities: "None",
        // Documents
        birthCertificateNo: `BC${123450 + i}`,
        remarks: "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

    // Reference sheet: valid sessions / classes / sections for this school.
    const refRows = [];
    refRows.push({ Field: "Active Session", "Valid values": session });
    academicYears.forEach((y) => refRows.push({ Field: "Session", "Valid values": `${y.name}${y.isActive ? "  (active)" : ""}` }));
    classList.forEach((c) => {
      const secs = sectionsOf(c).join(", ") || "—";
      refRows.push({ Field: "Class", "Valid values": `${c.name}   →  sections: ${secs}` });
    });
    refRows.push({ Field: "", "Valid values": "" });
    refRows.push({ Field: "Rows in template", "Valid values": `${rows.length} (one demo student per class + section)` });
    refRows.push({ Field: "Note", "Valid values": "Admission Number, Roll Number & Application ID are auto-generated on upload if left blank." });
    const refSheet = XLSX.utils.json_to_sheet(refRows);
    XLSX.utils.book_append_sheet(workbook, refSheet, "Reference");

    XLSX.writeFile(workbook, "student_bulk_upload_template.xlsx");
  };

  const startImportProgress = () => {
    setImportProgress(2);
    if (importProgressTimerRef.current) clearInterval(importProgressTimerRef.current);
    importProgressTimerRef.current = setInterval(() => {
      setImportProgress((prev) => {
        if (prev >= 90) return prev;
        const step = prev < 50 ? 6 : prev < 75 ? 3 : 1;
        return Math.min(90, prev + step);
      });
    }, 200);
  };

  const finishImportProgress = () => {
    if (importProgressTimerRef.current) {
      clearInterval(importProgressTimerRef.current);
      importProgressTimerRef.current = null;
    }
    setImportProgress(100);
  };

  const handleBulkFilePicked = async (file) => {
    const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      await Swal.fire({
        icon: "error",
        title: "File Too Large",
        text: `Import file must be under 10 MB. Selected file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      setIsImporting(true);
      startImportProgress();

      const rows = await parseFileToRows(file);

      if (!rows.length) {
        await Swal.fire({
          icon: "warning",
          title: "File is empty",
          text: "Please upload a file with student rows.",
        });
        return;
      }

      // Get headers from Excel and normalize them
      const rawHeaders = rows[0];
      const headerMap = {}; // Maps normalized column name to column index

      rawHeaders.forEach((h, i) => {
        const mappedField = mapHeaderToField(h);
        if (mappedField) headerMap[mappedField] = i;
      });

      const requiredFields = ['name', 'mobile', 'gender', 'batchCode', 'admissionDate', 'roll', 'section', 'class'];
      const missingRequired = requiredFields.filter((f) => headerMap[f] === undefined);

      let startRow = 1;
      let effectiveHeaderMap = { ...headerMap };

      if (missingRequired.length === requiredFields.length) {
        // No recognizable headers. Assume fixed column order (template-like)
        effectiveHeaderMap = buildPositionalHeaderMap(rawHeaders.length);
        startRow = isLikelyHeaderRow(rawHeaders) ? 1 : 0;
      } else if (missingRequired.length > 0) {
        // Fill missing required fields from positional order if possible
        const positionalMap = buildPositionalHeaderMap(rawHeaders.length);
        missingRequired.forEach((f) => {
          if (effectiveHeaderMap[f] === undefined && positionalMap[f] !== undefined) {
            effectiveHeaderMap[f] = positionalMap[f];
          }
        });
      }

      const payload = [];
      const skippedRows = [];
      const blankRows = [];

      // Process each row
      for (let r = startRow; r < rows.length; r++) {
        const raw = rows[r];

        // Skip empty rows (tracked, not just silently dropped, so a row
        // that gets mistaken for blank is still visible/debuggable)
        if (!raw || raw.every((c) => !String(c || "").trim())) {
          blankRows.push(r + 1);
          continue;
        }

        // Build student object from row data
        const student = {};

        // Map all columns from Excel to model fields
        Object.keys(COLUMN_MAP).forEach((normalizedCol) => {
          const fieldName = COLUMN_MAP[normalizedCol];
          const colIndex = effectiveHeaderMap[fieldName];
          if (colIndex !== undefined) {
            const value = String(raw[colIndex] ?? "").trim();
            if (value) {
              student[fieldName] = value;
            }
          }
        });

        // If still missing fields, try to fill from positional order
        DEFAULT_COLUMN_ORDER.forEach((fieldName) => {
          if (student[fieldName]) return;
          const colIndex = effectiveHeaderMap[fieldName];
          if (colIndex !== undefined) {
            const value = String(raw[colIndex] ?? "").trim();
            if (value) student[fieldName] = value;
          }
        });

        student.class = normalizeClassLikeValue(student.class || "");
        student.grade = student.class;
        if (student.grade) {
          const upperGrade = String(student.grade).toUpperCase();
          const upperSection = String(student.section || "").trim().toUpperCase();
          const looksLikeSection = /^[A-Z]$/.test(upperGrade);
          const matchesSection = upperSection && upperGrade === upperSection;
          if ((looksLikeSection || matchesSection) && isNumericClassLabel(student.class)) {
            student.grade = student.class;
          }
        }

        // Check required fields (roll / admission number are auto-generated on save).
        if (!student.name || !student.mobile || !student.gender ||
            !student.admissionDate || !student.section || !student.class) {
          skippedRows.push({
            row: r + 1,
            reason: "Missing required fields (name, mobile, gender, admission date, class, section)"
          });
          continue;
        }

        // Parse dates
        const dob = toISO(student.dob);
        const admissionDate = toISO(student.admissionDate);

        if (!admissionDate) {
          skippedRows.push({
            row: r + 1,
            reason: "Invalid admission date format"
          });
          continue;
        }

        // Build final payload
        payload.push({
          name: student.name,
          mobile: student.mobile,
          email: (student.email || "").toLowerCase(),
          gender: student.gender.toLowerCase(),
          dob,
          address: student.address || "",
          permanentAddress: student.permanentAddress || "",
          pincode: student.pincode || "",
          birthPlace: student.birthPlace || "",
          caste: student.caste || "",
          aadharNumber: student.aadharNumber || "",
          status: student.status || "Active",
          admissionType: student.admissionType || "New Admission",
          approvalStatus: student.approvalStatus || "Approved",
          applicationId: student.applicationId || "",
          applicationDate: student.applicationDate || "",
          remarks: student.remarks || "",
          birthCertificateNo: student.birthCertificateNo || "",
          guardianName: student.guardianName || "",
          guardianEmail: student.guardianEmail ? student.guardianEmail.toLowerCase() : "",
          guardianPhone: student.guardianPhone || "",
          guardianRelation: student.guardianRelation || "",
          fatherName: student.fatherName || "",
          fatherPhone: student.fatherPhone || "",
          fatherOccupation: student.fatherOccupation || "",
          motherName: student.motherName || "",
          motherPhone: student.motherPhone || "",
          motherOccupation: student.motherOccupation || "",
          hasPreviousSchool: student.hasPreviousSchool || (student.previousSchoolName ? "yes" : ""),
          previousSchoolName: student.previousSchoolName || "",
          previousClass: student.previousClass || "",
          previousPercentage: student.previousPercentage || "",
          transferCertificateNo: student.transferCertificateNo || "",
          transferCertificateDate: student.transferCertificateDate || "",
          reasonForLeaving: student.reasonForLeaving || "",
          bloodGroup: student.bloodGroup || "",
          knownHealthIssues: student.knownHealthIssues || "",
          allergies: student.allergies || "",
          immunizationStatus: student.immunizationStatus || "",
          learningDisabilities: student.learningDisabilities || "",
          nationality: student.nationality || "",
          religion: student.religion || "",
          category: student.category || "",
          serialNo: student.serialNo ? Number(student.serialNo) : undefined,
          batchCode: student.batchCode || "",
          academicYear: student.batchCode || "",
          admissionDate,
          admissionNumber: student.admissionNumber || "",
          roll: student.roll || "",
          grade: student.class || "",
          section: student.section,
          course: student.class || "",
          formNo: student.formNo || "",
          enrollmentNo: student.enrollmentNo || "",
        });
      }

      console.log(
        `[bulk import] file rows: ${rows.length}, startRow: ${startRow}, ` +
        `valid: ${payload.length}, skipped: ${skippedRows.length}, blank: ${blankRows.length}` +
        (blankRows.length ? ` (excel rows: ${blankRows.join(", ")})` : "")
      );

      if (!payload.length) {
        Swal.fire({
          icon: "warning",
          title: "No Valid Rows",
          html: skippedRows.length > 0 ? `<div style="text-align: left;">
            <p>All rows were skipped due to validation errors:</p>
            <ul style="max-height: 300px; overflow-y: auto;">
              ${skippedRows.slice(0, 20).map(s =>
                `<li>Row ${escapeHtml(s.row)}: ${escapeHtml(s.reason)}</li>`
              ).join('')}
              ${skippedRows.length > 20 ? `<li>...and ${skippedRows.length - 20} more</li>` : ''}
            </ul>
          </div>` : "No valid data rows found in the file.",
        });
        return;
      }

      // Show preview if there are skipped rows
      if (skippedRows.length > 0) {
        const confirmResult = await Swal.fire({
          icon: "warning",
          title: `${skippedRows.length} rows will be skipped`,
          html: `<div style="text-align: left;">
            <p><strong>${payload.length}</strong> valid rows found</p>
            <p><strong>${skippedRows.length}</strong> rows will be skipped:</p>
            <ul style="max-height: 200px; overflow-y: auto;">
              ${skippedRows.slice(0, 10).map(s =>
                `<li>Row ${escapeHtml(s.row)}: ${escapeHtml(s.reason)}</li>`
              ).join('')}
              ${skippedRows.length > 10 ? `<li>...and ${skippedRows.length - 10} more</li>` : ''}
            </ul>
            <p style="margin-top: 10px;">Do you want to continue importing the valid rows?</p>
          </div>`,
          showCancelButton: true,
          confirmButtonText: "Yes, Import Valid Rows",
          cancelButtonText: "Cancel",
        });

        if (!confirmResult.isConfirmed) {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
      }

      // The fake ticking progress bar only covers file parsing; once the
      // job starts, real per-row progress from the server takes over.
      if (importProgressTimerRef.current) {
        clearInterval(importProgressTimerRef.current);
        importProgressTimerRef.current = null;
      }
      setImportProgress(0);

      const startRes = await fetch(`${API_BASE}/api/nif/students/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ students: payload }),
      });

      const startData = await startRes.json().catch(() => ({}));
      if (!startRes.ok || !startData.jobId) {
        await Swal.fire({
          icon: "error",
          title: "Import failed",
          text: startData.message || startData.error || startRes.statusText,
        });
        return;
      }

      // Large imports run in the background on the server (a single HTTP
      // request would outlive hosting-provider proxy timeouts), so poll
      // for progress instead of waiting on the original request.
      const jobId = startData.jobId;
      const jobTotal = startData.total || payload.length;
      setImportJob({ total: jobTotal, processed: 0, imported: 0, failed: 0 });
      let data;
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const statusRes = await fetch(
          `${API_BASE}/api/nif/students/bulk/status/${jobId}`,
          { headers: { authorization: `Bearer ${localStorage.getItem("token")}` } }
        );
        if (!statusRes.ok) continue;
        data = await statusRes.json().catch(() => null);
        if (!data) continue;

        setImportJob({
          total: data.total || jobTotal,
          processed: data.processed || 0,
          imported: data.imported || 0,
          failed: data.failed || 0,
        });
        setImportProgress(
          data.total ? Math.min(99, Math.round((data.processed / data.total) * 100)) : importProgress
        );

        if (data.status === "completed" || data.status === "failed") break;
      }

      if (importProgressTimerRef.current) {
        clearInterval(importProgressTimerRef.current);
        importProgressTimerRef.current = null;
      }

      if (data.status === "failed") {
        await Swal.fire({
          icon: "error",
          title: "Import failed",
          text: data.error || "An error occurred during import",
        });
        return;
      }

      finishImportProgress();
      await new Promise((resolve) => setTimeout(resolve, 400));

      await Swal.fire({
        icon: "success",
        title: "Import Complete!",
        html: `<div style="text-align: left;">
          <p><strong>Successfully imported:</strong> ${data.imported} students</p>
          <p><strong>Failed:</strong> ${data.failed} rows</p>
          ${data.errors && data.errors.length > 0 ?
            `<p style="margin-top: 10px;"><strong>Errors:</strong></p>
             <ul style="max-height: 200px; overflow-y: auto; text-align: left;">
               ${data.errors.slice(0, 10).map(err =>
                 `<li>Row ${escapeHtml(err.index + 1)}: ${escapeHtml(err.message)}</li>`
               ).join('')}
               ${data.errors.length > 10 ? `<li>...and ${data.errors.length - 10} more errors</li>` : ''}
             </ul>`
            : ''}
        </div>`,
        confirmButtonText: "OK"
      });

      setCurrentPage(1); // land on the freshest page so newly imported rows are visible immediately
      await refreshStudents();
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: "error",
        title: "Import Failed",
        text: e.message || "An error occurred during import",
      });
    } finally {
      if (importProgressTimerRef.current) {
        clearInterval(importProgressTimerRef.current);
        importProgressTimerRef.current = null;
      }
      setIsImporting(false);
      setImportProgress(0);
      setImportJob(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* -------------------- UI -------------------- */
  return (
    // Fixed to the viewport so the students table scrolls inside its own
    // container instead of the whole page scrolling.
    // ── Adjust the table area height here: bump the subtracted px to make it
    //    shorter (63.4px = AdminHeader; the extra ~30px leaves a bottom gap).
    <div className="page-fade-in flex h-[calc(100dvh-94px)] flex-col overflow-hidden bg-gray-50">
      <div className="w-full flex-1 flex flex-col p-3 md:p-5 lg:p-6 overflow-hidden text-sm md:text-base">
        {/* Header */}
        <div className="flex flex-col sm:flex-wrap gap-3 sm:justify-between sm:items-center mb-1 flex-shrink-0">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 text-center">
              Student Management
            </h1>
            <p className="text-gray-500 mt-1 text-sm text-center">
              Manage and monitor all enrolled students
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-stretch sm:justify-start">
            <button
              onClick={startNewEnrollment}
              className="bg-amber-500 text-white px-3 py-2 rounded-full hover:bg-amber-600 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
            >
              <Plus size={15} /> Add
            </button>
            <button
              onClick={downloadStudentDemoTemplate}
              className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
            >
              <FileDown size={15} />
              Demo
            </button>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="relative overflow-hidden border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 disabled:opacity-100 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition min-w-[130px]"
            >
              {isImporting && (
                <span
                  className="absolute inset-y-0 left-0 bg-amber-100 transition-all duration-200 ease-out"
                  style={{ width: `${importProgress}%` }}
                />
              )}
              <span className="relative flex items-center gap-2">
                {isImporting ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {isImporting ? `Importing... ${importProgress}%` : "Bulk Upload"}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleBulkFilePicked(f);
              }}
            />

            
           
            {selectedStudentIds.length > 0 && (
              <button
                onClick={handleBulkArchiveStudents}
                disabled={isArchiving}
                className="bg-blue-600 text-white px-3 py-2 rounded-full hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
                title={`Archive ${selectedStudentIds.length} selected student(s)`}
              >
                <Archive size={15} />
                {/* {isArchiving ? "Archiving..." : `Archive (${selectedStudentIds.length})`} */}
                {isArchiving ? "Archiving..." : `Archive All`}
              </button>
            )}
            {selectedStudentIds.length > 0 && (
              <button
                onClick={handleBulkDeleteStudents}
                disabled={isBulkDeleting}
                className="relative overflow-hidden bg-red-500 text-white px-3 py-2 rounded-full hover:bg-red-600 disabled:opacity-100 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition min-w-[130px]"
                title={`Delete ${selectedStudentIds.length} selected student(s)`}
              >
                {isBulkDeleting && (
                  <span
                    className="absolute inset-y-0 left-0 bg-red-700/60 transition-all duration-200 ease-out"
                    style={{ width: `${deleteProgress}%` }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  {isBulkDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  {/* {isBulkDeleting ? `Deleting... ${deleteProgress}%` : `Delete (${selectedStudentIds.length})`} */}
                  {isBulkDeleting ? `Deleting... ${deleteProgress}%` : `Delete All`}
                </span>
              </button>
            )}
            <button
              onClick={() => setShowDraftsModal(true)}
              className="relative border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
            >
              <FileClock size={15} /> Drafts
              {enrollDrafts.length > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-semibold text-blue-700">
                  {enrollDrafts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowArchiveModal(true)}
              className="relative border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
            >
              <Archive size={15} /> Archived
              {archivedStudents.length > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-semibold text-blue-700">
                  {archivedStudents.length}
                </span>
              )}
            </button>
             <button
              onClick={toggleSelectAllFiltered}
              disabled={filteredStudentIds.length === 0}
              className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 disabled:opacity-60 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
              title={isAllFilteredSelected ? "Clear selection" : `Select all ${filteredStudentIds.length} student(s)`}
            >
              <CheckCircle size={15} />
              {/* {isAllFilteredSelected ? "Deselect All" : `Select All (${filteredStudentIds.length})`} */ }
              {isAllFilteredSelected ? "Deselect All" : `Select All`}
            </button>
            <button
              onClick={handleRefreshTableData}
              disabled={tableRefreshing}
              className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 disabled:opacity-60 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
              title="Refresh students table data"
            > 
              {tableRefreshing ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
              {tableRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          {/* Filter Bar */}
          <div className="mb-1 p-3 md:p-4 flex-shrink-0  ">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="flex-1 min-w-[200px] relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, roll, email, or username..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-1 focus:rounded-full focus:ring-yellow-500 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Session Filter */}
              <select
                value={sessionFilter}
                onChange={(e) => { setSessionFilter(e.target.value); setClassFilter(""); setSectionFilter(""); }}
                disabled={!sessionOptions.length}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 min-w-[140px]"
              >
                {!sessionOptions.length && <option value="">No Active Session</option>}
                {sessionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Class Filter */}
              <select
                value={classFilter}
                onChange={(e) => { setClassFilter(e.target.value); setSectionFilter(""); }}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 min-w-[130px]"
              >
                <option value="">All Classes</option>
                {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* Section Filter */}
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 min-w-[130px]"
              >
                <option value="">All Sections</option>
                {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Reset */}
              {(sessionFilter || classFilter || sectionFilter || searchTerm) && (
                <button
                  onClick={() => { setSessionFilter(""); setClassFilter(""); setSectionFilter(""); setSearchTerm(""); }}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={14} /> Clear
                </button>
              )}
            </div>

            {/* Active filter tags */}
            {(sessionFilter || classFilter || sectionFilter) && (
              <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500">Active filters:</span>
                {sessionFilter && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                    Session: {sessionFilter}
                    <button onClick={() => { setSessionFilter(""); setClassFilter(""); setSectionFilter(""); }} className="hover:text-yellow-600"><X size={12} /></button>
                  </span>
                )}
                {classFilter && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    Class: {classFilter}
                    <button onClick={() => { setClassFilter(""); setSectionFilter(""); }} className="hover:text-blue-600"><X size={12} /></button>
                  </span>
                )}
                {sectionFilter && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    Section: {sectionFilter}
                    <button onClick={() => setSectionFilter("")} className="hover:text-green-600"><X size={12} /></button>
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} found</span>
              </div>
            )}
          </div>

          {/* Students Table */}
          <>
            {/* Rounded card clips the corners. Header sits in its own div so the
                body scrollbar starts *below* the header, not through it. */}
            <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {isImporting && (
                <div className="shrink-0 bg-blue-50/95 border-b border-blue-200">
                  <div className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-700">
                    <Loader2 size={13} className="animate-spin" />
                    Uploading bulk student file... {importProgress}%
                  </div>
                  <div className="h-1 w-full bg-blue-100">
                    <div
                      className="h-full bg-blue-500 transition-all duration-200 ease-out"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {/* Header (does not scroll vertically; horizontal scroll synced to body) */}
              <div ref={tableHeaderRef} className="shrink-0 overflow-hidden border-b border-gray-200 table-scroll-gutter">
                <table className="w-full min-w-[980px] border-collapse table-fixed">
                  <colgroup>
                    <col style={{ width: "5%" }} /><col style={{ width: "24%" }} /><col style={{ width: "14%" }} />
                    <col style={{ width: "12%" }} /><col style={{ width: "18%" }} /><col style={{ width: "27%" }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border-b border-gray-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[5%]">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded-full border-2 border-amber-200 bg-white text-amber-500 focus:ring-2 focus:ring-amber-200 focus:ring-offset-0 cursor-pointer transition shadow-sm"
                          checked={isAllVisibleSelected}
                          disabled={!isAnyVisibleSelected && visibleStudentIds.length === 0}
                          onChange={toggleSelectAllVisible}
                          aria-label="Select all visible students"
                        />
                      </th>
                      <th className="border-b border-gray-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[24%]">
                        Student
                      </th>
                      <th className="border-b border-gray-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[14%]">
                        Academic
                      </th>
                      {/* <th className="border-b border-gray-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[15%]">
                        Course
                      </th> */}
                      <th className="border-b border-gray-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[12%]">
                        Contact
                      </th>
                      <th className="border-b border-gray-200 px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-[18%]">
                        Fees
                      </th>
                      <th className="border-b border-gray-200 px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 w-[27%]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                </table>
              </div>

              {/* Body (this is where the vertical scrollbar lives) */}
              <div
                ref={tableBodyScrollRef}
                onScroll={(e) => {
                  if (tableHeaderRef.current) tableHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft;
                }}
                className="flex-1 overflow-auto table-scroll"
              >
                <table className="w-full min-w-[980px] border-collapse table-fixed">
                  <colgroup>
                    <col style={{ width: "5%" }} /><col style={{ width: "24%" }} /><col style={{ width: "14%" }} />
                    <col style={{ width: "12%" }} /><col style={{ width: "18%" }} /><col style={{ width: "27%" }} />
                  </colgroup>
                  <tbody className={tableRefreshing || isImporting ? "opacity-70 animate-pulse" : ""}>
                    {studentsLoading && studentData.length === 0 ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={`student-skeleton-${i}`} className="animate-pulse">
                          <td className="px-2 py-3.5"><div className="h-4 w-4 rounded bg-gray-200" /></td>
                          <td className="px-2 py-3.5">
                            <div className="h-3.5 w-3/4 rounded bg-gray-200 mb-2" />
                            <div className="h-3 w-1/2 rounded bg-gray-100" />
                          </td>
                          <td className="px-2 py-3.5"><div className="h-3.5 w-2/3 rounded bg-gray-200" /></td>
                          <td className="px-2 py-3.5"><div className="h-3.5 w-2/3 rounded bg-gray-200" /></td>
                          <td className="px-2 py-3.5"><div className="h-3.5 w-3/4 rounded bg-gray-200" /></td>
                          <td className="px-2 py-3.5"><div className="h-3.5 w-1/2 rounded bg-gray-200 mx-auto" /></td>
                        </tr>
                      ))
                    ) : (
                      <>
                        {paginatedStudents.map((student) => {
                      const studentKey = student._id || student.id;
                      const admissionYear = student.admissionDate
                        ? new Date(student.admissionDate).getFullYear()
                        : undefined;
                      const portalReady = credentialStatus[studentKey] === "active";
                      const isCredentialLoading = credentialLoadingId === studentKey;
                      const prefillValues = {
                        batchCode:
                          student.batchCode ||
                          student.section ||
                          student.grade ||
                          "",
                        referenceName: student.name || "",
                      };
                      if (admissionYear) {
                        prefillValues.joiningYear = admissionYear;
                      }
                      return (
                        <tr
                          key={studentKey}
                          className="hover:bg-amber-50/30 transition-colors"
                        >
                          <td
                            className="border-b border-gray-100 px-2 py-2.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="h-5 w-5 rounded-full border-2 border-amber-200 bg-white text-amber-500 focus:ring-2 focus:ring-amber-200 focus:ring-offset-0 cursor-pointer transition shadow-sm"
                              checked={selectedIdSet.has(String(studentKey))}
                              onChange={() => toggleStudentSelection(studentKey)}
                              aria-label={`Select ${student.name || "student"}`}
                            />
                          </td>
                          {/* Student Info */}
                          <td
                            className="border-b border-gray-100 px-2 py-2.5 cursor-pointer"
                            onClick={() => {
                              openViewModal(student);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-100 to-yellow-200 flex items-center justify-center text-xs font-semibold text-amber-700 flex-shrink-0">
                                {student.name?.charAt(0) || "?"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900 text-xs truncate hover:text-amber-600 transition">
                                  {student.name}
                                </div>
                                <div className="text-[11px] text-gray-400 truncate">
                                  {student.admissionNumber ? `Adm: ${student.admissionNumber}` : "No Admission Number"}
                                </div>
                                <div className="text-[11px] text-gray-400 truncate">
                                  ID: {student.username || student.studentCode || student.portalAccess?.username || "-"}
                                  {/* {student.parent?.username ? ` · Parent: ${student.parent.username}` : ""} */}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Academic Info */}
                          <td className="border-b border-gray-100 px-2 py-2.5">
                            <div className="text-xs text-gray-600">
                              <div className="font-medium">Session: {student.academicYear || "-"}</div>
                              <div className="text-gray-500">
                                Class: {student.class || student.grade || "-"} | Sec: {student.section || "-"}
                              </div>
                              <div className="text-gray-500">Roll: {student.roll || "-"}</div>
                            </div>
                          </td>

                          {/* Course Info */}
                          {/* <td className="border-b border-gray-100 px-2 py-2.5">
                            <div className="text-xs text-gray-600">
                              <div className="font-medium truncate" title={student.grade}>{student.grade}</div>
                              <div className="text-gray-500 truncate" title={student.course}>{student.course}</div>
                            </div>
                          </td> */}

                          {/* Contact */}
                          <td className="border-b border-gray-100 px-2 py-2.5 text-xs text-gray-600">
                            {student.mobile}
                          </td>

                          {/* Fees */}
                          <td className="border-b border-gray-100 px-2 py-2.5">
                            <div className="text-xs">
                              {(() => {
                                const sessionFee = getStudentFeeSessionSummary(student);
                                const paidAmount = sessionFee?.paidAmount ?? student.feeSummary?.paidAmount ?? 0;
                                const totalAmount = sessionFee?.totalAmount ?? student.feeSummary?.totalFee ?? 0;
                                const balanceAmount = sessionFee?.balanceAmount ?? student.feeSummary?.dueAmount ?? 0;
                                const sessionLabel = sessionFee?.sessionLabel || student.academicYear || "-";
                                const status = totalAmount === 0
                                  ? "N/A"
                                  : balanceAmount <= 0
                                    ? "paid"
                                    : paidAmount > 0
                                      ? "partial"
                                      : "due";
                                return (
                                  <>
                                    <div className="text-gray-600">
                                      <div className="font-medium">
                                        <span className="font-bold"> Total: </span> <span className="font-medium"> {formatCurrency(totalAmount)} </span></div>
                                      <div className="text-gray-500">
                                       <span className="font-bold"> Paid: </span> <span className="text-green-600 font-medium">{formatCurrency(paidAmount)}</span>
                                        {/* {formatCurrency(paidAmount)}/{formatCurrency(totalAmount)} */}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                     <span className="font-bold text-gray-500"> Due: </span>
                                      <span className="text-xs text-red-600 font-semibold">
                                        {formatCurrency(balanceAmount)}
                                      </span>
                                      <span
                                        className={`inline-flex px-1.5 py-0.5 text-xs rounded-full ${getFeeStatusClass(status)}`}
                                      >
                                        {status}
                                      </span>
                                      
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </td>

                          {/* Actions */}
                          <td
                            className="border-b border-gray-100 px-2 py-2.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1 justify-center flex-wrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewStudentCredentials(student);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-full font-medium bg-amber-500 text-white hover:bg-amber-600 transition px-1 py-1 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                                disabled={isCredentialLoading}
                                title="View Credentials"
                              >
                                <KeyRound size={13} />
                                {/* Credentials */}
                              </button>
                              {student.studentPortalUser && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetStudentCredentials(student);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md font-medium bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition px-2 py-1 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                                  disabled={isCredentialLoading}
                                  title="Reset Credentials"
                                >
                                  <KeyRound size={12} />
                                  Reset
                                </button>
                              )}
                              {portalReady && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                                  Portal Ready
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openViewModal(student);
                                }}
                                className="inline-flex items-center px-1.5 py-1 text-blue-600 hover:bg-blue-50 rounded-md text-xs transition"
                                title="View Details"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditWizard(student);
                                }}
                                className="inline-flex items-center px-1.5 py-1 text-gray-500 hover:bg-gray-100 rounded-md text-xs transition"
                                title="Edit Student"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleArchiveStudent(student);
                                }}
                                disabled={isArchiving}
                                className="inline-flex items-center px-1.5 py-1 text-green-600 hover:bg-gray-100 hover:text-gray-600 rounded-md text-xs transition disabled:opacity-50"
                                title="Archive Student"
                              >
                                <Archive size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteStudent(student);
                                }}
                                disabled={!!deletingId}
                                className="inline-flex items-center px-1.5 py-1  text-red-600 hover:bg-red-200 rounded-md text-xs transition disabled:opacity-50"
                                title="Delete Student"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredStudents.length === 0 && !studentsLoading && (
                      <tr>
                        <td colSpan={6} className="py-14 px-4 text-center">
                          {isImporting ? (
                            <div className="inline-flex items-center gap-2 text-blue-700 font-medium text-sm">
                              <Loader2 size={16} className="animate-spin" />
                              Importing students, please wait…
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                <svg className="w-7 h-7 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-700">No students found</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {studentData.length === 0
                                    ? 'Add your first student to get started'
                                    : 'Try adjusting your search or filters'}
                                </p>
                              </div>
                              {studentData.length === 0 && (
                                <button
                                  onClick={startNewEnrollment}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                                >
                                  + Add First Student
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
              <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0 pt-3 border-t border-gray-100 px-1">
                <p className="text-gray-500 text-xs">
                  {filteredStudents.length === 0
                    ? "No students to display"
                    : `Showing ${startItem}\u2013${endItem} of ${filteredStudents.length} students`}
                </p>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    {/* First */}
                    <button
                      className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      title="First page"
                    >
                      <ChevronsLeft size={14} />
                    </button>

                    {/* Prev */}
                    <button
                      className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      title="Previous page"
                    >
                      <ChevronLeft size={14} />
                    </button>

                    {/* Page numbers with smart truncation */}
                    {(() => {
                      const pages = [];
                      const showMax = 5;

                      if (totalPages <= showMax + 2) {
                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                      } else {
                        pages.push(1);
                        let rangeStart = Math.max(2, currentPage - 1);
                        let rangeEnd = Math.min(totalPages - 1, currentPage + 1);

                        if (currentPage <= 3) {
                          rangeStart = 2;
                          rangeEnd = Math.min(showMax, totalPages - 1);
                        } else if (currentPage >= totalPages - 2) {
                          rangeStart = Math.max(2, totalPages - showMax + 1);
                          rangeEnd = totalPages - 1;
                        }

                        if (rangeStart > 2) pages.push("start-ellipsis");
                        for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
                        if (rangeEnd < totalPages - 1) pages.push("end-ellipsis");
                        pages.push(totalPages);
                      }

                      return pages.map((page) => {
                        if (typeof page === "string") {
                          return (
                            <span key={page} className="px-1 text-gray-400 text-xs select-none">
                              &hellip;
                            </span>
                          );
                        }
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[28px] h-7 rounded-md text-xs font-medium transition ${
                              page === currentPage
                                ? "bg-amber-500 text-white shadow-sm"
                                : "text-gray-600 hover:bg-gray-100"
                            }`}
                          >
                            {page}
                          </button>
                        );
                      });
                    })()}

                    {/* Next */}
                    <button
                      className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      title="Next page"
                    >
                      <ChevronRight size={14} />
                    </button>

                    {/* Last */}
                    <button
                      className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      title="Last page"
                    >
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                )}
              </div>
          </>
        </div>

        {/* Enroll New Student — full-screen wizard */}
        <AnimatePresence>
        {showAddForm && (
          <StudentEnrollWizard
            key={`enroll-${enrollSessionKey}`}
            newStudent={newStudent}
            handleAddStudentChange={handleAddStudentChange}
            enrollContext={enrollContext}
            editing={!!editingStudentId}
            onClose={() => { editRequestTokenRef.current += 1; setShowAddForm(false); setEditingStudentId(null); }}
            onSubmit={handleAddStudentSubmit}
            isSubmitting={isSubmitting}
            initialStep={resumeStep}
            onSaveDraft={editingStudentId ? undefined : saveEnrollDraft}
            onUploadFile={uploadEnrollDocument}
            parentSearchTerm={parentSearchTerm}
            setParentSearchTerm={setParentSearchTerm}
            matchedParents={matchedParents}
            handleSelectExistingParent={handleSelectExistingParent}
            selectedExistingParent={selectedExistingParent}
            academicYears={academicYears}
            academicClasses={academicClasses}
            academicSections={academicSections}
            selectedAcademicYearId={selectedAcademicYearId}
            setSelectedAcademicYearId={setSelectedAcademicYearId}
            selectedClassId={selectedClassId}
            setSelectedClassId={setSelectedClassId}
            selectedSectionId={selectedSectionId}
            setSelectedSectionId={setSelectedSectionId}
          />
        )}
        </AnimatePresence>

        {/* Enrollment Drafts modal */}
        <AnimatePresence>
        {showDraftsModal && (
          <Motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowDraftsModal(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Motion.div
              className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.34, 1.1, 0.64, 1] }}
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-amber-600">
                    <FileClock size={18} />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Enrollment Drafts</h3>
                    <p className="text-xs text-gray-500">Resume a partially filled enrollment form.</p>
                  </div>
                </div>
                <button onClick={() => setShowDraftsModal(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                {enrollDrafts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center text-gray-400">
                    <FileClock size={34} className="mb-3 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500">No saved drafts</p>
                    <p className="mt-1 text-xs">Start enrolling a student — your progress is saved automatically.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {enrollDrafts.map((d) => (
                      <li key={d._id} className="flex flex-wrap items-center gap-3 px-2 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-800">{d.label || "Untitled draft"}</p>
                          <p className="mt-0.5 truncate text-xs text-gray-400">
                            {d.className ? `${d.className} · ` : ""}
                            up to “{ENROLL_STEP_LABELS[d.step] || ENROLL_STEP_LABELS[0]}” · saved {draftTimeAgo(d.updatedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => resumeEnrollDraft(d)}
                            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
                          >
                            <RotateCcw size={13} /> Resume
                          </button>
                          <button
                            onClick={() => deleteEnrollDraft(d._id)}
                            disabled={deletingDraftId === d._id}
                            title="Delete draft"
                            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            {deletingDraftId === d._id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Motion.div>
          </Motion.div>
        )}
        </AnimatePresence>

        {/* Student View Modal */}
        <AnimatePresence>
        {showViewModal && viewStudent && (
          <Motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 border border-gray-200 flex flex-col max-h-[80vh]"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.34, 1.1, 0.64, 1] }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-t-2xl flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                      {viewStudent.profilePic ? (
                        <img src={viewStudent.profilePic} alt={viewStudent.name || "Student"} className="w-full h-full object-cover" />
                      ) : (
                        viewStudent.name?.charAt(0) || "?"
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-xl font-bold text-gray-900">{viewStudent.name}</h3>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          String(viewStudent.status || "Active").toLowerCase() === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-600"
                        }`}>
                          {viewStudent.status || "Active"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Roll: {viewStudent.roll || "-"}</span>
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Class: {viewStudent.class || viewStudent.grade || "-"} - {viewStudent.section || "-"}</span>
                        {viewStudent.admissionNumber && (
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Adm: {viewStudent.admissionNumber}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowViewModal(false); setViewStudent(null); }}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-white/50 transition"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-6 pt-3 pb-0 bg-white flex-shrink-0 overflow-x-auto">
                {[
                  { key: "overview", label: "Overview", icon: Users },
                  { key: "attendance", label: "Attendance", icon: CalendarDays },
                  { key: "fees", label: "Fees", icon: Wallet },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setViewTab(tab.key)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition ${
                      viewTab === tab.key
                        ? "border-amber-500 text-amber-700 bg-amber-50"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <tab.icon size={15} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="overflow-y-auto flex-1 p-6">
                {loadingViewData && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                    <span className="ml-2 text-sm text-gray-500">Loading details...</span>
                  </div>
                )}

                {!loadingViewData && viewTab === "overview" && (
                  (() => {
                    const s = viewStudent;
                    const dash = "—";
                    const val = (v) => {
                      const t = String(v ?? "").trim();
                      return t || dash;
                    };
                    const dobStr = toDateInputValue(s.dob);
                    let age = null;
                    if (dobStr) {
                      const d = new Date(dobStr);
                      if (!Number.isNaN(d.getTime())) {
                        const now = new Date();
                        age = now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
                      }
                    }
                    const attTotal = viewAttendance.length;
                    const attPresent = viewAttendance.filter((a) => a.status === "present").length;
                    const attPct = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;
                    const feesDue = viewFees.reduce((sum, inv) => sum + Number(inv.balanceAmount || 0), 0);
                    const docs = Array.isArray(s.documents) ? s.documents : [];
                    const hasPrev = s.previousSchoolName || s.previousClass || s.transferCertificateNo;
                    const hasMedical = s.bloodGroup || s.knownHealthIssues || s.allergies || s.immunizationStatus || s.learningDisabilities;

                    const Field = ({ label, value, wide }) => (
                      <div className={wide ? "sm:col-span-2" : ""}>
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="mt-0.5 text-sm font-medium text-gray-800">{value}</p>
                      </div>
                    );
                    const SectionCard = ({ icon: Icon, title, right, children }) => (
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
                            {Icon && <Icon size={15} className="text-amber-600" />} {title}
                          </p>
                          {right}
                        </div>
                        {children}
                      </div>
                    );

                    return (
                      <div className="mx-auto max-w-3xl space-y-4">
                          {/* Quick stats */}
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {[
                              { label: "Class", value: `${s.class || s.grade || "-"} - ${s.section || "-"}` },
                              { label: "Status", value: s.status || "Active" },
                              { label: "Attendance", value: attTotal ? `${attPct}%` : "—" },
                              { label: "Fees Due", value: viewFees.length ? `₹${feesDue.toLocaleString("en-IN")}` : "—" },
                            ].map((c) => (
                              <div key={c.label} className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                                <p className="text-xs font-medium text-amber-600">{c.label}</p>
                                <p className="mt-0.5 text-base font-bold text-amber-800">{c.value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Student Details */}
                          <SectionCard icon={Users} title="Student Details">
                            <div className="flex flex-col gap-4 sm:flex-row">
                              <div className="shrink-0">
                                <div className="h-24 w-24 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                                  {s.profilePic ? (
                                    <img src={s.profilePic} alt={s.name || "Student"} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-gray-300">{s.name?.charAt(0) || "?"}</div>
                                  )}
                                </div>
                                {s.profilePic && (
                                  <button
                                    type="button"
                                    onClick={() => setDocPreview({ src: s.profilePic, label: "Student Photograph" })}
                                    className="mt-1.5 flex w-full items-center justify-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                                  >
                                    <Eye size={12} /> View Photo
                                  </button>
                                )}
                              </div>
                              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <Field label="Full Name" value={val(s.name)} />
                                <Field label="Date of Birth" value={dobStr ? `${dobStr}${age != null ? `  (Age: ${age})` : ""}` : dash} />
                                <Field label="Gender" value={<span className="capitalize">{val(s.gender)}</span>} />
                                <Field label="Mobile Number" value={val(s.mobile)} />
                                <Field label="Email" value={val(s.email)} />
                                <Field label="Nationality" value={val(s.nationality)} />
                                <Field label="Religion" value={val(s.religion)} />
                                <Field label="Caste" value={val(s.caste)} />
                                <Field label="Category" value={val(s.category)} />
                                <Field label="Aadhar Number" value={val(s.aadharNumber)} wide />
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-2">
                              <div>
                                <p className="text-xs text-gray-400">Current Address</p>
                                <p className="mt-0.5 text-sm text-gray-700">{val(s.address)}{s.pincode ? ` - ${s.pincode}` : ""}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Permanent Address</p>
                                <p className="mt-0.5 text-sm text-gray-700">{val(s.permanentAddress)}</p>
                              </div>
                            </div>
                          </SectionCard>

                          {/* Parent / Guardian */}
                          <SectionCard icon={Users} title="Parent / Guardian Details">
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                              <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{`Father's Details`}</p>
                                <div className="space-y-2.5">
                                  <Field label="Name" value={val(s.fatherName)} />
                                  <Field label="Phone" value={val(s.fatherPhone)} />
                                  <Field label="Occupation" value={val(s.fatherOccupation)} />
                                </div>
                              </div>
                              <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{`Mother's Details`}</p>
                                <div className="space-y-2.5">
                                  <Field label="Name" value={val(s.motherName)} />
                                  <Field label="Phone" value={val(s.motherPhone)} />
                                  <Field label="Occupation" value={val(s.motherOccupation)} />
                                </div>
                              </div>
                              <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Guardian Details</p>
                                <div className="space-y-2.5">
                                  <Field label="Name" value={val(s.guardianName || viewParent?.name)} />
                                  <Field label="Phone" value={val(s.guardianPhone || viewParent?.mobile)} />
                                  <Field label="Email" value={val(s.guardianEmail || viewParent?.email)} />
                                  <Field label="Relationship" value={val(s.guardianRelation)} />
                                </div>
                              </div>
                            </div>
                          </SectionCard>

                          {/* Previous Academic + Medical */}
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <SectionCard icon={GraduationCap} title="Previous Academic Information">
                              {hasPrev ? (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <Field label="Previous School Name" value={val(s.previousSchoolName)} />
                                  <Field label="Class Last Attended" value={val(s.previousClass)} />
                                  <Field label="TC Number" value={val(s.transferCertificateNo)} />
                                  <Field label="TC Date" value={val(toDateInputValue(s.transferCertificateDate) || s.transferCertificateDate)} />
                                  <Field label="Percentage Obtained" value={val(s.previousPercentage ? `${s.previousPercentage}${String(s.previousPercentage).includes("%") ? "" : "%"}` : "")} />
                                  <Field label="Reason for Leaving" value={val(s.reasonForLeaving)} />
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400">No previous school on record.</p>
                              )}
                            </SectionCard>
                            <SectionCard icon={Heart} title="Medical Information">
                              {hasMedical ? (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <Field label="Blood Group" value={val(s.bloodGroup)} />
                                  <Field label="Immunization Status" value={val(s.immunizationStatus)} />
                                  <Field label="Known Health Issues" value={val(s.knownHealthIssues)} />
                                  <Field label="Allergies" value={val(s.allergies)} />
                                  <Field label="Learning Disabilities" value={val(s.learningDisabilities)} />
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400">No medical information on record.</p>
                              )}
                            </SectionCard>
                          </div>

                          {/* Documents */}
                          <SectionCard icon={FileDown} title="Documents">
                            {docs.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                                      <th className="pb-2 pr-4 font-medium">Document Name</th>
                                      <th className="pb-2 pr-4 font-medium">File Name</th>
                                      <th className="pb-2 pr-4 font-medium">Status</th>
                                      <th className="pb-2 font-medium" />
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {docs.map((d, i) => (
                                      <tr key={i}>
                                        <td className="py-2 pr-4 font-medium text-gray-800">{d.label || d.type || "Document"}</td>
                                        <td className="py-2 pr-4 text-gray-600">{d.fileName || "—"}</td>
                                        <td className="py-2 pr-4">
                                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-600">
                                            <CheckCircle size={12} /> Uploaded
                                          </span>
                                        </td>
                                        <td className="py-2">
                                          {d.url && (
                                            <button type="button" onClick={() => setDocPreview({ src: d.url, label: d.label || d.type })} className="text-amber-700 hover:text-amber-800" title="Preview">
                                              <Eye size={15} />
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400">No documents uploaded.</p>
                            )}
                          </SectionCard>
                      </div>
                    );
                  })()
                )}

                {/* Attendance Tab */}
                {!loadingViewData && viewTab === "attendance" && (
                  <div className="space-y-4">
                    {/* Summary Cards */}
                    {viewAttendance.length > 0 ? (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {(() => {
                            const total = viewAttendance.length;
                            const present = viewAttendance.filter((a) => a.status === "present").length;
                            const absent = total - present;
                            const pct = total > 0 ? Math.round((present / total) * 100) : 0;
                            return (
                              <>
                                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-center">
                                  <p className="text-xs text-gray-400 font-medium">Total Days</p>
                                  <p className="text-2xl font-bold text-gray-800">{total}</p>
                                </div>
                                <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-center">
                                  <p className="text-xs text-green-500 font-medium">Present</p>
                                  <p className="text-2xl font-bold text-green-700">{present}</p>
                                </div>
                                <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
                                  <p className="text-xs text-red-500 font-medium">Absent</p>
                                  <p className="text-2xl font-bold text-red-700">{absent}</p>
                                </div>
                                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                                  <p className="text-xs text-amber-500 font-medium">Percentage</p>
                                  <p className={`text-2xl font-bold ${pct >= 75 ? "text-green-700" : pct >= 50 ? "text-amber-700" : "text-red-700"}`}>{pct}%</p>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* Attendance Table */}
                        <p className="text-sm font-bold text-gray-800">Attendance Record</p>
                        <div className="rounded-xl border border-gray-200 overflow-hidden table-scroll">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Subject</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {[...viewAttendance]
                                .sort((a, b) => new Date(b.date) - new Date(a.date))
                                .slice(0, 30)
                                .map((record, idx) => (
                                  <tr key={record._id || idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-gray-700">
                                      {new Date(record.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                    </td>
                                    <td className="px-4 py-2">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                        record.status === "present"
                                          ? "bg-green-50 text-green-700"
                                          : "bg-red-50 text-red-700"
                                      }`}>
                                        {record.status === "present" ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                                        {record.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-gray-500">{record.subject || "-"}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                          {viewAttendance.length > 30 && (
                            <div className="px-4 py-2 bg-gray-50 text-xs text-gray-400 text-center">
                              Showing latest 30 of {viewAttendance.length} records
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <CalendarDays size={40} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-sm text-gray-400">No attendance records found.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Fees Tab */}
                {!loadingViewData && viewTab === "fees" && (
                  viewFees.length === 0 ? (
                    <div className="py-12 text-center">
                      <Wallet size={40} className="mx-auto mb-3 text-gray-300" />
                      <p className="text-sm text-gray-400">No fee invoices found for this student.</p>
                    </div>
                  ) : (
                    (() => {
                      const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
                      const sessions = [
                        ...new Map(
                          viewFees.map((inv) => {
                            const id = String(inv?.academicYearId || "unassigned");
                            return [id, { id, label: getSessionLabel(inv?.academicYearId, viewStudent?.academicYear || "Session") }];
                          })
                        ).values(),
                      ];
                      const activeId = sessions.some((x) => x.id === feeSession) ? feeSession : sessions[0]?.id || "unassigned";
                      const activeLabel = sessions.find((x) => x.id === activeId)?.label || "Session";
                      const rows = viewFees.filter((inv) => String(inv?.academicYearId || "unassigned") === String(activeId));
                      const totalInvoiced = rows.reduce((s, i) => s + Number(i?.totalAmount || 0), 0);
                      const totalPaid = rows.reduce((s, i) => s + Number(i?.paidAmount || 0), 0);
                      const totalBalance = rows.reduce((s, i) => s + Number(i?.balanceAmount || 0), 0);
                      const first = rows[0] || {};
                      const heads = Array.isArray(first.feeHeadsSnapshot) ? first.feeHeadsSnapshot : [];
                      const installments = Array.isArray(first.installmentsSnapshot) ? first.installmentsSnapshot : [];
                      const className = viewStudent?.class || viewStudent?.grade || "—";
                      const invoiceTitle = first.title || "Annual Fees";
                      const dueDate = first.dueDate
                        ? new Date(first.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                        : "—";
                      const feeStatus = totalInvoiced === 0
                        ? "N/A"
                        : totalBalance <= 0
                          ? "Paid"
                          : totalPaid > 0
                            ? "Partial"
                            : "Due";
                      const statusCls = feeStatus === "Paid"
                        ? "bg-green-50 text-green-700"
                        : feeStatus === "Partial"
                          ? "bg-amber-50 text-amber-700"
                          : feeStatus === "Due"
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-100 text-gray-600";
                      const ord = (i) => ["1st", "2nd", "3rd", "4th", "5th", "6th"][i] || `${i + 1}th`;
                      // No per-installment paid flag in the snapshot — allocate the
                      // invoice's paid amount across installments in order.
                      const installmentRows = (() => {
                        let remaining = totalPaid;
                        return installments.map((h, i) => {
                          const amt = Number(h?.amount || 0);
                          let st;
                          if (amt > 0 && remaining >= amt) { st = "Paid"; remaining -= amt; }
                          else if (remaining > 0) { st = "Partial"; remaining = 0; }
                          else { st = "Unpaid"; }
                          return { label: h?.label || ord(i), amt, st };
                        });
                      })();

                      return (
                        <div className="space-y-4">
                          {/* Header */}
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="flex items-center gap-2.5 text-base font-bold text-gray-900">
                              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                <Wallet size={16} />
                              </span>
                              Fees
                            </p>
                            {sessions.length > 0 && (
                              <div className="relative">
                                <select
                                  value={activeId}
                                  onChange={(e) => setFeeSession(e.target.value)}
                                  className="appearance-none rounded-lg border border-gray-300 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                >
                                  {sessions.map((x) => (
                                    <option key={x.id} value={x.id}>Session: {x.label}</option>
                                  ))}
                                </select>
                                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                              </div>
                            )}
                          </div>

                          {/* Stat cards */}
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                              <p className="text-xs font-medium text-blue-500">Structure Total</p>
                              <p className="mt-0.5 text-lg font-bold text-blue-700">{inr(totalInvoiced)}</p>
                            </div>
                            <div className="rounded-xl border border-green-100 bg-green-50 p-3">
                              <p className="text-xs font-medium text-green-500">Paid</p>
                              <p className="mt-0.5 text-lg font-bold text-green-700">{inr(totalPaid)}</p>
                            </div>
                            <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                              <p className="text-xs font-medium text-red-500">Outstanding</p>
                              <p className="mt-0.5 text-lg font-bold text-red-700">{inr(totalBalance)}</p>
                            </div>
                            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                              <p className="text-xs font-medium text-blue-500">Invoices</p>
                              <p className="mt-0.5 text-lg font-bold text-blue-700">{rows.length}</p>
                            </div>
                          </div>

                          {/* Two columns */}
                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            {/* Left */}
                            <div className="space-y-4">
                              <div className="rounded-xl border border-gray-200 p-4">
                                <p className="mb-1 text-sm font-bold text-gray-900">Fee Heads</p>
                                {heads.length > 0 ? (
                                  <div className="divide-y divide-gray-50">
                                    {heads.map((h, i) => (
                                      <div key={i} className="flex items-center justify-between py-2 text-sm">
                                        <span className="text-gray-600">{h?.label || "Fee"}</span>
                                        <span className="font-semibold text-gray-900">{inr(h?.amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="py-2 text-sm text-gray-400">No fee heads on this invoice.</p>
                                )}
                              </div>
                              <div className="rounded-xl border border-gray-200 p-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-xs text-gray-400">Session</p>
                                    <p className="mt-0.5 text-sm font-medium text-gray-800">{activeLabel}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-400">Class</p>
                                    <p className="mt-0.5 text-sm font-medium text-gray-800">{className}</p>
                                    <p className="text-xs text-gray-400">{invoiceTitle}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Right */}
                            <div className="space-y-4">
                              <div className="rounded-xl border border-gray-200 p-4">
                                <p className="mb-1 text-sm font-bold text-gray-900">Installments</p>
                                {installmentRows.length > 0 ? (
                                  <div className="divide-y divide-gray-50">
                                    {installmentRows.map((h, i) => (
                                      <div key={i} className="flex items-center justify-between gap-2 py-2 text-sm">
                                        <span className="flex items-center gap-2 text-gray-600">
                                          {h.label}
                                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                            h.st === "Paid"
                                              ? "bg-green-50 text-green-700"
                                              : h.st === "Partial"
                                                ? "bg-amber-50 text-amber-700"
                                                : "bg-gray-100 text-gray-500"
                                          }`}>
                                            {h.st === "Partial" ? "Partly paid" : h.st === "Paid" ? "Paid" : "Unpaid"}
                                          </span>
                                        </span>
                                        <span className="font-semibold text-gray-900">{inr(h.amt)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="py-2 text-sm text-gray-400">No installment plan.</p>
                                )}
                              </div>

                              <div className="rounded-xl border border-gray-200 p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-bold text-gray-900">Invoices</p>
                                    <p className="mt-1 text-2xl font-bold text-gray-900">{rows.length}</p>
                                  </div>
                                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                                    <IndianRupee size={18} />
                                  </span>
                                </div>
                              </div>

                              <div className="rounded-xl border border-gray-200 p-4">
                                <p className="mb-2 text-sm font-bold text-gray-900">Fee Summary</p>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-gray-100 text-left text-gray-400">
                                        <th className="pb-1.5 pr-3 font-medium">Session</th>
                                        <th className="pb-1.5 pr-3 font-medium">Class</th>
                                        <th className="pb-1.5 pr-3 font-medium">Total</th>
                                        <th className="pb-1.5 pr-3 font-medium">Paid</th>
                                        <th className="pb-1.5 pr-3 font-medium">Balance</th>
                                        <th className="pb-1.5 pr-3 font-medium">Due Date</th>
                                        <th className="pb-1.5 font-medium">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td className="py-2 pr-3 text-gray-700">{activeLabel}</td>
                                        <td className="py-2 pr-3 text-gray-700">
                                          {className}
                                          <span className="block text-[10px] text-gray-400">{invoiceTitle}</span>
                                        </td>
                                        <td className="py-2 pr-3 text-gray-700">{inr(totalInvoiced)}</td>
                                        <td className="py-2 pr-3 text-green-700">{inr(totalPaid)}</td>
                                        <td className="py-2 pr-3 text-red-700">{inr(totalBalance)}</td>
                                        <td className="py-2 pr-3 text-gray-500">{dueDate}</td>
                                        <td className="py-2">
                                          <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${statusCls}`}>{feeStatus}</span>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => openEditWizard(viewStudent)}
                  className="px-5 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-sm rounded-lg hover:from-yellow-600 hover:to-amber-600 flex items-center gap-2 transition"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => { setShowViewModal(false); setViewStudent(null); }}
                  className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition"
                >
                  Close
                </button>

              </div>
            </Motion.div>
          </Motion.div>
        )}
        </AnimatePresence>

        <DocPreviewModal
          open={!!docPreview}
          src={docPreview?.src}
          label={docPreview?.label}
          onClose={() => setDocPreview(null)}
        />

        {/* Bulk import progress — blocking, non-dismissible */}
        {importJob && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Uploading students…</h3>
              <p className="mt-1 text-xs text-gray-500">
                Please wait and do not refresh or close this window.
              </p>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-amber-500 transition-[width] duration-300"
                  style={{ width: `${importJob.total ? Math.round((importJob.processed / importJob.total) * 100) : 0}%` }}
                />
              </div>
              <p className="mt-2 text-sm font-semibold text-gray-800">
                {importJob.processed > 0
                  ? `${importJob.processed} / ${importJob.total} students`
                  : "Preparing records…"}
              </p>
              {importJob.failed > 0 && (
                <p className="mt-1 text-xs text-red-500">
                  {importJob.failed} row{importJob.failed === 1 ? "" : "s"} could not be imported
                </p>
              )}
            </div>
          </div>
        )}

        {/* Bulk delete progress — blocking, non-dismissible */}
        {deleteJob && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <Loader2 className="h-6 w-6 animate-spin text-red-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Deleting students…</h3>
              <p className="mt-1 text-xs text-gray-500">
                Please do not refresh or close this window.
              </p>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-red-500 transition-[width] duration-300"
                  style={{ width: `${deleteJob.total ? Math.round((deleteJob.processed / deleteJob.total) * 100) : 0}%` }}
                />
              </div>
              <p className="mt-2 text-sm font-semibold text-gray-800">
                {deleteJob.phase === "parents"
                  ? "Cleaning up linked parent accounts…"
                  : `${deleteJob.processed} / ${deleteJob.total} students`}
              </p>
            </div>
          </div>
        )}

        {/* Bulk archive/restore progress — blocking, non-dismissible */}
        {bulkOpJob && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
              <div
                className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
                  bulkOpJob.mode === "archive" ? "bg-blue-50" : "bg-green-50"
                }`}
              >
                <Loader2
                  className={`h-6 w-6 animate-spin ${bulkOpJob.mode === "archive" ? "text-blue-500" : "text-green-500"}`}
                />
              </div>
              <h3 className="text-base font-bold text-gray-900">
                {bulkOpJob.mode === "archive" ? "Archiving students…" : "Restoring students…"}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Please do not refresh or close this window.
              </p>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    bulkOpJob.mode === "archive" ? "bg-blue-500" : "bg-green-500"
                  }`}
                  style={{ width: `${bulkOpJob.total ? Math.round((bulkOpJob.processed / bulkOpJob.total) * 100) : 0}%` }}
                />
              </div>
              <p className="mt-2 text-sm font-semibold text-gray-800">
                {bulkOpJob.processed} / {bulkOpJob.total} students
              </p>
            </div>
          </div>
        )}

        {showDetailModal && editingStudent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-amber-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                      {editingStudent.profilePic ? (
                        <img
                          src={editingStudent.profilePic}
                          alt={editingStudent.name || "Student"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        editingStudent.name?.charAt(0) || "?"
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        {editingStudent.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Roll: {editingStudent.roll} | {editingStudent.class} - {editingStudent.section}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setEditingStudent(null);
                      setEditSelectedClassId("");
                    }}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-white/50 transition"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleUpdateStudent} className="overflow-y-auto max-h-[70vh]">
                <div className="p-6 space-y-6">
                  {/* Personal Information */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <Users size={20} className="text-yellow-600" />
                      Personal Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editingStudent.name || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, name: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={editingStudent.email || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, email: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Mobile <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={editingStudent.mobile || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, mobile: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Gender <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={(editingStudent.gender || "").toLowerCase()}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, gender: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                          required
                        >
                          <option value="">Select</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          value={toDateInputValue(editingStudent.dob)}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, dob: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Blood Group
                        </label>
                        <select
                          value={editingStudent.bloodGroup || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, bloodGroup: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                        >
                          <option value="">Select</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Current Address
                        </label>
                        <textarea
                          value={editingStudent.address || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, address: e.target.value })
                          }
                          rows={2}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Permanent Address
                        </label>
                        <textarea
                          value={editingStudent.permanentAddress || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, permanentAddress: e.target.value })
                          }
                          rows={2}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Academic Information */}
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <BookOpen size={20} className="text-blue-600" />
                      Academic Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Admission Number
                        </label>
                        <input
                          type="text"
                          value={editingStudent.admissionNumber || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, admissionNumber: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Roll Number <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={editingStudent.roll || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, roll: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          required
                        >
                          <option value="">Select Roll Number</option>
                          {editRollOptions.map((roll) => (
                            <option key={roll} value={roll}>
                              {roll}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Class <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={editSelectedClassId}
                          onChange={handleEditClassChange}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          required
                        >
                          <option value="">Select Class</option>
                          {academicClasses.map((classItem) => (
                            <option key={classItem._id} value={classItem._id}>
                              {classItem.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Section <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={editSelectedSectionId}
                          onChange={(e) => {
                            const nextSectionId = e.target.value;
                            const selectedSection = editFormSectionOptions.find(s => s.id === nextSectionId);
                            setEditSelectedSectionId(nextSectionId);
                            setEditingStudent(prev => ({ ...prev, section: selectedSection?.name || '' }));
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          disabled={!editSelectedClassId}
                          required
                        >
                          <option value="">Select Section</option>
                          {editFormSectionOptions.map((section) => (
                            <option key={section.id} value={section.id}>
                              {section.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Admission Date
                        </label>
                        <input
                          type="date"
                          value={toDateInputValue(editingStudent.admissionDate)}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, admissionDate: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Academic Year
                        </label>
                        <select
                          value={editingStudent.academicYear || ""}
                          onChange={(e) => {
                            const yearName = e.target.value;
                            const selectedYear = academicYears.find(y => y.name === yearName);
                            setEditingStudent({ ...editingStudent, academicYear: yearName });
                            setEditSelectedAcademicYearId(selectedYear?._id || '');
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="">Select Academic Year</option>
                          {editAcademicYearOptions.map((yearName) => (
                            <option key={yearName} value={yearName}>
                              {yearName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Guardian Information */}
                  <div className="bg-green-50 rounded-xl p-4">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <Phone size={20} className="text-green-600" />
                      Guardian / Parent Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Father's Name
                        </label>
                        <input
                          type="text"
                          value={editingStudent.fatherName || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, fatherName: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Father's Phone
                        </label>
                        <input
                          type="tel"
                          value={editingStudent.fatherPhone || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, fatherPhone: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Father's Occupation
                        </label>
                        <input
                          type="text"
                          value={editingStudent.fatherOccupation || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, fatherOccupation: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Mother's Name
                        </label>
                        <input
                          type="text"
                          value={editingStudent.motherName || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, motherName: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Mother's Phone
                        </label>
                        <input
                          type="tel"
                          value={editingStudent.motherPhone || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, motherPhone: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Mother's Occupation
                        </label>
                        <input
                          type="text"
                          value={editingStudent.motherOccupation || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, motherOccupation: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Guardian Name
                        </label>
                        <input
                          type="text"
                          value={editingStudent.guardianName || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, guardianName: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Guardian Phone
                        </label>
                        <input
                          type="tel"
                          value={editingStudent.guardianPhone || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, guardianPhone: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Guardian Email
                        </label>
                        <input
                          type="email"
                          value={editingStudent.guardianEmail || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, guardianEmail: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Medical Information */}
                  <div className="bg-red-50 rounded-xl p-4">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <Heart size={20} className="text-red-600" />
                      Medical Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Known Health Issues
                        </label>
                        <textarea
                          value={editingStudent.knownHealthIssues || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, knownHealthIssues: e.target.value })
                          }
                          rows={2}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Allergies
                        </label>
                        <textarea
                          value={editingStudent.allergies || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, allergies: e.target.value })
                          }
                          rows={2}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Additional Information */}
                  <div className="bg-purple-50 rounded-xl p-4">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">
                      Additional Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Status
                        </label>
                        <select
                          value={editingStudent.status || "Active"}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, status: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                          <option value="Alumni">Alumni</option>
                          <option value="Dropped">Dropped</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Pincode
                        </label>
                        <input
                          type="text"
                          value={editingStudent.pincode || editingStudent.pinCode || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, pincode: e.target.value, pinCode: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Birth Place
                        </label>
                        <input
                          type="text"
                          value={editingStudent.birthPlace || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, birthPlace: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nationality
                        </label>
                        <input
                          type="text"
                          value={editingStudent.nationality || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, nationality: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Religion
                        </label>
                        <input
                          type="text"
                          value={editingStudent.religion || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, religion: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category
                        </label>
                        <input
                          type="text"
                          value={editingStudent.category || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, category: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Caste
                        </label>
                        <input
                          type="text"
                          value={editingStudent.caste || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, caste: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Immunization Status
                        </label>
                        <input
                          type="text"
                          value={editingStudent.immunizationStatus || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, immunizationStatus: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Learning Disabilities
                        </label>
                        <input
                          type="text"
                          value={editingStudent.learningDisabilities || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, learningDisabilities: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Aadhar Number
                        </label>
                        <input
                          type="text"
                          value={editingStudent.aadharNumber || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, aadharNumber: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Birth Certificate No.
                        </label>
                        <input
                          type="text"
                          value={editingStudent.birthCertificateNo || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, birthCertificateNo: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Serial No.
                        </label>
                        <input
                          type="number"
                          value={editingStudent.serialNo || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, serialNo: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Application ID
                        </label>
                        <input
                          type="text"
                          value={editingStudent.applicationId || ""}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, applicationId: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Application Date
                        </label>
                        <input
                          type="date"
                          value={toDateInputValue(editingStudent.applicationDate)}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, applicationDate: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Approval Status
                        </label>
                        <select
                          value={editingStudent.approvalStatus || "Pending"}
                          onChange={(e) =>
                            setEditingStudent({ ...editingStudent, approvalStatus: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Remarks
                      </label>
                      <textarea
                        value={editingStudent.remarks || ""}
                        onChange={(e) =>
                          setEditingStudent({ ...editingStudent, remarks: e.target.value })
                        }
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      setEditingStudent(null);
                      setEditSelectedClassId("");
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-lg hover:from-yellow-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition"
                  >
                    {isUpdating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Edit2 size={16} />
                        Update Student
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <AnimatePresence>
        {showArchiveModal && (
          <Motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] max-h-[80vh] overflow-hidden border border-gray-200 flex flex-col"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.34, 1.1, 0.64, 1] }}
            >
              <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
                <h3 className="text-xl font-semibold text-gray-900">Archived Students</h3>
                <div className="flex items-center gap-2">
                  {selectedArchivedStudentIds.length > 0 && (
                    <button
                      onClick={handleBulkUnarchiveStudents}
                      disabled={archiveActionLoading}
                      className="inline-flex items-center gap-2 px-3 py-0.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-sm disabled:opacity-50"
                    >
                      <RotateCcw size={14} />
                      {archiveActionLoading
                        ? "Restoring..."
                        // : `Restore Selected (${selectedArchivedStudentIds.length})`}
                        : `Restore All`}
                    </button>
                  )}
                  <button
                    onClick={() => setShowArchiveModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded-full border-2 border-amber-200 bg-white text-amber-500 focus:ring-2 focus:ring-amber-200 focus:ring-offset-0 cursor-pointer transition shadow-sm"
                          checked={
                            archivedStudents.length > 0 &&
                            archivedStudents.every((student) =>
                              selectedArchivedStudentIds.includes(String(student?._id || ""))
                            )
                          }
                          onChange={toggleSelectAllArchived}
                          aria-label="Select all archived students"
                        />
                      </th>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Session</th>
                      <th className="px-4 py-3 text-left">Class</th>
                      <th className="px-4 py-3 text-left">Roll</th>
                      <th className="px-4 py-3 text-left">Phone</th>
                      <th className="px-4 py-3 text-right">Due</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedStudents.map((student) => (
                      <tr key={student._id} className="border-t">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="h-5 w-5 rounded-full border-2 border-amber-200 bg-white text-amber-500 focus:ring-2 focus:ring-amber-200 focus:ring-offset-0 cursor-pointer transition shadow-sm"
                            checked={selectedArchivedStudentIds.includes(String(student?._id || ""))}
                            onChange={() => toggleArchivedStudentSelection(student?._id)}
                            aria-label={`Select archived ${student.name || "student"}`}
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {student.name || student.studentName || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {student.academicYear ||
                            getSessionLabel(student.academicYearId, "—")}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {(() => {
                            const cls =
                              student.archivedPlacement?.grade ||
                              student.class ||
                              student.grade ||
                              student.course ||
                              "";
                            const sec =
                              student.archivedPlacement?.section || student.section || "";
                            if (!cls) return "—";
                            return `${cls}${sec ? ` - ${sec}` : ""}`;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {/* grade/section/roll are moved to archivedPlacement on archive, so the live fields are blank */}
                          {student.archivedPlacement?.roll ??
                            student.roll ??
                            student.rollNumber ??
                            "—"}
                        </td>
                        {/* <td className="px-4 py-3 text-gray-600">
                          {(() => {
                            const cls =
                              student.archivedPlacement?.grade ||
                              student.class ||
                              student.grade ||
                              student.course ||
                              "";
                            const sec =
                              student.archivedPlacement?.section || student.section || "";
                            if (!cls) return "—";
                            return `${cls}${sec ? ` - ${sec}` : ""}`;
                          })()}
                        </td> */}
                        {/* <td className="px-4 py-3 text-gray-600">
                          {student.academicYear ||
                            getSessionLabel(student.academicYearId, "—")}
                        </td> */}
                        <td className="px-4 py-3 text-gray-600">
                          {student.mobile || "—"}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
                            Number(student.feeSummary?.totalDue) > 0 ? "text-red-600" : "text-gray-400"
                          }`}
                        >
                          {formatCurrency(student.feeSummary?.totalDue || 0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleUnarchiveStudent(student._id)}
                            disabled={archiveActionLoading}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed min-w-[104px] justify-center"
                          >
                            {restoringStudentId === String(student._id) ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                Restoring…
                              </>
                            ) : (
                              <>
                                <RotateCcw size={14} />
                                Restore
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!archivedStudents.length && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-10 text-center text-gray-500"
                        >
                          No archived students.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t flex justify-end flex-shrink-0">
                <button
                  onClick={() => setShowArchiveModal(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 text-black"
                >
                  Close
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Students;
