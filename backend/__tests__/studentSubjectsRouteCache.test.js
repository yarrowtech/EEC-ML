const express = require('express');
const request = require('supertest');

const mockGetJson = jest.fn();
const mockSetJson = jest.fn();
const mockGetNumber = jest.fn();

jest.mock('../utils/redisClient', () => ({
  getJson: (...args) => mockGetJson(...args),
  setJson: (...args) => mockSetJson(...args),
  getNumber: (...args) => mockGetNumber(...args),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../utils/studentPortalLogger', () => ({
  logStudentPortalEvent: jest.fn(),
  logStudentPortalError: jest.fn(),
}));

jest.mock('../middleware/authStudent', () => (req, _res, next) => {
  req.user = {
    id: req.headers['x-user-id'],
    schoolId: req.headers['x-school-id'],
    campusId: req.headers['x-campus-id'],
  };
  req.schoolId = req.user.schoolId;
  req.campusId = req.user.campusId;
  req.organizationId = req.headers['x-organization-id'];
  next();
});

const makeQuery = (value) => {
  const query = {
    select: jest.fn(() => query),
    populate: jest.fn(() => query),
    lean: jest.fn(() => query),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
    catch: (reject) => Promise.resolve(value).catch(reject),
  };
  return query;
};

const mockStudentUser = { findOne: jest.fn() };
const mockClass = { findOne: jest.fn() };
const mockSection = { findOne: jest.fn() };
const mockTeacherAllocation = { find: jest.fn() };

jest.mock('../models/StudentUser', () => mockStudentUser);
jest.mock('../models/Class', () => mockClass);
jest.mock('../models/Section', () => mockSection);
jest.mock('../models/TeacherAllocation', () => mockTeacherAllocation);
jest.mock('../models/Subject', () => ({}));

const studentRoute = require('../routes/student');
const app = express();
app.use(express.json());
app.use('/student', studentRoute);

describe('student allocated subjects cache authorization boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNumber.mockResolvedValue(0);
    mockSetJson.mockResolvedValue(undefined);

    mockStudentUser.findOne.mockReturnValue(makeQuery({ grade: '10', section: 'A' }));
    mockClass.findOne.mockReturnValue(makeQuery({ _id: 'class-1' }));
    mockSection.findOne.mockReturnValue(makeQuery({ _id: 'section-1' }));
    mockTeacherAllocation.find.mockReturnValue(
      makeQuery([{
        subjectId: { _id: 'subject-1', name: 'Math', code: 'MATH' },
        teacherId: { _id: 'teacher-1', name: 'Teacher One' },
      }])
    );
  });

  test('does not give student A cache data to student B', async () => {
    mockGetJson.mockImplementation((key) => {
      if (key.includes('student:student-a')) {
        return Promise.resolve({ subjects: [{ name: 'Private A data' }] });
      }
      return Promise.resolve(null);
    });

    const studentA = await request(app)
      .get('/student/allocated-subjects')
      .set('x-user-id', 'student-a')
      .set('x-school-id', 'school-1')
      .set('x-campus-id', 'campus-1')
      .set('x-organization-id', 'org-1');

    const studentB = await request(app)
      .get('/student/allocated-subjects')
      .set('x-user-id', 'student-b')
      .set('x-school-id', 'school-1')
      .set('x-campus-id', 'campus-1')
      .set('x-organization-id', 'org-1');

    expect(studentA.status).toBe(200);
    expect(studentA.body).toEqual({ subjects: [{ name: 'Private A data' }] });
    expect(studentA.headers['x-cache']).toBe('HIT');

    expect(studentB.status).toBe(200);
    expect(studentB.body).toEqual({
      subjects: [{
        _id: 'subject-1',
        name: 'Math',
        code: 'MATH',
        teachers: [{ id: 'teacher-1', name: 'Teacher One' }],
      }],
    });
    expect(studentB.headers['x-cache']).toBe('MISS');

    expect(mockGetJson).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('student:student-a')
    );
    expect(mockGetJson).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('student:student-b')
    );
  });
});
