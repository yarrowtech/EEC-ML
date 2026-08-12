const { createRoleAuth } = require('./authFactory');

module.exports = createRoleAuth({
  roleCheck: (d) => d.type === 'admin' || d.userType === 'parent',
  requireCampusId: true,
  forbiddenMessage: 'Forbidden - not a parent',
});
