import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearCacheEntry, readCacheEntry, writeCacheEntry } from '../utils/studentCache';
import { fetchCachedJson } from '../utils/studentApiCache';
import { useNotifications } from '../hooks/useNotifications';
import {
  getStudentNotificationModule,
  notificationId,
  readModuleSeenState,
  writeModuleSeenState,
} from '../utils/moduleNotificationUtils';

const StudentDashboardContext = createContext({
  loading: true,
  error: '',
  profile: null,
  classTeacher: null,
  stats: null,
  course: null,
  recentAttendance: [],
  unreadChatCount: 0,
  notifications: [],
  unreadNotificationCount: 0,
  moduleSeenState: {},
  chatSeenCount: 0,
  markModuleVisited: () => {},
  refresh: () => {},
});

const DASHBOARD_CACHE_KEY = 'studentDashboardCacheV1';
const DASHBOARD_CACHE_TTL_MS = 2 * 60 * 1000;
const STUDENT_API_CACHE_TTL_MS = 5 * 60 * 1000;

const emptyData = {
  profile: null,
  classTeacher: null,
  stats: null,
  course: null,
  recentAttendance: [],
};

export const StudentDashboardProvider = ({ children }) => {
  const initialCachedEntryRef = useRef(readCacheEntry(DASHBOARD_CACHE_KEY));
  const initialCachedData = initialCachedEntryRef.current?.data || null;
  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState('');
  const [data, setData] = useState(initialCachedData || emptyData);
  const notificationState = useNotifications();
  const studentNotifications = notificationState.notifications;
  const markNotificationAsRead = notificationState.markAsRead;
  const [moduleSeenState, setModuleSeenState] = useState(() => readModuleSeenState('student'));
  const activeControllerRef = useRef(null);
  const isMountedRef = useRef(false);

  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;
    try {
      if (!silent) setLoading(true);
      if (isMountedRef.current) setError('');
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');
      if (!token || userType !== 'Student') {
        clearCacheEntry(DASHBOARD_CACHE_KEY);
        if (!isMountedRef.current) return;
        setData(emptyData);
        setLoading(false);
        return;
      }
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const dashboardResult = await fetchCachedJson(`${import.meta.env.VITE_API_URL}/api/student/auth/dashboard`, {
        ttlMs: STUDENT_API_CACHE_TTL_MS,
        fetchOptions: {
          signal: controller.signal,
          headers,
        },
      });

      const payload = dashboardResult?.data || {};
      const nextData = {
        profile: payload.profile || null,
        classTeacher: null,
        stats: payload.stats || null,
        course: payload.course || null,
        recentAttendance: payload.recentAttendance || [],
      };
      writeCacheEntry(DASHBOARD_CACHE_KEY, nextData, DASHBOARD_CACHE_TTL_MS);
      if (!isMountedRef.current) return;
      setData(nextData);

      // Class-teacher metadata is secondary. Do not delay the dashboard when
      // this endpoint is slow or unavailable.
      fetchCachedJson(`${import.meta.env.VITE_API_URL}/api/student/auth/class-teacher`, {
        ttlMs: STUDENT_API_CACHE_TTL_MS,
        fetchOptions: {
          signal: controller.signal,
          headers,
        },
      }).then((teacherResult) => {
        if (!isMountedRef.current) return;
        setData((previous) => ({ ...previous, classTeacher: teacherResult?.data?.teacher || null }));
      }).catch(() => {});
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Student dashboard fetch error:', err);
      if (!isMountedRef.current) return;
      setError(err.message || 'Failed to load dashboard');
      if (!initialCachedData) {
        setData(emptyData);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [initialCachedData]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchDashboard({ silent: !!initialCachedData });
    return () => {
      isMountedRef.current = false;
      activeControllerRef.current?.abort();
    };
  }, [fetchDashboard, initialCachedData]);

  // Single source of truth for the unread-chat badge. Sidebar and
  // MobileBottomNav used to each poll /api/chat/threads independently (every
  // 15s and 30s, plus their own focus/visibility listeners) — both are always
  // mounted at once (just CSS-hidden per viewport), so that was 2x the
  // necessary requests, bursting further whenever focus/visibility fired on
  // both at once. One poller here, shared via context, fixes that.
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatFetchInFlightRef = useRef(false);

  const fetchUnreadChatCount = useCallback(async () => {
    if (chatFetchInFlightRef.current) return;
    const token = localStorage.getItem('token');
    if (!token) {
      setUnreadChatCount(0);
      return;
    }
    chatFetchInFlightRef.current = true;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/threads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const threads = await res.json().catch(() => []);
      const total = (Array.isArray(threads) ? threads : []).reduce(
        (sum, thread) => sum + Math.max(0, Number(thread?.unreadCount || 0)),
        0
      );
      setUnreadChatCount(total);
    } catch {
      // keep existing count on transient network errors
    } finally {
      chatFetchInFlightRef.current = false;
    }
  }, []);

  const [chatSeenCount, setChatSeenCount] = useState(0);
  const markModuleVisited = useCallback((moduleId) => {
    if (!moduleId || moduleId === 'dashboard') return;
    const allNotifications = Array.isArray(studentNotifications) ? studentNotifications : [];
    const candidates = moduleId === 'notifications'
      ? allNotifications
      : allNotifications.filter((notification) => getStudentNotificationModule(notification) === moduleId);
    const currentIds = new Set(Array.isArray(moduleSeenState[moduleId]) ? moduleSeenState[moduleId] : []);
    const newIds = candidates.map(notificationId).filter((id) => id && !currentIds.has(id));
    if (newIds.length > 0) {
      const nextState = { ...moduleSeenState, [moduleId]: [...currentIds, ...newIds] };
      setModuleSeenState(nextState);
      writeModuleSeenState('student', nextState);
    }
    candidates
      .filter((notification) => !notification?.isRead && notificationId(notification))
      .forEach((notification) => { markNotificationAsRead(notificationId(notification)); });
    if (moduleId === 'chat') setChatSeenCount(unreadChatCount);
  }, [markNotificationAsRead, moduleSeenState, studentNotifications, unreadChatCount]);

  useEffect(() => {
    fetchUnreadChatCount();
    const intervalId = window.setInterval(fetchUnreadChatCount, 15000);
    const onFocus = () => fetchUnreadChatCount();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchUnreadChatCount();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchUnreadChatCount]);

  const value = useMemo(
    () => ({
      loading,
      error,
      profile: data.profile,
      classTeacher: data.classTeacher,
      stats: data.stats,
      course: data.course,
      recentAttendance: data.recentAttendance,
      unreadChatCount,
      notifications: notificationState.notifications,
      unreadNotificationCount: notificationState.unreadCount,
      markNotificationAsRead: notificationState.markAsRead,
      dismissNotification: notificationState.dismissNotification,
      markAllNotificationsAsRead: notificationState.markAllAsRead,
      notificationsLoading: notificationState.loading,
      notificationsError: notificationState.error,
      moduleSeenState,
      chatSeenCount,
      markModuleVisited,
      refresh: () => fetchDashboard(),
    }),
    [loading, error, data.profile, data.classTeacher, data.stats, data.course, data.recentAttendance, unreadChatCount, notificationState, moduleSeenState, chatSeenCount, markModuleVisited, fetchDashboard]
  );

  return (
    <StudentDashboardContext.Provider value={value}>
      {children}
    </StudentDashboardContext.Provider>
  );
};

export const useStudentDashboard = () => useContext(StudentDashboardContext);
