const express = require('express');
const request = require('supertest');

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
  child: jest.fn(() => mockLogger),
};

const mockLogAuthEvent = jest.fn();

const mockStudentUser = {
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};
const mockParentUser = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
};
const mockClassModel = {
  findOne: jest.fn(),
};
const mockTimetable = {
  find: jest.fn(),
};
const mockExamResult = {
  find: jest.fn(),
};
const mockStudentProgress = {
  findOne: jest.fn(),
};
const mockAssignment = {
  find: jest.fn(),
};
const mockTeacherUser = {
  findOne: jest.fn(),
};
const mockTeacherFeedback = {
  find: jest.fn(),
  create: jest.fn(),
};
const mockTeacherAllocation = {
  find: jest.fn(),
};
const mockSection = {
  findOne: jest.fn(),
};
const mockSupportRequest = {
  find: jest.fn(),
  create: jest.fn(),
};
const mockStudentObservation = {
  find: jest.fn(),
};
const mockWellbeing = {
  findOne: jest.fn(),
};
const mockMasteryScore = {
  find: jest.fn(),
};
const mockPracticeAttempt = {
  countDocuments: jest.fn(),
};

const mockBcryptCompare = jest.fn();
const mockJwtSign = jest.fn();
const mockGeneratePassword = jest.fn(() => 'Generated123!');
const mockIsStrongPassword = jest.fn(() => true);

jest.mock('../utils/logger', () => ({
  logger: mockLogger,
}));

jest.mock('../utils/authEventLogger', () => ({
  logAuthEvent: mockLogAuthEvent,
}));

jest.mock('../middleware/authStudent', () => (req, res, next) => {
  req.user = {
    id: req.headers['x-user-id'] || 'student-1',
    schoolId: req.headers['x-school-id'] || 'school-1',
    campusId: req.headers['x-campus-id'] || 'campus-1',
  };
  req.userType = req.headers['x-user-type'] || 'student';
  req.schoolId = req.user.schoolId;
  req.campusId = req.user.campusId;
  next();
});

jest.mock('../middleware/adminAuth', () => (req, res, next) => {
  req.admin = {
    schoolId: req.headers['x-school-id'] || 'school-1',
    campusId: req.headers['x-campus-id'] || 'campus-1',
    campusName: 'Main Campus',
    campusType: 'main',
    username: 'EEC-ADMIN',
  };
  req.schoolId = req.admin.schoolId;
  req.campusId = req.admin.campusId;
  req.isSuperAdmin = false;
  next();
});

jest.mock('../middleware/rateLimit', () => () => (req, res, next) => next());

jest.mock('../models/StudentUser', () => mockStudentUser);
jest.mock('../models/ParentUser', () => mockParentUser);
jest.mock('../models/Class', () => mockClassModel);
jest.mock('../models/Timetable', () => mockTimetable);
jest.mock('../models/ExamResult', () => mockExamResult);
jest.mock('../models/StudentProgress', () => mockStudentProgress);
jest.mock('../models/Assignment', () => mockAssignment);
jest.mock('../models/TeacherUser', () => mockTeacherUser);
jest.mock('../models/TeacherFeedback', () => mockTeacherFeedback);
jest.mock('../models/TeacherAllocation', () => mockTeacherAllocation);
jest.mock('../models/Section', () => mockSection);
jest.mock('../models/SupportRequest', () => mockSupportRequest);
jest.mock('../models/StudentObservation', () => mockStudentObservation);
jest.mock('../models/Wellbeing', () => mockWellbeing);
jest.mock('../models/MasteryScore', () => mockMasteryScore);
jest.mock('../models/PracticeAttempt', () => mockPracticeAttempt);

jest.mock('../models/Exam', () => ({}));
jest.mock('../models/StudentJournalEntry', () => ({}));
jest.mock('../models/Subject', () => ({}));

jest.mock('../utils/generator', () => ({
  generatePassword: (...args) => mockGeneratePassword(...args),
}));

jest.mock('../utils/passwordPolicy', () => ({
  isStrongPassword: (...args) => mockIsStrongPassword(...args),
  passwordPolicyMessage: 'Weak password',
}));

