/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Upload } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { slugifyForUrl, deslugifyFromUrl } from '../utils/urlSlug';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const SMART_LEARNING_MAP_ENDPOINT = `${API_BASE}/api/lesson-plans/student/smart-learning-map`;
const SUBMIT_ENDPOINT = `${API_BASE}/api/lesson-plans/student/tryout-submit`;

const normalize = (value) => String(value || '').trim().toLowerCase();
const asArray = (value) => (Array.isArray(value) ? value : []);
const normalizeQuestionType = (value) => normalize(value).replace(/-/g, '_');
const optionLabels = ['A', 'B', 'C', 'D', 'E'];

const typeLabel = (type) => ({
  mcq: 'Multiple Choice',
  choice_matrix: 'Choice Matrix',
  cloze_drag_drop: 'Cloze Drag Drop',
  cloze_dropdown: 'Cloze Dropdown',
  cloze_text: 'Cloze Text',
  match_list: 'Match List',
  sort_list: 'Sort List',
  plain_text: 'Plain Text',
  rich_text: 'Rich Text',
  file_upload: 'File Upload',
  image_highlighter: 'Image Highlighter',
}[normalizeQuestionType(type)] || 'Tryout');

const renderTextWithInputs = (text, renderInput) => {
  const parts = String(text || '').split(/\$\{\{(?:input|blank)\}\}/g);
  return parts.map((part, index) => (
    <React.Fragment key={`${part}-${index}`}>
      {part}
      {index < parts.length - 1 && renderInput(index)}
    </React.Fragment>
  ));
};

