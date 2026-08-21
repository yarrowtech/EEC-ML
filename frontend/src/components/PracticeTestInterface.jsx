import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Send, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const PracticeTestInterface = ({ paperId, paperTitle, onBack }) => {
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  const token = localStorage.getItem('token');

  // State
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState(null);

  const authHeaders = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  // Fetch paper details
  useEffect(() => {
    const fetchPaper = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/practice-papers/student/papers/${paperId}`, {
          headers: authHeaders
        });

        if (!response.ok) throw new Error('Failed to fetch paper');

        const data = await response.json();
        setPaper(data.paper);

        // Initialize answers object
        const initialAnswers = {};
        data.paper.questions.forEach((_, idx) => {
          initialAnswers[idx] = null;
        });
        setAnswers(initialAnswers);

        // Set start time and duration
        setStartTime(new Date());
        if (data.paper.duration > 0) {
          setTimeRemaining(data.paper.duration * 60);
        }
      } catch (err) {
        console.error('Error fetching paper:', err);
        toast.error('Failed to load practice paper');
        onBack();
      } finally {
        setLoading(false);
      }
    };

    fetchPaper();
  }, [paperId, API_BASE, authHeaders, onBack]);

  // Timer countdown
  useEffect(() => {
    if (!paper || !answering || timeRemaining === null) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleSubmit(); // Auto-submit when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [paper, answering, timeRemaining]);

  // Track elapsed time
  useEffect(() => {
    if (!startTime || !answering) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((new Date() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, answering]);

  const handleAnswerChange = (value) => {
    setAnswers({
      ...answers,
      [currentQuestionIndex]: value
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      const answerArray = paper.questions.map((_, idx) => answers[idx]);

      const response = await fetch(`${API_BASE}/api/practice-papers/student/papers/${paperId}/submit`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          answers: answerArray,
          timeSpent: elapsedTime
        })
      });

      if (!response.ok) throw new Error('Failed to submit paper');

      const data = await response.json();
      setResult(data.result);
      setAnswering(false);
      toast.success('Paper submitted successfully!');
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('Failed to submit paper');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <p className="text-gray-600">Loading practice paper...</p>
        </div>
      </div>
    );
  }

  if (!paper) {
    return <div className="text-center py-12">Paper not found</div>;
  }

  const currentQuestion = paper.questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === paper.questions.length - 1;

  // Results View
  if (!answering && result) {
    const isPassed = result.isPassed;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Results Header */}
          <div className={`rounded-lg shadow-lg p-8 text-center mb-6 ${
            isPassed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
              isPassed ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {isPassed ? (
                <CheckCircle className={`w-8 h-8 ${isPassed ? 'text-green-600' : 'text-red-600'}`} />
              ) : (
                <XCircle className="w-8 h-8 text-red-600" />
              )}
            </div>

            <h1 className={`text-3xl font-bold mb-2 ${isPassed ? 'text-green-700' : 'text-red-700'}`}>
              {isPassed ? 'Congratulations!' : 'Test Completed'}
            </h1>
            <p className={`text-lg ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
              You scored {result.percentage}% ({result.marksObtained}/{result.totalMarks} marks)
            </p>
            <p className={`text-sm ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
              {isPassed ? 'You passed!' : `You need ${paper.passingPercentage}% to pass`}
            </p>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-gray-600 text-sm">Total Questions</p>
              <p className="text-2xl font-bold text-blue-600">{result.totalQuestions}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-gray-600 text-sm">Correct Answers</p>
              <p className="text-2xl font-bold text-green-600">{result.correctAnswers}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-gray-600 text-sm">Score Percentage</p>
              <p className="text-2xl font-bold text-purple-600">{result.percentage}%</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-gray-600 text-sm">Time Taken</p>
              <p className="text-2xl font-bold text-orange-600">{Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}</p>
            </div>
          </div>

          {/* Answer Review */}
          {result.answers && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Answer Review</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {result.answers.map((ans, idx) => (
                  <div key={idx} className={`p-3 border rounded-lg ${
                    ans.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-start gap-2 mb-2">
                      {ans.isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">Q{idx + 1}: {paper.questions[idx].questionText}</p>
                        <p className="text-sm text-gray-600 mt-1">Your answer: {ans.selectedAnswer || '(No answer)'}</p>
                        {!ans.isCorrect && (
                          <p className="text-sm text-green-700 mt-1">Correct answer: {ans.correctAnswer}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold flex-shrink-0">{ans.marksObtained}/{paper.questions[idx].marks}</span>
                    </div>
                    {ans.explanation && (
                      <p className="text-sm text-gray-700 pl-7">{ans.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              Back to Papers
            </button>
            {paper.allowRetakes && (
              <button
                onClick={() => {
                  setAnswering(true);
                  setResult(null);
                  setCurrentQuestionIndex(0);
                  setAnswers({});
                  setStartTime(new Date());
                  if (paper.duration > 0) {
                    setTimeRemaining(paper.duration * 60);
                  }
                  setElapsedTime(0);
                }}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Retake Test
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Test Taking View
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-semibold truncate">{paperTitle}</h1>
            <p className="text-gray-400 text-sm">Question {currentQuestionIndex + 1} of {paper.questions.length}</p>
          </div>

          {/* Timer */}
          {timeRemaining !== null && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              timeRemaining < 60 ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">
                {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
              </span>
            </div>
          )}

          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to exit? Your answers will not be saved.')) {
                onBack();
              }
            }}
            className="ml-4 px-4 py-2 text-gray-400 hover:text-white text-sm"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        {/* Question */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4">{currentQuestion.questionText}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Marks: {currentQuestion.marks}</span>
              <span className="capitalize">Type: {currentQuestion.questionType.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Answer Options */}
          {currentQuestion.questionType === 'mcq' && (
            <div className="space-y-3">
              {currentQuestion.options.map((option, idx) => (
                <label key={idx} className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-blue-50 transition">
                  <input
                    type="radio"
                    name={`question-${currentQuestionIndex}`}
                    value={idx}
                    checked={currentAnswer === idx}
                    onChange={() => handleAnswerChange(idx)}
                    className="w-4 h-4"
                  />
                  <span className="ml-3">{option.text}</span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.questionType === 'true_false' && (
            <div className="space-y-3">
              {['True', 'False'].map((option) => (
                <label key={option} className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-blue-50 transition">
                  <input
                    type="radio"
                    name={`question-${currentQuestionIndex}`}
                    value={option}
                    checked={currentAnswer === option}
                    onChange={() => handleAnswerChange(option)}
                    className="w-4 h-4"
                  />
                  <span className="ml-3">{option}</span>
                </label>
              ))}
            </div>
          )}

          {(currentQuestion.questionType === 'blank' || currentQuestion.questionType === 'short_answer') && (
            <input
              type="text"
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Enter your answer here..."
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          )}

          {currentQuestion.questionType === 'essay' && (
            <textarea
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Enter your answer here..."
              rows="6"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-4 justify-between">
          <button
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex gap-2 flex-wrap justify-center">
            {Array.from({ length: paper.questions.length }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestionIndex(idx)}
                className={`w-10 h-10 rounded-lg font-medium transition ${
                  idx === currentQuestionIndex
                    ? 'bg-blue-600 text-white'
                    : answers[idx] !== null && answers[idx] !== undefined
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          {!isLastQuestion ? (
            <button
              onClick={() => setCurrentQuestionIndex(Math.min(paper.questions.length - 1, currentQuestionIndex + 1))}
              disabled={currentQuestionIndex === paper.questions.length - 1}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit'}
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PracticeTestInterface;
