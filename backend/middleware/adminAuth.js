const jwt = require('jsonwebtoken');
const { logAuthEvent } = require('../utils/authEventLogger');
const { logSecurityEvent } = require('../utils/securityEventLogger');
const validateTokenTenant = require('./validateTokenTenant');

const extractSchoolId = (req) => {
  const headerId = req.headers['x-school-id'] || req.headers['x-schoolid'];
  const queryId = req.query?.schoolId;
  const bodyId = req.body?.schoolId;
  return headerId || queryId || bodyId || null;
};

const extractCampusId = (req) => {
  const headerId = req.headers['x-campus-id'] || req.headers['x-campusid'];
  const queryId = req.query?.campusId;
  const bodyId = req.body?.campusId;
  return headerId || queryId || bodyId || null;
};

const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logAuthEvent(req, {
      action: 'auth.middleware_validate',
      outcome: 'failure',
      userType: 'admin',
      reason: 'Missing or invalid authorization header',
      statusCode: 401,
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!validateTokenTenant(req, res, decoded)) return;
    if (decoded.type !== 'admin') {
      logAuthEvent(req, {
        action: 'auth.middleware_validate',
        outcome: 'failure',
        userType: decoded.type || 'unknown',
        identifier: decoded.username || decoded.id,
        reason: 'Token type mismatch',
        statusCode: 403,
      });
      logSecurityEvent(req, {
        action: 'security.rbac_violation',
        outcome: 'blocked',
        severity: 'high',
        attack_type: 'rbac_violation',
        riskScore: 80,
        reason: 'Non-admin token used on admin-protected route',
        statusCode: 403,
        tokenType: decoded.type,
      });
      return res.status(403).json({ error: 'Access denied' });
    }
    const role = String(decoded.role || '').toLowerCase();
    const hasRole = typeof decoded.role === 'string' && decoded.role.trim().length > 0;
    // Backward compatibility for older tokens that did not include `role`.
    const isSuperAdmin = role === 'super_admin' || (!hasRole && !decoded.schoolId);
    const tokenSchoolId = isSuperAdmin ? null : (decoded.schoolId || null);
    const tokenCampusId = isSuperAdmin ? null : (decoded.campusId || null);
    const effectiveSchoolId = tokenSchoolId || (isSuperAdmin ? extractSchoolId(req) : null);
    const effectiveCampusId = tokenCampusId || (isSuperAdmin ? extractCampusId(req) : null);
    // Backward compatibility: older admin records may not have campusId.
    // In that case, allow access without a campus filter.
    req.admin = decoded;
    req.userType = 'Admin';
    req.isSuperAdmin = isSuperAdmin;
    req.schoolId = effectiveSchoolId;
    req.campusId = effectiveCampusId;
    logAuthEvent(req, {
      action: 'auth.middleware_validate',
      outcome: 'success',
      userType: isSuperAdmin ? 'super_admin' : 'admin',
      identifier: decoded.username || decoded.id,
      userId: decoded.id,
      schoolId: effectiveSchoolId,
      campusId: effectiveCampusId,
      statusCode: 200,
    });
    next();
  } catch (err) {
    logAuthEvent(req, {
      action: 'auth.middleware_validate',
      outcome: 'failure',
      userType: 'admin',
      reason: err.message || 'Invalid token',
      statusCode: 401,
    });
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = adminAuth;
