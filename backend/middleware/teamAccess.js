const Admin = require('../models/Admin');
const AdminRole = require('../models/AdminRole');
const { checkAccess, normalizePermissions } = require('../config/adminPermissions');
const { logSecurityEvent } = require('../utils/securityEventLogger');

// Short cache so role edits apply within seconds without a DB hit per request.
const CACHE_TTL_MS = 20 * 1000;
const cache = new Map();

const clearTeamAccessCache = () => cache.clear();

// Returns { active, roleName, permissions } for a team member admin id.
const loadTeamAccess = async (adminId) => {
  const key = String(adminId);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const admin = await Admin.findById(adminId).select('status isTeamMember accessRoleId').lean();
  let value = { active: false, roleName: '', permissions: {} };
  if (admin && admin.status !== 'inactive') {
    const role = admin.accessRoleId ? await AdminRole.findById(admin.accessRoleId).lean() : null;
    value = {
      active: true,
      isTeamMember: Boolean(admin.isTeamMember),
      roleName: role?.name || '',
      permissions: role ? normalizePermissions(role.permissions) : {},
    };
  }
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
};

const enforceTeamAccess = async (req, res, next) => {
  try {
    const access = await loadTeamAccess(req.admin.id);
    if (!access.active) return res.status(401).json({ error: 'Account inactive' });
    const result = checkAccess(req.method, req.originalUrl, access.permissions);
    if (!result.allowed) {
      logSecurityEvent(req, {
        action: 'security.team_access_denied',
        outcome: 'blocked',
        severity: 'low',
        reason: result.reason,
        statusCode: 403,
      });
      return res.status(403).json({ error: result.reason, code: 'PERMISSION_DENIED' });
    }
    req.teamAccess = access;
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Unable to verify access' });
  }
};

module.exports = { enforceTeamAccess, loadTeamAccess, clearTeamAccessCache };
