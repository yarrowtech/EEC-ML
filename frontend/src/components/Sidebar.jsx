import React, { useState, useEffect } from 'react';
import {
  Home, Calendar, Users, FileText, BookOpen, LogOut,
  ChevronDown, ChevronRight, ChevronLeft, File, Trophy, Bell,
  MessageCircle, MessageSquare, Brain, X, BarChart3,
  Heart, Star, Target, PanelLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStudentDashboard } from './StudentDashboardContext';
import { AUTH_NOTICE, logoutAndRedirect } from '../utils/authSession';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

/* ── Menu definition ─────────────────────────────────────────── */
// Views that all live inside the Learning hub — keeps the sidebar item lit on
// legacy deep links like /student/smart-learning-courses/subject/... .
const LEARNING_HUB_VIEWS = [
  'learning', 'smart-learning', 'smart-learning-courses',
  'smart-learning-courses-reference', 'smart-learning-tutor',
  'study-materials', 'practice-papers',
];

const MENU_ITEMS = [
  {
    id: 'dashboard', name: 'Dashboard', icon: Home,
    iconColor: 'text-blue-600', iconBg: 'bg-blue-100',
  },
  {
    id: 'learning', name: 'Learning', icon: Brain,
    iconColor: 'text-violet-600', iconBg: 'bg-violet-100',
  },
  {
    id: 'academics', name: 'Academics', icon: BookOpen,
    iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100',
    children: [
      { id: 'assignments',                  name: 'Assignments',     icon: FileText  },
      { id: 'assignments-journal',          name: 'Journal',         icon: File      },
      { id: 'assignments-academic-alcove',  name: 'The Wall',        icon: Target    },
      { id: 'results',                      name: 'Results',         icon: BarChart3 },
    ],
  },
  {
    id: 'schedule', name: 'Schedule', icon: Calendar,
    iconColor: 'text-orange-600', iconBg: 'bg-orange-100',
    children: [
      { id: 'routine',             name: 'Weekly Routine',  icon: Calendar  },
      { id: 'exams',               name: 'Exams',           icon: FileText  },
      { id: 'holidays',            name: 'Holiday List',    icon: Bell      },
      { id: 'attendance',          name: 'Attendance',      icon: Users     },
      { id: 'lesson-plan-status',  name: 'Syllabus Status', icon: BookOpen  },
    ],
  },
  {
    id: 'communication', name: 'Communication', icon: MessageSquare,
    iconColor: 'text-indigo-600', iconBg: 'bg-indigo-100',
    children: [
      { id: 'chat',           name: 'Messages',        icon: MessageCircle },
      { id: 'teacherfeedback',name: 'Teacher Feedback',icon: Star          },
      { id: 'excuse-letter',  name: 'Excuse Letter',   icon: FileText      },
      { id: 'noticeboard',    name: 'Notice Board',    icon: Bell          },
    ],
  },
  {
    id: 'wellness', name: 'Wellness', icon: Heart,
    iconColor: 'text-pink-600', iconBg: 'bg-pink-100',
    children: [
      { id: 'wellbeing',    name: 'Emotional Wellbeing', icon: Heart  },
      { id: 'achievements', name: 'Achievements',         icon: Trophy },
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
      {/* Arrow */}
      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
    </div>
  </div>
);

/* ── Main Component ──────────────────────────────────────────── */
const Sidebar = ({ activeView, isOpen, setIsOpen, onNavigateIntent }) => {
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
  const schoolLogoSrc  = studentData.schoolLogo || '/harrow-hall-school.png';
  const unreadLabel = unreadChatCount > 99 ? '99+' : String(unreadChatCount);

  const handleNavigation = (pageId) => {
    const path = pageId === 'dashboard' ? '/student' : `/student/${pageId}`;
    onNavigateIntent?.(pageId === 'dashboard' ? 'dashboard' : pageId);
    navigate(path);
    if (typeof window !== 'undefined' && window.innerWidth < 768) setIsOpen(false);
  };

  const handleLogout = () => setShowLogoutConfirm(true);
  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logoutAndRedirect({ navigate, notice: AUTH_NOTICE.LOGGED_OUT });
  };

  /* Close sidebar on outside click (mobile) */
  useEffect(() => {
    const handler = (e) => {
      if (window.innerWidth < 768 && isOpen && !e.target.closest('.sidebar')) setIsOpen(false);
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="h-1 bg-linear-to-r from-red-400 to-rose-400" />
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900 text-center">Confirm Logout</h3>
              <p className="text-sm text-slate-500 text-center mt-1">
                Are you sure you want to log out? Any unsaved changes will be lost.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile backdrop ── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── Sidebar shell ── */}
      <div
        className={`sidebar fixed md:relative h-screen bg-white shadow-xl z-50 flex flex-col border-r border-slate-200 transition-all duration-300 ease-in-out overflow-hidden select-none
          ${isOpen ? 'w-64' : 'w-16'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >

        {/* ════════════════════════════════
            HEADER
        ════════════════════════════════ */}
        <div className={`relative shrink-0 overflow-hidden bg-linear-to-br from-amber-400 via-yellow-400 to-orange-500 ${isOpen ? 'p-4' : 'py-4 px-0'}`}>
          {/* Decorative circle */}
          <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />

          {isOpen ? (
            /* ── Expanded header ── */
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="h-9 w-9 rounded-xl bg-white/25 border border-white/40 flex items-center justify-center shadow-sm overflow-hidden">
                      <img src={schoolLogoSrc} alt="School" className="h-7 w-7 object-cover rounded-lg" />
                    </div>
                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white leading-tight truncate max-w-[130px]">
                      {studentData.schoolName || 'Student Portal'}
                    </p>
                    {displayClass && (
                      <p className="text-[10px] text-white/75 leading-none mt-0.5">
                        Class {displayClass}{displaySection ? ` · ${displaySection}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Mobile close */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="md:hidden flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors border border-white/30"
                >
                  <X size={14} className="text-white" />
                </button>

                {/* Desktop collapse toggle */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 hover:bg-white/35 transition-colors border border-white/30"
                  title="Collapse sidebar"
                >
                  <ChevronLeft size={14} className="text-white" />
                </button>
              </div>

              {/* Student chips */}
              <div className="flex flex-wrap gap-1.5 justify-center">
                {/* {displayRoll && (
                  <span className="rounded-full bg-white/20 border border-white/30 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Roll {displayRoll}
                  </span>
                )}
                {displayCampus && (
                  <span className="rounded-full bg-white/20 border border-white/30 px-2 py-0.5 text-[10px] font-semibold text-white truncate max-w-[140px]">
                    {displayCampus}
                  </span>
                )} */}
                {classTeacherName && (
                  <span className="rounded-full bg-white/20 border border-white/30 px-2 py-0.5 text-[10px] font-semibold text-white truncate max-w-[160px]">
                    Class Teacher: {classTeacherName}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* ── Collapsed header ── */
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="relative">
                <div className="h-9 w-9 rounded-xl bg-white/25 border border-white/40 flex items-center justify-center overflow-hidden shadow-sm">
                  <img src={schoolLogoSrc} alt="School" className="h-7 w-7 object-cover rounded-lg" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-white" />
              </div>
              {/* Expand toggle */}
              <button
                onClick={() => setIsOpen(true)}
                className="hidden md:flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 hover:bg-white/35 transition-colors border border-white/30"
                title="Expand sidebar"
              >
                <ChevronRight size={12} className="text-white" />
              </button>
            </div>
          )}
        </div>

        {/* ════════════════════════════════
            NAV
        ════════════════════════════════ */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2 py-3' : 'px-3 py-4'}`}
          style={{ scrollbarWidth: 'none' }}
        >
          <div className={collapsed ? 'space-y-1' : 'space-y-0.5'}>
            {MENU_ITEMS.map((item) => {
              const Icon       = item.icon;
              const hasChildren = !!item.children?.length;
              const isCommunicationItem = item.id === 'communication';
              const hasUnreadCommunication = isCommunicationItem && unreadChatCount > 0;
              const isActive   = activeView === item.id ||
                (item.id === 'learning' && LEARNING_HUB_VIEWS.includes(activeView)) ||
                (hasChildren && item.children?.some(c => c.id === activeView));
              const expanded   = openGroups[item.id] === undefined
                ? (hasChildren && isActive)
                : openGroups[item.id];
              const showSub = hasChildren && expanded && !collapsed;

              const onItemClick = (e) => {
                e.stopPropagation();
                if (hasChildren) {
                  if (collapsed) {
                    handleNavigation(item.children[0].id);
                  } else {
                    // Navigate to parent item and toggle submenu
                    handleNavigation(item.id);
                    setOpenGroups(prev => ({ ...prev, [item.id]: !expanded }));
                  }
                } else {
                  handleNavigation(item.id);
                }
              };

              return (
                <div key={item.id}>
                  {/* ── Parent button ── */}
                  <div className="relative" onMouseEnter={() => collapsed && setHoverId(item.id)} onMouseLeave={() => collapsed && setHoverId(null)}>
                    <button
                      onClick={onItemClick}
                      className={`group relative flex w-full items-center rounded-xl transition-all duration-200
                        ${collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2.5'}
                        ${isActive && !hasChildren
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-sm'
                          : isActive && hasChildren
                          ? 'bg-amber-50 text-amber-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                      `}
                    >
                      {/* Icon */}
                      <div className={`flex shrink-0 items-center justify-center rounded-lg transition-all duration-200
                        ${collapsed ? 'h-8 w-8' : 'h-7 w-7'}
                        ${isActive ? `${item.iconBg} ${item.iconColor}` : `bg-slate-100 text-slate-500 group-hover:${item.iconBg} group-hover:${item.iconColor}`}
                      `}>
                        <Icon size={collapsed ? 16 : 15} />
                      </div>

                      {/* Label */}
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left text-sm font-semibold">{item.name}</span>
                          {hasUnreadCommunication && (
                            <span
                              className="mr-1 h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center shrink-0"
                              title={`${unreadLabel} unread messages`}
                            >
                              {unreadLabel}
                            </span>
                          )}
                          {hasChildren && (
                            <ChevronDown
                              size={14}
                              className={`shrink-0 bg-gray-200 p-0.5 rounded-full text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                            />
                          )}
                        </>
                      )}

                      {/* Active dot (collapsed) */}
                      {collapsed && isActive && (
                        <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-amber-400 border border-white" />
                      )}
                      {collapsed && hasUnreadCommunication && (
                        <span
                          className="absolute -right-0.5 -top-0.5 h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center border border-white"
                          title={`${unreadLabel} unread messages`}
                        >
                          {unreadChatCount > 9 ? '9+' : unreadLabel}
                        </span>
                      )}
                    </button>

                    {/* Tooltip (collapsed only) */}
                    {collapsed && <Tooltip label={item.name} visible={hoverId === item.id} />}
                  </div>

                  {/* ── Sub-items ── */}
                  {showSub && (
                    <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-slate-100 pl-3">
                      {item.children.map((child) => {
                        const ChildIcon  = child.icon;
                        const childActive = activeView === child.id;
                        const isMessagesChild = child.id === 'chat';
                        return (
                          <button
                            key={child.id}
                            onClick={(e) => { e.stopPropagation(); handleNavigation(child.id); }}
                            className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all duration-200
                              ${childActive
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 font-semibold'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}
                            `}
                          >
                            <ChildIcon size={13} className={childActive ? 'text-amber-600' : 'text-slate-400 group-hover:text-slate-600'} />
                            <span className="text-xs font-medium">{child.name}</span>
                            {isMessagesChild && unreadChatCount > 0 && (
                              <span className="ml-auto h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                                {unreadLabel}
                              </span>
                            )}
                            {childActive && (!isMessagesChild || unreadChatCount <= 0) && (
                              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
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

        {/* ════════════════════════════════
            FOOTER
        ════════════════════════════════ */}
        <div className={`shrink-0 border-t border-slate-100 mb-16 md:mb-0 ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>

          {/* Profile strip (expanded only) */}
          {!collapsed && (
            <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
              <div className="shrink-0">
                {hasProfileImage ? (
                  <img src={profileImage} alt="You"
                    className="h-8 w-8 rounded-xl object-cover border border-slate-200"
                    onError={e => e.target.style.display = 'none'} />
                ) : (
                  <div className="h-8 w-8 rounded-xl bg-linear-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-sm">
                    <span className="text-xs font-black text-white">{initials.toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">{studentData.name}</p>
                <p className="text-[10px] text-slate-400 truncate">
                  {displayClass ? `Class ${displayClass}` : 'Student'}
                  {displaySection ? ` · ${displaySection}` : ''}
                </p>
              </div>
            </div>
          )}

          {/* Logout */}
          <div
            className="relative"
            onMouseEnter={() => collapsed && setHoverId('__logout')}
            onMouseLeave={() => collapsed && setHoverId(null)}
          >
            <button
              onClick={handleLogout}
              className={`group flex w-full items-center rounded-xl transition-all duration-200 text-red-500 hover:bg-red-50 hover:text-red-600
                ${collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2.5'}
              `}
            >
              <div className={`flex shrink-0 items-center justify-center rounded-lg bg-red-50 group-hover:bg-red-100 transition-colors ${collapsed ? 'h-8 w-8' : 'h-7 w-7'}`}>
                <LogOut size={collapsed ? 15 : 14} className="text-red-500" />
              </div>
              {!collapsed && (
                <div className="text-left">
                  <p className="text-sm font-semibold">Logout</p>
                  <p className="text-[10px] text-red-400">Sign out securely</p>
                </div>
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
