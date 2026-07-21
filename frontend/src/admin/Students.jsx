import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  FileDown,
  Archive,
  RotateCcw,
  Trash2,
  Eye,
  KeyRound,
  Loader2,
  CalendarDays,
  Wallet,
} from "lucide-react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import CredentialGeneratorButton from "./components/CredentialGeneratorButton";

const API_BASE = import.meta.env.VITE_API_URL;
const STUDENTS_CACHE_PREFIX = "admin_students_cache_v1";
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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const importProgressTimerRef = useRef(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const deleteProgressTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [archivedStudents, setArchivedStudents] = useState([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveActionLoading, setArchiveActionLoading] = useState(false);
  const [selectedArchivedStudentIds, setSelectedArchivedStudentIds] = useState([]);
  const [isArchiving, setIsArchiving] = useState(false);
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
  const [loadingViewData, setLoadingViewData] = useState(false);
  const [viewTab, setViewTab] = useState("overview");

  const [newStudent, setNewStudent] = useState({
    // core
    name: "",
    email: "",
    mobile: "",
    gender: "",
    dob: "",
    address: "",
    permanentAddress: "",
    pincode: "",
    status: "Active",

    // Personal Details Extended
    birthPlace: "",
    nationality: "Indian",
    religion: "",
    caste: "",
    category: "",
    photograph: "",

    // Guardian/Parent Info
    guardianName: "",
    guardianEmail: "",
    guardianPhone: "",
    fatherName: "",
    fatherOccupation: "",
    fatherPhone: "",
    motherName: "",
    motherOccupation: "",
    motherPhone: "",

    // Emergency Contact
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",

    // Academic History
    previousSchoolName: "",
    previousClass: "",
    previousPercentage: "",
    transferCertificateNo: "",
    transferCertificateDate: "",
    reasonForLeaving: "",

    // Medical Info
    bloodGroup: "",
    knownHealthIssues: "",
    allergies: "",
    immunizationStatus: "",
    learningDisabilities: "",

    // Documents
    aadharNumber: "",
    birthCertificateNo: "",

    // Office Use
    applicationId: "",
    applicationDate: "",
    approvalStatus: "Pending",
    remarks: "",

    // academic
    serialNo: "",
    academicYear: "",
    admissionDate: "",
    admissionNumber: "",
    roll: "",
    class: "",
    section: "",
  });

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
      return Array.from(new Set([...classFromStudents, ...classFromCatalog])).sort();
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

      return Array.from(new Set([...sectionFromStudents, ...sectionFromCatalog])).sort();
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
      case "due":
      default:
        return "bg-red-100 text-red-800";
    }
  };

  const formatCurrency = (value = 0) =>
    `₹${Number(value || 0).toLocaleString()}`;

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
    invoices.forEach((invoice) => {
      const key = String(invoice?.studentId || "");
      if (!key) return;
      const total = Number(invoice?.totalAmount || 0);
      const paid = Number(invoice?.paidAmount || 0);
      const balance = Number(invoice?.balanceAmount || 0);
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

      if (!parent) return { ...student, feeSummary };

      return {
        ...student,
        feeSummary,
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
        return name.includes(query) || username.includes(query);
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
    if (!parent) return;
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

      const [profileRes, schoolsRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/admin/auth/profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${token}`,
          },
        }).then((res) => (res.ok ? res.json() : null)),
        fetch(`${API_BASE}/api/schools`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${token}`,
          },
        }).then((res) => (res.ok ? res.json() : [])),
      ]);

      const profile =
        profileRes.status === "fulfilled" && profileRes.value
          ? profileRes.value
          : null;
      const schools =
        schoolsRes.status === "fulfilled" && Array.isArray(schoolsRes.value)
          ? schoolsRes.value
          : [];
      const firstSchool = schools[0] || null;

      setEnrollContext({
        schoolName: firstSchool?.name || "NIF",
        campusType: profile?.campusType || "",
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
          ? classesRes.value
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

  // Fetch archived students from backend
  const refreshArchivedStudents = async () => {
    try {
      const token = localStorage.getItem("token");
      // console.log("Fetching archived students from:", `${API_BASE}/api/nif/students/archived`);
      // console.log("Using token:", token ? "Present" : "Missing");
      
      const res = await fetch(`${API_BASE}/api/nif/students/archived`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        },
      });
      // console.log("Response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        // console.log("Archived students data:", data);
        setArchivedStudents(Array.isArray(data) ? data : []);
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

    setIsBulkDeleting(true);
    setDeleteProgress(20);
    if (deleteProgressTimerRef.current) clearInterval(deleteProgressTimerRef.current);
    deleteProgressTimerRef.current = setInterval(() => {
      setDeleteProgress((prev) => {
        if (prev >= 90) return prev;
        const step = prev < 50 ? 8 : prev < 75 ? 4 : 2;
        return Math.min(90, prev + step);
      });
    }, 200);

    try {
      const res = await fetch(`${API_BASE}/api/admin/users/students/bulk`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ ids: selectedStudentIds }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || res.statusText);
      }

      if (deleteProgressTimerRef.current) {
        clearInterval(deleteProgressTimerRef.current);
        deleteProgressTimerRef.current = null;
      }
      setDeleteProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 400));

      const successCount = data.deletedCount || 0;
      const failedCount = Array.isArray(data.failedIds) ? data.failedIds.length : 0;

      setSelectedStudentIds([]);
      await refreshStudents();

      if (failedCount) {
        Swal.fire({
          icon: "warning",
          title: "Bulk Delete Completed",
          html: `<p><strong>${successCount}</strong> deleted, <strong>${failedCount}</strong> failed.</p>`,
        });
        return;
      }

      Swal.fire({
        icon: "success",
        title: "Students Deleted",
        text: `${successCount} student(s) deleted successfully.`,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Bulk Delete Failed",
        text: err.message || "Unable to delete selected students.",
      });
    } finally {
      if (deleteProgressTimerRef.current) {
        clearInterval(deleteProgressTimerRef.current);
        deleteProgressTimerRef.current = null;
      }
      setIsBulkDeleting(false);
      setDeleteProgress(0);
    }
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
    try {
      const results = await Promise.allSettled(
        selectedStudentIds.map((id) =>
          fetch(`${API_BASE}/api/nif/students/${id}/archive`, {
            method: "PUT",
            headers: {
              authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }).then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || data.message || res.statusText);
            }
            return true;
          })
        )
      );

      const failed = results.filter((r) => r.status === "rejected");
      const successCount = results.length - failed.length;

      setSelectedStudentIds([]);
      await refreshStudents();
      await refreshArchivedStudents();

      if (failed.length) {
        Swal.fire({
          icon: "warning",
          title: "Bulk Archive Completed",
          html: `<p><strong>${successCount}</strong> archived, <strong>${failed.length}</strong> failed.</p>`,
        });
        return;
      }

      Swal.fire({
        icon: "success",
        title: "Students Archived",
        text: `${successCount} student(s) archived successfully.`,
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Archive failed",
        text: err.message || "Unable to archive selected students.",
      });
    } finally {
      setIsArchiving(false);
    }
  };

  /* -------------------- Add Student -------------------- */
  const handleAddStudentChange = (e) => {
    const { name, value } = e.target;
    setNewStudent((prev) => ({ ...prev, [name]: value }));
  };

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
      "roll",
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
        admissionNumber: newStudent.admissionNumber,
        admissionDate: newStudent.admissionDate,
        roll: newStudent.roll,
        grade: newStudent.class,
        section: newStudent.section,
        academicYear: newStudent.academicYear,
        serialNo: newStudent.serialNo,
        status: newStudent.status,
        applicationId: newStudent.applicationId,
        applicationDate: newStudent.applicationDate,
        approvalStatus: newStudent.approvalStatus,
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
        remarks: newStudent.remarks,
      };

      payload.academicYearId = selectedAcademicYearId;
      payload.classId = selectedClassId;
      payload.sectionId = selectedSectionId;
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
          text: data.message || res.statusText,
        });
        return;
      }
      const studentId = data.studentCode || data.username || data.userId || "Generated";
      const studentPassword = data.password || "";
      const parentId = data?.parentCredentials?.userId || "";
      const parentPassword = data?.parentCredentials?.password || "";
      Swal.fire({
        icon: "success",
        title: "Student enrolled successfully!",
        html: `
          <div class="text-left space-y-2">
          <div><strong>Student ID:</strong> ${studentId}</div>
          ${studentPassword ? `<div><strong>Student Password:</strong> ${studentPassword}</div>` : ""}
          ${parentId ? `<div><strong>Parent ID:</strong> ${parentId}</div>` : ""}
          ${parentPassword ? `<div><strong>Parent Password:</strong> ${parentPassword}</div>` : ""}
          </div>
        `,
        confirmButtonColor: "#EAB308",
      });

      await refreshStudents();

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
            <p class="text-gray-700 mb-4"><strong>${student.name}</strong> can now log in with these credentials:</p>

            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
              <div>
                <p class="text-xs font-semibold text-yellow-700 uppercase mb-1">Student ID</p>
                <div class="flex items-center justify-between bg-white rounded px-3 py-2 border border-yellow-100">
                  <code class="text-sm font-mono text-gray-800">${loginId}</code>
                  <button
                    onclick="navigator.clipboard.writeText('${loginId}')"
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
                  <code class="text-sm font-mono text-gray-800">${loginPassword}</code>
                  <button
                    onclick="navigator.clipboard.writeText('${loginPassword}')"
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

  const handleViewStudentCredentials = (student) => {
    if (!student) return;
    const loginId = student.username || student.studentCode || "-";
    const studentResetAt = student.lastLoginAt ? new Date(student.lastLoginAt) : null;
    const passwordValue = studentResetAt
      ? `Password reset by the user at ${studentResetAt.toLocaleDateString()}`
      : student.initialPassword || "Not available";
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
    const parentPassword = parentResetAt
      ? `Password reset by the user at ${parentResetAt.toLocaleDateString()}`
      : parent?.initialPassword || "Not available";
    Swal.fire({
      icon: "info",
      title: "Student Credentials",
      html: `
        <div class="text-left space-y-3">
          <div>
            <div class="text-xs font-semibold text-gray-500 uppercase">Student ID</div>
            <div class="font-mono text-sm text-gray-900">${loginId}</div>
          </div>
          <div>
            <div class="text-xs font-semibold text-gray-500 uppercase">Password</div>
            <div class="font-mono text-sm text-gray-900">${passwordValue}</div>
          </div>
          <div class="pt-2 border-t border-gray-200"></div>
          <div>
            <div class="text-xs font-semibold text-gray-500 uppercase">Parent ID</div>
            <div class="font-mono text-sm text-gray-900">${parentId}</div>
          </div>
          <div>
            <div class="text-xs font-semibold text-gray-500 uppercase">Parent Password</div>
            <div class="font-mono text-sm text-gray-900">${parentPassword}</div>
          </div>
        </div>
      `,
      confirmButtonColor: "#EAB308",
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
               <div class="text-sm text-gray-600 mt-2">${student.name}</div>`,
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
      await refreshStudents();
      await refreshArchivedStudents();
      Swal.fire({
        icon: "success",
        title: "Student restored",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: "error",
        title: "Unable to restore student",
        text: err.message || "Please try again",
      });
    } finally {
      setArchiveActionLoading(false);
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

    try {
      setArchiveActionLoading(true);
      const results = await Promise.allSettled(
        selectedArchivedStudentIds.map((studentId) =>
          fetch(`${API_BASE}/api/nif/students/${studentId}/unarchive`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(data.message || "Failed to restore student");
            }
            return true;
          })
        )
      );

      const failed = results.filter((item) => item.status === "rejected");
      const successCount = results.length - failed.length;

      setSelectedArchivedStudentIds([]);
      await refreshStudents();
      await refreshArchivedStudents();

      if (failed.length) {
        Swal.fire({
          icon: "warning",
          title: "Bulk Restore Completed",
          html: `<p><strong>${successCount}</strong> restored, <strong>${failed.length}</strong> failed.</p>`,
        });
        return;
      }

      Swal.fire({
        icon: "success",
        title: "Students restored",
        text: `${successCount} student(s) restored successfully.`,
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Restore failed",
        text: err.message || "Failed to restore selected students",
      });
    } finally {
      setArchiveActionLoading(false);
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
    const rows = [
      {
        name: "Aarav Sharma",
        mobile: "9876543210",
        gender: "male",
        batchCode: "2026-27",
        admissionDate: "2026-04-01",
        roll: "12",
        section: "A",
        class: "10",
        email: "aarav.sharma@example.com",
        dob: "2010-05-14",
        address: "Kolkata",
        pincode: "700001",
        guardianName: "Rajesh Sharma",
        guardianPhone: "9876500000",
        serialNo: "1001",
        formNo: "F-2026-011",
        enrollmentNo: "ENR-2026-011",
        guardianEmail: "rajesh.sharma@example.com",
        status: "Active",
        bloodGroup: "O+",
        permanentAddress: "Kolkata",
        nationality: "Indian",
        religion: "Hindu",
        category: "General",
      },
      {
        name: "Ananya Das",
        mobile: "9123456780",
        gender: "female",
        batchCode: "2026-27",
        admissionDate: "2026-04-01",
        roll: "13",
        section: "A",
        class: "10",
        email: "ananya.das@example.com",
        dob: "2010-08-22",
        address: "Howrah",
        pincode: "711101",
        guardianName: "Sanjay Das",
        guardianPhone: "9123400000",
        serialNo: "1002",
        formNo: "F-2026-012",
        enrollmentNo: "ENR-2026-012",
        guardianEmail: "sanjay.das@example.com",
        status: "Active",
        bloodGroup: "A+",
        permanentAddress: "Howrah",
        nationality: "Indian",
        religion: "Hindu",
        category: "General",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
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

      // Process each row
      for (let r = startRow; r < rows.length; r++) {
        const raw = rows[r];

        // Skip empty rows
        if (!raw || raw.every((c) => !String(c || "").trim())) continue;

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

        // Check required fields (let backend handle validation)
        if (!student.name || !student.mobile || !student.gender ||
            !student.batchCode || !student.admissionDate ||
            !student.roll || !student.section || !student.class) {
          skippedRows.push({
            row: r + 1,
            reason: "Missing required fields"
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
          status: student.status || "Active",
          guardianName: student.guardianName || "",
          guardianEmail: student.guardianEmail ? student.guardianEmail.toLowerCase() : "",
          guardianPhone: student.guardianPhone || "",
          bloodGroup: student.bloodGroup || "",
          nationality: student.nationality || "",
          religion: student.religion || "",
          category: student.category || "",
          serialNo: student.serialNo ? Number(student.serialNo) : undefined,
          batchCode: student.batchCode,
          admissionDate,
          roll: student.roll,
          grade: student.class || "",
          section: student.section,
          course: student.class || "",
          formNo: student.formNo || "",
          enrollmentNo: student.enrollmentNo || "",
        });
      }

      if (!payload.length) {
        Swal.fire({
          icon: "warning",
          title: "No Valid Rows",
          html: skippedRows.length > 0 ? `<div style="text-align: left;">
            <p>All rows were skipped due to validation errors:</p>
            <ul style="max-height: 300px; overflow-y: auto;">
              ${skippedRows.slice(0, 20).map(s =>
                `<li>Row ${s.row}: ${s.reason}</li>`
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
                `<li>Row ${s.row}: ${s.reason}</li>`
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

      // Debug: Log first student to console
      console.log("Sending to backend:", {
        count: payload.length,
        firstStudent: payload[0],
        sample: payload[0]
      });

      const res = await fetch(`${API_BASE}/api/nif/students/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ students: payload }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await Swal.fire({
          icon: "error",
          title: "Import failed",
          text: data.message || res.statusText,
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
                 `<li>Row ${err.index + 1}: ${err.message}</li>`
               ).join('')}
               ${data.errors.length > 10 ? `<li>...and ${data.errors.length - 10} more errors</li>` : ''}
             </ul>`
            : ''}
        </div>`,
        confirmButtonText: "OK"
      });

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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="flex-1 bg-gray-50 overflow-hidden flex flex-col">
      <div className="w-full flex-1 flex flex-col p-3 md:p-5 lg:p-6 overflow-hidden text-sm md:text-base">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:justify-between sm:items-center mb-4 flex-shrink-0">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              Student Management
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Manage and monitor all enrolled students
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-stretch sm:justify-start">
            <button
              onClick={downloadStudentDemoTemplate}
              className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
            >
              <FileDown size={15} />
              Demo Excel
            </button>
            <button
              onClick={handleRefreshTableData}
              disabled={tableRefreshing}
              className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-60 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
              title="Refresh students table data"
            >
              {tableRefreshing ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
              {tableRefreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="relative overflow-hidden border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-100 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition min-w-[130px]"
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

            <button
              onClick={() => setShowAddForm(true)}
              className="bg-amber-500 text-white px-3 py-2 rounded-lg hover:bg-amber-600 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
            >
              <Plus size={15} /> Add Student
            </button>
            <button
              onClick={toggleSelectAllFiltered}
              disabled={filteredStudentIds.length === 0}
              className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-60 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
              title={isAllFilteredSelected ? "Clear selection" : `Select all ${filteredStudentIds.length} student(s)`}
            >
              <CheckCircle size={15} />
              {isAllFilteredSelected ? "Deselect All" : `Select All (${filteredStudentIds.length})`}
            </button>
            {selectedStudentIds.length > 0 && (
              <button
                onClick={handleBulkArchiveStudents}
                disabled={isArchiving}
                className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
                title={`Archive ${selectedStudentIds.length} selected student(s)`}
              >
                <Archive size={15} />
                {isArchiving ? "Archiving..." : `Archive (${selectedStudentIds.length})`}
              </button>
            )}
            {selectedStudentIds.length > 0 && (
              <button
                onClick={handleBulkDeleteStudents}
                disabled={isBulkDeleting}
                className="relative overflow-hidden bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 disabled:opacity-100 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition min-w-[130px]"
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
                  {isBulkDeleting ? `Deleting... ${deleteProgress}%` : `Delete (${selectedStudentIds.length})`}
                </span>
              </button>
            )}
            <button
              onClick={() => setShowArchiveModal(true)}
              className="border border-gray-200 bg-white text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm flex-1 sm:flex-none justify-center transition"
            >
              <Archive size={15} /> Archived
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          {/* Filter Bar */}
          <div className="mb-3 bg-white rounded-xl border border-gray-200 p-3 md:p-4 flex-shrink-0 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="flex-1 min-w-[200px] relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, roll, email, or username..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Session Filter */}
              <select
                value={sessionFilter}
                onChange={(e) => { setSessionFilter(e.target.value); setClassFilter(""); setSectionFilter(""); }}
                disabled={!sessionOptions.length}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 min-w-[140px]"
              >
                {!sessionOptions.length && <option value="">No Active Session</option>}
                {sessionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Class Filter */}
              <select
                value={classFilter}
                onChange={(e) => { setClassFilter(e.target.value); setSectionFilter(""); }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 min-w-[130px]"
              >
                <option value="">All Classes</option>
                {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* Section Filter */}
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 min-w-[130px]"
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
            <div className="relative flex-1 overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              {isImporting && (
                <div className="sticky top-0 z-20 bg-blue-50/95 border-b border-blue-200">
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
              <table className="w-full min-w-[980px] border-collapse table-fixed">
                  <thead className="sticky top-0 z-10">
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
                  <tbody className={tableRefreshing || isImporting ? "opacity-70 animate-pulse" : ""}>
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
                                  {student.email || "No email"}
                                </div>
                                <div className="text-[11px] text-gray-400 truncate">
                                  ID: {student.username || student.studentCode || student.portalAccess?.username || "-"}
                                  {student.parent?.username ? ` · Parent: ${student.parent.username}` : ""}
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
                              <div className="text-gray-600">
                                {formatCurrency(student.feeSummary?.paidAmount)}/{formatCurrency(student.feeSummary?.totalFee)}
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <span
                                  className={`inline-flex px-1.5 py-0.5 text-xs rounded ${getFeeStatusClass(
                                    student.feeSummary?.status
                                  )}`}
                                >
                                  {student.feeSummary?.status || "N/A"}
                                </span>
                                <span className="text-xs text-red-600 font-semibold">
                                  {formatCurrency(student.feeSummary?.dueAmount)}
                                </span>
                              </div>
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
                                className="inline-flex items-center gap-1.5 rounded-md font-medium bg-amber-500 text-white hover:bg-amber-600 transition px-2.5 py-1 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                                disabled={isCredentialLoading}
                                title="View Credentials"
                              >
                                <KeyRound size={13} />
                                Credentials
                              </button>
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
                                  loadStudentForEdit(student);
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
                                className="inline-flex items-center px-1.5 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-md text-xs transition disabled:opacity-50"
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
                                className="inline-flex items-center px-1.5 py-1 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-md text-xs transition disabled:opacity-50"
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
                                  onClick={() => setShowAddForm(true)}
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
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0 pt-3 border-t border-gray-100 px-1">
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

        {/* Add Student Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden border border-gray-200">
              {/* Header */}
              <div className="bg-gradient-to-r from-yellow-500 to-amber-500 p-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <Plus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        Enroll New {enrollContext.schoolName}{" "}
                        {enrollContext.campusType ? `(${enrollContext.campusType}) ` : ""}
                        Student
                      </h2>
                      <p className="text-yellow-100 mt-1">
                        Complete all sections to register student
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-lg"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Steps (visual only) */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between max-w-2xl mx-auto">
                  {["Personal", "Academic", "Review"].map((step, idx) => (
                    <div key={step} className="flex items-center">
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                          idx === 0
                            ? "bg-yellow-500 border-yellow-500 text-white"
                            : "border-gray-300 text-gray-500"
                        } font-semibold text-sm`}
                      >
                        {idx + 1}
                      </div>
                      <span
                        className={`ml-2 text-sm font-medium ${
                          idx === 0 ? "text-yellow-600" : "text-gray-500"
                        }`}
                      >
                        {step}
                      </span>
                      {idx < 2 && (
                        <div className="w-12 h-0.5 bg-gray-300 mx-4" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Form */}
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <form
                  onSubmit={handleAddStudentSubmit}
                  className="space-y-8"
                >
                  {/* Personal */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center">
                        <Users className="w-3 h-3 text-yellow-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Personal Information
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700">
                          Full Name
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            name="name"
                            value={newStudent.name}
                            onChange={handleAddStudentChange}
                            required
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            placeholder="Enter student's full name"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Users className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700">
                          Mobile Number
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            name="mobile"
                            value={newStudent.mobile}
                            onChange={handleAddStudentChange}
                            required
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            placeholder="+91 98765 43210"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Phone className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700">
                          Email Address
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            name="email"
                            value={newStudent.email}
                            onChange={handleAddStudentChange}
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            placeholder="student@example.com"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Mail className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700">
                          Date of Birth
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            name="dob"
                            value={newStudent.dob}
                            onChange={handleAddStudentChange}
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 relative">
                        <label className="flex items-center text-sm font-medium text-gray-700">
                          Gender
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <select
                          name="gender"
                          value={newStudent.gender}
                          onChange={handleAddStudentChange}
                          required
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-none bg-white"
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                        <div className="pointer-events-none absolute right-3 top-[45px]">
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Pincode
                        </label>
                        <input
                          type="text"
                          name="pincode"
                          value={newStudent.pincode}
                          onChange={handleAddStudentChange}
                          maxLength={6}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Enter 6-digit pincode"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Present Address
                      </label>
                      <textarea
                        name="address"
                        value={newStudent.address}
                        onChange={handleAddStudentChange}
                        rows={2}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                        placeholder="Enter complete present address..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Permanent Address
                      </label>
                      <textarea
                        name="permanentAddress"
                        value={newStudent.permanentAddress}
                        onChange={handleAddStudentChange}
                        rows={2}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                        placeholder="Enter complete permanent address..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Birth Place
                        </label>
                        <input
                          type="text"
                          name="birthPlace"
                          value={newStudent.birthPlace}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="City/Town of birth"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Nationality
                        </label>
                        <input
                          type="text"
                          name="nationality"
                          value={newStudent.nationality}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Nationality"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Religion
                        </label>
                        <input
                          type="text"
                          name="religion"
                          value={newStudent.religion}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Religion"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Caste
                        </label>
                        <input
                          type="text"
                          name="caste"
                          value={newStudent.caste}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Caste"
                        />
                      </div>

                      <div className="space-y-2 relative">
                        <label className="text-sm font-medium text-gray-700">
                          Category
                        </label>
                        <select
                          name="category"
                          value={newStudent.category}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-none bg-white"
                        >
                          <option value="">Select Category</option>
                          <option value="General">General</option>
                          <option value="OBC">OBC</option>
                          <option value="SC">SC</option>
                          <option value="ST">ST</option>
                          <option value="EWS">EWS</option>
                          <option value="Other">Other</option>
                        </select>
                        <div className="pointer-events-none absolute right-3 top-[45px]">
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Student Photograph
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                // For now, just store the file name
                                // In production, you'd upload to Cloudinary/S3 here
                                setNewStudent(prev => ({
                                  ...prev,
                                  photograph: file.name
                                }));
                              }
                            }}
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                          />
                        </div>
                        {newStudent.photograph && (
                          <div className="text-sm text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Uploaded
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Upload a recent passport-size photograph (Max 2MB, JPG/PNG)
                      </p>
                    </div>
                  </div>

                  {/* Parent/Guardian Extended Information */}
                  <div className="space-y-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                        <Users className="w-3 h-3 text-purple-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Parent/Guardian Details
                      </h3>
                    </div>

                    <div className="space-y-2 relative">
                      <label className="text-sm font-medium text-gray-700">
                        Search Existing Parent (by name)
                      </label>
                      <input
                        type="text"
                        value={parentSearchTerm}
                        onChange={(e) => {
                          setParentSearchTerm(e.target.value);
                          setSelectedExistingParent(null);
                        }}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        placeholder="Type parent name to link existing parent"
                      />
                      {selectedExistingParent && (
                        <div className="text-xs text-green-700">
                          Linked parent: {selectedExistingParent.name || "-"} ({selectedExistingParent.username || "-"})
                        </div>
                      )}
                      {!selectedExistingParent && parentSearchTerm.trim() && matchedParents.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {matchedParents.map((parent) => (
                            <button
                              key={parent._id}
                              type="button"
                              onClick={() => handleSelectExistingParent(parent)}
                              className="w-full text-left px-4 py-2 hover:bg-yellow-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="text-sm font-medium text-gray-800">{parent.name || "Unnamed Parent"}</div>
                              <div className="text-xs text-gray-500">{parent.username || "-"} · {parent.mobile || "No mobile"}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Guardian Login Name
                        </label>
                        <input
                          type="text"
                          name="guardianName"
                          value={newStudent.guardianName}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Parent/Guardian full name"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Guardian Login Phone
                        </label>
                        <input
                          type="tel"
                          name="guardianPhone"
                          value={newStudent.guardianPhone}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="+91 90000 00000"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Guardian Login Email
                        </label>
                        <input
                          type="email"
                          name="guardianEmail"
                          value={newStudent.guardianEmail}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="guardian@example.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Academic History */}
                  <div className="space-y-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                        <BookOpen className="w-3 h-3 text-green-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Previous Academic History
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Previous School Name
                        </label>
                        <input
                          type="text"
                          name="previousSchoolName"
                          value={newStudent.previousSchoolName}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Name of previous school"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Class Last Attended
                        </label>
                        <input
                          type="text"
                          name="previousClass"
                          value={newStudent.previousClass}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="e.g., Class 10"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Percentage Obtained
                        </label>
                        <input
                          type="number"
                          name="previousPercentage"
                          value={newStudent.previousPercentage}
                          onChange={handleAddStudentChange}
                          min="0"
                          max="100"
                          step="0.01"
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Percentage"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Transfer Certificate No.
                        </label>
                        <input
                          type="text"
                          name="transferCertificateNo"
                          value={newStudent.transferCertificateNo}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="TC Number"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          TC Date
                        </label>
                        <input
                          type="date"
                          name="transferCertificateDate"
                          value={newStudent.transferCertificateDate}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Reason for Leaving
                        </label>
                        <input
                          type="text"
                          name="reasonForLeaving"
                          value={newStudent.reasonForLeaving}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Reason for leaving previous school"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Medical Information */}
                  <div className="space-y-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                        <Heart className="w-3 h-3 text-red-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Medical Information
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2 relative">
                        <label className="text-sm font-medium text-gray-700">
                          Blood Group
                        </label>
                        <select
                          name="bloodGroup"
                          value={newStudent.bloodGroup}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-none bg-white"
                        >
                          <option value="">Select Blood Group</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="Unknown">Unknown</option>
                        </select>
                        <div className="pointer-events-none absolute right-3 top-[45px]">
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-gray-700">
                          Known Health Issues
                        </label>
                        <input
                          type="text"
                          name="knownHealthIssues"
                          value={newStudent.knownHealthIssues}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Any known health conditions"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Allergies
                        </label>
                        <input
                          type="text"
                          name="allergies"
                          value={newStudent.allergies}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Any allergies"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Immunization Status
                        </label>
                        <input
                          type="text"
                          name="immunizationStatus"
                          value={newStudent.immunizationStatus}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Immunization completed/pending"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Learning Disabilities
                        </label>
                        <input
                          type="text"
                          name="learningDisabilities"
                          value={newStudent.learningDisabilities}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Any learning disabilities (if applicable)"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Documents */}
                  <div className="space-y-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                        <FileDown className="w-3 h-3 text-indigo-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Document Information
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Aadhar Number
                        </label>
                        <input
                          type="text"
                          name="aadharNumber"
                          value={newStudent.aadharNumber}
                          onChange={handleAddStudentChange}
                          maxLength="12"
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="12-digit Aadhar number"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Birth Certificate No.
                        </label>
                        <input
                          type="text"
                          name="birthCertificateNo"
                          value={newStudent.birthCertificateNo}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Birth certificate number"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Admission & Academic Details */}
                  <div className="space-y-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                        <BookOpen className="w-3 h-3 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Admission & Academic Details
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700">
                          Date of Admission
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            name="admissionDate"
                            value={newStudent.admissionDate}
                            onChange={handleAddStudentChange}
                            required
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {/* <Calendar className="w-4 h-4 text-gray-400" /> */}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Admission Number
                        </label>
                        <input
                          type="text"
                          name="admissionNumber"
                          value={newStudent.admissionNumber}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="e.g., ADM/2024/001"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Academic Session
                        </label>
                        <select
                          name="academicYear"
                          value={newStudent.academicYear}
                          onChange={(e) => {
                            const yearName = e.target.value;
                            const selectedYear = academicYears.find(y => y.name === yearName);
                            setNewStudent(prev => ({ ...prev, academicYear: yearName }));
                            setSelectedAcademicYearId(selectedYear?._id || '');
                          }}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-none bg-white"
                        >
                          <option value="">Select Session</option>
                          {academicYears.map((year) => (
                            <option key={year._id} value={year.name}>
                              {year.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2 relative">
                        <label className="flex items-center text-sm font-medium text-gray-700">
                          Class
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <select
                          name="class"
                          value={selectedClassId}
                          onChange={handleAcademicClassChange}
                          required
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-none bg-white"
                        >
                          <option value="">Select Class</option>
                          {addFormClassOptions.map((classItem) => (
                            <option key={classItem.id} value={classItem.id}>
                              {classItem.name}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-3 top-[45px]">
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>

                      <div className="space-y-2 relative">
                        <label className="flex items-center text-sm font-medium text-gray-700">
                          Section
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <select
                          name="section"
                          value={selectedSectionId}
                          onChange={(e) => {
                            const nextSectionId = e.target.value;
                            const selectedSection = addFormSectionOptions.find(s => s.id === nextSectionId);
                            setSelectedSectionId(nextSectionId);
                            setNewStudent(prev => ({ ...prev, section: selectedSection?.name || '' }));
                          }}
                          required
                          disabled={!selectedClassId}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-none bg-white"
                        >
                          <option value="">Select Section</option>
                          {addFormSectionOptions.map((section) => (
                            <option key={section.id} value={section.id}>
                              {section.name}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-3 top-[45px]">
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700">
                          Roll Number
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            name="roll"
                            value={newStudent.roll}
                            onChange={handleAddStudentChange}
                            required
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            placeholder="Enter roll number"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Hash className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Serial No
                        </label>
                        <input
                          type="number"
                          name="serialNo"
                          value={newStudent.serialNo}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Serial number (optional)"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Status
                        </label>
                        <select
                          name="status"
                          value={newStudent.status}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-none bg-white"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                          <option value="Alumni">Alumni</option>
                          <option value="Dropped">Dropped</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Office Use */}
                  <div className="space-y-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                        <AlertCircle className="w-3 h-3 text-gray-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Office Use Only
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Application ID
                        </label>
                        <input
                          type="text"
                          name="applicationId"
                          value={newStudent.applicationId}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="Auto-generated"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Application Date
                        </label>
                        <input
                          type="date"
                          name="applicationDate"
                          value={newStudent.applicationDate}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                      </div>

                      <div className="space-y-2 relative">
                        <label className="text-sm font-medium text-gray-700">
                          Approval Status
                        </label>
                        <select
                          name="approvalStatus"
                          value={newStudent.approvalStatus}
                          onChange={handleAddStudentChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-none bg-white"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                        <div className="pointer-events-none absolute right-3 top-[45px]">
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Remarks
                      </label>
                      <textarea
                        name="remarks"
                        value={newStudent.remarks}
                        onChange={handleAddStudentChange}
                        rows={2}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                        placeholder="Additional remarks or notes..."
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      All fields marked with{" "}
                      <span className="text-red-500">*</span> are required
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="px-8 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-xl hover:from-yellow-600 hover:to-amber-600 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Plus size={18} />
                        {isSubmitting ? "Enrolling..." : "Enroll Student"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
        {/* Student View Modal */}
        {showViewModal && viewStudent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 border border-gray-200 flex flex-col max-h-[90vh]">
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
                      <h3 className="text-xl font-bold text-gray-900">{viewStudent.name}</h3>
                      <p className="text-sm text-gray-500">
                        Roll: {viewStudent.roll} | {viewStudent.class || viewStudent.grade} - {viewStudent.section}
                        {viewStudent.admissionNumber ? ` | Adm: ${viewStudent.admissionNumber}` : ""}
                      </p>
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
                  <div className="space-y-5">
                    {/* Quick Stats Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-xl bg-blue-50 p-3 text-center">
                        <p className="text-xs text-blue-500 font-medium">Class</p>
                        <p className="text-lg font-bold text-blue-700">{viewStudent.class || viewStudent.grade || "-"} - {viewStudent.section || "-"}</p>
                      </div>
                      <div className="rounded-xl bg-green-50 p-3 text-center">
                        <p className="text-xs text-green-500 font-medium">Status</p>
                        <p className="text-lg font-bold text-green-700">{viewStudent.status || "Active"}</p>
                      </div>
                      <div className="rounded-xl bg-amber-50 p-3 text-center">
                        <p className="text-xs text-amber-500 font-medium">Attendance</p>
                        <p className="text-lg font-bold text-amber-700">
                          {viewAttendance.length > 0
                            ? `${Math.round((viewAttendance.filter((a) => a.status === "present").length / viewAttendance.length) * 100)}%`
                            : "-"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-purple-50 p-3 text-center">
                        <p className="text-xs text-purple-500 font-medium">Fees Due</p>
                        <p className="text-lg font-bold text-purple-700">
                          {viewFees.length > 0
                            ? `₹${viewFees.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0).toLocaleString("en-IN")}`
                            : "-"}
                        </p>
                      </div>
                    </div>

                    {/* Personal Info */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Users size={16} className="text-yellow-600" />
                        Personal Information
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          { label: "Email", value: viewStudent.email },
                          { label: "Mobile", value: viewStudent.mobile },
                          { label: "Gender", value: viewStudent.gender },
                          { label: "Date of Birth", value: toDateInputValue(viewStudent.dob) },
                          { label: "Blood Group", value: viewStudent.bloodGroup },
                          { label: "Nationality", value: viewStudent.nationality },
                          { label: "Religion", value: viewStudent.religion },
                          { label: "Category", value: viewStudent.category },
                          { label: "Aadhar", value: viewStudent.aadharNumber },
                        ]
                          .filter((f) => f.value)
                          .map((field) => (
                            <div key={field.label}>
                              <p className="text-xs text-gray-400">{field.label}</p>
                              <p className="text-sm font-medium text-gray-800 capitalize">{field.value}</p>
                            </div>
                          ))}
                      </div>
                      {(viewStudent.address || viewStudent.permanentAddress) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-200">
                          {viewStudent.address && (
                            <div>
                              <p className="text-xs text-gray-400">Current Address</p>
                              <p className="text-sm text-gray-700">{viewStudent.address}</p>
                            </div>
                          )}
                          {viewStudent.permanentAddress && (
                            <div>
                              <p className="text-xs text-gray-400">Permanent Address</p>
                              <p className="text-sm text-gray-700">{viewStudent.permanentAddress}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Academic Info */}
                    <div className="rounded-xl border border-gray-100 bg-blue-50/50 p-4">
                      <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <BookOpen size={16} className="text-blue-600" />
                        Academic Information
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {[
                          { label: "Admission No.", value: viewStudent.admissionNumber },
                          { label: "Roll Number", value: viewStudent.roll },
                          { label: "Class", value: viewStudent.class || viewStudent.grade },
                          { label: "Section", value: viewStudent.section },
                          { label: "Academic Year", value: viewStudent.academicYear },
                          { label: "Admission Date", value: toDateInputValue(viewStudent.admissionDate) },
                        ]
                          .filter((f) => f.value)
                          .map((field) => (
                            <div key={field.label}>
                              <p className="text-xs text-gray-400">{field.label}</p>
                              <p className="text-sm font-medium text-gray-800">{field.value}</p>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Parent / Guardian Info */}
                    <div className="rounded-xl border border-gray-100 bg-green-50/50 p-4">
                      <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Phone size={16} className="text-green-600" />
                        Parent / Guardian Information
                      </h4>
                      {viewParent && (
                        <div className="mb-3 rounded-lg bg-white border border-green-100 p-3">
                          <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Linked Parent Account</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <p className="text-xs text-gray-400">Name</p>
                              <p className="text-sm font-medium text-gray-800">{viewParent.name || "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Mobile</p>
                              <p className="text-sm font-medium text-gray-800">{viewParent.mobile || "-"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Email</p>
                              <p className="text-sm font-medium text-gray-800">{viewParent.email || "-"}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { label: "Father's Name", value: viewStudent.fatherName },
                          { label: "Father's Phone", value: viewStudent.fatherPhone },
                          { label: "Father's Occupation", value: viewStudent.fatherOccupation },
                          { label: "Mother's Name", value: viewStudent.motherName },
                          { label: "Mother's Phone", value: viewStudent.motherPhone },
                          { label: "Mother's Occupation", value: viewStudent.motherOccupation },
                          { label: "Guardian Name", value: viewStudent.guardianName },
                          { label: "Guardian Phone", value: viewStudent.guardianPhone },
                          { label: "Guardian Email", value: viewStudent.guardianEmail },
                        ]
                          .filter((f) => f.value)
                          .map((field) => (
                            <div key={field.label}>
                              <p className="text-xs text-gray-400">{field.label}</p>
                              <p className="text-sm font-medium text-gray-800">{field.value}</p>
                            </div>
                          ))}
                      </div>
                      {!viewParent && !viewStudent.fatherName && !viewStudent.motherName && !viewStudent.guardianName && (
                        <p className="text-sm text-gray-400">No parent/guardian information available.</p>
                      )}
                    </div>

                    {/* Medical */}
                    {(viewStudent.knownHealthIssues || viewStudent.allergies) && (
                      <div className="rounded-xl border border-gray-100 bg-red-50/50 p-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <Heart size={16} className="text-red-500" />
                          Medical Information
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {viewStudent.knownHealthIssues && (
                            <div>
                              <p className="text-xs text-gray-400">Known Health Issues</p>
                              <p className="text-sm text-gray-700">{viewStudent.knownHealthIssues}</p>
                            </div>
                          )}
                          {viewStudent.allergies && (
                            <div>
                              <p className="text-xs text-gray-400">Allergies</p>
                              <p className="text-sm text-gray-700">{viewStudent.allergies}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
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
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
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
                  <div className="space-y-4">
                    {viewFees.length > 0 ? (
                      <>
                        {/* Fee Summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {(() => {
                            const totalInvoiced = viewFees.reduce((s, i) => s + (i.totalAmount || 0), 0);
                            const totalPaid = viewFees.reduce((s, i) => s + (i.paidAmount || 0), 0);
                            const totalBalance = viewFees.reduce((s, i) => s + (i.balanceAmount || 0), 0);
                            const paidCount = viewFees.filter((i) => i.status === "paid").length;
                            return (
                              <>
                                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-center">
                                  <p className="text-xs text-gray-400 font-medium">Total Invoiced</p>
                                  <p className="text-xl font-bold text-gray-800">₹{totalInvoiced.toLocaleString("en-IN")}</p>
                                </div>
                                <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-center">
                                  <p className="text-xs text-green-500 font-medium">Paid</p>
                                  <p className="text-xl font-bold text-green-700">₹{totalPaid.toLocaleString("en-IN")}</p>
                                </div>
                                <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
                                  <p className="text-xs text-red-500 font-medium">Outstanding</p>
                                  <p className="text-xl font-bold text-red-700">₹{totalBalance.toLocaleString("en-IN")}</p>
                                </div>
                                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                                  <p className="text-xs text-amber-500 font-medium">Invoices Paid</p>
                                  <p className="text-2xl font-bold text-amber-700">{paidCount}/{viewFees.length}</p>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* Invoice Table */}
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Title</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Total</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Paid</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Balance</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Due Date</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {viewFees.map((invoice) => (
                                <tr key={invoice._id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2.5 text-gray-800 font-medium">{invoice.title || "-"}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700">₹{(invoice.totalAmount || 0).toLocaleString("en-IN")}</td>
                                  <td className="px-4 py-2.5 text-right text-green-700">₹{(invoice.paidAmount || 0).toLocaleString("en-IN")}</td>
                                  <td className="px-4 py-2.5 text-right text-red-700">₹{(invoice.balanceAmount || 0).toLocaleString("en-IN")}</td>
                                  <td className="px-4 py-2.5 text-gray-500">
                                    {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                      invoice.status === "paid"
                                        ? "bg-green-50 text-green-700"
                                        : invoice.status === "partial"
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-red-50 text-red-700"
                                    }`}>
                                      {invoice.status || "due"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <Wallet size={40} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-sm text-gray-400">No fee invoices found for this student.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => { setShowViewModal(false); setViewStudent(null); }}
                  className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowViewModal(false);
                    loadStudentForEdit(viewStudent);
                  }}
                  className="px-5 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-sm rounded-lg hover:from-yellow-600 hover:to-amber-600 flex items-center gap-2 transition"
                >
                  <Edit2 size={14} />
                  Edit Student
                </button>
              </div>
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

        {showArchiveModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] max-h-[80vh] overflow-hidden border border-gray-200 flex flex-col">
              <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
                <h3 className="text-xl font-semibold text-gray-900">Archived Students</h3>
                <div className="flex items-center gap-2">
                  {selectedArchivedStudentIds.length > 0 && (
                    <button
                      onClick={handleBulkUnarchiveStudents}
                      disabled={archiveActionLoading}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-sm disabled:opacity-50"
                    >
                      <RotateCcw size={14} />
                      {archiveActionLoading
                        ? "Restoring..."
                        : `Restore Selected (${selectedArchivedStudentIds.length})`}
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
                      <th className="px-4 py-3 text-left">Roll</th>
                      <th className="px-4 py-3 text-left">Program</th>
                      <th className="px-4 py-3 text-left">Course</th>
                      <th className="px-4 py-3 text-left">Phone</th>
                      <th className="px-4 py-3 text-right">Outstanding</th>
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
                          {student.roll}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {student.grade}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {student.course}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {student.mobile}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600 font-semibold">
                          {formatCurrency(student.feeSummary?.totalDue)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleUnarchiveStudent(student._id)}
                            disabled={archiveActionLoading}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-sm disabled:opacity-50"
                          >
                            <RotateCcw size={14} />
                            Restore
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Students;
