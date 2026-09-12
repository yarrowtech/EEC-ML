/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Upload, MessageCircle, X,
  Bold, Italic, RotateCcw, ChevronUp, ChevronDown,
  ListChecks, LayoutGrid, Type, Link2, ArrowUpDown, PenLine, FileUp, Highlighter,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { slugifyForUrl, deslugifyFromUrl } from '../utils/urlSlug';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const SMART_LEARNING_MAP_ENDPOINT = `${API_BASE}/api/lesson-plans/student/smart-learning-map`;
const SUBMIT_ENDPOINT = `${API_BASE}/api/lesson-plans/student/tryout-submit`;

// "Kinetic Campus" design tokens: calm indigo/sky/amber flat-card system —
// white surfaces, soft indigo-tinted shadows, no glass/blur. Scoped to this
// page only (the rest of Smart Learning uses the frosted-glass system).
const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_-2px_rgba(79,70,229,0.04),0_1px_4px_-1px_rgba(15,23,42,0.03)]';
const CARD_HOVER = 'transition-shadow duration-200 hover:shadow-[0_8px_20px_-4px_rgba(79,70,229,0.08),0_2px_6px_-2px_rgba(15,23,42,0.04)]';
const GHOST_BTN = 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300';

const normalize = (value) => String(value || '').trim().toLowerCase();
const asArray = (value) => (Array.isArray(value) ? value : []);
const normalizeQuestionType = (value) => normalize(value).replace(/-/g, '_');
const optionLabels = ['A', 'B', 'C', 'D', 'E'];

const TYPE_META = {
  mcq: { label: 'Multiple Choice', short: 'MCQ', icon: ListChecks },
  choice_matrix: { label: 'Choice Matrix', short: 'Matrix', icon: LayoutGrid },
  cloze_drag_drop: { label: 'Cloze Drag & Drop', short: 'Cloze Drag', icon: Type },
  cloze_dropdown: { label: 'Cloze Dropdown', short: 'Cloze', icon: Type },
  cloze_text: { label: 'Cloze Text', short: 'Cloze', icon: Type },
  match_list: { label: 'Match List', short: 'Match List', icon: Link2 },
  sort_list: { label: 'Sort List', short: 'Sort List', icon: ArrowUpDown },
  plain_text: { label: 'Written Response', short: 'Written', icon: PenLine },
  rich_text: { label: 'Rich Text Response', short: 'Rich Text', icon: PenLine },
  file_upload: { label: 'File Upload', short: 'Upload', icon: FileUp },
  image_highlighter: { label: 'Image Highlighter', short: 'Highlighter', icon: Highlighter },
};
const typeMeta = (type) => TYPE_META[normalizeQuestionType(type)] || { label: 'Tryout', short: 'Tryout', icon: ListChecks };
const typeLabel = (type) => typeMeta(type).label;

const renderTextWithInputs = (text, renderInput) => {
  const parts = String(text || '').split(/\$\{\{(?:input|blank)\}\}/g);
  return parts.map((part, index) => (
    <React.Fragment key={`${part}-${index}`}>
      {part}
      {index < parts.length - 1 && renderInput(index)}
    </React.Fragment>
  ));
};

const WORD_BANK_STYLES = [
  'bg-indigo-100 text-indigo-700 border-indigo-300',
  'bg-sky-100 text-sky-700 border-sky-300',
  'bg-amber-100 text-amber-700 border-amber-300',
  'bg-emerald-100 text-emerald-700 border-emerald-300',
  'bg-rose-100 text-rose-700 border-rose-300',
];

const MARK_COLORS = ['#4f46e5', '#0ea5e9', '#f59e0b', '#10b981'];

const formatAgo = (ts) => {
  if (!ts) return '';
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
};

