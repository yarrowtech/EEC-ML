const express = require('express');
const request = require('supertest');

describe('student registration route logging', () => {
  let app;
  let studentRoute;
  let loggerLog;
  let logSecurityEvent;
  let studentFind;
  let studentCreate;
  let parentFindOne;
  let parentCreate;
  let generatePassword;

  const buildStudentUserDoc = (overrides = {}) => ({
    _id: 'student-1',
    ...overrides,
  });

  beforeEach(() => {
    jest.resetModules();

    loggerLog = jest.fn();
    logSecurityEvent = jest.fn();
    studentFind = jest.fn();
    studentCreate = jest.fn();
    parentFindOne = jest.fn();
    parentCreate = jest.fn();
    generatePassword = jest.fn(() => 'Temp#12345');

    jest.doMock('../utils/logger', () => ({
      logger: {
        log: loggerLog,
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
      },
    }));

    jest.doMock('../utils/securityEventLogger', () => ({
      logSecurityEvent,
    }));

    jest.doMock('../utils/generator', () => ({
      generatePassword,
    }));

    jest.doMock('../utils/passwordPolicy', () => ({
      isStrongPassword: jest.fn(() => true),
      passwordPolicyMessage: 'Password does not meet policy',
    }));

    jest.doMock('../middleware/adminAuth', () => (req, _res, next) => {
      req.admin = {
        id: 'admin-1',
        username: 'EEC-SUPER-ADMIN',
        schoolId: 'school-1',
        campusId: 'campus-1',
      };
      req.campusId = 'campus-1';
      req.isSuperAdmin = true;
      next();
    });

    jest.doMock('../models/StudentUser', () => ({
      find: studentFind,
      create: studentCreate,
    }));

    jest.doMock('../models/ParentUser', () => ({
      findOne: parentFindOne,
      create: parentCreate,
    }));

    const noopModel = {
      find: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(() => Promise.resolve([])),
        })),
      })),
      findOne: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(() => Promise.resolve(null)),
        })),
        lean: jest.fn(() => Promise.resolve(null)),
      })),
      create: jest.fn(),
    };

    [
      '../models/Class',
      '../models/AcademicYear',
      '../models/Timetable',
      '../models/ExamResult',
      '../models/Exam',
      '../models/StudentJournalEntry',
      '../models/TeacherAllocation',
      '../models/Section',
      '../models/StudentProgress',
      '../models/Assignment',
      '../models/TeacherUser',
      '../models/TeacherFeedback',
    ].forEach((modulePath) => {
      jest.doMock(modulePath, () => ({
        ...noopModel,
      }));
    });

    studentCreate.mockResolvedValue(buildStudentUserDoc());
    studentFind.mockReturnValue({
      select: jest.fn(() => ({
        lean: jest.fn(() => Promise.resolve([])),
      })),
    });
    parentFindOne.mockResolvedValue(null);
    parentCreate.mockResolvedValue({
      _id: 'parent-1',
      username: 'PARENT-001',
    });

    studentRoute = require('../routes/studentRoute');

    app = express();
    app.use(express.json());
    app.use('/api/student/auth', studentRoute);
  });

  it('writes a pino auth event for a successful student registration', async () => {
    const res = await request(app)
      .post('/api/student/auth/register')
      .set('user-agent', 'Jest Agent')
      .send({
        name: 'Jane Student',
        schoolId: 'school-1',
        grade: '10',
        section: 'A',
        admissionDate: '2026-04-01',
        mobile: '9999999999',
        email: 'jane@example.com',
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Student registered successfully',
        username: 'SUPER-ADMIN-STD-26-001',
        studentCode: 'SUPER-ADMIN-STD-26-001',
        password: 'Temp#12345',
        userId: 'student-1',
        parentCredentials: null,
      })
    );

    expect(generatePassword).toHaveBeenCalledTimes(1);
    expect(studentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'SUPER-ADMIN-STD-26-001',
        password: 'Temp#12345',
        initialPassword: 'Temp#12345',
        schoolId: 'school-1',
        campusId: 'campus-1',
        name: 'Jane Student',
        grade: '10',
        section: 'A',
        status: 'Active',
        mobile: '9999999999',
        email: 'jane@example.com',
      })
    );
    expect(loggerLog).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        message: 'Auth event',
        event: 'auth_event',
        action: 'register',
        outcome: 'success',
        userType: 'student',
        identifier: 'SUPER-ADMIN-STD-26-001',
        userId: 'student-1',
        schoolId: 'school-1',
        campusId: 'campus-1',
        method: 'POST',
        path: '/api/student/auth/register',
      })
    );
    expect(logSecurityEvent).not.toHaveBeenCalled();
  });
});
