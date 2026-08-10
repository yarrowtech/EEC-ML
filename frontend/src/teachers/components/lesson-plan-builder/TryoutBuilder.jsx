import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  X,
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
  Brain,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const API_BASE = (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_URL : '') || 'http://localhost:5000';

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
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer ?? 0);
  const [questionText, setQuestionText] = useState(question.question || '');
  const [theme, setTheme] = useState(question.theme || 'standard');

  const handleUpdate = (updates) => {
    onChange({ ...question, ...updates });
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
    if (correctAnswer >= newOptions.length) {
      setCorrectAnswer(0);
      handleUpdate({ options: newOptions, correctAnswer: 0 });
    } else {
      handleUpdate({ options: newOptions });
    }
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
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct-answer"
                checked={correctAnswer === index}
                onChange={() => {
                  setCorrectAnswer(index);
                  handleUpdate({ correctAnswer: index });
                }}
                className="accent-purple-500 w-4 h-4"
              />
              <Input
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                className="flex-1"
              />
              {options.length > 2 && (
                <Button variant="ghost" size="icon-sm" onClick={() => removeOption(index)}>
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1">Select the radio button for the correct answer</p>
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
                    value={statement}
                    onChange={(e) => updateStatement(index, e.target.value)}
                    placeholder={`Statement ${index + 1}`}
                  />
                </td>
                <td className="py-2 px-2 text-center">
                  <input
                    type="radio"
                    name={`choice-${index}`}
                    checked={answers[index] === true}
                    onChange={() => updateAnswer(index, true)}
                    className="accent-green-500 w-4 h-4"
                  />
                </td>
                <td className="py-2 px-2 text-center">
                  <input
                    type="radio"
                    name={`choice-${index}`}
                    checked={answers[index] === false}
                    onChange={() => updateAnswer(index, false)}
                    className="accent-red-500 w-4 h-4"
                  />
                </td>
                <td className="py-2 px-2">
                  {statements.length > 1 && (
                    <Button variant="ghost" size="icon-sm" onClick={() => removeStatement(index)}>
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

  const handleUpdate = (updates) => {
    onChange({ ...question, ...updates });
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
    setOptions(newOptions);
    setHints(newHints);
    handleUpdate({ options: newOptions, hints: newHints });
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
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                className="flex-1"
              />
              <Input
                value={hints[index] || ''}
                onChange={(e) => updateHint(index, e.target.value)}
                placeholder="Hint (optional)"
                className="flex-1"
              />
              <Button variant="ghost" size="icon-sm" onClick={() => removeOption(index)}>
                <Trash2 className="size-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Cloze Dropdown Creator
const ClozeDropdownCreator = ({ question, onChange }) => {
  const [text, setText] = useState(question.text || '');
  const [dropdownOptions, setDropdownOptions] = useState(question.dropdownOptions || [[]]);

  const handleUpdate = (updates) => {
    onChange({ ...question, ...updates });
  };

  const addDropdown = () => {
    const newOptions = [...dropdownOptions, []];
    setDropdownOptions(newOptions);
    handleUpdate({ dropdownOptions: newOptions });
  };

  const removeDropdown = (index) => {
    if (dropdownOptions.length <= 1) return;
    const newOptions = dropdownOptions.filter((_, i) => i !== index);
    setDropdownOptions(newOptions);
    handleUpdate({ dropdownOptions: newOptions });
  };

  const updateDropdownOption = (dropIndex, optIndex, value) => {
    const newOptions = [...dropdownOptions];
    newOptions[dropIndex] = [...(newOptions[dropIndex] || [])];
    newOptions[dropIndex][optIndex] = value;
    setDropdownOptions(newOptions);
    handleUpdate({ dropdownOptions: newOptions });
  };

  const addOptionToDropdown = (dropIndex) => {
    const newOptions = [...dropdownOptions];
    newOptions[dropIndex] = [...(newOptions[dropIndex] || []), ''];
    setDropdownOptions(newOptions);
    handleUpdate({ dropdownOptions: newOptions });
  };

  const removeOptionFromDropdown = (dropIndex, optIndex) => {
    const newOptions = [...dropdownOptions];
    newOptions[dropIndex] = newOptions[dropIndex].filter((_, i) => i !== optIndex);
    setDropdownOptions(newOptions);
    handleUpdate({ dropdownOptions: newOptions });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          Question Text
          <span className="text-xs text-slate-500 ml-2">(Use $&#123;&#123;input&#125;&#125; for dropdowns)</span>
        </label>
        <Textarea
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
                      value={opt}
                      onChange={(e) => updateDropdownOption(dropIndex, optIndex, e.target.value)}
                      placeholder={`Option ${optIndex + 1}`}
                      className="w-24"
                    />
                    <Button variant="ghost" size="icon-sm" onClick={() => removeOptionFromDropdown(dropIndex, optIndex)}>
                      <X className="size-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
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
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={`Item ${index + 1}`}
              className="flex-1"
            />
            <ArrowLeftRight className="size-4 text-slate-400" />
            <Input
              value={pairs[index] || ''}
              onChange={(e) => updatePair(index, e.target.value)}
              placeholder={`Match ${index + 1}`}
              className="flex-1"
            />
            {items.length > 1 && (
              <Button variant="ghost" size="icon-sm" onClick={() => removePair(index)}>
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
                value={item}
                onChange={(e) => updateItem(index, e.target.value)}
                placeholder={`Item ${index + 1}`}
                className="flex-1"
              />
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => moveItem(index, 'up')}
                  disabled={index === 0}
                >
                  <ChevronDown className="size-4 rotate-180" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => moveItem(index, 'down')}
                  disabled={index === items.length - 1}
                >
                  <ChevronDown className="size-4" />
                </Button>
              </div>
              {items.length > 2 && (
                <Button variant="ghost" size="icon-sm" onClick={() => removeItem(index)}>
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

  const handleUpdate = (updates) => {
    onChange({ ...question, ...updates });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result);
        handleUpdate({ imageUrl: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Question/Instructions</label>
        <Textarea
          value={questionText}
          onChange={(e) => {
            setQuestionText(e.target.value);
            handleUpdate({ question: e.target.value });
          }}
          placeholder="Draw on the image to highlight healthy vs unhealthy items..."
          rows={3}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Upload Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="block w-full text-sm border rounded-md file:bg-purple-600 file:text-white file:px-4 file:py-2 file:border-0 file:rounded-lg file:cursor-pointer hover:file:bg-purple-700"
        />
        {imageUrl && (
          <div className="mt-2">
            <img src={imageUrl} alt="Preview" className="max-w-xs rounded-lg border" />
          </div>
        )}
      </div>
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
export const InlineTryoutBuilder = ({ tryouts = [], onSaveTryouts, topicTitle = '' }) => {
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
      raw: item.raw || false,
    };

    if (questionType === 'mcq' && normalized.options.length === 0) {
      normalized.options = ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
    }

    return normalized;
  };

  const generateAiTryouts = async () => {
    const subject = localStorage.getItem('selectedSubjectName') || 'General';
    const topic = topicTitle || 'General Topic';
    const gradeLevel = localStorage.getItem('selectedClassName') || '';
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
    }
  };

  const handleCancel = () => {
    setSelectedType(null);
    setEditingIndex(null);
    setCurrentQuestion({});
  };

  const CreatorComponent = selectedType ? QUESTION_CREATORS[selectedType] : null;

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/30 overflow-hidden">
      {/* Header */}
      <div className="border-b border-rose-200 bg-rose-100 px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-3 sm:grid-cols-4 sm:gap-4 w-full">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Count</label>
              <select
                value={aiCount}
                onChange={(e) => setAiCount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {[1, 3, 5, 10].map((count) => (
                  <option key={count} value={count}>{count} question{count !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Difficulty</label>
              <select
                value={aiDifficulty}
                onChange={(e) => setAiDifficulty(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {['easy', 'medium', 'hard'].map((level) => (
                  <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Question Type</label>
              <select
                value={aiQuestionType}
                onChange={(e) => setAiQuestionType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {TRYOUT_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Mode</label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
                <label className="flex items-center gap-2">
                  <input type="radio" name="aiAppendMode" checked={aiAppend} onChange={() => setAiAppend(true)} className="accent-rose-500" />
                  Append
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="aiAppendMode" checked={!aiAppend} onChange={() => setAiAppend(false)} className="accent-rose-500" />
                  Replace
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={generateAiTryouts}
              disabled={generating}
              className="text-xs"
            >
              <Zap className="size-4 mr-2" />
              {generating ? 'Generating…' : aiAppend ? 'Append AI Questions' : 'Replace with AI Questions'}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          AI will generate {aiCount} {TRYOUT_TYPES.find((t) => t.id === aiQuestionType)?.label || 'MCQ'} question{aiCount !== 1 ? 's' : ''} for “{topicTitle || 'this chapter'}” at {aiDifficulty} difficulty.
        </p>
      </div>
      {aiError && (
        <div className="px-4 py-3 text-sm text-red-700 bg-red-50">
          {aiError}
        </div>
      )}

      <div className="flex min-h-[320px]">
        {/* Left: question list */}
        <div className="w-44 shrink-0 border-r border-rose-200 bg-white/60 overflow-y-auto">
          {localTryouts.length === 0 ? (
            <p className="p-3 text-xs text-slate-400 text-center mt-4">No questions yet</p>
          ) : (
            <div className="p-2 space-y-1.5">
              {localTryouts.map((tryout, index) => {
                const typeInfo = TRYOUT_TYPES.find(t => t.id === tryout.type);
                return (
                  <div
                    key={tryout.id || index}
                    onClick={() => handleEditQuestion(index)}
                    className={`rounded-lg border p-2 cursor-pointer transition-colors text-xs ${
                      editingIndex === index
                        ? 'border-rose-400 bg-rose-50'
                        : 'border-slate-200 bg-white hover:border-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        {typeInfo && <typeInfo.icon className="size-3 text-rose-500 shrink-0" />}
                        <span className="font-medium text-slate-700 truncate">{typeInfo?.label || tryout.type}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(index); }}
                        className="shrink-0 p-0.5 rounded hover:bg-red-50"
                      >
                        <Trash2 className="size-3 text-red-400" />
                      </button>
                    </div>
                    <p className="text-slate-400 truncate mt-0.5">{tryout.question || tryout.text || `Q${index + 1}`}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: type picker or creator */}
        <div className="flex-1 overflow-y-auto bg-white/60 p-3">
          {!selectedType && editingIndex === null ? (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">+ Add question type</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TRYOUT_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => handleSelectType(type.id)}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left hover:border-rose-300 hover:bg-rose-50 transition-colors"
                  >
                    <div className="rounded-md bg-rose-100 p-1 shrink-0">
                      <type.icon className="size-3.5 text-rose-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{type.label}</p>
                      <p className="text-[10px] text-slate-400 truncate">{type.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-700">
                  {editingIndex !== null ? 'Edit Question' : 'New Question'}
                </p>
                <Button variant="outline" size="sm" onClick={handleCancel} className="text-xs h-6 px-2">Cancel</Button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {CreatorComponent && (
                  <CreatorComponent
                    key={editingIndex ?? 'new'}
                    question={currentQuestion}
                    onChange={setCurrentQuestion}
                  />
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <Button onClick={handleSaveQuestion} size="sm" className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-7">
                  <Save className="size-3 mr-1" />
                  {editingIndex !== null ? 'Update' : 'Add Question'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TryoutBuilder;
