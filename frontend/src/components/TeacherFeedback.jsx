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
  Heart,
  Target,
  Users,
  ChevronRight,
  Search,
  Edit3,
  Shield,
  X,
  AlertCircle,
  MessageSquareText,
  CalendarDays,
  ShieldCheck,
  BarChart3,
  PieChart,
  FileText,
} from 'lucide-react';
import { clearStudentApiCacheByUrl, fetchCachedJson } from '../utils/studentApiCache';

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

const getRatingColor = (rating) => {
  if (rating >= 4.5) return 'text-green-600';
  if (rating >= 3.5) return 'text-blue-600';
  if (rating >= 2.5) return 'text-amber-600';
  return 'text-red-500';
};

const TeacherFeedback = () => {
  const [selectedSubject, setSelectedSubject] = useState('');
  const [ratings, setRatings] = useState({});
  const [hoveredRatings, setHoveredRatings] = useState({});
  const [feedback, setFeedback] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectStatusFilter, setSubjectStatusFilter] = useState('all');
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

  // Set of contextIds that the student has already reviewed
  const alreadyReviewedIds = useMemo(() => {
    const set = new Set();
    previousFeedback.forEach(item => {
      if (item.contextId) set.add(item.contextId);
      // fallback: match by subjectId + teacherId if contextId not present
    });
    return set;
  }, [previousFeedback]);

  const pendingSubjectsCount = useMemo(
    () => teacherSubjects.filter(s => !alreadyReviewedIds.has(s.contextId)).length,
    [teacherSubjects, alreadyReviewedIds]
  );

  const filteredSubjects = useMemo(() => {
    let list = teacherSubjects;
    if (subjectStatusFilter === 'pending') {
      list = list.filter(s => !alreadyReviewedIds.has(s.contextId));
    } else if (subjectStatusFilter === 'reviewed') {
      list = list.filter(s => alreadyReviewedIds.has(s.contextId));
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(s =>
      s.subjectName?.toLowerCase().includes(q) || s.teacherName?.toLowerCase().includes(q)
    );
  }, [teacherSubjects, searchQuery, subjectStatusFilter, alreadyReviewedIds]);

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

  const avatarFor = (item) => item?.teacherProfilePic
    || teacherSubjects.find((s) => s.contextId === item?.contextId || (s.teacherName && s.teacherName === item?.teacherName))?.teacherProfilePic
    || placeholderAvatar;
  const formatShortDate = (value) => (value
    ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : '');
  const visiblePrevious = showPreviousFeedback ? filteredPreviousFeedback : filteredPreviousFeedback.slice(0, 4);
  const cardClass = 'rounded-2xl border border-slate-100 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)]';

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className={`${cardClass} w-full max-w-xs p-8 text-center`}>
          <div className="mx-auto mb-3 flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-indigo-50">
            <Clock className="h-6 w-6 text-indigo-500" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Loading your teachers…</h3>
          <p className="mt-1 text-xs text-slate-500">Fetching your timetable and previous feedback.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-3 sm:p-4 lg:p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">

          {/* Left column */}
          <div className="min-w-0 space-y-3">
            {/* Header */}
            <div className={`${cardClass} relative flex items-center gap-3 overflow-hidden px-4 py-3 sm:px-5`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <MessageSquareText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Teacher Feedback</h1>
                <p className="text-xs text-slate-500 sm:text-sm">Share your thoughts and help improve the learning experience.</p>
              </div>
              <img src="/feedback.png" alt="" aria-hidden="true" className="hidden h-20 w-auto shrink-0 object-contain sm:block" />
            </div>

            {loadError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {loadError}
              </div>
            )}
            {!loadError && !feedbackWindow.isOpen && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <Clock className="h-4 w-4 shrink-0" />
                {feedbackWindow.message || 'Teacher feedback has not started yet.'}
              </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: teacherSubjects.length, label: 'Subjects', icon: BookOpen, tone: 'bg-blue-50 text-blue-600' },
                { value: pendingSubjectsCount, label: 'Pending', icon: Clock, tone: 'bg-amber-50 text-amber-500' },
                { value: totalFeedbackGiven, label: 'Reviewed', icon: CheckCircle, tone: 'bg-emerald-50 text-emerald-600' },
              ].map(({ value, label, icon: Icon, tone }) => (
                <div key={label} className={`${cardClass} flex items-center gap-3 px-3 py-3 sm:px-4`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold leading-tight text-slate-900">{value}</p>
                    <p className="truncate text-xs text-slate-500">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Filters + search */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'all', label: `All (${teacherSubjects.length})` },
                { key: 'pending', label: `Pending (${pendingSubjectsCount})` },
                { key: 'reviewed', label: `Reviewed (${totalFeedbackGiven})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSubjectStatusFilter(key)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                    subjectStatusFilter === key
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="relative ml-auto w-full sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search teacher or subject…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-xs outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Teacher list */}
            {filteredSubjects.length === 0 ? (
              <div className={`${cardClass} py-10 text-center`}>
                <Search className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                <p className="text-sm font-medium text-slate-600">
                  {subjectStatusFilter === 'pending'
                    ? "You're all caught up — no pending feedback."
                    : subjectStatusFilter === 'reviewed'
                      ? 'No reviewed subjects yet.'
                      : 'No matching subjects found'}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">Try adjusting your search or filter</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredSubjects.map((subject) => {
                  const isReviewed = alreadyReviewedIds.has(subject.contextId);
                  const slot = subject.scheduleTimes?.[0];
                  return (
                    <div
                      key={subject.contextId}
                      role="button"
                      tabIndex={0}
                      onClick={() => openFeedbackModal(subject)}
                      onKeyDown={(e) => { if (e.key === 'Enter') openFeedbackModal(subject); }}
                      className={`${cardClass} flex cursor-pointer items-center gap-3 px-3 py-3 transition-shadow hover:shadow-md sm:px-4`}
                    >
                      <img
                        src={subject.teacherProfilePic || placeholderAvatar}
                        alt={subject.teacherName}
                        className="h-12 w-12 shrink-0 rounded-full bg-slate-100 object-cover sm:h-14 sm:w-14"
                        onError={(e) => { e.target.src = placeholderAvatar; }}
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-bold text-slate-900">{subject.teacherName}</h4>
                        <p className="truncate text-xs text-slate-600">{subject.subjectName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {subject.className}{subject.sectionName ? ` - Section ${subject.sectionName}` : ''}
                          </span>
                          {slot && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {slot.dayOfWeek}{slot.time ? ` · ${slot.time}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${isReviewed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                          {isReviewed ? 'Reviewed' : 'Feedback not started'}
                        </span>
                        <button
                          type="button"
                          disabled={!feedbackWindow.isOpen}
                          onClick={(e) => { e.stopPropagation(); openFeedbackModal(subject); }}
                          className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isReviewed ? 'Update Feedback' : 'Give Feedback'}
                        </button>
                      </div>
                      <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-3">
            <div className={`${cardClass} p-2.5`}>
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3">
                <ShieldCheck className="h-8 w-8 shrink-0 fill-emerald-500 text-white" />
                <div>
                  <p className="text-sm font-bold text-emerald-700">Your privacy is protected</p>
                  <p className="text-xs leading-snug text-slate-600">Student feedback is submitted anonymously only.</p>
                </div>
              </div>
            </div>

            <div className={`${cardClass} p-3`}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
                <BarChart3 className="h-4 w-4 text-indigo-600" />
                Your Feedback Stats
              </h3>
              <div className="space-y-2">
                {[
                  { value: totalFeedbackGiven, label: 'Total Submitted', icon: Send, tone: 'bg-indigo-100 text-indigo-600' },
                  { value: `${averageRatingGiven} / 5`, label: 'Avg Rating Given', icon: Star, tone: 'bg-amber-100 text-amber-500', fill: true },
                  { value: `${responseRate}%`, label: 'Response Rate', icon: PieChart, tone: 'bg-emerald-100 text-emerald-600' },
                ].map(({ value, label, icon: Icon, tone, fill }) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
                      <Icon className={`h-4 w-4 ${fill ? 'fill-amber-400' : ''}`} />
                    </div>
                    <div>
                      <p className="text-base font-bold leading-tight text-slate-900">{value}</p>
                      <p className="text-[11px] text-slate-500">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${cardClass} p-3`}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  Previous Feedback
                </h3>
                {filteredPreviousFeedback.length > 4 && (
                  <button type="button" onClick={() => setShowPreviousFeedback((v) => !v)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                    {showPreviousFeedback ? 'Show less' : 'View all'}
                  </button>
                )}
              </div>
              {showPreviousFeedback && previousSubjectOptions.length > 1 && (
                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="mb-1 mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="all">All Subjects</option>
                  {previousSubjectOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              )}
              {visiblePrevious.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">No feedback submitted yet.</p>
              ) : (
                <div className={`divide-y divide-slate-100 ${showPreviousFeedback ? 'max-h-80 overflow-y-auto' : ''}`}>
                  {visiblePrevious.map((item) => (
                    <div key={item.id} className="flex items-center gap-2.5 py-2">
                      <img
                        src={avatarFor(item)}
                        alt={item.teacherName}
                        className="h-10 w-10 shrink-0 rounded-full bg-slate-100 object-cover"
                        onError={(e) => { e.target.src = placeholderAvatar; }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900">{item.teacherName}</p>
                        <p className="truncate text-[11px] text-slate-500">{item.subjectName}</p>
                        <p className="text-[11px] text-slate-400">{formatShortDate(item.createdAt)}</p>
                      </div>
                      <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Submitted</span>
                    </div>
                  ))}
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
