const { EventEmitter } = require('events');
const mongoose = require('mongoose');

const mkModel = () => ({ updateOne: jest.fn(() => Promise.resolve({ acknowledged: true })) });

jest.mock('../models/StudentUser', () => mkModel());
jest.mock('../models/TeacherUser', () => mkModel());
jest.mock('../models/ParentUser', () => mkModel());
jest.mock('../models/StaffUser', () => mkModel());
jest.mock('../models/Admin', () => mkModel());
jest.mock('../models/Principal', () => mkModel());
jest.mock('../utils/logger', () => ({ logger: { debug: jest.fn() } }));

const StudentUser = require('../models/StudentUser');
const TeacherUser = require('../models/TeacherUser');
const Admin = require('../models/Admin');
const activityTracker = require('../middleware/activityTracker');

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const makeToken = (payload) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;

const makeReq = (payload, overrides = {}) => ({
  headers: { authorization: `Bearer ${makeToken(payload)}` },
  originalUrl: '/api/student/dashboard',
  url: '/api/student/dashboard',
  method: 'GET',
  // stand-in for the marker a role-auth middleware sets on an authenticated req
  user: { id: payload.id },
  ...overrides,
});

const makeRes = (statusCode = 200) => Object.assign(new EventEmitter(), { statusCode });

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('activityTracker middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activityTracker._reset();
  });

  test('stamps lastActiveAt on the matching model for a successful request', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const req = makeReq({ id, userType: 'student' });
    const res = makeRes(200);
    const next = jest.fn();

    activityTracker(req, res, next);
    expect(next).toHaveBeenCalled();

    res.emit('finish');
    await flush();

    expect(StudentUser.updateOne).toHaveBeenCalledTimes(1);
    const [filter, update] = StudentUser.updateOne.mock.calls[0];
    expect(String(filter._id)).toBe(id);
    expect(update.$set.lastActiveAt).toBeInstanceOf(Date);
  });

  test('routes by role (teacher token -> TeacherUser)', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = makeRes(200);
    activityTracker(makeReq({ id, userType: 'teacher' }), res, jest.fn());
    res.emit('finish');
    await flush();

    expect(TeacherUser.updateOne).toHaveBeenCalledTimes(1);
    expect(StudentUser.updateOne).not.toHaveBeenCalled();
  });

  test('maps super_admin token type to Admin', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = makeRes(200);
    activityTracker(makeReq({ id, type: 'admin', userType: 'SuperAdmin' }), res, jest.fn());
    res.emit('finish');
    await flush();
    expect(Admin.updateOne).toHaveBeenCalledTimes(1);
  });

  test('throttles repeat requests from the same user within the flush window', async () => {
    const id = new mongoose.Types.ObjectId().toString();

    for (let i = 0; i < 4; i += 1) {
      const res = makeRes(200);
      activityTracker(makeReq({ id, userType: 'student' }), res, jest.fn());
      res.emit('finish');
      await flush(); // eslint-disable-line no-await-in-loop
    }

    expect(StudentUser.updateOne).toHaveBeenCalledTimes(1);
  });

  test('ignores failed responses (>= 400)', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = makeRes(403);
    activityTracker(makeReq({ id, userType: 'student' }), res, jest.fn());
    res.emit('finish');
    await flush();
    expect(StudentUser.updateOne).not.toHaveBeenCalled();
  });

  test('ignores auth endpoints', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = makeRes(200);
    activityTracker(
      makeReq({ id, userType: 'student' }, { originalUrl: '/api/student/auth/login', url: '/api/student/auth/login' }),
      res,
      jest.fn(),
    );
    res.emit('finish');
    await flush();
    expect(StudentUser.updateOne).not.toHaveBeenCalled();
  });

  test('does not write when no role-auth marker is present on the request', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = makeRes(200);
    activityTracker(makeReq({ id, userType: 'student' }, { user: undefined }), res, jest.fn());
    res.emit('finish');
    await flush();
    expect(StudentUser.updateOne).not.toHaveBeenCalled();
  });

  test('passes through with no crash when there is no bearer token', () => {
    const next = jest.fn();
    activityTracker({ headers: {} }, makeRes(200), next);
    expect(next).toHaveBeenCalled();
  });

  test('ignores a malformed / non-ObjectId subject', async () => {
    const res = makeRes(200);
    activityTracker(makeReq({ id: 'not-an-id', userType: 'student' }), res, jest.fn());
    res.emit('finish');
    await flush();
    expect(StudentUser.updateOne).not.toHaveBeenCalled();
  });
});
