import { fetchCachedJson, peekCachedJson } from './studentApiCache';

// One cached copy of the student's Smart Learning map, shared by the Practice
// page, the tryout exam and the AI tutor (same URL → same cache entry).
// Stale-while-revalidate: callers paint the last copy instantly, then refresh.
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
export const SMART_LEARNING_MAP_URL = `${API_BASE}/api/lesson-plans/student/smart-learning-map`;

// Short TTL so new tryouts/materials from teachers show up within a minute.
const MAP_TTL_MS = 60 * 1000;

const subjectsOf = (data) => (Array.isArray(data?.subjects) ? data.subjects : []);

/** Last cached subjects (fresh or stale) or null — use it to seed initial state. */
export const peekSmartLearningSubjects = () => {
  const hit = peekCachedJson(SMART_LEARNING_MAP_URL);
  return hit ? { subjects: subjectsOf(hit.data), stale: hit.stale } : null;
};

/** Fresh subjects: served from cache while fresh, otherwise from the network
 *  (concurrent callers share one request). `force` skips the cache. */
export const loadSmartLearningSubjects = async ({ force = false, signal } = {}) => {
  const { data } = await fetchCachedJson(SMART_LEARNING_MAP_URL, {
    ttlMs: MAP_TTL_MS,
    forceRefresh: force,
    fetchOptions: signal ? { signal } : {},
  });
  return subjectsOf(data);
};
