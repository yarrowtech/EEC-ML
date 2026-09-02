import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bell,
  Search,
  Menu,
  User,
  LogOut,
  AlertTriangle,
  Clock,
  Calendar,
  ChevronDown,
  X,
  ChevronRight,
  UserCog,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AUTH_NOTICE, logoutAndRedirect } from '../utils/authSession';
import { PRINCIPAL_MENU_ITEMS } from './principalConstants';

const PrincipalHeader = ({ sidebarOpen, setSidebarOpen, notifications, principalProfile }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [now, setNow] = useState(new Date());
  const navigate = useNavigate();
  const notificationsRef = useRef(null);
  const profileRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [principalDetails, setPrincipalDetails] = useState({
    name: 'Principal',
    title: 'School Principal',
    email: '',
    avatar: '',
    schoolName: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));
        setPrincipalDetails((prev) => ({
          ...prev,
          name: payload.name || prev.name,
          email: payload.email || prev.email,
        }));
      } catch (err) {
        console.error('Error decoding token:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (!principalProfile) return;
    setPrincipalDetails((prev) => ({
      ...prev,
      name: principalProfile.name || prev.name,
      email: principalProfile.email || prev.email,
      avatar: principalProfile.avatar || prev.avatar,
      schoolName: principalProfile.schoolName || principalProfile.campusName || prev.schoolName,
    }));
  }, [principalProfile]);

  const hasAvatar = typeof principalDetails.avatar === 'string' && principalDetails.avatar.trim() !== '';
  const nameParts = (principalDetails.name || '').trim().split(/\s+/).filter(Boolean);
  const initials = nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : (nameParts[0]?.[0] || 'P');
  const initialsLabel = initials.toUpperCase();

  const unreadNotifications = notifications.filter((n) => !n.read);
  const urgentNotifications = unreadNotifications.filter((n) => n.priority === 'high');
  const totalNotifications = unreadNotifications.length;

  const handleLogout = () => {
    logoutAndRedirect({ navigate, notice: AUTH_NOTICE.LOGGED_OUT });
  };

  const searchTargets = useMemo(
    () => PRINCIPAL_MENU_ITEMS.map((item) => ({
      title: item.label,
      hint: item.description,
      path: item.path,
      icon: item.icon,
    })),
    []
  );

  const filteredSuggestions = searchQuery.trim()
    ? searchTargets.filter((item) =>
        `${item.title} ${item.hint}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchTargets.slice(0, 5);

  const goToSuggestion = (path) => {
    setSearchFocused(false);
    setSearchQuery('');
    navigate(path);
  };

  return (
    <header className="z-40 bg-slate-50 px-4 py-4 sm:px-6">
      <div className="flex h-12 items-center gap-3">
        {/* Left Section */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition-colors hover:bg-slate-100 md:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search Bar */}
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                placeholder="Search anything..."
                className="h-11 w-full rounded-full border border-slate-200 bg-white py-2 pl-10 pr-16 text-sm text-slate-700 shadow-sm transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-64 md:w-80"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                  Ctrl+K
                </kbd>
              )}
            </div>

            {searchFocused && filteredSuggestions.length > 0 && (
              <div className="absolute top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="py-2">
                  <div className="bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">Go to</div>
                  {filteredSuggestions.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.path}
                        onClick={() => goToSuggestion(item.path)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-50"
                      >
                        <Icon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-700">{item.title}</p>
                          <p className="truncate text-xs text-slate-400">{item.hint}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Section - Current Time & Date */}
        <div className="hidden shrink-0 items-center gap-3 text-sm font-medium text-slate-600 md:flex">
          <div className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 shadow-sm">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>{now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 shadow-sm">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex flex-1 items-center justify-end gap-3">
          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {totalNotifications > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-slate-50 bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {totalNotifications > 9 ? '9+' : totalNotifications}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Notifications</h3>
                    <div className="flex items-center gap-2">
                      {urgentNotifications.length > 0 && (
                        <span className="rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-700">
                          {urgentNotifications.length} urgent
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.slice(0, 5).map((notification) => (
                      <div
                        key={notification.id}
                        className="cursor-pointer border-b border-slate-100 p-4 transition-colors hover:bg-slate-50"
                        onClick={() => {
                          setShowNotifications(false);
                          navigate('/principal/notifications');
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex-shrink-0 rounded-full p-2 ${
                              notification.priority === 'high'
                                ? 'bg-rose-100 text-rose-600'
                                : 'bg-amber-100 text-amber-600'
                            }`}
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between">
                              <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                              <span className="ml-2 whitespace-nowrap text-xs text-slate-500">
                                {notification.timestamp}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{notification.message}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-slate-500">
                      <Bell className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                      <p className="text-sm">No new notifications</p>
                      <p className="mt-1 text-xs text-slate-400">You&apos;re all caught up!</p>
                    </div>
                  )}
                </div>

                {notifications.length > 5 && (
                  <div className="border-t border-slate-100 bg-slate-50 p-3 text-center">
                    <button
                      className="flex w-full items-center justify-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
                      onClick={() => {
                        setShowNotifications(false);
                        navigate('/principal/notifications');
                      }}
                    >
                      View All Notifications
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white pl-1.5 pr-2.5 shadow-sm transition-colors hover:bg-slate-100"
              aria-label="Profile menu"
            >
              {hasAvatar ? (
                <img
                  src={principalDetails.avatar}
                  alt="Principal"
                  className="h-8 w-8 rounded-full border-2 border-slate-100 object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-purple-500 text-xs font-bold text-white shadow-sm">
                  {initialsLabel}
                </div>
              )}
              <div className="hidden text-left md:block">
                <p className="max-w-[120px] truncate text-sm font-medium text-slate-900">
                  {principalDetails.name}
                </p>
                <p className="max-w-[120px] truncate text-xs text-slate-500">
                  {principalDetails.schoolName || principalDetails.title}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${showProfile ? 'rotate-180 transform' : ''}`}
              />
            </button>

            {showProfile && (
              <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    {hasAvatar ? (
                      <img
                        src={principalDetails.avatar}
                        alt="Principal"
                        className="h-10 w-10 rounded-full border-2 border-white object-cover shadow-sm"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-purple-500 text-sm font-bold text-white shadow-sm">
                        {initialsLabel}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{principalDetails.name}</p>
                      <p className="truncate text-sm text-slate-500">
                        {principalDetails.schoolName || principalDetails.title}
                      </p>
                      <p className="truncate text-xs text-slate-400">{principalDetails.email}</p>
                    </div>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-slate-50"
                    onClick={() => {
                      setShowProfile(false);
                      navigate('/principal/profile');
                    }}
                  >
                    <UserCog className="h-4 w-4 flex-shrink-0 text-slate-500" />
                    <span className="text-sm text-slate-700">Edit Profile</span>
                  </button>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-slate-50"
                    onClick={() => {
                      setShowProfile(false);
                      navigate('/principal/communications');
                    }}
                  >
                    <User className="h-4 w-4 flex-shrink-0 text-slate-500" />
                    <span className="text-sm text-slate-700">Communications</span>
                  </button>
                  <div className="my-1 border-t border-slate-100"></div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-rose-600 transition-colors hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default PrincipalHeader;
