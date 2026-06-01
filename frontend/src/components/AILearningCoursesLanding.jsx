import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowLeft, BookOpen, ChevronDown, ChevronUp, FlaskConical, Globe, GraduationCap, Info, Sparkles } from 'lucide-react';
import AILearningCoursesReference from './AILearningCoursesReference';
import AILearningPracticePaperPage from './AILearningPracticePaperPage';
import AILearningTryoutSection from './AILearningTryoutSection';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const SMART_LEARNING_MAP_ENDPOINT = `${API_BASE}/api/lesson-plans/student/smart-learning-map`;

const CARD_STYLES = [
  {
    grad: 'from-blue-400 to-indigo-600',
    chipA: 'bg-blue-100 text-blue-700',
    chipB: 'bg-green-100 text-green-700',
    icon: GraduationCap,
  },
  {
    grad: 'from-emerald-400 to-teal-600',
    chipA: 'bg-teal-100 text-teal-700',
    chipB: 'bg-purple-100 text-purple-700',
    icon: FlaskConical,
  },
  {
    grad: 'from-orange-400 to-pink-600',
    chipA: 'bg-orange-100 text-orange-700',
    chipB: 'bg-yellow-100 text-yellow-700',
    icon: BookOpen,
  },
  {
    grad: 'from-cyan-500 to-blue-700',
    chipA: 'bg-cyan-100 text-cyan-700',
    chipB: 'bg-indigo-100 text-indigo-700',
    icon: Globe,
  },
];

const normalize = (value) => String(value || '').trim().toLowerCase();

