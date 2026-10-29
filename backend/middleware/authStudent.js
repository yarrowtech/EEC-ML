const { createRoleAuth } = require('./authFactory');
const StudentUser = require('../models/StudentUser');
const { isLoginBlockedStudentStatus, STUDENT_BLOCKED_MESSAGE } = require('../utils/studentStatus');

const baseAuth = createRoleAuth({
  roleCheck: (d) => d.type === 'admin' || d.userType === 'student',
  requireCampusId: true,
  forbiddenMessage: 'Forbidden - not a student',
  setExtras: (req, decoded) => { req.userId = decoded.id || null; },
});

// A student marked Left/Expelled (or archived) while signed in must lose access
// immediately, not when their JWT expires. Status is cached briefly so this
// adds at most one small lookup per student per 30s.
const STATUS_TTL_MS = 30 * 1000;
const statusCache = new Map(); // studentId -> { blocked, expires }

const isStudentBlocked = async (studentId) => {
  const hit = statusCache.get(studentId);
  if (hit && hit.expires > Date.now()) return hit.blocked;
  const doc = await StudentUser.findById(studentId).select('status isArchived').lean();
  const blocked = Boolean(doc && (doc.isArchived || isLoginBlockedStudentStatus(doc.status)));
  statusCache.set(studentId, { blocked, expires: Date.now() + STATUS_TTL_MS });
  return blocked;
};

module.exports = (req, res, next) => {
  baseAuth(req, res, async () => {
    // Admins using student routes are not subject to the student block.
    if (req.user?.userType !== 'student' || !req.userId) return next();
    try {
      if (await isStudentBlocked(String(req.userId))) {
        return res.status(403).json({ error: STUDENT_BLOCKED_MESSAGE, code: 'ACCOUNT_BLOCKED' });
      }
    } catch {
      // A lookup failure shouldn't lock out every student — fall through.
    }
    return next();
  });
};
