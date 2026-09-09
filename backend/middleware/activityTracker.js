const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

const StudentUser = require('../models/StudentUser');
const TeacherUser = require('../models/TeacherUser');
const ParentUser = require('../models/ParentUser');
const StaffUser = require('../models/StaffUser');
const Admin = require('../models/Admin');
const Principal = require('../models/Principal');

/**
 * Records "this account did something meaningful just now" as `lastActiveAt`
 * on the user document. Used by the Super Admin usage dashboard to tell which
 * schools / roles / individual users are actually using the platform.
 *
 * Runs on `res 'finish'` (after the response is sent) so it never adds latency,
 * and is throttled per-user via an in-memory map — at most one DB write per
 * user per FLUSH window, regardless of how many requests they make. The write
 * is a `{ _id }` filtered `$set`, so it is safe to run without tenant context
 * (the tenant plugin no-ops when there is no AsyncLocalStorage tenant).
 */

const FLUSH_MS = Number(process.env.USER_ACTIVITY_FLUSH_MS || 10 * 60 * 1000);
const MAX_TRACKED = Number(process.env.USER_ACTIVITY_MAX_TRACKED || 20000);

// userId -> epoch ms of the last lastActiveAt write we issued for them
const lastFlushed = new Map();

const MODEL_BY_ROLE = {
  student: StudentUser,
  teacher: TeacherUser,
  parent: ParentUser,
  staff: StaffUser,
  admin: Admin,
  principal: Principal,
};

const decodeJwtPayload = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? payload : null;
  } catch (_err) {
    return null;
  }
};

const roleFromPayload = (payload) => {
  const raw = String(payload.userType || payload.type || '').toLowerCase();
  if (raw === 'superadmin' || raw === 'super_admin') return 'admin';
  return MODEL_BY_ROLE[raw] ? raw : null;
};

const trimIfNeeded = () => {
  if (lastFlushed.size <= MAX_TRACKED) return;
  // Drop the oldest ~10% of entries.
  const entries = [...lastFlushed.entries()].sort((a, b) => a[1] - b[1]);
  const dropCount = Math.max(1, Math.ceil(entries.length * 0.1));
  for (let i = 0; i < dropCount; i += 1) lastFlushed.delete(entries[i][0]);
};

const activityTracker = (req, res, next) => {
  const authHeader = req?.headers?.authorization;
  if (!authHeader || !String(authHeader).startsWith('Bearer ')) return next();

  const token = String(authHeader).slice(7).trim();
  if (!token) return next();

  res.on('finish', () => {
    try {
      // Only count requests that actually did something for an authenticated user.
      if (res.statusCode >= 400) return;

      const path = String(req.originalUrl || req.url || '');
      if (!path.startsWith('/api/')) return;
      if (path.includes('/auth/') || path.endsWith('/auth')) return;

      // Only trust requests that a role-auth middleware actually authenticated,
      // so a forged (unverified) token on a public 2xx endpoint can't write.
      const authed =
        req.userId || req.user || req.admin || req.teacher || req.principal || req.parent;
      if (!authed) return;

      const payload = decodeJwtPayload(token);
      if (!payload) return;

      const userId = String(payload.id || payload.sub || payload._id || '');
      if (!mongoose.isValidObjectId(userId)) return;

      const role = roleFromPayload(payload);
      if (!role) return;

      const now = Date.now();
      const previous = lastFlushed.get(userId) || 0;
      if (now - previous < FLUSH_MS) return;

      lastFlushed.set(userId, now);
      trimIfNeeded();

      MODEL_BY_ROLE[role]
        .updateOne({ _id: userId }, { $set: { lastActiveAt: new Date(now) } })
        .catch((err) => {
          // Best-effort telemetry; roll the throttle back so we retry next request.
          lastFlushed.delete(userId);
          logger.debug({ err: err?.message, role }, 'activityTracker: lastActiveAt write failed');
        });
    } catch (err) {
      logger.debug({ err: err?.message }, 'activityTracker: finish handler failed');
    }
  });

  return next();
};

// Exposed for tests.
activityTracker._reset = () => lastFlushed.clear();
activityTracker._FLUSH_MS = FLUSH_MS;

module.exports = activityTracker;
