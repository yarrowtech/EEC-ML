import React, { useCallback, useEffect, useState } from 'react';
import {
  Home, BookOpen, Calendar, MessageCircle, User,
  X, FileText, File, Target, BarChart3, Users,
  Bell, Heart, Trophy, Star, Brain, Save, LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AUTH_NOTICE, logoutAndRedirect } from '../utils/authSession';

/* ─── Sub-menu definitions ─────────────────────────────────────────────── */
const subMenus = {
  academics: {
    title: 'Academics',
    gradient: 'from-emerald-500 to-emerald-600',
    items: [
      { id: 'assignments',                 name: 'Assignments',     icon: FileText,      color: 'bg-blue-500',   desc: 'Submit & track' },
      { id: 'assignments-journal',         name: 'Journal',         icon: File,          color: 'bg-green-500',  desc: 'My notes' },
      { id: 'assignments-academic-alcove', name: 'The Wall',        icon: Target,        color: 'bg-purple-500', desc: 'Deep focus' },
      { id: 'results',                     name: 'Results',         icon: BarChart3,     color: 'bg-indigo-500', desc: 'Grades' },
    ],
  },
  schedule: {
    title: 'Schedule',
    gradient: 'from-orange-500 to-orange-600',
    items: [
      { id: 'routine',            name: 'Daily Routine', icon: Calendar, color: 'bg-orange-500', desc: 'Timetable' },
      { id: 'exams',              name: 'Exams',         icon: FileText, color: 'bg-indigo-500', desc: 'Exam routine' },
      { id: 'holidays',           name: 'Holidays',      icon: Bell,     color: 'bg-amber-500',  desc: 'Holiday list' },
      { id: 'attendance',         name: 'Attendance',    icon: Users,    color: 'bg-green-500',  desc: 'Track presence' },
      { id: 'lesson-plan-status', name: 'Syllabus',      icon: BookOpen, color: 'bg-blue-500',   desc: 'Course status' },
    ],
  },
};

/* ─── Bottom-nav tab definitions ────────────────────────────────────────── */
const navItems = [
  { id: 'dashboard', label: 'Home',      icon: Home,          path: '/student' },
  { id: 'learning',  label: 'Learning',  icon: Brain,         path: '/student/learning' },
  { id: 'academics', label: 'Academics', icon: BookOpen,      subMenu: 'academics' },
  { id: 'schedule',  label: 'Schedule',  icon: Calendar,      subMenu: 'schedule' },
  { id: 'chat',      label: 'Messages',  icon: MessageCircle, path: '/student/chat' },
  { id: 'profile',   label: 'Profile',   icon: User,          path: '/student/profile' },
  { id: 'logout',    label: 'Logout',    icon: LogOut,        action: 'logout' },
];

// Every view served by the Learning hub — legacy ids keep deep links alive.
const LEARNING_HUB_VIEWS = [
  'learning', 'smart-learning', 'smart-learning-courses',
  'smart-learning-courses-reference', 'smart-learning-tutor',
  'study-materials', 'practice-papers',
];

/* ─── Helper ─────────────────────────────────────────────────────────────── */
const isViewInSubMenu = (menuKey, activeView) =>
  subMenus[menuKey]?.items.some(
    (item) => activeView === item.id || activeView.startsWith(`${item.id}-`)
  ) ?? false;

