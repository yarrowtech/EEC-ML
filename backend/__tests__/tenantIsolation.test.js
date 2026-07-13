const mongoose = require('../utils/registerTenantPlugin');
const { runWithTenant } = require('../utils/tenantContext');
const validateTokenTenant = require('../middleware/validateTokenTenant');
const { createSlug, RESERVED_SLUGS } = require('../routes/organizationRoutes');

const runPreHook = (schema, operation, context, args = []) => new Promise((resolve, reject) => {
  schema.s.hooks.execPre(operation, context, args, (error) => (error ? reject(error) : resolve()));
});

describe('tenant isolation', () => {
  const tenantA = new mongoose.Types.ObjectId();
  const tenantB = new mongoose.Types.ObjectId();
  const schema = new mongoose.Schema({ name: String });
  const Model = mongoose.models.TenantIsolationFixture
    || mongoose.model('TenantIsolationFixture', schema);

  test.each([
    ['find', () => Model.find({ name: 'A' })],
    ['findOneAndUpdate', () => Model.findOneAndUpdate({ name: 'A' }, { $set: { name: 'B' } })],
    ['findOneAndDelete', () => Model.findOneAndDelete({ name: 'A' })],
  ])('%s is scoped to the active organization', async (operation, createQuery) => {
    await runWithTenant({ _id: tenantA }, async () => {
      const query = createQuery();
      await runPreHook(Model.schema, operation, query);
      expect(String(query.getFilter().organizationId)).toBe(String(tenantA));
    });
  });

  test('create assigns organizationId and rejects tampering', async () => {
    await runWithTenant({ _id: tenantA }, async () => {
      const valid = new Model({ name: 'A' });
      await valid.validate();
      expect(String(valid.organizationId)).toBe(String(tenantA));

      const tampered = new Model({ name: 'B', organizationId: tenantB });
      await expect(tampered.validate()).rejects.toMatchObject({
        code: 'TENANT_SCOPE_VIOLATION',
      });
    });
  });

  test('update rejects a client-supplied organizationId', async () => {
    await runWithTenant({ _id: tenantA }, async () => {
      const query = Model.findOneAndUpdate({ name: 'A' }, { $set: { organizationId: tenantB } });
      await expect(runPreHook(Model.schema, 'findOneAndUpdate', query)).rejects.toMatchObject({
        code: 'TENANT_SCOPE_VIOLATION',
      });
    });
  });

  test('bulk writes scope filters and inserted documents', async () => {
    await runWithTenant({ _id: tenantA }, async () => {
      const operations = [
        { updateOne: { filter: { name: 'A' }, update: { $set: { name: 'B' } } } },
        { insertOne: { document: { name: 'C' } } },
      ];
      await runPreHook(Model.schema, 'bulkWrite', Model, [operations]);
      expect(String(operations[0].updateOne.filter.organizationId)).toBe(String(tenantA));
      expect(String(operations[1].insertOne.document.organizationId)).toBe(String(tenantA));
    });
  });

  test('a tenant token cannot be used on another tenant hostname', () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const response = { status, json };

    expect(validateTokenTenant({ organizationId: tenantA }, response, { organizationId: tenantB })).toBe(false);
    expect(status).toHaveBeenCalledWith(403);
  });

  test('an organization token cannot be replayed on the main domain', () => {
    const status = jest.fn().mockReturnThis();
    const response = { status, json: jest.fn() };
    expect(validateTokenTenant({}, response, { organizationId: tenantA })).toBe(false);
    expect(status).toHaveBeenCalledWith(403);
  });

  test('organization slugs are normalized and reserved names are blocked', () => {
    expect(createSlug("St. Xavier's School")).toBe('xaviers');
    expect(RESERVED_SLUGS.has(createSlug('Admin'))).toBe(true);
  });
});
