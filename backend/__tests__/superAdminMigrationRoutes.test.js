const express = require('express');
const request = require('supertest');

/* chainable query stub: supports .lean() and a bare await (see
   superAdminUsage.test.js for the same pattern) */
const query = (result) => {
  const p = {};
  p.select = () => p;
  p.lean = () => Promise.resolve(result);
  p.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return p;
};

const makeBatchDoc = (overrides = {}) => ({
  schoolId: 'school-1',
  campusId: null,
  entities: [],
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

let mockIsSuperAdmin = true;
jest.mock('../middleware/adminAuth', () => (req, _res, next) => {
  req.isSuperAdmin = mockIsSuperAdmin;
  req.admin = { id: 'super-1', role: 'super_admin' };
  req.userType = 'Admin';
  next();
});

jest.mock('../models/School', () => ({ findById: jest.fn() }));
jest.mock('../models/Admin', () => ({ findOne: jest.fn() }));
jest.mock('../models/MigrationBatch', () => ({ findOne: jest.fn(), create: jest.fn() }));

const mockTestImporterRun = jest.fn(() => ({ jobId: 'job-1', jobSystem: 'generic' }));
const mockDependentImporterRun = jest.fn(() => ({ jobId: 'job-2', jobSystem: 'generic' }));
jest.mock('../services/migration', () => ({
  ENTITY_IMPORTERS: {
    testEntity: { label: 'Test Entity', dependsOn: [], run: mockTestImporterRun },
    dependent: { label: 'Dependent', dependsOn: ['testEntity'], run: mockDependentImporterRun },
  },
  ENTITY_ORDER: ['testEntity', 'dependent'],
}));

const School = require('../models/School');
const Admin = require('../models/Admin');
const MigrationBatch = require('../models/MigrationBatch');
const backgroundJob = require('../utils/backgroundJob');

const VALID_SCHOOL_ID = '507f1f77bcf86cd799439011';

const app = express();
app.use(express.json());
app.use('/api/super-admin/migration', require('../routes/superAdminMigrationRoutes'));

beforeEach(() => {
  mockIsSuperAdmin = true;
  jest.clearAllMocks();
  School.findById.mockReturnValue(query({ _id: VALID_SCHOOL_ID, name: 'Test School' }));
  Admin.findOne.mockReturnValue(query(null));
  MigrationBatch.findOne.mockReturnValue(query(null));
  MigrationBatch.create.mockResolvedValue(makeBatchDoc());
  mockTestImporterRun.mockReturnValue({ jobId: 'job-1', jobSystem: 'generic' });
});

describe('super admin only', () => {
  test('rejects a non-super-admin token with 403', async () => {
    mockIsSuperAdmin = false;
    const res = await request(app).get(`/api/super-admin/migration/schools/${VALID_SCHOOL_ID}/status`);
    expect(res.status).toBe(403);
  });
});

describe('GET /schools/:schoolId/status', () => {
  test('400 on an invalid schoolId', async () => {
    const res = await request(app).get('/api/super-admin/migration/schools/not-an-id/status');
    expect(res.status).toBe(400);
  });

  test('404 when the school does not exist', async () => {
    School.findById.mockReturnValue(query(null));
    const res = await request(app).get(`/api/super-admin/migration/schools/${VALID_SCHOOL_ID}/status`);
    expect(res.status).toBe(404);
  });

  test('returns an empty entity list when no batch exists yet', async () => {
    const res = await request(app).get(`/api/super-admin/migration/schools/${VALID_SCHOOL_ID}/status`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ schoolId: VALID_SCHOOL_ID, schoolName: 'Test School', entities: [] });
    expect(res.body.entityOrder).toEqual(['testEntity', 'dependent']);
  });

  test('surfaces the persisted batch entities when one exists', async () => {
    MigrationBatch.findOne.mockReturnValue(query({
      campusId: 'campus-1',
      entities: [{ type: 'testEntity', status: 'completed', totalRows: 2, imported: 2, failed: 0 }],
    }));
    const res = await request(app).get(`/api/super-admin/migration/schools/${VALID_SCHOOL_ID}/status`);
    expect(res.status).toBe(200);
    expect(res.body.campusId).toBe('campus-1');
    expect(res.body.entities).toHaveLength(1);
    expect(res.body.entities[0]).toMatchObject({ type: 'testEntity', status: 'completed' });
  });
});

describe('POST /schools/:schoolId/entities/:type/import', () => {
  const post = (type, body) =>
    request(app).post(`/api/super-admin/migration/schools/${VALID_SCHOOL_ID}/entities/${type}/import`).send(body);

  test('400 on an invalid schoolId', async () => {
    const res = await request(app)
      .post('/api/super-admin/migration/schools/not-an-id/entities/testEntity/import')
      .send({ rows: [{ name: 'x' }] });
    expect(res.status).toBe(400);
  });

  test('400 on an unknown entity type', async () => {
    const res = await post('bogus', { rows: [{ name: 'x' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown entity type/);
  });

  test('404 when the school does not exist', async () => {
    School.findById.mockReturnValue(query(null));
    const res = await post('testEntity', { rows: [{ name: 'x' }] });
    expect(res.status).toBe(404);
  });

  test('400 when rows is missing or empty', async () => {
    const res = await post('testEntity', {});
    expect(res.status).toBe(400);
    const res2 = await post('testEntity', { rows: [] });
    expect(res2.status).toBe(400);
  });

  test('413 when there are too many rows', async () => {
    const rows = Array.from({ length: 5001 }, (_, i) => ({ name: `row-${i}` }));
    const res = await post('testEntity', { rows });
    expect(res.status).toBe(413);
  });

  test('409 when a dependency has not completed yet', async () => {
    MigrationBatch.findOne.mockReturnValue(query(makeBatchDoc())); // no entities at all
    const res = await post('dependent', { rows: [{ name: 'x' }] });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Import "Test Entity" before "Dependent"');
    expect(mockDependentImporterRun).not.toHaveBeenCalled();
  });

  test('allows the dependent entity once its dependency is completed', async () => {
    const batch = makeBatchDoc({ entities: [{ type: 'testEntity', status: 'completed' }] });
    MigrationBatch.findOne.mockReturnValue(query(batch));
    const res = await post('dependent', { rows: [{ name: 'x' }] });
    expect(res.status).toBe(202);
    expect(mockDependentImporterRun).toHaveBeenCalledTimes(1);
  });

  test('kicks off the import, records the job on the batch, and returns 202', async () => {
    const batch = makeBatchDoc();
    MigrationBatch.findOne.mockReturnValue(query(batch));
    Admin.findOne.mockReturnValue(query({ username: 'school-admin', campusName: 'Main', campusType: 'Main' }));

    const rows = [{ name: 'Row One' }];
    const res = await post('testEntity', { rows, campusId: 'campus-9' });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ jobId: 'job-1', jobSystem: 'generic', total: 1 });

    expect(mockTestImporterRun).toHaveBeenCalledTimes(1);
    const [calledRows, ctx] = mockTestImporterRun.mock.calls[0];
    expect(calledRows).toEqual(rows);
    expect(ctx).toMatchObject({
      schoolId: VALID_SCHOOL_ID,
      campusId: 'campus-9',
      admin: { username: 'school-admin' },
      isSuperAdmin: false,
      campusName: 'Main',
      campusType: 'Main',
    });

    expect(batch.save).toHaveBeenCalledTimes(1);
    expect(batch.entities).toHaveLength(1);
    expect(batch.entities[0]).toMatchObject({
      type: 'testEntity',
      status: 'importing',
      totalRows: 1,
      lastJobId: 'job-1',
    });
    expect(batch.campusId).toBe('campus-9');
  });

  test('creates a MigrationBatch when this school has none yet', async () => {
    MigrationBatch.findOne.mockReturnValue(query(null));
    const created = makeBatchDoc();
    MigrationBatch.create.mockResolvedValue(created);

    const res = await post('testEntity', { rows: [{ name: 'x' }] });

    expect(res.status).toBe(202);
    expect(MigrationBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: VALID_SCHOOL_ID, createdBy: 'super-1' })
    );
    expect(created.save).toHaveBeenCalledTimes(1);
  });

  test('resets counters on the entity record when the same entity is re-imported', async () => {
    const batch = makeBatchDoc({
      entities: [{ type: 'testEntity', status: 'failed', totalRows: 3, imported: 1, failed: 2, errorSample: [{ index: 0, message: 'boom' }] }],
    });
    MigrationBatch.findOne.mockReturnValue(query(batch));

    const res = await post('testEntity', { rows: [{ name: 'x' }] });

    expect(res.status).toBe(202);
    expect(batch.entities).toHaveLength(1);
    expect(batch.entities[0]).toMatchObject({ status: 'importing', totalRows: 1, imported: 0, failed: 0, errorSample: [] });
  });
});

describe('GET /jobs/:jobId/status', () => {
  test('404 for an unknown job', async () => {
    const res = await request(app).get('/api/super-admin/migration/jobs/does-not-exist/status?system=generic');
    expect(res.status).toBe(404);
  });

  test('returns the normalized shape for a real backgroundJob-tracked job', async () => {
    const jobId = backgroundJob.createJob(2);
    backgroundJob.recordSuccess(jobId);
    backgroundJob.recordFailure(jobId, { index: 1, message: 'bad row' });

    const res = await request(app).get(`/api/super-admin/migration/jobs/${jobId}/status?system=generic`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'processing',
      total: 2,
      processed: 2,
      succeeded: 1,
      failed: 1,
      errors: [{ index: 1, message: 'bad row' }],
    });
  });
});