// Each question reports its answer up via onAnswer(answer). Passing
// null/undefined tells the parent the question was cleared back to unanswered.
const TryoutQuestion = ({ question, index, onAnswer }) => {
  const [answer, setAnswer] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [spellcheckOn, setSpellcheckOn] = useState(true);
  const [answers, setAnswers] = useState({});
  const [selectedOption, setSelectedOption] = useState(null);
  const [activeBankIndex, setActiveBankIndex] = useState(null);
  const [placements, setPlacements] = useState({});
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [matches, setMatches] = useState({});
  const [fileName, setFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeColor, setActiveColor] = useState(MARK_COLORS[0]);
  const [marks, setMarks] = useState([]);
  const [drawStart, setDrawStart] = useState(null);
  const [drawCurrent, setDrawCurrent] = useState(null);
  const [editingMarkId, setEditingMarkId] = useState(null);
  const imageBoxRef = useRef(null);

  const questionType = normalizeQuestionType(question.type);
  const mcqTheme = normalize(question.theme) || 'standard';
  const options = asArray(question.options).filter(Boolean);
  const statements = asArray(question.statements).filter(Boolean);
  const items = asArray(question.items).filter(Boolean);
  const pairs = asArray(question.pairs).filter(Boolean);
  const dropdownOptions = asArray(question.dropdownOptions);

  const [order, setOrder] = useState(() => items.map((_, i) => i));

  const reportAnswer = (payload) => {
    if (onAnswer) onAnswer(payload);
  };

  const moveItem = (position, direction) => {
    const target = position + direction;
    if (target < 0 || target >= order.length) return;
    const newOrder = [...order];
    [newOrder[position], newOrder[target]] = [newOrder[target], newOrder[position]];
    setOrder(newOrder);
    reportAnswer({ value: newOrder });
  };

  const removeMark = (id) => {
    const updated = marks.filter((m) => m.id !== id);
    setMarks(updated);
    reportAnswer(updated.length ? { value: updated } : null);
  };

  return (
    <article className={`${CARD} ${CARD_HOVER} p-4 sm:p-6`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
          Question {index + 1} <span className="text-slate-300">&middot;</span> {typeLabel(questionType)}
        </p>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">1 Point</span>
      </div>

      {questionType === 'mcq' && (
        <div>
          <p className="mb-4 text-base font-semibold text-slate-800">
            {question.question || 'Choose the correct answer'}
          </p>
          {mcqTheme === 'block' ? (
            <div className="space-y-2.5">
              {options.map((option, optionIndex) => {
                const isSelected = selectedOption === optionIndex;
                return (
                  <button
                    key={`${option}-${optionIndex}`}
                    type="button"
                    onClick={() => { setSelectedOption(optionIndex); reportAnswer({ selectedOption: optionIndex, value: option }); }}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-sm font-medium transition-colors ${
                      isSelected ? 'border-indigo-500 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-500' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40'
                    }`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {isSelected ? <CheckCircle2 size={14} /> : (optionLabels[optionIndex] || optionIndex + 1)}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={mcqTheme === 'radio' ? 'grid gap-2.5 sm:grid-cols-2' : 'space-y-2.5'}>
              {options.map((option, optionIndex) => {
                const isSelected = selectedOption === optionIndex;
                const inputId = `${question.id || `mcq-${index}`}-${optionIndex}`;
                return (
                  <label
                    key={`${option}-${optionIndex}`}
                    htmlFor={inputId}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${
                      isSelected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
                    }`}
                  >
                    <input
                      type="radio"
                      id={inputId}
                      name={question.id || `mcq-${index}`}
                      checked={isSelected}
                      onChange={() => { setSelectedOption(optionIndex); reportAnswer({ selectedOption: optionIndex, value: option }); }}
                      className="h-4 w-4 shrink-0 accent-indigo-600"
                    />
                    <span className={`text-slate-700 ${isSelected ? 'font-semibold text-indigo-800' : ''}`}>{option}</span>
                  </label>
                );
              })}
            </div>
          )}
          {selectedOption !== null && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600"><CheckCircle2 size={13} /> Response saved automatically</span>
              <button type="button" onClick={() => { setSelectedOption(null); reportAnswer(null); }} className="font-semibold text-slate-400 hover:text-slate-600">
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}

      {questionType === 'choice_matrix' && (
        <div>
          {question.question && <p className="mb-3 text-base font-semibold text-slate-800">{question.question}</p>}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="px-3 py-2.5 text-left font-semibold">Statement</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-emerald-600">True</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-rose-500">False</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((statement, statementIndex) => (
                  <tr key={`${statement}-${statementIndex}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3 font-medium text-slate-700">{statement}</td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="radio"
                        name={`${question.id || index}-${statementIndex}`}
                        checked={answers[statementIndex] === true}
                        className="h-4 w-4 accent-emerald-500"
                        onChange={() => {
                          const updated = { ...answers, [statementIndex]: true };
                          setAnswers(updated);
                          reportAnswer({ value: updated });
                        }}
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="radio"
                        name={`${question.id || index}-${statementIndex}`}
                        checked={answers[statementIndex] === false}
                        className="h-4 w-4 accent-rose-500"
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-400">{Object.keys(answers).length} of {statements.length} statements answered</span>
            {Object.keys(answers).length > 0 && (
              <button type="button" onClick={() => { setAnswers({}); reportAnswer(null); }} className="inline-flex items-center gap-1 font-semibold text-slate-400 hover:text-slate-600">
                <RotateCcw size={12} /> Reset Matrix
              </button>
            )}
          </div>
        </div>
      )}

      {questionType === 'cloze_drag_drop' && (
        <div className="space-y-4">
          {question.question && <p className="text-base font-semibold text-slate-800">{question.question}</p>}
          <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-indigo-500">Word bank — tap a word, then tap a blank</p>
            <div className="flex flex-wrap gap-2">
              {options.map((word, wordIndex) => {
                const isUsed = Object.values(placements).includes(wordIndex);
                const isActive = activeBankIndex === wordIndex;
                return (
                  <button
                    key={`${word}-${wordIndex}`}
                    type="button"
                    disabled={isUsed}
                    onClick={() => setActiveBankIndex(isActive ? null : wordIndex)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                      isUsed
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 line-through'
                        : isActive
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                        : WORD_BANK_STYLES[wordIndex % WORD_BANK_STYLES.length]
                    }`}
                  >
                    {word}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-sm leading-9 text-slate-700">
            {renderTextWithInputs(question.text, (blankIndex) => {
              const placedWordIndex = placements[blankIndex];
              const placedWord = placedWordIndex !== undefined ? options[placedWordIndex] : null;
              return (
                <button
                  key={blankIndex}
                  type="button"
                  onClick={() => {
                    if (placedWord) {
                      const updated = { ...placements };
                      delete updated[blankIndex];
                      setPlacements(updated);
                      reportAnswer(Object.keys(updated).length ? { value: updated } : null);
                    } else if (activeBankIndex !== null) {
                      const updated = { ...placements, [blankIndex]: activeBankIndex };
                      setPlacements(updated);
                      setActiveBankIndex(null);
                      reportAnswer({ value: updated });
                    }
                  }}
                  className={`mx-1 inline-flex min-w-[92px] items-center justify-center gap-1 rounded-lg border px-3 py-1 align-middle text-sm font-semibold transition-colors ${
                    placedWord
                      ? `${WORD_BANK_STYLES[placedWordIndex % WORD_BANK_STYLES.length]} border-transparent`
                      : 'border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-indigo-300'
                  }`}
                >
                  {placedWord || `Blank ${blankIndex + 1}`}
                  {placedWord && <X size={12} />}
                </button>
              );
            })}
          </p>
        </div>
      )}

      {questionType === 'cloze_dropdown' && (
        <div>
          {question.question && <p className="mb-2 text-base font-semibold text-slate-800">{question.question}</p>}
          <p className="text-sm leading-9 text-slate-700">
            {renderTextWithInputs(question.text, (blankIndex) => (
              <select
                key={blankIndex}
                className="mx-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none"
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
        </div>
      )}

      {(questionType === 'cloze_text') && (
        <div className="space-y-3">
          {question.question && <p className="text-base font-semibold text-slate-800">{question.question}</p>}
          <p className="text-sm leading-9 text-slate-700">
            {renderTextWithInputs(question.text, (blankIndex) => (
              <input
                key={blankIndex}
                aria-label={`Blank ${blankIndex + 1}`}
                className="mx-1 inline-block w-32 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none"
                value={answers[blankIndex] || ''}
                onChange={(event) => {
                  const updated = { ...answers, [blankIndex]: event.target.value };
                  setAnswers(updated);
                  reportAnswer({ value: updated });
                }}
              />
            ))}
          </p>
          {options.length > 0 && <p className="text-xs font-semibold text-slate-400">Word bank: {options.join(', ')}</p>}
        </div>
      )}

      {questionType === 'match_list' && (
        <div>
          {question.question && <p className="mb-3 text-base font-semibold text-slate-800">{question.question}</p>}
          <p className="mb-3 text-xs font-semibold text-slate-400">Tap an item on the left, then tap its match on the right.</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-2">
              {items.map((item, leftIndex) => {
                const isMatched = matches[leftIndex] !== undefined;
                const isSelected = selectedLeft === leftIndex;
                return (
                  <button
                    key={`${item}-${leftIndex}`}
                    type="button"
                    onClick={() => setSelectedLeft(isSelected ? null : leftIndex)}
                    className={`flex w-full items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-medium transition-colors ${
                      isSelected ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-500' : isMatched ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-indigo-300'
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{leftIndex + 1}</span>
                    <span className="text-slate-700">{item}</span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              {pairs.map((pair, rightIndex) => {
                const matchedLeftIndex = Object.entries(matches).find(([, r]) => r === rightIndex)?.[0];
                const isMatched = matchedLeftIndex !== undefined;
                return (
                  <button
                    key={`${pair}-${rightIndex}`}
                    type="button"
                    onClick={() => {
                      if (isMatched && selectedLeft === null) {
                        const updated = { ...matches };
                        delete updated[matchedLeftIndex];
                        setMatches(updated);
                        reportAnswer(Object.keys(updated).length ? { value: updated } : null);
                        return;
                      }
                      if (selectedLeft === null) return;
                      const updated = { ...matches, [selectedLeft]: rightIndex };
                      setMatches(updated);
                      setSelectedLeft(null);
                      reportAnswer({ value: updated });
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border p-3 text-left text-sm transition-colors ${
                      isMatched ? 'border-emerald-300 bg-emerald-50/60 text-slate-700' : selectedLeft !== null ? 'border-indigo-300 bg-white text-slate-600 hover:bg-indigo-50/40' : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    <span>{pair}</span>
                    {isMatched && (
                      <span className="shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        Matched {optionLabels[Number(matchedLeftIndex)] || Number(matchedLeftIndex) + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {questionType === 'sort_list' && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-slate-800">{question.question || 'Arrange the items in order'}</h3>
          <div className="space-y-2">
            {order.map((itemIndex, position) => (
              <div key={itemIndex} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{position + 1}</span>
                <span className="flex-1 text-sm font-medium text-slate-700">{items[itemIndex]}</span>
                <div className="flex shrink-0 flex-col">
                  <button type="button" disabled={position === 0} onClick={() => moveItem(position, -1)} className="rounded p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30">
                    <ChevronUp size={16} />
                  </button>
                  <button type="button" disabled={position === order.length - 1} onClick={() => moveItem(position, 1)} className="rounded p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30">
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(questionType === 'plain_text' || questionType === 'rich_text' || !questionType) && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-slate-800">{question.question || question.text || 'Write your answer'}</h3>
          {questionType === 'rich_text' ? (
            <>
              <div className="flex items-center gap-1 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 px-2 py-1.5">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold'); }} className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-indigo-600" title="Bold">
                  <Bold size={14} />
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic'); }} className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-indigo-600" title="Italic">
                  <Italic size={14} />
                </button>
                <span className="mx-1 h-4 w-px bg-slate-200" />
                <button
                  type="button"
                  onClick={() => setSpellcheckOn((v) => !v)}
                  className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${spellcheckOn ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-100'}`}
                >
                  Spellcheck {spellcheckOn ? 'On' : 'Off'}
                </button>
              </div>
              <div
                contentEditable
                suppressContentEditableWarning
                spellCheck={spellcheckOn}
                data-placeholder="Write your answer..."
                onInput={(e) => {
                  const text = e.currentTarget.innerText || '';
                  setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
                  reportAnswer(text.trim() ? { value: e.currentTarget.innerHTML } : null);
                }}
                className="min-h-[120px] rounded-b-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
              />
            </>
          ) : (
            <textarea
              value={answer}
              onChange={(event) => {
                const text = event.target.value;
                setAnswer(text);
                setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
                reportAnswer(text.trim() ? { value: text } : null);
              }}
              rows={5}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
              placeholder="Write your answer..."
            />
          )}
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>{wordCount} word{wordCount === 1 ? '' : 's'}</span>
            {question.minWords > 0 && (
              <span className={wordCount < question.minWords ? 'text-amber-600' : 'text-emerald-600'}>
                Minimum recommended: {question.minWords}
              </span>
            )}
          </div>
        </div>
      )}

      {questionType === 'file_upload' && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-slate-800">{question.question || 'Upload your answer'}</h3>
          <label
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) { setFileName(file.name); reportAnswer({ value: file.name }); }
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              isDragOver ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <Upload size={18} />
            </span>
            {fileName ? (
              <span className="text-sm font-semibold text-slate-700">{fileName}</span>
            ) : (
              <>
                <span className="text-sm font-semibold text-slate-700">Drag &amp; drop your file here</span>
                <span className="text-xs text-slate-400">or click to browse — PNG, JPG, or PDF</span>
              </>
            )}
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setFileName(file.name); reportAnswer({ value: file.name }); }
              }}
            />
          </label>
        </div>
      )}

      {questionType === 'image_highlighter' && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-slate-800">{question.question || 'Mark the image'}</h3>
          {question.imageUrl ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {MARK_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setActiveColor(color)}
                    title={color}
                    className={`h-6 w-6 rounded-full border-2 shadow ${activeColor === color ? 'border-slate-700' : 'border-white'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                {marks.length > 0 && (
                  <button type="button" onClick={() => { setMarks([]); reportAnswer(null); }} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600">
                    <RotateCcw size={12} /> Clear marks
                  </button>
                )}
              </div>
              <div
                ref={imageBoxRef}
                className="relative select-none overflow-hidden rounded-xl border border-slate-200"
                onMouseDown={(e) => {
                  const rect = imageBoxRef.current.getBoundingClientRect();
                  setDrawStart({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
                }}
                onMouseMove={(e) => {
                  if (!drawStart) return;
                  const rect = imageBoxRef.current.getBoundingClientRect();
                  setDrawCurrent({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
                }}
                onMouseUp={() => {
                  if (drawStart && drawCurrent) {
                    const left = Math.min(drawStart.x, drawCurrent.x);
                    const top = Math.min(drawStart.y, drawCurrent.y);
                    const width = Math.abs(drawCurrent.x - drawStart.x);
                    const height = Math.abs(drawCurrent.y - drawStart.y);
                    if (width > 2 && height > 2) {
                      const id = Date.now();
                      const updated = [...marks, { id, x: left, y: top, w: width, h: height, color: activeColor, label: '' }];
                      setMarks(updated);
                      setEditingMarkId(id);
                      reportAnswer({ value: updated });
                    }
                  }
                  setDrawStart(null);
                  setDrawCurrent(null);
                }}
              >
                <img src={question.imageUrl} alt="Tryout" className="pointer-events-none block w-full" draggable={false} />
                {marks.map((mark) => (
                  <div
                    key={mark.id}
                    className="absolute rounded-md border-2"
                    style={{ left: `${mark.x}%`, top: `${mark.y}%`, width: `${mark.w}%`, height: `${mark.h}%`, borderColor: mark.color, backgroundColor: `${mark.color}33` }}
                  >
                    {editingMarkId === mark.id ? (
                      <input
                        autoFocus
                        defaultValue={mark.label}
                        onBlur={(e) => {
                          const updated = marks.map((m) => (m.id === mark.id ? { ...m, label: e.target.value } : m));
                          setMarks(updated);
                          setEditingMarkId(null);
                          reportAnswer({ value: updated });
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        className="absolute -top-7 left-0 w-28 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs"
                        placeholder="Label..."
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingMarkId(mark.id)}
                        className="absolute -top-6 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: mark.label ? mark.color : '#94a3b8' }}
                      >
                        {mark.label || '+ Add label'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMark(mark.id)}
                      className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-white text-slate-400 shadow hover:text-rose-500"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {drawStart && drawCurrent && (
                  <div
                    className="pointer-events-none absolute rounded-md border-2 border-dashed"
                    style={{
                      left: `${Math.min(drawStart.x, drawCurrent.x)}%`,
                      top: `${Math.min(drawStart.y, drawCurrent.y)}%`,
                      width: `${Math.abs(drawCurrent.x - drawStart.x)}%`,
                      height: `${Math.abs(drawCurrent.y - drawStart.y)}%`,
                      borderColor: activeColor,
                    }}
                  />
                )}
              </div>
              <p className="text-xs font-semibold text-slate-400">{marks.length} mark{marks.length !== 1 ? 's' : ''} on diagram — click and drag on the image to add one</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">No image attached for this question.</p>
          )}
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
  const [answeredIndexes, setAnsweredIndexes] = useState(() => new Set());
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [, setSaveTick] = useState(0);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  // answers keyed by question index
  const answersRef = useRef({});
  const questionRefs = useRef({});

  const storageKey = useMemo(
    () => `tryout-progress-${normalize(subjectSlug)}-${normalize(topicSlug)}`,
    [subjectSlug, topicSlug],
  );

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

  // Restore any locally auto-saved progress for this tryout.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.answers) answersRef.current = saved.answers;
      if (Array.isArray(saved?.answeredIndexes)) setAnsweredIndexes(new Set(saved.answeredIndexes));
      if (saved?.savedAt) setLastSavedAt(saved.savedAt);
    } catch {
      // Corrupt/unavailable local storage — start fresh, non-fatal.
    }
  }, [storageKey]);

  // Keep the "Saved Xs ago" label fresh.
  useEffect(() => {
    const id = setInterval(() => setSaveTick((t) => t + 1), 15000);
    return () => clearInterval(id);
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

  const formatCount = useMemo(() => new Set(assignedTryouts.map((q) => normalizeQuestionType(q.type))).size, [assignedTryouts]);

  // Track which question is currently in view so the stepper/pagination can
  // highlight it, same pattern as the reading page's section navigator.
  useEffect(() => {
    if (!assignedTryouts.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.dataset?.qIndex !== undefined) {
          setActiveQuestionIndex(Number(visible[0].target.dataset.qIndex));
        }
      },
      { rootMargin: '-15% 0px -55% 0px', threshold: [0.2, 0.5] },
    );
    Object.values(questionRefs.current).forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, [assignedTryouts.length]);

  const persistProgress = (nextAnsweredIndexes) => {
    try {
      const savedAt = Date.now();
      localStorage.setItem(storageKey, JSON.stringify({
        answers: answersRef.current,
        answeredIndexes: Array.from(nextAnsweredIndexes),
        savedAt,
      }));
      setLastSavedAt(savedAt);
    } catch {
      // Storage full/unavailable — autosave is best-effort only.
    }
  };

  const handleAnswer = (index, payload) => {
    if (payload === null || payload === undefined) {
      delete answersRef.current[index];
      setAnsweredIndexes((prev) => {
        if (!prev.has(index)) return prev;
        const next = new Set(prev);
        next.delete(index);
        persistProgress(next);
        return next;
      });
      return;
    }
    answersRef.current[index] = payload;
    setAnsweredIndexes((prev) => {
      if (prev.has(index)) {
        persistProgress(prev);
        return prev;
      }
      const next = new Set(prev).add(index);
      persistProgress(next);
      return next;
    });
  };

  const scrollToQuestion = (idx) => {
    questionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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
      try { localStorage.removeItem(storageKey); } catch { /* best-effort cleanup */ }
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
      <div className="w-full min-h-screen bg-[#f8fafc] p-4 text-slate-900 sm:p-6 md:p-8">
        <div className="mx-auto w-full max-w-[700px]">
          <div className={`${CARD} p-8 text-center`}>
            <CheckCircle2 className="mx-auto mb-4 text-emerald-500" size={48} />
            <h1 className="text-2xl font-bold text-slate-900">Tryout Submitted!</h1>
            <p className="mt-2 text-sm text-slate-500">Your answers have been recorded.</p>

            {autoCount > 0 && autoScore !== null && (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4">
                <p className="text-sm font-semibold text-emerald-700">Auto-graded score (MCQ)</p>
                <p className="mt-1 text-4xl font-bold text-emerald-600">{autoScore}%</p>
                <p className="mt-1 text-xs text-emerald-600">{autoCount} of {total} question{total !== 1 ? 's' : ''} auto-graded</p>
              </div>
            )}

            {manualCount > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-6 py-3">
                <p className="text-sm font-semibold text-amber-700">
                  {manualCount} question{manualCount !== 1 ? 's' : ''} will be reviewed and marked by your teacher.
                </p>
              </div>
            )}

            <button type="button" onClick={returnToPreviousView} className={`mt-6 ${GHOST_BTN}`}>
              <ArrowLeft size={16} /> {onBack ? 'Back to Activities' : 'Back to Topic'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalQuestions = assignedTryouts.length;
  const answeredCount = answeredIndexes.size;
  const progressPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const momentumLabel = progressPct === 0 ? 'Let’s get started!' : progressPct === 100 ? 'All done — ready to submit!' : 'Good momentum!';

  return (
    <div className="w-full min-h-screen bg-[#f8fafc] p-4 pb-28 text-slate-900 sm:p-6 sm:pb-28 md:p-8 md:pb-28">
      <style>{'[data-placeholder]:empty:before{content:attr(data-placeholder)}'}</style>
      <div className="mx-auto w-full max-w-[950px]">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={returnToPreviousView} className={GHOST_BTN}>
            <ArrowLeft size={16} />
            {onBack ? 'Back to Activities' : 'Back to Topic'}
          </button>
          {chapterTitle && (
            <span className="hidden items-center gap-1.5 text-sm text-slate-400 sm:flex">
              <span className="text-slate-300">/</span> {chapterTitle}
            </span>
          )}
          {lastSavedAt && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Saved {formatAgo(lastSavedAt)}
            </span>
          )}
          <button type="button" onClick={() => navigate('/student/assignments-academic-alcove')} className={`ml-auto ${GHOST_BTN}`}>
            <MessageCircle size={16} className="text-indigo-500" /> Need Help?
          </button>
        </div>

        {totalQuestions > 1 && (
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
            {assignedTryouts.map((q, idx) => {
              const isAnswered = answeredIndexes.has(idx);
              const isActive = activeQuestionIndex === idx;
              const meta = typeMeta(q.type);
              const Icon = meta.icon;
              return (
                <button
                  key={q.id || idx}
                  type="button"
                  onClick={() => scrollToQuestion(idx)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    isActive ? 'bg-indigo-600 text-white shadow-sm' : isAnswered ? 'border border-emerald-300 bg-emerald-50 text-emerald-700' : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300'
                  }`}
                >
                  {isAnswered ? <CheckCircle2 size={13} /> : <Icon size={13} className={isActive ? '' : 'text-slate-400'} />}
                  Q{idx + 1} <span className={isActive ? 'text-white/70' : 'text-slate-400'}>&bull;</span> {meta.short}
                </button>
              );
            })}
          </div>
        )}

        <section className={`mb-5 ${CARD} p-5 sm:p-8`}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700">Assigned Tryout</span>
                {formatCount > 1 && (
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-bold text-sky-700">{formatCount} Interactive Formats</span>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">{topicSlug} Quiz</h1>
              <p className="mt-2 max-w-xl text-sm text-slate-500 sm:text-base">
                Complete the questions below. Your teacher will receive your responses{chapterTitle ? ` for ${chapterTitle}` : ''}.
              </p>
            </div>

            {totalQuestions > 0 && (
              <div className="flex w-full shrink-0 items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:w-auto">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                  <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                    <path className="text-slate-200" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" />
                    <path
                      className="text-indigo-600 transition-all duration-500"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeDasharray={`${progressPct}, 100`}
                    />
                  </svg>
                  <span className="absolute text-sm font-bold text-indigo-600">{progressPct}%</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{answeredCount}/{totalQuestions} Questions</p>
                  <p className="text-xs text-slate-400">{momentumLabel}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {loading && <div className={`${CARD} p-6 text-sm font-semibold text-slate-500`}>Loading assigned tryout...</div>}
        {!loading && !error && assignedTryouts.length === 0 && (
          <div className={`${CARD} p-8 text-center`}>
            <CheckCircle2 className="mx-auto mb-3 text-slate-300" size={34} />
            <h2 className="text-lg font-bold text-slate-800">No tryout assigned</h2>
            <p className="mt-1 text-sm text-slate-500">Your teacher has not assigned a tryout for this topic yet.</p>
          </div>
        )}
        {!loading && !error && assignedTryouts.length > 0 && (
          <div className="space-y-4">
            {assignedTryouts.map((question, index) => (
              <div key={question.id || index} ref={(node) => { questionRefs.current[index] = node; }} data-q-index={index}>
                <TryoutQuestion
                  question={question}
                  index={index}
                  onAnswer={(ans) => handleAnswer(index, ans)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && !error && totalQuestions > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:px-6">
          <div className="mx-auto flex w-full max-w-[950px] flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={activeQuestionIndex === 0}
              onClick={() => scrollToQuestion(Math.max(0, activeQuestionIndex - 1))}
              className={`${GHOST_BTN} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <ArrowLeft size={14} /> Previous
            </button>
            <div className="hidden items-center gap-1.5 sm:flex">
              {assignedTryouts.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => scrollToQuestion(idx)}
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${
                    activeQuestionIndex === idx ? 'bg-indigo-600' : answeredIndexes.has(idx) ? 'bg-emerald-400' : 'bg-slate-200'
                  }`}
                  aria-label={`Go to question ${idx + 1}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={activeQuestionIndex >= totalQuestions - 1}
                onClick={() => scrollToQuestion(Math.min(totalQuestions - 1, activeQuestionIndex + 1))}
                className={`${GHOST_BTN} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                Next <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit Tryout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AILearningTryoutSection;
