import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Trash2, Edit3, Loader2, X, Plus, CheckCircle, HelpCircle, Sparkles, Brain } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const QUESTION_TYPES = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'blank', label: 'Fill in the Blank' },
];

const emptyOptions = ['', '', '', ''];

const PracticeQuestions = ({ initialType = '' }) => {
  const [searchParams] = useSearchParams();
  const requestedType = initialType || searchParams.get('type');
  const [allocations, setAllocations] = useState([]);
  const [selectedAllocationId, setSelectedAllocationId] = useState('');
  const [questionType, setQuestionType] = useState(requestedType === 'blank' ? 'blank' : 'mcq');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(emptyOptions);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

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

  const resolveId = (value) => value?._id || value;

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const loadAllocations = async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      setError('Login required');
      return;
    }
    setLoadingAllocations(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/teacher/dashboard/allocations`, { headers });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Unable to load allocations');
      }
      const data = await res.json();
      const items = Array.isArray(data) ? data : [];
      setAllocations(items);
    } catch (err) {
      console.error('Allocation load error:', err);
      setError(err.message || 'Failed to load allocations');
    } finally {
      setLoadingAllocations(false);
    }
  };

  const loadQuestions = async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      setError('Login required');
      return;
    }
    setLoadingQuestions(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedAllocation?.classId?._id) params.set('classId', selectedAllocation.classId._id);
      if (selectedAllocation?.sectionId?._id) params.set('sectionId', selectedAllocation.sectionId._id);
      if (selectedAllocation?.subjectId?._id) params.set('subjectId', selectedAllocation.subjectId._id);
      const query = params.toString();
      const res = await fetch(`${API_BASE}/api/practice/teacher/questions${query ? `?${query}` : ''}`, { headers });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Unable to load questions');
      }
      const data = await res.json();
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
    } catch (err) {
      console.error('Questions load error:', err);
      setError(err.message || 'Failed to load questions');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const resetForm = () => {
    setQuestionText('');
    setOptions(emptyOptions);
    setCorrectAnswer('');
    setExplanation('');
    setEditingId('');
  };

  const handleSave = async () => {
    if (!selectedAllocation) {
      setError('Select an allocation first');
      return;
    }
    const headers = getAuthHeaders();
    if (!headers) {
      setError('Login required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        classId: selectedAllocation.classId?._id,
        sectionId: selectedAllocation.sectionId?._id,
        subjectId: selectedAllocation.subjectId?._id,
        type: questionType,
        question: questionText.trim(),
        options: questionType === 'mcq' ? options.map((o) => o.trim()) : [],
        correctAnswer: correctAnswer.trim(),
        explanation: explanation.trim(),
      };
      const res = await fetch(
        `${API_BASE}/api/practice/teacher/questions${editingId ? `/${editingId}` : ''}`,
        {
          method: editingId ? 'PUT' : 'POST',
          headers,
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Unable to save question');
      }
      resetForm();
      await loadQuestions();
    } catch (err) {
      console.error('Question save error:', err);
      setError(err.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!selectedAllocation) { setError('Select an allocation first'); return; }
    const headers = getAuthHeaders();
    if (!headers) { setError('Login required'); return; }
    setAiGenerating(true);
    setAiError('');
    try {
      const res = await fetch(`${API_BASE}/api/ai-teacher/quiz-generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subject: selectedAllocation.subjectId?.name || '',
          topic: selectedAllocation.subjectId?.name || '',
          gradeLevel: selectedAllocation.classId?.name || '',
          count: 1,
          questionType: 'mcq',
          classId: selectedAllocation.classId?._id || '',
          sectionId: selectedAllocation.sectionId?._id || '',
          subjectId: selectedAllocation.subjectId?._id || '',
          academicYearId: selectedAllocation.academicYearId?._id || selectedAllocation.academicYearId || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI request failed');
      const first = Array.isArray(data?.data?.questions) ? data.data.questions[0] : null;
      if (first) {
        setQuestionType('mcq');
        setQuestionText(first.questionText || '');
        const opts = (first.options || []).map((o) => (typeof o === 'string' ? o : o.text || ''));
        setOptions([...opts, '', '', '', ''].slice(0, 4));
        const correctOpt = (first.options || []).find((o) => o.isCorrect);
        setCorrectAnswer(
          (typeof correctOpt === 'string' ? correctOpt : correctOpt?.text)
          || first.correctAnswer
          || ''
        );
        setExplanation(first.explanation || '');
      } else {
        setAiError('AI could not create a complete question. Please try again.');
      }
    } catch (err) {
      setAiError(err.message || 'Failed to generate question');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleDelete = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) {
      setError('Login required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/practice/teacher/questions/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Unable to delete question');
      }
      setQuestions((prev) => prev.filter((q) => q._id !== id));
    } catch (err) {
      console.error('Question delete error:', err);
      setError(err.message || 'Failed to delete question');
    }
  };

  useEffect(() => {
    loadAllocations();
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [selectedAllocationId]);

  const startEdit = (q) => {
    setEditingId(q._id);
    setQuestionType(q.type);
    setQuestionText(q.question || '');
    setOptions(q.options && q.options.length ? [...q.options, '', '', '', ''].slice(0, 4) : emptyOptions);
    setCorrectAnswer(q.correctAnswer || '');
    setExplanation(q.explanation || '');
    if (q.classId && q.sectionId && q.subjectId) {
      const match = allocations.find(
        (alloc) =>
          String(alloc.classId?._id) === String(resolveId(q.classId)) &&
          String(alloc.sectionId?._id) === String(resolveId(q.sectionId)) &&
          String(alloc.subjectId?._id) === String(resolveId(q.subjectId))
      );
      if (match) setSelectedAllocationId(match._id);
    }
  };

  const inputClass = 'w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors';

  return (
    <div className="space-y-4 sm:space-y-5">
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <p className="text-xs text-red-600 font-medium flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Questions', value: questions.length, icon: HelpCircle, gradient: 'from-indigo-500 to-violet-500' },
          { label: 'Allocations', value: allocations.length, icon: BookOpen, gradient: 'from-amber-500 to-orange-500' },
          { label: 'MCQ', value: questions.filter(q => q.type === 'mcq').length, icon: CheckCircle, gradient: 'from-emerald-500 to-green-500' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-4 border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
                <stat.icon size={18} className="text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Create / Edit Form */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">
              {editingId ? 'Edit Question' : 'Create Question'}
            </h2>
            {editingId && (
              <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">Editing</span>
            )}
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="practice-allocation" className="block text-xs font-semibold text-gray-600 mb-1.5">Class & Subject</label>
                <select
                  id="practice-allocation"
                  value={selectedAllocationId}
                  onChange={(e) => setSelectedAllocationId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">All allocations (view only)</option>
                  {loadingAllocations && <option>Loading...</option>}
                  {!loadingAllocations && allocations.length === 0 && <option>No allocations found</option>}
                  {!loadingAllocations &&
                    allocations.map((alloc) => (
                      <option key={alloc._id} value={alloc._id}>
                        {allocationLabel(alloc)}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="practice-question-type" className="block text-xs font-semibold text-gray-600 mb-1.5">Question Type</label>
                <select
                  id="practice-question-type"
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className={inputClass}
                >
                  {QUESTION_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="practice-question-text" className="block text-xs font-semibold text-gray-600 mb-1.5">Question</label>
              <textarea
                id="practice-question-text"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={3}
                placeholder="Type the question..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {questionType === 'mcq' && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Options</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <input
                        aria-label={`Option ${String.fromCharCode(65 + idx)}`}
                        value={opt}
                        onChange={(e) => {
                          const next = [...options];
                          next[idx] = e.target.value;
                          setOptions(next);
                        }}
                        placeholder={`Option ${idx + 1}`}
                        className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label htmlFor="practice-correct-answer" className="block text-[11px] font-semibold text-gray-500 mb-1">Correct Answer</label>
                  <select
                    id="practice-correct-answer"
                    value={correctAnswer}
                    onChange={(e) => setCorrectAnswer(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select correct option</option>
                    {options
                      .map((opt) => opt.trim())
                      .filter(Boolean)
                      .map((opt, idx) => (
                        <option key={`${opt}-${idx}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            {questionType === 'blank' && (
              <div>
                <label htmlFor="practice-blank-answer" className="block text-xs font-semibold text-gray-600 mb-1.5">Correct Answer</label>
                <input
                  id="practice-blank-answer"
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  placeholder="Exact answer"
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label htmlFor="practice-explanation" className="block text-xs font-semibold text-gray-600 mb-1.5">Explanation (optional)</label>
              <textarea
                id="practice-explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={2}
                placeholder="Explain why this is correct..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {aiError && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{aiError}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-linear-to-r from-indigo-600 to-violet-600 rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-lg disabled:opacity-50 transition-all"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {saving ? 'Saving...' : editingId ? 'Update Question' : 'Save Question'}
              </button>
              <button
                onClick={resetForm}
                type="button"
                className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
              >
                {editingId ? 'Cancel Edit' : 'Clear'}
              </button>
              <button
                onClick={handleAIGenerate}
                type="button"
                disabled={aiGenerating || !selectedAllocation}
                title={!selectedAllocation ? 'Select an allocation first' : 'Generate a question with AI'}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl shadow-md shadow-violet-500/20 hover:shadow-lg disabled:opacity-50 transition-all"
              >
                {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {aiGenerating ? 'Generating…' : 'AI Generate'}
              </button>
            </div>
          </div>
        </div>

        {/* Saved Questions */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Saved Questions</h2>
              <p className="text-[11px] text-gray-400">
                {selectedAllocation ? allocationLabel(selectedAllocation) : 'All classes'}
              </p>
            </div>
            <span className="text-[11px] font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
              {questions.length}
            </span>
          </div>

          <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
            {loadingQuestions ? (
              <div className="flex flex-col items-center justify-center py-14">
                <Loader2 size={24} className="animate-spin text-indigo-500 mb-3" />
                <p className="text-sm text-gray-500">Loading questions...</p>
              </div>
            ) : questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <HelpCircle size={20} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-500">No questions yet</p>
                <p className="text-xs text-gray-400 mt-1">Create your first question using the form</p>
              </div>
            ) : (
              questions.map((q, index) => {
                const typeBorder = q.type === 'mcq' ? 'border-l-indigo-500' : 'border-l-amber-500';
                return (
                  <div key={q._id} className={`px-4 sm:px-5 py-3 border-l-[3px] ${typeBorder} hover:bg-gray-50/50 transition-colors`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-snug">{q.question}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                            q.type === 'mcq'
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                              : 'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                            {q.type === 'mcq' ? 'MCQ' : 'Fill in Blank'}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                            {(q.classId?.name || 'Class')} - {(q.sectionId?.name || 'Sec')}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
                            {(q.subjectId?.name || 'Subject')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(q)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(q._id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeQuestions;
