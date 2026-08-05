import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Calendar, Layers, Plus, Edit3, Trash2, X,
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Search, GraduationCap, Copy,
  FolderOpen, UserCheck, Sparkles, CheckCircle2, Check, ArrowRight, Info, Trophy, ListOrdered, Type,
  RefreshCw, Loader2,
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

const CLASS_ADD_MODES = [
  { key: "range", icon: ListOrdered, title: "Numbered Range", desc: "Class 1 through Class 10, generated instantly." },
  { key: "custom", icon: Type, title: "Custom List", desc: "Type any names — Nursery, LKG, UKG, and so on." },
  { key: "stream", icon: GraduationCap, title: "11/12 + Stream", desc: "Senior secondary class with a stream and subjects." },
];

const QUICK_CLASS_PRESETS = [
  { label: "Classes 1–5", mode: "range", from: "1", to: "5" },
  { label: "Classes 1–10", mode: "range", from: "1", to: "10" },
  { label: "Classes 1–12", mode: "range", from: "1", to: "12" },
  { label: "Nursery, LKG, UKG", mode: "custom", text: "Nursery, LKG, UKG" },
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
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  return (
  <AnimatePresence>
    {isOpen && (
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
          className="w-full max-w-md rounded-3xl border border-gray-100 bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="flex items-center gap-2.5 text-lg font-bold text-gray-800">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
                <Edit3 className="h-4 w-4 text-white" />
              </span>
              {title}
            </h2>
            <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={onSubmit} className="px-6 py-5">
            {children}
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200/70 transition hover:shadow-lg disabled:opacity-50">
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </Motion.div>
      </Motion.div>
    )}
  </AnimatePresence>
  );
};

const ClassFilterTabs = ({ tabs, activeId, onChange, countsByClassId }) => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    const onResize = () => updateScrollState();
    el.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", onResize);
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
    };
  }, [tabs.length]);

  const scrollByAmount = (dir) => scrollRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });

  return (
    <div className="flex items-center gap-1 rounded-2xl border border-gray-200/70 bg-white/70 p-1.5 shadow-sm backdrop-blur">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount(-1)}
          className="flex shrink-0 items-center justify-center rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div ref={scrollRef} className="flex flex-1 gap-1 overflow-x-hidden scroll-smooth">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${activeId === tab.id
                ? "bg-blue-100 text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
              }`}
          >
            {tab.name}
            {tab.id !== "all" && (
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${activeId === tab.id
                    ? "bg-blue-200 text-blue-700"
                    : "bg-gray-200 text-gray-500"
                  }`}
              >
                {countsByClassId[tab.id] || 0}
              </span>
            )}
          </button>
        ))}
      </div>
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByAmount(1)}
          className="flex shrink-0 items-center justify-center rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

