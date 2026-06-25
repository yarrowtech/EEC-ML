import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Brain,
  BookOpen,
  Target,
  TrendingUp,
  Clock,
  Award,
  Lightbulb,
  BarChart3,
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  Star,
  Zap,
  CheckCircle,
  AlertCircle,
  Globe,
  PenTool
} from 'lucide-react';

// Import AI learning components
import AISummaryGenerator from './AISummaryGenerator';
import MindMapGenerator from './MindMapGenerator';
import FlashcardGenerator from './FlashcardGenerator';
import AIQuizGenerator from './AIQuizGenerator';
import AITutorHomeScreen from './AITutorHomeScreen';

const AILearningDashboard = () => {
  const [selectedSubject, setSelectedSubject] = useState(null);
  const learningProgress = mockProgress;
  const recommendations = mockRecommendations;

  if (selectedSubject) {
    return <SubjectLearningView
      subject={selectedSubject}
      onBack={() => setSelectedSubject(null)}
    />;
  }

  return (
    // <div className="min-h-screen bg-gray-50 p-6">
    //   <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 mb-6 text-white shadow-xl">
    //     <div className="flex items-center justify-between">
    //       <div>
    //         <h1 className="text-3xl font-bold mb-2 flex items-center">
    //           <Brain className="w-8 h-8 mr-3" />
    //           AI Learning Center
    //         </h1>
    //         <p className="text-blue-100 text-lg">
    //           Personalized learning powered by artificial intelligence
    //         </p>
    //       </div>
    //       <div className="text-center">
    //         <div className="bg-blue-500 px-6 py-3 rounded-xl">
    //           <p className="text-2xl font-bold">{learningProgress?.currentStreak || 0}</p>
    //           <p className="text-sm text-blue-100">Day Streak</p>
    //         </div>
    //       </div>
    //     </div>
    //   </div>

    //   <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
    //     <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
    //       <div className="flex items-center justify-between">
    //         <div>
    //           <p className="text-sm text-gray-500 font-medium">Topics Studied</p>
    //           <p className="text-2xl font-bold text-blue-600">
    //             {learningProgress?.totalTopicsStudied || 0}
    //           </p>
    //         </div>
    //         <BookOpen className="w-8 h-8 text-blue-500" />
    //       </div>
    //     </div>

    //     <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
    //       <div className="flex items-center justify-between">
    //         <div>
    //           <p className="text-sm text-gray-500 font-medium">Completed Courses</p>
    //           <p className="text-2xl font-bold text-green-600">
    //             {learningProgress?.completedCourses || 0}
    //           </p>
    //         </div>
    //         <Award className="w-8 h-8 text-green-500" />
    //       </div>
    //     </div>

    //     <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
    //       <div className="flex items-center justify-between">
    //         <div>
    //           <p className="text-sm text-gray-500 font-medium">Weekly Progress</p>
    //           <p className="text-2xl font-bold text-purple-600">
    //             {learningProgress?.weeklyProgress || 0}/{learningProgress?.weeklyGoal || 5}
    //           </p>
    //         </div>
    //         <Target className="w-8 h-8 text-purple-500" />
    //       </div>
    //     </div>

    //     <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
    //       <div className="flex items-center justify-between">
    //         <div>
    //           <p className="text-sm text-gray-500 font-medium">Learning Streak</p>
    //           <p className="text-2xl font-bold text-orange-600">
    //             {learningProgress?.currentStreak || 0} days
    //           </p>
    //         </div>
    //         <TrendingUp className="w-8 h-8 text-orange-500" />
    //       </div>
    //     </div>
    //   </div>

    //   <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
    //     <div className="lg:col-span-2">
    //       <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
    //         <Zap className="w-6 h-6 mr-2 text-yellow-500" />
    //         AI-Powered Learning
    //       </h2>

    //       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    //         {courses.map((course) => (
    //           <div key={course.id} className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow border border-gray-100 overflow-hidden">
    //             <div className={`h-2 bg-gradient-to-r ${getSubjectColor(course.color)}`}></div>
    //             <div className="p-6">
    //               <div className="flex items-center justify-between mb-4">
    //                 <h3 className="text-xl font-bold text-gray-800">{course.name}</h3>
    //                 <div className={`p-2 rounded-lg bg-gradient-to-r ${getSubjectColor(course.color)} bg-opacity-10`}>
    //                   <BookOpen className={`w-5 h-5 text-${course.color}-600`} />
    //                 </div>
    //               </div>

    //               <p className="text-gray-600 mb-4 text-sm">{course.description}</p>

    //               <div className="mb-4">
    //                 <div className="flex justify-between text-sm text-gray-500 mb-1">
    //                   <span>Progress</span>
    //                   <span>
    //                     {learningProgress?.subjectProgress?.[course.name]?.percentage || 0}%
    //                   </span>
    //                 </div>
    //                 <div className="w-full bg-gray-200 rounded-full h-2">
    //                   <div 
    //                     className={`h-2 rounded-full bg-gradient-to-r ${getSubjectColor(course.color)}`}
    //                     style={{ width: `${learningProgress?.subjectProgress?.[course.name]?.percentage || 0}%` }}
    //                   ></div>
    //                 </div>
    //               </div>

    //               <div className="flex flex-wrap gap-2 mb-4">
    //                 {course.topics.slice(0, 3).map((topic, index) => (
    //                   <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
    //                     {topic}
    //                   </span>
    //                 ))}
    //                 {course.topics.length > 3 && (
    //                   <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
    //                     +{course.topics.length - 3} more
    //                   </span>
    //                 )}
    //               </div>

    //               <button
    //                 onClick={() => setSelectedSubject(course)}
    //                 className={`w-full py-3 px-4 bg-gradient-to-r ${getSubjectColor(course.color)} text-white rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center space-x-2 font-medium`}
    //               >
    //                 <Play className="w-4 h-4" />
    //                 <span>Start Learning</span>
    //               </button>
    //             </div>
    //           </div>
    //         ))}
    //       </div>
    //     </div>

    //     <div className="space-y-6">
    //       <div className="bg-white rounded-xl shadow-sm border border-gray-100">
    //         <div className="p-6 border-b border-gray-100">
    //           <h3 className="text-lg font-semibold text-gray-800 flex items-center">
    //             <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
    //             AI Recommendations
    //           </h3>
    //         </div>
    //         <div className="p-4">
    //           <div className="space-y-4">
    //             {recommendations.map((rec) => (
    //               <div key={rec.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
    //                 <div className="flex items-start justify-between mb-2">
    //                   <h4 className="font-medium text-gray-800 text-sm">{rec.title}</h4>
    //                   <span className={`px-2 py-1 rounded-full text-xs font-medium ${
    //                     rec.type === 'review' ? 'bg-red-100 text-red-700' :
    //                     rec.type === 'preview' ? 'bg-blue-100 text-blue-700' :
    //                     'bg-green-100 text-green-700'
    //                   }`}>
    //                     {rec.type}
    //                   </span>
    //                 </div>
    //                 <p className="text-xs text-gray-600 mb-3">{rec.reason}</p>
    //                 <div className="flex items-center justify-between">
    //                   <div className="flex items-center space-x-2 text-xs text-gray-500">
    //                     <Clock className="w-3 h-3" />
    //                     <span>{rec.estimatedTime} min</span>
    //                     <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
    //                       {rec.difficulty}
    //                     </span>
    //                   </div>
    //                   <button className="text-blue-600 hover:text-blue-700 text-xs font-medium">
    //                     Start →
    //                   </button>
    //                 </div>
    //               </div>
    //             ))}
    //           </div>
    //         </div>
    //       </div>

    //       <div className="bg-white rounded-xl shadow-sm border border-gray-100">
    //         <div className="p-6 border-b border-gray-100">
    //           <h3 className="text-lg font-semibold text-gray-800 flex items-center">
    //             <BarChart3 className="w-5 h-5 mr-2 text-green-500" />
    //             Recent Activity
    //           </h3>
    //         </div>
    //         <div className="p-4">
    //           <div className="space-y-3">
    //             {learningProgress?.recentActivity?.map((activity, index) => (
    //               <div key={index} className="flex items-center space-x-3 p-2">
    //                 <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
    //                   {activity.type === 'summary' && <PenTool className="w-4 h-4 text-blue-600" />}
    //                   {activity.type === 'mindmap' && <Globe className="w-4 h-4 text-blue-600" />}
    //                   {activity.type === 'quiz' && <CheckCircle className="w-4 h-4 text-blue-600" />}
    //                 </div>
    //                 <div className="flex-1">
    //                   <p className="text-sm font-medium text-gray-800">{activity.topic}</p>
    //                   <p className="text-xs text-gray-500">{activity.subject}</p>
    //                 </div>
    //                 <div className="text-xs text-gray-400">
    //                   {new Date(activity.date).toLocaleDateString()}
    //                 </div>
    //               </div>
    //             ))}
    //           </div>
    //         </div>
    //       </div>
    //     </div>
    //   </div>
    // </div>
    <AITutorHomeScreen
      onStartLearning={() => toast.success('Opening your lessons...')}
      onPracticeQuestions={() => toast.success('Loading practice questions...')}
      onAskAiTutor={() => toast.success('AI Tutor chat opening soon!')}
      onExploreSubject={(subject) => {
        if (subject?.topics?.length) {
          setSelectedSubject({
            id: subject.id,
            name: subject.name,
            description: `${subject.topicsCount} topic${subject.topicsCount === 1 ? '' : 's'} published by your teacher`,
            topics: subject.topics,
            color: subject.colorKey || 'blue',
          });
        } else {
          toast.success(`${subject.name} has no published topics yet.`);
        }
      }}
    />
  );
};

