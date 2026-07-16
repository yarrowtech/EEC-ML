import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  TrendingDown,
  Brain,
  Target,
  BookOpen,
  Clock,
  BarChart3,
  Users,
  Filter,
  Search,
  Play,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowRight,
  Lightbulb,
  Star,
  ChevronRight
} from 'lucide-react';

const WeakStudentIdentification = () => {
  const navigate = useNavigate();
  const [weakStudents, setWeakStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [filters, setFilters] = useState({
    grade: '',
    section: '',
    subject: '',
    interventionLevel: ''
  });
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchWeakStudents();
  }, [filters]);

  const fetchWeakStudents = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ai-learning/weak-students?${new URLSearchParams(filters)}`);
      if (response.ok) {
        const data = await response.json();
        setWeakStudents(data);
      } else {
        // Mock data for development
        setWeakStudents(mockWeakStudents);
      }
    } catch (error) {
      console.error('Error fetching weak students:', error);
      setWeakStudents(mockWeakStudents);
    } finally {
      setLoading(false);
    }
  };

  const analyzeStudentWeakness = async (studentId, subject) => {
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/ai-learning/analyze-weakness/${studentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subject })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Analysis completed! Intervention level: ${result.interventionLevel}`);
        fetchWeakStudents(); // Refresh the list
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

  const generateLearningPath = async (studentId, subject, weakAreas, currentLevel) => {
    try {
      const response = await fetch(`/api/ai-learning/generate-learning-path/${studentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subject, weakAreas, currentLevel })
      });

      if (response.ok) {
        await response.json();
        alert('AI Learning Path generated successfully!');
        // You could navigate to the learning path or show it in a modal
        setSelectedStudent(prev => ({
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

  const getInterventionColor = (level) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default: return 'text-blue-600 bg-blue-100 border-blue-200';
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

  const filteredStudents = weakStudents.filter(student =>
    student.studentId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentId?.roll?.toString().includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Analyzing weak students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-6 mb-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center">
              <AlertTriangle className="w-8 h-8 mr-3" />
              Weak Student Identification
            </h1>
            <p className="text-red-100">Identify students needing intervention and provide personalized AI learning</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="bg-red-500 px-3 py-1 rounded-full text-sm">
              {filteredStudents.length} students need attention
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <select
            value={filters.grade}
            onChange={(e) => setFilters({ ...filters, grade: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">All Grades</option>
            <option value="9">Grade 9</option>
            <option value="10">Grade 10</option>
            <option value="11">Grade 11</option>
            <option value="12">Grade 12</option>
          </select>
          <select
            value={filters.section}
            onChange={(e) => setFilters({ ...filters, section: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">All Sections</option>
            <option value="A">Section A</option>
            <option value="B">Section B</option>
            <option value="C">Section C</option>
          </select>
          <select
            value={filters.subject}
            onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">All Subjects</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Biology">Biology</option>
          </select>
          <select
            value={filters.interventionLevel}
            onChange={(e) => setFilters({ ...filters, interventionLevel: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">All Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Critical Students</p>
              <p className="text-2xl font-bold text-red-600">
                {filteredStudents.filter(s => s.interventionLevel === 'critical').length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">High Priority</p>
              <p className="text-2xl font-bold text-orange-600">
                {filteredStudents.filter(s => s.interventionLevel === 'high').length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Medium Priority</p>
              <p className="text-2xl font-bold text-yellow-600">
                {filteredStudents.filter(s => s.interventionLevel === 'medium').length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">With AI Paths</p>
              <p className="text-2xl font-bold text-blue-600">
                {filteredStudents.filter(s => s.hasAIPath).length}
              </p>
            </div>
            <Brain className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <Users className="w-5 h-5 mr-2 text-red-600" />
            Students Needing Intervention
          </h2>
        </div>

        <div className="p-6">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-800 mb-2">Great News!</h3>
              <p className="text-gray-600">No students currently need immediate intervention.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStudents.map((student) => (
                <div key={student._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center text-white font-semibold">
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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-1">
                        <Target className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Consistency Score</span>
                      </div>
                      <p className="text-lg font-bold text-gray-800">{student.consistencyScore || 0}%</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-1">
                        <BookOpen className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Focus Subject</span>
                      </div>
                      <p className="font-medium text-gray-800">{student.focusSubject || 'General'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-1">
                        <TrendingDown className="w-4 h-4 text-gray-600" />
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
                          <span key={index} className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => analyzeStudentWeakness(student.studentId._id, student.focusSubject || 'Mathematics')}
                      disabled={analyzing}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-yellow-400 transition-colors flex items-center space-x-2 text-sm"
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
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 text-sm"
                    >
                      <Brain className="w-4 h-4" />
                      <span>Generate AI Learning Path</span>
                    </button>
                    <button
                      onClick={() => setSelectedStudent(student)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 text-sm"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <span>View Details</span>
                    </button>
                    {student.hasAIPath && (
                      <button
                        onClick={() => navigate(`/teacher/classes/current/students/${student.studentId._id}/ai-learning/${student.focusSubject || 'Mathematics'}`)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 text-sm"
                      >
                        <Brain className="w-4 h-4" />
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
      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center text-white text-xl font-semibold">
                    {selectedStudent.studentId?.name?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">{selectedStudent.studentId?.name}</h2>
                    <p className="text-gray-600">Grade {selectedStudent.studentId?.grade}-{selectedStudent.studentId?.section} • Roll {selectedStudent.studentId?.roll}</p>
                    <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium mt-2 ${getInterventionColor(selectedStudent.interventionLevel)}`}>
                      {getInterventionIcon(selectedStudent.interventionLevel)}
                      <span className="capitalize">{selectedStudent.interventionLevel} Intervention Needed</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Weakness Analysis */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                    Weakness Analysis
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-red-50 rounded-lg p-4">
                      <h4 className="font-medium text-red-800 mb-2">Consistency Score</h4>
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 bg-red-200 rounded-full h-3">
                          <div 
                            className="bg-red-600 h-3 rounded-full" 
                            style={{ width: `${selectedStudent.consistencyScore || 0}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-red-800">{selectedStudent.consistencyScore || 0}%</span>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Weak Areas</h4>
                      <div className="flex flex-wrap gap-2">
                        {(selectedStudent.weakAreas || []).map((area, index) => (
                          <span key={index} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Recommended Topics</h4>
                      <div className="space-y-2">
                        {(selectedStudent.recommendedTopics || []).map((topic, index) => (
                          <div key={index} className="flex items-center space-x-2 text-sm text-gray-700">
                            <Lightbulb className="w-4 h-4 text-yellow-500" />
                            <span>{topic}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Learning Path */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Brain className="w-5 h-5 mr-2 text-blue-600" />
                    AI Learning Path
                  </h3>
                  {selectedStudent.hasAIPath ? (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-blue-800 font-medium">Learning Path Active</span>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                      <p className="text-sm text-blue-700 mb-3">
                        Personalized learning path has been generated based on weakness analysis.
                      </p>
                      <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        View Learning Path
                      </button>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <Brain className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-3">No AI learning path generated yet</p>
                      <button
                        onClick={() => generateLearningPath(
                          selectedStudent.studentId._id,
                          selectedStudent.focusSubject || 'Mathematics',
                          selectedStudent.weakAreas || [],
                          'basic'
                        )}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
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
      )}
    </div>
  );
};

// Mock data for development
const mockWeakStudents = [
  {
    _id: '1',
    studentId: { 
      _id: 'student1',
      name: 'Alex Thompson', 
      grade: '10', 
      section: 'A', 
      roll: 15 
    },
    interventionLevel: 'critical',
    consistencyScore: 25,
    focusSubject: 'Mathematics',
    weakAreas: ['Basic Concepts', 'Problem Solving', 'Consistency in Performance'],
    recommendedTopics: ['Number Systems', 'Basic Operations', 'Word Problems'],
    hasAIPath: false
  },
  {
    _id: '2',
    studentId: { 
      _id: 'student2',
      name: 'Sarah Wilson', 
      grade: '11', 
      section: 'B', 
      roll: 8 
    },
    interventionLevel: 'high',
    consistencyScore: 45,
    focusSubject: 'Physics',
    weakAreas: ['Conceptual Understanding', 'Formula Application'],
    recommendedTopics: ['Physics Fundamentals', 'Laws of Motion'],
    hasAIPath: true
  },
  {
    _id: '3',
    studentId: { 
      _id: 'student3',
      name: 'Mike Johnson', 
      grade: '9', 
      section: 'C', 
      roll: 22 
    },
    interventionLevel: 'medium',
    consistencyScore: 55,
    focusSubject: 'Chemistry',
    weakAreas: ['Chemical Equations', 'Basic Concepts'],
    recommendedTopics: ['Balancing Equations', 'Reaction Types'],
    hasAIPath: false
  }
];

export default WeakStudentIdentification;