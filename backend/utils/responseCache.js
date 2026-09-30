// Small per-route in-memory response cache (same approach as hrDataCache).
// Keyed by user + school + campus + URL so users never see each other's data.
// Each cache instance is cleared by any successful write in the routers that
// own its data, so the TTL only bounds staleness from writes elsewhere.
const createResponseCache = ({ ttlMs = 30 * 1000, maxEntries = 1000 } = {}) => {
  const store = new Map(); // key -> { body, expires }

  const keyOf = (req) => [
    req.user?.id || req.admin?.id || 'anon',
    req.schoolId || req.user?.schoolId || 'x',
    req.campusId || req.user?.campusId || 'x',
    req.originalUrl,
  ].join(':');

  const clear = () => store.clear();

  // GET middleware (place after auth): serve a fresh hit, else capture 200s.
  const cache = (req, res, next) => {
    const key = keyOf(req);
    const hit = store.get(key);
    if (hit && hit.expires > Date.now()) {
      res.set('X-Cache', 'HIT');
      return res.json(hit.body);
    }
    if (hit) store.delete(key);
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) {
        if (store.size >= maxEntries) store.delete(store.keys().next().value);
        store.set(key, { body, expires: Date.now() + ttlMs });
      }
      res.set('X-Cache', 'MISS');
      return originalJson(body);
    };
    return next();
  };

  // router.use(...) middleware: any non-GET request clears the cache.
  const invalidateOnWrite = (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    clear();
    res.on('finish', () => { if (res.statusCode < 400) clear(); });
    return next();
  };

  return { cache, clear, invalidateOnWrite };
};

// Shared cache for the parent attendance screen (attendance, holidays,
// excuse letters). Writes to any of those routers clear it.
const parentAttendanceCache = createResponseCache({ ttlMs: 30 * 1000 });

module.exports = { createResponseCache, parentAttendanceCache };
