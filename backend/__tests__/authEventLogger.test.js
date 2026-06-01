describe('authEventLogger', () => {
  let loggerLog;
  let logSecurityEvent;
  let logAuthEvent;

  const buildReq = (overrides = {}) => ({
    method: 'POST',
    originalUrl: '/api/admin/auth/login',
    requestId: 'req-1',
    traceId: 'trace-1',
    headers: { 'user-agent': 'jest' },
    get: jest.fn((name) => (name === 'user-agent' ? 'jest' : undefined)),
    ip: '10.0.0.10',
    socket: { remoteAddress: '10.0.0.10' },
    ...overrides,
  });

  beforeEach(() => {
    jest.resetModules();
    loggerLog = jest.fn();
    logSecurityEvent = jest.fn();

    jest.doMock('../utils/logger', () => ({
      logger: {
        log: loggerLog,
      },
    }));

    jest.doMock('../utils/securityEventLogger', () => ({
      logSecurityEvent,
    }));

    ({ logAuthEvent } = require('../utils/authEventLogger'));
  });

  it('logs supported auth portal events with normalized metadata', () => {
    const req = buildReq({
      originalUrl: '/api/teacher/auth/login',
      headers: {
        'user-agent': 'Mozilla/5.0',
        'x-forwarded-for': '203.0.113.10',
      },
      ip: '203.0.113.10',
      socket: { remoteAddress: '10.0.0.2' },
    });

    logAuthEvent(req, {
      action: 'teacher.login',
      outcome: 'success',
      userType: 'teacher',
      identifier: 12345,
      userId: 67890,
      schoolId: 9,
      campusId: 4,
      statusCode: 200,
      sessionId: 'session-1',
    });

    expect(loggerLog).toHaveBeenCalledTimes(1);
    expect(loggerLog).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        message: 'Auth event',
        event: 'auth_event',
        action: 'teacher.login',
        outcome: 'success',
        userType: 'teacher',
        identifier: '12345',
        userId: '67890',
        schoolId: '9',
        campusId: '4',
        statusCode: 200,
        method: 'POST',
        path: '/api/teacher/auth/login',
        ip: '203.0.113.10',
        remoteIp: '10.0.0.2',
        ipSource: 'trusted_proxy_or_socket',
        forwardedForChain: ['203.0.113.10'],
        forwardedForCount: 1,
        sessionId: 'session-1',
      })
    );
    expect(logSecurityEvent).not.toHaveBeenCalled();
  });

  it('emits a mirrored security event for failed login attempts', () => {
    const req = buildReq({
      originalUrl: '/api/student/auth/login',
      ip: '198.51.100.5',
      socket: { remoteAddress: '198.51.100.5' },
    });

    logAuthEvent(req, {
      action: 'student.login',
      outcome: 'failure',
      userType: 'student',
      identifier: 'roll-7',
      reason: 'Invalid password',
      statusCode: 401,
    });

    expect(loggerLog).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
        outcome: 'failure',
        reason: 'Invalid password',
        statusCode: 401,
      })
    );
    expect(logSecurityEvent).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        action: 'security.auth_failure_detected',
        outcome: 'observed',
        severity: 'medium',
        attack_type: 'bruteforce_or_auth_abuse',
        riskScore: 65,
        reason: 'Invalid password',
        statusCode: 401,
        authAction: 'student.login',
        authUserType: 'student',
        identifier: 'roll-7',
      })
    );
  });

  it('does not log unrelated paths or user types', () => {
    const req = buildReq({
      originalUrl: '/api/healthchecks',
    });

    logAuthEvent(req, {
      action: 'guest.lookup',
      outcome: 'success',
      userType: 'guest',
    });

    expect(loggerLog).not.toHaveBeenCalled();
    expect(logSecurityEvent).not.toHaveBeenCalled();
  });
});
