module.exports = function validateTokenTenant(req, res, decoded) {
  if (!req.organizationId) {
    if (decoded?.organizationId) {
      res.status(403).json({ error: 'Organization accounts must use their organization domain' });
      return false;
    }
    return true;
  }

  const tokenOrganizationId = decoded?.organizationId;
  const organizationMatches = tokenOrganizationId
    && String(tokenOrganizationId) === String(req.organizationId);
  const schoolMatches = decoded?.schoolId
    && req.organization?.schoolId
    && String(decoded.schoolId) === String(req.organization.schoolId);
  if (!organizationMatches && !schoolMatches) {
    res.status(403).json({ error: 'This account does not belong to this organization' });
    return false;
  }
  return true;
};
