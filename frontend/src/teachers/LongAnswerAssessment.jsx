/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Loader2, X, Plus, CheckCircle, ClipboardList, Send, Lock,
  ChevronLeft, Star, AlertCircle,
} from 'lucide-react';
import { AUTH_NOTICE, logoutAndRedirect } from '../utils/authSession';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const emptyForm = {
  questionText: '', modelAnswer: '', rubric: '', maxMarks: 10, bloomTarget: '', dueDate: '',
};

const STATUS_STYLES = {
  draft: 'bg-gray-50 text-gray-600 border-gray-200',
  published: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  closed: 'bg-red-50 text-red-600 border-red-100',
};

const LongAnswerAssessment = () => {
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState([]);
  const [selectedAllocationId, setSelectedAllocationId] = useState('');
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reviewQuestion, setReviewQuestion] = useState(null);

  const selectedAllocation = useMemo(
    () => allocations.find((item) => item._id === selectedAllocationId) || null,
    [allocations, selectedAllocationId]
  );

  const allocationLabel = (alloc) => {
    const className = alloc?.classId?.name || 'Class';
    const sectionName = alloc?.sectionId?.name || 'Section';
    const subjectName = alloc?.subjectId?.name || 'Subject';
    return `${className} - ${sectionName} • ${subjectName}`;
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const apiFetch = useCallback(async (path, options = {}) => {
    const headers = getAuthHeaders();
    if (!headers) {
      const authError = new Error('Login required');
      authError.code = 'NO_TOKEN';
      throw authError;
    }
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });
    if (res.status === 401 || res.status === 403) {
      logoutAndRedirect({ navigate, notice: AUTH_NOTICE.EXPIRED, clearAllLocalStorage: true });
      const authError = new Error('Session expired');
      authError.code = AUTH_NOTICE.EXPIRED;
      throw authError;
    }
    return res;
  }, [navigate]);

  const loadAllocations = async () => {
    setLoadingAllocations(true);
    setError('');
    try {
      const res = await apiFetch('/api/teacher/dashboard/allocations');
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Unable to load allocations');
      }
      const data = await res.json();
      setAllocations(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.code !== AUTH_NOTICE.EXPIRED) setError(err.message || 'Failed to load allocations');
    } finally {
      setLoadingAllocations(false);
    }
  };

  const loadQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    setError('');
    try {
      const res = await apiFetch('/api/long-answer-assessments/teacher/questions');
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Unable to load questions');
      }
      const data = await res.json();
      setQuestions(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      if (err.code !== AUTH_NOTICE.EXPIRED) setError(err.message || 'Failed to load questions');
    } finally {
      setLoadingQuestions(false);
    }
  }, [apiFetch]);

  useEffect(() => { loadAllocations(); }, []);
  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const resetForm = () => setForm(emptyForm);

  const handleCreate = async () => {
    if (!selectedAllocation) { setError('Select a class/subject first'); return; }
    if (!form.questionText.trim()) { setError('Question text is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        grade: selectedAllocation.classId?.name || '',
        section: selectedAllocation.sectionId?.name || '',
        subject: selectedAllocation.subjectId?.name || '',
        questionText: form.questionText.trim(),
        modelAnswer: form.modelAnswer.trim(),
        rubric: form.rubric.trim(),
        maxMarks: Number(form.maxMarks) || 10,
        bloomTarget: form.bloomTarget,
        dueDate: form.dueDate || undefined,
      };
      const res = await apiFetch('/api/long-answer-assessments/teacher/questions', {
        method: 'POST', body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to create question');
      resetForm();
      await loadQuestions();
    } catch (err) {
      if (err.code !== AUTH_NOTICE.EXPIRED) setError(err.message || 'Failed to create question');
    } finally {
      setSaving(false);
    }
  };

  const setQuestionStatus = async (question, action) => {
    setError('');
    try {
      const res = await apiFetch(`/api/long-answer-assessments/teacher/questions/${question._id}/${action}`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Unable to ${action} question`);
      setQuestions((prev) => prev.map((q) => (q._id === question._id ? { ...q, ...data.data } : q)));
    } catch (err) {
      if (err.code !== AUTH_NOTICE.EXPIRED) setError(err.message || `Failed to ${action} question`);
    }
  };

  const inputClass = 'w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors';

  if (reviewQuestion) {
    return (
      <ReviewSubmissions
        question={reviewQuestion}
        apiFetch={apiFetch}
        onBack={() => { setReviewQuestion(null); loadQuestions(); }}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600 font-medium flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 p-1"><X size={14} /></button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Create Long-Answer Question</h2>
          </div>
          <div className="p-4 sm:p-5 space-y-3">
            <div>
              <label htmlFor="la-allocation" className="block text-xs font-semibold text-gray-600 mb-1.5">Class & Subject</label>
              <select id="la-allocation" value={selectedAllocationId} onChange={(e) => setSelectedAllocationId(e.target.value)} className={inputClass}>
                <option value="">Select class & subject</option>
                {loadingAllocations && <option>Loading...</option>}
                {!loadingAllocations && allocations.map((alloc) => (
                  <option key={alloc._id} value={alloc._id}>{allocationLabel(alloc)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="la-question" className="block text-xs font-semibold text-gray-600 mb-1.5">Question</label>
              <textarea id="la-question" value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} rows={3} placeholder="Type the long-answer question..." className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label htmlFor="la-model-answer" className="block text-xs font-semibold text-gray-600 mb-1.5">Model Answer (optional, used for AI grading)</label>
              <textarea id="la-model-answer" value={form.modelAnswer} onChange={(e) => setForm({ ...form, modelAnswer: e.target.value })} rows={3} placeholder="Reference answer..." className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label htmlFor="la-rubric" className="block text-xs font-semibold text-gray-600 mb-1.5">Rubric (optional)</label>
              <textarea id="la-rubric" value={form.rubric} onChange={(e) => setForm({ ...form, rubric: e.target.value })} rows={2} placeholder="Marking guidance..." className={`${inputClass} resize-none`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="la-max-marks" className="block text-xs font-semibold text-gray-600 mb-1.5">Max Marks</label>
                <input id="la-max-marks" type="number" min="1" max="100" value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="la-due-date" className="block text-xs font-semibold text-gray-600 mb-1.5">Due Date (optional)</label>
                <input id="la-due-date" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <button onClick={handleCreate} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-linear-to-r from-indigo-600 to-violet-600 rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-lg disabled:opacity-50 transition-all">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {saving ? 'Saving…' : 'Save as Draft'}
              </button>
              <button onClick={resetForm} type="button" className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">Clear</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">My Questions</h2>
            <span className="text-[11px] font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">{questions.length}</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-[620px] overflow-y-auto">
            {loadingQuestions ? (
              <div className="flex flex-col items-center justify-center py-14"><Loader2 size={24} className="animate-spin text-indigo-500 mb-3" /><p className="text-sm text-gray-500">Loading questions...</p></div>
            ) : questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3"><ClipboardList size={20} className="text-gray-400" /></div>
                <p className="text-sm font-medium text-gray-500">No questions yet</p>
                <p className="text-xs text-gray-400 mt-1">Create one using the form</p>
              </div>
            ) : (
              questions.map((q) => (
                <div key={q._id} className="px-4 sm:px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{q.questionText}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border capitalize ${STATUS_STYLES[q.status] || STATUS_STYLES.draft}`}>{q.status}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-200">{q.grade}{q.section ? ` - ${q.section}` : ''}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">{q.subject}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-600 border border-amber-100">{q.maxMarks} marks</span>
                        {q.submissions?.total > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">{q.submissions.total} submitted{q.submissions.needsReview ? ` · ${q.submissions.needsReview} needs review` : ''}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {q.status === 'draft' && (
                        <button onClick={() => setQuestionStatus(q, 'publish')} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"><Send size={12} />Publish</button>
                      )}
                      {q.status === 'published' && (
                        <button onClick={() => setQuestionStatus(q, 'close')} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"><Lock size={12} />Close</button>
                      )}
                      <button onClick={() => setReviewQuestion(q)} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors"><CheckCircle size={12} />Review</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ReviewSubmissions = ({ question, apiFetch, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/long-answer-assessments/teacher/questions/${question._id}/submissions`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Unable to load submissions');
      setData(payload.data);
    } catch (err) {
      setError(err.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, question._id]);

  useEffect(() => { load(); }, [load]);

  const startReview = (submission) => {
    setEditing(submission._id);
    setMarks(String(submission.teacherReview?.marks ?? submission.ai?.marks ?? ''));
    setFeedback(submission.teacherReview?.feedback || submission.ai?.feedback || '');
  };

  const saveReview = async (submission) => {
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(`/api/long-answer-assessments/teacher/submissions/${submission._id}/review`, {
        method: 'PATCH', body: JSON.stringify({ marks: Number(marks), feedback }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Unable to save review');
      setData((prev) => ({ ...prev, submissions: prev.submissions.map((s) => (s._id === submission._id ? payload.data : s)) }));
      setEditing(null);
    } catch (err) {
      setError(err.message || 'Failed to save review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-indigo-600 transition-colors">
        <ChevronLeft size={16} /> Back to questions
      </button>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
        <p className="text-sm font-semibold text-gray-900">{question.questionText}</p>
        <p className="text-xs text-gray-500 mt-1">{question.grade}{question.section ? ` - ${question.section}` : ''} • {question.subject} • {question.maxMarks} marks</p>
      </div>

      {error && <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100"><AlertCircle size={14} className="text-red-500" /><p className="text-xs text-red-600 font-medium">{error}</p></div>}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-14"><Loader2 size={24} className="animate-spin text-indigo-500 mb-3" /><p className="text-sm text-gray-500">Loading submissions...</p></div>
      ) : !data?.submissions?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-14 text-center">
          <ClipboardList size={20} className="text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-500">No submissions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.submissions.map((s) => (
            <div key={s._id} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">{s.studentName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.wordCount} words • submitted {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '—'}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {s.ai?.needsReview && !s.teacherReview?.reviewedAt && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100"><Star size={10} />Needs review</span>
                  )}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border capitalize ${s.status === 'reviewed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{s.status}</span>
                </div>
              </div>
              <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{s.answerText}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="text-[11px] font-semibold text-gray-500">AI Marks</p>
                  <p className="text-sm font-bold text-gray-900">{s.ai?.marks ?? '—'} / {question.maxMarks}</p>
                  {s.ai?.feedback && <p className="text-xs text-gray-600 mt-1">{s.ai.feedback}</p>}
                  {Array.isArray(s.ai?.missingConcepts) && s.ai.missingConcepts.length > 0 && (
                    <p className="text-xs text-amber-700 mt-1">Missing: {s.ai.missingConcepts.join(', ')}</p>
                  )}
                </div>
                {s.teacherReview?.reviewedAt && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                    <p className="text-[11px] font-semibold text-emerald-700">Teacher Marks</p>
                    <p className="text-sm font-bold text-emerald-900">{s.teacherReview.marks} / {question.maxMarks}</p>
                    {s.teacherReview.feedback && <p className="text-xs text-emerald-700 mt-1">{s.teacherReview.feedback}</p>}
                  </div>
                )}
              </div>

              {editing === s._id ? (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
                    <input type="number" min="0" max={question.maxMarks} value={marks} onChange={(e) => setMarks(e.target.value)} placeholder="Marks" className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl" />
                    <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} placeholder="Feedback" className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl resize-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => saveReview(s)} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">{saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}Save Review</button>
                    <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => startReview(s)} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors">
                  <BookOpen size={12} />{s.teacherReview?.reviewedAt ? 'Edit Review' : 'Override Grade'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LongAnswerAssessment;
