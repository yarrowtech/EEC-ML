/* eslint-disable react/prop-types */
import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CheckCircle2, Upload, MessageCircle, X,
  Bold, Italic, RotateCcw, Pencil,
  ListChecks, LayoutGrid, Type, Link2, ArrowUpDown, PenLine, FileUp, Highlighter,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Reorder } from 'framer-motion';
import { slugifyForUrl, deslugifyFromUrl } from '../utils/urlSlug';
import { useStudentDashboard } from './StudentDashboardContext';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const SMART_LEARNING_MAP_ENDPOINT = `${API_BASE}/api/lesson-plans/student/smart-learning-map`;
const SUBMIT_ENDPOINT = `${API_BASE}/api/lesson-plans/student/tryout-submit`;
const RESULTS_ENDPOINT = `${API_BASE}/api/lesson-plans/student/tryout-results`;

// "Kinetic Campus" design tokens: calm indigo/sky/amber flat-card system —
// white surfaces, soft indigo-tinted shadows, no glass/blur. Scoped to this
// page only (the rest of Smart Learning uses the frosted-glass system).
const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_-2px_rgba(79,70,229,0.04),0_1px_4px_-1px_rgba(15,23,42,0.03)]';
const CARD_HOVER = 'transition-shadow duration-200 hover:shadow-[0_8px_20px_-4px_rgba(79,70,229,0.08),0_2px_6px_-2px_rgba(15,23,42,0.04)]';
const GHOST_BTN = 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300';

const normalize = (value) => String(value || '').trim().toLowerCase();
const asArray = (value) => (Array.isArray(value) ? value : []);
export const normalizeQuestionType = (value) => normalize(value).replace(/-/g, '_');
const optionLabels = ['A', 'B', 'C', 'D', 'E'];

export const TYPE_META = {
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
export const typeMeta = (type) => TYPE_META[normalizeQuestionType(type)] || { label: 'Tryout', short: 'Tryout', icon: ListChecks };

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
// Pen cursor for the image highlighter, tinted with the chosen colour (hotspot = pen tip).
const penCursor = (color) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z'/><path d='m15 5 4 4'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 22, crosshair`;
};

const formatAgo = (ts) => {
  if (!ts) return '';
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
};

// Match List as "connect the wires": press on an item on either side and drag a
// wire to its partner on the other side (or tap one, then tap the other).
// `matches` is { [leftIndex]: rightIndex } — unchanged answer format.
const WIRE_COLORS = ['#4f46e5', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];

