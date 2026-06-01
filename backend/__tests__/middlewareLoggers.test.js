describe('logger middleware', () => {
  const makeRes = () => {
    const listeners = {};
    return {
      statusCode: 200,
      headers: {},
      on: jest.fn((event, cb) => {
        listeners[event] = cb;
      }),
      setHeader: jest.fn((name, value) => {
        listeners[`header:${name}`] = value;
      }),
      __finish: () => listeners.finish && listeners.finish(),
      __listeners: listeners,
    };
  };

  describe('requestLogger', () => {
    let logger;
    let childLogger;
    let logSecurityEvent;
    let requestLogger;

    beforeEach(() => {
      jest.resetModules();
      childLogger = { log: jest.fn() };
      logger = {
        info: jest.fn(),
        child: jest.fn(() => childLogger),
      };
      logSecurityEvent = jest.fn();

      jest.doMock('../utils/logger', () => ({ logger }));
      jest.doMock('../utils/securityEventLogger', () => ({ logSecurityEvent }));

      requestLogger = require('../middleware/requestLogger');
    });

    it('attaches request ids, child logger, and start/finish request logs for api paths', () => {
      const req = {
        method: 'GET',
        originalUrl: '/api/attendance/list',
        headers: {
          'x-request-id': 'req-header',
          'x-trace-id': 'trace-header',
          'user-agent': 'Mozilla/5.0',
        },
        get: jest.fn((name) => req.headers[name]),
        ip: '203.0.113.9',
        socket: { remoteAddress: '10.0.0.10' },
        user: { id: 'stu-1', userType: 'student', schoolId: 'school-1', campusId: 'campus-1' },
      };
      const res = makeRes();
      const next = jest.fn();

      requestLogger(req, res, next);
      res.__finish();

      expect(req.requestId).toBe('req-header');
      expect(req.traceId).toBe('trace-header');
      expect(req.log).toBe(childLogger);
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'req-header');
      expect(res.setHeader).toHaveBeenCalledWith('x-trace-id', 'trace-header');
      expect(logger.child).toHaveBeenCalledWith({ requestId: 'req-header', traceId: 'trace-header' });
      expect(logger.info).toHaveBeenNthCalledWith(
        1,
        'HTTP request started',
        expect.objectContaining({
          event: 'http_request_start',
          path: '/api/attendance/list',
          forwardedForCount: 0,
          ip: '203.0.113.9',
        })
      );
      expect(logger.info).toHaveBeenNthCalledWith(
        2,
        'HTTP request completed',
        expect.objectContaining({
          event: 'http_request_complete',
          userId: 'stu-1',
          userType: 'student',
          schoolId: 'school-1',
          campusId: 'campus-1',
          statusCode: 200,
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('emits a security event when forwarded headers look suspicious', () => {
      const req = {
        method: 'GET',
        originalUrl: '/api/chat',
        headers: {
          'x-forwarded-for': '127.0.0.1, 203.0.113.10',
          'user-agent': 'Jest',
        },
        get: jest.fn((name) => req.headers[name]),
        socket: { remoteAddress: '198.51.100.22' },
      };
      const res = makeRes();

      requestLogger(req, res, jest.fn());

      expect(logSecurityEvent).toHaveBeenCalledWith(
        req,
        expect.objectContaining({
          action: 'security.header_forwarding_suspicious',
          outcome: 'observed',
          severity: 'medium',
        })
      );
    });

    it('skips request body logging for non-api paths while still assigning ids', () => {
      const req = {
        method: 'GET',
        originalUrl: '/health',
        headers: {},
        get: jest.fn(),
      };
      const res = makeRes();

      requestLogger(req, res, jest.fn());

      expect(req.requestId).toBeDefined();
      expect(req.traceId).toBeDefined();
      expect(logger.info).not.toHaveBeenCalled();
      expect(logSecurityEvent).not.toHaveBeenCalled();
    });
  });

  describe('adminActionLogger', () => {
    let logger;
    let adminActionLogger;

    beforeEach(() => {
      jest.resetModules();
      logger = { log: jest.fn() };
      jest.doMock('../utils/logger', () => ({ logger }));
      adminActionLogger = require('../middleware/adminActionLogger');
    });

    it('sanitizes sensitive values and truncates oversized payloads', () => {
      const req = {
        method: 'POST',
        originalUrl: '/api/admin/users/create',
        requestId: 'req-2',
        query: { page: '1', token: 'secret-token' },
        params: { id: 'abc' },
        body: {
          username: 'alice',
          password: 'super-secret',
          nested: {
            apiKey: 'key',
            notes: 'a'.repeat(510),
          },
        },
        admin: { id: 'admin-1', schoolId: 'school-1', campusId: 'campus-1' },
      };
      const res = makeRes();
      res.statusCode = 201;

      adminActionLogger(req, res, jest.fn());
      res.__finish();

      expect(logger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          event: 'admin_portal_action',
          actorId: 'admin-1',
          actorType: 'admin',
          query: { page: '1', token: '[redacted]' },
          body: {
            username: 'alice',
            password: '[redacted]',
            nested: {
              apiKey: '[redacted]',
              notes: `${'a'.repeat(500)}...[truncated]`,
            },
          },
        })
      );
    });
  });

  describe('portalActionLogger', () => {
    let logStudentPortalEvent;
    let portalActionLogger;

    beforeEach(() => {
      jest.resetModules();
      logStudentPortalEvent = jest.fn();
      jest.doMock('../utils/studentPortalLogger', () => ({
        logStudentPortalEvent,
      }));
      portalActionLogger = require('../middleware/portalActionLogger');
    });

    it('logs successful portal requests after the response finishes', () => {
      const req = {
        method: 'PATCH',
        originalUrl: '/api/lesson-plans/teacher/42',
      };
      const res = makeRes();
      res.statusCode = 204;

      portalActionLogger(req, res, jest.fn());
      res.__finish();

      expect(logStudentPortalEvent).toHaveBeenCalledWith(
        req,
        expect.objectContaining({
          action: 'request.update',
          outcome: 'success',
          statusCode: 204,
          force: true,
        })
      );
    });

    it('skips auth paths and already-logged portal events', () => {
      const authReq = { method: 'POST', originalUrl: '/api/student/auth/login' };
      const authRes = makeRes();
      portalActionLogger(authReq, authRes, jest.fn());
      authRes.__finish();

      const loggedReq = { method: 'GET', originalUrl: '/api/chat', _portalEventLogged: true };
      const loggedRes = makeRes();
      portalActionLogger(loggedReq, loggedRes, jest.fn());
      loggedRes.__finish();

      expect(logStudentPortalEvent).not.toHaveBeenCalled();
    });
  });

  describe('tokenReplayTelemetry', () => {
    let logSecurityEvent;
    let tokenReplayTelemetry;

    const makeJwt = (payload) => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return `${header}.${body}.signature`;
    };

    beforeEach(() => {
      jest.resetModules();
      jest.useFakeTimers();
      logSecurityEvent = jest.fn();
      jest.doMock('../utils/securityEventLogger', () => ({ logSecurityEvent }));
      tokenReplayTelemetry = require('../middleware/tokenReplayTelemetry');
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('records replay telemetry when the same bearer token is seen from multiple sources', () => {
      const token = makeJwt({ sub: 'user-1', jti: 'jti-1', iss: 'issuer', aud: 'audience' });
      const reqA = {
        headers: { authorization: `Bearer ${token}`, 'user-agent': 'Browser A' },
        get: jest.fn((name) => reqA.headers[name]),
        ip: '203.0.113.1',
        socket: { remoteAddress: '203.0.113.1' },
        method: 'GET',
        originalUrl: '/api/chat',
      };
      const reqB = {
        headers: { authorization: `Bearer ${token}`, 'user-agent': 'Browser B' },
        get: jest.fn((name) => reqB.headers[name]),
        ip: '198.51.100.2',
        socket: { remoteAddress: '198.51.100.2' },
        method: 'GET',
        originalUrl: '/api/chat',
      };

      tokenReplayTelemetry(reqA, {}, jest.fn());
      tokenReplayTelemetry(reqB, {}, jest.fn());

      expect(logSecurityEvent).toHaveBeenCalledWith(
        reqB,
        expect.objectContaining({
          action: 'security.token_replay_suspected',
          outcome: 'observed',
          severity: 'high',
          tokenId: 'jti-1',
          tokenSubject: 'user-1',
          tokenIssuer: 'issuer',
          tokenAudience: 'audience',
          distinctSourceCount: 2,
          observedSources: expect.arrayContaining([
            '203.0.113.1|Browser A',
            '198.51.100.2|Browser B',
          ]),
        })
      );
    });

    it('ignores requests without a bearer token', () => {
      tokenReplayTelemetry({ headers: {}, get: jest.fn() }, {}, jest.fn());
      expect(logSecurityEvent).not.toHaveBeenCalled();
    });
  });
});
