const { createRoleAuth } = require('./authFactory');

module.exports = createRoleAuth({
  roleCheck: (d) => d.type === 'admin' || d.userType === 'student',
  requireCampusId: true,
  forbiddenMessage: 'Forbidden - not a student',
  setExtras: (req, decoded) => { req.userId = decoded.id || null; },
});
