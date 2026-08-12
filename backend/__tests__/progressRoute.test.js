jest.mock('../middleware/adminAuth', () => (_req, _res, next) => next());
jest.mock('../middleware/authTeacher', () => (_req, _res, next) => next());

const mockStudentUser = {
  find: jest.fn(),
};
jest.mock('../models/StudentUser', () => mockStudentUser);

const mockStudentProgress = {
  find: jest.fn(),
};
jest.mock('../models/StudentProgress', () => mockStudentProgress);

jest.mock('../models/Assignment', () => ({}));

const progressRoutes = require('../routes/progressRoute');

const findRouteHandler = (method, path) => {
  const layer = progressRoutes.stack.find(
    (candidate) => candidate.route?.path === path && candidate.route.methods[method]
  );
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

test('analytics validates and applies academicYearId without a mongoose reference error', async () => {
  const academicYearId = '507f1f77bcf86cd799439012';
  mockStudentUser.find.mockResolvedValue([]);
  mockStudentProgress.find.mockReturnValue({
    populate: jest.fn().mockResolvedValue([]),
  });
  const req = {
    schoolId: '507f1f77bcf86cd799439011',
    query: { academicYearId },
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  await findRouteHandler('get', '/analytics')(req, res);

  expect(res.statusCode).toBe(200);
  expect(mockStudentUser.find).toHaveBeenCalledWith({
    schoolId: req.schoolId,
    status: 'Active',
    academicYear: academicYearId,
  });
  expect(res.body).toEqual(expect.objectContaining({ totalStudents: 0 }));
});
