describe('logger utility modules', () => {
  describe('securityEventLogger', () => {
    let loggerLog;
    let logSecurityEvent;

    beforeEach(() => {
      jest.resetModules();
      loggerLog = jest.fn();

      jest.doMock('../utils/logger', () => ({
        logger: {
          log: loggerLog,
        },
      }));

      ({ logSecurityEvent } = require('../utils/securityEventLogger'));
    });

    it('logs security events with inferred attack type and severity-based risk score', () => {
      const req = {
        method: 'POST',
        originalUrl: '/api/student/auth/login',
        requestId: 'req-sec',
        traceId: 'trace-sec',
        headers: {
          'user-agent': 'Mozilla/5.0',
          'x-forwarded-for': '203.0.113.10',
        },
        get: jest.fn((name) => req.headers[name]),
        ip: '203.0.113.10',
        socket: { remoteAddress: '10.0.0.5' },
      };

      logSecurityEvent(req, {
        action: 'security.auth_failure_detected',
        outcome: 'blocked',
        severity: 'critical',
        reason: 'Too many failed logins',
        statusCode: 429,
        actorId: 'user-1',
      });

      expect(loggerLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: 'Security event',
          type: 'security_event',
          event: 'security_event',
          action: 'security.auth_failure_detected',
          outcome: 'blocked',
          severity: 'critical',
          attack_type: 'bruteforce_or_auth_abuse',
          riskScore: 90,
          reason: 'Too many failed logins',
          statusCode: 429,
          requestId: 'req-sec',
          traceId: 'trace-sec',
          method: 'POST',
          path: '/api/student/auth/login',
          ip: '203.0.113.10',
          remoteIp: '10.0.0.5',
          ipSource: 'trusted_proxy_or_socket',
          forwardedForChain: ['203.0.113.10'],
          forwardedForCount: 1,
          userAgent: 'Mozilla/5.0',
          actorId: 'user-1',
        })
      );
    });
  });

  describe('businessEventLogger', () => {
    let loggerLog;
    let logBusinessEvent;

    beforeEach(() => {
      jest.resetModules();
      loggerLog = jest.fn();

      jest.doMock('../utils/logger', () => ({
        logger: {
          log: loggerLog,
        },
      }));

      ({ logBusinessEvent } = require('../utils/businessEventLogger'));
    });

    it('logs business events with normalized entity metadata', () => {
      const req = {
        method: 'PATCH',
        originalUrl: '/api/fees/admin/invoices/42',
        requestId: 'req-biz',
        traceId: 'trace-biz',
        headers: { 'user-agent': 'Jest Agent' },
        get: jest.fn((name) => req.headers[name]),
        ip: '198.51.100.40',
        socket: { remoteAddress: '198.51.100.40' },
      };

      logBusinessEvent(req, {
        action: 'invoice.update',
        outcome: 'failure',
        entity: 'invoice',
        entityId: 42,
        statusCode: 409,
        attemptedBy: 'admin-1',
      });

      expect(loggerLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: 'Business event',
          type: 'business_event',
          event: 'business_event',
          action: 'invoice.update',
          outcome: 'failure',
          entity: 'invoice',
          entityId: '42',
          statusCode: 409,
          requestId: 'req-biz',
          traceId: 'trace-biz',
          method: 'PATCH',
          path: '/api/fees/admin/invoices/42',
          ip: '198.51.100.40',
          remoteIp: '198.51.100.40',
          ipSource: 'trusted_proxy_or_socket',
          forwardedForChain: [],
          forwardedForCount: 0,
          userAgent: 'Jest Agent',
          attemptedBy: 'admin-1',
        })
      );
    });
  });

  describe('studentPortalLogger', () => {
    let logger;
    let logBusinessEvent;
    let logSecurityEvent;
    let studentPortalLogger;

    beforeEach(() => {
      jest.resetModules();
      logger = {
        log: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      logBusinessEvent = jest.fn();
      logSecurityEvent = jest.fn();

      jest.doMock('../utils/logger', () => ({ logger }));
      jest.doMock('../utils/businessEventLogger', () => ({ logBusinessEvent }));
      jest.doMock('../utils/securityEventLogger', () => ({ logSecurityEvent }));

      studentPortalLogger = require('../utils/studentPortalLogger');
    });

    it('logs teacher portal audit events and mirrors them to business events', () => {
      const reqLog = { log: jest.fn() };
      const req = {
        method: 'POST',
        originalUrl: '/api/assignment/teacher',
        requestId: 'req-portal',
        traceId: 'trace-portal',
        userType: 'teacher',
        user: {
          id: 'teacher-7',
          userType: 'teacher',
          schoolId: 'school-1',
          campusId: 'campus-2',
        },
        headers: { 'user-agent': 'Teacher Browser' },
        get: jest.fn((name) => req.headers[name]),
        ip: '203.0.113.20',
        socket: { remoteAddress: '203.0.113.20' },
        log: reqLog,
      };

      studentPortalLogger.logTeacherPortalAudit(req, {
        action: 'assignment.create',
        feature: 'assignments',
        outcome: 'success',
        statusCode: 201,
        targetType: 'assignment',
        targetId: 42,
        resultCount: '3',
      });

      expect(req._portalEventLogged).toBe(true);
      expect(reqLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'Teacher portal event',
          event: 'teacher_portal_event',
          type: 'teacher_portal_event',
          category: 'audit',
          feature: 'assignments',
          portalType: 'teacher',
          portalArea: 'assignments',
          frontendPath: '/teacher/assignments',
          action: 'assignment.create',
          outcome: 'success',
          statusCode: 201,
          resultCount: 3,
          targetType: 'assignment',
          targetId: '42',
          teacherId: 'teacher-7',
          userId: 'teacher-7',
          userType: 'teacher',
          schoolId: 'school-1',
          campusId: 'campus-2',
        })
      );
      expect(logBusinessEvent).toHaveBeenCalledWith(
        req,
        expect.objectContaining({
          action: 'assignment.create',
          outcome: 'success',
          entity: 'assignment',
          entityId: 42,
          portalType: 'teacher',
          portalArea: 'assignments',
          frontendPath: '/teacher/assignments',
          teacherId: 'teacher-7',
        })
      );
      expect(logSecurityEvent).not.toHaveBeenCalled();
    });

    it('logs admin portal security events and mirrors them to security logging', () => {
      const req = {
        method: 'DELETE',
        originalUrl: '/api/super-admin/users/44',
        requestId: 'req-admin',
        traceId: 'trace-admin',
        admin: {
          id: 'admin-9',
          schoolId: 'school-9',
          campusId: 'campus-3',
        },
        userType: 'super_admin',
        headers: { 'user-agent': 'Admin Browser' },
        get: jest.fn((name) => req.headers[name]),
        ip: '198.51.100.99',
        socket: { remoteAddress: '198.51.100.99' },
      };

      studentPortalLogger.logAdminPortalSecurity(req, {
        action: 'user.delete',
        outcome: 'failure',
        reason: 'Forbidden by role policy',
        statusCode: 403,
        targetType: 'user',
        targetId: '44',
      });

      expect(logger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: 'Admin portal event',
          event: 'admin_portal_event',
          category: 'security',
          portalType: 'admin',
          portalArea: 'admin_management',
          frontendPath: '/admin/school-admins',
          action: 'user.delete',
          outcome: 'failure',
          reason: 'Forbidden by role policy',
          targetType: 'user',
          targetId: '44',
          adminId: 'admin-9',
          userId: 'admin-9',
          userType: 'super_admin',
        })
      );
      expect(logBusinessEvent).not.toHaveBeenCalled();
      expect(logSecurityEvent).toHaveBeenCalledWith(
        req,
        expect.objectContaining({
          action: 'admin_portal.user.delete',
          outcome: 'blocked',
          severity: 'medium',
          statusCode: 403,
          reason: 'Forbidden by role policy',
          targetType: 'user',
          targetId: '44',
          portalType: 'admin',
          portalArea: 'admin_management',
          frontendPath: '/admin/school-admins',
          adminId: 'admin-9',
        })
      );
    });

    it('infers student portal type from request path when actor context is missing', () => {
      const req = {
        method: 'POST',
        originalUrl: '/api/student-ai-learning/generate-content',
        requestId: 'req-ai',
        traceId: 'trace-ai',
        headers: { 'user-agent': 'AI Browser' },
        get: jest.fn((name) => req.headers[name]),
        ip: '203.0.113.55',
        socket: { remoteAddress: '203.0.113.55' },
      };

      studentPortalLogger.logStudentPortalEvent(req, {
        action: 'content.generate',
        feature: 'ai_learning',
        targetType: 'student',
        targetId: 'student-1',
      });

      expect(logger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          portalType: 'student',
          portalArea: 'ai_learning',
          frontendPath: '/student/ai-learning',
          action: 'content.generate',
          targetType: 'student',
          targetId: 'student-1',
        })
      );
    });

    it('maps class-teacher student auth endpoint to dashboard surface metadata', () => {
      const req = {
        method: 'GET',
        originalUrl: '/api/student/auth/class-teacher',
        userType: 'student',
        user: { id: 'student-9', userType: 'student' },
        headers: { 'user-agent': 'Student Browser' },
        get: jest.fn((name) => req.headers[name]),
        ip: '203.0.113.23',
        socket: { remoteAddress: '203.0.113.23' },
      };

      studentPortalLogger.logStudentPortalEvent(req, {
        action: 'class_teacher.fetch',
      });

      expect(logger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          portalType: 'student',
          portalArea: 'dashboard',
          frontendPath: '/student',
          action: 'class_teacher.fetch',
        })
      );
    });
  });
});
