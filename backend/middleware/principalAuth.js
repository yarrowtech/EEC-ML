const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const validateTokenTenant = require('./validateTokenTenant');

const principalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!validateTokenTenant(req, res, decoded)) return;
    if (decoded.type !== 'principal') {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!decoded.schoolId || !mongoose.isValidObjectId(decoded.schoolId)) {
      return res.status(403).json({ error: 'School not assigned' });
    }
    req.principal = decoded;
    req.userType = 'Principal';
    req.schoolId = decoded.schoolId;
    req.campusId = decoded.campusId || null;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = principalAuth;
