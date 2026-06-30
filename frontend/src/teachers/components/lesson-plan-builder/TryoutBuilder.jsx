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
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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
                  <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Select Question Type</h3>
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

export default TryoutBuilder;
