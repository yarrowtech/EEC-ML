import React, { useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowLeft,
  Plus,
  CheckCircle2,
  List,
  Grid3X3,
  FileText,
  GripVertical,
  ArrowLeftRight,
  FileUp,
  Highlighter,
  PenTool,
  ChevronDown,
  Trash2,
  Edit3,
  Save,
  Eye,
  Play,
  Zap,
  ClipboardList,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { downloadTryoutTemplate, parseTryoutExcel, EXCEL_TEMPLATES } from './tryoutExcel';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const TRYOUT_TYPES = [
  { id: 'mcq', label: 'Multiple Choice (MCQ)', icon: CheckCircle2, description: 'Single correct answer from options' },
  { id: 'choice_matrix', label: 'Choice Matrix', icon: Grid3X3, description: 'True/False or multiple statements' },
  { id: 'cloze_drag_drop', label: 'Cloze Drag & Drop', icon: GripVertical, description: 'Fill blanks by dragging options' },
  { id: 'cloze_dropdown', label: 'Cloze Dropdown', icon: ChevronDown, description: 'Fill blanks from dropdown' },
  { id: 'cloze_text', label: 'Cloze Text', icon: FileText, description: 'Fill in the blank text input' },
  { id: 'match_list', label: 'Match List', icon: ArrowLeftRight, description: 'Match items with their pairs' },
  { id: 'sort_list', label: 'Sort List', icon: List, description: 'Arrange items in correct order' },
  { id: 'plain_text', label: 'Plain Text Response', icon: PenTool, description: 'Open-ended text answer' },
  { id: 'rich_text', label: 'Rich Text Response', icon: FileText, description: 'Formatted text answer' },
  { id: 'file_upload', label: 'File Upload', icon: FileUp, description: 'Upload file as answer' },
  { id: 'image_highlighter', label: 'Image Highlighter', icon: Highlighter, description: 'Draw/highlight on image' },
];

// MCQ Question Creator
const MCQCreator = ({ question, onChange }) => {
  const [options, setOptions] = useState(question.options || ['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer === undefined ? 0 : question.correctAnswer);
  const [questionText, setQuestionText] = useState(question.question || '');
  const [theme, setTheme] = useState(question.theme || 'standard');

  const handleUpdate = (updates) => {
    onChange({ ...question, options, correctAnswer, question: questionText, theme, ...updates });
  };

  const addOption = () => {
    const newOptions = [...options, ''];
    setOptions(newOptions);
    handleUpdate({ options: newOptions });
  };

  const removeOption = (index) => {
    if (options.length <= 2) return;
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    const nextCorrect = index === correctAnswer ? null : correctAnswer > index ? correctAnswer - 1 : correctAnswer;
    setCorrectAnswer(nextCorrect);
    handleUpdate({ options: newOptions, correctAnswer: nextCorrect });
  };

  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    handleUpdate({ options: newOptions });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Question</label>
        <Textarea
          aria-label="Question"
          value={questionText}
          onChange={(e) => {
            setQuestionText(e.target.value);
            handleUpdate({ question: e.target.value });
          }}
          placeholder="Enter your question..."
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Display Theme</label>
        <select
          aria-label="Display Theme"
          value={theme}
          onChange={(e) => {
            setTheme(e.target.value);
            handleUpdate({ theme: e.target.value });
          }}
          style={{ colorScheme: 'light' }}
          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="standard" className="text-slate-900">Standard (Radio buttons)</option>
          <option value="block" className="text-slate-900">Block (Buttons)</option>
          <option value="radio" className="text-slate-900">Radio Button Style</option>
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Options</label>
          <Button variant="outline" size="sm" onClick={addOption}>
            <Plus className="size-3 mr-1" /> Add Option
          </Button>
        </div>
        <div className="space-y-2">
          {options.map((option, index) => {
            const isCorrect = correctAnswer === index;
            return (
              <div
                key={index}
                className={`flex items-center gap-2 rounded-lg border p-1.5 transition-colors ${
                  isCorrect ? 'border-green-400 bg-green-50 dark:bg-green-950/30' : 'border-transparent'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setCorrectAnswer(index);
                    handleUpdate({ correctAnswer: index });
                  }}
                  title="Mark as correct answer"
                  className={`shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors ${
                    isCorrect
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-white border-slate-300 text-slate-500 hover:border-green-400 hover:text-green-600'
                  }`}
                >
                  <CheckCircle2 className="size-3.5" />
                  {isCorrect ? 'Correct' : 'Mark correct'}
                </button>
                <Input
                  aria-label={`Option ${index + 1}`}
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1"
                />
                {options.length > 2 && (
                  <Button aria-label={`Remove option ${index + 1}`} variant="ghost" size="icon-sm" onClick={() => removeOption(index)}>
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-500 mt-1">Click "Mark correct" on the option that is the right answer</p>
      </div>
    </div>
  );
};

// Choice Matrix Creator
const ChoiceMatrixCreator = ({ question, onChange }) => {
  const [statements, setStatements] = useState(question.statements || ['']);
  const [answers, setAnswers] = useState(question.answers || [null]);

  const handleUpdate = (updates) => {
    onChange({ ...question, ...updates });
  };

  const addStatement = () => {
    const newStatements = [...statements, ''];
    const newAnswers = [...answers, null];
    setStatements(newStatements);
    setAnswers(newAnswers);
    handleUpdate({ statements: newStatements, answers: newAnswers });
  };

  const removeStatement = (index) => {
    if (statements.length <= 1) return;
    const newStatements = statements.filter((_, i) => i !== index);
    const newAnswers = answers.filter((_, i) => i !== index);
    setStatements(newStatements);
    setAnswers(newAnswers);
    handleUpdate({ statements: newStatements, answers: newAnswers });
  };

  const updateStatement = (index, value) => {
    const newStatements = [...statements];
    newStatements[index] = value;
    setStatements(newStatements);
    handleUpdate({ statements: newStatements });
  };

  const updateAnswer = (index, value) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
    handleUpdate({ answers: newAnswers });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Statements</label>
        <Button variant="outline" size="sm" onClick={addStatement}>
          <Plus className="size-3 mr-1" /> Add Statement
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-slate-700">
              <th className="text-left py-2 px-2 text-slate-600 dark:text-slate-300">Statement</th>
              <th className="py-2 px-2 text-center text-slate-600 dark:text-slate-300 w-20">True</th>
              <th className="py-2 px-2 text-center text-slate-600 dark:text-slate-300 w-20">False</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {statements.map((statement, index) => (
              <tr key={index} className="border-b dark:border-slate-700">
                <td className="py-2 px-2">
                  <Input
                    aria-label={`Statement ${index + 1}`}
                    value={statement}
                    onChange={(e) => updateStatement(index, e.target.value)}
                    placeholder={`Statement ${index + 1}`}
                  />
                </td>
                <td className="py-2 px-2 text-center">
                  <input
                    aria-label={`Statement ${index + 1}: true`}
                  type="radio"
                    name={`choice-${index}`}
                    checked={answers[index] === true}
                    onChange={() => updateAnswer(index, true)}
                    className="accent-green-500 w-4 h-4"
                  />
                </td>
                <td className="py-2 px-2 text-center">
                  <input
                    aria-label={`Statement ${index + 1}: false`}
                  type="radio"
                    name={`choice-${index}`}
                    checked={answers[index] === false}
                    onChange={() => updateAnswer(index, false)}
                    className="accent-red-500 w-4 h-4"
                  />
                </td>
                <td className="py-2 px-2">
                  {statements.length > 1 && (
                    <Button aria-label="Remove item" variant="ghost" size="icon-sm" onClick={() => removeStatement(index)}>
                      <Trash2 className="size-4 text-red-500" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Cloze Drag Drop Creator
const ClozeDragDropCreator = ({ question, onChange }) => {
  const [text, setText] = useState(question.text || '');
  const [options, setOptions] = useState(question.options || []);
  const [hints, setHints] = useState(question.hints || []);
  const [optionPosition, setOptionPosition] = useState(question.optionPosition || 'down');
  const [correctAnswers, setCorrectAnswers] = useState(question.correctAnswers || []);

  const handleUpdate = (updates) => {
    onChange({ ...question, ...updates });
  };

  const blankCount = (text.match(/\$\{\{blank\}\}/g) || []).length;

  const updateCorrectAnswer = (blankIndex, optionIndex) => {
    const newCorrect = [...correctAnswers];
    newCorrect[blankIndex] = optionIndex;
    setCorrectAnswers(newCorrect);
    handleUpdate({ correctAnswers: newCorrect });
  };

  const addOption = () => {
    const newOptions = [...options, ''];
    const newHints = [...hints, ''];
    setOptions(newOptions);
    setHints(newHints);
    handleUpdate({ options: newOptions, hints: newHints });
  };

  const removeOption = (index) => {
    const newOptions = options.filter((_, i) => i !== index);
    const newHints = hints.filter((_, i) => i !== index);
    // Drop or shift any correct-answer references to the removed option
    const newCorrect = correctAnswers.map((optIndex) => {
      if (optIndex === index) return undefined;
      if (optIndex > index) return optIndex - 1;
      return optIndex;
    });
    setOptions(newOptions);
    setHints(newHints);
    setCorrectAnswers(newCorrect);
    handleUpdate({ options: newOptions, hints: newHints, correctAnswers: newCorrect });
  };

  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    handleUpdate({ options: newOptions });
  };

  const updateHint = (index, value) => {
    const newHints = [...hints];
    newHints[index] = value;
    setHints(newHints);
    handleUpdate({ hints: newHints });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          Question Text
          <span className="text-xs text-slate-500 ml-2">(Use $&#123;&#123;blank&#125;&#125; for blanks)</span>
        </label>
        <Textarea
          aria-label="There are several ${{blank}} types of drums. The ${{blank}} drum is..."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleUpdate({ text: e.target.value });
          }}
          placeholder="There are several ${{blank}} types of drums. The ${{blank}} drum is..."
          rows={4}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Option Position</label>
        <select
          aria-label="Option Position"
          value={optionPosition}
          onChange={(e) => {
            setOptionPosition(e.target.value);
            handleUpdate({ optionPosition: e.target.value });
          }}
          style={{ colorScheme: 'light' }}
          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="up" className="text-slate-900">Up</option>
          <option value="down" className="text-slate-900">Down</option>
          <option value="left" className="text-slate-900">Left</option>
          <option value="right" className="text-slate-900">Right</option>
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Drag Options</label>
          <Button variant="outline" size="sm" onClick={addOption}>
            <Plus className="size-3 mr-1" /> Add Option
          </Button>
        </div>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                aria-label={`Option ${index + 1}`}
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                className="flex-1"
              />
              <Input
                aria-label="Hint (optional)"
                value={hints[index] || ''}
                onChange={(e) => updateHint(index, e.target.value)}
                placeholder="Hint (optional)"
                className="flex-1"
              />
              <Button aria-label="Remove item" variant="ghost" size="icon-sm" onClick={() => removeOption(index)}>
                <Trash2 className="size-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {blankCount > 0 && options.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Correct Answers (for auto-grading)</label>
          <div className="space-y-2">
            {Array.from({ length: blankCount }).map((_, blankIndex) => (
              <div key={blankIndex} className="flex items-center gap-2">
                <span className="text-sm text-slate-500 w-20 shrink-0">Blank {blankIndex + 1}:</span>
                <select
                  aria-label={`Correct answer for blank ${blankIndex + 1}`}
                  value={correctAnswers[blankIndex] ?? ''}
                  onChange={(e) => updateCorrectAnswer(blankIndex, e.target.value === '' ? undefined : Number(e.target.value))}
                  style={{ colorScheme: 'light' }}
                  className="flex-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Select correct option...</option>
                  {options.map((opt, optIndex) => (
                    <option key={optIndex} value={optIndex} className="text-slate-900">{opt || `Option ${optIndex + 1}`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Cloze Dropdown Creator
const ClozeDropdownCreator = ({ question, onChange }) => {
  const [text, setText] = useState(question.text || '');
  const [dropdownOptions, setDropdownOptions] = useState(question.dropdownOptions || [[]]);
  const [correctAnswers, setCorrectAnswers] = useState(question.correctAnswers || []);

  const handleUpdate = (updates) => {
    onChange({ ...question, ...updates });
  };

  const updateCorrectAnswer = (dropIndex, value) => {
    const newCorrect = [...correctAnswers];
    newCorrect[dropIndex] = value;
    setCorrectAnswers(newCorrect);
    handleUpdate({ correctAnswers: newCorrect });
  };

  const addDropdown = () => {
    const newOptions = [...dropdownOptions, []];
    setDropdownOptions(newOptions);
    handleUpdate({ dropdownOptions: newOptions });
  };

  const removeDropdown = (index) => {
    if (dropdownOptions.length <= 1) return;
    const newOptions = dropdownOptions.filter((_, i) => i !== index);
    const newCorrect = correctAnswers.filter((_, i) => i !== index);
    setDropdownOptions(newOptions);
    setCorrectAnswers(newCorrect);
    handleUpdate({ dropdownOptions: newOptions, correctAnswers: newCorrect });
  };

  const updateDropdownOption = (dropIndex, optIndex, value) => {
    const newOptions = [...dropdownOptions];
    const oldValue = newOptions[dropIndex]?.[optIndex];
    newOptions[dropIndex] = [...(newOptions[dropIndex] || [])];
    newOptions[dropIndex][optIndex] = value;
    setDropdownOptions(newOptions);
    // Keep the correct-answer pointer in sync if the correct option's text was edited
    const newCorrect = [...correctAnswers];
    if (newCorrect[dropIndex] === oldValue) newCorrect[dropIndex] = value;
    setCorrectAnswers(newCorrect);
    handleUpdate({ dropdownOptions: newOptions, correctAnswers: newCorrect });
  };

  const addOptionToDropdown = (dropIndex) => {
    const newOptions = [...dropdownOptions];
    newOptions[dropIndex] = [...(newOptions[dropIndex] || []), ''];
    setDropdownOptions(newOptions);
    handleUpdate({ dropdownOptions: newOptions });
  };

  const removeOptionFromDropdown = (dropIndex, optIndex) => {
    const newOptions = [...dropdownOptions];
    const removedValue = newOptions[dropIndex]?.[optIndex];
    newOptions[dropIndex] = newOptions[dropIndex].filter((_, i) => i !== optIndex);
    setDropdownOptions(newOptions);
    const newCorrect = [...correctAnswers];
    if (newCorrect[dropIndex] === removedValue) newCorrect[dropIndex] = undefined;
    setCorrectAnswers(newCorrect);
    handleUpdate({ dropdownOptions: newOptions, correctAnswers: newCorrect });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          Question Text
          <span className="text-xs text-slate-500 ml-2">(Use $&#123;&#123;input&#125;&#125; for dropdowns)</span>
        </label>
        <Textarea
          aria-label="Yesterday, we ${{input}} to the store. Tomorrow we ${{input}} to school."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleUpdate({ text: e.target.value });
          }}
          placeholder="Yesterday, we ${{input}} to the store. Tomorrow we ${{input}} to school."
          rows={4}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Dropdown Options (in order of blanks)</label>
          <Button variant="outline" size="sm" onClick={addDropdown}>
            <Plus className="size-3 mr-1" /> Add Dropdown
          </Button>
        </div>
        <div className="space-y-3">
          {dropdownOptions.map((options, dropIndex) => (
            <div key={dropIndex} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-600">Dropdown {dropIndex + 1}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => addOptionToDropdown(dropIndex)}>
                    <Plus className="size-3" />
                  </Button>
                  {dropdownOptions.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeDropdown(dropIndex)}>
                      <Trash2 className="size-3 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(options || []).map((opt, optIndex) => (
                  <div key={optIndex} className="flex items-center gap-1">
                    <Input
                      aria-label={`Option ${optIndex + 1}`}
                      value={opt}
                      onChange={(e) => updateDropdownOption(dropIndex, optIndex, e.target.value)}
                      placeholder={`Option ${optIndex + 1}`}
                      className="w-24"
                    />
                    <Button aria-label="Remove item" variant="ghost" size="icon-sm" onClick={() => removeOptionFromDropdown(dropIndex, optIndex)}>
                      <X className="size-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
              {(options || []).filter(Boolean).length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-slate-500 shrink-0">Correct answer:</span>
                  <select
                    aria-label={`Correct answer for dropdown ${dropIndex + 1}`}
                    value={correctAnswers[dropIndex] ?? ''}
                    onChange={(e) => updateCorrectAnswer(dropIndex, e.target.value === '' ? undefined : e.target.value)}
                    style={{ colorScheme: 'light' }}
                    className="flex-1 h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">Select correct option...</option>
                    {(options || []).filter(Boolean).map((opt, optIndex) => (
                      <option key={optIndex} value={opt} className="text-slate-900">{opt}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Cloze Text Creator
const ClozeTextCreator = ({ question, onChange }) => {
  const [text, setText] = useState(question.text || '');
  const [correctAnswers, setCorrectAnswers] = useState(question.correctAnswers || []);

  const handleUpdate = (updates) => {
    onChange({ ...question, ...updates });
  };

  const updateAnswer = (index, value) => {
    const newAnswers = [...correctAnswers];
    newAnswers[index] = value;
    setCorrectAnswers(newAnswers);
    handleUpdate({ correctAnswers: newAnswers });
  };

  // Count blanks in text
  const blankCount = (text.match(/\$\{\{input\}\}/g) || []).length;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          Question Text
          <span className="text-xs text-slate-500 ml-2">(Use $&#123;&#123;input&#125;&#125; for blanks)</span>
        </label>
        <Textarea
          aria-label="We the ${{input}} of the United States, in order to form a more ${{input}}..."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleUpdate({ text: e.target.value });
          }}
          placeholder="We the ${{input}} of the United States, in order to form a more ${{input}}..."
          rows={4}
        />
      </div>

      {blankCount > 0 && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
            Correct Answers (in order)
          </label>
          <div className="space-y-2">
            {Array.from({ length: blankCount }).map((_, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-sm text-slate-500 w-20">Blank {index + 1}:</span>
                <Input
                  aria-label={`Answer for blank ${index + 1}`}
                  value={correctAnswers[index] || ''}
                  onChange={(e) => updateAnswer(index, e.target.value)}
                  placeholder={`Answer for blank ${index + 1}`}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Match List Creator
const MatchListCreator = ({ question, onChange }) => {
  const [items, setItems] = useState(question.items || ['']);
  const [pairs, setPairs] = useState(question.pairs || ['']);

  const handleUpdate = (updates) => {
    onChange({ ...question, ...updates });
  };

  const addPair = () => {
    const newItems = [...items, ''];
    const newPairs = [...pairs, ''];
    setItems(newItems);
    setPairs(newPairs);
    handleUpdate({ items: newItems, pairs: newPairs });
  };

  const removePair = (index) => {
    if (items.length <= 1) return;
    const newItems = items.filter((_, i) => i !== index);
    const newPairs = pairs.filter((_, i) => i !== index);
    setItems(newItems);
    setPairs(newPairs);
    handleUpdate({ items: newItems, pairs: newPairs });
  };

  const updateItem = (index, value) => {
    const newItems = [...items];
    newItems[index] = value;
    setItems(newItems);
    handleUpdate({ items: newItems });
  };

  const updatePair = (index, value) => {
    const newPairs = [...pairs];
    newPairs[index] = value;
    setPairs(newPairs);
    handleUpdate({ pairs: newPairs });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Match Pairs</label>
        <Button variant="outline" size="sm" onClick={addPair}>
          <Plus className="size-3 mr-1" /> Add Pair
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              aria-label={`Item ${index + 1}`}
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={`Item ${index + 1}`}
              className="flex-1"
            />
            <ArrowLeftRight className="size-4 text-slate-400" />
            <Input
              aria-label={`Match ${index + 1}`}
              value={pairs[index] || ''}
              onChange={(e) => updatePair(index, e.target.value)}
              placeholder={`Match ${index + 1}`}
              className="flex-1"
            />
            {items.length > 1 && (
              <Button aria-label="Remove item" variant="ghost" size="icon-sm" onClick={() => removePair(index)}>
                <Trash2 className="size-4 text-red-500" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Items will be shuffled for students</p>
    </div>
  );
};

// Sort List Creator
const SortListCreator = ({ question, onChange }) => {
  const [questionText, setQuestionText] = useState(question.question || '');
  const [items, setItems] = useState(question.items || ['']);

  const handleUpdate = (updates) => {
    onChange({ ...question, ...updates });
  };

  const addItem = () => {
    const newItems = [...items, ''];
    setItems(newItems);
    handleUpdate({ items: newItems });
  };

  const removeItem = (index) => {
    if (items.length <= 2) return;
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    handleUpdate({ items: newItems });
  };

  const updateItem = (index, value) => {
    const newItems = [...items];
    newItems[index] = value;
    setItems(newItems);
    handleUpdate({ items: newItems });
  };

  const moveItem = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    const newItems = [...items];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    setItems(newItems);
    handleUpdate({ items: newItems });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Question/Instruction</label>
        <Textarea
          aria-label="Sort the countries in ascending order based on their population:"
          value={questionText}
          onChange={(e) => {
            setQuestionText(e.target.value);
            handleUpdate({ question: e.target.value });
          }}
          placeholder="Sort the countries in ascending order based on their population:"
          rows={2}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Items (in correct order)
          </label>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="size-3 mr-1" /> Add Item
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm text-slate-500 w-6">{index + 1}.</span>
              <Input
                aria-label={`Item ${index + 1}`}
                value={item}
                onChange={(e) => updateItem(index, e.target.value)}
                placeholder={`Item ${index + 1}`}
                className="flex-1"
              />
              <div className="flex gap-1">
                <Button
                  aria-label={`Move item ${index + 1} up`}
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => moveItem(index, 'up')}
                  disabled={index === 0}
                >
                  <ChevronDown className="size-4 rotate-180" />
                </Button>
                <Button
                  aria-label={`Move item ${index + 1} down`}
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => moveItem(index, 'down')}
                  disabled={index === items.length - 1}
                >
                  <ChevronDown className="size-4" />
                </Button>
              </div>
              {items.length > 2 && (
                <Button aria-label="Remove item" variant="ghost" size="icon-sm" onClick={() => removeItem(index)}>
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1">Enter items in the correct order. They will be shuffled for students.</p>
      </div>
    </div>
  );
};

// Simple Text Response Creator
const TextResponseCreator = ({ question, onChange }) => {
  const [questionText, setQuestionText] = useState(question.question || '');
  const [maxWords, setMaxWords] = useState(question.maxWords || 10000);

  const handleUpdate = (updates) => {
    onChange({ ...question, ...updates });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Question</label>
        <Textarea
          aria-label="Enter your question..."
          value={questionText}
          onChange={(e) => {
            setQuestionText(e.target.value);
            handleUpdate({ question: e.target.value });
          }}
          placeholder="Enter your question..."
          rows={3}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Max Words</label>
        <Input
          aria-label="Answer"
          type="number"
          value={maxWords}
          onChange={(e) => {
            setMaxWords(parseInt(e.target.value) || 10000);
            handleUpdate({ maxWords: parseInt(e.target.value) || 10000 });
          }}
          min={1}
        />
      </div>
    </div>
  );
};

// File Upload Creator
const FileUploadCreator = ({ question, onChange }) => {
  const [questionText, setQuestionText] = useState(question.question || '');
  const [allowedTypes, setAllowedTypes] = useState(question.allowedTypes || ['image', 'pdf', 'document']);

  const handleUpdate = (updates) => {
    onChange({ ...question, ...updates });
  };

  const toggleType = (type) => {
    const newTypes = allowedTypes.includes(type)
      ? allowedTypes.filter(t => t !== type)
      : [...allowedTypes, type];
    setAllowedTypes(newTypes);
    handleUpdate({ allowedTypes: newTypes });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Question/Instructions</label>
        <Textarea
          aria-label="Upload your assignment..."
          value={questionText}
          onChange={(e) => {
            setQuestionText(e.target.value);
            handleUpdate({ question: e.target.value });
          }}
          placeholder="Upload your assignment..."
          rows={3}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Allowed File Types</label>
        <div className="flex flex-wrap gap-2">
          {['image', 'pdf', 'document', 'video', 'audio'].map(type => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-3 py-1 rounded-full text-sm capitalize ${
                allowedTypes.includes(type)
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Image Highlighter Creator
const ImageHighlighterCreator = ({ question, onChange }) => {
  const [questionText, setQuestionText] = useState(question.question || '');
  const [imageUrl, setImageUrl] = useState(question.imageUrl || '');
  // Correct areas the student must find, in % of the image so they fit any screen size.
  const [regions, setRegions] = useState(Array.isArray(question.answerRegions) ? question.answerRegions : []);
  const [drawStart, setDrawStart] = useState(null);
  const [drawCurrent, setDrawCurrent] = useState(null);
  const imageBoxRef = React.useRef(null);

  const handleUpdate = (updates) => {
    onChange({ ...question, question: questionText, imageUrl, answerRegions: regions, ...updates });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result);
        setRegions([]); // old areas don't fit a new picture
        handleUpdate({ imageUrl: reader.result, answerRegions: [] });
      };
      reader.readAsDataURL(file);
    }
  };

  const pointFrom = (e) => {
    const rect = imageBoxRef.current.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const finishRegion = () => {
    if (drawStart && drawCurrent) {
      const r = {
        id: `region-${Date.now()}`,
        x: Math.min(drawStart.x, drawCurrent.x),
        y: Math.min(drawStart.y, drawCurrent.y),
        w: Math.abs(drawCurrent.x - drawStart.x),
        h: Math.abs(drawCurrent.y - drawStart.y),
        label: '',
      };
      if (r.w > 1.5 && r.h > 1.5) {
        const next = [...regions, r];
        setRegions(next);
        handleUpdate({ answerRegions: next });
      }
    }
    setDrawStart(null);
    setDrawCurrent(null);
  };

  const updateRegion = (id, patch) => {
    const next = regions.map((r) => (r.id === id ? { ...r, ...patch } : r));
    setRegions(next);
    handleUpdate({ answerRegions: next });
  };
  const removeRegion = (id) => {
    const next = regions.filter((r) => r.id !== id);
    setRegions(next);
    handleUpdate({ answerRegions: next });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Question/Instructions</label>
        <Textarea
          aria-label="Draw on the image to highlight healthy vs unhealthy items..."
          value={questionText}
          onChange={(e) => {
            setQuestionText(e.target.value);
            handleUpdate({ question: e.target.value });
          }}
          placeholder="e.g. Mark the CPU and the monitor in the picture."
          rows={3}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{imageUrl ? 'Change image' : 'Upload Image'}</label>
        <input
          aria-label="Upload Image"
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="block w-full text-sm border rounded-md file:bg-purple-600 file:text-white file:px-4 file:py-2 file:border-0 file:rounded-lg file:cursor-pointer hover:file:bg-purple-700"
        />
      </div>

      {imageUrl && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-sm font-semibold text-slate-800">Mark the correct answer areas</p>
          <p className="mb-3 text-xs text-slate-600">
            Drag on the picture to draw a box around each place the student must find. Students get marks when their boxes cover these areas.
          </p>
          <div
            ref={imageBoxRef}
            className="relative inline-block max-w-full cursor-crosshair touch-none select-none overflow-hidden rounded-lg border border-slate-300"
            onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); const p = pointFrom(e); setDrawStart(p); setDrawCurrent(p); }}
            onPointerMove={(e) => { if (drawStart) setDrawCurrent(pointFrom(e)); }}
            onPointerUp={finishRegion}
          >
            <img src={imageUrl} alt="Question" draggable={false} className="block max-h-[420px] max-w-full" />
            {regions.map((r, i) => (
              <div key={r.id} className="pointer-events-none absolute rounded border-2 border-emerald-500 bg-emerald-400/20" style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}>
                <span className="absolute -left-0.5 -top-0.5 flex size-5 items-center justify-center rounded-br-md bg-emerald-600 text-[10px] font-bold text-white">{i + 1}</span>
              </div>
            ))}
            {drawStart && drawCurrent && (
              <div
                className="pointer-events-none absolute rounded border-2 border-dashed border-emerald-600 bg-emerald-400/10"
                style={{
                  left: `${Math.min(drawStart.x, drawCurrent.x)}%`,
                  top: `${Math.min(drawStart.y, drawCurrent.y)}%`,
                  width: `${Math.abs(drawCurrent.x - drawStart.x)}%`,
                  height: `${Math.abs(drawCurrent.y - drawStart.y)}%`,
                }}
              />
            )}
          </div>

          {regions.length === 0 ? (
            <p className="mt-2 text-xs font-medium text-amber-700">No correct areas yet — without them this question is marked by you by hand.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {regions.map((r, i) => (
                <li key={r.id} className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">{i + 1}</span>
                  <Input
                    aria-label={`Name for area ${i + 1}`}
                    value={r.label || ''}
                    onChange={(e) => updateRegion(r.id, { label: e.target.value })}
                    placeholder="Name (optional), e.g. CPU"
                    className="h-8 text-xs"
                  />
                  <button type="button" onClick={() => removeRegion(r.id)} aria-label={`Remove area ${i + 1}`} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

// Question type to creator component mapping
const QUESTION_CREATORS = {
  mcq: MCQCreator,
  choice_matrix: ChoiceMatrixCreator,
  cloze_drag_drop: ClozeDragDropCreator,
  cloze_dropdown: ClozeDropdownCreator,
  cloze_text: ClozeTextCreator,
  match_list: MatchListCreator,
  sort_list: SortListCreator,
  plain_text: TextResponseCreator,
  rich_text: TextResponseCreator,
  file_upload: FileUploadCreator,
  image_highlighter: ImageHighlighterCreator,
};

// Main TryoutBuilder Component
const TryoutBuilder = ({
  open,
  onClose,
  tryouts = [],
  onSaveTryouts
}) => {
  const [localTryouts, setLocalTryouts] = useState(tryouts);
  const [selectedType, setSelectedType] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState({});

  const handleAddQuestion = () => {
    if (!selectedType) return;
    setCurrentQuestion({ type: selectedType, id: `tryout-${Date.now()}` });
    setEditingIndex(null);
  };

  const addAllQuestionTypes = () => {
    const newQuestions = TRYOUT_TYPES.map((type, idx) => ({
      id: `tryout-${Date.now()}-${idx}`,
      type: type.id,
    }));
    setLocalTryouts((prev) => [...prev, ...newQuestions]);
  };

  const handleEditQuestion = (index) => {
    setCreatingNew(false);
    setBulkResult(null);
    setEditingIndex(index);
    setCurrentQuestion({ ...localTryouts[index] });
    setSelectedType(localTryouts[index].type);
  };

  const handleSaveQuestion = () => {
    if (editingIndex !== null) {
      const updated = [...localTryouts];
      updated[editingIndex] = currentQuestion;
      setLocalTryouts(updated);
    } else {
      setLocalTryouts([...localTryouts, currentQuestion]);
    }
    setCurrentQuestion({});
    setSelectedType(null);
    setEditingIndex(null);
  };

  const handleDeleteQuestion = (index) => {
    setLocalTryouts(localTryouts.filter((_, i) => i !== index));
  };

  const handleSaveAll = () => {
    onSaveTryouts(localTryouts);
    onClose();
  };

  const CreatorComponent = selectedType ? QUESTION_CREATORS[selectedType] : null;

  if (!open) return null;

  return (
    <AnimatePresence>
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <Motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-purple-500 to-indigo-600 p-4 dark:border-slate-700">
            <h2 className="text-xl font-bold text-white">Tryout Builder</h2>
            <Button variant="ghost" size="icon-sm" onClick={onClose} className="text-white hover:bg-white/20">
              <X className="size-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex h-[calc(90vh-140px)]">
            {/* Left Panel - Question List */}
            <div className="w-1/3 border-r border-slate-200 p-4 dark:border-slate-700 overflow-y-auto">
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Questions ({localTryouts.length})</h3>

              {localTryouts.length === 0 ? (
                <p className="text-sm text-slate-500">No questions added yet</p>
              ) : (
                <div className="space-y-2">
                  {localTryouts.map((tryout, index) => {
                    const typeInfo = TRYOUT_TYPES.find(t => t.id === tryout.type);
                    return (
                      <div
                        key={tryout.id || index}
                        className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                          editingIndex === index
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-slate-200 hover:border-purple-300 dark:border-slate-700'
                        }`}
                        onClick={() => handleEditQuestion(index)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {typeInfo && <typeInfo.icon className="size-4 text-purple-500" />}
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                              {typeInfo?.label || tryout.type}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuestion(index);
                            }}
                          >
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 truncate">
                          {tryout.question || tryout.text || 'Question ' + (index + 1)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Panel - Question Creator */}
            <div className="flex-1 p-4 overflow-y-auto">
              {!selectedType && editingIndex === null ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Select Question Type</h3>
                    <Button variant="outline" size="sm" onClick={addAllQuestionTypes}>
                      Add all question types
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {TRYOUT_TYPES.map(type => (
                      <button
                        key={type.id}
                        onClick={() => {
                          setSelectedType(type.id);
                          handleAddQuestion();
                        }}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition-all hover:border-purple-400 hover:bg-purple-50 dark:border-slate-700 dark:hover:bg-purple-900/20"
                      >
                        <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/40">
                          <type.icon className="size-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 dark:text-slate-200">{type.label}</p>
                          <p className="text-xs text-slate-500">{type.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {editingIndex !== null ? 'Edit Question' : 'Create Question'}
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedType(null);
                        setEditingIndex(null);
                        setCurrentQuestion({});
                      }}
                    >
                      Cancel
                    </Button>
                  </div>

                  {CreatorComponent && (
                    <CreatorComponent
                      question={currentQuestion}
                      onChange={setCurrentQuestion}
                      type={selectedType}
                    />
                  )}

                  <div className="mt-4 flex justify-end">
                    <Button onClick={handleSaveQuestion} className="bg-purple-600 hover:bg-purple-700">
                      <Save className="size-4 mr-2" />
                      {editingIndex !== null ? 'Update Question' : 'Add Question'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm text-slate-500">{localTryouts.length} question(s) added</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSaveAll} className="bg-green-600 hover:bg-green-700">
                <Save className="size-4 mr-2" />
                Save Tryout
              </Button>
            </div>
          </div>
        </Motion.div>
      </Motion.div>
    </AnimatePresence>
  );
};

// Inline (non-modal) version for embedding directly inside lesson plan drawer
export const InlineTryoutBuilder = ({
  tryouts = [], onSaveTryouts, topicTitle = '', subjectName = '', gradeLevel = '',
}) => {
  const [localTryouts, setLocalTryouts] = useState(tryouts);
  const [selectedType, setSelectedType] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState({});
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState('medium');
  const [aiQuestionType, setAiQuestionType] = useState('mcq');
  const [aiAppend, setAiAppend] = useState(true);
  // null = "how do you want to add?" choices; 'ai' | 'paste' | 'manual'
  const [addMode, setAddMode] = useState(null);
  const [pasteText, setPasteText] = useState('');
  // Excel bulk upload for the selected question type
  const [creatingNew, setCreatingNew] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null); // { added, errors: [{row, message}] }
  const [excelType, setExcelType] = useState('mcq');
  // Fit the two panels into the visible part of the scrolling drawer, so each
  // panel scrolls on its own instead of the whole drawer scrolling.
  const bodyRef = React.useRef(null);
  const [bodyHeight, setBodyHeight] = useState(null);
  React.useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return undefined;
    const findScroller = (node) => {
      for (let n = node?.parentElement; n; n = n.parentElement) {
        const oy = getComputedStyle(n).overflowY;
        if (oy === 'auto' || oy === 'scroll') return n;
      }
      return null;
    };
    const measure = () => {
      if (window.innerWidth < 768) { setBodyHeight(null); return; }
      const scroller = findScroller(el);
      const bottom = Math.min(window.innerHeight, scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight);
      // Position relative to the scroller's content, so a scrolled drawer doesn't skew it.
      const top = el.getBoundingClientRect().top + (scroller ? scroller.scrollTop : 0);
      setBodyHeight(Math.max(360, Math.round(bottom - top - 16)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Left list: sections are collapsed until clicked (accordion).
  const [openSections, setOpenSections] = useState(() => new Set());
  const toggleSection = (type) => setOpenSections((prev) => {
    const next = new Set(prev);
    if (next.has(type)) next.delete(type); else next.add(type);
    return next;
  });
  // Keep the section of the question being edited open.
  const editingType = editingIndex !== null ? localTryouts[editingIndex]?.type : null;
  useEffect(() => {
    if (editingType) setOpenSections((prev) => (prev.has(editingType) ? prev : new Set(prev).add(editingType)));
  }, [editingType]);
  // Open the sections that just received new questions (AI / Excel / paste), so the teacher sees them.
  const prevCountRef = React.useRef(localTryouts.length);
  useEffect(() => {
    const prevCount = prevCountRef.current;
    prevCountRef.current = localTryouts.length;
    if (localTryouts.length <= prevCount) return;
    const added = new Set(localTryouts.slice(prevCount).map((q) => q.type));
    setOpenSections((prev) => new Set([...prev, ...added]));
  }, [localTryouts]);

  const extractJsonArray = (text) => {
    const cleaned = text.replace(/```(?:json)?/gi, '').trim();
    const start = cleaned.indexOf('[');
    if (start === -1) return null;

    let depth = 0;
    for (let i = start; i < cleaned.length; i += 1) {
      const ch = cleaned[i];
      if (ch === '[') depth += 1;
      if (ch === ']') {
        depth -= 1;
        if (depth === 0) {
          return cleaned.slice(start, i + 1);
        }
      }
    }
    return null;
  };

  const parseAiQuestions = (raw) => {
    if (!raw || typeof raw !== 'string') return [];
    const cleaned = raw.replace(/```(?:json)?/gi, '').trim();

    const tryParse = (value) => {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };

    const normalizeParsed = (parsed) => {
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
      return null;
    };

    let parsed = tryParse(cleaned);
    const normalized = normalizeParsed(parsed);
    if (normalized) return normalized;

    const arrayJson = extractJsonArray(cleaned);
    if (arrayJson) {
      parsed = tryParse(arrayJson);
      const normalizedArray = normalizeParsed(parsed);
      if (normalizedArray) return normalizedArray;
    }

    const objectStart = cleaned.indexOf('{');
    const objectEnd = cleaned.lastIndexOf('}');
    if (objectStart !== -1 && objectEnd > objectStart) {
      parsed = tryParse(cleaned.slice(objectStart, objectEnd + 1));
      const normalizedObject = normalizeParsed(parsed);
      if (normalizedObject) return normalizedObject;
    }

    const parsePlainMcq = (text) => {
      const questionBlocks = text.split(/\n(?=\d+[.)]\s+)/g).map((block) => block.trim()).filter(Boolean);
      const results = [];

      questionBlocks.forEach((block) => {
        const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        if (!lines.length) return;

        const questionLine = lines[0].replace(/^\d+[.)]\s*/, '').trim();
        const options = [];
        let correctOption = null;
        let explanation = '';

        lines.slice(1).forEach((line) => {
          const optionMatch = line.match(/^([A-D])[:.)]\s*(.+)$/i);
          if (optionMatch) {
            options.push({ text: optionMatch[2].trim(), isCorrect: false });
            return;
          }
          const answerMatch = line.match(/^(?:Answer|Correct Answer|Key)[:\-]\s*([A-D])/i);
          if (answerMatch) {
            correctOption = answerMatch[1].toUpperCase();
            return;
          }
          const explainMatch = line.match(/^(?:Explanation|Why)[:\-]\s*(.+)$/i);
          if (explainMatch) {
            explanation = explainMatch[1].trim();
            return;
          }
        });

        if (questionLine && options.length >= 2) {
          if (correctOption) {
            const correctIndex = Math.max(0, Math.min(3, correctOption.charCodeAt(0) - 65));
            if (options[correctIndex]) {
              options[correctIndex].isCorrect = true;
            }
          }
          results.push({ questionText: questionLine, options: options.slice(0, 4), explanation });
        }
      });
      return results;
    };

    const plainQuestions = parsePlainMcq(cleaned);
    if (plainQuestions.length) {
      return plainQuestions.map((q) => ({
        questionText: q.questionText,
        options: q.options,
        explanation: q.explanation,
      }));
    }

    return [];
  };

  const normalizeAiQuestion = (item, idx) => {
    const questionType = String(item.type || aiQuestionType || 'mcq').trim();
    const rawText = String(item.questionText || item.question || item.text || item.raw || '').trim();
    const rawOptions = Array.isArray(item.options) ? item.options : [];
    const options = rawOptions.map((option) => {
      if (typeof option === 'string') return option.trim();
      if (option && typeof option === 'object') return String(option.text || option.choice || option.label || '').trim();
      return '';
    }).filter(Boolean);
    const correctIndex = rawOptions.findIndex((option) => {
      if (typeof option === 'object') return option.isCorrect === true || option.correct === true || option.is_answer === true;
      return false;
    });

    const normalized = {
      id: item.id || `tryout-${Date.now()}-${idx}`,
      type: questionType,
      question: questionType === 'cloze_dropdown' ? String(item.question || item.text || rawText).trim() : String(item.question || item.questionText || '').trim() || rawText,
      text: String(item.text || item.question || item.questionText || rawText).trim(),
      options: options.length > 0 ? options : [],
      correctAnswer: correctIndex >= 0 ? correctIndex : 0,
      explanation: String(item.explanation || item.explanationText || '').trim(),
      difficulty: String(item.difficulty || item.level || 'medium').trim().toLowerCase(),
      statements: Array.isArray(item.statements) ? item.statements : (questionType === 'choice_matrix' ? [rawText] : []),
      dropdownOptions: Array.isArray(item.dropdownOptions) ? item.dropdownOptions : (questionType === 'cloze_dropdown' ? [options] : []),
      items: Array.isArray(item.items) ? item.items : [],
      pairs: Array.isArray(item.pairs) ? item.pairs : [],
      // choice_matrix: true/false per statement, same order as `statements`.
      answers: Array.isArray(item.answers) ? item.answers.map((a) => a === true) : [],
      // cloze_text: correct fill-in value per ${{input}} blank, in order.
      correctAnswers: Array.isArray(item.correctAnswers) ? item.correctAnswers.map((a) => String(a || '').trim()) : [],
      // cloze_drag_drop: optional hint per word-bank option, same order as `options`.
      hints: Array.isArray(item.hints) ? item.hints.map((h) => String(h || '').trim()) : [],
      optionPosition: String(item.optionPosition || 'down').trim(),
      maxWords: Number.isFinite(Number(item.maxWords)) ? Number(item.maxWords) : (questionType === 'rich_text' ? 300 : 10000),
      allowedTypes: Array.isArray(item.allowedTypes) && item.allowedTypes.length > 0
        ? item.allowedTypes
        : (questionType === 'file_upload' ? ['image', 'pdf', 'document'] : []),
      raw: item.raw || false,
    };

    if (questionType === 'mcq' && normalized.options.length === 0) {
      normalized.options = ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
    }

    return normalized;
  };

  const generateAiTryouts = async () => {
    const subject = subjectName || 'General';
    const topic = topicTitle || 'General Topic';
    const token = localStorage.getItem('token') || '';

    setGenerating(true);
    setAiError('');
    try {
      const response = await fetch(`${API_BASE}/api/ai-teacher/quiz-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          subject,
          topic,
          gradeLevel,
          difficulty: aiDifficulty,
          count: aiCount,
          questionType: aiQuestionType,
          chapterTitle: topicTitle || null,
          topicTitle: topicTitle || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'AI generation failed');

      const rawOutput = typeof data?.data?.raw === 'string' ? data.data.raw : '';
      let questions = Array.isArray(data?.data?.questions) ? data.data.questions : [];
      if (!questions.length && rawOutput) {
        questions = parseAiQuestions(rawOutput);
      }
      if (!questions.length && rawOutput) {
        questions = [{ type: aiQuestionType, question: rawOutput, raw: true }];
      }
      if (!questions.length) throw new Error('AI did not return valid quiz questions');

      const generated = questions
        .map(normalizeAiQuestion)
        .filter((q) => {
          if (!q.question && !q.text) return false;
          if (q.type === 'mcq') return Array.isArray(q.options) && q.options.length > 1;
          if (q.type === 'choice_matrix') return Array.isArray(q.statements) ? q.statements.length > 0 : Boolean(q.question);
          if (q.type === 'cloze_dropdown') return Boolean(q.text);
          if (q.type === 'cloze_text' || q.type === 'cloze_drag_drop') return Boolean(q.text);
          if (q.type === 'match_list' || q.type === 'sort_list') return Boolean(q.question || (Array.isArray(q.items) && q.items.length > 0));
          return Boolean(q.question);
        });
      if (!generated.length) throw new Error('Generated questions could not be parsed');

      const updated = aiAppend ? [...localTryouts, ...generated] : generated;
      setLocalTryouts(updated);
      onSaveTryouts(updated);
      toast.success(`${generated.length} AI-generated tryout question(s) ${aiAppend ? 'appended' : 'replaced'}`);
    } catch (err) {
      const message = err?.message || 'Failed to generate tryout questions';
      setAiError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectType = (typeId) => {
    setCreatingNew(true);
    setBulkResult(null);
    setSelectedType(typeId);
    setEditingIndex(null);
    setCurrentQuestion({ type: typeId, id: `tryout-${Date.now()}` });
  };

  const handleEditQuestion = (index) => {
    setEditingIndex(index);
    setCurrentQuestion({ ...localTryouts[index] });
    setSelectedType(localTryouts[index].type);
  };

  const handleSaveQuestion = () => {
    let updated;
    if (editingIndex !== null) {
      updated = [...localTryouts];
      updated[editingIndex] = currentQuestion;
    } else {
      updated = [...localTryouts, currentQuestion];
    }
    setLocalTryouts(updated);
    onSaveTryouts(updated);
    setCurrentQuestion({});
    setSelectedType(null);
    setEditingIndex(null);
  };

  const handleDeleteQuestion = (index) => {
    const updated = localTryouts.filter((_, i) => i !== index);
    setLocalTryouts(updated);
    onSaveTryouts(updated);
    if (editingIndex === index) {
      setSelectedType(null);
      setEditingIndex(null);
      setCurrentQuestion({});
    } else if (editingIndex !== null && index < editingIndex) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const handleCancel = () => {
    setSelectedType(null);
    setEditingIndex(null);
    setCurrentQuestion({});
  };

  // Send every edit to the lesson-plan draft, including new questions.
  const handleQuestionChange = (nextQuestion) => {
    setCurrentQuestion(nextQuestion);
    const updated = [...localTryouts];
    const index = editingIndex ?? updated.length;
    updated[index] = nextQuestion;
    setEditingIndex(index);
    setLocalTryouts(updated);
    onSaveTryouts(updated);
  };

  const CreatorComponent = selectedType ? QUESTION_CREATORS[selectedType] : null;

  // ── Excel bulk upload (per question type) ──
  const handleBulkFile = async (file, type = selectedType) => {
    if (!file || !type) return;
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const { questions, errors } = await parseTryoutExcel(file, type);
      if (questions.length) {
        // Drop the empty draft started for this type, if nothing was typed in it yet.
        const draftIdx = editingIndex;
        const draft = draftIdx !== null ? localTryouts[draftIdx] : null;
        const draftIsEmpty = draft && draft.id === currentQuestion.id && !String(draft.question || draft.text || '').trim();
        const base = draftIsEmpty ? localTryouts.filter((_, i) => i !== draftIdx) : localTryouts;
        const updated = [...base, ...questions];
        setLocalTryouts(updated);
        onSaveTryouts(updated);
        toast.success(`${questions.length} question${questions.length === 1 ? '' : 's'} added from Excel`);
        if (!errors.length) {
          setSelectedType(null);
          setEditingIndex(null);
          setCurrentQuestion({});
          setCreatingNew(false);
          setAddMode(null);
        } else if (draftIsEmpty) {
          setEditingIndex(null);
        }
      } else if (!errors.length) {
        errors.push({ row: 0, message: 'The file has no questions — fill at least one row.' });
      }
      setBulkResult({ added: questions.length, errors });
    } catch (err) {
      setBulkResult({ added: 0, errors: [{ row: 0, message: err?.message || 'Could not read this file. Use the downloaded template (.xlsx).' }] });
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkResultView = bulkResult && (bulkResult.added > 0 || bulkResult.errors.length > 0) ? (
    <div className="mt-3 space-y-1 text-xs">
      {bulkResult.added > 0 && <p className="font-semibold text-emerald-700">✓ {bulkResult.added} question{bulkResult.added === 1 ? '' : 's'} added.</p>}
      {bulkResult.errors.length > 0 && (
        <div role="alert" className="max-h-32 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800">
          <p className="mb-1 font-semibold">{bulkResult.errors.length} row{bulkResult.errors.length === 1 ? '' : 's'} skipped — fix and upload again:</p>
          {bulkResult.errors.map((e, i) => <p key={i}>{e.row ? `Row ${e.row}: ` : ''}{e.message}</p>)}
        </div>
      )}
    </div>
  ) : null;

  const selectedTypeLabel = TRYOUT_TYPES.find((type) => type.id === selectedType)?.label || 'question';
  const bulkStrip = selectedType && creatingNew && EXCEL_TEMPLATES[selectedType] ? (
    <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><FileSpreadsheet className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">Many {selectedTypeLabel} questions? Upload them from Excel</p>
          <p className="text-xs text-slate-600">1. Download the template · 2. Fill one question per row · 3. Upload the file</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => downloadTryoutTemplate(selectedType, selectedTypeLabel)} className="h-8 border-emerald-300 bg-white text-xs text-emerald-700 hover:bg-emerald-50">
            <Download className="size-3 mr-1.5" /> Download template
          </Button>
          <label className={`inline-flex h-8 cursor-pointer items-center rounded-md bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 ${bulkBusy ? 'pointer-events-none opacity-60' : ''}`}>
            <FileUp className="size-3 mr-1.5" /> {bulkBusy ? 'Reading…' : 'Upload Excel'}
            <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" aria-label={`Upload ${selectedTypeLabel} Excel`} onChange={(e) => { handleBulkFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      </div>
      {bulkResultView}
      <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> or write one below <span className="h-px flex-1 bg-slate-200" />
      </div>
    </div>
  ) : null;

  // ── Paste / bulk import ──
  const PASTE_EXAMPLE = `1. What is the brain of the computer?
A) Monitor
B) CPU
C) Keyboard
D) Mouse
Answer: B

2. Which device is used to type?
A) Printer
B) Speaker
C) Keyboard
D) Scanner
Answer: C`;
  const pastePreview = useMemo(() => (pasteText.trim() ? parseAiQuestions(pasteText) : []), [pasteText]);
  const pasteMissingAnswers = pastePreview.filter((q) => !(q.options || []).some((o) => o?.isCorrect)).length;

  const importPasted = () => {
    if (!pastePreview.length) { toast.error('No questions found. Follow the format shown in the example.'); return; }
    const imported = pastePreview.map((q, i) => normalizeAiQuestion({ ...q, type: 'mcq' }, i));
    const updated = [...localTryouts, ...imported];
    setLocalTryouts(updated);
    onSaveTryouts(updated);
    setPasteText('');
    setAddMode(null);
    toast.success(`${imported.length} question${imported.length === 1 ? '' : 's'} added`);
  };

  const loadPasteFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPasteText(String(reader.result || ''));
    reader.readAsText(file);
  };


  const ADD_OPTIONS = [
    { key: 'ai', icon: Zap, title: 'Generate with AI', desc: 'Get ready-made questions for this chapter in seconds.', tone: 'bg-violet-600' },
    { key: 'excel', icon: FileSpreadsheet, title: 'Upload from Excel', desc: 'Fill our ready template in Excel and upload many questions at once.', tone: 'bg-emerald-600' },
    { key: 'paste', icon: ClipboardList, title: 'Paste questions', desc: 'Copy MCQs from Word or a document and paste them all at once.', tone: 'bg-sky-600' },
    { key: 'manual', icon: PenTool, title: 'Write one yourself', desc: 'Pick a question type and type it in.', tone: 'bg-rose-500' },
  ];

  const openMode = (key) => { setAddMode(key); setSelectedType(null); setEditingIndex(null); setCurrentQuestion({}); setAiError(''); setBulkResult(null); };

  // Questions grouped by type — the same sections students see in the practice exam.
  const sectionGroups = useMemo(() => {
    const groups = [];
    localTryouts.forEach((q, index) => {
      let group = groups.find((g) => g.type === q.type);
      if (!group) { group = { type: q.type, label: TRYOUT_TYPES.find((t) => t.id === q.type)?.label || q.type, items: [] }; groups.push(group); }
      group.items.push({ q, index });
    });
    return groups;
  }, [localTryouts]);

  const deleteAll = () => {
    if (!window.confirm(`Delete all ${localTryouts.length} tryout questions? This cannot be undone.`)) return;
    setLocalTryouts([]);
    onSaveTryouts([]);
    handleCancel();
    setAddMode(null);
  };

  const editingExisting = !creatingNew && editingIndex !== null && editingIndex < localTryouts.length;

  const typeButton = (type) => (
    <button
      key={type.id}
      type="button"
      disabled={generating}
      onClick={() => { handleSelectType(type.id); setAddMode(null); }}
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-rose-300 hover:bg-rose-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><type.icon className="size-4" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{type.label}</span>
        <span className="mt-0.5 block text-xs leading-4 text-slate-500">{type.description}</span>
      </span>
    </button>
  );

  const panelHeader = (title, subtitle) => (
    <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
      <Button variant="ghost" size="sm" onClick={() => { setAddMode(null); handleCancel(); }} className="h-8 gap-1.5 px-2 text-xs text-slate-600 hover:bg-slate-100">
        <ArrowLeft className="size-3.5" /> Back
      </Button>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">
            {localTryouts.length ? `${localTryouts.length} tryout question${localTryouts.length === 1 ? '' : 's'} ready` : 'No tryout questions yet'}
          </p>
          <p className="text-xs text-slate-500">
            {localTryouts.length
              ? 'Students will practise these in Practice → Tryout questions. Each question type becomes a section.'
              : 'Add a few practice questions for this chapter. This step is optional.'}
          </p>
        </div>
      </div>

      {aiError && (
        <div role="alert" className="px-5 py-3 text-sm text-red-700 bg-red-50">{aiError}</div>
      )}

      <div ref={bodyRef} style={bodyHeight ? { height: bodyHeight } : undefined} className="flex flex-col md:min-h-[360px] md:flex-row">
        {/* Left: question list */}
        {localTryouts.length > 0 && (
          <div className="flex w-full shrink-0 flex-col border-b border-slate-200 md:h-full md:min-h-0 md:overflow-hidden md:w-72 md:border-b-0 md:border-r">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your questions ({localTryouts.length})</p>
              <button type="button" onClick={() => openMode('manual')} className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-600">
                <Plus className="size-3" /> Add more
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
              {sectionGroups.map((group, gi) => {
                const open = openSections.has(group.type);
                const TypeIcon = TRYOUT_TYPES.find((t) => t.id === group.type)?.icon || FileText;
                return (
                <div key={group.type} className={`overflow-hidden rounded-xl border ${open ? 'border-rose-200' : 'border-slate-200'}`}>
                  <button
                    type="button"
                    onClick={() => toggleSection(group.type)}
                    aria-expanded={open}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold transition ${open ? 'bg-rose-50 text-rose-700' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${open ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600'}`}><TypeIcon className="size-3.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-70">Section {gi + 1}</span>
                      <span className="block truncate">{group.label.replace(/ \(MCQ\)$/, '')}</span>
                    </span>
                    <span className="rounded-full bg-white px-2 py-px text-[11px] text-slate-600 ring-1 ring-slate-200">{group.items.length}</span>
                    <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                  <div className="space-y-1 border-t border-rose-100 bg-white p-1.5">
                    {group.items.map(({ q: tryout, index }) => {
                      const active = editingIndex === index && !creatingNew;
                      return (
                        <div key={tryout.id || index} className={`group flex items-start gap-2 rounded-lg border p-2 text-xs transition ${active ? 'border-rose-300 bg-rose-50' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'}`}>
                          <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${active ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-700'}`}>{index + 1}</span>
                          <button type="button" disabled={generating} onClick={() => { handleEditQuestion(index); setAddMode(null); }} aria-pressed={active} aria-label={`Edit question ${index + 1}`} title="Click to edit" className="min-w-0 flex-1 text-left leading-5 text-slate-700 focus-visible:outline-2 focus-visible:outline-rose-600">
                            <span className="line-clamp-2 wrap-break-word">{tryout.question || tryout.text || 'Untitled question'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={generating}
                            aria-label={`Delete question ${index + 1}`}
                            title="Delete question"
                            onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(index); }}
                            className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
                );
              })}
            </div>
            <div className="mt-auto shrink-0 border-t border-slate-100 px-3 py-2">
              <button type="button" onClick={deleteAll} disabled={generating} className="text-[11px] font-semibold text-slate-400 hover:text-red-600">Delete all questions</button>
            </div>
          </div>
        )}

        {/* Right: choose how to add / AI / paste / type picker / editor */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-white p-5 sm:p-6">
          {selectedType || editingIndex !== null ? (
            <div>
              {panelHeader(editingExisting ? `Edit question ${editingIndex + 1} of ${localTryouts.length}` : 'New question', TRYOUT_TYPES.find((type) => type.id === selectedType)?.label)}
              {bulkStrip}
              {CreatorComponent && (
                <CreatorComponent
                  key={currentQuestion.id || `${selectedType}-${editingIndex}`}
                  question={currentQuestion}
                  onChange={handleQuestionChange}
                />
              )}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">✓ Saved automatically as you type.</p>
                <div className="flex items-center gap-2">
                  {editingExisting && (
                    <>
                      <Button type="button" variant="outline" size="sm" disabled={editingIndex === 0} onClick={() => handleEditQuestion(editingIndex - 1)} className="h-8 text-xs">
                        <ArrowLeft className="size-3 mr-1" /> Previous
                      </Button>
                      <Button type="button" variant="outline" size="sm" disabled={editingIndex >= localTryouts.length - 1} onClick={() => handleEditQuestion(editingIndex + 1)} className="h-8 text-xs">
                        Next →
                      </Button>
                    </>
                  )}
                  <Button onClick={handleSaveQuestion} size="sm" className="bg-rose-500 text-xs text-white hover:bg-rose-600">
                    <Save className="size-3 mr-1" /> {editingExisting ? 'Done' : 'Add question'}
                  </Button>
                </div>
              </div>
            </div>
          ) : addMode === 'ai' ? (
            <div>
              {panelHeader('Generate with AI', `Questions for “${topicTitle || 'this chapter'}”`)}
              <fieldset disabled={generating} className="grid min-w-0 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">How many?</span>
                  <select aria-label="Count" value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900">
                    {[1, 3, 5, 10].map((count) => <option key={count} value={count}>{count} question{count !== 1 ? 's' : ''}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Difficulty</span>
                  <select aria-label="Difficulty" value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900">
                    {['easy', 'medium', 'hard'].map((level) => <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Question type</span>
                  <select aria-label="Question Type" value={aiQuestionType} onChange={(e) => setAiQuestionType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900">
                    {TRYOUT_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                  </select>
                </label>
              </fieldset>
              {localTryouts.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold">You already have {localTryouts.length} question{localTryouts.length === 1 ? '' : 's'}:</span>
                  <div className="inline-flex rounded-lg border border-slate-300 p-0.5">
                    <button type="button" onClick={() => setAiAppend(true)} aria-pressed={aiAppend} className={`rounded-md px-3 py-1 font-medium ${aiAppend ? 'bg-rose-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Add to them</button>
                    <button type="button" onClick={() => setAiAppend(false)} aria-pressed={!aiAppend} className={`rounded-md px-3 py-1 font-medium ${!aiAppend ? 'bg-rose-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Replace them</button>
                  </div>
                </div>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">You can edit or delete any generated question afterwards.</p>
                <Button size="sm" onClick={async () => { await generateAiTryouts(); setAddMode(null); }} disabled={generating} className="bg-violet-600 text-xs text-white hover:bg-violet-700">
                  <Zap className="size-3 mr-1.5" />
                  {generating ? 'Generating…' : `Generate ${aiCount} question${aiCount !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          ) : addMode === 'excel' ? (
            <div>
              {panelHeader('Upload from Excel', 'Add many questions at once using our template')}
              <ol className="space-y-5">
                <li>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">1</span>
                    Choose the question type
                  </p>
                  <div className="flex flex-wrap gap-2 pl-8">
                    {TRYOUT_TYPES.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => { setExcelType(type.id); setBulkResult(null); }}
                        aria-pressed={excelType === type.id}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${excelType === type.id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'}`}
                      >
                        <type.icon className="size-3.5" /> {type.label.replace(/ \(MCQ\)$/, '')}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 pl-8 text-xs text-slate-500">{EXCEL_TEMPLATES[excelType]?.help}</p>
                </li>
                <li>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">2</span>
                    Download the template and fill it in Excel
                  </p>
                  <div className="pl-8">
                    <Button type="button" variant="outline" size="sm" onClick={() => downloadTryoutTemplate(excelType, TRYOUT_TYPES.find((t) => t.id === excelType)?.label)} className="h-9 border-emerald-300 bg-white text-xs text-emerald-700 hover:bg-emerald-50">
                      <Download className="size-3.5 mr-1.5" /> Download {TRYOUT_TYPES.find((t) => t.id === excelType)?.label.replace(/ \(MCQ\)$/, '')} template
                    </Button>
                    <p className="mt-1.5 text-xs text-slate-500">One question per row. The file has an example row and a “How to fill” sheet.</p>
                  </div>
                </li>
                <li>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">3</span>
                    Upload the filled file
                  </p>
                  <div className="pl-8">
                    <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-6 text-center transition hover:bg-emerald-50 ${bulkBusy ? 'pointer-events-none opacity-60' : ''}`}>
                      <FileUp className="size-6 text-emerald-600" />
                      <span className="mt-2 text-sm font-semibold text-emerald-800">{bulkBusy ? 'Reading your file…' : 'Click to choose your Excel file'}</span>
                      <span className="mt-0.5 text-xs text-slate-500">.xlsx, .xls or .csv</span>
                      <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" aria-label="Upload Excel file" onChange={(e) => { handleBulkFile(e.target.files?.[0], excelType); e.target.value = ''; }} />
                    </label>
                    {bulkResultView}
                  </div>
                </li>
              </ol>
            </div>
          ) : addMode === 'paste' ? (
            <div>
              {panelHeader('Paste questions', 'Multiple-choice questions, one after another')}
              <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                <div>
                  <Textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={PASTE_EXAMPLE}
                    rows={12}
                    aria-label="Paste questions"
                    className="font-mono text-xs"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-sky-700 hover:underline">
                      <FileUp className="size-3.5" /> Load from a .txt file
                      <input type="file" accept=".txt,text/plain" className="sr-only" onChange={(e) => { loadPasteFile(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    <button type="button" onClick={() => setPasteText(PASTE_EXAMPLE)} className="font-semibold text-slate-500 hover:underline">Fill example</button>
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="mb-1.5 font-semibold text-slate-800">Format</p>
                  <ul className="list-disc space-y-1 pl-4">
                    <li>Number each question: <code>1.</code></li>
                    <li>Options on new lines: <code>A)</code> <code>B)</code> <code>C)</code> <code>D)</code></li>
                    <li>Then <code>Answer: B</code></li>
                    <li>Optional: <code>Explanation: …</code></li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className={`text-xs font-medium ${pastePreview.length ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {pasteText.trim()
                    ? pastePreview.length
                      ? `${pastePreview.length} question${pastePreview.length === 1 ? '' : 's'} found${pasteMissingAnswers ? ` · ${pasteMissingAnswers} without an Answer line (option A will be marked correct — check them)` : ''}`
                      : 'No questions recognised yet — check the format.'
                    : 'Paste your questions to see how many are found.'}
                </p>
                <Button size="sm" onClick={importPasted} disabled={!pastePreview.length} className="bg-sky-600 text-xs text-white hover:bg-sky-700">
                  <Plus className="size-3 mr-1" /> Add {pastePreview.length || ''} question{pastePreview.length === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          ) : addMode === 'manual' ? (
            <div>
              {panelHeader('Add a question', 'Choose a question type')}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{TRYOUT_TYPES.map(typeButton)}</div>
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-xs">
                <span className="font-semibold text-slate-500">Adding many at once?</span>
                {ADD_OPTIONS.filter((o) => o.key !== 'manual').map((opt) => (
                  <button key={opt.key} type="button" disabled={generating} onClick={() => openMode(opt.key)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                    <opt.icon className="size-3.5" /> {opt.title}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {localTryouts.length > 0 && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                  <div className="text-sm">
                    <p className="font-semibold text-emerald-900">{localTryouts.length} question{localTryouts.length === 1 ? ' is' : 's are'} saved for this chapter.</p>
                    <p className="mt-0.5 text-xs text-emerald-800">Click any question on the left to check or edit it. When you’re happy, go to the next step. Want more? Pick an option below.</p>
                  </div>
                </div>
              )}
              <p className="text-sm font-semibold text-slate-800">{localTryouts.length ? 'Add more questions' : 'How do you want to add questions?'}</p>
              <p className="mt-1 text-xs text-slate-500">Pick any option — you can mix them.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {ADD_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={generating}
                    onClick={() => openMode(opt.key)}
                    className="group flex flex-col items-start rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500"
                  >
                    <span className={`flex size-10 items-center justify-center rounded-full text-white shadow-sm ${opt.tone}`}><opt.icon className="size-5" /></span>
                    <span className="mt-3 text-sm font-semibold text-slate-800">{opt.title}</span>
                    <span className="mt-1 text-xs leading-5 text-slate-500">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TryoutBuilder;
