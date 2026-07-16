import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, TrendingUp, TrendingDown, BarChart3, Award, Target,
  Calendar, Eye, FileText, AlertCircle, Minus, ChevronRight, Loader2,
  X, RefreshCcw, AlertTriangle, Brain, BookOpen, Clock, Filter,
  Play, CheckCircle, XCircle, ArrowRight, Lightbulb, Star,
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
const getGradeColor = (grade) => ({
  'A+': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'A': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'B+': 'text-blue-700 bg-blue-50 border-blue-200',
  'B': 'text-blue-700 bg-blue-50 border-blue-200',
  'C+': 'text-amber-700 bg-amber-50 border-amber-200',
  'C': 'text-amber-700 bg-amber-50 border-amber-200',
  'D': 'text-orange-700 bg-orange-50 border-orange-200',
  'F': 'text-red-700 bg-red-50 border-red-200',
}[grade] || 'text-gray-600 bg-gray-50 border-gray-200');

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

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
const StudentAnalyticsPortal = () => {
  const navigate = useNavigate();
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
  const [progressViewMode, setProgressViewMode] = useState('overview');

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
    <div className="min-h-screen bg-slate-50">
      {/* Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-700 via-indigo-600 to-indigo-500 text-white">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.15) 0, transparent 55%)' }} />
        <div className="relative px-4 md:px-6 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Student Analytics</h1>
              <p className="text-white/80 text-sm mt-1">Track progress and identify students needing support</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-white/20 pb-4">
            <button
              onClick={() => setActiveTab('progress')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl font-semibold text-sm transition-all ${
                activeTab === 'progress'
                  ? 'bg-white text-purple-700 shadow-lg'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              <TrendingUpIcon className="w-4 h-4" />
              Progress Overview
            </button>
            <button
              onClick={() => setActiveTab('intervention')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl font-semibold text-sm transition-all ${
                activeTab === 'intervention'
                  ? 'bg-white text-purple-700 shadow-lg'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Intervention Tracking
            </button>
          </div>
        </div>
      </section>

      {/* Content Area */}
      <div className="p-4 md:p-6 space-y-6">
        {/* Tab Content */}
        {activeTab === 'progress' ? (
          <ProgressTab
            students={students}
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
            progressViewMode={progressViewMode}
            setProgressViewMode={setProgressViewMode}
            fetchProgressData={fetchProgressData}
            classOptions={classOptions}
            sectionOptions={sectionOptions}
            overallScore={overallScore}
          />
        ) : (
          <InterventionTab
            weakStudents={weakStudents}
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
          />
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// PROGRESS TAB COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
const ProgressTab = ({
  students, filteredStudents, analytics, filters, setFilters,
  searchTerm, setSearchTerm, loading, error, setError,
  selectedStudent, setSelectedStudent, progressViewMode, setProgressViewMode,
  fetchProgressData, classOptions, sectionOptions, overallScore
}) => (
  <div className="space-y-6">
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

    {/* Analytics Cards */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: 'Total Students', value: analytics?.totalStudents ?? students.length, sub: 'in your classes', icon: Users, gradient: 'from-purple-500 to-indigo-500' },
        { label: 'Average Score', value: analytics?.averageScore != null ? `${analytics.averageScore}%` : '—', sub: 'across subjects', icon: Target, gradient: 'from-blue-500 to-cyan-500' },
        { label: 'Need Help', value: students.filter(s => overallScore(s) < 60).length, sub: 'scoring below 60%', icon: AlertTriangle, gradient: 'from-red-500 to-orange-500' },
        { label: 'Improving', value: analytics?.improvementTrends?.improving ?? '—', sub: 'students trending up', icon: TrendingUp, gradient: 'from-green-500 to-emerald-500' },
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
          <p className="text-xs text-gray-400 mt-2">{stat.sub}</p>
        </div>
      ))}
    </div>

    {/* Filters */}
    <div className="bg-white rounded-2xl border-[2.5px] border-purple-300 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900">Filter Students</h3>
        <button
          onClick={fetchProgressData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-[2px] border-purple-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCcw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or roll..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-colors"
          />
        </div>
        <select
          value={filters.grade}
          onChange={(e) => setFilters(f => ({ ...f, grade: e.target.value }))}
          className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-colors"
        >
          <option value="">All Grades</option>
          {classOptions.length > 0
            ? classOptions.map(c => <option key={c} value={c}>{c}</option>)
            : ['9', '10', '11', '12'].map(g => <option key={g} value={g}>Grade {g}</option>)}
        </select>
        <select
          value={filters.section}
          onChange={(e) => setFilters(f => ({ ...f, section: e.target.value }))}
          className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-colors"
        >
          <option value="">All Sections</option>
          {sectionOptions.length > 0
            ? sectionOptions.map(s => <option key={s} value={s}>{s}</option>)
            : ['A', 'B', 'C'].map(s => <option key={s} value={s}>Section {s}</option>)}
        </select>
        <input
          type="text"
          placeholder="Subject (optional)"
          value={filters.subject}
          onChange={(e) => setFilters(f => ({ ...f, subject: e.target.value }))}
          className="w-full px-3 py-2 text-sm bg-gray-50 border-[2px] border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-colors"
        />
      </div>
    </div>

    {/* Student Table */}
    <div className="bg-white rounded-2xl border-[2.5px] border-purple-300 overflow-hidden">
      <div className="px-5 py-4 border-b border-purple-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-base font-bold text-gray-900">
          {filteredStudents.length} Student{filteredStudents.length !== 1 ? 's' : ''}
        </h2>
        <div className="flex gap-1.5 bg-purple-100 p-1 rounded-lg w-fit">
          {['overview', 'detailed'].map(tab => (
            <button
              key={tab}
              onClick={() => setProgressViewMode(tab)}
              className={`px-4 py-1.5 rounded-md text-xs font-bold capitalize transition-colors ${
                progressViewMode === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={24} className="animate-spin text-purple-500" />
          <p className="text-sm text-gray-500">Loading student progress...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="p-4 rounded-2xl bg-purple-100">
            <Users size={22} className="text-purple-500" />
          </div>
          <p className="text-sm font-semibold text-gray-600">No students found</p>
          <p className="text-xs text-gray-400">Try adjusting your filters</p>
        </div>
      ) : progressViewMode === 'overview' ? (
        <div className="divide-y divide-purple-50">
          {filteredStudents.map((student) => {
            const score = overallScore(student);
            const needsIntervention = score < 60;
            const interventionLevel = score < 35 ? 'critical' : score < 45 ? 'high' : 'medium';

            return (
              <div key={student._id} className={`flex items-center justify-between gap-4 px-5 py-4 hover:bg-purple-50/60 transition-colors ${needsIntervention ? 'bg-red-50/30' : ''}`}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0 ${needsIntervention ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-purple-600 to-indigo-600'}`}>
                    {(student.studentId?.name || 'S').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900 truncate">{student.studentId?.name || 'Unknown'}</p>
                      {needsIntervention && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${getInterventionColor(interventionLevel)}`}>
                          {getInterventionIcon(interventionLevel)}
                          <span className="capitalize">Needs Help</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Grade {student.studentId?.grade || '—'}
                      {student.studentId?.section ? `-${student.studentId.section}` : ''}
                      &nbsp;·&nbsp;Roll {student.studentId?.roll || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-5 shrink-0">
                  <div className="text-center hidden sm:block">
                    <p className="text-xs text-gray-500">Score</p>
                    <p className={`text-sm font-black mt-0.5 ${getScoreColor(score)}`}>{score}%</p>
                  </div>
                  {student.overallGrade && (
                    <span className={`hidden sm:inline-flex text-xs font-bold px-2 py-1 rounded-md border ${getGradeColor(student.overallGrade)}`}>
                      {student.overallGrade}
                    </span>
                  )}
                  <TrendIcon trend={student.improvementTrend} />
                  <button
                    onClick={() => setSelectedStudent(student)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <Eye size={14} /> Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-purple-50 border-b border-purple-100">
                <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Overall</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Grade</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Trend</th>
                {[...new Set(filteredStudents.flatMap(s => (s.progressMetrics || []).map(m => m.subject)))].slice(0, 3).map(subj => (
                  <th key={subj} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">{subj}</th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-50">
              {filteredStudents.map((student) => {
                const score = overallScore(student);
                const needsIntervention = score < 60;
                const interventionLevel = score < 35 ? 'critical' : score < 45 ? 'high' : 'medium';
                const subjects = [...new Set(filteredStudents.flatMap(s => (s.progressMetrics || []).map(m => m.subject)))].slice(0, 3);
                return (
                  <tr key={student._id} className={`hover:bg-purple-50/60 transition-colors ${needsIntervention ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0 ${needsIntervention ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-purple-600 to-indigo-600'}`}>
                          {(student.studentId?.name || 'S').charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-900">{student.studentId?.name || '—'}</p>
                            {needsIntervention && (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${getInterventionColor(interventionLevel)}`}>
                                {getInterventionIcon(interventionLevel)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">Roll {student.studentId?.roll || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-black ${getScoreColor(score)}`}>{score}%</span>
                    </td>
                    <td className="px-4 py-3">
                      {student.overallGrade ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getGradeColor(student.overallGrade)}`}>
                          {student.overallGrade}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <TrendIcon trend={student.improvementTrend} />
                    </td>
                    {subjects.map(subj => {
                      const metric = (student.progressMetrics || []).find(m => m.subject === subj);
                      return (
                        <td key={subj} className="px-4 py-3">
                          <span className={`font-semibold ${getScoreColor(metric?.averageScore ?? 0)}`}>
                            {metric?.averageScore != null ? `${metric.averageScore}%` : '—'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedStudent(student)}
                        className="text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* Student Detail Modal */}
    {selectedStudent && (
      <StudentDetailModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    )}
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// INTERVENTION TAB COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
const InterventionTab = ({
  weakStudents, filteredWeakStudents, interventionFilters, setInterventionFilters,
  interventionSearch, setInterventionSearch, loadingWeak, analyzing,
  selectedWeakStudent, setSelectedWeakStudent, analyzeStudentWeakness,
  generateLearningPath, navigate
}) => (
  <div className="space-y-6">
    {/* Statistics Cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-red-500 border-[2.5px] border-t-purple-300 border-r-purple-300 border-b-purple-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Critical Students</p>
            <p className="text-2xl font-bold text-red-600">
              {filteredWeakStudents.filter(s => s.interventionLevel === 'critical').length}
            </p>
          </div>
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-orange-500 border-[2.5px] border-t-purple-300 border-r-purple-300 border-b-purple-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">High Priority</p>
            <p className="text-2xl font-bold text-orange-600">
              {filteredWeakStudents.filter(s => s.interventionLevel === 'high').length}
            </p>
          </div>
          <AlertCircle className="w-8 h-8 text-orange-500" />
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-yellow-500 border-[2.5px] border-t-purple-300 border-r-purple-300 border-b-purple-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Medium Priority</p>
            <p className="text-2xl font-bold text-yellow-600">
              {filteredWeakStudents.filter(s => s.interventionLevel === 'medium').length}
            </p>
          </div>
          <AlertTriangle className="w-8 h-8 text-yellow-500" />
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-blue-500 border-[2.5px] border-t-purple-300 border-r-purple-300 border-b-purple-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">With AI Paths</p>
            <p className="text-2xl font-bold text-blue-600">
              {filteredWeakStudents.filter(s => s.hasAIPath).length}
            </p>
          </div>
          <Brain className="w-8 h-8 text-blue-500" />
        </div>
      </div>
    </div>

    {/* Filters */}
    <div className="bg-white rounded-2xl shadow-sm border-[2.5px] border-purple-300 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4">Filter Students</h3>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search students..."
            value={interventionSearch}
            onChange={(e) => setInterventionSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border-[2px] border-purple-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
          />
        </div>
        <select
          value={interventionFilters.grade}
          onChange={(e) => setInterventionFilters({ ...interventionFilters, grade: e.target.value })}
          className="border-[2px] border-purple-200 bg-gray-50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
        >
          <option value="">All Grades</option>
          <option value="9">Grade 9</option>
          <option value="10">Grade 10</option>
          <option value="11">Grade 11</option>
          <option value="12">Grade 12</option>
        </select>
        <select
          value={interventionFilters.section}
          onChange={(e) => setInterventionFilters({ ...interventionFilters, section: e.target.value })}
          className="border-[2px] border-purple-200 bg-gray-50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
        >
          <option value="">All Sections</option>
          <option value="A">Section A</option>
          <option value="B">Section B</option>
          <option value="C">Section C</option>
        </select>
        <select
          value={interventionFilters.subject}
          onChange={(e) => setInterventionFilters({ ...interventionFilters, subject: e.target.value })}
          className="border-[2px] border-purple-200 bg-gray-50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
        >
          <option value="">All Subjects</option>
          <option value="Mathematics">Mathematics</option>
          <option value="Physics">Physics</option>
          <option value="Chemistry">Chemistry</option>
          <option value="Biology">Biology</option>
        </select>
        <select
          value={interventionFilters.interventionLevel}
          onChange={(e) => setInterventionFilters({ ...interventionFilters, interventionLevel: e.target.value })}
          className="border-[2px] border-purple-200 bg-gray-50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
        >
          <option value="">All Levels</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
    </div>

    {/* Students List */}
    <div className="bg-white rounded-2xl shadow-sm border-[2.5px] border-purple-300">
      <div className="p-5 border-b border-purple-100">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
          Students Needing Intervention ({filteredWeakStudents.length})
        </h2>
      </div>

      <div className="p-5">
        {loadingWeak ? (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
            <p className="text-gray-600">Analyzing weak students...</p>
          </div>
        ) : filteredWeakStudents.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-800 mb-2">Great News!</h3>
            <p className="text-gray-600">No students currently need immediate intervention.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredWeakStudents.map((student) => (
              <div key={student._id} className="border-[2px] border-purple-200 rounded-2xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center text-white font-semibold">
                      {student.studentId?.name?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{student.studentId?.name || 'Unknown'}</h3>
                      <p className="text-sm text-gray-500">
                        Grade {student.studentId?.grade}-{student.studentId?.section} • Roll {student.studentId?.roll}
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center space-x-2 ${getInterventionColor(student.interventionLevel)}`}>
                    {getInterventionIcon(student.interventionLevel)}
                    <span className="capitalize">{student.interventionLevel}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                    <div className="flex items-center space-x-2 mb-1">
                      <Target className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-gray-700">Consistency Score</span>
                    </div>
                    <p className="text-lg font-bold text-gray-800">{student.consistencyScore || 0}%</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                    <div className="flex items-center space-x-2 mb-1">
                      <BookOpen className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-gray-700">Focus Subject</span>
                    </div>
                    <p className="font-medium text-gray-800">{student.focusSubject || 'General'}</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                    <div className="flex items-center space-x-2 mb-1">
                      <TrendingDown className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-gray-700">Weak Areas</span>
                    </div>
                    <p className="text-sm text-gray-600">{student.weakAreas?.slice(0, 2).join(', ') || 'Analysis needed'}</p>
                  </div>
                </div>

                {student.weakAreas && student.weakAreas.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Identified Weak Areas:</h4>
                    <div className="flex flex-wrap gap-2">
                      {student.weakAreas.map((area, index) => (
                        <span key={index} className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => analyzeStudentWeakness(student.studentId._id, student.focusSubject || 'Mathematics')}
                    disabled={analyzing}
                    className="px-3 py-2 bg-yellow-600 text-white rounded-xl hover:bg-yellow-700 disabled:bg-yellow-400 transition-colors flex items-center space-x-2 text-xs font-semibold"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>{analyzing ? 'Analyzing...' : 'Re-analyze'}</span>
                  </button>
                  <button
                    onClick={() => generateLearningPath(
                      student.studentId._id,
                      student.focusSubject || 'Mathematics',
                      student.weakAreas || [],
                      'basic'
                    )}
                    className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center space-x-2 text-xs font-semibold"
                  >
                    <Brain className="w-4 h-4" />
                    <span>Generate AI Path</span>
                  </button>
                  <button
                    onClick={() => setSelectedWeakStudent(student)}
                    className="px-3 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors flex items-center space-x-2 text-xs font-semibold"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>View Details</span>
                  </button>
                  {student.hasAIPath && (
                    <button
                      onClick={() => navigate(`/teacher/classes/current/students/${student.studentId._id}/ai-learning/${student.focusSubject || 'Mathematics'}`)}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center space-x-2 text-xs font-semibold"
                    >
                      <Play className="w-4 h-4" />
                      <span>View AI Path</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Student Detail Modal */}
    {selectedWeakStudent && (
      <WeakStudentDetailModal
        student={selectedWeakStudent}
        onClose={() => setSelectedWeakStudent(null)}
        generateLearningPath={generateLearningPath}
      />
    )}
  </div>
);

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
      } catch (err) {
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
