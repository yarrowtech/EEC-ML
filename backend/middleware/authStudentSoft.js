const { createRoleAuth } = require('./authFactory');

// Like authStudent but does NOT reject tokens that lack campusId.
// Use for read-heavy student endpoints where campus scoping is not needed.
module.exports = createRoleAuth({
  roleCheck: (d) => d.type === 'admin' || d.userType === 'student',
  requireCampusId: false,
  forbiddenMessage: 'Forbidden - not a student',
  setExtras: (req, decoded) => { req.userId = decoded.id || null; },
});
