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
  },
  {
    key: 'subjects',
    label: 'Subjects',
    hint: 'Chapters & topics',
    icon: GraduationCap,
    path: '/student/smart-learning-courses',
    matches: ['smart-learning-courses', 'smart-learning-courses-reference'],
  },
  {
    key: 'practice',
    label: 'Practice',
    hint: 'Papers & tests',
    icon: ClipboardList,
    path: '/student/practice-papers',
    matches: ['practice-papers'],
  },
  {
    key: 'materials',
    label: 'Materials',
    hint: 'From your teachers',
    icon: BookOpen,
    path: '/student/study-materials',
    matches: ['study-materials'],
  },
  {
    key: 'paths',
    label: 'My Paths',
    hint: 'Teacher learning paths',
    icon: Route,
    path: '/student/my-paths',
    matches: ['my-paths'],
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
    <div className="min-h-full w-full bg-[#F4F1EA] text-[#26332E]">
      {!isReadingTopic && (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#78827B]">One place to study</p>
            <h1 className="font-[Nunito] text-2xl font-extrabold text-[#26332E] sm:text-3xl">Learning</h1>
          </div>

          <div
            role="tablist"
            aria-label="Learning sections"
            className="grid grid-cols-2 gap-2 rounded-2xl border border-[#E7E3D9] bg-[#FBF9F4] p-2 sm:grid-cols-5 sm:gap-3 sm:p-2.5 lg:gap-4 lg:p-3"
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
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all sm:gap-3 sm:px-3.5 sm:py-3 lg:px-4 lg:py-3.5 ${
                    active
                      ? 'bg-linear-to-br from-amber-400 via-yellow-400 to-orange-500 text-white shadow-md shadow-amber-200/60'
                      : 'text-[#5c655f] hover:bg-[#EFEDE5]'
                  }`}
                >
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9 lg:size-10 ${
                    active ? 'bg-white/20' : 'bg-[#FEF3C7] text-[#F59E0B]'
                  }`}>
                    <Icon className="size-4 sm:size-4.5 lg:size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight lg:text-base">{tab.label}</span>
                    <span className={`block truncate text-[11px] sm:text-xs ${active ? 'text-white/80' : 'text-[#78827B]'}`}>
                      {tab.hint}
                    </span>
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
            className="group flex w-full items-center gap-3 rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] px-4 py-3 text-left transition-colors hover:border-[#F59E0B]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F59E0B] text-white">
              <Play className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[#F59E0B]">
                Continue where you left off
              </span>
              <span className="block truncate text-sm font-semibold text-[#26332E]">
                {lastActivity.label}
                {lastActivity.detail ? ` — ${lastActivity.detail}` : ''}
                <span className="ml-2 font-normal text-[#78827B]">{formatActivityAge(lastActivity.at)}</span>
              </span>
            </span>
            <span className="rounded-xl bg-[#F59E0B] px-4 py-2 text-sm font-bold text-white transition-transform group-hover:translate-x-0.5">
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
