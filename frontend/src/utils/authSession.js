export const AUTH_NOTICE_KEY = 'auth_notice';
export const AUTH_LOGOUT_EVENT = 'eec:auth-logout';

const resetBrowserBranding = () => {
  document.title = 'Electronic Educare';
  const favicon = document.querySelector("link[rel~='icon']");
  if (favicon) {
    favicon.removeAttribute('type');
    favicon.setAttribute('href', '/logo_new.png');
  }
};

export const AUTH_NOTICE = Object.freeze({
  EXPIRED: 'expired',
  LOGGED_OUT: 'logged_out',
});

const resolveApiBaseUrl = () => {
  const configured = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '').replace(/\/api$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return 'http://localhost:5000';
};

// Keys / key-prefixes that hold user-scoped data (dashboard snapshots, cached
// API responses, points, chat history, E2EE material). These must not survive a
// logout on a shared device.
const SENSITIVE_LS_KEYS = ['token', 'userType', 'studentDashboardCacheV1'];
const SENSITIVE_LS_PREFIXES = [
  'student-api-cache:',
  'parent-api-cache:',
  'teacher-api-cache:',
  'eec_points',
  'eec_points_awarded_',
  'chatCache',
  'chat_e2ee_',
  'tutorChatHistory',
  'learningContinuity',
];

const purgeSensitiveLocalStorage = () => {
  try {
    SENSITIVE_LS_KEYS.forEach((k) => localStorage.removeItem(k));
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && SENSITIVE_LS_PREFIXES.some((p) => key.startsWith(p))) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore storage access errors
  }
};

export const clearAuthData = ({ clearAllLocalStorage = false } = {}) => {
  if (clearAllLocalStorage) {
    try { localStorage.clear(); } catch { /* ignore */ }
    resetBrowserBranding();
    return;
  }
  purgeSensitiveLocalStorage();
  resetBrowserBranding();
};

export const parseJwtPayload = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const getTokenExpiryMs = (token) => {
  const payload = parseJwtPayload(token);
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp) || exp <= 0) return null;
  return exp * 1000;
};

export const setAuthNotice = (notice) => {
  if (!notice) return;
  sessionStorage.setItem(AUTH_NOTICE_KEY, notice);
};

export const consumeAuthNotice = () => {
  const notice = sessionStorage.getItem(AUTH_NOTICE_KEY);
  if (notice) {
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
  }
  return notice;
};

export const logoutAndRedirect = ({
  navigate,
  notice = AUTH_NOTICE.LOGGED_OUT,
  clearAllLocalStorage = false,
  replace = true,
} = {}) => {
  const token = localStorage.getItem('token');
  if (token) {
    const apiBaseUrl = resolveApiBaseUrl();
    void fetch(`${apiBaseUrl}/api/chat/presence/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      keepalive: true,
    }).catch(() => {});
  }
  clearAuthData({ clearAllLocalStorage });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
  }
  setAuthNotice(notice);
  if (typeof navigate === 'function') {
    navigate('/', { replace, state: { authNotice: notice } });
  }
};

// ---------------------------------------------------------------------------
// apiFetch — drop-in fetch() wrapper that auto-redirects on 401/403.
// Usage: const res = await apiFetch(url, options, navigate);
// ---------------------------------------------------------------------------
export const apiFetch = async (url, options = {}, navigate = null) => {
  const res = await fetch(url, options);
  if ((res.status === 401 || res.status === 403) && navigate) {
    logoutAndRedirect({ navigate, notice: AUTH_NOTICE.EXPIRED, clearAllLocalStorage: true });
    const authError = new Error('Session expired');
    authError.code = AUTH_NOTICE.EXPIRED;
    throw authError;
  }
  return res;
};
