import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion, useInView, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  FileText,
  Target,
  Bot,
  Pencil,
  Code2,
  Layers3,
  ClipboardCheck,
  Flame,
  Sparkles,
  Mic,
  Send,
  Rocket,
  Trophy,
  Star,
  GraduationCap,
  Calculator,
  Atom,
  BookText,
  Globe2,
  ScrollText,
  Cpu,
  Clock,
  Zap,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  NotebookPen,
  ListChecks,
  PlayCircle,
  ChevronRight,
  Paperclip,
  Gamepad2,
  Lightbulb,
  Languages,
  Network,
  MessageCircleQuestion,
  TrendingDown,
  Gift,
  Coins,
  Crown,
  LockKeyhole,
  CircleCheck,
  Play,
  CalendarCheck2,
  Circle,
  Plus,
  Minus,
  ChevronLeft,
  ChevronDown,
  Copy,
  Check,
  RotateCw,
  History,
  Trash2,
  MessageSquarePlus,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { fetchCachedJson } from '@/utils/studentApiCache';
import { useStudentDashboard } from './StudentDashboardContext';
import { saveLearningActivity } from '../utils/learningContinuity';
import {
  createConversationId,
  deleteTutorConversation,
  formatConversationAge,
  listTutorConversations,
  saveTutorConversation,
} from '../utils/tutorChatHistory';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

const CHIP_MODES = {
  "Explain Like I'm 10": 'explain',
  'Give Example': 'explain',
  'Create Quiz': 'quiz',
  'Simplify Notes': 'notes',
  'Mind Map': 'mind_map',
  Flashcards: 'flashcards',
  'Homework Help': 'homework_help',
};

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
const STREAM_TOKEN_DELAY_MS = 18;
const GENERATED_STUDY_MEMORY_KEY = 'aiTutorGeneratedStudyMemory:v1';
const MAX_GENERATED_STUDY_ITEMS = 8;

const splitStreamTokens = (text) => String(text || '').match(/\S+\s*/g) || [];

const GENERATED_MODE_META = {
  quiz: { label: 'Quiz', icon: Target },
  flashcards: { label: 'Flashcards', icon: Layers3 },
  mind_map: { label: 'Mind map', icon: Network },
  notes: { label: 'Notes', icon: NotebookPen },
  explain: { label: 'Explanation', icon: Lightbulb },
  homework_help: { label: 'Homework help', icon: MessageCircleQuestion },
};

const getGeneratedModeMeta = (mode) => GENERATED_MODE_META[mode] || { label: 'Tutor answer', icon: Bot };

const loadGeneratedStudyMemory = () => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(GENERATED_STUDY_MEMORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, MAX_GENERATED_STUDY_ITEMS) : [];
  } catch {
    return [];
  }
};

const saveGeneratedStudyMemory = (items) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GENERATED_STUDY_MEMORY_KEY, JSON.stringify(items));
  } catch {
    // Storage can fail in private browsing or when quota is full.
  }
};

const buildGeneratedStudyItem = ({ mode, subject, topic, prompt, content }) => {
  const meta = getGeneratedModeMeta(mode);
  const cleanedPrompt = String(prompt || '').trim();
  const cleanedTopic = String(topic || '').trim();
  const cleanedSubject = String(subject || '').trim();
  const titleBase = cleanedTopic || cleanedPrompt || meta.label;
  return {
    id: `generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode,
    typeLabel: meta.label,
    title: `${meta.label}: ${titleBase}`.slice(0, 90),
    subject: cleanedSubject,
    topic: cleanedTopic,
    prompt: cleanedPrompt,
    content: String(content || '').trim(),
    generatedAt: new Date().toISOString(),
  };
};

const formatGeneratedTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const renderInlineTutorText = (text, keyPrefix) => {
  const parts = String(text || '').split(URL_PATTERN);

  return parts.flatMap((part, index) => {
    if (!part) return [];

    if (part.startsWith('http://') || part.startsWith('https://')) {
      const [, url, trailing = ''] = part.match(/^(.*?)([),.;:!?]*)$/) || [];
      return [
        <a
          key={`${keyPrefix}-url-${index}`}
          href={url || part}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 break-all hover:text-sky-900"
        >
          {url || part}
        </a>,
        trailing ? <React.Fragment key={`${keyPrefix}-trail-${index}`}>{trailing}</React.Fragment> : null,
      ].filter(Boolean);
    }

    return part.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((segment, segmentIndex) => {
      if (segment.startsWith('**') && segment.endsWith('**')) {
        return <strong key={`${keyPrefix}-b-${index}-${segmentIndex}`}>{segment.slice(2, -2)}</strong>;
      }
      return <React.Fragment key={`${keyPrefix}-t-${index}-${segmentIndex}`}>{segment}</React.Fragment>;
    });
  });
};

const TutorMessageContent = ({ text }) => {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');

  return (
    <div className="space-y-1.5 break-words text-sm leading-relaxed">
      {lines.map((line, index) => {
        const raw = line || '';
        const trimmed = raw.trim();
        const indent = Math.min(3, Math.floor((raw.match(/^\s*/)?.[0]?.length || 0) / 2));

        if (!trimmed) {
          return <div key={`blank-${index}`} className="h-1.5" />;
        }

        const headingMatch = trimmed.match(/^\*\*(.+)\*\*$/);
        if (headingMatch) {
          return (
            <div key={`heading-${index}`} className="pt-1 text-[15px] font-semibold text-slate-900">
              {headingMatch[1]}
            </div>
          );
        }

        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
          return (
            <div key={`numbered-${index}`} className="grid grid-cols-[auto_1fr] gap-2 pt-1">
              <span className="font-semibold text-sky-700">{numberedMatch[1]}.</span>
              <span>{renderInlineTutorText(numberedMatch[2], `numbered-${index}`)}</span>
            </div>
          );
        }

        const optionMatch = trimmed.match(/^([A-D])\)\s+(.*)$/);
        if (optionMatch) {
          return (
            <div key={`option-${index}`} className="grid grid-cols-[auto_1fr] gap-2 pl-4">
              <span className="font-semibold text-slate-600">{optionMatch[1]})</span>
              <span>{renderInlineTutorText(optionMatch[2], `option-${index}`)}</span>
            </div>
          );
        }

        const answerMatch = trimmed.match(/^Answer:\s*(.*)$/i);
        if (answerMatch) {
          return (
            <div key={`answer-${index}`} className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-medium text-emerald-800">
              Answer: {renderInlineTutorText(answerMatch[1], `answer-${index}`)}
            </div>
          );
        }

        const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={`bullet-${index}`} className="grid grid-cols-[auto_1fr] gap-2" style={{ paddingLeft: `${indent * 14}px` }}>
              <span className="mt-2 size-1.5 rounded-full bg-sky-400" />
              <span>{renderInlineTutorText(bulletMatch[1], `bullet-${index}`)}</span>
            </div>
          );
        }

        return (
          <div key={`line-${index}`} style={{ paddingLeft: `${indent * 14}px` }}>
            {renderInlineTutorText(trimmed, `line-${index}`)}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Mode-specific parsers
// ---------------------------------------------------------------------------

function parseQuiz(text) {
  const questions = [];
  const lines = (text || '').split('\n');
  let current = null;
  for (const line of lines) {
    const t = line.trim();
    const qMatch = t.match(/^\d+[.)]\s+(.+)/);
    const optMatch = t.match(/^([A-D])[.)]\s+(.+)/);
    const ansMatch = t.match(/^[*_]*Answer[*_]*:\s*\*?([A-D])\*?/i);
    if (qMatch) {
      if (current) questions.push(current);
      current = { question: qMatch[1], options: {}, answer: null };
    } else if (optMatch && current) {
      current.options[optMatch[1]] = optMatch[2];
    } else if (ansMatch && current) {
      current.answer = ansMatch[1].toUpperCase();
    }
  }
  if (current) questions.push(current);
  return questions.filter(q => Object.keys(q.options).length >= 2);
}

function parseFlashcards(text) {
  const cards = [];
  let q = null, a = null;
  const push = () => {
    if (q !== null && a !== null) cards.push({ q: q.trim(), a: a.trim() });
    q = null; a = null;
  };
  for (const raw of (text || '').split('\n')) {
    // Normalise: strip bullets, markdown bold, and "1." / "Card 2:" prefixes.
    const t = raw.trim()
      .replace(/\*\*/g, '')
      .replace(/^[-*>•]\s*/, '')
      .replace(/^(?:card\s*)?\d+\s*[:.)-]\s*/i, '');
    if (!t) continue;
    const qMatch = t.match(/^(?:q(?:uestion)?|front)\s*\d*\s*[:.)\-–]\s*(.+)/i);
    const aMatch = t.match(/^(?:a(?:nswer)?|back)\s*\d*\s*[:.)\-–]\s*(.+)/i);
    if (qMatch) {
      push();
      q = qMatch[1]; a = null;
    } else if (aMatch && q !== null) {
      a = a === null ? aMatch[1] : `${a} ${aMatch[1]}`;
    } else if (a !== null) {
      a += ` ${t}`; // multi-line answer continuation
    } else if (q !== null) {
      q += ` ${t}`; // multi-line question continuation
    }
  }
  push();
  return cards;
}

// ---------------------------------------------------------------------------
// Quiz UI
// ---------------------------------------------------------------------------

function QuizUI({ text }) {
  const questions = useMemo(() => parseQuiz(text), [text]);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState({});
  const [shown, setShown] = useState({});
  const [done, setDone] = useState(false);

  if (!questions.length) return <TutorMessageContent text={text} />;

  if (done) {
    const correct = questions.filter((q, i) => picks[i] === q.answer).length;
    const emoji = correct === questions.length ? '🎉' : correct >= Math.ceil(questions.length / 2) ? '👍' : '📚';
    return (
      <Motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50 p-6 text-center"
      >
        <p className="text-4xl mb-1">{emoji}</p>
        <p className="text-3xl font-extrabold text-violet-800">{correct}/{questions.length}</p>
        <p className="text-sm text-violet-600 mt-1">Questions correct</p>
        <button
          onClick={() => { setIdx(0); setPicks({}); setShown({}); setDone(false); }}
          className="mt-4 rounded-xl bg-violet-500 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-600 transition-colors"
        >
          Try Again
        </button>
      </Motion.div>
    );
  }

  const q = questions[idx];
  const picked = picks[idx];
  const isShown = shown[idx];
  const isCorrect = picked === q.answer;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-violet-500">Q {idx + 1}/{questions.length}</span>
        <div className="flex gap-1">
          {questions.map((q2, i) => (
            <div
              key={i}
              className={cn('h-1.5 rounded-full transition-all duration-300',
                i < idx
                  ? (picks[i] === questions[i].answer ? 'w-6 bg-emerald-400' : 'w-6 bg-rose-300')
                  : i === idx ? 'w-6 bg-violet-500' : 'w-4 bg-slate-200'
              )}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <Motion.div
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border border-violet-100 bg-violet-50/70 p-4"
        >
          <p className="text-sm font-semibold leading-relaxed text-slate-800">{q.question}</p>
        </Motion.div>
      </AnimatePresence>

      <div className="space-y-2">
        {Object.entries(q.options).map(([letter, optText]) => {
          const isPicked = picked === letter;
          const isAnswer = letter === q.answer;
          let cls = 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/50';
          if (isShown) {
            if (isAnswer) cls = 'border-emerald-300 bg-emerald-50';
            else if (isPicked) cls = 'border-rose-300 bg-rose-50';
          } else if (isPicked) {
            cls = 'border-violet-400 bg-violet-50 shadow-sm';
          }
          return (
            <Motion.button
              key={letter}
              whileHover={!isShown ? { scale: 1.01 } : {}}
              whileTap={!isShown ? { scale: 0.99 } : {}}
              disabled={isShown}
              onClick={() => !isShown && setPicks(p => ({ ...p, [idx]: letter }))}
              className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors', cls)}
            >
              <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                isShown && isAnswer ? 'bg-emerald-500 text-white' :
                isShown && isPicked ? 'bg-rose-400 text-white' :
                isPicked ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-500'
              )}>{letter}</span>
              <span className="flex-1 text-sm text-slate-700">{optText}</span>
              {isShown && isAnswer && <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />}
            </Motion.button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1">
        {!isShown ? (
          <button
            disabled={!picked}
            onClick={() => setShown(s => ({ ...s, [idx]: true }))}
            className="rounded-xl bg-violet-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-40 transition-colors"
          >
            Check Answer
          </button>
        ) : (
          <>
            <span className={cn('flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold',
              isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            )}>
              {isCorrect ? '✓ Correct!' : `✗ Answer: ${q.answer}`}
            </span>
            <button
              onClick={() => idx < questions.length - 1 ? setIdx(i => i + 1) : setDone(true)}
              className="rounded-xl bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 transition-colors"
            >
              {idx < questions.length - 1 ? 'Next →' : 'Finish'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flashcard UI
// ---------------------------------------------------------------------------

const cardSlide = {
  enter: (dir) => ({ x: dir * 240, opacity: 0, rotate: dir * 3 }),
  center: { x: 0, opacity: 1, rotate: 0 },
  exit: (dir) => ({ x: dir * -240, opacity: 0, rotate: dir * -3 }),
};

function FlashcardUI({ text }) {
  const cards = useMemo(() => parseFlashcards(text), [text]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dir, setDir] = useState(0);
  const [known, setKnown] = useState({});

  const goTo = useCallback((next) => {
    setIdx((current) => {
      const clamped = Math.max(0, Math.min(cards.length - 1, next));
      if (clamped !== current) {
        setDir(clamped > current ? 1 : -1);
        setFlipped(false);
      }
      return clamped;
    });
  }, [cards.length]);

  useEffect(() => {
    if (!cards.length) return;
    const onKey = (e) => {
      // Never hijack keys while the student is typing somewhere.
      const el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'ArrowRight') goTo(idx + 1);
      else if (e.key === 'ArrowLeft') goTo(idx - 1);
      else if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, cards.length, goTo]);

  if (!cards.length) return <TutorMessageContent text={text} />;

  const card = cards[idx];
  const knownCount = Object.values(known).filter(Boolean).length;
  const rateCard = (gotIt) => {
    setKnown((k) => ({ ...k, [idx]: gotIt }));
    goTo(idx + 1);
  };

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#F59E0B]">Card {idx + 1} / {cards.length}</span>
        <span className="text-[11px] font-medium text-[#78827B]">
          <span className="font-bold text-[#F59E0B]">{knownCount}</span> / {cards.length} known
        </span>
      </div>

      {/* Progress dots — clickable */}
      <div className="flex flex-wrap gap-1.5">
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to card ${i + 1}`}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === idx ? 'w-8 bg-[#F59E0B]' : known[i] ? 'w-5 bg-[#8fbcae]' : 'w-4 bg-[#E7E3D9]'
            )}
          />
        ))}
      </div>

      {/* Deck — swipe left/right, tap to flip */}
      <div className="relative h-56 select-none" style={{ perspective: '1400px' }}>
        {/* Stacked cards behind, hinting at the deck */}
        {idx < cards.length - 1 && (
          <div className="absolute inset-x-3 bottom-0 top-2 rotate-[1.6deg] rounded-2xl border border-[#E7E3D9] bg-[#FBF9F4]" />
        )}
        {idx < cards.length - 2 && (
          <div className="absolute inset-x-5 bottom-0 top-4 -rotate-[1.2deg] rounded-2xl border border-[#E7E3D9] bg-[#F4F1EA]" />
        )}

        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <Motion.div
            key={idx}
            custom={dir}
            variants={cardSlide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.26, ease: 'easeOut' }}
            drag={cards.length > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.55}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70 || info.velocity.x < -450) goTo(idx + 1);
              else if (info.offset.x > 70 || info.velocity.x > 450) goTo(idx - 1);
            }}
            onTap={() => setFlipped((f) => !f)}
            whileDrag={{ scale: 1.02 }}
            className="absolute inset-0 cursor-pointer"
          >
            <Motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              style={{ transformStyle: 'preserve-3d', position: 'relative', width: '100%', height: '100%' }}
            >
              {/* Front — Question */}
              <div
                style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#E7E3D9] bg-white p-6 text-center shadow-[0_10px_30px_-18px_rgba(38,51,46,0.45)]"
              >
                <span className="rounded-full bg-[#FEF3C7] px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#F59E0B]">
                  Question
                </span>
                <p className="font-[Nunito] text-base font-bold leading-relaxed text-[#26332E]">{card.q}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#a3aaa2]">
                  <RotateCw className="size-3" />
                  <span>Tap to flip · swipe to browse</span>
                </p>
              </div>

              {/* Back — Answer */}
              <div
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0 }}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#F59E0B] p-6 text-center shadow-[0_10px_30px_-18px_rgba(38,51,46,0.6)]"
              >
                <span className="rounded-full bg-white/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#FDE9BD]">
                  Answer
                </span>
                <p className="font-[Nunito] text-base font-bold leading-relaxed text-white">{card.a}</p>
                <p className="mt-1 text-[11px] text-white/50">Tap to see the question again</p>
              </div>
            </Motion.div>
          </Motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => goTo(idx - 1)}
          disabled={idx === 0}
          aria-label="Previous card"
          className="flex items-center gap-1 rounded-xl border border-[#E7E3D9] bg-white px-3 py-1.5 text-xs font-semibold text-[#5c655f] transition-colors hover:bg-[#FEF3C7] disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" /> Prev
        </button>

        <AnimatePresence mode="wait">
          {flipped ? (
            <Motion.div
              key="rating"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18 }}
              className="flex flex-1 gap-2"
            >
              <button
                onClick={() => rateCard(false)}
                className="flex-1 rounded-xl border border-[#eedbc9] bg-[#F4E9DE] py-1.5 text-xs font-bold text-[#C07A4C] transition-colors hover:bg-[#eeddcb]"
              >
                ✗ Still learning
              </button>
              <button
                onClick={() => rateCard(true)}
                className="flex-1 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] py-1.5 text-xs font-bold text-[#B45309] transition-colors hover:bg-[#FDE9BD]"
              >
                ✓ Got it!
              </button>
            </Motion.div>
          ) : (
            <Motion.div key="spacer" className="flex-1" />
          )}
        </AnimatePresence>

        <button
          onClick={() => goTo(idx + 1)}
          disabled={idx === cards.length - 1}
          aria-label="Next card"
          className="flex items-center gap-1 rounded-xl border border-[#E7E3D9] bg-white px-3 py-1.5 text-xs font-semibold text-[#5c655f] transition-colors hover:bg-[#FEF3C7] disabled:opacity-40"
        >
          Next <ChevronRight className="size-3.5" />
        </button>
      </div>

      <p className="text-center text-[10px] text-[#a3aaa2]">← → to navigate · Space or tap to flip · drag the card to swipe</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mind Map UI — visual node graph
// ---------------------------------------------------------------------------

