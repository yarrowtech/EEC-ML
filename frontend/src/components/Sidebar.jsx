import React, { useState, useEffect } from 'react';
import {
  Home, Calendar, Users, FileText, BookOpen, LogOut,
  ChevronDown, ChevronRight, ChevronLeft, File, Trophy, Bell,
  MessageCircle, MessageSquare, Brain, X, BarChart3,
  Heart, Star, Target, Zap, AlertOctagon, Video, Activity,
  GraduationCap, CalendarClock, ClipboardCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStudentDashboard } from './StudentDashboardContext';
import { AUTH_NOTICE, logoutAndRedirect } from '../utils/authSession';
import ConfirmDialog from './ConfirmDialog';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

/* ── Menu definition ─────────────────────────────────────────── */
// Views that all live inside the Learning hub — keeps the sidebar item lit on
// legacy deep links like /student/smart-learning-courses/subject/... .
const LEARNING_HUB_VIEWS = [
  'learning', 'smart-learning', 'smart-learning-courses',
  'smart-learning-courses-reference', 'smart-learning-tutor',
  'study-materials', 'practice-papers', 'my-paths',
];

// Grouped by what a student is trying to do — Learn / School / Money / Messages /
// Wellbeing — with plain-language labels. Child ids are URL segments and must
// match Dashboard's viewComponents map.
const MENU_ITEMS = [
  { id: 'dashboard', name: 'Dashboard', icon: Home },
  {
    id: 'learn', name: 'Learn', icon: GraduationCap,
    children: [
      { id: 'learning',                     name: 'Learning Hub',    icon: Brain     },
      { id: 'assignments',                  name: 'Assignments',     icon: FileText  },
      { id: 'assignments-journal',          name: 'Journal',         icon: File      },
      { id: 'assignments-academic-alcove',  name: 'Class Wall',      icon: Target    },
      { id: 'results',                      name: 'Results',         icon: BarChart3 },
      { id: 'mastery',                      name: 'Mastery Progress', icon: Zap      },
      { id: 'error-analysis',               name: 'Error Analysis',  icon: ClipboardCheck },
    ],
  },
  {
    id: 'school', name: 'School', icon: BookOpen,
    children: [
      { id: 'routine',             name: 'Timetable',    icon: Calendar     },
      { id: 'attendance',          name: 'Attendance',   icon: Users        },
      { id: 'exams',               name: 'Exams',        icon: FileText     },
      { id: 'lesson-plan-status',  name: 'Syllabus',     icon: BookOpen     },
      { id: 'holidays',            name: 'Holidays',     icon: CalendarClock },
      { id: 'noticeboard',         name: 'Notice Board', icon: Bell         },
    ],
  },
  {
    id: 'messages', name: 'Messages', icon: MessageSquare,
    children: [
      { id: 'chat',            name: 'Chat',            icon: MessageCircle },
      { id: 'teacherfeedback', name: 'Teacher Feedback', icon: Star        },
      { id: 'meetings',        name: 'Parent Meetings',  icon: Video       },
      { id: 'excuse-letter',   name: 'Excuse Letter',    icon: FileText    },
      { id: 'complaints',      name: 'Complaints',       icon: AlertOctagon },
    ],
  },
  {
    id: 'wellbeing', name: 'Wellbeing', icon: Heart,
    children: [
      { id: 'wellbeing',    name: 'Emotional Wellbeing', icon: Heart    },
      { id: 'health',       name: 'Health Record',       icon: Activity },
      { id: 'achievements', name: 'Achievements',        icon: Trophy   },
    ],
  },
];

/* ── Tooltip (collapsed mode) ────────────────────────────────── */
const Tooltip = ({ label, sub, visible }) => (
  <div
    className={`pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[999] transition-all duration-150 ${
      visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1'
    }`}
  >
    <div className="bg-slate-900 text-white rounded-xl px-3 py-2 shadow-2xl whitespace-nowrap min-w-max">
      <p className="text-xs font-bold">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
    </div>
  </div>
);

