const jwt = require('jsonwebtoken');

const readAuthenticatedTenantScope = (req) => {
  const authorization = (typeof req.get === 'function' ? req.get('authorization') : null)
    || req.headers?.authorization
    || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || !process.env.JWT_SECRET) return null;

  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET);
    if (!payload?.organizationId && !payload?.schoolId) return null;
    return {
      organizationId: payload.organizationId || null,
      schoolId: payload.schoolId || null,
    };
  } catch {
    return null;
  }
};

module.exports = { readAuthenticatedTenantScope };
