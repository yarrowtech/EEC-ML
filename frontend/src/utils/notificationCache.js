import { parseJwtPayload } from './authSession';

// Client-side cache for the notification bell (all portals). The last list
// fetched is kept in localStorage per user, so the panel opens instantly with
// it while the next poll refreshes in the background. Logout clears
// localStorage, and keys are per user, so nobody sees someone else's list.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const cacheKey = (kind) => {
  try {
    const payload = parseJwtPayload(localStorage.getItem('token'));
    const userId = payload?.id || payload?._id || payload?.userId;
    return userId ? `notif-cache:${userId}:${kind}` : null;
  } catch {
    return null;
  }
};

/** Last cached list for this user, or null when there is none. */
export const readCachedNotifications = (kind = 'notification') => {
  const key = cacheKey(kind);
  if (!key) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    if (!parsed || !Array.isArray(parsed.items)) return null;
    if (Date.now() - Number(parsed.savedAt || 0) > MAX_AGE_MS) return null;
    return parsed.items;
  } catch {
    return null;
  }
};

export const writeCachedNotifications = (items, kind = 'notification') => {
  const key = cacheKey(kind);
  if (!key || !Array.isArray(items)) return;
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), items }));
  } catch {
    // quota / blocked storage — the network list still works
  }
};
