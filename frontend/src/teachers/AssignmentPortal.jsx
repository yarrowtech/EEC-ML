import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Calendar, Search, Plus, Clock, AlertCircle, X,
  Edit3, Trash2, Eye, Users, CheckCircle, XCircle,
  Filter, BookOpen, MoreVertical, Share2,
  ChevronDown, TrendingUp, Award, AlertTriangle, Upload, Loader,
  User, Star, ExternalLink, RefreshCcw, BarChart2, Sparkles,
  Target, ListChecks, Activity, Layers, GraduationCap
} from 'lucide-react';
import axios from 'axios';
import { motion as Motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const AssignmentPortal = () => {
  // Tab state
  const [activeTab] = useState('evaluate');

  // ─────────────────────────────────────────────────────────────────────────
  // ASSIGNMENT MANAGEMENT STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailEditMode, setDetailEditMode] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailDraft, setDetailDraft] = useState({
    title: '',
    subject: '',
    topic: '',
    description: '',
    classId: '',
    sectionId: '',
    dueDate: '',
    marks: 100,
    status: 'draft',
    submissionFormat: 'text',
    type: 'Assignment',
    difficulty: 'Medium'
  });
  const [viewMode, setViewMode] = useState('grid');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterTopic, setFilterTopic] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [myClasses, setMyClasses] = useState([]);
  const [newAssignment, setNewAssignment] = useState({
    title: "",
    subject: "",
    topic: "",
    academicYearId: "",
    sessionName: "",
    classId: "",
    sectionId: "",
    description: "",
    dueDate: "",
    marks: 100,
    status: "draft",
    submissionFormat: "text",
    attachments: []
  });
  const [, setPdfFile] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [showCreateSuccessModal, setShowCreateSuccessModal] = useState(false);
  const [createSuccessMessage, setCreateSuccessMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteAssignment, setPendingDeleteAssignment] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [filteredAssignments, setFilteredAssignments] = useState([]);
  const [activeSessionName, setActiveSessionName] = useState('');
  const [activeSessionId, setActiveSessionId] = useState('');

  // ─────────────────────────────────────────────────────────────────────────
  // ASSIGNMENT EVALUATION STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [submissions, setSubmissions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [selected, setSelected] = useState(null);
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [evaluationMode, setEvaluationMode] = useState('single');
  const [bulkDraft, setBulkDraft] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTED VALUES
  // ─────────────────────────────────────────────────────────────────────────
  const globalSubjectOptions = useMemo(() => {
    const map = new Map();
    myClasses.forEach((cs) => {
      (cs.subjects || []).forEach((subject) => {
        if (!subject?.name) return;
        const key = String(subject.id || subject._id || subject.name);
        if (!map.has(key)) {
          map.set(key, { id: key, name: subject.name });
        }
      });
    });
    return Array.from(map.values());
  }, [myClasses]);

  const sessionOptions = useMemo(() => {
    if (activeSessionId && activeSessionName) {
      return [{ id: activeSessionId, name: activeSessionName }];
    }
    const map = new Map();
    myClasses.forEach((cs) => {
      const id = String(cs?.academicYearId || '').trim();
      const name = String(cs?.sessionName || '').trim();
      if (!id || !name) return;
      if (!map.has(id)) {
        map.set(id, { id, name });
      }
    });
    return Array.from(map.values());
  }, [myClasses, activeSessionId, activeSessionName]);

  const classSectionOptions = useMemo(() => {
    const selectedYearId = String(newAssignment.academicYearId || '').trim();
    if (!selectedYearId) return [];
    return myClasses.filter((cs) => String(cs?.academicYearId || '').trim() === selectedYearId);
  }, [myClasses, newAssignment.academicYearId]);

  const subjectOptions = useMemo(() => {
    if (newAssignment.classId && newAssignment.sectionId && newAssignment.academicYearId) {
      const matched = classSectionOptions.find(
        cs => cs.classId === newAssignment.classId && cs.sectionId === newAssignment.sectionId
      );
      if (matched?.subjects?.length) {
        const map = new Map();
        matched.subjects.forEach(sub => {
          if (!sub?.name) return;
          const key = String(sub.id || sub._id || sub.name);
          if (!map.has(key)) {
            map.set(key, { id: key, name: sub.name });
          }
        });
        const scoped = Array.from(map.values());
        if (scoped.length) return scoped;
      }
    }
    return [];
  }, [classSectionOptions, newAssignment.classId, newAssignment.sectionId, newAssignment.academicYearId]);

  const subjects = [...new Set(assignments.map(a => a.subject).filter(Boolean))];
  const topics = [...new Set(assignments.map(a => a.topic).filter(Boolean))];
  const totalAssignments = assignments.length;
  const activeAssignments = assignments.filter(a => a.status === 'active').length;
  const draftAssignments = assignments.filter(a => a.status === 'draft').length;

  const assignmentTitles = ['all', ...new Set(submissions.map(s => s.assignmentTitle))];
  const classOptions = ['all', ...new Set(submissions.map(s => s.grade).filter(Boolean))];
  const pendingCount = submissions.filter(s => s.score === null || s.score === undefined).length;
  const gradedCount = submissions.filter(s => s.score !== null && s.score !== undefined).length;

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH DATA
  // ─────────────────────────────────────────────────────────────────────────
  const token = () => localStorage.getItem('token');

  const fetchMyClasses = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/assignment/teacher/my-classes`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const normalizedClasses = Array.isArray(response.data)
        ? response.data.map(item => ({
          ...item,
          academicYearId: String(item?.academicYearId || ''),
          sessionName: String(item?.sessionName || ''),
          subjects: Array.isArray(item.subjects) ? item.subjects.filter(sub => sub && sub.name) : []
        }))
        : [];
      setMyClasses(normalizedClasses);
      if (response.data.length === 0) {
        setError('No classes assigned. You need to be assigned to classes in the timetable first.');
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
      setError(err.response?.data?.error || 'Failed to load your classes');
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/assignment/teacher/my-assignments`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      setAssignments(response.data);
      setFilteredAssignments(response.data);
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveSession = async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/academic/active-year`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const yearId = String(data?._id || '');
      const yearName = String(data?.name || '').trim();
      setActiveSessionId(yearId);
      setActiveSessionName(yearName);
      if (yearId) {
        setNewAssignment((prev) => ({
          ...prev,
          academicYearId: yearId,
          sessionName: yearName
        }));
      }
    } catch (err) {
      console.error('Error fetching active session:', err);
      setActiveSessionId('');
      setActiveSessionName('');
      setError(err.response?.data?.error || 'No active academic session found');
    }
  };

  const fetchSubmissions = async () => {
    try {
      setLoadingSubmissions(true);
      const { data } = await axios.get(`${API_BASE_URL}/api/assignment/teacher/submissions`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      setSubmissions(data);
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    fetchActiveSession();
    fetchMyClasses();
    fetchAssignments();
    fetchSubmissions();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // FILTER ASSIGNMENTS
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let filtered = assignments;
    if (searchTerm) {
      filtered = filtered.filter(assignment =>
        String(assignment.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(assignment.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(assignment.topic || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(getAssignmentClassName(assignment)).toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(getAssignmentSectionName(assignment)).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter(assignment => assignment.status === filterStatus);
    }
    if (filterSubject !== 'all') {
      filtered = filtered.filter(assignment => assignment.subject === filterSubject);
    }
    if (filterTopic !== 'all') {
      filtered = filtered.filter(assignment => assignment.topic === filterTopic);
    }
    setFilteredAssignments(filtered);
  }, [assignments, searchTerm, filterStatus, filterSubject, filterTopic]);

  // ─────────────────────────────────────────────────────────────────────────
  // FILTER SUBMISSIONS
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let list = [...submissions];
    if (assignmentFilter !== 'all') {
      list = list.filter(s => s.assignmentTitle === assignmentFilter);
    }
    if (classFilter !== 'all') {
      list = list.filter(s => String(s.grade || '') === String(classFilter));
    }
    setFiltered(list);
  }, [submissions, assignmentFilter, classFilter]);

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'draft': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-600';
      case 'Medium': return 'text-yellow-600';
      case 'Hard': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getSubmissionPercentage = (submissions, totalStudents) => {
    return totalStudents > 0 ? Math.round((submissions / totalStudents) * 100) : 0;
  };

  const getDaysUntilDue = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleDateString();
  };

  const toDateInputValue = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  };

  const resolveIdValue = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return String(value._id || value.id || '');
    return '';
  };

  const getAssignmentClassName = (assignment) =>
    assignment?.classId?.name || assignment?.className || assignment?.class || '';

  const getAssignmentSectionName = (assignment) =>
    assignment?.sectionId?.name || assignment?.sectionName || assignment?.section || '';


  // ─────────────────────────────────────────────────────────────────────────
  // ASSIGNMENT MANAGEMENT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  const openAssignmentDetail = (assignment) => {
    setSelectedAssignment(assignment);
    setDetailDraft({
      title: assignment?.title || '',
      subject: assignment?.subject || '',
      topic: assignment?.topic || '',
      description: assignment?.description || '',
      classId: resolveIdValue(assignment?.classId),
      sectionId: resolveIdValue(assignment?.sectionId),
      dueDate: toDateInputValue(assignment?.dueDate),
      marks: assignment?.marks ?? 100,
      status: assignment?.status || 'draft',
      submissionFormat: assignment?.submissionFormat === 'pdf' ? 'pdf' : 'text',
      type: assignment?.type || 'Assignment',
      difficulty: assignment?.difficulty || 'Medium'
    });
    setDetailEditMode(false);
    setShowDetailModal(true);
  };

  const handleDetailDraftChange = (key, value) => {
    setDetailDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleUpdateAssignment = async () => {
    if (!selectedAssignment?._id) return;
    try {
      setDetailSaving(true);
      const payload = {
        title: detailDraft.title,
        subject: detailDraft.subject,
        topic: detailDraft.topic,
        description: detailDraft.description,
        classId: detailDraft.classId,
        sectionId: detailDraft.sectionId,
        dueDate: detailDraft.dueDate,
        marks: Number(detailDraft.marks),
        status: detailDraft.status,
        submissionFormat: detailDraft.submissionFormat,
        type: detailDraft.type,
        difficulty: detailDraft.difficulty
      };
      const response = await axios.put(
        `${API_BASE_URL}/api/assignment/teacher/update/${selectedAssignment._id}`,
        payload,
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      const updated = response?.data?.assignment;
      if (!updated) throw new Error('Assignment updated but response was invalid');
      setAssignments((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      setSelectedAssignment(updated);
      setDetailEditMode(false);
    } catch (err) {
      console.error('Error updating assignment:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update assignment');
    } finally {
      setDetailSaving(false);
    }
  };

  const handleChange = (e) => {
    setNewAssignment({ ...newAssignment, [e.target.name]: e.target.value });
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('File size must be less than 20MB');
      return;
    }
    setPdfFile(file);
    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(
        `${API_BASE_URL}/api/uploads/cloudinary/single`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token()}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      if (response.data.files && response.data.files.length > 0) {
        const uploadedFile = response.data.files[0];
        setNewAssignment(prev => ({
          ...prev,
          attachments: [...prev.attachments, {
            name: uploadedFile.originalName,
            url: uploadedFile.secure_url,
            type: 'pdf'
          }]
        }));
      }
    } catch (err) {
      console.error('Error uploading PDF:', err);
      alert('Failed to upload PDF. Please try again.');
      setPdfFile(null);
    } finally {
      setUploadingPdf(false);
    }
  };

  const removePdfAttachment = (index) => {
    setNewAssignment(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!activeSessionId) {
      setError('No active academic session found. Please ask admin to activate a session first.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const payload = {
        ...newAssignment,
        academicYearId: activeSessionId,
        sessionName: activeSessionName
      };
      const response = await axios.post(
        `${API_BASE_URL}/api/assignment/teacher/create`,
        payload,
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      if (response.data) {
        await fetchAssignments();
        setShowModal(false);
        setNewAssignment({
          title: "",
          subject: "",
          topic: "",
          academicYearId: activeSessionId,
          sessionName: activeSessionName,
          classId: "",
          sectionId: "",
          description: "",
          dueDate: "",
          marks: 100,
          status: "draft",
          submissionFormat: "text",
          attachments: []
        });
        setPdfFile(null);
        setCreateSuccessMessage('Assignment created successfully.');
        setShowCreateSuccessModal(true);
      }
    } catch (err) {
      console.error('Error creating assignment:', err);
      setError(err.response?.data?.error || 'Failed to create assignment');
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (assignment) => {
    setPendingDeleteAssignment(assignment);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!pendingDeleteAssignment?._id) return;
    try {
      setLoading(true);
      await axios.delete(`${API_BASE_URL}/api/assignment/teacher/delete/${pendingDeleteAssignment._id}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      await fetchAssignments();
      setShowDeleteModal(false);
      setPendingDeleteAssignment(null);
    } catch (err) {
      console.error('Error deleting assignment:', err);
      setError(err.response?.data?.error || 'Failed to delete assignment');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // EVALUATION HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  const openSubmission = (sub) => {
    setSelected(sub);
    setMarks(sub.score !== null && sub.score !== undefined ? String(sub.score) : '');
    setFeedback(sub.feedback || '');
    setSaveError('');
  };

  const closePanel = () => {
    setSelected(null);
    setSaveError('');
  };

  const saveGrade = async () => {
    const numMarks = parseFloat(marks);
    if (isNaN(numMarks) || numMarks < 0) {
      setSaveError('Please enter a valid mark (≥ 0).');
      return;
    }
    if (numMarks > selected.totalMarks) {
      setSaveError(`Marks cannot exceed ${selected.totalMarks}.`);
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await axios.post(
        `${API_BASE_URL}/api/assignment/teacher/grade`,
        {
          studentId: selected.studentId,
          assignmentId: selected.assignmentId,
          score: numMarks,
          feedback
        },
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      setSubmissions(prev =>
        prev.map(s =>
          s.submissionId === selected.submissionId
            ? { ...s, score: numMarks, feedback, status: 'graded' }
            : s
        )
      );
      setSelected(prev => ({ ...prev, score: numMarks, feedback, status: 'graded' }));
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateBulkDraft = (submissionId, key, value) => {
    setBulkDraft((prev) => ({
      ...prev,
      [submissionId]: {
        ...prev[submissionId],
        [key]: value
      }
    }));
    setBulkError('');
    setBulkSuccess('');
  };

  const saveBulkGrades = async () => {
    const payload = filtered
      .map((sub) => {
        const draft = bulkDraft[sub.submissionId] || {};
        const marksValue = draft.marks;
        if (marksValue === '' || marksValue === undefined || marksValue === null) return null;
        const score = Number(marksValue);
        if (!Number.isFinite(score) || score < 0 || score > Number(sub.totalMarks || 0)) {
          return { invalid: true, sub };
        }
        return {
          studentId: sub.studentId,
          assignmentId: sub.assignmentId,
          score,
          feedback: draft.feedback ?? sub.feedback ?? ''
        };
      })
      .filter(Boolean);

    if (payload.length === 0) {
      setBulkError('Enter marks for at least one student to upload in bulk.');
      return;
    }

    const invalidRow = payload.find((item) => item.invalid);
    if (invalidRow) {
      setBulkError(`Invalid marks for ${invalidRow.sub.studentName}. Please check and retry.`);
      return;
    }

    setBulkSaving(true);
    setBulkError('');
    setBulkSuccess('');
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/assignment/teacher/grade-bulk`,
        { grades: payload },
        { headers: { Authorization: `Bearer ${token()}` } }
      );

      const updateMap = new Map(
        payload.map((item) => [`${item.studentId}::${item.assignmentId}`, item])
      );
      setSubmissions((prev) =>
        prev.map((sub) => {
          const key = `${sub.studentId}::${sub.assignmentId}`;
          const updated = updateMap.get(key);
          if (!updated) return sub;
          return {
            ...sub,
            score: updated.score,
            feedback: updated.feedback,
            status: 'graded'
          };
        })
      );

      setBulkSuccess(
        `${data?.updatedCount ?? payload.length} submission(s) graded successfully.`
      );
    } catch (err) {
      setBulkError(err.response?.data?.error || 'Failed to upload bulk marks.');
    } finally {
      setBulkSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f4f7fc] p-3 sm:p-5">
      {/* Hero Header *
      <section className={`relative mx-auto max-w-[1480px] overflow-hidden rounded-[2.5rem] ${activeTab === 'evaluate' ? 'bg-transparent text-[#0b1a33]' : 'bg-gradient-to-br from-purple-700 via-indigo-600 to-indigo-500 text-white'}`}>
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.15) 0, transparent 55%)' }} />
        <div className="relative px-4 md:px-6 pt-8 pb-6">
          {activeTab !== 'evaluate' && (
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <GraduationCap className="size-7" />
              </div>
              <div>
                <h1 className="text-3xl font-bold md:text-4xl">Assignment Portal</h1>
                <p className="mt-1 text-sm text-white/80">Manage assignments and evaluate student submissions</p>
              </div>
            </div>
          )}

          
          <div className="flex gap-2 border-b border-white/20 pb-4">
            <button
              onClick={() => setActiveTab('manage')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl font-semibold text-sm transition-all ${activeTab === 'manage'
                  ? 'bg-white text-purple-700 shadow-lg'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
            >
              <Layers className="w-4 h-4" />
              Manage Assignments
            </button>
            <button
              onClick={() => setActiveTab('evaluate')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl font-semibold text-sm transition-all ${activeTab === 'evaluate'
                  ? 'bg-white text-purple-700 shadow-lg'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
            >
              <CheckCircle className="w-4 h-4" />
              Evaluate Submissions
            </button>
          </div>
        </div>
      </section> */}

      {/* Content Area */}
      <div className="p-4 md:p-6 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            <p className="text-xs text-red-600 font-medium flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 p-1">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'manage' ? (
          <ManageAssignments
            loading={loading}
            assignments={assignments}
            filteredAssignments={filteredAssignments}
            myClasses={myClasses}
            subjects={subjects}
            activeAssignments={activeAssignments}
            draftAssignments={draftAssignments}
            totalAssignments={totalAssignments}
            viewMode={viewMode}
            setViewMode={setViewMode}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterSubject={filterSubject}
            setFilterSubject={setFilterSubject}
            filterTopic={filterTopic}
            setFilterTopic={setFilterTopic}
            topics={topics}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            setShowModal={setShowModal}
            openAssignmentDetail={openAssignmentDetail}
            openDeleteModal={openDeleteModal}
            getStatusColor={getStatusColor}
            getAssignmentClassName={getAssignmentClassName}
            getAssignmentSectionName={getAssignmentSectionName}
            getDaysUntilDue={getDaysUntilDue}
          />
        ) : (
          <EvaluateSubmissions
            loadingSubmissions={loadingSubmissions}
            submissions={submissions}
            filtered={filtered}
            selected={selected}
            marks={marks}
            setMarks={setMarks}
            feedback={feedback}
            setFeedback={setFeedback}
            saving={saving}
            saveError={saveError}
            assignmentFilter={assignmentFilter}
            setAssignmentFilter={setAssignmentFilter}
            classFilter={classFilter}
            setClassFilter={setClassFilter}
            assignmentTitles={assignmentTitles}
            classOptions={classOptions}
            pendingCount={pendingCount}
            gradedCount={gradedCount}
            assignments={assignments}
            openSubmission={openSubmission}
            closePanel={closePanel}
            saveGrade={saveGrade}
            evaluationMode={evaluationMode}
            setEvaluationMode={setEvaluationMode}
            bulkDraft={bulkDraft}
            updateBulkDraft={updateBulkDraft}
            saveBulkGrades={saveBulkGrades}
            bulkSaving={bulkSaving}
            bulkError={bulkError}
            bulkSuccess={bulkSuccess}
            formatDate={formatDate}
          />
        )}
      </div>

      {/* Modals */}
      {showCreateSuccessModal && (
        <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border-[2.5px] border-purple-300 overflow-hidden">
            <div className="p-5">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Assignment Created</h3>
              <p className="text-sm text-gray-600">{createSuccessMessage}</p>
            </div>
            <div className="px-5 py-3 border-t border-purple-100 flex justify-end">
              <button
                onClick={() => setShowCreateSuccessModal(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-green-600 rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-[2.5px] border-purple-300 overflow-hidden">
            <div className="p-5">
              <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center mb-3">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Delete Assignment?</h3>
              <p className="text-sm text-gray-600">
                {`This will permanently delete "${pendingDeleteAssignment?.title || 'this assignment'}".`}
              </p>
            </div>
            <div className="px-5 py-3 border-t border-purple-100 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setPendingDeleteAssignment(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border-[2px] border-purple-200 rounded-xl hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-rose-600 rounded-xl shadow-sm hover:shadow-md disabled:opacity-60 transition-all"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <CreateAssignmentModal
          showModal={showModal}
          setShowModal={setShowModal}
          newAssignment={newAssignment}
          handleChange={handleChange}
          handleCreate={handleCreate}
          classSectionOptions={classSectionOptions}
          sessionOptions={sessionOptions}
          subjectOptions={subjectOptions}
          setNewAssignment={setNewAssignment}
          uploadingPdf={uploadingPdf}
          handlePdfUpload={handlePdfUpload}
          removePdfAttachment={removePdfAttachment}
          loading={loading}
          error={error}
          activeSessionId={activeSessionId}
        />
      )}

      {showDetailModal && selectedAssignment && (
        <AssignmentDetailModal
          selectedAssignment={selectedAssignment}
          showDetailModal={showDetailModal}
          setShowDetailModal={setShowDetailModal}
          detailEditMode={detailEditMode}
          setDetailEditMode={setDetailEditMode}
          detailDraft={detailDraft}
          handleDetailDraftChange={handleDetailDraftChange}
          handleUpdateAssignment={handleUpdateAssignment}
          detailSaving={detailSaving}
          openAssignmentDetail={openAssignmentDetail}
          myClasses={myClasses}
          globalSubjectOptions={globalSubjectOptions}
          getStatusColor={getStatusColor}
          getDifficultyColor={getDifficultyColor}
          formatDate={formatDate}
          getAssignmentClassName={getAssignmentClassName}
          getAssignmentSectionName={getAssignmentSectionName}
          getSubmissionPercentage={getSubmissionPercentage}
        />
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════

const ManageAssignments = ({
  loading, filteredAssignments, myClasses, subjects,
  activeAssignments, draftAssignments, totalAssignments,
  viewMode, setViewMode, filterStatus, setFilterStatus,
  filterSubject, setFilterSubject, filterTopic, setFilterTopic, topics,
  searchTerm, setSearchTerm,
  setShowModal, openAssignmentDetail, openDeleteModal,
  getStatusColor, getAssignmentClassName, getAssignmentSectionName, getDaysUntilDue
}) => (
  <div className="space-y-4 sm:space-y-5">
    {/* Stats Grid */}
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {[
        { label: 'Active', value: activeAssignments, icon: CheckCircle, gradient: 'from-emerald-500 to-green-500' },
        { label: 'Drafts', value: draftAssignments, icon: Edit3, gradient: 'from-amber-500 to-orange-500' },
        { label: 'My Classes', value: myClasses.length, icon: Users, gradient: 'from-blue-500 to-indigo-500' },
      ].map((stat) => (
        <div key={stat.label} className="bg-white rounded-2xl p-4 border-[2.5px] border-purple-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
              <stat.icon size={18} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Controls */}
    <div className="bg-white rounded-2xl p-3 sm:p-4 border-[2.5px] border-purple-300 space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search assignments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
        >
          <option value="all">All Subjects</option>
          {subjects.map(subject => (
            <option key={subject} value={subject}>{subject}</option>
          ))}
        </select>
        <select
          value={filterTopic}
          onChange={(e) => setFilterTopic(e.target.value)}
          className="px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
        >
          <option value="all">All Topics</option>
          {topics.map(topic => (
            <option key={topic} value={topic}>{topic}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
            >
              <div className="w-3.5 h-3.5 grid grid-cols-2 gap-0.5">
                <div className="bg-current rounded-sm" />
                <div className="bg-current rounded-sm" />
                <div className="bg-current rounded-sm" />
                <div className="bg-current rounded-sm" />
              </div>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}
            >
              <div className="w-3.5 h-3.5 flex flex-col justify-center gap-[3px]">
                <div className="bg-current h-[2px] rounded" />
                <div className="bg-current h-[2px] rounded" />
                <div className="bg-current h-[2px] rounded" />
              </div>
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-lg transition-all"
          >
            <Plus size={14} />
            Create
          </button>
        </div>
      </div>
    </div>

    {/* Assignment List */}
    {loading ? (
      <div className="bg-white rounded-2xl border-[2.5px] border-purple-300 p-12 text-center shadow-sm">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 mb-4">
          <Clock className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Loading assignments...</h3>
        <p className="text-sm text-gray-500">Fetching your assignment data</p>
      </div>
    ) : filteredAssignments.length === 0 ? (
      <div className="bg-white rounded-2xl border-[2.5px] border-purple-300 p-12 text-center shadow-sm">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 mb-4">
          <FileText className="w-6 h-6 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">No assignments found</h3>
        <p className="text-sm text-gray-500 mb-4">Try adjusting your filters or create a new assignment</p>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-lg transition-all"
        >
          <Plus size={14} />
          Create First Assignment
        </button>
      </div>
    ) : (
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-gray-500">
            Showing {filteredAssignments.length} of {totalAssignments} assignments
          </p>
        </div>
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
          {filteredAssignments.map((assignment) => {
            const submissionFormat = assignment?.submissionFormat === 'pdf' ? 'pdf' : 'text';
            const statusBorder = assignment.status === 'active' ? 'border-l-emerald-500' : assignment.status === 'draft' ? 'border-l-amber-500' : assignment.status === 'completed' ? 'border-l-blue-500' : 'border-l-red-500';
            return (
              <div
                key={assignment._id}
                onClick={() => openAssignmentDetail(assignment)}
                className={`bg-white rounded-2xl border-[2.5px] border-purple-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border-l-4 ${statusBorder} ${viewMode === 'grid' ? 'p-5' : 'p-4'} cursor-pointer`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug flex-1 mr-3">
                    {assignment.title}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAssignmentDetail(assignment);
                      }}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteModal(assignment);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${getStatusColor(assignment.status)}`}>
                    {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-700 border-[2px] border-purple-200">
                    {assignment.subject}
                  </span>
                  {assignment.topic && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 border-[2px] border-indigo-200">
                      {assignment.topic}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-100 text-purple-700 border-[2px] border-purple-200">
                    {`Class ${getAssignmentClassName(assignment) || 'N/A'}${getAssignmentSectionName(assignment) ? ` - ${getAssignmentSectionName(assignment)}` : ''}`}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${submissionFormat === 'pdf' ? 'border-purple-100 bg-purple-50 text-purple-600' : 'border-emerald-100 bg-emerald-50 text-emerald-600'}`}>
                    {submissionFormat === 'pdf' ? 'PDF' : 'Text'}
                  </span>
                </div>

                <p className="text-gray-500 text-xs mb-3 line-clamp-2 leading-relaxed">
                  {assignment.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-gray-400" />
                    <span>Due {new Date(assignment.dueDate).toLocaleDateString()}</span>
                    {getDaysUntilDue(assignment.dueDate) <= 3 && getDaysUntilDue(assignment.dueDate) > 0 && (
                      <AlertTriangle size={12} className="text-orange-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Award size={12} className="text-gray-400" />
                    <span>{assignment.marks} marks</span>
                  </div>
                  {assignment.attachments && assignment.attachments.length > 0 && (
                    <div className="flex items-center gap-1">
                      <FileText size={12} className="text-gray-400" />
                      <span>{assignment.attachments.length} files</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>
);

const EvaluateSubmissions = ({
  loadingSubmissions, submissions, filtered, selected,
  marks, setMarks, feedback, setFeedback, saving, saveError,
  assignmentFilter, setAssignmentFilter,
  classFilter, setClassFilter, assignmentTitles, classOptions,
  pendingCount, gradedCount, openSubmission,
  closePanel, saveGrade, evaluationMode, setEvaluationMode,
  bulkDraft, updateBulkDraft, saveBulkGrades, bulkSaving, bulkError, bulkSuccess,
  formatDate,
  assignments = []
}) => {
  const latestSubmissionDate = submissions.length
    ? submissions
      .map((s) => new Date(s.submittedAt || s.createdAt || 0).getTime())
      .reduce((max, current) => Math.max(max, current), 0)
    : null;
  const highlightedSubmission =
    filtered.find((s) => s.score === null || s.score === undefined) || filtered[0] || null;
  const [typeFilter, setTypeFilter] = useState('all');
  const normalizeType = (submission) => String(submission?.type || submission?.assignmentType || 'Assignment').toLowerCase();
  const typeDefinitions = [
    { key: 'all', label: 'All Types', icon: Layers },
    { key: 'assignment', label: 'Assignments', icon: FileText },
    { key: 'worksheet', label: 'Worksheets', icon: FileText },
    { key: 'mcq', label: 'MCQs', icon: ListChecks },
    { key: 'fill', label: 'Fill in the Blanks', icon: Edit3 },
    { key: 'writing', label: 'Writing', icon: Edit3 },
  ];
  const visibleSubmissions = typeFilter === 'all'
    ? filtered
    : filtered.filter((submission) => normalizeType(submission).includes(typeFilter));
  const aiReviewedCount = submissions.filter((submission) => submission.aiReviewed || submission.status === 'ai-reviewed').length;
  const aiEvaluatedCount = submissions.filter((submission) => submission.aiEvaluated || submission.aiReviewed).length;
  const studentCount = new Set(submissions.map((submission) => submission.studentId || submission.studentName).filter(Boolean)).size;
  const dueThisWeek = assignments.filter((assignment) => {
    if (!assignment?.dueDate) return false;
    const days = (new Date(assignment.dueDate).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 7;
  }).length;
  const evaluationSubmission = selected || highlightedSubmission;
  const evaluationScore = evaluationSubmission?.score ?? 78;
  const renderStatus = (submission) => {
    const isGraded = submission.score !== null && submission.score !== undefined;
    const status = isGraded ? 'graded' : submission.status === 'late' ? 'pending' : (submission.status || 'submitted');
    const label = submission.aiReviewed ? 'AI Reviewed' : isGraded ? 'Graded' : status === 'pending' ? 'Pending' : 'Submitted';
    const classes = submission.aiReviewed
      ? 'bg-sky-100 text-sky-700'
      : isGraded
        ? 'bg-emerald-100 text-emerald-700'
        : status === 'pending'
          ? 'bg-yellow-100 text-yellow-700'
          : 'bg-blue-100 text-blue-700';
    return <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${classes}`}>{label}</span>;
  };

  return (
    <Motion.div
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-[1480px] rounded-[2.5rem] border border-white/60 bg-white/70 p-5 text-[#0b1a33] shadow-[0_20px_48px_-12px_rgba(0,20,40,0.08)] backdrop-blur-md sm:p-8"
    >
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Motion.h1 initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.02em] sm:text-[1.9rem]">
            <Sparkles className="size-7 text-blue-600" /> Evaluate The Assignemnts With AI 
          </Motion.h1>
          <p className="mt-1 text-sm text-[#4b5b73]">Multi-type assignments · detailed AI feedback for every format</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e4eaf2] bg-white px-4 py-2 text-xs font-medium shadow-sm"><GraduationCap className="size-3.5 text-blue-600" /> Class {classOptions.find((item) => item !== 'all') || '5-A'}</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e4eaf2] bg-white px-4 py-2 text-xs font-medium shadow-sm"><Users className="size-3.5 text-blue-600" /> {studentCount || submissions.length} students</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-xs font-semibold text-green-700"><Sparkles className="size-3.5" /> AI Ready</span>
        </div>
      </header>

      <div className="mb-7 flex flex-wrap items-center gap-4 rounded-full border border-[#e2eaf2] bg-white px-5 py-2.5 shadow-sm">
        <label className="flex items-center gap-2 text-xs font-medium text-[#2c3f5c]"><Layers className="size-3.5 opacity-60" /> Class
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="rounded-full border border-[#dce3ec] bg-[#f9fcff] px-3 py-1.5 text-xs font-medium outline-none focus:border-blue-500">
            {classOptions.map((option) => <option key={option} value={option}>{option === 'all' ? 'All classes' : `Class ${option}`}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-[#2c3f5c]"><BookOpen className="size-3.5 opacity-60" /> Subject
          <select value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)} className="max-w-[220px] rounded-full border border-[#dce3ec] bg-[#f9fcff] px-3 py-1.5 text-xs font-medium outline-none focus:border-blue-500">
            {assignmentTitles.map((option) => <option key={option} value={option}>{option === 'all' ? 'All assignments' : option}</option>)}
          </select>
        </label>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#eef4ff] px-4 py-1.5 text-xs font-medium text-blue-600"><FileText className="size-3.5" /> {visibleSubmissions.length} submissions</span>
        <div className="inline-flex rounded-full border border-[#e2eaf2] bg-[#f8fbff] p-1">
          <button type="button" onClick={() => setEvaluationMode('single')} className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${evaluationMode === 'single' ? 'bg-white text-blue-600 shadow-sm' : 'text-[#6b7f9b]'}`}>Single Entry</button>
          <button type="button" onClick={() => setEvaluationMode('bulk')} className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${evaluationMode === 'bulk' ? 'bg-white text-blue-600 shadow-sm' : 'text-[#6b7f9b]'}`}>Bulk Entry</button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {[
          { label: 'Pending', value: pendingCount, icon: Clock, color: 'text-blue-600' },
          { label: 'Graded', value: gradedCount, icon: CheckCircle, color: 'text-blue-600' },
          { label: 'AI Reviewed', value: aiReviewedCount, icon: Target, color: 'text-blue-600' },
          { label: 'AI Evaluated', value: aiEvaluatedCount, icon: Sparkles, color: 'text-green-500' },
          { label: 'Due This Week', value: dueThisWeek, icon: Calendar, color: 'text-blue-600' },
        ].map((stat, index) => (
          <Motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} className="flex items-center gap-3 rounded-full border border-[#e8eef6] bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <stat.icon className={`size-5 ${stat.color} opacity-75`} />
            <div><p className="text-xl font-bold leading-none">{stat.value}</p><p className="mt-1 text-[9px] uppercase tracking-[0.03em] text-[#5f738f]">{stat.label}</p></div>
          </Motion.div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {typeDefinitions.map((type) => {
          const Icon = type.icon;
          const count = type.key === 'all' ? pendingCount : submissions.filter((submission) => normalizeType(submission).includes(type.key) && (submission.score === null || submission.score === undefined)).length;
          return <button key={type.key} type="button" onClick={() => setTypeFilter(type.key)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition ${typeFilter === type.key ? 'border-blue-600 bg-[#eef4ff] text-blue-600' : 'border-[#e2eaf2] bg-white text-[#4b5b73] hover:bg-[#f8fbff]'}`}><Icon className="size-3.5" /> {type.label}<span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600"><Clock className="size-2.5" /> {count}</span></button>;
        })}
        <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600"><AlertCircle className="size-3.5" /> Total Pending <span className="rounded-full bg-red-600 px-2 py-0.5 text-white">{pendingCount}</span></span>
      </div>

      <Motion.section layout className="mb-7 overflow-x-auto rounded-[1.8rem] border border-[#eaf0f8] bg-white p-2 shadow-sm">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead><tr className="border-b border-[#eef3fa] text-left text-[10px] uppercase tracking-[0.02em] text-[#2c405c]"><th className="px-4 py-3">Student</th><th className="px-4 py-3">Assignment</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Action</th></tr></thead>
          <tbody>
            {loadingSubmissions ? <tr><td colSpan="6" className="px-4 py-12 text-center text-sm text-[#5f738f]"><Loader className="mx-auto mb-2 size-5 animate-spin text-blue-600" />Loading submissions...</td></tr> : visibleSubmissions.length === 0 ? <tr><td colSpan="6" className="px-4 py-12 text-center text-sm text-[#5f738f]"><FileText className="mx-auto mb-2 size-8 opacity-30" />No submissions match the current filters.</td></tr> : visibleSubmissions.map((submission, index) => {
              const type = normalizeType(submission);
              const typeClass = type.includes('worksheet') ? 'bg-amber-100 text-amber-800' : type.includes('mcq') ? 'bg-emerald-100 text-emerald-800' : type.includes('fill') ? 'bg-rose-100 text-rose-800' : type.includes('writing') ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800';
              return <Motion.tr key={submission.submissionId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.035 }} onClick={() => openSubmission(submission)} className="cursor-pointer border-b border-[#f0f5fd] transition hover:bg-[#f8fbff] last:border-0">
                <td className="px-4 py-3"><div className="flex items-center gap-2.5 font-semibold"><span className="flex size-7 items-center justify-center rounded-full bg-[#e4ecf7] text-[10px] text-[#1e3b5a]">{String(submission.studentName || 'S').split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>{submission.studentName || 'Student'}</div></td>
                <td className="px-4 py-3 font-medium text-[#1a304a]">{submission.assignmentTitle || 'Assignment'}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${typeClass}`}>{submission.type || submission.assignmentType || 'Assignment'}</span></td>
                <td className="px-4 py-3">{renderStatus(submission)}</td>
                <td className="px-4 py-3"><span className="rounded-full border border-[#e2eaf2] bg-[#f8fafc] px-3 py-1 text-xs font-semibold">{submission.score !== null && submission.score !== undefined ? `${submission.score}/${submission.totalMarks}` : '—'}</span></td>
                <td className="px-4 py-3"><div className="flex gap-1.5"><button type="button" onClick={(event) => { event.stopPropagation(); openSubmission(submission); }} className="inline-flex items-center gap-1 rounded-full bg-[#f0f6ff] px-3 py-1.5 text-[10px] font-medium text-blue-600"><Edit3 className="size-3" /> {submission.score !== null && submission.score !== undefined ? 'Review' : 'Evaluate'}</button><button type="button" onClick={(event) => { event.stopPropagation(); openSubmission(submission); }} className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-[10px] font-medium text-green-600"><Sparkles className="size-3" /> AI</button></div></td>
              </Motion.tr>;
            })}
          </tbody>
        </table>
      </Motion.section>

      {evaluationMode === 'bulk' ? (
        <Motion.section layout className="mb-7 rounded-[1.8rem] border border-[#e2eaf2] bg-[#f9fcff] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Bulk evaluation</p><h2 className="text-lg font-semibold">Enter marks for multiple students</h2></div><button type="button" onClick={saveBulkGrades} disabled={bulkSaving || visibleSubmissions.length === 0} className="rounded-full bg-blue-600 px-5 py-2 text-xs font-semibold text-white disabled:opacity-50">{bulkSaving ? 'Uploading...' : 'Apply Bulk Marks'}</button></div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#e2eaf2] bg-white"><table className="w-full min-w-[700px] text-xs"><thead className="bg-[#f0f6ff]"><tr><th className="px-3 py-2 text-left">Student</th><th className="px-3 py-2 text-left">Assignment</th><th className="px-3 py-2 text-left">Marks</th><th className="px-3 py-2 text-left">Feedback</th></tr></thead><tbody>{visibleSubmissions.map((submission) => { const draft = bulkDraft[submission.submissionId] || {}; return <tr key={submission.submissionId} className="border-t border-[#eef3fa]"><td className="px-3 py-2 font-semibold">{submission.studentName}</td><td className="px-3 py-2">{submission.assignmentTitle}</td><td className="px-3 py-2"><input type="number" min="0" max={submission.totalMarks} value={draft.marks ?? submission.score ?? ''} onChange={(event) => updateBulkDraft(submission.submissionId, 'marks', event.target.value)} className="w-24 rounded-full border border-[#dce3ec] px-3 py-1.5" /></td><td className="px-3 py-2"><input value={draft.feedback ?? submission.feedback ?? ''} onChange={(event) => updateBulkDraft(submission.submissionId, 'feedback', event.target.value)} placeholder="Optional feedback" className="w-full min-w-[220px] rounded-full border border-[#dce3ec] px-3 py-1.5" /></td></tr>; })}</tbody></table></div>
          {bulkError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{bulkError}</p>}{bulkSuccess && <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700">{bulkSuccess}</p>}
        </Motion.section>
      ) : (
        <div className="mb-7 grid gap-6 lg:grid-cols-2">
          <Motion.section layout className="rounded-[1.8rem] border border-[#e2eaf2] bg-[#f9fcff] p-5 sm:p-7">
            <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-[#2c405c]"><User className="size-4 text-blue-600" /> Teacher Evaluation</h2>
            {evaluationSubmission ? <div className="space-y-3">
              <label className="flex items-center gap-3 text-xs font-medium text-[#4b5b73]"><span className="w-20">Student</span><select value={evaluationSubmission.submissionId} onChange={(event) => { const next = submissions.find((item) => item.submissionId === event.target.value); if (next) openSubmission(next); }} className="min-w-0 flex-1 rounded-full border border-[#dce3ec] bg-white px-3 py-2 text-sm"><option value={evaluationSubmission.submissionId}>{evaluationSubmission.studentName}</option>{submissions.filter((item) => item.submissionId !== evaluationSubmission.submissionId).slice(0, 8).map((item) => <option key={item.submissionId} value={item.submissionId}>{item.studentName}</option>)}</select></label>
              <label className="flex items-center gap-3 text-xs font-medium text-[#4b5b73]"><span className="w-20">Assignment</span><input value={evaluationSubmission.assignmentTitle || ''} readOnly className="min-w-0 flex-1 rounded-full border border-[#dce3ec] bg-white px-3 py-2 text-sm" /></label>
              <label className="flex items-center gap-3 text-xs font-medium text-[#4b5b73]"><span className="w-20">Type</span><input value={evaluationSubmission.type || evaluationSubmission.assignmentType || 'Assignment'} readOnly className="min-w-0 flex-1 rounded-full border border-[#dce3ec] bg-white px-3 py-2 text-sm" /></label>
              <label className="flex items-center gap-3 text-xs font-medium text-[#4b5b73]"><span className="w-20">Score</span><input type="number" min="0" max={evaluationSubmission.totalMarks} value={marks || (evaluationSubmission.score ?? '')} onChange={(event) => setMarks(event.target.value)} className="min-w-0 flex-1 rounded-full border border-[#dce3ec] bg-white px-3 py-2 text-sm" /></label>
              <label className="flex items-start gap-3 text-xs font-medium text-[#4b5b73]"><span className="w-20 pt-2">Feedback</span><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Write your detailed feedback here..." rows="4" className="min-w-0 flex-1 resize-y rounded-2xl border border-[#dce3ec] bg-white px-3 py-2 text-sm" /></label>
              {saveError && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{saveError}</p>}
              <div className="flex flex-wrap gap-2 pt-1"><button type="button" onClick={saveGrade} disabled={saving || !selected || !marks} className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/15 disabled:opacity-50">{saving ? <Loader className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5" />} Apply & Save</button><button type="button" onClick={closePanel} className="inline-flex items-center gap-2 rounded-full border border-[#dce3ec] bg-white px-5 py-2.5 text-xs font-semibold"><X className="size-3.5" /> Skip</button></div>
            </div> : <div className="rounded-2xl border border-dashed border-[#dce3ec] bg-white p-8 text-center text-sm text-[#5f738f]">Select a submission above to evaluate it.</div>}
          </Motion.section>

          <Motion.section layout className="rounded-[1.8rem] border border-[#e2eaf2] bg-[#f9fcff] p-5 sm:p-7">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[#2c405c]"><Sparkles className="size-4 text-green-500" /> AI Suggested Feedback</h2>
            <div className="rounded-[1.5rem] border border-green-200 bg-green-50 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2"><Sparkles className="size-5 text-green-500" /><strong className="text-sm text-green-900">Detailed AI Analysis</strong><span className="ml-auto rounded-full border border-[#e2eaf2] bg-white px-3 py-1 text-[10px] text-[#6b7f9b]">{evaluationSubmission ? formatDate(evaluationSubmission.submittedAt) : 'Ready'}</span></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#e8eef6] bg-white p-3"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#5f738f]"><CheckCircle className="mr-1 inline size-3 text-green-600" /> Strengths</p><p className="text-xs leading-5 text-[#1a304a]">Clear attempt and good engagement with the assignment concepts.</p></div>
                <div className="rounded-2xl border border-[#e8eef6] bg-white p-3"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#5f738f]"><AlertTriangle className="mr-1 inline size-3 text-amber-500" /> Areas for Improvement</p><p className="text-xs leading-5 text-[#1a304a]">Review the worked steps and add more explanation where reasoning is incomplete.</p></div>
                <div className="sm:col-span-2 rounded-2xl border border-[#e8eef6] bg-white p-3"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#5f738f]"><Target className="mr-1 inline size-3 text-blue-600" /> Detailed Suggestions</p><p className="text-xs leading-5 text-[#1a304a]">Add a concise explanation for each answer, verify calculations, and revisit the related lesson resources before resubmitting.</p></div>
                <div className="sm:col-span-2 rounded-2xl border border-[#e8eef6] bg-[#f8fafc] p-3"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#5f738f]"><Award className="mr-1 inline size-3 text-amber-500" /> Suggested Score</p><span className="text-xl font-bold text-green-600">{evaluationScore}/{evaluationSubmission?.totalMarks || 100}</span><span className="ml-3 text-xs text-[#4b5b73]">AI confidence 92%</span></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-green-200 pt-3"><button type="button" className="rounded-full border border-green-200 bg-white px-4 py-1.5 text-xs font-medium text-green-700">Accept</button><button type="button" className="rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-medium text-red-600">Reject</button><button type="button" onClick={() => evaluationSubmission && openSubmission(evaluationSubmission)} className="rounded-full border border-blue-200 bg-blue-600 px-4 py-1.5 text-xs font-medium text-white">Apply Feedback</button></div>
              <p className="mt-3 text-[10px] text-[#6b7f9b]">AI processed for {evaluationSubmission?.assignmentTitle || 'the selected submission'} · AI assisted review</p>
            </div>
          </Motion.section>
        </div>
      )}

      <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#eaf0f8] bg-white px-5 py-4 shadow-sm"><div className="flex items-center gap-2 text-sm font-semibold"><Calendar className="size-5 text-blue-600" /> Upcoming Deadlines</div><div className="flex flex-wrap gap-2">{assignments.filter((assignment) => assignment?.dueDate).slice(0, 4).map((assignment) => <span key={assignment._id} className="rounded-full bg-[#f1f5f9] px-3 py-1.5 text-[11px] font-medium">{formatDate(assignment.dueDate)} · {assignment.title}</span>)}{assignments.length === 0 && <span className="text-xs text-[#6b7f9b]">No upcoming assignments</span>}</div></section>

      <footer className="flex flex-wrap justify-between gap-3 border-t border-[#ecf2f9] pt-4 text-[11px] text-[#6b7f9b]"><span><Clock className="mr-1 inline size-3" /> Last AI evaluation: {latestSubmissionDate ? formatDate(latestSubmissionDate) : 'Not yet'}</span><span><CheckCircle className="mr-1 inline size-3 text-blue-600" /> {gradedCount} of {submissions.length} evaluated</span><span><Sparkles className="mr-1 inline size-3 text-green-500" /> {aiEvaluatedCount} AI assisted</span><span><Layers className="mr-1 inline size-3" /> 5 types supported</span><span className="text-red-600"><Clock className="mr-1 inline size-3" /> {pendingCount} pending total</span></footer>
    </Motion.div>
  );
};


// Create Assignment Modal Component
const CreateAssignmentModal = ({
  setShowModal, newAssignment, handleChange, handleCreate,
  classSectionOptions, sessionOptions, subjectOptions, setNewAssignment, uploadingPdf, handlePdfUpload,
  removePdfAttachment, loading, error, activeSessionId
}) => (
  <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto border-[2.5px] border-purple-300">
      <div className="px-5 py-4 border-b border-purple-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Plus size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Create New Assignment</h2>
            <p className="text-[11px] text-gray-400">Set up a new assignment for your students</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(false)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="px-5 py-4">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            <p className="text-xs text-red-600 font-medium flex-1">{error}</p>
          </div>
        )}
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Session <span className="text-xs text-red-500">*</span></label>
              <select
                name="academicYearId"
                value={newAssignment.academicYearId}
                onChange={(e) => {
                  const nextSessionId = e.target.value;
                  const selectedSession = sessionOptions.find((option) => option.id === nextSessionId);
                  setNewAssignment((prev) => ({
                    ...prev,
                    academicYearId: nextSessionId,
                    sessionName: selectedSession?.name || '',
                    classId: '',
                    sectionId: '',
                    subject: ''
                  }));
                }}
                className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                required
              >
                <option value="">Select Session</option>
                {sessionOptions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
              {!activeSessionId && (
                <p className="mt-1 text-[11px] text-red-500">Please ask school admin to activate a session before creating assignments.</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Assignment Title <span className="text-xs text-red-500">*</span></label>
              <input
                name="title"
                value={newAssignment.title}
                onChange={handleChange}
                type="text"
                placeholder="e.g., Quadratic Equations Problem Set"
                className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Class & Section <span className="text-xs text-red-500">*</span></label>
              <select
                name="classSection"
                value={newAssignment.classId && newAssignment.sectionId ? `${newAssignment.classId}-${newAssignment.sectionId}` : ''}
                onChange={(e) => {
                  if (!e.target.value) {
                    setNewAssignment(prev => ({ ...prev, classId: "", sectionId: "", subject: "" }));
                    return;
                  }
                  const [classId, sectionId] = e.target.value.split('-');
                  setNewAssignment(prev => ({ ...prev, classId, sectionId, subject: "" }));
                }}
                disabled={!newAssignment.academicYearId}
                className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                required
              >
                <option value="">
                  {newAssignment.academicYearId ? 'Select Class & Section' : 'Select Session First'}
                </option>
                {classSectionOptions.map((cs) => (
                  <option key={`${cs.classId}-${cs.sectionId}`} value={`${cs.classId}-${cs.sectionId}`}>
                    Class {cs.className} - Section {cs.sectionName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subject <span className="text-xs text-red-500">*</span></label>
              <select
                name="subject"
                value={newAssignment.subject}
                onChange={handleChange}
                disabled={!newAssignment.classId || !newAssignment.sectionId || subjectOptions.length === 0}
                className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                required
              >
                <option value="">
                  {(!newAssignment.classId || !newAssignment.sectionId)
                    ? 'Select Class & Section First'
                    : subjectOptions.length === 0
                      ? 'No Allocated Subject Found'
                      : 'Select Subject'}
                </option>
                {subjectOptions.map(subject => (
                  <option key={subject.id} value={subject.name}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-400">Only allocated subjects for the selected class-section</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Topic</label>
              <input
                name="topic"
                value={newAssignment.topic}
                onChange={handleChange}
                type="text"
                placeholder="e.g., Algebra, Polynomials"
                className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
              />
              <p className="mt-1 text-[11px] text-gray-400">Specific topic covered</p>
            </div>



            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Due Date <span className="text-xs text-red-500">*</span></label>
              <input
                name="dueDate"
                value={newAssignment.dueDate}
                onChange={handleChange}
                type="date"
                className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Total Marks <span className="text-xs text-red-500">*</span></label>
              <input
                name="marks"
                value={newAssignment.marks}
                onChange={handleChange}
                type="number"
                min="1"
                placeholder="e.g., 100"
                className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Submission Format <span className="text-xs text-red-500">*</span></label>
              <select
                name="submissionFormat"
                value={newAssignment.submissionFormat}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                required
              >
                <option value="text">Text Only</option>
                <option value="pdf">PDF Upload</option>
              </select>
              <p className="mt-1 text-[11px] text-gray-400">How students submit this assignment</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
              <select
                name="status"
                value={newAssignment.status}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
              <textarea
                name="description"
                value={newAssignment.description}
                onChange={handleChange}
                rows="3"
                placeholder="Provide detailed instructions for the assignment..."
                className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors resize-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Attachment (PDF)</label>
              <div className="border-2 border-dashed border-purple-300 rounded-xl p-5 hover:border-purple-400 hover:bg-purple-50 transition-colors">
                {uploadingPdf ? (
                  <div className="flex flex-col items-center justify-center">
                    <Loader className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
                    <p className="text-xs text-gray-500">Uploading PDF...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-2">
                      <Upload size={18} className="text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      Drag and drop a PDF file, or click to select
                    </p>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label
                      htmlFor="pdf-upload"
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors text-xs font-semibold"
                    >
                      Select PDF
                    </label>
                    <p className="text-[11px] text-gray-400 mt-1.5">Maximum file size: 20MB</p>
                  </div>
                )}
              </div>

              {newAssignment.attachments.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-600">Uploaded Files:</p>
                  {newAssignment.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-emerald-600" />
                        <span className="text-xs text-emerald-700 font-medium truncate max-w-xs">
                          {attachment.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePdfAttachment(index)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-purple-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border-[2px] border-purple-200 rounded-xl hover:bg-gray-100 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-lg disabled:opacity-50 transition-all"
              disabled={loading || !activeSessionId}
            >
              {loading ? 'Creating...' : 'Create Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
);

// Assignment Detail Modal Component
const AssignmentDetailModal = ({
  selectedAssignment, setShowDetailModal,
  detailEditMode, setDetailEditMode, detailDraft, handleDetailDraftChange,
  handleUpdateAssignment, detailSaving, openAssignmentDetail,
  myClasses, globalSubjectOptions, getStatusColor, getDifficultyColor,
  formatDate, getAssignmentClassName, getAssignmentSectionName, getSubmissionPercentage
}) => {
  const detailClass = getAssignmentClassName(selectedAssignment) || 'N/A';
  const detailSection = getAssignmentSectionName(selectedAssignment);
  const detailInstructions = detailDraft.description || selectedAssignment.instructions || selectedAssignment.description || 'No instructions provided.';
  const detailType = selectedAssignment.type || 'Assignment';
  const detailDifficulty = selectedAssignment.difficulty || 'Medium';
  const detailAttachments = Array.isArray(selectedAssignment.attachments) ? selectedAssignment.attachments : [];
  const detailTags = Array.isArray(selectedAssignment.tags) ? selectedAssignment.tags : [];
  const detailSubmissions = Number(selectedAssignment.submissions || 0);
  const detailTotalStudents = Number(selectedAssignment.totalStudents || 0);
  const detailAvgScore = Number(selectedAssignment.avgScore || 0);
  const detailSubmissionRate = detailTotalStudents > 0
    ? Math.round((detailSubmissions / detailTotalStudents) * 100)
    : Number(selectedAssignment.submissionRate || 0);
  const detailClassSectionOptions = myClasses || [];
  const detailSubjectOptions = (() => {
    if (!detailDraft.classId || !detailDraft.sectionId) return globalSubjectOptions;
    const matched = detailClassSectionOptions.find(
      (cs) => String(cs.classId) === String(detailDraft.classId) && String(cs.sectionId) === String(detailDraft.sectionId)
    );
    return matched?.subjects?.length ? matched.subjects : globalSubjectOptions;
  })();

  return (
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-xl max-h-[90vh] overflow-y-auto border-[2.5px] border-purple-300">
        <div className="p-6 border-b border-purple-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                {detailEditMode ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={detailDraft.title}
                      onChange={(e) => handleDetailDraftChange('title', e.target.value)}
                      className="w-full rounded-lg border-[2px] border-purple-300 px-3 py-1.5 text-sm font-semibold text-gray-900"
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-gray-900">{selectedAssignment.title}</h2>
                    <p className="text-sm text-gray-500">
                      {selectedAssignment.subject || 'Subject'}{selectedAssignment.topic ? ` - ${selectedAssignment.topic}` : ''} • Class {detailClass}{detailSection ? ` - ${detailSection}` : ''}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {detailEditMode ? (
                <>
                  <button
                    onClick={handleUpdateAssignment}
                    disabled={detailSaving}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
                  >
                    {detailSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => openAssignmentDetail(selectedAssignment)}
                    className="px-3 py-1.5 rounded-lg border-[2px] border-purple-300 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setDetailEditMode(true)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              )}
              <button className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Assignment Details</h3>
                {detailEditMode ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        value={detailDraft.classId && detailDraft.sectionId ? `${detailDraft.classId}::${detailDraft.sectionId}` : ''}
                        onChange={(e) => {
                          const [classId, sectionId] = String(e.target.value || '').split('::');
                          handleDetailDraftChange('classId', classId || '');
                          handleDetailDraftChange('sectionId', sectionId || '');
                          handleDetailDraftChange('subject', '');
                        }}
                        className="w-full rounded-lg border-[2px] border-purple-300 px-3 py-2 text-sm text-gray-700"
                      >
                        <option value="">Select Class & Section</option>
                        {detailClassSectionOptions.map((cs) => (
                          <option key={`${cs.classId}-${cs.sectionId}`} value={`${cs.classId}::${cs.sectionId}`}>
                            Class {cs.className} - Section {cs.sectionName}
                          </option>
                        ))}
                      </select>
                      <select
                        value={detailDraft.subject}
                        onChange={(e) => handleDetailDraftChange('subject', e.target.value)}
                        className="w-full rounded-lg border-[2px] border-purple-300 px-3 py-2 text-sm text-gray-700"
                      >
                        <option value="">Select Subject</option>
                        {detailSubjectOptions.map((sub) => (
                          <option key={String(sub.id || sub._id || sub.name)} value={sub.name}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={detailDraft.topic}
                        onChange={(e) => handleDetailDraftChange('topic', e.target.value)}
                        placeholder="Topic (e.g., Algebra, Polynomials)"
                        className="w-full rounded-lg border-[2px] border-purple-300 px-3 py-2 text-sm text-gray-700"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={detailDraft.type}
                        onChange={(e) => handleDetailDraftChange('type', e.target.value)}
                        placeholder="Type"
                        className="w-full rounded-lg border-[2px] border-purple-300 px-3 py-2 text-sm text-gray-700"
                      />
                      <select
                        value={detailDraft.difficulty}
                        onChange={(e) => handleDetailDraftChange('difficulty', e.target.value)}
                        className="w-full rounded-lg border-[2px] border-purple-300 px-3 py-2 text-sm text-gray-700"
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                    <textarea
                      value={detailDraft.description}
                      onChange={(e) => handleDetailDraftChange('description', e.target.value)}
                      rows={5}
                      className="w-full rounded-lg border-[2px] border-purple-300 px-3 py-2 text-sm text-gray-700"
                    />
                  </div>
                ) : (
                  <p className="text-gray-700 leading-relaxed">{selectedAssignment.description}</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Instructions</h3>
                <p className="text-gray-700 leading-relaxed">{detailInstructions}</p>
              </div>

              {detailAttachments.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Attachments</h3>
                  <div className="space-y-2">
                    {detailAttachments.map((attachment, index) => {
                      const label = typeof attachment === 'string' ? attachment : (attachment?.name || attachment?.originalName || `Attachment ${index + 1}`);
                      const link = typeof attachment === 'object' ? attachment?.url : '';
                      return (
                        <div key={index} className="flex items-center space-x-3 p-3 border-[2px] border-purple-200 rounded-lg">
                          <FileText className="w-5 h-5 text-blue-500" />
                          <span className="text-gray-700 flex-1">{label}</span>
                          {link ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                              View
                            </a>
                          ) : (
                            <span className="text-gray-400 text-sm">Attached</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {detailTags.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {detailTags.map((tag, index) => (
                      <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Assignment Info</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Status:</span>
                    {detailEditMode ? (
                      <select
                        value={detailDraft.status}
                        onChange={(e) => handleDetailDraftChange('status', e.target.value)}
                        className="rounded-lg border-[2px] border-purple-300 px-2 py-1 text-xs"
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedAssignment.status)}`}>
                        {selectedAssignment.status.charAt(0).toUpperCase() + selectedAssignment.status.slice(1)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Type:</span>
                    <span className="text-gray-900">{detailEditMode ? detailDraft.type : detailType}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Difficulty:</span>
                    <span className={getDifficultyColor(detailEditMode ? detailDraft.difficulty : detailDifficulty)}>
                      {detailEditMode ? detailDraft.difficulty : detailDifficulty}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Marks:</span>
                    {detailEditMode ? (
                      <input
                        type="number"
                        min="1"
                        value={detailDraft.marks}
                        onChange={(e) => handleDetailDraftChange('marks', e.target.value)}
                        className="w-24 rounded-lg border-[2px] border-purple-300 px-2 py-1 text-xs text-right"
                      />
                    ) : (
                      <span className="text-gray-900">{selectedAssignment.marks}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Due Date:</span>
                    {detailEditMode ? (
                      <input
                        type="date"
                        value={detailDraft.dueDate}
                        onChange={(e) => handleDetailDraftChange('dueDate', e.target.value)}
                        className="rounded-lg border-[2px] border-purple-300 px-2 py-1 text-xs"
                      />
                    ) : (
                      <span className="text-gray-900">{formatDate(selectedAssignment.dueDate)}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Submission:</span>
                    {detailEditMode ? (
                      <select
                        value={detailDraft.submissionFormat}
                        onChange={(e) => handleDetailDraftChange('submissionFormat', e.target.value)}
                        className="rounded-lg border-[2px] border-purple-300 px-2 py-1 text-xs"
                      >
                        <option value="text">Text</option>
                        <option value="pdf">PDF</option>
                      </select>
                    ) : (
                      <span className="text-gray-900">{selectedAssignment.submissionFormat === 'pdf' ? 'PDF' : 'Text'}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Created:</span>
                    <span className="text-gray-900">{formatDate(selectedAssignment.createdDate || selectedAssignment.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Submission Stats</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Submissions</span>
                      <span className="text-gray-900">{detailSubmissions}/{detailTotalStudents}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${getSubmissionPercentage(detailSubmissions, detailTotalStudents)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {getSubmissionPercentage(detailSubmissions, detailTotalStudents)}% completion rate
                    </p>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Submitted Rate:</span>
                    <span className="text-gray-900">{detailSubmissionRate}%</span>
                  </div>
                  {detailAvgScore > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Average Score:</span>
                      <span className="text-gray-900">{detailAvgScore.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentPortal;
