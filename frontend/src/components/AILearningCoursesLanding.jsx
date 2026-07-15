import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronUp,
  FlaskConical, Globe, Info, Sparkles, Users, CalendarDays,
  Layers, Languages, Landmark, Leaf, Calculator, Palette, Music2,
} from 'lucide-react';
import AILearningCoursesReference from './AILearningCoursesReference';
import AILearningPracticePaperPage from './AILearningPracticePaperPage';
import AILearningTryoutSection from './AILearningTryoutSection';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const SMART_LEARNING_MAP_ENDPOINT = `${API_BASE}/api/lesson-plans/student/smart-learning-map`;

const CARD_STYLES = [
  {
    grad: 'from-blue-400 to-indigo-600',
    glow: 'hover:shadow-blue-300/50',
    chipA: 'bg-blue-100 text-blue-700',
    chipB: 'bg-green-100 text-green-700',
    icon: Calculator,
  },
  {
    grad: 'from-emerald-400 to-teal-600',
    glow: 'hover:shadow-emerald-300/50',
    chipA: 'bg-teal-100 text-teal-700',
    chipB: 'bg-purple-100 text-purple-700',
    icon: FlaskConical,
  },
  {
    grad: 'from-orange-400 to-pink-600',
    glow: 'hover:shadow-orange-300/50',
    chipA: 'bg-orange-100 text-orange-700',
    chipB: 'bg-yellow-100 text-yellow-700',
    icon: Languages,
  },
  {
    grad: 'from-cyan-500 to-blue-700',
    glow: 'hover:shadow-cyan-300/50',
    chipA: 'bg-cyan-100 text-cyan-700',
    chipB: 'bg-indigo-100 text-indigo-700',
    icon: Globe,
  },
  {
    grad: 'from-amber-400 to-orange-600',
    glow: 'hover:shadow-amber-300/50',
    chipA: 'bg-amber-100 text-amber-700',
    chipB: 'bg-rose-100 text-rose-700',
    icon: Landmark,
  },
  {
    grad: 'from-lime-400 to-emerald-600',
    glow: 'hover:shadow-lime-300/50',
    chipA: 'bg-lime-100 text-lime-700',
    chipB: 'bg-teal-100 text-teal-700',
    icon: Leaf,
  },
  {
    grad: 'from-fuchsia-400 to-purple-600',
    glow: 'hover:shadow-fuchsia-300/50',
    chipA: 'bg-fuchsia-100 text-fuchsia-700',
    chipB: 'bg-indigo-100 text-indigo-700',
    icon: Palette,
  },
  {
    grad: 'from-rose-400 to-red-600',
    glow: 'hover:shadow-rose-300/50',
    chipA: 'bg-rose-100 text-rose-700',
    chipB: 'bg-orange-100 text-orange-700',
    icon: Music2,
  },
];

const normalize = (value) => String(value || '').trim().toLowerCase();

