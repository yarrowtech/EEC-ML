import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Users, Search, TrendingUp, TrendingDown, BarChart3, Award, Target,
  Calendar, Eye, FileText, AlertCircle, Minus, ChevronDown, ChevronRight, ChevronLeft, Loader2,
  X, RefreshCcw, AlertTriangle, Brain, BookOpen, Clock, Filter,
  Play, CheckCircle, XCircle, ArrowRight, ArrowUp, Lightbulb, Star,
  Activity, TrendingUp as TrendingUpIcon, Gauge, HandHelping, Heart, Sparkle,
  GraduationCap as GraduationCapIcon, Download, Flag, ArrowUpDown, MoreHorizontal, BarChart2, Trash2, LayoutGrid as LayoutGridIcon, MessageSquare as MessageIcon,
} from 'lucide-react';
import { cachedFetch, invalidateTeacherAnalytics } from '../utils/teacherAnalyticsCache';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

// ═════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════
const getScoreColor = (score) => {
  if (score >= 90) return 'text-emerald-600';
  if (score >= 75) return 'text-blue-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
};

const getBarColor = (score) => {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 75) return 'bg-blue-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
};

const getInterventionColor = (level) => {
  switch (level) {
    case 'critical': return 'text-red-600 bg-red-50 border-red-200';
    case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    default: return 'text-blue-600 bg-blue-50 border-blue-200';
  }
};

const getInterventionIcon = (level) => {
  switch (level) {
    case 'critical': return <XCircle className="w-4 h-4" />;
    case 'high': return <AlertCircle className="w-4 h-4" />;
    case 'medium': return <AlertTriangle className="w-4 h-4" />;
    default: return <CheckCircle className="w-4 h-4" />;
  }
};

const TrendIcon = ({ trend }) => {
  if (trend === 'improving') return <TrendingUp size={14} className="text-emerald-500" />;
  if (trend === 'declining') return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
};