// Subject Learning View Component
const SubjectLearningView = ({ subject, onBack }) => {
  const [activeFeature, setActiveFeature] = useState('dashboard');
  const [activeTopic, setActiveTopic] = useState(null);

  const features = [
    { id: 'dashboard', name: 'Dashboard', icon: BarChart3, color: 'blue' },
    { id: 'summary', name: 'AI Summary', icon: PenTool, color: 'green' },
    { id: 'mindmap', name: 'Mind Map', icon: Globe, color: 'purple' },
    { id: 'flashcards', name: 'Flashcards', icon: Star, color: 'yellow' },
    { id: 'quiz', name: 'AI Quiz', icon: CheckCircle, color: 'red' },
  ];

  const renderFeatureContent = () => {
    switch (activeFeature) {
      case 'summary':
        return <AISummaryGenerator subject={subject} topic={activeTopic} />;
      case 'mindmap':
        return <MindMapGenerator subject={subject} topic={activeTopic} />;
      case 'flashcards':
        return <FlashcardGenerator subject={subject} topic={activeTopic} />;
      case 'quiz':
        return <AIQuizGenerator subject={subject} topic={activeTopic} />;
      default:
        return <SubjectDashboard subject={subject} onSelectTopic={(t) => { setActiveTopic(t); setActiveFeature('summary'); }} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={`bg-gradient-to-r ${getSubjectColor(subject.color)} p-6 text-white shadow-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-colors"
            >
              <ArrowRight className="w-5 h-5 rotate-180" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">{subject.name} Learning</h1>
              <p className="text-blue-100">AI-powered interactive learning experience</p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Navigation */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex space-x-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(feature.id)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${activeFeature === feature.id
                    ? `border-${feature.color}-500 text-${feature.color}-600`
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span>{feature.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feature Content */}
      <div className="p-6">
        {renderFeatureContent()}
      </div>
    </div>
  );
};

// Helper component for subject dashboard
const SubjectDashboard = ({ subject, onSelectTopic }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Topics</h3>
      <div className="space-y-2">
        {subject.topics.map((topic, index) => (
          <button
            key={index}
            onClick={() => onSelectTopic && onSelectTopic(topic)}
            className="w-full flex items-center justify-between p-2 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-200 transition"
          >
            <span className="text-gray-700 text-left">{topic}</span>
            <span className="inline-flex items-center gap-1 text-blue-600 text-sm">
              <Play className="w-3.5 h-3.5" />
              Start
            </span>
          </button>
        ))}
      </div>
    </div>

    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Learning Progress</h3>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Overall Progress</span>
            <span>75%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="h-2 bg-blue-500 rounded-full" style={{ width: '75%' }}></div>
          </div>
        </div>
      </div>
    </div>

    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
      <div className="space-y-2">
        <button className="w-full text-left p-2 hover:bg-gray-50 rounded-lg flex items-center space-x-2">
          <Play className="w-4 h-4 text-blue-500" />
          <span>Continue Learning</span>
        </button>
        <button className="w-full text-left p-2 hover:bg-gray-50 rounded-lg flex items-center space-x-2">
          <RotateCcw className="w-4 h-4 text-green-500" />
          <span>Review Previous</span>
        </button>
      </div>
    </div>
  </div>
);


// Helper function
const getSubjectColor = (color) => {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    green: 'from-green-500 to-green-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600'
  };
  return colors[color] || colors.blue;
};

// Mock data
const mockProgress = {
  totalTopicsStudied: 45,
  completedCourses: 6,
  currentStreak: 7,
  weeklyGoal: 5,
  weeklyProgress: 4,
  subjectProgress: {
    'Mathematics': { completed: 15, total: 20, percentage: 75 },
    'Physics': { completed: 8, total: 15, percentage: 53 },
    'Chemistry': { completed: 12, total: 18, percentage: 67 },
    'Biology': { completed: 10, total: 16, percentage: 63 },
    'English Literature': { completed: 14, total: 20, percentage: 70 },
    'History': { completed: 9, total: 15, percentage: 60 },
    'Geography': { completed: 7, total: 12, percentage: 58 },
    'Economics': { completed: 6, total: 14, percentage: 43 },
    'Computer Science': { completed: 8, total: 18, percentage: 44 },
    'Psychology': { completed: 5, total: 12, percentage: 42 }
  },
  recentActivity: [
    { topic: 'Quadratic Equations', subject: 'Mathematics', date: new Date(), type: 'summary' },
    { topic: 'Laws of Motion', subject: 'Physics', date: new Date(Date.now() - 86400000), type: 'mindmap' },
    { topic: 'Chemical Bonding', subject: 'Chemistry', date: new Date(Date.now() - 172800000), type: 'flashcards' },
    { topic: 'Cell Division', subject: 'Biology', date: new Date(Date.now() - 259200000), type: 'quiz' },
    { topic: 'Shakespeare Analysis', subject: 'English Literature', date: new Date(Date.now() - 345600000), type: 'summary' }
  ]
};

const mockRecommendations = [
  {
    id: 1,
    title: 'Review Quadratic Functions',
    subject: 'Mathematics',
    reason: 'You struggled with this topic in recent assignments',
    difficulty: 'medium',
    estimatedTime: 30,
    type: 'review'
  }
];

export default AILearningDashboard;
