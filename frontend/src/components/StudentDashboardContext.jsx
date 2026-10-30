import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearCacheEntry, readCacheEntry, writeCacheEntry } from '../utils/studentCache';
import { fetchCachedJson, peekCachedJson } from '../utils/studentApiCache';
import { STUDENT_API_BASE, STUDENT_DASHBOARD_TTL_MS } from '../utils/studentDashboardPrefetch';
import { AUTH_NOTICE, logoutAndRedirect } from '../utils/authSession';
import { slugifyForUrl } from '../utils/urlSlug';

// Deep link to the practice-paper page for one subject/topic; ?paper / ?worksheet opens the item.
const reminderPath = (subject, topic, param, id) => (subject && topic
  ? `/student/smart-learning-courses/subject/${slugifyForUrl(subject)}/topic/${slugifyForUrl(topic)}/assessment/practice-paper?${param}=${id}`
  : '/student/smart-learning-courses');
import { useNotifications } from '../hooks/useNotifications';
import {
  getStudentNotificationModule,
  notificationId,
  readModuleSeenState,
  writeModuleSeenState,
} from '../utils/moduleNotificationUtils';

// Keep ONE context object across Vite hot reloads. When this module is
// re-evaluated, createContext() would otherwise return a new object: the
// already-mounted provider keeps the old one while re-executed consumers read
// the new one, find no provider, and fall back to the default
// ({ loading: true, ... }) — so the dashboard showed no data until a hard refresh.
const CONTEXT_KEY = '__eecStudentDashboardContext__';
const StudentDashboardContext = globalThis[CONTEXT_KEY] || createContext({
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
  smartLearningReminders: [],
  moduleSeenState: {},
  chatSeenCount: 0,
  markModuleVisited: () => {},
  refresh: () => {},
});
globalThis[CONTEXT_KEY] = StudentDashboardContext;

const DASHBOARD_CACHE_KEY = 'studentDashboardCacheV2';
const DASHBOARD_CACHE_TTL_MS = 2 * 60 * 1000;
const STUDENT_API_CACHE_TTL_MS = STUDENT_DASHBOARD_TTL_MS;
const DASHBOARD_URL = `${STUDENT_API_BASE}/api/student/auth/dashboard`;
const CLASS_TEACHER_URL = `${STUDENT_API_BASE}/api/student/auth/class-teacher`;

const toDashboardData = (payload, classTeacher = null) => ({
  profile: payload?.profile || null,
  classTeacher,
  stats: payload?.stats || null,
  course: payload?.course || null,
  recentAttendance: payload?.recentAttendance || [],
});

// Payloads cached before the backend added schoolCoverImage must be refetched,
// otherwise the hero card keeps showing the placeholder until the TTL runs out.
const isCurrentDashboardShape = (payload) =>
  Boolean(payload?.profile && Object.prototype.hasOwnProperty.call(payload.profile, 'schoolCoverImage'));

// Last-known dashboard (session cache, else the persistent API cache — which
// the login prefetch fills) so the screen paints without a spinner.
const readInitialDashboard = () => {
  const session = readCacheEntry(DASHBOARD_CACHE_KEY)?.data;
  if (session) return session;
  const api = peekCachedJson(DASHBOARD_URL);
  if (!api?.data || !isCurrentDashboardShape(api.data)) return null;
  return toDashboardData(api.data, peekCachedJson(CLASS_TEACHER_URL)?.data?.teacher || null);
};

const emptyData = {
  profile: null,
  classTeacher: null,
  stats: null,
  course: null,
  recentAttendance: [],
};

