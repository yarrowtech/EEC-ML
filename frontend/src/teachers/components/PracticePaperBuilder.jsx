import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Loader, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const PracticePaperBuilder = ({ classId, sectionId, onSave, onCancel }) => {
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  const token = localStorage.getItem('token');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [paperType, setPaperType] = useState('practice_set');
  const [difficulty, setDifficulty] = useState('medium');
  const [duration, setDuration] = useState('0');
  const [passingPercentage, setPassingPercentage] = useState('40');
  const [tags, setTags] = useState('');
  const [chapter, setChapter] = useState('');
  const [practiceSectionId, setPracticeSectionId] = useState('');
  const [practiceSections, setPracticeSections] = useState([]);

  const [questions, setQuestions] = useState([
    {
      id: 0,
      questionText: '',
      questionType: 'mcq',
      options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
      correctAnswer: '',
      explanation: '',
      marks: 1,
      difficulty: 'medium'
    }
  ]);

  const [expandedQuestion, setExpandedQuestion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSubject, setAiSubject] = useState('');
  const [aiTopic, setAiTopic] = useState('');

  // Fetch practice sections
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const authHeaders = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };
        const response = await fetch(
          `${API_BASE}/api/practice-sections/teacher?classId=${classId}`,
          { headers: authHeaders }
        );
        if (response.ok) {
          const data = await response.json();
          setPracticeSections(data.sections || []);
        }
      } catch (err) {
        console.error('Error fetching practice sections:', err);
      }
    };

    if (classId && token) {
      fetchSections();
    }
  }, [classId, token, API_BASE]);

  // Add new question
  const addQuestion = () => {
    const newId = Math.max(...questions.map(q => q.id), -1) + 1;
    setQuestions([...questions, {
      id: newId,
      questionText: '',
      questionType: 'mcq',
      options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
      correctAnswer: '',
      explanation: '',
      marks: 1,
      difficulty: 'medium'
    }]);
  };

  // Delete question
  const deleteQuestion = (id) => {
    if (questions.length === 1) {
      toast.error('At least one question is required');
      return;
    }
    setQuestions(questions.filter(q => q.id !== id));
  };

  // Update question
  const updateQuestion = (id, field, value) => {
    setQuestions(questions.map(q =>
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  // Add option
  const addOption = (questionId) => {
    setQuestions(questions.map(q =>
      q.id === questionId
        ? { ...q, options: [...(q.options || []), { text: '', isCorrect: false }] }
        : q
    ));
  };

  // Update option
  const updateOption = (questionId, optionIndex, field, value) => {
    setQuestions(questions.map(q =>
      q.id === questionId
        ? {
            ...q,
            options: q.options.map((opt, idx) =>
              idx === optionIndex ? { ...opt, [field]: value } : opt
            )
          }
        : q
    ));
  };

  // Remove option
  const removeOption = (questionId, optionIndex) => {
    setQuestions(questions.map(q =>
      q.id === questionId && q.options.length > 2
        ? { ...q, options: q.options.filter((_, idx) => idx !== optionIndex) }
        : q
    ));
  };

  // AI question generation
  const generateAIQuestions = async () => {
    const subject = aiSubject.trim() || title.trim() || 'General';
    const topic = aiTopic.trim() || chapter.trim() || title.trim() || 'General Topic';
    if (!topic) { toast.error('Enter a topic or chapter name first'); return; }
    setAiGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai-teacher/quiz-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject, topic, difficulty, count: 5 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Generation failed');
      const aiQuestions = (data?.data?.questions || []);
      if (!aiQuestions.length) { toast.error('AI returned no questions. Try a more specific topic.'); return; }
      const nextId = Math.max(...questions.map((q) => q.id), -1) + 1;
      const mapped = aiQuestions.map((q, i) => ({
        id: nextId + i,
        questionText: q.questionText || '',
        questionType: 'mcq',
        options: (q.options || []).map((o) => ({ text: o.text || '', isCorrect: !!o.isCorrect })),
        correctAnswer: '',
        explanation: q.explanation || '',
        marks: 1,
        difficulty: q.difficulty || difficulty,
      }));
      setQuestions((prev) => [...prev, ...mapped]);
      toast.success(`${mapped.length} AI questions added!`);
    } catch (err) {
      toast.error(err?.message || 'AI generation failed');
    } finally {
      setAiGenerating(false);
    }
  };

  // Validate form
  const validateForm = () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return false;
    }

    if (questions.some(q => !q.questionText.trim())) {
      toast.error('All questions must have text');
      return false;
    }

    for (const q of questions) {
      if (q.questionType === 'mcq') {
        if (!q.options.some(opt => opt.isCorrect)) {
          toast.error(`Question "${q.questionText}" must have at least one correct option`);
          return false;
        }
      } else if (!q.correctAnswer.trim()) {
        toast.error(`Question "${q.questionText}" must have a correct answer`);
        return false;
      }
    }

    return true;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);

    try {
      const paperData = {
        title: title.trim(),
        description,
        paperType,
        classId,
        sectionId,
        practiceSectionId: practiceSectionId || undefined,
        difficulty,
        duration: parseInt(duration) || 0,
        passingPercentage: parseInt(passingPercentage) || 40,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        chapter,
        questions,
        status: 'draft'
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/practice-papers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(paperData)
      });

      if (!response.ok) throw new Error('Failed to save practice paper');

      const data = await response.json();
      toast.success('Practice paper created successfully');

      if (onSave) onSave(data.paper);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save practice paper');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Create Practice Paper</h2>
      </div>

      {/* AI Question Generator */}
      <div className="mb-6 rounded-xl border border-purple-200 bg-purple-50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-800">Generate Questions with AI</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={aiSubject}
            onChange={(e) => setAiSubject(e.target.value)}
            placeholder="Subject (e.g. Mathematics)"
            className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-purple-200 rounded-lg bg-white"
          />
          <input
            type="text"
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder="Topic (e.g. Fractions)"
            className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-purple-200 rounded-lg bg-white"
          />
          <button
            type="button"
            onClick={generateAIQuestions}
            disabled={aiGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aiGenerating ? 'Generating…' : 'Generate 5 Questions'}
          </button>
        </div>
        <p className="text-xs text-purple-600 mt-2">AI will generate 5 MCQ questions. You can edit or delete them before saving.</p>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="e.g., Chapter 5 Practice Test"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Paper Type</label>
          <select
            value={paperType}
            onChange={(e) => setPaperType(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="practice_set">Practice Set</option>
            <option value="worksheet">Worksheet</option>
            <option value="quiz">Quick Quiz</option>
            <option value="chapter_test">Chapter Test</option>
            <option value="unit_test">Unit Test</option>
            <option value="mock_test">Mock Test</option>
          </select>
        </div>
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 bg-gray-50 p-4 rounded-lg">
        <div>
          <label className="block text-xs font-medium mb-1">Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Duration (mins)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
            min="0"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Passing %</label>
          <input
            type="number"
            value={passingPercentage}
            onChange={(e) => setPassingPercentage(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
            min="0"
            max="100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Chapter</label>
          <input
            type="text"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
            placeholder="e.g., Chapter 5"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Practice Section</label>
          <select
            value={practiceSectionId}
            onChange={(e) => setPracticeSectionId(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
          >
            <option value="">-- No section --</option>
            {practiceSections.map(section => (
              <option key={section._id} value={section._id}>
                {section.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Tags</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
            placeholder="comma separated"
          />
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          placeholder="Instructions for students..."
          rows="2"
        />
      </div>

      {/* Questions */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Questions ({questions.length})</h3>
          <button
            onClick={addQuestion}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {questions.map((question, idx) => (
            <div key={question.id} className="border rounded-lg">
              {/* Question Header */}
              <button
                onClick={() => setExpandedQuestion(expandedQuestion === question.id ? null : question.id)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition"
              >
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">Q{idx + 1}: {question.questionText || '(Untitled)'}</p>
                  <p className="text-xs text-gray-500">Type: {question.questionType} | Marks: {question.marks}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteQuestion(question.id);
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedQuestion === question.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {/* Question Details */}
              {expandedQuestion === question.id && (
                <div className="p-4 border-t space-y-3">
                  {/* Question Text */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Question *</label>
                    <textarea
                      value={question.questionText}
                      onChange={(e) => updateQuestion(question.id, 'questionText', e.target.value)}
                      className="w-full px-3 py-2 border rounded text-sm"
                      rows="2"
                    />
                  </div>

                  {/* Question Type & Marks */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Type</label>
                      <select
                        value={question.questionType}
                        onChange={(e) => updateQuestion(question.id, 'questionType', e.target.value)}
                        className="w-full px-3 py-2 border rounded text-sm"
                      >
                        <option value="mcq">Multiple Choice</option>
                        <option value="blank">Fill Blank</option>
                        <option value="true_false">True/False</option>
                        <option value="short_answer">Short Answer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Marks</label>
                      <input
                        type="number"
                        value={question.marks}
                        onChange={(e) => updateQuestion(question.id, 'marks', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border rounded text-sm"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Difficulty</label>
                      <select
                        value={question.difficulty}
                        onChange={(e) => updateQuestion(question.id, 'difficulty', e.target.value)}
                        className="w-full px-3 py-2 border rounded text-sm"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  {/* Options or Correct Answer */}
                  {question.questionType === 'mcq' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium">Options *</label>
                        {question.options.length < 5 && (
                          <button
                            onClick={() => addOption(question.id)}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            + Add Option
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {question.options.map((option, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={option.isCorrect}
                              onChange={(e) => updateOption(question.id, optIdx, 'isCorrect', e.target.checked)}
                              className="w-4 h-4"
                              title="Mark as correct"
                            />
                            <input
                              type="text"
                              value={option.text}
                              onChange={(e) => updateOption(question.id, optIdx, 'text', e.target.value)}
                              className="flex-1 px-2 py-1 border rounded text-sm"
                              placeholder={`Option ${optIdx + 1}`}
                            />
                            {question.options.length > 2 && (
                              <button
                                onClick={() => removeOption(question.id, optIdx)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {question.questionType !== 'mcq' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Correct Answer *</label>
                      <input
                        type="text"
                        value={question.correctAnswer}
                        onChange={(e) => updateQuestion(question.id, 'correctAnswer', e.target.value)}
                        className="w-full px-3 py-2 border rounded text-sm"
                        placeholder="Enter the correct answer"
                      />
                    </div>
                  )}

                  {/* Explanation */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Explanation</label>
                    <textarea
                      value={question.explanation}
                      onChange={(e) => updateQuestion(question.id, 'explanation', e.target.value)}
                      className="w-full px-3 py-2 border rounded text-sm"
                      rows="2"
                      placeholder="Explain the answer..."
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : null}
          Create Practice Paper
        </button>
      </div>
    </div>
  );
};

export default PracticePaperBuilder;
