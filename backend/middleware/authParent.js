const { createRoleAuth } = require('./authFactory');
const ParentUser = require('../models/ParentUser');
const { isParentLoginBlocked, PARENT_BLOCKED_MESSAGE } = require('../utils/parentArchiveSync');

const baseAuth = createRoleAuth({
  roleCheck: (d) => d.type === 'admin' || d.userType === 'parent',
  requireCampusId: true,
  forbiddenMessage: 'Forbidden - not a parent',
});

// Once every linked child has left the school, a signed-in parent loses access
// immediately (not when the JWT expires). Cached briefly per parent so it adds
// at most a couple of small lookups every 30s.
const STATUS_TTL_MS = 30 * 1000;
const blockedCache = new Map(); // parentId -> { blocked, expires }

const isParentBlocked = async (parentId) => {
  const hit = blockedCache.get(parentId);
  if (hit && hit.expires > Date.now()) return hit.blocked;
  const parent = await ParentUser.findById(parentId).select('childrenIds').lean();
  const blocked = parent ? await isParentLoginBlocked(parent.childrenIds) : false;
  blockedCache.set(parentId, { blocked, expires: Date.now() + STATUS_TTL_MS });
  return blocked;
};

module.exports = (req, res, next) => {
  baseAuth(req, res, async () => {
    // Admins using parent routes are not subject to the parent block.
    const parentId = req.user?.userType === 'parent' ? (req.user.id || req.user._id) : null;
    if (!parentId) return next();
    try {
      if (await isParentBlocked(String(parentId))) {
        return res.status(403).json({ error: PARENT_BLOCKED_MESSAGE, code: 'ACCOUNT_BLOCKED' });
      }
    } catch {
      // A lookup failure shouldn't lock every parent out — fall through.
    }
    return next();
  });
};