/* ─── Component ─────────────────────────────────────────────────────────── */
const MobileBottomNav = ({ activeView, onSaveJournal }) => {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const loadChatUnreadCount = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setChatUnreadCount(0);
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/chat/threads`, {
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => []);
      const totalUnread = (Array.isArray(data) ? data : []).reduce(
        (sum, thread) => sum + Math.max(0, Number(thread?.unreadCount || 0)),
        0
      );
      setChatUnreadCount(totalUnread);
    } catch {
      // Keep existing count on transient network errors.
    }
  }, []);

  useEffect(() => {
    loadChatUnreadCount();
    const intervalId = window.setInterval(loadChatUnreadCount, 30000);
    const onFocus = () => loadChatUnreadCount();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadChatUnreadCount();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadChatUnreadCount]);

  const handleTabPress = (item) => {
    if (item.action === 'logout') {
      const shouldLogout = window.confirm('Do you want to logout?');
      if (!shouldLogout) return;
      logoutAndRedirect({ navigate, notice: AUTH_NOTICE.LOGGED_OUT });
      return;
    }

    if (item.subMenu) {
      setOpenMenu((prev) => (prev === item.subMenu ? null : item.subMenu));
    } else {
      setOpenMenu(null);
      navigate(item.path);
    }
  };

  const handleCardPress = (childId) => {
    navigate(`/student/${childId}`);
    setOpenMenu(null);
  };

  const currentMenu = openMenu ? subMenus[openMenu] : null;

  return (
    <>
      {/* ── Sub-menu overlay ─────────────────────────────────────────────── */}
      {openMenu && currentMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setOpenMenu(null)}
          />

          {/* Slide-up panel */}
          <div className="fixed bottom-16 left-2 right-2 z-50 md:hidden bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up-panel">
            {/* Coloured header */}
            <div className={`bg-linear-to-r ${currentMenu.gradient} px-5 py-3.5 flex items-center justify-between`}>
              <span className="text-white font-bold text-base tracking-wide">
                {currentMenu.title}
              </span>
              <button
                onClick={() => setOpenMenu(null)}
                className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center active:scale-90 transition-transform"
              >
                <X size={15} className="text-white" />
              </button>
            </div>

            {/* App-icon card grid */}
            <div className="p-4 grid grid-cols-3 gap-3">
              {currentMenu.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activeView === item.id || activeView.startsWith(`${item.id}-`);

                return (
                  <button
                    key={item.id}
                    onClick={() => handleCardPress(item.id)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all active:scale-90 ${
                      isActive
                        ? 'bg-amber-50 ring-2 ring-amber-400'
                        : 'bg-gray-50 active:bg-gray-100'
                    }`}
                  >
                    {/* iOS-style app icon */}
                    <div
                      className={`rounded-2xl ${item.color} flex items-center justify-center shadow-md`}
                      style={{ width: 52, height: 52 }}
                    >
                      <Icon size={24} className="text-white" strokeWidth={1.8} />
                    </div>

                    <span
                      className={`text-[11px] font-semibold text-center leading-tight ${
                        isActive ? 'text-amber-600' : 'text-gray-700'
                      }`}
                    >
                      {item.name}
                    </span>

                    <span className="text-[9px] text-gray-400 leading-none">
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Bottom nav bar ───────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.07)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Special Journal Save Footer */}
        {activeView === 'assignments-journal' && onSaveJournal ? (
          <div className="flex items-center justify-between px-4 h-16 gap-3">
            <button
              onClick={() => navigate('/student')}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 hover:bg-gray-100 active:scale-90 transition-all"
            >
              <Home size={20} />
            </button>
            <button
              onClick={onSaveJournal}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full text-white font-bold text-sm active:scale-95 transition-all shadow-lg"
              style={{
                background: '#3d5a45',
                boxShadow: '0 4px 14px -3px rgba(61,90,69,0.45)',
              }}
            >
              <Save size={18} />
              Save Entry
            </button>
            <button
              onClick={() => setOpenMenu('academics')}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 hover:bg-gray-100 active:scale-90 transition-all"
            >
              <BookOpen size={20} />
            </button>
          </div>
        ) : (
          /* Default Navigation */
          <div className="flex items-stretch h-16">
            {navItems.map((item) => {
              const Icon = item.icon;

              const isActive = item.subMenu
                ? openMenu === item.subMenu || isViewInSubMenu(item.subMenu, activeView)
                : item.id === 'dashboard'
                ? activeView === 'dashboard' || activeView === 'home'
                : item.id === 'learning'
                ? LEARNING_HUB_VIEWS.includes(activeView)
                : activeView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleTabPress(item)}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-transform"
                >
                  <div
                    className={`relative p-1.5 rounded-xl transition-all duration-200 ${
                      isActive ? 'bg-amber-50' : ''
                    }`}
                  >
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.2 : 1.8}
                      className={isActive ? 'text-amber-500' : 'text-gray-400'}
                    />
                    {item.id === 'chat' && chatUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center shadow">
                        {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-semibold leading-none ${
                      isActive ? 'text-amber-500' : 'text-gray-400'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </nav>
    </>
  );
};

export default MobileBottomNav;
