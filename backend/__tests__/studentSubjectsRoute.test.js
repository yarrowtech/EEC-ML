const express = require('express');
const request = require('supertest');

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

describe('student allocated subjects without Redis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  test('queries MongoDB directly for every request without cache headers', async () => {
    const makeRequest = (studentId) => request(app)
      .get('/student/allocated-subjects')
      .set('x-user-id', studentId)
      .set('x-school-id', 'school-1')
      .set('x-campus-id', 'campus-1')
      .set('x-organization-id', 'org-1');

    const studentA = await makeRequest('student-a');
    const studentB = await makeRequest('student-b');

    const expectedBody = {
      subjects: [{
        _id: 'subject-1',
        name: 'Math',
        code: 'MATH',
        teachers: [{ id: 'teacher-1', name: 'Teacher One' }],
      }],
    };

    expect(studentA.status).toBe(200);
    expect(studentA.body).toEqual(expectedBody);
    expect(studentA.headers['x-cache']).toBeUndefined();
    expect(studentB.status).toBe(200);
    expect(studentB.body).toEqual(expectedBody);
    expect(studentB.headers['x-cache']).toBeUndefined();
    expect(mockTeacherAllocation.find).toHaveBeenCalledTimes(2);
  });
});
