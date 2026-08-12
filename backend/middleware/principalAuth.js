const { createRoleAuth } = require('./authFactory');

module.exports = createRoleAuth({
  roleCheck: (d) => d.type === 'principal',
  requireValidSchoolId: true,
  forbiddenMessage: 'Access denied',
  setExtras: (req, decoded) => {
    req.principal = decoded;
    req.userType = 'Principal';
  },
});
