const STORAGE_KEY = 'adminScope';

const parseScope = (raw) => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value._id || value.id || value.value || null;
  }
  return null;
};

export const getStoredAdminScope = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { schoolId: null, campusId: null };
  }
  const parsed = parseScope(window.localStorage.getItem(STORAGE_KEY));
  return {
    schoolId: parsed.schoolId || null,
    campusId: parsed.campusId || null,
  };
};

export const persistAdminScope = ({ schoolId, campusId }) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const next = {
    schoolId: normalizeId(schoolId),
    campusId: normalizeId(campusId),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Scope persistence is optional. A full/private browser storage area
    // must not prevent the authenticated profile from loading.
  }
};

export const clearAdminScope = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage access errors during logout/cleanup.
  }
};

let fetchPatched = false;

export const ensureAdminFetchScope = () => {
  if (typeof window === 'undefined' || fetchPatched || typeof window.fetch !== 'function') {
    return;
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const headers = new Headers(init.headers || {});
    const token = window.localStorage?.getItem('token');
    if (token && !headers.has('authorization')) {
      headers.set('authorization', `Bearer ${token}`);
    }
    const { schoolId, campusId } = getStoredAdminScope();
    if (schoolId && !headers.has('x-school-id')) {
      headers.set('x-school-id', schoolId);
    }
    if (campusId && !headers.has('x-campus-id')) {
      headers.set('x-campus-id', campusId);
    }
    return originalFetch(input, { ...init, headers });
  };
  fetchPatched = true;
};

export const syncScopeFromProfile = (profile) => {
  if (!profile) return;
  persistAdminScope({
    schoolId: profile.schoolId,
    campusId: profile.campusId,
  });
};
