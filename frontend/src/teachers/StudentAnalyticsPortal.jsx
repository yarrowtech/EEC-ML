import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Users, Search, TrendingUp, TrendingDown, BarChart3, Award, Target,
  Calendar, Eye, FileText, AlertCircle, Minus, ChevronDown, ChevronRight, Loader2,
  X, RefreshCcw, AlertTriangle, Brain, BookOpen, Clock, Filter,
  Play, CheckCircle, XCircle, ArrowRight, ArrowUp, Lightbulb, Star,
  UserCheck, Activity, TrendingUp as TrendingUpIcon
} from 'lucide-react';

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
const StudentAnalyticsPortal = () => {
  const navigate = useNavigate();
  const { classId = 'current' } = useParams();
  const classLabel = formatClassLabel(classId);
  const [activeTab, setActiveTab] = useState('progress'); // 'progress' or 'intervention'

  // ─────────────────────────────────────────────────────────────────────────
  // PROGRESS TAB STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [classOptions, setClassOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [filters, setFilters] = useState({ grade: '', section: '', subject: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // INTERVENTION TAB STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [weakStudents, setWeakStudents] = useState([]);
  const [interventionFilters, setInterventionFilters] = useState({
    grade: '',
    section: '',
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
        fetch(`${API_BASE}/api/progress/students?${params}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/progress/analytics?${params}`, { headers: authHeaders() }),
      ]);

      if (studentsRes.ok) {
        const data = await studentsRes.json();
        setStudents(Array.isArray(data) ? data : []);
      } else {
        const fallbackRes = await fetch(`${API_BASE}/api/teacher/dashboard/students`, { headers: authHeaders() });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          setClassOptions((fallbackData.classes || []).map(c => typeof c === 'string' ? c : c.name));
          setSectionOptions((fallbackData.sections || []).map(s => typeof s === 'string' ? s : s.name));
          setStudents((fallbackData.students || []).map(s => ({
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
  // IDENTIFY WEAK STUDENTS (Students with overall score < 60%)
  // ─────────────────────────────────────────────────────────────────────────
  const identifyWeakStudents = useCallback((studentsList) => {
    const weak = studentsList
      .map(student => {
        const metrics = student.progressMetrics || [];

        // Calculate overall score
        const overallScore = metrics.length > 0
          ? Math.round(metrics.reduce((sum, m) => sum + (m.averageScore || 0), 0) / metrics.length)
          : 0;

        // Only include students with score < 60%
        if (overallScore >= 60) return null;

        // Determine intervention level based on score
        let interventionLevel = 'low';
        if (overallScore < 35) {
          interventionLevel = 'critical'; // < 35% = Critical
        } else if (overallScore < 45) {
          interventionLevel = 'high'; // 35-45% = High
        } else if (overallScore < 60) {
          interventionLevel = 'medium'; // 45-60% = Medium
        }

        // Calculate consistency score (based on variation in subject scores)
        const scores = metrics.map(m => m.averageScore || 0);
        const avgScore = scores.reduce((sum, s) => sum + s, 0) / (scores.length || 1);
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / (scores.length || 1);
        const consistencyScore = Math.max(0, 100 - Math.sqrt(variance));

        // Identify weak areas (subjects with score < 60%)
        const weakAreas = metrics
          .filter(m => (m.averageScore || 0) < 60)
          .map(m => m.subject);

        // Find focus subject (subject with lowest score)
        const focusSubject = metrics.length > 0
          ? metrics.reduce((lowest, m) =>
              (m.averageScore || 0) < (lowest.averageScore || 0) ? m : lowest
            ).subject
          : 'General';

        // Generate recommended topics based on weak subjects
        const recommendedTopics = weakAreas.slice(0, 3).map(subject =>
          `${subject} - Fundamental Concepts`
        );

        return {
          _id: student._id,
          studentId: student.studentId,
          interventionLevel,
          consistencyScore: Math.round(consistencyScore),
          focusSubject,
          weakAreas: weakAreas.length > 0 ? weakAreas : ['Needs comprehensive review'],
          recommendedTopics: recommendedTopics.length > 0 ? recommendedTopics : ['General academic support needed'],
          hasAIPath: false,
          overallScore
        };
      })
      .filter(Boolean); // Remove null values

    return weak;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH WEAK STUDENTS
  // ─────────────────────────────────────────────────────────────────────────
  const fetchWeakStudents = useCallback(async () => {
    try {
      setLoadingWeak(true);

      // Fetch students data if not already available
      if (students.length === 0) {
        const params = new URLSearchParams();
        if (interventionFilters.grade) params.set('grade', interventionFilters.grade);
        if (interventionFilters.section) params.set('section', interventionFilters.section);
        if (interventionFilters.subject) params.set('subject', interventionFilters.subject);

        const studentsRes = await fetch(`${API_BASE}/api/progress/students?${params}`, {
          headers: authHeaders()
        });

        if (studentsRes.ok) {
          const data = await studentsRes.json();
          const studentsList = Array.isArray(data) ? data : [];
          const weak = identifyWeakStudents(studentsList);

          // Apply intervention level filter if set
          const filteredWeak = interventionFilters.interventionLevel
            ? weak.filter(s => s.interventionLevel === interventionFilters.interventionLevel)
            : weak;

          setWeakStudents(filteredWeak);
        } else {
          // Fallback to empty array if API fails
          setWeakStudents([]);
        }
      } else {
        // Use existing students data
        let weak = identifyWeakStudents(students);

        // Apply filters
        if (interventionFilters.grade) {
          weak = weak.filter(s =>
            String(s.studentId?.grade || '').toLowerCase() === interventionFilters.grade.toLowerCase()
          );
        }
        if (interventionFilters.section) {
          weak = weak.filter(s =>
            String(s.studentId?.section || '').toLowerCase() === interventionFilters.section.toLowerCase()
          );
        }
        if (interventionFilters.subject) {
          weak = weak.filter(s =>
            s.weakAreas.some(area =>
              area.toLowerCase().includes(interventionFilters.subject.toLowerCase())
            )
          );
        }
        if (interventionFilters.interventionLevel) {
          weak = weak.filter(s => s.interventionLevel === interventionFilters.interventionLevel);
        }

        setWeakStudents(weak);
      }
    } catch (error) {
      console.error('Error identifying weak students:', error);
      setWeakStudents([]);
    } finally {
      setLoadingWeak(false);
    }
  }, [students, interventionFilters, identifyWeakStudents]);

  useEffect(() => {
    fetchProgressData();
  }, [fetchProgressData]);

  useEffect(() => {
    fetchWeakStudents();
  }, [fetchWeakStudents]);

  // Re-identify weak students whenever students data changes
  useEffect(() => {
    if (students.length > 0 && activeTab === 'intervention') {
      const weak = identifyWeakStudents(students);

      // Apply filters
      let filteredWeak = weak;
      if (interventionFilters.grade) {
        filteredWeak = filteredWeak.filter(s =>
          String(s.studentId?.grade || '').toLowerCase() === interventionFilters.grade.toLowerCase()
        );
      }
      if (interventionFilters.section) {
        filteredWeak = filteredWeak.filter(s =>
          String(s.studentId?.section || '').toLowerCase() === interventionFilters.section.toLowerCase()
        );
      }
      if (interventionFilters.subject) {
        filteredWeak = filteredWeak.filter(s =>
          s.weakAreas.some(area =>
            area.toLowerCase().includes(interventionFilters.subject.toLowerCase())
          )
        );
      }
      if (interventionFilters.interventionLevel) {
        filteredWeak = filteredWeak.filter(s => s.interventionLevel === interventionFilters.interventionLevel);
      }

      setWeakStudents(filteredWeak);
      setLoadingWeak(false);
    }
  }, [students, activeTab, interventionFilters, identifyWeakStudents]);

  // ─────────────────────────────────────────────────────────────────────────
  // ANALYZE STUDENT WEAKNESS
  // ─────────────────────────────────────────────────────────────────────────
  const analyzeStudentWeakness = async (studentId, subject) => {
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/ai-learning/analyze-weakness/${studentId}`, {
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
      const response = await fetch(`/api/ai-learning/generate-learning-path/${studentId}`, {
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
      student.studentId?.name?.toLowerCase().includes(interventionSearch.toLowerCase()) ||
      student.studentId?.roll?.toString().includes(interventionSearch)
    ),
    [weakStudents, interventionSearch]
  );

  const overallScore = (student) => {
    const metrics = student.progressMetrics || [];
    if (!metrics.length) return 0;
    return Math.round(metrics.reduce((sum, m) => sum + (m.averageScore || 0), 0) / metrics.length);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-[linear-gradient(145deg,#f0f6fb_0%,#e3ecf5_100%)] p-3 sm:p-5">
      <Motion.div
        initial={{ opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-[1200px] rounded-[2rem] border border-white/40 bg-white/35 p-4 shadow-[0_24px_48px_-16px_rgba(0,30,50,0.2),0_8px_24px_-6px_rgba(0,0,0,0.04)] backdrop-blur-xl sm:rounded-[2.8rem] sm:p-8"
      >
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 sm:mb-8">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-[-0.01em] text-[#0a2d40] sm:text-[1.8rem]">
              <Activity className="size-6 text-[#1f6d8a] sm:size-7" /> Class Analytics
            </h1>
            <span className="mt-1 inline-flex items-center rounded-full border border-white/30 bg-white/25 px-4 py-1 text-sm text-[#2f556b] backdrop-blur-sm">
              <span className="mr-1.5">⚑</span>{classLabel} · Full class performance &amp; progress
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-full border border-blue-300 bg-blue-100 p-1 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setActiveTab('progress')}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition ${activeTab === 'progress' ? 'bg-white/70 text-[#0a2f42] shadow-sm' : 'text-[#1f4359] hover:bg-white/40'}`}
              >
                <TrendingUpIcon className="size-3.5" /> Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('intervention')}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition ${activeTab === 'intervention' ? 'bg-white/70 text-[#0a2f42] shadow-sm' : 'text-[#1f4359] hover:bg-white/40'}`}
              >
                <Target className="size-3.5" /> Intervention
              </button>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/25 px-4 py-2 text-xs font-medium text-[#1a4055] backdrop-blur-sm">
              <Filter className="size-3.5" /> Filter
            </span>
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
            {activeTab === 'progress' ? (
              <ProgressTab
                filteredStudents={filteredStudents}
                analytics={analytics}
                filters={filters}
                setFilters={setFilters}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                loading={loading}
                error={error}
                setError={setError}
                selectedStudent={selectedStudent}
                setSelectedStudent={setSelectedStudent}
                setActiveTab={setActiveTab}
                fetchProgressData={fetchProgressData}
                classOptions={classOptions}
                sectionOptions={sectionOptions}
                overallScore={overallScore}
                classLabel={classLabel}
              />
            ) : (
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
              />
            )}
          </Motion.div>
        </AnimatePresence>
      </Motion.div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// PROGRESS TAB COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
const ProgressTab = ({
  filteredStudents, analytics, filters, setFilters,
  searchTerm, setSearchTerm, loading, error, setError,
  fetchProgressData, classOptions, sectionOptions, overallScore, classLabel,
  selectedStudent, setSelectedStudent, setActiveTab
}) => {
  const supportStudents = filteredStudents.filter((student) => overallScore(student) < 60);
  const averageFromMetrics = (field) => {
    const values = filteredStudents
      .flatMap((student) => student.progressMetrics || [])
      .map((metric) => Number(metric?.[field]))
      .filter((value) => Number.isFinite(value) && value > 0);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  };
  const averageScore = Number(analytics?.averageScore ?? 0) || (
    filteredStudents.length
      ? Math.round(filteredStudents.reduce((sum, student) => sum + overallScore(student), 0) / filteredStudents.length)
      : 0
  );
  const attendanceRate = Number(analytics?.attendanceRate ?? 0) || averageFromMetrics('attendanceRate');
  const assignmentPairs = filteredStudents
    .flatMap((student) => student.progressMetrics || [])
    .map((metric) => ({ completed: Number(metric?.completedAssignments), total: Number(metric?.totalAssignments) }))
    .filter((item) => item.total > 0);
  const assignmentCompletion = assignmentPairs.length
    ? Math.round((assignmentPairs.reduce((sum, item) => sum + item.completed, 0) / assignmentPairs.reduce((sum, item) => sum + item.total, 0)) * 100)
    : averageScore;
  const testPerformance = Number(analytics?.testPerformance ?? analytics?.assessmentAverage ?? 0) || averageFromMetrics('testPerformance') || averageScore;
  const progressItems = [
    { label: 'Overall class average', value: averageScore, tone: 'bg-gradient-to-r from-[#4a9bb5] to-[#2d7a94]' },
    { label: 'Attendance rate', value: attendanceRate, tone: 'bg-gradient-to-r from-[#4aad7a] to-[#2d8f5e]' },
    { label: 'Assignment completion', value: assignmentCompletion, tone: 'bg-gradient-to-r from-[#4a9bb5] to-[#2d7a94]' },
    { label: 'Test performance', value: testPerformance, tone: 'bg-gradient-to-r from-[#d98c4a] to-[#c47a3a]' },
  ];
  const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="space-y-5">
      {error && (
        <Motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50/70 px-4 py-2 text-xs text-red-700"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <p className="flex-1 font-medium">{error}</p>
          <button type="button" onClick={() => setError('')} className="rounded-full p-1 text-red-400 hover:bg-red-100 hover:text-red-600" aria-label="Dismiss error">
            <X className="size-3.5" />
          </button>
        </Motion.div>
      )}

      <Motion.div layout className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-white/30 bg-white/20 px-4 py-2.5 backdrop-blur-sm sm:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          <div className="flex min-w-0 items-center rounded-full border border-white/20 bg-white/25 pl-3 backdrop-blur-sm focus-within:bg-white/40">
            <Search className="size-3.5 shrink-0 text-[#3e6b82]" />
            <input
              type="text"
              placeholder="Search by name or roll..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-[150px] bg-transparent px-2 py-2 text-xs text-[#123b50] outline-none placeholder:text-[#4b788f]/60 focus:w-[190px] sm:w-[170px]"
            />
            <button type="button" className="rounded-full bg-white/30 px-2.5 py-1.5 text-[#1f4b62] hover:bg-white/50" aria-label="Search options">
              <ChevronDown className="size-3" />
            </button>
          </div>

          <label className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/20 px-3 py-1.5 text-xs text-[#1b445b] backdrop-blur-sm">
            <LayersIcon />
            <select value={filters.grade} onChange={(event) => setFilters((previous) => ({ ...previous, grade: event.target.value }))} className="max-w-[110px] bg-transparent outline-none">
              <option value="">All Grades</option>
              {classOptions.length > 0 ? classOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>) : ['9', '10', '11', '12'].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/20 px-3 py-1.5 text-xs text-[#1b445b] backdrop-blur-sm">
            <Users className="size-3.5" />
            <select value={filters.section} onChange={(event) => setFilters((previous) => ({ ...previous, section: event.target.value }))} className="max-w-[115px] bg-transparent outline-none">
              <option value="">All Sections</option>
              {sectionOptions.length > 0 ? sectionOptions.map((section) => <option key={section} value={section}>{section}</option>) : ['A', 'B', 'C'].map((section) => <option key={section} value={section}>Section {section}</option>)}
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/20 px-3 py-1.5 text-xs text-[#1b445b] backdrop-blur-sm">
            <BookOpen className="size-3.5" />
            <input value={filters.subject} onChange={(event) => setFilters((previous) => ({ ...previous, subject: event.target.value }))} placeholder="Subject (optional)" className="w-[122px] bg-transparent outline-none placeholder:text-[#4b788f]/70" />
          </label>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-[#1c4b63]">
          <UserCheck className="size-3.5" /> {analytics?.totalStudents ?? filteredStudents.length} Students
          <button type="button" onClick={fetchProgressData} disabled={loading} className="ml-1 rounded-full p-1 hover:bg-white/40 disabled:opacity-50" aria-label="Refresh progress data">
            <RefreshCcw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Motion.div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Motion.section
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="rounded-[2rem] border border-white/30 bg-white/20 p-5 backdrop-blur-md sm:p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-[#083142]">
              <Users className="size-4 text-[#1f6d8a]" /> Needs support
            </h2>
            <span className="rounded-full bg-white/30 px-3 py-1 text-xs text-[#1b4a62]">{supportStudents.length}</span>
          </div>

          {loading ? (
            <div className="flex min-h-[250px] flex-col items-center justify-center gap-2 text-sm text-[#3e6b82]">
              <Loader2 className="size-6 animate-spin text-[#1f6d8a]" /> Loading progress...
            </div>
          ) : supportStudents.length === 0 ? (
            <div className="flex min-h-[250px] flex-col items-center justify-center rounded-[1.5rem] bg-white/15 px-4 text-center text-sm text-[#3e6b82]">
              <CheckCircle className="mb-2 size-8 text-emerald-600" />
              No students currently need additional support.
            </div>
          ) : (
            <div className="space-y-1.5">
              {supportStudents.slice(0, 6).map((student, index) => {
                const score = overallScore(student);
                return (
                  <Motion.button
                    key={student._id}
                    type="button"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.045 }}
                    whileHover={{ x: 4, scale: 1.01 }}
                    onClick={() => setSelectedStudent(student)}
                    className="flex w-full items-center justify-between gap-3 rounded-full border border-white/10 bg-white/15 px-3 py-2 text-left transition hover:bg-white/35"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#c95a5a] to-[#b13a3a] text-xs font-bold text-white">
                        {(student.studentId?.name || 'S').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-[#0b3145]">
                          {student.studentId?.name || 'Unknown'}
                          <AlertCircle className="size-3 text-[#b13a3a]" />
                        </p>
                        <p className="text-[10px] text-[#3e6b82]/80">{classLabel} · Roll {student.studentId?.roll || '—'}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-red-100/70 px-2.5 py-1 text-xs font-semibold text-[#b13a3a]">{score}%</span>
                  </Motion.button>
                );
              })}
              {supportStudents.length > 6 && (
                <button type="button" onClick={() => setActiveTab('intervention')} className="mt-2 w-full rounded-full border border-dashed border-white/20 bg-white/5 px-3 py-2 text-[11px] text-[#2b5e78] transition hover:bg-white/20">
                  <ChevronRight className="mr-1 inline size-3.5" /> {supportStudents.length - 6} more students · view all
                </button>
              )}
            </div>
          )}
        </Motion.section>

        <Motion.section
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.12 }}
          className="rounded-[2rem] border border-white/30 bg-white/20 p-5 backdrop-blur-md sm:p-6"
        >
          <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#083142]">
            <BarChart3 className="size-4 text-[#1f6d8a]" /> Class Progress
            <span className="ml-auto rounded-full bg-white/20 px-3 py-1 text-[11px] font-normal text-[#1f4b62]">{classLabel} · {new Date().getFullYear()}</span>
          </div>

          <div className="space-y-4">
            {progressItems.map((item, index) => {
              const value = clampPercent(item.value);
              return (
                <div key={item.label}>
                  <div className="mb-1 flex justify-between text-xs text-[#1a4055]">
                    <span>{item.label}</span>
                    <span className="font-semibold text-[#0a2f42]">{value}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-white/20">
                    <Motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${value}%` }}
                      transition={{ duration: 0.8, delay: 0.18 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                      className={`h-full rounded-full ${item.tone}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-3">
            {[
              { value: `${averageScore}%`, label: 'class avg' },
              { value: analytics?.totalStudents ?? filteredStudents.length, label: 'students' },
              { value: supportStudents.length, label: 'at risk' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-white/10 px-2 py-2 text-center">
                <span className="block text-lg font-bold text-[#0a2f42]">{stat.value}</span>
                <span className="text-[9px] uppercase tracking-[0.03em] text-[#386f89]">{stat.label}</span>
              </div>
            ))}
          </div>
        </Motion.section>
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

const LayersIcon = () => <span aria-hidden="true" className="text-[11px]">▰</span>;

// ═════════════════════════════════════════════════════════════════════════════
// INTERVENTION TAB COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
const InterventionTab = ({
  filteredWeakStudents, interventionFilters, setInterventionFilters,
  interventionSearch, setInterventionSearch, loadingWeak, analyzing,
  selectedWeakStudent, setSelectedWeakStudent, analyzeStudentWeakness,
  generateLearningPath, navigate, classLabel
}) => {
  const priorityStats = [
    { key: 'critical', label: 'Critical Students', icon: AlertTriangle, iconClass: 'bg-[#fce8e8] text-[#b13a3a]' },
    { key: 'high', label: 'High Priority', icon: ArrowUp, iconClass: 'bg-[#f5ede4] text-[#b57a3a]' },
    { key: 'medium', label: 'Medium Priority', icon: Minus, iconClass: 'bg-[#e4edf2] text-[#3a7a94]' },
    { key: 'ai', label: 'With AI Paths', icon: Brain, iconClass: 'bg-[#ede8f5] text-[#6b5bb5]' },
  ];

  const updateFilter = (key, value) => setInterventionFilters((previous) => ({ ...previous, [key]: value }));
  const selectClass = 'rounded-full border border-[#e2e8ee] bg-white px-3 py-1.5 text-xs text-[#3a5a6e] outline-none transition focus:border-[#b0c8d8] focus:ring-2 focus:ring-[#3a7a94]/10';
  const actionClass = 'inline-flex items-center gap-1.5 rounded-full border-0 bg-[#f0f4f8] px-3 py-1.5 text-[11px] font-medium text-[#3a5a6e] transition hover:bg-[#e4eaf0] disabled:opacity-50';

  return (
    <div className="space-y-6 rounded-[2rem] border border-[#eaedf0] bg-white p-5 shadow-[0_4px_20px_rgba(0,20,30,0.06)] sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.01em] text-[#1a2e3f]">
            <span className="flex size-8 items-center justify-center rounded-full bg-[#e4edf2] text-[#3a7a94]"><AlertTriangle className="size-4" /></span>
            Intervention
          </h2>
          <span className="mt-1 inline-flex items-center rounded-full bg-[#f0f4f8] px-3 py-1 text-xs font-medium text-[#5a7a8e]">⚑ {classLabel} · Full class performance</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#e2e8ee] bg-[#f0f4f8] p-1">
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#1a2e3f] shadow-sm"><Users className="mr-1 inline size-3.5" /> Students</span>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="rounded-full px-3 py-1.5 text-xs font-medium text-[#4a6a7e] hover:bg-white/70"><BarChart3 className="mr-1 inline size-3.5" /> Analytics</button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {priorityStats.map((stat, index) => {
          const Icon = stat.icon;
          const count = stat.key === 'ai'
            ? filteredWeakStudents.filter((student) => student.hasAIPath).length
            : filteredWeakStudents.filter((student) => student.interventionLevel === stat.key).length;
          return (
            <Motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="flex items-center gap-3 rounded-[1.2rem] border border-[#eaedf0] bg-[#f8fafc] p-3 transition hover:border-[#dce2e8] hover:bg-[#f4f7fa] sm:p-4"
            >
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${stat.iconClass}`}><Icon className="size-4" /></div>
              <div>
                <p className="text-xl font-semibold leading-tight text-[#1a2e3f]">{count}</p>
                <p className="text-[10px] font-medium uppercase tracking-[0.04em] text-[#5a7a8e]">{stat.label}</p>
              </div>
            </Motion.div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-full border border-[#eaedf0] bg-[#f8fafc] px-3 py-2">
        <div className="flex min-w-[180px] flex-1 items-center rounded-full border border-[#e2e8ee] bg-white px-3 py-1.5 focus-within:border-[#b0c8d8] focus-within:ring-2 focus-within:ring-[#3a7a94]/10">
          <Search className="size-3.5 text-[#5a7a8e]/60" />
          <input value={interventionSearch} onChange={(event) => setInterventionSearch(event.target.value)} placeholder="Search students..." className="w-full bg-transparent px-2 text-xs text-[#1a2e3f] outline-none placeholder:text-[#8aa8ba]" />
        </div>
        <select value={interventionFilters.grade} onChange={(event) => updateFilter('grade', event.target.value)} className={selectClass}>
          <option value="">All Grades</option><option value="9">Grade 9</option><option value="10">Grade 10</option><option value="11">Grade 11</option><option value="12">Grade 12</option>
        </select>
        <select value={interventionFilters.section} onChange={(event) => updateFilter('section', event.target.value)} className={selectClass}>
          <option value="">All Sections</option><option value="A">Section A</option><option value="B">Section B</option><option value="C">Section C</option>
        </select>
        <select value={interventionFilters.subject} onChange={(event) => updateFilter('subject', event.target.value)} className={selectClass}>
          <option value="">All Subjects</option><option value="Mathematics">Mathematics</option><option value="Physics">Physics</option><option value="Chemistry">Chemistry</option><option value="Biology">Biology</option>
        </select>
        <select value={interventionFilters.interventionLevel} onChange={(event) => updateFilter('interventionLevel', event.target.value)} className={selectClass}>
          <option value="">All Levels</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <span className="rounded-full bg-[#f0f4f8] px-3 py-1.5 text-xs font-medium text-[#3a5a6e]">{filteredWeakStudents.length} students</span>
      </div>

      {loadingWeak ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 text-sm text-[#5a7a8e]">
          <Loader2 className="size-7 animate-spin text-[#3a7a94]" /> Analyzing weak students...
        </div>
      ) : filteredWeakStudents.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.4rem] bg-[#f8fafc] text-center">
          <CheckCircle className="mb-2 size-10 text-emerald-600" />
          <h3 className="text-base font-semibold text-[#1a2e3f]">Great News!</h3>
          <p className="mt-1 text-sm text-[#5a7a8e]">No students currently need immediate intervention.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredWeakStudents.map((student, index) => {
            const level = student.interventionLevel || 'medium';
            const priorityClass = level === 'critical'
              ? 'bg-[#fce8e8] text-[#b13a3a]'
              : level === 'high'
                ? 'bg-[#f5ede4] text-[#b57a3a]'
                : 'bg-[#e4edf2] text-[#3a7a94]';
            const studentId = student.studentId?._id || student.studentId?.id;
            return (
              <Motion.article
                key={student._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.045 }}
                whileHover={{ y: -2 }}
                className="rounded-[1.4rem] border border-[#eaedf0] bg-[#fafbfc] p-4 transition hover:border-[#d0d8e0] hover:bg-white hover:shadow-[0_2px_12px_rgba(0,20,30,0.04)] sm:p-5"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1a2e3f]">{student.studentId?.name || 'Unknown'}</p>
                    <span className="mt-1 inline-flex rounded-full bg-[#f0f4f8] px-2.5 py-0.5 text-[10px] text-[#5a7a8e]">{classLabel} · Roll {student.studentId?.roll || '—'}</span>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] ${priorityClass}`}>
                    <span className="mr-1">●</span>{level}
                  </span>
                </div>

                <div className="my-2 flex flex-wrap gap-x-5 gap-y-2 border-y border-[#eaedf0] py-2">
                  <div><p className="text-[9px] font-medium uppercase tracking-[0.04em] text-[#5a7a8e]">Consistency</p><p className="text-sm font-semibold text-[#b13a3a]">{student.consistencyScore || 0}%</p></div>
                  <div><p className="text-[9px] font-medium uppercase tracking-[0.04em] text-[#5a7a8e]">Focus Subject</p><p className="text-sm font-semibold text-[#1a2e3f]">{student.focusSubject || 'General'}</p></div>
                </div>

                <span className="inline-flex max-w-full items-center rounded-full bg-[#f0f4f8] px-3 py-1 text-[11px] text-[#4a6a7e]">
                  <AlertCircle className="mr-1.5 size-3 text-[#b13a3a]" />
                  <span className="truncate">{student.weakAreas?.slice(0, 2).join(', ') || 'Needs comprehensive review'}</span>
                </span>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => studentId && analyzeStudentWeakness(studentId, student.focusSubject || 'Mathematics')} disabled={analyzing || !studentId} className={actionClass}>
                    <RefreshCcw className={`size-3 ${analyzing ? 'animate-spin' : ''}`} /> {analyzing ? 'Analyzing...' : 'Re-analyze'}
                  </button>
                  <button type="button" onClick={() => studentId && generateLearningPath(studentId, student.focusSubject || 'Mathematics', student.weakAreas || [], 'basic')} disabled={!studentId} className={`${actionClass} bg-[#ede8f5] text-[#6b5bb5] hover:bg-[#e4dcee]`}>
                    <Brain className="size-3" /> Generate AI Path
                  </button>
                  <button type="button" onClick={() => setSelectedWeakStudent(student)} className={`${actionClass} bg-[#e4edf2] text-[#2a5a72] hover:bg-[#d4e0e8]`}>
                    <ChevronRight className="size-3" /> View
                  </button>
                  {student.hasAIPath && studentId && (
                    <button type="button" onClick={() => navigate(`/teacher/classes/current/students/${studentId}/ai-learning/${student.focusSubject || 'Mathematics'}`)} className={`${actionClass} bg-[#ede8f5] text-[#6b5bb5]`}>
                      <Play className="size-3" /> AI Path
                    </button>
                  )}
                </div>
              </Motion.article>
            );
          })}
        </div>
      )}

      {selectedWeakStudent && (
        <WeakStudentDetailModal
          student={selectedWeakStudent}
          onClose={() => setSelectedWeakStudent(null)}
          generateLearningPath={generateLearningPath}
        />
      )}
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

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/progress/student/${student._id}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Unable to load student details');
        const data = await res.json();
        setDetail(data);
      } catch {
        setDetail(student);
        setError('Some details may be unavailable.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [student._id]);

  const data = detail || student;
  const metrics = data.progressMetrics || [];
  const submissions = data.submissions || [];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border-[2.5px] border-purple-300" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-purple-100 px-6 py-5 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white text-lg font-black">
              {(data.studentId?.name || data.name || 'S').charAt(0)}
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">{data.studentId?.name || data.name || 'Student'}</h2>
              <p className="text-sm text-gray-500">
                Grade {data.studentId?.grade || data.grade || '—'}
                {(data.studentId?.section || data.section) ? `-${data.studentId?.section || data.section}` : ''} &nbsp;·&nbsp;
                Roll {data.studentId?.roll || data.rollNumber || '—'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-purple-500" />
            </div>
          ) : (
            <>
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-4">Subject Performance</h3>
                {metrics.length === 0 ? (
                  <p className="text-sm text-gray-500">No performance data yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {metrics.map((metric, i) => (
                      <div key={i} className="bg-purple-50 rounded-xl border-[2px] border-purple-200 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-bold text-gray-800">{metric.subject}</p>
                          <span className={`text-sm font-black ${getScoreColor(metric.averageScore)}`}>{metric.averageScore}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-3">
                          <div className={`h-full rounded-full transition-all ${getBarColor(metric.averageScore)}`} style={{ width: `${metric.averageScore}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Assignments: {metric.completedAssignments ?? '—'}/{metric.totalAssignments ?? '—'}</span>
                          <span>Attendance: {metric.attendanceRate ?? '—'}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {submissions.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Recent Submissions</h3>
                  <div className="divide-y divide-purple-100 rounded-xl border-[2px] border-purple-200 overflow-hidden">
                    {submissions.slice(0, 6).map((sub, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-purple-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-1.5 rounded-lg bg-purple-100">
                            <FileText size={13} className="text-purple-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {sub.assignmentId?.title || `Assignment ${i + 1}`}
                            </p>
                            <p className="text-xs text-gray-500">
                              {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '—'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span className={`text-sm font-black ${getScoreColor(sub.score ?? 0)}`}>{sub.score ?? '—'}%</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            sub.status === 'graded' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                            sub.status === 'submitted' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                            sub.status === 'late' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                            'text-red-700 bg-red-50 border-red-200'
                          } capitalize`}>
                            {sub.status || 'pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// WEAK STUDENT DETAIL MODAL
// ═════════════════════════════════════════════════════════════════════════════
const WeakStudentDetailModal = ({ student, onClose, generateLearningPath }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-[2.5px] border-purple-300" onClick={(e) => e.stopPropagation()}>
      <div className="p-6 border-b border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center text-white text-xl font-semibold">
              {student.studentId?.name?.charAt(0) || 'S'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{student.studentId?.name}</h2>
              <p className="text-gray-600">Grade {student.studentId?.grade}-{student.studentId?.section} • Roll {student.studentId?.roll}</p>
              <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium mt-2 border ${getInterventionColor(student.interventionLevel)}`}>
                {getInterventionIcon(student.interventionLevel)}
                <span className="capitalize">{student.interventionLevel} Intervention Needed</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
              Weakness Analysis
            </h3>
            <div className="space-y-4">
              <div className="bg-red-50 rounded-xl p-4 border-[2px] border-red-200">
                <h4 className="font-medium text-red-800 mb-2">Consistency Score</h4>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 bg-red-200 rounded-full h-3">
                    <div
                      className="bg-red-600 h-3 rounded-full"
                      style={{ width: `${student.consistencyScore || 0}%` }}
                    ></div>
                  </div>
                  <span className="font-bold text-red-800">{student.consistencyScore || 0}%</span>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-2">Weak Areas</h4>
                <div className="flex flex-wrap gap-2">
                  {(student.weakAreas || []).map((area, index) => (
                    <span key={index} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      {area}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-2">Recommended Topics</h4>
                <div className="space-y-2">
                  {(student.recommendedTopics || []).map((topic, index) => (
                    <div key={index} className="flex items-center space-x-2 text-sm text-gray-700">
                      <Lightbulb className="w-4 h-4 text-yellow-500" />
                      <span>{topic}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Brain className="w-5 h-5 mr-2 text-blue-600" />
              AI Learning Path
            </h3>
            {student.hasAIPath ? (
              <div className="bg-blue-50 rounded-xl p-4 border-[2px] border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-blue-800 font-medium">Learning Path Active</span>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-sm text-blue-700 mb-3">
                  Personalized learning path has been generated based on weakness analysis.
                </p>
                <button className="w-full bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition-colors font-semibold">
                  View Learning Path
                </button>
              </div>
            ) : (
              <div className="bg-purple-50 rounded-xl p-4 text-center border-[2px] border-purple-200">
                <Brain className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                <p className="text-gray-600 mb-3">No AI learning path generated yet</p>
                <button
                  onClick={() => generateLearningPath(
                    student.studentId._id,
                    student.focusSubject || 'Mathematics',
                    student.weakAreas || [],
                    'basic'
                  )}
                  className="bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-colors font-semibold"
                >
                  Generate AI Learning Path
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default StudentAnalyticsPortal;
