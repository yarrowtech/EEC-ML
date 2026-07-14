const resolveLoginPlatformScope = (req) => {
  if (req.organizationId) return {};
  const allowDevelopmentTenantLogin = process.env.NODE_ENV !== 'production'
    && process.env.ALLOW_SHARED_DOMAIN_TENANT_LOGIN === 'true';
  return allowDevelopmentTenantLogin ? {} : { organizationId: null };
};

module.exports = { resolveLoginPlatformScope };
