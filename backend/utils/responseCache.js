// Small per-route in-memory response cache (same approach as hrDataCache).
// Keyed by user + school + campus + URL so users never see each other's data.
// Each cache instance is cleared by any successful write in the routers that
// own its data, so the TTL only bounds staleness from writes elsewhere.
const createResponseCache = ({ ttlMs = 30 * 1000, maxEntries = 1000 } = {}) => {
  const store = new Map(); // key -> { body, expires }
  let generation = 0;

  const keyOf = (req) => [
    req.user?.id || req.admin?.id || 'anon',
    req.schoolId || req.user?.schoolId || 'x',
    req.campusId || req.user?.campusId || 'x',
    req.originalUrl,
  ].join(':');

  const clear = () => {
    generation += 1;
    store.clear();
  };

  // Drop only one user's entries (keys start with their id).
  const clearUser = (userId) => {
    if (!userId) return;
    const prefix = `${userId}:`;
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  };

  // GET middleware (place after auth): serve a fresh hit, else capture 200s.
  const cache = (req, res, next) => {
    const key = keyOf(req);
    const hit = store.get(key);
    // A client "refresh" (Cache-Control: no-cache) skips the cached copy but still re-fills it
    const bypass = /no-cache/i.test(String(req.get?.('cache-control') || ''));
    if (!bypass && hit && hit.expires > Date.now()) {
      res.set('X-Cache', 'HIT');
      return res.json(hit.body);
    }
    if (hit) store.delete(key);
    const requestGeneration = generation;
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200 && requestGeneration === generation) {
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

  // app.use(...) middleware: a successful non-GET by an authenticated user
  // clears that user's entries only (req.user is set by route-level auth by
  // the time the response finishes).
  const invalidateUserOnWrite = (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    res.on('finish', () => {
      if (res.statusCode < 400) clearUser(req.user?.id || req.userId);
    });
    return next();
  };

  return { cache, clear, clearUser, invalidateOnWrite, invalidateUserOnWrite };
};

// Shared cache for the parent attendance screen (attendance, holidays,
// excuse letters). Writes to any of those routers clear it.
const parentAttendanceCache = createResponseCache({ ttlMs: 30 * 1000 });

// Per-user notification/notice feed. Cleared by Notification model write hooks.
const userNotificationsCache = createResponseCache({ ttlMs: 60 * 1000 });

// Parent fees screen (children + invoices/payments). Cleared by FeeInvoice and
// FeePayment model write hooks, so payments made anywhere show up at once.
const parentFeesCache = createResponseCache({ ttlMs: 60 * 1000 });

// Teacher class-analytics reads (progress, teacher-analytics, ML, confidence,
// help-seeking, learning-style, belonging). Any write in those routers clears it;
// the TTL bounds staleness from student activity recorded elsewhere.
const teacherAnalyticsCache = createResponseCache({ ttlMs: 60 * 1000, maxEntries: 2000 });

// Chat reads (me, contacts, thread list). Cleared by ChatThread/ChatMessage write hooks,
// so socket-sent messages and read receipts invalidate it too.
const chatCache = createResponseCache({ ttlMs: 30 * 1000, maxEntries: 3000 });

// Holiday calendar reads. Cleared by Holiday model write hooks, so admin edits show at once.
const holidayCache = createResponseCache({ ttlMs: 5 * 60 * 1000 });

// Student dashboard reads (profile/stats, schedule, class teacher, exam results,
// analytics cards). Keyed per student; any write by that student clears their
// entries, and the TTL bounds staleness from writes by teachers/admins.
const studentDashboardCache = createResponseCache({ ttlMs: 60 * 1000, maxEntries: 20000 });

// Teacher achievement records list. Cleared by any write in achievementRoutes;
// TTL bounds staleness from student edits made elsewhere.
const teacherAchievementsCache = createResponseCache({ ttlMs: 60 * 1000, maxEntries: 2000 });

// Student Smart Learning map (subjects → chapters → topics, tryouts, materials,
// assignments). Keyed per student. Cleared by teacher/admin writes to lesson plans,
// teaching materials, assignments and practice papers; TTL bounds the rest.
const smartLearningMapCache = createResponseCache({ ttlMs: 60 * 1000, maxEntries: 20000 });

// Like invalidateOnWrite, but student writes (tryout submits, hinge/exit-quiz
// answers) don't clear everyone's map — they don't change its content.
const STUDENT_WRITE_PATH = /^\/student\/|\/(hinge-response|exit-quiz-result)$/;
const invalidateSmartLearningMapOnContentWrite = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (STUDENT_WRITE_PATH.test(req.path)) return next();
  res.on('finish', () => { if (res.statusCode < 400) smartLearningMapCache.clear(); });
  return next();
};

module.exports = { smartLearningMapCache, invalidateSmartLearningMapOnContentWrite, createResponseCache, teacherAchievementsCache, studentDashboardCache, parentAttendanceCache, userNotificationsCache, parentFeesCache, teacherAnalyticsCache, chatCache, holidayCache };
