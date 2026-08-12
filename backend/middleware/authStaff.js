const { createRoleAuth } = require('./authFactory');

module.exports = createRoleAuth({
  roleCheck: (d) => String(d.userType || d.type || '').toLowerCase() === 'staff',
  requireCampusId: false,
  forbiddenMessage: 'Forbidden - not a staff token',
});
