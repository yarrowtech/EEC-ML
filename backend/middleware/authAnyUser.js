const jwt = require('jsonwebtoken');
const validateTokenTenant = require('./validateTokenTenant');

// Accepts any valid user token (student/teacher/parent). Sets req.user and req.userType.
module.exports = function (req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!validateTokenTenant(req, res, decoded)) return;
    if (!decoded.userType && decoded.type === 'principal') {
      decoded.userType = 'principal';
    }
    const normalizedType = String(decoded.userType || decoded.type || '').toLowerCase();
    req.user = decoded;
    req.userType = normalizedType === 'admin' ? 'Admin' : decoded.userType || 'unknown';
    req.schoolId = decoded.schoolId || null;
    req.campusId = decoded.campusId || null;
    // Admin tokens are school-level and may not carry campusId — allow them through.
    // For student/teacher/parent tokens, campusId is required.
    if (!req.campusId && normalizedType !== 'admin') {
      return res.status(400).json({ error: 'campusId is required' });
    }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
