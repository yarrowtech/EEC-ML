const DEFAULT_TTL_MS = 2 * 60 * 1000;

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

const readEntry = (key) => {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      storage.removeItem(key);
      return null;
    }
    return parsed;
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

  const response = await fetch(normalizedUrl, withStudentAuthorization(fetchOptions));
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
  return { data: payload, fromCache: false };
};
