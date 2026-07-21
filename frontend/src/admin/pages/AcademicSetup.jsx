import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen, Calendar, Layers, Plus, Edit3, Trash2, X,
  ChevronUp, ChevronDown, ChevronsUpDown, Search, GraduationCap, Copy,
  FolderOpen, UserCheck,
} from "lucide-react";
import Swal from "sweetalert2";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_URL;
const ACADEMIC_SETUP_CACHE_PREFIX = "academic_setup_cache_v1";
const ACADEMIC_SETUP_CACHE_TTL_MS = 5 * 60 * 1000;
const SENIOR_SECONDARY_STREAM_OPTIONS = [
  { value: "science", label: "Science" },
  { value: "commerce", label: "Commerce" },
  { value: "arts", label: "Arts" },
  { value: "mixed", label: "Mixed" },
];

const getAcademicCacheStorage = () => {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const getAcademicCacheScope = () => {
  const token = localStorage.getItem("token");
  if (!token) return "anonymous";
  try {
    const base64 = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    const adminId = payload?.id || "unknown";
    const schoolId = payload?.schoolId || "school";
    const campusId = payload?.campusId || "campus";
    return `${adminId}_${schoolId}_${campusId}`;
  } catch {
    return "fallback";
  }
};

const getAcademicCacheKey = (segment) =>
  `${ACADEMIC_SETUP_CACHE_PREFIX}:${segment}:${getAcademicCacheScope()}`;

const readAcademicCache = (key) => {
  const storage = getAcademicCacheStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cachedAt = Number(parsed?.cachedAt || 0);
    if (!cachedAt || Date.now() - cachedAt > ACADEMIC_SETUP_CACHE_TTL_MS) {
      storage.removeItem(key);
      return null;
    }
    return parsed?.data ?? null;
  } catch {
    return null;
  }
};

const writeAcademicCache = (key, data) => {
  const storage = getAcademicCacheStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {
    // Ignore cache write failures.
  }
};

