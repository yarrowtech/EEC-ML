module.exports = function validateTokenTenant(req, res, decoded) {
  if (!req.organizationId) {
    if (decoded?.organizationId) {
      res.status(403).json({ error: 'Organization accounts must use their organization domain' });
      return false;
    }
    return true;
  }

  const tokenOrganizationId = decoded?.organizationId;
  if (!tokenOrganizationId || String(tokenOrganizationId) !== String(req.organizationId)) {
    res.status(403).json({ error: 'This account does not belong to this organization' });
    return false;
  }
  return true;
};
