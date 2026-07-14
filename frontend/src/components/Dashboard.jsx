import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import DashboardHome from './DashboardHome';
import AttendanceView from './AttendanceView';
import RoutineView from './RoutineView';
import AssignmentView from './AssignmentView';
import CoursesView from './CoursesView';
import ResultsView from './ResultsView';
import AchievementsView from './AchievementsView';
import ThemeCustomizer from './ThemeCustomizer';
import ProfileUpdate from './ProfileUpdate';
import NoticeBoard from './NoticeBoard';
import TeacherFeedback from './TeacherFeedback';
import StudentChat from './StudentChat';
import ExcuseLetter from './ExcuseLetter';
import LearningHub from './LearningHub';
import AcademicAlcove from './AcademicAlcove';
import StudentWellbeing from './StudentWellbeing';
import LessonPlanStatusView from './LessonPlanStatusView';
import StudentExamsView from './StudentExamsView';
import { StudentDashboardProvider } from './StudentDashboardContext';
import MobileBottomNav from './MobileBottomNav';
import HolidayListView from './HolidayListView';

// All of these views render the same LearningHub component (it owns an
// internal tab bar). Treat them as one logical page so switching tabs inside
// it doesn't retrigger the page-level fade or remount the tab bar itself —
// only LearningHub's own content area should transition.
const LEARNING_HUB_VIEWS = [
  'learning', 'smart-learning', 'smart-learning-courses',
  'smart-learning-courses-reference', 'smart-learning-tutor',
  'study-materials', 'practice-papers',
];

const normalizeViewFromPath = (pathname) => {
  if (
    pathname === '/student' ||
    pathname === '/student/' ||
    pathname === '/dashboard' ||
    pathname === '/dashboard/'
  ) {
    return 'dashboard';
  }
  const match = pathname.match(/^\/(student|dashboard)\/([^/]+).*$/);
  if (match?.[2]) return match[2];
  return 'dashboard';
};

const Dashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const journalRef = useRef(null);
  const wasDesktopRef = useRef(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );

  useEffect(() => {
    if (!location.pathname.startsWith('/dashboard')) return;
    const canonicalPath = location.pathname.replace('/dashboard', '/student');
    navigate(canonicalPath, { replace: true });
  }, [location.pathname, navigate]);

  const effectiveView = normalizeViewFromPath(location.pathname);

  // Fade/remount key for the content area: LearningHub tabs share one key so
  // its own tab bar stays mounted while only its content swaps underneath.
  const pageKey = LEARNING_HUB_VIEWS.includes(effectiveView) ? 'learning-hub' : location.pathname;

  useEffect(() => {
    const syncSidebarForViewport = () => {
      if (typeof window === 'undefined') return;
      const isDesktop = window.innerWidth >= 1024;

      // Set initial state by viewport after login/mount.
      if (!wasDesktopRef.current && !isDesktop) {
        setSidebarOpen(false);
      }
      if (wasDesktopRef.current && isDesktop) {
        setSidebarOpen(true);
      }

      // Only force toggle when crossing breakpoint.
      if (wasDesktopRef.current !== isDesktop) {
        setSidebarOpen(isDesktop);
        wasDesktopRef.current = isDesktop;
      }
    };
    syncSidebarForViewport();
    window.addEventListener('resize', syncSidebarForViewport);
    return () => window.removeEventListener('resize', syncSidebarForViewport);
  }, []);

  // Function to handle navigation
  const setActiveView = (view) => {
    const path = view === 'dashboard' ? '/student' : `/student/${view}`;
    navigate(path);
  };

  // Function to handle journal save from mobile nav
  const handleSaveJournal = () => {
    if (journalRef.current?.saveJournal) {
      journalRef.current.saveJournal();
    }
  };

  // Define view components in an object for cleaner code
  const viewComponents = {
    dashboard: (props) => <DashboardHome {...props} setActiveView={setActiveView} />,
    home: (props) => <DashboardHome {...props} setActiveView={setActiveView} />,
    learning: LearningHub,
    'smart-learning': LearningHub,
    'smart-learning-courses': LearningHub,
    'smart-learning-courses-reference': LearningHub,
    'smart-learning-tutor': LearningHub,
    academics: (props) => <AssignmentView {...props} defaultType="school" />,
    attendance: AttendanceView,
    routine: RoutineView,
    schedule: RoutineView,
    exams: StudentExamsView,
    holidays: HolidayListView,
    'lesson-plan-status': LessonPlanStatusView,
    assignments: (props) => <AssignmentView {...props} defaultType="school" />,
    'assignments-journal': (props) => <AssignmentView {...props} ref={journalRef} defaultType="journal" />,
    'assignments-academic-alcove': (props) => <AcademicAlcove {...props} />,
    'study-materials': LearningHub,
    'practice-papers': LearningHub,
    courses: CoursesView,
    results: ResultsView,
    communication: StudentChat,
    noticeboard: NoticeBoard,
    teacherfeedback: TeacherFeedback,
    chat: StudentChat,
    'excuse-letter': ExcuseLetter,
    wellness: StudentWellbeing,
    wellbeing: StudentWellbeing,
    achievements: AchievementsView,
    profile: ProfileUpdate,
    themecustomizer: ThemeCustomizer,
  };

  useEffect(() => {
    if (!viewComponents[effectiveView]) {
      navigate('/student', { replace: true });
    }
  }, [effectiveView, navigate]);

  const renderContent = () => {
    const Component = viewComponents[effectiveView];

    if (Component) {
      return <Component key={pageKey} setActiveView={setActiveView} />;
    } else {
      return <DashboardHome key={`dashboard-fallback:${location.pathname}`} setActiveView={setActiveView} />;
    }
  };

  return (
    <StudentDashboardProvider>
      <div className="min-h-screen w-full bg-gray-50 flex relative overflow-hidden">
        <Sidebar
          activeView={effectiveView}
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
        />
        <div
          className={`flex-1 flex flex-col h-screen transition-all duration-300 ${sidebarOpen ? '' : ''
            } ${(effectiveView === 'chat' || effectiveView === 'excuse-letter' || effectiveView === 'assignments-journal') ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}
        >
          <Header
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            onOpenProfile={() => navigate('/student/profile')}
          />
          <main className={`flex-1 min-h-0 ${(effectiveView === 'chat' || effectiveView === 'excuse-letter' || effectiveView === 'assignments-journal') ? 'p-0' : ''} w-full flex flex-col`}>
            <Motion.div
              key={pageKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
              className="flex-1 min-h-0 w-full flex flex-col"
            >
              {renderContent()}
            </Motion.div>
            {effectiveView !== 'chat' && effectiveView !== 'excuse-letter' && effectiveView !== 'assignments-journal' && (
              <div className="h-16 sm:h-18 lg:hidden shrink-0" aria-hidden="true" />
            )}
          </main>
        </div>
        <MobileBottomNav activeView={effectiveView} onSaveJournal={handleSaveJournal} />
      </div>
    </StudentDashboardProvider>
  );
};

export default Dashboard;
