import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Book,
  FileText,
  Download,
  Search as SearchIcon,
  Coins,
  X,
  ChevronRight,
  User,
  Star,
  SendHorizonal,
  Paperclip,
  Award,
  Upload,
  FlaskConical
} from "lucide-react";
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { addPoints, hasAward, markAwarded } from '../utils/points';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import { fetchCachedJson, clearStudentApiCacheByUrl } from '../utils/studentApiCache';

const labModelUrl = (file) => new URL(`../models/${file}`, import.meta.url).href;

const LAB_EXPERIMENTS = [
  {
    id: 'water',
    title: 'Water Molecule',
    formula: 'H2O',
    field: 'Chemistry',
    difficulty: 'Beginner',
    model: labModelUrl('h2o-model.glb'),
    summary: 'Visualize bent geometry and polarity in one of the most familiar molecules on Earth.',
    focus: ['Bent geometry', 'Hydrogen bonding', 'Partial charges'],
    steps: [
      'Begin from the side to estimate the roughly 104.5 deg bond angle.',
      'Rotate so that a hydrogen points toward you while talking about polarity.',
      'Use the zoom slider to highlight how lone pairs push the hydrogens downward.'
    ],
    safety: 'Use this demo to talk about polar liquids before handling any actual reagents.',
    tags: ['Molecule', 'Polarity', 'Bond angles']
  },
  {
    id: 'carbon-dioxide',
    title: 'Carbon Dioxide',
    formula: 'CO2',
    field: 'Chemistry',
    difficulty: 'Beginner',
    model: labModelUrl('co2.glb'),
    summary: 'Study a linear molecule with two double bonds and perfect symmetry.',
    focus: ['Linear geometry', 'Double bonds', 'Symmetry'],
    steps: [
      'Observe the equal spacing between the oxygens and carbon.',
      'Rotate 90 deg so learners see the molecule stays linear from every angle.',
      'Zoom in on the double bonds and compare to single bond lengths.'
    ],
    safety: 'Discuss ventilation and monitoring when real CO2 is released in a lab.',
    tags: ['Molecule', 'Linear', 'Gas']
  },
  {
    id: 'methane',
    title: 'Methane',
    formula: 'CH4',
    field: 'Chemistry',
    difficulty: 'Beginner',
    model: labModelUrl('methane.glb'),
    summary: 'Demonstrate a tetrahedral molecule and sp3 hybridization.',
    focus: ['Tetrahedral geometry', 'Hybrid orbitals', 'Hydrocarbon'],
    steps: [
      'Align one C-H bond with the camera to show trigonal projections.',
      'Rotate continuously to talk about the symmetry of sp3 bonds.',
      'Zoom close to compare bond lengths and identical angles.'
    ],
    safety: 'Review open flame precautions because methane is highly flammable.',
    tags: ['Hydrocarbon', 'Geometry', 'Gas']
  },
  {
    id: 'ethane',
    title: 'Ethane',
    formula: 'C2H6',
    field: 'Organic',
    difficulty: 'Intermediate',
    model: labModelUrl('ethane.glb'),
    summary: 'Compare staggered and eclipsed conformations by rotating the sigma bond.',
    focus: ['Sigma bonds', 'Conformations', 'Torsional strain'],
    steps: [
      'Look down the C-C bond to see the staggered arrangement.',
      'Adjust rotation slowly to move toward an eclipsed view.',
      'Discuss how torsional strain increases as hydrogens overlap.'
    ],
    safety: 'Relate the model to safe handling of low boiling hydrocarbons.',
    tags: ['Hydrocarbon', 'Conformations', 'Rotation']
  },
  {
    id: 'ethanol',
    title: 'Ethanol',
    formula: 'C2H5OH',
    field: 'Organic',
    difficulty: 'Intermediate',
    model: labModelUrl('ethanol.glb'),
    summary: 'Highlight the hydroxyl functional group and hydrogen bonding sites.',
    focus: ['Functional groups', 'Hydrogen bonding', 'Organic structure'],
    steps: [
      'Rotate to isolate the O-H group and identify the polar region.',
      'Compare carbon backbone flexibility versus rigid O-H bond.',
      'Zoom out and point out how polarity influences solubility.'
    ],
    safety: 'Remind learners about flammability and ventilation when using alcohols.',
    tags: ['Alcohol', 'Polarity', 'Functional group']
  },
  {
    id: 'glucose',
    title: 'Glucose',
    formula: 'C6H12O6',
    field: 'Biochemistry',
    difficulty: 'Advanced',
    model: labModelUrl('glucose.glb'),
    summary: 'Observe a monosaccharide ring and the orientation of hydroxyl groups.',
    focus: ['Ring formation', 'Chirality', 'Hydroxyl pattern'],
    steps: [
      'Start with the ring laying flat to label carbon numbers.',
      'Rotate to show axial versus equatorial hydroxyl positions.',
      'Zoom in on the anomeric carbon to discuss alpha and beta forms.'
    ],
    safety: 'Use food safe sugars for physical demos, but still stress clean benches.',
    tags: ['Biomolecule', 'Carbohydrate', 'Ring structure']
  },
  {
    id: 'sucrose',
    title: 'Sucrose',
    formula: 'C12H22O11',
    field: 'Biochemistry',
    difficulty: 'Advanced',
    model: labModelUrl('SUCROSE.glb'),
    summary: 'Show how two sugar rings connect through a glycosidic linkage.',
    focus: ['Glycosidic bond', 'Disaccharide', 'Hydroxyl network'],
    steps: [
      'Identify each ring (glucose and fructose) with the camera centered.',
      'Trace the bonding oxygen that links the two monosaccharides.',
      'Zoom in to count hydrogen bond donors across the entire molecule.'
    ],
    safety: 'Point out how sticky sugars demand wipe downs to avoid pests.',
    tags: ['Disaccharide', 'Biomolecule', 'Linkage']
  },
  {
    id: 'benzene',
    title: 'Benzene',
    formula: 'C6H6',
    field: 'Organic',
    difficulty: 'Intermediate',
    model: labModelUrl('benzene.glb'),
    summary: 'Explore aromaticity, planarity, and delocalized electrons.',
    focus: ['Aromatic ring', 'Delocalized pi system', 'Planar structure'],
    steps: [
      'View the ring edge on to stress planarity.',
      'Rotate 90 deg to show pi clouds above and below the ring.',
      'Compare bond lengths to show that they are equal due to resonance.'
    ],
    safety: 'Discuss fume hood requirements for volatile aromatic solvents.',
    tags: ['Aromatic', 'Resonance', 'Planar']
  },
  {
    id: 'ammonia',
    title: 'Ammonia',
    formula: 'NH3',
    field: 'Chemistry',
    difficulty: 'Beginner',
    model: labModelUrl('amonia.glb'),
    summary: 'Highlight trigonal pyramidal geometry and lone pair effects.',
    focus: ['Trigonal pyramidal', 'Lone pair', 'Bond angles'],
    steps: [
      'Orient the nitrogen on top to show the pyramid shape.',
      'Rotate slowly to visualize the lone pair region.',
      'Use zoom to compare the NH bond lengths with other molecules.'
    ],
    safety: 'Emphasize goggles and ventilation for any ammonia handling.',
    tags: ['Molecule', 'Lone pair', 'Geometry']
  },
  {
    id: 'nitric-acid',
    title: 'Nitric Acid',
    formula: 'HNO3',
    field: 'Chemistry',
    difficulty: 'Advanced',
    model: labModelUrl('nitric acidglb.glb'),
    summary: 'Showcase resonance structures and the acidic proton.',
    focus: ['Resonance', 'Strong acid', 'NO3 group'],
    steps: [
      'Point out the hydrogen attached to oxygen and why it is acidic.',
      'Rotate to illustrate the trigonal planar nitrate arrangement.',
      'Zoom in on N-O bonds to compare resonance stabilized lengths.'
    ],
    safety: 'Review strict PPE, gloves, and neutralization plans for strong acids.',
    tags: ['Acid', 'Resonance', 'Oxoacid']
  },
  {
    id: 'phenolphthalein',
    title: 'Phenolphthalein Indicator',
    formula: 'C20H14O4',
    field: 'Analytical',
    difficulty: 'Advanced',
    model: labModelUrl('phenlopthalin.glb'),
    summary: 'Study a conjugated system used to visualize pH changes.',
    focus: ['Conjugation', 'Indicator chemistry', 'Resonance'],
    steps: [
      'Highlight the two benzene like rings and connecting lactone.',
      'Rotate to show how conjugation extends across the molecule.',
      'Discuss how structure changes in basic solution to create color.'
    ],
    safety: 'Remind students to avoid ingestion and to wash hands after indicator use.',
    tags: ['Indicator', 'Organic', 'Conjugated system']
  },
  {
    id: 'trinitrotoluene',
    title: 'Trinitrotoluene (TNT)',
    formula: 'C7H5N3O6',
    field: 'Chemistry',
    difficulty: 'Advanced',
    model: labModelUrl('trinitrotolune.glb'),
    summary: 'Investigate nitro substitutions on an aromatic ring.',
    focus: ['Nitro groups', 'Aromatic substitution', 'Energetic material'],
    steps: [
      'Identify the methyl group and each nitro substituent.',
      'Rotate to see how the nitro groups sit slightly out of plane.',
      'Discuss electron withdrawing effects and stability considerations.'
    ],
    safety: 'Use this only as a visualization; never attempt to synthesize TNT in school labs.',
    tags: ['Aromatic', 'Nitro', 'Explosive']
  },
  {
    id: 'trinitrophenol',
    title: '2,4,6-Trinitrophenol',
    formula: 'C6H3N3O7',
    field: 'Chemistry',
    difficulty: 'Advanced',
    model: labModelUrl('246-trinitro.glb'),
    summary: 'Compare a phenol core with three nitro substituents.',
    focus: ['Phenol', 'Nitro substitution', 'Acid strength'],
    steps: [
      'Show the phenolic hydroxyl and how it interacts with nitro groups.',
      'Rotate to compare substitution positions around the ring.',
      'Zoom to explain why the molecule is acidic and energetic.'
    ],
    safety: 'Discuss storage rules for energetic compounds and why schools use simulations.',
    tags: ['Phenol', 'Nitro', 'Acidic']
  },
];

