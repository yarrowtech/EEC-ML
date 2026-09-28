// Short-lived in-memory cache for the admin HR GET endpoints (teacher leaves,
// expenses, attendance, attendance settings, leave policy). Keyed per school +
// campus + URL so tenants never share entries. Any HR write — admin approvals /
// settings here, or teacher check-in / leave / expense in teacherDashboardRoutes —
// clears it, so the TTL only bounds staleness from writes we don't see.
const HR_CACHE_TTL_MS = 30 * 1000;
const HR_CACHE_MAX_ENTRIES = 500;

const hrCache = new Map(); // key -> { body, expires }

const hrCacheKey = (req) =>
  `${req.schoolId || req.admin?.schoolId || 'x'}:${req.campusId || 'x'}:${req.originalUrl}`;

const invalidateHrCache = () => hrCache.clear();

// Middleware: serve a fresh cached body, otherwise capture res.json on 200.
const cacheHrResponse = (req, res, next) => {
  const key = hrCacheKey(req);
  const hit = hrCache.get(key);
  if (hit && hit.expires > Date.now()) {
    res.set('X-Cache', 'HIT');
    return res.json(hit.body);
  }
  if (hit) hrCache.delete(key);
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) {
      if (hrCache.size >= HR_CACHE_MAX_ENTRIES) hrCache.delete(hrCache.keys().next().value);
      hrCache.set(key, { body, expires: Date.now() + HR_CACHE_TTL_MS });
    }
    res.set('X-Cache', 'MISS');
    return originalJson(body);
  };
  return next();
};

// Middleware: clear the cache once a write request succeeds.
const invalidateHrCacheOnWrite = (req, res, next) => {
  invalidateHrCache();
  res.on('finish', () => {
    if (res.statusCode < 400) invalidateHrCache();
  });
  next();
};

module.exports = {
  HR_CACHE_TTL_MS,
  cacheHrResponse,
  invalidateHrCache,
  invalidateHrCacheOnWrite,
};
