import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Search,
  Menu,
  CalendarDays,
  X,
  ChevronDown,
  User,
  LogOut,
  CheckCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStudentDashboard } from './StudentDashboardContext';
import { useNotifications } from '../hooks/useNotifications';
import { useDesktopNotificationBridge } from '../hooks/useDesktopNotificationBridge';
import DesktopNotificationPermissionModal from './DesktopNotificationPermissionModal';
import { AUTH_NOTICE, logoutAndRedirect } from '../utils/authSession';

const Header = ({ sidebarOpen, setSidebarOpen, onOpenProfile }) => {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const { profile } = useStudentDashboard();

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleProfile = useCallback(() => {
    setProfileOpen((prev) => !prev);
    setShowNotifications(false);
  }, []);

  // Use real notifications hook
  const {
    notifications: allNotifications,
    unreadCount,
    loading: notificationsLoading,
    markAsRead,
    markAllAsRead
  } = useNotifications();
  const resolveNotifPath = useCallback((notification) => {
    const type = notification?.type?.toLowerCase();
    const relatedEntity = notification?.relatedEntity?.entityType?.toLowerCase();
    const typeLabel = String(notification?.typeLabel || '').toLowerCase();
    const notificationText = `${notification?.title || ''} ${notification?.message || ''} ${notification?.typeLabel || ''}`.toLowerCase();
    const isAttendanceNotification = typeLabel === 'attendance_marked'
      || notificationText.includes('attendance')
      || notificationText.includes('marked present')
      || notificationText.includes('marked absent')
      || notificationText.includes('you were marked');

    if (isAttendanceNotification) return '/student/attendance';
    if (notificationText.includes('achievement')) return '/student/achievements';
    if (relatedEntity === 'assignment' || type === 'assignment') return '/student/assignments';
    if (relatedEntity === 'exam' || type === 'exam') return '/student/exams';
    if (relatedEntity === 'result' || type === 'result') return '/student/results';
    if (relatedEntity === 'fee' || type === 'fee') return '/student/fees';
    if (type === 'notice' || type === 'announcement') return '/student/noticeboard';
    if (type === 'class_note') return '/student/assignments-journal';
    return '/student/home';
  }, []);
  const {
    showPermissionModal,
    pendingCount,
    syncNotifications,
    requestPermissionFromModal,
    dismissPermissionModal,
  } = useDesktopNotificationBridge({
    scopeKey: 'student',
    resolvePath: resolveNotifPath,
    appName: 'Student Portal',
  });

  useEffect(() => {
    syncNotifications(allNotifications);
  }, [allNotifications, syncNotifications]);

  // Toggle one dropdown, close the other
  const toggleNotifications = useCallback(async () => {
    const nextOpen = !showNotifications;
    if (nextOpen && unreadCount > 0) {
      await markAllAsRead();
    }
    setShowNotifications(nextOpen);
    setProfileOpen(false);
  }, [markAllAsRead, showNotifications, unreadCount]);

  const studentData = profile || {
    name: 'Student',
    grade: '',
    section: '',
    roll: '',
    className: '',
    sectionName: '',
    rollNumber: '',
    campusName: '',
    campusType: '',
    schoolName: '',
    schoolLogo: null,
    profilePic: null,
  };
  const displayClass = studentData.className || studentData.grade;
  const displaySection = studentData.sectionName || studentData.section;
  const displayRoll = studentData.rollNumber || studentData.roll;
  const profileImage = studentData.profilePic || studentData.avatar || '';
  const hasProfileImage = typeof profileImage === 'string' && profileImage.trim() !== '';
  const nameParts = (studentData.name || '').trim().split(/\s+/).filter(Boolean);
  const initials = nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : (nameParts[0]?.[0] || 'S');
  const initialsLabel = initials.toUpperCase();

  // Greeting and date
  const { greeting, dateLabel } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const dateLabel = now.toLocaleDateString(undefined, {
      weekday: 'long', month: 'short', day: 'numeric'
    });
    return { greeting, dateLabel };
  }, []);

  const handleLogout = () => {
    logoutAndRedirect({ navigate, notice: AUTH_NOTICE.LOGGED_OUT });
  };

  const runSearch = () => {
    const query = searchText.trim();
    if (!query) return;
    const q = query.toLowerCase();

    if (q.includes('attendance') || q.includes('present') || q.includes('absent')) {
      const filter = q.includes('present') ? 'present' : q.includes('absent') ? 'absent' : 'all';
      navigate(`/student/attendance?filter=${filter}`);
      return;
    }
    if (q.includes('journal')) {
      navigate('/student/assignments-journal');
      return;
    }
    if (q.includes('assignment') || q.includes('homework')) {
      navigate(`/student/assignments?q=${encodeURIComponent(query)}`);
      return;
    }
    if (q.includes('result')) {
      navigate('/student/results');
      return;
    }
    if (q.includes('notice')) {
      navigate('/student/noticeboard');
      return;
    }
    if (q.includes('excuse') || q.includes('leave')) {
      navigate('/student/excuse-letter');
      return;
    }
    if (q.includes('routine') || q.includes('schedule')) {
      navigate('/student/routine');
      return;
    }
    if (q.includes('profile')) {
      navigate('/student/profile');
      return;
    }
    if (q.includes('chat') || q.includes('message')) {
      navigate('/student/chat');
      return;
    }
    if (q.includes('wellbeing') || q.includes('wellness')) {
      navigate('/student/wellbeing');
      return;
    }
    if (q.includes('achievement')) {
      navigate('/student/achievements');
      return;
    }
    if (q.includes('course')) {
      navigate('/student/courses');
      return;
    }

    navigate(`/student/assignments?q=${encodeURIComponent(query)}`);
  };

  const searchSuggestions = useMemo(() => ([
    { label: 'Assignments', hint: 'View all assignments', action: () => navigate('/student/assignments') },
    { label: 'Attendance (All)', hint: 'Daily attendance overview', action: () => navigate('/student/attendance?filter=all') },
    { label: 'Attendance (Present)', hint: 'Only present days', action: () => navigate('/student/attendance?filter=present') },
    { label: 'Attendance (Absent)', hint: 'Only absent days', action: () => navigate('/student/attendance?filter=absent') },
    { label: 'Journal', hint: 'My Learning Journal', action: () => navigate('/student/assignments-journal') },
    { label: 'Results', hint: 'Academic results', action: () => navigate('/student/results') },
    { label: 'Notice Board', hint: 'School notices', action: () => navigate('/student/noticeboard') },
    { label: 'Excuse Letter', hint: 'Leave application', action: () => navigate('/student/excuse-letter') },
    { label: 'Routine', hint: 'Weekly routine', action: () => navigate('/student/routine') },
    { label: 'Profile', hint: 'Update your profile', action: () => navigate('/student/profile') },
  ]), [navigate]);

  const filteredSuggestions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return searchSuggestions.slice(0, 5);
    return searchSuggestions
      .filter((s) => s.label.toLowerCase().includes(q) || s.hint.toLowerCase().includes(q))
      .slice(0, 6);
  }, [searchText, searchSuggestions]);

  // Handle notification click
  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }

    // Close notification dropdown
    setShowNotifications(false);

    navigate(resolveNotifPath(notification));
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <>
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-xl border-b border-gray-100">
      <div className="px-3 sm:px-5">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">

          {/* Left: Sidebar toggle + Greeting */}
          <div className="flex items-center gap- 2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} className="text-gray-600" />
            </button>
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {greeting}, <span className="text-indigo-600">{studentData.name?.split(' ')[0] || 'Student'}</span>
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <CalendarDays size={12} />
                <span>{dateLabel}</span>
                {displayClass && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span>Class {displayClass}{displaySection ? `-${displaySection}` : ''}</span>
                  </>
                )}
                {displayRoll && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span>Roll {displayRoll}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-lg mx-2">
            <div className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-3 text-gray-400 pointer-events-none" size={16} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onFocus={() => setShowSearchSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); runSearch(); }
                  }}
                  className="w-full pl-9 pr-9 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 outline-none transition-all"
                />
                {searchText && (
                  <button
                    type="button"
                    onClick={() => { setSearchText(''); setShowSearchSuggestions(true); }}
                    className="absolute right-3 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Clear"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {showSearchSuggestions && (
                <div className="absolute left-0 right-0 mt-2 rounded-xl border border-gray-100 bg-white shadow-2xl z-50 overflow-hidden">
                  {filteredSuggestions.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400">No results found</div>
                  ) : (
                    <ul>
                      {filteredSuggestions.map((s, i) => (
                        <li key={s.label}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setShowSearchSuggestions(false); s.action(); }}
                            className={`w-full px-4 py-2.5 text-left hover:bg-indigo-50/50 transition-colors flex items-center gap-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}
                          >
                            <Search size={14} className="text-gray-300 shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-800">{s.label}</div>
                              <div className="text-[11px] text-gray-400">{s.hint}</div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: School + Bell + Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2">

            {/* School badge - desktop only */}
            {(studentData.schoolName || studentData.schoolLogo) && (
              <div className="hidden xl:flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-100">
                <div className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
                  {studentData.schoolLogo ? (
                    <img src={studentData.schoolLogo} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <span className="text-[10px] font-bold text-gray-400">
                      {(studentData.schoolName || 'S').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-gray-600 max-w-auto truncate">{studentData.schoolName}</span>
              </div>
            )}

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                className="relative p-2 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
                onClick={toggleNotifications}
                aria-label="Notifications"
              >
                <Bell size={19} className="text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      <Bell size={14} className="text-indigo-500" />
                      <span className="text-sm font-bold text-gray-900">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                      )}
                    </div>
                    {allNotifications.length > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                      >
                        <CheckCheck size={12} />
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                    {notificationsLoading && (
                      <div className="px-4 py-6 text-sm text-gray-400 text-center">Loading...</div>
                    )}
                    {!notificationsLoading && allNotifications.length === 0 && (
                      <div className="px-4 py-8 text-sm text-gray-400 text-center">
                        <Bell size={24} className="mx-auto text-gray-200 mb-2" />
                        No notifications yet
                      </div>
                    )}
                    {!notificationsLoading && allNotifications.map((n) => {
                      const id = String(n?._id || n?.id || '');
                      const isRead = Boolean(n?.isRead);
                      return (
                        <button
                          key={id || n?.title}
                          type="button"
                          onClick={() => handleNotificationClick(n)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${isRead ? '' : 'bg-indigo-50/50'}`}
                        >
                          <div className="flex items-start gap-2">
                            {!isRead && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                            <div className={!isRead ? '' : 'ml-3.5'}>
                              <p className="text-sm font-medium text-gray-800 line-clamp-1">{n?.title || 'Notification'}</p>
                              {n?.message && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>}
                              <p className="text-[11px] text-gray-400 mt-1">
                                <span>{formatTimeAgo(n?.createdAt)}</span>
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-gray-50 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNotifications(false);
                        navigate('/student/noticeboard');
                      }}
                      className="w-full text-sm text-indigo-600 hover:text-indigo-700 font-semibold text-center py-1"
                    >
                      View all notices →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-6 bg-gray-200" />

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                className="flex items-center gap-2 rounded-xl p-1.5 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
                onClick={toggleProfile}
                aria-label="Profile menu"
              >
                {hasProfileImage ? (
                  <img
                    src={profileImage}
                    alt=""
                    className="w-8 h-8 rounded-full border border-gray-200 object-cover"
                    onError={(e) => {
                      e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                    {initialsLabel}
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold text-gray-800 leading-tight">{studentData.name?.split(' ')[0] || 'Student'}</p>
                  <p className="text-[10px] text-gray-400">Student</p>
                </div>
                <ChevronDown size={14} className={`hidden md:block text-gray-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  {/* Profile card */}
                  <div className="px-4 py-3 bg-linear-to-br from-indigo-50 to-purple-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {hasProfileImage ? (
                        <img src={profileImage} alt="" className="w-10 h-10 rounded-lg border-2 border-white object-cover shadow-sm" onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-linear-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                          {initialsLabel}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{studentData.name || 'Student'}</p>
                        <p className="text-[11px] text-gray-500">
                          {displayClass ? `Class ${displayClass}${displaySection ? `-${displaySection}` : ''}` : 'Student'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => { if (onOpenProfile) onOpenProfile(); setProfileOpen(false); }}
                    >
                      <User size={15} className="text-gray-400" />
                      My Profile
                    </button>
                  </div>
                  <div className="border-t border-gray-100 py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={15} className="text-red-400" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
    <DesktopNotificationPermissionModal
      open={showPermissionModal}
      onAllow={requestPermissionFromModal}
      onLater={dismissPermissionModal}
      pendingCount={pendingCount}
    />
    </>
  );
};

export default Header;
