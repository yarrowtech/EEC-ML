import { prefetchJson } from './studentApiCache';

// Must match the base DashboardHome / StudentDashboardContext build their URLs
// with, otherwise the prefetched cache keys would never be hit.
export const STUDENT_API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
export const STUDENT_DASHBOARD_TTL_MS = 5 * 60 * 1000;

export const STUDENT_DASHBOARD_URLS = [
  '/api/student/auth/dashboard',
  '/api/student/auth/class-teacher',
  '/api/student/auth/schedule',
  '/api/exam/results/me',
  '/api/spaced-repetition/retention',
  '/api/confidence/profile',
  '/api/learning-style/me',
  '/api/belonging/me',
  '/api/help-seeking/profile',
  '/api/student-dashboard/mastery-topics',
  '/api/student-dashboard/learning-streak',
  '/api/student-dashboard/time-by-subject',
  '/api/student-dashboard/flashcard-stats',
].map((path) => `${STUDENT_API_BASE}${path}`);

/** Fire every dashboard request (and the lazy Dashboard chunk) the moment a
 *  student logs in, so the data is already in flight / cached by the time the
 *  dashboard mounts. Requests are de-duplicated in studentApiCache. */
export const prefetchStudentDashboard = () => {
  import('../components/Dashboard').catch(() => {});
  prefetchJson(STUDENT_DASHBOARD_URLS, { ttlMs: STUDENT_DASHBOARD_TTL_MS });
};
