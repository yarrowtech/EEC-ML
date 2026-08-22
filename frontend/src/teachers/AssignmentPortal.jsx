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
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import PracticeQuestions from './PracticeQuestions';
import TryoutManagement from '../components/TryoutManagement';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const toEntityId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value);
};

const getLessonPlanChapters = (plan) => {
  const planned = Array.isArray(plan?.plannerContent?.chapters) ? plan.plannerContent.chapters : [];
  const raw = Array.isArray(plan?.rawChapters) ? plan.rawChapters : [];
  const source = planned.length > 0 ? planned : raw;

  return source.map((chapter, index) => ({
    id: toEntityId(chapter?.id || chapter?._id) || `chapter-${index + 1}`,
    title: String(typeof chapter === 'string' ? chapter : chapter?.title || '').trim(),
  })).filter((chapter) => chapter.title);
};

const getScopedLessonPlans = ({ plans, classId, sectionId, subject, classSections }) => {
  if (!classId || !sectionId || !subject) return [];
  const selectedClassSection = (classSections || []).find(
    (item) => String(item.classId) === String(classId) && String(item.sectionId) === String(sectionId)
  );
  const selectedSubject = (selectedClassSection?.subjects || []).find(
    (item) => String(item?.name || '').trim().toLowerCase() === String(subject).trim().toLowerCase()
  );
  const selectedSubjectId = toEntityId(selectedSubject?.id || selectedSubject?._id);

  return (plans || []).filter((plan) => {
    const planSubjectId = toEntityId(plan?.subjectId);
    const subjectMatches = selectedSubjectId && planSubjectId
      ? selectedSubjectId === planSubjectId
      : String(plan?.subject || '').trim().toLowerCase() === String(subject).trim().toLowerCase();
    return toEntityId(plan?.classId) === String(classId)
      && toEntityId(plan?.sectionId) === String(sectionId)
      && subjectMatches
      && plan?.status === 'published'
      && plan?.isDraft !== true;
  }).sort((left, right) => String(left?.title || '').localeCompare(String(right?.title || '')));
};

