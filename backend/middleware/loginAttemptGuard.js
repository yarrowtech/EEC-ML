const { getClientIp } = require('../utils/request');
const { logSecurityEvent } = require('../utils/securityEventLogger');

// Failed-login lockout: after MAX wrong username/password attempts for the same
// username from the same IP, further logins are refused until the lock expires.
// Keyed on IP + username so one person can't lock someone else out remotely.
// Uses Redis when connected (shared across instances), else an in-memory Map.
let redisClient = null;
try {
  ({ client: redisClient } = require('../utils/redisClient'));
} catch (_) { /* Redis not configured */ }

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const memory = new Map(); // key -> { count, lockedUntil, expires }

const redisReady = () => Boolean(redisClient && redisClient.isOpen);

const readState = async (key) => {
  if (redisReady()) {
    try {
      const raw = await redisClient.get(key);
      return raw ? JSON.parse(raw) : { count: 0, lockedUntil: 0 };
    } catch (_) { /* fall back */ }
  }
  const s = memory.get(key);
  if (!s || s.expires < Date.now()) { memory.delete(key); return { count: 0, lockedUntil: 0 }; }
  return s;
};

const writeState = async (key, state) => {
  if (redisReady()) {
    try {
      await redisClient.set(key, JSON.stringify(state), { PX: LOCK_MS });
      return;
    } catch (_) { /* fall back */ }
  }
  memory.set(key, { ...state, expires: Date.now() + LOCK_MS });
};

const clearState = async (key) => {
  memory.delete(key);
  if (redisReady()) { try { await redisClient.del(key); } catch (_) { /* ignore */ } }
};

const minutesLeft = (until) => Math.max(1, Math.ceil((until - Date.now()) / 60000));
const lockedBody = (until) => ({
  error: `Maximum login attempts reached. Please try again after ${minutesLeft(until)} minute${minutesLeft(until) === 1 ? '' : 's'}.`,
  code: 'LOGIN_LOCKED',
  attemptsLeft: 0,
  retryAfterSeconds: Math.ceil((until - Date.now()) / 1000),
});

const loginAttemptGuard = (req, res, next) => {
  const username = String(req.body?.username || req.body?.email || '').trim().toLowerCase();
  if (!username) return next();
  const key = `login-fail:${getClientIp(req) || 'unknown'}:${username}`;

  (async () => {
    const state = await readState(key);
    if (state.lockedUntil && state.lockedUntil > Date.now()) {
      res.setHeader('Retry-After', Math.ceil((state.lockedUntil - Date.now()) / 1000));
      return res.status(429).json(lockedBody(state.lockedUntil));
    }

    // Intercept the handler's response to count failures / reset on success.
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const status = res.statusCode;
      if (status >= 200 && status < 300) {
        clearState(key);
        return originalJson(body);
      }
      if (status !== 401) return originalJson(body); // only wrong credentials count

      const count = (state.lockedUntil ? 0 : Number(state.count || 0)) + 1;
      if (count >= MAX_ATTEMPTS) {
        const lockedUntil = Date.now() + LOCK_MS;
        writeState(key, { count, lockedUntil });
        logSecurityEvent(req, {
          action: 'security.login_lockout',
          outcome: 'blocked',
          severity: 'medium',
          statusCode: 429,
          identifier: username,
          attempts: count,
        });
        res.status(429);
        res.setHeader('Retry-After', Math.ceil(LOCK_MS / 1000));
        return originalJson(lockedBody(lockedUntil));
      }
      writeState(key, { count, lockedUntil: 0 });
      const attemptsLeft = MAX_ATTEMPTS - count;
      return originalJson({
        ...(body && typeof body === 'object' ? body : { error: String(body || 'Invalid credentials') }),
        attemptsLeft,
        maxAttempts: MAX_ATTEMPTS,
      });
    };
    return next();
  })().catch(() => next()); // never block logins because the guard failed
};

loginAttemptGuard.MAX_ATTEMPTS = MAX_ATTEMPTS;
loginAttemptGuard.LOCK_MS = LOCK_MS;
module.exports = loginAttemptGuard;