const SubjectTopicsView = ({ subject, onBack }) => {
  const navigate = useNavigate();
  const [openTopicIndex, setOpenTopicIndex] = useState(-1);
  const [completedSubtopics, setCompletedSubtopics] = useState({});
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);
  const topics = useMemo(() => Array.isArray(subject?.topics) ? subject.topics : [], [subject]);

  const normalizedCompletedSubtopics = useMemo(() => {
    if (!completedSubtopics || typeof completedSubtopics !== 'object' || Array.isArray(completedSubtopics)) {
      return {};
    }

    const topicSubtopicMap = new Map(
      topics.map((topic) => [topic.title, new Set(topic.subtopics || [])])
    );

    const normalized = {};
    Object.entries(completedSubtopics).forEach(([topicTitle, storedSubtopics]) => {
      const validSubtopics = topicSubtopicMap.get(topicTitle);
      if (!validSubtopics || !Array.isArray(storedSubtopics)) return;

      const dedupedValidSubtopics = [...new Set(
        storedSubtopics.filter((subtopic) => validSubtopics.has(subtopic))
      )];

      if (dedupedValidSubtopics.length > 0) {
        normalized[topicTitle] = dedupedValidSubtopics;
      }
    });

    return normalized;
  }, [completedSubtopics, topics]);

  // Calculate topic completion percentages
  const topicProgress = useMemo(() => {
    const progress = {};
    topics.forEach(topic => {
      const subtopicCount = topic.subtopics?.length || 0;
      const completedCount = (normalizedCompletedSubtopics[topic.title] || []).length;
      progress[topic.title] = {
        total: subtopicCount,
        completed: completedCount,
        percentage: subtopicCount > 0 ? Math.round((completedCount / subtopicCount) * 100) : 0
      };
    });
    return progress;
  }, [topics, normalizedCompletedSubtopics]);

  // Calculate overall progress
  const totalSubtopics = topics.reduce((sum, topic) => sum + (topic.subtopics?.length || 0), 0);
  const totalCompletedSubtopics = Object.values(normalizedCompletedSubtopics).reduce((sum, arr) => sum + arr.length, 0);
  const progress = totalSubtopics > 0 ? Math.round((totalCompletedSubtopics / totalSubtopics) * 100) : 0;
  const completedTopicCount = topics.filter(topic => topicProgress[topic.title]?.percentage === 100).length;

  // Find the next incomplete topic to continue from
  const nextIncompleteTopic = useMemo(() => {
    return topics.find(topic => topicProgress[topic.title]?.percentage < 100);
  }, [topics, topicProgress]);

  // Load completed subtopics from localStorage on mount
  useEffect(() => {
    const storageKey = `smart-learning-progress-${subject.key}`;
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Migration for older format where only completed topic titles were stored.
          const migrated = {};
          parsed.forEach((topicTitle) => {
            const topic = topics.find((t) => t.title === topicTitle);
            if (!topic) return;
            migrated[topic.title] = [...new Set(topic.subtopics || [])];
          });
          setCompletedSubtopics(migrated);
        } else if (parsed && typeof parsed === 'object') {
          setCompletedSubtopics(parsed);
        } else {
          setCompletedSubtopics({});
        }
      } catch (e) {
        console.error('Failed to parse saved progress:', e);
        setCompletedSubtopics({});
      }
    } else {
      setCompletedSubtopics({});
    }
    setIsProgressLoaded(true);
  }, [subject.key, topics]);

  // Save completed subtopics to localStorage whenever it changes
  useEffect(() => {
    if (!isProgressLoaded) return;
    const storageKey = `smart-learning-progress-${subject.key}`;
    localStorage.setItem(storageKey, JSON.stringify(normalizedCompletedSubtopics));
  }, [isProgressLoaded, normalizedCompletedSubtopics, subject.key]);

  const toggleSubtopicCompletion = (topicTitle, subtopic) => {
    setCompletedSubtopics(prev => {
      const topicSubtopics = prev[topicTitle] || [];
      const isCompleted = topicSubtopics.includes(subtopic);

      if (isCompleted) {
        // Remove from completed
        return {
          ...prev,
          [topicTitle]: topicSubtopics.filter(s => s !== subtopic)
        };
      } else {
        // Add to completed
        return {
          ...prev,
          [topicTitle]: [...topicSubtopics, subtopic]
        };
      }
    });
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <ArrowLeft size={16} /> Back to Subjects
      </button>

      <section className="rounded-[2rem] border border-[#e8dfbf] bg-[#f7f3e2] p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <span className="inline-flex rounded-full bg-[#ead79b] px-4 py-1 text-sm font-bold text-slate-700">
              {topics.length > 0 ? 'STAGE 1 QUEST' : 'COMING SOON'}
            </span>
            <h1 className="mt-3 text-4xl sm:text-5xl font-black text-[#0f1b3a]">{subject.title} {topics.length > 0 ? 'Syllabus' : ''}</h1>
            <p className="mt-2 text-xl text-slate-600">
              {topics.length > 0
                ? 'Master the concepts through structured quests and interactive challenges!'
                : 'Your teacher will publish lesson content here soon. Stay tuned!'}
            </p>
          </div>

          {topics.length > 0 && (
            <div className="min-w-[280px]">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-slate-600">Topics</p>
                  <p className="text-3xl font-black text-[#e0b92c]">{completedTopicCount}/{topics.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-600">Completion</p>
                  <p className="text-3xl font-black text-[#172447]">{progress}%</p>
                </div>
              </div>
              <div className="mt-4 h-5 w-full overflow-hidden rounded-full bg-white/60 border-2 border-[#ead79b] shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#e0b92c] to-[#d4a520] transition-all duration-500 ease-out relative overflow-hidden"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">
                  {progress === 0 ? 'Start your journey!' : progress === 100 ? '🎉 Complete!' : 'Keep going!'}
                </p>
                {progress > 0 && (
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          i < Math.floor(progress / 20) ? 'bg-[#e0b92c]' : 'bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
              {nextIncompleteTopic && progress > 0 && progress < 100 && (
                <button
                  onClick={() => {
                    const topicSlug = encodeURIComponent(String(nextIncompleteTopic.title || '').trim());
                    navigate(`/student/smart-learning-courses/subject/${encodeURIComponent(subject.key)}/topic/${topicSlug}`);
                  }}
                  className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#e0b92c] to-[#d4a520] px-6 py-3 font-bold text-white hover:from-[#d4a520] hover:to-[#c99a1e] transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  Continue Learning: {nextIncompleteTopic.title}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>

      <section>
        <h2 className="mb-4 text-4xl font-black text-[#0f1b3a]">
          {topics.length > 0 ? 'Adventure Path' : 'Lesson Content'}
        </h2>

        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
          <div className="flex items-center justify-between bg-slate-50 px-6 py-5">
            <div>
              <p className="text-3xl font-black text-[#0f1b3a]">{subject.title} Topics</p>
              <p className="text-lg text-slate-500">
                {topics.length === 0 ? 'Waiting for teacher to publish' : `${topics.length} Quest${topics.length > 1 ? 's' : ''} Available`}
              </p>
            </div>
            <p className="text-right text-2xl font-black text-[#2f7dff]">
              STATUS<br />
              <span className={topics.length === 0 ? 'text-amber-500' : 'text-emerald-500'}>
                {topics.length === 0 ? 'PENDING' : 'ACTIVE'}
              </span>
            </p>
          </div>

          <div className="space-y-4 bg-slate-50 p-4 sm:p-6">
            {topics.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                  <BookOpen className="text-amber-600" size={32} />
                </div>
                <p className="text-xl font-bold text-slate-800 mb-2">No Lesson Plans Published Yet</p>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Your teacher hasn't published any lesson plans for <span className="font-semibold">{subject.title}</span> yet.
                  Check back soon or ask your teacher about upcoming topics!
                </p>
                <div className="mt-6 inline-flex items-center gap-2 text-xs text-amber-700 bg-amber-100 px-4 py-2 rounded-full">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Lesson content will appear here once your teacher publishes it</span>
                </div>
              </div>
            ) : (
              topics.map((topic, index) => {
                const isOpen = openTopicIndex === index;
                const topicProg = topicProgress[topic.title] || { total: 0, completed: 0, percentage: 0 };
                const isFullyCompleted = topicProg.percentage === 100;
                const isInProgress = topicProg.percentage > 0 && topicProg.percentage < 100;

                // Calculate green intensity based on completion percentage
                // At 0% = no green (white background)
                // At 100% = full green (rgb(220, 252, 231) which is green-100)
                const greenIntensity = topicProg.percentage / 100;
                const bgColorStyle = {
                  backgroundColor: `rgba(220, 252, 231, ${greenIntensity * 0.8})` // green-100 with varying opacity
                };

                // Determine border and other styling
                let borderColor = 'border-[#e8dfbf]';
                let iconBg = 'bg-[#fef9e7]';
                let iconColor = 'text-[#d4a520]';
                let statusBadge = null;
                let progressBarBg = 'bg-slate-200';
                let progressBarFill = 'bg-slate-400';

                if (topicProg.percentage >= 80) {
                  borderColor = 'border-green-300';
                  iconBg = 'bg-green-100';
                  iconColor = 'text-green-600';
                  progressBarBg = 'bg-green-200';
                  progressBarFill = 'bg-green-500';
                  if (isFullyCompleted) {
                    statusBadge = <span className="text-xs font-bold text-green-700 bg-green-200/80 px-3 py-1 rounded-full whitespace-nowrap">Completed</span>;
                  } else {
                    statusBadge = <span className="text-xs font-bold text-green-700 bg-green-200/80 px-3 py-1 rounded-full whitespace-nowrap">Almost Done</span>;
                  }
                } else if (topicProg.percentage >= 50) {
                  borderColor = 'border-emerald-200';
                  iconBg = 'bg-emerald-100';
                  iconColor = 'text-emerald-600';
                  statusBadge = <span className="text-xs font-bold text-emerald-700 bg-emerald-200/80 px-3 py-1 rounded-full whitespace-nowrap">In Progress</span>;
                  progressBarBg = 'bg-emerald-200';
                  progressBarFill = 'bg-emerald-500';
                } else if (isInProgress) {
                  borderColor = 'border-lime-200';
                  iconBg = 'bg-lime-100';
                  iconColor = 'text-lime-600';
                  statusBadge = <span className="text-xs font-bold text-lime-700 bg-lime-200/80 px-3 py-1 rounded-full whitespace-nowrap">In Progress</span>;
                  progressBarBg = 'bg-lime-200';
                  progressBarFill = 'bg-lime-500';
                }

                return (
                  <div
                    key={`${topic.title}-${index}`}
                    className={`rounded-3xl border-2 ${borderColor} shadow-sm transition-all hover:shadow-md`}
                    style={bgColorStyle}
                  >
                    <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <span className={`flex h-14 w-14 items-center justify-center rounded-full flex-shrink-0 ${iconBg} ${iconColor}`}>
                          {isFullyCompleted ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          ) : (
                            <BookOpen size={24} />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <h3 className="text-xl sm:text-2xl font-black text-[#111d3f]">{topic.title}</h3>
                            {statusBadge}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="text-sm font-medium text-slate-600">{topicProg.completed}/{topicProg.total} subtopics</p>
                            {topicProg.total > 0 && (
                              <>
                                <div className={`h-2 w-24 sm:w-32 overflow-hidden rounded-full ${progressBarBg}`}>
                                  <div
                                    className={`h-full transition-all duration-500 ${progressBarFill}`}
                                    style={{ width: `${topicProg.percentage}%` }}
                                  />
                                </div>
                                <span className="text-sm font-bold text-slate-700">{topicProg.percentage}%</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => setOpenTopicIndex(isOpen ? -1 : index)}
                          className="rounded-full p-2 text-slate-400 hover:bg-white/80 hover:text-slate-600 transition-colors"
                          aria-label="Toggle info"
                        >
                          <Info size={20} />
                        </button>
                        <button
                          onClick={() => {
                            const topicSlug = encodeURIComponent(String(topic.title || '').trim());
                            navigate(`/student/smart-learning-courses/subject/${encodeURIComponent(subject.key)}/topic/${topicSlug}`);
                          }}
                          className={`group/btn relative rounded-full px-8 py-3 text-base font-black transition-all duration-300 overflow-hidden shadow-md hover:shadow-lg hover:scale-105 ${
                            isFullyCompleted
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : isInProgress
                              ? 'bg-amber-500 text-white hover:bg-amber-600'
                              : 'bg-[#e2bf3e] text-[#101a35] hover:bg-[#d9b734]'
                          }`}
                        >
                          <span className="relative z-10 flex items-center gap-2 whitespace-nowrap">
                            {isInProgress ? 'Continue' : isFullyCompleted ? 'Learn' : 'Start Learning'}
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out"></div>
                        </button>
                        <button
                          onClick={() => setOpenTopicIndex(isOpen ? -1 : index)}
                          className="rounded-full p-2 text-slate-400 hover:bg-white/80 hover:text-slate-600 transition-colors"
                          aria-label="Toggle subtopics"
                        >
                          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t border-slate-200/50 bg-white/80 backdrop-blur-sm px-6 sm:px-8 pb-5 pt-4">
                        {topic.subtopics && topic.subtopics.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Click to mark as complete</p>
                            {topic.subtopics.map((subtopic, idx) => {
                              const isSubtopicCompleted = (completedSubtopics[topic.title] || []).includes(subtopic);
                              return (
                                <button
                                  key={`${subtopic}-${idx}`}
                                  onClick={() => toggleSubtopicCompletion(topic.title, subtopic)}
                                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:shadow-md ${
                                    isSubtopicCompleted
                                      ? 'bg-green-100 border-2 border-green-300'
                                      : 'bg-slate-50 border-2 border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                                    isSubtopicCompleted ? 'bg-green-500' : 'bg-white border-2 border-slate-300'
                                  }`}>
                                    {isSubtopicCompleted && (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                      </svg>
                                    )}
                                  </div>
                                  <span className={`text-sm font-medium ${isSubtopicCompleted ? 'text-green-700 line-through' : 'text-slate-700'}`}>
                                    {subtopic}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500 italic">No subtopics available</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

const AILearningCoursesLanding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contexts, setContexts] = useState([]);
  const [smartLearningMap, setSmartLearningMap] = useState([]);

  // Parse URL params manually
  const urlMatch = location.pathname.match(/\/student\/(?:smart-learning|smart-learning-courses)\/subject\/([^/]+)(?:\/topic\/([^/]+))?(?:\/assessment\/([^/]+))?/);
  const subjectKey = urlMatch?.[1] ? decodeURIComponent(urlMatch[1]) : null;
  const topicSlug = urlMatch?.[2] ? decodeURIComponent(urlMatch[2]) : null;
  const assessmentSlug = urlMatch?.[3] ? decodeURIComponent(urlMatch[3]) : null;

  useEffect(() => {
    const fetchAssignedSubjects = async () => {
      try {
        setLoading(true);
        setError('');

        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        if (!token || userType !== 'Student') {
          setContexts([]);
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

        const [contextRes, mapRes] = await Promise.all([
          fetch(`${API_BASE}/api/student/auth/teacher-feedback/context`, { headers }),
          fetch(SMART_LEARNING_MAP_ENDPOINT, { headers }),
        ]);

        if (!contextRes.ok) {
          const payload = await contextRes.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to load assigned subjects');
        }

        if (!mapRes.ok) {
          const payload = await mapRes.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to load smart learning map');
        }

        const contextData = await contextRes.json();
        const mapData = await mapRes.json();
        setContexts(Array.isArray(contextData?.teachers) ? contextData.teachers : []);
        setSmartLearningMap(Array.isArray(mapData?.subjects) ? mapData.subjects : []);
      } catch (err) {
        setError(err?.message || 'Unable to load assigned subjects');
      } finally {
        setLoading(false);
      }
    };

    fetchAssignedSubjects();
  }, []);

  const assignedSubjects = useMemo(() => {
    const map = new Map();

    // First, add all allocated subjects from timetable
    contexts.forEach((ctx) => {
      const name = String(ctx?.subjectName || '').trim();
      if (!name) return;
      const key = normalize(name);
      if (!map.has(key)) {
        map.set(key, {
          key,
          title: name,
          teacherNames: new Set(),
          classNames: new Set(),
        });
      }
      const item = map.get(key);
      const teacher = String(ctx?.teacherName || '').trim();
      const classLabel = [ctx?.className, ctx?.sectionName].filter(Boolean).join('-');
      if (teacher) item.teacherNames.add(teacher);
      if (classLabel) item.classNames.add(classLabel);
    });

    // Then merge with smart learning map data (lesson plans)
    return Array.from(map.values()).map((item) => {
      const fromMap = smartLearningMap.find((m) => normalize(m.key || m.title) === item.key);
      return {
        ...item,
        topics: Array.isArray(fromMap?.topics) ? fromMap.topics : [],
        teacherCount: item.teacherNames.size,
        classCount: item.classNames.size,
        hasLessonPlans: Array.isArray(fromMap?.topics) && fromMap.topics.length > 0,
      };
    });
    // Removed filter - now showing all allocated subjects regardless of lesson plans
  }, [contexts, smartLearningMap]);

  const selectedSubject = useMemo(() => {
    if (!subjectKey) return null;
    const normalizedKey = normalize(subjectKey);
    return assignedSubjects.find(s => s.key === normalizedKey);
  }, [subjectKey, assignedSubjects]);

  // Redirect unknown subject URLs or topic URLs for subjects without topics
  useEffect(() => {
    if (loading) return;

    // If accessing a topic but subject doesn't exist at all, redirect
    if (subjectKey && !selectedSubject) {
      navigate('/student/smart-learning-courses', { replace: true });
      return;
    }

    // If accessing a topic but subject has no topics, redirect to subject page
    if (topicSlug && selectedSubject && (!selectedSubject.topics || selectedSubject.topics.length === 0)) {
      navigate(`/student/smart-learning-courses/subject/${encodeURIComponent(subjectKey)}`, { replace: true });
    }
  }, [topicSlug, subjectKey, selectedSubject, loading, navigate]);

  // If on a topic page, show the learning content (only if subject exists)
  if (topicSlug && subjectKey && assessmentSlug === 'practice-paper' && selectedSubject) {
    return <AILearningPracticePaperPage />;
  }
  if (topicSlug && subjectKey && assessmentSlug === 'tryout-section' && selectedSubject) {
    return <AILearningTryoutSection />;
  }

  if (topicSlug && subjectKey && selectedSubject) {
    return <AILearningCoursesReference />;
  }

  if (topicSlug && subjectKey && !selectedSubject && !loading) return null;

  return (
    <div className="w-full min-h-screen bg-[#f8f7f6] text-slate-900 p-4 sm:p-6 md:p-8">
      <div className="mx-auto w-full max-w-[1200px]">
        {selectedSubject ? (
          <SubjectTopicsView
            subject={selectedSubject}
            onBack={() => navigate('/student/smart-learning-courses')}
          />
        ) : (
          <>
            <div className="mb-8 flex flex-col gap-2">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Your Subjects</h1>
              <p className="text-sm sm:text-base text-slate-600">Showing only subjects assigned to your class timetable.</p>
            </div>

            {error && (
              <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-72 rounded-xl bg-white animate-pulse" />
                ))}
              </div>
            ) : assignedSubjects.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                <Sparkles className="mx-auto mb-3 text-slate-300" size={32} />
                <p className="text-lg font-bold text-slate-800">No real smart-learning data found</p>
                <p className="mt-1 text-sm text-slate-500">Ask your class teacher to publish lesson-plan topics/materials for your class.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {assignedSubjects.map((subject, index) => {
                  const style = CARD_STYLES[index % CARD_STYLES.length];
                  const Icon = style.icon;
                  return (
                    <div key={subject.key} className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-[#e7c555]/50 hover:shadow-xl">
                      <div className={`relative flex h-40 flex-col justify-end overflow-hidden bg-gradient-to-br p-6 ${style.grad}`}>
                        <Icon className="absolute -bottom-4 -right-4 size-20 rotate-12 text-white/20 transition-transform group-hover:rotate-0" />
                        <h3 className="text-2xl font-black text-white">{subject.title}</h3>
                      </div>
                      <div className="flex flex-col gap-4 p-6">
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${style.chipA}`}>{subject.teacherCount} Teacher{subject.teacherCount > 1 ? 's' : ''}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${style.chipB}`}>{subject.classCount} Class Slot{subject.classCount > 1 ? 's' : ''}</span>
                          {subject.hasLessonPlans && (
                            <span className="rounded-full px-3 py-1 text-xs font-bold bg-emerald-100 text-emerald-700">{subject.topics.length} Topic{subject.topics.length > 1 ? 's' : ''}</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {subject.hasLessonPlans
                            ? 'Assigned in your timetable. Start this subject quest now.'
                            : 'Assigned in your timetable. Lesson plans coming soon from your teacher.'}
                        </p>
                        <button
                          onClick={() => {
                            if (subject.hasLessonPlans) {
                              navigate(`/student/smart-learning-courses/subject/${encodeURIComponent(subject.key)}`);
                            }
                          }}
                          className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 font-bold transition-all duration-200 ease-out ${
                            subject.hasLessonPlans
                              ? 'bg-[#e7c555] text-slate-900 hover:bg-[#e7c555]/90 group-hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] cursor-pointer'
                              : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          }`}
                          disabled={!subject.hasLessonPlans}
                        >
                          {subject.hasLessonPlans ? 'Start Learning' : 'Coming Soon'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AILearningCoursesLanding;
