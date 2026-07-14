import React, { useEffect, useMemo, useState } from 'react';
import {
  Star,
  MessageCircle,
  BookOpen,
  Clock,
  CheckCircle,
  Send,
  RotateCcw,
  Award,
  TrendingUp,
  Heart,
  Target,
  Users,
  ChevronDown,
  ChevronRight,
  Search,
  Eye,
  Edit3,
  Shield,
  X,
  AlertCircle
} from 'lucide-react';
import { clearStudentApiCacheByUrl, fetchCachedJson } from '../utils/studentApiCache';

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

const getRatingColor = (rating) => {
  if (rating >= 4.5) return 'text-green-600';
  if (rating >= 3.5) return 'text-blue-600';
  if (rating >= 2.5) return 'text-amber-600';
  return 'text-red-500';
};

const RatingBadge = ({ rating }) => {
  const color = getRatingColor(rating);
  return (
    <span className={`font-bold tabular-nums ${color}`}>{Number(rating).toFixed(1)}</span>
  );
};

const TeacherFeedback = () => {
  const [selectedSubject, setSelectedSubject] = useState('');
  const [ratings, setRatings] = useState({});
  const [hoveredRatings, setHoveredRatings] = useState({});
  const [feedback, setFeedback] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [showPreviousFeedback, setShowPreviousFeedback] = useState(false);
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [previousFeedback, setPreviousFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submittedContext, setSubmittedContext] = useState(null);
  const [feedbackWindow, setFeedbackWindow] = useState({
    isOpen: true,
    reason: '',
    message: '',
    startDate: null,
    endDate: null,
    enabled: true,
  });

  const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  const FEEDBACK_CONTEXT_ENDPOINT = `${API_BASE_URL}/api/student/auth/teacher-feedback/context`;
  const FEEDBACK_HISTORY_ENDPOINT = `${API_BASE_URL}/api/student/auth/teacher-feedback`;
  const FEEDBACK_CONTEXT_CACHE_TTL_MS = 5 * 60 * 1000;
  const FEEDBACK_HISTORY_CACHE_TTL_MS = 2 * 60 * 1000;
  const placeholderAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";

  const ratingCategories = [
    { id: 'teaching_quality', label: 'Teaching Quality', description: 'How well does the teacher explain concepts?', icon: Award },
    { id: 'communication', label: 'Communication', description: "How clear and effective is the teacher's communication?", icon: MessageCircle },
    { id: 'engagement', label: 'Student Engagement', description: 'How well does the teacher engage students in learning?', icon: Users },
    { id: 'preparation', label: 'Class Preparation', description: 'How well-prepared is the teacher for each class?', icon: BookOpen },
    { id: 'availability', label: 'Availability & Support', description: 'How accessible is the teacher for questions and help?', icon: Heart },
    { id: 'fairness', label: 'Fair Assessment', description: "How fair and consistent is the teacher's grading?", icon: Target },
  ];

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');
      if (!token || userType !== 'Student') {
        setLoadError('Student session not found. Please login again.');
        setLoading(false);
        return;
      }
      setLoadError('');
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [{ data: contextData }, { data: historyData }] = await Promise.all([
          fetchCachedJson(FEEDBACK_CONTEXT_ENDPOINT, {
            ttlMs: FEEDBACK_CONTEXT_CACHE_TTL_MS,
            fetchOptions: { headers }
          }),
          fetchCachedJson(FEEDBACK_HISTORY_ENDPOINT, {
            ttlMs: FEEDBACK_HISTORY_CACHE_TTL_MS,
            fetchOptions: { headers }
          })
        ]);
        setTeacherSubjects(Array.isArray(contextData.teachers) ? contextData.teachers : []);
        setFeedbackWindow({
          isOpen: Boolean(contextData?.feedbackWindow?.isOpen ?? true),
          reason: contextData?.feedbackWindow?.reason || '',
          message: contextData?.feedbackWindow?.message || '',
          startDate: contextData?.feedbackWindow?.startDate || null,
          endDate: contextData?.feedbackWindow?.endDate || null,
          enabled: Boolean(contextData?.feedbackWindow?.enabled ?? true),
        });
        setPreviousFeedback(Array.isArray(historyData) ? historyData : []);
      } catch (err) {
        console.error('Teacher feedback fetch error:', err);
        setLoadError(err.message || 'Failed to load teacher feedback data.');
        setTeacherSubjects([]);
        setPreviousFeedback([]);
        setFeedbackWindow({
          isOpen: false,
          reason: 'feedback_not_available',
          message: 'Teacher feedback is not available right now.',
          startDate: null,
          endDate: null,
          enabled: false,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [
    FEEDBACK_CONTEXT_ENDPOINT,
    FEEDBACK_HISTORY_ENDPOINT,
    FEEDBACK_CONTEXT_CACHE_TTL_MS,
    FEEDBACK_HISTORY_CACHE_TTL_MS,
  ]);

  const selectedContext = useMemo(
    () => teacherSubjects.find(s => s.contextId === selectedSubject),
    [teacherSubjects, selectedSubject]
  );

  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return teacherSubjects;
    const q = searchQuery.toLowerCase();
    return teacherSubjects.filter(s =>
      s.subjectName?.toLowerCase().includes(q) || s.teacherName?.toLowerCase().includes(q)
    );
  }, [teacherSubjects, searchQuery]);

  // Set of contextIds that the student has already reviewed
  const alreadyReviewedIds = useMemo(() => {
    const set = new Set();
    previousFeedback.forEach(item => {
      if (item.contextId) set.add(item.contextId);
      // fallback: match by subjectId + teacherId if contextId not present
    });
    return set;
  }, [previousFeedback]);

  const previousSubjectOptions = useMemo(() => {
    const set = new Set();
    previousFeedback.forEach(item => { if (item.subjectName) set.add(item.subjectName); });
    return Array.from(set);
  }, [previousFeedback]);

  const filteredPreviousFeedback = useMemo(() => {
    if (filterSubject === 'all') return previousFeedback;
    return previousFeedback.filter(item => item.subjectName === filterSubject);
  }, [previousFeedback, filterSubject]);

  const totalFeedbackGiven = previousFeedback.length;
  const averageRatingGiven = totalFeedbackGiven
    ? (previousFeedback.reduce((sum, item) => sum + (item.overallRating || 0), 0) / totalFeedbackGiven).toFixed(1)
    : '0.0';
  const responseRate = teacherSubjects.length
    ? Math.min(100, Math.round((totalFeedbackGiven / teacherSubjects.length) * 100))
    : 0;

  const ratedCount = Object.keys(ratings).length;
  const totalCategories = ratingCategories.length;

  const getAverageRating = () => {
    const vals = Object.values(ratings);
    if (!vals.length) return 0;
    return (vals.reduce((s, r) => s + r, 0) / vals.length).toFixed(1);
  };

  const handleRatingChange = (category, rating) => setRatings(prev => ({ ...prev, [category]: rating }));
  const handleRatingHover = (category, rating) => setHoveredRatings(prev => ({ ...prev, [category]: rating }));
  const handleRatingLeave = (category) => setHoveredRatings(prev => ({ ...prev, [category]: 0 }));

  const getSelectedContextOrAlert = () => {
    if (!selectedSubject) { setSubmitError('Please select a subject before submitting feedback.'); return null; }
    const context = teacherSubjects.find(s => s.contextId === selectedSubject);
    if (!context) { setSubmitError('Selected subject is no longer available. Please choose again.'); return null; }
    if (ratedCount === 0) { setSubmitError('Please provide at least one rating before submitting.'); return null; }
    return context;
  };

  const handleSubmit = async () => {
    setSubmitError('');
    if (!feedbackWindow.isOpen) {
      setSubmitError(feedbackWindow.message || 'Teacher feedback is not open right now.');
      return;
    }
    const context = getSelectedContextOrAlert();
    if (!context) return;
    const token = localStorage.getItem('token');
    if (!token) { setSubmitError('Student session not found. Please login again.'); return; }
    setSubmittingFeedback(true);
    try {
      const response = await fetch(FEEDBACK_HISTORY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          teacherId: context.teacherId,
          subjectId: context.subjectId,
          subjectName: context.subjectName,
          ratings,
          comments: feedback,
          anonymous: true
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit feedback');
      clearStudentApiCacheByUrl(FEEDBACK_HISTORY_ENDPOINT);
      clearStudentApiCacheByUrl(FEEDBACK_CONTEXT_ENDPOINT);
      if (data.feedback) setPreviousFeedback(prev => [data.feedback, ...prev]);
      setSubmittedContext(context);
      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setSubmittedContext(null);
        setIsModalOpen(false);
        resetForm();
      }, 2800);
    } catch (err) {
      console.error('Feedback submit error:', err);
      setSubmitError(err.message || 'Failed to submit feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const resetForm = (keepSelection = false) => {
    setRatings({});
    setHoveredRatings({});
    setFeedback('');
    setSubmitError('');
    if (!keepSelection) setSelectedSubject('');
  };

  const openFeedbackModal = (subject) => {
    if (!feedbackWindow.isOpen) {
      setSubmitError(feedbackWindow.message || 'Teacher feedback is not open right now.');
      return;
    }
    resetForm(true);
    setSelectedSubject(subject.contextId);
    setIsModalOpen(true);
    setIsSubmitted(false);
    setSubmittedContext(null);
  };

  const closeFeedbackModal = () => {
    setIsModalOpen(false);
    setIsSubmitted(false);
    setSubmittedContext(null);
    setSubmittingFeedback(false);
    resetForm();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-purple-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 text-center border border-yellow-200 max-w-sm w-full">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="text-xl font-bold text-amber-900 mb-2">Loading your teachers…</h3>
          <p className="text-amber-600 text-sm">Fetching your timetable and previous feedback.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-purple-50 p-4 sm:p-6">

        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-purple-600 rounded-2xl p-6 sm:p-8 text-white mb-6 sm:mb-8 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-1 flex items-center gap-3">
                <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0" />
                Teacher Feedback
              </h1>
              <p className="text-yellow-100 text-sm sm:text-base">
                Share your thoughts and help improve the learning experience
              </p>
            </div>
            <div className="flex gap-3 sm:gap-4 self-start sm:self-auto">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center min-w-[80px]">
                <div className="text-2xl sm:text-3xl font-bold">{teacherSubjects.length}</div>
                <div className="text-xs text-yellow-100">Subjects</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center min-w-[80px]">
                <div className="text-2xl sm:text-3xl font-bold">{totalFeedbackGiven}</div>
                <div className="text-xs text-yellow-100">Reviewed</div>
              </div>
            </div>
          </div>
        </div>

        {loadError && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{loadError}</span>
          </div>
        )}
        {!loadError && !feedbackWindow.isOpen && (
          <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{feedbackWindow.message || 'Teacher feedback has not started yet.'}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">

          {/* Left Column */}
          <div className="lg:col-span-2 space-y-5">

            {/* Subject Selection */}
            <div className="bg-white rounded-2xl shadow-md p-5 sm:p-6 border border-yellow-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-900">Select a Teacher</h3>
                  <p className="text-xs text-amber-600">Tap a card to open the feedback form</p>
                </div>
              </div>

              {/* Search */}
              <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search subjects or teachers…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-yellow-200 rounded-xl text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Cards */}
              {filteredSubjects.length === 0 ? (
                <div className="col-span-2 text-center py-10">
                  <Search className="w-10 h-10 text-amber-200 mx-auto mb-3" />
                  <p className="text-sm text-amber-600 font-medium">No matching subjects found</p>
                  <p className="text-xs text-amber-400 mt-1">Try adjusting your search query</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredSubjects.map((subject) => {
                    const isReviewed = alreadyReviewedIds.has(subject.contextId);
                    const isSelected = selectedSubject === subject.contextId;
                    return (
                      <button
                        key={subject.contextId}
                        onClick={() => openFeedbackModal(subject)}
                        disabled={!feedbackWindow.isOpen}
                        className={`w-full text-left p-4 border-2 rounded-xl transition-all duration-200 group ${
                          isSelected
                            ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-100 shadow-md'
                            : feedbackWindow.isOpen
                              ? 'border-yellow-200 bg-white hover:border-amber-300 hover:shadow-md'
                              : 'border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={subject.teacherProfilePic || placeholderAvatar}
                            alt={subject.teacherName}
                            className="w-11 h-11 rounded-full object-cover border-2 border-white shadow flex-shrink-0"
                            onError={(e) => { e.target.src = placeholderAvatar; }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-0.5">
                              <h4 className="font-bold text-amber-900 text-sm leading-tight truncate">
                                {subject.subjectName}
                              </h4>
                              {isReviewed && (
                                <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                                  <CheckCircle className="w-3 h-3" />
                                  Reviewed
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-amber-500 truncate mb-1">
                              {subject.className}
                              {subject.sectionName ? ` · Section ${subject.sectionName}` : ''}
                            </p>
                            <p className="text-sm font-medium text-amber-800 truncate">{subject.teacherName}</p>
                            {subject.scheduleTimes?.length > 0 && (
                              <p className="text-xs text-amber-500 mt-0.5">
                                <Clock className="inline w-3 h-3 mr-0.5 -mt-0.5" />
                                {subject.scheduleTimes[0].dayOfWeek}
                                {subject.scheduleTimes[0].time ? ` · ${subject.scheduleTimes[0].time}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className={`mt-3 text-xs font-medium rounded-lg py-1.5 text-center transition-colors ${
                          !feedbackWindow.isOpen
                            ? 'bg-slate-100 text-slate-500 border border-slate-200'
                            : isReviewed
                            ? 'bg-green-50 text-green-700 border border-green-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100 group-hover:bg-amber-100'
                        }`}>
                          {!feedbackWindow.isOpen ? 'Feedback not started' : isReviewed ? 'Update your feedback' : 'Give feedback →'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Privacy note */}
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-start gap-3">
              <div className="p-1.5 bg-purple-100 rounded-lg flex-shrink-0 mt-0.5">
                <Shield className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-purple-900 mb-0.5">Your privacy is protected</p>
                <p className="text-xs text-purple-700 leading-relaxed">
                  Student feedback is submitted anonymously only.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-5">

            {/* Quick Stats */}
            <div className="bg-white rounded-2xl shadow-md p-5 border border-yellow-100">
              <h3 className="text-sm font-bold text-amber-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                Your Feedback Stats
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                  <span className="text-sm text-amber-700">Total Submitted</span>
                  <span className="font-bold text-amber-900">{totalFeedbackGiven}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl">
                  <span className="text-sm text-purple-700">Avg Rating Given</span>
                  <span className="font-bold text-purple-900">{averageRatingGiven} / 5</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                  <span className="text-sm text-green-700">Response Rate</span>
                  <span className="font-bold text-green-900">{responseRate}%</span>
                </div>
                {/* Response rate bar */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${responseRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Previous Feedback */}
            <div className="bg-white rounded-2xl shadow-md border border-yellow-100 overflow-hidden">
              <div className="p-5 border-b border-yellow-100">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-500" />
                    Previous Feedback
                    {totalFeedbackGiven > 0 && (
                      <span className="ml-1 text-xs font-medium text-white bg-purple-500 rounded-full px-1.5 py-0.5">
                        {totalFeedbackGiven}
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => setShowPreviousFeedback(!showPreviousFeedback)}
                    className="text-xs font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1"
                  >
                    {showPreviousFeedback ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    {showPreviousFeedback ? 'Collapse' : 'View all'}
                  </button>
                </div>
                {showPreviousFeedback && previousSubjectOptions.length > 0 && (
                  <select
                    value={filterSubject}
                    onChange={(e) => setFilterSubject(e.target.value)}
                    className="mt-3 w-full px-3 py-2 text-sm border border-yellow-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                  >
                    <option value="all">All Subjects</option>
                    {previousSubjectOptions.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}
              </div>

              {showPreviousFeedback && (
                <div className="max-h-96 overflow-y-auto divide-y divide-yellow-50">
                  {filteredPreviousFeedback.length === 0 ? (
                    <div className="p-6 text-center">
                      <MessageCircle className="w-8 h-8 text-amber-200 mx-auto mb-2" />
                      <p className="text-sm text-amber-500">No feedback records yet.</p>
                    </div>
                  ) : (
                    filteredPreviousFeedback.map((item) => (
                      <div key={item.id} className="p-4 hover:bg-amber-50/50 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-amber-900 leading-tight">{item.subjectName}</h4>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-500" />
                            <RatingBadge rating={item.overallRating || 0} />
                          </div>
                        </div>
                        <p className="text-xs text-amber-500 mb-1">{item.teacherName}</p>
                        {item.comments && (
                          <p className="text-xs text-amber-700 italic mb-2 line-clamp-2">"{item.comments}"</p>
                        )}
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="text-xs text-amber-400">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {item.isAnonymous && (
                              <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full border border-purple-100">
                                Anonymous
                              </span>
                            )}
                            <span className="text-xs text-amber-400">
                              {Object.keys(item.ratings || {}).length}/{totalCategories} rated
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:px-4 sm:py-8 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) closeFeedbackModal(); }}
        >
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-purple-100 rounded-t-2xl">

            {/* Modal Header */}
            <div className="flex items-start justify-between px-5 sm:px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-amber-50 rounded-xl flex-shrink-0">
                  <Star className="w-5 h-5 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 mb-0.5">Feedback for</p>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight truncate">
                    {selectedContext?.teacherName || submittedContext?.teacherName || 'Teacher'}
                  </h3>
                  <p className="text-sm text-slate-500 truncate">
                    {selectedContext?.subjectName || submittedContext?.subjectName || 'Subject'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeFeedbackModal}
                className="flex-shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 px-5 sm:px-6 py-5 space-y-5">
              {isSubmitted ? (
                <div className="text-center py-10">
                  <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </div>
                  <h4 className="text-2xl font-bold text-slate-900 mb-2">Feedback Sent!</h4>
                  <p className="text-slate-500 text-sm mb-5">
                    Thank you for your thoughts about{' '}
                    <strong className="text-slate-700">
                      {submittedContext?.teacherName || selectedContext?.teacherName || 'your teacher'}
                    </strong>.
                  </p>
                  <div className="inline-flex flex-col items-center bg-slate-50 border border-slate-100 rounded-2xl px-8 py-4 gap-1">
                    <span className="font-bold text-slate-800">
                      {submittedContext?.subjectName || selectedContext?.subjectName}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-5 h-5 ${s <= Math.round(getAverageRating()) ? 'fill-yellow-400 text-yellow-500' : 'text-gray-200'}`} />
                      ))}
                      <span className="text-sm text-slate-500 ml-1">{getAverageRating()} / 5</span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Progress bar */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-600">Categories rated</span>
                        <span className="text-xs font-bold text-purple-700">{ratedCount} / {totalCategories}</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-purple-500 rounded-full transition-all duration-300"
                          style={{ width: `${(ratedCount / totalCategories) * 100}%` }}
                        />
                      </div>
                    </div>
                    {ratedCount > 0 && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-slate-400">Avg</p>
                        <p className={`text-lg font-bold ${getRatingColor(getAverageRating())}`}>{getAverageRating()}</p>
                      </div>
                    )}
                  </div>

                  {/* Rating Categories */}
                  <div className="space-y-3">
                    {ratingCategories.map((category) => {
                      const Icon = category.icon;
                      const currentRating = hoveredRatings[category.id] || ratings[category.id] || 0;
                      const isRated = !!ratings[category.id];
                      return (
                        <div
                          key={category.id}
                          className={`border rounded-xl p-4 transition-colors ${
                            isRated ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg flex-shrink-0 ${isRated ? 'bg-amber-100' : 'bg-slate-100'}`}>
                              <Icon className={`w-4 h-4 ${isRated ? 'text-amber-600' : 'text-slate-400'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <h4 className="text-sm font-semibold text-slate-800">{category.label}</h4>
                                {isRated && (
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    ratings[category.id] >= 4 ? 'bg-green-100 text-green-700' :
                                    ratings[category.id] >= 3 ? 'bg-blue-100 text-blue-700' :
                                    'bg-red-100 text-red-600'
                                  }`}>
                                    {STAR_LABELS[ratings[category.id]]}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mb-2">{category.description}</p>
                              <div className="flex items-center gap-1.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    title={STAR_LABELS[star]}
                                    className="focus:outline-none transition-transform active:scale-90 hover:scale-110 p-1.5"
                                    onMouseEnter={() => handleRatingHover(category.id, star)}
                                    onMouseLeave={() => handleRatingLeave(category.id)}
                                    onClick={() => handleRatingChange(category.id, star)}
                                  >
                                    <Star
                                      className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                                        star <= currentRating
                                          ? 'fill-yellow-400 text-yellow-500'
                                          : 'text-slate-200 hover:text-slate-300'
                                      }`}
                                    />
                                  </button>
                                ))}
                                {hoveredRatings[category.id] > 0 && (
                                  <span className="ml-1 text-xs font-medium text-amber-600">
                                    {STAR_LABELS[hoveredRatings[category.id]]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Privacy mode */}
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded-xl shadow-sm text-purple-600 flex-shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-purple-900">Anonymous submission</p>
                        <p className="text-xs text-purple-500">Teacher sees "Anonymous Student" for every feedback.</p>
                      </div>
                    </div>
                  </div>

                  {/* Comments */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Edit3 className="w-4 h-4 text-green-600" />
                      <h4 className="text-sm font-semibold text-slate-800">Comments <span className="text-slate-400 font-normal">(optional)</span></h4>
                    </div>
                    <textarea
                      rows="3"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="What went really well? What could improve? Be specific…"
                      maxLength={500}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent resize-none outline-none"
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden mr-3">
                        <div
                          className={`h-full rounded-full transition-all ${
                            feedback.length > 450 ? 'bg-red-400' : feedback.length > 300 ? 'bg-amber-400' : 'bg-green-400'
                          }`}
                          style={{ width: `${(feedback.length / 500) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0">{feedback.length} / 500</span>
                    </div>
                  </div>

                  {/* Error */}
                  {submitError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {submitError}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            {!isSubmitted && (
              <div className="px-5 sm:px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0 bg-white rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => resetForm(true)}
                  disabled={submittingFeedback}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!feedbackWindow.isOpen || !selectedSubject || ratedCount === 0 || submittingFeedback}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {submittingFeedback ? 'Submitting…' : `Submit${ratedCount > 0 ? ` (${ratedCount}/${totalCategories})` : ''}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default TeacherFeedback;
