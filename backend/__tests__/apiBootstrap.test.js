const request = require('supertest');

describe('backend API bootstrap', () => {
  let app;
  let mongooseConnect;
  let logSecurityEvent;
  let loggerError;
  let listenMock;

  const routeModules = [
    '../routes/adminRoutes',
    '../routes/adminFeedbackRoutes',
    '../routes/teacherRoute',
    '../routes/teacherDashboardRoutes',
    '../routes/staffRoutes',
    '../routes/studentRoute',
    '../routes/parentRoute',
    '../routes/principalRoutes',
    '../routes/authRoutes',
    '../routes/attendanceRoutes',
    '../routes/adminUserManagement',
    '../routes/subjectRoute',
    '../routes/examRoute',
    '../routes/feedbackRoute',
    '../routes/assignmentRoute',
    '../routes/behaviourRoute',
    '../routes/progressRoute',
    '../routes/aiLearningRoute',
    '../routes/studentAILearningRoute',
    '../routes/alcoveRoute',
    '../routes/meetingRoute',
    '../routes/studentObservationRoutes',
    '../routes/uploadRoutes',
    '../routes/schoolRoutes',
    '../routes/schoolRegistrationRoutes',
    '../routes/academicRoutes',
    '../routes/feeRoutes',
    '../routes/reportRoutes',
    '../routes/timetableRoutes',
    '../routes/notificationRoutes',
    '../routes/auditLogRoutes',
    '../routes/superAdminRoutes',
    '../routes/supportRoutes',
    '../routes/issueRoutes',
    '../routes/teacherAllocationRoutes',
    '../routes/practiceRoutes',
    '../routes/excuseLetterRoutes',
    '../routes/nifStudentRoutes',
    '../routes/lessonPlanRoutes',
    '../routes/aiTutorRoutes',
    '../routes/promotionRoutes',
    '../routes/holidayRoutes',
    '../routes/departmentRoutes',
    '../routes/chatRoutes',
    '../routes/achievementRoutes',
    '../routes/teachingMaterialRoutes',
    '../routes/studentMaterialRoutes',
    '../routes/practicePaperRoutes',
    '../routes/practiceSectionRoutes',
    '../routes/student',
    '../routes/principalDashboardRoutes',
    '../routes/organizationRoutes',
  ];

  const apiPrefixes = [
    '/api/admin/users',
    '/api/promotion',
    '/api/admin/auth',
    '/api/admin/feedback',
    '/api/teacher/auth',
    '/api/teacher/dashboard',
    '/api/staff/auth',
    '/api/student/auth',
    '/api/parent/auth',
    '/api/principal/auth',
    '/api/auth',
    '/api/principal',
    '/api/attendance',
    '/api/student',
    '/api/subject',
    '/api/exam',
    '/api/assignment',
    '/api/feedback',
    '/api/behaviour',
    '/api/progress',
    '/api/ai-learning',
    '/api/student-ai-learning',
    '/api/alcove',
    '/api/meeting',
    '/api/observations',
    '/api/schools',
    '/api/school-registration',
    '/api/academic',
    '/api/fees',
    '/api/reports',
    '/api/timetable',
    '/api/notifications',
    '/api/audit-logs',
    '/api/super-admin',
    '/api/support',
    '/api/issues',
    '/api/teacher-allocations',
    '/api/practice',
    '/api/excuse-letters',
    '/api/nif',
    '/api/lesson-plans',
    '/api/ai-tutor',
    '/api/holidays',
    '/api/departments',
    '/api/chat',
    '/api/achievements',
    '/api/teaching-materials',
    '/api/student/materials',
    '/api/practice-papers',
    '/api/practice-sections',
    '/api/uploads',
  ];

  const mockCommonDependencies = () => {
    mongooseConnect = jest.fn(() => Promise.resolve());
    logSecurityEvent = jest.fn();
    loggerError = jest.fn();
    listenMock = jest.fn((_port, _host, cb) => cb && cb());

    routeModules.forEach((modulePath) => {
      jest.doMock(modulePath, () => {
        const express = require('express');
        const router = express.Router();
        router.use((req, res) => {
          res.status(200).json({
            ok: true,
            baseUrl: req.baseUrl,
            path: req.path,
            method: req.method,
          });
        });
        return router;
      });
    });

    jest.doMock('mongoose', () => ({
      connect: mongooseConnect,
      isValidObjectId: jest.fn(() => true),
      plugin: jest.fn(),
    }));

    const mockedTenantResolver = Object.assign(
      jest.fn((req, _res, next) => {
        req.isMainDomain = false;
        req.organizationId = '507f1f77bcf86cd799439011';
        next();
      }),
      {
        getRootDomain: jest.fn(() => 'electroniceducare.com'),
        isMainHostname: jest.fn(() => true),
        normalizeHostname: jest.fn((value) => value),
        resolveSlug: jest.fn(() => null),
      }
    );
    jest.doMock('../middleware/tenantResolver', () => mockedTenantResolver);
    jest.doMock('../utils/tenantContext', () => ({
      runWithTenant: jest.fn((_organization, callback) => callback()),
    }));

    jest.doMock('http', () => {
      const actual = jest.requireActual('http');
      return {
        ...actual,
        createServer: jest.fn((expressApp) => {
          app = expressApp;
          return {
            listen: listenMock,
            on: jest.fn(),
          };
        }),
        request: jest.fn(() => ({
          on: jest.fn(),
          end: jest.fn(),
        })),
      };
    });

    jest.doMock('https', () => {
      const actual = jest.requireActual('https');
      return {
        ...actual,
        request: jest.fn(() => ({
          on: jest.fn(),
          end: jest.fn(),
        })),
      };
    });

    jest.doMock('socket.io', () => ({
      Server: jest.fn(() => ({
        use: jest.fn(),
        on: jest.fn(),
        to: jest.fn(() => ({ emit: jest.fn() })),
      })),
    }));

    jest.doMock('../models/ChatThread', () => ({
      collection: {
        indexes: jest.fn(() => Promise.resolve([])),
        createIndex: jest.fn(() => Promise.resolve()),
      },
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
      updateOne: jest.fn(() => Promise.resolve()),
      bulkWrite: jest.fn(() => Promise.resolve()),
    }));

    jest.doMock('../models/ChatMessage', () => ({
      updateMany: jest.fn(() => Promise.resolve()),
      create: jest.fn(() => Promise.resolve({
        text: 'message',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        toObject: () => ({ text: 'message' }),
      })),
    }));

    ['StudentUser', 'TeacherUser', 'Principal', 'Admin'].forEach((name) => {
      jest.doMock(`../models/${name}`, () => ({
        findOne: jest.fn(() => Promise.resolve(null)),
        updateMany: jest.fn(() => Promise.resolve()),
      }));
    });

    jest.doMock('../models/Organization', () => ({
      findOne: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(null)) })),
    }));

    jest.doMock('../utils/chatPresence', () => ({
      getPresenceSnapshot: jest.fn(() => ({ online: false, lastSeen: null })),
      markUserOnline: jest.fn(() => ({ changed: false, lastSeen: null })),
      markUserOffline: jest.fn(() => ({ changed: false, lastSeen: null })),
    }));

    jest.doMock('../utils/chatGroupProvisioning', () => ({
      syncAllocationGroupThreads: jest.fn(() => Promise.resolve({ createdOrUpdated: 0, scanned: 0 })),
    }));

    jest.doMock('../utils/holidayNotificationScheduler', () => ({
      startHolidayReminderScheduler: jest.fn(),
    }));

    jest.doMock('../utils/passwordPolicy', () => ({
      isStrongPassword: jest.fn(() => true),
    }));

    jest.doMock('../utils/logger', () => ({
      bindConsoleToLogger: jest.fn(),
      logger: {
        child: jest.fn(() => ({
          info: jest.fn(),
          error: loggerError,
          log: jest.fn(),
        })),
        info: jest.fn(),
        error: loggerError,
        log: jest.fn(),
      },
    }));

    jest.doMock('../utils/securityEventLogger', () => ({
      logSecurityEvent,
    }));
  };

  beforeEach(() => {
    jest.resetModules();
    mockCommonDependencies();
    require('../index');
  });

  it('boots without a live database and exposes the root health endpoints', async () => {
    const rootRes = await request(app).get('/');
    const healthRes = await request(app).get('/health');

    expect(mongooseConnect).toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalled();
    expect(rootRes.status).toBe(200);
    expect(rootRes.text).toContain('Electronic Educare API');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body).toEqual({ ok: true });
  });

  it.each(apiPrefixes)('mounts %s and routes requests through the application stack', async (prefix) => {
    const res = await request(app).get(prefix);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        baseUrl: prefix,
        path: '/',
        method: 'GET',
      })
    );
  });

  it('returns a structured 400 response for malformed JSON and logs a security event', async () => {
    const res = await request(app)
      .post('/api/auth')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Malformed JSON payload' });
    expect(logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        originalUrl: '/api/auth',
        method: 'POST',
      }),
      expect.objectContaining({
        action: 'security.malformed_json_payload',
        outcome: 'blocked',
        severity: 'medium',
        statusCode: 400,
        parserType: 'express.json',
      })
    );
  });

  it('uses the shared error handler for route failures and records the error log entry', async () => {
    jest.resetModules();
    mockCommonDependencies();

    jest.doMock('../routes/authRoutes', () => {
      const express = require('express');
      const router = express.Router();
      router.get('/', (_req, _res, next) => {
        const err = new Error('Boom');
        err.status = 418;
        next(err);
      });
      return router;
    });

    require('../index');

    const res = await request(app).get('/api/auth');

    expect(res.status).toBe(418);
    expect(res.body).toEqual({ message: 'Boom' });
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'http_error',
        method: 'GET',
        path: '/api/auth',
        statusCode: 418,
        err: expect.any(Error),
      }),
      'Unhandled API error'
    );
  });
});
