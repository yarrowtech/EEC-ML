import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Clock,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  Book,
  BookOpen,
  FileText,
  Download,
  Search as SearchIcon,
  ChevronRight,
  Star,
  SendHorizonal,
  Paperclip,
  Award,
  Upload,
  FlaskConical,
  GraduationCap,
  Target,
  Lightbulb,
  EyeOff,
  Inbox,
  Loader2,
  Layers,
  Terminal,
  Calculator,
  Globe,
  Paintbrush,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Eye,
  Trash2,
  LifeBuoy,
  CalendarClock
} from "lucide-react";
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { addPoints, hasAward, markAwarded } from '../utils/points';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchCachedJson, clearStudentApiCacheByUrl } from '../utils/studentApiCache';

const LAB_EXPERIMENTS = [
  // ... (your LAB_EXPERIMENTS array here - unchanged)
];

/* Solid-surface primitives (white cards, soft shadow, violet accent — no blur, matches the app's real sidebar/header chrome). */
const SURFACE_CARD = 'rounded-3xl border border-violet-100 bg-white shadow-[0_2px_16px_rgba(79,70,229,0.06)]';
const SURFACE_INNER = 'rounded-xl border border-violet-100 bg-violet-50/50';
const SURFACE_HOVER = 'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(139,92,246,0.12)]';

