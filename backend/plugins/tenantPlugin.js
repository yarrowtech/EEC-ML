const mongoose = require('mongoose');
const { getTenantContext } = require('../utils/tenantContext');

const QUERY_OPERATIONS = [
  'count',
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'updateMany',
  'updateOne',
];

const tenantError = () => {
  const error = new Error('organizationId cannot be changed or overridden');
  error.statusCode = 403;
  error.code = 'TENANT_SCOPE_VIOLATION';
  return error;
};

const idsMatch = (left, right) => String(left) === String(right);

const assertMatchingTenant = (value, organizationId) => {
  if (value !== undefined && value !== null && !idsMatch(value, organizationId)) {
    throw tenantError();
  }
};

const enforceUpdateTenant = (update, organizationId, replacement = false) => {
  if (!update || Array.isArray(update)) return;

  assertMatchingTenant(update.organizationId, organizationId);
  assertMatchingTenant(update.$set?.organizationId, organizationId);
  assertMatchingTenant(update.$setOnInsert?.organizationId, organizationId);

  if (replacement) {
    update.organizationId = organizationId;
    return;
  }

  delete update.organizationId;
  if (update.$set) delete update.$set.organizationId;
  update.$setOnInsert = {
    ...(update.$setOnInsert || {}),
    organizationId,
  };
};

module.exports = function tenantPlugin(schema) {
  if (schema.options.skipTenantScope) return;

  schema.add({
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
  });

  schema.pre(QUERY_OPERATIONS, function tenantQueryScope() {
    const context = getTenantContext();
    if (!context?.organizationId) return;

    const filter = this.getFilter() || {};
    assertMatchingTenant(filter.organizationId, context.organizationId);
    this.where({ organizationId: context.organizationId });

    if (this.op.includes('Update') || this.op.startsWith('update') || this.op === 'replaceOne') {
      const update = this.getUpdate();
      enforceUpdateTenant(update, context.organizationId, this.op.includes('Replace') || this.op === 'replaceOne');
      this.setUpdate(update);
    }
  });

  schema.pre('aggregate', function tenantAggregateScope() {
    const context = getTenantContext();
    if (!context?.organizationId) return;

    const match = { $match: { organizationId: new mongoose.Types.ObjectId(context.organizationId) } };
    const pipeline = this.pipeline();
    const firstStageMustRemainFirst = pipeline[0]?.$geoNear || pipeline[0]?.$search;
    pipeline.splice(firstStageMustRemainFirst ? 1 : 0, 0, match);
  });

  schema.pre('validate', function tenantDocumentScope() {
    const context = getTenantContext();
    if (!context?.organizationId) return;
    assertMatchingTenant(this.organizationId, context.organizationId);
    this.organizationId = context.organizationId;
  });

  schema.pre('insertMany', function tenantInsertManyScope(_next, documents) {
    const context = getTenantContext();
    if (!context?.organizationId || !Array.isArray(documents)) return;
    documents.forEach((document) => {
      assertMatchingTenant(document.organizationId, context.organizationId);
      document.organizationId = context.organizationId;
    });
  });
};

module.exports.tenantError = tenantError;
