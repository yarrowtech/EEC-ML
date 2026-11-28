// Admit cards: client cache (memory + localStorage, per login & portal) so the
// page paints instantly, then quietly refreshes from the server.

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

// How long a saved copy may be shown while a fresh one loads in the background.
export const ADMIT_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export const admitEndpoint = (mode) => `${API_BASE}${mode === 'parent'
  ? '/api/exam/groups/parent-admit-cards'
  : '/api/exam/groups/student-admit-cards'}`;

const cacheKey = (mode) => {
  let t = '';
  try { t = localStorage.getItem('token') || ''; } catch { /* ignore */ }
  return `admit-cards:v2:${mode}:${t.slice(-16)}`;
};

const mem = new Map();

export const readAdmitCache = (mode) => {
  const key = cacheKey(mode);
  let entry = mem.get(key);
  if (!entry) {
    try { entry = JSON.parse(localStorage.getItem(key) || 'null'); } catch { entry = null; }
    if (entry) mem.set(key, entry);
  }
  return entry && Date.now() - entry.at < ADMIT_CACHE_MAX_AGE ? entry.data : null;
};

export const writeAdmitCache = (mode, data) => {
  const key = cacheKey(mode);
  const entry = { at: Date.now(), data };
  mem.set(key, entry);
  try { localStorage.setItem(key, JSON.stringify(entry)); } catch { /* quota */ }
};

const inflight = new Map();

/** Warm the cache in the background (e.g. right after login). Never throws. */
export const prefetchAdmitCards = (mode = 'student') => {
  const key = cacheKey(mode);
  if (inflight.has(key)) return inflight.get(key);
  let token = '';
  try { token = localStorage.getItem('token') || ''; } catch { /* ignore */ }
  if (!token) return Promise.resolve(null);
  const request = fetch(admitEndpoint(mode), {
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => { if (data) writeAdmitCache(mode, data); return data; })
    .catch(() => null)
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
};
