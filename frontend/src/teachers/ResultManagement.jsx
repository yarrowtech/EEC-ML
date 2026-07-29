import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit2, FileDown, FileUp, Plus, Save, Search, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { formatStudentDisplay } from '../utils/studentDisplay';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const EMPTY_FORM = {
  examId: '',
  studentId: '',
  marks: '',
  grade: '',
  remarks: '',
  status: 'pass',
};

const EMPTY_BULK_ENTRY_FORM = {
  session: '',
  className: '',
  sectionName: '',
  examId: '',
};

const STATUS_OPTIONS = ['pass', 'fail', 'absent'];

const normalizeClass = (value = '') => {
  const text = String(value).trim();
  const digits = text.match(/\d+/);
  if (digits?.[0]) return digits[0];
  return text.replace(/^class\s+/i, '').trim().toLowerCase();
};
const normalizeSection = (value = '') => String(value).trim().toLowerCase();
const getExamAcademicYearId = (exam = {}) =>
  String(exam?.classId?.academicYearId?._id || exam?.classId?.academicYearId || '').trim();
const getExamClassName = (exam = {}) =>
  String(exam?.classId?.name || exam?.grade || exam?.className || exam?.class || '').trim();
const getExamSectionName = (exam = {}) =>
  String(exam?.sectionId?.name || exam?.section || exam?.sectionName || '').trim();
const getAllocationAcademicYearId = (allocation = {}) =>
  String(allocation?.classId?.academicYearId?._id || allocation?.classId?.academicYearId || '').trim();
const getAllocationClassName = (allocation = {}) =>
  String(allocation?.classId?.name || allocation?.className || allocation?.grade || '').trim();
const getAllocationSectionName = (allocation = {}) =>
  String(allocation?.sectionId?.name || allocation?.sectionName || allocation?.section || '').trim();
const getRoutineClassName = (entry = {}) =>
  String(entry?.className || entry?.class || entry?.grade || '').trim();
const getRoutineSectionName = (entry = {}) =>
  String(entry?.sectionName || entry?.section || '').trim();
const isExamCompleted = (exam = {}) => String(exam?.status || '').trim().toLowerCase() === 'completed';
const isExamWithinRange = (exam = {}, startDate, endDate) => {
  const examTime = exam?.date ? new Date(exam.date).getTime() : NaN;
  const startTime = startDate ? new Date(startDate).getTime() : NaN;
  const endTime = endDate ? new Date(endDate).getTime() : NaN;
  if (!Number.isFinite(examTime)) return false;
  if (Number.isFinite(startTime) && examTime < startTime) return false;
  if (Number.isFinite(endTime) && examTime > endTime) return false;
  return true;
};

const deriveGradeFromPercentage = (percentage) => {
  if (!Number.isFinite(percentage)) return '';
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
};