// Each question reports its answer up via onAnswer(answer)
const TryoutQuestion = ({ question, index, onAnswer }) => {
  const [answer, setAnswer] = useState('');
  const [answers, setAnswers] = useState({});
  const [selectedOption, setSelectedOption] = useState(null);
  const questionType = normalizeQuestionType(question.type);
  const mcqTheme = normalize(question.theme) || 'standard';
  const options = asArray(question.options).filter(Boolean);
  const statements = asArray(question.statements).filter(Boolean);
  const items = asArray(question.items).filter(Boolean);
  const pairs = asArray(question.pairs).filter(Boolean);
  const dropdownOptions = asArray(question.dropdownOptions);

  const reportAnswer = (payload) => {
    if (onAnswer) onAnswer(payload);
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wide text-[#2f7dff]">Question {index + 1}</p>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {typeLabel(questionType)}
        </span>
      </div>

      {questionType === 'mcq' && (
        <div className="mx-auto max-w-xl rounded-xl border border-purple-500 bg-white p-6 shadow-lg">
          <h2 className="mb-6 text-center text-2xl font-bold text-black">MCQ</h2>
          <div className={`mb-4 flex w-full ${mcqTheme === 'radio' ? 'justify-center' : 'justify-start'} items-center`}>
            <span className="text-lg font-medium text-black">Q{index + 1}:</span>
            <span className="ml-2 text-lg text-black">{question.question || 'Choose the correct answer'}</span>
          </div>
          {mcqTheme === 'block' ? (
            <div className="mb-2 space-y-3">
              {options.map((option, optionIndex) => {
                const isSelected = selectedOption === optionIndex;
                return (
                  <button
                    key={`${option}-${optionIndex}`}
                    type="button"
                    onClick={() => { setSelectedOption(optionIndex); reportAnswer({ selectedOption: optionIndex, value: option }); }}
                    className={`w-full rounded-lg border bg-gray-50 px-5 py-3 text-left transition-all ${
                      isSelected ? 'border-yellow-300 bg-yellow-100 font-semibold' : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    <span className="mr-4 font-bold text-black">{optionLabels[optionIndex] || optionIndex + 1}.</span>
                    {option}
                  </button>
                );
              })}
            </div>
          ) : (
            <ul className={`mb-2 space-y-3 list-inside ${mcqTheme === 'radio' ? '' : 'list-disc'}`}>
              {options.map((option, optionIndex) => {
                const isSelected = selectedOption === optionIndex;
                return (
                  <li
                    key={`${option}-${optionIndex}`}
                    className={`${mcqTheme === 'radio' ? 'flex flex-col-reverse items-center' : 'flex items-center'} rounded-lg p-3 ${
                      isSelected ? 'bg-yellow-100' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      id={`${question.id || `mcq-${index}`}-${optionIndex}`}
                      name={question.id || `mcq-${index}`}
                      checked={isSelected}
                      onChange={() => { setSelectedOption(optionIndex); reportAnswer({ selectedOption: optionIndex, value: option }); }}
                      className="mr-3 h-5 w-5 accent-purple-500"
                    />
                    <label
                      htmlFor={`${question.id || `mcq-${index}`}-${optionIndex}`}
                      className={`cursor-pointer text-lg text-black ${isSelected ? 'font-semibold' : ''}`}
                    >
                      {option}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {questionType === 'choice_matrix' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-2 py-2 text-left">Statement</th>
                <th className="px-2 py-2 text-center">True</th>
                <th className="px-2 py-2 text-center">False</th>
              </tr>
            </thead>
            <tbody>
              {statements.map((statement, statementIndex) => (
                <tr key={`${statement}-${statementIndex}`} className="border-b border-slate-100">
                  <td className="px-2 py-3 font-medium text-slate-700">{statement}</td>
                  <td className="px-2 py-3 text-center">
                    <input
                      type="radio"
                      name={`${question.id || index}-${statementIndex}`}
                      className="accent-[#2f7dff]"
                      onChange={() => {
                        const updated = { ...answers, [statementIndex]: true };
                        setAnswers(updated);
                        reportAnswer({ value: updated });
                      }}
                    />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <input
                      type="radio"
                      name={`${question.id || index}-${statementIndex}`}
                      className="accent-[#2f7dff]"
                      onChange={() => {
                        const updated = { ...answers, [statementIndex]: false };
                        setAnswers(updated);
                        reportAnswer({ value: updated });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(questionType === 'cloze_text' || questionType === 'cloze_drag_drop') && (
        <div className="space-y-3">
          <p className="text-sm leading-7 text-slate-700">
            {renderTextWithInputs(question.text, (blankIndex) => (
              <input
                aria-label={`Blank ${blankIndex + 1}`}
                className="mx-1 inline-block w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
                value={answers[blankIndex] || ''}
                onChange={(event) => {
                  const updated = { ...answers, [blankIndex]: event.target.value };
                  setAnswers(updated);
                  reportAnswer({ value: updated });
                }}
              />
            ))}
          </p>
          {options.length > 0 && <p className="text-xs font-semibold text-slate-500">Options: {options.join(', ')}</p>}
        </div>
      )}

      {questionType === 'cloze_dropdown' && (
        <p className="text-sm leading-8 text-slate-700">
          {renderTextWithInputs(question.text, (blankIndex) => (
            <select
              className="mx-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
              defaultValue=""
              onChange={(e) => {
                const updated = { ...answers, [blankIndex]: e.target.value };
                setAnswers(updated);
                reportAnswer({ value: updated });
              }}
            >
              <option value="" disabled>Choose</option>
              {asArray(dropdownOptions[blankIndex]).filter(Boolean).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ))}
        </p>
      )}

      {questionType === 'match_list' && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">{items.map((item, itemIndex) => <div key={`${item}-${itemIndex}`} className="rounded-lg border border-slate-200 p-2 text-sm font-medium">{item}</div>)}</div>
          <div className="space-y-2">{pairs.map((pair, pairIndex) => <div key={`${pair}-${pairIndex}`} className="rounded-lg border border-slate-200 p-2 text-sm text-slate-600">{pair}</div>)}</div>
        </div>
      )}

      {questionType === 'sort_list' && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-slate-900">{question.question || 'Arrange the items in order'}</h3>
          <div className="space-y-2">{items.map((item, itemIndex) => <div key={`${item}-${itemIndex}`} className="rounded-lg border border-slate-200 p-2 text-sm font-medium">{item}</div>)}</div>
        </div>
      )}

      {(questionType === 'plain_text' || questionType === 'rich_text' || !questionType) && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-slate-900">{question.question || question.text || 'Write your answer'}</h3>
          <textarea
            value={answer}
            onChange={(event) => { setAnswer(event.target.value); reportAnswer({ value: event.target.value }); }}
            rows={5}
            className="w-full rounded-lg border border-slate-300 p-3 text-sm"
            placeholder="Write your answer..."
          />
        </div>
      )}

      {questionType === 'file_upload' && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-slate-900">{question.question || 'Upload your answer'}</h3>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <Upload size={16} />
            <span>Select file</span>
            <input type="file" className="hidden" onChange={() => reportAnswer({ value: 'file_uploaded' })} />
          </label>
        </div>
      )}

      {questionType === 'image_highlighter' && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-slate-900">{question.question || 'Mark the image'}</h3>
          {question.imageUrl ? <img src={question.imageUrl} alt="Tryout" className="max-h-80 rounded-lg border border-slate-200" /> : <p className="text-sm text-slate-500">No image attached.</p>}
        </div>
      )}
    </article>
  );
};

const AILearningTryoutSection = ({ assignedSubjectName = '', assignedTopicName = '', onBack }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const subjectMatch = location.pathname.match(/\/subject\/([^/]+)/);
  const topicMatch = location.pathname.match(/\/topic\/([^/]+)/);
  const subjectSlug = assignedSubjectName || (subjectMatch?.[1] ? deslugifyFromUrl(subjectMatch[1]) : 'subject');
  const topicSlug = assignedTopicName || (topicMatch?.[1] ? deslugifyFromUrl(topicMatch[1]) : 'topic');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  // answers keyed by question index
  const answersRef = useRef({});

  useEffect(() => {
    const loadAssignedTryouts = async () => {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        if (!token || userType !== 'Student') {
          setSubjects([]);
          return;
        }

        const response = await fetch(SMART_LEARNING_MAP_ENDPOINT, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || 'Failed to load assigned tryouts');
        setSubjects(Array.isArray(data?.subjects) ? data.subjects : []);
      } catch (err) {
        setError(err?.message || 'Failed to load assigned tryouts');
      } finally {
        setLoading(false);
      }
    };

    loadAssignedTryouts();
  }, []);

  const assignedTryouts = useMemo(() => {
    const subject = subjects.find((item) => normalize(item.key || item.title) === normalize(subjectSlug));
    const topic = asArray(subject?.topics).find((item) => normalize(item.title) === normalize(topicSlug));
    return asArray(topic?.tryoutSections).filter((item) => item && typeof item === 'object');
  }, [subjects, subjectSlug, topicSlug]);

  // Also get chapter title from the subjects map for the submission payload
  const chapterTitle = useMemo(() => {
    const subject = subjects.find((item) => normalize(item.key || item.title) === normalize(subjectSlug));
    const chapters = asArray(subject?.chapters);
    for (const ch of chapters) {
      const found = asArray(ch.topics).find((t) => normalize(t.title) === normalize(topicSlug));
      if (found) return ch.title || '';
    }
    return '';
  }, [subjects, subjectSlug, topicSlug]);

  const returnToPreviousView = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigate(`/student/smart-learning-courses/subject/${slugifyForUrl(subjectSlug)}/topic/${slugifyForUrl(topicSlug)}`);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const answersList = assignedTryouts.map((_, i) => answersRef.current[i] ?? { value: null });
      const res = await fetch(SUBMIT_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: subjectSlug,
          chapterTitle,
          topicTitle: topicSlug,
          questions: assignedTryouts,
          answers: answersList,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Submission failed');
      setSubmitted(true);
      setSubmitResult(data.result);
    } catch (err) {
      setError(err?.message || 'Failed to submit tryout. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    const autoScore = submitResult?.autoScore;
    const autoCount = submitResult?.autoGradedCount ?? 0;
    const total = assignedTryouts.length;
    const manualCount = total - autoCount;
    return (
      <div className="w-full min-h-screen bg-[#f8f7f6] p-4 text-slate-900 sm:p-6 md:p-8">
        <div className="mx-auto w-full max-w-[700px]">
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-4 text-emerald-500" size={48} />
            <h1 className="text-2xl font-black text-slate-900">Tryout Submitted!</h1>
            <p className="mt-2 text-sm text-slate-500">Your answers have been recorded.</p>

            {autoCount > 0 && autoScore !== null && (
              <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 px-6 py-4">
                <p className="text-sm font-semibold text-emerald-700">Auto-graded score (MCQ)</p>
                <p className="text-4xl font-black text-emerald-600 mt-1">{autoScore}%</p>
                <p className="text-xs text-emerald-600 mt-1">{autoCount} of {total} question{total !== 1 ? 's' : ''} auto-graded</p>
              </div>
            )}

            {manualCount > 0 && (
              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-6 py-3">
                <p className="text-sm font-semibold text-amber-700">
                  {manualCount} question{manualCount !== 1 ? 's' : ''} will be reviewed and marked by your teacher.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={returnToPreviousView}
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft size={16} /> {onBack ? 'Back to Activities' : 'Back to Topic'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#f8f7f6] p-4 text-slate-900 sm:p-6 md:p-8">
      <div className="mx-auto w-full max-w-[950px]">
        <button
          type="button"
          onClick={returnToPreviousView}
          className="mb-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
          {onBack ? 'Back to Activities' : 'Back to Topic'}
        </button>

        <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-wide text-[#2f7dff]">Assigned Tryout</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">{topicSlug}</h1>
          <p className="mt-1 text-sm text-slate-500">Only questions assigned by your teacher are shown here.</p>
        </section>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {loading && <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">Loading assigned tryout...</div>}
        {!loading && !error && assignedTryouts.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-slate-300" size={34} />
            <h2 className="text-lg font-bold text-slate-800">No tryout assigned</h2>
            <p className="mt-1 text-sm text-slate-500">Your teacher has not assigned a tryout for this topic yet.</p>
          </div>
        )}
        {!loading && !error && assignedTryouts.length > 0 && (
          <div className="space-y-4">
            {assignedTryouts.map((question, index) => (
              <TryoutQuestion
                key={question.id || index}
                question={question}
                index={index}
                onAnswer={(ans) => { answersRef.current[index] = ans; }}
              />
            ))}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-[#2f7dff] px-5 py-2 text-sm font-bold text-white hover:bg-[#1f65d6] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting…' : 'Submit Tryout'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AILearningTryoutSection;
