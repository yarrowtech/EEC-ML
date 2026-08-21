import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
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
  Save,
  Play,
  Brain,
  Zap,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { toast, Toaster } from 'react-hot-toast';

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

const MCQCreator = ({ question, onChange }) => {
  const [options, setOptions] = useState(question.options || ['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer ?? 0);
  const [questionText, setQuestionText] = useState(question.question || '');
  const [theme, setTheme] = useState(question.theme || 'standard');

  const handleUpdate = (updates) => onChange({ ...question, ...updates });

  const addOption = () => {
    const newOptions = [...options, ''];
    setOptions(newOptions);
    handleUpdate({ options: newOptions });
  };

  const removeOption = (index) => {
    if (options.length <= 2) return;
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    const newCorrect = correctAnswer >= newOptions.length ? 0 : correctAnswer;
    setCorrectAnswer(newCorrect);
    handleUpdate({ options: newOptions, correctAnswer: newCorrect });
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
        <label className="block text-sm font-medium text-slate-700 mb-1">Question</label>
        <Textarea value={questionText} onChange={(e) => { setQuestionText(e.target.value); handleUpdate({ question: e.target.value }); }} placeholder="Enter your question..." rows={3} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Display Theme</label>
        <select value={theme} onChange={(e) => { setTheme(e.target.value); handleUpdate({ theme: e.target.value }); }} style={{ colorScheme: 'light' }} className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900">
          <option value="standard">Standard (Radio buttons)</option>
          <option value="block">Block (Buttons)</option>
          <option value="radio">Radio Button Style</option>
        </select>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">Options</label>
          <Button variant="outline" size="sm" onClick={addOption}><Plus className="size-3 mr-1" /> Add Option</Button>
        </div>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input type="radio" name="correct-answer" checked={correctAnswer === index} onChange={() => { setCorrectAnswer(index); handleUpdate({ correctAnswer: index }); }} className="accent-purple-500 w-4 h-4" />
              <Input value={option} onChange={(e) => updateOption(index, e.target.value)} placeholder={`Option ${index + 1}`} className="flex-1" />
              {options.length > 2 && <Button variant="ghost" size="icon-sm" onClick={() => removeOption(index)}><Trash2 className="size-4 text-red-500" /></Button>}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1">Select the radio button for the correct answer</p>
      </div>
    </div>
  );
};

const ChoiceMatrixCreator = ({ question, onChange }) => {
  const [statements, setStatements] = useState(question.statements || ['']);
  const [answers, setAnswers] = useState(question.answers || [null]);

  const handleUpdate = (updates) => onChange({ ...question, ...updates });

  const addStatement = () => {
    const s = [...statements, '']; const a = [...answers, null];
    setStatements(s); setAnswers(a); handleUpdate({ statements: s, answers: a });
  };

  const removeStatement = (index) => {
    if (statements.length <= 1) return;
    const s = statements.filter((_, i) => i !== index); const a = answers.filter((_, i) => i !== index);
    setStatements(s); setAnswers(a); handleUpdate({ statements: s, answers: a });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">Statements</label>
        <Button variant="outline" size="sm" onClick={addStatement}><Plus className="size-3 mr-1" /> Add Statement</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2 text-slate-600">Statement</th>
              <th className="py-2 px-2 text-center text-slate-600 w-20">True</th>
              <th className="py-2 px-2 text-center text-slate-600 w-20">False</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {statements.map((statement, index) => (
              <tr key={index} className="border-b">
                <td className="py-2 px-2"><Input value={statement} onChange={(e) => { const s = [...statements]; s[index] = e.target.value; setStatements(s); handleUpdate({ statements: s }); }} placeholder={`Statement ${index + 1}`} /></td>
                <td className="py-2 px-2 text-center"><input type="radio" name={`choice-${index}`} checked={answers[index] === true} onChange={() => { const a = [...answers]; a[index] = true; setAnswers(a); handleUpdate({ answers: a }); }} className="accent-green-500 w-4 h-4" /></td>
                <td className="py-2 px-2 text-center"><input type="radio" name={`choice-${index}`} checked={answers[index] === false} onChange={() => { const a = [...answers]; a[index] = false; setAnswers(a); handleUpdate({ answers: a }); }} className="accent-red-500 w-4 h-4" /></td>
                <td className="py-2 px-2">{statements.length > 1 && <Button variant="ghost" size="icon-sm" onClick={() => removeStatement(index)}><Trash2 className="size-4 text-red-500" /></Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ClozeDragDropCreator = ({ question, onChange }) => {
  const [text, setText] = useState(question.text || '');
  const [options, setOptions] = useState(question.options || []);
  const [hints, setHints] = useState(question.hints || []);
  const [optionPosition, setOptionPosition] = useState(question.optionPosition || 'down');

  const handleUpdate = (updates) => onChange({ ...question, ...updates });

  const addOption = () => {
    const o = [...options, '']; const h = [...hints, ''];
    setOptions(o); setHints(h); handleUpdate({ options: o, hints: h });
  };

  const removeOption = (index) => {
    const o = options.filter((_, i) => i !== index); const h = hints.filter((_, i) => i !== index);
    setOptions(o); setHints(h); handleUpdate({ options: o, hints: h });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Question Text <span className="text-xs text-slate-500 ml-1">(Use {'${{blank}}'} for blanks)</span></label>
        <Textarea value={text} onChange={(e) => { setText(e.target.value); handleUpdate({ text: e.target.value }); }} placeholder="There are several ${{blank}} types of drums..." rows={4} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Option Position</label>
        <select value={optionPosition} onChange={(e) => { setOptionPosition(e.target.value); handleUpdate({ optionPosition: e.target.value }); }} style={{ colorScheme: 'light' }} className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900">
          <option value="up">Up</option><option value="down">Down</option><option value="left">Left</option><option value="right">Right</option>
        </select>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">Drag Options</label>
          <Button variant="outline" size="sm" onClick={addOption}><Plus className="size-3 mr-1" /> Add Option</Button>
        </div>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input value={option} onChange={(e) => { const o = [...options]; o[index] = e.target.value; setOptions(o); handleUpdate({ options: o }); }} placeholder={`Option ${index + 1}`} className="flex-1" />
              <Input value={hints[index] || ''} onChange={(e) => { const h = [...hints]; h[index] = e.target.value; setHints(h); handleUpdate({ hints: h }); }} placeholder="Hint (optional)" className="flex-1" />
              <Button variant="ghost" size="icon-sm" onClick={() => removeOption(index)}><Trash2 className="size-4 text-red-500" /></Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ClozeDropdownCreator = ({ question, onChange }) => {
  const [text, setText] = useState(question.text || '');
  const [dropdownOptions, setDropdownOptions] = useState(question.dropdownOptions || [[]]);

  const handleUpdate = (updates) => onChange({ ...question, ...updates });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Question Text <span className="text-xs text-slate-500 ml-1">(Use {'${{input}}'} for dropdowns)</span></label>
        <Textarea value={text} onChange={(e) => { setText(e.target.value); handleUpdate({ text: e.target.value }); }} placeholder="Yesterday, we ${{input}} to the store..." rows={4} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">Dropdown Options (in order of blanks)</label>
          <Button variant="outline" size="sm" onClick={() => { const d = [...dropdownOptions, []]; setDropdownOptions(d); handleUpdate({ dropdownOptions: d }); }}><Plus className="size-3 mr-1" /> Add Dropdown</Button>
        </div>
        <div className="space-y-3">
          {dropdownOptions.map((opts, di) => (
            <div key={di} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-600">Dropdown {di + 1}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { const d = [...dropdownOptions]; d[di] = [...(d[di] || []), '']; setDropdownOptions(d); handleUpdate({ dropdownOptions: d }); }}><Plus className="size-3" /></Button>
                  {dropdownOptions.length > 1 && <Button variant="ghost" size="sm" onClick={() => { const d = dropdownOptions.filter((_, i) => i !== di); setDropdownOptions(d); handleUpdate({ dropdownOptions: d }); }}><Trash2 className="size-3 text-red-500" /></Button>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(opts || []).map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-1">
                    <Input value={opt} onChange={(e) => { const d = [...dropdownOptions]; d[di] = [...d[di]]; d[di][oi] = e.target.value; setDropdownOptions(d); handleUpdate({ dropdownOptions: d }); }} placeholder={`Option ${oi + 1}`} className="w-24" />
                    <Button variant="ghost" size="icon-sm" onClick={() => { const d = [...dropdownOptions]; d[di] = d[di].filter((_, i) => i !== oi); setDropdownOptions(d); handleUpdate({ dropdownOptions: d }); }}><span className="size-3 text-red-500 font-bold">×</span></Button>
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

const ClozeTextCreator = ({ question, onChange }) => {
  const [text, setText] = useState(question.text || '');
  const [correctAnswers, setCorrectAnswers] = useState(question.correctAnswers || []);

  const handleUpdate = (updates) => onChange({ ...question, ...updates });
  const blankCount = (text.match(/\$\{\{input\}\}/g) || []).length;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Question Text <span className="text-xs text-slate-500 ml-1">(Use {'${{input}}'} for blanks)</span></label>
        <Textarea value={text} onChange={(e) => { setText(e.target.value); handleUpdate({ text: e.target.value }); }} placeholder="We the ${{input}} of the United States..." rows={4} />
      </div>
      {blankCount > 0 && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Correct Answers (in order)</label>
          <div className="space-y-2">
            {Array.from({ length: blankCount }).map((_, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-sm text-slate-500 w-20">Blank {index + 1}:</span>
                <Input value={correctAnswers[index] || ''} onChange={(e) => { const a = [...correctAnswers]; a[index] = e.target.value; setCorrectAnswers(a); handleUpdate({ correctAnswers: a }); }} placeholder={`Answer for blank ${index + 1}`} className="flex-1" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const MatchListCreator = ({ question, onChange }) => {
  const [items, setItems] = useState(question.items || ['']);
  const [pairs, setPairs] = useState(question.pairs || ['']);

  const handleUpdate = (updates) => onChange({ ...question, ...updates });

  const addPair = () => {
    const i = [...items, '']; const p = [...pairs, ''];
    setItems(i); setPairs(p); handleUpdate({ items: i, pairs: p });
  };

  const removePair = (index) => {
    if (items.length <= 1) return;
    const i = items.filter((_, x) => x !== index); const p = pairs.filter((_, x) => x !== index);
    setItems(i); setPairs(p); handleUpdate({ items: i, pairs: p });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">Match Pairs</label>
        <Button variant="outline" size="sm" onClick={addPair}><Plus className="size-3 mr-1" /> Add Pair</Button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input value={item} onChange={(e) => { const i = [...items]; i[index] = e.target.value; setItems(i); handleUpdate({ items: i }); }} placeholder={`Item ${index + 1}`} className="flex-1" />
            <ArrowLeftRight className="size-4 text-slate-400" />
            <Input value={pairs[index] || ''} onChange={(e) => { const p = [...pairs]; p[index] = e.target.value; setPairs(p); handleUpdate({ pairs: p }); }} placeholder={`Match ${index + 1}`} className="flex-1" />
            {items.length > 1 && <Button variant="ghost" size="icon-sm" onClick={() => removePair(index)}><Trash2 className="size-4 text-red-500" /></Button>}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Items will be shuffled for students</p>
    </div>
  );
};

const SortListCreator = ({ question, onChange }) => {
  const [questionText, setQuestionText] = useState(question.question || '');
  const [items, setItems] = useState(question.items || ['']);

  const handleUpdate = (updates) => onChange({ ...question, ...updates });

  const moveItem = (index, dir) => {
    const ni = dir === 'up' ? index - 1 : index + 1;
    if (ni < 0 || ni >= items.length) return;
    const newItems = [...items];
    [newItems[index], newItems[ni]] = [newItems[ni], newItems[index]];
    setItems(newItems); handleUpdate({ items: newItems });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Question/Instruction</label>
        <Textarea value={questionText} onChange={(e) => { setQuestionText(e.target.value); handleUpdate({ question: e.target.value }); }} placeholder="Sort the countries in ascending order based on population:" rows={2} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">Items (in correct order)</label>
          <Button variant="outline" size="sm" onClick={() => { const i = [...items, '']; setItems(i); handleUpdate({ items: i }); }}><Plus className="size-3 mr-1" /> Add Item</Button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm text-slate-500 w-6">{index + 1}.</span>
              <Input value={item} onChange={(e) => { const i = [...items]; i[index] = e.target.value; setItems(i); handleUpdate({ items: i }); }} placeholder={`Item ${index + 1}`} className="flex-1" />
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => moveItem(index, 'up')} disabled={index === 0}><ChevronDown className="size-4 rotate-180" /></Button>
                <Button variant="ghost" size="icon-sm" onClick={() => moveItem(index, 'down')} disabled={index === items.length - 1}><ChevronDown className="size-4" /></Button>
              </div>
              {items.length > 2 && <Button variant="ghost" size="icon-sm" onClick={() => { const i = items.filter((_, x) => x !== index); setItems(i); handleUpdate({ items: i }); }}><Trash2 className="size-4 text-red-500" /></Button>}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1">Enter items in the correct order. They will be shuffled for students.</p>
      </div>
    </div>
  );
};

const TextResponseCreator = ({ question, onChange }) => {
  const [questionText, setQuestionText] = useState(question.question || '');
  const [maxWords, setMaxWords] = useState(question.maxWords || 10000);
  const handleUpdate = (updates) => onChange({ ...question, ...updates });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Question</label>
        <Textarea value={questionText} onChange={(e) => { setQuestionText(e.target.value); handleUpdate({ question: e.target.value }); }} placeholder="Enter your question..." rows={3} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Max Words</label>
        <Input type="number" value={maxWords} onChange={(e) => { const v = parseInt(e.target.value) || 10000; setMaxWords(v); handleUpdate({ maxWords: v }); }} min={1} />
      </div>
    </div>
  );
};

const FileUploadCreator = ({ question, onChange }) => {
  const [questionText, setQuestionText] = useState(question.question || '');
  const [allowedTypes, setAllowedTypes] = useState(question.allowedTypes || ['image', 'pdf', 'document']);
  const handleUpdate = (updates) => onChange({ ...question, ...updates });

  const toggleType = (type) => {
    const t = allowedTypes.includes(type) ? allowedTypes.filter(x => x !== type) : [...allowedTypes, type];
    setAllowedTypes(t); handleUpdate({ allowedTypes: t });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Question/Instructions</label>
        <Textarea value={questionText} onChange={(e) => { setQuestionText(e.target.value); handleUpdate({ question: e.target.value }); }} placeholder="Upload your assignment..." rows={3} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Allowed File Types</label>
        <div className="flex flex-wrap gap-2">
          {['image', 'pdf', 'document', 'video', 'audio'].map(type => (
            <button key={type} onClick={() => toggleType(type)} className={`px-3 py-1 rounded-full text-sm capitalize ${allowedTypes.includes(type) ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{type}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

const ImageHighlighterCreator = ({ question, onChange }) => {
  const [questionText, setQuestionText] = useState(question.question || '');
  const [imageUrl, setImageUrl] = useState(question.imageUrl || '');
  const handleUpdate = (updates) => onChange({ ...question, ...updates });

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image')) {
      const reader = new FileReader();
      reader.onloadend = () => { setImageUrl(reader.result); handleUpdate({ imageUrl: reader.result }); };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Question/Instructions</label>
        <Textarea value={questionText} onChange={(e) => { setQuestionText(e.target.value); handleUpdate({ question: e.target.value }); }} placeholder="Draw on the image to highlight healthy vs unhealthy items..." rows={3} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Upload Image</label>
        <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-sm border rounded-md file:bg-purple-600 file:text-white file:px-4 file:py-2 file:border-0 file:rounded-lg file:cursor-pointer hover:file:bg-purple-700" />
        {imageUrl && <img src={imageUrl} alt="Preview" className="mt-2 max-w-xs rounded-lg border" />}
      </div>
    </div>
  );
};

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

const TryoutManagement = () => {
  const [tryouts, setTryouts] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState({});

  const handleSelectType = (typeId) => {
    setSelectedType(typeId);
    setEditingIndex(null);
    setCurrentQuestion({ type: typeId, id: `tryout-${Date.now()}` });
  };

  const handleEditQuestion = (index) => {
    setEditingIndex(index);
    setCurrentQuestion({ ...tryouts[index] });
    setSelectedType(tryouts[index].type);
  };

  const handleSaveQuestion = () => {
    if (editingIndex !== null) {
      const updated = [...tryouts];
      updated[editingIndex] = currentQuestion;
      setTryouts(updated);
    } else {
      setTryouts([...tryouts, currentQuestion]);
    }
    setCurrentQuestion({});
    setSelectedType(null);
    setEditingIndex(null);
  };

  const handleDeleteQuestion = (index) => {
    setTryouts(tryouts.filter((_, i) => i !== index));
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

  const handleSaveAll = () => {
    toast.success(`${tryouts.length} question(s) saved to tryout`);
  };

  const CreatorComponent = selectedType ? QUESTION_CREATORS[selectedType] : null;

  return (
    <div className="flex flex-col h-full">
      <Toaster position="top-right" />

      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow">
            <Play size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Tryout Builder</h1>
            <p className="text-xs text-slate-500 mt-0.5">Create interactive questions students answer in the Smart Learning portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">{tryouts.length} question(s)</span>
          <Button onClick={handleSaveAll} disabled={tryouts.length === 0} className="bg-green-600 hover:bg-green-700 text-white">
            <Save className="size-4 mr-2" /> Save Tryout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">

        {/* Left Panel — Question List */}
        <div className="w-72 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">Questions</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {tryouts.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-3">
                  <Brain size={22} className="text-purple-500" />
                </div>
                <p className="text-sm font-medium text-slate-600">No tryout questions yet</p>
                <p className="text-xs text-slate-400 mt-1">Select a question type on the right to get started</p>
              </div>
            ) : (
              tryouts.map((tryout, index) => {
                const typeInfo = TRYOUT_TYPES.find(t => t.id === tryout.type);
                return (
                  <Motion.div
                    key={tryout.id || index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                      editingIndex === index
                        ? 'border-purple-500 bg-white shadow-sm'
                        : 'border-slate-200 bg-white hover:border-purple-300'
                    }`}
                    onClick={() => handleEditQuestion(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-purple-100 flex items-center justify-center shrink-0">
                          {typeInfo && <typeInfo.icon className="size-3 text-purple-600" />}
                        </div>
                        <span className="text-xs font-medium text-slate-700 truncate">{typeInfo?.label || tryout.type}</span>
                      </div>
                      <button
                        className="shrink-0 p-1 rounded hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(index); }}
                      >
                        <Trash2 className="size-3.5 text-red-400" />
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400 truncate">
                      {tryout.question || tryout.text || `Question ${index + 1}`}
                    </p>
                  </Motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel — Type Picker or Creator */}
        <div className="flex-1 overflow-y-auto bg-white">
          <AnimatePresence mode="wait">
            {!selectedType && editingIndex === null ? (
              <Motion.div
                key="type-picker"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6"
              >
                <div className="flex items-center gap-2 mb-5">
                  <Zap className="size-4 text-purple-500" />
                  <h3 className="text-sm font-semibold text-slate-700">Select Question Type</h3>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {TRYOUT_TYPES.map(type => (
                    <button
                      key={type.id}
                      onClick={() => handleSelectType(type.id)}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition-all hover:border-purple-400 hover:bg-purple-50 hover:shadow-sm"
                    >
                      <div className="rounded-lg bg-purple-100 p-2 shrink-0">
                        <type.icon className="size-5 text-purple-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700 text-sm">{type.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{type.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </Motion.div>
            ) : (
              <Motion.div
                key="creator"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="p-6"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    {selectedType && (() => { const t = TRYOUT_TYPES.find(x => x.id === selectedType); return t ? <div className="rounded-lg bg-purple-100 p-1.5"><t.icon className="size-4 text-purple-600" /></div> : null; })()}
                    <h3 className="text-sm font-semibold text-slate-700">
                      {editingIndex !== null ? 'Edit Question' : 'Create Question'}
                    </h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCancel}>Cancel</Button>
                </div>

                <div className="max-w-2xl">
                  {CreatorComponent && (
                    <CreatorComponent
                      key={editingIndex ?? 'new'}
                      question={currentQuestion}
                      onChange={setCurrentQuestion}
                    />
                  )}

                  <div className="mt-6 flex justify-end">
                    <Button onClick={handleSaveQuestion} className="bg-purple-600 hover:bg-purple-700 text-white">
                      <Save className="size-4 mr-2" />
                      {editingIndex !== null ? 'Update Question' : 'Add Question'}
                    </Button>
                  </div>
                </div>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default TryoutManagement;
