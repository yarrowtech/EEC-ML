import { useCallback, useEffect, useMemo, useState } from 'react';
import { parentApiJson } from './parentApi';
import { useSharedChildSelection } from './ChildSwitcher';

// One fetch of the parent's linked children (read-only profile data), shared by
// the Homework, Calendar, Child Profile and Documents screens for this session.
let cache = null; // { at, data }
const CACHE_MS = 5 * 60 * 1000;

export const fetchParentChildren = async ({ force = false } = {}) => {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const data = await parentApiJson('/api/parent/auth/children-profile');
  cache = { at: Date.now(), data };
  return data;
};

/**
 * @returns {{ parent, children, options, childKey, setChildKey, selected, loading, error, reload }}
 * `selected` is the full child profile for the child picked in the shared
 * switcher (the choice follows the parent across every screen).
 */
const useParentChildren = () => {
  const [data, setData] = useState(() => (cache ? cache.data : null));
  const [loading, setLoading] = useState(!cache);
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
