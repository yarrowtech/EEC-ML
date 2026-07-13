const jwt = require('jsonwebtoken');
const validateTokenTenant = require('./validateTokenTenant');

module.exports = function (req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!validateTokenTenant(req, res, decoded)) return;
    const tokenType = String(decoded.userType || decoded.type || '').toLowerCase();
    if (tokenType !== 'staff') {
      return res.status(403).json({ error: 'Forbidden - not a staff token' });
    }
    req.user = decoded;
    req.schoolId = decoded.schoolId || null;
    req.campusId = decoded.campusId || null;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
