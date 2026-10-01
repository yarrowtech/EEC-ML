import { useCallback, useEffect, useMemo, useState } from 'react';
import { parentApiJson } from './parentApi';
import { useSharedChildSelection } from './ChildSwitcher';

// One fetch of the parent's linked children (read-only profile data), shared by
// the Homework, Calendar, Child Profile and Documents screens.
// Stale-while-revalidate: the last response is kept in localStorage (per token)
// so every screen paints instantly; anything older than FRESH_MS is refreshed
// in the background without showing a loader.
const FRESH_MS = 60 * 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const storageKey = () => {
  let t = '';
  try { t = localStorage.getItem('token') || ''; } catch { /* ignore */ }
  return `parent:children:v2:${t.slice(-16)}`;
};
const readStored = () => {
  try {
    const key = storageKey();
    const entry = JSON.parse(localStorage.getItem(key) || 'null');
    return entry && Date.now() - entry.at < MAX_AGE_MS ? { ...entry, key } : null;
  } catch { return null; }
};
let cache = readStored(); // { key, at, data }
let inflight = null;

const currentCache = () => {
  // A different login in this tab must never see the previous parent's data.
  if (!cache || cache.key !== storageKey()) cache = readStored();
  return cache;
};

export const fetchParentChildren = async ({ force = false } = {}) => {
  const c = currentCache();
  if (!force && c && Date.now() - c.at < FRESH_MS) return c.data;
  if (!inflight) {
    inflight = parentApiJson('/api/parent/auth/children-profile')
      .then((data) => {
        cache = { key: storageKey(), at: Date.now(), data };
        try { localStorage.setItem(cache.key, JSON.stringify({ at: cache.at, data })); } catch { /* quota / private mode */ }
        return data;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
};

/**
 * @returns {{ parent, school, children, options, childKey, setChildKey, selected, loading, error, reload }}
 * `selected` is the full child profile for the child picked in the shared
 * switcher (the choice follows the parent across every screen).
 */
const useParentChildren = () => {
  const [data, setData] = useState(() => currentCache()?.data || null);
  const [loading, setLoading] = useState(() => !currentCache());
  const [error, setError] = useState('');

  const load = useCallback(async (force = false) => {
    // Only show a loader when there is nothing cached to display.
    if (!currentCache()) setLoading(true);
    setError('');
    try {
      setData(await fetchParentChildren({ force }));
    } catch (err) {
      setError(err.message || 'Unable to load your children');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const children = useMemo(() => (Array.isArray(data?.children) ? data.children : []), [data]);
  const options = useMemo(
    () => children.map((c) => ({ id: c.id, name: c.name, meta: [c.grade && `Class ${c.grade}`, c.section].filter(Boolean).join('-') })),
    [children],
  );
  const [childKey, setChildKey, selectedOption] = useSharedChildSelection(options);
  const selected = children.find((c) => c.id === selectedOption?.id) || null;

  return {
    parent: data?.parent || null,
    school: data?.school || null,
    children,
    options,
    childKey,
    setChildKey,
    selected,
    loading,
    error,
    reload: () => load(true),
  };
};

export default useParentChildren;
