import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { Bot, GraduationCap, ClipboardList, BookOpen, Play, Route } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AiTutorPanel } from './AITutorHomeScreen';
import AILearningCoursesLanding from './AILearningCoursesLanding';
import PracticePapersPortal from './PracticePapersPortal';
import StudyMaterials from './StudyMaterials';
import TeacherLearningPaths from './TeacherLearningPaths';
import {
  saveLearningActivity,
  getLearningActivity,
  formatActivityAge,
} from '../utils/learningContinuity';

// Glassmorphism panel recipe for the nav bar + continue card — frosted
// translucent white over the page's soft radial-gradient backdrop, matching
// Ref's Glassmorphism Learning Dashboard mockup 1:1.
const GLASS_PANEL = 'border border-white/70 bg-white/[0.55] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),0_2px_4px_-1px_rgba(0,0,0,0.02)] backdrop-blur-[20px] backdrop-saturate-[1.8]';

// One learning surface for students. Every tool the portal used to spread
// across two sidebar groups lives behind exactly four verbs; each tab keeps
// its canonical URL so old deep links (and the courses portal's internal
// routing) continue to work.
const TABS = [
  {
    key: 'tutor',
    label: 'AI Tutor',
    hint: 'Ask, quiz, review',
    icon: Bot,
    path: '/student/learning',
    matches: ['learning', 'smart-learning', 'smart-learning-tutor'],
    iconBg: '#fffbeb',
    iconColor: '#f59e0b',
  },
  {
    key: 'subjects',
    label: 'Subjects',
    hint: 'Chapters & topics',
    icon: GraduationCap,
    path: '/student/smart-learning-courses',
    matches: ['smart-learning-courses', 'smart-learning-courses-reference'],
    iconBg: 'rgba(139, 92, 246, 0.1)',
    iconColor: '#8b5cf6',
  },
  {
    key: 'practice',
    label: 'Practice',
    hint: 'Papers & tests',
    icon: ClipboardList,
    path: '/student/practice-papers',
    matches: ['practice-papers'],
    iconBg: '#f1f5f9',
    iconColor: '#475569',
  },
  {
    key: 'materials',
    label: 'Materials',
    hint: 'From your teachers',
    icon: BookOpen,
    path: '/student/study-materials',
    matches: ['study-materials'],
    iconBg: '#f1f5f9',
    iconColor: '#475569',
  },
  {
    key: 'paths',
    label: 'My Paths',
    hint: 'Teacher learning paths',
    icon: Route,
    path: '/student/my-paths',
    matches: ['my-paths'],
    iconBg: 'rgba(16, 185, 129, 0.1)',
    iconColor: '#10b981',
  },
];

const viewSegmentFromPath = (pathname) => {
  const match = String(pathname || '').match(/^\/(student|dashboard)\/([^/]+)/);
  return match?.[2] || 'learning';
};

const prettifySlug = (raw) => {
  const text = decodeURIComponent(String(raw || '')).replace(/[-_]+/g, ' ').trim();
  return text.replace(/\b\w/g, (ch) => ch.toUpperCase());
};

// Human-readable detail for deep subject/topic URLs, e.g.
// /student/smart-learning-courses/subject/physics/topic/motion → "Physics · Motion"
const detailFromPath = (pathname) => {
  const subject = pathname.match(/\/subject\/([^/]+)/)?.[1];
  const topic = pathname.match(/\/topic\/([^/]+)/)?.[1];
  return [subject, topic].filter(Boolean).map(prettifySlug).join(' · ');
};

