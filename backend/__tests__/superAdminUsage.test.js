const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

/* chainable query stub: supports .sort().limit().lean() and a bare .lean() */
const query = (result) => {
  const p = {};
  p.sort = () => p;
  p.limit = () => p;
  p.select = () => p;
  p.lean = () => Promise.resolve(result);
  p.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return p;
};

const usageModel = () => ({
  aggregate: jest.fn().mockResolvedValue([]),
  find: jest.fn(() => query([])),
  findById: jest.fn(() => query(null)),
  countDocuments: jest.fn().mockResolvedValue(0),
  exists: jest.fn().mockResolvedValue(null),
});

jest.mock('../models/StudentUser', () => usageModel());
jest.mock('../models/TeacherUser', () => usageModel());
jest.mock('../models/ParentUser', () => usageModel());
jest.mock('../models/StaffUser', () => usageModel());
jest.mock('../models/Principal', () => usageModel());
jest.mock('../models/Admin', () => usageModel());
jest.mock('../models/School', () => usageModel());

jest.mock('../middleware/adminAuth', () => (req, _res, next) => {
  req.isSuperAdmin = true;
  req.admin = { id: 'super-1', role: 'super_admin' };
  req.userType = 'Admin';
  next();
});

const StudentUser = require('../models/StudentUser');
const TeacherUser = require('../models/TeacherUser');
const ParentUser = require('../models/ParentUser');
const StaffUser = require('../models/StaffUser');
const Principal = require('../models/Principal');
const Admin = require('../models/Admin');
const School = require('../models/School');

const ALL_MODELS = [StudentUser, TeacherUser, ParentUser, StaffUser, Principal, Admin, School];

const app = express();
app.use(express.json());
app.use('/api/super-admin', require('../routes/superAdminRoutes'));

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks wipes call history but keeps implementations, so a
  // mockResolvedValue set in one test would bleed into the next — reset them.
  ALL_MODELS.forEach((M) => {
    M.aggregate.mockResolvedValue([]);
    M.find.mockReturnValue(query([]));
    M.findById.mockReturnValue(query(null));
    M.countDocuments.mockResolvedValue(0);
    M.exists.mockResolvedValue(null);
  });
});

describe('GET /api/super-admin/usage/overview', () => {
  test('returns platform totals and a per-role split', async () => {
    StudentUser.aggregate.mockResolvedValue([
      { total: 100, active24h: 10, active7d: 30, active30d: 60, everActive: 80 },
    ]);
    TeacherUser.aggregate.mockResolvedValue([
      { total: 20, active24h: 4, active7d: 12, active30d: 18, everActive: 19 },
    ]);

    const res = await request(app).get('/api/super-admin/usage/overview');

    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({
      users: 120,
      active24h: 14,
      active7d: 42,
      active30d: 78,
      dormant: 21, // (80 + 19) everActive - 78 active30d
      neverActive: 21, // 120 users - 99 everActive
    });
    const student = res.body.byRole.find((r) => r.role === 'student');
    expect(student).toEqual({ role: 'student', total: 100, active7d: 30, active30d: 60 });
    expect(res.body.byRole).toHaveLength(6);
  });
});

describe('GET /api/super-admin/usage/schools', () => {
  test('rolls activity up per school and derives a health status', async () => {
    const activeId = new mongoose.Types.ObjectId();
    const dormantId = new mongoose.Types.ObjectId();
    const neverId = new mongoose.Types.ObjectId();

    StudentUser.aggregate.mockResolvedValue([
      { _id: activeId, total: 50, active24h: 5, active7d: 20, active30d: 35, everActive: 40, lastActivityAt: new Date() },
      {
        _id: dormantId,
        total: 30,
        active24h: 0,
        active7d: 0,
        active30d: 0,
        everActive: 12,
        lastActivityAt: new Date(Date.now() - 90 * 24 * 3600 * 1000),
      },
    ]);
    School.find.mockReturnValue(
      query([
        { _id: activeId, name: 'Active School', status: 'active' },
        { _id: dormantId, name: 'Dormant School', status: 'active' },
        { _id: neverId, name: 'Empty School', status: 'active' },
      ]),
    );

    const res = await request(app).get('/api/super-admin/usage/schools');

    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.schools.map((s) => [s.name, s]));
    expect(byName['Active School']).toMatchObject({ totalUsers: 50, active7d: 20, health: 'active' });
    expect(byName['Dormant School']).toMatchObject({ totalUsers: 30, health: 'dormant' });
    expect(byName['Empty School']).toMatchObject({ totalUsers: 0, health: 'never' });
  });
});

describe('GET /api/super-admin/usage/schools/:schoolId', () => {
  test('404s for an unknown school', async () => {
    School.exists.mockResolvedValue(null);
    const res = await request(app).get(
      `/api/super-admin/usage/schools/${new mongoose.Types.ObjectId()}`,
    );
    expect(res.status).toBe(404);
  });

  test('400s for a malformed id', async () => {
    const res = await request(app).get('/api/super-admin/usage/schools/not-an-id');
    expect(res.status).toBe(400);
  });

  test('returns summary, byRole, admins and a paginated user directory', async () => {
    const schoolId = new mongoose.Types.ObjectId();
    School.exists.mockResolvedValue({ _id: schoolId });
    School.findById.mockReturnValue(query({ _id: schoolId, name: 'Test School', status: 'active' }));

    StudentUser.aggregate.mockResolvedValue([
      { total: 40, active24h: 3, active7d: 10, active30d: 25, everActive: 30, lastActivityAt: new Date() },
    ]);
    StudentUser.countDocuments.mockResolvedValue(2);
    StudentUser.find.mockReturnValue(
      query([
        { _id: 'stu-1', name: 'Asha', studentCode: 'S1', status: 'Active', lastActiveAt: new Date(), lastLoginAt: new Date() },
        { _id: 'stu-2', name: 'Ben', studentCode: 'S2', status: 'Active', lastActiveAt: null, lastLoginAt: null },
      ]),
    );

    const res = await request(app)
      .get(`/api/super-admin/usage/schools/${schoolId}`)
      .query({ role: 'student', page: 1, pageSize: 10 });

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ totalUsers: 40, active30d: 25 });
    expect(res.body.byRole[0]).toMatchObject({ role: 'student', total: 40 });
    expect(res.body.users.total).toBe(2);
    expect(res.body.users.items).toHaveLength(2);
    expect(res.body.users.items[0]).toMatchObject({ role: 'student', identifier: 'S1' });
  });
});