const makeClassSlug = (className, sectionName) =>
  `${String(className || '').trim()}-${String(sectionName || '').trim()}`
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const AssignmentPortal = ({ view = 'manage' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { classId = 'current' } = useParams();
  const activeTab = view === 'evaluate' ? 'evaluate' : 'manage';
  const assignmentBasePath = `/teacher/classes/${encodeURIComponent(classId)}/assignments`;

  // ─────────────────────────────────────────────────────────────────────────
  // ASSIGNMENT MANAGEMENT STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [activityEditor, setActivityEditor] = useState(null);
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
    difficulty: 'Medium',
    sourceLessonPlanId: '',
    chapterId: '',
    chapterTitle: '',
    topicTitle: '',
    subTopicTitle: ''
  });
  const [viewMode, setViewMode] = useState('grid');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterTopic, setFilterTopic] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [myClasses, setMyClasses] = useState([]);
  const [lessonPlans, setLessonPlans] = useState([]);
  const [lessonPlanError, setLessonPlanError] = useState('');
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
    type: "Assignment",
    difficulty: "Medium",
    isEssay: false,
    rubric: "",
    attachments: [],
    sourceLessonPlanId: "",
    chapterId: "",
    chapterTitle: "",
    topicTitle: "",
    subTopicTitle: "",
    timeLimit: "",
    publishDate: "",
    lateSubmissions: false,
    lateSubmissionCutoff: "",
    groups: ""
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
  const [aiGeneratingAssignment, setAiGeneratingAssignment] = useState(false);
  const [aiAssignmentError, setAiAssignmentError] = useState('');
  const [aiAssignmentGrounded, setAiAssignmentGrounded] = useState(false);
  const [publishingAssignments, setPublishingAssignments] = useState({});
  const [assignmentPublishMessage, setAssignmentPublishMessage] = useState('');

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
  const evaluationMode = 'single';
  const [bulkDraft, setBulkDraft] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState('');

  // ─── Tryout submissions state ───────────────────────────────────────────────
  const [tryoutSubmissions, setTryoutSubmissions] = useState([]);
  const [loadingTryouts, setLoadingTryouts] = useState(false);
  const [tryoutGrading, setTryoutGrading] = useState({});  // { [id]: { score, feedback } }
  const [tryoutSaving, setTryoutSaving] = useState({});
  const [tryoutSaved, setTryoutSaved] = useState({});

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

  const availableLessonPlans = useMemo(() => getScopedLessonPlans({
    plans: lessonPlans,
    classId: newAssignment.classId,
    sectionId: newAssignment.sectionId,
    subject: newAssignment.subject,
    classSections: myClasses,
  }), [lessonPlans, myClasses, newAssignment.classId, newAssignment.sectionId, newAssignment.subject]);

  const selectedLessonPlan = availableLessonPlans.find(
    (plan) => toEntityId(plan?._id) === String(newAssignment.sourceLessonPlanId || '')
  );
  const availableLessonPlanChapters = useMemo(
    () => getLessonPlanChapters(selectedLessonPlan),
    [selectedLessonPlan]
  );

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
      const response = await axios.get(`${API_BASE_URL}/api/teacher/dashboard/allocations`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const items = Array.isArray(response.data) ? response.data : [];

      // Group allocation items by class-section, collecting all assigned subjects
      const map = new Map();
      items.forEach(item => {
        if (!item.classId || !item.sectionId) return;
        const classId = item.classId?._id || item.classId;
        const sectionId = item.sectionId?._id || item.sectionId;
        const key = `${classId}-${sectionId}`;
        if (!map.has(key)) {
          const academicYearId = item.classId?.academicYearId?._id || item.classId?.academicYearId || null;
          map.set(key, {
            classId: String(classId),
            className: String(item.classId?.name || ''),
            sectionId: String(sectionId),
            sectionName: String(item.sectionId?.name || ''),
            academicYearId: String(academicYearId || ''),
            sessionName: String(item.classId?.academicYearId?.name || ''),
            subjects: []
          });
        }
        const entry = map.get(key);
        const subjectId = item.subjectId?._id;
        const subjectName = item.subjectId?.name || item.subjectName;
        if (subjectName) {
          const subjectKey = String(subjectId || subjectName);
          if (!entry.subjects.find(s => String(s.id) === subjectKey)) {
            entry.subjects.push({ id: subjectId || subjectName, name: subjectName });
          }
        }
      });

      const normalizedClasses = Array.from(map.values());
      setMyClasses(normalizedClasses);
      if (normalizedClasses.length === 0) {
        setError('No classes assigned. Ask your admin to assign you to classes first.');
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

  const fetchLessonPlans = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/lesson-plans/teacher/my`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      setLessonPlans(Array.isArray(response.data) ? response.data : []);
      setLessonPlanError('');
    } catch (err) {
      console.error('Error fetching lesson plans:', err);
      setLessonPlans([]);
      setLessonPlanError(err.response?.data?.error || 'Failed to load lesson plans');
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

  const fetchTryoutSubmissions = async () => {
    try {
      setLoadingTryouts(true);
      const { data } = await axios.get(`${API_BASE_URL}/api/lesson-plans/teacher/tryout-submissions`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      setTryoutSubmissions(Array.isArray(data?.results) ? data.results : []);
    } catch (err) {
      console.error('Error fetching tryout submissions:', err);
    } finally {
      setLoadingTryouts(false);
    }
  };

  useEffect(() => {
    fetchActiveSession();
    fetchMyClasses();
    fetchAssignments();
    fetchLessonPlans();
    fetchSubmissions();
    fetchTryoutSubmissions();
  }, []);

  // Pre-populate class/section from the URL slug (e.g. "5-a") once classes load
  useEffect(() => {
    if (!myClasses.length || !classId || classId === 'current') return;
    // Avoid overwriting a class the user has already manually selected
    if (newAssignment.classId) return;

    const classMongoId = location.state?.classMongoId;
    const matched = myClasses.find(cs => {
      if (classMongoId) return String(cs.classId) === String(classMongoId);
      return makeClassSlug(cs.className, cs.sectionName) === classId;
    });
    if (!matched) return;

    setNewAssignment(prev => ({
      ...prev,
      classId: String(matched.classId),
      sectionId: String(matched.sectionId),
      ...(matched.subjects.length === 1 ? { subject: matched.subjects[0].name } : {}),
    }));
  }, [myClasses, classId, location.state?.classMongoId]);

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
      difficulty: assignment?.difficulty || 'Medium',
      sourceLessonPlanId: resolveIdValue(assignment?.sourceLessonPlanId),
      chapterId: assignment?.chapterId || '',
      chapterTitle: assignment?.chapterTitle || '',
      topicTitle: assignment?.topicTitle || '',
      subTopicTitle: assignment?.subTopicTitle || ''
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
        difficulty: detailDraft.difficulty,
        sourceLessonPlanId: detailDraft.sourceLessonPlanId,
        chapterId: detailDraft.chapterId,
        chapterTitle: detailDraft.chapterTitle,
        topicTitle: detailDraft.topic || detailDraft.topicTitle,
        subTopicTitle: detailDraft.subTopicTitle
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
    const { name, value } = e.target;
    setNewAssignment((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'subject'
        ? { sourceLessonPlanId: '', chapterId: '', chapterTitle: '', topicTitle: '', subTopicTitle: '' }
        : {}),
      ...(name === 'topic' ? { topicTitle: value } : {}),
      ...(name === 'submissionFormat' && value === 'pdf'
        ? { isEssay: false, rubric: '' }
        : {}),
    }));
  };

  const openAIAssignmentCreator = () => {
    setAiAssignmentError('');
    setAiAssignmentGrounded(false);
    setShowModal(true);
  };

  const handleGenerateAssignmentDraft = async () => {
    const selectedSubject = subjectOptions.find(
      (subject) => String(subject.name || '').trim().toLowerCase() === String(newAssignment.subject || '').trim().toLowerCase()
    );
    const selectedClassSection = classSectionOptions.find(
      (item) => String(item.classId) === String(newAssignment.classId)
        && String(item.sectionId) === String(newAssignment.sectionId)
    );
    if (!newAssignment.classId || !newAssignment.sectionId || !newAssignment.subject) {
      setAiAssignmentError('Select a class, section, and subject before generating.');
      return;
    }

    setAiGeneratingAssignment(true);
    setAiAssignmentError('');
    setAiAssignmentGrounded(false);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/ai-teacher/assignment-draft`,
        {
          classId: newAssignment.classId,
          sectionId: newAssignment.sectionId,
          subjectId: selectedSubject?.id || null,
          subject: newAssignment.subject,
          topic: newAssignment.topic || '',
          chapterTitle: newAssignment.chapterTitle || newAssignment.topic || '',
          gradeLevel: selectedClassSection?.className || '',
          difficulty: newAssignment.difficulty,
          activityType: newAssignment.type,
          marks: Number(newAssignment.marks) || 20,
        },
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      const draft = data?.data?.draft;
      if (!draft) throw new Error('AI response did not include a draft');
      setNewAssignment((previous) => ({
        ...previous,
        title: draft.title || previous.title,
        description: draft.description || previous.description,
        marks: draft.marks || previous.marks,
        difficulty: draft.difficulty || previous.difficulty,
        // keep the teacher's chosen type — don't let AI override it
        submissionFormat: draft.submissionFormat || previous.submissionFormat,
        isEssay: Boolean(draft.isEssay),
        rubric: draft.isEssay ? draft.rubric || '' : previous.rubric,
      }));
      setAiAssignmentGrounded(Boolean(data?.data?.groundedInMaterial));
    } catch (err) {
      setAiAssignmentError(err.response?.data?.error || err.message || 'Failed to generate draft');
    } finally {
      setAiGeneratingAssignment(false);
    }
  };

  const openActivityCreator = (activityType) => {
    if (activityType === 'mcq' || activityType === 'blank') {
      setActivityEditor(activityType);
      return;
    }
    if (activityType === 'tryout') {
      setActivityEditor('tryout');
      return;
    }

    const assignmentType = activityType === 'writing'
      ? 'Essay'
      : activityType === 'worksheet'
        ? 'Worksheet'
        : 'Assignment';
    setNewAssignment((prev) => ({
      ...prev,
      type: assignmentType,
      submissionFormat: 'text',
      isEssay: activityType === 'writing',
      rubric: '',
    }));
    setActivityEditor(activityType);
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
        setActivityEditor(null);
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
          type: "Assignment",
          difficulty: "Medium",
          isEssay: false,
          rubric: "",
          attachments: [],
          sourceLessonPlanId: "",
          chapterId: "",
          chapterTitle: "",
          topicTitle: "",
          subTopicTitle: "",
          timeLimit: "",
          publishDate: "",
          lateSubmissions: false,
          lateSubmissionCutoff: "",
          groups: ""
        });
        setPdfFile(null);
        setAiAssignmentError('');
        setAiAssignmentGrounded(false);
        setCreateSuccessMessage(payload.status === 'active'
          ? 'Assignment created, published, and sent to the selected class.'
          : 'Assignment draft created successfully. Publish it when it is ready.');
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

  const handlePublishAssignment = async (assignment) => {
    const id = String(assignment?._id || '');
    if (!id || publishingAssignments[id]) return;
    setPublishingAssignments((previous) => ({ ...previous, [id]: true }));
    setAssignmentPublishMessage('');
    setError('');
    try {
      await axios.patch(
        `${API_BASE_URL}/api/assignment/teacher/publish/${id}`,
        {},
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      await fetchAssignments();
      setAssignmentPublishMessage(`“${assignment.title}” is now published to students.`);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to publish assignment');
    } finally {
      setPublishingAssignments((previous) => ({ ...previous, [id]: false }));
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
    setPublishError('');
    setPublishSuccess('');
  };

  const closePanel = () => {
    setSelected(null);
    setSaveError('');
    setPublishError('');
    setPublishSuccess('');
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
            ? { ...s, score: numMarks, feedback, status: 'graded', publishedByTeacher: false, publishedAt: null }
            : s
        )
      );
      setSelected(prev => ({ ...prev, score: numMarks, feedback, status: 'graded', publishedByTeacher: false, publishedAt: null }));
      setPublishSuccess('');
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
            status: 'graded',
            publishedByTeacher: false,
            publishedAt: null
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

  const publishSelectedGrade = async () => {
    if (!selected?.studentId || !selected?.assignmentId || selected.score === null || selected.score === undefined) {
      setPublishError('Save a grade before publishing it.');
      return;
    }

    setPublishing(true);
    setPublishError('');
    setPublishSuccess('');
    try {
      await axios.post(
        `${API_BASE_URL}/api/assignment/teacher/publish-grades`,
        { assignmentId: selected.assignmentId, studentIds: [selected.studentId] },
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      const publishedAt = new Date().toISOString();
      setSubmissions((prev) => prev.map((item) => (
        item.submissionId === selected.submissionId
          ? { ...item, publishedByTeacher: true, publishedAt }
          : item
      )));
      setSelected((prev) => prev ? { ...prev, publishedByTeacher: true, publishedAt } : prev);
      setPublishSuccess('Marks and feedback are now visible to the student.');
    } catch (err) {
      setPublishError(err.response?.data?.error || 'Failed to publish marks.');
    } finally {
      setPublishing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f4f7fc] p-3 sm:p-5">
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

        {activeTab === 'manage' ? (
          <ManageAssignments
            onEvaluateSubmissions={() => navigate(`${assignmentBasePath}/evaluate`)}
            openActivityCreator={openActivityCreator}
            activityEditor={activityEditor}
            closeActivityEditor={() => setActivityEditor(null)}
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
            openAIAssignmentCreator={openAIAssignmentCreator}
            openAssignmentDetail={openAssignmentDetail}
            openDeleteModal={openDeleteModal}
            onPublishAssignment={handlePublishAssignment}
            publishingAssignments={publishingAssignments}
            assignmentPublishMessage={assignmentPublishMessage}
            getStatusColor={getStatusColor}
            getAssignmentClassName={getAssignmentClassName}
            getAssignmentSectionName={getAssignmentSectionName}
            getDaysUntilDue={getDaysUntilDue}
            createFormProps={{
              newAssignment, handleChange, handleCreate,
              classSectionOptions, sessionOptions, subjectOptions, setNewAssignment,
              uploadingPdf, handlePdfUpload, removePdfAttachment,
              loading, error, activeSessionId,
              availableLessonPlans, availableLessonPlanChapters, lessonPlanError,
              aiGeneratingAssignment, aiAssignmentError, aiAssignmentGrounded,
              handleGenerateAssignmentDraft,
            }}
          />
        ) : (
          <EvaluateSubmissions
            onManageAssignments={() => navigate(`${assignmentBasePath}/manage`)}
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
            bulkDraft={bulkDraft}
            updateBulkDraft={updateBulkDraft}
            saveBulkGrades={saveBulkGrades}
            bulkSaving={bulkSaving}
            bulkError={bulkError}
            bulkSuccess={bulkSuccess}
            publishing={publishing}
            publishError={publishError}
            publishSuccess={publishSuccess}
            publishSelectedGrade={publishSelectedGrade}
            formatDate={formatDate}
            tryoutSubmissions={tryoutSubmissions}
            loadingTryouts={loadingTryouts}
            tryoutGrading={tryoutGrading}
            tryoutSaving={tryoutSaving}
            tryoutSaved={tryoutSaved}
            onTryoutGradingChange={(id, field, value) => setTryoutGrading((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))}
            onTryoutSaveGrade={async (submission) => {
              const id = String(submission._id);
              const draft = tryoutGrading[id] || {};
              const score = Number(draft.score ?? '');
              if (!Number.isFinite(score)) return;
              setTryoutSaving((prev) => ({ ...prev, [id]: true }));
              try {
                await axios.patch(
                  `${API_BASE_URL}/api/lesson-plans/teacher/tryout-submissions/${id}/grade`,
                  { teacherScore: score, teacherFeedback: draft.feedback || '' },
                  { headers: { Authorization: `Bearer ${token()}` } }
                );
                setTryoutSubmissions((prev) => prev.map((s) => String(s._id) === id ? { ...s, teacherScore: score, teacherFeedback: draft.feedback || '', status: 'graded' } : s));
                setTryoutSaved((prev) => ({ ...prev, [id]: true }));
                setTimeout(() => setTryoutSaved((prev) => ({ ...prev, [id]: false })), 3000);
              } catch (err) {
                console.error('Failed to save tryout grade:', err);
              } finally {
                setTryoutSaving((prev) => ({ ...prev, [id]: false }));
              }
            }}
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
          onClose={() => setShowModal(false)}
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
          availableLessonPlans={availableLessonPlans}
          availableLessonPlanChapters={availableLessonPlanChapters}
          lessonPlanError={lessonPlanError}
          aiGeneratingAssignment={aiGeneratingAssignment}
          aiAssignmentError={aiAssignmentError}
          aiAssignmentGrounded={aiAssignmentGrounded}
          handleGenerateAssignmentDraft={handleGenerateAssignmentDraft}
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
          lessonPlans={lessonPlans}
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

const TryoutSubmissionsPanel = ({ submissions, loading, grading, saving, saved, onGradingChange, onSaveGrade }) => {
  const [selectedId, setSelectedId] = useState(null);
  const selected = submissions.find((s) => String(s._id) === selectedId) || null;

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Loading tryout submissions…
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <Activity className="mx-auto mb-3 text-slate-300" size={36} />
        <p className="text-base font-bold text-slate-700">No tryout submissions yet</p>
        <p className="mt-1 text-sm text-slate-500">Students will appear here once they submit a tryout.</p>
      </div>
    );
  }

  const pendingCount = submissions.filter((s) => s.status !== 'graded').length;
  const gradedCount = submissions.filter((s) => s.status === 'graded').length;

  return (
    <div className="flex gap-4 lg:gap-6">
      {/* Left: list */}
      <div className="w-full lg:w-80 shrink-0 space-y-2">
        <div className="flex gap-2 mb-3">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">{pendingCount} pending</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{gradedCount} graded</span>
        </div>
        {submissions.map((s) => {
          const studentName = s.studentId?.name || 'Student';
          const isSelected = String(s._id) === selectedId;
          const isGraded = s.status === 'graded';
          return (
            <button
              key={String(s._id)}
              type="button"
              onClick={() => setSelectedId(String(s._id))}
              className={`w-full text-left rounded-xl border p-3 transition-all ${isSelected ? 'border-pink-400 bg-pink-50 shadow-sm' : 'border-slate-200 bg-white hover:border-pink-200 hover:bg-pink-50/40'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900 truncate">{studentName}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${isGraded ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isGraded ? 'Graded' : 'Pending'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 truncate">{s.topicTitle || 'Tryout'} · {s.subjectName || ''}</p>
              <p className="mt-0.5 text-xs text-slate-400">{s.totalQuestions} question{s.totalQuestions !== 1 ? 's' : ''} {s.autoScore !== null ? `· Auto: ${s.autoScore}%` : ''}</p>
            </button>
          );
        })}
      </div>

      {/* Right: detail */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            Select a submission on the left to review it.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-100 bg-gradient-to-r from-pink-50 to-rose-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-pink-600">Tryout Submission</p>
                  <h2 className="mt-0.5 text-lg font-black text-slate-900">{selected.studentId?.name || 'Student'}</h2>
                  <p className="text-sm text-slate-500">{selected.topicTitle} · {selected.subjectName} · {selected.chapterTitle}</p>
                </div>
                <div className="text-right shrink-0">
                  {selected.autoScore !== null && (
                    <div className="text-sm font-bold text-emerald-600">Auto: {selected.autoScore}%</div>
                  )}
                  {selected.teacherScore !== null && selected.teacherScore !== undefined && (
                    <div className="text-sm font-bold text-purple-600">Teacher: {selected.teacherScore}%</div>
                  )}
                </div>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
              {(selected.answers || []).map((ans, idx) => (
                <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Q{idx + 1} · {ans.questionType}</p>
                    {ans.isCorrect !== null && (
                      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${ans.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {ans.isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    )}
                  </div>
                  {ans.questionText && <p className="text-sm font-semibold text-slate-700 mb-1">{ans.questionText}</p>}
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold">Answer: </span>
                    {ans.answer !== null && ans.answer !== undefined
                      ? typeof ans.answer === 'object'
                        ? JSON.stringify(ans.answer)
                        : String(ans.answer)
                      : <span className="italic text-slate-400">No answer</span>}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 p-4 space-y-3">
              <p className="text-sm font-bold text-slate-700">Teacher Evaluation</p>
              <div className="flex gap-3">
                <div className="w-28">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Score (0–100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={grading[String(selected._id)]?.score ?? (selected.teacherScore ?? '')}
                    onChange={(e) => onGradingChange(String(selected._id), 'score', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. 85"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Feedback (optional)</label>
                  <input
                    type="text"
                    value={grading[String(selected._id)]?.feedback ?? (selected.teacherFeedback || '')}
                    onChange={(e) => onGradingChange(String(selected._id), 'feedback', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Write feedback for the student..."
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onSaveGrade(selected)}
                  disabled={saving[String(selected._id)]}
                  className="rounded-lg bg-pink-600 px-5 py-2 text-sm font-bold text-white hover:bg-pink-700 disabled:opacity-60"
                >
                  {saving[String(selected._id)] ? 'Saving…' : 'Save Grade'}
                </button>
                {saved[String(selected._id)] && (
                  <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle size={14} /> Saved
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ManageAssignments = ({
  onEvaluateSubmissions, openActivityCreator, activityEditor, closeActivityEditor,
  loading, filteredAssignments, myClasses, subjects,
  activeAssignments, draftAssignments, totalAssignments,
  viewMode, setViewMode, filterStatus, setFilterStatus,
  filterSubject, setFilterSubject, filterTopic, setFilterTopic, topics,
  searchTerm, setSearchTerm,
  setShowModal, openAIAssignmentCreator, openAssignmentDetail, openDeleteModal,
  onPublishAssignment, publishingAssignments, assignmentPublishMessage,
  getAssignmentClassName, getAssignmentSectionName, getDaysUntilDue,
  createFormProps
}) => (
  <div
    className="relative mx-auto max-w-[1360px] space-y-5 overflow-hidden rounded-[2rem] border border-white/50 bg-white/75 p-5 text-[#0b0e1a] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.08),0_4px_20px_rgba(0,0,0,0.02),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-lg backdrop-saturate-[1.1] sm:p-8"
  >
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.02em] sm:text-[1.6rem]">
          <GraduationCap className="size-6 text-[#4f6f8f]" /> Assignment Portal <span className="text-sm font-normal tracking-normal text-[#6f7a8c]">· v2</span>
        </h1>
        <p className="mt-1 text-sm text-[#6f7a8c]">Manage assignments and evaluate student submissions</p>
      </div>
      <div className="flex rounded-full border border-black/[0.03] bg-[#f0f2f6] p-1">
        <button type="button" aria-current="page" className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-medium text-[#0b0e1a] shadow-[0_2px_10px_rgba(0,0,0,0.04),0_1px_4px_rgba(0,0,0,0.02)]"><Layers className="size-3.5" /> Manage Assignments</button>
        <button type="button" onClick={onEvaluateSubmissions} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-[#6f7a8c] transition hover:bg-white/50 hover:text-[#1e2533]"><CheckCircle className="size-3.5" /> Evaluate Submissions</button>
      </div>
    </header>

    <section className="rounded-2xl border border-[#edf0f5] bg-[#fafbfc] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#1e2533]">Create learning activity</h2>
          <p className="mt-0.5 text-[11px] text-[#6f7a8c]">Choose a format to open its dedicated editor.</p>
        </div>
        <span className="rounded-full border border-[#e6eaf0] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#8e9aaf]">6 formats</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { key: 'assignment', label: 'Assignment', description: 'Text or PDF work', icon: FileText, tone: 'text-blue-700 bg-blue-50 border-blue-100' },
          { key: 'worksheet', label: 'Worksheet', description: 'Structured practice', icon: BookOpen, tone: 'text-amber-700 bg-amber-50 border-amber-100' },
          { key: 'writing', label: 'Writing', description: 'Essay response', icon: Edit3, tone: 'text-purple-700 bg-purple-50 border-purple-100' },
          { key: 'mcq', label: 'MCQ', description: 'Multiple choice', icon: CheckCircle, tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
          { key: 'blank', label: 'Fill in Blank', description: 'Answer completion', icon: ListChecks, tone: 'text-rose-700 bg-rose-50 border-rose-100' },
          { key: 'tryout', label: 'Tryout', description: 'Interactive activity', icon: Activity, tone: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
        ].map((activityType) => (
          <button
            key={activityType.key}
            type="button"
            onClick={() => openActivityCreator(activityType.key)}
            className="group rounded-xl border border-[#e6eaf0] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-[#c8d0dc] hover:shadow-[0_4px_14px_rgba(0,0,0,0.04)]"
          >
            <span className={`mb-2 flex size-8 items-center justify-center rounded-lg border ${activityType.tone}`}>
              <activityType.icon className="size-4" />
            </span>
            <span className="block text-xs font-semibold text-[#1e2533]">{activityType.label}</span>
            <span className="mt-0.5 block text-[10px] text-[#8e9aaf]">{activityType.description}</span>
          </button>
        ))}
      </div>
    </section>

    {activityEditor && (
      <section className="overflow-hidden rounded-2xl border border-[#e2e8ee] bg-white shadow-[0_4px_20px_rgba(0,20,30,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8ee] bg-[#fafbfc] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[#1e2533]">
              {activityEditor === 'mcq' ? 'MCQ Editor'
                : activityEditor === 'blank' ? 'Fill in the Blank Editor'
                : activityEditor === 'tryout' ? 'Tryout Builder'
                : activityEditor === 'assignment' ? 'New Assignment'
                : activityEditor === 'worksheet' ? 'New Worksheet'
                : 'New Writing Task'}
            </p>
            <p className="mt-0.5 text-[11px] text-[#6f7a8c]">Create and manage this activity without leaving Assignments.</p>
          </div>
          <button type="button" onClick={closeActivityEditor} className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8ee] bg-white px-4 py-2 text-xs font-medium text-[#2a3442] transition hover:bg-[#f0f4f8]">
            <X className="size-3.5" /> Close editor
          </button>
        </div>
        <div className={`overflow-auto bg-white ${activityEditor === 'assignment' || activityEditor === 'worksheet' || activityEditor === 'writing' ? '' : 'min-h-[560px]'}`}>
          {activityEditor === 'tryout' ? (
            <TryoutManagement />
          ) : activityEditor === 'mcq' || activityEditor === 'blank' ? (
            <PracticeQuestions key={activityEditor} initialType={activityEditor} />
          ) : activityEditor === 'worksheet' ? (
            <CreateWorksheetForm onClose={closeActivityEditor} {...createFormProps} />
          ) : activityEditor === 'writing' ? (
            <CreateWritingForm onClose={closeActivityEditor} {...createFormProps} />
          ) : (
            <CreateAssignmentModal inline onClose={closeActivityEditor} {...createFormProps} />
          )}
        </div>
      </section>
    )}

    {!activityEditor && (
      <>
    {assignmentPublishMessage && (
      <div role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
        <CheckCircle className="size-4" /> {assignmentPublishMessage}
      </div>
    )}
    {/* Stats Grid */}
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
      {[
        { label: 'Active', value: activeAssignments, icon: CheckCircle, iconColor: 'text-emerald-600' },
        { label: 'Drafts', value: draftAssignments, icon: Edit3, iconColor: 'text-amber-600' },
        { label: 'My Classes', value: myClasses.length, icon: Users, iconColor: 'text-blue-600' },
      ].map((stat) => (
        <div key={stat.label} className="rounded-2xl border border-[#e2e8ee] bg-[#fafbfc] p-3.5 transition-colors hover:bg-[#f4f7fa] sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-black/45 sm:text-xs">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold leading-none text-black">{stat.value}</p>
            </div>
            <div className="flex size-9 items-center justify-center rounded-xl border border-[#e2e8ee] bg-white">
              <stat.icon size={17} className={stat.iconColor} />
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Controls */}
    <div className="rounded-2xl border border-[#e2e8ee] bg-[#fafbfc] p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40" />
          <input
            type="text"
            placeholder="Search assignments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-full border border-[#e2e8ee] bg-white py-2.5 pl-10 pr-4 text-sm text-black outline-none placeholder:text-black/35 transition-colors focus:border-[#b8c4d0]"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-full border border-[#e2e8ee] bg-white px-3 py-2.5 text-xs text-black/70 outline-none transition-colors hover:bg-[#f4f7fa] focus:border-[#b8c4d0]"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="rounded-full border border-[#e2e8ee] bg-white px-3 py-2.5 text-xs text-black/70 outline-none transition-colors hover:bg-[#f4f7fa] focus:border-[#b8c4d0]"
        >
          <option value="all">All Subjects</option>
          {subjects.map(subject => (
            <option key={subject} value={subject}>{subject}</option>
          ))}
        </select>
        <select
          value={filterTopic}
          onChange={(e) => setFilterTopic(e.target.value)}
          className="rounded-full border border-[#e2e8ee] bg-white px-3 py-2.5 text-xs text-black/70 outline-none transition-colors hover:bg-[#f4f7fa] focus:border-[#b8c4d0]"
        >
          <option value="all">All Topics</option>
          {topics.map(topic => (
            <option key={topic} value={topic}>{topic}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1 rounded-full border border-[#e2e8ee] bg-[#f0f4f8] p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-full p-1.5 transition-all ${viewMode === 'grid' ? 'bg-white text-black shadow-sm' : 'text-black/35 hover:text-black/65'}`}
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
              className={`rounded-full p-1.5 transition-all ${viewMode === 'list' ? 'bg-white text-black shadow-sm' : 'text-black/35 hover:text-black/65'}`}
            >
              <div className="w-3.5 h-3.5 flex flex-col justify-center gap-[3px]">
                <div className="bg-current h-[2px] rounded" />
                <div className="bg-current h-[2px] rounded" />
                <div className="bg-current h-[2px] rounded" />
              </div>
            </button>
          </div>
          <button
            type="button"
            onClick={openAIAssignmentCreator}
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-semibold text-violet-700 transition hover:-translate-y-0.5 hover:bg-violet-100 hover:shadow-sm"
          >
            <Sparkles size={14} />
            AI Generate
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#d0d8e0] bg-[#f0f4f8] px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-[#e8eef4]"
          >
            <Plus size={14} />
            Create
          </button>
        </div>
      </div>
    </div>

    {/* Assignment List */}
    {loading ? (
      <div className="rounded-2xl border border-dashed border-[#e2e8ee] bg-[#fafbfc] p-12 text-center">
        <div className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl border border-[#e2e8ee] bg-[#f0f4f8]">
          <Clock className="size-6 animate-spin text-black/40" />
        </div>
        <h3 className="mb-1 text-base font-semibold text-black">Loading assignments...</h3>
        <p className="text-sm text-black/50">Fetching your assignment data</p>
      </div>
    ) : filteredAssignments.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-[#e2e8ee] bg-[#fafbfc] px-5 py-14 text-center">
        <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl border border-[#e2e8ee] bg-[#f0f4f8]">
          <FileText className="size-7 text-black/35" />
        </div>
        <h3 className="mb-1 text-base font-semibold text-black">No assignments found</h3>
        <p className="mb-5 text-sm text-black/45">Try adjusting your filters or create a new assignment</p>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#d0d8e0] bg-[#f0f4f8] px-6 py-2.5 text-xs font-semibold text-black transition hover:bg-[#e8eef4]"
        >
          <Plus size={14} />
          Create First Assignment
        </button>
      </div>
    ) : (
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-black/45">
            Showing {filteredAssignments.length} of {totalAssignments} assignments
          </p>
        </div>
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
          {filteredAssignments.map((assignment) => {
            const submissionFormat = assignment?.submissionFormat === 'pdf' ? 'pdf' : 'text';
            const statusBorder = assignment.status === 'active' ? 'border-l-emerald-400/70' : assignment.status === 'draft' ? 'border-l-amber-400/70' : assignment.status === 'completed' ? 'border-l-blue-400/70' : 'border-l-red-400/70';
            const statusColor = assignment.status === 'active'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : assignment.status === 'draft'
                ? 'border-amber-100 bg-amber-50 text-amber-700'
                : assignment.status === 'completed'
                  ? 'border-blue-100 bg-blue-50 text-blue-700'
                  : 'border-red-100 bg-red-50 text-red-700';
            return (
              <div
                key={assignment._id}
                onClick={() => openAssignmentDetail(assignment)}
                className={`cursor-pointer rounded-2xl border border-[#e2e8ee] border-l-4 bg-[#fafbfc] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#f4f7fa] hover:shadow-md ${statusBorder} ${viewMode === 'grid' ? 'p-5' : 'p-4'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="mr-3 flex-1 text-sm font-semibold leading-snug text-black">
                    {assignment.title}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0">
                    {assignment.status === 'draft' && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onPublishAssignment(assignment);
                        }}
                        disabled={Boolean(publishingAssignments[String(assignment._id)])}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {publishingAssignments[String(assignment._id)] ? <Loader className="size-3 animate-spin" /> : <Share2 className="size-3" />}
                        {publishingAssignments[String(assignment._id)] ? 'Publishing' : 'Publish'}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAssignmentDetail(assignment);
                      }}
                      className="rounded-lg p-1.5 text-black/35 transition-colors hover:bg-[#e8eef4] hover:text-black"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteModal(assignment);
                      }}
                      className="rounded-lg p-1.5 text-black/35 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusColor}`}>
                    {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                  </span>
                  <span className="inline-flex items-center rounded-md border border-[#d9dfe6] bg-white px-2 py-0.5 text-[11px] font-medium text-black/65">
                    {assignment.subject}
                  </span>
                  {assignment.topic && (
                    <span className="inline-flex items-center rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      {assignment.topic}
                    </span>
                  )}
                  {assignment.chapterTitle && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-violet-100 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                      <BookOpen size={11} /> {assignment.chapterTitle}
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-md border border-[#e2e8ee] bg-[#f0f4f8] px-2 py-0.5 text-[11px] font-medium text-black/60">
                    {`Class ${getAssignmentClassName(assignment) || 'N/A'}${getAssignmentSectionName(assignment) ? ` - ${getAssignmentSectionName(assignment)}` : ''}`}
                  </span>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${submissionFormat === 'pdf' ? 'border-purple-100 bg-purple-50 text-purple-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
                    {submissionFormat === 'pdf' ? 'PDF' : 'Text'}
                  </span>
                </div>

                <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-black/50">
                  {assignment.description}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-black/50">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-black/35" />
                    <span>Due {new Date(assignment.dueDate).toLocaleDateString()}</span>
                    {getDaysUntilDue(assignment.dueDate) <= 3 && getDaysUntilDue(assignment.dueDate) > 0 && (
                      <AlertTriangle size={12} className="text-orange-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Award size={12} className="text-black/35" />
                    <span>{assignment.marks} marks</span>
                  </div>
                  {assignment.attachments && assignment.attachments.length > 0 && (
                    <div className="flex items-center gap-1">
                      <FileText size={12} className="text-black/35" />
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
      </>
    )}
  </div>
);

const EvaluateSubmissions = ({
  onManageAssignments,
  loadingSubmissions, submissions, filtered, selected,
  marks, setMarks, feedback, setFeedback, saving, saveError,
  assignmentFilter, setAssignmentFilter,
  classFilter, setClassFilter, assignmentTitles, classOptions,
  pendingCount, gradedCount, openSubmission,
  closePanel, saveGrade, evaluationMode,
  bulkDraft, updateBulkDraft, saveBulkGrades, bulkSaving, bulkError, bulkSuccess,
  publishing, publishError, publishSuccess, publishSelectedGrade,
  formatDate,
  assignments = [],
  tryoutSubmissions = [], loadingTryouts = false,
  tryoutGrading = {}, tryoutSaving = {}, tryoutSaved = {},
  onTryoutGradingChange, onTryoutSaveGrade,
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
    { key: 'tryout', label: 'Tryouts', icon: Activity },
    { key: 'mcq', label: 'MCQs', icon: ListChecks },
    { key: 'fill', label: 'Fill in the Blanks', icon: Edit3 },
    { key: 'writing', label: 'Writing', icon: Edit3 },
  ];
  const visibleSubmissions = typeFilter === 'all'
    ? filtered
    : filtered.filter((submission) => normalizeType(submission).includes(typeFilter));
  const aiReviewedCount = submissions.filter((submission) => submission.aiGradingStatus === 'done').length;
  const aiEvaluatedCount = aiReviewedCount;
  const dueThisWeek = assignments.filter((assignment) => {
    if (!assignment?.dueDate) return false;
    const days = (new Date(assignment.dueDate).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 7;
  }).length;
  const evaluationSubmission = selected || highlightedSubmission;
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
      className="mx-auto max-w-[1360px] rounded-[2rem] border border-white/50 bg-white/75 p-5 text-[#0b0e1a] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.08),0_4px_20px_rgba(0,0,0,0.02),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-lg backdrop-saturate-[1.1] sm:p-8"
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Motion.h1 initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.02em] sm:text-[1.6rem]">
            <Sparkles className="size-6 text-[#4f6f8f]" /> Evaluate The Assignments With AI <span className="text-sm font-normal tracking-normal text-[#6f7a8c]">· beta</span>
          </Motion.h1>
          <p className="mt-1 text-sm text-[#6f7a8c]">Multi-type assignments · detailed AI feedback for every format</p>
        </div>
        <div className="flex rounded-full border border-black/[0.03] bg-[#f0f2f6] p-1">
          <button type="button" onClick={onManageAssignments} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-[#6f7a8c] transition hover:bg-white/50 hover:text-[#1e2533]"><Layers className="size-3.5" /> Manage Assignments</button>
          <button type="button" aria-current="page" className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-medium text-[#0b0e1a] shadow-[0_2px_10px_rgba(0,0,0,0.04),0_1px_4px_rgba(0,0,0,0.02)]"><CheckCircle className="size-3.5" /> Evaluate Submissions</button>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3 px-1 py-1">
        <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8e9aaf]"><Layers className="size-3.5 opacity-60" /> Class
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="rounded-full border border-[#e6eaf0] bg-white px-4 py-2 text-xs font-medium normal-case tracking-normal text-[#1e2533] outline-none transition hover:border-[#c8d0dc] focus:border-[#a0abbc]">
            {classOptions.map((option) => <option key={option} value={option}>{option === 'all' ? 'All classes' : `Class ${option}`}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8e9aaf]"><BookOpen className="size-3.5 opacity-60" /> Subject
          <select value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)} className="max-w-[220px] rounded-full border border-[#e6eaf0] bg-white px-4 py-2 text-xs font-medium normal-case tracking-normal text-[#1e2533] outline-none transition hover:border-[#c8d0dc] focus:border-[#a0abbc]">
            {assignmentTitles.map((option) => <option key={option} value={option}>{option === 'all' ? 'All assignments' : option}</option>)}
          </select>
        </label>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e6eaf0] bg-[#f0f2f6] px-4 py-2 text-xs font-medium text-[#2a3442]"><FileText className="size-3.5" /> <strong className="text-[#0b0e1a]">{visibleSubmissions.length}</strong> submissions</span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2.5">
        {[
          { label: 'Pending', value: pendingCount, icon: Clock, color: 'text-blue-600' },
          { label: 'Graded', value: gradedCount, icon: CheckCircle, color: 'text-blue-600' },
          { label: 'AI Reviewed', value: aiReviewedCount, icon: Target, color: 'text-blue-600' },
          { label: 'AI Evaluated', value: aiEvaluatedCount, icon: Sparkles, color: 'text-green-500' },
          { label: 'Due This Week', value: dueThisWeek, icon: Calendar, color: 'text-blue-600' },
        ].map((stat, index) => (
          <Motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} className="flex items-center gap-2 rounded-full border border-[#edf0f5] bg-[#f6f8fc] px-4 py-2 text-xs font-medium text-[#2a3442] transition hover:border-[#dce1e9] hover:bg-[#f0f3f9]">
            <stat.icon className={`size-3.5 ${stat.color} opacity-70`} />
            <strong className="text-sm text-[#0b0e1a]">{stat.value}</strong><span className="text-[10px] uppercase tracking-[0.03em]">{stat.label}</span>
          </Motion.div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2 border-b border-[#edf0f5] pb-4">
        {typeDefinitions.map((type) => {
          const Icon = type.icon;
          const count = type.key === 'tryout'
            ? tryoutSubmissions.filter((s) => s.status !== 'graded').length
            : type.key === 'all' ? pendingCount : submissions.filter((submission) => normalizeType(submission).includes(type.key) && (submission.score === null || submission.score === undefined)).length;
          const isTryout = type.key === 'tryout';
          return <button key={type.key} type="button" onClick={() => setTypeFilter(type.key)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium transition ${typeFilter === type.key ? (isTryout ? 'border-pink-200 bg-white text-pink-700 shadow-sm' : 'border-[#c8d0dc] bg-white text-[#0b0e1a] shadow-sm') : 'border-[#edf0f5] bg-[#f6f8fc] text-[#2a3442] hover:border-[#d0d7e2] hover:bg-[#edf1f8]'}`}><Icon className="size-3.5 opacity-60" /> {type.label}<span className="text-[10px] font-semibold text-[#6f7a8c]">{count}</span></button>;
        })}
        <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-[#e6eaf0] bg-[#f0f2f6] px-4 py-1.5 text-xs font-semibold text-[#2a3442]"><AlertCircle className="size-3.5 opacity-50" /> Total Pending <strong className="text-[#0b0e1a]">{pendingCount}</strong></span>
      </div>

      {typeFilter === 'tryout' ? (
        <TryoutSubmissionsPanel
          submissions={tryoutSubmissions}
          loading={loadingTryouts}
          grading={tryoutGrading}
          saving={tryoutSaving}
          saved={tryoutSaved}
          onGradingChange={onTryoutGradingChange}
          onSaveGrade={onTryoutSaveGrade}
        />
      ) : null}

      <Motion.section layout className={`mb-7 overflow-x-auto rounded-[1.25rem] border border-[#edf0f5] bg-white p-1 shadow-[0_2px_12px_rgba(0,0,0,0.02)]${typeFilter === 'tryout' ? ' hidden' : ''}`}>
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead><tr className="border-b border-[#edf0f5] bg-[#fafcff] text-left text-[10px] uppercase tracking-[0.04em] text-[#8e9aaf]"><th className="px-4 py-3">Student</th><th className="px-4 py-3">Assignment</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Action</th></tr></thead>
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

      {typeFilter !== 'tryout' && evaluationMode === 'bulk' ? (
        <Motion.section layout className="mb-7 rounded-[1.25rem] border border-[#edf0f5] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Bulk evaluation</p><h2 className="text-lg font-semibold">Enter marks for multiple students</h2></div><button type="button" onClick={saveBulkGrades} disabled={bulkSaving || visibleSubmissions.length === 0} className="rounded-full bg-blue-600 px-5 py-2 text-xs font-semibold text-white disabled:opacity-50">{bulkSaving ? 'Uploading...' : 'Apply Bulk Marks'}</button></div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#e2eaf2] bg-white"><table className="w-full min-w-[700px] text-xs"><thead className="bg-[#f0f6ff]"><tr><th className="px-3 py-2 text-left">Student</th><th className="px-3 py-2 text-left">Assignment</th><th className="px-3 py-2 text-left">Marks</th><th className="px-3 py-2 text-left">Feedback</th></tr></thead><tbody>{visibleSubmissions.map((submission) => { const draft = bulkDraft[submission.submissionId] || {}; return <tr key={submission.submissionId} className="border-t border-[#eef3fa]"><td className="px-3 py-2 font-semibold">{submission.studentName}</td><td className="px-3 py-2">{submission.assignmentTitle}</td><td className="px-3 py-2"><input type="number" min="0" max={submission.totalMarks} value={draft.marks ?? submission.score ?? ''} onChange={(event) => updateBulkDraft(submission.submissionId, 'marks', event.target.value)} className="w-24 rounded-full border border-[#dce3ec] px-3 py-1.5" /></td><td className="px-3 py-2"><input value={draft.feedback ?? submission.feedback ?? ''} onChange={(event) => updateBulkDraft(submission.submissionId, 'feedback', event.target.value)} placeholder="Optional feedback" className="w-full min-w-[220px] rounded-full border border-[#dce3ec] px-3 py-1.5" /></td></tr>; })}</tbody></table></div>
          {bulkError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{bulkError}</p>}{bulkSuccess && <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700">{bulkSuccess}</p>}
        </Motion.section>
      ) : typeFilter !== 'tryout' ? (
        <div className="mb-7 grid gap-6 lg:grid-cols-2">
          <Motion.section layout className="rounded-[1.25rem] border border-[#edf0f5] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] sm:p-7">
            <h2 className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#8e9aaf]"><User className="size-4 text-[#4f6f8f]" /> Teacher Evaluation</h2>
            {evaluationSubmission ? <div className="space-y-3">
              <div className="rounded-2xl border border-[#dce3ec] bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5f738f]">Student submission</p>
                  {evaluationSubmission.publishedByTeacher && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Published</span>
                  )}
                </div>
                {evaluationSubmission.submissionText ? (
                  <p className="max-h-52 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-[#1a304a]">{evaluationSubmission.submissionText}</p>
                ) : evaluationSubmission.attachmentUrl ? (
                  <a href={evaluationSubmission.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100">
                    <ExternalLink className="size-3.5" /> Open submitted PDF
                  </a>
                ) : (
                  <p className="text-xs text-[#6b7f9b]">No submitted text or file is available.</p>
                )}
              </div>
              <label className="flex items-center gap-3 text-xs font-medium text-[#4b5b73]"><span className="w-20">Student</span><select value={evaluationSubmission.submissionId} onChange={(event) => { const next = submissions.find((item) => item.submissionId === event.target.value); if (next) openSubmission(next); }} className="min-w-0 flex-1 rounded-full border border-[#dce3ec] bg-white px-3 py-2 text-sm"><option value={evaluationSubmission.submissionId}>{evaluationSubmission.studentName}</option>{submissions.filter((item) => item.submissionId !== evaluationSubmission.submissionId).slice(0, 8).map((item) => <option key={item.submissionId} value={item.submissionId}>{item.studentName}</option>)}</select></label>
              <label className="flex items-center gap-3 text-xs font-medium text-[#4b5b73]"><span className="w-20">Assignment</span><input value={evaluationSubmission.assignmentTitle || ''} readOnly className="min-w-0 flex-1 rounded-full border border-[#dce3ec] bg-white px-3 py-2 text-sm" /></label>
              <label className="flex items-center gap-3 text-xs font-medium text-[#4b5b73]"><span className="w-20">Type</span><input value={evaluationSubmission.type || evaluationSubmission.assignmentType || 'Assignment'} readOnly className="min-w-0 flex-1 rounded-full border border-[#dce3ec] bg-white px-3 py-2 text-sm" /></label>
              <label className="flex items-center gap-3 text-xs font-medium text-[#4b5b73]"><span className="w-20">Score</span><input type="number" min="0" max={evaluationSubmission.totalMarks} value={marks || (evaluationSubmission.score ?? '')} onChange={(event) => setMarks(event.target.value)} className="min-w-0 flex-1 rounded-full border border-[#dce3ec] bg-white px-3 py-2 text-sm" /></label>
              <label className="flex items-start gap-3 text-xs font-medium text-[#4b5b73]"><span className="w-20 pt-2">Feedback</span><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Write your detailed feedback here..." rows="4" className="min-w-0 flex-1 resize-y rounded-2xl border border-[#dce3ec] bg-white px-3 py-2 text-sm" /></label>
              {saveError && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{saveError}</p>}
              {publishError && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{publishError}</p>}
              {publishSuccess && <p className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{publishSuccess}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={saveGrade} disabled={saving || !selected || marks === ''} className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/15 disabled:opacity-50">{saving ? <Loader className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5" />} Apply & Save</button>
                <button type="button" onClick={publishSelectedGrade} disabled={publishing || !selected || selected.score === null || selected.score === undefined || selected.publishedByTeacher} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/15 disabled:opacity-50">{publishing ? <Loader className="size-3.5 animate-spin" /> : <Share2 className="size-3.5" />} {selected?.publishedByTeacher ? 'Published' : 'Publish Result'}</button>
                <button type="button" onClick={closePanel} className="inline-flex items-center gap-2 rounded-full border border-[#dce3ec] bg-white px-5 py-2.5 text-xs font-semibold"><X className="size-3.5" /> Close</button>
              </div>
            </div> : <div className="rounded-2xl border border-dashed border-[#dce3ec] bg-white p-8 text-center text-sm text-[#5f738f]">Select a submission above to evaluate it.</div>}
          </Motion.section>

          <Motion.section layout className="rounded-[1.25rem] border border-[#edf0f5] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] sm:p-7">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#8e9aaf]"><Sparkles className="size-4 text-[#4f6f8f]" /> AI Suggested Feedback</h2>
            <div className="rounded-[1.1rem] border border-[#edf0f5] bg-[#fafcff] p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2"><Sparkles className="size-5 text-green-500" /><strong className="text-sm text-green-900">Detailed AI Analysis</strong><span className="ml-auto rounded-full border border-[#e2eaf2] bg-white px-3 py-1 text-[10px] text-[#6b7f9b]">{evaluationSubmission ? formatDate(evaluationSubmission.submittedAt) : 'Ready'}</span></div>
              {!evaluationSubmission ? (
                <p className="text-xs leading-5 text-[#4b5b73]">Select a submission to see whether an AI rubric review is available.</p>
              ) : evaluationSubmission.aiGradingStatus === 'done' ? (
                <>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-[#e8eef6] bg-white p-3">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#5f738f]"><Target className="mr-1 inline size-3 text-blue-600" /> Rubric feedback</p>
                      <p className="whitespace-pre-wrap text-xs leading-5 text-[#1a304a]">{evaluationSubmission.aiGradingFeedback || 'No written AI feedback was returned.'}</p>
                    </div>
                    <div className="rounded-2xl border border-[#e8eef6] bg-[#f8fafc] p-3">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#5f738f]"><Award className="mr-1 inline size-3 text-amber-500" /> Suggested score</p>
                      <span className="text-xl font-bold text-green-600">{evaluationSubmission.aiScore}/{evaluationSubmission.totalMarks || 100}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setMarks(String(evaluationSubmission.aiScore ?? '')); setFeedback(evaluationSubmission.aiGradingFeedback || ''); }} className="mt-4 rounded-full border border-blue-200 bg-blue-600 px-4 py-1.5 text-xs font-medium text-white">Apply AI suggestion</button>
                </>
              ) : evaluationSubmission.aiGradingStatus === 'pending' ? (
                <p className="flex items-center gap-2 text-xs text-[#4b5b73]"><Loader className="size-4 animate-spin text-green-600" /> AI rubric review is still processing. Refresh submissions shortly.</p>
              ) : evaluationSubmission.aiGradingStatus === 'failed' ? (
                <p className="text-xs leading-5 text-red-700">AI rubric review failed. Grade this submission manually.</p>
              ) : (
                <p className="text-xs leading-5 text-[#4b5b73]">AI review was not requested for this assignment. Enable essay rubric review when creating a text assignment to receive a suggestion.</p>
              )}
            </div>
          </Motion.section>
        </div>
      ) : null}

      <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#eaf0f8] bg-white px-5 py-4 shadow-sm"><div className="flex items-center gap-2 text-sm font-semibold"><Calendar className="size-5 text-blue-600" /> Upcoming Deadlines</div><div className="flex flex-wrap gap-2">{assignments.filter((assignment) => assignment?.dueDate).slice(0, 4).map((assignment) => <span key={assignment._id} className="rounded-full bg-[#f1f5f9] px-3 py-1.5 text-[11px] font-medium">{formatDate(assignment.dueDate)} · {assignment.title}</span>)}{assignments.length === 0 && <span className="text-xs text-[#6b7f9b]">No upcoming assignments</span>}</div></section>

      <footer className="flex flex-wrap justify-between gap-3 border-t border-[#ecf2f9] pt-4 text-[11px] text-[#6b7f9b]"><span><Clock className="mr-1 inline size-3" /> Last AI evaluation: {latestSubmissionDate ? formatDate(latestSubmissionDate) : 'Not yet'}</span><span><CheckCircle className="mr-1 inline size-3 text-blue-600" /> {gradedCount} of {submissions.length} evaluated</span><span><Sparkles className="mr-1 inline size-3 text-green-500" /> {aiEvaluatedCount} AI assisted</span><span><Layers className="mr-1 inline size-3" /> 5 types supported</span><span className="text-red-600"><Clock className="mr-1 inline size-3" /> {pendingCount} pending total</span></footer>
    </Motion.div>
  );
};


// ── shared field-label class ──────────────────────────────────────────────────
const FL = 'text-[0.8rem] font-medium text-[#1f384b] flex items-center gap-1.5 mb-1.5';
const FH = 'text-[0.7rem] font-normal text-[#7a92a8] ml-auto';
// ── shared input class ────────────────────────────────────────────────────────
const FI = 'w-full px-3.5 py-[0.58rem] rounded-xl border border-[rgba(180,198,215,0.45)] bg-white/70 backdrop-blur-sm text-sm text-[#0a1e2e] placeholder-[#a5b9cc] transition-all focus:outline-none focus:border-[#2a7de1] focus:shadow-[0_0_0_4px_rgba(42,125,225,0.08)] focus:bg-white/90';
const FS = `${FI} appearance-none cursor-pointer bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238aa0b5' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_1rem_center] bg-[length:12px_8px] pr-10`;

// Create Assignment Modal Component
const CreateAssignmentModal = ({
  onClose, setShowModal, inline = false,
  newAssignment, handleChange, handleCreate,
  classSectionOptions, sessionOptions, subjectOptions, setNewAssignment, uploadingPdf, handlePdfUpload,
  removePdfAttachment, loading, error, activeSessionId,
  availableLessonPlans, availableLessonPlanChapters, lessonPlanError,
  aiGeneratingAssignment, aiAssignmentError, aiAssignmentGrounded, handleGenerateAssignmentDraft
}) => {
  const handleClose = onClose ?? (() => setShowModal?.(false));
  const statusDot = newAssignment.status === 'active' ? '#22c55e' : '#f5b342';
  const statusLabel = newAssignment.status === 'active' ? 'Live' : 'Draft';

  /* ── glass card shell ── */
  const cardCls = inline
    ? 'w-full rounded-[2rem] border border-white/50 bg-white/[0.72] backdrop-blur-[18px] [box-shadow:0_20px_50px_rgba(0,20,40,0.08),0_8px_24px_rgba(0,20,40,0.04),inset_0_1px_0_rgba(255,255,255,0.6)] px-10 pt-9 pb-11'
    : 'w-full max-w-2xl rounded-[2rem] border border-white/50 bg-white/[0.72] backdrop-blur-[18px] [box-shadow:0_20px_50px_rgba(0,20,40,0.08),0_8px_24px_rgba(0,20,40,0.04),inset_0_1px_0_rgba(255,255,255,0.6)] max-h-[90vh] overflow-y-auto px-8 pt-8 pb-10';

  const inner = (
    <div className={cardCls}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-7">
        <div className="flex items-center gap-3">
          {/* pen-fancy icon approximation */}
          <div className="w-10 h-10 rounded-[14px] flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#2a7de1 0%,#1a5bb5 100%)', boxShadow: '0 4px 12px rgba(42,125,225,0.3)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-[1.05rem] font-bold leading-tight" style={{ color: '#0a1e2e' }}>Create New Assignment</h2>
            <p className="text-[11px] mt-0.5" style={{ color: '#7a92a8' }}>· manage without leaving</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateAssignmentDraft}
            disabled={aiGeneratingAssignment || !newAssignment.classId || !newAssignment.sectionId || !newAssignment.subject}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-[60px] border transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-px"
            style={{ background: 'linear-gradient(135deg,#eef4fe,#e1eaff)', border: '1px solid rgba(42,125,225,0.2)', color: '#1a5bb5' }}
            title={(!newAssignment.classId || !newAssignment.sectionId || !newAssignment.subject) ? 'Select class, section and subject first' : 'Generate draft from indexed lesson material'}
          >
            {aiGeneratingAssignment ? <Loader className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {aiGeneratingAssignment ? 'Generating…' : 'Generate draft'}
          </button>
          {!inline && (
            <button onClick={handleClose} className="p-2 rounded-xl transition-colors hover:bg-black/5" style={{ color: '#7a92a8' }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* AI feedback strip */}
      {(aiAssignmentError || aiAssignmentGrounded) && (
        <div className="mb-5">
          {aiAssignmentError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-600">{aiAssignmentError}</p>}
          {aiAssignmentGrounded && <p role="status" className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700"><CheckCircle className="size-3.5" /> Draft generated from indexed class material. Review before publishing.</p>}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100 mb-5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <p className="text-xs text-red-600 font-medium flex-1">{error}</p>
        </div>
      )}

      <form onSubmit={handleCreate}>
        {/* ── Row 0: Session (full width) ── */}
        <div className="mb-5">
          <label className={FL}>Session <span className="text-red-500">*</span></label>
          <select
            name="academicYearId"
            value={newAssignment.academicYearId}
            onChange={(e) => {
              const sel = sessionOptions.find((o) => o.id === e.target.value);
              setNewAssignment((prev) => ({
                ...prev, academicYearId: e.target.value, sessionName: sel?.name || '',
                classId: '', sectionId: '', subject: '',
                sourceLessonPlanId: '', chapterId: '', chapterTitle: '', topicTitle: '', subTopicTitle: ''
              }));
            }}
            className={FS}
            required
          >
            <option value="">Select Session</option>
            {sessionOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {!activeSessionId && <p className="mt-1.5 text-[11px] text-red-500">Ask school admin to activate a session before creating assignments.</p>}
        </div>

        {/* ── Row 1: Title (full width) ── */}
        <div className="mb-5">
          <label className={FL}>
            Assignment Title <span className="text-red-500">*</span>
            <span className={FH}>Required</span>
          </label>
          <input name="title" value={newAssignment.title} onChange={handleChange}
            type="text" placeholder="e.g., Quadratic Equations Problem Set"
            className={FI} required />
        </div>

        {/* ── Row 2: Class+Section | Subject ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={FL}>Class & Section <span className="text-red-500">*</span></label>
            <select
              name="classSection"
              value={newAssignment.classId && newAssignment.sectionId ? `${newAssignment.classId}-${newAssignment.sectionId}` : ''}
              onChange={(e) => {
                if (!e.target.value) { setNewAssignment(prev => ({ ...prev, classId: '', sectionId: '', subject: '', sourceLessonPlanId: '', chapterId: '', chapterTitle: '', topicTitle: '', subTopicTitle: '' })); return; }
                const [cId, sId] = e.target.value.split('-');
                setNewAssignment(prev => ({ ...prev, classId: cId, sectionId: sId, subject: '', sourceLessonPlanId: '', chapterId: '', chapterTitle: '', topicTitle: '', subTopicTitle: '' }));
              }}
              disabled={!newAssignment.academicYearId}
              className={`${FS} disabled:opacity-50 disabled:cursor-not-allowed`}
              required
            >
              <option value="">{newAssignment.academicYearId ? 'Select Class & Section' : 'Select Session First'}</option>
              {classSectionOptions.map((cs) => (
                <option key={`${cs.classId}-${cs.sectionId}`} value={`${cs.classId}-${cs.sectionId}`}>
                  Class {cs.className} – Section {cs.sectionName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={FL}>Subject <span className="text-red-500">*</span></label>
            <select name="subject" value={newAssignment.subject} onChange={handleChange}
              disabled={!newAssignment.classId || !newAssignment.sectionId || subjectOptions.length === 0}
              className={`${FS} disabled:opacity-50 disabled:cursor-not-allowed`} required>
              <option value="">{(!newAssignment.classId || !newAssignment.sectionId) ? 'Select Class First' : subjectOptions.length === 0 ? 'No Subjects Found' : 'Select Subject'}</option>
              {subjectOptions.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* ── Row 3: Lesson Plan | Chapter ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={FL}>Lesson Plan</label>
            <div className="flex gap-2">
              <select
                value={newAssignment.sourceLessonPlanId}
                onChange={(e) => setNewAssignment(prev => ({ ...prev, sourceLessonPlanId: e.target.value, chapterId: '', chapterTitle: '', subTopicTitle: '' }))}
                disabled={!newAssignment.subject || availableLessonPlans.length === 0}
                className={`${FS} flex-1 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="">{!newAssignment.subject ? 'Select Subject First' : availableLessonPlans.length === 0 ? 'No Plans Found' : 'Link Lesson Plan'}</option>
                {availableLessonPlans.map(p => <option key={toEntityId(p._id)} value={toEntityId(p._id)}>{p.title}</option>)}
              </select>
            </div>
            <p className="mt-1 text-[10px]" style={{ color: '#a5b9cc' }}>Tags this activity to a published lesson plan</p>
          </div>
          <div>
            <label className={FL}>Chapter {newAssignment.sourceLessonPlanId && <span className="text-red-500">*</span>}</label>
            <select
              value={newAssignment.chapterId}
              onChange={(e) => { const ch = availableLessonPlanChapters.find(c => c.id === e.target.value); setNewAssignment(prev => ({ ...prev, chapterId: ch?.id || '', chapterTitle: ch?.title || '' })); }}
              disabled={!newAssignment.sourceLessonPlanId}
              required={Boolean(newAssignment.sourceLessonPlanId)}
              className={`${FS} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <option value="">{newAssignment.sourceLessonPlanId ? 'Select Chapter' : 'Select Lesson Plan First'}</option>
              {availableLessonPlanChapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            {lessonPlanError && <p className="mt-1 text-[10px] text-red-500">{lessonPlanError}</p>}
          </div>
        </div>

        {/* ── Row 4: Topic | Activity Type ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={FL}>Topic</label>
            <input name="topic" value={newAssignment.topic} onChange={handleChange}
              type="text" placeholder="e.g., Algebra, Polynomials" className={FI} />
          </div>
          <div>
            <label className={FL}>Activity Type</label>
            <select name="type" value={newAssignment.type} onChange={handleChange} className={FS}>
              <option value="Assignment">Assignment</option>
              <option value="Quiz">Quiz</option>
              <option value="Exam">Exam</option>
              <option value="Project">Project</option>
              <option value="Homework">Homework</option>
              <option value="Worksheet">Worksheet</option>
              <option value="Essay">Essay</option>
            </select>
          </div>
        </div>

        {/* ── Row 5: Due Date | Publish Date ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={FL}>Due Date <span className="text-red-500">*</span></label>
            <input name="dueDate" value={newAssignment.dueDate} onChange={handleChange}
              type="date" className={FI} required />
          </div>
          <div>
            <label className={FL}>Publish Date <span className={FH}>Optional</span></label>
            <input name="publishDate" value={newAssignment.publishDate || ''} onChange={handleChange}
              type="date" className={FI} />
            <p className="mt-1 text-[10px]" style={{ color: '#a5b9cc' }}>Leave blank to publish immediately on activation</p>
          </div>
        </div>

        {/* ── Row 6: Total Marks | Time Limit ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={FL}>Total Marks <span className="text-red-500">*</span></label>
            <input name="marks" value={newAssignment.marks} onChange={handleChange}
              type="number" min="1" placeholder="100" className={FI} required />
          </div>
          <div>
            <label className={FL}>Time Limit <span className={FH}>Optional</span></label>
            <input name="timeLimit" value={newAssignment.timeLimit || ''} onChange={handleChange}
              type="text" placeholder="e.g., 45 min" className={FI} />
          </div>
        </div>

        {/* ── Row 7: Submission Format | Status ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={FL}>Submission Format <span className="text-red-500">*</span></label>
            <select name="submissionFormat" value={newAssignment.submissionFormat} onChange={handleChange} className={FS} required>
              <option value="text">Text Only</option>
              <option value="pdf">PDF Upload</option>
            </select>
          </div>
          <div>
            <label className={FL}>
              Status
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: newAssignment.status === 'active' ? '#dcfce7' : '#fef9c3', color: newAssignment.status === 'active' ? '#16a34a' : '#92400e' }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: statusDot }} />
                {statusLabel}
              </span>
            </label>
            <select name="status" value={newAssignment.status} onChange={handleChange} className={FS}>
              <option value="draft">Save as Draft</option>
              <option value="active">Publish Now</option>
            </select>
          </div>
        </div>

        {/* ── Row 8: Difficulty | Late Submissions ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={FL}>Difficulty</label>
            <select name="difficulty" value={newAssignment.difficulty} onChange={handleChange} className={FS}>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
          <div>
            <label className={FL}>Late Submissions</label>
            <div className="flex gap-2">
              <select
                value={newAssignment.lateSubmissions ? 'yes' : 'no'}
                onChange={(e) => setNewAssignment(prev => ({ ...prev, lateSubmissions: e.target.value === 'yes', lateSubmissionCutoff: e.target.value === 'no' ? '' : prev.lateSubmissionCutoff }))}
                className={`${FS} flex-1`}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
              {newAssignment.lateSubmissions && (
                <input name="lateSubmissionCutoff" value={newAssignment.lateSubmissionCutoff || ''}
                  onChange={handleChange} type="date"
                  className={`${FI} flex-1`}
                  title="Late submission cutoff date" />
              )}
            </div>
          </div>
        </div>

        {/* ── Groups (full width) ── */}
        <div className="mb-5">
          <label className={FL}>Assign to Groups <span className={FH}>Optional — leave blank for whole class</span></label>
          <div className="flex gap-2">
            <input name="groups" value={newAssignment.groups || ''} onChange={handleChange}
              type="text" placeholder="e.g., Group A, Group B"
              className={`${FI} flex-1`} />
            <button type="button"
              className="px-4 py-[0.58rem] text-[13px] font-semibold rounded-xl border border-[rgba(42,125,225,0.25)] whitespace-nowrap transition-all hover:bg-[#eef4fe]"
              style={{ color: '#2a7de1', background: 'rgba(255,255,255,0.8)' }}>
              Add Groups
            </button>
          </div>
        </div>

        {/* ── Description (full width) ── */}
        <div className="mb-5">
          <label className={FL}>Instructions / Description</label>
          <textarea name="description" value={newAssignment.description} onChange={handleChange}
            rows="3" placeholder="Provide detailed instructions for the assignment..."
            className={`${FI} resize-none`} />
        </div>

        {/* ── Grading Rubric (full width) ── */}
        <div className="mb-5">
          <label className={FL}>
            Grading Rubric
            <span className={FH}>Optional — enables AI essay assistance</span>
          </label>
          <div className="flex gap-2 mb-2">
            <textarea name="rubric" value={newAssignment.rubric} onChange={(e) => {
              const v = e.target.value;
              setNewAssignment(prev => ({ ...prev, rubric: v, isEssay: v.trim().length > 0 && prev.submissionFormat === 'text' }));
            }}
              rows="2" placeholder={'Accuracy and understanding\nUse of evidence\nClarity and organisation'}
              className={`${FI} resize-none flex-1`} />
            <button type="button"
              className="px-4 py-2 text-[13px] font-semibold rounded-xl border border-[rgba(42,125,225,0.25)] whitespace-nowrap self-start transition-all hover:bg-[#eef4fe]"
              style={{ color: '#2a7de1', background: 'rgba(255,255,255,0.8)' }}>
              Attach Rubric
            </button>
          </div>
          <p className="text-[10px]" style={{ color: '#a5b9cc' }}>Adding rubric criteria automatically enables AI-assisted essay review (teacher-only; students never receive AI scores directly).</p>
        </div>

        {/* ── File Upload zone ── */}
        <div className="mb-7">
          <label className={FL}>Attachments</label>
          <div
            className="rounded-2xl border-2 border-dashed p-7 text-center transition-colors hover:border-[#2a7de1] hover:bg-[#eef4fe]/40 cursor-pointer"
            style={{ borderColor: 'rgba(42,125,225,0.3)', background: 'rgba(255,255,255,0.5)' }}
          >
            {uploadingPdf ? (
              <div className="flex flex-col items-center gap-2">
                <Loader className="w-8 h-8 animate-spin" style={{ color: '#2a7de1' }} />
                <p className="text-xs" style={{ color: '#7a92a8' }}>Uploading…</p>
              </div>
            ) : (
              <>
                <Upload size={28} className="mx-auto mb-2" style={{ color: '#2a7de1' }} />
                <p className="text-[13px] font-medium mb-1" style={{ color: '#1f384b' }}>Drop files here or click to browse</p>
                <p className="text-[11px] mb-3" style={{ color: '#a5b9cc' }}>PDF, DOCX, images — up to 20 MB each</p>
                <input type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" id="pdf-upload-main" />
                <label htmlFor="pdf-upload-main"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-[13px] font-semibold rounded-[60px] cursor-pointer transition-all hover:-translate-y-px"
                  style={{ background: 'linear-gradient(135deg,#2a7de1,#1a5bb5)', color: '#fff', boxShadow: '0 4px 14px rgba(42,125,225,0.25)' }}>
                  <Upload size={13} /> Select File
                </label>
              </>
            )}
          </div>
          {newAssignment.attachments.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {newAssignment.attachments.map((att, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-emerald-600" />
                    <span className="text-xs text-emerald-700 font-medium truncate max-w-xs">{att.name}</span>
                  </div>
                  <button type="button" onClick={() => removePdfAttachment(idx)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Divider ── */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" style={{ borderColor: 'rgba(42,125,225,0.15)' }} />
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 text-[10px] font-bold tracking-widest uppercase"
              style={{ background: 'rgba(255,255,255,0.72)', color: '#2a7de1' }}>Review & Publish</span>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setNewAssignment(prev => ({
              ...prev, title: '', topic: '', description: '', dueDate: '', marks: 100,
              status: 'draft', timeLimit: '', publishDate: '',
              lateSubmissions: false, lateSubmissionCutoff: '',
              groups: '', rubric: '', isEssay: false, attachments: []
            }))}
            className="px-5 py-2.5 text-[13px] font-semibold rounded-[60px] border transition-all hover:bg-black/5 disabled:opacity-50"
            style={{ color: '#7a92a8', borderColor: 'rgba(180,198,215,0.4)', background: 'rgba(255,255,255,0.7)' }}
            disabled={loading}
          >
            Reset
          </button>
          <div className="flex items-center gap-2.5">
            {!inline && (
              <button type="button" onClick={handleClose}
                className="px-5 py-2.5 text-[13px] font-semibold rounded-[60px] border transition-all hover:bg-black/5 disabled:opacity-50"
                style={{ color: '#7a92a8', borderColor: 'rgba(180,198,215,0.4)', background: 'rgba(255,255,255,0.7)' }}
                disabled={loading}>
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !activeSessionId}
              className="px-7 py-2.5 text-[13px] font-semibold text-white rounded-[60px] transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              style={{ background: 'linear-gradient(135deg,#2a7de1 0%,#1a5bb5 100%)', boxShadow: '0 4px 14px rgba(42,125,225,0.25)' }}
            >
              {loading ? 'Creating…' : newAssignment.status === 'active' ? 'Create & Publish' : 'Save as Draft'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  if (inline) return inner;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,10,20,0.35)', backdropFilter: 'blur(6px)' }}>
      {inner}
    </div>
  );
};

// ─── Shared class/subject/lesson pickers used by worksheet & writing forms ────
const ClassSubjectPickers = ({ newAssignment, setNewAssignment, sessionOptions, classSectionOptions, subjectOptions, availableLessonPlans, availableLessonPlanChapters, lessonPlanError, activeSessionId, accent }) => {
  const border = `border-${accent}-200`;
  const focus = `focus:ring-${accent}-400/20 focus:border-${accent}-400`;
  const cls = `w-full px-3 py-2 text-sm bg-gray-50 border-[2px] ${border} rounded-xl ${focus} transition-colors`;
  const disabledCls = `${cls} disabled:bg-gray-100 disabled:text-gray-400`;
  return (
    <>
      <div className="md:col-span-2">
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Session <span className="text-red-500">*</span></label>
        <select name="academicYearId" value={newAssignment.academicYearId} onChange={e => { const s = sessionOptions.find(o => o.id === e.target.value); setNewAssignment(p => ({ ...p, academicYearId: e.target.value, sessionName: s?.name || '', classId: '', sectionId: '', subject: '', sourceLessonPlanId: '', chapterId: '', chapterTitle: '', topicTitle: '', subTopicTitle: '' })); }} className={cls} required>
          <option value="">Select Session</option>
          {sessionOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {!activeSessionId && <p className="mt-1 text-[11px] text-red-500">Ask school admin to activate a session first.</p>}
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Class & Section <span className="text-red-500">*</span></label>
        <select name="classSection" value={newAssignment.classId && newAssignment.sectionId ? `${newAssignment.classId}-${newAssignment.sectionId}` : ''} onChange={e => { if (!e.target.value) { setNewAssignment(p => ({ ...p, classId: '', sectionId: '', subject: '', sourceLessonPlanId: '', chapterId: '', chapterTitle: '', topicTitle: '', subTopicTitle: '' })); return; } const [cId, sId] = e.target.value.split('-'); setNewAssignment(p => ({ ...p, classId: cId, sectionId: sId, subject: '', sourceLessonPlanId: '', chapterId: '', chapterTitle: '', topicTitle: '', subTopicTitle: '' })); }} disabled={!newAssignment.academicYearId} className={disabledCls} required>
          <option value="">{newAssignment.academicYearId ? 'Select Class & Section' : 'Select Session First'}</option>
          {classSectionOptions.map(cs => <option key={`${cs.classId}-${cs.sectionId}`} value={`${cs.classId}-${cs.sectionId}`}>Class {cs.className} - Section {cs.sectionName}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subject <span className="text-red-500">*</span></label>
        <select name="subject" value={newAssignment.subject} onChange={e => setNewAssignment(p => ({ ...p, subject: e.target.value, sourceLessonPlanId: '', chapterId: '', chapterTitle: '', topicTitle: '', subTopicTitle: '' }))} disabled={!newAssignment.classId || subjectOptions.length === 0} className={disabledCls} required>
          <option value="">{!newAssignment.classId ? 'Select Class First' : subjectOptions.length === 0 ? 'No Subjects Found' : 'Select Subject'}</option>
          {subjectOptions.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Lesson Plan</label>
        <select value={newAssignment.sourceLessonPlanId} onChange={e => setNewAssignment(p => ({ ...p, sourceLessonPlanId: e.target.value, chapterId: '', chapterTitle: '', subTopicTitle: '' }))} disabled={!newAssignment.subject || availableLessonPlans.length === 0} className={disabledCls}>
          <option value="">{!newAssignment.subject ? 'Select Subject First' : availableLessonPlans.length === 0 ? 'No Published Plans' : 'Select Lesson Plan (optional)'}</option>
          {availableLessonPlans.map(p => <option key={String(p._id)} value={String(p._id)}>{p.title}</option>)}
        </select>
        {lessonPlanError && <p className="mt-1 text-[11px] text-red-500">{lessonPlanError}</p>}
      </div>
      {newAssignment.sourceLessonPlanId && (
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Chapter</label>
          <select value={newAssignment.chapterId || ''} onChange={e => { const ch = availableLessonPlanChapters.find(c => c.id === e.target.value); setNewAssignment(p => ({ ...p, chapterId: e.target.value, chapterTitle: ch?.title || '', topicTitle: ch?.title || '', subTopicTitle: '' })); }} disabled={availableLessonPlanChapters.length === 0} className={disabledCls}>
            <option value="">Select Chapter (optional)</option>
            {availableLessonPlanChapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      )}
    </>
  );
};

// Worksheet Form Component
const CreateWorksheetForm = ({
  onClose, newAssignment, handleChange, handleCreate, setNewAssignment,
  classSectionOptions, sessionOptions, subjectOptions,
  loading, error, activeSessionId,
  availableLessonPlans, availableLessonPlanChapters, lessonPlanError,
  uploadingPdf, handlePdfUpload, removePdfAttachment,
  aiGeneratingAssignment, aiAssignmentError, aiAssignmentGrounded, handleGenerateAssignmentDraft
}) => {
  const statusDotW = newAssignment.status === 'active' ? '#22c55e' : '#f5b342';
  const statusLabelW = newAssignment.status === 'active' ? 'Live' : 'Draft';
  return (
    <div className="w-full rounded-[2rem] border border-white/50 bg-white/[0.72] backdrop-blur-[18px] [box-shadow:0_20px_50px_rgba(0,20,40,0.08),0_8px_24px_rgba(0,20,40,0.04),inset_0_1px_0_rgba(255,255,255,0.6)] px-10 pt-9 pb-11">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-7">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[14px] flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}>
            <BookOpen size={18} color="white" />
          </div>
          <div>
            <h2 className="text-[1.05rem] font-bold leading-tight" style={{ color: '#0a1e2e' }}>Create New Worksheet</h2>
            <p className="text-[11px] mt-0.5" style={{ color: '#7a92a8' }}>· manage without leaving</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleGenerateAssignmentDraft}
          disabled={aiGeneratingAssignment || !newAssignment.classId || !newAssignment.sectionId || !newAssignment.subject}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-[60px] border transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-px"
          style={{ background: 'linear-gradient(135deg,#eef4fe,#e1eaff)', border: '1px solid rgba(42,125,225,0.2)', color: '#1a5bb5' }}
          title={(!newAssignment.classId || !newAssignment.sectionId || !newAssignment.subject) ? 'Select class, section and subject first' : 'Generate draft from indexed lesson material'}
        >
          {aiGeneratingAssignment ? <Loader className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {aiGeneratingAssignment ? 'Generating…' : 'Generate draft'}
        </button>
      </div>

      {/* AI feedback */}
      {(aiAssignmentError || aiAssignmentGrounded) && (
        <div className="mb-5">
          {aiAssignmentError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-600">{aiAssignmentError}</p>}
          {aiAssignmentGrounded && <p role="status" className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700"><CheckCircle className="size-3.5" /> Draft generated from indexed class material. Review before publishing.</p>}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100 mb-5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <p className="text-xs text-red-600 font-medium flex-1">{error}</p>
        </div>
      )}

      <form onSubmit={handleCreate}>
        {/* Session */}
        <div className="mb-5">
          <label className={FL}>Session <span className="text-red-500">*</span></label>
          <select name="academicYearId" value={newAssignment.academicYearId}
            onChange={(e) => { const s = sessionOptions.find(o => o.id === e.target.value); setNewAssignment(p => ({ ...p, academicYearId: e.target.value, sessionName: s?.name || '', classId: '', sectionId: '', subject: '', sourceLessonPlanId: '', chapterId: '', chapterTitle: '', topicTitle: '', subTopicTitle: '' })); }}
            className={FS} required>
            <option value="">Select Session</option>
            {sessionOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {!activeSessionId && <p className="mt-1.5 text-[11px] text-red-500">Ask school admin to activate a session before creating worksheets.</p>}
        </div>

        {/* Title */}
        <div className="mb-5">
          <label className={FL}>Worksheet Title <span className="text-red-500">*</span> <span className={FH}>Required</span></label>
          <input name="title" value={newAssignment.title} onChange={handleChange}
            type="text" placeholder="e.g., Water Cycle Practice Worksheet"
            className={FI} required />
        </div>

        {/* Class+Section | Subject */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={FL}>Class & Section <span className="text-red-500">*</span></label>
            <select name="classSection"
              value={newAssignment.classId && newAssignment.sectionId ? `${newAssignment.classId}-${newAssignment.sectionId}` : ''}
              onChange={(e) => { if (!e.target.value) { setNewAssignment(p => ({ ...p, classId: '', sectionId: '', subject: '', sourceLessonPlanId: '', chapterId: '', chapterTitle: '', topicTitle: '', subTopicTitle: '' })); return; } const [cId, sId] = e.target.value.split('-'); setNewAssignment(p => ({ ...p, classId: cId, sectionId: sId, subject: '', sourceLessonPlanId: '', chapterId: '', chapterTitle: '', topicTitle: '', subTopicTitle: '' })); }}
              disabled={!newAssignment.academicYearId}
              className={`${FS} disabled:opacity-50 disabled:cursor-not-allowed`} required>
              <option value="">{newAssignment.academicYearId ? 'Select Class & Section' : 'Select Session First'}</option>
              {classSectionOptions.map(cs => <option key={`${cs.classId}-${cs.sectionId}`} value={`${cs.classId}-${cs.sectionId}`}>Class {cs.className} – Section {cs.sectionName}</option>)}
            </select>
          </div>
          <div>
            <label className={FL}>Subject <span className="text-red-500">*</span></label>
            <select name="subject" value={newAssignment.subject}
              onChange={e => setNewAssignment(p => ({ ...p, subject: e.target.value, sourceLessonPlanId: '', chapterId: '', chapterTitle: '', topicTitle: '', subTopicTitle: '' }))}
              disabled={!newAssignment.classId || !newAssignment.sectionId || subjectOptions.length === 0}
              className={`${FS} disabled:opacity-50 disabled:cursor-not-allowed`} required>
              <option value="">{(!newAssignment.classId || !newAssignment.sectionId) ? 'Select Class First' : subjectOptions.length === 0 ? 'No Subjects Found' : 'Select Subject'}</option>
              {subjectOptions.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Lesson Plan | Chapter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={FL}>Lesson Plan</label>
            <select value={newAssignment.sourceLessonPlanId}
              onChange={e => setNewAssignment(p => ({ ...p, sourceLessonPlanId: e.target.value, chapterId: '', chapterTitle: '', subTopicTitle: '' }))}
              disabled={!newAssignment.subject || availableLessonPlans.length === 0}
              className={`${FS} disabled:opacity-50 disabled:cursor-not-allowed`}>
              <option value="">{!newAssignment.subject ? 'Select Subject First' : availableLessonPlans.length === 0 ? 'No Plans Found' : 'Link Lesson Plan'}</option>
              {availableLessonPlans.map(p => <option key={String(p._id)} value={String(p._id)}>{p.title}</option>)}
            </select>
            {lessonPlanError && <p className="mt-1 text-[10px] text-red-500">{lessonPlanError}</p>}
          </div>
          <div>
            <label className={FL}>Chapter</label>
            <select value={newAssignment.chapterId || ''}
              onChange={e => { const ch = availableLessonPlanChapters.find(c => c.id === e.target.value); setNewAssignment(p => ({ ...p, chapterId: e.target.value, chapterTitle: ch?.title || '' })); }}
              disabled={!newAssignment.sourceLessonPlanId || availableLessonPlanChapters.length === 0}
              className={`${FS} disabled:opacity-50 disabled:cursor-not-allowed`}>
              <option value="">{newAssignment.sourceLessonPlanId ? 'Select Chapter' : 'Select Lesson Plan First'}</option>
              {availableLessonPlanChapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        </div>

        {/* Topic | Activity Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={FL}>Topic</label>
            <input name="topic" value={newAssignment.topic} onChange={handleChange}
              type="text" placeholder="e.g., Water Cycle, Photosynthesis" className={FI} />
          </div>
          <div>
            <label className={FL}>Difficulty</label>
            <select name="difficulty" value={newAssignment.difficulty} onChange={handleChange} className={FS}>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>

        {/* Due Date | Publish Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={FL}>Due Date <span className="text-red-500">*</span></label>
            <input name="dueDate" value={newAssignment.dueDate} onChange={handleChange}
              type="date" className={FI} required />
          </div>
          <div>
            <label className={FL}>Publish Date <span className={FH}>Optional</span></label>
            <input name="publishDate" value={newAssignment.publishDate || ''} onChange={handleChange}
              type="date" className={FI} />
          </div>
        </div>

        {/* Total Marks | Time Limit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={FL}>Total Marks <span className="text-red-500">*</span></label>
            <input name="marks" value={newAssignment.marks} onChange={handleChange}
              type="number" min="1" placeholder="100" className={FI} required />
          </div>
          <div>
            <label className={FL}>Time Limit <span className={FH}>Optional</span></label>
            <input name="timeLimit" value={newAssignment.timeLimit || ''} onChange={handleChange}
              type="text" placeholder="e.g., 45 min" className={FI} />
          </div>
        </div>

        {/* Status | Late Submissions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={FL}>
              Status
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: newAssignment.status === 'active' ? '#dcfce7' : '#fef9c3', color: newAssignment.status === 'active' ? '#16a34a' : '#92400e' }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: statusDotW }} />
                {statusLabelW}
              </span>
            </label>
            <select name="status" value={newAssignment.status} onChange={handleChange} className={FS}>
              <option value="draft">Save as Draft</option>
              <option value="active">Publish Now</option>
            </select>
          </div>
          <div>
            <label className={FL}>Late Submissions</label>
            <div className="flex gap-2">
              <select
                value={newAssignment.lateSubmissions ? 'yes' : 'no'}
                onChange={e => setNewAssignment(prev => ({ ...prev, lateSubmissions: e.target.value === 'yes', lateSubmissionCutoff: e.target.value === 'no' ? '' : prev.lateSubmissionCutoff }))}
                className={`${FS} flex-1`}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
              {newAssignment.lateSubmissions && (
                <input name="lateSubmissionCutoff" value={newAssignment.lateSubmissionCutoff || ''}
                  onChange={handleChange} type="date" className={`${FI} flex-1`} title="Late submission cutoff" />
              )}
            </div>
          </div>
        </div>

        {/* Groups */}
        <div className="mb-5">
          <label className={FL}>Assign to Groups <span className={FH}>Optional — leave blank for whole class</span></label>
          <div className="flex gap-2">
            <input name="groups" value={newAssignment.groups || ''} onChange={handleChange}
              type="text" placeholder="e.g., Group A, Group B" className={`${FI} flex-1`} />
            <button type="button"
              className="px-4 py-[0.58rem] text-[13px] font-semibold rounded-xl border border-[rgba(42,125,225,0.25)] whitespace-nowrap transition-all hover:bg-[#eef4fe]"
              style={{ color: '#2a7de1', background: 'rgba(255,255,255,0.8)' }}>
              Add Groups
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-5">
          <label className={FL}>Instructions / Description</label>
          <textarea name="description" value={newAssignment.description} onChange={handleChange}
            rows="4" placeholder="Describe what students need to complete in this worksheet — questions, tasks, or exercises…"
            className={`${FI} resize-none`} />
        </div>

        {/* File Upload */}
        <div className="mb-7">
          <label className={FL}>Attachments</label>
          <div
            className="rounded-2xl border-2 border-dashed p-7 text-center transition-colors hover:border-[#2a7de1] hover:bg-[#eef4fe]/40 cursor-pointer"
            style={{ borderColor: 'rgba(42,125,225,0.3)', background: 'rgba(255,255,255,0.5)' }}
          >
            {uploadingPdf ? (
              <div className="flex flex-col items-center gap-2">
                <Loader className="w-8 h-8 animate-spin" style={{ color: '#2a7de1' }} />
                <p className="text-xs" style={{ color: '#7a92a8' }}>Uploading…</p>
              </div>
            ) : (
              <>
                <Upload size={28} className="mx-auto mb-2" style={{ color: '#2a7de1' }} />
                <p className="text-[13px] font-medium mb-1" style={{ color: '#1f384b' }}>Drop files here or click to browse</p>
                <p className="text-[11px] mb-3" style={{ color: '#a5b9cc' }}>PDF, DOCX, images — up to 20 MB each</p>
                <input type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" id="pdf-upload-ws" />
                <label htmlFor="pdf-upload-ws"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-[13px] font-semibold rounded-[60px] cursor-pointer transition-all hover:-translate-y-px"
                  style={{ background: 'linear-gradient(135deg,#2a7de1,#1a5bb5)', color: '#fff', boxShadow: '0 4px 14px rgba(42,125,225,0.25)' }}>
                  <Upload size={13} /> Select File
                </label>
              </>
            )}
          </div>
          {newAssignment.attachments?.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {newAssignment.attachments.map((att, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-emerald-600" />
                    <span className="text-xs text-emerald-700 font-medium truncate max-w-xs">{att.name}</span>
                  </div>
                  <button type="button" onClick={() => removePdfAttachment?.(idx)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" style={{ borderColor: 'rgba(42,125,225,0.15)' }} />
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 text-[10px] font-bold tracking-widest uppercase"
              style={{ background: 'rgba(255,255,255,0.72)', color: '#2a7de1' }}>Review & Publish</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <button type="button"
            onClick={() => setNewAssignment(prev => ({ ...prev, title: '', topic: '', description: '', dueDate: '', marks: 100, status: 'draft', timeLimit: '', publishDate: '', lateSubmissions: false, lateSubmissionCutoff: '', groups: '', attachments: [] }))}
            className="px-5 py-2.5 text-[13px] font-semibold rounded-[60px] border transition-all hover:bg-black/5 disabled:opacity-50"
            style={{ color: '#7a92a8', borderColor: 'rgba(180,198,215,0.4)', background: 'rgba(255,255,255,0.7)' }}
            disabled={loading}>
            Reset
          </button>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 text-[13px] font-semibold rounded-[60px] border transition-all hover:bg-black/5 disabled:opacity-50"
              style={{ color: '#7a92a8', borderColor: 'rgba(180,198,215,0.4)', background: 'rgba(255,255,255,0.7)' }}
              disabled={loading}>
              Cancel
            </button>
            <button type="submit" disabled={loading || !activeSessionId}
              className="px-7 py-2.5 text-[13px] font-semibold text-white rounded-[60px] transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              style={{ background: 'linear-gradient(135deg,#2a7de1 0%,#1a5bb5 100%)', boxShadow: '0 4px 14px rgba(42,125,225,0.25)' }}>
              {loading ? 'Creating…' : newAssignment.status === 'active' ? 'Create & Publish' : 'Save as Draft'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

// Writing / Essay Form Component
const CreateWritingForm = ({
  onClose, newAssignment, handleChange, handleCreate, setNewAssignment,
  classSectionOptions, sessionOptions, subjectOptions,
  loading, error, activeSessionId,
  availableLessonPlans, availableLessonPlanChapters, lessonPlanError,
  aiGeneratingAssignment, aiAssignmentError, aiAssignmentGrounded, handleGenerateAssignmentDraft
}) => (
  <div className="px-5 py-5">
    {error && (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
        <div className="size-1.5 shrink-0 rounded-full bg-red-500" />
        <p className="text-xs font-medium text-red-600 flex-1">{error}</p>
      </div>
    )}
    <form onSubmit={handleCreate} className="space-y-4">
      {/* AI banner */}
      <section className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-fuchsia-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-purple-600 shadow-sm"><Sparkles size={17} /></span>
            <div>
              <p className="text-xs font-bold text-purple-900">Generate writing task from lesson material</p>
              <p className="mt-0.5 text-[11px] leading-5 text-purple-700/75">Select class, subject &amp; chapter — AI will draft a writing prompt and grading rubric.</p>
            </div>
          </div>
          <button type="button" onClick={handleGenerateAssignmentDraft} disabled={aiGeneratingAssignment || !newAssignment.classId || !newAssignment.sectionId || !newAssignment.subject} title={(!newAssignment.classId || !newAssignment.sectionId || !newAssignment.subject) ? 'Select class, section and subject first' : 'Generate draft from indexed lesson material'} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-purple-200 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
            {aiGeneratingAssignment ? <Loader className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {aiGeneratingAssignment ? 'Generating…' : 'Generate draft'}
          </button>
        </div>
        {aiAssignmentError && <p className="mt-3 rounded-xl border border-rose-200 bg-white/80 px-3 py-2 text-[11px] font-medium text-rose-600">{aiAssignmentError}</p>}
        {aiAssignmentGrounded && <p role="status" className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700"><CheckCircle className="size-3.5" /> Draft generated from indexed class material.</p>}
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ClassSubjectPickers newAssignment={newAssignment} setNewAssignment={setNewAssignment} sessionOptions={sessionOptions} classSectionOptions={classSectionOptions} subjectOptions={subjectOptions} availableLessonPlans={availableLessonPlans} availableLessonPlanChapters={availableLessonPlanChapters} lessonPlanError={lessonPlanError} activeSessionId={activeSessionId} accent="purple" />

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Writing Task Title <span className="text-red-500">*</span></label>
          <input name="title" value={newAssignment.title} onChange={handleChange} type="text" placeholder="e.g., Descriptive Essay — My Favourite Place" className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400 transition-colors" required />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Writing Prompt <span className="text-red-500">*</span></label>
          <textarea name="description" value={newAssignment.description} onChange={handleChange} rows={5} placeholder="Write the exact prompt students will respond to. Be specific — e.g., 'Describe a place that is special to you. Use at least three sensory details.'" className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400 transition-colors resize-none" required />
          <p className="mt-1 text-[11px] text-gray-400">Students will see this prompt exactly as written.</p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Grading Rubric <span className="ml-1 text-[11px] font-normal text-purple-600">(recommended)</span>
          </label>
          <textarea name="rubric" value={newAssignment.rubric} onChange={handleChange} rows={4} placeholder="e.g., Content &amp; Ideas — 30% | Structure &amp; Organisation — 25% | Vocabulary &amp; Language — 25% | Grammar &amp; Spelling — 20%" className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400 transition-colors resize-none" />
          <p className="mt-1 text-[11px] text-gray-400">Visible to students before submission and used for AI-assisted grading.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Total Marks</label>
          <input name="marks" value={newAssignment.marks} onChange={handleChange} type="number" min="1" max="200" className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400 transition-colors" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Due Date</label>
          <input name="dueDate" value={newAssignment.dueDate} onChange={handleChange} type="date" className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400 transition-colors" />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
          <select name="status" value={newAssignment.status} onChange={handleChange} className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400 transition-colors">
            <option value="draft">Save as Draft</option>
            <option value="active">Publish Immediately</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-purple-100">
        <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border-[2px] border-purple-200 rounded-xl hover:bg-gray-100 transition-colors">Cancel</button>
        <button type="submit" disabled={loading || !activeSessionId} className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-xl shadow-md shadow-purple-200 hover:shadow-lg disabled:opacity-50 transition-all">
          {loading ? 'Creating…' : newAssignment.status === 'active' ? 'Create & Publish' : 'Save Draft'}
        </button>
      </div>
    </form>
  </div>
);

// Assignment Detail Modal Component
const AssignmentDetailModal = ({
  selectedAssignment, setShowDetailModal,
  detailEditMode, setDetailEditMode, detailDraft, handleDetailDraftChange,
  handleUpdateAssignment, detailSaving, openAssignmentDetail,
  myClasses, globalSubjectOptions, lessonPlans, getStatusColor, getDifficultyColor,
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
  const detailLessonPlans = getScopedLessonPlans({
    plans: lessonPlans,
    classId: detailDraft.classId,
    sectionId: detailDraft.sectionId,
    subject: detailDraft.subject,
    classSections: myClasses,
  });
  const detailSelectedLessonPlan = detailLessonPlans.find(
    (plan) => toEntityId(plan?._id) === String(detailDraft.sourceLessonPlanId || '')
  );
  const detailLessonPlanChapters = getLessonPlanChapters(detailSelectedLessonPlan);
  const selectedLessonPlanTitle = selectedAssignment?.sourceLessonPlanId?.title || '';

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
                          handleDetailDraftChange('sourceLessonPlanId', '');
                          handleDetailDraftChange('chapterId', '');
                          handleDetailDraftChange('chapterTitle', '');
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
                        onChange={(e) => {
                          handleDetailDraftChange('subject', e.target.value);
                          handleDetailDraftChange('sourceLessonPlanId', '');
                          handleDetailDraftChange('chapterId', '');
                          handleDetailDraftChange('chapterTitle', '');
                        }}
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
                      <select
                        aria-label="Lesson Plan"
                        value={detailDraft.sourceLessonPlanId}
                        onChange={(event) => {
                          handleDetailDraftChange('sourceLessonPlanId', event.target.value);
                          handleDetailDraftChange('chapterId', '');
                          handleDetailDraftChange('chapterTitle', '');
                        }}
                        disabled={!detailDraft.subject || detailLessonPlans.length === 0}
                        className="w-full rounded-lg border-[2px] border-purple-300 px-3 py-2 text-sm text-gray-700 disabled:bg-gray-100"
                      >
                        <option value="">{detailLessonPlans.length ? 'Select Lesson Plan (Optional)' : 'No Published Lesson Plans Found'}</option>
                        {detailLessonPlans.map((plan) => (
                          <option key={toEntityId(plan._id)} value={toEntityId(plan._id)}>{plan.title}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Chapter"
                        value={detailDraft.chapterId}
                        onChange={(event) => {
                          const chapter = detailLessonPlanChapters.find((item) => item.id === event.target.value);
                          handleDetailDraftChange('chapterId', chapter?.id || '');
                          handleDetailDraftChange('chapterTitle', chapter?.title || '');
                        }}
                        disabled={!detailDraft.sourceLessonPlanId}
                        className="w-full rounded-lg border-[2px] border-purple-300 px-3 py-2 text-sm text-gray-700 disabled:bg-gray-100"
                      >
                        <option value="">Select Chapter</option>
                        {detailLessonPlanChapters.map((chapter) => (
                          <option key={chapter.id} value={chapter.id}>{chapter.title}</option>
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
                  <div className="space-y-3">
                    <p className="text-gray-700 leading-relaxed">{selectedAssignment.description}</p>
                    {selectedAssignment.chapterTitle && (
                      <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-500">Learning alignment</p>
                        <p className="mt-1 text-sm font-semibold text-violet-800">
                          {selectedLessonPlanTitle ? `${selectedLessonPlanTitle} · ` : ''}{selectedAssignment.chapterTitle}
                        </p>
                      </div>
                    )}
                  </div>
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