jest.mock('bcryptjs', () => ({
  compare: (...args) => mockBcryptCompare(...args),
}));

jest.mock('jsonwebtoken', () => ({
  sign: (...args) => mockJwtSign(...args),
}));

const studentRoute = require('../routes/studentRoute');
const studentAILearningRoute = require('../routes/studentAILearningRoute');
const studentProfileRoute = require('../routes/student');

const app = express();
app.use(express.json());
app.use('/student-route', studentRoute);
app.use('/student-ai', studentAILearningRoute);
app.use('/student-profile', studentProfileRoute);

const makeQuery = (value) => {
  const query = {
    select: jest.fn(() => query),
    populate: jest.fn(() => query),
    sort: jest.fn(() => query),
    limit: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
    catch: (reject) => Promise.resolve(value).catch(reject),
  };
  return query;
};

const makeRejectedQuery = (error) => {
  const query = {
    select: jest.fn(() => query),
    populate: jest.fn(() => query),
    sort: jest.fn(() => query),
    limit: jest.fn(() => query),
    lean: jest.fn().mockRejectedValue(error),
    then: (resolve, reject) => Promise.reject(error).then(resolve, reject),
    catch: (reject) => Promise.reject(error).catch(reject),
  };
  return query;
};

const getRouteHandler = (router, method, path) => {
  const layer = router.stack.find(
    (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
  );
  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

describe('student portal logger coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';

    mockStudentUser.find.mockReturnValue(makeQuery([]));
    mockParentUser.find.mockReturnValue(makeQuery([]));
    mockParentUser.findOne.mockResolvedValue(null);
    mockClassModel.findOne.mockReturnValue(makeQuery(null));
    mockTimetable.find.mockReturnValue(makeQuery([]));
    mockExamResult.find.mockReturnValue(makeQuery([]));
    mockStudentProgress.findOne.mockReturnValue(makeQuery(null));
    mockAssignment.find.mockReturnValue(makeQuery([]));
    mockTeacherUser.findOne.mockReturnValue(makeQuery(null));
    mockTeacherFeedback.find.mockReturnValue(makeQuery([]));
    mockTeacherAllocation.find.mockReturnValue(makeQuery([]));
    mockSection.findOne.mockReturnValue(makeQuery(null));
    mockSupportRequest.find.mockReturnValue(makeQuery([]));
    mockStudentObservation.find.mockReturnValue(makeQuery([]));
    mockWellbeing.findOne.mockReturnValue(makeQuery(null));
    mockMasteryScore.find.mockReturnValue(makeQuery([]));
    mockPracticeAttempt.countDocuments.mockReturnValue(makeQuery(0));
    mockBcryptCompare.mockResolvedValue(true);
    mockJwtSign.mockReturnValue('jwt-token');
    mockIsStrongPassword.mockReturnValue(true);
  });

  test('logs auth event on successful student registration', async () => {
    mockStudentUser.create.mockResolvedValue({ _id: 'student-1' });

    const response = await request(app)
      .post('/student-route/register')
      .send({ name: 'Ada', schoolId: 'school-1', grade: '10', section: 'A' });

    expect(response.status).toBe(201);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: 'register',
        outcome: 'success',
        userType: 'student',
      })
    );
  });

  test('logs auth event and logger error on failed student registration', async () => {
    mockStudentUser.create.mockRejectedValue(new Error('register failed'));

    const response = await request(app)
      .post('/student-route/register')
      .send({ name: 'Ada', schoolId: 'school-1', grade: '10', section: 'A' });

    expect(response.status).toBe(400);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: 'register',
        outcome: 'failure',
        userType: 'student',
        reason: 'register failed',
      })
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Student register error'
    );
  });

  test.each([
    [
      'invalid credentials',
      null,
      401,
      { action: 'login', outcome: 'failure', reason: 'Invalid credentials' },
    ],
    [
      'archived account',
      { _id: 'student-1', password: 'hash', isArchived: true, schoolId: 'school-1', campusId: 'campus-1' },
      403,
      { action: 'login', outcome: 'failure', reason: 'Account archived' },
    ],
    [
      'missing campus id',
      { _id: 'student-1', password: 'hash', isArchived: false, schoolId: 'school-1', campusId: null, lastLoginAt: new Date() },
      400,
      { action: 'login', outcome: 'failure', reason: 'campusId missing' },
    ],
    [
      'first login required',
      { _id: 'student-1', password: 'hash', isArchived: false, schoolId: 'school-1', campusId: 'campus-1', username: 'STD1', lastLoginAt: null },
      200,
      { action: 'login.first_login_required', outcome: 'success' },
    ],
    [
      'successful login',
      { _id: 'student-1', password: 'hash', isArchived: false, schoolId: 'school-1', campusId: 'campus-1', username: 'STD1', studentCode: 'STD1', lastLoginAt: new Date() },
      200,
      { action: 'login', outcome: 'success' },
    ],
  ])('logs auth event for %s', async (_label, user, status, expectedEvent) => {
    mockStudentUser.findOne.mockResolvedValue(user);

    const response = await request(app)
      .post('/student-route/login')
      .send({ username: 'STD1', password: 'Password123!' });

    expect(response.status).toBe(status);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        userType: 'student',
        identifier: 'STD1',
        ...expectedEvent,
      })
    );
  });

  test('logs auth event when student login throws', async () => {
    mockStudentUser.findOne.mockRejectedValue(new Error('login failed'));

    const response = await request(app)
      .post('/student-route/login')
      .send({ username: 'STD1', password: 'Password123!' });

    expect(response.status).toBe(400);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: 'login',
        outcome: 'failure',
        userType: 'student',
        reason: 'login failed',
      })
    );
  });

  test('logs auth event on successful first password reset', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    mockStudentUser.findOne.mockResolvedValue({
      _id: 'student-1',
      username: 'STD1',
      studentCode: 'STD1',
      schoolId: 'school-1',
      campusId: 'campus-1',
      lastLoginAt: null,
      save,
    });

    const response = await request(app)
      .post('/student-route/reset-first-password')
      .send({ username: 'STD1', newPassword: 'Password123!' });

    expect(response.status).toBe(200);
    expect(save).toHaveBeenCalled();
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: 'reset_first_password',
        outcome: 'success',
        userType: 'student',
      })
    );
  });

  test('logs auth event on failed first password reset', async () => {
    mockStudentUser.findOne.mockRejectedValue(new Error('reset failed'));

    const response = await request(app)
      .post('/student-route/reset-first-password')
      .send({ username: 'STD1', newPassword: 'Password123!' });

    expect(response.status).toBe(400);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: 'reset_first_password',
        outcome: 'failure',
        userType: 'student',
        reason: 'reset failed',
      })
    );
  });

  test('logs profile info lifecycle on successful student profile fetch', async () => {
    mockStudentUser.findById.mockReturnValue(makeQuery({
      _id: 'student-1',
      name: 'Ada',
      username: 'STD1',
      grade: '10',
      section: 'A',
      schoolId: { _id: 'school-1', name: 'School' },
    }));

    const response = await request(app).get('/student-route/profile');

    expect(response.status).toBe(200);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'student-1', userType: 'student' }),
      'Student profile request received'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ found: true }),
      'Student profile lookup completed'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'student-1' }),
      'Student profile response sent'
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('logs warn when student profile is missing', async () => {
    mockStudentUser.findById.mockReturnValue(makeQuery(null));

    const response = await request(app).get('/student-route/profile');

    expect(response.status).toBe(404);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ found: false }),
      'Student profile lookup completed'
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'student-1' }),
      'Student profile not found in database'
    );
  });

  test('logs error when student profile fetch fails', async () => {
    mockStudentUser.findById.mockReturnValue(makeRejectedQuery(new Error('profile failed')));

    const response = await request(app).get('/student-route/profile');

    expect(response.status).toBe(400);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error), userId: 'student-1' }),
      'Get profile error'
    );
  });

  test('returns only assignment grades published by the teacher', async () => {
    mockStudentUser.findById.mockReturnValue(makeQuery({
      _id: 'student-1',
      name: 'Ada',
      grade: '10',
      section: 'A',
      schoolId: 'school-1',
      campusId: 'campus-1',
    }));
    mockExamResult.find.mockReturnValue(makeQuery([]));
    mockStudentProgress.findOne.mockReturnValue(makeQuery({
      submissions: [
        {
          _id: 'submission-published',
          assignmentId: 'assignment-published',
          status: 'graded',
          publishedByTeacher: true,
          score: 18,
          feedback: 'Clear working.',
          submittedAt: '2026-08-20T00:00:00.000Z',
        },
        {
          _id: 'submission-private',
          assignmentId: 'assignment-private',
          status: 'graded',
          publishedByTeacher: false,
          score: 20,
          feedback: 'Not released yet.',
        },
      ],
    }));
    mockAssignment.find.mockReturnValue(makeQuery([{
      _id: 'assignment-published',
      title: 'Fractions homework',
      subject: 'Mathematics',
      marks: 20,
    }]));

    const response = await request(app).get('/student-route/results');

    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([
      expect.objectContaining({
        _id: 'submission-published',
        resultType: 'assignment',
        examName: 'Fractions homework',
        obtainedMarks: 18,
        totalMarks: 20,
        remarks: 'Clear working.',
      }),
    ]);
    expect(mockAssignment.find).toHaveBeenCalledWith({
      _id: { $in: ['assignment-published'] },
    });
  });

  test('returns the student health profile and only shared teacher observations', async () => {
    mockStudentUser.findOne.mockReturnValue(makeQuery({
      _id: 'student-1',
      name: 'Ada',
      grade: '10',
      section: 'A',
      bloodGroup: 'O+',
      allergies: 'Peanuts',
    }));
    mockStudentObservation.find.mockReturnValue(makeQuery([{
      _id: 'observation-1',
      recordedAt: '2026-08-20T00:00:00.000Z',
      parentNotification: true,
      teacherId: { name: 'Teacher One' },
      healthObservations: { energy: 'Good' },
    }]));

    const response = await request(app).get('/student-route/health');

    expect(response.status).toBe(200);
    expect(response.body.profile).toEqual(expect.objectContaining({ bloodGroup: 'O+', allergies: 'Peanuts' }));
    expect(response.body.observations).toEqual([
      expect.objectContaining({ teacherName: 'Teacher One', healthObservations: { energy: 'Good' } }),
    ]);
    expect(mockStudentObservation.find).toHaveBeenCalledWith(expect.objectContaining({
      studentId: 'student-1',
      source: 'teacher',
      parentNotification: true,
    }));
  });

  test('returns only complaints created by the signed-in student', async () => {
    mockStudentUser.findById.mockReturnValue(makeQuery({ _id: 'student-1', schoolId: 'school-1' }));
    mockSupportRequest.find.mockReturnValue(makeQuery([{
      _id: 'complaint-1',
      ticketNumber: 'STU-100',
      subject: 'Need help',
      message: 'Assignment instructions are unclear.',
      owner: 'Teacher One',
      status: 'open',
    }]));

    const response = await request(app).get('/student-route/complaints');

    expect(response.status).toBe(200);
    expect(response.body.complaints).toEqual([
      expect.objectContaining({ ticketNumber: 'STU-100', title: 'Need help' }),
    ]);
    expect(mockSupportRequest.find).toHaveBeenCalledWith({
      schoolId: 'school-1',
      supportType: 'complaint',
      createdByRole: 'student',
      'requestDetails.studentId': 'student-1',
    });
  });

  test('returns only the signed-in student wellbeing assessment', async () => {
    mockWellbeing.findOne.mockReturnValue(makeQuery({
      student: 'student-1',
      mood: 'good',
      academicStress: 4,
      socialEngagement: 8,
    }));

    const response = await request(app).get('/student-route/wellbeing');

    expect(response.status).toBe(200);
    expect(response.body.assessment).toEqual(expect.objectContaining({ mood: 'good' }));
    expect(mockWellbeing.findOne).toHaveBeenCalledWith({
      schoolId: 'school-1',
      student: 'student-1',
    });
  });

  test.each([
    ['GET', '/student-route/dashboard', () => {
      mockStudentUser.findById.mockReturnValue(makeRejectedQuery(new Error('dashboard failed')));
    }, 'Dashboard data error', 400],
    ['GET', '/student-route/attendance', () => {
      mockStudentUser.findById.mockReturnValue(makeRejectedQuery(new Error('attendance failed')));
    }, 'Attendance error', 400],
    ['GET', '/student-route/assignments', () => {
      mockStudentUser.findById.mockReturnValue(makeRejectedQuery(new Error('assignments failed')));
    }, 'Assignments error', 400],
    ['GET', '/student-route/results', () => {
      mockStudentUser.findById.mockReturnValue(makeRejectedQuery(new Error('results failed')));
    }, 'Results error', 400],
    ['GET', '/student-route/schedule', () => {
      mockStudentUser.findById.mockReturnValue(makeRejectedQuery(new Error('schedule failed')));
    }, 'Schedule error', 500],
    ['GET', '/student-route/teacher-feedback/context', () => {
      mockStudentUser.findById.mockReturnValue(makeRejectedQuery(new Error('context failed')));
    }, 'Teacher feedback context error', 500],
    ['GET', '/student-route/teacher-feedback', () => {
      mockTeacherFeedback.find.mockReturnValue(makeRejectedQuery(new Error('feedback list failed')));
    }, 'Teacher feedback list error', 500],
    ['POST', '/student-route/teacher-feedback', () => {
      mockStudentUser.findById.mockReturnValue(makeRejectedQuery(new Error('feedback submit failed')));
    }, 'Teacher feedback submit error', 500],
    ['GET', '/student-profile/allocated-subjects', () => {
      mockStudentUser.findOne.mockReturnValue(makeRejectedQuery(new Error('allocated subjects failed')));
    }, 'Error fetching allocated subjects', 500],
  ])('logs route errors for %s %s', async (method, path, arrange, message, status) => {
    arrange();

    const requestBuilder = method === 'POST'
      ? request(app)[method.toLowerCase()](path).send({ teacherId: 'teacher-1', subjectName: 'Math', ratings: { clarity: 4 } })
      : request(app)[method.toLowerCase()](path);

    const response = await requestBuilder;

    expect(response.status).toBe(status);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      message
    );
  });

  test('logs AI course fetch errors', async () => {
    mockStudentUser.findOne.mockRejectedValue(new Error('courses failed'));

    const response = await request(app).get('/student-ai/courses/student-1');

    expect(response.status).toBe(500);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error), studentId: 'student-1' }),
      'Error fetching AI courses'
    );
  });

  test.each([
    ['post', '/generate-content', { body: { topic: 'Quadratic Equations', subject: 'Math', contentType: 'summary', difficulty: 'medium' } }, 'Error generating AI content'],
    ['get', '/progress/:studentId', { params: { studentId: 'student-1' } }, 'Error fetching AI learning progress'],
    ['post', '/activity', { body: { studentId: 'student-1', activityType: 'quiz' } }, 'Error saving AI learning activity'],
    ['get', '/recommendations/:studentId', { params: { studentId: 'student-1' } }, 'Error fetching AI recommendations'],
  ])('logs AI route failures for %s %s', async (method, path, payload, message) => {
    const handler = getRouteHandler(studentAILearningRoute, method, path);
    const req = {
      body: payload.body || {},
      params: payload.params || {},
      headers: {},
      user: { id: 'student-1', schoolId: 'school-1', campusId: 'campus-1' },
      userType: 'student',
      schoolId: 'school-1',
      campusId: 'campus-1',
      log: { error: jest.fn() },
    };
    const res = {
      _failedOnce: false,
      status: jest.fn(() => res),
      json: jest.fn(() => {
        if (!res._failedOnce) {
          res._failedOnce = true;
          throw new Error('response write failed');
        }
        return res;
      }),
    };

    await handler(req, res);

    expect(req.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      message
    );
    expect(res.status).toHaveBeenLastCalledWith(500);
  });
});