const Assignment = ({ assignmentType }) => {
  const location = useLocation();
  const [schoolSearch, setSchoolSearch] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [expandedChapter, setExpandedChapter] = useState(null);
  const [detailBackLabel, setDetailBackLabel] = useState('');
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFileUrl, setSubmissionFileUrl] = useState('');
  const [submissionFileName, setSubmissionFileName] = useState('');
  const [submissionFileSize, setSubmissionFileSize] = useState(0);
  const [uploadingSubmissionFile, setUploadingSubmissionFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000')
    .replace(/\/$/, '')
    .replace(/\/api$/, '');
  const API_BASE_URL = `${API_BASE}`;
  const ASSIGNMENTS_CACHE_TTL_MS = 2 * 60 * 1000;
  const ASSIGNMENTS_ENDPOINT = `${API_BASE_URL}/api/assignment/student/assignments`;

  // Flashcard state
  const [flashDeck, setFlashDeck] = useState([]);
  const [flashIndex, setFlashIndex] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);
  const [flashKnown, setFlashKnown] = useState({});
  const [flashShuffle, setFlashShuffle] = useState(false);

  // EEC / Practice state
  const [selectedClass, setSelectedClass] = useState("6");
  const [practiceMeta, setPracticeMeta] = useState(null);
  const [practiceSubjectId, setPracticeSubjectId] = useState("");
  const [practiceType, setPracticeType] = useState("mcq");
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [practiceAnswers, setPracticeAnswers] = useState({});
  const [practiceResults, setPracticeResults] = useState(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceSubmitting, setPracticeSubmitting] = useState(false);
  const [practiceError, setPracticeError] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);

  // Lab state
  const labContainerRef = useRef(null);
  const labRendererRef = useRef(null);
  const labSceneRef = useRef(null);
  const labCameraRef = useRef(null);
  const labAnimRef = useRef(null);
  const [labControls, setLabControls] = useState({
    rotation: 0,
    zoom: 1,
    lightIntensity: 1
  });
  const [selectedExperimentId, setSelectedExperimentId] = useState(LAB_EXPERIMENTS[0]?.id || null);
  const selectedExperiment = useMemo(() => {
    return LAB_EXPERIMENTS.find((exp) => exp.id === selectedExperimentId) || LAB_EXPERIMENTS[0];
  }, [selectedExperimentId]);
  const [labLoading, setLabLoading] = useState(false);
  const [labError, setLabError] = useState('');
  const [labRefreshKey, setLabRefreshKey] = useState(0);
  const labControlsRef = useRef(labControls);
  useEffect(() => {
    labControlsRef.current = labControls;
  }, [labControls]);

  // ─── Fetch assignments ──────────────────────────────────────────
  useEffect(() => {
    if (assignmentType === 'school') {
      fetchAssignments({ forceRefresh: true });
    }
  }, [assignmentType]);

  useEffect(() => {
    if (assignmentType !== 'school') return;
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q && q.trim() && q !== schoolSearch) {
      setSchoolSearch(q);
    }
  }, [assignmentType, location.search, schoolSearch]);

  const fetchAssignments = async ({ forceRefresh = false } = {}) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const { data } = await fetchCachedJson(ASSIGNMENTS_ENDPOINT, {
        ttlMs: ASSIGNMENTS_CACHE_TTL_MS,
        forceRefresh,
        fetchOptions: {
          headers: { Authorization: `Bearer ${token}` }
        },
      });

      const assignmentsPayload = Array.isArray(data)
        ? data
        : Array.isArray(data?.assignments)
          ? data.assignments
          : [];
      const transformedAssignments = assignmentsPayload.map((assignment) => {
        const state = getAssignmentState(assignment);
        return {
          id: assignment._id,
          title: assignment.title,
          course: assignment.subject,
          topic: assignment.topic || '',
          chapterTitle: assignment.chapterTitle || '',
          type: assignment.type || 'Assignment',
          difficulty: assignment.difficulty || '',
          isEssay: Boolean(assignment.isEssay),
          rubric: assignment.rubric || '',
          dueDate: assignment.dueDate,
          status: state.bucket,
          statusLabel: state.label,
          submissionStatus: state.rawStatus,
          priority: 'medium',
          description: assignment.description,
          submissionFormat: assignment.submissionFormat === 'pdf' ? 'pdf' : 'text',
          maxMarks: assignment.marks,
          submittedAt: assignment.submittedAt,
          submissionText: assignment.submissionText || '',
          submissionAttachmentUrl: assignment.attachmentUrl || '',
          score: assignment.score,
          feedback: assignment.feedback,
          teacherName: assignment.teacherId?.name,
          attachments: assignment.attachments || []
        };
      });

      setAssignments(transformedAssignments);
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Helper functions ──────────────────────────────────────────
  const getAssignmentState = (assignment) => {
    const rawStatus = String(assignment?.submissionStatus || 'not_submitted').toLowerCase();
    const dueDate = assignment?.dueDate ? new Date(assignment.dueDate) : null;
    const isPastDue = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate < new Date() : false;

    if (rawStatus === 'graded') return { bucket: 'completed', label: 'Completed', rawStatus };
    if (rawStatus === 'submitted') return { bucket: 'pending', label: 'Submitted', rawStatus };
    if (rawStatus === 'late') return { bucket: 'pending', label: 'Submitted Late', rawStatus };
    if (rawStatus === 'not_submitted' && isPastDue) return { bucket: 'overdue', label: 'Overdue', rawStatus };
    return { bucket: 'pending', label: 'Pending', rawStatus };
  };

  const getFileNameFromUrl = (url) => {
    if (!url) return '';
    try {
      const pathname = new URL(url).pathname;
      return decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '');
    } catch {
      const normalized = String(url).split('?')[0];
      return decodeURIComponent(normalized.split('/').filter(Boolean).pop() || '');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysRemaining = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getSubjectIcon = (name = '') => {
    const n = name.toLowerCase();
    if (/(computer|coding|ict|programming)/.test(n)) return Terminal;
    if (/(math|numerac)/.test(n)) return Calculator;
    if (/(science|biology|chemistry|physics|environment)/.test(n)) return FlaskConical;
    if (/(english|language|literature|reading|writing)/.test(n)) return BookOpen;
    if (/(social|history|geograph|civic)/.test(n)) return Globe;
    if (/(art|draw|craft)/.test(n)) return Paintbrush;
    return GraduationCap;
  };

  // ─── School hub: subject → chapter grouping ────────────────────
  const isTaskDone = (a) => a.status === 'completed' || ['submitted', 'late'].includes(a.submissionStatus);

  const searchedAssignments = useMemo(() => {
    const needle = schoolSearch.trim().toLowerCase();
    if (!needle) return assignments;
    return assignments.filter((a) =>
      String(a.title || '').toLowerCase().includes(needle) ||
      String(a.course || '').toLowerCase().includes(needle) ||
      String(a.chapterTitle || '').toLowerCase().includes(needle) ||
      String(a.description || '').toLowerCase().includes(needle)
    );
  }, [assignments, schoolSearch]);

  const subjects = useMemo(() => {
    const map = new Map();
    searchedAssignments.forEach((a) => {
      const key = a.course || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return Array.from(map.entries()).map(([name, items]) => {
      const pending = items.filter((i) => !isTaskDone(i));
      const nextDue = pending
        .filter((i) => i.dueDate)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
      return { name, items, pendingCount: pending.length, nextDue, icon: getSubjectIcon(name) };
    });
  }, [searchedAssignments]);

  useEffect(() => {
    if (!subjects.length) { setSelectedSubject(null); return; }
    if (selectedSubject && subjects.some((s) => s.name === selectedSubject)) return;
    const withDueTask = [...subjects].sort((a, b) => b.pendingCount - a.pendingCount)[0];
    setSelectedSubject(withDueTask.name);
    // Only re-pick a default subject when the available subject list actually changes.
  }, [subjects]);

  const activeSubject = subjects.find((s) => s.name === selectedSubject) || subjects[0] || null;

  const chapters = useMemo(() => {
    if (!activeSubject) return [];
    const map = new Map();
    activeSubject.items.forEach((a) => {
      const key = a.chapterTitle || a.topic || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return Array.from(map.entries()).map(([title, items]) => {
      const done = items.filter(isTaskDone).length;
      const heroTasks = items
        .filter((i) => !isTaskDone(i))
        .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
      const doneTasks = items.filter(isTaskDone);
      return { title, items, total: items.length, done, heroTasks, doneTasks };
    });
  }, [activeSubject]);

  useEffect(() => {
    if (!chapters.length) { setExpandedChapter(null); return; }
    if (expandedChapter && chapters.some((c) => c.title === expandedChapter)) return;
    const firstIncomplete = chapters.find((c) => c.done < c.total) || chapters[0];
    setExpandedChapter(firstIncomplete.title);
  }, [chapters]);

  const openAssignmentDetail = (assignment, chapterTitle) => {
    setSelectedAssignment(assignment);
    setSubmissionText(assignment.submissionText || '');
    setSubmissionFileUrl(assignment.submissionAttachmentUrl || '');
    setSubmissionFileName('');
    setSubmissionFileSize(0);
    setSubmitSuccess(false);
    setDetailBackLabel(chapterTitle);
  };

  // ─── Submission handlers ──────────────────────────────────────
  const handleSubmit = async () => {
    const requiresPdfUpload = selectedAssignment?.submissionFormat === 'pdf';
    if (!requiresPdfUpload && !submissionText.trim()) {
      toast.error('Submission required: Please write something before submitting.');
      return;
    }
    if (requiresPdfUpload && !submissionFileUrl) {
      toast.error('PDF required: Please upload your PDF before submitting.');
      return;
    }
    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/api/assignment/submit`,
        {
          assignmentId: selectedAssignment.id,
          submissionText,
          attachmentUrl: requiresPdfUpload ? submissionFileUrl : undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSubmitSuccess(true);
      setSubmissionFileUrl('');
      setSubmissionFileName('');
      clearStudentApiCacheByUrl(ASSIGNMENTS_ENDPOINT);
      await fetchAssignments({ forceRefresh: true });
      setSelectedAssignment((prev) => {
        if (!prev) return prev;
        const rawSubmissionStatus = response.data?.status || (new Date(prev.dueDate) < new Date() ? 'late' : 'submitted');
        const state = getAssignmentState({ ...prev, submissionStatus: rawSubmissionStatus });
        return {
          ...prev,
          status: state.bucket,
          statusLabel: state.label,
          submissionStatus: state.rawStatus,
          submittedAt: response.data?.submittedAt || new Date().toISOString(),
          submissionText: response.data?.submissionText ?? submissionText,
          submissionAttachmentUrl: response.data?.attachmentUrl ?? (requiresPdfUpload ? submissionFileUrl : ''),
        };
      });
    } catch (err) {
      console.error('Submit error:', err);
      toast.error(`Submission failed: ${err.response?.data?.error || 'Failed to submit. Please try again.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmissionFileUpload = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Invalid file: Please upload a PDF file.');
      input.value = '';
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large: File size must be under 20MB.');
      input.value = '';
      return;
    }

    setUploadingSubmissionFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/api/uploads/cloudinary/single`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      const uploaded = response.data.files?.[0];
      if (!uploaded?.secure_url) {
        throw new Error('Upload failed');
      }
      setSubmissionFileUrl(uploaded.secure_url);
      setSubmissionFileName(uploaded.originalName || file.name);
      setSubmissionFileSize(file.size);
    } catch (error) {
      console.error('Assignment submission upload failed:', error);
      toast.error('Upload failed: Failed to upload PDF. Please try again.');
      setSubmissionFileUrl('');
      setSubmissionFileName('');
      setSubmissionFileSize(0);
    } finally {
      input.value = '';
      setUploadingSubmissionFile(false);
    }
  };

  const removeSubmissionFile = () => {
    setSubmissionFileUrl('');
    setSubmissionFileName('');
    setSubmissionFileSize(0);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };


  // ─── Lab effects ──────────────────────────────────────────────
  useEffect(() => {
    if (assignmentType !== 'lab') {
      if (labAnimRef.current) cancelAnimationFrame(labAnimRef.current);
      return;
    }
    if (!selectedExperiment || !labContainerRef.current) {
      return;
    }

    const container = labContainerRef.current;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    setLabLoading(true);
    setLabError('');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    labSceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.5, 6);
    labCameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    labRendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 12;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
      0xffffff,
      labControlsRef.current.lightIntensity
    );
    directionalLight.position.set(4, 6, 4);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4, 48),
      new THREE.MeshPhongMaterial({ color: 0x1f2937, opacity: 0.4, transparent: true })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    floor.receiveShadow = true;
    scene.add(floor);

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);

    let modelGroup = null;

    loader.load(
      selectedExperiment.model,
      (gltf) => {
        modelGroup = gltf.scene;
        modelGroup.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.side = THREE.DoubleSide;
            }
          }
        });
        const box = new THREE.Box3().setFromObject(modelGroup);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        modelGroup.position.sub(center);
        const maxAxis = Math.max(size.x, size.y, size.z);
        if (maxAxis > 0) {
          const scale = 4 / maxAxis;
          modelGroup.scale.setScalar(scale);
        }
        scene.add(modelGroup);
        setLabLoading(false);
        setLabError('');
      },
      (progress) => {
        if (progress.lengthComputable) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log(`Loading model: ${Math.round(percentComplete)}%`);
        }
      },
      (error) => {
        console.error('Virtual lab model failed to load:', error);
        setLabLoading(false);
        setLabError(`Unable to load the 3D model: ${error.message || 'Unknown error'}. Please try again.`);
      }
    );

    const animate = () => {
      labAnimRef.current = requestAnimationFrame(animate);
      const controlValues = labControlsRef.current;
      if (modelGroup) {
        modelGroup.rotation.y = (controlValues.rotation * Math.PI) / 180;
      }
      const zoomValue = Math.min(Math.max(controlValues.zoom, 0.5), 3);
      camera.position.set(0, 1.5, 6 / zoomValue);
      directionalLight.intensity = controlValues.lightIntensity;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (labAnimRef.current) cancelAnimationFrame(labAnimRef.current);
      controls.dispose();
      renderer.dispose();
      dracoLoader.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [assignmentType, selectedExperiment, labRefreshKey]);

  // ─── Practice handlers ──────────────────────────────────────
  const handlePracticeAnswer = (questionId, value) => {
    setPracticeAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handlePracticeSubmit = async () => {
    if (!practiceQuestions.length) return;
    const token = localStorage.getItem('token');
    if (!token) {
      setPracticeError('Login required');
      return;
    }
    setPracticeSubmitting(true);
    setPracticeError('');
    try {
      const payload = {
        answers: practiceQuestions.map((q) => ({
          questionId: q.id,
          answer: practiceAnswers[q.id] || '',
        })),
      };
      const res = await fetch(`${API_BASE}/api/practice/student/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Unable to submit answers');
      }
      const data = await res.json();
      const resultMap = {};
      (data?.results || []).forEach((r) => {
        resultMap[String(r.questionId)] = r;
      });
      setPracticeResults(resultMap);
      setShowAnswers(true);

      const total = data?.total || 0;
      const correct = data?.correct || 0;
      const score = total > 0 ? Math.round((correct / total) * 100) : 0;
      if (score >= 70) {
        const awardKey = `practice_${practiceSubjectId}_${practiceType}`;
        if (!hasAward(awardKey)) {
          addPoints(10);
          markAwarded(awardKey);
        }
      }
    } catch (err) {
      console.error('Practice submit error:', err);
      setPracticeError(err.message || 'Failed to submit answers');
    } finally {
      setPracticeSubmitting(false);
    }
  };

  // ─── Flashcard keydown ──────────────────────────────────────
  useEffect(() => {
    if (assignmentType !== 'flashcard') return;
    const onKeyDown = (e) => {
      if (e.key === ' ') {
        e.preventDefault();
        setFlashFlipped(!flashFlipped);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flashFlipped, assignmentType]);

  const loadPracticeMeta = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setPracticeError('Login required');
      return;
    }
    setPracticeLoading(true);
    setPracticeError('');
    try {
      const res = await fetch(`${API_BASE}/api/practice/student/meta`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Unable to load practice metadata');
      }
      const data = await res.json();
      const subjects = Array.isArray(data?.subjects) ? data.subjects : [];
      setPracticeMeta({
        classId: data?.class?.id || null,
        className: data?.class?.name || '',
        sectionId: data?.section?.id || null,
        sectionName: data?.section?.name || '',
        subjects,
      });
      const firstSubjectId = subjects[0]?.id || '';
      setPracticeSubjectId(firstSubjectId);
    } catch (err) {
      console.error('Practice meta error:', err);
      setPracticeError(err.message || 'Failed to load practice metadata');
    } finally {
      setPracticeLoading(false);
    }
  };

  const loadPracticeQuestions = async (subjectId, type) => {
    if (!subjectId) {
      setPracticeQuestions([]);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setPracticeError('Login required');
      return;
    }
    setPracticeLoading(true);
    setPracticeError('');
    try {
      const params = new URLSearchParams({ subjectId, type });
      const res = await fetch(`${API_BASE}/api/practice/student/questions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Unable to load practice questions');
      }
      const data = await res.json();
      setPracticeQuestions(Array.isArray(data?.questions) ? data.questions : []);
      setPracticeAnswers({});
      setPracticeResults(null);
      setShowAnswers(false);
    } catch (err) {
      console.error('Practice load error:', err);
      setPracticeError(err.message || 'Failed to load practice questions');
    } finally {
      setPracticeLoading(false);
    }
  };

  useEffect(() => {
    if (assignmentType !== 'eec') return;
    loadPracticeMeta();
  }, [assignmentType]);

  useEffect(() => {
    if (assignmentType !== 'eec') return;
    if (!practiceSubjectId) return;
    loadPracticeQuestions(practiceSubjectId, practiceType);
  }, [assignmentType, practiceSubjectId, practiceType]);

  // ─── MCQ and Blank components ──────────────────────────────
  const MCQ = ({ questions = [] }) => {
    return (
      <div className="space-y-6">
        {questions.map((q, idx) => {
          const answer = practiceAnswers[q.id] || '';
          const result = practiceResults?.[String(q.id)] || null;
          return (
          <div key={q.id || idx} className="mb-5">
            <div className={`overflow-hidden ${SURFACE_CARD} ${SURFACE_HOVER}`}>
              <div className="flex items-center justify-between border-b border-violet-500/15 px-4 py-3 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                    {idx + 1}
                  </div>
                  <p className="text-sm font-semibold text-[#334155]">Question {idx + 1}</p>
                </div>
                {result && (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${result.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {result.isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                )}
              </div>
              <div className="p-4 sm:p-6">
                <div className="text-[#0f172a] font-medium">{q.question}</div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {(q.options || []).map((option, oidx) => {
                    const selected = answer === option;
                    const isCorrect = result?.correctAnswer === option;
                    const showState = showAnswers && result;
                    const borderColor = showState
                      ? isCorrect
                        ? 'border-emerald-400 bg-emerald-50'
                        : selected
                        ? 'border-rose-300 bg-rose-50'
                        : 'border-violet-500/20 bg-white/40'
                      : selected
                      ? 'border-violet-400 bg-violet-50'
                      : 'border-violet-500/20 bg-white/40 hover:border-violet-300 hover:bg-violet-50/50';
                    return (
                      <label
                        key={oidx}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all duration-200 ${borderColor}`}
                      >
                        <input
                          type="radio"
                          name={`q${idx}`}
                          value={option}
                          checked={selected}
                          onChange={(e) => handlePracticeAnswer(q.id, e.target.value)}
                          className="text-violet-600 focus:ring-violet-500"
                        />
                        <span className="text-[#334155]">{option}</span>
                      </label>
                    );
                  })}
                </div>
                {showAnswers && result && (
                  <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${result.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                    <div className={result.isCorrect ? 'text-emerald-800' : 'text-rose-700'}>
                      <span className="font-semibold">Your answer:</span> {answer || '-'} {result.isCorrect ? '✓' : '✗'}
                    </div>
                    {!result.isCorrect && (
                      <div className="mt-1 text-emerald-700">
                        <span className="font-semibold">Correct answer:</span> {result.correctAnswer}
                      </div>
                    )}
                    {result.explanation && (
                      <div className="mt-2 text-[#334155]">
                        <span className="font-semibold">Explanation:</span> {result.explanation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
        })}
      </div>
    );
  };

  const Blank = ({ questions = [] }) => {
    return (
      <div className="space-y-6">
        {questions.map((q, idx) => {
          const answer = practiceAnswers[q.id] || '';
          const result = practiceResults?.[String(q.id)] || null;
          return (
          <div key={q.id || idx} className="mb-5">
            <div className={`overflow-hidden ${SURFACE_CARD} ${SURFACE_HOVER}`}>
              <div className="p-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-semibold">{idx + 1}</div>
                  <div className="flex-1">
                    <div className="text-[#0f172a] font-medium">{q.question}</div>
                    <div className="mt-3">
                      <input
                        type="text"
                        className="w-full border border-violet-500/25 bg-white/60 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/60 outline-none text-[#0f172a] placeholder:text-[#8e9aaf]"
                        placeholder="Type your answer here..."
                        value={answer}
                        onChange={(e) => handlePracticeAnswer(q.id, e.target.value)}
                      />
                    </div>
                    {showAnswers && result && (
                      <div className={`mt-3 rounded-lg border p-3 text-sm ${result.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                        <div className={result.isCorrect ? 'text-emerald-800' : 'text-red-800'}>
                          <span className="font-semibold">Your answer:</span> {answer || '-'} {result.isCorrect ? '✓' : '✗'}
                        </div>
                        {!result.isCorrect && (
                          <div className="text-emerald-800 mt-1">
                            <span className="font-semibold">Correct answer:</span> {result.correctAnswer}
                          </div>
                        )}
                        {result.explanation && <div className="text-[#334155] mt-1"><span className="font-semibold">Explanation:</span> {result.explanation}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        })}
      </div>
    );
  };

  // ─────────────────── RENDER ────────────────────────────────────────────
  const correctCount = practiceResults ? Object.values(practiceResults).filter((r) => r?.isCorrect).length : 0;
  const scorePercent = practiceResults && practiceQuestions.length ? Math.round((correctCount / practiceQuestions.length) * 100) : 0;

  return (
    <div className="w-full">
      {assignmentType === 'school' && !selectedAssignment && (
        <div className="flex flex-col gap-6">
          {/* ─── Subject Selector ─── */}
          <div className={`page-fade-in ${SURFACE_CARD} p-5 sm:p-6`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#464555]">Choose a Subject</span>
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              </div>
              <div className="relative w-full max-w-[220px]">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8e9aaf]" />
                <input
                  value={schoolSearch}
                  onChange={(e) => setSchoolSearch(e.target.value)}
                  placeholder="Search assignments..."
                  className={`w-full pl-8 pr-3 py-1.5 ${SURFACE_INNER} text-xs text-[#0b1c30] placeholder:text-[#8e9aaf] outline-none focus:border-violet-300`}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-14">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                <p className="text-sm text-[#8e9aaf]">Loading assignments...</p>
              </div>
            ) : subjects.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-violet-200 py-14 text-center">
                <Inbox className="h-9 w-9 text-violet-300" />
                <p className="text-sm font-bold text-[#0b1c30]">No assignments yet</p>
                <p className="text-xs text-[#8e9aaf]">Your teachers haven&rsquo;t posted anything here yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {subjects.map((s, i) => {
                  const Icon = s.icon;
                  const active = s.name === selectedSubject;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setSelectedSubject(s.name)}
                      style={{ animationDelay: `${i * 40}ms` }}
                      className={`page-fade-in group relative flex flex-col justify-between rounded-xl p-4 text-left transition-all duration-200 ease-out ${
                        active
                          ? 'scale-[1.01] bg-violet-600 text-white shadow-md shadow-violet-600/25'
                          : `${SURFACE_INNER} text-[#0b1c30] hover:-translate-y-0.5 hover:shadow-sm`
                      }`}
                    >
                      {s.pendingCount > 0 && (
                        <span className={`absolute -top-2 -right-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${
                          active ? 'bg-sky-300 text-[#001e2f]' : 'bg-amber-100 text-amber-700'
                        }`}>
                          <Clock className="h-2.5 w-2.5" /> {s.pendingCount} Due
                        </span>
                      )}
                      <div className="mb-3 flex items-center gap-2.5">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white/15 text-white' : 'bg-violet-100 text-violet-600'}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <span className={`block truncate text-sm font-bold ${active ? 'text-white' : 'text-[#0b1c30]'}`}>{s.name}</span>
                          <span className={`block text-[11px] font-medium ${active ? 'text-white/70' : 'text-[#8e9aaf]'}`}>{s.items.length} task{s.items.length === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                      <div className={`flex items-center justify-between text-xs font-medium ${active ? 'text-white/80' : 'text-[#464555]'}`}>
                        <span>{s.pendingCount === 0 ? 'Caught up' : `${s.pendingCount} to do`}</span>
                        <ChevronRight className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${active ? 'text-white' : 'text-[#8e9aaf]'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── Chapter Roadmap + Accordion ─── */}
          {activeSubject && chapters.length > 0 && (
            <>
              <div className={`page-fade-in flex flex-col gap-3 ${SURFACE_CARD} p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5`}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                    <activeSubject.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-[#0b1c30]">{activeSubject.name}</span>
                      <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-600">
                        {chapters.length} chapter{chapters.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <span className="block truncate text-xs text-[#8e9aaf]">Chapter-wise breakdown of your assigned work</span>
                  </div>
                </div>
                <div className={`flex shrink-0 items-center gap-1 overflow-x-auto rounded-xl ${SURFACE_INNER} p-1`}>
                  {chapters.map((c) => (
                    <button
                      key={c.title}
                      type="button"
                      onClick={() => setExpandedChapter(c.title)}
                      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
                        expandedChapter === c.title ? 'bg-violet-600 text-white shadow-sm' : 'text-[#464555] hover:bg-white'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${c.done === c.total ? 'bg-emerald-400' : expandedChapter === c.title ? 'bg-sky-300' : 'bg-[#c7c4d8]'}`} />
                      {c.title}
                      <span className={`rounded px-1 text-[10px] ${expandedChapter === c.title ? 'bg-white/20' : 'bg-white text-[#464555]'}`}>{c.done}/{c.total}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {chapters.map((chapter, ci) => {
                  const isOpen = expandedChapter === chapter.title;
                  return (
                    <section key={chapter.title} className={`overflow-hidden ${SURFACE_CARD} ${isOpen ? 'border-violet-300' : ''}`}>
                      <button
                        type="button"
                        onClick={() => setExpandedChapter(isOpen ? null : chapter.title)}
                        className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between sm:p-5"
                      >
                        <div className="flex items-start gap-3 sm:items-center">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${isOpen ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-600'}`}>
                            {String(ci + 1).padStart(2, '0')}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              {isOpen && (
                                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">Current Chapter</span>
                              )}
                              {chapter.done === chapter.total && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                  <CheckCircle2 className="h-2.5 w-2.5" />Complete
                                </span>
                              )}
                            </div>
                            <h3 className="mt-0.5 text-sm font-bold text-[#0b1c30] sm:text-base">{chapter.title}</h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <div className="flex w-28 flex-col gap-1 sm:w-36">
                            <div className="flex items-center justify-between text-[10px] font-semibold text-[#8e9aaf]">
                              <span>Progress</span><span className="text-violet-600">{chapter.done}/{chapter.total}</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-violet-50">
                              <div className="h-full rounded-full bg-violet-500" style={{ width: `${chapter.total ? (chapter.done / chapter.total) * 100 : 0}%` }} />
                            </div>
                          </div>
                          {isOpen ? <ChevronUp className="h-5 w-5 text-[#8e9aaf]" /> : <ChevronDown className="h-5 w-5 text-[#8e9aaf]" />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="flex flex-col gap-4 border-t border-violet-50 p-4 sm:p-5">
                          {chapter.heroTasks.map((task) => {
                            const days = getDaysRemaining(task.dueDate);
                            const isOverdueTask = task.status === 'overdue';
                            const daysText = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`;
                            const requiresPdf = task.submissionFormat === 'pdf';
                            return (
                              <div
                                key={task.id}
                                className={`relative overflow-hidden rounded-xl border p-4 sm:p-5 ${isOverdueTask ? 'border-red-200 bg-red-50/40' : 'border-violet-200 bg-violet-50/30'}`}
                              >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
                                  {requiresPdf && (
                                    <div className="flex w-full shrink-0 flex-col justify-between rounded-xl border border-violet-100 bg-white p-4 lg:w-56">
                                      <div className="mb-2 flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                                          <Paperclip className="h-2.5 w-2.5" />PDF / Photo
                                        </span>
                                        {task.maxMarks ? <span className="text-[11px] font-semibold text-[#8e9aaf]">{task.maxMarks} Marks</span> : null}
                                      </div>
                                      <div className="flex h-24 items-center justify-center rounded-lg bg-violet-50">
                                        <ImagePlus className="h-8 w-8 text-violet-300" />
                                      </div>
                                      <div className="mt-2 text-[11px] font-medium text-[#8e9aaf]">Individual Work</div>
                                    </div>
                                  )}
                                  <div className="flex flex-1 flex-col justify-between gap-3">
                                    <div>
                                      <div className="mb-2 flex flex-wrap items-center gap-2">
                                        {task.dueDate && (
                                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${isOverdueTask ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                            <CalendarClock className="h-3 w-3" />{isOverdueTask ? daysText : `Due: ${formatDate(task.dueDate)}`}
                                          </span>
                                        )}
                                        {task.maxMarks ? (
                                          <span className="rounded-full border border-violet-100 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#464555]">{task.maxMarks} marks</span>
                                        ) : null}
                                      </div>
                                      <h4 className="text-base font-bold text-[#0b1c30] sm:text-lg">{task.title}</h4>
                                      {task.description && (
                                        <p className="mt-1 text-xs leading-relaxed text-[#464555] line-clamp-2 sm:text-sm">{task.description}</p>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => openAssignmentDetail(task, chapter.title)}
                                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet-700 sm:w-auto"
                                    >
                                      Open Assignment &amp; Upload <ArrowRight className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {chapter.doneTasks.length > 0 && (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              {chapter.doneTasks.map((task) => {
                                const isGraded = task.submissionStatus === 'graded';
                                const hasScore = isGraded && task.score !== undefined && task.score !== null;
                                return (
                                  <div key={task.id} className={`flex flex-col justify-between gap-2 rounded-xl border border-violet-100 bg-violet-50/40 p-4`}>
                                    <div>
                                      <div className="mb-2 flex items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-white px-2 py-0.5 text-[10px] font-bold text-[#464555]">
                                          {task.type || 'Assignment'}
                                        </span>
                                        {hasScore && (
                                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-white px-2 py-0.5 text-[10px] font-bold text-violet-600">
                                            <Star className="h-2.5 w-2.5" />{task.score}/{task.maxMarks}
                                          </span>
                                        )}
                                      </div>
                                      <h5 className="text-sm font-bold text-[#0b1c30]">{task.title}</h5>
                                      {task.submittedAt && (
                                        <p className="mt-1 text-xs text-[#8e9aaf]">
                                          Submitted {formatDate(task.submittedAt)}{task.submissionStatus === 'late' ? ' • Late' : ''}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between border-t border-violet-100 pt-2">
                                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {isGraded ? 'Graded' : task.submissionStatus === 'late' ? 'Submitted Late' : 'Submitted'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => openAssignmentDetail(task, chapter.title)}
                                        className="rounded-lg px-2.5 py-1 text-xs font-bold text-violet-600 transition-colors duration-200 hover:bg-white"
                                      >
                                        {isGraded ? 'Review' : 'View'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          )}

          {/* ─── Help Desk ─── */}
          {activeSubject && (
            <div className={`page-fade-in flex flex-col items-center gap-4 text-center ${SURFACE_CARD} p-5 sm:flex-row sm:justify-between sm:p-6 sm:text-left`}>
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0b1c30]">Need a hand with your homework or chapter deadlines?</h4>
                  <p className="mt-0.5 text-xs text-[#8e9aaf]">Ask your teacher directly from Class Wall or Messages.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Assignment Detail (full page, not a modal) ─── */}
      {assignmentType === 'school' && selectedAssignment && (() => {
        const a = selectedAssignment;
        const days = getDaysRemaining(a.dueDate);
        const daysText = days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `${days} days remaining`;
        const daysColor = days < 0 ? 'text-red-700 bg-red-50 border-red-200' : days <= 3 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200';
        const isGraded = a.submissionStatus === 'graded';
        const isSubmitted = ['submitted', 'late', 'graded'].includes(a.submissionStatus);
        const isLateSubmission = a.submissionStatus === 'late';
        const requiresPdfUpload = a.submissionFormat === 'pdf';
        const uploadInputId = `assignment-upload-${a.id}`;
        const canSubmitAssignment = requiresPdfUpload ? Boolean(submissionFileUrl) : Boolean(submissionText.trim());
        let stepNumber = 1;
        const instructionsStep = stepNumber++;
        const attachmentsStep = a.attachments?.length > 0 ? stepNumber++ : null;
        const submitStep = stepNumber;

        return (
          <div className="page-fade-in flex flex-col gap-6">
            {/* Breadcrumb / Back */}
            <button
              type="button"
              onClick={() => setSelectedAssignment(null)}
              className="group flex items-center gap-2 self-start text-sm font-semibold text-[#464555] transition-colors duration-200 hover:text-violet-700"
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg border border-violet-100 bg-white transition-all duration-200 group-hover:border-violet-300 group-hover:bg-violet-50`}>
                <ArrowLeft className="h-4 w-4" />
              </span>
              {detailBackLabel ? `Back to ${detailBackLabel}` : 'Back to Assignments'}
            </button>

            {/* Hero */}
            <div className={`${SURFACE_CARD} p-5 sm:p-7`}>
              <div className="flex flex-wrap items-center gap-2">
                {a.course && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700">
                    <Book className="h-3 w-3" />{a.course}
                  </span>
                )}
                {a.type && a.type !== 'Assignment' && (
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600">{a.type}</span>
                )}
              </div>
              <h1 className="mt-3 text-xl font-extrabold tracking-tight text-[#0b1c30] sm:text-2xl">{a.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#464555]">
                {a.dueDate && (
                  <span className="flex items-center gap-1.5 font-medium">
                    <CalendarClock className="h-4 w-4 text-violet-500" />
                    Due: <strong>{formatDate(a.dueDate)}</strong>
                  </span>
                )}
                {isGraded && a.score !== undefined && a.score !== null ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    <Award className="h-3 w-3" />Scored {a.score}/{a.maxMarks}
                  </span>
                ) : (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${daysColor}`}>
                    <Clock className="h-3 w-3" />{daysText}
                  </span>
                )}
                {!isGraded && a.maxMarks ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                    <Star className="h-3 w-3" />{a.maxMarks} marks
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
              {/* LEFT: instructions + attachments + help */}
              <div className="flex flex-col gap-5 lg:col-span-7">
                <div className={`${SURFACE_CARD} flex flex-col gap-4 p-5 sm:p-6`}>
                  <div className="flex items-center gap-3 border-b border-violet-50 pb-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white shadow-sm">{instructionsStep}</span>
                    <div>
                      <h2 className="text-base font-bold text-[#0b1c30] sm:text-lg">Assignment Instructions</h2>
                      {(a.chapterTitle || a.topic) && (
                        <p className="text-xs text-[#8e9aaf]">{[a.chapterTitle, a.topic].filter(Boolean).join(' • ')}</p>
                      )}
                    </div>
                  </div>
                  {a.description ? (
                    <p className={`whitespace-pre-line rounded-xl bg-violet-50/50 p-4 text-sm leading-relaxed text-[#334155]`}>{a.description}</p>
                  ) : (
                    <p className="text-sm text-[#8e9aaf]">No additional instructions were provided for this task.</p>
                  )}
                  {a.isEssay && a.rubric && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-800">
                        <Star className="h-4 w-4" /> Essay Grading Rubric
                      </h3>
                      <ul className="space-y-1">
                        {a.rubric.split('\n').filter(Boolean).map((line, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-800">{i + 1}</span>
                            {line.trim()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {attachmentsStep && (
                  <div className={`${SURFACE_CARD} flex flex-col gap-3 p-5 sm:p-6`}>
                    <div className="flex items-center gap-3 border-b border-violet-50 pb-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white shadow-sm">{attachmentsStep}</span>
                      <h2 className="text-base font-bold text-[#0b1c30] sm:text-lg">Teacher&rsquo;s Worksheet</h2>
                    </div>
                    <div className="space-y-2">
                      {a.attachments.map((att, i) => (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3 transition-colors duration-200 hover:bg-violet-50"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                            <FileText className="h-4 w-4 text-violet-600" />
                          </div>
                          <span className="flex-1 truncate text-sm font-medium text-violet-700">{att.name || `Attachment ${i + 1}`}</span>
                          <Download className="h-4 w-4 shrink-0 text-violet-500" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {a.teacherName && (
                  <div className={`flex items-center justify-between gap-3 ${SURFACE_INNER} p-4`}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                        <LifeBuoy className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0b1c30]">Need help or have a question?</p>
                        <p className="text-[11px] text-[#8e9aaf]">Send a quick message to {a.teacherName}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: submit panel (sticky) */}
              <div className="flex flex-col gap-5 lg:sticky lg:top-4 lg:col-span-5">
                <div className={`${SURFACE_CARD} border-2 border-violet-200 p-5 sm:p-6`}>
                  <div className="flex items-center gap-3 border-b border-violet-50 pb-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white shadow-sm">{submitStep}</span>
                    <div>
                      <h2 className="text-base font-bold text-[#0b1c30] sm:text-lg">
                        {isGraded ? 'Result' : isSubmitted ? 'Your Submission' : 'Submit Assignment'}
                      </h2>
                      <p className="text-xs text-[#8e9aaf]">{requiresPdfUpload ? 'Photo or PDF of your work' : 'Type your answer online'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-4">
                    {isGraded && a.score !== undefined && a.score !== null && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="mb-1 flex items-center gap-2">
                          <Award className="h-5 w-5 text-emerald-600" />
                          <h3 className="text-sm font-semibold text-emerald-800">Result</h3>
                        </div>
                        <p className="text-2xl font-bold text-emerald-700">{a.score} <span className="text-base font-normal text-emerald-600">/ {a.maxMarks}</span></p>
                        {a.feedback && (
                          <p className="mt-2 rounded-lg bg-white/70 p-3 text-sm text-emerald-700">
                            <span className="font-medium">Feedback: </span>{a.feedback}
                          </p>
                        )}
                      </div>
                    )}

                    {isSubmitted && !isGraded && (
                      <div className={`flex items-center gap-3 rounded-xl border p-4 ${isLateSubmission ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}>
                        <CheckCircle className={`h-5 w-5 shrink-0 ${isLateSubmission ? 'text-amber-600' : 'text-sky-600'}`} />
                        <div>
                          <p className={`text-sm font-semibold ${isLateSubmission ? 'text-amber-800' : 'text-sky-800'}`}>
                            {isLateSubmission ? 'Submitted Late' : 'Submitted'}
                          </p>
                          {a.submittedAt && (
                            <p className={`text-xs ${isLateSubmission ? 'text-amber-700' : 'text-sky-700'}`}>on {formatDate(a.submittedAt)} • Waiting for teacher review</p>
                          )}
                        </div>
                      </div>
                    )}

                    {isSubmitted && (a.submissionText || a.submissionAttachmentUrl) && (
                      <div className="space-y-2">
                        {a.submissionText && (
                          <div className={`${SURFACE_INNER} p-4`}>
                            <p className="whitespace-pre-line text-sm text-[#334155]">{a.submissionText}</p>
                          </div>
                        )}
                        {a.submissionAttachmentUrl && (
                          <a
                            href={a.submissionAttachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3 transition-colors duration-200 hover:bg-violet-50"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                              <FileText className="h-4 w-4 text-violet-600" />
                            </div>
                            <span className="flex-1 truncate text-sm font-medium text-violet-700">
                              {getFileNameFromUrl(a.submissionAttachmentUrl) || 'Submitted file'}
                            </span>
                            <Eye className="h-4 w-4 shrink-0 text-violet-500" />
                          </a>
                        )}
                      </div>
                    )}

                    {!isSubmitted && !isGraded && (
                      submitSuccess ? (
                        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                          <p className="text-sm font-semibold text-emerald-800">Turned in successfully!</p>
                        </div>
                      ) : (
                        <>
                          {requiresPdfUpload ? (
                            <>
                              <label
                                htmlFor={uploadInputId}
                                className="group relative flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/50 p-6 text-center transition-all duration-200 hover:border-violet-400 hover:bg-violet-50"
                              >
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  id={uploadInputId}
                                  aria-label="Upload PDF"
                                  className="hidden"
                                  onChange={handleSubmissionFileUpload}
                                />
                                {uploadingSubmissionFile ? (
                                  <>
                                    <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                                    <span className="mt-2 text-sm font-medium text-violet-700">Uploading your file...</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm transition-transform group-hover:scale-105">
                                      <ImagePlus className="h-7 w-7" />
                                    </span>
                                    <span className="text-sm font-bold text-[#0b1c30]">Take a photo or upload your work</span>
                                    <span className="mt-1 max-w-[220px] text-xs text-[#8e9aaf]">Tap here, take a picture with your phone/tablet, or drag files</span>
                                    <div className="mt-3 flex items-center gap-2">
                                      <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-[#464555] shadow-sm">
                                        <Camera className="h-3.5 w-3.5 text-violet-600" /> Camera
                                      </span>
                                      <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-[#464555] shadow-sm">
                                        <Upload className="h-3.5 w-3.5 text-violet-600" /> Files / PDF
                                      </span>
                                    </div>
                                  </>
                                )}
                              </label>
                              {submissionFileUrl && (
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center justify-between px-1 text-xs font-bold text-[#8e9aaf]">
                                    <span>Attached File (1)</span>
                                  </div>
                                  <div className={`flex items-center justify-between gap-3 ${SURFACE_INNER} p-3.5`}>
                                    <div className="flex min-w-0 items-center gap-3">
                                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
                                        <FileText className="h-5 w-5" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-[#0b1c30]">{submissionFileName || 'Uploaded file'}</p>
                                        <p className="mt-0.5 text-[11px] font-medium text-[#8e9aaf]">
                                          {[formatFileSize(submissionFileSize), 'Added just now'].filter(Boolean).join(' • ')}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <a
                                        href={submissionFileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Preview"
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-violet-600 transition-colors duration-200 hover:bg-violet-100"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </a>
                                      <button
                                        type="button"
                                        onClick={removeSubmissionFile}
                                        title="Remove file"
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition-colors duration-200 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <textarea
                                value={submissionText}
                                onChange={(e) => setSubmissionText(e.target.value)}
                                rows={2}
                                placeholder="Add a note for your teacher (optional)..."
                                className="w-full resize-none rounded-xl border border-violet-100 bg-violet-50/30 px-4 py-3 text-sm text-[#0b1c30] placeholder:text-[#8e9aaf] outline-none focus:border-violet-300"
                              />
                            </>
                          ) : (
                            <textarea
                              value={submissionText}
                              onChange={(e) => setSubmissionText(e.target.value)}
                              rows={6}
                              placeholder="Write your answer here..."
                              className="w-full resize-none rounded-xl border border-violet-100 bg-violet-50/30 px-4 py-3 text-sm text-[#0b1c30] placeholder:text-[#8e9aaf] outline-none focus:border-violet-300"
                            />
                          )}
                          <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting || !canSubmitAssignment}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-violet-600/25 transition-all duration-200 hover:bg-violet-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <SendHorizonal className="h-4.5 w-4.5" />
                            {submitting ? 'Submitting…' : 'Turn In Assignment'}
                          </button>
                        </>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {assignmentType === 'flashcard' && (
        <div className={`page-fade-in ${SURFACE_CARD} p-6`}>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <label htmlFor="fcClass" className="font-medium text-[#334155]">Class:</label>
            <select
              id="fcClass"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className={`${SURFACE_INNER} px-3 py-2 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/60 outline-none text-sm text-[#0f172a]`}
            >
              <option value="6">Class 6</option>
              <option value="7">Class 7</option>
              <option value="8">Class 8</option>
              <option value="9">Class 9</option>
              <option value="10">Class 10</option>
            </select>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-violet-500/30 py-14 text-center">
            <Layers className="h-9 w-9 text-violet-300" />
            <p className="text-[#64748b] text-sm font-medium">Flashcard functionality coming soon!</p>
          </div>
        </div>
      )}

      {assignmentType === 'eec' && (
        <div className={`page-fade-in ${SURFACE_CARD} overflow-hidden`}>
          {/* EEC Content - No Header */}
          <div className="border-b border-violet-500/15 px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
                  <GraduationCap className="h-3 w-3" />
                  <span>EEC Practice</span>
                </div>
                <h2 className="text-xl font-bold text-[#0f172a] sm:text-2xl">Practice Paper</h2>
                <p className="mt-0.5 text-xs text-[#64748b]">Challenge yourself with curated questions</p>
              </div>
              {practiceMeta && (
                <div className={`shrink-0 ${SURFACE_INNER} px-3 py-2 text-center`}>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#8e9aaf]">Class</p>
                  <p className="text-sm font-bold text-[#334155]">
                    {practiceMeta.className}{practiceMeta.sectionName ? ` · ${practiceMeta.sectionName}` : ''}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Selectors */}
          <div className="border-b border-violet-500/15 bg-violet-50/30 px-4 py-3 sm:px-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[#8e9aaf]">Subject</label>
                <select
                  value={practiceSubjectId}
                  onChange={(e) => setPracticeSubjectId(e.target.value)}
                  className={`w-full ${SURFACE_INNER} px-3 py-2.5 text-sm font-medium text-[#334155] focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20`}
                >
                  {(practiceMeta?.subjects || []).map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[#8e9aaf]">Question Type</label>
                <select
                  value={practiceType}
                  onChange={(e) => setPracticeType(e.target.value)}
                  className={`w-full ${SURFACE_INNER} px-3 py-2.5 text-sm font-medium text-[#334155] focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20`}
                >
                  <option value="mcq">Multiple Choice</option>
                  <option value="blank">Fill in the Blank</option>
                </select>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-3 border-b border-violet-500/15 px-4 py-3 sm:px-6">
            <div className={`flex items-center gap-2 ${SURFACE_INNER} px-3 py-2`}>
              <FileText className="h-4 w-4 text-violet-500" />
              <div>
                <p className="text-[10px] font-medium text-[#8e9aaf]">Questions</p>
                <p className="text-sm font-bold text-[#334155]">{practiceQuestions.length}</p>
              </div>
            </div>
            {practiceResults && (
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${scorePercent >= 70 ? 'border-emerald-200 bg-emerald-50/70' : scorePercent >= 40 ? 'border-amber-200 bg-amber-50/70' : 'border-red-200 bg-red-50/70'}`}>
                <Target className={`h-4 w-4 ${scorePercent >= 70 ? 'text-emerald-500' : scorePercent >= 40 ? 'text-amber-500' : 'text-red-500'}`} />
                <div>
                  <p className={`text-[10px] font-medium ${scorePercent >= 70 ? 'text-emerald-500' : scorePercent >= 40 ? 'text-amber-500' : 'text-red-500'}`}>Score</p>
                  <p className={`text-sm font-bold ${scorePercent >= 70 ? 'text-emerald-700' : scorePercent >= 40 ? 'text-amber-700' : 'text-red-700'}`}>{correctCount}/{practiceQuestions.length} · {scorePercent}%</p>
                </div>
              </div>
            )}
            <p className="ml-auto hidden text-xs text-[#8e9aaf] sm:block">Read carefully before answering</p>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6">
            {practiceError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{practiceError}</span>
              </div>
            )}
            {practiceLoading && (
              <div className="flex items-center justify-center gap-3 py-12 text-sm text-[#64748b]">
                <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                <span>Loading questions...</span>
              </div>
            )}
            {!practiceLoading && practiceQuestions.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-500/30 py-12">
                <Inbox className="h-9 w-9 text-violet-300" />
                <p className="text-sm font-medium text-[#64748b]">No questions available for this subject.</p>
              </div>
            )}
            {!practiceLoading && practiceQuestions.length > 0 && (
              practiceType === "mcq"
                ? <MCQ questions={practiceQuestions} />
                : <Blank questions={practiceQuestions} />
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-violet-500/15 bg-violet-50/30 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
              <button
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 ease-out active:scale-[0.98] hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                onClick={handlePracticeSubmit}
                disabled={practiceSubmitting || practiceQuestions.length === 0}
              >
                {practiceSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Submit Answers</span>
                  </>
                )}
              </button>
              <button
                className={`flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
                  showAnswers
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : `${SURFACE_INNER} text-[#334155] hover:bg-white/70`
                }`}
                onClick={() => setShowAnswers(!showAnswers)}
                disabled={!practiceResults}
              >
                {showAnswers ? <EyeOff className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
                <span>{showAnswers ? 'Hide Explanations' : 'Show Explanations'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {assignmentType === 'lab' && (
        <div className="space-y-6 page-fade-in">
          {/* Lab Content */}
          <div className={`${SURFACE_CARD} p-6`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8e9aaf]">
                  <FlaskConical className="h-4 w-4" />
                  Virtual Lab
                </div>
                <h2 className="mt-2 text-2xl font-bold text-[#0f172a]">Interactive Molecule Explorer</h2>
                <p className="text-sm text-[#64748b]">Load high fidelity GLB assets directly from the lab library and inspect them with real time controls.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#64748b]">
                <span className="rounded-full border border-violet-500/35 bg-white/50 backdrop-blur-[20px] px-4 py-1">{LAB_EXPERIMENTS.length}+ curated models</span>
                <span className="rounded-full border border-violet-500/35 bg-white/50 backdrop-blur-[20px] px-4 py-1">Three.js powered viewer</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2 space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-slate-900/20 bg-slate-900 text-white shadow-xl">
                <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-slate-900/90 via-slate-900/10 to-transparent p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-200/80">Current model</p>
                  <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-2xl font-semibold">{selectedExperiment?.title}</p>
                      <p className="text-sm text-slate-200/90">{selectedExperiment?.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full border border-white/30 px-3 py-1">{selectedExperiment?.field}</span>
                      <span className="rounded-full border border-white/30 px-3 py-1">{selectedExperiment?.difficulty}</span>
                      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-100">Formula: {selectedExperiment?.formula}</span>
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <div ref={labContainerRef} className="h-[28rem] w-full rounded-2xl bg-slate-900" />
                  {labLoading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-900/80 text-center text-white">
                      <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <p className="text-sm font-medium">Loading {selectedExperiment?.title}</p>
                    </div>
                  )}
                  {labError && !labLoading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-900/80 p-6 text-center text-white">
                      <p className="text-sm font-semibold">{labError}</p>
                      <button
                        onClick={() => setLabRefreshKey((key) => key + 1)}
                        className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide transition hover:bg-white/20"
                      >
                        Retry Load
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className={`${SURFACE_CARD} p-5`}>
                <h3 className="text-lg font-semibold text-[#0f172a]">Model Details</h3>
                <p className="mt-1 text-sm text-[#64748b]">{selectedExperiment?.summary}</p>
                <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#8e9aaf]">Field</dt>
                    <dd className="font-semibold text-[#334155]">{selectedExperiment?.field}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#8e9aaf]">Difficulty</dt>
                    <dd className="font-semibold text-[#334155]">{selectedExperiment?.difficulty}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#8e9aaf]">Formula</dt>
                    <dd className="font-mono text-base text-[#0f172a]">{selectedExperiment?.formula}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#8e9aaf]">Focus</dt>
                    <dd className="text-[#334155]">{selectedExperiment?.focus?.[0] || 'Key concept'}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(selectedExperiment?.focus || []).map((concept) => (
                    <span key={concept} className={`rounded-full ${SURFACE_INNER} px-3 py-1 text-xs font-semibold text-[#64748b]`}>
                      {concept}
                    </span>
                  ))}
                </div>
              </div>

              <div className={`${SURFACE_CARD} p-5`}>
                <h3 className="text-lg font-semibold text-[#0f172a]">Lab Controls</h3>
                <div className="mt-4 space-y-5">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#8e9aaf]">
                      Model Rotation ({Math.round(labControls.rotation)}°)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={labControls.rotation}
                      onChange={(e) => setLabControls((prev) => ({ ...prev, rotation: parseInt(e.target.value, 10) }))}
                      className="h-2 w-full cursor-pointer rounded-full bg-violet-100 accent-violet-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#8e9aaf]">
                      Zoom ({labControls.zoom.toFixed(1)}x)
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value={labControls.zoom}
                      onChange={(e) => setLabControls((prev) => ({ ...prev, zoom: parseFloat(e.target.value) }))}
                      className="h-2 w-full cursor-pointer rounded-full bg-violet-100 accent-violet-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#8e9aaf]">
                      Light Intensity ({labControls.lightIntensity.toFixed(1)})
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="2"
                      step="0.1"
                      value={labControls.lightIntensity}
                      onChange={(e) => setLabControls((prev) => ({ ...prev, lightIntensity: parseFloat(e.target.value) }))}
                      className="h-2 w-full cursor-pointer rounded-full bg-violet-100 accent-violet-500"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-amber-300/50 bg-[#fffbeb]/70 backdrop-blur-[20px] backdrop-saturate-[1.8] p-5 shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
                <h3 className="text-lg font-semibold text-amber-900">Investigation Steps</h3>
                <ol className="mt-3 space-y-2 text-sm text-amber-900">
                  {(selectedExperiment?.steps || []).map((step, idx) => (
                    <li key={step} className="flex gap-2">
                      <span className="font-semibold text-amber-600">{idx + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 rounded-lg bg-white/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  {selectedExperiment?.safety}
                </p>
              </div>
            </div>
          </div>

          {/* Experiment Library */}
          <div className={`${SURFACE_CARD} p-6`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-[#0f172a]">Experiment Library</h3>
                <p className="text-sm text-[#64748b]">Pick any molecule to load it in the viewer instantly.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#64748b]">
                <span className="rounded-full border border-violet-500/35 bg-white/50 backdrop-blur-[20px] px-4 py-1">Chemistry & Biology</span>
                <span className="rounded-full border border-violet-500/35 bg-white/50 backdrop-blur-[20px] px-4 py-1">Interactive GLB files</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {LAB_EXPERIMENTS.map((experiment) => {
                const isActive = experiment.id === selectedExperiment?.id;
                return (
                  <button
                    type="button"
                    key={experiment.id}
                    onClick={() => {
                      if (experiment.id === selectedExperimentId) {
                        setLabRefreshKey((key) => key + 1);
                        return;
                      }
                      setSelectedExperimentId(experiment.id);
                      setLabControls({
                        rotation: 0,
                        zoom: 1,
                        lightIntensity: 1
                      });
                    }}
                    className={`rounded-2xl border-2 p-4 text-left transition-all duration-200 ease-out ${
                      isActive
                        ? 'border-violet-500 bg-violet-50/60 shadow-lg shadow-violet-500/10 -translate-y-0.5'
                        : 'border-violet-500/20 bg-white/50 backdrop-blur-[20px] hover:-translate-y-0.5 hover:border-violet-400/50 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-base font-semibold text-[#0f172a]">{experiment.title}</p>
                      <span className={`text-xs font-semibold uppercase ${isActive ? 'text-violet-700' : 'text-[#8e9aaf]'}`}>
                        {experiment.difficulty}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#64748b]">{experiment.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#64748b]">
                      <span className="rounded-full border border-violet-500/25 bg-white/70 px-3 py-1 font-mono text-[#334155]">{experiment.formula}</span>
                      {experiment.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full border border-violet-500/20 bg-violet-50/50 px-3 py-1">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assignment;