const Assignment = ({ assignmentType, filter, setFilter }) => {
  const location = useLocation();
  // School assignment state
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolSort, setSchoolSort] = useState("due_asc");
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFileUrl, setSubmissionFileUrl] = useState('');
  const [submissionFileName, setSubmissionFileName] = useState('');
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

  // Fetch assignments from API
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

      // Transform API data to match component structure
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

  const handleExperimentSelect = (experimentId) => {
    if (experimentId === selectedExperimentId) {
      setLabRefreshKey((key) => key + 1);
      return;
    }
    setSelectedExperimentId(experimentId);
    setLabControls({
      rotation: 0,
      zoom: 1,
      lightIntensity: 1
    });
  };

  const retryLabLoad = () => setLabRefreshKey((key) => key + 1);

const openDetail = (assignment) => {
  setSelectedAssignment(assignment);
  setSubmissionText(assignment.submissionText || '');
  setSubmitSuccess(false);
  setSubmissionFileUrl(assignment.submissionAttachmentUrl || '');
  setSubmissionFileName(getFileNameFromUrl(assignment.submissionAttachmentUrl));
};

const closeDetail = () => {
  setSelectedAssignment(null);
  setSubmissionText('');
  setSubmitSuccess(false);
  setSubmissionFileUrl('');
  setSubmissionFileName('');
};

  const handleSubmit = async () => {
    const requiresPdfUpload = selectedAssignment?.submissionFormat === 'pdf';
    if (!requiresPdfUpload && !submissionText.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: 'Submission required',
        text: 'Please write something before submitting.',
      });
      return;
    }
    if (requiresPdfUpload && !submissionFileUrl) {
      await Swal.fire({
        icon: 'warning',
        title: 'PDF required',
        text: 'Please upload your PDF before submitting.',
      });
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
      // Refresh list so card status updates
      clearStudentApiCacheByUrl(ASSIGNMENTS_ENDPOINT);
      await fetchAssignments({ forceRefresh: true });
      // Update the open modal card too
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
      await Swal.fire({
        icon: 'error',
        title: 'Submission failed',
        text: err.response?.data?.error || 'Failed to submit. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmissionFileUpload = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      await Swal.fire({
        icon: 'warning',
        title: 'Invalid file',
        text: 'Please upload a PDF file.',
      });
      input.value = '';
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      await Swal.fire({
        icon: 'warning',
        title: 'File too large',
        text: 'File size must be under 20MB.',
      });
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
    } catch (error) {
      console.error('Assignment submission upload failed:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Upload failed',
        text: 'Failed to upload PDF. Please try again.',
      });
      setSubmissionFileUrl('');
      setSubmissionFileName('');
    } finally {
      input.value = '';
      setUploadingSubmissionFile(false);
    }
  };

  const removeSubmissionFile = () => {
    setSubmissionFileUrl('');
    setSubmissionFileName('');
  };

  const questionData = {
    '6': {
      'math': {
        'mcq': [
          { q: 'What is 7+5?', o: ['10', '11', '12', '13'], a: '12', e: 'Simple addition' },
          { q: 'What is 8*6?', o: ['42', '48', '54', '56'], a: '48', e: 'Multiplication' }
        ],
        'blank': [
          { q: 'Fill in the blank: 9 - 4 = ___', a: '5', e: 'Simple subtraction' }
        ]
      },
      'science': {
        'mcq': [
          { q: 'What planet is closest to the Sun?', o: ['Venus', 'Mercury', 'Earth', 'Mars'], a: 'Mercury', e: 'Mercury is the closest planet to the Sun' }
        ],
        'blank': [
          { q: 'The process by which plants make food is called ___', a: 'photosynthesis', e: 'Plants use sunlight to make food' }
        ]
      }
    },
    '7': {
      'math': {
        'mcq': [
          { q: 'What is 12*7?', o: ['82', '84', '86', '88'], a: '84', e: 'Multiplication' },
          { q: 'What is 15/3?', o: ['3', '4', '5', '6'], a: '5', e: 'Division' }
        ],
        'blank': [
          { q: 'Fill in the blank: 16 + 9 = ___', a: '25', e: 'Simple addition' }
        ]
      },
      'science': {
        'mcq': [
          { q: 'What is the chemical symbol for gold?', o: ['Go', 'Gd', 'Au', 'Ag'], a: 'Au', e: 'Gold has the chemical symbol Au' }
        ],
        'blank': [
          { q: 'The largest organ in the human body is the ___', a: 'skin', e: 'Skin is the largest organ' }
        ]
      }
    }
  };

  // Helper functions
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

  const getAssignmentPresentation = (assignment) => {
    const rawStatus = String(assignment?.submissionStatus || '').toLowerCase();
    if (rawStatus === 'graded' || assignment?.status === 'completed') {
      return {
        badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        cardAccentClass: 'border-l-emerald-500',
        iconClass: 'text-emerald-600',
        summaryBucket: 'completed',
      };
    }
    if (rawStatus === 'late') {
      return {
        badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
        cardAccentClass: 'border-l-amber-500',
        iconClass: 'text-amber-600',
        summaryBucket: 'submittedLate',
      };
    }
    if (rawStatus === 'submitted') {
      return {
        badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
        cardAccentClass: 'border-l-sky-500',
        iconClass: 'text-sky-600',
        summaryBucket: 'submitted',
      };
    }
    if (assignment?.status === 'overdue') {
      return {
        badgeClass: 'border-red-200 bg-red-50 text-red-700',
        cardAccentClass: 'border-l-red-500',
        iconClass: 'text-red-600',
        summaryBucket: 'overdue',
      };
    }
    return {
      badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
      cardAccentClass: 'border-l-slate-400',
      iconClass: 'text-slate-600',
      summaryBucket: 'toSubmit',
    };
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'overdue': return <AlertCircle className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-yellow-600" />;
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

  // Filtered assignments logic
  const filteredAssignments = assignments
    .filter((assignment) => {
      const title = String(assignment.title || '');
      const course = String(assignment.course || '');
      const description = String(assignment.description || '');
      const needle = schoolSearch.toLowerCase();
      const matchesSearch = title.toLowerCase().includes(needle) ||
        course.toLowerCase().includes(needle) ||
        description.toLowerCase().includes(needle);
      
      if (!matchesSearch) return false;
      
      if (filter === 'all') return true;
      if (filter === 'pending') return assignment.status === 'pending' && !['submitted', 'late'].includes(assignment.submissionStatus);
      if (filter === 'submitted') return ['submitted', 'late'].includes(assignment.submissionStatus);
      if (filter === 'completed') return assignment.status === 'completed';
      if (filter === 'overdue') return assignment.status === 'overdue';
      
      return true;
    })
    .sort((a, b) => {
      const weight = { high: 3, medium: 2, low: 1 };
      const order = { overdue: 3, pending: 2, completed: 1 };
      
      if (schoolSort === 'due_asc') {
        return new Date(a.dueDate) - new Date(b.dueDate);
      } else if (schoolSort === 'due_desc') {
        return new Date(b.dueDate) - new Date(a.dueDate);
      } else if (schoolSort === 'priority') {
        return (weight[b.priority] || 0) - (weight[a.priority] || 0);
      } else if (schoolSort === 'status') {
        return (order[b.status] || 0) - (order[a.status] || 0);
      }
      return 0;
    });

  const assignmentSummary = assignments.reduce((acc, assignment) => {
    const presentation = getAssignmentPresentation(assignment);
    acc.total += 1;
    acc[presentation.summaryBucket] += 1;
    return acc;
  }, {
    total: 0,
    toSubmit: 0,
    submitted: 0,
    submittedLate: 0,
    completed: 0,
    overdue: 0,
  });

  // Lab effects
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

    // Configure DRACOLoader for compressed models - using local decoder files
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);

    let modelGroup = null;

    console.log('Loading model:', selectedExperiment.title);
    console.log('Model URL:', selectedExperiment.model);

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
        // Optional: log loading progress
        if (progress.lengthComputable) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log(`Loading model: ${Math.round(percentComplete)}%`);
        }
      },
      (error) => {
        console.error('Virtual lab model failed to load:', error);
        console.error('Model path:', selectedExperiment.model);
        console.error('Error details:', error.message || error);
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

  // Practice handlers
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

  // Flashcard effects
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

  // MCQ and Blank components
  const MCQ = ({ questions = [] }) => {
    return (
      <div className="space-y-6">
        {questions.map((q, idx) => {
          const answer = practiceAnswers[q.id] || '';
          const result = practiceResults?.[String(q.id)] || null;
          return (
          <div key={q.id || idx} className="mb-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                    {idx + 1}
                  </div>
                  <p className="text-sm font-semibold text-slate-800">Question {idx + 1}</p>
                </div>
                {result && (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${result.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {result.isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                )}
              </div>
              <div className="p-4 sm:p-6">
                <div className="text-slate-900 font-medium">{q.question}</div>
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
                        : 'border-slate-200'
                      : selected
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50';
                    return (
                      <label
                        key={oidx}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${borderColor}`}
                      >
                        <input
                          type="radio"
                          name={`q${idx}`}
                          value={option}
                          checked={selected}
                          onChange={(e) => handlePracticeAnswer(q.id, e.target.value)}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700">{option}</span>
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
                      <div className="mt-2 text-slate-700">
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
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">{idx + 1}</div>
                  <div className="flex-1">
                    <div className="text-gray-900 font-medium">{q.question}</div>
                    <div className="mt-3">
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Type your answer here..."
                        value={answer}
                        onChange={(e) => handlePracticeAnswer(q.id, e.target.value)}
                      />
                    </div>
                    {showAnswers && result && (
                      <div className={`mt-3 rounded-lg border p-3 text-sm ${result.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className={result.isCorrect ? 'text-green-800' : 'text-red-800'}>
                          <span className="font-semibold">Your answer:</span> {answer || '-'} {result.isCorrect ? '✓' : '✗'}
                        </div>
                        {!result.isCorrect && (
                          <div className="text-green-800 mt-1">
                            <span className="font-semibold">Correct answer:</span> {result.correctAnswer}
                          </div>
                        )}
                        {result.explanation && <div className="text-gray-700 mt-1"><span className="font-semibold">Explanation:</span> {result.explanation}</div>}
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

  if (assignmentType === 'school') {
    return (
      <>
        {/* Controls */}
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder="Search assignments..."
                className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 outline-none text-sm transition-all"
              />
            </div>
            {/* Sort */}
            <select
              value={schoolSort}
              onChange={(e) => setSchoolSort(e.target.value)}
              className="shrink-0 px-3 py-2.5 rounded-2xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 outline-none text-sm"
            >
              <option value="due_asc">Due ↑</option>
              <option value="due_desc">Due ↓</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
            </select>
          </div>
          {/* Filter chips — horizontal scroll on mobile */}
          <div className="flex overflow-x-auto gap-2 pb-0.5 scrollbar-hide">
            {[
              { key: 'all', label: 'All', activeClass: 'bg-slate-800 border-slate-800' },
              { key: 'pending', label: 'To Submit', activeClass: 'bg-amber-500 border-amber-500' },
              { key: 'submitted', label: 'Submitted', activeClass: 'bg-sky-500 border-sky-500' },
              { key: 'completed', label: 'Completed', activeClass: 'bg-emerald-500 border-emerald-500' },
              { key: 'overdue', label: 'Overdue', activeClass: 'bg-rose-500 border-rose-500' },
            ].map(({ key, label, activeClass }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${
                  filter === key
                    ? `${activeClass} text-white shadow-md`
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total', value: assignmentSummary.total, icon: FileText, grad: 'from-indigo-500 to-blue-600', shadow: 'shadow-indigo-200/60' },
            { label: 'To Submit', value: assignmentSummary.toSubmit, icon: Clock, grad: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-200/60' },
            { label: 'Submitted', value: assignmentSummary.submitted + assignmentSummary.submittedLate, icon: Upload, grad: 'from-sky-400 to-blue-500', shadow: 'shadow-sky-200/60', sub: assignmentSummary.submittedLate > 0 ? `${assignmentSummary.submittedLate} late` : '' },
            { label: 'Completed', value: assignmentSummary.completed, icon: CheckCircle, grad: 'from-emerald-400 to-teal-600', shadow: 'shadow-emerald-200/60' },
            { label: 'Overdue', value: assignmentSummary.overdue, icon: AlertCircle, grad: 'from-rose-500 to-red-600', shadow: 'shadow-rose-200/60' },
          ].map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div
                key={stat.label}
                className={`relative overflow-hidden rounded-2xl bg-linear-to-br ${stat.grad} p-3 shadow-lg ${stat.shadow} transition-transform hover:-translate-y-0.5 md:p-4`}
              >
                <div className="pointer-events-none absolute -right-3 -top-3 h-14 w-14 rounded-full bg-white/10" />
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-white/80">{stat.label}</p>
                    <p className="mt-0.5 text-2xl font-black text-white">{stat.value}</p>
                    {stat.sub && <p className="mt-1 text-[10px] font-semibold text-white/70">{stat.sub}</p>}
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                    <StatIcon className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Assignments Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Clock className="w-10 h-10 text-indigo-400 animate-spin" />
            <p className="text-slate-400 text-sm">Loading assignments...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredAssignments.map((assignment) => {
                const days = getDaysRemaining(assignment.dueDate);
                const daysText = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`;
                const daysColor = days < 0 ? 'text-red-600 bg-red-50 border-red-200' : days <= 3 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-green-700 bg-green-50 border-green-200';
                const requiresPdf = assignment.submissionFormat === 'pdf';
                const presentation = getAssignmentPresentation(assignment);
                const isGraded = assignment.submissionStatus === 'graded';
                const hasScore = isGraded && assignment.score !== undefined && assignment.score !== null;
                return (
                  <div
                    key={assignment.id}
                    onClick={() => openDetail(assignment)}
                    className={`group bg-white rounded-3xl border border-slate-100 border-l-4 ${presentation.cardAccentClass} shadow-sm active:scale-[0.99] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden`}
                  >
                    <div className="p-4 sm:p-5">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug flex-1">{assignment.title}</h3>
                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border ${presentation.badgeClass}`}>
                          {assignment.statusLabel || assignment.status}
                        </span>
                      </div>

                      {/* Course + Teacher */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-2.5">
                        {assignment.course && (
                          <span className="inline-flex items-center gap-1 text-xs text-indigo-700 font-bold bg-indigo-50 px-2.5 py-1 rounded-full">
                            <Book className="w-3 h-3" />{assignment.course}
                          </span>
                        )}
                        {assignment.teacherName && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <User className="w-3 h-3" />{assignment.teacherName}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {assignment.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">{assignment.description}</p>
                      )}

                      {/* Footer row */}
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                          {isGraded ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold text-emerald-700 bg-emerald-50 border-emerald-200">
                              <Award className="w-3 h-3" />Graded
                            </span>
                          ) : assignment.dueDate && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${daysColor}`}>
                              <Calendar className="w-3 h-3" />{daysText}
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${requiresPdf ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                            {requiresPdf ? <Paperclip className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                            {requiresPdf ? 'PDF' : 'Text'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {hasScore ? (
                            <span className="text-[11px] text-emerald-700 font-bold">{assignment.score}/{assignment.maxMarks}</span>
                          ) : assignment.maxMarks ? (
                            <span className="text-[11px] text-slate-400 font-semibold">{assignment.maxMarks}mk</span>
                          ) : null}
                          {assignment.attachments?.length > 0 && (
                            <span className="text-[11px] text-indigo-500 flex items-center gap-0.5">
                              <Paperclip className="w-3 h-3" />{assignment.attachments.length}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-300 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredAssignments.length === 0 && (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <div className="p-4 bg-linear-to-br from-indigo-50 to-purple-50 rounded-2xl">
                  <FileText className="w-10 h-10 text-indigo-300" />
                </div>
                <p className="font-bold text-slate-600">No assignments found</p>
                <p className="text-sm text-slate-400">
                  {filter === 'submitted'
                    ? 'No submitted assignments match this search right now.'
                    : filter === 'completed'
                      ? 'No completed assignments match this search right now.'
                      : filter === 'overdue'
                        ? 'No overdue assignments match this search right now.'
                        : filter === 'pending'
                          ? 'No unsubmitted assignments match this search right now.'
                          : 'Try changing the filter or search term.'}
                </p>
              </div>
            )}
          </>
        )}

        {/* ── Detail Modal ── */}
        {selectedAssignment && (() => {
          const a = selectedAssignment;
          const presentation = getAssignmentPresentation(a);
          const days = getDaysRemaining(a.dueDate);
          const daysText = days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `${days} days remaining`;
          const daysColor = days < 0 ? 'text-red-600 bg-red-50 border-red-200' : days <= 3 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-green-700 bg-green-50 border-green-200';
          const isGraded = a.submissionStatus === 'graded';
          const isSubmitted = ['submitted', 'late', 'graded'].includes(a.submissionStatus);
          const isLateSubmission = a.submissionStatus === 'late';
          const isOverdue = a.status === 'overdue';
          const requiresPdfUpload = a.submissionFormat === 'pdf';
          const uploadInputId = `assignment-upload-${a.id}`;
          const canSubmitAssignment = requiresPdfUpload ? Boolean(submissionFileUrl) : Boolean(submissionText.trim());

          return (
            <div
              className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4"
              style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
              onClick={closeDetail}
            >
              <div
                className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                onClick={e => e.stopPropagation()}
              >
                {/* Drag handle (mobile) */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                  <div className="w-10 h-1 rounded-full bg-gray-200" />
                </div>
                {/* Modal Header */}
                <div className={`px-4 sm:px-6 pt-3 sm:pt-6 pb-4 border-b border-gray-100 ${
                  presentation.summaryBucket === 'completed'
                    ? 'bg-emerald-50'
                    : presentation.summaryBucket === 'submittedLate'
                      ? 'bg-amber-50'
                      : presentation.summaryBucket === 'submitted'
                        ? 'bg-sky-50'
                        : presentation.summaryBucket === 'overdue'
                          ? 'bg-red-50'
                          : 'bg-slate-50'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`shrink-0 p-2 rounded-lg ${
                        presentation.summaryBucket === 'completed'
                          ? 'bg-emerald-100'
                          : presentation.summaryBucket === 'submittedLate'
                            ? 'bg-amber-100'
                            : presentation.summaryBucket === 'submitted'
                              ? 'bg-sky-100'
                              : presentation.summaryBucket === 'overdue'
                                ? 'bg-red-100'
                                : 'bg-slate-100'
                      }`}>
                        {getStatusIcon(a.status)}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold text-gray-900 leading-tight">{a.title}</h2>
                        {a.course && (
                          <p className="mt-1 text-sm text-gray-500 flex items-center gap-1">
                            <Book className="w-3.5 h-3.5" />{a.course}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={closeDetail}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-white/60 transition-colors text-gray-500"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Meta pills */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${presentation.badgeClass}`}>
                      {getStatusIcon(a.status)}
                      <span className="ml-0.5">{a.statusLabel || a.status}</span>
                    </span>
                    {isGraded && a.score !== undefined && a.score !== null ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Award className="w-3 h-3" />Scored {a.score}/{a.maxMarks}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${daysColor}`}>
                        <Clock className="w-3 h-3 mr-1" />{daysText}
                      </span>
                    )}
                    {!isGraded && a.maxMarks && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                        <Star className="w-3 h-3" />{a.maxMarks} marks
                      </span>
                    )}
                  </div>
                </div>

                {/* Modal Body */}
                <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">

                  {/* Info grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {a.teacherName && (
                      <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Teacher</p>
                          <p className="text-sm font-semibold text-gray-800 truncate">{a.teacherName}</p>
                        </div>
                      </div>
                    )}
                    {a.dueDate && (
                      <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
                        <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Due Date</p>
                          <p className="text-sm font-semibold text-gray-800">{formatDate(a.dueDate)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
                    <div className={`w-9 h-9 rounded-full ${requiresPdfUpload ? 'bg-purple-100' : 'bg-green-100'} flex items-center justify-center shrink-0`}>
                      {requiresPdfUpload ? (
                        <Upload className="w-4 h-4 text-purple-600" />
                      ) : (
                        <FileText className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Submission Format</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {requiresPdfUpload ? 'Upload PDF file' : 'Write directly in portal'}
                      </p>
                      <p className="text-xs text-gray-500">{requiresPdfUpload ? 'Attach a single PDF up to 20MB.' : 'Type your response and submit online.'}</p>
                    </div>
                  </div>

                  {/* Description */}
                  {a.description && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Instructions</h3>
                      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line bg-gray-50 rounded-xl p-4">
                        {a.description}
                      </p>
                    </div>
                  )}

                  {/* Attachments */}
                  {a.attachments?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Attachments</h3>
                      <div className="space-y-2">
                        {a.attachments.map((att, i) => (
                          <a
                            key={i}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-sm text-blue-700 font-medium truncate flex-1">{att.name || `Attachment ${i + 1}`}</span>
                            <Download className="w-4 h-4 text-blue-500 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grade / Feedback */}
                  {isGraded && a.score !== undefined && a.score !== null && (
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="w-5 h-5 text-green-600" />
                        <h3 className="text-sm font-semibold text-green-800">Result</h3>
                      </div>
                      <p className="text-2xl font-bold text-green-700">{a.score} <span className="text-base font-normal text-green-600">/ {a.maxMarks}</span></p>
                      {a.feedback && (
                        <p className="mt-2 text-sm text-green-700 bg-white/60 rounded-lg p-3">
                          <span className="font-medium">Feedback: </span>{a.feedback}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Submitted (no score yet) */}
                  {isSubmitted && !isGraded && (
                    <div className={`rounded-xl border p-4 flex items-center gap-3 ${isLateSubmission ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
                      <CheckCircle className={`w-5 h-5 shrink-0 ${isLateSubmission ? 'text-amber-600' : 'text-blue-600'}`} />
                      <div>
                        <p className={`text-sm font-semibold ${isLateSubmission ? 'text-amber-800' : 'text-blue-800'}`}>
                          {isLateSubmission ? 'Submitted Late' : 'Submitted'}
                        </p>
                        {a.submittedAt && (
                          <p className={`text-xs ${isLateSubmission ? 'text-amber-700' : 'text-blue-700'}`}>on {formatDate(a.submittedAt)}</p>
                        )}
                        <p className={`text-xs mt-1 ${isLateSubmission ? 'text-amber-700' : 'text-blue-700'}`}>
                          Waiting for teacher review.
                        </p>
                        <p className={`text-xs mt-1 ${isLateSubmission ? 'text-amber-700' : 'text-blue-700'}`}>
                          Submitted work is locked and cannot be edited or deleted.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Submitted answer */}
                  {isSubmitted && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Your Submission</h3>
                      {a.submissionText && (
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                          <p className="text-sm text-gray-700 whitespace-pre-line">{a.submissionText}</p>
                        </div>
                      )}
                      {a.submissionAttachmentUrl && (
                        <a
                          href={a.submissionAttachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-purple-600" />
                          </div>
                          <span className="text-sm text-purple-700 font-medium truncate flex-1">
                            {getFileNameFromUrl(a.submissionAttachmentUrl) || 'Submitted PDF'}
                          </span>
                          <Download className="w-4 h-4 text-purple-500 shrink-0" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Submit section */}
                  {!isSubmitted && !isGraded && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                        {isOverdue ? 'Submit (Late)' : requiresPdfUpload ? 'Upload Your PDF' : 'Your Answer'}
                      </h3>
                      {submitSuccess ? (
                        <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                          <p className="text-sm font-semibold text-green-800">Submitted successfully!</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {requiresPdfUpload ? (
                            <>
                              <div className="border-2 border-dashed border-purple-200 rounded-xl p-6 text-center bg-purple-50/40">
                                {uploadingSubmissionFile ? (
                                  <p className="text-sm text-purple-600">Uploading your file...</p>
                                ) : (
                                  <>
                                    <Upload className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                                    <p className="text-sm text-purple-800 mb-3">Drop your PDF here or use the button below.</p>
                                    <input
                                      type="file"
                                      accept="application/pdf"
                                      id={uploadInputId}
                                      className="hidden"
                                      onChange={handleSubmissionFileUpload}
                                    />
                                    <label
                                      htmlFor={uploadInputId}
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm cursor-pointer hover:bg-purple-700 transition-colors"
                                    >
                                      <Upload className="w-4 h-4" />
                                      Select PDF
                                    </label>
                                    <p className="text-xs text-purple-500 mt-2">Maximum file size: 20MB</p>
                                  </>
                                )}
                              </div>
                              {submissionFileUrl && (
                                <div className="flex items-center justify-between bg-white border border-purple-200 rounded-xl p-3">
                                  <div className="flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-purple-600" />
                                    <div>
                                      <p className="text-sm font-medium text-gray-800">{submissionFileName || 'Uploaded PDF'}</p>
                                      <a
                                        href={submissionFileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-purple-600 hover:underline"
                                      >
                                        Preview file
                                      </a>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={removeSubmissionFile}
                                    className="text-xs text-red-600 hover:text-red-700"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                              <textarea
                                value={submissionText}
                                onChange={e => setSubmissionText(e.target.value)}
                                rows={3}
                                placeholder="Add any notes for your teacher (optional)..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                              />
                            </>
                          ) : (
                            <textarea
                              value={submissionText}
                              onChange={e => setSubmissionText(e.target.value)}
                              rows={5}
                              placeholder="Write your answer or submission notes here..."
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                            />
                          )}
                          <button
                            onClick={handleSubmit}
                            disabled={submitting || !canSubmitAssignment}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                              isOverdue
                                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                : requiresPdfUpload
                                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <SendHorizonal className="w-4 h-4" />
                            {submitting ? 'Submitting…' : isOverdue ? 'Submit Late' : 'Submit Assignment'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </>
    );
  }

  if (assignmentType === 'flashcard') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label htmlFor="fcClass" className="font-medium text-gray-700">Class:</label>
          <select
            id="fcClass"
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="6">Class 6</option>
            <option value="7">Class 7</option>
            <option value="8">Class 8</option>
            <option value="9">Class 9</option>
            <option value="10">Class 10</option>
          </select>
        </div>
        <div className="text-center">
          <p className="text-gray-600">Flashcard functionality coming soon!</p>
        </div>
      </div>
    );
  }

  if (assignmentType === 'eec') {
    const correctCount = practiceResults ? Object.values(practiceResults).filter((r) => r.isCorrect).length : 0;
    const totalCount = practiceQuestions.length;
    const scorePercent = practiceResults && totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : null;

    return (
      <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm pb-24 md:pb-0">

        {/* Header */}
        <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-600 px-4 py-5 sm:px-6 sm:py-6">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 10% 80%, #fff 0, transparent 50%), radial-gradient(circle at 90% 10%, #fff 0, transparent 40%)' }} />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
                <span>📚</span>
                <span>EEC Practice</span>
              </div>
              <h2 className="text-xl font-bold text-white sm:text-2xl">Practice Paper</h2>
              <p className="mt-0.5 text-xs text-white/75">Challenge yourself with curated questions</p>
            </div>
            {practiceMeta && (
              <div className="shrink-0 rounded-xl bg-white/15 px-3 py-2 text-center backdrop-blur-sm">
                <p className="text-[10px] font-medium uppercase tracking-wide text-white/70">Class</p>
                <p className="text-sm font-bold text-white">
                  {practiceMeta.className}{practiceMeta.sectionName ? ` · ${practiceMeta.sectionName}` : ''}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Selectors */}
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Subject</label>
              <select
                value={practiceSubjectId}
                onChange={(e) => setPracticeSubjectId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {(practiceMeta?.subjects || []).map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Question Type</label>
              <select
                value={practiceType}
                onChange={(e) => setPracticeType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="mcq">Multiple Choice</option>
                <option value="blank">Fill in the Blank</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <span className="text-base">📝</span>
            <div>
              <p className="text-[10px] font-medium text-slate-400">Questions</p>
              <p className="text-sm font-bold text-slate-800">{totalCount}</p>
            </div>
          </div>
          {practiceResults && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${scorePercent >= 70 ? 'bg-emerald-50' : scorePercent >= 40 ? 'bg-amber-50' : 'bg-red-50'}`}>
              <span className="text-base">🎯</span>
              <div>
                <p className={`text-[10px] font-medium ${scorePercent >= 70 ? 'text-emerald-500' : scorePercent >= 40 ? 'text-amber-500' : 'text-red-500'}`}>Score</p>
                <p className={`text-sm font-bold ${scorePercent >= 70 ? 'text-emerald-700' : scorePercent >= 40 ? 'text-amber-700' : 'text-red-700'}`}>{correctCount}/{totalCount} · {scorePercent}%</p>
              </div>
            </div>
          )}
          <p className="ml-auto hidden text-xs text-slate-400 sm:block">Read carefully before answering</p>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {practiceError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="mt-0.5 shrink-0 text-base">⚠️</span>
              <span>{practiceError}</span>
            </div>
          )}
          {practiceLoading && (
            <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
              <svg className="h-5 w-5 animate-spin text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Loading questions...</span>
            </div>
          )}
          {!practiceLoading && practiceQuestions.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <span className="text-4xl">📭</span>
              <p className="text-sm font-medium text-slate-500">No questions available for this subject.</p>
            </div>
          )}
          {!practiceLoading && practiceQuestions.length > 0 && (
            practiceType === "mcq"
              ? <MCQ questions={practiceQuestions} />
              : <Blank questions={practiceQuestions} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              onClick={handlePracticeSubmit}
              disabled={practiceSubmitting || practiceQuestions.length === 0}
            >
              {practiceSubmitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>✅</span>
                  <span>Submit Answers</span>
                </>
              )}
            </button>
            <button
              className={`flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
                showAnswers
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
              onClick={() => setShowAnswers(!showAnswers)}
              disabled={!practiceResults}
            >
              <span>{showAnswers ? '🙈' : '💡'}</span>
              <span>{showAnswers ? 'Hide Explanations' : 'Show Explanations'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (assignmentType === 'lab') {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <FlaskConical className="h-4 w-4" />
                Virtual Lab
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Interactive Molecule Explorer</h2>
              <p className="text-sm text-slate-600">Load high fidelity GLB assets directly from the lab library and inspect them with real time controls.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1">{LAB_EXPERIMENTS.length}+ curated models</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1">Three.js powered viewer</span>
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
                      onClick={retryLabLoad}
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
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Model Details</h3>
              <p className="mt-1 text-sm text-slate-600">{selectedExperiment?.summary}</p>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Field</dt>
                  <dd className="font-semibold text-slate-800">{selectedExperiment?.field}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Difficulty</dt>
                  <dd className="font-semibold text-slate-800">{selectedExperiment?.difficulty}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Formula</dt>
                  <dd className="font-mono text-base text-slate-900">{selectedExperiment?.formula}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Focus</dt>
                  <dd className="text-slate-700">{selectedExperiment?.focus?.[0] || 'Key concept'}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {(selectedExperiment?.focus || []).map((concept) => (
                  <span key={concept} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    {concept}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Lab Controls</h3>
              <div className="mt-4 space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Model Rotation ({Math.round(labControls.rotation)}°)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={labControls.rotation}
                    onChange={(e) => setLabControls((prev) => ({ ...prev, rotation: parseInt(e.target.value, 10) }))}
                    className="h-2 w-full cursor-pointer rounded-full bg-slate-200"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Zoom ({labControls.zoom.toFixed(1)}x)
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={labControls.zoom}
                    onChange={(e) => setLabControls((prev) => ({ ...prev, zoom: parseFloat(e.target.value) }))}
                    className="h-2 w-full cursor-pointer rounded-full bg-slate-200"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Light Intensity ({labControls.lightIntensity.toFixed(1)})
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="2"
                    step="0.1"
                    value={labControls.lightIntensity}
                    onChange={(e) => setLabControls((prev) => ({ ...prev, lightIntensity: parseFloat(e.target.value) }))}
                    className="h-2 w-full cursor-pointer rounded-full bg-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
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

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Experiment Library</h3>
              <p className="text-sm text-slate-600">Pick any molecule to load it in the viewer instantly.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1">Chemistry & Biology</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-1">Interactive GLB files</span>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {LAB_EXPERIMENTS.map((experiment) => {
              const isActive = experiment.id === selectedExperiment?.id;
              return (
                <button
                  type="button"
                  key={experiment.id}
                  onClick={() => handleExperimentSelect(experiment.id)}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    isActive
                      ? 'border-blue-600 bg-blue-50 shadow-lg shadow-blue-100'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-semibold text-slate-900">{experiment.title}</p>
                    <span className={`text-xs font-semibold uppercase ${isActive ? 'text-blue-700' : 'text-slate-500'}`}>
                      {experiment.difficulty}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{experiment.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-slate-700">{experiment.formula}</span>
                    {experiment.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
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
    );
  }

  return null;
};

export default Assignment;
