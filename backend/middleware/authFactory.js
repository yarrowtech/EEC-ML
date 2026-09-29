const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const validateTokenTenant = require('./validateTokenTenant');

const extractBearerToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
};

/**
 * Factory that builds an Express auth middleware.
 *
 * @param {object} opts
 * @param {(decoded: object) => boolean} opts.roleCheck  - Return true if token role is allowed
 * @param {boolean}  [opts.requireCampusId=false]        - Reject if campusId missing from token
 * @param {boolean}  [opts.requireValidSchoolId=false]   - Reject if schoolId missing or invalid ObjectId
 * @param {string}   [opts.forbiddenMessage='Forbidden'] - 403 error text on role mismatch
 * @param {(req, decoded) => void} [opts.setExtras]      - Additional req properties for this role
 */
const createRoleAuth = ({
  roleCheck,
  requireCampusId = false,
  requireValidSchoolId = false,
  forbiddenMessage = 'Forbidden',
  setExtras = null,
}) => (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!validateTokenTenant(req, res, decoded)) return;

    if (!roleCheck(decoded)) {
      return res.status(403).json({ error: forbiddenMessage });
    }

    req.user = decoded;
    req.userType = decoded.type === 'admin' ? 'Admin' : (decoded.userType || decoded.type || 'unknown');
    req.schoolId = decoded.schoolId || null;
    req.campusId = decoded.campusId || null;

    if (requireValidSchoolId && (!req.schoolId || !mongoose.isValidObjectId(req.schoolId))) {
      return res.status(403).json({ error: 'School not assigned' });
    }

    if (requireCampusId && !req.campusId) {
      return res.status(400).json({ error: 'campusId is required' });
    }

    if (setExtras) setExtras(req, decoded);

    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { createRoleAuth, extractBearerToken };
