import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearCacheEntry, readCacheEntry, writeCacheEntry } from '../utils/studentCache';
import { fetchCachedJson } from '../utils/studentApiCache';

const StudentDashboardContext = createContext({
  loading: true,
  error: '',
  profile: null,
  classTeacher: null,
  stats: null,
  course: null,
  recentAttendance: [],
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
      const [dashboardResult, teacherResult] = await Promise.all([
        fetchCachedJson(`${import.meta.env.VITE_API_URL}/api/student/auth/dashboard`, {
          ttlMs: STUDENT_API_CACHE_TTL_MS,
          // Always refresh dashboard stats to avoid showing stale achievement counts.
          forceRefresh: true,
          fetchOptions: {
            signal: controller.signal,
            headers,
          },
        }),
        // Class teacher rarely changes mid-session — safe to serve from cache instead of
        // forcing a network round-trip on every dashboard mount.
        fetchCachedJson(`${import.meta.env.VITE_API_URL}/api/student/auth/class-teacher`, {
          ttlMs: STUDENT_API_CACHE_TTL_MS,
          fetchOptions: {
            signal: controller.signal,
            headers,
          },
        }).catch(() => ({ data: { teacher: null }, fromCache: false })),
      ]);

      const payload = dashboardResult?.data || {};
      const classTeacher = teacherResult?.data?.teacher || null;
      const nextData = {
        profile: payload.profile || null,
        classTeacher,
        stats: payload.stats || null,
        course: payload.course || null,
        recentAttendance: payload.recentAttendance || [],
      };
      writeCacheEntry(DASHBOARD_CACHE_KEY, nextData, DASHBOARD_CACHE_TTL_MS);
      if (!isMountedRef.current) return;
      setData(nextData);
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

  const value = useMemo(
    () => ({
      loading,
      error,
      profile: data.profile,
      classTeacher: data.classTeacher,
      stats: data.stats,
      course: data.course,
      recentAttendance: data.recentAttendance,
      refresh: () => fetchDashboard(),
    }),
    [loading, error, data.profile, data.classTeacher, data.stats, data.course, data.recentAttendance, fetchDashboard]
  );

  return (
    <StudentDashboardContext.Provider value={value}>
      {children}
    </StudentDashboardContext.Provider>
  );
};

export const useStudentDashboard = () => useContext(StudentDashboardContext);
