const jwt = require('jsonwebtoken');
const validateTokenTenant = require('./validateTokenTenant');

// Like authStudent but does NOT reject tokens that lack campusId.
// Use for read-heavy student endpoints where campus scoping is not needed.
module.exports = function authStudentSoft(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!validateTokenTenant(req, res, decoded)) return;
    if (decoded.type !== 'admin' && decoded.userType !== 'student') {
      return res.status(403).json({ error: 'Forbidden - not a student' });
    }
    req.user = decoded;
    req.userId = decoded.id || null;
    req.userType = decoded.type === 'admin' ? 'Admin' : decoded.userType;
    req.schoolId = decoded.schoolId || null;
    req.campusId = decoded.campusId || null;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
