import React, { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FileText,
  CheckCircle,
  Clock,
  User,
  BookOpen,
  Star,
  Calendar,
  Eye,
  Award,
  X,
  AlertCircle,
  Filter,
  Download,
  ExternalLink,
  RefreshCcw,
  BarChart2,
  Sparkles,
  Target,
  ListChecks,
  Activity,
  Brain,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const AssignmentEvaluation = () => {
  const [submissions, setSubmissions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);          // the submission being graded
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // rubric
  const [rubrics, setRubrics] = useState([]);
  const [selectedRubricId, setSelectedRubricId] = useState('');
  const [criterionScores, setCriterionScores] = useState({});
  const [showRubric, setShowRubric] = useState(false);

  // AI feedback
  const [aiFeedback, setAiFeedback] = useState('');
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false);
  const [showAiFeedback, setShowAiFeedback] = useState(false);

  // filter bar
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | pending | graded
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('recent');

  const token = () => localStorage.getItem('token');

  // ── fetch all submissions for this teacher ────────────────────────────────
  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_BASE}/api/assignment/teacher/submissions`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      setSubmissions(data);
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubmissions(); }, []);

  useEffect(() => {
    axios.get(`${API_BASE}/api/rubrics`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => setRubrics(r.data?.data || []))
      .catch(() => {});
  }, []);

  // ── derived lists ─────────────────────────────────────────────────────────
  const assignmentTitles = ['all', ...new Set(submissions.map(s => s.assignmentTitle))];

  useEffect(() => {
    let list = [...submissions];
    if (statusFilter !== 'all') {
      list = list.filter(s =>
        statusFilter === 'graded' ? s.score !== null : s.score === null
      );
    }
    if (assignmentFilter !== 'all') {
      list = list.filter(s => s.assignmentTitle === assignmentFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.studentName?.toLowerCase().includes(q) ||
        s.assignmentTitle?.toLowerCase().includes(q) ||
        s.subject?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const dateA = new Date(a.submittedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.submittedAt || b.createdAt || 0).getTime();
      return sortOrder === 'oldest' ? dateA - dateB : dateB - dateA;
    });
    setFiltered(list);
  }, [submissions, statusFilter, assignmentFilter, search, sortOrder]);

  // ── open a submission ─────────────────────────────────────────────────────
  const openSubmission = (sub) => {
    setSelected(sub);
    setMarks(sub.score !== null && sub.score !== undefined ? String(sub.score) : '');
    setFeedback(sub.feedback || '');
    setSaveError('');
    setShowPdfPreview(false);
    setSelectedRubricId('');
    setCriterionScores({});
    setShowRubric(false);
    setAiFeedback('');
    setShowAiFeedback(false);
  };

  const closePanel = () => {
    setSelected(null);
    setSaveError('');
    setShowPdfPreview(false);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setAssignmentFilter('all');
    setSortOrder('recent');
  };

  const handleRefresh = () => {
    fetchSubmissions();
  };

  // ── save grade ────────────────────────────────────────────────────────────
  const saveGrade = async () => {
    const numMarks = parseFloat(marks);
    if (isNaN(numMarks) || numMarks < 0) {
      setSaveError('Please enter a valid mark (≥ 0).');
      return;
    }
    if (numMarks > selected.totalMarks) {
      setSaveError(`Marks cannot exceed ${selected.totalMarks}.`);
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await axios.post(
        `${API_BASE}/api/assignment/teacher/grade`,
        {
          studentId: selected.studentId,
          assignmentId: selected.assignmentId,
          score: numMarks,
          feedback
        },
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      // update local state immediately
      setSubmissions(prev =>
        prev.map(s =>
          s.submissionId === selected.submissionId
            ? { ...s, score: numMarks, feedback, status: 'graded' }
            : s
        )
      );
      setSelected(prev => ({ ...prev, score: numMarks, feedback, status: 'graded' }));
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── rubric scoring ────────────────────────────────────────────────────────
  const activeRubric = rubrics.find((r) => r._id === selectedRubricId) || null;

  const applyRubricScore = () => {
    if (!activeRubric) return;
    const total = activeRubric.criteria.reduce((sum, c, i) => sum + (Number(criterionScores[i]) || 0), 0);
    setMarks(String(total));
  };

  // ── AI feedback ───────────────────────────────────────────────────────────
  const generateAiFeedback = async () => {
    if (!selected) return;
    setAiFeedbackLoading(true);
    setShowAiFeedback(true);
    try {
      const { data } = await axios.post(
        `${API_BASE}/api/ai-tutor/assignment-feedback`,
        {
          submissionText: selected.submissionText || '(no text — see attached file)',
          subject: selected.subject,
          assignmentTitle: selected.assignmentTitle,
          studentName: selected.studentName,
        },
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      setAiFeedback(data?.data?.content || 'No feedback generated.');
      if (!feedback) setFeedback(data?.data?.content || '');
    } catch {
      setAiFeedback('Could not generate AI feedback. Please try again.');
    } finally {
      setAiFeedbackLoading(false);
    }
  };

  // ── helpers ───────────────────────────────────────────────────────────────
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const formatTime = (d) => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

  const statusChip = (sub) => {
    if (sub.score !== null && sub.score !== undefined)
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">Graded</span>;
    if (sub.status === 'late')
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">Late</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">Pending</span>;
  };

  const pendingCount = submissions.filter(s => s.score === null || s.score === undefined).length;
  const gradedCount = submissions.filter(s => s.score !== null && s.score !== undefined).length;
  const lateCount = submissions.filter((s) => s.status === 'late').length;
  const gradedSubmissions = submissions.filter(
    (s) => s.score !== null && s.score !== undefined && s.totalMarks
  );
  const averageScore = gradedSubmissions.length
    ? Math.round(
        (gradedSubmissions.reduce((acc, sub) => acc + (sub.score / sub.totalMarks), 0) /
          gradedSubmissions.length) *
          100
      )
    : null;
  const uniqueAssignments = Math.max(assignmentTitles.length - 1, 0);
  const latestSubmissionDate = submissions.length
    ? submissions
        .map((s) => new Date(s.submittedAt || s.createdAt || 0).getTime())
        .reduce((max, current) => Math.max(max, current), 0)
    : null;
  const highlightedSubmission =
    filtered.find((s) => s.score === null || s.score === undefined) || filtered[0] || null;
  const lastUpdatedLabel = latestSubmissionDate
    ? new Date(latestSubmissionDate).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'No submissions yet';

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-purple-300 bg-gradient-to-br from-purple-700 via-indigo-600 to-indigo-500 text-white shadow-xl">
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.15) 0, transparent 55%)' }} />
        <div className="relative p-6 md:p-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Assignment Evaluation</p>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight">Grade smarter, faster.</h1>
              <p className="text-white/80 mt-1 max-w-2xl">
                Prioritize pending submissions, add contextual feedback, and keep students in the loop — all from a single workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-white/80">
              <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> {pendingCount} pending reviews</span>
              <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {gradedCount} graded</span>
              <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Last update: {lastUpdatedLabel}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/25 transition"
            >
              <RefreshCcw className="w-4 h-4" />
              Sync submissions
            </button>
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 rounded-2xl border border-white/30 px-4 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10 transition"
            >
              <Filter className="w-4 h-4" />
              Reset filters
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border-[2.5px] border-purple-400 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">Awaiting review</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ListChecks className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">Use the filters below to focus on the right class or subject.</p>
        </article>

        <article className="rounded-2xl border-[2.5px] border-purple-400 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Already graded</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{gradedCount}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">{averageScore !== null ? `Avg. score ${averageScore}%` : 'Grade a submission to unlock averages.'}</p>
        </article>

        <article className="rounded-2xl border-[2.5px] border-purple-400 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">Late submissions</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{lateCount}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">Give priority feedback to learners who submitted late.</p>
        </article>

        <article className="rounded-2xl border-[2.5px] border-purple-400 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">Active assignments</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{uniqueAssignments}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <BarChart2 className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">Spanning {submissions.length} submissions this term.</p>
        </article>
      </section>

      <section className="bg-white rounded-3xl border-[2.5px] border-purple-300 shadow-sm p-5 md:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">Work queue</p>
            <h2 className="text-lg font-semibold text-gray-900">Filter submissions</h2>
            <p className="text-sm text-gray-500">Refine by student, assignment, or grading status.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-purple-50/60 border border-purple-200 rounded-full px-3 py-1.5">
            <Clock className="w-3.5 h-3.5" />
            Auto-refresh every couple of minutes
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student, assignment, or subject…"
              className="w-full rounded-2xl border-[2px] border-purple-200 bg-purple-50 pl-10 pr-4 py-3 text-sm focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 w-full lg:w-auto">
            <select
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value)}
              className="rounded-2xl border-[2px] border-purple-200 bg-purple-50 px-4 py-3 text-sm focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
            >
              {assignmentTitles.map((t) => (
                <option key={t} value={t}>
                  {t === 'all' ? 'All assignments' : t}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border-[2px] border-purple-200 bg-purple-50 px-4 py-3 text-sm focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
            >
              <option value="all">All status</option>
              <option value="pending">Pending review</option>
              <option value="graded">Graded</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="rounded-2xl border-[2px] border-purple-200 bg-purple-50 px-4 py-3 text-sm focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100"
            >
              <option value="recent">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {['all', 'pending', 'graded'].map((status) => {
            const active = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  active ? 'bg-purple-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'Show all' : status === 'pending' ? 'Needs review' : 'Completed'}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr),minmax(320px,0.85fr)]">
        <div className="space-y-4">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="rounded-2xl border-[2.5px] border-purple-200 bg-white p-5 animate-pulse space-y-4">
                  <div className="h-5 w-1/2 bg-gray-200 rounded" />
                  <div className="h-4 w-1/3 bg-gray-200 rounded" />
                  <div className="h-3 w-full bg-gray-100 rounded" />
                  <div className="h-3 w-2/3 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border-[2.5px] border-dashed border-purple-300 bg-white p-10 text-center space-y-2">
              <FileText className="w-12 h-12 mx-auto text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-800">No submissions found</h3>
              <p className="text-sm text-gray-500">Adjust the filters or ask students to upload their work.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((sub) => {
                const isSelected = selected?.submissionId === sub.submissionId;
                return (
                  <article
                    key={sub.submissionId}
                    onClick={() => openSubmission(sub)}
                    className={`rounded-2xl border-[2.5px] p-5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-purple-500 bg-white shadow-lg shadow-purple-100'
                        : 'border-purple-300 bg-white hover:-translate-y-0.5 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{sub.studentName}</p>
                          <p className="text-xs text-gray-500">{sub.grade} • {sub.section}</p>
                        </div>
                      </div>
                      {statusChip(sub)}
                    </div>

                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{sub.assignmentTitle}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1"><BookOpen className="w-3 h-3" />{sub.subject}</span>
                        <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(sub.submittedAt)}</span>
                      </div>
                      {sub.attachmentUrl && (
                        <div className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-600">
                          <FileText className="w-3 h-3" />
                          PDF attached
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(sub.submittedAt)}
                      </span>
                      {sub.score !== null && sub.score !== undefined ? (
                        <span className="text-sm font-semibold text-green-600">{sub.score}/{sub.totalMarks}</span>
                      ) : (
                        <span className="text-sm font-semibold text-purple-600 flex items-center gap-1">
                          Review
                          <Eye className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border-[2.5px] border-purple-400 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">Today's snapshot</p>
                <h3 className="text-lg font-semibold text-gray-900">Insights</h3>
              </div>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 rounded-full border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-600 hover:bg-purple-50"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border-[2px] border-purple-200 bg-purple-50 px-4 py-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Average score</p>
                  <p className="text-lg font-semibold text-gray-900">{averageScore !== null ? `${averageScore}%` : 'Awaiting first grade'}</p>
                  <p className="text-xs text-gray-500">Calculated from graded submissions.</p>
                </div>
              </div>
              {highlightedSubmission && (
                <div className="flex items-center gap-3 rounded-2xl border-[2px] border-purple-300 bg-purple-50 px-4 py-3">
                  <div className="w-10 h-10 rounded-2xl bg-white text-purple-600 flex items-center justify-center">
                    <Target className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-purple-500">Next best action</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{highlightedSubmission.assignmentTitle}</p>
                    <p className="text-xs text-gray-600 truncate">
                      {highlightedSubmission.studentName} • {formatDate(highlightedSubmission.submittedAt)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border-[2.5px] border-purple-400 bg-white shadow-lg flex flex-col min-h-[480px]">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-purple-100 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-gray-900">{selected.studentName}</p>
                      <p className="text-sm text-gray-500">{selected.grade} • {selected.section}</p>
                    </div>
                  </div>
                  <button
                    onClick={closePanel}
                    className="rounded-full border border-purple-200 p-1.5 text-purple-500 hover:text-purple-700 hover:bg-purple-50"
                    aria-label="Close grading panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  <div className="rounded-2xl border-[2px] border-purple-300 bg-purple-50/60 p-4 space-y-2">
                    <p className="text-sm font-semibold text-gray-900">{selected.assignmentTitle}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {selected.subject}</span>
                      <span className="flex items-center gap-1"><Star className="w-3 h-3" /> Total {selected.totalMarks} marks</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Submitted {formatDate(selected.submittedAt)}</span>
                      {selected.status === 'late' && <span className="text-amber-600 font-medium">Late submission</span>}
                    </div>
                  </div>

                  {selected.attachmentUrl && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Uploaded file</h3>
                      <div className="rounded-2xl border-[2px] border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50 p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Student submission</p>
                            <p className="text-xs text-gray-600">View, download, or preview the document.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <a
                            href={selected.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm font-semibold text-purple-600 hover:bg-purple-50"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Open
                          </a>
                          <a
                            href={selected.attachmentUrl}
                            download
                            className="flex items-center justify-center gap-1.5 rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm font-semibold text-purple-600 hover:bg-purple-50"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={() => setShowPdfPreview(!showPdfPreview)}
                            className="flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                          >
                            <Eye className="w-4 h-4" />
                            {showPdfPreview ? 'Hide' : 'Preview'}
                          </button>
                        </div>
                        {showPdfPreview && (
                          <div className="rounded-2xl border-2 border-purple-200 bg-white">
                            <iframe
                              src={`${selected.attachmentUrl}#toolbar=0`}
                              title="PDF Preview"
                              className="w-full h-80 rounded-2xl"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selected.submissionText ? (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {selected.attachmentUrl ? 'Additional notes' : "Student's answer"}
                      </h3>
                      <div className="mt-2 rounded-2xl border-[2px] border-purple-200 bg-purple-50 p-4 text-sm text-gray-700 max-h-48 overflow-y-auto whitespace-pre-line">
                        {selected.submissionText}
                      </div>
                    </div>
                  ) : !selected.attachmentUrl ? (
                    <div className="rounded-2xl border-[2px] border-dashed border-purple-200 bg-purple-50 p-4 text-sm text-gray-400 text-center">
                      No text submitted.
                    </div>
                  ) : null}

                  {/* AI Feedback */}
                  {(selected.submissionText) && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">AI Feedback</h3>
                        <button
                          type="button"
                          onClick={generateAiFeedback}
                          disabled={aiFeedbackLoading}
                          className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          <Brain className="w-3.5 h-3.5" />
                          {aiFeedbackLoading ? 'Generating…' : 'Generate AI Feedback'}
                        </button>
                      </div>
                      <AnimatePresence>
                        {showAiFeedback && (
                          <Motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-gray-700 whitespace-pre-line max-h-40 overflow-y-auto">
                              {aiFeedbackLoading ? (
                                <span className="text-indigo-500 animate-pulse">Analysing submission…</span>
                              ) : aiFeedback}
                            </div>
                            {!aiFeedbackLoading && aiFeedback && (
                              <button
                                type="button"
                                onClick={() => setFeedback(aiFeedback)}
                                className="mt-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                              >
                                Copy to feedback box
                              </button>
                            )}
                          </Motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Rubric */}
                  {rubrics.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rubric scoring</h3>
                        <button type="button" onClick={() => setShowRubric((v) => !v)}
                          className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1">
                          {showRubric ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {showRubric ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <AnimatePresence>
                        {showRubric && (
                          <Motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-3">
                            <select
                              value={selectedRubricId}
                              onChange={(e) => { setSelectedRubricId(e.target.value); setCriterionScores({}); }}
                              className="w-full rounded-xl border border-purple-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                            >
                              <option value="">— Select a rubric template —</option>
                              {rubrics.map((r) => <option key={r._id} value={r._id}>{r.title} ({r.totalScore} pts)</option>)}
                            </select>
                            {activeRubric && (
                              <div className="space-y-2">
                                {activeRubric.criteria.map((c, ci) => (
                                  <div key={ci} className="rounded-xl border border-purple-100 p-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-semibold text-gray-700">{c.name}</span>
                                      <span className="text-xs text-gray-400">/ {c.maxScore}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {c.levels.map((lv, li) => (
                                        <button key={li} type="button"
                                          onClick={() => setCriterionScores((s) => ({ ...s, [ci]: lv.score }))}
                                          title={lv.descriptor}
                                          className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                                            criterionScores[ci] === lv.score
                                              ? 'bg-purple-600 text-white border-purple-600'
                                              : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                                          }`}
                                        >
                                          {lv.label} ({lv.score})
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                                <button type="button" onClick={applyRubricScore}
                                  className="w-full rounded-xl border border-purple-400 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50">
                                  Apply rubric total to marks
                                </button>
                              </div>
                            )}
                          </Motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* AI auto-grade suggestion */}
                  {selected.aiGradingStatus === 'done' && selected.aiScore !== null && selected.aiScore !== undefined && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                          <Brain className="w-4 h-4 text-amber-600" />
                          AI suggested score: <span className="text-amber-900">{selected.aiScore} / {selected.totalMarks}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMarks(String(selected.aiScore))}
                          className="rounded-full bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700"
                        >
                          Use this
                        </button>
                      </div>
                      {selected.aiGradingFeedback && (
                        <p className="text-xs text-amber-700 leading-relaxed line-clamp-3">{selected.aiGradingFeedback}</p>
                      )}
                      <p className="text-[10px] text-amber-500">AI grading is advisory only — teacher grade always takes precedence.</p>
                    </div>
                  )}
                  {selected.aiGradingStatus === 'pending' && (
                    <div className="flex items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI grading in progress…
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {selected.score !== null && selected.score !== undefined ? 'Update grade' : 'Give grade'}
                    </h3>

                    {selected.score !== null && selected.score !== undefined && (
                      <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        <Award className="w-5 h-5 text-green-600" />
                        Current score: {selected.score} / {selected.totalMarks}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-gray-500">Marks *</label>
                        <input
                          type="number"
                          min="0"
                          max={selected.totalMarks}
                          value={marks}
                          onChange={(e) => setMarks(e.target.value)}
                          placeholder={`0 – ${selected.totalMarks}`}
                        className="mt-1 w-full rounded-2xl border-[2px] border-purple-200 bg-white px-3 py-2.5 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                        />
                      </div>
                      <div className="rounded-2xl border-[2px] border-purple-300 bg-purple-50 px-4 py-3 text-center">
                        <p className="text-xs font-semibold text-purple-500">Percentage</p>
                        <p className="text-xl font-bold text-purple-700">
                          {marks && !isNaN(parseFloat(marks))
                            ? `${Math.round((parseFloat(marks) / selected.totalMarks) * 100)}%`
                            : '—'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-500">Feedback (optional)</label>
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        rows={3}
                        placeholder="Share quick praise, guidance, or rework notes…"
                        className="mt-1 w-full rounded-2xl border-[2px] border-purple-200 bg-white px-3 py-2.5 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 resize-none"
                      />
                    </div>

                    {saveError && (
                      <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <AlertCircle className="w-4 h-4" />
                        {saveError}
                      </div>
                    )}

                    <button
                      onClick={saveGrade}
                      disabled={saving || !marks}
                      className="w-full rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {saving ? 'Saving grade…' : selected.score !== null && selected.score !== undefined ? 'Update grade' : 'Submit grade'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center text-gray-500 border border-purple-200 rounded-3xl bg-purple-50/40">
                <div className="w-16 h-16 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Select a submission</h3>
                <p className="text-sm text-gray-500">Pick a card on the left to view the submission, preview files, and add feedback.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AssignmentEvaluation;
