const AcademicYear = require('../models/AcademicYear');

// Students belong to an academic session via StudentUser.academicYear (the year's
// name, e.g. "2026-27"). Analytics should only count the current (active)
// session — students already set up for the next session must not appear in this
// year's class. Students with no session recorded (older data) are kept.

const CACHE_MS = 60 * 1000;
const cache = new Map(); // schoolId -> { name, expires }

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Name of the school's active academic year, or null (cached for a minute). */
const getCurrentSessionName = async (schoolId) => {
  if (!schoolId) return null;
  const key = String(schoolId);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.name;
  const year = await AcademicYear.findOne({ schoolId, isActive: true }).select('name').lean();
  const name = year?.name ? String(year.name).trim() : null;
  cache.set(key, { name, expires: Date.now() + CACHE_MS });
  return name;
};

/** Mongo clause limiting StudentUser to a session (plus students with no session set). */
const sessionStudentClause = (sessionName) => (sessionName
  ? {
    $or: [
      { academicYear: new RegExp(`^${escapeRegex(sessionName)}$`, 'i') },
      { academicYear: { $in: [null, ''] } },
      { academicYear: { $exists: false } },
    ],
  }
  : null);

/** Adds the session clause to an existing StudentUser filter without touching its own $or. */
const withSession = (filter, clause) => (clause ? { ...filter, $and: [...(filter.$and || []), clause] } : filter);

/** Express middleware: req.sessionClause = current-session clause for the request's school. */
const attachCurrentSession = async (req, res, next) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId;
    req.sessionClause = sessionStudentClause(await getCurrentSessionName(schoolId));
  } catch {
    req.sessionClause = null; // never block analytics on this
  }
  next();
};

/** Clears the cache (e.g. after an admin switches the active year). */
const clearCurrentSessionCache = () => cache.clear();

module.exports = { getCurrentSessionName, sessionStudentClause, withSession, attachCurrentSession, clearCurrentSessionCache };