const SubjectTopicsView = ({ subject, onBack }) => {
  const navigate = useNavigate();
  const [openChapterIndex, setOpenChapterIndex] = useState(-1);
  const [completedSubtopics, setCompletedSubtopics] = useState({});
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);
  const topics = useMemo(() => Array.isArray(subject?.topics) ? subject.topics : [], [subject]);
  const chapters = useMemo(() => {
    const sourceChapters = Array.isArray(subject?.chapters) ? subject.chapters : [];
    if (sourceChapters.length > 0) {
      return sourceChapters.map((chapter) => ({
        ...chapter,
        topics: (Array.isArray(chapter?.topics) ? chapter.topics : []).map((topic) => ({
          ...topic,
          subtopics: (Array.isArray(topic?.subtopics) ? topic.subtopics : [])
            .map((subtopic) => typeof subtopic === 'string' ? subtopic : subtopic?.title)
            .filter(Boolean),
        })),
      }));
    }

    return topics.map((topic, index) => ({
      id: `topic-${index}`,
      title: topic.title || `Chapter ${index + 1}`,
      topics: [topic],
    }));
  }, [subject, topics]);

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
  const completedChapterCount = chapters.filter((chapter) => {
    const chapterTopics = chapter.topics || [];
    return chapterTopics.length > 0 && chapterTopics.every((topic) => topicProgress[topic.title]?.percentage === 100);
  }).length;

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

      <section className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-amber-400 via-yellow-400 to-orange-500 p-5 shadow-lg shadow-amber-300/40 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <span className="inline-flex rounded-full border border-white/40 bg-white/25 px-4 py-1 text-sm font-bold text-white backdrop-blur-sm">
              {chapters.length > 0 ? 'PUBLISHED CHAPTERS' : 'COMING SOON'}
            </span>
            <h1 className="mt-3 text-2xl font-black text-white sm:text-4xl lg:text-5xl">{subject.title} {chapters.length > 0 ? 'Chapters' : ''}</h1>
            <p className="mt-2 text-base text-white/85 sm:text-xl">
              {chapters.length > 0
                ? 'All chapters published by your teacher are listed here with their topics and subtopics.'
                : 'Your teacher will publish lesson content here soon. Stay tuned!'}
            </p>
          </div>

          {chapters.length > 0 && (
            <div className="w-full sm:min-w-[280px] sm:w-auto">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-white/80">Chapters</p>
                  <p className="text-3xl font-black text-white">{completedChapterCount}/{chapters.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white/80">Completion</p>
                  <p className="text-3xl font-black text-white">{progress}%</p>
                </div>
              </div>
              <div className="mt-4 h-5 w-full overflow-hidden rounded-full border-2 border-white/40 bg-white/25 shadow-inner">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500 ease-out relative overflow-hidden"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/50 to-transparent animate-shimmer"></div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm font-medium text-white/85">
                  {progress === 0 ? 'Start your journey!' : progress === 100 ? 'Complete!' : 'Keep going!'}
                </p>
                {progress > 0 && (
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          i < Math.floor(progress / 20) ? 'bg-white' : 'bg-white/30'
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
                  className="mt-4 w-full rounded-xl bg-white px-6 py-3 font-bold text-amber-700 hover:bg-white/90 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
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
        <h2 className="mb-4 text-2xl font-black text-slate-900 sm:text-3xl lg:text-4xl">
          {chapters.length > 0 ? 'Uploaded Chapters' : 'Lesson Content'}
        </h2>

        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
          <div className="space-y-4 bg-slate-50 p-4 sm:p-6">
            {chapters.length === 0 ? (
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
              chapters.map((chapter, index) => {
                const isOpen = openChapterIndex === index;
                const chapterTopics = chapter.topics || [];
                const chapterTotals = chapterTopics.reduce((acc, topic) => {
                  const item = topicProgress[topic.title] || { total: 0, completed: 0 };
                  return {
                    total: acc.total + item.total,
                    completed: acc.completed + item.completed,
                  };
                }, { total: 0, completed: 0 });
                const chapterPercentage = chapterTotals.total > 0 ? Math.round((chapterTotals.completed / chapterTotals.total) * 100) : 0;
                const isFullyCompleted = chapterPercentage === 100 && chapterTotals.total > 0;
                const isInProgress = chapterPercentage > 0 && chapterPercentage < 100;
                const firstTopic = chapterTopics[0];
                const greenIntensity = chapterPercentage / 100;
                const bgColorStyle = {
                  backgroundColor: `rgba(220, 252, 231, ${greenIntensity * 0.8})` // green-100 with varying opacity
                };

                // Determine border and other styling
                let borderColor = 'border-amber-200';
                let iconBg = 'bg-amber-50';
                let iconColor = 'text-amber-600';
                let statusBadge = null;
                let progressBarBg = 'bg-slate-200';
                let progressBarFill = 'bg-slate-400';

                if (chapterPercentage >= 80) {
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
                } else if (chapterPercentage >= 50) {
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
                    key={`${chapter.id || chapter.title}-${index}`}
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
                            <h3 className="text-xl sm:text-2xl font-black text-slate-900">{chapter.title}</h3>
                            {statusBadge}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="text-sm font-medium text-slate-600">
                              {chapterTopics.length} topic{chapterTopics.length === 1 ? '' : 's'} · {chapterTotals.completed}/{chapterTotals.total} subtopics
                            </p>
                            {chapterTotals.total > 0 && (
                              <>
                                <div className={`h-2 w-24 sm:w-32 overflow-hidden rounded-full ${progressBarBg}`}>
                                  <div
                                    className={`h-full transition-all duration-500 ${progressBarFill}`}
                                    style={{ width: `${chapterPercentage}%` }}
                                  />
                                </div>
                                <span className="text-sm font-bold text-slate-700">{chapterPercentage}%</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => setOpenChapterIndex(isOpen ? -1 : index)}
                          className="rounded-full p-2 text-slate-400 hover:bg-white/80 hover:text-slate-600 transition-colors"
                          aria-label="Toggle info"
                        >
                          <Info size={20} />
                        </button>
                        <button
                          onClick={() => {
                            if (!firstTopic) return;
                            const topicSlug = encodeURIComponent(String(firstTopic.title || '').trim());
                            navigate(`/student/smart-learning-courses/subject/${encodeURIComponent(subject.key)}/topic/${topicSlug}`);
                          }}
                          disabled={!firstTopic}
                          className={`group/btn relative rounded-full px-8 py-3 text-base font-black transition-all duration-300 overflow-hidden shadow-md ${
                            !firstTopic
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : isFullyCompleted
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : isInProgress
                              ? 'bg-amber-500 text-white hover:bg-amber-600'
                              : 'bg-amber-400 text-white hover:bg-amber-500'
                          } ${firstTopic ? 'hover:shadow-lg hover:scale-105' : ''}`}
                        >
                          <span className="relative z-10 flex items-center gap-2 whitespace-nowrap">
                            {!firstTopic ? 'No Topics' : isInProgress ? 'Continue' : isFullyCompleted ? 'Learn' : 'Start Learning'}
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out"></div>
                        </button>
                        <button
                          onClick={() => setOpenChapterIndex(isOpen ? -1 : index)}
                          className="rounded-full p-2 text-slate-400 hover:bg-white/80 hover:text-slate-600 transition-colors"
                          aria-label="Toggle chapter topics"
                        >
                          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t border-slate-200/50 bg-white/80 backdrop-blur-sm px-6 sm:px-8 pb-5 pt-4">
                        {chapterTopics.length > 0 ? (
                          <div className="space-y-4">
                            {chapterTopics.map((topic) => {
                              const topicProg = topicProgress[topic.title] || { total: 0, completed: 0, percentage: 0 };
                              return (
                                <div key={topic.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p className="text-lg font-black text-slate-900">{topic.title}</p>
                                      <p className="text-sm font-medium text-slate-500">{topicProg.completed}/{topicProg.total} subtopics complete</p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        const topicSlug = encodeURIComponent(String(topic.title || '').trim());
                                        navigate(`/student/smart-learning-courses/subject/${encodeURIComponent(subject.key)}/topic/${topicSlug}`);
                                      }}
                                      className="rounded-full bg-amber-400 px-5 py-2 text-sm font-black text-white transition hover:bg-amber-500"
                                    >
                                      Open Topic
                                    </button>
                                  </div>
                                  {topic.subtopics && topic.subtopics.length > 0 ? (
                                    <div className="mt-4 space-y-2">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Click to mark as complete</p>
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
                                    <p className="mt-3 text-sm text-slate-500 italic">No subtopics available</p>
                                  )}
                                </div>
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
          subjectId: ctx?.subjectId || null,
          teacherNames: new Set(),
          classNames: new Set(),
        });
      }
      const item = map.get(key);
      if (!item.subjectId && ctx?.subjectId) item.subjectId = ctx.subjectId;
      const teacher = String(ctx?.teacherName || '').trim();
      const classLabel = [ctx?.className, ctx?.sectionName].filter(Boolean).join('-');
      if (teacher) item.teacherNames.add(teacher);
      if (classLabel) item.classNames.add(classLabel);
    });

    // Also include subjects that exist only in the Smart Learning map. This keeps
    // standalone uploaded materials visible even when timetable/context data is
    // missing or uses a slightly different subject label.
    smartLearningMap.forEach((mappedSubject) => {
      const key = normalize(mappedSubject?.key || mappedSubject?.title);
      if (!key) return;

      const matchingEntry = mappedSubject?.subjectId
        ? Array.from(map.entries()).find(([, item]) => item.subjectId && String(item.subjectId) === String(mappedSubject.subjectId))
        : null;
      const mapKey = matchingEntry?.[0] || key;

      if (!map.has(mapKey)) {
        map.set(mapKey, {
          key,
          title: String(mappedSubject?.title || mappedSubject?.key || 'Subject').trim(),
          subjectId: mappedSubject?.subjectId || null,
          teacherNames: new Set(),
          classNames: new Set(),
        });
      }
    });

    // Then merge with smart learning map data (lesson plans)
    return Array.from(map.values()).map((item) => {
      const fromMap = smartLearningMap.find((m) => (
        (item.subjectId && m?.subjectId && String(m.subjectId) === String(item.subjectId)) ||
        normalize(m.key || m.title) === item.key
      ));
      const mappedTopics = Array.isArray(fromMap?.topics) ? fromMap.topics : [];
      const mappedChapters = Array.isArray(fromMap?.chapters) ? fromMap.chapters : [];
      return {
        ...item,
        topics: mappedTopics,
        chapters: mappedChapters,
        teacherCount: item.teacherNames.size,
        classCount: item.classNames.size,
        hasLessonPlans: mappedChapters.length > 0 || mappedTopics.length > 0,
      };
    });
    // Removed filter - now showing all allocated subjects regardless of lesson plans
  }, [contexts, smartLearningMap]);

  const selectedSubject = useMemo(() => {
    if (!subjectKey) return null;
    const normalizedKey = normalize(subjectKey);
    const exactMatch = assignedSubjects.find((s) => s.key === normalizedKey);
    if (exactMatch) return exactMatch;

    const fuzzyMatch = assignedSubjects.find((s) => {
      const subjectTitle = normalize(s?.title);
      if (!subjectTitle) return false;
      return (
        subjectTitle === normalizedKey ||
        subjectTitle.includes(normalizedKey) ||
        normalizedKey.includes(subjectTitle)
      );
    });

    return fuzzyMatch || assignedSubjects.find((s) => String(s?.subjectId || '').trim() === String(subjectKey).trim()) || null;
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
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight">Your Subjects</h1>
              <p className="text-sm sm:text-base text-slate-600">Showing only subjects assigned to your class timetable.</p>
            </div>

            {error && (
              <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                    <div className="h-32 animate-pulse bg-slate-200 sm:h-40 lg:h-44" />
                    <div className="space-y-3 p-4 sm:p-6">
                      <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-100" />
                      <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
                      <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : assignedSubjects.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-amber-100 to-orange-100">
                  <Sparkles className="text-amber-500" size={28} />
                </div>
                <p className="text-lg font-bold text-slate-800">No real smart-learning data found</p>
                <p className="mt-1 text-sm text-slate-500">Ask your class teacher to publish lesson-plan topics/materials for your class.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                {assignedSubjects.map((subject, index) => {
                  const style = CARD_STYLES[index % CARD_STYLES.length];
                  const Icon = style.icon;
                  return (
                    <div
                      key={subject.key}
                      className={`group flex flex-col overflow-hidden rounded-3xl bg-white shadow-lg shadow-slate-200/60 ring-1 ring-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${style.glow}`}
                    >
                      <div className={`relative flex h-32 flex-col justify-end overflow-hidden bg-linear-to-br p-4 sm:h-40 sm:p-6 lg:h-44 ${style.grad}`}>
                        {/* Decorative texture */}
                        <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/10" />
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(white_1.5px,transparent_1.5px)] bg-size-[16px_16px] opacity-[0.07]" />
                        <Icon className="absolute -bottom-5 -right-5 size-24 rotate-12 text-white/20 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110" />

                        {/* Floating icon badge */}
                        <div className="absolute left-4 top-4 flex size-10 items-center justify-center rounded-2xl bg-white/20 shadow-sm backdrop-blur-md ring-1 ring-white/30 sm:left-6 sm:top-6">
                          <Icon className="size-5 text-white" />
                        </div>

                        <h3 className="relative text-xl font-black leading-tight text-white drop-shadow-sm sm:text-2xl">{subject.title}</h3>
                      </div>
                      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${style.chipA}`}>
                            <Users size={12} /> {subject.teacherCount} Teacher{subject.teacherCount > 1 ? 's' : ''}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${style.chipB}`}>
                            <CalendarDays size={12} /> {subject.classCount} Class Slot{subject.classCount > 1 ? 's' : ''}
                          </span>
                          {subject.hasLessonPlans && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                              <Layers size={12} />
                              {(subject.chapters?.length || subject.topics.length)} {(subject.chapters?.length || 0) > 0 ? 'Chapter' : 'Topic'}{(subject.chapters?.length || subject.topics.length) > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="flex-1 text-sm text-slate-600 line-clamp-2">
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
                          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-bold transition-all duration-200 ease-out ${
                            subject.hasLessonPlans
                              ? 'bg-amber-500 text-white shadow-md shadow-amber-300/40 hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-300/50 active:scale-[0.98] cursor-pointer'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                          disabled={!subject.hasLessonPlans}
                        >
                          {subject.hasLessonPlans ? (
                            <>
                              Start Learning
                              <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                            </>
                          ) : 'Coming Soon'}
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