/* ── Main Component ──────────────────────────────────────────── */
const Sidebar = ({ activeView, isOpen, setIsOpen }) => {
  const navigate   = useNavigate();
  const [openGroups, setOpenGroups] = useState({});
  const [hoverId, setHoverId]       = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const { profile, classTeacher }   = useStudentDashboard();

  const collapsed = !isOpen; // desktop icon-only state

  const studentData = profile || {
    name: 'Student', username: '', grade: '', section: '', roll: '',
    className: '', sectionName: '', rollNumber: '', campusName: '',
    campusType: '', schoolName: '', schoolLogo: null,
  };

  /* helpers */
  const displayClass   = studentData.className  || studentData.grade;
  const displaySection = studentData.sectionName || studentData.section;
  const resolveTeacherName = (t, p) => {
    if (typeof t === 'string' && t.trim()) return t.trim();
    const d = t?.name || t?.teacherName || t?.fullName || t?.displayName;
    if (d) return String(d).trim();
    const n = t?.user?.name || t?.userId?.name || t?.teacher?.name;
    if (n) return String(n).trim();
    const f = p?.classTeacherName || p?.classTeacher?.name;
    if (f) return String(f).trim();
    return '';
  };
  const classTeacherName = resolveTeacherName(classTeacher, studentData);

  const nameParts   = (studentData.name || '').trim().split(/\s+/).filter(Boolean);
  const initials    = nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : (nameParts[0]?.[0] || 'S');
  const profileImage   = studentData.profilePic || studentData.avatar || '';
  const hasProfileImage = typeof profileImage === 'string' && profileImage.trim() !== '';
  const schoolName     = studentData.schoolName || 'Student Portal';
  const hasSchoolLogo  = typeof studentData.schoolLogo === 'string' && studentData.schoolLogo.trim() !== '';
  const schoolInitial  = (schoolName.trim()[0] || 'S').toUpperCase();
  const unreadLabel = unreadChatCount > 99 ? '99+' : String(unreadChatCount);

  const handleNavigation = (pageId) => {
    const path = pageId === 'dashboard' ? '/student' : `/student/${pageId}`;
    navigate(path);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setIsOpen(false);
  };

  const handleLogout = () => setShowLogoutConfirm(true);
  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logoutAndRedirect({ navigate, notice: AUTH_NOTICE.LOGGED_OUT });
  };

  /* Close sidebar on outside click (mobile) */
  useEffect(() => {
    const handler = (e) => {
      if (window.innerWidth < 1024 && isOpen && !e.target.closest('.sidebar')) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, setIsOpen]);

  const fetchUnreadChatCount = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUnreadChatCount(0);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/chat/threads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const total = (Array.isArray(data) ? data : []).reduce(
        (sum, thread) => sum + Math.max(0, Number(thread?.unreadCount || 0)),
        0
      );
      setUnreadChatCount(total);
    } catch {
      // ignore polling/network errors
    }
  };

  useEffect(() => {
    fetchUnreadChatCount();
    const timer = setInterval(fetchUnreadChatCount, 15000);
    const onFocus = () => fetchUnreadChatCount();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchUnreadChatCount();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <>
      <ConfirmDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        onConfirm={confirmLogout}
        icon={LogOut}
        title="Confirm logout"
        description="Are you sure you want to log out? Any unsaved changes will be lost."
        confirmLabel="Logout"
      />

      {/* ── Mobile backdrop ── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── Sidebar shell — a soft white card on desktop, a flush drawer on mobile ── */}
      <div
        className={`sidebar fixed z-50 flex h-screen flex-col overflow-hidden border-r border-slate-100 bg-white shadow-2xl select-none transition-all duration-300 ease-in-out
          lg:relative lg:my-3 lg:ml-3 lg:h-[calc(100vh-1.5rem)] lg:rounded-2xl lg:border lg:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.06),0_8px_24px_-6px_rgba(0,0,0,0.02)]
          ${isOpen ? 'w-64' : 'w-16'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >

        {/* ════════════════════════════════ HEADER ════════════════════════════════ */}
        <div className={`relative shrink-0 border-b border-slate-100 ${isOpen ? 'px-4 pt-4 pb-3.5' : 'px-0 py-4'}`}>
          {/* gradient accent line under the brand */}
          <span className={`pointer-events-none absolute -bottom-px h-0.5 w-10 rounded bg-gradient-to-r from-violet-500 to-amber-300 ${isOpen ? 'left-4' : 'left-1/2 -translate-x-1/2'}`} />

          {isOpen ? (
            /* ── Expanded header ── */
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-violet-400 shadow-[0_4px_8px_-2px_rgba(139,92,246,0.3)]">
                    {hasSchoolLogo
                      ? <img src={studentData.schoolLogo} alt="School" className="h-full w-full object-cover" />
                      : <span className="text-lg font-bold text-white">{schoolInitial}</span>}
                  </div>
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold leading-tight text-slate-900">{schoolName}</p>
                  {displayClass && (
                    <p className="truncate text-xs font-medium text-slate-400">
                      Class {displayClass}{displaySection ? ` – ${displaySection}` : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Mobile close */}
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 lg:hidden"
              >
                <X size={14} />
              </button>

              {/* Desktop collapse toggle */}
              <button
                onClick={() => setIsOpen(false)}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 lg:flex"
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          ) : (
            /* ── Collapsed header ── */
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-violet-400 shadow-[0_4px_8px_-2px_rgba(139,92,246,0.3)]">
                  {hasSchoolLogo
                    ? <img src={studentData.schoolLogo} alt="School" className="h-full w-full object-cover" />
                    : <span className="text-base font-bold text-white">{schoolInitial}</span>}
                </div>
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
              </div>
              <button
                onClick={() => setIsOpen(true)}
                title="Expand sidebar"
                aria-label="Expand sidebar"
                className="hidden h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 lg:flex"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          )}

          {isOpen && classTeacherName && (
            <div className="mt-2.5">
              <span className="inline-block max-w-full truncate rounded-full border border-violet-100 bg-violet-50 px-2.5 py-0.5 text-[10px] font-semibold text-violet-700">
                Class Teacher: {classTeacherName}
              </span>
            </div>
          )}
        </div>

        {/* ════════════════════════════════ NAV ════════════════════════════════ */}
        <nav
          className={`flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="space-y-0.5">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const hasChildren = !!item.children?.length;
              const isMessagesGroup = item.id === 'messages';
              const hasUnread = isMessagesGroup && unreadChatCount > 0;
              const isActive = activeView === item.id ||
                (item.id === 'learn' && LEARNING_HUB_VIEWS.includes(activeView)) ||
                (hasChildren && item.children?.some((c) => c.id === activeView));
              const expanded = openGroups[item.id] === undefined
                ? (hasChildren && isActive)
                : openGroups[item.id];
              const showSub = hasChildren && expanded && !collapsed;

              const onItemClick = (e) => {
                e.stopPropagation();
                if (hasChildren) {
                  if (collapsed) handleNavigation(item.children[0].id);
                  else setOpenGroups((prev) => ({ ...prev, [item.id]: !expanded }));
                } else {
                  handleNavigation(item.id);
                }
              };

              return (
                <div key={item.id}>
                  {/* ── Parent button ── */}
                  <div
                    className="relative"
                    onMouseEnter={() => collapsed && setHoverId(item.id)}
                    onMouseLeave={() => collapsed && setHoverId(null)}
                  >
                    <button
                      onClick={onItemClick}
                      className={
                        collapsed
                          ? `group relative flex h-10 w-full items-center justify-center rounded-lg transition-all duration-200 ${
                              isActive
                                ? 'bg-violet-50 text-violet-600'
                                : 'text-slate-400 hover:bg-violet-50/60 hover:text-violet-600'
                            }`
                          : `group relative flex w-full items-center gap-3 rounded-lg border-l-[3px] py-2.5 pl-2.5 pr-3 text-sm transition-all duration-200 ${
                              isActive
                                ? 'border-l-violet-500 bg-violet-50 font-semibold text-violet-700 shadow-[0_4px_12px_-6px_rgba(139,92,246,0.15)]'
                                : 'border-l-transparent font-medium text-slate-600 hover:translate-x-1 hover:border-l-violet-400 hover:bg-violet-50/60 hover:text-violet-700'
                            }`
                      }
                    >
                      <Icon
                        size={collapsed ? 18 : 17}
                        className={`shrink-0 transition-all duration-200 ${
                          isActive ? 'text-violet-500' : 'text-slate-400 group-hover:scale-105 group-hover:text-violet-500'
                        }`}
                      />

                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.name}</span>
                          {hasUnread && (
                            <span
                              className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white"
                              title={`${unreadLabel} unread messages`}
                            >
                              {unreadLabel}
                            </span>
                          )}
                          {hasChildren && (
                            <ChevronDown
                              size={14}
                              className={`shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''} ${
                                isActive ? 'text-violet-400' : 'text-slate-300 group-hover:text-violet-400'
                              }`}
                            />
                          )}
                        </>
                      )}

                      {collapsed && isActive && (
                        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-violet-500" />
                      )}
                      {collapsed && hasUnread && (
                        <span
                          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-white bg-red-500 px-1 text-[9px] font-semibold text-white"
                          title={`${unreadLabel} unread messages`}
                        >
                          {unreadChatCount > 9 ? '9+' : unreadLabel}
                        </span>
                      )}
                    </button>

                    {collapsed && <Tooltip label={item.name} visible={hoverId === item.id} />}
                  </div>

                  {/* ── Sub-items ── */}
                  {showSub && (
                    <div className="ml-3.5 mt-0.5 space-y-0.5 border-l-2 border-violet-100 pl-3">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = activeView === child.id ||
                          (child.id === 'learning' && LEARNING_HUB_VIEWS.includes(activeView));
                        const isChatChild = child.id === 'chat';
                        return (
                          <button
                            key={child.id}
                            onClick={(e) => { e.stopPropagation(); handleNavigation(child.id); }}
                            className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-all duration-200 ${
                              childActive
                                ? 'bg-violet-50 font-semibold text-violet-700'
                                : 'text-slate-500 hover:translate-x-0.5 hover:bg-violet-50/50 hover:text-violet-700'
                            }`}
                          >
                            <ChildIcon
                              size={14}
                              className={`shrink-0 transition-colors ${childActive ? 'text-violet-500' : 'text-slate-400 group-hover:text-violet-500'}`}
                            />
                            <span className="truncate">{child.name}</span>
                            {isChatChild && unreadChatCount > 0 && (
                              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                                {unreadLabel}
                              </span>
                            )}
                            {childActive && (!isChatChild || unreadChatCount <= 0) && (
                              <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* ════════════════════════════════ FOOTER ════════════════════════════════ */}
        <div className={`shrink-0 border-t border-slate-100 mb-16 lg:mb-0 ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>

          {/* Profile / user card (expanded only) */}
          {!collapsed && (
            <button
              type="button"
              onClick={() => handleNavigation('profile')}
              className="mb-2 flex w-full items-center gap-3 rounded-xl border border-transparent bg-slate-50 px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-px hover:border-amber-200 hover:bg-amber-50 hover:shadow-[0_4px_12px_-6px_rgba(251,191,36,0.15)]"
            >
              <div className="shrink-0">
                {hasProfileImage ? (
                  <img
                    src={profileImage}
                    alt="You"
                    className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-400 shadow-[0_2px_6px_-2px_rgba(139,92,246,0.3)]">
                    <span className="text-xs font-semibold text-white">{initials.toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{studentData.name}</p>
                <p className="truncate text-xs font-medium text-slate-400">
                  {displayClass ? `Class ${displayClass}` : 'Student'}
                  {displaySection ? ` – ${displaySection}` : ''}
                </p>
              </div>
            </button>
          )}

          {/* Logout */}
          <div
            className="relative"
            onMouseEnter={() => collapsed && setHoverId('__logout')}
            onMouseLeave={() => collapsed && setHoverId(null)}
          >
            <button
              onClick={handleLogout}
              className={
                collapsed
                  ? 'group flex h-10 w-full items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:bg-red-50 hover:text-red-600'
                  : 'group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-all duration-200 hover:translate-x-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-700'
              }
            >
              <LogOut
                size={collapsed ? 16 : 15}
                className={`shrink-0 transition-colors ${collapsed ? 'text-slate-400 group-hover:text-red-500' : 'text-slate-400 group-hover:text-red-500'}`}
              />
              {!collapsed && (
                <span className="flex items-center gap-2">
                  Logout
                  <span className="rounded-full bg-slate-200 px-2 py-px text-[10px] font-medium text-slate-500 transition-colors group-hover:bg-red-200 group-hover:text-red-800">
                    secure
                  </span>
                </span>
              )}
            </button>
            {collapsed && <Tooltip label="Logout" sub="Sign out securely" visible={hoverId === '__logout'} />}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
