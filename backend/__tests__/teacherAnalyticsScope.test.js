/**
 * Regression: several teacher-analytics endpoints read student mastery / error
 * data without intersecting the query against the requesting teacher's class
 * allocations. `/low-mastery` averaged mastery across the whole school;
 * `/error-breakdown` and `/class-insights` fell back to every student in the
 * school whenever no `classId` was supplied (`requireClassIdAllocation` returns
 * true for a missing classId); `/bloom-distribution` never validated a
 * subject-only request. All four must now be scoped to the teacher's
 * allocations.
 */
jest.mock('../middleware/authTeacher', () => (_req, _res, next) => next());

let mockScope = [];
jest.mock('../utils/teacherAllocationScope', () => {
  const actual = jest.requireActual('../utils/teacherAllocationScope');
  return { ...actual, buildTeacherAllocationScope: jest.fn(() => Promise.resolve(mockScope)) };
});

const leanChain = (value) => {
  const chain = {
    select: () => chain,
    populate: () => chain,
    sort: () => chain,
    lean: () => Promise.resolve(value),
    distinct: () => Promise.resolve(value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return chain;
};

const mockStudentUser = { find: jest.fn(), distinct: jest.fn(), findOne: jest.fn() };
jest.mock('../models/StudentUser', () => mockStudentUser);

const mockTeacherAllocation = { find: jest.fn() };
jest.mock('../models/TeacherAllocation', () => mockTeacherAllocation);

const mockMasteryScore = { find: jest.fn(), aggregate: jest.fn() };
jest.mock('../models/MasteryScore', () => mockMasteryScore);

const mockErrorRecord = { aggregate: jest.fn() };
jest.mock('../models/ErrorRecord', () => mockErrorRecord);

const mockTeachingMaterial = { aggregate: jest.fn() };
jest.mock('../models/TeachingMaterial', () => mockTeachingMaterial);

jest.mock('../models/ExamResult', () => ({ find: jest.fn(() => leanChain([])) }));
jest.mock('../models/InterventionLog', () => ({ find: jest.fn(() => leanChain([])), create: jest.fn() }));
jest.mock('../models/PracticeAttempt', () => ({}));
jest.mock('../models/PracticeQuestion', () => ({}));

const router = require('../routes/teacherAnalyticsRoutes');

const findRouteHandler = (method, path) => {
  const layer = router.stack.find(
    (candidate) => candidate.route?.path === path && candidate.route.methods[method]
  );
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

const makeRes = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
  send(payload) { this.body = payload; return this; },
  setHeader() {},
});

const SCHOOL = '507f1f77bcf86cd799439011';
const TEACHER = '507f1f77bcf86cd799439012';

const scopeFor = (className, sectionName, subjects = [], isClassTeacher = false) => ({
  className, sectionName,
  normalizedClass: String(className).toLowerCase().replace(/^class\s+/, ''),
  normalizedSection: String(sectionName || '').toLowerCase(),
  subjects, isClassTeacher,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockScope = [scopeFor('5', 'A', ['Math'])];
});

describe('GET /low-mastery', () => {
  test('rejects a teacher with no allocations', async () => {
    mockScope = [];
    const res = makeRes();
    await findRouteHandler('get', '/low-mastery')({ schoolId: SCHOOL, user: { id: TEACHER }, query: {} }, res);
    expect(res.statusCode).toBe(403);
  });

  test('aggregates mastery only for students in the allocated class/section', async () => {
    mockTeacherAllocation.find.mockReturnValue(leanChain([{ subjectId: { name: 'Math' } }]));
    mockStudentUser.find.mockReturnValue(leanChain(['s1', 's2']));
    let captured;
    mockMasteryScore.aggregate.mockImplementation((pipeline) => { captured = pipeline; return Promise.resolve([]); });

    const res = makeRes();
    await findRouteHandler('get', '/low-mastery')({ schoolId: SCHOOL, user: { id: TEACHER }, query: {} }, res);

    expect(res.statusCode).toBe(200);
    // The student filter passed to StudentUser.find must be scoped, not { schoolId } alone.
    const studentFilter = mockStudentUser.find.mock.calls[0][0];
    expect(studentFilter.$or).toBeDefined();
    // The aggregation must constrain by the scoped student ids.
    expect(captured[0].$match.studentId).toEqual({ $in: ['s1', 's2'] });
  });
});

describe('GET /error-breakdown', () => {
  test('without a classId, scopes to the teacher allocations instead of the whole school', async () => {
    mockStudentUser.distinct.mockResolvedValue(['s1']);
    mockErrorRecord.aggregate.mockResolvedValue([]);

    const res = makeRes();
    await findRouteHandler('get', '/error-breakdown')({ schoolId: SCHOOL, user: { id: TEACHER }, query: {} }, res);

    expect(res.statusCode).toBe(200);
    const distinctFilter = mockStudentUser.distinct.mock.calls[0][1];
    expect(distinctFilter.$or).toBeDefined();
    expect(distinctFilter).not.toEqual({ schoolId: SCHOOL });
  });

  test('rejects a teacher with no allocations', async () => {
    mockScope = [];
    const res = makeRes();
    await findRouteHandler('get', '/error-breakdown')({ schoolId: SCHOOL, user: { id: TEACHER }, query: {} }, res);
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /class-insights', () => {
  test('without a classId, scopes student aggregation to the teacher allocations', async () => {
    mockStudentUser.find.mockReturnValue(leanChain([]));
    mockMasteryScore.find.mockReturnValue(leanChain([]));

    const res = makeRes();
    await findRouteHandler('get', '/class-insights')({ schoolId: SCHOOL, user: { id: TEACHER }, query: {} }, res);

    const studentFilter = mockStudentUser.find.mock.calls[0][0];
    expect(studentFilter.$or).toBeDefined();
    expect(studentFilter).not.toEqual({ schoolId: SCHOOL });
  });
});

describe('GET /bloom-distribution', () => {
  test('rejects a subject the teacher does not teach', async () => {
    const res = makeRes();
    await findRouteHandler('get', '/bloom-distribution')(
      { schoolId: SCHOOL, user: { id: TEACHER }, query: { subject: 'Science' } }, res
    );
    expect(res.statusCode).toBe(403);
  });

  test('allows a subject within the teacher scope', async () => {
    mockTeachingMaterial.aggregate.mockResolvedValue([]);
    const res = makeRes();
    await findRouteHandler('get', '/bloom-distribution')(
      { schoolId: SCHOOL, user: { id: TEACHER }, query: { subject: 'Math' } }, res
    );
    expect(res.statusCode).toBe(200);
  });
});
