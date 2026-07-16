import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Brain,
  Play,
  CheckCircle,
  Clock,
  BookOpen,
  Video,
  FileText,
  HelpCircle,
  Star,
  ArrowRight,
  BarChart3,
  Target,
  Trophy,
  RefreshCw,
  Download,
  ChevronLeft,
  Lightbulb,
  Zap
} from 'lucide-react';

const AILearningPath = () => {
  const { studentId, subject } = useParams();
  const navigate = useNavigate();
  const [learningPath, setLearningPath] = useState(null);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedResource, setSelectedResource] = useState(null);
  const [completingResource, setCompletingResource] = useState(false);

  useEffect(() => {
    if (studentId && subject) {
      fetchLearningPath();
    }
  }, [studentId, subject]);

  const fetchLearningPath = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ai-learning/learning-path/${studentId}/${subject}`);
      if (response.ok) {
        const data = await response.json();
        setLearningPath(data.learningPath);
        setStudent(data.student);
      } else {
        // Mock data for development
        setLearningPath(mockLearningPath);
        setStudent(mockStudent);
      }
    } catch (error) {
      console.error('Error fetching learning path:', error);
      setLearningPath(mockLearningPath);
      setStudent(mockStudent);
    } finally {
      setLoading(false);
    }
  };

  const markResourceCompleted = async (resourceIndex, topicTitle) => {
    setCompletingResource(true);
    try {
      const response = await fetch(`/api/ai-learning/update-progress/${studentId}/${subject}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicCompleted: topicTitle,
          resourceCompleted: true,
          progressPercentage: Math.min(100, learningPath.progress + 10)
        })
      });

      if (response.ok) {
        // Update local state
        setLearningPath(prev => ({
          ...prev,
          progress: Math.min(100, prev.progress + 10),
          completedTopics: [...(prev.completedTopics || []), topicTitle].filter((v, i, a) => a.indexOf(v) === i),
          lastAccessed: new Date()
        }));
        
        // Mark resource as completed in UI
        const updatedResources = [...learningPath.recommendedResources];
        updatedResources[resourceIndex] = { ...updatedResources[resourceIndex], completed: true };
        setLearningPath(prev => ({ ...prev, recommendedResources: updatedResources }));
        
        alert('Great job! Resource marked as completed.');
      } else {
        throw new Error('Failed to update progress');
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      alert('Failed to update progress. Please try again.');
    } finally {
      setCompletingResource(false);
    }
  };

  const getResourceIcon = (type) => {
    switch (type) {
      case 'video': return <Video className="w-5 h-5" />;
      case 'article': return <FileText className="w-5 h-5" />;
      case 'practice': return <Target className="w-5 h-5" />;
      case 'quiz': return <HelpCircle className="w-5 h-5" />;
      case 'interactive': return <Zap className="w-5 h-5" />;
      default: return <BookOpen className="w-5 h-5" />;
    }
  };

  const getResourceColor = (type) => {
    switch (type) {
      case 'video': return 'text-red-600 bg-red-100';
      case 'article': return 'text-blue-600 bg-blue-100';
      case 'practice': return 'text-green-600 bg-green-100';
      case 'quiz': return 'text-purple-600 bg-purple-100';
      case 'interactive': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'basic': return 'text-green-600 bg-green-100';
      case 'intermediate': return 'text-yellow-600 bg-yellow-100';
      case 'advanced': return 'text-red-600 bg-red-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-blue-600 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600">Loading AI Learning Path...</p>
        </div>
      </div>
    );
  }

  if (!learningPath) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">No Learning Path Found</h3>
          <p className="text-gray-600 mb-4">Generate an AI learning path first from the weak student identification page.</p>
          <button
            onClick={() => navigate('/teacher/classes/current/students/analytics')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Weak Students
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/teacher/classes/current/students/analytics')}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to Weak Students
        </button>
        
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center">
                <Brain className="w-8 h-8 mr-3" />
                AI Learning Path
              </h1>
              <p className="text-blue-100">Personalized learning journey for {student?.name}</p>
              <div className="flex items-center space-x-4 mt-3">
                <span className="bg-blue-500 px-3 py-1 rounded-full text-sm">
                  Grade {student?.grade}-{student?.section}
                </span>
                <span className="bg-purple-500 px-3 py-1 rounded-full text-sm">
                  Subject: {subject}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="bg-blue-500 px-4 py-2 rounded-lg flex items-center space-x-2">
                <Trophy className="w-4 h-4" />
                <span>{learningPath.progress}% Complete</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-blue-100">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Overall Progress</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{learningPath.progress}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${learningPath.progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-green-100">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Completed Topics</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {learningPath.completedTopics?.length || 0}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-purple-100">
              <BookOpen className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Resources</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">
              {learningPath.recommendedResources?.length || 0}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-yellow-100">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Est. Time</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">
              {learningPath.recommendedResources?.reduce((sum, r) => sum + (r.estimatedTime || 0), 0) || 0}m
            </p>
          </div>
        </div>
      </div>

      {/* Current Topic */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <Target className="w-5 h-5 mr-2 text-green-600" />
            Current Focus: {learningPath.currentTopic}
          </h2>
        </div>
        <div className="p-6">
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border-l-4 border-green-500">
            <div className="flex items-start space-x-3">
              <Lightbulb className="w-6 h-6 text-green-600 mt-1" />
              <div>
                <h3 className="font-medium text-gray-800 mb-1">Learning Objective</h3>
                <p className="text-gray-600 text-sm">
                  Focus on mastering {learningPath.currentTopic} through structured learning resources. 
                  Complete the activities in order for optimal understanding.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Learning Resources */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <Brain className="w-5 h-5 mr-2 text-blue-600" />
              Recommended Learning Resources
            </h2>
            <button className="text-blue-600 hover:text-blue-700 flex items-center space-x-2 text-sm">
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Path</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {learningPath.recommendedResources?.map((resource, index) => (
              <div 
                key={index} 
                className={`border rounded-lg p-4 transition-all ${resource.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:shadow-md'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${getResourceColor(resource.type)}`}>
                      {getResourceIcon(resource.type)}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">{resource.title}</h3>
                      <div className="flex items-center space-x-3 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getResourceColor(resource.type)}`}>
                          {resource.type}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(resource.difficulty)}`}>
                          {resource.difficulty}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {resource.estimatedTime}min
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {resource.completed ? (
                    <div className="flex items-center space-x-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Completed</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedResource(resource)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 text-sm"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start</span>
                      </button>
                      <button
                        onClick={() => markResourceCompleted(index, resource.title)}
                        disabled={completingResource}
                        className="px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 disabled:opacity-50 transition-colors text-sm"
                      >
                        {completingResource ? 'Marking...' : 'Mark Complete'}
                      </button>
                    </div>
                  )}
                </div>

                {!resource.completed && (
                  <div className="ml-11">
                    <p className="text-sm text-gray-600">
                      This resource will help you understand the key concepts. Take your time and practice the examples provided.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Progress Actions */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">
                  Complete all resources to move to the next topic
                </p>
              </div>
              <div className="flex space-x-3">
                <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center space-x-2">
                  <Download className="w-4 h-4" />
                  <span>Export Progress</span>
                </button>
                <button 
                  className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                    learningPath.progress === 100 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={learningPath.progress < 100}
                >
                  <Trophy className="w-4 h-4" />
                  <span>Complete Path</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Modal */}
      {selectedResource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${getResourceColor(selectedResource.type)}`}>
                    {getResourceIcon(selectedResource.type)}
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedResource.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedResource(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="text-center">
                <div className="mb-6">
                  <div className={`w-16 h-16 mx-auto rounded-full ${getResourceColor(selectedResource.type)} flex items-center justify-center mb-4`}>
                    {getResourceIcon(selectedResource.type)}
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">Ready to Start Learning?</h3>
                  <p className="text-gray-600 mb-4">
                    This {selectedResource.type} will take approximately {selectedResource.estimatedTime} minutes to complete.
                  </p>
                  <div className="flex justify-center space-x-2 mb-6">
                    <span className={`px-3 py-1 rounded-full text-sm ${getDifficultyColor(selectedResource.difficulty)}`}>
                      {selectedResource.difficulty} level
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-600">
                    Click "Open Resource" to access the learning material. Once you've completed it, 
                    return here and mark it as complete to update your progress.
                  </p>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      // Open resource in new tab (simulate)
                      window.open(selectedResource.url || '#', '_blank');
                    }}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <ArrowRight className="w-5 h-5" />
                    <span>Open Resource</span>
                  </button>
                  <button
                    onClick={() => setSelectedResource(null)}
                    className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
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
const mockStudent = {
  name: 'Alex Thompson',
  grade: '10',
  section: 'A',
  roll: 15
};

const mockLearningPath = {
  subject: 'Mathematics',
  currentTopic: 'Basic Algebra',
  completedTopics: ['Number Systems'],
  recommendedResources: [
    {
      title: 'Introduction to Algebra',
      type: 'video',
      url: '/learning/math/intro-algebra',
      difficulty: 'basic',
      estimatedTime: 25,
      completed: false
    },
    {
      title: 'Solving Linear Equations',
      type: 'interactive',
      url: '/learning/math/linear-equations',
      difficulty: 'basic',
      estimatedTime: 35,
      completed: false
    },
    {
      title: 'Algebra Practice Problems',
      type: 'practice',
      url: '/learning/math/algebra-practice',
      difficulty: 'intermediate',
      estimatedTime: 45,
      completed: false
    },
    {
      title: 'Algebra Quiz',
      type: 'quiz',
      url: '/learning/math/algebra-quiz',
      difficulty: 'basic',
      estimatedTime: 20,
      completed: false
    }
  ],
  progress: 25,
  createdAt: new Date(),
  lastAccessed: new Date()
};

export default AILearningPath;