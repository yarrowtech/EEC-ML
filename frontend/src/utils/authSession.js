export const AUTH_NOTICE_KEY = 'auth_notice';

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

export const clearAuthData = ({ clearAllLocalStorage = false } = {}) => {
  if (clearAllLocalStorage) {
    localStorage.clear();
    resetBrowserBranding();
    return;
  }
  localStorage.removeItem('token');
  localStorage.removeItem('userType');
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
  clearAuthData({ clearAllLocalStorage });
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