const EditModal = ({ isOpen, onClose, title, children, onSubmit, isSubmitting = false }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="px-6 py-5">
          {children}
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AcademicSetup = ({ setShowAdminHeader }) => {
  const [activeTab, setActiveTab] = useState("years");
  const [years, setYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherAllocations, setTeacherAllocations] = useState([]);
  const [error, setError] = useState("");

  // Forms
  const [yearForm, setYearForm] = useState({ name: "", startDate: "", endDate: "", isActive: false });
  const [classTeacherForm, setClassTeacherForm] = useState({ teacherId: "", yearId: "", classId: "", sectionId: "" });

  // Bulk add forms
  const [classAddMode, setClassAddMode] = useState("range"); // "range" | "custom" | "stream"
  const [classRangeForm, setClassRangeForm] = useState({ from: "1", to: "10", academicYearId: "", prefix: "" });
  const [classCustomInput, setClassCustomInput] = useState("");
  const [classCustomYear, setClassCustomYear] = useState("");
  const [seniorSecondaryForm, setSeniorSecondaryForm] = useState({
    standard: "11",
    stream: "science",
    subjectsInput: "",
    subjectTags: [],
  });
  const [sectionBulkForm, setSectionBulkForm] = useState({ selected: [], custom: "", classIds: [] });
  const [subjectTags, setSubjectTags] = useState([]);
  const [subjectTagInput, setSubjectTagInput] = useState("");
  const [subjectTagClassIds, setSubjectTagClassIds] = useState([]);

  // Edit states
  const [editingYear, setEditingYear] = useState(null);
  const [editingClass, setEditingClass] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [savingClassTeacher, setSavingClassTeacher] = useState(false);
  const [editingClassTeacherId, setEditingClassTeacherId] = useState(null);

  // Search/filter
  const [searchYear, setSearchYear] = useState("");
  const [yearStatusFilter, setYearStatusFilter] = useState("active");
  const [searchClass, setSearchClass] = useState("");
  const [searchSection, setSearchSection] = useState("");
  const [searchSubject, setSearchSubject] = useState("");

  // Loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Sorting
  const [yearSort, setYearSort] = useState({ field: "name", order: "asc" });
  const [classSort, setClassSort] = useState({ field: "order", order: "asc" });
  const [sectionSort, setSectionSort] = useState({ field: "name", order: "asc" });
  const [subjectSort, setSubjectSort] = useState({ field: "name", order: "asc" });

  // Pagination
  const [yearPage, setYearPage] = useState(1);
  const [classPage, setClassPage] = useState(1);
  const [sectionPage, setSectionPage] = useState(1);
  const [subjectPage, setSubjectPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Bulk selection
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);

  // Show/hide add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeClassId, setActiveClassId] = useState("all");
  const [activeSubjectClassId, setActiveSubjectClassId] = useState("all");

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      authorization: token ? `Bearer ${token}` : "",
    };
  }, []);

  const isYearActive = (year) => {
    const status = String(year?.status || "").trim().toLowerCase();
    if (status) return status === "active";
    if (typeof year?.isActive === "boolean") return year.isActive;
    return true;
  };

  const activeYears = useMemo(
    () => years.filter((year) => isYearActive(year)),
    [years]
  );
  const currentAcademicYear = useMemo(
    () => activeYears[0] || null,
    [activeYears]
  );
  const activeYearIdSet = useMemo(
    () => new Set(activeYears.map((year) => String(year?._id || "")).filter(Boolean)),
    [activeYears]
  );
  const visibleClasses = useMemo(
    () =>
      classes.filter((item) => {
        const yearId = String(item?.academicYearId || "").trim();
        if (!yearId) return true;
        return activeYearIdSet.has(yearId);
      }),
    [classes, activeYearIdSet]
  );
  const visibleClassIdSet = useMemo(
    () => new Set(visibleClasses.map((item) => String(item?._id || "")).filter(Boolean)),
    [visibleClasses]
  );
  const visibleSections = useMemo(
    () =>
      sections.filter((item) => {
        const classId = String(item?.classId || "").trim();
        if (!classId) return true;
        return visibleClassIdSet.has(classId);
      }),
    [sections, visibleClassIdSet]
  );
  const visibleSectionIdSet = useMemo(
    () => new Set(visibleSections.map((item) => String(item?._id || "")).filter(Boolean)),
    [visibleSections]
  );
  const visibleSubjects = useMemo(
    () =>
      subjects.filter((item) => {
        const classId = String(item?.classId || "").trim();
        if (!classId) return true;
        return visibleClassIdSet.has(classId);
      }),
    [subjects, visibleClassIdSet]
  );
  const yearNameById = useMemo(
    () =>
      activeYears.reduce((acc, year) => {
        acc[String(year?._id || "")] = year?.name || "";
        return acc;
      }, {}),
    [activeYears]
  );
  const classNameById = useMemo(
    () =>
      visibleClasses.reduce((acc, item) => {
        acc[String(item?._id || "")] = item?.name || "";
        return acc;
      }, {}),
    [visibleClasses]
  );

  const sectionsByClass = useMemo(() => {
    const map = {};
    classes.forEach((c) => { map[String(c._id)] = 0; });
    sections.forEach((s) => {
      const cId = String(s.classId || "");
      if (cId && map[cId] !== undefined) {
        map[cId]++;
      }
    });
    return map;
  }, [sections, classes]);

  const classTabs = useMemo(() => {
    return [
      { id: "all", name: "All Classes" },
      ...visibleClasses.map((c) => ({ id: String(c._id), name: c.name })),
    ];
  }, [visibleClasses]);

  const subjectsByClass = useMemo(() => {
    const map = {};
    classes.forEach((c) => { map[String(c._id)] = 0; });
    subjects.forEach((s) => {
      const cId = String(s.classId || "");
      if (cId && map[cId] !== undefined) {
        map[cId]++;
      }
    });
    return map;
  }, [subjects, classes]);

  /* ─── Filtered data ─── */
  const filteredYears = useMemo(() => {
    let sourceYears = activeYears;
    if (yearStatusFilter === "inactive") {
      sourceYears = years.filter((year) => !isYearActive(year));
    } else if (yearStatusFilter === "all") {
      sourceYears = years;
    }
    if (!searchYear.trim()) return sourceYears;
    const q = searchYear.toLowerCase();
    return sourceYears.filter(
      (y) =>
        y.name.toLowerCase().includes(q) ||
        (y.startDate && new Date(y.startDate).toLocaleDateString().includes(q))
    );
  }, [activeYears, years, yearStatusFilter, searchYear]);

  const filteredClasses = useMemo(() => {
    if (!searchClass.trim()) return visibleClasses;
    const q = searchClass.toLowerCase();
    return visibleClasses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.order?.toString().includes(q) ||
        (c.standard ? String(c.standard).includes(q) : false) ||
        (c.stream ? c.stream.toLowerCase().includes(q) : false)
    );
  }, [visibleClasses, searchClass]);

  const filteredSections = useMemo(() => {
    let list = visibleSections;
    if (activeClassId !== "all") {
      list = list.filter((s) => String(s.classId) === activeClassId);
    }
    if (!searchSection.trim()) return list;
    const q = searchSection.toLowerCase();
    return list.filter((s) => {
      const className = classNameById[String(s.classId || "")] || "";
      return s.name.toLowerCase().includes(q) || className.toLowerCase().includes(q);
    });
  }, [visibleSections, searchSection, classNameById, activeClassId]);

  const filteredSubjects = useMemo(() => {
    let list = visibleSubjects;
    if (activeSubjectClassId !== "all") {
      list = list.filter((s) => {
        const classId = String(s.classId || "").trim();
        return !classId || classId === activeSubjectClassId;
      });
    }
    if (!searchSubject.trim()) return list;
    const q = searchSubject.toLowerCase();
    return list.filter((s) => {
      const className = classNameById[String(s.classId || "")] || "";
      return (
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.stream && s.stream.toLowerCase().includes(q)) ||
        className.toLowerCase().includes(q)
      );
    });
  }, [visibleSubjects, searchSubject, classNameById, activeSubjectClassId]);

  const classTeacherAllocations = useMemo(
    () =>
      teacherAllocations.filter(
        (a) =>
          a.isClassTeacher &&
          visibleClassIdSet.has(String(a.classId?._id || a.classId || "")) &&
          visibleSectionIdSet.has(String(a.sectionId?._id || a.sectionId || ""))
      ),
    [teacherAllocations, visibleClassIdSet, visibleSectionIdSet]
  );

  const classTeacherClasses = useMemo(() => {
    if (!classTeacherForm.yearId) return [];
    return visibleClasses.filter((c) => String(c.academicYearId) === String(classTeacherForm.yearId));
  }, [visibleClasses, classTeacherForm.yearId]);

  const classTeacherSections = useMemo(() => {
    if (!classTeacherForm.classId) return [];
    return visibleSections.filter((s) => String(s.classId) === String(classTeacherForm.classId));
  }, [visibleSections, classTeacherForm.classId]);

  const classRangeFromRaw = String(classRangeForm.from ?? "").trim();
  const classRangeToRaw = String(classRangeForm.to ?? "").trim();
  const classRangeFromNumber = Number(classRangeFromRaw);
  const classRangeToNumber = Number(classRangeToRaw);
  const hasValidClassRange = Boolean(
    classRangeFromRaw &&
    classRangeToRaw &&
    Number.isFinite(classRangeFromNumber) &&
    Number.isFinite(classRangeToNumber) &&
    classRangeFromNumber >= 1 &&
    classRangeToNumber >= 1 &&
    classRangeToNumber >= classRangeFromNumber
  );
  const classRangeCount = hasValidClassRange
    ? classRangeToNumber - classRangeFromNumber + 1
    : 0;

  const handleSaveClassTeacher = async (e) => {
    e.preventDefault();
    if (!classTeacherForm.teacherId || !classTeacherForm.yearId || !classTeacherForm.classId || !classTeacherForm.sectionId) {
      setError("Teacher, year, class, and section are required.");
      return;
    }
    setSavingClassTeacher(true);
    setError("");
    try {
      const allocationId = editingClassTeacherId || classTeacherAllocations.find(
        (a) =>
          String(a.classId?._id || a.classId) === String(classTeacherForm.classId) &&
          String(a.sectionId?._id || a.sectionId) === String(classTeacherForm.sectionId)
      )?._id;
      const payload = {
        teacherId: classTeacherForm.teacherId,
        classId: classTeacherForm.classId,
        sectionId: classTeacherForm.sectionId,
        isClassTeacher: true,
      };
      const endpoint = allocationId ? `${API_BASE}/api/teacher-allocations/${allocationId}` : `${API_BASE}/api/teacher-allocations`;
      const method = allocationId ? "PUT" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to save class teacher");
      }
      await res.json().catch(() => ({}));
      await loadClassTeachers();
      setClassTeacherForm({ teacherId: "", yearId: "", classId: "", sectionId: "" });
      setEditingClassTeacherId(null);
      toast.success(editingClassTeacherId ? "Class teacher updated." : "Class teacher saved.");
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSavingClassTeacher(false);
    }
  };

  const handleEditClassTeacher = (item) => {
    const classId = item.classId?._id || item.classId;
    const cls = classes.find((c) => String(c._id) === String(classId));
    const yearId = cls?.academicYearId || "";
    setClassTeacherForm({
      teacherId: String(item.teacherId?._id || item.teacherId || ""),
      yearId: String(yearId),
      classId: String(classId),
      sectionId: String(item.sectionId?._id || item.sectionId || ""),
    });
    setEditingClassTeacherId(item._id);
    document.getElementById("class-teacher-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const deleteClassTeacher = async (id) => {
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Remove class teacher?",
      text: "This assignment will be removed.",
      showCancelButton: true,
      confirmButtonText: "Yes, Remove",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/api/teacher-allocations/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to delete");
      }
      await loadClassTeachers();
      toast.success("Removed.");
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    }
  };

  /* ─── API helpers ─── */
  const handleApiError = (err) => {
    console.error(err);
    setError("Unable to load academic data. Please retry.");
  };

  const loadAcademicData = async () => {
    const cacheKey = getAcademicCacheKey("core");
    const cached = readAcademicCache(cacheKey);
    if (cached) {
      setYears(Array.isArray(cached.years) ? cached.years : []);
      setClasses(Array.isArray(cached.classes) ? cached.classes : []);
      setSections(Array.isArray(cached.sections) ? cached.sections : []);
      setSubjects(Array.isArray(cached.subjects) ? cached.subjects : []);
    }

    try {
      const [hierarchyRes, subjectsRes] = await Promise.all([
        fetch(`${API_BASE}/api/academic/hierarchy`, { method: "GET", headers: authHeaders }),
        fetch(`${API_BASE}/api/academic/subjects`, { method: "GET", headers: authHeaders }),
      ]);
      if (!hierarchyRes.ok) throw new Error("Failed to load academic setup");
      const data = await hierarchyRes.json();
      setYears(Array.isArray(data.years) ? data.years : []);
      setClasses(Array.isArray(data.classes) ? data.classes : []);
      setSections(Array.isArray(data.sections) ? data.sections : []);

      if (subjectsRes.ok) {
        const subData = await subjectsRes.json();
        setSubjects(Array.isArray(subData) ? subData : []);
        writeAcademicCache(cacheKey, {
          years: Array.isArray(data.years) ? data.years : [],
          classes: Array.isArray(data.classes) ? data.classes : [],
          sections: Array.isArray(data.sections) ? data.sections : [],
          subjects: Array.isArray(subData) ? subData : [],
        });
      } else {
        writeAcademicCache(cacheKey, {
          years: Array.isArray(data.years) ? data.years : [],
          classes: Array.isArray(data.classes) ? data.classes : [],
          sections: Array.isArray(data.sections) ? data.sections : [],
          subjects: [],
        });
      }
    } catch (err) {
      if (!cached) {
        handleApiError(err);
        throw err;
      }
      console.warn("Academic setup fetch failed, showing cached data:", err);
    }
  };

  const loadClassTeachers = async () => {
    const cacheKey = getAcademicCacheKey("class-teachers");
    const cached = readAcademicCache(cacheKey);
    if (cached) {
      setTeachers(Array.isArray(cached.teachers) ? cached.teachers : []);
      setTeacherAllocations(Array.isArray(cached.teacherAllocations) ? cached.teacherAllocations : []);
    }

    try {
      const [teacherRes, allocationRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/users/get-teachers`, { method: "GET", headers: authHeaders }),
        fetch(`${API_BASE}/api/teacher-allocations`, { method: "GET", headers: authHeaders }),
      ]);
      let nextTeachers = [];
      let nextAllocations = [];
      if (teacherRes.ok) {
        const teacherData = await teacherRes.json().catch(() => []);
        nextTeachers = Array.isArray(teacherData) ? teacherData : [];
        setTeachers(nextTeachers);
      }
      if (allocationRes.ok) {
        const allocData = await allocationRes.json().catch(() => []);
        nextAllocations = Array.isArray(allocData) ? allocData : [];
        setTeacherAllocations(nextAllocations);
      }
      writeAcademicCache(cacheKey, {
        teachers: nextTeachers,
        teacherAllocations: nextAllocations,
      });
    } catch (err) {
      if (!cached) {
        console.error(err);
        setError("Unable to load class teacher data.");
      } else {
        console.warn("Class teacher fetch failed, showing cached data:", err);
      }
    }
  };

  useEffect(() => {
    setShowAdminHeader?.(false);
    setError("");
    loadAcademicData().catch(handleApiError);
    loadClassTeachers().catch(() => {});
  }, [setShowAdminHeader]);

  const handleCreate = async (endpoint, payload, onSuccess) => {
    setError("");
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Request failed");
      }
      await res.json().catch(() => ({}));
      await onSuccess();
      toast.success("Created successfully!");
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── Submit handlers ─── */
  const submitYear = async (e) => {
    e.preventDefault();
    await handleCreate("/api/academic/years", yearForm, async () => {
      await loadAcademicData();
      setYearForm({ name: "", startDate: "", endDate: "", isActive: false });
      setShowAddForm(false);
    });
  };


  /* ─── Bulk submit: classes by range ─── */
  const submitClassRange = async (e) => {
    e.preventDefault();
    const { from, to, academicYearId, prefix } = classRangeForm;
    const fromValue = String(from ?? "").trim();
    const toValue = String(to ?? "").trim();
    if (!fromValue || !toValue) {
      setError("From and To are required.");
      return;
    }
    const f = Math.min(Number(from), Number(to));
    const t = Math.max(Number(from), Number(to));
    if (isNaN(f) || isNaN(t) || f < 1 || t < 1) {
      setError("From and To must be valid numbers starting from 1.");
      return;
    }
    const names = Array.from({ length: t - f + 1 }, (_, i) => `${prefix ? prefix + " " : ""}${f + i}`);
    setIsSubmitting(true);
    setError("");
    let created = 0, failed = 0;
    for (let i = 0; i < names.length; i++) {
      try {
        const res = await fetch(`${API_BASE}/api/academic/classes`, {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ name: names[i], academicYearId: academicYearId || undefined, order: f + i }),
        });
        if (res.ok) created++; else failed++;
      } catch { failed++; }
    }
    await loadAcademicData();
    setIsSubmitting(false);
    setShowAddForm(false);
    toast.success(`${created} class${created !== 1 ? "es" : ""} created${failed ? `, ${failed} failed` : ""}.`);
  };

  /* ─── Bulk submit: classes by custom list ─── */
  const submitClassCustom = async (e) => {
    e.preventDefault();
    const names = classCustomInput.split(",").map((s) => s.trim()).filter(Boolean);
    if (!names.length) { setError("Enter at least one class name."); return; }
    setIsSubmitting(true);
    setError("");
    let created = 0, failed = 0;
    for (let i = 0; i < names.length; i++) {
      try {
        const res = await fetch(`${API_BASE}/api/academic/classes`, {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ name: names[i], academicYearId: classCustomYear || undefined, order: i }),
        });
        if (res.ok) created++; else failed++;
      } catch { failed++; }
    }
    await loadAcademicData();
    setIsSubmitting(false);
    setClassCustomInput("");
    setShowAddForm(false);
    toast.success(`${created} class${created !== 1 ? "es" : ""} created${failed ? `, ${failed} failed` : ""}.`);
  };

  const submitSeniorSecondaryStreamSetup = async (e) => {
    e.preventDefault();
    if (!currentAcademicYear?._id) {
      setError("No active academic year found. Please activate a session first.");
      return;
    }

    const standardValue = Number(seniorSecondaryForm.standard);
    if (![11, 12].includes(standardValue)) {
      setError("Only Class 11 or Class 12 can be added from this setup.");
      return;
    }

    const streamValue = String(seniorSecondaryForm.stream || "").trim().toLowerCase();
    if (!streamValue) {
      setError("Select a stream.");
      return;
    }

    const inlineSubjects = seniorSecondaryForm.subjectsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const allSubjects = [...new Set([...seniorSecondaryForm.subjectTags, ...inlineSubjects])];
    if (!allSubjects.length) {
      setError("Add at least one subject.");
      return;
    }

    const streamLabel =
      SENIOR_SECONDARY_STREAM_OPTIONS.find((item) => item.value === streamValue)?.label || "Stream";
    const className = `Class ${standardValue} - ${streamLabel}`;

    setIsSubmitting(true);
    setError("");

    let classId = "";
    let classCreated = false;

    try {
      const existingClass = classes.find(
        (item) =>
          String(item.academicYearId || "") === String(currentAcademicYear._id) &&
          Number(item.standard) === standardValue &&
          String(item.stream || "").toLowerCase() === streamValue
      );

      if (existingClass?._id) {
        classId = String(existingClass._id);
      } else {
        const classRes = await fetch(`${API_BASE}/api/academic/classes`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            name: className,
            academicYearId: currentAcademicYear._id,
            order: standardValue,
            standard: standardValue,
            stream: streamValue,
          }),
        });
        const classData = await classRes.json().catch(() => ({}));
        if (!classRes.ok) {
          throw new Error(classData.error || "Unable to create class");
        }
        classId = String(classData?._id || "");
        classCreated = true;
      }

      if (!classId) throw new Error("Unable to resolve class for stream setup");

      const existingSubjectNames = new Set(
        subjects
          .filter((item) => String(item.classId || "") === classId)
          .map((item) => String(item.name || "").trim().toLowerCase())
          .filter(Boolean)
      );

      let createdSubjects = 0;
      let failedSubjects = 0;
      let skippedSubjects = 0;

      for (const subjectName of allSubjects) {
        const key = subjectName.toLowerCase();
        if (existingSubjectNames.has(key)) {
          skippedSubjects += 1;
          continue;
        }
        try {
          const subjectRes = await fetch(`${API_BASE}/api/academic/subjects`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              name: subjectName,
              classId,
              stream: streamValue,
            }),
          });
          if (subjectRes.ok) {
            createdSubjects += 1;
            existingSubjectNames.add(key);
          } else {
            failedSubjects += 1;
          }
        } catch {
          failedSubjects += 1;
        }
      }

      await loadAcademicData();
      setShowAddForm(false);
      setSeniorSecondaryForm({
        standard: "11",
        stream: "science",
        subjectsInput: "",
        subjectTags: [],
      });
      toast.success(
        `${classCreated ? "Class created, " : ""}${createdSubjects} subject${createdSubjects !== 1 ? "s" : ""} added` +
        `${skippedSubjects ? `, ${skippedSubjects} skipped` : ""}` +
        `${failedSubjects ? `, ${failedSubjects} failed` : ""}.`
      );
    } catch (err) {
      setError(err.message || "Unable to complete stream setup");
      toast.error(err.message || "Unable to complete stream setup");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── Bulk submit: sections ─── */
  const submitSectionsBulk = async (e) => {
    e.preventDefault();
    const { selected, custom, classIds } = sectionBulkForm;
    if (!classIds || classIds.length === 0) { setError("Select at least one class."); return; }
    const extra = custom.split(",").map((s) => s.trim()).filter(Boolean);
    const allNames = [...new Set([...selected, ...extra])];
    if (!allNames.length) { setError("Add at least one section."); return; }
    setIsSubmitting(true);
    setError("");
    let created = 0, failed = 0;
    for (const cId of classIds) {
      for (const name of allNames) {
        try {
          const res = await fetch(`${API_BASE}/api/academic/sections`, {
            method: "POST", headers: authHeaders,
            body: JSON.stringify({ name, classId: cId }),
          });
          if (res.ok) created++; else failed++;
        } catch { failed++; }
      }
    }
    await loadAcademicData();
    setIsSubmitting(false);
    setSectionBulkForm({ selected: [], custom: "", classIds: [] });
    setShowAddForm(false);
    toast.success(`${created} section${created !== 1 ? "s" : ""} created${failed ? `, ${failed} failed` : ""}.`);
  };

  /* ─── Bulk submit: subjects ─── */
  const submitSubjectsBulk = async (e) => {
    e.preventDefault();
    const extra = subjectTagInput.split(",").map((s) => s.trim()).filter(Boolean);
    const allNames = [...new Set([...subjectTags, ...extra])];
    if (!allNames.length) { setError("Add at least one subject."); return; }
    setIsSubmitting(true);
    setError("");
    let created = 0, failed = 0;
    const targetClasses = subjectTagClassIds.length > 0 ? subjectTagClassIds : [undefined];
    for (const cId of targetClasses) {
      for (const name of allNames) {
        try {
          const res = await fetch(`${API_BASE}/api/academic/subjects`, {
            method: "POST", headers: authHeaders,
            body: JSON.stringify({ name, classId: cId }),
          });
          if (res.ok) created++; else failed++;
        } catch { failed++; }
      }
    }
    await loadAcademicData();
    setIsSubmitting(false);
    setSubjectTags([]);
    setSubjectTagInput("");
    setSubjectTagClassIds([]);
    setShowAddForm(false);
    toast.success(`${created} subject${created !== 1 ? "s" : ""} created${failed ? `, ${failed} failed` : ""}.`);
  };

  /* ─── Update handlers ─── */
  const handleUpdate = async (endpoint, id, payload, onSuccess) => {
    setError("");
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}${endpoint}/${id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed");
      }
      await res.json();
      await onSuccess();
      toast.success("Updated successfully!");
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateYear = async (e) => {
    e.preventDefault();
    await handleUpdate("/api/academic/years", editingYear._id, {
      name: editingYear.name,
      startDate: editingYear.startDate,
      endDate: editingYear.endDate,
      isActive: editingYear.isActive,
    }, async () => { await loadAcademicData(); setEditingYear(null); });
  };

  const updateClass = async (e) => {
    e.preventDefault();
    await handleUpdate("/api/academic/classes", editingClass._id, {
      name: editingClass.name,
      academicYearId: editingClass.academicYearId,
      order: editingClass.order,
      standard: editingClass.standard,
      stream: editingClass.stream,
    }, async () => { await loadAcademicData(); setEditingClass(null); });
  };

  const updateSection = async (e) => {
    e.preventDefault();
    if (!editingSection.classId) {
      setError("Select a class before updating section.");
      return;
    }
    await handleUpdate("/api/academic/sections", editingSection._id, {
      name: editingSection.name,
      classId: editingSection.classId,
    }, async () => { await loadAcademicData(); setEditingSection(null); });
  };

  const updateSubject = async (e) => {
    e.preventDefault();
    await handleUpdate("/api/academic/subjects", editingSubject._id, {
      name: editingSubject.name,
      code: editingSubject.code,
      classId: editingSubject.classId,
      stream: editingSubject.stream,
    }, async () => { await loadAcademicData(); setEditingSubject(null); });
  };

  /* ─── Delete handlers ─── */
  const handleDelete = async (endpoint, id, entityName, onSuccess) => {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: `Do you want to delete this ${entityName}? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    });
    if (!confirm.isConfirmed) return;

    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}${endpoint}/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 && (data.dependentCount || data.dependentSections || data.dependentSubjects)) {
          const cascadeConfirm = await Swal.fire({
            title: "Dependent Records Found",
            html: data.error + "<br><br>Do you want to delete this and all dependent records?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            confirmButtonText: "Yes, delete all",
            cancelButtonText: "Cancel",
          });
          if (cascadeConfirm.isConfirmed) {
            const cascadeRes = await fetch(`${API_BASE}${endpoint}/${id}?cascade=true`, {
              method: "DELETE",
              headers: authHeaders,
            });
            if (!cascadeRes.ok) {
              const errData = await cascadeRes.json().catch(() => ({}));
              throw new Error(errData.error || "Delete failed");
            }
            const result = await cascadeRes.json();
            await onSuccess();
            Swal.fire({
              title: "Deleted!",
              html: `${entityName} and ${result.deletedSections || 0} section(s) deleted.`,
              icon: "success",
              timer: 3000,
            });
            return;
          }
          return;
        }
        throw new Error(data.error || "Delete failed");
      }
      await onSuccess();
      Swal.fire({ title: "Deleted!", text: `${entityName} has been deleted.`, icon: "success", timer: 2000, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: "Error", text: err.message, icon: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const deleteYear = (id) => handleDelete("/api/academic/years", id, "academic year", loadAcademicData);
  const deleteClass = (id) => handleDelete("/api/academic/classes", id, "class", loadAcademicData);
  const deleteSection = (id) => handleDelete("/api/academic/sections", id, "section", loadAcademicData);
  const deleteSubject = (id) => handleDelete("/api/academic/subjects", id, "subject", loadAcademicData);

  const copyYearSetup = async (sourceYear) => {
    const sourceYearId = sourceYear?._id;
    if (!sourceYearId) return;
    const targetCandidates = years.filter((item) => String(item?._id) !== String(sourceYearId));
    if (!targetCandidates.length) {
      Swal.fire({
        title: "No Target Year",
        text: "Create another academic year first, then copy setup.",
        icon: "warning",
      });
      return;
    }

    const defaultTarget = targetCandidates.find((item) => isYearActive(item)) || targetCandidates[0];
    const targetOptions = targetCandidates.reduce((acc, item) => {
      const label = `${item.name}${isYearActive(item) ? " (Active)" : " (Inactive)"}`;
      acc[String(item._id)] = label;
      return acc;
    }, {});

    const targetSelection = await Swal.fire({
      title: "Select Target Year",
      input: "select",
      inputOptions: targetOptions,
      inputValue: String(defaultTarget?._id || ""),
      inputPlaceholder: "Choose target year",
      showCancelButton: true,
      confirmButtonText: "Continue",
      cancelButtonText: "Cancel",
      inputValidator: (value) => (!value ? "Please select a target year" : null),
    });
    if (!targetSelection.isConfirmed) return;
    const targetYearId = String(targetSelection.value || "");
    const targetYear = targetCandidates.find((item) => String(item._id) === targetYearId);
    if (!targetYear) return;

    const confirm = await Swal.fire({
      title: "Copy Setup",
      html: `This will copy <b>classes, sections, subjects, and class teachers</b> from <b>${sourceYear?.name || "source year"}</b> to <b>${targetYear?.name || "target year"}</b>.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Copy",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#f59e0b",
    });
    if (!confirm.isConfirmed) return;

    setDeletingId(targetYearId);
    try {
      const res = await fetch(`${API_BASE}/api/academic/years/${targetYearId}/copy-setup`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ sourceYearId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to copy setup");

      await Promise.all([loadAcademicData(), loadClassTeachers()]);

      await Swal.fire({
        title: "Copy Completed",
        icon: "success",
        html: `
          <div style="text-align:left">
            <p><b>Source:</b> ${data?.sourceYear?.name || "Previous Year"}</p>
            <p><b>Target:</b> ${data?.targetYear?.name || targetYear?.name || ""}</p>
            <hr style="margin:10px 0" />
            <p><b>Classes:</b> ${data?.classes?.created || 0} created, ${data?.classes?.skipped || 0} skipped</p>
            <p><b>Sections:</b> ${data?.sections?.created || 0} created, ${data?.sections?.skipped || 0} skipped</p>
            <p><b>Subjects:</b> ${data?.subjects?.created || 0} created, ${data?.subjects?.skipped || 0} skipped</p>
            <p><b>Class Teachers:</b> ${data?.classTeachers?.created || 0} created, ${data?.classTeachers?.skipped || 0} skipped</p>
          </div>
        `,
      });
    } catch (err) {
      Swal.fire({ title: "Error", text: err.message || "Failed to copy setup", icon: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  /* ─── Sorting ─── */
  const sortData = (data, sortConfig) => {
    if (!sortConfig.field) return data;
    return [...data].sort((a, b) => {
      let aVal = a[sortConfig.field];
      let bVal = b[sortConfig.field];
      if (sortConfig.field.includes("Date")) {
        aVal = new Date(aVal || 0);
        bVal = new Date(bVal || 0);
      }
      if (typeof aVal === "string") { aVal = aVal.toLowerCase(); bVal = bVal?.toLowerCase() || ""; }
      if (sortConfig.field === "order") { aVal = aVal ?? 0; bVal = bVal ?? 0; }
      if (aVal < bVal) return sortConfig.order === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.order === "asc" ? 1 : -1;
      return 0;
    });
  };

  const sortedYears = useMemo(() => sortData(filteredYears, yearSort), [filteredYears, yearSort]);
  const sortedClasses = useMemo(() => sortData(filteredClasses, classSort), [filteredClasses, classSort]);
  const sortedSections = useMemo(() => sortData(filteredSections, sectionSort), [filteredSections, sectionSort]);
  const sortedSubjects = useMemo(() => sortData(filteredSubjects, subjectSort), [filteredSubjects, subjectSort]);

  /* ─── Pagination ─── */
  const paginate = (data, page) => {
    const start = (page - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  };
  const paginatedYears = useMemo(() => paginate(sortedYears, yearPage), [sortedYears, yearPage, itemsPerPage]);
  const paginatedClasses = useMemo(() => paginate(sortedClasses, classPage), [sortedClasses, classPage, itemsPerPage]);
  const paginatedSections = useMemo(() => paginate(sortedSections, sectionPage), [sortedSections, sectionPage, itemsPerPage]);
  const paginatedSubjects = useMemo(() => paginate(sortedSubjects, subjectPage), [sortedSubjects, subjectPage, itemsPerPage]);

  /* ─── Bulk selection ─── */
  const selectionMap = {
    years: [selectedYears, setSelectedYears],
    classes: [selectedClasses, setSelectedClasses],
    sections: [selectedSections, setSelectedSections],
    subjects: [selectedSubjects, setSelectedSubjects],
  };

  const handleSelectAll = (entityType, items) => {
    const [current, setter] = selectionMap[entityType];
    setter(current.length === items.length && items.length > 0 ? [] : items.map((i) => i._id));
  };

  const handleSelectItem = (entityType, id) => {
    const [current, setter] = selectionMap[entityType];
    setter(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  };

  const handleBulkDelete = async (entityType, entityName) => {
    const [selected] = selectionMap[entityType];
    if (selected.length === 0) return;

    const confirm = await Swal.fire({
      title: "Bulk Delete",
      html: `Are you sure you want to delete <strong>${selected.length}</strong> ${entityName}(s)?<br>This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete all",
    });
    if (!confirm.isConfirmed) return;

    let successCount = 0;
    let failCount = 0;

    Swal.fire({
      title: "Deleting...",
      html: `Deleted: <b>0</b> / ${selected.length}`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const endpoint = {
      years: "/api/academic/years",
      classes: "/api/academic/classes",
      sections: "/api/academic/sections",
      subjects: "/api/academic/subjects",
    }[entityType];

    for (const id of selected) {
      try {
        const res = await fetch(`${API_BASE}${endpoint}/${id}?cascade=true`, {
          method: "DELETE",
          headers: authHeaders,
        });
        if (res.ok) successCount++;
        else failCount++;
        Swal.update({
          html: `Deleted: <b>${successCount}</b> / ${selected.length}${failCount > 0 ? ` (${failCount} failed)` : ""}`,
        });
      } catch {
        failCount++;
      }
    }

    await loadAcademicData();
    Object.values(selectionMap).forEach(([, setter]) => setter([]));

    Swal.fire({
      title: "Completed",
      html: `Successfully deleted <b>${successCount}</b> ${entityName}(s)${failCount > 0 ? `<br>${failCount} deletion(s) failed` : ""}`,
      icon: successCount > 0 ? "success" : "error",
    });
  };

  /* ─── Toggle sort helper ─── */
  const toggleSort = (setter) => (field) => {
    setter((prev) => ({
      field,
      order: prev.field === field && prev.order === "asc" ? "desc" : "asc",
    }));
  };

  /* ═══════════════════════ SUB-COMPONENTS ═══════════════════════ */

  const StatCard = ({ icon, label, value, color }) => (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
        {React.createElement(icon, { className: "h-5 w-5 text-white" })}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );

  const SearchInput = ({ value, onChange, placeholder }) => (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
      />
    </div>
  );

  const SortableHeader = ({ label, field, sortConfig, onSort }) => (
    <th
      onClick={() => onSort(field)}
      className="cursor-pointer select-none whitespace-nowrap bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 transition hover:bg-amber-50"
    >
      <div className="flex items-center gap-1.5">
        {label}
        {sortConfig.field === field ? (
          sortConfig.order === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 text-amber-600" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-amber-600" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 text-gray-300" />
        )}
      </div>
    </th>
  );

  const Pagination = ({ currentPage, totalItems, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalItems === 0) return null;
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);

    const pages = [];
    const maxVisible = 5;
    let pStart = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let pEnd = Math.min(totalPages, pStart + maxVisible - 1);
    if (pEnd - pStart < maxVisible - 1) pStart = Math.max(1, pEnd - maxVisible + 1);
    for (let i = pStart; i <= pEnd; i++) pages.push(i);

    return (
      <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/50 px-4 py-3 sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {start}–{end} of {totalItems}
          </span>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="rounded border border-gray-200 px-2 py-1 text-xs focus:ring-2 focus:ring-amber-200"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          {pStart > 1 && (
            <>
              <button onClick={() => onPageChange(1)} className="rounded-md border border-gray-200 px-2.5 py-1 text-xs hover:bg-gray-100">1</button>
              {pStart > 2 && <span className="px-1 text-xs text-gray-400">...</span>}
            </>
          )}
          {pages.map((n) => (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${
                currentPage === n
                  ? "border-amber-400 bg-amber-500 text-white"
                  : "border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {n}
            </button>
          ))}
          {pEnd < totalPages && (
            <>
              {pEnd < totalPages - 1 && <span className="px-1 text-xs text-gray-400">...</span>}
              <button onClick={() => onPageChange(totalPages)} className="rounded-md border border-gray-200 px-2.5 py-1 text-xs hover:bg-gray-100">{totalPages}</button>
            </>
          )}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const BulkBar = ({ entityType, entityName }) => {
    const [selected] = selectionMap[entityType];
    if (selected.length === 0) return null;
    return (
      <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
        <span className="text-sm font-medium text-gray-700">{selected.length} selected</span>
        <div className="flex gap-2">
          <button
            onClick={() => selectionMap[entityType][1]([])}
            className="rounded border border-gray-300 px-3 py-1 text-xs text-black hover:bg-white"
          >
            Clear
          </button>
          <button
            onClick={() => handleBulkDelete(entityType, entityName)}
            className="flex items-center gap-1 rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>
    );
  };

  const EmptyState = ({ search, entity }) => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <FolderOpen className="mb-3 h-10 w-10" />
      <p className="text-sm">{search ? `No matching ${entity} found.` : `No ${entity} yet.`}</p>
    </div>
  );

  /* ═══════════════════════ TAB CONFIG ═══════════════════════ */

  const tabs = [
    { key: "years", label: "Academic Years", icon: Calendar, count: activeYears.length },
    { key: "classes", label: "Classes", icon: Layers, count: visibleClasses.length },
    { key: "sections", label: "Sections", icon: BookOpen, count: visibleSections.length },
    { key: "subjects", label: "Subjects", icon: GraduationCap, count: visibleSubjects.length },
    { key: "class-teachers", label: "Class Teachers", icon: UserCheck, count: classTeacherAllocations.length },
  ];

  /* ═══════════════════════ RENDER ═══════════════════════ */

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* ─── Header ─── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Academic Setup</h1>
            <p className="mt-1 text-sm text-gray-500">Manage academic years, classes, sections and subjects.</p>
          </div>
          {activeTab !== "class-teachers" && (
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-amber-600"
            >
              <Plus className="h-4 w-4" />
              {showAddForm ? "Hide Form" : "Add New"}
            </button>
          )}
        </div>

        {/* ─── Stat Cards ─── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={Calendar} label="Academic Years" value={activeYears.length} color="bg-blue-500" />
          <StatCard icon={Layers} label="Classes" value={visibleClasses.length} color="bg-emerald-500" />
          <StatCard icon={BookOpen} label="Sections" value={visibleSections.length} color="bg-violet-500" />
          <StatCard icon={GraduationCap} label="Subjects" value={visibleSubjects.length} color="bg-amber-500" />
        </div>

        {/* ─── Error ─── */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ─── Tabs ─── */}
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); setShowAddForm(false); }}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                activeTab === t.key ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-500"
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* ═══════════════ YEARS TAB ═══════════════ */}
        {activeTab === "years" && (
          <div className="space-y-4">
            {/* Add Form */}
            {showAddForm && ( 
              <form onSubmit={submitYear} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-base font-semibold text-gray-800">Add Academic Year</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Year Name</label>
                    <input type="text" value={yearForm.name} onChange={(e) => setYearForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      placeholder="2025-2026" required />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Start Date</label>
                    <input type="date" value={yearForm.startDate} onChange={(e) => setYearForm((p) => ({ ...p, startDate: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">End Date</label>
                    <input type="date" value={yearForm.endDate} onChange={(e) => setYearForm((p) => ({ ...p, endDate: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100" />
                  </div>
                  <div className="flex items-end gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" checked={yearForm.isActive} onChange={(e) => setYearForm((p) => ({ ...p, isActive: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400" />
                      Active
                    </label>
                    <button type="submit" disabled={isSubmitting}
                      className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                      <Plus className="h-4 w-4" /> Add
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Table Card */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                <h3 className="text-sm font-semibold text-gray-700">Academic Years</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={yearStatusFilter}
                    onChange={(e) => { setYearStatusFilter(e.target.value); setYearPage(1); }}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="all">All</option>
                  </select>
                  <div className="w-64">
                  <SearchInput value={searchYear} onChange={setSearchYear} placeholder="Search years..." />
                  </div>
                </div>
              </div>
              <BulkBar entityType="years" entityName="academic year" />
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="w-12 bg-gray-50 px-4 py-3">
                        <input type="checkbox" checked={selectedYears.length === paginatedYears.length && paginatedYears.length > 0}
                          onChange={() => handleSelectAll("years", paginatedYears)} className="h-4 w-4 rounded border-gray-300 text-amber-500" />
                      </th>
                      <SortableHeader label="Name" field="name" sortConfig={yearSort} onSort={toggleSort(setYearSort)} />
                      <SortableHeader label="Start Date" field="startDate" sortConfig={yearSort} onSort={toggleSort(setYearSort)} />
                      <SortableHeader label="End Date" field="endDate" sortConfig={yearSort} onSort={toggleSort(setYearSort)} />
                      <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="bg-gray-50 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedYears.map((year) => (
                      <tr key={year._id} className="transition hover:bg-amber-50/30">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selectedYears.includes(year._id)}
                            onChange={() => handleSelectItem("years", year._id)} className="h-4 w-4 rounded border-gray-300 text-amber-500" />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{year.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{year.startDate ? new Date(year.startDate).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{year.endDate ? new Date(year.endDate).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3">
                          {year.isActive ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Active</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => copyYearSetup(year)}
                              disabled={deletingId === year._id}
                              className="rounded-md p-1.5 text-gray-400 transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                              title="Copy this year's classes, sections, subjects and class teachers to another year"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button onClick={() => setEditingYear(year)} className="rounded-md p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600" title="Edit">
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button onClick={() => deleteYear(year._id)} disabled={deletingId === year._id}
                              className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {paginatedYears.length === 0 && <EmptyState search={searchYear} entity="academic years" />}
              </div>
              <Pagination currentPage={yearPage} totalItems={sortedYears.length} onPageChange={setYearPage} />
            </div>
          </div>
        )}

        {/* ═══════════════ CLASSES TAB ═══════════════ */}
        {activeTab === "classes" && (
          <div className="space-y-4">
            {showAddForm && (
              <div className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
                {/* Mode switcher */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 bg-amber-50/40">
                  <h3 className="text-sm font-semibold text-gray-800">Add Classes</h3>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                    {["range", "custom", "stream"].map((mode) => (
                      <button key={mode} type="button" onClick={() => setClassAddMode(mode)}
                        className={`px-3 py-1.5 capitalize transition ${classAddMode === mode ? "bg-amber-500 text-white" : "text-gray-500 hover:bg-gray-50"} ${mode !== "range" ? "border-l border-gray-200" : ""}`}>
                        {mode === "range" ? "Range (1–10)" : mode === "custom" ? "Custom list" : "11/12 + Stream"}
                      </button>
                    ))}
                  </div>
                </div>

                {classAddMode === "range" ? (
                  <form onSubmit={submitClassRange} className="p-5 space-y-4">
                    <p className="text-xs text-gray-500">Create multiple numbered classes at once — e.g. Class 1 through Class 10.</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Academic Year</label>
                        <select value={classRangeForm.academicYearId}
                          onChange={(e) => setClassRangeForm((p) => ({ ...p, academicYearId: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100">
                          <option value="">Select year</option>
                          {activeYears.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Prefix <span className="text-gray-400">(optional)</span></label>
                        <input type="text" value={classRangeForm.prefix}
                          onChange={(e) => setClassRangeForm((p) => ({ ...p, prefix: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                          placeholder='e.g. "Class"' />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
                        <input type="number" min={1} value={classRangeForm.from}
                          onChange={(e) => setClassRangeForm((p) => ({ ...p, from: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                          required />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
                        <input type="number" min={1} value={classRangeForm.to}
                          onChange={(e) => setClassRangeForm((p) => ({ ...p, to: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                          required />
                      </div>
                    </div>
                    {/* Live preview */}
                    {hasValidClassRange && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Preview — {classRangeCount} classes:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from({ length: Math.min(classRangeCount, 30) }, (_, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200">
                              {classRangeForm.prefix ? `${classRangeForm.prefix} ` : ""}{classRangeFromNumber + i}
                            </span>
                          ))}
                          {classRangeCount > 30 && (
                            <span className="text-xs text-gray-400 self-center">…and more</span>
                          )}
                        </div>
                      </div>
                    )}
                    <button type="submit" disabled={isSubmitting || !hasValidClassRange}
                      className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                      <Plus className="h-4 w-4" />
                      {isSubmitting ? "Creating…" : `Create ${classRangeCount} Classes`}
                    </button>
                  </form>
                ) : classAddMode === "custom" ? (
                  <form onSubmit={submitClassCustom} className="p-5 space-y-4">
                    <p className="text-xs text-gray-500">Type class names separated by commas — e.g. <span className="font-mono bg-gray-100 px-1 rounded">Nursery, LKG, UKG, 1, 2, 3</span></p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Class names (comma-separated)</label>
                        <input type="text" value={classCustomInput}
                          onChange={(e) => setClassCustomInput(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                          placeholder="Nursery, LKG, UKG, 1, 2, 3, 4, 5" required />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Academic Year</label>
                        <select value={classCustomYear} onChange={(e) => setClassCustomYear(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100">
                          <option value="">Select year</option>
                          {activeYears.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* Preview chips */}
                    {classCustomInput.trim() && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          Preview — {classCustomInput.split(",").map((s) => s.trim()).filter(Boolean).length} classes:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {classCustomInput.split(",").map((s) => s.trim()).filter(Boolean).map((name, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <button type="submit" disabled={isSubmitting || !classCustomInput.trim()}
                      className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                      <Plus className="h-4 w-4" />
                      {isSubmitting ? "Creating…" : `Create ${classCustomInput.split(",").filter((s) => s.trim()).length || 0} Classes`}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={submitSeniorSecondaryStreamSetup} className="p-5 space-y-4">
                    <p className="text-xs text-gray-500">
                      Create Class 11 or 12 with a stream and subjects in the <span className="font-medium">current active session</span>.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Current Session</label>
                        <input
                          type="text"
                          value={currentAcademicYear?.name || "No active year"}
                          disabled
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
                        <select
                          value={seniorSecondaryForm.standard}
                          onChange={(e) => setSeniorSecondaryForm((p) => ({ ...p, standard: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        >
                          <option value="11">Class 11</option>
                          <option value="12">Class 12</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Stream</label>
                        <select
                          value={seniorSecondaryForm.stream}
                          onChange={(e) => setSeniorSecondaryForm((p) => ({ ...p, stream: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        >
                          {SENIOR_SECONDARY_STREAM_OPTIONS.map((stream) => (
                            <option key={stream.value} value={stream.value}>
                              {stream.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Subjects (comma separated)</label>
                      <div className="flex flex-wrap gap-1.5 rounded-lg border border-gray-200 px-3 py-2 min-h-11 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100">
                        {seniorSecondaryForm.subjectTags.map((tag) => (
                          <span key={tag} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium border border-amber-200">
                            {tag}
                            <button
                              type="button"
                              onClick={() =>
                                setSeniorSecondaryForm((p) => ({
                                  ...p,
                                  subjectTags: p.subjectTags.filter((item) => item !== tag),
                                }))
                              }
                              className="ml-0.5 rounded-full hover:bg-amber-300 w-3.5 h-3.5 flex items-center justify-center text-amber-700 font-bold"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={seniorSecondaryForm.subjectsInput}
                          onChange={(e) => setSeniorSecondaryForm((p) => ({ ...p, subjectsInput: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              const names = seniorSecondaryForm.subjectsInput
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean);
                              if (!names.length) return;
                              setSeniorSecondaryForm((p) => ({
                                ...p,
                                subjectTags: [...new Set([...p.subjectTags, ...names])],
                                subjectsInput: "",
                              }));
                            }
                          }}
                          onBlur={() => {
                            const names = seniorSecondaryForm.subjectsInput
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean);
                            if (!names.length) return;
                            setSeniorSecondaryForm((p) => ({
                              ...p,
                              subjectTags: [...new Set([...p.subjectTags, ...names])],
                              subjectsInput: "",
                            }));
                          }}
                          className="flex-1 min-w-40 bg-transparent text-sm outline-none placeholder:text-gray-400"
                          placeholder="Physics, Chemistry, Biology..."
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || !currentAcademicYear?._id}
                      className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      {isSubmitting ? "Saving…" : "Create Class + Stream Subjects"}
                    </button>
                  </form>
                )}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                <h3 className="text-sm font-semibold text-gray-700">Classes</h3>
                <div className="w-64">
                  <SearchInput value={searchClass} onChange={setSearchClass} placeholder="Search classes..." />
                </div>
              </div>
              <BulkBar entityType="classes" entityName="class" />
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="w-12 bg-gray-50 px-4 py-3">
                        <input type="checkbox" checked={selectedClasses.length === paginatedClasses.length && paginatedClasses.length > 0}
                          onChange={() => handleSelectAll("classes", paginatedClasses)} className="h-4 w-4 rounded border-gray-300 text-amber-500" />
                      </th>
                      <SortableHeader label="Name" field="name" sortConfig={classSort} onSort={toggleSort(setClassSort)} />
                      <SortableHeader label="Order" field="order" sortConfig={classSort} onSort={toggleSort(setClassSort)} />
                      <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Stream</th>
                      <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Academic Year</th>
                      <th className="bg-gray-50 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedClasses.map((cls) => (
                      <tr key={cls._id} className="transition hover:bg-amber-50/30">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selectedClasses.includes(cls._id)}
                            onChange={() => handleSelectItem("classes", cls._id)} className="h-4 w-4 rounded border-gray-300 text-amber-500" />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{cls.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{cls.order ?? 0}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {cls.stream ? `${cls.standard ? `Class ${cls.standard} - ` : ""}${String(cls.stream).replace(/^./, (ch) => ch.toUpperCase())}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{yearNameById[String(cls.academicYearId || "")] || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setEditingClass(cls)} className="rounded-md p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600" title="Edit">
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button onClick={() => deleteClass(cls._id)} disabled={deletingId === cls._id}
                              className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {paginatedClasses.length === 0 && <EmptyState search={searchClass} entity="classes" />}
              </div>
              <Pagination currentPage={classPage} totalItems={sortedClasses.length} onPageChange={setClassPage} />
            </div>
          </div>
        )}

        {/* ═══════════════ SECTIONS TAB ═══════════════ */}
        {activeTab === "sections" && (
          <div className="space-y-4">
            {showAddForm && (
              <form onSubmit={submitSectionsBulk} className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 px-5 py-3 bg-amber-50/40">
                  <h3 className="text-sm font-semibold text-gray-800">Add Sections</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Pick a class, tap quick letters and/or type custom names — all created in one click.</p>
                </div>
                <div className="p-5 space-y-5">
                  {/* Class selector */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-600">Select Classes <span className="text-red-400">*</span></label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                      <button
                        type="button"
                        onClick={() => setSectionBulkForm(p => ({ ...p, classIds: p.classIds.length === visibleClasses.length ? [] : visibleClasses.map(c => String(c._id)) }))}
                        className="px-2 py-1 text-xs rounded border border-gray-300  hover:bg-gray-100 text-black font-medium"
                      >
                        {sectionBulkForm.classIds?.length === visibleClasses.length && visibleClasses.length > 0 ? "Deselect All" : "Select All"}
                      </button>
                      {visibleClasses.map((c) => {
                        const isSelected = sectionBulkForm.classIds?.includes(String(c._id));
                        return (
                          <button
                            key={c._id}
                            type="button"
                            onClick={() => {
                              setSectionBulkForm(p => {
                                const current = p.classIds || [];
                                return {
                                  ...p,
                                  classIds: isSelected ? current.filter(id => id !== String(c._id)) : [...current, String(c._id)]
                                };
                              });
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-amber-400'
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick-select letter buttons */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-600">Quick select sections</label>
                    <div className="flex flex-wrap gap-2">
                      {["A","B","C","D","E","F","G","H","I","J"].map((letter) => {
                        const active = sectionBulkForm.selected.includes(letter);
                        return (
                          <button key={letter} type="button"
                            onClick={() => setSectionBulkForm((p) => ({
                              ...p,
                              selected: active ? p.selected.filter((s) => s !== letter) : [...p.selected, letter],
                            }))}
                            className={`w-10 h-10 rounded-xl text-sm font-bold border-2 transition-all ${
                              active
                                ? "bg-amber-500 border-amber-500 text-white shadow-sm scale-105"
                                : "border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600"
                            }`}>
                            {letter}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom names */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Custom names <span className="text-gray-400">(comma-separated, optional)</span>
                    </label>
                    <input type="text" value={sectionBulkForm.custom}
                      onChange={(e) => setSectionBulkForm((p) => ({ ...p, custom: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      placeholder="Science, Commerce, Arts" />
                  </div>

                  {/* Preview */}
                  {(() => {
                    const extra = sectionBulkForm.custom.split(",").map((s) => s.trim()).filter(Boolean);
                    const all = [...new Set([...sectionBulkForm.selected, ...extra])];
                    return all.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          Preview — {all.length} section{all.length !== 1 ? "s" : ""} 
                          {sectionBulkForm.classIds?.length > 0 ? ` per class (${all.length * sectionBulkForm.classIds.length} total)` : ""}:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {all.map((name) => (
                            <span key={name} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  <button type="submit" disabled={isSubmitting}
                    className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                    <Plus className="h-4 w-4" />
                    {isSubmitting ? "Creating…" : "Create Sections"}
                  </button>
                </div>
              </form>
            )}

            <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
              {classTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveClassId(tab.id)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                    activeClassId === tab.id
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.name}
                  {tab.id !== "all" && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        activeClassId === tab.id
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {sectionsByClass[tab.id] || 0}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                <h3 className="text-sm font-semibold text-gray-700">Sections</h3>
                <div className="w-64">
                  <SearchInput value={searchSection} onChange={setSearchSection} placeholder="Search sections..." />
                </div>
              </div>
              <BulkBar entityType="sections" entityName="section" />
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="w-12 bg-gray-50 px-4 py-3">
                        <input type="checkbox" checked={selectedSections.length === paginatedSections.length && paginatedSections.length > 0}
                          onChange={() => handleSelectAll("sections", paginatedSections)} className="h-4 w-4 rounded border-gray-300 text-amber-500" />
                      </th>
                      <SortableHeader label="Name" field="name" sortConfig={sectionSort} onSort={toggleSort(setSectionSort)} />
                      <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Class</th>
                      <th className="bg-gray-50 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedSections.map((sec) => (
                      <tr key={sec._id} className="transition hover:bg-amber-50/30">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selectedSections.includes(sec._id)}
                            onChange={() => handleSelectItem("sections", sec._id)} className="h-4 w-4 rounded border-gray-300 text-amber-500" />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{sec.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{classNameById[String(sec.classId || "")] || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setEditingSection(sec)} className="rounded-md p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600" title="Edit">
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button onClick={() => deleteSection(sec._id)} disabled={deletingId === sec._id}
                              className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {paginatedSections.length === 0 && <EmptyState search={searchSection} entity="sections" />}
              </div>
              <Pagination currentPage={sectionPage} totalItems={sortedSections.length} onPageChange={setSectionPage} />
            </div>
          </div>
        )}

        {/* ═══════════════ SUBJECTS TAB ═══════════════ */}
        {activeTab === "subjects" && (
          <div className="space-y-4">
            {showAddForm && (
              <form onSubmit={submitSubjectsBulk} className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 px-5 py-3 bg-amber-50/40">
                  <h3 className="text-sm font-semibold text-gray-800">Add Subjects</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Type a name and press <kbd className="px-1 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px]">Enter</kbd> or <kbd className="px-1 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px]">,</kbd> to add it — create many subjects in one go.</p>
                </div>
                <div className="p-5 space-y-4">
                  {/* Class selector */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-600">Select Classes <span className="text-gray-400">(optional — applies to all selected)</span></label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                      <button
                        type="button"
                        onClick={() => setSubjectTagClassIds(p => p.length === visibleClasses.length ? [] : visibleClasses.map(c => String(c._id)))}
                        className="px-2 py-1 text-xs rounded border border-gray-300 bg-white hover:bg-gray-100 text-black font-medium"
                      >
                        {subjectTagClassIds.length === visibleClasses.length && visibleClasses.length > 0 ? "Deselect All" : "Select All"}
                      </button>
                      {visibleClasses.map((c) => {
                        const isSelected = subjectTagClassIds.includes(String(c._id));
                        return (
                          <button
                            key={c._id}
                            type="button"
                            onClick={() => {
                              setSubjectTagClassIds(p => 
                                isSelected ? p.filter(id => id !== String(c._id)) : [...p, String(c._id)]
                              );
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-amber-400'
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tag chip input */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Subject names</label>
                    <div className={`flex flex-wrap gap-1.5 rounded-lg border px-3 py-2 min-h-11 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100 transition-all ${subjectTags.length > 0 ? "border-amber-300 bg-amber-50/30" : "border-gray-200"}`}>
                      {subjectTags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium border border-amber-200">
                          {tag}
                          <button type="button" onClick={() => setSubjectTags((p) => p.filter((t) => t !== tag))}
                            className="ml-0.5 rounded-full hover:bg-amber-300 w-3.5 h-3.5 flex items-center justify-center text-amber-700 font-bold">
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={subjectTagInput}
                        onChange={(e) => setSubjectTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            const names = subjectTagInput.split(",").map((s) => s.trim()).filter(Boolean);
                            if (names.length) {
                              setSubjectTags((p) => [...new Set([...p, ...names])]);
                              setSubjectTagInput("");
                            }
                          } else if (e.key === "Backspace" && !subjectTagInput && subjectTags.length) {
                            setSubjectTags((p) => p.slice(0, -1));
                          }
                        }}
                        onBlur={() => {
                          const names = subjectTagInput.split(",").map((s) => s.trim()).filter(Boolean);
                          if (names.length) { setSubjectTags((p) => [...new Set([...p, ...names])]); setSubjectTagInput(""); }
                        }}
                        className="flex-1 min-w-40 bg-transparent text-sm outline-none placeholder:text-gray-400"
                        placeholder={subjectTags.length === 0 ? "Mathematics, Science, English, Hindi…" : "Add more…"}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">{subjectTags.length} subject{subjectTags.length !== 1 ? "s" : ""} ready to create</p>
                  </div>

                  {/* Quick suggestions */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Common subjects — click to add:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Mathematics","Science","English","Hindi","Social Studies","Computer Science","Physics","Chemistry","Biology","History","Geography","Economics","Accountancy","Physical Education","Art & Craft","Music"].map((s) => (
                        <button key={s} type="button"
                          disabled={subjectTags.includes(s)}
                          onClick={() => setSubjectTags((p) => [...new Set([...p, s])])}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                            subjectTags.includes(s)
                              ? "bg-amber-100 border-amber-300 text-amber-700 opacity-50 cursor-not-allowed"
                              : "border-gray-200 text-gray-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                          }`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button type="submit" disabled={isSubmitting || (subjectTags.length === 0 && !subjectTagInput.trim())}
                    className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                    <Plus className="h-4 w-4" />
                    {isSubmitting ? "Creating…" : `Create ${subjectTags.length + (subjectTagInput.trim() ? subjectTagInput.split(",").filter((s) => s.trim()).length : 0)} Subject${subjectTags.length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </form>
            )}

            <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
              {classTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubjectClassId(tab.id)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                    activeSubjectClassId === tab.id
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.name}
                  {tab.id !== "all" && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        activeSubjectClassId === tab.id
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {subjectsByClass[tab.id] || 0}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                <h3 className="text-sm font-semibold text-gray-700">Subjects</h3>
                <div className="w-64">
                  <SearchInput value={searchSubject} onChange={setSearchSubject} placeholder="Search subjects..." />
                </div>
              </div>
              <BulkBar entityType="subjects" entityName="subject" />
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="w-12 bg-gray-50 px-4 py-3">
                        <input type="checkbox" checked={selectedSubjects.length === paginatedSubjects.length && paginatedSubjects.length > 0}
                          onChange={() => handleSelectAll("subjects", paginatedSubjects)} className="h-4 w-4 rounded border-gray-300 text-amber-500" />
                      </th>
                      <SortableHeader label="Name" field="name" sortConfig={subjectSort} onSort={toggleSort(setSubjectSort)} />
                      {/* <SortableHeader label="Code" field="code" sortConfig={subjectSort} onSort={toggleSort(setSubjectSort)} /> */}
                      <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Stream</th>
                      <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Class</th>
                      <th className="bg-gray-50 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedSubjects.map((sub) => (
                      <tr key={sub._id} className="transition hover:bg-amber-50/30">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selectedSubjects.includes(sub._id)}
                            onChange={() => handleSelectItem("subjects", sub._id)} className="h-4 w-4 rounded border-gray-300 text-amber-500" />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{sub.name}</td>
                        {/* <td className="px-4 py-3 text-sm text-gray-500">{sub.code || "—"}</td> */}
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {sub.stream ? String(sub.stream).replace(/^./, (ch) => ch.toUpperCase()) : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{classNameById[String(sub.classId || "")] || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setEditingSubject(sub)} className="rounded-md p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600" title="Edit">
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button onClick={() => deleteSubject(sub._id)} disabled={deletingId === sub._id}
                              className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {paginatedSubjects.length === 0 && <EmptyState search={searchSubject} entity="subjects" />}
              </div>
              <Pagination currentPage={subjectPage} totalItems={sortedSubjects.length} onPageChange={setSubjectPage} />
            </div>
          </div>
        )}

        {/* ═══════════════ CLASS TEACHERS TAB ═══════════════ */}
        {activeTab === "class-teachers" && (
          <div className="space-y-4">
            <form id="class-teacher-form" onSubmit={handleSaveClassTeacher} className={`rounded-xl border bg-white p-5 shadow-sm ${editingClassTeacherId ? "border-amber-400 ring-2 ring-amber-100" : "border-gray-200"}`}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-800">
                  {editingClassTeacherId ? "Update Class Teacher" : "Assign Class Teacher"}
                </h3>
                {editingClassTeacherId && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    <Edit3 className="h-3 w-3" /> Editing assignment
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Teacher</label>
                  <select
                    value={classTeacherForm.teacherId}
                    onChange={(e) => setClassTeacherForm((p) => ({ ...p, teacherId: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    required
                  >
                    <option value="">Select teacher</option>
                    {teachers.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name || t.username || t.employeeCode || 'Teacher'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Year</label>
                  <select
                    value={classTeacherForm.yearId}
                    onChange={(e) =>
                      setClassTeacherForm((p) => ({ ...p, yearId: e.target.value, classId: "", sectionId: "" }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    required
                  >
                    <option value="">Select year</option>
                    {activeYears.map((y) => (
                      <option key={y._id} value={y._id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
                  <select
                    value={classTeacherForm.classId}
                    onChange={(e) =>
                      setClassTeacherForm((p) => ({ ...p, classId: e.target.value, sectionId: "" }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    required
                  >
                    <option value="">Select class</option>
                    {classTeacherClasses.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Section</label>
                  <select
                    value={classTeacherForm.sectionId}
                    onChange={(e) => setClassTeacherForm((p) => ({ ...p, sectionId: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    required
                  >
                    <option value="">Select section</option>
                    {classTeacherSections.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={savingClassTeacher}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {savingClassTeacher ? "Saving..." : editingClassTeacherId ? "Update Class Teacher" : "Save Class Teacher"}
                </button>
                {editingClassTeacherId ? (
                  <button
                    type="button"
                    onClick={() => { setClassTeacherForm({ teacherId: "", yearId: "", classId: "", sectionId: "" }); setEditingClassTeacherId(null); }}
                    className="rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50"
                  >
                    Cancel Edit
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setClassTeacherForm({ teacherId: "", yearId: "", classId: "", sectionId: "" })}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-black hover:bg-gray-50"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-gray-800">Current Class Teachers</h3>
              <div className="space-y-3">
                {classTeacherAllocations.length === 0 && (
                  <p className="text-sm text-gray-500">No class teachers assigned yet.</p>
                )}
                {classTeacherAllocations.map((item) => (
                  <div
                    key={item._id}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 transition ${
                      editingClassTeacherId === item._id
                        ? "border-amber-400 bg-amber-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <p className="font-medium text-gray-800">
                        {item.teacherId?.name || item.teacherId?.employeeCode || "Teacher"}
                      </p>
                      <p className="text-xs text-gray-500">
                        Class {item.classId?.name || "—"} | Section {item.sectionId?.name || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditClassTeacher(item)}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                        title="Edit class teacher"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteClassTeacher(item._id)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                        title="Remove class teacher"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ EDIT MODALS ═══════════════ */}

        {/* Edit Year */}
        <EditModal isOpen={editingYear !== null} onClose={() => setEditingYear(null)} title="Edit Academic Year" onSubmit={updateYear} isSubmitting={isSubmitting}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Year Name</label>
              <input type="text" value={editingYear?.name || ""} onChange={(e) => setEditingYear((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Start Date</label>
                <input type="date" value={editingYear?.startDate?.split("T")[0] || ""}
                  onChange={(e) => setEditingYear((p) => ({ ...p, startDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">End Date</label>
                <input type="date" value={editingYear?.endDate?.split("T")[0] || ""}
                  onChange={(e) => setEditingYear((p) => ({ ...p, endDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={editingYear?.isActive || false}
                onChange={(e) => setEditingYear((p) => ({ ...p, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400" />
              Set as active
            </label>
          </div>
        </EditModal>

        {/* Edit Class */}
        <EditModal isOpen={editingClass !== null} onClose={() => setEditingClass(null)} title="Edit Class" onSubmit={updateClass} isSubmitting={isSubmitting}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Class Name</label>
              <input type="text" value={editingClass?.name || ""} onChange={(e) => setEditingClass((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Academic Year</label>
              <select value={editingClass?.academicYearId || ""} onChange={(e) => setEditingClass((p) => ({ ...p, academicYearId: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100">
                <option value="">Select year</option>
                {activeYears.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Display Order</label>
              <input type="number" min="0" value={editingClass?.order ?? ""} onChange={(e) => setEditingClass((p) => ({ ...p, order: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100" placeholder="0" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Standard</label>
                <select
                  value={editingClass?.standard ?? ""}
                  onChange={(e) => setEditingClass((p) => ({ ...p, standard: e.target.value || undefined }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                >
                  <option value="">Optional</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((level) => (
                    <option key={level} value={level}>
                      Class {level}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Stream</label>
                <select
                  value={editingClass?.stream || ""}
                  onChange={(e) => setEditingClass((p) => ({ ...p, stream: e.target.value || undefined }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                >
                  <option value="">No stream</option>
                  {SENIOR_SECONDARY_STREAM_OPTIONS.map((stream) => (
                    <option key={stream.value} value={stream.value}>
                      {stream.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </EditModal>

        {/* Edit Section */}
        <EditModal isOpen={editingSection !== null} onClose={() => setEditingSection(null)} title="Edit Section" onSubmit={updateSection} isSubmitting={isSubmitting}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Section Name</label>
              <input type="text" value={editingSection?.name || ""} onChange={(e) => setEditingSection((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
              <select value={editingSection?.classId || ""} onChange={(e) => setEditingSection((p) => ({ ...p, classId: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100" required>
                <option value="">Select class</option>
                {visibleClasses.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </EditModal>

        {/* Edit Subject */}
        <EditModal isOpen={editingSubject !== null} onClose={() => setEditingSubject(null)} title="Edit Subject" onSubmit={updateSubject} isSubmitting={isSubmitting}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Subject Name</label>
              <input type="text" value={editingSubject?.name || ""} onChange={(e) => setEditingSubject((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100" required />
            </div>
            {/* <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Subject Code</label>
              <input type="text" value={editingSubject?.code || ""} onChange={(e) => setEditingSubject((p) => ({ ...p, code: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                placeholder="MATH101" />
            </div> */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
              <select value={editingSubject?.classId || ""} onChange={(e) => setEditingSubject((p) => ({ ...p, classId: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100">
                <option value="">Optional</option>
                {visibleClasses.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Stream</label>
              <select
                value={editingSubject?.stream || ""}
                onChange={(e) => setEditingSubject((p) => ({ ...p, stream: e.target.value || undefined }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
              >
                <option value="">No stream</option>
                {SENIOR_SECONDARY_STREAM_OPTIONS.map((stream) => (
                  <option key={stream.value} value={stream.value}>
                    {stream.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </EditModal>
      </div>
    </div>
  );
};

export default AcademicSetup;
