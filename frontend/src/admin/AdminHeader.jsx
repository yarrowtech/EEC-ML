import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Search,
  X,
  ChevronDown,
  Settings,
  LogOut,
  CheckCheck,
  AlertCircle,
  Menu,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/authSession';
import {
  useDesktopNotificationBridge,
} from '../hooks/useDesktopNotificationBridge';
import DesktopNotificationPermissionModal from '../components/DesktopNotificationPermissionModal';

const API_BASE = (
  import.meta.env.VITE_API_URL || window.location.origin
).replace(/\/$/, '');
const DESKTOP_SEARCH_LISTBOX_ID = 'admin-header-search-suggestions-desktop';
const MOBILE_SEARCH_LISTBOX_ID = 'admin-header-search-suggestions-mobile';

const AdminHeader = ({ adminUser, onOpenMobileSidebar, onLogoutRequest }) => {
  const [showProfileMenu, setShowProfileMenu]       = useState(false);
  const [showNotifications, setShowNotifications]   = useState(false);
  const [showSearch, setShowSearch]                 = useState(false);
  const [searchQuery, setSearchQuery]               = useState('');
  const [searchFeedback, setSearchFeedback]         = useState('');
  const [showSuggestions, setShowSuggestions]       = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [notifications, setNotifications]           = useState([]);
  const [notifLoading, setNotifLoading]             = useState(false);
  const [notifError, setNotifError]                 = useState('');
  const [now, setNow]                               = useState(new Date());
  const [isSearchFocused, setIsSearchFocused]       = useState(false);
  const desktopSearchRef = useRef(null);
  const desktopInputRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const navigate = useNavigate();

  const isSuperAdmin  = String(adminUser?.role || '').toLowerCase() === 'super admin';
  const schoolLogoSrc = adminUser?.schoolLogo || adminUser?.avatar || '';
  const schoolName    = adminUser?.schoolName || '';
  const profileName   = adminUser?.name || 'Admin';
  const profileRole   = adminUser?.role || 'Administrator';
  const profileInit   = profileName.charAt(0).toUpperCase();
  const primaryName   = schoolName || profileName;
  const avatarInitials = (schoolName
    ? schoolName.split(' ').map((w) => w[0]).join('').slice(0, 2)
    : profileInit
  ).toUpperCase();

  /* Clock */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchNotifs = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setNotifications([]); return; }
    setNotifLoading(true);
    setNotifError('');
    try {
      const res  = await apiFetch(`${API_BASE}/api/notifications/user`, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      }, navigate);
      if (res.status === 304) return;
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Failed to load notifications');
      const all = Array.isArray(data) ? data : [];
      const filtered = all
        .filter((n) => {
          if (isSuperAdmin) return true;
          const aud = String(n?.audience || 'All').toLowerCase();
          return aud === 'all' || aud === 'admin' || aud === 'school_admin' || aud === 'school admin';
        })
        .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
        .slice(0, 20);
      setNotifications(filtered);
    } catch (err) {
      setNotifError(err.message || 'Failed to load');
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  }, [isSuperAdmin, navigate]);

  /* Fetch notifications — idle-aware: pause polling when tab is hidden */
  useEffect(() => {
    fetchNotifs();

    // Poll every 15s but skip when the tab is hidden (saves bandwidth when idle)
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifs();
    }, 15_000);

    // Also re-fetch immediately when the user returns to the tab
    const socket = window.io?.(API_BASE, {
      transports: ['websocket', 'polling'],
      auth: { token: localStorage.getItem('token') },
    });

    if (socket) {
      socket.on('connect', () => console.log('%c[Socket.IO] Admin notifications connected!', 'color: #22c55e; font-weight: bold;'));
      socket.on('disconnect', (reason) => console.warn('[Socket.IO] Admin notifications disconnected:', reason));
      socket.on('connect_error', (err) => console.error('[Socket.IO] Admin notifications connection error:', err.message));

      socket.on('new_notification', (notification) => {
        console.log('Received new notification via WebSocket:', notification);
        fetchNotifs(); // Re-fetch all notifications to update the list
      });
    }

    const onVisible = () => { if (document.visibilityState === 'visible') fetchNotifs(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchNotifs, isSuperAdmin]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n?.isRead).length,
    [notifications]
  );

  const markRead = useCallback(async (id) => {
    if (!id) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    // Optimistic UI update first, then sync with server.
    setNotifications((prev) =>
      prev.map((n) => (String(n?._id || n?.id || '') === String(id) ? { ...n, isRead: true } : n))
    );

    try {
      const res = await apiFetch(`${API_BASE}/api/notifications/user/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      }, navigate);
      if (!res.ok) throw new Error('Failed to mark notification as read');
      await fetchNotifs();
    } catch (err) {
      // Revert optimistic change on failure.
      setNotifications((prev) =>
        prev.map((n) => (String(n?._id || n?.id || '') === String(id) ? { ...n, isRead: false } : n))
      );
      setNotifError(err.message || 'Failed to mark notification as read');
    }
  }, [fetchNotifs, navigate]);

  const markAllRead = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      const res = await apiFetch(`${API_BASE}/api/notifications/user/read-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      }, navigate);
      if (!res.ok) throw new Error('Failed to mark all notifications as read');
      await fetchNotifs();
    } catch (err) {
      setNotifError(err.message || 'Failed to mark all as read');
      await fetchNotifs();
    }
  }, [fetchNotifs, navigate]);

  const handleToggleNotifications = useCallback(async () => {
    const nextOpen = !showNotifications;
    if (nextOpen && unreadCount > 0) {
      await markAllRead();
    }
    setShowNotifications(nextOpen);
    setShowProfileMenu(false);
  }, [markAllRead, showNotifications, unreadCount]);

  const resolveNotifPath = useCallback((n) => {
    const title = String(n?.title || '').toLowerCase();
    const type  = String(n?.typeLabel || '').toLowerCase();
    if (type.includes('leave request') || title.includes('leave request')) return '/admin/hr?tab=leaves';
    // Support / issue resolution notifications → support page
    if (
      (String(n?.createdByType || '').toLowerCase() === 'super_admin' && String(n?.audience || '').toLowerCase() === 'admin') ||
      title.includes('issue in progress') ||
      title.includes('support request in progress') ||
      title.includes('issue resolved') ||
      title.includes('support request resolved')
    ) return '/admin/support#recent-requests';
    return '/admin/notices/view';
  }, []);
  const {
    showPermissionModal,
    pendingCount,
    syncNotifications,
    requestPermissionFromModal,
    dismissPermissionModal,
  } = useDesktopNotificationBridge({
    scopeKey: 'admin',
    resolvePath: resolveNotifPath,
    appName: 'Admin Portal',
  });

  useEffect(() => {
    syncNotifications(notifications);
  }, [notifications, syncNotifications]);

  const timeAgo = (val) => {
    if (!val) return '';
    const ts = new Date(val);
    if (isNaN(ts)) return '';
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    if (d < 7) return `${d}d ago`;
    return ts.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  /* Search */
  const SEARCH_TARGETS = useMemo(() => {
    const baseTargets = [
      { label: 'Dashboard',       hint: 'Overview',                      path: '/admin/dashboard',      keys: ['dashboard', 'home', 'overview'] },
      { label: 'Analytics',       hint: 'Reports & charts',              path: '/admin/analytics',      keys: ['analytics', 'report', 'chart'] },
      { label: 'Activity Log',    hint: 'School activity history',       path: '/admin/activity-log',   keys: ['activity log', 'audit', 'log'] },
      { label: 'Academic Setup',  hint: 'Classes, sections, subjects',   path: '/admin/academics',      keys: ['academic', 'class', 'section', 'subject'] },
      { label: 'Teachers',        hint: 'Manage teachers',               path: '/admin/teachers',       keys: ['teacher', 'faculty'] },
      { label: 'Students',        hint: 'Manage students',               path: '/admin/students',       keys: ['student', 'pupil'] },
      { label: 'Routines',        hint: 'Schedules & timetables',        path: '/admin/routines',       keys: ['routine', 'schedule', 'timetable'] },
      { label: 'Attendance',      hint: 'Daily attendance',              path: '/admin/attendance',     keys: ['attendance', 'present', 'absent'] },
      { label: 'Examination',     hint: 'Exams & papers',                path: '/admin/examination',    keys: ['exam', 'examination', 'test'] },
      { label: 'Results',         hint: 'Marks & results',               path: '/admin/result',         keys: ['result', 'marks'] },
      { label: 'Report Cards',    hint: 'Generate report cards',         path: '/admin/report-cards',   keys: ['report card'] },
      { label: 'Fees Collection', hint: 'Collect & track fees',          path: '/admin/fees/collection',keys: ['fees', 'payment', 'collection'] },
      { label: 'HR',              hint: 'Staff & leave management',      path: '/admin/hr',             keys: ['hr', 'leave', 'staff'] },
      { label: 'Parents',         hint: 'Parent records',                path: '/admin/parents',        keys: ['parent'] },
      { label: 'Notices',         hint: 'Notifications & notices',       path: '/admin/notices/view',    keys: ['notice', 'notification'] },
      { label: 'Holidays',        hint: 'Holiday calendar',              path: '/admin/holidays',       keys: ['holiday'] },
      { label: 'Settings',        hint: 'Account & app settings',        path: '/admin/settings',       keys: ['setting', 'profile'] },
    ];
    if (isSuperAdmin) return baseTargets;
    return baseTargets.filter((item) => item.path !== '/admin/attendance');
  }, [isSuperAdmin]);

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SEARCH_TARGETS.slice(0, 6);
    return SEARCH_TARGETS.filter((t) =>
      t.label.toLowerCase().includes(q) ||
      t.hint.toLowerCase().includes(q) ||
      t.keys.some((k) => k.includes(q) || q.includes(k))
    ).slice(0, 8);
  }, [SEARCH_TARGETS, searchQuery]);

  useEffect(() => {
    if (!showSuggestions) {
      setActiveSuggestionIndex(-1);
      return;
    }
    if (!suggestions.length) {
      setActiveSuggestionIndex(-1);
      return;
    }
    if (activeSuggestionIndex >= suggestions.length) {
      setActiveSuggestionIndex(0);
    }
  }, [showSuggestions, suggestions, activeSuggestionIndex]);

  const navigateToSuggestion = (item) => {
    if (!item?.path) return;
    setSearchFeedback('');
    setSearchQuery(item.label || '');
    setShowSuggestions(false);
    setShowSearch(false);
    setActiveSuggestionIndex(-1);
    navigate(item.path);
  };

  const findSearchMatch = (query) => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return null;
    return SEARCH_TARGETS.find(({ keys, label, hint }) =>
      keys.some((k) => k.includes(q) || q.includes(k)) ||
      String(label || '').toLowerCase().includes(q) ||
      String(hint || '').toLowerCase().includes(q)
    );
  };

  const handleSearchInputKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      return;
    }
    if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
      e.preventDefault();
      navigateToSuggestion(suggestions[activeSuggestionIndex]);
      return;
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      return;
    }
    if (e.key === 'Tab') {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const highlighted = activeSuggestionIndex >= 0 ? suggestions[activeSuggestionIndex] : null;
    if (highlighted) {
      navigateToSuggestion(highlighted);
      return;
    }
    const match = findSearchMatch(q);
    if (!match) { setSearchFeedback('No module found'); return; }
    navigateToSuggestion(match);
  };

  const closeSuggestionsIfFocusOutside = (containerRef) => {
    requestAnimationFrame(() => {
      const container = containerRef?.current;
      const activeEl = document.activeElement;
      if (container && activeEl && container.contains(activeEl)) return;
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    });
  };

  useEffect(() => {
    if (!searchFeedback) return;
    const t = setTimeout(() => setSearchFeedback(''), 2200);
    return () => clearTimeout(t);
  }, [searchFeedback]);

  const handleLogout = () => { setShowProfileMenu(false); onLogoutRequest?.(); };

  /* ⌘K / Ctrl+K focuses the module search */
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (desktopInputRef.current && window.innerWidth >= 1024) {
          desktopInputRef.current.focus();
          setShowSuggestions(true);
        } else {
          setShowSearch(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /* Close dropdowns on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('[data-dropdown]')) {
        setShowProfileMenu(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const notificationDropdown = showNotifications && (
    <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-80 rounded-2xl border border-white/60 bg-white/85 backdrop-blur-xl shadow-xl ring-1 ring-black/5 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/50">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-indigo-500" />
          <span className="text-sm font-bold text-slate-900">Notifications</span>
          {unreadCount > 0 && (
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </div>
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            <CheckCheck size={12} />
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto divide-y divide-white/50">
        {notifLoading && (
          <div className="px-4 py-6 text-sm text-slate-400 text-center">Loading…</div>
        )}
        {!notifLoading && notifError && (
          <div className="px-4 py-4 text-sm text-red-600 flex items-center gap-2">
            <AlertCircle size={14} />{notifError}
          </div>
        )}
        {!notifLoading && !notifError && notifications.length === 0 && (
          <div className="px-4 py-8 text-sm text-slate-400 text-center">
            <Bell size={24} className="mx-auto text-slate-200 mb-2" />
            No notifications yet
          </div>
        )}
        {!notifLoading && !notifError && notifications.map((n) => {
          const id = String(n?._id || n?.id || '');
          const isRead = Boolean(n?.isRead);
          return (
            <button
              key={id || n?.title}
              type="button"
              onClick={async () => {
                await markRead(id);
                setShowNotifications(false);
                navigate(resolveNotifPath(n));
              }}
              className={`w-full text-left px-4 py-3 hover:bg-white/60 transition-colors ${isRead ? '' : 'bg-indigo-50/50'}`}
            >
              <div className="flex items-start gap-2">
                {!isRead && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                <div className={!isRead ? '' : 'ml-3.5'}>
                  <p className="text-sm font-medium text-slate-800 line-clamp-1">{n?.title || 'Notification'}</p>
                  {n?.message && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>}
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center">
                    {(n?.schoolName || n?.senderName || n?.createdByName) && (
                      <span className="font-semibold text-slate-500 mr-1.5 truncate max-w-[120px]">
                        {n.schoolName || n.senderName || n.createdByName} •
                      </span>
                    )}
                    <span>{timeAgo(n?.createdAt)}</span>
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-white/50 px-4 py-2.5">
        <button
          type="button"
          onClick={() => { setShowNotifications(false); navigate('/admin/notices'); }}
          className="w-full text-sm text-indigo-600 hover:text-indigo-700 font-semibold text-center py-1"
        >
          View all notices →
        </button>
      </div>
    </div>
  );

  const profileDropdown = showProfileMenu && (
    <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/60 bg-white/85 backdrop-blur-xl shadow-xl ring-1 ring-black/5 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="px-4 py-3 border-b border-white/50">
        <p className="text-sm font-bold text-slate-900 truncate">{profileName}</p>
        <p className="text-xs text-slate-400 truncate">{profileRole}</p>
        {schoolName && (
          <p className="text-[11px] text-indigo-600 font-medium truncate mt-0.5" title={schoolName}>{schoolName}</p>
        )}
      </div>
      <div className="py-1.5">
        <button
          className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-white/60 rounded-xl flex items-center gap-2.5 transition-colors"
          onClick={() => { setShowProfileMenu(false); navigate('/admin/settings'); }}
        >
          <Settings size={15} className="text-slate-400" />
          Settings
        </button>
        <div className="border-t border-white/50 my-1" />
        <button
          className="w-full px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50/60 rounded-xl flex items-center gap-2.5 transition-colors"
          onClick={handleLogout}
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </div>
  );

  const suggestionList = (idPrefix, listboxId) => (
    <div
      id={listboxId}
      role="listbox"
      className="mt-2 rounded-2xl border border-white/60 bg-white/85 backdrop-blur-xl shadow-xl ring-1 ring-black/5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
    >
      {suggestions.length === 0 ? (
        <div className="px-4 py-3 text-sm text-slate-400">No results</div>
      ) : (
        <ul className="divide-y divide-white/50">
          {suggestions.map((item, idx) => (
            <li key={item.path}>
              <button
                id={`${idPrefix}-${idx}`}
                role="option"
                aria-selected={idx === activeSuggestionIndex}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveSuggestionIndex(idx)}
                onClick={() => navigateToSuggestion(item)}
                className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors ${
                  idx === activeSuggestionIndex ? 'bg-indigo-50/70' : 'hover:bg-indigo-50/50'
                }`}
              >
                <Search size={13} className="text-slate-300 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.label}</p>
                  <p className="text-[11px] text-slate-400">{item.hint}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="sticky top-0 z-30 px-3 sm:px-4 pt-2.5 pb-2 bg-gradient-to-b from-white/70 via-white/40 to-transparent backdrop-blur-[2px]"
      >
        <div className="mx-auto max-w-[1200px]">
          <motion.div
            whileHover={{ y: -1 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 sm:gap-3 rounded-[1.75rem] border border-white/70 bg-white/60 px-3 sm:px-5 py-2 shadow-[0_16px_44px_-12px_rgba(15,23,42,0.10),0_4px_12px_rgba(15,23,42,0.04)] backdrop-blur-xl saturate-150 transition-colors hover:bg-white/70 hover:border-white/90"
          >
            {/* ── Mobile hamburger ── */}
            <button
              onClick={onOpenMobileSidebar}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-white/70 active:scale-95 transition-all shrink-0"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            {/* ── School branding (mobile) ── */}
            <div className="flex items-center gap-2 lg:hidden min-w-0 flex-1">
              {schoolLogoSrc && (
                <img src={schoolLogoSrc} alt={primaryName} className="w-7 h-7 rounded-lg object-cover shrink-0 ring-1 ring-white/60" />
              )}
              <span className="text-sm font-bold text-slate-800 truncate">{primaryName}</span>
            </div>

            {/* ── Desktop search — glass pill ── */}
            <div ref={desktopSearchRef} className="hidden lg:flex flex-1 max-w-md relative">
              <form
                className={`relative w-full flex items-center gap-2 rounded-full border pl-4 pr-1.5 py-0.5 transition-all ${
                  isSearchFocused
                    ? 'bg-white/70 border-white/80 shadow-[0_4px_16px_rgba(15,23,42,0.05)]'
                    : 'bg-white/30 border-white/40'
                }`}
                onSubmit={handleSearch}
              >
                <Search className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                <input
                  ref={desktopInputRef}
                  type="text"
                  placeholder="Search modules…"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setActiveSuggestionIndex(-1); }}
                  onFocus={() => { setShowSuggestions(true); setIsSearchFocused(true); }}
                  onBlur={() => { closeSuggestionsIfFocusOutside(desktopSearchRef); setIsSearchFocused(false); }}
                  onKeyDown={handleSearchInputKeyDown}
                  aria-expanded={showSuggestions}
                  aria-haspopup="listbox"
                  aria-controls={DESKTOP_SEARCH_LISTBOX_ID}
                  aria-activedescendant={
                    showSuggestions && activeSuggestionIndex >= 0
                      ? `desktop-search-option-${activeSuggestionIndex}`
                      : undefined
                  }
                  className="w-full bg-transparent border-none outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal py-2"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setSearchQuery(''); setShowSuggestions(true); setActiveSuggestionIndex(-1); desktopInputRef.current?.focus(); }}
                    className="text-slate-400 hover:text-slate-600 shrink-0 pr-1"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <kbd
                    className={`hidden xl:inline-block text-[10px] font-medium text-slate-400 px-2.5 py-1 rounded-full border border-white/40 transition-colors ${
                      isSearchFocused ? 'bg-white/70' : 'bg-white/40'
                    }`}
                  >
                    ⌘+K
                  </kbd>
                )}
              </form>

              {/* Search suggestions dropdown */}
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0">
                  {suggestionList('desktop-search-option', DESKTOP_SEARCH_LISTBOX_ID)}
                </div>
              )}
              {searchFeedback && (
                <span className="absolute -bottom-6 left-0 text-xs text-amber-600 font-medium">{searchFeedback}</span>
              )}
            </div>

            {/* ── Right cluster ── */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Live clock — wide screens only */}
              <div className="hidden xl:flex items-center gap-2 rounded-full border border-white/30 bg-white/25 px-3.5 py-1.5 text-sm font-medium text-slate-900">
                <Clock size={14} className="text-slate-400 shrink-0" />
                <span className="tabular-nums whitespace-nowrap">
                  {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-slate-400">
                  {now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>

              {/* Mobile search toggle */}
              <button
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-white/70 active:scale-95 transition-all"
                onClick={() => setShowSearch((p) => !p)}
                aria-label="Search"
              >
                <Search size={18} />
              </button>

              {/* Notification bell */}
              <div className="relative" data-dropdown>
                <motion.button
                  whileHover={{ scale: 1.05, y: -1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleToggleNotifications}
                  className="relative w-10 h-10 flex items-center justify-center rounded-full border border-white/30 bg-white/25 text-slate-600 hover:bg-white/70 hover:border-white/60 transition-all"
                  aria-label="Notifications"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                      <span className="relative min-w-[17px] h-[17px] px-1 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center border-2 border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    </span>
                  )}
                </motion.button>
                {notificationDropdown}
              </div>

              {/* Profile pill */}
              <div className="relative" data-dropdown>
                <button
                  onClick={() => { setShowProfileMenu((p) => !p); setShowNotifications(false); }}
                  className="flex items-center gap-2.5 rounded-full border border-white/30 bg-white/25 pl-1.5 pr-2 sm:pr-3 py-1 hover:bg-white/50 hover:border-white/50 active:scale-[0.98] transition-all"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-white/70 shadow-sm">
                    {!isSuperAdmin && schoolLogoSrc ? (
                      <img src={schoolLogoSrc} alt={primaryName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-semibold text-xs">{avatarInitials}</span>
                    )}
                  </div>
                  <div className="hidden sm:flex flex-col leading-tight min-w-0 text-left">
                    <span className="text-sm font-semibold text-slate-900 truncate max-w-[160px]">{primaryName}</span>
                    <span className="text-[10px] font-medium text-slate-500 tracking-wide">{profileRole}</span>
                  </div>
                  <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
                </button>
                {profileDropdown}
              </div>
            </div>
          </motion.div>

          {/* ── Mobile search bar (expanded) ── */}
          {showSearch && (
            <div ref={mobileSearchRef} className="lg:hidden mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <form
                className="relative flex items-center rounded-full border border-white/50 bg-white/60 backdrop-blur-xl pl-4 pr-2 py-1"
                onSubmit={handleSearch}
              >
                <Search className="w-4 h-4 text-slate-400 pointer-events-none shrink-0" />
                <input
                  type="text"
                  placeholder="Search modules…"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setActiveSuggestionIndex(-1); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => closeSuggestionsIfFocusOutside(mobileSearchRef)}
                  onKeyDown={handleSearchInputKeyDown}
                  autoFocus
                  aria-expanded={showSuggestions}
                  aria-haspopup="listbox"
                  aria-controls={MOBILE_SEARCH_LISTBOX_ID}
                  aria-activedescendant={
                    showSuggestions && activeSuggestionIndex >= 0
                      ? `mobile-search-option-${activeSuggestionIndex}`
                      : undefined
                  }
                  className="w-full bg-transparent border-none outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 px-2 py-2"
                />
                <button
                  type="button"
                  onClick={() => { setShowSearch(false); setSearchQuery(''); setShowSuggestions(false); setActiveSuggestionIndex(-1); }}
                  className="text-slate-400 hover:text-slate-600 active:scale-95 transition-transform shrink-0"
                  aria-label="Close search"
                >
                  <X size={16} />
                </button>
              </form>
              {showSuggestions && suggestionList('mobile-search-option', MOBILE_SEARCH_LISTBOX_ID)}
            </div>
          )}
        </div>
      </motion.header>

      <DesktopNotificationPermissionModal
        open={showPermissionModal}
        onAllow={requestPermissionFromModal}
        onLater={dismissPermissionModal}
        pendingCount={pendingCount}
      />
    </>
  );
};

export default AdminHeader;
