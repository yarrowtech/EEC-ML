import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion, useInView } from 'framer-motion';
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
  ChevronLeft,
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
import { cn } from '@/lib/utils';
import { fetchCachedJson } from '@/utils/studentApiCache';

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

function HeroBanner({ onStartLearning, onPracticeQuestions, onAskAiTutor }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-6 shadow-xl sm:p-8 md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.25),_transparent_55%)]" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-10 h-72 w-72 rounded-full bg-fuchsia-300/20 blur-3xl" />

      <div className="relative z-10 grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        {/* Left */}
        <Motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="text-white"
        >
          <Motion.h1 variants={fadeInUp} className="text-2xl font-bold sm:text-3xl md:text-4xl">
            {getGreeting()}, {STUDENT.name} 👋
          </Motion.h1>
          <Motion.p variants={fadeInUp} className="mt-2 max-w-md text-base text-indigo-100 sm:text-lg">
            What would you like to learn today?
          </Motion.p>

          <Motion.div variants={fadeInUp} className="mt-5 flex flex-wrap gap-2">
            <Badge className="gap-1.5 border-0 bg-white/15 px-3 py-1.5 text-white backdrop-blur-sm">
              <Flame className="size-3.5 text-orange-300" />
              {STUDENT.streak} Day Streak
            </Badge>
            <Badge className="gap-1.5 border-0 bg-white/15 px-3 py-1.5 text-white backdrop-blur-sm">
              <Zap className="size-3.5 text-yellow-300" />
              {STUDENT.xp.toLocaleString()} XP
            </Badge>
            <Badge className="gap-1.5 border-0 bg-white/15 px-3 py-1.5 text-white backdrop-blur-sm">
              <Trophy className="size-3.5 text-amber-200" />
              Level {STUDENT.level}
            </Badge>
          </Motion.div>

          <Motion.div variants={fadeInUp} className="mt-7 flex flex-wrap gap-3">
            <Motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button
                onClick={onStartLearning}
                className="h-11 gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-indigo-700 shadow-[0_0_0_0_rgba(255,255,255,0.6)] hover:bg-white hover:shadow-[0_0_24px_4px_rgba(255,255,255,0.5)]"
              >
                <Rocket className="size-4" />
                Start Learning
              </Button>
            </Motion.div>
            <Motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button
                onClick={onPracticeQuestions}
                variant="outline"
                className="h-11 gap-2 rounded-xl border-white/40 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
              >
                <Target className="size-4" />
                Practice Questions
              </Button>
            </Motion.div>
            <Motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button
                onClick={onAskAiTutor}
                variant="outline"
                className="h-11 gap-2 rounded-xl border-white/40 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
              >
                <Bot className="size-4" />
                Ask AI Tutor
              </Button>
            </Motion.div>
          </Motion.div>
        </Motion.div>

        {/* Right — illustration */}
        <div className="relative mx-auto hidden h-64 w-full max-w-sm items-center justify-center sm:flex lg:h-72">
          <Motion.div
            className="absolute h-44 w-44 rounded-full bg-white/20 backdrop-blur-md sm:h-52 sm:w-52"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <Motion.div
            {...floatingAnimation(0, 10, 3.5)}
            className="relative z-10 flex h-28 w-28 items-center justify-center rounded-3xl bg-white/90 shadow-2xl sm:h-32 sm:w-32"
          >
            <Bot className="size-14 text-indigo-600 sm:size-16" />
          </Motion.div>

          <Motion.div
            {...floatingAnimation(0.4, 12, 4)}
            className="absolute left-2 top-2 flex size-12 items-center justify-center rounded-2xl bg-white/90 shadow-lg sm:left-4 sm:top-0"
          >
            <BookOpen className="size-6 text-blue-600" />
          </Motion.div>
          <Motion.div
            {...floatingAnimation(0.8, 10, 3.2)}
            className="absolute right-0 top-6 flex size-10 items-center justify-center rounded-2xl bg-white/90 shadow-lg sm:right-2"
          >
            <Star className="size-5 text-amber-500" />
          </Motion.div>
          <Motion.div
            {...floatingAnimation(1.1, 14, 4.5)}
            className="absolute bottom-2 left-0 flex size-12 items-center justify-center rounded-2xl bg-white/90 shadow-lg sm:left-2"
          >
            <GraduationCap className="size-6 text-fuchsia-600" />
          </Motion.div>
          <Motion.div
            {...floatingAnimation(0.6, 11, 3.8)}
            className="absolute bottom-4 right-4 flex size-9 items-center justify-center rounded-2xl bg-white/90 shadow-lg"
          >
            <Sparkles className="size-4 text-violet-600" />
          </Motion.div>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase text-indigo-600">{eyebrow}</p>}
        <h2 className="text-xl font-bold text-slate-800 sm:text-2xl">{title}</h2>
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
          ttlMs: 5 * 60 * 1000,
          fetchOptions: { headers: { Authorization: `Bearer ${token}` } },
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