function parseMindMap(text) {
  // Keep raw lines so we can measure leading-space depth.
  const lines = (text || '').split('\n');
  let root = 'Topic';
  const branches = [];
  let currentBranch = null;
  let rootSet = false;

  const stripMarkdown = (s) =>
    s.replace(/^#{1,6}\s*/, '')
     .replace(/^[-*+•]\s*/, '')
     .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
     .trim();

  for (const line of lines) {
    if (!line.trim()) continue;

    const indent = (line.match(/^(\s*)/)?.[1] ?? '').length;
    const trimmed = line.trim();
    const clean = stripMarkdown(trimmed);
    if (!clean) continue;

    // "Mind Map — Chapter Name" → extract chapter name as root
    if (/^mind\s*map/i.test(clean)) {
      const m = clean.match(/mind\s*map\s*[—–\-:]\s*(.+)/i);
      root = m ? m[1].trim() : clean;
      rootSet = true;
      continue;
    }

    // 0-indent non-bullet → branch heading (or initial root)
    if (indent === 0) {
      if (!rootSet && !branches.length) {
        // Skip bare "Topic" placeholder
        if (!/^topic$/i.test(clean)) { root = clean; rootSet = true; }
        continue;
      }
      // Skip repeated root or "Topic" placeholder
      if (/^topic$/i.test(clean) || clean === root) continue;
      currentBranch = { title: clean, items: [] };
      branches.push(currentBranch);
    } else {
      // Indented or bulleted → item under current branch
      if (!currentBranch) {
        currentBranch = { title: root, items: [] };
        branches.push(currentBranch);
      }
      // Deeper indent (≥ 6 spaces) = sub-item
      if (indent >= 6 && currentBranch.items.length) {
        const last = currentBranch.items[currentBranch.items.length - 1];
        if (typeof last === 'object') last.sub = [...(last.sub || []), clean];
        else currentBranch.items[currentBranch.items.length - 1] = { label: last, sub: [clean] };
      } else {
        currentBranch.items.push(clean);
      }
    }
  }

  return { root, branches: branches.length ? branches : [{ title: 'Overview', items: [] }] };
}

const BRANCH_PALETTE = [
  { bg: 'bg-sky-50',     border: 'border-sky-200',     titleBg: 'bg-sky-500',     hex: '#0ea5e9' },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  titleBg: 'bg-violet-500',  hex: '#8b5cf6' },
  { bg: 'bg-rose-50',    border: 'border-rose-200',    titleBg: 'bg-rose-500',    hex: '#f43f5e' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', titleBg: 'bg-emerald-500', hex: '#10b981' },
  { bg: 'bg-amber-50',   border: 'border-amber-200',   titleBg: 'bg-amber-500',   hex: '#f59e0b' },
  { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', titleBg: 'bg-fuchsia-500', hex: '#d946ef' },
  { bg: 'bg-teal-50',    border: 'border-teal-200',    titleBg: 'bg-teal-500',    hex: '#14b8a6' },
  { bg: 'bg-orange-50',  border: 'border-orange-200',  titleBg: 'bg-orange-500',  hex: '#f97316' },
];

// Circular +/− expand toggle that sits on a node's right edge (NotebookLM style)
function NodeToggle({ open, hex, onToggle }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="absolute -right-2.5 top-1/2 z-20 flex size-5 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-sm transition-transform hover:scale-110"
      style={{ borderColor: hex, color: hex }}
    >
      {open ? <Minus className="size-3" strokeWidth={3} /> : <Plus className="size-3" strokeWidth={3} />}
    </button>
  );
}

function MindMapUI({ text }) {
  const { root, branches } = useMemo(() => parseMindMap(text), [text]);
  const scrollRef = useRef(null);       // pannable viewport
  const containerRef = useRef(null);    // inner canvas (sizes to content)
  const nodeRefs = useRef({});          // node id -> DOM element
  const [expanded, setExpanded] = useState(() => new Set());
  const [svgPaths, setSvgPaths] = useState([]);

  // Drag-to-pan bookkeeping
  const pan = useRef({ active: false, startX: 0, startY: 0, left: 0, top: 0, moved: false });

  const toggle = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setExpandAll = useCallback((open) => {
    if (!open) { setExpanded(new Set()); return; }
    const all = new Set(['root']);
    branches.forEach((_, i) => all.add(`b${i}`));
    setExpanded(all);
  }, [branches]);

  const rootOpen = expanded.has('root');

  // Edges that are currently visible, given the expansion state.
  const visibleEdges = useMemo(() => {
    const edges = [];
    if (!rootOpen) return edges;
    branches.forEach((branch, i) => {
      const color = BRANCH_PALETTE[i % BRANCH_PALETTE.length].hex;
      edges.push({ parent: 'root', child: `b${i}`, color, key: `root-b${i}` });
      if (expanded.has(`b${i}`)) {
        (branch.items || []).forEach((_, j) => {
          edges.push({ parent: `b${i}`, child: `b${i}-i${j}`, color, key: `b${i}-i${j}` });
        });
      }
    });
    return edges;
  }, [branches, expanded, rootOpen]);

  // Horizontal connectors: parent right edge → child left edge.
  const recalc = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    if (cRect.width === 0) return;

    const paths = visibleEdges
      .map((edge) => {
        const pEl = nodeRefs.current[edge.parent];
        const cEl = nodeRefs.current[edge.child];
        if (!pEl || !cEl) return null;
        const p = pEl.getBoundingClientRect();
        const c = cEl.getBoundingClientRect();
        const px = p.right - cRect.left;
        const py = p.top   - cRect.top + p.height / 2;
        const cx = c.left  - cRect.left;
        const cy = c.top   - cRect.top + c.height / 2;
        const mid = px + (cx - px) * 0.5;
        return {
          d: `M ${px} ${py} C ${mid} ${py}, ${mid} ${cy}, ${cx} ${cy}`,
          color: edge.color,
          key: edge.key,
        };
      })
      .filter(Boolean);

    setSvgPaths(paths);
  }, [visibleEdges]);

  // Re-measure connectors as nodes mount / animate in and on layout changes.
  useEffect(() => {
    const timers = [0, 120, 260, 440, 650].map((t) => setTimeout(recalc, t));
    const ro = new ResizeObserver(recalc);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', recalc);
    return () => {
      timers.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener('resize', recalc);
    };
  }, [recalc, expanded]);

  // --- Drag-to-pan handlers (skip clicks so node toggles still fire) ---
  const onPointerDown = (e) => {
    const el = scrollRef.current;
    if (!el) return;
    pan.current = {
      active: true, moved: false,
      startX: e.clientX, startY: e.clientY,
      left: el.scrollLeft, top: el.scrollTop,
    };
  };
  const onPointerMove = (e) => {
    const el = scrollRef.current;
    if (!el || !pan.current.active) return;
    const dx = e.clientX - pan.current.startX;
    const dy = e.clientY - pan.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) pan.current.moved = true;
    el.scrollLeft = pan.current.left - dx;
    el.scrollTop = pan.current.top - dy;
  };
  const endPan = () => { pan.current.active = false; };
  // Swallow the click that follows a drag so a pan doesn't toggle a node.
  const guardedToggle = (id) => {
    if (pan.current.moved) { pan.current.moved = false; return; }
    toggle(id);
  };

  return (
    <div className="relative w-full">
      {/* Hint + expand controls */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400">Click a node or ± to expand · drag to pan</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setExpandAll(true)}
            className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Expand all
          </button>
          <button
            onClick={() => setExpandAll(false)}
            className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Collapse
          </button>
        </div>
      </div>

      {/* Pannable viewport */}
      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerLeave={endPan}
        className="relative max-h-[460px] overflow-auto rounded-xl border border-slate-100 bg-slate-50/40 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      >
        <div ref={containerRef} className="relative inline-block min-w-full p-6">
          {/* SVG overlay — sized to the inner canvas, overflow visible so lines never clip */}
          <svg
            className="pointer-events-none absolute inset-0"
            style={{ width: '100%', height: '100%', overflow: 'visible', zIndex: 0 }}
          >
            <AnimatePresence>
              {svgPaths.map((p) => (
                <Motion.path
                  key={p.key}
                  d={p.d}
                  stroke={p.color}
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.55 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              ))}
            </AnimatePresence>
          </svg>

          {/* Horizontal tree: root → branch column → item column */}
          <div className="relative z-10 flex items-center gap-14">
            {/* Root node */}
            <Motion.div
              ref={(el) => { nodeRefs.current.root = el; }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="relative shrink-0"
            >
              <button
                type="button"
                onClick={() => guardedToggle('root')}
                className="flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-2.5 shadow-lg hover:bg-slate-700 transition-colors"
              >
                <Network className="size-4 text-white/70" />
                <span className="text-sm font-bold tracking-wide text-white">{root}</span>
              </button>
              {branches.length > 0 && (
                <NodeToggle open={rootOpen} hex="#334155" onToggle={() => toggle('root')} />
              )}
            </Motion.div>

            {/* Branch column */}
            <AnimatePresence>
              {rootOpen && (
                <Motion.div
                  key="branches"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex shrink-0 flex-col justify-center gap-4"
                >
                  {branches.map((branch, i) => {
                    const pal = BRANCH_PALETTE[i % BRANCH_PALETTE.length];
                    const items = branch.items || [];
                    const bId = `b${i}`;
                    const open = expanded.has(bId);
                    return (
                      <div key={i} className="flex items-center gap-14">
                        {/* Branch node */}
                        <Motion.div
                          ref={(el) => { nodeRefs.current[bId] = el; }}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: 0.05 + i * 0.04 }}
                          className="relative shrink-0"
                        >
                          <button
                            type="button"
                            onClick={() => items.length && guardedToggle(bId)}
                            className={cn(
                              'flex max-w-[200px] items-center gap-1.5 rounded-xl border px-3 py-2 shadow-sm transition-colors',
                              pal.bg, pal.border, items.length ? 'cursor-pointer hover:brightness-95' : 'cursor-default'
                            )}
                            style={{ borderLeftWidth: 3, borderLeftColor: pal.hex }}
                          >
                            <span className="text-[11px] font-bold uppercase tracking-wide leading-tight text-slate-700 text-left">
                              {branch.title}
                            </span>
                          </button>
                          {items.length > 0 && (
                            <NodeToggle open={open} hex={pal.hex} onToggle={() => toggle(bId)} />
                          )}
                        </Motion.div>

                        {/* Item column */}
                        <AnimatePresence>
                          {open && items.length > 0 && (
                            <Motion.div
                              key="items"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex shrink-0 flex-col justify-center gap-1.5"
                            >
                              {items.map((item, j) => {
                                const label = typeof item === 'object' ? item.label : item;
                                const sub   = typeof item === 'object' ? (item.sub || []) : [];
                                return (
                                  <Motion.div
                                    key={j}
                                    ref={(el) => { nodeRefs.current[`${bId}-i${j}`] = el; }}
                                    initial={{ opacity: 0, x: -8, scale: 0.95 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    transition={{ duration: 0.22, delay: j * 0.03 }}
                                    className="max-w-[240px] shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm"
                                  >
                                    <span className="text-[11px] leading-relaxed text-slate-700">{label}</span>
                                    {sub.map((s, k) => (
                                      <div key={k} className="mt-0.5 flex items-start gap-1">
                                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-300" />
                                        <span className="text-[10px] leading-relaxed text-slate-500">{s}</span>
                                      </div>
                                    ))}
                                  </Motion.div>
                                );
                              })}
                            </Motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </Motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes UI
// ---------------------------------------------------------------------------

const stripTutorMarkdown = (value) => String(value || '')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/^#{1,6}\s*/, '')
  .trim();

const isLikelyNotesHeading = (line, nextLine = '') => {
  const text = stripTutorMarkdown(line);
  if (!text || !nextLine.trim()) return false;
  if (/^\d+[.)]/.test(text) || /^[a-z][.)]\s/i.test(text)) return false;
  if (/[.!?;:]$/.test(text)) return false;
  if (text.length > 72) return false;
  if (/^(new words|tasks to do)$/i.test(text)) return false;
  return /^[A-Z0-9]/.test(text);
};

const normalizeTaskSignature = (task) => {
  const body = [task.title, ...task.items]
    .map((item) => stripTutorMarkdown(item).toLowerCase().replace(/\s+/g, ' ').trim())
    .join('|');
  return body.replace(/^[a-z][.)]\s*/gm, '');
};

const classifyTask = (title) => {
  const text = title.toLowerCase();
  if (/answer|factual|question/.test(text)) return { label: 'Questions', tone: 'sky' };
  if (/think|discuss|share|views/.test(text)) return { label: 'Discuss', tone: 'violet' };
  if (/complete|fill|tense|sentence|blank/.test(text)) return { label: 'Practice', tone: 'emerald' };
  if (/listen|repeat|pronounce|read/.test(text)) return { label: 'Reading', tone: 'amber' };
  if (/draw|make|choose|find out|self-assessment/.test(text)) return { label: 'Activity', tone: 'rose' };
  return { label: 'Task', tone: 'slate' };
};

const TASK_TONE_CLASS = {
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
};

function parseNotesResponse(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
  const parsed = {
    title: 'Study Notes',
    subtitle: '',
    sections: [],
    words: [],
    tasks: [],
    duplicateCount: 0,
  };

  let index = 0;
  if (lines[index]) {
    parsed.title = stripTutorMarkdown(lines[index]);
    index += 1;
  }
  if (lines[index] && /study notes/i.test(lines[index])) {
    parsed.subtitle = stripTutorMarkdown(lines[index]);
    index += 1;
  }

  let mode = 'sections';
  let currentSection = null;
  let currentTask = null;

  const flushSection = () => {
    if (currentSection && (currentSection.heading || currentSection.lines.length)) {
      parsed.sections.push(currentSection);
    }
    currentSection = null;
  };

  const flushTask = () => {
    if (currentTask) parsed.tasks.push(currentTask);
    currentTask = null;
  };

  for (; index < lines.length; index += 1) {
    const clean = stripTutorMarkdown(lines[index]);

    if (/^new words$/i.test(clean)) {
      flushSection();
      flushTask();
      mode = 'words';
      continue;
    }
    if (/^tasks to do$/i.test(clean)) {
      flushSection();
      flushTask();
      mode = 'tasks';
      continue;
    }

    if (mode === 'words') {
      parsed.words.push(clean.replace(/^[-*+]\s*/, ''));
      continue;
    }

    if (mode === 'tasks') {
      const taskMatch = clean.match(/^(\d+)\.\s*(.+)$/);
      if (taskMatch) {
        flushTask();
        currentTask = { number: taskMatch[1], title: taskMatch[2], items: [] };
        continue;
      }
      if (!currentTask) currentTask = { number: String(parsed.tasks.length + 1), title: clean, items: [] };
      currentTask.items.push(clean);
      continue;
    }

    if (isLikelyNotesHeading(clean, lines[index + 1] || '')) {
      flushSection();
      currentSection = { heading: clean, lines: [] };
      continue;
    }

    if (!currentSection) currentSection = { heading: '', lines: [] };
    currentSection.lines.push(clean);
  }

  flushSection();
  flushTask();

  const seenTasks = new Set();
  parsed.tasks = parsed.tasks.filter((task) => {
    const signature = normalizeTaskSignature(task);
    if (!signature) return false;
    if (seenTasks.has(signature)) {
      parsed.duplicateCount += 1;
      return false;
    }
    seenTasks.add(signature);
    return true;
  });

  parsed.words = [...new Set(parsed.words.filter(Boolean))];
  return parsed;
}

function NotesUI({ text }) {
  const notes = useMemo(() => parseNotesResponse(text), [text]);
  const [markedSections, setMarkedSections] = useState(() => new Set());
  const studyStats = useMemo(() => {
    const minutes = Math.max(5, Math.min(30, notes.sections.length * 2 + Math.ceil(notes.tasks.length / 2) + Math.ceil(notes.words.length / 4)));
    const focus = notes.sections.slice(0, 3).map((section) => section.heading).filter(Boolean);
    return { minutes, focus };
  }, [notes.sections, notes.tasks.length, notes.words.length]);
  const markedCount = markedSections.size;
  const sectionProgress = notes.sections.length ? Math.round((markedCount / notes.sections.length) * 100) : 0;

  useEffect(() => {
    setMarkedSections(new Set());
  }, [text]);

  const toggleSectionMarked = (index) => {
    setMarkedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (!notes.sections.length && !notes.words.length && !notes.tasks.length) {
    return <TutorMessageContent text={text} />;
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#f0f9ff_0%,#ffffff_48%,#FFFBEB_100%)] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white/80 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-700">
              <GraduationCap className="size-3.5" />
              Study mode
            </p>
            <h3 className="mt-1 text-base font-bold leading-snug text-slate-900">{notes.title}</h3>
            {notes.subtitle && <p className="mt-0.5 text-xs text-slate-500">{notes.subtitle}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-violet-700">{studyStats.minutes} min revision</span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-sky-700">{notes.sections.length} sections</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">{notes.tasks.length} tasks</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">{notes.words.length} words</span>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-white bg-white/75 p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <p className="text-xs font-bold text-slate-900">Study progress</p>
            </div>
            <span className="text-xs font-semibold text-emerald-700">
              {markedCount}/{notes.sections.length} sections marked
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <Motion.div
              className="h-full rounded-full bg-emerald-500"
              animate={{ width: `${sectionProgress}%` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { label: 'Read', value: `${notes.sections.length} short parts`, icon: BookOpen, tone: 'text-sky-700 bg-sky-100' },
            { label: 'Recall', value: `${notes.words.length} word prompts`, icon: BrainCircuit, tone: 'text-violet-700 bg-violet-100' },
            { label: 'Practice', value: `${notes.tasks.length} task cards`, icon: Pencil, tone: 'text-emerald-700 bg-emerald-100' },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="flex items-center gap-2 rounded-xl border border-white bg-white/75 px-3 py-2 shadow-sm">
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', step.tone)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900">{step.label}</p>
                  <p className="truncate text-[11px] text-slate-500">{step.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="mx-3 mt-3 grid h-auto grid-cols-3 rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="notes" className="gap-1.5 rounded-lg text-xs">
            <BookOpen className="size-3.5" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5 rounded-lg text-xs">
            <ListChecks className="size-3.5" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="words" className="gap-1.5 rounded-lg text-xs">
            <NotebookPen className="size-3.5" />
            Words
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="m-0 p-3">
          {studyStats.focus.length > 0 && (
            <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50/70 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Target className="size-4 text-violet-700" />
                <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Focus while reading</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {studyStats.focus.map((item) => (
                  <span key={item} className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {notes.sections.map((section, i) => {
              const isMarked = markedSections.has(i);
              return (
                <Motion.div
                  key={`${section.heading || 'section'}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    'relative overflow-hidden rounded-xl border bg-white p-3 shadow-sm transition-colors',
                    'before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1',
                    isMarked
                      ? 'border-emerald-300 bg-emerald-50/30 before:bg-emerald-500'
                      : i === 0 ? 'border-sky-200 before:bg-sky-400 lg:col-span-2' : 'border-slate-200 before:bg-emerald-300',
                    i === 0 && 'lg:col-span-2'
                  )}
                >
                  {section.heading && (
                    <div className="mb-2 flex items-start gap-2 pl-1">
                      <span className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                        isMarked ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
                      )}>
                        {isMarked ? <CheckCircle2 className="size-4" /> : String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">{section.heading}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-400">Read, cover, then explain in your own words</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSectionMarked(i)}
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors',
                          isMarked
                            ? 'border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
                        )}
                        aria-pressed={isMarked}
                      >
                        <CheckCircle2 className="size-3.5" />
                        {isMarked ? 'Marked' : 'Mark studied'}
                      </button>
                    </div>
                  )}
                  <div className={cn(
                    'space-y-2 rounded-lg px-3 py-2 text-sm leading-7 text-slate-700',
                    isMarked
                      ? 'bg-[repeating-linear-gradient(to_bottom,#FFFBEB_0,#FFFBEB_27px,#FEF3C7_28px)]'
                      : 'bg-[repeating-linear-gradient(to_bottom,#ffffff_0,#ffffff_27px,#f1f5f9_28px)]'
                  )}>
                    {section.lines.map((line, lineIndex) => (
                      <p key={lineIndex}>{renderInlineTutorText(line, `note-${i}-${lineIndex}`)}</p>
                    ))}
                  </div>
                  <div className={cn(
                    'mt-2 flex items-center gap-1.5 text-[11px] font-medium',
                    isMarked ? 'text-emerald-700' : 'text-slate-400'
                  )}>
                    <CheckCircle2 className={cn('size-3.5', isMarked ? 'text-emerald-600' : 'text-slate-300')} />
                    {isMarked ? 'Section marked as studied' : 'Mark after you can retell this section'}
                  </div>
                </Motion.div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="m-0 p-3">
          {notes.duplicateCount > 0 && (
            <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              {notes.duplicateCount} repeated task group{notes.duplicateCount === 1 ? '' : 's'} collapsed for easier revision.
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {notes.tasks.map((task, i) => {
              const type = classifyTask(task.title);
              return (
                <Motion.div
                  key={`${task.number}-${task.title}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.035 }}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="mb-2 flex items-start gap-2">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white">
                      <Circle className="size-3 text-slate-300" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', TASK_TONE_CLASS[type.tone])}>
                        {type.label}
                      </span>
                      <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">
                        {renderInlineTutorText(task.title, `task-title-${i}`)}
                      </p>
                    </div>
                  </div>
                  {task.items.length > 0 && (
                    <div className="space-y-1.5 border-t border-slate-100 pt-2">
                      {task.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="grid grid-cols-[auto_1fr] gap-2 text-xs leading-relaxed text-slate-700">
                          <span className="mt-1.5 size-1.5 rounded-full bg-slate-300" />
                          <span>{renderInlineTutorText(item, `task-${i}-${itemIndex}`)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Motion.div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="words" className="m-0 p-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Word bank</p>
                <p className="mt-0.5 text-[11px] text-amber-800/70">Say the word, guess the meaning, then use it in one sentence.</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-amber-700">
                <Sparkles className="size-3.5" />
                Recall drill
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {notes.words.map((word) => (
                <div key={word} className="rounded-xl border border-white bg-white p-3 shadow-sm">
                  <p className="text-sm font-bold text-slate-900">{word}</p>
                  <div className="mt-2 h-8 rounded-lg border border-dashed border-amber-200 bg-amber-50/60" />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Homework Help UI — Socratic conversation card
// ---------------------------------------------------------------------------

function parseHomeworkHelp(text) {
  if (!text) return { content: '', question: null, tail: '' };
  const trimmed = text.trim();
  const lastQ = trimmed.lastIndexOf('?');
  if (lastQ === -1) return { content: trimmed, question: null, tail: '' };

  // Walk back to find start of the sentence containing the last '?'
  const before = trimmed.slice(0, lastQ);
  const startCandidates = [
    before.lastIndexOf('. ') + 2,
    before.lastIndexOf('!\n') + 2,
    before.lastIndexOf('?\n') + 2,
    before.lastIndexOf('\n\n') + 2,
    0,
  ];
  const sentenceStart = Math.max(...startCandidates);
  return {
    content: trimmed.slice(0, sentenceStart).trim(),
    question: trimmed.slice(sentenceStart, lastQ + 1).trim(),
    // Anything after the guiding question — usually a short encouragement.
    tail: trimmed.slice(lastQ + 1).trim(),
  };
}

function HomeworkHelpUI({ text }) {
  const { content, question, tail } = useMemo(() => parseHomeworkHelp(text), [text]);

  if (!question) return <TutorMessageContent text={text} />;

  return (
    <Motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full overflow-hidden rounded-2xl rounded-bl-sm border border-[#eedbc9] bg-white shadow-sm"
    >
      {/* Coach strip — slim, quiet */}
      <div className="flex items-center gap-2 border-b border-[#F4E9DE] bg-[#FBF7F2] px-4 py-2">
        <span className="flex size-6 items-center justify-center rounded-lg bg-[#F4E9DE] text-[13px]">🦉</span>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#C07A4C]">Homework coach</p>
        <p className="ml-auto hidden text-[11px] text-[#a3aaa2] sm:block">I guide — you solve</p>
      </div>

      <div className="space-y-3 px-4 py-3.5">
        {/* Hint / working — rendered with structure (steps, bold, line breaks) */}
        {content && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.12 }}
            className="text-[13px] leading-relaxed text-slate-600"
          >
            <TutorMessageContent text={content} />
          </Motion.div>
        )}

        {/* The guiding question — the hero */}
        <Motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22, delay: content ? 0.25 : 0.1 }}
          className="rounded-xl border-l-[3px] border-[#C07A4C] bg-[#F4E9DE]/60 px-3.5 py-3"
        >
          <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#C07A4C]">
            <Lightbulb className="size-3" /> Your turn
          </span>
          <p className="font-[Nunito] text-[15px] font-bold leading-relaxed text-[#26332E]">{question}</p>
        </Motion.div>

        {/* Nudge toward the input (+ any encouragement the tutor added) */}
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: content ? 0.45 : 0.25 }}
          className="flex items-center gap-1.5 text-[11px] font-medium text-[#C07A4C]"
        >
          <span className="flex gap-1">
            {[0, 0.18, 0.36].map((delay) => (
              <Motion.span
                key={delay}
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1.4, delay }}
                className="size-1.5 rounded-full bg-[#dcb18e]"
              />
            ))}
          </span>
          {tail || 'Type your answer below to keep going'}
        </Motion.div>
      </div>
    </Motion.div>
  );
}

// ---------------------------------------------------------------------------
// Explain Like I'm 10 UI — a friendly, sectioned study guide
// ---------------------------------------------------------------------------

const EXPLAIN_SECTION_RULES = [
  { type: 'vocab',    re: /new words|vocab|glossary|word meaning|meanings/i },
  { type: 'exercise', re: /complete the|fill in|blank|exercise|activity|practice|match the|let'?s do|let us do/i },
  { type: 'qa',       re: /question|answer|comprehension|let'?s think|let us think/i },
  { type: 'steps',    re: /step|explanation|how it|why|summary|recap|story|overview|what happen/i },
];

function classifyExplainSection(title) {
  for (const rule of EXPLAIN_SECTION_RULES) if (rule.re.test(title)) return rule.type;
  return 'generic';
}

function explainHeading(line, hasFollowing) {
  const t = line.trim();
  const bold = t.match(/^#{0,4}\s*\*\*(.+?)\*\*:?\s*$/) || t.match(/^#{1,4}\s+(.+?):?\s*$/);
  if (bold) return bold[1].trim();
  // Plain short title line: capitalised, ≤6 words, no terminal punctuation, followed by content
  if (
    hasFollowing &&
    /^[A-Z]/.test(t) &&
    t.length <= 42 &&
    t.split(/\s+/).length <= 6 &&
    !/[.,;:?!)]$/.test(t) &&
    !/^\d+[.)]/.test(t) &&
    !/^[-*+•]/.test(t)
  ) {
    return t;
  }
  return null;
}

function parseExplain(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const nextNonEmpty = (i) => {
    for (let k = i + 1; k < lines.length; k++) if (lines[k].trim()) return true;
    return false;
  };

  const intro = [];
  const sections = [];
  let current = null;
  let started = false;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const heading = t ? explainHeading(lines[i], nextNonEmpty(i)) : null;
    if (heading) {
      started = true;
      current = { type: classifyExplainSection(heading), title: heading, body: [] };
      sections.push(current);
    } else if (!started) {
      if (t) intro.push(t);
    } else if (current) {
      current.body.push(lines[i]);
    }
  }

  // Build the hero from the intro block
  let eyebrow = null;
  let location = null;
  const leftover = [];
  for (const l of intro) {
    if (!eyebrow && /explain like/i.test(l)) eyebrow = l.split(/[—–-]/)[0].trim();
    else if (!location && /^topic:/i.test(l)) location = l.replace(/^topic:\s*/i, '').trim();
    else leftover.push(l);
  }
  const title = leftover.length ? leftover[leftover.length - 1] : null;

  return { eyebrow: eyebrow || "Explain Like I'm 10", location, title, sections };
}

function explainParagraphs(bodyLines) {
  const paras = [];
  let cur = [];
  for (const l of bodyLines) {
    if (!l.trim()) { if (cur.length) { paras.push(cur.join(' ').trim()); cur = []; } }
    else cur.push(l.trim());
  }
  if (cur.length) paras.push(cur.join(' ').trim());
  return paras.filter(Boolean);
}

const REVEAL_STYLES = {
  emerald: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', btn: 'border-emerald-300 text-emerald-600 hover:bg-emerald-50' },
  amber:   { box: 'border-amber-200 bg-amber-50 text-amber-800',       btn: 'border-amber-300 text-amber-600 hover:bg-amber-50' },
};

function RevealAnswer({ children, accent = 'emerald', label = 'Show answer' }) {
  const [open, setOpen] = useState(false);
  const s = REVEAL_STYLES[accent] || REVEAL_STYLES.emerald;
  if (open) {
    return (
      <Motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('ml-7 mt-1.5 rounded-lg border px-3 py-1.5 text-[13px] leading-relaxed', s.box)}
      >
        {children}
      </Motion.div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn('ml-7 mt-1.5 inline-flex items-center gap-1 rounded-lg border border-dashed px-2.5 py-1 text-[11px] font-semibold transition-colors', s.btn)}
    >
      <Sparkles className="size-3" /> {label}
    </button>
  );
}

function ExplainStepsBody({ body }) {
  const paras = explainParagraphs(body);
  if (paras.length <= 1) {
    return <p className="text-[13px] leading-relaxed text-slate-700">{paras[0] || ''}</p>;
  }
  return (
    <ol className="relative ml-1 space-y-3.5 border-l-2 border-dashed border-sky-200 pl-5">
      {paras.map((p, i) => (
        <Motion.li
          key={i}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.07 }}
          className="relative"
        >
          <span className="absolute -left-[26px] top-0 flex size-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white shadow-sm">
            {i + 1}
          </span>
          <p className="text-[13px] leading-relaxed text-slate-700">{p}</p>
        </Motion.li>
      ))}
    </ol>
  );
}

function ExplainVocabBody({ body }) {
  const rows = [];
  for (const l of body) {
    const t = l.trim();
    if (!t) continue;
    const m = t.match(/^[-*+•]?\s*([^:]{1,40}?)\s*[:–]\s*(.+)$/);
    if (m) rows.push({ term: m[1].trim(), def: m[2].trim() });
    else if (rows.length) rows[rows.length - 1].def += ' ' + t;
  }
  if (!rows.length) return <TutorMessageContent text={body.join('\n')} />;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <Motion.div
          key={i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
        >
          <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[12px] font-bold text-violet-700">{r.term}</span>
          <span className="text-[13px] text-slate-600">{r.def}</span>
        </Motion.div>
      ))}
    </div>
  );
}

function ExplainQABody({ body, accent = 'emerald', label = 'Show answer' }) {
  const pairs = [];
  let cur = null;
  for (const l of body) {
    const t = l.trim();
    if (!t) continue;
    const q = t.match(/^\d+[.)]\s*(.+)$/);
    if (q) {
      if (cur) pairs.push(cur);
      cur = { q: q[1].trim(), a: [] };
    } else if (cur) {
      cur.a.push(t.replace(/^answer:\s*/i, ''));
    }
  }
  if (cur) pairs.push(cur);
  if (!pairs.length) return <TutorMessageContent text={body.join('\n')} />;

  const dot = accent === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  return (
    <ol className="space-y-3">
      {pairs.map((p, i) => (
        <li key={i}>
          <div className="flex gap-2">
            <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', dot)}>
              {i + 1}
            </span>
            <p className="text-[13px] font-semibold leading-relaxed text-slate-800">{p.q}</p>
          </div>
          {p.a.length > 0 && (
            <RevealAnswer accent={accent} label={label}>{p.a.join(' ')}</RevealAnswer>
          )}
        </li>
      ))}
    </ol>
  );
}

const EXPLAIN_SECTION_STYLE = {
  steps:    { icon: BookOpen,                ring: 'bg-sky-100 text-sky-600',       title: 'text-sky-900' },
  vocab:    { icon: Languages,               ring: 'bg-violet-100 text-violet-600', title: 'text-violet-900' },
  qa:       { icon: MessageCircleQuestion,   ring: 'bg-emerald-100 text-emerald-600', title: 'text-emerald-900' },
  exercise: { icon: ListChecks,              ring: 'bg-amber-100 text-amber-600',   title: 'text-amber-900' },
  generic:  { icon: Sparkles,                ring: 'bg-slate-100 text-slate-500',   title: 'text-slate-900' },
};

function ExplainUI({ text }) {
  const { eyebrow, location, title, sections } = useMemo(() => parseExplain(text), [text]);

  if (!sections.length) return <TutorMessageContent text={text} />;

  return (
    <div className="w-full space-y-3">
      {/* Hero */}
      <Motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-500 p-[1.5px] shadow-sm"
      >
        <div className="rounded-[15px] bg-white px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Motion.span
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 2 }}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-400 shadow-inner"
            >
              <Lightbulb className="size-5 text-white" />
            </Motion.span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">{eyebrow}</p>
              {title && <p className="truncate text-[15px] font-extrabold text-slate-900">{title}</p>}
            </div>
          </div>
          {location && <p className="mt-2 text-[11px] font-medium text-slate-400">{location}</p>}
        </div>
      </Motion.div>

      {/* Sections */}
      {sections.map((s, i) => {
        const st = EXPLAIN_SECTION_STYLE[s.type] || EXPLAIN_SECTION_STYLE.generic;
        const Icon = st.icon;
        return (
          <Motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.06 }}
            className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
          >
            <div className="flex items-center gap-2 px-3.5 pt-3">
              <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-lg', st.ring)}>
                <Icon className="size-3.5" />
              </span>
              <h4 className={cn('text-[13px] font-bold', st.title)}>{s.title}</h4>
            </div>
            <div className="px-3.5 pb-3.5 pt-2.5">
              {s.type === 'steps' && <ExplainStepsBody body={s.body} />}
              {s.type === 'vocab' && <ExplainVocabBody body={s.body} />}
              {s.type === 'qa' && <ExplainQABody body={s.body} accent="emerald" label="Show answer" />}
              {s.type === 'exercise' && <ExplainQABody body={s.body} accent="amber" label="Reveal answer" />}
              {s.type === 'generic' && <TutorMessageContent text={s.body.join('\n')} />}
            </div>
          </Motion.div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Response dispatcher — picks the right UI for each mode
// ---------------------------------------------------------------------------

function TutorResponseRenderer({ text, mode }) {
  if (mode === 'quiz') return <QuizUI text={text} />;
  if (mode === 'flashcards') return <FlashcardUI text={text} />;
  if (mode === 'mind_map') return <MindMapUI text={text} />;
  if (mode === 'notes') return <NotesUI text={text} />;
  if (mode === 'explain') return <ExplainUI text={text} />;
  if (mode === 'homework_help') return <HomeworkHelpUI text={text} />;
  return <TutorMessageContent text={text} />;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const STUDENT = {
  name: 'Koushik',
  streak: 15,
  xp: 2840,
  level: 8,
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const QUICK_ACTIONS = [
  {
    id: 'learn',
    title: 'Learn',
    description: 'Interactive lessons and videos',
    icon: BookOpen,
    gradient: 'from-blue-500 to-cyan-400',
  },
  {
    id: 'practice-papers',
    title: 'Practice Papers',
    description: 'Topic-wise and full syllabus papers',
    icon: FileText,
    gradient: 'from-violet-500 to-purple-400',
  },
  {
    id: 'quizzes',
    title: 'Quizzes',
    description: 'Quick assessments and challenges',
    icon: Target,
    gradient: 'from-pink-500 to-rose-400',
  },
  {
    id: 'ai-tutor',
    title: 'AI Tutor',
    description: 'Get instant explanations',
    icon: Bot,
    gradient: 'from-emerald-500 to-teal-400',
  },
  {
    id: 'homework-helper',
    title: 'Homework Helper',
    description: 'Solve assignments faster',
    icon: Pencil,
    gradient: 'from-amber-500 to-orange-400',
  },
  {
    id: 'coding-lab',
    title: 'Coding Lab',
    description: 'Learn coding interactively',
    icon: Code2,
    gradient: 'from-indigo-500 to-blue-400',
  },
  {
    id: 'flashcards',
    title: 'Flashcards',
    description: 'Memorize concepts quickly',
    icon: Layers3,
    gradient: 'from-fuchsia-500 to-pink-400',
  },
  {
    id: 'mock-tests',
    title: 'Mock Tests',
    description: 'Simulate real exams',
    icon: ClipboardCheck,
    gradient: 'from-sky-500 to-cyan-400',
  },
];

const CONTINUE_LEARNING = [
  {
    id: 'math',
    subject: 'Mathematics',
    lesson: 'Quadratic Equations',
    icon: Calculator,
    progress: 68,
    color: 'from-blue-500 to-cyan-400',
  },
  {
    id: 'science',
    subject: 'Science',
    lesson: 'Laws of Motion',
    icon: Atom,
    progress: 42,
    color: 'from-emerald-500 to-teal-400',
  },
  {
    id: 'english',
    subject: 'English',
    lesson: 'Poetry Analysis',
    icon: BookText,
    progress: 81,
    color: 'from-fuchsia-500 to-pink-400',
  },
  {
    id: 'geography',
    subject: 'Geography',
    lesson: 'Climate Patterns',
    icon: Globe2,
    progress: 25,
    color: 'from-amber-500 to-orange-400',
  },
];

const DAILY_GOALS = [
  { id: 'lessons', label: 'Lessons Completed', value: 6, suffix: '', icon: BookOpen, trend: '+2 today', color: 'text-blue-600 bg-blue-100' },
  { id: 'time', label: 'Study Time', value: 48, suffix: ' min', icon: Clock, trend: '+12 min', color: 'text-emerald-600 bg-emerald-100' },
  { id: 'xp', label: 'XP Earned', value: 320, suffix: ' XP', icon: Zap, trend: '+80 XP', color: 'text-amber-600 bg-amber-100' },
  { id: 'questions', label: 'Questions Solved', value: 24, suffix: '', icon: CheckCircle2, trend: '+9 today', color: 'text-fuchsia-600 bg-fuchsia-100' },
];

const SUBJECT_VISUALS = [
  { match: /math/i, icon: Calculator, gradient: 'from-blue-500 to-cyan-400', colorKey: 'blue' },
  { match: /(science|physic|chemistry|biology)/i, icon: Atom, gradient: 'from-emerald-500 to-teal-400', colorKey: 'green' },
  { match: /(english|language|literature)/i, icon: BookText, gradient: 'from-fuchsia-500 to-pink-400', colorKey: 'purple' },
  { match: /(computer|coding|programming)/i, icon: Cpu, gradient: 'from-indigo-500 to-blue-400', colorKey: 'blue' },
  { match: /(geography|environment)/i, icon: Globe2, gradient: 'from-amber-500 to-orange-400', colorKey: 'orange' },
  { match: /history/i, icon: ScrollText, gradient: 'from-rose-500 to-red-400', colorKey: 'red' },
];
const DEFAULT_SUBJECT_VISUAL = { icon: BookOpen, gradient: 'from-slate-500 to-slate-400', colorKey: 'blue' };
const getSubjectVisual = (name) => SUBJECT_VISUALS.find((entry) => entry.match.test(name)) || DEFAULT_SUBJECT_VISUAL;

const ACHIEVEMENTS = [
  { id: 'quiz-master', name: 'Quiz Master', icon: Trophy, rarity: 'gold', earned: true, description: 'Scored 90%+ on 10 quizzes' },
  { id: 'bookworm', name: 'Bookworm', icon: BookOpen, rarity: 'silver', earned: true, description: 'Completed 50 lessons' },
  { id: 'fast-learner', name: 'Fast Learner', icon: Zap, rarity: 'gold', earned: true, description: 'Finished 5 lessons in a day' },
  { id: 'perfect-score', name: 'Perfect Score', icon: Star, rarity: 'platinum', earned: false, description: 'Get 100% on any test' },
  { id: 'consistency-champion', name: 'Consistency Champion', icon: Flame, rarity: 'silver', earned: true, description: '15 day streak and counting' },
  { id: 'genius-thinker', name: 'Genius Thinker', icon: BrainCircuit, rarity: 'platinum', earned: false, description: 'Solve 100 AI tutor questions' },
];

const RARITY_STYLES = {
  bronze: 'from-amber-700 to-amber-500',
  silver: 'from-slate-400 to-slate-300',
  gold: 'from-yellow-500 to-amber-300',
  platinum: 'from-cyan-400 via-fuchsia-400 to-violet-400',
};

const RECOMMENDED = [
  { id: 'r1', type: 'Video Lesson', title: 'Understanding Photosynthesis', duration: '12 min', difficulty: 'Easy', icon: PlayCircle, color: 'from-emerald-500 to-teal-400' },
  { id: 'r2', type: 'Quiz', title: 'Algebra Speed Round', duration: '8 min', difficulty: 'Medium', icon: Target, color: 'from-pink-500 to-rose-400' },
  { id: 'r3', type: 'Practice Set', title: 'English Grammar Drills', duration: '15 min', difficulty: 'Easy', icon: ListChecks, color: 'from-blue-500 to-cyan-400' },
  { id: 'r4', type: 'AI Challenge', title: 'Logic Puzzle Marathon', duration: '20 min', difficulty: 'Hard', icon: BrainCircuit, color: 'from-violet-500 to-purple-400' },
];

const WEEK_TRACKER = [
  { day: 'M', done: true },
  { day: 'T', done: true },
  { day: 'W', done: true },
  { day: 'T', done: true },
  { day: 'F', done: true },
  { day: 'S', done: false },
  { day: 'S', done: false },
];

const LEARNING_JOURNEY = [
  { title: 'Learn Concept', subtitle: 'Fractions', icon: BookOpen, state: 'complete' },
  { title: 'Practice Questions', subtitle: '8 of 12 solved', icon: Pencil, state: 'complete' },
  { title: 'Take Quiz', subtitle: 'Ready now', icon: Target, state: 'active' },
  { title: 'AI Review', subtitle: 'Unlocks next', icon: Bot, state: 'upcoming' },
  { title: 'Mastered', subtitle: '+120 XP', icon: Trophy, state: 'upcoming' },
];

const AI_RECOMMENDATIONS = [
  { title: 'Fractions', difficulty: 'Easy', time: '12 min', score: 'Best next step', color: 'from-cyan-500 to-blue-500' },
  { title: 'Percentages', difficulty: 'Medium', time: '18 min', score: '92% match', color: 'from-violet-500 to-fuchsia-500' },
  { title: 'Ratio', difficulty: 'Medium', time: '15 min', score: 'Builds mastery', color: 'from-emerald-500 to-teal-500' },
];

const LEARNING_MODES = [
  { title: 'Learn', description: 'Guided lessons', icon: BookOpen, color: 'bg-blue-100 text-blue-700', glow: 'hover:shadow-blue-200' },
  { title: 'Flashcards', description: 'Recall faster', icon: Layers3, color: 'bg-fuchsia-100 text-fuchsia-700', glow: 'hover:shadow-fuchsia-200' },
  { title: 'Learning Games', description: 'Play and improve', icon: Gamepad2, color: 'bg-emerald-100 text-emerald-700', glow: 'hover:shadow-emerald-200' },
  { title: 'Practice', description: 'Target weak areas', icon: Target, color: 'bg-rose-100 text-rose-700', glow: 'hover:shadow-rose-200' },
  { title: 'Quick Quiz', description: 'Test in 5 minutes', icon: Zap, color: 'bg-amber-100 text-amber-700', glow: 'hover:shadow-amber-200' },
  { title: 'AI Tutor', description: 'Ask anything', icon: Bot, color: 'bg-violet-100 text-violet-700', glow: 'hover:shadow-violet-200' },
  { title: 'Coding Lab', description: 'Build real projects', icon: Code2, color: 'bg-cyan-100 text-cyan-700', glow: 'hover:shadow-cyan-200' },
  { title: 'Mock Test', description: 'Exam simulation', icon: ClipboardCheck, color: 'bg-indigo-100 text-indigo-700', glow: 'hover:shadow-indigo-200' },
];

const COMPANION_CHIPS = [
  { label: "Explain Like I'm 10", icon: Lightbulb },
  { label: 'Give Example', icon: Sparkles },
  { label: 'Create Quiz', icon: Target },
  { label: 'Simplify Notes', icon: NotebookPen },
  { label: 'Translate', icon: Languages },
  { label: 'Mind Map', icon: Network },
  { label: 'Flashcards', icon: Layers3 },
  { label: 'Homework Help', icon: MessageCircleQuestion },
];

// Rotating typewriter examples shown in the composer placeholder while it's
// empty — gives students a sense of what they can ask without cluttering the UI.
const COMPOSER_PLACEHOLDER_EXAMPLES = [
  "Explain photosynthesis like I'm 10…",
  'Quiz me on fractions…',
  "Help me with today's homework…",
  'Summarize this chapter in 5 points…',
  'Make flashcards for the water cycle…',
  "What's the difference between mitosis and meiosis?",
];

const STARTER_PROMPTS = [
  { mode: "Explain Like I'm 10", text: 'Explain this topic in simple words', icon: Lightbulb },
  { mode: 'Create Quiz', text: 'Make me a 5-question quiz', icon: Target },
  { mode: 'Flashcards', text: 'Turn this chapter into flashcards', icon: Layers3 },
  { mode: 'Homework Help', text: 'Help me solve this step by step', icon: MessageCircleQuestion },
];

// Contextual next-move suggestions shown under the tutor's latest reply.
const FOLLOW_UP_SETS = {
  quiz: [
    { label: 'Explain the answers', text: 'Explain the answers to that quiz', chip: "Explain Like I'm 10" },
    { label: 'Make it harder', text: 'Give me a harder quiz on this', chip: 'Create Quiz' },
    { label: 'Flashcards', text: 'Turn this into flashcards', chip: 'Flashcards' },
  ],
  flashcards: [
    { label: 'Quiz me', text: 'Quiz me on these cards', chip: 'Create Quiz' },
    { label: 'Explain a card', text: 'Explain the hardest card simply', chip: "Explain Like I'm 10" },
    { label: 'More cards', text: 'Make a few more flashcards', chip: 'Flashcards' },
  ],
  homework_help: [
    { label: 'Next step', text: 'What is the next step?', chip: 'Homework Help' },
    { label: "I'm stuck", text: "I'm stuck — give me a hint", chip: 'Homework Help' },
    { label: 'Why does that work?', text: 'Explain why that works', chip: "Explain Like I'm 10" },
  ],
};
const DEFAULT_FOLLOW_UPS = [
  { label: 'Simpler, please', text: 'Explain that more simply', chip: "Explain Like I'm 10" },
  { label: 'Give an example', text: 'Give me an example', chip: 'Give Example' },
  { label: 'Quiz me on this', text: 'Quiz me on this', chip: 'Create Quiz' },
];
const followUpsFor = (mode) => FOLLOW_UP_SETS[mode] || DEFAULT_FOLLOW_UPS;

const SMART_INSIGHTS = [
  { label: 'Strongest Subject', value: 'English', detail: '91% mastery', icon: Trophy, color: 'text-emerald-600 bg-emerald-100', trend: [30, 48, 44, 64, 72, 88] },
  { label: 'Weakest Subject', value: 'Science', detail: 'Focus: Motion', icon: TrendingDown, color: 'text-rose-600 bg-rose-100', trend: [70, 64, 60, 52, 49, 43] },
  { label: 'Improvement', value: 18, suffix: '%', detail: 'This week', icon: TrendingUp, color: 'text-blue-600 bg-blue-100', trend: [20, 25, 38, 42, 57, 72] },
  { label: 'Quiz Accuracy', value: 86, suffix: '%', detail: 'Last 10 quizzes', icon: Target, color: 'text-violet-600 bg-violet-100', trend: [50, 60, 55, 72, 78, 86] },
  { label: 'Consistency', value: 92, suffix: '%', detail: '6 of 7 days', icon: CalendarCheck2, color: 'text-amber-600 bg-amber-100', trend: [60, 74, 70, 84, 88, 92] },
];

const MISSIONS = [
  { id: 'lesson', label: 'Complete 1 lesson', progress: '1 / 1', done: true },
  { id: 'questions', label: 'Solve 10 questions', progress: '7 / 10', done: false },
  { id: 'minutes', label: 'Study 20 minutes', progress: '14 / 20', done: false },
  { id: 'ai', label: 'Ask AI Tutor 1 question', progress: '0 / 1', done: false },
];

const LEARNING_GAMES = [
  { title: 'Math Sprint', description: 'Beat the clock with rapid calculations.', icon: Calculator, difficulty: 'Medium', xp: 40, color: 'from-blue-500 to-cyan-400' },
  { title: 'Word Builder', description: 'Build vocabulary one streak at a time.', icon: BookText, difficulty: 'Easy', xp: 30, color: 'from-fuchsia-500 to-pink-400' },
  { title: 'Science Challenge', description: 'Solve experiments and unlock discoveries.', icon: Atom, difficulty: 'Medium', xp: 50, color: 'from-emerald-500 to-teal-400' },
  { title: 'Coding Puzzle', description: 'Fix logic, complete loops, earn XP.', icon: Code2, difficulty: 'Hard', xp: 75, color: 'from-indigo-500 to-violet-500' },
];

const EXAM_TOOLS = [
  { title: 'Practice Papers', detail: '24 curated sets', icon: FileText, color: 'from-blue-600 to-cyan-500' },
  { title: 'Previous Year Questions', detail: '2019 - 2025', icon: ScrollText, color: 'from-violet-600 to-fuchsia-500' },
  { title: 'Mock Tests', detail: 'Timed exam mode', icon: ClipboardCheck, color: 'from-rose-500 to-orange-500' },
  { title: 'Revision Notes', detail: 'Smart summaries', icon: NotebookPen, color: 'from-emerald-600 to-teal-500' },
];

const LEADERBOARD = [
  { rank: 1, name: 'Aarav', xp: 4280, initials: 'AK', color: 'bg-amber-400' },
  { rank: 2, name: 'Maya', xp: 3910, initials: 'MR', color: 'bg-slate-300' },
  { rank: 3, name: 'Koushik', xp: 3640, initials: 'KS', color: 'bg-orange-300' },
  { rank: 4, name: 'Zoya', xp: 3380, initials: 'ZA', color: 'bg-blue-200' },
];

const REWARDS = [
  { title: 'New Avatar', cost: 450, icon: Sparkles, color: 'from-pink-500 to-rose-400', unlocked: true },
  { title: 'Rocket Badge', cost: 700, icon: Rocket, color: 'from-blue-500 to-cyan-400', unlocked: true },
  { title: 'Premium Frame', cost: 1200, icon: Crown, color: 'from-amber-500 to-yellow-300', unlocked: false },
  { title: 'Streak Theme', cost: 900, icon: Flame, color: 'from-violet-500 to-fuchsia-400', unlocked: false },
];

const SUBJECT_PERFORMANCE = [
  { name: 'Mathematics', icon: Calculator, completion: 68, score: 84, time: '12h 20m', mastery: 'Proficient', color: 'from-blue-500 to-cyan-400' },
  { name: 'Science', icon: Atom, completion: 42, score: 71, time: '8h 45m', mastery: 'Developing', color: 'from-emerald-500 to-teal-400' },
  { name: 'English', icon: BookText, completion: 81, score: 91, time: '10h 15m', mastery: 'Advanced', color: 'from-fuchsia-500 to-pink-400' },
  { name: 'Computer Science', icon: Cpu, completion: 35, score: 78, time: '6h 30m', mastery: 'Proficient', color: 'from-indigo-500 to-violet-400' },
];

// ---------------------------------------------------------------------------
// Motion variants
// ---------------------------------------------------------------------------

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const slideInLeft = {
  hidden: { opacity: 0, x: -28 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const slideInRight = {
  hidden: { opacity: 0, x: 28 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const staggerChildren = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const staggerContainer = staggerChildren;

const floating = (delay = 0, distance = 14, duration = 4) => ({
  animate: {
    y: [0, -distance, 0],
    transition: { duration, repeat: Infinity, ease: 'easeInOut', delay },
  },
});

const floatingAnimation = floating;

const pulse = {
  animate: { scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] },
  transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
};

const scaleOnHover = { scale: 1.025, y: -4 };
const glowHover = { y: -5, boxShadow: '0 18px 45px rgba(79, 70, 229, 0.18)' };

// ---------------------------------------------------------------------------
// Reusable bits
// ---------------------------------------------------------------------------

function Section({ children, className }) {
  return (
    <Motion.section
      variants={fadeInUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      className={cn('w-full', className)}
    >
      {children}
    </Motion.section>
  );
}

function AnimatedCounter({ value, suffix = '', duration = 1.4 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      setCount(Math.floor(progress * value));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isInView, value, duration]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

function AnimatedProgress({ value, className }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const timeout = setTimeout(() => setDisplayValue(value), 150);
    return () => clearTimeout(timeout);
  }, [isInView, value]);

  return (
    <div ref={ref}>
      <Progress
        value={displayValue}
        className={cn('h-2 bg-slate-200', className)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1 — Hero Banner
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Calm design tokens — "study desk, soft focus"
// One amber accent, warm clay reserved for streak/XP, warm-paper ground.
// ---------------------------------------------------------------------------
const C = {
  paper: '#F4F1EA',
  surface: '#FBF9F4',
  card: '#FFFFFF',
  ink: '#26332E',
  muted: '#78827B',
  line: '#E7E3D9',
  teal: '#F59E0B',
  tealDeep: '#B45309',
  tealSoft: '#FEF3C7',
  clay: '#C07A4C',
  claySoft: '#F4E9DE',
};

const todayLabel = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

// A quiet paper card — the one surface shape used across the page.
function Panel({ children, className, as: Tag = 'div', ...rest }) {
  return React.createElement(
    Tag,
    {
      className: cn(
        'rounded-[22px] border border-[#E7E3D9] bg-white shadow-[0_1px_2px_rgba(38,51,46,0.04),0_10px_30px_-24px_rgba(38,51,46,0.5)]',
        className
      ),
      ...rest,
    },
    children
  );
}

function FocusRing({ value = 65, label = 'of today done' }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke={C.tealSoft} strokeWidth="9" />
        <Motion.circle
          cx="60" cy="60" r={r} fill="none" stroke={C.teal} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-[Nunito] text-3xl font-extrabold text-[#26332E]">{value}%</span>
        <span className="mt-0.5 max-w-[5rem] text-[10px] font-semibold uppercase leading-tight tracking-wide text-[#78827B]">{label}</span>
      </div>
    </div>
  );
}

function HeroBanner({ onStartLearning, onPracticeQuestions, onAskAiTutor }) {
  return (
    <Panel className="bg-[#FBF9F4] p-6 sm:p-9">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_auto] lg:items-center">
        <Motion.div variants={staggerContainer} initial="hidden" animate="visible" className="min-w-0">
          <Motion.p variants={fadeInUp} className="text-xs font-bold uppercase tracking-[0.18em] text-[#78827B]">
            {todayLabel()}
          </Motion.p>
          <Motion.h1 variants={fadeInUp} className="mt-2 font-[Nunito] text-3xl font-extrabold leading-tight text-[#26332E] sm:text-4xl">
            {getGreeting()}, {STUDENT.name}.
          </Motion.h1>
          <Motion.p variants={fadeInUp} className="mt-3 max-w-lg text-[15px] leading-relaxed text-[#5c655f]">
            Three things on your desk today — wrap up <span className="font-semibold text-[#B45309]">Fractions</span>,
            take one quiz, and ask the tutor anything that stuck.
          </Motion.p>

          <Motion.div variants={fadeInUp} className="mt-6 flex flex-wrap gap-3">
            <Button
              onClick={onAskAiTutor}
              className="h-11 gap-2 rounded-xl bg-[#F59E0B] px-5 text-sm font-semibold text-white shadow-none hover:bg-[#D97706]"
            >
              <Bot className="size-4" />
              Ask your tutor
            </Button>
            <Button
              onClick={onStartLearning}
              variant="outline"
              className="h-11 gap-2 rounded-xl border-[#E7E3D9] bg-white px-5 text-sm font-semibold text-[#26332E] hover:bg-[#F4F1EA] hover:text-[#26332E]"
            >
              <BookOpen className="size-4 text-[#F59E0B]" />
              Resume lesson
            </Button>
            <Button
              onClick={onPracticeQuestions}
              variant="ghost"
              className="h-11 gap-2 rounded-xl px-4 text-sm font-semibold text-[#5c655f] hover:bg-[#F4F1EA] hover:text-[#26332E]"
            >
              <Target className="size-4" />
              Practice
            </Button>
          </Motion.div>

          <Motion.div variants={fadeInUp} className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#C07A4C]">
              <Flame className="size-4" />
              {STUDENT.streak}-day streak
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#5c655f]">
              <Zap className="size-4 text-[#C07A4C]" />
              {STUDENT.xp.toLocaleString()} XP
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#5c655f]">
              <Trophy className="size-4 text-[#78827B]" />
              Level {STUDENT.level}
            </span>
          </Motion.div>
        </Motion.div>

        <Motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mx-auto flex items-center justify-center">
          <FocusRing value={65} />
        </Motion.div>
      </div>
    </Panel>
  );
}

function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#F59E0B]">{eyebrow}</p>}
        <h2 className="font-[Nunito] text-xl font-extrabold text-[#26332E] sm:text-[1.6rem]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function LearningJourney() {
  return (
    <Section>
      <SectionHeading eyebrow="Your plan for today" title={"Today's Learning Journey"} />
      <Card className="relative rounded-3xl border border-indigo-100 bg-white/80 p-0 shadow-sm backdrop-blur-xl">
        <CardContent className="relative p-5 sm:p-7">
          <div className="absolute left-10 right-10 top-[4.65rem] hidden h-1 overflow-hidden rounded-full bg-slate-100 md:block">
            <Motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 0.5 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: 'easeInOut' }}
              className="h-full origin-left rounded-full bg-gradient-to-r from-emerald-400 to-indigo-500"
            />
          </div>
          <Motion.div
            variants={staggerChildren}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            className="relative grid gap-3 md:grid-cols-5"
          >
            {LEARNING_JOURNEY.map((step, index) => {
              const Icon = step.icon;
              const complete = step.state === 'complete';
              const active = step.state === 'active';
              return (
                <Motion.div
                  key={step.title}
                  variants={fadeInUp}
                  className={cn(
                    'relative flex items-center gap-3 rounded-2xl border p-3 md:flex-col md:items-center md:border-0 md:bg-transparent md:p-2 md:text-center',
                    active ? 'border-indigo-200 bg-indigo-50' : 'border-slate-100 bg-white'
                  )}
                >
                  <Motion.div
                    {...(active ? pulse : {})}
                    className={cn(
                      'relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl border-4 border-white shadow-md',
                      complete && 'bg-emerald-500 text-white',
                      active && 'bg-indigo-600 text-white shadow-[0_0_24px_rgba(79,70,229,0.45)]',
                      step.state === 'upcoming' && 'bg-slate-100 text-slate-400'
                    )}
                  >
                    {complete ? <CircleCheck className="size-6" /> : <Icon className="size-5" />}
                  </Motion.div>
                  <div>
                    <p className={cn('text-sm font-bold', active ? 'text-indigo-700' : 'text-slate-700')}>
                      {index + 1}. {step.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{step.subtitle}</p>
                  </div>
                </Motion.div>
              );
            })}
          </Motion.div>
        </CardContent>
      </Card>
    </Section>
  );
}

function CircularProgress({ value }) {
  const radius = 49;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative size-32 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="10" />
        <Motion.circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: circumference * (1 - value / 100) }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-2xl font-extrabold">{value}%</span>
        <span className="text-[10px] font-semibold uppercase text-white/70">Complete</span>
      </div>
    </div>
  );
}

function ContinueWhereLeftOff({ onResume }) {
  return (
    <Section>
      <SectionHeading eyebrow="Pick up instantly" title="Continue Where You Left Off" />
      <Motion.div variants={slideInLeft} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }}>
        <Card className="relative rounded-3xl border-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 p-0 text-white shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,255,255,.2),transparent_32%)]" />
          <CardContent className="relative flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
            <CircularProgress value={65} />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <Badge className="border-0 bg-white/15 text-white">Mathematics</Badge>
                <span className="text-xs text-indigo-100">Last studied June 21</span>
              </div>
              <h3 className="mt-3 text-2xl font-bold">Fractions and Decimals</h3>
              <p className="mt-1 text-sm text-indigo-100">Continue lesson 7: Converting mixed fractions</p>
              <div className="mt-5 flex flex-wrap justify-center gap-5 text-sm sm:justify-start">
                <span><strong className="text-white">3</strong> lessons remaining</span>
                <span><strong className="text-white">28 min</strong> estimated</span>
              </div>
            </div>
            <Button
              onClick={onResume}
              className="h-11 gap-2 rounded-xl bg-white px-5 font-bold text-indigo-700 hover:bg-indigo-50"
            >
              <Play className="size-4 fill-current" />
              Resume Learning
            </Button>
          </CardContent>
        </Card>
      </Motion.div>
    </Section>
  );
}

function AiRecommendedNext() {
  return (
    <Section>
      <Card className="rounded-3xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/60 p-0 shadow-sm">
        <CardContent className="p-5 sm:p-7">
          <SectionHeading
            eyebrow="Based on your recent Math activity"
            title="AI Recommended Next"
            action={<Badge className="gap-1 border-0 bg-violet-100 text-violet-700"><Bot className="size-3" /> Personalized</Badge>}
          />
          <Motion.div
            variants={staggerChildren}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="grid gap-4 md:grid-cols-3"
          >
            {AI_RECOMMENDATIONS.map((item, index) => (
              <Motion.div key={item.title} variants={index % 2 ? slideInRight : slideInLeft} whileHover={glowHover}>
                <Card className="h-full rounded-2xl border border-white bg-white p-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className={cn('flex size-11 items-center justify-center rounded-xl bg-gradient-to-br text-white', item.color)}>
                        <Sparkles className="size-5" />
                      </div>
                      <Badge variant="outline">{item.score}</Badge>
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-slate-800">{item.title}</h3>
                    <div className="mt-2 flex gap-3 text-xs text-slate-500">
                      <span>{item.difficulty}</span>
                      <span className="flex items-center gap-1"><Clock className="size-3" />{item.time}</span>
                    </div>
                    <Button className="mt-4 w-full gap-1 rounded-xl bg-slate-900 text-white hover:bg-indigo-700">
                      Start <ArrowRight className="size-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              </Motion.div>
            ))}
          </Motion.div>
        </CardContent>
      </Card>
    </Section>
  );
}

function LearningModes() {
  return (
    <Section>
      <SectionHeading eyebrow="Choose your experience" title="Learning Modes" />
      <Motion.div
        variants={staggerChildren}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8"
      >
        {LEARNING_MODES.map((mode) => {
          const Icon = mode.icon;
          return (
            <Motion.button
              key={mode.title}
              variants={fadeInUp}
              whileHover={scaleOnHover}
              whileTap={{ scale: 0.97 }}
              className={cn('group rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-xl', mode.glow)}
            >
              <div className={cn('flex size-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-110', mode.color)}>
                <Icon className="size-6" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-slate-800">{mode.title}</h3>
              <p className="mt-1 text-xs leading-snug text-slate-500">{mode.description}</p>
            </Motion.button>
          );
        })}
      </Motion.div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Quick Actions
// ---------------------------------------------------------------------------

function QuickActionCard({ action }) {
  const Icon = action.icon;
  return (
    <Motion.div variants={fadeInUp} whileHover={{ y: -6 }} className="h-full">
      <Card className="group relative h-full cursor-pointer overflow-hidden rounded-2xl border-0 p-0 shadow-md transition-shadow hover:shadow-xl">
        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-90', action.gradient)} />
        <div className="pointer-events-none absolute -inset-y-10 -left-1/2 w-1/3 -skew-x-12 bg-white/25 opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
        <CardContent className="relative z-10 flex flex-col gap-3 p-5 text-white">
          <div className="flex size-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Icon className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-bold">{action.title}</h3>
            <p className="mt-1 text-xs leading-snug text-white/85">{action.description}</p>
          </div>
        </CardContent>
      </Card>
    </Motion.div>
  );
}

function QuickActions() {
  return (
    <Section>
      <h2 className="mb-4 text-xl font-bold text-slate-800 sm:text-2xl">Quick Actions</h2>
      <Motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      >
        {QUICK_ACTIONS.map((action) => (
          <QuickActionCard key={action.id} action={action} />
        ))}
      </Motion.div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Continue Learning
// ---------------------------------------------------------------------------

function ContinueLearningCard({ item }) {
  const Icon = item.icon;
  return (
    <Motion.div variants={fadeInUp} whileHover={{ y: -4 }} className="min-w-[260px] flex-1 sm:min-w-[280px]">
      <Card className="h-full rounded-2xl border border-white/60 bg-white/70 p-0 shadow-sm backdrop-blur-md transition-shadow hover:shadow-lg">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className={cn('flex size-11 items-center justify-center rounded-xl bg-gradient-to-br text-white', item.color)}>
              <Icon className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{item.subject}</p>
              <p className="text-xs text-slate-500">{item.lesson}</p>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
              <span>Progress</span>
              <span className="font-semibold text-slate-700">{item.progress}%</span>
            </div>
            <AnimatedProgress value={item.progress} />
          </div>

          <Button
            size="sm"
            className={cn('mt-auto w-full gap-1.5 rounded-lg bg-gradient-to-r text-white hover:opacity-90', item.color)}
          >
            <PlayCircle className="size-4" />
            Resume
          </Button>
        </CardContent>
      </Card>
    </Motion.div>
  );
}

function ContinueLearning() {
  return (
    <Section>
      <h2 className="mb-4 text-xl font-bold text-slate-800 sm:text-2xl">Continue Learning</h2>
      <ScrollArea className="w-full">
        <Motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="flex gap-4 pb-3"
        >
          {CONTINUE_LEARNING.map((item) => (
            <ContinueLearningCard key={item.id} item={item} />
          ))}
        </Motion.div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 4 — Daily Goals
// ---------------------------------------------------------------------------

function DailyGoals() {
  return (
    <Section>
      <h2 className="mb-4 text-xl font-bold text-slate-800 sm:text-2xl">Today&apos;s Goals</h2>
      <Motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        {DAILY_GOALS.map((goal) => {
          const Icon = goal.icon;
          return (
            <Motion.div key={goal.id} variants={fadeInUp}>
              <Card className="h-full rounded-2xl border border-slate-100 p-0 shadow-sm">
                <CardContent className="flex flex-col gap-2 p-5">
                  <div className={cn('flex size-10 items-center justify-center rounded-lg', goal.color)}>
                    <Icon className="size-5" />
                  </div>
                  <p className="text-2xl font-extrabold text-slate-800">
                    <AnimatedCounter value={goal.value} suffix={goal.suffix} />
                  </p>
                  <p className="text-xs font-medium text-slate-500">{goal.label}</p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                    <TrendingUp className="size-3" />
                    {goal.trend}
                  </span>
                </CardContent>
              </Card>
            </Motion.div>
          );
        })}
      </Motion.div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 5 — AI Tutor Panel
// ---------------------------------------------------------------------------

function useStudentCurriculum() {
  const [subjects, setSubjects] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | empty | error

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setStatus('error'); return; }
      try {
        const { data } = await fetchCachedJson(`${API_BASE}/api/lesson-plans/student/smart-learning-map`, {
          forceRefresh: true,
          ttlMs: 1,
          fetchOptions: { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } },
        });
        if (cancelled) return;
        const list = Array.isArray(data?.subjects) ? data.subjects : [];
        setSubjects(list);
        setStatus(list.length ? 'ready' : 'empty');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return { subjects, status };
}

function AiTutorPanel({ onGeneratedStudyItem = () => {} }) {
  const { profile } = useStudentDashboard();
  const studentFirstName = String(profile?.name || '').trim().split(/\s+/)[0] || 'there';
  const { subjects, status: curriculumStatus } = useStudentCurriculum();
  const [subjectKey, setSubjectKey] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [activeChip, setActiveChip] = useState(COMPANION_CHIPS[0].label);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [attachmentName, setAttachmentName] = useState('');
  const messagesScrollRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const chipsScrollRef = useRef(null);
  const composerRef = useRef(null);
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [showJump, setShowJump] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedConversations, setSavedConversations] = useState([]);
  const conversationIdRef = useRef(null);
  const historyPanelRef = useRef(null);
  const activeChipMeta = COMPANION_CHIPS.find((c) => c.label === activeChip) || COMPANION_CHIPS[0];
  const lastMessage = messages[messages.length - 1];
  const showFollowUps = !sending && lastMessage?.role === 'assistant'
    && !lastMessage.error && !lastMessage.thinking && !lastMessage.streaming;
  const supportsVoice = typeof window !== 'undefined'
    && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const [typedPlaceholder, setTypedPlaceholder] = useState('');

  // Typewriter effect: cycles through example questions in the composer
  // placeholder while it's empty, typing/deleting one character at a time.
  useEffect(() => {
    if (question || listening) return undefined;
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeoutId;

    const tick = () => {
      const phrase = COMPOSER_PLACEHOLDER_EXAMPLES[phraseIndex];
      if (!deleting) {
        charIndex += 1;
        setTypedPlaceholder(`${phrase.slice(0, charIndex)}▎`);
        if (charIndex === phrase.length) {
          deleting = true;
          setTypedPlaceholder(phrase);
          timeoutId = setTimeout(tick, 1500);
          return;
        }
        timeoutId = setTimeout(tick, 45);
      } else {
        charIndex -= 1;
        setTypedPlaceholder(`${phrase.slice(0, charIndex)}▎`);
        if (charIndex === 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % COMPOSER_PLACEHOLDER_EXAMPLES.length;
          timeoutId = setTimeout(tick, 400);
          return;
        }
        timeoutId = setTimeout(tick, 22);
      }
    };
    timeoutId = setTimeout(tick, 45);
    return () => clearTimeout(timeoutId);
  }, [question, listening]);

  const applyStarter = (starter) => {
    setActiveChip(starter.mode);
    setQuestion(starter.text);
    requestAnimationFrame(() => composerRef.current?.querySelector('textarea')?.focus());
  };
  const clearConversation = () => {
    streamTimersRef.current.forEach((id) => clearTimeout(id));
    streamTimersRef.current = [];
    setMessages([]);
    // The just-finished conversation is already saved to history (it's kept in
    // sync as messages arrive) — starting fresh just needs a new id so the
    // next message doesn't overwrite it.
    conversationIdRef.current = null;
  };
  const openHistory = () => {
    setSavedConversations(listTutorConversations());
    setHistoryOpen(true);
  };
  const loadConversation = (conversation) => {
    streamTimersRef.current.forEach((id) => clearTimeout(id));
    streamTimersRef.current = [];
    conversationIdRef.current = conversation.id;
    setMessages(conversation.messages);
    setHistoryOpen(false);
  };
  const removeConversation = (e, id) => {
    e.stopPropagation();
    deleteTutorConversation(id);
    if (conversationIdRef.current === id) conversationIdRef.current = null;
    setSavedConversations(listTutorConversations());
  };

  // Close the history panel on outside click.
  useEffect(() => {
    if (!historyOpen) return;
    const onPointerDown = (e) => {
      if (historyPanelRef.current && !historyPanelRef.current.contains(e.target)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [historyOpen]);
  const scrollMessagesToBottom = () => {
    const node = messagesScrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  };
  const onMessagesScroll = () => {
    const node = messagesScrollRef.current;
    if (!node) return;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    setShowJump(distanceFromBottom > 120);
  };
  const copyMessage = (msg) => {
    navigator.clipboard?.writeText(msg.text || '').then(() => {
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId((id) => (id === msg.id ? null : id)), 1600);
    }).catch(() => {});
  };
  const toggleVoice = () => {
    if (!supportsVoice) return;
    if (listening) { recognitionRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event) => {
      const transcript = Array.from(event.results).map((r) => r[0].transcript).join('');
      setQuestion(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };
  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch { /* noop */ } }, []);
  const streamTimersRef = useRef([]);
  const [canScrollChipsLeft, setCanScrollChipsLeft] = useState(false);
  const [canScrollChipsRight, setCanScrollChipsRight] = useState(false);

  const [chapterTitle, setChapterTitle] = useState('');

  const selectedSubject = subjects.find((s) => s.key === subjectKey);
  const topics = useMemo(() => {
    if (!selectedSubject) return [];
    const seen = new Set();
    const options = [];
    const addOption = (title, type = 'Topic', parentChapterTitle = '') => {
      const normalized = String(title || '').trim();
      const key = normalized.toLowerCase();
      if (!normalized || seen.has(key)) return;
      seen.add(key);
      options.push({ title: normalized, type, chapterTitle: parentChapterTitle });
    };

    (selectedSubject.chapters || []).forEach((chapter) => {
      addOption(chapter?.title, 'Chapter', chapter?.title);
      (chapter?.topics || []).forEach((topic) => addOption(topic?.title, 'Topic', chapter?.title));
    });
    (selectedSubject.topics || []).forEach((topic) => addOption(topic?.title, 'Topic', ''));
    return options;
  }, [selectedSubject]);

  // Keep the current conversation saved to history as it grows, so nothing is
  // lost on refresh/navigation and it shows up in the history list live.
  useEffect(() => {
    const hasRealMessage = messages.some((m) => !m.thinking && String(m.text || '').trim());
    if (!hasRealMessage) return;
    if (!conversationIdRef.current) conversationIdRef.current = createConversationId();
    saveTutorConversation({
      id: conversationIdRef.current,
      messages,
      subjectTitle: selectedSubject?.title || '',
      topicTitle,
    });
  }, [messages, selectedSubject, topicTitle]);

  const openAttachmentPicker = () => {
    attachmentInputRef.current?.click();
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0];
    setAttachmentName(file ? file.name : '');
  };

  const scrollChips = (direction) => {
    const node = chipsScrollRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * 220, behavior: 'smooth' });
  };

  const updateChipsScrollState = useCallback(() => {
    const node = chipsScrollRef.current;
    if (!node) return;
    setCanScrollChipsLeft(node.scrollLeft > 1);
    setCanScrollChipsRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const node = chipsScrollRef.current;
    if (!node) return;
    updateChipsScrollState();
    node.addEventListener('scroll', updateChipsScrollState);
    window.addEventListener('resize', updateChipsScrollState);
    return () => {
      node.removeEventListener('scroll', updateChipsScrollState);
      window.removeEventListener('resize', updateChipsScrollState);
    };
  }, [updateChipsScrollState]);

  useEffect(() => {
    const node = messagesScrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, sending]);

  useEffect(() => () => {
    streamTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    streamTimersRef.current = [];
  }, []);

  const streamTutorMessage = useCallback((assistantId, fullText, metadata = {}) => new Promise((resolve) => {
    const tokens = splitStreamTokens(fullText);
    if (!tokens.length) {
      setMessages((prev) => prev.map((msg) => (
        msg.id === assistantId
          ? { ...msg, ...metadata, thinking: false, streaming: false, text: '' }
          : msg
      )));
      resolve();
      return;
    }

    let tokenIndex = 0;
    let streamedText = '';

    const pushNextToken = () => {
      streamedText += tokens[tokenIndex];
      tokenIndex += 1;

      setMessages((prev) => prev.map((msg) => (
        msg.id === assistantId
          ? {
              ...msg,
              ...metadata,
              thinking: false,
              streaming: tokenIndex < tokens.length,
              text: streamedText,
            }
          : msg
      )));

      if (tokenIndex < tokens.length) {
        const timerId = window.setTimeout(pushNextToken, STREAM_TOKEN_DELAY_MS);
        streamTimersRef.current.push(timerId);
      } else {
        resolve();
      }
    };

    pushNextToken();
  }), []);

  const handleSend = async (opts = {}) => {
    const chipLabel = (typeof opts?.chip === 'string' && opts.chip) || activeChip;
    const mode = CHIP_MODES[chipLabel];
    const outgoing = (typeof opts?.text === 'string' ? opts.text : question).trim();
    if (!mode) {
      setMessages((prev) => [...prev, { role: 'assistant', error: true, text: `${chipLabel} isn't available yet.` }]);
      return;
    }
    if (!outgoing && !topicTitle) return;

    const userLabel = [chipLabel, topicTitle, outgoing].filter(Boolean).join(' — ');
    const activeSubject = subjects.find((s) => s.key === subjectKey);
    saveLearningActivity({
      path: '/student/learning',
      label: 'AI Tutor',
      detail: [activeSubject?.title, topicTitle].filter(Boolean).join(' · ') || chipLabel,
    });
    const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const assistantId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', text: userLabel },
      { id: assistantId, role: 'assistant', thinking: true, text: '', mode },
    ]);
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/ai-tutor/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode,
          subject: selectedSubject?.title || '',
          topic: topicTitle,
          question: outgoing,
          chapterTitle: chapterTitle || '',
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'AI Tutor request failed');
      const generatedContent = payload.data?.content || '';
      await streamTutorMessage(assistantId, generatedContent, {
        groundedInMaterial: payload.data?.groundedInMaterial,
        noMaterialFound: payload.data?.noMaterialFound,
      });
      if (generatedContent.trim()) {
        onGeneratedStudyItem(buildGeneratedStudyItem({
          mode,
          subject: selectedSubject?.title || '',
          topic: topicTitle,
          prompt: outgoing,
          content: generatedContent,
        }));
      }
    } catch (err) {
      setMessages((prev) => prev.map((msg) => (
        msg.id === assistantId
          ? {
              ...msg,
              thinking: false,
              error: true,
              text: err.message || 'Something went wrong. Try again.',
            }
          : msg
      )));
    } finally {
      setSending(false);
      setQuestion('');
    }
  };

  return (
    <Section>
      <SectionHeading eyebrow="Your always-on study partner" title="Study Companion" />
      <Panel className="flex h-[min(760px,calc(82vh-4.5rem))] flex-col overflow-hidden p-0 lg:h-[min(760px,82vh)]">
        {/* Header — tutor identity, context, controls */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[#E7E3D9] bg-[#FBF9F4] px-4 py-3 sm:px-5">
          <div className="relative">
            <Motion.div
              animate={{ boxShadow: ['0 0 0 0 rgba(63,125,110,0.0)', '0 0 0 6px rgba(63,125,110,0.10)', '0 0 0 0 rgba(63,125,110,0.0)'] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              className="flex size-11 items-center justify-center rounded-2xl bg-[#F59E0B]"
            >
              <Bot className="size-6 text-white" />
            </Motion.div>
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[#FBF9F4] bg-green-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-[Nunito] text-base font-extrabold leading-tight text-[#26332E]">Study Tutor</h3>
            <p className="truncate text-xs text-[#78827B]">
              {sending ? (
                <span className="inline-flex items-center gap-1 font-semibold text-[#F59E0B]">
                  Thinking
                  {[0, 0.15, 0.3].map((d) => (
                    <Motion.span key={d} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d }} className="size-1 rounded-full bg-[#F59E0B]" />
                  ))}
                </span>
              ) : listening ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-rose-500">
                  <span className="size-1.5 animate-pulse rounded-full bg-rose-500" /> Listening…
                </span>
              ) : selectedSubject ? (
                <>Focused on <span className="font-semibold text-[#B45309]">{selectedSubject.title}{topicTitle ? ` · ${topicTitle}` : ''}</span></>
              ) : 'Online · answers grounded in your teacher’s material'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={subjectKey || undefined}
              onValueChange={(value) => { setSubjectKey(value); setTopicTitle(''); setChapterTitle(''); }}
            >
              <SelectTrigger className="h-9 w-[128px] rounded-lg border-[#E7E3D9] bg-white text-xs text-[#26332E] shadow-sm sm:w-[150px]">
                <SelectValue
                  placeholder={curriculumStatus === 'loading' ? 'Loading…' : curriculumStatus === 'empty' || curriculumStatus === 'error' ? 'No subjects' : 'Subject'}
                />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => <SelectItem key={s.key} value={s.key}>{s.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <AnimatePresence initial={false}>
              {subjectKey && (
                <Motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <Select
                    value={topicTitle || undefined}
                    onValueChange={(value) => {
                      const selected = topics.find((t) => t.title === value);
                      setTopicTitle(value);
                      setChapterTitle(selected?.chapterTitle || '');
                    }}
                  >
                    <SelectTrigger className="h-9 w-[128px] rounded-lg border-[#E7E3D9] bg-white text-xs text-[#26332E] shadow-sm sm:w-[150px]">
                      <SelectValue placeholder="Chapter / topic" />
                    </SelectTrigger>
                    <SelectContent>
                      {topics.map((t) => <SelectItem key={`${t.type}-${t.title}`} value={t.title}>{t.type}: {t.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Motion.div>
              )}
            </AnimatePresence>
            <div className="relative" ref={historyPanelRef}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => (historyOpen ? setHistoryOpen(false) : openHistory())}
                    className={`size-9 shrink-0 rounded-lg text-[#5c655f] hover:bg-[#FEF3C7] hover:text-[#B45309] ${historyOpen ? 'bg-[#FEF3C7] text-[#B45309]' : ''}`}
                    aria-label="Chat history"
                  >
                    <History className="size-4.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Chat history</TooltipContent>
              </Tooltip>

              <AnimatePresence>
                {historyOpen && (
                  <Motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-[#E7E3D9] bg-white shadow-xl sm:w-80"
                  >
                    <div className="flex items-center justify-between border-b border-[#E7E3D9] bg-[#FBF9F4] px-4 py-3">
                      <span className="text-sm font-bold text-[#26332E]">Chat History</span>
                      <button
                        type="button"
                        onClick={() => { clearConversation(); setHistoryOpen(false); }}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#F59E0B] hover:bg-[#FEF3C7]"
                      >
                        <MessageSquarePlus className="size-3.5" /> New chat
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {savedConversations.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <History className="mx-auto mb-2 size-6 text-[#a3aaa2]" />
                          <p className="text-xs text-[#78827B]">No saved chats yet — start a conversation and it'll show up here.</p>
                        </div>
                      ) : (
                        <ul className="divide-y divide-[#F4F1EA]">
                          {savedConversations.map((conversation) => (
                            <li key={conversation.id} className="group relative">
                              <button
                                type="button"
                                onClick={() => loadConversation(conversation)}
                                className={`flex w-full items-start gap-2 px-4 py-3 pr-9 text-left transition-colors hover:bg-[#FEF3C7]/60 ${
                                  conversation.id === conversationIdRef.current ? 'bg-[#FEF3C7]/50' : ''
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-[#26332E]">{conversation.title}</p>
                                  <p className="mt-0.5 truncate text-[11px] text-[#78827B]">
                                    {[conversation.subjectTitle, conversation.topicTitle].filter(Boolean).join(' · ') || 'General'}
                                    {' · '}{formatConversationAge(conversation.updatedAt)}
                                  </p>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => removeConversation(e, conversation.id)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#a3aaa2] opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                                aria-label="Delete conversation"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Motion.div>
                )}
              </AnimatePresence>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearConversation}
                className="h-9 shrink-0 rounded-lg px-2.5 text-xs font-semibold text-[#78827B] hover:bg-[#FEF3C7] hover:text-[#B45309]"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="relative min-h-0 flex-1">
          <div ref={messagesScrollRef} onScroll={onMessagesScroll} className="absolute inset-0 overflow-y-auto overscroll-contain bg-white px-4 py-4 sm:px-5">
          {messages.length > 0 ? (
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {messages.map((msg, i) => (
                      <Motion.div
                        key={msg.id || i}
                        layout
                        initial={{ opacity: 0, y: 14, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                        className={cn('flex w-full', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                      >
                        <div className={cn(
                          'flex items-end gap-2',
                          msg.role === 'user'
                            ? 'max-w-[85%] flex-row-reverse'
                            : (!msg.streaming && !msg.thinking && ['quiz', 'flashcards', 'mind_map', 'notes', 'explain', 'homework_help'].includes(msg.mode))
                              ? 'w-full flex-row'
                              : 'max-w-[85%] flex-row'
                        )}>
                          <Motion.div
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.25, delay: 0.05 }}
                            className={cn(
                              'flex size-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
                              msg.role === 'user'
                                ? 'border-[#26332E] bg-[#26332E] text-white'
                                : msg.error
                                  ? 'border-rose-200 bg-rose-100 text-rose-600'
                                  : 'border-[#E7E3D9] bg-[#FEF3C7] text-[#F59E0B]'
                            )}
                          >
                            {msg.role === 'user' ? 'You' : <Bot className="size-4" />}
                          </Motion.div>
                          <div
                            className={cn(
                              'min-w-0 text-sm leading-relaxed',
                              msg.role === 'user' ? 'whitespace-pre-wrap break-words rounded-2xl px-4 py-3 shadow-sm' : '',
                              msg.role === 'user'
                                ? 'rounded-br-sm bg-[#F59E0B] text-white'
                                : msg.thinking
                                  ? 'rounded-2xl rounded-bl-sm border border-[#E7E3D9] bg-white px-4 py-3 shadow-sm text-slate-800'
                                  : msg.error
                                  ? 'rounded-2xl rounded-bl-sm border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm text-rose-700'
                                  : (!msg.streaming && ['quiz', 'flashcards', 'mind_map', 'notes', 'explain', 'homework_help'].includes(msg.mode))
                                    ? 'w-full'
                                    : 'rounded-2xl rounded-bl-sm border border-[#E7E3D9] bg-white px-4 py-3 shadow-sm text-slate-800'
                            )}
                          >
                            {msg.thinking ? (
                              <div className="flex min-w-[120px] items-center gap-2 text-slate-500">
                                <span className="text-sm font-medium">Thinking</span>
                                <span className="flex items-center gap-1">
                                  {[0, 0.15, 0.3].map((delay) => (
                                    <Motion.span
                                      key={delay}
                                      animate={{ y: [0, -5, 0] }}
                                      transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut', delay }}
                                      className="size-1.5 rounded-full bg-[#F59E0B]"
                                    />
                                  ))}
                                </span>
                              </div>
                            ) : (
                              msg.role === 'assistant' ? (
                                <>
                                  {msg.streaming
                                    ? <TutorMessageContent text={msg.text} />
                                    : <TutorResponseRenderer text={msg.text} mode={msg.mode} />
                                  }
                                  {msg.streaming && (
                                    <span className="ml-1 inline-block h-4 w-1 animate-pulse rounded-full bg-[#F59E0B] align-middle" />
                                  )}
                                </>
                              ) : msg.text
                            )}
                            {msg.role === 'assistant' && !msg.error && !msg.thinking && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className={cn(
                                  'text-[11px] font-medium',
                                  msg.noMaterialFound ? 'text-amber-700' : 'text-[#F59E0B]'
                                )}>
                                  {msg.noMaterialFound
                                    ? 'No matching uploaded material found'
                                    : msg.groundedInMaterial
                                      ? 'Grounded in your teacher\'s material'
                                      : 'General answer from the tutor'}
                                </span>
                                {!msg.streaming && (
                                  <button
                                    type="button"
                                    onClick={() => copyMessage(msg)}
                                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#a3aaa2] transition-colors hover:bg-[#FEF3C7] hover:text-[#B45309]"
                                    aria-label="Copy answer"
                                  >
                                    {copiedId === msg.id
                                      ? <><Check className="size-3 text-[#F59E0B]" /> Copied</>
                                      : <><Copy className="size-3" /> Copy</>}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Motion.div>
                    ))}
                  </AnimatePresence>
                  <AnimatePresence>
                    {showFollowUps && (
                      <Motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, delay: 0.15 }}
                        className="flex flex-wrap items-center gap-2 pl-10"
                      >
                        <span className="w-full text-[11px] font-semibold uppercase tracking-wide text-[#a3aaa2]">Keep going</span>
                        {followUpsFor(lastMessage.mode).map((f) => (
                          <Motion.button
                            key={f.label}
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleSend({ text: f.text, chip: f.chip })}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E3D9] bg-white px-3 py-1.5 text-xs font-medium text-[#B45309] transition-colors hover:border-[#F59E0B] hover:bg-[#FEF3C7]"
                          >
                            <Sparkles className="size-3 text-[#F59E0B]" />
                            {f.label}
                          </Motion.button>
                        ))}
                      </Motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex h-full flex-col items-center justify-center px-2 text-center"
                >
                  <Motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-[#FEF3C7] text-[#F59E0B]"
                  >
                    <MessageCircleQuestion className="size-7" />
                  </Motion.div>
                  <p className="font-[Nunito] text-lg font-extrabold text-[#26332E]">Ask me anything, {studentFirstName}.</p>
                  <p className="mt-1 max-w-sm text-sm leading-relaxed text-[#78827B]">
                    Pick a subject up top for answers from your teacher’s material, or start with one of these:
                  </p>
                  <div className="mt-5 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
                    {STARTER_PROMPTS.map((starter) => {
                      const Icon = starter.icon;
                      return (
                        <Motion.button
                          key={starter.text}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => applyStarter(starter)}
                          className="flex items-center gap-2.5 rounded-xl border border-[#E7E3D9] bg-white px-3 py-2.5 text-left text-sm text-[#26332E] transition-colors hover:border-[#F3DFAE] hover:bg-[#FBF9F4]"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7] text-[#F59E0B]">
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[11px] font-semibold text-[#F59E0B]">{starter.mode}</span>
                            <span className="block truncate text-xs text-[#78827B]">{starter.text}</span>
                          </span>
                        </Motion.button>
                      );
                    })}
                  </div>
                </Motion.div>
              )}
          </div>
          <AnimatePresence>
            {showJump && (
              <Motion.button
                initial={{ opacity: 0, scale: 0.8, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={scrollMessagesToBottom}
                className="absolute bottom-3 right-4 z-10 flex size-9 items-center justify-center rounded-full border border-[#E7E3D9] bg-white text-[#F59E0B] shadow-md hover:bg-[#FEF3C7]"
                aria-label="Jump to latest message"
              >
                <ChevronDown className="size-5" />
              </Motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Composer */}
        <div className="border-t border-[#E7E3D9] bg-[#FBF9F4] px-4 py-3 sm:px-5">
          {/* Action selector */}
          <div className="mb-2.5 flex min-w-0 items-center gap-2">
            <span className="hidden shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#78827B] sm:inline-flex">
              <Sparkles className="size-3.5 text-[#F59E0B]" /> Do
            </span>
            {canScrollChipsLeft && (
              <button
                type="button"
                onClick={() => scrollChips(-1)}
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#E7E3D9] bg-white text-[#5c655f] shadow-sm hover:bg-[#FEF3C7] hover:text-[#26332E]"
                aria-label="Scroll actions left"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
            <div
              ref={chipsScrollRef}
              className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scroll-smooth whitespace-nowrap py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {COMPANION_CHIPS.map((chip) => {
                const Icon = chip.icon;
                const active = activeChip === chip.label;
                return (
                  <Motion.button
                    key={chip.label}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setActiveChip(chip.label)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'border-[#F59E0B] bg-[#F59E0B] text-white shadow-sm'
                        : 'border-[#E7E3D9] bg-white text-[#5c655f] hover:bg-[#FEF3C7]'
                    )}
                  >
                    <Icon className={cn('size-3.5', active ? 'text-white' : 'text-[#F59E0B]')} />
                    {chip.label}
                  </Motion.button>
                );
              })}
            </div>
            {canScrollChipsRight && (
              <button
                type="button"
                onClick={() => scrollChips(1)}
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#E7E3D9] bg-white text-[#5c655f] shadow-sm hover:bg-[#FEF3C7] hover:text-[#26332E]"
                aria-label="Scroll actions right"
              >
                <ChevronRight className="size-4" />
              </button>
            )}
          </div>

          <input
            ref={attachmentInputRef}
            type="file"
            className="hidden"
            onChange={handleAttachmentChange}
            aria-label="Attach a file"
          />
          <AnimatePresence>
            {attachmentName && (
              <Motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#FEF3C7] px-3 py-1 text-xs font-medium text-[#B45309]"
              >
                <Paperclip className="size-3.5" />
                <span className="max-w-[220px] truncate">{attachmentName}</span>
              </Motion.div>
            )}
          </AnimatePresence>

          <div ref={composerRef} className="flex items-end gap-2 rounded-full border border-[#E7E3D9] bg-white p-1.5 shadow-[0_8px_24px_-18px_rgba(38,51,46,0.6)] focus-within:border-[#F59E0B]">
            {/* <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={openAttachmentPicker}
                  className="size-9 shrink-0 rounded-xl text-[#5c655f] hover:bg-[#FEF3C7] hover:text-[#26332E]"
                >
                  <Plus className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach notes or homework</TooltipContent>
            </Tooltip> */}

            {supportsVoice && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Motion.button
                    type="button"
                    onClick={toggleVoice}
                    animate={listening ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                    transition={listening ? { duration: 1, repeat: Infinity } : { duration: 0.2 }}
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                      listening
                        ? 'bg-rose-500 text-white shadow-[0_0_0_4px_rgba(244,63,94,0.15)]'
                        : 'text-[#5c655f] hover:bg-[#FEF3C7] hover:text-[#26332E]'
                    )}
                    aria-label={listening ? 'Stop voice input' : 'Speak your question'}
                    aria-pressed={listening}
                  >
                    <Mic className="size-5" />
                  </Motion.button>
                </TooltipTrigger>
                <TooltipContent>{listening ? 'Listening… tap to stop' : 'Speak your question'}</TooltipContent>
              </Tooltip>
            )}

            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={listening ? 'Listening…' : (typedPlaceholder || `${activeChipMeta.label} — type your question…`)}
              rows={1}
              className="max-h-32 min-h-9 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm text-slate-800 shadow-none placeholder:text-slate-400 focus-visible:ring-0"
              style={{ color: '#1f2937', WebkitTextFillColor: '#1f2937', caretColor: '#1f2937' }}
            />

            <Motion.div whileTap={{ scale: 0.94 }}>
              <Button
                onClick={handleSend}
                disabled={sending || (!question.trim() && !topicTitle)}
                className="size-10 shrink-0 rounded-full bg-[#F59E0B] p-0 text-white hover:bg-[#D97706] disabled:opacity-40"
                aria-label={sending ? 'Sending' : 'Send message'}
              >
                {sending
                  ? <Motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} className="block size-4 rounded-full border-2 border-white/40 border-t-white" />
                  : <Send className="size-4" />}
              </Button>
            </Motion.div>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-[#a3aaa2]">
            Press <kbd className="rounded border border-[#E7E3D9] bg-white px-1 font-sans text-[10px] text-[#78827B]">Enter</kbd> to send · <kbd className="rounded border border-[#E7E3D9] bg-white px-1 font-sans text-[10px] text-[#78827B]">Shift + Enter</kbd> for a new line
          </p>
        </div>
      </Panel>
    </Section>
  );
}

function MiniChart({ points, color = '#4f46e5' }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * 100;
    const y = 34 - ((point - min) / Math.max(max - min, 1)) * 28;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 38" className="h-10 w-full" preserveAspectRatio="none" aria-hidden="true">
      <Motion.polyline
        points={coords}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
      />
    </svg>
  );
}

function SmartInsights() {
  return (
    <Section>
      <SectionHeading eyebrow="Personalized analytics" title="Smart Insights" />
      <Motion.div
        variants={staggerChildren}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.12 }}
        className="grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        {SMART_INSIGHTS.map((insight) => {
          const Icon = insight.icon;
          return (
            <Motion.div key={insight.label} variants={fadeInUp} whileHover={scaleOnHover}>
              <Card className="h-full rounded-2xl border border-slate-100 p-0 shadow-sm">
                <CardContent className="p-4">
                  <div className={cn('flex size-9 items-center justify-center rounded-xl', insight.color)}>
                    <Icon className="size-4" />
                  </div>
                  <p className="mt-4 text-xs font-semibold text-slate-500">{insight.label}</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-800">
                    {typeof insight.value === 'number'
                      ? <AnimatedCounter value={insight.value} suffix={insight.suffix} />
                      : insight.value}
                  </p>
                  <p className="text-[11px] text-slate-400">{insight.detail}</p>
                  <div className="mt-2"><MiniChart points={insight.trend} /></div>
                </CardContent>
              </Card>
            </Motion.div>
          );
        })}
      </Motion.div>
    </Section>
  );
}

function DailyMissions() {
  const [missions, setMissions] = useState(MISSIONS);
  const completed = missions.filter((mission) => mission.done).length;
  const toggleMission = (id) => {
    setMissions((current) => current.map((mission) => (
      mission.id === id ? { ...mission, done: !mission.done } : mission
    )));
  };

  return (
    <Section>
      <Card className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-0 shadow-sm">
        <CardContent className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <SectionHeading eyebrow="Complete all four" title={"Today's Missions"} />
            <Motion.div variants={staggerChildren} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid gap-2 sm:grid-cols-2">
              {missions.map((mission) => (
                <Motion.button
                  key={mission.id}
                  variants={fadeInUp}
                  onClick={() => toggleMission(mission.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                    mission.done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-white hover:border-indigo-200'
                  )}
                >
                  <Motion.span
                    animate={mission.done ? { scale: [0.8, 1.2, 1] } : { scale: 1 }}
                    className={cn('flex size-8 items-center justify-center rounded-full', mission.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400')}
                  >
                    {mission.done ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
                  </Motion.span>
                  <span className="flex-1">
                    <span className={cn('block text-sm font-semibold', mission.done ? 'text-emerald-800 line-through' : 'text-slate-700')}>{mission.label}</span>
                    <span className="text-xs text-slate-400">{mission.progress}</span>
                  </span>
                </Motion.button>
              ))}
            </Motion.div>
          </div>
          <div className="flex min-w-40 flex-col items-center rounded-2xl bg-slate-900 p-5 text-white">
            <Gift className="size-8 text-amber-300" />
            <p className="mt-2 text-2xl font-extrabold">+50 XP</p>
            <p className="text-xs text-slate-400">Daily reward</p>
            <Progress value={(completed / missions.length) * 100} className="mt-4 h-2 w-full bg-white/15" />
            <p className="mt-2 text-xs">{completed} of {missions.length} complete</p>
          </div>
        </CardContent>
      </Card>
    </Section>
  );
}

function LearningGames() {
  return (
    <Section>
      <SectionHeading eyebrow="Learn by playing" title="Learning Games" />
      <Motion.div variants={staggerChildren} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LEARNING_GAMES.map((game) => {
          const Icon = game.icon;
          return (
            <Motion.div key={game.title} variants={fadeInUp} whileHover={glowHover}>
              <Card className="group h-full rounded-2xl border-0 p-0 shadow-sm">
                <div className={cn('relative flex h-28 items-center justify-center bg-gradient-to-br', game.color)}>
                  <Icon className="size-12 text-white transition-transform group-hover:scale-110" />
                  <Badge className="absolute right-3 top-3 border-0 bg-black/20 text-white">+{game.xp} XP</Badge>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-bold text-slate-800">{game.title}</h3>
                  <p className="mt-1 min-h-9 text-xs leading-relaxed text-slate-500">{game.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <Badge variant="outline">{game.difficulty}</Badge>
                    <Button size="sm" className="gap-1 rounded-lg"><Play className="size-3 fill-current" /> Play</Button>
                  </div>
                </CardContent>
              </Card>
            </Motion.div>
          );
        })}
      </Motion.div>
    </Section>
  );
}

function ExamPreparationCenter() {
  return (
    <Section>
      <SectionHeading eyebrow="Get exam ready" title="Exam Preparation Center" />
      <Motion.div variants={staggerChildren} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {EXAM_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Motion.button key={tool.title} variants={fadeInUp} whileHover={scaleOnHover} className={cn('group relative min-h-40 overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-left text-white shadow-lg', tool.color)}>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm"><Icon className="size-6" /></div>
              <h3 className="mt-5 text-lg font-bold">{tool.title}</h3>
              <p className="mt-1 text-sm text-white/75">{tool.detail}</p>
              <ArrowRight className="absolute bottom-5 right-5 size-5 transition-transform group-hover:translate-x-1" />
            </Motion.button>
          );
        })}
      </Motion.div>
    </Section>
  );
}

function FriendsLeaderboard() {
  return (
    <Section>
      <SectionHeading eyebrow="Learn together" title="Friends & Leaderboard" />
      <Card className="rounded-3xl border border-slate-100 p-0 shadow-sm">
        <CardContent className="p-5 sm:p-7">
          <Tabs defaultValue="weekly">
            <TabsList className="mb-6">
              <TabsTrigger value="weekly">Weekly XP</TabsTrigger>
              <TabsTrigger value="friends">Friends</TabsTrigger>
              <TabsTrigger value="challenges">Challenges</TabsTrigger>
            </TabsList>
            <TabsContent value="weekly">
              <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
                <div className="flex min-h-56 items-end justify-center gap-3 rounded-2xl bg-slate-50 px-3 pt-8">
                  {[LEADERBOARD[1], LEADERBOARD[0], LEADERBOARD[2]].map((student) => (
                    <Motion.div
                      key={student.name}
                      initial={{ height: 0, opacity: 0 }}
                      whileInView={{ height: student.rank === 1 ? 180 : student.rank === 2 ? 145 : 120, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, delay: student.rank * 0.1 }}
                      className={cn('relative flex w-24 flex-col items-center justify-start rounded-t-2xl p-3 text-slate-800 sm:w-32', student.color)}
                    >
                      {student.rank === 1 && <Crown className="absolute -top-8 size-6 text-amber-500" />}
                      <span className="flex size-10 items-center justify-center rounded-full bg-white text-xs font-bold shadow">{student.initials}</span>
                      <p className="mt-2 text-sm font-bold">{student.name}</p>
                      <p className="text-xs">{student.xp} XP</p>
                      <span className="mt-auto text-2xl font-extrabold">#{student.rank}</span>
                    </Motion.div>
                  ))}
                </div>
                <div className="space-y-2">
                  {LEADERBOARD.map((student) => (
                    <div key={student.name} className={cn('flex items-center gap-3 rounded-xl border p-3', student.name === STUDENT.name ? 'border-indigo-200 bg-indigo-50' : 'border-slate-100')}>
                      <span className="w-5 text-sm font-bold text-slate-400">{student.rank}</span>
                      <span className={cn('flex size-9 items-center justify-center rounded-full text-xs font-bold', student.color)}>{student.initials}</span>
                      <span className="flex-1 text-sm font-semibold text-slate-700">{student.name}</span>
                      <span className="text-sm font-bold text-indigo-600">{student.xp} XP</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="friends"><div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-600">12 friends studied this week. You are in the top 25%.</div></TabsContent>
            <TabsContent value="challenges"><div className="rounded-2xl bg-violet-50 p-8 text-center text-sm text-violet-700">The 500 XP weekend challenge starts in 2 days.</div></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </Section>
  );
}

function LearningCalendar() {
  const activity = Array.from({ length: 84 }, (_, index) => ((index * 7 + index % 5) % 5));
  return (
    <Section>
      <SectionHeading eyebrow="12-week activity" title="Learning Calendar" action={<Badge className="gap-1 border-0 bg-orange-100 text-orange-700"><Flame className="size-3" /> 15 day streak</Badge>} />
      <Card className="rounded-3xl border border-slate-100 p-0 shadow-sm">
        <CardContent className="p-5 sm:p-7">
          <ScrollArea className="w-full">
            <div className="grid min-w-[650px] grid-flow-col grid-rows-7 gap-1.5 pb-3">
              {activity.map((level, index) => (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <Motion.div
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.006 }}
                      className={cn(
                        'size-5 rounded',
                        level === 0 && 'bg-slate-100',
                        level === 1 && 'bg-emerald-100',
                        level === 2 && 'bg-emerald-300',
                        level === 3 && 'bg-emerald-500',
                        level === 4 && 'bg-emerald-700'
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{level ? `${level * 12} minutes studied` : 'No activity'}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <div className="mt-3 flex flex-wrap gap-5 text-xs text-slate-500">
            <span><strong className="text-slate-800">56</strong> days studied</span>
            <span><strong className="text-slate-800">18h 42m</strong> total time</span>
            <span><strong className="text-slate-800">Tuesday</strong> most active</span>
          </div>
        </CardContent>
      </Card>
    </Section>
  );
}

function RewardsShop() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Spend your rewards"
        title="Rewards Shop"
        action={<div className="flex gap-2"><Badge className="gap-1 border-0 bg-amber-100 text-amber-700"><Coins className="size-3" /> 980 coins</Badge><Badge className="gap-1 border-0 bg-indigo-100 text-indigo-700"><Zap className="size-3" /> 2,840 XP</Badge></div>}
      />
      <Motion.div variants={staggerChildren} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {REWARDS.map((reward) => {
          const Icon = reward.icon;
          return (
            <Motion.div key={reward.title} variants={fadeInUp} whileHover={scaleOnHover}>
              <Card className="group h-full rounded-2xl border border-slate-100 p-0 shadow-sm">
                <div className={cn('relative flex h-28 items-center justify-center bg-gradient-to-br', reward.color)}>
                  <Icon className="size-12 text-white transition-transform group-hover:rotate-6 group-hover:scale-110" />
                  {!reward.unlocked && <LockKeyhole className="absolute right-3 top-3 size-4 text-white/80" />}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-bold text-slate-800">{reward.title}</h3>
                  <Button variant={reward.unlocked ? 'default' : 'outline'} size="sm" className="mt-3 w-full gap-1 rounded-lg">
                    <Coins className="size-3" /> {reward.cost}
                  </Button>
                </CardContent>
              </Card>
            </Motion.div>
          );
        })}
      </Motion.div>
    </Section>
  );
}

function SubjectPerformance() {
  return (
    <Section>
      <SectionHeading eyebrow="Deep progress view" title="Subject Performance" />
      <Motion.div variants={staggerChildren} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid gap-4 sm:grid-cols-2">
        {SUBJECT_PERFORMANCE.map((subject) => {
          const Icon = subject.icon;
          return (
            <Motion.div key={subject.name} variants={fadeInUp} whileHover={glowHover}>
              <Card className="h-full rounded-2xl border border-slate-100 p-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex size-11 items-center justify-center rounded-xl bg-gradient-to-br text-white', subject.color)}><Icon className="size-5" /></div>
                    <div className="flex-1"><h3 className="font-bold text-slate-800">{subject.name}</h3><Badge variant="outline" className="mt-1">{subject.mastery}</Badge></div>
                    <span className="text-2xl font-extrabold text-slate-800">{subject.completion}%</span>
                  </div>
                  <div className="mt-5"><AnimatedProgress value={subject.completion} /></div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                    <div><p className="text-slate-400">Average score</p><p className="mt-1 font-bold text-slate-700">{subject.score}%</p></div>
                    <div><p className="text-slate-400">Time spent</p><p className="mt-1 font-bold text-slate-700">{subject.time}</p></div>
                    <div><p className="text-slate-400">Mastery</p><p className="mt-1 font-bold text-slate-700">{subject.mastery}</p></div>
                  </div>
                </CardContent>
              </Card>
            </Motion.div>
          );
        })}
      </Motion.div>
    </Section>
  );
}

function AchievementWall() {
  const particles = Array.from({ length: 10 }, (_, index) => index);
  return (
    <Section>
      <SectionHeading eyebrow="Celebrate your progress" title="Motivational Achievement Wall" />
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-6 text-white shadow-2xl sm:p-8">
        {particles.map((particle) => (
          <Motion.span
            key={particle}
            animate={{ y: [20, -80], opacity: [0, 0.8, 0], scale: [0.6, 1.2] }}
            transition={{ duration: 4 + particle % 3, repeat: Infinity, delay: particle * 0.35 }}
            className="absolute size-1.5 rounded-full bg-amber-300"
            style={{ left: `${8 + particle * 9}%`, bottom: `${particle % 3 * 8}%` }}
          />
        ))}
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <Motion.div
              animate={{ boxShadow: ['0 0 10px rgba(250,204,21,.2)', '0 0 35px rgba(250,204,21,.65)', '0 0 10px rgba(250,204,21,.2)'] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500"
            >
              <Trophy className="size-12" />
              <Motion.span animate={{ x: [-80, 100] }} transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1 }} className="absolute inset-y-0 w-7 rotate-12 bg-white/35 blur-sm" />
            </Motion.div>
            <div><p className="text-xs font-bold uppercase text-amber-300">Latest badge earned</p><h3 className="mt-1 text-2xl font-bold">Quiz Master</h3><p className="mt-1 text-sm text-slate-300">Scored 90%+ on 10 quizzes</p></div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase text-violet-300">Next badge</p><h3 className="mt-1 text-lg font-bold">Genius Thinker</h3></div><BrainCircuit className="size-9 text-violet-300" /></div>
            <div className="mt-5 flex justify-between text-xs text-slate-300"><span>74 / 100 AI questions</span><span>520 XP needed</span></div>
            <Progress value={74} className="mt-2 h-2 bg-white/15" />
            <div className="mt-5 flex gap-2">
              {ACHIEVEMENTS.slice(0, 4).map((badge) => { const Icon = badge.icon; return <div key={badge.id} className={cn('flex size-10 items-center justify-center rounded-xl bg-gradient-to-br', RARITY_STYLES[badge.rarity])}><Icon className="size-5" /></div>; })}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 6 — Subject Explorer
// ---------------------------------------------------------------------------

function SubjectCard({ subject, onExplore }) {
  const Icon = subject.icon;
  return (
    <Motion.div
      variants={fadeInUp}
      whileHover={{ y: -6, scale: 1.02 }}
      className="h-full"
    >
      <Card className="group h-full rounded-2xl border border-[#E7E3D9] bg-white p-0 shadow-[0_1px_2px_rgba(38,51,46,0.04)] transition-colors hover:border-[#F3DFAE] hover:bg-[#FBF9F4]">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex size-12 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#F59E0B] transition-colors group-hover:bg-[#F59E0B] group-hover:text-white">
            <Icon className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#26332E]">{subject.name}</h3>
            <p className="text-xs text-[#78827B]">{subject.topicsCount} topic{subject.topicsCount === 1 ? '' : 's'} published</p>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-[#78827B]">
              <span>Progress</span>
              <span className="font-semibold text-[#26332E]">{subject.progress}%</span>
            </div>
            <AnimatedProgress value={subject.progress} className="bg-[#EFEDE5] [&>*]:bg-[#F59E0B]" />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExplore?.(subject)}
            className="mt-auto w-full gap-1.5 rounded-lg border-[#E7E3D9] text-[#B45309] hover:bg-[#FEF3C7] hover:text-[#B45309]"
          >
            Explore
            <ChevronRight className="size-3.5" />
          </Button>
        </CardContent>
      </Card>
    </Motion.div>
  );
}

function useSubjectExplorerData() {
  const { subjects: curriculum, status: curriculumStatus } = useStudentCurriculum();
  const [progressBySubject, setProgressBySubject] = useState({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const { data } = await fetchCachedJson(`${API_BASE}/api/lesson-plans/student/smart-learning-overview`, {
          forceRefresh: true,
          ttlMs: 1,
          fetchOptions: { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } },
        });
        if (cancelled) return;
        const map = {};
        (data?.subjects || []).forEach((s) => { map[s.key] = s.progress; });
        setProgressBySubject(map);
      } catch {
        // Progress is a nice-to-have; subjects/topics still render without it.
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const subjects = curriculum.map((subject) => ({
    id: subject.key,
    name: subject.title,
    topicsCount: subject.topics.length,
    progress: progressBySubject[subject.key] ?? 0,
    topics: subject.topics.map((t) => t.title),
  }));

  return { subjects, status: curriculumStatus };
}

function SubjectExplorer({ onExploreSubject }) {
  const { subjects, status } = useSubjectExplorerData();

  return (
    <Section>
      <SectionHeading eyebrow="Published by your teachers" title="Subject explorer" />
      {status === 'loading' && (
        <p className="text-sm text-[#78827B]">Loading your subjects…</p>
      )}
      {status !== 'loading' && subjects.length === 0 && (
        <Card className="rounded-2xl border border-dashed border-slate-200 p-8 text-center shadow-none">
          <p className="text-sm text-slate-500">Your teachers haven&apos;t published any subjects yet. Check back soon!</p>
        </Card>
      )}
      {subjects.length > 0 && (
        <Motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {subjects.map((subject) => {
            const visual = getSubjectVisual(subject.name);
            return (
              <SubjectCard
                key={subject.id}
                subject={{ ...subject, icon: visual.icon, color: visual.gradient }}
                onExplore={() => onExploreSubject({ ...subject, colorKey: visual.colorKey })}
              />
            );
          })}
        </Motion.div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 7 — Learning Streak
// ---------------------------------------------------------------------------

function LearningStreak() {
  return (
    <Section>
      <Card className="overflow-hidden rounded-3xl border-0 p-0 shadow-lg">
        <div className="relative bg-gradient-to-br from-orange-500 via-red-500 to-rose-500 p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-10 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <div className="flex items-center gap-4">
              <Motion.div
                animate={{ scale: [1, 1.15, 1], rotate: [0, -4, 4, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Flame className="size-16 text-yellow-200 drop-shadow-[0_0_12px_rgba(253,224,71,0.8)]" />
              </Motion.div>
              <div>
                <Motion.p
                  animate={{ opacity: [1, 0.7, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="text-4xl font-extrabold text-white sm:text-5xl"
                >
                  {STUDENT.streak} Day Streak
                </Motion.p>
                <p className="mt-1 text-sm text-orange-50">
                  You&apos;re on fire! Keep it up to unlock the next badge.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {WEEK_TRACKER.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className="text-[11px] font-medium text-orange-100">{d.day}</span>
                  <div
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full text-xs font-bold',
                      d.done ? 'bg-white text-orange-600 shadow-md' : 'bg-white/20 text-white/70'
                    )}
                  >
                    {d.done ? <Flame className="size-4" /> : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 8 — Achievements
// ---------------------------------------------------------------------------

function AchievementBadge({ badge }) {
  const Icon = badge.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Motion.div
          variants={fadeInUp}
          whileHover={{ y: -6, rotate: [0, -3, 3, 0] }}
          transition={{ duration: 0.4 }}
          className="flex cursor-pointer flex-col items-center gap-2"
        >
          <div
            className={cn(
              'relative flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-md sm:size-20',
              RARITY_STYLES[badge.rarity],
              !badge.earned && 'opacity-40 grayscale'
            )}
          >
            <Icon className="size-7 text-white sm:size-9" />
            {badge.earned && (
              <span className="pointer-events-none absolute -inset-y-6 -left-1/2 w-1/3 -skew-x-12 bg-white/40 opacity-0 group-hover:opacity-100" />
            )}
          </div>
          <p className="max-w-[5.5rem] text-center text-xs font-semibold text-slate-700">{badge.name}</p>
        </Motion.div>
      </TooltipTrigger>
      <TooltipContent>{badge.earned ? badge.description : `Locked — ${badge.description}`}</TooltipContent>
    </Tooltip>
  );
}

function Achievements() {
  return (
    <Section>
      <h2 className="mb-4 text-xl font-bold text-slate-800 sm:text-2xl">Achievements</h2>
      <Card className="rounded-2xl border border-slate-100 p-0 shadow-sm">
        <CardContent className="p-6">
          <Motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-3 gap-4 sm:grid-cols-6"
          >
            {ACHIEVEMENTS.map((badge) => (
              <AchievementBadge key={badge.id} badge={badge} />
            ))}
          </Motion.div>
        </CardContent>
      </Card>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 10 — Recommended For You
// ---------------------------------------------------------------------------

const DIFFICULTY_STYLES = {
  Easy: 'bg-emerald-100 text-emerald-700',
  Medium: 'bg-amber-100 text-amber-700',
  Hard: 'bg-rose-100 text-rose-700',
};

function RecommendedCard({ item }) {
  const Icon = item.icon;
  return (
    <Motion.div variants={fadeInUp} whileHover={{ scale: 1.03 }} className="min-w-[230px] sm:min-w-[250px]">
      <Card className="h-full overflow-hidden rounded-2xl border-0 p-0 shadow-sm transition-shadow hover:shadow-lg">
        <div className={cn('flex h-28 items-center justify-center bg-gradient-to-br', item.color)}>
          <Icon className="size-12 text-white/90" />
        </div>
        <CardContent className="space-y-2 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{item.type}</span>
          <h4 className="text-sm font-bold text-slate-800">{item.title}</h4>
          <div className="flex items-center justify-between pt-1">
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Clock className="size-3.5" />
              {item.duration}
            </span>
            <Badge className={cn('border-0', DIFFICULTY_STYLES[item.difficulty])}>{item.difficulty}</Badge>
          </div>
        </CardContent>
      </Card>
    </Motion.div>
  );
}

function RecommendedForYou() {
  return (
    <Section>
      <h2 className="mb-4 text-xl font-bold text-slate-800 sm:text-2xl">Recommended For You</h2>
      <ScrollArea className="w-full">
        <Motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="flex gap-4 pb-3"
        >
          {RECOMMENDED.map((item) => (
            <RecommendedCard key={item.id} item={item} />
          ))}
        </Motion.div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 11 — Motivational Footer
// ---------------------------------------------------------------------------

function MotivationalFooter() {
  return (
    <Section>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-8 text-center shadow-xl sm:p-12">
        <Motion.div {...floatingAnimation(0, 10, 3.5)} className="absolute left-6 top-6 text-yellow-200/80">
          <Star className="size-7" />
        </Motion.div>
        <Motion.div {...floatingAnimation(0.5, 12, 4)} className="absolute right-8 top-10 text-white/70">
          <Rocket className="size-8 -rotate-45" />
        </Motion.div>
        <Motion.div {...floatingAnimation(0.3, 9, 3.2)} className="absolute bottom-6 left-1/4 text-amber-200/80">
          <Trophy className="size-7" />
        </Motion.div>
        <Motion.div {...floatingAnimation(0.8, 11, 3.8)} className="absolute bottom-8 right-1/4 text-white/60">
          <Sparkles className="size-6" />
        </Motion.div>

        <h2 className="relative z-10 text-xl font-extrabold text-white sm:text-3xl">
          Small steps every day lead to big achievements.
        </h2>
        <p className="relative z-10 mt-2 text-sm text-indigo-100 sm:text-base">
          Keep learning. Keep growing.
        </p>
      </div>
    </Section>
  );
}

// ===========================================================================
// Consolidated calm sections — 24 blocks trimmed to 10
// ===========================================================================

// Today — the single next step + a quiet stat strip.
// (merges Learning Journey · Continue Where You Left Off · AI Recommended · Daily Goals)
function TodayFocus({ onResume }) {
  const active = LEARNING_JOURNEY.find((s) => s.state === 'active') || LEARNING_JOURNEY[0];
  return (
    <Section>
      <SectionHeading eyebrow="Up next" title="Take the Fractions quiz" />
      <Panel className="overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
          <div className="p-6 sm:p-7">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#78827B]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[#B45309]">
                <Calculator className="size-3.5" /> Mathematics
              </span>
              <span>· Fractions and Decimals · lesson 7</span>
            </div>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#5c655f]">
              You solved 8 of 12 practice questions. {active.subtitle === 'Ready now' ? 'The quiz is ready' : active.subtitle} —
              finish it to unlock the AI review and bank <span className="font-semibold text-[#C07A4C]">+120 XP</span>.
            </p>

            <div className="mt-5 flex items-center gap-3">
              {LEARNING_JOURNEY.map((step, i) => (
                <div key={step.title} className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          'flex size-8 items-center justify-center rounded-full border text-[11px] font-bold',
                          step.state === 'complete' && 'border-[#F59E0B] bg-[#F59E0B] text-white',
                          step.state === 'active' && 'border-[#C07A4C] bg-[#F4E9DE] text-[#C07A4C]',
                          step.state === 'upcoming' && 'border-[#E7E3D9] bg-white text-[#a8afa8]'
                        )}
                      >
                        {step.state === 'complete' ? <CircleCheck className="size-4" /> : i + 1}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{step.title} — {step.subtitle}</TooltipContent>
                  </Tooltip>
                  {i < LEARNING_JOURNEY.length - 1 && (
                    <span className={cn('h-px w-5', step.state === 'complete' ? 'bg-[#F59E0B]' : 'bg-[#E7E3D9]')} />
                  )}
                </div>
              ))}
            </div>

            <Button
              onClick={onResume}
              className="mt-6 h-11 gap-2 rounded-xl bg-[#F59E0B] px-5 text-sm font-semibold text-white hover:bg-[#D97706]"
            >
              <Play className="size-4 fill-current" /> Start the quiz
            </Button>
          </div>

          <div className="grid grid-cols-2 border-t border-[#E7E3D9] bg-[#FBF9F4] lg:border-l lg:border-t-0">
            {DAILY_GOALS.map((goal, i) => {
              const Icon = goal.icon;
              return (
                <div
                  key={goal.id}
                  className={cn(
                    'flex flex-col gap-1 p-5',
                    i % 2 === 0 && 'border-r border-[#E7E3D9]',
                    i < 2 && 'border-b border-[#E7E3D9]'
                  )}
                >
                  <Icon className="size-4 text-[#F59E0B]" />
                  <p className="mt-1 font-[Nunito] text-2xl font-extrabold text-[#26332E]">
                    <AnimatedCounter value={goal.value} suffix={goal.suffix} />
                  </p>
                  <p className="text-[11px] font-medium leading-tight text-[#78827B]">{goal.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
    </Section>
  );
}

// Ways to study — one calm grid. (merges Quick Actions · Learning Modes)
function WaysToStudy({ generatedItems = [], onClearGeneratedItems = () => {} }) {
  return (
    <Section>
      <SectionHeading eyebrow="Pick a way in" title="Ways to study" />
      {generatedItems.length > 0 && (
        <Motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-2xl border border-[#FDE9BD] bg-[#FFFDF7] p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#F59E0B]">Saved from AI tutor</p>
              <p className="text-sm font-semibold text-[#26332E]">Your latest generated quizzes, notes, and practice sets</p>
            </div>
            <button
              type="button"
              onClick={onClearGeneratedItems}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#78827B] transition-colors hover:bg-white hover:text-[#B45309]"
            >
              Clear saved
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {generatedItems.map((item) => {
              const meta = getGeneratedModeMeta(item.mode);
              const Icon = meta.icon;
              return (
                <Motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="min-w-0 rounded-xl border border-[#E7E3D9] bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7] text-[#F59E0B]">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-[#78827B]">
                        <span className="shrink-0">{item.typeLabel || meta.label}</span>
                        <span className="size-1 rounded-full bg-[#F3DFAE]" />
                        <span className="truncate">{formatGeneratedTime(item.generatedAt)}</span>
                      </div>
                      <h3 className="mt-1 line-clamp-1 text-sm font-bold text-[#26332E]">{item.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-snug text-[#78827B]">
                        {item.content || item.prompt || 'Generated study material'}
                      </p>
                      {(item.subject || item.topic) && (
                        <p className="mt-2 truncate text-[11px] font-medium text-[#F59E0B]">
                          {[item.subject, item.topic].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                </Motion.article>
              );
            })}
          </div>
        </Motion.div>
      )}
      <Motion.div
        variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {LEARNING_MODES.map((mode) => {
          const Icon = mode.icon;
          return (
            <Motion.button
              key={mode.title}
              variants={fadeInUp}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className="group flex items-start gap-3 rounded-2xl border border-[#E7E3D9] bg-white p-4 text-left transition-colors hover:border-[#F3DFAE] hover:bg-[#FBF9F4]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#F59E0B] transition-colors group-hover:bg-[#F59E0B] group-hover:text-white">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[#26332E]">{mode.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-[#78827B]">{mode.description}</span>
              </span>
            </Motion.button>
          );
        })}
      </Motion.div>
    </Section>
  );
}

// Continue — quiet reslist. (Continue Learning)
function ContinueLearningCalm() {
  return (
    <Section>
      <SectionHeading eyebrow="Half-finished" title="Continue learning" />
      <div className="grid gap-3 sm:grid-cols-2">
        {CONTINUE_LEARNING.map((item) => {
          const Icon = item.icon;
          return (
            <Panel key={item.id} className="flex items-center gap-4 p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#F59E0B]">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-bold text-[#26332E]">{item.subject}</p>
                  <span className="shrink-0 text-xs font-semibold text-[#78827B]">{item.progress}%</span>
                </div>
                <p className="truncate text-xs text-[#78827B]">{item.lesson}</p>
                <AnimatedProgress value={item.progress} className="mt-2 bg-[#EFEDE5] [&>*]:bg-[#F59E0B]" />
              </div>
              <Button size="icon" variant="ghost" className="size-9 shrink-0 rounded-full text-[#F59E0B] hover:bg-[#FEF3C7]">
                <PlayCircle className="size-5" />
              </Button>
            </Panel>
          );
        })}
      </div>
    </Section>
  );
}

// Progress — analytics in one place. (merges Smart Insights · Subject Performance)
function ProgressPanel() {
  return (
    <Section>
      <SectionHeading eyebrow="How it's going" title="Your progress" />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Panel className="p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#78827B]">This week</p>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5">
            {SMART_INSIGHTS.map((insight) => {
              const Icon = insight.icon;
              return (
                <div key={insight.label}>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#78827B]">
                    <Icon className="size-3.5 text-[#F59E0B]" /> {insight.label}
                  </div>
                  <p className="mt-1 font-[Nunito] text-lg font-extrabold text-[#26332E]">
                    {typeof insight.value === 'number'
                      ? <AnimatedCounter value={insight.value} suffix={insight.suffix} />
                      : insight.value}
                  </p>
                  <MiniChart points={insight.trend} color={C.teal} />
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="grid gap-3">
          {SUBJECT_PERFORMANCE.map((subject) => {
            const Icon = subject.icon;
            return (
              <Panel key={subject.name} className="p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#F59E0B]">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-bold text-[#26332E]">{subject.name}</p>
                      <span className="text-xs font-semibold text-[#78827B]">{subject.mastery} · {subject.score}%</span>
                    </div>
                    <AnimatedProgress value={subject.completion} className="mt-2 bg-[#EFEDE5] [&>*]:bg-[#F59E0B]" />
                  </div>
                  <span className="font-[Nunito] text-xl font-extrabold text-[#26332E]">{subject.completion}%</span>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

// Momentum — streak, week, and today's missions together.
// (merges Learning Streak · Daily Missions · Learning Calendar)
function MomentumPanel() {
  const [missions, setMissions] = useState(MISSIONS);
  const toggle = (id) => setMissions((m) => m.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const done = missions.filter((m) => m.done).length;
  return (
    <Section>
      <SectionHeading eyebrow="Keep the rhythm" title="Momentum" />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Panel className="flex flex-col justify-between gap-6 bg-[#F4E9DE] p-6" >
          <div className="flex items-center gap-4">
            <Motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              className="flex size-14 items-center justify-center rounded-2xl bg-white text-[#C07A4C] shadow-sm"
            >
              <Flame className="size-8" />
            </Motion.div>
            <div>
              <p className="font-[Nunito] text-3xl font-extrabold text-[#26332E]">{STUDENT.streak} days</p>
              <p className="text-sm text-[#8a6b52]">Your longest streak yet. Two more to a new badge.</p>
            </div>
          </div>
          <div className="flex justify-between">
            {WEEK_TRACKER.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[#8a6b52]">{d.day}</span>
                <span className={cn(
                  'flex size-8 items-center justify-center rounded-full',
                  d.done ? 'bg-[#C07A4C] text-white' : 'border border-[#e2cbb6] text-transparent'
                )}>
                  <Flame className="size-4" />
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#78827B]">Today's missions</p>
            <span className="text-xs font-semibold text-[#F59E0B]">{done} / {missions.length} done</span>
          </div>
          <div className="mt-4 grid gap-2">
            {missions.map((m) => (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                  m.done ? 'border-[#FDE68A] bg-[#FEF3C7]' : 'border-[#E7E3D9] bg-white hover:border-[#F3DFAE]'
                )}
              >
                <span className={cn(
                  'flex size-7 items-center justify-center rounded-full',
                  m.done ? 'bg-[#F59E0B] text-white' : 'border border-[#E7E3D9] text-[#a8afa8]'
                )}>
                  {m.done ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
                </span>
                <span className="flex-1">
                  <span className={cn('block text-sm font-semibold', m.done ? 'text-[#B45309] line-through' : 'text-[#26332E]')}>{m.label}</span>
                  <span className="text-xs text-[#78827B]">{m.progress}</span>
                </span>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </Section>
  );
}

// Achievements — badges, standings, and rewards. (merges Achievements · Wall · Leaderboard · Rewards Shop)
function AchievementsPanel() {
  return (
    <Section>
      <SectionHeading eyebrow="Earned along the way" title="Achievements" />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Panel className="p-5 sm:p-6">
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {ACHIEVEMENTS.map((badge) => {
              const Icon = badge.icon;
              return (
                <Tooltip key={badge.id}>
                  <TooltipTrigger asChild>
                    <div className="flex cursor-default flex-col items-center gap-2">
                      <span className={cn(
                        'flex size-14 items-center justify-center rounded-2xl',
                        badge.earned ? 'bg-[#FEF3C7] text-[#F59E0B]' : 'border border-dashed border-[#E7E3D9] text-[#c3c9c2]'
                      )}>
                        {badge.earned ? <Icon className="size-6" /> : <LockKeyhole className="size-5" />}
                      </span>
                      <span className="text-center text-[11px] font-semibold leading-tight text-[#5c655f]">{badge.name}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{badge.earned ? badge.description : `Locked — ${badge.description}`}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="mt-6 border-t border-[#E7E3D9] pt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-[#26332E]">Next: Genius Thinker</span>
              <span className="text-xs text-[#78827B]">74 / 100 AI questions</span>
            </div>
            <AnimatedProgress value={74} className="mt-2 bg-[#EFEDE5] [&>*]:bg-[#F59E0B]" />
          </div>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#78827B]">Class standings</p>
          <div className="mt-4 grid gap-1.5">
            {LEADERBOARD.map((row) => {
              const me = row.name === 'Koushik';
              return (
                <div
                  key={row.rank}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2',
                    me ? 'bg-[#FEF3C7]' : 'bg-transparent'
                  )}
                >
                  <span className="w-5 text-sm font-bold text-[#78827B]">{row.rank}</span>
                  <span className="flex size-8 items-center justify-center rounded-full bg-[#FBF9F4] text-[11px] font-bold text-[#F59E0B]">{row.initials}</span>
                  <span className={cn('flex-1 text-sm', me ? 'font-bold text-[#B45309]' : 'font-medium text-[#26332E]')}>
                    {row.name}{me && ' · you'}
                  </span>
                  <span className="text-xs font-semibold text-[#78827B]">{row.xp.toLocaleString()} XP</span>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex items-center gap-2 border-t border-[#E7E3D9] pt-4 text-xs text-[#78827B]">
            <Coins className="size-4 text-[#C07A4C]" />
            <span className="font-semibold text-[#26332E]">{STUDENT.xp.toLocaleString()} XP</span>
            <span>to spend — next up: Premium Frame (1,200)</span>
          </div>
        </Panel>
      </div>
    </Section>
  );
}

function ClosingNote() {
  return (
    <Section>
      <div className="rounded-[22px] border border-[#E7E3D9] bg-[#FBF9F4] px-6 py-10 text-center">
        <p className="mx-auto max-w-xl font-[Nunito] text-lg font-extrabold text-[#26332E] sm:text-xl">
          Small steps, every day. That&apos;s the whole trick.
        </p>
        <p className="mt-2 text-sm text-[#78827B]">See you tomorrow, {STUDENT.name}.</p>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AITutorHomeScreen({
  onStartLearning = () => {},
  onPracticeQuestions = () => {},
  onAskAiTutor = () => {},
  onExploreSubject = () => {},
}) {
  const [generatedStudyItems, setGeneratedStudyItems] = useState(loadGeneratedStudyMemory);

  const handleGeneratedStudyItem = useCallback((item) => {
    setGeneratedStudyItems((prev) => {
      const next = [item, ...prev].slice(0, MAX_GENERATED_STUDY_ITEMS);
      saveGeneratedStudyMemory(next);
      return next;
    });
  }, []);

  const clearGeneratedStudyItems = useCallback(() => {
    setGeneratedStudyItems([]);
    saveGeneratedStudyMemory([]);
  }, []);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="w-full bg-[#F4F1EA] font-[Inter,system-ui,sans-serif] text-[#26332E]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 p-4 sm:p-6 lg:p-10">
          <HeroBanner
            onStartLearning={onStartLearning}
            onPracticeQuestions={onPracticeQuestions}
            onAskAiTutor={onAskAiTutor}
          />
          <TodayFocus onResume={onStartLearning} />
          <WaysToStudy
            generatedItems={generatedStudyItems}
            onClearGeneratedItems={clearGeneratedStudyItems}
          />
          <AiTutorPanel onGeneratedStudyItem={handleGeneratedStudyItem} />
          <ContinueLearningCalm />
          <SubjectExplorer onExploreSubject={onExploreSubject} />
          <ProgressPanel />
          <MomentumPanel />
          <AchievementsPanel />
          <ClosingNote />
        </div>
      </div>
    </TooltipProvider>
  );
}

export { AiTutorPanel };