const MatchListWires = ({ items, pairs, matches, onChange }) => {
  const boxRef = useRef(null);
  const nodeRefs = useRef({}); // `L0`, `R2` -> dot element
  const [anchors, setAnchors] = useState({}); // key -> {x, y} relative to the box
  const [drag, setDrag] = useState(null); // { side, index, x, y }
  const [picked, setPicked] = useState(null); // tap-tap fallback: { side, index }
  // Show the right column in a fixed shuffled order so answers aren't simply side by side.
  const [rightOrder] = useState(() => {
    const order = pairs.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  });

  const measure = () => {
    const box = boxRef.current;
    if (!box) return;
    const b = box.getBoundingClientRect();
    const next = {};
    Object.entries(nodeRefs.current).forEach(([key, el]) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      next[key] = { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top };
    });
    setAnchors(next);
  };

  useLayoutEffect(() => {
    measure();
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    // Also fires when the question goes from hidden to visible in the exam.
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [items.length, pairs.length]);

  const rightOf = (leftIndex) => matches[leftIndex];
  const leftOf = (rightIndex) => {
    const hit = Object.entries(matches).find(([, r]) => r === rightIndex);
    return hit ? Number(hit[0]) : undefined;
  };

  const connect = (leftIndex, rightIndex) => {
    const updated = {};
    Object.entries(matches).forEach(([l, r]) => {
      if (Number(l) !== leftIndex && r !== rightIndex) updated[l] = r; // each side links once
    });
    updated[leftIndex] = rightIndex;
    onChange(updated);
  };
  const disconnect = (side, index) => {
    const updated = { ...matches };
    if (side === 'L') delete updated[index];
    else { const l = leftOf(index); if (l !== undefined) delete updated[l]; }
    onChange(updated);
  };

  const finish = (from, target) => {
    if (!target || target.side === from.side) return false;
    const leftIndex = from.side === 'L' ? from.index : target.index;
    const rightIndex = from.side === 'R' ? from.index : target.index;
    connect(leftIndex, rightIndex);
    return true;
  };

  const targetAt = (clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY)?.closest?.('[data-wire-node]');
    if (!el) return null;
    const [side, index] = el.getAttribute('data-wire-node').split(':');
    return { side, index: Number(index) };
  };

  // Tap / click / Enter: pick one side, then the other. Tapping a connected item removes its wire.
  const tap = (side, index) => {
    const from = { side, index };
    if (picked && picked.side !== side) { finish(picked, from); setPicked(null); return; }
    if (picked && picked.index === index) { setPicked(null); return; }
    const linked = side === 'L' ? rightOf(index) !== undefined : leftOf(index) !== undefined;
    if (linked && !picked) { disconnect(side, index); return; }
    setPicked(from);
  };

  const startDrag = (e, side, index) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const from = { side, index };
    let moved = false;
    const startX = e.clientX; const startY = e.clientY;
    setDrag({ ...from, x: e.clientX - box.left, y: e.clientY - box.top });

    const onMove = (ev) => {
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 6) moved = true;
      const b = boxRef.current?.getBoundingClientRect();
      if (b) setDrag({ ...from, x: ev.clientX - b.left, y: ev.clientY - b.top });
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDrag(null);
      const target = targetAt(ev.clientX, ev.clientY);
      if (moved) { finish(from, target); setPicked(null); return; }
      tap(side, index);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const curve = (a, b) => {
    const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  };

  const colorOfLeft = (leftIndex) => WIRE_COLORS[leftIndex % WIRE_COLORS.length];

  const node = (side, index, label) => {
    const linkedTo = side === 'L' ? rightOf(index) : leftOf(index);
    const isLinked = linkedTo !== undefined;
    const color = isLinked ? colorOfLeft(side === 'L' ? index : linkedTo) : null;
    const isPicked = picked?.side === side && picked?.index === index;
    const isDragSource = drag?.side === side && drag?.index === index;
    const dot = (
      <span
        ref={(el) => { nodeRefs.current[`${side}${index}`] = el; }}
        className={`relative z-10 flex size-4 shrink-0 items-center justify-center rounded-full border-2 bg-white transition ${isLinked ? '' : isPicked || isDragSource ? 'border-indigo-600' : 'border-slate-300'}`}
        style={isLinked ? { borderColor: color, background: color } : undefined}
      />
    );
    return (
      <div
        key={`${side}${index}`}
        data-wire-node={`${side}:${index}`}
        onPointerDown={(e) => startDrag(e, side, index)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(side, index); } }}
        role="button"
        tabIndex={0}
        aria-label={`${side === 'L' ? 'Left' : 'Right'} item: ${label}${isLinked ? ' (connected)' : ''}`}
        className={`flex cursor-pointer touch-none select-none items-center gap-3 rounded-xl border-2 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition ${
          isPicked || isDragSource ? 'border-indigo-500 ring-2 ring-indigo-200' : isLinked ? 'border-transparent' : 'border-slate-200 hover:border-indigo-300'
        } ${side === 'L' ? 'flex-row' : 'flex-row-reverse text-right'}`}
        style={isLinked ? { borderColor: `${color}66`, background: `${color}0d` } : undefined}
      >
        {side === 'L' && <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{index + 1}</span>}
        <span className="min-w-0 flex-1 wrap-break-word">{label}</span>
        {dot}
      </div>
    );
  };

  const dragStart = drag ? anchors[`${drag.side}${drag.index}`] : null;
  const matchedCount = Object.keys(matches).length;

  return (
    <div>
      <p className="mb-3 text-xs font-semibold text-slate-500">
        Press on an item and drag the wire to its match on the other side. Tap a connected item to remove its wire.
      </p>
      <div ref={boxRef} className="relative grid grid-cols-[1fr_minmax(48px,18%)_1fr] items-start">
        <div className="space-y-2.5">{items.map((item, i) => node('L', i, item))}</div>
        <div />
        <div className="space-y-2.5">{rightOrder.map((r) => node('R', r, pairs[r]))}</div>

        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {Object.entries(matches).map(([l, r]) => {
            const a = anchors[`L${l}`]; const b = anchors[`R${r}`];
            if (!a || !b) return null;
            return <path key={`${l}-${r}`} d={curve(a, b)} fill="none" stroke={colorOfLeft(Number(l))} strokeWidth="3" strokeLinecap="round" />;
          })}
          {drag && dragStart && (
            <path
              d={drag.side === 'L' ? curve(dragStart, { x: drag.x, y: drag.y }) : curve({ x: drag.x, y: drag.y }, dragStart)}
              fill="none" stroke="#4f46e5" strokeWidth="3" strokeDasharray="6 5" strokeLinecap="round"
            />
          )}
          {drag && <circle cx={drag.x} cy={drag.y} r="6" fill="#4f46e5" />}
        </svg>
      </div>
      <p className="mt-3 text-right text-xs font-semibold text-slate-500">{matchedCount} of {items.length} connected</p>
    </div>
  );
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
  const [dragOverBlank, setDragOverBlank] = useState(null);
  const [matches, setMatches] = useState({});
  const [fileName, setFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeColor, setActiveColor] = useState(MARK_COLORS[0]);
  const [marks, setMarks] = useState([]);
  const [drawStart, setDrawStart] = useState(null);
  const [drawCurrent, setDrawCurrent] = useState(null);
  const [editingMarkId, setEditingMarkId] = useState(null);
  const [movingMarkId, setMovingMarkId] = useState(null);
  const imageBoxRef = useRef(null);

  const questionType = normalizeQuestionType(question.type);
  const mcqTheme = normalize(question.theme) || 'standard';
  const options = asArray(question.options).filter(Boolean);
  const statements = asArray(question.statements).filter(Boolean);
  const items = asArray(question.items).filter(Boolean);
  const pairs = asArray(question.pairs).filter(Boolean);
  const dropdownOptions = asArray(question.dropdownOptions);

  // Sort list: start shuffled (the teacher's order is the correct answer), never already solved.
  const [order, setOrder] = useState(() => {
    const base = items.map((_, i) => i);
    if (base.length < 2) return base;
    let shuffled = base;
    for (let attempt = 0; attempt < 10 && shuffled.every((v, i) => v === i); attempt += 1) {
      shuffled = [...base];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    }
    return shuffled;
  });
  const [sortDragging, setSortDragging] = useState(null); // itemIndex being dragged
  const orderRef = useRef(order);
  const reorder = (next) => { orderRef.current = next; setOrder(next); };

  const reportAnswer = (payload) => {
    if (onAnswer) onAnswer(payload);
  };

  const moveItem = (position, direction) => {
    const target = position + direction;
    if (target < 0 || target >= order.length) return;
    const newOrder = [...order];
    [newOrder[position], newOrder[target]] = [newOrder[target], newOrder[position]];
    reorder(newOrder);
    reportAnswer({ value: newOrder });
  };

  // Move a drawn box (drag its body) or resize it (drag the corner handle).
  const startMarkDrag = (e, mark, mode) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation(); // don't start drawing a new box
    const rect = imageBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX; const sy = e.clientY;
    let latest = marks;
    const onMove = (ev) => {
      const dx = ((ev.clientX - sx) / rect.width) * 100;
      const dy = ((ev.clientY - sy) / rect.height) * 100;
      latest = marks.map((m) => {
        if (m.id !== mark.id) return m;
        if (mode === 'move') {
          return { ...m, x: Math.min(100 - m.w, Math.max(0, mark.x + dx)), y: Math.min(100 - m.h, Math.max(0, mark.y + dy)) };
        }
        return { ...m, w: Math.min(100 - m.x, Math.max(3, mark.w + dx)), h: Math.min(100 - m.y, Math.max(3, mark.h + dy)) };
      });
      setMarks(latest);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setMovingMarkId(null);
      if (latest !== marks) reportAnswer({ value: latest });
    };
    setMovingMarkId(mark.id);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const removeMark = (id) => {
    const updated = marks.filter((m) => m.id !== id);
    setMarks(updated);
    reportAnswer(updated.length ? { value: updated } : null);
  };

  return (
    <article className={`${CARD} ${CARD_HOVER} p-4 sm:p-6`}>

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

      {questionType === 'cloze_drag_drop' && (() => {
        // Put a bank word into a blank (replacing what was there), or clear a blank.
        const placeWord = (blankIndex, wordIndex) => {
          const updated = { ...placements };
          // a word can sit in only one blank — move it if it was elsewhere
          Object.keys(updated).forEach((k) => { if (updated[k] === wordIndex) delete updated[k]; });
          if (wordIndex === null || wordIndex === undefined) delete updated[blankIndex];
          else updated[blankIndex] = wordIndex;
          setPlacements(updated);
          setActiveBankIndex(null);
          reportAnswer(Object.keys(updated).length ? { value: updated } : null);
        };
        const readDrag = (e) => {
          const raw = e.dataTransfer.getData('text/plain');
          const [kind, idx, from] = raw.split(':');
          return kind === 'word' ? { wordIndex: Number(idx), fromBlank: from === undefined ? null : Number(from) } : null;
        };
        return (
          <div className="space-y-5">
            {question.question && <p className="text-base font-semibold text-slate-800">{question.question}</p>}

            {/* 1. the sentence with blanks */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[15px] leading-[2.6] text-slate-800">
                {renderTextWithInputs(question.text, (blankIndex) => {
                  const placedWordIndex = placements[blankIndex];
                  const placedWord = placedWordIndex !== undefined ? options[placedWordIndex] : null;
                  const isOver = dragOverBlank === blankIndex;
                  return (
                    <span
                      key={blankIndex}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverBlank(blankIndex); }}
                      onDragLeave={() => setDragOverBlank((v) => (v === blankIndex ? null : v))}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverBlank(null);
                        const d = readDrag(e);
                        if (d) placeWord(blankIndex, d.wordIndex);
                      }}
                      className="mx-1 inline-block align-middle"
                    >
                      <button
                        type="button"
                        draggable={Boolean(placedWord)}
                        onDragStart={(e) => { if (placedWord) e.dataTransfer.setData('text/plain', `word:${placedWordIndex}:${blankIndex}`); }}
                        onClick={() => {
                          if (activeBankIndex !== null) placeWord(blankIndex, activeBankIndex);
                          else if (placedWord) placeWord(blankIndex, null);
                        }}
                        aria-label={placedWord ? `Blank ${blankIndex + 1}: ${placedWord}. Click to remove` : `Blank ${blankIndex + 1}, empty`}
                        className={`inline-flex min-w-[110px] items-center justify-center gap-1 rounded-lg border-2 px-3 py-1 text-sm font-semibold transition ${
                          placedWord
                            ? `${WORD_BANK_STYLES[placedWordIndex % WORD_BANK_STYLES.length]} cursor-grab border-transparent active:cursor-grabbing`
                            : isOver
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                            : activeBankIndex !== null
                            ? 'animate-pulse border-dashed border-indigo-400 bg-indigo-50/60 text-indigo-500'
                            : 'border-dashed border-slate-300 bg-slate-50 text-slate-400'
                        }`}
                      >
                        {placedWord || `${blankIndex + 1}`}
                        {placedWord && <X size={12} />}
                      </button>
                    </span>
                  );
                })}
              </p>
            </div>

            {/* 2. word bank below — drag a word up into a blank (or tap word, then tap blank) */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const d = readDrag(e);
                if (d && d.fromBlank !== null) placeWord(d.fromBlank, null); // dragged back to the bank
              }}
              className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-4"
            >
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-indigo-500">Word bank — drag a word into a blank above</p>
              <div className="flex flex-wrap gap-2">
                {options.map((word, wordIndex) => {
                  const isUsed = Object.values(placements).includes(wordIndex);
                  const isActive = activeBankIndex === wordIndex;
                  return (
                    <button
                      key={`${word}-${wordIndex}`}
                      type="button"
                      draggable={!isUsed}
                      disabled={isUsed}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', `word:${wordIndex}`); e.dataTransfer.effectAllowed = 'move'; }}
                      onClick={() => setActiveBankIndex(isActive ? null : wordIndex)}
                      className={`rounded-full border px-4 py-1.5 text-sm font-semibold shadow-sm transition ${
                        isUsed
                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 line-through shadow-none'
                          : isActive
                          ? 'cursor-grab border-indigo-600 bg-indigo-600 text-white'
                          : `${WORD_BANK_STYLES[wordIndex % WORD_BANK_STYLES.length]} cursor-grab hover:-translate-y-0.5 active:cursor-grabbing`
                      }`}
                    >
                      {word}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-slate-500">On a phone: tap a word, then tap the blank. Tap a filled blank to remove its word.</p>
            </div>
          </div>
        );
      })()}

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
          <MatchListWires
            items={items}
            pairs={pairs}
            matches={matches}
            onChange={(updated) => {
              setMatches(updated);
              reportAnswer(Object.keys(updated).length ? { value: updated } : null);
            }}
          />
        </div>
      )}

      {questionType === 'sort_list' && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-slate-800">{question.question || 'Arrange the items in order'}</h3>
          <p className="text-xs font-semibold text-slate-500">Drag the items by the ⋮⋮ handle to put them in the correct order (top = first).</p>
          <Reorder.Group axis="y" values={order} onReorder={reorder} className="space-y-2" role="list">
            {order.map((itemIndex, position) => {
              const dragging = sortDragging === itemIndex;
              return (
                <Reorder.Item
                  key={itemIndex}
                  value={itemIndex}
                  onDragStart={() => setSortDragging(itemIndex)}
                  onDragEnd={() => { setSortDragging(null); reportAnswer({ value: orderRef.current }); }}
                  whileDrag={{ scale: 1.03, boxShadow: '0 12px 28px -8px rgba(79,70,229,0.35)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') { e.preventDefault(); moveItem(position, -1); }
                    if (e.key === 'ArrowDown') { e.preventDefault(); moveItem(position, 1); }
                  }}
                  tabIndex={0}
                  aria-label={`Position ${position + 1}: ${items[itemIndex]}. Drag, or use arrow keys to move.`}
                  className={`relative flex cursor-grab touch-none select-none items-center gap-3 rounded-xl border bg-white p-3 active:cursor-grabbing ${
                    dragging ? 'z-10 border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <span className="text-lg leading-none text-slate-400" aria-hidden="true">⋮⋮</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{position + 1}</span>
                  <span className="flex-1 text-sm font-medium text-slate-700">{items[itemIndex]}</span>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
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
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  <Pencil size={13} style={{ color: activeColor }} /> Pen
                </span>
                <span className="text-xs text-slate-400">Colour:</span>
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
                className="relative mx-auto w-fit max-w-full touch-none select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                style={{ cursor: penCursor(activeColor) }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  const rect = imageBoxRef.current.getBoundingClientRect();
                  setDrawStart({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
                }}
                onPointerMove={(e) => {
                  if (!drawStart) return;
                  const rect = imageBoxRef.current.getBoundingClientRect();
                  const clamp = (v) => Math.min(100, Math.max(0, v));
                  setDrawCurrent({ x: clamp(((e.clientX - rect.left) / rect.width) * 100), y: clamp(((e.clientY - rect.top) / rect.height) * 100) });
                }}
                onPointerUp={() => {
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
                <img src={question.imageUrl} alt="Tryout" className="pointer-events-none block h-auto max-h-[360px] w-auto max-w-full" draggable={false} />
                {marks.map((mark) => (
                  <div
                    key={mark.id}
                    onPointerDown={(e) => startMarkDrag(e, mark, 'move')}
                    title="Drag to move · drag the corner to resize"
                    className={`group absolute cursor-move rounded-md border-2 transition-shadow ${movingMarkId === mark.id ? 'shadow-lg' : 'hover:shadow-md'}`}
                    style={{ left: `${mark.x}%`, top: `${mark.y}%`, width: `${mark.w}%`, height: `${mark.h}%`, borderColor: mark.color, backgroundColor: `${mark.color}33` }}
                  >
                    <span
                      onPointerDown={(e) => startMarkDrag(e, mark, 'resize')}
                      aria-hidden="true"
                      className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-white shadow"
                      style={{ backgroundColor: mark.color }}
                    />
                    {editingMarkId === mark.id ? (
                      <input
                        autoFocus
                        defaultValue={mark.label}
                        onPointerDown={(e) => e.stopPropagation()}
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
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => setEditingMarkId(mark.id)}
                        className="absolute -top-6 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: mark.label ? mark.color : '#94a3b8' }}
                      >
                        {mark.label || '+ Add label'}
                      </button>
                    )}
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => removeMark(mark.id)}
                      aria-label="Remove mark"
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
              <p className="text-xs font-semibold text-slate-400">{marks.length} mark{marks.length !== 1 ? 's' : ''} on diagram — use the pen: press and drag on the picture to draw a box. Drag a box to move it, or its corner to resize.</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">No image attached for this question.</p>
          )}
        </div>
      )}
    </article>
  );
};

const AILearningTryoutSection = forwardRef(({ assignedSubjectName = '', assignedTopicName = '', onBack, onQuestionsLoaded }, ref) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useStudentDashboard() || {};
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
  // Tryouts can be practised any number of times; remount the form per attempt.
  const [attemptKey, setAttemptKey] = useState(0);
  const [bestScore, setBestScore] = useState(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [answeredIndexes, setAnsweredIndexes] = useState(() => new Set());
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [, setSaveTick] = useState(0);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  // Full-screen exam mode (CBT style): one question at a time, grouped into sections by type.
  const [examOpen, setExamOpen] = useState(false);
  const [visitedIndexes, setVisitedIndexes] = useState(() => new Set());
  const [markedIndexes, setMarkedIndexes] = useState(() => new Set());
  const [clearKeys, setClearKeys] = useState({});
  const [showPalette, setShowPalette] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // answers keyed by question index
  const answersRef = useRef({});

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

  // A student can only submit a given tryout once — check for a prior
  // submission up front so re-visiting/refreshing this page shows the
  // recorded result instead of letting them redo (and re-submit) it.
  useEffect(() => {
    const checkExistingSubmission = async () => {
      try {
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        if (!token || userType !== 'Student') return;

        const res = await fetch(`${RESULTS_ENDPOINT}?topicTitle=${encodeURIComponent(topicSlug)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;

        const mine = asArray(data?.results).filter(
          (r) => normalize(r.subjectName) === normalize(subjectSlug) && normalize(r.topicTitle) === normalize(topicSlug),
        );
        const scores = mine.map((r) => r.autoScore).filter((v) => typeof v === 'number');
        if (scores.length) setBestScore(Math.max(...scores));
        const existing = mine[0]; // newest first
        if (existing) {
          setSubmitResult(existing);
          setSubmitted(true);
          try { localStorage.removeItem(storageKey); } catch { /* best-effort cleanup */ }
        }
      } finally {
        setCheckingExisting(false);
      }
    };

    checkExistingSubmission();
  }, [subjectSlug, topicSlug]);

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

  // Sections: one per question type, in the order the teacher added them.
  const sections = useMemo(() => {
    const list = [];
    assignedTryouts.forEach((q, i) => {
      const type = normalizeQuestionType(q.type) || 'other';
      let section = list.find((x) => x.type === type);
      if (!section) { section = { type, meta: typeMeta(type), indexes: [] }; list.push(section); }
      section.indexes.push(i);
    });
    return list;
  }, [assignedTryouts]);

  // Section tabs: show ‹ › arrows only when the row can scroll that way.
  const sectionsScrollRef = useRef(null);
  const [sectionScroll, setSectionScroll] = useState({ left: false, right: false });
  const updateSectionScroll = () => {
    const el = sectionsScrollRef.current;
    if (!el) return;
    setSectionScroll({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  const scrollSections = (dir) => {
    const el = sectionsScrollRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.6), behavior: 'smooth' });
  };
  useEffect(() => {
    if (!examOpen) return undefined;
    updateSectionScroll();
    window.addEventListener('resize', updateSectionScroll);
    return () => window.removeEventListener('resize', updateSectionScroll);
  }, [examOpen, sections.length]);
  // Bring the current section's tab into view when the student moves to another section.
  const activeSectionType = sections.find((sec) => sec.indexes.includes(activeQuestionIndex))?.type;
  useEffect(() => {
    if (!examOpen) return;
    sectionsScrollRef.current?.querySelector('[data-active-section]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    updateSectionScroll();
  }, [examOpen, activeSectionType]);

  // Elapsed-time clock while the exam is open.
  useEffect(() => {
    if (!examOpen) return undefined;
    const id = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [examOpen]);

  // Lock page scroll behind the full-screen exam.
  useEffect(() => {
    if (!examOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [examOpen]);

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

  const goToQuestion = (idx) => {
    if (idx < 0 || idx >= assignedTryouts.length) return;
    setActiveQuestionIndex(idx);
    setVisitedIndexes((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)));
  };

  const exitBrowserFullscreen = () => {
    try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch { /* ignore */ }
  };

  const openExam = (idx = 0) => {
    setExamOpen(true);
    goToQuestion(idx);
    // Best-effort real fullscreen; the overlay already covers the screen if the browser refuses.
    try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch { /* ignore */ }
  };

  const closeExam = () => {
    setExamOpen(false);
    setShowPalette(false);
    setConfirmSubmit(false);
    exitBrowserFullscreen();
  };

  // Let a parent "choose your format" list (built from the same assigned
  // questions) know what's here, and give it a way to jump straight to the
  // first question of a given type without re-deriving this data itself.
  useEffect(() => {
    onQuestionsLoaded?.(assignedTryouts);
  }, [assignedTryouts, onQuestionsLoaded]);

  useImperativeHandle(ref, () => ({
    scrollToType: (type) => {
      const idx = assignedTryouts.findIndex((q) => normalizeQuestionType(q.type) === normalizeQuestionType(type));
      if (idx >= 0) openExam(idx);
    },
  }), [assignedTryouts]);

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
      if (res.status === 409) {
        // Already submitted (e.g. from another tab, or a resubmit race) —
        // show the recorded result instead of surfacing this as an error.
        setSubmitted(true);
        setSubmitResult(data.result);
        try { localStorage.removeItem(storageKey); } catch { /* best-effort cleanup */ }
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Submission failed');
      if (typeof data?.result?.autoScore === 'number') setBestScore((prev) => (prev === null ? data.result.autoScore : Math.max(prev, data.result.autoScore)));
      setSubmitted(true);
      setSubmitResult(data.result);
      closeExam();
      try { localStorage.removeItem(storageKey); } catch { /* best-effort cleanup */ }
    } catch (err) {
      setError(err?.message || 'Failed to submit tryout. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const startNewAttempt = () => {
    answersRef.current = {};
    setAnsweredIndexes(new Set());
    setLastSavedAt(null);
    setActiveQuestionIndex(0);
    setVisitedIndexes(new Set());
    setMarkedIndexes(new Set());
    setClearKeys({});
    setElapsed(0);
    setError('');
    try { localStorage.removeItem(storageKey); } catch { /* best-effort cleanup */ }
    setSubmitted(false);
    setAttemptKey((k) => k + 1);
  };

  if (submitted) {
    return (
      <div className="w-full min-h-screen bg-[#f8fafc] p-4 text-slate-900 sm:p-6 md:p-8">
        <div className="mx-auto w-full max-w-[700px]">
          <div className={`${CARD} p-8 text-center`}>
            <CheckCircle2 className="mx-auto mb-4 text-emerald-500" size={48} />
            <h1 className="text-2xl font-bold text-slate-900">Tryout Submitted!</h1>
            <p className="mt-2 text-sm text-slate-500">
              Your answers have been recorded{submitResult?.attemptNumber ? ` — attempt ${submitResult.attemptNumber}` : ''}.
            </p>
            {bestScore !== null && (submitResult?.attemptNumber || 1) > 1 && (
              <p className="mt-1 text-xs font-semibold text-indigo-600">Your best score so far: {bestScore}%</p>
            )}

            <button type="button" onClick={startNewAttempt} className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              <RotateCcw size={16} /> Practice again
            </button>
            <p className="mt-2 text-xs text-slate-400">You can practise as many times as you like. Every attempt is saved.</p>
          </div>
        </div>
      </div>
    );
  }

  const isLoading = loading || checkingExisting;
  const totalQuestions = assignedTryouts.length;
  const answeredCount = answeredIndexes.size;
  const current = assignedTryouts[activeQuestionIndex];
  const currentSectionIdx = Math.max(0, sections.findIndex((s) => s.indexes.includes(activeQuestionIndex)));
  const currentSection = sections[currentSectionIdx];
  const posInSection = currentSection ? currentSection.indexes.indexOf(activeQuestionIndex) : 0;

  // CBT-style palette status for one question.
  const statusOf = (idx) => {
    const answered = answeredIndexes.has(idx);
    const isMarked = markedIndexes.has(idx);
    if (answered && isMarked) return 'answered-marked';
    if (isMarked) return 'marked';
    if (answered) return 'answered';
    if (visitedIndexes.has(idx)) return 'not-answered';
    return 'not-visited';
  };
  const STATUS_STYLE = {
    answered: 'bg-[#2e9e3f] text-white border-[#2e9e3f]',
    'not-answered': 'bg-[#e5532d] text-white border-[#e5532d]',
    'not-visited': 'bg-slate-100 text-slate-700 border-slate-300',
    marked: 'bg-[#6b3fa0] text-white border-[#6b3fa0] rounded-full',
    'answered-marked': 'bg-[#6b3fa0] text-white border-[#6b3fa0] rounded-full ring-2 ring-[#2e9e3f] ring-offset-1',
  };
  const LEGEND = [
    ['answered', 'Answered'],
    ['not-answered', 'Not answered'],
    ['not-visited', 'Not visited'],
    ['marked', 'Marked for review'],
    ['answered-marked', 'Answered & marked'],
  ];
  const countBy = (status) => assignedTryouts.reduce((n, _, i) => n + (statusOf(i) === status ? 1 : 0), 0);

  const isLast = activeQuestionIndex >= totalQuestions - 1;
  const saveAndNext = () => { if (!isLast) goToQuestion(activeQuestionIndex + 1); else setConfirmSubmit(true); };
  const markAndNext = () => {
    setMarkedIndexes((prev) => new Set(prev).add(activeQuestionIndex));
    saveAndNext();
  };
  const clearResponse = () => {
    handleAnswer(activeQuestionIndex, null);
    setMarkedIndexes((prev) => { const next = new Set(prev); next.delete(activeQuestionIndex); return next; });
    setClearKeys((prev) => ({ ...prev, [activeQuestionIndex]: (prev[activeQuestionIndex] || 0) + 1 }));
  };

  const fmtTime = (sec) => `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  // ── Intro screen (before the exam starts) ──
  const intro = (
    <div className="w-full min-h-screen bg-[#f8fafc] p-4 text-slate-900 sm:p-6 md:p-8">
      <div className="mx-auto w-full max-w-[800px]">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={returnToPreviousView} className={GHOST_BTN}>
            <ArrowLeft size={16} />
            {onBack ? 'Back to Activities' : 'Back to Topic'}
          </button>
          <button type="button" onClick={() => navigate('/student/assignments-academic-alcove')} className={`ml-auto ${GHOST_BTN}`}>
            <MessageCircle size={16} className="text-indigo-500" /> Need Help?
          </button>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {isLoading && <div className={`${CARD} p-6 text-sm font-semibold text-slate-500`}>Loading assigned tryout...</div>}
        {!isLoading && !error && totalQuestions === 0 && (
          <div className={`${CARD} p-15 text-center`}>
            <CheckCircle2 className="mx-auto mb-3 text-slate-300" size={34} />
            <h2 className="text-lg font-bold text-slate-800">No Practice Problems Assigned</h2>
            <p className="mt-1 text-sm text-slate-500">Your teacher has not assigned a tryout for this topic yet.</p>
          </div>
        )}
        {!isLoading && !error && totalQuestions > 0 && (
          <div className={`${CARD} p-6`}>
            <h1 className="text-xl font-bold text-slate-900">{topicSlug}</h1>
            {chapterTitle && <p className="mt-0.5 text-sm text-slate-500">{chapterTitle}</p>}
            <p className="mt-3 text-sm text-slate-600">{totalQuestions} question{totalQuestions === 1 ? '' : 's'} in {sections.length} section{sections.length === 1 ? '' : 's'}</p>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              {sections.map((s, i) => {
                const Icon = s.meta.icon;
                return (
                  <div key={s.type} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span>
                    <Icon size={16} className="text-indigo-500" />
                    <span className="flex-1 text-sm font-semibold text-slate-800">Section {i + 1} · {s.meta.label}</span>
                    <span className="text-xs font-semibold text-slate-500">{s.indexes.length} question{s.indexes.length === 1 ? '' : 's'}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Instructions</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>Questions appear one at a time. Use <b>Save &amp; Next</b> to move on.</li>
                <li>Use <b>Mark for Review</b> to come back to a question later.</li>
                <li>Jump to any question from the palette on the right, or switch sections from the top.</li>
                <li>Press <b>Submit</b> when you are done. You can practise again as many times as you like.</li>
              </ul>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {LEGEND.map(([k, l]) => (
                  <span key={k} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <span className={`h-4 w-4 rounded border ${STATUS_STYLE[k]}`} /> {l}
                  </span>
                ))}
              </div>
            </div>

            <button type="button" onClick={() => openExam(0)} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 sm:w-auto">
              Start Practice <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (!examOpen || isLoading || error || totalQuestions === 0) return <div key={attemptKey}>{intro}</div>;

  // ── Full-screen exam (railway CBT style, one question at a time) ──
  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') || {}; } catch { return {}; } })();
  const candidateName = profile?.name || profile?.fullName || storedUser.name || storedUser.studentName || 'Student';
  const candidatePhoto = String(profile?.profilePic || profile?.avatar || profile?.profileImage || '').trim();
  const candidateClass = String(profile?.className || profile?.grade || '').replace(/^classs*/i, '').trim();
  const candidateSection = String(profile?.sectionName || profile?.section || '').trim();
  const candidateClassLabel = [candidateClass, candidateSection].filter(Boolean).join('-');

  // CBT palette shapes: square = not visited, "flag" = not answered,
  // rounded-top = answered, circle = marked for review.
  const PALETTE_SHAPE = {
    'not-visited': 'rounded-md border border-slate-300 bg-slate-100 text-slate-700',
    'not-answered': 'rounded-b-[45%] rounded-t-md bg-[#e5532d] text-white',
    answered: 'rounded-t-[45%] rounded-b-md bg-[#2e9e3f] text-white',
    marked: 'rounded-full bg-[#6b3fa0] text-white',
    'answered-marked': 'rounded-full bg-[#6b3fa0] text-white',
  };
  const PaletteBox = ({ status, children, size = 'h-10 w-10 text-sm', active = false, onClick, label }) => {
    const Tag = onClick ? 'button' : 'span';
    return (
      <Tag
        {...(onClick ? { type: 'button', onClick, 'aria-label': label } : {})}
        className={`relative inline-flex shrink-0 items-center justify-center font-bold tabular-nums transition ${size} ${PALETTE_SHAPE[status]} ${active ? 'ring-2 ring-[#1f4e9c] ring-offset-2' : ''} ${onClick ? 'hover:brightness-110' : ''}`}
      >
        {children}
        {status === 'answered-marked' && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#2e9e3f] ring-2 ring-white">
            <CheckCircle2 size={10} className="text-white" />
          </span>
        )}
      </Tag>
    );
  };

  const palette = (
    <div className="flex h-full flex-col bg-white">
      {/* candidate */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-[#eaf1fb] px-4 py-3">
        {candidatePhoto ? (
          <img src={candidatePhoto} alt={candidateName} className="h-14 w-14 shrink-0 rounded-full border-2 border-white object-cover shadow" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#1f4e9c] text-lg font-bold text-white shadow">
            {String(candidateName).trim().charAt(0).toUpperCase() || 'S'}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{candidateName}</p>
          {candidateClassLabel && <p className="mt-0.5 text-xs font-semibold text-slate-600">Class {candidateClassLabel}</p>}
        </div>
      </div>

      {/* legend with counts */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-2.5 border-b border-slate-200 px-4 py-3">
        {LEGEND.map(([k, l]) => (
          <span key={k} className={`flex items-center gap-2 text-[11px] leading-tight text-slate-700 ${k === 'answered-marked' ? 'col-span-2' : ''}`}>
            <PaletteBox status={k} size="h-7 w-7 text-[11px]">{countBy(k)}</PaletteBox>
            {l}
          </span>
        ))}
      </div>

      {/* current section grid */}
      <div className="bg-[#1f4e9c] px-4 py-2 text-xs font-bold text-white">
        Section {currentSectionIdx + 1}: {currentSection?.meta.label}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f8fd] p-4">
        <p className="mb-3 text-[11px] font-semibold text-slate-500">Choose a question</p>
        <div className="grid grid-cols-5 gap-2.5">
          {(currentSection?.indexes || []).map((qi) => (
            <PaletteBox
              key={qi}
              status={statusOf(qi)}
              active={qi === activeQuestionIndex}
              label={`Question ${qi + 1}`}
              onClick={() => { goToQuestion(qi); setShowPalette(false); }}
            >
              {qi + 1}
            </PaletteBox>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 p-3">
        <button type="button" onClick={() => setConfirmSubmit(true)} className="w-full rounded-md bg-[#2e9e3f] py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#278a36]">
          Submit
        </button>
      </div>
    </div>
  );

  const CBT_BTN = 'inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-4 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div key={attemptKey} className="fixed inset-0 z-[200] flex flex-col bg-[#f0f3f8] text-slate-900">
      <style>{'[data-placeholder]:empty:before{content:attr(data-placeholder)}'}</style>

      {/* title bar */}
      <header className="flex shrink-0 items-center gap-3 bg-[#1f4e9c] px-4 py-2.5 text-white shadow">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight">{topicSlug} — Practice Test</p>
          <p className="truncate text-[11px] text-white/75">{[subjectSlug, chapterTitle].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-[10px] uppercase tracking-wide text-white/70">Time spent</p>
          <p className="font-mono text-sm font-bold tabular-nums">{fmtTime(elapsed)}</p>
        </div>
        <span className="font-mono text-xs font-bold tabular-nums sm:hidden">{fmtTime(elapsed)}</span>
        <button type="button" onClick={closeExam} aria-label="Exit practice" title="Exit practice" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25">
          <X size={16} />
        </button>
      </header>

      {/* section bar */}
      <nav className="flex shrink-0 items-stretch border-b border-[#c9d6ea] bg-white">
        <span className="hidden shrink-0 items-center bg-[#eaf1fb] px-3 text-[11px] font-bold uppercase tracking-wide text-[#1f4e9c] sm:flex">Sections</span>
        {sectionScroll.left && (
          <button type="button" onClick={() => scrollSections(-1)} aria-label="Scroll sections left" className="flex w-9 shrink-0 items-center justify-center border-r border-[#e3eaf5] bg-white text-[#1f4e9c] shadow-[4px_0_6px_-4px_rgba(15,23,42,0.2)] hover:bg-[#f2f6fc]">
            <ChevronLeft size={18} />
          </button>
        )}
        <div ref={sectionsScrollRef} onScroll={updateSectionScroll} className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((s, si) => {
          const done = s.indexes.filter((i) => answeredIndexes.has(i)).length;
          const active = si === currentSectionIdx;
          return (
            <button
              key={s.type}
              type="button"
              onClick={() => goToQuestion(s.indexes[0])}
              data-active-section={active || undefined}
              className={`relative shrink-0 border-r border-[#e3eaf5] px-4 py-2.5 text-[13px] font-semibold transition ${active ? 'bg-[#1f4e9c] text-white' : 'text-slate-700 hover:bg-[#f2f6fc]'}`}
            >
              Section {si + 1}: {s.meta.short}
              <span className={`ml-2 rounded-full px-2 py-px text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{done}/{s.indexes.length}</span>
            </button>
          );
        })}
        </div>
        {sectionScroll.right && (
          <button type="button" onClick={() => scrollSections(1)} aria-label="Scroll sections right" className="flex w-9 shrink-0 items-center justify-center border-l border-[#e3eaf5] bg-white text-[#1f4e9c] shadow-[-4px_0_6px_-4px_rgba(15,23,42,0.2)] hover:bg-[#f2f6fc]">
            <ChevronRight size={18} />
          </button>
        )}
        <button type="button" onClick={() => setShowPalette((v) => !v)} className="shrink-0 border-l border-[#e3eaf5] px-3 text-xs font-bold text-[#1f4e9c] lg:hidden">
          {answeredCount}/{totalQuestions} ▸
        </button>
      </nav>

      <div className="flex min-h-0 flex-1">
        {/* question pane */}
        <main className="flex min-w-0 flex-1 flex-col bg-white lg:m-3 lg:mr-0 lg:rounded-lg lg:border lg:border-[#c9d6ea] lg:shadow-sm">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#c9d6ea] px-5 py-3">
            <p className="text-base font-bold text-slate-900">Question No. {activeQuestionIndex + 1}</p>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2 text-[11px] font-semibold">
              <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{Number(current?.points) > 0 ? Number(current.points) : 1} Point{Number(current?.points) > 1 ? 's' : ''}</span>
              <span className="rounded bg-[#eaf1fb] px-2 py-1 text-[#1f4e9c]">{typeMeta(current?.type).label}</span>
              <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{posInSection + 1} of {currentSection?.indexes.length || 1} in Section {currentSectionIdx + 1}</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-[15px] leading-relaxed sm:px-8">
            <div className="mx-auto max-w-[860px]">
              {/* All questions stay mounted (hidden) so answers survive moving around. */}
              {assignedTryouts.map((question, index) => (
                <div key={`${question.id || index}-${clearKeys[index] || 0}`} className={index === activeQuestionIndex ? '' : 'hidden'}>
                  <TryoutQuestion question={question} index={index} onAnswer={(ans) => handleAnswer(index, ans)} />
                </div>
              ))}
            </div>
          </div>

          {/* action bar */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#c9d6ea] bg-[#f7f9fc] px-4 py-3 lg:rounded-b-lg">
            <button type="button" onClick={markAndNext} className={`${CBT_BTN} border border-[#6b3fa0] bg-white text-[#6b3fa0] hover:bg-[#f4effa]`}>
              Mark for Review &amp; Next
            </button>
            <button type="button" onClick={clearResponse} className={`${CBT_BTN} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
              Clear Response
            </button>
            {lastSavedAt && <span className="hidden text-[11px] text-slate-400 md:inline">Saved {formatAgo(lastSavedAt)}</span>}
            <div className="ml-auto flex items-center gap-2">
              <button type="button" disabled={activeQuestionIndex === 0} onClick={() => goToQuestion(activeQuestionIndex - 1)} className={`${CBT_BTN} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
                <ArrowLeft size={15} /> Previous
              </button>
              <button type="button" onClick={saveAndNext} className={`${CBT_BTN} min-w-[130px] bg-[#1f4e9c] text-white shadow-sm hover:bg-[#1a4285]`}>
                {isLast ? 'Save & Finish' : <>Save &amp; Next <ArrowRight size={15} /></>}
              </button>
            </div>
          </div>
        </main>

        {/* palette: side panel on desktop, drawer on mobile */}
        <aside className="m-3 hidden w-[300px] shrink-0 overflow-hidden rounded-lg border border-[#c9d6ea] shadow-sm lg:block">{palette}</aside>
        {showPalette && (
          <div className="fixed inset-0 z-[210] flex justify-end bg-black/30 lg:hidden" onClick={() => setShowPalette(false)}>
            <aside className="h-full w-[300px] max-w-[85vw] shadow-xl" onClick={(e) => e.stopPropagation()}>{palette}</aside>
          </div>
        )}
      </div>

      {/* submit confirmation */}
      {confirmSubmit && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="bg-[#1f4e9c] px-5 py-3 text-sm font-bold text-white">Exam Summary</div>
            <div className="p-5">
              <table className="w-full border border-slate-200 text-left text-xs">
                <thead className="bg-[#eaf1fb] text-[#1f4e9c]">
                  <tr>
                    <th className="border-b border-slate-200 px-2 py-2">Section</th>
                    <th className="border-b border-slate-200 px-2 py-2 text-center">Total</th>
                    <th className="border-b border-slate-200 px-2 py-2 text-center">Answered</th>
                    <th className="border-b border-slate-200 px-2 py-2 text-center">Not answered</th>
                    <th className="border-b border-slate-200 px-2 py-2 text-center">Marked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sections.map((s, si) => {
                    const ans = s.indexes.filter((i) => answeredIndexes.has(i)).length;
                    return (
                      <tr key={s.type}>
                        <td className="px-2 py-2 font-semibold text-slate-700">{si + 1}. {s.meta.short}</td>
                        <td className="px-2 py-2 text-center">{s.indexes.length}</td>
                        <td className="px-2 py-2 text-center font-semibold text-[#2e9e3f]">{ans}</td>
                        <td className="px-2 py-2 text-center font-semibold text-[#e5532d]">{s.indexes.length - ans}</td>
                        <td className="px-2 py-2 text-center font-semibold text-[#6b3fa0]">{s.indexes.filter((i) => markedIndexes.has(i)).length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-4 text-sm text-slate-700">Are you sure you want to submit? {answeredCount < totalQuestions && <span className="font-semibold text-[#e5532d]">{totalQuestions - answeredCount} unanswered.</span>}</p>
              {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-[#f7f9fc] px-5 py-3">
              <button type="button" onClick={() => setConfirmSubmit(false)} className={`${CBT_BTN} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>No, go back</button>
              <button type="button" disabled={submitting} onClick={handleSubmit} className={`${CBT_BTN} bg-[#2e9e3f] text-white hover:bg-[#278a36]`}>
                {submitting ? 'Submitting…' : 'Yes, submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

AILearningTryoutSection.displayName = 'AILearningTryoutSection';

export default AILearningTryoutSection;
