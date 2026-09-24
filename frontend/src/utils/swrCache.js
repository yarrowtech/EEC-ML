// Tiny stale-while-revalidate cache for admin API reads.
//
// Pages render the last good response instantly from here, then refetch in
// the background and overwrite it. Entries are scoped to the current tenant
// host + auth token, so switching school/user never shows another account's
// data. sessionStorage persists across in-app navigation and reloads of the
// same tab; an in-memory mirror avoids re-parsing JSON on every read.

const PREFIX = 'eec_swr_v1';
const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000; // older entries are ignored
const memory = new Map();

const scope = () => {
  let token = '';
  try {
    token = localStorage.getItem('token') || '';
  } catch {
    /* storage unavailable */
  }
  const host = typeof window !== 'undefined' ? window.location.host : '';
  return `${host}:${token.slice(-24)}`;
};

const fullKey = (key) => `${PREFIX}:${scope()}:${key}`;

export const readCache = (key, maxAgeMs = DEFAULT_MAX_AGE_MS) => {
  const k = fullKey(key);
  let entry = memory.get(k);
  if (!entry) {
    try {
      const raw = sessionStorage.getItem(k);
      if (raw) {
        entry = JSON.parse(raw);
        memory.set(k, entry);
      }
    } catch {
      return null;
    }
  }
  if (!entry || Date.now() - Number(entry.t || 0) > maxAgeMs) return null;
  return entry.d;
};

export const writeCache = (key, data) => {
  const k = fullKey(key);
  const entry = { t: Date.now(), d: data };
  memory.set(k, entry);
  try {
    sessionStorage.setItem(k, JSON.stringify(entry));
  } catch {
    // Quota exceeded or storage blocked — keep the in-memory copy only.
  }
};

// Drop cached entries whose key starts with `keyPrefix` (e.g. after a payment).
export const invalidateCache = (keyPrefix = '') => {
  const start = `${PREFIX}:${scope()}:${keyPrefix}`;
  [...memory.keys()].forEach((k) => { if (k.startsWith(start)) memory.delete(k); });
  try {
    Object.keys(sessionStorage).forEach((k) => { if (k.startsWith(start)) sessionStorage.removeItem(k); });
  } catch {
    /* storage unavailable */
  }
};

// Session-scoped admin data (dashboard stats/fees, Fees Collection lists) is
// only valid for one active academic year. Call this after the active session
// changes so every page refetches instead of painting the previous session.
const SESSION_SCOPED_PREFIXES = [PREFIX, 'admin_dashboard_cache'];
export const clearSessionScopedCaches = () => {
  memory.clear();
  try {
    Object.keys(sessionStorage).forEach((k) => {
      if (SESSION_SCOPED_PREFIXES.some((p) => k.startsWith(p))) sessionStorage.removeItem(k);
    });
  } catch {
    /* storage unavailable */
  }
};