export const StudentDashboardProvider = ({ children }) => {
  const initialCachedEntryRef = useRef(undefined);
  if (initialCachedEntryRef.current === undefined) initialCachedEntryRef.current = readInitialDashboard();
  const initialCachedData = initialCachedEntryRef.current;
  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState('');
  const [data, setData] = useState(initialCachedData || emptyData);
  const [smartLearningReminders, setSmartLearningReminders] = useState([]);
  const notificationState = useNotifications();
  const studentNotifications = notificationState.notifications;
  const markNotificationAsRead = notificationState.markAsRead;
  const [moduleSeenState, setModuleSeenState] = useState(() => readModuleSeenState('student'));
  const activeControllerRef = useRef(null);
  const isMountedRef = useRef(false);

  const fetchDashboard = useCallback(async ({ silent = false, forceRefresh = false } = {}) => {
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
      if (forceRefresh) clearCacheEntry(DASHBOARD_CACHE_KEY);
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const cachedDashboard = peekCachedJson(DASHBOARD_URL);
      const staleShape = cachedDashboard?.data && !isCurrentDashboardShape(cachedDashboard.data);
      const dashboardResult = await fetchCachedJson(DASHBOARD_URL, {
        ttlMs: STUDENT_API_CACHE_TTL_MS,
        forceRefresh: forceRefresh || staleShape,
        fetchOptions: {
          signal: controller.signal,
          headers,
        },
      });

      const payload = dashboardResult?.data || {};
      const nextData = toDashboardData(payload, peekCachedJson(CLASS_TEACHER_URL)?.data?.teacher || null);
      writeCacheEntry(DASHBOARD_CACHE_KEY, nextData, DASHBOARD_CACHE_TTL_MS);
      if (!isMountedRef.current) return;
      setData(nextData);

      // Class-teacher metadata is secondary. Do not delay the dashboard when
      // this endpoint is slow or unavailable.
      fetchCachedJson(CLASS_TEACHER_URL, {
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

  const fetchSmartLearningReminders = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || typeof fetch !== 'function' || localStorage.getItem('userType') !== 'Student') return;
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [paperPayload, assignmentPayload] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/api/practice-papers/student/papers?limit=100`, { headers }).then((r) => r.ok ? r.json() : null),
        fetch(`${import.meta.env.VITE_API_URL}/api/assignment/student/assignments`, { headers }).then((r) => r.ok ? r.json() : null),
      ]);
      const papers = (Array.isArray(paperPayload?.papers) ? paperPayload.papers : []).filter((paper) => paper.studentStatus !== 'completed');
      const assignments = (Array.isArray(assignmentPayload) ? assignmentPayload : []).filter((assignment) => {
        const type = String(assignment?.type || '').toLowerCase();
        return type.includes('worksheet') && !['submitted', 'graded', 'late'].includes(String(assignment?.submissionStatus || '').toLowerCase());
      });
      setSmartLearningReminders([
        ...papers.map((paper) => ({ id: `paper-${paper._id}`, kind: 'Practice paper', subject: paper.subjectName || paper.subject?.name || paper.subject || '', chapter: paper.chapterTitle || paper.chapter || '', topic: paper.topicTitle || paper.subTopicTitle || paper.topics?.[0] || paper.chapterTitle || paper.chapter || '', title: paper.title, status: paper.studentStatus || 'not_started', progress: Number(paper.progressPercent) || 0, path: reminderPath(paper.subjectName || paper.subject?.name || paper.subject, paper.topicTitle || paper.chapterTitle || paper.chapter || paper.subTopicTitle, 'paper', paper._id) })),
        ...assignments.map((assignment) => ({ id: `worksheet-${assignment._id}`, kind: 'Worksheet', subject: assignment.subject || '', chapter: assignment.chapterTitle || '', topic: assignment.topicTitle || assignment.topic || assignment.subTopicTitle || assignment.chapterTitle || '', title: assignment.title, status: 'not_started', progress: 0, path: reminderPath(assignment.subjectName || assignment.subject, assignment.topicTitle || assignment.topic || assignment.chapterTitle, 'worksheet', assignment._id) })),
      ]);
    } catch {
      // keep existing reminders on transient network errors
    }
  }, []);

  // Refetch periodically and on focus/visibility — not just once per mount —
  // so completing a practice paper or worksheet in-session clears its own
  // reminder instead of it lingering until the next full page load.
  useEffect(() => {
    fetchSmartLearningReminders();
    const intervalId = window.setInterval(fetchSmartLearningReminders, 60000);
    const onFocus = () => fetchSmartLearningReminders();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchSmartLearningReminders();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchSmartLearningReminders]);

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
      if (res.status === 401 || res.status === 403) {
        logoutAndRedirect({ notice: AUTH_NOTICE.EXPIRED, clearAllLocalStorage: true });
        return;
      }
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
    const onChatMessage = () => fetchUnreadChatCount();
    window.addEventListener('chat:new-message', onChatMessage);
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
      window.removeEventListener('chat:new-message', onChatMessage);
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
      smartLearningReminders,
      markNotificationAsRead: notificationState.markAsRead,
      dismissNotification: notificationState.dismissNotification,
      markAllNotificationsAsRead: notificationState.markAllAsRead,
      notificationsLoading: notificationState.loading,
      notificationsError: notificationState.error,
      moduleSeenState,
      chatSeenCount,
      markModuleVisited,
      refresh: () => fetchDashboard({ forceRefresh: true }),
    }),
    [loading, error, data.profile, data.classTeacher, data.stats, data.course, data.recentAttendance, unreadChatCount, notificationState, smartLearningReminders, moduleSeenState, chatSeenCount, markModuleVisited, fetchDashboard]
  );

  return (
    <StudentDashboardContext.Provider value={value}>
      {children}
    </StudentDashboardContext.Provider>
  );
};

export const useStudentDashboard = () => useContext(StudentDashboardContext);