const formatClassLabel = (classId) => {
  if (!classId || classId === 'current') return 'Current Class';
  return decodeURIComponent(classId)
    .split('-')
    .map((part) => part.toUpperCase())
    .join('-');
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
// Parse "5-a" → { grade: "5", section: "A" }
const parseClassSlug = (slug) => {
  if (!slug || slug === 'current') return { grade: '', section: '' };
  const parts = decodeURIComponent(slug).split('-');
  return { grade: parts[0] || '', section: (parts[1] || '').toUpperCase() };
};

const StudentAnalyticsPortal = () => {
  const navigate = useNavigate();
  const { classId = 'current' } = useParams();
  const classLabel = formatClassLabel(classId);
  const { grade: ctxGrade, section: ctxSection } = parseClassSlug(classId);
  // Tab strip arrow scrolling
  const tabStripRef = useRef(null);
  const [tabScroll, setTabScroll] = useState({ left: false, right: false });
  const updateTabScroll = useCallback(() => {
    const el = tabStripRef.current;
    if (!el) return;
    setTabScroll({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);
  const scrollTabs = (direction) => {
    const el = tabStripRef.current;
    if (el) el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.6), behavior: 'smooth' });
  };
  useEffect(() => {
    updateTabScroll();
    window.addEventListener('resize', updateTabScroll);
    return () => window.removeEventListener('resize', updateTabScroll);
  }, [updateTabScroll]);
  const [activeTab, setActiveTab] = useState('progress'); // 'progress' | 'intervention' | 'misconceptions' | 'gaps' | 'forecast' | 'mastery-growth'

  // ─────────────────────────────────────────────────────────────────────────
  // PROGRESS TAB STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [classOptions, setClassOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [filters, setFilters] = useState({ grade: ctxGrade, section: ctxSection, subject: '' });
  const [searchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // INTERVENTION TAB STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [weakStudents, setWeakStudents] = useState([]);
  const [interventionFilters, setInterventionFilters] = useState({
    subject: '',
    interventionLevel: ''
  });
  const [interventionSearch, setInterventionSearch] = useState('');
  const [loadingWeak, setLoadingWeak] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedWeakStudent, setSelectedWeakStudent] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH PROGRESS DATA
  // ─────────────────────────────────────────────────────────────────────────
  const fetchProgressData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.grade) params.set('grade', filters.grade);
      if (filters.section) params.set('section', filters.section);
      if (filters.subject) params.set('subject', filters.subject);

      const [studentsRes, analyticsRes] = await Promise.all([
        cachedFetch(`${API_BASE}/api/progress/students?${params}`, { headers: authHeaders() }),
        cachedFetch(`${API_BASE}/api/progress/analytics?${params}`, { headers: authHeaders() }),
      ]);

      if (studentsRes.ok) {
        const data = await studentsRes.json();
        setStudents(Array.isArray(data) ? data : []);
      } else {
        const fallbackRes = await cachedFetch(`${API_BASE}/api/teacher/dashboard/students`, { headers: authHeaders() });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          setClassOptions((fallbackData.classes || []).map(c => typeof c === 'string' ? c : c.name));
          setSectionOptions((fallbackData.sections || []).map(s => typeof s === 'string' ? s : s.name));
          const allStudents = fallbackData.students || [];
          // Filter to the class/section from the URL slug so we only show relevant students
          const scoped = allStudents.filter((s) => {
            const sGrade = String(s.grade || s.className || '').trim();
            const sSection = String(s.section || s.sectionName || '').trim().toUpperCase();
            const gradeOk = !ctxGrade || sGrade === ctxGrade || sGrade === `Class ${ctxGrade}`;
            const sectionOk = !ctxSection || sSection === ctxSection;
            return gradeOk && sectionOk;
          });
          setStudents((scoped.length > 0 ? scoped : allStudents).map(s => ({
            _id: s._id,
            studentId: { name: s.name, grade: s.grade || s.className, section: s.section || s.sectionName, roll: s.rollNumber },
            progressMetrics: [],
            submissions: [],
            overallGrade: null,
            improvementTrend: 'stable',
          })));
        } else {
          throw new Error('Unable to load student progress data');
        }
      }

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      }
    } catch (err) {
      setError(err.message || 'Failed to load progress data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // ─────────────────────────────────────────────────────────────────────────
  // INTERVENTION OUTCOME STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [interventionModal, setInterventionModal] = useState(null); // { studentId, studentName, riskLevel, weakAreas }
  const [interventionForm, setInterventionForm] = useState({ action: '', notes: '', scheduledDate: '' });
  const [savingIntervention, setSavingIntervention] = useState(false);
  const [interventionLogs, setInterventionLogs] = useState([]);
  const [outcomeModal, setOutcomeModal] = useState(null); // { interventionId }
  const [outcomeForm, setOutcomeForm] = useState({ outcome: '', improvement: '' });

  // ─────────────────────────────────────────────────────────────────────────
  // MISCONCEPTIONS TAB STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [misconceptions, setMisconceptions] = useState([]);
  const [loadingMisconceptions, setLoadingMisconceptions] = useState(false);
  const [misconceptionFilters, setMisconceptionFilters] = useState({ subject: '' });
  const [aiMisconceptionReport, setAiMisconceptionReport] = useState('');
  const [generatingMisconceptionReport, setGeneratingMisconceptionReport] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // CLASS GAPS TAB STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [classGaps, setClassGaps] = useState([]);
  const [loadingGaps, setLoadingGaps] = useState(false);
  const [classGapsHealthy, setClassGapsHealthy] = useState(0);
  const [gapFilters, setGapFilters] = useState({ subject: '' });

  // ─────────────────────────────────────────────────────────────────────────
  // 7-DAY FORECAST TAB STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [forecast7d, setForecast7d] = useState([]);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecastValidation, setForecastValidation] = useState(null);
  const [confidenceData, setConfidenceData] = useState([]);
  const [loadingConfidence, setLoadingConfidence] = useState(false);
  const [helpSeekingData, setHelpSeekingData] = useState([]);
  const [loadingHelpSeeking, setLoadingHelpSeeking] = useState(false);
  const [belongingData, setBelongingData] = useState([]);
  const [loadingBelonging, setLoadingBelonging] = useState(false);
  const [learningStyleData, setLearningStyleData] = useState(null);
  const [loadingLearningStyle, setLoadingLearningStyle] = useState(false);
  const [forecastFilters, setForecastFilters] = useState({});

  // ─────────────────────────────────────────────────────────────────────────
  // MASTERY GROWTH TAB STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [masteryAllData, setMasteryAllData] = useState([]);
  const [masteryAllLoading, setMasteryAllLoading] = useState(false);
  const [masteryAllFilters, setMasteryAllFilters] = useState({ subject: '' });
  const [masteryDetailStudent, setMasteryDetailStudent] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // ML INSIGHTS TAB STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [mlClassData, setMlClassData] = useState([]);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlStudentDetail, setMlStudentDetail] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH WEAK STUDENTS — server-side composite at-risk scoring
  // ─────────────────────────────────────────────────────────────────────────
  const fetchWeakStudents = useCallback(async () => {
    try {
      setLoadingWeak(true);
      const params = new URLSearchParams();
      if (ctxGrade) params.set('className', ctxGrade);
      if (ctxSection) params.set('section', ctxSection);
      if (interventionFilters.subject) params.set('subject', interventionFilters.subject);
      if (interventionFilters.interventionLevel) params.set('level', interventionFilters.interventionLevel);

      const res = await cachedFetch(`${API_BASE}/api/teacher-analytics/at-risk?${params}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const payload = await res.json();
        setWeakStudents(payload.data || []);
      } else {
        setWeakStudents([]);
      }
    } catch {
      setWeakStudents([]);
    } finally {
      setLoadingWeak(false);
    }
  }, [interventionFilters]);

  const fetchInterventionLogs = useCallback(async () => {
    try {
      const res = await cachedFetch(`${API_BASE}/api/teacher-analytics/interventions`, { headers: authHeaders() });
      if (res.ok) {
        const payload = await res.json();
        setInterventionLogs(payload.data || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchProgressData();
  }, [fetchProgressData]);

  useEffect(() => {
    fetchWeakStudents();
  }, [fetchWeakStudents]);

  useEffect(() => {
    if (activeTab === 'intervention') fetchInterventionLogs();
    if (activeTab === 'misconceptions') fetchMisconceptions();
    if (activeTab === 'gaps') fetchClassGaps();
    if (activeTab === 'forecast') { fetchForecast7d(); fetchForecastValidation(); }
    if (activeTab === 'mastery-growth') fetchMasteryAll();
    if (activeTab === 'ml') fetchMlScores();
    if (activeTab === 'confidence') fetchConfidence();
    if (activeTab === 'help-seeking') fetchHelpSeeking();
    if (activeTab === 'belonging') fetchBelonging();
    if (activeTab === 'learning-style') fetchLearningStyle();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once the Overview has painted, warm every other tab in the background so
  // switching tabs renders from the client cache instead of waiting on the API.
  useEffect(() => {
    if (loading) return undefined;
    const timer = setTimeout(() => {
      fetchInterventionLogs();
      fetchMisconceptions();
      fetchClassGaps();
      fetchForecast7d();
      fetchForecastValidation();
      fetchMasteryAll();
      fetchMlScores();
      fetchConfidence();
      fetchHelpSeeking();
      fetchBelonging();
      fetchLearningStyle();
    }, 800);
    return () => clearTimeout(timer);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // SOCKET — real-time ML intervention alerts
  // ─────────────────────────────────────────────────────────────────────────
  const [alertToast, setAlertToast] = useState(null);
  const alertTimerRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const socket = io(API_BASE, { auth: { token }, transports: ['websocket'] });

    socket.on('intervention_alert', (payload) => {
      const { studentName, subject, topicTitle, score } = payload;
      setAlertToast({ studentName, subject, topicTitle, score, id: Date.now() });
      invalidateTeacherAnalytics();
      clearTimeout(alertTimerRef.current);
      alertTimerRef.current = setTimeout(() => setAlertToast(null), 7000);
      fetchWeakStudents();
      if (activeTab === 'intervention') fetchInterventionLogs();
    });

    return () => {
      socket.disconnect();
      clearTimeout(alertTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // INTERVENTION ACTIONS
  // ─────────────────────────────────────────────────────────────────────────
  const logIntervention = async () => {
    if (!interventionModal || !interventionForm.action.trim()) return;
    setSavingIntervention(true);
    try {
      const response = await fetch(`${API_BASE}/api/teacher-analytics/interventions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          studentId: interventionModal.studentId,
          studentName: interventionModal.studentName,
          riskLevel: interventionModal.riskLevel,
          reason: (interventionModal.weakAreas || []).join(', ') || 'At-risk composite score',
          ...interventionForm,
          scheduledDate: interventionForm.scheduledDate ? new Date(interventionForm.scheduledDate).toISOString() : '',
        }),
      });
      if (!response.ok) throw new Error('Unable to save intervention');
      invalidateTeacherAnalytics();
      setInterventionModal(null);
      setInterventionForm({ action: '', notes: '', scheduledDate: '' });
      fetchInterventionLogs();
    } catch { /* silent */ } finally {
      setSavingIntervention(false);
    }
  };

  const deleteIntervention = async (interventionId) => {
    if (!interventionId) return;
    try {
      const response = await fetch(`${API_BASE}/api/teacher-analytics/interventions/${interventionId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error('Unable to delete intervention');
      invalidateTeacherAnalytics();
      setInterventionLogs((logs) => logs.filter((log) => log._id !== interventionId));
    } catch { /* silent */ }
  };

  const recordOutcome = async () => {
    if (!outcomeModal) return;
    try {
      const response = await fetch(`${API_BASE}/api/teacher-analytics/interventions/${outcomeModal.interventionId}/outcome`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          outcome: outcomeForm.outcome,
          improvement: Number(outcomeForm.improvement) || 0,
          status: 'completed',
        }),
      });
      if (!response.ok) throw new Error('Unable to save intervention outcome');
      invalidateTeacherAnalytics();
      setOutcomeModal(null);
      setOutcomeForm({ outcome: '', improvement: '' });
      fetchInterventionLogs();
    } catch { /* silent */ }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ANALYZE STUDENT WEAKNESS
  // ─────────────────────────────────────────────────────────────────────────
  const analyzeStudentWeakness = async (studentId, subject) => {
    setAnalyzing(true);
    try {
      const response = await fetch(`${API_BASE}/api/ai-learning/analyze-weakness/${studentId}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ subject })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Analysis completed! Intervention level: ${result.interventionLevel}`);
        fetchWeakStudents();
      } else {
        throw new Error('Failed to analyze student');
      }
    } catch (error) {
      console.error('Error analyzing student:', error);
      alert('Failed to analyze student. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GENERATE LEARNING PATH
  // ─────────────────────────────────────────────────────────────────────────
  const generateLearningPath = async (studentId, subject, weakAreas, currentLevel) => {
    try {
      const response = await fetch(`${API_BASE}/api/ai-learning/generate-learning-path/${studentId}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ subject, weakAreas, currentLevel })
      });

      if (response.ok) {
        await response.json();
        alert('AI Learning Path generated successfully!');
        setSelectedWeakStudent(prev => ({
          ...prev,
          hasAIPath: true
        }));
      } else {
        throw new Error('Failed to generate learning path');
      }
    } catch (error) {
      console.error('Error generating learning path:', error);
      alert('Failed to generate learning path. Please try again.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH: MISCONCEPTIONS
  // ─────────────────────────────────────────────────────────────────────────
  const fetchMisconceptions = useCallback(async () => {
    setLoadingMisconceptions(true);
    try {
      const params = new URLSearchParams();
      if (ctxGrade) params.set('className', ctxGrade);
      if (ctxSection) params.set('section', ctxSection);
      if (misconceptionFilters.subject) params.set('subject', misconceptionFilters.subject);
      const res = await cachedFetch(`${API_BASE}/api/teacher-analytics/misconceptions?${params}`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setMisconceptions(d.data || []); }
    } catch { /* silent */ } finally { setLoadingMisconceptions(false); }
  }, [misconceptionFilters]);

  const generateAIMisconceptionReport = async () => {
    if (!misconceptions.length) { return; }
    setGeneratingMisconceptionReport(true);
    try {
      const patterns = misconceptions.slice(0, 10).map((m) => ({
        topic: m.topic,
        wrongAnswer: m.topWrongAnswers?.[0]?.answer || '(unknown)',
        count: m.totalWrong,
        pct: m.pct,
      }));
      const res = await fetch(`${API_BASE}/api/ai-teacher/misconception-report`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ subject: misconceptionFilters.subject || `Grade ${ctxGrade}${ctxSection ? '-' + ctxSection : ''}`, wrongAnswerPatterns: patterns }),
      });
      const data = await res.json().catch(() => ({}));
      setAiMisconceptionReport(data?.data?.content || '');
    } catch { /* silent */ } finally { setGeneratingMisconceptionReport(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH: CLASS GAPS
  // ─────────────────────────────────────────────────────────────────────────
  const fetchClassGaps = useCallback(async () => {
    setLoadingGaps(true);
    try {
      const params = new URLSearchParams();
      if (ctxGrade) params.set('className', ctxGrade);
      if (ctxSection) params.set('section', ctxSection);
      if (gapFilters.subject) params.set('subject', gapFilters.subject);
      const res = await cachedFetch(`${API_BASE}/api/teacher-analytics/class-gaps?${params}`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setClassGaps(d.data || []); setClassGapsHealthy(Number(d.healthyTopics) || 0); }
    } catch { /* silent */ } finally { setLoadingGaps(false); }
  }, [gapFilters]);

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH: 7-DAY FORECAST
  // ─────────────────────────────────────────────────────────────────────────
  const fetchForecast7d = useCallback(async () => {
    setLoadingForecast(true);
    try {
      const params = new URLSearchParams();
      if (ctxGrade) params.set('className', ctxGrade);
      if (ctxSection) params.set('section', ctxSection);
      const res = await cachedFetch(`${API_BASE}/api/teacher-analytics/at-risk-7day?${params}`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setForecast7d(d.data || []); }
    } catch { /* silent */ } finally { setLoadingForecast(false); }
  }, [forecastFilters]);

  // Retrospective backtest of the underlying score-forecast engine — surfaces how
  // accurate last week's predictions actually were, instead of leaving the
  // forecast unvalidated. See backend/services/forecastValidationService.js.
  const fetchForecastValidation = useCallback(async () => {
    try {
      const res = await cachedFetch(`${API_BASE}/api/teacher-analytics/forecast-validation`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setForecastValidation(d.data || null); }
    } catch { /* silent */ }
  }, []);

  // Teacher-facing confidence calibration — which students most over/under-rate
  // themselves relative to actual mastery. See backend/routes/confidenceRoutes.js.
  const fetchConfidence = useCallback(async () => {
    setLoadingConfidence(true);
    try {
      const params = new URLSearchParams();
      if (ctxGrade) params.set('className', ctxGrade);
      if (ctxSection) params.set('section', ctxSection);
      params.set('all', '1');
      params.set('days', '7');
      const res = await cachedFetch(`${API_BASE}/api/confidence/class?${params}`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setConfidenceData(d.data || []); }
    } catch { /* silent */ } finally { setLoadingConfidence(false); }
  }, []);

  // Teacher-facing help-seeking behaviour — how often each student proactively
  // reaches for Homework Help / signals they're stuck. See helpSeekingService.js.
  const fetchHelpSeeking = useCallback(async () => {
    setLoadingHelpSeeking(true);
    try {
      const res = await cachedFetch(`${API_BASE}/api/help-seeking/class`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setHelpSeekingData(d.data || []); }
    } catch { /* silent */ } finally { setLoadingHelpSeeking(false); }
  }, []);

  // Teacher-facing social/belonging — students least engaged with the Alcove
  // peer community first. See backend/services/belongingService.js.
  const fetchBelonging = useCallback(async () => {
    setLoadingBelonging(true);
    try {
      const res = await cachedFetch(`${API_BASE}/api/belonging/class`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setBelongingData(d.data || []); }
    } catch { /* silent */ } finally { setLoadingBelonging(false); }
  }, []);

  // Teacher-facing learning-style distribution across the class. See
  // backend/services/learningStyleService.js.
  const fetchLearningStyle = useCallback(async () => {
    setLoadingLearningStyle(true);
    try {
      const res = await cachedFetch(`${API_BASE}/api/learning-style/class`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setLearningStyleData(d.data || null); }
    } catch { /* silent */ } finally { setLoadingLearningStyle(false); }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH: MASTERY ALL STUDENTS
  // ─────────────────────────────────────────────────────────────────────────
  const fetchMasteryAll = useCallback(async () => {
    setMasteryAllLoading(true);
    try {
      const params = new URLSearchParams();
      if (ctxGrade) params.set('className', ctxGrade);
      if (ctxSection) params.set('section', ctxSection);
      if (masteryAllFilters.subject) params.set('subject', masteryAllFilters.subject);
      const res = await cachedFetch(`${API_BASE}/api/teacher-analytics/student-mastery-all?${params}`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setMasteryAllData(d.data || []); }
    } catch { /* silent */ } finally { setMasteryAllLoading(false); }
  }, [masteryAllFilters]);

  const fetchMlScores = useCallback(async () => {
    setMlLoading(true);
    try {
      const params = new URLSearchParams();
      if (ctxGrade) params.set('className', ctxGrade);
      if (ctxSection) params.set('section', ctxSection);
      const res = await cachedFetch(`${API_BASE}/api/ml/class/scores?${params}`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setMlClassData(d.data || []); }
      else setMlClassData([]);
    } catch { setMlClassData([]); } finally { setMlLoading(false); }
  }, [ctxGrade, ctxSection]);

  // ─────────────────────────────────────────────────────────────────────────
  // FILTERED DATA
  // ─────────────────────────────────────────────────────────────────────────
  const filteredStudents = useMemo(() =>
    students.filter((s) => {
      const name = s.studentId?.name || '';
      const roll = String(s.studentId?.roll || '');
      const term = searchTerm.toLowerCase();
      return !term || name.toLowerCase().includes(term) || roll.includes(term);
    }),
    [students, searchTerm]
  );

  const filteredWeakStudents = useMemo(() =>
    weakStudents.filter(student =>
      student.name?.toLowerCase().includes(interventionSearch.toLowerCase()) ||
      String(student.roll || '').includes(interventionSearch)
    ),
    [weakStudents, interventionSearch]
  );

  // Server-computed from exam results + graded assignments; null = no marks yet.
  const overallScore = (student) => {
    if (student.summary) return student.summary.overallScore ?? null;
    const metrics = student.progressMetrics || [];
    if (!metrics.length) return null;
    return Math.round(metrics.reduce((sum, m) => sum + (m.averageScore || 0), 0) / metrics.length);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="">
      {/* ML Intervention Alert Toast */}
      <AnimatePresence>
        {alertToast && (
          <Motion.div
            key={alertToast.id}
            initial={{ opacity: 0, y: -24, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -16, x: '-50%' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-5 left-1/2 z-[9999] flex items-start gap-3 rounded-2xl border border-red-200 bg-white px-5 py-4 shadow-[0_8px_32px_rgba(220,38,38,0.18)]"
            style={{ minWidth: 320, maxWidth: 440 }}
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">ML Intervention Alert</p>
              <p className="mt-0.5 text-xs text-gray-500">
                <span className="font-medium text-gray-700">{alertToast.studentName}</span> is stuck on{' '}
                <span className="font-medium text-gray-700">{alertToast.topicTitle}</span>{' '}
                ({alertToast.subject}) — score {alertToast.score}%. Intervention tab refreshed.
              </p>
            </div>
            <button onClick={() => setAlertToast(null)} className="mt-0.5 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </Motion.div>
        )}
      </AnimatePresence>

      <Motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-[0_2px_16px_rgba(15,23,42,0.05)] sm:p-5"
      >
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 lg:flex-nowrap lg:gap-5">
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <BarChart3 className="size-6" strokeWidth={2.4} />
            </div>
            <div>
              <h1 className="text-[22px] font-bold leading-tight tracking-tight text-slate-900">Class Analytics</h1>
              <p className="text-[13px] text-slate-500">{classLabel} <span className="mx-1">·</span> Full class performance &amp; progress</p>
            </div>
          </div>

          {/* <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={fetchProgressData} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
              <Filter className="size-4 fill-blue-600 text-blue-600" /> Filter
            </button>
            <div className="relative">
              <select value={filters.grade} onChange={(event) => setFilters((previous) => ({ ...previous, grade: event.target.value }))} className="h-9 w-36 appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-[13px] text-slate-700 shadow-sm outline-none focus:border-blue-300">
                <option value="">All Grades</option>
                {classOptions.map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            </div>
            <div className="relative">
              <select value={filters.section} onChange={(event) => setFilters((previous) => ({ ...previous, section: event.target.value }))} className="h-9 w-36 appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-[13px] text-slate-700 shadow-sm outline-none focus:border-blue-300">
                <option value="">All Sections</option>
                {sectionOptions.map((section) => <option key={section} value={section}>Section {section}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            </div>
            <span className="inline-flex h-9 items-center gap-2 rounded-xl bg-blue-50 px-4 text-[13px] font-semibold text-slate-800">
              <Users className="size-4 text-blue-600" /> {analytics?.totalStudents ?? filteredStudents.length} Students
            </span>
          </div> */}

        {/* Analytics tabs — beside the title, horizontally scrollable with ‹ › arrows */}
        <div className="relative flex w-full min-w-0 items-center gap-1 rounded-full border border-slate-100 bg-slate-100 p-1 lg:w-auto lg:flex-1">

          {tabScroll.left && (<button
            type="button"
            aria-label="Scroll tabs left"
            onClick={() => scrollTabs(-1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-blue-50 hover:text-blue-600 disabled:opacity-35"
          >
            <ChevronLeft className="size-4" />
          </button>)}
        <div ref={tabStripRef} onScroll={updateTabScroll} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { key: 'progress',      label: 'Overview',        icon: BarChart3      },
            { key: 'intervention',  label: 'Intervention',    icon: Target         },
            { key: 'misconceptions',label: 'Misconceptions',  icon: Lightbulb      },
            { key: 'gaps',          label: 'Class Gaps',      icon: BarChart3      },
            { key: 'forecast',      label: '7-Day Forecast',  icon: TrendingUpIcon },
            { key: 'mastery-growth',label: 'Mastery Growth',  icon: Activity       },
            { key: 'ml',            label: 'ML Insights',     icon: Sparkle        },
            { key: 'confidence',    label: 'Confidence',      icon: Gauge          },
            { key: 'help-seeking',  label: 'Help-Seeking',    icon: HandHelping    },
            { key: 'belonging',     label: 'Belonging',       icon: Users          },
            { key: 'learning-style',label: 'Learning Style',  icon: Brain          },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={(event) => { setActiveTab(key); event.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' }); }}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${activeTab === key
                ? 'border border-blue-300 bg-blue-500 text-white shadow-sm'
                : 'border border-transparent text-slate-600 hover:bg-white'}`}
            >
              <Icon className={`size-4 ${activeTab === key ? 'text-white' : 'text-slate-500'}`} /> {label}
            </button>
          ))}
        </div>
          {tabScroll.right && (<button
            type="button"
            aria-label="Scroll tabs right"
            onClick={() => scrollTabs(1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-blue-50 hover:text-blue-600 disabled:opacity-35"
          >
            <ChevronRight className="size-4" />
          </button>)}
        </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <Motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'progress' && (
              <ProgressTab
                filteredStudents={filteredStudents}
                analytics={analytics}
                loading={loading}
                error={error}
                setError={setError}
                selectedStudent={selectedStudent}
                setSelectedStudent={setSelectedStudent}
                setActiveTab={setActiveTab}
                overallScore={overallScore}
                classLabel={classLabel}
              />
            )}
            {activeTab === 'intervention' && (
              <InterventionTab
                filteredWeakStudents={filteredWeakStudents}
                interventionFilters={interventionFilters}
                setInterventionFilters={setInterventionFilters}
                interventionSearch={interventionSearch}
                setInterventionSearch={setInterventionSearch}
                loadingWeak={loadingWeak}
                analyzing={analyzing}
                selectedWeakStudent={selectedWeakStudent}
                setSelectedWeakStudent={setSelectedWeakStudent}
                analyzeStudentWeakness={analyzeStudentWeakness}
                generateLearningPath={generateLearningPath}
                navigate={navigate}
                classLabel={classLabel}
                interventionModal={interventionModal}
                setInterventionModal={setInterventionModal}
                interventionForm={interventionForm}
                setInterventionForm={setInterventionForm}
                savingIntervention={savingIntervention}
                logIntervention={logIntervention}
                interventionLogs={interventionLogs}
                outcomeModal={outcomeModal}
                setOutcomeModal={setOutcomeModal}
                outcomeForm={outcomeForm}
                setOutcomeForm={setOutcomeForm}
                recordOutcome={recordOutcome}
                deleteIntervention={deleteIntervention}
                setActiveTab={setActiveTab}
              />
            )}
            {activeTab === 'misconceptions' && (
              <MisconceptionsTab
                data={misconceptions}
                loading={loadingMisconceptions}
                filters={misconceptionFilters}
                setFilters={setMisconceptionFilters}
                onFetch={fetchMisconceptions}
                aiReport={aiMisconceptionReport}
                generatingReport={generatingMisconceptionReport}
                onGenerateReport={generateAIMisconceptionReport}
              />
            )}
            {activeTab === 'gaps' && (
              <ClassGapsTab
                data={classGaps}
                loading={loadingGaps}
                onFetch={fetchClassGaps}
                healthyTopics={classGapsHealthy}
                classLabel={classLabel}
              />
            )}
            {activeTab === 'forecast' && (
              <ForecastTab
                data={forecast7d}
                loading={loadingForecast}
                filters={forecastFilters}
                setFilters={setForecastFilters}
                onFetch={fetchForecast7d}
                validation={forecastValidation}
              />
            )}
            {activeTab === 'mastery-growth' && (
              <MasteryGrowthTab
                data={masteryAllData}
                loading={masteryAllLoading}
                filters={masteryAllFilters}
                setFilters={setMasteryAllFilters}
                onFetch={fetchMasteryAll}
                detailStudent={masteryDetailStudent}
                setDetailStudent={setMasteryDetailStudent}
              />
            )}
            {activeTab === 'ml' && (
              <MLInsightsTab
                data={mlClassData}
                loading={mlLoading}
                onFetch={fetchMlScores}
                detailStudent={mlStudentDetail}
                setDetailStudent={setMlStudentDetail}
                ctxGrade={ctxGrade}
                ctxSection={ctxSection}
              />
            )}
            {activeTab === 'confidence' && (
              <ConfidenceTab data={confidenceData} loading={loadingConfidence} onFetch={fetchConfidence} ctxGrade={ctxGrade} ctxSection={ctxSection} />
            )}
            {activeTab === 'help-seeking' && (
              <HelpSeekingTab data={helpSeekingData} loading={loadingHelpSeeking} onFetch={fetchHelpSeeking} ctxGrade={ctxGrade} ctxSection={ctxSection} />
            )}
            {activeTab === 'belonging' && (
              <BelongingTab data={belongingData} loading={loadingBelonging} onFetch={fetchBelonging} />
            )}
            {activeTab === 'learning-style' && (
              <LearningStyleTab data={learningStyleData} loading={loadingLearningStyle} onFetch={fetchLearningStyle} />
            )}
          </Motion.div>
        </AnimatePresence>
      </Motion.div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// CONFIDENCE CALIBRATION TAB — students most over/under-confident relative to
// their actual mastery score, ranked by the size of the gap. See
// backend/services/confidenceTrackingService.js for how the gap is computed.
// ═════════════════════════════════════════════════════════════════════════════
const CONFIDENCE_LABEL_META = {
  overconfident: { label: 'Overconfident', cls: 'bg-amber-100 text-amber-700', badge: 'border-amber-200 bg-amber-50' },
  underconfident: { label: 'Underconfident', cls: 'bg-sky-100 text-sky-700', badge: 'border-sky-200 bg-sky-50' },
  calibrated: { label: 'Well calibrated', cls: 'bg-emerald-100 text-emerald-700', badge: 'border-emerald-200 bg-emerald-50' },
};

const CALIB = {
  calibrated: { label: 'Well Calibrated', color: '#22c55e', pill: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' },
  overconfident: { label: 'Overconfident', color: '#f59e0b', pill: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  underconfident: { label: 'Underconfident', color: '#ef4444', pill: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  insufficient_data: { label: 'Insufficient Data', color: '#cbd5e1', pill: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};
const calibOf = (s) => CALIB[s?.overallLabel] || CALIB.insufficient_data;

const ConfidenceTab = ({ data: initialData, loading: initialLoading, onFetch, ctxGrade, ctxSection }) => {
  const [subject, setSubject] = useState('');
  const [days, setDays] = useState(7);
  const [data, setData] = useState(initialData || []);
  const [loading, setLoading] = useState(Boolean(initialLoading));
  const [subjects, setSubjects] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ all: '1', days: String(days) });
    if (ctxGrade) params.set('className', ctxGrade);
    if (ctxSection) params.set('section', ctxSection);
    if (subject) params.set('subject', subject);
    cachedFetch(`${API_BASE}/api/confidence/class?${params}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const rows = d?.data || [];
        setData(rows);
        const subs = [...new Set(rows.flatMap((s) => (s.topics || []).map((t) => t.subject)).filter(Boolean))];
        if (subs.length) setSubjects((prev) => [...new Set([...prev, ...subs])].sort());
      })
      .catch(() => { if (!cancelled) setData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ctxGrade, ctxSection, subject, days, reloadKey]);

  const count = (k) => data.filter((s) => (s.overallLabel || 'insufficient_data') === k).length;
  const total = data.length;
  const segments = ['calibrated', 'overconfident', 'underconfident', 'insufficient_data'].map((k) => ({ key: k, ...CALIB[k], value: count(k) }));
  const statCards = [
    { label: 'Total Students', value: total, helper: 'In this class', icon: Users, card: 'border-blue-100 bg-blue-50/40', tile: 'bg-blue-100 text-blue-600' },
    { label: 'Well Calibrated', value: count('calibrated'), helper: 'Confidence matches performance', icon: CheckCircle, card: 'border-emerald-100 bg-emerald-50/40', tile: 'bg-emerald-100 text-emerald-600' },
    { label: 'Overconfident', value: count('overconfident'), helper: 'Confidence higher than actual', icon: AlertTriangle, card: 'border-amber-100 bg-amber-50/40', tile: 'bg-amber-100 text-amber-500' },
    { label: 'Underconfident', value: count('underconfident'), helper: 'Confidence lower than actual', icon: TrendingDown, card: 'border-red-100 bg-red-50/40', tile: 'bg-red-100 text-red-500' },
  ];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((s) => (!status || (s.overallLabel || 'insufficient_data') === status)
      && (!q || String(s.name || '').toLowerCase().includes(q) || String(s.roll || '').includes(q)));
  }, [data, search, status]);
  useEffect(() => { setPage(1); }, [search, status, pageSize, subject, days]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize);

  // Donut (circumference 100).
  const R = 15.9155;
  let offset = 25;
  // Scatter geometry.
  const SW = 420; const SH = 210; const SL = 36; const SB = 26; const ST = 8;
  const sx = (v) => SL + (v / 100) * (SW - SL - 10);
  const sy = (v) => ST + (1 - v / 100) * (SH - ST - SB);

  const selectCls = 'h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pb-1 pl-9 pr-8 pt-3.5 text-[12.5px] text-slate-800 outline-none focus:border-blue-300';
  const classLabel = ctxGrade ? `Class ${ctxGrade}${ctxSection ? ` - ${ctxSection}` : ''}` : 'Current class';
  const pctTxt = (v) => (v == null ? '—' : `${v}%`);

  return (
    <div className="space-y-3">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-center gap-3">
        <div className="flex items-center gap-3">
          {/* <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Target className="size-5" /></span> */}
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 text-center">Confidence Calibration</h2>
            <p className="text-[12.5px] text-slate-500">Compare predicted confidence with actual performance to understand how accurately students assess themselves.</p>
          </div>
        </div>
        <button type="button" onClick={() => { setReloadKey((k) => k + 1); onFetch?.(); }} disabled={loading}
          className="inline-flex h-8 items-center justify-end gap-1.5 rounded-full border border-blue-200 bg-blue-50/60 px-3 text-[12.5px] font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-50">
          <RefreshCcw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-3 lg:max-w-3xl">
        <div className="relative">
          <LayoutGridIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <span className="pointer-events-none absolute left-9 top-1 text-[10px] text-slate-500">Class</span>
          <div className="flex h-10 items-end rounded-lg border border-slate-200 bg-white pb-1 pl-9 text-[12.5px] text-slate-800">{classLabel}</div>
        </div>
        <label className="relative">
          <BookOpen className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <span className="pointer-events-none absolute left-9 top-1 text-[10px] text-slate-500">Subject</span>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className={selectCls} aria-label="Subject">
            <option value="">All Subjects</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        </label>
        <label className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <span className="pointer-events-none absolute left-9 top-1 text-[10px] text-slate-500">Time Period</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={selectCls} aria-label="Time period">
            <option value={7}>Last 7 Days</option><option value={30}>Last 30 Days</option><option value={90}>Last 90 Days</option><option value={0}>All Time</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        </label>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {statCards.map((c, i) => (
          <Motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-3 rounded-xl border p-3 ${c.card}`}>
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${c.tile}`}><c.icon className="size-5" /></span>
            <div className="min-w-0">
              <p className="text-[12px] text-slate-600">{c.label}</p>
              <p className="text-lg font-bold leading-tight text-slate-900">{loading ? '—' : c.value}</p>
              <p className="truncate text-[10.5px] text-slate-500">{c.helper}</p>
            </div>
          </Motion.div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Distribution donut */}
        <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><BarChart2 className="size-4" /></span>
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">Calibration Distribution</h3>
              <p className="text-[11.5px] text-slate-500">How well students' confidence matches their actual performance.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="relative size-32 shrink-0">
              <svg viewBox="0 0 42 42" className="size-full">
                <circle cx="21" cy="21" r={R} fill="none" stroke="#f1f5f9" strokeWidth="6" />
                {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
                  const pct = (s.value / total) * 100;
                  const el = <circle key={s.key} cx="21" cy="21" r={R} fill="none" stroke={s.color} strokeWidth="6" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} />;
                  offset -= pct;
                  return el;
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-lg font-bold leading-none text-slate-900">{total}</p>
                <p className="text-[10.5px] text-slate-500">Students</p>
              </div>
            </div>
            <ul className="min-w-[200px] flex-1 divide-y divide-slate-100">
              {segments.map((s) => (
                <li key={s.key} className="flex items-center justify-between py-1.5 text-[12px]">
                  <span className="flex items-center gap-2 text-slate-700"><span className="size-2.5 rounded-full" style={{ background: s.color }} /> {s.label}</span>
                  <span className="font-semibold text-slate-900">{s.value} ({total ? Math.round((s.value / total) * 100) : 0}%)</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Scatter */}
        <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Target className="size-4" /></span>
              <div>
                <h3 className="text-[14px] font-bold text-slate-900">Confidence vs Actual Performance</h3>
                <p className="text-[11.5px] text-slate-500">Each dot represents a student. The dashed line is perfect calibration.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10.5px] text-slate-600">
              {segments.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: s.color }} /> {s.label}</span>)}
            </div>
          </div>
          <svg viewBox={`0 0 ${SW} ${SH}`} className="h-auto w-full" role="img" aria-label="Confidence versus actual score">
            {[0, 20, 40, 60, 80, 100].map((v) => (
              <g key={v}>
                <line x1={SL} x2={SW - 10} y1={sy(v)} y2={sy(v)} stroke="#eef2f7" />
                <line x1={sx(v)} x2={sx(v)} y1={ST} y2={SH - SB} stroke="#eef2f7" />
                <text x={SL - 5} y={sy(v) + 3} textAnchor="end" fontSize="8" fill="#64748b">{v}</text>
                <text x={sx(v)} y={SH - SB + 11} textAnchor="middle" fontSize="8" fill="#64748b">{v}</text>
              </g>
            ))}
            <line x1={sx(0)} y1={sy(0)} x2={sx(100)} y2={sy(100)} stroke="#94a3b8" strokeDasharray="3 3" />
            <text x={(SW + SL) / 2} y={SH - 2} textAnchor="middle" fontSize="9" fill="#475569">Confidence (%)</text>
            <text x={9} y={(SH - SB) / 2} textAnchor="middle" fontSize="9" fill="#475569" transform={`rotate(-90 9 ${(SH - SB) / 2})`}>Actual Score (%)</text>
            {data.map((s) => {
              const has = s.avgConfidence != null && s.avgActual != null;
              const c = calibOf(s);
              return (
                <circle key={String(s.studentId)} cx={sx(has ? s.avgConfidence : 0)} cy={sy(has ? s.avgActual : 0)} r={has ? 4 : 2.5}
                  fill={c.color} fillOpacity={has ? 0.85 : 0.6} stroke="#fff" strokeWidth="1">
                  <title>{`${s.name}: confidence ${pctTxt(s.avgConfidence)}, actual ${pctTxt(s.avgActual)} — ${c.label}`}</title>
                </circle>
              );
            })}
          </svg>
        </section>
      </div>

      {/* Student details table */}
      <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
          <div className="flex items-start gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Users className="size-4" /></span>
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">Student Details</h3>
              <p className="text-[11.5px] text-slate-500">See each student's confidence, actual performance and calibration status.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-56 items-center gap-2 rounded-lg border border-slate-200 px-2.5 focus-within:border-blue-300">
              <Search className="size-3.5 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student by name or roll..." className="w-full bg-transparent text-[12px] outline-none placeholder:text-slate-400" />
            </div>
            <label className="relative flex items-center">
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className="h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-2.5 pr-7 text-[12px] text-slate-800 outline-none focus:border-blue-300">
                <option value="">All Status</option>
                {Object.entries(CALIB).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
            </label>
          </div>
        </div>
        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center gap-2 text-[13px] text-slate-500"><Loader2 className="size-5 animate-spin text-blue-600" /> Loading calibration…</div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-slate-400">{data.length ? 'No students match these filters.' : 'No students found.'}</p>
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="bg-slate-50/70 text-[11.5px] text-slate-500">
                  <th className="w-10 px-3 py-2 text-center font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 text-center font-medium">Roll</th>
                  <th className="px-3 py-2 text-center font-medium">Avg Confidence</th>
                  <th className="px-3 py-2 text-center font-medium">Avg Actual Score</th>
                  <th className="px-3 py-2 text-center font-medium">Difference</th>
                  <th className="px-3 py-2 text-center font-medium">Calibration Status</th>
                  <th className="px-3 py-2 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s, i) => {
                  const n = (current - 1) * pageSize + i + 1;
                  const c = calibOf(s);
                  const diff = s.overallGap;
                  return (
                    <tr key={String(s.studentId)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-3 py-1.5 text-center text-xs text-slate-500">{n}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2.5">
                          {photoUrlOf(s) ? (
                            <StudentPhoto student={{ name: s.name, profilePic: s.profilePic }} className="size-7 text-[11px]" />
                          ) : (
                            <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${ML_AVATAR[n % ML_AVATAR.length]}`}>{String(s.name || 'S').charAt(0).toUpperCase()}</span>
                          )}
                          <span className="truncate text-[12.5px] font-medium text-slate-900">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-center text-[12px] text-slate-600">{s.roll ?? '—'}</td>
                      <td className="px-3 py-1.5 text-center text-[12.5px] font-semibold text-slate-900">{pctTxt(s.avgConfidence)}</td>
                      <td className="px-3 py-1.5 text-center text-[12.5px] font-semibold text-slate-900">{pctTxt(s.avgActual)}</td>
                      <td className={`px-3 py-1.5 text-center text-[12.5px] font-semibold ${diff == null ? 'text-slate-400' : diff > 0 ? 'text-amber-600' : diff < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                        {diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff}%`}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${c.pill}`}><span className={`size-1.5 rounded-full ${c.dot}`} /> {c.label}</span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button type="button" onClick={() => setDetail(s)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-[11.5px] font-medium text-blue-700 transition hover:bg-blue-100">
                          <Eye className="size-3.5" /> View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5">
            <p className="text-[11.5px] text-slate-500">Showing {(current - 1) * pageSize + 1} to {Math.min(current * pageSize, rows.length)} of {rows.length} students</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
                Rows per page
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-[12px] text-slate-800 outline-none">
                  {[5, 10, 20, 50].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Previous page" className="flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
                {Array.from({ length: pageCount }, (_, k) => k + 1)
                  .filter((p) => pageCount <= 7 || p === 1 || p === pageCount || Math.abs(p - current) <= 1)
                  .map((p, k, arr) => (
                    <React.Fragment key={p}>
                      {k > 0 && p - arr[k - 1] > 1 && <span className="px-1 text-[11px] text-slate-400">…</span>}
                      <button type="button" onClick={() => setPage(p)} aria-current={p === current ? 'page' : undefined}
                        className={`flex size-7 items-center justify-center rounded-md text-[11.5px] font-semibold ${p === current ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{p}</button>
                    </React.Fragment>
                  ))}
                <button type="button" onClick={() => setPage(current + 1)} disabled={current === pageCount} aria-label="Next page" className="flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Student detail */}
      <ModalShell open={Boolean(detail)} onClose={() => setDetail(null)} label="Calibration details" width="max-w-lg">
        {detail && (() => {
          const c = calibOf(detail);
          return (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <StudentPhoto student={{ name: detail.name, profilePic: detail.profilePic }} className="size-11 text-sm" />
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900">{detail.name}</h3>
                    <p className="text-[11.5px] text-slate-500">Roll {detail.roll ?? '—'} · {detail.sampleSize || 0} check-in{detail.sampleSize === 1 ? '' : 's'}</p>
                    <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${c.pill}`}><span className={`size-1.5 rounded-full ${c.dot}`} /> {c.label}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setDetail(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="size-4" /></button>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-3 gap-2">
                  {[['Avg confidence', pctTxt(detail.avgConfidence)], ['Avg actual score', pctTxt(detail.avgActual)], ['Difference', detail.overallGap == null ? '—' : `${detail.overallGap > 0 ? '+' : ''}${detail.overallGap}%`]].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                      <p className="text-[10.5px] text-slate-500">{k}</p>
                      <p className="text-[15px] font-bold text-slate-900">{v}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-1.5 text-[12px] font-semibold text-slate-700">Topics (latest check-in)</p>
                  {(detail.topics || []).length === 0 ? (
                    <p className="rounded-lg bg-slate-50 p-3 text-[11.5px] text-slate-500">No confidence check-ins in this period. Students rate their confidence (1–5) on a topic before practice; it is then compared with their mastery score.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                      {detail.topics.map((t) => {
                        const tc = CALIB[t.calibrationLabel] || CALIB.insufficient_data;
                        return (
                          <div key={`${t.subject}-${t.topicId}`} className="flex items-center justify-between gap-2 px-3 py-2 text-[11.5px]">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{t.topicTitle || t.topicId}</p>
                              <p className="text-[10.5px] text-slate-500">{t.subject} · confidence {pctTxt(t.confidencePercent)} · actual {pctTxt(t.masteryScoreAtCheckin)}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${tc.pill}`}>{tc.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">Difference = confidence − actual score. More than +15 points is overconfident, below −15 is underconfident.</p>
              </div>
            </>
          );
        })()}
      </ModalShell>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// HELP-SEEKING BEHAVIOUR TAB — how often each student proactively reaches for
// help (Homework Help mode, "I don't know" signals). Both extremes matter: a
// student who never seeks help despite struggling elsewhere is as much a
// signal as one who seeks it constantly. See backend/services/helpSeekingService.js.
// ═════════════════════════════════════════════════════════════════════════════
// Help-seeking status from counts in the window.
const helpStatusOf = (s) => {
  if (!s.totalEvents) return { key: 'none', label: 'No activity', pill: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' };
  if ((s.stuckSignals || 0) >= 3) return { key: 'stuck', label: 'Frequently stuck', pill: 'bg-red-50 text-red-600', dot: 'bg-red-500' };
  if ((s.homeworkHelpUsed || 0) > 0) return { key: 'active', label: 'Active help-seeker', pill: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' };
  return { key: 'occasional', label: 'Occasional', pill: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' };
};
const HELP_EVENT_LABEL = {
  homework_help_used: 'Used Homework Help',
  stuck_signal: 'Signalled stuck',
  misconception_explainer_used: 'Used misconception explainer',
};

const HelpSeekingTab = ({ data: initialData, loading: initialLoading, onFetch, ctxGrade, ctxSection }) => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(initialData || []);
  const [loading, setLoading] = useState(Boolean(initialLoading));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (ctxGrade) params.set('className', ctxGrade);
    if (ctxSection) params.set('section', ctxSection);
    cachedFetch(`${API_BASE}/api/help-seeking/class?${params}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setData(d?.data || []); })
      .catch(() => { if (!cancelled) setData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ctxGrade, ctxSection, days, reloadKey]);

  const active = data.filter((s) => (s.homeworkHelpUsed || 0) > 0).length;
  const stuck = data.filter((s) => helpStatusOf(s).key === 'stuck').length;
  const statCards = [
    { label: 'Total Students', value: data.length, helper: 'In this class', icon: Users, card: 'border-blue-100 bg-blue-50/40', tile: 'bg-blue-100 text-blue-600' },
    { label: 'Active help-seekers', value: active, helper: `Used Homework Help in last ${days} days`, icon: HandHelping, card: 'border-emerald-100 bg-emerald-50/40', tile: 'bg-emerald-100 text-emerald-600' },
    { label: 'Frequently stuck', value: stuck, helper: `3+ stuck signals in last ${days} days`, icon: AlertTriangle, card: 'border-red-100 bg-red-50/40', tile: 'bg-red-100 text-red-500' },
  ];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((s) => (!status || helpStatusOf(s).key === status)
      && (!q || String(s.name || '').toLowerCase().includes(q) || String(s.roll || '').includes(q)));
  }, [data, search, status]);
  useEffect(() => { setPage(1); }, [search, status, pageSize, days]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize);
  const topTopicOf = (s) => s.topTopics?.[0]?.topicTitle || s.topSubjects?.[0]?.subject || null;

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-center gap-3">
        <div className="flex items-center gap-3">
          {/* <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><HandHelping className="size-5" /></span> */}
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 text-center">Help-Seeking Behaviour</h2>
            <p className="text-[12.5px] text-slate-500">How often students reach for Homework Help mode or signal they are stuck, in the last {days} days.</p>
          </div>
        </div>
        <button type="button" onClick={() => { setReloadKey((k) => k + 1); onFetch?.(); }} disabled={loading}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/60 px-3 text-[12.5px] font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-50">
          <RefreshCcw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-3">
        {statCards.map((c, i) => (
          <Motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-3 rounded-xl border p-3 ${c.card}`}>
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${c.tile}`}><c.icon className="size-5" /></span>
            <div className="min-w-0">
              <p className="text-[12px] text-slate-600">{c.label}</p>
              <p className="text-lg font-bold leading-tight text-slate-900">{loading ? '—' : c.value}</p>
              <p className="truncate text-[10.5px] text-slate-500">{c.helper}</p>
            </div>
          </Motion.div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-blue-300">
            <Search className="size-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student by name or roll number..." className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-slate-400" />
          </div>
          <label className="relative flex items-center">
            <GraduationCapIcon className="pointer-events-none absolute left-2.5 size-3.5 text-slate-500" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[12.5px] text-slate-800 outline-none focus:border-blue-300">
              <option value="">All Status</option><option value="active">Active help-seeker</option><option value="stuck">Frequently stuck</option><option value="occasional">Occasional</option><option value="none">No activity</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
          </label>
          <label className="relative flex items-center">
            <Calendar className="pointer-events-none absolute left-2.5 size-3.5 text-slate-500" />
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Time period" className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[12.5px] text-slate-800 outline-none focus:border-blue-300">
              <option value={7}>Last 7 Days</option><option value={30}>Last 30 Days</option><option value={90}>Last 90 Days</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
          </label>
        </div>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center gap-2 text-[13px] text-slate-500"><Loader2 className="size-5 animate-spin text-blue-600" /> Loading help-seeking data…</div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-slate-400">{data.length ? 'No students match these filters.' : 'No students found.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="bg-slate-50/70 text-[11.5px] text-slate-500">
                  <th className="w-10 px-3 py-2 text-center font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 font-medium">Events (Last {days} Days)</th>
                  <th className="px-3 py-2 font-medium">Homework Help</th>
                  <th className="px-3 py-2 font-medium">Stuck Signals</th>
                  <th className="px-3 py-2 font-medium">Top Topic</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s, i) => {
                  const n = (current - 1) * pageSize + i + 1;
                  const st = helpStatusOf(s);
                  const topic = topTopicOf(s);
                  return (
                    <tr key={String(s.studentId)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-3 py-1.5 text-center text-xs text-slate-500">{n}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2.5">
                          {photoUrlOf(s) ? (
                            <StudentPhoto student={{ name: s.name, profilePic: s.profilePic }} className="size-8 text-xs" />
                          ) : (
                            <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${ML_AVATAR[n % ML_AVATAR.length]}`}>{String(s.name || 'S').charAt(0).toUpperCase()}</span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-medium text-slate-900">{s.name}</p>
                            <p className="text-[10.5px] text-slate-500">Roll {s.roll ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-[12px] text-slate-800"><span className="inline-flex items-center gap-1.5"><MessageIcon className="size-3.5 text-blue-600" /> {s.totalEvents || 0} events</span></td>
                      <td className="px-3 py-1.5 text-[12px] text-slate-700"><span className="inline-flex items-center gap-1.5"><HandHelping className="size-3.5 text-blue-500" /> {s.homeworkHelpUsed || 0}</span></td>
                      <td className="px-3 py-1.5 text-[12px] text-slate-700"><span className="inline-flex items-center gap-1.5"><AlertTriangle className="size-3.5 text-red-500" /> {s.stuckSignals || 0}</span></td>
                      <td className="max-w-[160px] truncate px-3 py-1.5 text-[12px] text-slate-700" title={topic || undefined}>{topic || '—'}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${st.pill}`}><span className={`size-1.5 rounded-full ${st.dot}`} /> {st.label}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <button type="button" onClick={() => setDetail(s)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-[11.5px] font-medium text-blue-700 transition hover:bg-blue-100">
                          <Eye className="size-3.5" /> View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5">
            <p className="text-[11.5px] text-slate-500">Showing {(current - 1) * pageSize + 1} to {Math.min(current * pageSize, rows.length)} of {rows.length} students</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
                Rows per page
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-[12px] text-slate-800 outline-none">
                  {[5, 10, 20, 50].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Previous page" className="flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
                {Array.from({ length: pageCount }, (_, k) => k + 1)
                  .filter((p) => pageCount <= 7 || p === 1 || p === pageCount || Math.abs(p - current) <= 1)
                  .map((p, k, arr) => (
                    <React.Fragment key={p}>
                      {k > 0 && p - arr[k - 1] > 1 && <span className="px-1 text-[11px] text-slate-400">…</span>}
                      <button type="button" onClick={() => setPage(p)} aria-current={p === current ? 'page' : undefined}
                        className={`flex size-7 items-center justify-center rounded-md text-[11.5px] font-semibold ${p === current ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{p}</button>
                    </React.Fragment>
                  ))}
                <button type="button" onClick={() => setPage(current + 1)} disabled={current === pageCount} aria-label="Next page" className="flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
              </div>
            </div>
          </div>
        )}
      </section>

      <ModalShell open={Boolean(detail)} onClose={() => setDetail(null)} label="Help-seeking details" width="max-w-lg">
        {detail && (() => {
          const st = helpStatusOf(detail);
          return (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <StudentPhoto student={{ name: detail.name, profilePic: detail.profilePic }} className="size-11 text-sm" />
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900">{detail.name}</h3>
                    <p className="text-[11.5px] text-slate-500">Roll {detail.roll ?? '—'} · last {days} days</p>
                    <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${st.pill}`}><span className={`size-1.5 rounded-full ${st.dot}`} /> {st.label}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setDetail(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="size-4" /></button>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[['Total events', detail.totalEvents || 0], ['Homework Help', detail.homeworkHelpUsed || 0], ['Stuck signals', detail.stuckSignals || 0], ['Misconception help', detail.misconceptionExplainerUsed || 0]].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                      <p className="text-[10.5px] text-slate-500">{k}</p>
                      <p className="text-[15px] font-bold text-slate-900">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-[12px] font-semibold text-slate-700">Top subjects</p>
                    {(detail.topSubjects || []).length ? detail.topSubjects.map((t) => (
                      <p key={t.subject} className="flex justify-between text-[11.5px] text-slate-700"><span>{t.subject}</span><span className="font-semibold">{t.count}</span></p>
                    )) : <p className="text-[11.5px] text-slate-400">—</p>}
                  </div>
                  <div>
                    <p className="mb-1.5 text-[12px] font-semibold text-slate-700">Top topics</p>
                    {(detail.topTopics || []).length ? detail.topTopics.map((t) => (
                      <p key={`${t.subject}-${t.topicTitle}`} className="flex justify-between gap-2 text-[11.5px] text-slate-700"><span className="truncate">{t.topicTitle}</span><span className="font-semibold">{t.count}</span></p>
                    )) : <p className="text-[11.5px] text-slate-400">—</p>}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[12px] font-semibold text-slate-700">Recent activity</p>
                  {(detail.recentEvents || []).length ? (
                    <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                      {detail.recentEvents.map((e, k) => (
                        <div key={k} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11.5px]">
                          <span className="min-w-0 truncate text-slate-700">{HELP_EVENT_LABEL[e.eventType] || e.eventType}{e.topicTitle ? ` · ${e.topicTitle}` : e.subject ? ` · ${e.subject}` : ''}</span>
                          <span className="shrink-0 text-[10.5px] text-slate-400">{new Date(e.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="rounded-lg bg-slate-50 p-3 text-[11.5px] text-slate-500">No help-seeking activity in this period. Events are recorded when the student uses Homework Help in the AI tutor or signals they are stuck.</p>}
                </div>
              </div>
            </>
          );
        })()}
      </ModalShell>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// SOCIAL / BELONGING TAB — Alcove peer-community participation, least engaged
// first, so students who never post/comment/react surface at the top. See
// backend/services/belongingService.js.
// ═════════════════════════════════════════════════════════════════════════════
const BELONGING_BAND_META = {
  isolated: { label: 'Isolated', cls: 'bg-slate-100 text-slate-600', badge: 'border-slate-200 bg-slate-50' },
  low: { label: 'Getting involved', cls: 'bg-amber-100 text-amber-700', badge: 'border-amber-200 bg-amber-50' },
  moderate: { label: 'Active', cls: 'bg-sky-100 text-sky-700', badge: 'border-sky-200 bg-sky-50' },
  active: { label: 'Community champion', cls: 'bg-emerald-100 text-emerald-700', badge: 'border-emerald-200 bg-emerald-50' },
};

const BelongingTab = ({ data, loading, onFetch }) => {
  const isolated = data.filter((s) => s.band === 'isolated').length;
  const active = data.filter((s) => s.band === 'active' || s.band === 'moderate').length;

  return (
    <div className="space-y-6 rounded-[2rem] border border-[#eaedf0] bg-white p-5 shadow-[0_4px_20px_rgba(0,20,30,0.06)] sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.01em] text-[#1a2e3f]">
            <span className="flex size-8 items-center justify-center rounded-full bg-rose-100 text-rose-600"><Heart className="size-4" /></span>
            Social / Belonging
          </h2>
          <p className="mt-1 text-xs text-[#5a7a8e]">Participation in the Alcove peer community — posts, comments, likes. Least engaged first.</p>
        </div>
        <button onClick={onFetch} disabled={loading} className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8ee] bg-[#f8fafc] px-4 py-1.5 text-xs font-semibold text-[#3a5a6e] hover:bg-[#edf1f5] disabled:opacity-50">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />} Refresh
        </button>
      </header>

      {!loading && data.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-3 text-center text-slate-600">
            <p className="text-2xl font-bold">{isolated}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">Isolated</p>
          </div>
          <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50 p-3 text-center text-emerald-700">
            <p className="text-2xl font-bold">{active}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">Active / champion</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 text-sm text-[#5a7a8e]">
          <Loader2 className="size-7 animate-spin text-[#3a7a94]" /> Loading community data…
        </div>
      ) : data.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.4rem] bg-[#f8fafc] text-center">
          <Heart className="mb-2 size-10 text-[#8fa8b8]" />
          <h3 className="text-base font-semibold text-[#1a2e3f]">No community activity yet</h3>
          <p className="mt-1 text-sm text-[#5a7a8e]">Nobody in this class has posted, commented, or reacted on Alcove yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((s, i) => {
            const meta = BELONGING_BAND_META[s.band] || BELONGING_BAND_META.isolated;
            return (
              <Motion.article
                key={s.studentId || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.045 }}
                whileHover={{ y: -2 }}
                className={`rounded-[1.4rem] border p-4 transition hover:shadow-[0_2px_12px_rgba(0,20,30,0.06)] sm:p-5 ${meta.badge}`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1a2e3f]">{s.name || 'Unknown student'}</p>
                    <p className="mt-0.5 text-[10px] text-[#5a7a8e]">{s.roll ? `Roll ${s.roll}` : ''}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${meta.cls}`}>{meta.label}</span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-black/5 pt-3 text-xs text-[#3a5a6e]">
                  <span>Posts: <strong>{s.postsAuthored}</strong></span>
                  <span>Comments: <strong>{s.commentsAuthored}</strong></span>
                  <span>Likes received: <strong>{s.likesReceived}</strong></span>
                </div>
              </Motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// LEARNING STYLE TAB — class-wide distribution of detected content-format
// preference. See backend/services/learningStyleService.js.
// ═════════════════════════════════════════════════════════════════════════════
const LEARNING_STYLE_TAB_META = {
  visual: { label: 'Visual', emoji: '🖼️', cls: 'bg-violet-100 text-violet-700' },
  reading: { label: 'Reading', emoji: '📖', cls: 'bg-sky-100 text-sky-700' },
  'hands-on': { label: 'Hands-on', emoji: '✍️', cls: 'bg-amber-100 text-amber-700' },
  listening: { label: 'Guided/Verbal', emoji: '💬', cls: 'bg-emerald-100 text-emerald-700' },
};

const LearningStyleTab = ({ data, loading, onFetch }) => {
  const distribution = data?.distribution || {};
  const students = data?.students || [];
  const classified = students.filter((s) => s.dataStatus === 'available');

  return (
    <div className="space-y-6 rounded-[2rem] border border-[#eaedf0] bg-white p-5 shadow-[0_4px_20px_rgba(0,20,30,0.06)] sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.01em] text-[#1a2e3f]">
            <span className="flex size-8 items-center justify-center rounded-full bg-violet-100 text-violet-600"><Sparkle className="size-4" /></span>
            Learning Style
          </h2>
          <p className="mt-1 text-xs text-[#5a7a8e]">Detected content-format preference, from which tutor modes each student actually uses most.</p>
        </div>
        <button onClick={onFetch} disabled={loading} className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8ee] bg-[#f8fafc] px-4 py-1.5 text-xs font-semibold text-[#3a5a6e] hover:bg-[#edf1f5] disabled:opacity-50">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />} Refresh
        </button>
      </header>

      {!loading && students.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(LEARNING_STYLE_TAB_META).map(([key, meta]) => (
            <div key={key} className={`rounded-[1.2rem] border border-transparent p-3 text-center ${meta.cls}`}>
              <p className="text-2xl font-bold">{distribution[key] || 0}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">{meta.emoji} {meta.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 text-sm text-[#5a7a8e]">
          <Loader2 className="size-7 animate-spin text-[#3a7a94]" /> Loading learning-style data…
        </div>
      ) : classified.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.4rem] bg-[#f8fafc] text-center">
          <Sparkle className="mb-2 size-10 text-[#8fa8b8]" />
          <h3 className="text-base font-semibold text-[#1a2e3f]">Not enough data yet</h3>
          <p className="mt-1 text-sm text-[#5a7a8e]">Students need more tutor sessions before a style can be detected.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {classified.map((s, i) => {
            const meta = LEARNING_STYLE_TAB_META[s.detectedStyle] || LEARNING_STYLE_TAB_META.visual;
            return (
              <Motion.article
                key={s.studentId || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.045 }}
                whileHover={{ y: -2 }}
                className="rounded-[1.4rem] border border-violet-100 bg-violet-50/40 p-4 transition hover:shadow-[0_2px_12px_rgba(0,20,30,0.06)] sm:p-5"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1a2e3f]">{s.name || 'Unknown student'}</p>
                    <p className="mt-0.5 text-[10px] text-[#5a7a8e]">{s.roll ? `Roll ${s.roll}` : ''}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${meta.cls}`}>{meta.emoji} {meta.label}</span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-black/5 pt-3 text-xs text-[#3a5a6e]">
                  <span>Confidence: <strong>{s.confidence}%</strong></span>
                  {s.selfReported && (
                    <span>Self-reported: <strong>{s.selfReported}</strong> {s.agreesWithSelfReport === false ? '(mismatch)' : ''}</span>
                  )}
                </div>
              </Motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Small "i" button that explains a stat card in plain language (hover, focus or tap).
const InfoTip = ({ text, label }) => {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={`What does ${label} mean?`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[9px] font-bold italic leading-none text-slate-500 transition hover:border-blue-400 hover:text-blue-600"
      >
        i
      </button>
      {open && (
        <span role="tooltip" className="absolute left-1/2 top-full z-40 mt-1.5 w-56 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-[11.5px] font-normal leading-snug text-white shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// PROGRESS TAB COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
const ProgressTab = ({
  filteredStudents, analytics, loading, error, setError,
  overallScore, classLabel,
  selectedStudent, setSelectedStudent, setActiveTab
}) => {
  // A student needs support for any of these reasons (most serious first):
  //   low   — real marks average below 60%
  //   missed — submitted under 60% of the assignments set for them
  //   unassessed — assignments submitted / set, but nothing graded and no exam marks
  const supportReason = (student) => {
    const score = overallScore(student);
    const sum = student.summary || {};
    const assigned = Number(sum.assignedAssignments || 0);
    const submitted = Number(sum.submittedAssignments || 0);
    if (score != null && score < 60) return { rank: 0, sort: score, badge: `${score}%`, text: 'Low marks', tone: 'bg-red-50 text-red-600' };
    if (assigned > 0 && submitted / assigned < 0.6) {
      return { rank: 1, sort: submitted / assigned, badge: `${submitted}/${assigned}`, text: `Missed ${assigned - submitted} assignment${assigned - submitted === 1 ? '' : 's'}`, tone: 'bg-orange-50 text-orange-600' };
    }
    if (score == null && (assigned > 0 || submitted > 0)) {
      return { rank: 2, sort: 0, badge: 'Not graded', text: 'No marks yet — grade work', tone: 'bg-slate-100 text-slate-600' };
    }
    return null;
  };
  const supportStudents = filteredStudents
    .map((student) => ({ student, reason: supportReason(student) }))
    .filter((row) => row.reason)
    .sort((a, b) => a.reason.rank - b.reason.rank || a.reason.sort - b.reason.sort);
  const averageFromMetrics = (field) => {
    const values = filteredStudents
      .flatMap((student) => student.progressMetrics || [])
      .map((metric) => Number(metric?.[field]))
      .filter((value) => Number.isFinite(value) && value > 0);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  };
  // Every metric is null when nothing stands behind it, so the UI shows
  // "No data yet" instead of a misleading 0% (or a value copied from another card).
  const examCount = Number(analytics?.dataCounts?.examResults ?? 0);
  const studentScores = filteredStudents.filter((s) => overallScore(s) != null);
  const averageScore = examCount > 0 || Number(analytics?.averageScore) > 0
    ? Number(analytics.averageScore)
    : studentScores.length
      ? Math.round(studentScores.reduce((sum, student) => sum + overallScore(student), 0) / studentScores.length)
      : null;
  const attendanceRate = analytics?.attendanceRate ?? null;
  const assignmentPairs = filteredStudents
    .flatMap((student) => student.progressMetrics || [])
    .map((metric) => ({ completed: Number(metric?.completedAssignments), total: Number(metric?.totalAssignments) }))
    .filter((item) => item.total > 0);
  const assignmentTotal = assignmentPairs.reduce((sum, item) => sum + item.total, 0);
  const assignmentCompletion = analytics?.assignmentCompletion != null
    ? Number(analytics.assignmentCompletion)
    : assignmentPairs.length
    ? Math.round((assignmentPairs.reduce((sum, item) => sum + item.completed, 0) / assignmentTotal) * 100)
    : null;
  // Exams are the tests, so the exam-based average is the test score.
  const testPerformance = Number(analytics?.testPerformance ?? analytics?.assessmentAverage ?? 0)
    || averageFromMetrics('testPerformance')
    || (examCount > 0 ? averageScore : null);
  const attendanceDays = Number(analytics?.attendanceMeta?.markedStudentDays ?? 0);
  const progressItems = [
    { label: 'Overall class average', value: averageScore, tone: 'bg-blue-600' },
    { label: 'Attendance rate', value: attendanceRate, tone: 'bg-sky-500' },
    { label: 'Assignment completion', value: assignmentCompletion, tone: 'bg-emerald-500' },
    { label: 'Test performance', value: testPerformance, tone: 'bg-orange-400' },
  ];
  const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));
  const pctOrEmpty = (value) => (value == null ? 'No data yet' : `${clampPercent(value)}%`);
  const totalStudents = analytics?.totalStudents ?? filteredStudents.length;
  const statCards = [
    {
      label: 'Total Students', value: totalStudents, helper: classLabel, icon: Users, iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600',
      info: 'Number of students enrolled in this class-section this academic year.',
    },
    {
      label: 'Overall Class Average', value: pctOrEmpty(averageScore),
      helper: examCount > 0 ? `From ${examCount} exam result${examCount === 1 ? '' : 's'}` : 'Across all subjects',
      icon: BarChart3, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
      info: 'The average mark of the whole class across every exam entered, as a percentage of full marks. With only a few exams entered, this can look unusually high or low.',
    },
    {
      label: 'Attendance Rate', value: pctOrEmpty(attendanceRate),
      helper: attendanceDays > 0 ? `${analytics?.attendanceMeta?.sessionName || 'This academic year'}` : 'Attendance not taken yet',
      icon: Calendar, iconBg: 'bg-red-100', iconColor: 'text-red-500',
      info: 'Of all the days attendance was taken this academic year, the share where students were present (late counts as present). Days with no attendance taken are not counted.',
    },
    {
      label: 'Assignment Completion', value: pctOrEmpty(assignmentCompletion),
      helper: assignmentCompletion == null
        ? 'No assignments set yet'
        : analytics?.assignmentMeta
          ? `${analytics.assignmentMeta.submitted} of ${analytics.assignmentMeta.assigned} submitted`
          : 'Submitted',
      icon: FileText, iconBg: 'bg-orange-100', iconColor: 'text-orange-500',
      info: 'Of all assignments given to this class, the share students submitted.',
    },
    {
      label: 'Test Performance', value: pctOrEmpty(testPerformance),
      helper: testPerformance == null ? 'No test marks yet' : 'Average test score',
      icon: CheckCircle, iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
      info: 'The class average score in tests and exams, as a percentage of full marks.',
    },
  ];

  return (
    <div className="space-y-4">
      {error && (
        <Motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <p className="flex-1 font-medium">{error}</p>
          <button type="button" onClick={() => setError('')} className="rounded-full p-1 text-red-400 hover:bg-red-100 hover:text-red-600" aria-label="Dismiss error">
            <X className="size-3.5" />
          </button>
        </Motion.div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card) => (
          <div key={card.label} className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
              <card.icon className={`size-[18px] ${card.iconColor}`} strokeWidth={2.3} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="text-[11.5px] leading-tight text-slate-600">{card.label}</p>
                <InfoTip text={card.info} label={card.label} />
              </div>
              <p className={card.value === 'No data yet'
                ? 'text-[13px] font-semibold leading-7 text-slate-400'
                : 'text-lg font-bold leading-snug text-slate-900'}
              >{loading ? '—' : card.value}</p>
              <p className="text-[10.5px] leading-tight text-slate-500">{card.helper}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Needs Support ── */}
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-3 text-[16px] font-semibold text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50"><AlertTriangle className="size-5 fill-red-500 text-white" /></span>
              Needs Support
            </h2>
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-slate-800">{supportStudents.length}</span>
          </div>

          {loading ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-6 animate-spin text-blue-600" /> Loading progress...
            </div>
          ) : supportStudents.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl bg-emerald-50/50 px-4 text-center text-sm text-slate-600">
              <CheckCircle className="mb-2 size-8 text-emerald-600" />
              No students currently need additional support.
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {supportStudents.slice(0, 6).map(({ student, reason }) => {
                  return (
                    <button
                      key={student._id || student.studentId?._id}
                      type="button"
                      onClick={() => setSelectedStudent(student)}
                      className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <StudentPhoto student={student.studentId} className="size-9 text-sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-slate-900">{student.studentId?.name || 'Unknown'}</p>
                          <p className="text-[11.5px] text-slate-500">Roll {student.studentId?.roll || '—'} · {reason.text}</p>
                        </div>
                      </div>
                      <span className={`min-w-20 shrink-0 rounded-full px-2 py-1 text-center text-xs font-semibold ${reason.tone}`}>{reason.badge}</span>
                    </button>
                  );
                })}
              </div>
              {supportStudents.length > 6 && (
                <button type="button" onClick={() => setActiveTab('intervention')} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50 py-2.5 text-[13px] text-slate-700 transition hover:bg-blue-100">
                  <ChevronRight className="size-4 text-blue-600" /> {supportStudents.length - 6} more students · view all
                </button>
              )}
            </>
          )}
        </section>

        {/* ── Class Progress ── */}
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-3 text-[16px] font-semibold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50"><BarChart3 className="size-5 text-blue-600" /></span>
            Class Progress
            <span className="ml-auto text-[13px] font-normal text-slate-500">{classLabel} · {new Date().getFullYear()}</span>
          </div>

          <div className="space-y-3.5 border-t border-slate-100 pt-3">
            {progressItems.map((item, index) => {
              const empty = item.value == null;
              const value = clampPercent(item.value);
              return (
                <div key={item.label}>
                  <div className="mb-1.5 flex justify-between text-[13px] text-slate-800">
                    <span>{item.label}</span>
                    <span className={empty ? 'text-xs font-medium text-slate-400' : 'font-semibold text-slate-900'}>{empty ? 'No data yet' : `${value}%`}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <Motion.div
                      initial={{ width: 0 }}
                      animate={{ width: empty ? '0%' : `${Math.max(value, 1.5)}%` }}
                      transition={{ duration: 0.8, delay: 0.15 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                      className={`h-full rounded-full ${value === 0 ? 'bg-red-500' : item.tone}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[
              { icon: GraduationCapIcon, value: `${averageScore}%`, label: 'Class avg' },
              { icon: Users, value: analytics?.totalStudents ?? filteredStudents.length, label: 'Students' },
              { icon: FileText, value: supportStudents.length, label: 'At risk' },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center rounded-xl bg-slate-50 px-2 py-3 text-center">
                <stat.icon className="mb-1 size-5 text-blue-700" />
                <span className="text-xl font-bold text-slate-900">{stat.value}</span>
                <span className="text-xs text-slate-500">{stat.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};


// ═════════════════════════════════════════════════════════════════════════════
// INTERVENTION TAB COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
// Full-screen dark backdrop + animated dialog, portalled to <body> so no page
// container (overflow / transforms) can clip it. Esc and backdrop click close.
const ModalShell = ({ open, onClose, label, width = 'max-w-lg', children }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <Motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <Motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${width}`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

const InterventionTab = ({
  filteredWeakStudents, interventionFilters, setInterventionFilters,
  interventionSearch, setInterventionSearch, loadingWeak, analyzing,
  selectedWeakStudent, setSelectedWeakStudent, analyzeStudentWeakness,
  generateLearningPath, navigate, classLabel,
  interventionModal, setInterventionModal, interventionForm, setInterventionForm,
  savingIntervention, logIntervention, interventionLogs,
  outcomeModal, setOutcomeModal, outcomeForm, setOutcomeForm, recordOutcome, deleteIntervention,
  setActiveTab,
}) => {
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('priority-desc');
  const [menuFor, setMenuFor] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const activeFilterCount = [interventionFilters.subject, interventionFilters.interventionLevel].filter(Boolean).length;

  const LEVEL_RANK = { critical: 3, high: 2, medium: 1, low: 0 };
  const levelOf = (student) => student.level || student.riskLevel || 'medium';
  const countLevel = (key) => filteredWeakStudents.filter((student) => levelOf(student) === key).length;

  const statCards = [
    { label: 'Critical Students', value: countLevel('critical'), helper: 'Need immediate support', icon: AlertTriangle, iconClass: 'bg-red-50 text-red-500' },
    { label: 'High Priority', value: countLevel('high'), helper: 'Significant improvement needed', icon: BarChart2, iconClass: 'bg-amber-50 text-amber-500' },
    { label: 'Medium Priority', value: countLevel('medium'), helper: 'Need moderate support', icon: Users, iconClass: 'bg-violet-50 text-violet-600' },
    { label: 'With AI Paths', value: filteredWeakStudents.filter((student) => student.hasAIPath).length, helper: 'Personalized learning paths', icon: BookOpen, iconClass: 'bg-emerald-50 text-emerald-600' },
  ];

  const sorted = useMemo(() => {
    const list = [...filteredWeakStudents];
    const num = (v, fallback) => (v == null ? fallback : Number(v));
    const sorters = {
      'priority-desc': (a, b) => LEVEL_RANK[levelOf(b)] - LEVEL_RANK[levelOf(a)] || num(a.avgScore, 101) - num(b.avgScore, 101),
      'priority-asc': (a, b) => LEVEL_RANK[levelOf(a)] - LEVEL_RANK[levelOf(b)],
      'score-asc': (a, b) => num(a.avgScore, 101) - num(b.avgScore, 101),
      'attendance-asc': (a, b) => num(a.attPct, 101) - num(b.attPct, 101),
      'name': (a, b) => String(a.name || a.studentName || '').localeCompare(String(b.name || b.studentName || '')),
    };
    return list.sort(sorters[sortBy] || sorters['priority-desc']);
  }, [filteredWeakStudents, sortBy]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [interventionSearch, interventionFilters, sortBy]);

  const updateFilter = (key, value) => setInterventionFilters((previous) => ({ ...previous, [key]: value }));

  const exportCsv = () => {
    const header = ['#', 'Student', 'Grade', 'Section', 'Priority', 'Attendance %', 'Avg Score %', 'Trend'];
    const rows = sorted.map((student, i) => [
      i + 1, student.name || student.studentName || '', student.grade || '', student.section || '',
      levelOf(student), student.attPct ?? '', student.avgScore ?? '', student.scoreTrend ?? '',
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `intervention-${classLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const PRIORITY_PILL = {
    critical: 'bg-red-50 text-red-600',
    high: 'bg-red-50 text-red-500',
    medium: 'bg-amber-50 text-amber-600',
    low: 'bg-blue-50 text-blue-600',
  };
  const AVATAR_TONES = ['bg-blue-50 text-blue-600', 'bg-rose-50 text-rose-500', 'bg-amber-50 text-amber-600', 'bg-violet-50 text-violet-600', 'bg-emerald-50 text-emerald-600'];

  // Small progress ring used for attendance (green) and score (red).
  const Ring = ({ value, color }) => {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    const r = 14;
    const c = 2 * Math.PI * r;
    return (
      <svg viewBox="0 0 36 36" className="size-6 -rotate-90 shrink-0">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#eef1f4" strokeWidth="4" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
      </svg>
    );
  };

  const pageNumbers = (() => {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
    const set = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
    const list = [...set].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
    return list.flatMap((n, i) => (i > 0 && n - list[i - 1] > 1 ? ['…', n] : [n]));
  })();

  return (
    <div className="space-y-3">
      {/* Header */}
      <header className="flex items-center justify-center gap-3">
        <div className='w-full flex flex-col justify-center items-center'>
          <h2 className="flex items-center gap-1.5 text-lg font-bold tracking-tight text-slate-900">
            {/* <Flag className="size-4 fill-rose-500 text-rose-500" />  */}
            Intervention
          </h2>
          <p className="text-[12.5px] text-slate-500">{classLabel} <span className="mx-1">·</span> Full class performance</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={!sorted.length} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 text-white px-3.5 text-[13px] font-semibold bg-blue-500 shadow-sm transition hover:bg-blue-50 disabled:opacity-50">
          <Download className="size-4" /> Export
        </button>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-3 shadow-sm"
          >
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${stat.iconClass}`}><stat.icon className="size-[18px]" /></div>
            <div className="min-w-0">
              <p className="text-[11.5px] text-slate-600">{stat.label}</p>
              <p className="text-lg font-bold leading-tight text-slate-900">{loadingWeak ? '—' : stat.value}</p>
              <p className="truncate text-[10.5px] text-slate-500">{stat.helper}</p>
            </div>
          </Motion.div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        {/* Toolbar — subject / level filters live behind the filter toggle */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 focus-within:border-blue-300">
            <Search className="size-3.5 text-slate-400" />
            <input value={interventionSearch} onChange={(event) => setInterventionSearch(event.target.value)} placeholder="Search students..." className="w-full bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-slate-400" />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-label={filtersOpen ? 'Close filters' : 'Open filters'}
            aria-expanded={filtersOpen}
            className={`relative flex size-8 items-center justify-center rounded-full border transition ${filtersOpen ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {filtersOpen ? <X className="size-4" /> : <Filter className="size-4" />}
            {!filtersOpen && activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">{activeFilterCount}</span>
            )}
          </button>
          <AnimatePresence initial={false}>
            {filtersOpen && (
              <Motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="flex flex-wrap items-center gap-2"
              >
                <label className="relative flex items-center">
                  <BookOpen className="pointer-events-none absolute left-2.5 size-3.5 text-slate-500" />
                  <select value={interventionFilters.subject} onChange={(event) => updateFilter('subject', event.target.value)} className="h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[12.5px] text-slate-800 outline-none focus:border-blue-300">
                    <option value="">All Subjects</option><option value="Mathematics">Mathematics</option><option value="Physics">Physics</option><option value="Chemistry">Chemistry</option><option value="Biology">Biology</option><option value="English">English</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
                </label>
                <label className="relative flex items-center">
                  <BarChart2 className="pointer-events-none absolute left-2.5 size-3.5 text-slate-500" />
                  <select value={interventionFilters.interventionLevel} onChange={(event) => updateFilter('interventionLevel', event.target.value)} className="h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[12.5px] text-slate-800 outline-none focus:border-blue-300">
                    <option value="">All Levels</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
                </label>
              </Motion.div>
            )}
          </AnimatePresence>
          {/* <span className="px-1 text-[12.5px] text-slate-600">{sorted.length} students</span> */}
          <label className="relative ml-auto flex items-center">
            <ArrowUpDown className="pointer-events-none absolute left-2.5 size-3.5 text-slate-500" />
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort by" className="h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[12.5px] text-slate-800 outline-none focus:border-blue-300">
              <option value="priority-desc">Priority (High to Low)</option>
              <option value="priority-asc">Priority (Low to High)</option>
              <option value="score-asc">Avg Score (Low to High)</option>
              <option value="attendance-asc">Attendance (Low to High)</option>
              <option value="name">Name (A–Z)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
          </label>
        </div>

      {loadingWeak ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-7 animate-spin text-blue-600" /> Analyzing weak students...
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
          <CheckCircle className="mb-2 size-10 text-emerald-600" />
          <h3 className="text-base font-semibold text-slate-900">Great News!</h3>
          <p className="mt-1 text-sm text-slate-500">No students currently need immediate intervention.</p>
        </div>
      ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[11.5px] text-slate-500">
                <th className="w-14 px-3 py-2 text-center font-medium">#</th>
                <th className="px-3 py-2 font-medium">Student</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Attendance</th>
                <th className="px-3 py-2 font-medium">Avg Score</th>
                <th className="px-3 py-2 font-medium">Trend</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((student, index) => {
                const level = levelOf(student);
                const studentId = student.studentId;
                const studentName = student.name || student.studentName || 'Unknown';
                const rowNumber = (currentPage - 1) * PAGE_SIZE + index + 1;
                const trend = student.scoreTrend;
                return (
                  <tr key={studentId || rowNumber} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-3 py-1.5 text-center text-xs text-slate-500">{rowNumber}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-3">
                        {photoUrlOf(student) ? (
                          <StudentPhoto student={{ name: studentName, profilePic: student.profilePic }} className="size-8 text-xs" />
                        ) : (
                          <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_TONES[rowNumber % AVATAR_TONES.length]}`}>
                            {studentName.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-slate-900">{studentName}</p>
                          <p className="text-[11px] text-slate-500">
                            {student.grade ? `Grade ${student.grade}` : classLabel}{student.section ? ` · ${student.section}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${PRIORITY_PILL[level] || PRIORITY_PILL.medium}`}>
                        <span className="size-1.5 rounded-full bg-current" /> {level}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <Ring value={student.attPct} color={student.attPct != null && student.attPct < 75 ? '#ef4444' : '#16a34a'} />
                        <div
                          className="leading-tight"
                          title={student.attendanceDays
                            ? `${student.attendanceDays.sessionName || 'Academic year'}: ${student.attendanceDays.present} present, ${student.attendanceDays.absent} absent, ${student.attendanceDays.notMarked} not marked of ${student.attendanceDays.schoolDays} school days`
                            : undefined}
                        >
                          <span className="text-[12.5px] font-semibold text-slate-900">{student.attPct != null ? `${student.attPct}%` : '—'}</span>
                          {student.attendanceDays && (
                            <p className="text-[10.5px] text-slate-500">{student.attendanceDays.present}/{student.attendanceDays.schoolDays} days</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <Ring value={student.avgScore} color="#ef4444" />
                        <span className="text-[12.5px] font-semibold text-slate-900">{student.avgScore != null ? `${student.avgScore}%` : '—'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      {trend == null ? <span className="text-xs text-slate-400">—</span> : (
                        <span className={`inline-flex min-w-[56px] items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${trend < 0 ? 'bg-red-50 text-red-600' : trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                          {trend < 0 ? <TrendingDown className="size-3.5" /> : trend > 0 ? <TrendingUp className="size-3.5" /> : <Minus className="size-3.5" />}
                          {trend > 0 ? `+${trend}` : trend}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setInterventionModal({ studentId, studentName, riskLevel: level, attPct: student.attPct, avgScore: student.avgScore, scoreTrend: student.scoreTrend })}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-blue-50 px-2.5 py-1.5 text-[11px] font-medium text-blue-700 transition hover:bg-blue-100"
                        >
                          <FileText className="size-3.5" /> Log Intervention
                        </button>
                        {studentId && (
                          <button type="button" onClick={() => generateLearningPath(studentId, 'General', [], 'basic')} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-violet-50 px-2.5 py-1.5 text-[11px] font-medium text-violet-700 transition hover:bg-violet-100">
                            <Sparkle className="size-3.5" /> AI Path
                          </button>
                        )}
                        <div className="relative">
                          <button type="button" aria-label="More actions" onClick={() => setMenuFor(menuFor === rowNumber ? null : rowNumber)} className="flex size-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100">
                            <MoreHorizontal className="size-5" />
                          </button>
                          {menuFor === rowNumber && (
                            <div className={`absolute right-0 z-20 w-44 rounded-xl border border-slate-100 bg-white p-1 shadow-lg ${index >= pageRows.length - 2 && pageRows.length > 2 ? 'bottom-full mb-1' : 'top-full mt-1'}`} onMouseLeave={() => setMenuFor(null)}>
                              <button type="button" disabled={!studentId || analyzing} onClick={() => { setMenuFor(null); analyzeStudentWeakness(studentId); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                                <Brain className="size-4 text-violet-600" /> Analyze weakness
                              </button>
                              <button type="button" onClick={() => { setMenuFor(null); setSelectedWeakStudent(student); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50">
                                <Eye className="size-4 text-blue-600" /> View details
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sorted.length)} of {sorted.length} students
          </p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page" className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft className="size-4" />
            </button>
            {pageNumbers.map((n, i) => (n === '…' ? (
              <span key={`gap-${i}`} className="px-1.5 text-xs text-slate-400">…</span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === currentPage ? 'page' : undefined}
                className={`flex size-8 items-center justify-center rounded-lg text-xs font-semibold transition ${n === currentPage ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              >
                {n}
              </button>
            )))}
            <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount} aria-label="Next page" className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        {/* Intervention logs */}
        {interventionLogs.length > 0 && (
          <div className="border-t border-slate-100 p-4">
            <h3 className="text-sm font-bold text-[#1a2e3f] mb-3">Recent Interventions</h3>
            <div className="space-y-2">
              {interventionLogs.slice(0, 6).map((log) => (
                <div key={log._id} className="flex items-center justify-between gap-3 rounded-xl border border-[#eaedf0] bg-white px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1a2e3f] truncate">{log.studentName}</p>
                    <p className="text-xs text-[#5a7a8e] truncate">{log.action}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      log.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                      log.status === 'in_progress' ? 'bg-amber-50 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{log.status}</span>
                    {log.status !== 'completed' && (
                      <button type="button"
                        onClick={() => { setOutcomeModal({ interventionId: log._id, studentName: log.studentName, action: log.action }); setOutcomeForm({ outcome: '', improvement: '' }); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Record Outcome
                      </button>
                    )}
                    <button type="button" onClick={() => setDeleteTarget(log)} aria-label="Delete intervention"
                      className="rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log intervention modal */}
        <ModalShell open={Boolean(interventionModal)} onClose={() => setInterventionModal(null)} label="Log intervention">
          {interventionModal && (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><FileText className="size-5" /></span>
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900">Log Intervention</h3>
                    <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
                      {interventionModal.studentName}
                      {interventionModal.riskLevel && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold capitalize text-red-600">{interventionModal.riskLevel}</span>
                      )}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setInterventionModal(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="size-4" /></button>
              </div>

              {(interventionModal.attPct != null || interventionModal.avgScore != null) && (
                <div className="grid grid-cols-3 gap-2 px-5 pt-4">
                  {[
                    { label: 'Attendance', value: interventionModal.attPct != null ? `${interventionModal.attPct}%` : '—' },
                    { label: 'Avg Score', value: interventionModal.avgScore != null ? `${interventionModal.avgScore}%` : '—' },
                    { label: 'Trend', value: interventionModal.scoreTrend ? `${interventionModal.scoreTrend > 0 ? '+' : ''}${interventionModal.scoreTrend}` : '—' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                      <p className="text-[10.5px] text-slate-500">{s.label}</p>
                      <p className="text-[13px] font-semibold text-slate-900">{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4 px-5 py-4">
                <div>
                  <label htmlFor="iv-action" className="mb-1.5 block text-[12px] font-semibold text-slate-700">Action taken <span className="text-red-500">*</span></label>
                  <input id="iv-action" autoFocus value={interventionForm.action} onChange={(e) => setInterventionForm((f) => ({ ...f, action: e.target.value }))}
                    placeholder="e.g. One-on-one session scheduled"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {['One-on-one session', 'Remedial class', 'Parent meeting', 'Extra practice worksheet', 'Peer tutoring'].map((preset) => (
                      <button key={preset} type="button" onClick={() => setInterventionForm((f) => ({ ...f, action: preset }))}
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition ${interventionForm.action === preset ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}>
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="iv-notes" className="mb-1.5 block text-[12px] font-semibold text-slate-700">Notes</label>
                  <textarea id="iv-notes" value={interventionForm.notes} onChange={(e) => setInterventionForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3} placeholder="Additional context…"
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                </div>
                <div>
                  <label htmlFor="iv-date" className="mb-1.5 block text-[12px] font-semibold text-slate-700">Scheduled date &amp; time</label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input id="iv-date" type="datetime-local" value={interventionForm.scheduledDate} onChange={(e) => setInterventionForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-[13px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  </div>
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
                    <AlertCircle className="size-3.5" /> If set, the student is notified of the session date and time.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                <button type="button" onClick={() => setInterventionModal(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={logIntervention} disabled={savingIntervention || !interventionForm.action.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
                  {savingIntervention ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : <><CheckCircle className="size-4" /> Save Intervention</>}
                </button>
              </div>
            </>
          )}
        </ModalShell>

        {/* Outcome modal */}
        <ModalShell open={Boolean(outcomeModal)} onClose={() => setOutcomeModal(null)} label="Record outcome" width="max-w-md">
          {outcomeModal && (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Target className="size-5" /></span>
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900">Record Outcome</h3>
                    <p className="text-[12px] text-slate-500">{outcomeModal.studentName || 'Intervention'}{outcomeModal.action ? ` · ${outcomeModal.action}` : ''}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setOutcomeModal(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="size-4" /></button>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div>
                  <label htmlFor="oc-outcome" className="mb-1.5 block text-[12px] font-semibold text-slate-700">Outcome</label>
                  <textarea id="oc-outcome" autoFocus value={outcomeForm.outcome} onChange={(e) => setOutcomeForm((f) => ({ ...f, outcome: e.target.value }))}
                    rows={3} placeholder="What happened as a result?"
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                </div>
                <div>
                  <label htmlFor="oc-improvement" className="mb-1.5 block text-[12px] font-semibold text-slate-700">Score improvement</label>
                  <div className="relative">
                    <input id="oc-improvement" type="number" value={outcomeForm.improvement} onChange={(e) => setOutcomeForm((f) => ({ ...f, improvement: e.target.value }))}
                      placeholder="e.g. 12"
                      className="w-full rounded-lg border border-slate-200 py-2 pl-3 pr-9 text-[13px] outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">%</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[5, 10, 15, 20].map((v) => (
                      <button key={v} type="button" onClick={() => setOutcomeForm((f) => ({ ...f, improvement: String(v) }))}
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition ${String(outcomeForm.improvement) === String(v) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-emerald-200 hover:text-emerald-700'}`}>
                        +{v}%
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">Points gained since the intervention started. Use a negative number if scores dropped.</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                <button type="button" onClick={() => setOutcomeModal(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={recordOutcome} disabled={!outcomeForm.outcome.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                  <CheckCircle className="size-4" /> Save Outcome
                </button>
              </div>
            </>
          )}
        </ModalShell>

        {/* Delete confirmation */}
        <ModalShell open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} label="Delete intervention" width="max-w-sm">
          {deleteTarget && (
            <div className="p-6 text-center">
              <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600"><Trash2 className="size-6" /></span>
              <h3 className="text-[15px] font-bold text-slate-900">Delete this intervention?</h3>
              <p className="mt-1.5 text-[12.5px] text-slate-500">
                <span className="font-semibold text-slate-700">{deleteTarget.studentName}</span>{deleteTarget.action ? ` — ${deleteTarget.action}` : ''}. Its follow-up checks stop too. This cannot be undone.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)} className="rounded-lg border border-slate-200 bg-white py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    await deleteIntervention(deleteTarget._id);
                    setDeleting(false);
                    setDeleteTarget(null);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2 text-[13px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? <><Loader2 className="size-4 animate-spin" /> Deleting…</> : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </ModalShell>
        </>
      )}

      {selectedWeakStudent && (
        <WeakStudentDetailModal
          student={selectedWeakStudent}
          onClose={() => setSelectedWeakStudent(null)}
          generateLearningPath={generateLearningPath}
        />
      )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// STUDENT DETAIL MODAL (Progress)
// ═════════════════════════════════════════════════════════════════════════════
const StudentDetailModal = ({ student, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedExamKey, setSelectedExamKey] = useState('');
  const studentKey = student?.studentId?._id || student?.studentId || student?._id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await cachedFetch(`${API_BASE}/api/progress/student/${studentKey}/overview`, { headers: authHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Unable to load student details');
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load student details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentKey]);

  const profile = detail?.student || student?.studentId || {};
  const name = profile.name || 'Student';
  const att = detail?.attendance || null;
  const subjects = detail?.subjects || [];
  const exams = detail?.exams || [];
  const submissions = detail?.submissions || [];
  const totals = detail?.totals || {};
  const tone = (v) => (v == null ? 'text-slate-400' : v >= 75 ? 'text-emerald-600' : v >= 50 ? 'text-amber-600' : 'text-red-600');
  const bar = (v) => (v >= 75 ? 'bg-emerald-500' : v >= 50 ? 'bg-amber-400' : 'bg-red-500');
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—');
  const fmtPct = (v) => (v == null ? '—' : `${v}%`);

  const summary = [
    { label: 'Overall Score', value: fmtPct(detail?.overallScore ?? null), cls: tone(detail?.overallScore ?? null), icon: BarChart3, bg: 'bg-blue-50 text-blue-600' },
    { label: 'Attendance', value: att ? `${att.percentage}%` : '—', sub: att ? `${att.presentDays}/${att.schoolDays} days` : '', cls: tone(att ? att.percentage : null), icon: Calendar, bg: 'bg-emerald-50 text-emerald-600' },
    { label: 'Submissions', value: totals.submissions ?? '—', sub: totals.submissions ? `${totals.graded || 0} graded · ${totals.late || 0} late` : '', cls: 'text-slate-900', icon: FileText, bg: 'bg-orange-50 text-orange-500' },
    { label: 'Exams', value: totals.exams ?? '—', sub: subjects.length ? `${subjects.length} subjects` : '', cls: 'text-slate-900', icon: BookOpen, bg: 'bg-violet-50 text-violet-600' },
  ];

  // Group subject results into exams (same title + term) with exam-wise totals.
  const examGroups = (() => {
    const map = new Map();
    exams.forEach((e) => {
      const key = `${e.title}|${e.term}`;
      if (!map.has(key)) map.set(key, { key, title: e.title, term: e.term, date: e.date, subjects: [] });
      const g = map.get(key);
      g.subjects.push(e);
      if (e.date && (!g.date || new Date(e.date) > new Date(g.date))) g.date = e.date;
    });
    return [...map.values()]
      .map((g) => {
        const obtained = g.subjects.reduce((s, e) => s + (e.marks == null ? 0 : Number(e.marks) || 0), 0);
        const max = g.subjects.reduce((s, e) => s + (Number(e.maxMarks) || 0), 0);
        const percentage = max > 0 ? Math.round((obtained / max) * 100) : null;
        const result = g.subjects.some((e) => e.status === 'fail') ? 'fail'
          : g.subjects.every((e) => e.status === 'absent') ? 'absent' : 'pass';
        return { ...g, subjects: [...g.subjects].sort((a, b) => String(a.subject).localeCompare(String(b.subject))), obtained, max, percentage, result };
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  })();
  const activeExam = examGroups.find((g) => g.key === selectedExamKey) || examGroups[0] || null;

  const statusBadge = (status) => ({
    graded: 'bg-emerald-50 text-emerald-700',
    submitted: 'bg-blue-50 text-blue-700',
    late: 'bg-amber-50 text-amber-700',
    pass: 'bg-emerald-50 text-emerald-700',
    fail: 'bg-red-50 text-red-600',
    absent: 'bg-slate-100 text-slate-600',
  }[status] || 'bg-red-50 text-red-600');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <Motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        role="dialog"
        aria-modal="true"
        aria-label={`${name} details`}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 px-5 py-4">
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 transition hover:bg-white/70 hover:text-slate-700">
            <X size={18} />
          </button>
          <div className="flex items-center gap-4">
            <StudentPhoto student={profile} className="size-16 text-xl ring-4 ring-white shadow-md" />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-900">{name}</h2>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[11.5px]">
                <span className="rounded-full bg-white px-2.5 py-0.5 font-medium text-blue-700 shadow-sm">Class {profile.grade || '—'}{profile.section ? `-${profile.section}` : ''}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 font-medium text-slate-600 shadow-sm">Roll {profile.roll || '—'}</span>
                {/* {att?.sessionName && <span className="rounded-full bg-white px-2.5 py-0.5 font-medium text-slate-600 shadow-sm">AY {att.sessionName}</span>} */}
                {detail?.improvementTrend && (
                  <span className={`rounded-full px-2.5 py-0.5 font-medium capitalize shadow-sm ${detail.improvementTrend === 'improving' ? 'bg-emerald-50 text-emerald-700' : detail.improvementTrend === 'declining' ? 'bg-red-50 text-red-600' : 'bg-white text-slate-600'}`}>
                    {detail.improvementTrend}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-14"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              <AlertCircle size={14} /> {error}
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {summary.map((s) => (
                  <div key={s.label} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${s.bg}`}><s.icon size={16} /></span>
                    <div className="min-w-0">
                      <p className="text-[10.5px] text-slate-500">{s.label}</p>
                      <p className={`text-base font-bold leading-tight ${s.cls}`}>{s.value}</p>
                      {s.sub && <p className="text-[10px] leading-tight text-slate-400">{s.sub}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Academic-year attendance (day based, holidays excluded) */}
              {att && (
                <section className="rounded-xl border border-slate-100 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Calendar size={15} className="text-emerald-600" /> Attendance — Academic Year {att.sessionName}</h3>
                    <span className={`text-sm font-bold ${tone(att.percentage)}`}>{att.percentage}%</span>
                  </div>
                  <div className="mb-2.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${bar(att.percentage)}`} style={{ width: `${Math.max(att.percentage, 1)}%` }} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      ['Working Days', att.schoolDays, 'text-slate-900'],
                      ['Present', att.presentDays, 'text-emerald-600'],
                      ['Absent', att.absentDays, 'text-red-500'],
                      ['Not Marked', Math.max(0, (att.schoolDays || 0) - (att.presentDays || 0) - (att.absentDays || 0)), 'text-slate-500'],
                    ].map(([l, v, c]) => (
                      <div key={l} className="rounded-lg bg-slate-50 py-1.5">
                        <p className={`text-[15px] font-bold ${c}`}>{v ?? 0}</p>
                        <p className="text-[10.5px] text-slate-500">{l}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10.5px] text-slate-400">
                    Counted from {fmtDate(att.startDate)} to {fmtDate(att.countedUntil)} · holidays excluded
                  </p>
                </section>
              )}

              {/* Subject performance */}
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><BarChart3 size={15} className="text-blue-600" /> Subject Performance</h3>
                {subjects.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 py-6 text-center text-sm text-slate-400">No exam or assignment scores yet.</p>
                ) : (
                  <div className="space-y-2.5 rounded-xl border border-slate-100 p-3">
                    {subjects.map((s) => (
                      <div key={s.subject}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-[12.5px]">
                          <span className="font-medium text-slate-800">{s.subject}</span>
                          <span className="flex items-center gap-3 text-[11px] text-slate-500">
                            <span>Exams {fmtPct(s.examAverage)}{s.examCount ? ` (${s.examCount})` : ''}</span>
                            <span>Assignments {fmtPct(s.assignmentAverage)}{s.submitted ? ` · ${s.submitted} sub.` : ''}</span>
                            <span className={`w-10 text-right text-[12.5px] font-bold ${tone(s.score)}`}>{fmtPct(s.score)}</span>
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          {s.score != null && <div className={`h-full rounded-full ${bar(s.score)}`} style={{ width: `${Math.max(s.score, 2)}%` }} />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Exam results — exam-wise totals, then subject-wise for the selected exam */}
              {examGroups.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Award size={15} className="text-violet-600" /> Exam Results</h3>

                  <div className="mb-3 overflow-hidden rounded-xl border border-slate-100">
                    <table className="w-full text-left text-[12.5px]">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>{['Exam', 'Subjects', 'Total Marks', 'Percentage', 'Result'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {examGroups.map((g) => (
                          <tr
                            key={g.key}
                            onClick={() => setSelectedExamKey(g.key)}
                            className={`cursor-pointer transition ${activeExam?.key === g.key ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
                          >
                            <td className="px-3 py-2 font-medium text-slate-800">{g.title}{g.term && g.term !== g.title ? <span className="ml-1 text-[11px] font-normal text-slate-400">{g.term}</span> : null}</td>
                            <td className="px-3 py-2 text-slate-600">{g.subjects.length}</td>
                            <td className={`px-3 py-2 font-semibold ${tone(g.percentage)}`}>{g.obtained}/{g.max}</td>
                            <td className={`px-3 py-2 font-semibold ${tone(g.percentage)}`}>{fmtPct(g.percentage)}</td>
                            <td className="px-3 py-2"><span className={`rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadge(g.result)}`}>{g.result}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Exam selector */}
                  <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                    {examGroups.map((g) => (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() => setSelectedExamKey(g.key)}
                        className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-1 text-[12px] font-medium transition ${activeExam?.key === g.key ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        {g.title}
                      </button>
                    ))}
                  </div>

                  {activeExam && (
                    <div className="overflow-hidden rounded-xl border border-slate-100">
                      <table className="w-full text-left text-[12.5px]">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>{['Subject', 'Marks', 'Percentage', 'Grade', 'Status'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeExam.subjects.map((e) => (
                            <tr key={e.id} className="text-slate-800">
                              <td className="px-3 py-2 font-medium">{e.subject || '—'}</td>
                              <td className={`px-3 py-2 font-semibold ${tone(e.percentage)}`}>{e.marks == null ? '—' : `${e.marks}/${e.maxMarks}`}</td>
                              <td className={`px-3 py-2 ${tone(e.percentage)}`}>{fmtPct(e.percentage)}</td>
                              <td className="px-3 py-2">{e.grade || '—'}</td>
                              <td className="px-3 py-2"><span className={`rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadge(e.status)}`}>{e.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-semibold text-slate-800">
                          <tr>
                            <td className="px-3 py-2">Total</td>
                            <td className={`px-3 py-2 ${tone(activeExam.percentage)}`}>{activeExam.obtained}/{activeExam.max}</td>
                            <td className={`px-3 py-2 ${tone(activeExam.percentage)}`}>{fmtPct(activeExam.percentage)}</td>
                            <td colSpan={2} className="px-3 py-2"><span className={`rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadge(activeExam.result)}`}>{activeExam.result}</span></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {/* Recent submissions */}
              {submissions.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><FileText size={15} className="text-blue-600" /> Recent Submissions</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-100">
                    <table className="w-full text-left text-[12.5px]">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>{['Assignment', 'Subject', 'Submitted', 'Score', 'Status'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {submissions.map((sub, i) => (
                          <tr key={i} className="text-slate-800">
                            <td className="max-w-[180px] truncate px-3 py-2 font-medium">{sub.title}</td>
                            <td className="px-3 py-2 text-slate-600">{sub.subject || '—'}</td>
                            <td className="px-3 py-2 text-slate-500">{fmtDate(sub.submittedAt)}</td>
                            <td className={`px-3 py-2 font-semibold ${tone(sub.percentage)}`}>{sub.score == null ? 'Not graded' : `${sub.score}/${sub.maxMarks}`}</td>
                            <td className="px-3 py-2"><span className={`rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadge(sub.status)}`}>{sub.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </Motion.div>
    </div>
  );
};

// Student profile photo (string URL or Cloudinary object), falling back to an initial.
const photoUrlOf = (student) => {
  const p = student?.profilePic;
  if (!p) return '';
  if (typeof p === 'string') return p;
  return p.secure_url || p.url || '';
};

const StudentPhoto = ({ student, className = 'size-9 text-sm' }) => {
  const [failed, setFailed] = useState(false);
  const src = photoUrlOf(student);
  if (src && !failed) {
    return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={`shrink-0 rounded-full object-cover ${className}`} />;
  }
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-600 ${className}`}>
      {String(student?.name || 'S').charAt(0).toUpperCase()}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// WEAK STUDENT DETAIL MODAL
// ═════════════════════════════════════════════════════════════════════════════
// Student detail for the Intervention table. Pulls everything for the student
// (academic-year attendance, exams, submissions, per-subject scores and this
// teacher's intervention history) and renders in a portal so it always sits
// above the page, on a soft dark backdrop.
const WeakStudentDetailModal = ({ student, onClose, generateLearningPath }) => {
  const studentId = student?.studentId;
  const [detail, setDetail] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) { setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      cachedFetch(`${API_BASE}/api/progress/student/${studentId}/overview`, { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
      cachedFetch(`${API_BASE}/api/teacher-analytics/interventions?studentId=${studentId}`, { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([overview, interventions]) => {
      if (cancelled) return;
      setDetail(overview);
      setLogs(interventions?.data || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [studentId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose]);

  const level = student.level || student.riskLevel || 'medium';
  const name = detail?.student?.name || student.name || 'Unknown';
  const photo = detail?.student?.profilePic || student.profilePic || null;
  const att = detail?.attendance;
  const subjects = detail?.subjects || [];
  const weakSubjects = subjects.filter((s) => s.score != null && s.score < 60);
  const exams = (detail?.exams || []).slice(0, 5);
  const totals = detail?.totals || {};
  const trend = student.scoreTrend;
  const pctTone = (v) => (v == null ? 'text-slate-400' : v >= 75 ? 'text-emerald-600' : v >= 50 ? 'text-amber-600' : 'text-red-600');
  const LEVEL_TONE = {
    critical: 'bg-red-50 text-red-600 ring-red-100',
    high: 'bg-orange-50 text-orange-600 ring-orange-100',
    medium: 'bg-amber-50 text-amber-600 ring-amber-100',
    low: 'bg-blue-50 text-blue-600 ring-blue-100',
  };
  const STATUS_TONE = {
    completed: 'bg-emerald-50 text-emerald-700',
    in_progress: 'bg-amber-50 text-amber-700',
    planned: 'bg-blue-50 text-blue-700',
  };

  const stats = [
    { label: 'Attendance', value: att?.schoolDays ? `${att.percentage}%` : '—', sub: att?.schoolDays ? `${att.presentDays}/${att.schoolDays} days` : 'Not taken yet', cls: pctTone(att?.schoolDays ? att.percentage : null), icon: Calendar, bg: 'bg-sky-50 text-sky-600' },
    { label: 'Overall Score', value: detail?.overallScore != null ? `${detail.overallScore}%` : '—', sub: 'Exams + graded work', cls: pctTone(detail?.overallScore ?? null), icon: BarChart3, bg: 'bg-blue-50 text-blue-600' },
    { label: 'Exam Avg (recent)', value: student.avgScore != null ? `${student.avgScore}%` : '—', sub: trend ? `Trend ${trend > 0 ? '+' : ''}${trend}` : 'No trend yet', cls: pctTone(student.avgScore ?? null), icon: Target, bg: 'bg-rose-50 text-rose-600' },
    { label: 'Submissions', value: totals.submissions ?? '—', sub: `${totals.graded ?? 0} graded · ${totals.late ?? 0} late`, cls: 'text-slate-900', icon: FileText, bg: 'bg-orange-50 text-orange-600' },
  ];

  return createPortal(
    <AnimatePresence>
      <Motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      >
        <Motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`${name} details`}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <StudentPhoto student={{ name, profilePic: photo }} className="size-14 text-lg" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">{name}</h2>
                <p className="text-[12.5px] text-slate-500">
                  Grade {detail?.student?.grade || student.grade || '—'}{(detail?.student?.section || student.section) ? ` · ${detail?.student?.section || student.section}` : ''} • Roll {detail?.student?.roll || student.roll || '—'}
                </p>
                <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ${LEVEL_TONE[level] || LEVEL_TONE.medium}`}>
                  <span className="size-1.5 rounded-full bg-current" /> {level} priority{student.risk != null ? ` · risk ${student.risk}/100` : ''}
                </span>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
              <X className="size-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-6 animate-spin text-blue-600" /> Loading student data...
            </div>
          ) : (
            <div className="space-y-5 p-5">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-slate-100 p-3">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className={`flex size-7 items-center justify-center rounded-lg ${s.bg}`}><s.icon className="size-3.5" /></span>
                      <span className="text-[11.5px] text-slate-500">{s.label}</span>
                    </div>
                    <p className={`text-lg font-bold leading-tight ${s.cls}`}>{s.value}</p>
                    <p className="text-[10.5px] text-slate-500">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Attendance breakdown */}
              {att?.schoolDays > 0 && (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="mb-2 text-[12px] font-semibold text-slate-700">Attendance — {att.sessionName || 'Academic year'}</p>
                  <div className="flex h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="bg-emerald-500" style={{ width: `${(att.presentDays / att.schoolDays) * 100}%` }} />
                    <div className="bg-red-400" style={{ width: `${(att.absentDays / att.schoolDays) * 100}%` }} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 text-[11px] text-slate-600">
                    <span><span className="mr-1 inline-block size-2 rounded-full bg-emerald-500" />{att.presentDays} present</span>
                    <span><span className="mr-1 inline-block size-2 rounded-full bg-red-400" />{att.absentDays} absent</span>
                    <span><span className="mr-1 inline-block size-2 rounded-full bg-slate-300" />{Math.max(0, att.schoolDays - att.markedDays)} not marked</span>
                  </div>
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                {/* Subjects */}
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800"><BookOpen className="size-4 text-blue-600" /> Subject Performance</h3>
                  {subjects.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">No marks recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {subjects.map((s) => (
                        <div key={s.subject}>
                          <div className="mb-1 flex justify-between text-[12px]">
                            <span className="text-slate-700">{s.subject}</span>
                            <span className={`font-semibold ${pctTone(s.score)}`}>{s.score != null ? `${s.score}%` : '—'}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${s.score == null ? '' : s.score >= 75 ? 'bg-emerald-500' : s.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${s.score ?? 0}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Weak areas + exams */}
                <section className="space-y-4">
                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800"><AlertTriangle className="size-4 text-red-500" /> Weak Areas</h3>
                    {weakSubjects.length === 0 && !(student.weakAreas || []).length ? (
                      <p className="text-xs text-slate-500">No subject below 60%.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {[...new Set([...weakSubjects.map((s) => s.subject), ...(student.weakAreas || [])])].map((area) => (
                          <span key={area} className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600">{area}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800"><GraduationCapIcon className="size-4 text-violet-600" /> Recent Exams</h3>
                    {exams.length === 0 ? (
                      <p className="text-xs text-slate-500">No exam results yet.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                        {exams.map((e) => (
                          <div key={e.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[12px]">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{e.title}</p>
                              <p className="text-[10.5px] text-slate-500">{e.subject}</p>
                            </div>
                            <span className={`shrink-0 font-semibold ${pctTone(e.percentage)}`}>
                              {e.percentage != null ? `${e.marks}/${e.maxMarks} · ${e.percentage}%` : 'Absent'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Intervention history */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800"><Flag className="size-4 text-rose-500" /> Your Interventions</h3>
                {logs.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">No interventions logged for this student yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {logs.slice(0, 5).map((log) => (
                      <div key={log._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-medium text-slate-800">{log.action}</p>
                          <p className="text-[10.5px] text-slate-500">
                            {new Date(log.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            {log.improvement != null ? ` · improvement ${log.improvement > 0 ? '+' : ''}${log.improvement}` : ''}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_TONE[log.status] || 'bg-slate-100 text-slate-600'}`}>
                          {String(log.status || '').replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* AI path */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-violet-50 p-3">
                <div className="flex items-center gap-2.5">
                  <Brain className="size-5 text-violet-600" />
                  <p className="text-[12.5px] text-violet-900">
                    {student.hasAIPath ? 'A personalised learning path is active.' : 'Generate a personalised learning path from the weak areas.'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!studentId}
                  onClick={() => generateLearningPath(
                    studentId,
                    weakSubjects[0]?.subject || student.focusSubject || 'General',
                    weakSubjects.map((s) => s.subject),
                    'basic',
                  )}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                >
                  <Sparkle className="size-3.5" /> {student.hasAIPath ? 'Regenerate AI Path' : 'Generate AI Path'}
                </button>
              </div>
            </div>
          )}
        </Motion.div>
      </Motion.div>
    </AnimatePresence>,
    document.body,
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MISCONCEPTIONS TAB
// ═════════════════════════════════════════════════════════════════════════════
const MisconceptionsTab = ({ data, loading, filters, setFilters, onFetch, aiReport, generatingReport, onGenerateReport }) => {
  const selectClass = 'rounded-full border border-[#e2e8ee] bg-white px-3 py-1.5 text-xs text-[#3a5a6e] outline-none transition focus:border-[#b0c8d8] focus:ring-2 focus:ring-[#3a7a94]/10';
  return (
    <div className="space-y-6 rounded-[2rem] border border-[#eaedf0] bg-white p-5 shadow-[0_4px_20px_rgba(0,20,30,0.06)] sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.01em] text-[#1a2e3f]">
            <span className="flex size-8 items-center justify-center rounded-full bg-rose-100 text-rose-600"><Brain className="size-4" /></span>
            Misconceptions
          </h2>
          <p className="mt-1 text-xs text-[#5a7a8e]">Questions where the most students gave wrong answers — signals class-wide confusion.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#e2e8ee] bg-[#f8fafc] p-1">
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#1a2e3f] shadow-sm">{data.length} pattern{data.length !== 1 ? 's' : ''} found</span>
        </div>
      </header>

      {/* Filter bar — subject only; class+section come from the URL */}
      <div className="flex flex-wrap items-center gap-2 rounded-full border border-[#eaedf0] bg-[#f8fafc] px-3 py-2">
        <input className={`${selectClass} flex-1 min-w-[140px]`} placeholder="Filter by subject (optional)" value={filters.subject} onChange={(e) => setFilters((f) => ({ ...f, subject: e.target.value }))} />
        <button onClick={onFetch} disabled={loading} className="inline-flex items-center gap-1.5 rounded-full bg-[#3a7a94] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-[#2d6278]">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />} Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 text-sm text-[#5a7a8e]">
          <Loader2 className="size-7 animate-spin text-[#3a7a94]" /> Analysing patterns…
        </div>
      ) : data.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.4rem] bg-[#f8fafc] text-center">
          <Brain className="mb-2 size-10 text-slate-300" />
          <h3 className="text-base font-semibold text-[#1a2e3f]">No patterns yet</h3>
          <p className="mt-1 text-sm text-[#5a7a8e]">Students need to attempt practice questions for misconceptions to appear.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.slice(0, 15).map((m, i) => (
              <Motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-[1.2rem] border border-rose-100 bg-rose-50 p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1">{m.topic}</p>
                    <p className="text-sm text-slate-800 leading-snug line-clamp-3">{m.question}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-rose-200 px-2.5 py-1 text-xs font-bold text-rose-800 whitespace-nowrap">{m.pct}% wrong</span>
                </div>
                <div className="h-1.5 rounded-full bg-rose-100 overflow-hidden mb-2">
                  <div className="h-full bg-rose-400 rounded-full" style={{ width: `${m.pct}%` }} />
                </div>
                {m.topWrongAnswers?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {m.topWrongAnswers.map((wa, j) => (
                      <span key={j} className="rounded-full bg-white border border-rose-200 px-2 py-0.5 text-[10px] text-slate-600">
                        "{wa.answer}" ×{wa.count}
                      </span>
                    ))}
                  </div>
                )}
              </Motion.div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[#eaedf0] pt-4">
            <button onClick={onGenerateReport} disabled={generatingReport} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90">
              {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {generatingReport ? 'Analysing…' : 'Generate AI Misconception Report'}
            </button>
          </div>

          {aiReport && (
            <div className="rounded-[1.2rem] border border-purple-100 bg-purple-50 p-5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {aiReport}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// CLASS GAPS TAB
// ═════════════════════════════════════════════════════════════════════════════
const GAP_LEVELS = {
  critical: { label: 'Critical', range: '< 40% mastery', dot: 'bg-red-500', pill: 'bg-red-50 text-red-600', bar: 'bg-red-500', text: 'text-red-600', color: '#ef4444' },
  high: { label: 'High', range: '40% – 60% mastery', dot: 'bg-orange-500', pill: 'bg-orange-50 text-orange-600', bar: 'bg-orange-500', text: 'text-orange-600', color: '#f97316' },
  medium: { label: 'Medium', range: '60% – 75% mastery', dot: 'bg-amber-400', pill: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400', text: 'text-amber-600', color: '#fbbf24' },
};

const ClassGapsTab = ({ data, loading, onFetch, healthyTopics = 0, classLabel }) => {
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('');
  const [detail, setDetail] = useState(null);

  const subjects = useMemo(() => [...new Set(data.map((g) => g.subject).filter(Boolean))].sort(), [data]);
  const rows = data.filter((g) => (!subject || g.subject === subject)
    && (!level || g.gapSeverity === level)
    && (!search.trim() || `${g.topicTitle} ${g.subject} ${g.chapterTitle || ''}`.toLowerCase().includes(search.trim().toLowerCase())));
  const count = (key) => data.filter((g) => g.gapSeverity === key).length;
  const totalTopics = data.length + healthyTopics;

  const statCards = [
    { label: 'Gaps Detected', helper: 'Topics below 75% mastery', value: data.length, icon: AlertCircle, tile: 'bg-red-50 text-red-500' },
    { label: 'Critical', helper: GAP_LEVELS.critical.range, value: count('critical'), icon: BarChart2, tile: 'bg-red-50 text-red-500' },
    { label: 'High', helper: GAP_LEVELS.high.range, value: count('high'), icon: AlertTriangle, tile: 'bg-amber-50 text-amber-500' },
    { label: 'Medium', helper: GAP_LEVELS.medium.range, value: count('medium'), icon: BarChart2, tile: 'bg-blue-50 text-blue-600' },
  ];

  // Donut segments: critical / high / medium / good (≥75%).
  const segments = [
    { key: 'critical', label: 'Critical (< 40%)', value: count('critical'), color: GAP_LEVELS.critical.color },
    { key: 'high', label: 'High (40% – 60%)', value: count('high'), color: GAP_LEVELS.high.color },
    { key: 'medium', label: 'Medium (60% – 75%)', value: count('medium'), color: GAP_LEVELS.medium.color },
    { key: 'good', label: 'Good (≥ 75%)', value: healthyTopics, color: '#22c55e' },
  ];
  const R = 15.9155; // circumference 100
  let offset = 25;

  const selectCls = 'h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[12.5px] text-slate-800 outline-none focus:border-blue-300';

  return (
    <div className="space-y-3">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex flex-col justify-center gap-1 items-center">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 text-center">Class Gaps</h2>
          <p className="text-[12.5px] text-slate-500">Topics where the class average mastery falls below 75% — sorted by severity.</p>
        </div>
        {/* {classLabel && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 shadow-sm">
            <Calendar className="size-3.5 text-slate-500" /> {classLabel}
          </span>
        )} */}
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <Motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${s.tile}`}><s.icon className="size-[18px]" /></span>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight text-slate-900">{loading ? '—' : s.value}</p>
              <p className="text-[12px] font-medium text-slate-700">{s.label}</p>
              <p className="truncate text-[10.5px] text-slate-500">{s.helper}</p>
            </div>
          </Motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm">
        <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 focus-within:border-blue-300">
          <Search className="size-3.5 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topics..." className="w-full bg-transparent text-[13px] outline-none placeholder:text-slate-400" />
        </div>
        <label className="relative flex items-center">
          <BookOpen className="pointer-events-none absolute left-2.5 size-3.5 text-slate-500" />
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className={selectCls} aria-label="Subject">
            <option value="">All Subjects</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
        </label>
        <label className="relative flex items-center">
          <BarChart2 className="pointer-events-none absolute left-2.5 size-3.5 text-slate-500" />
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectCls} aria-label="Level">
            <option value="">All Levels</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
        </label>
        <button type="button" onClick={onFetch} disabled={loading} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50/60 px-3 text-[12.5px] font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-50">
          <RefreshCcw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Table */}
      <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="px-4 pt-3">
          <h3 className="text-[14px] font-bold text-slate-900">Topics with Learning Gaps</h3>
          <p className="text-[11.5px] text-slate-500">Sorted by lowest class average mastery.</p>
        </div>
        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center gap-2 text-[13px] text-slate-500"><Loader2 className="size-5 animate-spin text-blue-600" /> Loading gap data…</div>
        ) : rows.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
            <CheckCircle className="mb-1.5 size-8 text-emerald-500" />
            <p className="text-[13px] font-semibold text-slate-800">{data.length ? 'No topics match these filters' : 'No significant gaps'}</p>
            {!data.length && <p className="text-[11.5px] text-slate-500">Students must attempt practice questions for gap data to appear.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="bg-slate-50 text-[11.5px] text-slate-500">
                  <th className="w-10 rounded-l-lg px-3 py-2 text-center font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">Topic</th>
                  <th className="px-3 py-2 font-medium">Class Avg Mastery</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Students</th>
                  <th className="rounded-r-lg px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g, i) => {
                  const lv = GAP_LEVELS[g.gapSeverity] || GAP_LEVELS.medium;
                  return (
                    <tr key={`${g.subject}-${g.topicTitle}-${i}`} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-center text-[12px] text-slate-500">{i + 1}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-[12px] font-medium text-blue-700"><BookOpen className="size-3.5" /> {g.subject || '—'}</span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-[12.5px] font-semibold text-slate-900">{g.topicTitle}</p>
                        {g.chapterTitle && <p className="text-[10.5px] text-slate-500">{g.chapterTitle}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${lv.bar}`} style={{ width: `${Math.max(g.avgMastery, 4)}%` }} />
                          </div>
                          <span className={`text-[12.5px] font-semibold ${lv.text}`}>{g.avgMastery}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${lv.pill}`}><span className={`size-1.5 rounded-full ${lv.dot}`} /> {lv.label}</span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-[12px] font-medium text-slate-800">{g.studentCount} student{g.studentCount === 1 ? '' : 's'} tracked</p>
                        <p className={`text-[11px] ${g.studentsBelow50 ? 'text-red-500' : 'text-slate-500'}`}>{g.studentsBelow50} below 50%</p>
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => setDetail(g)} className="inline-flex items-center gap-1 rounded-lg border border-blue-100 px-2.5 py-1.5 text-[11.5px] font-semibold text-blue-600 transition hover:bg-blue-50">
                          View Details <ArrowRight className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Mastery donut */}
        <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <h3 className="text-[14px] font-bold text-slate-900">Class Mastery Overview</h3>
          <p className="text-[11.5px] text-slate-500">Distribution of topics by mastery level.</p>
          <div className="mt-3 flex flex-wrap items-center gap-6">
            <div className="relative size-32 shrink-0">
              <svg viewBox="0 0 42 42" className="size-full">
                <circle cx="21" cy="21" r={R} fill="none" stroke="#f1f5f9" strokeWidth="5" />
                {totalTopics > 0 && segments.filter((s) => s.value > 0).map((s) => {
                  const pct = (s.value / totalTopics) * 100;
                  const el = (
                    <circle key={s.key} cx="21" cy="21" r={R} fill="none" stroke={s.color} strokeWidth="5"
                      strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} />
                  );
                  offset -= pct;
                  return el;
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xl font-bold leading-none text-slate-900">{totalTopics}</p>
                <p className="mt-0.5 text-[10.5px] text-slate-500">Total Topics</p>
              </div>
            </div>
            <ul className="min-w-[180px] flex-1 space-y-2">
              {segments.map((s) => (
                <li key={s.key} className="flex items-center justify-between text-[12px] text-slate-700">
                  <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: s.color }} /> {s.label}</span>
                  <span className="font-semibold text-slate-900">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Next steps */}
        <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <h3 className="flex items-center gap-1.5 text-[14px] font-bold text-slate-900"><Lightbulb className="size-4 text-amber-400" /> What to do next?</h3>
          <ol className="mt-3 space-y-3">
            {[
              ['Review the weak topic(s)', 'Check the detailed analysis and identify student-wise gaps.'],
              ['Take action', 'Assign practice, create a worksheet, or use the AI learning path.'],
              ['Track improvement', 'Revisit this page after some time to see progress.'],
            ].map(([title, text], i, arr) => (
              <li key={title} className="relative flex gap-3">
                {i < arr.length - 1 && <span aria-hidden="true" className="absolute left-[13px] top-7 h-[calc(100%-12px)] border-l border-dashed border-blue-200" />}
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[12px] font-bold text-blue-600">{i + 1}</span>
                <div>
                  <p className="text-[12.5px] font-semibold text-slate-900">{title}</p>
                  <p className="text-[11.5px] text-slate-500">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Topic detail */}
      <ModalShell open={Boolean(detail)} onClose={() => setDetail(null)} label="Gap details" width="max-w-md">
        {detail && (() => {
          const lv = GAP_LEVELS[detail.gapSeverity] || GAP_LEVELS.medium;
          return (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-[11px] text-slate-500">{detail.subject}{detail.chapterTitle ? ` · ${detail.chapterTitle}` : ''}</p>
                  <h3 className="text-[15px] font-bold text-slate-900">{detail.topicTitle}</h3>
                  <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${lv.pill}`}><span className={`size-1.5 rounded-full ${lv.dot}`} /> {lv.label} gap</span>
                </div>
                <button type="button" onClick={() => setDetail(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="size-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2.5 p-5">
                {[
                  ['Class avg mastery', `${detail.avgMastery}%`],
                  ['Students tracked', detail.studentCount],
                  ['Below 50%', detail.studentsBelow50],
                  ['Class coverage', detail.coverage != null ? `${detail.coverage}%` : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <p className="text-[11px] text-slate-500">{k}</p>
                    <p className="text-[15px] font-bold text-slate-900">{v}</p>
                  </div>
                ))}
                <p className="col-span-2 text-[11.5px] text-slate-500">
                  Coverage is the share of the class that has attempted practice on this topic. Low coverage means the average is based on only a few students.
                </p>
              </div>
            </>
          );
        })()}
      </ModalShell>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// 7-DAY FORECAST TAB
// ═════════════════════════════════════════════════════════════════════════════
const FORECAST_STATUS = {
  critical: { label: 'Critical', pill: 'bg-red-50 text-red-600', dot: 'bg-red-500', rank: 0 },
  high: { label: 'High', pill: 'bg-red-50 text-red-500', dot: 'bg-red-500', rank: 1 },
  medium: { label: 'Medium', pill: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500', rank: 2 },
  low: { label: 'On Track', pill: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500', rank: 3 },
  insufficient_data: { label: 'Insufficient Data', pill: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', rank: 4 },
};
const FORECAST_AVATAR = ['bg-rose-50 text-rose-500', 'bg-blue-50 text-blue-600', 'bg-emerald-50 text-emerald-600', 'bg-violet-50 text-violet-600', 'bg-amber-50 text-amber-600'];

const ForecastTab = ({ data, loading, onFetch, validation }) => {
  const PAGE_SIZE = 10;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [who, setWho] = useState('');
  const [sortBy, setSortBy] = useState('status');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const count = (lv) => data.filter((s) => s.forecastLevel === lv).length;
  const statCards = [
    { label: 'Critical', helper: 'Needs immediate attention', value: count('critical'), icon: AlertTriangle, card: 'border-red-100 bg-red-50/40', tile: 'bg-red-100 text-red-500' },
    { label: 'High', helper: 'Deteriorating performance', value: count('high'), icon: BarChart2, card: 'border-amber-100 bg-amber-50/40', tile: 'bg-amber-100 text-amber-500' },
    { label: 'Medium', helper: 'Needs monitoring', value: count('medium'), icon: Users, card: 'border-blue-100 bg-blue-50/40', tile: 'bg-blue-100 text-blue-600' },
  ];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data.filter((s) => (!status || s.forecastLevel === status)
      && (!who || (who === 'flagged' ? (s.signals || []).length > 0 : (s.signals || []).length === 0))
      && (!q || String(s.name || '').toLowerCase().includes(q) || String(s.roll || '').includes(q)));
    const num = (v) => (v == null ? 101 : Number(v));
    const sorters = {
      status: (a, b) => (FORECAST_STATUS[a.forecastLevel]?.rank ?? 9) - (FORECAST_STATUS[b.forecastLevel]?.rank ?? 9) || num(a.attendanceYear?.percentage) - num(b.attendanceYear?.percentage),
      attendance: (a, b) => num(a.attendanceYear?.percentage) - num(b.attendanceYear?.percentage),
      trend: (a, b) => num(a.trend7d) - num(b.trend7d),
      name: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
    };
    return [...list].sort(sorters[sortBy]);
  }, [data, search, status, who, sortBy]);

  useEffect(() => { setPage(1); }, [search, status, who, sortBy]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const selectCls = 'h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[12.5px] text-slate-800 outline-none focus:border-blue-300';
  const attBar = (v) => (v == null ? 'bg-slate-200' : v < 60 ? 'bg-red-500' : v < 75 ? 'bg-amber-500' : 'bg-emerald-500');
  const signalText = (sig) => (sig.type === 'attendance'
    ? `Attendance ${sig.value}% in the last 7 days`
    : sig.type === 'projected_score' ? `Projected score ${sig.value}% next week` : `Recent average score ${sig.value}%`);

  return (
    <div className="space-y-3">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-center gap-3">
        <div className="flex items-center gap-3">
          {/* <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Activity className="size-5" /></span> */}
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 text-center">7-Day Forecast</h2>
            <p className="text-[12.5px] text-slate-500">Students whose attendance or scores have deteriorated in the last 7 days.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onFetch} disabled={loading} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/60 px-3 text-[12.5px] font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-50">
            <RefreshCcw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] text-slate-700">
            <Calendar className="size-3.5 text-slate-500" /> Last 7 Days
          </span>
        </div>
      </header>

      {/* Stat cards */}
      <div className="grid gap-2.5 sm:grid-cols-3">
        {statCards.map((s, i) => (
          <Motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-3 rounded-xl border p-3 ${s.card}`}>
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${s.tile}`}><s.icon className="size-5" /></span>
            <div>
              <p className="text-lg font-bold leading-tight text-slate-900">{loading ? '—' : s.value}</p>
              <p className="text-[12.5px] font-medium text-slate-800">{s.label}</p>
              <p className="text-[10.5px] text-slate-500">{s.helper}</p>
            </div>
          </Motion.div>
        ))}
      </div>

      {/* Forecast accuracy (backtest) — compact strip */}
      {validation && validation.dataStatus === 'available' && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600">
          <span className="font-semibold text-slate-700">Forecast accuracy ({validation.sampleSize} students):</span>
          <span>Pass/fail {validation.failurePrediction.accuracy != null ? `${Math.round(validation.failurePrediction.accuracy * 100)}%` : '—'}</span>
          <span>Precision {validation.failurePrediction.precision != null ? `${Math.round(validation.failurePrediction.precision * 100)}%` : '—'}</span>
          <span>Recall {validation.failurePrediction.recall != null ? `${Math.round(validation.failurePrediction.recall * 100)}%` : '—'}</span>
          <span>Avg error {validation.regression.mae != null ? `±${validation.regression.mae}` : '—'}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="space-y-2 border-b border-slate-100 p-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 focus-within:border-blue-300">
              <Search className="size-3.5 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students..." className="w-full bg-transparent text-[13px] outline-none placeholder:text-slate-400" />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-label={filtersOpen ? 'Close filters' : 'Open filters'}
              aria-expanded={filtersOpen}
              className={`relative flex size-8 shrink-0 items-center justify-center rounded-lg border transition ${filtersOpen ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {filtersOpen ? <X className="size-4" /> : <Filter className="size-4" />}
              {!filtersOpen && (status || who) && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">{[status, who].filter(Boolean).length}</span>
              )}
            </button>
          </div>
          <AnimatePresence initial={false}>
            {filtersOpen && (
              <Motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-wrap items-center gap-2 overflow-hidden"
              >
                <label className="relative flex items-center">
                  <FileText className="pointer-events-none absolute left-2.5 size-3.5 text-slate-500" />
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls} aria-label="Status">
                    <option value="">All Status</option><option value="critical">Critical</option><option value="high">High</option><option value="low">On Track</option><option value="insufficient_data">Insufficient Data</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
                </label>
                <label className="relative flex items-center">
                  <Users className="pointer-events-none absolute left-2.5 size-3.5 text-slate-500" />
                  <select value={who} onChange={(e) => setWho(e.target.value)} className={selectCls} aria-label="Students">
                    <option value="">All Students</option><option value="flagged">Flagged only</option><option value="clear">Not flagged</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
                </label>
                <label className="relative flex items-center">
                  <BarChart2 className="pointer-events-none absolute left-2.5 size-3.5 text-slate-500" />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectCls} aria-label="Sort by">
                    <option value="status">Sort: Status</option><option value="attendance">Sort: Attendance</option><option value="trend">Sort: Trend</option><option value="name">Sort: Name</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
                </label>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>

        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center gap-2 text-[13px] text-slate-500"><Loader2 className="size-5 animate-spin text-blue-600" /> Scanning last 7 days…</div>
        ) : rows.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
            <CheckCircle className="mb-1.5 size-8 text-emerald-500" />
            <p className="text-[13px] font-semibold text-slate-800">{data.length ? 'No students match these filters' : 'All clear!'}</p>
            {!data.length && <p className="text-[11.5px] text-slate-500">No students show a deteriorating trend in the last 7 days.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="bg-slate-50/70 text-[11.5px] text-slate-500">
                  <th className="w-12 px-3 py-2 text-center font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium" title="Present days ÷ school days of the academic year">Attendance (Academic Year)</th>
                  <th className="px-3 py-2 font-medium">Trend</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s, i) => {
                  const n = (current - 1) * PAGE_SIZE + i + 1;
                  const st = FORECAST_STATUS[s.forecastLevel] || FORECAST_STATUS.insufficient_data;
                  return (
                    <tr key={String(s.studentId || n)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-3 py-1.5 text-center text-xs text-slate-500">{n}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2.5">
                          {photoUrlOf(s) ? (
                            <StudentPhoto student={{ name: s.name, profilePic: s.profilePic }} className="size-8 text-xs" />
                          ) : (
                            <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${FORECAST_AVATAR[n % FORECAST_AVATAR.length]}`}>{String(s.name || 'S').charAt(0).toUpperCase()}</span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-slate-900">{s.name}</p>
                            <p className="text-[11px] text-slate-500">{s.grade ? `Grade ${s.grade}` : ''}{s.section ? ` · ${s.section}` : ''}{s.roll ? ` · Roll ${s.roll}` : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${st.pill}`}><span className={`size-1.5 rounded-full ${st.dot}`} /> {st.label}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        {(() => {
                          const y = s.attendanceYear;
                          const v = y?.schoolDays ? y.percentage : null;
                          return (
                            <div className="flex items-center gap-2.5" title={y?.schoolDays ? `${y.sessionName || 'Academic year'}: ${y.presentDays} present, ${y.absentDays} absent, ${y.notMarkedDays} not marked of ${y.schoolDays} school days` : undefined}>
                              <div className="w-16 leading-tight">
                                <span className="text-[12.5px] font-semibold text-slate-900">{v != null ? `${v}%` : '—'}</span>
                                {y?.schoolDays > 0 && <p className="text-[10.5px] text-slate-500">{y.presentDays}/{y.schoolDays} days</p>}
                              </div>
                              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                                <div className={`h-full rounded-full ${attBar(v)}`} style={{ width: `${v ?? 0}%` }} />
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-1.5">
                        {s.trend7d == null || s.trend7d === 0 ? <span className="text-xs text-slate-400">—</span> : (
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${s.trend7d < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {s.trend7d < 0 ? <TrendingDown className="size-3.5" /> : <TrendingUp className="size-3.5" />}{s.trend7d > 0 ? '+' : ''}{s.trend7d}%
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setDetail(s)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-[11.5px] font-medium text-blue-700 transition hover:bg-blue-100">
                            <Eye className="size-3.5" /> View Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2.5">
            <p className="text-[11.5px] text-slate-500">Showing {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, rows.length)} of {rows.length} students</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Previous page" className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="size-4" /></button>
              <span className="text-[12px] text-slate-600">{current} / {pageCount}</span>
              <button type="button" onClick={() => setPage(current + 1)} disabled={current === pageCount} aria-label="Next page" className="flex size-8 items-center justify-center rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:border-slate-200 disabled:text-slate-400 disabled:opacity-40"><ChevronRight className="size-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Student forecast detail */}
      <ModalShell open={Boolean(detail)} onClose={() => setDetail(null)} label="Forecast details" width="max-w-md">
        {detail && (() => {
          const st = FORECAST_STATUS[detail.forecastLevel] || FORECAST_STATUS.insufficient_data;
          return (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <StudentPhoto student={{ name: detail.name, profilePic: detail.profilePic }} className="size-11 text-sm" />
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900">{detail.name}</h3>
                    <p className="text-[11.5px] text-slate-500">{detail.grade ? `Grade ${detail.grade}` : ''}{detail.section ? ` · ${detail.section}` : ''}{detail.roll ? ` · Roll ${detail.roll}` : ''}</p>
                    <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${st.pill}`}><span className={`size-1.5 rounded-full ${st.dot}`} /> {st.label}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setDetail(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="size-4" /></button>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      k: 'Academic-year attendance',
                      v: detail.attendanceYear?.schoolDays ? `${detail.attendanceYear.percentage}%` : '—',
                      sub: detail.attendanceYear?.schoolDays ? `${detail.attendanceYear.presentDays}/${detail.attendanceYear.schoolDays} school days` : 'No school days yet',
                    },
                    {
                      k: 'Last 7 days attendance',
                      v: detail.attPct7d != null ? `${detail.attPct7d}%` : '—',
                      sub: detail.attPct7d != null ? 'Days marked this week' : 'Not marked this week',
                    },
                    {
                      k: 'Recent avg score',
                      v: detail.avgScore7d != null ? `${Math.round(detail.avgScore7d)}%` : '—',
                      sub: detail.avgScoreSource === 'exams'
                        ? `From last ${Math.min(detail.examCount || 0, 6)} exam${(detail.examCount || 0) === 1 ? '' : 's'}`
                        : detail.avgScoreSource === 'practice' ? 'From recent practice' : 'No marks yet',
                    },
                    {
                      k: 'Next-week forecast',
                      v: detail.estimate?.predictedScore != null ? `${detail.estimate.predictedScore}%` : 'Not enough data',
                      sub: detail.estimate?.predictedScore != null
                        ? 'Projected from practice results'
                        : `Needs practice results on 4+ days (has ${detail.practiceDays || 0})`,
                    },
                  ].map(({ k, v, sub }) => (
                    <div key={k} className="rounded-lg bg-slate-50 px-2.5 py-2 text-center">
                      <p className="text-[10.5px] text-slate-500">{k}</p>
                      <p className={`font-bold text-slate-900 ${v === 'Not enough data' ? 'text-[12px] leading-6 text-slate-500' : 'text-[14px]'}`}>{v}</p>
                      <p className="text-[10px] text-slate-400">{sub}</p>
                    </div>
                  ))}
                </div>
                {detail.trend7d != null && (
                  <p className="text-[11.5px] text-slate-600">
                    Trend <span className={`font-semibold ${detail.trend7d < 0 ? 'text-red-600' : detail.trend7d > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>{detail.trend7d > 0 ? '+' : ''}{detail.trend7d}%</span>
                    {detail.trendSource === 'exams' ? ' — newer exams compared with older exams.' : ' — weekly change in practice scores.'}
                  </p>
                )}
                <div>
                  <p className="mb-1.5 text-[12px] font-semibold text-slate-700">Why this status</p>
                  {(detail.signals || []).length ? (
                    <ul className="space-y-1.5">
                      {detail.signals.map((sig, k) => (
                        <li key={k} className="flex items-center gap-2 text-[12px] text-slate-700">
                          <span className={`size-1.5 rounded-full ${sig.severity === 'critical' ? 'bg-red-600' : 'bg-orange-500'}`} /> {signalText(sig)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-slate-500">
                      {detail.forecastLevel === 'insufficient_data'
                        ? 'Not enough practice/assessment results in the last 30 days to forecast (needs results on at least 4 days spread over a week).'
                        : 'No warning signs in attendance or scores this week.'}
                    </p>
                  )}
                </div>
              </div>
            </>
          );
        })()}
      </ModalShell>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MASTERY GROWTH TAB
// ═════════════════════════════════════════════════════════════════════════════
const TIERS = [
  { key: 'low',  label: 'Below 60',  range: '< 60%',  bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700',    bar: 'bg-red-400',    dot: 'bg-red-400'  },
  { key: 'mid',  label: '60 – 80',   range: '60–80%', bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400',  dot: 'bg-amber-400'},
  { key: 'high', label: '80 +',      range: '≥ 80%',  bg: 'bg-emerald-50',border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', dot: 'bg-emerald-500'},
];

const MasteryGrowthTab = ({ data, loading, filters, setFilters, onFetch, detailStudent, setDetailStudent }) => {
  const tierMap = { low: [], mid: [], high: [] };
  data.forEach((s) => { if (tierMap[s.tier]) tierMap[s.tier].push(s); });

  const TIER_UI = {
    low: { title: 'Below 60', range: '< 60%', sub: 'Average mastery < 60%', empty: 'Students with average mastery below 60% will appear here.', card: 'border-red-100 bg-red-50/40', head: 'bg-red-50/60', tile: 'bg-red-100 text-red-500', chip: 'border-red-200 bg-red-500 text-white', score: 'bg-red-600 text-white', avatar: 'bg-rose-500 text-rose-500' },
    mid: { title: '60 – 80', range: '60–80%', sub: 'Average mastery 60 – 80%', empty: 'Students with average mastery between 60 – 80% will appear here.', card: 'border-amber-100 bg-amber-50/40', head: 'bg-amber-50/60', tile: 'bg-amber-100 text-amber-500', chip: 'border-amber-200 bg-amber-500 text-white', score: 'bg-amber-600 text-white', avatar: 'bg-amber-500 text-amber-500' },
    high: { title: '80 +', range: '≥ 80%', sub: 'Average mastery ≥ 80%', empty: 'Students with average mastery 80% or above will appear here.', card: 'border-emerald-100 bg-emerald-50/40', head: 'bg-emerald-50/60', tile: 'bg-emerald-100 text-emerald-600', chip: 'border-emerald-200 bg-emerald-500 text-white', score: 'bg-emerald-600 text-white', avatar: 'bg-emerald-500 text-emerald-500' },
  };
  const tierKeys = ['low', 'mid', 'high'];
  // Each column pages independently, 3 students at a time.
  const TIER_PAGE_SIZE = 3;
  const [tierPage, setTierPage] = useState({ low: 1, mid: 1, high: 1 });

  return (
    <div className="space-y-3">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><BarChart2 className="size-5" /></span> */}
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 text-center">Mastery Growth</h2>
            <p className="text-[12.5px] text-slate-500">Students grouped by average mastery score — click View Details to see strong and weak topics.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-44 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 focus-within:border-blue-300">
            <Search className="size-3.5 text-slate-400" />
            <input
              className="w-full bg-transparent text-[12.5px] text-slate-800 outline-none placeholder:text-slate-400"
              placeholder="Filter by subject…"
              value={filters.subject}
              onChange={(e) => setFilters((f) => ({ ...f, subject: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') onFetch(); }}
            />
          </div>
          <button type="button" onClick={onFetch} disabled={loading} className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-blue-500 text-white px-3 text-[12.5px] font-semibold text-blue-600 transition hover:bg-blue-600 disabled:opacity-50">
            <RefreshCcw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Tier summary cards */}
      {/* <div className="grid gap-2.5 sm:grid-cols-3">
        {tierKeys.map((key, i) => {
          const t = TIER_UI[key];
          return (
            <Motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 rounded-xl border p-3 ${t.card}`}>
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${t.tile}`}><BarChart2 className="size-5" /></span>
              <div>
                <p className="text-lg font-bold leading-tight text-slate-900">{loading ? '—' : tierMap[key].length}</p>
                <p className="text-[12.5px] font-medium text-slate-800">{t.title}</p>
                <p className="text-[10.5px] text-slate-500">{t.range}</p>
              </div>
            </Motion.div>
          );
        })}
      </div> */}

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white text-[13px] text-slate-500">
          <Loader2 className="size-5 animate-spin text-blue-600" /> Loading mastery data…
        </div>
      ) : data.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-slate-100 bg-white text-center">
          <Star className="mb-1.5 size-8 text-slate-300" />
          <p className="text-[13px] font-semibold text-slate-800">No mastery data yet</p>
          <p className="text-[11.5px] text-slate-500">Students need to attempt practice questions for mastery scores to appear.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {tierKeys.map((key) => {
            const t = TIER_UI[key];
            const list = tierMap[key];
            const pages = Math.max(1, Math.ceil(list.length / TIER_PAGE_SIZE));
            const pg = Math.min(tierPage[key] || 1, pages);
            const visible = list.slice((pg - 1) * TIER_PAGE_SIZE, pg * TIER_PAGE_SIZE);
            const goTo = (n) => setTierPage((prev) => ({ ...prev, [key]: n }));
            return (
              <section key={key} className="flex min-h-[260px] flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                <div className={`flex items-start justify-between gap-2 px-4 py-3 ${t.head}`}>
                  <div>
                    <h3 className="text-[14px] font-bold text-slate-900">{t.title}</h3>
                    <p className="text-[11.5px] text-slate-500">{t.sub}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${t.chip}`}>{list.length} student{list.length === 1 ? '' : 's'}</span>
                </div>
                {list.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
                    <span className={`mb-2 flex size-11 items-center justify-center rounded-full ${t.score}`}><BarChart2 className="size-5" /></span>
                    <p className="text-[12.5px] font-semibold text-slate-800">No students in this range</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{t.empty}</p>
                  </div>
                ) : (
                  <>
                  <div className="flex-1 divide-y divide-slate-100 px-2">
                    {visible.map((student) => (
                      <Motion.button type="button" key={String(student.studentId)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        onClick={() => setDetailStudent(student)}
                        title="View details"
                        className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2.5 text-left transition hover:bg-slate-50">
                        {photoUrlOf(student) ? (
                          <StudentPhoto student={{ name: student.name, profilePic: student.profilePic }} className="size-8 text-xs" />
                        ) : (
                          <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${t.avatar}`}>{String(student.name || 'S').charAt(0).toUpperCase()}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-semibold text-slate-900">{student.name}</p>
                          <p className="truncate text-[10.5px] text-slate-500">
                            {student.grade ? `Grade ${student.grade}` : ''}{student.section ? ` · ${student.section}` : ''}{student.roll ? ` · Roll ${student.roll}` : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-center">
                          <span className={`inline-block rounded-full p-1 text-[12.5px] font-bold ${t.score}`}>{student.avgMastery}%</span>
                          <p className="text-[10px] text-slate-500">{student.topicCount} topic{student.topicCount !== 1 ? 's' : ''} attempted</p>
                        </div>
                      </Motion.button>
                    ))}
                  </div>
                  {pages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
                      <span className="text-[11px] text-slate-500">{(pg - 1) * TIER_PAGE_SIZE + 1}–{Math.min(pg * TIER_PAGE_SIZE, list.length)} of {list.length}</span>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => goTo(pg - 1)} disabled={pg === 1} aria-label="Previous page" className="flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
                        <span className="text-[11px] text-slate-600">{pg} / {pages}</span>
                        <button type="button" onClick={() => goTo(pg + 1)} disabled={pg === pages} aria-label="Next page" className="flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Student detail modal */}
      <AnimatePresence>
        {detailStudent && (
          <Motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setDetailStudent(null)}
          >
            <Motion.div
              className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
              initial={{ scale: 0.96, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 24 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div className="flex items-center gap-3">
                <StudentPhoto student={{ name: detailStudent.name, profilePic: detailStudent.profilePic }} className="size-10 text-sm" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">{detailStudent.name}</h2>
                  <p className="text-xs text-slate-500">
                    {detailStudent.grade ? `Grade ${detailStudent.grade}` : ''}
                    {detailStudent.section ? ` · ${detailStudent.section}` : ''}
                    {detailStudent.roll ? ` · Roll ${detailStudent.roll}` : ''}
                    {' · '}Avg Mastery:&nbsp;
                    <span className={`font-bold ${detailStudent.avgMastery >= 80 ? 'text-emerald-600' : detailStudent.avgMastery >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {detailStudent.avgMastery}%
                    </span>
                  </p>
                </div>
                </div>
                <button type="button" onClick={() => setDetailStudent(null)} className="rounded-full p-2 hover:bg-slate-100">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="p-6 grid gap-5 sm:grid-cols-2">
                {/* Weak areas */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-red-700 mb-3">
                    <AlertTriangle className="w-4 h-4" /> Weak Areas
                    <span className="ml-auto text-xs font-normal text-slate-400">(score &lt; 60%)</span>
                  </h3>
                  {detailStudent.weakTopics.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No weak topics found.</p>
                  ) : (
                    <div className="space-y-2">
                      {detailStudent.weakTopics.map((t, i) => (
                        <div key={i} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{t.topicTitle}</p>
                              <p className="text-[10px] text-slate-500">{t.subject}</p>
                            </div>
                            <span className="text-sm font-bold text-red-600 shrink-0">{t.score}%</span>
                          </div>
                          <div className="h-1 rounded-full bg-red-100 overflow-hidden mt-1.5">
                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${t.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Strong areas */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-700 mb-3">
                    <Star className="w-4 h-4" /> Strong Areas
                    <span className="ml-auto text-xs font-normal text-slate-400">(score ≥ 75%)</span>
                  </h3>
                  {detailStudent.strongTopics.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No strong topics yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {detailStudent.strongTopics.map((t, i) => (
                        <div key={i} className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{t.topicTitle}</p>
                              <p className="text-[10px] text-slate-500">{t.subject}</p>
                            </div>
                            <span className="text-sm font-bold text-emerald-600 shrink-0">{t.score}%</span>
                          </div>
                          <div className="h-1 rounded-full bg-emerald-100 overflow-hidden mt-1.5">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${t.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ML INSIGHTS TAB
// ═════════════════════════════════════════════════════════════════════════════
const PANEL_CLS = 'rounded-[2rem] border border-[#eaedf0] bg-white p-5 shadow-[0_4px_20px_rgba(0,20,30,0.06)] sm:p-8';

const engagementColor = (label) => {
  if (label === 'very_high') return 'bg-emerald-100 text-emerald-700';
  if (label === 'high') return 'bg-green-100 text-green-700';
  if (label === 'medium') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
};

const trendIcon = (t) => {
  if (t === 'improving') return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
  if (t === 'declining') return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-gray-400" />;
};

const gapBadgeColor = (type) => {
  if (type === 'confused') return 'bg-purple-100 text-purple-700';
  if (type === 'absent') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
};

const severityColor = (s) => {
  if (s === 'critical') return 'text-red-600';
  if (s === 'high') return 'text-orange-600';
  return 'text-amber-600';
};

const MLStudentDetailModal = ({ student, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  // ML scores + the student's academic overview (attendance, exams, subjects).
  useEffect(() => {
    setLoading(true);
    Promise.all([
      cachedFetch(`${API_BASE}/api/ml/student/${student.studentId}`, { headers: authHeaders() })
        .then((r) => r.json()).then((d) => d.data || null).catch(() => null),
      cachedFetch(`${API_BASE}/api/progress/student/${student.studentId}/overview`, { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([ml, ov]) => { setDetail(ml); setOverview(ov); }).finally(() => setLoading(false));
  }, [student.studentId]);

  const weakTopics = detail ? [...(detail.mastery || [])].sort((a, b) => a.weightedScore - b.weightedScore).slice(0, 5) : [];
  const strongTopics = detail ? [...(detail.mastery || [])].sort((a, b) => b.weightedScore - a.weightedScore).slice(0, 5) : [];

  const att = overview?.attendance;
  const subjects = overview?.subjects || [];
  const exams = (overview?.exams || []).slice(0, 4);
  const totals = overview?.totals || {};
  const pctTone = (v) => (v == null ? 'text-slate-400' : v >= 75 ? 'text-emerald-600' : v >= 50 ? 'text-amber-600' : 'text-red-600');

  return (
    <ModalShell open onClose={onClose} label={`${student.name} ML insights`} width="max-w-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <StudentPhoto student={{ name: student.name, profilePic: student.profilePic || overview?.student?.profilePic }} className="size-12 text-base" />
            <div>
              <p className="text-[15px] font-bold text-slate-900">{student.name}</p>
              <p className="text-[11.5px] text-slate-500">Grade {student.grade} · Section {student.section} · Roll {student.roll}</p>
              <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${student.atRisk?.isAtRisk ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {student.atRisk?.isAtRisk ? 'At Risk' : 'Safe'}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="size-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-slate-500">
            <Loader2 className="size-5 animate-spin text-blue-600" /> Loading student insights…
          </div>
        ) : !detail && !overview ? (
          <div className="p-6 text-center text-sm text-slate-400">No data available yet.</div>
        ) : (
          <div className="space-y-4 p-5">
            {/* Academic snapshot */}
            {overview && (
              <div className="rounded-2xl border border-[#eaedf0] bg-[#fafcff] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Academic Snapshot</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ['Attendance (year)', att?.schoolDays ? `${att.percentage}%` : '—', att?.schoolDays ? `${att.presentDays}/${att.schoolDays} days` : 'Not taken yet', att?.schoolDays ? att.percentage : null],
                    ['Overall score', overview.overallScore != null ? `${overview.overallScore}%` : '—', 'Exams + graded work', overview.overallScore],
                    ['Exams', totals.exams ?? 0, `${subjects.length} subject${subjects.length === 1 ? '' : 's'}`, null],
                    ['Submissions', totals.submissions ?? 0, `${totals.graded ?? 0} graded · ${totals.late ?? 0} late`, null],
                  ].map(([k, v, sub, tone]) => (
                    <div key={k} className="rounded-lg bg-white px-2.5 py-2 text-center">
                      <p className="text-[10.5px] text-slate-500">{k}</p>
                      <p className={`text-[15px] font-bold ${tone != null ? pctTone(tone) : 'text-slate-900'}`}>{v}</p>
                      <p className="text-[10px] text-slate-400">{sub}</p>
                    </div>
                  ))}
                </div>
                {subjects.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {subjects.map((sub) => (
                      <div key={sub.subject}>
                        <div className="mb-0.5 flex justify-between text-[11.5px] text-slate-700"><span>{sub.subject}</span><span className={`font-semibold ${pctTone(sub.score)}`}>{sub.score != null ? `${sub.score}%` : '—'}</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${sub.score == null ? '' : sub.score >= 75 ? 'bg-emerald-500' : sub.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${sub.score ?? 0}%` }} /></div>
                      </div>
                    ))}
                  </div>
                )}
                {exams.length > 0 && (
                  <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100 bg-white">
                    {exams.map((e) => (
                      <div key={e.id} className="flex items-center justify-between px-3 py-1.5 text-[11.5px]">
                        <span className="truncate text-slate-700">{e.title} · {e.subject}</span>
                        <span className={`shrink-0 font-semibold ${pctTone(e.percentage)}`}>{e.percentage != null ? `${e.marks}/${e.maxMarks} · ${e.percentage}%` : 'Absent'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detail && <>
            {/* At-Risk */}
            <div className="rounded-2xl border border-[#eaedf0] bg-[#fafcff] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">At-Risk Status</p>
              <div className="flex items-center gap-3 mb-3">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${detail.atRisk?.isAtRisk ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {detail.atRisk?.isAtRisk ? 'At Risk' : 'Safe'}
                </span>
                <span className="text-sm text-gray-600">Risk Score: <strong>{detail.atRisk?.riskScore ?? '—'}</strong>/100</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
                <div className="h-full rounded-full bg-red-400 transition-all" style={{ width: `${detail.atRisk?.riskScore || 0}%` }} />
              </div>
              <div className="flex gap-4 text-xs text-gray-600">
                <span>Recent 7d avg: <strong className="text-gray-800">{detail.atRisk?.recentAvg ?? '—'}</strong></span>
                <span>Prior 7d avg: <strong className="text-gray-800">{detail.atRisk?.priorAvg ?? '—'}</strong></span>
                <span>Delta: <strong className={detail.atRisk?.delta < 0 ? 'text-red-600' : 'text-emerald-600'}>{detail.atRisk?.delta > 0 ? '+' : ''}{detail.atRisk?.delta ?? '—'}</strong></span>
              </div>
            </div>

            {/* Engagement */}
            <div className="rounded-2xl border border-[#eaedf0] bg-[#fafcff] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Engagement</p>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl font-bold text-gray-900">{detail.engagement?.engagementScore ?? '—'}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${engagementColor(detail.engagement?.label)}`}>{detail.engagement?.label?.replace('_', ' ')}</span>
              </div>
              {['viewScore', 'timeScore', 'submissionScore'].map((key) => {
                const labels = { viewScore: 'Views', timeScore: 'Time Spent', submissionScore: 'Submissions' };
                const val = detail.engagement?.components?.[key] ?? 0;
                return (
                  <div key={key} className="mb-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{labels[key]}</span><span>{val}%</span></div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${val}%` }} />
                    </div>
                  </div>
                );
              })}

              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Dimensions</p>
              {[
                { key: 'behavioural', label: 'Behavioural', color: 'bg-sky-400', hint: 'views + time + submissions' },
                { key: 'situational', label: 'Situational', color: 'bg-amber-400', hint: 'recency of last activity' },
                { key: 'emotional', label: 'Emotional', color: 'bg-rose-400', hint: 'wellbeing signals, if available' },
              ].map(({ key, label, color, hint }) => {
                const val = detail.engagement?.dimensions?.[key];
                return (
                  <div key={key} className="mb-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span title={hint}>{label}</span>
                      <span>{val == null ? '—' : `${val}%`}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${val ?? 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pace */}
            <div className="rounded-2xl border border-[#eaedf0] bg-[#fafcff] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Learning Pace</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">Sessions/week</p><p className="font-bold text-gray-900">{detail.pace?.avgSessionsPerWeek ?? '—'}</p></div>
                <div><p className="text-xs text-gray-400">Current mastery avg</p><p className="font-bold text-gray-900">{detail.pace?.currentAvgMastery ?? '—'}%</p></div>
                <div><p className="text-xs text-gray-400">Target mastery</p><p className="font-bold text-gray-900">{detail.pace?.targetMastery ?? 75}%</p></div>
                <div><p className="text-xs text-gray-400">Est. weeks to target</p><p className="font-bold text-gray-900">{detail.pace?.estimatedWeeksToTarget ?? '—'}</p></div>
              </div>
              {detail.pace?.paceLabel && (
                <span className="mt-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 capitalize">{detail.pace.paceLabel.replace('_', ' ')}</span>
              )}
            </div>

            {/* Mastery Topics */}
            {(weakTopics.length > 0 || strongTopics.length > 0) && (
              <div className="rounded-2xl border border-[#eaedf0] bg-[#fafcff] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Topic Mastery</p>
                {weakTopics.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-red-600 mb-2">Weakest Topics</p>
                    <div className="space-y-2">
                      {weakTopics.map((t) => (
                        <div key={t.topicId}>
                          <div className="flex justify-between text-xs text-gray-700 mb-1"><span className="truncate max-w-[70%]">{t.topicTitle}</span><span className="font-semibold text-red-600">{t.weightedScore}%</span></div>
                          <div className="h-1.5 rounded-full bg-red-100 overflow-hidden"><div className="h-full bg-red-400 rounded-full" style={{ width: `${t.weightedScore}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {strongTopics.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-emerald-600 mb-2">Strongest Topics</p>
                    <div className="space-y-2">
                      {strongTopics.map((t) => (
                        <div key={t.topicId}>
                          <div className="flex justify-between text-xs text-gray-700 mb-1"><span className="truncate max-w-[70%]">{t.topicTitle}</span><span className="font-semibold text-emerald-600">{t.weightedScore}%</span></div>
                          <div className="h-1.5 rounded-full bg-emerald-100 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${t.weightedScore}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Learning Gaps */}
            {detail.gaps?.gaps?.length > 0 && (
              <div className="rounded-2xl border border-[#eaedf0] bg-[#fafcff] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Learning Gaps</p>
                <div className="space-y-2">
                  {detail.gaps.gaps.map((g, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{g.topicTitle}</p>
                        <p className="text-[10px] text-gray-400">{g.subject} · Score {g.score}%</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${gapBadgeColor(g.gapType)}`}>{g.gapType}</span>
                        <span className={`text-[10px] font-semibold ${severityColor(g.severity)}`}>{g.severity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </>}
          </div>
        )}
    </ModalShell>
  );
};

// Mastery colour bands used by the heatmap cells, the topic bars and the legend.
const HEAT_BANDS = [
  { max: 20, label: '0 – 20%', name: 'Needs Support', cell: 'bg-red-100 text-red-600', swatch: 'bg-rose-300', bar: 'bg-red-500', text: 'text-red-600' },
  { max: 40, label: '21 – 40%', name: 'Below Average', cell: 'bg-orange-100 text-orange-600', swatch: 'bg-orange-400', bar: 'bg-orange-500', text: 'text-orange-600' },
  { max: 60, label: '41 – 60%', name: 'Average', cell: 'bg-amber-100 text-amber-700', swatch: 'bg-amber-300', bar: 'bg-amber-400', text: 'text-amber-600' },
  { max: 80, label: '61 – 80%', name: 'Good', cell: 'bg-emerald-100 text-emerald-700', swatch: 'bg-emerald-400', bar: 'bg-emerald-400', text: 'text-emerald-600' },
  { max: 100, label: '81 – 100%', name: 'Excellent', cell: 'bg-emerald-200 text-emerald-800', swatch: 'bg-green-600', bar: 'bg-green-600', text: 'text-green-700' },
];
const heatBand = (v) => (v == null ? null : HEAT_BANDS.find((b) => v <= b.max) || HEAT_BANDS[HEAT_BANDS.length - 1]);

const HeatmapSubPanel = ({ ctxGrade, ctxSection }) => {
  const [heatmap, setHeatmap] = useState(null);
  const [heatLoading, setHeatLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setHeatLoading(true);
    const params = new URLSearchParams();
    if (ctxGrade) params.set('className', ctxGrade);
    if (ctxSection) params.set('section', ctxSection);
    cachedFetch(`${API_BASE}/api/teacher-analytics/mastery-heatmap?${params}`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setHeatmap(d?.data || null))
      .catch(() => setHeatmap(null))
      .finally(() => setHeatLoading(false));
  }, [ctxGrade, ctxSection]);

  const allTopics = heatmap?.topics || [];
  const topicSubjects = heatmap?.topicSubjects || {};
  const subjects = [...new Set(Object.values(topicSubjects))].sort();
  const subjectTopics = allTopics.filter((t) => !subject || topicSubjects[t] === subject);
  const topics = subjectTopics.filter((t) => !topic || t === topic);
  const cells = heatmap?.cells || {};

  const avgOf = (list) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null);
  const studentAvg = (sid) => avgOf(topics.map((t) => cells[sid]?.[t]).filter((v) => v != null));

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (heatmap?.students || []).filter((s) => !q || String(s.name || '').toLowerCase().includes(q) || String(s.roll || '').includes(q));
  }, [heatmap, search]);
  useEffect(() => { setPage(1); }, [search, subject, topic, pageSize]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize);

  const topicAverages = topics.map((t, i) => ({
    code: `T${allTopics.indexOf(t) + 1 || i + 1}`,
    title: t,
    avg: avgOf((heatmap?.students || []).map((s) => cells[String(s._id)]?.[t]).filter((v) => v != null)),
  }));

  const selectCls = 'h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pb-1 pl-9 pr-8 pt-3.5 text-[12.5px] text-slate-800 outline-none focus:border-blue-300';
  const classLabel = ctxGrade ? `Class ${ctxGrade}${ctxSection ? ` - ${ctxSection}` : ''}` : 'Current class';

  if (heatLoading) return <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-slate-500"><Loader2 className="size-5 animate-spin text-blue-600" /> Loading heatmap…</div>;
  if (!heatmap || !heatmap.students?.length) return <div className="rounded-xl border border-slate-100 bg-white py-10 text-center text-sm text-slate-400">No mastery data for this class.</div>;

  return (
    <div className="space-y-3">
      {/* Search (full width) + filter toggle; class/subject/topic open below */}
      <div className="space-y-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-blue-300">
            <Search className="size-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student by name or roll..." className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-slate-400" />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-label={filtersOpen ? 'Close filters' : 'Open filters'}
            aria-expanded={filtersOpen}
            className={`relative flex size-9 shrink-0 items-center justify-center rounded-lg border transition ${filtersOpen ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {filtersOpen ? <X className="size-4" /> : <Filter className="size-4" />}
            {!filtersOpen && (subject || topic) && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">{[subject, topic].filter(Boolean).length}</span>
            )}
          </button>
        </div>
        <AnimatePresence initial={false}>
          {filtersOpen && (
            <Motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="grid gap-2 overflow-hidden sm:grid-cols-3"
            >
            <div className="relative">
              <LayoutGridIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <span className="pointer-events-none absolute left-9 top-1 text-[10px] text-slate-500">Class</span>
              <div className="flex h-10 items-end rounded-lg border border-slate-200 bg-slate-50/50 pb-1 pl-9 text-[12.5px] text-slate-800">{classLabel}</div>
            </div>
            <label className="relative">
              <BookOpen className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <span className="pointer-events-none absolute left-9 top-1 text-[10px] text-slate-500">Subject</span>
              <select value={subject} onChange={(e) => { setSubject(e.target.value); setTopic(''); }} className={selectCls} aria-label="Subject">
                <option value="">All Subjects</option>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            </label>
            <label className="relative">
              <Target className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <span className="pointer-events-none absolute left-9 top-1 text-[10px] text-slate-500">Topic</span>
              <select value={topic} onChange={(e) => setTopic(e.target.value)} className={selectCls} aria-label="Topic">
                <option value="">All Topics</option>
                {subjectTopics.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            </label>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Heatmap */}
        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><LayoutGridIcon className="size-4" /></span>
              <div>
                <h3 className="text-[14px] font-bold text-slate-900">Mastery Heatmap</h3>
                <p className="text-[11.5px] text-slate-500">See how each student is performing across topics. Darker colors mean higher mastery.</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11.5px] text-slate-600">View <strong className="font-semibold text-slate-800">Mastery Score</strong></span>
          </div>

          <div className="overflow-x-auto p-3">
            <table className="w-full min-w-max border-separate border-spacing-1 text-left">
              <thead>
                <tr className="text-[11px] text-slate-500">
                  <th className="sticky left-0 z-10 w-8 bg-white px-1 py-1.5 text-center font-medium">#</th>
                  <th className="sticky left-8 z-10 min-w-[150px] bg-white px-2 py-1.5 font-medium">Student</th>
                  {topics.map((t) => (
                    <th key={t} title={`${t}${topicSubjects[t] ? ` (${topicSubjects[t]})` : ''}`} className="w-[88px] px-1 py-1.5 text-center align-bottom font-medium">
                      <span className="line-clamp-2 break-words text-[10.5px] leading-tight text-slate-700">{t}</span>
                      {topicSubjects[t] && <span className="block truncate text-[9.5px] font-normal text-slate-400">{topicSubjects[t]}</span>}
                    </th>
                  ))}
                  <th className="w-12 px-1 py-1.5 text-center font-medium">Avg</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s, i) => {
                  const sid = String(s._id);
                  const n = (current - 1) * pageSize + i + 1;
                  const avg = studentAvg(sid);
                  const avgBand = heatBand(avg);
                  return (
                    <tr key={sid}>
                      <td className="sticky left-0 z-10 bg-white px-1 text-center text-[11px] text-slate-500">{n}</td>
                      <td className="sticky left-8 z-10 bg-white px-2 py-1">
                        <div className="flex items-center gap-2">
                          {photoUrlOf(s) ? (
                            <StudentPhoto student={{ name: s.name, profilePic: s.profilePic }} className="size-7 text-[11px]" />
                          ) : (
                            <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${ML_AVATAR[n % ML_AVATAR.length]}`}>{String(s.name || 'S').charAt(0).toUpperCase()}</span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-medium text-slate-900">{s.name}</p>
                            <p className="text-[10.5px] text-slate-500">Roll {s.roll ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      {topics.map((t) => {
                        const score = cells[sid]?.[t];
                        const band = heatBand(score);
                        return (
                          <td key={t} title={`${t}: ${score != null ? `${score}%` : 'no data'}`}
                            className={`h-8 rounded-md px-1 text-center text-[11px] font-semibold ${band ? band.cell : 'bg-slate-50 text-slate-300'}`}>
                            {score != null ? `${score}%` : '–'}
                          </td>
                        );
                      })}
                      <td className={`h-8 rounded-md px-1 text-center text-[11px] font-bold ${avgBand ? avgBand.cell : 'bg-slate-50 text-slate-400'}`}>
                        {avg != null ? `${avg}%` : '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5">
            <p className="text-[11.5px] text-slate-500">Showing {rows.length ? (current - 1) * pageSize + 1 : 0} to {Math.min(current * pageSize, rows.length)} of {rows.length} students</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
                Rows per page
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-[12px] text-slate-800 outline-none">
                  {[5, 10, 20, 50].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Previous page" className="flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
                {Array.from({ length: pageCount }, (_, k) => k + 1)
                  .filter((p) => pageCount <= 7 || p === 1 || p === pageCount || Math.abs(p - current) <= 1)
                  .map((p, k, arr) => (
                    <React.Fragment key={p}>
                      {k > 0 && p - arr[k - 1] > 1 && <span className="px-1 text-[11px] text-slate-400">…</span>}
                      <button type="button" onClick={() => setPage(p)} aria-current={p === current ? 'page' : undefined}
                        className={`flex size-7 items-center justify-center rounded-md text-[11.5px] font-semibold ${p === current ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{p}</button>
                    </React.Fragment>
                  ))}
                <button type="button" onClick={() => setPage(current + 1)} disabled={current === pageCount} aria-label="Next page" className="flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-3">
          {/* Topic performance */}
          <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-[13.5px] font-bold text-slate-900">
              <BarChart2 className="size-4 text-blue-600" /> Topic Performance <span className="font-medium text-blue-600">(Class Average)</span>
            </h3>
            {topicAverages.length === 0 ? (
              <p className="text-[11.5px] text-slate-500">No topics for this filter.</p>
            ) : (
              <ul className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {topicAverages.map((t) => {
                  const band = heatBand(t.avg);
                  return (
                    <li key={t.title} title={t.title}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-[11.5px] font-medium text-slate-800">{t.title}</span>
                        <span className={`shrink-0 text-[11.5px] font-semibold ${band && t.avg < 40 ? band.text : 'text-slate-800'}`}>{t.avg != null ? `${t.avg}%` : '—'}</span>
                      </div>
                      {topicSubjects[t.title] && <p className="-mt-0.5 mb-1 text-[10px] text-slate-400">{topicSubjects[t.title]}</p>}
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${band ? band.bar : ''}`} style={{ width: `${t.avg ?? 0}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Colour guide */}
          <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-[13.5px] font-bold text-slate-900"><TrendingUpIcon className="size-4 text-blue-600" /> Mastery Score Color Guide</h3>
            <div className="grid grid-cols-3 gap-2">
              {[...HEAT_BANDS, null].map((b) => (
                <div key={b ? b.label : 'none'} className="flex items-start gap-1.5 rounded-lg border border-slate-100 p-2">
                  <span className={`mt-0.5 size-3.5 shrink-0 rounded ${b ? b.swatch : 'bg-slate-200'}`} />
                  <div className="leading-tight">
                    <p className="text-[10.5px] font-semibold text-slate-800">{b ? b.label : 'No Data'}</p>
                    <p className="text-[9.5px] text-slate-500">{b ? b.name : '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

// Tiny SVG line for a series of numbers/nulls (nulls are skipped, not zeroed).
const Sparkline = ({ values = [], color = '#ef4444', width = 140, height = 22 }) => {
  const pts = values.map((v, i) => (v == null ? null : [
    values.length > 1 ? (i / (values.length - 1)) * (width - 6) + 3 : width / 2,
    height - 3 - (v / 100) * (height - 6),
  ])).filter(Boolean);
  if (!pts.length) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line x1="3" x2={width - 3} y1={height / 2} y2={height / 2} stroke="#cbd5e1" strokeDasharray="2 4" />
      </svg>
    );
  }
  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts.map((p) => p.join(',')).join(' ')} />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" fill="#fff" stroke={color} strokeWidth="1.3" />)}
    </svg>
  );
};

const TREND_STATUS = {
  improving: { label: 'Improving', cls: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500', line: '#16a34a' },
  stable: { label: 'Stable', cls: 'bg-amber-50 text-amber-600', dot: 'bg-amber-400', line: '#ef4444' },
  declining: { label: 'Declining', cls: 'bg-red-50 text-red-600', dot: 'bg-red-500', line: '#dc2626' },
};

const TrendsSubPanel = ({ ctxGrade, ctxSection }) => {
  const [trendData, setTrendData] = useState([]);
  const [classSeries, setClassSeries] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [days, setDays] = useState(7);
  const [subject, setSubject] = useState('');
  const [trendLoading, setTrendLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const PAGE_SIZE = 10;

  const load = (d, subj) => {
    setTrendLoading(true);
    const params = new URLSearchParams({ days: d });
    if (ctxGrade) params.set('className', ctxGrade);
    if (ctxSection) params.set('section', ctxSection);
    if (subj) params.set('subject', subj);
    cachedFetch(`${API_BASE}/api/teacher-analytics/improvement-trends?${params}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        setTrendData(res?.data || []);
        setClassSeries(res?.classSeries || []);
        if (res?.subjects?.length) setSubjects(res.subjects);
      })
      .catch(() => { setTrendData([]); setClassSeries([]); })
      .finally(() => setTrendLoading(false));
  };

  useEffect(() => { load(days, subject); }, [ctxGrade, ctxSection, days, subject]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = (t) => trendData.filter((s) => s.trend === t).length;
  const improving = count('improving');
  const stable = count('stable');
  const declining = count('declining');

  const statCards = [
    { label: 'Students Showing Improvement', value: improving, helper: `Scores increased in last ${days} days`, icon: TrendingUp, card: 'border-emerald-100 bg-emerald-50/40', tile: 'bg-emerald-100 text-emerald-600' },
    { label: 'No Significant Change', value: stable, helper: 'Scores are stable', icon: Minus, card: 'border-amber-100 bg-amber-50/40', tile: 'bg-amber-100 text-amber-500' },
    { label: 'Students with Decline', value: declining, helper: `Scores decreased in last ${days} days`, icon: TrendingDown, card: 'border-red-100 bg-red-50/40', tile: 'bg-red-100 text-red-500' },
    { label: 'Total Students', value: trendData.length, helper: 'In this class', icon: Users, card: 'border-slate-200 bg-slate-50/60', tile: 'bg-slate-100 text-slate-600' },
  ];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trendData.filter((s) => !q || String(s.name || '').toLowerCase().includes(q) || String(s.roll || '').includes(q));
  }, [trendData, search]);
  useEffect(() => { setPage(1); }, [search, days, subject]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // Class average chart geometry.
  const W = 640; const H = 200; const PADL = 36; const PADB = 22; const PADT = 8;
  const chartPts = classSeries.map((d, i) => ({
    x: PADL + (classSeries.length > 1 ? (i / (classSeries.length - 1)) * (W - PADL - 12) : (W - PADL) / 2),
    y: d.avg == null ? null : PADT + (1 - d.avg / 100) * (H - PADT - PADB),
    ...d,
  }));
  const plotted = chartPts.filter((p) => p.y != null);
  const labelEvery = Math.max(1, Math.ceil(chartPts.length / 7));
  const fmtDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const selectCls = 'h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pb-1 pl-9 pr-8 pt-3.5 text-[12.5px] text-slate-800 outline-none focus:border-blue-300';
  const classLabel = ctxGrade ? `Class ${ctxGrade}${ctxSection ? ` - ${ctxSection}` : ''}` : 'Current class';

  const insights = [
    { value: improving, title: 'students improved', text: improving ? `Scores rose by more than 5 points in the last ${days} days.` : `No students showed improvement in the last ${days} days.`, icon: TrendingUp, tile: 'bg-emerald-50 text-emerald-600' },
    { value: stable, title: 'students are stable', text: stable ? 'No meaningful change in their scores (within ±5 points).' : 'Every student changed noticeably.', icon: Minus, tile: 'bg-amber-50 text-amber-500' },
    { value: declining, title: 'students declined', text: declining ? 'Scores dropped by more than 5 points — consider follow-up.' : 'No students showed a decrease in scores.', icon: TrendingDown, tile: 'bg-red-50 text-red-500' },
  ];

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="space-y-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-blue-300">
            <Search className="size-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student by name or roll..." className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-slate-400" />
          </div>
          <label className="relative flex items-center">
            <Calendar className="pointer-events-none absolute left-2.5 size-3.5 text-slate-500" />
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Window" className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[12.5px] text-slate-800 outline-none focus:border-blue-300">
              <option value={7}>Last 7 Days</option><option value={15}>Last 15 Days</option><option value={30}>Last 30 Days</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
          </label>
          <button type="button" onClick={() => setFiltersOpen((v) => !v)} aria-label={filtersOpen ? 'Close filters' : 'Open filters'} aria-expanded={filtersOpen}
            className={`relative flex size-9 shrink-0 items-center justify-center rounded-lg border transition ${filtersOpen ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {filtersOpen ? <X className="size-4" /> : <Filter className="size-4" />}
            {!filtersOpen && subject && <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">1</span>}
          </button>
        </div>
        <AnimatePresence initial={false}>
          {filtersOpen && (
            <Motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}
              className="grid gap-2 overflow-hidden sm:grid-cols-2">
              <div className="relative">
                <LayoutGridIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <span className="pointer-events-none absolute left-9 top-1 text-[10px] text-slate-500">Class</span>
                <div className="flex h-10 items-end rounded-lg border border-slate-200 bg-slate-50/50 pb-1 pl-9 text-[12.5px] text-slate-800">{classLabel}</div>
              </div>
              <label className="relative">
                <BookOpen className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <span className="pointer-events-none absolute left-9 top-1 text-[10px] text-slate-500">Subject</span>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className={selectCls} aria-label="Subject">
                  <option value="">All Subjects</option>
                  {subjects.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              </label>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {statCards.map((c, i) => (
          <Motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-3 rounded-xl border p-3 ${c.card}`}>
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${c.tile}`}><c.icon className="size-5" /></span>
            <div className="min-w-0">
              <p className="truncate text-[11.5px] text-slate-600">{c.label}</p>
              <p className="text-lg font-bold leading-tight text-slate-900">{trendLoading ? '—' : c.value}</p>
              <p className="truncate text-[10.5px] text-slate-500">{c.helper}</p>
            </div>
          </Motion.div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Class average chart */}
        <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-start gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><BarChart2 className="size-4" /></span>
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">Class Average Trend</h3>
              <p className="text-[11.5px] text-slate-500">Average score (exams + graded work) of all students over the last {days} days.</p>
            </div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Class average trend">
            {[0, 20, 40, 60, 80, 100].map((v) => {
              const y = PADT + (1 - v / 100) * (H - PADT - PADB);
              return (
                <g key={v}>
                  <line x1={PADL} x2={W - 8} y1={y} y2={y} stroke="#eef2f7" />
                  <text x={PADL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">{v}%</text>
                </g>
              );
            })}
            {chartPts.map((p, i) => (i % labelEvery === 0 || i === chartPts.length - 1) && (
              <text key={p.date} x={p.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#64748b">{fmtDay(p.date)}</text>
            ))}
            {plotted.length > 1 && <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={plotted.map((p) => `${p.x},${p.y}`).join(' ')} />}
            {plotted.map((p) => (
              <g key={p.date}>
                <circle cx={p.x} cy={p.y} r="3.5" fill="#2563eb" />
                <title>{`${fmtDay(p.date)}: ${p.avg}%`}</title>
              </g>
            ))}
          </svg>
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-600">
            <span className="inline-block h-0.5 w-5 rounded bg-blue-600" /> Class Average
            {!plotted.length && !trendLoading && <span className="text-slate-400">· No scores recorded in this window</span>}
          </div>
        </section>

        {/* Key insights */}
        <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-slate-900"><Award className="size-4 text-blue-600" /> Key Insights</h3>
          <div className="space-y-2">
            {insights.map((it) => (
              <div key={it.title} className="flex items-start gap-3 rounded-lg border border-slate-100 p-2.5">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${it.tile}`}><it.icon className="size-4" /></span>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold leading-tight text-slate-900">{trendLoading ? '—' : it.value}</p>
                  <p className="text-[11.5px] font-medium text-slate-800">{it.title}</p>
                  <p className="text-[10.5px] text-slate-500">{it.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Student table */}
      <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-start gap-2.5 px-4 pt-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Users className="size-4" /></span>
          <div>
            <h3 className="text-[14px] font-bold text-slate-900">Student Improvement Trends</h3>
            <p className="text-[11.5px] text-slate-500">Compare each student's score trend over the last {days} days.</p>
          </div>
        </div>
        {trendLoading ? (
          <div className="flex min-h-[180px] items-center justify-center gap-2 text-[13px] text-slate-500"><Loader2 className="size-5 animate-spin text-blue-600" /> Loading trends…</div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-slate-400">{trendData.length ? 'No students match your search.' : 'No trend data yet.'}</p>
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="bg-slate-50/70 text-[11.5px] text-slate-500">
                  <th className="w-10 px-3 py-2 text-center font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 text-center font-medium">Current Score</th>
                  <th className="px-3 py-2 text-center font-medium">Previous Score<span className="block text-[10px] font-normal">({days} days before)</span></th>
                  <th className="px-3 py-2 text-center font-medium">Change</th>
                  <th className="px-3 py-2 text-center font-medium">Trend (Last {days} Days)</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s, i) => {
                  const n = (current - 1) * PAGE_SIZE + i + 1;
                  const st = TREND_STATUS[s.trend] || TREND_STATUS.stable;
                  const d = s.delta;
                  return (
                    <tr key={String(s.studentId)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-3 py-1.5 text-center text-xs text-slate-500">{n}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2.5">
                          {photoUrlOf(s) ? (
                            <StudentPhoto student={{ name: s.name, profilePic: s.profilePic }} className="size-8 text-xs" />
                          ) : (
                            <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${ML_AVATAR[n % ML_AVATAR.length]}`}>{String(s.name || 'S').charAt(0).toUpperCase()}</span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-medium text-slate-900">{s.name}</p>
                            <p className="text-[10.5px] text-slate-500">Roll {s.roll ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-center text-[12.5px] font-semibold text-slate-900">{s.currentScore != null ? `${s.currentScore}%` : '—'}</td>
                      <td className="px-3 py-1.5 text-center text-[12.5px] font-semibold text-slate-900">{s.priorAvg != null ? `${s.priorAvg}%` : '—'}</td>
                      <td className="px-3 py-1.5 text-center">
                        {d == null ? <span className="text-[12px] text-slate-400">— n/a</span> : (
                          <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${d > 0 ? 'text-emerald-600' : d < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                            {d > 0 ? '▲' : d < 0 ? '▼' : '–'} {d > 0 ? '+' : ''}{d}%
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5"><div className="flex justify-center"><Sparkline values={s.series || []} color={st.line} /></div></td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${st.cls}`}><span className={`size-1.5 rounded-full ${st.dot}`} /> {st.label}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <button type="button" onClick={() => setDetail(s)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-[11.5px] font-medium text-blue-700 transition hover:bg-blue-100">
                          <Eye className="size-3.5" /> View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!trendLoading && rows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
            <p className="text-[11.5px] text-slate-500">Showing {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, rows.length)} of {rows.length} students</p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Previous page" className="flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
              <span className="text-[11.5px] text-slate-600">{current} / {pageCount}</span>
              <button type="button" onClick={() => setPage(current + 1)} disabled={current === pageCount} aria-label="Next page" className="flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
            </div>
          </div>
        )}
      </section>

      {/* Student trend detail */}
      <ModalShell open={Boolean(detail)} onClose={() => setDetail(null)} label="Improvement details" width="max-w-md">
        {detail && (() => {
          const st = TREND_STATUS[detail.trend] || TREND_STATUS.stable;
          return (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <StudentPhoto student={{ name: detail.name, profilePic: detail.profilePic }} className="size-11 text-sm" />
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900">{detail.name}</h3>
                    <p className="text-[11.5px] text-slate-500">Roll {detail.roll ?? '—'}{subject ? ` · ${subject}` : ''}</p>
                    <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${st.cls}`}><span className={`size-1.5 rounded-full ${st.dot}`} /> {st.label}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setDetail(null)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="size-4" /></button>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['Last ' + days + ' days', detail.recentAvg != null ? `${detail.recentAvg}%` : '—', `${detail.recentCount || 0} score${detail.recentCount === 1 ? '' : 's'}`],
                    ['Previous ' + days + ' days', detail.priorAvg != null ? `${detail.priorAvg}%` : '—', `${detail.priorCount || 0} score${detail.priorCount === 1 ? '' : 's'}`],
                    ['Change', detail.delta != null ? `${detail.delta > 0 ? '+' : ''}${detail.delta}%` : '—', detail.delta == null ? 'Needs scores in both periods' : 'points'],
                  ].map(([k, v, sub]) => (
                    <div key={k} className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                      <p className="text-[10.5px] text-slate-500">{k}</p>
                      <p className="text-[15px] font-bold text-slate-900">{v}</p>
                      <p className="text-[10px] text-slate-400">{sub}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-1.5 text-[12px] font-semibold text-slate-700">Daily scores</p>
                  <div className="rounded-lg border border-slate-100 p-2"><Sparkline values={detail.series || []} color={st.line} width={380} height={60} /></div>
                </div>
                <p className="text-[11.5px] text-slate-500">
                  Improving / declining means the average moved by more than 5 points between the two periods. Scores come from published exams and graded assignments.
                </p>
              </div>
            </>
          );
        })()}
      </ModalShell>
    </div>
  );
};

const CohortReportSubPanel = ({ ctxGrade, ctxSection }) => {
  const [heatmap, setHeatmap] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [days, setDays] = useState(7);
  const [report, setReport] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (ctxGrade) params.set('className', ctxGrade);
    if (ctxSection) params.set('section', ctxSection);
    const tParams = new URLSearchParams(params);
    tParams.set('days', days);
    Promise.all([
      cachedFetch(`${API_BASE}/api/teacher-analytics/mastery-heatmap?${params}`, { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : null)).then((d) => d?.data || null).catch(() => null),
      cachedFetch(`${API_BASE}/api/teacher-analytics/improvement-trends?${tParams}`, { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : null)).then((d) => d?.data || []).catch(() => []),
    ]).then(([hm, tr]) => { setHeatmap(hm); setTrends(tr); }).finally(() => setLoading(false));
  }, [ctxGrade, ctxSection, days]);

  const generate = () => {
    setGenerating(true);
    fetch(`${API_BASE}/api/ai-teacher/cohort-report`, {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({ className: ctxGrade, section: ctxSection }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setReport(d?.data?.content || 'No report generated.'))
      .catch(() => setReport('Failed to generate report.'))
      .finally(() => setGenerating(false));
  };

  const students = heatmap?.students || [];
  const cells = heatmap?.cells || {};
  const topicSubjects = heatmap?.topicSubjects || {};
  const subjects = [...new Set(Object.values(topicSubjects))].sort();
  const topics = (heatmap?.topics || []).filter((t) => !subject || topicSubjects[t] === subject);
  const avgOf = (list) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null);

  // Per-topic: how many students attempted it, class average, and how many fall in each band.
  const topicRows = topics.map((t) => {
    const scores = students.map((s) => cells[String(s._id)]?.[t]).filter((v) => v != null);
    const bands = HEAT_BANDS.map((b, i) => scores.filter((v) => v <= b.max && (i === 0 || v > HEAT_BANDS[i - 1].max)).length);
    return { topic: t, subject: topicSubjects[t] || '', attempted: scores.length, avg: avgOf(scores), bands };
  }).sort((a, b) => (a.avg ?? 101) - (b.avg ?? 101));

  const allScores = topics.flatMap((t) => students.map((s) => cells[String(s._id)]?.[t]).filter((v) => v != null));
  const classAvg = avgOf(allScores);
  const allBands = HEAT_BANDS.map((b, i) => allScores.filter((v) => v <= b.max && (i === 0 || v > HEAT_BANDS[i - 1].max)).length);
  const studentAvgs = students.map((s) => avgOf(topics.map((t) => cells[String(s._id)]?.[t]).filter((v) => v != null)));
  const atRisk = studentAvgs.filter((v) => v != null && v <= 20).length;
  const withData = studentAvgs.filter((v) => v != null).length;
  const improved = trends.filter((t) => t.trend === 'improving').length;
  const topicBandCount = HEAT_BANDS.map((b) => topicRows.filter((r) => heatBand(r.avg) === b).length);

  const summary = [
    { label: 'Total Students', value: students.length, helper: 'In this class', icon: Users, card: 'border-blue-100 bg-blue-50/40', tile: 'bg-blue-100 text-blue-600' },
    { label: 'At Risk', value: atRisk, helper: 'Average 20% or below', icon: AlertTriangle, card: 'border-red-100 bg-red-50/40', tile: 'bg-red-100 text-red-500' },
    { label: 'Avg Mastery', value: classAvg != null ? `${classAvg}%` : '—', helper: 'Class average', icon: BarChart2, card: 'border-amber-100 bg-amber-50/40', tile: 'bg-amber-100 text-amber-500' },
    { label: 'Improved Students', value: improved, helper: `Scores increased (last ${days} days)`, icon: TrendingUp, card: 'border-emerald-100 bg-emerald-50/40', tile: 'bg-emerald-100 text-emerald-600' },
  ];
  const insightText = withData < Math.max(1, Math.ceil(students.length / 2))
    ? `Only ${withData} of ${students.length} students have mastery data yet. More practice activity is needed for meaningful insights.`
    : atRisk > 0
      ? `${atRisk} student${atRisk === 1 ? ' is' : 's are'} averaging 20% or below — review the weakest topics first.`
      : 'No students are in the lowest band. Focus on moving "Average" topics up to "Good".';

  const selectCls = 'h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pb-1 pl-9 pr-8 pt-3.5 text-[12.5px] text-slate-800 outline-none focus:border-blue-300';
  const classLabel = ctxGrade ? `Class ${ctxGrade}${ctxSection ? ` - ${ctxSection}` : ''}` : 'Current class';
  const cell = (v) => {
    const band = heatBand(v);
    return <td className={`h-8 rounded-md px-1 text-center text-[11px] font-semibold ${band ? band.cell : 'bg-slate-50 text-slate-400'}`}>{v != null ? `${v}%` : '–'}</td>;
  };

  if (loading) return <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-slate-500"><Loader2 className="size-5 animate-spin text-blue-600" /> Loading cohort report…</div>;

  return (
    <div className="space-y-3">
      {/* Filters + colour guide */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:grid-cols-3">
          <div className="relative">
            <LayoutGridIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <span className="pointer-events-none absolute left-9 top-1 text-[10px] text-slate-500">Class</span>
            <div className="flex h-10 items-end rounded-lg border border-slate-200 bg-slate-50/50 pb-1 pl-9 text-[12.5px] text-slate-800">{classLabel}</div>
          </div>
          <label className="relative">
            <BookOpen className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <span className="pointer-events-none absolute left-9 top-1 text-[10px] text-slate-500">Subject</span>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className={selectCls} aria-label="Subject">
              <option value="">All Subjects</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          </label>
          <label className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <span className="pointer-events-none absolute left-9 top-1 text-[10px] text-slate-500">Time Period</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={selectCls} aria-label="Time period">
              <option value={7}>Last 7 Days</option><option value={15}>Last 15 Days</option><option value={30}>Last 30 Days</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm">
          {[...HEAT_BANDS, null].map((b) => (
            <span key={b ? b.label : 'none'} className="flex items-center gap-1.5">
              <span className={`size-3 rounded-full ${b ? b.swatch : 'bg-slate-200'}`} />
              <span className="leading-tight">
                <span className="block text-[10.5px] font-semibold text-slate-800">{b ? b.label : 'No Data'}</span>
                {b && <span className="block text-[9.5px] text-slate-500">{b.name}</span>}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Cohort performance */}
      <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-start gap-2.5 px-4 pt-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Users className="size-4" /></span>
          <div>
            <h3 className="text-[14px] font-bold text-slate-900">Cohort Performance</h3>
            <p className="text-[11.5px] text-slate-500">Average mastery score by topic for {classLabel}{subject ? ` · ${subject}` : ''}, with how many students fall in each score band.</p>
          </div>
        </div>
        {topicRows.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-slate-400">No mastery data yet — students need to attempt practice questions.</p>
        ) : (
          <div className="overflow-x-auto p-3">
            <table className="w-full min-w-[820px] border-separate border-spacing-1 text-left">
              <thead>
                <tr className="text-[11px] text-slate-500">
                  <th className="px-2 py-1.5 font-medium">Topic</th>
                  <th className="px-2 py-1.5 text-center font-medium">Students</th>
                  {HEAT_BANDS.map((b) => <th key={b.label} className="px-1 py-1.5 text-center font-medium" title={b.name}>{b.label}</th>)}
                  <th className="px-1 py-1.5 text-center font-medium">Average</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-2 text-[12px] font-bold text-slate-900">All Topics (Class Avg)</td>
                  <td className="px-2 text-center text-[12px] font-semibold text-slate-800">{withData}/{students.length}</td>
                  {allBands.map((c, i) => <td key={i} className="h-8 rounded-md bg-slate-50 text-center text-[11px] font-semibold text-slate-700">{c}</td>)}
                  {cell(classAvg)}
                </tr>
                {topicRows.map((r) => (
                  <tr key={r.topic}>
                    <td className="px-2 py-1">
                      <p className="max-w-[220px] truncate text-[12px] text-slate-800" title={r.topic}>{r.topic}</p>
                      {r.subject && <p className="text-[10px] text-slate-400">{r.subject}</p>}
                    </td>
                    <td className="px-2 text-center text-[12px] text-slate-700">{r.attempted}/{students.length}</td>
                    {r.bands.map((c, i) => (
                      <td key={i} className={`h-8 rounded-md text-center text-[11px] font-semibold ${c ? HEAT_BANDS[i].cell : 'bg-slate-50 text-slate-300'}`}>{c}</td>
                    ))}
                    {cell(r.avg)}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-1 pt-1 text-[10.5px] text-slate-400">Band columns show the number of students whose mastery for that topic falls in the range. "Students" = attempted / class size.</p>
          </div>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Topic insights */}
        <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-slate-900"><Lightbulb className="size-4 text-blue-600" /> Topic Insights</h3>
          <ul className="space-y-2">
            {[
              ['Topics need support', 'Average score 20% or below'],
              ['Topics are below average', 'Average score 21% – 40%'],
              ['Topics are average', 'Average score 41% – 60%'],
              ['Topics are good', 'Average score 61% – 80%'],
              ['Topics are excellent', 'Average score 81% – 100%'],
            ].map(([title, sub], i) => (
              <li key={title} className="flex items-center gap-3">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold ${HEAT_BANDS[i].cell}`}>{topicBandCount[i]}</span>
                <div>
                  <p className="text-[12.5px] font-medium text-slate-800">{title}</p>
                  <p className="text-[10.5px] text-slate-500">{sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Cohort summary */}
        <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><BarChart2 className="size-4" /></span>
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">Cohort Summary</h3>
              <p className="text-[11.5px] text-slate-500">Overall performance of {classLabel}.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {summary.map((c) => (
              <div key={c.label} className={`rounded-xl border p-3 ${c.card}`}>
                <span className={`mb-2 flex size-8 items-center justify-center rounded-lg ${c.tile}`}><c.icon className="size-4" /></span>
                <p className="text-[11px] text-slate-600">{c.label}</p>
                <p className="text-lg font-bold leading-tight text-slate-900">{c.value}</p>
                <p className="text-[10px] text-slate-500">{c.helper}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-[11.5px] text-slate-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-blue-600" /> {insightText}
          </p>
        </section>
      </div>

      {/* AI narrative */}
      <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-900"><Brain className="size-4 text-violet-600" /> AI Cohort Narrative</h3>
            <p className="text-[11.5px] text-slate-500">AI-written class performance summary based on the last 30 days of data.</p>
          </div>
          <button type="button" onClick={generate} disabled={generating}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-[12px] font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60">
            {generating ? <><Loader2 className="size-3.5 animate-spin" /> Generating…</> : <><Sparkle className="size-3.5" /> Generate Report</>}
          </button>
        </div>
        {report && <div className="mt-3 whitespace-pre-line rounded-lg border border-violet-100 bg-violet-50/40 p-3 text-[12.5px] leading-relaxed text-slate-700">{report}</div>}
      </section>
    </div>
  );
};

const ML_AVATAR = ['bg-rose-50 text-rose-500', 'bg-blue-50 text-blue-600', 'bg-emerald-50 text-emerald-600', 'bg-violet-50 text-violet-600', 'bg-amber-50 text-amber-600'];
const titleCase = (v) => String(v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const ENGAGEMENT_PILL = {
  high: 'bg-emerald-50 text-emerald-600',
  medium: 'bg-amber-50 text-amber-600',
  moderate: 'bg-amber-50 text-amber-600',
  low: 'bg-red-50 text-red-500',
  very_low: 'bg-red-50 text-red-600',
};
const TREND_PILL = (t) => {
  const v = String(t || '').toLowerCase();
  if (!v || v === 'insufficient_data' || v === 'unknown') return { cls: 'bg-slate-100 text-slate-500', icon: Activity, label: 'Insufficient Data' };
  if (v.includes('improv') || v.includes('up')) return { cls: 'bg-emerald-50 text-emerald-600', icon: TrendingUp, label: titleCase(v) };
  if (v.includes('declin') || v.includes('down') || v.includes('stall')) return { cls: 'bg-red-50 text-red-600', icon: TrendingDown, label: titleCase(v) };
  return { cls: 'bg-blue-50 text-blue-600', icon: Minus, label: titleCase(v) };
};

const MLInsightsTab = ({ data, loading, onFetch, detailStudent, setDetailStudent, ctxGrade, ctxSection }) => {
  const [subPanel, setSubPanel] = useState('overview');
  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState('');
  const [engagement, setEngagement] = useState('');
  const [pace, setPace] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const atRiskCount = data.filter((s) => s.atRisk?.isAtRisk).length;
  const avgEngagement = data.length ? Math.round(data.reduce((a, s) => a + (s.engagement?.engagementScore || 0), 0) / data.length) : 0;
  const avgMastery = data.length ? Math.round(data.reduce((a, s) => a + (s.masteryAvg || 0), 0) / data.length) : 0;

  const summaryCards = [
    { label: 'Total Students', value: data.length, icon: Users, card: 'border-blue-100 bg-blue-50/40', tile: 'bg-blue-100 text-blue-600' },
    { label: 'At Risk', value: atRiskCount, icon: AlertTriangle, card: 'border-red-100 bg-red-50/40', tile: 'bg-red-100 text-red-500' },
    { label: 'Avg Engagement', value: `${avgEngagement}%`, icon: Activity, card: 'border-amber-100 bg-amber-50/40', tile: 'bg-amber-100 text-amber-500' },
    { label: 'Avg Mastery', value: `${avgMastery}%`, icon: BarChart2, card: 'border-emerald-100 bg-emerald-50/40', tile: 'bg-emerald-100 text-emerald-600' },
  ];

  const engagementOptions = [...new Set(data.map((s) => s.engagement?.label).filter(Boolean))];
  const paceOptions = [...new Set(data.map((s) => s.pace?.paceLabel).filter(Boolean))];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((s) => (!q || String(s.name || '').toLowerCase().includes(q) || String(s.roll || '').includes(q))
      && (!risk || (risk === 'at_risk' ? s.atRisk?.isAtRisk : !s.atRisk?.isAtRisk))
      && (!engagement || s.engagement?.label === engagement)
      && (!pace || s.pace?.paceLabel === pace));
  }, [data, search, risk, engagement, pace]);

  useEffect(() => { setPage(1); }, [search, risk, engagement, pace, pageSize]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize);

  const selectCls = 'h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[12.5px] text-slate-800 outline-none focus:border-blue-300';
  const subTabs = [
    { key: 'overview', label: 'Overview', icon: Gauge },
    { key: 'heatmap', label: 'Mastery Heatmap', icon: BarChart3 },
    { key: 'trends', label: 'Improvement Trends', icon: TrendingUpIcon },
    { key: 'report', label: 'Cohort Report', icon: Users },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-center gap-3">
        <div className="flex items-center gap-3">
          {/* <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><BarChart2 className="size-5" /></span> */}
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 text-center">ML Insights</h2>
            <p className="text-[12.5px] text-slate-500">Analyze student performance, identify at-risk learners and track learning trends using AI.</p>
          </div>
        </div>
        <button type="button" onClick={onFetch} disabled={loading} className="inline-flex h-8 items-center justify-end gap-1.5 rounded-full border border-blue-200 bg-blue-50/60 px-3 text-[12.5px] font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-50">
          <RefreshCcw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {/* Sub-panel tabs */}
      <div className="flex items-center justify-center gap-2.5">
      <div className="inline-flex max-w-full items-center justify-center gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        {subTabs.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setSubPanel(key)}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${subPanel === key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>
      </div>

      {subPanel === 'heatmap' && <HeatmapSubPanel ctxGrade={ctxGrade} ctxSection={ctxSection} />}
      {subPanel === 'trends' && <TrendsSubPanel ctxGrade={ctxGrade} ctxSection={ctxSection} />}
      {subPanel === 'report' && <CohortReportSubPanel ctxGrade={ctxGrade} ctxSection={ctxSection} />}

      {subPanel === 'overview' && <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {summaryCards.map((c, i) => (
          <Motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-3 rounded-xl border p-3 ${c.card}`}>
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${c.tile}`}><c.icon className="size-5" /></span>
            <div>
              <p className="text-[12px] text-slate-600">{c.label}</p>
              <p className="text-lg font-bold leading-tight text-slate-900">{loading ? '—' : c.value}</p>
            </div>
          </Motion.div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-center gap-2 border-b border-slate-100 p-3">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 focus-within:border-blue-300">
            <Search className="size-3.5 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student by name or roll..." className="w-full bg-transparent text-[13px] outline-none placeholder:text-slate-400" />
          </div>
          <label className="relative flex items-center">
            <AlertCircle className="pointer-events-none absolute left-2.5 size-3.5 text-slate-500" />
            <select value={risk} onChange={(e) => setRisk(e.target.value)} className={selectCls} aria-label="Status">
              <option value="">All Status</option><option value="at_risk">At Risk</option><option value="safe">Safe</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
          </label>
          <label className="relative flex items-center">
            <BarChart2 className="pointer-events-none absolute left-2.5 size-3.5 text-slate-500" />
            <select value={engagement} onChange={(e) => setEngagement(e.target.value)} className={selectCls} aria-label="Engagement">
              <option value="">All Engagement</option>
              {engagementOptions.map((v) => <option key={v} value={v}>{titleCase(v)}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
          </label>
          <label className="relative flex items-center">
            <Clock className="pointer-events-none absolute left-2.5 size-3.5 text-slate-500" />
            <select value={pace} onChange={(e) => setPace(e.target.value)} className={selectCls} aria-label="Pace">
              <option value="">All Pace</option>
              {paceOptions.map((v) => <option key={v} value={v}>{titleCase(v)}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-slate-500" />
          </label>
          <span className="ml-auto text-[12px] text-slate-600">{rows.length} students</span>
        </div>

        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center gap-2 text-[13px] text-slate-500"><Loader2 className="size-5 animate-spin text-blue-600" /> Computing ML scores…</div>
        ) : rows.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
            <Brain className="mb-1.5 size-8 text-slate-300" />
            <p className="text-[13px] font-semibold text-slate-800">{data.length ? 'No students match these filters' : 'No student data found for this class.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="bg-slate-50/70 text-[11.5px] text-slate-500">
                  <th className="w-12 px-3 py-2 text-center font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 font-medium">Mastery</th>
                  <th className="px-3 py-2 font-medium">At-Risk</th>
                  <th className="px-3 py-2 font-medium">Engagement</th>
                  <th className="px-3 py-2 font-medium">Pace</th>
                  <th className="px-3 py-2 font-medium">Trend</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s, i) => {
                  const n = (current - 1) * pageSize + i + 1;
                  const m = Number(s.masteryAvg) || 0;
                  const tr = TREND_PILL(s.trend?.overallTrend);
                  return (
                    <tr key={String(s.studentId)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-3 py-1.5 text-center text-xs text-slate-500">{n}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2.5">
                          {photoUrlOf(s) ? (
                            <StudentPhoto student={{ name: s.name, profilePic: s.profilePic }} className="size-8 text-xs" />
                          ) : (
                            <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${ML_AVATAR[n % ML_AVATAR.length]}`}>{String(s.name || 'S').charAt(0).toUpperCase()}</span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-slate-900">{s.name}</p>
                            <p className="text-[11px] text-slate-500">Roll {s.roll ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-9 text-[12.5px] font-semibold ${m > 0 && m < 50 ? 'text-red-600' : 'text-slate-900'}`}>{m}%</span>
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${m >= 75 ? 'bg-emerald-500' : m >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${m}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.atRisk?.isAtRisk ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {s.atRisk?.isAtRisk ? <AlertTriangle className="size-3" /> : <CheckCircle className="size-3" />}
                          {s.atRisk?.isAtRisk ? 'At Risk' : 'Safe'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${ENGAGEMENT_PILL[s.engagement?.label] || 'bg-slate-100 text-slate-500'}`}>
                          <BarChart2 className="size-3" /> {s.engagement?.label ? titleCase(s.engagement.label) : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5 text-[12px] text-slate-700" title={s.pace?.paceLabel ? titleCase(s.pace.paceLabel) : undefined}>
                          <Clock className="size-3.5 text-slate-500" />
                          {s.engagement?.engagementScore ?? 0}/100
                        </div>
                        {s.pace?.paceLabel && <p className="text-[10px] text-slate-400">{titleCase(s.pace.paceLabel)}</p>}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium ${tr.cls}`}>
                          <tr.icon className="size-3.5" /> {tr.label}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <button type="button" onClick={() => setDetailStudent(s)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-[11.5px] font-medium text-blue-700 transition hover:bg-blue-100">
                          <Eye className="size-3.5" /> View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-3 py-2.5">
            <p className="text-[11.5px] text-slate-500">Showing {(current - 1) * pageSize + 1} to {Math.min(current * pageSize, rows.length)} of {rows.length} students</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
                Rows per page
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-[12px] text-slate-800 outline-none">
                  {[5, 10, 20, 50].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Previous page" className="flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
                {Array.from({ length: pageCount }, (_, k) => k + 1)
                  .filter((p) => pageCount <= 7 || p === 1 || p === pageCount || Math.abs(p - current) <= 1)
                  .map((p, k, arr) => (
                    <React.Fragment key={p}>
                      {k > 0 && p - arr[k - 1] > 1 && <span className="px-1 text-[11px] text-slate-400">…</span>}
                      <button type="button" onClick={() => setPage(p)} aria-current={p === current ? 'page' : undefined}
                        className={`flex size-7 items-center justify-center rounded-md text-[11.5px] font-semibold ${p === current ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{p}</button>
                    </React.Fragment>
                  ))}
                <button type="button" onClick={() => setPage(current + 1)} disabled={current === pageCount} aria-label="Next page" className="flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
              </div>
            </div>
          </div>
        )}
      </div>
      </>}

      {detailStudent && (
        <MLStudentDetailModal student={detailStudent} onClose={() => setDetailStudent(null)} />
      )}
    </div>
  );
};

export default StudentAnalyticsPortal;
