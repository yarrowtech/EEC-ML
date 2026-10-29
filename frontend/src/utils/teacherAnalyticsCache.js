// Client cache for the teacher Class Analytics screen, built on swrCache.
//
// cachedFetch() is a drop-in for GET fetch(): a cached body is returned at
// once as a Response, so tabs paint instantly. Entries older than FRESH_MS are
// still served but refreshed in the background, so the next visit is current.
// The backend also caches these reads (teacherAnalyticsCache, 60s).
import { readCache, writeCache, invalidateCache } from './swrCache';

const PREFIX = 'teacher-analytics:v14:';
const FRESH_MS = 60 * 1000;
const MAX_AGE_MS = 10 * 60 * 1000;
const inflight = new Map();

const toResponse = (data) => new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json', 'X-Client-Cache': 'HIT' },
});

const fetchAndStore = (url, options) => {
  const key = PREFIX + url;
  if (inflight.has(key)) return inflight.get(key);
  const promise = fetch(url, options)
    .then(async (res) => {
      if (res.ok) {
        const data = await res.clone().json().catch(() => undefined);
        if (data !== undefined) writeCache(key, { data, at: Date.now() });
      }
      return res;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
};

export const cachedFetch = async (url, options = {}) => {
  const hit = readCache(PREFIX + url, MAX_AGE_MS);
  if (hit) {
    if (Date.now() - hit.at > FRESH_MS) fetchAndStore(url, options).catch(() => {});
    return toResponse(hit.data);
  }
  const res = await fetchAndStore(url, options);
  return res.clone();
};

// Warm the cache without rendering anything (e.g. other analytics tabs).
export const prefetch = (url, options = {}) => {
  if (readCache(PREFIX + url, FRESH_MS)) return;
  fetchAndStore(url, options).catch(() => {});
};

// Call after any write on this screen so the next read hits the server.
export const invalidateTeacherAnalytics = () => invalidateCache(PREFIX);
