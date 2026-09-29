const { createRoleAuth } = require('./authFactory');

module.exports = createRoleAuth({
  roleCheck: (d) => d.type === 'admin' || d.userType === 'teacher',
  requireCampusId: false,
  forbiddenMessage: 'Forbidden - not a teacher',
  setExtras: (req, decoded) => {
    req.teacher = decoded;
    req.campusName = decoded.campusName || null;
    req.campusType = decoded.campusType || null;
  },
});
