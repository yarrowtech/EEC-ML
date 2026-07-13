const jwt = require('jsonwebtoken');
const validateTokenTenant = require('./validateTokenTenant');

module.exports = function (req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!validateTokenTenant(req, res, decoded)) return;
    if (decoded.type !== 'admin' && decoded.userType !== 'parent') {
      return res.status(403).json({ error: 'Forbidden - not a parent' });
    }
    req.user = decoded;
    req.userType = decoded.type === 'admin' ? 'Admin' : decoded.userType;
    req.schoolId = decoded.schoolId || null;
    req.campusId = decoded.campusId || null;
    if (!req.campusId) {
      return res.status(400).json({ error: 'campusId is required' });
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
