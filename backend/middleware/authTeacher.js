const { createRoleAuth } = require('./authFactory');
const { getSchoolFence } = require('../utils/schoolGeofence');

// Sessions issued before the school turned the geofence on (or without a
// location check) are refused, so the teacher must sign in again from inside
// the school — an old token can't bypass the location rule.
const requireGeofencedSession = async (req, res, decoded) => {
  if (decoded.type === 'admin' || decoded.userType !== 'teacher') return true;
  const fence = await getSchoolFence(decoded.schoolId);
  if (!fence || decoded.geoVerified) return true;
  res.status(401).json({
    error: 'Your school now requires teachers to sign in from inside the school premises. Please sign in again.',
    code: 'LOCATION_REVERIFY',
  });
  return false;
};

module.exports = createRoleAuth({
  roleCheck: (d) => d.type === 'admin' || d.userType === 'teacher',
  requireCampusId: false,
  forbiddenMessage: 'Forbidden - not a teacher',
  setExtras: (req, decoded) => {
    req.teacher = decoded;
    req.campusName = decoded.campusName || null;
    req.campusType = decoded.campusType || null;
  },
  afterAuth: requireGeofencedSession,
});
