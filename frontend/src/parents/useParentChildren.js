import { useCallback, useEffect, useMemo, useState } from 'react';
import { parentApiJson } from './parentApi';
import { useSharedChildSelection } from './ChildSwitcher';

// One fetch of the parent's linked children (read-only profile data), shared by
// the Homework, Calendar, Child Profile and Documents screens for this session.
// Also mirrored to sessionStorage (per token) so a page reload paints at once.
const CACHE_MS = 5 * 60 * 1000;
const storageKey = () => {
  let t = '';
  try { t = localStorage.getItem('token') || ''; } catch { /* ignore */ }
  return `parent:children:v1:${t.slice(-16)}`;
};
const readStored = () => {
  try {
    const key = storageKey();
    const entry = JSON.parse(sessionStorage.getItem(key) || 'null');
    return entry && Date.now() - entry.at < CACHE_MS ? { ...entry, key } : null;
  } catch { return null; }
};
let cache = readStored(); // { at, data }

export const fetchParentChildren = async ({ force = false } = {}) => {
  // A different login in this tab must never see the previous parent's data.
  if (cache && cache.key !== storageKey()) cache = readStored();
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const data = await parentApiJson('/api/parent/auth/children-profile');
  cache = { key: storageKey(), at: Date.now(), data };
  try { sessionStorage.setItem(storageKey(), JSON.stringify(cache)); } catch { /* quota / private mode */ }
  return data;
};

/**
 * @returns {{ parent, children, options, childKey, setChildKey, selected, loading, error, reload }}
 * `selected` is the full child profile for the child picked in the shared
 * switcher (the choice follows the parent across every screen).
 */
const useParentChildren = () => {
  const [data, setData] = useState(() => (cache && cache.key === storageKey() ? cache.data : null));
  const [loading, setLoading] = useState(!(cache && cache.key === storageKey()));
  const [error, setError] = useState('');

  const load = useCallback(async (force = false) => {
    setLoading(true);
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
