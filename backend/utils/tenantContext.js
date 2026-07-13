const { AsyncLocalStorage } = require('async_hooks');

const tenantStorage = new AsyncLocalStorage();

const runWithTenant = (organization, callback) => tenantStorage.run(
  organization
    ? {
        organization,
        organizationId: String(organization._id),
      }
    : null,
  callback
);

const getTenantContext = () => tenantStorage.getStore() || null;

module.exports = {
  getTenantContext,
  runWithTenant,
};
