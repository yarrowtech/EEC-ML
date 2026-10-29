import { AUTH_NOTICE, logoutAndRedirect } from './authSession';

const DEFAULT_TTL_MS = 2 * 60 * 1000;
// Entries stay readable as "stale" this long after their TTL so the UI can
// paint last-known data instantly while a background refresh runs.
const STALE_RETENTION_MS = 24 * 60 * 60 * 1000;

// url-key -> Promise, so the login prefetch and the dashboard widgets that
// mount right after share one network request instead of racing duplicates.
const inflight = new Map();

const getStorage = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

const buildTokenScope = () => {
  try {
    const token = localStorage.getItem('token') || '';
    if (!token) return 'anon';
    const head = token.slice(0, 8);
    const tail = token.slice(-8);
    return `${head}:${tail}`;
  } catch {
    return 'anon';
  }
};

const normalizeUrl = (url) => String(url || '').trim();

const withStudentAuthorization = (fetchOptions) => {
  const headers = new Headers(fetchOptions?.headers || {});
  const storage = getStorage();
  const token = storage?.getItem('token') || '';
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return { ...fetchOptions, headers };
};

const buildCacheKey = (url) => `student-api-cache:${buildTokenScope()}:${normalizeUrl(url)}`;

const readEntry = (key, { allowStale = false } = {}) => {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const now = Date.now();
    if (parsed.expiresAt && parsed.expiresAt + STALE_RETENTION_MS < now) {
      storage.removeItem(key);
      return null;
    }
    const stale = Boolean(parsed.expiresAt && parsed.expiresAt < now);
    if (stale && !allowStale) return null;
    return { ...parsed, stale };
  } catch {
    return null;
  }
};

const writeEntry = (key, data, ttlMs) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    const now = Date.now();
    storage.setItem(
      key,
      JSON.stringify({
        data,
        timestamp: now,
        expiresAt: now + Math.max(1, Number(ttlMs) || DEFAULT_TTL_MS),
      })
    );
  } catch {
    // Ignore quota/serialization issues and fall back to network.
  }
};

export const clearStudentApiCacheByUrl = (url) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(buildCacheKey(url));
  } catch {
    // ignore
  }
};

/** Synchronously read the last cached payload for a URL (fresh or stale).
 *  Returns undefined when nothing is cached. Use it to seed initial state so
 *  screens render instantly instead of starting from a spinner. */
export const peekCachedJson = (url) => {
  const cached = readEntry(buildCacheKey(normalizeUrl(url)), { allowStale: true });
  if (!cached || !Object.prototype.hasOwnProperty.call(cached, 'data')) return undefined;
  return { data: cached.data, stale: cached.stale };
};

/** Warm the cache for a set of URLs (fire-and-forget). */
export const prefetchJson = (urls, { ttlMs = DEFAULT_TTL_MS } = {}) => {
  (urls || []).forEach((url) => {
    fetchCachedJson(url, { ttlMs }).catch(() => {});
  });
};

const requestJson = async (normalizedUrl, key, ttlMs, fetchOptions) => {
  const response = await fetch(normalizedUrl, withStudentAuthorization(fetchOptions));
  if (response.status === 401 || response.status === 403) {
    // Central auth-failure handling for the student data layer: wipe the
    // session and bounce to login (AuthSessionManager listens for the event).
    logoutAndRedirect({ notice: AUTH_NOTICE.EXPIRED, clearAllLocalStorage: true });
    const authError = new Error('Session expired');
    authError.code = AUTH_NOTICE.EXPIRED;
    throw authError;
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      message = payload?.error || payload?.message || message;
    } catch {
      // keep fallback message
    }
    throw new Error(message);
  }

  const payload = await response.json();
  writeEntry(key, payload, ttlMs);
  return payload;
};

export const fetchCachedJson = async (url, options = {}) => {
  const {
    ttlMs = DEFAULT_TTL_MS,
    forceRefresh = false,
    fetchOptions = {},
  } = options;

  const normalizedUrl = normalizeUrl(url);
  const key = buildCacheKey(normalizedUrl);
  if (!forceRefresh) {
    const cached = readEntry(key);
    if (cached && Object.prototype.hasOwnProperty.call(cached, 'data')) {
      return { data: cached.data, fromCache: true };
    }
  }

  // The shared request ignores the caller's AbortSignal (other callers may be
  // waiting on it); an aborting caller just stops listening.
  const { signal, ...sharedFetchOptions } = fetchOptions || {};
  let request = forceRefresh ? null : inflight.get(key);
  if (!request) {
    request = requestJson(normalizedUrl, key, ttlMs, sharedFetchOptions)
      .finally(() => { if (inflight.get(key) === request) inflight.delete(key); });
    inflight.set(key, request);
  }

  const data = signal
    ? await new Promise((resolve, reject) => {
        const abortError = () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          return err;
        };
        if (signal.aborted) { reject(abortError()); return; }
        const onAbort = () => reject(abortError());
        signal.addEventListener('abort', onAbort, { once: true });
        request.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
      })
    : await request;
  return { data, fromCache: false };
};
