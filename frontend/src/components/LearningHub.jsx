import React, { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { Bot, GraduationCap, ClipboardList, BookOpen, Route } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AiTutorPanel } from './AITutorHomeScreen';
import AILearningCoursesLanding from './AILearningCoursesLanding';
import PracticePapersPortal from './PracticePapersPortal';
import StudyMaterials from './StudyMaterials';
import TeacherLearningPaths from './TeacherLearningPaths';
import {
  saveLearningActivity,
  getLearningActivity,
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

const LearningHub = () => {
  const location = useLocation();

  const activeTab = useMemo(() => {
    const segment = viewSegmentFromPath(location.pathname);
    return TABS.find((tab) => tab.matches.includes(segment)) || TABS[0];
  }, [location.pathname]);

  // Subject chapters and topic readers provide their own navigation.
  const isSubjectDetail = activeTab.key === 'subjects' && /\/subject\/[^/]+/.test(location.pathname);
  const usesSubjectScroller = activeTab.key === 'subjects' && (
    !isSubjectDetail || /\/subject\/[^/]+\/?$/.test(location.pathname)
  );
  const subjectScrollLayout = 'flex min-h-0 flex-1 flex-col overflow-hidden';

  const isSubjectTopic = activeTab.key === 'subjects' && /\/subject\/[^/]+\/topic\/[^/]+/.test(location.pathname);
  const lastActivity = getLearningActivity();

  useEffect(() => {
    if (!isSubjectTopic) return;
    saveLearningActivity({
      path: location.pathname + location.search,
      label: activeTab.label,
    });
  }, [isSubjectTopic, location.pathname, location.search, activeTab.label]);

  return (
    <div
      className={usesSubjectScroller || activeTab.key === 'tutor' ? `w-full ${subjectScrollLayout}` : 'min-h-full w-full'}
      style={{
        // Subjects / chapters: a card on the portal background (like Materials); tutor stays white
        backgroundColor: 'transparent',
        // backgroundImage: 'radial-gradient(at 0% 0%, rgba(139, 92, 246, 0.05) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.05) 0px, transparent 50%)',
      }}
    >
      {activeTab.key === 'tutor' && (
      <div className="flex min-h-0 w-full flex-1 flex-col p-3 sm:p-4">
        {activeTab.key === 'tutor' && (
          <Motion.div
            key="tutor"
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <TooltipProvider delayDuration={150}>
              <AiTutorPanel fill />
            </TooltipProvider>
          </Motion.div>
        )}
      </div>
      )}

      {activeTab.key === 'subjects' && (
        <Motion.div
          key="subjects"
          className={usesSubjectScroller ? subjectScrollLayout : undefined}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <AILearningCoursesLanding resumePath={lastActivity?.path} />
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
