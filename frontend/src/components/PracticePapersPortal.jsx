import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Search, Loader, Play, NotebookPen,
  CheckCircle, Clock, Award, Zap, FileText, Home, ArrowUpRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import PracticeTestInterface from './PracticeTestInterface';
import { saveLearningActivity } from '../utils/learningContinuity';

// Joins subject → chapter → topic into a single meta line, skipping blanks.
const paperContextLine = (item) => {
  const subject = item.subjectName || item.subject || '';
  const chapter = item.chapterTitle || item.chapter || '';
  const topic = item.topicTitle || item.topic || (Array.isArray(item.topics) ? item.topics[0] : '') || '';
  return [subject, chapter, topic].map((v) => String(v).trim()).filter(Boolean);
};

const ContextBadges = ({ item }) => {
  const parts = paperContextLine(item);
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {parts.map((part, idx) => (
        <React.Fragment key={`${part}-${idx}`}>
          {idx > 0 && <span className="text-gray-300">›</span>}
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            idx === 0 ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'bg-gray-100 text-gray-600'
          }`}>
            {part}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

const PracticePapersPortal = () => {
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  // State
  const [papers, setPapers] = useState([]);
  const [homework, setHomework] = useState([]);
  const [homeworkLoading, setHomeworkLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [takingTest, setTakingTest] = useState(false);

  const authHeaders = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  // Fetch homework (assignments given by teachers to solve at home)
  useEffect(() => {
    const fetchHomework = async () => {
      setHomeworkLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/assignment/student/assignments`, {
          headers: authHeaders
        });
        if (response.ok) {
          const data = await response.json();
          setHomework(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Error fetching homework:', err);
      } finally {
        setHomeworkLoading(false);
      }
    };

    fetchHomework();
  }, [API_BASE, authHeaders]);

  // Fetch class work (practice papers published from what was taught in class)
  useEffect(() => {
    const fetchPapers = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);

        const response = await fetch(`${API_BASE}/api/practice-papers/student/papers?${params}`, {
          headers: authHeaders
        });

        if (!response.ok) throw new Error('Failed to fetch papers');

        const data = await response.json();
        setPapers(data.papers || []);
      } catch (err) {
        console.error('Error fetching papers:', err);
        toast.error('Failed to load practice papers');
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchPapers, 300);
    return () => clearTimeout(debounceTimer);
  }, [API_BASE, authHeaders, searchQuery]);

  // Filter class work by difficulty + search; homework by search only
  const filteredPapers = useMemo(() => {
    return papers.filter(p => {
      if (difficultyFilter !== 'all' && p.difficulty !== difficultyFilter) return false;
      return true;
    });
  }, [papers, difficultyFilter]);

  const filteredHomework = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return homework;
    return homework.filter((hw) =>
      [hw.title, hw.subject, hw.chapterTitle, hw.topicTitle, hw.topic]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [homework, searchQuery]);

  const openPaper = (paper) => {
    setSelectedPaper(paper);
    saveLearningActivity({
      path: '/student/practice-papers',
      label: 'Class Work',
      detail: paper.title,
    });
  };

  // If taking test
  if (takingTest && selectedPaper) {
    return (
      <PracticeTestInterface
        paperId={selectedPaper._id}
        paperTitle={selectedPaper.title}
        onBack={() => {
          setTakingTest(false);
          // Refetch papers to update attempt counts
          setPapers(papers.map(p => p._id === selectedPaper._id ? selectedPaper : p));
        }}
      />
    );
  }

  // Paper details view
  if (selectedPaper && !takingTest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setSelectedPaper(null)}
            className="mb-6 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            ← Back to Papers
          </button>

          <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">{selectedPaper.title}</h1>
                  <div className="mb-2">
                    <ContextBadges item={selectedPaper} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-gray-600">
                    <span className="text-sm font-medium">Questions: {selectedPaper.totalQuestions}</span>
                    <span className="text-sm">•</span>
                    <span className="text-sm font-medium">Total Marks: {selectedPaper.totalMarks}</span>
                  </div>
                </div>
                <button
                  onClick={() => setTakingTest(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 whitespace-nowrap"
                >
                  <Play className="w-5 h-5" />
                  Start Test
                </button>
              </div>

              {/* Tags */}
              {selectedPaper.tags && selectedPaper.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedPaper.tags.map((tag, idx) => (
                    <span key={idx} className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-600 mb-1">Duration</p>
                <p className="font-semibold flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {selectedPaper.duration ? `${selectedPaper.duration} min` : 'No limit'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Difficulty</p>
                <p className="font-semibold capitalize">{selectedPaper.difficulty}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Passing Score</p>
                <p className="font-semibold">{selectedPaper.passingPercentage}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Attempts</p>
                <p className="font-semibold">{selectedPaper.allowRetakes ? 'Unlimited' : 'Once only'}</p>
              </div>
            </div>

            {/* Description */}
            {selectedPaper.description && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-2">Instructions</h2>
                <p className="text-gray-700 whitespace-pre-line">{selectedPaper.description}</p>
              </div>
            )}

            {/* Question Breakdown */}
            <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h2 className="text-lg font-semibold mb-4">Question Breakdown</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {selectedPaper.questions.slice(0, 6).map((q, idx) => (
                  <div key={idx} className="text-sm">
                    <p className="text-gray-600">Q{idx + 1}</p>
                    <p className="font-medium line-clamp-2">{q.questionText}</p>
                    <p className="text-xs text-gray-500 mt-1">{q.marks} marks • {q.questionType}</p>
                  </div>
                ))}
                {selectedPaper.totalQuestions > 6 && (
                  <div className="text-sm">
                    <p className="text-gray-600">...</p>
                    <p className="font-medium">+{selectedPaper.totalQuestions - 6} more</p>
                  </div>
                )}
              </div>
            </div>

            {/* Statistics */}
            {selectedPaper.totalAttempts > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h2 className="text-lg font-semibold mb-4">Class Statistics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Attempts</p>
                    <p className="text-2xl font-bold text-amber-600">{selectedPaper.totalAttempts}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Average Score</p>
                    <p className="text-2xl font-bold text-blue-600">{selectedPaper.averageScore}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pass Rate</p>
                    <p className="text-2xl font-bold text-green-600">{selectedPaper.passRate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Highest Score</p>
                    <p className="text-2xl font-bold text-purple-600">{selectedPaper.highestScore}%</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main list view — Class Work (done in class) + Home Work (to solve at home)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Zap className="w-8 h-8" />
            Practice
          </h1>
          <p className="text-gray-600">Class work from today's lessons, and homework to solve at home</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title, subject, chapter or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Difficulty Filter (class work only) */}
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        {/* ── Class Work ── */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <NotebookPen className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">Class Work</h2>
              <p className="text-xs text-gray-500">Practice what your teacher covered in class</p>
            </div>
            {!loading && (
              <span className="ml-auto text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                {filteredPapers.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredPapers.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-10 text-center">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No class work yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Papers appear here after your teacher publishes the day's lesson.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPapers.map(paper => (
                <div
                  key={paper._id}
                  onClick={() => openPaper(paper)}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer overflow-hidden border border-transparent hover:border-blue-200"
                >
                  {/* Card Header */}
                  <div className="p-4 sm:p-5 border-b">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-lg font-semibold line-clamp-2 flex-1">{paper.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                        paper.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                        paper.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {paper.difficulty}
                      </span>
                    </div>
                    <ContextBadges item={paper} />
                  </div>

                  {/* Card Content */}
                  <div className="p-4 sm:p-5 space-y-3">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <FileText className="w-4 h-4" />
                        <span>{paper.totalQuestions} Q</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <Award className="w-4 h-4" />
                        <span>{paper.totalMarks} marks</span>
                      </div>
                      {paper.duration > 0 && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>{paper.duration} min</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-gray-600">
                        <span className="text-xs">Pass: {paper.passingPercentage}%</span>
                      </div>
                    </div>

                    {/* Class Stats */}
                    {paper.totalAttempts > 0 && (
                      <div className="pt-2 border-t text-xs text-gray-600">
                        <p>{paper.passRate}% pass rate • Avg: {paper.averageScore}%</p>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="px-4 sm:px-5 py-3 bg-gray-50 border-t flex items-center justify-between">
                    <span className="text-xs text-gray-600">
                      {new Date(paper.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openPaper(paper);
                      }}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Start
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Home Work ── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Home className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">Home Work</h2>
              <p className="text-xs text-gray-500">Assignments your teacher gave you to solve at home</p>
            </div>
            {!homeworkLoading && (
              <span className="ml-auto text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                {filteredHomework.length}
              </span>
            )}
          </div>

          {homeworkLoading ? (
            <div className="flex justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : filteredHomework.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-10 text-center">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No homework right now</p>
              <p className="text-sm text-gray-500 mt-1">
                Assignments from your teachers will show up here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHomework.map((hw) => {
                const due = hw.dueDate ? new Date(hw.dueDate) : null;
                const submitted = hw.submissionStatus && hw.submissionStatus !== 'not_submitted';
                const overdue = !submitted && due && due < new Date();
                return (
                  <div
                    key={hw._id}
                    onClick={() => {
                      saveLearningActivity({ path: '/student/assignments', label: 'Home Work', detail: hw.title });
                      navigate('/student/assignments');
                    }}
                    className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer overflow-hidden border border-transparent hover:border-emerald-200"
                  >
                    <div className="p-4 sm:p-5 border-b">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-lg font-semibold line-clamp-2 flex-1">{hw.title}</h3>
                        {submitted ? (
                          <span className="text-xs px-2 py-1 rounded-full whitespace-nowrap bg-emerald-100 text-emerald-700 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Done
                          </span>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                            overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {overdue ? 'Overdue' : 'To do'}
                          </span>
                        )}
                      </div>
                      <ContextBadges item={hw} />
                    </div>

                    <div className="p-4 sm:p-5 space-y-2 text-sm text-gray-600">
                      {hw.description && <p className="line-clamp-2">{hw.description}</p>}
                      <div className="flex items-center gap-4 text-xs">
                        {due && (
                          <span className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-semibold' : ''}`}>
                            <Clock className="w-3.5 h-3.5" />
                            Due {due.toLocaleDateString()}
                          </span>
                        )}
                        {Number(hw.marks) > 0 && (
                          <span className="flex items-center gap-1">
                            <Award className="w-3.5 h-3.5" /> {hw.marks} marks
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-4 sm:px-5 py-3 bg-gray-50 border-t flex items-center justify-between">
                      <span className="text-xs text-gray-600">{hw.teacherId?.name || hw.teacherName || ''}</span>
                      <span className="px-3 py-1 text-sm bg-emerald-600 text-white rounded flex items-center gap-1">
                        {submitted ? 'Review' : 'Solve'}
                        <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PracticePapersPortal;