const ResultManagement = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingExamStudents, setLoadingExamStudents] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [results, setResults] = useState([]);
  const [exams, setExams] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [routineScopes, setRoutineScopes] = useState([]);
  const [examStudentsByExamId, setExamStudentsByExamId] = useState({});

  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingResultId, setEditingResultId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [addResultMode, setAddResultMode] = useState('single');
  const [bulkEntryForm, setBulkEntryForm] = useState(EMPTY_BULK_ENTRY_FORM);
  const [bulkEntryRows, setBulkEntryRows] = useState([]);
  const [bulkEntryLoading, setBulkEntryLoading] = useState(false);
  const [bulkEntrySubmitting, setBulkEntrySubmitting] = useState(false);
  const [activeSession, setActiveSession] = useState('');
  const [activeSessionId, setActiveSessionId] = useState('');
  const [activeSessionStartDate, setActiveSessionStartDate] = useState('');
  const [activeSessionEndDate, setActiveSessionEndDate] = useState('');

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkExamId, setBulkExamId] = useState('');
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const examIdFromQuery = params.get('examId') || '';
    if (examIdFromQuery) {
      setSelectedExamId(examIdFromQuery);
    }
  }, [location.search]);

  const apiFetch = useCallback(
    async (path, options = {}) => {
      const headers = {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      };
      if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Request failed');
      }
      return payload;
    },
    [token]
  );

  const loadBootstrap = useCallback(async () => {
    if (!token) {
      setError('Login required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [examData, teacherManageExamData, activeYearResponse, allocationData, routineData] = await Promise.all([
        apiFetch('/api/exam/results/exam-options'),
        apiFetch('/api/exam/teacher/manage').catch(() => []),
        fetch(`${API_BASE}/api/academic/active-year`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
        apiFetch('/api/teacher/dashboard/allocations').catch(() => []),
        apiFetch('/api/teacher/dashboard/routine').catch(() => null),
      ]);
      const examItems = Array.isArray(examData) ? examData : [];
      const teacherManageExamItems = Array.isArray(teacherManageExamData) ? teacherManageExamData : [];
      const mergedExamMap = new Map();
      [...examItems, ...teacherManageExamItems].forEach((exam) => {
        const id = String(exam?._id || '');
        if (!id) return;
        mergedExamMap.set(id, exam);
      });
      setExams(Array.from(mergedExamMap.values()));
      const allocationItems = Array.isArray(allocationData) ? allocationData : [];
      setAllocations(allocationItems);
      const routineSchedule = routineData?.schedule && typeof routineData.schedule === 'object' ? routineData.schedule : {};
      const routineEntries = Object.values(routineSchedule).flatMap((entries) => (Array.isArray(entries) ? entries : []));
      const scopeMap = new Map();
      routineEntries.forEach((entry) => {
        const className = getRoutineClassName(entry);
        if (!className) return;
        const sectionName = getRoutineSectionName(entry);
        const key = `${normalizeClass(className)}::${normalizeSection(sectionName)}`;
        if (!scopeMap.has(key)) {
          scopeMap.set(key, { className, sectionName });
        }
      });
      setRoutineScopes(Array.from(scopeMap.values()));

      if (activeYearResponse?.ok) {
        const activeYear = await activeYearResponse.json().catch(() => null);
        const activeYearName =
          activeYear?.name ||
          activeYear?.academicYear ||
          activeYear?.activeYear ||
          activeYear?.data?.name ||
          '';
        const activeYearId = String(
          activeYear?._id ||
          activeYear?.id ||
          activeYear?.data?._id ||
          activeYear?.data?.id ||
          ''
        ).trim();
        if (activeYearName) {
          setActiveSession(String(activeYearName));
        }
        if (activeYearId) {
          setActiveSessionId(activeYearId);
        }
        setActiveSessionStartDate(String(activeYear?.startDate || activeYear?.data?.startDate || ''));
        setActiveSessionEndDate(String(activeYear?.endDate || activeYear?.data?.endDate || ''));
      }
    } catch (err) {
      setError(err.message || 'Failed to load result setup data');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  const loadResults = useCallback(async () => {
    if (!token) return;
    setError('');

    try {
      const query = new URLSearchParams();
      if (selectedExamId) { query.set('examId', selectedExamId); query.set('enrich', 'true'); }
      if (selectedClass) query.set('grade', selectedClass);
      if (selectedSection) query.set('section', selectedSection);

      const path = `/api/exam/results${query.toString() ? `?${query.toString()}` : ''}`;
      const data = await apiFetch(path);
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load results');
      setResults([]);
    }
  }, [apiFetch, selectedClass, selectedExamId, selectedSection, token]);

  const exportCSV = useCallback(() => {
    const query = new URLSearchParams();
    if (selectedExamId) query.set('examId', selectedExamId);
    if (selectedClass) query.set('grade', selectedClass);
    if (selectedSection) query.set('section', selectedSection);
    const url = `${API_BASE}/api/exam/results/export-csv?${query.toString()}`;
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', '');
    // Attach auth token via fetch since the browser link won't carry the header
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.click();
        URL.revokeObjectURL(objectUrl);
      })
      .catch(() => setError('CSV export failed'));
  }, [API_BASE, selectedClass, selectedExamId, selectedSection, token]);

  const ensureExamStudents = useCallback(
    async (examId) => {
      if (!examId) return [];
      if (examStudentsByExamId[examId]) return examStudentsByExamId[examId];
      setLoadingExamStudents(true);
      try {
        const payload = await apiFetch(`/api/exam/results/exam-students?examId=${encodeURIComponent(examId)}`);
        const students = Array.isArray(payload?.students) ? payload.students : [];
        setExamStudentsByExamId((prev) => ({
          ...prev,
          [examId]: students,
        }));
        return students;
      } catch (err) {
        setError(err.message || 'Unable to load exam students');
        return [];
      } finally {
        setLoadingExamStudents(false);
      }
    },
    [apiFetch, examStudentsByExamId]
  );

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  useEffect(() => {
    if (!showForm && !showBulkUpload) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showForm, showBulkUpload]);

  const activeAllocationScopeKeys = useMemo(() => {
    if (!activeSessionId) return new Set();
    const keys = new Set();
    allocations
      .filter((allocation) => getAllocationAcademicYearId(allocation) === activeSessionId)
      .forEach((allocation) => {
        const classKey = normalizeClass(getAllocationClassName(allocation));
        const sectionKey = normalizeSection(getAllocationSectionName(allocation));
        if (classKey && sectionKey) {
          keys.add(`${classKey}::${sectionKey}`);
        }
      });
    return keys;
  }, [activeSessionId, allocations]);

  const scopedExams = useMemo(() => {
    if (!activeSessionId) return exams;
    return exams.filter((exam) => {
      const examAcademicYearId = getExamAcademicYearId(exam);
      if (examAcademicYearId) return examAcademicYearId === activeSessionId;
      if (isExamWithinRange(exam, activeSessionStartDate, activeSessionEndDate)) return true;

      // Legacy exam fallback: no academic year/date on exam, but scope matches active-session allocations.
      const classKey = normalizeClass(getExamClassName(exam));
      const sectionKey = normalizeSection(getExamSectionName(exam));
      if (classKey && sectionKey && activeAllocationScopeKeys.size) {
        return activeAllocationScopeKeys.has(`${classKey}::${sectionKey}`);
      }
      return false;
    });
  }, [activeAllocationScopeKeys, activeSessionEndDate, activeSessionId, activeSessionStartDate, exams]);

  const scopedAllocations = useMemo(() => {
    if (!activeSessionId) return allocations;
    return allocations.filter((allocation) => getAllocationAcademicYearId(allocation) === activeSessionId);
  }, [activeSessionId, allocations]);

  const selectedExam = useMemo(
    () => scopedExams.find((exam) => String(exam._id) === String(selectedExamId)) || null,
    [scopedExams, selectedExamId]
  );
  const completedScopedExams = useMemo(
    () => scopedExams.filter((exam) => isExamCompleted(exam)),
    [scopedExams]
  );

  useEffect(() => {
    if (!selectedExamId) return;
    if (loading) return;
    if (selectedExam && isExamCompleted(selectedExam)) return;
    setSelectedExamId('');
    setSelectedClass('');
    setSelectedSection('');
  }, [loading, selectedExam, selectedExamId]);

  useEffect(() => {
    if (!selectedExamId || !selectedExam) return;
    setSelectedClass(getExamClassName(selectedExam));
    setSelectedSection(getExamSectionName(selectedExam));
  }, [selectedExam, selectedExamId]);

  const classOptions = useMemo(() => {
    const values = new Set();
    scopedExams.forEach((exam) => {
      const className = getExamClassName(exam);
      if (className) values.add(String(className));
    });
    scopedAllocations.forEach((allocation) => {
      const className = getAllocationClassName(allocation);
      if (className) values.add(String(className));
    });
    routineScopes.forEach((scope) => {
      const className = String(scope?.className || '').trim();
      if (className) values.add(className);
    });
    if (selectedClass) values.add(String(selectedClass));
    return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [routineScopes, scopedAllocations, scopedExams, selectedClass]);

  const sectionOptions = useMemo(() => {
    const values = new Set();
    scopedExams
      .filter((exam) => {
        if (!selectedClass) return true;
        const className = getExamClassName(exam);
        return String(className) === String(selectedClass);
      })
      .forEach((exam) => {
        const sectionName = getExamSectionName(exam);
        if (sectionName) values.add(String(sectionName));
      });
    scopedAllocations
      .filter((allocation) => {
        if (!selectedClass) return true;
        const className = getAllocationClassName(allocation);
        return String(className) === String(selectedClass);
      })
      .forEach((allocation) => {
        const sectionName = getAllocationSectionName(allocation);
        if (sectionName) values.add(String(sectionName));
      });
    routineScopes
      .filter((scope) => {
        if (!selectedClass) return true;
        return normalizeClass(scope?.className || '') === normalizeClass(selectedClass);
      })
      .forEach((scope) => {
        const sectionName = String(scope?.sectionName || '').trim();
        if (sectionName) values.add(sectionName);
      });
    if (selectedSection) values.add(String(selectedSection));
    return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [routineScopes, scopedAllocations, scopedExams, selectedClass, selectedSection]);

  const visibleResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return results;

    return results.filter((result) => {
      const studentName = String(result?.studentId?.name || '').toLowerCase();
      const subject = String(result?.examId?.subject || '').toLowerCase();
      const examTitle = String(result?.examId?.title || '').toLowerCase();
      return studentName.includes(query) || subject.includes(query) || examTitle.includes(query);
    });
  }, [results, search]);

  const formExam = useMemo(
    () => scopedExams.find((exam) => String(exam._id) === String(form.examId)) || null,
    [scopedExams, form.examId]
  );

  const formStudents = useMemo(() => {
    if (!form.examId) return [];
    return examStudentsByExamId[form.examId] || [];
  }, [examStudentsByExamId, form.examId]);

  useEffect(() => {
    if (!showForm || !form.examId || addResultMode !== 'single') return;
    ensureExamStudents(form.examId);
  }, [addResultMode, ensureExamStudents, form.examId, showForm]);

  const sessionOptions = useMemo(() => {
    const values = new Set();
    results.forEach((result) => {
      const session = String(result?.studentId?.academicYear || result?.studentId?.session || '').trim();
      if (session) values.add(session);
    });
    if (!values.size && activeSession) {
      values.add(activeSession);
    }
    return Array.from(values).sort();
  }, [results, activeSession]);

  const bulkClassOptions = useMemo(() => {
    const values = new Set();
    scopedExams.forEach((exam) => {
      const className = getExamClassName(exam);
      if (className) values.add(String(className));
    });
    scopedAllocations.forEach((allocation) => {
      const className = getAllocationClassName(allocation);
      if (className) values.add(String(className));
    });
    routineScopes.forEach((scope) => {
      const className = String(scope?.className || '').trim();
      if (className) values.add(className);
    });
    if (bulkEntryForm.className) values.add(String(bulkEntryForm.className));
    return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [bulkEntryForm.className, routineScopes, scopedAllocations, scopedExams]);

  const bulkSectionOptions = useMemo(() => {
    const values = new Set();
    scopedExams
      .filter((exam) => {
        if (!bulkEntryForm.className) return true;
        const className = getExamClassName(exam);
        return normalizeClass(className) === normalizeClass(bulkEntryForm.className);
      })
      .forEach((exam) => {
        const sectionName = getExamSectionName(exam);
        if (sectionName) values.add(String(sectionName));
      });
    scopedAllocations
      .filter((allocation) => {
        if (!bulkEntryForm.className) return true;
        const className = getAllocationClassName(allocation);
        return normalizeClass(className) === normalizeClass(bulkEntryForm.className);
      })
      .forEach((allocation) => {
        const sectionName = getAllocationSectionName(allocation);
        if (sectionName) values.add(String(sectionName));
      });
    routineScopes
      .filter((scope) => {
        if (!bulkEntryForm.className) return true;
        return normalizeClass(scope?.className || '') === normalizeClass(bulkEntryForm.className);
      })
      .forEach((scope) => {
        const sectionName = String(scope?.sectionName || '').trim();
        if (sectionName) values.add(sectionName);
      });
    if (bulkEntryForm.sectionName) values.add(String(bulkEntryForm.sectionName));
    return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [bulkEntryForm.className, bulkEntryForm.sectionName, routineScopes, scopedAllocations, scopedExams]);

  const bulkExamOptions = useMemo(() => {
    const matchesSelection = (exam) => {
      const examClass = getExamClassName(exam);
      const examSection = getExamSectionName(exam);
      const classMatch = !bulkEntryForm.className || normalizeClass(examClass) === normalizeClass(bulkEntryForm.className);
      const sectionMatch = !bulkEntryForm.sectionName || normalizeSection(examSection) === normalizeSection(bulkEntryForm.sectionName);
      return classMatch && sectionMatch;
    };

    return completedScopedExams.filter(matchesSelection);
  }, [bulkEntryForm.className, bulkEntryForm.sectionName, completedScopedExams]);

  useEffect(() => {
    if (!showForm || addResultMode !== 'bulk') return;
    if (bulkEntryForm.className || bulkClassOptions.length !== 1) return;
    setBulkEntryForm((prev) => ({ ...prev, className: bulkClassOptions[0] || '' }));
  }, [addResultMode, bulkClassOptions, bulkEntryForm.className, showForm]);

  useEffect(() => {
    if (!showForm || addResultMode !== 'bulk') return;
    if (!bulkEntryForm.className) return;
    if (bulkEntryForm.sectionName || bulkSectionOptions.length !== 1) return;
    setBulkEntryForm((prev) => ({ ...prev, sectionName: bulkSectionOptions[0] || '' }));
  }, [addResultMode, bulkEntryForm.className, bulkEntryForm.sectionName, bulkSectionOptions, showForm]);

  const loadBulkEntryRows = useCallback(
    async ({ examId, className, sectionName }) => {
      if (!examId || !className || !sectionName) {
        setBulkEntryRows([]);
        return;
      }

      setBulkEntryLoading(true);
      try {
        const scopedStudents = (await ensureExamStudents(examId))
          .filter((student) => normalizeClass(student?.grade || '') === normalizeClass(className))
          .filter((student) => normalizeSection(student?.section || '') === normalizeSection(sectionName))
          .sort((a, b) => {
            const ra = Number(a?.roll);
            const rb = Number(b?.roll);
            if (Number.isFinite(ra) && Number.isFinite(rb) && ra !== rb) return ra - rb;
            return String(a?.name || '').localeCompare(String(b?.name || ''));
          });

        const existing = await apiFetch(`/api/exam/results?examId=${encodeURIComponent(examId)}`);
        const resultByStudentId = new Map(
          (Array.isArray(existing) ? existing : [])
            .map((item) => [String(item?.studentId?._id || item?.studentId || ''), item])
            .filter(([id]) => Boolean(id))
        );

        const rows = scopedStudents.map((student) => {
          const found = resultByStudentId.get(String(student._id));
          return {
            studentId: String(student._id),
            name: student.name || '',
            roll: student.roll ?? '',
            marks: found?.marks ?? '',
            grade: found?.grade || '',
            status: found?.status || 'pass',
            remarks: found?.remarks || '',
          };
        });

        setBulkEntryRows(rows);
      } catch (err) {
        setError(err.message || 'Failed to load students for bulk entry');
        setBulkEntryRows([]);
      } finally {
        setBulkEntryLoading(false);
      }
    },
    [apiFetch, ensureExamStudents]
  );

  useEffect(() => {
    if (!showForm || addResultMode !== 'bulk') return;
    loadBulkEntryRows(bulkEntryForm);
  }, [addResultMode, bulkEntryForm, loadBulkEntryRows, showForm]);

  const openCreate = () => {
    setEditingResultId(null);
    setForm({
      ...EMPTY_FORM,
      examId: selectedExamId && isExamCompleted(selectedExam) ? selectedExamId : '',
    });
    setAddResultMode('single');
    setBulkEntryForm({
      session: activeSession || sessionOptions[0] || '',
      className: selectedClass || '',
      sectionName: selectedSection || '',
      examId: selectedExamId && isExamCompleted(selectedExam) ? selectedExamId : '',
    });
    setBulkEntryRows([]);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  useEffect(() => {
    if (!showForm || !activeSession) return;
    setBulkEntryForm((prev) => ({
      ...prev,
      session: activeSession,
    }));
  }, [activeSession, showForm]);

  const openEdit = async (item) => {
    const examId = item?.examId?._id || '';
    setEditingResultId(item?._id || null);
    setAddResultMode('single');
    setForm({
      examId,
      studentId: item?.studentId?._id || '',
      marks: item?.marks ?? '',
      grade: item?.grade || '',
      remarks: item?.remarks || '',
      status: item?.status || 'pass',
    });
    setShowForm(true);
    setError('');
    setSuccess('');
    if (examId) await ensureExamStudents(examId);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingResultId(null);
    setForm(EMPTY_FORM);
    setAddResultMode('single');
    setBulkEntryForm(EMPTY_BULK_ENTRY_FORM);
    setBulkEntryRows([]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.examId || !form.studentId) {
      setError('Exam and student are required');
      return;
    }

    const maxMarks = Number(formExam?.marks);
    const marksRequired = form.status !== 'absent';
    let parsedMarks;
    if (marksRequired) {
      parsedMarks = Number(form.marks);
      if (!Number.isFinite(parsedMarks) || parsedMarks < 0) {
        setError('Enter valid marks');
        return;
      }
      if (Number.isFinite(maxMarks) && maxMarks >= 0 && parsedMarks > maxMarks) {
        setError(`Marks cannot be greater than ${maxMarks}`);
        return;
      }
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        examId: form.examId,
        studentId: form.studentId,
        grade: form.grade.trim(),
        remarks: form.remarks.trim(),
        status: form.status,
      };
      if (marksRequired) payload.marks = parsedMarks;

      if (editingResultId) {
        await apiFetch(`/api/exam/results/${editingResultId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSuccess('Result updated successfully');
      } else {
        await apiFetch('/api/exam/results', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess('Result created successfully');
      }

      closeForm();
      await loadResults();
      if (form.examId) {
        setExamStudentsByExamId((prev) => {
          const next = { ...prev };
          delete next[form.examId];
          return next;
        });
        await ensureExamStudents(form.examId);
      }
    } catch (err) {
      setError(err.message || 'Failed to save result');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkRowMarksChange = (studentId, value) => {
    setBulkEntryRows((prev) =>
      prev.map((row) => {
        if (row.studentId !== studentId) return row;
      const selectedBulkExam = completedScopedExams.find((exam) => String(exam._id) === String(bulkEntryForm.examId));
        const parsed = value === '' ? NaN : Number(value);
        const maxMarks = Number(selectedBulkExam?.marks);
        const percentage = Number.isFinite(parsed) && Number.isFinite(maxMarks) && maxMarks > 0
          ? (parsed / maxMarks) * 100
          : NaN;

        return {
          ...row,
          marks: value,
          grade: Number.isFinite(percentage) ? deriveGradeFromPercentage(percentage) : row.grade,
          status: Number.isFinite(percentage) ? (percentage >= 50 ? 'pass' : 'fail') : row.status,
        };
      })
    );
  };

  const handleBulkMarksUpload = async (e) => {
    e.preventDefault();
    const selectedBulkExam = completedScopedExams.find((exam) => String(exam._id) === String(bulkEntryForm.examId));
    if (!selectedBulkExam?._id) {
      setError('Select exam subject');
      return;
    }

    const payloadRows = bulkEntryRows
      .map((row) => {
        const marksText = String(row.marks ?? '').trim();
        if (!marksText && row.status !== 'absent') return null;
        const marks = row.status === 'absent' ? undefined : Number(marksText);
        if (row.status !== 'absent' && (!Number.isFinite(marks) || marks < 0)) {
          return { error: `Invalid marks for ${row.name || 'student'}` };
        }
        return {
          examId: selectedBulkExam._id,
          studentId: row.studentId,
          marks,
          grade: row.grade || '',
          remarks: row.remarks || '',
          status: row.status || 'pass',
        };
      })
      .filter(Boolean);

    const invalid = payloadRows.find((item) => item?.error);
    if (invalid?.error) {
      setError(invalid.error);
      return;
    }

    if (!payloadRows.length) {
      setError('Enter marks for at least one student');
      return;
    }

    setBulkEntrySubmitting(true);
    setError('');
    setSuccess('');

    try {
      const settled = await Promise.allSettled(
        payloadRows.map((body) =>
          apiFetch('/api/exam/results', {
            method: 'POST',
            body: JSON.stringify(body),
          })
        )
      );

      const successCount = settled.filter((item) => item.status === 'fulfilled').length;
      const failedCount = settled.length - successCount;

      if (successCount) {
        setSuccess(`${successCount} result${successCount > 1 ? 's' : ''} uploaded`);
      }
      if (failedCount) {
        setError(`${failedCount} row${failedCount > 1 ? 's' : ''} failed to upload`);
      }

      await loadResults();
      await loadBulkEntryRows(bulkEntryForm);
    } catch (err) {
      setError(err.message || 'Bulk upload failed');
    } finally {
      setBulkEntrySubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(`Delete result for ${item?.studentId?.name || 'this student'}?`);
    if (!confirmed) return;

    try {
      setError('');
      setSuccess('');
      await apiFetch(`/api/exam/results/${item._id}`, { method: 'DELETE' });
      setSuccess('Result deleted successfully');
      await loadResults();
    } catch (err) {
      setError(err.message || 'Failed to delete result');
    }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkFile) {
      setError('Select an Excel file for upload');
      return;
    }

    setBulkUploading(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', bulkFile);

      const payload = await apiFetch('/api/exam/results/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      const errorSnippet = Array.isArray(payload?.errors) && payload.errors.length
        ? ` (${payload.errors.length} row issues)`
        : '';
      setSuccess(`Bulk upload complete: ${payload?.count || 0} result(s) uploaded${errorSnippet}.`);
      if (Array.isArray(payload?.errors) && payload.errors.length) {
        setError(payload.errors.slice(0, 5).join(' | '));
      }
      setShowBulkUpload(false);
      setBulkExamId('');
      setBulkFile(null);
      await loadResults();
    } catch (err) {
      setError(err.message || 'Failed to upload result file');
    } finally {
      setBulkUploading(false);
    }
  };

  const downloadExcelTemplate = async () => {
    if (!bulkExamId) {
      setError('Select an exam to generate template');
      return;
    }

    setError('');
    setSuccess('');
    try {
      const students = await ensureExamStudents(bulkExamId);
      const targetExam = scopedExams.find((item) => String(item._id) === String(bulkExamId));
      if (!targetExam) {
        throw new Error('Selected exam not found in your allocation');
      }

      if (!students.length) {
        throw new Error('No eligible students found for selected exam');
      }

      const maxMarks = Number(targetExam?.marks);
      const sheetData = students.map((student) => ({
        studentId: student._id,
        roll: student.roll || '',
        class: student.grade || '',
        section: student.section || '',
        name: student.name || '',
        examId: targetExam._id,
        subject: targetExam.subject || targetExam?.subjectId?.name || '',
        marks: '',
        grade: '',
        remarks: '',
        status: 'pass',
      }));

      const worksheet = XLSX.utils.json_to_sheet(sheetData, {
        header: ['studentId', 'roll', 'class', 'section', 'name', 'examId', 'subject', 'marks', 'grade', 'remarks', 'status'],
      });

      const helperRow = ['(Do not change)', '', '', '', '', '(Do not change)', '(Do not change)', maxMarks ? `0-${maxMarks}` : 'numeric', 'optional', 'optional', 'pass/fail/absent'];
      XLSX.utils.sheet_add_aoa(worksheet, [helperRow], { origin: 'A2' });
      XLSX.utils.sheet_add_json(worksheet, sheetData, {
        header: ['studentId', 'roll', 'class', 'section', 'name', 'examId', 'subject', 'marks', 'grade', 'remarks', 'status'],
        origin: 'A3',
        skipHeader: true,
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, worksheet, 'ResultsUpload');
      XLSX.writeFile(wb, `results_upload_template_${bulkExamId}.xlsx`);
      setSuccess('Template downloaded successfully');
    } catch (err) {
      setError(err.message || 'Unable to generate template');
    }
  };

  const summary = useMemo(() => {
    const total = visibleResults.length;
    const published = visibleResults.filter((item) => Boolean(item.published)).length;
    const pass = visibleResults.filter((item) => String(item.status || '').toLowerCase() === 'pass').length;
    const fail = visibleResults.filter((item) => String(item.status || '').toLowerCase() === 'fail').length;
    return { total, published, pass, fail };
  }, [visibleResults]);

  const inputClass =
    'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20';

  const selectedBulkExam = scopedExams.find((exam) => String(exam._id) === String(bulkEntryForm.examId));

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-5 shadow-lg text-white">
        <div className="absolute top-0 right-0 w-56 h-56 bg-indigo-400/10 rounded-full -translate-y-1/3 translate-x-1/4 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-44 h-44 bg-cyan-500/10 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl" />
        <div className="relative">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Result Management</h1>
          <p className="mt-1 text-sm text-slate-300">Create, update, publish, and maintain student results</p>
          <p className="mt-1 text-xs text-slate-400">
            Teachers can upload marks only for allocated subject, class, and section exams.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Results</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs text-emerald-700">Published</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{summary.published}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs text-blue-700">Pass</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{summary.pass}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 shadow-sm">
          <p className="text-xs text-red-700">Fail</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{summary.fail}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className={`${inputClass} max-w-[280px]`}
          >
            <option value="">All Exams</option>
            {completedScopedExams.map((exam) => (
              <option key={exam._id} value={exam._id}>
                {exam.title} {exam.subject ? `(${exam.subject})` : ''}
              </option>
            ))}
          </select>

          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setSelectedSection('');
            }}
            disabled={Boolean(selectedExamId)}
            className={`${inputClass} max-w-[180px] disabled:bg-gray-100 disabled:text-gray-500`}
          >
            <option value="">All Classes</option>
            {classOptions.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>

          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            disabled={Boolean(selectedExamId)}
            className={`${inputClass} max-w-[180px] disabled:bg-gray-100 disabled:text-gray-500`}
          >
            <option value="">All Sections</option>
            {sectionOptions.map((section) => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
          </select>

          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student, exam, subject"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={14} />
            Add Result
          </button>
          <button
            type="button"
            onClick={() => {
              setShowBulkUpload(true);
              setBulkExamId(selectedExamId || '');
              setBulkFile(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
          >
            <FileUp size={14} />
            Upload Results
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
          >
            <FileDown size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {selectedExam && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-800">
          {selectedExam.title || 'Exam'}: {selectedExam?.classId?.name || selectedExam?.grade || '-'}
          {' - '}
          {selectedExam?.sectionId?.name || selectedExam?.section || '-'}
          {' - '}
          {selectedExam?.subject || selectedExam?.subjectId?.name || '-'}
          {Number.isFinite(Number(selectedExam?.marks)) ? ` (Max: ${Number(selectedExam.marks)})` : ''}
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}

      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading result management data...</div>
        ) : visibleResults.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No results found for selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Exam</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Marks</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Grade</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                  {selectedExamId && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Rank</th>}
                  {selectedExamId && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Δ vs Prev</th>}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleResults.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{item?.studentId?.name || 'Student'}</div>
                      <div className="text-xs text-gray-500">
                        {item?.studentId?.grade || '-'} {item?.studentId?.section || ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{item?.examId?.title || 'Exam'}</div>
                      <div className="text-xs text-gray-500">{item?.examId?.subject || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {item?.marks ?? '-'}
                      {item?.percentile != null && (
                        <div className="text-xs text-indigo-500">{item.percentile}th %ile</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-800">{item?.grade || '-'}</td>
                    <td className="px-4 py-3 text-gray-800 capitalize">{item?.status || '-'}</td>
                    {selectedExamId && (
                      <td className="px-4 py-3 text-gray-800 font-medium">
                        {item?.rank != null ? `#${item.rank}` : '—'}
                        {item?.total != null && <span className="text-xs text-gray-400"> /{item.total}</span>}
                      </td>
                    )}
                    {selectedExamId && (
                      <td className="px-4 py-3">
                        {item?.delta == null ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : item.delta > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <TrendingUp size={12} />+{item.delta}%
                          </span>
                        ) : item.delta < 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500">
                            <TrendingDown size={12} />{item.delta}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">0%</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 size={14} />
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

      {showForm && (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/40 p-3 sm:p-4">
          <div className="mx-auto flex min-h-full w-full max-w-4xl items-center justify-center">
          <div className="w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 sm:px-8 py-4 sm:py-5 shrink-0">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                  <Plus size={22} />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                    {editingResultId ? 'Edit Result' : 'Add Result'}
                  </h2>
                  <p className="text-base text-slate-400">Record a student's exam result</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-8 space-y-5">
              {!editingResultId && (
                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
                  <button
                    type="button"
                    onClick={() => setAddResultMode('single')}
                    className={`px-5 py-2 rounded-xl text-xl font-semibold transition ${addResultMode === 'single' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}
                  >
                    Single Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddResultMode('bulk')}
                    className={`px-5 py-2 rounded-xl text-xl font-semibold transition ${addResultMode === 'bulk' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}
                  >
                    Bulk Entry
                  </button>
                </div>
              )}

              {editingResultId || addResultMode === 'single' ? (
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Exam</label>
                    <select
                      value={form.examId}
                      onChange={(e) => setForm((prev) => ({ ...prev, examId: e.target.value, studentId: '' }))}
                      className={inputClass}
                      required
                    >
                      <option value="">Select exam</option>
                      {completedScopedExams.map((exam) => (
                        <option key={exam._id} value={exam._id}>
                          {exam.title} {exam.subject ? `(${exam.subject})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formExam && (
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                      Scope: {formExam?.classId?.name || formExam?.grade || '-'} - {formExam?.sectionId?.name || formExam?.section || '-'} - {formExam?.subject || formExam?.subjectId?.name || '-'}
                      {Number.isFinite(Number(formExam?.marks)) ? ` | Max Marks: ${Number(formExam.marks)}` : ''}
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Student</label>
                    <select
                      value={form.studentId}
                      onChange={(e) => setForm((prev) => ({ ...prev, studentId: e.target.value }))}
                      className={inputClass}
                      required
                      disabled={!form.examId || loadingExamStudents}
                    >
                      <option value="">{loadingExamStudents ? 'Loading students...' : 'Select student'}</option>
                      {formStudents.map((student) => (
                        <option key={student._id} value={student._id}>
                          {formatStudentDisplay(student)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Marks</label>
                      <input
                        type="number"
                        min="0"
                        max={Number.isFinite(Number(formExam?.marks)) ? Number(formExam?.marks) : undefined}
                        value={form.marks}
                        onChange={(e) => setForm((prev) => ({ ...prev, marks: e.target.value }))}
                        className={inputClass}
                        disabled={form.status === 'absent'}
                        required={form.status !== 'absent'}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Grade</label>
                      <input
                        value={form.grade}
                        onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}
                        className={inputClass}
                        placeholder="A+ / B / C"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => {
                          const nextStatus = e.target.value;
                          setForm((prev) => ({ ...prev, status: nextStatus, marks: nextStatus === 'absent' ? '' : prev.marks }));
                        }}
                        className={inputClass}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Remarks</label>
                    <textarea
                      rows={3}
                      value={form.remarks}
                      onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                      className={inputClass}
                      placeholder="Optional teacher feedback"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeForm}
                      className="rounded-2xl border border-gray-200 px-5 py-2.5 text-base text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      <Save size={16} />
                      {saving ? 'Saving...' : editingResultId ? 'Update Result' : 'Add Result'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleBulkMarksUpload} className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-500 uppercase tracking-wide">Active Session</label>
                      <input
                        value={bulkEntryForm.session || activeSession || 'Not set'}
                        readOnly
                        className={`${inputClass} bg-slate-100 text-slate-700`}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-500 uppercase tracking-wide">Class</label>
                      <select
                        value={bulkEntryForm.className}
                        onChange={(e) => setBulkEntryForm((prev) => ({ ...prev, className: e.target.value, sectionName: '', examId: '' }))}
                        className={inputClass}
                      >
                        <option value="">Select class</option>
                        {bulkClassOptions.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-500 uppercase tracking-wide">Section</label>
                      <select
                        value={bulkEntryForm.sectionName}
                        onChange={(e) => setBulkEntryForm((prev) => ({ ...prev, sectionName: e.target.value, examId: '' }))}
                        className={inputClass}
                        disabled={!bulkEntryForm.className}
                      >
                        <option value="">Select section</option>
                        {bulkSectionOptions.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-500 uppercase tracking-wide">Exam Subject</label>
                      <select
                        value={bulkEntryForm.examId}
                        onChange={(e) => setBulkEntryForm((prev) => ({ ...prev, examId: e.target.value }))}
                        className={inputClass}
                        disabled={!bulkEntryForm.sectionName}
                      >
                        <option value="">Select exam</option>
                        {bulkExamOptions.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.subject || item?.subjectId?.name || item.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-500 uppercase tracking-wide bg-slate-50">
                      Students
                    </div>
                    {bulkEntryLoading ? (
                      <div className="px-5 py-12 text-center text-base text-slate-500">Loading students...</div>
                    ) : bulkEntryRows.length === 0 ? (
                      <div className="px-5 py-12 text-center text-2xl text-slate-400">
                        Select class, section, and exam to load students for the active session.
                      </div>
                    ) : (
                      <div className="max-h-[320px] overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Student</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Marks</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Grade</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {bulkEntryRows.map((row) => (
                              <tr key={row.studentId}>
                                <td className="px-4 py-2">
                                  <div className="font-medium text-slate-800">{row.name}</div>
                                  <div className="text-xs text-slate-500">Roll {row.roll || '—'}</div>
                                </td>
                                <td className="px-4 py-2 w-40">
                                  <input
                                    type="number"
                                    min="0"
                                    max={Number.isFinite(Number(selectedBulkExam?.marks)) ? Number(selectedBulkExam?.marks) : undefined}
                                    value={row.marks}
                                    onChange={(e) => handleBulkRowMarksChange(row.studentId, e.target.value)}
                                    disabled={row.status === 'absent'}
                                    className={inputClass}
                                  />
                                </td>
                                <td className="px-4 py-2 w-28">
                                  <input
                                    value={row.grade}
                                    onChange={(e) => setBulkEntryRows((prev) => prev.map((item) => item.studentId === row.studentId ? { ...item, grade: e.target.value } : item))}
                                    className={inputClass}
                                  />
                                </td>
                                <td className="px-4 py-2 w-36">
                                  <select
                                    value={row.status}
                                    onChange={(e) => setBulkEntryRows((prev) => prev.map((item) => item.studentId === row.studentId ? { ...item, status: e.target.value } : item))}
                                    className={inputClass}
                                  >
                                    {STATUS_OPTIONS.map((status) => (
                                      <option key={status} value={status}>{status}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-2 min-w-[220px]">
                                  <input
                                    value={row.remarks}
                                    onChange={(e) => setBulkEntryRows((prev) => prev.map((item) => item.studentId === row.studentId ? { ...item, remarks: e.target.value } : item))}
                                    className={inputClass}
                                    placeholder="Optional"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeForm}
                      className="rounded-2xl border border-gray-200 px-5 py-2.5 text-base text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={bulkEntrySubmitting || bulkEntryLoading || !bulkEntryRows.length}
                      className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-6 py-2.5 text-base font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                    >
                      {bulkEntrySubmitting ? 'Uploading...' : 'Upload All Marks'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      {showBulkUpload && (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/40 p-3 sm:p-4">
          <div className="mx-auto flex min-h-full w-full max-w-lg items-center justify-center">
          <div className="w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] rounded-2xl bg-white shadow-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Bulk Upload Results</h2>
              <button
                type="button"
                onClick={() => {
                  if (bulkUploading) return;
                  setShowBulkUpload(false);
                  setBulkExamId('');
                  setBulkFile(null);
                }}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleBulkUpload} className="space-y-4 p-4 overflow-y-auto" encType="multipart/form-data">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Select Exam (For Template)</label>
                <select
                  value={bulkExamId}
                  onChange={(e) => setBulkExamId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Choose exam</option>
                  {scopedExams
                    .filter((exam) => String(exam?.status || '').trim().toLowerCase() === 'completed')
                    .map((exam) => (
                      <option key={exam._id} value={exam._id}>
                        {exam.title} - {exam.subject || exam?.subjectId?.name || '-'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-5 text-center">
                <FileUp size={22} className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm font-medium text-gray-700">Upload filled Excel file</p>
                <p className="mt-1 text-xs text-gray-500">
                  Required columns: studentId, examId, marks, status
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                  className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  required
                />
                {bulkFile && <p className="mt-2 text-xs font-medium text-emerald-600">Selected: {bulkFile.name}</p>}
              </div>

              <button
                type="button"
                onClick={downloadExcelTemplate}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <FileDown size={14} />
                Download Excel Template
              </button>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (bulkUploading) return;
                    setShowBulkUpload(false);
                    setBulkExamId('');
                    setBulkFile(null);
                  }}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkUploading}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  <FileUp size={14} />
                  {bulkUploading ? 'Uploading...' : 'Upload Results'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultManagement;