function AiTutorPanel() {
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

  const handleSend = async () => {
    const mode = CHIP_MODES[activeChip];
    if (!mode) {
      setMessages((prev) => [...prev, { role: 'assistant', error: true, text: `${activeChip} isn't available yet.` }]);
      return;
    }
    if (!question.trim() && !topicTitle) return;

    const userLabel = [activeChip, topicTitle, question.trim()].filter(Boolean).join(' — ');
    const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const assistantId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', text: userLabel },
      { id: assistantId, role: 'assistant', thinking: true, text: '' },
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
          question: question.trim(),
          chapterTitle: chapterTitle || topicTitle || '',
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'AI Tutor request failed');
      setMessages((prev) => prev.map((msg) => (
        msg.id === assistantId
          ? {
              ...msg,
              thinking: false,
              text: payload.data.content,
              groundedInMaterial: payload.data.groundedInMaterial,
            }
          : msg
      )));
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
    <Section className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden">
      <SectionHeading eyebrow="Your always-on study partner" title="Study Companion" />
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-100 p-5 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,.22),transparent_35%)]" />
        <div className="relative z-10 grid gap-7 lg:h-full lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <Motion.div variants={slideInLeft} initial="hidden" whileInView="visible" viewport={{ once: true }} className="flex min-w-0 flex-col items-start gap-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <Motion.div
              animate={{ boxShadow: ['0 0 0px rgba(59,130,246,0.25)', '0 0 32px rgba(59,130,246,0.4)', '0 0 0px rgba(59,130,246,0.25)'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500"
            >
              <Bot className="size-9 text-white" />
            </Motion.div>
            <div>
              <h3 className="text-2xl font-bold text-slate-900">What are we learning?</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-600">
                Pick a subject and topic your teacher has published, or just ask a question.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 text-slate-900">
              <select
                value={subjectKey}
                onChange={(e) => { setSubjectKey(e.target.value); setTopicTitle(''); setChapterTitle(''); }}
                className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              >
                <option value="">
                  {curriculumStatus === 'loading' ? 'Loading subjects…' : curriculumStatus === 'empty' || curriculumStatus === 'error' ? 'No published subjects yet' : 'Choose a subject (optional)'}
                </option>
                {subjects.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
              </select>
              {subjectKey && (
                <select
                  value={topicTitle}
                  onChange={(e) => {
                    const selected = topics.find((t) => t.title === e.target.value);
                    setTopicTitle(e.target.value);
                    setChapterTitle(selected?.chapterTitle || '');
                  }}
                  className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                >
                  <option value="">Choose a chapter / topic (optional)</option>
                  {topics.map((t) => <option key={`${t.type}-${t.title}`} value={t.title}>{t.type}: {t.title}</option>)}
                </select>
              )}
            </div>

            <div className="mt-auto flex items-center gap-2 rounded-xl border border-green-200 bg-green-50/80 px-3 py-2 text-xs text-sky-700 shadow-sm backdrop-blur">
              <span className="size-2 rounded-full bg-green-500" />
              AI Tutor is online
            </div>
          </Motion.div>

          <Motion.div variants={slideInRight} initial="hidden" whileInView="visible" viewport={{ once: true }} className="flex min-w-0 flex-col gap-4 lg:h-full lg:min-h-0">
            <div className="flex min-w-0 items-center gap-2">
              {canScrollChipsLeft && (
                <button
                  type="button"
                  onClick={() => scrollChips(-1)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-white/80 text-slate-600 shadow-sm hover:bg-white hover:text-slate-900"
                  aria-label="Scroll actions left"
                >
                  <ChevronLeft className="size-4" />
                </button>
              )}
              <div
                ref={chipsScrollRef}
                className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scroll-smooth whitespace-nowrap py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {COMPANION_CHIPS.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <Motion.button
                      key={chip.label}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setActiveChip(chip.label)}
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm',
                        activeChip === chip.label
                          ? 'border-sky-300 bg-sky-500 text-white shadow-sm'
                          : 'border-sky-200 bg-white/70 text-slate-700 hover:bg-white'
                      )}
                    >
                      <Icon className={cn('size-3.5', activeChip === chip.label ? 'text-white' : 'text-sky-500')} />
                      {chip.label}
                    </Motion.button>
                  );
                })}
              </div>
              {canScrollChipsRight && (
                <button
                  type="button"
                  onClick={() => scrollChips(1)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-white/80 text-slate-600 shadow-sm hover:bg-white hover:text-slate-900"
                  aria-label="Scroll actions right"
                >
                  <ChevronRight className="size-4" />
                </button>
              )}
            </div>

            <div ref={messagesScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-2xl border border-sky-200 bg-white/80 p-3 shadow-inner backdrop-blur">
              {messages.length > 0 ? (
                <div className="space-y-3">
                  {messages.map((msg, i) => (
                    <div key={msg.id || i} className={cn('flex w-full', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div className={cn('flex max-w-[85%] items-end gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                        <div
                          className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
                            msg.role === 'user'
                              ? 'border-blue-300 bg-blue-500 text-white'
                              : msg.error
                                ? 'border-rose-200 bg-rose-100 text-rose-600'
                                : 'border-sky-200 bg-sky-50 text-sky-700'
                          )}
                        >
                          {msg.role === 'user' ? 'You' : <Bot className="size-4" />}
                        </div>
                        <div
                          className={cn(
                            'rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
                            msg.role === 'user'
                              ? 'rounded-br-sm bg-gradient-to-r from-sky-500 to-blue-600 text-white'
                              : msg.thinking
                                ? 'rounded-bl-sm border border-sky-200 bg-white text-slate-800'
                                : msg.error
                                ? 'rounded-bl-sm border border-rose-200 bg-rose-50 text-rose-700'
                                : 'rounded-bl-sm border border-sky-200 bg-white text-slate-800'
                          )}
                        >
                          {msg.thinking ? (
                            <div className="flex min-w-[120px] items-center gap-2 text-slate-500">
                              {/* <Bot className="size-4 text-sky-500" /> */}
                              <span className="text-sm font-medium">Thinking</span>
                              <span className="flex items-center gap-1">
                                <span className="size-1.5 animate-bounce rounded-full bg-sky-400 [animation-delay:0ms]" />
                                <span className="size-1.5 animate-bounce rounded-full bg-sky-400 [animation-delay:150ms]" />
                                <span className="size-1.5 animate-bounce rounded-full bg-sky-400 [animation-delay:300ms]" />
                              </span>
                            </div>
                          ) : (
                            msg.text
                          )}
                          {msg.role === 'assistant' && !msg.error && !msg.thinking && (
                            <div className="mt-2 text-[11px] font-medium text-sky-600">
                              {msg.groundedInMaterial ? 'Grounded in your teacher\'s material' : 'General answer from the tutor'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-[90px] items-center justify-center text-center">
                  <div className="max-w-sm">
                    <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                      <MessageCircleQuestion className="size-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">Your latest messages will stay here</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Send a question and the conversation will keep scrolling inside this panel, without moving the page.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-full border border-sky-200 bg-white/90 p-1 shadow-lg backdrop-blur-xl lg:shrink-0">
              <input
                ref={attachmentInputRef}
                type="file"
                className="hidden"
                onChange={handleAttachmentChange}
                aria-label="Attach a file"
              />
              {attachmentName && (
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                  <Paperclip className="size-3.5" />
                  <span className="max-w-[220px] truncate">{attachmentName}</span>
                </div>
              )}
              <div className="flex items-center justify-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={openAttachmentPicker}
                      className="size-9 shrink-0 rounded-full text-slate-700 hover:bg-sky-50 hover:text-slate-900"
                    >
                      <Plus className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach notes or homework</TooltipContent>
                </Tooltip>

                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask anything"
                  rows={1}
                  className="min-h-9 flex-1 resize-none bg-transparent px-0 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  style={{ color: '#1f2937', WebkitTextFillColor: '#1f2937', caretColor: '#1f2937' }}
                />

                {/* <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-9 shrink-0 rounded-full text-slate-700 hover:bg-sky-50 hover:text-slate-900"
                    >
                      <Mic className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Voice input</TooltipContent>
                </Tooltip> */}

                <Motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                  <Button
                    onClick={handleSend}
                    disabled={sending}
                    className="size-10 shrink-0 rounded-full bg-sky-500 p-0 text-white hover:bg-sky-600 disabled:opacity-50"
                    aria-label={sending ? 'Sending' : 'Send message'}
                  >
                    <Send className="size-4" />
                  </Button>
                </Motion.div>
              </div>
            </div>
          </Motion.div>
        </div>
      </div>
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
      <Card className="group h-full rounded-2xl border border-slate-100 p-0 shadow-sm transition-shadow hover:shadow-[0_8px_30px_rgba(99,102,241,0.18)]">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className={cn('flex size-12 items-center justify-center rounded-xl bg-gradient-to-br text-white transition-transform group-hover:-translate-y-1', subject.color)}>
            <Icon className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">{subject.name}</h3>
            <p className="text-xs text-slate-500">{subject.topicsCount} topic{subject.topicsCount === 1 ? '' : 's'} published</p>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
              <span>Progress</span>
              <span className="font-semibold text-slate-700">{subject.progress}%</span>
            </div>
            <AnimatedProgress value={subject.progress} />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExplore?.(subject)}
            className="mt-auto w-full gap-1.5 rounded-lg"
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
          ttlMs: 5 * 60 * 1000,
          fetchOptions: { headers: { Authorization: `Bearer ${token}` } },
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
      <h2 className="mb-4 text-xl font-bold text-slate-800 sm:text-2xl">Subject Explorer</h2>
      {status === 'loading' && (
        <p className="text-sm text-slate-500">Loading your subjects…</p>
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AITutorHomeScreen({
  onStartLearning = () => {},
  onPracticeQuestions = () => {},
  onAskAiTutor = () => {},
  onExploreSubject = () => {},
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex w-full flex-col gap-8 p-4 sm:p-6 lg:p-8">
        <HeroBanner
          onStartLearning={onStartLearning}
          onPracticeQuestions={onPracticeQuestions}
          onAskAiTutor={onAskAiTutor}
        />
        <LearningJourney />
        <QuickActions />
        <ContinueWhereLeftOff onResume={onStartLearning} />
        <AiRecommendedNext />
        <ContinueLearning />
        <DailyGoals />
        <LearningModes />
        <AiTutorPanel />
        <SmartInsights />
        <DailyMissions />
        <SubjectExplorer onExploreSubject={onExploreSubject} />
        <SubjectPerformance />
        <LearningGames />
        <ExamPreparationCenter />
        <LearningStreak />
        <FriendsLeaderboard />
        <LearningCalendar />
        <Achievements />
        <RewardsShop />
        <RecommendedForYou />
        <AchievementWall />
        <MotivationalFooter />
      </div>
    </TooltipProvider>
  );
}