const LearningHub = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = useMemo(() => {
    const segment = viewSegmentFromPath(location.pathname);
    return TABS.find((tab) => tab.matches.includes(segment)) || TABS[0];
  }, [location.pathname]);

  // A topic reader is a focused, full-bleed experience with its own header —
  // the "One place to study" title and tab bar above it would just be clutter.
  const isReadingTopic = activeTab.key === 'subjects' && /\/topic\//.test(location.pathname);

  // Snapshot the last activity once per mount so the card offers where the
  // student left off previously, not the page they are currently on.
  const [lastActivity] = useState(() => getLearningActivity());

  useEffect(() => {
    saveLearningActivity({
      path: location.pathname,
      label: activeTab.label,
      detail: detailFromPath(location.pathname),
    });
  }, [location.pathname, activeTab.label]);

  // Only offer Continue for a previous sitting (not the tab clicked a moment
  // ago) — anything older than 5 minutes counts as "left the app".
  const showContinue = Boolean(
    lastActivity &&
    lastActivity.path !== location.pathname &&
    Date.now() - Number(lastActivity.at || 0) > 5 * 60 * 1000
  );

  return (
    <div
      className="min-h-full w-full bg-[#f5f7fb] text-[#0f172a]"
      style={{
        backgroundImage: 'radial-gradient(at 0% 0%, rgba(139, 92, 246, 0.05) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.05) 0px, transparent 50%)',
      }}
    >
      {!isReadingTopic && (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.05em] text-[#64748b]">One place to study</p>
            <h1 className="text-2xl font-bold text-[#0f172a] sm:text-3xl">Learning</h1>
          </div>

          <div
            role="tablist"
            aria-label="Learning sections"
            className={`flex flex-wrap items-center justify-between gap-2 overflow-x-auto rounded-3xl p-2 sm:flex-nowrap sm:gap-4 sm:p-3 ${GLASS_PANEL}`}
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = tab.key === activeTab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => { if (!active) navigate(tab.path); }}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all sm:px-4 sm:py-3 ${
                    active
                      ? 'border border-white/90 bg-white/80 shadow-[0_4px_12px_rgba(139,92,246,0.1)]'
                      : 'border border-transparent hover:-translate-y-0.5 hover:bg-white/40'
                  }`}
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-[10px]"
                    style={{ backgroundColor: tab.iconBg, color: tab.iconColor }}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className={`min-w-0 flex-col ${active ? 'flex' : 'hidden sm:flex'}`}>
                    <span className="block text-[0.95rem] font-semibold leading-tight text-[#0f172a]">{tab.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-[#64748b]">{tab.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {showContinue && (
          <button
            type="button"
            onClick={() => navigate(lastActivity.path)}
            className={`group flex w-full flex-col items-start justify-between gap-5 rounded-3xl bg-white/[0.65] px-6 py-5 text-left transition-shadow hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.05),0_4px_6px_-2px_rgba(0,0,0,0.025)] sm:flex-row sm:items-center ${GLASS_PANEL}`}
          >
            <span className="flex min-w-0 items-center gap-5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#8b5cf6] text-white shadow-[0_4px_14px_rgba(139,92,246,0.3)] transition-transform group-hover:scale-105">
                <Play className="ml-0.5 size-4 fill-white stroke-none" />
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[0.7rem] font-bold uppercase tracking-[0.05em] text-[#8b5cf6]">
                  Continue where you left off
                </span>
                <span className="flex flex-wrap items-center gap-2 truncate text-[0.95rem] font-medium text-[#0f172a]">
                  {lastActivity.label}
                  {lastActivity.detail ? ` — ${lastActivity.detail}` : ''}
                  <span className="text-[0.85rem] font-normal text-[#64748b]">{formatActivityAge(lastActivity.at)}</span>
                </span>
              </span>
            </span>
            <span className="w-full shrink-0 rounded-xl bg-[#10b981] px-6 py-3 text-center text-sm font-semibold text-white shadow-[0_4px_12px_rgba(16,185,129,0.2)] transition-all group-hover:-translate-y-0.5 group-hover:bg-[#059669] group-hover:shadow-[0_6px_16px_rgba(16,185,129,0.3)] sm:w-auto">
              Continue
            </span>
          </button>
        )}

        {activeTab.key === 'tutor' && (
          <Motion.div
            key="tutor"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <TooltipProvider delayDuration={150}>
              <AiTutorPanel />
            </TooltipProvider>
          </Motion.div>
        )}
      </div>
      )}

      {activeTab.key === 'subjects' && (
        <Motion.div
          key="subjects"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <AILearningCoursesLanding />
        </Motion.div>
      )}
      {activeTab.key === 'practice' && (
        <Motion.div
          key="practice"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <PracticePapersPortal />
        </Motion.div>
      )}
      {activeTab.key === 'materials' && (
        <Motion.div
          key="materials"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <StudyMaterials />
        </Motion.div>
      )}
      {activeTab.key === 'paths' && (
        <Motion.div
          key="paths"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 lg:px-8"
        >
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#78827B]">Assigned by your teacher</p>
            <h2 className="font-[Nunito] text-xl font-extrabold text-[#26332E] sm:text-2xl">My Learning Paths</h2>
          </div>
          <TeacherLearningPaths />
        </Motion.div>
      )}
    </div>
  );
};

export default LearningHub;