const AcademicSetup = ({ setShowAdminHeader }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("years");
  const [selectedYearId, setSelectedYearId] = useState(null);
  const [years, setYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherAllocations, setTeacherAllocations] = useState([]);
  const [error, setError] = useState("");

  // Forms
  const [yearForm, setYearForm] = useState({ name: "", startDate: "", endDate: "", status: "active", isActive: true });
  const [classTeacherForm, setClassTeacherForm] = useState({ teacherId: "", yearId: "", classId: "", sectionId: "" });

  // Bulk add forms
  const [classAddMode, setClassAddMode] = useState("range"); // "range" | "custom" | "stream"
  const [classRangeForm, setClassRangeForm] = useState({ from: "1", to: "10", academicYearId: "", prefix: "" });
  const [classCustomInput, setClassCustomInput] = useState("");
  const [classCustomYear, setClassCustomYear] = useState("");
  const [seniorSecondaryForm, setSeniorSecondaryForm] = useState({
    standard: "11",
    stream: "science",
  });
  const [sectionBulkForm, setSectionBulkForm] = useState({ selected: [], custom: "", classIds: [] });
  const [subjectTags, setSubjectTags] = useState([]);
  const [subjectTagInput, setSubjectTagInput] = useState("");
  const [assignClassId, setAssignClassId] = useState("");
  const [assignSubjectIds, setAssignSubjectIds] = useState([]);

  // Edit states
  const [editingYear, setEditingYear] = useState(null);
  const [editingClass, setEditingClass] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [savingClassTeacher, setSavingClassTeacher] = useState(false);
  const [editingClassTeacherId, setEditingClassTeacherId] = useState(null);

  // Search/filter
  const [yearSuccessMessage, setYearSuccessMessage] = useState("");
  const [showYearForm, setShowYearForm] = useState(false);
  const [searchClass, setSearchClass] = useState("");
  const [showAddClassesModal, setShowAddClassesModal] = useState(false);
  const [showClassForm, setShowClassForm] = useState(false);
  const [searchSection, setSearchSection] = useState("");
  const [searchSubject, setSearchSubject] = useState("");

  // Loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
  const [itemsPerPage, setItemsPerPage] = useState(5); // For classes, sections, subjects
  const [yearItemsPerPage, setYearItemsPerPage] = useState(2); // For academic years

  // Bulk selection
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);

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
  const selectedYear = useMemo(
    () => years.find((y) => String(y?._id || "") === String(selectedYearId)) || null,
    [years, selectedYearId]
  );
  const classCountByYearId = useMemo(() => {
    const map = {};
    classes.forEach((c) => {
      const yearId = String(c?.academicYearId || "").trim();
      if (yearId) map[yearId] = (map[yearId] || 0) + 1;
    });
    return map;
  }, [classes]);
  const visibleClasses = useMemo(
    () =>
      classes.filter((item) => {
        const yearId = String(item?.academicYearId || "").trim();
        if (selectedYearId) return yearId === String(selectedYearId);
        if (!yearId) return true;
        return activeYearIdSet.has(yearId);
      }),
    [classes, activeYearIdSet, selectedYearId]
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

  const unassignedSubjects = useMemo(
    () => subjects.filter((s) => !String(s?.classId || "").trim()),
    [subjects]
  );

  const subjectClassTabs = useMemo(() => {
    return [
      { id: "all", name: "All Classes" },
      { id: "unassigned", name: "Unassigned" },
      ...visibleClasses.map((c) => ({ id: String(c._id), name: c.name })),
    ];
  }, [visibleClasses]);

  const subjectsByClass = useMemo(() => {
    const map = { unassigned: unassignedSubjects.length };
    classes.forEach((c) => { map[String(c._id)] = 0; });
    subjects.forEach((s) => {
      const cId = String(s.classId || "");
      if (cId && map[cId] !== undefined) {
        map[cId]++;
      }
    });
    return map;
  }, [subjects, classes, unassignedSubjects]);

  /* ─── Filtered data ─── */
  const filteredYears = years;

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
    if (activeSubjectClassId === "unassigned") {
      list = list.filter((s) => !String(s.classId || "").trim());
    } else if (activeSubjectClassId !== "all") {
      list = list.filter((s) => String(s.classId || "").trim() === activeSubjectClassId);
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
    setDeletingId(id);
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
      Swal.fire({ title: "Deleted!", text: "Class teacher assignment has been removed.", icon: "success", timer: 2000, showConfirmButton: false });
    } catch (err) {
      setError(err.message);
      Swal.fire({ title: "Error", text: err.message, icon: "error" });
    } finally {
      setDeletingId(null);
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
    setShowAdminHeader?.(true);
    setError("");
    loadAcademicData().catch(handleApiError);
    loadClassTeachers().catch(() => {});
  }, [setShowAdminHeader]);

  /* Jump back to page 1 whenever the underlying filter changes — otherwise a
     class filter/search can leave the current page past the new (smaller)
     result set, making the table look empty until the page is reset. */
  useEffect(() => { setClassPage(1); }, [searchClass, selectedYearId]);
  useEffect(() => { setSectionPage(1); }, [searchSection, activeClassId, selectedYearId]);
  useEffect(() => { setSubjectPage(1); }, [searchSubject, activeSubjectClassId, selectedYearId]);
  useEffect(() => { setAssignClassId(""); setAssignSubjectIds([]); }, [selectedYearId]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setError("");
    try {
      await Promise.all([loadAcademicData(), loadClassTeachers()]);
      toast.success("Data Refreshed");
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  /* Close the Add Academic Year modal on Escape */
  useEffect(() => {
    if (!showYearForm) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setShowYearForm(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showYearForm]);

  /* Close the Add Classes modal on Escape */
  useEffect(() => {
    if (!showAddClassesModal) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setShowAddClassesModal(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showAddClassesModal]);

  const showTransientSuccess = (setter, message, durationMs = 4000) => {
    setter(message);
    window.setTimeout(() => setter(""), durationMs);
  };

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
  const submitYearWithMode = async (mode) => {
    if (!yearForm.name.trim()) {
      setError("Academic year name is required");
      return;
    }
    // Drafts are saved but never made the school's default academic year —
    // only "Save & Continue" respects the "make this the default" checkbox.
    const payload = mode === "draft"
      ? { ...yearForm, isActive: false, status: yearForm.status === "active" ? "upcoming" : yearForm.status }
      : yearForm;
    await handleCreate("/api/academic/years", payload, async () => {
      await loadAcademicData();
      setYearForm({ name: "", startDate: "", endDate: "", status: "active", isActive: true });
      setShowYearForm(false);
      showTransientSuccess(setYearSuccessMessage, mode === "draft" ? "Saved as draft." : "Academic year added successfully!");
      if (mode === "continue") setActiveTab("classes");
    });
  };
  const submitYear = (e) => {
    e.preventDefault();
    submitYearWithMode("continue");
  };
  const saveYearAsDraft = () => submitYearWithMode("draft");


  /* ─── Quick-add preset: pre-fill mode + form, then open the modal ─── */
  const openClassAddMode = (mode) => {
    setClassAddMode(mode);
    setShowAddClassesModal(true);
    if (selectedYearId) {
      setClassRangeForm((p) => ({ ...p, academicYearId: selectedYearId }));
      setClassCustomYear(selectedYearId);
    }
  };
  const applyQuickClassPreset = (preset) => {
    if (preset.mode === "range") {
      setClassRangeForm((p) => ({ ...p, from: preset.from, to: preset.to }));
    } else if (preset.mode === "custom") {
      setClassCustomInput(preset.text);
    }
    openClassAddMode(preset.mode);
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
    toast.success(`${created} class${created !== 1 ? "es" : ""} created${failed ? `, ${failed} failed` : ""}.`);
  };

  const submitSeniorSecondaryStreamSetup = async (e) => {
    e.preventDefault();
    const targetYear = selectedYear || currentAcademicYear;
    if (!targetYear?._id) {
      toast("No active academic year found. Please activate a session first.", { icon: "⚠️" });
      return;
    }

    const standardValue = Number(seniorSecondaryForm.standard);
    if (![11, 12].includes(standardValue)) {
      toast("Only Class 11 or Class 12 can be added from this setup.", { icon: "⚠️" });
      return;
    }

    const streamValue = String(seniorSecondaryForm.stream || "").trim().toLowerCase();
    if (!streamValue) {
      toast("Select a stream.", { icon: "⚠️" });
      return;
    }

    const streamLabel =
      SENIOR_SECONDARY_STREAM_OPTIONS.find((item) => item.value === streamValue)?.label || "Stream";
    const className = `Class ${standardValue} - ${streamLabel}`;

    setIsSubmitting(true);
    setError("");

    try {
      const existingClass = classes.find(
        (item) =>
          String(item.academicYearId || "") === String(targetYear._id) &&
          Number(item.standard) === standardValue &&
          String(item.stream || "").toLowerCase() === streamValue
      );

      if (existingClass?._id) {
        toast("This class already exists for the selected year.", { icon: "⚠️" });
        return;
      }

      const classRes = await fetch(`${API_BASE}/api/academic/classes`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: className,
          academicYearId: targetYear._id,
          order: standardValue,
          standard: standardValue,
          stream: streamValue,
        }),
      });
      const classData = await classRes.json().catch(() => ({}));
      if (!classRes.ok) {
        throw new Error(classData.error || "Unable to create class");
      }

      await loadAcademicData();
      setSeniorSecondaryForm({ standard: "11", stream: "science" });
      toast.success(`${className} created.`);
    } catch (err) {
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
    toast.success(`${created} section${created !== 1 ? "s" : ""} created${failed ? `, ${failed} failed` : ""}.`);
  };

  /* ─── Bulk submit: subjects (school-wide catalog, unassigned) ─── */
  const submitSubjectsBulk = async (e) => {
    e.preventDefault();
    const extra = subjectTagInput.split(",").map((s) => s.trim()).filter(Boolean);
    const allNames = [...new Set([...subjectTags, ...extra])];
    if (!allNames.length) { toast("Add at least one subject.", { icon: "⚠️" }); return; }
    setIsSubmitting(true);
    setError("");
    let created = 0, failed = 0;
    for (const name of allNames) {
      try {
        const res = await fetch(`${API_BASE}/api/academic/subjects`, {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ name }),
        });
        if (res.ok) created++; else failed++;
      } catch { failed++; }
    }
    await loadAcademicData();
    setIsSubmitting(false);
    setSubjectTags([]);
    setSubjectTagInput("");
    toast.success(`${created} subject${created !== 1 ? "s" : ""} added to the catalog${failed ? `, ${failed} failed` : ""}.`);
  };

  /* ─── Assign existing unassigned subjects to a class ─── */
  const submitAssignSubjects = async (e) => {
    e.preventDefault();
    if (!assignClassId) { toast("Select a class to assign subjects to.", { icon: "⚠️" }); return; }
    if (!assignSubjectIds.length) { toast("Select at least one subject to assign.", { icon: "⚠️" }); return; }
    setIsSubmitting(true);
    setError("");
    let assigned = 0, failed = 0;
    for (const subjectId of assignSubjectIds) {
      const subject = subjects.find((s) => String(s._id) === subjectId);
      if (!subject) { failed++; continue; }
      try {
        const res = await fetch(`${API_BASE}/api/academic/subjects/${subjectId}`, {
          method: "PUT", headers: authHeaders,
          body: JSON.stringify({ name: subject.name, code: subject.code, classId: assignClassId }),
        });
        if (res.ok) assigned++; else failed++;
      } catch { failed++; }
    }
    await loadAcademicData();
    setIsSubmitting(false);
    setAssignSubjectIds([]);
    const className = visibleClasses.find((c) => String(c._id) === assignClassId)?.name || "the class";
    toast.success(`${assigned} subject${assigned !== 1 ? "s" : ""} assigned to ${className}${failed ? `, ${failed} failed` : ""}.`);
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
      status: editingYear.status || (editingYear.isActive ? "active" : "upcoming"),
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

  const ProgressChip = ({ label, value, filled }) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-sm transition-colors ${filled ? "border-[#2E8B57] bg-[#DCEFE3] text-[#2E8B57]" : "border-[#DDE3EA] bg-white text-[#4B5768]"
        }`}
    >
      {label}: <strong className={filled ? "text-[#2E8B57]" : "text-[#14203B]"}>{value}</strong>
    </span>
  );

  const StepNav = ({ prevKey, nextKey, skippable, finishLabel }) => (
    <div className="flex items-center justify-between rounded-2xl px-5 py-4">
      {prevKey ? (
        <button
          type="button"
          onClick={() => setActiveTab(prevKey)}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-[#4B5768] hover:bg-gray-50"
        >
          ← Back
        </button>
      ) : <span />}
      <div className="flex items-center gap-4">
        {skippable && (
          <button
            type="button"
            onClick={() => setActiveTab(nextKey || "done")}
            className="text-sm font-semibold text-gray-400 underline underline-offset-2 hover:text-gray-600"
          >
            Skip this step
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab(nextKey || "done")}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          {nextKey ? "Continue" : (finishLabel || "Finish Setup")} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const STEP_ILLUSTRATIONS = {
    classes: (
      <svg viewBox="0 0 120 90" className="h-full w-full" aria-hidden="true">
        <circle cx="60" cy="45" r="38" fill="#DBEAFE" opacity="0.6" />
        <circle cx="94" cy="20" r="6" fill="#BFDBFE" opacity="0.8" />
        <rect x="30" y="52" width="60" height="12" rx="3" fill="#1D4ED8" />
        <rect x="34" y="38" width="52" height="12" rx="3" fill="#3B82F6" />
        <rect x="38" y="24" width="44" height="12" rx="3" fill="#93C5FD" />
      </svg>
    ),
    sections: (
      <svg viewBox="0 0 120 90" className="h-full w-full" aria-hidden="true">
        <circle cx="60" cy="45" r="38" fill="#DBEAFE" opacity="0.6" />
        <rect x="26" y="24" width="28" height="28" rx="5" fill="#3B82F6" />
        <rect x="66" y="24" width="28" height="28" rx="5" fill="#93C5FD" />
        <rect x="26" y="58" width="28" height="20" rx="5" fill="#BFDBFE" />
        <rect x="66" y="58" width="28" height="20" rx="5" fill="#1D4ED8" />
      </svg>
    ),
    subjects: (
      <svg viewBox="0 0 120 90" className="h-full w-full" aria-hidden="true">
        <circle cx="60" cy="45" r="38" fill="#DBEAFE" opacity="0.6" />
        <path d="M60 32c-9-6-21-6-30-2v34c9-4 21-4 30 2 9-6 21-6 30-2V30c-9-4-21-4-30 2Z" fill="#3B82F6" />
        <path d="M60 32v34" stroke="#1D4ED8" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="30" cy="22" r="5" fill="#BFDBFE" />
      </svg>
    ),
    teachers: (
      <svg viewBox="0 0 120 90" className="h-full w-full" aria-hidden="true">
        <circle cx="60" cy="45" r="38" fill="#DBEAFE" opacity="0.6" />
        <path d="M34 78c0-15 11.6-26 26-26s26 11 26 26" fill="#1D4ED8" />
        <circle cx="60" cy="34" r="13" fill="#3B82F6" />
        <rect x="47" y="18" width="26" height="8" rx="2.5" fill="#1D4ED8" />
        <circle cx="94" cy="22" r="5" fill="#BFDBFE" />
      </svg>
    ),
  };

  const StepHeader = (props) => {
    const StepIcon = props.icon;
    return (
      <div className="flex items-center gap-4 overflow-hidden rounded-2xl border border-[#DDE3EA] bg-white p-6 shadow-sm sm:p-7">
        <div className="min-w-0 flex-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
            <StepIcon className="h-6 w-6 text-blue-600" />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-blue-600">Step {props.step} of 5</p>
          <h2 className="mt-1 text-xl font-bold text-[#14203B]">{props.question}</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-[#4B5768]">{props.explain}</p>
        </div>
        {props.illustration && STEP_ILLUSTRATIONS[props.illustration] && (
          <div className="hidden h-24 w-32 shrink-0 sm:block">
            {STEP_ILLUSTRATIONS[props.illustration]}
          </div>
        )}
      </div>
    );
  };

  const SearchInput = ({ value, onChange, placeholder }) => (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white/90 py-2.5 pl-10 pr-4 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );

  const SortableHeader = ({ label, field, sortConfig, onSort }) => (
    <th
      onClick={() => onSort(field)}
      className="cursor-pointer select-none whitespace-nowrap bg-gray-50/80 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 transition hover:bg-blue-50"
    >
      <div className="flex items-center gap-1.5">
        {label}
        {sortConfig.field === field ? (
          sortConfig.order === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 text-blue-600" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
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
      <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Showing <strong className="text-gray-700">{start}</strong> to <strong className="text-gray-700">{end}</strong> of <strong className="text-gray-700">{totalItems}</strong> entries
          </span>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pStart > 1 && (
            <>
              <button onClick={() => onPageChange(1)} className="h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-gray-600 hover:bg-white border border-transparent hover:border-gray-200">1</button>
              {pStart > 2 && <span className="px-1 text-xs text-gray-300">…</span>}
            </>
          )}
          {pages.map((n) => (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition ${currentPage === n
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-white border border-transparent hover:border-gray-200"
                }`}
            >
              {n}
            </button>
          ))}
          {pEnd < totalPages && (
            <>
              {pEnd < totalPages - 1 && <span className="px-1 text-xs text-gray-300">…</span>}
              <button onClick={() => onPageChange(totalPages)} className="h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-gray-600 hover:bg-white border border-transparent hover:border-gray-200">{totalPages}</button>
            </>
          )}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  const BulkBar = ({ entityType, entityName }) => {
    const [selected] = selectionMap[entityType];
    if (selected.length === 0) return null;
    return (
      <div className="mb-3 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-800">
          <CheckCircle2 className="h-4 w-4 text-blue-500" /> {selected.length} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => selectionMap[entityType][1]([])}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
          <button
            onClick={() => handleBulkDelete(entityType, entityName)}
            className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>
    );
  };

  const EmptyState = ({ search, entity, actionLabel, onAction }) => (
    <div className="flex flex-col items-center justify-center py-14 text-gray-400">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
        <FolderOpen className="h-7 w-7 text-blue-300" />
      </div>
      <p className="text-sm">{search ? `No matching ${entity} found.` : `No ${entity} yet.`}</p>
      {!search && actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" /> {actionLabel}
        </button>
      )}
    </div>
  );

  /* ═══════════════════════ TAB CONFIG ═══════════════════════ */

  const tabs = [
    { key: "classes", label: "Classes", desc: "Add your grades", icon: Layers, count: visibleClasses.length },
    { key: "sections", label: "Sections", desc: "Split classes if needed", icon: BookOpen, count: visibleSections.length },
    { key: "subjects", label: "Subjects", desc: "What's being taught", icon: GraduationCap, count: visibleSubjects.length },
    { key: "class-teachers", label: "Class Teachers", desc: "Who leads each class", icon: UserCheck, count: classTeacherAllocations.length },
  ];

  /* ═══════════════════════ RENDER ═══════════════════════ */

  return (
    <Motion.div
      className="min-h-screen p-4 md:p-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        {/* ─── Header ─── */}
        <Motion.div
          className="relative flex items-start justify-between gap-3 overflow-hidden"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        >
          <div>
            <h1 className="flex items-center gap-2 text-[1.7rem] font-bold leading-tight text-gray-900">
              Let's setup your school 
              {/* <Sparkles className="h-5 w-5 text-blue-400" /> */}
            </h1>
            <p className="mt-1 text-sm text-gray-500">We'll guide you through everything in just a few simple steps.</p>
            {/* <img src="/academic_setup_image.png" alt="" className='inline w-[] h-20' /> */}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh"
            className="mt-1 flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </Motion.div>

        {/* ─── Error ─── */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <AnimatePresence>
        {activeTab !== "years" && (
          <Motion.div
            key="stepper-nav"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <button
              type="button"
              onClick={() => { setActiveTab("years"); setSelectedYearId(null); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 transition hover:text-blue-600"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back to Academic Years
              {selectedYear && <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">{selectedYear.name}</span>}
            </button>

        {/* ─── Step pipeline (horizontal) ─── */}
        <Motion.div
          className="grid w-full items-start gap-2"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          {tabs.map((t, idx) => {
            const isCurrent = activeTab === t.key;
            const isDone = t.count > 0 && !isCurrent;
            const isDimmed = !isCurrent && !isDone;
            return (
              <button
                type="button"
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="flex min-w-0 flex-col items-center gap-2 text-center cursor-pointer"
              >
                <div className="relative flex w-full items-center justify-center">
                  {idx < tabs.length - 1 && (
                    <svg className="absolute left-1/2 top-1/2 h-0.5 w-full -translate-y-1/2" preserveAspectRatio="none">
                      <line
                        x1="0" y1="1" x2="100%" y2="1"
                        strokeWidth="2"
                        strokeDasharray="0,6"
                        strokeLinecap="round"
                        className="stroke-gray-300"
                      />
                    </svg>
                  )}
                  <span
                    className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-opacity ${isDone
                        ? "bg-emerald-500 text-white"
                        : "bg-white text-gray-700 ring-1 ring-inset ring-gray-300"
                      } ${isDimmed ? "opacity-60" : ""}`}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </span>
                </div>
                <div className={`flex flex-col ${isDimmed ? "opacity-60" : ""}`}>
                  <span className={`truncate text-xs font-semibold ${isCurrent ? "text-blue-600" : "text-[#14203B]"}`}>
                    {t.label}
                  </span>
                  <span className="truncate text-[11px] text-gray-500">{t.desc}</span>
                </div>
              </button>
            );
          })}
        </Motion.div>
          </Motion.div>
        )}
        </AnimatePresence>

        <div className="space-y-4">

          {/* ═══════════════ YEARS TAB ═══════════════ */}
          {activeTab === "years" && (
            <Motion.div
              key="years"
              className="space-y-4"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Add Academic Year modal */}
              <AnimatePresence>
                {showYearForm && (
                  <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 h-full"
                    onClick={() => setShowYearForm(false)}
                  >
                  <Motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 14 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 14 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="max-h-[92vh] w-full max-w-3xl overflow-y-auto overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gray-100 px-6 pt-5 pb-4 sm:px-8">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100">
                          <Calendar className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">Academic Year</h3>
                          <p className="text-xs text-gray-500">Create the academic session your school will use.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowYearForm(false)}
                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white hover:text-gray-600"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
                      {/* Left: form */}
                      <div className="px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
                        <form onSubmit={submitYear} className="space-y-4">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Academic Year Name</label>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                              <input type="text" value={yearForm.name} onChange={(e) => setYearForm((p) => ({ ...p, name: e.target.value }))}
                                className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                placeholder="2026-2027" required />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Start Date</label>
                              <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                                <input type="date" value={yearForm.startDate} onChange={(e) => setYearForm((p) => ({ ...p, startDate: e.target.value }))}
                                  className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" required />
                              </div>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-gray-600">End Date</label>
                              <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                                <input type="date" value={yearForm.endDate} onChange={(e) => setYearForm((p) => ({ ...p, endDate: e.target.value }))}
                                  className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" required />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Status</label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { value: "upcoming", label: "Upcoming" },
                                { value: "active", label: "Active" },
                              ].map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setYearForm((p) => ({ ...p, status: opt.value, isActive: opt.value === "active" ? true : (opt.value === "upcoming" ? false : p.isActive) }))}
                                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${yearForm.status === opt.value
                                      ? "border-blue-500 bg-blue-50 text-blue-700"
                                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                    }`}
                                >
                                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${yearForm.status === opt.value ? "border-blue-600" : "border-gray-300"
                                    }`}>
                                    {yearForm.status === opt.value && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                                  </span>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={yearForm.isActive}
                              onChange={(e) => setYearForm((p) => ({ ...p, isActive: e.target.checked, status: e.target.checked ? "active" : (p.status === "active" ? "upcoming" : p.status) }))}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                            />
                            Make this the default academic year
                          </label>

                          <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 sm:items-center sm:justify-between">
                            <p className="flex items-start gap-1.5 text-xs text-gray-400 text-left justify-start w-full">
                              <Info className="h-3.5 w-3.5" /> You can always edit these details later.
                            </p>
                            <div className="flex items-center gap-2 w-full ">
                              {/* <button
                                type="button"
                                onClick={saveYearAsDraft}
                                disabled={isSubmitting}
                                className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                              >
                                Save as Draft
                              </button> */}
                              <button type="submit" disabled={isSubmitting}
                                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed w-full text-center">
                                {isSubmitting ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                                  </>
                                ) : (
                                  <>
                                    Save &amp; Continue <ArrowRight className="h-4 w-4" />
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>

                      {/* Right: live preview */}
                      <div className="relative overflow-hidden border-t border-gray-100 bg-blue-500/50 p-6 text-white sm:border-l sm:border-t-0">
                        <img src="/academic_setup_image.png" alt="Academic Setup" className="absolute -right-12 -bottom-8 w-full opacity-60" />
                        <div className="relative z-10">
                          <p className="flex items-center gap-1.5 text-xs font-bold text-white/80">
                            <Calendar size={16} /> Academic Year Preview
                          </p>
                          <p className="mt-4 text-2xl font-bold">{yearForm.name || "—"}</p>
                          <div className="mt-4 space-y-3 text-sm">
                            <div className="flex items-center justify-between rounded-lg bg-black/10 px-3 py-2 backdrop-blur-sm">
                              <div>
                                <p className="flex items-center gap-1.5 text-xs text-white/70"><Calendar className="h-3.5 w-3.5" /> Starts</p>
                                <p className="mt-0.5 font-semibold">{yearForm.startDate ? new Date(yearForm.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
                              </div>
                              <div className="h-8 w-px bg-white/20" />
                              <div className="text-right">
                                <p className="flex items-center justify-end gap-1.5 text-xs text-white/70"><Calendar className="h-3.5 w-3.5" /> Ends</p>
                                <p className="mt-0.5 font-semibold">{yearForm.endDate ? new Date(yearForm.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
                              </div>
                            </div>
                            <div className="rounded-lg bg-black/10 px-3 py-2 backdrop-blur-sm">
                              <p className="flex items-center gap-1.5 text-xs text-white/70"><CheckCircle2 className="h-3.5 w-3.5" /> Status</p>
                              <p className="mt-0.5 font-semibold capitalize">{yearForm.status}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Motion.div>
                  </Motion.div>
                )}
              </AnimatePresence>


              {/* Success banner */}
              <AnimatePresence>
                {yearSuccessMessage && (
                  <Motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" /> {yearSuccessMessage}
                  </Motion.div>
                )}
              </AnimatePresence>

              {/* Select an academic year to manage its classes/sections/subjects/class teachers */}
              <div>
                <p className="mb-0.5 text-xs font-bold uppercase tracking-widest text-blue-500">Step 1</p>
                <h2 className="mb-4 text-lg font-bold text-gray-900">Select a year to manage</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sortedYears.map((year, idx) => {
                    const statusLabel = year.status || (year.isActive ? "active" : "upcoming");
                    const isLive = statusLabel === "active";
                    const statusStyles = {
                      active: "bg-emerald-50 text-emerald-700",
                      upcoming: "bg-blue-50 text-blue-700",
                      archived: "bg-gray-100 text-gray-500",
                    };
                    const statusDot = {
                      active: "bg-emerald-500",
                      upcoming: "bg-blue-500",
                      archived: "bg-gray-400",
                    };
                    const classCount = classCountByYearId[String(year._id)] || 0;
                    return (
                      <Motion.button
                        key={year._id}
                        type="button"
                        onClick={() => { setSelectedYearId(year._id); setActiveTab("classes"); }}
                        initial={{ opacity: 0, y: 16, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.35, delay: idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
                        whileHover={{ y: -6 }}
                        whileTap={{ scale: 0.97 }}
                        className={`group relative flex flex-col items-start gap-1 text-black overflow-hidden rounded-3xl p-5 text-left shadow-sm transition-shadow duration-300 hover:shadow-xl cursor-pointer ${isLive
                            ? "bg-gradient-to-br from-blue-400 via-blue-300 to-indigo-300 text-white shadow-blue-200"
                            : "border border-gray-200 bg-white hover:border-blue-200 hover:shadow-blue-100"
                          }`}
                      >
                        <div
                          className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl transition-opacity duration-300 ${isLive ? "bg-white/20 opacity-100" : "bg-blue-100 opacity-0 group-hover:opacity-100"
                            }`}
                        />

                        <div className="relative flex w-full items-start justify-between">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 ${isLive ? "bg-white/15 text-white" : "bg-blue-50 text-blue-600"
                              }`}
                          >
                            <Calendar className="h-5 w-5" />
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${isLive ? "bg-green-200/40 text-green-500" : statusStyles[statusLabel] || statusStyles.upcoming
                              }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-500" : statusDot[statusLabel] || statusDot.upcoming}`} />
                            {statusLabel}
                          </span>
                        </div>

                        <p className={`relative mt-3 text-xl font-extrabold tracking-tight ${isLive ? "text-white" : "text-gray-900"}`}>{year.name}</p>
                        <p className={`relative text-xs ${isLive ? "text-white/75" : "text-gray-500"}`}>
                          {year.startDate ? new Date(year.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          {" – "}
                          {year.endDate ? new Date(year.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </p>

                        <div
                          className={`relative mt-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${isLive ? "bg-white/15 text-white" : "bg-gray-50 text-gray-600"
                            }`}
                        >
                          <Layers className="h-3.5 w-3.5" /> {classCount} {classCount === 1 ? "class" : "classes"}
                        </div>

                        <div className={`relative mt-4 flex w-full items-center justify-between border-t pt-3 ${isLive ? "border-white/20" : "border-gray-100"}`}>
                          <span className={`text-xs font-bold ${isLive ? "text-white" : "text-blue-600"}`}>Manage this year</span>
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-300 group-hover:translate-x-1 ${isLive ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                              }`}
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </Motion.button>
                    );
                  })}

                  <Motion.button
                    type="button"
                    onClick={() => setShowYearForm(true)}
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.35, delay: sortedYears.length * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -6 }}
                    whileTap={{ scale: 0.97 }}
                    className="group flex min-h-48 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-5 text-center text-gray-400 transition-all duration-300 hover:border-blue-400 hover:bg-blue-50/60 hover:text-blue-600"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-200">
                      <Plus className="h-6 w-6" />
                    </span>
                    <span className="text-sm font-bold">Add Academic Year</span>
                  </Motion.button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr] lg:items-start">
                {/* Current academic year card */}
                <div className="relative overflow-hidden rounded-2xl bg-blue-500/50 p-6 text-white shadow-lg shadow-blue-200/50">
                  <img src="/academic_setup_image.png" alt="Academic Setup" className="absolute -right-12 -bottom-20 w-full h-full object-cover" />
                  <div className="relative z-10">
                    <p className="flex items-center gap-1.5 text-xs font-bold">
                      <Calendar size={16} /> Current Academic Year
                    </p>
                    {currentAcademicYear ? (
                      <>
                        <p className="mt-4 text-3xl font-bold">{currentAcademicYear.name}</p>
                        <div className="mt-4 space-y-3 text-sm">
                          <div className="flex items-center justify-between rounded-lg bg-black/5 px-3 py-2 backdrop-blur-sm">
                            <div>
                              <p className="flex items-center gap-1.5 text-xs text-white/70"><Calendar className="h-3.5 w-3.5" /> Starts</p>
                              <p className="mt-0.5 font-semibold">{currentAcademicYear.startDate ? new Date(currentAcademicYear.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
                            </div>
                            <div className="h-8 w-px bg-white/20" />
                            <div className="text-right">
                              <p className="flex items-center justify-end gap-1.5 text-xs text-white/70"><Calendar className="h-3.5 w-3.5" /> Ends</p>
                              <p className="mt-0.5 font-semibold">{currentAcademicYear.endDate ? new Date(currentAcademicYear.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
                            </div>
                          </div>
                          <div className="rounded-lg bg-black/5 px-3 py-2 backdrop-blur-sm">
                            <p className="flex items-center gap-1.5 text-xs text-white/70"><CheckCircle2 className="h-3.5 w-3.5" /> Status</p>
                            <p className="mt-0.5 font-semibold capitalize">{currentAcademicYear.status || "active"}</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="mt-5 flex flex-col items-center text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                          <Calendar className="h-6 w-6 text-white" />
                        </div>
                        <p className="mt-3 text-sm font-semibold">No academic year yet</p>
                        <p className="mt-1 text-xs text-white/80">Add one to get started.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Table Card */}
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-blue-50/40 px-5 py-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">Academic Years</h3>
                      <p className="mt-0.5 text-xs text-gray-500">Below is the list of all academic years in your school.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowYearForm(true)}
                      className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
                    >
                      <Plus className="h-4 w-4" /> Add Academic Year
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <SortableHeader label="Year Name" field="name" sortConfig={yearSort} onSort={toggleSort(setYearSort)} />
                          <SortableHeader label="Start Date" field="startDate" sortConfig={yearSort} onSort={toggleSort(setYearSort)} />
                          <SortableHeader label="End Date" field="endDate" sortConfig={yearSort} onSort={toggleSort(setYearSort)} />
                          <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                          <th className="bg-gray-50 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paginatedYears.map((year) => (
                          <tr key={year._id} className="transition hover:bg-blue-50/30">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{year.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{year.startDate ? new Date(year.startDate).toLocaleDateString() : "—"}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{year.endDate ? new Date(year.endDate).toLocaleDateString() : "—"}</td>
                            <td className="px-4 py-3">
                              {(() => {
                                const statusLabel = year.status || (year.isActive ? "active" : "upcoming");
                                const statusStyles = {
                                  active: "bg-emerald-50 text-emerald-700",
                                  upcoming: "bg-blue-50 text-blue-700",
                                  archived: "bg-gray-100 text-gray-500",
                                };
                                return (
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[statusLabel] || statusStyles.upcoming}`}>
                                    {statusLabel}
                                  </span>
                                );
                              })()}
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
                                  {deletingId === year._id ? <Loader2 className="h-4 w-4 animate-spin text-red-500" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {paginatedYears.length === 0 && <EmptyState search="" entity="academic years" />}
                  </div>
                  <Pagination currentPage={yearPage} totalItems={sortedYears.length} onPageChange={setYearPage} />
                </div>
              </div>
            </Motion.div>
          )}

          {/* ═══════════════ CLASSES TAB ═══════════════ */}
          {activeTab === "classes" && (
            <Motion.div
              key="classes"
              className="space-y-4"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* <StepHeader
                icon={Layers}
                step={2}
                question="Which classes does your school have?"
                explain="Tap a quick-add group below, or type your own. You can rename or remove any class later."
                illustration="classes"
              /> */}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
                {/* ─── Left: quick add ─── */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    {CLASS_ADD_MODES.map((preset) => {
                      const PresetIcon = preset.icon;
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => openClassAddMode(preset.key)}
                          className="group flex w-full items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
                            <PresetIcon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-800">{preset.title}</p>
                            <p className="mt-0.5 text-xs text-gray-500">{preset.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Quick start</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {QUICK_CLASS_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => applyQuickClassPreset(preset)}
                          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ─── Right: classes list ─── */}
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800">
                        <Layers className="h-4 w-4 text-blue-500" /> Classes
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">{sortedClasses.length}</span>
                      </h3>
                      <p className="mt-0.5 text-xs text-gray-500">All classes currently set up for your school.</p>
                    </div>
                    <div className="w-full sm:w-64">
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
                              onChange={() => handleSelectAll("classes", paginatedClasses)} className="h-4 w-4 rounded border-gray-300 accent-blue-500 cursor-pointer" />
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
                          <tr key={cls._id} className="transition hover:bg-blue-50/30">
                            <td className="px-4 py-3">
                              <input type="checkbox" checked={selectedClasses.includes(cls._id)}
                                onChange={() => handleSelectItem("classes", cls._id)} className="h-4 w-4 rounded border-gray-300 accent-blue-500 cursor-pointer" />
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{cls.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{cls.order ?? 0}</td>
                            <td className="px-4 py-3 text-sm">
                              {cls.stream ? (
                                <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium capitalize text-purple-700">
                                  {String(cls.stream)}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">No stream</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{yearNameById[String(cls.academicYearId || "")] || "—"}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => setEditingClass(cls)} className="rounded-md p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600" title="Edit">
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button onClick={() => deleteClass(cls._id)} disabled={deletingId === cls._id}
                                  className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="Delete">
                                  {deletingId === cls._id ? <Loader2 className="h-4 w-4 animate-spin text-red-500" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {paginatedClasses.length === 0 && (
                      // The EmptyState component is already present and will be displayed when there are no classes.
                      <EmptyState
                        search={searchClass}
                        entity="classes"
                        actionLabel="Add Classes"
                        onAction={() => openClassAddMode("range")}
                      />
                    )}
                  </div>
                  {/* Add Pagination for Classes table */}
                  <Pagination currentPage={classPage} totalItems={sortedClasses.length} onPageChange={setClassPage} />
                </div>
              </div>

              <AnimatePresence>
                {showAddClassesModal && (
                  <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 h-full"
                    onClick={() => setShowAddClassesModal(false)}
                  >
                  <Motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 14 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 14 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="border-b border-gray-100 bg-blue-100 px-5 pt-4 rounded-t-2xl">
                      <div className="flex items-center justify-between pb-3">
                        <h3 className="flex items-center gap-2.5 text-sm font-bold text-gray-800">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white shadow-sm">2</span>
                          Add Classes
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowAddClassesModal(false)}
                          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex gap-1">
                        {CLASS_ADD_MODES.map((preset) => {
                          const PresetIcon = preset.icon;
                          const isActive = classAddMode === preset.key;
                          return (
                            <button
                              key={preset.key}
                              type="button"
                              onClick={() => setClassAddMode(preset.key)}
                              className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-3.5 py-2.5 text-xs font-semibold transition ${isActive ? "border-transparent bg-white text-blue-700" : "border-transparent text-gray-500 hover:bg-white/60 hover:text-gray-700"}`}
                            >
                              <PresetIcon className="h-3.5 w-3.5" /> {preset.title}
                            </button>
                          );
                        })}
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
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
                              <option value="">Select year</option>
                              {activeYears.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">Prefix <span className="text-gray-400">(optional)</span></label>
                            <input type="text" value={classRangeForm.prefix}
                              onChange={(e) => setClassRangeForm((p) => ({ ...p, prefix: e.target.value }))}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              placeholder='e.g. "Class"' />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
                            <input type="number" min={1} value={classRangeForm.from}
                              onChange={(e) => setClassRangeForm((p) => ({ ...p, from: e.target.value }))}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              required />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
                            <input type="number" min={1} value={classRangeForm.to}
                              onChange={(e) => setClassRangeForm((p) => ({ ...p, to: e.target.value }))}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              required />
                          </div>
                        </div>
                        {/* Live preview */}
                        {hasValidClassRange && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-2">Preview — {classRangeCount} classes:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {Array.from({ length: Math.min(classRangeCount, 30) }, (_, i) => (
                                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium border border-blue-200">
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
                          className="flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50">
                          <Plus className="h-4 w-4" />
                          {isSubmitting ? "Creating…" : `Create ${classRangeCount} Classes`}
                        </button>
                      </form>
                    ) : classAddMode === "custom" ? (
                      <form onSubmit={submitClassCustom} className="p-5 space-y-4">
                        <p className="text-xs text-gray-500">Type class names separated by commas — e.g. <span className="font-mono bg-gray-100 px-1 rounded">Nursery, LKG, UKG, 1, 2, 3</span></p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">Academic Year</label>
                            <select value={classCustomYear} onChange={(e) => setClassCustomYear(e.target.value)}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
                              <option value="">Select year</option>
                              {activeYears.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-gray-600">Class names (comma-separated)</label>
                            <input type="text" value={classCustomInput}
                              onChange={(e) => setClassCustomInput(e.target.value)}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              placeholder="Nursery, LKG, UKG, 1, 2, 3, 4, 5" required />
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
                                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium border border-blue-200">
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <button type="submit" disabled={isSubmitting || !classCustomInput.trim()}
                          className="flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50">
                          <Plus className="h-4 w-4" />
                          {isSubmitting ? "Creating…" : `Create ${classCustomInput.split(",").filter((s) => s.trim()).length || 0} Classes`}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={submitSeniorSecondaryStreamSetup} className="p-5 space-y-4">
                        <p className="text-xs text-gray-500">
                          Create Class 11 or 12 with a stream in <span className="font-medium">{(selectedYear || currentAcademicYear)?.name || "the selected session"}</span>. You can add subjects for it afterwards from the Subjects step.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">Session</label>
                            <input
                              type="text"
                              value={(selectedYear || currentAcademicYear)?.name || "No active year"}
                              disabled
                              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
                            <select
                              value={seniorSecondaryForm.standard}
                              onChange={(e) => setSeniorSecondaryForm((p) => ({ ...p, standard: e.target.value }))}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                              {SENIOR_SECONDARY_STREAM_OPTIONS.map((stream) => (
                                <option key={stream.value} value={stream.value}>
                                  {stream.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting || !(selectedYear || currentAcademicYear)?._id}
                          className="flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          {isSubmitting ? "Saving…" : "Create Class"}
                        </button>
                      </form>
                    )}
                  </Motion.div>
                  </Motion.div>
                )}
              </AnimatePresence>

              <StepNav prevKey={null} nextKey="sections" />
            </Motion.div>
          )}

          {/* Add/Edit Class Modal */}
          <EditModal
            isOpen={showClassForm || editingClass !== null}
            onClose={() => { setShowClassForm(false); setEditingClass(null); }}
            title={editingClass ? "Edit Class" : "Add Class"}
            onSubmit={editingClass ? updateClass : (e) => { e.preventDefault(); /* TODO: Add single class logic */ }}
            isSubmitting={isSubmitting}
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Class Name</label>
                <input type="text" value={editingClass?.name || ""} onChange={(e) => setEditingClass((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Display Order</label>
                <input type="number" min="0" value={editingClass?.order ?? ""} onChange={(e) => setEditingClass((p) => ({ ...p, order: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="0" />
              </div>
            </div>
          </EditModal>

          {/* ═══════════════ SECTIONS TAB ═══════════════ */}
          {activeTab === "sections" && (
            <Motion.div
              key="sections"
              className="space-y-4"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* <StepHeader
                icon={BookOpen}
                step={3}
                question="Do your classes split into sections?"
                explain="Pick a class, then tap the section letters it has — like Class 5-A and Class 5-B."
                illustration="sections"
              /> */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
                {/* ─── Left: Add Sections ─── */}
                <form onSubmit={submitSectionsBulk} className="rounded-2xl border border-blue-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 px-5 py-3 bg-blue-50/40">
                  <h3 className="flex items-center gap-2.5 text-sm font-bold text-gray-800">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white shadow-sm">3</span>
                    Add Sections
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 pl-9.5">Pick a class, tap quick letters and/or type custom names — all created in one click.</p>
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
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
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
                      {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((letter) => {
                        const active = sectionBulkForm.selected.includes(letter);
                        return (
                          <button key={letter} type="button"
                            onClick={() => setSectionBulkForm((p) => ({
                              ...p,
                              selected: active ? p.selected.filter((s) => s !== letter) : [...p.selected, letter],
                            }))}
                            className={`w-10 h-10 rounded-xl text-sm font-bold border-2 transition-all ${active
                                ? "bg-blue-500 border-blue-500 text-white shadow-sm scale-105"
                                : "border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
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
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                            <span key={name} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium border border-blue-200">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  <button type="submit" disabled={isSubmitting}
                    className="w-full flex justify-center items-center rounded-lg bg-blue-500 px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50">
                    <Plus className="" />
                   <span className='text-sm font-medium ml-2'> {isSubmitting ? "Creating…" : "Create Sections"} </span>
                  </button>
                </div>
              </form>

                {/* ─── Right: class filter + sections list ─── */}
                <div className="space-y-4">
                  <ClassFilterTabs tabs={classTabs} activeId={activeClassId} onChange={setActiveClassId} countsByClassId={sectionsByClass} />

                  <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white/90 backdrop-blur shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800">
                        <BookOpen className="h-4 w-4 text-blue-500" /> Sections
                      </h3>
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
                                onChange={() => handleSelectAll("sections", paginatedSections)} className="h-4 w-4 rounded border-gray-300 accent-blue-500 cursor-pointer" />
                            </th>
                            <SortableHeader label="Name" field="name" sortConfig={sectionSort} onSort={toggleSort(setSectionSort)} />
                            <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Class</th>
                            <th className="bg-gray-50 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {paginatedSections.map((sec) => (
                            <tr key={sec._id} className="transition hover:bg-blue-50/30">
                              <td className="px-4 py-3">
                                <input type="checkbox" checked={selectedSections.includes(sec._id)}
                                  onChange={() => handleSelectItem("sections", sec._id)} className="h-4 w-4 rounded border-gray-300 accent-blue-500 cursor-pointer" />
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
                                    {deletingId === sec._id ? <Loader2 className="h-4 w-4 animate-spin text-red-500" /> : <Trash2 className="h-4 w-4" />}
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
              </div>
              <StepNav prevKey="classes" nextKey="subjects" skippable />
            </Motion.div>
          )}

          {/* ═══════════════ SUBJECTS TAB ═══════════════ */}
          {activeTab === "subjects" && (
            <Motion.div
              key="subjects"
              className="space-y-4"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* <StepHeader
                icon={GraduationCap}
                step={4}
                question="What subjects are taught?"
                explain="Type a subject and press Enter to add it. Add as many as you like — Math, Science, English..."
                illustration="subjects"
              /> */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
                {/* ─── Left: Add Subjects + Assign to Class ─── */}
                <div className="space-y-4">
                <form onSubmit={submitSubjectsBulk} className="rounded-2xl border border-blue-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 px-5 py-3 bg-blue-50/40">
                  <h3 className="flex items-center gap-2.5 text-sm font-bold text-gray-800">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white shadow-sm">4</span>
                    Add Subjects
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 pl-9.5">Type a name and press <kbd className="px-1 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px]">Enter</kbd> or <kbd className="px-1 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px]">,</kbd> to add it to the school's subject catalog.</p>
                </div>
                <div className="p-5 space-y-4">
                  {/* Tag chip input */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Subject names</label>
                    <div className={`flex flex-wrap gap-1.5 rounded-lg border px-3 py-2 min-h-11 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all ${subjectTags.length > 0 ? "border-blue-300 bg-blue-50/30" : "border-gray-200"}`}>
                      {subjectTags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium border border-blue-200">
                          {tag}
                          <button type="button" onClick={() => setSubjectTags((p) => p.filter((t) => t !== tag))}
                            className="ml-0.5 rounded-full hover:bg-blue-300 w-3.5 h-3.5 flex items-center justify-center text-blue-700 font-bold">
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
                      {["Mathematics", "Science", "English", "Hindi", "Social Studies", "Computer Science", "Physics", "Chemistry", "Biology", "History", "Geography", "Economics", "Accountancy", "Physical Education", "Art & Craft", "Music"].map((s) => (
                        <button key={s} type="button"
                          disabled={subjectTags.includes(s)}
                          onClick={() => setSubjectTags((p) => [...new Set([...p, s])])}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${subjectTags.includes(s)
                              ? "bg-blue-100 border-blue-300 text-blue-700 opacity-50 cursor-not-allowed"
                              : "border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                            }`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button type="submit" disabled={isSubmitting || (subjectTags.length === 0 && !subjectTagInput.trim())}
                    className="flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50">
                    <Plus className="h-4 w-4" />
                    {isSubmitting ? "Creating…" : `Create ${subjectTags.length + (subjectTagInput.trim() ? subjectTagInput.split(",").filter((s) => s.trim()).length : 0)} Subject${subjectTags.length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </form>

              {/* ─── Assign Subjects to Class ─── */}
              <form onSubmit={submitAssignSubjects} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 px-5 py-3 bg-gray-50">
                  <h3 className="flex items-center gap-2.5 text-sm font-bold text-gray-800">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-500 text-xs font-bold text-white shadow-sm">
                      <UserCheck className="h-3.5 w-3.5" />
                    </span>
                    Assign Subjects to Class
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 pl-9.5">Pick a class, then pick from the unassigned catalog below.</p>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
                    <select
                      value={assignClassId}
                      onChange={(e) => setAssignClassId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select class</option>
                      {visibleClasses.map((c) => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-xs font-medium text-gray-600">
                        Unassigned subjects <span className="text-gray-400">({unassignedSubjects.length})</span>
                      </label>
                      {unassignedSubjects.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setAssignSubjectIds((p) =>
                              p.length === unassignedSubjects.length ? [] : unassignedSubjects.map((s) => String(s._id))
                            )
                          }
                          className="text-[11px] font-semibold text-blue-600 hover:underline"
                        >
                          {assignSubjectIds.length === unassignedSubjects.length ? "Deselect all" : "Select all"}
                        </button>
                      )}
                    </div>
                    {unassignedSubjects.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
                        Every subject is already assigned to a class.
                      </p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                        {unassignedSubjects.map((s) => {
                          const isSelected = assignSubjectIds.includes(String(s._id));
                          return (
                            <label
                              key={s._id}
                              className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  setAssignSubjectIds((p) =>
                                    isSelected ? p.filter((id) => id !== String(s._id)) : [...p, String(s._id)]
                                  )
                                }
                                className="h-4 w-4 rounded border-gray-300 accent-blue-500 cursor-pointer"
                              />
                              <span className={`truncate ${isSelected ? "font-medium text-blue-700" : "text-gray-700"}`}>{s.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !assignClassId || assignSubjectIds.length === 0}
                    className="flex items-center gap-2 rounded-lg bg-gray-800 px-5 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    {isSubmitting ? "Assigning…" : `Assign ${assignSubjectIds.length || ""} Subject${assignSubjectIds.length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </form>
                </div>

                {/* ─── Right: class filter + subjects list ─── */}
                <div className="space-y-4">
                  <ClassFilterTabs tabs={subjectClassTabs} activeId={activeSubjectClassId} onChange={setActiveSubjectClassId} countsByClassId={subjectsByClass} />

                  <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white/90 backdrop-blur shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800">
                        <GraduationCap className="h-4 w-4 text-blue-500" /> Subjects
                      </h3>
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
                                onChange={() => handleSelectAll("subjects", paginatedSubjects)} className="h-4 w-4 rounded border-gray-300 accent-blue-500 cursor-pointer" />
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
                            <tr key={sub._id} className="transition hover:bg-blue-50/30">
                              <td className="px-4 py-3">
                                <input type="checkbox" checked={selectedSubjects.includes(sub._id)}
                                  onChange={() => handleSelectItem("subjects", sub._id)} className="h-4 w-4 rounded border-gray-300 accent-blue-500 cursor-pointer" />
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{sub.name}</td>
                              {/* <td className="px-4 py-3 text-sm text-gray-500">{sub.code || "—"}</td> */}
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {sub.stream ? String(sub.stream).replace(/^./, (ch) => ch.toUpperCase()) : "No Stream"}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">{classNameById[String(sub.classId || "")] || "—"}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => setEditingSubject(sub)} className="rounded-md p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600" title="Edit">
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => deleteSubject(sub._id)} disabled={deletingId === sub._id}
                                    className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="Delete">
                                    {deletingId === sub._id ? <Loader2 className="h-4 w-4 animate-spin text-red-500" /> : <Trash2 className="h-4 w-4" />}
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
              </div>
              <StepNav prevKey="sections" nextKey="class-teachers" />
            </Motion.div>
          )}

          {/* ═══════════════ CLASS TEACHERS TAB ═══════════════ */}
          {activeTab === "class-teachers" && (
            <Motion.div
              key="class-teachers"
              className="space-y-4"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* <StepHeader
                icon={UserCheck}
                step={5}
                question="Who looks after each class?"
                explain="Pick one teacher to be the main point of contact for a class and section. This step is optional — you can do it later too."
                illustration="teachers"
              /> */}
              <form id="class-teacher-form" onSubmit={handleSaveClassTeacher} className={`rounded-2xl border bg-white p-5 shadow-sm ${editingClassTeacherId ? "border-blue-400 ring-2 ring-blue-100" : "border-blue-200"}`}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2.5 text-base font-bold text-gray-800">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white shadow-sm">5</span>
                    {editingClassTeacherId ? "Update Class Teacher" : "Assign Class Teacher"}
                  </h3>
                  {editingClassTeacherId && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
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
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                    className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                  >
                    {savingClassTeacher ? "Saving..." : editingClassTeacherId ? "Update Class Teacher" : "Save Class Teacher"}
                  </button>
                  {editingClassTeacherId ? (
                    <button
                      type="button"
                      onClick={() => { setClassTeacherForm({ teacherId: "", yearId: "", classId: "", sectionId: "" }); setEditingClassTeacherId(null); }}
                      className="rounded-lg border border-blue-300 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50"
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

              <div className="rounded-2xl border border-gray-200/70 bg-white/90 backdrop-blur p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-800">
                  <UserCheck className="h-4 w-4 text-blue-500" /> Current Class Teachers
                </h3>
                <div className="space-y-3">
                  {classTeacherAllocations.length === 0 && (
                    <EmptyState entity="class teachers" />
                  )}
                  {classTeacherAllocations.map((item) => (
                    <div
                      key={item._id}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 transition ${editingClassTeacherId === item._id
                          ? "border-blue-400 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-bold text-white shadow-sm">
                          {String(item.teacherId?.name || item.teacherId?.employeeCode || "T").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">
                            {item.teacherId?.name || item.teacherId?.employeeCode || "Teacher"}
                          </p>
                          <p className="text-xs text-gray-500">
                            Class {item.classId?.name || "—"} | Section {item.sectionId?.name || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditClassTeacher(item)}
                          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          title="Edit class teacher"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteClassTeacher(item._id)}
                          disabled={deletingId === item._id}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="Remove class teacher"
                        >
                          {deletingId === item._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <StepNav prevKey="subjects" nextKey={null} skippable finishLabel="Finish Setup" />
            </Motion.div>
          )}

          {/* ═══════════════ DONE ═══════════════ */}
          {activeTab === "done" && (
            <Motion.div
              key="done"
              className="flex flex-col items-center justify-center rounded-2xl border border-[#DDE3EA] bg-white px-6 py-16 text-center shadow-sm"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#DCEFE3]">
                <Trophy className="h-9 w-9 text-[#2E8B57]" />
              </div>
              <h2 className="text-2xl font-bold text-[#14203B]">You're all set!</h2>
              <p className="mt-2 max-w-md text-sm text-[#4B5768]">
                Your school year is ready. You can fine-tune any of this anytime from this page.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <ProgressChip label="Academic Year" value={selectedYear?.name || years[0]?.name || "—"} filled />
                <ProgressChip label="Classes" value={visibleClasses.length} filled />
                <ProgressChip label="Sections" value={visibleSections.length} filled />
                <ProgressChip label="Subjects" value={visibleSubjects.length} filled />
                <ProgressChip label="Class Teachers" value={classTeacherAllocations.length} filled />
              </div>
              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("classes")}
                  className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-[#4B5768] hover:bg-gray-50"
                >
                  Review Setup
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/admin/dashboard")}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </Motion.div>
          )}

        </div>

        {/* ═══════════════ EDIT MODALS ═══════════════ */}

        {/* Edit Year */}
        <EditModal isOpen={editingYear !== null} onClose={() => setEditingYear(null)} title="Edit Academic Year" onSubmit={updateYear} isSubmitting={isSubmitting}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Year Name</label>
              <input type="text" value={editingYear?.name || ""} onChange={(e) => setEditingYear((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Start Date</label>
                <input type="date" value={editingYear?.startDate?.split("T")[0] || ""}
                  onChange={(e) => setEditingYear((p) => ({ ...p, startDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">End Date</label>
                <input type="date" value={editingYear?.endDate?.split("T")[0] || ""}
                  onChange={(e) => setEditingYear((p) => ({ ...p, endDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Status</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "upcoming", label: "Upcoming" },
                  { value: "active", label: "Active" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditingYear((p) => ({ ...p, status: opt.value, isActive: opt.value === "active" ? true : (opt.value === "upcoming" ? false : p.isActive) }))}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${(editingYear?.status || (editingYear?.isActive ? "active" : "upcoming")) === opt.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={editingYear?.isActive || false}
                onChange={(e) => setEditingYear((p) => ({ ...p, isActive: e.target.checked, status: e.target.checked ? "active" : (p.status === "active" ? "upcoming" : p.status) }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400" />
              Make this the default academic year
            </label>
          </div>
        </EditModal>

        {/* Edit Class */}
        <EditModal isOpen={editingClass !== null} onClose={() => setEditingClass(null)} title="Edit Class" onSubmit={updateClass} isSubmitting={isSubmitting}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Class Name</label>
              <input type="text" value={editingClass?.name || ""} onChange={(e) => setEditingClass((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Academic Year</label>
              <select value={editingClass?.academicYearId || ""} onChange={(e) => setEditingClass((p) => ({ ...p, academicYearId: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option value="">Select year</option>
                {activeYears.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Display Order</label>
              <input type="number" min="0" value={editingClass?.order ?? ""} onChange={(e) => setEditingClass((p) => ({ ...p, order: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="0" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Standard</label>
                <select
                  value={editingClass?.standard ?? ""}
                  onChange={(e) => setEditingClass((p) => ({ ...p, standard: e.target.value || undefined }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
              <select value={editingSection?.classId || ""} onChange={(e) => setEditingSection((p) => ({ ...p, classId: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" required>
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
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" required />
            </div>
            {/* <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Subject Code</label>
              <input type="text" value={editingSubject?.code || ""} onChange={(e) => setEditingSubject((p) => ({ ...p, code: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="MATH101" />
            </div> */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
              <select value={editingSubject?.classId || ""} onChange={(e) => setEditingSubject((p) => ({ ...p, classId: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option value="">Optional</option>
                {visibleClasses.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Stream</label>
              <select
                value={editingSubject?.stream || ""}
                onChange={(e) => setEditingSubject((p) => ({ ...p, stream: e.target.value || undefined }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
    </Motion.div>
  );
};

export default AcademicSetup;
